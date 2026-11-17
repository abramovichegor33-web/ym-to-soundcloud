"""
Yandex Music Zero-Login Playlist Parser.
Supports:
- Legacy user playlists: /users/{owner}/playlists/{kind}
- Modern shareable UUID links: /playlists/lk.{uuid}
- Direct playlists: /playlists/{id_or_uuid}
- Album links: /album/{album_id}
- Automatic redirect resolution & HTML initial state extraction
"""

import re
import json
import logging
from typing import Optional, Dict, Any, List, Tuple
import httpx
from bs4 import BeautifulSoup
from . import config

logger = logging.getLogger("yandex_parser")
logging.basicConfig(level=logging.INFO)

YM_BASE_URL = "https://music.yandex.ru"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

# Demo tracks for instant out-of-the-box testing or when Yandex network is unreachable
DEMO_PLAYLISTS = {
    "rock": {
        "title": "Культовый Русский Рок & Инди",
        "owner": "yandex-curator",
        "description": "Легендарные треки для демонстрации переноса",
        "cover_url": "https://avatars.yandex.net/get-music-content/2358262/34213715-1/400x400",
        "tracks": [
            {"id": "ym-1", "artist": "Кино", "title": "Группа крови", "album": "Группа крови", "duration_ms": 286000, "cover_url": "https://avatars.yandex.net/get-music-content/175191/81bcf7fb.a.41180-1/200x200"},
            {"id": "ym-2", "artist": "Земфира", "title": "Искала", "album": "Прости меня моя любовь", "duration_ms": 213000, "cover_url": "https://avatars.yandex.net/get-music-content/42108/e2327575.a.37989-1/200x200"},
            {"id": "ym-3", "artist": "Сплин", "title": "Мое сердце", "album": "25-й кадр", "duration_ms": 249000, "cover_url": "https://avatars.yandex.net/get-music-content/38044/b3fc5b9f.a.48705-1/200x200"},
            {"id": "ym-4", "artist": "Би-2", "title": "Полковнику никто не пишет", "album": "Би-2", "duration_ms": 293000, "cover_url": "https://avatars.yandex.net/get-music-content/32236/a07675f9.a.27367-1/200x200"},
            {"id": "ym-5", "artist": "Дайте танк (!)", "title": "Люди", "album": "Человеко-часы", "duration_ms": 204000, "cover_url": "https://avatars.yandex.net/get-music-content/2418049/220fc5cf.a.11956553-1/200x200"},
            {"id": "ym-6", "artist": "Мумий Тролль", "title": "Владивосток 2000", "album": "Морская", "duration_ms": 160000, "cover_url": "https://avatars.yandex.net/get-music-content/42108/a8f1df45.a.37988-1/200x200"}
        ]
    },
    "electronic": {
        "title": "Электронный Вайб & Hip-Hop",
        "owner": "yandex-curator",
        "description": "Современные хиты и биты",
        "cover_url": "https://avatars.yandex.net/get-music-content/2358262/34213715-1/400x400",
        "tracks": [
            {"id": "ym-10", "artist": "Скриптонит", "title": "Положение", "album": "Праздник на улице 36", "duration_ms": 283000, "cover_url": "https://avatars.yandex.net/get-music-content/28525/89ba1f60.a.4385150-1/200x200"},
            {"id": "ym-11", "artist": "Miyagi & Andy Panda", "title": "Minor", "album": "YAMAKASI", "duration_ms": 175000, "cover_url": "https://avatars.yandex.net/get-music-content/2388701/37f82725.a.11181816-1/200x200"},
            {"id": "ym-12", "artist": "Saluki", "title": "Властелин Калек", "album": "Властелин Калек", "duration_ms": 194000, "cover_url": "https://avatars.yandex.net/get-music-content/175191/9efcb400.a.7328901-1/200x200"},
            {"id": "ym-13", "artist": "Kavinsky", "title": "Nightcall", "album": "OutRun", "duration_ms": 259000, "cover_url": "https://avatars.yandex.net/get-music-content/98892/79cbe8b0.a.1384050-1/200x200"}
        ]
    }
}

