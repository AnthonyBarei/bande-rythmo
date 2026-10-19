# Changelog: redesign v2

The redesign of branch `feat/usable-v1` (`git log --oneline main..HEAD`) ports `design/design_handoff_redesign_v2/reference/` into the app. It ran in rounds R1–R8 plus a final acceptance pass. R1 covers tasks T0–T14, and R2–R8 follow `FIXES*.md`. Business logic, API calls, the canvas engine and keyboard handlers were kept throughout. This file lists what changed on each screen.

Proof captures are in `design/app_screens_2026-10-14_final/` at `1440x900/` and `1100x800/`. That folder also holds `greps.txt`, `focus.txt` and `checklist.md`.

## Shell
- **R1:** 74px rail, 52px top bar with a search pill, keyboard and activity buttons and an avatar. Command palette (560px, 12vh, blur) and shortcuts overlay ported from `shell.jsx`. The Éditeur is full-bleed with no shell top bar.
- **R3:** rail items are 62×52 with no-wrap labels. The global `N` key opens Importer (guarded while typing, with modifiers, in modals and on the edit screens).
- **R4 / R8:** shortcuts overlay. In R4 the header is sticky and the rows scroll. From R8, it uses 3 columns at ≥ 1280px (Transport + Studio · Bande rythmo + Gestes · Général) and fits 1440×900 without scrolling. Below 1280px it scrolls inside the panel with a 24px fade.
- **R7:** `/` focuses the screen's search (Bibliothèque) and otherwise opens the palette.
- **R1–R5:** reloading the page restores the open view and clip.

## Bibliothèque
- **R1:** reference header (34px title, mono count, search pill, primary "Nouveau clip" with an icon tile and an `N` chip). 42px filter row with a project `Select`, status tabs with mono counts and a sort `Select`. `auto-fill minmax(300px)` grid.
- **R1:** cards have a 168px thumbnail, a play button, a status label that cycles on click, the duration and overlapping avatars. The action row (Doubler · mic · MP3 · GIF · trash) appears on hover only.
- **R5–R8:**
  - "+ Projet" shows on hover or focus and sits on the thumbnail.
  - Durations read M:SS / H:MM:SS.
  - Hovering no longer moves the grid (R7).
  - The action row overlays the meta row, so cards keep the same height at rest and on hover (R8).
- **Final:**
  - The meta row is 22px minimum, so the hover row never covers the title.
  - The filter tabs and the card action cells use an inset focus ring.

## Importer
- **R1:** reference header, source tabs (Fichier / Plex / URL), preview, zoom timeline with minimap, pending clips, a 264px "Flux détectés" stream and audio picker, and Plex browsing (libraries card and poster grid).
- **R2–R3:**
  - Readable source title (filename → Plex title → URL).
  - Ruler ticks every 10s.
  - The minimap window can be dragged and clicked to center.
- **R4:** new player (`ImportPlayer`) with a seek bar, an editable HH:MM:SS:FF field, ±1 frame steps and a unified IN/OUT model shared by keys, the cluster, the header button and the timeline. `Ctrl/⌘+S` creates "N clips".
- **R5–R7:**
  - SMPTE IN/OUT.
  - Inline name field "Nom du clip…" (no global name field).
  - Audio streams report codec, channels and language.
  - Labels "Créer le clip" / "Créer N clips".
  - Ruler in HH:MM:SS (R6).
- **Final:**
  - The header meta line shows the source duration as SMPTE (it was `01:06.46`).
  - Long source titles have a tooltip.
  - Timeline hints show whole phrases only (no "g…" at 1100px).
  - The local-file drop zone can be reached and opened from the keyboard.

## Éditeur
- **R1 (T4–T9):** reference layout:
  - 52px header (save chip, undo/redo, VOIX pills, "Sous-titres ▾" menu, shortcuts, Exporter).
  - Video at 74% frame width with a SMPTE chip and a VO/Proxy toggle.
  - **A single 50px transport.**
  - 56px timeline nav.
  - 48px clustered band toolbar.
  - Band.
  - 392px inspector with 5 tabs (Répliques · Voix · Détection · Boucles · Lexique).
  - `DubbingWorkspace` was split into `components/editor/*`.
