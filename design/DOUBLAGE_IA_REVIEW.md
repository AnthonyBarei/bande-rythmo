# Doublage page — full IA review

> **Companion doc:** `PRO_BR_HANDOFF.md` is the *feature* spec (what the pro bande rythmo does — elastic text, détection, boucles, SMPTE, DetX, croisillé). **This doc** is the *refinement* spec (how to organize and default what's now built). Do the feature handoff first; this is the clean follow-up pass.

A task-and-frequency audit of **every** control on the Doublage (BR) page, the problems it surfaces, and a proposed reorganization. Scope: the whole page, not just the band toolbar.

---

## 1. Inventory — everything currently on the page

### A · Global top bar (App shell)
| Control | Task | Freq |
|---|---|---|
| BR logo / "Bande Rythmo v2.0" | brand | — |
| Save status "Sauvegardé" | feedback | passive |
| **Exporter** | export | rare |
| **Raccourcis** | help | rare |
| Profile / account | account | rare |

### B · Clip header
| Control | Task | Freq |
|---|---|---|
| ← Mes clips | navigate out | occasional |
| Clip name | identity | — |
| Meta (25.6s · 15 répliques · 3 perso) | feedback | passive |
| Character pills (Red / Dale / Saul) | who / filter? | occasional |
| + Ajouter (personnage) | character mgmt | occasional |
| Langue (FR ▾) | transcription cfg | rare |
| Whisper | transcribe | rare (once/clip) |

### C · Right pane (tabbed)
| Control | Task | Freq |
|---|---|---|
| Tab: Répliques (list) | edit text/nav | constant |
| — row: #, char chip, TC, durée, texte | scan | constant |
| — row actions: ▶ / ✎ / 🗑 | per-line | frequent |
| Tab: Personnage (comédien, stats, record) | casting / take | occasional |
| Tab: Distribution (bars per char) | overview | rare |
| Footer: nouvelle réplique (⇧↵), aide (?) | create / help | occasional |

### D · Video area
| Control | Task | Freq |
|---|---|---|
| Video player (click = play) | watch | constant |
| Burn-in subtitle overlay | preview | passive |
| Overlay TC chip (top-left) | feedback | passive |
| Mini BR strip (below video) | preview | passive |

### E · Transport bar (between video and band)
| Control | Task | Freq |
|---|---|---|
| ▶ play/pause · ⏮prev ⏭next sub · start/end | navigate | constant |
| Time readout cur/dur | feedback | passive |
| Seekbar | navigate | frequent |
| Speed (1× ▾) | navigate | occasional |
| Mute | audio | occasional |
| "Sous-titres : lecture" (BR-in-player) | **display** | rare |
| A− / 100% / A+ (font scale) | **display** | rare |
| Font picker (Caveat ▾) | **display** | rare |

### F · Band toolbar (the dense one — ~15 controls)
| Control | Task | Freq |
|---|---|---|
| Active character pill ▾ | assign who | frequent |
| 🎤 Mic (take to record) | record | occasional |
| ⇥ IN · OUT · ✂ Couper | edit timing | frequent |
| Resp. · Réact. · Note | insert | occasional |
| ⟲ Boucle (loop active réplique) | navigate/practice | occasional |
| 🔒 Lock | safety | rare |
| **Détection** ▾ (+ sign palette) | détection | occasional |
| **Boucle +** (create recording boucle) · count/list | structure | occasional |
| Classique / Neon / Minimal | **display** | rare (once) |
| Décalage slider | **display/sync** | rare (once) |
| Zoom px/s | **display** | occasional |

### G · Band canvas (direct manipulation)
Drag create/move/resize · double-click edit · right-click menu (Éditer / Couper / Dupliquer / Aller début·fin / Personnage / Nouveau / Supprimer) · loop region overlay · hover hint.

### H/I · Overlays
Recorder panel (toggle) · Export panel (toggle).

---

## 2. Diagnosis — the real problems

**P1 · Transport is duplicated.** Play/pause, speed, mute live in **both** the transport bar (E) *and* the band toolbar (F). Two sources of truth for the same action, doubling the visual load.

**P2 · "Display" settings are homeless and scattered.** Style (Classique/Neon/Minimal), Décalage, Zoom, Font family, Font scale, BR-in-player — six *view* settings split across the transport bar (E) and band toolbar (F). None are frequent; together they eat the most space.

**P3 · "Boucle" means two different things, adjacent to each other.** ⟲ *Boucle* = loop-playback the active réplique (practice). *Boucle +* = create a numbered **recording loop** (structure/export). Same word, touching in the same bar → guaranteed confusion.

**P4 · The band toolbar mixes five unrelated jobs in one row** — edit timing, insert tags, détection, structure, and display — with no grouping cues. ~15 controls competing equally.

**P5 · Rare actions hold prime real estate.** Décalage, style, font are "set once per clip" yet sit always-visible, while frequent actions (character, IN/OUT) fight for the same row.

**P6 · Recording has three entry points** — Mic in toolbar (F), record in Personnage tab (C), Recorder panel (H). Unclear which is canonical.

**P7 · Character assignment lives in three places** — header pills (B), active-char pill (F), right-click menu (G). Probably fine, but worth a deliberate "primary path" decision.

---

## 3. Proposed reorganization

### Principle
Two bars, each with ONE job. **Transport bar = move through time. Band toolbar = act on the band.** Everything "set once" goes behind a single **Affichage ▾** menu. Disambiguate the two boucles.

### Band toolbar — regrouped into 5 labelled clusters (left → right by frequency)

```
[ ● Dale ▾ ]   │ IN  OUT  ✂Couper │ + Insérer ▾ │ Détection ▾ │ Boucles ▾ │ ……… │ Affichage ▾   🔒
   QUI              ÉDITER             INSÉRER       DÉTECTION     STRUCTURE          DISPLAY    SAFE
```

1. **Qui** — active character pill + reassign (keep; it's frequent).
2. **Éditer** — IN · OUT · Couper (+ Diviser). The core timing trio.
3. **Insérer ▾** — collapse Resp · Réact · Note into one "+ Insérer" menu (they're occasional, and each already opens a dropdown).
4. **Détection ▾** — the calque toggle + per-sign palette in a popover (already mostly this).
5. **Boucles ▾** — the recording-loop structure cluster: "Boucle +" (split at cursor), the count, and the list popover. **Rename the playback loop** (⟲) to a loop *icon only* and move it into the transport bar where navigation lives — it's a navigation aid, not a structure tool. Kills P3.
6. **Affichage ▾** (pushed right) — one popover holding: Style (Classique/Neon/Minimal), Zoom, Décalage, Font family, Font scale, BR-in-player. Solves P2 + P5 in one move.
7. **🔒 Lock** — far right, it's a safety toggle.

### Transport bar — single source of truth
Keep play/pause · prev/next · start/end · seekbar · time · speed · mute · **⟲ loop-active** (moved here from F). Remove play/speed/mute duplicates from the band toolbar (fixes P1). Move font scale + font family OUT of here into Affichage (fixes P2).

### Recording — one canonical entry
Pick the **Personnage tab** as the home for take recording (it already has the comédien + stats context). Demote the toolbar Mic to a quick "record this réplique" shortcut that *opens* that panel, so there's one real surface (fixes P6).

### Net effect
- Band toolbar drops from ~15 flat controls to **6 labelled clusters**.
- Every "set once" control is one click away in **Affichage**, not cluttering the bar.
- No duplicated transport. No ambiguous "Boucle".
- Frequent actions (Qui, Éditer) get the prime left edge.

---

## 4. Open questions before building
1. Keep the band-toolbar transport at all, or fully delegate to the transport bar? (I recommend: delegate — one transport.)
2. Are the header **character pills** meant to *filter* the band, or just display the cast? That decides whether they stay interactive.
3. Is **Décalage** ever touched mid-session, or truly once? If mid-session, it may deserve a slimmer always-visible nudge (±).
4. Should **détection** sign-editing have a direct gesture (click a letter on the band to cycle its sign), or stay palette-driven?

---

## 5. Suggested build order
1. Create **Affichage ▾** popover, move the six display settings into it. (Biggest visual decluttering, low risk.)
2. De-duplicate transport (remove play/speed/mute from band toolbar; move loop-active up).
3. Collapse Resp/Réact/Note into **+ Insérer ▾**.
4. Rename/relocate the two boucles.
5. Consolidate recording entry.
6. Add cluster labels / separators to the band toolbar.

---

## 6. Decisions locked (build to these)

The 4 open questions are answered:

1. **One transport.** Remove play/pause, speed, mute from the **band toolbar**. The transport bar under the video is the single source of truth. Move **⟲ loop-active-réplique** up into that transport bar (it's navigation). Band toolbar keeps only band-acting controls.
2. **Header character pills FILTER the band.** Clicking a pill dims/hides the other characters' lines on the band (and the right-pane list). Multi-select allowed; clicking the active pill again clears the filter. Show a clear "filtré" state + a one-click reset. Keep the pill colors = `TRACK_COLORS`.
3. **Décalage is set once per clip** → lives **only** in the **Affichage ▾** popover. No always-visible nudge. Persist on the clip so it restores on reopen.
4. **Détection: click-a-letter to cycle its sign.** On the band, clicking a glyph cycles its detection sign (none → labiale → semi → fricative → arrondie → ouverte → none), respecting the active sign-palette filter. Keep the palette as the bulk toggle; the click gesture is the per-letter override. Store the override on the line so it survives re-classification (`line.signs = { [charIndex]: 'arrondie' }`).

---

## 7. Default display — the "pro classique" look (on clip open)

A clip should open **sober and authentic**, not flashy. Defaults:

| Setting | Default | Why |
|---|---|---|
| Style | **Classique** (not Néon) | No glow; glow is a ponctual aid, not a working default. |
| Police | **Caveat (manuscrite)** white | Calligraphy on black = the métier convention. Détection writes on top. |
| Taille texte | **100 %** | — |
| Zoom | **150 px/s** | Comfortable reading cadence at normal speech. |
| Décalage | **+0.00 s** (or last saved) | — |
| Détection | **Masquée** | The graphite calque turns on when needed, not by default. |
| Onde sonore | **Discrète** (~15 % opacity, behind text) | Helps locate beats without fighting the text. |
| Grille image | **24 fps · SMPTE** visible | TC `HH:MM:SS:FF` under cursor + START/BIP/PI at band head. |
| Incrustation vidéo | **À la lecture** | Burn-in sub shows while playing, hidden when scrubbing. |
| Couleur perso | **liseré + onglet, pas d'aplat** | Identity lives in the left tab + baseline rule, not a big tinted block. |

The legacy block model (monospace, colored fills, auto-fit) is **off** in the pro path — keep it only as a fallback/compat style if ever needed.

Reference artboard: **"Affichage par défaut · look pro classique"** in the design canvas.

---

## 8. Z-index — dropdowns rendering under the video / panels

**Symptom.** Custom dropdowns (character picker, context menu, sometimes the toolbar menus) get **clipped** or appear **behind** the video element and neighbouring panels.

**Cause.**
- Some menus are `position: absolute` **inside a panel that has `overflow: hidden`** → they get cropped at the panel edge.
- The video area and BR panels create their **own stacking contexts** (via `position` + `transform`/`z-index`), so a sibling menu with a *local* z-index can't rise above them.
- Inconsistent z-index values across the file: `20`, `30`, `9999` mixed arbitrarily (see `DubbingWorkspace.jsx` lines ~2399, 2499, 2541, 2610+).

**Fix — 3 rules:**

1. **Portal every menu/popover to `document.body`** (React portal), so it escapes any parent `overflow:hidden` and local stacking context. The Resp/Réact/Note dropdowns already render `position: fixed` — extend the same treatment to the **character picker** (currently `position:absolute; z-index:20/30`) and the **context menu**.
2. **`position: fixed` + anchor** to the trigger's `getBoundingClientRect()` (the toolbar dropdowns already compute `dropdownAnchor` this way — reuse that helper for all of them).
3. **One z-index scale** — replace the scattered literals with shared tokens:

```css
:root {
  --z-base:     0;     /* page content: video, canvas, panels */
  --z-sticky:   40;    /* sticky bars: header, transport, band toolbar */
  --z-dropdown: 60;    /* menus & popovers (portaled) */
  --z-modal:    100;   /* recorder, fullscreen export */
  --z-toast:    1000;  /* notifications */
}
```

Map current usages: context-menu backdrop+menu → `--z-dropdown`; recorder/export overlay → `--z-modal`; toast → `--z-toast`. Drop all `9999`s.

Reference artboard: **"Z-index · menus qui passent sous la vidéo"** in the design canvas.
