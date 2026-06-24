# RFC-0121: TelemetryGrid Component

- **Feature Name**: TelemetryGrid Component
- **Start Date**: 2026-01-03
- **RFC PR**: N/A
- **Status**: Implemented

## Summary

This RFC describes the migration of the TELEMETRY widget (`src/thingsboard/MYIO-SIM/v5.2.0/TELEMETRY`) to a reusable library component exported from `src/index.ts`. The component replaces the current `tb-dashboard-state` approach in MAIN_UNIQUE_DATASOURCE, enabling direct component instantiation without ThingsBoard widget overhead.

## Motivation

The current TELEMETRY widget:
- Requires ThingsBoard widget lifecycle management
- Uses `tb-dashboard-state` for state switching
- Has complex event-driven communication with MAIN
- Cannot be easily tested in isolation

Benefits of component migration:
- Direct instantiation without widget overhead
- Method-based API for updates (no custom events)
- Better testability with showcase
- Reusable across different dashboard implementations
- Cleaner separation of concerns

## Guide-level Explanation

### Architecture

```
MAIN_UNIQUE_DATASOURCE (orchestrator)
├── Header Component (createHeaderComponent)
├── Menu Component (createMenuComponent)
├── TelemetryGrid Component (createTelemetryGridComponent) ← NEW
└── Footer Component (createFooterComponent)
```

### Basic Usage

```typescript
import { createTelemetryGridComponent } from 'myio-js-library';

const telemetryGrid = createTelemetryGridComponent({
  container: document.getElementById('telemetryContainer'),
  domain: 'energy',
  context: 'equipments',
  devices: devicesFromOrchestrator,
  themeMode: 'dark',

  onCardAction: async (action, device) => {
    // Handle dashboard, report, settings actions
    if (action === 'dashboard') {
      MyIOLibrary.openDashboardPopupEnergy({ deviceId: device.entityId, ... });
    }
  },

  onStatsUpdate: (stats) => {
    // Update header component with new stats
    headerInstance.updateEquipmentCard({
      totalEquipments: stats.total,
      filteredEquipments: stats.online,
    });
  },
});

// Update devices when data changes
telemetryGrid.updateDevices(newDevices);

// Change domain/context (from Menu)
telemetryGrid.updateConfig('water', 'hidrometro');

// Apply shopping filter
telemetryGrid.applyFilter(['cust-001', 'cust-002']);

// Cleanup
telemetryGrid.destroy();
```

### Integration with MAIN_UNIQUE_DATASOURCE

```javascript
// In MAIN_UNIQUE_DATASOURCE/controller.js

// After Header and Menu initialization
const telemetryContainer = document.getElementById('telemetryGridContainer');
let telemetryGridInstance = null;

if (telemetryContainer && MyIOLibrary.createTelemetryGridComponent) {
  const initialDevices = window.MyIOOrchestrator?.getDevices?.('energy', 'equipments') || [];

  telemetryGridInstance = MyIOLibrary.createTelemetryGridComponent({
    container: telemetryContainer,
    domain: 'energy',
    context: 'equipments',
    devices: initialDevices,
    themeMode: currentThemeMode,
    debugActive: settings.enableDebugMode,

    onCardAction: async (action, device) => {
      // Use existing popup functions
      if (action === 'dashboard') {
        MyIOLibrary.openDashboardPopupEnergy({ ... });
      }
    },

    onStatsUpdate: (stats) => {
      if (headerInstance) {
        headerInstance.updateEquipmentCard({ ... });
      }
    },
  });
}

// Menu domain/context change
menuInstance.on('context-change', ({ domain, context }) => {
  const devices = window.MyIOOrchestrator?.getDevices?.(domain, context) || [];
  telemetryGridInstance.updateConfig(domain, context);
  telemetryGridInstance.updateDevices(devices);
});

// Shopping filter change
window.addEventListener('myio:filter-applied', (ev) => {
  const shoppingIds = ev.detail?.selection?.map(s => s.value) || [];
  telemetryGridInstance.applyFilter(shoppingIds);
});
```

## Reference-level Explanation

### Component Structure

```
src/components/telemetry-grid/
├── index.ts                         # Exports
├── types.ts                         # TypeScript interfaces
├── styles.ts                        # Embedded CSS styles
├── TelemetryGridController.ts       # Business logic
├── TelemetryGridView.ts             # DOM rendering
└── createTelemetryGridComponent.ts  # Factory function
```

### Types

