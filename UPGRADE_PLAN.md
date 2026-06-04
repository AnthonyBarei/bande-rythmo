# Bande Rythmo — Upgrade Plan
_Generated 2026-06-03 — based on Bulles Studio competitive analysis_

---

## Feature inventory — current state (2026-06-03)

### Import & source management

| Feature | Details |
|---|---|
| Video upload | Drag-and-drop or file picker; multipart form upload to FastAPI |
| Local file picker | Windows PowerShell `OpenFileDialog` — opens native file browser |
| HTTP/URL source | Direct ffmpeg URL (Plex, LAN streams, HTTP files) |
| Stream probe | `ffprobe` — lists video+audio tracks, lets user pick streams before cut |
| Plex integration | Connect via URL+token; browse libraries, seasons, episodes; stream direct to timeline |
| Timeline drag-to-create | Scrub source video → drag to mark clips → batch extract all at once |
| Multi-clip batch cut | Job mode — per-clip progress + cancel; fallback sync mode for uploads |
| ffprobe fps detection | Frame rate detected at import, stored on clip, used for SMPTE TC |
| Remux to MP4 | Streams incompatible with browser (MKV, AVI, etc.) remuxed to MP4 in background job |
| Clip thumbnails | Auto-generated at midpoint via ffmpeg |

### Clip library

| Feature | Details |
|---|---|
| Grid view | Cards with thumbnail, name, status badge, duration |
| Status tabs | All / À faire / En cours / Terminé — filter + count |
| Rename | Inline click-to-edit |
| Status update | One-click cycle (todo → in_progress → done) |
| Delete | With cascade to subtitles, boucles, takes, exports |
| Quick actions | Doubler (open workspace) · ▶ (preview) · MP3 · GIF · ✕ |
| Search | Text filter on clip name |

### BR Editor (DubbingWorkspace)

#### Playback & navigation
| Feature | Details |
|---|---|
| Custom video player | HTML5 video with custom controls overlay |
| Play/pause | Space bar |
| Speed control | x0.5 / x1 / x2 |
| Seek | Click BR canvas, click subtitle in list, click timestamp |
| Volume / mute | Player controls |
| Loop region | Shift+drag on canvas — loops [start, end] during playback |
| BR offset slider | −2s to +2s sync correction (`brOffset`) |
| Auto-fit pxPerSec | On clip open: measures densest réplique, picks scroll speed clamp [100–220] |
| Zoom | Alt+wheel on canvas; +/− buttons in Affichage popover |
| Character filter | Multi-select pills in header — hides other tracks |
| BR-in-player toggle | Never / À la lecture / Toujours (subtitle overlay on video) |

#### BR canvas rendering
| Feature | Details |
|---|---|
| Constant-speed scrolling | Cursor fixed at 32% from left; text scrolls at `pxPerSec` |
| Multi-track layout | One track per character; up to 4 colors |
| Per-word rendering | Each word fills its own Whisper timestamp block; auto-fallback to whole-line if stale |
| Word-by-word toggle | Setting in Affichage popover; persisted in localStorage |
| Stretch markers | 2px bar at word block bottom: red (<0.45), amber (<0.75), blue (≥1.05 sparse) |
| scaleX stretch/compress | Word squeezed/stretched to fill block; capped at 1.2× natural width |
| Reaction tags | `*` renders as ○ glyph in track accent color |
| Style: classique | Colored tinted blocks with bright left edge |
| Style: neon | Glowing outline blocks; neon shadow on active text |
| Style: minimal | Thin bottom bar only |
| Font picker | Atkinson / Manuscrite lisible (Shantell Sans) / Cursive (Caveat) / Inter / JetBrains Mono |
| Font scale | A− / A+ in Affichage (0.6× – 2.0×) |
| Character badge (avatar) | Colored pill with initials above each réplique block |
| Cursor TC chip | SMPTE `HH:MM:SS:FF` timecode at clip fps; accent color border |
| Waveform layer | FFmpeg raw PCM → 500-sample normalized waveform behind text |
| Onset markers | Snap targets derived from waveform energy peaks |
| Calibration markers | START (−3s white ✕), BIP 1000Hz (−2s blue dashed), PI (0s white) |
| Boucle markers | Yellow dashed vertical lines with `B{n}` cap labels |
| Plan cut marker | Thin vertical line within a réplique at `plan_cut` timecode |

#### Line flags (pro BR)
| Feature | Details |
|---|---|
| Off (hors-champ) | Continuous trait under line; serialised to DetX `off="true"` |
| Dos | Dotted trait; DetX `dos="true"` |
| Ambiance | ▸◂ glyphs + desaturated color; DetX `type="amb"` |
| Plan cut | Timecode of scene change within a line; DetX `plan="TC"` |

