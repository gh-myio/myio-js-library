# RFC-0145: TelemetryGridShopping Component

- **Feature Name**: TelemetryGridShopping Component
- **Start Date**: 2026-01-13
- **RFC PR**: N/A
- **Status**: Draft

## Summary

This RFC describes the migration of the Shopping TELEMETRY widget (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY`) to a reusable library component exported from `src/index.ts`. The component replaces the current ThingsBoard widget approach, enabling direct component instantiation without ThingsBoard widget overhead.

## Motivation

The current Shopping TELEMETRY widget:
- Requires ThingsBoard widget lifecycle management
- Uses complex event-driven communication with MAIN orchestrator
- Has embedded HTML template, CSS, and controller in separate files
- Cannot be easily tested in isolation
- Duplicates similar functionality from RFC-0121 TelemetryGrid (HeadOffice)

Benefits of component migration:
- Direct instantiation without widget overhead
- Method-based API for updates (no custom events)
- Better testability with showcase
- Reusable across different dashboard implementations
- Uses `renderCardComponentV5` for Shopping-style cards
- Cleaner separation of concerns
- Consistent with RFC-0134 local server simulation architecture

## Guide-level Explanation

### Architecture

```
MAIN_VIEW_SHOPPING (orchestrator)
├── Header Component (createHeaderComponent)
├── Menu Component (createMenuComponent)
├── TelemetryGridShopping Component (createTelemetryGridShoppingComponent) <-- NEW
└── Footer Component (createFooterComponent)
```

### Basic Usage

```typescript
import { createTelemetryGridShoppingComponent } from 'myio-js-library';

const telemetryGrid = createTelemetryGridShoppingComponent({
  container: document.getElementById('telemetryContainer'),
  domain: 'energy',
  context: 'stores',
  devices: devicesFromOrchestrator,
  themeMode: 'dark',
  labelWidget: 'Lojas',

  onCardAction: async (action, device) => {
    // Handle dashboard, report, settings actions
    if (action === 'dashboard') {
      MyIOLibrary.openDashboardPopupEnergy({ deviceId: device.entityId, ... });
    }
  },

  onStatsUpdate: (stats) => {
    // Update header component with new stats
    headerInstance.updateStats({
      total: stats.total,
      online: stats.online,
      totalConsumption: stats.totalConsumption,
    });
  },

  onFilterChange: (filterState) => {
    // Notify orchestrator of filter changes
    console.log('Filter changed:', filterState);
  },
});

// Update devices when data changes
telemetryGrid.updateDevices(newDevices);

// Change domain/context (from Menu)
telemetryGrid.updateConfig({ domain: 'water', context: 'hidrometro' });

// Apply shopping filter
telemetryGrid.applyShoppingFilter(['cust-001', 'cust-002']);

// Set search term
telemetryGrid.setSearchTerm('loja');

// Set sort mode
telemetryGrid.setSortMode('cons_desc');

// Cleanup
telemetryGrid.destroy();
```

### Integration with MAIN_VIEW_SHOPPING Showcase

```javascript
// In showcase/main-view-shopping/index.html

// After Header and Menu initialization
const telemetryContainer = document.getElementById('shopsList');
let telemetryGridInstance = null;

if (telemetryContainer && MyIOLibrary.createTelemetryGridShoppingComponent) {
  const initialDevices = window.MyIOOrchestrator?.classifiedData?.energy?.stores || [];

  telemetryGridInstance = MyIOLibrary.createTelemetryGridShoppingComponent({
    container: telemetryContainer,
    domain: 'energy',
    context: 'stores',
    devices: initialDevices,
    themeMode: 'dark',
    labelWidget: 'Lojas',
    debugActive: true,

    onCardAction: async (action, device) => {
      // Use existing popup functions
      if (action === 'dashboard') {
        console.log('Opening dashboard for:', device.labelOrName);
      }
    },

    onStatsUpdate: (stats) => {
      console.log('Stats updated:', stats);
    },
  });
}

// Listen for domain/context changes
window.addEventListener('myio:dashboard-state', (ev) => {
  const { domain, context } = ev.detail;
  const devices = window.MyIOOrchestrator?.classifiedData?.[domain]?.[context] || [];
  telemetryGridInstance?.updateConfig({ domain, context });
  telemetryGridInstance?.updateDevices(devices);
});
```

## Reference-level Explanation

### Component Structure

```
src/components/telemetry-grid-shopping/
├── index.ts                               # Exports
├── types.ts                               # TypeScript interfaces
├── styles.ts                              # Embedded CSS styles (from styles.css)
├── TelemetryGridShoppingController.ts     # Business logic
├── TelemetryGridShoppingView.ts           # DOM rendering
└── createTelemetryGridShoppingComponent.ts # Factory function
```

### Types

```typescript
// Domain and Context
type TelemetryDomain = 'energy' | 'water' | 'temperature';
type TelemetryContext =
  | 'stores'           // Energy - Lojas
  | 'equipments'       // Energy - Equipamentos
  | 'entrada'          // Energy - Entrada
  | 'hidrometro'       // Water - Lojas
  | 'hidrometro_area_comum'  // Water - Area Comum
  | 'hidrometro_entrada'     // Water - Entrada
  | 'termostato'       // Temperature
  | 'termostato_external';

// Device interface (from Shopping dashboard)
interface TelemetryDevice {
  entityId: string;
  ingestionId: string;
  labelOrName: string;
  name: string;
  deviceIdentifier: string;
  deviceType: string;
  deviceProfile: string;
  deviceStatus: string;
  connectionStatus: string;
  customerId: string;
  customerName?: string;
  centralName?: string;
  ownerName?: string;
  val: number | null;
  perc?: number;
  unit?: string;
  log_annotations?: object;
  // ... additional fields
}

// Component params
interface TelemetryGridShoppingParams {
  container: HTMLElement;
  domain: TelemetryDomain;
  context: TelemetryContext;
  devices: TelemetryDevice[];
  labelWidget?: string;
  themeMode?: 'dark' | 'light';
  debugActive?: boolean;

  // Callbacks
  onCardAction?: (action: CardAction, device: TelemetryDevice) => void;
  onStatsUpdate?: (stats: TelemetryStats) => void;
  onFilterChange?: (filterState: FilterState) => void;
  onSearchChange?: (searchTerm: string) => void;
}

// Card actions
type CardAction = 'dashboard' | 'report' | 'settings';

// Sort modes (from TELEMETRY widget)
type SortMode =
  | 'cons_desc'     // Maior consumo (default)
  | 'cons_asc'      // Menor consumo
  | 'alpha_asc'     // A -> Z
  | 'alpha_desc';   // Z -> A

// Filter state
interface FilterState {
  searchTerm: string;
  sortMode: SortMode;
  selectedDeviceIds: string[];
  statusFilter: 'all' | 'online' | 'offline' | 'not_installed';
  consumptionFilter: 'all' | 'with' | 'without';
}

// Stats
interface TelemetryStats {
  total: number;
  online: number;
  offline: number;
  notInstalled: number;
  noInfo: number;
  withConsumption: number;
  noConsumption: number;
  totalConsumption: number;
  filteredCount: number;
  unit: string;
}

// Component instance
interface TelemetryGridShoppingInstance {
  element: HTMLElement;
  updateDevices: (devices: TelemetryDevice[]) => void;
  updateConfig: (config: Partial<{ domain: TelemetryDomain; context: TelemetryContext; labelWidget: string }>) => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
  applyShoppingFilter: (shoppingIds: string[]) => void;
  setSearchTerm: (term: string) => void;
  setSortMode: (mode: SortMode) => void;
  getStats: () => TelemetryStats;
  getFilterState: () => FilterState;
  openFilterModal: () => void;
  closeFilterModal: () => void;
  refresh: () => void;
  destroy: () => void;
}
```

### Domain Configuration

| Domain | Unit | Label Default | Color |
|--------|------|---------------|-------|
| energy | kWh | Lojas | Purple (#3e1a7d) |
| water | m3 | Hidrômetros | Blue (#0ea5e9) |
| temperature | C | Termostatos | Red (#f43f5e) |

### Context Configuration

| Context | Domain | Header Label |
|---------|--------|--------------|
| stores | energy | Lojas |
| equipments | energy | Equipamentos |
| entrada | energy | Entrada |
| hidrometro | water | Hidrômetros Lojas |
| hidrometro_area_comum | water | Hidrômetros Area Comum |
| hidrometro_entrada | water | Hidrômetro Entrada |
| termostato | temperature | Termostatos |
| termostato_external | temperature | Termostatos Externos |

### Card Rendering

The component uses `MyIOLibrary.renderCardComponentV5` for Shopping-style card rendering:

```typescript
const cardInstance = MyIOLibrary.renderCardComponentV5({
  entityObject: {
    ...device,
    perc: calculatePercentage(device.val, totalConsumption),
  },
  debugActive: params.debugActive,

  handleActionDashboard: (entity) => params.onCardAction?.('dashboard', entity),
  handleActionReport: (entity) => params.onCardAction?.('report', entity),
  handleActionSettings: (entity) => params.onCardAction?.('settings', entity),
  handleSelect: (checked, entity) => {
    // Selection handled by MyIOSelectionStore
  },
  handleClickCard: (entity) => {
    // Card click (optional)
  },

  enableSelection: true,
  enableDragDrop: false,
});
```

### Stats Calculation

```typescript
function calculateStats(devices: TelemetryDevice[]): TelemetryStats {
  const stats = {
    total: devices.length,
    online: 0,
    offline: 0,
    notInstalled: 0,
    noInfo: 0,
    withConsumption: 0,
    noConsumption: 0,
    totalConsumption: 0,
    filteredCount: devices.length,
    unit: 'kWh',
  };

  devices.forEach(device => {
    // Status counting
    const status = device.deviceStatus?.toLowerCase() || 'unknown';
    if (['power_on', 'online', 'normal'].includes(status)) stats.online++;
    else if (status === 'offline') stats.offline++;
    else if (['not_installed', 'waiting'].includes(status)) stats.notInstalled++;
    else stats.noInfo++;

    // Consumption counting
    const val = Number(device.val) || 0;
    if (val > 0) {
      stats.withConsumption++;
      stats.totalConsumption += val;
    } else {
      stats.noConsumption++;
    }
  });

  return stats;
}
```

### Filter Modal Structure

The filter modal follows the Shopping TELEMETRY widget design:

```
+----------------------------------------------------------+
| Filtros & Ordenacao                              [X]     |
+----------------------------------------------------------+
| Selecionar Lojas                                         |
|   [Selecionar todas] [Limpar]                            |
|   [Search input with clear button]                       |
|   +----------------------------------------------------+ |
|   | [ ] Device 1                                       | |
|   | [x] Device 2                                       | |
|   | [ ] Device 3                                       | |
|   +----------------------------------------------------+ |
|                                                          |
| Ordenacao                                                |
|   ( ) Consumo (desc)  ( ) Consumo (asc)                 |
|   ( ) A -> Z          ( ) Z -> A                         |
+----------------------------------------------------------+
|                          [Aplicar] [Resetar]             |
+----------------------------------------------------------+
```

### Event Flow

```
Menu Component --onDomainChange--> Orchestrator --updateConfig()--> TelemetryGridShopping
                                       |
Header/Menu --myio:filter-applied--> Orchestrator --applyShoppingFilter()--> TelemetryGridShopping
                                       |
Orchestrator --myio:data-ready--> Orchestrator --updateDevices()--> TelemetryGridShopping
                                       |
TelemetryGridShopping --onStatsUpdate()--> Orchestrator --updateKPIs()--> Header
```

### Migration from Widget Files

| Widget File | Component File | Description |
|-------------|----------------|-------------|
| `template.html` | `TelemetryGridShoppingView.ts` | HTML generation via TypeScript |
| `styles.css` | `styles.ts` | CSS as embedded string constant |
| `controller.js` | `TelemetryGridShoppingController.ts` | Business logic |
| `settingsSchema.json` | `types.ts` | Settings as TypeScript interface |

## Showcase

### Location

```
showcase/telemetry-grid-shopping/
├── index.html         # Showcase page
├── start-server.bat   # Windows server startup script
├── start-server.sh    # Linux/macOS server startup script
├── stop-server.bat    # Windows server stop script
└── stop-server.sh     # Linux/macOS server stop script
```

### Running the Showcase

**Windows:**
```batch
cd showcase\telemetry-grid-shopping
start-server.bat
```

**Linux/macOS:**
```bash
cd showcase/telemetry-grid-shopping
chmod +x start-server.sh
./start-server.sh
```

The scripts will:
1. Kill any existing process on port 3334
2. Start `npx serve` on port 3334
3. Open the browser to `http://localhost:3334/showcase/telemetry-grid-shopping/`

### Showcase Features

- Domain switching (energy, water, temperature)
- Context switching (stores, equipments, hidrometro, etc.)
- Light/dark theme toggle
- Device count simulation (5-100 devices)
- Refresh data button
- Stats bar with live updates
- Real card rendering using `MyIOLibrary.renderCardComponentV5`
- Filter modal with device checklist and sort options
- Integration with `MyIOSelectionStore` for footer comparison
- Annotation badges on cards (pending, maintenance, activity, observation)

## Drawbacks

- Slightly increased bundle size (~20KB minified)
- Requires library rebuild when changing styles
- External dependencies on `window.MyIOLibrary` functions

## Rationale and Alternatives

### Why component instead of widget?

1. **Direct control**: Method calls instead of TB events
2. **Better testability**: Standalone showcase with mock data
3. **Faster updates**: No ThingsBoard state switching overhead
4. **Simpler debugging**: Single codebase in library
5. **Consistency**: Same pattern as RFC-0121 (HeadOffice version)

### Why separate from RFC-0121 TelemetryGrid?

1. **Different card component**: Uses `renderCardComponentV5` vs `renderCardComponentHeadOffice`
2. **Shopping-specific features**: Annotation badges, percentage display
3. **Different filter modal design**: Single-column vs 3-column layout
4. **Different visual style**: Purple theme (#3e1a7d) vs blue theme

### Alternatives considered

1. **Extend RFC-0121**: Add Shopping mode to existing component - rejected due to complexity
2. **Keep widget**: Maintain current architecture - rejected due to testing difficulty
3. **Shared base class**: Common base for both grids - possible future optimization

## Prior Art

- RFC-0121: TelemetryGrid Component (HeadOffice version)
- RFC-0113: Header Component
- RFC-0114: Menu Component
- RFC-0115: Footer Component
- RFC-0127: CustomerCardComponent
- RFC-0134: BuildLocalServerSimulationThingsboard

## Implementation Checklist

- [ ] Create `src/components/telemetry-grid-shopping/` directory structure
- [ ] Create `types.ts` with TypeScript interfaces
- [ ] Create `styles.ts` with embedded CSS (migrate from `styles.css`)
- [ ] Create `TelemetryGridShoppingView.ts` (migrate from `template.html`)
- [ ] Create `TelemetryGridShoppingController.ts` (migrate from `controller.js`)
- [ ] Create `createTelemetryGridShoppingComponent.ts` factory function
- [ ] Create `index.ts` exports
- [ ] Export from `src/index.ts`
- [ ] Create `showcase/telemetry-grid-shopping/` with:
  - [ ] `index.html`
  - [ ] `start-server.bat`
  - [ ] `start-server.sh`
  - [ ] `stop-server.bat`
  - [ ] `stop-server.sh`
- [ ] Test with mock data
- [ ] Integrate with `showcase/main-view-shopping/`

## Future Possibilities

1. **Shared base component**: Extract common logic between RFC-0121 and RFC-0145
2. **Virtual scrolling**: For large device lists (>100 devices)
3. **Real-time WebSocket updates**: Live consumption data
4. **Batch operations**: Multi-select for batch settings changes
5. **Export to CSV/PDF**: Export filtered device list
