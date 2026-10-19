"""Éditeur R3 proof captures (copy of design/app_screens_2026-10-14/shoot.py, PORT 9371).

Usage: shoot_editor.py <out_dir>
PUT /boucles is intercepted with CDP Fetch and fulfilled locally (200) — the
real clip's boucles are never written.
"""
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
BACKEND = "http://127.0.0.1:8000"
PORT = 9371
CLIP = "299d22a2-cb49-4d29-9d4b-eb1355c88d88"
W, H = 1440, 900
OUT = sys.argv[1]
sys.stdout.reconfigure(encoding="utf-8")
INTERCEPTED = []


def clip_json():
    return json.loads(urllib.request.urlopen(f"{BACKEND}/api/clips/{CLIP}").read())


class CDP:
    def __init__(self, ws):
        self.ws, self.n = ws, 0
        self.clip = clip_json()

    async def _event(self, msg):
        if msg.get("method") != "Fetch.requestPaused":
            return
        p = msg["params"]
        req = p["request"]
        body = dict(self.clip)
        try:
            body["boucles"] = json.loads(req.get("postData") or "{}").get("boucles", [])
        except ValueError:
            pass
        INTERCEPTED.append((req["method"], req["url"], body.get("boucles")))
        self.n += 1
        await self.ws.send(json.dumps({"id": self.n, "method": "Fetch.fulfillRequest", "params": {
            "requestId": p["requestId"], "responseCode": 200,
            "responseHeaders": [{"name": "Content-Type", "value": "application/json"}],
            "body": base64.b64encode(json.dumps(body).encode()).decode(),
        }}))

    async def call(self, method, **params):
        self.n += 1
        mid = self.n
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            msg = json.loads(await self.ws.recv())
            if "method" in msg:
                await self._event(msg)
                continue
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

    async def mouse(self, kind, x, y, buttons=0):
        extra = {"button": "left", "clickCount": 1} if kind in ("mousePressed", "mouseReleased") else {}
        await self.call("Input.dispatchMouseEvent", type=kind, x=x, y=y, buttons=buttons, **extra)

    async def drag(self, x0, y0, x1, y1, steps=8, release=True):
        await self.mouse("mouseMoved", x0, y0)
        await self.mouse("mousePressed", x0, y0, 1)
        for i in range(1, steps + 1):
            await self.mouse("mouseMoved", x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, 1)
            await asyncio.sleep(0.03)
        if release:
            await self.mouse("mouseReleased", x1, y1)

    async def key(self, key, code, vk, modifiers=0, text=None):
        base = dict(key=key, code=code, windowsVirtualKeyCode=vk, modifiers=modifiers)
        await self.call("Input.dispatchKeyEvent", type="rawKeyDown", **base)
        if text:
            await self.call("Input.dispatchKeyEvent", type="char", text=text, **base)
        await self.call("Input.dispatchKeyEvent", type="keyUp", **base)

    async def wait(self, s):
        # Keep reading the socket so paused Fetch requests get fulfilled.
        end = time.time() + s
        while time.time() < end:
            await self.js("1")
            await asyncio.sleep(0.1)


async def go(cdp, section, clip=None, wait=2.5):
    nav = {"section": section}
    if clip:
        nav["clipId"] = clip
    await cdp.js(f"localStorage.setItem('br-coachmark-seen', '1'); sessionStorage.setItem('br-nav', {json.dumps(json.dumps(nav))}); location.reload(); 1")
    await asyncio.sleep(wait)
    await cdp.mouse("mouseMoved", W - 2, H - 2)
    await asyncio.sleep(0.3)


RECT_TITLE = """(() => {
  const el = [...document.querySelectorAll('[title]')].find(e => e.title.startsWith(%s));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return [r.x, r.y, r.width, r.height];
})()"""

LAYOUT = """(() => {
  const v = document.querySelector('video').parentElement.parentElement.getBoundingClientRect();
  const c = document.querySelector('canvas[title]');
  const cr = c.getBoundingClientRect();
  return { video_h: v.height, band_h: cr.height, band_w: cr.width, canvas_px: [c.width, c.height],
           saved: localStorage.getItem('br.editor.layout') };
})()"""


async def rect(cdp, title):
    return await cdp.js(RECT_TITLE % json.dumps(title))


async def click_text(cdp, t):
    return await cdp.js(f"""(async () => {{
      const el = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === {json.dumps(t)});
      if (!el) return false; el.click(); await new Promise(r => setTimeout(r, 500)); return true; }})()""")


async def seek(cdp, t):
    await cdp.js(f"(async () => {{ const v = document.querySelector('video'); v.pause(); v.currentTime = {t}; await new Promise(r => setTimeout(r, 600)); return v.currentTime }})()")


