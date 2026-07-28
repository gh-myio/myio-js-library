- Feature Name: `gcdr_annotations_client`
- Start Date: 2026-07-09
- RFC PR: (to be filled)
- Status: **PROPOSED — awaiting approval**
- Companion RFCs: RFC-0219 (shopping v-5.2.0), RFC-0220 (shopping v-5.4.0), RFC-0221 (head office UNIQUE)
- External spec: `gcdr.git/docs/api/ANNOTATIONS-API-GUIDE.md` (GCDR RFC-0036), `docs/openapi.yaml` tag **Annotations**

# RFC-0218 — GcdrAnnotationsClient: library component that fetches annotations from the GCDR API

## Summary
[summary]: #summary

A new exported library component — `createGcdrAnnotationsClient` at `src/components/gcdr-annotations/v1.0.0/` — that talks to the GCDR **Annotations API** (`/annotations`). The caller supplies the **auth credential** (JWT Bearer token *or* Customer API Key) and the **domain path already including the API version** (e.g. `https://gcdr-api.a.myio-bas.com/api/v1`, `http://localhost:3015/api/v1`); the relative routes live inside the component. It is the single data-access layer that RFC-0219/0220/0221 use to replace the N-per-device ThingsBoard `log_annotations` SERVER_SCOPE reads with **one paginated GCDR call per customer**.

## Motivation
[motivation]: #motivation

Annotations moved to the GCDR as their own aggregate (GCDR RFC-0036). Today the library reaches annotations through the TB attribute `log_annotations` via three independent code families (batch orchestrator, per-device readers, widget dataKey ingestion) and two writers — all of which fan out **one TB REST call per device** (observed 11–28 s per customer in the head-office welcome enrichment). The GCDR API offers `GET /annotations?customerId=…` — one paginated request returns every annotation of a customer, already filtered, versioned and audited. The library needs one well-designed client so the three widget surfaces don't each reinvent fetch/auth/pagination/parsing.

## Guide-level explanation
[guide-level-explanation]: #guide-level-explanation

```typescript
import { createGcdrAnnotationsClient } from 'myio-js-library';

const client = createGcdrAnnotationsClient({
  domainPath: 'https://gcdr-api.a.myio-bas.com/api/v1',  // version INCLUDED by the caller
  auth: { apiKey: attrs.gcdrApiKey },                     // or { bearerToken: jwt } or { bearerToken: async () => token }
});

// The migration call: everything of a customer in one paginated sweep
const all = await client.listByCustomer(gcdrCustomerId, { includeArchived: true });

// Focused reads
const ofDevice = await client.listByEntity('device', gcdrDeviceId);
const detail   = await client.getById(annotationId);      // responses + events + mentions + attachments

// Writes (replace the two TB attribute writers)
const created = await client.create({ entityType: 'device', entityId, customerId, text, type, importance });
await client.patch(created.id, { importance: 5 }, created.version);   // optimistic lock via If-Match
await client.respond(created.id, { type: 'approved' });
await client.archive(created.id, currentVersion);

// Legacy bridge — same shape the widgets/badges already consume (RFC-0104 Annotation[])
const legacy = client.toLegacyAnnotations(all);
```

Key behaviors:

- **Auth is a strategy, not an if-chain**: `{ apiKey }` → `X-API-Key` header (M2M, hierarchy-scoped); `{ bearerToken }` → `Authorization: Bearer` (users/frontends). `bearerToken` may be a string or an async provider (integrates with `buildMyioIngestionAuth`-style token caches).
- **`domainPath` is opaque**: the component never assembles versions or hosts — prod, homolog, localhost and future `/api/v2` are the caller's choice. Only trailing slashes are normalized.
- **Pagination is internal**: `listByCustomer`/`listByEntity` loop `page`/`limit` until the `pagination` envelope ends (hard cap, default 50 pages) and return the full array.
- **Tolerant parser**: unknown fields ignored (per the API guide), `{success, data}` envelope unwrapped like `AlarmApiClient` does.
- **Errors are typed**: `GcdrAnnotationsError { status, code, message }`; `409` is surfaced as `ConflictError` with the guidance flag `finalizedOrStale` — callers must re-read, never blind-retry (API guide §5).

