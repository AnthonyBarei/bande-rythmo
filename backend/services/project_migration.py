"""Text tags → Project/Source rows (PROJECTS_PLAN §3).

Every step only touches rows still missing a project/source, so it runs at
each startup: idempotent, and it also adopts clips created by older screens.
This module is the only reader of the pre-project columns (clips.project,
clips.source_path, lexicon.project), kept for databases upgrading from them."""
import json
import logging
import os
import sqlite3
import uuid
from datetime import datetime

from sqlalchemy.orm import Session, sessionmaker

from models import Clip, LexiconEntry, Meta, Source
from services import project_service, source_service

log = logging.getLogger("br.migration")

FLAG = "projects_migrated"


def backup_sqlite(db_path: str) -> str:
    """Consistent copy (WAL included) via the sqlite backup API."""
    dst_path = f"{db_path}.bak-projects-{datetime.now():%Y%m%d}"
    src = sqlite3.connect(db_path)
    dst = sqlite3.connect(dst_path)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    return dst_path


def _assign_projects(db: Session) -> int:
    clips = db.query(Clip).filter(Clip.project_id.is_(None)).all()
    for clip in clips:
        clip.project_id = project_service.get_or_create_by_name(db, clip.project).id
    db.commit()
    return len(clips)


def _assign_sources(db: Session) -> int:
    clips = (db.query(Clip).filter(Clip.source_id.is_(None), Clip.project_id.isnot(None))
             .order_by(Clip.created_at).all())
    by_key: dict[tuple, Source] = {}
    adopted = 0
    for clip in clips:
        key_path = clip.source_path or ""
        if not key_path and not clip.source_filename:
            continue
        key = (clip.project_id, key_path or f"name:{clip.source_filename}")
        src = by_key.get(key)
        if src is None:
            kind, path, ref = source_service.classify(clip.source_path)
            src = Source(
                id=str(uuid.uuid4()), project_id=clip.project_id,
                kind=kind if clip.source_path else "local", path=path,
                library=json.dumps(ref) if ref else None,
                filename=clip.source_filename or os.path.basename(clip.source_path or ""),
                fps=clip.fps, created_at=clip.created_at or datetime.now(), updated_at=datetime.now(),
            )
            db.add(src)
            db.flush()   # no ORM relationship orders the insert before the clip update
            by_key[key] = src
        clip.source_id = src.id
        adopted += 1
    db.commit()
    return adopted


def _assign_lexicon(db: Session) -> int:
    rows = (db.query(LexiconEntry)
            .filter(LexiconEntry.project_id.is_(None), LexiconEntry.project != "").all())
    for e in rows:
        e.project_id = project_service.get_or_create_by_name(db, e.project).id
    db.commit()
    return len(rows)


def _prune_orphan_sources(db: Session) -> int:
    """Sources outside any project with no clip: previews registered before
    projects (pre-P3 Médiathèque) or by the Atelier's loose import, whose
    state never survives a restart anyway. Their remuxed audio goes too."""
    used = {sid for (sid,) in db.query(Clip.source_id).filter(Clip.source_id.isnot(None)).distinct()}
    orphans = [s for s in db.query(Source).filter(Source.project_id.is_(None)) if s.id not in used]
    for src in orphans:
        db.delete(src)
    db.commit()
    for src in orphans:
        source_service.remove_remuxes(src.id)
    return len(orphans)


def migrate_projects(bind) -> None:
    db = sessionmaker(bind=bind)()
    try:
        first = db.get(Meta, FLAG) is None
        if first and db.query(Clip).count() and bind.url.database not in (None, "", ":memory:"):
            log.info("projects migration: backup → %s", backup_sqlite(bind.url.database))
        clips = _assign_projects(db)
        sources = _assign_sources(db)
        lexicon = _assign_lexicon(db)
        pruned = _prune_orphan_sources(db)
        if first:
            db.merge(Meta(key=FLAG, value=datetime.now().isoformat()))
            db.commit()
        if clips or sources or lexicon or pruned:
            log.info("projects migration: %d clips → projects, %d → sources, %d lexicon entries, "
                     "%d orphan sources pruned", clips, sources, lexicon, pruned)
    finally:
        db.close()
