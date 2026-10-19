"""Final acceptance captures: wraps ../shoot.py and audits every shot for
overflow / clipped text (read-only DOM measurement).

Usage: python shoot_final.py <repo> <out_dir> --size 1100x800 --extras --mock-states --port 9801
       python shoot_final.py <repo> <out_dir> --via=r4_import_proofs --import-proof --repo <repo> --size 1100x800 --port 9803
Writes <out_dir>/audit-<script>.json: per shot, the text elements that spill out of
their box, are cut by a non-scrolling ancestor or the viewport, or are
ellipsis-truncated, plus whether the page itself scrolls horizontally.
[data-fit-hints] rows are skipped: they hide whole phrases on purpose
(TimelineBar hint line).
"""
import asyncio
import json
import os
import sys

REPO = sys.argv.pop(1)
sys.path.insert(0, os.path.join(REPO, "design", "app_screens_2026-10-14"))
sys.stdout.reconfigure(encoding="utf-8")
VIA = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--via=")), "shoot")
sys.argv = [a for a in sys.argv if not a.startswith("--via=")]
shoot = __import__(VIA)  # parses the remaining argv

AUDIT = r"""(() => {
  const vw = innerWidth, vh = innerHeight;
  const shown = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; } return true; };
  const name = el => el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label') + ']' : '') + ' "' + (el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 50) + '"';
  const scrolls = s => /(auto|scroll)/.test(s.overflowX + s.overflowY);
  const res = { pageOverflowX: document.documentElement.scrollWidth > vw + 1, pageOverflowY: document.documentElement.scrollHeight > vh + 1, spill: [], cut: [], ellipsis: [] };
  const leaves = [...document.querySelectorAll('body *')].filter(el => !['SCRIPT', 'STYLE', 'svg', 'path', 'CANVAS', 'VIDEO', 'OPTION'].includes(el.tagName) && ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || el.tagName === 'INPUT'));
  for (const el of leaves) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || !shown(el) || el.closest('[data-fit-hints]')) continue;
    const s = getComputedStyle(el);
    if (s.position === 'absolute' && (r.width <= 1 || s.clip !== 'auto')) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
      if (s.textOverflow === 'ellipsis') res.ellipsis.push(name(el) + (el.title || el.closest('[title]') ? ' (title)' : ' (NO title)'));
      else if (s.overflowX === 'visible') res.spill.push(name(el) + ' sw=' + el.scrollWidth + ' cw=' + el.clientWidth);
      else if (!scrolls(s)) res.cut.push(name(el) + ' own-box sw=' + el.scrollWidth + ' cw=' + el.clientWidth);
    }
    let clipped = null;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const as = getComputedStyle(a);
      if (as.overflowX === 'visible' && as.overflowY === 'visible') continue;
      if (scrolls(as)) break;
      const ar = a.getBoundingClientRect();
      if (r.left < ar.left - 1 || r.right > ar.right + 1 || r.top < ar.top - 1 || r.bottom > ar.bottom + 1) { clipped = a; break; }
    }
    if (clipped) res.cut.push(name(el) + ' by <' + clipped.tagName.toLowerCase() + '>');
    else if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1) {
      let sc = false;
      for (let a = el.parentElement; a; a = a.parentElement) if (scrolls(getComputedStyle(a))) { sc = true; break; }
      if (!sc) res.cut.push(name(el) + ' by viewport ' + JSON.stringify([Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]));
    }
  }
  return JSON.stringify(res);
})()"""

RESULTS = {}
_orig_shot = shoot.CDP.shot


async def shot(self, rel):
    await _orig_shot(self, rel)
    try:
        res = json.loads(await self.js(AUDIT))
    except RuntimeError as e:
        print("  ! audit failed:", e)
        res = {"error": str(e)}
    RESULTS[rel] = res
    issues = {k: v for k, v in res.items() if v}
    if issues:
        print("  AUDIT", rel, json.dumps(issues, ensure_ascii=False)[:1500])
    with open(os.path.join(shoot.OUT, f"audit-{VIA}.json"), "w", encoding="utf-8") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=1)


shoot.CDP.shot = shot

_orig_base = getattr(shoot, "shoot_base", None)


async def base_plus(cdp):
    """Original base shots, then a view-only extra: Exporter custom range
    (SMPTE IN/OUT chips)."""
    await _orig_base(cdp)
    s = shoot
    await s.go(cdp, "dub", s.CLIP, wait=4)
    await cdp.js("document.activeElement && document.activeElement.blur(); 1")
    await cdp.key("e", "KeyE", 69, text="e")
    await asyncio.sleep(1.2)
    if await s.click(cdp, "Personnalisée"):
        await s.park_mouse(cdp)
        await cdp.shot("export/03-export-range.png")


if _orig_base and VIA == "shoot":
    shoot.shoot_base = base_plus

if __name__ == "__main__":
    shoot.main()
