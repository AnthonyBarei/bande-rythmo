# STUDIO v2 · round 2: review of `studio_v2_proofs`

**Verdict:** the behaviour is right.
- The image and timecode stay frozen during the countdown (the 4 captures 0.5s apart all read `t = 8.03`, paused).
- The lead-in plays before the line.
- After Valider, the next line opens in prêt and nothing plays.
- The role menu, the En continu live list and the summary all work.

What's left is 7 layout and polish items.

## ⚠️ Remaining

1. **The line text crosses the image edge** (`14`, `15`, `17`). The Caveat text block is anchored to the stage box, not to the video. It sits half on the picture and half on the black letterbox, and the gradient doesn't cover it.
   - Anchor the overlay to the **actual rendered video rect**, using the same rect the TC chip should use.
   - Put the text inside the bottom 30% of the picture, with the gradient behind it.
   - If the letterbox under the picture is ≥ 72px, put the text there instead, on black with no gradient. Pick one rule and apply it in every state.
2. **The countdown hint has low contrast** (`15`): "Échap pour annuler" sits straight on the picture. Put it in a `rgba(0,0,0,.7)` pill (radius 6, padding 4×10), 12px under the number.
3. **The session range label wraps** (`18`, `19`): "Depuis la réplique courante · 00:00:10:08 → 00:01:06:08" breaks mid-timecode.
   - Line 1: the range name (`text2`).
   - Line 2: `IN → OUT` in mono `text3`, with `white-space: nowrap`.
4. **Empty répliques in the En continu list** (`18`, `#17`): a row with no text shows only a number.
   - Show `(sans texte)` in italic `text3`.
   - If the réplique only holds marks (breath, pause), show the marks.
   - Keep these rows in the range: they're still timecode slots.
5. **The live list must follow the playhead:** while recording, keep the live row visible. Scroll the list so the live row sits second from the top, with `scrollTop` and a smooth scroll, never `scrollIntoView`. Stop auto-scrolling for 4s after the user scrolls by hand.
6. **The header doesn't match the strip** (`19`): the header says "réplique 8 / 51" while the strip shows `#09`. Both follow the same line: the strip line during En continu, `idx` otherwise. After the summary, set `idx` to the last captured line.
7. **The record button during the summary** (`19`): the mic button looks active but does nothing. Disable it (`opacity .4`, `cursor: default`, tooltip "Choisir une action dans le résumé"). The summary card keeps focus, so Entrée = the primary action and Échap = "Revoir réplique par réplique".

## Proof (optional)
- `14-pret.png`: the text inside the picture or in the letterbox, not across the edge (#1)
- `15-decompte.png` (#2)
- `18-continu-rec.png`: the label on 2 lines, the `(sans texte)` row, and the live row in view after a few lines (#3–#5)
- `19-continu-summary.png`: matching line numbers, the disabled mic button (#6, #7)
