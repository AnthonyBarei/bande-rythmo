# FIXES: round 2, after T0–T14

I compared the app captures in `uploads/app_screens_2026-10-14/` with the design captures in `screens/`, one screen at a time.

**Every screen has a compare image in `fixes/`.**

These match the design, so leave them as they are:
- `library-compare`, `library-hover-compare`
- `palette-compare`, `shortcuts-compare`
- `menu-sous-titres-compare`, `menu-resp-compare`
- `tab-boucles-compare`, `import-empty-compare`

Everything else has a fix below (F1–F8).

Each image in `fixes/` puts the **design on the left** and the **app on the right**. Red numbered circles mark what to fix, and the numbers match the lists below. The source for every fix is in `reference/redesign/`.

After fixing, re-shoot with `shoot.py` and compare again.

---

## F1 · Éditeur: band canvas and timeline (`fixes/editor-compare.png`)
**Source:** `screen-editor.jsx` → `BandCanvas` (the `useEffect` drawing code) and `TimelineNav`
**Files:** `BRTimeline.jsx` / the band canvas renderer, `editor/TimelineNav.jsx`, `editor/Inspector.jsx`

1. **Subtitle blocks are far too heavy.** They currently have a solid olive fill and a full yellow outline. In the design:
   - The fill is the track color at alpha `12` (`22` when active).
   - There is **no outline**, only a **2.5px solid bar on the block's left edge**.
   - The block is inset 3px from the top and bottom of the lane.
   - Inactive text is `rgba(255,255,255,.42)`, active text is `#fff`, and the text is 600 weight, 26px Caveat.
   - Copy these lines exactly:
   ```js
   ctx.fillStyle = tc.hex + (act ? '22' : '12'); ctx.fillRect(left, y0 + 3, bw, trackH - 6);
   ctx.fillStyle = tc.hex; ctx.fillRect(left, y0 + 3, 2.5, trackH - 6);
   ```
   - Add the avatar dot at the top-left of each block: a 16px circle in the track color with the character's initial.
2. **Two timecodes overlap at the bottom of the playhead.** Delete both readouts. The design has no timecode chip on the band. The current time is already shown in the video overlay and the transport. Instead, draw one SMPTE tick per second: a 1px `rgba(255,255,255,.05)` line plus a 9px mono `--text4` label at `h - 2`.
3. **A ruler label (`00:00:00:00`) is drawn over the first block**, top-left of the playhead. Remove it. The only labels at the top of the band are START, BIP and PI (8px mono), and those sit before 0.
4. **Timeline nav: the "TIMELINE · CLIP ENTIER" label collides with the viewport rectangle.** Draw the canvas first and the label on top. The label is 9px mono, bold, `--text4`, at top 5px / left 10px, with `pointer-events: none`. Make the viewport window a 1px `--border3` outline with no fill, so it doesn't box in the label. Also add the loop label (`⟲ B1 …`) top-right in the accent color, as in the design.
5. **Inspector header says "Aucune réplique" with a dimmed record button.** The design always shows a réplique here. Default to the réplique under the playhead, or the last one selected, or the first one, in that order. The record button is a solid `--danger` square with no opacity change. Only show the empty state when the clip has zero répliques.

**Re-capture:** `editor/06-tab-detection.png` actually shows the **Voix** tab, because the shoot clicked the toolbar "Détection" button instead of the inspector tab. Scope the click to the inspector, then compare with `screens/editor/06-tab-detection.png`.

## F2 · Studio (`fixes/studio-compare.png`)
**Source:** `screen-record-export.jsx` → `Record`
**File:** `RecorderPanel.jsx`

1. **The chips are missing at the top-right of the mic stage.** Add `Chip soft accent` "⟲ Pré-roll 3s" and `Chip soft text2` "Micro · <device name>", absolutely positioned at top 14 / right 16.
2. **The meter is a dotted line.** It should be **bars**: 4px wide, 2px gap, inside an 80px-high row. When idle they are `--border3` at varying heights. When recording they turn accent, and `--danger` above 0.8. Wire the bars to the live input level so the actor can see the mic is working before recording.
3. **The takes column is empty and shows tiny centered text.** Design for zero takes:
   - Keep the `PRISES 0` header.
   - Add one dashed card (`2px dashed --border2`, radius 9, padding 18) with the text "Aucune prise. Appuyez sur R pour enregistrer".
   - Show the "Valider la prise sélectionnée" button as `Btn variant="solid" full`, disabled.
   - Once there are takes, each one is a card with play, name, a "meilleure" chip, duration, delete and a mini waveform. See the design.
