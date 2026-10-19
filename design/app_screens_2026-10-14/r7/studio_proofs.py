"""Studio R7 proofs — écouter sur l'image, ← / → navigation, A/B Tab swap, completion toast (CDP port 9601).

Usage: studio_proofs.py <out_dir>
/api/takes is mocked in this headless tab only: GET returns an in-memory list
(3 takes on réplique 2, audio = existing backend/takes/*.wav served read-only),
POST /api/takes/ appends a fake take, PUT /best and DELETE edit the list.
Every other non-GET /api/ request is answered 503 — nothing reaches the backend.
"""
import asyncio
import base64
import glob
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import wave

import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
APP = "http://localhost:5173/"
PORT = 9601
CLIP = "299d22a2-cb49-4d29-9d4b-eb1355c88d88"
REPO = r"C:\Users\Antho\Documents\code\bande-rythmo-app"
W, H = 1440, 900
OUT = sys.argv[1]
sys.stdout.reconfigure(encoding="utf-8")

FILES = sorted(glob.glob(os.path.join(REPO, "backend", "takes", "*.wav")))


def wav_take(i, sub_idx, best=False, dur=None):
    path = FILES[i % len(FILES)]
    with wave.open(path) as w:
        d = round(w.getnframes() / w.getframerate(), 2)
    return {"id": 900001 + i, "clip_id": CLIP, "character": "Red", "subtitle_index": sub_idx,
            "audio_url": "/takes/" + os.path.basename(path), "duration": dur or d, "label": "",
            "best": best, "created_at": f"2026-10-19T10:0{i % 10}:00"}


TAKES = [wav_take(i, 1, best=(i == 1)) for i in range(3)]
# Dale — every réplique validated except index 4 (réplique 5), which holds one
# take waiting for Valider.
DALE = [2, 4, 6, 9, 13, 17, 19, 22, 24, 26, 29, 31, 34, 36, 38, 39, 41, 43, 46, 47, 49]
for k, idx in enumerate(DALE):
    TAKES.append(wav_take(10 + k, idx, best=(idx != 4)))
STATE = {"sub_idx": 0, "posted": []}


class CDP:
    def __init__(self, ws):
        self.ws, self.n = ws, 0
        self.pending = {}
        self.reader = asyncio.create_task(self._read())

    async def _read(self):
        async for raw in self.ws:
            msg = json.loads(raw)
            if "id" in msg:
                fut = self.pending.pop(msg["id"], None)
                if fut and not fut.done():
                    fut.set_result(msg)
            elif msg.get("method") == "Fetch.requestPaused":
                asyncio.create_task(self._paused(msg["params"]))

    async def fulfil(self, rid, status, body):
        await self.call("Fetch.fulfillRequest", requestId=rid, responseCode=status,
                        responseHeaders=[{"name": "Content-Type", "value": "application/json"}],
                        body=base64.b64encode(json.dumps(body).encode()).decode())

    async def _paused(self, p):
        rid, req = p["requestId"], p["request"]
        method, path = req["method"], urllib.parse.urlparse(req["url"]).path
        if path == f"/api/takes/{CLIP}" and method == "GET":
            await self.fulfil(rid, 200, TAKES)
        elif path == "/api/takes/" and method == "POST":
            m = re.search(r'name="subtitle_index"\r\n\r\n(\d+)', req.get("postData") or "")
            idx = int(m.group(1)) if m else STATE["sub_idx"]
            d = re.search(r'name="duration"\r\n\r\n([\d.]+)', req.get("postData") or "")
            take = wav_take(len(TAKES), idx, dur=float(d.group(1)) if d else None)
            TAKES.append(take)
            STATE["posted"].append({"subtitle_index": idx, "duration": take["duration"], "postData_seen": bool(req.get("postData"))})
            print("  mock POST /api/takes/ ->", take["id"], "réplique", idx + 1)
            await self.fulfil(rid, 200, take)
        elif re.fullmatch(r"/api/takes/\d+/best", path) and method == "PUT":
            tid = int(path.split("/")[3])
            tk = next(t for t in TAKES if t["id"] == tid)
            for t in TAKES:
                if t["subtitle_index"] == tk["subtitle_index"]:
                    t["best"] = t["id"] == tid
            print("  mock PUT best", tid)
            await self.fulfil(rid, 200, tk)
        elif re.fullmatch(r"/api/takes/\d+", path) and method == "DELETE":
            tid = int(path.split("/")[3])
            TAKES[:] = [t for t in TAKES if t["id"] != tid]
            await self.fulfil(rid, 200, {"ok": True})
        elif method != "GET":
            print("  blocked", method, path)
            await self.fulfil(rid, 503, {"detail": "bloqué par studio_proofs.py"})
        else:
            await self.call("Fetch.continueRequest", requestId=rid)

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
            raise RuntimeError(json.dumps(r["exceptionDetails"])[:500])
        return r.get("result", {}).get("value")

    async def shot(self, rel):
        path = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        r = await self.call("Page.captureScreenshot", format="png", captureBeyondViewport=False)
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        print("saved", rel)

    async def key(self, key, code, vk, text=None, modifiers=0):
        base = dict(key=key, code=code, windowsVirtualKeyCode=vk, modifiers=modifiers)
        await self.call("Input.dispatchKeyEvent", type="rawKeyDown", **base)
        if text:
            await self.call("Input.dispatchKeyEvent", type="char", text=text, **base)
        await self.call("Input.dispatchKeyEvent", type="keyUp", **base)

    async def click_xy(self, x, y):
        for kind in ("mouseMoved", "mousePressed", "mouseReleased"):
            extra = {"button": "left", "clickCount": 1} if kind != "mouseMoved" else {}
            await self.call("Input.dispatchMouseEvent", type=kind, x=x, y=y, **extra)


