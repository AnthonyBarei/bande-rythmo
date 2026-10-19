# FIXES round 5: review of `app_screens_2026-10-14_r4`

Almost everything from round 4 has landed. What's left is mostly polish.

## ✅ Done. Don't touch these again.
- **Importer:**
  - Real filename and stream metadata in the title.
  - Seek bar with hover timecode and the IN→OUT range drawn on it.
  - Editable timecode field.
  - IN/OUT cluster with loop.
  - Speed and mute.
  - Pending clip row.
- **Atelier:**
  - The empty state is a single 16:9 card with no side actions.
  - The sub line follows the mode.
  - With a source: select, "Vidéo courte…" and ✕; the 16:9 player; "Ou utiliser votre image".
- **Activité and Exporter:**
  - Outline buttons everywhere, with primary only for the fresh row.
  - No toasts on Activité.
  - Exporter toasts are filtered to jobs not already in its queue, with a "+N" for the rest.
- **Band:**
  - Fixed-size triangles and detection signs at max height.
  - Lighter block fill.
- **Timeline nav:** a clean 16px label strip with the B1 chip.
- **Studio:** take selection has an accent border, and Valider is enabled.
- **Shortcuts overlay:** fits at 900px height.

## ⚠️ Remaining
1. **The Atelier GIF error is shown twice.** There is an inline red box under "Créer le GIF" **and** 2 identical toasts, plus "+2". Rules:
   - When the failing job belongs to the current screen, show **only the inline error**, with a "Réessayer" link inside it and no toast.
   - Remove identical toasts: same job type + same error = 1 toast with a `×N` count.
2. **Duplicate failed jobs in Activité:** there are two identical "GIF — génération" rows. Group rows with the same job, clip and error into one row with a `×2` chip. Réessayer retries once, and ✕ dismisses all of them.
3. **Studio "meilleure" vs selection:**
   - The selection now works.
   - After Valider, the validated take shows the "meilleure" badge **and** keeps its accent border until another take is selected.
   - Valider is outline by default. Make it **primary** when the selected take is not already the validated one.
4. **Atelier GIF player:**
   - The IN/OUT range bar is olive at full width, and dimmed IN/OUT pills fill it from 0 to the end. That looks like a selection the user didn't make.
   - Default IN and OUT to the playhead ±3 s, and draw the range in **info `33` with an accent OUT edge**, the same as the Importer.
   - The time readout "00:00.0 · 66.5s" should use the same `HH:MM:SS:FF` format as the Importer.
5. **Atelier Image player:** the timecode is in seconds (`00:00.0` / `01:06.5`). Use `HH:MM:SS:FF` to match the Importer and the Éditeur.
6. **Importer:** while the "Cliquez pour activer le son" overlay is up, the video is dimmed about 50%. Make it lighter, around 25%. Also make the overlay disappear the moment playback or mute is touched (R3 says the first click on play or mute unlocks audio).
7. **Importer pending row:** "Sans nom — cliquer pour nommer" is in italics with a pencil icon. Use a placeholder-style inline input instead: `text3`, no italics, and it auto-focuses after "Ajouter le clip".
8. **Library cards:** "+ Projet" sits on every card at full contrast. Show it on hover only (opacity 0, then 1 on card hover or focus). Clips with no project show nothing until hover.

9. **Timecode format, everywhere else.** Several readouts in r4 still mix formats. All of them should use `HH:MM:SS:FF`:
   - Éditeur band ruler: the labels read `00:01:00`, `00:02:00` one second apart, so they look like minutes. Use `00:00:01:00`.
   - Éditeur transport: `00:00 / 01:06` → `00:00:00:00 / 00:01:06:11`, matching the overlay above the video.
   - Éditeur réplique list: `00:00.21→00:01.39` → `00:00:00:05 → 00:00:01:10`, the same as the inspector header.
   - Importer IN/OUT pills (`00:00:12`) and the pending row (`00:12.00 → 00:24.00`).
   - The Boucles chip on the nav strip (`00:20:00-00:35:00`) is already correct. Use it as the reference.

## ⚠️ Remaining, second pass (same r4 screenshots)
10. **P0 backend: GIF generation fails on every attempt** (`ffmpeg : flux audio introuvable (-map 0:a)`). A GIF has no audio, so the GIF command must not map an audio stream. Remove `-map 0:a` from the GIF job and use `-map 0:v:0 -an`. Also audit MP3/WAV/MP4 doublé: when the source has no audio track, fail early with "Ce clip n'a pas de piste audio" instead of the raw ffmpeg message. Fix this before #1 and #2, since the duplicates only show up because of this error.
11. **Raw ffmpeg errors in the UI.** Map known errors to one French sentence, and put the raw stderr line behind a "Détails" toggle (mono, `text3`). This applies to the inline error, toasts and Activité rows.
12. **Exporter: "Lancer l'export" is disabled while a job runs** (`export/02`: "Export…" greyed). The queue exists so exports can be stacked. Keep the button enabled. Each click adds a row to the queue. Show a spinner in the button for 600 ms only, as feedback.
13. **Exporter queue badge colors:** the GIF badge is red, which reads as an error next to real failures. Use `violet` for GIF, and keep `danger` for failures only. One color per family: video = success, subtitles = info, audio = violet/pink, studio docs = accent/orange. Check that no format badge uses `danger`.
14. **Activité header chips:** "0 en cours" is accent with a dot. Hide a chip when its count is 0. Show only "N terminés" when nothing runs or fails.
15. **Band font is set in two places in the Éditeur:** the toolbar `Select` (Manuscrite) and the "Police de la bande" `Segmented` in the Détection tab. Keep the toolbar `Select` and remove the segmented from Détection. Réglages stays the default for new projects, and Exporter "Police BR" stays an export override. Its default must follow the project font.
16. **Réplique list duration colors:** some durations are red (`2.3s`, `0.2s`) and others grey, with no legend. Add a `title` tooltip that says why ("Débit élevé : 19 car/s" or "Trop court : < 0,3 s"). Use `accent` for a warning and `danger` only above the hard limit. Use the same rule as the band's red underline.
17. **Réplique notes:** the note on 04 renders as an open yellow-bordered input at rest. At rest, show it as a read-only line: note icon + text in `text2`, 12px. It becomes the input on click, and Enter or blur saves it.
18. **Boucles list doesn't follow a trim live** (`proofs/editor/09`: the chip reads `00:10:11-00:20:18`, the list still reads `→ 00:00:25:11`). Update the list row and its duration/réplique count during the drag, not on release.
19. **Importer, Flux détectés:**
    - Hide `und` (undetermined language) everywhere. Show the language only when it's known.
    - With **one** audio track, don't show a picker with "Auto" + "AAC". Show a single read-only row (`AAC · 2 ch · 48 kHz`). Show the picker only from 2 tracks up.
