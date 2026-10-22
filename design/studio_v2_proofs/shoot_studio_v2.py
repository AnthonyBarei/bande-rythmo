"""STUDIO_V2 proofs at 1440x900 (headless Chrome over CDP, Chrome's fake mic).

Usage: shoot_studio_v2.py <out_dir> [--app URL] [--port N]

Takes are faked inside the page: POST/PUT/DELETE /api/takes are answered by a
fetch shim (the posted audio becomes a blob URL), and GET /api/takes/<clip>
returns the real takes + the fake ones. Every other non-GET /api/ request is
refused by CDP Fetch interception — nothing is written to the backend.

Writes studio/13..19 + studio/15-decompte-tc-{0..3}.png (the TC chip, 0.5 s
apart, during the countdown) and studio/15-decompte-tc.json.
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
CLIP = "299d22a2-cb49-4d29-9d4b-eb1355c88d88"
W, H = 1440, 900

_args = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
_args.add_argument("out_dir")
_args.add_argument("--app", default="http://localhost:5173/")
_args.add_argument("--port", type=int, default=9334)
ARGS = _args.parse_args()
OUT = ARGS.out_dir
APP = ARGS.app if ARGS.app.endswith("/") else ARGS.app + "/"

TAKES_SHIM = """(() => {
  const real = window.fetch.bind(window);
  const mock = [];
  let nextId = 900000;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || 'GET').toUpperCase();
    const path = new URL(url, location.href).pathname;
    if (path === '/api/takes/' && method === 'POST') {
      const f = init.body;
      const audio = f.get('audio');
      const take = {
        id: nextId++, clip_id: f.get('clip_id'), character: f.get('character') || '',
        subtitle_index: f.get('subtitle_index') != null ? +f.get('subtitle_index') : null,
        audio_url: URL.createObjectURL(audio), duration: +f.get('duration') || 0,
        label: f.get('label') || '', lead: +(f.get('lead') || 0), best: false, created_at: new Date().toISOString(),
      };
      mock.push(take);
      return json(take);
    }
    let m = path.match(/^\\/api\\/takes\\/(\\d+)\\/best$/);
    if (m && method === 'PUT') {
      const t = mock.find(x => x.id === +m[1]);
      if (!t) return json({ detail: 'mock only' }, 404);
      mock.forEach(x => { if (x.subtitle_index === t.subtitle_index) x.best = false });
      t.best = true;
      return json(t);
    }
    m = path.match(/^\\/api\\/takes\\/(\\d+)$/);
    if (m && method === 'DELETE') {
      const i = mock.findIndex(x => x.id === +m[1]);
      if (i >= 0) mock.splice(i, 1);
      return json({ ok: true });
    }
    m = path.match(/^\\/api\\/takes\\/([^/]+)$/);
    if (m && method === 'GET') {
      const res = await real(input, init);
      const list = res.ok ? await res.json() : [];
      const hidden = new Set(mock.filter(t => t.best).map(t => t.subtitle_index));
      return json([...list.map(t => (hidden.has(t.subtitle_index) ? { ...t, best: false } : t)), ...mock]);
    }
    return real(input, init);
  };
})();"""


class CDP:
    def __init__(self, ws):
        self.ws, self.n = ws, 0
        self.pending, self.handlers = {}, {}
        self.reader = asyncio.create_task(self._read())

    async def _read(self):
        async for raw in self.ws:
            msg = json.loads(raw)
            if "id" in msg:
                fut = self.pending.pop(msg["id"], None)
                if fut and not fut.done():
                    fut.set_result(msg)
            elif msg.get("method") in self.handlers:
                asyncio.create_task(self.handlers[msg["method"]](msg.get("params", {})))

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

    async def shot(self, rel, clip=None):
        path = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        params = dict(format="png", captureBeyondViewport=False)
        if clip:
            params["clip"] = dict(clip, scale=1)
        r = await self.call("Page.captureScreenshot", **params)
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        print("saved", rel)

    async def key(self, key, code, vk, text=None):
        base = dict(key=key, code=code, windowsVirtualKeyCode=vk)
        await self.call("Input.dispatchKeyEvent", type="rawKeyDown", **base)
        if text:
            await self.call("Input.dispatchKeyEvent", type="char", text=text, **base)
        await self.call("Input.dispatchKeyEvent", type="keyUp", **base)


KEYS = {
    "c": ("c", "KeyC", 67, "c"), "r": ("r", "KeyR", 82, "r"), "Escape": ("Escape", "Escape", 27, None),
    "Enter": ("Enter", "Enter", 13, "\r"), "ArrowRight": ("ArrowRight", "ArrowRight", 39, None),
    "2": ("2", "Digit2", 50, "2"), "1": ("1", "Digit1", 49, "1"),
}


async def press(cdp, k):
    await cdp.key(*KEYS[k])
    await asyncio.sleep(0.25)


STATUS = "document.querySelector('[role=status]')?.textContent || ''"


async def wait_status(cdp, pattern, timeout=30):
    t0 = time.time()
    while time.time() - t0 < timeout:
        s = await cdp.js(STATUS)
        if pattern in s:
            return s
        await asyncio.sleep(0.1)
    raise RuntimeError(f"status never matched {pattern!r} (last: {await cdp.js(STATUS)!r})")


async def click_text(cdp, text):
    ok = await cdp.js(f"""(() => {{
      const el = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === {json.dumps(text)});
      if (!el) return false; el.click(); return true }})()""")
    if not ok:
        raise RuntimeError(f"button not found: {text}")
    await asyncio.sleep(0.5)


async def run():
    req = urllib.request.Request(f"http://127.0.0.1:{ARGS.port}/json/new?about:blank", method="PUT")
    target = json.loads(urllib.request.urlopen(req).read())
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=50_000_000) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")
        await cdp.call("Runtime.enable")
        await cdp.call("Emulation.setDeviceMetricsOverride", width=W, height=H, deviceScaleFactor=1, mobile=False)

        async def on_paused(p):
            rid, req = p["requestId"], p["request"]
            path = urllib.parse.urlparse(req["url"]).path
            if req["method"] != "GET" and path.startswith("/api/"):
                print("  blocked", req["method"], path)
                body = base64.b64encode(b'{"detail":"bloque par shoot_studio_v2.py"}').decode()
                await cdp.call("Fetch.fulfillRequest", requestId=rid, responseCode=503, body=body,
                               responseHeaders=[{"name": "Content-Type", "value": "application/json"}])
            else:
                await cdp.call("Fetch.continueRequest", requestId=rid)

        cdp.on("Fetch.requestPaused", on_paused)
        await cdp.call("Fetch.enable", patterns=[{"urlPattern": "*/api/*", "requestStage": "Request"}])
        await cdp.call("Page.addScriptToEvaluateOnNewDocument", source=TAKES_SHIM)

        nav = json.dumps(json.dumps({"section": "record", "clipId": CLIP}))
        comediens = json.dumps(json.dumps({"Dale": "Camille R.", "Red": "Inès B."}))
        await cdp.call("Page.navigate", url=APP)
        await asyncio.sleep(2)
        await cdp.js(f"""localStorage.setItem('br-coachmark-seen', '1');
          localStorage.setItem('br-comediens-{CLIP}', {comediens});
          localStorage.setItem('br-studio-mode-{CLIP}', JSON.stringify('line'));
          sessionStorage.removeItem('br-editor-sel-{CLIP}');
          sessionStorage.setItem('br-nav', {nav}); location.reload(); 1""")
        await asyncio.sleep(3)
        await cdp.call("Input.dispatchMouseEvent", type="mouseMoved", x=W - 2, y=H - 2)

        # Dale, a few répliques in (a readable image).
        await press(cdp, "1")
        for _ in range(3):
            await press(cdp, "ArrowRight")
        await asyncio.sleep(1)

        await press(cdp, "c")
        await asyncio.sleep(0.4)
        await cdp.shot("studio/13-role-menu.png")
        await press(cdp, "Escape")

        await wait_status(cdp, "Prêt")
        await asyncio.sleep(0.6)
        await cdp.shot("studio/14-pret.png")

        # Décompte: 4 TC readings 0.5 s apart + the TC chip each time.
        chip = await cdp.js("""(() => {
          const el = [...document.querySelectorAll('span')].find(s => /^PRÊT$/.test(s.textContent));
          const r = el.parentElement.getBoundingClientRect();
          return { x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 } })()""")
        await press(cdp, "r")
        await wait_status(cdp, "Décompte")
        await asyncio.sleep(0.3)
        await cdp.shot("studio/15-decompte.png")
        readings = []
        for i in range(4):
            readings.append(await cdp.js("""(() => ({ t: document.querySelector('video').currentTime,
              paused: document.querySelector('video').paused, status: document.querySelector('[role=status]').textContent }))()"""))
            await cdp.shot(f"studio/15-decompte-tc-{i}.png", clip=chip)
            await asyncio.sleep(0.5)
        with open(os.path.join(OUT, "studio", "15-decompte-tc.json"), "w", encoding="utf-8") as f:
            json.dump(readings, f, ensure_ascii=False, indent=2)

        await wait_status(cdp, "Élan")
        await asyncio.sleep(0.3)
        await cdp.shot("studio/16-elan.png")

        await wait_status(cdp, "ajoutée")
        await press(cdp, "Enter")
        await wait_status(cdp, "Prêt")
        await asyncio.sleep(1.5)
        await cdp.shot("studio/17-revue-next-pret.png")

        await click_text(cdp, "En continu")
        await press(cdp, "r")
        await wait_status(cdp, "Session en cours", timeout=40)
        await wait_status(cdp, "Session en cours · 1/", timeout=60)
        await asyncio.sleep(0.4)
        await cdp.shot("studio/18-continu-rec.png")

        # A few lines further: the live row is still in view, second from the top.
        await wait_status(cdp, "Session en cours · 6/", timeout=90)
        await asyncio.sleep(1.0)
        await cdp.shot("studio/18b-continu-follow.png")

        await press(cdp, "Escape")
        for _ in range(100):
            card = await cdp.js("document.querySelector('[role=dialog]')?.innerText || ''")
            if "créée" in card:
                break
            await asyncio.sleep(0.2)
        await asyncio.sleep(0.4)
        await cdp.shot("studio/19-continu-summary.png")

        # Entrée = the summary's primary action; the last captured line opens.
        await press(cdp, "Enter")
        await wait_status(cdp, "validée")
        await asyncio.sleep(0.6)
        await cdp.shot("studio/20-apres-resume.png")

        await cdp.js(f"localStorage.setItem('br-studio-mode-{CLIP}', JSON.stringify('line')); 1")
        print("decompte TC readings:", readings)
        cdp.reader.cancel()


def main():
    profile = tempfile.mkdtemp(prefix="br-shot-v2-")
    proc = subprocess.Popen([
        CHROME, "--headless=new", f"--remote-debugging-port={ARGS.port}", f"--user-data-dir={profile}",
        "--no-first-run", "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required",
        "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--hide-scrollbars", f"--window-size={W},{H}",
        "about:blank",
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