## Reference-level explanation
[reference-level-explanation]: #reference-level-explanation

### File layout & exports

```
src/components/gcdr-annotations/
└── v1.0.0/
    ├── GcdrAnnotationsClient.ts   # class + factory
    ├── authStrategies.ts          # ApiKeyAuth | BearerAuth (Strategy)
    ├── adapters.ts                # GCDR ⇄ legacy RFC-0104 Annotation (Adapter)
    ├── types.ts                   # GcdrAnnotation, GcdrAnnotationDetail, params, errors
    └── index.ts
```

`src/index.ts` exports: `createGcdrAnnotationsClient`, `GcdrAnnotationsClient`, `adaptGcdrToLegacyAnnotation`, and the types.

### Design patterns (explicit)

| Pattern | Where | Why |
|---|---|---|
| **Factory** | `createGcdrAnnotationsClient(params)` | house style (`createCustomerGoalsCard`, `createHeaderComponent`); hides class wiring |
| **Strategy** | `authStrategies.ts` — `AuthStrategy { apply(headers): void }` with `ApiKeyAuth` / `BearerAuth` | JWT × API Key decided once at construction; request code stays auth-agnostic; async token providers supported |
| **Adapter** | `adapters.ts` — `adaptGcdrToLegacyAnnotation`, `adaptLegacyToGcdrInput` | downstream consumers (orchestrator indices, card badges, AnnotationsTab) keep the RFC-0104 `Annotation` shape; nothing above the client changes shape during migration |
| **Repository** | the client's public surface (`listByCustomer/listByEntity/getById/create/patch/archive/respond/mention/attach/detach`) | one place that knows routes, envelopes and pagination — mirrors `AlarmApiClient`, the existing GCDR client template |
| **Retry with backoff** | private `_requestJson` | same policy as `CustomerDeviceService._requestJson` (max 3, exponential, only 429/5xx/network); 4xx (incl. 409) never retried |
| **TTL cache (optional)** | `cacheTtlMs` param; keyed by method+URL, GET-only, `invalidate()` on any write | orchestrators refresh on `myio:annotation-changed`; cache prevents thundering re-fetches |

### Constructor params

```typescript
export interface GcdrAnnotationsClientParams {
  /** Base URL WITH version, e.g. "https://gcdr-api.a.myio-bas.com/api/v1" or "http://localhost:3015/api/v1" */
  domainPath: string;
  auth: {
    /** JWT for user-context calls */
    bearerToken?: string | (() => Promise<string> | string);
    /** Customer API Key (gcdr_cust_…) for M2M; hierarchyAccess scoping applies */
    apiKey?: string;
  };
  /** Optional GET cache (ms). 0/undefined = disabled */
  cacheTtlMs?: number;
  /** Injectable for tests; default globalThis.fetch */
  fetchImpl?: typeof fetch;
  logger?: { log: Function; warn: Function; error: Function };
}
```

Validation: exactly one of `apiKey` / `bearerToken` is required (both → error, prefer explicitness over precedence rules).

### Routes (internal constants)

| Method | Route | Client method |
|---|---|---|
| GET | `/annotations?customerId&entityType&entityId&type&status&importance&includeArchived&page&limit` | `listByCustomer`, `listByEntity`, `list(filters)` |
| GET | `/annotations/:id` | `getById` (returns `GcdrAnnotationDetail`) |
| POST | `/annotations` | `create` |
| PATCH | `/annotations/:id` (+`If-Match`) | `patch` |
| POST | `/annotations/:id/archive` | `archive` |
| POST | `/annotations/:id/responses` | `respond` (`comment` \| `approved` \| `rejected` \| `archived`; `text` required except `approved`) |
| POST | `/annotations/:id/mentions` | `mention` |
| POST/DELETE | `/annotations/:id/attachments[/:attId]` | `attach` / `detach` |

### Legacy adapter (RFC-0104 bridge)

