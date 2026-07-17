# RFC-0224: Graceful Ingestion Token-Expiry Recovery (toast → session refresh → event)

- Feature Name: `graceful_ingestion_token_expiry_recovery`
- Start Date: 2026-07-17
- RFC PR: (leave this empty)
- Tracking Issue: (leave this empty)

## Summary

When a user stays on the **Shopping v-5.2.0** panel or on the **Head Office**
dashboards and keeps calling the ingestion (data-api) endpoints, the ingestion
**access token eventually expires** and requests start failing with an auth
error. Today this is handled inconsistently and badly: some call sites do a
**hard `window.location.reload()`**, others fail **completely silently**, and the
one event that was meant to coordinate a refresh (`myio:token-expired`) is
**dispatched but has no listener anywhere** — it is dead scaffolding.

This RFC proposes a **single, shared library helper**
`handleIngestionAuthFailure(...)` that, on any ingestion `401/403`, runs a
consistent, debounced, single-flight recovery:

1. **MyIOToast ERROR** — "Token de acesso expirado."
2. **MyIOToast WARNING** — "Atualizando a sessão no banco de dados por validade de
   token de acesso expirado…"
3. **dispatch `myio:token-expired`** (reusing the already-dispatched event name)
   plus two new lifecycle events `myio:session-refreshed` /
   `myio:session-refresh-failed`.
4. **Refresh the session in place** — `auth.clearCache()` + re-auth (common case),
   or re-read the credentials from ThingsBoard `SERVER_SCOPE` when the stored
   `client_id`/`client_secret` were rotated in the DB.
5. Optionally **retry the failed request once**, and only fall back to a full
   reload if the refresh itself fails.

No more silent failures, no more jarring full-page reloads. `window.location`
reload becomes the **last resort**, not the first response.

## Motivation

The reported symptom (verbatim): *"se ficarmos no painel 5.2.0 e também no dash
head office e chamamos endpoints do ingestion a api expira e dá um erro de token
api. Deveria ter um erro myio toast error, e depois um myio toast warning dizendo
que vai atualizar a sessão no banco de dados por validade de token de acesso
expirado. E tentar disparar um evento."*

The user also raised the concern that the ingestion auth is built with **`const`
credentials**, so it is unclear how a refresh could even work:

```js
// MAIN_VIEW/controller.js
const myIOAuth = MyIO.buildMyioIngestionAuth({
  dataApiHost: getDataApiHost(),
  clientId: latestCreds.CLIENT_ID,
  clientSecret: latestCreds.CLIENT_SECRET,
});
```
```js
// MYIO-SIM/v5.2.0_UNIQUE/controller.js
const myIOAuth = MyIOLibrary.buildMyioIngestionAuth({
  dataApiHost: DATA_API_HOST,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
});
```

This RFC resolves that concern (§3) and unifies the scattered, inconsistent
handling into one contract shared by v-5.2.0, Head Office v5.2.0_UNIQUE, v-5.4.0
and the premium modals.

## 1. How the auth primitive actually works

**File:** `src/services/ingestion/buildMyioIngestionAuth.ts` (TS source; a
hand-kept twin exists at `buildMyioIngestionAuth.js`; `AuthClient.ts` wraps it).

- **Token IS cached**, in a **module-global `Map`** keyed by
  `dataApiHost:clientId:clientSecret`. All instances built with the same creds
  share one cache entry (`token`, `expiresAt`, `inFlight`).
- **Auto-refresh is time-based only.** `getToken()` re-auths only when
  `now() >= expiresAt - renewSkewSeconds*1000` (default skew 60s); `expiresAt`
  comes from the server's `expires_in`.
- **Single-flight** is built in via `cache.inFlight` (concurrent refreshes for the
  same creds are deduped).
- **`requestNewToken()`** POSTs `{ client_id, client_secret }` to
  `${dataApiHost}/auth` with exponential-backoff retry.
- **`clearCache()`** nulls `token`/`expiresAt`/`inFlight`; `clearAllAuthCaches()`
  wipes every entry.
