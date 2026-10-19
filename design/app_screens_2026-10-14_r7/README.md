# App screenshots — round 7 (after FIXES_R7)

Exact 1440×900, headless Chrome, real data. Job/take states mocked in the headless tab (writes blocked).

| R7 | File |
|---|---|
| #1 no hover shift — row tops [232, 542, 852] in both shots | `library/01-library.png`, `library/03-library-card-hover.png` |
| #2 one font list (Manuscrite · Lisible · Feutre · Neutre · Mono + uploads) | `settings/01-settings.png`, `settings/02-font-menu.png`, `editor/11-font-menu.png`, `export/01-export.png` |
| #3 "/" = search (or palette) | `shell/03-shortcuts-overlay.png`, `shell/04-slash-library.png`, `shell/05-slash-palette.png` |
| #4 "Créer le clip" / heading hidden at 0 | `import/01-import.png` |
| #5 "Nom du clip…" placeholder box | `import/04-import-inout.png` |
| #6 one ×2 running toast | `atelier/02-atelier-gif.png` |
| A — Écouter sur l'image | `studio/09-studio-context-play.png` |
| B — ←/→ navigation (mid-slide) | `studio/10-studio-nav-next.png` |
| C — A/B with Tab | `studio/11-studio-ab.png` |
| D — progress + all-validated toast (with "Exporter le MP4 doublé") | `studio/12-studio-all-validated.png` |
| VO level setting | `settings/03-studio-vo.png` |

Notes
- #1: the card keeps its action row's height at rest (hidden), so cards are 292px tall at rest —
  an overlay would have covered the "+ Projet" row.
- #2 labels: Lisible = Atkinson (per FIXES_R7), so Shantell Sans is now "Feutre"; Inter "Neutre";
  JetBrains Mono "Mono". Ids and the export mapping are unchanged.
- B: arrows are ignored while a take is recording or in pré-roll (a stray key never destroys a take).
- D: progress = répliques of the character with a validated take / répliques of the character.
- The toast's "Exporter le MP4 doublé" opens the export screen on "MP4 doublé".
