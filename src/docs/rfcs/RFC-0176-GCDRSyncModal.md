# RFC-0176: GCDR Sync Modal

- **Feature**: GCDR Sync Modal
- **Start date**: 2026-02-19
- **Status**: Draft
- **Replaces / Related**: RFC-0109 (Upsell Post-Setup Modal), RFC-0175 (Alarms Real Usage)

---

## Summary

A premium modal (`openGCDRSyncModal`) that mirrors the ThingsBoard entity hierarchy —
**Customers → Assets → Devices** — into the GCDR platform in real time.

When an entity is created, updated, or deleted, the modal orchestrates the corresponding
GCDR REST calls, then writes the resulting `gcdrId` back to the ThingsBoard entity as a
`SERVER_SCOPE` attribute. This creates a stable bidirectional link between the two
platforms without any backend middleware.

---

## Motivation

The GCDR platform (`gcdr-api.a.myio-bas.com`) is the source of truth for alarm
orchestration, availability metrics, and predictive maintenance (see RFC-0175). However,
GCDR has no automatic knowledge of the ThingsBoard hierarchy: customers, assets, and
devices must be explicitly registered in GCDR before alarms, MTBF/MTTR, or availability
data can be associated with them.

Currently, this registration is done manually by the ops team, leading to:

- Customers appearing in ThingsBoard but not in GCDR (no alarm data).
- Devices synced to GCDR with stale names or wrong type mappings.
- No audit trail of what was synced, when, or by whom.

RFC-0176 eliminates this manual step by providing a **one-click full sync** and an
**incremental sync** for individual entities, directly from the ThingsBoard dashboard.

### Design goals

1. **No new backend required.** The modal calls ThingsBoard REST and GCDR REST directly.
2. **Idempotent.** Running the sync twice must not create duplicate entities.
3. **Traceable.** Every synced entity receives a `gcdrId` server_scope attribute written
   back to ThingsBoard.
4. **Recoverable.** Failed entities are surfaced in a result summary; successful ones are
   not re-processed on retry.

---

## Ecosystem Overview

### ThingsBoard (source)

| Entity type | TB REST endpoint | Relevant server_scope attributes |
|-------------|-----------------|----------------------------------|
| Customer    | `GET /api/customer/{id}` | `gcdrId`, `gcdrCustomerId` (after sync) |
| Asset       | `GET /api/asset/{id}` | `gcdrId`, `gcdrAssetId` (after sync) |
| Device      | `GET /api/device/{id}` | `gcdrId`, `gcdrDeviceId`, `deviceType`, `deviceProfile` (before sync) |

Server_scope attributes are written via:
```
POST /api/plugins/telemetry/{entityType}/{entityId}/attributes/SERVER_SCOPE
```
with a JSON body such as `{ "gcdrId": "<gcdr-uuid>" }`.

### GCDR (target)

- **Base URL**: `https://gcdr-api.a.myio-bas.com`
- **Auth header**: `X-API-Key: gcdr_cust_tb_master_key_2026`
- **Scope**: `*:read` + write on customers, assets, devices, rules, alarms, telemetry + `sync:write`
- **Tenant isolation**: every request requires the header `x-tenant-id: <gcdr-tenant-uuid>`

GCDR entity hierarchy mirrors ThingsBoard:

```
GCDR Customer (← TB Customer)
  └── GCDR Asset (← TB Asset, type = SITE / BUILDING / ZONE / …)
        └── GCDR Device (← TB Device, type = SENSOR / METER / HVAC / …)
```

---

## Guide-Level Explanation

### Opening the modal

```javascript
MyIOLibrary.openGCDRSyncModal({
  ctx,                         // ThingsBoard widget context
  customerId: 'tb-cust-uuid',  // TB customer to sync
  themeMode: 'dark',
  gcdrTenantId: 'gcdr-tenant-uuid', // from TB server_scope attr: gcdrTenantId
  onComplete: (result) => {
    console.log('Sync result:', result);
  },
});
```

### User flow (3 steps)

