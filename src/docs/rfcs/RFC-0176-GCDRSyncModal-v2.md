# RFC-0176-v2: GCDR Sync Modal — Corrections & Additions

- **Amends:** [RFC-0176](./RFC-0176-GCDRSyncModal.md)
- **Start Date:** 2026-02-21
- **Status:** Draft
- **Authors:** MYIO Platform Team
- **Scope:** Delta only — read RFC-0176 first, then apply these corrections.

---

## Summary of Changes

| # | Section amended | Type | Description |
|---|-----------------|------|-------------|
| 1 | §2.1 Customer mapping | **Addition** | Send `externalId` on Customer CREATE |
| 2 | §2.2 Asset mapping | **Addition** | Send `externalId` on Asset CREATE |
| 3 | §2.3 Device mapping | **Correction** | Document `externalId` (already implemented, missing from table) |
| 4 | New §9 | **Addition** | Backfill strategy for existing entities |
| 5 | Unresolved Questions | **Resolved** | Q#1 (`gcdrTenantId`) and Q#2 (asset hierarchy) |

---

## Change 1 — §2.1 Customer → GCDR Customer

### Problem

The original mapping table stores the TB Customer UUID only in `metadata.tbCustomerId`.
This is unindexed JSONB — it cannot be used for reverse-lookup queries.

### Fix

Add `externalId` to the Customer CREATE payload:

| ThingsBoard field | GCDR CreateCustomer field | Notes |
|-------------------|--------------------------|-------|
| `customer.id` | `externalId` | TB Customer UUID stored in the indexed `external_id` column |
| `{ tbCustomerId: id }` | `metadata` | Keep for backwards compatibility / observability |

**Updated `entityMappers.ts` — `mapCustomer()` function:**

```typescript
// Before
const gcdrPayload: CreateCustomerDto = {
  name:      tbCustomer.title,
  displayName: tbCustomer.title,
  code:      slugify(tbCustomer.title, 50),
  type:      'BUSINESS',
  email:     tbCustomer.email   ?? undefined,
  phone:     tbCustomer.phone   ?? undefined,
  metadata:  { tbCustomerId: tbCustomer.id },
};

// After
const gcdrPayload: CreateCustomerDto = {
  name:        tbCustomer.title,
  displayName: tbCustomer.title,
  code:        slugify(tbCustomer.title, 50),
  type:        'BUSINESS',
  email:       tbCustomer.email  ?? undefined,
  phone:       tbCustomer.phone  ?? undefined,
  externalId:  tbCustomer.id,                          // ← NEW
  metadata:    { tbCustomerId: tbCustomer.id },        // keep
};
```

---

## Change 2 — §2.2 Asset → GCDR Asset

### Problem

Same as Change 1: the TB Asset UUID is stored only in `metadata.tbAssetId`.
The GCDR backend now has `GET /assets/external/:externalId` planned (RFC-0017 scope).

### Fix

Add `externalId` to the Asset CREATE payload:

| ThingsBoard field | GCDR CreateAsset field | Notes |
|-------------------|----------------------|-------|
| `asset.id` | `externalId` | TB Asset UUID stored in the indexed `external_id` column |
| `{ tbAssetId: id }` | `metadata` | Keep for backwards compatibility |

**Updated `entityMappers.ts` — `mapAsset()` function:**

```typescript
// Before
const gcdrPayload: CreateAssetDto = {
  name:        tbAsset.name,
  displayName: tbAsset.name,
  type:        mapAssetType(tbAsset.type),
  customerId:  gcdrCustomerId,
  parentAssetId: gcdrParentAssetId ?? undefined,
  metadata:    { tbAssetId: tbAsset.id },
};

// After
const gcdrPayload: CreateAssetDto = {
  name:          tbAsset.name,
  displayName:   tbAsset.name,
  type:          mapAssetType(tbAsset.type),
  customerId:    gcdrCustomerId,
  parentAssetId: gcdrParentAssetId ?? undefined,
  externalId:    tbAsset.id,                           // ← NEW
  metadata:      { tbAssetId: tbAsset.id },            // keep
};
```

> **Note:** The GCDR `assets` table does not yet have an `external_id` column. This field
> will be silently ignored by the API until that column is added (tracked in RFC-0017).
> Adding it now ensures the payload is forward-compatible.

---

## Change 3 — §2.3 Device → GCDR Device (Correction)

### Problem

The mapping table in RFC-0176 does not list `externalId` as an output field.
However, **production data confirms `externalId` is already being populated** with the
TB Device UUID (observed on device `6174a024` / "Escada Rolante 1 L2"):

```json
"externalId": "24538c80-b4de-11f0-be7f-e760d1498268",
"metadata": {
  "tbId":         "24538c80-b4de-11f0-be7f-e760d1498268",
  "tbName":       "3F SCMOXUARAAC_ER1_L2",
  "tbType":       "ESCADA_ROLANTE",
  "tbEntityType": "DEVICE"
}
```

Two observations:
1. `externalId` **is** being set — the implementation is ahead of the RFC.
2. The metadata key used in practice is `tbId`, not `tbDeviceId` as the RFC states.

### Fix — corrected mapping table for §2.3

| ThingsBoard field | GCDR CreateDevice field | Notes |
|-------------------|------------------------|-------|
| `device.id` | `externalId` | ✅ Already implemented |
| `device.id` | `metadata.tbId` | ✅ Already implemented — key is `tbId`, **not** `tbDeviceId` |
| `device.name` | `metadata.tbName` | ✅ Already implemented |
| `device.type` | `metadata.tbType` | ✅ Already implemented |
| `"DEVICE"` (literal) | `metadata.tbEntityType` | ✅ Already implemented |

