# Handoff — Adopt the redesign (`redesign.html`)

> **Companion docs:** `README_HANDOFF.md` (index) · `PRO_BR_HANDOFF.md` · `DOUBLAGE_IA_REVIEW.md` · `MEME_PLEX_HANDOFF.md` · `ASYNC_EXPORT_HANDOFF.md`.
> **Visual target:** `redesign.html` + `redesign/*.jsx` — a fully-interactive prototype of the whole app in the new design language. Open it side-by-side while implementing.

**For:** Claude Code, in `bande-rythmo-app/`.
**Goal:** bring the live React app onto the redesign's design language **without losing any existing feature.** The prototype is design intent; your code remains the behavior source of truth.

---

## 0 · What this is / isn't

The redesign is a **look + IA** target, mocked with static data. It is NOT a drop-in: keep all your real logic (canvas RAF, Whisper calls, ffmpeg, autosave, drag math). Re-skin and re-organize around it.

**Nothing in the current app should regress.** Every feature below already exists in your code and appears in the redesign — match them up, don't drop them.

---

## 1 · Design tokens (port verbatim to `index.css` / a theme module)

```
bg #0b0b0d · bg2 #101013 · surface #16161a · surface2 #1c1c21 · surface3 #24242b
border #26262d · border2 #32323b · border3 #3f3f4a
text #ECECEF · text2 #A6A6AE · text3 #7A7A85 · text4 #565660   ← text3/4 bumped lighter for legibility
accent #F5C518 (CSS var --accent, swappable) · danger #E8595D · success #5EC27C · info #5AA9F0 · violet #A98BF0
tracks: LÉA #F5C518 · MARC #5AA9F0 · SARAH #F06AA0 · NOAH #5EC27C
fonts: UI 'IBM Plex Sans' · mono 'JetBrains Mono' · band 'Caveat' (manuscrite)
radii: chip 6 · control 9 · card 14 · lg 18
type scale: 11 / 12 / 13 / 14 / 16 / 20 / 26 / 34
```

Source of truth: `redesign/foundation.jsx` → `T`.

---

## 2 · The critique closers (do these first — fast, high-impact)

1. **Hit targets ≥ 32px app-wide.** The editor/band toolbars are still 17–24px. Adopt the `Btn` primitive (sizes sm 30 / md 36 / lg 42) and `Cluster` grouping from `foundation.jsx` everywhere — especially `DubbingWorkspace` toolbars. ~biggest a11y win.
2. **Kill the emoji.** Swap every 🌐 🎚 📁 🔌 ▶ ⏸ etc. for the single SVG set in `Icons.jsx` (the redesign's `ICONS` is the complete reference — globe, proxy, book, keyboard, undo/redo, etc. are all there). No unicode glyphs in UI chrome.
3. **Contrast.** Bump `--text3`/`--text4` to `#7A7A85` / `#565660` (done in redesign) so meta text clears ~4:1.

---

## 3 · Shell

- **Left icon rail** (74px) with labeled items: Bibliothèque · Importer · Éditeur · Studio · Atelier, then Activité · Réglages at the foot, plus a `WHISPER · BASE` vertical indicator. Active item = accent tint + left bar.
- **Top bar** with a **command palette** trigger (⌘K / `/`) and a **keyboard (?)** shortcuts button.
- **Command palette** (`⌘K`) — fuzzy nav + actions. **Shortcuts overlay** (`?`) — the full keymap modal (you already have `ShortcutsOverlay.jsx`; restyle to `redesign/shell.jsx`).
- Editor is **full-bleed** (its own top bar); other screens use the shell top bar.

---

## 4 · Screen-by-screen feature checklist (must all survive)

**Bibliothèque** — clip grid, status badges (À faire/Doublage/À revoir/Validé), search, **project selector** (folder grouping), sort select, hover action row (Doubler/mic/MP3/GIF/trash).

**Importer** — source tabs **Fichier / Plex / URL**; **stream + audio-track picker** (5.1→stéréo remux note); zoomable timeline + minimap; **inline-rename** pending clips (no preset name field); Ctrl+S batch; Plex connect (token) + library browser.

**Éditeur** (centerpiece) — keep all current behavior, re-skin:
- Video hero + burned-in subtitle overlay + **SMPTE TC chip** + **VO/Proxy** toggle.
- Transport (frame-step, speed 0.5–2×, scrubber).
- **Timeline-nav bar** (waveform + subtitle blocks + boucle bands + view bracket).
- **Band canvas**: elastic per-word text, **manuscrite font**, **stretch markers**, **détection layer** (labiale/semi/fricative/arrondie/ouverte), **START/BIP/PI**, **boucles**, **scene-cut PLAN markers**, **hold-drag scrub**, double-click edit, right-click context menu, click-letter détection.
- **Clustered toolbar**: edit (add/cut/loop) · insert (Respirations/Réactions menus) · flags (off/dos/ambiance) + **Plans** menu · note · détection · font select · lock · zoom.
- **Undo/redo** buttons · **Sous-titres** menu (Transcribe / **import SRT·ASS·VTT** / export).
- **Inspector tabs**: Répliques · Voix (distribution + reassign) · Détection (sign toggles + **wordByWord/stretch/waveform** affichage toggles + font) · Boucles · **Lexique** (terms + **Traduire auto**).

**Studio** — mic + live meter, pre-roll, take queue, **A/B compare**, validate take.

**Atelier** — Meme/GIF/Audio source modes (shared IN-OUT player), meme editor with **layer reorder/duplicate/nudge**.

**Activité** — async job center: en cours (progress + cancel) / échecs (retry) / terminé (re-download). Surfaced from top bar.

**Réglages** — accent swatches (live swap), BR style, density, Whisper model+lang+engine, Plex, export defaults+GPU, **custom font upload**, **AI vocal separation**, **auto-translation engine**.

**Export** — formats grouped by intent (Vidéo BR / Sous-titres incl. **ASS-karaoke** / Docs studio **DetX + Croisillé** / Audio); contextual options incl. **custom time-range (Plage)**; **download queue** with progress + per-item re-download. Détection-burn stays OFF by default (clean YouTube MP4).

---

## 5 · Build order

1. Tokens + `Btn`/`Chip`/`Select`/`Popover` primitives → `index.css` + a `ui/` module. (§1, §2)
2. Shell: rail + top bar + command palette + shortcuts overlay. (§3)
3. Re-skin screens outside-in: Bibliothèque → Import → Clips → **Éditeur last** (most logic). (§4)
4. Verify each feature in §4 still works against real data before moving on.

Where prototype and code disagree on behavior, **code wins** — the prototype only defines look and arrangement.
