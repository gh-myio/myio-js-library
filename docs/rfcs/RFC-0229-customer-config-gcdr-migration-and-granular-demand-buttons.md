- Feature Name: `customer-config-gcdr-migration-and-granular-demand-buttons`
- Start Date: 2026-08-10
- RFC PR: (leave this empty)
- Tracking Issue: (leave this empty)
- Companion RFC: GCDR **RFC-0057** (`gcdr.git/docs/rfcs/RFC-0057-Customer-Config-Document.md`) — the **backend counterpart** that owns the config document, its `GET/PUT/PATCH/DELETE /api/v1/customers/:id/config` endpoints, storage (`customers.config` jsonb), and secret handling. This RFC is the **client** side (Shopping widget, modal, theme). Where the two touch the wire, **RFC-0057 is authoritative**; this document conforms to it.

# Summary
[summary]: #summary

Three coupled changes to the Shopping dashboard (widget
`main-dashboard-shopping/v-5.2.0`):

1. **Granular button visibility.** Replace the single tri-state
   `canShowDemandButtons` customer flag — which today gates **both** the
   *📊 Pico de Demanda* and *⚡ Telemetrias Instantâneas* buttons for the whole
   customer — with a **2 features × 3 groups** matrix (per feature, per
   `entrada` / `areacomum` / `lojas`).
2. **Config source migration.** Move the customer's **SERVER_SCOPE attribute**
   configuration out of ThingsBoard (TB) and into a **GCDR customer-config**
   document, written at **SETUP** time, with a small set of attributes that must
   stay in TB because they *bootstrap* the GCDR connection itself.
3. **Client Config modal redesign.** Widen the modal, make it **theme-aware**
   (dark/light) using the `SettingsModalView` pattern, make **MAIN_VIEW the
   single source of truth** for the theme via `window.MyIOUtils`
   (`getTheme`/`setTheme`/`toggleTheme`), and add a theme toggle inside the
   modal.

# Motivation
[motivation]: #motivation

- **The demand flag is too coarse.** `canShowDemandButtons` is customer-wide and
  controls two distinct buttons at once. Operators need per-group control
  (e.g. show demand analysis for *Entrada* and *Área Comum* but never for
  *Lojas*), and ideally per-button. Today, with the flag set to `true`, the
  buttons even show for stores (`3F_MEDIDOR`) because the explicit value wins
  over the `deviceProfile !== '3F_MEDIDOR'` fallback (see
  `EnergyModalView.ts:354-360`).
- **Config is spread across TB attributes with two schemas.** Customer config
  lives in TB SERVER_SCOPE, read as **flat** keys by the runtime
  (`attrs?.gcdrApiKey`, …) but written **nested** inside a single
  `integration_setup` JSON by the iSetup modal — the reader and writer are on
  different shapes. TB attributes are also awkward to govern, version, and audit.
  GCDR already owns customer identity, rules, goals, and alarms; customer
  *config* belongs there too.
- **Theming is half-wired.** MAIN owns `MyIOUtils.currentTheme` (default
  `'light'`, in-memory only, no persistence) and fires `myio:theme-changed`, but
  the string getter is **overwritten** at `MAIN_VIEW:1993`
  (`MyIOUtils.getTheme = (mode) => createMyIOTheme(...)`), so `getTheme()` no
  longer returns the mode string. The Client Config (`mcc-`) modal is
  hardcoded light-only and participates in neither theme system.

# Guide-level explanation
[guide]: #guide-level-explanation

## 1. Granular button visibility

The customer config gains a `featureButtons` object:

```json
{
  "featureButtons": {
    "demandPeak":       { "entrada": true,  "areacomum": true,  "lojas": false },
    "instantTelemetry": { "entrada": true,  "areacomum": false, "lojas": false }
  }
}
```

Rendered in the Client Config modal as two rows of checkboxes:

```
Pico de Demanda:          [x] Entrada   [x] Área Comum   [ ] Lojas
Telemetrias Instantâneas: [x] Entrada   [ ] Área Comum   [ ] Lojas
```