```
┌─────────────────────────────────────────────────────┐
│  Step 1 — Preview                                   │
│                                                     │
│  Customer:  Shopping Mestre Álvaro                  │
│  Assets:    6 to create · 0 to update · 0 to delete│
│  Devices:  42 to create · 3 to update · 1 to delete│
│                                                     │
│  [Cancel]              [Review Changes] →           │
└─────────────────────────────────────────────────────┘
          ↓ user clicks "Review Changes"
┌─────────────────────────────────────────────────────┐
│  Step 2 — Confirm                                   │
│                                                     │
│  ▸ Customer  (1 create)                             │
│  ▸ Assets    (6 create, expandable list)            │
│  ▸ Devices  (42 create, 3 update, expandable)       │
│                                                     │
│  [← Back]              [Run Sync ▶]                 │
└─────────────────────────────────────────────────────┘
          ↓ user clicks "Run Sync"
┌─────────────────────────────────────────────────────┐
│  Progress overlay (like Upsell BusyModal)           │
│  ████████████░░░░░░  32 / 49  (65%)                 │
│  Syncing device "ESC-04"…                           │
└─────────────────────────────────────────────────────┘
          ↓ completes
┌─────────────────────────────────────────────────────┐
│  Step 3 — Results                                   │
│                                                     │
│  ✅ 1 customer synced                               │
│  ✅ 6 assets synced                                 │
│  ✅ 44 devices synced                               │
│  ⚠️  1 device failed: ESC-11 (conflict, see detail) │
│                                                     │
│  [Close]               [Retry Failed]               │
└─────────────────────────────────────────────────────┘
```

---

## Reference-Level Explanation

### 1. Data Fetch Phase (Step 1 — Preview)

Before showing the preview, the modal fetches:

1. **TB Customer** via `GET /api/customer/{customerId}` → read `name`, `email`, `additionalInfo`.
2. **TB Assets** via `GET /api/customer/{customerId}/assets?pageSize=1000&page=0` → full asset list.
3. **TB Devices** via `GET /api/customer/{customerId}/devices?pageSize=1000&page=0` → full device list.
4. **Server-scope attributes** for each entity:
   ```
   GET /api/plugins/telemetry/{CUSTOMER|ASSET|DEVICE}/{id}/values/attributes/SERVER_SCOPE
   ```
   Used to detect:
   - `gcdrId` present → entity already synced (compare for updates).
   - `deviceType`, `deviceProfile` → used for GCDR device type mapping.

5. **GCDR lookup** (only for already-synced entities, i.e., `gcdrId` present):
   - `GET /customers/{gcdrId}` / `GET /assets/{gcdrId}` / `GET /devices/{gcdrId}`
   - Determines if the entity still exists in GCDR (to detect stale `gcdrId`).

The preview diff is computed by comparing the TB state against the GCDR state:

| Condition | Action |
|-----------|--------|
| No `gcdrId` in TB server_scope | `CREATE` in GCDR |
| `gcdrId` present, GCDR entity exists, fields differ | `UPDATE` in GCDR |
| `gcdrId` present, GCDR entity exists, no change | `SKIP` (no-op) |
| `gcdrId` present, GCDR entity missing | `RECREATE` (create + update `gcdrId`) |
| TB entity deleted (future: webhook) | `DELETE` in GCDR |

---

### 2. Entity Mapping

#### 2.1 Customer → GCDR Customer

| ThingsBoard field | GCDR CreateCustomer field | Notes |
|-------------------|--------------------------|-------|
| `customer.title` | `name` | |
| `customer.title` | `displayName` | Same value |
| Auto-generated slug | `code` | `slugify(title, maxLen=50)` |
| `"BUSINESS"` (hardcoded) | `type` | Can be overridden via modal setting |
| `customer.email` | `contact.email` | Optional |
| `customer.phone` | `contact.phone` | Optional |
| `customer.address` | `address.street` | Optional |
| `customer.city` | `address.city` | Optional |
| `customer.country` | `address.countryCode` | Optional |
| `{ tbCustomerId: id }` | `metadata` | For traceability |

After a successful `POST /customers` response:
```
POST /api/plugins/telemetry/CUSTOMER/{tbCustomerId}/attributes/SERVER_SCOPE
Body: { "gcdrId": "<gcdr-customer-uuid>", "gcdrCustomerId": "<gcdr-customer-uuid>" }
```

