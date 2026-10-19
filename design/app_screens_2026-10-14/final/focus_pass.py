"""Keyboard-only focus pass: Tab through each screen (CDP Input.dispatchKeyEvent,
so focus is keyboard-initiated and :focus-visible applies) and record, for every
focused element, whether a visible focus ring is drawn (computed outline, or a
box-shadow carrying the accent colour).

Usage: python focus_pass.py <repo> <out_dir> --mock-states --port 9808 [--size 1440x900]
Writes <out_dir>/focus.json + prints a per-screen summary. Read-only: run with
--mock-states (every non-GET /api/ request is answered locally).
"""
import asyncio
import json
import os
import sys

REPO = sys.argv.pop(1)
sys.path.insert(0, os.path.join(REPO, "design", "app_screens_2026-10-14"))
sys.stdout.reconfigure(encoding="utf-8")
import shoot  # noqa: E402  (parses the remaining argv)

MAX_TABS = 90

PROBE = r"""(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const tmp = document.createElement('span'); tmp.style.color = 'var(--accent)'; document.body.appendChild(tmp);
  const accent = getComputedStyle(tmp).color.replace(/\s/g, ''); tmp.remove();
  // An opacity-0 native input draws its ring on the wrapping label (index.css).
  // A text input inside a pill / field wrapper draws its ring on the wrapper (.field-ring:focus-within).
  const field = el.matches('input, textarea') ? el.closest('.field-ring') : null;
  const host = field || (parseFloat(getComputedStyle(el).opacity) === 0 && el.parentElement && el.parentElement.tagName === 'LABEL' ? el.parentElement : el);
  const s = getComputedStyle(host), r = host.getBoundingClientRect();
  const ow = parseFloat(s.outlineWidth) || 0;
  const outline = s.outlineStyle !== 'none' && ow > 0;
  const shadow = s.boxShadow.replace(/\s/g, '');
  const accentShadow = shadow !== 'none' && shadow.includes(accent.replace('rgb(', '').replace(')', ''));
  const name = (el.getAttribute('aria-label') || el.title || el.innerText || el.value || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 48);
  let op = 1; for (let e = host; e && e !== document.documentElement; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
  // Ring sides (2px gap + 2px accent outside the box) cut by a clipping ancestor.
  let cut = { l: false, r: false, t: false, b: false };
  for (let a = host.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    const as = getComputedStyle(a);
    if (as.overflowX === 'visible' && as.overflowY === 'visible') continue;
    const ar = a.getBoundingClientRect();
    if (r.left - 3 < ar.left) cut.l = true;
    if (r.right + 3 > ar.right) cut.r = true;
    if (r.top - 3 < ar.top) cut.t = true;
    if (r.bottom + 3 > ar.bottom) cut.b = true;
  }
  const inset = /inset/.test(s.boxShadow) && accentShadow && host.matches('.focus-inset:focus-visible');
  const sidesCut = inset ? 0 : Object.values(cut).filter(Boolean).length;
  const path = []; for (let e = el; e && e !== document.body && path.length < 3; e = e.parentElement) path.push(e.tagName.toLowerCase());
  return {
    key: el.tagName + '|' + name + '|' + Math.round(r.x) + ',' + Math.round(r.y),
    tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), name,
    fv: el.matches(':focus-visible'), ring: (outline || accentShadow) && sidesCut < 4, sidesCut,
    outline: outline ? s.outlineStyle + ' ' + s.outlineWidth : null, shadow: s.boxShadow.slice(0, 80),
    opacity: Math.round(op * 100) / 100,
    visible: op > 0.2 && r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth,
    inlineShadow: host.style.boxShadow || null, ringHost: host === el ? null : (field ? 'field' : 'label'), path: path.join('<'),
  };
})()"""

RESULTS = {}


