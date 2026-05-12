from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import asyncio
import uuid
import os
from services.ffmpeg_service import extract_segment

router = APIRouter()


@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    video_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    path = f"uploads/{video_id}{ext}"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"video_id": video_id, "filename": file.filename, "path": path}


@router.post("/segment")
async def cut_segment(video_id: str, start: float, end: float):
    matches = [f for f in os.listdir("uploads") if f.startswith(video_id)]
    if not matches:
        raise HTTPException(404, "Video not found")
    source = f"uploads/{matches[0]}"
    segment_id = str(uuid.uuid4())
    output = f"segments/{segment_id}.mp4"
    await asyncio.to_thread(extract_segment, source, start, end, output)
    return {"segment_id": segment_id, "path": output, "start": start, "end": end}
