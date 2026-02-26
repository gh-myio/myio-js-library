# RFC-0109: Upsell Post-Setup Device Configuration Modal

- **Feature Name:** `upsell_pos_setup_modal`
- **Start Date:** 2025-12-29
- **RFC PR:** (leave this empty)
- **Implementation Issue:** (leave this empty)
- **Status:** Implemented
- **Version:** 1.2.0
- **Author:** MYIO Engineering
- **Target Platform:** ThingsBoard (Custom Widget)
- **Target File:** `src/thingsboard/WIDGET/Pre-Setup-Constructor/v.1.0.9/controller.js`
- **Showcase:** `showcase/upsell-modal.html`

---

## Summary

This RFC defines a new "Upsell" button and multi-step modal wizard for the Pre-Setup-Constructor widget. The modal enables operators to search for existing devices across customers, inspect and validate their server-scope attributes, verify entity relationships, and correct missing or invalid configurations—all without leaving the Pre-Setup interface.

---

## Motivation

### Problem Statement

When onboarding new devices or migrating existing installations, operators often need to:

1. Locate a specific device across multiple customers
2. Validate that required server-scope attributes are properly configured
3. Ensure correct entity relationships (device → asset → customer hierarchy)
4. Fix missing attributes or relationships without navigating away from the Pre-Setup tool

Currently, these tasks require manual navigation through multiple ThingsBoard screens, cross-referencing with Ingestion API data, and manual attribute updates.

### Goals

| Goal | Description |
|------|-------------|
| **Unified Search** | Single interface to find devices across all customers |
| **Attribute Validation** | Visual inspection of required server-scope attributes with warnings for missing/invalid values |
| **Relationship Verification** | Confirm device → asset → customer hierarchy is correct |
| **Auto-Suggestion** | Intelligent defaults for missing attributes based on device name patterns |
| **Ingestion Integration** | Match ThingsBoard devices with Ingestion API records |

### Use Cases

1. **Upsell Scenario**: Customer purchases additional sensors; operator needs to configure new devices with correct attributes
2. **Migration Scenario**: Devices moved between assets/customers; verify and fix relationships
3. **Audit Scenario**: Review device configuration before go-live

---

## Guide-level Explanation

### Modal Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 1: SELECT CUSTOMER                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  🔍 [Search customers...]                                      │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ ○ Customer ABC Shopping                                  │  │  │
│  │  │ ○ Customer XYZ Mall                                      │  │  │
│  │  │ ○ Customer 123 Plaza                                     │  │  │
│  │  │ ...                                                      │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              [Next →]                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 2: SELECT DEVICE                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  🔍 [Search devices...]                                        │  │
│  │  Filter by: [Device Type ▼] [Device Profile ▼]                │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ ○ Sensor-001 (3F_MEDIDOR)                               │  │  │
│  │  │ ○ Sensor-002 (HIDROMETRO)                               │  │  │
│  │  │ ○ Compressor-AC-01 (CHILLER)                            │  │  │
│  │  │ ...                                                      │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                         [← Back] [Next →]                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 STEP 3: ATTRIBUTE VALIDATION MAP                    │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Device: Sensor-001                                            │  │
│  │  ─────────────────────────────────────────────────────────────│  │
│  │                                                                │  │
│  │  3.1 Server-Scope Attributes                                   │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ ✅ centralId:    21.154.001.002                          │  │  │
│  │  │ ✅ slaveId:      5                                       │  │  │
│  │  │ ⚠️ centralName:  [__________________] [Suggest]          │  │  │
│  │  │ ⚠️ deviceType:   [Select... ▼]                           │  │  │
│  │  │ ⚠️ deviceProfile:[Select... ▼]                           │  │  │
│  │  │ ⚠️ identifier:   [__________________]                    │  │  │
│  │  │ ⚠️ ingestionId:  [__________________] [Fetch]            │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  3.2 Relation TO                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ ✅ ASSET: "Loja 101" (id: abc-123)                       │  │  │
│  │  │    └── Parent: CUSTOMER "Shopping ABC"                   │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  3.3 Owner                                                     │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ ✅ CUSTOMER: "Shopping ABC" (matches selected customer)  │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                    [← Back] [Save Changes] [Cancel]                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Validation Status Icons

| Icon | Meaning |
|------|---------|
| ✅ | Attribute is present and valid |
| ⚠️ | Attribute is missing or invalid (requires attention) |
| ❌ | Critical error (e.g., wrong owner) |

---

## Reference-level Explanation

### Server-Scope Attributes Specification