4. **The réplique card:**
   - The border is the track color at `33`, not grey.
   - Show the direction note under the line as `↳ <note>`, 12px italic accent, when the réplique has one.
   - The avatar is 46px with a ring.

## F3 · Atelier (`fixes/atelier-compare.png`)
**Source:** `screen-misc.jsx` → `Meme`, `ImageMode`, `VideoStub`
**File:** `MemeGenerator.jsx`

1. **The sub line is missing** under the title. Add `clip · <clip name>` in 13px mono `--text3`. When there's no clip, show "aucun clip ouvert".
2. **The mode switch is missing.** Add `Segmented` with Image · GIF · Audio and their icons, in a `0 32px 14px` row between the header and the content. It is always visible.
3. **The preview has no scrub bar.** Add the bottom strip: 12/14 padding, a top border, a 4px track and a 10px accent knob. See `ImageMode`.
4. **The side column is missing its primary action.** At the top, add `Btn primary lg full` "Capturer ce frame". It is disabled when no clip is open. Below it come the hint text and then the dashed drop zone, as today. The column is 280px wide with a 12px gap.

## F4 · Importer (`fixes/import-compare.png`)
**Source:** `screen-import.jsx` → `Import`, `ZoomTimeline`, `PendingList`
**File:** `ImportSection.jsx`, `TimelineBar.jsx`

1. **The disabled "Créer 0 clip" button renders as muddy yellow.** Disabled primary buttons need their own style in `ui.jsx` → `Btn` (`disabled` prop): background `--surface2`, text `--text4`, border `--border`, `cursor: not-allowed`, and greyed Kbd chips. Apply this rule to every disabled primary button in the app.
2. **The title is a raw UUID filename.** Use the original filename, the Plex title or the URL's last path segment, in that order. Fall back to "Vidéo sans titre". Truncate with an ellipsis at the column width, not mid-word.
3. **With zero clips, the timeline is an empty black box** and its hint sits at the bottom right in tiny text. Draw the ruler (mono ticks every 10s, as in `ZoomTimeline`). Put the hint **centered inside the lane** in 13px `--text3`: "Glissez sur la timeline pour délimiter un clip".

## F5 · Réglages (`fixes/settings-compare.png`)
**File:** `Preferences.jsx`

1. **The 7th accent swatch is a square duplicate of yellow.** If it's the custom-color picker, give it the same size and radius as the other swatches, with a `--border2` dashed outline and a `+` icon. When a custom color is set, fill it with that color. Otherwise remove it.

---

## F6 · Exporter (`fixes/export-compare.png`)
**Source:** `screen-record-export.jsx` → `Export`, `QueueRow`
**File:** `ExportPanel.jsx`

The layout matches. The problems are in states the capture didn't show.
1. **The queue header is missing the in-progress chip.** After "File d'attente & téléchargements", add `Chip soft accent` showing `<n> en cours` whenever at least one job is running.
2. **Rows that are still rendering must use the design's look**, as in `QueueRow` with `status === 'render'`:
   - the border is accent `44`
   - a 3px progress bar sits under the filename
   - the stage label (e.g. "Supersample 4") sits right-aligned in 11px mono `--text3`
   - the percentage is 14px bold accent
   - there is a cancel `✕` icon button in place of Télécharger

   Trigger an MP4 export and screenshot it to prove this.
3. **The queue list grows without limit.** Show the 8 most recent finished files. Below them, add a ghost `Btn` reading "Voir tout (n)" that links to Activité, plus a ghost danger "Vider" button.
4. **"Retour" uses a down chevron.** Use `ICONS.chevron` rotated 90°, or add a `chevronL` icon. The design has the same bug, so fix both. This also applies to Studio's "Retour à l'éditeur".
5. **The format tile badges** (RENDU) and the selected tile (green border with a check) already match. Leave them as they are.

## F7 · Activité (`fixes/activity-compare.png`)
**Source:** `screen-misc.jsx` → `Activity`, `GroupLabel`, `RunRow`, `DoneRow`
**File:** `ActivityCenter.jsx`

1. **The page is one 23-row wall of identical yellow buttons.**
   - Cap TERMINÉ at 10 rows and add a "Voir les 13 plus anciens" ghost button under them.
   - Only the **most recent** row of each file keeps the primary `Télécharger`. Older rows use `Btn variant="outline" size="sm"`.
