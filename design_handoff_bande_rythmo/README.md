# Handoff — Bande Rythmo (post-production dubbing app)

A local-first React + FastAPI app for clipping video, transcribing with Whisper, dubbing with a multi-track scrolling bande rythmo, and exporting (MP4 with burn-in, GIF, MP3/WAV, SRT, ASS). This document maps the HTML design references to your real codebase at `bande-rythmo-app/`.

## About the design files

`design_reference/app.html` is a single-file React prototype loaded via Babel-in-browser. **Design reference only** — use it for layout, spacing, color, copy, and interaction patterns. Mock data only; no real video, no Whisper, no file I/O. Recreate the visuals in your real React + Vite frontend; do not ship the HTML.

## Fidelity

**High-fidelity** for visuals (colors, type, spacing, copy) and **mid-fidelity** for the bande rythmo canvas + drag-to-create timeline (the prototype captures the intent and key math; your real components are more advanced and should remain the source of truth for behavior).

---

## Mapping prototype → your codebase

| Prototype section | Your file | Notes |
|---|---|---|
| `Sidebar` | `frontend/src/components/Sidebar.jsx` | Same nav model (`import` / `clips` / `dub`, + your `memes`). Keep orange-on-`#0e0e0e` chrome and `BANDE RYTHMO` mono logo. |
| `ImportSection` + `ClipTimeline` (drag-to-create) | `frontend/src/components/ImportSection.jsx` + `VideoEditor.jsx` + `TimelineBar.jsx` | The prototype's new drag-to-create timeline (80px, ruler + 5s ticks, draft selection, draggable pending blocks with edge handles) replaces the older mark-IN / mark-OUT pattern. Adopt this UI and keep your existing batch-commit logic. **Ctrl+S** commits the batch. |
| `ClipsLibrary` + `ClipCard` | `frontend/src/components/ClipsLibrary.jsx` + `ClipCard.jsx` | Add the **MP3** action button between Play and GIF. Tooltip: "Exporter MP3 — audio uniquement". Wire to `GET /api/export/...?format=mp3`. |
| `DubbingWorkspace` + `BandeRythmoCanvas` | `frontend/src/components/DubbingWorkspace.jsx` + `RythmoPreview.jsx` (legacy) | Your current `DubbingWorkspace` is already the unified BR page (header / subtitle list left / video right / full-width BR canvas bottom / optional export). **Retire `RythmoPreview.jsx`** — `DubbingWorkspace` supersedes it. |

---

## Tech stack (your actual setup, confirmed)

- Frontend: **React + Vite** (port 5173). Plain JS, no TypeScript.
- Backend: **FastAPI + uvicorn** on `127.0.0.1:8000` (NOT `localhost` — Windows IPv6 issue per `CLAUDE.md`).
- Transcription: **openai-whisper**, model `base`, local/offline. (Consider faster-whisper for ~4× speedup.)
- Video: **ffmpeg-python** wrapped in `services/ffmpeg_service.py`.
- Subtitles: **pysrt** + custom SRT/ASS export in `services/subtitle_service.py`.
- Storage: JSON store `clips.json` (mirrored via `services/clip_service.py`). UUID-per-asset (clip_id, video_id).

## API surface (actual routes, mounted at `/api/...`)

