# RFC-0184 — Check & Fix Routine

- **Feature Name**: `check_and_fix_routine`
- **Status**: Proposed
- **Date**: 2026-02-26
- **Branch**: `fix/rfc-0152-real-data`
- **Target file**: `src/components/premium-modals/upsell/openUpsellModal.ts` (Step 2)
- **Also surfaces in**: `src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/controller.js`

---

## Summary

Add a **CHECK & FIX** button to Step 2 of the GCDR-Upsell-Setup widget (RFC-0109). When triggered,
the button performs a full diagnostic scan ("raio x") over every device belonging to the selected
customer. It infers the expected `deviceType` and `deviceProfile` values from each device name,
fetches the real production attributes from ThingsBoard, compares them, and renders a structured
report panel inline—directly below the Step 2 device grid.

In v1.0.0 only the **CHECK** phase is implemented. The **FIX** phase (write-back to ThingsBoard) is
fully specified here for design completeness but is intentionally deferred.

---

## Motivation

The GCDR-Upsell-Setup widget lets operators inspect and configure devices per customer, but Step 2
currently provides no automated way to verify whether `deviceType` and `deviceProfile` server-scope
attributes are correctly populated across all devices in a customer.

Without this capability:

- Operators must audit devices manually, one by one, in ThingsBoard.
- Mis-configured devices silently fall through classification logic (RFC-0111, RFC-0128), causing
  incorrect KPI aggregation, missing alarm bindings, and wrong group placement.
- There is no single view that shows the gap between the "expected" state (derived from device names)
  and the "actual" production state.

The Check & Fix Routine provides that single view as a reproducible, on-demand diagnostic tool.

---

## Guide-level explanation

### User flow

1. Operator selects a customer in Step 1 and proceeds to Step 2.
2. The device grid loads. A new **[CHECK & FIX]** button appears in the Step 2 header row.
3. Operator clicks **[CHECK & FIX]**.
4. A loading indicator replaces the button label while the scan runs.
5. The scan completes and an inline report panel appears below the device grid.
6. The panel shows a summary row (total devices, how many are `ok`, `mismatch`, `missing`, `undefined`)
   and an expandable per-device table.

### ASCII mockup — Step 2 with report panel

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Devices                          [CHECK & FIX]  [← Back]  │
├─────────────────────────────────────────────────────────────────────┤
│  [Device grid — cards or table rows, one per device]                │
│  ...                                                                │
├─────────────────────────────────────────────────────────────────────┤
│  ▼ CHECK & FIX Report — Shopping Morumbi (42 devices)              │
│  ┌────────────┬──────────┬───────────┬─────────┬──────────────┐    │
│  │ ok: 31     │ mismatch │ missing   │ undef.  │ Last run: now│    │
│  │            │ : 6      │ : 3       │ : 2     │              │    │
│  └────────────┴──────────┴───────────┴─────────┴──────────────┘    │
│                                                                     │
│  Filter: [All ▼]   [Export CSV]                                     │
│                                                                     │
│  Device Name         Expected Type    Actual Type     Status        │
│  ─────────────────────────────────────────────────────────────────  │
│  3F-LOJA-001         3F_MEDIDOR       3F_MEDIDOR      ✅ ok         │
│  ELEV-01             ELEVADOR         —               ❌ missing    │
│  HIDR-SHOPPING-ENT   HIDROMETRO       HIDROMETRO      ✅ ok         │
│  AC-SALA-TI          CONTROLE_REMOTO  TERMOSTATO      ⚠️  mismatch │
│  GENERICO-99         UNDEFINED        3F_MEDIDOR      ❓ undefined  │
│  ...                                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Status legend

| Status      | Meaning |
|-------------|---------|
| `ok`        | Inferred value matches actual value in ThingsBoard |
| `mismatch`  | Inferred value differs from actual value |
| `missing`   | `deviceType` or `deviceProfile` is absent in ThingsBoard (null / empty) |
| `undefined` | Name inference returned `UNDEFINED`; cannot determine expected value |

---

## Reference-level explanation

### 4a. `handleDeviceType(name)` — inference algorithm

Used to infer both `deviceType` and `deviceProfile` from the device name. Returns a single token
representing the canonical type for that device.

