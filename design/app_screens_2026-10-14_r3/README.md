# App screenshots — round 3 (after FIXES_R3 + FIXES F9–F13)

Exact 1440×900, headless Chrome, real data (clip "je vois à travers toi", 51 répliques).
Same names as `design_handoff_redesign_v2/screens/` for 1:1 comparison.

## Main set (`shoot.py --extras --mock-states`)
library · import (empty + URL loaded) · editor (+ 4 tabs, Sous-titres menu, Resp. menu) ·
export · studio · atelier (empty, GIF, Audio) · activity (+ expanded) · settings · palette · shortcuts.

Proofs requested by FIXES_R3 — job/take states are **mocked inside the headless tab**
(CDP Fetch; every write blocked, nothing reaches the backend):
- `export/02-export-rendering.png` — MP4 render running (chip "1 en cours", render row)
- `activity/03-activity-running-failed.png` — running transcription + MP4, failed GIF
- `studio/02-studio-takes.png` — 3 takes, one "meilleure"
- `atelier/04-atelier-clip.png` — clip chosen through the new Select

## Extra proofs (`proofs/`)
- `editor/` (`shoot_editor_proofs.py`): inspector hidden with `\`, band at max height,
  inspector widened, PI label offset, boucle region mid-drag and mid-trim
  (boucle saves intercepted, real clip unchanged), hover hint in the inspector footer
- `import/` (`shoot_shell_proofs.py`): new source tabs, URL source loaded with disabled
  "Créer 0 clip", **minimap mid-drag** and click-to-center
- `library/`: "Nouveau clip" hover (depth), 1100px wide (no wrap), project select popover

## Notes for the review
- Importer title in `import/01-import.png` shows the UUID **on purpose**: the capture loads
  `/segments/<uuid>.mp4`, whose last URL segment is that UUID. The rule
  (filename → Plex title → URL segment → "Vidéo sans titre") is covered by
  `frontend/src/utils/sourceTitle.test.js`.
- Studio uses Chrome's fake microphone (meter live, device "Fake Default Audio Input").
- Progress toasts bottom-right in mocked shots are the real UI.

Regenerate (app :5173 + backend :8000 running):
`backend/venv/Scripts/python.exe design/app_screens_2026-10-14/shoot.py <out> --extras --mock-states`
