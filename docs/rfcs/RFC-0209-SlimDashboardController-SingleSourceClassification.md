# RFC-0209 — Slim the Dashboard Controller: single-source classification/aggregation in the lib

- **RFC**: 0209
- **Title**: Slim the v-5.4.0 dashboard controller by moving pure classification/aggregation logic into the library (single source), keeping all I/O and credentials in the controller
- **Status**: Proposed (2026-06-24)
- **Author**: Rodrigo Lago
- **Decided in**: BMAD roundtable — 🏗️ Winston (Architect), 💻 Amelia (Dev), 📋 John (PM)
- **Target**:
  - `src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js`
  - `src/utils/thingsboard/` (new pure helpers)
  - `src/types/` (shared `DeviceMeta` type)
- **Related**:
  - RFC-0207 — Customer-scoped device classification profile (engine/tree, `resolveGroup`).
  - RFC-0047 (GCDR) — Generic Entity Registry; the `/entities` classification tree consumed by `parseClassificationEntities`.
  - RFC-0201 — MainDashboardShopping v-5.4.0 sync from v-5.2.0.
  - RFC-0126 — `window.MyIOUtils` bridge (children read lib symbols).

---

## Summary

The v-5.4.0 dashboard controller was rewritten to be **100% domain-agnostic**: it loads a
classification tree from the GCDR `/entities` endpoint, parses it with the library adapter
`parseClassificationEntities()` → `{ domains[], profileIndex }`, and generates dashboard
sections + grids dynamically (no hard-coded `energy/water/temperature`). What remains in the
controller is a mix of **pure data logic** and **runtime I/O**. Three pure-ish functions —
`extractDeviceMetadataFromRows`, `classifyAllDevices`, `buildByStatusFromDevices` — are
duplicated (with drift risk) across v-5.2.0, v-5.4.0 and the SIM controllers.

This RFC moves those three functions into the library as **pure, dependency-injected,
test-covered** functions, establishing a **single source of truth** for device
classification and status aggregation. It also defines the lib×controller **seam** so the
controller stays thin going forward. **Fetches and credentials never leave the controller.**
**There are no fallbacks**: a missing config or a failed load surfaces as
`MyIOToast.error` (which itself falls back to `window.alert`); the library returns typed
results/errors and never touches UI.

The goal is **not** smaller LOC — it is *one* deterministic, Vitest-covered implementation
shared by every widget version, so a status/metadata rule can never silently diverge and
corrupt a customer KPI.

---

## Motivation

- **Drift = silent data bugs.** v-5.2.0, v-5.4.0 and SIM each carry their own copy of the
  row→device extraction, classification and status aggregation. When a rule diverges (e.g.
  the connection-status thresholds, or the inactivity window), a dashboard shows a wrong KPI
  with no error. Moving *pure* logic to one tested place turns divergence into an
  impossibility.
- **The agnostic rewrite already pushed the structural knowledge into the lib** (the
  classification tree + `profileIndex` from `parseClassificationEntities`). The remaining
  controller functions are the last big chunk of reusable logic still living in widget code.
- **Testability.** Pure functions with injected dependencies are unit-testable in Vitest
  without a ThingsBoard runtime; controller code is not.

### Non-goals

- Moving `fetch`/credentials into the library (see Constraints).
- Re-architecting the TB widget lifecycle, event ordering, DOM generation, theme, or
  component creation — these are runtime-coupled and legitimately differ between versions.
- Adopting the moved functions in v-5.2.0 (production) within this RFC — that is a later,
  separately-validated phase.

---

## Constraints (hard, non-negotiable)

1. **Fetches stay in the controller.** Every network call carries a JWT / `X-API-Key`.
   Credentials must never cross the module boundary into the library. The library MAY expose
   a **credential-free request builder** (e.g. `buildClassificationRequest({ baseUrl,
   customerId }) → { url, method }`); the controller injects headers and performs the
   `fetch`. **No library function signature may contain an auth field.** Code review rejects
   any helper that accepts a token.
2. **No fallbacks.** Missing config or a failed load → `MyIOToast.error` (→ `window.alert`).
   The library never invents a default domain/value and never touches a toast. It returns a
   typed result (including an `unknown[]` bucket for unroutable devices) or throws a typed
   error; the **controller** decides the UI effect.
3. **No hard-coded domain words in the controller/template** (already enforced by the
   agnostic rewrite — preserved here).

---

## Guide-level explanation

### The seam

> **Library = data in, data out** (pure, deterministic, dependency-injected).
> **Controller = credentials in, side effects out** (fetch, lifecycle, DOM, toast).

