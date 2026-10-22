# PROJECTS PLAN — from volatile screens to projects

> Written 2026-10-23. Status: **plan only, nothing built.**
> Goal: the app works the way professional dubbing/editing tools do. You create a **project**,
> import one or more videos into it, then go through cutting clips → bande rythmo → dubbing →
> export. Everything is saved: leave, reload or restart and you land where you left off.

---

## 1 · Why

Today's screens restore **half** their state, which is the worst case: the screen looks
resumable but isn't.

| Screen | Survives section change | Survives reload / restart |
|---|---|---|
| Import: chosen video | ✅ (`video` in App state) | ❌ |
| Import: audio/video stream choice, remux | ❌ (ImportSection local state) | ❌ |
| Import: pending clip ranges, IN mark, names | ❌ (VideoEditor local state, reset on `video.url` change) | ❌ |
| Import: source registry (`_sources` in `routes/files.py`) | ✅ | ❌ (in-memory dict, lost on backend restart) |
| Editor: répliques, boucles | ✅ autosaved (`PUT /subtitles`, `PUT /boucles`) | ✅ |
| Editor: playhead, zoom, brOffset, tab, selection | ❌ | ❌ |
| Studio: role, mode, comédiens | ✅ localStorage per clip | ✅ (this browser only) |
| Open screen + clip | ✅ `sessionStorage['br-nav']` | ✅ tab only |

"Project" today is only a free-text tag on `Clip.project` (ClipsLibrary chips) and
`LexiconEntry.project`. They're matched by name, with no entity behind them.

**What pro tools do.** Premiere/Resolve/Pro Tools, VoiceQ, Mosaic/Synchronos and Descript all
work on projects that save themselves. Imported media sits in a **bin**, edits are saved, and
reopening restores the session. Missing media shows as **offline** with a **Relink** button.
None of them treat leaving a screen as the end of your work. This plan adopts that model.

---

## 2 · Data model

```
Project 1─n Source 1─n Clip 1─n Subtitle / Boucle / Take / Export
Project 1─n ProjectRole            (cast: role → comédien)
Project 1─n LexiconEntry           (project_id NULL = global)
```

### `projects` (new)
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | uuid4 hex |
| `name` | TEXT NOT NULL | |
| `color` | TEXT | track palette hex (`config/tracks.js`) |
| `language` | TEXT | Whisper default for the project's clips (today `settings.whisperLang`) |
| `status` | TEXT | `active` \| `archived` |
| `kind` | TEXT | `normal` \| `memes` (see open question Q1) |
| `owner_id` | TEXT NULL FK users ON DELETE SET NULL | unused until hosted accounts; set at creation when signed in |
| `ui_state` | TEXT JSON | `{stage, clip_id, source_id}`: where to resume |
| `created_at`, `updated_at`, `opened_at` | DATETIME | `opened_at` sorts the home screen |

### `sources` (new): the project's media bin
Replaces the in-memory `_sources` dict (`routes/files.py:21`). `id` keeps today's `source_id`
uuid, so the remux/stream URLs (`/api/files/stream/{sid}`, `sources/{sid}_a{n}.m4a`) stay the same.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | existing `source_id` |
| `project_id` | TEXT FK projects ON DELETE CASCADE | |
| `kind` | TEXT | `local` \| `url` \| `library` |
| `path` | TEXT | local path or plain URL. **Never** a tokenised stream URL |
| `library` | TEXT JSON NULL | `{provider, item_id, name, title, year}`. Stream URL rebuilt from `plex_config.json`/`jellyfin_config.json` at runtime, so no API key in the DB |
| `filename` | TEXT | display name |
| `duration`, `fps`, `width`, `height` | | probe cache |
| `streams` | TEXT JSON | `{video:[…], audio:[…]}` probe cache (today returned by `/pick` and thrown away) |
| `video_stream`, `audio_stream` | INTEGER NULL | chosen tracks (the lost "language" choice) |
| `thumbnail_path` | TEXT | |
| `draft` | TEXT JSON | import work in progress (below) |
| `created_at`, `updated_at` | DATETIME | |

`online` is **derived**, like `has_proxy`: `local` = `os.path.isfile(path)`; `library` = provider
configured. It is not stored.

