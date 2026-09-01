- Feature Name: `ed1149-blocked-items-and-backfill-endpoint`
- Start Date: 2026-09-01
- RFC PR: (leave this empty)
- Tracking Issue: ED-1149
- Companion RFCs: **RFC-0229** (`customer-config-gcdr-migration-and-granular-demand-buttons`, this repo) — the client-side migration this document is a ledger for. **RFC-0057** (`gcdr.git/docs/rfcs/RFC-0057-Customer-Config-Document.md`) — backend owner of the config document and the new endpoint specified in §8.

# Summary
[summary]: #summary

RFC-0229 defines the Customer Server Scope (TB) → GCDR customer-config migration and its mandatory dual-read strategy. The ED-1149 ticket breaks that migration into 51 sub-tasks (ED-1150–1198, Group A: 22 Server Scope attributes; Group B: 26 widget settings; 3 special-case tickets). This document is the **companion ledger**: everything from that list that is **not** a straightforward `resolveConfigField()` dual-read this round, and why — secrets, an unresolved overlap with RFC-0207, three fields whose existence couldn't be confirmed in the current frontend codebase, one field needing real structural reconciliation, one ticket that contradicts the standing "don't remove from TB yet" rule, and all 26 Group B items pending an explicit per-field disposition decision. It also specifies the new `POST /customers/:customerId/config/backfill-from-tb` endpoint (gcdr repo) that replaces the temporary manual `ed1149PatchCustomerConfig` DevTools helper used to validate every dual-read subtask up to this point.

Group A fields completed under RFC-0229's dual-read pattern before this document was written (all via `resolveConfigField()`, `src/services/gcdr/customerConfigApiClient.ts`): `alarmNotificationsEnabled`, `canShowDemandButtons→featureButtons`, `isInternalSupportRule`, `customerDefaultDashboard`, `temperature.{min,max,clampMin,clampMax}`, `measurementDisplaySettings`, `client_id`, `mapInstantaneousPower`, `showOfflineAlarms`, `tickets.{enabled,onlyToMyio}`. That's 12 of Group A's 22 attributes (the `alarmNotificationsEnabled`/`canShowDemandButtons` pair plus the other 10 named above). The remaining 12 are covered in this document.

# Motivation
[motivation]: #motivation

Every ED-1149 subtask carries the same mandatory dual-read strategy (GCDR-first, TB-fallback, validate against real customers, remove nothing yet). That strategy assumes each field is a plain, readable value on the normal `GET /config` response. Working through the full 51-item list surfaced several fields where that assumption doesn't hold — either because GCDR structurally can't return the real value to a browser (secrets), because migrating the field would collide with separate in-flight work (device classification), because the field's very existence in production TB attributes couldn't be confirmed from the codebase alone (three fields), because its TB shape is genuinely tangled with data that must never migrate (bootstrap credentials), or because the whole 26-item Group B is explicitly gated on a disposition decision this document's author cannot make unilaterally. Rather than silently skip these or guess, they are recorded here with the investigation already done, so whoever picks each one up next starts from confirmed findings instead of from zero.

# Reference-level ledger
[reference]: #reference-level-ledger

## §1 — Secrets: `client_secret` (ED-1153 🔒) and `master_admin_password` (ED-1158 🔒)

**Not a dual-read candidate, by design, not by oversight.**

- The normal `GET /config` response **always** masks these as the literal string `"***"` (`gcdr/src/services/CustomerConfigService.ts:346-348`, `MASKED_SECRET` constant) — never the real value, never `undefined`. A naive `cfg.ingestion?.clientSecret ?? tbFallback` dual-read would pick up `"***"` itself (truthy, non-nullish) and attempt to use it as a live credential — a functional bug on top of the security concern.
- The one endpoint that *can* return plaintext, `GET /customers/:id/config/secrets` (RFC-0057 §DEC-7), explicitly rejects customer API keys at the door (`gcdr/src/middleware/requireCustomerConfigAccess.ts:138-140`, `'API keys cannot access customer secrets'`) and requires a JWT or master API key plus the high-risk `customers.secret.reveal` permission, granted only to `role:customer-admin`, every access audited (`CustomerConfigService.getSecrets()`, `CustomerConfigService.ts:197-225`). This widget's only GCDR credential in the browser is the customer-scoped `gcdrApiKey` — exactly what's rejected.
- RFC-0229 itself already reaches the same conclusion (§ on secrets): *"the client never fetches or submits their plaintext through `/config`"*.

**Current state**: TODO comments landed at both read sites — `client_id`'s neighbor at `MAIN_VIEW/controller.js:2443` (client_secret) and `TELEMETRY/controller.js` (master_admin_password, near its own SERVER_SCOPE fetch) — both TB-only, unchanged.