> ✅ **Aligned with RFC-0057 v3.** Both sides use the **2×3 checkbox matrix**
> (three independent booleans per feature: `{entrada, areacomum, lojas}` —
> multi-select, so *"Entrada **e/ou** Área Comum"* is expressible). The earlier
> single-select scalar was RFC-0057 **v1** and no longer exists. The legacy
> backfill map is **identical** in both docs (see table below), and its **unset**
> row is the canonical default (RFC-0057 §DEC-3 / §DEC-5), reproducing the
> `deviceProfile !== '3F_MEDIDOR'` fallback.

At runtime, when a device card opens the energy modal, TELEMETRY resolves the
card's **group** (`Lib.resolveGroup(it, undefined, 'energy').group` →
`entrada` | `areacomum` | `lojas`) and passes **two independent booleans** to
the modal — one per button — looked up from the matrix. `EnergyModalView` gates
each button separately instead of gating both with one flag.

**Backward compatibility.** The legacy boolean maps to the matrix:

| legacy `canShowDemandButtons` | demandPeak (all groups) | instantTelemetry (all groups) |
|---|---|---|
| `true`  | all `true` | all `true` |
| `false` | all `false` | all `false` |
| `undefined` (unset) | `{entrada:true, areacomum:true, lojas:false}` | `{entrada:true, areacomum:true, lojas:false}` |

The `undefined` row reproduces the current `deviceProfile !== '3F_MEDIDOR'`
fallback (shown for Entrada/Área Comum, hidden for Lojas) for **both** buttons.

## 2. Where config lives (GCDR vs TB)

Customer config moves to the **GCDR customer-config document** defined by
**RFC-0057**, reached with the existing GCDR bootstrap credentials:

- **Endpoints (RFC-0057 §DEC-8):** `GET/PUT/PATCH/DELETE /api/v1/customers/:id/config`.
  The widget **consumes** `GET` (read) and writes via `PATCH` (deep-merge, e.g. only
  `featureButtons`); `DELETE` resets to defaults. Authorization (JWT reader/operator
  roles, API-key scopes `customers:read`/`:write`, the `SELF`/`SUBTREE`/`TENANT`
  hierarchy, **cross-tenant → `404`**) and the **three DTOs** (read/put/patch,
  §DEC-10) are **owned by RFC-0057**; this RFC only consumes them.
- **Inline is opt-in (RFC-0057 §DEC-11), not automatic.** `GET /api/v1/customers/:id?include=config`
  returns the resolved document under a **new** field **`configResolved`** (masked
  secrets); the existing raw `config` field (`{ bundle }`) is **left untouched**. Use
  this to avoid a second round-trip — do **not** assume config is embedded by default.
- **Storage (RFC-0057 §DEC-6):** the new sections live in the existing
  `customers.config` jsonb column — **no DB migration**; `settings`/`theme`/`metadata`
  are merged into the read model, which fills defaults so consumers never see
  `undefined`.
- **Secrets are OUT of the general config write path (RFC-0057 §DEC-7).**
  `ingestion.clientSecret` and `security.masterAdminPassword` are **masked (`***`) on
  read** and **cannot be written** via `PUT`/`PATCH /config` — sending a secret field
  there is rejected `400`, and `"***"` is never persisted (so the read-masked →
  write-back overwrite bug is structurally impossible). They are written only via a
  dedicated **`PUT /api/v1/customers/:id/config/secrets`** and revealed only via
  **`GET …/config/secrets`** — both **JWT-only** (no API key), gated by scope
  **`customers:secrets:read`**, with **mandatory audit**. Encrypted at rest via
  `secretEnvelope` (RFC-0056). The client (this RFC) reads masked values and never
  submits secrets through `/config`.
- **Bootstrap stays in TB SERVER_SCOPE** (cannot move — needed to *reach* GCDR):
  `gcdrCustomerId`, `gcdrTenantId`, `gcdrApiKey`, `gcdrSyncedAt`.
- **Everything else → GCDR customer-config**, written at SETUP.
- **Dropped (legacy):** all `qt*` keys.

## 3. Client Config modal

