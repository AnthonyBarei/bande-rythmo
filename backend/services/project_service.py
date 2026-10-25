"""Projects — the unit of work. Clips, sources, cast and lexicon hang off one."""
import json
import os
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Clip, Export, LexiconEntry, Project, ProjectRole, Source, Subtitle, Take
from services import clip_service, source_service

DEFAULT_PROJECT_NAME = "Clips importés"
# MemeGenerator tags its clips with this name (frontend MEME_PROJECT).
MEMES_PROJECT_NAME = "Memes & extraits"

STATUSES = {"active", "archived"}


def _parse(raw, default=None):
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return default


def create(db: Session, name: str, language: Optional[str] = None, color: Optional[str] = None,
           owner_id: Optional[str] = None, kind: str = "normal") -> Project:
    now = datetime.now()
    project = Project(
        id=uuid.uuid4().hex, name=name.strip(), language=language or None, color=color or None,
        owner_id=owner_id, kind=kind, status="active", created_at=now, updated_at=now,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_or_create_by_name(db: Session, name: Optional[str]) -> Project:
    """Legacy text tag → project. Empty → the default bucket for untagged clips."""
    name = (name or "").strip() or DEFAULT_PROJECT_NAME
    project = (db.query(Project).filter(Project.name == name)
               .order_by(Project.created_at).first())
    if project:
        return project
    kind = "memes" if name == MEMES_PROJECT_NAME else "normal"
    return create(db, name, kind=kind)


def legacy_name(project: Project) -> Optional[str]:
    """Clip.project text that matches a project (None for the default bucket)."""
    return None if project.name == DEFAULT_PROJECT_NAME else project.name


def _counts(db: Session, project_ids: list[str]) -> dict:
    out = {pid: {"sources": 0, "clips": 0, "lines": 0,
                 "by_status": {"todo": 0, "dubbing": 0, "review": 0, "done": 0}}
           for pid in project_ids}
    if not project_ids:
        return out
    for pid, n in (db.query(Source.project_id, func.count(Source.id))
                   .filter(Source.project_id.in_(project_ids)).group_by(Source.project_id)):
        out[pid]["sources"] = n
    for pid, status, n in (db.query(Clip.project_id, Clip.status, func.count(Clip.clip_id))
                           .filter(Clip.project_id.in_(project_ids))
                           .group_by(Clip.project_id, Clip.status)):
        out[pid]["clips"] += n
        out[pid]["by_status"][status or "todo"] = out[pid]["by_status"].get(status or "todo", 0) + n
    for pid, n in (db.query(Clip.project_id, func.count(Subtitle.id))
                   .join(Subtitle, Subtitle.clip_id == Clip.clip_id)
                   .filter(Clip.project_id.in_(project_ids)).group_by(Clip.project_id)):
        out[pid]["lines"] = n
    return out


def _cover(db: Session, project_id: str) -> Optional[str]:
    clip = (db.query(Clip).filter(Clip.project_id == project_id, Clip.thumbnail_path.isnot(None))
            .order_by(Clip.created_at).first())
    return clip.thumbnail_path if clip else None


def to_dict(db: Session, project: Project, counts: Optional[dict] = None) -> dict:
    counts = counts or _counts(db, [project.id])[project.id]
    return {
        "id": project.id,
        "name": project.name,
        "color": project.color,
        "language": project.language,
        "status": project.status,
        "kind": project.kind,
        "owner_id": project.owner_id,
        "ui_state": _parse(project.ui_state, {}),
        "cover": _cover(db, project.id),
        "counts": counts,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
        "opened_at": project.opened_at.isoformat() if project.opened_at else None,
    }


def list_projects(db: Session, status: Optional[str] = "active", include_memes: bool = False) -> list[dict]:
    query = db.query(Project)
    if status:
        query = query.filter(Project.status == status)
    if not include_memes:
        query = query.filter(Project.kind != "memes")
    rows = query.all()
    rows.sort(key=lambda p: p.opened_at or p.updated_at or p.created_at or datetime.min, reverse=True)
    counts = _counts(db, [p.id for p in rows])
    return [to_dict(db, p, counts[p.id]) for p in rows]


def cast_of(db: Session, project_id: str) -> list[dict]:
    rows = (db.query(ProjectRole).filter(ProjectRole.project_id == project_id)
            .order_by(ProjectRole.order, ProjectRole.id).all())
    return [{"role": r.role, "comedien": r.comedien or "", "color": r.color, "order": r.order} for r in rows]


def update_cast(db: Session, project: Project, patch: dict) -> list[dict]:
    """{role: comédien} upserts; '' keeps a role cleared on purpose (the
    account's comédien name is then not shown); None removes the role."""
    rows = {r.role: r for r in db.query(ProjectRole).filter(ProjectRole.project_id == project.id)}
    next_order = max((r.order for r in rows.values()), default=-1) + 1
    for role, comedien in patch.items():
        row = rows.get(role)
        if comedien is None:
            if row:
                db.delete(row)
            continue
        if row:
            row.comedien = comedien.strip()
        else:
            db.add(ProjectRole(project_id=project.id, role=role, comedien=comedien.strip(), order=next_order))
            next_order += 1
    project.updated_at = datetime.now()
    db.commit()
    return cast_of(db, project.id)


def detail(db: Session, project: Project) -> dict:
    sources = db.query(Source).filter(Source.project_id == project.id).order_by(Source.created_at).all()
    per_source = dict(db.query(Clip.source_id, func.count(Clip.clip_id))
                      .filter(Clip.project_id == project.id).group_by(Clip.source_id).all())
    return {
        **to_dict(db, project),
        "sources": [source_service.to_dict(s, per_source.get(s.id, 0)) for s in sources],
        "cast": cast_of(db, project.id),
        "disk_bytes": disk_bytes(db, project.id),
    }


def update(db: Session, project: Project, fields: dict) -> Project:
    if "name" in fields:
        project.name = fields["name"].strip()
        # Keep the legacy text tag on clips + lexicon in step until P6.
        db.query(Clip).filter(Clip.project_id == project.id).update(
            {Clip.project: legacy_name(project)}, synchronize_session=False)
        db.query(LexiconEntry).filter(LexiconEntry.project_id == project.id).update(
            {LexiconEntry.project: legacy_name(project) or ""}, synchronize_session=False)
    for key in ("color", "language"):
        if key in fields:
            setattr(project, key, fields[key] or None)
    if "status" in fields:
        project.status = fields["status"]
    if "ui_state" in fields:
        project.ui_state = json.dumps(fields["ui_state"]) if fields["ui_state"] else None
        project.opened_at = datetime.now()
    project.updated_at = datetime.now()
    db.commit()
    db.refresh(project)
    return project


def _clip_files(db: Session, clip_ids: list[str]) -> list[str]:
    paths = []
    for clip in db.query(Clip).filter(Clip.clip_id.in_(clip_ids)):
        paths += [clip.segment_path, clip.thumbnail_path,
                  f"segments/{clip.clip_id}_proxy.mp4", f"segments/{clip.clip_id}_bed.wav"]
    paths += [t.audio_path for t in db.query(Take).filter(Take.clip_id.in_(clip_ids))]
    paths += [e.path for e in db.query(Export).filter(Export.clip_id.in_(clip_ids))]
    return paths


def _tree_bytes(folder: str) -> int:
    total = 0
    for root, _, files in os.walk(folder):
        for name in files:
            try:
                total += os.path.getsize(os.path.join(root, name))
            except OSError:
                pass
    return total


def disk_bytes(db: Session, project_id: str) -> int:
    """Space a delete would free: derived files only, never the source videos."""
    clip_ids = [c for (c,) in db.query(Clip.clip_id).filter(Clip.project_id == project_id)]
    total = 0
    for path in _clip_files(db, clip_ids):
        if path and os.path.isfile(path):
            total += os.path.getsize(path)
    for clip_id in clip_ids:
        total += _tree_bytes(os.path.join("segments", "stems", "htdemucs", clip_id))
    if os.path.isdir("sources"):
        for (sid,) in db.query(Source.id).filter(Source.project_id == project_id):
            for name in os.listdir("sources"):
                if name.startswith(f"{sid}_a"):
                    total += os.path.getsize(os.path.join("sources", name))
    return total


def delete(db: Session, project: Project) -> int:
    """Removes clips (+ takes, exports, proxies, beds, stems), remuxes, cast and
    lexicon. Original source videos are never touched. Returns bytes freed."""
    freed = disk_bytes(db, project.id)
    for (clip_id,) in db.query(Clip.clip_id).filter(Clip.project_id == project.id).all():
        clip_service.delete_clip(db, clip_id)
    for src in db.query(Source).filter(Source.project_id == project.id).all():
        source_service.delete(db, src)
    db.query(ProjectRole).filter(ProjectRole.project_id == project.id).delete()
    db.query(LexiconEntry).filter(LexiconEntry.project_id == project.id).delete()
    db.delete(project)
    db.commit()
    return freed