#### 3.1.1 `centralId`

- **Source**: Populated via Node-RED flow
- **Expected Format**: String like `"21.154.001.002"`
- **Validation**: Must be non-empty string
- **UI**: Read-only display

#### 3.1.2 `slaveId`

- **Source**: Populated via Node-RED flow
- **Expected Format**: Integer or numeric string
- **Validation**: Must be non-empty
- **UI**: Read-only display

#### 3.1.3 `centralName`

- **Source**: Node-RED, Pre-Setup, or Ingestion Sync
- **Validation**: If null/empty, show warning
- **Auto-Suggestion**: `"Central <customer name> PADRÃO"`
- **UI**: Editable text field with [Suggest] button

#### 3.1.4 `deviceType`

- **Source**: Node-RED
- **Validation**: If null/empty, show warning with dropdown selection
- **Auto-Suggestion**: Derive from device name using `handleDeviceType()` function

```typescript
function handleDeviceType(name: string): string {
  const upper = (name || '').toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  // ENERGY
  if (upper.includes('COMPRESSOR')) return 'COMPRESSOR';
  if (upper.includes('VENT')) return 'VENTILADOR';
  if (upper.includes('ESRL')) return 'ESCADA_ROLANTE';
  if (upper.includes('ELEV')) return 'ELEVADOR';
  if (
    (upper.includes('MOTR') && !upper.includes('CHILLER')) ||
    upper.includes('MOTOR') ||
    upper.includes('RECALQUE')
  ) return 'MOTOR';

  if (upper.includes('RELOGIO') || upper.includes('RELOG') || upper.includes('REL '))
    return 'RELOGIO';
  if (upper.includes('ENTRADA') || upper.includes('SUBESTACAO') || upper.includes('SUBEST'))
    return 'ENTRADA';

  if (upper.includes('3F')) {
    if (upper.includes('CHILLER')) return 'CHILLER';
    if (upper.includes('FANCOIL')) return 'FANCOIL';
    if (upper.includes('TRAFO')) return 'ENTRADA';
    if (upper.includes('ENTRADA')) return 'ENTRADA';
    if (upper.includes('CAG')) return 'BOMBA_CAG';
    return '3F_MEDIDOR';
  }

  // WATER
  if (upper.includes('HIDR') || upper.includes('BANHEIRO')) return 'HIDROMETRO';
  if (upper.includes('CAIXA DAGUA') || upper.includes('CX DAGUA') ||
      upper.includes('CXDAGUA') || upper.includes('SCD'))
    return 'CAIXA_DAGUA';
  if (upper.includes('TANK') || upper.includes('TANQUE') || upper.includes('RESERVATORIO'))
    return 'TANK';

  // Other
  if (upper.includes('AUTOMATICO')) return 'SELETOR_AUTO_MANUAL';
  if (upper.includes('TERMOSTATO') || upper.includes('TERMO') || upper.includes('TEMP'))
    return 'TERMOSTATO';
  if (upper.includes('ABRE')) return 'SOLENOIDE';
  if (upper.includes('AUTOMACAO') || upper.includes('GW_AUTO')) return 'GLOBAL_AUTOMACAO';
  if (upper.includes(' AC ') || upper.endsWith(' AC')) return 'CONTROLE REMOTO';

  return '3F_MEDIDOR';
}
```

> **Note**: This function MUST be exported from `src/index.ts` for external use.

#### 3.1.5 `deviceProfile`

- **Source**: Ingestion Sync
- **Validation**: If null/empty, suggest based on `deviceType`
- **Selection Rules**:

| If `deviceType` is | Valid `deviceProfile` options |
|-------------------|------------------------------|
| `3F_MEDIDOR` | `3F_MEDIDOR`, `CHILLER`, `TRAFO`, `ENTRADA`, `FANCOIL`, `BOMBA_CAG`, `BOMBA_INCENDIO`, `BOMBA_HIDRAULICA`, `ELEVADOR`, `ESCADA_ROLANTE` |
| `HIDROMETRO` | `HIDROMETRO`, `HIDROMETRO_AREA_COMUM`, `HIDROMETRO_SHOPPING` |
| Other | Suggest same value as `deviceType` |

#### 3.1.6 `identifier`

- **Source**: Ingestion Sync
- **Validation**: If null/empty, show warning
- **Suggestion**: Store LUC code (e.g., `"LUC-101"`) or equipment category (`"ESCADAS_ROLANTES"`, `"ELEVADORES"`, `"CAG"`, `"ENTRADA"`)

#### 3.1.7 `ingestionId`

