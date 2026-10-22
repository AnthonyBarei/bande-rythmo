from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel

from services.ffmpeg_service import _rate
from services.jellyfin_service import (
    load_config, save_config, test_connection, probe_local,
    jellyfin_get, stream_url, thumb_url,
)

# Same response shapes as routes/plex.py — the frontend LibraryBrowser is
# provider-agnostic (items keyed by `rating_key`, parts with stream info).
# Show libraries browse as folders: series → seasons → episodes (/children).

router = APIRouter()

JellyfinId = Annotated[str, Path(pattern=r"^[A-Za-z0-9-]{1,64}$")]

_TYPE = {"Movie": "movie", "Episode": "episode", "Series": "show", "Season": "season"}
_ITEM_FIELDS = "ProductionYear,RunTimeTicks,ImageTags,SeriesPrimaryImageTag"


class ConnectRequest(BaseModel):
    url: str
    token: str


def _duration_ms(item: dict) -> int | None:
    ticks = item.get("RunTimeTicks")
    return ticks // 10_000 if ticks else None


def _title(item: dict, in_season: bool = False) -> str:
    """Episodes: `Series · S01E02 · Name` in search results, `E02 · Name` inside their season."""
    if item.get("Type") != "Episode":
        return item.get("Name") or ""
    season, episode = item.get("ParentIndexNumber"), item.get("IndexNumber")
    if in_season:
        return " · ".join(p for p in (f"E{episode:02d}" if episode is not None else "", item.get("Name")) if p)
    code = f"S{season:02d}E{episode:02d}" if season is not None and episode is not None else ""
    return " · ".join(p for p in (item.get("SeriesName"), code, item.get("Name")) if p)


def _card(item: dict, in_season: bool = False) -> dict:
    return {
        "rating_key": item["Id"],
        "title": _title(item, in_season),
        "year": item.get("ProductionYear"),
        "type": _TYPE.get(item.get("Type"), item.get("Type")),
        "thumb": thumb_url(item),
        # A series' RunTimeTicks is one episode's — meaningless on a folder.
        "duration": None if item.get("Type") in ("Series", "Season") else _duration_ms(item),
    }


@router.get("/probe")
async def probe():
    url = await probe_local()
    return {"found": url is not None, "url": url}


@router.get("/status")
async def status():
    cfg = load_config()
    if not cfg["token"]:
        return {"connected": False, "configured": False, "url": cfg["url"]}
    try:
        name = await test_connection(cfg["url"], cfg["token"])
        return {"connected": True, "configured": True, "server": name, "url": cfg["url"]}
    except Exception:
        return {"connected": False, "configured": True, "url": cfg["url"]}


@router.post("/connect")
async def connect(req: ConnectRequest):
    url = req.url.strip()
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(400, "URL Jellyfin invalide — http(s):// requis")
    try:
        name = await test_connection(url, req.token)
        save_config(url, req.token)
        return {"connected": True, "server": name}
    except Exception:
        raise HTTPException(400, "Connexion échouée — vérifiez l'URL et la clé API")


@router.get("/libraries")
async def libraries():
    try:
        data = await jellyfin_get("/Library/MediaFolders")
        return [
            {"id": f["Id"], "title": f["Name"], "type": "movie" if f.get("CollectionType") == "movies" else "show"}
            for f in data.get("Items", [])
            if f.get("CollectionType") in ("movies", "tvshows")
        ]
    except Exception as e:
        raise HTTPException(502, str(e))


@router.get("/library/{section_id}")
async def library_items(section_id: JellyfinId, search: str = "", offset: int = 0, limit: int = 50):
    try:
        params: dict = {
            "ParentId": section_id,
            "Recursive": "true",
            # Shows list as series folders; a search also reaches episodes directly.
            "IncludeItemTypes": "Movie,Series,Episode" if search else "Movie,Series",
            "SortBy": "SortName",
            "SortOrder": "Ascending",
            "StartIndex": offset,
            "Limit": limit,
            "Fields": _ITEM_FIELDS,
            "EnableTotalRecordCount": "true",
        }
        if search:
            params["SearchTerm"] = search
        data = await jellyfin_get("/Items", params)
        items = data.get("Items", [])
        return {
            "total": data.get("TotalRecordCount", len(items)),
            "items": [_card(item) for item in items],
        }
    except Exception as e:
        raise HTTPException(502, str(e))