- **R2–R4:**
  - Band blocks, ticks and marks match the reference.
  - Toolbar menus open upward.
  - Panes can be resized, and the inspector can be hidden with `\`.
  - Boucles can be dragged in the timeline nav.
  - Band marks have a fixed size.
- **R5:**
  - The band renderer is extracted to `components/band/`, with pixel-identical output.
  - SMPTE in the transport and the réplique rows.
  - One font control.
  - Speech-rate colours on durations.
- **R6:**
  - Meaningful line flags.
  - Hover actions on the TC line.
  - Roomier transport (current TC only, compact speed `Select`).
  - Character focus on the band.
- **R7 / R8:** one font list everywhere (Manuscrite · Lisible · Feutre · Neutre · Mono). "Neutre" is IBM Plex Sans; Inter is legacy only.
- **Final:**
  - At narrow widths the transport and band toolbar wrap onto a second row instead of clipping (at 1100px the scrub was 0px and the font/zoom cluster was hidden).
  - The "Sous-titres" menu is 236px wide (no ellipsis).
  - The loop chip, the context menu and the band hover label use SMPTE.
  - Détection-sign samples are drawn as SVG instead of glyphs.
  - Réplique row actions use `Btn size="xs"`, which replaces `ROW_BTN`.

## Studio
- **R1 (T11):** own screen (`StudioScreen`) with the booth plus a 340px PRISES / A-B column. The embedded recorder stays in the inspector.
- **R2:** real 3s pré-roll (3-2-1 count-in, lead trimmed client-side), live mic meter, best take and "Valider la prise", take waveforms.
- **R5:** real dubbing stage on the shared band renderer: line strip, image with TC/REC overlays, read-only rolling band, 32-bar meter, auto-stop.
- **R6:**
  - Valider sits under the takes.
  - Empty states.
  - Cancel shows as a status.
  - The band focuses the current character.
- **R7 (phase 2):** "Écouter sur l'image" (VO level from Réglages), ←/→ (same character) and Alt+←/→ navigation, A/B with Tab swap, character progress, and an "all validated" toast that opens the MP4 doublé export.
- **R8:**
  - Progress label "Red · 1/30 validées" (success colour when complete).
  - Full "validée" chip.
  - "+" pill to assign A/B.
  - Only the Caveat text slides.
- **Final:**
  - The "PRISE n" overlay, "Prise en cours" and "basculer" use `Icon`/`Dot` instead of ▶ ● ⇄.
  - The recording counter reads `x.xs`.
  - Take cards can be selected from the keyboard (inset ring).

## Atelier
- **R1 (T13):** `ScreenHeader` plus an Image / GIF / Audio `Segmented`. `1fr 280px` source grid, `1fr 300px` meme editor.
- **R3–R4:**
  - Clip picker in the header.
  - Short videos (≤ 60s) import inline; longer ones open in Importer and come back.
  - Single no-source card.
  - Player sized to the video's own aspect ratio.
- **R5:** inline job errors with Réessayer. GIF range defaults to ±3s around the playhead and is drawn like the Importer's.
- **Final:**
  - Layer rows use `Btn size="xs"` (no `rowBtn`).
  - The duplicate hint uses an icon (no ⎘).
  - Layer rows can be selected from the keyboard.

## Exporter
- **R1 (T10):** `ScreenHeader` plus one card in 3 columns: grouped format tiles (320px, with RENDU badges), options (300px) and a queue/downloads column. It renders in an App slot, so the editor stays mounted. Opened with `E`, closed with `Échap`.
- **R2–R5:**
  - Queue capped at 8 with "Voir tout" / "Vider".
  - "Lancer l'export" is never blocked.
  - Badge colours per format family.
  - Font follows the band unless overridden.
- **R4:** only the newest file gets a primary Télécharger.
- **R6:** fade on the format column.
- **R8:** "Police BR" uses the shared font `Select`.
- **Final:**
  - Compact queue (icon-only downloads, tooltips) when the column is under 460px, so nothing is cut at 1100px.
  - Custom-range IN/OUT are SMPTE chips on one line, with the duration on the label row.

## Activité
- **R1 (T14):** groups for running jobs (progress + cancel), failures (Réessayer) and finished jobs (re-download), wired to jobs and the export history.
- **R2:** session history of finished jobs, "Ouvrir le clip", the TERMINÉ list capped at 10 with an expand control.
- **R5–R6:** identical failures grouped ×N. Two-row errors (message + Réessayer · Détails), aligned action group.
- **Final:** the stage label no longer spills out of its box.

## Réglages
- **R1 (T14):** reference sections (≤ 720px) and field rows. All settings kept: accent (live), band style and font, density, font upload, vocal separation, translation, Whisper model and language, Plex, export defaults.
- **R2:** the custom accent swatch is dashed with a "+" and fills once set.
- **R7:** Studio "VO pendant l'écoute" setting.
- **Final:** toggles have an accessible name and work from the keyboard. The custom-colour swatch shows a focus ring.

## Cross-cutting
- **Tokens (R1):** reference `T` values as CSS variables (surfaces, borders, text, accent, tracks, radii, shadows, type scale). The accent swap recolours everything.
- **Primitives (R1):** `ui.jsx` is a line-for-line port of `foundation.jsx` (`Btn`, `Chip`, `Dot`, `Card`, `Avatar`, `SectionLabel`, `Kbd`, `Toggle`, `Segmented`, `Popover`, `Menu*`, `Select`, `ProgressBar`, `ScreenHeader`), plus `Splitter` (R3). `Icons.jsx` is the reference set.
  - **Final:** `Btn size="xs"` (22px) and the `pressable()` helper (keyboard activation for clickable non-buttons, used by `Chip`, `Card` and `Toggle`).
- **Toasts (R4 → R8):** route-aware. One bottom-right dock shared by progress cards and app toasts, sitting above the Éditeur hint bar (R8). Identical running jobs collapse into one ×N toast (R7).
- **Errors (R5):** `friendlyError` gives one French sentence plus Détails. `<JobError>` with Réessayer. Grouped failures.
- **Fonts:** IBM Plex Sans for the UI and JetBrains Mono for monospace. Inter appears only as a legacy band font (R8). Band fonts: Caveat, Atkinson, Shantell, Plex, JetBrains, plus uploads.
- **Timecodes (R4 → final):** every timecode on screen is SMPTE `HH:MM:SS:FF` at the clip fps. Durations stay `x.xs`. The final pass removed the last `MM:SS.s` uses.
- **Shortcuts:** `?`, `⌘K`, `/`, `N`, `E`, `\`, `R`, `I`/`O`/`S`, frame steps, Studio ←/→ · Alt+←/→ · Tab · Échap. All are listed in the overlay.
- **Focus (final):**
  - The `:focus-visible` ring is `!important`, so the primitives' inline box-shadows no longer hide it.
  - Inset ring (`.focus-inset`) for flush controls inside clipped strips.
  - Ring on labels wrapping hidden inputs.
  - Toggles, the drop zone, take cards, boucle/queue rows, meme layers, rename and phonetic edits are now focusable and work with Enter/Space.
  - Result: 0 controls without a visible ring (`focus.txt`).
- **Disabled buttons (R3):** they explain why through a tooltip on a wrapper.

## Known gaps
- **IBM Plex Sans in exports:** `IBMPlexSans-SemiBold.ttf` is now bundled (`3fe9557`). Before that, MP4 exports of the "Neutre" font fell back to Inter. The fallback, logged, still applies if the file goes missing.
- **Shantell Sans ("Feutre")** is not bundled in `backend/fonts/`. The canvas uses Google Fonts, but MP4 export falls back to Atkinson Hyperlegible (logged).
- **Not testable headlessly** (see `checklist.md`):
  - The 5.1 → stéréo remux note (needs a multichannel source and a server job).
  - Band gestures that edit répliques: hold-drag scrub, double-click edit, click-letter détection (they would autosave).
  - Real recordings, validations and exports (they write data; checked only up to the mocked request).
  - Band canvas rendering was checked visually on the captures.
- **Library card actions:** the row is revealed on focus-within by React, so very fast Tab presses (under about 100 ms apart) can skip it.
- **`VideoPlayer.jsx`** is no longer imported anywhere (dead code that still has an `MM:SS.ss` formatter). It was left in place because removing it is out of scope.
