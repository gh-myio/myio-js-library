# RFC-0212 — Customer Insight Modal (domain-agnostic premium modal)

- **RFC**: 0212
- **Title**: Customer Insight Modal — a domain-agnostic premium modal replacing the `EnergySummaryTooltip` "maximize" state
- **Status**: Proposed (2026-06-25) — design only, not implemented. For discussion. **BMAD roundtable held 2026-06-25** (see § Addendum — BMAD Roundtable): decisions D1–D6 refine the open questions; `classifyGcdrDevices` extraction is a blocking pre-req.
- **Author**: Rodrigo Lago
- **Created**: 2026-06-25
- **Target**:
  - `src/components/premium-modals/customer-insight/` (new component)
  - `src/components/premium-modals/index.ts` (export)
  - `src/index.ts` (public API)
- **Related**:
  - `src/utils/tooltips/EnergySummaryTooltip.ts` — the hover tooltip whose full-screen "maximize" this modal replaces (RFC-0105).
  - RFC-0207 — Customer-Scoped Device Classification Profile (the customer taxonomy that drives groups/columns).
  - RFC-0209 — Slim dashboard controller; `parseClassificationEntities`, `classifyAllDevices`, `buildByStatusFromDevices` (single-source pure helpers this modal reuses).
  - RFC-0047 (GCDR) — Generic Entity Registry; `/entities` classification tree + `/devices` registry consumed here.
  - RFC-0211 — v-5.4.0 parity (the agnostic controller this modal aligns with).
  - `src/utils/devices/classificationTree.ts` — `ParsedClassificationTree` (`domains[] → columns[] → profiles[]`, `profileIndex`).
  - `src/utils/exportMapDomain.ts` — `DomainMap` / `DomainDescriptor` (icon/unit/label metadata).
  - RFC-0205 — Premium Dialog (the `open*` + injected-styles + scoped-querySelector pattern this follows).

---

## Summary

`EnergySummaryTooltip` (RFC-0105) is a premium hover tooltip showing a comprehensive
energy summary (total devices, category tree, per-status matrix, total consumption). It has
a **"maximize"** button that expands the tooltip to `top/left/right/bottom: 20px` —
effectively the **entire viewport**. A tooltip taking over the whole screen is the wrong
primitive: it is hard to dismiss, it fights the page underneath, it is energy-only, and its
content/layout were designed for a 450px hover card, not a full page.

This RFC proposes a dedicated **Customer Insight Modal** — a real, centered, bounded premium
modal (`max-width ~960px`, `max-height ~85vh`, internal scroll) — that presents the same
class of information but **for the whole customer, across every domain the customer has**,
not just energy. It is **domain-agnostic by construction**: it derives its tabs, columns,
and groups from the customer's **GCDR classification tree** (`parseClassificationEntities`)
and the customer's **taxonomy** (RFC-0207), exactly like the v-5.4.0 controller. It hard-codes
**no** domain word ("energy"/"water"/"temperature") and **no** fixed grid/column.

Per the product decision, the component **fetches its own data from GCDR** (entities tree +
devices), given a customer id + API key, reusing the library's single-source pure helpers so
classification/status logic never diverges from the dashboard.

---

## Motivation

### The tooltip's "maximize" is a full-screen takeover

`EnergySummaryTooltip` CSS (`src/utils/tooltips/EnergySummaryTooltip.ts`):

```css
.energy-summary-tooltip.maximized {
  top: 20px !important; left: 20px !important;
  right: 20px !important; bottom: 20px !important;
  width: auto !important; max-width: none !important;
}
```

When "maximize" is pressed, an element with `position: fixed; pointer-events: auto` covers
the screen with a 450px-card layout stretched to full width. Problems:

1. **Wrong primitive.** A tooltip is a transient hover affordance; a full-page surface is a
   modal. Conflating them yields a thing that is neither: no backdrop, no focus trap, no
   standard close affordance, awkward drag math, an 8-second force-hide timer that fires
   mid-reading.
2. **Energy-only.** The tooltip models `DashboardEnergySummary` — categories and consumption
   in `kWh/MWh`. A customer with water and temperature (and, per RFC-0047, potentially *any*
   domain — gas, only-water…) has no equivalent full view.
3. **Layout not built for the size.** The category tree, status matrix (`repeat(4, 1fr)`),
   and totals were tuned for a narrow card. Stretched edge-to-edge they read as sparse and
   unstructured.
