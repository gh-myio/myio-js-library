# RFC-0189 — Temperature Offline Detection via Data Apps API (lastTelemetryTs)

- **Feature name:** `temperature-data-apps-last-telemetry-ts`
- **Start date:** 2026-03-10
- **Status:** Proposed — awaiting approval
- **Related RFCs:** RFC-0188 (lastTelemetryTs in createOrchestratorItem), RFC-0110 (Device Status Rules), RFC-0130 (Per-profile delay thresholds)
- **Affected files:**
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/settingsSchema.json`
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`

---

## Summary

Add a boolean widget setting `enableTemperatureApiDataFetch` (default `false`) that, when enabled, calls the Data Apps ingestion API **per temperature device** over a fixed **72-hour window** to derive `lastTelemetryTs` from the last entry in `consumption[]`. This value is injected into `createOrchestratorItem()` via `overrides.lastTelemetryTs` (RFC-0188), activating accurate offline detection for temperature cards.

The card displayed value is **not changed** — it remains `meta.temperature` from ThingsBoard `ctx.data` (real-time).

---

## Motivation

### Current temperature offline detection gap

Temperature devices use `meta.temperatureTs` (ThingsBoard broker timestamp for the `temperature` dataKey) as `telemetryTimestamp` in `calculateDeviceStatus()`. ThingsBoard may update this timestamp even when the ingestion backend has not received a new measurement, causing a stale device to appear **online**.

RFC-0188 introduced `overrides.lastTelemetryTs` in `createOrchestratorItem()` but temperature never sets it — `overrides.lastTelemetryTs` is always `null` for temperature devices.

### Confirmed API (from `logs/003-apiTemperatura.log`)

```
GET /api/v1/telemetry/devices/:deviceId/temperature
  ?startTime=<ISO>&endTime=<ISO>&granularity=1h&deep=0
Authorization: Bearer <jwt>
```

Response (plain array, one item per queried device):
```json
[
  {
    "id": "978a17eb-a33d-42d9-a0fb-e8d010d71490",
    "name": "TEMP. SCMS_L1_FRENTE_106D",
    "type": "temperature",
    "consumption": [
      { "timestamp": "2026-02-08T03:00:00.000Z", "value": 26.75 },
      { "timestamp": "2026-02-08T13:15:00.000Z", "value": 28.94 },
      ...
    ]
  }
]
```

`lastTelemetryTs` is derived as:
```javascript
consumption[consumption.length - 1].timestamp  // last entry = most recent data point
```

### Why 72-hour fixed window

The query window is **independent of the dashboard period** (which can span weeks or months). We need only the most recent data point to determine if the device is alive. A 72-hour window:
- Covers the 24h and 48h offline thresholds used for temperature (RFC-0130)
- Gives a buffer of 3× the strictest threshold
- Minimises response payload vs. longer windows
- `granularity=1h` provides enough resolution to detect the last active hour

---

## Guide-Level Explanation

When `enableTemperatureApiDataFetch = true`:

1. At dashboard load, after `ctx.data` is ready, the orchestrator fires one API call per temperature device (in parallel) over the last 72 hours.
2. The last entry of `consumption[]` gives the most recent timestamp the ingestion backend processed data for that device.
3. This timestamp is passed to `createOrchestratorItem()` as `overrides.lastTelemetryTs` — RFC-0188 uses it in `calculateDeviceStatus()`.
4. A temperature device that stopped sending data more than 24h ago is now correctly shown as **offline**.

The card displayed temperature value (`meta.temperature` from ThingsBoard) is unchanged.

---

## Reference-Level Explanation

### 4.1 Change 1 — `settingsSchema.json`

**Add to `properties`** (after `domainsEnabled`):
```json
"enableTemperatureApiDataFetch": {
  "title": "Enable Temperature API Fetch (offline detection)",
  "type": "boolean",
  "default": false,
  "description": "RFC-0189: When true, calls the Data Apps API per temperature device over the last 72h to derive lastTelemetryTs for accurate offline detection (RFC-0188). One HTTP call per device at each data load. Enable for customers whose temperature devices are integrated into the Data Apps pipeline."
}
```

**Add to `form` array** (after `domainsEnabled.temperature`):
```json
"enableTemperatureApiDataFetch"
```

### 4.2 Change 2 — `controller.js`: read the flag

In the `widgetSettings` population block (~line 1194):
```javascript
// RFC-0189: Temperature API fetch for offline detection
widgetSettings.enableTemperatureApiDataFetch =
  self.ctx.settings?.enableTemperatureApiDataFetch ?? false;
```

### 4.3 Change 3 — `controller.js`: temperature branch

