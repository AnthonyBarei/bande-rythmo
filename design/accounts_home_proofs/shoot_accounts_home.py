"""HOME.md + ACCOUNT.md proofs (headless Chrome over CDP).

Usage: shoot_accounts_home.py <out_dir> [--app URL] [--port N]

/api/auth/* is answered by a fetch shim inside the page (fake signed-in user,
e-mail sending on, three devices), so no account is created. Every other
non-GET /api/ request is refused by CDP Fetch interception — nothing is
written to the backend.

Writes home/01..04 and account/01..07 (+ account/01-login-1100.png).
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

_args = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
_args.add_argument("out_dir")
_args.add_argument("--app", default="http://localhost:5173/")
_args.add_argument("--port", type=int, default=9335)
ARGS = _args.parse_args()
OUT = ARGS.out_dir
ROOT = ARGS.app if ARGS.app.endswith("/") else ARGS.app + "/"
APP = ROOT + "app/"

# Signed-in state lives in sessionStorage['shot-auth'] so it survives reloads.
AUTH_SHIM = """(() => {
  const real = window.fetch.bind(window);
  const USER = {
    id: 'shot', name: 'Camille R.', email: 'camille@exemple.fr', comedien: 'Camille Roux', color: '#F06AA0',
    email_verified: true, password_changed_at: new Date(Date.now() - 95 * 864e5).toISOString(),
    created_at: new Date(Date.now() - 200 * 864e5).toISOString(), prefs: null,
  };
  const SESSIONS = [
    { id: 1, device: 'Chrome · Windows', last_seen: new Date().toISOString(), current: true },
    { id: 2, device: 'Firefox · macOS', last_seen: new Date(Date.now() - 2 * 864e5).toISOString(), current: false },
    { id: 3, device: 'Safari · iPad', last_seen: new Date(Date.now() - 21 * 864e5).toISOString(), current: false },
  ];
  const signedIn = () => sessionStorage.getItem('shot-auth') === '1';
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || 'GET').toUpperCase();
    const path = new URL(url, location.href).pathname;
    if (!path.startsWith('/api/auth/')) return real(input, init);
    const route = method + ' ' + path.slice('/api/auth'.length);
    switch (route) {
      case 'GET /status': return json({ email: true });
      case 'GET /me': return json({ user: signedIn() ? USER : null });
      case 'POST /login':
      case 'POST /register': sessionStorage.setItem('shot-auth', '1'); return json({ user: USER });
      case 'POST /logout': sessionStorage.removeItem('shot-auth'); return json({ ok: true });
      case 'POST /forgot': return json({ ok: true }, 202);
      case 'GET /me/sessions': return json(SESSIONS);
      case 'PUT /me/prefs': return json({ ok: true });
      default: return json({ detail: 'bloqué par shoot_accounts_home.py' }, 503);
    }
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

    async def size(self, w, h, mobile=False):
        await self.call("Emulation.setDeviceMetricsOverride", width=w, height=h, deviceScaleFactor=1, mobile=mobile)
        await asyncio.sleep(0.3)

    async def shot(self, rel, full=False):
        path = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        params = dict(format="png", captureBeyondViewport=full)
        if full:
            w = await self.js("document.documentElement.clientWidth")
            h = await self.js("document.documentElement.scrollHeight")
            params["clip"] = dict(x=0, y=0, width=w, height=h, scale=1)
        r = await self.call("Page.captureScreenshot", **params)
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        print("saved", rel)

    async def go(self, url, wait=2.0):
        # Via about:blank: a hash-only change would keep the page (and open menus).
        await self.call("Page.navigate", url="about:blank")
        await asyncio.sleep(0.2)
        await self.call("Page.navigate", url=url)
        await asyncio.sleep(wait)


async def set_value(cdp, selector, value):
    """Type into a React-controlled input (native setter + input event)."""
    ok = await cdp.js(f"""(() => {{
      const el = document.querySelector({json.dumps(selector)});
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, {json.dumps(value)});
      el.dispatchEvent(new Event('input', {{ bubbles: true }}));
      return true }})()""")
    if not ok:
        raise RuntimeError(f"input not found: {selector}")


async def click_text(cdp, text, tag="button"):
    ok = await cdp.js(f"""(() => {{
      const el = [...document.querySelectorAll({json.dumps(tag)})].find(b => b.innerText.trim() === {json.dumps(text)});
      if (!el) return false; el.click(); return true }})()""")
    if not ok:
        raise RuntimeError(f"{tag} not found: {text}")
    await asyncio.sleep(0.5)


async def signed(cdp, on):
    await cdp.js("sessionStorage.setItem('shot-auth', '1'); 1" if on else "sessionStorage.removeItem('shot-auth'); 1")


async def run():
    req = urllib.request.Request(f"http://127.0.0.1:{ARGS.port}/json/new?about:blank", method="PUT")
    target = json.loads(urllib.request.urlopen(req).read())
    async with websockets.connect(target["webSocketDebuggerUrl"], max_size=80_000_000) as ws:
        cdp = CDP(ws)
        await cdp.call("Page.enable")
        await cdp.call("Runtime.enable")

        async def on_paused(p):
            rid, r = p["requestId"], p["request"]
            path = urllib.parse.urlparse(r["url"]).path
            if r["method"] != "GET" and path.startswith("/api/"):
                print("  blocked", r["method"], path)
                body = base64.b64encode(b'{"detail":"bloque par shoot_accounts_home.py"}').decode()
                await cdp.call("Fetch.fulfillRequest", requestId=rid, responseCode=503, body=body,
                               responseHeaders=[{"name": "Content-Type", "value": "application/json"}])
            else:
                await cdp.call("Fetch.continueRequest", requestId=rid)

        cdp.on("Fetch.requestPaused", on_paused)
        await cdp.call("Fetch.enable", patterns=[{"urlPattern": "*/api/*", "requestStage": "Request"}])
        await cdp.call("Page.addScriptToEvaluateOnNewDocument", source=AUTH_SHIM)

        # ── HOME ───────────────────────────────────────────────────────────
        await cdp.size(1440, 900)
        await cdp.go(ROOT, wait=2.5)
        await cdp.js("localStorage.setItem('br-coachmark-seen', '1'); sessionStorage.removeItem('shot-auth'); 1")
        await cdp.shot("home/01-home-1440.png", full=True)
        await cdp.js("document.getElementById('flux').scrollIntoView(); 1")
        await cdp.js("document.querySelectorAll('.step')[2].click(); 1")
        await asyncio.sleep(0.8)
        await cdp.shot("home/04-flow-step3.png")
        await cdp.size(900, 900)
        await cdp.go(ROOT, wait=2)
        await cdp.shot("home/02-home-900.png", full=True)
        await cdp.size(390, 844, mobile=True)
        await cdp.go(ROOT, wait=2)
        await cdp.shot("home/03-home-390.png", full=True)

        # ── AUTH ───────────────────────────────────────────────────────────
        await cdp.size(1440, 900)
        await cdp.go(APP + "#login", wait=2.5)
        await cdp.shot("account/01-login.png")
        await cdp.size(1100, 800)
        await cdp.go(APP + "#login", wait=2)
        await cdp.shot("account/01-login-1100.png")
        await cdp.size(1440, 900)

        await cdp.go(APP + "#register", wait=2)
        await set_value(cdp, "#auth-email", "camille@exemple")
        await set_value(cdp, "#auth-pw", "court")
        await click_text(cdp, "Créer mon compte")
        await cdp.js("document.activeElement.blur(); 1")
        await asyncio.sleep(0.4)
        await cdp.shot("account/02-register-errors.png")

        await cdp.go(APP + "#login", wait=2)
        await click_text(cdp, "Mot de passe oublié ?")
        await set_value(cdp, "#auth-email", "camille@exemple.fr")
        await click_text(cdp, "Envoyer le lien")
        await asyncio.sleep(0.6)
        await cdp.shot("account/03-forgot-sent.png")

        # ── SIGNED IN ──────────────────────────────────────────────────────
        await signed(cdp, True)
        await cdp.js("sessionStorage.setItem('br-nav', JSON.stringify({ section: 'clips' })); 1")
        await cdp.go(APP, wait=2.5)
        await cdp.js("document.querySelector('button[title=\"Mon compte\"]').click(); 1")
        await asyncio.sleep(0.5)
        await cdp.shot("account/04-topbar-menu.png")

        await cdp.go(APP + "#account", wait=2.5)
        await cdp.shot("account/05-account.png")

        await cdp.js("document.querySelector('[style*=\"overflow: auto\"]')?.scrollTo(0, 99999); 1")
        await click_text(cdp, "Supprimer le compte…")
        await set_value(cdp, "input[aria-label=\"Adresse e-mail du compte\"]", "camille@exemple.fr")
        await cdp.js("document.activeElement.blur(); [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).overflowY === 'auto').forEach(d => d.scrollTo(0, 99999)); 1")
        await asyncio.sleep(0.4)
        await cdp.shot("account/06-account-delete-confirm.png")

        await signed(cdp, False)
        await cdp.go(APP + "#account", wait=2.5)
        await cdp.shot("account/07-signed-out-card.png")

        await cdp.js("sessionStorage.removeItem('br-nav'); 1")
        cdp.reader.cancel()


def main():
    profile = tempfile.mkdtemp(prefix="br-shot-acc-")
    proc = subprocess.Popen([
        CHROME, "--headless=new", f"--remote-debugging-port={ARGS.port}", f"--user-data-dir={profile}",
        "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--window-size=1440,900",
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
