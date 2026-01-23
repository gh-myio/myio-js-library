# RFC-0146: HeaderShopping Component

- **Feature Name**: HeaderShopping Component
- **Start Date**: 2026-01-13
- **RFC PR**: N/A
- **Status**: Draft

## Summary

This RFC describes the migration of the Shopping HEADER widget (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER`) to a reusable library component exported from `src/index.ts`. The component provides date range selection, data loading controls, and report generation capabilities.

## Motivation

The current Shopping HEADER widget:
- Requires ThingsBoard widget lifecycle management (`self.onInit`, `self.ctx`, etc.)
- Depends on jQuery and moment.js from ThingsBoard globals
- Uses `window.MyIOUtils` for shared state with MAIN orchestrator
- Cannot be easily tested in isolation

Benefits of component migration:
- Direct instantiation without widget overhead
- Method-based API for date changes and actions
- Better testability with showcase
- Consistent with other Shopping components (RFC-0145, etc.)
- Removes ThingsBoard-specific dependencies

## Guide-level Explanation

### Architecture

```
MAIN_VIEW_SHOPPING (orchestrator)
├── HeaderShopping Component (createHeaderShoppingComponent) <-- THIS RFC
├── Menu Component (createMenuShoppingComponent)
├── TelemetryGridShopping Component (createTelemetryGridShoppingComponent)
└── Footer Component (createFooterShoppingComponent)
```

### Basic Usage

```typescript
import { createHeaderShoppingComponent } from 'myio-js-library';

const header = createHeaderShoppingComponent({
  container: document.getElementById('headerContainer'),
  themeMode: 'dark',

  // Date range config
  defaultStartDate: new Date(2026, 0, 1),  // 1st of month
  defaultEndDate: new Date(),               // Today

  // Callbacks
  onDateChange: (period) => {
    console.log('Period changed:', period);
    // { startISO, endISO, granularity, tz }
  },

  onLoad: (period) => {
    console.log('Load clicked:', period);
    orchestrator.loadData(period);
  },

  onForceRefresh: () => {
    console.log('Force refresh clicked');
    orchestrator.clearCacheAndReload();
  },

  onReportClick: (domain) => {
    console.log('Report clicked for:', domain);
    MyIOLibrary.openDashboardPopupAllReport({ ... });
  },

  // Contract status (optional)
  contractState: {
    isLoaded: true,
    isValid: true,
    energy: { total: 50 },
    water: { total: 20 },
    temperature: { total: 10 },
  },
});

// Update current domain (affects button states)
header.setDomain('energy');

// Update contract status
header.setContractState(newContractState);

// Get current period
const period = header.getCurrentPeriod();

// Set date range programmatically
header.setDateRange(startDate, endDate);

// Enable/disable controls
header.setControlsEnabled(true);

// Cleanup
header.destroy();
```

### Integration with MAIN_VIEW_SHOPPING Showcase

```javascript
// In showcase/main-view-shopping/index.html

const headerContainer = document.getElementById('headerContainer');
let headerInstance = null;

if (headerContainer && MyIOLibrary.createHeaderShoppingComponent) {
  headerInstance = MyIOLibrary.createHeaderShoppingComponent({
    container: headerContainer,
    themeMode: 'dark',

    onDateChange: (period) => {
      logEvent('HEADER', `Date changed: ${period.startISO} - ${period.endISO}`, 'info');
    },

    onLoad: (period) => {
      logEvent('HEADER', 'Load clicked', 'info');
      window.dispatchEvent(new CustomEvent('myio:update-date', { detail: { period } }));
    },

    onForceRefresh: () => {
      logEvent('HEADER', 'Force refresh clicked', 'info');
      // Clear cache and reload
    },

    onReportClick: (domain) => {
      logEvent('HEADER', `Report clicked for ${domain}`, 'info');
    },
  });
}

// Listen for domain changes and update header
window.addEventListener('myio:dashboard-state', (ev) => {
  headerInstance?.setDomain(ev.detail.tab);
});
```

## Reference-level Explanation

### Component Structure

```
src/components/header-shopping/
├── index.ts                           # Exports
├── types.ts                           # TypeScript interfaces
├── styles.ts                          # Embedded CSS styles
├── HeaderShoppingController.ts        # Business logic
├── HeaderShoppingView.ts              # DOM rendering
└── createHeaderShoppingComponent.ts   # Factory function
```

### Types

```typescript
// Period format
interface DatePeriod {
  startISO: string;      // ISO 8601 format with timezone
  endISO: string;        // ISO 8601 format with timezone
  granularity: 'hour' | 'day' | 'month';
  tz: string;            // Timezone (default: 'America/Sao_Paulo')
}

// Contract state
interface ContractState {
  isLoaded: boolean;
  isValid: boolean;
  energy?: { total: number };
  water?: { total: number };
  temperature?: { total: number };
}

// Component params
interface HeaderShoppingParams {
  container: HTMLElement;
  themeMode?: 'dark' | 'light';
  debugActive?: boolean;

  // Date range
  defaultStartDate?: Date;
  defaultEndDate?: Date;
  timezone?: string;

  // Contract status (optional)
  contractState?: ContractState;
  showContractStatus?: boolean;

  // Callbacks
  onDateChange?: (period: DatePeriod) => void;
  onLoad?: (period: DatePeriod) => void;
  onForceRefresh?: () => void;
  onReportClick?: (domain: string) => void;
}

// Component instance
interface HeaderShoppingInstance {
  element: HTMLElement;

  // Domain management
  setDomain: (domain: 'energy' | 'water' | 'temperature') => void;
  getCurrentDomain: () => string | null;

  // Date management
  setDateRange: (start: Date, end: Date) => void;
  getCurrentPeriod: () => DatePeriod;

  // Contract status
  setContractState: (state: ContractState) => void;

  // Control state
  setControlsEnabled: (enabled: boolean) => void;
  setReportEnabled: (enabled: boolean) => void;

  // Theme
  setThemeMode: (mode: 'dark' | 'light') => void;

  // Cleanup
  destroy: () => void;
}
```

### UI Elements

| Element | Description | Actions |
|---------|-------------|---------|
| Contract Status Icon | Shows contract validation status | Click: Show ContractSummaryTooltip |
| Date Range Input | Shows current date range (readonly) | Click: Open DateRangePicker |
| "Carregar" Button | Primary action - loads data | Click: Emit `onLoad` callback |
| "Limpar" Button | Secondary - clears cache | Click: Emit `onForceRefresh` callback |
| "Relatório" Button | Opens general report | Click: Emit `onReportClick` callback |

### Button States by Domain

| Domain | Carregar | Limpar | Relatório | Date Range |
|--------|----------|--------|-----------|------------|
| energy | Enabled | Enabled | Enabled | Enabled |
| water | Enabled | Enabled | Enabled | Enabled |
| temperature | Disabled | Disabled | Disabled | Disabled |
| null | Disabled | Disabled | Disabled | Disabled |

### Granularity Calculation

```typescript
function calcGranularity(startISO: string, endISO: string): 'hour' | 'day' | 'month' {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays > 92) return 'month';
  if (diffDays > 3) return 'day';
  return 'hour';
}
```

### Event Flow

```
User clicks DateRangePicker
    └── onDateChange(period)

