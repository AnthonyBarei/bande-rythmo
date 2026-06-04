# Handoff Status — Bande Rythmo
_Cross-reference: design handoff package vs codebase (2026-06-04)_

> Source docs: `UX_REVIEW.md`, `PRO_BR_HANDOFF.md`, `DOUBLAGE_IA_REVIEW.md`, `MEME_PLEX_HANDOFF.md`
> Rule: codebase wins over mock where they conflict.

---

## UX_REVIEW.md

| Item | Sev | Status |
|---|---|---|
| Progress + cancel — Whisper, MP4, remux | 🔴 | ✅ Done — full job system (fire-and-poll, %, ETA, cancel, retry, WebSocket) |
| Shortcuts overlay (wire Raccourcis button) | 🔴 | ✅ Done — `ShortcutsOverlay.jsx` wired in `App.jsx` |
| Undo/cancel in BR editing | 🔴 | ✅ Partial — undo toast on réplique delete; no full undo stack (P1 in upgrade plan) |
| One reusable `<VideoPlayer>` | 🟡 | ✅ Done — `VideoPlayer.jsx` used in Doublage + Meme |
| Explicit clickable status lifecycle | 🟡 | ✅ Done — `ClipCard` has status chips, click-to-cycle, filter tabs |
| Confirm/undo destructive deletes | 🟡 | ✅ Done — clip delete has confirm; réplique delete has undo toast |
| One-click retry on failures | 🟡 | ✅ Done — `retry` prop wired in Whisper job, MP4 job, GIF job, batch import |
| Réglages page | 🟢 | ✅ Done — accent, BR style, density, Whisper default lang, Whisper model indicator, Plex connect |
| Focus-visible rings | 🟢 | ⚠️ Not done — custom buttons use hover only |
| First-run empty state CTA | 🟢 | ⚠️ Not done — empty clips state exists but CTA is text, not a real button |
| Hit target floor (32px) | 🟢 | ✅ Partial — band toolbar buttons are 32px; some inline × still smaller |

---

## PRO_BR_HANDOFF.md

| Section | Item | Status |
|---|---|---|
| §1 | Caveat font bundled + picker | ✅ |
| §1 | Shantell Sans "lisible" registered | ✅ |
| §1 | Font picker in toolbar (Affichage ▾) | ✅ |
| §2a | `words[].signs` per-character detection JSON | ✅ |
| §2b | `Subtitle.off / .dos / .ambiance / .plan_cut` | ✅ |
| §2c | `Clip.fps` + ffprobe at import | ✅ |
| §2c | `Boucle` table + idempotent migrations | ✅ |
| §3a | `classifyChar()` in `detection.js` + `detection.py` mirror | ✅ |
| §3b | Sign drawing: labiale/semi/fricative/arrondie/ouverte | ✅ |
| §3c | Detection layer toggle + 6 per-sign toggles + aide auto | ✅ |
| §3d | Line flags rendered (off/dos/ambiance/plan_cut/début-fin) | ✅ |
| §4a | SMPTE `fmtTC(t, fps)` cursor TC chip | ✅ |
| §4b | START (−3s) / BIP 1000Hz (−2s) / PI (0s) calibration marks | ✅ |
| §4c | Boucles rendering + toolbar Boucle+ | ✅ |
| §5 | DetX pro: fps, lipsync signs, off/dos/ambiance/plan attrs | ✅ |
| §5b | Croisillé HTML export | ✅ |
| §5 MP4 | `detection_burn` flag wired to br_renderer | ⚠️ Flag exists, `_draw_signs()` is Phase 2 no-op |

---

## DOUBLAGE_IA_REVIEW.md

