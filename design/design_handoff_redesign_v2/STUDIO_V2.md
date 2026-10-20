# STUDIO v2: role, recording mode, countdown

**The design reference is `reference/redesign/screen-studio.jsx`** (open `reference/redesign.html` → Studio). It's a working mock of every state below, with keyboard shortcuts. `screen-record-export.jsx` was split: Export now lives in `screen-export.jsx`.

Scope: the Studio screen only (`StudioScreen` + `components/studio/*`). Keep the shared band renderer, the takes column, A/B, Écouter sur l'image and the R7/R8 navigation. Every new string is in French, every timecode is SMPTE, and only primitives from `ui.jsx` are used.

## 1. Choosing the role

The role is implied by the current réplique today. Make it an explicit choice.

- **The role picker sits in the stage header** and replaces the static avatar + name on the left.
  - It's a `Select`-style button: avatar, name, ▾, and `1/30` in mono `text3`.
  - The menu lists every character with its avatar, its colour, `n/total validées`, and the comédien name in `text3` if set.
  - There's a ✓ on the current role and a `1`–`9` hint on the right.
- **Shortcuts:** `1`–`9` switch role (guarded while typing). `C` opens the menu.
- **Effects of choosing a role:**
  - ←/→ only step through that role's répliques. Alt+←/→ still steps through all of them.
  - The band dims the other tracks (R6 character focus).
  - The progress label, the "toutes validées" toast and the A/B bar all follow the role.
  - Switching role jumps to that role's **first unvalidated** réplique (or the first réplique if all are done).
- **Persistence:** the last role is saved per clip. Arriving from the Éditeur with a réplique selected sets the role to that réplique's character.
- **Under the picker,** a single line reads `Comédien : <name>`, an editable `Input` (moved from where it sits today).

## 2. Recording mode

Put a `Segmented` control in the stage header, to the right of the role picker: **Par réplique · En continu**. Save it per clip. The default is Par réplique.

### Par réplique (current, plus §3)
One take per réplique, as now.

### En continu
The actor records the whole role in one pass, and the app splits the result into one take per réplique.

- **Range:**
  - Default: from the current réplique to the role's last réplique.
  - A small `Menu` next to the Segmented offers: `Depuis la réplique courante` · `Tout le clip` · `Plage IN/OUT…`. The last option reuses the Importer TC chips.
  - The selected range is shown on the band as a dim accent band on the ruler.
- **During recording:**
  - Playback runs continuously through the range, with REC on throughout.
  - The current réplique highlights as the playhead crosses it. The line strip text updates without the slide animation.
  - The takes column is replaced by a live list of the range's répliques: ● while recording, ✓ when passed.
- **`Espace` pauses:**
  - Recording and playback stop.
  - Resuming runs the full countdown (§3) and restarts from **the start of the réplique that was interrupted** minus the lead. The partial capture of that réplique is discarded.
- **`Échap` stops:** the répliques already passed are kept and the rest are skipped. Nothing is created for a réplique whose capture is incomplete.
- **Splitting (client-side, from the one recording):**
  - Each réplique gets the slice `[start − 0.25s, end + 0.35s]`, clamped so slices don't overlap a neighbour by more than 0.1s.
  - Each slice is added as a new take `Prise n` with the tag `continu` (a neutral `Chip`).
  - **Existing validated takes are never replaced.**
- **After stop, a summary card sits on the stage:**
  - `21 prises créées · Red`
  - Buttons: `Valider les répliques sans prise validée` (primary), `Revoir réplique par réplique` (switches to Par réplique on the first réplique of the range), `Annuler la session` (deletes the created takes, then confirms with a toast that offers Annuler).
- **Écoute:** during En continu the other roles' VO plays at the "VO pendant l'écoute" level. The current role's VO is always muted.

## 3. Countdown and preparation

**Current problem:** playback (and the band) starts during the 3-2-1, and in line mode the next réplique plays straight away.

**The fix:**
- Playback starts only when the countdown ends.
- The actor always gets a held, ready state before a réplique.

### Phase model (both modes)
`prêt → décompte → élan → rec → queue → revue`

| Phase | Image / band | Audio | UI |
|---|---|---|---|
| **prêt** | Frozen on the frame at `start − élan`; band static at that position | Silence | Large line text (Caveat, 28px) over the bottom of the image; label `Prêt · R pour lancer` |
| **décompte** | Still frozen; nothing moves | One bip per second; the last bip is higher | Big number overlay (existing style) + the line text + `Échap annuler` |
| **élan** | Playback starts at `start − élan` | VO of other roles plus room tone; mic captures (lead trimmed later) | Accent bar draining to the start mark; `REC dans 0.8s` |
| **rec** | Plays through the réplique | Mic | Existing REC overlay + counter |
| **queue** | Plays to `end + 0.6s`, then stops | Mic | `Fin de prise…` |
| **revue** | Frozen on the réplique's last frame | Silence | Take added, focus on it; Valider / Refaire |

- `Échap` during **décompte** or **élan** cancels. No take is created, and the state goes back to **prêt** at the same frame.
- `R` / mic button in **prêt** starts **décompte**. In **revue** it means *Refaire*: it goes back to **prêt** (not straight into the countdown).

### After a take (Par réplique)
- **Validating moves to the next réplique of the role, which opens in prêt.** Nothing plays until the actor presses `R`.
- A new **Enchaînement** setting in Réglages › Studio has two choices:
  - `Manuel` (default): as above.
  - `Auto après 3s`: after Valider, a strip shows `Réplique suivante dans 3… · Espace pour attendre`. `Espace` stays in prêt; otherwise the countdown starts by itself.
- Without validating, ←/→ also always land in **prêt**.

### Settings (Réglages › Studio, plus a sliders `Popover` in the stage header)
- `Décompte`: 0 · 3 · 5 s (default 3). 0 skips straight to élan.
- `Élan avant réplique`: 0 · 1 · 2 · 3 s (default 1). This is how much image plays before the line. It replaces the current "Pré-roll 3s", which mixed the two ideas.
- `Bips`: on/off.
- `Enchaînement`: Manuel · Auto après 3s (Par réplique only).
- Change the header chip `Pré-roll 3s` to `3 · 1s` (décompte · élan). Clicking it opens the popover.

## 4. Shortcuts overlay (STUDIO section)
Add: `1–9` rôle · `C` choisir le rôle · `R` lancer / refaire · `Espace` pause (continu) / attendre (auto) · `Échap` annuler / arrêter.

## Proof for next round (`studio/`, 1440×900)
- `13-role-menu.png`: role menu open with progress and comédien
- `14-pret.png`: prêt state, frozen image, large line text
- `15-decompte.png`: number overlay, band and image at the same frame as in 14
- `16-elan.png`: draining bar
- `17-revue-next-pret.png`: after Valider, next réplique in prêt, nothing playing
- `18-continu-rec.png`: En continu, live réplique list
- `19-continu-summary.png`: summary card after stop
- A short screen recording (or 4 frames 0.5s apart) proving the timecode doesn't move during décompte
