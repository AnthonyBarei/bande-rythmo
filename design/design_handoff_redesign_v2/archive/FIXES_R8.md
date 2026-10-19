# FIXES round 8: review of `app_screens_2026-10-14_r7`

R7 landed. The polish items and all four Phase 2 Studio features work: écoute en contexte, ←/→ navigation, A/B with Tab, and progress plus the "toutes validées" toast. This round has 8 small items. After it, only the final acceptance pass is left (bottom of this file).

## ✅ Done. Don't touch these again.
- **Library:** the hover no longer moves the grid; the second row stays at the same y.
- **Font labels:** one list (Manuscrite / Lisible / Feutre / Neutre / Mono) with the family as a hint.
- **`/` shortcut:** focuses the local search, or opens the palette. **Importer:** "Créer le clip" at 0, no section heading at 0, "Nom du clip…" placeholder.
- **Toasts:** one toast with `×2` for duplicate running jobs.
- **Studio:**
  - Écouter sur l'image with the `▶ PRISE n · TC` overlay.
  - The slide transition between répliques.
  - The A/B bar with Tab.
  - Per-character progress and the final toast.
  - The "VO pendant l'écoute" setting.

## ⚠️ Remaining

1. **The shortcuts overlay overflows again.** With the new STUDIO section, GÉNÉRAL is cut off at the bottom at 900px, with no sign that it scrolls.
   - Use 3 columns at ≥ 1280px: Transport + Studio · Bande rythmo + Gestes · Général.
   - Below 1280px, scroll inside the panel, with a 24px bottom fade.
   - It must fit at 1440×900 without scrolling.
2. **Toast position:** the "Dale : toutes les répliques validées" toast sits bottom-**left**, over the rail and the band. Every toast uses the same stack, bottom-right, above the inspector hint bar in the Éditeur.
3. **Studio progress label:** `Prises 21 / 21 · Dale` reads like a take count. Show `Dale · 21/21 validées` in `text3`, and turn it `success` when complete. On réplique 4, `Prises 1 / 30 · Red` should read `Red · 1/30 validées`.
4. **Studio A/B mode:**
   - The "validée" chip shrinks to a bare ✓ on Prise 2. Keep the full `✓ validée` chip. If space is short, hide the duration (it's already in the A/B bar), not the chip.
   - Unassigned cards show a faint "A/B" text. Use an outline pill `+` with the tooltip "Assigner A / B", at the same size as the A and B pills.
5. **Exporter "Police BR"** is a 2-option `Segmented` (Manuscrite / Lisible), but there are now 5 fonts. Use the same `Select` as the Éditeur toolbar, 160px, defaulting to the project font.
6. **The "Neutre" font is Inter.** The README rules out Inter. Map Neutre → **IBM Plex Sans**, which is already loaded. If a project already uses Inter, keep it working through a fallback, but don't offer it in the list.
7. **Library cards at rest** now have an empty strip about 44px high under the meta row (the reserved space for the action row). It makes the cards look unfinished.
   - Switch to the overlay approach: the action row is `position:absolute; bottom:0`, slides up 8px with a fade, and covers the meta row on hover.
   - The meta row is in the thumbnail tooltip anyway. The card height stays the same at rest and on hover.
8. **Studio nav mid-slide** (`10`): the character name disappears during the slide. Only the Caveat text should slide. The avatar and name swap instantly at the start of the transition.

## 🏁 Final acceptance pass (after R8)
Run this once, then the redesign is closed:
- Capture every screen at **1440×900 and 1100×800**. Nothing should overflow or be clipped, and nothing should hide text, in either size.
- `grep` the frontend for `Inter`, unicode icon glyphs (`▶ ✕ ✓ ⏸` used as icons), and local style objects (`tBtn`, `btnBase`, `iconBtn`, `SL`, `BTN_GHOST`). There should be 0 hits.
- `grep` for timecode formats that aren't SMPTE (`toFixed(1)}s` used as a timecode, `mm:ss.s`). Durations may stay `x.xs`.
- Keyboard-only pass: Tab through each screen. Every control must show a visible focus ring (accent, 2px).
- Run the `REDESIGN_ADOPTION_HANDOFF.md` §4 feature checklist. Everything should still pass.
- Write a short `CHANGELOG_REDESIGN.md` listing what changed per screen, for the record.

## Proof for next round
- `shell/03-shortcuts-overlay.png`: everything visible at 900px (#1)
- `studio/12-studio-all-validated.png`: the toast bottom-right and the success progress label (#2, #3)
- `studio/11-studio-ab.png` (#4), `studio/10-studio-nav-next.png` (#8)
- `export/01-export.png`: the font Select (#5); `editor/11-font-menu.png`: Neutre = IBM Plex Sans (#6)
- `library/01-library.png` + `03-library-card-hover.png`: no empty strip, same card height (#7)
- `final/`: the acceptance captures at both sizes, plus the grep output