4. **Not customer-scoped, not taxonomy-driven.** The tooltip's groups come from the energy
   classifier's fixed buckets, not from the customer's own GCDR taxonomy (RFC-0207). Two
   customers with different group trees can't both be represented faithfully.

### Why a separate component (not "fix the tooltip")

The hover tooltip is still useful **as a tooltip** — quick, in-place, energy-focused. The
fix is not to make the tooltip bigger; it is to provide the **right surface** for the
"I want the full picture" intent and **leave the tooltip as a tooltip** (drop, or repoint,
its maximize button — see Migration). The two have different lifecycles, layouts, and data
scopes.

### Goals

1. A **premium modal** (centered, bounded, scrollable, focus-trapped, Esc/backdrop close)
   for a **customer-wide** insight view — not a full-screen tooltip.
2. **100% domain-agnostic**: tabs/columns/groups derived from the GCDR tree + `DomainMap`
   metadata; zero domain words or fixed grid vars in the component (mirrors v-5.4.0).
3. **Aligned with the customer taxonomy (RFC-0207)**: the group/column structure shown is
   exactly the customer's classification structure, so counts match the dashboard.
4. **Self-fetching from GCDR** (entities + devices), reusing the library's single-source
   classification/status helpers (RFC-0209) — never a private re-implementation.
5. Live in `src/components/premium-modals/` following the established `open*Modal` contract
   (instance with `close`/`open`, injected styles, scoped `querySelector`).

### Non-goals

- Replacing the dashboard grids or the `TelemetryInfo` breakdown component.
- Deleting `EnergySummaryTooltip` (it stays as a hover tooltip; only its maximize changes).
- Editing the customer taxonomy — that is RFC-0207's `openDeviceProfileModal`. This modal is
  **read-only insight**.
- Introducing a new classification or status algorithm (it consumes the lib's).

---

## Guide-level explanation

### What the user sees

A centered modal over a dim backdrop. A header with the customer name, a refresh button, and
a close button. Below it, a **tab strip with one tab per domain the customer actually has**
(label + icon from `DomainMap`: ⚡ Energia, 💧 Água, 🌡️ Temperatura, …) — built from the
tree, so a water-only customer sees one tab, a four-domain customer sees four.

Each domain tab shows:

- A **totals banner**: total devices in the domain, and (when available) the domain's
  aggregate value in the domain's unit (`kWh`/`m³`/`°C`, from `DomainDescriptor`).
- A **group/column breakdown**: one row per column of that domain's tree (e.g. *Entrada de
  Energia*, *Lojas*, *Climatização*…), with device count and value. Columns come **straight
  from `parseClassificationEntities`** — the same structure the dashboard renders — so the
  breakdown is the customer's taxonomy verbatim, not a fixed set.
- A **status matrix**: device counts per connection/consumption status
  (`buildByStatusFromDevices`), reusing the same status taxonomy as the tooltip and grids.
- An **unmapped notice**: devices whose `deviceProfile` is absent from the tree's
  `profileIndex` (the agnostic controller already surfaces these as a toast; here they are
  listed, supporting the RFC-0207 "orphans" diagnostic).

The modal is **bounded** (`max-width ~960px`, `max-height ~85vh`, body scrolls). It never
covers the whole viewport; it never drags; it has a backdrop and a focus trap.

### How a caller opens it

```ts
import { openCustomerInsightModal } from 'myio-js-library';

const modal = openCustomerInsightModal({
  // GCDR data source (component fetches entities + devices itself):
  gcdrApiBaseUrl: 'https://api.gcdr…',
  gcdrCustomerId: 'cust-123',
  gcdrApiKey: '<X-API-Key>',
  customerName: 'Shopping Mestre Álvaro',   // header title (optional)

  // Optional: live values. Without these the modal shows counts + status only.
  dataApiHost: 'https://data…',             // Data Apps API for consumption totals
  ingestionToken: '<token>',                // or clientId/clientSecret to build one
  period: { startISO, endISO },

  theme: 'light',
  onClose: () => {},
});

// later
modal.close();
```

The component fetches, classifies, and renders. Opening shows a **skeleton/loading state**
immediately; the instance is returned synchronously and exposes a `ready` promise that
resolves once data has loaded.