**What unblocks this**: a backend-mediated (BFF) design — a trusted server-side process holds the privileged JWT and calls `GET /config/secrets` itself, never exposing that call or its result to the browser. Not scoped further here; a future RFC if/when this becomes a priority.

## §2 — `deviceClassificationProfile` (ED-1155)

**Two live, uncoordinated GCDR paths for the same conceptual data — needs a scoping decision, not a technical fix.**

- This field already has its own, separate, in-progress GCDR-store mechanism: RFC-0207 v3.1/v3.2's `createGcdrResolveProfileSource()` (`MAIN_VIEW/controller.js:1422`) / `rfc0207PrimaryProfileSource()` (`:1470`) / `_rfc0207UseGcdrStore()` flag (`:1326`) — hitting a **different** GCDR endpoint (`/entities/resolve`, RFC-0047's entity registry), currently **disabled by default** because its own `entities → ClassificationNode` adapter isn't built (RFC-0207 §v3.2-B/G, per the code's own comments).
- RFC-0229's ticket wants this represented as `classificationProfile` in the `/config` document instead. Confirmed the field already exists on the backend (`gcdr/src/domain/entities/Customer.ts:129`: `classificationProfile?: unknown;` — opaque JSON, size-capped, null-default, **backend's own comment literally says "RFC-0207 shape"**) — a good sign the two are meant to converge, not collide, but the frontend still has two live, uncoordinated paths today.
- Applying a wrong/premature classification profile has real behavioral consequences — it feeds `MyIO.setActiveProfile()`, affecting device categorization dashboard-wide.

**Current state**: `classificationProfile?: unknown` is typed (but unused) in `CustomerConfigReadModel` (`src/services/gcdr/customerConfigApiClient.ts`), and a TODO comment sits at `MAIN_VIEW/controller.js:1326` explaining the two-paths situation.

**What unblocks this**: a scoping decision from whoever owns RFC-0207 v3.2 — does `/config`'s `classificationProfile` become the SINGLE store (retiring `/entities/resolve` for this purpose), or do the two stay separate for different reasons? Not decided here.

## §3 — Orphan/gap fields: existence not confirmed in the current frontend codebase

The ED-1149 breakdown flags these as `[Órfão]`/`[Gap]` — absent from RFC-0229's official table, found only when comparing against a raw TB snapshot. Before any GCDR destination can be decided, each needs confirmation it's a real, currently-used Customer SERVER_SCOPE attribute. Investigated this round (full-repo grep, not just a manual guess):

- **ED-1167 `inauguration_date`** — **finding: this is NOT a Customer SERVER_SCOPE attribute today.** It's a **per-device/per-store** `dataKey` (`camelCase` as `inaugurationDate`), read in `src/thingsboard/MYIO-SIM/v5.2.0_UNIQUE/controller.js` (lines 3914-3915, 5143, 7414, 10456-10480) and modeled in `src/components/metas-guide/types.ts:41` — used to sort stores by inauguration date in the Metas × Consumo (Goals vs. Consumption) feature. The ED-1149 ticket's classification as a Customer-level attribute looks inaccurate. **Needs**: re-verification directly against a real production customer's TB SERVER_SCOPE attributes (via TB's own UI or API) before any decision — if it genuinely doesn't exist there, this ticket should be closed as a misclassification, not implemented.
- **ED-1168 `obs`** — **finding: zero references anywhere in the frontend codebase** (`grep -rn "'obs'"` / `"obs"` across all of `src/`, no matches). If this attribute exists on real TB customers, nothing in this repository reads or writes it — it would be unused/vestigial, likely entered directly through TB's own UI by operations staff with no frontend consumer at all. **Needs**: confirmation it exists on a live customer, and — if so — a decision on whether migrating a field nothing consumes is even worth doing, versus just documenting it as legacy metadata that stays in TB.
- **ED-1171 `alarmRecipients`** — **finding: zero references anywhere in the frontend codebase**, same as `obs`. Not found near `alarmNotificationsEnabled` or anywhere in the alarm-handling code paths (`_prefetchCustomerAlarms`, `AlarmServiceOrchestrator`, `_buildAlarmDayMap`, etc.). **Needs**: the same confirmation-before-decision treatment as `obs`.

## §4 — `integration_setup` (ED-1169) — complex, real structural overlap confirmed

Confirmed real and actively used, unlike §3's orphans:
- `MENU/controller.js:1204-1797` — reads/writes the nested TB attribute (`{ing, gcdr, gw}` sub-keys) via a dedicated settings panel; log line at `:1741` shows the destructured shape: `{ ing, gcdr, gw }`.
- `TELEMETRY/controller.js:4433-4454` (RFC-0195) — reads `integration_setup.gcdr` directly, throwing if `gcdrCustomerId`/`gcdrApiKey` are missing from it.
- Also present in `v-5.4.0/controller.js`, `GCDR-Upsell-Setup/v.2.0.0/controller.js`, and the `bkp/` mirrors of MENU/TELEMETRY.