```javascript
/**
 * Infers deviceType (and deviceProfile) from a device name.
 * @param {string} name - raw device name from ThingsBoard
 * @returns {string} - canonical type token or 'UNDEFINED'
 */
function handleDeviceType(name) {
  const upper = (name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  // ── ENERGY ────────────────────────────────────────────────────────
  if (upper.includes('COMPRESSOR'))                                return 'COMPRESSOR';
  if (upper.includes('VENT'))                                      return 'VENTILADOR';
  if (upper.includes('ESRL'))                                      return 'ESCADA_ROLANTE';
  if (upper.includes('ELEV'))                                      return 'ELEVADOR';
  if (upper.includes('MOTR') || upper.includes('MOTOR') ||
      upper.includes('RECALQUE'))                                  return 'MOTOR';
  if (upper.includes('RELOGIO') || upper.includes('RELOG') ||
      upper.includes('REL '))                                      return 'RELOGIO';
  if (upper.includes('ENTRADA') || upper.includes('SUBESTACAO') ||
      upper.includes('SUBEST'))                                    return 'ENTRADA';
  if (upper.includes('3F'))                                        return '3F_MEDIDOR';

  // ── WATER ─────────────────────────────────────────────────────────
  if (upper.includes('HIDR'))                                      return 'HIDROMETRO';
  if (upper.includes('CAIXA DAGUA') || upper.includes('CX DAGUA') ||
      upper.includes('CXDAGUA')     || upper.includes('SCD'))      return 'CAIXA_DAGUA';
  if (upper.includes('TANK') || upper.includes('TANQUE') ||
      upper.includes('RESERVATORIO'))                              return 'TANK';

  // ── REMOTE / CONTROL ──────────────────────────────────────────────
  if (upper.includes('AUTOMATICO'))                                return 'SELETOR_AUTO_MANUAL';
  if (upper.includes('TERMOSTATO') || upper.includes('TERMO') ||
      upper.includes('TEMP'))                                      return 'TERMOSTATO';
  if (upper.includes('ABRE'))                                      return 'SOLENOIDE';
  if (upper.includes('AUTOMACAO') || upper.includes('GW_AUTO'))   return 'GLOBAL_AUTOMACAO';
  if (upper.includes(' AC ') || upper.endsWith(' AC'))            return 'CONTROLE_REMOTO';

  return 'UNDEFINED';
}
```

**Possible return values**:

| Token | Canonical meaning |
|-------|------------------|
| `COMPRESSOR` | Energy — compressor unit |
| `VENTILADOR` | Energy — fan / air handler |
| `ESCADA_ROLANTE` | Energy — escalator |
| `ELEVADOR` | Energy — elevator |
| `MOTOR` | Energy — motor / pump recalque |
| `RELOGIO` | Energy — utility meter / clock meter |
| `ENTRADA` | Energy — main feed / substation |
| `3F_MEDIDOR` | Energy — 3-phase store meter |
| `HIDROMETRO` | Water — water meter |
| `CAIXA_DAGUA` | Water — water tank (cistern) |
| `TANK` | Water — tank / reservoir |
| `SELETOR_AUTO_MANUAL` | Remote — auto/manual selector |
| `TERMOSTATO` | Temperature — thermostat |
| `SOLENOIDE` | Remote — solenoid valve |
| `GLOBAL_AUTOMACAO` | Remote — global automation gateway |
| `CONTROLE_REMOTO` | Remote — remote control / AC unit |
| `UNDEFINED` | Name did not match any rule |

### 4b. Domain taxonomy

| Domain | deviceType members |
|--------|-------------------|
| `energy` | `COMPRESSOR`, `VENTILADOR`, `ESCADA_ROLANTE`, `ELEVADOR`, `MOTOR`, `RELOGIO`, `ENTRADA`, `3F_MEDIDOR` |
| `water` | `HIDROMETRO`, `CAIXA_DAGUA`, `TANK` |
| `temperature` | `TERMOSTATO`, `TERMOSTATO_EXTERNAL` |
| `remote` | `SOLENOIDE`, `GLOBAL_AUTOMACAO`, `CONTROLE_REMOTO`, `SELETOR_AUTO_MANUAL` |

> **Note**: `TERMOSTATO_EXTERNAL` does not appear as a `handleDeviceType` output because its name
> pattern is not yet encoded; it is expected to arrive pre-configured from ThingsBoard and is
> classified by its actual `deviceType` value, not by name inference.

### 4c. Group taxonomy

