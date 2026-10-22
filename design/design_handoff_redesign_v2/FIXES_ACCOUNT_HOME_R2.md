# HOME + ACCOUNT · round 2: review of `accounts_home_proofs`

**Verdict:** accepted. All 10 of your deviations are correct; keep them (reset screen, the neutral "lien envoyé" copy, inline e-mail change, the violet swatch, no city, forgot hidden without SMTP, the privacy page, "dans cet atelier", the <520px nav, local accounts as a display default).

This round has visual fixes only. The product questions are at the bottom and are waiting on the user.

## ⚠️ Fixes

1. **Home band TC chip overlaps the text** (`01`, `02`, `03`). At the right edge "Pas le temps." runs under `00:00:05:22 · 24 i/s`.
   - Move the chips into the ruler row, bottom-right, on a solid `bg` with a 1px `border2` border.
   - Or reserve the top 28px of the canvas for them, with the tracks starting below.
   - Below 520px, keep only the TC chip.
2. **Home flow screenshots are outdated** (`04`): the Studio one still shows "Pré-roll 3s". Recapture all 4 from the current app at 1440×900 (Importer with IN/OUT, Éditeur, Studio v2 in the *prêt* state, Exporter), **on footage you own or that is licensed**. The current stills come from a commercial film, so don't ship them on a public page.
3. **The logout icon** (`04-topbar-menu`): "Se déconnecter" uses a chevron. Add a `logout` glyph (door + arrow) to `ICONS`, and use it in the menu and in the Mon compte header button.
4. **Field labels are vertically centred against tall content** (`05` Appareils connectés, `06` Supprimer le compte): the label floats in the middle of a 3-row list.
   - On `Field`, use `align-items:flex-start` with `padding-top:6px` on the label column whenever the right column is taller than one control.
5. **The Mon compte header button** sits at the far right, about 600px from the 720px content column. Constrain the header to the same `max-width:720px` as the sections, or move "Se déconnecter" to the end of Sécurité.
6. **The Mon compte "Enregistrer" when unchanged** (`05`) looks like a broken button. Hide the save row until the profile is dirty, then slide it in (opacity + 4px, .15s) with Annuler. "Profil enregistré" stays as the confirmation.
7. **Auth at 1100** (`01-login-1100`): the band text is cut at both edges and the form sits 40px below centre. Set `align-items:center` on the form column, and start the band at the playhead (the text starts at 30%).

## Product decisions (confirmed by the user)
8. **Terms of use:** keep the checkbox. The user will write the terms.
   - Create `/conditions.html` with the same layout as `/confidentialite.html`, and put a placeholder notice at the top ("Version provisoire · à compléter").
   - Link "conditions d'utilisation" in the register checkbox and in the home footer.
   - Keep the text in one Markdown source (`docs/conditions.md`) so the user can edit it without touching the HTML.
9. **Home is a public product page:**
   - **Add a download path.**
     - Add a "Télécharger" section between Export and the closing CTA, with a card for each OS: Windows (installer), macOS, and Linux. Each card shows the version, the size, and a primary "Télécharger".
     - Detect the visitor's OS and put that card first, outlined in the accent colour.
     - Below the cards, add one line on requirements (GPU optional, Whisper models downloaded on first launch) and a link to the release notes.
     - If there's no build yet, the cards say "Bientôt disponible" and the button reads "Me prévenir", collecting an e-mail (stored locally for now, sent to the server later).
   - **Change the CTAs.**
     - In the hero, the primary button is "Télécharger" (scrolls to the section) and the secondary is "Ouvrir l'atelier", which only shows when `localhost` answers (probe `/api/health` with a 600ms timeout). Otherwise show "Voir comment ça marche" (→ #flux).
     - In the nav, the primary is "Télécharger". "Se connecter" stays as a ghost button.
     - Drop "Créer un compte" from the home page: accounts are created inside the atelier.
   - **Real screenshots:** see #2. All 4 flow stills plus the hero editor shot use licensed or self-shot footage. Add `alt` text that describes the UI, not the film.
   - **Meta:** add `<title>`, a description, an OG image (1200×630, the band strip + logo) and a favicon from the logo tile.
10. **Hosted accounts are coming later.**
   - For now, keep local accounts, but **namespace the data for a later migration**: a stable `account_id` (UUID), `created_at`, and the preferences as a versioned JSON blob.
   - Add no UI yet. The gamification brief will define the server, sync and what leaves the machine.

## Proof (decisions)
`home/05-download.png` (the detected OS first) · `home/06-hero-no-atelier.png` (no localhost, so "Voir comment ça marche") · `legal/01-conditions.png`

## Proof (optional)
`home/01-home-1440.png` (band chips) · `home/04-flow-step3.png` (new still) · `account/04-topbar-menu.png` · `05-account.png` · `06-account-delete-confirm.png` · `01-login-1100.png`
