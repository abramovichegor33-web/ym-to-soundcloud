import re
import urllib.parse
import json

def parse_ym_url(url: str):
    """
    Extracts owner and kind from various Yandex Music playlist URLs.
    Examples:
      https://music.yandex.ru/users/yamusic-top/playlists/1000
      https://music.yandex.ru/playlists/1000
      https://music.yandex.com/users/alex/playlists/5
    """
    url = url.strip()
    # Match /users/{owner}/playlists/{kind}
    match = re.search(r'users/([^/]+)/playlists/(\d+)', url)
    if match:
        return match.group(1), match.group(2)
    
    # Match /playlists/{kind}
    match = re.search(r'playlists/(\d+)', url)
    if match:
        return "yamusic-top", match.group(1) # default or editorial
    
    return None, None

print("URL parser test:")
print(parse_ym_url("https://music.yandex.ru/users/music-blog/playlists/2192"))
print(parse_ym_url("https://music.yandex.ru/users/yamusic-top/playlists/1000"))
