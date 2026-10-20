# Studio v2 — preuves (1440×900)

Brief : `../design_handoff_redesign_v2/STUDIO_V2.md` § « Proof for next round ».

| Fichier | État |
|---|---|
| `studio/13-role-menu.png` | menu rôle ouvert (progression, comédien, 1–9) |
| `studio/14-pret.png` | prêt : image figée, texte de la réplique |
| `studio/15-decompte.png` | décompte : chiffre, image et bande à la même image que 14 |
| `studio/15-decompte-tc-0..3.png` + `.json` | puce TC à 0,5 s d'intervalle pendant le décompte — le TC ne bouge pas |
| `studio/16-elan.png` | élan : barre qui se vide vers le départ |
| `studio/17-revue-next-pret.png` | après Valider : réplique suivante en prêt, rien ne joue |
| `studio/18-continu-rec.png` | En continu : liste des répliques en direct |
| `studio/19-continu-summary.png` | carte de résumé après arrêt |

Reproduire (Chrome headless, micro factice de Chrome, prises simulées dans la page — rien n'est écrit) :

```
backend/venv/Scripts/python.exe design/studio_v2_proofs/shoot_studio_v2.py design/studio_v2_proofs --app http://localhost:5173/
```
