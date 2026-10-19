"""Capture app screens at exact 1440x900 via Chrome DevTools Protocol.

Usage: shoot.py <out_dir> [--app URL] [--port N] [--extras] [--mock-states]
  --app URL      app under test (default http://localhost:5173/)
  --port N       Chrome remote-debugging port (default 9333)
  --extras       also capture view-only states (Atelier GIF / Audio modes,
                 Activité with the TERMINÉ list expanded). Creates no data.
  --mock-states  inside the headless tab only, fake job states with CDP Fetch
                 interception and capture them: a running MP4 export, a running
                 transcription + a failed export (Activité), 3 takes (Studio),
                 a clip picked in the Atelier Select. Every non-GET /api/ request
                 is answered locally (mocked or 503) — nothing reaches the backend.
"""
import argparse
import asyncio
import base64
import glob
import json
import os
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
import wave

import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CLIP = "299d22a2-cb49-4d29-9d4b-eb1355c88d88"
W, H = 1440, 900
INSPECTOR_W = 392
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_args = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
_args.add_argument("out_dir")
_args.add_argument("--app", default="http://localhost:5173/")
_args.add_argument("--port", type=int, default=9333)
_args.add_argument("--extras", action="store_true")
_args.add_argument("--mock-states", action="store_true")
_args.add_argument("--repo", default=REPO, help="repo root (default: three levels above this script)")
_args.add_argument("--import-proof", action="store_true",
                   help="only the Importer proofs, loaded through the local-file flow (see install_local_source)")
ARGS = _args.parse_args()
REPO = ARGS.repo
OUT = ARGS.out_dir
APP = ARGS.app if ARGS.app.endswith("/") else ARGS.app + "/"
PORT = ARGS.port


class CDP:
    """One reader task dispatches command replies and protocol events."""

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

    async def hover(self, x, y):
        await self.call("Input.dispatchMouseEvent", type="mouseMoved", x=x, y=y)

    async def key(self, key, code, vk, modifiers=0, text=None):
        base = dict(key=key, code=code, windowsVirtualKeyCode=vk, modifiers=modifiers)
        await self.call("Input.dispatchKeyEvent", type="rawKeyDown", **base)
        if text:
            await self.call("Input.dispatchKeyEvent", type="char", text=text, **base)
        await self.call("Input.dispatchKeyEvent", type="keyUp", **base)


# ── --mock-states: fake backend answers, scoped to this headless tab ──────────

MOCK = {"states": False}  # GET mocks (takes) only during shoot_mocked
MOCK_MP4 = "mock-mp4-render"
MOCK_TRANSCRIBE = "mock-transcribe"
MOCK_FAIL = "mock-fail"


def _job(job_id, kind, title, status, pct, stage, eta=None, error=None):
    now = time.time()
    return {"id": job_id, "kind": kind, "title": title, "stage": stage, "pct": pct, "eta": eta,
            "status": status, "error": error, "created_at": now - 60, "updated_at": now,
            "elapsed": 60.0, "has_result": False}


MOCK_JOBS = {
    MOCK_MP4: _job(MOCK_MP4, "export-mp4", "Export MP4 + BR", "running", 0.46, "Supersample 4", eta=38),
    MOCK_TRANSCRIBE: _job(MOCK_TRANSCRIBE, "transcribe", "Transcription Whisper", "running", 0.31, "Whisper · segment 12/40", eta=25),
    MOCK_FAIL: _job(MOCK_FAIL, "export-gif", "Export GIF", "error", 0.12, "Encodage", error="[MOCK capture] échec simulé — aucun job réel (ffmpeg exited with code 1)"),
}

# Non-GET endpoints that answer with a fake job id (everything else non-GET → 503).
MOCK_POSTS = {
    "/api/export/mp4-job": MOCK_MP4,
    "/api/transcription/transcribe-job": MOCK_TRANSCRIBE,
    "/api/export/gif-job": MOCK_FAIL,
    "/api/export/dubpack-job": MOCK_FAIL,
}