`draft` JSON = everything VideoEditor/TimelineBar hold today:
```jsonc
{ "pending": [{ "name": "Scène 1", "start": 12.4, "end": 31.0 }],
  "mark": 40.2, "markName": "", "playhead": 40.2, "view": { "start": 0, "zoom": 1 } }
```
Saved with a debounced `PUT` (same pattern as `useSubtitleManager`, 800 ms). Cleared entry
by entry when the clips are created.

### `clips` (changed)
- `+ project_id TEXT FK projects ON DELETE CASCADE`. After migration every clip belongs to a project.
- `+ source_id TEXT FK sources ON DELETE SET NULL`. Clips are self-contained segments
  (`segments/{id}.mp4`), so removing or losing a source **never** breaks a clip. It only
  blocks cutting new clips from it.
- `+ ui_state TEXT JSON`: `{playhead, pxPerSec, rightTab, selected, studio: {role, mode}}`.
  Replaces `br-editor-sel-{id}`, `br-studio-role-{id}` and `br-studio-mode-{id}`.
- `project` (text) and `source_path` stay, read-only, until phase 6, then are dropped/ignored.

### `project_roles` (new): cast
| `id` PK · `project_id` FK CASCADE · `role` TEXT (matches `Subtitle.character`) · `comedien` TEXT · `color` TEXT · `order` INT |
|---|

Replaces `localStorage['br-comediens-{clipId}']`. A role is cast once per project instead of
once per clip per browser. The account's `User.comedien` stays as the display fallback
(`withComedienDefault`).

### `lexicon` (changed)
`+ project_id TEXT NULL FK projects ON DELETE CASCADE` (NULL = global). The listing filter
becomes `project_id IS NULL OR project_id = ?`. The text column is kept until phase 6.

### Unchanged
`subtitles`, `boucles`, `takes`, `exports` stay keyed by `clip_id`. The project is reached
through the clip. Exports, Dubpack and mix never read `project`/`source_path` today, so they
need no change.

---

## 3 · Migration

Runs once in `init_db()`, using the existing idempotent pattern (`create_all` for new tables,
`PRAGMA table_info` guards for new columns), plus a data step guarded by a flag.

0. **Back up first.** Copy the SQLite file to `*.bak-projects-YYYYMMDD` before the data step.
1. **Flag.** A `meta(key, value)` table holds `projects_migrated=1`, so the data step runs once.
2. **Projects.** One `Project` per distinct non-empty `clips.project`. Clips with no project
   go to a **"Clips importés"** project, created only if such clips exist. The meme project
   name gets `kind='memes'` (Q1).
3. **Sources.** Per project, group clips by `source_path` (or `source_filename` when the path is
   NULL). One `Source` per group:
   - `kind` is guessed: `http…` with a Plex/Jellyfin host → `library` (token stripped), other
     `http…` → `url`, otherwise `local`.
   - Clips with neither path nor filename keep `source_id = NULL` (unknown source).
4. **Lexicon.** `project_id` from a name match. `''` → NULL.
5. **Comédiens (frontend, one-shot).** On first load after upgrade, read every
   `br-comediens-{clipId}` key and `POST` it to that clip's project cast. If two clips disagree
   on a role, the most frequent name wins and the conflict is logged in the console. Then
   delete the keys.
6. **Per-clip UI keys.** The studio role/mode keys are copied into `clips.ui_state` in the same
   one-shot, then removed.

Migration test: build a DB fixture with tagged, untagged and meme clips, local, URL and
library sources, and lexicon entries. Run `init_db()` twice and assert identical output.

---

## 4 · Screen flow

### Navigation
- **Nav rail:** **Projets** (home) · **Memes** · **Réglages** (+ Activité, Compte as today).
  Import, Clips, Éditeur and Studio leave the rail and become **stages inside a project**.
- **Routing:** hash routes, consistent with the existing `#login`/`#account`:
  `#projects` · `#p/{projectId}/{stage}` · `#p/{projectId}/{stage}/{clipId}`.
  This gives reload, back/forward and deep links, and replaces `sessionStorage['br-nav']`
  (App.jsx:31-50). Auth hashes still win.
