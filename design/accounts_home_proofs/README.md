# HOME + ACCOUNT — implementation report

**For:** Claude Design. **Briefs:** `../design_handoff_redesign_v2/HOME.md` and `ACCOUNT.md`.
**Branch:** `feat/accounts-home` (rebased on `main` after the Jellyfin merge, 2026-10-22).
**Status:** both briefs are implemented and accepted by the user. This report lists what shipped, where it differs from the reference and why, and the points in the briefs that were unclear or didn't match the project. Please read the last two sections before writing the next brief.

## Proofs

All captures are 1440×900 unless noted. `/api/auth/*` is mocked in the page (fake signed-in user, e-mail sending on, three devices), so the shots don't depend on server state.

| File | Brief | State |
|---|---|---|
| `home/01-home-1440.png` | HOME | full page, 1440 wide |
| `home/02-home-900.png` | HOME | full page, 900 wide (hero on 1 column, nav links hidden) |
| `home/03-home-390.png` | HOME | full page, 390 wide |
| `home/04-flow-step3.png` | HOME | Flux tab 03 « Enregistrer » selected |
| `account/01-login.png` | ACCOUNT §1 | Connexion |
| `account/01-login-1100.png` | ACCOUNT §1 | Connexion at 1100×800 (brand panel still shown, it hides below 900) |
| `account/02-register-errors.png` | ACCOUNT §1 | inline errors after the first submit, strength bar « Trop court » |
| `account/03-forgot-sent.png` | ACCOUNT §1 | link sent |
| `account/04-topbar-menu.png` | ACCOUNT §2 | avatar menu open |
| `account/05-account.png` | ACCOUNT §3 | Mon compte (Profil, Sécurité) |
| `account/06-account-delete-confirm.png` | ACCOUNT §3 | Zone sensible, e-mail typed, button enabled |
| `account/07-signed-out-card.png` | ACCOUNT §3 | « Vous travaillez sans compte » |

Reproduce (Chrome headless, app running on 5173; nothing is written to the backend):

```
backend/venv/Scripts/python.exe design/accounts_home_proofs/shoot_accounts_home.py design/accounts_home_proofs
```

## What shipped

**HOME** — ported from `reference/home.html`, copy verbatim.
- The landing is now the root of the site: `/` is the home, the atelier moved to `/app/`. A signed-in visitor who opens `/` is sent straight to `/app/`.
- Links: « Se connecter » → `/app/#login`, « Créer un compte » → `/app/#register`, « Ouvrir l'atelier » → `/app/`.
- Bande rythmo canvas, flow tabs, features grid, format chips, closing CTA and footer as specified. `prefers-reduced-motion` shows a still frame.

**ACCOUNT** — ported from `reference/redesign/screen-account.jsx`.
- §1 Auth screen: Connexion / Créer un compte / Mot de passe oublié / lien envoyé. Inline validation after the first submit, one server banner, 46px primary button, « Continuer sans compte ». The brand panel hides below 900px.
- §1 Inputs: the shared `Input` gained `size="form"` (42px) and `"form-sm"` (36px), `type="password"` with the eye toggle, and `error` / `hint`. Same values as `TextField` in the reference.
- §2 Top bar: « Se connecter » when signed out; avatar → menu (header, Mon compte, Réglages, Se déconnecter) when signed in. The palette has a « Mon compte » command.
- §3 Mon compte: Profil, Sécurité (password change, devices), Données (JSON archive), Zone sensible (type the e-mail to delete). Signed out → the single card.
- §4 Studio link: a role with no comédien shows the account's comédien name, in the Studio and in the Éditeur Voix tab. It is a display default; it's only stored if the field is edited, and a field cleared on purpose stays empty.
- Preferences (Réglages) follow the account: the account's preferences win at sign-in, then every change is saved back.

## Differences from the reference, and why

