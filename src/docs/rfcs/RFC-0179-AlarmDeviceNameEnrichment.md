# RFC-0179: Alarm Device Name Enrichment

- **Feature Name**: `alarm-device-name-enrichment`
- **RFC Number**: 0179
- **Start Date**: 2026-02-23
- **Status**: Draft / Discussion
- **Related RFCs**: RFC-0175 (AlarmService Real Data), RFC-0176 (GCDRSyncModal / GCDRApiClient), RFC-0177 (Alarm Widget)

---

## Summary

The Alarm API returns `deviceId` and `deviceName` fields that reference GCDR entities,
not ThingsBoard entities. The `deviceName` value is a programmatic short-code
(`"gcdr:<first-8-chars-of-uuid>"`) and not a human-readable label. This RFC discusses
strategies for enriching each alarm's device reference with a proper display name
before rendering it in the `AlarmsNotificationsPanel` component.

---

## Motivation

### Observed API Response

```json
{
  "id": "7dXjY0xqGi3BsiOI0uaFX",
  "deviceId": "e9dce3c5-efa0-4df3-8352-8d09e60a1ea7",
  "deviceName": "gcdr:e9dce3c5",
  "metadata": {
    "tbDeviceId": "330ec230-b4de-11f0-be7f-e760d1498268"
  }
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `deviceId` | `e9dce3c5-efa0-...` | GCDR device UUID |
| `deviceName` | `gcdr:e9dce3c5` | Auto-generated code — **not a user label** |
| `metadata.tbDeviceId` | `330ec230-b4de-...` | ThingsBoard device UUID |

The current `mapApiAlarm` mapper sets `source = api.deviceName || api.deviceId`,
which produces `"gcdr:e9dce3c5"` as the device chip label in the UI. This is
meaningful only to engineers; end-users see a cryptic string.

### Current Display Impact

- **Alarm card chips**: show `gcdr:e9dce3c5` instead of e.g. `ELV-01`
- **Alarm details modal — Devices tab**: same short-code label
- **Grouped alarms**: `groupAlarmsByTitle` joins sources with `,` —
  correct structurally, but each source is still a code, not a name

---

## Background

### GCDR vs ThingsBoard Identity Model

GCDR (the alarm and rules backend) maintains its own device registry, decoupled
from ThingsBoard. Each GCDR device has:
- A GCDR UUID (`deviceId` in alarms)
- A GCDR code derived from the device name (`gcdr:<uuid-prefix>` for auto-created ones)
- An `externalId` back-reference to the TB device UUID

When the Pre-Setup-Constructor syncs a ThingsBoard device tree into GCDR it writes
`ingestionId` (the GCDR UUID) into ThingsBoard `SERVER_SCOPE` attributes.
The alarm's `metadata.tbDeviceId` is the inverse mapping from GCDR → TB.

### Existing Client Infrastructure

`GCDRApiClient` (RFC-0176) already supports:

```typescript
// Single device by GCDR UUID
getDevice(gcdrId: string): Promise<GCDREntity | null>

// Single device by TB UUID (external reference)
getDeviceByExternalId(externalId: string): Promise<GCDREntity | null>

// Full customer bundle (customer + assets + devices)
getCustomerBundle(tbExternalId: string, opts): Promise<GCDRCustomerBundle | null>
```

Base URL: `https://gcdr-api.a.myio-bas.com`
API Key: `gcdr_cust_tb_master_key_2026` (master key — different from alarm integration key)

---

## Proposed Approaches

### Option A — GCDR Parallel Lazy Fetch

After `AlarmService.getAlarms()` returns, collect all unique GCDR device IDs,
fetch them in parallel via `GCDRApiClient.getDevice()`, and re-map `source`.

