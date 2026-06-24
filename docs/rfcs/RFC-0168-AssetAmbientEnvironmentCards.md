# RFC 0168: ASSET_AMBIENT-Based Environment Cards

- Feature Name: `asset_ambient_environment_cards`
- Start Date: 2026-02-10
- RFC PR: (to be assigned)
- Status: **Draft**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0158 (MAIN_BAS), RFC-0161 (Ambiente Hierarchy)

---

## Summary

Refactor the `mountAmbientesPanel` in MAIN_BAS controller to render Environment (Ambiente) cards based on `ASSET_AMBIENT` type assets and their aggregated child devices, instead of treating each HVAC device as a separate card.

---

## Motivation

### Current Behavior

The current implementation of `mountAmbientesPanel` treats each TERMOSTATO device as an individual Ambiente card:

```
TERMOSTATO "Temp. Deck Dir."     → Card 1
TERMOSTATO "Temp. Deck Meio"     → Card 2
TERMOSTATO "Temp. Auditório Dir" → Card 3
```

This approach has limitations:
1. **No aggregation**: Related devices (temperature sensor, AC units, remote controls) appear as separate cards
2. **Missing context**: The ASSET parent that groups these devices is not visible
3. **Incomplete data**: Only temperature is shown, not consumption from related energy meters

### Desired Behavior

Cards should be based on `ASSET_AMBIENT` type assets, aggregating all child devices:

```
ASSET_AMBIENT "Sala Nobreak"
  ├─ TERMOSTATO "Temp. Remote Nobreak" → temperature, humidity
  └─ AR_CONDICIONADO_SPLIT "3F Ar Nobreak" → consumption

  Renders as: Single card showing "Sala Nobreak"
              with temperature, humidity, and consumption
```

---

## Guide-level Explanation

### What is an ASSET_AMBIENT?

An `ASSET_AMBIENT` is a ThingsBoard ASSET entity with the attribute `type = "ASSET_AMBIENT"`. It represents a physical environment (room, zone, area) that contains one or more devices.

### Data Structure from ThingsBoard

The "Ambientes" datasource provides ASSET entities with:
- `label`: Display name (e.g., "(002)-Sala do Nobreak")
- `type`: Asset type (e.g., "ASSET_AMBIENT", "default", "ASSET_AMBIENT_INTEGRATION")

The "AllDevices" datasource provides DEVICE entities that are children of these ASSETs.

### Card Display Rules

1. **Label**: Use ASSET's label, removing the `(NNN)-` prefix pattern
   - "(002)-Sala do Nobreak" → "Sala do Nobreak"

2. **Temperature & Humidity**: From child TERMOSTATO device
   - Display temperature in °C
   - Display humidity in % (if available)

3. **Consumption**: Aggregated from child energy devices
   - Sum consumption from 3F_MEDIDOR, FANCOIL, AR_CONDICIONADO_SPLIT devices
   - Display in kW (instantaneous power)

4. **Remote Control**: From child REMOTE device (if present)
   - Show on/off toggle

5. **Setup Warning**: If ASSET_AMBIENT has no children, show warning

---

## Reference-level Explanation

### Data Flow

```
ThingsBoard ctx.data
       │
       ▼
parseDevicesFromData()
       │
       ├─→ ambientes[] (with type: "ASSET_AMBIENT")
       └─→ classified{} (devices by domain/context)
       │
       ▼
buildAmbienteHierarchy()  [Existing - RFC-0161]
       │  Uses Relations API: Device → Parent ASSET
       │
       ▼
_ambienteHierarchy{}
       │  { parentAssetId: { devices: [...], name, aggregatedData } }
       │
       ▼
buildAssetAmbientHierarchy()  [NEW]
       │  Filter by type === "ASSET_AMBIENT"
       │  Add displayLabel (prefix removed)
       │  Flag hasSetupWarning if no children
       │
       ▼
assetAmbientHierarchy{}
       │
       ▼
buildAmbienteCardItems()  [MODIFIED]
       │  Uses assetAmbientToAmbienteData() [NEW]
       │
       ▼
mountAmbientesPanel()  [MODIFIED]
       │
       ▼
CardGridPanel with Ambiente Cards
```

### New Functions

#### 1. buildAssetAmbientHierarchy(parsedAmbientes)

Filters the hierarchy to include only ASSET_AMBIENT type assets.

```typescript
interface AssetAmbientNode {
  id: string;
  name: string;
  assetType: 'ASSET_AMBIENT';
  originalLabel: string;      // "(002)-Sala do Nobreak"
  displayLabel: string;       // "Sala do Nobreak"
  devices: Device[];
  hasSetupWarning: boolean;   // true if devices.length === 0
  aggregatedData: AggregatedData | null;
}

function buildAssetAmbientHierarchy(
  parsedAmbientes: Ambiente[]
): Record<string, AssetAmbientNode>;
```

