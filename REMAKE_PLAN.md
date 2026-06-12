# REMAKE PLAN — Bande Rythmo → professional app

> Audit date: 2026-06-07. Sources: full frontend + backend code audits, live export tests, prototype/design review.
> Goal: remake the codebase into a professional-grade dubbing studio app without losing any working feature.

---

## 1 · Verdict — where the app stands

**Feature-complete for solo BR creation.** The pro BR pipeline (détection signs, boucles,
START/BIP/PI, SMPTE, DetX/Croisillé, word-level rythmo, scene cuts, undo/redo, proxy,
takes, A/B) is all present and the 9 export formats all work (tested live: SRT 51 cues,
DetX 51 lines + 104 lipsync pairs, ASS karaoke with `\kf`, GIF 0.6s, MP4 draft 6.3s).

**Not yet professional-grade** on three axes:
1. **The dubbing loop is open-ended** — you can record takes but **cannot export a dubbed
   video**. No take→audio mixing. This is THE missing feature for a dubbing app.
2. **Engineering fragility** — 3,650-line editor monolith, in-memory job store (lost on
   restart), SQLite without WAL (locks under concurrency), 16 silent catches, no tests,
   no TypeScript.
3. **Single-user, single-machine** — no projects beyond a string tag, no QC workflow,
   no delivery packaging, no auth.

---

## 2 · Feature audit

### Professional BR creation — ✅ mostly complete
| Need | Status |
|---|---|
| Word-level rythmo band, stretch, manuscrite font | ✅ |
| Détection phonétique (labiale/semi/fricative/arrondie/ouverte) + burn MP4 | ✅ |
| Boucles, START/BIP/PI calibration, SMPTE TC @ clip fps | ✅ |
| Line flags off/dos/ambiance/plan_cut + notes | ✅ |
| DetX (Cappella/Joker compat) + Croisillé | ✅ |
| Scene cuts auto (ffmpeg) | ✅ |
| **Frame-accurate snapping** (subs are float secs; words can drift 1–2 frames) | ❌ P1 |
| **Word re-alignment after edit** (Whisper words go stale on text edit → fallback) | ❌ P2 |

### Recording / dubbing — ⚠️ the open loop
| Need | Status |
|---|---|
| Take recording, queue, A/B compare, video-synced preview | ✅ |
| **Mix takes → export dubbed MP4** (replace/duck source audio) | ❌ **P0 — flagship gap** |
| **Replace clip audio from a file** (drop a .wav over the clip) | ❌ P0 (user-requested) |
| Take gain/normalization (-18 dBFS) | ❌ P1 |
| Take versioning ("v1 final") | ❌ P2 |
| Vocal separation (Demucs) | ✅ exists — but stems are dead-end downloads; **no "use as bed" workflow** ❌ P1 |

### Meme / clip edition — ✅ working, minor gaps
| Need | Status |
|---|---|
| Image/GIF/audio meme modes, unified IN/OUT player, layers | ✅ |
| Clip cut/rename/status/project, import SRT/ASS/VTT/DetX | ✅ |
| Batch export (N clips → ZIP) | ❌ P2 |
| Delivery package (MP4+SRT+DetX+stems in one ZIP) | ❌ P2 |

### Exports — ✅ verified live
All 9 formats pass. Two design issues:
- `/export` trusts **client-sent subtitles** instead of DB → exports can silently diverge
  from saved state. → P1: server reads DB, client sends only ids/options.
- Quality presets hardcode supersample; no user override. → P2.

---

## 3 · Architecture findings (from deep audits)

### Backend (FastAPI) — hardening needed
| Sev | Finding | Fix |
|---|---|---|
| 🔴 | SQLite `check_same_thread=False` without WAL → `database is locked` under load | Enable WAL + busy_timeout (P0, 2 lines) |
| 🔴 | `JOBS` dict in-memory → restart loses all jobs/results | Persist job rows to DB (P1) |
| 🔴 | 8× bare `except: pass` (export DB writes, proc.kill, ffprobe fallbacks) | Log + surface (P0) |
| 🟡 | FK columns unindexed (Subtitle/Export/Take.clip_id) | `index=True` (P0, trivial) |
| 🟡 | Export deletes don't cascade from Clip; orphaned intermediates on crash | cascade + GC sweep (P1) |
| 🟡 | Path validation: fonts registry filename, local batch path, Plex URL (SSRF) | basename/scheme checks (P1) |
| 🟡 | No upload size limit on batch video; no rate limit on transcribe/export | middleware (P2) |
| 🟢 | Subprocess args are list-form (no shell injection) ✅; StaticFiles sandboxed ✅ | — |

