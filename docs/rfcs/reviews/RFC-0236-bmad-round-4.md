# RFC-0236 — BMAD Party Mode Round 4 (2026-10-04, on rev. 5)

Subject: [`../RFC-0236-GCDR-Login-View.md`](../RFC-0236-GCDR-Login-View.md) revision 5 —
only the parts new in rev. 5 (§2 shell, §3 auth strategy, §4.1 `embed`, §4.2
aside contents, §5.2 ways out, §5.3 scopes, Rollout). Four agents, each an
independent subagent that read only that file: 🏗️ Winston, 🎨 Sally,
💻 Amelia, 📋 John; 📚 Paige recording. **rev. 5 was not changed**; the items
below feed rev. 6.

## 1. Verdicts

| Agent | Verdict | Blocking items |
|---|---|---|
| 🏗️ Winston | Approve with amendments | re-entrancy (view destroyed during its own `onSuccess`; `setSlot` from inside a renderer) · `embed` loses theme/locale context · meaning of `gcdr:` in the Auth0 phase · `handle.shell` gives two owners to the `main` slot |
| 🎨 Sally | Approve with 3 blockers | focus lost and nothing announced when a slot is swapped · cockpit menu disappears on phones (aside hidden < 1024 px) · `exit` with blocked navigation reveals the dashboard after 2 s (contradicts §4.8 `leaveFailed`) |
| 💻 Amelia | PR 1 not yet red-testable (6 test files can start now) | `embed` contract · "normalised e-mail" undefined (trim only vs trim + lower) · "about" tile URLs vs AC-12 "no hard-coded URL" · pt-BR dictionary not closed · how the `AbortError` cause is detected |
| 📋 John | Approve with 3 blockers | PR 1 exit criterion couples Data-Ingestion to the hot-page shell · public shell with only a hypothetical consumer (Q3 undecided) · a named owner for phase 2 as merge gate of PR 1 (not of the RFC) |

Files that can be written test-first today (Amelia): `import-side-effects`,
`style-injection`, `outcome-normalisation`, `gcdr-client.contract`,
`timeout-abort`, `storage`.

## 2. Convergences (two or more agents)

| # | Finding | Raised by | Proposed amendment for rev. 6 |
|---|---|---|---|
| R4-C1 | **Re-entrancy in example 6**: `onSuccess → setSlot('main')` destroys the view during its own `await onSuccess` | Winston B1, Amelia | Normative: destroy during `onSuccess` is legal; the view touches no DOM afterwards, no `postLoginFailed`, no `onError`. `setSlot` called from inside a renderer/cleanup of the same slot is deferred to a microtask. Tests in `on-success` and `shell-slots` |
| R4-C2 | **`embed` has no contract** | Winston B2, Amelia B1, Sally (card width) | `embed?: false \| { context: MyioGcdrSlotContext }`: the view follows the host shell's theme/locale via `ctx.on`, self-destroys when `ctx.signal` aborts; shell options and `aside` with `embed` ⇒ `TypeError`; card max-width from the view's own `size` (default `md`), never the slot width. New `embed.test.ts`, new AC |
| R4-C3 | **Split PR 1 and mark the shell `@experimental`** | John B1/B2/A1/A2, Winston (rollout) | PR 1a: inline view + `createMyioGcdrLoginSubmit` + `onSubmit` + aside `about`/`none`, shell as **internal** implementation with the §2 structure; exit = example 2 only. PR 1b: export `createMyioGcdrShell` (`@experimental` until a spike of the real `/qr-code` runs on it and Q3/Q-SHELL are answered), runtime slots, `cockpit`, `topRight`, `ctx.panel`, `signedOutPrompt`, `hotPage`, `embed`, example 6. PR 1b ∥ PR 2 |
| R4-C4 | **The slot set is not enough for the hot page** | Winston (Q-SHELL), Sally B2 | Add slot `'top'` (full width, above the block — `ImpersonationBanner`); `MyioGcdrSlotName` may grow in minor versions; `asideCompact?: 'hide' \| 'stack'` (default `hide` for built-ins, `stack` for host renderers); the fixed step-action bar below `lg` stays host-rendered from `main` (README) |
| R4-C5 | **Ways out of the modal** | Sally B3, Winston | Blocked navigation ⇒ overlay **stays**, `errors.leaveFailed`, focus back to "Sair"; the link shows "Saindo…" + `aria-busy` immediately; `exit` and `secondaryAction` mutually exclusive in v1; PR 3 rejects `secondaryAction` with an "unsupported" code until PR 4 |

## 3. Disagreements (owner decides)

