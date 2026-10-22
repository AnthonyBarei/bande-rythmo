"""Médiathèque (Plex / Jellyfin) captures at 1440x900 for Claude Design.

Usage: shoot_mediatheque.py <out_dir> [--app URL] [--port N]

Connect-card states are mocked with CDP Fetch interception (status / probe /
connect answered locally, some held open to freeze a loading state). Library
screens use the real Jellyfin server configured in the backend. Every non-GET
/api/ request is answered locally — nothing is written to the backend — except
POST /api/files/register (in-memory source registry, needed to open an episode).
"""
import argparse
import asyncio
import base64
import json
import os
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request

import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
W, H = 1440, 900

_args = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
_args.add_argument("out_dir")
_args.add_argument("--app", default="http://localhost:5173/")
_args.add_argument("--port", type=int, default=9335)
ARGS = _args.parse_args()
OUT = ARGS.out_dir
APP = ARGS.app if ARGS.app.endswith("/") else ARGS.app + "/"

PLEX_URL = "http://192.168.1.5:32400"
NOT_CONFIGURED = {"connected": False, "configured": False, "url": "http://localhost:8096"}
UNREACHABLE = {"connected": False, "configured": True, "url": PLEX_URL}
HOLD = object()
LIBRARY_HOLD = {}   # {"offset": "96"} holds that /library page open
PASS_THROUGH = {"/api/files/register"}

# path -> body (GET 200), HOLD (never answered until release), or (status, body)
MOCKS = {}
HELD = []


class CDP:
    def __init__(self, ws):
        self.ws, self.n = ws, 0
        self.pending = {}
        self.handlers = {}
        self.reader = asyncio.create_task(self._read())

    async def _read(self):
        async for raw in self.ws:
            msg = json.loads(raw)
            if "id" in msg:
                fut = self.pending.pop(msg["id"], None)
                if fut and not fut.done():
                    fut.set_result(msg)
            elif msg.get("method") in self.handlers:
                asyncio.create_task(self._dispatch(msg["method"], msg.get("params", {})))

    async def _dispatch(self, method, params):
        try:
            await self.handlers[method](params)
        except Exception as e:  # report, keep the shoot going
            print(f"  ! handler {method} failed: {e!r}")

    def on(self, method, handler):
        self.handlers[method] = handler

    async def call(self, method, **params):
        self.n += 1
        mid = self.n
        fut = asyncio.get_running_loop().create_future()
        self.pending[mid] = fut
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        msg = await fut
        if "error" in msg:
            raise RuntimeError(f"{method}: {msg['error']}")
        return msg.get("result", {})

    async def js(self, expr):
        r = await self.call("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"].get("text", "js error") + " :: " + expr[:80])
        return r.get("result", {}).get("value")

    async def shot(self, rel):
        path = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        r = await self.call("Page.captureScreenshot", format="png", captureBeyondViewport=False)
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        print("saved", rel)

    async def key(self, key, code, vk, modifiers=0):
        base = dict(key=key, code=code, windowsVirtualKeyCode=vk, modifiers=modifiers)
        await self.call("Input.dispatchKeyEvent", type="rawKeyDown", **base)
        await self.call("Input.dispatchKeyEvent", type="keyUp", **base)


async def fulfil(cdp, rid, status, body):
    await cdp.call("Fetch.fulfillRequest", requestId=rid, responseCode=status,
                   responseHeaders=[{"name": "Content-Type", "value": "application/json"}],
                   body=base64.b64encode(json.dumps(body).encode()).decode())


async def install_mocks(cdp):
    async def on_paused(p):
        rid, req = p["requestId"], p["request"]
        method, path = req["method"], urllib.parse.urlparse(req["url"]).path
        mock = MOCKS.get(path)
        query = urllib.parse.parse_qs(urllib.parse.urlparse(req["url"]).query)
        if "/library/" in path and LIBRARY_HOLD.get("offset") in query.get("offset", []):
            mock = HOLD
        if mock is HOLD:
            HELD.append(rid)
        elif isinstance(mock, tuple):
            await fulfil(cdp, rid, *mock)
        elif mock is not None:
            await fulfil(cdp, rid, 200, mock)
        elif method != "GET" and path not in PASS_THROUGH:
            print(f"  blocked {method} {path}")
            await fulfil(cdp, rid, 503, {"detail": "bloqué par shoot_mediatheque.py"})
        else:
            await cdp.call("Fetch.continueRequest", requestId=rid)

    cdp.on("Fetch.requestPaused", on_paused)
    await cdp.call("Fetch.enable", patterns=[{"urlPattern": "*/api/*", "requestStage": "Request"}])


