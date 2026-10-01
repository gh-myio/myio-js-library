# RFC: Manual Temperature Override for Tabela_Temp_V5

- **Feature Name:** `manual_temperature_override`
- **Widget:** `Tabela_Temp_V5` — Smart Hospital Temperature Monitoring
- **Status:** Accepted
- **Author:** MYIO Platform Team
- **Created:** 2026-04-02

---

## Summary

Introduce a customer-scoped SERVER_SCOPE attribute (`manualTempOverrides`) that stores manual temperature readings for CO2-monitored devices. These overrides are applied at report-generation time to replace missing, absent, or sentinel values (`-`, `=`, `SEM DADOS`, `17,00` sentinel) with administrator-supplied real measurements. A dedicated pure-JS modal (following the existing summary modal pattern) provides full CRUD management of the stored overrides.

---

## Motivation

The temperature monitoring system at Hospital Municipal Souza Aguiar (HMSA) periodically experiences sensor disconnections and central failures (see: `ANALISE-RELATORIO-MARCO-2026.md`). During these windows, the API returns `SEM DADOS`, `-`, `=`, or the hardware sentinel `17,00°C` instead of real readings.

In many cases, staff maintained physical temperature logs during the outage. The current system has no way to inject these verified manual readings into the generated report, forcing the institution to submit incomplete regulatory documents or annotate them manually after export.

This RFC defines the data model and UI workflow to close that gap: allow an authorized administrator to inject verified temperature values for specific device/timestamp combinations, which are then seamlessly applied before report generation.

---

## Guide-Level Explanation

### From the user's perspective

An admin opens the **Manual Temperature Override** modal from the widget header (admin-only button, visible only when `adminMode = true`).

**Workflow A — Add a new manual value:**

1. **Select device** — choose from the list of CO2 devices (populated from `ctx.datasources` filtered by `aliasName === 'CO2 Devices'`). Displays `entityLabel` (human-readable, e.g. `CTI 03`) alongside the technical name.
2. **Select datetime range** — start datetime and end datetime (date picker + 30-minute time picker each), displayed in BRT (UTC−3). The system expands the range into all 30-minute slot boundaries within it and presents them as a list. Each slot has an individual value input. A **"Fill all with same value"** button opens a small inline modal where the admin enters one number that populates all slots at once.
3. **Conflict check** — the system checks whether `manualTempOverrides` already exists in SERVER_SCOPE and whether any chosen slot is already overridden.
   - If no conflict → proceed to step 4.
   - If conflict → show the existing value, offer **Overwrite** or **Back**.
4. **Summary** — show a read-only summary: device label, datetime (BRT), value, and what existing slot value will be replaced.
5. **Confirmation** — save to SERVER_SCOPE. Offer **Add another** or **Close**.

**Workflow B — Browse and edit existing overrides:**

The modal opens in list view (same expand/collapse pattern as the summary modal):
- One row per device that has overrides, collapsible.
- Expanded row shows a table: `Datetime (BRT)` | `Value (°C)` | `[Edit]` `[Delete]`.
- **Edit** opens an inline form for that slot.
- **Delete** asks for confirmation, then removes the slot (and the device entry if no slots remain).

**At report generation time:**

Before the widget renders data, it loads the override map and applies it: any slot for a matching `deviceCentralName` + `timeUTC` that holds `-`, `=`, `SEM DADOS`, or the sentinel `17,00` is replaced with the manually provided value. A visual indicator (e.g. a `[M]` badge in admin mode) marks overridden slots in the rendered table.

---

## Reference-Level Explanation

### 1. SERVER_SCOPE Attribute Schema

**Attribute key:** `manualTempOverrides`
**Stored on:** Customer entity (`self.ctx.currentUser.customerId`)

```json
{
  "device_list_interval_values": [
    {
      "tbName": "Co2_CTI_03 (Souza Aguiar CO2)",
      "tbLabel": "CTI 03",
      "deviceCentralName": "Co2_CTI_03",
      "values_list": [
        {
          "timeUTC": "2026-03-02T07:30:00.000Z",
          "value": 16.77
        },
        {
          "timeUTC": "2026-03-02T08:00:00.000Z",
          "value": 16.77
        }
      ]
    }
  ],
  "createdBy": "usuario@email.com",
  "createdDateTime": "2026-04-02 10:30:00",
  "updatedBy": "usuario@email.com",
  "updatedDateTime": "2026-04-02 11:00:00",
  "version": 1
}
```

#### Field definitions