- **Critical gap:** the auth object **does not react to a downstream 401/403**. If
  the server rejects a token the client's clock still considers valid
  (server-side revocation, early expiry, clock skew, creds rotated in the DB),
  `getToken()` keeps returning the **same stale cached token**. There is no
  `onAuthError`, no forced-refresh flag. **The only lever is `clearCache()` then
  `getToken()`.**

### The `const` credentials question — resolved

The `const` creds are **not** the blocker. The auth closure re-POSTs
`client_id`/`client_secret` to `/auth` whenever it needs a fresh token:

- **Failure mode (a) — access token expired, creds still valid server-side:**
  fully recoverable with `auth.clearCache(); await auth.getToken();`. No new creds
  needed. **This is the common case.**
- **Failure mode (b) — the stored `client_id`/`client_secret` were rotated/revoked
  in the DB:** re-auth with the stale `const` creds will *also* `401` at `/auth`.
  Recovery requires **re-reading creds from ThingsBoard `SERVER_SCOPE`** (§5) and
  rebuilding the auth. The current code never does this — `getCredentials()`
  always returns the closure values captured once at `onInit`.

## 2. Existing 401/403 handling — two inconsistent, incomplete mechanisms

**File:** `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`

**Mechanism A — `MyIOUtils.handleUnauthorizedError(context)` (~lines 407-422):**

```js
handleUnauthorizedError: (context = 'API') => {
  LogHelper.error(`[MyIOUtils] 401 Unauthorized in ${context} - session expired`);
  const MyIOToast = window.MyIOLibrary?.MyIOToast;
  if (MyIOToast) MyIOToast.error('Sessão expirada. Recarregando página...', 6000);
  else console.error('[MyIOUtils] Sessão expirada. Recarregando página...');
  setTimeout(() => { window.location.reload(); }, 6000);   // <-- FULL PAGE RELOAD
}
```

Called from three `MyIOUtils.fetch*` helpers: `fetchEnergyDayConsumption` (~594),
`fetchGoalsDayTotals` (~653), `fetchGoalsConsumptionSeries` (~726). One error
toast, then a hard reload — no warning toast, no in-place refresh, no event.

**Mechanism B — `emitTokenExpired()` (~lines 7338-7345):**

```js
let tokenExpiredDebounce = 0;
function emitTokenExpired() {
  const now = Date.now();
  if (now - tokenExpiredDebounce < 60_000) return;   // 60s debounce (good)
  tokenExpiredDebounce = now;
  window.dispatchEvent(new CustomEvent('myio:token-expired', { detail: {} }));
}
```

Called from exactly one place: the orchestrator hydrate fetch (~6866). **`myio:token-expired`
has NO listener anywhere** (grep across `src/`: zero `addEventListener('myio:token-expired', …)`).
It fires and nothing happens. Same for `myio:orchestrator:error` and
`myio:token-rotated`.

So today the orchestrator's own data fetch fails **silently** (B is a no-op),
while the three Goals/Energy helper fetches do a **jarring full page reload** (A).
Neither refreshes the session in place. **This is the root cause of the reported
UX.**

> `src/thingsboard/MYIO-SIM/v5.2.0/MAIN/controller.js` is a near-exact twin of
> MAIN_VIEW and carries the same `emitTokenExpired`. The `bkp/` copies mirror it
> and are out of scope.

## 3. Toast + event system available

- **`MyIOToast`** — `src/components/MyIOToast.js`, exported at `src/index.ts:414`
  (reachable as `window.MyIOLibrary.MyIOToast`). API: `.error(msg, 5000)`,
  `.warning(msg, 3500)`, `.info`, `.success`, `.show(msg, type, duration)`; each
  returns `{ hide() }`. Toasts **stack** (up to 6), so an error toast followed by a
  warning toast render one above the other — exactly the requested sequence. Error
  `#d32f2f` 🚫, warning `#ff9800` ⚠️.
- **Event pattern** — `window.dispatchEvent(new CustomEvent('myio:…', { detail }))`
  with module-scope listeners. Existing token-related names already coined:
  `myio:token-expired`, `myio:token-rotated`. This RFC **reuses**
  `myio:token-expired` and **adds** `myio:session-refreshed` /
  `myio:session-refresh-failed`.

## 4. Ingestion call-site map (auth-failure handling today)