- **Wider**: from `min(520px, 95vw)` toward the premium-modal sizing
  (`SettingsModalView` uses `1700px / max 95vw`); target ~`min(880px, 96vw)` to
  fit the 2×3 matrix comfortably.
- **Theme-aware**: adopt the `.theme-dark` class pattern (light baseline + dark
  override) toggled on the modal root, subscribing to `myio:theme-changed`.
- **Theme toggle** in the modal header (left of the close button), calling
  `window.MyIOUtils.toggleTheme()`.
- **MAIN owns theme state**, persisted so it survives reload.

# Reference-level explanation
[reference]: #reference-level-explanation

## 3.1 Attribute inventory & disposition

Line numbers reference
`main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` unless noted.
Disposition: **GCDR** = move to GCDR customer-config · **TB-BOOT** = keep in TB
(bootstrap) · **DROP** = legacy.

| Attribute | Read | Runtime global | Default | Type | Disposition | Notes |
|---|---|---|---|---|---|---|
| `alarmNotificationsEnabled` | 2291 | `MyIOOrchestrator.alarmNotificationsEnabled` (2365) | `true` | bool | **GCDR** | |
| `canShowDemandButtons` | 2296 | `MyIOOrchestrator.canShowDemandButtons` (2370) | `undefined` | bool | **GCDR → replaced** | becomes `featureButtons` matrix |
| `client_id` | 2282 | `orchestrator.creds.CLIENT_ID` (2480) | `''` | string | **GCDR** | Ingestion API cred |
| `client_secret` 🔒 | 2283 | `orchestrator.creds.CLIENT_SECRET` (2480) | `''` | string | **GCDR** | **secret** |
| `customerDefaultDashboard` | 2293 | `MyIOOrchestrator.defaultDashboardId`/`.defaultDashboardCfg` (2367-2368) | `null` | json | **GCDR** | TB-specific but standardized to GCDR |
| `deviceClassificationProfile` | 2330 | `MyIOUtils.deviceClassificationProfile` (1394-1418) | baked floor profile | json | **GCDR** | RFC-0207 |
| `gcdrCustomerId` | 2287 | `MyIOOrchestrator.gcdrCustomerId` (2358) | `''` | string | **TB-BOOT** | reaches GCDR |
| `gcdrTenantId` | 2288 | `MyIOOrchestrator.gcdrTenantId` (2359) | `''` | string | **TB-BOOT** | `X-Tenant-ID` |
| `gcdrApiKey` 🔒 | 2289 | `MyIOOrchestrator.gcdrApiKey` (2361) | `''` | string | **TB-BOOT** | **secret**, `X-API-Key` |
| `gcdrSyncedAt` | (iSetup 1713) | — | `null` | string | **TB-BOOT** | sync timestamp |
| `inauguration_date` | — | — | — | — | **GCDR (metadata)** | orphan: no widget read |
| `integration_setup` | (iSetup 1698) | local `_gwData` | `EMPTY_DATA` | json | **GCDR / split** | nests ingestion + gcdr; see 3.3 |
| `isInternalSupportRule` | 2300 | `MyIOOrchestrator.isInternalSupportRule` (2381) | computed | bool | **GCDR** | → `alarms.showInternalSupport` (renamed, RFC-0057 §DEC-2). Customer display toggle — **not** the rule flag `rules.is_internal_support_rule` (RFC-0055) |
| `mapInstantaneousPower` | 2642 (onDataUpdated) | `MyIOUtils.mapInstantaneousPower` (2646) | `null` | json | **GCDR** | datasource-only read |
| `master_admin_password` 🔒 | (TELEMETRY 3446) | — | — | string | **GCDR** | **secret** |
| `maxTemperature` | 2596 (onDataUpdated) | `MyIOUtils.temperatureLimits.max` (2598) | `27` | number | **GCDR** | datasource-only read |
| `measurementDisplaySettings` | event 1748 | `MyIOOrchestrator.measurementDisplaySettings` | `null` | json | **GCDR** | RFC-0108 |
| `minTemperature` | 2588 (onDataUpdated) | `MyIOUtils.temperatureLimits.min` (2590) | `18` | number | **GCDR** | datasource-only read |
| `obs` | — | — | — | — | **GCDR (metadata)** | orphan: no widget read |
| `showOfflineAlarms` | 2298 | `MyIOOrchestrator.showOfflineAlarms` (2372) | `false` | bool | **GCDR** | |
| `temperatureClampMax` | 2613 (onDataUpdated) | `MyIOUtils.temperatureClampRange.max` (2617) | `40` | number | **GCDR** | |
| `temperatureClampMin` | 2604 (onDataUpdated) | `MyIOUtils.temperatureClampRange.min` (2608) | `15` | number | **GCDR** | |
| `tickets_enabled` | 2302 **and** 2625 | `MyIOUtils._ticketsRawEnabled` | `false` | bool | **GCDR** | dual-read |
| `tickets_only_to_myio` | 2307 **and** 2631 | `MyIOUtils.ticketsOnlyToMyio` | `true` | bool | **GCDR** | dual-read |
| `qt*` (qtDevices…) | — | — | — | — | **DROP** | legacy; no attr read exists |

