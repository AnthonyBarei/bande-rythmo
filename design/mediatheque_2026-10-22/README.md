# Médiathèque (Plex / Jellyfin) — captures 2026-10-22

Importer › **Médiathèque** tab (previously "Plex"), on branch `feat/jellyfin`.
1440×900, headless Chrome. Connect states are mocked; library screens come from
a real Jellyfin server (posters are the server's own artwork).

The connect card and the library browser have **no reference screen** in
`design_handoff_redesign_v2/` — they were built from the PlexBrowse poster grid
only. This round is to give them a proper design.

| File | State |
|---|---|
| import/01-connect-checking.png | saved server being checked: form disabled, spinner |
| import/02-connect-unreachable.png | saved Plex server unreachable (red banner) |
| import/03-connect-detected.png | Jellyfin not configured, local server detected |
| import/04-connect-focus.png | keyboard focus on the API key field |
| import/05-connect-busy.png | "Connexion…" in progress |
| import/06-connect-error.png | connect failed |
| import/10-library-films.png | Films library — poster grid |
| import/11-library-series.png | Séries library — séries as folders (chevron) |
| import/12-series-seasons.png | série opened → saisons, breadcrumb + Retour |
| import/13-season-episodes.png | saison opened → épisodes, 16:9 cards |
| import/14-single-season-auto-open.png | série with one saison opens straight on its épisodes |
| import/15-search.png | search in Séries: séries + épisodes mixed |
| import/16-episode-loaded.png | épisode picked → Importer player, "depuis Jellyfin · …" |
| import/20-card-hover.png | film card hover — lift, zoom + darken, synopsis + **Importer** (MEDIATHEQUE.md) |
| import/21-folder-hover.png | série card hover — **Ouvrir**, chevron nudged, title accent |
| import/22-episode-hover.png | épisode card hover (16:9, no synopsis) |
| import/23-pagination-p1.png | Films, page 1 — pager under the grid |
| import/24-pagination-p3.png | Films, page 3 — `1 2 3 4 … 12` |
| import/25-skeleton.png | page loading — shimmer skeleton |
| settings/01-mediatheques.png | Réglages › Médiathèques (Plex injoignable, Jellyfin connecté) |
| settings/02-mediatheques-form.png | Réglages › Plex reconnect form |

## What to improve

1. **Provider switch placement** — the Plex / Jellyfin segmented control sits in
   the libraries card (connected) or the connect card header (not connected).
   It moves between screens; it may belong in one stable place (tab header?),
   with each provider's connection state visible at a glance.
2. **Search results (15)** — 2:3 série posters and 16:9 épisode cards share one
   grid: uneven rows, épisode cards float in tall cells. Needs grouping
   (Séries / Épisodes sections?) or a list layout for épisodes.
3. **Folder cards (11, 12)** — séries/saisons are only told apart from films by
   a small chevron. No counts available (Jellyfin API keys have no user
   context). Maybe a stacked-poster or folder treatment.
4. **Breadcrumb (12–14)** — "Retour" button + crumbs under the search pill;
   check hierarchy vs. the search pill and the server toolbar on the right.
5. **Épisode cards (13)** — year · duration overlay is low contrast on bright
   stills; title `E01 · Name` truncates early. Overview text exists server-side
   if a richer card is wanted.
6. **Connect card (01–06)** — four banner variants (checking / unreachable /
   detected / none) + error box stacked above the button; "serveur local"
   subtitle is wrong for remote servers. Simplify the states.
7. **Réglages (01, 02)** — Jellyfin's row still says "Token" (it is a "Clé API");
   Plex/Jellyfin blocks have no visual separation.
8. **Sidebar card (10–14)** — tall empty card with two entries; could be slimmer
   or become tabs above the grid.

Round 2 (hover + pagination) implemented from `design_handoff_redesign_v2/MEDIATHEQUE.md`;
captures 10–16 now show the new cards.

Regenerate (app + backend running, Jellyfin configured):
`backend/venv/Scripts/python.exe design/mediatheque_2026-10-22/shoot_mediatheque.py design/mediatheque_2026-10-22 [--app http://localhost:5173/]`