#### Phonetic detection layer
| Feature | Details |
|---|---|
| Auto-classify | `classifyChar()` maps letters to sign types (labiale/semi/fricative/arrondie/ouverte) |
| Manual signs | Click letter on canvas → cycle sign (null → labiale → semi → … → null); saved in `words[].signs` |
| Signs stored | Per-character `{i, type, t0, t1}` in `words` JSON — survives word stretch |
| Layer toggle | Show/hide whole detection layer |
| Per-sign toggles | 6 individual sign type toggles + "aide auto" |
| Labiale | 2.4px bar pinned to `[t0,t1]` (frame-anchored, not stretched) |
| Semi | 1.6px dashed bar under letter |
| Fricative | Chevron `^` above letter |
| Arrondie | Circle above letter |
| Ouverte | Open arc above letter |
| All toggles persisted | `localStorage('br-detection')` |

#### Subtitle editing
| Feature | Details |
|---|---|
| Inline text edit | Double-click réplique in canvas |
| Table editor | Right panel — timecode + character + text; click row seeks |
| Add réplique | Drag on canvas to create; or toolbar button |
| Delete with undo | 5s undo toast before commit |
| Character assign | Dropdown picker per line |
| Reaction insert | Toolbar dropdown: rire/souffle/cri/chuchoté/… |
| Breath insert | inspire/expire/soupire/… |
| Context menu | Right-click on canvas — line ops |
| Lock mode | 🔒 prevents accidental edits |
| Auto-save | 1.5s debounce after any subtitle change → `PUT /api/clips/{id}/subtitles` |

#### Boucles
| Feature | Details |
|---|---|
| Add boucle | Toolbar button — creates at current cursor position |
| Remove boucle | Per-boucle delete in Boucles popover |
| Boucle list panel | Popover shows all boucles with start/end |
| Persist | `PUT /api/clips/{id}/boucles` — replaces entire array |

#### AI transcription
| Feature | Details |
|---|---|
| Whisper transcription | Local `openai-whisper` model `base` + `faster-whisper` |
| Language picker | FR / EN / ES / DE / IT / PT / JA / ZH / KO / RU / AR / Auto-detect |
| Job mode | Fire-and-poll with progress bar + cancel |
| Word timestamps | Per-word `{w, start, end}` stored in `words` column |
| Audio extraction | Segment extracted to WAV before Whisper (avoids AAC preamble offset) |

#### Recording studio
| Feature | Details |
|---|---|
| Microphone capture | Browser MediaRecorder API |
| Take queue | Each recording saved as a take with label |
| A/B compare | Play two takes side-by-side to compare |
| Take delete | Remove takes from queue |
| Takes stored | SQLite `takes` table; `GET/POST/DELETE /api/takes` |

### Export

| Format | Details |
|---|---|
| SRT | Standard subtitle; character prepended to text |
| ASS | Per-character styles with track colors |
| ASS Karaoke | Word-level `\k` tags using Whisper word timestamps |
| DetX pro | XML; `<videoframerate>`, `<lipsync>` sign pairs, off/dos/ambiance/plan attrs |
| Croisillé | HTML auto-portant; character × boucle overlap grid with ● markers |
| MP4 + BR | Video + BR band vstack; 1920×1080, 60fps, WYSIWYG with editor style |
| GIF | Two-pass palette ffmpeg; configurable in/out points |
| MP3 | AAC→MP3 transcode via ffmpeg |
| WAV | PCM WAV extract |

#### MP4 export options
| Feature | Details |
|---|---|
| Quality presets | Draft (crf 23, fast, ss2) / Standard (crf 21, medium, ss3) / YouTube (crf 19, slow, ss4) |
| Temporal supersampling | 2–4 sub-frames averaged → motion blur on scrolling text |
| 60 fps output | Smooth scroll on 60Hz displays |
| br_offset | Applied at render time |
| Font WYSIWYG | Same font as editor canvas |
| Style WYSIWYG | classique / neon / minimal |
| Detection burn | Flag wired (no-op pending `_draw_signs()` impl in br_renderer) |
| In/out points | GIF only currently; MP4 uses full clip |

#### Export history
| Feature | Details |
|---|---|
| Re-download | Past exports listed per clip; download any time without re-render |
| Auto-download toggle | Decouple generate from download |
| Delete export | Remove from DB + disk |

#### Job system
| Feature | Details |
|---|---|
| Fire-and-poll | All heavy jobs return `job_id`; client polls `GET /api/jobs/{id}` |
| Progress + ETA | pct + stage label + ETA |
| Cancel | `POST /api/jobs/{id}/cancel` — kills ffmpeg subprocess |
| WebSocket | `WS /api/jobs/{id}/ws` — push updates |
| Retry | Client-side retry on transient failure |
| Job list | `GET /api/jobs/` — diagnostic list of all jobs |

### Meme generator