```typescript
// AlarmService (or AlarmsNotificationsPanelController)
async enrichDeviceNames(alarms: Alarm[]): Promise<Alarm[]> {
  const uniqueIds = [...new Set(alarms.map(a => a.source).filter(Boolean))];
  const results = await Promise.all(uniqueIds.map(id => gcdrClient.getDevice(id)));
  const nameMap = new Map<string, string>();
  uniqueIds.forEach((id, i) => {
    if (results[i]?.name) nameMap.set(id, results[i].name);
  });
  return alarms.map(a => ({
    ...a,
    source: nameMap.get(a.source) ?? a.source,
  }));
}
```

**Pros:**
- Uses existing `GCDRApiClient.getDevice()` — zero new infrastructure
- Only fetches devices actually referenced in the current alarm page
- Result can be cached alongside the alarm list (same TTL)

**Cons:**
- N HTTP calls (one per unique device) — parallel but still N round-trips
- Requires GCDR master API key available in the Alarm widget context
- `source` field currently holds GCDR UUID, not suited as a stable lookup key
  if the alarm list grows across multiple alarm types

**Best for:** Small alarm lists (< 20 unique devices). Simplest to implement.

---

### Option B — GCDR Bulk via Customer Bundle

Fetch all devices for the customer at initialization time using
`getCustomerBundle(tbCustomerId, { deep: true })`.
Build a `Map<gcdrDeviceId, name>` once and reuse for all alarm renders.

```typescript
// On widget init, before first alarm fetch
const bundle = await gcdrClient.getCustomerBundle(tbCustomerId, { deep: true });
const deviceNameMap = new Map<string, string>();
(bundle?.devices ?? []).forEach(d => deviceNameMap.set(d.id, d.name));

// Pass to AlarmService.getAlarms()
const { data } = await AlarmService.getAlarms(params, customerMap, deviceNameMap);
```

**Pros:**
- **1 HTTP call** for all devices — optimal network usage
- Map is built once and reused across refreshes (until TTL expires)
- Covers devices that may appear in future alarm pages too

**Cons:**
- `getCustomerBundle` uses `external/{tbExternalId}` — needs TB customer UUID,
  not the GCDR customer UUID present in alarm responses
- Bundle response may be large (all assets + devices + rules)
- Adds latency to initial load (bundle fetch before first alarm render)
- The TB customer UUID must be passed down from the widget settings / orchestrator

**Best for:** Dashboards with many alarms and many devices. Ideal long-term solution.

---

### Option C — ThingsBoard API via `metadata.tbDeviceId`

Every alarm's `metadata.tbDeviceId` is the ThingsBoard device UUID.
Query TB API `GET /api/device/{tbDeviceId}` for each unique device.

```typescript
// Inside AlarmsNotificationsPanelController (has access to TB context)
async enrichViaTB(alarms: Alarm[]): Promise<Alarm[]> {
  const tbIds = [...new Set(alarms.map(a => a.raw?.metadata?.tbDeviceId).filter(Boolean))];
  const tbDevices = await Promise.all(
    tbIds.map(id => fetch(`/api/device/${id}`, { headers: tbAuthHeaders }).then(r => r.json()))
  );
  const nameMap = new Map(tbIds.map((id, i) => [id, tbDevices[i]?.name ?? id]));
  return alarms.map(a => ({
    ...a,
    source: nameMap.get(a.raw?.metadata?.tbDeviceId) ?? a.source,
  }));
}
```

**Pros:**
- TB device name is the canonical human-readable label seen everywhere in TB
- No extra credentials needed — JWT token already available via `self.ctx`
- `metadata.tbDeviceId` is always present in observed API responses
- Can use TB batch endpoint `POST /api/entities/ids` to reduce round-trips

**Cons:**
- Requires passing raw `metadata` through the `Alarm` type (currently not mapped)
- Couples alarm display to ThingsBoard session token (not usable outside widget)
- `Alarm.source` semantics change: GCDR UUID → TB UUID lookup chain

**Best for:** Environments where TB names are authoritative and GCDR is opaque.

---

## Comparison Matrix

