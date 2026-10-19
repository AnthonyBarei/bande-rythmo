# FIXES round 7: review of `app_screens_2026-10-14_r6`

R6 landed. Every item from 1 to 14 is visible in the captures. This round has 6 polish items and then the Phase 2 Studio features, which are now ready to build.

## ✅ Done. Don't touch these again.
- **Éditeur:**
  - Durations are flagged only by the real rules (0.2 s in red, the rest in `text4`).
  - Hover actions sit on the TC line, and the note icon no longer appears twice.
  - Speed is a `Select`, and the scrub track is wide.
  - Solo focus dims the other pill and filters the list.
- **Studio:**
  - With 0 takes there is no Valider and no A/B.
  - Valider sits under the cards.
  - A cancel appears in the status line.
  - The other track is dimmed to 45%.
- **Atelier:** the error uses 2 rows. **Activité:** the failure row is aligned.
- **Bibliothèque:** the real hover shows the action row and "+ Projet", and durations use `M:SS`.
- **Importer:** the ruler and header use SMPTE without frames. **Exporter:** the format column fades at the bottom.

## ⚠️ Remaining

1. **Bibliothèque: the hover causes a layout shift.** The hovered card grows by about 43px, so the whole row below jumps from y 500 to 543. A hover must never move other cards.
   - Overlay the 44px action row inside the card. Either slide it up over the bottom of the body with `position:absolute`, or reserve its height at rest with `visibility:hidden`.
   - Keep the `translateY(-3px)` lift.
   - Proof: `01` and `03` must show the second row at the same y.
2. **The band font names differ on each screen.** Réglages says "Cursive (Caveat)", while the Éditeur and Exporter say "Manuscrite" / "Atkinson".
   - Use one list of labels everywhere: **Manuscrite** (Caveat) · **Lisible** (Atkinson) · custom fonts by their file name.
   - Réglages may show the font family as a `text3` hint on the right of each option.
3. **The `/` shortcut does two things.** In the Bibliothèque, the search field shows a `/` key and focuses the clip search, but the shortcuts overlay says "/ → Palette de commandes".
   - `/` focuses the local search on screens that have one, and opens the palette everywhere else.
   - In the overlay, write it as "/ → Rechercher (ou palette)" and keep ⌘K as the palette.
4. **Importer: "Créer 0 clip"** is shown disabled when there are 0 clips. Show "Créer le clip" disabled at 0, and "Créer N clips" from 1 up. The same goes for "CLIPS EN ATTENTE 0": hide the section heading until a clip is pending.
5. **Importer pending row:** the at-rest text "Sans nom — cliquer pour nommer" is still a sentence. Make it a placeholder: "Nom du clip…" in `text3`, with the same input box as the focused state but a `border` color instead of the accent.
6. **Duplicate running toasts:** two "Export MP4 + BR · Supersample 4 · 46%" toasts are stacked in the Atelier. When running jobs have the same type, clip and options, collapse them into one toast with a `×2` count, as for errors. Cancelling cancels both.

## 🆕 Phase 2: Studio

**A. Écouter en contexte**
- Add a ghost button to each take card, next to ▶: the `film` icon, tooltip "Écouter sur l'image".
- It plays the take over the image and the band from `start`, with VO muted to 15% (setting: "VO pendant l'écoute" 0 / 15 / 50%, default 15).
- The take card shows the same filling waveform as ▶. The image's TC overlay reads `▶ PRISE n · TC`.
- Esc, or clicking again, stops it.

**B. Navigation between répliques**
- ← and → go to the previous or next réplique of the **active character**. Alt+← and Alt+→ go to any character.
- The line strip text slides out to the left or right over .2 s.
- The band and the image seek to `start − 3 s`, ready for R.
- Add both shortcuts to the overlay under "Studio".

**C. A/B comparer**
- The chip toggles A/B mode. Each card shows an `A` / `B` pill, and the first two clicks assign A and then B.
- A compact bar appears above the cards: `[A ▶] [B ▶]  ⇄ basculer (Tab)`.
- Tab switches between A and B **at the same playback position**, with no restart.
- Leaving A/B mode clears the assignments.

**D. Progress per character**
- The line strip shows `Prises 3 / 30 · Red` on the right in `text3`, next to the prev / next buttons.
- When the last réplique of a character is validated, show a toast: "Red : toutes les répliques validées", with an "Exporter le MP4 doublé" action.

## Proof for next round
- `library/01-library.png` + `03-library-card-hover.png`: the second row at the same y (#1)
- `settings/01-settings.png`: the same font labels (#2); `shell/03-shortcuts-overlay.png` (#3)
- `import/01-import.png` (#4), `import/04-import-inout.png` (#5), `atelier/02-atelier-gif.png`: a single `×2` toast (#6)
- `studio/09-studio-context-play.png`, `10-studio-nav-next.png` (mid-slide), `11-studio-ab.png`, `12-studio-all-validated.png` (Phase 2)
