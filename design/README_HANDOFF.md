# Bande Rythmo — handoff index (read me first)

This package is the design + UX handoff for the Bande Rythmo dubbing app. It pairs **written specs** (these `.md` files) with two **visual references**: `index.html` (the artboard canvas — before/afters and concepts) and **`redesign.html`** (a fully-interactive prototype of the *whole app* in the new design language — open it and click through).

> **Rule:** where a spec and the visual mock disagree on *behaviour*, the **spec wins** — the mock is visual intent. And where this design package and the **real codebase** disagree on existing behaviour, the **codebase wins** unless a spec explicitly says to change it.

---

## Read in this order

1. **`UX_REVIEW.md`** — app-wide review. Start here: it frames the whole app and lists the priorities. **Fix the 🔴 items before anything else.**
2. **`DESIGN_SYSTEM_REFRESH.md`** — type scale, control sizes + 32px tap floor, and the icon audit (retire unicode glyphs). A presentation-layer pass that makes the app legible and modern **without re-skinning**. Apply its tokens **before** the page restyles, since those consume them.
3. **`PRO_BR_HANDOFF.md`** — the professional bande-rythmo feature layer (elastic text, détection, boucles, SMPTE, DetX, croisillé). The biggest *feature* spec.
4. **`DOUBLAGE_IA_REVIEW.md`** — refinement pass on the Doublage page: toolbar reorg (6 clusters + Affichage), one-transport rule, header-pill filtering, click-letter détection, default "pro classique" look, and the **z-index fix** for dropdowns hiding under the video.
5. **`MEME_PLEX_HANDOFF.md`** — restyle + IA for the Plex source (incl. the connect screen) and the Meme / GIF / Audio atelier.
6. **`ASYNC_EXPORT_HANDOFF.md`** — the global **Activité** page (one home for every long job) and the **export redesign** (formats grouped by intent + a "File d'attente & téléchargements" list). Pairs with 🔴 #1 — the job plumbing already exists, this gives it a surface.
7. **`REDESIGN_ADOPTION_HANDOFF.md`** — **the consolidation doc.** How to adopt the full new design language (`redesign.html`) across the app without regressing any feature: tokens, the three critique closers (32px targets, emoji→SVG, contrast), the shell, and a screen-by-screen feature checklist. Read this once the 🔴 items are done and you're ready for the visual refresh; it supersedes the per-page restyle notes where they overlap.

Docs 2–7 cross-reference each other; doc 1 is the map. **`redesign.html` is the single up-to-date visual target** — it reflects every current feature; the canvas in `index.html` is the historical exploration.

---

## Do these 🔴 first (from `UX_REVIEW.md`)

1. **Progress + cancel** for the three long operations — Whisper transcription, MP4 burn-in export, Plex remux. Today they show a bare spinner and look frozen. One shared progress surface (determinate where possible, staged otherwise) with **Annuler**. *(Largely built already in `ProgressContext.jsx` — `ASYNC_EXPORT_HANDOFF.md` gives it the **Activité page** + export-queue surface it's missing.)*
2. **Shortcuts overlay** (wire the existing `Raccourcis` button to a real modal using the key map in `PRO_BR_HANDOFF.md` §7) + light **first-run guidance**.
3. **Undo / cancel in BR editing** (or undo-toasts for destructive deletes).

Then the 🟡 items: one reusable `<VideoPlayer>`, explicit clickable status lifecycle, confirm/undo deletes, one-click retry on failures. The **design-system refresh** (`DESIGN_SYSTEM_REFRESH.md`) can run in parallel — it's low-risk and makes every later screen consistent.

---

## Ground truth to respect

- **Navigation is `Importer · Mes Clips · Memes · Réglages`.** Doublage is reached **contextually** (open a clip → Doubler) — do **not** add a Doublage nav item, even though the mocks show one for layout convenience.
- **`Réglages` has no design yet** — needs Whisper model + default language, Plex connection, export defaults, theme/accent.
- **Feature name is "Meme"** (no accent) in the UI. Leave the French word *même* ("same") alone.
- **Don't rebuild what works** — auto-save, the keyboard model, the export pipeline, the elastic-text engine are already correct. The specs extend; they don't replace.

---

## Visual reference map (canvas sections)

`Revue UX` · `Actions asynchrones & export` (Activité + refonte export) · `Refonte visuelle` (type / sizing / icônes) · `Bug du canvas` · `Bande rythmo professionnelle` · `Doublage` · `Revue d'ergonomie` (toolbar before/after + classic default + z-index) · `Le reste de l'app` (Import / Plex connect + browse / Clips) · `Atelier — Meme · GIF · Audio`.