### Reuse, not re-implementation

The component imports the **same** library helpers the dashboard uses:
`parseClassificationEntities` (tree), `classifyAllDevices` / the `profileIndex` routing, and
`buildByStatusFromDevices` (status). It does **not** re-derive any classification or status
rule. This is the RFC-0209 contract: one tested implementation, no drift.

---

## Reference-level explanation

### File layout

```
src/components/premium-modals/customer-insight/
├── index.ts                          # re-exports
├── openCustomerInsightModal.ts       # entry: lifecycle, backdrop, focus trap, returns instance
├── CustomerInsightModalView.ts       # pure render + scoped interactions (per-tab, refresh)
├── CustomerInsightDataFetcher.ts     # GCDR fetch (entities + devices) + optional Data Apps totals
├── types.ts                          # params + view-model types
└── styles.ts                         # injected CSS (`myio-ci-*` namespace)
```

### Public types (`types.ts`)

```ts
export interface CustomerInsightModalParams {
  /** GCDR registry base URL (entities + devices). Required. */
  gcdrApiBaseUrl: string;
  /** GCDR customer id (scopes entities + devices). Required. */
  gcdrCustomerId: string;
  /** X-API-Key for GCDR. Required for non-public deployments. */
  gcdrApiKey?: string;
  /** Header title; falls back to a generic "Visão do Cliente". */
  customerName?: string;

  /** Optional live-value source. Absent → counts + status only (no consumption). */
  dataApiHost?: string;
  ingestionToken?: string;
  clientId?: string;
  clientSecret?: string;
  period?: { startISO: string; endISO: string };

  theme?: 'light' | 'dark';
  /** Mount target (shadow-DOM safe); defaults to document.body. */
  container?: HTMLElement;
  closeOnBackdrop?: boolean;   // default true
  closeOnEscape?: boolean;     // default true
  onClose?: () => void;
  onError?: (err: Error) => void;
}

export interface CustomerInsightModalInstance {
  /** Resolves when the first data load + render completes (or rejects on fatal load error). */
  ready: Promise<void>;
  /** Re-fetch + re-render. */
  refresh(): Promise<void>;
  close(): void;
  open(): void;
  element: HTMLElement;
  on(event: 'close', handler: () => void): void;
}

/** A single domain's computed view-model (built from the tree + classified devices). */
export interface DomainInsight {
  code: string;                 // tree domain code (agnostic; not an enum)
  label: string;                // DomainMap name, fallback to tree label
  icon: string;                 // DomainMap icon, fallback '•'
  unit: string;                 // DomainMap unit
  totalDevices: number;
  totalValue: number | null;    // null when no live-value source provided
  columns: Array<{ key: string; label: string; deviceCount: number; value: number | null }>;
  byStatus: ReturnType<typeof buildByStatusFromDevices>;
}

export interface CustomerInsight {
  customerName: string;
  domains: DomainInsight[];      // one per tree domain the customer has
  unmapped: Array<{ id: string; label: string; deviceProfile: string }>;
  lastUpdated: string;
}
```

### Data flow (`CustomerInsightDataFetcher.ts`)

Mirrors the v-5.4.0 controller's fetch path so counts match the dashboard exactly:

1. `GET {gcdrApiBaseUrl}/entities?parentId=null&deep=all&customerId={id}` (header `X-API-Key`)
   → `parseClassificationEntities(json)` → `ParsedClassificationTree` (`domains`, `profileIndex`).
2. `GET {gcdrApiBaseUrl}/devices?customerId={id}&limit=500&offset=…` (paginated, `hasMore`)
   → device registry rows.
3. **Classify** each device by `deviceProfile` via `profileIndex` (uppercased) → `{ domain,
   column }`; devices whose profile isn't in the index go to `unmapped`. (Identical to
   `classifyGcdrDevices` in the controller — extracted/shared, not re-coded.)
4. **Status** per domain via `buildByStatusFromDevices(devicesOfDomain)`.
5. **Values** (optional): if a Data Apps source is configured, fetch totals for the period and
   join by `ingestionId`; otherwise `value`/`totalValue` stay `null` and the UI hides value
   columns. (The GCDR `/devices` registry carries **no live telemetry value** — the controller
   sets `value: null` — so consumption is a *separate* fetch, not free with the device list.)
6. Build `CustomerInsight` (domains + columns + status + unmapped) for the view.

