"""R7 extra proofs (read-only): font menus with family hints, Studio setting, "/" behaviour.

Usage: python extras_r7.py <repo> <out_dir> --port 9604
"""
import asyncio
import os
import sys

REPO = sys.argv.pop(1)
sys.path.insert(0, os.path.join(REPO, "design", "app_screens_2026-10-14"))
import shoot  # noqa: E402

ACTIVE = "JSON.stringify({ tag: document.activeElement && document.activeElement.tagName, label: document.activeElement && document.activeElement.getAttribute('aria-label'), modal: !!document.querySelector('[aria-modal=\"true\"]'), palette: !!document.querySelector('input[placeholder^=\"Rechercher une commande\"]') })"


async def slash(cdp):
    await cdp.js("document.activeElement && document.activeElement.blur(); 1")
    await cdp.key("/", "Slash", 191, text="/")
    await asyncio.sleep(0.6)
    return await cdp.js(ACTIVE)


async def extras(cdp):
    s = shoot
    await s.go(cdp, "settings")
    await s.click(cdp, "Manuscrite")
    await asyncio.sleep(0.4)
    await cdp.shot("settings/02-font-menu.png")
    await cdp.key("Escape", "Escape", 27)
    await cdp.js("document.querySelector('main div[style*=\"overflow: auto\"]').scrollTop = 99999; 1")
    await asyncio.sleep(0.4)
    await cdp.shot("settings/03-studio-vo.png")

    await s.go(cdp, "clips")
    print("  / in Bibliothèque:", await slash(cdp))
    await cdp.shot("shell/04-slash-library.png")
    await s.go(cdp, "settings")
    print("  / in Réglages:", await slash(cdp))
    await cdp.shot("shell/05-slash-palette.png")
    await cdp.key("Escape", "Escape", 27)

    await s.go(cdp, "dub", s.CLIP, wait=4)
    await s.click(cdp, "Manuscrite")
    await asyncio.sleep(0.4)
    await cdp.shot("editor/11-font-menu.png")
    await cdp.key("Escape", "Escape", 27)
    await cdp.js("document.activeElement && document.activeElement.blur(); 1")
    await cdp.key("e", "KeyE", 69, text="e")
    await asyncio.sleep(1.2)
    await cdp.shot("export/01-export.png")


shoot.shoot_base = extras

if __name__ == "__main__":
    shoot.main()
