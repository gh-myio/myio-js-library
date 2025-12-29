# RFC-0109: Upsell Post-Setup Device Configuration Modal

- **Feature Name:** `upsell_pos_setup_modal`
- **Start Date:** 2025-12-29
- **RFC PR:** (leave this empty)
- **Implementation Issue:** (leave this empty)
- **Status:** Draft
- **Version:** 1.0.0
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

1. **Batch Operations**: Should the modal support selecting multiple devices at once?
2. **Undo/History**: Should we track changes for rollback?
3. **Relation Creation**: If relation is missing, should modal create it automatically?
4. **Validation Strictness**: Should save be blocked if warnings exist, or just warn?

---

## Future Possibilities

1. **Bulk Upsell Mode**: Process multiple devices in sequence
2. **Template Presets**: Save attribute configurations as reusable templates
3. **Audit Log**: Track all changes made via the modal
4. **Webhook Integration**: Notify external systems when device configuration changes
5. **AI Suggestions**: Use ML to improve `deviceType` inference accuracy

---

## Implementation Checklist

- [ ] Create `handleDeviceType()` function and export from `src/index.ts`
- [ ] Implement modal base structure with 3-step navigation
- [ ] Step 1: Customer selection with search
- [ ] Step 2: Device selection with filters (type, profile)
- [ ] Step 3: Attribute validation map UI
- [ ] Implement server-scope attribute fetching
- [ ] Implement relation hierarchy fetching
- [ ] Implement owner validation
- [ ] Implement ingestion device caching
- [ ] Implement `ingestionId` matching via `matchIngestionRecord()`
- [ ] Implement attribute save functionality
- [ ] Add "Upsell" button to Pre-Setup Constructor toolbar
- [ ] Write unit tests for `handleDeviceType()`
- [ ] Write integration tests for modal workflow

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

## Conclusion

RFC-0109 introduces a comprehensive Upsell Post-Setup modal that streamlines device configuration for operators. By combining customer/device search, attribute validation with intelligent suggestions, and relationship verification in a single workflow, this feature significantly reduces the time and effort required to onboard or migrate devices in the MYIO ecosystem.
