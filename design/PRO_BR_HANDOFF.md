# Handoff — Professional Bande Rythmo layer

> **Companion doc:** `DOUBLAGE_IA_REVIEW.md` is the *refinement* spec (toolbar reorg, default display, filtering, z-index fix). Build **this** feature spec first, then that follow-up pass.

**For:** Claude Code, working in `bande-rythmo-app/`
**Goal:** Bring the BR up to professional French détection-doublage practice **without rebuilding what already works.** Your codebase is already advanced (per-word elastic timing, DetX/ASS/MP4 export, supersampled burn). This spec adds the missing *professional* layer on top and routes it through structures you already have.

> Design reference for every visual described here lives in the linked design project (`index.html` → section **"Bande rythmo professionnelle"**: artboards *BR pro*, *Avant/Après*, *Référence signes*, *Croisillé*). Open it side-by-side. Where this spec and the mockup disagree on behavior, **this spec wins**; the mockup is visual intent.

---

## 0. What you already have (do NOT rebuild)

Confirmed present and correct — leave the mechanics alone, only extend:

| Capability | Where | Status |
|---|---|---|
| Per-word elastic text (timing = horizontal scale, cap 1.2) | `DubbingWorkspace.jsx` `validWords` + word loop; `br_renderer.py` `_valid_words`/`_draw_word` | ✅ keep |
| `words` JSON column `[{w,start,end}]` | `models.py` `Subtitle.words` | ✅ extend (§2) |
| DetX export with `<lipsync>` in/out | `subtitle_service.py` `export_detx` | ✅ extend (§5) |
| ASS / ASS-karaoke / SRT / MP4 burn | `subtitle_service.py`, `br_renderer.py` | ✅ keep |
| Takes / RecorderPanel | `models.py` `Take`, `RecorderPanel.jsx` | ✅ keep |
| Caveat cursive font already bundled | `br_renderer.py` `_BR_FONT_FILES["cursive"]`, `BR_FONTS` in `DubbingWorkspace.jsx` | ✅ promote (§1) |

The original "text sticks to canvas left edge" bug (`Math.max(0,leftX)+PADDING`) is **already fixed** — the word loop translates to `wLeft`. No action.

---

## 1. Font — make manuscript a first-class default (small)