#### 2.2 Asset → GCDR Asset

| ThingsBoard field | GCDR CreateAsset field | Notes |
|-------------------|----------------------|-------|
| `asset.name` | `name` | |
| `asset.name` | `displayName` | |
| TB asset type mapping | `type` | See §2.2.1 |
| Parent customer's `gcdrId` | `customerId` | Must be synced first |
| Parent asset's `gcdrId` | `parentAssetId` | Hierarchical assets |
| `{ tbAssetId: id }` | `metadata` | |

**§2.2.1 TB Asset type → GCDR Asset type mapping**

| TB assetType value | GCDR Asset type |
|--------------------|-----------------|
| `"shopping"`, `"mall"`, `"site"` | `SITE` |
| `"building"`, `"predio"` | `BUILDING` |
| `"floor"`, `"andar"` | `FLOOR` |
| `"room"`, `"sala"` | `ROOM` |
| `"zone"`, `"area"` | `ZONE` |
| _(default / unknown)_ | `OTHER` |

After successful `POST /assets`:
```
POST /api/plugins/telemetry/ASSET/{tbAssetId}/attributes/SERVER_SCOPE
Body: { "gcdrId": "<gcdr-asset-uuid>", "gcdrAssetId": "<gcdr-asset-uuid>" }
```

#### 2.3 Device → GCDR Device

| ThingsBoard field | GCDR CreateDevice field | Notes |
|-------------------|------------------------|-------|
| `device.name` | `name` | |
| `device.label \|\| device.name` | `displayName` | Prefer label if set |
| TB device type mapping | `type` | See §2.3.1 |
| `device.name` (as fallback) | `serialNumber` | Prefer `serialNumber` server_scope attr if present |
| `serverAttrs.manufacturer` | `manufacturer` | From TB server_scope |
| `serverAttrs.model` | `model` | From TB server_scope |
| `serverAttrs.firmwareVersion` | `firmwareVersion` | From TB server_scope |
| Parent asset's `gcdrId` | `assetId` | Must be synced first |
| All server_scope attrs | `metadata` | Full passthrough |
| `{ tbDeviceId: id }` | `metadata.tbDeviceId` | Overrides above |

**§2.3.1 TB Device type → GCDR Device type mapping**

| TB deviceType / deviceProfile value | GCDR Device type |
|-------------------------------------|-----------------|
| `ESCADA_ROLANTE`, `escalator` | `ACTUATOR` |
| `ELEVADOR`, `elevator` | `ACTUATOR` |
| `3F_MEDIDOR`, `MEDIDOR`, `METER` | `METER` |
| `TERMOSTATO`, `thermostat` | `SENSOR` |
| `HIDROMETRO`, `water_meter` | `METER` |
| `CHILLER`, `HVAC`, `FANCOIL` | `HVAC` |
| `GATEWAY`, `CENTRAL` | `GATEWAY` |
| `BOMBA`, `pump` | `ACTUATOR` |
| _(default / unknown)_ | `OTHER` |

After successful `POST /devices`:
```
POST /api/plugins/telemetry/DEVICE/{tbDeviceId}/attributes/SERVER_SCOPE
Body: { "gcdrId": "<gcdr-device-uuid>", "gcdrDeviceId": "<gcdr-device-uuid>" }
```

---

### 3. Sync Execution Order

Entities must be synced in dependency order to satisfy GCDR foreign key constraints:

```
1. Customer     (no dependencies)
2. Assets       (require customerId → customer must be synced first)
   2a. Top-level assets (parentAssetId = null)
   2b. Child assets     (sorted by depth, ascending)
3. Devices      (require assetId → parent asset must be synced first)
```

Within each level, items can be processed in parallel (configurable concurrency, default
`concurrency = 5`).

---

### 4. TB Attributes Write-Back

After each successful GCDR creation or recreation, the modal writes back to TB:

```typescript
// Pseudocode
async function writeGcdrIdToTB(
  entityType: 'CUSTOMER' | 'ASSET' | 'DEVICE',
  tbEntityId: string,
  gcdrId: string,
  tbJwt: string
): Promise<void> {
  const url = `/api/plugins/telemetry/${entityType}/${tbEntityId}/attributes/SERVER_SCOPE`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tbJwt}`,
    },
    body: JSON.stringify({
      gcdrId,
      [`gcdr${capitalize(entityType.toLowerCase())}Id`]: gcdrId,
      gcdrSyncedAt: new Date().toISOString(),
    }),
  });
}
```

For **UPDATE** operations, the `gcdrId` is already present and no attribute write-back is
needed unless the GCDR entity was recreated (conflict/stale case).

---

### 5. Module Architecture

```
src/components/premium-modals/gcdr-sync/
├── openGCDRSyncModal.ts      # Public entry point
├── GCDRSyncModalView.ts      # DOM rendering (3 steps + progress overlay)
├── GCDRSyncController.ts     # Orchestration logic (fetch → diff → sync)
├── GCDRApiClient.ts          # GCDR REST client (X-API-Key auth)
├── TBDataFetcher.ts          # TB REST calls (customers/assets/devices/attrs)
├── entityMappers.ts          # TB → GCDR field mapping functions
├── typeMapping.ts            # TB type → GCDR enum lookup tables
├── diffEngine.ts             # Compute CREATE/UPDATE/SKIP/RECREATE/DELETE plan
├── attrWriteback.ts          # gcdrId writeback to TB server_scope
├── types.ts                  # All TypeScript interfaces
└── styles.ts                 # CSS-in-JS (dark/light theme)
```

#### Key interfaces

```typescript
interface GCDRSyncModalParams {
  ctx: ThingsboardWidgetContext;
  customerId: string;           // TB customer UUID
  gcdrTenantId: string;         // GCDR tenant UUID (from TB server_scope: gcdrTenantId)
  themeMode?: 'dark' | 'light';
  concurrency?: number;         // Max parallel GCDR requests (default: 5)
  dryRun?: boolean;             // Preview only, no writes (default: false)
  onComplete?: (result: GCDRSyncResult) => void;
}

interface GCDRSyncPlan {
  customer: SyncAction;
  assets:   SyncAction[];
  devices:  SyncAction[];
}

type SyncActionType = 'CREATE' | 'UPDATE' | 'SKIP' | 'RECREATE' | 'DELETE';

interface SyncAction {
  type:         SyncActionType;
  tbEntityId:   string;
  tbEntityType: 'CUSTOMER' | 'ASSET' | 'DEVICE';
  tbName:       string;
  gcdrId?:      string;         // Present for UPDATE / RECREATE / DELETE
  gcdrPayload:  CreateCustomerDto | CreateAssetDto | CreateDeviceDto;
}

interface GCDRSyncResult {
  succeeded: SyncOutcome[];
  failed:    SyncOutcome[];
  skipped:   SyncOutcome[];
}

