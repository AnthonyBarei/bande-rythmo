# Bande Rythmo — CLAUDE.md

## Stack
- **Frontend**: React + Vite (port 5173)
- **Backend**: FastAPI + uvicorn (port 8000, `127.0.0.1` — not `localhost` for Vite proxy)
- **Persistance**: SQLite via `database.py` (`init_db()` au lifespan startup)
- **Transcription**: openai-whisper modèle `base` + faster-whisper, pyannote diarization, local/offline
- **Vidéo**: ffmpeg-python
- **Sous-titres**: pysrt + export custom (SRT, ASS, MP4, GIF, MP3, WAV)

## Lancer le projet
```bash
# Backend
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm run dev -- --port 5173
```

## Architecture
```
backend/
  main.py                  # FastAPI app, lifespan init_db, static mounts
  database.py              # SQLite init + accès + idempotent ALTER TABLE guards
  models.py                # Clip (fps,scene_cuts,project), Subtitle (words,off,dos,ambiance,plan_cut,note), Boucle, Take, Export, LexiconEntry
  routes/
    video.py               # upload + découpe ffmpeg
    transcription.py       # Whisper (extrait audio WAV avant transcription) — language par requête
    clips.py               # CRUD + status + boucles + fps + import-subtitles + detect-scenes + proxy + project + separate-vocals
    export.py              # SRT/ASS/DetX/Croisillé/MP4/GIF/MP3/WAV + quality presets + GPU + plage perso + historique
    meme.py                # génération memes (image/GIF)
    files.py               # upload vidéos source
    plex.py                # intégration Plex
    takes.py               # prises d'enregistrement (recording)
    jobs.py                # statut/cancel/result/ws des jobs (fire-and-poll)
    fonts.py               # upload TTF/OTF + registry + resolve_font_path
    lexicon.py             # CRUD lexique de doublage (scope projet + globaux)
    translate.py           # /status + traduction (DeepL/LibreTranslate)
  services/
    ffmpeg_service.py      # extract_segment, extract_thumbnail, export_gif, probe_fps, run_ffmpeg_with_progress, detect_scene_cuts, make_proxy, h264_encoder_args/available_hw_encoders
    whisper_service.py     # transcribe_segment (singleton model)
    subtitle_service.py    # export_srt/ass/detx (pro BR)/croisille
    subtitle_import_service.py # parse_srt/ass/vtt/detx → dicts
    clip_service.py        # store clips + update_boucles/fps/scene_cuts/project/...
    br_renderer.py         # rendu bande rythmo + _draw_signs (burn détection) + polices uploadées
    detection.py           # classify_char() (miroir detection.js)
    plex_service.py        # client Plex
    take_service.py        # store prises
    export_service.py      # record_export/list/get/delete (historique)
    translate_service.py   # provider_status + translate (DeepL/LibreTranslate, env)
    vocal_service.py       # separation_status + separate (Demucs two-stems)
    jobs.py                # Job, JOBS dict, create_job, progress/cancel, JobStartResponse/JobStatus
  fonts/                   # AtkinsonHyperlegible-Bold, Caveat, Inter, JetBrainsMono-Bold, ShantellSans
  uploads/fonts/           # polices uploadées (gitignored) + _registry.json
  segments/                # {id}.mp4, {id}_proxy.mp4, stems/ (séparation vocale)

frontend/src/
  App.jsx                  # top bar + nav rail + routing + handlers (rename/status/project/...)
  Icons.jsx                # set SVG unifié (Icon, ICONS)
  SettingsContext.jsx      # contexte préférences (accent, BR style, densité)
  ProgressContext.jsx      # jobs[] + ProgressToasts (file de cartes empilées) + WS/poll
  ToastContext.jsx         # undo-toast (suppression réplique)
  detection.js             # classifyChar() + SIGN_KINDS + DEFAULT_SIGN_TOGGLES (miroir detection.py)
  components/
    Sidebar.jsx            # nav rail: Importer / Mes Clips / Memes / Réglages
    ImportSection.jsx      # upload + timeline drag-to-create + Plex tab
    VideoEditor.jsx        # éditeur clip (job-mode batch)
    TimelineBar.jsx        # timeline zoom + minimap (import)
    BRTimeline.jsx         # nav plein-clip sous canvas BR (waveform/boucles/scenes/playhead)
    VideoPlayer.jsx        # player custom réutilisable
    ClipsLibrary.jsx       # grille clips + filtres status + chips projet
    ClipCard.jsx           # card: thumbnail, rename, projet, Doubler / ▶ / MP3 / GIF / ✕
    DubbingWorkspace.jsx   # BR pro: SMPTE, détection, boucles, undo/redo, proxy, traduction, scènes, auto-save
    SubtitleEditor.jsx     # tableau timecode+perso+texte+note + import SRT/ASS/VTT/DetX
    LexiconPanel.jsx       # lexique (onglet right pane)
    RecorderPanel.jsx      # enregistrement, take queue, A/B compare
    ExportPanel.jsx        # exports + quality + GPU + plage perso + historique re-download
    ShortcutsOverlay.jsx   # modal raccourcis (?)
    MemeGenerator.jsx      # memes — player unifié, résultat remplace source
    Preferences.jsx        # réglages (accent, BR style, densité, Whisper, Plex)
    PlexBrowser.jsx        # connexion + navigation bibliothèque Plex (restylé)
```