- **Source**: Ingestion Sync
- **Validation**: If null/empty, show warning with [Fetch] button
- **Matching Logic**: Use existing `matchIngestionRecord()` function

```javascript
const { rec, reason } = matchIngestionRecord(device, ingestionIndex);
// Matches by centralId#slaveId lookup
```

### Ingestion API Integration

#### Authentication

```javascript
const AUTH_URL = 'https://api.data.apps.myio-bas.com/api/v1/auth';

// Credentials passed via modal parameters
interface UpsellModalParams {
  thingsboardToken: string;  // localStorage.getItem('jwt_token')
  ingestionToken: string;    // Pre-authenticated JWT from MyIOAuth
}
```

#### Caching Strategy

To avoid repeated API calls when processing multiple devices:

```typescript
interface IngestionCache {
  customerId: string;
  devices: IngestionDevice[];
  timestamp: number;
  ttl: number; // Cache TTL in ms (e.g., 5 minutes)
}

// Cache is keyed by customerId
const ingestionDeviceCache = new Map<string, IngestionCache>();
```

### Relation Validation (3.2)

Reference: `src/thingsboard/WIDGET/Pre-Setup-Constructor/v.1.0.9/KNOWLEDGE.md`

#### Expected Hierarchy

```
CUSTOMER
  └── ASSET (optional intermediate levels)
        └── DEVICE
```

#### Validation Rules

1. Device MUST have exactly ONE "TO" relation
2. Relation target MUST be either:
   - An ASSET that is under the selected CUSTOMER hierarchy, OR
   - Directly to the CUSTOMER (if no ASSET exists)
3. If multiple or zero relations exist, show warning

### Owner Validation (3.3)

- Device `customerId` MUST match the selected customer
- If mismatch, show error with option to reassign

---

## Modal Component Architecture

### Injection Pattern

The modal MUST be fully injectable, receiving all dependencies via parameters:

```typescript
interface UpsellModalConfig {
  // Tokens
  thingsboardToken: string;
  ingestionToken: string;

  // API Endpoints (optional overrides)
  tbApiBase?: string;       // Default: current ThingsBoard instance
  ingestionApiBase?: string; // Default: 'https://api.data.apps.myio-bas.com'

  // Callbacks
  onSave?: (deviceId: string, attributes: Record<string, any>) => void;
  onCancel?: () => void;
}

function openUpsellModal(config: UpsellModalConfig): void {
  // Create and inject modal into DOM
}
```

### API Operations

| Operation | ThingsBoard API | Ingestion API |
|-----------|-----------------|---------------|
| List customers | `GET /api/customers?pageSize=1000` | - |
| List devices | `GET /api/customer/{id}/devices` | `GET /api/v1/devices?customer_id={id}` |
| Get attributes | `GET /api/plugins/telemetry/DEVICE/{id}/values/attributes/SERVER_SCOPE` | - |
| Save attributes | `POST /api/plugins/telemetry/DEVICE/{id}/attributes/SERVER_SCOPE` | - |
| Get relations | `GET /api/relations?fromId={id}&fromType=DEVICE` | - |
| Save relation | `POST /api/relation` | - |

---

## Drawbacks

1. **Complexity**: Multi-step wizard adds UI complexity
2. **API Dependencies**: Requires both ThingsBoard and Ingestion API availability
3. **Token Management**: Must handle two separate authentication tokens
4. **Cache Invalidation**: Ingestion cache may become stale during long sessions

---

## Rationale and Alternatives

### Why Multi-Step Wizard?

The multi-step approach:
- Reduces cognitive load by presenting one decision at a time
- Allows filtering at each level (customer → device)
- Provides clear context for attribute validation

### Alternatives Considered

#### Alternative 1: Single-Page Form

Display all options on one page with cascading dropdowns.

**Rejected**: Too overwhelming for users with many customers/devices.

#### Alternative 2: Spreadsheet Import

Allow bulk attribute updates via CSV upload.

**Rejected**: Doesn't support the interactive validation workflow needed for upsell scenarios.

---

## Prior Art

- **Pre-Setup Constructor**: Existing widget provides device configuration UI
- **Ingestion Sync**: Existing function `runIngestionSyncFromList()` handles attribute synchronization
- **RFC-0071**: Device profile attribute sync implementation

---

## Unresolved Questions

1. ~~**Batch Operations**: Should the modal support selecting multiple devices at once?~~ **RESOLVED: v1.1.0**
2. **Undo/History**: Should we track changes for rollback?
3. **Relation Creation**: If relation is missing, should modal create it automatically?
4. **Validation Strictness**: Should save be blocked if warnings exist, or just warn?

