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
  models.py                # Clip (fps), Subtitle (words,off,dos,ambiance,plan_cut), Boucle, Take
  routes/
    video.py               # upload + découpe ffmpeg
    transcription.py       # Whisper (extrait audio WAV avant transcription)
    clips.py               # CRUD clips + thumbnails + status + boucles + fps
    export.py              # SRT / ASS / DetX / Croisillé / MP4 / GIF / MP3 / WAV
    meme.py                # génération memes (image/GIF)
    files.py               # upload vidéos source
    plex.py                # intégration Plex
    takes.py               # prises d'enregistrement (recording)
  services/
    ffmpeg_service.py      # extract_segment, extract_thumbnail, export_gif, burn_subtitles, probe_fps
    whisper_service.py     # transcribe_segment (singleton model)
    subtitle_service.py    # export_srt, export_ass, export_detx (pro BR), export_croisille
    clip_service.py        # store clips + update_boucles + update_fps
    br_renderer.py         # rendu bande rythmo (font: atkinson/lisible/cursive/inter/jetbrains)
    detection.py           # classify_char() — classifieur phonétique BR pro (miroir de detection.js)
    plex_service.py        # client Plex
    take_service.py        # store prises
  fonts/
    AtkinsonHyperlegible-Bold.ttf
    Caveat.ttf
    Inter.ttf
    JetBrainsMono-Bold.ttf
    ShantellSans.ttf       # ← à bundler si dispo (lisible = manuscrite lisible)

frontend/src/
  App.jsx                  # top bar + nav rail + routing sections
  Icons.jsx                # set SVG unifié (Icon, ICONS)
  SettingsContext.jsx      # contexte préférences (accent, BR style, densité)
  detection.js             # classifyChar() + SIGN_KINDS + DEFAULT_SIGN_TOGGLES (miroir de detection.py)
  components/
    Sidebar.jsx            # nav rail: Importer / Mes Clips / Memes / Réglages
    ImportSection.jsx      # upload + timeline drag-to-create multi-clips
    VideoEditor.jsx        # éditeur clip
    TimelineBar.jsx        # timeline zoom + minimap
    VideoPlayer.jsx        # player custom réutilisable
    ClipsLibrary.jsx       # grille clips + filtres status
    ClipCard.jsx           # card: thumbnail, rename, Doubler / ▶ / MP3 / GIF / ✕
    DubbingWorkspace.jsx   # BR pro: SMPTE, détection layer, START/BIP/PI, boucles, auto-save 1.5s
    SubtitleEditor.jsx     # tableau timecode + personnage + texte
    RecorderPanel.jsx      # enregistrement, take queue, A/B compare
    ExportPanel.jsx        # SRT / ASS / DetX / Croisillé / MP4+BR / GIF / MP3 / WAV
    MemeGenerator.jsx      # générateur memes
    Preferences.jsx        # réglages (accent, BR style, densité)
    PlexBrowser.jsx        # navigation bibliothèque Plex
```

## Bugs connus
- BR décalée ~1s après audio — cause probable: pré-roll AAC à l'extraction segment (`-ss` avant `-i` = snap keyframe). Fix à confirmer: `-ss` après `-i`. Slider `brOffset` (-2s à +2s) = échappatoire user.
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
```

### Clip (colonnes ajoutées)
```python
fps  REAL  # frame rate source détecté via ffprobe à l'import (PAL=25 défaut)
```

### Boucle (table créée)
```python
id, clip_id FK, number INT, start FLOAT, end FLOAT
# PUT /api/clips/{id}/boucles — remplace tout le tableau
```

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

### Fait
- Import timeline drag-to-create multi-clips + zoom/minimap + source URL
- Préférences (accent, BR style, densité) + SettingsContext
- Enregistrement: RecorderPanel, take queue, A/B compare
- ClipsLibrary refonte (filtres status, cards)
- Set d'icônes SVG unifié (Icons.jsx)
- Export MP3/WAV
- VideoPlayer custom (composant)
- Intégration Plex (PlexBrowser + route)
- Générateur de memes
- **BR Pro (session 2026-05-30)** : SMPTE fmtTC, détection layer (signes phonétiques), START/BIP/PI, boucles, line flags (off/dos/ambiance/plan_cut), Clip.fps, DetX pro (signes + fps + flags), Croisillé, police Shantell lisible

### Priorité haute — prochaine session

#### Bug délai BR ~1s
- `-ss` déjà passé après `-i` dans extract_segment (fix appliqué) — vérifier en production

#### Édition manuelle des signes de détection
- Clic sur une lettre dans le canvas → cycle signe (null → labiale → semi → … → null)
- Persisté dans `words[].signs` via auto-save

#### Phase 2 : burn détection dans MP4
- `br_renderer.py` `_draw_signs()` miroir du canvas (graphite, mêmes géométries)
- Flag `detection_burn` déjà câblé jusqu'au backend, no-op pour l'instant

#### Whisper — config langue
- UI pour choisir la langue de transcription par clip

#### UI polish
- Conteneur sous-titres redimensionnable (right pane Doublage)

### Priorité moyenne

#### Gestion utilisateurs
- Auth (JWT ou session)
- Chaque user gère son contenu
- Multi-user support

### Priorité basse — long terme

#### Intégrations tierces
- **Stremio** : API Stremio locale pour lire vidéos
- **qBittorrent** : Web UI API → télécharger → importer automatiquement