| # | Topic | Positions |
|---|---|---|
| R4-D1 | **Publish the `redirect` type now?** | rev. 5 (from D3 "already prepared"): publish `{ kind: 'redirect'; start }`, rejected at runtime. Winston: do **not** publish its shape — it fixes `start`'s signature before Auth0 exists; keep only `credentials` in the public type, reject unknown kinds with `MYIO_GCDR_AUTH_UNSUPPORTED`; the normative rule "nothing outside the form reads e-mail/password" is what keeps the API ready. Sally: a redirect inside the TB modal kills the page state (contradicts M5) — the future strategy needs a popup variant or the modal must refuse redirect |
| R4-D2 | **Meaning of `gcdr:` when Auth0 arrives** | Winston B3: decide now — `gcdr` = credentials forever (redirect only via `auth`), or reserve `gcdr.mode?: 'credentials'` with a frozen default. Otherwise the future sugar silently changes behaviour |
| R4-D3 | **Shell in PR 1** | Owner (D2) put the shell in scope; rev. 5 put it in PR 1. John: same scope, but PR 1a without the public shell so the first consumer is not delayed (~30–40 % more surface, his estimate). Winston: export in PR 1 but `@experimental`. Both keep the shell |
| R4-D4 | **Owners** | Owner (D6): left open. John: keep it open for the RFC, but a **named** person for phase 2 must exist before PR 1(a) is merged — otherwise the library ships and nobody plugs it in |
| R4-D5 | **`handle.shell` on the view** | rev. 5: full shell handle. Winston: restricted subset (`setSlot` only for `aside`/`below`/`topRight`), `undefined` in the modal |

## 4. Findings by agent (not covered above)

**🏗️ Winston**
- `ctx.on` subscriptions cancelled automatically when `ctx.signal` aborts.
- `getState().size` typed as the union; add `width`.
- `setShow({ themeToggle, languageSelector })` on the shell (example 6 assumes the theme toggle disappears after sign-in — no API for it).
- Style refcount keyed by version (`<style data-myio-gcdr-version>` with its own count); README: a TB widget removed without `destroy` leaks one reference (acceptable).
- Public surface of the shell = root class, `data-theme`, `data-size`, `--myio-gcdr-*`; everything else private. CSS with `:where()` for low specificity.
- `inert` restore is safe only because the `data-myio-gcdr-modal` marker prevents a second `viewport` gate from another bundle — write the dependency down.
- Rename `MyioGcdrLoginSubmit` (input type) → `MyioGcdrCredentials` (clashes visually with `createMyioGcdrLoginSubmit`).
- Q-CSS: approve `myio-gcdr-shell` / `myio-gcdr-login`, BEM `__`.

**🎨 Sally**
- `setSlot(name, content, { focus?: 'auto' | 'none' | HTMLElement; announce?: Localized })` + a shell-owned `aria-live="polite"` region; `'auto'` = focus the slot container (`tabindex=-1`) when focus was inside the replaced slot.
- `topRight` at 320 px: the pill wraps; the host badge may shrink to the avatar.
- `signedOutPrompt`: lock icon `aria-hidden`; on phones the aside is hidden, so the hot page's band label should carry the context (e.g. "Etiquetas QR").
- Focus for `MFA_REQUIRED` and `ACCOUNT_LOCKED`: the banner (`tabindex=-1`), announced once — not the e-mail field.
- `errors.tooManyRequests` text says when to retry ("Aguarde alguns minutos e tente novamente").
- Help line text: *"Confira o e-mail digitado. Se estiver correto e você tiver certeza da senha, sua conta pode ainda não estar liberada — fale com o suporte."*; "consecutive" resets when the normalised e-mail changes; without a support link say "fale com o administrador do sistema".
- "Esqueceu a senha?" inside the modal: default `target: '_blank'` with an accessible "(abre em nova aba)" — `_self` would lose the dashboard state (M5).
- Compact layout (§5.3): list what goes (aside, wallpaper, secondary links, smaller title) and what stays (notice, error, submit); `ResizeObserver`; below ~280×320 the modal becomes one "Entrar novamente" button calling the host coordinator.
- Future redirect: a line under the button ("Você irá à página de login MYIO e voltará para cá"); reset "Entrando…" on `pageshow` (bfcache back).

**💻 Amelia**