| Feature | Details |
|---|---|
| Image meme | Upload image (PNG/JPG/WEBP/GIF); add up to 3 text overlays |
| Video GIF meme | Trim clip segment → GIF with text overlaid |
| Text positioning | X/Y% sliders per text block |
| Font picker | Impact / Arial Black / Mono |
| Font size | Per-text slider |
| Color + stroke | Hex color picker + stroke width per text |
| Align | Left / center / right |
| GIF frame iteration | Text applied frame-by-frame preserving animation |
| Job mode | GIF generation via progress job |

### Settings (Preferences)

| Feature | Details |
|---|---|
| Accent color | CSS variable `--accent`; persisted |
| BR style | classique / neon / minimal; synced to export |
| Density | Compact / Normal / Comfortable |
| SettingsContext | React context; all components read via `useSettings()` |

### Infrastructure

| Feature | Details |
|---|---|
| Stack | FastAPI + uvicorn (port 8000) + React/Vite (port 5173) |
| DB | SQLite via SQLAlchemy; idempotent `ALTER TABLE` guards in `init_db()` |
| Static mounts | `segments/`, `thumbnails/`, `exports/`, `memes/` served by FastAPI |
| Vite proxy | `/api` → `http://127.0.0.1:8000` |
| Waveform API | `GET /api/clips/{id}/waveform?samples=N` — FFmpeg PCM → normalized array + onsets |
| Whisper singleton | Model loaded once at startup; thread-safe |

---

## Competitive context

Bulles Studio (arnaudvitale.com/logiciel/bulles-studio) is a commercial BR tool covering most of our feature surface. Key differentiators on their side: stretch markers, timeline nav bar, multi-format import, undo/redo stack, video proxy, GPU export, AI vocal separation, auto-translation, dubbing lexicon, project folders.

**Our unique advantages:** meme generator, Plex integration, recording studio (take queue + A/B compare), DetX pro with phonetic sign mapping, Croisillé export, GIF export, self-hosted/open.

---

## Recently shipped (last session)

| Feature | Files |
|---|---|
| Export history + re-download | `models.py` Export, `services/export_service.py`, `routes/export.py` |
| Quality presets (draft/standard/youtube) | `routes/export.py` QUALITY_PRESETS, `ExportPanel.jsx` |
| Job-mode clip cutting (progress + cancel) | `routes/clips.py` batch-local-job |
| MemeGenerator GIF → job mode | `MemeGenerator.jsx` |
| Auto-download toggle | `ExportPanel.jsx` |
| `JobStartResponse`/`JobStatus` typed models | `services/jobs.py` |

**Known smell:** `clips.py:129` uses `asyncio.get_event_loop().run_in_executor()` — use `asyncio.get_running_loop()` instead (Python 3.12 deprecation).

---

## Per-word BR rendering — keep default ON

`validWords()` / `_valid_words()` gate word-by-word rendering: active when Whisper timestamps exist and match current text, automatic fallback to even-stretch after edits. This is correct standard behavior ("rendu lettre par lettre" in Bulles Studio parlance). It is NOT a pro-gated feature.

**Action:** add `wordByWord` toggle in BR settings panel (default `true`). When false, always render whole line as single block. Persisted in `localStorage('br-word-by-word')`.

---

## P0 — BR workflow parity (next session)

### 1. Stretch markers on canvas
**What:** small visual tick/arrow below each word block showing compression ratio. `scaleX < 0.8` → red tick, `scaleX > 1.1` → blue tick, else nothing. Drawn after glyphs in the word loop.  
**Where:** `DubbingWorkspace.jsx` draw loop ~line 710, after `ctx.restore()` per word.  
**Effort:** 1–2h  
**Why:** adapters need to see at a glance which lines are too dense or too sparse.

### 2. SRT / ASS / VTT import
**What:** `POST /api/clips/{id}/import-subtitles` — parse file, populate `subtitles` table. Words = null (no timestamps). Character = extracted from ASS style name if present.  
**Backend:** `pysrt` (already in deps for export), `ass` lib for ASS, built-in for VTT.  
**Frontend:** file picker button in SubtitleEditor toolbar.  
**Effort:** 3–4h  
**Why:** can't start from existing sub files today — major workflow blocker.

### 3. Frame-by-frame navigation (Shift+←/→)
**What:** step `1/clip.fps` seconds per keypress.  
**Where:** `DubbingWorkspace.jsx` keyboard handler — intercept `ArrowLeft`/`ArrowRight` + shiftKey, call `seekTo(currentTime ± (1/clipFps))`.  
**Effort:** 30min  
**Why:** required for precise lip-sync check.

### 4. BR Timeline nav bar (BRTimeline component)
**What:** full-width bar below the BR canvas showing the whole clip. Contains:
- Waveform (reuse `waveformRef` data already fetched)
- Playhead line (click-to-seek)
- Boucles as colored bands
- Scene cut marks (when implemented)
- View-window indicator — blue bracket showing the visible BR window

