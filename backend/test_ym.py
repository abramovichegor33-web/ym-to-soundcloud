import asyncio
import httpx
import traceback

async def check():
    url = "https://music.yandex.ru/handlers/playlist.jsx?owner=yamusic-top&kinds=1000&light=false&lang=ru"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://music.yandex.ru/"
    }
    try:
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
            r = await client.get(url)
            print("Status:", r.status_code)
            print("Content sample:", r.text[:200])
    except Exception as e:
        print("Exception:", repr(e))
        traceback.print_exc()

asyncio.run(check())
