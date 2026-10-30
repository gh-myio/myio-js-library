# RFC-0240 — Manual devices created in the four systems (TB, GCDR, Ingestion, Central)

- **Feature name:** `manual-device-provisioning`
- **Start date:** 2026-10-30
- **Status:** **Draft rev. 1 — implemented for testing.** The admin credentials are still in the widget
  code (§7). Not ready for customers until §7 is done.
- **Related:** runbook `data-ingestion-prod.git/docs/runbooks/PRESETUP-DRY-RUN-AND-RUN-ALL.md`
  (Run All, identity `(central, slaveId)`, Modbus addressing), commits `7450e482` / `4c2e33f1`
  (devices `*_MANUAL`, tab "Disp. Manuais", "+" and "Importar dados"), PR #152 (admin
  credentials out of the lib).

## 1. Problem

The "+" button of the "Disp. Manuais" tab (Shopping v-5.2.0) creates the device **only in
ThingsBoard**. The device gets a name, a relation to the asset `*_DEVICES_MANUAIS` and the
attributes `deviceProfile` and `identifier`. It has **no** `centralId`, `slaveId` or `ingestionId`.

Consequences:

- **"Importar dados" cannot reach it.** The import spreadsheet keys every row by
  `gateway_id` (central uuid) + `slave_id`. A device without them is left out of the template,
  so its card stays at 0.
- **The four systems disagree.** GCDR is the source of truth for the customer tree, and the
  presetup Run All compares the local tree with each system by `(central, slaveId)`. A device that
  exists only in TB is an orphan for every other system.

## 2. Goal

Creating a manual device creates it, in one operation, in **GCDR, Ingestion, ThingsBoard and the
central**, with the same name and the same `(central, slaveId)` identity. The flow copies the
presetup Run All, reduced to a single device:

- a **plan** (dry run) that writes nothing and shows what each system will receive;
- an **apply** step that writes in a fixed order, with rollback when an early step fails.

Out of scope: editing or deleting manual devices, and devices on customers with no central.

## 3. Identity and addressing

- **Name:** reserved in TB before anything is written: `3F <SIGLA>_LOJA_<NNN>_MANUAL` or
  `Hidr. <SIGLA>_LOJA_<NNN>_MANUAL`. `SIGLA` comes from the asset `ASSET_<SIGLA>_DEVICES_MANUAIS`.
  The same name goes to all four systems.
- **Central:** the customer's central in GCDR (`tree.centrals`). With more than one central, the one
  with the most devices is used and the plan shows a warning.
- **slaveId:** `max(slaveIds of that central in GCDR, slave row ids on the central) + 1`. The slaveId
  is the central's row id, so it keeps counting past 253.
- **Modbus address** (presetup `modbusAddrForSlaveId`):
  `addr_low = ((slaveId − 1) mod 253) + 1`, `addr_high = 248 + floor((slaveId − 1) / 253)`.
  Taboão today ends at slave 322, so the next manual device is slave 323 → `70 / 249`.

## 4. Flow

### 4.1 Plan (read-only)

| # | System | Read | Blocks when |
|---|---|---|---|
| 1 | ThingsBoard | asset `*_DEVICES_MANUAIS`, next free `NNN` | no asset (error) |
| 2 | GCDR | `GET /api/v1/customers/{gcdrCustomerId}/tree?deep=1` → central, asset with the same name, used slaveIds | no `gcdrCustomerId`, no central, no asset with the TB asset name |
| 3 | Central | `GET https://<uuid>.y.myio.com.br/api/state` → slaves | never; an unreachable central becomes a warning and its step is `skipped` |
| 4 | Ingestion | `GET /gateways/<uuid>` (the gateway id is the central uuid; `/gateways/lookup` answers 404 in production), `GET /assets?customerId=&search=<asset>`, `POST /devices/lookup {pairs:[{gatewayId, slaveId}]}` | no admin credential, no `ingestionId` on the TB customer, no gateway, or the pair is already used |

