# Handoff v2: make the app look like the design

**For:** Claude Code, working in `bande-rythmo/frontend/src/`.
**This document replaces** `REDESIGN_ADOPTION_HANDOFF.md` and `CODE_REVIEW_HANDOFF.md` on everything visual. Where they disagree with this folder, this folder wins.

## Why the last pass didn't match

The earlier handoffs listed changes as diffs ("set X to 11px", "use `Btn` here"). The result was the old layouts with new tokens. The screens in the app still have the old structure, spacing and hierarchy, so they don't look like the design.

This time the design source is included. **`reference/` is the spec.** It is plain React with inline styles, the same stack as the app. Port it, don't interpret it.

## What's in this folder

- `HOME.md`: **start here.** The landing page rework (app tokens, bande rythmo strip, flow tabs). The reference is `reference/home.html`.
- `ACCOUNT.md`: Login / register, the top-bar account menu, the Mon compte page, and the home links. The reference is in `reference/`.
- `FIXES_STUDIO_R2.md`: This is the review of the Studio v2 proofs: the behaviour is accepted, and 7 layout and polish items remain.
- `STUDIO_V2.md`: the Studio rework spec. Studio rework: role picker, Par réplique / En continu modes, countdown on a frozen image, and a held "prêt" state between répliques.
- `CLOSED.md`: **the redesign is closed.** It lists the backlog items to carry over.
- `FINAL_REVIEW.md`: the final review. It's done.
- `FIXES_R8.md`: **round 8.** It's done, and so is the final acceptance pass.
- `FIXES_R7.md`: **round 7.** It's done.
- `FIXES_R6.md`: **round 6.** It's done.
- `FIXES_R5.md`: **round 5.** This is the polish pass plus the Studio stage. It's done. #10 came from the capture mock.
- `FIXES_R4.md`: **round 4.** It is the review of the r3 screenshots.
- `FIXES_R3.md`: **round 3.** It is the review of the r2 screenshots: what's done, what's not done, what's partial, and what's new.
- `FIXES.md` plus `fixes/*-compare.png`: **round 2.** Design and app side by side, with numbered fix spots. Do these after TASKS.md.
- `TASKS.md`: **the work, split into 15 small tasks (T0–T14).** Each task names a picture, a source function and a target file. Start here.
- `reference/redesign.html` plus `reference/redesign/*.jsx`: the runnable prototype. Open it in a browser at **1440×900** or larger and keep it next to the app while you work.
- `screens/<screen>/`: captures at 1440×900. Each screen has a clean shot and an `-annotated` shot. The annotated shots outline each region and label it with its size in px. The Éditeur folder also has close-ups of the toolbar and inspector, every inspector tab, and the Sous-titres menu.

## Method (follow for every screen)

1. Open the reference component and the app file side by side (see the map below).
2. **Copy the reference JSX tree into the app file**, including element nesting, order, and every inline style value: heights, paddings, gaps, radii, font sizes, weights, letter-spacing and colors.
3. Replace the mock data (`window.RDATA`: `CLIPS`, `SUBS`, `PLEX`, …) with the app's real state, props, hooks and API calls.
4. Reattach the existing handlers to the new elements. Keep all business logic, keyboard handlers, canvas engines and API code where they are.
5. If the app has a control the reference lacks, place it in the closest matching cluster and style it with the same primitive. List each one in your PR description.
6. Compare the result to the running reference at the same window size. Elements should sit in the same places, within a few pixels.

Don't round values, swap in "equivalent" tokens, or keep an old wrapper "for safety". If a reference value looks wrong, copy it anyway and flag it.

## Step 0: foundation (do first, in one PR)

**Tokens.** Use the reference values exactly (`reference/redesign/foundation.jsx` → `T`). This reverses the earlier advice to keep the code's values. Put them in `index.css` as CSS variables:

```
--bg #0b0b0d  --bg2 #101013  --surface #16161a  --surface2 #1c1c21  --surface3 #24242b
--border #26262d  --border2 #32323b  --border3 #3f3f4a
--text #ECECEF  --text2 #A6A6AE  --text3 #7A7A85  --text4 #565660
--accent #F5C518  --accent-dim rgba(245,197,24,.13)
--danger #E8595D  --success #5EC27C  --info #5AA9F0  --violet #A98BF0
tracks: LÉA #F5C518 · MARC #5AA9F0 · SARAH #F06AA0 · NOAH #5EC27C
radii: chip 6 · ctl 9 · card 14 · lg 18
shadow 0 8px 30px rgba(0,0,0,.40) · shadowL 0 18px 60px rgba(0,0,0,.55)
type: 11 / 12 / 13 / 14 / 16 / 20 / 26 / 34
```