| Route | Method | Path | What it does |
|---|---|---|---|
| `video.py` | `POST` | `/api/video/upload` | Upload source video → returns `video_id` |
| `video.py` | `POST` | `/api/video/segment` | Cut a segment from a source (used by Import) |
| `clips.py` | `POST` | `/api/clips/create` | Create clip from `{video_id, name, start, end}` |
| `clips.py` | `GET`  | `/api/clips/` | List clips |
| `clips.py` | `GET`  | `/api/clips/{clip_id}` | One clip |
| `clips.py` | `PUT`  | `/api/clips/{clip_id}/subtitles` | Save subtitles array (DubbingWorkspace auto-save) |
| `clips.py` | `PUT`  | `/api/clips/{clip_id}/name` | Rename clip |
| `clips.py` | `DELETE` | `/api/clips/{clip_id}` | Delete clip + assets |
| `clips.py` | `GET`  | `/api/clips/{clip_id}/waveform?samples=500` | Waveform samples + onsets (for BR rendering & snap targets) |
| `transcription.py` | `POST` | `/api/transcription/transcribe` | `{segment_id, language}` → `{subtitles: [...]}`. `language: null` ⇒ auto-detect. |
| `export.py` | `POST` | `/api/export` | Format = `srt` / `ass` / `mp4` (burn-in) / `gif`. **Add `mp3` and `wav`.** |
| `meme.py` | `POST` | `/api/meme/generate` | Meme generator (out of scope for this handoff) |

### Endpoints to add for the new design

- `POST /api/export` — extend `format` enum with `mp3` and `wav`. ffmpeg pattern: `ffmpeg -i clip.mp4 -vn -c:a libmp3lame -b:a 192k out.mp3`.
- `GET /api/clips/{clip_id}/audio.mp3` — optional direct download URL for the MP3 button on ClipCard.

## Data model (already in `clips.json` — keep it)

```python
class Subtitle(BaseModel):
    start: float          # seconds, relative to clip start
    end: float
    character: str        # "" = default track
    text: str

class Clip(BaseModel):
    clip_id: str          # UUID
    name: str
    video_id: str         # UUID of source upload
    start: float
    end: float
    segment_path: str     # "segments/{clip_id}.mp4"
    thumbnail_path: str   # "thumbnails/{clip_id}.jpg"
    subtitles: list[Subtitle]
    created_at: str       # ISO
```

Pending clips on Import are frontend-only (`{_id, name, start, end}`) until the batch commit fires `POST /api/clips/create` for each.

---

## Design tokens (literal values — already in `frontend/src/index.css`, verify)

```css
:root {
  --bg: #0c0c0c;
  --surface: #111111;
  --surface2: #161616;
  --surface3: #1e1e1e;
  --border: #242424;
  --border2: #2e2e2e;
  --text: #e0e0e0;
  --text2: #808080;
  --text3: #484848;
  --accent: #ff9900;             /* the orange — used for selection, active nav, play button */
  --accent-dim: rgba(255,153,0,0.12);
  --danger: #e54545;
  --success: #44bb55;
  --radius: 4px;
  --font-ui: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'Courier New', Courier, monospace;
}
```

Character track colors (cycle by character index, source order):

```js
const TRACK_COLORS = [
  { bg: 'rgba(255,153,0,0.10)',  text: '#f90', label: '#f90' },
  { bg: 'rgba(80,180,255,0.10)', text: '#5bf', label: '#5bf' },
  { bg: 'rgba(255,100,160,0.10)',text: '#f6a', label: '#f6a' },
  { bg: 'rgba(100,230,160,0.10)',text: '#6eb', label: '#6eb' },
];
```

Bande rythmo render constants (already in your `DubbingWorkspace`):

```js
const CURSOR_X_RATIO = 0.30;    // playhead fixed at 30% from left
const H_TRACK = 64;
const BR_CONTROLS_H = 32;
const FONT_BR = 'bold 28px "Courier New", monospace';
const FONT_LABEL = 'bold 9px sans-serif';
```

---

## Roadmap items — design guidance

### 1. Import — multi-clips before save (drag-to-create timeline)

**Replace** the mark-IN / mark-OUT button pattern in `VideoEditor.jsx` + `TimelineBar.jsx` with the drag-to-create model shown in `app.html` (component `ClipTimeline`):

