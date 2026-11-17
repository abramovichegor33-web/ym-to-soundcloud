"""
Fuzzy title matching and duration verification engine.
"""

from typing import Optional, Dict, Any, List
from rapidfuzz import fuzz
from .utils import transliterate, clean_title, normalize_artist, has_cyrillic, normalize_fancy_unicode

DURATION_TOLERANCE_EXACT = 8     # ±8s (accounts for producer tags, intro/outro pads)
DURATION_TOLERANCE_FUZZY = 18    # ±18s
MIN_DURATION_SECONDS = 30

def calculate_duration_score(target_sec: int, candidate_sec: int) -> float:
    if target_sec <= 0 or candidate_sec <= 0:
        return 0.7  # neutral if duration unknown

    # Snippet filter
    if target_sec >= 60 and candidate_sec <= 35:
        return 0.0

    # Long mix filter
    if target_sec < 400 and candidate_sec >= max(target_sec * 2.5, 600):
        return 0.0

    diff = abs(target_sec - candidate_sec)

    if diff <= 5:
        return 1.0
    elif diff <= DURATION_TOLERANCE_EXACT:
        return 0.95
    elif diff <= DURATION_TOLERANCE_FUZZY:
        return 0.80 - ((diff - DURATION_TOLERANCE_EXACT) / (DURATION_TOLERANCE_FUZZY - DURATION_TOLERANCE_EXACT)) * 0.30
    elif diff <= 30:
        return 0.40
    else:
        return 0.10

def calculate_text_score(ym_artist: str, ym_title: str, sc_title: str, sc_author: str) -> float:
    clean_t = normalize_fancy_unicode(clean_title(ym_title)).lower()
    clean_a = normalize_fancy_unicode(normalize_artist(ym_artist)).lower()
    sc_t = normalize_fancy_unicode(sc_title).lower()
    sc_auth = normalize_fancy_unicode(sc_author).lower() if sc_author else ""

    target_str = f"{clean_a} {clean_t}"
    cand_str = f"{sc_auth} {sc_t}"

    score1 = fuzz.token_set_ratio(target_str, cand_str)
    score2 = fuzz.token_sort_ratio(target_str, sc_t)
    # Check if title matches track title directly (when artist is user profile)
    score3 = fuzz.token_set_ratio(clean_t, sc_t)
    
    score_translit = 0.0
    if has_cyrillic(target_str):
        trans_target = transliterate(target_str).lower()
        trans_title = transliterate(clean_t).lower()
        score_translit = max(
            fuzz.token_set_ratio(trans_target, cand_str),
            fuzz.token_sort_ratio(trans_target, sc_t),
            fuzz.token_set_ratio(trans_title, sc_t)
        )

    base_text_score = max(score1, score2, score3, score_translit)

    # Word match bonus
    title_words = [w for w in clean_t.split() if len(w) > 2]
    if title_words and all(w in sc_t for w in title_words):
        base_text_score = min(100.0, base_text_score + 10.0)

    return base_text_score / 100.0

def evaluate_candidate(
    ym_artist: str,
    ym_title: str,
    ym_duration_sec: int,
    candidate: Dict[str, Any]
) -> Dict[str, Any]:
    cand_duration_sec = candidate.get("duration_sec") or (candidate.get("duration", 0) // 1000) or (candidate.get("duration_ms", 0) // 1000)
    sc_title = candidate.get("title", "")
    sc_author = candidate.get("artist") or candidate.get("author") or (candidate.get("user", {}).get("username", "") if isinstance(candidate.get("user"), dict) else "")
    artwork = candidate.get("cover_url") or candidate.get("artwork_url") or (candidate.get("user") or {}).get("avatar_url")

    text_score = calculate_text_score(ym_artist, ym_title, sc_title, sc_author)
    duration_score = calculate_duration_score(ym_duration_sec, cand_duration_sec)
    diff = abs(cand_duration_sec - ym_duration_sec) if ym_duration_sec > 0 else 0

    if duration_score <= 0.05:
        composite_score = text_score * 0.1
    else:
        composite_score = (text_score * 0.65) + (duration_score * 0.35)

    if text_score >= 0.70 and diff <= DURATION_TOLERANCE_EXACT:
        status = "exact"
        status_label = "Точное совпадение"
    elif text_score >= 0.52 and diff <= DURATION_TOLERANCE_FUZZY:
        status = "fuzzy"
        status_label = "Найден перезалив"
    elif text_score >= 0.45 and duration_score >= 0.75:
        status = "fuzzy"
        status_label = "Найден перезалив"
    else:
        status = "low_match"
        status_label = "Низкое совпадение"

    return {
        "id": candidate.get("id"),
        "album_id": candidate.get("album_id", ""),
        "title": sc_title,
        "author": sc_author,
        "artist": sc_author,
        "duration_sec": cand_duration_sec,
        "duration_diff": diff,
        "permalink_url": candidate.get("permalink_url", ""),
        "artwork_url": artwork,
        "cover_url": artwork,
        "stream_url": candidate.get("stream_url", ""),
        "text_score": round(text_score * 100, 1),
        "duration_score": round(duration_score * 100, 1),
        "composite_score": round(composite_score * 100, 1),
        "status": status,
        "status_label": status_label
    }

def rank_and_select_best(
    ym_artist: str,
    ym_title: str,
    ym_duration_sec: int,
    candidates: List[Dict[str, Any]]
) -> Dict[str, Any]:
    if not candidates:
        return {
            "status": "not_found",
            "status_label": "Не найден",
            "best_match": None,
            "alternatives": []
        }

    evaluated = [
        evaluate_candidate(ym_artist, ym_title, ym_duration_sec, cand)
        for cand in candidates
    ]

    evaluated.sort(key=lambda x: (x["composite_score"], -x["duration_diff"]), reverse=True)
    best = evaluated[0]

    if best["composite_score"] < 40.0 or best["status"] == "low_match":
        return {
            "status": "not_found",
            "status_label": "Не найден",
            "best_match": None,
            "alternatives": evaluated[:3]
        }

    return {
        "status": best["status"],
        "status_label": best["status_label"],
        "best_match": best,
        "alternatives": evaluated[1:4]
    }
