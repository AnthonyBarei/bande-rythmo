from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.plex_service import (
    load_config, save_config, test_connection, probe_local,
    plex_get, stream_url, thumb_url,
)

router = APIRouter()


class ConnectRequest(BaseModel):
    url: str
    token: str


@router.get("/probe")
async def probe():
    url = await probe_local()
    return {"found": url is not None, "url": url}


@router.get("/status")
async def status():
    cfg = load_config()
    if not cfg["token"]:
        return {"connected": False, "url": cfg["url"]}
    try:
        name = await test_connection(cfg["url"], cfg["token"])
        return {"connected": True, "server": name, "url": cfg["url"]}
    except Exception:
        return {"connected": False, "url": cfg["url"]}


@router.post("/connect")
async def connect(req: ConnectRequest):
    url = req.url.strip()
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(400, "URL Plex invalide — http(s):// requis")
    try:
        name = await test_connection(url, req.token)
        save_config(url, req.token)
        return {"connected": True, "server": name}
    except Exception:
        raise HTTPException(400, "Connexion échouée — vérifiez l'URL et le token")


@router.get("/libraries")
async def libraries():
    try:
        data = await plex_get("/library/sections")
        sections = data.get("MediaContainer", {}).get("Directory", [])
        return [
            {"id": s["key"], "title": s["title"], "type": s["type"]}
            for s in sections
            if s.get("type") in ("movie", "show")
        ]
    except Exception as e:
        raise HTTPException(502, str(e))


@router.get("/library/{section_id}")
async def library_items(section_id: str, search: str = "", offset: int = 0, limit: int = 50):
    try:
        params: dict = {"X-Plex-Container-Start": offset, "X-Plex-Container-Size": limit}
        if search:
            params["title<"] = search  # partial match
        data = await plex_get(f"/library/sections/{section_id}/all", params)
        mc = data.get("MediaContainer", {})
        items = mc.get("Metadata", [])
        return {
            "total": mc.get("totalSize", len(items)),
            "items": [
                {
                    "rating_key": item["ratingKey"],
                    "title": item["title"],
                    "year": item.get("year"),
                    "type": item["type"],
                    "thumb": thumb_url(item.get("thumb", "")),
                    "duration": item.get("duration"),
                }
                for item in items
            ],
        }
    except Exception as e:
        raise HTTPException(502, str(e))


@router.get("/search")
async def search(q: str, section_id: str = ""):
    try:
        path = f"/library/sections/{section_id}/search" if section_id else "/library/search"
        data = await plex_get(path, {"query": q, "limit": 30})
        mc = data.get("MediaContainer", {})
        items = mc.get("Metadata", [])
        return [
            {
                "rating_key": item["ratingKey"],
                "title": item["title"],
                "year": item.get("year"),
                "type": item["type"],
                "thumb": thumb_url(item.get("thumb", "")),
            }
            for item in items
            if item.get("type") in ("movie", "episode")
        ]
    except Exception as e:
        raise HTTPException(502, str(e))


def _parse_plex_streams(plex_streams: list) -> dict:
    """Parse stream info from Plex API response — no ffprobe needed."""
    video_streams, audio_streams = [], []
    for s in plex_streams:
        stream_type = s.get("streamType")
        codec = (s.get("codec") or "unknown").upper()
        lang = s.get("languageCode") or s.get("language") or ""
        title = s.get("displayTitle") or s.get("title") or ""
        if stream_type == 1:  # video
            parts_label = [codec]
            if s.get("width"):
                parts_label.append(f"{s['width']}x{s.get('height', '?')}")
            if lang:
                parts_label.append(lang)
            video_streams.append({"relative_index": len(video_streams), "label": " · ".join(parts_label)})
        elif stream_type == 2:  # audio
            parts_label = [codec]
            if s.get("channels"):
                parts_label.append(f"{s['channels']}ch")
            if lang:
                parts_label.append(lang)
            if title and title not in parts_label:
                parts_label.append(title)
            audio_streams.append({"relative_index": len(audio_streams), "label": " · ".join(parts_label)})
    return {"video_streams": video_streams, "audio_streams": audio_streams}


@router.get("/item/{rating_key}")
async def item_detail(rating_key: str):
    try:
        data = await plex_get(f"/library/metadata/{rating_key}")
        metadata = data.get("MediaContainer", {}).get("Metadata", [{}])[0]
        parts = []
        for media in metadata.get("Media", []):
            for part in media.get("Part", []):
                part_id = part["id"]
                url = stream_url(part_id)
                filename = (part.get("file") or "").replace("\\", "/").split("/")[-1]
                # Parse streams from Plex metadata — no network ffprobe needed
                plex_streams = part.get("Stream", [])
                streams = _parse_plex_streams(plex_streams)
                parts.append({
                    "part_id": part_id,
                    "stream_url": url,
                    "filename": filename,
                    "size": part.get("size"),
                    "container": part.get("container"),
                    **streams,
                })
        return {
            "rating_key": rating_key,
            "title": metadata.get("title"),
            "year": metadata.get("year"),
            "thumb": thumb_url(metadata.get("thumb", "")),
            "duration": metadata.get("duration"),
            "parts": parts,
        }
    except Exception as e:
        raise HTTPException(502, str(e))