User clicks "Carregar"
    └── onLoad(period)
    └── Emit 'myio:update-date' (for orchestrator)

User clicks "Limpar"
    └── onForceRefresh()
    └── Clear localStorage cache
    └── Emit 'myio:telemetry:clear'

User clicks "Relatório"
    └── onReportClick(domain)

Domain changes (from Menu)
    └── setDomain(domain)
    └── Update button states
    └── Auto-emit period for energy/water
```

### Migration from Widget Files

| Widget File | Component File | Description |
|-------------|----------------|-------------|
| `template.html` | `HeaderShoppingView.ts` | HTML generation via TypeScript |
| `styles.css` | `styles.ts` | CSS as embedded string constant |
| `controller.js` | `HeaderShoppingController.ts` | Business logic |
| `settingsSchema.json` | `types.ts` | Settings as TypeScript interface |

### Dependencies

The component uses these library features:
- `MyIOLibrary.createDateRangePicker` - Date selection
- `MyIOLibrary.ContractSummaryTooltip` - Contract status tooltip
- `MyIOLibrary.MyIOToast` - Toast notifications

## Showcase

### Location

```
showcase/header-shopping/
├── index.html         # Showcase page
├── start-server.bat   # Windows server startup script
├── start-server.sh    # Linux/macOS server startup script
├── stop-server.bat    # Windows server stop script
└── stop-server.sh     # Linux/macOS server stop script
```

### Running the Showcase

```batch
cd showcase\header-shopping
start-server.bat
```

Server runs on port **3335**.

### Showcase Features

- Date range picker integration
- Domain switching (energy, water, temperature)
- Button state changes based on domain
- Contract status icon with mock data
- Light/dark theme toggle
- Event log panel

## Drawbacks

- Requires `createDateRangePicker` to be available in library
- Contract tooltip depends on `ContractSummaryTooltip`
- DateRangePicker requires moment.js (bundled separately)

## Rationale and Alternatives

### Why component instead of widget?

1. **Testability**: Standalone showcase with mock data
2. **Reusability**: Can be used outside ThingsBoard
3. **Consistency**: Same pattern as other Shopping components
4. **No TB dependencies**: Removes `self.ctx`, `self.onInit`, etc.

### Alternatives considered

1. **Keep widget**: Maintain current architecture - rejected due to testing difficulty
2. **Extend RFC-0113 Header**: HeadOffice header is different UI - rejected

## Prior Art

- RFC-0113: Header Component (HeadOffice version - different UI)
- RFC-0145: TelemetryGridShopping Component
- RFC-0134: BuildLocalServerSimulationThingsboard

## Implementation Checklist

- [ ] Create `src/components/header-shopping/` directory structure
- [ ] Create `types.ts` with TypeScript interfaces
- [ ] Create `styles.ts` with embedded CSS
- [ ] Create `HeaderShoppingView.ts`
- [ ] Create `HeaderShoppingController.ts`
- [ ] Create `createHeaderShoppingComponent.ts` factory function
- [ ] Create `index.ts` exports
- [ ] Export from `src/index.ts`
- [ ] Create `showcase/header-shopping/` with:
  - [ ] `index.html`
  - [ ] `start-server.bat`
  - [ ] `start-server.sh`
  - [ ] `stop-server.bat`
  - [ ] `stop-server.sh`
- [ ] Test with mock data
- [ ] Integrate with `showcase/main-view-shopping/`

## Future Possibilities

1. **Preset date ranges**: Quick buttons for "Today", "This Week", "This Month"
2. **Export settings**: Save preferred date range in localStorage
3. **Multi-timezone support**: Allow user to select timezone
4. **Keyboard shortcuts**: Alt+L for Load, Alt+R for Refresh
