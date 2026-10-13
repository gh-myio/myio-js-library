# RFC-0239 — Reports Hub: move the MENU "Relatórios" picker into a reusable library component

- **Feature name:** `reports-hub`
- **Start date:** 2026-10-13
- **Status:** **Final rev. 4 — for approval.** Documentation only; nothing in this RFC is implemented
  yet. Rev. 4 closes the review cycle: one scope, one acceptance set, decisions recorded in §14.
- **Branch:** `docs/rfc-0239-reports-hub-lib` (from `desenv` `cd73015e`)
- **Jira:** [ED-1335](https://myio.atlassian.net/browse/ED-1335) (Sprint 20). Related bugs found in
  review: [ED-1340](https://myio.atlassian.net/browse/ED-1340) (version checker `destroy()`),
  [ED-1341](https://myio.atlassian.net/browse/ED-1341) (bundle-size guard on Windows / budgets)
- **Reviews:** feedback v1 (F-01…F-10), roundtable 1 (§14) and feedback v2 (R-1…R-6) — all
  incorporated; the review notes themselves are kept in the history of PR #148
- **Related:** RFC-0181 (Relatórios menu item), RFC-0182 (enabled report items + `itemsList` filter),
  RFC-0128 (`exclude_groups_totals`), RFC-0121 (ModalHeader), RFC-0238 (Demand Panel v2 —
  "Demandas e Telemetrias"), PR #97 (`window.MyIOUtils` bridge / `LIB_SYMBOLS`)

## Revision history

| Rev. | Date | Change |
|---|---|---|
| 1 | 2026-10-13 | Initial draft |
| 2 | 2026-10-13 | Feedback v1 (F-01…F-10): defaults resolved by the hub, no globals in the hub, explicit adapter sources, availability vs. enablement, safe rendering, lifecycle, parity vs. corrections, release plan |
| 3 | 2026-10-13 | Roundtable 1 consensus: boolean-only flags, fixed tab order, inline errors, cooperative abort, destinations keep today's visuals, test-first, size on the Phase 1 PR |
| 4 | 2026-10-13 | Feedback v2 (R-1…R-6): prepare/open protocol (§5.3); **C-3 deferred** — the orchestrator cannot tell failure from empty (§5.10); footer with static version, no checker (§5.9); adapter and visual precedence aligned (§5.5–5.6, §8); delta size budget (§10); one scope with decisions recorded (§7, §14); editorial fixes |

### Rev. 4 — resolution of feedback v2

| Finding | Resolution | Section |
|---|---|---|
| R-1 selection protocol contradicts close/abort | Handlers split into `prepare()` (hub open) → `open()` (sync). Success releases the hub **without** aborting; only cancellation aborts. `open()` errors go to `onError` + a controlled library toast | §5.2, §5.3, §5.7 |
| R-2 orchestrator cannot distinguish failure from empty | **C-3 deferred** to its own delivery, dependent on an unambiguous load result. This delivery preserves today's hydration semantics (P-8). The readiness predicate must not count placeholder/failed state | §5.10, §7, §11 |
| R-3 `useGlobals:false` does not reach the version checker | The hub's footer shows a **static** build version and never instantiates the checker. The checker's own `destroy()` bug is tracked in ED-1340 | §5.9 |
| R-4 adapter and parameter examples | Demand params from a getter evaluated at `prepare`; AllReport base read once with `??`/`||` precedence; destinations and factories imported from the package; no throw on context creation; MENU closes the open handle before building a context | §5.3, §5.5, §8 |
| R-5 budget does not match artefacts/guards | Delta budget on `umd.min.js` gzip, same build chain, ceiling approved in the Phase 1 PR; guard fix in ED-1341; the measurement must print a report | §10 |
| R-6 normative body vs. open decisions | §7 lists only what this delivery implements; §14 records the decisions (owner decisions marked as such) | §7, §14 |

---

## 1. Summary

Clicking **Relatórios** in the Shopping v-5.2.0 MENU opens a report picker modal that is built
entirely inside the widget controller: CSS, catalog of domains and items, tabs, cards, theming,
device-list building, lazy domain loading and routing to the two report modals. About **470 lines**
of `MENU/controller.js` exist only to do this.

This RFC moves all of it into the library as one exported component, **`openReportsHub`**, plus a
small dashboard adapter. The MENU controller keeps a short call. The modal becomes reusable by any
dashboard (v-5.4.0, Head Office, simulators) and testable in a showcase without ThingsBoard.

## 2. Motivation

1. **Controller size and ownership.** The MENU controller mixes navigation with a full modal
   implementation. Every change to the picker (e.g. the RFC-0238 card) means editing a TB widget,
   re-syncing it in ThingsBoard and testing on a live dashboard.
2. **No reuse.** v-5.4.0 and Head Office have no report picker; adding one today means copying
   ~470 lines.
3. **No tests, no showcase.** None of this code is covered by Vitest, and there is no way to see it
   outside a live dashboard.
4. **Inconsistent chrome.** The picker uses its own `rp-*` header/overlay styles, while every other
   premium modal uses `createPremiumModalChrome` (RFC-0121 header, theme toggle, premium footer).
5. **Duplicated configuration.** The enabled-item defaults exist twice: `REPORT_ITEM_DEFAULTS` in
   MAIN_VIEW and the `ei(key, def)` defaults in the MENU catalog. The item keys are an implicit
   string contract between the two widgets.

## 3. Current state (as of `desenv` `cd73015e`)

File: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js`

| Lines (approx.) | Symbol | Responsibility |
|---|---|---|
| 573–579 | `scope.changeDashboardState` | Intercepts the link whose text matches `/relat/i` and calls `openReportsPickerModal()` |
| 2701–2716 | `openReportsPickerModal` | Builds `baseParams` (`customerId` = ingestion customer id, `api.clientId/clientSecret/dataApiBaseUrl/ingestionToken`, `ui.theme: 'light'`) from `MyIOOrchestrator.getCredentials()` |
| 2718–3023 | `_renderReportsPicker` | Mounts on `window.top.document`; second click removes it; injects `rp-*` CSS once; declares the `DOMAINS` catalog (4 tabs, 15 items) with **local defaults** `ei(key, def)` (only `energy_lojas` defaults to `true`); renders tabs + cards with 🔒 for disabled items; applies `MyIOUtils.theme` accent; closes on ✕ / backdrop; on card click closes and calls `_openGroupReport` |
| 3026–3069 | `GROUP_LABELS`, `_buildItemsList` | Reads `getEnergyGroups/getWaterGroups/getTemperatureGroups`; maps `area_comum → areacomum`; `todos` merges every group except `ocultos` with a `groupLabel` (`GROUP_LABELS` has `area_comum` but **not** `areacomum`); maps each device to `{ id, identifier, label, excludeGroupsTotals, temperatureOffset? }` |
| 3074–3105 | `_openDemandPanel` | RFC-0238: energy devices (no `ocultos`) → `openDemandPanelV2`; TB customer id = `settings.customerTB_ID ‖ window.__myioCustomerTB_ID ‖ ''`; `createTbEnvelopeStore` + `createGcdrReportJobsApi` + `tbUserFromJwt(localStorage.jwt_token)` |
| 3109–3123 | `_ensureDomainLoaded` | Water/temperature only: skips when `window.MyIOOrchestratorData[domain].items.length > 0`; otherwise `orch.hydrateDomain(domain, orch.getCurrentPeriod())`; a missing period or a hydration error is **logged and ignored** |
| 3125–3167 | `_openGroupReport` | Routes `energy/demand_telemetry` to the Demand Panel; otherwise ensures the domain is loaded, builds `itemsList`, adds temperature valid/ideal ranges, opens `openDashboardPopupAllReport` with theme and customer name |

File: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`

| Lines (approx.) | Responsibility |
|---|---|
| 187–282 | `LIB_SYMBOLS` bridge: lazy getters on `window.MyIOUtils` that return `window.MyIOLibrary[name]` — a symbol missing from the bundle reads as `undefined`, it does not throw |
| 2245, 3252 | `window.__myioCustomerTB_ID = customerTB_ID` |
| 2346–2368 | `REPORT_ITEM_DEFAULTS` (15 keys) merged with `self.ctx.settings.enabledReportItems` (`rawItems[k] ?? def`, no type check) → `window.MyIOUtils.enabledReportItems` (inside `onInit`, **before** `const MyIO` at :2655) |
| 2503 | Transitional orchestrator **stub** (`isReady: false`) without group getters |
| 7538–7550 | Temperature: `ctx.data` timeout → `reportLoadError` and `return []`; no sensors → `return []` |
| 8378 | `fetchAndEnrich`: catches errors and returns `[]` |
| 8503, 8549 | `emitProvide` publishes provisional `:loading` and `:failed` items |
| 8640–8646 | `window.MyIOOrchestratorData[domain] = { items, version, … }` |

**Defects found while mapping the code:**

- **D-1 Alarm items have no handler.** The three `alarms_*` cards route to `_openGroupReport`, which
  opens `openDashboardPopupAllReport` with `domain: 'alarms'` — a value its type does not accept
  (`'energy' | 'water' | 'temperature'`) — and an `itemsList` built from the **energy** groups. They
  are disabled by default; production incidence not verified.
- **D-2 Raw `innerHTML` with catalog data.** Labels, descriptions, icons, ids and colours are
  interpolated into markup without escaping. Harmless with the hardcoded catalog, unsafe once the
  catalog is a public parameter.
- **D-3 No keyboard/a11y support.** No `role="dialog"`, no Esc to close, no focus handling, tabs are
  not a `tablist`.
- **D-4 Silent empty report.** A failed hydration of water/temperature is ignored and the report
  opens with an empty `itemsList`. The orchestrator itself converts several failures into `[]`
  (lines 7538, 8378), so the MENU cannot distinguish failure from a legitimately empty domain.

## 4. Goals and non-goals

**Goals**

- G-1 One exported entry point, `openReportsHub(params)`, that renders the picker and routes the
  choice, preserving every behaviour in §7.1 and applying only the corrections in §7.2.
- G-2 The MENU controller only gathers context and calls the library (§8). No CSS, catalog,
  defaults, device mapping or routing remains in the widget.
- G-3 Independent of dashboard globals: the hub reads **no** `window.*` dashboard state, neither
  directly nor through shared helpers, including asynchronous work after mount (§5.9). Dashboard
  globals are read only by the optional adapter (§5.5).
- G-4 Same look as the other premium modals (`createPremiumModalChrome`, `--myio-*` theme tokens),
  the hub following the dashboard light/dark mode.
- G-5 Unit tests (Vitest/jsdom), integration tests through the adapter and the real default
  handlers, and a showcase (`showcase/reports-hub/`).

**Non-goals**

- Changing `AllReportModal` or `openDemandPanelV2` behaviour, including their light/dark mode.
- Implementing the alarm reports (D-1) — the hub only stops offering them without a handler.
- Fixing D-4 (C-3) — deferred, see §11 and §14 D-2.
- Migrating the HEADER "Relatório" button (`HEADER/controller.js:3037`), v-5.4.0 or Head Office.
- Changing the `enabledReportItems` settings schema seen by customers.

## 5. Design

### 5.1 Module layout

```
src/components/premium-modals/reports-hub/
├── index.ts                 # public exports
├── types.ts                 # domains, catalog, context, params, handle
├── catalog.ts               # DEFAULT_REPORTS_CATALOG, DEFAULT_ENABLED_REPORT_ITEMS, resolveReportItemStates()
├── items.ts                 # buildReportItemsList() — pure device → StoreItem mapping
├── openReportsHub.ts        # entry point: singleton, close path, selection protocol, in-flight guard
├── handlers.ts              # default 'group-report' and 'demand-panel' handlers
├── ReportsHubView.ts        # DOM via document.createElement / textContent, tabs, a11y
├── styles.ts                # .rh-* CSS scoped to the root, theme tokens only
└── dashboardAdapter.ts      # createDashboardReportsHubContext() — the only module reading TB/orchestrator globals
```

### 5.2 Public API

```ts
export type ReportDomain = 'energy' | 'water' | 'temperature' | 'alarms';
/** Domains the default group-report handler and AllReportModal accept. */
export type GroupReportDomain = Exclude<ReportDomain, 'alarms'>;
/** `${domain}_${itemId}` — the same keys as settings.enabledReportItems (RFC-0182). */
export type ReportItemKey = `${ReportDomain}_${string}`;

export interface ReportsCatalogItem {
  id: string;                 // unique per domain: 'entrada' | 'area_comum' | 'lojas' | 'todos' | 'demand_telemetry' | …
  label: string;              // rendered with textContent
  description: string;        // rendered with textContent
  icon: string;               // text/emoji only in v1, rendered with textContent (§5.8)
  tint: { bg: string; fg: string };   // applied via element.style
  kind: 'group-report' | 'demand-panel' | 'alarm-report' | (string & {});
}
export interface ReportsCatalogDomain { id: ReportDomain; label: string; items: ReportsCatalogItem[] }
export type ReportsCatalog = ReportsCatalogDomain[];

export interface ReportsHubDevice {
  id?: string; ingestionId?: string; identifier?: string; label?: string; name?: string;
  excludeGroupsTotals?: string | Record<string, unknown> | null;   // same type as StoreItem
  offSetTemperature?: number | string;
  [k: string]: unknown;       // full device kept for demandDevicesFromItems (gcdrDeviceId, tbId, …)
}

export interface ReportsHubVisual {
  palette?: MyIOThemePalette;  // createMyIOTheme output
  mode: 'light' | 'dark';      // drives the hub only (§5.6)
  customerName: string;
}

export interface ReportsHubContext {
  /** Domains this context can serve; drives availability (§5.4). */
  domains: GroupReportDomain[];
  /** Classified groups, e.g. { lojas, entrada, areacomum, ocultos }. Only called for a domain in `domains`. */
  getGroups(domain: GroupReportDomain): Record<string, ReportsHubDevice[]>;
  /** Today's semantics (§5.10): resolves when hydration ends; does not reject on hydration errors in this delivery. */
  ensureDomainLoaded?(domain: GroupReportDomain, signal: AbortSignal): Promise<void>;
  /** AllReport base (customerId, api.*, ui, optional theme/customerName). Read once per selection, at prepare. */
  getAllReportBase(): Omit<OpenAllReportParams, 'domain' | 'group' | 'itemsList'>;
  temperature?: { validRange?: { min: number; max: number }; idealRange?: { min: number; max: number } };
  /** Demand Panel params minus `devices`, built at prepare (fresh JWT identity); absent → 'demand-panel' unavailable. */
  getDemandPanelParams?(): Omit<DemandPanelV2Params, 'devices'> | null;
}

export interface OpenReportsHubParams {
  context: ReportsHubContext;
  /** Raw settings.enabledReportItems; resolved by the hub against the catalog (§5.4). */
  enabledItems?: Record<string, unknown> | null;
  catalog?: ReportsCatalog;                 // default DEFAULT_REPORTS_CATALOG
  initialDomain?: ReportDomain;             // fallback rules in §5.4
  theme?: MyIOThemePalette;
  themeMode?: 'light' | 'dark';             // precedence in §5.6
  customerName?: string;
  /** Mount target of the hub only (destinations mount themselves); default §5.7. */
  document?: Document;
  /** Host handlers by kind; a host handler wins over the default of the same kind (§5.4). */
  handlers?: Partial<Record<string, ReportsHubHandlerDef>>;
  /** true (default): opening while open on the same Document closes it (today's second click). */
  toggle?: boolean;
  /** Logging hook. Never receives the context or credentials. */
  onOpenReport?(e: { domain: ReportDomain; item: string; itemsCount?: number }): void;
  /** Error hook (logging/telemetry). Prepare errors are also shown inline; open errors as a toast (§5.3). */
  onError?(e: { domain: ReportDomain; item: string; phase: 'prepare' | 'open'; message: string }): void;
}

/** Synchronous: only mounts the destination. */
export type ReportsHubOpener = () => void;

export interface ReportsHubHandlerDef {
  /** Which domains this handler can serve; default handlers declare theirs (§5.4). */
  domains?: ReportDomain[];
  /** Extra availability check, e.g. "context has what I need". Default: available. */
  isAvailable?(context: ReportsHubContext): boolean;
  /** Runs with the hub open (spinner on the card). Resolve with the opener; reject to show the inline error. */
  prepare(args: {
    domain: ReportDomain; item: ReportsCatalogItem; context: ReportsHubContext;
    visual: ReportsHubVisual; signal: AbortSignal;
  }): ReportsHubOpener | Promise<ReportsHubOpener>;
}

export interface ReportsHubHandle { close(): void; readonly isOpen: boolean }

export function openReportsHub(params: OpenReportsHubParams): ReportsHubHandle;

// helpers, exported for reuse and tests
export const DEFAULT_REPORTS_CATALOG: ReportsCatalog;
export const DEFAULT_ENABLED_REPORT_ITEMS: Readonly<Record<ReportItemKey, boolean>>;   // the 15 legacy keys
export function resolveReportItemStates(
  catalog: ReportsCatalog, raw: Record<string, unknown> | null | undefined,
  available: (domain: ReportDomain, item: ReportsCatalogItem) => boolean,
): Map<ReportItemKey, 'hidden' | 'locked' | 'enabled'>;
export function buildReportItemsList(
  groups: Record<string, ReportsHubDevice[]>, domain: GroupReportDomain, group: string,
): StoreItem[];
export function createDashboardReportsHubContext(opts: DashboardAdapterOptions): ReportsHubContext;
```

### 5.3 Selection protocol and default handlers

**Protocol** (same for default and host handlers):

```text
card click → validate (enabled, no selection in flight) → selectionId++, new AbortController
→ prepare(args) with the hub open (spinner on the card, other cards disabled)
   ├─ rejects        → inline error on the card + "Tentar de novo"; cards re-enabled; onError(phase 'prepare')
   └─ resolves open  → if signal aborted or selectionId changed → discard (never open)
                     → finish(reason 'success'): release the hub WITHOUT aborting the selection
                     → try open()  catch → onError(phase 'open') + library toast (MyIOToast module import,
                                           not window); no inline message (the card no longer exists)
```

`finish(reason)` is the single cleanup routine (§5.7). Reasons `'cancel'` (✕, Esc, backdrop, toggle,
`handle.close()`, host teardown) abort the in-flight selection; `'success'` does not. A second click
during `prepare` is ignored by the in-flight guard, so a destination is never opened twice.

**Default handlers:**

| `kind` | `domains` | Available when | `prepare` | `open()` |
|---|---|---|---|---|
| `group-report` | energy, water, temperature | the domain is in `context.domains` | `await ensureDomainLoaded?.(domain, signal)`; `base = getAllReportBase()` (once); `itemsList = buildReportItemsList(getGroups(domain), domain, item.id)` | `openDashboardPopupAllReport({ ...base, domain, group: item.id, itemsList, theme: visual.palette ?? base.theme, customerName: visual.customerName \|\| base.customerName, ...temperature ranges when domain = temperature })` — `base.ui` unchanged (`ui.theme: 'light'`, P-14) |
| `demand-panel` | energy | `'energy'` in `context.domains` and `getDemandPanelParams` present | `dp = getDemandPanelParams()` (rejects with a message when `null`); `devices = demandDevicesFromItems(energy groups without ocultos, full objects)` | `openDemandPanelV2({ ...dp, devices, theme: visual.palette ?? dp.theme, customer: { ...dp.customer, name: visual.customerName \|\| dp.customer.name } })` — no `themeMode` (P-14) |
| `alarm-report` | alarms | — | **No default.** A host may pass `handlers['alarm-report']`. | — |

- Default handlers import `openDashboardPopupAllReport`, `openDemandPanelV2` and
  `demandDevicesFromItems` from the library modules, never from `window.MyIOUtils`, so the bundle
  holds one copy of each and the hub works without a bridge.
- `itemsList` is always an array — `[]` when the domain has no devices. `AllReportModal` treats an
  absent `itemsList` differently (it maps the API response directly), so the hub never omits it.
- A resolved visual value that is `undefined` or `''` never overwrites a valid value of the base.

### 5.4 Availability, enablement and catalog resolution

An item has one of three states. **Availability** (can it work here?) is decided first,
**enablement** (is it turned on in the UI configuration?) second. Enablement is a display setting,
not an authorization: handlers and the APIs they call keep their own access rules.

1. Handler for `item.kind`: the host handler if given, else the default one (**host > default**).
2. The item is **available** when that handler exists, its `domains` (if declared) include the
   item's domain, and its `isAvailable(context)` (if declared) returns true. Default handlers
   declare their domains, so a `group-report` item in `alarms` is never available (runtime check
   in addition to the `GroupReportDomain` type) — D-1 cannot come back through a custom catalog.
3. Enablement key `${domain}_${item.id}`: the value from `enabledItems` **only when it is a
   boolean**; any other value (`"true"`, `null`, `1`, missing) falls to
   `DEFAULT_ENABLED_REPORT_ITEMS[key]` for the 15 legacy keys, else `false` (C-9). The legacy keys
   and defaults are pinned in a test fixture table (`key, domain, item, defaultEnabled, kind`).

| Situation | State |
|---|---|
| No handler, or handler incompatible with the domain, or `isAvailable` false | **hidden** |
| Available, flag false | **locked** (visible, 🔒 + hint, not actionable) |
| Available, flag true | **enabled** |
| Custom item without a flag | **locked** by default; enabled by setting its key to `true` |

- **Tab order** is the catalog order. The default catalog fixes Energia → Água → Temperatura →
  Alarmes; a custom catalog keeps its own order. Order never changes with the configuration. A tab
  with no visible item is removed.
- **Initial tab:** `initialDomain` when it has a visible item; else the first domain in catalog
  order with an enabled item (Energia whenever it has one in the default catalog); else the first
  domain with a visible item; else an empty state ("Nenhum relatório disponível") instead of tabs.
- **Catalog validation at open:** duplicate domain ids, duplicate item ids within a domain and
  unknown domain ids are dropped (first occurrence kept) and logged once.
- Keys in `enabledItems` that match no catalog item are ignored. The legacy keys keep their exact
  spelling, including `energy_area_comum`.

### 5.5 Dashboard adapter

`createDashboardReportsHubContext` is the only module that reads dashboard globals. It **never
throws** on creation: missing capabilities only make domains or items unavailable. Each value has
one explicit source:

| Value | Source |
|---|---|
| `domains` | Each domain whose group getter exists on the orchestrator (`getEnergyGroups`, `getWaterGroups`, `getTemperatureGroups`). The transitional stub (`isReady: false`, no getters) yields `[]` → empty state |
| Groups | The matching getter, called at `prepare` |
| Domain already loaded | `opts.isDomainLoaded?.(domain)`. The predicate must count only settled data: provisional `:loading` and `:failed` emissions are **not** "loaded" (Phase 1 confirms which fields of `MyIOOrchestratorData[d]` carry that state) |
| Hydration | `orchestrator.hydrateDomain(domain, orchestrator.getCurrentPeriod())` with today's semantics (§5.10) |
| AllReport base | At `prepare`: `getCredentials()` → `CUSTOMER_ING_ID`, `CLIENT_ID`, `CLIENT_SECRET`; `tokenManager.getToken('ingestionToken')`; `opts.getDataApiHost()`; `ui: { theme: 'light' }` |
| Temperature ranges | `opts.temperatureClampRange`, `opts.temperatureLimits` |
| TB customer id | `opts.tbCustomerId` — **resolved by the caller** (MENU: `settings.customerTB_ID ‖ window.__myioCustomerTB_ID`) |
| Demand Panel params | `getDemandPanelParams()` at `prepare`: `user = tbUserFromJwt(opts.getJwt())` (identity read at selection), `store = createTbEnvelopeStore({ tbBaseUrl, customerId: tbCustomerId, getToken: opts.getJwt })` (token per request), `api = createGcdrReportJobsApi({ …, getHeaders })` with `gcdrApiKey`/`gcdrTenantId` read per request. Returns `null` when `tbCustomerId`, `gcdrCustomerId` or `gcdrApiBaseUrl` is missing |

`tbUserFromJwt`, `createTbEnvelopeStore` and `createGcdrReportJobsApi` are imported from the
library modules. The three customer ids stay separate and are never substituted for one another:
`CUSTOMER_ING_ID` (Ingestion, AllReport `customerId`), `tbCustomerId` (TB envelope store) and
`gcdrCustomerId` (report jobs).

```ts
interface ReportsHubOrchestrator {           // minimal capabilities consumed; all optional
  getEnergyGroups?(): Record<string, ReportsHubDevice[]>;
  getWaterGroups?(): Record<string, ReportsHubDevice[]>;
  getTemperatureGroups?(): Record<string, ReportsHubDevice[]>;
  getCredentials?(): { CUSTOMER_ING_ID?: string; CLIENT_ID?: string; CLIENT_SECRET?: string };
  tokenManager?: { getToken(name: string): string | undefined };
  hydrateDomain?(domain: string, period: unknown): Promise<unknown>;
  getCurrentPeriod?(): unknown;
  gcdrCustomerId?: string; gcdrApiBaseUrl?: string; gcdrApiKey?: string; gcdrTenantId?: string;
}
interface DashboardAdapterOptions {
  orchestrator: ReportsHubOrchestrator | null | undefined;
  tbCustomerId: string;
  tbBaseUrl?: string;
  getJwt(): string;
  getDataApiHost?(): string;
  isDomainLoaded?(domain: GroupReportDomain): boolean;
  temperatureClampRange?: { min: unknown; max: unknown };
  temperatureLimits?: { minTemperature?: unknown; maxTemperature?: unknown };
}
```

### 5.6 Visual context precedence (theme, mode, name)

Resolved once per opening, then used by the hub and passed to every handler as `visual`:

- `mode = params.themeMode ?? params.theme?.mode ?? 'light'`
- `palette = params.theme` (no global fallback — G-3)
- `customerName = params.customerName ?? ''`

`mode` drives the **hub** only; the hub follows the dashboard mode (C-10) and has no toggle. The
destinations keep today's visual parameters (P-14), with the precedence of §5.3:
`visual.palette ?? base.theme`, `visual.customerName || base.customerName`, `base.ui` unchanged;
Demand Panel `customer` ids kept. Making the destinations follow the dashboard mode is a follow-up
(§11).

### 5.7 Lifecycle, toggle and focus

- **Mount target:** `params.document`, else `window.top.document` when accessible, else `document`.
  The option controls the hub only; the destination modals keep their own mounting.
- **Singleton per `Document`** (registry keyed by the document). Opening when an instance exists
  on that document: `toggle: true` closes it (reason `'cancel'`) and returns the closed handle;
  `toggle: false` returns the existing handle unchanged.
- **One cleanup routine** `finish(reason)`, idempotent: aborts the in-flight selection only when
  `reason === 'cancel'`, removes listeners, calls the chrome's `destroy()`, removes the DOM, sets
  `isOpen = false` and deletes the registry entry. `handle.close()` is always a cancellation.
- **Host teardown:** the MENU stores the handle and calls `close()` in `onDestroy`, keeping the
  existing `onDestroy` chain.
- **Focus (mandatory Phase 1 criterion):** initial focus on the active tab; Tab/Shift+Tab contained
  in the dialog; arrow keys move between tabs; locked cards are `aria-disabled` **and** ignore
  Enter/Space, and show the 🔒 with the hint "Indisponível para este cliente", also exposed as
  tooltip and accessible name. On cancel (✕/Esc/backdrop) focus returns to the opener when it is
  still in the document. On success focus is **not** restored, so the report modal keeps it.

### 5.8 Safe rendering

The view builds nodes with `document.createElement`; `label`, `description` and `icon` use
`textContent`; `id`/`domain` go to `dataset`; `tint` goes to `element.style` (only colour values
accepted). No catalog value is ever concatenated into HTML. Emoji icons get `aria-hidden="true"`;
the card's accessible name is its label (and, when locked, the hint). SVG icons are not supported
in v1.

### 5.9 Chrome extension (additive)

`createPremiumModalChrome` / `applyDashboardPalette` read `window.MyIOUtils.theme`,
`MyIOOrchestrator.customerName` and `MyIOLibrary.version` as fallbacks, and the footer instantiates
`createLibraryVersionChecker` (`ModalFooter.ts:98`), which reads `window.MyIOLibrary.MyIOToast`
asynchronously and is not invalidated by `destroy()` (ED-1340). Additive options, default unchanged
for current consumers:

```ts
interface PremiumModalChromeOptions {
  // …existing
  /** Palette to apply. undefined = current behaviour (global fallback). */
  palette?: MyIOThemePalette | null;
  /** false = never consult window globals for palette, customer name or version,
   *  even when `palette` is not given. Default true. */
  useGlobals?: boolean;
}
applyDashboardPalette(el, opts?: { palette?: MyIOThemePalette | null; useGlobals?: boolean })

interface ModalFooterParams {
  // …existing
  /** 'checker' (default, current behaviour) | 'static': show `current` as text; the checker is NOT instantiated. */
  libVersionMode?: 'checker' | 'static';
}
```

The hub calls the chrome with `useGlobals: false`, `palette: visual.palette`, footer
`customerName: visual.customerName` and `libVersion: { current: <build-time library version> }`
with `libVersionMode: 'static'`. The footer keeps "cliente · relógio · versão"; update warnings are
not part of the picker.

### 5.10 Hydration, failures, concurrency and credentials

- **Hydration keeps today's semantics in this delivery (P-8).** `ensureDomainLoaded` skips settled
  domains, otherwise awaits `hydrateDomain`; a missing period or a hydration error is logged and the
  report opens with whatever the groups hold. Reason: the orchestrator turns several failures into
  `[]` (`fetchAndEnrich` :8378, `ctx.data` timeout :7538) and also returns `[]` for a legitimately
  empty domain (:7550); hydration may show its own toasts/retry. A rejection-based contract cannot be
  honoured without changing the orchestrator — that is C-3, deferred (§11, §14 D-2).
- **Inline errors exist for `prepare` rejections** — e.g. a host handler, or the demand handler when
  `getDemandPanelParams()` returns `null` ("Relatório de demanda indisponível para este cliente.").
  The message replaces the card spinner (`aria-live="polite"`), with "Tentar de novo"; the other
  cards are re-enabled; the message stays until the next click.
- **In-flight guard:** while a selection is preparing, cards are disabled and a spinner shows on the
  chosen card; a second selection is ignored.
- **Invalidation:** each selection gets an `AbortController`, aborted only by cancellation (§5.7).
  The abort is **cooperative**: `hydrateDomain` does not take a `signal`, so the request may still
  finish — its result is discarded and the destination is never opened.
- **Credentials timing:** everything a destination needs is read **at `prepare`** (AllReport base,
  Demand Panel params incl. the JWT identity); TB token and GCDR headers are additionally read **per
  request** by the existing getters.
- **Logging:** errors are logged with domain, item, phase and message only; the context,
  credentials and request bodies are never serialized.

## 6. Exports and bridge

- `src/index.ts`: export `openReportsHub`, `createDashboardReportsHubContext`,
  `buildReportItemsList`, `resolveReportItemStates`, `DEFAULT_REPORTS_CATALOG`,
  `DEFAULT_ENABLED_REPORT_ITEMS` and the public types.
- MAIN_VIEW `LIB_SYMBOLS`: add `openReportsHub`, `createDashboardReportsHubContext`. The bridge
  getters are lazy, so a bundle without them simply reads `undefined`.
- **MAIN_VIEW stops resolving defaults.** The `REPORT_ITEM_DEFAULTS` table is removed and MAIN_VIEW
  forwards the raw setting: `window.MyIOUtils.enabledReportItems = self.ctx.settings?.enabledReportItems || {}`.
  MAIN_VIEW calls no new library function. The combination "new MAIN_VIEW + old bundle" is still
  possible but no longer depends on a new resolver; an old MENU applies the same defaults locally
  (`ei(key, def)`), so it keeps the same result with a valid setting.

## 7. Behaviour of this delivery

Every row of 7.1 and 7.2 must hold in the showcase and on a live v-5.2.0 dashboard before the old
code is removed. Nothing outside these two tables is in scope.

### 7.1 Preserved behaviour

| # | Behaviour | Today |
|---|---|---|
| P-1 | Clicking Relatórios opens the hub; clicking again closes it | `existing.remove()` |
| P-2 | Tabs Energia, Água, Temperatura in this order | static `DOMAINS` |
| P-3 | Disabled items show 🔒 and do nothing | `data-enabled="false"` |
| P-4 | Defaults: only `energy_lojas` enabled; **valid (boolean)** settings override per key (same 15 keys) | `REPORT_ITEM_DEFAULTS` / `ei()` |
| P-5 | Accent follows the dashboard palette | `--rp-accent*` vars |
| P-6 | `area_comum` reads `areacomum`; `todos` excludes `ocultos` and labels each group | `_buildItemsList` |
| P-7 | Device mapping with `‖` fallbacks: `id = ingestionId ‖ id ‖ ''`, `identifier = identifier ‖ label ‖ name ‖ ''`, `label = label ‖ name ‖ identifier ‖ ''`, `excludeGroupsTotals ‖ null`, temperature `temperatureOffset = Number(offSetTemperature) ‖ 0`; input objects are not mutated | `toItem` |
| P-8 | Water/temperature hydrated before the list is built; missing period / hydration error logged and the report still opens | `_ensureDomainLoaded` |
| P-9 | Temperature valid range (clamp) and ideal range forwarded | `tempParams` |
| P-10 | "Demandas e Telemetrias" opens Demand Panel v2 with the TB store and GCDR API; full devices reach `demandDevicesFromItems` (dedup by `tbId`, id namespaces kept) | `_openDemandPanel` |
| P-11 | Customer name forwarded (orchestrator name, else dashboard title) | `customerName` |
| P-12 | Hub closes before the report modal opens | `closeModal(); _openGroupReport(...)` |
| P-13 | Mounted on the top document; covers the whole TB page | `window.top.document` |
| P-14 | AllReport opens with `ui.theme: 'light'`; Demand Panel receives the palette and customer, no `themeMode` | `baseParams.ui`, `_openDemandPanel` |

Note on P-7: the `‖` (`||`) semantics are kept on purpose — empty strings fall through, and
`Number('abc') || 0` turns `NaN` into `0`. Switching to `??` would change both.

### 7.2 Corrections included in this delivery

Each lands in its own commit after the extraction commit, so a regression can be bisected (§14 D-1).

| # | Change | Fixes |
|---|---|---|
| C-1 | Alarm tab hidden while no `alarm-report` handler exists; `group-report` rejected for `alarms` | D-1 |
| C-2 | `todos` labels the real `areacomum` key as "Área Comum" (today it shows the raw key) | — |
| C-4 | Catalog data rendered as text only | D-2 |
| C-5 | Dialog semantics, keyboard, focus containment and return | D-3 |
| C-6 | Premium chrome (RFC-0121 header + premium footer with static version) instead of the `rp-*` header | Motivation 4 |
| C-7 | Initial tab = first domain in catalog order with an enabled item — Energia whenever it has one (today: always Energia, even when all its items are locked) | — |
| C-9 | Only boolean flags count; other values fall to the default (today `rawItems[k] ?? def` keeps any non-null value: the string `"false"` disables the card through `data-enabled="false"` but hides the 🔒, because `!"false"` is `false`) | — |
| C-10 | The picker itself follows the dashboard light/dark mode (today always light with the accent) — the destinations do not change (P-14) | — |

**Not in this delivery:** C-3 (stop on hydration failure — deferred, §11) and the former C-8
(destinations follow dark mode — §11).

## 8. Resulting MENU code

```js
// RFC-0181/0239: Relatórios → Reports Hub (library)
let _reportsHubHandle = null;

function openReportsPickerModal() {
  // Second click closes, even if the context could no longer be built.
  if (_reportsHubHandle?.isOpen) {
    _reportsHubHandle.close();
    _reportsHubHandle = null;
    return;
  }
  const U = window.MyIOUtils || {};
  if (typeof U.openReportsHub !== 'function' || typeof U.createDashboardReportsHubContext !== 'function') {
    toastError('Relatórios indisponíveis nesta versão da biblioteca. Atualize a biblioteca MyIO.');
    return;
  }
  try {
    const orch = window.MyIOOrchestrator;
    _reportsHubHandle = U.openReportsHub({
      context: U.createDashboardReportsHubContext({
        orchestrator: orch,
        tbCustomerId: settings.customerTB_ID || window.__myioCustomerTB_ID || '',
        tbBaseUrl: settings.tbBaseUrl || '',
        getJwt: () => localStorage.getItem('jwt_token') || '',
        getDataApiHost: () => U.getDataApiHost?.(),
        isDomainLoaded: (d) => isDomainSettled(window.MyIOOrchestratorData?.[d]), // excludes :loading / :failed
        temperatureClampRange: U.temperatureClampRange,
        temperatureLimits: U.temperatureLimits,
      }),
      enabledItems: U.enabledReportItems,
      theme: U.theme,
      customerName: orch?.customerName || getCurrentDashboardTitle() || '',
    });
  } catch (err) {
    LogHelper.error('[MENU RFC-0239] Reports Hub failed to open:', err?.message || err);
    toastError('Não foi possível abrir os relatórios agora.');
  }
}

// in self.onDestroy (keep the existing chain):
_reportsHubHandle?.close();
```

`isDomainSettled` is the readiness predicate of §5.5, written once the Phase 1 check confirms how
`MyIOOrchestratorData[d]` marks provisional and failed data.

Removed from `MENU/controller.js`: `_renderReportsPicker`, `GROUP_LABELS`, `_buildItemsList`,
`_openDemandPanel`, `_ensureDomainLoaded`, `_openGroupReport` (≈ 450 lines). There is **no inline
fallback**: an incompatible bundle gives a controlled toast and leaves the rest of the MENU working.

## 9. Migration and release plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **1 — Library** | `reports-hub/` module, chrome + footer extensions (§5.9), exports, tests, showcase | Characterization tests green against the **old** code and then, unchanged, against the extracted code (§10); unit + integration tests green; showcase passes §7.1 and §7.2 with the **real default handlers** and the adapter; keyboard/focus criteria (§5.7) met; ESM/CJS/UMD exports and `.d.ts` verified; size delta measured and within the approved ceiling (§10) |
| **2 — Widgets** | MAIN_VIEW (§6) + MENU (§8); delete the old code | Validated on a live dashboard through the CDP interceptor with the local build, **before** publishing; compatibility matrix below |
| **3 — Release** | See sequence below | Smoke test on one shopping |

Release sequence:

1. Record the minimum library version that exports `openReportsHub` (the next published version).
2. Tell support that the Alarmes tab disappears from Relatórios (its three items never worked, C-1).
3. Publish with `npm publish --tag homolog`; confirm the version served at the URL the dashboard
   actually loads, and that `MyIOLibrary.openReportsHub` / `createDashboardReportsHubContext`
   exist there.
4. Promote the library; confirm again on the dashboard's bundle URL.
5. Only then update MAIN_VIEW and MENU in ThingsBoard.
6. Smoke test: energy Lojas, water Todos (before opening the water tab), temperature Climatizáveis,
   Demandas e Telemetrias, a locked card, Esc/backdrop, second click closes, light and dark
   dashboard.

Compatibility matrix (Phase 2, run by dev; repeated by QA on the homolog bundle — §14 D-6):

| Widgets | Bundle | Expected |
|---|---|---|
| old | new | Unchanged behaviour (old picker; `openDashboardPopupAllReport` / `openDemandPanelV2` unchanged) |
| new | new | Reports Hub |
| new | old | Relatórios shows the controlled toast; the rest of the dashboard works |

Rollback: re-publish the previous MENU/MAIN_VIEW widget versions; the previous bundle must stay
available at its URL.

## 10. Testing

**Characterization first.** Copy today's `toItem`/`_buildItemsList` and the `ei()` defaults verbatim
into `tests/fixtures/reports-hub/legacy-menu.js` and assert them — **green against the old
behaviour**. Then run the same assertions against `buildReportItemsList` / `resolveReportItemStates`;
only the rows of §7.2 (C-2, C-9) may change expectations, and each change is explicit in the test.

**Unit (Vitest, jsdom)** — `tests/components/reports-hub.test.ts`, `tests/utils/reports-hub-items.test.ts`,
fixture `tests/fixtures/reports-hub/legacy-catalog.ts` (`key, domain, item, defaultEnabled, kind`):

- `resolveReportItemStates`: legacy defaults; boolean overrides; `"true"`, `"false"`, `null`, `1`
  fall to the default; unknown keys ignored; custom item locked by default and enabled by its key;
  host handler over default; `isAvailable` false → hidden; `group-report` in `alarms` → hidden;
  duplicate domains and duplicate item ids dropped; custom catalog keeps its order; initial-tab
  fallbacks (Energia enabled → Energia; only Água enabled → Água; none enabled → first visible with
  locked cards; nothing visible → empty state).
- `buildReportItemsList`: `area_comum`, `todos` without `ocultos` + `groupLabel` (incl. C-2); device
  without name/identifier → `identifier: ''`, `label: ''`; empty ids; `Number('abc') || 0 → 0`;
  `excludeGroupsTotals` as string and object; inputs not mutated; empty groups → `[]`.
- **Selection protocol:** success runs prepare → finish('success') → open in that order, without
  aborting; prepare rejection keeps the hub with the inline message and retry works; `handle.close()`
  during prepare → `signal.aborted`, destination never opened; double click opens one destination;
  a host handler follows the same protocol; `open()` throwing → `onError({ phase: 'open' })` + toast,
  no unhandled rejection.
- **Lifecycle and leaks:** toggle; `toggle: false`; two documents
  (`document.implementation.createHTMLDocument()`). Leak checks track **identity**
  (target, type, listener, capture) of every listener added by the hub and require each to be
  removed or attached to a node that was removed; `once` listeners are exempt. Timers: isolated
  fixture with `vi.useFakeTimers()`; `vi.getTimerCount() === 0` after `close()` **and** after
  flushing pending promises.
- **Footer (R-3):** in `libVersionMode: 'static'` the version checker module is not called (spy);
  close with a pending promise, resolve it afterwards → no timers, listeners or toasts.
- **G-3 contract:** the hub runs — mount, tab navigation, selection, close, pending async work —
  with a `window` proxy that throws on any access to `MyIOUtils`, `MyIOOrchestrator`, `MyIOLibrary`
  or `MyIOOrchestratorData`.
- Keyboard and focus (main document only; jsdom focus in a second document is not reliable):
  Esc/backdrop; arrows on tabs; Enter/Space ignored on locked cards; focus return on cancel; no focus
  steal after success.
- Rendering: labels/icons/ids with markup rendered as text; emoji `aria-hidden`.
- Visual context: dark from palette; explicit mode wins; AllReport `ui.theme` stays `'light'`;
  base `theme`/`customerName` kept when the hub params omit them; Demand Panel customer ids kept;
  theme/name A in params while globals hold B → A.
- Chrome/footer regression: existing consumers keep the global fallbacks and the checker when the
  new options are omitted.
- Adapter (integration, real default handlers, destinations mocked at their boundary): stub
  orchestrator → empty state; water-only orchestrator → only Água; `tbCustomerId` from the caller's
  fallback; three distinct customer ids; JWT changed between opening and selection → identity of
  the new JWT; demand params `null` → Demandas hidden/inline message, group reports work;
  `isDomainLoaded` false for provisional/failed data → hydrate.

**Size (R-5).** Until ED-1341 lands, the existing guards do not protect anything:
`check-bundle-size.mjs` exits 0 without measuring on Windows, and both scripts' absolute limits
(25–60 KiB raw, 26 KiB gzip) are far below the current bundle (`umd.min.js` ≈ 6.26 MB raw,
≈ 1.39 MB gzip, measured on local artefacts). The criterion is therefore a **delta**:

- artefact `dist/myio-js-library.umd.min.js`, unit gzip bytes, base = `desenv` at the branch point
  and candidate built with the same `npm run build` chain;
- report absolute sizes and delta in the Phase 1 PR;
- ceiling **+8 KiB gzip** (proposed; approved in the PR);
- the measurement command must print its report (no silent exit 0).

**Showcase** — `showcase/reports-hub/index.html`, loading `dist/myio-js-library.umd.js`:

- Mock orchestrator with energy / water / temperature groups (incl. `ocultos`, `areacomum`,
  devices with `excludeGroupsTotals`), a stub mode, and a `hydrateDomain` that resolves, rejects or
  hangs.
- Controls: enabled-items checkboxes, light/dark, palette, customer name, "water not hydrated",
  "no period", custom catalog item, custom `alarm-report` handler, demand params unavailable.
- Default mode uses the **real** handlers and adapter, with `openDashboardPopupAllReport` fed by a
  mocked `fetch` and the real Demand Panel with the RFC-0238 mock GCDR. A call-log mode exists for
  layout work only and does not count as functional evidence.

**Evidence split:** unit, integration, exports and size run in CI; showcase and the live smoke test
are complementary evidence.

## 11. Follow-ups (out of scope)

- **C-3 — stop the opening when a domain fails to load** (D-4). Needs an orchestrator load operation
  with an unambiguous result (success incl. empty, or failure), a readiness query that rejects
  provisional/failed data, coalesced calls honouring the same contract, and a notification policy
  that does not compete with the global toasts/retry. Then the hub shows the failure inline with
  retry. Own ticket and RFC section; depends on MAIN_VIEW changes.
- **Destinations follow the dashboard dark mode** (former C-8): AllReport contrast review of table,
  charts and PDF (exports stay light); Demand Panel `themeMode`.
- ED-1340 — version checker `destroy()` invalidation (all premium modals).
- ED-1341 — bundle-size guard on Windows and incremental budget.
- HEADER "Relatório" button reusing the hub or `buildReportItemsList`.
- Reports hub in v-5.4.0 and Head Office (their own `ReportsHubContext`).
- Alarm reports implementation (`alarm-report` handler) — D-1.
- Locked-card wording with commercial text / CTA (§14 D-4).
- Icon registry with library-owned SVG.
- Driving the catalog from the GCDR classification tree (RFC-0207/0234) instead of fixed groups.

## 12. Decisions on the rev. 1 open questions

| Question | Decision |
|---|---|
| Component name | `openReportsHub` — it hosts group reports, the Demand Panel and future extensions. |
| Alarm tab | Hidden while there is no applicable handler (C-1); with a handler it follows the existing flags and shows locked cards when disabled. |
| Inline fallback | None; controlled toast in the MENU, MAIN_VIEW without new dependencies, verified release order (§9). |
| Theme toggle | No toggle in v1; the hub follows the dashboard mode (C-10); destinations keep today's parameters (P-14). |
| Catalog in settings | Code-only in v1; settings keep only `enabledReportItems`; custom catalogs through the API with the rules in §5.4. |

## 13. Rev. 2 open questions — outcome

| Question | Outcome |
|---|---|
| C-3 stop on hydration failure | Merit agreed by everyone; **deferred** — not implementable with the current orchestrator contract (R-2). §11 |
| C-7 initial tab | In this delivery: first domain in catalog order with an enabled item |
| C-8 destinations follow dark mode | Out of this RFC; §11 |

## 14. Decisions (closes roundtable 1 and feedback v2)

Roundtable 1 (2026-10-13): 🏗️ Winston (architecture), 💻 Amelia (implementation/tests), 🎨 Sally
(UX), 📋 John (product). Feedback v2 recommended the closing positions below. Rows marked
**owner decision** are not technical and stay with the RFC owner; they do not change the contracts
in §5–§10.

| # | Topic | Decision |
|---|---|---|
| D-1 | Phasing | Include C-1, C-2, C-4, C-5, C-6, C-7, C-9, C-10. One extraction commit with parity (§7.1), then one commit per correction, so a regression can be bisected. No invalid routing (alarms) is kept even temporarily. |
| D-2 | C-3 | **Deferred** (§11). The orchestrator converts failures into `[]` and cannot distinguish them from an empty domain; a correct fix changes MAIN_VIEW and would overlap the Ingestion regression (ED-1337). No claim of production incidence is made. |
| D-3 | Sprint 20 scope and publishing window | **Owner decision.** Recommended: Sprint 20 delivers Phase 1 + Phase 2 validated through the interceptor, without publishing; Phase 3 after ED-1337 closes. ED-1335 states that boundary. |
| D-4 | Locked-card wording | Neutral hint "Indisponível para este cliente"; no "plano" and no CTA until a commercial contract exists (§11). Does not block implementation. |
| D-5 | Chrome | Keep the additive `useGlobals` / `palette` options and add the footer's static version mode (§5.9); do not duplicate the frame. |
| D-6 | Evidence and ownership | Unit/integration/exports/size in CI; showcase and live smoke as complementary evidence; call-log mode is not functional evidence. Compatibility matrix: dev in Phase 2 (local build), QA on the homolog bundle — **owner names the QA owner**. |
| D-7 | Definition of Done of ED-1335 | §7.1 and §7.2 hold in the showcase and on a live dashboard; §10 green in CI; size delta within the approved ceiling; MENU report code reduced to the call in §8 (≈ 40 lines incl. error handling and teardown — a simplification target, not a reason to drop them). |
