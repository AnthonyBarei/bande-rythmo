# App screenshots — 2026-10-14, round 2 (after FIXES.md F1–F8)

Captured from the running app at exactly 1440×900, headless Chrome, real data
(clip "je vois à travers toi", 51 répliques). Same folder names as
`design_handoff_redesign_v2/screens/` so each file can be compared 1:1 with the
reference capture of the same name.

| File | State |
|---|---|
| library/01-library.png | Bibliothèque |
| library/03-library-card-hover.png | card hover — action row |
| import/01-import-empty.png | Importer, no source |
| import/01-import.png | Importer, URL source loaded (headless shows the "activer le son" prompt) |
| editor/01-editor.png | Éditeur, Répliques tab |
| editor/05…08-tab-*.png | Voix · Détection · Boucles · Lexique tabs |
| editor/09-menu-sous-titres.png | header "Sous-titres ▾" menu |
| editor/10-menu-respirations.png | band toolbar "Resp. ▾" menu (opens upward) |
| export/01-export.png | Exporter (opened from the editor with E) |
| studio/01-studio.png | Studio |
| atelier/01-atelier.png | Atelier, no clip |
| activity/01-activity.png | Activité |
| settings/01-settings.png | Réglages |
| shell/02-command-palette.png | ⌘K palette |
| shell/03-shortcuts-overlay.png | shortcuts overlay |
| atelier/02-atelier-gif.png, 03-atelier-audio.png | Atelier GIF / Audio modes |
| activity/02-activity-expanded.png | Activité, TERMINÉ expanded |

Studio uses Chrome's fake microphone (live meter visible). Not captured yet (need test data): Exporter with a running job, Activité with running + failed jobs, Studio with 2+ takes.

Regenerate: `backend/venv/Scripts/python.exe design/app_screens_2026-10-14/shoot.py <out_dir> --extras`
(app on :5173, backend on :8000).