**Current code** (~line 4832) — no API call, returns early:
```javascript
if (domain === 'temperature') {
  // ... build items from ctx.data only ...
  return items;
}
```

**Proposed code:**
```javascript
if (domain === 'temperature') {
  const useApi = widgetSettings.enableTemperatureApiDataFetch ?? false;

  const ctxDataReady = await waitForCtxData(20000, 200, domain, period);
  if (!ctxDataReady) {
    LogHelper.warn('[Orchestrator] ⚠️ ctx.data not ready for temperature');
    return [];
  }

  const { byEntityId: metadataByEntityId } = buildMetadataMapFromCtxData(domain);
  if (metadataByEntityId.size === 0) return [];

  // RFC-0189: Per-device API calls over the last 72h to derive lastTelemetryTs
  // Key: ingestionId → Unix ms timestamp of last consumption entry
  const apiTsMap = new Map();

  if (useApi) {
    try {
      const token = await getToken();

      // Fixed 72-hour window — independent of the dashboard period
      const endTime   = new Date().toISOString();
      const startTime = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

      const devicesWithIngestionId = [...metadataByEntityId.values()]
        .filter((meta) => !!meta.ingestionId);

      LogHelper.log(
        `[Orchestrator] 🌡️ RFC-0189: Fetching temperature API for ${devicesWithIngestionId.length} devices (last 72h)`
      );

      const results = await Promise.allSettled(
        devicesWithIngestionId.map(async (meta) => {
          const url = new URL(
            `${DATA_API_HOST}/api/v1/telemetry/devices/${meta.ingestionId}/temperature`
          );
          url.searchParams.set('startTime', startTime);
          url.searchParams.set('endTime', endTime);
          url.searchParams.set('granularity', '1h');
          url.searchParams.set('deep', '0');

          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return null;

          const json = await res.json();
          const rows = Array.isArray(json) ? json : [];
          const row  = rows.find((r) => r.id === meta.ingestionId) || rows[0] || null;

          if (!row || !Array.isArray(row.consumption) || row.consumption.length === 0) {
            return null;
          }

          // Last entry = most recent data point from ingestion backend
          const lastEntry      = row.consumption[row.consumption.length - 1];
          const lastTelemetryTs = lastEntry?.timestamp
            ? new Date(lastEntry.timestamp).getTime()
            : null;

          return lastTelemetryTs ? { ingestionId: meta.ingestionId, lastTelemetryTs } : null;
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          apiTsMap.set(result.value.ingestionId, result.value.lastTelemetryTs);
        }
      }

      LogHelper.log(
        `[Orchestrator] 🌡️ RFC-0189: lastTelemetryTs resolved for ${apiTsMap.size}/${devicesWithIngestionId.length} devices`
      );
    } catch (err) {
      LogHelper.warn('[Orchestrator] 🌡️ RFC-0189: Temperature API fetch failed:', err.message);
      // apiTsMap stays empty → all devices fall back to meta.temperatureTs
    }
  }

  const items = [];
  for (const [entityId, meta] of metadataByEntityId.entries()) {
    const temperatureValue = Number(meta.temperature || 0);
    const tempOffset       = Number(meta.offSetTemperature || 0);

    // RFC-0189: inject lastTelemetryTs from API when available
    const lastTelemetryTs = meta.ingestionId ? (apiTsMap.get(meta.ingestionId) ?? null) : null;

    items.push(
      createOrchestratorItem({
        entityId,
        meta,
        overrides: {
          label:             meta.label || meta.identifier || 'Sensor',
          entityLabel:       meta.label || meta.identifier || 'Sensor',
          name:              meta.label || meta.identifier || 'Sensor',
          value:             temperatureValue,   // unchanged — real-time from ctx.data
          temperature:       temperatureValue,
          deviceType:        meta.deviceType || 'TERMOSTATO',
          offSetTemperature: tempOffset,
          lastTelemetryTs,  // RFC-0189 + RFC-0188: null when API unavailable (graceful fallback)
        },
      })
    );
  }

  populateStateTemperature(items);
  LogHelper.log(
    `[Orchestrator] 🌡️ Temperature items: ${items.length}` +
    (useApi ? ` | API ts enriched: ${apiTsMap.size}` : ' | ctx.data only')
  );
  return items;
}
```

### 4.4 `lastTelemetryTs` derivation

```
API window:  now - 72h  →  now
granularity: 1h

consumption[] sorted ascending by timestamp.
lastEntry = consumption[consumption.length - 1]
lastTelemetryTs = new Date(lastEntry.timestamp).getTime()  // Unix ms

→ passed to createOrchestratorItem({ overrides: { lastTelemetryTs } })
→ RFC-0188 reads it as: const apiLastTs = overrides?.lastTelemetryTs ?? null;
→ calculateDeviceStatus() uses it as telemetryTimestamp for isTelemetryStale()
```