| Item | Status |
|---|---|
| 6-cluster toolbar: Qui · Éditer · Insérer ▾ · Détection ▾ · Boucles ▾ · Affichage ▾ | ✅ |
| Character picker portaled to `document.body` | ✅ |
| Header character pills FILTER the band (multi-select, reset) | ✅ |
| Décalage in Affichage ▾ only (not always-visible) | ✅ |
| Click-letter to cycle detection sign | ✅ |
| One transport — no play/speed/mute duplicate in band toolbar | ✅ |
| Loop-active (⟲) in band toolbar | ⚠️ Still in band toolbar, spec says move to transport bar |
| Z-index CSS tokens (`--z-dropdown`, `--z-modal`, `--z-toast`, etc.) | ✅ |
| All dropdowns portaled with `position:fixed` + anchor | ✅ |
| "Pro classique" defaults: Classique style, Caveat font | ✅ |
| Waveform at ~15% opacity behind text | ✅ |
| SMPTE TC readout at cursor | ✅ |
| Z-index § 8 fix: `--z-dropdown: 60` applied | ✅ |

---

## MEME_PLEX_HANDOFF.md

| Item | Status |
|---|---|
| **Part 0** — Fix "Mème" → "Meme" in h1/labels | ✅ |
| **Part 1** — Restyle: design tokens, radii, accent var, icon set | ✅ Partial — BTN_GHOST + Icon set used; full restyle audit needed |
| **Part 1** — Plex connect screen (centered card, probe banner, token mask) | ⚠️ Plex connect is in `Preferences.jsx`; `PlexBrowser.jsx` connect state not yet restyled to spec |
| **Part 1** — Plex browser: left sidebar libraries, search pill, poster grid, accent ring | ⚠️ Not done |
| **Part 2** — Unified range player (imageMode flag) | ⚠️ Image mode still separate scrubber |
| **Part 2** — Tab rename: "Extrait audio" | ⚠️ Tab still says "Audio" |
| **Part 2** — Flow hint ("Image & GIF passent par l'éditeur…") | ⚠️ Not done |
| **Part 2** — Result replaces source on Générer | ⚠️ Not done (result appears stacked) |
| **Part 2** — Layer duplicate / reorder / nudge | ⚠️ Not done |

---

## Summary — remaining work

### Shipped since this doc was written

| Item | Source | Branch |
|---|---|---|
| Frame-by-frame nav (Shift+←/→) | UPGRADE_PLAN P0 | merged |
| SRT / ASS / VTT import | UPGRADE_PLAN P0 | merged |
| BRTimeline nav bar in Doublage | UPGRADE_PLAN P0 | merged |
| Undo/redo stack (Ctrl+Z/Y) | UPGRADE_PLAN P1 | merged |
| Auto scene change detection | UPGRADE_PLAN P1 | merged |
| MP4 detection burn `_draw_signs()` | PRO_BR §5 Phase 2 | merged |
| Notes per réplique (`note` column) | UPGRADE_PLAN P1 | merged |
| GPU export (NVENC/QSV/AMF) | UPGRADE_PLAN P1 | merged |
| Focus-visible rings | UX_REVIEW §7 | merged |
| Custom font upload (TTF/OTF) | PRO_BR §1 | `feat/custom-fonts` |
| Meme unified player + result-replaces-source | MEME_PLEX Part 2 | `feat/meme-unified` |
| Plex restyle (connect card + browser sidebar) | MEME_PLEX Part 1 | already on main ✓ |
| Whisper language config per clip | roadmap | already wired ✓ |
| Per-word toggle + stretch markers | UPGRADE_PLAN | merged |
| Export history, quality presets, job-mode batch | — | merged |

### Still open

| Item | Source | Effort |
|---|---|---|
| Video proxy (720p/480p) | UPGRADE_PLAN P2 | 3h |
| Move ⟲ loop-active to transport bar | DOUBLAGE_IA §3 | 30min |
| First-run empty state CTA button | UX_REVIEW §5 | 30min |
| Auto-translation (LibreTranslate/DeepL) | UPGRADE_PLAN P3 | — |
| Dubbing lexicon | UPGRADE_PLAN P3 | — |
| Project folder organization | UPGRADE_PLAN P3 | — |
