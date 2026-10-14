# App screenshots — round 4 (after FIXES_R4)

Exact 1440×900 (plus 1100×800 where asked), headless Chrome, real data.
Job / take states are mocked inside the headless tab (CDP Fetch); every write is blocked.

## Proofs requested by FIXES_R4
| R4 | File |
|---|---|
| #1 | `import/03-import-player.png` — seek bar mid-drag (hover TC), timecode field in edit mode, IN/OUT set, range block on timeline, "Créer 1 clip" · also `import/04-import-inout.png` |
| #2 | `import/01-import.png` — title **"Pineapple Express.mp4"**: the source now goes through the real local-file flow (file picker answered in the headless tab, source registered in memory) |
| #3 | `atelier/01-atelier-empty.png` + `01-atelier-empty-1100x800.png` — one 16:9 card, header right empty |
| #4 | `atelier/04-atelier-clip.png` — player at the video's own ratio, no black bars ("Ou utiliser votre image") |
| #5/#6 | `proofs/editor/05-editor-band-max.png`, `05b-…-detection.png` — 10px wedges / 12px signs at any band height; block fill measures #1b180e vs design #1b180f |
| #7/#8 | `proofs/editor/07b-nav-crop-2x.png` — clear 16px label strip, opaque boucle chip |
| #9 | `studio/02-studio-takes.png` — Prise 1 selected (accent border), Valider enabled, Prise 2 "meilleure" |
| #10 | Studio card border measured at full resolution: **(67,57,26) in both the reference and the app** — identical. The (48,43,25) in `screens/studio/01-studio.png` is the downscale blurring the 1px line. |
| #11 | `activity/03-activity-running-failed.png` (no toasts), `export/02-export-rendering.png`, `export/03-export-rendering-collapsed.png` (2 + "+1"), `atelier/05-atelier-toasts.png` |
| #12 | `activity/04-activity-fresh-primary.png`, `export/04-export-fresh-primary.png` — exports 2 / 6 / 40 min old: only the 2-min row is primary |
| #13 | `shell/03-shortcuts-overlay.png` — every row visible |

## Notes
- #4: the test clip is 1918×800 (2.4:1). A strict 16:9 box would always show bars, so the
  player uses the formula with the video's real aspect ratio (identical to the reference for 16:9 sources).
- #1: loop is a toggle (wrapping only while on), and a complete IN→OUT range becomes a pending
  clip before IN is moved — so several clips can be marked with I/O. Frame steps use the
  source's real fps (ffprobe / Plex), 25 only as fallback.
- Toasts: newest 2 + "+N" everywhere (not only on Exporter); in the editor the stack sits above
  the inspector's hint bar.

Scripts: `design/app_screens_2026-10-14/shoot.py` (base, `--extras --mock-states`) and
`r4_*_proofs.py` (per-area proofs).