## Bugs connus / résolus
- ~~BR décalée ~1s~~ : `-ss` après `-i` dans extract_segment (fix appliqué). Slider `brOffset` (-2s/+2s) = échappatoire.
- ~~Deadlock jobs ffmpeg~~ : `run_ffmpeg_with_progress` stderr PIPE non drainé → DEVNULL (fix).
- Vite proxy doit cibler `http://127.0.0.1:8000` (pas `localhost`) — Windows IPv6

## Export MP4 + BR — bonnes pratiques (texte défilant lisible)

Le texte rythmo défile en continu : la lisibilité en mouvement dépend du fps,
de l'encodage et du flou de mouvement. Pipeline (`br_renderer.py` + `export.py`) :

- **60 fps de sortie** (`export_fps`). Le défilement à 24/25 fps saccade ; 60 fps
  cale sur les écrans 60 Hz → pas de judder de cadence d'affichage. La vidéo
  source est rééchantillonnée vers 60 par ffmpeg (`-r`).
- **Suréchantillonnage temporel** (`render_br_video(supersample=4)`) : chaque
  image de sortie = moyenne de 4 sous-images → flou de mouvement directionnel.
  Le défilement est perçu lisse au lieu de sauter (« 240 Hz » VoxDub).
  Coût : ~5 s de rendu / s de clip.
