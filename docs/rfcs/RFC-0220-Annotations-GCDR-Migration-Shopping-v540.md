- Feature Name: `annotations_gcdr_migration_shopping_v540`
- Start Date: 2026-07-09
- RFC PR: (to be filled)
- Status: **PROPOSED — awaiting approval**
- Depends on: RFC-0218 (`GcdrAnnotationsClient`), library changes described in RFC-0219 §Library changes
- Companion RFCs: RFC-0219 (v-5.2.0 production), RFC-0221 (head office UNIQUE)

# RFC-0220 — Migrate shopping dashboard v-5.4.0 (upcoming release) annotations to GCDR

## Summary
[summary]: #summary

The v-5.4.0 single-controller dashboard (`src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js`) consumes annotations **exclusively through the library** — it contains **zero** direct `log_annotations` reads. Migrating it is therefore a thin slice: pass the GCDR source params to `buildAnnotationServiceOrchestrator`, add the two widget settings, and enrich the grid items so the `telemetry-grid-shopping` card badges light up from GCDR data. Since v-5.4.0 has not shipped, it should launch **GCDR-first** (no TB fallback phase).

## Motivation
[motivation]: #motivation

Call-site inventory (2026-07-09) for `v-5.4.0/controller.js`:

| Call site | What it does |
|---|---|
| `buildAnnotationOrchestrator(customerTbId)` — `:2333` | `lib.buildAnnotationServiceOrchestrator({...})` (`:2346`), stores `window.AnnotationServiceOrchestrator` (`:2354`) |
| `updateAnnotationBadge()` — `:2362` | header badge = `o.getTotalCount()` (`:2365`) |
| `openAnnotationsPanel()` — `:2371` | `lib.getHeaderAnnotationsPanel()` (RFC-0203 panel) |
| hover wiring `_wireAnnotationHover` — `:2554`; header button `onAnnotationClick` — `:2776`, `showAnnotationButton: true` — `:2767` | UI triggers only |
| event refresh listeners — `:3043-3045` | `myio:annotations-ready / annotations-refreshed / annotation-changed` |
| grid passthrough | `telemetry-grid-shopping` types (`types.ts:76`) + `createTelemetryGridShoppingComponent.ts:85` carry `item.log_annotations` to the v6 card badge renderers |

Everything funnels through the orchestrator — exactly the integration point RFC-0219 converts to GCDR. Shipping v-5.4.0 on the TB attribute only to migrate it later would be wasted motion.

## Guide-level explanation
[guide-level-explanation]: #guide-level-explanation

- `buildAnnotationOrchestrator` passes `source: 'gcdr'` + `gcdr: { domainPath, auth: { apiKey }, gcdrCustomerId }` (values from the customer SERVER_SCOPE attrs and the new widget settings). One paginated `GET /annotations?customerId=…` feeds badge, panel and filters.
- Grid items are enriched post-`myio:annotations-ready`: `item.log_annotations = orchestrator.getByDevice(item.gcdrDeviceId ?? item.id)` in legacy shape, so `TelemetryGridShoppingView`/card-v6 badges work unmodified.
- The header annotations panel (RFC-0203) reads the same orchestrator — no change beyond the source.
- SettingsModal (annotations tab) opened from cards uses the client-backed `AnnotationsTab` (RFC-0219 §Library changes) for reads and writes; 409 handling included.

## Reference-level explanation
[reference-level-explanation]: #reference-level-explanation

### Widget changes (`v-5.4.0/controller.js`)

1. `buildAnnotationOrchestrator` (`:2333`):
   ```javascript
   const orch = await lib.buildAnnotationServiceOrchestrator({
     customerId: customerTbId,
     tbHost: window.location.origin,
     jwt: localStorage.getItem('jwt_token'),
     source: 'gcdr',
     gcdr: {
       domainPath: settings.gcdrAnnotationsBaseUrl || 'https://gcdr-api.a.myio-bas.com/api/v1',
       auth: { apiKey: customerAttrs.gcdrApiKey },
       gcdrCustomerId: customerAttrs.gcdrCustomerId,
     },
   });
   ```
2. New `enrichGridItemsWithAnnotations()` — runs on `myio:annotations-ready` / `myio:annotations-refreshed`: maps orchestrator data onto the grid datasource items (legacy shape) and calls the grid's update path. Items without `gcdrDeviceId` are counted and logged (parity gap metric — RFC-0201 already tracks this attribute as a v-5.4.0 gap).
3. `settingsSchema.json`: add `gcdrAnnotationsBaseUrl` (string, default prod) and `annotationsSource` (`gcdr` default here — GCDR-first).
4. Badge/panel/hover/event code (`:2362-3045`): unchanged.

### Grid component

`telemetry-grid-shopping` stays a passthrough (`types.ts:76`, `createTelemetryGridShoppingComponent.ts:85`). No component change; the controller supplies enriched items.

### Prerequisites & validation

- Same data prerequisites as RFC-0219 (customer `gcdrCustomerId`/`gcdrApiKey`, device `gcdrDeviceId`, historical migration done).
- **RFC-0201 dependency**: v-5.4.0's `extractDeviceMetadataFromRows` does not yet extract `gcdrDeviceId` (known Phase-1 gap). That fix must land first or annotations can't be matched to cards.
- Validation: header badge count == v-5.2.0 badge for the same customer (both on GCDR); card badges match the annotations panel list; create/edit round-trip via SettingsModal.

## Drawbacks
[drawbacks]: #drawbacks

- GCDR-first means v-5.4.0 annotations are only as good as the historical migration for that customer — acceptable because v-5.4.0 ships customer-by-customer anyway.

## Rationale and alternatives
[rationale-and-alternatives]: #rationale-and-alternatives

- **GCDR-first (no TB fallback)** — chosen: no production users yet; carrying the dual-source flag adds test surface with no rollback benefit for an unreleased widget.
- Waiting for RFC-0219 GA first — recommended sequencing but not a hard dependency; both consume the same lib changes.

## Prior art
[prior-art]: #prior-art

RFC-0219 (shares all library changes), RFC-0201 (v-5.4.0 parity plan; `gcdrDeviceId` gap), RFC-0214 (header parity — annotations button), RFC-0203/0104.

## Unresolved questions
[unresolved-questions]: #unresolved-questions

1. Sequencing with RFC-0201 Phase 1 (`gcdrDeviceId` extraction) — same release or prerequisite release?
2. Should v-5.4.0 drop the `log_annotations` grid passthrough field name in favor of a typed `annotations` field, since nothing legacy depends on it here? (Proposal: keep the name for card-renderer reuse, rename later with the v6 cards.)

## Future possibilities
[future-possibilities]: #future-possibilities

- Annotations filter chip in the v-5.4.0 grid toolbar (parity with v-5.2.0's `annotationFilter`).
- Real-time badge updates via GCDR push instead of event-bus refresh.