Rythmo is hand-lettered by tradition; in digital tools the manuscript look is deliberately preserved (cf. Cappella's Swenson font). You already bundle **Caveat** as `cursive`. Two changes:

1. **Add a legible-handwriting option** so users can resolve the "script vs readability" tension. Bundle **Shantell Sans** (`ShantellSans.ttf`) into `backend/fonts/` and register it:
   - `br_renderer.py` `_BR_FONT_FILES["lisible"] = os.path.join(_FONTS_DIR, "ShantellSans.ttf")`
   - `DubbingWorkspace.jsx` `BR_FONTS`: add `{ id:'lisible', label:'Manuscrite lisible', stack:"'Shantell Sans', sans-serif" }`. Load the webfont in `index.css`/`index.html`.
2. **Keep `atkinson` as the default** (max legibility), but surface the font picker prominently in the BR toolbar with a one-line helper: *"Manuscrite (authentique) ou lisible"*. Order the options: Atkinson · Manuscrite lisible · Caveat · JetBrains Mono.

No data-model change. Font id already persists to `localStorage('br-font')`.

---

## 2. Data model — détection, line flags, boucles (`backend/models.py`)

Three additions. All nullable / defaulted so existing clips and the auto-save round-trip keep working.

### 2a. Per-character détection signs (extends `words`, no new column)

The `words` JSON already stores `[{w,start,end}]`. Extend each word object with an **optional** `signs` array of per-character phonetic markers:

```jsonc
{ "w": "Bombe", "start": 3.10, "end": 3.55,
  "signs": [
    { "i": 0, "type": "labiale",  "t0": 3.10, "t1": 3.18 },  // B — closure bar, frame-anchored
    { "i": 4, "type": "ouverte",  "t0": 3.40, "t1": 3.55 }   // e
  ] }
```

- `i` = char index within the word (so it survives stretch).
- `type` ∈ `labiale | semi | fricative | arrondie | ouverte`.
- `t0/t1` = the sign's own time span. For **labiale** this is the lip-closure interval (start = first frame of full closure, end = first frame of opening) — it is *independent* of the letter's stretch and must be drawn at its own x-position.
- Absent `signs` ⇒ renderer auto-classifies from letters (see §3 `classifyChar`) as a live aid, but only **persisted** signs export.

### 2b. Line-level flags on `Subtitle`

```python
# Subtitle
off       = Column(Boolean, default=False)   # personnage hors-champ → continuous trait under text
dos       = Column(Boolean, default=False)   # de dos / bouche non vue → dotted trait
ambiance  = Column(Boolean, default=False)   # ambiance ON/OFF (not dialogue) → distinct colour, arrows
plan_cut  = Column(Float,  nullable=True)    # a change-of-plan timecode falling inside this line (or null)
```

### 2c. Clip-level frame rate + boucles

```python
# Clip
fps = Column(Float, nullable=False, default=25.0)   # detected from source via ffprobe at import

# new table
class Boucle(Base):
    __tablename__ = "boucles"
    id        = Column(Integer, primary_key=True, autoincrement=True)
    clip_id   = Column(String, ForeignKey("clips.clip_id", ondelete="CASCADE"), nullable=False)
    number    = Column(Integer, nullable=False)   # 1-based, contiguous
    start     = Column(Float, nullable=False)
    end       = Column(Float, nullable=False)
    clip = relationship("Clip", back_populates="boucles")
# Clip.boucles = relationship("Boucle", back_populates="clip", cascade="all, delete-orphan", order_by="Boucle.number")
```

**Migration:** SQLite + SQLAlchemy — add columns with defaults (no Alembic in repo; do an idempotent `ALTER TABLE ... ADD COLUMN` guard in `database.py` init, matching how the schema is currently bootstrapped). `fps` backfills to 25.0; detect real fps on next import.

**Save path:** `routes/clips.py` `PUT /api/clips/{id}/subtitles` already round-trips `subtitles`; widen its Pydantic model to accept `off/dos/ambiance/plan_cut` and the extended `words[].signs`. Add `PUT /api/clips/{id}/boucles` (replace-all array) and include `boucles` + `fps` in the clip GET payload.

---

## 3. Détection rendering — on-screen (`DubbingWorkspace.jsx`)

This is the core visible change. The reference draw code is in the design project at `components/br-pro.jsx` (`BRPro`) — port its sign-drawing into your existing word loop. **Do not** fork a second canvas; add to the single pass you already have.

### 3a. Shared classifier (new file `frontend/src/detection.js` + mirror in `backend/services/detection.py`)

```js
// letter → phonetic sign class (live aid before manual detection)
export function classifyChar(ch) {
  const c = ch.toLowerCase();
  if ('bpm'.includes(c)) return 'labiale';
  if ('w'.includes(c))   return 'semi';
  if ('fv'.includes(c))  return 'fricative';
  if ('ouœ'.includes(c)) return 'arrondie';
  if ('aàâeéèêiîy'.includes(c)) return 'ouverte';
  return null;
}
```

### 3b. Draw signs in graphite, pinned to letter x-positions

Inside the per-word draw, after the glyph is painted, iterate `wd.signs` (or auto-classify when absent and the "aide auto" toggle is on). For each sign compute the **char x** by measuring the substring up to `i` *in the same stretched space* (you already `ctx.scale(scaleX,1)` — measure inside that transform, or compute `charX = wLeft + measure(text.slice(0,i))*scaleX`). Graphite colour `#c7ccd4`. Geometry (from `BRPro`):

- **labiale** → 2.4px bar **under** the letter, spanning `[t0,t1]` mapped to x (frame-anchored, *not* the letter's stretched width).
- **semi** → 1.6px **dashed** bar under.
- **fricative** → small caret **above** the letter.
- **arrondie** (cul-de-poule) → 3.4px circle **above**.
- **ouverte** → open arc above. **Off by default** (it's the rest state — too noisy on).

### 3c. Calque toggle + sign palette

Add to the BR toolbar (reference: `br-pro-panel.jsx` `BRProPanel`):
- A single **"Détection"** toggle (whole layer on/off).
- Six per-sign toggles: Labiale · Semi · Fricative · Arrondie · Ouverte · Début/Fin.
- Persist these to `localStorage('br-detection')` like `br-font`.

### 3d. Line flags + plan + début/fin
- **début/fin de phrase**: small filled wedges in the track colour at the line's left/right x (only when on-screen).
- **off** → continuous 1.4px trait under the whole line in track colour; **dos** → dotted. Drive from `sub.off/sub.dos`.
- **plan_cut** → dashed vertical blue (`--info`) full-height at that x + `PLAN` tag.
- **ambiance** → render the line in a desaturated/italic treatment with a start-arrow ▸ and end-arrow ◂ (modern charte: detect ambiances ON/OFF, don't use English VO tags).

---

## 4. Head-of-band sequence, SMPTE, boucles (`DubbingWorkspace.jsx`)

### 4a. SMPTE everywhere — replace decimal `fmt`
The pro convention is `HH:MM:SS:FF` at the clip fps. Add alongside `fmt`:

```js
const fmtTC = (sec, fps) => { /* see design project components/shared.jsx fmtTC */ };
```

Use `fmtTC(t, clip.fps)` for: the live readout riding the cursor, the grid major-tick labels, the clip header duration, and the réplique list timecodes. Keep decimal `fmt` only for the casual transport line if you like, but the band itself reads frames. Show a live TC chip at the cursor foot (boxed, accent border) — see `BRPro`.

### 4b. START → BIP 1000 Hz → PI
Draw three calibration marks anchored to clip time 0 = **PI (première image)**:
- **START** at −3.0s: vertical bar crossed with an ✕, label `START` + `fmtTC(0)`.
- **BIP 1000 Hz** at −2.0s: dashed blue vertical + `BIP 1000 Hz` tag (this is also the audio sync tone; if you generate a reference tone on export, place it here and the end beep at +2s).
- **PI** at 0: white vertical + `PI` tag.

These live at negative time, so the band must be scrollable to before 0 (it already is — `t` can go negative in preview).

### 4c. Boucles
Render `clip.boucles` as dashed verticals with a `B{n}` cap. Toolbar: a **"Boucle"** button that splits/creates a boucle at the cursor; auto-number contiguously. Optional helper: auto-segment ~1 min on first detection. Persist via the new `PUT …/boucles`.

---

## 5. Export — route détection through DetX (you're 80% there)

`export_detx` already emits `<role>` + `<line>` + `<lipsync type="in_open"/"out_open">`. Extend it to carry real détection so the project opens correctly in **Cappella / Phonations / Joker**:

- Map each persisted sign `type` to DetX `<lipsync>` types per char position (DetX supports the labial/open/closed family — emit `in_*`/`out_*` pairs at the sign's `t0/t1` using your existing `_to_detx_time(…, clip.fps)`).
- Emit `off`/`dos`/`ambiance` as the corresponding DetX line attributes (`type="reac"` is already done for `(…)`; add the off/ambiance flags).
- Write `videofile` + the **fps** into the header (you hardcode 25.0 — use `clip.fps`).

**MP4 burn (`br_renderer.py`):** add an optional `detection: bool` and draw the same graphite signs in `_render_frame` (a `_draw_signs` mirroring §3b using `detection.py classify` + persisted signs). Gate behind an export-panel checkbox **"Incruster la détection"** (default off — most studios want the band clean and take DetX for the authoring data). This is **Phase 2** — ship §1–4 + DetX first.

### 5b. Croisillé (new export)
Add `export_croisille(clip, subtitles, boucles, path)` → a one-page PDF/HTML grid: rows = characters (+ ambiance rows), columns = boucles, cell filled when that character has ≥1 réplique overlapping the boucle; per-boucle voice counts in a footer. This is the studio planning doc (who's needed in which loop). Reference layout: `components/br-pro-panel.jsx` `Croisille`. Wire a button in `ExportPanel.jsx` → `POST /api/export {format:'croisille'}`.

---

## 6. Suggested order of work

1. **§2 model migration** (+ fps detection at import via ffprobe) — everything else depends on it.
2. **§1 font** (tiny, independent, immediate authenticity win).
3. **§4a SMPTE** swap (mechanical, high value, low risk).
4. **§3 détection on-screen** (the headline feature) — classifier → draw → toggles → manual edit (click a letter to set/cycle its sign).
5. **§4b/c START·BIP·PI + boucles**.
6. **§5 DetX detail + croisillé**; **§5 MP4 burn last** (Phase 2).

## 7. Acceptance checks
- Old clips (no `signs`, no `boucles`, `fps` backfilled) load and auto-save unchanged.
- Fast réplique: letters cram, font height constant, never auto-shrinks to illegible (already true — confirm under détection layer).
- Détection toggle fully hides/shows the graphite layer; per-sign toggles independent; choices persist.
- Cursor TC reads `HH:MM:SS:FF` at clip fps; START/BIP/PI sit at −3/−2/0s.
- DetX re-opens in a DetX viewer with roles, lipsync, and fps intact.
- Croisillé lists every speaking character × boucle correctly.

---

### Files you'll touch
```
backend/models.py                    §2  Subtitle flags, Clip.fps, Boucle table
backend/database.py                  §2  idempotent ADD COLUMN guards
backend/routes/clips.py              §2  widen subtitles schema; boucles GET/PUT; fps in payload
backend/routes/video.py (import)     §4a ffprobe fps on segment create
backend/services/detection.py  NEW   §3  classify() mirror
backend/services/subtitle_service.py §5  DetX lipsync detail + export_croisille
backend/services/br_renderer.py      §5  optional detection burn (Phase 2)
backend/routes/export.py             §5  format:'croisille' (+ detection flag)
frontend/src/detection.js      NEW   §3  classifyChar()
frontend/src/components/DubbingWorkspace.jsx  §1,§3,§4  font, signs, SMPTE, START/PI, boucles
frontend/src/components/ExportPanel.jsx       §5  croisillé button, burn checkbox
backend/fonts/ShantellSans.ttf NEW   §1
```