---

## Future Possibilities

1. ~~**Bulk Upsell Mode**: Process multiple devices in sequence~~ **IMPLEMENTED v1.1.0**
2. **Template Presets**: Save attribute configurations as reusable templates
3. **Audit Log**: Track all changes made via the modal
4. **Webhook Integration**: Notify external systems when device configuration changes
5. **AI Suggestions**: Use ML to improve `deviceType` inference accuracy

---

## Version 1.1.0 - Multiselect & Bulk Attribute Update

### New Features

#### Device Selection Modes

The modal now supports two selection modes in Step 2 (Device Selection):

| Mode | Description | Next Button | Bulk Actions |
|------|-------------|-------------|--------------|
| **Single** | Traditional single-device selection | Enabled | - |
| **Multi** | Select multiple devices with checkboxes | Disabled | Enabled |

#### Mode Toggle UI

```
┌─────────────────────────────────────────────────────────────────┐
│  📍 Cliente: Shopping ABC (25/50 devices)                        │
│  ┌─────────────────────┐                                         │
│  │ Modo: [Single] [Multi]                                       │
│  └─────────────────────┘                                         │
│  ✓ 5 selecionados [Todos] [Limpar]                              │
└─────────────────────────────────────────────────────────────────┘
```

#### Multiselect Controls

| Control | Description |
|---------|-------------|
| **Single/Multi Toggle** | Switch between selection modes |
| **Checkbox Column** | Visible only in Multi mode |
| **Select All** | Selects all filtered/visible devices |
| **Clear Selection** | Deselects all devices |
| **Counter** | Shows "✓ N selecionados" |

#### Bulk Attribute Update

When in Multi mode with devices selected, a new "Forçar Atributo" button appears in the footer:

```
┌─────────────────────────────────────────────────────────────────┐
│ [⚡ Forçar Atributo (5)]  [Cancelar]  [Próximo → (disabled)]    │
└─────────────────────────────────────────────────────────────────┘
```

Clicking opens a modal to set a single SERVER_SCOPE attribute across all selected devices:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚡ Forçar Atributo                                        [✕]  │
│  ───────────────────────────────────────────────────────────────│
│  Devices selecionados: 5 dispositivos                           │
│                                                                  │
│  Atributo (SERVER_SCOPE)                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ deviceType                                           ▼  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Valor                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ HIDROMETRO                                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│                    [Cancelar]  [Salvar para 5 devices]          │
└─────────────────────────────────────────────────────────────────┘
```

#### Available Bulk Attributes

| Attribute | Description |
|-----------|-------------|
| `deviceType` | Device type classification |
| `deviceProfile` | Device profile for telemetry parsing |
| `centralName` | Name of the central/gateway |
| `centralId` | ID of the central/gateway |
| `identifier` | Store identifier (LUC code) |

### State Changes

```typescript
interface ModalState {
  // ... existing fields ...

