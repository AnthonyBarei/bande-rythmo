# FIXES round 6: review of `app_screens_2026-10-14_r5`

Round 5 landed almost completely: the Studio stage, grouped failures, friendly errors, SMPTE timecodes, the single font control, live Boucles and the Importer streams. What follows is small polish.

**About R5 #10:** the ffmpeg error came from the capture mock, not from the app. Thanks for making GIF video-only anyway and for relabelling the mock. It's closed.

## ✅ Done. Don't touch these again.
- **Atelier:**
  - The inline error has Réessayer and Détails, with no toast for its own job.
  - Default range is ±3 s, drawn in info with an accent OUT edge.
  - SMPTE in both players.
  - Each mode has its own empty-state icon.
- **Activité:** failures grouped with `×2`, friendly text and Détails, chips hidden at 0, "Voir les 14 plus anciens".
- **Exporter:** Lancer stays enabled while a job runs, badge colors follow format families, and Police BR follows the project font.
- **Éditeur:**
  - SMPTE in the ruler, transport and rows.
  - Font set in one place.
  - Notes are read-only at rest.
  - Boucles update live during trim and move.
  - The band renderer is shared with Studio.
- **Importer:**
  - Single read-only stream rows with no `und`.
  - Inline name input with autofocus.
  - Lighter overlay.
- **Studio:**
  - Line strip, image, rolling band and control strip.
  - The 3·2·1 pre-roll, REC with the red border, the take playing animation and the slide-in.
  - Valider is primary or outline as specified, with a "✓ validée" chip.

## ⚠️ Remaining

### Éditeur
1. **Too many duration warnings.** 45 of 51 lines are flagged, so the color means nothing. On a bande rythmo the timing comes from real speech, so a high car/s is normal. Flag only these cases:
   - `danger`: duration < 0.3 s, or overlap with the next line of the same character
   - `accent`: the text was edited and its length changed by more than 30% compared to the text that was timed (the new text no longer fits the mouth)
   - Everything else uses `text4`. Target ≤ 10% flagged on this clip. Apply the same rule to the band's red underline.
2. **The row hover toolbar covers the content** (`01b-editor-warn-hover.png`: it hides the TC and "Tu veux pas le rejoindr…"). Show the actions **on the TC line only**, right-aligned, where the duration was. Hide the duration while hovering. The text line must never be covered.
3. **Note icon twice:** when a row shows its note line (04 "ok"), remove the yellow note icon from the TC line.
4. **The transport scrub is cramped** (~120px) now that the TC is longer.
   - The transport shows the current TC only (`00:00:00:00`). The total is already in the video overlay.
   - Replace the speed `Segmented` with a compact `Select` (`1× ▾`, 64px).
   - The scrub track must be ≥ 240px at 1440 with the inspector open.

### Studio
5. **Valider sits at the bottom of the column** (y≈858), far from the takes. Put it directly under the last take card with a 12px gap, as in r4 and the reference.
6. **Empty states:**
   - With 0 takes, hide Valider. The dashed "Aucune prise…" card is enough.
   - Show the "A/B comparer" chip only from 2 takes up.
7. **"Prise annulée pendant le pré-roll."** is shown as a red banner above the takes. A cancel is not an error.
   - Show it in the control strip status line, `text2`, for 3 s.
   - Remove the banner.
8. **Band focus:** both tracks are drawn at full strength. Draw the active character's track at 100% and the others at 45% opacity, so the actor sees their own line. Use the same rule in the Éditeur when a character pill is soloed.

### Atelier
9. **Inline error layout:** "Le traitement vidéo / (ffmpeg) a échoué." wraps around the links. Use 2 rows:
   - row 1: the icon and message, on one line, wrapping freely
   - row 2: the "Réessayer" and "Détails ▾" links, left-aligned, 12px

### Activité
10. **Failure row alignment:** "Détails ▾" sits on the bottom baseline while Réessayer and ✕ are centered. Center all three vertically, with a 12px gap.

### Bibliothèque
11. **The hover state doesn't appear** (`03-library-card-hover.png` is identical to `01`). Neither "+ Projet" nor the hover action row shows. Per the README contract, on card hover or focus show:
    - "+ Projet"
    - the 44px action row: "Doubler" in accent, mic, MP3, GIF, trash
    Recapture with a real `:hover` (CDP `Input.dispatchMouseEvent`). A class toggle won't work if the styles use `:hover`.
12. **Card durations mix formats:** `05:01.1`, `55:13.1`, `12.4s`, `4.8s`. A duration is not a timecode. Use `M:SS` under 1 h and `H:MM:SS` above (`5:01`, `55:13`, `0:12`, `0:05`), mono, with no decimals.

### Importer
13. **Timeline ruler** labels read `0:00 / 0:10` and the header reads `0:00 – 1:06 sur 1:06`. Rulers whose ticks are ≥ 1 s apart may drop frames: `00:00:10`. The header range uses the same format: `00:00:00 – 00:01:06`.

### Exporter
14. **The format column is clipped** at the bottom ("MP3" is cut, with no sign that it scrolls). Add a 24px bottom fade (`surface` → transparent) while more content is below.

## Proof for next round
- `editor/01-editor.png`: ≤ 5 flagged durations; `editor/01b-editor-warn-hover.png`: actions on the TC line only (#1, #2)
- `editor/01-editor.png`: transport with a ≥ 240px scrub and the speed Select (#4)
- `studio/01-studio.png` (0 takes: no Valider, no A/B), `studio/02-studio-takes.png` (Valider under the cards) (#5, #6)
- `studio/08-studio-cancelled.png`: the status line, no banner (#7)
- `studio/05-studio-rec.png`: the other track dimmed (#8)
- `atelier/05-atelier-gif-error.png` (#9), `activity/04-activity-failed-no-running.png` (#10)
- `library/03-library-card-hover.png`: a real hover with the action row and "+ Projet" (#11, #12)
- `import/01-import.png` (#13), `export/01-export.png` (#14)
