# Redesign v2: closed

The final review proofs (`final_review_proofs/`) were checked on 2026-10-20.

- **Éditeur at 1100×800:** the transport fits on one row, with the scrub visible. The band toolbar is also one 48px row (with icon-only Resp./Réact. and the zoom cluster), and the band keeps its full height. ✅
- **The Respirations menu at 1100** opens upward over the video and isn't clipped. ✅
- **Command palette:** the focus ring is drawn on the pill wrapper, not inside it. ✅
- **CHANGELOG_REDESIGN.md:** it's complete. The final review cleanup items are recorded. ✅

Nothing left to do. Archive `FIXES*.md` and `FINAL_REVIEW.md`, and keep `CHANGELOG_REDESIGN.md` as the record.

Known gaps to carry over to the backlog (not part of the redesign):
- Bundle Shantell Sans in `backend/fonts/`. For now, MP4 export of "Feutre" falls back to Atkinson.
- Run a manual QA pass with a real mic, a 5.1 source and real exports. These can't be tested headlessly.
