import json
import os
from urllib.parse import quote

import httpx

CONFIG_PATH = "jellyfin_config.json"
DEFAULT_URL = "http://localhost:8096"
PROBE_URLS = ["http://127.0.0.1:8096", "http://localhost:8096"]

# Jellyfin 10.12 disables legacy auth (X-Emby-Token, api_key) by default:
# API calls use the MediaBrowser Authorization header, stream URLs `ApiKey`.
_CLIENT = 'MediaBrowser Client="Bande Rythmo", Device="Bande Rythmo", DeviceId="bande-rythmo", Version="1.0"'


def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {"url": DEFAULT_URL, "token": ""}


def save_config(url: str, token: str):
    with open(CONFIG_PATH, "w") as f:
        json.dump({"url": url.rstrip("/"), "token": token}, f)


def _auth_headers(token: str) -> dict:
    return {"Accept": "application/json", "Authorization": f'{_CLIENT}, Token="{token}"'}


def stream_url(item_id: str, media_source_id: str) -> str:
    cfg = load_config()
    return (
        f"{cfg['url']}/Videos/{quote(item_id)}/stream"
        f"?static=true&mediaSourceId={quote(media_source_id)}&ApiKey={cfg['token']}"
    )


def thumb_url(item: dict) -> str | None:
    # Episodes often lack their own poster — fall back to the series one.
    tag = (item.get("ImageTags") or {}).get("Primary")
    image_id = item.get("Id")
    if not tag and item.get("SeriesPrimaryImageTag"):
        tag, image_id = item["SeriesPrimaryImageTag"], item.get("SeriesId")
    if not tag or not image_id:
        return None
    cfg = load_config()
    return f"{cfg['url']}/Items/{quote(image_id)}/Images/Primary?maxHeight=450&tag={quote(tag)}"


async def jellyfin_get(path: str, params: dict | None = None) -> dict:
    cfg = load_config()
    if not cfg["token"]:
        raise ValueError("Jellyfin not configured")
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"{cfg['url']}{path}", params=params or {}, headers=_auth_headers(cfg["token"]))
        res.raise_for_status()
        return res.json()


async def probe_local() -> str | None:
    # /System/Info/Public needs no token — used to detect a local server.
    async with httpx.AsyncClient(timeout=2) as client:
        for url in PROBE_URLS:
            try:
                res = await client.get(f"{url}/System/Info/Public", headers={"Accept": "application/json"})
                if res.status_code == 200:
                    return url
            except Exception:
                continue
    return None


async def test_connection(url: str, token: str) -> str:
    async with httpx.AsyncClient(timeout=5) as client:
        res = await client.get(f"{url.rstrip('/')}/System/Info", headers=_auth_headers(token))
        res.raise_for_status()
        return res.json().get("ServerName") or "Jellyfin Server"