The modal shows name, label, identifier, blockers and warnings. Type, central, slaveId, Modbus
address, asset and the four steps stay collapsed under **Ver mais detalhes**; they open by themselves
only when something fails. **Criar** is disabled while there is a blocker.

### 4.2 Apply

| # | System | Write | On failure |
|---|---|---|---|
| 1 | GCDR | `POST /api/v1/devices {assetId, name, type:'METER', deviceType/deviceProfile:<*_MANUAL>, label, displayName, identifier, slaveId, centralId, metadata:{myioType, channels:[], addr_low, addr_high, manual:true}}` | abort; nothing was written |
| 2 | Ingestion | asset `POST /assets {label, customerId, status:'active'}` when missing; device `POST /devices {id:<client uuid>, name, deviceType:'energy'|'water', customerId, assetId, gatewayId, slaveId, multipliers:{}}` | delete the GCDR device |
| 3 | ThingsBoard | device as today (fixed name, asset relation) + SERVER_SCOPE `centralId, slaveId, addrLow, addrHigh, ingestionId, gcdrDeviceId, deviceProfile, identifier` | `createManualDevice` removes the TB device; delete Ingestion and GCDR |
| 4 | Central | pause MQTT Sync if enabled → re-check the slave is free → `POST /api/provision {devices:[{name, type, addr_low, addr_high, hierarchyPath:[customer, asset], slave_id, channels}], remove:[], rename:[]}` → resume MQTT Sync | **no rollback**: the device exists in the other three systems; the step is reported as pending, to be finished from the presetup (Centrais → Aplicar diffs) |

- Energy goes to the central as `three_phase_sensor` with no channels.
- Water goes to the central as `outlet` with two channels: Fonte (`presence_sensor`) and Vazão
  (`flow_sensor`). Same as the presetup.
- The ambient is the last element of `hierarchyPath`. The central's SQL creates it or reuses it by
  name, and creates the slave relation.
- MQTT Sync is resumed in a `finally`, and only if this flow paused it. A failure to resume is shown
  on the central step.

The result reaches the user step by step: ✅ ok, ❌ error, ↩️ rolled back, ⏭️ skipped.

## 5. Code layout

| Where | What |
|---|---|
| `src/components/premium-modals/manual-device/createManualDevice.ts` | `resolveManualDeviceName()` (new, read-only), `createManualDevice({ name?, extraAttributes? })` |
| `src/components/premium-modals/manual-device/openManualDeviceModal.ts` | `provisioner` param: form → **Revisar** (plan) → **Criar** (progress) → result. Without it, the old TB-only flow |
| `MAIN_VIEW/controller.js` | `_manualPlan`, `_manualApply`, HTTP helpers per system, temporary credential constants; published as `MyIOOrchestrator.manualDeviceProvisioner` |
| `TELEMETRY/controller.js` | `_openManualDeviceModal` passes `MyIOOrchestrator.manualDeviceProvisioner`. If it is missing, it shows a toast to update MAIN_VIEW |
| `src/components/premium-modals/telemetry-import/sheet.ts` | `slave_id` accepts any integer ≥ 1 (was 1–247) |

The lib only renders. All calls to the four systems live in MAIN_VIEW, as the owner asked.

## 6. Tests

- `tests/components/premium-modals/manualDevice.test.ts`:
  - `resolveManualDeviceName` reserves the name without writing;
  - fixed name with extra attributes;
  - a fixed name that already exists is an error, not a renumbering;
  - provisioner modal: plan without writes, blockers disable Criar, central pending, failure with
    rollback.
- `tests/components/premium-modals/telemetryImport.test.ts`: slaveId > 247 enters the template.
- The MAIN_VIEW provisioner has no unit tests yet (it is widget code). It is validated on the Taboão
  dashboard.

## 7. Security — temporary, must change before customers use it

The GCDR key and the Ingestion admin credential (`MANUAL_PROV_*` in MAIN_VIEW) are constants in the
widget code. **The widget source is readable by every user who opens the dashboard.** This is the
same exposure discussed in PR #152.