**Fonts.** The UI font is `IBM Plex Sans`. Body text is 14px with `-webkit-font-smoothing: antialiased`. Mono is `JetBrains Mono`. `frontend/index.html` also loads Inter, Shantell Sans and Atkinson. Inter must not be used anywhere in the chrome. Keep Atkinson and Caveat only as band fonts.

**Primitives.** `ui.jsx` must be a **line-for-line port** of `foundation.jsx`: `Icon`, `ICONS`, `Btn`, `Chip`, `Dot`, `Card`, `Avatar`, `SectionLabel`, `Kbd`, `Toggle`, `Segmented`, `Popover`, `MenuItem`, `MenuLabel`, `MenuSep`, `Select`, `ProgressBar`, `fmtTC`. Keep the same props, sizes and hover states. Check these specific values:
- `Btn` heights are sm 30, md 36, lg 42. Padding is 0 12 / 0 15 / 0 20. Radius is 9. Icon size is the font size + 3. The ghost hover background is `surface2`.
- `Chip` is a pill (radius 99) with padding 3/9, 12px text, weight 600, a 1px border in the color + `33` alpha, and a background of the color + `1c` when `soft`.
- `Popover` panels use `surface`, a `border2` border, radius 14, `shadowL` and 6px padding. `MenuItem` has 8/10 padding, radius 9 and 13px text.
- `Segmented` has an outer `surface` track with 3px padding and 3px gap. The active segment is filled with the accent and has `#0b0b0d` text.

Also replace `Icons.jsx` with `ICONS` from `foundation.jsx`, using the same paths and stroke widths (1.7 at ≤16px, 1.85 above).

## Step 1: shell

Port `reference/redesign/shell.jsx` → `App.jsx`, `components/Sidebar.jsx`, `CommandPalette.jsx` and `ShortcutsOverlay.jsx`.
- **Rail:** 74px wide, `bg2` background, right border. 14px vertical padding, 6px gap. The logo tile is 40×40, radius 11, accent with a glow. Items are 52×52, radius 13. Active items get an accent `18` background, an accent `44` border and a 3px accent bar at left −9. Icons are 19px.
- **Top bar:** 52px high, `bg` background, bottom border, 0 18px padding, 14px gap. The search pill is 36px high, at least 280px wide and radius 99. Then the keyboard and activity buttons, a divider, and a 30px avatar.
- **The editor is full-bleed:** no shell top bar on that screen.
- **Command palette:** 560px wide, 12vh from the top, with a 3px backdrop blur.
- **Shortcuts overlay:** use the reference layout and rows. See `screens/10-raccourcis.png`.

## Screen map

| Screen | Reference | App file(s) | Capture |
|---|---|---|---|
| Bibliothèque | `screen-library.jsx` → `Library`, `ClipCard` | `ClipsLibrary.jsx`, `ClipCard.jsx` | 01 |
| Importer | `screen-import.jsx` → `Import`, `Preview`, `ZoomTimeline`, `PendingList`, `StreamPicker`, `PlexBrowse` | `ImportSection.jsx`, `VideoEditor.jsx`, `TimelineBar.jsx`, `PlexBrowser.jsx` | 02 |
| Éditeur | `screen-editor.jsx` → `Editor`, `Transport`, `TimelineNav`, `BandToolbar`, `Inspector` + tab panels | `DubbingWorkspace.jsx` (+ the `editor/*` split below), `VideoPlayer.jsx`, `SubtitleEditor.jsx`, `LexiconPanel.jsx` | 03 |
| Studio | `screen-record-export.jsx` → `Record` | `RecorderPanel.jsx` | 04 |
| Atelier | `screen-misc.jsx` → `Meme`, `ImageMode`, `RangeMode`, `MemeEditor` | `MemeGenerator.jsx` | 05 |
| Activité | `screen-misc.jsx` → `Activity`, `RunRow`, `DoneRow` | `ActivityCenter.jsx` | 06 |
| Réglages | `screen-misc.jsx` → `Settings` | `Preferences.jsx` | 07 |
| Exporter | `screen-record-export.jsx` → `Export`, `QueueRow`, `ExportOptions`, `RangeField` | `ExportPanel.jsx` | 09 |
| Screen header (shared) | `screen-record-export.jsx` → `ScreenHeader` | `ui.jsx` | — |

## Layout contracts (the measurements that make each screen read right)

These are pulled from the reference so you can check them quickly. The JSX remains the full source.