  // NEW: Multiselect support
  deviceSelectionMode: 'single' | 'multi';
  selectedDevices: Device[];
  bulkAttributeModal: {
    open: boolean;
    attribute: string;
    value: string;
    saving: boolean;
  };
}
```

### API Operations

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| Save bulk attribute | `POST /api/plugins/telemetry/DEVICE/{id}/attributes/SERVER_SCOPE` | Called sequentially for each selected device |

### Error Handling

The bulk save operation provides detailed feedback:

- **Success**: "✅ Atributo "deviceType" salvo com sucesso para 5 dispositivos!"
- **Partial Success**: "⚠️ Atributo salvo para 3 dispositivos. ❌ Erro em 2 dispositivos: [error details]"
- **Validation Errors**: Alerts if attribute or value is empty

### Grid Enhancements (v1.1.0)

The device grid was also improved with:

| Feature | Description |
|---------|-------------|
| **Fixed Header** | Column headers with uppercase labels |
| **Flex Columns** | Name (flex:3), Label (flex:2) expand proportionally |
| **Date/Time** | Shows DD/MM/YYYY HH:MM format |
| **Tooltips** | Hover to see full text on truncated fields |
| **Type Badge** | Color-coded badge for device type |

---

## Implementation Checklist

### v1.0.0 (Core Implementation)

- [x] Create `handleDeviceType()` function and export from `src/index.ts`
- [x] Implement modal base structure with 3-step navigation
- [x] Step 1: Customer selection with search
- [x] Step 2: Device selection with filters (type, profile)
- [x] Step 3: Attribute validation map UI
- [x] Implement server-scope attribute fetching
- [x] Implement relation hierarchy fetching
- [x] Implement owner validation
- [ ] Implement ingestion device caching
- [ ] Implement `ingestionId` matching via `matchIngestionRecord()`
- [x] Implement attribute save functionality
- [ ] Add "Upsell" button to Pre-Setup Constructor toolbar
- [ ] Write unit tests for `handleDeviceType()`
- [ ] Write integration tests for modal workflow

### v1.1.0 (Multiselect & Bulk Update)

- [x] Add device selection mode toggle (Single/Multi)
- [x] Implement checkbox column for multi-select
- [x] Add "Select All" button for filtered devices
- [x] Add "Clear Selection" button
- [x] Add selection counter display
- [x] Implement "Forçar Atributo" bulk action button
- [x] Implement bulk attribute modal UI
- [x] Implement `saveBulkAttribute()` function
- [x] Add attribute dropdown (deviceType, deviceProfile, centralName, centralId, identifier)
- [x] Implement sequential API calls with error handling
- [x] Add success/error feedback messages
- [x] Disable "Next" button in multi-select mode
- [x] Improve device grid with fixed header
- [x] Add date/time format (DD/MM/YYYY HH:MM)
- [x] Add tooltips for truncated text

### v1.2.0 (Grid Improvements, Owner/Relations, Drag-Resize)

- [x] Grid height responsive to maximize state (calc(100vh - 340px))
- [x] Refactor grid: Label column with (ⓘ) info tooltip showing name/id/type/created
- [x] Separate type (device.type) and deviceType (serverAttrs.deviceType) columns
- [x] Add deviceProfile column from serverAttrs.deviceProfile
- [x] Add Telemetry column (pulses, consumption, temperature) with (+) timestamp tooltip
- [x] Add Status column (connectionStatus) with (+) timestamp tooltip
- [x] Separate filters: type, deviceType, deviceProfile
- [x] Implement drag-resize for column widths
- [x] Implement loadDeviceAttrsInBatch() for SERVER_SCOPE attributes
- [x] Implement loadDeviceTelemetryInBatch() for latest telemetry
- [x] Add progress indicator while loading attrs
- [x] Implement owner change functionality with changeDeviceOwner()
- [x] Implement relation add with createRelation()
- [x] Implement relation delete with deleteRelation()
- [x] Add tbDelete() API helper function

---

## Version 1.2.0 - Grid Improvements, Owner/Relations, Drag-Resize

### Grid Height Responsive

The device grid now adjusts its height based on modal maximize state:

| State | Grid Height |
|-------|-------------|
| Normal | 360px |
| Maximized | calc(100vh - 340px) |

### Refactored Grid Layout

| Column | Width | Content |
|--------|-------|---------|
| Checkbox | 28px | Multi-select checkbox (only in Multi mode) |
| Icon | 28px | Device type icon |
| Label | 140px (resizable) | device.label or device.name + (ⓘ) info button |
| Type | 70px (resizable) | device.type (badge) |
| deviceType | 80px (resizable) | serverAttrs.deviceType |
| deviceProfile | 90px (resizable) | serverAttrs.deviceProfile |
| Telemetry | 100px (resizable) | pulses/consumption/temperature + (+) timestamp |
| Status | 70px (resizable) | connectionStatus badge + (+) timestamp |
| Selection | 24px | ✓ indicator |

### Info Tooltip (ⓘ)

Hovering over the (ⓘ) button shows a tooltip with:
- Device Name
- Device ID
- Device Type
- Created Time

### Telemetry Display

Priority order for displaying telemetry value:
1. consumption (if available)
2. pulses (if available)
3. temperature (if available)

Each with (+) button that shows timestamp on hover.

### Status Colors

| Status | Background | Text |
|--------|------------|------|
| online | #dcfce7 | #166534 |
| offline | #fee2e2 | #991b1b |
| waiting | #fef3c7 | #92400e |
| bad | #fce7f3 | #9d174d |

### Separate Filters

| Filter | Source |
|--------|--------|
| Type | device.type (ThingsBoard entity) |
| deviceType | serverAttrs.deviceType (SERVER_SCOPE) |
| deviceProfile | serverAttrs.deviceProfile (SERVER_SCOPE) |

### Drag-Resize Columns

Column widths can be adjusted by dragging the right edge of each header cell:
- Minimum width: 50px
- Widths persist in state during session

### Owner Management (Step 3)

| Button | Description |
|--------|-------------|
| **Alterar** | Show form to change owner (when valid) |
| **Corrigir** | Show form to fix owner (when invalid) |

Form includes:
- New Customer ID input
- Helper text with current customer ID for quick copy

### Relation Management (Step 3)

| Button | Description |
|--------|-------------|
| **Adicionar** | Show form to create new relation |
| **Remover** | Delete existing relation (with confirmation) |

Form includes:
- Entity Type select (ASSET or CUSTOMER)
- Entity ID input

### New API Functions

| Function | Endpoint | Method |
|----------|----------|--------|
| changeDeviceOwner | /api/customer/{customerId}/device/{deviceId} | POST |
| createRelation | /api/relation | POST |
| deleteRelation | /api/relation?... | DELETE |
| tbDelete | (any path) | DELETE |

### Data Loading

Two new async functions load device data in background:

**loadDeviceAttrsInBatch()**
- Loads SERVER_SCOPE attributes for all devices
- Batch size: 50 devices
- Progress shown as "⏳ carregando attrs..."

**loadDeviceTelemetryInBatch()**
- Loads latest telemetry (pulses, consumption, temperature, connectionStatus)
- Batch size: 50 devices

---

## Appendix A: Device Type Mapping Reference

| Pattern Match | Returns |
|--------------|---------|
| `COMPRESSOR` | `COMPRESSOR` |
| `VENT` | `VENTILADOR` |
| `ESRL` | `ESCADA_ROLANTE` |
| `ELEV` | `ELEVADOR` |
| `MOTR`, `MOTOR`, `RECALQUE` (not CHILLER) | `MOTOR` |
| `RELOGIO`, `RELOG`, `REL ` | `RELOGIO` |
| `ENTRADA`, `SUBESTACAO`, `SUBEST` | `ENTRADA` |
| `3F` + `CHILLER` | `CHILLER` |
| `3F` + `FANCOIL` | `FANCOIL` |
| `3F` + `TRAFO` | `ENTRADA` |
| `3F` + `CAG` | `BOMBA_CAG` |
| `3F` (other) | `3F_MEDIDOR` |
| `HIDR`, `BANHEIRO` | `HIDROMETRO` |
| `CAIXA DAGUA`, `CX DAGUA`, `SCD` | `CAIXA_DAGUA` |
| `TANK`, `TANQUE`, `RESERVATORIO` | `TANK` |
| `AUTOMATICO` | `SELETOR_AUTO_MANUAL` |
| `TERMOSTATO`, `TERMO`, `TEMP` | `TERMOSTATO` |
| `ABRE` | `SOLENOIDE` |
| `AUTOMACAO`, `GW_AUTO` | `GLOBAL_AUTOMACAO` |
| ` AC `, ends with ` AC` | `CONTROLE REMOTO` |
| Default | `3F_MEDIDOR` |

---

## Appendix B: Device Profile Allowed Values

### For `deviceType = 3F_MEDIDOR`

```
3F_MEDIDOR (actual store meter)
CHILLER
TRAFO
ENTRADA
FANCOIL
BOMBA_CAG
BOMBA_INCENDIO
BOMBA_HIDRAULICA
ELEVADOR
ESCADA_ROLANTE
```

### For `deviceType = HIDROMETRO`

```
HIDROMETRO (actual store meter)
HIDROMETRO_AREA_COMUM
HIDROMETRO_SHOPPING
```

---

## Showcase & Validation

A standalone HTML showcase is provided at `showcase/upsell-modal.html` for UI/UX validation before integration into the Pre-Setup Constructor widget.

### Running the Showcase

```bash
# Open directly in browser
start showcase/upsell-modal.html

