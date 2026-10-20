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
        "lead": float(take.lead or 0.0),
        "best": bool(take.best),
        "created_at": take.created_at.isoformat() if take.created_at else None,
    }


def create_take(db: Session, clip_id, character, subtitle_index, audio_path, duration, label="", lead=0.0):
    take = Take(
        clip_id=clip_id,
        character=character or "",
        subtitle_index=subtitle_index,
        audio_path=audio_path,
        duration=float(duration or 0.0),
        label=label or "",
        lead=max(0.0, float(lead or 0.0)),
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


def set_best_take(db: Session, take_id):
    """Mark a take as its réplique's best; clear the flag on the other takes
    of the same clip + réplique (free takes: subtitle_index NULL form a group)."""
    take = db.query(Take).filter(Take.id == take_id).first()
    if not take:
        return None
    siblings = db.query(Take).filter(Take.clip_id == take.clip_id, Take.id != take.id)
    if take.subtitle_index is None:
        siblings = siblings.filter(Take.subtitle_index.is_(None))
    else:
        siblings = siblings.filter(Take.subtitle_index == take.subtitle_index)
    siblings.update({Take.best: False}, synchronize_session=False)
    take.best = True
    db.commit()
    db.refresh(take)
    return _to_dict(take)


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
