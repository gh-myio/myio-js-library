# RFC-0208: AnnotationServiceOrchestrator — Seed from Datasource + Gap-Fetch

- Feature Name: `annotation_orchestrator_seed_gap_fetch`
- Start Date: 2026-06-22
- RFC PR: (leave this empty)
- Tracking Issue: (leave this empty)
- Status: Draft

## Summary

Eliminate the redundant per-device `SERVER_SCOPE` attribute requests issued by
the `AnnotationServiceOrchestrator` at dashboard startup. Today the orchestrator
re-fetches `log_annotations` + `identifier` for **every** device of the
customer, one HTTP request per device — dozens of calls to
`/api/plugins/telemetry/DEVICE/{id}/values/attributes/SERVER_SCOPE?keys=log_annotations,identifier`.

A large fraction of those devices are **already in the widget's `ctx.data`**
(the default Energy view subscribes the energy datasource, whose dataKeys
already include `log_annotations` and `identifier`). This RFC introduces a
**seed + gap-fetch** strategy: the `MAIN_VIEW` controller delegates everything
it already knows to the orchestrator, and the orchestrator only performs REST
fetches for the devices that are **not** present in the datasource (i.e. the
other domains — water, temperature, and any device outside the active
datasource).

This RFC specifies the API and behavior only. No implementation is included.

## Motivation

### Current cost

The `AnnotationServiceOrchestrator` is built once in `MAIN_VIEW` and powers the
HEADER "Annotations" panel (RFC-0203). Its data path is:

1. `CustomerDeviceService.fetchAllCustomerDevices()` — **1** paginated call to
   `/api/customer/{customerId}/deviceInfos` (cheap).
2. `CustomerDeviceService.fetchAttributesBatch(deviceIds, ['log_annotations', 'identifier'])`
   — **1 HTTP request per device**, issued in chunks of `concurrency` (default
   5), with a `chunkDelayMs` (default 50ms) between chunks.

For a customer with N devices, step 2 produces **N requests**. In a typical
shopping mall this is dozens to hundreds of calls fired during dashboard load,
competing with the data-critical telemetry requests for browser connection
slots and TB rate-limit budget.

### The redundancy

The MAIN_VIEW widget's `ctx.data` already carries `log_annotations` and
`identifier` as dataKeys for the devices in the active datasource. They are
already parsed into the per-device metadata:

| Location | What it does |
| --- | --- |
| `MAIN_VIEW/controller.js:5615` | `keyName === 'identifier'` → `meta.identifier` |
| `MAIN_VIEW/controller.js:5628` | `keyName === 'log_annotations'` → `meta.log_annotations` |
| `MAIN_VIEW/controller.js:5470` | `baseItem.log_annotations = meta.log_annotations \|\| null` |

Because the default dashboard view is **Energy**, the energy devices already
have these attributes in memory by the time the panel is opened. The
orchestrator nonetheless re-fetches **all** of them over REST. The only devices
genuinely missing from `ctx.data` are those outside the active datasource —
water, temperature, and anything else not subscribed by the widget.

The user-facing symptom is the burst of `values/attributes/SERVER_SCOPE`
requests visible in the network tab, e.g.:

```
GET https://dashboard.myio-bas.com/api/plugins/telemetry/DEVICE/81068fa0-9011-11f0-a06d-e9509531b1d5/values/attributes/SERVER_SCOPE?keys=log_annotations,identifier
... (one per device) ...
```

### Goal

Let `MAIN_VIEW` **delegate what it already has** to the orchestrator, so the
orchestrator only spends HTTP requests on the gap — the devices it does not
already know about.

## Guide-level explanation

### Seed + gap-fetch model

The orchestrator continues to discover the **full device universe** with the
single cheap `deviceInfos` call (it needs `deviceType` for domain
classification and the complete device list for the "By Domain" tab). What
changes is the expensive step: instead of fetching attributes for every device,
the orchestrator:

1. Asks `MAIN_VIEW` for a **seed** of devices it already knows
   (`deviceId`, `log_annotations`, `identifier`, `deviceType`).
2. Computes the **gap** = devices in the full list whose `deviceId` is **not**
   in the seed.
3. Calls `fetchAttributesBatch` only for the **gap**.
4. Merges seeded annotations (Energy, from `ctx.data`) with fetched annotations
   (the rest).

Request count drops from `N` to `N − seededCount`. With Energy as the default
view, the seeded set is usually the majority of devices, so the bulk of the
requests disappear.

### Why a callback, not a snapshot

The orchestrator is constructed early in `onInit`, but the metadata map is
populated on `onDataUpdated` (which can fire during `onInit` awaits — see the
ThingsBoard lifecycle notes in `CLAUDE.md`). Passing a one-time snapshot at
build time risks seeding from an empty `ctx.data`.

Therefore the seed is provided as a **callback**:

```ts
getSeedDevices?: () => AnnotationSeedDevice[];
```

The orchestrator invokes it lazily inside `_fetchAndIndex`, so:

- The first build reads whatever `MAIN_VIEW` knows at that moment.
- `refresh()` re-reads the seed automatically — newer Energy data (or a
  domain the user has since navigated into) is picked up for free.
- If the callback is absent or returns `[]`, the orchestrator falls back to the
  **current behavior** (fetch attributes for all devices). Fully backward
  compatible.

### Key matching

The seed is keyed by the **TB device UUID** (`deviceId`), which is exactly the
`{id}` used in the `DEVICE/{id}/values/attributes/SERVER_SCOPE` URL. The
MAIN_VIEW metadata map is keyed by `entityId` / `tbId`, the same UUID. The
match is therefore direct and does **not** depend on `gcdrDeviceId` or
`ingestionId`.

## Reference-level explanation

### New public types

```ts
/** A device the caller already has annotation data for (no REST needed). */
export interface AnnotationSeedDevice {
  /** TB device UUID — must equal the deviceInfos id and the SERVER_SCOPE URL id */
  deviceId: string;
  /** Raw value of the SERVER_SCOPE `log_annotations` attribute (string | object | null) */
  log_annotations: unknown;
  /** Raw `identifier` attribute, if known (used for the "By Identifier" tab) */
  identifier?: string | null;
  /** TB device type / profile, if known (used for domain classification) */
  deviceType?: string;
}
```

### Changed type — `BuildAnnotationServiceOrchestratorParams`

`src/services/annotations/types.ts:190`

```ts
export interface BuildAnnotationServiceOrchestratorParams {
  customerId: string;
  tbHost: string;
  jwt: string;
  cacheTtlMs?: number;
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;

  /**
   * Optional. Returns devices the caller already has annotation/identifier
   * data for (e.g. from the widget's ctx.data). Called lazily on each
   * fetch/refresh. Seeded devices are excluded from the per-device
   * SERVER_SCOPE attribute fetch. Absent/empty → fetch all (legacy behavior).
   */
  getSeedDevices?: () => AnnotationSeedDevice[];
}
```

### Changed logic — `AnnotationServiceOrchestrator._fetchAndIndex`

`src/services/annotations/AnnotationServiceOrchestrator.ts:109`

Pseudocode of the new flow (additions marked `+`):

```ts
async function _fetchAndIndex(): Promise<void> {
  const t0 = Date.now();

  const flatDevices = await client.fetchAllCustomerDevices();   // unchanged: 1 call

+ // 1. Read seed from caller (lazy). Index by deviceId.
+ const seedList = params.getSeedDevices?.() ?? [];
+ const seedById = new Map(seedList.map((s) => [s.deviceId, s]));

+ // 2. Gap = devices not covered by the seed.
+ const idsToFetch = flatDevices
+   .map((d) => d.id)
+   .filter((id) => !seedById.has(id));

- const deviceIds = flatDevices.map((d) => d.id);
- const attrs = await client.fetchAttributesBatch(deviceIds, ['log_annotations', 'identifier']);
+ const attrs = await client.fetchAttributesBatch(idsToFetch, ['log_annotations', 'identifier']);

  const annotated = flatDevices.map((d) => {
+   const seed = seedById.get(d.id);
+   // Prefer seed values; fall back to fetched attrs for gap devices.
-   const a = attrs.get(d.id) ?? {};
+   const a = seed
+     ? { log_annotations: seed.log_annotations, identifier: seed.identifier }
+     : (attrs.get(d.id) ?? {});

    const rawAnnotations = a['log_annotations'];
    const identifierRaw = a['identifier'];

    return {
      deviceId: d.id,
      name: d.name,
      label: d.label,
      identifier: typeof identifierRaw === 'string' && identifierRaw.length > 0 ? identifierRaw : null,
+     // deviceType for domain classification: deviceInfos value is authoritative;
+     // seed.deviceType only used if deviceInfos lacks it.
      domain: _classifyDomain(d.deviceType || seed?.deviceType || ''),
      deviceType: d.deviceType,
      annotations: parseLogAnnotations(rawAnnotations, d.id, logger),
    };
  });

  // indexing + state assignment unchanged ...

+ logger.debug(
+   `[AnnotationServiceOrchestrator] seed=${seedById.size}, gap-fetched=${idsToFetch.length}, ` +
+   `total=${annotated.length} devices, ${durationMs}ms`
+ );
}
```

Notes:

- `fetchAllCustomerDevices()` is intentionally **kept**. It is a single cheap
  paginated call and remains the authoritative source for the full device list
  and `deviceType`. The optimization targets only the per-device attribute
  fan-out.
- The `deviceInfos` `deviceType` stays authoritative for classification; the
  seed `deviceType` is only a fallback.
