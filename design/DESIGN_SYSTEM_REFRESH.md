# Design-system refresh — sizes, type & icons

> **Companion to** `UX_REVIEW.md` (which flags *what* feels off). This doc gives the *tokens* to fix it. Visual reference on the canvas: section **"Refonte visuelle — système & finitions"** (3 artboards). Apply this **before** the page-level restyles in `MEME_PLEX_HANDOFF.md`, since those should consume these tokens.

The app already has a solid foundation in `frontend/src/index.css` (IBM Plex Sans, JetBrains Mono, z-index scale, focus rings, semantic colors). What's missing is a **systematic scale** for type, control sizes, and icons. Right now those are ad-hoc per component, which is why it reads slightly inconsistent despite looking good.

---

## 1. Type scale — the priority fix

**Problem:** ~16 distinct `fontSize` values across the app (8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 15, 16, 17…), many in half-pixels, **six of them below 11px** — unreadable on a studio screen.

**Fix:** 7 named steps, nothing below 11px. Caps express hierarchy with letter-spacing, not by shrinking.

```css
:root {
  --fs-micro: 11px;  /* CAPS micro-labels, mono counters — letter-spacing .4px, weight 600 */
  --fs-xs:    12px;  /* secondary meta, bullets, timecodes */
  --fs-sm:    13px;  /* controls, button labels */
  --fs-base:  14px;  /* body · subtitle text (default) */
  --fs-md:    16px;  /* emphasis · active character name — weight 600, ls -.1 */
  --fs-lg:    20px;  /* section titles — weight 600, ls -.2 */
  --fs-xl:    26px;  /* page titles — weight 600, ls -.4 */

  --lh-body: 1.5;
  --lh-tight: 1.3;
}
```

**Rules**
- Never a half-pixel. The value always comes from a token.
- Never below 11px. If something "needs" to be smaller, it's saying too much — cut content or use spacing.
- Mono (`--font-mono`) only for timecodes, counters, shortcuts, code-like values.
- Body `line-height: 1.5`; titles `1.3`.

**Migration:** find-and-replace `fontSize` literals → nearest token. Anything `< 11` rounds **up** to `--fs-micro`. The biggest wins are ClipCard meta, the BR toolbar, and context menus.

---

## 2. Control sizes & density

**Problem:** button heights span 22/24/26/28/32px with cramped `2px 4px` paddings; several icon buttons are 22px — below a comfortable pointer target.

**Fix:** three control heights + a 32px hit-target floor.

```css
:root {
  --ctl-sm: 28px;   /* secondary controls, inside popovers */
  --ctl-md: 32px;   /* DEFAULT — buttons, selects, inputs */
  --ctl-lg: 36px;   /* primary actions, CTAs */

  --tap-min: 32px;  /* minimum pointer target — pad icon buttons up to this */
}
```

- Icon-only buttons: render the glyph at 15–16px but give the button `--tap-min` box.
- Spacing rhythm on a **base-4** grid: 4 / 8 / 12 / 16 / 20 / 24. Avoid odd one-offs (7, 9, 11, 13).
- Radii (already mostly in place): cards 8–10px, controls 6–7px, chips 5px.

---

## 3. Icon system

**Problem:** the clean `Icons.jsx` SVG set coexists with leftover unicode glyphs in the chrome: `◎ ◉ ● ✕ × ▸ ▤ ○ ✓ ↗ 🔇 🔊 ▶ ⏸`.

**Fix:** one source of truth — `Icons.jsx`. Retire the glyphs:

| Glyph(s) | Replace with |
|---|---|
| `◎ ◉` (mic/rec) | `ICONS.mic` / `ICONS.rec` |
| `●` status dot | a real `<Dot>` element (colored span), not a glyph in text |
| `✕ ×` | `ICONS.close` |
| `▸ ▾` | `ICONS.chevron` (rotate) |
| `▤` | `ICONS.grid` |
| `✓` | `ICONS.check` |
| `🔇 🔊` | `ICONS.speaker` (+ muted variant) |
| `↗` export | `ICONS.download` |
| `▶ ⏸` | `ICONS.play` / `ICONS.pause` |

**Rules**
- Default render **16px**; primary **18px**; never below 14px.
- Stroke width 1.6 (≤16px) / 1.75 (>16px) — pick one per icon, don't mix.
- Color via `currentColor` so icons inherit their context.
- **No emoji or unicode glyphs in the chrome.** (Emoji are fine only inside user content like memes.)

---

## 4. Apply order

1. Add the tokens above to `:root` in `index.css`.
2. Sweep `fontSize` literals → type tokens (start with ClipCard, BR toolbar, context menus).
3. Sweep button/icon sizes → control tokens; pad icon buttons to `--tap-min`.
4. Replace unicode glyphs → `Icons.jsx`.
5. Then run the page restyles (`MEME_PLEX_HANDOFF.md`) consuming these tokens.

Reference artboards: *Échelle typographique*, *Tailles, densité & audit d'icônes*, *Avant / Après · carte clip*.

---

## 5. What NOT to change

- The color system and semantic tokens in `index.css` are good — keep them.
- The dark + yellow identity stays. This is about consistency and legibility, not a re-skin.
- Don't touch the working interaction logic — this is a presentation-layer pass.
