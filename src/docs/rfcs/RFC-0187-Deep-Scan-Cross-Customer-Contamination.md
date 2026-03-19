# RFC-0187 — Deep Scan: Cross-Customer GCDR Contamination Detection

- **Feature name:** `deep-scan-cross-customer-contamination`
- **Start date:** 2026-03-09
- **Status:** Proposed
- **Related RFCs:** RFC-0186 (GCDR Sync), RFC-0183 (AlarmServiceOrchestrator)
- **Affected widget:** `src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/controller.js`
- **API reference:** `src/docs/rfcs/RFC-0187-Check-Review-Fix-GCDR-Sync-DevicesSearch.md`

---

## Summary

Extend the existing **Raio X** diagnostic modal in the GCDR-Upsell-Setup widget with a **Phase 4 deep scan** that detects devices belonging to customer *A* that were erroneously created under customer *B* in the GCDR system due to a bug in the sync routine. The scan uses the tenant-scoped GCDR device search API (`GET /api/v1/devices`) without a `customerId` filter to perform a global lookup by `externalId` (ThingsBoard device UUID) and cross-check the returned GCDR `customerId` against the expected one.

---

## Motivation

A production incident revealed that at least one device from customer **Montserrat** was created inside customer **Mestre Álvaro** in the GCDR database. The exact failure mode is unknown, but the consequence is real:

- Alarms for the contaminated device are routed to the wrong customer.
- The GCDR sync routine reinforces the incorrect association on every run because it finds the device "already synced" by `externalId` match.
- The current Raio X (Phases 0–3) cannot detect this class of bug: it fetches the selected customer's bundle via `GET /api/v1/customers/external/:tbCustomerId?deep=1`, which already filters by customer on the server side. A cross-customer contaminated device is invisible to this scope.

ThingsBoard is the authoritative source of truth. Every GCDR device must satisfy:

```
gcdrDevice.customerId === customer.gcdrCustomerId  (for the TB customer that owns the TB device)
```

Any device where this invariant is violated is a **contaminated device** and must be flagged for manual review or automatic remediation.

---

## Guide-Level Explanation

When an operator opens the **Raio X** modal for a customer and the existing Phases 0–3 complete successfully, a new **Phase 4 — Cross-Customer Deep Scan** runs automatically:

1. The widget collects all TB devices for the selected customer that have a `gcdrDeviceId` stored in their `SERVER_SCOPE` attribute.
2. For each device, it calls the GCDR search API using the TB device UUID as `externalId` **without** scoping to a customer:
   ```
   GET /api/v1/devices?externalId=<tbDeviceUUID>
   X-API-Key: gcdr_myio_tenant_bundle_key_2026
   X-Tenant-ID: <gcdrTenantId>
   ```
3. If the API returns a device whose `customerId` differs from `gcdrCustomerId` of the selected customer, it is flagged as **`CONTAMINATED`**.
4. Devices with no GCDR record at all (never synced) are flagged as **`ORPHAN`** and are already handled by Phase 3. Phase 4 focuses solely on cross-customer misplacement.
5. The report is rendered as a new **"⚠ Deep Scan"** tab in the Raio X results, listing contaminated devices with:
   - TB device name, TB UUID
   - Expected GCDR customer ID (`gcdrCustomerId` from SERVER_SCOPE of the TB customer)
   - Actual GCDR customer ID (from the API response)
   - GCDR device ID
   - Suggested remediation action

An operator can export the deep scan results together with the existing log via the **Download Log** button.

---

## Reference-Level Explanation

### 4.1 API Used

The GCDR device search endpoint (documented in `RFC-0187-Check-Review-Fix-GCDR-Sync-DevicesSearch.md`) accepts `externalId` as an exact-match filter and, when `customerId` is omitted, returns devices across **all customers visible to the API key**:

```
GET /api/v1/devices?externalId=<tbDeviceUUID>
```

Key fields in the response item used by the deep scan:

| Field        | Usage                                                      |
|--------------|------------------------------------------------------------|
| `id`         | GCDR device UUID — compared to `gcdrDeviceId` in TB scope  |
| `customerId` | GCDR customer UUID — must equal `gcdrCustomerId` of the TB customer |
| `externalId` | Must match the TB device UUID used in the query            |
| `name`       | Display in the report                                      |
| `assetId`    | Cross-check against the expected GCDR asset                |

### 4.2 Algorithm

```
Phase 4 input:
  tbDevices[]        — all TB devices for the selected customer (from Phase 0 tree)
  gcdrCustomerId     — expected GCDR customer UUID (from SERVER_SCOPE on TB customer)
  gcdrTenantId       — X-Tenant-ID header value
  apiKey             — gcdr_myio_tenant_bundle_key_2026 (tenant-wide key, not customer-scoped)

Phase 4 output:
  deepReport[] — one entry per TB device checked, status ∈ {OK, CONTAMINATED, NOT_FOUND, ERROR}

for each tbDevice in tbDevices:
  if tbDevice has no gcdrDeviceId in SERVER_SCOPE:
    skip — already handled in Phase 3 as NEW/SKIPPED

  result = GET /api/v1/devices?externalId={tbDevice.id}
             (X-API-Key: apiKey, X-Tenant-ID: gcdrTenantId)

  if result.items is empty:
    status = NOT_FOUND   — gcdrDeviceId stored in TB points to a deleted/missing GCDR record
  else:
    gcdrDevice = result.items[0]
    if gcdrDevice.customerId !== gcdrCustomerId:
      status = CONTAMINATED
      record { tbDevice, gcdrDevice.customerId (actual), gcdrCustomerId (expected) }
    else:
      status = OK
```

**Rate limiting**: requests are sequential with a 50 ms micro-delay between calls to avoid hammering the API. For customers with > 200 devices, a progress bar is shown (reusing the existing `renderProgress` helper).

### 4.3 Severity Classification

| Status        | Meaning                                                                 | Action            |
|---------------|-------------------------------------------------------------------------|-------------------|
| `OK`          | GCDR device is in the correct customer                                  | None              |
| `CONTAMINATED`| GCDR device exists but under the wrong customer                         | Manual fix or auto-remediation via RFC-0188 |
| `NOT_FOUND`   | `gcdrDeviceId` in TB points to a GCDR device that does not exist globally | Re-sync required |
| `ERROR`       | API call failed (network, 5xx)                                          | Retry             |

### 4.4 Report UI

The Raio X modal results gain a second tab — **"⚠ Deep Scan"** — shown only when Phase 4 finishes. The tab renders a filterable table:

```
[ Status ] [ TB Device ]        [ Expected Customer ]  [ Actual Customer ]  [ GCDR Device ID ]
  ✅ OK      3F ELEV. AC2         e04046d4…              e04046d4…            9048c4da…
  🔴 CONTA…  HIDROMETRO-B7        e04046d4…              f10209a1…  ⚠        7a3bc091…
  ❓ NOT FND  FANCOIL-12           e04046d4…              —                    —
```

Contaminated rows include a **"Copy Fix Payload"** button that copies a JSON patch payload to the clipboard, ready to be applied via `PATCH /api/v1/devices/:gcdrDeviceId` to move the device to the correct customer.

### 4.5 Log Export Extension

The existing `buildRaioXLog` function is extended to append a `--- PHASE 4: DEEP SCAN ---` section listing all contaminated and not-found devices.

### 4.6 API Key

Phase 4 requires **tenant-wide read access** — the existing `gcdrApiKey` (stored in `SERVER_SCOPE` on the TB customer, e.g., `gcdr_myio_tenant_bundle_key_2026`) is sufficient. No new credential is introduced. The key is already available as the module-level `gcdrApiKey` variable in the controller.

### 4.7 Files Changed

| File | Change |
|------|--------|
| `src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/controller.js` | Add `guDeepScanCrossCustomer()`, extend `openGCDRRaioXModal()` async IIFE with Phase 4, extend `renderReport()` with Deep Scan tab, extend `buildRaioXLog()` |

No library (`src/components/`) changes required — this is a self-contained widget feature.

---

## Drawbacks

