# FIXES round 3: review of `app_screens_2026-10-14_r2`

These fixes are listed in priority order. Every item is either **not done**, **partially done**, or **new**. The F-numbers refer back to `FIXES.md`. The source for each fix is in `reference/redesign/`.

## ✅ Done. Don't touch these again.
- **F1.5** The inspector header now shows the current réplique.
- **F2.1–3** Studio has its chips, the meter bars and the empty takes card.
- **F3.1–3** Atelier has the sub line, the mode switch and the scrub bar.
- **F4.3** The Importer has its ruler and the centered hint.
- **F5** Réglages has the `+` swatch.
- **F6.3–4** Exporter has Voir tout / Vider and the left chevron on Retour.
- **F7.1** Activité is capped at 10 rows, with outline buttons on the older ones.
- **F8.2–3** Lexique has one entry row. Voix has the hint moved into the bar.
- The Détection tab has been re-captured.

## ❌ Not done (do these first)
1. **F9 · Importer source tabs:** the curved yellow underline is still there. Remove the box-shadow. The active tab is `surface3` with a `1px border2` border, and only its icon is accent.
2. **F11.1 · Rail:** the 3px yellow bar on the left of the active item is still there, and "Bibliothèque" still overflows. Delete the bar and make items 62×52 with `nowrap` labels.
3. **F11.4 · Nouveau clip:** it hasn't changed. Add the 28px icon tile, the label and the `N` key chip. Give primary buttons depth: an inset highlight plus a soft accent shadow, and lift 1px on hover. Wire the `N` key.
4. **F12 · Atelier source:** these are all missing:
   - the clip `Select` (250px) in the header
   - the "Vidéo courte…" upload button
   - the drop zone text "Glisser une image ou une vidéo · MP4 ≤ 60 s", plus the "Plus longue ? … Importer" hint
   - the sub line, which should read `source · <clip> · <durée>` (or "aucun clip ouvert" with no clip)
5. **F13 · Éditeur layout:** none of it is done. There is no band splitter, no inspector splitter, no sidebar toggle button in the header, no `\` shortcut, no collapsed strip and no persistence. Add `\  Afficher / masquer le panneau` to the Shortcuts overlay as well.
6. **F4.2 · Importer title:** it still shows the UUID filename. Use the original name, the Plex title or the last URL segment, in that order. Fall back to "Vidéo sans titre".
7. **F10.2 · Importer minimap:** the viewport window must be draggable and have a grip. Its range label should update live. Prove it with a capture taken mid-drag.

## ⚠️ Partial
8. **F1.1 · Band blocks are still heavy.** The olive fill plus yellow top and bottom edges remain. Copy exactly: fill `trackHex + '12'` (`'22'` when active), **no stroke on any side**, and a 2.5px left bar only. The avatar dot is done. Keep it.
9. **F1.2 · Bottom ruler labels collide** with the hint line ("glisser pour créer · double-clic…"). The `00:00:00`, `00:01:00` and `00:02:00` labels overlap it at the bottom right. Move the hint out of the canvas, into the inspector's bottom bar or a tooltip, **or** draw the ruler labels at `h - 2` and the hint at `h - 16`. Only one row of text is allowed at the bottom.
10. **F1.4 · Timeline nav:** "TIMELINE · CLIP ENTIER" is still boxed inside the viewport rectangle at the left. Draw the viewport as an outline only, starting **below** the 16px label row (y = 16). Alternatively, move the label to the right of the rectangle.
11. **F1.3 · `PI` marker:** it now sits on top of the playhead triangle. Offset the label by 6px to the right of its line, and skip drawing it while the playhead is within 30px.
12. **F6.1–2 · Export queue:** the "n en cours" chip and the rendering-row style still haven't been verified. Capture Exporter with an MP4 render running.
13. **F7.3 · Activité:** EN COURS and ÉCHECS haven't been verified. Capture one running transcription and one failed export.
14. **F8.1 · Lexique "Traduire auto"** is present but invisible (see item 15).
15. **F2.4 · Studio réplique card:** the border should use the track color at `33`, not grey.

## 🆕 New
15. **Disabled buttons have become near-invisible.** This affects "Capturer ce frame", "Créer le GIF", "Télécharger MP3/WAV", "Valider la prise sélectionnée", "Traduire auto" and "Créer 0 clip".
   - The disabled style is: background `--surface2`, border `1px solid --border2`, text and icon **`--text3`** (not `--text4`), `cursor: not-allowed`, opacity 1.
   - The label must stay readable, because the user needs to know what will become available.
   - Add a `title` tooltip that explains why it's disabled, e.g. "Ouvrez un clip d'abord".
16. **Atelier with no clip:** a 560px empty APERÇU box with dead transport controls is a dead end. Replace the preview content with a centered empty state:
   - an icon
   - "Choisissez un clip"
   - the clip `Select` (from F12)
   - an outline "Vidéo courte…" button
   - the text "ou glissez une image / vidéo ici"

   Hide the transport row until a source is loaded.
17. **Éditeur undo/redo** are disabled with no history, which is correct, but they are too faint. Apply the disabled style from item 15.
18. **Activité:** the expanded list (`02-activity-expanded`) puts the yellow Télécharger buttons back on old rows, which breaks F7.1. The rule is that only the **newest row per file name** gets the primary button, and every other row gets outline. This also applies after expanding.

## Proof for this round (add these to `shoot.py`)
- `editor/01-editor.png` with the inspector **hidden** (`\`) and with the band resized to its maximum
- `import/02-import-minimap-drag.png` taken mid-drag
- `export/02-export-rendering.png` showing a running MP4
- `activity/03-activity-running-failed.png`
- `studio/02-studio-takes.png` with 2 or more takes
- `atelier/04-atelier-clip.png` with a clip selected