def mock_takes():
    """3 takes on réplique 1, audio = existing take files (read-only, served by /takes)."""
    files = sorted(glob.glob(os.path.join(REPO, "backend", "takes", "*.wav")))
    if not files:
        print("  ! no backend/takes/*.wav — Studio takes will have no audio")
    takes = []
    for i in range(3):
        url, dur = None, 2.0 + i * 0.3
        if files:
            path = files[i % len(files)]
            url = "/takes/" + os.path.basename(path)
            with wave.open(path) as w:
                dur = round(w.getnframes() / w.getframerate(), 2)
        takes.append({"id": 900001 + i, "clip_id": CLIP, "character": "Red", "subtitle_index": 0,
                      "audio_url": url, "duration": dur, "label": "", "best": i == 1,
                      "created_at": f"2026-10-14T16:0{i}:00"})
    return takes


# ProgressContext opens /api/jobs/{id}/ws first — Fetch can't intercept WebSockets,
# so in this tab only, /api/ sockets close at once and the app falls back to polling.
WS_STUB = """(() => {
  const Real = window.WebSocket;
  function Stub(url, protocols) {
    if (!String(url).includes('/api/')) return new Real(url, protocols);
    const fake = { url: String(url), readyState: 3, send() {}, close() {} };
    setTimeout(() => fake.onclose && fake.onclose({ code: 1006 }), 0);
    return fake;
  }
  Stub.prototype = Real.prototype;
  Object.assign(Stub, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  window.WebSocket = Stub;
})();"""


async def install_mocks(cdp):
    takes_body = mock_takes()

    async def fulfil(rid, status, body):
        await cdp.call("Fetch.fulfillRequest", requestId=rid, responseCode=status,
                       responseHeaders=[{"name": "Content-Type", "value": "application/json"}],
                       body=base64.b64encode(json.dumps(body).encode()).decode())

    async def on_paused(p):
        rid, req = p["requestId"], p["request"]
        method, path = req["method"], urllib.parse.urlparse(req["url"]).path
        if not path.startswith("/api/"):
            await cdp.call("Fetch.continueRequest", requestId=rid)
            return
        if method != "GET":
            job_id = MOCK_POSTS.get(path)
            if job_id:
                print(f"  mock {method} {path} -> job {job_id}")
                await fulfil(rid, 200, {"job_id": job_id})
            else:
                print(f"  blocked {method} {path}")
                await fulfil(rid, 503, {"detail": "bloqué par shoot.py --mock-states"})
            return
        job_id = path[len("/api/jobs/"):] if path.startswith("/api/jobs/") else None
        if job_id in MOCK_JOBS:
            await fulfil(rid, 200, MOCK_JOBS[job_id])
        elif MOCK["states"] and path == f"/api/takes/{CLIP}":
            await fulfil(rid, 200, takes_body)
        else:
            await cdp.call("Fetch.continueRequest", requestId=rid)

    cdp.on("Fetch.requestPaused", on_paused)
    await cdp.call("Fetch.enable", patterns=[{"urlPattern": "*/api/*", "requestStage": "Request"}])
    await cdp.call("Page.addScriptToEvaluateOnNewDocument", source=WS_STUB)


# ── --import-proof: Importer through its LOCAL source flow ────────────────────

LOCAL_SOURCE = {"source_id": "shot-src", "filename": "Pineapple Express.mp4", "path": "Pineapple Express.mp4"}


def probe_streams_readonly(path):
    """Same shape as backend ffmpeg_service.probe_streams, read with ffprobe
    directly (no backend call). Empty lists if ffprobe is unavailable."""
    try:
        out = subprocess.run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", path],
                             capture_output=True, timeout=30).stdout
        data = json.loads(out or b"{}")
    except (OSError, subprocess.SubprocessError, ValueError) as e:
        print("  ! ffprobe failed, empty stream lists:", e)
        return {"video_streams": [], "audio_streams": []}
    video, audio = [], []
    for st in data.get("streams", []):
        tags = st.get("tags", {})
        parts = [st.get("codec_name", "unknown").upper()]
        if st.get("width"):
            parts.append(f"{st['width']}x{st['height']}")
        if tags.get("language"):
            parts.append(tags["language"])
        if tags.get("title"):
            parts.append(tags["title"])
        if st.get("codec_type") == "video":
            video.append({"relative_index": len(video), "label": " · ".join(parts)})
        elif st.get("codec_type") == "audio":
            audio.append({"relative_index": len(audio), "label": " · ".join(parts)})
    return {"video_streams": video, "audio_streams": audio}