**Correct the metadata key in `entityMappers.ts` — `mapDevice()` function:**

```typescript
// Before (RFC-0176 spec)
metadata: {
  tbDeviceId: tbDevice.id,   // ← wrong key name (not what is actually used)
  ...serverAttrs,
}

// After (matches production data)
metadata: {
  tbId:         tbDevice.id,          // ← correct key
  tbName:       tbDevice.name,
  tbType:       tbDevice.type,
  tbEntityType: 'DEVICE',
  ...serverAttrs,
}
```

---

## Change 4 — New §9: Backfill Strategy for Existing Entities

Entities already in GCDR before this v2 patch have `external_id = NULL`.
Run the following SQL **after** deploying migration `0006_melodic_satana.sql`.

### 4.1 Customers

```sql
-- Preview first
SELECT id, name,
  COALESCE(metadata->>'tbId', metadata->>'tbCustomerId') AS tb_id
FROM customers
WHERE (metadata->>'tbId' IS NOT NULL OR metadata->>'tbCustomerId' IS NOT NULL)
  AND external_id IS NULL;

-- Apply
UPDATE customers
SET external_id = COALESCE(
  metadata->>'tbId',
  metadata->>'tbCustomerId'
)
WHERE (metadata->>'tbId' IS NOT NULL OR metadata->>'tbCustomerId' IS NOT NULL)
  AND external_id IS NULL;
```

> Covers both the `tbId` key (used in practice) and `tbCustomerId` (specified in RFC-0176).

### 4.2 Devices

```sql
-- Preview first
SELECT id, name,
  COALESCE(metadata->>'tbId', metadata->>'tbDeviceId') AS tb_id
FROM devices
WHERE (metadata->>'tbId' IS NOT NULL OR metadata->>'tbDeviceId' IS NOT NULL)
  AND external_id IS NULL;

-- Apply
UPDATE devices
SET external_id = COALESCE(
  metadata->>'tbId',
  metadata->>'tbDeviceId'
)
WHERE (metadata->>'tbId' IS NOT NULL OR metadata->>'tbDeviceId' IS NOT NULL)
  AND external_id IS NULL;
```

### 4.3 Assets

Assets do not yet have an `external_id` column. No backfill needed at this time.
Once RFC-0017 adds the column, run:

```sql
UPDATE assets
SET external_id = COALESCE(
  metadata->>'tbId',
  metadata->>'tbAssetId'
)
WHERE (metadata->>'tbId' IS NOT NULL OR metadata->>'tbAssetId' IS NOT NULL)
  AND external_id IS NULL;
```

---

## Change 5 — Resolved Unresolved Questions

### Q#1 — Where is `gcdrTenantId` initially set in ThingsBoard? ✅ Resolved

`gcdrTenantId` is set **once per ThingsBoard tenant** as a `SERVER_SCOPE` attribute on
the root TB Customer (the top-level customer representing the GCDR tenant). It is set
manually by a MYIO super-admin during initial onboarding:

```
POST /api/plugins/telemetry/CUSTOMER/{rootTbCustomerId}/attributes/SERVER_SCOPE
Body: { "gcdrTenantId": "11111111-1111-1111-1111-111111111111" }
```

The modal reads it at open time via `fetchCustomerServerScopeAttrs(selectedCustomerId)`.
If the attribute propagation strategy changes (e.g. inherited from root), the
`fetchCustomerServerScopeAttrs` helper will need to walk up the customer hierarchy.

### Q#2 — TB Assets → GCDR Assets or GCDR Customers? ✅ Resolved

**TB Assets map to GCDR Assets** (not sub-customers). The GCDR hierarchy
`Customer → Asset → Device` maps directly to the TB hierarchy `Customer → Asset → Device`.
GCDR sub-customers are reserved for organizational groupings (holding, company, branch)
that exist independently of TB.

---

## Related Backend Changes (GCDR)

The following GCDR endpoints are now available and should be used by the sync modal
for idempotency checks (diff engine §3 of RFC-0176):

| Endpoint | Use |
|----------|-----|
| `GET /api/v1/devices/external/:externalId` | Check if TB device already exists in GCDR before CREATE |
| `GET /api/v1/customers/external/:externalId` | Check if TB customer already exists in GCDR before CREATE |

**Updated diff engine logic (`diffEngine.ts`):**

```typescript
// Before — idempotency check uses gcdrId from TB server_scope only
if (serverAttrs.gcdrId) {
  // try GET /devices/{gcdrId}
}

// After — also check by externalId to catch entities synced before gcdrId write-back
async function resolveExistingGcdrEntity(
  tbEntityId: string,
  entityType: 'CUSTOMER' | 'DEVICE',
  gcdrClient: GCDRApiClient,
): Promise<GcdrEntity | null> {
  // 1. Try by gcdrId (fast, from TB server_scope)
  if (serverAttrs.gcdrId) {
    const entity = await gcdrClient.getById(entityType, serverAttrs.gcdrId);
    if (entity) return entity;
  }
  // 2. Fallback: reverse-lookup by externalId
  return gcdrClient.getByExternalId(entityType, tbEntityId);
}
```

This makes the diff engine resilient to cases where the TB attribute write-back
(`gcdrId` → `SERVER_SCOPE`) failed after a previous sync run.