# Or serve via local server
npx serve showcase
```

### Mock Data Included

The showcase includes mock data for:

| Data Type | Mock Count | Purpose |
|-----------|------------|---------|
| Customers | 5 | Test customer search/filter |
| Devices per customer | 10-20 | Test device list with various types |
| Server-scope attributes | Mixed | Test validation states (valid, missing, invalid) |
| Relations | Various | Test hierarchy validation |
| Ingestion records | Matching subset | Test ingestion ID matching |

### Validation Scenarios

The showcase allows testing:

1. **Happy Path**: Device with all attributes correctly populated
2. **Missing Attributes**: Device with null/empty attributes triggering warnings
3. **Invalid Owner**: Device assigned to wrong customer
4. **Missing Relation**: Device without proper TO relation
5. **Ingestion Mismatch**: Device that cannot be matched in Ingestion API
6. **Auto-Suggestion**: Test `handleDeviceType()` suggestions

---

## Version 1.3.0 — GCDR-Upsell-Setup Widget, preselectedCustomer, Grid UX Enhancements

**Date:** 2026-02-26
**Branch:** `fix/rfc-0152-real-data`

### Motivation

1. The Upsell modal was embedded inside `Pre-Setup-Constructor`, making it unavailable to other panels.
2. Opening the modal from a panel that already knows the active customer forced the user to re-select it at Step 1.
3. The device grid lacked `name` as a distinct column (previously merged with `label`), had no `centralId`/`slaveId` columns, could not sort by every column, and searched only a subset of fields.

---

### New Widget: `GCDR-Upsell-Setup/v.1.0.0`

A dedicated, standalone ThingsBoard widget that wraps the Upsell modal.

| File | Description |
|------|-------------|
| `src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/controller.js` | Widget controller — calls `openUpsellModal` from `myio-js-library` |
| `src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/template.html` | Widget HTML template |
| `src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/styles.css` | Widget styles |

**UI Elements:**

| Element | Description |
|---------|-------------|
| Customer search dropdown | Searches ThingsBoard customers and displays the selected one |
| "Carregar Cliente" button | Opens the Upsell modal, skipping Step 1 if a customer is already selected |

**Library Loading:**
The controller calls `guLoadMyIOLibrary()` which checks `window.MyIOLibrary` first. If already loaded (e.g., by showcase pre-load or another widget), the CDN load is skipped. Otherwise it loads from the npm CDN.

---

### Updated Widget: `Pre-Setup-Constructor/v.2.0.0`

A cleaned version of `v.1.0.9` with the following removed:

| Removed | Notes |
|---------|-------|
| `loadMyIOLibrary()` function | Delegated to `GCDR-Upsell-Setup` |
| Upsell button (`upsell-modal`) | Moved to `GCDR-Upsell-Setup` |
| GCDR Sync button (`gcdr-sync`) | Moved to `GCDR-Upsell-Setup` |
| Two toolbar buttons HTML | Clean toolbar |

**File:** `src/thingsboard/WIDGET/Pre-Setup-Constructor/v.2.0.0/controller.js`

---

### New Parameter: `preselectedCustomer`

Added to `UpsellModalParams` in `src/components/premium-modals/upsell/types.ts`:

```typescript
preselectedCustomer?: { id: string; name: string };
```

**Behavior:**

| `preselectedCustomer` | Opens at | First load call |
|-----------------------|----------|-----------------|
| Not provided | Step 1 (Customer Selection) | `loadCustomers()` |
| Provided | Step 2 (Device List) | `loadDevices()` |

**Implementation in `openUpsellModal.ts`:**

```typescript
if (params.preselectedCustomer) {
  state.selectedCustomer = {
    id: { entityType: 'CUSTOMER', id: params.preselectedCustomer.id },
    name: params.preselectedCustomer.name,
  };
  state.currentStep = 2;
}

