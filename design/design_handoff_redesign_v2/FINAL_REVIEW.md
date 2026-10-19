# Final review: `app_screens_2026-10-14_final`

**Verdict: the redesign is accepted.** All the checks pass: the greps (0 problem hits), the keyboard-only pass (0 missing focus rings), and the §4 feature checklist (40 pass, 0 fail). The 1440×900 captures match the reference. This file lists the last small items. None of them blocks a merge.

## Cleanup (do with the merge)
1. **Delete dead code:**
   - `components/VideoPlayer.jsx`, which nothing imports
   - `fmtClock`, `fmtClockPrecise` and `fmtClockHours` in `utils/timecode.js`, together with their tests
   - `fmtTC` and `fmt` in `ui.jsx`, if nothing imports them
   This leaves one timecode helper (`fmtSMPTE`) and one duration helper (`utils/duration.js`).
2. **Library action row and Tab:** the known limitation can be fixed. Reveal the row with CSS (`.clip-card:hover .actions, .clip-card:focus-within .actions { visibility:visible; opacity:1 }`) instead of React focus state. Fast Tab presses will then reach it.
3. **Lexique input:** this is the last local style object (`inp`). Add a small `Input` primitive to `ui.jsx`: 32px high, `bg2` background, `border2` border, radius 9, 13px text, and an accent border on focus. Use it in the Lexique, the pending clip name, the Studio comédien field and the palette.

## Visual polish (1100×800)
4. **The Éditeur band toolbar wraps to 2 rows** at 1100. The font `Select` and the zoom cluster drop to a second line, and the band loses about 48px.
   - Below 1280px wide, show "Resp." and "Réact." as icon-only buttons with tooltips.
   - Move the font `Select` into the Affichage popover (the sliders icon).
   - The toolbar must stay on one 48px row down to 1100.
5. **The Éditeur transport wraps:** at 1100 the scrub track drops to its own row. That's acceptable, but give the row the same `surface` background and top border, with a 6px gap. At the moment it reads as a separate floating bar. You could also hide ±1 frame (`⇧←/⇧→` covers it) below 1200px to keep one row.
6. **Focus ring inside text pills:** the command palette input (and the library search) draws the global `!important` rectangle *inside* the rounded field. For inputs inside a pill or field wrapper, set `outline:none` on the input and draw the ring on the wrapper with `:focus-within`. Do the same for the Importer TC field.

## Proof (optional, one capture each)
- `editor/01-editor.png` at 1100×800: the toolbar on one row (#4, #5)
- `shell/02-command-palette.png`: the ring on the pill (#6)

After this, archive `FIXES*.md` and keep only `CHANGELOG_REDESIGN.md` as the record.
