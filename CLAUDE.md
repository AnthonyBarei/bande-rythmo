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
uvicorn main:app --reload --port 8000 --timeout-graceful-shutdown 2

# Frontend
cd frontend
npm run dev -- --port 5173
# → http://localhost:5173/ = accueil (landing), /app/ = l'atelier

# Tests
cd backend && venv\Scripts\python.exe -m unittest discover tests
cd frontend && npm test
```
Second backend (worktree) : `BR_API_TARGET=http://127.0.0.1:8010` redirige le proxy Vite.

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
    jellyfin.py            # intégration Jellyfin (même forme de réponses que plex.py)
    takes.py               # prises d'enregistrement (recording) — Take.lead = marge avant la réplique (continu)
    jobs.py                # statut/cancel/result/ws des jobs (fire-and-poll)
    fonts.py               # upload TTF/OTF + registry + resolve_font_path
    lexicon.py             # CRUD lexique de doublage (scope projet + globaux)
    translate.py           # /status + traduction (DeepL/LibreTranslate)
    auth.py                # comptes locaux : register/login/logout, /me (profil, prefs, mdp, e-mail, sessions, export, suppression), forgot/reset/verify
  services/
    ffmpeg_service.py      # extract_segment, extract_thumbnail, export_gif, probe_fps, run_ffmpeg_with_progress, detect_scene_cuts, make_proxy, h264_encoder_args/available_hw_encoders
    whisper_service.py     # transcribe_segment (singleton model)
    subtitle_service.py    # export_srt/ass/detx (pro BR)/croisille
    subtitle_import_service.py # parse_srt/ass/vtt/detx → dicts
    clip_service.py        # store clips + update_boucles/fps/scene_cuts/project/...
    br_renderer.py         # rendu bande rythmo + _draw_signs (burn détection) + polices uploadées
    detection.py           # classify_char() (miroir detection.js)
    plex_service.py        # client Plex
    jellyfin_service.py    # client Jellyfin (header Authorization MediaBrowser, stream ?ApiKey=)
    take_service.py        # store prises
    export_service.py      # record_export/list/get/delete (historique)
    translate_service.py   # provider_status + translate (DeepL/LibreTranslate, env)
    vocal_service.py       # separation_status + separate (Demucs two-stems)
    auth_service.py        # hash scrypt, sessions (token cookie → SHA-256 en base), liens à usage unique, throttle
    mail_service.py        # SMTP (env) + messages reset / vérification
    jobs.py                # Job, JOBS dict, create_job, progress/cancel, JobStartResponse/JobStatus
  fonts/                   # AtkinsonHyperlegible-Bold, Caveat, Inter, JetBrainsMono-Bold, ShantellSans
  uploads/fonts/           # polices uploadées (gitignored) + _registry.json
  segments/                # {id}.mp4, {id}_proxy.mp4, stems/ (séparation vocale)

frontend/src/
  App.jsx                  # routeur hash (utils/route.js) + rail + TopBar/ProjectBar + handlers clips
  Icons.jsx                # set SVG unifié (Icon, ICONS)
  SettingsContext.jsx      # contexte préférences (accent, BR style, densité)
  AuthContext.jsx          # compte (user, login/register/…) + sync préférences ↔ compte
  ProgressContext.jsx      # jobs[] + ProgressToasts (file de cartes empilées) + WS/poll
  ToastContext.jsx         # undo-toast (suppression réplique)
  detection.js             # classifyChar() + SIGN_KINDS + DEFAULT_SIGN_TOGGLES (miroir detection.py)
  components/
    Sidebar.jsx            # nav rail: Projets / Atelier · Activité / Réglages
    ImportSection.jsx      # upload + timeline drag-to-create + onglet Médiathèque (Plex/Jellyfin)
    VideoEditor.jsx        # éditeur clip (job-mode batch)
    TimelineBar.jsx        # timeline zoom + minimap (import)
    BRTimeline.jsx         # nav plein-clip sous canvas BR (waveform/boucles/scenes/playhead)
    import/                # ImportPlayer, SeekBar, PlayerControls (lecteur Importer)
    band/                  # BandCanvas + bandRender/bandHit — rendu bande partagé Éditeur/Studio
    editor/                # EditorHeader, VideoStage, Transport, TimelineNav, BandToolbar, Inspector + onglets
    StudioScreen.jsx       # écran Studio v2 : rôle, Par réplique / En continu, résumé de session
    studio/                # useStudioRecorder (phases prêt→décompte→élan→rec→queue→revue, continu),
                           # useTakePlayer (A/B, écoute sur l'image), StudioStage, RolePicker,
                           # TakesColumn, ContinuousColumn, RangePicker, TakeSettings, StageParts
    takes/                 # TakeCard + TakeWave, Meter (Studio)
    ClipsLibrary.jsx       # étape Clips d'un projet : grille + filtres status + filtre vidéo source
    ClipCard.jsx           # card: thumbnail, rename, Déplacer, Doubler / ▶ / MP3 / GIF / ✕
    projects/              # ProjectsHome (accueil Projets), ProjectBar (étapes Médias·Clips·BR·Studio·Export),
                           # ProjectDialogs (nouveau/modifier, suppression nom tapé, Déplacer vers…), Dialog
    DubbingWorkspace.jsx   # BR pro: SMPTE, détection, boucles, undo/redo, proxy, traduction, scènes, auto-save
    SubtitleEditor.jsx     # tableau timecode+perso+texte+note + import SRT/ASS/VTT/DetX
    LexiconPanel.jsx       # lexique (onglet right pane)
    ExportPanel.jsx        # exports + quality + GPU + plage perso + historique re-download
    ShortcutsOverlay.jsx   # modal raccourcis (?)
    MemeGenerator.jsx      # memes — player unifié, résultat remplace source
    Preferences.jsx        # réglages (accent, BR style, densité, Whisper, Médiathèques Plex/Jellyfin)
    LibraryBrowser.jsx     # connexion + navigation médiathèque, switch Plex/Jellyfin (config/libraryProviders.js)
    account/               # AuthScreen (connexion/inscription/oublié/reset, plein écran) + AccountScreen (Mon compte)
  home/                    # home.css + home.js de la landing (frontend/index.html) ; confidentialite.html