// ...after container creation...

if (params.preselectedCustomer) {
  loadDevices(state, modalContainer, modalId, t, params.onClose);
} else {
  loadCustomers(state, modalContainer, modalId, t, params.onClose);
}
```

**Usage in GCDR-Upsell-Setup controller:**

```javascript
openUpsellModal({
  // ...other params...
  preselectedCustomer: { id: selectedCustomer.id, name: selectedCustomer.name },
});
```

---

### Grid: Separated `name` and `label` Columns

Previously `label` fell back to `name` when null. Now they are distinct:

| Column | Content | Fallback |
|--------|---------|---------|
| `name` | `device.name` (bold) | — (always has value) |
| `label` | `device.label` | Empty string (never falls back to name) |

**Column widths updated:**

| Column | Width |
|--------|-------|
| `name` | 180px |
| `label` | 120px (reduced from 280px) |

---

### Grid: `centralId` and `slaveId` Columns

Two new columns appear after `relationTo`:

| Column | Source | State: not loaded | State: loaded |
|--------|--------|-------------------|---------------|
| `centralId 🔒` | `device.serverAttrs.centralId` | Empty | Populated |
| `slaveId 🔒` | `device.serverAttrs.slaveId` | Empty | Populated |

The `🔒` lock icon is removed from the header label once `state.deviceAttrsLoaded === true` (i.e., after "Carregar Atributos" is clicked), matching the existing pattern for `devType` and `devProfile`.

**Column widths:**

| Column | Width |
|--------|-------|
| `centralId` | 80px |
| `slaveId` | 60px |

---

### Grid: All Columns Sortable

All 8 device columns now support ascending/descending sort toggle:

| Column | Sort Type |
|--------|-----------|
| `name` | String (localeCompare) |
| `label` | String (localeCompare) |
| `type` | String (localeCompare) |
| `createdTime` | Numeric |
| `deviceType` | String (localeCompare) |
| `deviceProfile` | String (localeCompare) |
| `centralId` | String (localeCompare, lowercased) |
| `slaveId` | Numeric (localeCompare with `{ numeric: true }`) |

Click once → ascending (`▲`). Click again → descending (`▼`). Default state indicator: `▽`.

**`DeviceSortField` type updated:**

```typescript
type DeviceSortField = 'name' | 'label' | 'createdTime' | 'type' | 'deviceType' | 'deviceProfile' | 'centralId' | 'slaveId';
```

---

### Grid: Hybrid Search (7 Fields)

The single search input now searches across 7 fields simultaneously:

| Field | Source |
|-------|--------|
| `name` | `device.name` |
| `label` | `device.label` |
| `type` | `device.type` |
| `deviceType` | `device.serverAttrs.deviceType` |
| `deviceProfile` | `device.serverAttrs.deviceProfile` |
| `slaveId` | `device.serverAttrs.slaveId` |
| `status` | `device.latestTelemetry.connectionStatus.value` |

**Bug fixed in this version:** `sortedDevices` was previously built from `filteredDevices` (only dropdown filters applied), ignoring the search text. Now correctly uses `searchFilteredDevices` — so both dropdown filters and text search apply before sorting.

---

### Showcase: `showcase/gcdr-upsell-setup/`

New showcase for the `GCDR-Upsell-Setup` widget, port **3340**:

| File | Description |
|------|-------------|
| `showcase/gcdr-upsell-setup/index.html` | Main showcase page |
| `showcase/gcdr-upsell-setup/start-server.bat` | Windows: starts `npx serve` on port 3340 |
| `showcase/gcdr-upsell-setup/start-server.sh` | Unix: starts `npx serve` on port 3340 |
| `showcase/gcdr-upsell-setup/stop-server.bat` | Windows: kills process on port 3340 |
| `showcase/gcdr-upsell-setup/stop-server.sh` | Unix: kills process on port 3340 |

**Key features:**

- **Ghost auth**: auto-runs on `DOMContentLoaded`, stores JWT in `localStorage.jwt_token`
- **Fetch proxy**: intercepts relative `/api/*` calls and redirects to `https://dashboard.myio-bas.com` with `X-Authorization` header
- **Local UMD pre-load**: loads `../../dist/myio-js-library.umd.js` before `controller.js` so `guLoadMyIOLibrary()` finds `window.MyIOLibrary` already set and skips CDN (required for testing features not yet on `@latest`)

```html
<!-- Load local build first so controller.js uses it instead of CDN -->
<script>
  document.write('<script src="../../dist/myio-js-library.umd.js?v=' + Date.now() + '"><\/script>');
</script>
<script src="../../src/thingsboard/WIDGET/GCDR-Upsell-Setup/v.1.0.0/controller.js"></script>
```

---

### Implementation Checklist (v1.3.0)

- [x] Add `preselectedCustomer` to `UpsellModalParams` (`types.ts`)
- [x] Handle `preselectedCustomer` in `openUpsellModal` — set state and skip Step 1
- [x] Separate `name` and `label` into distinct grid columns
- [x] Add `centralId` column to grid (locked until attrs loaded)
- [x] Add `slaveId` column to grid (locked until attrs loaded)
- [x] Add `centralId` and `slaveId` sort cases to `sortDevices()`
- [x] Extend `DeviceSortField` type with `centralId | slaveId`
- [x] Make all 8 columns sortable via `renderSortableHeader`
- [x] Extend hybrid search to 7 fields (add `slaveId`, `status`)
- [x] Fix search bug: `sortedDevices` now uses `searchFilteredDevices`
- [x] Create `GCDR-Upsell-Setup/v.1.0.0` widget (controller, template, styles)
- [x] Create `Pre-Setup-Constructor/v.2.0.0` (clean version without upsell/gcdr)
- [x] Create `showcase/gcdr-upsell-setup/` with ghost auth, fetch proxy, local UMD pre-load

---

## Conclusion

RFC-0109 introduces a comprehensive Upsell Post-Setup modal that streamlines device configuration for operators. By combining customer/device search, attribute validation with intelligent suggestions, and relationship verification in a single workflow, this feature significantly reduces the time and effort required to onboard or migrate devices in the MYIO ecosystem.
