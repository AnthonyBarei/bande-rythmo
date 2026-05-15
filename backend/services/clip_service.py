import os
from datetime import datetime
from sqlalchemy.orm import Session
from models import Clip, Subtitle


def _to_dict(clip: Clip) -> dict:
    return {
        "clip_id": clip.clip_id,
        "name": clip.name,
        "source_filename": clip.source_filename,
        "source_path": clip.source_path,
        "start": clip.start,
        "end": clip.end,
        "segment_path": clip.segment_path,
        "thumbnail_path": clip.thumbnail_path,
        "subtitles": [
            {"start": s.start, "end": s.end, "character": s.character, "text": s.text}
            for s in clip.subtitles
        ],
        "created_at": clip.created_at.isoformat() if clip.created_at else None,
    }


def create_clip(db: Session, clip_id, name, source_filename, start, end, segment_path, thumbnail_path, source_path=None):
    clip = Clip(
        clip_id=clip_id,
        name=name,
        source_filename=source_filename,
        source_path=source_path,
        start=start,
        end=end,
        segment_path=segment_path,
        thumbnail_path=thumbnail_path,
        created_at=datetime.now(),
    )
    db.add(clip)
    db.commit()
    db.refresh(clip)
    return _to_dict(clip)


def list_clips(db: Session):
    clips = db.query(Clip).order_by(Clip.created_at.desc()).all()
    return [_to_dict(c) for c in clips]


def get_clip(db: Session, clip_id):
    clip = db.query(Clip).filter(Clip.clip_id == clip_id).first()
    return _to_dict(clip) if clip else None


def update_subtitles(db: Session, clip_id, subtitles):
    clip = db.query(Clip).filter(Clip.clip_id == clip_id).first()
    if not clip:
        return None
    db.query(Subtitle).filter(Subtitle.clip_id == clip_id).delete()
    for i, s in enumerate(subtitles):
        db.add(Subtitle(
            clip_id=clip_id,
            order_index=i,
            start=float(s.get("start", 0)),
            end=float(s.get("end", 0)),
            character=s.get("character", ""),
            text=s.get("text", ""),
        ))
    db.commit()
    db.refresh(clip)
    return _to_dict(clip)


def update_name(db: Session, clip_id, name):
    clip = db.query(Clip).filter(Clip.clip_id == clip_id).first()
    if not clip:
        return None
    clip.name = name
    db.commit()
    db.refresh(clip)
    return _to_dict(clip)


def delete_clip(db: Session, clip_id):
    clip = db.query(Clip).filter(Clip.clip_id == clip_id).first()
    if not clip:
        return False
    segment_path = clip.segment_path
    thumbnail_path = clip.thumbnail_path
    db.delete(clip)
    db.commit()
    for p in (segment_path, thumbnail_path):
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass
    return True