async def install_local_source(cdp, segment_id=CLIP, source=LOCAL_SOURCE):
    """Make the Importer's "Fichier local" flow open an existing segment under a
    real file name, scoped to this tab (CDP Fetch):
      - POST /api/files/register is let through: it only adds `source_id` →
        /segments/<segment_id>.mp4 to the backend's in-memory registry (no disk
        write), so /api/files/stream/<source_id> serves the real video;
      - the app's POST /api/files/pick (native file dialog) is answered locally
        with `source` + an ffprobe of the segment, like the real endpoint;
      - every other non-GET /api/ request is answered 503 here.
    Call load_local_source(cdp) afterwards to drive the UI."""
    seg_path = os.path.join(REPO, "backend", "segments", f"{segment_id}.mp4")
    if not os.path.isfile(seg_path):
        print("  ! segment not found (wrong --repo?), empty stream lists:", seg_path)
    pick_body = {**source, **probe_streams_readonly(seg_path)}
    print(f"  pick: {len(pick_body['video_streams'])} video / {len(pick_body['audio_streams'])} audio streams")

    async def fulfil(rid, status, body):
        await cdp.call("Fetch.fulfillRequest", requestId=rid, responseCode=status,
                       responseHeaders=[{"name": "Content-Type", "value": "application/json"}],
                       body=base64.b64encode(json.dumps(body).encode()).decode())

    async def on_paused(p):
        rid, req = p["requestId"], p["request"]
        method, path = req["method"], urllib.parse.urlparse(req["url"]).path
        if method == "GET" or not path.startswith("/api/"):
            await cdp.call("Fetch.continueRequest", requestId=rid)
        elif path == "/api/files/register":
            print(f"  pass {method} {path} (in-memory source registry)")
            await cdp.call("Fetch.continueRequest", requestId=rid)
        elif path == "/api/files/pick":
            print(f"  mock {method} {path} -> {source['filename']}")
            await fulfil(rid, 200, pick_body)
        else:
            print(f"  blocked {method} {path}")
            await fulfil(rid, 503, {"detail": "bloqué par shoot.py --import-proof"})

    cdp.on("Fetch.requestPaused", on_paused)
    await cdp.call("Fetch.enable", patterns=[{"urlPattern": "*/api/*", "requestStage": "Request"}])


REGISTER_SOURCE = """(async () => {
  const q = new URLSearchParams(%s);
  const r = await fetch('/api/files/register?' + q, { method: 'POST' });
  return r.ok;
})()"""

PICK_LOCAL = """(async () => {
  const el = [...document.querySelectorAll('div')].find(d => d.innerText && d.innerText.trim() === 'Cliquez pour choisir un fichier local');
  if (!el) return false;
  el.click();
  return true;
})()"""


async def load_local_source(cdp, segment_id=CLIP, source=LOCAL_SOURCE):
    """Importer → register the source → click the local-file drop zone."""
    await go(cdp, "import")
    ok = await cdp.js(REGISTER_SOURCE % json.dumps({
        "source_id": source["source_id"],
        "stream_url": f"http://127.0.0.1:8000/segments/{segment_id}.mp4",
        "filename": source["filename"],
    }))
    if not ok:
        print("  ! /api/files/register failed")
        return False
    if not await cdp.js(PICK_LOCAL):
        print("  ! local-file drop zone not found")
        return False
    await asyncio.sleep(0.5)
    ready = await cdp.js(WAIT_VIDEO)
    if not ready:
        print("  ! video not ready")
    await asyncio.sleep(0.6)
    return ready


CLICK_TC = """(() => {
  const b = [...document.querySelectorAll('button')].find(x => (x.title || '').startsWith('Aller au timecode'));
  if (!b) return false;
  b.click();
  return true;
})()"""

SEEK_RECT = """(() => {
  const r = document.querySelector('[role=slider][aria-label="Position de lecture"]').getBoundingClientRect();
  return [r.left, r.top, r.width, r.height];
})()"""