Anything that does not touch JWT, `window`, DOM or `fetch` belongs in the library. The
controller asks the library for a *finished* result and renders it; it does not assemble
domain objects field-by-field.

### What moves to the library

| Function | New home | Responsibility |
|---|---|---|
| `buildByStatusFromDevices` | `src/utils/thingsboard/` | aggregate status counts (purest; moves first) |
| `extractDeviceMetadataFromRows` | `src/utils/thingsboard/` | TB rows → `DeviceMeta` (atom) |
| `classifyAllDevices` | `src/utils/thingsboard/` | group rows by entity → route by `profileIndex` |

`classifyAllDevices` **composes** `extractDeviceMetadataFromRows` (one extraction path, no
duplication). `extractDeviceMetadataFromRows` internally calls the lib's
`getDomainFromDeviceType` and `calculateDeviceStatusMasterRules` (injectable).

### What stays in the controller

- All `fetch` calls (`fetchClassificationTree`, credentials, user info) — credential-bound.
- TB lifecycle (`onInit`, `onDataUpdated`, `onDestroy`).
- DOM generation, component creation, theme/background.
- Translating the library's typed error / `unknown[]` into `MyIOToast.error`.

---

## Reference-level explanation

### Library signatures (pure, no DOM, no fetch, DI)

```ts
// src/types/device.ts (shared, single shape consumed by every version)
export interface DeviceMeta {
  id: string;
  entityId: string;
  name: string;
  label: string;
  labelOrName: string;
  deviceType: string;
  deviceProfile: string;
  identifier: string;
  value: number | null;        // domain primary value (consumption | pulses | …)
  consumption: number | null;
  connectionStatus: string;
  deviceStatus: string;
  domain: string;
  // raw domain-specific telemetry fields are set via computed key (no domain-word literals)
  [k: string]: unknown;
}

export interface ByStatusCounts {
  online: number; offline: number; waiting: number;
  alert: number; failure: number; weakConnection: number;
  standby: number; noConsumption: number;
}

// 1) purest — moves first (Phase 1)
export function buildByStatusFromDevices(
  devices: DeviceMeta[],
  opts?: { statusSets?: Partial<Record<keyof ByStatusCounts, string[]>> },
): ByStatusCounts;

// 2) atom — TB rows for ONE entity → DeviceMeta
export function extractDeviceMetadataFromRows(
  rows: unknown[],
  deps: {
    catalog: Record<string, { valueField?: string }>; // = exportMapDomain() output
    getDomain?: (deviceType: string) => string;        // default: lib getDomainFromDeviceType
    calcStatus?: (args: {                               // default: lib calculateDeviceStatusMasterRules
      connectionStatus: string; telemetryTimestamp: number | null;
      delayMins: number; domain: string; nowMs?: number;
    }) => string;
    nowMs?: number;                                     // injected clock → deterministic tests
    delayMins?: number;
  },
): DeviceMeta | null;

// 3) composition — all rows → routed devices
export function classifyAllDevices(
  data: unknown[],
  deps: {
    profileIndex: Record<string, { domain: string; column: string }>; // REQUIRED, no default
    catalog: Record<string, { valueField?: string }>;
    getDomain?: (deviceType: string) => string;
    calcStatus?: (args: never) => string;
    nowMs?: number;
  },
): {
  byDomainColumn: Record<string, Record<string, DeviceMeta[]>>;
  unknown: DeviceMeta[];   // devices whose deviceProfile is not in profileIndex
};
```

Seam rules baked into the signatures:

- **`profileIndex` is a required parameter, never a global.** `classifyAllDevices` must not
  read `window.MyIOOrchestrator`/`_classificationTree`. This keeps it pure and reusable in
  the SIM.
- **Dependencies are injected with lib defaults** (`getDomain`/`calcStatus`/`nowMs`) so tests
  can stub them and prove the function does not "know" any domain.
- **Value extraction order is fixed**: resolve `domain` → read `catalog[domain].valueField`
  → read the row by that (computed) key. Inverting this order is the classic regression.
- **Unroutable devices go to `unknown[]`**, never dropped silently and never coerced to an
  "Outros" bucket (no fallback). The controller decides what to do (typically: log + a single
  `MyIOToast.error` if `unknown.length` is unexpectedly high).
- **Clock is injected** (`nowMs`): `calculateDeviceStatusMasterRules` uses time for
  inactivity → without an injected clock there is no deterministic test.

### Controller after the move (illustrative)