🔒 = secret. In GCDR these are **write-only via the secrets endpoint and masked
on read** (RFC-0057 §DEC-7) — the client never fetches or submits their plaintext
through `/config`. MAIN already masks `gcdrApiKey` (2402-2407, wired earlier this
session) and truncates `CLIENT_SECRET` in logs (2336). Note `client_id`/
`client_secret` are **Ingestion** creds and `gcdrApiKey` is a **bootstrap** secret
(stays in TB), distinct from the config-document secrets above.

## 3.2 GCDR customer-config schema (authoritative in RFC-0057)

The document shape, storage and endpoints are **owned by RFC-0057**; reproduced
here (aligned to RFC-0057 §Guide) so the client contract is self-contained.
Secrets are **masked (`***`) by default**.

This is the **canonical default** read model (RFC-0057 §DEC-3/§DEC-5); the
`featureButtons` **unset** value is the same matrix as §1 above.

```jsonc
// GET /api/v1/customers/:id/config          (read: JWT reader | API key customers:read)
// GET /api/v1/customers/:id?include=config  → same doc under `configResolved`
{
  "version": 1,
  "featureButtons": {
    "demandPeak":       { "entrada": true, "areacomum": true, "lojas": false },
    "instantTelemetry": { "entrada": true, "areacomum": true, "lojas": false }
  },
  "alarms":      { "notificationsEnabled": true, "showOffline": false, "showInternalSupport": false },
  "tickets":     { "enabled": false, "onlyToMyio": true },
  "temperature": { "min": 18, "max": 27, "clampMin": 15, "clampMax": 40 },
  "display":     { "measurementDisplaySettings": null, "mapInstantaneousPower": null },
  "defaultDashboard": { "id": null, "cfg": null },
  "classificationProfile": null,                  // RFC-0207 shape
  "locale":      { "timezone": "America/Sao_Paulo", "locale": "pt-BR", "currency": "BRL" },
  "theme":       { "primaryColor": "…", "secondaryColor": "…" },
  "ingestion":   { "clientId": "…", "clientSecret": "***" },   // secret — masked, read-only here
  "security":    { "masterAdminPassword": "***" },             // secret — masked, read-only here
  "metadata":    { "inaugurationDate": null, "obs": "" }
}
```

`locale` mirrors `customers.settings`; `theme` mirrors `customers.theme`;
everything new lands in `customers.config` (RFC-0057 §DEC-6). Secret fields are
**masked and read-only** in this document — writing them is a `400` (use the
secrets endpoint). `isInternalSupportRule` (TB inventory) is reconciled in
RFC-0057 as **`alarms.showInternalSupport`** (default `false`) — a per-customer
display toggle for alarms produced by internal-support rules; **not** the
rule-level flag (`rules.is_internal_support_rule`, RFC-0055). The widget reads
this from `alarms.showInternalSupport`.

## 3.3 `integration_setup` reconciliation (the trickiest part of the backfill)