async def release(cdp):
    """Answer held requests so a navigation never leaves one dangling."""
    while HELD:
        await fulfil(cdp, HELD.pop(), 503, {"detail": "released"})


CLICK = """(async () => {
  const t = %s;
  const els = [...document.querySelectorAll('button,[role=button]')];
  const el = els.find(b => b.innerText.trim() === t) || els.find(b => b.innerText.trim().startsWith(t)) || els.find(b => b.title === t);
  if (!el) return false;
  el.click();
  await new Promise(r => setTimeout(r, 400));
  return true;
})()"""

WAIT_IMAGES = """(async () => {
  for (let i = 0; i < 60; i++) {
    const imgs = [...document.querySelectorAll('img')].filter(im => im.getBoundingClientRect().top < innerHeight);
    if (imgs.every(im => im.complete)) return imgs.length;
    await new Promise(r => setTimeout(r, 250));
  }
  return -1;
})()"""

WAIT_VIDEO = """(async () => {
  for (let i = 0; i < 60; i++) {
    const v = document.querySelector('video');
    if (v && v.readyState >= 2) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
})()"""


async def click(cdp, text, wait=0.4):
    ok = await cdp.js(CLICK % json.dumps(text))
    if not ok:
        print("  ! button not found:", text)
    await asyncio.sleep(wait)
    return ok


async def settle(cdp, wait=1.0):
    await asyncio.sleep(wait)
    await cdp.js(WAIT_IMAGES)
    await cdp.call("Input.dispatchMouseEvent", type="mouseMoved", x=W - 2, y=H - 2)
    await asyncio.sleep(0.4)


async def open_mediatheque(cdp, provider, wait=1.5):
    await release(cdp)
    nav = json.dumps(json.dumps({"section": "import"}))
    await cdp.js(f"localStorage.setItem('br-coachmark-seen', '1'); localStorage.setItem('br-library-provider', '{provider}'); "
                 f"sessionStorage.setItem('br-nav', {nav}); location.reload(); 1")
    await asyncio.sleep(1.5)
    await click(cdp, "Médiathèque", wait=wait)


async def shoot_connect(cdp):
    # Saved server still being checked — form disabled, spinner.
    MOCKS.update({"/api/plex/status": HOLD, "/api/plex/probe": {"found": False, "url": None}})
    await open_mediatheque(cdp, "plex", wait=0.3)
    await settle(cdp, 0.3)
    await cdp.shot("import/01-connect-checking.png")

    # Saved server unreachable.
    MOCKS["/api/plex/status"] = UNREACHABLE
    await open_mediatheque(cdp, "plex")
    await settle(cdp)
    await cdp.shot("import/02-connect-unreachable.png")

    # Jellyfin never configured, local server detected.
    MOCKS.update({
        "/api/jellyfin/status": NOT_CONFIGURED,
        "/api/jellyfin/probe": {"found": True, "url": "http://127.0.0.1:8096"},
    })
    await open_mediatheque(cdp, "jellyfin")
    await settle(cdp)
    await cdp.shot("import/03-connect-detected.png")

    # Keyboard focus on the key field.
    await cdp.js("document.querySelector('input[type=password]').focus(); 1")
    await cdp.call("Input.insertText", text="0123456789abcdef")
    await cdp.key("Tab", "Tab", 9, modifiers=8)   # shift+Tab -> URL field (focus-visible)
    await cdp.key("Tab", "Tab", 9)                # back to the key field
    await asyncio.sleep(0.3)
    await cdp.shot("import/04-connect-focus.png")

    # Connecting — request held open.
    MOCKS["/api/jellyfin/connect"] = HOLD
    await click(cdp, "Connecter", wait=0.6)
    await cdp.shot("import/05-connect-busy.png")

    # Connect failed.
    await release(cdp)
    await asyncio.sleep(0.2)
    MOCKS["/api/jellyfin/connect"] = (400, {"detail": "Connexion échouée — vérifiez l'URL et la clé API"})
    await click(cdp, "Connecter", wait=0.8)
    await cdp.shot("import/06-connect-error.png")

    for path in ("/api/plex/status", "/api/plex/probe", "/api/jellyfin/status", "/api/jellyfin/probe", "/api/jellyfin/connect"):
        MOCKS.pop(path, None)


