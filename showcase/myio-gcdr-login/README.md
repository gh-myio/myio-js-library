# MYIO GCDR Login — Showcase (RFC-0236)

Interactive demo of `createMyioGcdrLoginView`, `openMyioGcdrLoginModal` and the
`@experimental` `createMyioGcdrShell` ([RFC-0236](../../docs/rfcs/RFC-0236-GCDR-Login-View.md)).

## Run

Build the library first (the page loads `../../dist/myio-js-library.umd.js`):

```bash
npm run build
```

Then start the server (port **3336**, serves the repo root):

| OS | Start | Stop |
|---|---|---|
| Windows | `start-server.bat` | `stop-server.bat` |
| Git Bash / macOS / Linux | `./start-server.sh` | `./stop-server.sh` |

Open <http://localhost:3336/showcase/myio-gcdr-login/>.

## What you can try

| Control | Values |
|---|---|
| Presentation | login page (inline) · modal over a sample dashboard (re-authentication) · GCDR hot page `/qr-code` (shell + slot swap after sign-in) |
| Product | MYIO / GCDR (purple) · Data-Ingestion (`#D35400`) · Alarms (`#AF3463`) |
| Appearance | theme, locale, aside (about / signed-out prompt / none), wallpaper, remember me, build line, hot-page submit style |
| Links & help | `gcdrWebUrl` ("Esqueceu a senha?" with the GCDR backend), explicit "Criar conta", explicit support link |
| Modal | backdrop solid / blur / wallpaper, dismissible, exit link, session-expired notice, pre-filled e-mail |
| Backend | simulated `onSubmit` · GCDR client with simulated HTTP answers (exercises the real response mapping) · real GCDR client (expect CORS) |
| Outcome | success, slow success, `onSuccess` failure, wrong password with 5/3/2/1/no counter, locked, MFA, 429, network, timeout, invalid host result, `CUSTOM` |

The outcome is read on every submit, so it can be changed without remounting.
The log panel prints every callback with an allow-listed payload — never the password.

## Assets

`assets/` holds copies of GCDR's brand files (`gcdr-frontend` `public/brand/` at
`d71179b`): `myio-logo.png` and the four wallpapers. They are **not** bundled in
the library; hosts pass them by URL (`assets.logoUrl`, `assets.wallpaper`).

## Not in this version

Turnstile captcha (RFC-0236 PR 2) and `overlay.secondaryAction` (PR 4) — both
throw a clear `TypeError` if requested.