The single most error-prone piece. Two representations coexist for the **same
five credentials** and can disagree:

| Credential | Flat top-level (what the runtime READS) | Nested (what the iSetup modal WRITES) | Target |
|---|---|---|---|
| `client_id` | `attrs.client_id` (MAIN 2282) | `integration_setup.ingestion.clientId` (MENU 1772) | GCDR `ingestion.clientId` |
| `client_secret` 🔒 | `attrs.client_secret` (2283) | `integration_setup.ingestion.clientSecret` (1773) | GCDR **secrets** endpoint |
| `gcdrCustomerId` | `attrs.gcdrCustomerId` (2287) | `integration_setup.gcdr.gcdrCustomerId` (1776) | **TB-BOOT** |
| `gcdrTenantId` | `attrs.gcdrTenantId` (2288) | `integration_setup.gcdr.gcdrTenantId` (1778) | **TB-BOOT** |
| `gcdrApiKey` 🔒 | `attrs.gcdrApiKey` (2289) | `integration_setup.gcdr.gcdrApiKey` (1777) | **TB-BOOT** (secret) |

Only TELEMETRY's RFC-0195 path (4423-4444) reads the **nested** form; everything
else reads **flat**. So a customer configured only via the iSetup modal has the
nested keys populated and the flat keys empty (or stale) — the runtime may already
be running on stale/empty flat values today.

**Reconciliation rules for the one-time backfill (RFC-0057 §DEC-14):**

1. **Per key, resolve a single source of truth** with explicit precedence — prefer
   the **more recently written** representation; when only one is present, use it;
   when both are present and **disagree**, do **not** guess silently — record a
   conflict in the per-customer migration log and require review.
2. **Route by disposition, not by nesting:** `*.gcdr.*` → stays in **TB-BOOT**
   (bootstrap); `*.ingestion.clientId` → GCDR `ingestion.clientId` (config, non-secret);
   `*.ingestion.clientSecret` → GCDR **secrets** endpoint (never the general config,
   RFC-0057 §DEC-7).
3. **Idempotent + dry-run diff** before any write (RFC-0057 §DEC-14): re-running must
   converge; the diff surfaces the flat/nested conflicts above per customer.
4. **Do not delete the TB source** until the client cutover (dual-read, §3.4);
   `integration_setup` and the flat keys remain readable for rollback.

## 3.4 Runtime read path (dual-read during rollout)

A new `GcdrCustomerConfig` accessor on `MyIOOrchestrator`:

```
loadCustomerConfig():
  cfg = await GET /customers/{gcdrCustomerId}/config   // needs TB-BOOT creds
  for each field:
     value = cfg.<field>  ??  legacyTbAttr(<field>)     // fallback to TB attr
  publish onto the same globals used today (no consumer changes)
```

This keeps every downstream consumer (TELEMETRY, HEADER, FOOTER, MENU) unchanged
— they still read `MyIOOrchestrator.*` / `MyIOUtils.*`; only the *source* of
those values changes. `canShowDemandButtons` is derived from `featureButtons`
(or the legacy boolean via the mapping in the Guide section).

## 3.5 Energy modal changes

- `EnergyModalView` config gains `showDemandPeakButton` and
  `showInstantTelemetryButton` (booleans). The old `canShowDemandButtons`
  input is retained as a **deprecated** alias that sets both.
- The single `${this.canShowDemandButtons() ? …}` block
  (`EnergyModalView.ts:421-442`) splits so each `<button>` has its own guard.
- `TELEMETRY:3156` computes the card's group and passes the two booleans:
  ```js
  const grp = Lib.resolveGroup(it, undefined, 'energy').group; // entrada|areacomum|lojas
  const fb  = window.MyIOOrchestrator?.featureButtons;
  showDemandPeakButton:       !!fb?.demandPeak?.[grp],
  showInstantTelemetryButton: !!fb?.instantTelemetry?.[grp],
  ```
  `fb.demandPeak[grp]` is a boolean (the **checkbox** shape, settled on both sides
  per RFC-0057 v3 §DEC-3). `featureButtons` comes from the resolved config
  (`configResolved` / `GET /config`), defaulting to the §1 matrix when unset.

