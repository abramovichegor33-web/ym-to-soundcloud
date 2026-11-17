import asyncio
import httpx
from backend.app import app, jobs

async def test_api():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test index page
        res = await client.get("/")
        print("GET / status:", res.status_code)
        assert res.status_code == 200
        assert "YM to SoundCloud" in res.text

        # 2. Test parse demo playlist
        parse_res = await client.post("/api/parse", json={"url": "demo-rock"})
        print("POST /api/parse status:", parse_res.status_code)
        assert parse_res.status_code == 200
        data = parse_res.json()
        print("Parsed playlist:", data.get("title"), "with", len(data.get("tracks", [])), "tracks")
        assert len(data.get("tracks", [])) > 0

        # 3. Test start transfer with 2 demo tracks
        tracks = data["tracks"][:2]
        start_res = await client.post("/api/start-transfer", json={
            "playlist_title": data["title"],
            "cover_url": data["cover_url"],
            "tracks": tracks
        })
        assert start_res.status_code == 200
        job_info = start_res.json()
        job_id = job_info["job_id"]
        print("Transfer job created with id:", job_id)

        # 4. Wait until background worker finishes
        print("Waiting for background search worker to finish...")
        for _ in range(25):
            await asyncio.sleep(1.0)
            if jobs.get(job_id, {}).get("status") == "done":
                break

        # 5. Test export endpoints
        links_res = await client.get(f"/api/export/{job_id}/links")
        print("GET /api/export links status:", links_res.status_code)
        print("--- Exported Links ---")
        print(links_res.text.strip())
        print("----------------------")

        json_res = await client.get(f"/api/export/{job_id}/json")
        json_data = json_res.json()
        print(f"Total matched tracks: {len(json_data.get('tracks', []))}")
        for t in json_data.get("tracks", []):
            ym = t.get("ym_track", {})
            match = t.get("selected_match")
            print(f"[{t.get('status_label')}] {ym.get('artist')} - {ym.get('title')}")
            if match:
                print(f"   -> SC: {match.get('title')} ({match.get('duration_sec')}s, diff ±{match.get('duration_diff')}s)")
                print(f"   -> Link: {match.get('permalink_url')}")

    print("\nALL BACKEND API TESTS COMPLETED PERFECTLY!")

if __name__ == "__main__":
    asyncio.run(test_api())