```typescript
// Domain and Context
type TelemetryDomain = 'energy' | 'water' | 'temperature';
type TelemetryContext = 'equipments' | 'stores' | 'hidrometro' | 'hidrometro_area_comum' | 'termostato' | 'termostato_external';

// Device interface
interface TelemetryDevice {
  entityId: string;
  ingestionId: string;
  labelOrName: string;
  deviceIdentifier: string;
  deviceType: string;
  deviceProfile: string;
  deviceStatus: string;
  connectionStatus: string;
  customerId: string;
  customerName?: string;
  val: number | null;
  // ... additional fields
}

// Component params
interface TelemetryGridParams {
  container: HTMLElement;
  domain: TelemetryDomain;
  context: TelemetryContext;
  devices: TelemetryDevice[];
  themeMode?: 'dark' | 'light';
  debugActive?: boolean;
  onCardAction?: (action: CardAction, device: TelemetryDevice) => void;
  onStatsUpdate?: (stats: TelemetryStats) => void;
  // ... additional options
}

// Sort modes
type SortMode =
  | 'cons_desc' | 'cons_asc'       // By consumption
  | 'alpha_asc' | 'alpha_desc'     // By device name
  | 'status_asc' | 'status_desc'   // By status
  | 'shopping_asc' | 'shopping_desc'; // By shopping/customer name

// Component instance
interface TelemetryGridInstance {
  element: HTMLElement;
  updateDevices: (devices: TelemetryDevice[]) => void;
  updateConfig: (domain: TelemetryDomain, context: TelemetryContext) => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
  applyFilter: (shoppingIds: string[]) => void;
  setSearchTerm: (term: string) => void;
  setSortMode: (mode: SortMode) => void;
  getStats: () => TelemetryStats;
  refresh: () => void;
  destroy: () => void;
}
```

### Domain Configuration

Each domain has specific configuration:

| Domain | Unit | Delay (stale) | Color |
|--------|------|---------------|-------|
| energy | kWh | 1440 min (24h) | Orange (#f59e0b) |
| water | m3 | 1440 min (24h) | Blue (#0ea5e9) |
| temperature | C | 60 min (1h) | Red (#f43f5e) |

### Context Configuration

| Context | Domain | Header Label |
|---------|--------|--------------|
| equipments | energy | Total de Equipamentos |
| stores | energy | Total de Lojas |
| hidrometro | water | Total de Lojas |
| hidrometro_area_comum | water | Total Area Comum |
| termostato | temperature | Ambientes Climatizaveis |
| termostato_external | temperature | Ambientes Nao Climatizaveis |

### Card Rendering

The component uses `MyIOLibrary.renderCardComponentHeadOffice` for card rendering:

```typescript
const cardInstance = MyIOLibrary.renderCardComponentHeadOffice(container, {
  entityObject: device,
  debugActive: params.debugActive,
  delayTimeConnectionInMins: domainConfig.delayMins,
  isSelected: () => controller.isDeviceSelected(device.entityId),
  handleActionDashboard: () => params.onCardAction?.('dashboard', device),
  handleActionReport: () => params.onCardAction?.('report', device),
  handleActionSettings: () => params.onCardAction?.('settings', device),
  handleSelect: (checked, entity) => { ... },
  useNewComponents: true,
  enableSelection: true,
  enableDragDrop: true,
});
```

### Stats Calculation

Stats are calculated from filtered devices:

```typescript
interface TelemetryStats {
  total: number;          // All devices count
  online: number;         // power_on status
  offline: number;        // offline status
  notInstalled: number;   // not_installed status
  noInfo: number;         // no_info status
  withConsumption: number; // val > 0
  noConsumption: number;   // val === 0
  totalConsumption: number; // sum of all val
  filteredCount: number;   // Current visible count
}
```

### Event Flow

```
Menu Component ──onContextChange──► MAIN ──updateConfig()──► TelemetryGrid
                                      │
Header/Menu ──myio:filter-applied──► MAIN ──applyFilter()──► TelemetryGrid
                                      │
Orchestrator ──myio:data-ready──► MAIN ──updateDevices()──► TelemetryGrid
                                      │
TelemetryGrid ──onStatsUpdate()──► MAIN ──updateKPIs()──► Header
```

## Drawbacks

- Slightly increased bundle size (~15KB minified)
- Requires MAIN_UNIQUE_DATASOURCE update
- External dependencies on `window.MyIOUtils` and `window.MyIOLibrary`

## Rationale and Alternatives

### Why component instead of widget?

1. **Direct control**: Method calls instead of events
2. **Better testability**: Showcase with mock data
3. **Faster updates**: No TB state switching overhead
4. **Simpler debugging**: Single codebase

### Alternatives considered

1. **Keep widget**: Maintain current architecture - rejected due to complexity
2. **Web Component**: Custom Element - rejected due to IE11 compatibility concerns
3. **React/Vue component**: Framework-specific - rejected to maintain vanilla JS compatibility

## Prior Art

- RFC-0090: Filter Modal (3-column layout pattern)
- RFC-0105: InfoTooltip (premium tooltip with actions)
- RFC-0113: Header Component (same pattern)
- RFC-0114: Menu Component (same pattern)
- RFC-0115: Footer Component (same pattern)

## Unresolved Questions

None - implementation complete.

## ModalHeader Component

A reusable modal header component was created to standardize the header across all modals (filter modal, temperature modal, etc.).

### Location

```
src/utils/ModalHeader.ts
```

### Usage

```typescript
import { ModalHeader } from 'myio-js-library';

// Generate header HTML
const headerHtml = ModalHeader.generateInlineHTML({
  icon: '🔍',
  title: 'Filtrar e Ordenar',
  modalId: 'filter-modal',
  theme: 'dark',
  isMaximized: false,
  showThemeToggle: true,
  showMaximize: true,
  showClose: true,
  primaryColor: '#3e1a7d', // MyIO Purple
});

// Create controller for state management
const headerController = ModalHeader.createController({
  modalId: 'filter-modal',
  theme: 'dark',
  maximizeTarget: '.fm-card',
  maximizedClass: 'maximized',
  themeTarget: '.fm-header',
  lightThemeClass: 'fm-header--light',
  onClose: () => modal.close(),
  onThemeChange: (theme) => console.log('Theme:', theme),
  onMaximizeChange: (max) => console.log('Maximized:', max),
});

// Controller methods
headerController.toggleTheme();    // Toggle dark/light
headerController.toggleMaximize(); // Toggle fullscreen
headerController.reset();          // Reset to initial state
headerController.destroy();        // Cleanup listeners
```

### Features

- **Theme Toggle**: ☀️/🌙 button to switch between dark and light themes
- **Maximize**: 🗖/🗗 button to toggle fullscreen mode
- **Close**: × button to close the modal
- **Encapsulated State**: Controller manages all state and UI updates

## Sort Options

The filter modal includes the following sort options:

| ID | Label | Icon |
|----|-------|------|
| cons_desc | Maior consumo | ↓ |
| cons_asc | Menor consumo | ↑ |
| alpha_asc | Nome (A-Z) | A |
| alpha_desc | Nome (Z-A) | Z |
| shopping_asc | Shopping (A-Z) | 🏢 |
| shopping_desc | Shopping (Z-A) | 🏢 |

## Showcase Testing

The component includes a showcase page for testing and development.

### Location

```
showcase/telemetry-grid/
├── index.html         # Showcase page
├── start-server.bat   # Windows server startup script
├── start-server.sh    # Linux/macOS server startup script
├── stop-server.bat    # Windows server stop script
└── stop-server.sh     # Linux/macOS server stop script
```

### Running the Showcase

The showcase requires an HTTP server due to CORS restrictions. Use the provided scripts:

**Windows:**
```batch
cd showcase\telemetry-grid
start-server.bat
```

**Linux/macOS:**
```bash
cd showcase/telemetry-grid
chmod +x start-server.sh
./start-server.sh
```

The scripts will:
1. Kill any existing process on port 3333
2. Start `npx serve` on port 3333
3. Open the browser to `http://localhost:3333/showcase/telemetry-grid/`

### Showcase Features

The showcase demonstrates:
- Domain switching (energy, water, temperature)
- Context switching (equipments, stores, hidrometro, etc.)
- Light/dark theme toggle
- Device count simulation (5-100 devices)
- Refresh data button
- Clear filters button
- Stats bar with live updates
- Real card rendering using `MyIOLibrary.renderCardComponentHeadOffice`
- Filter modal with 3-column layout (Filters | Checklist | Sort)
- MyIO Premium header with theme/maximize/close buttons

### Filter Modal

The filter modal follows the RFC-0090 3-column layout pattern:

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Filtrar e Ordenar          [☀️] [🗖] [×]             │  ← MyIO Premium Header
├─────────────┬─────────────────────────┬─────────────────┤
│ FILTROS     │ DISPOSITIVOS           │ ORDENAR POR     │
│             │                        │                 │
│ ○ Todos (10)│ 🔍 Buscar...          │ ○ Maior consumo │
│ ○ Online (5)│ [Selecionar] [Limpar] │ ○ Menor consumo │
│ ○ Offline(3)│                        │ ○ Nome (A-Z)    │
│ ○ Não Inst. │ ☑ Device 1   50.2 kWh │ ○ Nome (Z-A)    │
│             │ ☑ Device 2   30.1 kWh │ ○ Shopping(A-Z) │
│ CONSUMO     │ ☐ Device 3    0.0 kWh │ ○ Shopping(Z-A) │
│ ○ Com (7)   │                        │                 │
│ ○ Sem (3)   │                        │                 │
├─────────────┴─────────────────────────┴─────────────────┤
│                        [Fechar] [Aplicar]               │
└─────────────────────────────────────────────────────────┘
```

Header uses `ModalHeader.createController()` for state management.

### Manual Server Start

Alternatively, start the server manually from the project root:

```bash
npx serve . -p 3333
```

Then open: `http://localhost:3333/showcase/telemetry-grid/`

## Future Possibilities

1. **Real-time mode**: Add WebSocket support for live updates
2. **Virtual scrolling**: For large device lists (>100)
3. **Batch selection**: Multi-select for batch operations
4. **Custom card templates**: Allow domain-specific card layouts