2. **Rows without a file must use their own action.** Transcription rows (no file) use `Ouvrir le clip` (outline, edit icon), as in `DoneRow` `action:'open'`.
3. **The empty groups must still render properly when they have content.**
   - EN COURS uses an accent label, with `RunRow` showing an icon tile, a progress bar, the stage, % and "Annuler".
   - ÉCHECS uses a danger label, with a row background of danger `0c`, a border of danger `44`, the error text in mono danger, and "Réessayer".

   Screenshot each group with real data: start a transcription, and force a failed export.
4. **Header chips:** show `n échec(s)` (danger soft) only when there are failures. The others are already right.

## F8 · Éditeur inspector tabs (`fixes/tab-voix-compare.png`, `fixes/tab-lexique-compare.png`)
**Source:** `VoixPanel`, `LexiconPanel`

1. **Lexique: the "Traduire auto" button is missing.** Add `Btn size="sm" variant="outline" icon={ICONS.globe}` "Traduire auto" on the scope line, on the left, before "Projet « … » + termes globaux". Wire it to the existing auto-translate endpoint. When no provider is configured, disable it with a tooltip pointing to Réglages.
2. **Lexique: the separate "Prononciation" field adds a third input row.** Per the design, the term entry is Terme + Traduction + `+` on one row. Prononciation is set afterwards, from the entry's own row (`/…/` under the term, edited inline on click).
3. **Voix: keep the extra FOCUS and FILE D'ATTENTE blocks**, because they are real features. Restyle them to fit the design:
   - the section labels use `SectionLabel`
   - the FOCUS card uses `surface2` with radius 9 and no yellow border
   - the queue rows are 32px high with 13px text
   - the "enregistrer la réplique" hint moves to the bottom hint bar

## F9 · Importer source switcher: remove the curved yellow underline
**File:** `ImportSection.jsx` (source tabs: Fichier local · Plex · URL / Stream)

The active tab currently uses `box-shadow: inset 0 -2px 0 accent` on a rounded chip. Because of the radius, the underline curves up at both ends.
- Delete the box-shadow.
- Active tab: background `--surface3`, `1px solid --border2`, text `--text` at weight 600. Only the icon is accent.
- Inactive tab: transparent background and a `1px solid transparent` border, so the layout doesn't shift on switch.
- The container (`surface`, `border`, radius 9, padding 5) is unchanged.

The reference `screen-import.jsx` is updated to match.

## F10 · Draggable timeline windows
**Source:** `screen-editor.jsx` → `TimelineNav`, `screen-import.jsx` → `ZoomTimeline` (both updated)

1. **Éditeur, timeline nav: the yellow boucle region is draggable.**
   - It is an absolutely-positioned `div` over the canvas, not drawn on the canvas.
   - Its fill is accent `18` (`26` while dragging) with 2px accent borders on the left and right.
   - Drag the body to move the loop. Drag the 8px edge handles (each a 4×18 accent grip) to trim it, with a minimum length of 0.3s.
   - Use `cursor: grab`, then `grabbing` while dragging.
   - `stopPropagation` on the region and its handles, so a drag doesn't also seek.
   - The top-right label `⟲ B1 SS:FF–SS:FF` updates live.
   - Persist the loop on pointer-up through the existing loops API.
2. **Importer, minimap: the yellow viewport window is draggable.**
   - Drag the window to pan the zoomed timeline.
   - Clicking elsewhere on the minimap centers the window on that point.
   - Clamp the window to [0, 1 − 1/zoom].
   - The header range (`MM:SS – MM:SS sur 42:18`) updates live.
   - The window has a 3-line grip in the middle, `touch-action: none` and grab cursors.

## F11 · Bibliothèque polish
1. **Rail labels overflow** ("Bibliothèque" is wider than the 52px item). Make items **62×52** and set the labels to `white-space: nowrap` with an ellipsis at 58px max. **Remove the 3px yellow bar on the left of the active item.** The tinted background and border are enough.
2. **The project select wraps its text onto 2 lines.**
   - The `Select` trigger gets `white-space: nowrap`, padding `0 10px 0 12px`, and an ellipsis on the label.
   - The library uses `width={176}`.
   - The popover is at least 220px wide, and `MenuItem` labels are `nowrap` with an ellipsis.
