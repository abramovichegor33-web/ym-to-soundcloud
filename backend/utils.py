"""
Text cleaning, transliteration and unicode normalization utilities.
"""

import re
import unicodedata

CYRILLIC_TO_LATIN = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
}

def normalize_fancy_unicode(text: str) -> str:
    """Normalizes stylized aesthetic fonts (e.g. ðįj harz -> dij harz)."""
    # Replace common stylized chars
    custom_map = {'ð': 'd', 'į': 'i', 'ø': 'o', 'þ': 'th', 'æ': 'ae', 'œ': 'oe'}
    t = text
    for k, v in custom_map.items():
        t = t.replace(k, v).replace(k.upper(), v.upper())
    norm = unicodedata.normalize('NFKD', t)
    return norm

def has_cyrillic(text: str) -> bool:
    """Checks if a string contains any Cyrillic characters."""
    return bool(re.search(r'[\u0400-\u04FF]', text))

def transliterate(text: str) -> str:
    """Transliterates Cyrillic text to Latin."""
    result = []
    for char in text:
        result.append(CYRILLIC_TO_LATIN.get(char, char))
    return "".join(result)

def clean_title(title: str) -> str:
    """Cleans track title from metadata tags while preserving core title."""
    cleaned = title

    # Remove brackets with feat/ft/prod
    cleaned = re.sub(r'[\(\[\{]\s*(?:feat\.?|ft\.?|with|prod\.?|produced by)[^\)\]\}]*[\)\]\}]', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b(?:feat\.?|ft\.?)\s+[^\-\(\[\,]+', '', cleaned, flags=re.IGNORECASE)
    
    # Remove explicit, remastered, video indicators
    cleaned = re.sub(r'[\(\[\{]\s*explicit\s*[\)\]\}]', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\bexplicit\b', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'[\(\[\{][^\)\]\}]*remaster(?:ed)?(?:\s*\d{4})?[^\)\]\}]*[\)\]\}]', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b\d{4}\s+remaster(?:ed)?\b', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'[\(\[\{]\s*(?:official\s+)?(?:audio|video|music\s+video|lyric\s+video|visualizer|clip)\s*[\)\]\}]', '', cleaned, flags=re.IGNORECASE)

    # Normalize quotes and extra spaces
    cleaned = re.sub(r'["\'`«»„“]', '', cleaned)
    cleaned = re.sub(r'[\s\-–—]+', ' ', cleaned).strip()

    return cleaned or title.strip()

def normalize_artist(artist: str) -> str:
    """Cleans artist name, stripping secondary features."""
    cleaned = re.sub(r'[\(\[\{]\s*(?:feat\.?|ft\.?|with)[^\)\]\}]*[\)\]\}]', '', artist, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b(?:feat\.?|ft\.?)\s+.*', '', cleaned, flags=re.IGNORECASE)
    return cleaned.strip() or artist.strip()

def generate_search_queries(artist: str, title: str) -> list[str]:
    """Generates priority search queries for SoundCloud."""
    norm_artist = normalize_artist(artist)
    c_title = clean_title(title)
    
    queries = []
    
    # Query 1: Artist + Title
    q_orig = f"{norm_artist} {c_title}".strip()
    queries.append(q_orig)

    # Query 2: Transliterated if Cyrillic exists
    if has_cyrillic(norm_artist) or has_cyrillic(c_title):
        t_artist = transliterate(norm_artist)
        t_title = transliterate(c_title)
        q_translit = f"{t_artist} {t_title}".strip()
        if q_translit.lower() != q_orig.lower():
            queries.append(q_translit)

    # Query 3: Title only (Crucial for underground SoundCloud where artist is user profile)
    if c_title and c_title.lower() != q_orig.lower():
        queries.append(c_title)

    # Deduplicate
    seen = set()
    deduped = []
    for q in queries:
        k = q.lower()
        if k not in seen:
            seen.add(k)
            deduped.append(q)

    return deduped