frontend/app/index.html    # entrée de l'atelier (/app/) ; frontend/index.html = landing (/)
```

## Bugs connus / résolus
- ~~BR décalée ~1s~~ : `-ss` après `-i` dans extract_segment (fix appliqué). Slider `brOffset` (-2s/+2s) = échappatoire.
- ~~Deadlock jobs ffmpeg~~ : `run_ffmpeg_with_progress` stderr PIPE non drainé → DEVNULL (fix).
- Vite proxy doit cibler `http://127.0.0.1:8000` (pas `localhost`) — Windows IPv6
- `uvicorn --reload` figé sous Windows : au reload il attend la fermeture de toutes les connexions (WebSocket des jobs, streaming vidéo) → le worker ne redémarre jamais et l'API ne répond plus. Toujours lancer avec `--timeout-graceful-shutdown 2`.

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
Liste unique `frontend/src/config/fonts.js` (Réglages, barre Éditeur, Exporter — même `Select`) ;
rendu canevas `band/bandRender.js` (`BR_FONTS`, graisse 600) ; export `br_renderer.resolve_br_font_path`.
```
cursive   → Manuscrite → Caveat.ttf
atkinson  → Lisible    → AtkinsonHyperlegible-Bold.ttf  (fallback générique)
lisible   → Feutre     → ShantellSans.ttf               (à bundler → repli atkinson + warning)
plex      → Neutre     → IBMPlexSans-SemiBold.ttf       (à bundler → repli Inter.ttf + warning)
jetbrains → Mono       → JetBrainsMono-Bold.ttf
inter     → (legacy, plus proposé) → Inter.ttf — projets/réglages existants ; n'apparaît
            dans un Select que tant qu'il est la valeur sélectionnée
u-…       → police uploadée (routes/fonts.resolve_font_path) → repli atkinson + warning
```
Web: IBM Plex Sans / Shantell Sans / Inter (legacy) chargés depuis Google Fonts dans `index.html`.
Backend: fichier absent → `_BR_FONT_FALLBACKS` (warning loggé une fois par id, `br.renderer`).

## Roadmap

### Fait — base
- Import timeline drag-to-create multi-clips + zoom/minimap + source URL
- Préférences (accent, BR style, densité) + SettingsContext
- Enregistrement: RecorderPanel, take queue, A/B compare
- ClipsLibrary refonte (filtres status, cards)
- Set d'icônes SVG unifié (Icons.jsx)
- Export MP3/WAV
- VideoPlayer custom (composant) — remplacé par import/ImportPlayer (redesign v2)
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
- **E-mails de compte** : `SMTP_HOST` + `SMTP_FROM` (+ `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURITY` starttls|ssl|none, `APP_URL` base des liens). Sinon `GET /api/auth/status` → `email:false`, « Mot de passe oublié » et la vérification masqués, `POST /forgot` → 503.

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

