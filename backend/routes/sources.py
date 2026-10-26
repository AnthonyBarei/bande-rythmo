"""A project's sources: tracks (probe, browser audio), import draft, relink, removal."""
import asyncio
import json
import logging
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Project, Source
from services import source_audio, source_service
from services.ffmpeg_service import probe_streams, run_ffmpeg_with_progress
from services.files_dialog import open_video_dialog
from services.jobs import create_job, get_job

log = logging.getLogger("br.sources")

router = APIRouter()

# source id → job preparing its audio tracks (one at a time per source).
_preparing: dict[str, str] = {}

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


def _resolve(src: Source) -> str:
    try:
        return source_service.resolve_path(src)
    except source_service.SourceOffline as e:
        raise HTTPException(409, f"Source hors ligne : {e}")


@router.post("/{source_id}/probe")
async def probe(source_id: str, db: Session = Depends(get_db)):
    """(Re)read the tracks — sources registered before P3 carry none."""
    src = _get(db, source_id)
    streams = await asyncio.to_thread(probe_streams, _resolve(src))
    return _dict(db, source_service.update(db, src, streams=json.dumps(streams),
                                           duration=streams.get("duration") or src.duration))


def _run_in_background(fn):
    asyncio.get_running_loop().run_in_executor(None, fn)


def _running_job(source_id: str):
    job = get_job(_preparing.get(source_id) or "")
    return job if job and job.status == "running" else None


@router.get("/{source_id}/audio")
async def audio_tracks(source_id: str, db: Session = Depends(get_db)):
    src = _get(db, source_id)
    job = _running_job(source_id)
    return {"tracks": source_audio.track_states(src), "job_id": job.id if job else None}


@router.post("/{source_id}/prepare-audio")
async def prepare_audio(source_id: str, db: Session = Depends(get_db)):
    """Extract every audio track the browser can't play as is, in one pass,
    so switching language afterwards is instant."""
    src = _get(db, source_id)
    job = _running_job(source_id)
    if job:
        return {"status": "pending", "job_id": job.id}
    missing = [t for t in source_audio.track_states(src) if not t["ready"]]
    if not missing:
        return {"status": "ready", "job_id": None}
    path = _resolve(src)
    sid = src.id   # the worker outlives this request's session
    os.makedirs("sources", exist_ok=True)
    cmd = source_audio.extract_command(path, sid, missing)
    parts = [source_audio.remux_path(sid, t["index"]) + ".part" for t in missing]
    duration = src.duration or 0.0
    label = f"{len(missing)} piste{'s' if len(missing) > 1 else ''} audio"
    job = create_job("audio-tracks", title=f"Préparation · {label}")
    _preparing[sid] = job.id

    def work():
        try:
            job.update(stage=f"Extraction · {label}", pct=0.01)
            code = run_ffmpeg_with_progress(
                cmd, duration,
                on_progress=lambda pct, eta: job.update(pct=pct, eta=eta),
                is_cancelled=lambda: job.cancelled,
                register_process=lambda p: setattr(job, "process", p),
            )
            if job.cancelled:
                return
            if code != 0:
                raise RuntimeError(f"ffmpeg a échoué (code {code})")
            for part in parts:
                os.replace(part, part[:-len(".part")])
            job.done({"tracks": [t["index"] for t in missing]})
        except Exception as e:
            log.exception("audio track extraction failed for %s", sid)
            job.fail(str(e))
        finally:
            for part in parts:
                if os.path.exists(part):
                    try:
                        os.remove(part)
                    except OSError:
                        log.warning("partial audio %s not removed", part, exc_info=True)

    _run_in_background(work)
    return {"status": "pending", "job_id": job.id}


@router.delete("/{source_id}")
async def delete_source(source_id: str, db: Session = Depends(get_db)):
    source_service.delete(db, _get(db, source_id))
    return {"ok": True}
