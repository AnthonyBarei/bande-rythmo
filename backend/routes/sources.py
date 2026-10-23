"""A project's sources: track choice, import draft, relink, removal."""
import asyncio
import json
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Project, Source
from services import source_service
from services.ffmpeg_service import probe_streams
from services.files_dialog import open_video_dialog

router = APIRouter()

# A relinked file must match the cached duration within this (seconds).
RELINK_TOLERANCE = 0.5


class SourcePatch(BaseModel):
    filename: Optional[str] = None
    video_stream: Optional[int] = None
    audio_stream: Optional[int] = None
    project_id: Optional[str] = None
    # Probe cache for library sources (Plex/Jellyfin describe their own tracks).
    streams: Optional[Dict[str, Any]] = None


class DraftIn(BaseModel):
    draft: Optional[Dict[str, Any]] = None


def _get(db: Session, source_id: str) -> Source:
    src = source_service.get(db, source_id)
    if not src:
        raise HTTPException(404, "Source not found")
    return src


def _dict(db: Session, src: Source) -> dict:
    return source_service.to_dict(src, source_service.clip_count(db, src.id))


@router.get("/{source_id}")
async def get_source(source_id: str, db: Session = Depends(get_db)):
    return _dict(db, _get(db, source_id))


@router.patch("/{source_id}")
async def patch_source(source_id: str, body: SourcePatch, db: Session = Depends(get_db)):
    src = _get(db, source_id)
    fields = body.model_dump(exclude_unset=True)
    if fields.get("project_id") and not db.get(Project, fields["project_id"]):
        raise HTTPException(404, "Project not found")
    if "streams" in fields:
        fields["streams"] = json.dumps(fields["streams"]) if fields["streams"] else None
    return _dict(db, source_service.update(db, src, **fields))


@router.put("/{source_id}/draft")
async def put_draft(source_id: str, body: DraftIn, db: Session = Depends(get_db)):
    src = _get(db, source_id)
    draft = json.dumps(body.draft) if body.draft else None
    return _dict(db, source_service.update(db, src, draft=draft))


@router.post("/{source_id}/relink")
async def relink(source_id: str, force: bool = False, path: Optional[str] = None,
                 db: Session = Depends(get_db)):
    """Point a local source at a moved file. Refused (409) when the duration
    differs from the cached one, unless force=true after the user confirmed —
    then `path` (from the 409) skips a second file dialog."""
    src = _get(db, source_id)
    if src.kind != "local":
        raise HTTPException(400, "Only local sources can be relinked")
    if path and not force:
        raise HTTPException(400, "path is only accepted with force=true")
    path = path or await asyncio.to_thread(open_video_dialog)
    if not path:
        return {"cancelled": True}
    if not os.path.isfile(path):
        raise HTTPException(400, f"File not found: {path}")
    streams = await asyncio.to_thread(probe_streams, path)
    duration = streams.get("duration")
    if (not force and src.duration and duration
            and abs(duration - src.duration) > RELINK_TOLERANCE):
        raise HTTPException(409, {
            "reason": "duration_mismatch", "path": path,
            "expected": src.duration, "found": duration,
        })
    src = source_service.update(db, src, path=path, filename=os.path.basename(path),
                                streams=json.dumps(streams), duration=duration or src.duration)
    source_service.remove_remuxes(src.id)
    return _dict(db, src)


@router.delete("/{source_id}")
async def delete_source(source_id: str, db: Session = Depends(get_db)):
    source_service.delete(db, _get(db, source_id))
    return {"ok": True}
