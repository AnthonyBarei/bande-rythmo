# App screenshots — round 6 (after FIXES_R6)

Exact 1440×900, headless Chrome, real data. Job/take states mocked in the headless tab (writes blocked).

| R6 | File |
|---|---|
| #1 meaningful flags (3 of 51: two < 0.3 s, one emptied text vs timed words) | `editor/01-editor.png` |
| #2 hover actions on the TC line only | `editor/01b-editor-warn-hover.png` |
| #3 no duplicate note icon | `editor/01-editor.png` (row 04) |
| #4 current TC only, 64px speed Select, scrub 338px | `editor/01-editor.png` |
| #8 band focus (soloed character, others 45 %) | `editor/02-editor-solo-focus.png`, `studio/05-studio-rec.png` |
| #5/#6 Valider under the cards; 0 takes = no Valider, no A/B | `studio/02-studio-takes.png`, `studio/01-studio.png` |
| #7 cancel in the status line | `studio/08-studio-cancelled.png` |
| #9 JobError on 2 rows | `atelier/05-atelier-gif-error.png` |
| #10 failure row centred | `activity/04-activity-failed-no-running.png` |
| #11 real hover (action row + "+ Projet") | `library/03-library-card-hover.png` |
| #12 durations M:SS | `library/01-library.png` |
| #13 HH:MM:SS ruler + header | `import/01-import.png` |
| #14 format column fade | `export/01-export.png` |

Notes
- #11: the hover always worked; the capture aimed at a card below the 900px fold, so the mouse
  never reached it. The script now targets an on-screen card (media queries confirm hover/fine pointer).
- #1: line 17 is flagged because its saved text is empty while its timed text (Whisper words) is
  "Je vais utiliser le téléphonon…" — the rule doing its job on real data.
- The band underline now follows the same rule (one bar per flagged block).