| Group key | Domain | deviceProfile values |
|-----------|--------|---------------------|
| `energy_entry` | `energy` | `ENTRADA`, `SUBESTACAO`, `RELOGIO`, `TRAFO` |
| `energy_common_area` | `energy` | `CHILLER`, `FANCOIL`, `BOMBA`, `BOMBA_HIDRAULICA`, `BOMBA_PRIMARIA`, `BOMBA_CAG`, `AR_CONDICIONADO`, `HVAC`, `COMPRESSOR`, `VENTILADOR`, `BOMBA_INCENDIO`, `MOTOR`, `ESCADA_ROLANTE`, `ELEVADOR` |
| `energy_store` | `energy` | `3F_MEDIDOR` |
| `water_entry` | `water` | `HIDROMETRO_SHOPPING`, `HIDROMETRO_ENTRADA` |
| `water_common_area` | `water` | `HIDROMETRO_AREA_COMUM`, `TANK`, `CAIXA_DAGUA` |
| `water_store` | `water` | `HIDROMETRO` |
| `temperature_internal` | `temperature` | `TERMOSTATO` |
| `temperature_external` | `temperature` | `TERMOSTATO_EXTERNAL` |
| `remote_solenoid` | `remote` | `SOLENOIDE` |
| `remote_automation` | `remote` | `GLOBAL_AUTOMACAO` |
| `remote_lighting` | `remote` | `ILUMINACAO`, `LAMP`, `LAMPADA` |
| `remote_control` | `remote` | `REMOTE`, `CONTROLE_REMOTO`, `SELETOR_AUTO_MANUAL` |

> **Relationship**: `domain` is determined by `deviceType`; `group` is determined by `deviceProfile`.
> Both fields must be present and consistent for a device to be correctly classified in the
> production dashboard.

### 4d. Diagnostic report schema

One record per device, produced after comparing inferred values against actual ThingsBoard attributes:

```typescript
interface DeviceDiagnosticRecord {
  deviceId:   string;          // ThingsBoard device UUID
  deviceName: string;          // human-readable name

  inferred: {
    deviceType:    string;     // output of handleDeviceType(deviceName)
    deviceProfile: string;     // same value — deviceProfile mirrors deviceType at inference time
  };

  actual: {
    deviceType:    string | null;   // SERVER_SCOPE attribute 'deviceType'
    deviceProfile: string | null;   // SERVER_SCOPE attribute 'deviceProfile'
    type:          string | null;   // TB device.type field (should equal deviceProfile)
  };

  domain: string | null;   // energy | water | temperature | remote | null (if UNDEFINED)
  group:  string | null;   // group key from taxonomy, or null

  status: 'ok' | 'mismatch' | 'missing' | 'undefined';
}
```

**Status derivation rules** (evaluated in order):

1. If `inferred.deviceType === 'UNDEFINED'` → `status = 'undefined'`
2. Else if `actual.deviceType === null || actual.deviceProfile === null` → `status = 'missing'`
3. Else if `actual.deviceType !== inferred.deviceType || actual.deviceProfile !== inferred.deviceProfile` → `status = 'mismatch'`
4. Else → `status = 'ok'`

### 4e. Inline panel layout in Step 2

The report panel is injected as a sibling element after the device grid container, inside the
Step 2 panel DOM. It is **not** a modal — it scrolls with the page content.

```
#step2-panel
  ├── .step2-device-grid          ← existing device grid (unchanged)
  └── .checkfix-report-panel      ← injected by CHECK & FIX routine
        ├── .checkfix-header
        │     ├── .checkfix-title  "CHECK & FIX Report — <customer name>"
        │     ├── .checkfix-summary  { ok, mismatch, missing, undefined, total }
        │     └── .checkfix-actions  [Filter dropdown] [Export CSV]
        └── .checkfix-table
              └── <table>
                    <thead>  Device Name | Exp. Type | Exp. Profile | Act. Type | Act. Profile | Status
                    <tbody>  one <tr> per DeviceDiagnosticRecord
```

**Scope note**: The scan always runs over **all devices of the selected customer**, regardless of
any active filter in the Step 2 grid (e.g., domain filter, search text). This ensures the report
reflects the full customer state, not a filtered subset.

---

## Drawbacks

1. **N+1 attribute fetches** — Fetching SERVER_SCOPE attributes (`deviceType`, `deviceProfile`) for
   every device requires one API call per device or one batched call if the TB REST API supports it.
   For customers with 200+ devices this may introduce noticeable latency.

2. **False positives from generic names** — `handleDeviceType` is a heuristic. Devices with generic
   or non-standard names (e.g., `DEVICE-001`, `MEDIDOR`) may return `UNDEFINED` even when their
   actual attributes are correctly set, inflating the `undefined` count.

