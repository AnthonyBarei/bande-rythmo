# ACCOUNT: login / register + Mon compte

The design reference is `reference/redesign/screen-account.jsx`. Open `reference/redesign.html#login` or `#register`, or click the avatar → Mon compte. The home page now links to the app: "Se connecter" → `#login`, and "Créer un compte" → `#register`. The other CTAs → the app.

**Principle:** the app keeps working with no account (local-first). An account only stores your identity (display name, comédien name, avatar colour) and your preferences. Later it will also store your progress, which gamification will build on. Videos and takes never leave the machine.

## 1. Auth screen (full screen, no shell)
- **Layout:** `grid-template-columns: minmax(0,1fr) minmax(380px,520px)`.
  - **Left:** logo (links to home), the headline "Votre atelier de doublage vous attend.", a bande rythmo strip scrolling in Caveat behind a fixed accent playhead, and one line on what the account stores.
  - **Right:** the form, max 400px, vertically centered, with "← Retour à l'accueil" top-right.
  - Below 900px, hide the left panel.
- **Modes:** `Segmented` Connexion / Créer un compte, plus a separate *Mot de passe oublié* screen and a *lien envoyé* screen.
  - **Connexion:** E-mail, Mot de passe (show/hide eye, with "Mot de passe oublié ?" in the label row), and a "Rester connecté sur cet appareil" toggle.
  - **Créer un compte:** Nom affiché (hint: prérempli dans le Studio), E-mail, Mot de passe (3-step strength bar: Faible / Correct / Solide), and a terms checkbox.
  - **Oublié:** E-mail, then "Envoyer le lien", which leads to a confirmation card (link valid for 30 min) with "Renvoyer le lien".
- **Validation:**
  - Inline, shown after the first submit, one sentence per field in `danger`.
  - Server errors appear in one banner above the button ("E-mail ou mot de passe incorrect."). They never reveal whether the e-mail exists.
- **The primary button** is 46px in the accent colour and reads "Un instant…" while busy.
- **Below it:** a divider "ou", then **Continuer sans compte** (outline), with the note "Tout fonctionne en local…".
- **Inputs:** 42px high, `surface2` background, `border2` border, radius 10, a 15px leading icon. On focus: accent border plus a 3px accent-tinted ring. Use the shared `Input` primitive and add `icon`, `type="password"` (eye toggle) and `error`/`hint` props.
- **Routes:** `#login` and `#register` open this screen. Success → Bibliothèque. "Continuer sans compte" → Bibliothèque.

## 2. Top bar
- **Signed out:** an outline `Se connecter` button replaces the avatar.
- **Signed in:** the avatar (user colour) opens a `Popover`:
  - a header with the name and e-mail
  - Mon compte
  - Réglages
  - Se déconnecter
- **Palette:** add a "Mon compte" command.

## 3. Mon compte (`account` screen, shell layout, same Section/Field pattern as Réglages, max 720px)
- **Header:** kicker COMPTE, title "Mon compte", the e-mail as the sub line, and `Se déconnecter` (outline) on the right.
- **Profil:**
  - Avatar: 52px with 6 swatches (the track colours).
  - Nom affiché.
  - Nom de comédien (prefills the Studio "Comédien" field).
  - E-mail with a "vérifié" chip and "Modifier".
  - "Enregistrer" is only enabled when something changed, with Annuler and an inline "Profil enregistré" confirmation.
- **Sécurité:**
  - Mot de passe: "Modifié il y a 3 mois" plus "Changer le mot de passe", which expands inline (current + new, 8 characters minimum).
  - Appareils connectés: a list with the device, place and last active time. "Cet appareil" gets a chip; the others get "Déconnecter". Add "Déconnecter les autres appareils".
- **Données:** "Télécharger l'archive" exports projects, répliques and takes as JSON. The video note stays.
- **Zone sensible:** "Supprimer le compte…" expands a confirm box. Type the e-mail to enable "Supprimer définitivement". Local files are kept.
- **Signed out,** the screen shows one card: "Vous travaillez sans compte", with Créer un compte and Se connecter.

## 4. Studio link
When signed in, the Studio "Comédien" field defaults to the user's comédien name for any role that has none yet.

## Out of scope (next brief)
Gamification: progress, streaks, simplified creation and dubbing flows. **Don't add any XP or badges to the account page yet.**

## Proof
`account/01-login.png`, `02-register-errors.png`, `03-forgot-sent.png`, `04-topbar-menu.png`, `05-account.png`, `06-account-delete-confirm.png`, `07-signed-out-card.png`, all at 1440×900; plus `01-login` at 1100×800.