PLAYER_STATE = """(() => {
  const txt = sel => [...document.querySelectorAll('button')].filter(b => (b.title || '').startsWith(sel)).map(b => b.innerText.trim());
  const v = document.querySelector('video');
  return {
    tc: txt('Aller au timecode')[0] || null,
    tcInput: document.activeElement && document.activeElement.getAttribute('aria-label') === 'Aller au timecode' ? document.activeElement.value : null,
    inBtn: txt('Marquer IN')[0], outBtn: txt('Marquer OUT')[0],
    t: v && v.currentTime, paused: v && v.paused, rate: v && v.playbackRate, muted: v && v.muted,
    title: [...document.querySelectorAll('div')].find(d => d.previousElementSibling && d.previousElementSibling.innerText === 'IMPORTER')?.innerText,
    pending: [...document.querySelectorAll('span')].find(s => s.innerText === 'CLIPS EN ATTENTE')?.nextElementSibling?.innerText,
  };
})()"""


async def tc_seek(cdp, text):
    if not await cdp.js(CLICK_TC):
        print("  ! timecode button not found")
        return
    await asyncio.sleep(0.25)
    await cdp.call("Input.insertText", text=text)
    await cdp.key("Enter", "Enter", 13)
    await asyncio.sleep(0.4)


async def mouse(cdp, kind, x, y, pressed):
    await cdp.call("Input.dispatchMouseEvent", type=kind, x=x, y=y, button="left",
                   buttons=1 if pressed else 0, clickCount=1 if kind != "mouseMoved" else 0)


async def shoot_import_proof(cdp):
    if not await load_local_source(cdp):
        return
    await park_mouse(cdp)
    print("  state", await cdp.js(PLAYER_STATE))
    await cdp.shot("import/01-import.png")

    # IN at 00:00:12:00 (full SMPTE), OUT at 00:24 (short form) via the field + I / O keys.
    await tc_seek(cdp, "00:00:12:00")
    await cdp.key("i", "KeyI", 73, text="i")
    await tc_seek(cdp, "00:24")
    await cdp.key("o", "KeyO", 79, text="o")
    for _ in range(3):
        await cdp.key(".", "Period", 190, text=".")
    await cdp.key("l", "KeyL", 76, text="l")
    print("  after I/O/./L", await cdp.js(PLAYER_STATE))
    # Space plays (and unlocks the sound overlay), Space again pauses.
    await cdp.key(" ", "Space", 32, text=" ")
    await asyncio.sleep(0.8)
    await cdp.key(" ", "Space", 32, text=" ")
    await asyncio.sleep(0.3)
    print("  after play/pause", await cdp.js(PLAYER_STATE))
    await park_mouse(cdp)
    await cdp.shot("import/04-import-inout.png")

    # Seek bar mid-drag (pressed, never released) + timecode field in edit mode.
    x, y, w, h = await cdp.js(SEEK_RECT)
    track = lambda f: x + 10 + f * (w - 20)  # noqa: E731
    cy = y + h / 2
    await mouse(cdp, "mouseMoved", track(0.30), cy, False)
    await mouse(cdp, "mousePressed", track(0.30), cy, True)
    for f in (0.36, 0.44, 0.52, 0.58):
        await mouse(cdp, "mouseMoved", track(f), cy, True)
        await asyncio.sleep(0.08)
    await cdp.js(CLICK_TC)
    await asyncio.sleep(0.25)
    await cdp.call("Input.insertText", text="00:00:4")
    await mouse(cdp, "mouseMoved", track(0.62), cy, True)
    await asyncio.sleep(0.5)
    print("  mid-drag", await cdp.js(PLAYER_STATE))
    await cdp.shot("import/03-import-player.png")
    await mouse(cdp, "mouseReleased", track(0.62), cy, False)
    await cdp.key("Escape", "Escape", 27)
    await asyncio.sleep(0.3)
    print("  after release", await cdp.js(PLAYER_STATE))


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

