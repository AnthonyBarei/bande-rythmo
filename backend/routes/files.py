import asyncio
import logging
import mimetypes
import os
import subprocess
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from services.clip_service import _redact_token
from services.ffmpeg_service import probe_streams
from services.jobs import create_job, get_job

log = logging.getLogger("br.files")

router = APIRouter()

# source entry: {"path": str (local path or HTTP URL for ffmpeg), "stream_url": str (browser URL), "filename": str}
_sources: dict[str, dict] = {}
_remux_cache: dict[tuple, str] = {}   # (source_id, v, a) → local path
_remux_status: dict[str, str] = {}    # "{source_id}_v{v}_a{a}" → "pending"|"ready"|"error"
_remux_jobs: dict[str, str] = {}      # status_key → job_id (for progress + cancel)

_PICK_SCRIPT = """
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = 'Sélectionner une vidéo'
$d.Filter = 'Vidéos (*.mp4;*.mkv;*.mov;*.avi;*.m4v;*.webm)|*.mp4;*.mkv;*.mov;*.avi;*.m4v;*.webm|Tous (*.*)|*.*'
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.FileName }
"""


def _open_dialog() -> str | None:
    result = subprocess.run(
        ["powershell", "-NoProfile", "-Command", _PICK_SCRIPT],
        capture_output=True, text=True,
    )
    path = result.stdout.strip()
    return path if path else None


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


async def _remux_task(job, path: str, remux_path: str, cache_key: tuple, status_key: str):
    try:
        a_idx = cache_key[2]
        job.update(stage="Extraction piste audio", pct=0.05)
        await asyncio.to_thread(_extract_audio, path, remux_path, a_idx, job)
        if job.cancelled:
            _remux_status[status_key] = "error"
            _discard_partial(remux_path)
            return
        _remux_cache[cache_key] = remux_path
        _remux_status[status_key] = "ready"
        job.done({"path": remux_path})
    except Exception as e:
        log.exception("remux failed for %s", status_key)
        _remux_status[status_key] = "error"
        _discard_partial(remux_path)
        job.fail(str(e))


@router.post("/pick")
async def pick_file():
    path = await asyncio.to_thread(_open_dialog)
    if not path:
        return {"cancelled": True}
    if not os.path.isfile(path):
        raise HTTPException(400, f"File not found: {path}")

    source_id = str(uuid.uuid4())
    _sources[source_id] = {
        "path": path,
        "stream_url": None,  # local → served via /stream endpoint
        "filename": os.path.basename(path),
    }

    streams = await asyncio.to_thread(probe_streams, path)
    return {
        "source_id": source_id,
        "filename": os.path.basename(path),
        "path": path,
        **streams,
    }


@router.post("/remux/{source_id}")
async def start_remux(
    source_id: str,
    audio: int = Query(0),
    video: int = Query(0),
):
    src = _sources.get(source_id)
    if not src:
        raise HTTPException(404, "Source not found")
    path = src["path"]
    if not path.startswith("http") and not os.path.isfile(path):
        raise HTTPException(404, "Source not found")

    cache_key = (source_id, video, audio)
    status_key = f"{source_id}_v{video}_a{audio}"

    if cache_key in _remux_cache:
        return {"status": "ready", "job_id": _remux_jobs.get(status_key)}
    if _remux_status.get(status_key) == "pending":
        return {"status": "pending", "job_id": _remux_jobs.get(status_key)}

    os.makedirs("sources", exist_ok=True)
    remux_path = f"sources/{source_id}_a{audio}.m4a"
    _remux_status[status_key] = "pending"
    job = create_job("plex-remux", title="Préparation audio")
    _remux_jobs[status_key] = job.id
    asyncio.create_task(_remux_task(job, path, remux_path, cache_key, status_key))
    return {"status": "pending", "job_id": job.id}


@router.get("/remux-status/{source_id}")
async def get_remux_status(
    source_id: str,
    audio: int = Query(0),
    video: int = Query(0),
):
    cache_key = (source_id, video, audio)
    status_key = f"{source_id}_v{video}_a{audio}"
    job_id = _remux_jobs.get(status_key)
    if cache_key in _remux_cache:
        return {"status": "ready", "job_id": job_id}
    # Source vanished (server restart) — stop polling
    if source_id not in _sources and _remux_status.get(status_key) not in ("pending", "ready", "error"):
        return {"status": "error", "reason": "source_lost"}
    return {"status": _remux_status.get(status_key, "unknown"), "job_id": job_id}


@router.post("/register")
async def register_url_source(source_id: str, stream_url: str, filename: str):
    """Register an external URL source (Plex, Jellyfin) without local file."""
    _sources[source_id] = {
        "path": stream_url,       # ffmpeg reads HTTP directly
        "stream_url": stream_url, # browser also uses directly
        "filename": filename,
    }
    return {"ok": True}


@router.get("/stream/{source_id}")
async def stream_file(
    source_id: str,
    audio: Optional[int] = Query(None),
    video: Optional[int] = Query(None),
):
    src = _sources.get(source_id)
    if not src:
        raise HTTPException(404, "Source not found")

    path = src["path"]
    is_url = path.startswith("http")

    if audio is None and video is None:
        if is_url:
            from fastapi.responses import RedirectResponse
            return RedirectResponse(path)
        if not os.path.isfile(path):
            raise HTTPException(404, "File not found")
        media_type = mimetypes.guess_type(path)[0] or "video/mp4"
        return FileResponse(path, media_type=media_type)

    v_idx = video if video is not None else 0
    a_idx = audio if audio is not None else 0
    cache_key = (source_id, v_idx, a_idx)

    if cache_key not in _remux_cache:
        raise HTTPException(425, "Remux not ready — start via POST /api/files/remux/{source_id}")

    audio_path = _remux_cache[cache_key]
    return FileResponse(audio_path, media_type="audio/mp4")