**The real complication**: `integration_setup.gcdr` appears to carry `gcdrCustomerId`/`gcdrApiKey`-shaped data — the **same conceptual bootstrap credentials** that §6 (ED-1170) requires to stay flat in TB SERVER_SCOPE forever, for the chicken-and-egg reason that they're what make dual-read possible in the first place. Two representations of what may be the same bootstrap data (flat attrs vs. nested `integration_setup.gcdr`) is real structural redundancy that needs untangling — not a naming difference to paper over with a mapping function.

**What unblocks this**: the ticket's own note asks to reconcile with Group B's Freshdesk fields (ED-1186/1187, §7 below — `freshdeskApiKey`/`freshdeskDomain` may already live inside `integration_setup` too, given the naming pattern). Needs a combined pass across `integration_setup`'s full real shape (all three sub-keys: `ing`, `gcdr`, `gw`) plus every Group B field that might already be nested inside it, before any GCDR destination is decided. Not attempted here — flagged as its own follow-up investigation.

## §5 — Explicit non-goal this phase: `qtDevices*` DROP (ED-1172)

This ticket asks to **delete** a family of legacy `qtDevices*` attributes from TB SERVER_SCOPE. That directly contradicts the standing rule that has governed every single ED-1149 subtask so far: *"não deletar atributo TB ainda"* — removing anything from TB is explicitly Phase 2, out of scope until every dual-read is validated in production (see RFC-0229's rollout phases).

**Decision recorded here**: not executed as part of this round, or silently folded into any other subtask. When Phase 2 (fallback/attribute removal) actually starts, ED-1172 needs its own explicit go-ahead — including confirming nothing still reads `qtDevices*` (the ticket itself notes this needs checking) and keeping a historical backup of the values before deletion, per its own acceptance criteria.

## §6 — Bootstrap credentials (ED-1170) — policy confirmed, no code change

`gcdrCustomerId`, `gcdrTenantId`, `gcdrApiKey` never migrate to GCDR — this has been the de facto behavior of every subtask in this session (they're read from TB, used to *authenticate the GCDR call itself*, and are the one thing that structurally cannot live on the far side of the connection they establish). This document is the first place it's written down formally rather than only implied by every dual-read block's own `_gcdrFieldParams` construction. Also relevant to the §4 `integration_setup.gcdr` overlap — the same three values, potentially duplicated in two TB locations.

## §7 — Group B: 26 widget settings (ED-1173–1198) — disposition undecided

Group B (`WIDGET/MAIN_VIEW/settingsSchema.json`, the dashboard's Appearance tab) is a **different mechanism** from Group A (per-customer TB attributes) — these are per-widget-instance deployment settings. RFC-0229 does not cover Group B explicitly, and the ED-1149 breakdown itself states the process: *"Cada sub-task do Grupo B deve ter disposição confirmada por Victor Hugo antes de implementar"* (each Group B item needs its disposition — migrate to GCDR vs. stay a widget setting — confirmed by Victor Hugo before implementation). **No Group B code was implemented this round** for exactly that reason. Reproducing the ticket's own recommendation split below as a starting point for that confirmation, not as a decision:

**Likely stays a widget/deployment setting** (environment-specific, not per-customer):
| Ticket | Field |
|---|---|
| ED-1177 | `debugMode` |
| ED-1178 | `homologMode` |
| ED-1182 | `alarmsApiBaseUrl` |
| ED-1183 | `gcdrApiBaseUrl` |
| ED-1184 | `dataApiHost` |
| ED-1185 | `chartsBaseUrl` |

**Likely migrates to GCDR** (per-customer customization):
| Ticket | Field |
|---|---|
| ED-1173–1176 | `enableCache`, `cacheTtlMinutes`, `enableStaleWhileRevalidate`, `maxCacheSize` |
| ED-1189–1193 | `maxSelection`, `enableTemperatureApiDataFetch`, `enableDeviceDataExport`, `enableReportButton`, `enabledReportItems` |
| ED-1194–1196 | `defaultThemeMode`, `darkMode`, `lightMode` |

**Undecided either way, needs its own look**:
| Ticket | Field | Note |
|---|---|---|
| ED-1179 | `domainsEnabled` | multi-tenancy/security implications |
| ED-1180 | `excludeDevicesAtCountSubtotalCAG` | affects KPI aggregation if per-customer |
| ED-1181 | `enableAnnotationsOnboarding` | per-customer vs. per-user vs. global UX setting — unclear which |
| ED-1186–1187 🔒 | `freshdeskApiKey`, `freshdeskDomain` | shared-vs-per-customer question; **cross-reference §4** — may already live inside `integration_setup` |
| ED-1188 | `shortDelayMinsToBypassOfflineStatus` | per-customer device-timing tolerance vs. global default |
| ED-1197–1198 | `goalsDefaultPeriodDays`, `goalsThrottle` | business-cycle vs. performance-tuning split |

## §8 — Backend: `POST /customers/:customerId/config/backfill-from-tb` (gcdr repo)

Replaces the manual `ed1149PatchCustomerConfig` DevTools helper (removed from `MAIN_VIEW/controller.js` in this round) used to validate every dual-read subtask so far. Wraps the already-existing, already-unit-tested `CustomerConfigBackfillService.backfillCustomer(tenantId, customerId, attrs, {dryRun})` (`gcdr/src/services/CustomerConfigBackfillService.ts:228-233`) in a real HTTP route — confirmed via repo-wide grep this service was wired to nothing at all before this endpoint.

**Not a browser-callable endpoint, by design.** The backfill service's own header comment states it is *"idempotent: re-running after a successful apply yields an empty diff"* — meaning a successful apply makes GCDR's config **match whatever TB currently says**, overwriting any existing GCDR value for the fields it covers. That's correct behavior for a deliberate, operator-triggered backfill, but would be actively harmful if the widget called it automatically on every page load — it would silently stomp any direct GCDR edit back to the TB value on the next load. So this endpoint requires the same **write-tier** auth as a manual `PATCH /config` (JWT operator or master API key with `customers:write` / `customers.hierarchy.update`) — never this widget's browser-exposed, permanently read-only `gcdrApiKey`.

**Route**: `POST /customers/:customerId/config/backfill-from-tb`, added as `configRouter.post('/backfill-from-tb', ...)` directly in `gcdr/src/controllers/customer-config.controller.ts`, alongside the existing `.get('/')`/`.put('/')`/`.patch('/')`/`.delete('/')` on the same router. Inherits the existing `app.ts:361` mount's auth chain automatically — no `app.ts` change needed: `hybridAuthByMethod` treats every non-`{GET,HEAD,OPTIONS}` verb (including POST) as the write-scope tier (`gcdr/src/middleware/auth.ts:270-276`), and `requireCustomerConfigAccess` maps every non-read verb to the single `customers.hierarchy.update` permission (`gcdr/src/middleware/requireCustomerConfigAccess.ts:51,90-104`) — the same tier PUT/PATCH/DELETE already use.

**Request**: `{ "attrs": { <raw TB SERVER_SCOPE attributes as a flat object> } }`, query param `?dryRun=true|false` (**default `true`** — matches the deleted one-off script's own safety convention of requiring an explicit apply).

**Response**: the existing `BackfillResult` shape, unchanged — `{ customerId, changed, applied, dryRun, diff }`.

**Audit logging — a gap this endpoint closes**: confirmed `backfillCustomer()` does not call `logAuditEvent` today (unlike `putConfig`/`patchConfig`, which emit `EventType.CUSTOMER_CONFIG_UPDATED` via `emitConfigUpdated`) — it only threads an `actorId` string into a thin `updatedBy` column. The new handler emits a matching audit event (same shape as `emitConfigUpdated`, `entityType: 'customer.config'`, `action: 'BACKFILL'`) whenever `dryRun` is false and the result is `applied`, using the full `actorOf(req)` (the same helper PUT/PATCH/DELETE already use), not just the thin id — so a backfill apply gets the same audit trail as a manual PATCH.

**Tests**: mirror the two existing controller test files — a controller-mock style test (`tests/unit/controllers/customer-config.controller.test.ts` conventions) for request/response wiring and `dryRun` default behavior, and an auth-chain style test (`tests/unit/controllers/customer-config.auth-chain.test.ts` conventions) proving a POST to `/config/backfill-from-tb` resolves to the `customers.hierarchy.update` permission and that a customer-scoped read-only API key is rejected.

# Unresolved questions
[unresolved]: #unresolved-questions

- §2: who owns the RFC-0207 v3.2 / RFC-0229 `classificationProfile` convergence decision, and on what timeline?
- §3: can someone with TB admin access confirm, on a real production customer, whether `inauguration_date` (customer-level, not per-device), `obs`, and `alarmRecipients` actually exist as SERVER_SCOPE attributes today?
- §4: does `integration_setup` already contain the Freshdesk fields (ED-1186/1187)? Needs a full-shape dump from a real customer, not just the code paths that read/write it.
- §7: Victor Hugo's per-field sign-off for all 26 Group B items — this document proposes a starting split, not a decision.
