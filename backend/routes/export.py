from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from services.subtitle_service import export_srt, export_ass
from services.ffmpeg_service import burn_subtitles, export_gif
import asyncio
import uuid
import os
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
    gif_start: float = 0
    gif_end: Optional[float] = None




@router.post("/export")
async def export(req: ExportRequest):
    export_id = str(uuid.uuid4())
    segment = f"segments/{req.segment_id}.mp4"

    if req.format == "gif":
        if not os.path.exists(segment):
            raise HTTPException(404, "Segment not found")
        output = f"exports/{export_id}.gif"
        duration = (req.gif_end - req.gif_start) if req.gif_end is not None else None
        await asyncio.to_thread(export_gif, segment, output, start=req.gif_start, duration=duration)
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
        ass_path = f"exports/{export_id}.ass"
        export_ass(subs, ass_path)
        output = f"exports/{export_id}_rythmo.mp4"
        await asyncio.to_thread(burn_subtitles, segment, ass_path, output)
        return FileResponse(output, filename="bande_rythmo.mp4", media_type="video/mp4")

    elif req.format in ("mp3", "wav"):
        if not os.path.exists(segment):
            raise HTTPException(404, "Segment not found")
        ext = req.format
        output = f"exports/{export_id}.{ext}"
        cmd = ["ffmpeg", "-y", "-i", segment, "-vn"]
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
