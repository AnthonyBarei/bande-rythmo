import json
import os
from datetime import datetime
from sqlalchemy.orm import Session
from models import Clip, Subtitle, Boucle


def _parse_words(raw):
    if not raw:
        return None
    try:
        w = json.loads(raw)
        return w if isinstance(w, list) and w else None
    except (ValueError, TypeError):
        return None


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
        "status": clip.status or "todo",
        "fps": clip.fps or 25.0,
        "subtitles": [
            {
                "start": s.start, "end": s.end, "character": s.character,
                "text": s.text, "words": _parse_words(s.words),
                "off": bool(s.off), "dos": bool(s.dos),
                "ambiance": bool(s.ambiance), "plan_cut": s.plan_cut,
            }
            for s in clip.subtitles
        ],
        "boucles": [
            {"number": b.number, "start": b.start, "end": b.end}
            for b in clip.boucles
        ],
        "created_at": clip.created_at.isoformat() if clip.created_at else None,
    }


def create_clip(db: Session, clip_id, name, source_filename, start, end, segment_path, thumbnail_path, source_path=None, fps=25.0):
    clip = Clip(
        clip_id=clip_id,
        name=name,
        source_filename=source_filename,
        source_path=source_path,
        start=start,
        end=end,
        segment_path=segment_path,
        thumbnail_path=thumbnail_path,
        fps=fps,
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
        words = s.get("words")
        words_json = json.dumps(words) if isinstance(words, list) and words else None
        pc = s.get("plan_cut")
        try:
            plan_cut = float(pc) if pc not in (None, "") else None
        except (TypeError, ValueError):
            plan_cut = None
        db.add(Subtitle(
            clip_id=clip_id,
            order_index=i,
            start=float(s.get("start", 0)),
            end=float(s.get("end", 0)),
            character=s.get("character", ""),
            text=s.get("text", ""),
            words=words_json,
            off=bool(s.get("off", False)),
            dos=bool(s.get("dos", False)),
            ambiance=bool(s.get("ambiance", False)),
            plan_cut=plan_cut,
        ))
    db.commit()
    db.refresh(clip)
    return _to_dict(clip)


def update_boucles(db: Session, clip_id, boucles):
    """Replace all boucles for a clip. Numbers renormalised contiguously from 1."""
    clip = db.query(Clip).filter(Clip.clip_id == clip_id).first()
    if not clip:
        return None
    db.query(Boucle).filter(Boucle.clip_id == clip_id).delete()
    sorted_b = sorted(
        [b for b in boucles if b.get("end", 0) > b.get("start", 0)],
        key=lambda b: float(b.get("start", 0)),
    )
    for i, b in enumerate(sorted_b, 1):
        db.add(Boucle(
            clip_id=clip_id,
            number=i,
            start=float(b.get("start", 0)),
            end=float(b.get("end", 0)),
        ))
    db.commit()
    db.refresh(clip)
    return _to_dict(clip)


def update_fps(db: Session, clip_id, fps):
    clip = db.query(Clip).filter(Clip.clip_id == clip_id).first()
    if not clip:
        return None
    clip.fps = float(fps)
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


VALID_STATUSES = {"todo", "dubbing", "review", "done"}


def update_status(db: Session, clip_id, status):
    if status not in VALID_STATUSES:
        return None
    clip = db.query(Clip).filter(Clip.clip_id == clip_id).first()
    if not clip:
        return None
    clip.status = status
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
