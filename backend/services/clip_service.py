import json
import logging
import re
import os
import shutil
from datetime import datetime
from typing import Annotated
from pydantic import StringConstraints
from sqlalchemy.orm import Session
from models import Clip, Subtitle, Boucle, Take, Export

log = logging.getLogger("br.clips")

# Clip ids become file names (segments/{id}.mp4) — never allow path parts.
SAFE_ID_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"
SafeId = Annotated[str, StringConstraints(pattern=SAFE_ID_PATTERN)]


def _redact_token(path):
    """Plex stream URLs carry X-Plex-Token — never send it to the browser."""
    if not path or "X-Plex-Token" not in path:
        return path
    return re.sub(r"X-Plex-Token=[^&]+", "X-Plex-Token=***", path)


def _parse_words(raw):
    if not raw:
        return None
    try:
        w = json.loads(raw)
        return w if isinstance(w, list) and w else None
    except (ValueError, TypeError):
        return None


def _parse_scene_cuts(raw):
    if not raw:
        return []
    try:
        v = json.loads(raw)
        return v if isinstance(v, list) else []
    except (ValueError, TypeError):
        return []


def _to_dict(clip: Clip) -> dict:
    return {
        "clip_id": clip.clip_id,
        "name": clip.name,
        "source_filename": clip.source_filename,
        "source_path": _redact_token(clip.source_path),
        "start": clip.start,
        "end": clip.end,
        "segment_path": clip.segment_path,
        "thumbnail_path": clip.thumbnail_path,
        "status": clip.status or "todo",
        "fps": clip.fps or 25.0,
        "scene_cuts": _parse_scene_cuts(clip.scene_cuts),
        "project": clip.project or "",
        "has_proxy": os.path.isfile(f"segments/{clip.clip_id}_proxy.mp4"),
        "has_bed": os.path.isfile(f"segments/{clip.clip_id}_bed.wav"),
        "subtitles": [
            {
                "start": s.start, "end": s.end, "character": s.character,
                "text": s.text, "words": _parse_words(s.words),
                "off": bool(s.off), "dos": bool(s.dos),
                "ambiance": bool(s.ambiance), "plan_cut": s.plan_cut,
                "note": s.note or "",
                "hidden": bool(s.hidden), "take": bool(s.take),
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
            character=s.get("character") or "",
            text=s.get("text") or "",
            words=words_json,
            off=bool(s.get("off", False)),
            dos=bool(s.get("dos", False)),
            ambiance=bool(s.get("ambiance", False)),
            plan_cut=plan_cut,
            note=(s.get("note") or None),
            hidden=bool(s.get("hidden", False)),
            take=bool(s.get("take", False)),
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


def update_scene_cuts(db: Session, clip_id, cuts):
    clip = db.query(Clip).filter(Clip.clip_id == clip_id).first()
    if not clip:
        return None
    clip.scene_cuts = json.dumps(list(cuts)) if cuts else None
    db.commit()
    db.refresh(clip)
    return _to_dict(clip)


def update_project(db: Session, clip_id, project):
    clip = db.query(Clip).filter(Clip.clip_id == clip_id).first()
    if not clip:
        return None
    clip.project = (project or "").strip() or None
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


def _inside(path: str, folder: str) -> bool:
    root = os.path.realpath(folder)
    try:
        return os.path.commonpath([os.path.realpath(path), root]) == root
    except ValueError:
        return False


def _remove_owned(path, folder: str):
    if not path or not os.path.exists(path):
        return
    if not _inside(path, folder):
        log.warning("not removing %s: outside %s/", path, folder)
        return
    try:
        os.remove(path)
    except OSError:
        log.warning("could not remove %s", path, exc_info=True)


def delete_clip(db: Session, clip_id):
    clip = db.query(Clip).filter(Clip.clip_id == clip_id).first()
    if not clip:
        return False
    segment_path = clip.segment_path
    thumbnail_path = clip.thumbnail_path
    take_paths = [t.audio_path for t in db.query(Take).filter(Take.clip_id == clip_id)]
    export_paths = [e.path for e in db.query(Export).filter(Export.clip_id == clip_id)]
    db.query(Take).filter(Take.clip_id == clip_id).delete()
    db.query(Export).filter(Export.clip_id == clip_id).delete()
    db.delete(clip)
    db.commit()
    # Derived per-clip files are unreachable once the row is gone.
    owned = [
        (segment_path, "segments"),
        (thumbnail_path, "thumbnails"),
        (f"segments/{clip_id}_proxy.mp4", "segments"),
        (f"segments/{clip_id}_bed.wav", "segments"),
        *((p, "takes") for p in take_paths),
        *((p, "exports") for p in export_paths),
    ]
    for path, folder in owned:
        _remove_owned(path, folder)
    stems = os.path.join("segments", "stems", "htdemucs", clip_id)
    if os.path.isdir(stems):
        try:
            shutil.rmtree(stems)
        except OSError:
            log.warning("could not remove %s", stems, exc_info=True)
    return True