#### 2. removeAmbientePrefixFromLabel(label)

Removes the "(NNN)-" prefix pattern from labels.

```typescript
function removeAmbientePrefixFromLabel(label: string): string;

// Examples:
// "(002)-Sala do Nobreak" → "Sala do Nobreak"
// "(001)-Deck" → "Deck"
// "Deck - Climatização" → "Deck - Climatização" (no change)
```

#### 3. assetAmbientToAmbienteData(hierarchyNode)

Converts an ASSET_AMBIENT hierarchy node to AmbienteData for card rendering.

```typescript
interface AmbienteData {
  id: string;
  label: string;              // displayLabel from hierarchy
  identifier: string;         // ASSET name
  temperature: number | null; // From TERMOSTATO child
  humidity: number | null;    // From TERMOSTATO child (if available)
  consumption: number | null; // Aggregated from energy devices
  isOn: boolean;              // From REMOTE child
  hasRemote: boolean;         // Has REMOTE child
  status: 'online' | 'offline' | 'warning';
  hasSetupWarning: boolean;   // No children
  devices: DeviceInfo[];      // Child device details
  childDeviceCount: number;   // Total children count
}

function assetAmbientToAmbienteData(
  hierarchyNode: AssetAmbientNode
): AmbienteData;
```

### Device Type Classification

| Device Type | Data Extracted | Display |
|-------------|----------------|---------|
| TERMOSTATO | temperature, humidity | 🌡️ 22.5°C 💧 65% |
| 3F_MEDIDOR | consumption | ⚡ 1.85 kW |
| FANCOIL | consumption | ⚡ (aggregated) |
| AR_CONDICIONADO_SPLIT | consumption | ⚡ (aggregated) |
| REMOTE | isOn, state | 🟢 Ligado / ⚫ Desligado |

### Modified Functions

#### buildAmbienteCardItems(assetAmbientHierarchy, selectedAmbienteId)

Changed from using HVAC devices to using ASSET_AMBIENT hierarchy.

**Before (current):**
```javascript
function buildAmbienteCardItems(classified, selectedAmbienteId) {
  var hvacDevices = getHVACDevicesFromClassified(classified);
  return hvacDevices.map(device => ({
    id: device.id,
    ambienteData: hvacDeviceToAmbienteData(device),
    source: device,
  }));
}
```

**After (RFC-0168):**
```javascript
function buildAmbienteCardItems(assetAmbientHierarchy, selectedAmbienteId) {
  var hierarchyNodes = Object.values(assetAmbientHierarchy);
  return hierarchyNodes.map(node => ({
    id: node.id,
    ambienteData: assetAmbientToAmbienteData(node),
    source: node,
  }));
}
```

#### mountAmbientesPanel(host, settings, assetAmbientHierarchy)

Changed to receive ASSET_AMBIENT hierarchy instead of classified devices.

### Card Rendering Changes

The `renderCardAmbienteV6` component needs updates:

1. **Humidity support**: Display humidity next to temperature
   ```html
   <span>🌡️ 22.5°C</span>
   <span>💧 65%</span>
   ```

2. **Setup warning state**: When `hasSetupWarning === true`
   ```html
   <div class="myio-ambiente-card__warning">
     ⚠️ Setup Required
   </div>
   ```

---

## Implementation Plan

### Phase 1: Capture type in parseDevicesFromData

**File:** `controller.js`
**Location:** Line ~750 (Phase 2 processing)

Add `type` field to ambiente object:
```javascript
ambientes.push({
  id: entityId,
  name: entity.entityName,
  label: entity.entityLabel,
  type: entity.collectedData.type || null,  // ADD
  data: entity.collectedData,
});
```

### Phase 2: Add buildAssetAmbientHierarchy function

**File:** `controller.js`
**Location:** After buildAmbienteHierarchy (~line 342)

New function that filters hierarchy by ASSET_AMBIENT type and removes label prefixes.

### Phase 3: Add assetAmbientToAmbienteData function

**File:** `controller.js`
**Location:** After hvacDeviceToAmbienteData (~line 1265)

New aggregation function for multi-device ambiente data.

### Phase 4: Modify buildAmbienteCardItems

**File:** `controller.js`
**Location:** Line ~1272

Change to use ASSET_AMBIENT hierarchy.

### Phase 5: Modify mountAmbientesPanel

**File:** `controller.js`
**Location:** Line ~1907

Update to receive and use ASSET_AMBIENT hierarchy.

### Phase 6: Update onInit

**File:** `controller.js`
**Location:** Line ~2884

Build ASSET_AMBIENT hierarchy after device hierarchy.

### Phase 7: Update card component

**File:** `template-card-ambiente-v6.js`

