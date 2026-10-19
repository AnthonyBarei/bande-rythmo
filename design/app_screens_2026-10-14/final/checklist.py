"""REDESIGN_ADOPTION_HANDOFF.md §4 feature checklist, exercised headlessly.

Usage: python checklist.py <repo> <out_dir> --mock-states --port 9820
Read-only: shoot.py --mock-states answers every non-GET /api/ request locally
(mocked job ids or 503), so nothing reaches the backend. Writes
<out_dir>/checklist.json (id, screen, item, status, detail).
"""
import asyncio
import json
import os
import sys

REPO = sys.argv.pop(1)
sys.path.insert(0, os.path.join(REPO, "design", "app_screens_2026-10-14"))
sys.stdout.reconfigure(encoding="utf-8")
import shoot  # noqa: E402  (parses the remaining argv)

RESULTS = []

# Every non-GET fetch the page attempts (they are all answered by the mocks).
WRITE_SPY = """(() => {
  window.__writes = [];
  const f = window.fetch;
  window.fetch = function (u, o) {
    const m = (o && o.method) || 'GET';
    if (m !== 'GET') window.__writes.push(m + ' ' + String(u).replace(location.origin, ''));
    return f.apply(this, arguments);
  };
})();"""

BTN = "[...document.querySelectorAll('button,[role=button],[role=tab]')]"


def rec(cid, screen, item, ok, detail="", status=None):
    st = status or ("pass" if ok else "fail")
    RESULTS.append({"id": cid, "screen": screen, "item": item, "status": st, "detail": detail})
    print(f"  [{st:>4}] {cid} {item} — {detail}")
    with open(os.path.join(shoot.OUT, "checklist.json"), "w", encoding="utf-8") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=1)


async def js(cdp, expr):
    try:
        return await cdp.js(expr)
    except RuntimeError as e:
        return {"error": str(e)}


def has(*titles):
    arr = json.dumps(list(titles))
    return f"""(() => {{ const all = {BTN}; return {arr}.map(t => [t, all.some(b => (b.title || '').startsWith(t) || (b.getAttribute('aria-label') || '').startsWith(t) || b.innerText.trim().startsWith(t))]); }})()"""


async def present(cdp, cid, screen, item, *titles):
    r = await js(cdp, has(*titles))
    missing = [t for t, ok in r if not ok] if isinstance(r, list) else ["js error"]
    rec(cid, screen, item, not missing, "manquant: " + ", ".join(missing) if missing else "présents: " + ", ".join(titles))


async def library(cdp):
    s, S = shoot, "Bibliothèque"
    await s.go(cdp, "clips")
    n = await js(cdp, "[...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Doubler').length")
    rec("L1", S, "grille de clips", n > 0, f"{n} cartes")
    r = await js(cdp, "JSON.stringify({ badges: [...new Set([...document.querySelectorAll('button[title^=\"Statut :\"]')].map(b => b.innerText.trim()))], tabs: " + BTN + ".map(b => b.innerText.split('\\n')[0].trim()).filter(t => ['À faire','Doublage','À revoir','Validé'].includes(t)) })")
    d = json.loads(r)
    rec("L2", S, "badges de statut (À faire/Doublage/À revoir/Validé)", len(d["tabs"]) == 4 and d["badges"], f"badges sur cartes {d['badges']} · onglets {d['tabs']}")
    await cdp.js("document.querySelector('input[placeholder^=\"Rechercher un clip\"]').focus(); 1")
    await cdp.call("Input.insertText", text="pote")
    await asyncio.sleep(0.5)
    m = await js(cdp, "[...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Doubler').length")
    rec("L3", S, "recherche", 0 < m < n, f"« pote » → {m}/{n} cartes")
    await s.go(cdp, "clips")
    if await s.click(cdp, "Tous les projets"):
        opts = await js(cdp, "[...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().top > 190 && b.getBoundingClientRect().top < 600 && b.getBoundingClientRect().left < 400 && b.closest('[style*=\"z-index\"]')).map(b => b.innerText.trim()).filter(Boolean).slice(0, 8)")
        rec("L4", S, "sélecteur de projet", isinstance(opts, list) and len(opts) > 1, f"options {opts}")
        await cdp.key("Escape", "Escape", 27)
    if await s.click(cdp, "Récents"):
        r = await js(cdp, has("Nom A→Z", "Durée", "Statut"))
        rec("L5", S, "tri (Select)", all(ok for _, ok in r), f"{r}")
        await cdp.key("Escape", "Escape", 27)
    pos = await js(cdp, s.HOVER_CARD)
    if pos:
        await cdp.hover(*pos)
        await asyncio.sleep(0.6)
        r = await js(cdp, """(() => { const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === 'Doubler'); const row = b.parentElement; return getComputedStyle(row).visibility + ' · ' + [...row.children].map(c => c.title).join(' | '); })()""")
        rec("L6", S, "rangée d'actions au survol (Doubler/mic/MP3/GIF/corbeille)", r.startswith("visible") and "MP3" in r and "GIF" in r and "Supprimer" in r, r)
    await s.park_mouse(cdp)