- Timeline height **80px**, padding 8px horizontal, ruler (16px) with 5s ticks across the top, vertical-pinstripe track background.
- **Click + drag empty area** → orange dashed draft selection showing live duration label.
- **Mouseup ≥ 0.2s** → commit to a pending block (orange fill, orange border). **< 0.2s** → seek instead.
- Pending blocks are **draggable** (body = shift, 8px edge handles = resize). Min width 0.2s.
- Saved blocks are green, read-only.
- A "Nom du prochain clip" input above the timeline applies its value to the next created block.
- Bottom commit button: "Créer N clips" (orange), POSTs each via `/api/clips/create`. **Ctrl+S** triggers the same action.
- Toast on success; redirect to `Mes Clips` (your `handleClipsCreated` already does this).
- `Suppr` removes the focused pending block.

Full implementation reference in the prototype's `ClipTimeline` component. Re-use your existing `<video>` element above the timeline.

### 2. ClipCard — MP3 export button

Action row order, left to right:
1. **Doubler** (orange, fontWeight 600, `flex: 1`) — opens DubbingWorkspace
2. **▶** play preview inline
3. **MP3** — `<ActionBtn title="Exporter MP3 — audio uniquement">MP3</ActionBtn>` → POSTs `/api/export` with `format: 'mp3'`, triggers download
4. **GIF** — already wired
5. **✕** delete (danger color on hover)

Each is a flush row segment (no rounded corners, 1px right border `--border`), padding `8px 10px`, fontSize 11px. Hover: `rgba(229,69,69,.15)` (danger) / `rgba(255,153,0,.12)` (accent) / `--surface3` (default).

### 3. Custom video player

Replace the native `<video controls>` everywhere with a custom transport bar styled to match the rest of the app. Your `DubbingWorkspace` already does most of this — promote it to a reusable `<VideoPlayer>` component used on both Import and Dub pages.

Transport bar contents (left to right): play/pause button (orange ▶/⏸ on `rgba(255,153,0,0.04)` bg with `#f904` border), current-time `mono 10px` / duration, range scrubber (`accentColor: '#f90'`), speed dropdown (`0.5×–1.5×`), mute toggle.

Add subtitle burn-in overlay on the video element when an `activeSubtitle` is set (already implemented in `DubbingWorkspace` — replicate on Import-page preview if subtitles ever exist there).

### 4. Bande rythmo — fix the ~1s delay bug

Likely culprits, in order of likelihood:
1. **Whisper start timestamps** — `openai-whisper` segment-level `start` is the *beginning of the audio chunk*, not the first word. Tighten by taking the first word's `start` from `word_timestamps=True`, or by trimming silence with VAD before transcription.
2. **Canvas RAF lag** — confirm `video.currentTime` is read inside the RAF callback, not from a stale React state value. Your code does this correctly via `videoRef.current.currentTime`, so this is probably not the bug.
3. **`brOffset` slider** — already in place (`-2s` to `+2s`, 0.05 step). Use it as the user-facing escape hatch; the engineering fix is #1.
4. **ffmpeg segment cut** — `-ss` before `-i` is fast-seek (keyframe-snap), `-ss` after `-i` is sample-accurate (slower). For clip extraction prefer the slower form when sub-second accuracy matters; the keyframe snap can introduce 0–1s drift at the head.

### 5. Whisper — language selector per clip

Already in `DubbingWorkspace` header (`<select>` over the `LANGS` array, includes `auto`). Surface the same selector on `ClipCard` actions if you want per-clip retranscription without entering the dub view. Persist the chosen language on the clip:

```python
class Clip(BaseModel):
    ...
    language: str | None = None    # last used / preferred Whisper language
```

For faster transcription, swap to `faster-whisper`:
```bash
pip install faster-whisper
```
Same model names. Drop-in replacement in `services/whisper_service.py`.

### 6. DubbingWorkspace — interaction polish (already implemented, keep)

These are working in your code today; document them so the design intent is preserved:

- Playhead fixed at `CURSOR_X_RATIO = 0.30` of the canvas. Time flows left-to-right; future is to the right.
- **Shift+click on a subtitle block** → loop that subtitle.
- **Shift+drag on empty area** → custom loop region.
- **Alt+drag a block** → duplicate before shifting.
- **Ctrl+wheel** or **Shift+wheel** → zoom (`pxPerSec` 40–400).
- **Double-click a block** → inline edit input (orange border, mono, positioned over the block).
- **Right-click a block** → context menu: Éditer / Couper ici / Dupliquer / Aller au début / Aller à la fin / Personnage (with track-colored ▪ swatches) / Nouveau personnage / Supprimer.
- Auto-save debounced 1.5s on text edit, 800ms on drag — status pill: `✓ Sauvegardé` (green) / `… Sauvegarde` (text2) / `● Non sauvegardé` (orange) / `✕ Erreur` (red).
- **Onset snapping** — drag near a waveform onset → snap to it (within 0.2s window). Hold **Alt** while dragging to disable snap. Waveform + onsets fetched once from `/api/clips/{id}/waveform?samples=500`.
- **Track legend** in BR controls bar: `▪ <character>` chips colored from `TRACK_COLORS`.
- Decalage slider (-2s to +2s, 0.05 step) for live BR vs audio offset tuning. Reset (✕) when non-zero.
- Subtitle burn-in overlay on the video element (translucent black pill, mono, with character label on top border in the track color).

### 7. Keyboard shortcuts (full list, document on a help overlay)

| Key | Where | Action |
|---|---|---|
| `Espace` / `k` | global | Play/pause |
| `←` / `→` | global | Seek ±5s (Shift = ±0.1s frame nudge in Dub) |
| `,` / `.` | Dub | Frame-step pause |
| `j` / `l` | Dub | Speed 0.5× / 1.5× |
| `m` | global | Mute |
| `i` / `o` | Dub | Set IN / OUT of *active* subtitle to current time |
| `s` | Dub | Split active subtitle at current time |
| `Esc` | Dub | Clear loop region / context menu / inline editor |
| `Ctrl+S` | Import | Commit pending clips batch |
| `Suppr` | Import | Delete focused pending block |

Bind on `window` with `keydown`; **early-return when `e.target.tagName` is `INPUT` or `TEXTAREA`**.

---

## Storage layout (already correct, document it)

```
backend/
  clips.json                          # JSON store, full clip metadata
  uploads/<video_id>.mp4              # source uploads
  segments/<clip_id>.mp4              # cut clips (served via /static/)
  thumbnails/<clip_id>.jpg            # middle-frame thumbs
  exports/<uuid>.{mp3,wav,gif,ass,mp4}  # one-shot export artifacts
  memes/in_<id>.gif, out_<id>.gif     # meme generator scratch
```

FastAPI `StaticFiles` should mount `segments/`, `thumbnails/`, and `exports/` at the project root so the frontend can use the paths stored in `clips.json` directly (`<video src={"/" + clip.segment_path}>`).

---

## State management (already in `App.jsx`, keep it)

- `section: 'import'|'clips'|'dub'|'memes'`
- `clips: Clip[]` — list, hydrated on mount via `GET /api/clips/`
- `activeClip: Clip | null` — currently dubbing
- `video: { id, file, url } | null` — currently-imported source on Import page

No Redux / Zustand needed. If server-state caching becomes painful (rare here), drop in TanStack Query.

---

## Out of scope for v1 (per `CLAUDE.md` roadmap)

- Auth / multi-user (priority medium)
- Plex / Stremio / qBittorrent integrations (priority low)
- Speaker diarization (auto-character assignment) — currently manual via context menu

---

## Files in this handoff

- `README.md` — this document
- `design_reference/app.html` — single-file React prototype (open in a browser). Use it as a visual companion to this README. The two pieces most worth reading line-by-line:
  - `ClipTimeline` (drag-to-create) for Import
  - `BandeRythmoCanvas` for the rythmo render math (you have a more advanced version already in `DubbingWorkspace.jsx`)

For pixel-perfect fidelity, run `app.html` side-by-side with your dev server and diff visually. Where the prototype and your codebase disagree on behavior, **your codebase wins** — the prototype is design intent, the code is the source of truth.
