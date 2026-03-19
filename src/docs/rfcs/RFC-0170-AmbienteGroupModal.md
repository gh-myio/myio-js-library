# RFC 0170: Ambiente Group Modal Component

- Feature Name: `ambiente_group_modal`
- Start Date: 2026-02-11
- RFC PR: (to be assigned)
- Status: **Implemented**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0168 (ASSET_AMBIENT Environment Cards), RFC-0169 (Ambiente Detail Modal)

---

## Summary

A modal component that displays aggregated information from multiple sub-ambientes when clicking on a parent ambiente in the sidebar (EntityListPanel). For example, clicking "Deck" shows combined metrics from "Deck - Climatizacao - Direita", "Deck - Climatizacao - Esquerda", and "Deck - Iluminacao".

---

## Motivation

### Problem

When users click on a parent ambiente in the sidebar (e.g., "Deck"), they need to see:
1. Aggregated metrics (temperature average, total consumption) across all sub-ambientes
2. Status overview (how many sub-ambientes are online/offline)
3. Individual sub-ambiente details with their specific metrics
4. Quick access to remote controls for each sub-ambiente

### Solution

Create a group modal that:
1. Finds all sub-ambientes matching the parent label pattern
2. Calculates aggregated metrics (averages, totals, min/max)
3. Displays expandable cards for each sub-ambiente
4. Provides remote control toggles within each sub-ambiente card

---

## Guide-level Explanation

### What is the Ambiente Group Modal?

The `AmbienteGroupModal` is a popup dialog that appears when a user clicks on a parent ambiente in the sidebar. It shows:

1. **Summary Cards**: Aggregated temperature, humidity, consumption, device count
2. **Status Bar**: Online/offline counts
3. **Sub-Ambiente List**: Expandable cards for each child ambiente

### Modal Layout

```
+--------------------------------------------------+
|  🏢 Deck                                    [X]  |  <- Header
|  3 sub-ambientes                                 |
+--------------------------------------------------+
|  +--------+  +--------+  +--------+  +--------+  +--------+
|  | 🌡️    |  | 💧    |  | ⚡     |  | 📱    |  | 🏢    |
|  | 23.5°C |  | 55%    |  | 4.2 kW |  | 12     |  | 3     |
|  | Temp   |  | Humid  |  | Consumo|  | Devices|  | Subs  |
|  +--------+  +--------+  +--------+  +--------+  +--------+
|                                                  |
|  [🟢 2 Online]  [🔴 1 Offline]                   |
|                                                  |
|  🏢 Sub-Ambientes (3)                            |
|  +----------------------------------------------+|
|  | 🟢 Deck - Climatizacao - Direita   22°C 2.1kW|▶||
|  +----------------------------------------------+|
|  | 🟢 Deck - Climatizacao - Esquerda  24°C 1.8kW|▶||
|  +----------------------------------------------+|
|  | 🔴 Deck - Iluminacao               -    0.3kW|▶||
|  +----------------------------------------------+|
+--------------------------------------------------+
|                                       [Fechar]   |
+--------------------------------------------------+
```

### Expanded Sub-Ambiente

When clicking on a sub-ambiente header, it expands to show:
- Device grid with individual device info
- Remote control buttons (if available)

```
+----------------------------------------------+
| 🟢 Deck - Climatizacao - Direita  22°C 2.1kW |▼|
+----------------------------------------------+
| +----------+  +----------+  +----------+     |
| | ⚡ 3F    |  | ⚡ Fan   |  | 🌡️ Temp |     |
| | Ar Deck  |  | coil     |  | Sensor   |     |
| | 1.2 kW   |  | 0.9 kW   |  |          |     |
| +----------+  +----------+  +----------+     |
|                                              |
| [🟢 Ar Deck ON] [🟢 Fancoil ON]              |
+----------------------------------------------+
```

---

## Reference-level Explanation

### Data Flow

```
Sidebar Item Click (e.g., "Deck")
       │
       ▼
handleClickItem(item)
       │
       └─→ openAmbienteGroupModal(item, settings)
              │
              ▼
       findSubAmbientesForParent(item)
              │  Searches _assetAmbientHierarchy
              │  Matches by label prefix pattern
              │
              ▼
       subAmbientes[] (array of matching nodes)
              │
              ▼
       buildAmbienteGroupData() or fallback
              │
              ▼
       MyIOLibrary.openAmbienteGroupModal(groupData, config)
              │
              ▼
       Group Modal Opens
              │
              ├─→ Sub-ambiente click → openAmbienteDetailModal()
              └─→ Remote toggle → dispatch 'bas:ambiente-remote-toggle'
```

