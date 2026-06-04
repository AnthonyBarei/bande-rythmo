"""Auto-translation route — LibreTranslate / DeepL via translate_service."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from services.translate_service import translate, provider_status, TranslationUnavailable

router = APIRouter()


class TranslateRequest(BaseModel):
    texts: List[str]
    target: str
    source: str = "auto"


@router.get("/status")
async def status():
    """Whether a translation provider is configured (UI gates the feature)."""
    return provider_status()


@router.post("/")
@router.post("")
async def do_translate(req: TranslateRequest):
    if not req.texts:
        return {"translations": []}
    try:
        import asyncio
        out = await asyncio.to_thread(translate, req.texts, req.target, req.source)
        return {"translations": out}
    except TranslationUnavailable as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(502, f"Échec de la traduction : {e}")