interface SyncOutcome {
  tbEntityId:   string;
  tbEntityType: 'CUSTOMER' | 'ASSET' | 'DEVICE';
  tbName:       string;
  gcdrId?:      string;
  action:       SyncActionType;
  error?:       string;
}
```

---

### 6. Authentication

**GCDR calls:**
```http
X-API-Key: gcdr_cust_tb_master_key_2026
x-tenant-id: <gcdrTenantId>
Content-Type: application/json
```

`gcdrTenantId` is read from TB customer `SERVER_SCOPE` attributes key `gcdrTenantId` at
modal open time. If absent, the modal shows an error and blocks sync.

**TB calls:**
```http
Authorization: Bearer <tb-jwt>
Content-Type: application/json
```

The TB JWT is obtained from `self.ctx.$injector.get('authService').getJwtToken()`, the
same pattern used by the existing Upsell modal.

---

### 7. Error Handling

| Error scenario | Behaviour |
|----------------|-----------|
| `gcdrTenantId` missing from TB attrs | Modal shows inline error at open, sync blocked |
| GCDR 401 / 403 | Abort entire sync, show auth error message |
| GCDR 409 Conflict (entity exists with different name) | Mark action as `RECREATE` or `UPDATE` on conflict resolution |
| GCDR 422 Validation error | Mark individual entity as FAILED, continue others |
| GCDR 5xx / network timeout | Retry once (exponential backoff 1s → 2s), then mark FAILED |
| TB attribute write-back failure | Log warning, mark as `gcdrId_pending` in result, do not fail the entity |
| TB asset/device list pagination | Follow cursor until `hasNext === false` |

---

### 8. Progress UI (BusyModal)

Reuse the `BusyModal` pattern from RFC-0109 (Upsell) with a purple gradient:

```
┌────────────────────────────────────┐
│  ⟳  Syncing device "ESC-04"…      │
│  ████████████░░░░░░  32 / 49       │
│                               65%  │
└────────────────────────────────────┘
```

Progress increments:
- `+1` per TB data fetch batch
- `+1` per successful or failed GCDR call
- `+1` per successful or failed TB attribute write-back

---

## Implementation Phases

| Phase | Description | Deliverable |
|-------|-------------|-------------|
| **A** | Types, mappers, type tables | `types.ts`, `entityMappers.ts`, `typeMapping.ts` |
| **B** | GCDR API client + TB data fetcher | `GCDRApiClient.ts`, `TBDataFetcher.ts` |
| **C** | Diff engine | `diffEngine.ts` (unit-testable, pure functions) |
| **D** | Sync controller + write-back | `GCDRSyncController.ts`, `attrWriteback.ts` |
| **E** | Modal view (3 steps + progress) | `GCDRSyncModalView.ts`, `styles.ts` |
| **F** | Public entry point + export | `openGCDRSyncModal.ts`, `src/index.ts` export |
| **G** | Integration in Pre-Setup Constructor | `Pre-Setup-Constructor/v.1.0.9/controller.js`: new toolbar button, same pattern as Upsell |

---

## Drawbacks

- **TB write-back latency.** Writing `gcdrId` attributes back to TB adds N+M extra HTTP
  calls (N assets + M devices). With 50 devices this is ~50 extra POST requests.
- **Attribute key collision.** If a device already has a `gcdrId` attribute from a
  previous (now-deleted) GCDR installation, the modal will treat it as an UPDATE, not
  a CREATE. This could fail if the old GCDR ID is gone. Mitigated by the RECREATE
  action type in the diff engine.
- **No real-time sync.** This is a manual / on-demand sync, not an event-driven mirror.
  Changes in ThingsBoard after a sync (new devices added, names changed) require the
  operator to re-run the sync.
- **Type mapping is lossy.** The TB device type space is larger than GCDR's enum. Unknown
  types fall back to `OTHER`, which loses classification fidelity.

---

## Alternatives Considered

### A. Backend sync service
A dedicated microservice could listen to ThingsBoard MQTT/WebSocket events and push
changes to GCDR automatically. This provides real-time sync but requires new
infrastructure, deployment, and maintenance overhead. Out of scope for RFC-0176.

### B. Extend GCDR with a `/sync` bulk endpoint
A single `POST /sync` endpoint accepting a full TB export payload would dramatically
reduce the number of HTTP calls. This was documented as a request in RFC-0175
(AlarmsBackendRequirements, Q#9 area). Until the backend team implements it, the
per-entity approach in this RFC is the pragmatic path.

### C. Store gcdrId in TB SHARED_SCOPE
SHARED_SCOPE attributes are visible to device firmware. Writing `gcdrId` there could
expose internal IDs to the device. SERVER_SCOPE is the correct scope for platform
metadata.

---

## Unresolved Questions

| # | Question | Priority | Blocking? |
|---|----------|----------|-----------|
| 1 | Where is `gcdrTenantId` initially set in ThingsBoard? Is it set manually once per customer by a super-admin, or provisioned automatically? | **High** | **Yes** |
| 2 | Should TB Assets map to GCDR Assets or to GCDR Customers (sub-customers)? Some shoppings have a two-level TB hierarchy (Customer → Asset → Device) while GCDR supports Customer → Asset → Device natively. | **High** | Yes (mapping strategy) |
| 3 | What is the conflict resolution strategy for `409 Conflict` from GCDR? Update the existing entity, or abort? | Medium | No (default: UPDATE) |
| 4 | Should the modal support **partial sync** (one asset, one device) in addition to full customer sync? | Medium | No (full sync first) |
| 5 | Should deleted TB entities trigger GCDR deletes, or only GCDR `status = INACTIVE`? Hard deletes in GCDR may break historical alarm data. | Medium | No (default: INACTIVE) |
| 6 | What is the GCDR rate limit on write endpoints? Should we throttle our concurrency? | Low | No (default `concurrency=5` is conservative) |
| 7 | Does the `gcdr_cust_tb_master_key_2026` API key have a TTL / rotation policy? | Low | No |

---

## Integration Point: Pre-Setup Constructor

The "GCDR Sync" button lives in the toolbar of the Pre-Setup Constructor widget,
alongside the existing "Upsell Setup" button (RFC-0109).

**File**: `src/thingsboard/WIDGET/Pre-Setup-Constructor/v.1.0.9/controller.js`

**Current toolbar** (lines ~3988–3994):
```html
<button id="add-root"       class="btn btn-primary">＋ Cliente Raiz</button>
<button id="import-root"    class="btn btn-outline">⤓ Importar Cliente</button>
<button id="import-json"    class="btn btn-outline">📥 Importar JSON</button>
<button id="ingestion-sync" class="btn btn-outline">🔄 Ingestion Sync</button>
<button id="upsell-modal"   class="btn btn-outline" style="background:#3e1a7d;…">⚡ Upsell Setup</button>
```

**New button to add** (after `upsell-modal`):
```html
<button id="gcdr-sync" class="btn btn-outline"
  style="background:#0a6d5e;color:#fff;border-color:#0a6d5e;">
  🔗 GCDR Sync
