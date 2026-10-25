"""Dubbing lexicon — per-project term glossary (translation + pronunciation)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import LexiconEntry, Project
from services import project_service

router = APIRouter()


def _project_id(db: Session, name: str) -> Optional[str]:
    """Legacy scope name → project id ('' = global = None)."""
    return project_service.get_or_create_by_name(db, name).id if name else None


class LexiconIn(BaseModel):
    project: Optional[str] = None   # legacy scope name; PUT: None = keep the entry's scope
    # Scope by id (P5). With `global_entry`, the entry is global whatever the project.
    project_id: Optional[str] = None
    global_entry: bool = False
    term: str
    translation: Optional[str] = None
    phonetic: Optional[str] = None
    note: Optional[str] = None


def _to_dict(e: LexiconEntry) -> dict:
    return {
        "id": e.id,
        "project": e.project or "",
        "project_id": e.project_id,
        "term": e.term,
        "translation": e.translation or "",
        "phonetic": e.phonetic or "",
        "note": e.note or "",
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@router.get("")
@router.get("/")
async def list_entries(project: Optional[str] = None, project_id: Optional[str] = None,
                       q: Optional[str] = None, db: Session = Depends(get_db)):
    """List lexicon entries. When a project (id, or legacy name) is given, returns
    its entries plus globals. Optional case-insensitive term/translation search."""
    query = db.query(LexiconEntry)
    if project_id is not None:
        query = query.filter(LexiconEntry.project_id.is_(None) | (LexiconEntry.project_id == project_id))
    elif project is not None:
        query = query.filter(LexiconEntry.project.in_(["", project]))
    rows = query.order_by(LexiconEntry.term).all()
    out = [_to_dict(r) for r in rows]
    if q:
        ql = q.strip().lower()
        out = [r for r in out if ql in r["term"].lower() or ql in r["translation"].lower()]
    return out


@router.post("")
@router.post("/")
async def create_entry(body: LexiconIn, db: Session = Depends(get_db)):
    term = (body.term or "").strip()
    if not term:
        raise HTTPException(400, "term is required")
    if body.project_id and not body.global_entry:
        project = db.get(Project, body.project_id)
        if not project:
            raise HTTPException(404, "Project not found")
        scope, scope_id = project_service.legacy_name(project) or "", project.id
    elif body.global_entry:
        scope, scope_id = "", None
    else:
        scope = (body.project or "").strip()
        scope_id = _project_id(db, scope)
    e = LexiconEntry(
        project=scope,
        project_id=scope_id,
        term=term,
        translation=(body.translation or "").strip() or None,
        phonetic=(body.phonetic or "").strip() or None,
        note=(body.note or "").strip() or None,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _to_dict(e)


@router.put("/{entry_id}")
async def update_entry(entry_id: int, body: LexiconIn, db: Session = Depends(get_db)):
    e = db.query(LexiconEntry).filter(LexiconEntry.id == entry_id).first()
    if not e:
        raise HTTPException(404, "Entry not found")
    e.term = (body.term or "").strip() or e.term
    e.translation = (body.translation or "").strip() or None
    e.phonetic = (body.phonetic or "").strip() or None
    e.note = (body.note or "").strip() or None
    if body.project is not None:
        e.project = (body.project or "").strip()
        e.project_id = _project_id(db, e.project)
    db.commit()
    db.refresh(e)
    return _to_dict(e)


@router.delete("/{entry_id}")
async def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    e = db.query(LexiconEntry).filter(LexiconEntry.id == entry_id).first()
    if not e:
        raise HTTPException(404, "Entry not found")
    db.delete(e)
    db.commit()
    return {"ok": True}
