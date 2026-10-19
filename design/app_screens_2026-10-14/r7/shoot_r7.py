"""R7 polish proofs: wraps design/app_screens_2026-10-14/shoot.py without editing it.

- logs the library second-row y in 01 / 03 (FIXES_R7 #1)
- mocked flow: launches the MP4 export twice (identical options) and shoots
  atelier/02-atelier-gif.png with the running toasts (FIXES_R7 #6)

Usage: python shoot_r7.py <repo> <out_dir> --extras --mock-states --port 9602
"""
import asyncio
import os
import sys

REPO = sys.argv.pop(1)
sys.path.insert(0, os.path.join(REPO, "design", "app_screens_2026-10-14"))
import shoot  # noqa: E402  (parses the remaining argv)

ROW_Y = """(() => {
  const cards = [...document.querySelectorAll('button')]
    .filter(b => b.textContent.trim() === 'Doubler')
    .map(b => b.parentElement && b.parentElement.parentElement)
    .filter(Boolean)
    .map(c => { const r = c.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), lifted: getComputedStyle(c).transform !== 'none' }; });
  const rows = [...new Set(cards.filter(c => !c.lifted).map(c => c.top))].sort((a, b) => a - b);
  return JSON.stringify({ rowTops: rows.slice(0, 3), cardHeights: [...new Set(cards.map(c => c.h))], lifted: cards.filter(c => c.lifted).map(c => c.top) });
})()"""

_orig_shot = shoot.CDP.shot


async def shot(self, rel):
    await _orig_shot(self, rel)
    if rel.startswith("library/"):
        print(f"  ROWS {rel}:", await self.js(ROW_Y))


shoot.CDP.shot = shot


async def shoot_mocked(cdp):
    s = shoot
    s.MOCK["states"] = True
    await s.go(cdp, "dub", s.CLIP, wait=4)
    await cdp.js("window.confirm = () => true; 1")
    await cdp.js("document.activeElement && document.activeElement.blur(); 1")
    await cdp.key("e", "KeyE", 69, text="e")
    await asyncio.sleep(1.2)
    await s.click(cdp, "Lancer l'export")
    await asyncio.sleep(1.0)
    await s.click(cdp, "Lancer l'export")
    await asyncio.sleep(2.5)
    await s.park_mouse(cdp)
    await cdp.shot("export/02-export-rendering.png")
    await cdp.key("Escape", "Escape", 27)
    await asyncio.sleep(0.5)

    await s.click_rail(cdp, "Atelier")
    if await s.click(cdp, "Choisir un clip"):
        name = await cdp.js(f"fetch('/api/clips/{s.CLIP}').then(r => r.json()).then(c => c.name)")
        await s.click(cdp, name)
    await cdp.js(s.WAIT_VIDEO)
    if await s.click(cdp, "GIF"):
        await cdp.js(s.WAIT_VIDEO)
        await asyncio.sleep(0.8)
        await s.park_mouse(cdp)
        print("  toasts:", await cdp.js("JSON.stringify([...document.querySelectorAll('[title$=\"tâches identiques en cours\"]')].map(e => e.innerText))"))
        await cdp.shot("atelier/02-atelier-gif.png")


shoot.shoot_mocked = shoot_mocked

if __name__ == "__main__":
    shoot.main()
