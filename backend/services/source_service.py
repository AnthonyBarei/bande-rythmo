"""Project media bin — persisted sources (replaces the in-memory registry)."""
import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Optional
from urllib.parse import parse_qs, unquote, urlparse

from sqlalchemy.orm import Session

from models import Clip, Source
from services.clip_service import _redact_token

log = logging.getLogger("br.sources")

_PLEX_PART = re.compile(r"/library/parts/(\d+)/file")
_JELLYFIN_VIDEO = re.compile(r"/Videos/([^/]+)/stream")


class SourceOffline(Exception):
    """The source can't be read now: file missing or provider not configured."""


def library_ref(url: str) -> Optional[dict]:
    """Plex/Jellyfin stream URL → provider reference (no token)."""
    if not url or not url.startswith("http"):
        return None
    parsed = urlparse(url)
    m = _PLEX_PART.search(parsed.path)
    if m:
        return {"provider": "plex", "part_id": m.group(1)}
    m = _JELLYFIN_VIDEO.search(parsed.path)
    if m:
        media_source_id = (parse_qs(parsed.query).get("mediaSourceId") or [None])[0]
        if media_source_id:
            return {"provider": "jellyfin", "item_id": unquote(m.group(1)),
                    "media_source_id": media_source_id}
    return None


def classify(path: Optional[str]) -> tuple[str, Optional[str], Optional[dict]]:
    """(kind, path to store, library ref) for a local path or URL."""
    ref = library_ref(path or "")
    if ref:
        return "library", None, ref
    if path and path.startswith("http"):
        return "url", _redact_token(path), None
    return "local", path, None


def _configured(service) -> bool:
    cfg = service.load_config()
    return bool(cfg.get("url") and cfg.get("token"))


def _library_url(ref: dict) -> str:
    if ref.get("provider") == "plex":
        from services import plex_service
        if not _configured(plex_service):
            raise SourceOffline("Plex non configuré")
        return plex_service.stream_url(ref["part_id"])
    if ref.get("provider") == "jellyfin":
        from services import jellyfin_service
        if not _configured(jellyfin_service):
            raise SourceOffline("Jellyfin non configuré")
        return jellyfin_service.stream_url(ref["item_id"], ref["media_source_id"])
    raise SourceOffline("Fournisseur inconnu")


def _parse(raw, default=None):
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return default


def resolve_path(src: Source) -> str:
    """Path/URL ffmpeg reads. Raises SourceOffline."""
    if src.kind == "library":
        return _library_url(_parse(src.library, {}))
    if not src.path:
        raise SourceOffline("Chemin inconnu")
    if src.kind == "local" and not os.path.isfile(src.path):
        raise SourceOffline("Fichier introuvable")
    return src.path


def is_online(src: Source) -> bool:
    try:
        resolve_path(src)
        return True
    except SourceOffline:
        return False


def to_dict(src: Source, clip_count: Optional[int] = None) -> dict:
    library = _parse(src.library)
    return {
        "id": src.id,
        "project_id": src.project_id,
        "kind": src.kind,
        "path": src.path,
        "library": library,
        "filename": src.filename,
        "duration": src.duration,
        "fps": src.fps,
        "streams": _parse(src.streams, {"video_streams": [], "audio_streams": []}),
        "video_stream": src.video_stream,
        "audio_stream": src.audio_stream,
        "thumbnail_path": src.thumbnail_path,
        "draft": _parse(src.draft),
        "online": is_online(src),
        "clip_count": clip_count,
        "created_at": src.created_at.isoformat() if src.created_at else None,
        "updated_at": src.updated_at.isoformat() if src.updated_at else None,
    }


def get(db: Session, source_id: str) -> Optional[Source]:
    return db.get(Source, source_id)


def create(db: Session, path: str, filename: str, project_id: Optional[str] = None,
           streams: Optional[dict] = None, source_id: Optional[str] = None) -> Source:
    kind, stored_path, ref = classify(path)
    if kind == "url" and _redact_token(path) != path:
        log.warning("URL source with a token that isn't Plex/Jellyfin — stored redacted")
    src = Source(
        id=source_id or str(uuid.uuid4()),
        project_id=project_id,
        kind=kind,
        path=stored_path,
        library=json.dumps(ref) if ref else None,
        filename=filename or (os.path.basename(path) if kind == "local" else ""),
        duration=(streams or {}).get("duration"),
        streams=json.dumps(streams) if streams else None,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.merge(src)
    db.commit()
    return db.get(Source, src.id)


def update(db: Session, src: Source, **fields) -> Source:
    for key, value in fields.items():
        setattr(src, key, value)
    src.updated_at = datetime.now()
    db.commit()
    db.refresh(src)
    return src


def clip_count(db: Session, source_id: str) -> int:
    return db.query(Clip).filter(Clip.source_id == source_id).count()


def delete(db: Session, src: Source) -> None:
    """Clips survive (source_id → NULL). Remuxed audio is ours to remove;
    the original video never is."""
    db.query(Clip).filter(Clip.source_id == src.id).update({Clip.source_id: None})
    sid = src.id
    db.delete(src)
    db.commit()
    remove_remuxes(sid)


def remove_remuxes(source_id: str) -> None:
    if not os.path.isdir("sources"):
        return
    for name in os.listdir("sources"):
        if name.startswith(f"{source_id}_a"):
            try:
                os.remove(os.path.join("sources", name))
            except OSError:
                log.warning("could not remove remux %s", name, exc_info=True)
