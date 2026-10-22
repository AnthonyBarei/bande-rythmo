"""Home page stills + OG image (headless Chrome over CDP), on Tears of Steel.

Usage: shoot_home_stills.py <clip_id> <source.mov> [--app URL] [--out DIR] [--port N]

Writes <out>/{import,editor,studio,export}.png at 1440x900 and <out>/../og.png
at 1200x630. The clip is the Tears of Steel excerpt imported in the
Bibliothèque. The Importer shot registers the source in memory
(/api/files/register) and answers its file picker with that source; every
other non-GET /api/ request is refused — nothing is written to the database.

Tears of Steel: (CC) Blender Foundation | mango.blender.org — CC BY 3.0.
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
import uuid

import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
W, H = 1440, 900

_args = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
_args.add_argument("clip_id")
_args.add_argument("source")
_args.add_argument("--app", default="http://localhost:5173/")
_args.add_argument("--out", default="frontend/public/home")
_args.add_argument("--port", type=int, default=9336)
ARGS = _args.parse_args()
ROOT = ARGS.app if ARGS.app.endswith("/") else ARGS.app + "/"
APP = ROOT + "app/"
SOURCE = os.path.abspath(ARGS.source)


def api(method, path, **query):
    url = ROOT + "api" + path + ("?" + urllib.parse.urlencode(query) if query else "")
    req = urllib.request.Request(url, method=method, data=b"" if method == "POST" else None)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


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

    async def shot(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        r = await self.call("Page.captureScreenshot", format="png")
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        print("saved", path)

    async def go(self, url, wait=3.0):
        await self.call("Page.navigate", url="about:blank")
        await asyncio.sleep(0.2)
        await self.call("Page.navigate", url=url)
        await asyncio.sleep(wait)

    async def key(self, key, code, vk, text=None):
        base = dict(key=key, code=code, windowsVirtualKeyCode=vk)
        await self.call("Input.dispatchKeyEvent", type="rawKeyDown", **base)
        if text:
            await self.call("Input.dispatchKeyEvent", type="char", text=text, **base)
        await self.call("Input.dispatchKeyEvent", type="keyUp", **base)
        await asyncio.sleep(0.3)


async def seek(cdp, t):
    await cdp.js(f"""new Promise(r => {{ const v = document.querySelector('video');
      v.pause(); v.addEventListener('seeked', () => setTimeout(r, 400), {{ once: true }}); v.currentTime = {t} }})""")


async def set_value(cdp, selector, value):
    """Type into a React-controlled input (native setter + input event)."""
    await cdp.js(f"""(() => {{
      const el = document.querySelector({json.dumps(selector)});
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, {json.dumps(value)});
      el.dispatchEvent(new Event('input', {{ bubbles: true }}));
      return 1 }})()""")
    await asyncio.sleep(0.3)


async def nav_to(cdp, section, clip_id):
    nav = json.dumps(json.dumps({"section": section, "clipId": clip_id}))
    await cdp.go(APP, wait=1.5)
    await cdp.js(f"localStorage.setItem('br-coachmark-seen', '1'); sessionStorage.setItem('br-nav', {nav}); location.reload(); 1")
    await asyncio.sleep(3.5)
    await cdp.call("Input.dispatchMouseEvent", type="mouseMoved", x=W - 2, y=H - 2)


async def run():
    pick = {"source_id": str(uuid.uuid4()), "filename": os.path.basename(SOURCE), "path": SOURCE}
    api("POST", "/files/register", source_id=pick["source_id"], stream_url=SOURCE, filename=pick["filename"])
    # Shown under the title: a neutral path, not this machine's user folder.
    pick.update(path="D:\\Rushes\\" + pick["filename"], video_streams=[], audio_streams=[])

    req = urllib.request.Request(f"http://127.0.0.1:{ARGS.port}/json/new?about:blank", method="PUT")
    target = json.loads(urllib.request.urlopen(req).read())
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=80_000_000) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")
        await cdp.call("Runtime.enable")
        await cdp.call("Emulation.setDeviceMetricsOverride", width=W, height=H, deviceScaleFactor=1, mobile=False)

        async def on_paused(p):
            rid, r = p["requestId"], p["request"]
            path = urllib.parse.urlparse(r["url"]).path
            if path == "/api/files/pick":
                body = base64.b64encode(json.dumps(pick).encode()).decode()
                await cdp.call("Fetch.fulfillRequest", requestId=rid, responseCode=200, body=body,
                               responseHeaders=[{"name": "Content-Type", "value": "application/json"}])
            elif r["method"] != "GET" and path.startswith("/api/"):
                print("  blocked", r["method"], path)
                body = base64.b64encode(b'{"detail":"bloque par shoot_home_stills.py"}').decode()
                await cdp.call("Fetch.fulfillRequest", requestId=rid, responseCode=503, body=body,
                               responseHeaders=[{"name": "Content-Type", "value": "application/json"}])
            else:
                await cdp.call("Fetch.continueRequest", requestId=rid)

        cdp.on("Fetch.requestPaused", on_paused)
        await cdp.call("Fetch.enable", patterns=[{"urlPattern": "*/api/*", "requestStage": "Request"}])

        # Importer: the source open, IN at 0:20 and OUT at 0:56 (the excerpt).
        await nav_to(cdp, "import", None)
        await cdp.js("""(() => { const b = [...document.querySelectorAll('button')].find(x => /Fichier local/.test(x.innerText)); b?.click(); return 1 })()""")
        await asyncio.sleep(0.5)
        await cdp.js("""(() => { const b = [...document.querySelectorAll('button, [role=button]')].find(x => /choisir un fichier local/i.test(x.innerText) && x.offsetParent); b?.click(); return 1 })()""")
        await asyncio.sleep(4)
        await seek(cdp, 20)
        await cdp.key("i", "KeyI", 73, "i")
        await seek(cdp, 56)
        await cdp.key("o", "KeyO", 79, "o")
        await cdp.js("""(() => { const d = [...document.querySelectorAll('div')].reverse().find(x => x.innerText?.trim() === 'Cliquez pour activer le son'); d?.click(); return 1 })()""")
        await asyncio.sleep(0.5)
        await set_value(cdp, 'input[placeholder="Nom du clip…"]', "Le pont")
        await seek(cdp, 33)
        await cdp.js("document.activeElement.blur(); 1")
        await asyncio.sleep(1)
        await cdp.shot(os.path.join(ARGS.out, "import.png"))

        # Éditeur on « Why don't you just admit… » (CELIA).
        await nav_to(cdp, "dub", ARGS.clip_id)
        await seek(cdp, 12.2)
        await asyncio.sleep(1.2)
        await cdp.shot(os.path.join(ARGS.out, "editor.png"))

        # Exporter, opened from the Éditeur.
        await cdp.key("e", "KeyE", 69, "e")
        await asyncio.sleep(1.5)
        await cdp.shot(os.path.join(ARGS.out, "export.png"))

        # Studio in « prêt ».
        await nav_to(cdp, "record", ARGS.clip_id)
        await cdp.key("ArrowRight", "ArrowRight", 39)
        await set_value(cdp, 'input[placeholder="Nom du comédien…"]', "Camille R.")
        await cdp.js("document.activeElement.blur(); 1")
        await asyncio.sleep(2)
        await cdp.shot(os.path.join(ARGS.out, "studio.png"))

        # OG image: logo + headline over the home's live band strip.
        await cdp.call("Emulation.setDeviceMetricsOverride", width=1200, height=630, deviceScaleFactor=1, mobile=False)
        await cdp.go(ROOT, wait=3)
        await cdp.js("""(() => {
          const band = document.querySelector('.band');
          const og = document.createElement('div');
          og.innerHTML = `<div style="padding:64px 72px 0;height:402px;box-sizing:border-box;background:#0b0b0d">
            <div class="logo" style="font-size:20px"><span class="logo-tile" style="width:48px;height:48px;border-radius:13px">${document.querySelector('.logo-tile').innerHTML}</span>BANDE RYTHMO</div>
            <h1 style="font-size:62px;margin-top:44px;max-width:1056px">Le doublage, à <em>la cadence</em> du studio.</h1></div>`;
          og.append(band);
          document.body.replaceChildren(og);
          document.body.style.overflow = 'hidden';
          band.querySelector('canvas').style.height = '228px';
          return 1 })()""")
        await asyncio.sleep(1.5)
        await cdp.shot(os.path.join(os.path.dirname(os.path.abspath(ARGS.out)), "og.png"))
        cdp.reader.cancel()


def main():
    profile = tempfile.mkdtemp(prefix="br-shot-stills-")
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
