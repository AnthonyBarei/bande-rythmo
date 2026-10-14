"""Capture app screens at exact 1440x900 via Chrome DevTools Protocol.

Usage: shoot.py <out_dir> [--extras]
  --extras  also capture view-only states (Atelier GIF / Audio modes,
            Activité with the TERMINÉ list expanded). Creates no data.
"""
import argparse
import asyncio
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
APP = "http://localhost:5173/"
PORT = 9333
CLIP = "299d22a2-cb49-4d29-9d4b-eb1355c88d88"
W, H = 1440, 900
INSPECTOR_W = 392

_args = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
_args.add_argument("out_dir")
_args.add_argument("--extras", action="store_true")
ARGS = _args.parse_args()
OUT = ARGS.out_dir


class CDP:
    def __init__(self, ws):
        self.ws, self.n = ws, 0

    async def call(self, method, **params):
        self.n += 1
        mid = self.n
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get("id") == mid:
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

    async def hover(self, x, y):
        await self.call("Input.dispatchMouseEvent", type="mouseMoved", x=x, y=y)

    async def key(self, key, code, vk, modifiers=0, text=None):
        base = dict(key=key, code=code, windowsVirtualKeyCode=vk, modifiers=modifiers)
        await self.call("Input.dispatchKeyEvent", type="rawKeyDown", **base)
        if text:
            await self.call("Input.dispatchKeyEvent", type="char", text=text, **base)
        await self.call("Input.dispatchKeyEvent", type="keyUp", **base)


async def go(cdp, section, clip=None, wait=2.5):
    nav = {"section": section}
    if clip:
        nav["clipId"] = clip
    await cdp.js(f"localStorage.setItem('br-coachmark-seen', '1'); sessionStorage.setItem('br-nav', {json.dumps(json.dumps(nav))}); location.reload(); 1")
    await asyncio.sleep(wait)
    await cdp.call("Input.dispatchMouseEvent", type="mouseMoved", x=W - 2, y=H - 2)
    await asyncio.sleep(0.3)


CLICK = """(async () => {
  const t = %s;
  const els = [...document.querySelectorAll('button,[role=tab],[role=button]')];
  const el = els.find(b => b.innerText.trim() === t) || els.find(b => b.innerText.trim().startsWith(t)) || els.find(b => b.title === t);
  if (!el) return false;
  el.click();
  await new Promise(r => setTimeout(r, 500));
  return true;
})()"""

# Inspector tabs: [role=tab] if present, else buttons inside the fixed-width
# inspector column on the right edge (the band toolbar also has a "Détection"
# button, which a page-wide text match would hit first).
CLICK_INSPECTOR_TAB = """(async () => {
  const t = %s, minX = window.innerWidth - %d;
  const inInspector = b => b.getBoundingClientRect().left >= minX;
  const tabs = [...document.querySelectorAll('[role=tab]')].filter(inInspector);
  const pool = tabs.length ? tabs : [...document.querySelectorAll('button')].filter(inInspector);
  const el = pool.find(b => b.innerText.trim() === t);
  if (!el) return false;
  el.click();
  await new Promise(r => setTimeout(r, 500));
  return true;
})()"""

RECT = """(() => {
  const t = %s;
  const el = [...document.querySelectorAll('*')].find(e => e.children.length < 8 && e.innerText && e.innerText.trim().startsWith(t) && e.getBoundingClientRect().width > 200);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 3];
})()"""


async def click(cdp, text):
    ok = await cdp.js(CLICK % json.dumps(text))
    if not ok:
        print("  ! button not found:", text)
    await asyncio.sleep(0.4)
    return ok


async def click_tab(cdp, text):
    ok = await cdp.js(CLICK_INSPECTOR_TAB % (json.dumps(text), INSPECTOR_W))
    if not ok:
        print("  ! inspector tab not found:", text)
    await asyncio.sleep(0.4)
    return ok