### Fait — Usable v1 (2026-10-14, branche `feat/usable-v1`)
- Export **Dubpack** (pack Choicer Voicer : OGV Theora + 1 ogg/png/txt par réplique, ZIP) — `dubpack_service.py`, `POST /api/export/dubpack-job`
- Audit complet backend/éditeur/shell (~80 fixes) — détail + suite ordonnée : `REMAKE_PLAN.md` §5b
- Annulation de job = `kill_process_tree` (ffmpeg Chocolatey = shim → l'enfant survivait à `kill()`)
- Ids clip validés (middleware anti `..`/`\` + `SafeId` sur `segment_id`)
- Rechargement page → restaure la vue + le clip ouvert (`sessionStorage` `br-nav`)

### Fait — Redesign v2 (2026-10-14 → 2026-10-19)
- Port intégral du prototype Claude Design (`design/design_handoff_redesign_v2/`), 8 rounds de revue + revue finale acceptée
- Détail par écran : `CHANGELOG_REDESIGN.md` ; captures finales `design/app_screens_2026-10-14_final/`
- Captures reproductibles : `backend/venv/Scripts/python.exe design/app_screens_2026-10-14/shoot.py <out> --extras --mock-states [--size WxH]`

### Fait — Studio v2 (2026-10-20, branche `feat/studio-v2`)
Brief `design/design_handoff_redesign_v2/STUDIO_V2.md`, maquette `reference/redesign/screen-studio.jsx`,
preuves `design/studio_v2_proofs/` (`shoot_studio_v2.py`, aucune écriture backend).
- **Phases** : prêt (image figée à début − élan, texte Caveat) → décompte (image figée, bips, dernier aigu)
  → élan (VO audible, micro capte, élan retiré de la prise) → rec (VO muette) → queue (+0,6 s) → revue
  (dernière image). Échap annule → prêt même image ; R en revue = Refaire ; Entrée = Valider.
- **Valider** → réplique suivante du rôle sans prise validée, en prêt ; Enchaînement « Auto après 3 s ».
- **Réglages › Studio** + pastille `3 · 1s` : Décompte 0/3/5, Élan 0–3 s, Bips, Enchaînement
  (`studioCount/studioLead/studioBeeps/studioChain`). Remplace le « Pré-roll 3s » du Studio.
- **Rôle** : sélecteur (1–9, C), comédien (même stockage que l'onglet Voix), dernier rôle par clip,
  réplique sélectionnée dans l'Éditeur reprise à l'ouverture (`utils/studioPrefs`).
- **En continu** : un passage par plage (depuis ici / tout / IN-OUT), découpé client en prises
  « continu » `[début − 0,25 ; fin + 0,35]` (`utils/continuous`), pause Espace, résumé
  (valider / revoir / annuler avec undo). `Take.lead` place la prise à début − lead (mix, écoute).
- Raccourcis Studio mis à jour dans l'overlay `?`.
- **Éditeur → Studio** : R, ● de l'inspecteur et ● de l'onglet Voix ouvrent le Studio sur la réplique
  (sélectionnée, sinon sous la tête de lecture ; Voix : 1re réplique du rôle sans prise validée).
  L'enregistreur intégré à l'inspecteur (RecorderPanel) est supprimé — on enregistre dans le Studio.
- **Round 2** (`FIXES_STUDIO_R2.md`) : texte de la réplique + puce TC ancrés au rect réel de la vidéo
  (letterbox ≥ 72 px sinon 30 % bas de l'image), liste En continu qui suit la tête (2ᵉ ligne, pause 4 s
  après scroll manuel), `(sans texte)`, en-tête = bande, résumé : micro désactivé, Entrée / Échap.

### Fait — Jellyfin (2026-10-22, branche `feat/jellyfin`)
- Onglet Importer « Plex » → **Médiathèque** : switch Plex / Jellyfin (dernier choix en `localStorage`
  `br-library-provider`), `LibraryBrowser` agnostique — fournisseurs dans `config/libraryProviders.js`.
- `/api/jellyfin/{probe,status,connect,libraries,library/{id},item/{id}}` — mêmes formes que `/api/plex`.
  Clé API (Tableau de bord → Clés API) dans `backend/jellyfin_config.json` (gitignored).
- Auth : header `Authorization: MediaBrowser …, Token="…"` (X-Emby-Token / api_key désactivés par défaut
  dès Jellyfin 10.12) ; URL de flux `?ApiKey=` (redigée par `_redact_token`). Séries → épisodes listés.
- Source : `libraryName/libraryTitle/libraryYear` (ex-`plexTitle/plexYear`).
- Séries en dossiers : série → saisons → épisodes (`GET {api}/children/{id}`, fil d'Ariane + Retour,
  série à saison unique ouverte directement). Jellyfin : `/Shows/{id}/Seasons|Episodes` (sans dossiers
  de saison sur disque, une saison n'a pas d'enfants via `ParentId`). Recherche → séries + épisodes.
- Captures Claude Design : `design/mediatheque_2026-10-22/` (`shoot_mediatheque.py`, README = pistes UI).
- Hover + pagination (`design_handoff_redesign_v2/MEDIATHEQUE.md`) : cartes `.lib-card` (index.css —
  lift, zoom/assombrissement, synopsis `overview` + Importer/Ouvrir, `prefers-reduced-motion`), 24 / page
  (bibliothèque + recherche paginées serveur, enfants d'un dossier paginés client), squelette, page mémorisée
  par vue, PgSuiv/PgPréc + Retour arrière, préchargement page suivante, compteurs par bibliothèque.
- Lecture sans son (AC3/EAC3/DTS dans Chrome) : remux AAC automatique de la piste par défaut
  (`utils/audioCodec.js`, `canPlayType`) ; `_extract_audio` ne copie que l'AAC/MP3.

### Fait — Accueil + comptes (2026-10-22, branche `feat/accounts-home`)
Briefs `design/design_handoff_redesign_v2/HOME.md` + `ACCOUNT.md`, refs `reference/home.html` + `redesign/screen-account.jsx`.
- **Accueil** `/` (statique, `frontend/index.html`) : bande rythmo canvas, flux en onglets, formats.
  Visiteur connecté → `/app/`. CTA « Télécharger » → section `#telecharger` (Windows/macOS/Linux « Bientôt
  disponible », OS du visiteur en premier ; « Me prévenir » désactivé tant qu'il n'y a pas de serveur).
  Servie en local : pas de sonde `/api/health`. Méta + OG (`public/og.png`) + favicon (`public/favicon.svg`).
  Captures `public/home/*.png` sur *Tears of Steel* (CC BY 3.0, crédit sous la capture + pied de page) —
  `design/accounts_home_proofs/shoot_home_stills.py <clip_id> <source.mov>` (clip « Tears of Steel — le pont »).
- **Pages légales** : `/confidentialite.html` ; `/conditions.html` rend `frontend/docs/conditions.md`
  (provisoire, à rédiger par l'utilisateur — `src/home/markdown.js`).
- **Comptes locaux** (base SQLite de l'atelier, pas de serveur distant) : `User`, `UserSession`, `AuthToken`.
  Le compte ne porte que l'identité + les préférences ; clips/répliques/prises restent partagés sur la machine.
  Cookie httpOnly `br_session` (SameSite=Lax), 30 j si « Rester connecté », sinon 12 h + cookie de session.
  Login : erreur générique + 5 échecs / 15 min par IP+e-mail → 429.
- **Écran auth** `#login` `#register` `#reset=<token>` ; `#verify=<token>` confirme l'adresse ; `#account` → Mon compte.
- **Mon compte** : profil (avatar 6 couleurs, nom, nom de comédien), e-mail (modifier + vérification),
  mot de passe (déconnecte les autres appareils), appareils connectés, archive JSON, suppression (tape l'e-mail).
- **Préférences** suivent le compte : celles du compte gagnent à la connexion, puis chaque changement est poussé.
  Stockées versionnées `{"v": 1, "settings": {…}}` (migration vers un compte hébergé).
- **Comédien** : rôle sans comédien → nom de comédien du compte affiché (Studio + onglet Voix), stocké seulement si édité.

### Reste à faire (non démarré)
- **Phase 2 (REMAKE_PLAN)** : split DubbingWorkspace (3 650 lignes) en hooks,
  export côté serveur (DB source of truth), Vitest
- **Comptes — suite** : texte des conditions (`frontend/docs/conditions.md`), compte hébergé
  (multi-appareils, gamification, « Me prévenir »), contenu par utilisateur
- **Installateurs** (Windows / macOS / Linux) — la section Télécharger de l'accueil les attend
- **Intégrations tierces** : Stremio (lecture vidéo), qBittorrent (download → import auto)
- `.rythmo.txt` import (DetX XML déjà couvert)

### Idées — gamification (plus tard, [TryToAct](https://trytoact.com/))
Boucle du jeu, pas à construire maintenant. Dépend de la gestion utilisateurs.
L'app reste l'outil studio ; ça serait une couche jeu par-dessus clips + prises.
L'export Dubpack (pack Choicer Voicer) est déjà le format « créer un pack ».

1. **Choisir une scène** — bibliothèque de packs (films/séries) ou sa propre vidéo.
2. **Enregistrer** — une prise par réplique, réécoutes libres (prises + A/B déjà là).
3. **Solo ou multijoueur live** — s'entraîner seul, ou défier des amis sur la même scène en direct.
4. **Partager** — publier le pack pour que d'autres le doublent (mode créateur).
5. **Classement** — meilleurs doubleurs, et packs les plus joués. Découverte des nouveaux doublages.

Contraintes annoncées côté TryToAct, à garder en tête si on s'en inspire :
gratuit (compte, pas d'abonnement), navigateur sans install, communauté FR.