- **`shutter`** (0..1, défaut 0.25) : largeur de la fenêtre de flou (angle
  d'obturateur). 1.0 = smear max, 0.5 = cinéma 180°, plus bas = texte net mais
  léger risque de micro-saccade. 0.25 = net, le 60 fps réel porte la fluidité.
- **BR collée SOUS l'image** (`vstack`, pas `overlay`) : l'image vidéo reste
  entière, jamais masquée (style VoxDub). `vstack` exige même largeur + même
  `format` → forcer `fps={export_fps},format=yuv420p` sur les deux entrées avant.
- **Sortie standard 1920×1080** : le composite image+bande est mis en boîte aux
  lettres (`scale=...:force_original_aspect_ratio=decrease,pad=1920:1080`) —
  rien rogné ni déformé, barres noires complètent. Taille prévisible, lit partout.
- **`-crf 21`** : qualité web (≈1-2 Mbps en 1080p60). crf 14 = quasi sans perte,
  fichiers 3-4× trop lourds pour aucun gain visible.
- **Intermédiaire FFV1 RGB sans perte** (`.mkv`) : un seul encodage avec perte
  (l'encodage final), pas de sous-échantillonnage chroma sur le texte.
- **`-bf 0`** (pas de B-frames) : évite le smear/ghosting sur le texte mobile.
- **`fps` sur les DEUX entrées avant `vstack`** : sinon les timebases diffèrent,
  ~1/3 des images BR 60 fps sortent en doublon → défilement saccadé même si la
  strip est vrai 60 fps. Le faire sur la seule image de fond ne suffit pas.
- **`-r {export_fps}`** en sortie : force le CFR, supprime le judder sur source VFR.
- **Pas de waveform synthétique** dans l'export : c'était du faux signal
  (`math.sin`), du bruit haute fréquence qui mangeait le débit et brouillait
  le texte. L'export reste propre (texte + curseur + séparateurs + labels).
- **Police haute lisibilité** : Atkinson Hyperlegible / Inter / JetBrains Mono
  embarquées dans `backend/fonts/`, choisies via le picker `brFont` (transmis
  par `ExportRequest.br_font`) → export WYSIWYG avec l'aperçu.
- **Style rythmo** (`ExportRequest.br_style`) : classique / neon / minimal —
  transmis du picker frontend, rendu par `br_renderer` (fond + blocs + glow
  néon). Export WYSIWYG avec le canevas de l'éditeur.
- **Affichage mot-par-mot** (vrai rythmo) : chaque réplique porte `words`
  (JSON `[{w,start,end}]`, colonne `subtitles.words`) issus des timestamps mot
  de Whisper. Chaque mot remplit SON bloc temporel `[start, end]` : compressé
  pour rentrer, étirement plafonné (`_STRETCH_CAP` = 1.2 — un mot tenu reste
  proche de sa largeur normale, calé à gauche, l'espace résiduel montre la
  tenue) → jamais coupé, jamais débordé. Espace final inclus dans chaque mot
  (séparation). Canevas + `br_renderer` identiques. Validation au rendu
  (`validWords` / `_valid_words`) : si `words` ne correspond plus au
  texte/timing (édition) → repli sur le texte entier comme un seul mot.
- **Police cursive** : Caveat (`backend/fonts/Caveat.ttf`) — option `cursive`
  du picker, rappelle la calligraphie traditionnelle de la bande rythmo.
- **Contour noir** (`stroke_width`) autour des glyphes : lisibilité sous flou
  de mouvement et compression h264.
- **Taille de police proportionnelle à `track_h`** (~0.45) : texte lisible avec
  marge au-dessus/en-dessous, proportions VoxDub. Lisible de 1080p à 4K.
- **`scaleX` sans plancher dur** (min 0.05) : le texte est compressé/étiré pour
  remplir exactement son bloc — jamais coupé au bord. Compression extrême =
  réplique trop courte (problème de timing, pas d'affichage).
- **Auto-fit `pxPerSec`** : à l'ouverture d'un clip, `DubbingWorkspace` mesure
  le texte et choisit `pxPerSec` (réplique dense ~largeur naturelle, autres
  étirées). Clampé [100, 220] — défilement lent/confortable type VoxDub ; les
  répliques très denses se compressent (normal en rythmo). Défaut 180 avant
  mesure ; zoom manuel possible ensuite. `pxPerSec` sert à la fois au zoom
  d'affichage et à la vitesse de défilement de l'export.

## Modèle de données — pro BR (session 2026-05-30)

### Subtitle (colonnes ajoutées)
```python
words    TEXT        # JSON [{w, start, end, signs?: [{i, type, t0, t1}]}]
off      INTEGER     # 0/1 — hors-champ → trait continu sous la ligne
dos      INTEGER     # 0/1 — de dos → trait pointillé
ambiance INTEGER     # 0/1 — ambiance ON/OFF → ▸◂ + couleur désaturée
plan_cut REAL        # timecode d'un changement de plan dans la ligne (nullable)
note     TEXT        # annotation libre par réplique (point accent sur canvas)
```

### Clip (colonnes ajoutées)
```python
fps        REAL  # frame rate source détecté via ffprobe à l'import (PAL=25 défaut)
scene_cuts TEXT  # JSON [sec] — changements de plan détectés (ffmpeg scene filter)
project    TEXT  # dossier/projet (nullable) — groupement ClipsLibrary
# has_proxy = dérivé (os.path.isfile segments/{id}_proxy.mp4), pas une colonne
```

### Boucle (table créée)
```python
id, clip_id FK, number INT, start FLOAT, end FLOAT
# PUT /api/clips/{id}/boucles — remplace tout le tableau
```

### Export (table créée) — historique re-download
```python
id, clip_id FK, format, path, filename, media_type, size_bytes, quality, params(JSON), created_at
# GET /api/export/list?clip_id= · GET /download/{id} · DELETE /{id}
```

### LexiconEntry (table créée) — lexique de doublage
```python
id, project, term, translation, phonetic, note, created_at   # project='' = global
# GET/POST /api/lexicon (scope projet + globaux) · PUT/DELETE /{id}
```

### Migrations
Toutes via guards idempotents `ALTER TABLE ... ADD COLUMN` dans `database.py init_db()`
(pas d'Alembic). Nouvelles tables via `Base.metadata.create_all`.

### Signs (extension de words[].signs)
```jsonc
{ "i": 0, "type": "labiale|semi|fricative|arrondie|ouverte", "t0": 3.10, "t1": 3.18 }
```
- `i` = index char dans le mot (survit au stretch)
- `t0/t1` = timespan propre au signe (labiale = intervalle fermeture lèvres, indépendant du stretch du mot)
- Absent → `classifyChar()` auto-classifie depuis les lettres (aide live, non exporté)

## BR Pro — calque détection (DubbingWorkspace)

Signes graphite `#c7ccd4` dessinés APRÈS les glyphes dans la boucle par mot :
- **labiale** — barre 2.4px sous la lettre, ancrée sur `[t0,t1]` propre (pas le stretch)
- **semi** — barre pointillée 1.6px
- **fricative** — chevron ^ au-dessus
- **arrondie** — cercle au-dessus 3.4px
- **ouverte** — arc ouvert au-dessus (off par défaut)

Toggles : calque entier + 6 signes individuels + "aide auto" → `localStorage('br-detection')`.

Marqueurs de calibration ancrés à t=0 (PI) :
- `START` −3s : barre blanche + ✕
- `BIP 1000 Hz` −2s : barre bleue pointillée
- `PI` 0s : barre blanche

Boucles : pointillés jaunes `rgba(245,197,24,0.55)` + cap `B{n}`.

Cursor TC chip : `HH:MM:SS:FF` à `clip.fps` (accent, bordure accent).

## Export DetX pro

`export_detx()` émet maintenant :
- `<videoframerate>` avec `clip.fps`
- Signes → paires `<lipsync type="in_closed|out_closed|in_rounded…">`  
  Mapping: `labiale/semi → closed`, `fricative/ouverte → open`, `arrondie → rounded`
- Attrs ligne : `off="true"`, `dos="true"`, `type="amb"` (ambiance), `plan="TC"`

`export_croisille()` → HTML autoportant : grille perso × boucles, ● quand chevauchement, footer voix/boucle.
Format `croisille` disponible via `POST /api/export/export`.

## Polices BR (picker)
```
atkinson  → AtkinsonHyperlegible-Bold.ttf  (défaut)
lisible   → ShantellSans.ttf               (manuscrite lisible, à bundler)
cursive   → Caveat.ttf                     (manuscrite authentique)
inter     → Inter.ttf
jetbrains → JetBrainsMono-Bold.ttf
```
Web: Shantell Sans chargé depuis Google Fonts dans `index.html`.
Backend: `_BR_FONT_FILES["lisible"]` → fallback atkinson si fichier absent.

## Roadmap

### Fait — base
- Import timeline drag-to-create multi-clips + zoom/minimap + source URL
- Préférences (accent, BR style, densité) + SettingsContext
- Enregistrement: RecorderPanel, take queue, A/B compare
- ClipsLibrary refonte (filtres status, cards)
- Set d'icônes SVG unifié (Icons.jsx)
- Export MP3/WAV
- VideoPlayer custom (composant)
- Intégration Plex (PlexBrowser + route, restyle complet)
- Générateur de memes
- **BR Pro (2026-05-30)** : SMPTE fmtTC, détection layer, START/BIP/PI, boucles, line flags, Clip.fps, DetX pro, Croisillé, police Shantell

### Fait — UPGRADE_PLAN intégral (P0 → P3) + handoff (2026-06-04)

**P0 — parité workflow BR**
- Navigation image par image (⇧←/→ = 1/clip.fps)
- Import SRT / ASS / VTT / **DetX** (`subtitle_import_service`, `POST /api/clips/{id}/import-subtitles`)
- **BRTimeline** (`BRTimeline.jsx`) : barre nav plein-clip sous le canvas — waveform, ticks répliques, bandes boucles, scene cuts, bracket fenêtre visible, clic-pour-seek
- Marqueurs d'étirement (barres compression colorées sous les blocs mots)

**P1 — qualité de vie**
- Undo/redo (pile 50 snapshots, Ctrl+Z / Ctrl+Y / Ctrl+⇧Z, boutons ↶/↷ transport)
- Détection auto changements de plan (`detect_scene_cuts`, `Clip.scene_cuts`, cluster « Plans »)
- Notes par réplique (`Subtitle.note`, éditeur inline, point accent canvas)
- Export GPU (NVENC/QSV/AMF, `h264_encoder_args`, détection + repli libx264)
- Toggle rendu mot-par-mot (`wordByWord`)
- Burn détection MP4 (Phase 2 — `_draw_signs`/`_resolve_signs`/`_merge_words`)

**P2 — plateforme**
- Proxy vidéo 720p (`make_proxy`, `POST /{id}/proxy` job, toggle Master/720p, has_proxy)
- Export plage perso (toutes formats : `_trim_subs_to_range` + MP4 -ss/-t, « Plage personnalisée » dans ExportPanel)
- File d'export = cartes de progression empilées (`ProgressToasts`) + historique re-download (`Export` model)

**P3 — long terme**
- Dossiers projet (`Clip.project`, `/project`, chips ClipsLibrary, assign ClipCard)
- Lexique de doublage (`LexiconEntry`, `/api/lexicon`, onglet « Lexique », scope projet + globaux)
- Traduction auto (`translate_service` — DeepL/LibreTranslate via env, `🌐 Traduire` gated, undoable)
- Upload polices TTF/OTF (`/api/fonts`, @font-face, picker, export WYSIWYG)
- Séparation vocale IA (`vocal_service` Demucs, `/separate-vocals` job, `🎚 Séparer voix` gated)

**UX / divers**
- Anneaux focus clavier (`:focus-visible`)
- ⟲ loop-active déplacé dans la barre transport (DOUBLAGE_IA §3)
- Whisper config langue par clip
- Meme : player unifié (1 video, IN/OUT gated) + résultat remplace la source
- Fix deadlock `run_ffmpeg_with_progress` (stderr PIPE → DEVNULL)
- Fix dépréciation `asyncio.get_event_loop` → `get_running_loop` (5 endroits)

### Dégradation gracieuse (deps optionnelles)
- **Traduction** : `DEEPL_API_KEY` ou `LIBRETRANSLATE_URL` (+ `LIBRETRANSLATE_API_KEY`). Sinon `GET /api/translate/status` → `available:false`, contrôle masqué, `POST` → 503.
- **Séparation vocale** : `pip install demucs`. Sinon `GET /api/clips/vocal-separation/status` → `available:false`, contrôle masqué, `POST` → 503.

### Fait — Phase 0+1 REMAKE_PLAN (2026-06-07)
- **Hardening** : SQLite WAL + busy_timeout + index FK, excepts loggés, garde
  path fonts/SSRF Plex, ESLint baseline (`npm run lint`), `utils/timecode.js` +
  `config/tracks.js` (formatters/palette canoniques)
- **Export doublé (boucle de doublage fermée)** :
  - `services/mix_service.py` — mix ffmpeg : bed atténué (duck dB) ou muet +
    prises adelay'd au début de leur réplique + gain par prise + loudnorm −16
    LUFS, vidéo copiée (rapide)
  - `POST /api/export/mp4-dubbed` `{entries:[{take_id,at?,gain_db}], duck_db,
    mute_bed, loudnorm}` → MP4 doublé (historique `mp4-dubbed`)
  - **Piste audio de base (bed)** : `segments/{id}_bed.wav` (prioritaire sur
    l'audio du segment ; `has_bed` dérivé). `POST /{id}/replace-audio` (upload
    → wav 48k stéréo) · `POST /{id}/use-stem` (stem Demucs → bed) ·
    `DELETE /{id}/audio-bed`
  - **UI Mixage** (ExportPanel) : prises cochables + gain −12..+12 dB, VO
    duck/muette, Remplacer l'audio / Instrumental / reset, export 1-clic

### Reste à faire (non démarré)
- **Phase 2 (REMAKE_PLAN)** : split DubbingWorkspace (3 650 lignes) en hooks,
  export côté serveur (DB source of truth), Vitest
- **Gestion utilisateurs** : auth (JWT/session), multi-user, contenu par user
- **Intégrations tierces** : Stremio (lecture vidéo), qBittorrent (download → import auto)
- `.rythmo.txt` import (DetX XML déjà couvert)