`DomainMap` (`exportMapDomain()`) supplies each domain's `icon`/`unit`/`name`; the tree
supplies structure. Unknown domain codes (not in `DomainMap`) still render using the tree's
own label and a neutral icon — **agnostic fallback, never a hard-coded list**.

### Rendering (`CustomerInsightModalView.ts`)

- One backdrop + one bounded dialog. All lookups via `root.querySelector` with `data-bound`
  guards (CLAUDE.md "Shadow DOM Button Binding") — never `document.getElementById`.
- Tab strip generated from `insight.domains`. Switching tabs toggles `data-domain` sections
  (CSS show/hide), no refetch.
- Each section renders totals banner, column breakdown (count + optional value), status
  matrix, unmapped notice. Value cells/columns are omitted entirely when `totalValue == null`.
- Loading state: skeleton rows until `ready` resolves; error state: inline message + retry
  that calls `refresh()`.

### Lifecycle (`openCustomerInsightModal.ts`)

Follows `openWelcomeModal`/`openDialog`:

- `injectCustomerInsightStyles()` once (idempotent, id-guarded `<style>`).
- Build view, append to `container ?? document.body`, lock body scroll, animate in.
- Focus trap + Esc (capture) + backdrop click (when enabled); restore focus on close.
- `z-index` above the premium-modals baseline (consistent with `BASE_Z_INDEX` in dialog).
- Kick off the fetch; resolve `ready`; on fatal load error call `onError` and show the error
  state (the modal still opens — it never silently fails).

### Styles (`styles.ts`)

A `myio-ci-` namespaced stylesheet (Nunito font per project standard; accent `#7C3AED` /
domain-tinted headers). Bounded shell:

```css
.myio-ci { width: min(960px, 92vw); max-height: 85vh; display: flex; flex-direction: column; }
.myio-ci__body { overflow-y: auto; flex: 1 1 auto; min-height: 0; }
```

No `position: fixed` full-bleed rule — that is precisely the tooltip behavior we are leaving
behind.

### Migration of the tooltip's maximize

`EnergySummaryTooltip`'s maximize button is **repointed**: instead of toggling the
`.maximized` full-screen class, it calls `openCustomerInsightModal(...)` (energy tab focused)
and hides the tooltip. The `.maximized` CSS + `toggleMaximize` drag/restore machinery are
removed. This is a self-contained change; the hover behavior is untouched.

---

## Drawbacks

- **A second consumer of the GCDR fetch.** The modal re-fetches entities/devices the
  controller already loaded. Mitigation: accept an optional `provide`-mode (pass a
  pre-parsed tree + device list / `window.STATE.classified`) so an in-dashboard caller can
  skip the round-trip; standalone callers fetch. (Primary mode is fetch, per the product
  decision; provide-mode is an optimization, see Unresolved Q1.)
- **Values aren't free.** The device registry has no telemetry value; showing consumption
  requires a Data Apps fetch + token. Without it the modal is counts+status only. Honest, but
  a partial view. Mitigation: clearly degrade (hide value columns), document the requirement.
- **Another modal to maintain** alongside the tooltip and `TelemetryInfo`. Mitigation: it
  reuses lib helpers and the established modal pattern; the net code is mostly view + styles.
- **Drift risk vs the tooltip's visual language.** Two surfaces show similar data. Mitigation:
  share the status taxonomy/labels and formatting helpers; the modal is structurally
  different (bounded, multi-domain) on purpose.

---

## Rationale and alternatives

- **Fix the tooltip's maximize in place (status quo+).** Rejected: keeps the wrong primitive
  (a `position:fixed` card masquerading as a page), stays energy-only, and can't represent an
  arbitrary customer taxonomy.
- **Reuse `EnergySummaryTooltip.renderHTML` inside a modal shell.** Rejected: that renderer is
  bound to `DashboardEnergySummary` (energy categories, `kWh`), not the agnostic tree. Forcing
  multi-domain through it would re-introduce the hard-coding RFC-0207/0209 removed.
- **A new dashboard *widget* instead of a modal.** Rejected: the intent is an on-demand "full
  picture" overlay from the tooltip/header, not a persistent dashboard pane (that is the grid
  + `TelemetryInfo` already).