**New component:** `BRTimeline.jsx` — canvas-based, props: `duration`, `currentTime`, `boucles`, `waveform`, `viewStart`, `viewEnd`, `onSeek`.  
**Where:** inserted between BR canvas and subtitle editor in `DubbingWorkspace.jsx`.  
**Effort:** 4–5h  
**Why:** biggest UX gap vs Bulles Studio. Without it, navigating long clips is blind.

---

## P1 — Quality of life

### 5. Undo/redo stack
**What:** subtitle array snapshot stack in `DubbingWorkspace`. Ctrl+Z / Ctrl+Y. Max 50 snapshots. Snapshot on every `setSubtitles` call that comes from user action (not from auto-save poll).  
**Effort:** 3h  
**Note:** replaces the current delete-undo toast hack.

### 6. Auto scene change detection
**What:** on clip import, run `ffmpeg -i input -vf "select='gt(scene,0.4)',showinfo" -f null -` and parse `pts_time` from stderr. Store as `scene_cuts: JSON` on `Clip`. Render as thin vertical lines on BR canvas + BRTimeline.  
**Effort:** 2–3h  
**Why:** free via ffmpeg, useful for plan_cut placement.

### 7. Notes per réplique
**What:** add `note TEXT` column to `subtitles`. Inline edit in `SubtitleEditor` (collapsed by default, expand on click). Show yellow dot on BR canvas when non-empty.  
**Effort:** 2h

### 8. GPU export acceleration
**What:** in `export.py`, before building ffmpeg cmd, run `ffmpeg -encoders` and check for `h264_nvenc` / `h264_qsv` / `h264_amf`. If found, replace `-c:v libx264` + presets. Add checkbox in ExportPanel "GPU (NVENC/QSV)".  
**Effort:** 2h

### 9. wordByWord toggle
**What:** settings toggle in BR preferences sidebar. `localStorage('br-word-by-word')`. Passed as prop to draw loop; when false, skip `validWords()` and use whole-line block.  
**Effort:** 1h

---

## P2 — Platform

### 10. VTT import (alongside SRT/ASS in #2)
Minor addition to the import route — same session as #2.

### 11. Video proxy
**What:** on clip import, generate `segments/{clip_id}_proxy.mp4` at 720p via ffmpeg (`-vf scale=1280:-2 -crf 28 -preset ultrafast`). Player toggle button (VO quality / Proxy). Useful for large 4K sources.  
**Effort:** 3h

### 12. Custom time range export
**What:** `in_point` / `out_point` fields already exist on `ExportRequest` for GIF — extend to all formats. Add start/end handles on BRTimeline for visual selection.  
**Effort:** 2h

### 13. Export queue (multi-clip batch)
**What:** global job list panel — queue multiple export jobs, see all progress at once. Jobs already tracked in `JOBS` dict; need a UI panel listing them.  
**Effort:** 4h

---

## P3 — Long term — ALL DONE ✅

| Feature | Status |
|---|---|
| Auto-translation | ✅ `translate_service` (DeepL / LibreTranslate via env) + `🌐 Traduire` (gated, undoable) |
| Dubbing lexicon | ✅ `LexiconEntry` + `/api/lexicon` CRUD + "Lexique" tab (project-scoped + globals) |
| Project folder organization | ✅ `Clip.project` + `/project` endpoint + ClipsLibrary project chips + ClipCard assign |
| Custom font upload | ✅ `/api/fonts` upload + @font-face inject + picker, export-WYSIWYG |
| AI vocal separation | ✅ `vocal_service` (Demucs two-stems) + `/separate-vocals` job + `🎚 Séparer voix` (gated) |
| .detx import | ✅ `parse_detx` round-trips `export_detx` (character/timing/flags/signs) |

Translation + vocal separation degrade gracefully (clear 503) when the optional
provider/dep isn't configured — `DEEPL_API_KEY`/`LIBRETRANSLATE_URL` env, or
`pip install demucs`.

---

## What we keep that Bulles Studio lacks

- Meme generator
- Recording studio (take queue, A/B compare)
- Plex library integration
- DetX pro export (signs mapping: labiale/semi/fricative/arrondie + fps + flags)
- Croisillé export (character × boucle overlap grid)
- GIF export
- Self-hosted, no license fee, no cloud dependency

---

## Priority order for next session

1. Frame-by-frame nav (30min — trivial, high payoff)
2. Stretch markers (2h — visual feedback, core BR UX)
3. wordByWord toggle (1h — unblocks user preference)
4. BRTimeline nav bar (4–5h — biggest UX gap)
5. SRT/ASS import (3–4h — workflow blocker for existing projects)