### Frontend (React) — structure needed
| Sev | Finding | Fix |
|---|---|---|
| 🔴 | `DubbingWorkspace.jsx` = **3,652 lines**, 10 responsibilities, 30+ refs, 50+ states | Split → hooks (`useSubtitles`, `useBRCanvas`, `useDrag`, `useKeyboard`, `useBoucles`, `useDetection`) + components (Transport, BandToolbar, Inspector) (P1, the big one) |
| 🟡 | 5 duplicate timecode formatters, TRACK_COLORS duplicated ×10, hex accent ×18 | `utils/timecode.js` + `config/colors.js` (P0, hours) |
| 🟡 | 16 silent catches (scene detect fails silently, waveform, fonts) | toast pattern (P0) |
| 🟡 | ui.jsx design system adoption ~20% — 835 inline styles | adopt in toolbars/panels during split (P1) |
| 🟡 | No ESLint/Prettier/tests/TypeScript; no lazy loading | ESLint+Prettier (P0), Vitest on undo/drag/CRUD (P1), lazy Meme/Plex/Export (P2), TS types for API shapes (P2, incremental) |

---

## 4 · UX/UI propositions (beyond the shipped redesign)

1. **"Mixage" stage in the editor** — new inspector tab or bottom drawer: per-réplique
   take slots, gain sliders, source-audio duck %, then "Exporter doublé". Closes the loop.
2. **Onboarding/empty states** — first-run: sample clip + 30-second guided tour
   (import → transcribe → band → record → export).
3. **Command palette depth** — actions on the current réplique (set flag, add note,
   record) not just navigation.
4. **Séance mode (Studio full-screen)** — distraction-free record view: big text,
   pre-roll countdown, auto-advance to next réplique of the character. The current
   RecorderPanel reskin is the seed; promote to a route.
5. **Conflict-safe autosave** — version stamp on PUT subtitles; if stale, offer
   merge/overwrite dialog instead of last-write-wins.
6. **Performance** — virtualize the réplique list (51+ rows re-render on every parent
   state change today); memo panels after the split.

---

## 5 · Execution phases

### Phase 0 — hardening quick wins ✅ (2026-06-07)
- [x] SQLite WAL + busy_timeout + FK indexes (`c5322c8`)
- [x] Bare excepts logged (backend) + toast surfacing (frontend) (`c5322c8`, `4e810bf`)
- [x] `utils/timecode.js` + `config/tracks.js` dedup (`08d831b`)
- [x] ESLint baseline — caught 2 real bugs (dup function, dup style keys) (`22a054f`)
- [x] Path validation (fonts basename, plex URL scheme) (`c5322c8`)
- [ ] Prettier + upload size caps + rate limiting (deferred to Phase 3)

### Phase 1 — the flagship feature: dubbed export ✅ core (2026-06-07)
- [x] `POST /api/export/mp4-dubbed`: ffmpeg amix — bed duck/mute + takes adelay'd
      at réplique start + per-take gain + loudnorm −16 LUFS, video copied (`cd31b6a`)
- [x] Audio replacement: upload audio file → 48k wav bed (`/replace-audio`)
- [x] Demucs stem → bed (`/use-stem`), reset (`DELETE /audio-bed`)
- [x] Mixage UI in ExportPanel (takes + gains + duck/mute + bed controls) (`17d7842`)
- [ ] Take gain auto-normalization on upload (−18 dBFS) — later
- [ ] Mixed audio under the BR-band MP4 export (combine pipelines) — later

### Phase 2 — editor refactor (2–3 sessions, no behavior change)
- [ ] Extract `useSubtitleManager` (CRUD/undo/autosave) — with Vitest coverage
- [ ] Extract canvas renderer + drag machine + keyboard hooks
- [ ] DubbingWorkspace → ~300-line orchestrator; panels lazy-loaded
- [ ] Server-side export source of truth (DB subtitles, not client payload)

### Phase 3 — pro workflow (later)
- [ ] Jobs persisted to DB + retry after restart
- [ ] Frame-snap + word re-align endpoints
- [ ] Batch export + delivery package ZIP
- [ ] Project entity (color, archive, QC status pending/approved)
- [ ] Auth (single-password → JWT) when multi-user lands

---

## 6 · Explicit non-goals (for now)
- PostgreSQL migration (WAL suffices ≤5 concurrent users)
- Full TypeScript rewrite (incremental `types/` only)
- Multi-user realtime co-editing
