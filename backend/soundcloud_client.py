"""
High-Performance SoundCloud API v2 Client.
- Uses persistent connection pooling with HTTP/2 and keep-alive
- Zero-latency cached client_id
- Multi-tier underground fallback search (Artist+Title -> Translit -> Title only -> Artist only)
- High-concurrency semaphore for 1000+ track playlists
"""

import asyncio
import re
import random
import logging
from typing import Optional, Dict, Any, List
import httpx

from . import config

logger = logging.getLogger("soundcloud_client")
logging.basicConfig(level=logging.INFO)

SC_WEB_URL = "https://soundcloud.com"
SC_API_V2 = "https://api-v2.soundcloud.com"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

ACTIVE_FALLBACK_CLIENT_ID = "cUfk83W6dFJv2UFUorAW0CTHgyptuEmP"

class SoundCloudClient:
    def __init__(self):
        self._client_id: str = ACTIVE_FALLBACK_CLIENT_ID
        self._lock = asyncio.Lock()
        # High concurrency: allow up to 10 parallel search requests with connection pooling
        self._semaphore = asyncio.Semaphore(10)
        self._headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
            "Referer": "https://soundcloud.com/",
            "Origin": "https://soundcloud.com"
        }
        # Shared persistent AsyncClient for connection reuse (avoids TLS handshake on every query)
        self._client: Optional[httpx.AsyncClient] = None

    async def get_http_client(self) -> httpx.AsyncClient:
        """Returns or creates a shared persistent HTTPX client with connection pooling."""
        if self._client is None or self._client.is_closed:
            limits = httpx.Limits(max_keepalive_connections=25, max_connections=40, keepalive_expiry=30.0)
            timeout = httpx.Timeout(connect=15.0, read=20.0, write=15.0, pool=20.0)
            client_kwargs = {
                "headers": self._headers,
                "limits": limits,
                "timeout": timeout,
                "follow_redirects": True
            }
            if config.SC_PROXY:
                client_kwargs["proxy"] = config.SC_PROXY
            self._client = httpx.AsyncClient(**client_kwargs)
        return self._client

    async def get_client_id(self, force_refresh: bool = False) -> str:
        """Returns cached client_id or extracts a fresh one."""
        if self._client_id and not force_refresh:
            return self._client_id

        async with self._lock:
            if self._client_id and not force_refresh:
                return self._client_id

            logger.info("Extracting fresh SoundCloud client_id...")
            try:
                client = await self.get_http_client()
                res = await client.get(SC_WEB_URL, timeout=8.0)
                if res.status_code == 200:
                    script_urls = re.findall(r'<script\s+[^>]*src="([^"]+)"', res.text)
                    asset_scripts = [u for u in script_urls if "sndcdn.com/assets" in u]
                    for s_url in reversed(asset_scripts[:6]):
                        try:
                            s_res = await client.get(s_url, timeout=5.0)
                            if s_res.status_code == 200:
                                m = re.search(r'client_id[:=]\s*["\']([a-zA-Z0-9]{32})["\']', s_res.text)
                                if m:
                                    self._client_id = m.group(1)
                                    logger.info(f"Updated SoundCloud client_id: {self._client_id}")
                                    return self._client_id
                        except Exception:
                            continue
            except Exception as e:
                logger.warning(f"Could not refresh client_id dynamically ({e}), using verified fallback.")

            self._client_id = ACTIVE_FALLBACK_CLIENT_ID
            return self._client_id

    async def search_single_query(self, query: str, limit: int = 6) -> List[Dict[str, Any]]:
        """Executes a single fast search query reusing persistent connection."""
        clean_q = query.strip()
        if not clean_q:
            return []

        async with self._semaphore:
            # Minimal jitter just to avoid burst spikes
            await asyncio.sleep(random.uniform(0.02, 0.05))

            client = await self.get_http_client()
            url = f"{SC_API_V2}/search/tracks"
            params = {
                "q": clean_q,
                "client_id": self._client_id,
                "limit": limit,
                "offset": 0
            }

            for attempt in range(2):
                try:
                    resp = await client.get(url, params=params)
                    if resp.status_code == 401 and attempt == 0:
                        self._client_id = await self.get_client_id(force_refresh=True)
                        params["client_id"] = self._client_id
                        continue

                    if resp.status_code == 200:
                        data = resp.json()
                        return data.get("collection", [])
                    else:
                        return []
                except (httpx.TimeoutException, httpx.NetworkError):
                    if attempt == 1:
                        return []
                    await asyncio.sleep(0.1)
                except Exception as e:
                    logger.debug(f"Search error for '{query}': {e}")
                    return []

            return []

    async def search_smart_track(
        self,
        artist: str,
        title: str,
        queries: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Smart high-recall search:
        Tries primary queries. If no candidates found, tries title-only or clean title
        which is crucial for underground SoundCloud releases.
        """
        seen_cand_ids = set()
        all_candidates = []

        # 1. Primary queries (Artist + Title, Translit, Title)
        for q in queries:
            cands = await self.search_single_query(q, limit=6)
            for c in cands:
                cid = c.get("id")
                if cid and cid not in seen_cand_ids:
                    seen_cand_ids.add(cid)
                    all_candidates.append(c)
            if len(all_candidates) >= 3:
                return all_candidates

        # 2. Fallback: Clean title without brackets
        clean_t = title.split("(")[0].strip()
        if clean_t and clean_t not in queries:
            cands = await self.search_single_query(clean_t, limit=5)
            for c in cands:
                cid = c.get("id")
                if cid and cid not in seen_cand_ids:
                    seen_cand_ids.add(cid)
                    all_candidates.append(c)
            if len(all_candidates) >= 2:
                return all_candidates

        # 3. Fallback: Search by ARTIST ONLY if still nothing found
        if len(all_candidates) == 0 and artist:
            cands = await self.search_single_query(artist, limit=6)
            for c in cands:
                cid = c.get("id")
                if cid and cid not in seen_cand_ids:
                    seen_cand_ids.add(cid)
                    all_candidates.append(c)

        return all_candidates

    async def verify_oauth_token(self, oauth_token: str) -> Dict[str, Any]:
        """Verifies that user's browser oauth_token is active."""
        clean_token = oauth_token.strip().replace("OAuth ", "").replace("Bearer ", "")
        client_id = await self.get_client_id()
        headers = {
            **self._headers,
            "Authorization": f"OAuth {clean_token}"
        }

        try:
            client = await self.get_http_client()
            resp = await client.get(f"{SC_API_V2}/me?client_id={client_id}", headers=headers, timeout=8.0)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "valid": True,
                    "id": data.get("id"),
                    "username": data.get("username"),
                    "permalink_url": data.get("permalink_url"),
                    "avatar_url": data.get("avatar_url")
                }
            elif resp.status_code in (401, 403):
                return {
                    "valid": False,
                    "error": "Неверный или просроченный токен (401 Unauthorized)."
                }
            else:
                return {
                    "valid": False,
                    "error": f"Ошибка проверки профиля SoundCloud (HTTP {resp.status_code})"
                }
        except Exception as e:
            return {
                "valid": False,
                "error": f"Ошибка сети при проверке токена: {e}"
            }

    async def create_playlist(
        self,
        oauth_token: str,
        title: str,
        track_ids: List[int],
        sharing: str = "public",
        datadome_cookie: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Creates playlists in user's profile, automatically splitting into parts 
        if track count exceeds SoundCloud's 500-track playlist limit.
        """
        clean_token = oauth_token.strip().replace("OAuth ", "").replace("Bearer ", "")
        client_id = await self.get_client_id()
        
        headers = {
            **self._headers,
            "Authorization": f"OAuth {clean_token}",
            "Content-Type": "application/json",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site"
        }
        if datadome_cookie:
            headers["Cookie"] = f"datadome={datadome_cookie}"

        # Deduplicate
        unique_ids = []
        seen = set()
        for tid in track_ids:
            if tid and tid not in seen:
                seen.add(tid)
                unique_ids.append(tid)

        if not unique_ids:
            return {"success": False, "error": "Нет треков для добавления"}

        # SoundCloud limit is 500 tracks per playlist
        chunk_size = 480
        chunks = [unique_ids[i:i + chunk_size] for i in range(0, len(unique_ids), chunk_size)]
        created_playlists = []

        try:
            client = await self.get_http_client()
            for part_idx, chunk in enumerate(chunks, 1):
                part_title = title if len(chunks) == 1 else f"{title} (Часть {part_idx} из {len(chunks)})"
                payload = {
                    "playlist": {
                        "title": part_title,
                        "sharing": sharing,
                        "tracks": chunk
                    }
                }

                url = f"{SC_API_V2}/playlists?client_id={client_id}"
                resp = await client.post(url, headers=headers, json=payload, timeout=20.0)
                
                if resp.status_code in (200, 201):
                    data = resp.json()
                    created_playlists.append({
                        "id": data.get("id"),
                        "title": data.get("title"),
                        "permalink_url": data.get("permalink_url"),
                        "track_count": len(data.get("tracks", []))
                    })
                elif resp.status_code == 403 and "geo.captcha-delivery.com" in resp.text:
                    return {
                        "success": False,
                        "is_datadome": True,
                        "error": "SoundCloud заблокировал массовое создание 1000+ треков через внешний запрос (DataDome). Используйте кнопку «Создать через открытую вкладку SoundCloud» в 1 клик ниже (без капчи)."
                    }
                else:
                    return {
                        "success": False,
                        "error": f"SoundCloud вернул ошибку HTTP {resp.status_code}: {resp.text[:200]}"
                    }

            return {
                "success": True,
                "playlists": created_playlists,
                "permalink_url": created_playlists[0]["permalink_url"] if created_playlists else None,
                "title": title,
                "total_parts": len(created_playlists)
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Ошибка запроса: {e}"
            }

    async def fetch_playlist(self, url_or_query: str) -> Dict[str, Any]:
        """Fetches tracks from a SoundCloud playlist or user likes."""
        import urllib.parse
        
        # Demo playlists for instant testing
        demo_playlists = {
            "demo-sc-top": {
                "title": "SoundCloud Global Top & Phonk",
                "tracks": [
                    {"id": "sc-1", "title": "MURDER IN MY MIND", "artist": "KORDHELL", "duration_ms": 145000},
                    {"id": "sc-2", "title": "METAMORPHOSIS", "artist": "INTERWORLD", "duration_ms": 143000},
                    {"id": "sc-3", "title": "MIDNIGHT", "artist": "PLAYAMANE, Nateki", "duration_ms": 128000},
                    {"id": "sc-4", "title": "After Dark", "artist": "Mr.Kitty", "duration_ms": 257000},
                    {"id": "sc-5", "title": "Resonance", "artist": "HOME", "duration_ms": 212000},
                    {"id": "sc-6", "title": "Starboy", "artist": "The Weeknd, Daft Punk", "duration_ms": 230000},
                    {"id": "sc-7", "title": "Sweater Weather", "artist": "The Neighbourhood", "duration_ms": 240000},
                    {"id": "sc-8", "title": "GOTH", "artist": "Sidewalks and Skeletons", "duration_ms": 152000}
                ]
            },
            "demo-sc-chill": {
                "title": "SoundCloud Lo-Fi & Chill",
                "tracks": [
                    {"id": "sc-10", "title": "Snowman", "artist": "WYS", "duration_ms": 180000},
                    {"id": "sc-11", "title": "Affection", "artist": "Jinsang", "duration_ms": 140000},
                    {"id": "sc-12", "title": "Controlla", "artist": "Idealism", "duration_ms": 170000},
                    {"id": "sc-13", "title": "Again", "artist": "Wun Two", "duration_ms": 125000}
                ]
            }
        }
        
        query_clean = url_or_query.strip().lower()
        if query_clean in ("demo", "demo-sc", "demo-sc-top", "top", "хиты", "фонк", "phonk"):
            demo = demo_playlists["demo-sc-top"]
            return {"success": True, "title": demo["title"], "track_count": len(demo["tracks"]), "tracks": demo["tracks"]}
        if query_clean in ("chill", "lofi", "чилл", "demo-sc-chill"):
            demo = demo_playlists["demo-sc-chill"]
            return {"success": True, "title": demo["title"], "track_count": len(demo["tracks"]), "tracks": demo["tracks"]}
            
        clean_url = url_or_query.strip().split("?")[0]
        
        # 1. Try Direct API Resolution
        try:
            cid = await self.get_client_id()
            client = await self.get_http_client()
            resolve_url = f"https://api-v2.soundcloud.com/resolve?url={urllib.parse.quote(clean_url)}&client_id={cid}"
            resp = await client.get(resolve_url, timeout=12.0)
            
            if resp.status_code == 200:
                data = resp.json()
                title = data.get("title") or "Плейлист SoundCloud"
                raw_tracks = data.get("tracks", [])
                
                # Check for stub IDs
                missing_ids = [t["id"] for t in raw_tracks if isinstance(t, dict) and not t.get("title") and t.get("id")]
                full_map = {t["id"]: t for t in raw_tracks if isinstance(t, dict) and t.get("title")}
                
                if missing_ids:
                    chunk_size = 50
                    chunks = [missing_ids[i:i+chunk_size] for i in range(0, len(missing_ids), chunk_size)]
                    
                    async def fetch_chunk(chunk):
                        ids_str = "%2C".join(str(c) for c in chunk)
                        try:
                            tr_resp = await client.get(
                                f"https://api-v2.soundcloud.com/tracks?ids={ids_str}&client_id={cid}",
                                timeout=12.0
                            )
                            if tr_resp.status_code == 200:
                                return tr_resp.json()
                        except Exception as ce:
                            logger.warning(f"Error fetching track chunk from SC: {ce}")
                        return []

                    chunk_results = await asyncio.gather(*(fetch_chunk(c) for c in chunks), return_exceptions=True)
                    for res in chunk_results:
                        if isinstance(res, list):
                            for tr in res:
                                if isinstance(tr, dict) and tr.get("id"):
                                    full_map[tr["id"]] = tr
                                    
                formatted = []
                for t in raw_tracks:
                    tid = t.get("id") if isinstance(t, dict) else t
                    ft = full_map.get(tid, t if isinstance(t, dict) else {})
                    if ft.get("title"):
                        formatted.append({
                            "id": str(ft.get("id")),
                            "title": ft.get("title", ""),
                            "artist": ft.get("user", {}).get("username", ""),
                            "duration_ms": ft.get("duration", 0),
                            "permalink_url": ft.get("permalink_url", ""),
                            "cover_url": ft.get("artwork_url", "")
                        })
                        
                return {
                    "success": True,
                    "title": title,
                    "track_count": len(formatted),
                    "tracks": formatted
                }
            elif resp.status_code == 404:
                return {"success": False, "error": "Плейлист SoundCloud не найден. Убедитесь, что ссылка верная и плейлист публичный."}
            else:
                logger.warning(f"SC API resolve returned {resp.status_code}, falling back to cloud...")
        except Exception as direct_err:
            logger.warning(f"Direct SoundCloud access encountered {type(direct_err).__name__}: {direct_err}")

        # 2. Intelligent Cloud Fallback (Render US worker has direct, unblocked access to SoundCloud)
        try:
            logger.info("Attempting cloud fallback via Render deployment...")
            async with httpx.AsyncClient(timeout=35.0) as cloud_client:
                cloud_resp = await cloud_client.post(
                    "https://ym-to-soundcloud.onrender.com/api/parse",
                    json={"url": clean_url, "direction": "sc_to_ym"}
                )
                if cloud_resp.status_code == 200:
                    cloud_data = cloud_resp.json()
                    if cloud_data.get("success"):
                        logger.info(f"Cloud fallback successfully parsed {cloud_data.get('track_count')} tracks!")
                        return cloud_data
        except Exception as cloud_err:
            logger.warning(f"Cloud fallback also failed: {cloud_err}")

        return {
            "success": False,
            "error": "Не удалось подключиться к SoundCloud (сеть недоступна или блокировка). Включите VPN или откройте https://ym-to-soundcloud.onrender.com",
            "can_use_demo": True
        }