async def shoot_library(cdp):
    await open_mediatheque(cdp, "jellyfin", wait=2.5)
    await settle(cdp, 1.5)
    await cdp.shot("import/10-library-films.png")

    await click(cdp, "Séries", wait=2.0)
    await settle(cdp)
    await cdp.shot("import/11-library-series.png")

    await click(cdp, "Ouvrir Arcane", wait=2.0)
    await settle(cdp)
    await cdp.shot("import/12-series-seasons.png")

    await click(cdp, "Ouvrir Saison 1", wait=2.5)
    await settle(cdp, 1.5)
    await cdp.shot("import/13-season-episodes.png")

    await cdp.js("document.querySelector('nav[aria-label=Dossiers] button[title]') && [...document.querySelectorAll('nav[aria-label=Dossiers] button')].find(b => b.textContent === 'Séries').click(); 1")
    await asyncio.sleep(2.0)
    await click(cdp, "Ouvrir 22.11.63", wait=2.5)
    await settle(cdp, 1.5)
    await cdp.shot("import/14-single-season-auto-open.png")

    await click(cdp, "Retour", wait=2.0)
    await cdp.js("document.querySelector('input[placeholder^=Rechercher]').focus(); 1")
    await cdp.call("Input.insertText", text="ar")
    await asyncio.sleep(1.5)
    await settle(cdp)
    await cdp.shot("import/15-search.png")

    await click(cdp, "Ouvrir Arcane", wait=2.0)
    await click(cdp, "Ouvrir Saison 1", wait=2.5)
    await cdp.js("[...document.querySelectorAll('button[title]')].find(b => b.title.startsWith('Importer E01')).click(); 1")
    await asyncio.sleep(2.0)
    await cdp.js(WAIT_VIDEO)
    await cdp.js("const v = document.querySelector('video'); v.currentTime = 600; 1")
    await asyncio.sleep(2.0)
    await settle(cdp, 0.5)
    await cdp.shot("import/16-episode-loaded.png")


HOVER = """(async () => {
  const el = document.querySelector(%s);
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  await new Promise(r => setTimeout(r, 300));
  const r = el.getBoundingClientRect();
  return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 3)];
})()"""


async def hover(cdp, selector, wait=0.7):
    xy = await cdp.js(HOVER % json.dumps(selector))
    if not xy:
        print("  ! hover target not found:", selector)
        return
    await cdp.call("Input.dispatchMouseEvent", type="mouseMoved", x=xy[0], y=xy[1])
    await asyncio.sleep(wait)


async def click_lib(cdp, name, wait=2.0):
    await cdp.js(f"[...document.querySelectorAll('.lib-item')].find(b => b.innerText.startsWith({json.dumps(name)})).click(); 1")
    await asyncio.sleep(wait)


async def scroll_grid_bottom(cdp):
    await cdp.js("(() => { let s = document.querySelector('.lib-card'); while (s && s.scrollHeight <= s.clientHeight + 1) s = s.parentElement; if (s) s.scrollTop = s.scrollHeight; return 1 })()")
    await asyncio.sleep(0.5)