- **Component fetches vs caller provides data.** Decided: **component fetches** (product
  decision) so it is usable standalone and from the tooltip without threading dashboard
  internals; provide-mode is an optional optimization, not the default.
- **Hard-code energy/water/temperature tabs.** Rejected outright — violates the v-5.4.0
  agnostic contract; the customer's tree (RFC-0047/0207) is the single source of structure.

---

## Prior art

- **`EnergySummaryTooltip` (RFC-0105)** — the content model and status matrix this generalizes.
- **`openWelcomeModal` / `openDialog` (RFC-0112 / RFC-0205)** — the `open*` lifecycle,
  injected-styles, focus-trap, scoped-`querySelector` pattern followed here.
- **v-5.4.0 controller (RFC-0209/0211)** — the agnostic tree→sections fetch+classify flow this
  mirrors (`parseClassificationEntities`, `profileIndex`, `buildByStatusFromDevices`).
- **RFC-0207** — the customer taxonomy whose structure the breakdown reflects, and whose
  "orphans/unmapped" diagnostic the unmapped notice supports.
- **`TelemetryInfo` component** — per-domain breakdown precedent (column summaries).

---

## Unresolved questions

1. **Fetch-only vs optional provide-mode.** Should the MVP also accept a pre-loaded
   tree+devices (or read `window.STATE.classified`) to avoid a re-fetch when opened from the
   dashboard? (Leaning: ship fetch-only; add provide-mode behind the same params later.)
2. **Consumption values in MVP.** Include the Data Apps totals fetch in v1, or ship
   counts+status first and add values in a follow-up? (Leaning: counts+status v1; values v1.1,
   since the token/period wiring is non-trivial and the dashboard already owns it.)
3. **Where is it triggered from?** Tooltip maximize only, or also a header/menu entry
   ("Visão do Cliente")? (Affects whether energy-tab-focus is a param.)
4. **Per-column drill-down.** Should a column row expand to its devices (like the tooltip's
   status "+" popover), or stay a summary? (Leaning: summary in v1; drill-down as Future.)
5. **Multi-customer / head-office.** For a holding dashboard, one modal per customer, or a
   customer selector inside the modal? (Out of MVP; see Future.)

---

## Future possibilities

