# RFC-0236 — MYIO GCDR Shell and Login View (`createMyioGcdrShell`, `createMyioGcdrLoginView`, `openMyioGcdrLoginModal`)

- **RFC number:** 0236 — **revision 5** (single normative file)
- **Feature name:** `myio-gcdr-login`
- **Title:** The MYIO/GCDR screen skeleton as a library SDK, and the GCDR login built on it — inline or as a modal gate, with a pluggable authentication strategy
- **Status:** Draft rev. 5 — owner decisions of 2026-10-04 applied. BMAD Round 4 on the new parts **done** — [`reviews/RFC-0236-bmad-round-4.md`](./reviews/RFC-0236-bmad-round-4.md); its five decisions were taken with the defaults recorded below; contract precisions pending for rev. 6. First implementation and showcase delivered (`src/components/myio-gcdr-login/`, `showcase/myio-gcdr-login/`).
- **Type:** Library component (vanilla JS/DOM, UMD `window.MyIOLibrary` + ESM/CJS exports)
- **Tracking issue:** [ED-1305](https://myio.atlassian.net/browse/ED-1305) · branch `feat/ED-1305-modal-login-myio`
- **Related tickets:** [ED-1318](https://myio.atlassian.net/browse/ED-1318) (GCDR backend: account enumeration on login — Sprint 20), ED-1300 (GCDR lockout contract)
- **Created:** 2026-10-03 · **Revised:** 2026-10-04
- **History:** this is the only RFC-0236 file. The record of how it came about —
  reuse of the retired 2026-10-01 draft (`RFC-0236-Premium-Login-Modal.md` + three
  feedback files, removed here, still in git at `26da1e70`), the session record,
  BMAD Rounds 2–3, the technical reviews and the owner decisions — is in
  [`reviews/RFC-0236-history.md`](./reviews/RFC-0236-history.md); BMAD Round 4 in
  [`reviews/RFC-0236-bmad-round-4.md`](./reviews/RFC-0236-bmad-round-4.md).
- **Source of truth for the visual and behavioural contract:** `gcdr-frontend`
  at commit **`d71179b`** (`origin/desenv`, 2026-10-04) — `src/components/auth/AuthCard.tsx`
  (`AuthSplitLayout`, `AuthCardPanel`, `AuthBuildInfo`, `AuthThemeToggle`),
  `src/components/auth/LoginForm.tsx`, `src/pages/auth/Login.tsx`,
  `src/pages/qr-code/QrCodeEntry.tsx`, `src/pages/qr-code/QrCodeShell.tsx`,
  `src/components/qr-code/QrSignInPrompt.tsx`, `src/schemas/auth.ts`; and
  `gcdr.git` `desenv` — `src/services/AuthService.ts`, `src/shared/errors/AppError.ts`,
  `src/middleware/errorHandler.ts`, `src/app.ts`.

> Design document. Nothing is built. It fixes the public API, the behaviour,
> the visual contract and the test/rollout plan.

---

## Owner decisions applied in this revision (2026-10-04)

| # | Topic | Decision |
|---|---|---|
| D1 | Names | `createMyioGcdrLoginView`, `openMyioGcdrLoginModal`, `createMyioGcdrShell` (and, derived, `isMyioGcdrLoginModalOpen`, `createMyioGcdrLoginSubmit`) |
| D2 | "The QR panel" | Not a QR generator. On GCDR's hot page `/qr-code` the **same screen** hosts a mini application after sign-in (the login area becomes the QR-label detail; the signed-in user appears above). GCDR needs the **skeleton** of the screen from the library and renders its own content into it — a standard interface SDK. ⇒ §2 |
| D3 | Links / future | Links hidden by default (with GCDR only "Esqueceu a senha?", and only with an explicit `gcdrWebUrl`; "Criar conta" never by default) — **and the component must already be prepared for Auth0 concentrated in GCDR for every MYIO system**. ⇒ §3 |
| D4 | Presentations | Both in v1: inline (`createMyioGcdrLoginView`) and modal (`openMyioGcdrLoginModal`) |
| D5 | GCDR call | Exported as its own function (`createMyioGcdrLoginSubmit`) that hosts may use or wrap; `gcdr: {…}` is sugar over it |
| D6 | Owners and dates | Left open |
| D7 | Backend enumeration | Ticket opened: ED-1318 |
| D8 | Packaging | Every MYIO product will use it: ships in the **main bundle**, no separate package/subpath |

**Round 4 decisions — defaults applied by the owner's "just go" (2026-10-04)**, used by
the first implementation in `src/components/myio-gcdr-login/` (showcase
`showcase/myio-gcdr-login/`); revisit in rev. 6 if the owner disagrees:

| # | Default applied |
|---|---|
| R4-D1 | Only `credentials` is in the public `MyioGcdrAuth` type; any other `auth.kind` is rejected at runtime with `MYIO_GCDR_AUTH_UNSUPPORTED` (Winston) |
| R4-D2 | `gcdr: {…}` always means credentials against GCDR |
| R4-D3 | `createMyioGcdrShell` exported in the same release, marked `@experimental` (no PR split) |
| R4-D4 | Not applicable to the implementation (owners still open) |
| R4-D5 | The view exposes a restricted shell (no `main`); the modal exposes none |
| R4-C1/C2/C5 | Implemented: destroy during `onSuccess` is legal; `setSlot` from inside a slot defers to a microtask; `embed: { context }`; blocked `exit` keeps the cover and shows `errors.leaveFailed` |
| Paige R4 | E-mail normalisation = **trim only, case preserved** (as GCDR's Zod schema); the lock/help comparison uses trim + lower-case |
| Not yet | Turnstile (`captcha` → `MYIO_GCDR_CAPTCHA_UNSUPPORTED`) and `overlay.secondaryAction` (`MYIO_GCDR_SECONDARY_UNSUPPORTED`) |

---

## Summary

Three layers, five exports:

```text
Layer 1  Shell (screen skeleton SDK)   createMyioGcdrShell(container, options)
         wallpaper · top-right controls (theme, language, host items) ·
         split layout (aside + main) · below line · bands/panels ·
         theme and locale state · injected CSS
         Every region is a slot the host renders into, and can swap at runtime.

Layer 2  Login view                     createMyioGcdrLoginView(container, options)
         the GCDR login built on the shell    openMyioGcdrLoginModal(options)
         (card, form, banners, captcha)       isMyioGcdrLoginModalOpen(target?)

Layer 3  Authentication strategy        credentials: host onSubmit | createMyioGcdrLoginSubmit(gcdr)
                                        redirect (reserved, the Auth0-in-GCDR phase)
```

```js
// A login page against GCDR
MyIOLibrary.createMyioGcdrLoginView(el, { gcdr: { apiUrl, tenantId }, onSuccess });

// A re-authentication gate over a dashboard
MyIOLibrary.openMyioGcdrLoginModal({ gcdr: { apiUrl, tenantId }, notice: { code: 'SESSION_EXPIRED' }, onSuccess });

// GCDR's hot page: the skeleton, with its own content after sign-in
const shell = MyIOLibrary.createMyioGcdrShell(el, { size: 'xl', width: 'cockpit' });
shell.setSlot('main', (body, ctx) => renderMyCockpit(body, ctx));
```

No React, no build step: works from a `<script>` tag (UMD), a ThingsBoard
widget, a React/Vue/Next app or a plain HTML page.

## Motivation

- **M1 — The same screen was rebuilt twice in two days.** On 2026-10-02 the
  alarms UI copied the GCDR login (to add Turnstile after GCDR switched
  `LOGIN_CAPTCHA_MODE` to `required`); on 2026-10-03 Data-Ingestion asked for
  the same screen without captcha. Each port was ~2,500 lines across ~20 files.
  The next product would be the third copy.
- **M2 — Copies drift.** Every change to the GCDR login (error codes, ED-1300
  lockout, a new "Sobre a MYIO" tile, captcha handling) must be repeated by hand
  in every copy, in a different framework each time.
- **M3 — Security behaviour belongs in one place.** Single-use captcha tokens,
  passwords never logged or stored, no account-existence leaks from the UI,
  "remember me" that remembers only the e-mail.
- **M4 — The library is already the shared runtime** of every MYIO front end.
- **M5 — A session that expires inside a dashboard needs a gate, not a page.**
  ThingsBoard widgets cannot navigate away without losing state (RFC-0224).
- **M6 — The screen is more than a login (new in rev. 5).** GCDR's hot page
  `/qr-code` is "a clone of the login page whose left panel is a mini cockpit"
  (`QrCodeEntry.tsx`): while signed out it shows the login card with a lock
  prompt in the aside; after sign-in the same skeleton hosts the QR cockpit
  and the user badge. Products need that **skeleton**, not only the form.
- **M7 — Authentication will move to GCDR (new in rev. 5).** The target is
  Auth0 concentrated in GCDR for every MYIO system. The component must not
  assume "e-mail + password typed into this page" in its shell, handle or
  lifecycle, so that a redirect-based strategy can be added without breaking
  the API.

### Goals

1. One call renders the GCDR login (inline or modal) and one call renders the
   bare skeleton, with zero framework dependencies.
2. **Token-faithful** to GCDR at the pinned commit, checked by a visual checklist.
3. Security rules (M3) implemented once and tested once.
4. A pluggable authentication strategy: credentials today, redirect later.
5. First consumer in production: Data-Ingestion (Rollout phase 2).

### Non-goals

- MFA second step; forgot-password / register / activation screens.
- Implementing the redirect (Auth0) strategy in v1 — only its contract is reserved.
- A cross-widget session coordinator, global session events or a global session
  Promise in the library (host's job, §5.4).
- Being a security boundary (the host protects data server-side, §8).
- Rendering GCDR's own mini applications: the shell hosts them; GCDR owns them.

## Guide-level explanation

### 1. A login page against GCDR

```html
<div id="login" style="min-height:100vh"></div>
<script src="https://unpkg.com/myio-js-library@0.1.x/dist/myio-js-library.umd.min.js"></script>
<script>
  MyIOLibrary.createMyioGcdrLoginView(document.getElementById('login'), {
    gcdr: { apiUrl: 'https://gcdr-api.a.myio-bas.com', tenantId: '…' },
    links: { gcdrWebUrl: 'https://gcdr-web.a.myio-bas.com' },  // enables "Esqueceu a senha?"
    onSuccess(session) {
      localStorage.setItem('token', session.accessToken);
      location.assign('/');
    },
  });
</script>
```

### 2. A product with its own backend (Data-Ingestion — first consumer)

```js
MyIOLibrary.createMyioGcdrLoginView(el, {
  brand: { label: { 'pt-BR': 'Acesso Ingestion', en: 'Ingestion access' }, accent: '#D35400' },
  aside: { kind: 'about' },
  async onSubmit({ email, password }, { signal }) {
    const res = await fetch('/api/auth/login', { method: 'POST', signal, /* … */ });
    if (res.ok) return { ok: true, session: await res.json() };
    if (res.status === 429) return { ok: false, code: 'TOO_MANY_REQUESTS' };
    return { ok: false, code: 'INVALID_CREDENTIALS' };
  },
  onSuccess(session) { /* store, redirect */ },
});
```

Links are hidden (no `gcdr`, no `links`); the footer shows the default
"Precisa de acesso? Fale com o administrador do sistema.".

### 3. Behind NextAuth, with captcha (Alarms)

```js
MyIOLibrary.createMyioGcdrLoginView(el, {
  brand: { label: { 'pt-BR': 'Acesso Alarmes', en: 'Alarms access' }, accent: '#AF3463' },
  captcha: { provider: 'turnstile', siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY },
  async onSubmit({ email, password, captchaToken }) {
    const r = await signIn('credentials', { email, password, captchaToken, redirect: false });
    return r?.ok ? { ok: true } : { ok: false, ...parseNextAuthError(r?.error) };
  },
  onSuccess() { router.replace(callbackUrl); },
});
```

### 4. Wrapping the GCDR call (telemetry)

```js
const gcdrSubmit = MyIOLibrary.createMyioGcdrLoginSubmit({ apiUrl, tenantId });
MyIOLibrary.createMyioGcdrLoginView(el, {
  async onSubmit(input, ctx) {
    const t0 = performance.now();
    const result = await gcdrSubmit(input, ctx);
    metrics.track('login', { ok: result.ok, code: result.ok ? null : result.code, ms: performance.now() - t0 });
    return result;
  },
  onSuccess,
});
```

### 5. Re-authenticating inside a dashboard (modal)

```js
const modal = MyIOLibrary.openMyioGcdrLoginModal({
  gcdr: { apiUrl, tenantId },
  notice: { code: 'SESSION_EXPIRED' },
  initialEmail: currentUser.email,
  aside: { kind: 'none' },
  overlay: {
    backdrop: 'blur',
    exit: { label: { 'pt-BR': 'Sair', en: 'Sign out' }, href: '/logout' },
  },
  async onSuccess(session, { signal }) {
    await authCoordinator.applySession(session, { signal });  // overlay stays until this resolves
  },
});
```

### 6. GCDR's hot page on the shell (the skeleton SDK)

```js
const shell = MyIOLibrary.createMyioGcdrShell(root, {
  size: 'xl', width: 'cockpit', buildInfo: `v${version} • Build: ${built}`,
});

function showSignedOut() {
  shell.setSlot('aside', { kind: 'signedOutPrompt', text: t('signedOut.text') });
  // The login view can render into any element — here, the shell's main slot.
  shell.setSlot('main', (body) => {
    const view = MyIOLibrary.createMyioGcdrLoginView(body, {
      embed: true,                // no own shell: card only, inside the host shell
      submitStyle: 'hotPage',
      gcdr: { apiUrl, tenantId },
      onSuccess: () => showSignedIn(),
    });
    return () => view.destroy();
  });
}

function showSignedIn() {
  shell.setSlot('topRight', (el) => renderUserBadge(el));     // language selector stays
  shell.setSlot('aside', (el, ctx) => renderCockpitMenu(el, ctx));
  shell.setSlot('main', (el, ctx) => renderLabelDetail(el, ctx));
}
```

### 7. Later: Auth0 concentrated in GCDR (reserved — not in v1)

```js
MyIOLibrary.createMyioGcdrLoginView(el, {
  auth: {
    kind: 'redirect',
    label: { 'pt-BR': 'Entrar com MYIO', en: 'Sign in with MYIO' },
    start: ({ returnTo }) => location.assign(`${gcdrWeb}/auth/authorize?return_to=${encodeURIComponent(returnTo)}`),
  },
  onSuccess,
});
```

The card then shows one button instead of the form. Everything else (shell,
notice, modal, handle, lifecycle) is unchanged. v1 rejects `kind: 'redirect'`
with a clear error (§3.3).

### What the host decides, in one table

| Concern | Option | Default |
|---|---|---|
| How to authenticate | `onSubmit` *or* `gcdr` *or* `auth` | — (exactly one) |
| After success | `onSuccess(session, { signal })` | — (required) |
| Attempt timeout | `gcdr.timeoutMs` / `submitTimeoutMs` | 15000 / 30000 |
| Captcha | `captcha` | none |
| Side panel | `aside` | `{ kind: 'about' }` |
| Submit button style | `submitStyle` | `'auth'` |
| Band label / colour / tint | `brand` | "Acesso" / `#6B4ABF` / none |
| Logo, wallpapers | `assets` | MYIO logo (inline SVG), MYIO wallpapers (CDN) |
| Links | `links` | **hidden**; "Esqueceu a senha?" with `gcdr` + `gcdrWebUrl` |
| Support contact | `support` | the "Atendimento" link of the about panel, when shown |
| Theme / language | `theme`, `locale`, `show.*` | `'system'`, browser language, both selectors shown |
| Texts | `messages` | built-in pt-BR + en |
| Build line | `buildInfo` | hidden |
| Informational notice | `notice` | none |
| Presentation | view vs modal vs `embed` | — |
| Modal backdrop / dismissible / exit | `overlay.*` | `'solid'` / `false` / none |

## Reference-level explanation

### 1. Public API

```ts
// Layer 1
export function createMyioGcdrShell(container: HTMLElement, options?: MyioGcdrShellOptions): MyioGcdrShellHandle;
// Layer 2
export function createMyioGcdrLoginView(container: HTMLElement, options: MyioGcdrLoginViewOptions): MyioGcdrLoginViewHandle;
export function openMyioGcdrLoginModal(options: MyioGcdrLoginModalOptions): MyioGcdrLoginModalHandle;
export function isMyioGcdrLoginModalOpen(target?: Document | HTMLElement): boolean;
// Layer 3
export function createMyioGcdrLoginSubmit(options: MyioGcdrClientOptions): MyioGcdrLoginSubmitFn;

export type { /* every Myio* type below */ };
```

Exported from `src/index.ts` (ESM/CJS) and on `window.MyIOLibrary` (UMD), in
the **main bundle** (D8). Naming: functions `…MyioGcdr…`, types `MyioGcdr*`,
CSS classes under `.myio-gcdr-shell` / `.myio-gcdr-login` (proposal; see Q-CSS).

**Injection rules (all layers).**

- Nothing happens at import time (`package.json` `sideEffects: false`).
- `container` is emptied and owned until `destroy()`.
- Outside `container` the library only touches: one `<style>` per root node
  (`container.getRootNode()` — `document.head` or a shadow root), the Turnstile
  script (only with `captcha`), the Nunito `<link>` (when `fonts.load`), the
  `localStorage` keys of §7.3, and — modal `'viewport'` scope only — the overlay,
  scroll lock and `inert` bookkeeping (§5.3).
- **Cross-bundle safety.** Two copies of the library on one page must not undo
  each other: the style element carries `data-myio-gcdr-version` and a
  reference count in `data-myio-gcdr-refs`; the scroll lock count lives in
  `data-myio-gcdr-scroll-lock` on `<html>`; the modal reservation is the
  `data-myio-gcdr-modal` marker. No module-level counters. Mixing different
  library versions on one page is unsupported (README).
- **Shadow DOM.** Inline view and shell are supported inside a shadow root
  **without** captcha. `captcha` with a container inside a shadow root throws
  `TypeError` (Turnstile renders an iframe that must be reachable from the light DOM).

### 2. Layer 1 — Shell (`createMyioGcdrShell`) — new in rev. 5

The library port of GCDR's `AuthSplitLayout` + wallpaper + `AuthCardPanel` +
`AuthBuildInfo` + `AuthThemeToggle`.

#### 2.1 Regions

```
div.myio-gcdr-shell[data-theme][data-size]
├─ div.__wallpaper                      (optional)
├─ div.__block                          width by size/width
│  ├─ div.__top-right                   pill on the wallpaper: [language] [theme] ← slot 'topRight' (host items)
│  ├─ div.__split                       2 columns ≥ 1024 px when an aside exists; else 1
│  │  ├─ section.__aside   ← slot 'aside'   (hidden below 1024 px, as in GCDR)
│  │  └─ section.__main    ← slot 'main'
│  └─ div.__below          ← slot 'below'   (default: build line pill)
```

#### 2.2 Options and handle

```ts
interface MyioGcdrShellOptions {
  /** GCDR AuthCard sizes: md = 28rem (login), lg = 32rem, xl = 37rem. Default 'md'. */
  size?: 'md' | 'lg' | 'xl';
  /** Block width. 'auto' = by size (+ 6xl with an aside, as GCDR); 'cockpit' = GCDR hot-page width
   *  (max-w-md / sm:max-w-2xl / lg:max-w-[1800px] with the lg gutter). Default 'auto'. */
  width?: 'auto' | 'cockpit';
  wallpaper?: { light?: string; dark?: string; mobileLight?: string; mobileDark?: string } | false;
  theme?: 'light' | 'dark' | 'system';           // default 'system'
  locale?: 'pt-BR' | 'en';                       // default: precedence of §7.4
  show?: { themeToggle?: boolean; languageSelector?: boolean };   // default true / true
  buildInfo?: string;                            // default 'below' content; hidden when absent
  storageKeyPrefix?: string;                     // default 'myio.login.'
  fonts?: { load?: boolean };                    // default true
  cspNonce?: string;
  onThemeChange?: (theme: 'light' | 'dark') => void;   // user action only
  onLocaleChange?: (locale: 'pt-BR' | 'en') => void;   // user action only
}

type MyioGcdrSlotName = 'aside' | 'main' | 'below' | 'topRight';

/** A host renderer. Returns an optional cleanup, called when the slot is replaced or the shell destroyed. */
type MyioGcdrSlotRenderer = (el: HTMLElement, ctx: MyioGcdrSlotContext) => void | (() => void);

/** Built-in contents, for the slots where GCDR has them. */
type MyioGcdrBuiltInSlot =
  | { kind: 'about'; healthUrl?: string | false }               // 'aside' (§4.2)
  | { kind: 'signedOutPrompt'; text?: Localized }               // 'aside' (§4.2)
  | { kind: 'buildInfo'; text: string };                        // 'below'

interface MyioGcdrSlotContext {
  readonly theme: 'light' | 'dark';
  readonly locale: 'pt-BR' | 'en';
  /** Subscribe to theme/locale changes; returns an unsubscribe. Called before cleanup is due. */
  on(event: 'theme' | 'locale', fn: (value: string) => void): () => void;
  /** Builds a GCDR card panel (band with eyebrow + logo, optional title, body, tinted footer)
   *  inside `el` and returns its parts; the panel is removed with the slot. */
  panel(opts: { eyebrow: Localized; title?: Localized; footer?: boolean; fill?: boolean;
                accent?: string; tint?: string; logo?: boolean }): { body: HTMLElement; footer?: HTMLElement };
  /** Aborted when this slot content is replaced or the shell is destroyed. */
  readonly signal: AbortSignal;
}

interface MyioGcdrShellHandle {
  /** Replace a slot. The previous content's cleanup runs first (synchronously), then the new
   *  renderer. `null` empties the slot ('aside' null ⇒ one-column layout). */
  setSlot(name: MyioGcdrSlotName, content: MyioGcdrSlotRenderer | MyioGcdrBuiltInSlot | null): void;
  setTheme(theme: 'light' | 'dark' | 'system'): void;   // does not fire onThemeChange
  setLocale(locale: 'pt-BR' | 'en'): void;              // does not fire onLocaleChange
  setSize(size: 'md' | 'lg' | 'xl', width?: 'auto' | 'cockpit'): void;
  getState(): { theme: 'light' | 'dark'; locale: 'pt-BR' | 'en'; size: string; slots: Record<MyioGcdrSlotName, 'empty' | 'builtIn' | 'host'> };
  readonly element: HTMLElement;   // root; layout classes are not public API
  destroy(): void;                  // idempotent; runs every slot cleanup, releases style
}
```

#### 2.3 Slot contract

1. A renderer runs once per `setSlot`; it owns `el`'s children. The shell never
   re-renders host content; theme/locale changes reach it through `ctx.on` and
   the `data-theme` attribute on the shell root (host CSS may key on it).
2. Replacing a slot: abort `ctx.signal` → run cleanup (errors caught, fixed
   `console.error`) → empty `el` → run the new renderer. Synchronous; no frame
   with both contents.
3. `topRight` order: built-in controls first (language, then theme, each when
   shown), then the host content — matching GCDR's signed-in pill
   (`SignedInControls`: "language, then the user badge").
4. A renderer that throws leaves the slot empty and is reported with a fixed
   `console.error`; the shell stays usable.
5. The shell has no notion of "signed in". Swapping slots is how a host moves
   from the login to its own application (example 6).

#### 2.4 Visual contract of the shell

The values of `AuthCard.tsx` at `d71179b` (Appendix B): card shell
`rounded-2xl`, `#FBFAFE` / dark `#1E1A2E`, ring `#E1DAF4` / `#3A3158`, shadow
`0 18px 50px rgba(40,20,90,0.30)`; band 68 px, padding 32 px, eyebrow 14 px /
800 / uppercase / 0.14 em; pills on the wallpaper `rgba(255,255,255,0.70)` /
dark `rgba(43,36,64,0.80)` + blur; split height
`clamp(600px, calc(100vh - 10rem), 880px)` on wide screens with internal scroll.
Nunito, as GCDR (`index.html`, `tailwind.config.js`). Custom properties
`--myio-gcdr-accent`, `--myio-gcdr-tint`, set through `style.setProperty`.

### 3. Layer 3 — Authentication strategy — new in rev. 5

#### 3.1 Shapes

```ts
type MyioGcdrAuth =
  | { kind: 'credentials'; submit: MyioGcdrLoginSubmitFn }
  | { kind: 'redirect';                                   // reserved — not implemented in v1
      label?: Localized;
      start: (ctx: { signal: AbortSignal; locale: 'pt-BR' | 'en'; returnTo: string }) => void | Promise<void> };

type MyioGcdrLoginSubmitFn =
  (input: MyioGcdrLoginSubmit, ctx: MyioGcdrLoginSubmitContext) => Promise<MyioGcdrLoginResult>;

interface MyioGcdrClientOptions {
  apiUrl: string;                       // origin, no trailing /api/v1
  tenantId: string;                     // x-tenant-id
  fetch?: typeof fetch;                 // injectable
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;                   // default 15000
}
```

`onSubmit: fn` ≡ `auth: { kind: 'credentials', submit: fn }`;
`gcdr: opts` ≡ `auth: { kind: 'credentials', submit: createMyioGcdrLoginSubmit(opts) }`
plus the GCDR-specific defaults (links, health URL, MFA link). Exactly one of
`onSubmit` / `gcdr` / `auth` (else `TypeError`).

#### 3.2 Credentials (v1)

The form of §4 is rendered; the strategy receives the validated input.
`createMyioGcdrLoginSubmit` is the **only** implementation of the GCDR
contract (§4.6); the `gcdr` option and hosts that wrap it share that code path,
and the contract test runs against this pure function.

#### 3.3 Redirect (reserved for the Auth0-in-GCDR phase)

- The type is published now so that the shell, view, modal, handle and
  lifecycle never assume a password field. v1 constructors throw
  `TypeError` with `code: 'MYIO_GCDR_AUTH_UNSUPPORTED'` for `kind: 'redirect'`.
- Intended behaviour (to be specified in its own RFC when GCDR's Auth0 exists):
  the card shows `label` as one primary button and the notice/error areas;
  pressing it sets phase `submitting` and calls `start({ returnTo })`;
  completion arrives by navigation back to the host, which then calls
  `onSuccess` itself or opens the view with a result (`handle.complete(...)`,
  to be defined). Captcha, remember-me, password policy and attempt counters
  do not apply.
- Constraint on v1 code (normative): nothing outside §4 (the credentials form)
  may read `email`/`password`; `getState()` exposes `email` only as optional.

### 4. Layer 2 — Login view

#### 4.1 Options

```ts
interface MyioGcdrLoginViewOptions extends Omit<MyioGcdrShellOptions, 'size' | 'width'> {
  // ── Authentication (exactly one) ─────────────────────────────────────────
  onSubmit?: MyioGcdrLoginSubmitFn;
  gcdr?: MyioGcdrClientOptions;
  auth?: MyioGcdrAuth;
  /** onSubmit / auth.credentials only. Default 30000 → TIMEOUT. Ignored with gcdr (uses gcdr.timeoutMs). */
  submitTimeoutMs?: number;
  /** Awaited (§4.9). The signal aborts on destroy/close. */
  onSuccess: (session: unknown, ctx: { signal: AbortSignal }) => void | Promise<void>;
  onError?: (error: { code: MyioGcdrLoginErrorCode; remainingAttempts?: number }) => void;

  // ── Embedding ────────────────────────────────────────────────────────────
  /** false (default): the view creates its own shell in `container`.
   *  true: card only, rendered into `container` (e.g. a slot of a host shell). */
  embed?: boolean;

  // ── Captcha ──────────────────────────────────────────────────────────────
  captcha?: { provider: 'turnstile'; siteKey: string; mode?: 'required' | 'optional';
              theme?: 'auto' | 'light' | 'dark'; action?: string };

  // ── What is shown ────────────────────────────────────────────────────────
  show?: { accessCard?: boolean; themeToggle?: boolean; languageSelector?: boolean;
           rememberMe?: boolean; passwordToggle?: boolean; wallpaper?: boolean };   // all default true
  aside?: { kind: 'about'; healthUrl?: string | false }
        | { kind: 'signedOutPrompt'; text?: Localized }
        | { kind: 'custom'; render: MyioGcdrSlotRenderer }
        | { kind: 'none' };                                           // default { kind: 'about' }
  /** GCDR LoginForm submitStyle: 'auth' = brand button (login); 'hotPage' = QrButton primary (/qr-code). */
  submitStyle?: 'auth' | 'hotPage';
  notice?: MyioGcdrLoginNotice;

  // ── Branding ─────────────────────────────────────────────────────────────
  /** label: band text ("Acesso", "Acesso Alarmes", "Acesso GCDR"…), uppercase.
   *  accent: band + submit + links + focus. bandColor: band background only (owner request
   *  2026-10-04: label and header colour must be changeable per product). */
  brand?: { label?: Localized; accent?: string; bandColor?: string; tint?: string; asideHeaderColor?: string };
  assets?: { logoUrl?: string;
             wallpaper?: { light?: string; dark?: string; mobileLight?: string; mobileDark?: string } | false };

  // ── Links, help, texts ───────────────────────────────────────────────────
  links?: {
    forgotPassword?: string | ((ctx: { email: string }) => void) | false;
    register?: string | (() => void) | false;
    gcdrWebUrl?: string;
    target?: '_self' | '_blank';
  };
  support?: { label: Localized; href: string } | false;
  footerText?: Localized;
  messages?: Partial<Record<'pt-BR' | 'en', Partial<Record<MyioGcdrLoginMessageKey, string>>>>;
  initialEmail?: string;
  autoFocus?: boolean;                 // default: true unless matchMedia('(pointer: coarse)')
}

interface MyioGcdrLoginSubmitContext { signal: AbortSignal; attempt: number }
interface MyioGcdrLoginNotice { code: 'SESSION_EXPIRED' }
type Localized = string | Partial<Record<'pt-BR' | 'en', string>>;
```

**Validation at construction** (all `TypeError`, fixed messages, nothing
rendered): exactly one of `onSubmit`/`gcdr`/`auth`; `auth.kind` known and
supported (§3.3); `onSuccess` a function; `container instanceof HTMLElement`;
`gcdr.apiUrl` and `gcdr.tenantId` non-empty strings; `gcdr.timeoutMs` and
`submitTimeoutMs` positive finite numbers; `captcha.siteKey` non-empty;
`captcha` with a shadow-root container rejected (§1); `aside.kind` known;
`show.accessCard: false` with `aside.kind: 'none'` rejected; `support.href`
non-empty when given.

#### 4.2 Aside contents

- **`about`** (default) — GCDR's "Sobre a MYIO": title "Medição e atuação
  remota IoT", six flip tiles (Wiki, Atendimento, Integrações, Sistemas,
  Institucional, Status), footer "Eficiência | Segurança | Sustentabilidade".
  Status tile: `GET {healthUrl}`, timeout 5000 ms, via `gcdr.fetch ?? fetch`,
  never blocks the form. **Default `healthUrl`**: `${gcdr.apiUrl}/health` when
  `gcdr` is set; otherwise the Status tile is hidden. No environment URL is
  hard-coded in the library. (The `subjects` override of rev. 1–4 is dropped
  until a host asks for it.)
- **`signedOutPrompt`** — GCDR's `QrSignInPrompt`: a lock icon in a
  `#6B4ABF` circle and one text (22 px, weight 800); default text = the key
  `aside.signedOutPrompt` (pt-BR/en, wording copied from `qrCode:signedOut.text`).
- **`custom`** — a slot renderer (§2.3 contract).
- **`none`** — card alone, centred. Recommended for the modal.

`kind: 'qr'` (a QR-code generator) of rev. 1–4 is **removed** (D2): GCDR has
no such panel.

#### 4.3 Form

- Fields, labels, placeholders, "Lembrar de mim", "Esqueceu a senha?" link,
  captcha slot and submit as `LoginForm.tsx`.
- **E-mail validation.** GCDR validates with Zod 4 (`zod ^4.3.5`):
  `z.string().trim().min(1,'emailRequired').email('emailInvalid')`
  (`src/schemas/auth.ts:7`). The library does not depend on Zod: the
  implementation copies the e-mail pattern used by `.email()` in the Zod
  version locked by `gcdr-frontend`'s `package-lock.json` at `d71179b`, cites
  the source line in a comment, and the test carries the same literal plus an
  accepted/rejected table generated from that Zod version.
- Password: required (`login.passwordRequired`); never trimmed.
- Validation on submit; afterwards the failed field revalidates on `input`.
  Focus goes to the first invalid field. `<form novalidate>`, Enter submits.
- **Remember me** (wired): on **success** only, store the normalised e-mail
  under `${prefix}rememberedEmail` when ticked, remove it when unticked. On
  load, `initialEmail` wins over the remembered e-mail; the checkbox is
  pre-ticked when a remembered e-mail exists.
- Eye toggle: `button type="button"`, `aria-pressed`, localized label; the
  password is re-hidden on submit.

#### 4.4 Submitting

- **Submit enabled** ⇔ phase `idle` ∧ ¬`locked` ∧ (no captcha ∨ captcha
  `ready` ∨ `captcha.mode === 'optional'`).
- A second submit while `submitting` is a no-op.
- On submit: button "Entrando…" + `aria-busy`, fields read-only, strategy
  called with a fresh `AbortSignal` and attempt id.

#### 4.5 Outcome normalisation

| What happened | Code | Notes |
|---|---|---|
| strategy resolves a valid `MyioGcdrLoginResult` | its `code`, after aliases (§4.7) | |
| resolves anything else | `INTEGRATION_ERROR` | `console.error('[MYIO Login] INTEGRATION_ERROR: invalid onSubmit result')` — never the raw value |
| throws / rejects with any `TypeError` | `NETWORK` | thrown value never shown nor logged |
| throws / rejects with an `AbortError` | follows its cause | timeout ⇒ `TIMEOUT`; destroy/close/exit ⇒ ignored |
| throws / rejects with anything else | `SERVER` | |
| timeout (`submitTimeoutMs` / `gcdr.timeoutMs`) | `TIMEOUT` | signal aborted; later resolution ignored |
| view destroyed / modal closed / exit started mid-attempt | — | signal aborted; later resolution ignored |
| an older attempt resolves after a newer one started | — | ignored (attempt id) |

A host must not return `ok: true` for an MFA challenge; it returns
`{ ok: false, code: 'MFA_REQUIRED' }`. The library aborts the signal; it cannot
undo a session the host already created.

```ts
type MyioGcdrLoginResult =
  | { ok: true; session?: unknown }
  | { ok: false; code: MyioGcdrLoginErrorCode; remainingAttempts?: number;
      message?: string;          // shown (as text) only for CUSTOM
      clearPassword?: boolean }; // CUSTOM only; default true

/** May grow in minor versions — consumers need a default branch. */
type MyioGcdrLoginErrorCode =
  | 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'CAPTCHA_FAILED' | 'TOO_MANY_REQUESTS'
  | 'MFA_REQUIRED' | 'NETWORK' | 'TIMEOUT' | 'SERVER' | 'INTEGRATION_ERROR' | 'CUSTOM';
```

#### 4.6 GCDR client (`createMyioGcdrLoginSubmit`)

`POST {apiUrl}/api/v1/auth/login`, `Content-Type: application/json`,
`x-tenant-id`, `extraHeaders`; body `{ email, password, captchaToken? }`;
`credentials: 'omit'`, `redirect: 'error'`; uses the attempt's signal and
`timeoutMs` (default 15000). Never logs the body.

Every GCDR error has one envelope (`errorHandler.ts`):

```json
{ "success": false,
  "error": { "code": "INVALID_CREDENTIALS", "message": "…", "details": { "remainingAttempts": 3 } },
  "meta": { "requestId": "…", "timestamp": "…" } }
```

The client reads `error.code` and `error.details.remainingAttempts` only;
`error.message` is never shown. A body that is not JSON, or has no
`error.code`, falls to the row of its HTTP status; else `SERVER`.

| GCDR answer | Where | Result |
|---|---|---|
| 200 `{ success: true, data }` with `data.accessToken` | normal login | `{ ok: true, session: data }` |
| 200 with `data.mfaRequired: true` (no tokens) | `AuthService.ts:213-222` | `MFA_REQUIRED` — never `ok` |
| 200 otherwise (no `accessToken`, no `mfaRequired`, or not JSON) | — | `INTEGRATION_ERROR` |
| 400 `CAPTCHA_FAILED` | captcha middleware | `CAPTCHA_FAILED` |
| 400 other | — | `SERVER` |
| 401 `INVALID_CREDENTIALS` + `details.remainingAttempts` | `failWrongPassword` | `INVALID_CREDENTIALS` + counter |
| 401 `UNAUTHORIZED` (unknown e-mail; `UNVERIFIED`, `PENDING_APPROVAL`, `INACTIVE`, invalid status, legacy `lockedUntil`) | `AuthService.ts:166-204` | `INVALID_CREDENTIALS`, no counter |
| 401 with another / no code | — | `INVALID_CREDENTIALS`, no counter |
| 403 `ACCOUNT_LOCKED` | `AccountLockedError` (ED-1300) | `ACCOUNT_LOCKED` |
| 429 (`error.code: 'RATE_LIMITED'`, global limiter `app.ts:243-250`) | — | `TOO_MANY_REQUESTS` |
| network failure / timeout | — | `NETWORK` / `TIMEOUT` |
| anything else | — | `SERVER` |

**Accepted for v1.** Inactive/pending/unverified accounts read as invalid
credentials (as in the GCDR frontend). The locked banner has no date. GCDR
already lets a caller tell an unknown e-mail (no counter, `UNAUTHORIZED`) from
an existing account (`INVALID_CREDENTIALS` with counter), and checks the
account status before the password: that is **ED-1318**, a backend fix (same
answer for both; status after password; only then distinct codes). The view
does not add any signal of its own.

#### 4.7 Aliases from host backends

| Returned by the host | Normalised to |
|---|---|
| `UNAUTHORIZED`, `HTTP_401` | `INVALID_CREDENTIALS` |
| `ACCOUNT_PENDING`, `PENDING_APPROVAL`, `ACCOUNT_SUSPENDED`, `ACCOUNT_INACTIVE`, `EMAIL_NOT_VERIFIED` | `INVALID_CREDENTIALS` (no counter) |
| `RATE_LIMITED` | `TOO_MANY_REQUESTS` |
| `NETWORK_ERROR` | `NETWORK` |
| `SESSION_EXPIRED` and any other unknown string | `SERVER` |

A host that must explain an account state uses `CUSTOM` + `message` and owns
the enumeration consequence.

#### 4.8 Messages per code and attempts

| Code | Banner | Key(s) | Password | Focus | `onError` |
|---|---|---|---|---|---|
| `INVALID_CREDENTIALS`, counter `> 3` | red | `errors.invalidWithAttempts_one/_other` | cleared | password | yes |
| `INVALID_CREDENTIALS`, counter `2`–`3` | amber | `errors.attemptsLeft_one/_other` + `errors.lockWarning` (+ `errors.goToForgot` link when forgot-password is shown) | cleared | password | yes |
| `INVALID_CREDENTIALS`, counter `1` | amber | `errors.lastAttempt` + `errors.lockWarning` (+ link) | cleared | password | yes |
| `INVALID_CREDENTIALS`, no counter / `0` / not a finite integer ≥ 0 | red | `errors.invalidCredentials` (+ help line, §4.10) | cleared | password | yes |
| `ACCOUNT_LOCKED` | red, lock icon | `errors.lockedTitle` + `errors.lockedText` (+ support) | cleared | banner | yes |
| `MFA_REQUIRED` | red | `errors.mfaUnsupported` (+ "Entrar pelo GCDR Web" with `gcdrWebUrl`; + support) | cleared | e-mail | yes |
| `CAPTCHA_FAILED` | red | `errors.captchaFailed` | kept | captcha | yes |
| `TOO_MANY_REQUESTS` | red | `errors.tooManyRequests` | kept | submit | yes |
| `NETWORK` | red | `errors.networkError` | kept | submit | yes |
| `TIMEOUT` | red | `errors.timeout` | kept | submit | yes |
| `SERVER` | red | `errors.loginFailed` | kept | submit | yes |
| `INTEGRATION_ERROR` | red | `errors.integrationError` | kept | submit | yes |
| `CUSTOM` | red | `message` as text, else `errors.loginFailed` | `clearPassword` (default cleared) | password if cleared, else submit | yes |
| post-login failure (§4.9) | red | `errors.postLoginFailed` | empty | password | **no** |
| captcha load failure (§4.11) | note under widget | `errors.captchaLoadFailed` | — | — | **no** |
| exit failure (§5.2) | red | `errors.leaveFailed` | empty | exit control | **no** |

Plural keys use `Intl.PluralRules` (`_one` / `_other`). The threshold `3` is a
constant, as in GCDR. `2.5`, negatives, `NaN` and `Infinity` count as "no counter".

#### 4.9 After success

- Password and token cleared from DOM and controller; phase `success` (form
  inert; exit control hidden).
- `await onSuccess(session, { signal })`. No default timeout; `close()` /
  `destroy()` abort the signal and are the way out of a hung host.
- Rejection: back to `idle`, e-mail kept, password empty,
  `errors.postLoginFailed`, `console.error('[MYIO Login] onSuccess failed')`,
  no resubmit, `onError` not called.
- Inline view: `success` is **terminal** until `handle.reset()`.
- Modal: the overlay is removed only after `onSuccess` resolves (unless
  `overlay.closeOnSuccess: false`).

#### 4.10 Account states and help

- **Locked:** submit `aria-disabled="true"` + `aria-describedby` → banner (not
  `disabled`, so it stays in the Tab order and explains itself). Unlocks when
  the normalised e-mail differs from the e-mail of the locked attempt,
  evaluated on `input`; returning to that e-mail does not re-lock; editing the
  password does not unlock; `handle.clearError()` unlocks.
- **Help line:** after the **2nd consecutive** `INVALID_CREDENTIALS` **without a
  counter**, append `errors.invalidCredentialsHelp` ("Se você tem certeza da
  senha, sua conta pode estar aguardando liberação. Fale com o suporte.") +
  the support link. "Without a counter" covers both an unknown e-mail and an
  inactive/pending/unverified account (GCDR cannot be told apart, §4.6); the
  text is neutral for both and adds no signal beyond what GCDR already returns.
- **Support link** (`support`): default = the "Atendimento" target of the
  about panel when `aside.kind === 'about'` (kept even when the aside itself is
  not visible); `false` hides it.

#### 4.11 Captcha (Turnstile)

- Script `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`
  injected once (with `cspNonce`) by the first view that needs it.
- `turnstile.render(el, { sitekey, action, theme, callback, 'expired-callback',
  'error-callback' })`; removed in `destroy()`; late callbacks ignored.
- Token in memory only; cleared on expiry. **After every attempt that called
  the strategy** (success or failure): clear the local token, then
  `turnstile.reset(widgetId)`.
- `error-callback` → `errors.captchaLoadFailed` note; `required` keeps submit
  disabled, `optional` allows submit without a token.
- The token goes only to the strategy; never to `onSuccess`, `onError` or logs.

#### 4.12 Notice

`notice` / `handle.setNotice()` — one code, `SESSION_EXPIRED`:
- present from the first frame; `role="status"`; neutral styling; never steals
  focus; never blocks submit;
- independent of errors in both directions; cleared on success and destroy;
- text per presentation: inline `notice.sessionExpired`; modal
  `notice.sessionExpiredModal` ("Sua sessão expirou. Entre novamente — esta
  tela será mantida.");
- with `initialEmail`, a "Não é você?" control (`login.notYou`) clears the
  e-mail, focuses it and keeps the notice.

#### 4.13 Links

| Link | Shown when | Target |
|---|---|---|
| "Esqueceu a senha?" | `links.forgotPassword` set, **or** `gcdr` + `links.gcdrWebUrl` | the given URL/callback, or `${gcdrWebUrl}/forgot-password` |
| "Criar conta" | only when `links.register` is set explicitly | the given URL/callback |
| "Entrar pelo GCDR Web" (MFA banner) | `MFA_REQUIRED` + `links.gcdrWebUrl` | `${gcdrWebUrl}/login` |
| Footer text | when "Criar conta" is hidden | `footerText`, default `login.askAdmin` ("Precisa de acesso? Fale com o administrador do sistema.") |

No environment URL is hard-coded. With a future `redirect` strategy the
strategy supplies its own links (§3.3).

#### 4.14 Handle

```ts
interface MyioGcdrLoginViewHandle {
  getState(): {
    phase: 'idle' | 'submitting' | 'success' | 'destroyed';   // modal adds 'leaving' (§5.2)
    error?: MyioGcdrLoginErrorCode;
    message?: MyioGcdrLoginMessageKey;   // e.g. errors.postLoginFailed, errors.captchaLoadFailed
    locked: boolean;
    notice?: 'SESSION_EXPIRED';
    captcha: 'none' | 'pending' | 'ready' | 'failed';
    email?: string; locale: 'pt-BR' | 'en'; theme: 'light' | 'dark';
  };
  setLocale(locale: 'pt-BR' | 'en'): void;               // no onLocaleChange
  setTheme(theme: 'light' | 'dark' | 'system'): void;    // no onThemeChange
  showError(code: MyioGcdrLoginErrorCode, extra?: { message?: string; remainingAttempts?: number }): void;
  clearError(): void;                                     // error + lock; not the notice
  setNotice(notice: MyioGcdrLoginNotice | null): void;    // notice only
  reset(): void;                                          // leaves 'success'
  focus(): void;
  /** The view's own shell (undefined with embed: true). */
  readonly shell?: MyioGcdrShellHandle;
  destroy(): void;                                        // idempotent; aborts everything
}
```

A throwing host callback (`onError`, theme/locale notifications, slot
renderers and cleanups) is caught and reported with a fixed `console.error`.

### 5. Modal (`openMyioGcdrLoginModal`)

#### 5.1 API

```ts
interface MyioGcdrLoginModalOptions extends Omit<MyioGcdrLoginViewOptions, 'embed'> {
  overlay?: {
    backdrop?: 'solid' | 'blur' | 'image';       // default 'solid'
    opacity?: number;                            // 0–1, default 0.5
    blur?: number;                               // px, default 8 ('blur') / 4
    dismissible?: boolean;                       // Esc + close button; default false
    closeOnSuccess?: boolean;                    // default true
    scope?: 'viewport' | { element: HTMLElement };   // default 'viewport'
    /** Way out by navigation (PR 3). Required for scope 'viewport' with dismissible false. */
    exit?: { label: Localized; href: string };
    /** Way out by callback with a 'leaving' phase (PR 4). */
    secondaryAction?: { label: Localized; onClick: (ctx: { signal: AbortSignal }) => void | Promise<void>;
                        closeOnComplete?: boolean; timeoutMs?: number };
    zIndex?: number;                             // default 10000
  };
  onOpen?: () => void;
  onClose?: (reason: 'success' | 'dismiss' | 'api' | 'exit' | 'secondary') => void;
}

interface MyioGcdrLoginModalHandle extends MyioGcdrLoginViewHandle {
  close(): void;              // idempotent; same as destroy(); onClose('api') once
  readonly isOpen: boolean;
}
```

The modal is an overlay **composing** a login view (`embed` inside the
overlay's own shell); it is not a subclass.

#### 5.2 Ways out

- **`exit`** (PR 3): an `<a href>` in the card footer, available in every
  phase except `success`, also when locked and during `submitting`. Activating
  it aborts the attempt, clears password/token and lets the navigation unload
  the page; the overlay stays until then. `onClose('exit')` fires only if the
  page is still alive after 2 s (navigation blocked) and the overlay is then
  closed. Constructor rule: `scope: 'viewport'` + `dismissible: false`
  without `exit` or `secondaryAction` ⇒ `TypeError` (a gate with no way out
  traps a ThingsBoard operator — inert UI, MFA or locked account).
- **`secondaryAction`** (PR 4): the rev. 3/4 contract — phase `leaving`
  (modal only), overlay and reservation kept, `onClick` awaited with
  `timeoutMs` (default 30000); resolves ⇒ close with `'secondary'` (or keep
  the cover with `closeOnComplete: false`); rejects/times out ⇒ back to
  `idle`, `errors.leaveFailed`, retry allowed.

#### 5.3 Scopes

| | `'viewport'` (gate) | `{ element }` (widget-local, not a gate) |
|---|---|---|
| Mount | `document.body` | inside `element` (`position: relative` set if static, restored) |
| Cover | viewport, `position: fixed` | element, `position: absolute; inset: 0` |
| `inert` | on the overlay's siblings under `body`, previous values restored | none |
| Scroll lock | `<html>`/`<body>` overflow, ref-counted in the DOM | none |
| Focus trap | yes | no — only initial focus; Tab may leave |
| `aria-modal` | `true` | absent (`role="dialog"` kept) |
| Listeners | document-level for Esc/Tab | on the overlay only (safe if TB removes the element without `close()`) |
| Single instance | one per `Document` | one per `element` |
| Small element | — | below 360×480 px: compact layout (no band), console warning |

`isMyioGcdrLoginModalOpen(target?)`: with a `Document` (default `document`)
⇒ any open modal in that document, **both scopes**; with an `HTMLElement` ⇒
the modal of that element. A second `'viewport'` open throws
`code: 'LOGIN_MODAL_ALREADY_OPEN'`; so does a second open on the same element.
Hosts with many widgets should still route 401s through one coordinator
(below): eight widgets with eight element modals show eight cards.

**ThingsBoard.** Widgets share the Angular document (no iframe): in
`'viewport'` scope `inert` freezes the whole TB UI — intended for a session
gate; only the dashboard owner (MAIN_VIEW in the Shopping dashboards) opens it.
A wall/TV dashboard with `'solid'` stays blank after a night-time expiry until
someone signs in — correct for security; the README states it.

**Many widgets, one gate.** The host owns a coordinator (one in-flight
re-authentication Promise that opens the modal and settles every waiter);
in the Shopping dashboards it lives in MAIN_VIEW and children reach it via the
`MyIOUtils` bridge.

#### 5.4 Backdrops

| `backdrop` | Layers |
|---|---|
| `'solid'` (default) | opaque base `linear-gradient(180deg,#DCD2F3 0%,#EEEAF8 45%,#F7F5FC 100%)` (dark `#1B1530 → #15121F → #111827`); veil `linear-gradient(135deg, rgba(107,74,191,.34), rgba(107,74,191,.14) 50%, rgba(107,74,191,.34))` (dark `rgba(45,22,105,.55)`/`rgba(27,21,48,.30)`); frosted `rgba(255,255,255, opacity×0.44)` + `backdrop-filter: blur(<blur>px)` |
| `'blur'` | `rgba(20,12,40,<opacity>)` + `backdrop-filter: blur(<blur>px)`; dim only where unsupported. Shows the page by design (README). Theme toggle hidden by default |
| `'image'` | wallpaper by theme and `matchMedia('(orientation: portrait)')`, over the `'solid'` base, then frosted + veil |

#### 5.5 Lifecycle rules

1. Open: notice and initial state applied before attach; then `onOpen`;
   focus to e-mail (password when `initialEmail`); with `autoFocus: false`
   focus moves to the dialog title, never stays on the inert body.
2. Success: clear → `success` → await `onSuccess` → (if `closeOnSuccess`)
   cleanup → release reservation → `onClose('success')`.
3. Close/destroy: idempotent; abort everything; cleanup completes even if a
   callback throws; reservation released **before** `onClose`; `onClose` once.
4. Dismiss (only `dismissible`): refused in `submitting` and `success`.

### 6. Assets

- Logo: MYIO logo inline SVG; `assets.logoUrl` replaces it, falling back to
  the inline SVG on load error (stable box).
- Wallpapers: not bundled (~430 KB); default URLs on the package CDN
  (`https://cdn.jsdelivr.net/npm/myio-js-library@<version>/dist/assets/login/…`),
  copied to `dist/assets/login/` by the build; CSS gradient underneath on failure.

### 7. Internationalisation, theme, storage

#### 7.1 Dictionaries

pt-BR and en, wording copied from `gcdr-frontend` `src/i18n/locales/*/auth.json`
(and `qrCode.json` for the signed-out prompt) at `d71179b`. **Source of truth:
the pt-BR dictionary file**; `MyioGcdrLoginMessageKey` is generated from it at
build time and checked in; a test asserts identical key sets in both locales.
Keys (initial list): GCDR `login.*` and `errors.*` used by the login, plus
`login.passwordRequired`, `login.showPassword`, `login.hidePassword`,
`login.capsLockOn`, `login.notYou`, `login.askAdmin`, `errors.tooManyRequests`,
`errors.timeout`, `errors.integrationError`, `errors.mfaUnsupported`,
`errors.postLoginFailed`, `errors.leaveFailed`, `errors.captchaLoadFailed`,
`errors.invalidCredentialsHelp`, `notice.sessionExpired`,
`notice.sessionExpiredModal`, `aside.*`, `toolbar.*`.

#### 7.2 Theme

`'light' | 'dark' | 'system'` (follows `prefers-color-scheme`); `data-theme`
on the root only — never the host's `<html>`.

#### 7.3 Storage

`localStorage` only, every access in `try/catch`, under `storageKeyPrefix`:
`rememberedEmail` (§4.3), `theme` and `locale` (only after the user used the
control). Nothing else; the session is never stored by the library.

#### 7.4 Precedence

Locale: `options.locale` > stored > `navigator.language` (`startsWith('en')`
⇒ `en`, else `pt-BR`). Theme: `options.theme` > stored > `'system'`.

### 8. Security

- The password exists only in the input and in the single argument to the
  strategy; cleared after success and after credential failures; never
  logged, stored, emitted, put in an attribute or passed elsewhere.
- The captcha token goes only to the strategy.
- Backend text is never shown; `message` only for `CUSTOM`, via `textContent`.
  Every host string is inserted as text.
- Diagnostics: fixed strings plus a code; never raw results, errors, stacks
  or bodies.
- **Normative for hosts:** the view is not a security boundary; do not render
  or fetch protected data before success.
- Who may use it: MYIO products. White-label is out of scope for v1 (Q8).

### 9. Accessibility

Labels bound to inputs; errors `role="alert"`, notice `role="status"`,
Caps Lock hint in its own `aria-live="polite"` region; field errors via
`aria-describedby`; e-mail `type="email"`, `inputmode="email"`,
`autocomplete="username"`, `autocapitalize="none"`, `spellcheck="false"`;
password `autocomplete="current-password"`, paste allowed, `enterkeyhint="go"`;
input font ≥ 16 px; targets ≥ 44×44 px; contrast ≥ 4.5:1 text / 3:1 UI, both
themes, also on the `'solid'` backdrop; constructor `console.warn` (fixed text)
when white on `brand.accent` or on `brand.tint` is below 4.5:1; reflow at
320 px and 200 % zoom; `prefers-reduced-motion`; banners do not move the
submit button mid-tap; flip tiles keyboard-operable.

### 10. Packaging and size

- In the **main bundle** (D8): `src/index.ts` exports; UMD `window.MyIOLibrary`.
- Real baseline (2026-10-01 build): `dist/myio-js-library.umd.min.js`
  ≈ 6.0 MB, `dist/index.js` ≈ 5.8 MB. `scripts/size-check.js` (25/50 KB) and
  `scripts/check-bundle-size.mjs` (26 KB gzip) are **not run** by build,
  release or CI and are far below reality — they are not a gate here.
- The PR reports the measured min and min+gzip delta of the UMD and ESM
  artifacts against the previous release (estimate 30–45 KB min for all three
  layers).

### 11. Testing

Vitest + jsdom under `tests/components/myio-gcdr-login/`.

| File | Covers |
|---|---|
| `import-side-effects.test.ts` | nothing at import (`vi.resetModules`, `head` untouched) |
| `style-injection.test.ts` | one style per root node, DOM refcount, version attribute, nonce, shadow root |
| `shell-slots.test.ts` | slot replace order (abort → cleanup → render), built-ins, `ctx.on`, `ctx.panel`, renderer throw, destroy runs all cleanups |
| `options-validation.test.ts` | every rule of §4.1, `redirect` rejected with its code |
| `form-validation.test.ts` | e-mail literal + accepted/rejected table, trim/lower, password untouched, focus |
| `controller-state.test.ts` | pure state machine: phases, submit-enabled rule, double submit, lock in/out |
| `outcome-normalisation.test.ts` | `it.each` over §4.5 and §4.7 |
| `messages-per-code.test.ts` | `it.each` over §4.8 (key, banner, password, focus, `onError`) |
| `timeout-abort.test.ts` | fake timers, controlled promises, stale attempts, `AbortError` causes |
| `on-success.test.ts` | awaited, signal on destroy, rejection path, inline terminal success |
| `notice.test.ts` | first frame, independence, "Não é você?" |
| `help-and-support.test.ts` | help line after 2nd no-counter failure; support defaults |
| `links.test.ts` | §4.13 matrix |
| `security-leak.test.ts` | spies on `console.*`, `Storage.prototype.setItem`, attribute scan, callback payloads |
| `handle-lifecycle.test.ts` | idempotent destroy, balanced listeners, `vi.getTimerCount() === 0` |
| `i18n.test.ts` | key parity, plurals, `textContent` |
| `storage.test.ts` | throwing storage, precedence, remembered e-mail rules |
| `aside.test.ts` | about (derived health URL, injected fetch, 5 s), signedOutPrompt, custom, none |
| `gcdr-client.contract.test.ts` + `tests/fixtures/gcdr-auth/*.json` | every row of §4.6, fixtures copied from `gcdr.git` |
| `captcha.test.ts` (PR 2) | stubbed Turnstile: token lifecycle, reset order, load failure |
| `modal-*.test.ts` (PR 3/4) | scopes table, single instance, query, exit rule, focus, inert/scroll restore with two bundles, leaving |

Outside Vitest: UMD smoke in `scripts/smoke-test`; `showcase/myio-gcdr-login/`
with a manual visual checklist against GCDR at `d71179b` (1440×900, 390×844,
light/dark, pt-BR/en, inline/modal/hot-page shell) — jsdom cannot test layout,
`backdrop-filter`, fonts or image failure; size report.

### 12. Out of scope for v1

MFA step (GCDR's `mfaToken` → `POST /auth/mfa/verify`); the `redirect`
strategy implementation; social login; forgot/register/activation screens;
session storage, refresh and coordination; a `reauth` mode with a locked
e-mail; rendering GCDR's mini applications.

## Rollout plan

| Phase | Content | Owner / target |
|---|---|---|
| 1 — Library | **PR 1:** shell (§2) + inline view with credentials strategy + `createMyioGcdrLoginSubmit` + `onSubmit` path + aside `about`/`signedOutPrompt`/`custom`/`none` + `submitStyle` + `embed` + export + contract test + UMD smoke + showcase. **Exit criterion:** the Data-Ingestion configuration (example 2) and the hot-page shell (example 6) run in the showcase. **PR 2:** Turnstile. **PR 3:** modal with both scopes and `exit`. **PR 4:** `secondaryAction` / `leaving`. Each PR releasable on its own | open (D6) |
| 2 — Data-Ingestion | first consumer: replace the hand port | open |
| 3 — Alarms | replace the PR #26 port (captcha, NextAuth) | open |
| 4 — GCDR frontend | decide whether `/login` and `/qr-code` mount the shell/view (Q3) | open |
| 5 — Dashboards / new products | ThingsBoard re-authentication modal (RFC-0224); presetup, goals | open |
| later | `redirect` strategy when Auth0 is concentrated in GCDR (its own RFC) | open |

Each host migration is its own PR in its repo; the previous screen stays until
the new one passes the host's visual check. A named person runs the visual
checklist on every GCDR release until GCDR adopts the library (drift owner —
open, D6).

## Success metrics

1. Data-Ingestion hand port deleted (~2,500 lines).
2. Alarms PR #26 port deleted.
3. No new hand-written copy of the login in any MYIO product for 6 months.
4. A new host integrates the login in under one day.
5. Visual checklist passes against the pinned GCDR commit on every library release.

## Acceptance criteria

IDs from earlier revisions are retired.

| ID | Behaviour | Sections | PR | Layer |
|---|---|---|---|---|
| AC-01 | Import has no side effects; create injects once per root node; exports work in ESM/CJS/UMD | §1, §10 | 1 | unit + smoke |
| AC-02 | Shell slots: replace order, built-ins, context, throw isolation, destroy cleanups | §2.3 | 1 | unit |
| AC-03 | Invalid options throw synchronously and render nothing; `redirect` rejected with its code | §3.3, §4.1 | 1 | unit |
| AC-04 | Validation rules and e-mail table | §4.3 | 1 | unit |
| AC-05 | Submit-enabled rule; double submit no-op | §4.4 | 1 | unit |
| AC-06 | Outcome table and aliases | §4.5, §4.7 | 1 | unit |
| AC-07 | Timeout, abort causes, stale attempts | §4.5 | 1 | unit |
| AC-08 | Messages, password policy, focus and `onError` per code | §4.8 | 1 | unit |
| AC-09 | `onSuccess` awaited with signal; rejection path; inline terminal success | §4.9 | 1 | unit |
| AC-10 | Lock in/out, help line, support link | §4.10 | 1 | unit |
| AC-11 | Notice incl. "Não é você?" | §4.12 | 1 | unit |
| AC-12 | Links matrix; no hard-coded environment URL anywhere | §4.13, §4.2 | 1 | unit + grep check |
| AC-13 | Password/token never leak; host strings never HTML | §8 | 1 (2 for token) | unit |
| AC-14 | Handle: setters silent, idempotent destroy, no leaks | §4.14 | 1 | unit |
| AC-15 | GCDR client contract, every row | §4.6 | 1 | contract |
| AC-16 | Captcha lifecycle | §4.11 | 2 | unit |
| AC-17 | Modal scopes, single instance, query, exit rule, lifecycle | §5 | 3 | unit + browser check |
| AC-18 | Cross-bundle: two copies do not undo each other's style/scroll/inert | §1, §5.3 | 3 | unit |
| AC-19 | `secondaryAction` / `leaving` | §5.2 | 4 | unit + browser check |
| AC-20 | Visual checklist vs GCDR `d71179b` (login, hot-page shell, modal, backdrops, both themes/locales) | §2.4, §5.4, App. B | 1 / 3 | manual |
| AC-21 | Accessibility and reflow | §9 | 1 / 3 | browser check |
| AC-22 | Size delta reported against the real baseline | §10 | 1 | build |

## Drawbacks

- Two implementations of the same screen until GCDR adopts the library; the
  checklist makes drift visible, a drift owner must act on it.
- ~30–45 KB in a bundle every product loads (small next to ≈ 6 MB, but real).
- The shell is a public layout API: once GCDR builds on it, its slot contract
  is hard to change.
- Vanilla DOM is more verbose than the React original.
- Wallpapers depend on a CDN by default.

## Rationale and alternatives

- **Copy the screen per product** — rejected (M1–M3).
- **A React component package** — only React hosts.
- **A Web Component** — callbacks awkward as attributes; Turnstile vs Shadow DOM. Later wrapper.
- **Only a login view, no shell** — rejected in rev. 5 (D2/M6): GCDR's hot page
  and future products need the skeleton with their own content.
- **A QR-generator aside** (`kind: 'qr'`, rev. 1–4) — removed: no GCDR equivalent.
- **Hard-wiring credentials** — rejected (D3/M7): the strategy layer keeps the
  Auth0-in-GCDR phase non-breaking.
- **A hosted login page only (redirect)** — the long-term direction; reserved
  as the `redirect` strategy rather than replacing the view.
- **Silent single instance; global session events** — rejected.
- **`onSuccess` as notification only** — not chosen; awaited with a signal.
- **A separate package/subpath** — not needed (D8).

## Prior art

GCDR `AuthSplitLayout` / `AuthCardPanel` / `LoginForm` / `QrCodeEntry` /
`QrCodeShell` (source); RFC-0231 (factory → handle, injected CSS); RFC-0205
(`openConfirmDialog`, overlay); `MyIOToast` (shared style); the two hand ports;
Auth0 Lock and Firebase UI (drop-in login widgets); Turnstile explicit render.

## Unresolved questions

| # | Question |
|---|---|
| Q3 | Does GCDR itself mount the shell/view for `/login` and `/qr-code` (phase 4)? |
| Q4 | Wallpapers: CDN by default (proposed), bundled, or none? |
| Q6 | MFA: message only in v1 (proposed), or the code step? |
| Q8 | White-label: MYIO products only (proposed)? |
| Q9 | Canonical purple: `#6B4ABF` (auth) vs `#7C3AED` (Premium Dialog) |
| Q10 | Visual tests: Playwright later, or the manual checklist stays? |
| Q11 | `'solid'` backdrop `opacity` mapping (= GCDR 0.22 at default) |
| Q12 | `es` locale in v1? |
| Q-CSS | CSS class prefix: `myio-gcdr-shell` / `myio-gcdr-login` (proposed) |
| Q-SHELL | Is the shell's slot set (`aside`, `main`, `below`, `topRight`) enough for GCDR's hot page (e.g. the fixed step-action bar below `lg`, `ImpersonationBanner` above)? |
| Q-REDIRECT | Completion contract of the `redirect` strategy (`handle.complete`?) — its own RFC |
| Q-OWNERS | Owners, dates and drift owner (D6) |
| Q-SIZE | Separate chore to fix or remove the stale size scripts and the CLAUDE.md limits (not answered) |

## Future possibilities

`redirect` strategy (Auth0 in GCDR); MFA step; forgot/register/activation as
views on the shell; a `reauth` presentation; a `<myio-gcdr-login>` custom
element; distinct account-state messages after ED-1318; a visual-regression
job against every GCDR release.

---

## Appendix B — Token table (initial values; `d71179b` wins)

| Token | Light | Dark |
|---|---|---|
| Brand purple (band, button, links, focus) | `#6B4ABF` | `#6B4ABF` (links `#B9A5F0`) |
| Brand purple hover | `#5A3CA8` | `#5A3CA8` |
| Card background | `#FBFAFE` | `#1E1A2E` |
| Card ring | `#E1DAF4` | `#3A3158` |
| Card shadow | `0 18px 50px rgba(40,20,90,0.30)` | same |
| Title text | `#1E1B2E` | `#FFFFFF` |
| Secondary text | `#55506A` | `#D1D5DB` |
| Footer strip / border | `#F0ECFA` / `#E1DAF4` | `#251F3A` / `#3A3158` |
| Input background | `#FFFFFF` | `#2B2440` |
| Input error border | `#FCA5A5` | `#FCA5A5` |
| Pill on wallpaper | `rgba(255,255,255,0.70)` + blur | `rgba(43,36,64,0.80)` + blur |
| Aside band ("Sobre a MYIO") | `#2E8B57` | `#2E8B57` |
| Amber/red/notice panels, placeholder, disabled, hot-page button | *read from `d71179b`* | *idem* |

| Element | Spec |
|---|---|
| Card | max-width 28 / 32 / 37 rem (md/lg/xl), radius 16 px, `overflow: hidden` |
| Band | 68 px, padding 0 32 px, eyebrow left, logo right (28 px) |
| Eyebrow | 14 px, 800, uppercase, 0.14 em, white |
| Body | 28 px 32 px 32 px |
| Title | 26 px, 800 |
| Input | radius 12 px, padding-y 10 px, focus ring `rgba(107,74,191,0.30)` |
| Submit (`auth`) | full width, radius 12 px, 12 px 24 px, 16 px bold, white on accent |
| Signed-out prompt | 56 px circle `#6B4ABF`, 28 px lock icon, text 22 px / 800 |
