# Handoff — Async actions page & Export redesign

> **Companion to** `UX_REVIEW.md` (🔴 #1 was "progress + cancel for long ops"). The plumbing for that **already exists** in `frontend/src/ProgressContext.jsx` (WebSocket + polling, retry, cancel, bottom-right toasts) and per-clip export history in `ExportPanel.jsx`. This doc gives those two things a **proper home**. Visual reference on the canvas: section **"Actions asynchrones & export"** (2 artboards).

---

## Part A — global "Activité" page

**Why:** `ProgressContext` already tracks every long job (`transcribe`, `export-mp4`, `export-gif`, `remux`, `batch-cut`) in its `jobs` array, but the only surface is the **auto-dismissing bottom-right toasts**. There's nowhere to see everything at once, review what finished, or retry a failure after the toast is gone. Add one page.

### Where it lives
- It is **not** a primary workflow nav item. Surface it as an **activity indicator in the top bar** (a small icon with a live count / spinner when jobs run) that opens the Activité page. Optionally also reachable from Réglages.
- The bottom-right toasts **stay** — they're the at-a-glance layer. The page is the "see everything / history" layer. Same data source (`useProgress().jobs`), so they never disagree.

### Structure (see artboard "Page Activité")
- **Header:** title + summary chips — `N en cours` (pulsing accent dot), `N échec` (danger), `N terminés · session` (muted). "Tout effacer" clears finished/failed.
- **Filter tabs:** Tout · En cours · Terminé · Échecs (with counts).
- **EN COURS** group — rich rows: type icon, title + clip name, **stage text** (e.g. "Segment 8 / 13", "Incrustation · supersample 4"), determinate **% bar**, ETA, **Annuler**. Drive all of this from the existing job fields (`stage`, `pct`, `eta`, `status`); call the existing cancel endpoint.
- **ÉCHECS** group — danger-tinted rows: error message (mono), timestamp, **Réessayer** (wire to the `retry` already in `ProgressContext`).
- **TERMINÉ** group — green-check rows with a **contextual result action**: Télécharger (exports), Ouvrir le clip (transcription), Voir les clips (batch cut). Pull from job result + export history.

### Data note
Running jobs come from `useProgress().jobs` (live). The **Terminé** list should persist beyond the in-memory job (which dismisses) — back it with the export history (`/api/export/list`) plus a lightweight job-log if you want non-export jobs (transcribe, remux) to survive a reload. Minimum viable: live jobs + export history is already enough to make this page useful.

### Job-type labels & icons (keep consistent)
| kind | label | icon |
|---|---|---|
| `transcribe` | Transcription Whisper | `ICONS.mic` |
| `export-mp4` | Export MP4 + BR | `ICONS.film` |
| `export-gif` | Export GIF | `ICONS.gif` |
| `remux` | Remux piste audio · Plex | `ICONS.download` |
| `batch-cut` | Découpe par lot | `ICONS.scissors` |

---

## Part B — Export, reviewed end to end

The current `ExportPanel.jsx` works but is a **flat 9-card grid** with quality preset, detection-burn, and auto-download toggles stacked beneath, then a history list. It's functional but flat — everything has equal weight and the "make → download" loop is implicit. Restructure into **three columns** (see artboard "Export · refonte complète").

### 1. Format picker — grouped by intent (left column)
Drop the equal-weight 3×3 grid. Group by what the user is trying to do:
- **Vidéo bande rythmo** (à regarder/partager): MP4 + BR, GIF — tag these **RENDU** (they're jobs, not instant).
- **Sous-titres** (montage/compat): SRT, ASS, ASS Karaoké.
- **Documents studio** (plateau): DetX, Croisillé.
- **Audio** (soundboard/montage): MP3, WAV.

Each format is a selectable row (icon chip in the format's color, name, one-line desc). Selecting one **reveals its options** — don't show all options for all formats at once (today MP4 quality + detection-burn are always visible even when exporting an SRT).

### 2. Contextual options (middle column)
Only the selected format's options:
- **MP4:** quality segmented (Draft / Standard / YouTube) with the live ffmpeg-params line; "Incruster la détection" toggle (default **off** — keep your current rationale copy); BR police.
- **GIF:** résolution, fréquence, boucle.
- **DetX / Croisillé:** short explainer + include-détection / include-notes toggles.
- **SRT/ASS:** encodage, include character names, merge-short-lines.
- **MP3/WAV:** bitrate (mp3), channels.

Primary button **"Lancer l'export"** at the bottom. Caption: "L'export apparaît dans la liste → téléchargez quand il est prêt."

### 3. File d'attente & téléchargements (right column — the hero)
This is the part you asked for: **after an export, it lands in a list you download from.** Replace the implicit auto-download with an explicit, satisfying queue:
- One row per export. **Rendering** rows (MP4/GIF jobs) show a mini progress bar + stage + %, with a cancel (×). **Ready** rows show size + time + a prominent **Télécharger** button + delete.
- Header shows "N en cours" and a **"Tout télécharger"** for batching.
- Instant formats (SRT/DetX/MP3…) appear as **Ready** immediately; job formats (MP4/GIF) start as **Rendering** and flip to Ready on completion (drive from `ProgressContext`).
- Back it with the existing `/api/export/list` + `/api/export/download/{id}` + `DELETE /api/export/{id}` — they already exist. The **"Télécharger automatiquement" toggle becomes unnecessary** for the default flow (the list *is* the download surface); keep it only as an opt-in "auto-grab when ready".

### Migration notes
- The 9 formats, the job-mode for MP4/GIF, quality presets, detection-burn default, and the history endpoints are **already implemented** — this is a **reorganization of the same capabilities**, not new backend work.
- Keep the export panel where it is (slides up on the BR page). It just gets the 3-column internal layout.
- Consume the design-system tokens from `DESIGN_SYSTEM_REFRESH.md` (control heights, type scale, 32px tap targets) while you're in here.

Reference artboards: *Page Activité · toutes les tâches asynchrones*, *Export · refonte complète + liste de téléchargements*.