- **Per-column / per-status drill-down** to a device list (reuse the tooltip's popover idea).
- **Head-office mode**: a customer selector + "by shopping" aggregation (the tooltip's
  `byShoppingBreakdown`, generalized to the tree).
- **Export** the insight (PDF/CSV), consistent with `AllReportModal`/annotations exports.
- **Trend sparkline** per domain/column when the Data Apps period source is present.
- **Deep-link** from an alarm/annotation to the relevant domain tab.
- **Shared "summary view-model" util** that both this modal and `EnergySummaryTooltip` consume,
  collapsing the two surfaces onto one data source.

---

## Addendum — BMAD Roundtable (2026-06-25)

> Status: party-mode roundtable on the proposed design. Four independent agents —
> 🏗️ Winston (Architect), 📋 John (PM), 🎨 Sally (UX), 💻 Amelia (Dev). This section
> records their positions and the resulting decisions; it **refines the Unresolved
> Questions** above.

### Where the table converges

- **Q2 (values in v1) — unanimous: ship counts+status in v1, values in v1.1.** Coupling the
  Data Apps token+period fetch to v1 doubles the error surface and the "why doesn't the modal
  total match the header?" support load. The device registry's `value: null` is the honest
  baseline.
- **The honesty of the `value: null` constraint is the RFC's strength**, not a weakness — but
  only if the UI *names* the absence (see Sally) and the product *reframes the promise* (see
  John).

### Positions per agent

| Agent | Q1 (fetch vs provide) | Q2 (values) | Q3 (trigger) | Q4 (drill-down) | Signature point |
|-------|----------------------|-------------|--------------|-----------------|-----------------|
| 🏗️ Winston | **Provide-primary, fetch-fallback** | v1.1, inject `valuesProvider` | dual; maximize is just a caller | v1.1 | Component consumes pure helpers + adapters only; **never touch `window.MyIOOrchestrator` directly**; transport (X-API-Key/baseURL/paging) is **injected**, or you lose the showcase. |
| 📋 John | Fetch-only v1 | v1 viable **only if the promise is reframed** | **Header/menu entry mandatory** ("Visão do Cliente") | **Minimal drill-down in v1** | The job is **customer diagnosis**, not "a bigger card". "Replace the maximize" is the symptom, not the job. |
| 🎨 Sally | (defers) | v1 OK — **name the absence** ("Consumo: disponível em breve") | **Only the maximize in v1** — validate one flow, then measure | **Out of v1**; make status counts click→ existing filtered grid | Skeleton must carry the **final anatomy** (tabs render from the tree *immediately*, before fetch) — **no layout shift**; error degrades, never blanks. |
| 💻 Amelia | **Provide-primary, fetch-fallback** | counts+status v1 | (defers) | v1.1 | **Blocking pre-req:** extract `classifyGcdrDevices`/`gcdrDeviceToMeta` from the v-5.4.0 controller into the lib *first*, or "single source" is theatre. Inject `httpClient` for Vitest. |

### Open disagreements (for Rodrigo to settle)

1. **Q1 — fetch vs provide.** Product decision was "component fetches". Winston **and** Amelia
   independently flag that re-fetching `/entities`+`/devices` when opened from the dashboard
   duplicates I/O and risks the modal showing a **different state than the grid behind the
   backdrop**. Their counter-proposal: `openCustomerInsightModal({ tree, devices }?)` —
   **provide-primary, internal fetch as fallback** (standalone/menu case). This keeps the
   product's "self-sufficient" goal while removing the inconsistency window. **Recommended:
   adopt provide-primary-with-fetch-fallback.**
2. **Q3 — trigger.** John (header entry mandatory — the job deserves a front door) vs Sally
   (only the maximize in v1 — one flow, then measure). Both agree the tooltip's `.maximized`
   full-screen is retired and its button becomes a "Ver detalhes" caller.
3. **Q4 — drill-down.** John (minimal device list in v1 — "where is it not OK?" needs to reach
   the device) vs Sally/Winston/Amelia (v1.1). Sally's bridge: make the **status count
   clickable → the existing filtered grid** (reuse, not a new screen) — satisfies the diagnosis
   job without building inventory UI in v1.

### Decisions folded back into the design

- **D1 — Reframe the product promise (John).** The modal is "**Visão do Cliente — saúde e
  cobertura**", not "Energy Summary maximized". Status/coverage is the 100%-controllable value;
  consumption is additive in v1.1. The header copy and any menu label follow this framing.
- **D2 — Extraction is a blocking pre-requisite (Amelia, RFC-0209 spirit).** Before this
  component: extract `classifyGcdrDevices(devices, tree)` and `gcdrDeviceToMeta(dev)` from
  `src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js` into
  `src/utils/devices/classifyGcdrDevices.ts` (pure, exported via `src/index.ts`); repoint the
  v-5.4.0 controller to the shared symbol with existing tests green; **then** the fetcher
  imports the same classifier. No second copy of the classification rule.
- **D3 — Inject transport, never reach for globals (Winston).** The fetcher takes an injected
  `httpClient` (`{ get(url): Promise<json> }`) and base config; it does not read
  `window.MyIOOrchestrator`. This makes it Vitest-coverable (mock the client) and showcase-safe.
- **D4 — Skeleton carries the final anatomy (Sally).** Tabs derive from the tree and render
  immediately (the tree may itself be provided per D1/Q1); only the per-domain
  counts/status/values stream in. No layout shift. Error state degrades to whatever the tree
  already gives + an amber "tentar de novo" (`refresh()`).
- **D5 — Extract `buildInsightViewModel(classified) → CIViewModel` from the View (Amelia).**
  The pure view-model builder is the real test asset; the View only renders it. `ready`
  resolves after first data render and **rejects** (with a timeout) on fetch failure — a
  rejected `ready` is not a closed modal; the View shows the error state.
- **D6 — Bundle budget (Amelia).** Target `< 8KB` minified for the modal + `myio-ci-` styles;
  reuse `openDialog.ts`'s idempotent `injectStyles()`; validate with `npm run build` +
  `scripts/size-check.js` in the PR.

### Net effect on scope

v1 = **provide-primary** (fetch fallback) · **counts + status only** (values v1.1) · **single
trigger** to validate (tooltip "Ver detalhes"; header entry is a fast follow if measured) ·
**no in-modal drill-down** (status count → existing filtered grid) · gated behind the
**`classifyGcdrDevices` extraction**. Promise reframed to **customer health & coverage**.
```
