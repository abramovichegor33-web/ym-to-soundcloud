import asyncio
import httpx
import re
import json

async def test_soundcloud_client_id():
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
        print("[1] Fetching soundcloud.com...")
        r = await client.get("https://soundcloud.com")
        print(f"Status: {r.status_code}")
        # Find script tags: <script crossorigin src="https://a-v2.sndcdn.com/assets/...js"></script>
        script_urls = re.findall(r'<script\s+[^>]*src="([^"]+)"', r.text)
        print(f"Found {len(script_urls)} scripts")
        client_id = None
        for s_url in reversed(script_urls):
            if "sndcdn.com/assets" in s_url:
                res = await client.get(s_url)
                # Look for client_id:"..." or client_id=... or client_id:"[a-zA-Z0-9]{32}"
                m = re.search(r'client_id[:=]\s*["\']([a-zA-Z0-9]{32})["\']', res.text)
                if m:
                    client_id = m.group(1)
                    print(f"Found client_id in {s_url}: {client_id}")
                    break
        
        if not client_id:
            # Fallback regex search for any 32 char client_id pattern
            for s_url in reversed(script_urls):
                if "sndcdn.com/assets" in s_url:
                    res = await client.get(s_url)
                    m = re.search(r'["\']([a-zA-Z0-9]{32})["\']', res.text)
                    # Let's check with search API
        
        if client_id:
            print(f"[2] Testing SoundCloud Search API v2 with client_id={client_id}...")
            search_url = f"https://api-v2.soundcloud.com/search/tracks?q=Kino%20Gruppa%20krovi&client_id={client_id}&limit=3"
            s_res = await client.get(search_url)
            print(f"Search status: {s_res.status_code}")
            if s_res.status_code == 200:
                data = s_res.json()
                print(f"Found {len(data.get('collection', []))} tracks:")
                for tr in data.get('collection', []):
                    print(f" - {tr.get('title')} ({tr.get('duration') // 1000}s) -> {tr.get('permalink_url')}")

async def test_yandex_music():
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest"
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
        # Example public playlist: yamusic-top / 1000 (chart)
        url = "https://music.yandex.ru/handlers/playlist.jsx?owner=yamusic-top&kinds=1000&light=false&lang=ru"
        print(f"[3] Testing Yandex Music playlist handler: {url}")
        r = await client.get(url)
        print(f"YM status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            pl = data.get("playlist", {})
            print(f"Playlist Title: {pl.get('title')}, Total tracks: {pl.get('trackCount')}")
            tracks = pl.get("tracks", [])[:3]
            for t in tracks:
                artists = ", ".join(a.get("name", "") for a in t.get("artists", []))
                print(f" - {artists} - {t.get('title')} ({t.get('durationMs', 0)//1000}s)")

async def main():
    try:
        await test_yandex_music()
    except Exception as e:
        print(f"YM test error: {e}")
    try:
        await test_soundcloud_client_id()
    except Exception as e:
        print(f"SC test error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