### 4.5 Fallback guarantee

```
enableTemperatureApiDataFetch = false (default)
  → identical to today — no API, ctx.data only, lastTelemetryTs = null

useApi = true, device has ingestionId, API returns consumption[]
  → lastTelemetryTs = consumption[last].timestamp (Unix ms)
  → offline detection active (RFC-0188 + RFC-0110)

useApi = true, device has no ingestionId
  → skipped — lastTelemetryTs = null → falls back to meta.temperatureTs (existing)

useApi = true, API returns empty consumption[] (no data in 72h)
  → null → falls back to meta.temperatureTs
  → device correctly detected as offline (no recent data in either source)

useApi = true, API call fails (network, auth, 5xx)
  → Promise.allSettled absorbs → lastTelemetryTs = null → graceful fallback
```

### 4.6 Call pattern and performance

- All device calls fired via `Promise.allSettled()` — maximum parallelism
- Fixed 72h window with `granularity=1h` → at most 72 data points per device per response (lightweight)
- For a typical shopping mall deployment (20–60 temperature sensors): 20–60 concurrent requests
- `Promise.allSettled` ensures a single device failure does not abort the rest

### 4.7 Files changed

| File | Change |
|------|--------|
| `settingsSchema.json` | Add `enableTemperatureApiDataFetch` property + form entry |
| `controller.js` | Read flag; rewrite temperature branch with parallel per-device calls + `lastTelemetryTs` injection |

No changes to `src/utils/deviceStatus.js`, `TELEMETRY/controller.js`, or card templates — RFC-0188 already handles the downstream.

---

## Drawbacks

- **N parallel HTTP requests**: One call per temperature device per data load. No bulk endpoint exists for temperature. For deployments with many temperature sensors, this can be significant — mitigated by `Promise.allSettled` parallelism and the lightweight 72h/1h response.
- **Card value unchanged**: The displayed temperature remains `meta.temperature` from ThingsBoard. If the ingestion backend has more recent data than ctx.data, the card value will not reflect it — but this is out of scope for this RFC.
- **`consumption[]` empty in 72h window**: A device that has not sent any data in the last 72 hours returns `null` from the API — `lastTelemetryTs` will be `null`. The fallback to `meta.temperatureTs` applies, which may also be stale. In practice, a device silent for 72h should already be detected as offline via either source.

---

## Rationale and Alternatives

**Why 72 hours and not the dashboard period?**
The dashboard period can span weeks or months, generating large `consumption[]` arrays. The goal is only to find the most recent timestamp — 72h covers 3× the strictest offline threshold (24h) with minimal payload.

**Why `granularity=1h` and not `1d`?**
With `1d`, if a device sent its last data point at 10:00 and the query runs at 23:00, the last daily bucket's timestamp would be `03:00` of that day — 20 hours of apparent staleness that is not real. Hourly granularity gives a `lastTelemetryTs` accurate to within one hour, which is acceptable for 24h threshold detection.

**Why not a dedicated bulk endpoint?**
No bulk temperature endpoint exists in the Data Apps API at the time of writing. If one is added in the future (see Future Possibilities), this per-device pattern can be replaced with a single call — reducing the N-calls drawback to zero.

---

## Prior Art

- **RFC-0188**: Defined `overrides.lastTelemetryTs` in `createOrchestratorItem()` for energy and water. This RFC activates the same mechanism for temperature.
- **RFC-0110**: Established that domain-specific telemetry timestamps are more reliable than ThingsBoard broker timestamps for offline detection.
- **`logs/003-apiTemperatura.log`**: Confirmed the per-device endpoint, response shape (`consumption[]`), and field names used in this RFC.

---

## Unresolved Questions

- **Token authorization**: Does the same Data Apps JWT (used for energy/water) authorize `/devices/:id/temperature`? Assumed yes — must be verified before implementation.
- **Rate limits**: Can the API handle 60 concurrent requests without throttling? A concurrency limiter (e.g., batches of 10) may be needed for large deployments.
- **`deep=0` vs `deep=1`**: Does `deep=1` return additional fields useful beyond `consumption[]`? The log uses `deep=0` which is sufficient for this RFC.

---

## Future Possibilities

- **Bulk temperature endpoint**: If `GET /api/v1/telemetry/customers/:id/temperature/devices/totals` is added, replace N per-device calls with one bulk call — identical pattern to energy/water. The `overrides.lastTelemetryTs` injection stays unchanged.
- **Concurrency limiter**: For deployments with 100+ temperature sensors, add a `p-limit`-style batch control to cap concurrent requests.
