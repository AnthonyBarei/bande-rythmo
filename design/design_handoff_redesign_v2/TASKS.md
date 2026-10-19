# TASKS: do these in order, one at a time

Each task gives you three things: the **picture** to match, the **source** to copy, and the **file** to change. When a task is done, take a screenshot of the app at 1440×900 and put it next to the picture. If they don't match, the task isn't done.

All paths are relative to `design_handoff_redesign_v2/`. In each `*-annotated.png`, the colored boxes are numbered regions. Each label gives the region's name and its **size in px at 1440×900**.

**Rule for every task:** copy the JSX and inline styles from the reference function into the target file. Then swap the mock data (`window.RDATA`) for the real state and handlers that already exist in that file. Don't design anything new, and don't keep the old layout.

---

## T0 · Tokens + primitives
- **Picture:** none. This task is the base for every other one.
- **Source:** `reference/redesign/foundation.jsx` (all of it)
- **Files:** `frontend/src/index.css`, `frontend/src/ui.jsx`, `frontend/src/Icons.jsx`
- **Steps:**
  1. In `index.css`, set every color variable to the hex values in `T` (see the list in README, Step 0).
  2. Set the body font to `'IBM Plex Sans'` at 14px, antialiased.
  3. Rewrite `ui.jsx` so that each primitive (`Btn`, `Chip`, `Dot`, `Card`, `Avatar`, `SectionLabel`, `Kbd`, `Toggle`, `Segmented`, `Popover`, `MenuItem`, `MenuLabel`, `MenuSep`, `Select`, `ProgressBar`) is a copy of the one in `foundation.jsx`. Keep the same sizes and props. Read `T.x` from CSS variables.
  4. Replace the icon set with `ICONS` and `Icon` from `foundation.jsx`.
- **Done when:** the app still runs, and a `<Btn variant="primary" size="lg">` measures 42px high with a 9px radius.

## T1 · Rail + top bar
- **Picture:** `screens/library/02-library-annotated.png`, boxes 1 and 2
- **Source:** `reference/redesign/shell.jsx` → `Rail`, `TopBar`
- **Files:** `components/Sidebar.jsx`, `App.jsx`
- **Done when:** the rail is 74px wide with 52×52 items and the active item has the yellow bar on its left edge. The top bar is 52px high with the round search pill on the right. On the Éditeur screen there is **no** top bar.

## T2 · Command palette + shortcuts
- **Pictures:** `screens/shell/02-command-palette.png`, `screens/shell/03-shortcuts-overlay.png`
- **Source:** `shell.jsx` → `CommandPalette`, `ShortcutsOverlay`
- **Files:** `components/CommandPalette.jsx`, `components/ShortcutsOverlay.jsx`

## T3 · Bibliothèque
- **Pictures:** `screens/library/01-library.png`, `02-library-annotated.png`, `03-library-card-hover.png`
- **Source:** `reference/redesign/screen-library.jsx` → `Library`, `ClipCard`
- **Files:** `components/ClipsLibrary.jsx`, `components/ClipCard.jsx`
- **Steps:**
  1. Box 3 is the header: a small `BIBLIOTHÈQUE` kicker, the 34px title "Mes clips", the mono count, the search pill, and the yellow "Nouveau clip" button.
  2. Box 4 is a 42px row: project select, status tabs with count badges and a yellow underline on the active tab, and the sort select on the right.
  3. Box 5 is a grid with `repeat(auto-fill,minmax(300px,1fr))`, an 18px gap and 28px padding.
  4. Box 6 is the card: a 168px thumbnail, status label top-left, duration bottom-right, then title and avatars. The **action row (Doubler · mic · MP3 · GIF · trash) appears only on hover**, as shown in `03-library-card-hover.png`.

## T4 · Éditeur: split the file (no visual change)
- **File:** `components/DubbingWorkspace.jsx`
- **Steps:** move JSX into `components/editor/EditorHeader.jsx`, `VideoStage.jsx`, `Transport.jsx`, `TimelineNav.jsx`, `BandToolbar.jsx` and `Inspector.jsx`, plus one file per inspector tab. Pass everything through props. Leave the canvas, drag logic and keyboard code in `DubbingWorkspace.jsx`.
- **Done when:** the app looks and behaves exactly as before.

## T5 · Éditeur: overall layout
- **Pictures:** `screens/editor/01-editor.png`, `02-editor-annotated.png`
- **Source:** `reference/redesign/screen-editor.jsx` → `Editor` (the return block)
- **File:** `DubbingWorkspace.jsx`
- **Make this exact structure (box numbers from `02-editor-annotated.png`):**
  ```
  row
  ├─ Rail (box 1)
  └─ column
     ├─ EditorHeader               52px        (box 2)
     └─ row
        ├─ column (flex 1)
        │  ├─ VideoStage           flex 1      (box 3)  black, frame 74% wide 16:9
        │  ├─ Transport            50px        (box 4)  ← the ONLY play controls on screen
        │  ├─ TimelineNav          56px        (box 5)
        │  ├─ BandToolbar          48px        (box 6)
        │  └─ BandCanvas           rest        (box 7)
        └─ Inspector               392px fixed (box 8)
  ```