## 3.6 Theme system fixes

- **Fix the getter collision**: remove/rename the `MyIOUtils.getTheme = (mode)=>palette`
  reassignment at `MAIN_VIEW:1993` so `getTheme()` reliably returns the
  `'light'|'dark'` string; expose the palette factory under a distinct name
  (e.g. `MyIOUtils.getThemePalette(mode)`).
- **Persist** `currentTheme` (localStorage `myio:theme`) and initialize it from
  `ctx.settings.defaultThemeMode` on first load, so MAIN is a *durable* single
  source of truth.
- **Client Config modal**: add a `.theme-dark` override block for `mcc-*`,
  convert hardcoded surface colors, toggle `.theme-dark` on the modal root from
  a header button (`MyIOUtils.toggleTheme()`), and subscribe to
  `myio:theme-changed`. Widen `.mcc-card` to `min(880px, 96vw)`.

## 3.7 Migration mechanics (SETUP-focused)

1. **Phase 0 — schema & API (RFC-0057).** GCDR ships the customer-config document +
   `GET/PUT/PATCH/DELETE /api/v1/customers/:id/config` (+ inline on `GET /customers/:id`,
   optional `/config/secrets`) per RFC-0057 §DEC-8, storage in `customers.config`
   jsonb (§DEC-6), secrets via `secretEnvelope` (§DEC-7). Bootstrap creds
   (`gcdrCustomerId/TenantId/ApiKey/SyncedAt`) remain in TB. RFC-0057 §DEC-15 scopes
   this as the **MVP** (`featureButtons` + non-secret fields + `GET`/`PATCH` +
   `?include=config`); secrets endpoints, `PUT`/`DELETE`, and full audit are Phase 2.
2. **Phase 1 — dual-read (no behavior change).** Widget reads GCDR config first,
   falls back to the existing TB attr per field. Ship dark, verify parity.
3. **Phase 2 — SETUP writes to GCDR.** The **Pre-Setup / customer setup flow**
   writes config to GCDR (not TB SERVER_SCOPE). The Client Config and iSetup
   modals `PUT` to GCDR. A **one-time backfill** reads each existing customer's
   TB attrs (+ `integration_setup`) and writes the GCDR document, applying the
   `canShowDemandButtons` → `featureButtons` mapping and dropping `qt*`.
4. **Phase 3 — deprecate TB reads.** Remove TB-attr fallbacks (except bootstrap);
   keep `qt*` deletion. TB retains only the bootstrap set.

# Drawbacks
[drawbacks]: #drawbacks

- **Scope — three high-impact changes in one RFC.** This bundles (1) granular
  buttons, (2) the TB→GCDR config migration, and (3) the Client Config modal /
  **theme** redesign. Item (3) is **orthogonal** to the config migration — it
  neither depends on nor blocks GCDR RFC-0057. **Recommendation: split the theme /
  modal-redesign work into its own RFC (e.g. RFC-0230)** so the config migration can
  ship and be verified independently, and the theme fixes (getTheme collision,
  persistence, `.theme-dark` for `mcc-*`) land on their own risk budget. The two
  remaining items (buttons + migration) are genuinely coupled (buttons *are* the
  first migrated field) and stay together.
- **Production impact of the `canShowDemandButtons` change.** Every existing
  customer has the legacy boolean (or unset). The backfill + dual-read mapping
  must be exact or buttons appear/disappear unexpectedly. This is the
  highest-risk item and needs staged rollout + verification per customer.
- **Two schemas to reconcile** (`flat` vs `integration_setup`) increases backfill
  complexity.
- **Secrets now traverse GCDR** (`client_secret`, `master_admin_password`).
  Exposure is neutral vs today (TB attrs are already browser-readable) but the
  new endpoint is another place to get access control wrong.
- **An extra network round-trip** at startup (customer-config GET) on top of the
  existing bootstrap; needs caching.