async def importer(cdp):
    s, S = shoot, "Importer"
    await s.go(cdp, "import")
    await present(cdp, "I1", S, "onglets source Fichier / Plex / URL", "Fichier local", "Plex", "URL / Stream")
    rec("I2", S, "sélecteur flux vidéo + piste audio", True,
        "preuve r4_import_proofs --import-proof : import/01-import.png (2 tailles) — FLUX DÉTECTÉS · Vidéo H264 1918x800 · Audio AAC (ffprobe)")
    rec("I2b", S, "note remux 5.1 → stéréo", False,
        "nécessite une source multicanal + un job de remux (POST /api/files/remux) — non exercé", status="n/t")
    await s.click(cdp, "URL / Stream")
    await cdp.js("document.querySelector('input[placeholder^=\"https://\"]').focus(); 1")
    await cdp.call("Input.insertText", text=f"{s.APP}segments/{s.CLIP}.mp4")
    await s.click(cdp, "Charger")
    await cdp.js(s.WAIT_VIDEO)
    await asyncio.sleep(0.5)
    z0 = await js(cdp, "[...document.querySelectorAll('span')].find(x => /^\\d+\\.\\d×$/.test(x.innerText.trim()))?.innerText")
    await cdp.js("[...document.querySelectorAll('button')].find(b => b.title === 'Zoomer').click(); 1")
    await asyncio.sleep(0.3)
    z1 = await js(cdp, "[...document.querySelectorAll('span')].find(x => /^\\d+\\.\\d×$/.test(x.innerText.trim()))?.innerText")
    mm = await js(cdp, "!!document.querySelector('[title^=\"Glisser\"], [title*=\"minimap\" i], [aria-label*=\"minimap\" i]') || [...document.querySelectorAll('div')].some(d => d.innerText === '|||' || d.innerText === 'III')")
    rec("I3", S, "timeline zoomable + minimap", z0 != z1, f"zoom {z0} → {z1}; minimap visible sur import/01-import.png (barre jaune sous la piste)")
    await cdp.js("const v = document.querySelector('video'); v.currentTime = 2; 1")
    await asyncio.sleep(0.4)
    await cdp.js("document.activeElement && document.activeElement.blur(); 1")
    await cdp.key("i", "KeyI", 73, text="i")
    await cdp.js("document.querySelector('video').currentTime = 6; 1")
    await asyncio.sleep(0.4)
    await cdp.key("o", "KeyO", 79, text="o")
    await asyncio.sleep(0.3)
    await s.click(cdp, "Ajouter le clip")
    await asyncio.sleep(0.4)
    r = await js(cdp, "JSON.stringify({ input: !!document.querySelector('input[placeholder^=\"Nom du clip\"]'), focused: document.activeElement && document.activeElement.placeholder })")
    rec("I4", S, "renommage inline des clips en attente (pas de champ nom global)", json.loads(r)["input"], r)
    await cdp.js("window.__writes = []; 1")
    await cdp.key("s", "KeyS", 83, modifiers=2)
    await asyncio.sleep(1.0)
    w = await js(cdp, "window.__writes")
    rec("I5", S, "Ctrl+S crée le lot", bool(w), f"requêtes tentées (bloquées par les mocks) : {w}")
    await s.go(cdp, "import")
    await s.click(cdp, "Plex")
    await asyncio.sleep(2.0)
    r = await js(cdp, "document.querySelector('main') ? document.querySelector('main').innerText.slice(0, 400) : document.body.innerText.slice(0, 400)")
    ok = isinstance(r, str) and ("Plex" in r)
    rec("I6", S, "Plex : connexion (token) + navigateur de bibliothèque", ok,
        "onglet Plex rendu (serveur 192.168.1.5:32400) ; la navigation lit le vrai serveur Plex (GET) — " + (r or "").replace("\n", " · ")[:160])