class YandexMusicParser:
    def __init__(self):
        self._headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": "https://music.yandex.ru/"
        }

    def _create_http_client(self, timeout: float = 12.0, follow_redirects: bool = True) -> httpx.AsyncClient:
        kwargs = {
            "headers": self._headers,
            "timeout": timeout,
            "follow_redirects": follow_redirects
        }
        if config.YM_PROXY:
            kwargs["proxy"] = config.YM_PROXY
        return httpx.AsyncClient(**kwargs)

    def is_url(self, text: str) -> bool:
        """Checks if input is a URL rather than raw text."""
        t = text.strip().lower()
        return (
            t.startswith("http://") or
            t.startswith("https://") or
            "music.yandex." in t or
            "yandex.ru/playlists" in t
        )

    def extract_url_params(self, url: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Parses url pattern and returns (type, id_or_owner, kind_or_extra)
        Types: 'demo' | 'user_playlist' | 'uuid_playlist' | 'album'
        """
        url = url.strip()

        # Check demo keywords
        if url.lower() in ("demo", "demo-rock", "рок", "rock"):
            return ("demo", "rock", None)
        if url.lower() in ("demo-electro", "electro", "электроника"):
            return ("demo", "electronic", None)

        # 1. /users/{owner}/playlists/{kind}
        m = re.search(r'users/([^/?#]+)/playlists/(\d+)', url)
        if m:
            return ("user_playlist", m.group(1), m.group(2))

        # 2. Modern shareable UUID /playlists/lk.{uuid} or /playlists/{uuid}
        m = re.search(r'playlists/(lk\.[a-zA-Z0-9\-]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})', url, re.IGNORECASE)
        if m:
            return ("uuid_playlist", m.group(1), None)

        # 3. Numeric /playlists/{kind}
        m = re.search(r'playlists/(\d+)', url)
        if m:
            return ("user_playlist", "yamusic-top", m.group(1))

        # 4. Any other /playlists/{anything}
        m = re.search(r'playlists/([^/?#]+)', url)
        if m:
            val = m.group(1)
            if val.isdigit():
                return ("user_playlist", "yamusic-top", val)
            else:
                return ("uuid_playlist", val, None)

        # 5. /album/{album_id}
        m = re.search(r'album/(\d+)', url)
        if m:
            return ("album", m.group(1), None)

        return (None, None, None)

    async def fetch_playlist(self, url_or_identifier: str) -> Dict[str, Any]:
        """
        Fetches full playlist details and tracklist from Yandex Music without authorization.
        Automatically resolves redirects for shareable lk. links.
        """
        raw_input = url_or_identifier.strip()
        target_type, param1, param2 = self.extract_url_params(raw_input)

        # Return demo playlist if requested
        if target_type == "demo":
            key = param1 if param1 in DEMO_PLAYLISTS else "rock"
            demo = DEMO_PLAYLISTS[key]
            return {
                "success": True,
                "title": demo["title"],
                "owner": demo["owner"],
                "description": demo["description"],
                "cover_url": demo["cover_url"],
                "track_count": len(demo["tracks"]),
                "tracks": demo["tracks"],
                "is_demo": True
            }

        # If it's a URL but unrecognized by regex, treat as general URL and resolve
        if self.is_url(raw_input):
            return await self._resolve_and_fetch_url(raw_input)

        # Not a URL: check if user passed plain text list of tracks "Artist - Title"
        lines = [l.strip() for l in raw_input.splitlines() if l.strip() and "-" in l]
        if len(lines) >= 1:
            return self._parse_text_tracklist(lines)

        return {
            "success": False,
            "error": "Не удалось распознать ссылку на плейлист Яндекс Музыки. Поддерживаются ссылки вида https://music.yandex.ru/playlists/lk... или https://music.yandex.ru/users/.../playlists/..."
        }

    async def _resolve_and_fetch_url(self, url: str) -> Dict[str, Any]:
        """
        Fetches the URL, follows redirects (e.g. lk.UUID -> /users/owner/playlists/kind),
        and extracts playlist data from redirected handlers or embedded HTML state.
        """
        clean_url = url.split("?")[0] if "music.yandex." in url else url
        if not clean_url.startswith("http"):
            clean_url = f"https://{clean_url}"

        logger.info(f"Resolving Yandex Music URL: {clean_url}")

        try:
            async with self._create_http_client(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(clean_url)
                final_url = str(resp.url)
                logger.info(f"Final redirected URL: {final_url} (HTTP {resp.status_code})")

                # Check if redirected to standard /users/{owner}/playlists/{kind}
                m_user = re.search(r'users/([^/?#]+)/playlists/(\d+)', final_url)
                if m_user:
                    owner, kind = m_user.group(1), m_user.group(2)
                    return await self._fetch_playlist_data(owner, kind)

                # Check if redirected to album
                m_album = re.search(r'album/(\d+)', final_url)
                if m_album:
                    return await self._fetch_album(m_album.group(1))

                # If still at lk. or /playlists/, try extracting JSON from the HTML response
                if resp.status_code == 200:
                    html_result = self._extract_playlist_from_html(resp.text)
                    if html_result and html_result.get("success"):
                        return html_result

                # Try API endpoints for UUID
                m_uuid = re.search(r'playlists/(lk\.[a-zA-Z0-9\-]+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})', clean_url, re.IGNORECASE)
                if m_uuid:
                    uuid_val = m_uuid.group(1)
                    api_result = await self._fetch_by_uuid(uuid_val)
                    if api_result.get("success"):
                        return api_result

        except Exception as e:
            logger.error(f"Error resolving URL {url}: {e}")

        # Fallback explanation if direct network resolution failed
        return {
            "success": False,
            "error": "Не удалось загрузить плейлист по этой ссылке. Совет: откройте эту ссылку в браузере — она автоматически перенаправит на полный адрес вида music.yandex.ru/users/.../playlists/..., скопируйте его из адресной строки и вставьте сюда."
        }

    async def _fetch_by_uuid(self, uuid_val: str) -> Dict[str, Any]:
        """Tries various endpoints that accept UUID."""
        clean_uuid = uuid_val.replace("lk.", "")
        candidates = [
            f"https://api.music.yandex.net/playlist/{uuid_val}",
            f"https://api.music.yandex.net/playlist/{clean_uuid}",
            f"{YM_BASE_URL}/handlers/playlist.jsx?uuid={uuid_val}&light=false&lang=ru",
            f"{YM_BASE_URL}/handlers/playlist.jsx?uuid={clean_uuid}&light=false&lang=ru"
        ]

        for ep in candidates:
            try:
                async with self._create_http_client(timeout=10.0, follow_redirects=False) as client:
                    r = await client.get(ep)
                    if r.status_code == 200:
                        data = r.json()
                        pl = data.get("playlist") or data.get("result")
                        if pl:
                            return self._format_playlist(pl)
            except Exception:
                continue

        return {"success": False}

    def _extract_playlist_from_html(self, html: str) -> Optional[Dict[str, Any]]:
        """Scrapes embedded React / Redux / Next.js state from playlist HTML."""
        # Method A: window.__INITIAL_STATE__
        m_state = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.+?});\s*</script>', html)
        if m_state:
            try:
                state_data = json.loads(m_state.group(1))
                pl = state_data.get("playlist") or state_data.get("pageData", {}).get("playlist")
                if pl:
                    return self._format_playlist(pl)
            except Exception as e:
                logger.warning(f"Error parsing __INITIAL_STATE__: {e}")

        # Method B: <script id="__NEXT_DATA__" type="application/json">
        m_next = re.search(r'<script\s+id="__NEXT_DATA__"[^>]*>({.+?})</script>', html)
        if m_next:
            try:
                next_data = json.loads(m_next.group(1))
                props = next_data.get("props", {}).get("pageProps", {})
                pl = props.get("playlist") or props.get("initialState", {}).get("playlist")
                if pl:
                    return self._format_playlist(pl)
            except Exception as e:
                logger.warning(f"Error parsing __NEXT_DATA__: {e}")

        return None

    async def _fetch_playlist_data(self, owner: str, kind: str) -> Dict[str, Any]:
        """Queries handlers/playlist.jsx and fallback methods."""
        endpoints = [
            f"{YM_BASE_URL}/handlers/playlist.jsx?owner={owner}&kinds={kind}&light=false&lang=ru",
            f"https://api.music.yandex.net/users/{owner}/playlists/{kind}"
        ]

        last_error = None
        for endpoint in endpoints:
            try:
                async with self._create_http_client(timeout=12.0, follow_redirects=True) as client:
                    resp = await client.get(endpoint)
                    if resp.status_code == 200:
                        data = resp.json()
                        pl = data.get("playlist") or data.get("result")
                        if pl:
                            return self._format_playlist(pl)
                    elif resp.status_code == 404:
                        return {
                            "success": False,
                            "error": "Плейлист не найден. Убедитесь, что он публичный и ссылка скопирована верно."
                        }
            except Exception as e:
                logger.warning(f"Error fetching from {endpoint}: {e}")
                last_error = e

        logger.error(f"Failed to fetch Yandex Music playlist: {last_error}")
        return {
            "success": False,
            "error": f"Не удалось подключиться к серверам Яндекс Музыки. Попробуйте скопировать постоянный адрес плейлиста из браузера.",
            "can_use_demo": True
        }

    async def _fetch_album(self, album_id: str) -> Dict[str, Any]:
        """Fetches tracks from an album URL."""
        endpoint = f"{YM_BASE_URL}/handlers/album.jsx?album={album_id}&lang=ru"
        try:
            async with self._create_http_client(timeout=12.0, follow_redirects=True) as client:
                resp = await client.get(endpoint)
                if resp.status_code == 200:
                    data = resp.json()
                    album_title = data.get("title", f"Альбом #{album_id}")
                    artists = ", ".join(a.get("name", "") for a in data.get("artists", []))
                    cover_uri = data.get("coverUri")
                    cover_url = f"https://{cover_uri.replace('%%', '400x400')}" if cover_uri else ""

                    tracks = []
                    volumes = data.get("volumes", [])
                    for vol in volumes:
                        for tr in vol:
                            tr_artists = ", ".join(a.get("name", "") for a in tr.get("artists", [])) or artists
                            dur_ms = tr.get("durationMs", 0)
                            tracks.append({
                                "id": str(tr.get("id")),
                                "artist": tr_artists,
                                "title": tr.get("title", ""),
                                "album": album_title,
                                "duration_ms": dur_ms,
                                "cover_url": cover_url
                            })

                    return {
                        "success": True,
                        "title": f"{artists} - {album_title}",
                        "owner": artists,
                        "description": f"Альбом {album_title}",
                        "cover_url": cover_url,
                        "track_count": len(tracks),
                        "tracks": tracks
                    }
        except Exception as e:
            logger.error(f"Error fetching album {album_id}: {e}")

        return {
            "success": False,
            "error": f"Не удалось загрузить альбом #{album_id}"
        }

    def _format_playlist(self, pl: Dict[str, Any]) -> Dict[str, Any]:
        """Normalizes Yandex Music playlist JSON into a clean schema."""
        title = pl.get("title") or "Плейлист Яндекс Музыки"
        owner_info = pl.get("owner", {})
        owner_name = owner_info.get("name") or owner_info.get("login") or "Пользователь"
        description = pl.get("description") or ""

        cover_uri = pl.get("cover", {}).get("uri") or pl.get("ogImage")
        cover_url = ""
        if cover_uri:
            cover_url = f"https://{cover_uri.replace('%%', '400x400')}"
            if not cover_url.startswith("http"):
                cover_url = f"https://avatars.yandex.net/{cover_uri.replace('%%', '400x400')}"

        raw_tracks = pl.get("tracks", [])
        formatted_tracks = []

        for idx, item in enumerate(raw_tracks):
            tr = item.get("track") if isinstance(item, dict) and "track" in item else item
            if not isinstance(tr, dict):
                continue

            tr_id = str(tr.get("id", f"track-{idx}"))
            tr_title = tr.get("title", "")
            if tr.get("version"):
                tr_title = f"{tr_title} ({tr.get('version')})"

            artists = ", ".join(a.get("name", "") for a in tr.get("artists", [])) if tr.get("artists") else "Неизвестный исполнитель"
            albums = [a.get("title", "") for a in tr.get("albums", [])] if tr.get("albums") else []
            album_title = albums[0] if albums else ""

            duration_ms = tr.get("durationMs", 0)
            tr_cover = tr.get("coverUri")
            tr_cover_url = f"https://{tr_cover.replace('%%', '200x200')}" if tr_cover else cover_url

            formatted_tracks.append({
                "id": tr_id,
                "artist": artists,
                "title": tr_title,
                "album": album_title,
                "duration_ms": duration_ms,
                "cover_url": tr_cover_url
            })

        return {
            "success": True,
            "title": title,
            "owner": owner_name,
            "description": description,
            "cover_url": cover_url,
            "track_count": len(formatted_tracks),
            "tracks": formatted_tracks
        }

    def _parse_text_tracklist(self, lines: List[str]) -> Dict[str, Any]:
        """Parses plain text lines 'Artist - Title'."""
        tracks = []
        for idx, line in enumerate(lines):
            # Double check that the line itself is not a URL
            if self.is_url(line):
                continue
            parts = line.split("-", 1)
            artist = parts[0].strip()
            title = parts[1].strip() if len(parts) > 1 else ""
            if artist and title:
                tracks.append({
                    "id": f"custom-{idx+1}",
                    "artist": artist,
                    "title": title,
                    "album": "",
                    "duration_ms": 0,
                    "cover_url": ""
                })

        return {
            "success": True,
            "title": "Импортированный список треков",
            "owner": "Текстовый импорт",
            "description": f"Список из {len(tracks)} треков",
            "cover_url": "",
            "track_count": len(tracks),
            "tracks": tracks
        }
