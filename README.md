# Bande Rythmo

App web de création de bandes rythmo pour le doublage.

## Prérequis

- Python 3.10+
- Node.js 18+
- ffmpeg installé et dans le PATH
- (optionnel) GPU CUDA pour Whisper plus rapide

## Installation

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Lancement

### Backend (port 8000)

```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload
```

### Frontend (port 5173)

```bash
cd frontend
npm run dev
```

Ouvrir http://localhost:5173

## Workflow

1. **Video** — importer une vidéo, marquer IN/OUT, cliquer "Découper + Transcrire"
2. **Editor** — corriger les répliques et timecodes dans le tableau
3. **Preview** — visualiser la bande rythmo défilante synchronisée
4. **Export** — télécharger en SRT, ASS ou MP4 avec BR incrustée

## Notes

- Modèle Whisper `base` chargé au premier appel (~150MB, quelques secondes)
- Les fichiers uploadés sont stockés dans `backend/uploads/` et `backend/segments/`
- L'export MP4 utilise ffmpeg pour incruster l'ASS — peut prendre 30-60s selon la durée