- **Theme refactor touches a shared, half-broken system** (getTheme collision,
  two palettes) — risk of regressions in modals that already rely on
  `myio:theme-changed`.

# Rationale and alternatives
[rationale]: #rationale-and-alternatives

- **2×3 matrix vs two independent booleans vs keep one flag.** The matrix is the
  minimum that expresses "Entrada/Área Comum yes, Lojas no, per button", which is
  the stated need. Two global booleans (one per button) wouldn't give per-group
  control; one flag is the status quo being replaced.
- **Group-based resolution vs deviceProfile-based.** Groups
  (`entrada/areacomum/lojas`) are the operator's mental model and already exist
  in `STATE.energy`; `deviceProfile` is finer but the config UI is per-group.
  The legacy `!== '3F_MEDIDOR'` rule is preserved only as the unset-fallback.
- **GCDR vs TB for config.** GCDR centralizes governance/versioning/audit and is
  already the system of record for the customer. Keeping bootstrap in TB is
  unavoidable (chicken-and-egg). Doing nothing leaves config fragmented across
  two TB schemas.
- **Dual-read rollout vs big-bang.** Dual-read makes each phase reversible and
  keeps consumers untouched (they still read the same globals).

# Prior art
[prior-art]: #prior-art

- **GCDR RFC-0057 v3 (Customer Config Document)** — the backend counterpart of this
  RFC; owns the `customers.config` document, `GET/PUT/PATCH/DELETE /config` +
  `/config/secrets` endpoints, the three DTOs, the authz matrix, `secretEnvelope`
  masking, and the DEC-2 attribute→config-path map. This client RFC **conforms to
  it** and uses the **same 2×3 checkbox matrix** — shapes are aligned (no open
  conflict).
- RFC-0207 (`deviceClassificationProfile` as a JSON config) — precedent for a
  structured customer config document and dynamic group resolution.
- RFC-0139 (`MyIOUtils.currentTheme` + `myio:theme-changed`) — the theme state
  this RFC repairs and persists.
- `SettingsModalView.ts` — the `.theme-dark` class pattern and `ModalHeader`
  theme toggle this RFC adopts for the Client Config modal.
- RFC-0180/0183/0046 — existing GCDR customer-scoped resources (alarms, rules,
  goals) that establish the `X-API-Key`+`X-Tenant-ID` access pattern reused here.

# Unresolved questions
[unresolved]: #unresolved-questions

> **Resolved in RFC-0057 v3 (no longer open):** the `featureButtons` **shape**
> (2×3 checkbox matrix on both sides); **secret handling** (out of the general write
> path, dedicated JWT+scope+audited secrets endpoint, masked read, §DEC-7); and
> **`isInternalSupportRule`** → `alarms.showInternalSupport` (§DEC-2).

- **Default theme.** Current code defaults to `'light'`; the request references a
  "dark (default)" pattern. Which is the product default, and should it come from
  `ctx.settings.defaultThemeMode` per customer? *(Theme is a separable concern —
  see the scope note in Drawbacks.)*
- **Per-button vs per-group only.** Is per-button × per-group (the 2×3 matrix)
  the final granularity, or is per-device-profile ever needed?
- **`customerDefaultDashboard`** is TB-specific (a TB dashboard id). Confirm it
  should live in GCDR anyway (the request leans yes) vs staying in TB.
- **Orphans** `inauguration_date` / `obs`: migrate as metadata or drop like `qt*`?
- **Backfill ownership & timing** — is this a GCDR-side job or a widget-driven
  lazy migration on first load?

# Future possibilities
[future]: #future-possibilities

- A generic **customer-config editor** (schema-driven form) replacing the ad-hoc
  `mcc-`/iSetup modals.
- **Per-group / per-feature flags** generalized beyond the demand buttons.
- **Config versioning & audit** in GCDR (who changed what, when) — impossible
  with raw TB attributes.
- **Theme persistence per user** (not just per session) and a global theme toggle
  in the dashboard header, not only in modals.
- Retire the TB SERVER_SCOPE surface entirely once every consumer reads GCDR
  config, leaving TB with only the GCDR bootstrap.
