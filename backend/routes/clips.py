import asyncio
import json
import os
import shutil
import struct
import subprocess
import tempfile
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any, Dict, List

from database import get_db
from services.clip_service import (
    create_clip, delete_clip, get_clip,
    list_clips, update_name, update_status, update_subtitles,
)
from services.ffmpeg_service import extract_segment, extract_thumbnail, probe_streams

router = APIRouter()


class UpdateSubtitlesRequest(BaseModel):
    subtitles: List[Dict[str, Any]]


class RenameRequest(BaseModel):
    name: str


class StatusRequest(BaseModel):
    status: str


class ProbeLocalRequest(BaseModel):
    path: str


class BatchLocalClip(BaseModel):
    name: str = ""
    start: float
    end: float
    video_stream: int | None = None
    audio_stream: int | None = None


class BatchLocalRequest(BaseModel):
    path: str
    source_filename: str = ""
    clips: List[BatchLocalClip]


def _copy_upload(src, dst_path: str):
    with open(dst_path, 'wb') as dst:
        shutil.copyfileobj(src, dst)


@router.post("/batch")
async def create_batch(
    file: UploadFile = File(...),
    clips_json: str = Form(...),
    db: Session = Depends(get_db),
):
    clips_data = json.loads(clips_json)
    if not clips_data:
        raise HTTPException(400, "No clips provided")

    ext = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    source_filename = file.filename or "video"
    tmp_path = None
    extracted = []

    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        for c in clips_data:
            clip_id = str(uuid.uuid4())
            segment_path = f"segments/{clip_id}.mp4"
            thumb_path = f"thumbnails/{clip_id}.jpg"
            video_stream = c.get("video_stream")
            audio_stream = c.get("audio_stream")

            await asyncio.to_thread(
                extract_segment, tmp_path, float(c["start"]), float(c["end"]), segment_path,
                video_stream, audio_stream,
            )

            try:
                mid = (float(c["end"]) - float(c["start"])) / 2
                await asyncio.to_thread(extract_thumbnail, segment_path, thumb_path, mid)
            except Exception:
                thumb_path = None

            extracted.append({
                "clip_id": clip_id,
                "name": (c.get("name") or "").strip() or f"Clip {clip_id[:6]}",
                "start": float(c["start"]),
                "end": float(c["end"]),
                "segment_path": segment_path,
                "thumbnail_path": thumb_path,
            })

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return [
        create_clip(
            db, e["clip_id"], e["name"], source_filename,
            e["start"], e["end"], e["segment_path"], e["thumbnail_path"],
        )
        for e in extracted
    ]


@router.post("/probe-local")
async def probe_streams_local(req: ProbeLocalRequest):
    if not req.path.startswith("http") and not os.path.isfile(req.path):
        raise HTTPException(400, f"File not found: {req.path}")
    return await asyncio.to_thread(probe_streams, req.path)


@router.post("/batch-local")
async def create_batch_local(req: BatchLocalRequest, db: Session = Depends(get_db)):
    if not req.path.startswith("http") and not os.path.isfile(req.path):
        raise HTTPException(400, f"File not found: {req.path}")
    if not req.clips:
        raise HTTPException(400, "No clips provided")

    source_filename = req.source_filename or os.path.basename(req.path)
    extracted = []

    for c in req.clips:
        clip_id = str(uuid.uuid4())
        segment_path = f"segments/{clip_id}.mp4"
        thumb_path = f"thumbnails/{clip_id}.jpg"

        await asyncio.to_thread(
            extract_segment, req.path, c.start, c.end, segment_path,
            c.video_stream, c.audio_stream,
        )

        try:
            mid = (c.end - c.start) / 2
            await asyncio.to_thread(extract_thumbnail, segment_path, thumb_path, mid)
        except Exception:
            thumb_path = None

        extracted.append({
            "clip_id": clip_id,
            "name": c.name.strip() or f"Clip {clip_id[:6]}",
            "start": c.start,
            "end": c.end,
            "segment_path": segment_path,
            "thumbnail_path": thumb_path,
        })

    return [
        create_clip(
            db, e["clip_id"], e["name"], source_filename,
            e["start"], e["end"], e["segment_path"], e["thumbnail_path"],
            source_path=req.path,
        )
        for e in extracted
    ]


@router.get("/")
async def list_all(db: Session = Depends(get_db)):
    return list_clips(db)


@router.get("/{clip_id}")
async def get_one(clip_id: str, db: Session = Depends(get_db)):
    clip = get_clip(db, clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.put("/{clip_id}/subtitles")
async def set_subtitles(clip_id: str, req: UpdateSubtitlesRequest, db: Session = Depends(get_db)):
    clip = update_subtitles(db, clip_id, req.subtitles)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.put("/{clip_id}/name")
async def rename(clip_id: str, req: RenameRequest, db: Session = Depends(get_db)):
    clip = update_name(db, clip_id, req.name)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.put("/{clip_id}/status")
async def set_status(clip_id: str, req: StatusRequest, db: Session = Depends(get_db)):
    clip = update_status(db, clip_id, req.status)
    if not clip:
        raise HTTPException(404, "Clip not found or invalid status")
    return clip


@router.delete("/{clip_id}")
async def delete(clip_id: str, db: Session = Depends(get_db)):
    if not delete_clip(db, clip_id):
        raise HTTPException(404, "Clip not found")
    return {"ok": True}


@router.get("/{clip_id}/waveform")
async def get_waveform(clip_id: str, samples: int = 400):
    path = f"segments/{clip_id}.mp4"
    if not os.path.exists(path):
        raise HTTPException(404, "Segment not found")

    sr = 8000
    cmd = ["ffmpeg", "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "s16le", "pipe:1"]
    result = await asyncio.to_thread(subprocess.run, cmd, capture_output=True, timeout=30)
    data = result.stdout
    if not data or len(data) < 2:
        return {"samples": [], "duration": 0.0, "onsets": []}

    n = len(data) // 2
    raw = struct.unpack(f"{n}h", data)
    duration = n / sr

    chunk = max(1, n // samples)
    peaks = []
    for i in range(0, n - chunk + 1, chunk):
        seg = raw[i: i + chunk]
        peaks.append(round(max(abs(s) for s in seg) / 32768.0, 3))

    onsets = []
    threshold = 1800
    release = 600
    min_gap = int(0.15 * sr)
    win = int(0.005 * sr)
    in_sound = False
    last_idx = -min_gap
    hop = max(1, win)
    for i in range(0, n, hop):
        seg = raw[i: i + hop]
        amp = max(abs(s) for s in seg) if seg else 0
        if not in_sound and amp > threshold and (i - last_idx) > min_gap:
            onsets.append(round(i / sr, 3))
            last_idx = i
            in_sound = True
        elif in_sound and amp < release:
            in_sound = False

    return {"samples": peaks, "duration": round(duration, 3), "onsets": onsets, "sample_rate": sr}