| File | Function / area | Endpoint | Current 401/403 handling |
|---|---|---|---|
| MAIN_VIEW `v-5.2.0` ~6862 | orchestrator hydrate (fetchAndEnrich) | `/telemetry/customers/{id}/{domain}/devices/totals` | `emitTokenExpired()` → **no listener (silent)** + throw |
| MAIN_VIEW ~588 | `MyIOUtils.fetchEnergyDayConsumption` | `/energy/devices/totals` | `handleUnauthorizedError` → **toast + full reload** |
| MAIN_VIEW ~648 | `MyIOUtils.fetchGoalsDayTotals` | `/{domain}/devices/totals` | `handleUnauthorizedError` → toast + reload |
| MAIN_VIEW ~723 | `MyIOUtils.fetchGoalsConsumptionSeries` | `/{domain}/` | `handleUnauthorizedError` → toast + reload |
| MAIN_VIEW ~748 | `MyIOUtils.fetchGoalsTemperature` | `/{domain}/` | none (returns `[]`) |
| TELEMETRY `v-5.2.0` | delegates to orchestrator (no direct calls) | — | inherits orchestrator behavior |
| HEADER / MENU `v-5.2.0` | KPI/summary via orchestrator events | — | none of their own |
| **HO SIM `v5.2.0_UNIQUE`** ~10233 | energy enrichment | `/…/energy/devices/totals` | `console.warn('Energy API error')` — **fully silent** |
| HO SIM `v5.2.0_UNIQUE` ~10256 | water enrichment | `/water/devices/totals` | `console.warn('Water API error')` — silent |
| HO SIM `v5.2.0_UNIQUE` (10 `buildMyioIngestionAuth` sites) | goals, temperature, trends, welcome counts | various | mostly `if(!res.ok) return null/[]` — silent |
| `v-5.4.0/controller.js` | all ingestion | various | **no 401/403 handling at all** (grep: 0 hits) |
| AllReportModal / premium modals via `AuthClient` | report totals | data-api | `AuthClient.clearCache()` exists but **no caller invokes it on 401**; no retry |

**Conclusion:** there is no single choke-point today; handling is scattered,
inconsistent, and mostly silent. The natural choke-points are (1) the library
auth object and (2) a shared `MyIOUtils`/orchestrator fetch helper.

## 5. Where credentials come from ("refresh session in the database")

**File:** MAIN_VIEW ~1962:

```js
const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt, tbBase);
CLIENT_ID       = attrs?.client_id || '';
CLIENT_SECRET   = attrs?.client_secret || '';
CUSTOMER_ING_ID = attrs?.ingestionId || '';
```

Creds live in ThingsBoard **CUSTOMER `SERVER_SCOPE`** attributes (`client_id`,
`client_secret`, `ingestionId`), fetched once at `onInit`, stored via
`MyIOOrchestrator.setCredentials(...)`, read back via `getCredentials()`. HO
UNIQUE has an equivalent bootstrap.

**"Refresh session in the DB" therefore means:** re-invoke
`fetchThingsboardCustomerAttrsFromStorage(...)`, re-`setCredentials(...)`,
`clearAllAuthCaches()`, and rebuild the ingestion auth — recovering failure mode
(b). For mode (a), no DB read is needed.

## 6. Guide-level explanation (proposed behavior)

On any ingestion `401/403`:

```
┌─ toast ───────────────────────────────────────────────┐
│ 🚫  Token de acesso expirado.                          │   (error, 6s)
├───────────────────────────────────────────────────────┤
│ ⚠️  Atualizando a sessão no banco de dados por         │   (warning, 6s)
│     validade de token de acesso expirado…              │
└───────────────────────────────────────────────────────┘
        │
        ├─ dispatch  myio:token-expired  { context, status, at }
        │
        ├─ auth.clearCache();  await auth.getToken()      ── mode (a) OK ──┐
        │        └─ if /auth also 401 → refreshCredentialsFromTB()          │
        │                              → clearAllAuthCaches() → getToken()  │  mode (b)
        │
        ├─ success → dispatch myio:session-refreshed { at }  → (optional) retry request once
        └─ failure → dispatch myio:session-refresh-failed { error }
                    → toast error "Não foi possível renovar a sessão. Recarregue a página."
                    → (last resort) reload
```