20. **Atelier empty state icon:** the center icon is the Image icon in all three modes. Use the mode's own icon (Image / GIF layers / Audio speaker), the same as the active segment.

## 🆕 Studio: the real dubbing stage (replaces the mic-only stage)
**Source:** `screen-record-export.jsx` → `Record`. It reuses `BandCanvas` (exported as `RScreens._Band`).
**Files:** `RecordSection.jsx` / `StudioSection.jsx`. Reuse the Éditeur's band renderer and the video element. Don't fork them.

**Layout.** The left column is one black card with four parts, top to bottom:
1. **Line strip** (46px, surface background):
   - avatar, character name in the track color, the text in Caveat with an ellipsis
   - TC in → out
   - previous / next réplique buttons
2. **Image** (flex 1, min-height 80): the clip itself, 16:9, centered.
   - Overlays top-left: `● TC`, or `● REC TC` with the dot blinking at 1 Hz.
   - Overlays top-right: the Pré-roll chip and the mic chip.
3. **Bande rythmo**, the same component as the Éditeur:
   - read-only: no drag-to-create, no seek on click
   - height 110 / 140 / 170 px at viewport heights below 760 / below 900 / anything else
   - it scrolls with the image, so the actor reads the line on the band as in a real studio
4. **Control strip** (60px):
   - a live input meter (32 bars; accent, with red peaks while recording)
   - the record button (48px; accent with a mic icon when idle, red with a stop square while armed or recording)
   - a status line

**Take flow** (R to start or stop):
- **Pré-roll:** playback jumps to `start − 3 s`, image, band and audio all roll, and a big **3 · 2 · 1** countdown is drawn over the image (96px accent mono with a scale-in/fade animation), with one bip per second. The status reads "Pré-roll · bip n/3".
- **REC:** when the playhead reaches `start`, recording begins. The card border turns red `88`, the REC chip blinks, and the status reads "● Prise en cours · x.x s / dur".
- **Auto-stop:** at `end + 0.6 s`, recording stops. The new take slides into the **top** of the list (`translateY(-6px)` to 0 over .35 s), is auto-selected, and playback rewinds to `start − 3 s`, ready for the next take.
- Pressing R during pre-roll or REC cancels or stops.

**Take playback animation** (the "animate playing audio" request):
- The ▶ button turns into an accent ⏸.
- The waveform **fills with accent from left to right** as it plays.
- Bars within ±6% of the playhead **bounce** (height × (1.25 + 0.35·sin)).
- A 2px white playhead with a glow moves across.
- The duration reads `0.6 / 2.4s`.
- Playback stops at the end.
- Optional: also play the take **over the image and band from `start`** ("Écouter en contexte"). This is a good Phase 2 item.

**Selection and Valider:**
- Clicking a card selects it, with an accent border.
- Valider is `primary` when the selected take isn't the validated one, and `outline` otherwise.
- The validated take shows a "✓ validée" chip.
- The trash icon deletes the take.

**Keyboard:** R arms or stops. Add "← / → réplique précédente / suivante" in Phase 2.

## Proof for next round
- `atelier/05-atelier-gif-error.png`: an inline error with no duplicate toasts
- `activity/03-activity-running-failed.png`: grouped failures with `×2`
- `studio/03-studio-validated.png`: after Valider
- `studio/04-studio-preroll.png`: the countdown over the image with the band rolling
- `studio/05-studio-rec.png`: the REC state with the red border
- `studio/06-studio-take-playing.png`: a take playing, with its waveform filling
- `atelier/02-atelier-gif.png`: the default ±3 s range
- `library/01-library.png`: no "+ Projet" at rest; `library/03-library-card-hover.png`: "+ Projet" visible
- `atelier/06-atelier-gif-done.png`: a GIF created from a clip, opened in the text editor (#10)
- `export/02-export-rendering.png`: "Lancer l'export" enabled while a job runs, 2 jobs queued (#12)
- `editor/06-tab-detection.png`: no font segmented (#15); `editor/01-editor.png` with a duration tooltip open (#16)
- `import/01-import.png`: one read-only audio row, no `und` (#19)
