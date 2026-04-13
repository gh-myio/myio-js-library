# RFC — Fix Temperature Registry Widget

- **Widget name:** `fix-temp-registry`
- **Start date:** 2026-04-13
- **Status:** Pending approval
- **Path:** `src/thingsboard/smart-hospital/fix-temp-registry/`
- **Replaces:** `fix_souza_aguiar.xlsx`

---

## Summary

A ThingsBoard HTML widget that replaces the `fix_souza_aguiar.xlsx` spreadsheet. It displays, tracks, and edits the progress of the sensor name/slaveId correction operation for Souza Aguiar hospital temperature sensors. State is persisted as a `SERVER_SCOPE` customer attribute in ThingsBoard — no local storage, no external database.

---

## Motivation

The current fix tracking is done via a shared Excel file with 29 rows of sensor correction data (slave ID migrations, offsets, SQL scripts). This approach has no visibility into who changed what, no status tracking, and requires manual file sharing. A ThingsBoard widget brings the tracking into the same environment where the fix is executed, with persistent state and a clean status workflow.

---

## Guide-Level Explanation

When the dashboard is opened for the first time, the widget detects that the customer attribute `fix_souza_aguiar_sensores_temperatura` does not exist and seeds it with the 29 initial rows. The widget renders a horizontally scrollable table with `OS` sticky on the left and `Status` sticky on the right.

Each row can be edited inline by clicking any cell. SQL columns expand into a textarea on edit and show a copy-to-clipboard button on hover. A status badge per row tracks progress: `Not started → Planned → In progress → Resolved`.

Toolbar actions: add row, duplicate row, remove row (with confirmation), export JSON backup, import JSON backup, filter by status.

---

## Reference-Level Explanation

### Persistence

| Item | Value |
|---|---|
| Scope | `SERVER_SCOPE` |
| Entity | `CUSTOMER` (dashboard customer) |
| Attribute key | `fix_souza_aguiar_sensores_temperatura` |
| Format | JSON array |
| Default | If attribute absent on first load, widget saves the seed (section below) |

**Load:** `GET /api/plugins/telemetry/CUSTOMER/{customerId}/values/attributes/SERVER_SCOPE?keys=fix_souza_aguiar_sensores_temperatura`

**Save:** `POST` same endpoint with full JSON array. Debounced 500 ms per edit. Last-write-wins.

**Export backup:** button triggers download as `fix_souza_aguiar_YYYY-MM-DD_HHmm.json`.

**Import backup:** button accepts `.json` upload, shows confirmation dialog, then replaces attribute.

Internal MYIO library helpers are used for all API calls (get/set customer attribute).

---

### Row Schema

```ts
type Status = 'nao_iniciado' | 'planejado' | 'em_execucao' | 'resolvido';

interface FixRow {
  id: string;                       // 'row_001', 'row_002', ... (immutable key)
  os: string;                       // Environment / OS name
  thingsboard: string;              // Name in ThingsBoard
  appAntigo: string;                // Name shown in legacy app
  newNameOldDevice: string;         // New name to apply to the OLD device (OLD- prefix)
  slaveIdAntigo: number | '';       // SlaveId of the old device
  offsetAntigo: number | '';        // Offset to add to historical readings
  antesFix: string;                 // Device name before fix
  aposFix: string;                  // Device name after fix
  slaveIdNovo: number | '';         // SlaveId of the correct device
  updateTemperatureHistory: string; // Ready-to-run SQL
  updateOldName: string;            // Ready-to-run SQL
  updateNewName: string;            // Ready-to-run SQL
  status: Status;                   // default: 'nao_iniciado'
}
```

---

### Table Columns

Horizontal scroll required (total ~3260px). `OS` is sticky left. `Status` is sticky right.

| # | Column | Field | Width | Editable | Type |
|---|---|---|---|---|---|
| 1 | OS | `os` | 220px (sticky left) | ✅ | text |
| 2 | Thingsboard | `thingsboard` | 180px | ✅ | text |
| 3 | App Antigo | `appAntigo` | 260px | ✅ | text |
| 4 | New Name to OLD DEVICE | `newNameOldDevice` | 320px | ✅ | text |
| 5 | SlaveId Antigo | `slaveIdAntigo` | 110px | ✅ | number |
| 6 | Offset Antigo | `offsetAntigo` | 110px | ✅ | number |
| 7 | Antes FIX | `antesFix` | 280px | ✅ | text |
| 8 | Após FIX | `aposFix` | 260px | ✅ | text |
| 9 | SlaveId Novo | `slaveIdNovo` | 110px | ✅ | number |
| 10 | Update temperature_history | `updateTemperatureHistory` | 420px | ✅ | long text (monospace) |
| 11 | Update old name | `updateOldName` | 420px | ✅ | long text (monospace) |
| 12 | Update new name | `updateNewName` | 420px | ✅ | long text (monospace) |
| 13 | Status | `status` | 150px (sticky right) | ✅ | select |

