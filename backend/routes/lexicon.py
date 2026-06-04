"""Dubbing lexicon — per-project term glossary (translation + pronunciation)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import LexiconEntry

router = APIRouter()


class LexiconIn(BaseModel):
    project: str = ""
    term: str
    translation: Optional[str] = None
    phonetic: Optional[str] = None
    note: Optional[str] = None


def _to_dict(e: LexiconEntry) -> dict:
    return {
        "id": e.id,
        "project": e.project or "",
        "term": e.term,
        "translation": e.translation or "",
        "phonetic": e.phonetic or "",
        "note": e.note or "",
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@router.get("")
@router.get("/")
async def list_entries(project: Optional[str] = None, q: Optional[str] = None,
                       db: Session = Depends(get_db)):
    """List lexicon entries. When project given, returns that project's entries
    plus globals (project=''). Optional case-insensitive term/translation search."""
    query = db.query(LexiconEntry)
    if project is not None:
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
    e = LexiconEntry(
        project=(body.project or "").strip(),
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