</button>
```

**Click handler** (follows the exact same `loadMyIOLibrary()` pattern as Upsell):
```javascript
// RFC-0176: GCDR Sync Modal
document.getElementById('gcdr-sync').onclick = async () => {
  try {
    const lib = await loadMyIOLibrary(); // reuse existing helper

    const thingsboardToken = localStorage.getItem('jwt_token');
    if (!thingsboardToken) {
      window.alert('Token ThingsBoard não encontrado. Faça login novamente.');
      return;
    }

    // gcdrTenantId is read from the selected customer's SERVER_SCOPE attributes
    // using the existing fetchCustomerServerScopeAttrs() function already in this controller
    const selectedCustomerId = /* currently selected customer in the tree */ null;
    if (!selectedCustomerId) {
      window.alert('Selecione um cliente na árvore antes de sincronizar.');
      return;
    }

    const attrs = await fetchCustomerServerScopeAttrs(selectedCustomerId);
    const gcdrTenantId = attrs?.gcdrTenantId;
    if (!gcdrTenantId) {
      window.alert('Atributo gcdrTenantId não encontrado no cliente. Configure-o antes de sincronizar.');
      return;
    }

    lib.openGCDRSyncModal({
      customerId:   selectedCustomerId,
      gcdrTenantId: gcdrTenantId,
      themeMode:    'dark',
      onComplete: (result) => {
        console.log('[GCDRSync] Result:', result);
      },
    });
  } catch (err) {
    console.error('[GCDRSync] Error:', err);
    window.alert('Erro ao abrir GCDR Sync: ' + err.message);
  }
};
```

The `fetchCustomerServerScopeAttrs(customerTbId)` function (line ~746 in this controller)
already exists and returns the customer's `SERVER_SCOPE` attributes. It will be used
without modification to read `gcdrTenantId`.

---

## Contact

- **Frontend team**: myio-js-library (`myio-js-library-PROD.git`)
- **RFC document**: `src/docs/rfcs/RFC-0176-GCDRSyncModal.md`
- **Integration file**: `src/thingsboard/WIDGET/Pre-Setup-Constructor/v.1.0.9/controller.js`
- **Reference modals**: RFC-0109 (Upsell), RFC-0175 (Alarms)
- **Tech Lead**: Rodrigo Lago — rodrigo@myio.com.br