The whole sequence is **debounced (60s)** and **single-flight**: many parallel
domain fetches that all 401 at once produce **exactly one** toast pair and **one**
refresh, not N.

## 7. Reference-level explanation (proposed design)

### 7.1 Shared library helper

New: `src/services/ingestion/handleIngestionAuthFailure.(ts|js)`, exported from
`src/index.ts` (near `MyIOToast`, ~414), reachable as
`MyIOLibrary.handleIngestionAuthFailure` and bridged via `MyIOUtils` (per the
project's LIB_SYMBOLS bridge convention — MAIN_VIEW must add the new symbol to
`LIB_SYMBOLS`).

```js
// src/services/ingestion/handleIngestionAuthFailure.js  (SKETCH — not applied)
let _inflight = null;              // single-flight across concurrent 401s (module-global!)
let _lastAt = 0;                   // debounce
const MIN_INTERVAL_MS = 60_000;

export function handleIngestionAuthFailure({ context, status, getAuth, refreshCredentialsFromTB }) {
  const Toast = window.MyIOLibrary?.MyIOToast;
  const now = Date.now();
  if (_inflight) return _inflight;                       // concurrent 401s coalesce
  if (now - _lastAt < MIN_INTERVAL_MS) return Promise.resolve(false);
  _lastAt = now;

  Toast?.error('Token de acesso expirado.', 6000);
  Toast?.warning('Atualizando a sessão no banco de dados por validade de token de acesso expirado…', 6000);
  window.dispatchEvent(new CustomEvent('myio:token-expired', { detail: { context, status, at: now } }));

  _inflight = (async () => {
    try {
      const auth = getAuth?.();
      auth?.clearCache?.();                              // mode (a): drop stale token
      try {
        await auth?.getToken?.();                        // re-auth with same creds
      } catch {
        if (refreshCredentialsFromTB) {                  // mode (b): creds rotated in DB
          await refreshCredentialsFromTB();              // re-read SERVER_SCOPE + setCredentials
          window.MyIOLibrary?.clearAllAuthCaches?.();
          await getAuth?.()?.getToken?.();
        } else { throw new Error('cred refresh unavailable'); }
      }
      window.dispatchEvent(new CustomEvent('myio:session-refreshed', { detail: { at: Date.now() } }));
      return true;
    } catch (e) {
      window.dispatchEvent(new CustomEvent('myio:session-refresh-failed', { detail: { error: String(e) } }));
      Toast?.error('Não foi possível renovar a sessão. Recarregue a página.', 8000);
      return false;
    } finally { _inflight = null; }
  })();
  return _inflight;
}
```

### 7.2 Wiring at each choke-point

Redefine `handleUnauthorizedError` to **delegate** to the helper (reload becomes
the `session-refresh-failed` fallback), and route the orchestrator hydrate 401
through the same helper:

```js
// MAIN_VIEW ~6866 (SKETCH)
if (!res.ok) {
  if (res.status === 401 || res.status === 403) {
    const ok = await window.MyIOUtils.handleIngestionAuthFailure({
      context: 'orchestrator.hydrate', status: res.status,
      getAuth: () => myIOAuth,
      refreshCredentialsFromTB: window.MyIOUtils.refreshCredentialsFromTB,
    });
    if (ok) { /* optional single retry with fresh token */ }
  }
  throw new Error(`API error: ${res.status}`);
}
```

`refreshCredentialsFromTB` is a small new `MyIOUtils` function wrapping
`fetchThingsboardCustomerAttrsFromStorage(...)` + `setCredentials(...)`.

### 7.3 New/reused events

| Event | When | Payload |
|---|---|---|
| `myio:token-expired` (reused) | on the first 401/403 in a window | `{ context, status, at }` |
| `myio:session-refreshed` (new) | refresh succeeded | `{ at }` |
| `myio:session-refresh-failed` (new) | refresh failed after mode (a)+(b) | `{ error }` |

On the success path the helper should also call
`tokenManager.setToken('ingestionToken', freshToken)` so the **existing**
`myio:token-rotated` machinery (which already aborts/retries in-flight requests)
fires — downstream widgets that listen for it refresh without a page reload.

## 8. Adoption plan (files that would change)

