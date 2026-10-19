# App screenshots — round 5 (after FIXES_R5)

Exact 1440×900, headless Chrome, real data. Job/take states are **mocked inside the headless
tab** (CDP Fetch; every write blocked or answered locally) — nothing reaches the backend.

## ⚠️ About R5 #10 ("GIF fails on every attempt")
That error text — `ffmpeg : flux audio introuvable (-map 0:a)` — was **not from the app**: it was the
fake failure our capture mock injected for the Activité "ÉCHECS" proof. The real GIF commands never
mapped audio. They are now explicitly video-only anyway (`-map 0:v:0 -an` in both passes), MP3/WAV
fail early with "Ce clip n'a pas de piste audio" on silent clips, and the mock now reads
`[MOCK capture] échec simulé — aucun job réel`, shown through the new friendly-error layer
("Le traitement vidéo (ffmpeg) a échoué." + Détails).

## Proofs requested by FIXES_R5
| Item | File |
|---|---|
| #1 inline error, no toast | `atelier/05-atelier-gif-error.png`, `toasts/01-atelier-gif-fail-x2.png` |
| #2 grouped failures ×2, #11 friendly text + Détails, #14 chips | `activity/03-activity-running-failed.png`, `04-activity-failed-no-running.png` |
| #3 Valider | `studio/02-studio-takes.png` (primary), `03-studio-validated.png` (✓ validée) |
| Studio stage | `studio/04-studio-preroll.png` (3·2·1 over image, band rolling), `05-studio-rec.png` (red border, REC), `06-studio-take-playing.png` (waveform filling), `07-studio-new-take.png` (slide-in), `08-studio-cancelled.png` |
| #4 GIF ±3 s range, #5 SMPTE | `atelier/02-atelier-gif.png`, `04-atelier-clip.png` |
| #20 empty icon per mode | `atelier/02-atelier-gif-empty.png`, `03-atelier-audio-empty.png` |
| #8 "+ Projet" | `library/01-library.png` (hidden), `03-library-card-hover.png` (visible) |
| #12/#13 queue | `export/02-export-rendering.png` (Lancer enabled, 2 jobs, family colours) |
| #9 SMPTE everywhere | `editor/01-editor.png` (transport + rows), `editor/01b-band-ruler-2x.png`, `import/04-import-inout.png` |
| #15 one font control | `editor/06-tab-detection.png` |
| #16 duration tooltip | `editor/01-editor.png` (hover on 2.3s); `01c-…-overlay.png` shows the `title` text (native tooltips don't render in screenshots — overlay injected by the script, not app UI) |
| #17 notes | `editor/11-note-at-rest.png`, `12-note-editing.png` |
| #18 Boucles live | `editor/09-nav-boucle-trim-mid-drag.png` |
| #6/#7/#19 importer | `import/01-import.png`, `05-import-pending-focus.png` |

## Not captured
- `atelier/06-atelier-gif-done.png` would need a real GIF render written to the export history; we
  only capture mocked states. GIF generation itself is covered by backend tests (video-only and
  video+audio sources).

## Notes / choices
- #16 thresholds: warn > 20 car/s (accent), danger > 25 car/s or < 0.3 s. 15/20 flagged 45 of 51 lines
  on real Whisper timings (line ends are trimmed to the last phoneme).
- #4: near the clip edges the ±3 s window slides to stay inside the clip (0 s → 0–6 s).
- Studio take cards: A/B button only while A/B comparison is open (row space).
- The band in Éditeur and Studio is now one shared renderer (Éditeur pixel-identical before/after).