- **Done when:** the regions are in the same order and at the same sizes as `02-editor-annotated.png`. Any other play or transport bar has been deleted.

## T6 · Éditeur: header
- **Picture:** top strip of `screens/editor/01-editor.png`
- **Source:** `Editor` → the "Top bar" block
- **File:** `editor/EditorHeader.jsx`
- **Order, left to right:** back button · title, with the mono meta line under it · green "Sauvegardé" chip · undo · redo · *spacer* · `VOIX` label · character pills (one per character, tinted with the track color) · divider · "Sous-titres ▾" menu (`screens/editor/09-menu-sous-titres.png`) · keyboard icon · yellow "Exporter" button.

## T7 · Éditeur: transport + timeline nav
- **Picture:** boxes 4 and 5 of `02-editor-annotated.png`
- **Source:** `Transport`, `TimelineNav`
- **Files:** `editor/Transport.jsx`, `editor/TimelineNav.jsx`
- **Transport, left to right:** start · −1 frame · **yellow 40×36 play button** · +1 frame · end · mono time · thin scrub bar with a round knob · speed segmented control (0.5× 1× 1.5× 2×) · volume.

## T8 · Éditeur: band toolbar
- **Picture:** `screens/editor/03-editor-toolbar-annotated.png`
- **Source:** `BandToolbar`
- **File:** `editor/BandToolbar.jsx`
- **Steps:** group the buttons into **clusters**. Each cluster is a box with a `surface2` background, a 1px border, radius 9 and 3px padding.
  - Box 1: add · cut · loop
  - Box 2: Resp. ▾ · Réact. ▾
  - Box 3: état · plans · note
  - Box 4: Détection toggle
  - Box 7: spacer
  - Box 5: font select, 132px
  - Box 6: lock · zoom− · `150px/s` · zoom+

  Any app button that isn't in the reference goes into the closest cluster.

## T9 · Éditeur: inspector
- **Pictures:** `screens/editor/04-editor-inspector-annotated.png`, then `05-tab-voix.png`, `06-tab-detection.png`, `07-tab-boucles.png`, `08-tab-lexique.png`
- **Source:** `Inspector`, `ReplList`, `VoixPanel`, `DetPanel`, `LoopPanel`, `LexiconPanel`
- **File:** `editor/Inspector.jsx` and the tab files
- **Structure:**
  1. Header for the active réplique: a big avatar, the name, the timecode range and a red record button, on a background tinted with the track color.
  2. Five tabs with a yellow underline on the active one.
  3. The tab body.
  4. The bottom hint bar.

## T10 · Exporter
- **Pictures:** `screens/export/01-export.png`, `02-export-annotated.png`
- **Source:** `screen-record-export.jsx` → `Export`, `QueueRow`, `ExportOptions`, `RangeField`, `ScreenHeader`
- **File:** `components/ExportPanel.jsx`
- **Structure:** `ScreenHeader` (box 3), then **one card with 3 columns**: formats, 320px (box 4) · options, 300px (box 5) · queue and downloads, remaining width (box 6).

## T11 · Studio
- **Pictures:** `screens/studio/01-studio.png`, `02-studio-annotated.png`
- **Source:** `screen-record-export.jsx` → `Record`
- **File:** `components/RecorderPanel.jsx`
- **Structure:** `ScreenHeader`, then the booth on the left (box 4) and the takes plus A/B column on the right, 340px (box 5).

## T12 · Importer
- **Pictures:** `screens/import/01-import.png`, `02-import-annotated.png`
- **Source:** `screen-import.jsx` → `Import`, `Preview`, `ZoomTimeline`, `PendingList`, `StreamPicker`, `PlexBrowse`
- **Files:** `components/ImportSection.jsx`, `VideoEditor.jsx`, `TimelineBar.jsx`, `PlexBrowser.jsx`
- **Structure:** header with the source tabs (Fichier local · Plex · URL/Stream) (box 3) · preview, timeline and pending clips on the left (box 4) · "Flux détectés" panel, 264px, on the right (box 5).

## T13 · Atelier
- **Pictures:** `screens/atelier/01-atelier.png`, `02-atelier-annotated.png`
- **Source:** `screen-misc.jsx` → `Meme`, `ImageMode`, `RangeMode`, `MemeEditor`
- **File:** `components/MemeGenerator.jsx`
- **Structure:** `ScreenHeader` · mode tabs · a 2-column grid (`1fr 280px`, gap 22).

## T14 · Activité + Réglages
- **Pictures:** `screens/activity/*`, `screens/settings/*`
- **Source:** `screen-misc.jsx` → `Activity`, `RunRow`, `DoneRow`, `Settings`
- **Files:** `components/ActivityCenter.jsx`, `components/Preferences.jsx`
- **Réglages:** sections are cards, at most 720px wide, each holding label/control rows.