3. **Inference ≠ ground truth** — The algorithm assumes device names follow naming conventions.
   Legacy or imported devices may use different conventions, producing spurious `mismatch` records.

---

## Rationale and alternatives

### Why an inline panel rather than a separate modal?

An inline panel keeps the context of the device grid visible while reviewing the report. Operators
can correlate a flagged device in the report with the card in the grid without toggling modals.
A modal would obscure the grid and require the operator to close and reopen to cross-reference.

### Why name-based inference rather than manual tagging or rule files?

Manual tagging requires operators to define expected values for every device, which defeats the
purpose of automation. Rule files (YAML/JSON) add maintenance overhead and drift from code.
Name-based inference leverages the existing naming convention that operators already follow, making
the expected state derivable from information already present in ThingsBoard.

### Why derive `deviceProfile` from the same inference as `deviceType`?

In the current data model, `deviceType` and `deviceProfile` carry the same canonical token for most
devices (e.g., both `ELEVADOR`, both `3F_MEDIDOR`). The group taxonomy then uses `deviceProfile` to
assign sub-groups. Using a single `handleDeviceType` function for both simplifies the inference
surface and avoids divergence between two separate rule tables.

---

## Prior art

- **RFC-0111** — Unified device domain/context classification: defines the production `classifyDevice`
  function used by the dashboard. RFC-0184 borrows the same domain taxonomy but applies it at
  diagnostic time rather than render time.

- **RFC-0128** — Energy equipment subcategorization: defines the group taxonomy for `energy` domain
  devices. RFC-0184 extends this to all four domains (energy, water, temperature, remote).

- **RFC-0109** — GCDR-Upsell-Setup widget: the host widget where the CHECK & FIX button lives.
  Step 2 device grid is the primary integration surface.

---

## Unresolved questions

1. **Batch attribute fetch API** — Does the ThingsBoard instance used by MYIO support a bulk
   `getAttributesByScope` call for multiple device IDs in a single request? If not, what is the
   acceptable per-request concurrency limit (e.g., 5 parallel calls)?

2. **`TERMOSTATO_EXTERNAL` inference** — No name pattern currently maps to `TERMOSTATO_EXTERNAL`.
   Should a suffix like `EXT` or `EXTERNO` in the name trigger this token, or should `TERMOSTATO`
   always be the inferred value and `TERMOSTATO_EXTERNAL` remain actual-only?

3. **`UNDEFINED` handling** — Should devices with `status = 'undefined'` be hidden from the report
   by default (opt-in via filter) or shown with a neutral indicator? Hiding them reduces noise but
   may cause operators to overlook mis-named devices.

4. **Export format** — The mockup shows `[Export CSV]`. Should the CSV include the full
   `DeviceDiagnosticRecord` schema (including `actual.type`) or a simplified view?

5. **Re-run behavior** — If the operator clicks CHECK & FIX a second time while a report is
   already visible, should it replace the existing report in-place (with a loading state) or append
   a new timestamped report?

---

## Future possibilities

### FIX phase — Write-back to ThingsBoard (v2.0.0+)

Once the CHECK phase is validated in production, the FIX phase can be layered on top without
architectural changes:

1. A **[FIX SELECTED]** button appears in the report panel header (active only when one or more
   `mismatch` or `missing` records are checked).
2. Clicking it triggers `applyFix(records)`:
   - For each selected record, POST to ThingsBoard `saveEntityAttributesV2` (SERVER_SCOPE):
     - `deviceType` ← `inferred.deviceType`
     - `deviceProfile` ← `inferred.deviceProfile`
   - Additionally, PATCH `device.type` ← `inferred.deviceProfile` (TB device type field).
3. After write-back, the CHECK scan re-runs automatically and the report refreshes.
4. A confirmation dialog is shown before writing, listing the exact attributes to be changed.

> **`type` field**: ThingsBoard's `device.type` is a legacy field that should equal `deviceProfile`.
> The FIX phase writes `type = deviceProfile` to keep it in sync.

### Scheduled / periodic diagnostics

The routine could be scheduled to run automatically (e.g., nightly via a Node-RED flow) and expose
a summary event `myio:checkfix-summary-ready` for monitoring dashboards. This would shift the tool
from on-demand to continuous health monitoring.

### Confidence scoring

`handleDeviceType` currently returns a binary result (matched token or `UNDEFINED`). A future
version could return a confidence score (0–1) based on how specific the matched pattern is (e.g.,
`ELEV` alone scores lower than `ELEV-01` with a numeric suffix), allowing the report to surface
low-confidence matches separately from high-confidence ones.