| Field | Type | Description |
|---|---|---|
| `device_list_interval_values` | `Array` | One entry per device that has manual overrides |
| `tbName` | `string` | Full ThingsBoard device name (`entityName`) |
| `tbLabel` | `string` | Human-readable label (`entityLabel`) |
| `deviceCentralName` | `string` | Name as it appears in central API `deviceName` field — used for slot matching |
| `values_list` | `Array` | List of overridden slots for this device |
| `values_list[].timeUTC` | `ISO 8601 string` | Slot timestamp in UTC. Must match the central API `time_interval` field exactly |
| `values_list[].value` | `number` | Temperature in °C, up to 2 decimal places |
| `createdBy` | `string` | Email of the user who first created the attribute |
| `createdDateTime` | `string` | BRT datetime string (`YYYY-MM-DD HH:mm:ss`) of first creation |
| `updatedBy` | `string` | Email of the user who last modified the attribute |
| `updatedDateTime` | `string` | BRT datetime string of last modification |
| `version` | `integer` | Monotonically increasing counter, incremented on every save |

#### Notes on `timeUTC` matching

The central API returns two time fields per record:
- `reading_date` — the raw sensor timestamp (may have timezone offset issues)
- `time_interval` — the normalized 30-minute slot boundary in UTC

**Match must be performed against `time_interval`**, as this is the canonical slot identifier used throughout the data pipeline. The stored `timeUTC` must equal `time_interval` exactly (string comparison after `.trim()`).

---

### 2. Device List Population

The device list for step 1 is built in-memory from `self.ctx.datasources`:

```javascript
const co2Devices = self.ctx.datasources
  .filter(ds => ds.aliasName === 'CO2 Devices')
  .map(ds => ({
    tbName:           ds.entityName,
    tbLabel:          ds.entityLabel,
    deviceCentralName: ds.entityName.split(' ')[0], // "Co2_CTI_03 (Souza Aguiar CO2)" → "Co2_CTI_03"
  }));
```

Displayed to the user as `tbLabel` (e.g. `CTI 03`), sorted alphabetically. The technical `deviceCentralName` is used internally for JSON storage and matching.

---

### 3. Datetime Handling

| Layer | Format | Example |
|---|---|---|
| User input | BRT `DD/MM/YYYY HH:mm` | `01/03/2026 00:00` |
| Internal storage | UTC ISO 8601 | `2026-03-01T03:00:00.000Z` |
| Display in list view | BRT `DD/MM/YYYY HH:mm` | `01/03/2026 00:00` |

Conversion: `UTC = BRT + 3h`. Time picker enforces 30-minute granularity (00 or 30 minutes only) to match the monitoring grid.

---

### 4. Step 2 — Datetime Range Input

The step shows two datetime pickers (date + 30-minute time each):

```
Start: [02/03/2026 ▾] [03:30 ▾]
End:   [02/03/2026 ▾] [09:00 ▾]
```

On **"Next"**, the system expands the range into every 30-minute slot boundary in `[start, end)` and renders a slot list:

```
Slot               Value (°C)
──────────────────────────────
02/03/2026 03:30   [______]
02/03/2026 04:00   [______]
02/03/2026 04:30   [______]
...
02/03/2026 08:30   [______]

[ Fill all with same value ]   ← opens mini-modal with one numeric input
```

**"Fill all with same value"** mini-modal:

```
Enter value for all 12 slots:
[ ______ ] °C
[ Cancel ]  [ Apply ]
```

On Apply, the value populates all empty inputs in the list. The admin can still override individual slots after applying.

> **Slot boundary rule:** slots are generated as `[start, end)` — the start slot is included, the end slot is excluded. Example: start 03:30, end 09:00 → slots 03:30 … 08:30 (12 slots).

> **Empty value validation:** all slots must have a numeric value before proceeding to Step 3 (conflict check). Any empty slot highlights in red.

---

### 5. Conflict Resolution

Before committing, the system loads the current `manualTempOverrides` attribute (if it exists) and checks each slot in the range:

```
for each slot in range:
  existing entry for deviceCentralName + timeUTC ?
    YES → mark slot as CONFLICT (show existing value alongside new value)
    NO  → mark slot as NEW

if any CONFLICTs exist:
  show conflict review panel:
    table: Datetime (BRT) | Existing Value | New Value | Status (NEW / OVERWRITE)
    buttons: [← Back] [Confirm & Save]
else:
  proceed directly to step 4 (summary)
```

The admin reviews the conflict table and can go back to adjust values. Clicking **Confirm & Save** overwrites conflicting slots with the new values.

---

### 6. Override Application in `getData()`

After fetching central API data and before building the display rows, the following logic is applied:

```javascript
// Load override map: Map<deviceCentralName, Map<timeUTC, value>>
const overrideMap = buildOverrideMap(manualOverrideAttribute);

for (const row of allRows) {
  const isMissing = row.value === 'SEM DADOS'
    || row.value === '-'
    || row.value === '='
    || parseFloat(row.value) === 17.0; // sentinel

  if (isMissing) {
    const deviceMap = overrideMap.get(row.deviceName);
    const override  = deviceMap?.get(row.time_interval);
    if (override !== undefined) {
      row.value       = override;
      row.isManual    = true; // for [M] badge in admin mode
    }
  }
}
```

The `isManual` flag is used exclusively for the admin-mode visual indicator. It does not affect export output.

---

### 7. Access Control — Button Visibility

The manual override button is rendered **only for MyIO internal users**. The check mirrors the `SuperAdmin` detection pattern used in `MAIN_VIEW/controller.js`:

```javascript
const _isMyIOAdmin = (function() {
  const email = self.ctx.currentUser?.email || '';
  return email.endsWith('@myio.com.br')
    && !email.startsWith('alarme@')
    && !email.startsWith('alarmes@');
})();
```

The button is injected into the widget header only when `_isMyIOAdmin === true`. It is never rendered for customer-facing users, regardless of `adminMode`.

`self.ctx.currentUser.email` is used directly (available in ThingsBoard widget context) — no dependency on `window.MyIOUtils.SuperAdmin`, which requires the `MAIN_VIEW` widget to be present on the same dashboard.

---

### 9. Modal Architecture

Follows the existing pure-JS modal pattern (`_smOpenModal` / `document.body.appendChild`):

| Element | ID |
|---|---|
| Backdrop | `tbtv5-mo-bd` |
| Modal container | `tbtv5-mo` |
| Inner content | dynamically replaced via `modal.innerHTML` |

CSS injected into `document.head` once (same guard pattern as summary modal). `z-index: 2147483647`.

State machine:

```
STEP_DEVICE → STEP_DATETIME → STEP_CONFLICT? → STEP_SUMMARY → STEP_DONE
                                    ↓ back ↗
LIST_VIEW (browse/edit/delete)
```

Global window functions exposed:
- `window.tbtv5_mo_open()` — opens modal in wizard mode
- `window.tbtv5_mo_openList()` — opens modal in list/browse mode
- `window.tbtv5_mo_close()`

---

### 10. Save / Versioning

On every write to SERVER_SCOPE:
- If creating: `version = 1`, `createdBy/DateTime` = current user + BRT now
- If updating: `version += 1`, `updatedBy/DateTime` = current user + BRT now
- `createdBy/DateTime` is never modified after first write

User email sourced from `self.ctx.currentUser.email`.

---

## Drawbacks

- The attribute can grow large if many devices/slots are overridden across multiple months. ThingsBoard SERVER_SCOPE attributes have a default size limit. A future cleanup/archive mechanism may be needed.
- Manual overrides require administrator discipline: an incorrectly entered value is indistinguishable from a real measurement in the exported CSV/PDF (except for the `[M]` badge in admin mode).
- The `17,00` sentinel detection is a heuristic — a real reading of exactly 17.00°C would also be eligible for override if a manual entry exists for that slot. This is acceptable: admins must enter a value to trigger an override; the sentinel alone does not overwrite.

---

## Rationale and Alternatives

### Why SERVER_SCOPE on the customer entity?

Consistent with how `tempClampMin`/`tempClampMax` are stored. Customer-scoped attributes survive widget upgrades and dashboard migrations. Device-scoped storage was considered but would require one attribute per device — unmanageable at scale.

### Why a wizard modal instead of an inline table editor?

The summary modal pattern is already proven working in this widget (escaped `transform` containing block, CSS injection, body append). An inline editor would require Angular bindings on dynamically generated rows, which breaks after `body.appendChild`. The wizard is fully pure-JS and avoids this constraint.

### Why match against `time_interval` and not `reading_date`?

`reading_date` has been observed to carry timezone inconsistencies across firmware versions (see UTC−3h offset bug fixed in widget v3.1.1). `time_interval` is the normalized, pipeline-canonical slot boundary and is consistently UTC. It is the correct join key.

---

## Design Decisions (Resolved)

All design questions were resolved before implementation. Decisions recorded here for traceability.

| # | Question | Decision |
|---|----------|----------|
| 1 | Step 2 scope — single slot, range, or two independent slots? | **Range (option b):** start + end datetime; system expands all 30-min slots; slot list with individual value inputs + "Fill all with same value" button |
| 2 | `slave_id` field | **Removed.** Field dropped from schema entirely — not needed for override logic or matching |
| 3 | Match key for override application | **`time_interval`** — canonical UTC slot boundary; `reading_date` excluded due to known timezone inconsistencies across firmware versions |
| 4 | Attribute key name | **`manualTempOverrides`** — shorter, preferred over `device_manual_temperature_interval_values` |
| 5 | Bulk range behavior | **Show all slots as a list.** "Fill all with same value" button opens mini-modal → single numeric input → populates all slots. Admin can still override individual slots after bulk fill. |
| 6 | Attribute size management | No constraint enforced at this time. To be revisited based on observed usage. |

---

## Future Possibilities

- **Bulk import via CSV:** Allow an admin to upload a CSV matching the export format, with manual values pre-filled, and batch-import all overrides at once.
- **Audit log:** Store a separate `device_manual_temperature_audit_log` attribute with a history of all changes (who changed what, when, and what the previous value was).
- **Override expiry:** Each `values_list` entry could carry an optional `expiresAt` field, after which the override is ignored and the original sentinel is shown again.
- **Cross-widget sharing:** If other hospital monitoring widgets adopt the same attribute schema and key name, the same overrides could be applied across multiple report types automatically.