async def shoot_motion(cdp):
    """MEDIATHEQUE.md proofs: hover states, pagination, skeleton."""
    await open_mediatheque(cdp, "jellyfin", wait=2.5)
    await settle(cdp, 1.5)
    await hover(cdp, ".lib-card:nth-child(2)")
    await cdp.shot("import/20-card-hover.png")

    await click_lib(cdp, "Séries")
    await settle(cdp)
    await hover(cdp, '.lib-card[title="Ouvrir Arcane"]')
    await cdp.shot("import/21-folder-hover.png")

    await click(cdp, "Ouvrir Arcane", wait=2.0)
    await click(cdp, "Ouvrir Saison 1", wait=2.5)
    await settle(cdp, 1.5)
    await hover(cdp, ".lib-card:nth-child(3)")
    await cdp.shot("import/22-episode-hover.png")

    await click_lib(cdp, "Films")
    await cdp.js("[...document.querySelectorAll('.lib-pg')].find(b => b.textContent === '1')?.click(); 1")
    await asyncio.sleep(2.0)
    await settle(cdp)
    await scroll_grid_bottom(cdp)
    await settle(cdp, 0.5)
    await cdp.shot("import/23-pagination-p1.png")

    await cdp.js("[...document.querySelectorAll('.lib-pg')].find(b => b.textContent === '2').click(); 1")
    await asyncio.sleep(2.0)
    await cdp.js("[...document.querySelectorAll('.lib-pg')].find(b => b.textContent === '3').click(); 1")
    await asyncio.sleep(2.0)
    await settle(cdp)
    await scroll_grid_bottom(cdp)
    await settle(cdp, 0.5)
    await cdp.shot("import/24-pagination-p3.png")

    # Page 5 held open: the skeleton stays up.
    LIBRARY_HOLD["offset"] = "96"
    await cdp.js("[...document.querySelectorAll('.lib-pg')].find(b => b.textContent === '4').click(); 1")
    await asyncio.sleep(2.0)
    await cdp.js("[...document.querySelectorAll('.lib-pg')].find(b => b.textContent === '5').click(); 1")
    await asyncio.sleep(0.8)
    await cdp.shot("import/25-skeleton.png")
    LIBRARY_HOLD.pop("offset", None)
    await release(cdp)


async def shoot_settings(cdp):
    await release(cdp)
    MOCKS["/api/plex/status"] = UNREACHABLE
    nav = json.dumps(json.dumps({"section": "settings"}))
    await cdp.js(f"sessionStorage.setItem('br-nav', {nav}); location.reload(); 1")
    await asyncio.sleep(2.5)
    await cdp.js("[...document.querySelectorAll('div,span')].find(e => e.textContent.trim() === 'Médiathèques').scrollIntoView({ block: 'start' }); 1")
    await settle(cdp, 0.8)
    await cdp.shot("settings/01-mediatheques.png")
    await click(cdp, "Connecter", wait=0.6)
    await cdp.shot("settings/02-mediatheques-form.png")
    MOCKS.pop("/api/plex/status", None)


async def run():
    req = urllib.request.Request(f"http://127.0.0.1:{ARGS.port}/json/new?about:blank", method="PUT")
    target = json.loads(urllib.request.urlopen(req).read())
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=50_000_000) as ws:
        cdp = CDP(ws)
        cdp.on("Page.javascriptDialogOpening", lambda p: cdp.call("Page.handleJavaScriptDialog", accept=False))
        await cdp.call("Page.enable")
        await cdp.call("Runtime.enable")
        await cdp.call("Emulation.setDeviceMetricsOverride", width=W, height=H, deviceScaleFactor=1, mobile=False)
        await install_mocks(cdp)
        await cdp.call("Page.navigate", url=APP)
        await asyncio.sleep(2)

        await shoot_connect(cdp)
        await shoot_library(cdp)
        await shoot_motion(cdp)
        await shoot_settings(cdp)
        await release(cdp)
        print("done")
        cdp.reader.cancel()


def main():
    profile = tempfile.mkdtemp(prefix="br-shot-")
    proc = subprocess.Popen([
        CHROME, "--headless=new", f"--remote-debugging-port={ARGS.port}", f"--user-data-dir={profile}",
        "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required",
        f"--window-size={W},{H}", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{ARGS.port}/json/version", timeout=1)
                break
            except OSError:
                time.sleep(0.2)
        asyncio.run(run())
    finally:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == "__main__":
    main()
