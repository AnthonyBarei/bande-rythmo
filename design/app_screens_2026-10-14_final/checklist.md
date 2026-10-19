# Feature checklist — REDESIGN_ADOPTION_HANDOFF.md §4 (final acceptance pass)

Run headless at 1440×900 by `design/app_screens_2026-10-14/final/checklist.py <repo> <out> --mock-states --port 9824`
(Chrome with a fake microphone; `--mock-states`: every non-GET `/api/` request is answered locally — mocked job ids
or 503 — so nothing was written to the backend; GETs read the real data). Raw results: `checklist.json`.

**Result: 40 pass · 1 pass (visual) · 2 not-testable-headless · 1 n/a · 1 info · 0 fail.**

## Bibliothèque

| # | Item | Result | Evidence |
|---|---|---|---|
| L1 | grille de clips | ✅ pass | 12 cartes |
| L2 | badges de statut (À faire/Doublage/À revoir/Validé) | ✅ pass | badges sur cartes ['À FAIRE', 'DOUBLAGE'] · onglets ['À faire', 'Doublage', 'À revoir', 'Validé'] |
| L3 | recherche | ✅ pass | « pote » → 1/12 cartes |
| L4 | sélecteur de projet | ✅ pass | options ['Tous les projets', 'Bad Ass', 'Sans projet'] |
| L5 | tri (Select) | ✅ pass | [['Nom A→Z', True], ['Durée', True], ['Statut', True]] |
| L6 | rangée d'actions au survol (Doubler/mic/MP3/GIF/corbeille) | ✅ pass | visible · Doublage / Enregistrer — Studio / Exporter MP3 — audio uniquement / Créer un GIF depuis ce clip (Atelier) / Supprimer |

## Importer

| # | Item | Result | Evidence |
|---|---|---|---|
| I1 | onglets source Fichier / Plex / URL | ✅ pass | présents: Fichier local, Plex, URL / Stream |
| I2 | sélecteur flux vidéo + piste audio | ✅ pass | preuve r4_import_proofs --import-proof : import/01-import.png (2 tailles) — FLUX DÉTECTÉS · Vidéo H264 1918x800 · Audio AAC (ffprobe) |
| I2b | note remux 5.1 → stéréo | ⏸ not-testable-headless | nécessite une source multicanal + un job de remux (POST /api/files/remux) — non exercé |
| I3 | timeline zoomable + minimap | ✅ pass | zoom 1.0× → 1.5×; minimap visible sur import/01-import.png (barre jaune sous la piste) |
| I4 | renommage inline des clips en attente (pas de champ nom global) | ✅ pass | {"input":true,"focused":"Nom du clip…"} |
| I5 | Ctrl+S crée le lot | ✅ pass | requêtes tentées (bloquées par les mocks) : ['POST /api/clips/batch-local-job'] |
| I6 | Plex : connexion (token) + navigateur de bibliothèque | ✅ pass | onglet Plex rendu (serveur 192.168.1.5:32400) ; la navigation lit le vrai serveur Plex (GET) — IMPORTER · Choisir un fichier dans Plex · Fichier local, bibliothèque Plex ou URL directe · Fichier local · glisser un .mp4 · Plex · bibliothèque locale · URL / |

## Éditeur

