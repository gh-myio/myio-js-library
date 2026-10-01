# RFC-0236: Premium Login Modal — Injected, Framework-Free MYIO Sign-In Modal

- Feature Name: `premium_login_modal`
- Start Date: 2026-10-01
- RFC PR: (leave this empty)
- Tracking Issue: [ED-1305](https://myio.atlassian.net/browse/ED-1305)
- Status: **Draft — awaiting approval**

## Summary

Add a public, fully injected login modal to `myio-js-library`:

```ts
const login = MyIOLibrary.openLoginModal({
  backdrop: { mode: 'solid' },          // 'blur' | 'solid' (default) | 'image'
  onSubmit: async ({ email, password, rememberMe, captchaToken }) => {
    const res = await myApi.login(email, password);
    return res.ok ? { ok: true } : { ok: false, code: res.code, remainingAttempts: res.remaining };
  },
  onForgotPassword: () => router.go('/forgot-password'),
});
```

A host system that needs authentication and has none calls one function exported from
`src/index.ts`; the library renders a modal that is **visually faithful to the GCDR login card**
(`gcdr-frontend` — `pages/auth/Login.tsx` + `components/auth/AuthCard.tsx`), including its
states (submitting, invalid credentials, attempts-left warning, locked account).

The component is **presentation + interaction only**. It never calls an authentication API: the
host supplies the behavior through callbacks, and drives the modal through a returned handle.

This RFC specifies the API, the visual contract and the behavior. No implementation is included.

## Motivation

- The MYIO login experience exists in exactly one place — the GCDR React app, built on Tailwind,
  `react-hook-form`, `zod`, `react-i18next` and `lucide-react`. None of that can be reused by a
  ThingsBoard widget, a Node-RED dashboard, a plain HTML showcase or another product.
- Systems that need a sign-in gate today either have none or draw their own, and every copy
  drifts from the brand (purple band, card proportions, error wording, lock policy messaging).
- The library already owns the *premium modal* family (`src/components/premium-modals/`), which
  is injected, framework-free, themed and Nunito-based. A login modal belongs in that family.
- The account e-mails (activation, welcome, reset, lock notice) and the GCDR card share one
  identity. A reusable modal keeps a third surface in sync with them.

### Goals

1. One exported function renders the login modal with **zero host dependencies** (no React, no
   Tailwind, no CSS file to include, no global stylesheet assumptions).
2. **Pixel-faithful** to the GCDR login *card* in light and dark themes.
3. **Three backdrop modes** selectable at creation, with mode 2 (solid + blur) as the default.
4. **Callbacks for every user action**; the host decides what "sign in" means.
5. A **showcase** page exercising every state and option.

### Non-goals

- The "About MYIO" side panel (`AuthAboutPanel`) shown beside the card on wide screens in GCDR.
- Register, forgot-password, reset-password, activate-account and welcome screens (see
  [Future possibilities](#future-possibilities)).
- Talking to any backend, storing tokens, or managing a session.
- Bundling a captcha or SSO SDK.

## Guide-level explanation

### The simplest call

```ts
import { openLoginModal } from 'myio-js-library';

const login = openLoginModal({
  onSubmit: async (credentials) => {
    const res = await fetch('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    if (res.ok) return { ok: true };
    const body = await res.json();
    return { ok: false, code: body.code, remainingAttempts: body.details?.remainingAttempts };
  },
  onSuccess: () => location.reload(),
});
```

The modal opens over the current page. While `onSubmit` is pending the button shows
"Entrando…" and the form is disabled. `{ ok: true }` closes the modal and fires `onSuccess`;
`{ ok: false, code }` renders the matching error state. The host never touches the DOM.

### Choosing what sits behind the modal

The backdrop is a creation-time option. All three modes render the **same card**; only the layer
behind it changes.

| `backdrop.mode` | What the user sees behind the card | Use when |
| --- | --- | --- |
| `'blur'` | The **host page**, blurred and dimmed by a translucent layer | The page behind is not sensitive and context helps (re-authentication, soft gate) |
| `'solid'` **(default)** | An **opaque** MYIO purple gradient that fully hides the page, plus a frosted blur layer as finish | The page must not be visible before sign-in |
| `'image'` | The **MYIO wallpaper**, same composition as the GCDR login | A full-screen branded login, standalone apps |

```ts
openLoginModal({ backdrop: { mode: 'blur', opacity: 0.5, blur: 8 }, onSubmit });
openLoginModal({ backdrop: { mode: 'solid' }, onSubmit });                    // default
openLoginModal({ backdrop: { mode: 'image', image: { light16x9: '/brand/wp.webp' } }, onSubmit });
```

`opacity` (0–1, default `0.5`) is the transparency of the translucent layer: in `'blur'` it
controls how much of the page shows through; in `'solid'` and `'image'` it controls the strength
of the frosted finish on top of the opaque base.

### Reacting to the other buttons

Every interactive element has a callback. An element whose callback is omitted (and whose
`show*` flag is not forced) is **not rendered**, so the modal never shows a dead link.

```ts
openLoginModal({
  onSubmit,
  onForgotPassword: ({ email }) => openMyResetFlow(email),
  onCreateAccount: () => router.go('/register'),
  socialProviders: ['google', 'microsoft'],
  onSocialLogin: (provider) => location.assign(`/auth/sso/${provider}/start`),
  onThemeChange: (theme) => persist('theme', theme),
  onLocaleChange: (locale) => persist('locale', locale),
});
```

### Driving the modal from outside

```ts
const login = openLoginModal({ onSubmit });

login.setError({ code: 'SESSION_EXPIRED' });   // show a message without a submit
login.setTheme('dark');
login.setLocale('en');
login.close();                                 // also returned as a cleanup
```

### Where it lives

```text
src/components/premium-modals/login/
├── index.ts                 # public re-exports
├── openLoginModal.ts        # entry point: validates params, wires view + controller
├── LoginModalView.ts        # DOM template, render/update, focus trap
├── LoginModalController.ts  # state machine, validation, callback orchestration
├── backdrop.ts              # the three backdrop modes
├── styles.ts                # scoped CSS (injected once) + design tokens
├── i18n.ts                  # pt-BR / en string tables + error-code mapping
└── types.ts                 # public types
```

This mirrors `premium-modals/contract-devices/` (`open*.ts` + `*View.ts` + `*Controller.ts` +
`types.ts` + `index.ts`). The `Fetcher`/`Persister` files of that folder have no equivalent
here, because this component performs no I/O.

## Reference-level explanation

### Public API

```ts
export type LoginBackdropMode = 'blur' | 'solid' | 'image';
export type LoginTheme = 'light' | 'dark';
export type LoginLocale = 'pt-BR' | 'en';
export type LoginSocialProvider = 'google' | 'microsoft';

export interface LoginBackdropOptions {
  /** Default: 'solid'. */
  mode?: LoginBackdropMode;
  /** Transparency of the translucent layer, 0–1. Default: 0.5. */
  opacity?: number;
  /** Blur radius in px of the translucent layer. Default: 8 ('blur'), 4 ('solid' / 'image'). */
  blur?: number;
  /** 'solid' only — override the opaque gradient. Defaults: see "Backdrop modes". */
  gradient?: { from?: string; via?: string; to?: string; accent?: string };
  /** 'image' only — wallpaper URLs. Missing variants fall back to the gradient. */
  image?: {
    light16x9?: string; light9x16?: string;
    dark16x9?: string;  dark9x16?: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
  /** Present only when a captcha is configured and solved. */
  captchaToken?: string;
}

export type LoginErrorCode =
  | 'INVALID_CREDENTIALS' | 'UNAUTHORIZED' | 'HTTP_401'
  | 'ACCOUNT_LOCKED' | 'ACCOUNT_PENDING' | 'PENDING_APPROVAL' | 'ACCOUNT_SUSPENDED'
  | 'CAPTCHA_FAILED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'SESSION_EXPIRED'
  | (string & {});                       // unknown codes → generic message

export type LoginSubmitResult =
  | { ok: true }
  | { ok: false; code?: LoginErrorCode; remainingAttempts?: number; message?: string };

export interface LoginCaptchaAdapter {
  /** Mount the widget into `container`; call `onToken` on solve, `onToken(null)` on expire/error. */
  mount(container: HTMLElement, onToken: (token: string | null) => void): void;
  /** Tokens are single-use: called after every failed attempt. */
  reset(): void;
  unmount?(): void;
}

export interface OpenLoginModalParams {
  // ── Behavior ─────────────────────────────────────────────────────────────
  /** Required. Resolve with the outcome; a thrown error is treated as NETWORK_ERROR. */
  onSubmit: (credentials: LoginCredentials) => Promise<LoginSubmitResult> | LoginSubmitResult;
  onSuccess?: (credentials: Omit<LoginCredentials, 'password'>) => void;
  onForgotPassword?: (ctx: { email: string }) => void;
  onCreateAccount?: () => void;
  onSocialLogin?: (provider: LoginSocialProvider) => void;
  onThemeChange?: (theme: LoginTheme) => void;
  onLocaleChange?: (locale: LoginLocale) => void;
  onOpen?: () => void;
  onClose?: (reason: 'success' | 'dismiss' | 'api') => void;

  // ── Appearance ───────────────────────────────────────────────────────────
  backdrop?: LoginBackdropOptions;
  theme?: LoginTheme;                    // default: 'light'
  locale?: LoginLocale;                  // default: 'pt-BR'
  logoUrl?: string;                      // default: MYIO logo (see Unresolved questions)
  /** Override any string; keys follow the GCDR `auth` namespace (login.*, errors.*). */
  texts?: Partial<Record<string, string>>;
  /** Small line under the card, e.g. "v1.4.2 • Build: 01/10/2026 12:00". Hidden when omitted. */
  buildInfo?: string;

  // ── Options ──────────────────────────────────────────────────────────────
  initialEmail?: string;
  showRememberMe?: boolean;              // default: true
  showThemeToggle?: boolean;             // default: true
  showLanguageSelector?: boolean;        // default: true
  socialProviders?: LoginSocialProvider[];   // default: [] (section hidden)
  captcha?: LoginCaptchaAdapter;         // default: none
  /** Remaining attempts at/below which the lock warning replaces the plain error. Default: 3. */
  warnAtRemainingAttempts?: number;
  /**
   * Whether the user may dismiss the modal (Esc, close button). Default: false —
   * an authentication gate must not be bypassable by closing it.
   */
  dismissible?: boolean;
  /** Mount target. Default: document.body. */
  container?: HTMLElement;
  /** Stacking order of the overlay. Default: 10000. */
  zIndex?: number;
}

export interface LoginModalHandle {
  close(): void;
  destroy(): void;                       // close + remove injected nodes/listeners
  setLoading(loading: boolean): void;
  setError(error: { code?: LoginErrorCode; remainingAttempts?: number; message?: string } | null): void;
  setTheme(theme: LoginTheme): void;
  setLocale(locale: LoginLocale): void;
  setBackdrop(backdrop: LoginBackdropOptions): void;
  focus(): void;
  readonly element: HTMLElement;         // overlay root
  readonly isOpen: boolean;
}

export function openLoginModal(params: OpenLoginModalParams): LoginModalHandle;
```

Exports added to `src/index.ts`: `openLoginModal` and the types above.

### Visual contract (fidelity to GCDR)

Reference: `AuthCard.tsx`, `Login.tsx`, `SocialLoginButtons.tsx`, `ui/Button.tsx` (`brand`),
`ui/Input.tsx`. Values below are the implementation target; the modal must match them in a
side-by-side comparison at 100% zoom.

**Card anatomy (top to bottom)**

```text
                                        ┌───────────────────────┐
                                        │ ☾  🌐 PT              │  ← pill above the card, right-aligned
                                        └───────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ ACESSO                                           [MYIO logo] │  ← purple band, 68 px
├──────────────────────────────────────────────────────────────┤
│ Login                                                         │  ← title
│                                                               │
│ [ alert area: error / attempts warning / locked ]             │
│ E-mail                                                        │
│ [ nome@empresa.com                                          ] │
│ Senha                                                         │
│ [ ••••••••                                              👁  ] │
│ ☐ Lembrar de mim                         Esqueceu a senha?    │
│ [ captcha slot ]                                              │
│ [                        Entrar                             ] │
│ ───────────────────────── OU ─────────────────────────────    │
│ [ G  Acessar com Google                                     ] │
│ [ ⊞  Acessar com Microsoft                                  ] │
├──────────────────────────────────────────────────────────────┤
│        Não tem uma conta?  Criar conta                        │  ← tinted footer strip
└──────────────────────────────────────────────────────────────┘
                 v1.4.2 • Build: 01/10/2026 12:00                 ← pill below the card
```

**Design tokens**

| Token | Light | Dark |
| --- | --- | --- |
| Brand purple (band, button, links, focus) | `#6B4ABF` | `#6B4ABF` (links `#B9A5F0`) |
| Brand purple hover | `#5A3CA8` | `#5A3CA8` |
| Card background | `#FBFAFE` | `#1E1A2E` |
| Card ring (1 px) | `#E1DAF4` | `#3A3158` |
| Card shadow | `0 18px 50px rgba(40,20,90,0.30)` | same |
| Title text | `#1E1B2E` | `#FFFFFF` |
| Secondary text | `#55506A` | gray-300 |
| Footer strip background / border-top | `#F0ECFA` / `#E1DAF4` | `#251F3A` / `#3A3158` |
| Input background | `#FFFFFF` | `#2B2440` |
| Divider ("ou") | `#E1DAF4`, label `#8A82A3` | `#3A3158` |
| Pill on the backdrop | `rgba(255,255,255,0.70)` + blur | `rgba(43,36,64,0.80)` + blur |

| Element | Spec |
| --- | --- |
| Card | width 100%, max-width **28 rem (448 px)**, radius **16 px**, `overflow: hidden` |
| Band | height **68 px**, horizontal padding 32 px, eyebrow left, logo right (height 28 px) |
| Eyebrow | 14 px, weight 800, uppercase, letter-spacing 0.14 em, white |
| Body | padding 28 px 32 px 32 px; scrolls internally if taller than the viewport |
| Title | 26 px, weight 800, line-height tight |
| Field spacing | 20 px between form rows |
| Input | radius **12 px**, vertical padding 10 px, focus border `#6B4ABF` + ring `rgba(107,74,191,0.30)`; error border red-300 with message below |
| Password | show/hide eye button inside the field, right-aligned |
| Remember me | 16 px checkbox, `accent-color: #6B4ABF` |
| Submit | full width, radius 12 px, padding 12 px 24 px, 16 px bold, white on `#6B4ABF`; spinner + "Entrando…" while pending |
| Social button | full width, radius 12 px, 1 px border `#E1DAF4`, white, 15 px semibold, provider logo left |
| Footer strip | padding 16 px 32 px, centered, 14 px |
| Font | **Nunito** (library standard for premium modals), system-ui fallback |

Icons (eye, eye-off, lock, shield-alert, sun, moon, globe, provider logos) are inlined as SVG —
no icon library is added.

### Backdrop modes

All modes use a full-viewport fixed overlay; the card is centered with 16 px of page padding and
the overlay scrolls if the card is taller than the viewport.

**Mode 1 — `'blur'`**

| Layer | Spec |
| --- | --- |
| 1 | `background: rgba(20, 12, 40, <opacity>)` (default `0.5`), `backdrop-filter: blur(<blur>px)` (default 8) |

The host page stays visible, blurred. Where `backdrop-filter` is unsupported the dim layer alone
is used.

**Mode 2 — `'solid'` (default)**

| Layer | Spec |
| --- | --- |
| 1 — opaque base | `linear-gradient(180deg, #DCD2F3 0%, #EEEAF8 45%, #F7F5FC 100%)`, **no transparency** — fully covers the page. Dark: `linear-gradient(180deg, #1B1530 0%, #15121F 45%, #111827 100%)` |
| 2 — brand veil | `linear-gradient(135deg, rgba(107,74,191,0.34) 0%, rgba(107,74,191,0.14) 50%, rgba(107,74,191,0.34) 100%)` using the accent `#6B4ABF`. Dark: `rgba(45,22,105,0.55) / rgba(27,21,48,0.30)` |
| 3 — frosted finish | `background: rgba(255,255,255, <opacity> × 0.44)` + `backdrop-filter: blur(<blur>px)` (default 4). With the default `opacity` of 0.5 this is the GCDR value `0.22` |

Nothing of the host page is visible. This is the default because a login gate normally must not
reveal what is behind it.

**Mode 3 — `'image'`**

Same stack as GCDR's `.auth-wallpaper`:

| Layer | Spec |
| --- | --- |
| 1 — wallpaper | `background-image: url(<variant>)`, `cover`, centered, over the mode-2 gradient (shown while the image loads or if it fails). Variant picked by theme and `orientation` (16:9 landscape, 9:16 portrait) |
| 2 — frosted finish | as mode 2, layer 3 |
| 3 — brand veil | as mode 2, layer 2 |

### State machine

```text
              ┌────────────── setError(null) / user edits a field ──────────────┐
              ▼                                                                  │
   ┌──────┐ submit ┌────────────┐  { ok:false }  ┌──────────────────────────────┴─┐
   │ idle │───────▶│ submitting │───────────────▶│ error                          │
   └──────┘        └─────┬──────┘                │  ├ generic                     │
      ▲                  │ { ok:true }           │  ├ attemptsWarning (≤ N left)  │
      │                  ▼                       │  └ locked                      │
      │             ┌─────────┐                  └────────────────────────────────┘
      └─ reopen ────│ closed  │
                    └─────────┘
```

| State | Trigger | Rendering |
| --- | --- | --- |
| `idle` | open, or after an error is cleared | Empty alert area, form enabled |
| `invalid` | submit with empty/malformed e-mail or empty password | Field-level messages (`login.emailRequired`, `login.emailInvalid`); `onSubmit` is **not** called |
| `submitting` | valid submit | Button spinner + `login.signingIn`; all inputs and links disabled |
| `error.generic` | `{ ok:false }` with a code that is not a lock, and `remainingAttempts` undefined or above the threshold | Dismissible red alert. With `remainingAttempts` defined: `errors.invalidWithAttempts`; otherwise the code's message, falling back to `errors.loginFailed` |
| `error.attemptsWarning` | `code === 'INVALID_CREDENTIALS'` and `remainingAttempts ≤ warnAtRemainingAttempts` | Amber panel with shield icon: `errors.attemptsLeft` (or `errors.lastAttempt` when ≤ 1), `errors.lockWarning`, and a "reset now" link that fires `onForgotPassword` |
| `error.locked` | `code === 'ACCOUNT_LOCKED'` | Red panel with lock icon: `errors.lockedTitle` + `errors.lockedText`. Not dismissible |
| `captchaPending` | a `captcha` adapter is set and no token yet | Submit disabled |

Rules carried over from GCDR:

- Error-code → message mapping is identical to `LOGIN_ERROR_KEYS` in `Login.tsx`
  (`UNAUTHORIZED`/`HTTP_401` → invalid credentials, `PENDING_APPROVAL` → account pending,
  `TIMEOUT` → network error, …). Unknown codes show the generic message; a `message` returned by
  the host is used **only** when the code is unknown, so raw backend text never leaks by default.
- After every failed attempt the captcha adapter is `reset()` (tokens are single-use).
- The password field is cleared after a failed attempt; the e-mail is kept.
- A rejected `onSubmit` promise is treated as `{ ok:false, code:'NETWORK_ERROR' }`.

### Accessibility and interaction

- Overlay root: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → title.
- Focus moves to the e-mail field on open (or the password field when `initialEmail` is set),
  is trapped inside the modal, and returns to the previously focused element on close.
- `Esc` closes only when `dismissible: true`. Clicking the backdrop never closes.
- Alerts use `role="alert"`; the submit button exposes `aria-busy` while pending.
- Inputs: `type="email"` + `inputmode="email"` + `autocomplete="username"`;
  `autocomplete="current-password"` — so password managers work.
- Body scroll is locked while open and restored on close.

### Security requirements

- The component **never** persists, logs, or emits the password anywhere except the single
  `onSubmit` call. `onSuccess` receives the credentials **without** the password.
- No network request originates from the component (other than the Nunito stylesheet and
  host-provided image URLs).
- `rememberMe` is passed through as a flag; what it means is the host's decision.
- All host-provided strings (`texts`, `buildInfo`, returned `message`) are inserted as text,
  never as HTML.
- In `'blur'` mode the page behind is visible by design; the docs must state that this mode is
  not suitable for hiding sensitive content.

### Injection model

- Rendered in the light DOM under `container` (default `document.body`) with every class
  prefixed `myio-login-`, and one `<style id="myio-login-styles">` injected once — the same
  approach as the other premium modals. Theme is applied with a `data-theme` attribute on the
  overlay root, so it does not depend on (or touch) a `.dark` class on the host `<html>`.
- No reliance on host CSS resets: the overlay sets its own `box-sizing`, font and line-height.
- A second `openLoginModal` call while one is open returns the existing handle (single instance).

### Showcase

`showcase/login-modal.html` (served with the other showcases) with a control panel:

| Control | Values |
| --- | --- |
| Backdrop mode | blur · solid · image |
| Opacity / blur | sliders |
| Theme / locale | light · dark / pt-BR · en |
| Sections | remember me, forgot password, create account, social providers, captcha (mock), build info, dismissible |
| Simulated outcome | success · invalid credentials · attempts left (5 … 1) · locked · pending · suspended · network error · slow response |

Behind the modal the page shows mock dashboard content, so the difference between the three
backdrop modes is visible. A log panel prints every callback fired with its payload (password
masked).

### Tests

Vitest + jsdom under `tests/components/premium-modals/login/`:

- renders each backdrop mode with the expected layers; default is `'solid'`;
- validation blocks `onSubmit` and shows field messages;
- each `LoginSubmitResult` maps to the right state (generic, attempts warning at the
  threshold, last attempt, locked);
- omitted callbacks hide their elements;
- `onSuccess` payload has no `password`;
- focus trap, `Esc` with and without `dismissible`, focus restoration;
- `setTheme` / `setLocale` / `setError` / `destroy` on the handle;
- host strings are not interpreted as HTML.

### Size budget

Must respect the enforced bundle limits. Expected cost: ~6–8 KB minified (template, scoped CSS,
two locales, inline SVG icons). No new dependencies. **No image is bundled** — the wallpaper and
logo are URLs.

## Drawbacks

- **Two implementations of one screen.** The GCDR React login and this modal can drift. The
  token table above is the contract; a visual check against GCDR belongs in the release checklist.
- **Not a security boundary.** A client-side modal can be removed with DevTools. It is a UI
  gate; the host must still protect its data server-side. The docs must say so plainly.
- **Asset hosting.** Mode 3 and the logo need publicly reachable URLs; the library cannot ship
  ~440 KB of wallpapers.
- **More surface to maintain** (two locales, two themes, three backdrops, several states).

## Rationale and alternatives

- **Why callbacks instead of calling the GCDR auth API directly?** The same modal must serve
  systems with different backends (GCDR, ThingsBoard, alarms, ingestion). Keeping I/O out makes
  it reusable and trivially testable. A thin `createGcdrLoginSubmit()` helper can be added later.
- **Why not embed the GCDR login in an `<iframe>`?** Cross-origin cookies, sizing, theming and
  the "modal over my page" requirement all become harder; `'blur'` mode is impossible.
- **Why not a Web Component / Shadow DOM?** It would isolate styles better, but captcha widgets
  (Turnstile) and some password managers behave poorly inside shadow roots, and no other premium
  modal uses it. Prefixed classes in the light DOM match the existing family.
- **Why `'solid'` as the default?** The primary use case is a system that requires
  authentication: the content behind must not be readable. `'blur'` is opt-in.
- **Why `dismissible: false` by default?** For the same reason — a gate that closes on `Esc`
  is not a gate.
- **Why `premium-modals/login/` and not a top-level component?** It is a modal, it shares the
  family's font, theming and injection conventions, and the `contract-devices` layout
  (`open*` / `View` / `Controller` / `types`) fits it directly.

## Prior art

- `gcdr-frontend`: `pages/auth/Login.tsx`, `components/auth/AuthCard.tsx`,
  `SocialLoginButtons.tsx`, `useAuthCaptcha.tsx`, `index.css` (`.auth-wallpaper`) — the visual
  and behavioral reference.
- RFC-0205 Premium Dialog (`openConfirmDialog`) — promise/handle-based injected modal in the
  same family; source of the styling and injection conventions.
- `premium-modals/welcome/` and `premium-modals/contract-devices/` — folder structure and
  View/Controller split.
- RFC-0014 (GCDR) Authentication & Registration — origin of the error codes and lock policy.

## Unresolved questions

1. **Default logo and wallpaper URLs.** Bundle nothing and require the host to pass them, or
   default to a MYIO-hosted CDN path? If hosted, which origin (GCDR `/brand/…`, S3
   `myio-public-files`, TB `/api/images/public/…`)?
2. **Exact meaning of `opacity` in mode 2.** This RFC maps the default `0.5` to GCDR's frosted
   layer (`0.22` white). Is that the intended reading of "blur with transparency X on top of the
   solid purple", or should `opacity` apply to a dark/purple layer instead?
3. **Gradient direction in mode 2.** `#6B4ABF` is used as the diagonal veil over the
   `#DCD2F3 → #F7F5FC` vertical base (as in GCDR). Should `#6B4ABF` instead be a gradient stop?
4. **Function name.** `openLoginModal` (matches `openConfirmDialog`, `openContractDevicesModal`)
   vs `createLoginModal` (matches the `create*Component` family). This RFC proposes `open*`.
5. **Locales.** Only `pt-BR` and `en` exist in GCDR. Is `es` needed in v1?
6. **Language selector contents.** Flags, codes, or full names — GCDR uses a compact selector;
   confirm the exact rendering to copy.
7. **Captcha.** Is the adapter interface enough, or should a ready-made Turnstile adapter ship
   in the library (it would lazy-load Cloudflare's script)?
8. **`rememberMe`.** GCDR renders the checkbox without wiring it. Keep it visible by default?

## Future possibilities

- The remaining auth screens as modal *views* of the same component: forgot password, reset
  password (with the password-rules checklist), 6-digit activation code, register.
- A `createGcdrLoginSubmit({ apiBaseUrl })` helper that implements `onSubmit` against the GCDR
  auth API, including the error-code mapping.
- An optional wide-screen aside (the "About MYIO" panel), if a host wants the full GCDR layout.
- MFA / one-time-code step between `submitting` and `closed`.
- Use by the ThingsBoard dashboards as a re-authentication gate when the ingestion/GCDR session
  expires (see RFC-0224).

---

## BMAD Party Mode Review — Round 1 (2026-10-01)

One roundtable round was run on this draft with four BMAD agents, each spawned as an
independent subagent that read the RFC on its own: 🏗️ **Winston** (System Architect),
🎨 **Sally** (UX Designer), 💻 **Amelia** (Senior Software Engineer) and 📋 **John** (Product
Manager). This section records what the table found. **The RFC body above has not been changed
yet** — the items below are proposed amendments, pending the owner's decision.

### Verdict

| Agent | Position | Blocking items |
| --- | --- | --- |
| 🏗️ Winston | Solid on visuals and states; the gaps are "around the card". His first four items are API semantics that cannot be fixed after publishing to a CDN | Gate ownership/singleton, handle lifecycle, hung `onSubmit`, close-before-host-is-done |
| 🎨 Sally | The card is specified for one scene only (desktop, 100% zoom, calm user). Her first five items change the API | Responsive + on-screen keyboard, no way out, session-expired mode, password clearing, dead-end states |
| 💻 Amelia | Not implementable test-first yet: no numbered ACs, ambiguous contracts | `onSubmit` contract, state-machine holes, silent single instance |
| 📋 John | **Does not approve as is.** A screen is specified, not a login | First consumer, submit helper, post-login handoff, locked dead end, security framing, default logo URL |

### Points raised by more than one agent (highest confidence)

| # | Finding | Raised by | Proposed amendment |
| --- | --- | --- | --- |
| C1 | **A pending `onSubmit` with `dismissible: false` locks the user forever** | Winston, Amelia, Sally | Add `submitTimeoutMs` (default 30000) → `TIMEOUT`; show "still connecting…" after ~8 s |
| C2 | **`{ ok: true }` closes the modal before the host is ready** — the RFC's own `location.reload()` example flashes the unauthenticated page in `solid` mode | Winston, Sally, John | Add a `success` state; let `onSuccess` return a Promise the modal waits for (or `closeOnSuccess: false`); let the result carry data: `{ ok: true, data?: T }` |
| C3 | **Silent single instance drops the second caller's callbacks**; a module-level singleton breaks when two copies of the bundle are on the page | Winston, Amelia | Detect the instance through a DOM marker (`[data-myio-login-root]`), warn on ignored params, and emit global events (`myio:login-success`, `myio:login-closed`) |
| C4 | **Handle lifecycle is incoherent**: the diagram has `closed → reopen` but there is no `open()`; `close()` and `destroy()` overlap | Winston, Amelia | Disposable handle with an idempotent `close()`; a result that resolves after close is ignored (generation token); a throwing host callback must not corrupt the modal |
| C5 | **`locked` contradicts itself** (not dismissible vs "editing a field clears the error") **and is a dead end** | Sally, Amelia, John | `locked` leaves only through `setError(null)`; add `lockedUntil` / `retryAfterSeconds`; give terminal states an action (`onContactSupport` / `supportUrl`); require `onForgotPassword` or a `forgotPasswordUrl` |
| C6 | **Session-expired re-authentication (RFC-0224) is the most likely first use, and it is treated as an error** — and it wants `'blur'`, not the `'solid'` default | Sally, John, Winston | Add a `reauth` mode: persistent informational notice, own title, prefilled + locked e-mail with "not you?", `blur` recommended, secondary sections hidden. Revisit the default backdrop once the first consumer is named |
| C7 | **"Pixel-faithful" cannot be verified and contradicts itself** (GCDR does not use Nunito; jsdom has no layout) | Winston, Amelia, Sally | Downgrade to **"token-faithful"**; the token table is the contract; record the `gcdr-frontend` commit it was taken from; manual checklist in the showcase |
| C8 | **`texts: Record<string, string>` is untyped and not per-locale** | Winston, Amelia, Sally | Export a `LoginTextKey` union; `texts?: Partial<Record<LoginLocale, Partial<Record<LoginTextKey, string>>>>` |
| C9 | **Nunito from Google Fonts contradicts "zero host dependencies"** and breaks offline / under CSP; the injected `<style>` needs a nonce | Winston, Amelia | `loadFont?: boolean`, `styleNonce?: string`; dynamic values through CSSOM custom properties, never through a `style=""` string |
| C10 | **Bundle estimate (6–8 KB) is unmeasured and likely optimistic** | Winston, Amelia | Acceptance criterion: measured min+gzip delta in the PR; consider a `myio-js-library/login` subpath export; inject styles on `open`, never on import |
| C11 | **Scroll lock and focus trap must coexist with other premium modals** | Winston, Amelia, Sally | Restore the previous inline `overflow` (reference-counted), apply `inert` to the overlay's siblings, publish the z-index table of the modal family |
| C12 | **`rememberMe` shown but not wired misleads the user** | John, Sally | `showRememberMe` default `false` |

### Additional findings by agent

**🏗️ Winston — architecture**

- State where the gate lives in the Shopping dashboard: MAIN_VIEW owns it; child widgets go
  through the `MyIOUtils` bridge. A ThingsBoard widget must call `close()` in `onDestroy`.
- `container` + `position: fixed` breaks inside an ancestor with `transform`/`filter` (the TB
  grid). Define whether `container` means "where to attach" or "area to cover". Inside a shadow
  root, inject the style into `container.getRootNode()` and never use `document.getElementById`.
- Theming is a parallel system: the library has `createMyIOTheme`, and the Premium Dialog uses a
  different purple (`#7C3AED`, to be confirmed in code) than this RFC (`#6B4ABF`). Expose
  `--myio-login-*` tokens and declare the canonical brand purple.
- `ok: true | false` cannot carry MFA without a breaking change — use
  `status: 'success' | 'error' | 'challenge'` from the start. Mark `handle.element` as unstable.
- If forgot/reset/activation/MFA will be views of the same component, split the shell (band,
  pills, backdrop, footer) from the form now: `premium-modals/auth/` with a `myio-auth-` prefix.
  Renaming a CSS prefix later is a breaking change.
- State the out-of-scope explicitly: relation to `MyIOAuthContext` (RFC-0199), where the token
  goes, and that in ThingsBoard the user is already signed in to TB (the gate is for the
  GCDR/ingestion session). Require a real `<form>` with `preventDefault`.

**🎨 Sally — UX**

- Responsive rules are missing and the two scroll rules contradict each other. One scroll
  container (the overlay); `dvh` + `visualViewport`; breakpoint ≤ 400 px; "short height" mode;
  `env(safe-area-inset-*)`; input font ≥ 16 px (iOS zooms otherwise).
- "Not dismissible" must not mean "no way out": add an optional secondary action
  (`secondaryAction: { label, onClick }`) and put the close button in the visual contract.
- Clearing the password on every failure is wrong for `NETWORK_ERROR`, `TIMEOUT` and
  `CAPTCHA_FAILED`; keep it and offer "try again". Define the focus destination after each error.
- Contrast (the agent's own estimate, to be measured): the "OU" label, input/social borders and
  the focus ring on the dark card likely fail WCAG AA / 1.4.11. Missing tokens: amber and red
  panels in both themes, placeholder, disabled, social button in dark. Add a 200% zoom / 320 px
  reflow criterion, and fix the rem base on the overlay root.
- Motion is not specified: entrance/exit, animated alert height (today the alert pushes the
  button mid-tap), `prefers-reduced-motion`.
- Touch targets 44×44 px; in kiosk use, re-hide the password on submit/blur and offer
  `idleClearMs`; Caps Lock hint; never block paste; `autocapitalize="none"`,
  `spellcheck="false"`, `enterkeyhint="go"`; `:-webkit-autofill` styling.
- `theme` default `'auto'` (`prefers-color-scheme`) and `locale` from `navigator.language`;
  hide the theme toggle in `blur` mode; define the layout for every omitted callback.
- Microcopy: "ACESSO", "Login" and "Entrar" say the same thing three times — add a `subtitle` /
  `productName` so the user knows what they are signing in to.

**💻 Amelia — implementation and tests**

- Add `## Acceptance Criteria` with `AC-01..AC-NN`, each mapped to a test file and `it` name.
  33 candidate ACs were proposed, among them: a double submit is a no-op (AC-01); sync throw,
  rejected promise and malformed result all map to `NETWORK_ERROR` (AC-02); fixed order on
  success — clear password → close → `onClose('success')` → `onSuccess` (AC-05);
  `disabled = submitting || externalLoading` (AC-09); programmatic setters do not fire
  `onThemeChange`/`onLocaleChange` (AC-22); unique prefixed ids (AC-25); the eye button is
  `type="button"` with `aria-pressed` (AC-27); the `<style>` carries a `data-version` (AC-28);
  the controller never keeps the password in a field or closure (AC-33).
- Validation precision: paste the literal e-mail regex (zod's changes between versions);
  `trim()` the e-mail, never the password; `<form novalidate>`; add the missing
  `login.passwordRequired` key; validate on submit only.
- Normalize the error code before choosing the state (today `UNAUTHORIZED` +
  `remainingAttempts: 2` misses the warning); define `remainingAttempts` of `0`, negative, `NaN`.
  Without i18next there is no plural engine: one `{{count}}` token, plural by distinct keys.
- jsdom cannot test `backdrop-filter`, layout or real Tab navigation: test backdrops by
  structure (`data-mode`, layer count, custom properties) and the focus trap by `keydown` at
  the edges. No Playwright in this scope.
- Delivery in three PRs: (1) `types` + `i18n` + `LoginModalController` as a pure state machine;
  (2) `LoginModalView` + `styles` + handle + export; (3) `backdrop` + captcha + showcase.
  Showcase states deep-linkable (`?mode=blur&theme=dark&state=locked`).

**📋 John — product**

- **Name the first consumer**: which system, which owner, which date. ThingsBoard already has a
  login, so who is "the system without authentication"? Add a "First consumer" section.
- "Presentation only" delivers a screen, not a login: without `createGcdrLoginSubmit()` every
  host rewrites the fetch and the error mapping — the same drift the Motivation criticizes. If
  the first consumer authenticates against GCDR, the helper belongs in v1.
- A normative security rule is missing: the host must not render or fetch protected data before
  `ok`. Unaddressed risk: any page can now show a faithful MYIO login whose password goes to the
  host's JavaScript — who may use this, and against which backend?
- **Cut v1 scope**: keep the card, `solid` + `blur`, error states, light/dark, pt-BR/en. Drop
  social login (the return from the redirect is unspecified), captcha (an adapter nobody can
  plug), "create account" (registration is a non-goal) and the `'image'` backdrop until asset
  hosting is decided.
- No success metric: propose one consumer in production by a date, integration in under 30
  host lines, and no hand-drawn login in any new system.
- Parity with GCDR has no owner or trigger; white-label must be decided and written down
  (MYIO-only as an explicit non-goal, or a brand-color token).

### Disagreements at the table

| Topic | Positions | Needs a decision from |
| --- | --- | --- |
| **v1 scope** | John cuts social, captcha, "create account" and the `'image'` backdrop. The draft and the original request include all three backdrops | Owner |
| **Folder / prefix** | Winston: `premium-modals/auth/` + `myio-auth-` now, for the future screens. Draft: `premium-modals/login/` + `myio-login-` | Owner + architecture |
| **Default backdrop** | Draft and original request: `'solid'`. John and Sally: the likely first use (re-auth) wants `'blur'` | Owner, after naming the first consumer |
| **`dismissible: false`** | Draft keeps the gate closed. Sally: a gate still needs a way out (secondary action). John: it is not a security boundary either way | Owner |
| **Handle shape** | Winston: drop `destroy`, keep one idempotent `close()`. Amelia: keep both and define each | Architecture |
| **`remember me`** | Draft: visible by default. John and Sally: hidden by default | Owner |

### Decisions requested from the owner before approval

1. **First consumer** — system, owner, target date. This drives the default backdrop and v1 scope.
2. **v1 scope** — keep or cut: social login, captcha, "create account", `'image'` backdrop.
3. **`createGcdrLoginSubmit()` in v1?** — yes if the first consumer authenticates against GCDR.
4. **Post-login contract** — `{ ok: true, data }` and an awaitable `onSuccess`.
5. **Re-authentication mode** (`reauth`) — in v1 or later.
6. **Folder and CSS prefix** — `login` / `myio-login-` or `auth` / `myio-auth-`.
7. **Default logo URL** (Unresolved question 1) — the table considers this blocking.
8. **Who may use the modal** — MYIO systems only, or customers / white-label too.

### Suggested next step

Answer the eight decisions above, then revise the RFC body in one pass: add the acceptance
criteria (starting from Amelia's AC list), the timeout / awaitable-success / singleton / lifecycle
rules (C1–C4), the responsive and accessibility requirements, and the "First consumer" and
security sections — and re-submit for approval.