# Rail items carry title=<label>; the top bar also has an Activité button.
CLICK_RAIL = """(async () => {
  const t = %s;
  const el = [...document.querySelectorAll('button[title]')].find(b => b.title === t && b.getBoundingClientRect().left < 80);
  if (!el) return false;
  el.click();
  await new Promise(r => setTimeout(r, 800));
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

WAIT_VIDEO = """(async () => {
  for (let i = 0; i < 40; i++) {
    const v = document.querySelector('video');
    if (v && v.readyState >= 2) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
})()"""


async def click(cdp, text):
    ok = await cdp.js(CLICK % json.dumps(text))
    if not ok:
        print("  ! button not found:", text)
    await asyncio.sleep(0.4)
    return ok


async def click_rail(cdp, label):
    ok = await cdp.js(CLICK_RAIL % json.dumps(label))
    if not ok:
        ok = await click(cdp, label)
    await asyncio.sleep(0.6)
    return ok


async def click_tab(cdp, text):
    ok = await cdp.js(CLICK_INSPECTOR_TAB % (json.dumps(text), INSPECTOR_W))
    if not ok:
        print("  ! inspector tab not found:", text)
    await asyncio.sleep(0.4)
    return ok


async def park_mouse(cdp):
    await cdp.call("Input.dispatchMouseEvent", type="mouseMoved", x=W - 2, y=H - 2)
    await asyncio.sleep(0.3)


async def shoot_base(cdp):
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
        await park_mouse(cdp)
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


async def shoot_mocked(cdp):
    MOCK["states"] = True
    # Studio: 3 mocked takes on réplique 1 (one marked best).
    await go(cdp, "record", CLIP, wait=3.5)
    await cdp.shot("studio/02-studio-takes.png")

    # Jobs live in ProgressContext memory: start them, then move between screens
    # through the UI (no reload) so Activité still lists them.
    await go(cdp, "dub", CLIP, wait=4)
    await cdp.js("window.confirm = () => true; 1")
    if await click(cdp, "Sous-titres"):
        await click(cdp, "Transcrire (Whisper)")
    await cdp.js("document.activeElement && document.activeElement.blur(); 1")
    await cdp.key("e", "KeyE", 69, text="e")
    await asyncio.sleep(1.2)
    await click(cdp, "Lancer l'export")
    await asyncio.sleep(2.5)
    await park_mouse(cdp)
    await cdp.shot("export/02-export-rendering.png")
    await cdp.key("Escape", "Escape", 27)
    await asyncio.sleep(0.5)

    # Atelier: pick the clip in the header Select, then a GIF job that fails.
    await click_rail(cdp, "Atelier")
    if await click(cdp, "Choisir un clip"):
        name = await cdp.js(f"fetch('/api/clips/{CLIP}').then(r => r.json()).then(c => c.name)")
        await click(cdp, name)
    await cdp.js(WAIT_VIDEO)
    await asyncio.sleep(0.8)
    await park_mouse(cdp)
    await cdp.shot("atelier/04-atelier-clip.png")
    if await click(cdp, "GIF"):
        await cdp.js(WAIT_VIDEO)
        await asyncio.sleep(0.5)
        await click(cdp, "Créer le GIF")
        await asyncio.sleep(2)

    await click_rail(cdp, "Activité")
    await asyncio.sleep(1.5)
    await park_mouse(cdp)
    await cdp.shot("activity/03-activity-running-failed.png")


async def run():
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?about:blank", method="PUT")
    target = json.loads(urllib.request.urlopen(req).read())
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=50_000_000) as ws:
        cdp = CDP(ws)
        # A stray confirm()/alert() would hang the shoot: accept only when writes are mocked.
        cdp.on("Page.javascriptDialogOpening", lambda p: cdp.call("Page.handleJavaScriptDialog", accept=ARGS.mock_states))
        await cdp.call("Page.enable")
        await cdp.call("Runtime.enable")
        await cdp.call("Emulation.setDeviceMetricsOverride", width=W, height=H, deviceScaleFactor=1, mobile=False)
        if ARGS.import_proof:
            await install_local_source(cdp)
        elif ARGS.mock_states:
            await install_mocks(cdp)
        await cdp.call("Page.navigate", url=APP)
        await asyncio.sleep(2)

        if ARGS.import_proof:
            await shoot_import_proof(cdp)
            print("done")
            cdp.reader.cancel()
            return
        await shoot_base(cdp)
        if ARGS.mock_states:
            await shoot_mocked(cdp)

        errors = await cdp.js("window.__errs || []")
        print("done", errors)
        cdp.reader.cancel()


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
