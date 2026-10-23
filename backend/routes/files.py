import asyncio
import logging
import mimetypes
import os
import re
import subprocess
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Project
from services import source_service
from services.clip_service import SAFE_ID_PATTERN, _redact_token
from services.ffmpeg_service import probe_streams
from services.files_dialog import open_video_dialog
from services.jobs import create_job

log = logging.getLogger("br.files")

router = APIRouter()

# Sources live in the `sources` table (survive a restart). Remuxed audio lives
# on disk at sources/{source_id}_a{n}.m4a — its presence means "ready".
_remux_status: dict[str, str] = {}    # "{source_id}_v{v}_a{a}" → "pending"|"ready"|"error"
_remux_jobs: dict[str, str] = {}      # status_key → job_id (for progress + cancel)


def _remux_path(source_id: str, audio: int) -> str:
    return f"sources/{source_id}_a{audio}.m4a"


def _source_path(db: Session, source_id: str) -> str:
    src = source_service.get(db, source_id)
    if not src:
        raise HTTPException(404, "Source not found")
    try:
        return source_service.resolve_path(src)
    except source_service.SourceOffline:
        raise HTTPException(404, "Source not found")


# Chrome/Edge decode these in an MP4 everywhere; AC3/EAC3/DTS/TrueHD play
# silent in Chrome, so anything else is transcoded to AAC.
_BROWSER_SAFE_AUDIO = {"aac", "mp3"}


def _audio_codec(src: str, audio_idx: int, probe_flags: list[str]) -> str | None:
    result = subprocess.run(
        ["ffprobe", "-v", "error", *probe_flags, "-select_streams", f"a:{audio_idx}",
         "-show_entries", "stream=codec_name", "-of", "csv=p=0", src],
        capture_output=True, text=True, timeout=60,
    )
    if result.returncode != 0:
        log.warning("ffprobe audio codec failed for a:%d: %s", audio_idx, _redact_token(result.stderr.strip()[:200]))
        return None
    return result.stdout.strip().lower() or None


