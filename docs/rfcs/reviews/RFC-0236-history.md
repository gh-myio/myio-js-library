# RFC-0236 — review history (not normative)

The normative document is [`../RFC-0236-GCDR-Login-View.md`](../RFC-0236-GCDR-Login-View.md) (revision 5).
This file keeps the record of how it came about, extracted from revision 4 before the
versioned copies (rev. 1, 2.1, 3, 4) and the retired 2026-10-01 draft
(`RFC-0236-Premium-Login-Modal.md` + feedback v1–v3, still in git at `26da1e70`) were removed.
BMAD Round 4 (on rev. 5) is in [`RFC-0236-bmad-round-4.md`](./RFC-0236-bmad-round-4.md).

## Appendix A — What was reused from the Premium Login Modal draft

Source: `RFC-0236-Premium-Login-Modal.md` (2026-10-01, commit `26da1e70`,
branch `feat/ED-1305-modal-login-myio`) and its reviews. Kept here as the
decision log; those files are historical and not normative.

| Topic | Origin | Decision in v2 |
|---|---|---|
| Modal presentation with `solid` (default) / `blur` / `image` backdrops | draft §Backdrop modes; v1/v3 kept `solid` default | **Accepted** → §14.1–14.2 |
| `dismissible: false` default; backdrop click never closes | draft; BMAD R1 disagreement | **Accepted** → §14.1 |
| Submit timeout + `AbortSignal` + attempt id; late results ignored | BMAD R1 C1/C4; feedback-v1 B1 | **Accepted** → §1.1, §1.2 |
| `INTEGRATION_ERROR` for invalid results, fixed diagnostic text | feedback-v2 §6 | **Accepted** → §1.2 |
| Success keeps the cover until the host is ready | BMAD R1 C2; feedback-v1 B2 | **Accepted** via rev. 1's awaited `onSuccess` + rejection rule → §3.5, §14.3 |
| Explicit single instance per document, `LOGIN_MODAL_ALREADY_OPEN`, query | BMAD R1 C3; feedback-v1 B3; v2 §2 | **Accepted** → §14.3 rule 1 |
| Idempotent close, `onClose` once, release before `onClose` | feedback-v1 B3; v2 §2 | **Accepted** → §14.3 rule 5 |
| Orthogonal state dimensions + submit-enabled precedence | feedback-v1 B4 | **Accepted** → §10, §14.3 |
| Alias normalisation; `remainingAttempts` only for credentials; 0/invalid values | BMAD R1 (Amelia); feedback-v1 B4 | **Accepted** → §3.3–3.4 |
| Lock leaves when the identity (e-mail) changes | feedback-v1 B4 (rev. 1 already had it) | **Accepted** → §3.6 |
| `notice` / `setNotice` for `SESSION_EXPIRED`, independent of errors | feedback-v3 §2 (replaces v2 §5) | **Accepted** → §3.8 |
| Secondary action with `leaving` state and recovery | feedback-v3 §3 (replaces v2 §4) | **Accepted** → §14.3 rule 4 |
| Password kept on transient errors | BMAD R1 (Sally); feedback-v1 | **Accepted** → §3.5 |
| Clear the local token before `captcha.reset()` | feedback-v1 B4 | **Accepted** → §4 |
| Setters do not fire notifications | BMAD R1 (Amelia AC-22); feedback-v1 B5 | **Accepted** → §10 |
| Typed message keys, per-locale overrides | BMAD R1 C8 | **Accepted** (rev. 1 already per-locale) → §7 |
| "Token-faithful", pinned commit | BMAD R1 C7; feedback-v1 | **Accepted** → §2. (The draft's claim that GCDR does not use Nunito was wrong — corrected in rev. 2.1) |
| Style in `getRootNode()`, nothing on import, nonce, CSSOM properties | BMAD R1 C9/C10 (Winston); feedback-v1 | **Accepted** → §1, §2 |
| Focus trap, focus restoration, ref-counted scroll lock, `inert` restore, z-index table | BMAD R1 C11; feedback-v1 B6 | **Accepted** → §14.4 |
| Modal mounts on `document.body` only (no `container`) | BMAD R1 (Winston); feedback-v1 B6 | **Accepted** → §14.1 |
| Input ergonomics, touch targets, reflow, reduced motion, contrast 1.4.11 | BMAD R1 (Sally) | **Accepted** → §11 |
| Measured size delta, subpath export | BMAD R1 C10; feedback-v1 | **Accepted** → §15 |
| Host-side coordinator for many widgets | feedback-v2 §2 | **Accepted as guidance** → §14.4 |
| Normative "host must not show protected data before success" | BMAD R1 (John) | **Accepted** → §16 |
| `rememberMe` hidden by default | BMAD R1 C12; feedback-v1 | **Rejected for v2**: rev. 1 wires it (stores the e-mail only), so the reason no longer applies |
| Silent singleton; global events `myio:login-*` | draft; BMAD R1 C3 | **Rejected** (Rationale) |
| `createGcdrLoginSubmit()` helper | BMAD R1 (John) | **Superseded**: rev. 1's built-in `gcdr` client |
| Captcha adapter interface | draft | **Superseded**: rev. 1's built-in Turnstile |
| Card-only scope, no aside, no wallpaper | draft non-goals | **Superseded** by rev. 1 |
| `reauth` mode with locked e-mail | BMAD R1 C6 | **Deferred** (Future possibilities) |
| MFA `status: 'challenge'` discriminant | BMAD R1 (Winston) | **Deferred** |
| "Password never in a closure" | BMAD R1 (Amelia AC-33) | **Rejected** as stated (impossible for an async callback); replaced by §16 |
| `premium-modals/auth/` folder and `myio-auth-` prefix | BMAD R1 (Winston) | **Superseded**: the `myio-glv` root/prefix covers inline and modal |
| First consumer | BMAD R1 (John); feedback-v2 §3 | **Answered** by rev. 1: Data-Ingestion (phase 2) |

## Appendix C — Review history

| Date | Document | Status |
|---|---|---|
| 2026-10-01 | `RFC-0236-Premium-Login-Modal.md` + BMAD Round 1 | historical; retired as a design (Appendix A) |
| 2026-10-01 | `RFC-0236-Premium-Login-Modal-feedback-v1/-v2/-v3.md` | historical; v3 supersedes v2 §4–§5 |
| 2026-10-03 | `RFC-0236-GCDR-Login-View.md` (rev. 1) | base of this revision |
| 2026-10-03 | this document (rev. 2) | superseded by rev. 2.1 |
| 2026-10-03 | technical review of rev. 2 (owner-provided) | folded in as rev. 2.1, see below |
| 2026-10-03 | `RFC-0236-GCDR-Login-View-v2.md` (rev. 2.1) | frozen; copied as rev. 3 |
| 2026-10-03 | `RFC-0236-GCDR-Login-View-v3.md` (rev. 3) | BMAD Round 3 run (Appendix E); frozen, copied as rev. 4 |
| 2026-10-03 | technical review of rev. 3 | Appendix F; factual corrections applied in rev. 4 |
| 2026-10-03 | this document (rev. 4) | decisions E.7 pending owner |
| 2026-10-04 | owner answered E.7 (F.3a); scope change shell + login view + auth strategy (F.3b); ED-1318 opened (F.3c) | rev. 5 needs a BMAD round on F.3b before PR 1 |
| 2026-10-04 | rev. 4 corrections (no decision involved) | revision number in header; stale D.4 row; real bundle baseline in §15/Drawbacks; QR notes in Summary/§1.1/§2/§5/showcase; F.1 row F3′, F.3-2 marked as unreviewed proposal, frontend hash; F.3a records owner decision 1 |

**rev. 2 → rev. 2.1 changes** (from the 2026-10-03 technical review, GCDR claims
verified in `gcdr.git` / `gcdr-frontend.git`):

| Change | Why |
|---|---|
| §1.3 rewritten with the real GCDR contract: `403 ACCOUNT_LOCKED` (no date), `401 UNAUTHORIZED` for unknown/unverified/pending/inactive (text only), `200 { mfaRequired }` | rev. 2 assumed `423` + `lockedUntil`, codes `ACCOUNT_INACTIVE`/`EMAIL_NOT_VERIFIED` and MFA as an error — none exist. A `200` MFA challenge would have reached `onSuccess` without a session |
| `ACCOUNT_INACTIVE`, `EMAIL_NOT_VERIFIED`, `lockedUntil` removed; aliases map to `INVALID_CREDENTIALS` | not emitted by GCDR; distinct codes before password check would structure an enumeration leak |
| Timeouts: `gcdr.timeoutMs` 15 s restored (rev. 1 value); `submitTimeoutMs` 30 s for `onSubmit` only | rev. 2 replaced 15 s by a global 30 s without saying so |
| Nunito removed from the allowed visual differences | GCDR already uses Nunito |
| Examples use the real ports: "Acesso Ingestion" `#D35400`, Alarms `#AF3463` | rev. 2 still showed the default purple |
| `GcdrLoginMessageKey` is a literal union | rev. 2 typed it as `string` |
| Visual check: manual showcase checklist by default; Playwright is Q10 | Playwright is not a library dependency |
| Modal `scope: { element }` added; ThingsBoard `inert` note | a widget that does not own the page must not freeze the TB UI. The review's "modal escapes the iframe" concern does not apply (TB widgets are not iframed); a plain `container` option was **not** reintroduced (fixed overlay under a transformed ancestor) |
| Rollout split: PR 1 inline + GCDR client, PR 2 captcha, PR 3 modal, PR 4 secondary action / `leaving` | smaller first delivery; single instance stays in PR 3 (needed for many widgets on 401) |
| rev. 1 file (`RFC-0236-GCDR-Login-View.md`) marked superseded | this document is the base |

## Appendix D — Session record, 2026-10-03

Everything that was found and decided while producing this revision, so that
no part of it lives only in a chat or in an ignored `logs/` file.

### D.1 Two documents with the same number

| | Premium Login Modal | GCDR Login View |
|---|---|---|
| File | `RFC-0236-Premium-Login-Modal.md` (+ `-feedback-v1/-v2/-v3.md`) | `RFC-0236-GCDR-Login-View.md` (rev. 1) → this file |
| Date | 2026-10-01, ED-1305 | 2026-10-03 |
| Entry point | `openLoginModal(params)` | `createGcdrLoginView(container, options)` |
| Shape | card-only modal over the page, 3 backdrops, callbacks only | full GCDR screen (wallpaper, aside, QR) in a container, built-in GCDR client, built-in Turnstile |
| Where | committed only on `feat/ED-1305-modal-login-myio` (commit `26da1e70`, 2026-10-01 14:28, the branch's single commit ahead of `desenv`; no PR ever opened) | written untracked on a `desenv` checkout; carried to `feat/ED-1305-modal-login-myio` on checkout |

**Why the older draft was "missing":** it was never merged into `desenv` and no
PR existed, so a `desenv` checkout did not show it and the owner did not
remember it when the GCDR Login View was written.

**Owner decision (2026-10-03):** the GCDR Login View is the newer design and
the base; reuse what makes sense from the Premium Login Modal; produce
`RFC-0236-GCDR-Login-View-v2.md` on `feat/ED-1305-modal-login-myio`; take v2 to
a BMAD round. Result: this file (Appendix A lists the reuse).

### D.2 BMAD Party Mode Round 2 — on the *Premium Login Modal* draft

Run before v2 existed; its subject is the retired draft, not this file. The
document-quality findings (📚 Paige) shaped how v2 is organised:

| Finding on the old draft | How v2 handles it |
|---|---|
| The body still prescribed behaviour that the four review layers had overturned (silent singleton, close-then-`onSuccess`, `SESSION_EXPIRED` as an error, `closed → reopen`, `NETWORK_ERROR` for malformed results, `showRememberMe: true`, "no callback ⇒ not rendered" vs theme toggle) | One normative body; history moved to Appendices A/C/D |
| Reviews overturned reviews (v3 over v2 §4–§5; v1 over R1 on `rem`) — reading chronologically gave the wrong answer | Appendix A records only the final position and its origin |
| AC ID collision: R1 AC-01…33 and feedback-v1 AC-01…14 used the same IDs for different things | One numbering AC-01…AC-18; old IDs declared retired |
| A fifth, invisible input: the owner's reservations behind feedback-v2/v3 lived in `logs/000-toCheck.log` (git-ignored) | This appendix and Appendix C replace it; no normative link points to `logs/` |
| Visual contract not testable: Tailwind names (`gray-300`, `red-300`), an undefined `orientation` input, state diagram ≠ state table | Appendix B hex only; orientation via `matchMedia`; §10 + §14.3 phase diagram with orthogonal dimensions and a submit-enabled rule |
| Missing artefacts: statechart, sequence for success/secondary exit, single error-normalisation table | §14.3 diagram and rules; §1.2 outcome table; §3.3 alias table |
| Consolidation plan: Decision log, review history in appendix, banner on superseded files | Appendices A/C/D; banner added to rev. 1 |

Open from that plan: move the old draft's feedback files under a
`reviews/` folder with a "historical, not normative" banner — not done; they
stay as committed in `26da1e70`.

### D.3 Technical review of rev. 2 (owner-provided, 2026-10-03)

Verdict of the review: approve v2 as the base, retire rev. 1, but fix the GCDR
error table first (blocking). Each point, its verification and its outcome:

| # | Review point | Verified | Outcome |
|---|---|---|---|
| 1 | §3.3/§1.3 do not match GCDR: lock is `403 ACCOUNT_LOCKED` without `lockedUntil`; inactive/pending/unverified are `401 UNAUTHORIZED` with the reason in text; MFA is `200 { mfaRequired, mfaToken }` (**blocking**) | ✅ `gcdr.git` `AppError.ts:51`, `AuthService.ts:169-204`, `:213-222` | Accepted → §1.3, §1.2, §3.3, §3.6, §12. Extra finding: status is checked **before** the password (enumeration) → codes not added, Q13 |
| 2 | Timeout changed 15 s → 30 s without justification | ✅ rev. 1 had `gcdr.timeoutMs: 15000` | Accepted → 15 s built-in, 30 s `onSubmit` (§1.1) |
| 3 | Nunito listed as allowed difference, but GCDR uses Nunito | ✅ `gcdr-frontend` `index.html:11`, `tailwind.config.js:13` | Accepted → §2, §13 |
| 4 | Ingestion example outdated ("Acesso Ingestion", `#D35400`; alarms in red) | ✅ `di-wt-login-gcdr-parity/packages/dashboard` (`auth-screen.css`, `translation.json`) | Accepted → Guide-level examples |
| 5a | Modal in ThingsBoard: `inert` on body siblings may freeze the host; modal may escape the iframe | Partly: TB widgets are **not** iframed (same Angular document); freezing TB is real and intended for a gate | Accepted as `scope: { element }` + TB note (§14.1) |
| 5b | Add `container` as mount target | — | **Not accepted as stated**: a fixed overlay under a transformed ancestor (TB grid) stops covering the viewport (feedback-v1 B6). Replaced by the explicit `scope: { element }` |
| 5c | Secondary action, `leaving` and single instance are too much for v1 | — | **Partly**: secondary action + `leaving` moved to PR 4; single instance stays in PR 3 (several widgets get 401 at once) |
| 6a | `GcdrLoginMessageKey` typed as `string` | ✅ | Accepted → literal union from GCDR `auth.json` keys |
| 6b | ACs cite Playwright, not a dependency | ✅ `package.json` has Vitest only | Accepted → manual showcase checklist by default; Q10 |
| 6c | QR panel (Q2) still open, was an original flag | ✅ | Accepted → listed to close before PR 1 |
| R1 | Approve v2 as base, mark rev. 1 superseded | — | Done: banner on rev. 1 (file kept, not deleted) |
| R3 | Phases: PR 1 inline + GCDR client, PR 2 captcha, PR 3 modal | — | Accepted, plus PR 4 for the secondary action (Rollout) |
| R4 | Close Q1, Q2, Q7, Q9 before code | Numbering differed from this file (review's "Q7 timeout" / "Q9 GCDR adopts" ≠ this file's Q7 links / Q9 purple / Q3 adoption) | Mapped by subject: **Q1, Q2, Q3, Q7** to close before PR 1; timeout already settled |

### D.4 State of the work and next steps

| Item | State |
|---|---|
| Branch | `feat/ED-1305-modal-login-myio` checked out in the library repo (7 commits behind `desenv`) |
| rev. 1, `-v2`, `-v3`, `-v4` | untracked — **not committed**; commit only with the owner's explicit OK (state as of rev. 4; this row was written for rev. 2.1) |
| BMAD round on rev. 2.1 | **done as Round 3 on this file (rev. 3)** — see Appendix E |
| Topics for the table | Q1 name · Q2 QR panel · Q3 GCDR adoption · Q7 default links · Q13 backend ticket · `scope: { element }` · awaited `onSuccess` vs "host returns ok only when ready" |
| Before PR 1 | close Q1, Q2, Q3, Q7; pin the `gcdr-frontend` commit for tokens; decide Q10 (Playwright) |
| Later, outside this RFC | GCDR backend: move the account-status check after password verification, then distinct codes (Q13) |
| Number collision | resolved by supersession: the Premium Login Modal is history under the same number; no renumbering |

## Appendix E — BMAD Party Mode Round 3 (2026-10-03, on rev. 3)

Four agents, each an independent subagent that read **only this file**:
🏗️ Winston (architect), 🎨 Sally (UX), 💻 Amelia (engineer), 📋 John (product);
plus 📚 Paige (technical writer) as recorder. **The body above has not been
changed** — these are proposed amendments pending the owner's decision.

### E.1 Verdicts

| Agent | Verdict | Blocking items |
|---|---|---|
| 🏗️ Winston | Approve with amendments | packaging/bundle (§15, Q5) · name (Q1) · no hard-coded environment URLs (§5, Q7) · cross-bundle shared state in the DOM (before PR 3) |
| 🎨 Sally | Approve with 2 blockers | PR 3 ships a `viewport` modal with **no way out** (secondary action only in PR 4) · dead-end states need a support contact |
| 💻 Amelia | PR 1 **not** ready to implement test-first | e-mail regex not in the RFC · no code → message-key table · GCDR error-body JSON paths missing · Q1/Q7 · what PR 1 does with `captcha`/`overlay` options |
| 📋 John | Not yet; approves once 4 items close | PR 1 must explicitly serve Data-Ingestion (`onSubmit` path) · success metrics · owner + date per phase · close Q1/Q2/Q3/Q7 |

### E.2 Fact check by the recorder (Paige)

Winston (F1) and Amelia (F14) treat the bundle limit "minified UMD ≤ 25 KB"
(from the repo's CLAUDE.md) as blocking. Checked in the repo on 2026-10-03:

- `scripts/size-check.js` does declare 25 KB (min UMD) / 50 KB (ESM, CJS), and
  `scripts/check-bundle-size.mjs` 26 KB gzip — **but neither runs** in
  `npm run build`, `postbuild`, `release` or `.github/workflows/ci.yml`.
- The current build is far beyond them: `dist/myio-js-library.umd.min.js` ≈ 6.0 MB,
  `dist/index.js` ≈ 5.8 MB (build of 2026-10-01).

So the limit is stale documentation, not an enforced gate. The architectural
point survives on its own merit (a login that every product pays for, even
when it never shows it): ship it **only** through the `myio-js-library/login`
subpath (+ a separate UMD file) — but §15 must state the real baseline instead
of the 25 KB figure, and fixing the stale size scripts/CLAUDE.md is a separate
library chore.

### E.3 Convergences (raised by two or more agents)

| # | Finding | Raised by | Proposed amendment |
|---|---|---|---|
| R3-C1 | **Q1 name → `createMyioLoginView` / `openMyioLoginModal`**; keep the `gcdr:` option name; Data-Ingestion does not authenticate against GCDR | Winston, John | Rename; CSS prefix decision (`myio-glv` → `myio-login`?) to be made with it |
| R3-C2 | **Q7 links hidden by default**; never hard-code `*.a.myio-bas.com` for products with their own users | Winston, John, Sally | Links shown only when set (or derived when `gcdr` is used — see E.4 D3); `footerText` default "Precisa de acesso? Fale com o administrador do sistema." for `onSubmit` hosts |
| R3-C3 | **`healthUrl` must not default to production** | Winston | Derive from `gcdr.apiUrl` when present, else hide the Status tile; use `gcdr.fetch ?? fetch`, timeout 5000 ms (Amelia F11) |
| R3-C4 | **Subpath mandatory in PR 1**; no re-export from the root | Winston, John, Amelia | `myio-js-library/login` (ESM/CJS) + `myio-js-library.login.umd.min.js` extending `window.MyIOLibrary`; closes Q5 |
| R3-C5 | **PR 1 scope must be explicit**: `onSubmit` path + `gcdr` client, Data-Ingestion config running in the showcase as exit criterion; what PR 1 does with `captcha`/`overlay` (throw vs ignore) | John, Amelia | Rewrite the PR 1 row; split mixed ACs a/b per PR (Amelia's table, E.5) |
| R3-C6 | **Q2 QR panel**: out of PR 1 | John (cut from v1; use `custom`), Amelia (not in PR 1), Sally (keep, with conditions) | See disagreement E.4 D1 |
| R3-C7 | **`scope: { element }` is underspecified** | Winston (no focus trap, no `aria-modal`, listeners on the overlay, query by element), Sally (8 widgets ⇒ 8 cards; widget smaller than the card), John (no consumer — defer) | See E.4 D2 |
| R3-C8 | **Q13: open the GCDR backend ticket now**, in parallel; status-before-password is a production enumeration leak | Winston, John, Sally | Ticket in the GCDR security backlog with an owner; Sally: record that the absence of `remainingAttempts` already signals "real account, wrong password" |
| R3-C9 | **Q3: GCDR stays the reference in v1**; adoption after phases 2–3 are stable, with an owner | Winston, John | Winston adds the pre-requisite R3-W2 (no backend → lib → frontend cycle) |

### E.4 Disagreements (owner decides)

| # | Topic | Positions |
|---|---|---|
| D1 | **QR panel (Q2)** | John: cut `kind:'qr'` from v1, host uses `custom` + `qrious` (≈5 lines in README). Sally: keep it, with mandatory `caption`, `value` also as text link, always dark-on-light with quiet zone, min 160 px — and the owner must still confirm the original intent (kiosk opening the app?). Amelia: neutral, just not in PR 1 |
| D2 | **Modal breadth** | John: freeze PR 3/PR 4 until a consumer with a date exists; modal v1 only `solid` + `viewport`; `blur`, `image`, `{ element }` to Future possibilities. Winston: keep `{ element }` but specify it (no trap, no `aria-modal`). Sally: keep, count element-scope modals in `isGcdrLoginModalOpen`, compact layout below 360×480 |
| D3 | **Default links when `gcdr` is used** | Winston: hidden unless `links.*`/`gcdrWebUrl` explicit (no env URL in the lib at all). Sally: with `gcdr`, "Esqueceu a senha?" → GCDR web, but "Criar conta" **hidden even then** (sign-up lands in `PENDING_APPROVAL`, which §1.3 shows as "invalid password" — a support-call loop). John: shown with `gcdr` |
| D4 | **Way out in PR 3** | Sally: blocking — add `overlay.exitHref` (`<a>`, no `leaving` phase needed) in PR 3, and make it mandatory for `viewport` + `dismissible:false`. John: the whole modal waits for a consumer, so the question moves with it |

### E.5 Findings by agent (not covered above)

**🏗️ Winston — architecture**

- R3-W2 — Expose `createGcdrLoginSubmit(gcdrOptions)` (returns an `onSubmit`) from the same subpath; `gcdr:` becomes sugar over it. One code path, contract test on a pure function, hosts can wrap it. Document which GCDR commit each library version covers. (Partly reverses Appendix A's "superseded" for the helper.)
- R3-W3 — Declare `GcdrLoginErrorCode` **open for growth in minor versions**; consumers need a `default` branch.
- R3-W4 — Shadow DOM contradiction (§1 `getRootNode()` vs §2 non-goal): inline view supported in a shadow root **without** captcha; `captcha` + shadow-root container ⇒ `TypeError`.
- R3-W5 — Cross-bundle state in the DOM: refcounts as attributes (`data-myio-glv-refs` on the `<style>`, `data-myio-scroll-lock` on `<html>`); style keyed by library version; README: mixed versions on one page unsupported for inline.
- R3-W6 — `onSuccess(session, { signal })` now (signal aborted on close/destroy); document `close()` as the way out of a hung `onSuccess`; no default timeout.
- R3-W7 — Modal = overlay shell **composing** `createGcdrLoginView(shellBody)`; `leaving` documented as modal-only in §10.

**🎨 Sally — UX**

- R3-S1 — `support?: { label; href } | false`, default the "Atendimento" tile link; shown in the locked banner, the MFA banner and the help below. Keeps help reachable with `aside:{kind:'none'}`.
- R3-S2 — Inactive/pending/unverified now read "invalid credentials": after the **2nd consecutive failure without a counter**, show a neutral help line (`errors.invalidCredentialsHelp`: "Se você tem certeza da senha, sua conta pode estar aguardando liberação. Fale com o suporte.") + `support`. No new codes needed.
- R3-S3 — Locked: say *who* unlocks (MYIO vs customer IT) via `support`; submit as `aria-disabled` + `aria-describedby` → banner (plain `disabled` leaves the Tab order silently).
- R3-S4 — MFA banner with the built-in client: link "Entrar pelo GCDR Web" (`gcdrWebUrl`). In a re-auth modal an MFA user can never pass — reinforces D4.
- R3-S5 — Session-expired copy in the modal should reassure ("…esta tela será mantida"); per-presentation key. With `initialEmail`, a "Não é você?" control that clears the e-mail (shift change) without waiting for `reauth`.
- R3-S6 — Wall/TV dashboards: with `'solid'`, a session that expires at night blanks the wall until someone arrives — correct for security, but write it in the TB note and README.
- R3-S7 — `CUSTOM` gets `clearPassword?: boolean` (default `true`); "system under maintenance" must not wipe the password.
- R3-S8 — a11y: own `aria-live="polite"` region for Caps Lock; with `autoFocus:false` on touch the modal still moves focus into the dialog (e.g. the title); check accent contrast on the `'solid'` backdrop too.

**💻 Amelia — implementation (missing values)**

| # | Where | Amendment |
|---|---|---|
| R3-A1 | §3.1 | Paste the e-mail regex (from `LoginForm.tsx` at the pinned commit) into the RFC |
| R3-A2 | new table | Code → message key: `SERVER` → `errors.loginFailed`?; `CUSTOM` without `message` → fallback; drop `errors.accountLocked` or define it vs `lockedTitle/lockedText`; §7 `tooManyAttempts` vs union `errors.tooManyRequests` — one name |
| R3-A3 | §1.3 | JSON paths of the GCDR error body (`error.code`? `error.details.remainingAttempts`?); 200 without JSON; 401 with unknown `code`; 400 other than `CAPTCHA_FAILED` |
| R3-A4 | §10/§3.5 | `postLoginFailed`, `leaveFailed`, `captchaLoadFailed` are not error codes: add `message?: GcdrLoginMessageKey` to `getState()`; `onError` not fired for them |
| R3-A5 | §3.4 | Thresholds → keys: `>3` `invalidWithAttempts_*`; `2–3` `attemptsLeft_*` + `lockWarning`; `1` `lastAttempt`; `0`/invalid `invalidCredentials`; `2.5` is invalid |
| R3-A6 | §3.6 | Unlock when the normalised e-mail ≠ the locked attempt's e-mail, on `input`; returning to the same e-mail does not re-lock |
| R3-A7 | §3.1/§3.5 | "Then live" = revalidate on `input` of the failed field; focus to the first invalid field; `postLoginFailed` → password; touch = `matchMedia('(pointer: coarse)')` |
| R3-A8 | §7–§9 | Precedence `options` > storage > `navigator`; `startsWith('en')` → `en`, else `pt-BR`; remembered e-mail written on success only, removed on untick, `initialEmail` wins, checkbox pre-ticked when one is remembered |
| R3-A9 | §1.2 | Any `TypeError` → `NETWORK`; `AbortError` follows its cause (`TIMEOUT` or ignored) |
| R3-A10 | §1.1 | Validate non-empty `gcdr.apiUrl`/`tenantId`, valid `gcdr.timeoutMs`, `container instanceof HTMLElement`; all `TypeError` with fixed messages |
| R3-A11 | §4 vs §3.5 | "reached the server" vs "always": reset the captcha on every attempt that called `onSubmit`/the client |
| R3-A12 | §14.3 | Inline: `success` is terminal until `reset()` — say so |
| R3-A13 | §11 | Contrast warning: white on `accent` and on `tint`, ≥ 4.5; fixed `console.warn` text |
| R3-A14 | AC-18 | Needs a pass/fail criterion (see E.2 for the real baseline) |
| R3-A15 | Status | Header cited Appendix E before it existed — resolved by this appendix |

ACs per PR (mixed ACs split a/b): **PR 1** — 01 (create/import), 02, 03, 04, 05, 06, 07a, 08, 09 (inline), 10a, 11, 15, 16a, 17a, 18 · **PR 2** — 07b, 10b · **PR 3** — 01 (open), 09 (before `onOpen`), 12, 13a, 14, 16b, 17b · **PR 4** — 13b.
jsdom cannot cover AC-16/AC-17 (layout, reflow, zoom, `backdrop-filter`), font fallback, image failure with layout kept → showcase checklist.

PR 1 test files (`tests/components/gcdr-login/`): `import-side-effects`, `style-injection`, `options-validation`, `form-validation`, `controller-state`, `outcome-normalisation`, `remaining-attempts`, `timeout-abort`, `after-attempt`, `on-success`, `notice`, `security-leak`, `handle-lifecycle`, `i18n`, `storage`, `render-show-aside`, `gcdr-client.contract` (+ `tests/fixtures/gcdr-auth/*.json` copied from `gcdr.git`); outside Vitest: UMD smoke in `scripts/smoke-test`, `showcase/gcdr-login/` checklist, size report.

**📋 John — product**

- R3-J1 — Add **Success metrics**: (a) Data-Ingestion hand port deleted (~2,500 lines) by D1; (b) alarms PR #26 port deleted by D2; (c) zero new hand-drawn login copies in 6 months; (d) a new host integrated in < 1 day; (e) visual checklist passing against the pinned `gcdr-frontend` commit.
- R3-J2 — Add **Owner** and **Target** columns to the Rollout table (phases 2–4 depend on other repos and teams).
- R3-J3 — PR 1 aside: keep `about`, `custom`, `none`; drop the `subjects` override until a host asks.
- R3-J4 — **Drift owner**: someone named runs the visual checklist on every GCDR release until (if) GCDR adopts the library.

### E.6 Paige (recorder) — document quality of rev. 3

- The two reviewers who can block PR 1 (Amelia, John) block on **missing values and ownership**, not on design — a good sign: the design converged in rev. 2.1.
- Stale text in rev. 3 to fix in the next pass: §15 and Drawbacks cite a size budget that is not enforced (E.2); D.4 called this file "rev. 2.1".
- The outcome table (§1.2) gained an MFA row whose "Code shown" cell says "host's responsibility" — move it to a note under the table; the table should hold codes only.
- `GcdrLoginMessageKey` is defined twice (literal union + "generated from the dictionary"): state which one is the source of truth (the dictionary, with the union generated and checked in) to avoid two lists drifting.
- The single-instance rule (§14.3 rule 1) and its `{ element }` exception (§14.1) live in different sections — cross-reference them, or resolve D2 first.

### E.7 Decisions requested from the owner

1. **Q1 name** — `createMyioLoginView` / `openMyioLoginModal` (Winston + John) or keep `Gcdr`; and the CSS prefix with it.
2. **Q2 QR panel** — cut (John) or keep with Sally's conditions; confirm the original intent.
3. **Q7 / D3 links** — hidden by default; with `gcdr`, forgot-password only, or both, or none.
4. **Modal scope for v1 (D2/D4)** — freeze PR 3/4 until a consumer with a date (John), or ship PR 3 with `exitHref` (Sally) and a specified `{ element }` (Winston).
5. **`createGcdrLoginSubmit` helper** (R3-W2) — reverses Appendix A's "superseded"; accept or not.
6. **Owners and dates** per phase; the drift owner (R3-J2, R3-J4).
7. **Q13** — open the GCDR backend ticket now (unanimous).
8. **Bundle baseline** — accept E.2 (subpath mandatory, real baseline in §15) and open a separate chore for the stale size scripts / CLAUDE.md.

**Next step suggested:** answer E.7, then one consolidation pass producing
rev. 4 with Amelia's missing values (R3-A1…A13), the PR 1 scope and AC split,
success metrics and owners — after which PR 1 can start test-first.

## Appendix F — Technical review of rev. 3 (2026-10-03)

Reviewer read the whole of rev. 3 and checked every GCDR claim against
`gcdr.git` / `gcdr-frontend.git` (`origin/desenv`, 2026-10-03; `gcdr-frontend`
`origin/desenv` was at `d71179b` when re-checked on 2026-10-04 — the local
checkout was on another branch, so the pinned-commit rule of §2 must name a
hash, not a branch).

**Verdict:** the design is mature and §1.3 matches GCDR. PR 1 is not ready yet:
the E.7 decisions are open, three Round 3 findings rest on wrong facts, and the
document is spread over too many files.

### F.1 Facts corrected (applied in the body of rev. 4)

| # | Round 3 statement | What the code says | Applied in |
|---|---|---|---|
| F1 | Q2 / R3-C6 / D1 treat the QR panel as a QR **generator** (`kind:'qr'`, `qrious`) | GCDR has two logins on one `AuthSplitLayout`: `/login` → `AuthAboutPanel`; `/qr-code` → `QrSignInPrompt` (lock icon + fixed text) and `LoginForm submitStyle="hotPage"` (`QrCodeEntry.tsx:36-44`, `QrSignInPrompt.tsx`). The owner's original flag ("show the *Sobre a MYIO* div, or rather the div where the QR code is") is the **aside slot** | Q2 |
| F2 | R3-A1: "paste the e-mail regex from `LoginForm.tsx`" | No regex in `LoginForm.tsx`; validation is Zod `.email()` in `src/schemas/auth.ts:7` | §3.1 |
| F3 | R3-C8 (Sally): "the **absence** of `remainingAttempts` already signals real account, wrong password" | Inverted: unknown e-mail → `401 UNAUTHORIZED` without counter; existing account + wrong password → `401 INVALID_CREDENTIALS` **with** counter. The **presence** of the counter (and the different code) reveals the account, independently of the status-before-password order | §1.3, Q13 |
| F3′ | Consequence of F3 for R3-S2 (Sally's help line "after the 2nd consecutive failure **without a counter**") | "Without a counter" covers an unknown e-mail **and** inactive / pending / unverified accounts. The proposal survives — its suggested text is neutral ("…sua conta pode estar aguardando liberação. Fale com o suporte.") and fits both — but its trigger must not be read as "real account" | carry R3-S2 into rev. 5 with this reading |
| F4 | R3-A3: JSON paths of the error body unknown | `{ success:false, error:{ code, message, details? }, meta:{ requestId, timestamp } }`; counter at `error.details.remainingAttempts`; limiters answer `error.code: 'RATE_LIMITED'`; `/auth/login` has only the global limiter | §1.3, §3.3 |

### F.2 Document organisation

- Three files now carry this RFC's body (rev. 1, `-v2` — itself edited after
  rev. 3 was copied —, `-v3`, and this `-v4`), plus four files of the retired
  Premium Login Modal: seven files under number 0236. Near-identical copies will
  drift.
- Recommendation: once E.7 is answered, the consolidation pass writes **one**
  normative file `RFC-0236-GCDR-Login-View.md` (revision in the header, history
  in git); Appendices C/D/E/F move to `reviews/RFC-0236-history.md`; the
  `-v2`/`-v3`/`-v4` copies are removed. The normative body (~1,190 lines) is
  heavy for one component; moving the process appendices out is the cheapest cut.

### F.3 Reviewer's recommendation on the E.7 decisions (owner decides)

| # | Decision | Recommendation |
|---|---|---|
| 1 | Q1 name | `createMyioLoginView` / `openMyioLoginModal`, CSS prefix `myio-login`; keep the `gcdr:` option name (Data-Ingestion does not authenticate against GCDR) |
| 2 | Q2 QR panel | Cut `kind:'qr'`. v1 aside = `'about' \| 'custom' \| 'none'`, optionally `'signedOutPrompt'` (GCDR's `QrSignInPrompt`: lock icon + one localized text) and a `submitStyle: 'auth' \| 'hotPage'` option, which is what GCDR itself varies between its two logins (F1). **Status: proposal, not yet reviewed by the table** — new public API; rev. 5 must specify what `hotPage` changes visually (`LoginForm.tsx:166`) and whether `qrCode:signedOut.text` enters the library's dictionaries |
| 3 | Q7 / D3 links | Hidden by default. With `gcdr`: only "Esqueceu a senha?", and only with an explicit `gcdrWebUrl` (no environment URL hard-coded in the library). "Criar conta" never by default (Sally's `PENDING_APPROVAL` loop) |
| 4 | Modal scope (D2/D4) | Freeze PR 3/PR 4 until a consumer with a date exists (John); `{ element }` to Future possibilities. If PR 3 ships earlier, it ships with Sally's `exitHref`, mandatory for `viewport` + `dismissible:false` |
| 5 | `createGcdrLoginSubmit` (R3-W2) | Accept: one code path; the GCDR contract test becomes a pure-function test; `gcdr:` is sugar over it |
| 6 | Owners and dates | Owner's call; PR 1 must at least name the drift owner (R3-J4) |
| 7 | Q13 | Open the GCDR backend ticket now, with the wider scope of F3 (Q13 a–c) |
| 8 | Bundle baseline | Accept E.2: subpath mandatory in PR 1, real baseline in §15; separate chore for the stale size scripts / CLAUDE.md |

### F.3a Owner decisions recorded (2026-10-04)

| # | Decision | Owner's answer | Effect |
|---|---|---|---|
| 1 | Q1 name | **`createMyioGcdrLoginView`** | Applied in rev. 5 (not renamed in this body yet). Type prefix (`MyioGcdrLogin*`?) and CSS prefix (`myio-glv` kept or renamed) to settle in rev. 5 |
| 2 | Q2 "QR panel" | **Neither a QR generator nor only the lock prompt.** On GCDR's hot page `/qr-code`, after sign-in the same screen becomes a **mini application**: the area where the login card was turns into the QR-label detail, and the signed-in user is shown above it. That content is GCDR's responsibility. What GCDR needs from the library is the **skeleton of the screen** (layout, bands, slots, toolbar, build line), into which it renders its own content — "a standard interface SDK of the library" | **Scope change for rev. 5** (see F.3b): split the RFC into a **shell** (layout SDK with host-rendered slots that survive sign-in) and the **login view** built on that shell. `kind:'qr'` is cut; `signedOutPrompt` becomes just one possible aside content. Needs a table review |
| 3 | Q7 links | **Follow the recommendation for now** (hidden by default; with `gcdr` only "Esqueceu a senha?" and only with an explicit `gcdrWebUrl`; "Criar conta" never by default) — **but the component must already be prepared for the next phase: Auth0 concentrated in GCDR for every MYIO system** | rev. 5: authentication becomes a pluggable strategy (see F.3b); links and the submit path come from the strategy, so a future GCDR-hosted / Auth0 strategy (redirect / universal login) can be added without breaking the API |
| 4 | Modal scope | **Both presentations in v1**: one factory for inline and one for the modal — owner's naming idea: `createMyioGcdrLoginView` and `openModalMyioGcdrLoginView` | PR 3/PR 4 are **not** frozen. Final modal name to confirm in rev. 5 (`openModalMyioGcdrLoginView` as proposed by the owner vs `openMyioGcdrLoginModal`). Sally's way-out requirement for a `viewport` modal with `dismissible:false` (E.4 D4, `exitHref`) carries into rev. 5 as a proposal |
| 5 | `createGcdrLoginSubmit` (R3-W2) | **Accepted** (Winston): the GCDR call is also exported as a separate function the host can use or wrap (e.g. telemetry); for `gcdr: {…}` users nothing changes; one code path, easier to test | rev. 5: export it (proposed name `createMyioGcdrLoginSubmit`); `gcdr:` becomes sugar over it; it is the first implementation of the auth-strategy interface of decision 3. Reverses Appendix A's "superseded" for the helper |
| 6 | Owners and dates | **Left open** | Rollout keeps no owner/date columns for now; recorded as open |
| 7 | Q13 GCDR backend ticket | **Open it**: Jira, ED (board 166), assigned to Rodrigo, Sprint 20 | Created as **ED-1318** — F.3c |
| 8 | Bundle / packaging | **"Everyone will use it"** — every MYIO product will show this login | The login ships in the **main bundle** (no mandatory subpath); a `myio-js-library/login` subpath may still be added for ESM tree-shaking but is not required. The stale size scripts / CLAUDE.md chore was not answered — still open |

### F.3b Consequences of decisions 2, 3 and 5 for rev. 5 (proposal, needs table review)

```text
Layer 1  — Shell (layout SDK)          createMyioGcdrShell(container, options)  [name TBD]
           wallpaper · toolbar (theme, language) · split layout · aside slot ·
           main slot · bands · build line · theme/locale state · injected CSS
           Slots are host-rendered (render(el) → cleanup) and can be swapped
           at runtime (e.g. login card → QR-label detail after sign-in), plus a
           header slot for "signed-in user".
Layer 2  — Login view                  createMyioGcdrLoginView / openModalMyioGcdrLoginView
           the access card (form, banners, captcha) rendered into the shell's
           main slot; aside content = 'about' | 'signedOutPrompt' | custom | none
Layer 3  — Auth strategy               onSubmit (host) | createMyioGcdrLoginSubmit (GCDR, today)
                                       | future GCDR-hosted / Auth0 strategy (redirect)
```

- GCDR's hot page `/qr-code` would use Layer 1 directly (and Layer 2 while
  signed out), swapping the main slot to its own mini application after sign-in.
- The future Auth0-in-GCDR phase adds a Layer 3 strategy whose "submit" is a
  redirect to the hosted login; Layer 2 then shows a single "Entrar com MYIO"
  action instead of the form. The strategy interface must allow that **now**
  (no `email/password`-only assumption in the shell or in the handle).
- Open questions for the table: name of the shell; whether Layer 1 ships in
  PR 1 (it is the base of the view, so probably yes); the slot contract
  (lifecycle, cleanup, theme/locale propagation to host content); whether the
  modal is a Layer 1 presentation or a Layer 2 one.

### F.3c GCDR backend ticket (decision 7)

Created 2026-10-04: **[ED-1318](https://myio.atlassian.net/browse/ED-1318)** —
"GCDR — Login permite enumeração de contas (e-mail inexistente vs senha errada;
status checado antes da senha)", project ED, board 166, **Sprint 20**, assigned
to Rodrigo Lago, labels `security`/`gcdr`/`auth`. Scope = Q13 (a)–(c). No parent
set: the owner said "ED 166", which is the ED board; the issue `ED-166` is an
unrelated, closed ticket. Candidate epic if wanted: ED-784 "GCDR".

### F.4 Next step

Owner answers E.7 (F.3 as input) → one consolidation pass (rev. 5, single file,
F.2) with Amelia's missing values R3-A2…A13 (A1 and A3 as corrected in F.1), the
aside scope of decision 2, the PR 1 scope and AC split, success metrics and
owners → PR 1 test-first.
