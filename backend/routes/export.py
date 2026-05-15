from fastapi import APIRouter, HTTPException, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from services.subtitle_service import export_srt, export_ass
from services.ffmpeg_service import burn_subtitles, export_gif
from services.br_renderer import render_br_video
import asyncio
import uuid
import os
import json
import subprocess

router = APIRouter()


class Subtitle(BaseModel):
    start: float
    end: float
    character: str = ""
    text: str


class ExportRequest(BaseModel):
    subtitles: List[Subtitle] = []
    segment_id: str
    format: str  # "srt" | "ass" | "mp4" | "gif" | "mp3" | "wav"
    in_point: float = None
    out_point: float = None
    px_per_sec: float = 180.0
    br_offset: float = 0.0
    canvas_w: int = 1200   # canvas coordinate width (CSS px) — used to scale pxPerSec to video px
    canvas_h: int = 64     # canvas coordinate height = numTracks * H_TRACK




@router.post("/export")
async def export(req: ExportRequest):
    export_id = str(uuid.uuid4())
    segment = f"segments/{req.segment_id}.mp4"

    if req.format == "gif":
        if not os.path.exists(segment):
            raise HTTPException(404, "Segment not found")
        output = f"exports/{export_id}.gif"
        ss = req.in_point if req.in_point is not None else None
        dur = (req.out_point - req.in_point) if (req.in_point is not None and req.out_point is not None) else None
        await asyncio.to_thread(export_gif, segment, output, 12, 480, ss, dur)
        return FileResponse(output, filename="clip.gif", media_type="image/gif")

    subs = [{"start": s.start, "end": s.end, "character": s.character, "text": s.text} for s in req.subtitles]

    if req.format == "srt":
        path = f"exports/{export_id}.srt"
        export_srt(subs, path)
        return FileResponse(path, filename="bande_rythmo.srt", media_type="text/plain")

    elif req.format == "ass":
        path = f"exports/{export_id}.ass"
        export_ass(subs, path)
        return FileResponse(path, filename="bande_rythmo.ass", media_type="text/plain")

    elif req.format == "mp4":
        if not os.path.exists(segment):
            raise HTTPException(404, "Segment not found")

        # Probe video dimensions, fps, and duration
        probe = await asyncio.to_thread(
            subprocess.run,
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_streams", "-show_format", segment],
            capture_output=True,
        )
        vw, vh, fps_str, duration_s = 1920, 1080, "24/1", 0.0
        try:
            data = json.loads(probe.stdout)
            vs = next(s for s in data["streams"] if s.get("codec_type") == "video")
            vw = vs["width"]
            vh = vs["height"]
            fps_str = vs.get("r_frame_rate", "24/1")
            duration_s = float(vs.get("duration", 0) or 0)
            if duration_s <= 0:
                duration_s = float(data.get("format", {}).get("duration", 0) or 0)
        except Exception:
            pass

        # Parse fps fraction (e.g. "24000/1001" → 23.976)
        try:
            num, den = fps_str.split("/")
            fps = float(num) / float(den)
        except Exception:
            fps = 24.0

        if duration_s <= 0:
            duration_s = 60.0

        # Scale canvas units → video pixels
        scale = vw / max(req.canvas_w, 1)
        px_per_sec_video = req.px_per_sec * scale
        br_h_video = max(40, int(req.canvas_h * scale))
        # Ensure even height (required by yuv420p)
        if br_h_video % 2 != 0:
            br_h_video += 1

        strip_path = f"exports/{export_id}_strip.mp4"
        output = f"exports/{export_id}_rythmo.mp4"

        try:
            await asyncio.to_thread(
                render_br_video,
                subs, vw, br_h_video,
                px_per_sec_video, fps, duration_s,
                strip_path,
                req.br_offset,
            )
        except Exception as e:
            raise HTTPException(500, f"br_renderer error: {str(e)}")

        # Overlay strip at bottom of video
        cmd = [
            "ffmpeg", "-y",
            "-i", segment,
            "-i", strip_path,
            "-filter_complex", "[0:v][1:v]overlay=0:H-h:shortest=1",
            "-c:v", "libx264",
            "-crf", "16",
            "-preset", "slow",
            "-pix_fmt", "yuv420p",
            "-bf", "0",
            "-c:a", "copy",
            output,
        ]
        result = await asyncio.to_thread(subprocess.run, cmd, capture_output=True)
        if result.returncode != 0:
            raise HTTPException(500, f"ffmpeg overlay error: {result.stderr.decode(errors='replace')}")

        return FileResponse(output, filename="bande_rythmo.mp4", media_type="video/mp4")

    elif req.format in ("mp3", "wav"):
        if not os.path.exists(segment):
            raise HTTPException(404, "Segment not found")
        ext = req.format
        output = f"exports/{export_id}.{ext}"
        cmd = ["ffmpeg", "-y"]
        if req.in_point is not None:
            cmd += ["-ss", str(req.in_point)]
        cmd += ["-i", segment, "-vn"]
        if req.in_point is not None and req.out_point is not None:
            cmd += ["-t", str(req.out_point - req.in_point)]
        if ext == "mp3":
            cmd += ["-c:a", "libmp3lame", "-q:a", "2"]
        else:
            cmd += ["-c:a", "pcm_s16le"]
        cmd.append(output)
        await asyncio.to_thread(subprocess.run, cmd, check=True, capture_output=True)
        media = "audio/mpeg" if ext == "mp3" else "audio/wav"
        return FileResponse(output, filename=f"clip.{ext}", media_type=media)

    else:
        raise HTTPException(400, "format must be srt, ass, mp4, gif, mp3, or wav")


