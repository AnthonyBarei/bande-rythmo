"""Custom font upload (TTF / OTF) for the bande rythmo.

Uploaded fonts live in uploads/fonts/, indexed by uploads/fonts/_registry.json.
The BR renderer resolves an uploaded font by id via _resolve_font_path; the web
preview loads it through the /uploads-fonts static mount + an @font-face.
"""
import json
import os
import re
import uuid

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from PIL import ImageFont

router = APIRouter()

FONTS_DIR = "uploads/fonts"
REGISTRY = os.path.join(FONTS_DIR, "_registry.json")
ALLOWED_EXT = {".ttf", ".otf"}
MAX_BYTES = 12 * 1024 * 1024  # 12 MB

os.makedirs(FONTS_DIR, exist_ok=True)


def _load_registry() -> list:
    if not os.path.isfile(REGISTRY):
        return []
    try:
        with open(REGISTRY, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (ValueError, OSError):
        return []


def _save_registry(items: list):
    with open(REGISTRY, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def _slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    return s or "font"


def resolve_font_path(font_id: str):
    """Return the on-disk path for an uploaded font id, or None.
    Called by br_renderer when the picker id isn't a bundled font."""
    for it in _load_registry():
        if it.get("id") == font_id:
            p = os.path.join(FONTS_DIR, it["file"])
            return p if os.path.isfile(p) else None
    return None


@router.get("")
@router.get("/")
async def list_fonts():
    """Uploaded fonts only (bundled fonts are known to the frontend picker)."""
    return _load_registry()


@router.post("/upload")
async def upload_font(file: UploadFile = File(...), name: str = Form(None)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, "Format non supporté — TTF ou OTF uniquement")
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "Fichier trop volumineux (max 12 Mo)")
    if not raw:
        raise HTTPException(400, "Fichier vide")

    display = (name or os.path.splitext(file.filename or "Police")[0]).strip() or "Police"
    font_id = f"u-{_slug(display)}-{uuid.uuid4().hex[:6]}"
    fname = f"{font_id}{ext}"
    path = os.path.join(FONTS_DIR, fname)
    with open(path, "wb") as f:
        f.write(raw)

    # Validate it actually loads as a font; reject + clean up otherwise.
    try:
        ImageFont.truetype(path, 32)
    except Exception:
        try:
            os.remove(path)
        except OSError:
            pass
        raise HTTPException(422, "Police invalide — impossible de charger le fichier")

    reg = _load_registry()
    entry = {"id": font_id, "name": display, "file": fname, "ext": ext.lstrip(".")}
    reg.insert(0, entry)
    _save_registry(reg)
    return entry


@router.delete("/{font_id}")
async def delete_font(font_id: str):
    reg = _load_registry()
    entry = next((it for it in reg if it.get("id") == font_id), None)
    if not entry:
        raise HTTPException(404, "Police introuvable")
    try:
        os.remove(os.path.join(FONTS_DIR, entry["file"]))
    except OSError:
        pass
    _save_registry([it for it in reg if it.get("id") != font_id])
    return {"ok": True}