- **N+1 API calls**: Phase 4 makes one HTTP request per TB device. For a customer with 300 devices, this is up to 300 sequential requests. The 50 ms delay means ~15 seconds of scan time at the high end. Acceptable for a diagnostic tool that runs manually.
- **API availability dependency**: If the GCDR search endpoint is unavailable, Phase 4 fails gracefully and shows the existing Phase 0–3 report with an error banner for Phase 4.
- **False `NOT_FOUND` on recently deleted devices**: A device deleted from GCDR but still carrying a stale `gcdrDeviceId` in TB's `SERVER_SCOPE` would appear as `NOT_FOUND`, which is a real data integrity issue, not a false positive.

---

## Rationale and Alternatives

**Why extend Raio X rather than create a new widget/button?**
Raio X already has the TB tree, the GCDR bundle, and the customer context loaded. Phase 4 reuses all of that context at zero additional setup cost. A standalone tool would replicate all of Phase 0–1 overhead.

**Why `?externalId=` and not fetching the device by its `gcdrDeviceId`?**
`GET /api/v1/devices/:gcdrDeviceId` would return the device but the response already carries `customerId`. The difference is: using `externalId` lets us find devices where the `gcdrDeviceId` stored in TB is *wrong* (stale, or pointing to a deleted record), while searching by `externalId` finds the *actual* current GCDR record for that TB device UUID — which may be in a completely different customer.

**Why not read all customer bundles and cross-reference in memory?**
Fetching all customer bundles is an O(customers) operation and each bundle is potentially megabytes of JSON. The per-device `?externalId=` lookup is O(devices) but each response is tiny. For a tenant with 50+ customers the bundle approach would be significantly slower and memory-intensive.

---

## Prior Art

- **RFC-0186** (GCDR Sync): Established the "TB is source of truth" principle and the current Phase 0–3 analysis pipeline that this RFC extends.
- **RFC-0183** (AlarmServiceOrchestrator): Showed the pattern of cross-referencing TB device IDs with GCDR data in the frontend without a dedicated backend reconciliation service.
- The GCDR search endpoint is documented in `RFC-0187-Check-Review-Fix-GCDR-Sync-DevicesSearch.md` and supports the `externalId` exact-match filter required by this approach.

---

## Unresolved Questions

- **Should Phase 4 run automatically after Phase 3, or require an explicit "Run Deep Scan" button click?** A button may be preferable to avoid surprising operators with 300 extra API requests on every Raio X run. A reasonable default: show a banner after Phase 3 with "⚠ Run Deep Scan to detect cross-customer contamination" and an explicit button.
- **What is the root cause of the Montserrat → Mestre Álvaro contamination?** The sync routine (`openGCDRSyncInlineModal`) matches TB devices to GCDR by `externalId` as a fallback (line 3222 in current controller). If two customers share a central/gateway and a device was temporarily associated with the wrong customer in TB at sync time, the externalId match would persist the wrong `customerId`. This needs separate investigation (RFC-0188).
- **Remediation: should the widget offer a one-click fix (PATCH)?** Scoped to a separate RFC-0188 to keep this RFC focused on detection only.
- **Pagination in Phase 4 search results**: The `?externalId=` query should return exactly 0 or 1 results. If it returns > 1, that itself is a data integrity anomaly (duplicate `externalId` across multiple GCDR records) and should be flagged as a separate `DUPLICATE` status.

---

## Future Possibilities

- **RFC-0188 — Auto-Remediate Cross-Customer Contamination**: After operator confirmation, issue `PATCH /api/v1/devices/:gcdrDeviceId` with the correct `customerId` and trigger a TB `SERVER_SCOPE` write to update `gcdrDeviceId` if the device was re-created under the correct customer ID.
- **Scheduled/background reconciliation**: Run Phase 4 as a nightly background job dispatched by Node-RED, storing results in a TB telemetry key `gcdrSyncDriftReport`, surfaced as a dashboard alert.
- **Extend to Assets**: Apply the same cross-customer check to assets (`GET /api/v1/assets?externalId=<tbAssetUUID>`), since the same sync bug that misplaces devices could theoretically misplace assets.