| GCDR field | Legacy `Annotation` field | Notes |
|---|---|---|
| `id`, `version`, `text`, `importance`, `createdAt` | same | direct |
| `type`: `observation·pending·maintenance·activity` | `observation·issue·maintenance·alert` | proposed map `pending→issue`, `activity→alert` (see Unresolved Q1) |
| `status`+`finalized`+`finalizedReason` | legacy `status` | `finalizedReason: approved/rejected/archived` → same; not finalized → `created`/`modified` |
| `createdBy` snapshot `{id,email,name}` | `createdBy` | direct |
| `responses[]` (detail only) | `responses[]` | fetched lazily via `getById` |
| `events[]` (detail only) | `history[]` | audit comes from the API — widgets stop building their own history |
| — (`entityId` = **GCDR device UUID**) | device correlation | consumers map through the existing `gcdrDeviceId` SERVER_SCOPE attr chain (RFC-0183) |

### Tests (`tests/components/gcdr-annotations/`)

Vitest, `fetchImpl` mock:

1. auth strategy: `apiKey` → `X-API-Key` header; `bearerToken` string and async provider → `Authorization: Bearer`; both/none → constructor throws;
2. `domainPath` normalization (trailing slash) and route assembly — never rewrites host/version;
3. `listByCustomer` aggregates all pages (`pagination` envelope) and forwards filters (`includeArchived`, `type`…);
4. envelope unwrap `{success, data}` and raw-array tolerance;
5. retry on 429/503 (backoff, max 3) and NO retry on 400/401/409;
6. 409 surfaces `ConflictError { finalizedOrStale: true }`;
7. `patch` sends `If-Match: "<version>"`;
8. adapter: type/status mapping table both ways; unknown GCDR fields ignored;
9. TTL cache hit/expiry + invalidation after `create/patch/archive/respond`;
10. `respond({type:'rejected'})` without `text` → local validation error (mirrors API rule).

## Drawbacks
[drawbacks]: #drawbacks

- One more HTTP client in a lib that already has three fetch styles (TB clients, `AlarmApiClient`, ingestion auth) — mitigated by explicitly mirroring `AlarmApiClient`'s conventions and documenting this as the GCDR-client template going forward.
- The legacy adapter freezes RFC-0104 shapes into the public API for the whole migration window.

## Rationale and alternatives
[rationale-and-alternatives]: #rationale-and-alternatives

- **Extend `AlarmApiClient`** — rejected: alarms client is API-key-only, singleton-configured; annotations need per-instance auth (JWT for user tabs, API key for orchestrators) and write flows with optimistic locking.
- **Fetch inside `AnnotationServiceOrchestrator` directly** — rejected: the orchestrator is one of several consumers (AnnotationsTab, AnnotationIndicator, AlarmAnnotations also fetch); the Repository must be shared.
- **Generic `GcdrHttpClient` first** — deferred (Future possibilities): valuable, but scope-creep for this RFC.

## Prior art
[prior-art]: #prior-art

- `src/services/alarm/AlarmApiClient.ts` — envelope unwrap, route constants (the shape template).
- `src/services/annotations/CustomerDeviceService.ts` — retry/backoff policy reused verbatim.
- `src/services/ingestion/buildMyioIngestionAuth.ts` — async token-provider precedent for `bearerToken`.
- GCDR `ANNOTATIONS-API-GUIDE.md` + RFC-0036 — API contract, lifecycle, 409 semantics.
- RFC-0216 (this repo) — SQL extraction that seeds the GCDR migration this client consumes.

## Unresolved questions
[unresolved-questions]: #unresolved-questions

1. **Type mapping**: confirm `pending↔issue` and `activity↔alert` with the GCDR team (legacy has `issue/alert`; GCDR has `pending/activity`).
2. Does `GET /annotations?customerId` include the **subtree** of the customer (head-office key with `hierarchyAccess: SUBTREE/TENANT`) or must the head office iterate its children? Determines RFC-0221's call count (1 × HO vs 1 × shopping).
3. Max `limit` per page accepted by the API (affects the pagination cap).
4. Should the client also expose `listMentions`/`attachments` helpers in v1, or only the annotation CRUD used by the widgets?

## Future possibilities
[future-possibilities]: #future-possibilities

- Promote the internals to a shared `GcdrHttpClient` (auth strategies + envelope + retry) and refit `AlarmApiClient` on top.
- WebSocket/SSE push for `myio:annotation-changed` instead of event-bus polling.
- Batch endpoints (`/annotations/batch`) if the API grows them, mirroring `AlarmApiClient`.
