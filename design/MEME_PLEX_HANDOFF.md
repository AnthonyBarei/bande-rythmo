# Handoff — Plex & Meme pages (restyle + Meme IA)

> **Companion docs:** `PRO_BR_HANDOFF.md` (BR features) · `DOUBLAGE_IA_REVIEW.md` (Doublage refinement). This doc covers the two pages those skipped: **Plex source** and the **Meme/GIF/Audio atelier**.

**For:** Claude Code, in `bande-rythmo-app/`. Targets: `frontend/src/components/PlexBrowser.jsx`, `frontend/src/components/MemeGenerator.jsx`. Design reference: `index.html` → sections **"Le reste de l'app"** (Plex connect + browse) and **"Atelier — Meme · GIF · Audio"**.

---

## Part 0 — naming

Throughout the UI, the feature is **"Meme"** (no accent). Fix the existing `Mème` / `mème` strings in `MemeGenerator.jsx` (header `<h1>`, any labels). Leave the French word **`même`** (= "same") untouched wherever it legitimately appears.

---

## Part 1 — Restyle (both pages → the pro look)

Both components still wear the **old chrome** (`var(--surface)`, hard `#f5c518` literals, emoji glyphs, 4px radii). Bring them onto the same design language as the rest of the redesign. **No behavior changes in this part — visual only.**

### Shared restyle rules
- **Type:** `--font-ui` = IBM Plex Sans (already the app default); keep `--font-mono` for timecodes/counts only.
- **Radii:** cards/popovers `8px`, controls `6px`, chips `5px` (was a flat `4px` everywhere).
- **Surfaces:** layer with `--bg` → `--surface` → `--surface2`; 1px `--border` hairlines, not heavy lines.
- **Accent:** keep the project accent (`--accent`, currently `#f5c518`) but **always read the CSS var** — no inline `#f5c518` literals (so the Tweaks accent swap works app-wide).
- **Icons:** replace emoji (🎬 🔌 ⏳ ▶) with the line-icon set already used elsewhere (`Icons.jsx`).
- **Buttons:** primary = accent fill on `#000` text, `fontWeight 600`; secondary = `--surface2` + `--border2`; ghost = transparent + `--text2`.
- **Segmented controls:** the source/format pickers become a single pill group (`--surface` track, active = `--bg2` w/ accent underline) — see the Meme source tabs in the mock.

### Plex — two states (the connect step is the part that wasn't applied)
`PlexBrowser.jsx` already has the right **flow** (probe → connect → libraries → grid). Only the **connect screen** lacked a modern target. Restyle to the mock:
- **Connect card** (`PlexConnect`): centered `460px` card; `▶ PLEX` wordmark in Plex amber `#e5a00d`; green "Serveur Plex détecté — {url}" banner when `probe.found`; URL + Token fields as bordered inputs (token masked); primary **Connecter** button; helper line about the connection staying local. Keep the existing probe/connect fetch logic.
- **Browser:** promote libraries from the current **top tabs** to a **left sidebar** (Films / Séries / Musique / Photos with item counts), a search **pill** in the body header, online-status chip (`● ONLINE` + server name + ping) top-right, poster **grid** (`minmax(180px,1fr)`), selected card gets an accent ring + "SÉLECTIONNÉ" badge. Reference: artboards *Plex · navigateur* and *Plex · écran de connexion*.

### Meme — restyle the existing surfaces
Keep the unified page; restyle to artboards *Meme · capturer un frame*, *GIF*, *Audio*, *Éditeur*:
- Source tabs → segmented pill group (Image / GIF / Audio) with line icons.
- Range player chrome: range bar with **blue IN / accent OUT / white playhead**, mono IN·dur·OUT readout, compact transport (« ‹ ▶ › »).
- Editor: canvas card + right **panel** (TEXTES list, STYLE section: police segmented, size slider, text+stroke swatch rows, alignment segmented), primary **Générer**.

---

## Part 2 — Meme page IA review

Same task/frequency lens we applied to Doublage. The Meme page does a lot on one screen; here's the tightening.

### Inventory
| Zone | Controls | Task | Freq |
|---|---|---|---|
| Header | ← Mes clips · titre · clip badge · + Nouveau | navigate/reset | occasional |
| Source tabs | Image · GIF · Audio | choose output | per-session |
| Image mode | video + single scrubber + Capturer ce frame; OR drop zone | pick frame | frequent |
| GIF mode | range player (IN/OUT) + Créer le GIF | pick range | frequent |
| Audio mode | range player (IN/OUT) + MP3 / WAV | pick range + export | frequent |
| Editor | canvas (drag text) · TEXTES list · STYLE (police/taille/couleur/contour/align) · Générer · Résultat | compose | frequent |

### Problems
- **P1 · Two different players on one page.** Image uses a **single-point scrubber**; GIF/Audio use a **range** player. Same video, two transport UIs → relearning per tab.
- **P2 · The flow forks inconsistently.** Image → editor · GIF → editor · **Audio → direct download** (no editor). The page implies all three are symmetric, but one exits early. Nothing tells the user that up front.
- **P3 · Result stacks on top of the source.** After *Générer*, the result image appears in a sub-panel **while the editing canvas is still visible** → two images, unclear which is "the output".
- **P4 · "GIF" is a format name doing duty as a verb.** The tab means "make a GIF from a range". Mixed mental model with "Image" (a frame) and "Audio" (a clip).
- **P5 · No layer affordances beyond add/delete.** No duplicate, no reorder, no nudge — fine for 2 captions, thin if it grows.
- **P6 · Entry ambiguity.** Reached from ClipCard's **GIF** button *and* the sidebar *and* with no clip (drop zone only). The starting tab isn't always the one the user intended.

### Proposed reorganization
**Principle: one player, one consistent "make → (optional) decorate → export" flow.**

1. **Unify the player (fixes P1).** One component with a range bar **always** visible. Image mode = capture at the **playhead** (range handles dimmed); GIF/Audio = use the range. Switching tabs keeps playhead/selection, only changes what the primary button does.
2. **Make the fork explicit (fixes P2/P4).** Rename tabs by *intent*: **Image** · **GIF** · **Extrait audio**. Under the tabs, one line: "Image & GIF passent par l'éditeur de texte · l'audio s'exporte directement." Audio's CTA stays MP3/WAV; Image/GIF CTA reads "Continuer vers l'éditeur →".
3. **Result replaces, or modal (fixes P3).** On *Générer*, swap the canvas for the result in place with **Refaire / Télécharger**, or show it in a focused overlay. Never show source + result stacked.
4. **Layer affordances (P5).** Add duplicate + up/down reorder + arrow-key nudge of the selected text. Keep the 3-font set; it's on-brand for memes.
5. **Entry intent (P6).** ClipCard "GIF" opens the page **on the GIF tab**; sidebar "Memes" opens on **Image**; the drop zone (no clip) opens on **Image** with an "importer" affordance. Persist last-used tab per session.

### Build order
1. Restyle pass (Part 1) — visual only, low risk.
2. Unify the player into one range component with an `imageMode` (playhead-only) flag.
3. Rename tabs + add the one-line flow hint.
4. Result-replaces-source (or modal).
5. Layer duplicate/reorder/nudge.

Reference artboards: *Meme · capturer un frame*, *GIF · sélection de plage IN-OUT*, *Audio · export MP3 / WAV*, *Éditeur de meme · calques de texte*.