1. **Reset screen added.** The brief has no screen for the page the e-mailed link opens. It reuses the auth layout: title « Nouveau mot de passe », one password field with the strength bar, « Enregistrer le mot de passe ». On success it returns to Connexion with a green notice. A reset signs the account out everywhere.
2. **« Lien envoyé » copy.** The reference says « Un lien a été envoyé à X » for any address, which claims an account exists when it may not. It now reads « Si un compte existe pour X, un lien vient d'y être envoyé. »
3. **E-mail « Modifier » and « Renvoyer le lien ».** Not designed. Both open inline, using the same pattern as the password change (new address + current password). The chip reads « vérifié » or « non vérifié ».
4. **Avatar swatches.** The reference list repeats NOAH green (`#5EC27C`) twice. The sixth swatch is violet `#A98BF0`.
5. **Devices.** The reference shows a place (« Lyon, FR »). Accounts are local (see below), so every session comes from the same machine and the place would always be « local ». The row shows the browser · OS and the last activity.
6. **Mot de passe oublié hidden when e-mail is off.** The atelier only sends e-mail when SMTP is configured. Without it, the « Mot de passe oublié ? » link and the verification chip are hidden rather than shown and broken.
7. **Conditions / confidentialité.** The reference links are `href="#"`. A short factual privacy page now exists (`/confidentialite.html`, linked from the footer and the register checkbox). « conditions d'utilisation » is plain text: there are no terms to link to.
8. **Signed-out card copy.** « d'un appareil à l'autre » became « dans cet atelier », because nothing syncs between machines (see below).
9. **Home below 520px.** At 375–390px the nav (logo + 2 buttons) overflowed sideways. The « BANDE RYTHMO » text next to the logo tile is hidden, and the side gutters drop to 16px.
10. **Flow screenshots.** The placeholders in `reference/assets/home/` predate Studio v2 (the Studio one still shows « Pré-roll 3s »). They are used as-is; HOME.md already says to replace them before the page goes public.

## Where the briefs didn't match the project

The app is a **local** tool: FastAPI on `127.0.0.1`, SQLite on disk, opened in a browser on the same machine. Several parts of the briefs assume a hosted service.

- **Where accounts live was never stated.** ACCOUNT.md promises preferences « d'un appareil à l'autre », a device list with cities, e-mail verification and reset links. All of that implies a central account server. The user chose **local accounts** in the atelier's database. Consequences: no cross-device sync, and the device list only shows browsers on this machine.
- **HOME refers to a home that doesn't exist.** It asks to remove « the old orange, glows, grid background, marquee and stats row » and keep `home-v1.html`. There was no landing page in the repo; that page only existed on your side.
- **HOME has no way to get the app.** The landing reads like a public product page, but a visitor can't install anything from it, and « Ouvrir l'atelier » only works on a machine where the atelier is already running. The user picked `/` = home, `/app/` = atelier for now.
- **E-mail flows were half-specified.** Reset needs a landing screen (added, see 1). Verification has a chip but no flow (added: link sent at sign-up and on e-mail change, `#verify=<token>` confirms). There was no screen for changing the address (added inline, see 3).
- **Comédien is per clip and per role in the app,** while the account has one name. « Default for any role that has none yet » could have meant writing the same name into every role. It is implemented as a display default (see §4 above).
- **Register with a taken e-mail** says the address is already used, which reveals that the account exists. The brief's rule (« never reveal whether the e-mail exists ») can't hold at sign-up without an e-mail confirmation step before the account is created.

## Open questions for the next brief

1. **Terms of use:** the register checkbox makes users accept conditions that don't exist. Write them, or drop that half of the sentence?
2. **Hosted accounts:** gamification (leaderboards, multiplayer, shared packs) needs a server. When that brief comes, say where accounts live and what moves off the machine.
3. **Home audience:** is `/` a public marketing page (then it needs a download / install path and real screenshots) or the atelier's own front door (then the « Créer un compte » emphasis may be too strong for a local tool)?
4. **Studio R2 (`FIXES_STUDIO_R2.md`):** handled on a separate branch, not covered by this report.
