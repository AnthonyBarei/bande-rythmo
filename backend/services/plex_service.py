import json
import os

import httpx

CONFIG_PATH = "plex_config.json"
DEFAULT_URL = "http://localhost:32400"


def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {"url": DEFAULT_URL, "token": ""}


def save_config(url: str, token: str):
    with open(CONFIG_PATH, "w") as f:
        json.dump({"url": url.rstrip("/"), "token": token}, f)


def get_plex_url(path: str) -> str:
    cfg = load_config()
    return f"{cfg['url']}{path}"


def stream_url(part_id: int | str) -> str:
    cfg = load_config()
    return f"{cfg['url']}/library/parts/{part_id}/file?X-Plex-Token={cfg['token']}"


def thumb_url(thumb_path: str) -> str | None:
    if not thumb_path:
        return None
    cfg = load_config()
    return f"{cfg['url']}{thumb_path}?X-Plex-Token={cfg['token']}"


async def plex_get(path: str, params: dict | None = None) -> dict:
    cfg = load_config()
    if not cfg["token"]:
        raise ValueError("Plex not configured")
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(
            f"{cfg['url']}{path}",
            params={"X-Plex-Token": cfg["token"], **(params or {})},
            headers={"Accept": "application/json"},
        )
        res.raise_for_status()
        return res.json()


async def test_connection(url: str, token: str) -> str:
    async with httpx.AsyncClient(timeout=5) as client:
        res = await client.get(
            f"{url.rstrip('/')}/",
            params={"X-Plex-Token": token},
            headers={"Accept": "application/json"},
        )
        res.raise_for_status()
        data = res.json()
        return data.get("MediaContainer", {}).get("friendlyName", "Plex Server")
