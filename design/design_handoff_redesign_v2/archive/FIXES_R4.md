# FIXES round 4: review of `app_screens_2026-10-14_r3`

These fixes are listed in priority order. The source for each fix is in `reference/redesign/`. `FIXES_R3.md` stays as background.

## ✅ Done. Don't touch these again.
- **Rail:** no left bar on the active item, and the labels fit (F11.1).
- **Nouveau clip:** icon tile, `N` key chip, depth (F11.4).
- **Importer source tabs:** the active tab is a grey button (F9).
- **Importer minimap:** the window is draggable, has a grip, and the range label updates live (F10.2).
- **Éditeur:**
  - Band splitter, inspector splitter, sidebar toggle, `\` key, collapsed strip and persistence (F13).
  - The hint has moved to the inspector's bottom bar (F1.2).
  - The PI marker is offset (F1.3).
  - The boucle drag and trim work (F10.1).
- **Readable disabled buttons:** undo/redo, Valider, Traduire auto, Créer 0 clip (R3 items 15 and 17).
- **Activité:** the EN COURS and ÉCHECS sections and the counter chips.
- **Exporter:** the rendering row and the "1 en cours" chip.
- **Studio:** take cards with A/B and a "meilleure" badge.
- **Shortcuts:** the `\` and `N` rows.

## ❌ Not done (do these first)
1. **Importer: the player controls, seek bar and timecode are missing.** This is R3, section "🆕 Importer: player controls". Under the video, add:
   - a 22px seek bar you can click or drag, with a hover timecode and the IN→OUT range drawn on it
   - a control row with: −10 s, −1 image, ▶ (40×34 accent), +1 image, +10 s; an **editable timecode** (`HH:MM:SS:FF`, Enter to seek); the IN/OUT cluster with loop; speed; mute
   - keyboard: Space, J/L, comma/period, I, O, M
2. **Importer title:** it still shows the UUID filename (F4.2).
3. **Atelier with no source:** this is R3, section "🆕 Atelier", which replaces item 16. Right now there is still:
   - a full-height preview box
   - a header select **and** a second select inside the box
   - a side column with disabled Capturer / Créer le GIF / MP3 / WAV buttons

   Replace all of it with:
   - **one centered 16:9 card** with width `min(100%, 720px, (100vh − 330px) × 16/9)`
   - **no side column and no mode actions**
   - **nothing on the header's right side**
   - the clip selector and "Vidéo courte…" **only inside the card**
4. **Atelier with a source:**
   - The player box isn't 16:9. Its black bars above and below the video take about 150px. Use `aspect-ratio: 16/9` on the video area with width `min(100%, (100vh − 400px) × 16/9)`, centered.
   - The side drop zone should read "Ou utiliser votre image" (PNG · JPG · WEBP · GIF), not "…ou une vidéo".

## ⚠️ Partial
5. **Band at larger heights** (`proofs/editor/05`, `06`): the stretch triangles and the detection marks scale with the band height, so they become huge 40px diamonds. Keep them a **fixed size** (triangles 10px, signs 12px) and vertically centered on the text line. Only the gaps between lanes should grow.
6. **Band block fill is still heavy.** Use `trackHex + '12'`, or `'22'` when active, with no top or bottom edge. The current olive is about `'40'`.
7. **Timeline nav:** the "TIMELINE · CLIP ENTIER" label is still crossed by the viewport rectangle and the dashed cut lines. Reserve a 16px label strip at the top that nothing else is drawn into. Draw the viewport, cuts and loops from y = 16 down.
8. **Timeline nav boucle label:** "⟲ B1 00:10:11–00:20:18" collides with the dashed cut lines and the loop edge. Give it an opaque `bg2` chip (padding `1px 6px`, radius 4), placed in the same 16px label strip on the right.
9. **Studio, "Valider la prise sélectionnée":** it is disabled even though Prise 2 is selected and marked "meilleure". Enable it when a take is selected. Clicking a take card selects it, with an accent `1px` border. "meilleure" is the result of Valider, not the selection.
10. **Studio réplique card:** the border should be the track color at `33`, not grey (F2.4, still open).

## 🆕 New
11. **Toasts cover the content they duplicate.**
    - On **Activité**, the 3 bottom-right toasts repeat the rows on the page and hide the Télécharger buttons. **Don't show toasts while the Activité route is open.**
    - On **Exporter**, they cover the queue. Show only the jobs that are **not** already in that screen's queue, and stack them at most 2 high, with "+N" collapsing the rest.
    - Elsewhere (Atelier, Éditeur): keep the toasts, but give the stack `bottom: 20px; right: 20px; width: 280px` and keep it clear of page buttons. Add 300px of bottom padding to scroll containers while toasts are visible, or move the stack inside the rail's free area.
12. **Primary-button overuse in lists (Activité and the Exporter queue):** almost every row is still yellow, because each file name is unique. New rule:
    - **only the single newest finished row** gets `primary`, and only if it finished **less than 10 minutes ago**
    - every other row gets `outline`
    - "Tout télécharger" stays outline
13. **Shortcuts overlay is cut off at 900px height:** the "? Cette aide" row is clipped. Set the overlay to `max-height: calc(100vh − 80px); overflow-y: auto` with the header kept sticky, **or** move `\` and `N` into a third short column, "Navigation".
14. **Atelier header with a source:** "Mes clips" (back), the clip select and "Vidéo courte…" make three buttons in a row. Drop "Mes clips", because the rail already does that. Keep the select, "Vidéo courte…" and ✕ (close the source).

## Proof for next round
- `import/03-import-player.png`: seek bar mid-drag, with the timecode field in edit mode
- `atelier/01-atelier-empty.png` at 1440×900 and 1100×800
- `atelier/04-atelier-clip.png`: 16:9 player with no black bars
- `editor/05-editor-band-max.png`: fixed-size triangles
- `studio/02-studio-takes.png`: a take selected with Valider enabled
- `activity/03-activity-running-failed.png`: **no toasts**
- `shell/03-shortcuts-overlay.png` at 1440×900, with every row visible