@router.post("/mp4-canvas")
async def export_mp4_canvas(
    segment_id: str = Form(...),
    overlay: UploadFile = File(...),
):
    export_id = str(uuid.uuid4())
    segment = f"segments/{segment_id}.mp4"
    if not os.path.exists(segment):
        raise HTTPException(404, "Segment not found")

    # Save canvas overlay
    overlay_path = f"exports/{export_id}_overlay.webm"
    with open(overlay_path, "wb") as f:
        f.write(await overlay.read())

    # Get video width via ffprobe
    probe = await asyncio.to_thread(
        subprocess.run,
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", segment],
        capture_output=True,
    )
    vw, fps = 1280, "30/1"
    try:
        data = json.loads(probe.stdout)
        vs = next(s for s in data["streams"] if s.get("codec_type") == "video")
        vw = vs["width"]
        fps = vs.get("r_frame_rate", "30/1")
    except Exception:
        pass

    output = f"exports/{export_id}_canvas_rythmo.mp4"
    # Normalize overlay timestamps then convert to CFR matching video fps.
    # setpts=PTS-STARTPTS removes gaps/offsets from MediaRecorder VFR webm before
    # the fps filter selects frames — prevents inconsistent frame selection (jump artifacts).
    filter_complex = (
        f"[1:v]setpts=PTS-STARTPTS,fps={fps},scale={vw}:-2[br];"
        f"[0:v][br]overlay=0:main_h-overlay_h:shortest=1"
    )
    cmd = [
        "ffmpeg", "-y",
        "-i", segment,
        "-i", overlay_path,
        "-filter_complex", filter_complex,
        "-c:v", "libx264",
        "-crf", "16",
        "-preset", "slow",
        "-pix_fmt", "yuv420p",
        "-bf", "0",          # no B-frames — prevents ghosting/smear on scrolling text
        "-c:a", "copy",
        output,
    ]
    result = await asyncio.to_thread(subprocess.run, cmd, capture_output=True)
    if result.returncode != 0:
        raise HTTPException(500, f"ffmpeg: {result.stderr.decode(errors='replace')}")

    return FileResponse(output, filename="bande_rythmo_canvas.mp4", media_type="video/mp4")
