"""Auto-translation — pluggable backend (LibreTranslate self-hosted or DeepL).

Config via env (no hardcoded keys):
- LIBRETRANSLATE_URL  e.g. http://localhost:5000  (+ optional LIBRETRANSLATE_API_KEY)
- DEEPL_API_KEY       DeepL API key (free or pro)

If neither is set, translate() raises TranslationUnavailable so the route can
return a clear 503 instead of silently failing.
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import List


class TranslationUnavailable(Exception):
    pass


def provider_status() -> dict:
    """Which provider is configured (for the UI to enable/disable the feature)."""
    if os.environ.get("DEEPL_API_KEY"):
        return {"available": True, "provider": "deepl"}
    if os.environ.get("LIBRETRANSLATE_URL"):
        return {"available": True, "provider": "libretranslate"}
    return {"available": False, "provider": None}


def _post(url: str, data: dict, headers: dict, timeout: int = 30) -> dict:
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def _translate_deepl(texts: List[str], target: str, source: str) -> List[str]:
    key = os.environ["DEEPL_API_KEY"]
    host = "https://api-free.deepl.com" if key.endswith(":fx") else "https://api.deepl.com"
    data = [("auth_key", key), ("target_lang", target.upper())]
    if source and source != "auto":
        data.append(("source_lang", source.upper()))
    for t in texts:
        data.append(("text", t))
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(f"{host}/v2/translate", data=body, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        out = json.loads(resp.read().decode())
    return [tr["text"] for tr in out.get("translations", [])]


def _translate_libre(texts: List[str], target: str, source: str) -> List[str]:
    base = os.environ["LIBRETRANSLATE_URL"].rstrip("/")
    key = os.environ.get("LIBRETRANSLATE_API_KEY", "")
    results = []
    for t in texts:
        data = {"q": t, "source": source or "auto", "target": target, "format": "text"}
        if key:
            data["api_key"] = key
        out = _post(f"{base}/translate", data,
                    {"Content-Type": "application/x-www-form-urlencoded"})
        results.append(out.get("translatedText", t))
    return results


def translate(texts: List[str], target: str, source: str = "auto") -> List[str]:
    """Translate `texts` → `target` (ISO code). Returns list aligned with input.
    Raises TranslationUnavailable when no provider is configured."""
    if not texts:
        return []
    if os.environ.get("DEEPL_API_KEY"):
        return _translate_deepl(texts, target, source)
    if os.environ.get("LIBRETRANSLATE_URL"):
        return _translate_libre(texts, target, source)
    raise TranslationUnavailable(
        "Aucun service de traduction configuré. Définissez LIBRETRANSLATE_URL "
        "ou DEEPL_API_KEY dans l'environnement du backend."
    )