- For gap devices with no `log_annotations` attribute, `parseLogAnnotations`
  already returns `[]` — unchanged behavior.

### MAIN_VIEW wiring

`MAIN_VIEW/controller.js:2791` (`_initAnnotationServiceOrchestrator`)

Pass a `getSeedDevices` callback that reads the controller's current,
already-loaded device metadata. The callback walks the in-memory items
(`STATE.itemsBase` and/or the orchestrator metadata maps) and emits one
`AnnotationSeedDevice` per device that has a usable `log_annotations` value:

```js
const orchestrator = await buildFn({
  customerId: customerTB_ID,
  tbHost,
  jwt,
  logger: LogHelper,
  getSeedDevices: () => {
    const out = [];
    const seen = new Set();
    const items = (window.STATE && window.STATE.itemsBase) || [];
    for (const it of items) {
      const id = it.tbId || it.entityId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      // Only seed devices we actually have annotation data for; gap-fetch the rest.
      if (it.log_annotations == null) continue;
      out.push({
        deviceId: id,
        log_annotations: it.log_annotations,
        identifier: it.identifier ?? null,
        deviceType: it.deviceProfile || it.deviceType || '',
      });
    }
    return out;
  },
});
```

> The exact seed source (`STATE.itemsBase` vs the MAIN orchestrator metadata
> map vs a cross-domain accumulator) is an implementation detail to settle
> during build. The contract is only: **return every device for which
> `log_annotations` is already known, keyed by TB device UUID.**

### Backward compatibility

- `getSeedDevices` is optional. Callers that do not pass it (e.g. v-5.4.0,
  showcases, tests) keep the existing fetch-all behavior byte-for-byte.
- No change to the returned orchestrator shape, the public query/count methods,
  or the `myio:annotation-changed` / `myio:annotations-refreshed` events.

## Drawbacks

- **Seed staleness.** If `ctx.data`'s `log_annotations` lags behind a write
  performed elsewhere, the seeded value could be momentarily older than a REST
  read would be. Mitigated by RFC-0203's existing `myio:annotation-changed` →
  `refresh()` loop, which re-reads the (then-updated) seed.
- **Coupling.** The orchestrator gains an optional dependency on a caller
  callback. Kept loose by making it optional and side-effect free.
- **Partial-attribute risk.** A device present in `ctx.data` but with a stale
  `identifier` would seed that stale identifier. In practice `identifier` is
  static; acceptable.

## Rationale and alternatives

- **Alternative A — Expand the widget datasource to all domains.** Add water +
  temperature datasources (with `log_annotations` dataKeys) so nothing needs
  REST. Rejected: bloats the widget subscription, increases the always-on
  telemetry payload, and couples the panel to datasource configuration. The
  gap-fetch only pays for domains the user may never open.
- **Alternative B — Snapshot seed at build time.** Simpler signature
  (`seedDevices: AnnotationSeedDevice[]`) but fragile against the
  `onInit`/`onDataUpdated` race and does not benefit `refresh()`. Rejected in
  favor of the callback.
- **Alternative C — Increase `concurrency` / batch the attribute endpoint.**
  Treats the symptom (slow fan-out) not the cause (redundant fetches). Can be
  combined later but does not eliminate the redundant calls.
- **Do nothing.** Leaves dozens of redundant requests on every dashboard load.

## Prior art

- **RFC-0203** — `HeaderAnnotationsButton`: introduced the
  `AnnotationServiceOrchestrator`, `CustomerDeviceService`, and the HEADER
  panel this RFC optimizes.
- **RFC-0126** — `MenuShoppingFilterSync`: module-level caching pattern for the
  same `onInit`/`onDataUpdated` timing class this RFC's callback addresses.
- **RFC-0183** — `AlarmServiceOrchestrator`: precedent for a MAIN-built
  orchestrator that maps device-scoped attributes; analogous delegation model.

## Unresolved questions

- **Seed source of truth.** Confirm whether `ctx.data` in MAIN_VIEW carries
  only the Energy datasource by default, or already includes water/temperature.
  This determines how large the seeded set is and therefore the realized
  savings.
- **Cross-domain accumulation.** Should the seed grow as the user navigates
  into other domains (so a later `refresh()` shrinks the gap further), or stay
  fixed to whatever is loaded at first build?
- **Metrics.** Add a one-time `logger.debug` line (seed size, gap size, total)
  to quantify savings in production logs. Already sketched in the pseudocode.

## Future possibilities

- Apply the same seed + gap-fetch pattern to other MAIN-built orchestrators
  that re-read SERVER_SCOPE attributes already present in `ctx.data` (e.g.
  tickets, GCDR mapping fields).
- A shared `seedFromState(keys)` helper in the widget that produces seeds for
  any attribute-backed orchestrator from `STATE.itemsBase`.
