from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.whisper_service import transcribe_segment
import asyncio
import os

router = APIRouter()


class TranscribeRequest(BaseModel):
    segment_id: str
    language: Optional[str] = "fr"
    diarize: bool = True


@router.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    path = f"segments/{req.segment_id}.mp4"
    if not os.path.exists(path):
        raise HTTPException(404, "Segment not found")
    subtitles = await asyncio.to_thread(transcribe_segment, path, req.language, req.diarize)
    return {"subtitles": subtitles}