3. **Status tabs wrap at narrow widths**: add `white-space: nowrap; flex-shrink: 0` to each tab. Wrap the tabs in a `flex:1; min-width:0; overflow-x:auto` scroller with a hidden scrollbar. The project Select (176px), "Trier" and the sort Select sit **outside** the scroller with `flex-shrink:0`, so their dropdowns aren't clipped and the row never overflows.
4. **Nouveau clip button** (all primary buttons get the base treatment):
   - `Btn primary` gets depth: `inset 0 1px 0 rgba(255,255,255,.35)`, `inset 0 -1px 0 rgba(0,0,0,.12)` and a soft accent drop shadow (`0 4px 14px -6px accent77`). On hover, use `0 8px 22px -6px accentaa` plus `translateY(-1px)`.
   - Nouveau clip has a 28px icon tile (`rgba(11,11,13,.14)`, radius 7, a 16px plus at stroke 2.4), then the label, then a `N` shortcut chip in mono 11px. Wire the `N` key to open Importer.
   - The search pill becomes 42px high to match.

## F12 · Atelier: choose a source clip and upload video
**Source:** `screen-misc.jsx` → `Meme`, `ImageMode`

**Workflow rule:** the Atelier always works on a **clip**.
- A short video (≤ 60s) dropped or uploaded here is imported **inline**. It is saved as a clip in the "Memes & extraits" project, then selected as the source. No trip to Importer.
- A longer video goes to **Importer** with the file preloaded, so it can be cut. When the user clicks "Créer N clips" there, return to Atelier with the first clip selected.
- Image drops go straight into the meme editor, as today.

**UI:**
1. On the right of the header, add a clip `Select` (250px) listing every clip, with a project-colored dot on each. Changing it swaps the source.
2. Next to it, add `Btn outline` with an upload icon, labeled "Vidéo courte…". It opens a file picker (video/*) and follows the rule above.
3. The sub line reads `source · <clip name> · <duration>`.
4. The drop zone text becomes "Glisser une image ou une vidéo" and "PNG · JPG · WEBP · GIF · MP4 ≤ 60 s", with a hint: "Plus longue ? Elle s'ouvre dans Importer pour découper."
5. Backend: reuse the import endpoint with `project="memes"` and skip transcription by default.

## F13 · Éditeur: resizable panes and a hideable inspector
**Source:** `screen-editor.jsx` → `Splitter`, `Editor` (the `bandH`, `inspW` and `inspOpen` state)
**Files:** `DubbingWorkspace.jsx` / `editor/*`, `ui.jsx` (add `Splitter`), `Icons` (add `sidebar`)

1. **Add a `Splitter` primitive** to `ui.jsx`, copied from the reference.
   - The hit area is 7px, centered on a 1px `--border2` line, with a 36×5 grip.
   - On hover or drag, the line and grip turn accent (the line becomes 2px).
   - While dragging, set `body` to `cursor: row-resize` / `col-resize` and `user-select: none`.
   - Double-click resets to the default size.
2. **Band height:** put a row splitter between the band toolbar and the band canvas. The height is 120–520px (default 190), **and also capped so the video keeps at least 160px**. The cap is `colH − 50 (transport) − 56 (nav) − 48 (toolbar) − 160`, where `colH` is the left column height measured with a ref. Re-clamp on window resize and when restoring from localStorage. The video area takes the remaining space and has `min-height: 160px; overflow: hidden`, so the subtitle overlay never spills over the header. Remove the old 2px top border on the band. The canvas must redraw on resize (add the height to the draw effect's deps, or use a `ResizeObserver`).
3. **Inspector width:** put a column splitter on the inspector's left edge. The width is 300–600px (default 392). Remove the old `borderLeft`, since the splitter draws the line. The band and timeline nav canvases must redraw when the width changes.
4. **Hide the inspector:**
   - Add a `sidebar` icon button in the editor header, before Exporter. It is `active` while the panel is open. The `\\` key also toggles it.
   - When hidden, a 32px strip appears at the right edge, with the icon and the vertical text "Répliques · Voix · Détection". Clicking it reopens the panel.
   - The video and band take the full width.
5. **Persist** `{ bandH, inspW, inspOpen }` in localStorage (`br.editor.layout`) and restore it on load.
6. Add `\\ Afficher / masquer le panneau` to the ShortcutsOverlay (Général).

## Done when
- Re-shoot every screen, regenerate the `*-compare.png` images, and check them. Each F section's image shows the app matching the design.
- Also capture: Exporter with a running job, Activité with a running job and a failed one, and Studio with 2 or more takes.
- The re-shot `editor/06-tab-detection.png` shows the Détection tab and matches the design.
- The Éditeur, Exporter and Bibliothèque screens show no regressions.
