import os
from datetime import datetime
from sqlalchemy.orm import Session
from models import Take


def _to_dict(take: Take) -> dict:
    return {
        "id": take.id,
        "clip_id": take.clip_id,
        "character": take.character,
        "subtitle_index": take.subtitle_index,
        "audio_url": f"/{take.audio_path}",
        "duration": take.duration,
        "label": take.label,
        "created_at": take.created_at.isoformat() if take.created_at else None,
    }


def create_take(db: Session, clip_id, character, subtitle_index, audio_path, duration, label=""):
    take = Take(
        clip_id=clip_id,
        character=character or "",
        subtitle_index=subtitle_index,
        audio_path=audio_path,
        duration=float(duration or 0.0),
        label=label or "",
        created_at=datetime.now(),
    )
    db.add(take)
    db.commit()
    db.refresh(take)
    return _to_dict(take)


def list_takes(db: Session, clip_id):
    takes = (
        db.query(Take)
        .filter(Take.clip_id == clip_id)
        .order_by(Take.created_at.asc())
        .all()
    )
    return [_to_dict(t) for t in takes]


def delete_take(db: Session, take_id):
    take = db.query(Take).filter(Take.id == take_id).first()
    if not take:
        return False
    audio_path = take.audio_path
    db.delete(take)
    db.commit()
    if audio_path and os.path.exists(audio_path):
        try:
            os.remove(audio_path)
        except OSError:
            pass
    return True