async def tab_through(cdp, screen, max_tabs=MAX_TABS):
    await cdp.js("document.activeElement && document.activeElement.blur(); window.getSelection().removeAllRanges(); 1")
    seen, rows = set(), []
    for _ in range(max_tabs):
        await cdp.key("Tab", "Tab", 9)
        await asyncio.sleep(0.12)
        info = await cdp.js(PROBE)
        if not info:
            continue
        if info["key"] in seen:
            break
        seen.add(info["key"])
        rows.append(info)
    bad = [r for r in rows if not r["ring"]]
    hidden = [r for r in rows if not r["visible"]]
    RESULTS[screen] = {"focused": len(rows), "with_ring": len(rows) - len(bad), "without_ring": bad,
                       "not_visible": hidden, "capped": len(rows) >= max_tabs, "all": rows}
    cap = f" (cap {max_tabs} reached)" if len(rows) >= max_tabs else ""
    print(f"{screen:28s} focused={len(rows):3d} ring={len(rows) - len(bad):3d} missing={len(bad)} not-visible={len(hidden)}{cap}")
    partial = [r for r in rows if r["ring"] and r["sidesCut"]]
    RESULTS[screen]["ring_partly_clipped"] = partial
    if partial:
        print(f"    ({len(partial)} outer rings partly clipped by an overflow ancestor; still visible on the other side(s))")
        for p in partial:
            print("    ~ partly:", p["tag"], repr(p["name"]), "sides cut:", p["sidesCut"])
    for h in hidden:
        print("    ~ hidden:", h["tag"], repr(h["name"]), "opacity=", h["opacity"], h["path"])
    for b in bad:
        print("    -", b["tag"], b["role"] or "", repr(b["name"]), "fv=", b["fv"], "shadow=", b["shadow"], "inline=", b["inlineShadow"], b["path"])
    with open(os.path.join(shoot.OUT, "focus.json"), "w", encoding="utf-8") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=1)


async def run_pass(cdp):
    s = shoot
    s.MOCK["states"] = True  # Studio shows the 3 mocked takes
    for section, clip, label in [
        ("clips", None, "Bibliothèque"), ("import", None, "Importer (vide)"), ("import-url", None, "Importer (source chargée)"),
        ("dub", s.CLIP, "Éditeur"), ("record", s.CLIP, "Studio (prises mockées)"),
        ("memes", None, "Atelier (vide)"), ("activity", None, "Activité"), ("settings", None, "Réglages"),
    ]:
        await s.go(cdp, "import" if section == "import-url" else section, clip, wait=4 if clip else 2.5)
        if section == "import-url" and await s.click(cdp, "URL / Stream"):
            await cdp.js("document.querySelector('input[placeholder^=\"https://\"]').focus(); 1")
            await cdp.call("Input.insertText", text=f"{s.APP}segments/{s.CLIP}.mp4")
            await s.click(cdp, "Charger")
            await cdp.js(s.WAIT_VIDEO)
        await tab_through(cdp, label, 160 if section == "clips" else MAX_TABS)
    # Éditeur inspector tabs other than Répliques (the réplique list is long).
    for tab in ["Voix", "Détection", "Boucles", "Lexique"]:
        await s.go(cdp, "dub", s.CLIP, wait=4)
        await s.click_tab(cdp, tab)
        await tab_through(cdp, f"Éditeur · onglet {tab}")
    # Exporter (from the editor with E)
    await s.go(cdp, "dub", s.CLIP, wait=4)
    await cdp.js("document.activeElement && document.activeElement.blur(); 1")
    await cdp.key("e", "KeyE", 69, text="e")
    await asyncio.sleep(1.2)
    await tab_through(cdp, "Exporter")
    # Atelier with a clip (header Select)
    await s.go(cdp, "memes")
    if await s.click(cdp, "Choisir un clip"):
        name = await cdp.js(f"fetch('/api/clips/{s.CLIP}').then(r => r.json()).then(c => c.name)")
        await s.click(cdp, name)
        await cdp.js(s.WAIT_VIDEO)
    await tab_through(cdp, "Atelier (clip)")


async def nothing(cdp):
    return None

shoot.shoot_base = run_pass
shoot.shoot_mocked = nothing

if __name__ == "__main__":
    shoot.main()
