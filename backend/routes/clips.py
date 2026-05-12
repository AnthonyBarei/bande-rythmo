from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from services.ffmpeg_service import extract_segment, extract_thumbnail
from services.clip_service import (
    create_clip, list_clips, get_clip,
    update_subtitles, update_name, delete_clip,
)
import asyncio
import uuid
import os
import subprocess
import struct

router = APIRouter()


class CreateClipRequest(BaseModel):
    video_id: str
    start: float
    end: float
    name: str = ""


class SubtitleItem(BaseModel):
    start: float
    end: float
    character: str = ""
    text: str


class UpdateSubtitlesRequest(BaseModel):
    subtitles: List[Dict[str, Any]]


class RenameRequest(BaseModel):
    name: str


@router.post("/create")
async def create(req: CreateClipRequest):
    matches = [f for f in os.listdir("uploads") if f.startswith(req.video_id)]
    if not matches:
        raise HTTPException(404, "Video not found")
    source = f"uploads/{matches[0]}"

    clip_id = str(uuid.uuid4())
    segment_path = f"segments/{clip_id}.mp4"
    thumbnail_path = f"thumbnails/{clip_id}.jpg"

    await asyncio.to_thread(extract_segment, source, req.start, req.end, segment_path)

    mid = (req.end - req.start) / 2
    try:
        await asyncio.to_thread(extract_thumbnail, segment_path, thumbnail_path, mid)
    except Exception:
        thumbnail_path = None

    name = req.name.strip() or f"Clip {clip_id[:6]}"
    clip = create_clip(clip_id, name, req.video_id, req.start, req.end, segment_path, thumbnail_path)
    return clip


@router.get("/")
async def list_all():
    return list_clips()


@router.get("/{clip_id}")
async def get_one(clip_id: str):
    clip = get_clip(clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.put("/{clip_id}/subtitles")
async def set_subtitles(clip_id: str, req: UpdateSubtitlesRequest):
    subs = req.subtitles
    clip = update_subtitles(clip_id, subs)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.put("/{clip_id}/name")
async def rename(clip_id: str, req: RenameRequest):
    clip = update_name(clip_id, req.name)
    if not clip:
        raise HTTPException(404, "Clip not found")
    return clip


@router.delete("/{clip_id}")
async def delete(clip_id: str):
    if not delete_clip(clip_id):
        raise HTTPException(404, "Clip not found")
    return {"ok": True}


@router.get("/{clip_id}/waveform")
async def get_waveform(clip_id: str, samples: int = 400):
    path = f"segments/{clip_id}.mp4"
    if not os.path.exists(path):
        raise HTTPException(404, "Segment not found")
    # Extract mono 8kHz PCM via ffmpeg into stdout (non-blocking)
    sr = 8000
    cmd = ["ffmpeg", "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "s16le", "pipe:1"]
    result = await asyncio.to_thread(subprocess.run, cmd, capture_output=True, timeout=30)
    data = result.stdout
    if not data or len(data) < 2:
        return {"samples": [], "duration": 0.0, "onsets": []}
    n = len(data) // 2
    raw = struct.unpack(f"{n}h", data)
    duration = n / sr

    # Peak-binned waveform for display
    chunk = max(1, n // samples)
    peaks = []
    for i in range(0, n - chunk + 1, chunk):
        seg = raw[i : i + chunk]
        peaks.append(round(max(abs(s) for s in seg) / 32768.0, 3))

    # Onset detection: rising-edge above threshold with minimum gap
    onsets = []
    threshold = 1800       # int16 amplitude (~5.5% of full scale)
    release = 600          # hysteresis low bound
    min_gap = int(0.15 * sr)  # 150ms minimum between onsets
    win = int(0.005 * sr)  # 5ms smoothing window
    in_sound = False
    last_idx = -min_gap
    # Smoothed amplitude in fixed-size hops to keep this fast
    hop = max(1, win)
    for i in range(0, n, hop):
        seg = raw[i : i + hop]
        amp = max(abs(s) for s in seg) if seg else 0
        if not in_sound and amp > threshold and (i - last_idx) > min_gap:
            onsets.append(round(i / sr, 3))
            last_idx = i
            in_sound = True
        elif in_sound and amp < release:
            in_sound = False

    return {
        "samples": peaks,
        "duration": round(duration, 3),
        "onsets": onsets,
        "sample_rate": sr,
    }
