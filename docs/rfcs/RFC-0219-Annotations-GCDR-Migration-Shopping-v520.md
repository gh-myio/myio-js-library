- Feature Name: `annotations_gcdr_migration_shopping_v520`
- Start Date: 2026-07-09
- RFC PR: (to be filled)
- Status: **PROPOSED — awaiting approval**
- Depends on: RFC-0218 (`GcdrAnnotationsClient`) published in `myio-js-library`
- Companion RFCs: RFC-0220 (v-5.4.0), RFC-0221 (head office UNIQUE)

# RFC-0219 — Migrate shopping dashboard v-5.2.0 (production) annotations from TB `log_annotations` to GCDR

## Summary
[summary]: #summary

Replace, in the **production** shopping dashboard (`src/thingsboard/main-dashboard-shopping/v-5.2.0`, orchestrated by `WIDGET/MAIN_VIEW/controller.js`), every read of the ThingsBoard SERVER_SCOPE attribute `log_annotations` with **one paginated GCDR call per customer** (`GcdrAnnotationsClient.listByCustomer`, RFC-0218), enriching the panel items in memory. Writers (`AnnotationsTab`, `AlarmAnnotations`) switch to GCDR mutations. The `AnnotationServiceOrchestrator` public API (`getAll`, `getTotalCount`, indices, events) stays **unchanged** — only its data source swaps — so the TELEMETRY widget and card badges migrate mostly for free.

## Motivation
[motivation]: #motivation

The v-5.2.0 dashboard reaches annotations through the widest surface of all three targets (call-site inventory, 2026-07-09):

| # | Call site | Today | Cost |
|---|---|---|---|
| 1 | MAIN_VIEW `_initAnnotationServiceOrchestrator` (`controller.js:3130`) → lib `buildAnnotationServiceOrchestrator` → `CustomerDeviceService.fetchAttributesBatch` | `GET …/DEVICE/{id}/values/attributes/SERVER_SCOPE?keys=log_annotations,identifier` **per device** (chunks of 5) | ~1 call × device (hundreds) |
| 2 | MAIN_VIEW dataKey ingestion (`:5996` `keyName === 'log_annotations'` → `meta.log_annotations`; `:5838` emitted on item) | attribute rides the TB datasource | free but duplicates #1 |
| 3 | TELEMETRY badges/filter (`:818 _itemHasActiveAnnotation`, `:993 addAnnotationIndicator`, `:2197` filter fallback, item mappers `:2802/:6267/:6414`, render guard `:3508`) | consume `item.log_annotations` from #2, fallback when orchestrator absent | none (downstream) |
| 4 | SettingsModal → `AnnotationsTab.loadAnnotations` (`AnnotationsTab.ts:3710`) | per-device GET on modal open | 1 × open |
| 5 | `AnnotationIndicator.loadAnnotations` (`AnnotationIndicator.ts:518`) | per-device GET | 1 × card |
| 6 | `AlarmAnnotations.loadAlarmAnnotationsFromDevice` (`AlarmAnnotations.ts:111`) | per-device GET (alarmGroups, schema 1.1.0) | 1 × alarm |
| W1 | `AnnotationsTab.saveAnnotations` (`:3882`) | POST attr SERVER_SCOPE (full-array overwrite, schema 1.0.0) | write |
| W2 | `AlarmAnnotations._persistToDevice` (`:49`) | read-modify-write of the same attr (schema 1.1.0) | write |

Problems: N+1 fan-out, two writers with **different schemas racing on one attribute**, no audit, no optimistic locking, and duplicated parsing in every consumer. GCDR RFC-0036 fixes all of it server-side; this RFC plugs the dashboard in.

## Guide-level explanation
[guide-level-explanation]: #guide-level-explanation

After the migration:

1. MAIN_VIEW builds the orchestrator with `source: 'gcdr'` — internally it makes **one** `listByCustomer(gcdrCustomerId, { includeArchived: false })` (client from RFC-0218, auth = customer `gcdrApiKey` attr, `domainPath` from widget settings with sane prod default) and indexes by **`gcdrDeviceId`** (the annotations' `entityId` is the GCDR device UUID; TB items already carry `gcdrDeviceId` via the RFC-0183 chain).
2. MAIN_VIEW **enriches items** (`meta.log_annotations`) from the orchestrator instead of the TB dataKey — TELEMETRY badges, filters and mappers keep reading `item.log_annotations` untouched (legacy shape via the RFC-0218 adapter).
3. AnnotationsTab reads `client.listByEntity('device', gcdrDeviceId)` and writes `client.create/patch/respond/archive` (409 → reload + toast).
4. AlarmAnnotations models alarm notes as annotations with `type: 'pending'` and a mention/tag convention instead of the nested `alarmGroups` map.
5. The event bus stays: writers still dispatch `myio:annotation-changed`; the orchestrator still refreshes and re-emits `myio:annotations-refreshed`.

Rollout is **read-first**: phase A reads from GCDR with TB-attribute fallback behind a widget setting; phase B moves the writers; phase C removes the dataKey and the TB fallback.

## Reference-level explanation
[reference-level-explanation]: #reference-level-explanation

### Library changes (shared with RFC-0220/0221)

1. **`buildAnnotationServiceOrchestrator` gains a source strategy** (`AnnotationServiceOrchestrator.ts`):
   ```typescript
   interface BuildAnnotationServiceOrchestratorParams {
     // existing: customerId (TB), tbHost, jwt, logger, cacheTtlMs
     source?: 'tb' | 'gcdr';           // default 'tb' until GA
     gcdr?: { domainPath: string; auth: { apiKey?: string; bearerToken?: string | (() => Promise<string>) };
              gcdrCustomerId: string };
   }
   ```
   `_fetchAndIndex` branches: `'gcdr'` → `client.listByCustomer` → `adaptGcdrToLegacyAnnotation` → same 3 indices. `byDeviceId` becomes **keyed by gcdrDeviceId**; a fourth map `tbDeviceId → gcdrDeviceId` is built from the devices list so `getByDevice(tbId)` keeps working (accepts either id).
2. **`AnnotationsTab`** accepts `gcdrClient` (or the params to build one); `loadAnnotations`/`saveAnnotations` branch on it. 409 on save → reload annotation, show `MyIOToast.error('Anotação alterada por outro usuário — recarregada')`.
3. **`AnnotationIndicator`** accepts pre-fetched annotations (already supported via `updateWithAnnotations`) — MAIN_VIEW feeds it from the orchestrator; its self-fetch becomes the fallback.
4. **`AlarmAnnotations`** re-implemented over the client (create/respond/archive); the `alarmGroups` schema is retired (see Unresolved Q2).

### Widget changes (this repo, v-5.2.0)

| File | Change |
|---|---|
| `WIDGET/MAIN_VIEW/controller.js:3130` | `_initAnnotationServiceOrchestrator` passes `source`, `gcdr: { domainPath: settings.gcdrAnnotationsBaseUrl \|\| 'https://gcdr-api.a.myio-bas.com/api/v1', auth: { apiKey: attrs.gcdrApiKey }, gcdrCustomerId: attrs.gcdrCustomerId }` |
| `WIDGET/MAIN_VIEW/controller.js:5996/5838` | keep ingesting the dataKey during phase A (fallback); phase C: delete the `log_annotations` branch and the datasource key |
| MAIN_VIEW item build | new `enrichItemsWithAnnotations(items)` — after `myio:annotations-ready/-refreshed`, set `item.log_annotations = orchestrator.getByDevice(item.id)` (legacy shape) and re-dispatch to TELEMETRY |
| `WIDGET/TELEMETRY/controller.js` | **no logic change** — `_itemHasActiveAnnotation` (`:818`), `addAnnotationIndicator` (`:993`), filter (`:2197`), mappers (`:2802/:6267/:6414`) keep consuming `item.log_annotations`; only comment updates. Orchestrator-first filter path (`:2190`) already preferred |
| `MAIN_VIEW` LIB_SYMBOLS bridge | add `createGcdrAnnotationsClient` (children read lib symbols via `window.MyIOUtils` — PR #97 pattern) |
| `settingsSchema.json` (MAIN_VIEW) | new settings: `gcdrAnnotationsBaseUrl` (string, default prod `/api/v1`), `annotationsSource` (`tb`\|`gcdr`, default `tb` in phase A, flipped in GA) |

### Data prerequisites

- Customers: `gcdrCustomerId` + `gcdrApiKey` SERVER_SCOPE attrs (already provisioned for alarms/goals).
- Devices: `gcdrDeviceId` attr populated (RFC-0183 chain) — **hard dependency**: items without it can't be matched to GCDR annotations (surface as orchestrator warn + count in `myio:annotations-ready` detail).
- Historical data migrated TB → GCDR (GCDR RFC-0036 importer; RFC-0216 SQL dump as seed/conference).

### Rollout & validation

| Phase | Gate | Validation |
|---|---|---|
| A — read GCDR, fallback TB | `annotationsSource: 'gcdr'` per customer | badge counts equal TB counts (RFC-0216 dump as oracle); filter "com anotação" returns same devices |
| B — writes to GCDR | same flag | create/edit/approve/reject/archive round-trip in SettingsModal; 409 path; alarm notes |
| C — remove TB path | lib minor release | dataKey removed; attribute frozen read-only for rollback window, then retired |

Pilot: Mestre Álvaro (same order as RFC-0216), then the remaining 5 Sá Cavalcante shoppings.

## Drawbacks
[drawbacks]: #drawbacks

- Annotations stop working when GCDR is down (TB attr was "always there"); mitigated by phase-A fallback and the orchestrator's stale-cache-on-error behavior.
- `gcdrDeviceId` coverage gaps silently hide annotations for unmapped devices — must be monitored (count in the ready event).

## Rationale and alternatives
[rationale-and-alternatives]: #rationale-and-alternatives

- **Swap the orchestrator's source instead of rewriting consumers** — chosen: 6 read families collapse into 1 integration point; TELEMETRY (the riskiest, in production) is untouched.
- **Dual-write during transition** — rejected: two sources of truth with different schemas is how we got here; read-first with fallback is safer.
- **Keep per-device GCDR reads (`listByEntity`) everywhere** — rejected: recreates N+1 against a remote API.

## Prior art
[prior-art]: #prior-art

- RFC-0203 (annotations panel/orchestrator), RFC-0104 (annotation schema), RFC-0183 (`gcdrDeviceId` chain), RFC-0216 (SQL dump), GCDR RFC-0036 + `ANNOTATIONS-API-GUIDE.md`.
- PR #97 — `MyIOUtils` LIB_SYMBOLS bridge (how child widgets get new lib symbols).

## Unresolved questions
[unresolved-questions]: #unresolved-questions

1. Where does the **JWT-vs-API-key** line sit in this dashboard? Proposal: orchestrator/batch = customer `gcdrApiKey`; user mutations in AnnotationsTab = also API key in v1 (TB JWT is not a GCDR credential) — confirm actor identity handling (`createdBy` snapshot) for API-key writes.
2. Alarm annotations (`alarmGroups`, schema 1.1.0): model as `type: 'pending'` + device mention, or ask GCDR for an `alarmType` tag/field?
3. Retention of the TB attribute after phase C: freeze read-only for how long?

## Future possibilities
[future-possibilities]: #future-possibilities

- Mentions (`@user`) and attachments in the SettingsModal UI — the API already supports both.
- Server-side counts (`getTotalCount` via a stats endpoint) instead of client-side reduce.
