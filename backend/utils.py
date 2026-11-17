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

def clean_sc_artist(artist: str) -> str:
    """Strips channel suffixes, subscriber counters and repost marks from SoundCloud usernames."""
    a = re.sub(r'\|\|.*$', '', artist)
    a = re.sub(r'\b\d{2,}\s*(?:k|kilo|subs|followers|records|music)?\b', '', a, flags=re.IGNORECASE)
    a = re.sub(r'[\(\[\{][^\)\]\}]*[\)\]\}]', '', a)
    a = re.sub(r'[\s_\.\-]+', ' ', a).strip()
    return a or artist.strip()

def clean_sc_title(title: str) -> tuple[str, list[str]]:
    """
    Cleans underground SoundCloud title:
    Strips producer tags '(p ...)', '[prod. ...]', hashtags '#onetake', asterisks '*freestyle*'.
    Extracts potential artist names from parentheses, brackets or 'ft. / +' credits.
    """
    extra_artists = []
    
    # 1. Extract potential artist from bracket at end: 'Respectful freestyle (xaviersobased)'
    m = re.search(r'[\(\[]([a-zA-Z0-9_\s]{3,25})[\)\]]\s*$', title)
    work_title = title
    if m:
        cand = m.group(1).strip()
        if not re.search(r'\b(prod|remix|edit|slowed|reverb|sped|bass|ft|feat|audio|video|official|snippet|leak|freestyle)\b', cand, flags=re.IGNORECASE):
            extra_artists.append(cand)
            work_title = re.sub(r'[\(\[]' + re.escape(cand) + r'[\)\]]', '', work_title).strip()

    # 2. Extract features: ft. x, feat x, + x, with x
    feats = re.findall(r'(?:ft\.?|feat\.?|\+|\bx\b|with)\s+([a-zA-Z0-9а-яА-ЯёЁ_\s]{2,25})', work_title, flags=re.IGNORECASE)
    for f in feats:
        f_clean = f.strip().split('(')[0].split('[')[0].strip()
        if f_clean and len(f_clean) > 2:
            extra_artists.append(f_clean)

    cleaned = work_title
    # Producer credits: (p toonskhool), [prod. by ...]
    cleaned = re.sub(r'[\(\[\{]\s*(?:p\.?|prod\.?|produced by)[^\)\]\}]*[\)\]\}]', '', cleaned, flags=re.IGNORECASE)
    # Tags & asterisks: *basedfreestyle*, #onetake
    cleaned = re.sub(r'\*[^\*]+\*', '', cleaned)
    cleaned = re.sub(r'#[a-zA-Z0-9_]+', '', cleaned)
    # Common audio markers
    cleaned = re.sub(r'[\(\[\{]\s*(?:slowed|reverb|sped up|nightcore|bass boosted|remix|edit|leak|unreleased|snippet|official)[^\)\]\}]*[\)\]\}]', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'[\(\[\{]\s*(?:ft\.?|feat\.?)[^\)\]\}]*[\)\]\}]', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b(?:ft\.?|feat\.?)\s+[^\-\(\[\,\+]+', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\+\s*[a-zA-Z0-9а-яА-ЯёЁ_]+', '', cleaned)
    cleaned = re.sub(r'["\'`«»„“~^><|/]', '', cleaned)
    cleaned = re.sub(r'[\s\-–—]+', ' ', cleaned).strip()
    return cleaned, extra_artists

def decode_leetspeak(text: str) -> str:
    """Decodes stylized leetspeak e.g. Chr0M3 Wh1t3 T33 -> Chrome White Tee."""
    subs = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t"}
    return "".join(subs.get(ch, ch) for ch in text)

def generate_sc_to_ym_queries(artist: str, title: str) -> list[str]:
    """Generates a high-precision multi-level search cascade for Yandex Music."""
    c_artist = clean_sc_artist(artist)
    c_title, extra_artists = clean_sc_title(title)
    queries = []

    # Format 'Artist - Title' inside SoundCloud title
    if ' - ' in title or ' – ' in title or ' — ' in title:
        parts = re.split(r'\s*[\-–—]\s*', title, maxsplit=1)
        if len(parts) == 2:
            p_art = clean_sc_artist(parts[0])
            p_tit, _ = clean_sc_title(parts[1])
            if p_art and p_tit:
                queries.append(f"{p_art} {p_tit}")
                queries.append(p_tit)

    # 1. Clean Artist + Clean Title
    if c_artist and c_title:
        queries.append(f"{c_artist} {c_title}")

    # 2. Extra extracted artists (e.g. xaviersobased or ft. artist)
    for ea in extra_artists:
        if c_title:
            queries.append(f"{ea} {c_title}")
            if c_artist:
                queries.append(f"{c_artist} {ea} {c_title}")

    # 3. Clean Title alone (handles repost / collective accounts)
    if c_title:
        queries.append(c_title)

    # 4. Leetspeak decode (e.g. hi-c Chrome White Tee)
    leet = decode_leetspeak(c_title)
    if leet.lower() != c_title.lower():
        if c_artist:
            queries.append(f"{c_artist} {leet}")
        queries.append(leet)

    # 5. Raw artist + raw title fallback
    queries.append(f"{artist} {title}")

    # Deduplicate preserving order
    seen = set()
    result = []
    for q in queries:
        k = " ".join(q.split()).lower()
        if k and k not in seen:
            seen.add(k)
            result.append(" ".join(q.split()))
    return result