async def park(cdp):
    await cdp.call("Input.dispatchMouseEvent", type="mouseMoved", x=W - 2, y=H - 2)
    await asyncio.sleep(0.2)


async def center_of(cdp, expr):
    r = await cdp.js(f"(() => {{ const el = {expr}; if (!el) return null; const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }})()")
    if not r:
        raise RuntimeError("element not found: " + expr)
    return r


TAKE_CARD = "[...document.querySelectorAll('div')].find(d => d.style.borderRadius && d.innerText && d.innerText.trim().startsWith(%s) && d.style.cursor === 'pointer')"
STATE_JS = """(() => {
  const v = document.querySelector('video');
  const card = [...document.querySelectorAll('div')].find(d => d.style.background === 'rgb(0, 0, 0)' && d.style.borderRadius);
  return { t: v && v.currentTime, paused: v && v.paused, muted: v && v.muted,
           border: card && getComputedStyle(card).borderTopColor,
           status: [...document.querySelectorAll('div')].filter(d => d.style.fontFamily && d.innerText && /Pré-roll ·|Prise en cours|Appuyer pour|Prise annulée/.test(d.innerText) && d.children.length < 3).map(d => d.innerText).slice(-1)[0],
           validerY: (() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Valider la prise sélectionnée'); return b ? Math.round(b.getBoundingClientRect().top) : null })(),
           lastCardBottom: (() => { const c = [...document.querySelectorAll('div')].filter(d => d.style.cursor === 'pointer' && d.style.borderRadius && /^Prise \\d/.test((d.innerText || '').trim())); return c.length ? Math.round(c[c.length - 1].getBoundingClientRect().bottom) : null })(),
           ab: [...document.querySelectorAll('span,div')].some(e => e.children.length === 0 && e.innerText === 'A/B comparer'),
           banner: [...document.querySelectorAll('div')].some(d => d.children.length === 0 && /annulée/.test(d.innerText || '') && !d.style.fontFamily && d.style.background),
           band: (() => { const c = document.querySelectorAll('canvas'); return [...c].map(x => [x.width, x.height, x.title]) })() }
})()"""


PROBE = r"""(() => {
  const v = document.querySelector('video');
  const auds = [...document.querySelectorAll('audio')];
  const ov = [...document.querySelectorAll('span')].find(e => /^▶ PRISE/.test(e.innerText || ''));
  const strip = [...document.querySelectorAll('span')].find(e => /^Prises\s/.test(e.innerText || ''));
  const toast = [...document.querySelectorAll('span')].find(e => /toutes les répliques validées/.test(e.innerText || ''));
  return { t: v && +v.currentTime.toFixed(2), paused: v && v.paused, vol: v && v.volume, muted: v && v.muted,
           audio: auds.map(a => ({ src: (a.src || '').split('/').pop().slice(0, 8), paused: a.paused, t: +a.currentTime.toFixed(2) })),
           overlay: ov && ov.parentElement.innerText.replace(/\n/g, ' '), progress: strip && strip.innerText,
           toast: toast && toast.parentElement.innerText.replace(/\n/g, ' | '),
           rowOverflow: [...document.querySelectorAll('div')].filter(d => d.style.cursor === 'pointer' && d.style.borderRadius && /^Prise \d/.test((d.innerText || '').trim()))
             .map(c => { const row = c.firstElementChild; return row.scrollWidth - row.clientWidth }) }
})()"""
SUB_JS = r"(() => { const h = [...document.querySelectorAll('div,span,p')].find(e => e.children.length === 0 && /réplique \d+ \/ \d+/.test(e.innerText || '')); return h && h.innerText })()"


def card_btn(label, title):
    return ("(() => { const card = " + (TAKE_CARD % json.dumps(label)) + "; const b = [...card.querySelectorAll('button')].find(b => b.title === "
            + json.dumps(title) + " || (b.parentElement && b.parentElement.title === " + json.dumps(title)
            + ")); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] })()")