| Criteria | Option A (GCDR lazy) | Option B (GCDR bulk) | Option C (TB API) |
|----------|---------------------|---------------------|------------------|
| HTTP calls | N (parallel) | 1 | N (parallel, or batch) |
| New infrastructure | None | `AlarmService` param extension | `Alarm` type extension |
| Credentials needed | GCDR master key | GCDR master key + TB UUID | TB JWT only |
| Name quality | GCDR registered name | GCDR registered name | TB device name |
| Offline / no-GCDR | ❌ fails | ❌ fails | ✅ works |
| Implementation effort | Low | Medium | Medium |
| Latency (first render) | Low (non-blocking) | Higher (blocks init) | Low (non-blocking) |

---

## Open Questions

1. **Which name is canonical?**
   GCDR device names are set during Pre-Setup sync and may differ from the TB device
   name if they were manually renamed in ThingsBoard afterwards. Which takes precedence?

2. **Should enrichment be blocking or progressive?**
   Should alarms render first with short-codes and then update (progressive), or
   should the UI wait for names before rendering (blocking)?

3. **Where should the `deviceNameMap` live?**
   Inside `AlarmService` (alongside alarm cache), in the controller, or passed
   externally from the orchestrator?

4. **Is `metadata.tbDeviceId` guaranteed?**
   Observed in real API responses, but is it part of the contract or implementation detail?
   Should the alarm mapper expose it in `Alarm` type?

5. **GCDR master key availability in ALARM widget?**
   Currently only `alarmsApiKey` (integration key) flows from MAIN_VIEW orchestrator
   to the ALARM widget. The GCDR master key is a separate secret. Should it also be
   propagated, or should Option C (TB JWT) be preferred to avoid a second secret?

---

## Unresolved

- Decision on preferred approach (A, B, C, or hybrid)
- Whether to expose `metadata.tbDeviceId` in the `Alarm` type
- Whether `AlarmService.getAlarms()` should accept and apply a `deviceNameMap`
  (current signature already accepts `customerMap` — same pattern could apply)
- Cache strategy for the device name map (same TTL as alarms? separate?)

---

## Implementation Sketch (if Option A is chosen)

### 1. Extend `AlarmService`

```typescript
// Add to AlarmServiceClass
private readonly deviceNameCache = new Map<string, CacheEntry<string>>();

async resolveDeviceName(gcdrDeviceId: string): Promise<string> {
  const cached = this.deviceNameCache.get(gcdrDeviceId);
  if (isFresh(cached, this.cacheTtlMs)) return cached.data;

  const device = await this.gcdrClient.getDevice(gcdrDeviceId);
  const name = device?.name ?? gcdrDeviceId;
  this.deviceNameCache.set(gcdrDeviceId, { data: name, timestamp: Date.now() });
  return name;
}

async enrichAlarmSources(alarms: Alarm[]): Promise<Alarm[]> {
  const uniqueSources = [...new Set(alarms.map(a => a.source).filter(Boolean))];
  await Promise.all(uniqueSources.map(id => this.resolveDeviceName(id)));
  return alarms.map(a => ({
    ...a,
    source: this.deviceNameCache.get(a.source)?.data ?? a.source,
  }));
}
```

### 2. Call after `getAlarms()`

```typescript
// In AlarmsNotificationsPanelController or ALARM controller
const { data, summary } = await AlarmService.getAlarms(params);
const enriched = await AlarmService.enrichAlarmSources(data);
// render enriched
```

### 3. Clear on `configure()`

```typescript
clearCache(): void {
  // existing caches...
  this.deviceNameCache.clear();
}
```

---

## References

- `src/services/alarm/AlarmService.ts` — alarm fetch + cache
- `src/services/alarm/types.ts` — `AlarmApiResponse` type (has `deviceId`, `deviceName`)
- `src/components/premium-modals/gcdr-sync/GCDRApiClient.ts` — `getDevice()`, `getCustomerBundle()`
- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/responseAlarmsApi.json` — real API sample
- `src/components/AlarmsNotificationsPanel/AlarmsNotificationsPanelController.ts` — consumer
