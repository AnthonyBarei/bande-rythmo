# Full UX review — Bande Rythmo

> **Reading order:** this is the **app-wide** review. The per-page deep dives live in `DOUBLAGE_IA_REVIEW.md` (Doublage) and `MEME_PLEX_HANDOFF.md` (Meme + Plex). Feature behaviour is in `PRO_BR_HANDOFF.md`. Visual companions on the canvas: section **"Revue UX"** (journey map + heuristic scorecard).

Severity: 🔴 Bloquant · 🟡 Friction · 🟢 Polish.

---

## 1. The core journey

`Importer → Découper → Mes clips → Doubler (transcrire + BR) → Exporter`

It's a clean linear loop and the spine is sound. Friction, by step:

| Step | Issue | Sev |
|---|---|---|
| Importer | Remux of a chosen audio track can take **up to 3 min** (hard timeout) with only a "⏳ Remux…" label. | 🟡 |
| Découper | Drag-to-create + zoom + inline rename already specified. | 🟢 |
| Mes clips | Status lifecycle (todo→done) drives the filters but isn't explained or obviously editable. | 🟡 |
| Doubler | **Whisper runs 10–60s with a bare spinner** — no progress, no cancel. Toolbar density (covered in IA doc). | 🔴 |
| Exporter | **MP4 burn-in 30–60s with no progress** and the UI is effectively blocked. | 🔴 |

---

## 2. The #1 problem — no feedback on long operations

Three operations are slow and all three under-communicate:

- **Whisper transcription** — `transcribe()` sets a spinner (`◉ ...`) and awaits. No percentage, no segment count, no cancel. On a long clip or CPU-only machine this *looks frozen*.
- **MP4 burn-in export** — 30–60s per `CLAUDE.md`; same bare-spinner pattern.
- **Plex remux** — up to a 3-minute timeout; only "⏳ Remux…".

**Recommendation (🔴, do before dev):** a shared **progress surface** — determinate where possible (Whisper can report segment N/total; ffmpeg can parse `-progress`), staged otherwise ("Extraction audio → Transcription → Mise en forme"). Always offer **Annuler**. Mock on the canvas (journey artboard) shows the target toast: labelled, %-bar, ETA, cancel.

---

## 3. App-wide heuristic pass (Nielsen)

| Heuristic | Score | Finding | Sev |
|---|---|---|---|
| Visibility of system status | 2/5 | Save status good; long ops invisible | 🔴 |
| Match to real world | 4/5 | Pro vocabulary is accurate and welcome | 🟢 |
| User control & freedom | 2/5 | No cancel on long tasks; no undo in BR editing | 🔴 |
| Consistency & standards | 3/5 | Contextual nav is fine; two video players + duplicated transport | 🟡 |
| Error prevention | 3/5 | BR lock toggle ✓; deletes (clip, réplique) are unconfirmed | 🟡 |
| Recognition vs recall | 3/5 | Powerful but **hidden** gestures (shift-drag loop, alt-drag dup, ctrl-wheel zoom, click-letter détection) | 🟡 |
| Flexibility & efficiency | 4/5 | Rich keyboard map, good accelerators | 🟢 |
| Aesthetic & minimalist | 3/5 | Band toolbar density (reorg specified) | 🟡 |
| Error recovery | 3/5 | Clear French messages; no one-click retry | 🟡 |
| Help & documentation | 2/5 | No shortcuts overlay, no first-run guidance | 🔴 |

---

## 4. Cross-page consistency

- **Navigation model (source of truth = real app).** Sidebar is **Importer · Mes Clips · Memes · Réglages**. Doublage is reached *contextually* (open a clip → Doubler), which is correct — **do not add a Doublage nav item.** (The design mocks show one for layout convenience; the real nav wins.) Keep the `WHISPER · BASE` model indicator at the rail foot — it's a nice touch; make it a click target into Réglages.
- **Réglages page** exists in nav but has no design yet — needs at least: Whisper model + default language, Plex connection, export defaults, theme/accent. Worth one artboard before dev.
- **Two video players.** Doublage uses a custom transport; Meme Image-mode uses a single scrubber; Meme GIF/Audio use a range player. **Promote one reusable `<VideoPlayer>`** (the handoff already calls for this) so transport, shortcuts, and styling are identical everywhere.
- **Toasts** are consistent (bottom-right, 3s) — good. Reuse the same component for the new progress surface.

---

## 5. Discoverability

The app is deep but quiet about it. Add:
- A **`?` shortcuts overlay** (the `Raccourcis` button exists in the header — wire it to a real modal listing the full key map from `PRO_BR_HANDOFF.md` §7).
- **Hover/first-use hints** for the canvas gestures (a one-line coachmark the first time the user opens a BR: "glisser pour créer · shift-glisser pour boucler · clic sur une lettre pour la détection").
- An optional **first-run path**: empty Clips → a single primary CTA "Importer une vidéo" (the empty state exists; make its CTA a real button, not just text).

---

## 6. Error prevention & recovery

- **Confirm destructive actions.** Deleting a clip (assets + subtitles) and deleting a réplique are immediate. Add a confirm (or an **undo toast** — "Réplique supprimée · Annuler", which fits the existing toast system better than a dialog).
- **One-click retry** on failed Whisper / export / remux instead of re-driving the whole flow.
- **Guard the 3-min remux** with a visible countdown + a "changer de piste" escape, not just a silent timeout.

---

## 7. Accessibility & ergonomics

- **Hit targets.** Band-toolbar buttons are ~30px; some inline `×`/chevrons are smaller. Floor at 32px for pointer targets.
- **Contrast.** `--text3 #6…` on `--surface` is borderline for body text; reserve it for non-essential meta only.
- **Focus states.** Custom buttons rely on hover; add visible `:focus-visible` rings for keyboard users.
- **Color-only meaning.** Character tracks are distinguished by color alone — keep the name chip/letter alongside (the BR already does; carry it into any new legend/filter UI).

---

## 8. What's already strong (keep)

- Auto-save with a clear status pill.
- Rich, professional keyboard model.
- Honest empty states with the right copy.
- Status-based clip filtering — a genuinely useful spine, just needs to be made visible.
- Consistent toast system and accent-driven theming.

---

## 9. Priorities before handoff

1. 🔴 **Progress + cancel** for Whisper, MP4 burn, remux (shared surface).
2. 🔴 **Shortcuts overlay** + light first-run guidance.
3. 🔴 **Undo/cancel** in BR editing (or undo-toasts for deletes).
4. 🟡 **One `<VideoPlayer>`** across Doublage + Meme.
5. 🟡 **Explicit, clickable status lifecycle** on clip cards.
6. 🟡 Confirm/undo destructive deletes; one-click retry on failures.
7. 🟢 Design the **Réglages** page; focus-visible rings; hit-target floor.

Then the two refinement docs (Doublage IA, Meme/Plex) and the feature handoff complete the package.
