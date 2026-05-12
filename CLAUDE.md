# Bande Rythmo — CLAUDE.md

## Stack
- **Frontend**: React + Vite (port 5173)
- **Backend**: FastAPI + uvicorn (port 8000, `127.0.0.1` — not `localhost` for Vite proxy)
- **Transcription**: openai-whisper, modèle `base`, local/offline
- **Vidéo**: ffmpeg-python
- **Sous-titres**: pysrt + export custom (SRT, ASS, MP4, GIF)

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
  main.py                  # FastAPI app, static mounts
  routes/
    video.py               # upload + découpe ffmpeg
    transcription.py       # Whisper
    clips.py               # CRUD clips + thumbnails
    export.py              # SRT / ASS / MP4 / GIF
  services/
    ffmpeg_service.py      # extract_segment, extract_thumbnail, export_gif, burn_subtitles
    whisper_service.py     # transcribe_segment (singleton model)
    subtitle_service.py    # export_srt, export_ass (multi-track par personnage)
    clip_service.py        # JSON store → clips.json

frontend/src/
  App.jsx                  # layout sidebar + routing sections
  components/
    Sidebar.jsx            # nav: Importer / Mes Clips / Doublage
    ImportSection.jsx      # upload vidéo
    VideoEditor.jsx        # player + timeline + IN/OUT + découpe immédiate
    TimelineBar.jsx        # timeline cliquable, segments visuels
    ClipsLibrary.jsx       # grille clips + actions
    ClipCard.jsx           # card: thumbnail, rename, Doubler / GIF / Supprimer
    DubbingWorkspace.jsx   # tabs: Sous-titres / BR / Exporter, auto-save 1.5s
    SubtitleEditor.jsx     # tableau timecode + personnage + texte
    RythmoPreview.jsx      # Canvas multi-piste droite→gauche + curseur sync
    ExportPanel.jsx        # SRT / ASS / MP4+BR / GIF
```

## Bugs connus
- BR décalée ~1s après audio — à investiguer (offset Whisper ? RAF Canvas ? ffmpeg segment ?)
- Vite proxy doit cibler `http://127.0.0.1:8000` (pas `localhost`) — Windows IPv6

## Roadmap

### Priorité haute — prochaine session

#### Page BR unifiée (style VoxDub)
- Une page combinée : sous-titres + player + bande rythmo
- Outils : ajouter répliques, personnages, couleurs, déplacer/redimensionner
- Cuts, pauses, durées variables
- Incrustation sous-titres directement sur le player (pas en dessous)
- Référence : **VoxDub**

#### Player custom
- Remplacer `<video controls>` natif par player custom ou lib
- Player sur page import ET bande rythmo
- Afficher sous-titres incrustés en temps réel

#### Import — multi-clips avant save
- Permettre de créer N clips avant de sauvegarder
- Bouton "Créer clips" + raccourci **Ctrl+S**
- Notification après → rediriger vers Clips
- Sauvegarder vidéo source sur backend seulement si nécessaire
- Si vidéo source sauvegardée : afficher liste sur page import

#### Clips — nouvelles options
- Export **audio only** (MP3/WAV) — StreamDeck, Discord, soundboards
- Vue clip sans doublage (lecture simple)
- Implémenter tous les exports correctement

#### Bug délai BR ~1s
- Reproduire, mesurer, corriger
- Investiguer : offset timestamps Whisper, latence Canvas RAF, décalage ffmpeg

#### Whisper — config langue
- UI pour choisir la langue de transcription par clip
- Tester faster-whisper / whisper.cpp pour vitesse
- Paramètre configurable par utilisateur

### Priorité moyenne

#### Gestion utilisateurs
- Auth (JWT ou session)
- Chaque user gère son contenu
- Multi-user support

### Priorité basse — long terme

#### Intégrations tierces
- **Plex** : lire bibliothèque locale, auto-detect `localhost:32400`, sinon setup manuel
- **Stremio** : API Stremio locale pour lire vidéos
- **qBittorrent** : Web UI API → télécharger → importer automatiquement
