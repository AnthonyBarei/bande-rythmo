"""Export artifact persistence — DB CRUD for the exports table."""

import json
import os
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models import Export


def _to_dict(e: Export) -> Dict[str, Any]:
    return {
        "id": e.id,
        "clip_id": e.clip_id,
        "format": e.format,
        "path": e.path,
        "filename": e.filename,
        "media_type": e.media_type,
        "size_bytes": e.size_bytes,
        "quality": e.quality,
        "params": json.loads(e.params) if e.params else None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def record_export(
    db: Session,
    *,
    clip_id: str,
    format: str,
    path: str,
    filename: str,
    media_type: str = "application/octet-stream",
    quality: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    size = 0
    try:
        size = os.path.getsize(path)
    except OSError:
        pass
    row = Export(
        clip_id=clip_id,
        format=format,
        path=path,
        filename=filename,
        media_type=media_type,
        size_bytes=size,
        quality=quality,
        params=json.dumps(params) if params else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_dict(row)


def list_exports(db: Session, clip_id: Optional[str] = None) -> List[Dict[str, Any]]:
    q = db.query(Export).order_by(Export.created_at.desc())
    if clip_id:
        q = q.filter(Export.clip_id == clip_id)
    return [_to_dict(e) for e in q.all()]


def get_export(db: Session, export_id: int) -> Optional[Export]:
    return db.query(Export).filter(Export.id == export_id).first()


def delete_export(db: Session, export_id: int) -> bool:
    e = get_export(db, export_id)
    if not e:
        return False
    try:
        if e.path and os.path.exists(e.path):
            os.remove(e.path)
    except OSError:
        pass
    db.delete(e)
    db.commit()
    return True