async def run():
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?{APP}", method="PUT")
    target = json.loads(urllib.request.urlopen(req).read())
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=50_000_000) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")
        await cdp.call("Runtime.enable")
        await cdp.call("Fetch.enable", patterns=[{"urlPattern": "*/boucles*", "requestStage": "Request"}])
        await cdp.call("Emulation.setDeviceMetricsOverride", width=W, height=H, deviceScaleFactor=1, mobile=False)
        await asyncio.sleep(2)

        await go(cdp, "dub", CLIP, wait=4)
        await cdp.shot("editor/01-editor.png")
        print("default", await cdp.js(LAYOUT))

        await seek(cdp, 0.6)
        await cdp.shot("editor/02-editor-pi-offset.png")
        await seek(cdp, 0)

        # Inspector hidden via the \ key
        await cdp.js("document.activeElement && document.activeElement.blur(); 1")
        await cdp.key("\\", "Backslash", 220, text="\\")
        await asyncio.sleep(0.6)
        await cdp.shot("editor/03-editor-inspector-hidden.png")
        print("hidden", await cdp.js(LAYOUT))

        # Band dragged to max via the row splitter (inspector still hidden)
        r = await rect(cdp, "Glisser pour redimensionner la bande")
        x, y = r[0] + r[2] / 2, r[1] + r[3] / 2
        await cdp.drag(x, y, x, 20, steps=10)
        await asyncio.sleep(0.6)
        await cdp.mouse("mouseMoved", W - 2, H - 2)
        await cdp.shot("editor/04-editor-band-max-inspector-hidden.png")
        print("band max", await cdp.js(LAYOUT))

        # Reopen with the strip + widen the inspector via the column splitter
        await cdp.js("[...document.querySelectorAll('button')].find(b => b.title.startsWith('Afficher le panneau')).click(); 1")
        await asyncio.sleep(0.6)
        await cdp.shot("editor/05-editor-band-max.png")
        r = await rect(cdp, "Glisser pour redimensionner le panneau")
        x, y = r[0] + r[2] / 2, r[1] + r[3] / 2
        await cdp.drag(x, y, x - 140, y, steps=8)
        await asyncio.sleep(0.6)
        await cdp.mouse("mouseMoved", W - 2, H - 2)
        await cdp.shot("editor/06-editor-inspector-wide.png")
        print("inspector wide", await cdp.js(LAYOUT))

        # Persistence across reload
        await go(cdp, "dub", CLIP, wait=4)
        print("after reload", await cdp.js(LAYOUT))

        # Reset band height for the nav captures (double-click the splitter)
        r = await rect(cdp, "Glisser pour redimensionner la bande")
        x, y = r[0] + r[2] / 2, r[1] + r[3] / 2
        await cdp.call("Input.dispatchMouseEvent", type="mousePressed", x=x, y=y, button="left", clickCount=1, buttons=1)
        await cdp.call("Input.dispatchMouseEvent", type="mouseReleased", x=x, y=y, button="left", clickCount=1)
        await cdp.call("Input.dispatchMouseEvent", type="mousePressed", x=x, y=y, button="left", clickCount=2, buttons=1)
        await cdp.call("Input.dispatchMouseEvent", type="mouseReleased", x=x, y=y, button="left", clickCount=2)
        await asyncio.sleep(0.5)
        print("after reset", await cdp.js(LAYOUT))

        # Boucles: two at 20s / 35s (split) — PUTs intercepted, never reach the backend
        await cdp.js("[...document.querySelectorAll('button')].filter(b => b.innerText.trim() === 'Boucles').pop().click(); 1")
        await asyncio.sleep(0.4)
        await seek(cdp, 20)
        await click_text(cdp, "Boucle au curseur")
        await seek(cdp, 35)
        await click_text(cdp, "Boucle au curseur")
        await cdp.wait(1.5)
        await seek(cdp, 10)
        await cdp.mouse("mouseMoved", W - 2, H - 2)
        await cdp.shot("editor/07-nav-boucles.png")
        regions = await cdp.js("""[...document.querySelectorAll('[title^="B"]')].filter(e => e.title.includes('glisser pour déplacer')).map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] })""")
        print("regions", regions)
        bx, by, bw, bh = regions[0]
        cx, cy = bx + bw / 2, by + bh / 2 + 8
        await cdp.drag(cx, cy, cx - 120, cy, steps=10, release=False)
        await asyncio.sleep(0.3)
        await cdp.shot("editor/08-nav-boucle-mid-drag.png")
        await cdp.mouse("mouseReleased", cx - 120, cy)
        # Trim right edge of B1
        regions = await cdp.js("""[...document.querySelectorAll('[title^="B"]')].filter(e => e.title.includes('glisser pour déplacer')).map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] })""")
        bx, by, bw, bh = regions[0]
        await cdp.drag(bx + bw - 1, by + bh / 2, bx + bw - 60, by + bh / 2, steps=8, release=False)
        await asyncio.sleep(0.3)
        await cdp.shot("editor/09-nav-boucle-trim-mid-drag.png")
        await cdp.mouse("mouseReleased", bx + bw - 60, by + bh / 2)
        await cdp.wait(1.8)
        print("boucles state", await cdp.js("[...document.querySelectorAll('div')].filter(d => /^B\\d$/.test(d.innerText.trim())).map(d => d.parentElement.innerText.replace(/\\n/g, ' '))"))
        print("video t", await cdp.js("document.querySelector('video').currentTime"))

        # Hover a block → hint in the inspector bottom bar
        await cdp.js("[...document.querySelectorAll('button')].filter(b => b.innerText.trim() === 'Répliques').pop().click(); 1")
        await seek(cdp, 1.0)
        c = await cdp.js("(() => { const r = document.querySelector('canvas[title]').getBoundingClientRect(); return [r.x, r.y, r.width, r.height] })()")
        await cdp.mouse("mouseMoved", c[0] + c[2] * 0.32 + 30, c[1] + 40)
        await asyncio.sleep(0.4)
        await cdp.shot("editor/10-hover-hint-in-inspector.png")

        # Shortcuts overlay
        await cdp.mouse("mouseMoved", W - 2, 30)
        await cdp.js("window.dispatchEvent(new KeyboardEvent('keydown', {key: '?', bubbles: true})); 1")
        await asyncio.sleep(0.8)
        await cdp.shot("editor/11-shortcuts-overlay.png")

        print("intercepted", INTERCEPTED)


def main():
    profile = tempfile.mkdtemp(prefix="br-shot-r3e-")
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
    after = json.loads(urllib.request.urlopen(f"{BACKEND}/api/clips/{CLIP}").read())
    print("backend boucles after run:", after.get("boucles"))


if __name__ == "__main__":
    main()