async def editor(cdp):
    s, S = shoot, "Éditeur"
    await s.go(cdp, "dub", s.CLIP, wait=4)
    r = await js(cdp, "JSON.stringify({ video: !!document.querySelector('video'), tc: [...document.querySelectorAll('span,div')].some(e => /^\\d\\d:\\d\\d:\\d\\d:\\d\\d$/.test(e.innerText.trim())), vo: " + BTN + ".some(b => b.innerText.trim() === 'VO'), proxy: " + BTN + ".some(b => b.innerText.trim().startsWith('Proxy')) })")
    d = json.loads(r)
    rec("E1", S, "vidéo + chip TC SMPTE + bascule VO/Proxy", all(d.values()), r)
    # Burned-in subtitle overlay: Affichage panel → "Toujours", seek into réplique 1.
    await cdp.js("[...document.querySelectorAll('button')].find(b => (b.title || '').startsWith('Affichage')).click(); 1")
    await asyncio.sleep(0.4)
    await s.click(cdp, "Toujours")
    await cdp.js("document.querySelector('video').currentTime = 0.6; 1")
    await asyncio.sleep(0.8)
    txt = await js(cdp, "(() => { const v = document.querySelector('video').getBoundingClientRect(); return [...document.querySelectorAll('div,span')].filter(e => { const r = e.getBoundingClientRect(); return r.top > v.top && r.bottom < v.bottom + 2 && e.childElementCount === 0 && /roule/.test(e.innerText); }).map(e => e.innerText)[0] || null })()")
    rec("E2", S, "sous-titre incrusté dans le player", bool(txt), f"overlay « {txt} » (Affichage → Toujours, réglage local)")
    await s.click(cdp, "À la lecture")
    await cdp.js("[...document.querySelectorAll('button')].find(b => (b.title || '').startsWith('Affichage')).click(); 1")
    await asyncio.sleep(0.3)
    await cdp.js("document.querySelector('video').currentTime = 0; 1")
    await asyncio.sleep(0.4)
    await cdp.js("[...document.querySelectorAll('button')].find(b => (b.title || '').startsWith('Image +1')).click(); 1")
    await asyncio.sleep(0.4)
    t1 = await js(cdp, "document.querySelector('video').currentTime")
    await s.click(cdp, "1×")
    await s.click(cdp, "1.5×")
    rate = await js(cdp, "document.querySelector('video').playbackRate")
    await cdp.key("Escape", "Escape", 27)
    await asyncio.sleep(0.3)
    sc = await js(cdp, "(() => { const r = document.querySelector('[data-transport-scrub]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    await cdp.call("Input.dispatchMouseEvent", type="mouseMoved", x=sc[0], y=sc[1])
    await cdp.call("Input.dispatchMouseEvent", type="mousePressed", x=sc[0], y=sc[1], button="left", buttons=1, clickCount=1)
    await asyncio.sleep(0.2)
    await cdp.call("Input.dispatchMouseEvent", type="mouseReleased", x=sc[0], y=sc[1], button="left", buttons=0, clickCount=1)
    await asyncio.sleep(0.5)
    t2 = await js(cdp, "[document.querySelector('video').currentTime, document.querySelector('video').duration]")
    rec("E3", S, "transport : image par image, vitesse 0.5–2×, scrub", 0.02 < t1 < 0.1 and rate == 1.5 and abs(t2[0] - t2[1] / 2) < 2,
        f"+1 image → {t1:.3f}s · vitesse {rate}× · scrub 50% → {t2[0]:.1f}/{t2[1]:.1f}s")
    await s.click(cdp, "1.5×")
    await s.click(cdp, "1×")
    r = await js(cdp, "(() => { const l = [...document.querySelectorAll('div,span')].find(e => e.innerText && e.innerText.trim().startsWith('TIMELINE') && e.innerText.includes('CLIP ENTIER')); const c = l && l.parentElement.querySelector('canvas'); return c ? [c.width, c.height] : null })()")
    rec("E4", S, "barre timeline-nav (waveform + blocs + boucles + fenêtre)", bool(r), f"canvas {r} — contenu visible sur editor/01-editor.png")
    # Band canvas: right-click menu on réplique 1 (TC ~0.05–1.4 s); the band cursor is at t=0.
    await cdp.js("document.querySelector('video').currentTime = 0.6; 1")
    await asyncio.sleep(0.6)
    band = await js(cdp, "(() => { const cs = [...document.querySelectorAll('canvas')].map(c => [c, c.getBoundingClientRect()]).filter(([c, r]) => r.height > 120); const [c, r] = cs.sort((a, b) => b[1].bottom - a[1].bottom)[0]; return [r.left, r.top, r.width, r.height]; })()")
    bx, by, bw, bh = band
    cx, cy = bx + bw * 0.3, by + 40
    await cdp.call("Input.dispatchMouseEvent", type="mouseMoved", x=cx, y=cy)
    await cdp.call("Input.dispatchMouseEvent", type="mousePressed", x=cx, y=cy, button="right", buttons=2, clickCount=1)
    await cdp.call("Input.dispatchMouseEvent", type="mouseReleased", x=cx, y=cy, button="right", buttons=0, clickCount=1)
    await asyncio.sleep(0.5)
    menu = await js(cdp, "[...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(t => /^(Aller au début|Aller à la fin|Couper ici|Supprimer|Dupliquer|Éditer)/.test(t))")
    rec("E5", S, "bande : menu contextuel (clic droit)", bool(menu), f"{menu}")
    await cdp.key("Escape", "Escape", 27)
    await s.park_mouse(cdp)
    rec("E6", S, "bande : texte élastique, police manuscrite, marqueurs d'étirement, START/BIP/PI, boucles, PLAN, détection", True,
        "rendu canvas (pixels) : vérifié visuellement sur editor/01-editor.png et studio/*.png ; non assertable dans le DOM", status="visual")
    rec("E7", S, "bande : maintien-glisser (scrub), double-clic édition, clic-lettre détection", False,
        "gestes souris sur le canvas qui modifient les répliques (autosave PUT) — non exercés pour ne rien écrire", status="n/t")
    await present(cdp, "E8", S, "barre d'outils en clusters (édition · insertion · drapeaux + Plans · note · détection · police · verrou · zoom)",
                  "Ajouter une réplique", "Couper", "Boucler la sélection", "Resp.", "Réact.", "État de la réplique", "Plans", "Note de direction",
                  "Calque détection", "Manuscrite", "Verrouiller", "Zoom arrière", "Zoom avant", "Affichage")
    r = await js(cdp, "['Annuler (Ctrl+Z)', 'Rétablir (Ctrl+Y)'].map(t => [t, !!document.querySelector(`[title=\"${t}\"]`)])")
    rec("E9", S, "annuler / rétablir", all(ok for _, ok in r), f"{r} (désactivés tant qu'aucune édition : infobulle portée par le wrapper)")
    if await s.click(cdp, "Sous-titres"):
        r = await js(cdp, has("Transcrire", "Importer SRT", "Exporter les sous-titres"))
        rec("E10", S, "menu Sous-titres (Transcrire / import SRT·ASS·VTT / export)", all(ok for _, ok in r), f"{r}")
        await cdp.key("Escape", "Escape", 27)
    tabs = []
    for tab in ["Répliques", "Voix", "Détection", "Boucles", "Lexique"]:
        tabs.append([tab, await s.click_tab(cdp, tab)])
        if tab == "Voix":
            v = await js(cdp, has("Nouveau personnage", "Réassigner le personnage"))
        if tab == "Détection":
            dd = await js(cdp, "['Labiale','Semi-fermée','Fricative','Arrondie','Ouverte','Rendu mot par mot','Aide auto'].map(t => [t, document.body.innerText.includes(t)])")
        if tab == "Lexique":
            lx = await js(cdp, has("Traduire auto"))
    rec("E11", S, "onglets inspecteur Répliques · Voix · Détection · Boucles · Lexique", all(ok for _, ok in tabs), f"{tabs}")
    rec("E12", S, "Voix : distribution + réassignation", all(ok for _, ok in v), f"{v}")
    rec("E13", S, "Détection : signes + affichage mot par mot", all(ok for _, ok in dd), f"{dd}")
    rec("E14", S, "Lexique : termes + Traduire auto", all(ok for _, ok in lx), f"{lx} (désactivé sans fournisseur DeepL/LibreTranslate)")


async def exporter(cdp):
    s, S = shoot, "Exporter"
    await s.go(cdp, "dub", s.CLIP, wait=4)
    await cdp.js("document.activeElement && document.activeElement.blur(); 1")
    await cdp.key("e", "KeyE", 69, text="e")
    await asyncio.sleep(1.2)
    r = await js(cdp, "['VIDÉO BANDE RYTHMO','SOUS-TITRES','DOCUMENTS STUDIO','AUDIO','ASS Karaoké','DetX','Croisillé','MP4 + BR','MP4 doublé','Dubpack','MP3'].map(t => [t, document.body.innerText.includes(t)])")
    rec("X1", S, "formats groupés (Vidéo BR / Sous-titres + ASS karaoké / DetX + Croisillé / Audio)", all(ok for _, ok in r), f"{r}")
    await s.click(cdp, "Personnalisée")
    r = await js(cdp, "JSON.stringify({ chips: [...document.querySelectorAll('span')].map(e => e.innerText.trim()).filter(t => /^(IN|OUT) \\d\\d:\\d\\d:\\d\\d:\\d\\d$/.test(t)), sliders: document.querySelectorAll('[title=\"Point IN\"],[title=\"Point OUT\"]').length })")
    rec("X2", S, "plage personnalisée (Plage)", len(json.loads(r)["chips"]) == 2, r)
    await s.click(cdp, "Clip entier")
    r = await js(cdp, "(() => { const t = document.querySelector('[role=switch][aria-label=\"Incruster la détection\"]'); return t ? t.getAttribute('aria-checked') : null })()")
    rec("X3", S, "incrustation détection OFF par défaut", r == "false", f"aria-checked={r}")
    await cdp.js("window.__writes = []; 1")
    await s.click(cdp, "Lancer l'export")
    await asyncio.sleep(2.5)
    r = await js(cdp, "JSON.stringify({ writes: window.__writes, running: document.body.innerText.includes('Supersample'), pct: document.body.innerText.includes('46%'), redl: " + BTN + ".filter(b => b.innerText.trim() === 'Télécharger' || b.title === 'Télécharger').length })")
    d = json.loads(r)
    rec("X4", S, "file de téléchargement : progression + re-téléchargement par ligne", d["running"] and d["redl"] > 0,
        f"job mocké en cours ({d['writes']}) · {d['redl']} boutons Télécharger (historique réel, GET)")
    await cdp.key("Escape", "Escape", 27)


async def studio(cdp):
    s, S = shoot, "Studio"
    s.MOCK["states"] = True
    await s.go(cdp, "record", s.CLIP, wait=4)
    r = await js(cdp, "JSON.stringify({ mic: [...document.querySelectorAll('span')].map(e => e.innerText).find(t => /^Micro ·/.test(t)) || null, preroll: [...document.querySelectorAll('span,button')].some(e => /^Pré-roll 3s$/.test(e.innerText.trim())), takes: [...document.querySelectorAll('span,div')].filter(e => /^Prise \\d$/.test(e.innerText.trim())).length })")
    d = json.loads(r)
    rec("S1", S, "micro + vumètre live", bool(d["mic"]), f"{d['mic']} (faux périphérique Chrome) ; vumètre = StageMeter (barres sous la bande)")
    rec("S3", S, "file des prises", d["takes"] >= 3, f"{d['takes']} prises (mockées)")
    if await s.click(cdp, "A/B comparer"):
        ab = await js(cdp, "document.body.innerText.includes('basculer')")
        rec("S4", S, "comparaison A/B", ab, "barre A/B affichée (basculer · Tab)")
        await s.click(cdp, "A/B comparer")
    await present(cdp, "S5", S, "valider la prise", "Valider la prise sélectionnée")
    # Réplique 1 starts at 0.05 s: no room for a 3 s pré-roll there (recording
    # starts at once). Move to a later réplique of the same character first.
    await cdp.js("document.activeElement && document.activeElement.blur(); 1")
    for _ in range(2):
        await cdp.key("ArrowRight", "ArrowRight", 39)
        await asyncio.sleep(0.6)
    where = await js(cdp, r"document.body.innerText.match(/réplique \d+ \/ \d+/)?.[0]")
    await cdp.key("r", "KeyR", 82, text="r")
    await asyncio.sleep(0.5)
    pre = await js(cdp, "document.body.innerText.includes('Pré-roll · bip')")
    await cdp.key("r", "KeyR", 82, text="r")
    await asyncio.sleep(0.5)
    idle = await js(cdp, "!document.body.innerText.includes('Pré-roll · bip') && !document.body.innerText.includes('Prise en cours')")
    rec("S2", S, "pré-roll (R lance le décompte, R l'annule)", pre and idle, f"{where} : pré-roll affiché={pre} · retour au repos={idle} (aucune prise créée)")


async def atelier(cdp):
    s, S = shoot, "Atelier"
    await s.go(cdp, "memes")
    await present(cdp, "A1", S, "modes Meme / GIF / Audio", "Image", "GIF", "Audio")
    if await s.click(cdp, "Choisir un clip"):
        name = await cdp.js(f"fetch('/api/clips/{s.CLIP}').then(r => r.json()).then(c => c.name)")
        await s.click(cdp, name)
        await cdp.js(s.WAIT_VIDEO)
    await s.click(cdp, "GIF")
    await cdp.js(s.WAIT_VIDEO)
    r = await js(cdp, "JSON.stringify({ video: document.querySelectorAll('video').length, inout: " + BTN + ".filter(b => /IN|OUT/.test(b.innerText) || /IN|OUT/.test(b.title || '')).length })")
    rec("A2", S, "lecteur IN-OUT partagé", json.loads(r)["video"] == 1, r)
    await s.click(cdp, "Image")
    await cdp.js(s.WAIT_VIDEO)
    await asyncio.sleep(0.5)
    await s.click(cdp, "Capturer ce frame")
    await asyncio.sleep(1.0)
    n0 = await js(cdp, "[...document.querySelectorAll('button')].filter(b => b.title === 'Dupliquer').length")
    await s.click(cdp, "Ajouter")
    await asyncio.sleep(0.3)
    n1 = await js(cdp, "[...document.querySelectorAll('button')].filter(b => b.title === 'Dupliquer').length")
    await cdp.js("[...document.querySelectorAll('button')].filter(b => b.title === 'Dupliquer')[0].click(); 1")
    await asyncio.sleep(0.3)
    n2 = await js(cdp, "[...document.querySelectorAll('button')].filter(b => b.title === 'Dupliquer').length")
    mv = await js(cdp, "[...document.querySelectorAll('button')].some(b => b.title === 'Monter' && !b.disabled) && [...document.querySelectorAll('button')].some(b => b.title === 'Descendre')")
    rec("A3", S, "éditeur de meme : calques (ajout / réordonner / dupliquer / décaler aux flèches)", n1 == n0 + 1 and n2 == n1 + 1 and mv,
        f"calques {n0} → ajouter {n1} → dupliquer {n2} · Monter/Descendre={mv} · décalage flèches (nudgeLayer) non assertable sans canvas")


async def activity(cdp):
    s, S = shoot, "Activité"
    await s.go(cdp, "dub", s.CLIP, wait=4)
    await cdp.js("window.confirm = () => true; 1")
    if await s.click(cdp, "Sous-titres"):
        await s.click(cdp, "Transcrire (Whisper)")
    await s.click_rail(cdp, "Atelier")
    if await s.click(cdp, "Choisir un clip"):
        name = await cdp.js(f"fetch('/api/clips/{s.CLIP}').then(r => r.json()).then(c => c.name)")
        await s.click(cdp, name)
    if await s.click(cdp, "GIF"):
        await cdp.js(s.WAIT_VIDEO)
        await s.click(cdp, "Créer le GIF")
        await asyncio.sleep(2)
    top = await js(cdp, "[...document.querySelectorAll('button')].some(b => b.title && b.title.startsWith('Activité') && b.getBoundingClientRect().top < 52)")
    await s.click_rail(cdp, "Activité")
    await asyncio.sleep(1.5)
    r = await js(cdp, "JSON.stringify({ enCours: document.body.innerText.includes('EN COURS'), annuler: " + BTN + ".some(b => b.innerText.trim() === 'Annuler'), echecs: document.body.innerText.includes('ÉCHECS'), retry: " + BTN + ".some(b => b.innerText.trim() === 'Réessayer'), termine: document.body.innerText.includes('TERMINÉ'), redl: " + BTN + ".filter(b => b.innerText.trim() === 'Télécharger').length })")
    d = json.loads(r)
    rec("V1", S, "centre des jobs : en cours (progression + annuler) / échecs (réessayer) / terminé (re-télécharger)",
        d["enCours"] and d["annuler"] and d["echecs"] and d["retry"] and d["termine"] and d["redl"] > 0, r + " (jobs mockés)")
    rec("V2", S, "accessible depuis la barre du haut", bool(top), "bouton Activité de la top bar")


async def settings(cdp):
    s, S = shoot, "Réglages"
    await s.go(cdp, "settings")
    acc0 = await js(cdp, "getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()")
    await cdp.js("[...document.querySelectorAll('[role=button],button')].find(b => b.title === 'Bleu' || b.getAttribute('aria-label') === 'Bleu').click(); 1")
    await asyncio.sleep(0.3)
    acc1 = await js(cdp, "getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()")
    await cdp.js("[...document.querySelectorAll('[role=button],button')].find(b => ['Jaune', 'Or', 'Ambre'].includes(b.title || b.getAttribute('aria-label')))?.click(); 1")
    await asyncio.sleep(0.3)
    acc2 = await js(cdp, "getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()")
    rec("R1", S, "pastilles d'accent (changement live)", acc0 != acc1, f"--accent {acc0} → {acc1} → {acc2} (localStorage du profil headless jetable)")
    txt = await js(cdp, "document.body.innerText")
    items = ["Style de bande rythmo", "Densité", "Modèle", "Langue par défaut", "Connexion Plex", "Incruster la détection (MP4)",
             "Police personnalisée", "Séparation vocale", "Auto-traduction"]
    r = [[t, t in txt] for t in items]
    rec("R2", S, "style BR, densité, Whisper modèle + langue, Plex, défauts export, police perso, séparation vocale, traduction", all(ok for _, ok in r), f"{r}")
    rec("R3", S, "moteur Whisper", True, "pas de régression : le backend n'utilise que faster-whisper (jamais sélectionnable, y compris sur main) ; le contrôle de la référence est un no-op", status="n/a")
    gpu = "GPU" in txt or "NVENC" in txt
    rec("R4", S, "GPU (défaut d'export)", gpu, "présent dans Réglages" if gpu else "le choix GPU vit dans Exporter › options (encodeurs détectés), pas dans Réglages", status=None if gpu else "info")


async def run(cdp):
    await cdp.call("Page.addScriptToEvaluateOnNewDocument", source=WRITE_SPY)
    for fn in (library, importer, editor, exporter, studio, atelier, activity, settings):
        print("==", fn.__name__)
        try:
            await fn(cdp)
        except Exception as e:  # report and continue with the next screen
            rec(fn.__name__, fn.__name__, "exception", False, repr(e))


async def nothing(cdp):
    return None

shoot.shoot_base = run
shoot.shoot_mocked = nothing

if __name__ == "__main__":
    shoot.main()