def _extract_audio(src: str, dst: str, audio_idx: int, job=None):
    """Extract single audio track as browser-playable MP4 audio (copy when AAC/MP3,
    else AAC transcode). For HTTP sources limits probing to avoid downloading the
    whole file. If job given, attaches the Popen for cancel, and polls cancel between commands."""
    is_http = src.startswith("http")
    probe_flags = ["-probesize", "5M", "-analyzeduration", "5M"] if is_http else []
    if _audio_codec(src, audio_idx, probe_flags) in _BROWSER_SAFE_AUDIO:
        cmd = [
            "ffmpeg", "-y",
            *probe_flags,
            "-i", src,
            "-map", f"0:a:{audio_idx}",
            "-vn",
            "-c:a", "copy",
            "-f", "mp4",
            dst,
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if job is not None:
            job.process = proc
        proc.communicate()
        if job is not None and job.cancelled:
            return
        if proc.returncode == 0:
            return
    cmd_transcode = [
        "ffmpeg", "-y",
        *probe_flags,
        "-i", src,
        "-map", f"0:a:{audio_idx}",
        "-vn",
        "-c:a", "aac", "-b:a", "192k",
        "-f", "mp4",
        dst,
    ]
    proc2 = subprocess.Popen(cmd_transcode, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if job is not None:
        job.process = proc2
    proc2.communicate()
    if job is not None and job.cancelled:
        return
    if proc2.returncode != 0:
        raise RuntimeError("ffmpeg audio extraction failed (copy + AAC transcode)")


def _discard_partial(path: str):
    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            log.warning("could not remove partial remux %s", path, exc_info=True)


async def _remux_task(job, path: str, remux_path: str, audio: int, status_key: str):
    # Written aside then renamed: a file at remux_path is always complete.
    partial = remux_path + ".part"
    try:
        job.update(stage="Extraction piste audio", pct=0.05)
        await asyncio.to_thread(_extract_audio, path, partial, audio, job)
        if job.cancelled:
            _remux_status[status_key] = "error"
            _discard_partial(partial)
            return
        os.replace(partial, remux_path)
        _remux_status[status_key] = "ready"
        job.done({"path": remux_path})
    except Exception as e:
        log.exception("remux failed for %s", status_key)
        _remux_status[status_key] = "error"
        _discard_partial(partial)
        job.fail(str(e))


@router.post("/pick")
async def pick_file(project_id: Optional[str] = None, db: Session = Depends(get_db)):
    if project_id and not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    path = await asyncio.to_thread(open_video_dialog)
    if not path:
        return {"cancelled": True}
    if not os.path.isfile(path):
        raise HTTPException(400, f"File not found: {path}")

    streams = await asyncio.to_thread(probe_streams, path)
    src = source_service.create(db, path, os.path.basename(path), project_id=project_id, streams=streams)
    return {
        "source_id": src.id,
        "filename": src.filename,
        "path": path,
        **streams,
    }


@router.post("/remux/{source_id}")
async def start_remux(
    source_id: str,
    audio: int = Query(0),
    video: int = Query(0),
    db: Session = Depends(get_db),
):
    path = _source_path(db, source_id)
    status_key = f"{source_id}_v{video}_a{audio}"
    remux_path = _remux_path(source_id, audio)

    if _remux_status.get(status_key) == "pending":
        return {"status": "pending", "job_id": _remux_jobs.get(status_key)}
    if os.path.isfile(remux_path):
        return {"status": "ready", "job_id": _remux_jobs.get(status_key)}

    os.makedirs("sources", exist_ok=True)
    _remux_status[status_key] = "pending"
    job = create_job("plex-remux", title="Préparation audio")
    _remux_jobs[status_key] = job.id
    asyncio.create_task(_remux_task(job, path, remux_path, audio, status_key))
    return {"status": "pending", "job_id": job.id}


@router.get("/remux-status/{source_id}")
async def get_remux_status(
    source_id: str,
    audio: int = Query(0),
    video: int = Query(0),
    db: Session = Depends(get_db),
):
    status_key = f"{source_id}_v{video}_a{audio}"
    job_id = _remux_jobs.get(status_key)
    status = _remux_status.get(status_key)
    if status != "pending" and os.path.isfile(_remux_path(source_id, audio)):
        return {"status": "ready", "job_id": job_id}
    if source_service.get(db, source_id) is None:
        return {"status": "error", "reason": "source_lost"}
    return {"status": status or "unknown", "job_id": job_id}


@router.post("/register")
async def register_url_source(source_id: str, stream_url: str, filename: str,
                              project_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Register an external URL source (Plex, Jellyfin) without local file.
    Library URLs are stored as a provider reference — the token stays in the config."""
    # The id becomes a file name (sources/{id}_a{n}.m4a).
    if not re.fullmatch(SAFE_ID_PATTERN, source_id):
        raise HTTPException(400, "Invalid source_id")
    if project_id and not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    source_service.create(db, stream_url, filename, project_id=project_id, source_id=source_id)
    return {"ok": True}


@router.get("/stream/{source_id}")
async def stream_file(
    source_id: str,
    audio: Optional[int] = Query(None),
    video: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    if audio is None and video is None:
        path = _source_path(db, source_id)
        if path.startswith("http"):
            return RedirectResponse(path)
        media_type = mimetypes.guess_type(path)[0] or "video/mp4"
        return FileResponse(path, media_type=media_type)

    if source_service.get(db, source_id) is None:
        raise HTTPException(404, "Source not found")
    remux_path = _remux_path(source_id, audio if audio is not None else 0)
    if not os.path.isfile(remux_path):
        raise HTTPException(425, "Remux not ready — start via POST /api/files/remux/{source_id}")
    return FileResponse(remux_path, media_type="audio/mp4")