```js
const tree = _classificationTree;                  // from fetchClassificationTree (controller-owned fetch)
const { byDomainColumn, unknown } = window.MyIOLibrary.classifyAllDevices(data, {
  profileIndex: tree.profileIndex,
  catalog: window.MyIOLibrary.exportMapDomain(),
});
if (unknown.length) toastError(`[v5.4.0] ${unknown.length} dispositivos sem perfil mapeado.`);
// render byDomainColumn into the generated grids; aggregate via buildByStatusFromDevices
```

### Optional further slimming (documented direction, not in the core scope)

Per Winston, the largest remaining win after the three functions is separating the **layout
model** from rendering:

```ts
buildDashboardLayoutModel(domains, byDomainColumn): LayoutModel   // pure, lib
renderLayout(model)                                               // DOM, controller
```

This is listed under *Future possibilities*, not the actionable scope of this RFC.

---

## Drawbacks

- **Behavior-change risk during the move.** If the moved functions don't byte-for-byte
  reproduce the current output, grids/KPIs regress silently. Mitigated by the golden /
  characterization tests (below) written *before* the move.
- **Shape coupling.** The lib must accept the raw ThingsBoard row shape (`data`,
  `row.dataKeys`, `entityId`). v1 accepts "TB-rows in" explicitly and documents it; a neutral
  normalizer is deferred.
- **Two more public lib symbols** to maintain + register in the `LIB_SYMBOLS` bridge
  (RFC-0126) and the UMD budget.

---

## Rationale and alternatives

- **Keep copies per version (status quo)** — rejected: that *is* the drift bug we are paying
  for.
- **Move everything (whole-controller slim)** — rejected as one RFC: lifecycle/DOM/theme are
  runtime-coupled and legitimately diverge; bundling them defeats incremental homolog
  validation. "Single source for classification/aggregation" is the real goal; "slim" is a
  side effect.
- **Let the lib do the fetch** — rejected by constraint: credentials must not leave the
  widget. A credential-free request builder is the most the lib may offer.

---

## Prior art

- `parseClassificationEntities` (RFC-0047 adapter) already established the
  "lib parses data, controller fetches" pattern.
- `buildListItemsThingsboardByUniqueDatasource` (already in the lib) does the partial
  rows→`{id,identifier,label}` extraction; `extractDeviceMetadataFromRows` is the fuller
  sibling.
- RFC-0202 / RFC-0200 — single-source consolidation precedents (`deviceTypeConfig`,
  `deviceIcons`).

---

## Success metrics

1. The three functions exist in **one** place, with Vitest covering every status bucket
   (online/offline/waiting/weak/alert/failure/standby/noConsumption) and the metadata mapping.
2. **Zero behavioral divergence** — a golden test feeds real homolog rows and asserts the same
   output before/after the move.
3. v-5.4.0 consumes the lib functions with **no fallback**; missing config → `MyIOToast.error`,
   proven by a test.

LOC of the controller is a secondary, cosmetic indicator — reported, not used to govern.

---

## Phasing (each phase shippable + validated in homolog)

| Phase | Scope | Gate |
|---|---|---|
| **1** | Move `buildByStatusFromDevices` (purest, smallest blast radius) → lib + tests; adopt in v-5.4.0 | homolog green + golden equal |
| **2** | Move `classifyAllDevices` + `extractDeviceMetadataFromRows` → lib (DI, `unknown[]`, typed errors). **Fix the known `1440*60` inactivity-window bug in the extraction as part of this move, with a regression test that locks it.** Adopt in v-5.4.0 | homolog green + golden equal |
| **3** (separate, post-homolog) | Adopt the lib functions in v-5.2.0 (production) and SIM; retire the per-version copies | Phases 1–2 stable in homolog first |

A phase does not advance without a green homolog + an identical golden test.

---

## Unresolved questions

1. **Absent-value semantics**: today, does a missing telemetry value become `0` or `null`?
   The move must reproduce this exactly (highest silent-regression risk for the grids). To be
   pinned from the current controller before Phase 2.
2. **`unknown[]` UX threshold**: at what count does the controller raise a `MyIOToast.error`
   (every unmapped device, or only above N)? Product decision.
3. **`statusSets` source**: keep the online/offline/waiting synonym lists in code, or source
   them from a lib status taxonomy (consolidatable with RFC-0200-style maps)?

---

## Future possibilities

- `buildDashboardLayoutModel` / `renderLayout` split (pure layout vs DOM) — the next slimming
  step after this RFC.
- A neutral device shape + a thin TB normalizer, so the lib functions stop knowing the raw TB
  row format.
- Consolidating the status taxonomy and the domain catalog (`exportMapDomain`) so every
  consumer derives labels/units/status from one place.