- `src/services/ingestion/handleIngestionAuthFailure.(ts|js)` — **new** helper.
- `src/index.ts` — export `handleIngestionAuthFailure`.
- `.../v-5.2.0/WIDGET/MAIN_VIEW/controller.js` — add symbol to `LIB_SYMBOLS`;
  rewrite `handleUnauthorizedError` to delegate; add `refreshCredentialsFromTB`;
  route the hydrate 401 (~6866) and the 3 helper 401s (~594/653/726) through the
  helper; add a `myio:token-expired` listener (optional UX hook).
- `.../MYIO-SIM/v5.2.0/MAIN/controller.js` — twin changes.
- `.../MYIO-SIM/v5.2.0_UNIQUE/controller.js` (Head Office) — replace the silent
  `console.warn` energy/water branches (~10248/10296) and other `!res.ok` returns
  with the helper.
- `.../main-dashboard-shopping/v-5.4.0/controller.js` — add 401/403 detection
  (currently none) routed to the helper.
- Optionally `src/components/premium-modals/internal/engines/AuthClient.ts` /
  AllReportModal — invoke helper on 401.

## 9. Drawbacks

- Adds a public library symbol and two new events to maintain.
- Replaces the "predictable" full reload with an in-place refresh; if a downstream
  widget doesn't listen for `myio:session-refreshed`/`myio:token-rotated` it may
  keep showing stale data until its next natural refresh (mitigated by the token
  rotation hook, §7.3).

## 10. Rationale and alternatives

- **Per-widget handling (status quo):** rejected — that is exactly the drift this
  RFC removes; the two-toast UX, debounce, single-flight and event names must be
  identical everywhere.
- **Interceptor inside `buildMyioIngestionAuth` (auto-`clearCache` on 401):**
  attractive but the auth object never sees the downstream response (callers
  `fetch()` with `Authorization: Bearer <token>` themselves). Wiring a response
  interceptor would require every caller to route fetches through the auth object
  — a larger change. The helper approach keeps the auth primitive unchanged and
  only asks call sites to invoke one function on 401.
- **Keep the full reload:** rejected — the user explicitly asked for in-place
  session refresh with toasts + event; reload loses UI state and is jarring.

## 11. Risks & mitigations

- **Double/triple toasts** from concurrent 401s (many parallel domain fetches) →
  the `_inflight` single-flight + 60s debounce guarantees one toast pair + one
  refresh per window. Must be **module-level global** to actually coalesce.
- **Retry loops** when refresh "succeeds" but the server keeps 401ing (mode b with
  truly dead creds) → cap to a **single** retry per request; after
  `myio:session-refresh-failed`, stop and fall back to the reload path. No
  auto-retry inside the helper.
- **`clearCache` racing the auth's own `inFlight`** → call `clearCache()` (which
  nulls `inFlight`) **before** the recovery `getToken()`; the auth's single-flight
  then rebuilds cleanly.
- **`clearAllAuthCaches()` nukes every credential's cache** → acceptable on
  rotation (mode b) only; use per-instance `clearCache()` in mode (a).
- **Event-name compatibility** → keep `myio:token-expired`; only *add* the two new
  events.

## 12. Prior art / references

- Completes the dormant `emitTokenExpired` / `myio:token-expired` scaffolding in
  MAIN_VIEW (~7338).
- Related: **RFC-0199** (GCDR auth context / `MyIOAuthContext`), **RFC-0183**
  (AlarmServiceOrchestrator), **RFC-0198** (Tickets orchestrator) — all consume
  ingestion auth and would benefit from the shared recovery.

## 13. Unresolved questions

- Should the success path **auto-retry** the failed request, or just refresh and
  let the next natural fetch succeed? (Proposed: single opt-in retry per call
  site.)
- Should `v-5.4.0` adopt the helper in the same PR or as a follow-up (it currently
  has **zero** 401 handling)?
- Exact copy for the toasts (pt-BR) — this RFC proposes the strings the user
  dictated; confirm final wording.

## 14. Tracking

- Suggested Jira (project **ED**): one story for the library helper + MAIN_VIEW
  wiring; follow-up sub-tasks for HO `v5.2.0_UNIQUE`, `v-5.4.0`, and
  premium-modals adoption.