- **Opening the app** → the last opened project at its `ui_state` stage and clip. Fallback:
  the Projects home.

### Projects home
- Grid of project cards: cover (first clip thumbnail), name, colour, counts
  (sources · clips · lines), progress (clips by status todo/doing/done), "opened 2 h ago".
- **+ Nouveau projet** → dialog: name, language (default = Réglages Whisper), colour, then
  straight into **Médias**.
- Search, "Archivés" filter, card menu: rename, colour, archive, delete (Q2).
- Empty state: "Crée ton premier projet", with an explanation of the
  Médias → Clips → BR → Studio → Export flow.

### Project view
Header: `Projets › {name}`, then stage tabs **Médias · Clips · Bande rythmo · Studio · Export**,
then the clip switcher (‹ clip name ›) on clip stages. A stage that needs something missing is
disabled with a tooltip (e.g. Clips greyed with "Importe une vidéo d'abord").

| Stage | Built from | Change |
|---|---|---|
| **Médias** | ImportSection + VideoEditor + TimelineBar | Left: source list (thumbnail, duration, chosen tracks, `n clips`, `brouillon · 3 plages`, offline badge). **+ Ajouter** = today's tabs (local pick / URL / Médiathèque) as a panel. Right: the cutting timeline for the selected source, its draft restored. **Créer les clips** commits the draft. |
| **Clips** | ClipsLibrary + ClipCard | Scoped to the project. Project chips/filter replaced by a **source** filter. "+ Projet" becomes **Déplacer vers…** (another project). |
| **Bande rythmo** | DubbingWorkspace | Unchanged inside. Opens on `clips.ui_state` (playhead, zoom, tab, selection). Lexicon tab = project + global. |
| **Studio** | StudioScreen | Roles and comédiens come from the project cast. Resumes role/mode from `ui_state`. |
| **Export** | ExportPanel | Per clip as today. Project-level batch export later (REMAKE Phase 3). |

### Offline media / relink
A `local` source whose file is missing shows an **offline** badge. Its clips keep working
(segments are on disk). Only cutting is blocked. **Relink…** opens `/api/files/pick`; the new
file is accepted if its duration is within 0.5 s of the cached one, otherwise the app warns
and asks before relinking. A `library` source is offline when its provider isn't configured;
the badge links to Réglages › Médiathèques.

---

## 5 · API sketch

```
GET    /api/projects                     ?status=active|archived → cards with counts
POST   /api/projects                     {name, language?, color?}
GET    /api/projects/{id}                project + sources + cast
PATCH  /api/projects/{id}                {name?, color?, language?, status?, ui_state?}
DELETE /api/projects/{id}                (Q2)

POST   /api/projects/{id}/sources/pick   native dialog → Source row (replaces /api/files/pick)
POST   /api/projects/{id}/sources        {kind:'url'|'library', path|library}
PATCH  /api/sources/{sid}                {video_stream?, audio_stream?, filename?}
PUT    /api/sources/{sid}/draft          {draft}
POST   /api/sources/{sid}/relink         native dialog → duration check
DELETE /api/sources/{sid}                clips kept (source_id → NULL)

PUT    /api/projects/{id}/cast           [{role, comedien, color, order}]
PUT    /api/clips/{id}/ui-state          {ui_state}
PUT    /api/clips/{id}/project           {project_id}   (move; replaces the text version)
POST   /api/clips/batch-local-job        + source_id (path resolved server-side from the Source)
GET    /api/clips/                       + ?project_id=
```
`/api/files/stream|remux|remux-status/{sid}` keep their paths but read the `sources` table
instead of `_sources`, so they work after a backend restart.

---

## 6 · Phases

Each phase ships on its own branch and leaves the app usable.

### P1 · Data foundation (backend only, no UI change)
- [ ] `Project`, `Source`, `ProjectRole`, `meta` models. New columns on `clips`/`lexicon`.
- [ ] Migration (§3, steps 0–4) with backup + idempotency test.
- [ ] `/api/projects` CRUD, `/api/sources`, `?project_id=` on clips.
- [ ] `files.py` persists sources to the DB instead of `_sources`. Stream/remux survive a restart.
- [ ] The old `Clip.project` endpoints keep working (write both) until P2 ships.
- **Done when:** the unittest suite passes, the migration fixture passes twice, and the
  current UI works unchanged.

