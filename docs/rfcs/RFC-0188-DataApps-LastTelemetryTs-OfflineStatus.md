# RFC-0188 — Use `lastTelemetryTs` from Data Apps API as Authoritative Offline Timestamp

- **Feature name:** `data-apps-last-telemetry-ts-offline`
- **Start date:** 2026-03-10
- **Status:** Proposed — awaiting approval
- **Related RFCs:** RFC-0110 (Device Status Master Rules), RFC-0109 (Weak Connection), RFC-0130 (Per-profile delay thresholds), RFC-0108 (Metadata-first enrichment)
- **Affected files:**
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`

---

## Summary

Replace the ThingsBoard-sourced telemetry timestamps (`meta.pulsesTs`, `meta.consumptionTs`) used by `calculateDeviceStatus()` with the `lastTelemetryTs` field returned by the Data Apps ingestion API (`GET /api/v1/telemetry/customers/:id/:domain/devices/totals`). This field, already fetched during normal data loading and present in `apiRow`, represents the last timestamp at which the ingestion backend actually processed a data point — a more reliable signal than ThingsBoard's broker-level timestamps.

---

## Motivation

### Current problem

`calculateDeviceStatus()` decides whether a device is offline by checking how old the most recent telemetry timestamp is. It currently reads this timestamp from ThingsBoard's `ctx.data`:

| Domain | Field used | ThingsBoard dataKey |
|--------|-----------|---------------------|
| Energy | `meta.consumptionTs` | `consumption` |
| Water | `meta.pulsesTs` | `pulses` |
| Water (alt) | `meta.waterLevelTs` | `water_level` |
| Temperature | `meta.temperatureTs` | `temperature` |

These timestamps originate from ThingsBoard's **message broker layer**, not from the ingestion pipeline. ThingsBoard can update its internal ts for a dataKey even when the underlying value did not change (e.g., due to telemetry forwarding, cache revalidation, or periodic heartbeat messages). This causes a device to appear **online** in the dashboard even when the ingestion backend has not received a real data point for hours.

### Available better source

The Data Apps API — already called by the orchestrator to enrich device cards — returns a `lastTelemetryTs` field per device:

```json
{
  "id": "fe9614a6-76cb-400d-a5c2-12d7ce983673",
  "name": "HIDR. SCMAL3L4311 x10",
  "deviceType": "water",
  "total_value": 3.2,
  "lastTelemetryTs": "2026-03-10T02:15:00.000Z",
  "customerId": "e01bdd22-3be6-4b75-9dae-442c8b8c186e"
}
```

This timestamp is computed by the ingestion backend and reflects when a real measurement was last ingested and processed — it is **not** affected by broker-level heartbeats or ThingsBoard internal replication.

### Identity link — `apiRow.id` = `meta.ingestionId`

The match between an API row and a ThingsBoard device is already established by the orchestrator (line ~5332):

```javascript
let apiRow = ingestionId ? apiDataMap.get(ingestionId) : null;
// apiRow.id === meta.ingestionId === TB SERVER_SCOPE attr 'ingestionId'
```

`lastTelemetryTs` is therefore unambiguously associated with the correct device, with no additional lookup required.

---

## Guide-Level Explanation

After this RFC is implemented:

- When a device card is rendered for a water or energy device and its Data Apps API row is available (`apiRow != null`), the offline calculation uses `apiRow.lastTelemetryTs` converted to Unix milliseconds.
- If `apiRow` is not available (device not matched, API failed), the existing fallback chain (`meta.pulsesTs`, `meta.consumptionTs`, etc.) is preserved — no regression.
- Temperature devices are unaffected: they do not use the `/totals` endpoint.
- The existing per-profile delay thresholds (RFC-0130) and short-delay bypass logic (RFC-0109) remain unchanged — only the timestamp input changes.

An operator looking at a water device card that stopped sending data 3 hours ago will now correctly see the card in the **offline** state, even if ThingsBoard still shows a recent broker timestamp for the `pulses` dataKey.

---

## Reference-Level Explanation

### 4.1 Change 1 — `createOrchestratorItem()` accepts `lastTelemetryTs` override

**File:** `MAIN_VIEW/controller.js` — function `createOrchestratorItem()` (~line 4200)

**Current code:**
```javascript
const telemetryTimestamp = isWaterDevice
  ? meta.pulsesTs || meta.waterLevelTs || meta.waterPercentageTs
  : isTempDevice
    ? meta.temperatureTs
    : meta.consumptionTs;
```

**Proposed code:**
```javascript
// RFC-0188: Prefer lastTelemetryTs from Data Apps API (more reliable than TB broker timestamps)
const apiLastTs = overrides?.lastTelemetryTs ?? null;
const telemetryTimestamp = apiLastTs ?? (
  isWaterDevice
    ? meta.pulsesTs || meta.waterLevelTs || meta.waterPercentageTs
    : isTempDevice
      ? meta.temperatureTs
      : meta.consumptionTs
);
```

`overrides.lastTelemetryTs` is `null` when `apiRow` was not available — the fallback chain behaves identically to today.

### 4.2 Change 2 — Inject `lastTelemetryTs` into overrides at call site

**File:** `MAIN_VIEW/controller.js` — inside the `fetchDomainData` item loop (~line 5401)

**Current `overrides` object (partial):**
```javascript
overrides: {
  value: getValueFromRow(apiRow),
  gatewayId: apiRow?.gatewayId || null,
  // ... other fields
}
```

**Proposed addition:**
```javascript
overrides: {
  value: getValueFromRow(apiRow),
  gatewayId: apiRow?.gatewayId || null,
  // RFC-0188: authoritative offline timestamp from ingestion backend
  lastTelemetryTs: apiRow?.lastTelemetryTs
    ? new Date(apiRow.lastTelemetryTs).getTime()   // ISO-8601 → Unix ms
    : null,
  // ... other existing fields
}
```

`new Date(isoString).getTime()` returns a Unix millisecond timestamp compatible with `isTelemetryStale()` in `src/utils/deviceStatus.js`.

### 4.3 Fallback guarantee

```
apiRow present AND lastTelemetryTs set
  → use apiRow.lastTelemetryTs (new behaviour)