#### Edit behavior

- Single click on a cell → inline edit mode (input / textarea / select).
- `Enter` or blur → saves cell and triggers debounced attribute save.
- `Esc` → cancels edit.
- SQL columns (`updateTemperatureHistory`, `updateOldName`, `updateNewName`): row height auto-expands to textarea with wrap.
- Copy-to-clipboard icon appears on hover over SQL columns.

#### Toolbar actions

- **Add row** → appends new row with all fields empty, `status = 'nao_iniciado'`, `id = row_{n+1}`.
- **Duplicate row** (per row) → copies row with new `id`.
- **Remove row** (per row) → confirmation dialog, then removes from array.
- **Export JSON** → downloads array.
- **Import JSON** → upload + confirmation → replaces array.
- **Filter by status** → tabs/chips: `All | Not started | Planned | In progress | Resolved`.
- **Counters:** `Total: 29 • Resolved: X • In progress: Y • Planned: Z • Not started: W`.

---

### Status Values

MYIO visual identity (purple `#6B4ABF`, green `#4CAF82`, dark base).

| Internal value | UI label | Badge color | Text color |
|---|---|---|---|
| `nao_iniciado` | Not started | `#3A3A44` | `#CCCCCC` |
| `planejado` | Planned | `#6B4ABF` | `#FFFFFF` |
| `em_execucao` | In progress | `#F5A623` | `#1A1A1A` |
| `resolvido` | Resolved | `#4CAF82` | `#FFFFFF` |

---

### Layout Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│  Fix Souza Aguiar — Temperature Sensors                              │
│  Total: 29 • Resolved: 0 • In progress: 0 • Planned: 0 • N.S.: 29  │
│  [All] [Not started] [Planned] [In progress] [Resolved]             │
│  [+ Add row]   [⬇ Export JSON]  [⬆ Import JSON]                     │
├──────────────────────────────────────────────────────────────────────┤
│ OS(sticky) │ TB │ App Antigo │ ... │ Update new name │ Status(sticky)│
├────────────┼────┼────────────┼─────┼─────────────────┼───────────────┤
│ CC 01      │... │ ...        │ ... │ UPDATE slaves...│ [Not started] │
│ CC 02      │... │ ...        │ ... │ UPDATE slaves...│ [In progress] │
│ ...        │... │ ...        │ ... │ ...             │ ...           │
└────────────┴────┴────────────┴─────┴─────────────────┴───────────────┘
       ◄────────────── horizontal scroll ──────────────►