### P2 · Projects home + project shell
- [ ] Hash router, nav rail change, Projects home, New project dialog.
- [ ] Project view with stage tabs wrapping the **existing** screens (no internal changes).
- [ ] ClipsLibrary scoped by project, with a source filter and Déplacer vers….
- [ ] `br-nav` replaced by the hash + `projects.ui_state.stage/clip_id`.
- **Done when:** a reload on any stage lands on the same project, stage and clip. Back/forward work.

### P3 · Médias stage + import draft (fixes the original complaint)
- [ ] Source list + Ajouter panel, chosen tracks saved on the Source.
- [ ] VideoEditor draft autosave/restore (`PUT /draft`). Remux reused if `sources/{sid}_a*.m4a` exists.
- [ ] Offline badge + Relink.
- **Done when:** you can cut 3 ranges, leave, restart the backend, reload, and find the same
  source, tracks and 3 ranges.

### P4 · Resume everywhere
- [ ] `clips.ui_state`: playhead, zoom (skips auto-fit when saved), right tab, selection, Studio role/mode.
- [ ] Per-clip sessionStorage/localStorage keys migrated, then removed.
- Touches DubbingWorkspace. **Do it after REMAKE Phase 2** (editor split), or the 3,650-line
  file gets one more cross-cutting concern.

### P5 · Cast + lexicon per project
- [ ] `project_roles` + `PUT /cast`. Studio RolePicker and the Voix tab read and write it.
- [ ] Comédiens localStorage one-shot migration (§3.5).
- [ ] Lexicon on `project_id`.

### P6 · Project lifecycle + cleanup
- [ ] Rename / colour / archive / delete (Q2) / move clips between projects.
- [ ] Drop reads of `Clip.project`, `LexiconEntry.project`, `source_path`. Remove `_sources`.
- [ ] Update CLAUDE.md architecture + data model sections.
- Later: project ZIP export/import, `owner_id` + sharing with hosted accounts, project-level
  batch export (REMAKE Phase 3).

**Suggested order:** P1 → P2 → P3 (fixes what users feel) → REMAKE Phase 2 → P4 → P5 → P6.

---

## 7 · Risks

- **Tokens in the DB.** `Clip.source_path` already stores tokenised library URLs (only
  redacted on output). `Source.library` stores provider + item id instead. The migration
  strips the token, and the old column is dropped in P6.
- **Moved/renamed files.** Windows paths break when drives or folders change. Relink covers
  it; clips are never affected.
- **Big-bang temptation.** P2 wraps existing screens unchanged on purpose. Internal rewrites
  come only where a phase needs them.
- **Two tabs on one project.** Last write wins, as today for subtitles. Acceptable for a
  local single-user app (REMAKE non-goal: realtime co-editing).
- **Accounts.** Data stays shared on the machine (`User` docstring). `owner_id` is recorded but
  not enforced until hosted accounts. Filtering by owner now would hide existing clips.

---

## 8 · Open questions

- **Q1 · Memes.** Today MemeGenerator tags its clips with a fixed project name. Options:
  (a) Memes stays a standalone tool whose clips go to an auto `kind='memes'` project, hidden
  from the home grid; (b) memes become a stage of any project. **Recommend (a).**
- **Q2 · Deleting a project.** It deletes clips, takes, exports, proxies and stems on disk, but
  never the original source files. Confirm by typing the name, showing the disk size freed.
  Or archive-only, with no hard delete? **Recommend delete + typed confirmation, archive as
  the default card action.**
- **Q3 · UI state per user or per project?** Per project is simpler and right for one person
  per machine. Per user matters only with hosted accounts. **Recommend per project now.**
- **Q4 · `brOffset`.** It is a sync correction (a property of the clip), not a view setting.
  Persist it as clip data (`clips.br_offset`) rather than in `ui_state`? **Recommend yes.**
- **Q5 · Language.** Per project (Whisper default) is the plan. A source with several audio
  tracks may need a per-source override. Add `sources.language` only if it comes up.
