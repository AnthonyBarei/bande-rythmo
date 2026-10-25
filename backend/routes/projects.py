"""Projects + their media bin (PROJECTS_PLAN §5)."""
import asyncio
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Project
from routes.auth import COOKIE
from services import auth_service, project_service, source_service
from services.ffmpeg_service import probe_streams
from services.files_dialog import open_video_dialog

router = APIRouter()


class ProjectIn(BaseModel):
    name: str
    language: Optional[str] = None
    color: Optional[str] = None


class ProjectPatch(BaseModel):
    name: Optional[str] = None
    language: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    ui_state: Optional[Dict[str, Any]] = None


class SourceIn(BaseModel):
    path: str                    # plain URL or Plex/Jellyfin stream URL
    filename: str = ""


class CastIn(BaseModel):
    cast: Dict[str, Optional[str]]   # role → comédien ('' cleared on purpose, null removes)


def _get(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


def _owner_id(request: Request, db: Session) -> Optional[str]:
    session = auth_service.session_for(db, request.cookies.get(COOKIE))
    return session.user_id if session else None


@router.get("")
@router.get("/")
async def list_projects(status: Optional[str] = "active", include_memes: bool = False,
                        db: Session = Depends(get_db)):
    if status not in (None, "", "all") and status not in project_service.STATUSES:
        raise HTTPException(400, "Invalid status")
    return project_service.list_projects(db, None if status in (None, "", "all") else status, include_memes)


@router.post("")
@router.post("/")
async def create_project(body: ProjectIn, request: Request, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "name is required")
    project = project_service.create(db, name, body.language, body.color, _owner_id(request, db))
    return project_service.detail(db, project)


@router.get("/{project_id}")
async def get_project(project_id: str, db: Session = Depends(get_db)):
    return project_service.detail(db, _get(db, project_id))


@router.patch("/{project_id}")
async def patch_project(project_id: str, body: ProjectPatch, db: Session = Depends(get_db)):
    project = _get(db, project_id)
    fields = body.model_dump(exclude_unset=True)
    if "name" in fields and not (fields["name"] or "").strip():
        raise HTTPException(400, "name cannot be empty")
    if "status" in fields and fields["status"] not in project_service.STATUSES:
        raise HTTPException(400, "Invalid status")
    project = project_service.update(db, project, fields)
    return project_service.detail(db, project)


@router.delete("/{project_id}")
async def delete_project(project_id: str, confirm: str = "", db: Session = Depends(get_db)):
    """Typed confirmation (Q2): `confirm` must equal the project name."""
    project = _get(db, project_id)
    if confirm.strip() != project.name:
        raise HTTPException(400, "Confirmation does not match the project name")
    freed = await asyncio.to_thread(project_service.delete, db, project)
    return {"ok": True, "freed_bytes": freed}


@router.put("/{project_id}/cast")
async def put_cast(project_id: str, body: CastIn, db: Session = Depends(get_db)):
    """Merge: only the roles sent change."""
    return project_service.update_cast(db, _get(db, project_id), body.cast)


@router.post("/{project_id}/sources/pick")
async def pick_source(project_id: str, db: Session = Depends(get_db)):
    _get(db, project_id)
    path = await asyncio.to_thread(open_video_dialog)
    if not path:
        return {"cancelled": True}
    if not os.path.isfile(path):
        raise HTTPException(400, f"File not found: {path}")
    streams = await asyncio.to_thread(probe_streams, path)
    src = source_service.create(db, path, os.path.basename(path), project_id=project_id, streams=streams)
    return source_service.to_dict(src, 0)


@router.post("/{project_id}/sources")
async def add_url_source(project_id: str, body: SourceIn, db: Session = Depends(get_db)):
    _get(db, project_id)
    if not body.path.startswith("http"):
        raise HTTPException(400, "Use /sources/pick for local files")
    src = source_service.create(db, body.path, body.filename, project_id=project_id)
    return source_service.to_dict(src, 0)