- Acceptable only for internal testing on dashboards without customer users.
- **Target:** a backend endpoint (GCDR or presetup) that receives `{customer, domain, label,
  identifier}`, runs §4 with server-side credentials, and returns the plan and the step results.
  MAIN_VIEW then calls that endpoint instead of the four systems.
- Without the constants filled in, the GCDR calls fall back to the customer's `gcdrApiKey`, and the
  plan blocks on the Ingestion step.

## 8. Open questions

1. **Central for a device with no meter.** The slave is created like a real meter. The central will
   poll a Modbus address with nothing behind it, so the device reads as offline. Decide whether the
   central needs a "virtual" slave type that is registered but not polled.
2. **Ingestion channels for water.** The presetup sends channels for water devices. This flow sends
   none, so the import can only fill `value_m3`. Confirm that `water_readings` imports work without
   channels.
3. **GCDR `deviceType` for `*_MANUAL`.** `METER` + `deviceProfile: 3F_MEDIDOR_MANUAL` /
   `HIDROMETRO_MANUAL`. Check that GCDR rules, alarms and reports ignore or accept these profiles.
4. **Run All after a manual device.** The device is in GCDR, so a presetup tree imported from GCDR
   keeps it. A tree built from an old JSON does not, and the Run All **would delete it** from GCDR and
   the central (runbook §2.1 / §2.4). Re-import from GCDR before any Run All.
5. **Several centrals.** Today the plan picks the central with the most devices. A selector may be
   needed for customers with more than one central.

## 9. Import models

"Importar dados" has two filling models. Both produce the same hourly rows, so the Ingestion API
(`POST /import/validate`) has a single format. The backend does not exist yet: see
`clientes/MYIO/ingestion/FEEDBACK-IMPORTACAO-PLANILHA-TELEMETRIA-2026-10-30.md`.

| | **Hora a hora** | **Acumulado por período** |
|---|---|---|
| User provides | the value of each hour | start, end and total of each device |
| Input | spreadsheet | on-screen form or spreadsheet |
| Template columns | `gateway_id;slave_id;device_name;date;hour;value_kwh\|value_m3;…` | `gateway_id;slave_id;device_name;start_date;end_date;total_kwh\|total_m3` |
| Hourly values | real | **estimated**; only the total is real |
| `sourceRef` | file name | `acumulado:<file name or "tela">` |

### 9.1 Distribution (`telemetry-import/accumulated.ts`)

- **Slots:** closed hours of the period, São Paulo time.
- **Profile:** `DEFAULT_DISTRIBUTION_PROFILE = { openHour: 10, closeHour: 22, openShare: 0.85 }`.
  85% of the total goes to opening hours and 15% to the others, evenly inside each group. It is
  fixed for now and is a parameter so it can become a per-customer setting.
- **Only one group in the period:** uniform across the slots.
- **Exact sum:** the math runs on integer thousandths with the largest-remainder method, so the sum
  of the hours is exactly the informed total, rounded to 3 decimals.

### 9.2 Rules

| Case | Result |
|---|---|
| Start after end | error |
| End in the future | error: the total must be of a closed period |
| Period longer than 366 days | error |
| Overlapping periods of the same device | error on the later line |
| Period with no closed hours | error |
| Negative or non-numeric total | error |
| Empty total | ignored |
| Total zero | accepted, with a warning: every hour is written as 0 |
| More than 5,000 generated hours | error |

Any error blocks the upload. Existing readings in the period are replaced, so
`existingRealReadings` and `confirmReplaceReal` from the validate step apply.

### 9.3 Limits and caveats

- **Volume:** one device in 30 days is 720 hours, so 5,000 rows cover about 6 devices per month.
- **Estimated data:** the hourly curve must not feed peak-demand analysis. The UI says so in the
  preview and in the validation step, and `sourceRef` marks the import. Whether reports can tell
  these readings apart depends on the Ingestion storing that mark.
- **Device manual has no history,** so a per-device historical profile is not an option yet.
