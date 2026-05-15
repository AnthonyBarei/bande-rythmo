import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from services.take_service import create_take, delete_take, list_takes

router = APIRouter()


@router.post("/")
async def upload_take(
    clip_id: str = Form(...),
    character: str = Form(""),
    subtitle_index: int | None = Form(None),
    duration: float = Form(0.0),
    label: str = Form(""),
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    take_id = str(uuid.uuid4())
    ext = os.path.splitext(audio.filename or "take.webm")[1] or ".webm"
    audio_path = f"takes/{take_id}{ext}"
    with open(audio_path, "wb") as dst:
        shutil.copyfileobj(audio.file, dst)
    return create_take(db, clip_id, character, subtitle_index, audio_path, duration, label)


@router.get("/{clip_id}")
async def get_takes(clip_id: str, db: Session = Depends(get_db)):
    return list_takes(db, clip_id)


@router.delete("/{take_id}")
async def remove_take(take_id: int, db: Session = Depends(get_db)):
    if not delete_take(db, take_id):
        raise HTTPException(404, "Take not found")
    return {"ok": True}
