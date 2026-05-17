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
  database.py              # SQLite init + accès
  routes/
    video.py               # upload + découpe ffmpeg
    transcription.py       # Whisper (extrait audio WAV avant transcription)
    clips.py               # CRUD clips + thumbnails + status
    export.py              # SRT / ASS / MP4 / GIF / MP3 / WAV
    meme.py                # génération memes (image/GIF)
    files.py               # upload vidéos source
    plex.py                # intégration Plex
    takes.py               # prises d'enregistrement (recording)
  services/
    ffmpeg_service.py      # extract_segment, extract_thumbnail, export_gif, burn_subtitles
    whisper_service.py     # transcribe_segment (singleton model)
    subtitle_service.py    # export_srt, export_ass (multi-track par personnage)
    clip_service.py        # store clips
    br_renderer.py         # rendu bande rythmo
    plex_service.py        # client Plex
    take_service.py        # store prises

frontend/src/
  App.jsx                  # top bar + nav rail + routing sections
  Icons.jsx                # set SVG unifié (Icon, ICONS)
  SettingsContext.jsx      # contexte préférences (accent, BR style, densité)
  components/
    Sidebar.jsx            # nav rail: Importer / Mes Clips / Memes / Réglages
    ImportSection.jsx      # upload + timeline drag-to-create multi-clips
    VideoEditor.jsx        # éditeur clip
    TimelineBar.jsx        # timeline zoom + minimap
    VideoPlayer.jsx        # player custom réutilisable
    ClipsLibrary.jsx       # grille clips + filtres status
    ClipCard.jsx           # card: thumbnail, rename, Doubler / ▶ / MP3 / GIF / ✕
    DubbingWorkspace.jsx   # tabs: Sous-titres / BR / Exporter, auto-save 1.5s
    SubtitleEditor.jsx     # tableau timecode + personnage + texte
    RecorderPanel.jsx      # enregistrement, take queue, A/B compare
    ExportPanel.jsx        # SRT / ASS / MP4+BR / GIF / MP3 / WAV
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
- **`shutter`** (0..1, défaut 0.4) : largeur de la fenêtre de flou (angle
  d'obturateur). 1.0 = smear max, 0.5 = cinéma 180°, plus bas = texte net mais
  léger risque de micro-saccade. 0.4 = compromis net/lisse retenu.
- **Intermédiaire FFV1 RGB sans perte** (`.mkv`) : un seul encodage avec perte
  (l'overlay final), pas de sous-échantillonnage chroma sur le texte.
- **`-bf 0`** (pas de B-frames) : évite le smear/ghosting sur le texte mobile.
- **Overlay : forcer `fps={export_fps}` sur LES DEUX entrées** avant `overlay`
  (`[0:v]fps=60[bg];[1:v]fps=60[s];[bg][s]overlay`). Sinon framesync apparie
  mal les deux flux (timebases différentes) et ~1/3 des images BR 60 fps
  sortent en doublon → le défilement saccade même si la strip est vrai 60 fps.
  Le faire sur la seule image de fond ne suffit pas.
- **`-r {export_fps}`** en sortie : force le CFR, supprime le judder sur source VFR.
- **Pas de waveform synthétique** dans l'export : c'était du faux signal
  (`math.sin`), du bruit haute fréquence qui mangeait le débit et brouillait
  le texte. L'export reste propre (texte + curseur + séparateurs + labels).
- **Police haute lisibilité** : Atkinson Hyperlegible / Inter / JetBrains Mono
  embarquées dans `backend/fonts/`, choisies via le picker `brFont` (transmis
  par `ExportRequest.br_font`) → export WYSIWYG avec l'aperçu.
- **Contour noir** (`stroke_width`) autour des glyphes : lisibilité sous flou
  de mouvement et compression h264.
- **Taille de police proportionnelle à `track_h`** (~0.58) : gros texte qui
  remplit la hauteur de piste, lisible de 1080p à 4K (style VoxDub).
- **`scaleX` sans plancher dur** (min 0.05) : le texte est compressé/étiré pour
  remplir exactement son bloc — jamais coupé au bord. Compression extrême =
  réplique trop courte (problème de timing, pas d'affichage).
- **Zoom par défaut `pxPerSec` = 240** : blocs assez larges pour que le texte
  ne soit pas trop compressé au zoom par défaut.

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

### Priorité haute — prochaine session

#### Bug délai BR ~1s
- Reproduire, mesurer, corriger
- Tester fix: déplacer `-ss` après `-i` dans extract_segment

#### Page BR unifiée (style VoxDub)
- Une page combinée : sous-titres + player + bande rythmo
- Outils : ajouter répliques, personnages, couleurs, déplacer/redimensionner
- Cuts, pauses, durées variables
- Incrustation sous-titres directement sur le player (pas en dessous)
- Référence : **VoxDub**

#### Whisper — config langue
- UI pour choisir la langue de transcription par clip
- Paramètre configurable par utilisateur

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