```

---

### Initial Seed (29 rows)

If `fix_souza_aguiar_sensores_temperatura` does not exist on first load, the widget saves this array:

```json
[
  {
    "id": "row_001",
    "os": "Centro Cirúrgico 01",
    "thingsboard": "Cirurgia 01",
    "appAntigo": "Temp. Co2_Cirurgia1 -3",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_Cirurgia1 -3",
    "slaveIdAntigo": 75,
    "offsetAntigo": -3,
    "antesFix": "GAS Co2_Cirurgia1 132 5000 x9.4",
    "aposFix": "",
    "slaveIdNovo": 76,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 76, value = value + (-3) WHERE slave_id = 75;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia1 -3' WHERE id = 75;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_Cirurgia1' WHERE id = 76;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_002",
    "os": "Centro Cirúrgico 02",
    "thingsboard": "Cirurgia 02",
    "appAntigo": "Temp. CO2_CC02 -5",
    "newNameOldDevice": "OLD-T.e.m.p. CO2_CC02 -5",
    "slaveIdAntigo": 111,
    "offsetAntigo": -5,
    "antesFix": "GAS CO2_CC02 132 5000 x9.47",
    "aposFix": "",
    "slaveIdNovo": 110,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 110, value = value + (-5) WHERE slave_id = 111;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. CO2_CC02 -5' WHERE id = 111;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. CO2_CC02' WHERE id = 110;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_003",
    "os": "Centro cirúrgico 03",
    "thingsboard": "Cirurgia 03",
    "appAntigo": "Temp. Co2_CC_03 -8",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_CC_03 -8",
    "slaveIdAntigo": 53,
    "offsetAntigo": -8,
    "antesFix": "GAS Co2_CC_03 132 5000 x9.47",
    "aposFix": "",
    "slaveIdNovo": 52,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 52, value = value + (-8) WHERE slave_id = 53;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CC_03 -8' WHERE id = 53;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_CC_03' WHERE id = 52;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_004",
    "os": "Centro cirúrgico 05",
    "thingsboard": "Cirurgia 05",
    "appAntigo": "Temp. Co2_CC05 -6",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_CC05 -6",
    "slaveIdAntigo": 115,
    "offsetAntigo": -6,
    "antesFix": "Gas Co2_CC05 132 500 x9.47",
    "aposFix": "",
    "slaveIdNovo": 114,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 114, value = value + (-6) WHERE slave_id = 115;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CC05 -6' WHERE id = 115;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_CC05' WHERE id = 114;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_005",
    "os": "Centro cirúrgico 06",
    "thingsboard": "Cirurgia 06",
    "appAntigo": "Temp. Co2_Cirurgia06 -4",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_Cirurgia06 -4",
    "slaveIdAntigo": 106,
    "offsetAntigo": -4,
    "antesFix": "GAS Co2_Cirurgia06 132 5000 x9.47",
    "aposFix": "",
    "slaveIdNovo": 107,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 107, value = value + (-4) WHERE slave_id = 106;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia06 -4' WHERE id = 106;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_Cirurgia06' WHERE id = 107;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_006",
    "os": "Centro cirúrgico 07",
    "thingsboard": "Cirurgia 07",
    "appAntigo": "Temp. Co2_Cirurgia7 -2",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_Cirurgia7 -2",
    "slaveIdAntigo": 63,
    "offsetAntigo": -2,
    "antesFix": "GAS Co2_Cirurgia7 132 5000 x9.47",
    "aposFix": "",
    "slaveIdNovo": 64,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 64, value = value + (-2) WHERE slave_id = 63;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia7 -2' WHERE id = 63;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_Cirurgia7' WHERE id = 64;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_007",
    "os": "Centro cirúrgico 07",
    "thingsboard": "Cirurgia 07 - Inst. 04/02/26",
    "appAntigo": "Temp. Co2_Cirurgia7_Apos_04_Fev_2026 -4",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_Cirurgia7_Apos_04_Fev_2026 -4",
    "slaveIdAntigo": 158,
    "offsetAntigo": -4,
    "antesFix": "GAS Co2_Cirurgia7 132 5000 x9.47",
    "aposFix": "",
    "slaveIdNovo": 64,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 64, value = value + (-4) WHERE slave_id = 158;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia7_Apos_04_Fev_2026 -4' WHERE id = 158;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_Cirurgia7' WHERE id = 64;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_008",
    "os": "Centro cirúrgico 08",
    "thingsboard": "Cirurgia 08",
    "appAntigo": "Temp. Co2_Cirurgia8 -3",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_Cirurgia8 -3",
    "slaveIdAntigo": 143,
    "offsetAntigo": -3,
    "antesFix": "Temp. Co2_Cirurgia8",
    "aposFix": "",
    "slaveIdNovo": 50,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 50, value = value + (-3) WHERE slave_id = 143;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia8 -3' WHERE id = 143;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_Cirurgia8' WHERE id = 50;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_009",
    "os": "Centro cirúrgico 09",
    "thingsboard": "Cirurgia 09",
    "appAntigo": "Temp. Co2_Cirurgia9 -3",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_Cirurgia9 -3",
    "slaveIdAntigo": 155,
    "offsetAntigo": -3,
    "antesFix": "GAS Co2_Cirurgia9 132 5000 x9.47",
    "aposFix": "",
    "slaveIdNovo": 54,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 54, value = value + (-3) WHERE slave_id = 155;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Cirurgia9 -3' WHERE id = 155;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_Cirurgia9' WHERE id = 54;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_010",
    "os": "RPA",
    "thingsboard": "RPA",
    "appAntigo": "Temp. CO2_RPA -8",
    "newNameOldDevice": "OLD-T.e.m.p. CO2_RPA -8",
    "slaveIdAntigo": 109,
    "offsetAntigo": -8,
    "antesFix": "GAS CO2_RPA 132 500 x9.47",
    "aposFix": "",
    "slaveIdNovo": 108,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 108, value = value + (-8) WHERE slave_id = 109;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. CO2_RPA -8' WHERE id = 109;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. CO2_RPA' WHERE id = 108;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_011",
    "os": "Centro cirúrgico 10",
    "thingsboard": "Cirurgia 10",
    "appAntigo": "Temp. CO2_CC10 -5",
    "newNameOldDevice": "OLD-T.e.m.p. CO2_CC10 -5",
    "slaveIdAntigo": 113,
    "offsetAntigo": -5,
    "antesFix": "GAS CO2_CC10 132 5000 x9.47",
    "aposFix": "",
    "slaveIdNovo": 112,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 112, value = value + (-5) WHERE slave_id = 113;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. CO2_CC10 -5' WHERE id = 113;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. CO2_CC10' WHERE id = 112;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_012",
    "os": "Laboratório",
    "thingsboard": "Laboratorio",
    "appAntigo": "Temp. Co2_Laboratorio -6",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_Laboratorio -6",
    "slaveIdAntigo": 80,
    "offsetAntigo": -6,
    "antesFix": "GAS Co2_Laboratorio 132 5000 x9.47",
    "aposFix": "",
    "slaveIdNovo": 79,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 79, value = value + (-6) WHERE slave_id = 80;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Laboratorio -6' WHERE id = 80;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_Laboratorio' WHERE id = 79;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_013",
    "os": "CTI 03",
    "thingsboard": "CTI 03",
    "appAntigo": "Temp. Co2_CTI_03 -9",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_CTI_03 -9",
    "slaveIdAntigo": 128,
    "offsetAntigo": -9,
    "antesFix": "GAS Co2_CTI_03 132 5000 x9.47",
    "aposFix": "",
    "slaveIdNovo": 127,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 127, value = value + (-9) WHERE slave_id = 128;",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_CTI_03 -9' WHERE id = 128;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_CTI_03' WHERE id = 127;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_014",
    "os": "CER (sala medicação)",
    "thingsboard": "Medicação CER",
    "appAntigo": "Temp. Co2_Medicacao_CER -6",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_Medicacao_CER -6",
    "slaveIdAntigo": 10,
    "offsetAntigo": -6,
    "antesFix": "GAS Co2_CTI_03 132 5000 x9.47",
    "aposFix": "Temp. Co2_Medicacao_CER",
    "slaveIdNovo": 11,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 11, value = value + (-6) WHERE slave_id = 10 AND timestamp >= NOW() - INTERVAL '30 days';",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Medicacao_CER -6' WHERE id = 10;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_Medicacao_CER' WHERE id = 11;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_015",
    "os": "Centro Obstétrico 03",
    "thingsboard": "Centro Obstétrico 03",
    "appAntigo": "Temp. Co2_Centro_Obstetrico_03 -4",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_Centro_Obstetrico_03 -4",
    "slaveIdAntigo": 27,
    "offsetAntigo": -4,
    "antesFix": "GAS Co2_Centro_Obstetrico_03 132 5000 x9.4",
    "aposFix": "Temp. Co2_Centro_Obstetrico_03",
    "slaveIdNovo": 28,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 28, value = value + (-4) WHERE slave_id = 27 AND timestamp >= NOW() - INTERVAL '90 days';",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Centro_Obstetrico_03 -4' WHERE id = 27;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_Centro_Obstetrico_03' WHERE id = 28;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_016",
    "os": "Centro Obstétrico 02",
    "thingsboard": "Centro Obstétrico 02",
    "appAntigo": "Temp. Co2_Centro_Obstetrico_02 -3",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_Centro_Obstetrico_02 -3",
    "slaveIdAntigo": 8,
    "offsetAntigo": -3,
    "antesFix": "GAS Co2_Centro_Obstetrico_02 132 5000 x9.47",
    "aposFix": "Temp. Co2_Centro_Obstetrico_02",
    "slaveIdNovo": 10,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 10, value = value + (-3) WHERE slave_id = 8 AND timestamp >= NOW() - INTERVAL '90 days';",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Centro_Obstetrico_02 -3' WHERE id = 8;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_Centro_Obstetrico_02' WHERE id = 10;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_017",
    "os": "Centro Obstétrico 01",
    "thingsboard": "Centro Obstétrico 01",
    "appAntigo": "Temp. Co2_Centro_Obstetrico_01 -4",
    "newNameOldDevice": "OLD-T.e.m.p. Co2_Centro_Obstetrico_01 -4",
    "slaveIdAntigo": 19,
    "offsetAntigo": -4,
    "antesFix": "GAS Co2_Centro_Obstetrico_01 132 5000 x9.47",
    "aposFix": "Temp. Co2_Centro_Obstetrico_01",
    "slaveIdNovo": 20,
    "updateTemperatureHistory": "UPDATE temperature_history SET slave_id = 20, value = value + (-4) WHERE slave_id = 19 AND timestamp >= NOW() - INTERVAL '90 days';",
    "updateOldName": "UPDATE slaves SET name = 'OLD-T.e.m.p. Co2_Centro_Obstetrico_01 -4' WHERE id = 19;",
    "updateNewName": "UPDATE slaves SET name = 'Temp. Co2_Centro_Obstetrico_01' WHERE id = 20;",
    "status": "nao_iniciado"
  },
  {
    "id": "row_018",
    "os": "Repetidor Centro cirúrgico",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  },
  {
    "id": "row_019",
    "os": "UTI Neonatal (Maternidade)",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  },
  {
    "id": "row_020",
    "os": "Centro Cirúrgico 04",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  },
  {
    "id": "row_021",
    "os": "CTI 01",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  },
  {
    "id": "row_022",
    "os": "CTI 02",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  },
  {
    "id": "row_023",
    "os": "Raio X 04",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  },
  {
    "id": "row_024",
    "os": "Raio X 01",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  },
  {
    "id": "row_025",
    "os": "Tomografia 01",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  },
  {
    "id": "row_026",
    "os": "Raio X 03",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  },
  {
    "id": "row_027",
    "os": "Hemodiálise",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  },
  {
    "id": "row_028",
    "os": "Agência Transfusional",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  },
  {
    "id": "row_029",
    "os": "CTI 04",
    "thingsboard": "",
    "appAntigo": "",
    "newNameOldDevice": "",
    "slaveIdAntigo": "",
    "offsetAntigo": "",
    "antesFix": "",
    "aposFix": "",
    "slaveIdNovo": "",
    "updateTemperatureHistory": "",
    "updateOldName": "",
    "updateNewName": "",
    "status": "nao_iniciado"
  }
]
```

---

## Acceptance Criteria

- [ ] On first dashboard open, widget seeds the customer attribute and renders all 29 rows.
- [ ] Editing any cell persists to the attribute within ≤1s (discrete spinner/check indicator).
- [ ] Dashboard reload preserves all edits.
- [ ] Horizontal scroll works with `OS` sticky left and `Status` sticky right.
- [ ] Status filters work without re-fetching from the API.
- [ ] Export downloads valid JSON; re-import restores identical state.
- [ ] Add / remove / duplicate row updates the attribute.
- [ ] No data is written to `localStorage` or `sessionStorage` — everything via customer attribute.

---

## Drawbacks

- Last-write-wins: if two users edit simultaneously, one overwrites the other silently. Acceptable for the current single-operator use case.
- The widget is tightly coupled to Souza Aguiar's sensor data. Generalizing to other hospitals would require parameterization of the attribute key and seed data (v2 concern).

---

## Rationale and Alternatives

- **Keep using the spreadsheet:** no audit trail, no visibility inside ThingsBoard, no status tracking. Rejected.
- **External CRUD app:** overkill for a one-time fix operation with 29 rows. Rejected.
- **ThingsBoard entity attributes per row:** too granular, harder to query and render atomically. Rejected.
- **Single JSON customer attribute (chosen):** atomic reads/writes, no external dependencies, fits within ThingsBoard's existing API surface.

---

## Prior Art

- `Tabela_Temp_V5` widget — same project, same hospital. Provides the structural template (controller.js, template.html, style.css, settings.schema).

---

## Unresolved Questions

- Should `aposFix` be auto-populated from `updateNewName` SQL parsing, or always filled manually?
- Should rows 018–029 (empty SQL) show a visual indicator that they are pending data collection?

---

## Future Possibilities

- Audit trail / change history (v2).
- Multi-hospital support via parameterized attribute key and seed.
- One-click SQL execution via ThingsBoard RPC (requires backend support).
- Export to PDF/CSV for compliance documentation.
