import os
import shutil
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models import Clip
from services.take_service import create_take, delete_take, list_takes, set_best_take

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
    if not db.query(Clip).filter(Clip.clip_id == clip_id).first():
        raise HTTPException(404, "Clip not found")
    take_id = str(uuid.uuid4())
    ext = os.path.splitext(audio.filename or "take.webm")[1] or ".webm"
    audio_path = f"takes/{take_id}{ext}"
    with open(audio_path, "wb") as dst:
        shutil.copyfileobj(audio.file, dst)
    return create_take(db, clip_id, character, subtitle_index, audio_path, duration, label)


@router.get("/{clip_id}")
async def get_takes(clip_id: str, db: Session = Depends(get_db)):
    return list_takes(db, clip_id)


@router.put("/{take_id}/best")
async def mark_best_take(take_id: int, db: Session = Depends(get_db)):
    take = set_best_take(db, take_id)
    if not take:
        raise HTTPException(404, "Take not found")
    return take


@router.delete("/{take_id}")
async def remove_take(take_id: int, db: Session = Depends(get_db)):
    if not delete_take(db, take_id):
        raise HTTPException(404, "Take not found")
    return {"ok": True}
