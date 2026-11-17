"""
FastAPI Application for Yandex Music -> SoundCloud Playlist Transfer.
High-Performance Version:
- Multi-worker concurrent search pool (12 workers)
- Smart underground fallback search
- Persistent HTTP connection pooling
- Smooth real-time SSE streaming
"""

import asyncio
import uuid
import json
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .utils import generate_search_queries
from .matcher import rank_and_select_best
from .soundcloud_client import SoundCloudClient
from .yandex_parser import YandexMusicParser

logger = logging.getLogger("app")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="YM to SoundCloud Transfer", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services
ym_parser = YandexMusicParser()
sc_client = SoundCloudClient()

# In-memory storage for transfer jobs
jobs: Dict[str, Dict[str, Any]] = {}
CACHE_FILE = Path(__file__).resolve().parent.parent / ".jobs_cache.json"

def save_cache():
    """Persists completed jobs to disk so they survive server restarts."""
    try:
        serializable = {}
        for jid, j in jobs.items():
            serializable[jid] = {
                "id": j.get("id"),
                "playlist_title": j.get("playlist_title"),
                "cover_url": j.get("cover_url"),
                "total_tracks": j.get("total_tracks"),
                "completed_tracks": j.get("completed_tracks"),
                "status": j.get("status"),
                "tracks": [t for t in j.get("tracks", []) if t is not None]
            }
        CACHE_FILE.write_text(json.dumps(serializable, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Cache save failed: {e}")

def load_cache():
    """Loads previously saved jobs from disk cache on startup."""
    global jobs
    if CACHE_FILE.exists():
        try:
            data = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            for jid, j in data.items():
                j["listeners"] = []
                jobs[jid] = j
            logger.info(f"Loaded {len(jobs)} jobs from disk cache.")
        except Exception as e:
            logger.warning(f"Cache load failed: {e}")

load_cache()

# Pydantic schemas
class ParseRequest(BaseModel):
    url: str

class StartTransferRequest(BaseModel):
    playlist_title: str
    cover_url: Optional[str] = ""
    tracks: List[Dict[str, Any]]

class SelectMatchRequest(BaseModel):
    job_id: str
    track_index: int
    candidate: Dict[str, Any]

class CreatePlaylistRequest(BaseModel):
    job_id: str
    oauth_token: str
    playlist_title: Optional[str] = None
    sharing: Optional[str] = "public"
    datadome_cookie: Optional[str] = None

class VerifyTokenRequest(BaseModel):
    oauth_token: str

@app.post("/api/parse")
async def parse_playlist(req: ParseRequest):
    """Parses a Yandex Music playlist by public link or demo keyword."""
    if not req.url:
        raise HTTPException(status_code=400, detail="Укажите ссылку на плейлист")
    result = await ym_parser.fetch_playlist(req.url)
    return result

@app.post("/api/verify-token")
async def verify_token(req: VerifyTokenRequest):
    """Verifies that the user's SoundCloud browser oauth_token is active."""
    if not req.oauth_token:
        raise HTTPException(status_code=400, detail="Токен пуст")
    res = await sc_client.verify_oauth_token(req.oauth_token)
    return res

async def run_search_worker(job_id: str):
    """
    High-Performance Multi-Worker Search Pool.
    Distributes playlist tracks across 10-12 concurrent workers using persistent connections.
    """
    job = jobs.get(job_id)
    if not job:
        return

    job["status"] = "running"
    tracks = job["raw_tracks"]
    total = len(tracks)

    queue = asyncio.Queue()
    for idx, tr in enumerate(tracks):
        await queue.put((idx, tr))

    # Pre-allocate array to preserve original track order
    job["tracks"] = [None] * total
    completed_lock = asyncio.Lock()

    async def worker():
        while True:
            try:
                idx, tr = queue.get_nowait()
            except asyncio.QueueEmpty:
                break

            artist = tr.get("artist", "")
            title = tr.get("title", "")
            duration_sec = tr.get("duration_ms", 0) // 1000

            queries = generate_search_queries(artist, title)
            candidates = await sc_client.search_smart_track(artist, title, queries)
            match_result = rank_and_select_best(artist, title, duration_sec, candidates)

            track_entry = {
                "index": idx,
                "ym_track": tr,
                "status": match_result["status"],
                "status_label": match_result["status_label"],
                "best_match": match_result["best_match"],
                "alternatives": match_result["alternatives"],
                "selected_match": match_result["best_match"]
            }

            async with completed_lock:
                job["tracks"][idx] = track_entry
                job["completed_tracks"] += 1
                comp = job["completed_tracks"]

            # Broadcast SSE event
            event_data = {
                "type": "track_completed",
                "job_id": job_id,
                "completed": comp,
                "total": total,
                "percent": int((comp / total) * 100),
                "track": track_entry
            }

            for q in list(job["listeners"]):
                await q.put(event_data)

            queue.task_done()

    # Determine worker count based on playlist size (up to 12 parallel workers)
    num_workers = min(12, max(4, total // 5))
    workers = [asyncio.create_task(worker()) for _ in range(num_workers)]
    await asyncio.gather(*workers)

    # Clean up array
    job["tracks"] = [t for t in job["tracks"] if t is not None]
    job["status"] = "done"
    save_cache()

    # Count final stats
    exact_count = sum(1 for t in job["tracks"] if t["status"] == "exact")
    fuzzy_count = sum(1 for t in job["tracks"] if t["status"] == "fuzzy")
    not_found_count = sum(1 for t in job["tracks"] if t["status"] == "not_found")

    final_event = {
        "type": "job_finished",
        "job_id": job_id,
        "completed": total,
        "total": total,
        "percent": 100,
        "stats": {
            "total": total,
            "exact": exact_count,
            "fuzzy": fuzzy_count,
            "not_found": not_found_count,
            "transferred": exact_count + fuzzy_count
        }
    }

    for queue_listener in list(job["listeners"]):
        await queue_listener.put(final_event)

@app.post("/api/start-transfer")
async def start_transfer(req: StartTransferRequest):
    """Initializes a new transfer job and launches the background search worker."""
    if not req.tracks:
        raise HTTPException(status_code=400, detail="Список треков пуст")

    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {
        "id": job_id,
        "playlist_title": req.playlist_title or "Плейлист из Яндекс Музыки",
        "cover_url": req.cover_url or "",
        "total_tracks": len(req.tracks),
        "completed_tracks": 0,
        "status": "pending",
        "raw_tracks": req.tracks,
        "tracks": [],
        "created_playlist": None,
        "listeners": []
    }

    asyncio.create_task(run_search_worker(job_id))
    return {"job_id": job_id, "total": len(req.tracks)}

@app.get("/api/transfer-stream/{job_id}")
async def transfer_stream(job_id: str, request: Request):
    """Server-Sent Events (SSE) endpoint for real-time live transfer updates."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача переноса не найдена")

    queue = asyncio.Queue()
    job["listeners"].append(queue)

    async def event_generator():
        try:
            # Stream incoming events
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("type") == "job_finished":
                        break
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            if queue in job["listeners"]:
                job["listeners"].remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.post("/api/select-match")
async def select_alternative_match(req: SelectMatchRequest):
    """Allows user to pick an alternative match from the top 3 candidates."""
    job = jobs.get(req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    idx = req.track_index
    if idx < 0 or idx >= len(job["tracks"]):
        raise HTTPException(status_code=400, detail="Неверный индекс трека")

    track_entry = job["tracks"][idx]
    track_entry["selected_match"] = req.candidate
    track_entry["status"] = "fuzzy"
    track_entry["status_label"] = "Выбран вручную"

    return {"success": True, "track": track_entry}

@app.post("/api/create-playlist")
async def create_soundcloud_playlist(req: CreatePlaylistRequest):
    """Zero-Password automatic playlist creation via browser session oauth_token."""
    job = jobs.get(req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    title = req.playlist_title or job.get("playlist_title", "Перенесенный плейлист")

    track_ids = []
    for t in job["tracks"]:
        if t is not None:
            match = t.get("selected_match")
            if match and match.get("id"):
                track_ids.append(match["id"])

    if not track_ids:
        raise HTTPException(status_code=400, detail="Нет найденных треков для добавления в плейлист")

    result = await sc_client.create_playlist(
        oauth_token=req.oauth_token,
        title=title,
        track_ids=track_ids,
        sharing=req.sharing or "public",
        datadome_cookie=req.datadome_cookie
    )

    if result.get("success"):
        job["created_playlist"] = result

    return result

@app.get("/api/export/{job_id}/links")
async def export_links(job_id: str):
    """Exports list of direct SoundCloud track links."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    lines = []
    for t in job["tracks"]:
        if t is None:
            continue
        match = t.get("selected_match")
        ym = t.get("ym_track", {})
        if match and match.get("permalink_url"):
            lines.append(f"{ym.get('artist')} - {ym.get('title')}: {match['permalink_url']}")
        else:
            lines.append(f"{ym.get('artist')} - {ym.get('title')}: [Не найден на SoundCloud]")

    content = "\n".join(lines)
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=soundcloud_playlist_{job_id}.txt"}
    )

@app.get("/api/export/{job_id}/m3u")
async def export_m3u(job_id: str):
    """Exports M3U playlist file."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    lines = ["#EXTM3U", f"#PLAYLIST:{job.get('playlist_title', 'SoundCloud Playlist')}"]
    for t in job["tracks"]:
        if t is None:
            continue
        match = t.get("selected_match")
        ym = t.get("ym_track", {})
        if match and match.get("permalink_url"):
            dur = match.get("duration_sec", 0)
            lines.append(f"#EXTINF:{dur},{ym.get('artist')} - {ym.get('title')}")
            lines.append(match["permalink_url"])

    content = "\n".join(lines)
    return Response(
        content=content,
        media_type="audio/x-mpegurl; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=playlist_{job_id}.m3u"}
    )

@app.get("/api/export/{job_id}/json")
async def export_json(job_id: str):
    """Exports complete structured JSON."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    data = {
        "playlist_title": job.get("playlist_title"),
        "total_tracks": job.get("total_tracks"),
        "created_playlist": job.get("created_playlist"),
        "tracks": [t for t in job.get("tracks", []) if t is not None]
    }
    return JSONResponse(data)

@app.options("/api/latest-export")
async def options_latest_export():
    res = Response()
    res.headers["Access-Control-Allow-Origin"] = "*"
    res.headers["Access-Control-Allow-Private-Network"] = "true"
    res.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    res.headers["Access-Control-Allow-Headers"] = "*"
    return res

@app.get("/api/latest-export")
async def get_latest_export():
    if not jobs:
        raise HTTPException(status_code=404, detail="Нет активных задач")
    
    # Find the latest job that actually has tracks
    target_job = None
    target_jid = None
    for jid in reversed(list(jobs.keys())):
        j = jobs[jid]
        if j.get("tracks") and len(j.get("tracks")) > 0:
            target_job = j
            target_jid = jid
            break
            
    if not target_job:
        target_jid = list(jobs.keys())[-1]
        target_job = jobs[target_jid]
    
    track_ids = []
    for t in target_job.get("tracks", []):
        if t and t.get("selected_match") and t["selected_match"].get("id"):
            track_ids.append(t["selected_match"]["id"])
            
    unique_ids = []
    seen = set()
    for tid in track_ids:
        if tid not in seen:
            seen.add(tid)
            unique_ids.append(tid)

    res = JSONResponse({
        "success": True,
        "job_id": target_jid,
        "playlist_title": target_job.get("playlist_title", "Мне нравится (YM)"),
        "total_tracks": len(unique_ids),
        "track_ids": unique_ids
    })
    res.headers["Access-Control-Allow-Origin"] = "*"
    res.headers["Access-Control-Allow-Private-Network"] = "true"
    return res

class SyncTracksPayload(BaseModel):
    job_id: Optional[str] = None
    playlist_title: str
    tracks: List[Dict[str, Any]]

@app.post("/api/sync-tracks")
async def sync_tracks_endpoint(payload: SyncTracksPayload):
    if not payload.tracks:
        return {"success": False, "error": "Empty tracks payload ignored"}

    jid = payload.job_id or str(uuid.uuid4())[:8]
    existing = jobs.get(jid, {})
    
    # Do not overwrite non-empty tracks with smaller or empty list
    if len(payload.tracks) >= len(existing.get("tracks", [])):
        jobs[jid] = {
            "id": jid,
            "playlist_title": payload.playlist_title,
            "total_tracks": len(payload.tracks),
            "completed_tracks": len(payload.tracks),
            "status": "done",
            "tracks": payload.tracks,
            "listeners": []
        }
        save_cache()
    return {"success": True, "job_id": jid, "count": len(jobs[jid].get("tracks", []))}

# Mount static directory
static_dir = Path(__file__).resolve().parent.parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = static_dir / "index.html"
    if index_file.exists():
        return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>YM to SoundCloud Transfer</h1><p>UI is compiling...</p>")