apiRow present BUT lastTelemetryTs missing/null
  → overrides.lastTelemetryTs = null → falls through to meta.pulsesTs / meta.consumptionTs (existing)

apiRow absent (no match, API error)
  → overrides.lastTelemetryTs = null → falls through to meta.pulsesTs / meta.consumptionTs (existing)
```

No regression is possible for unmatched or temperature devices.

### 4.4 Timestamp conversion note

`apiRow.lastTelemetryTs` is an ISO-8601 string (e.g., `"2026-03-10T02:15:00.000Z"`). `isTelemetryStale()` expects a Unix millisecond integer. Conversion:

```javascript
new Date("2026-03-10T02:15:00.000Z").getTime()
// → 1741565700000  (valid Unix ms, always > 0, safe to use)
```

The existing guard `ts && ts > 0` in `isTelemetryStale()` remains valid.

### 4.5 Domain coverage

| Domain | API endpoint used | `lastTelemetryTs` available | RFC-0188 active |
|--------|------------------|----------------------------|-----------------|
| Water | `/water/devices/totals` | ✅ confirmed (log `001-ReturnFromDataAppsIngtesion.log`) | ✅ yes |
| Energy | `/energy/devices/totals` | ✅ expected (same API contract) | ✅ yes |
| Temperature | not using `/totals` | N/A | ❌ no change |

### 4.6 Files changed

| File | Lines affected | Nature |
|------|---------------|--------|
| `MAIN_VIEW/controller.js` | `createOrchestratorItem()` ~line 4200 | Add `apiLastTs` override read |
| `MAIN_VIEW/controller.js` | `fetchDomainData` item loop ~line 5401 | Add `lastTelemetryTs` to overrides |

No changes to `src/utils/deviceStatus.js`, `TELEMETRY/controller.js`, or `card/template-card-v5.js`.

---

## Drawbacks

- **Query window mismatch**: `lastTelemetryTs` is the timestamp of the last ingested point *within the query window* (`startTime`/`endTime` passed to the API). If the query window is `2026-03-01 → 2026-03-09` and the device sent data on `2026-03-09`, `lastTelemetryTs` reflects that — correct. However, if the window does not include today, a device that was recently active might appear stale. This is already the case with `meta.pulsesTs` (TB also only reflects data received within the widget's datasource window), so this is not a new regression.
- **Devices without `apiRow`**: Devices that have no match in the Data Apps API continue to use the ThingsBoard broker timestamp. This subset is already flagged in logs (`_hasApiData: false`) and is a pre-existing condition.

---

## Rationale and Alternatives

**Why not fix ThingsBoard datasource timestamps instead?**
The broker timestamps in TB `ctx.data` are controlled by the ThingsBoard platform and depend on the integration pipeline. Changing them would require backend changes. Reading `lastTelemetryTs` from the Data Apps API is a purely frontend change with no backend dependency.

**Why not add a new API call dedicated to this?**
The `/totals` endpoint is already called and the `apiRow` is already matched to the device. Adding `lastTelemetryTs` to the overrides costs a single `new Date(...).getTime()` call per device — zero additional HTTP requests.

**Why not update `meta` directly before calling `createOrchestratorItem()`?**
Mutating `meta` outside `buildMetadataMapFromCtxData()` would break the separation of concerns and could affect other code that reads `meta` after the loop. The `overrides` pattern is the established mechanism for enriching items at call time.

---

## Prior Art

- **RFC-0110**: Established that ThingsBoard's `connectionStatusTs` is unreliable and that domain-specific telemetry timestamps should be used instead. This RFC extends that principle one step further: the ingestion backend's own `lastTelemetryTs` is more reliable than any ThingsBoard dataKey timestamp.
- **RFC-0108**: Introduced the metadata-first enrichment pattern (`apiRow` injected into `createOrchestratorItem()` via `overrides`) that this RFC builds upon.

---

## Unresolved Questions

- **Energy API contract**: The log `001-ReturnFromDataAppsIngtesion.log` confirms `lastTelemetryTs` for the water endpoint. Before implementing the energy path, the energy API response should be verified to include the same field with the same semantics.
- **Query window boundary**: Should the offline calculation account for the fact that `lastTelemetryTs` is bounded by `endTime`? For example, if today's data has not been loaded yet (query ends yesterday), should we skip the override and fall back to ThingsBoard's timestamp? This could be resolved by comparing `lastTelemetryTs` to `endTime` and only using the override if `lastTelemetryTs` is within N hours of `endTime`.
- **Null `lastTelemetryTs` in API response**: Can the API return a row where `lastTelemetryTs` is `null` (device exists in GCDR but sent no data in the window)? If so, `null` is already handled by the fallback chain. This should be verified against the API contract.

---

## Future Possibilities

- **Extend to temperature**: If a `/temperature/devices/totals` endpoint is added to the Data Apps API with the same `lastTelemetryTs` field, the same override pattern can be applied with a one-line change.
- **Surface `lastTelemetryTs` in the Settings modal**: The Connection tab could display "Last data received by ingestion backend: 2h ago" using this field, giving operators a more accurate signal than the current ThingsBoard-based connection timestamps.