| Where | Problem | Amendment |
|---|---|---|
| §4.1 `extends Omit<ShellOptions,…>` | three ways to disable the wallpaper | omit `'wallpaper'` in the `Omit`; keep `assets.wallpaper` + `show.wallpaper`, or define precedence |
| §4.1 `show.accessCard` | used in validation, never defined | define (aside-only kiosk) or remove |
| §4.14 `phase` | comment says the modal adds `'leaving'`, type lacks it | add to the base union or give the modal its own `getState` |
| §4.14 `message` | INVALID with counter shows 2–3 keys | define the primary key or `messages: Key[]` |
| §4.14 `reset()` | undefined outside `success` | no-op outside `success` |
| §2.2 built-ins vs §4.1 aside | `custom`/`none` not in `MyioGcdrBuiltInSlot`; built-in in the wrong slot | map `custom` ⇒ renderer, `none` ⇒ `null`; built-in × slot mismatch ⇒ `TypeError` |
| §2.2 `buildInfo` | option and built-in both | the option is sugar for the built-in |
| §2.2 `about` in a bare shell | Status tile always hidden without `gcdr` | say so; explicit `healthUrl` enables it |
| §4.5 | a host bug `TypeError` becomes `NETWORK` | accepted; README |
| §5.1 | does `destroy()` on the modal fire `onClose('api')`? | state it (PR 3) |
| §11 × ACs | no test file for `embed`, `submitStyle`, shell state/setters, `topRight` order, contrast warning, logo fallback, Caps Lock, eye toggle | add `embed.test.ts`, `shell-state.test.ts`, `form-controls.test.ts`, `branding.test.ts`; new AC for `embed`/`submitStyle` |
| AC-12 | "grep check" has no script | a test that scans `src/` for environment hosts |
| AC-21 | ARIA/autocomplete attributes are jsdom-testable | split AC-21a (unit, attributes) / AC-21b (browser, reflow, targets) |
| §4.3 | Zod e-mail literal not in the RFC | paste the literal and the Zod version before PR 1 |

jsdom cannot test: layout, the 1024 px breakpoint and `clamp()`; `matchMedia`
(stub required for `'system'`, `pointer: coarse`, `orientation`);
`backdrop-filter`; fonts; image loading (only a dispatched `error`); real
`inert` behaviour (only the attribute); `exit` navigation/unload and the 2 s
check; rendered contrast (only the pure function); flip/reduced-motion; real
Turnstile; `:focus-visible`. These stay in the showcase checklist.

**📋 John**
- Metrics: no. 5 (visual checklist every release) depends on the drift owner → a goal, linked to Q-OWNERS; no. 4 ("integrate in < 1 day") measured on the Alarms migration, hours logged in the ticket; no. 3 checked quarterly by searching MYIO repos for `AuthSplitLayout` / `LoginForm` copies; **add: lead time from PR 1a merge to Data-Ingestion in production ≤ 2 sprints**.
- Q3 needs a deadline: if GCDR has not decided by PR 1b, the shell stays experimental and phase 4 leaves the v1 roadmap.
- Drawbacks: with phase 2 unowned, every GCDR login change (ED-1300, ED-1318) must be applied in three places instead of two.
- No objection to D3, D4, D5, D8; the modal in PR 3 does not delay Data-Ingestion.

## 5. Paige (recorder) — findings on rev. 5 itself

- **Missing type.** `MyioGcdrLoginSubmit` (the credentials input: e-mail, password, remember, captcha token, locale) is referenced in §3.1 and §4.1 but **not defined** in rev. 5 (it was defined in rev. 1–4). This is also where Amelia's B2 lives: rev. 1–4 said "trimmed, lower-cased"; rev. 5 §4.3 cites a Zod schema that only trims. Rev. 6 must define the type and pick one normalisation. Winston's rename (`MyioGcdrCredentials`) applies here.
- **Amelia B3 is a wording problem, not a design one.** AC-12 and §4.2 mean *environment* URLs (`*.a.myio-bas.com`: API, health, GCDR web). The "Sobre a MYIO" tiles link to public MYIO content (site, wiki, support). Rev. 6 should say so: content links are constants (copied from GCDR at `d71179b`, overridable), environment URLs are never defaulted; the AC-12 check scans for environment hosts only.
- **Amelia B4** (dictionary not closed) is solved by doing what §7.1 says one step earlier: rev. 6 lists the full key set, copied from `auth.json`/`qrCode.json` at `d71179b`.
- **Amelia B5**: the view decides the cause from its own state (which timer/close fired), not from `signal.reason`; a host-wrapped `createMyioGcdrLoginSubmit` whose own 15 s timeout fires first rejects with a `TIMEOUT`-tagged error the view maps to `TIMEOUT`. One sentence in §4.5.
- After this round, the blocking items are all **contract precision**, except R4-D1…D5, which are owner decisions.

## 6. Decisions requested from the owner

1. **R4-D3 / R4-C3** — split PR 1 into 1a (login for Data-Ingestion, shell internal) and 1b (public shell, `@experimental`)? *(Winston and John agree on `@experimental`; John adds the split.)*
2. **R4-D1** — publish the `redirect` type now (rev. 5) or keep only `credentials` public and reject unknown kinds at runtime (Winston)?
3. **R4-D2** — `gcdr: {…}` means credentials forever (redirect only through `auth`)? *(recommended: yes)*
4. **R4-D4** — name a person for phase 2 (Data-Ingestion) before PR 1 is merged, even without a date?
5. **R4-D5** — `handle.shell` restricted (no `main`) and absent in the modal?

Everything else in sections 2, 4 and 5 is contract precision and goes into
rev. 6 without a decision.
