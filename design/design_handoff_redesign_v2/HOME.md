# HOME: landing page rework

The reference is `reference/home.html` (static HTML + CSS, with one canvas script). The screenshots are in `reference/assets/home/`.

**Goal:** the landing page uses the same visual language as the app, so the old orange, glows, grid background, marquee and stats row are removed.

## Tokens (same as the app)
- **Colours:**
  - Backgrounds: `bg` #0b0b0d, `bg2` #101013, `surface` #16161a, `surface2` #1c1c21.
  - Borders: #26262d / #32323b / #3f3f4a.
  - Text: #ECECEF / #A6A6AE / #7A7A85 / #565660.
  - **Accent: #F5C518.**
  - Character colours: LÉA #F5C518, MARC #5AA9F0, SARAH #F06AA0.
- **Fonts:** IBM Plex Sans (UI), JetBrains Mono (kickers, timecodes, kbd), Caveat (bande rythmo text and accent words only). No Inter, no Bebas.
- **Controls:**
  - Buttons: 44px high (36px for `sm`), radius 10, primary = accent on #0b0b0d.
  - Focus ring: 2px accent, offset 2.

## Structure
1. **Nav** (sticky, 64px, blurred `bg`): the logo tile and BANDE RYTHMO; anchor links (Comment ça marche · Fonctionnalités · Export), hidden below 860px; `Se connecter` (ghost) → `redesign.html#login` and `Créer un compte` (primary) → `#register`.
2. **Hero** (2 columns, 1 column below 900px):
   - The kicker "Atelier de doublage · local".
   - The H1 "Le doublage, à *la cadence* du studio.", with the emphasis in Caveat and the accent colour.
   - On the right: the lede, the CTAs (Créer un compte / Ouvrir l'atelier) and the note "Gratuit. Fonctionne aussi sans compte."
3. **Bande rythmo strip** (full width, 228px canvas):
   - 3 character tracks with their colours, the text stretched over each line's duration, and an SMPTE ruler.
   - The accent playhead sits at 30%, with the past dimmed.
   - A live TC chip top-right.
   - It loops over 18.6s. With `prefers-reduced-motion`, it shows a still frame.
4. **Product shot:** the Éditeur screenshot in a 16px-radius frame with a caption.
5. **Flux** (`#flux`): 4 steps as a tablist (Importer · Éditer la bande · Enregistrer · Exporter).
   - Only the selected step shows its description.
   - The screenshot on the right is sticky and fades in on change.
6. **Fonctionnalités** (`#atelier`): a 3-column grid (2 columns, then 1), with a top border per item, a line icon in the accent colour, a title and one sentence. There are no cards. Items: Whisper en local · Une piste par voix · Respirations et détection · Studio d'enregistrement · Raccourcis de cabine (with `kbd`) · Atelier mème et GIF.
7. **Export** (`#export`): format chips (colour dot + mono code + label): MP4+BR, GIF, SRT, ASS, DetX, Croisillé, MP3, WAV.
8. **Closing CTA:** "Prêt à doubler ?" in Caveat and the accent colour, one line of text, and the same 2 CTAs.
9. **Footer:** mono, `text4`, with Se connecter + Confidentialité.

## Notes
- **Copy:** use the French text from the reference, verbatim.
- **Screenshots:** they're placeholders, taken from the app captures. **Replace them with frames from footage you own** before the page goes public. Keep a 1440×900 ratio.
- **Layout:** fluid down to 360px. Nothing has a fixed width beyond `max-width: 1200px`.
- **The old home** is kept as `home-v1.html` for comparison only. Don't ship it.

## Proof
`home/01-home-1440.png` (full page), `02-home-900.png`, `03-home-390.png`, and `04-flow-step3.png`.
