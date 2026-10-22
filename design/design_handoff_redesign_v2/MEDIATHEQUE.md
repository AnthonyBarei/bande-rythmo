# MÉDIATHÈQUE: hover + pagination (layout unchanged)

**Reference:** `reference/redesign/screen-mediatheque.jsx`. Open `reference/redesign.html` → Importer; the screen opens on the Médiathèque tab.

**Scope: keep the current layout** (the sidebar with the Plex/Jellyfin segmented control and Bibliothèques, the search pill with server + Recharger, Retour + breadcrumb, poster grid, 16:9 episode cards, connect card). Only add the two behaviours below. The posters in the mock are generated placeholders; keep the real server artwork.

## 1. Hover and focus on cards
Use `cubic-bezier(.2,.7,.2,1)` for all motion. `:focus-visible` = hover, plus a 2px accent ring on the card.

| Part | Rest | Hover / focus |
|---|---|---|
| Card (whole box, art + footer) | `surface`, `0 0 0 1px border` | `translateY(-4px)` .22s; shadow `0 0 0 1px border3, 0 16px 36px rgba(0,0,0,.55)` |
| Artwork | | `scale(1.06)` .5s + `brightness(.62)` |
| `year · durée` chip (bottom-left on the art) | mono 10.5px, on `rgba(0,0,0,.72)` (fixes the low contrast on bright stills) | fades out |
| Overlay | hidden, `translateY(8px)` | fades in and slides to 0 over .2s: the synopsis (`Overview`, 3-line clamp, posters only) + a CTA |
| CTA | | film / episode: **Importer** (accent, 28px); série / saison: **Ouvrir** (glass `rgba(255,255,255,.14)` + blur) |
| Title | `text`, 1 line | turns accent |
| Folder chevron (séries, saisons) | `text4` | `translateX(3px)`, accent |

- **Entrance:** cards fade up 10px over .35s, staggered by 25ms per card (capped at 12), on every page change or navigation.
- **Sidebar library items:** hover gives `surface2` + `text`. The active item keeps its accent tint.
- **Sidebar counts:** show the item count in mono after each library name (`Films 87`).
- Respect `prefers-reduced-motion`: no translate or scale, just the opacity changes.

## 2. Pagination
- **Page size: 24.** Fetch per page: Jellyfin `StartIndex` / `Limit`, Plex `X-Plex-Container-Start` / `X-Plex-Container-Size`. Read the total from `TotalRecordCount` / `totalSize`.
- **The footer goes under the grid,** centered:
  - `1–24 sur 87` in mono `text3`.
  - Then `‹  1  2  3  4  ›`. The current page is accent on #0b0b0d; the others go `surface2` + `border2` on hover.
  - With many pages, collapse with an ellipsis: `1 … 4 5 6 … 12`.
  - With a single page, show only `18 éléments` in `text4`.
- **Changing page:**
  - Scroll the grid to the top with `scrollTop = 0` (not `scrollIntoView`).
  - Show the skeleton grid (shimmer) until the page arrives. Use the same skeleton when switching library, opening a série or saison, and on Recharger.
- **Keyboard:** `PgSuiv` / `PgPréc` change page (ignored while typing), and `Retour arrière` goes up one breadcrumb level.
- **Remember the page for each view** (library, série, saison, search term). Going back from a série returns to the page you left.
- **Search** results are paginated the same way, and they reset to page 1 when the query changes.
- **Prefetch the next page** when the user hovers the › button or reaches the last row.

## Proof (1440×900)
`import/20-card-hover.png` (film) · `21-folder-hover.png` (série) · `22-episode-hover.png` · `23-pagination-p1.png` · `24-pagination-p3.png` (ellipsis) · `25-skeleton.png`