### Component API

#### Types

```typescript
interface SubAmbienteItem {
  id: string;
  label: string;
  name: string;
  ambienteData: AmbienteData;
  source: AmbienteHierarchyNode | null;
}

interface AggregatedGroupMetrics {
  temperatureAvg: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidityAvg: number | null;
  consumptionTotal: number | null;
  deviceCount: number;
  onlineCount: number;
  offlineCount: number;
  subAmbienteCount: number;
}

interface AmbienteGroupData {
  id: string;
  label: string;
  name: string;
  metrics: AggregatedGroupMetrics;
  subAmbientes: SubAmbienteItem[];
  status: 'online' | 'offline' | 'partial' | 'warning';
}

interface AmbienteGroupModalConfig {
  themeMode?: 'light' | 'dark';
  onSubAmbienteClick?: (subAmbiente: SubAmbienteItem) => void;
  onRemoteToggle?: (isOn: boolean, subAmbiente: SubAmbienteItem, remoteId: string) => void;
  onClose?: () => void;
}

interface AmbienteGroupModalInstance {
  open: () => void;
  close: () => void;
  update: (data: AmbienteGroupData) => void;
  destroy: () => void;
}
```

#### Functions

```typescript
// Create modal instance
function createAmbienteGroupModal(
  data: AmbienteGroupData,
  config?: AmbienteGroupModalConfig
): AmbienteGroupModalInstance;

// Convenience function - creates and opens modal
function openAmbienteGroupModal(
  data: AmbienteGroupData,
  config?: AmbienteGroupModalConfig
): AmbienteGroupModalInstance;

// Build group data from sub-ambientes
function buildAmbienteGroupData(
  groupId: string,
  groupLabel: string,
  groupName: string,
  subAmbientes: SubAmbienteItem[]
): AmbienteGroupData;

// Calculate aggregated metrics
function calculateGroupMetrics(
  subAmbientes: SubAmbienteItem[]
): AggregatedGroupMetrics;
```

### Sub-Ambiente Matching Logic

The `findSubAmbientesForParent` function matches sub-ambientes by:

1. **Exact match**: `nodeLabel === parentLabel`
2. **Prefix with dash**: `nodeLabel.startsWith(parentLabel + ' - ')`
3. **Prefix with space**: `nodeLabel.startsWith(parentLabel + ' ')`
4. **Name-based**: `node.name.includes(parentName.split('-')[0])`

Examples:
- Parent: "Deck" matches "Deck", "Deck - Climatizacao", "Deck - Iluminacao"
- Parent: "Auditorio" matches "Auditorio", "Auditorio - Palco", "Auditorio - Plateia"

### CSS Classes

| Class | Description |
|-------|-------------|
| `.myio-ambiente-group-overlay` | Overlay backdrop |
| `.myio-ambiente-group` | Main modal container |
| `.myio-ambiente-group__summary` | Summary cards grid |
| `.myio-ambiente-group__summary-card` | Individual summary card |
| `.myio-ambiente-group__status-bar` | Online/offline status bar |
| `.myio-ambiente-group__subambientes` | Sub-ambientes container |
| `.myio-ambiente-group__subambiente` | Individual sub-ambiente card |
| `.myio-ambiente-group__subambiente-header` | Clickable header row |
| `.myio-ambiente-group__subambiente-details` | Expandable details section |
| `.myio-ambiente-group__devices-grid` | Device grid within details |
| `.myio-ambiente-group__remotes` | Remote controls container |

---

## Implementation Details

### File Structure

```
src/components/ambiente-group-modal/
├── AmbienteGroupModal.ts   # Main component logic
├── styles.ts               # CSS-in-JS styles
├── types.ts                # TypeScript interfaces
└── index.ts                # Public exports
```

### Controller Integration

In `controller.js`, the modal is triggered from the sidebar click:

```javascript
handleClickItem: function (item) {
  _selectedAmbiente = item.id;

  // RFC-0170: Open Ambiente Group Modal for aggregated view
  openAmbienteGroupModal(item, settings);

  // Continue with existing filtering logic...
}
```

The `openAmbienteGroupModal` function:
1. Calls `findSubAmbientesForParent` to find matching sub-ambientes
2. If no matches, opens single detail modal (RFC-0169)
3. If only 1 exact match, opens detail modal instead
4. Otherwise, builds group data and opens group modal

---

## Aggregation Logic

### Temperature
- **Average**: Sum of all temperatures / count of non-null values
- **Min/Max**: Displayed as range (e.g., "22° - 26°")

### Humidity
- **Average**: Sum of all humidities / count of non-null values

### Consumption
- **Total**: Sum of all consumption values

### Device Count
- **Total**: Sum of childDeviceCount from all sub-ambientes

### Status
- **online**: All sub-ambientes online
- **partial**: Some online, some offline
- **offline**: All offline
- **warning**: Has setup warnings

---

## Examples

### Example 1: Group with Multiple Sub-Ambientes

```typescript
const groupData = {
  id: 'deck-group',
  label: 'Deck',
  name: 'Melicidade-Deck',
  metrics: {
    temperatureAvg: 23.5,
    temperatureMin: 22.0,
    temperatureMax: 25.0,
    humidityAvg: 55,
    consumptionTotal: 4200,
    deviceCount: 12,
    onlineCount: 2,
    offlineCount: 1,
    subAmbienteCount: 3,
  },
  subAmbientes: [
    { id: 'deck-clim-dir', label: 'Deck - Climatizacao - Direita', ... },
    { id: 'deck-clim-esq', label: 'Deck - Climatizacao - Esquerda', ... },
    { id: 'deck-ilum', label: 'Deck - Iluminacao', ... },
  ],
  status: 'partial',
};

openAmbienteGroupModal(groupData, {
  onSubAmbienteClick: (sub) => {
    openAmbienteDetailModal(sub.ambienteData, sub.source, settings);
  },
});
```

### Example 2: Single Ambiente (Falls Back to Detail Modal)

When clicking on an ambiente that has no sub-children, the group modal detects this and opens the detail modal instead.

---

## Testing

### Unit Tests

1. `findSubAmbientesForParent` correctly matches by label prefix
2. `calculateGroupMetrics` aggregates values correctly
3. `buildAmbienteGroupData` constructs proper structure

### Integration Tests

1. Sidebar click opens group modal with correct sub-ambientes
2. Sub-ambiente expand/collapse works
3. Remote toggle dispatches correct event
4. Falls back to detail modal for single ambiente

### Manual Tests

1. Click parent ambiente in sidebar → group modal opens
2. Verify aggregated metrics are correct
3. Expand sub-ambiente → see devices
4. Toggle remote → verify event
5. Click on empty parent → verify fallback

---

## Relationship with RFC-0169

| Feature | RFC-0169 (Detail Modal) | RFC-0170 (Group Modal) |
|---------|-------------------------|------------------------|
| **Trigger** | Card click | Sidebar click |
| **Shows** | Single ambiente | Multiple sub-ambientes |
| **Metrics** | From one ambiente | Aggregated from group |
| **Devices** | Direct list | Per sub-ambiente |
| **Use Case** | View/control one ambiente | Overview of area |

---

## Files Modified/Created

| File | Change Type |
|------|-------------|
| `src/components/ambiente-group-modal/AmbienteGroupModal.ts` | Created |
| `src/components/ambiente-group-modal/styles.ts` | Created |
| `src/components/ambiente-group-modal/types.ts` | Created |
| `src/components/ambiente-group-modal/index.ts` | Created |
| `src/index.ts` | Modified (added exports) |
| `src/thingsboard/bas-components/MAIN_BAS/controller.js` | Modified |

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-02-11 | 1.0 | MYIO Engineering | Initial implementation |

---

## References

- [RFC-0168: ASSET_AMBIENT Environment Cards](./RFC-0168-AssetAmbientEnvironmentCards.md)
- [RFC-0169: Ambiente Detail Modal](./RFC-0169-AmbienteDetailModal.md)
- [EntityListPanel Component](../../components/entity-list-panel/EntityListPanel.ts)