@router.get("/children/{item_id}")
async def children(item_id: JellyfinId):
    """Seasons of a series, or episodes of a season (Specials last).

    /Shows endpoints, not ParentId: without season folders on disk, episodes'
    parent is the series folder and a season has no direct children."""
    try:
        found = (await jellyfin_get("/Items", {"Ids": item_id})).get("Items", [])
        if not found:
            raise HTTPException(404, "Élément introuvable")
        item = found[0]
        params = {"IsMissing": "false", "Fields": _ITEM_FIELDS}
        if item.get("Type") == "Series":
            data = await jellyfin_get(f"/Shows/{item_id}/Seasons", params)
        elif item.get("Type") == "Season" and item.get("SeriesId"):
            data = await jellyfin_get(f"/Shows/{quote(item['SeriesId'])}/Episodes", {**params, "seasonId": item_id})
        else:
            return {"items": []}
        items = sorted(data.get("Items", []), key=lambda i: i.get("Type") == "Season" and i.get("IndexNumber") == 0)
        return {"items": [_card(i, in_season=True) for i in items]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, str(e))


def _parse_jellyfin_streams(media_streams: list) -> dict:
    """Stream info from Jellyfin's MediaStreams — no network ffprobe needed."""
    video_streams, audio_streams = [], []
    for s in sorted(media_streams, key=lambda s: s.get("Index", 0)):
        if s.get("IsExternal"):
            continue  # sidecar files are not inside the stream ffmpeg reads
        codec = (s.get("Codec") or "unknown").upper()
        lang = s.get("Language") or ""
        title = s.get("Title") or ""
        if s.get("Type") == "Video":
            parts_label = [codec]
            if s.get("Width"):
                parts_label.append(f"{s['Width']}x{s.get('Height', '?')}")
            if lang:
                parts_label.append(lang)
            fps = s.get("RealFrameRate") or s.get("AverageFrameRate")
            video_streams.append({"relative_index": len(video_streams), "label": " · ".join(parts_label), "fps": _rate(fps)})
        elif s.get("Type") == "Audio":
            parts_label = [codec]
            if s.get("Channels"):
                parts_label.append(f"{s['Channels']}ch")
            if lang:
                parts_label.append(lang)
            if title and title not in parts_label:
                parts_label.append(title)
            audio_streams.append({"relative_index": len(audio_streams), "label": " · ".join(parts_label), "codec": codec, "channels": s.get("Channels"), "sample_rate": s.get("SampleRate"), "language": lang or None})
    return {"video_streams": video_streams, "audio_streams": audio_streams}


@router.get("/item/{item_id}")
async def item_detail(item_id: JellyfinId):
    try:
        data = await jellyfin_get("/Items", {"Ids": item_id, "Fields": f"MediaSources,{_ITEM_FIELDS}"})
        items = data.get("Items", [])
        if not items:
            raise HTTPException(404, "Élément introuvable")
        item = items[0]
        parts = []
        for source in item.get("MediaSources", []):
            filename = (source.get("Path") or "").replace("\\", "/").split("/")[-1]
            parts.append({
                "part_id": source["Id"],
                "stream_url": stream_url(item["Id"], source["Id"]),
                "filename": filename,
                "size": source.get("Size"),
                "container": source.get("Container"),
                **_parse_jellyfin_streams(source.get("MediaStreams", [])),
            })
        return {
            "rating_key": item["Id"],
            "title": _title(item),
            "year": item.get("ProductionYear"),
            "thumb": thumb_url(item),
            "duration": _duration_ms(item),
            "parts": parts,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, str(e))