async def run():
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?{APP}", method="PUT")
    target = json.loads(urllib.request.urlopen(req).read())
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=50_000_000) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")
        await cdp.call("Runtime.enable")
        await cdp.call("Emulation.setDeviceMetricsOverride", width=W, height=H, deviceScaleFactor=1, mobile=False)
        await asyncio.sleep(2)

        await go(cdp, "clips")
        await cdp.shot("library/01-library.png")
        pos = await cdp.js(RECT % json.dumps("je vois"))
        if pos:
            await cdp.hover(*pos)
            await asyncio.sleep(0.6)
            await cdp.shot("library/03-library-card-hover.png")

        await go(cdp, "import")
        await cdp.shot("import/01-import-empty.png")
        if await click(cdp, "URL / Stream"):
            await cdp.js("document.querySelector('input[placeholder^=\"https://\"]').focus(); 1")
            await cdp.call("Input.insertText", text=f"{APP}segments/{CLIP}.mp4")
            await click(cdp, "Charger")
            await asyncio.sleep(3)
            await cdp.call("Input.dispatchMouseEvent", type="mouseMoved", x=W - 2, y=H - 2)
            await cdp.shot("import/01-import.png")

        await go(cdp, "dub", CLIP, wait=4)
        await cdp.shot("editor/01-editor.png")
        for i, tab in enumerate(["Voix", "Détection", "Boucles", "Lexique"], start=5):
            if await click_tab(cdp, tab):
                await cdp.shot(f"editor/0{i}-tab-{tab.lower().replace('é', 'e')}.png")
        await click_tab(cdp, "Répliques")
        if await click(cdp, "Sous-titres"):
            await cdp.shot("editor/09-menu-sous-titres.png")
            await cdp.key("Escape", "Escape", 27)
        if await click(cdp, "Resp."):
            await cdp.shot("editor/10-menu-respirations.png")
            await cdp.key("Escape", "Escape", 27)
        await cdp.js("document.activeElement && document.activeElement.blur(); 1")
        await cdp.key("e", "KeyE", 69, text="e")
        await asyncio.sleep(1.2)
        await cdp.shot("export/01-export.png")
        await cdp.key("Escape", "Escape", 27)

        await go(cdp, "record", CLIP, wait=3)
        await cdp.shot("studio/01-studio.png")

        await go(cdp, "memes")
        await cdp.shot("atelier/01-atelier.png")
        if ARGS.extras:
            for i, mode in enumerate(["GIF", "Audio"], start=2):
                if await click(cdp, mode):
                    await cdp.shot(f"atelier/0{i}-atelier-{mode.lower()}.png")
            await click(cdp, "Image")

        await go(cdp, "activity")
        await cdp.shot("activity/01-activity.png")
        if ARGS.extras and await click(cdp, "Voir les"):
            await cdp.shot("activity/02-activity-expanded.png")

        await go(cdp, "settings")
        await cdp.shot("settings/01-settings.png")

        await go(cdp, "clips")
        await cdp.key("k", "KeyK", 75, modifiers=2)
        await asyncio.sleep(0.8)
        await cdp.shot("shell/02-command-palette.png")
        await cdp.key("Escape", "Escape", 27)
        await asyncio.sleep(0.3)
        await cdp.js("window.dispatchEvent(new KeyboardEvent('keydown', {key: '?', bubbles: true})); 1")
        await asyncio.sleep(0.8)
        await cdp.shot("shell/03-shortcuts-overlay.png")

        errors = await cdp.js("window.__errs || []")
        print("done", errors)


def main():
    profile = tempfile.mkdtemp(prefix="br-shot-")
    proc = subprocess.Popen([
        CHROME, "--headless=new", f"--remote-debugging-port={PORT}", f"--user-data-dir={profile}",
        "--no-first-run", "--no-default-browser-check",
        "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--hide-scrollbars", f"--window-size={W},{H}",
        "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=1)
                break
            except OSError:
                time.sleep(0.2)
        asyncio.run(run())
    finally:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == "__main__":
    main()