**Bibliothèque**
- Header padding is 26 32 0. Kicker is 11px, weight 600, letter-spacing 1.4, `text3`. Title is **34px**, weight 600, letter-spacing −0.6. Then the count in mono, a search pill (40px high, at least 260px wide, radius 99) and a primary `lg` "Nouveau clip" button.
- Filter row is 42px high with a bottom border. It holds the project `Select` (158px), a divider, then tabs with mono count badges. The active tab has a 2px accent underline. The sort `Select` sits on the right.
- Grid is `repeat(auto-fill, minmax(300px,1fr))` with an 18px gap and 28px padding.
- Card has a `surface` background and radius 14. The thumbnail is 168px with a 48px round play button, a status label top-left and the duration bottom-right. The body has 13/15 padding: a 14px weight-600 title, then a meta row with overlapping 22px avatars. **Actions appear on hover only**: a 44px row with "Doubler" in accent, then mic, MP3, GIF and trash cells, each 44×44.

**Éditeur** (full-bleed)
- **Header:** 52px high, `surface` background. Contents in order: an outline back button, then the title (14px, weight 600) over a mono meta line, a "Sauvegardé" chip, undo and redo, a flexible spacer, the `VOIX` label, the character pills (18px avatars), a divider, a "Sous-titres" popover, the shortcuts button and a primary "Exporter" button.
- **Body:** a row with the **left column** (flex 1) and the **Inspector** (fixed **392px** wide, `surface` background, left border).
- **The left column stacks, top to bottom:**
  1. **Video area:** flex 1, black. The frame is **74% wide**, 16:9, at most 92% high, radius 8. The timecode chip sits top-left at 14/18 and the VO/Proxy `Segmented sm` top-right.
  2. **Transport:** 50px high, `surface` background, top border. In order: start, −1 frame, a **40×36 accent play button**, +1 frame, end, mono time, a 6px scrub track with a 12px knob, a speed `Segmented` and volume.
  3. **Timeline nav:** 56px high, `bg2` background, top border. A canvas shows the waveform, the subtitle blocks per track color, a dashed loop band and a white playhead.
  4. **Band toolbar:** 48px high, `surface` background, 14px horizontal padding, 8px gap. Buttons are grouped in **clusters**: `surface2` boxes with a border, radius 9 and 3px padding. Left side: [add · cut · loop], [Resp. ▾ · Réact. ▾], [state · plans · note], [Détection]. Then a spacer. Right side: a font `Select` (132px) and [lock · zoom− · px/s readout · zoom+].
  5. **Band canvas:** fills the remaining height.
- **Inspector:** a header for the active réplique (13/16 padding, background in the track color + `0c`, a large avatar and the record button), then the tabs Répliques · Voix · Détection · Boucles · Lexique, then the tab body and a bottom hint bar.
- The single most important rule: **one transport only.** There must be no second play bar inside the band toolbar or the video.

**Studio:** the main area on the left. The right column (340px) holds the PRISES list and the A/B compare.

**Exporter:**
- A `ScreenHeader`, then one card split into 3 columns.
- The **format picker** is 320px wide. Formats are grouped (vidéo / sous-titres / pro). Each one is a tile with an icon tile and a RENDU badge.
- The **options** column is 300px wide: range, quality `Segmented`, toggles and band font.
- The **queue and downloads** column takes the remaining width.

**Atelier:** each mode uses `grid 1fr 280px` (the editor uses `1fr 300px`) with a 22px gap. The video stub is black with radius 14.

**Activité / Réglages:** a `ScreenHeader`, then grouped sections. In Activité these are `RunRow` and `DoneRow` (`surface`, radius 9, 13/16 padding).

## Order of work (one PR each, screenshot vs reference in each PR)

1. Foundation (tokens, fonts, `ui.jsx`, icons)
2. Shell
3. Bibliothèque
4. Éditeur. Split first, with no visual change: `editor/EditorHeader`, `VideoStage`, `Transport`, `TimelineNav`, `BandToolbar`, `Inspector` (+ one file per tab). Then port each part from the reference.
5. Exporter
6. Studio
7. Importer / Plex
8. Atelier
9. Activité, Réglages

## Acceptance

- At 1440×900, each app screen overlaid on the matching reference screen shows the same regions, in the same order, with the same sizes.
- No local style objects such as `tBtn`, `btnBase`, `iconBtn`, `SL` or `BTN_GHOST` remain. Every control comes from `ui.jsx`.
- No unicode glyphs are used as icons.
- Changing the accent in Réglages recolors everything that is accent-colored in the reference.
- The feature checklist in `REDESIGN_ADOPTION_HANDOFF.md` §4 still passes, so no behavior is lost.