| # | Item | Result | Evidence |
|---|---|---|---|
| E1 | vidéo + chip TC SMPTE + bascule VO/Proxy | ✅ pass | {"video":true,"tc":true,"vo":true,"proxy":true} |
| E2 | sous-titre incrusté dans le player | ✅ pass | overlay « Ça y est, ça roule ? » (Affichage → Toujours, réglage local) |
| E3 | transport : image par image, vitesse 0.5–2×, scrub | ✅ pass | +1 image → 0.040s · vitesse 1.5× · scrub 50% → 33.2/66.5s |
| E4 | barre timeline-nav (waveform + blocs + boucles + fenêtre) | ✅ pass | canvas [973, 56] — contenu visible sur editor/01-editor.png |
| E5 | bande : menu contextuel (clic droit) | ✅ pass | ['Éditer le texte', 'Couper ici (00:00:00:13)', 'Dupliquer après', 'Aller au début (00:00:00:05)', 'Aller à la fin (00:00:01:10)', 'Supprimer'] |
| E6 | bande : texte élastique, police manuscrite, marqueurs d'étirement, START/BIP/PI, boucles, PLAN, détection | 👁 pass (visual) | rendu canvas (pixels) : vérifié visuellement sur editor/01-editor.png et studio/*.png ; non assertable dans le DOM |
| E7 | bande : maintien-glisser (scrub), double-clic édition, clic-lettre détection | ⏸ not-testable-headless | gestes souris sur le canvas qui modifient les répliques (autosave PUT) — non exercés pour ne rien écrire |
| E8 | barre d'outils en clusters (édition · insertion · drapeaux + Plans · note · détection · police · verrou · zoom) | ✅ pass | présents: Ajouter une réplique, Couper, Boucler la sélection, Resp., Réact., État de la réplique, Plans, Note de direction, Calque détection, Manuscrite, Verrouiller, Zoom arrière, Zoom avant, Affichage |
| E9 | annuler / rétablir | ✅ pass | [['Annuler (Ctrl+Z)', True], ['Rétablir (Ctrl+Y)', True]] (désactivés tant qu'aucune édition : infobulle portée par le wrapper) |
| E10 | menu Sous-titres (Transcrire / import SRT·ASS·VTT / export) | ✅ pass | [['Transcrire', True], ['Importer SRT', True], ['Exporter les sous-titres', True]] |
| E11 | onglets inspecteur Répliques · Voix · Détection · Boucles · Lexique | ✅ pass | [['Répliques', True], ['Voix', True], ['Détection', True], ['Boucles', True], ['Lexique', True]] |
| E12 | Voix : distribution + réassignation | ✅ pass | [['Nouveau personnage', True], ['Réassigner le personnage', True]] |
| E13 | Détection : signes + affichage mot par mot | ✅ pass | [['Labiale', True], ['Semi-fermée', True], ['Fricative', True], ['Arrondie', True], ['Ouverte', True], ['Rendu mot par mot', True], ['Aide auto', True]] |
| E14 | Lexique : termes + Traduire auto | ✅ pass | [['Traduire auto', True]] (désactivé sans fournisseur DeepL/LibreTranslate) |

## Exporter

| # | Item | Result | Evidence |
|---|---|---|---|
| X1 | formats groupés (Vidéo BR / Sous-titres + ASS karaoké / DetX + Croisillé / Audio) | ✅ pass | [['VIDÉO BANDE RYTHMO', True], ['SOUS-TITRES', True], ['DOCUMENTS STUDIO', True], ['AUDIO', True], ['ASS Karaoké', True], ['DetX', True], ['Croisillé', True], ['MP4 + BR', True], ['MP4 doublé', True], ['Dubpack', True], ['MP3', True]] |
| X2 | plage personnalisée (Plage) | ✅ pass | {"chips":["IN 00:00:00:00","OUT 00:01:06:11"],"sliders":2} |
| X3 | incrustation détection OFF par défaut | ✅ pass | aria-checked=false |
| X4 | file de téléchargement : progression + re-téléchargement par ligne | ✅ pass | job mocké en cours (['POST /api/export/mp4-job']) · 8 boutons Télécharger (historique réel, GET) |

## Studio

| # | Item | Result | Evidence |
|---|---|---|---|
| S1 | micro + vumètre live | ✅ pass | Micro · Fake Default Audio Input (faux périphérique Chrome) ; vumètre = StageMeter (barres sous la bande) |
| S3 | file des prises | ✅ pass | 3 prises (mockées) |
| S4 | comparaison A/B | ✅ pass | barre A/B affichée (basculer · Tab) |
| S5 | valider la prise | ✅ pass | présents: Valider la prise sélectionnée |
| S2 | pré-roll (R lance le décompte, R l'annule) | ✅ pass | réplique 4 / 51 : pré-roll affiché=True · retour au repos=True (aucune prise créée) |

## Atelier

| # | Item | Result | Evidence |
|---|---|---|---|
| A1 | modes Meme / GIF / Audio | ✅ pass | présents: Image, GIF, Audio |
| A2 | lecteur IN-OUT partagé | ✅ pass | {"video":1,"inout":2} |
| A3 | éditeur de meme : calques (ajout / réordonner / dupliquer / décaler aux flèches) | ✅ pass | calques 2 → ajouter 3 → dupliquer 4 · Monter/Descendre=True · décalage flèches (nudgeLayer) non assertable sans canvas |

## Activité

| # | Item | Result | Evidence |
|---|---|---|---|
| V1 | centre des jobs : en cours (progression + annuler) / échecs (réessayer) / terminé (re-télécharger) | ✅ pass | {"enCours":true,"annuler":true,"echecs":true,"retry":true,"termine":true,"redl":10} (jobs mockés) |
| V2 | accessible depuis la barre du haut | ✅ pass | bouton Activité de la top bar |

## Réglages

| # | Item | Result | Evidence |
|---|---|---|---|
| R1 | pastilles d'accent (changement live) | ✅ pass | --accent #f5c518 → #5AA9F0 → #F5C518 (localStorage du profil headless jetable) |
| R2 | style BR, densité, Whisper modèle + langue, Plex, défauts export, police perso, séparation vocale, traduction | ✅ pass | [['Style de bande rythmo', True], ['Densité', True], ['Modèle', True], ['Langue par défaut', True], ['Connexion Plex', True], ['Incruster la détection (MP4)', True], ['Police personnalisée', True], ['Séparation vocale', True], ['Auto-traduction', True]] |
| R3 | moteur Whisper | — n/a | pas de régression : le backend n'utilise que faster-whisper (jamais sélectionnable, y compris sur main) ; le contrôle de la référence est un no-op |
| R4 | GPU (défaut d'export) | ℹ info | le choix GPU vit dans Exporter › options (encodeurs détectés), pas dans Réglages |

## Not testable headlessly — why

- **I2b** remux note 5.1 → stéréo: needs a multichannel source and a server remux job (`POST /api/files/remux`), i.e. a real write + ffmpeg run. The code path ("Préparation audio" job, `plex-remux` in Activité) is unchanged since R3.
- **E7** band hold-drag scrub, double-click edit, click-a-letter détection: these gestures edit répliques and trigger the autosave `PUT`; not exercised so the real clip stays untouched. The canvas engine, drag math and hit-testing were moved, not rewritten (`components/band/`, R5: pixel-identical before/after).
- **E6** band rendering (elastic per-word text, Caveat, stretch markers, START/BIP/PI, boucles, PLAN, détection signs): canvas pixels, checked on the captures (`editor/01-editor.png`, `studio/*.png`) rather than in the DOM.
- Recording a real take, validating a take, real exports/re-downloads: writes — exercised only up to the mocked request (pré-roll start/cancel, MP4 job mocked, `Ctrl+S` batch request blocked).

## Notes

- **R3** Whisper engine: the backend only runs faster-whisper; no engine setting ever existed in the app (also absent on `main`). The reference's "Moteur" Segmented is a no-op, so nothing was lost.
- **R4** GPU: the export-default GPU toggle lives in Exporter › options and appears only when NVENC/QSV/AMF is detected (`/api/export/hw-encoders` → none on this machine).
- **S2** the first réplique starts at 0.05 s, so its pré-roll has no lead (recording starts immediately; the take upload was blocked by the mocks in an earlier run). The check runs on réplique 4.