Add humidity display and setup warning support.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/thingsboard/bas-components/MAIN_BAS/controller.js` | Add new functions, modify existing functions |
| `src/components/template-card-ambiente-v6/template-card-ambiente-v6.js` | Add humidity, hasSetupWarning support |
| `src/components/template-card-ambiente-v6/types.ts` | Add humidity, hasSetupWarning to AmbienteData type |

---

## Examples

### Example 1: Sala do Nobreak

**ASSET_AMBIENT:**
- name: "Melicidade-SalaNobreak"
- label: "(002)-Sala do Nobreak"
- type: "ASSET_AMBIENT"

**Children:**
1. TERMOSTATO "Temp. Remote Nobreak" - temperature: 24.5°C
2. AR_CONDICIONADO_SPLIT "3F Ar Nobreak" - consumption: 2.1 kW

**Rendered Card:**
```
┌─────────────────────────────────┐
│  Sala do Nobreak           🟢  │
│                                 │
│  🌡️ 24.5°C    ⚡ 2.1 kW        │
│                                 │
│  Melicidade-SalaNobreak         │
└─────────────────────────────────┘
```

### Example 2: Deck Climatização Direita

**ASSET_AMBIENT:**
- name: "Melicidade-Deck-Climatização-Direita"
- label: "Deck - Climatização - Direita"
- type: "ASSET_AMBIENT"

**Children:**
1. TERMOSTATO "Temp. Deck Dir." - temperature: 22.0°C, humidity: 58%
2. FANCOIL "3F Deck Condensadoras" - consumption: 1.2 kW
3. REMOTE "3F Deck Evaporadora" - consumption: 0.8 kW
4. REMOTE "Ar Deck" - isOn: true

**Rendered Card:**
```
┌─────────────────────────────────┐
│  Deck - Climatização - Direita 🟢│
│                                 │
│  🌡️ 22.0°C  💧 58%  ⚡ 2.0 kW  │
│                                 │
│  [🟢 Ligado]                    │
│                                 │
│  Melicidade-Deck-Climatização   │
└─────────────────────────────────┘
```

### Example 3: Empty ASSET_AMBIENT (Setup Warning)

**ASSET_AMBIENT:**
- name: "Melicidade-NewRoom"
- label: "(009)-New Room"
- type: "ASSET_AMBIENT"

**Children:** None

**Rendered Card:**
```
┌─────────────────────────────────┐
│  New Room                  ⚠️  │
│                                 │
│  ⚠️ Configuração Necessária    │
│                                 │
│  Melicidade-NewRoom             │
└─────────────────────────────────┘
```

---

## Backward Compatibility

This change affects only the MAIN_BAS controller and ambiente card rendering. Other widgets and components are not affected.

The change is backward compatible in that:
- If no ASSET_AMBIENT types exist, the panel will show empty state
- Existing device classification logic remains unchanged
- The hierarchy building logic (RFC-0161) is reused, not replaced

---

## Testing

### Unit Tests

1. `buildAssetAmbientHierarchy` correctly filters by type
2. `removeAmbientePrefixFromLabel` handles all prefix patterns
3. `assetAmbientToAmbienteData` aggregates multi-device data correctly

### Integration Tests

1. Full flow from datasource to rendered cards
2. ASSET_AMBIENT with multiple children renders single card
3. ASSET_AMBIENT with no children shows warning

### Manual Tests

1. Load BAS dashboard and verify ambiente cards
2. Verify labels have no "(NNN)-" prefix
3. Verify temperature + humidity display
4. Verify consumption aggregation
5. Verify setup warning for empty ASSETs

---

## Success Criteria

- [ ] Cards render based on ASSET_AMBIENT type, not individual devices
- [ ] Labels correctly remove "(NNN)-" prefix pattern
- [ ] Temperature and humidity display from TERMOSTATO
- [ ] Consumption aggregated from all energy devices
- [ ] Remote toggle works for REMOTE devices
- [ ] Setup warning displays for empty ASSET_AMBIENTs
- [ ] Existing filter and search functionality works

---

## Open Questions

1. Should humidity always be displayed, or only when available?
2. What consumption unit to use: Watts or kW?
3. Should we show device count on the card?

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-02-10 | 1.0 | MYIO Engineering | Initial draft |

---

## References

- [RFC-0158: MAIN_BAS Controller](./RFC-0158-MainBASController.md)
- [RFC-0161: Ambiente Hierarchy](./RFC-0161-AmbienteHierarchy.md)
- [review-structure-ambient.md](../../thingsboard/bas-components/MAIN_BAS/review-structure-ambient.md)
- [CARD_AMBIENTE_V6_ARCHITECTURE.md](../../thingsboard/bas-components/MAIN_BAS/CARD_AMBIENTE_V6_ARCHITECTURE.md)