async def run():
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?about:blank", method="PUT")
    target = json.loads(urllib.request.urlopen(req).read())
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=80_000_000) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")
        await cdp.call("Runtime.enable")
        await cdp.call("Fetch.enable", patterns=[{"urlPattern": "*/api/*", "requestStage": "Request"}])
        await cdp.call("Emulation.setDeviceMetricsOverride", width=W, height=H, deviceScaleFactor=1, mobile=False)
        await cdp.call("Page.navigate", url=APP)
        await asyncio.sleep(2)
        nav = {"section": "record", "clipId": CLIP}
        await cdp.js(f"localStorage.setItem('br-coachmark-seen', '1'); sessionStorage.setItem('br-nav', {json.dumps(json.dumps(nav))}); location.reload(); 1")
        await asyncio.sleep(5)
        await cdp.js("window.__errs = []; window.addEventListener('error', e => window.__errs.push(String(e.message))); 1")
        await park(cdp)
        print("start", await cdp.js(SUB_JS), await cdp.js(PROBE))

        # → (same character): réplique 1 → 2 (Red)
        await cdp.key("ArrowRight", "ArrowRight", 39)
        await asyncio.sleep(1.0)
        print("→", await cdp.js(SUB_JS), await cdp.js(PROBE))

        # A — écouter sur l'image (Prise 1)
        await cdp.click_xy(*(await cdp.js(card_btn("Prise 1", "Écouter sur l’image"))))
        await asyncio.sleep(0.9)
        await park(cdp)
        print("context play", await cdp.js(PROBE))
        await cdp.shot("studio/09-studio-context-play.png")
        await cdp.key("Escape", "Escape", 27)
        await asyncio.sleep(0.4)
        print("after Esc", await cdp.js(PROBE))

        # B — → next Red line (réplique 2 → 4), capture mid-slide
        await cdp.key("ArrowRight", "ArrowRight", 39)
        await asyncio.sleep(0.09)
        await cdp.shot("studio/10-studio-nav-next.png")
        await asyncio.sleep(0.8)
        print("→", await cdp.js(SUB_JS), await cdp.js(PROBE))
        await cdp.key("ArrowLeft", "ArrowLeft", 37, modifiers=1)
        await asyncio.sleep(0.6)
        print("Alt+←", await cdp.js(SUB_JS), await cdp.js(PROBE))
        await cdp.key("ArrowLeft", "ArrowLeft", 37)
        await asyncio.sleep(0.6)
        print("← (Dale has none before)", await cdp.js(SUB_JS))
        await cdp.key("ArrowLeft", "ArrowLeft", 37, modifiers=1)
        await asyncio.sleep(0.8)
        print("Alt+←", await cdp.js(SUB_JS), await cdp.js(PROBE))

        # C — A/B: chip, A = Prise 1, B = Prise 3, play A, Tab
        await cdp.js("[...document.querySelectorAll('span,div')].find(e => e.children.length === 0 && e.innerText === 'A/B comparer').click(); 1")
        await asyncio.sleep(0.3)
        await cdp.click_xy(*(await cdp.js(card_btn("Prise 1", "Comparer A/B — 1er clic A, 2e clic B"))))
        await asyncio.sleep(0.2)
        await cdp.click_xy(*(await cdp.js(card_btn("Prise 3", "Comparer A/B — 1er clic A, 2e clic B"))))
        await asyncio.sleep(0.3)
        await cdp.js("[...document.querySelectorAll('button')].find(b => b.title === 'Écouter A').click(); 1")
        await asyncio.sleep(0.8)
        print("A playing", await cdp.js(PROBE))
        await cdp.js("document.activeElement && document.activeElement.blur(); 1")
        await cdp.key("Tab", "Tab", 9)
        await asyncio.sleep(0.12)
        print("after Tab", await cdp.js(PROBE))
        await asyncio.sleep(0.25)
        await park(cdp)
        await cdp.shot("studio/11-studio-ab.png")
        await cdp.click_xy(*(await cdp.js(card_btn("Prise 2", "Écouter"))))
        await asyncio.sleep(0.2)
        print("validée take playing in A/B mode", await cdp.js(PROBE))
        await cdp.key("Escape", "Escape", 27)
        await asyncio.sleep(0.3)

        # D — Dale: validate the last open réplique (index 4 = réplique 5)
        await cdp.key("ArrowRight", "ArrowRight", 39, modifiers=1)
        await asyncio.sleep(0.5)
        await cdp.key("ArrowRight", "ArrowRight", 39)
        await asyncio.sleep(0.8)
        print("Dale", await cdp.js(SUB_JS), await cdp.js(PROBE))
        await cdp.js("[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Valider la prise sélectionnée').click(); 1")
        await asyncio.sleep(1.2)
        await park(cdp)
        print("validated", await cdp.js(PROBE))
        await cdp.shot("studio/12-studio-all-validated.png")
        print("console errors", await cdp.js("window.__errs || []"))
        cdp.reader.cancel()


def main():
    profile = tempfile.mkdtemp(prefix="br-shot-r7s-")
    proc = subprocess.Popen([
        CHROME, "--headless=new", f"--remote-debugging-port={PORT}", f"--user-data-dir={profile}",
        "--no-first-run", "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required",
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
