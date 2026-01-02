# RFC 0117: Energy Panel Component Library

- Feature Name: `energy_panel_component`
- Start Date: 2026-01-02
- RFC PR: (to be assigned)
- Status: **Draft**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0098 (Consumption7DaysChart), RFC-0102 (DistributionChart), RFC-0111 (MAIN_UNIQUE_DATASOURCE)

---

## Summary

This RFC documents the reverse-engineering of the existing ENERGY widget (`src/MYIO-SIM/v5.2.0/ENERGY/`) and proposes extracting its functionality into a reusable **EnergyPanelComponent** in the MYIO library. The energy panel provides consumption summary cards, time-series charts, and distribution visualizations for the Head Office dashboard.

---

## Motivation

### Current State: ENERGY Widget (v5.2.0)

The existing ENERGY widget (`src/MYIO-SIM/v5.2.0/ENERGY/`) is a ThingsBoard widget that provides:

1. **Title Header**: "Gestao de Energia"
2. **KPI Summary Cards**:
   - Consumo Total Lojas (stores consumption)
   - Consumo Total Equipamentos (equipment consumption)
3. **Consumption Chart**: 7-day consumption line/bar chart (uses `createConsumptionChartWidget`)
4. **Distribution Chart**: Pie/doughnut chart by equipment groups (uses `createDistributionChartWidget`)
5. **Equipment Classification**: Categorizes devices into Elevadores, Escadas Rolantes, Climatizacao, Outros Equipamentos, Lojas
6. **Fullscreen Modal**: Expanded view for consumption chart
7. **Shopping Filter Integration**: Responds to filter changes from HEADER widget

### Problem

The ENERGY functionality is tightly coupled to ThingsBoard widget system. With RFC-0111's architecture:

1. **Library Component**: Need standalone component callable from any widget
2. **Consistent API**: Follow existing library patterns
3. **Reusability**: Support multiple dashboard contexts
4. **Event-Driven**: React to orchestrator events for data updates
5. **Theme Support**: Dark/light mode compatibility

### Goals

1. Extract ENERGY logic into `createEnergyPanel()` library function
2. Expose via `src/index.ts` for consumption
3. Support data updates via CustomEvents
4. Maintain feature parity with existing widget
5. Integrate with existing `createConsumptionChartWidget` and `createDistributionChartWidget`
6. Create showcase for standalone testing

---

## Guide-level Explanation

### Existing ENERGY Widget Structure

```
src/MYIO-SIM/v5.2.0/ENERGY/
├── controller.js          # Widget logic (~2000 lines)
├── template.html          # HTML structure (98 lines)
├── styles.css             # CSS styles (420 lines)
├── settings.schema.json   # Widget settings
├── base.json              # Widget definition
├── dataKeySettings.json   # Data key configuration
└── fix-and-news-features.md # Change notes
```

### Current Features (Reverse Engineering)

#### 1. KPI Summary Cards

```html
<!-- Template Structure -->
<div class="energy-dashboard">
  <h2 class="title">Gestao de Energia</h2>

  <div class="cards">
    <!-- Consumo Total Lojas Card -->
    <div class="card" id="total-consumption-stores-card">
      <p class="label">Consumo Total Lojas</p>
      <h3 class="value" id="total-consumption-stores-value"><!-- spinner or value --></h3>
      <span class="trend neutral" id="total-consumption-stores-trend">Aguardando dados...</span>
      <span class="device-info" id="total-consumption-stores-info">Apenas lojas</span>
    </div>

    <!-- Consumo Total Equipamentos Card -->
    <div class="card" id="total-consumption-equipments-card">
      <p class="label">Consumo Total Equipamentos</p>
      <h3 class="value" id="total-consumption-equipments-value"><!-- spinner or value --></h3>
      <span class="trend neutral" id="total-consumption-equipments-trend">Aguardando dados...</span>
      <span class="device-info" id="total-consumption-equipments-info">Elevadores, escadas, HVAC, etc.</span>
    </div>
  </div>

  <div class="charts">
    <div id="energy-chart-widget" class="chart-box chart-box-energy"></div>
    <div id="energy-distribution-widget" class="chart-box chart-box-energy"></div>
  </div>
</div>
```

#### 2. Card Data Model

```typescript
interface EnergySummary {
  customerTotal: number;      // Total consumption (kWh)
  equipmentsTotal: number;    // Equipment consumption (kWh)
  difference: number;         // Stores consumption = customerTotal - equipmentsTotal
  lastUpdated?: string;       // ISO timestamp
}

interface StoresCardData {
  value: string;              // Formatted value "1.234 kWh"
  percentage: number;         // % of total
  info: string;               // "Apenas lojas"
}

interface EquipmentsCardData {
  value: string;              // Formatted value "567 kWh"
  percentage: number;         // % of total
  info: string;               // "Elevadores, escadas, HVAC, etc."
}
```

#### 3. Equipment Classification Logic

```typescript
// RFC-0076: Classification rules
function classifyEquipmentDetailed(device: Device): string {
  // Priority 1: Elevadores
  // - deviceType/deviceProfile === 'ELEVADOR' or 'ELEVATOR'
  // - Name contains: 'ELEVADOR', 'ELEVATOR', ' ELV', 'ELV ', 'ELV.'

  // Priority 2: Escadas Rolantes
  // - deviceType/deviceProfile === 'ESCADA_ROLANTE' or 'ESCALATOR'
  // - Name contains: 'ESCADA', 'ESCALATOR', 'ESRL', 'ESC.ROL'

  // Priority 3: Climatizacao (HVAC)
  // - deviceType in ['CHILLER', 'FANCOIL', 'AR_CONDICIONADO', 'AC', 'HVAC', 'BOMBA']
  // - Name contains: 'CAG', 'FANCOIL', 'CHILLER', 'HVAC', 'BOMBA', 'AR COND', 'MOTR'

  // Default: Outros Equipamentos
}
```

#### 4. Distribution Modes

```typescript
type DistributionMode =
  | 'groups'      // By equipment groups (default)
  | 'elevators'   // Elevators by shopping
  | 'escalators'  // Escalators by shopping
  | 'hvac'        // HVAC by shopping
  | 'others'      // Other equipment by shopping
  | 'stores';     // Stores by shopping
```

#### 5. Event Integration

```javascript
// Events listened to:
'myio:energy-summary-ready'         -> Updates KPI cards
'myio:filter-applied'               -> Refreshes charts with new filter
'myio:equipment-metadata-enriched'  -> Updates distribution chart
'myio:telemetry:clear'              -> Resets to loading state

// Events dispatched:
'myio:request-total-consumption'    -> Requests consumption data
```

#### 6. Chart Configuration

```typescript
interface ChartConfig {
  period: number;           // 7, 14, 30, or 0 (custom)
  startDate?: string;       // ISO string for custom period
  endDate?: string;         // ISO string for custom period
  granularity: '1d' | '1h'; // Day or hour
  vizMode: 'total' | 'separate'; // Consolidated or by shopping
  chartType: 'line' | 'bar';
}
```

---

## Reference-level Explanation

### Proposed Library Component

#### File Structure

```
src/components/energy-panel/
├── index.ts                    # Public exports
├── createEnergyPanel.ts        # Main entry function
├── EnergyPanelView.ts          # View rendering
├── EnergyPanelController.ts    # Business logic
├── KPICards.ts                 # Summary card components
├── EquipmentClassifier.ts      # Equipment classification logic
├── styles.ts                   # Injected CSS
└── types.ts                    # TypeScript interfaces
```

#### Public API

```typescript
// src/components/energy-panel/types.ts

export type EnergyThemeMode = 'dark' | 'light';

export interface EnergyPanelThemeConfig {
  // Background colors
  panelBackgroundColor?: string;
  cardBackgroundColor?: string;
  chartBackgroundColor?: string;

  // Text colors
  titleColor?: string;
  labelColor?: string;
  valueColor?: string;
  trendColor?: string;

  // Accent colors
  primaryColor?: string;       // Default: green for energy (#16a34a)
  chartBorderColor?: string;

  // Trend colors
  trendUpColor?: string;       // Increase (bad for demand)
  trendDownColor?: string;     // Decrease (good for demand)
  trendNeutralColor?: string;
}

export interface EnergyPanelConfigTemplate {
  // Debug
  enableDebugMode?: boolean;

  // Content
  title?: string;              // Default: "Gestao de Energia"
  showTitle?: boolean;         // Default: true

  // Cards
  showStoresCard?: boolean;    // Default: true
  showEquipmentsCard?: boolean; // Default: true
  storesCardLabel?: string;    // Default: "Consumo Total Lojas"
  equipmentsCardLabel?: string; // Default: "Consumo Total Equipamentos"

  // Charts
  showConsumptionChart?: boolean; // Default: true
  showDistributionChart?: boolean; // Default: true
  defaultPeriod?: number;      // Default: 7 days
  defaultChartType?: 'line' | 'bar';
  defaultVizMode?: 'total' | 'separate';

  // Distribution chart modes
  distributionModes?: DistributionMode[];

  // Theme settings
  darkMode?: EnergyPanelThemeConfig;
  lightMode?: EnergyPanelThemeConfig;
}

export interface EnergySummary {
  customerTotal: number;
  equipmentsTotal: number;
  difference: number;
  lastUpdated?: string;
}

export interface EnergyPanelParams {
  // Container
  container: HTMLElement | string; // Element or ID

  // ThingsBoard context (optional for navigation)
  ctx?: ThingsboardWidgetContext;

  // Configuration template
  configTemplate?: EnergyPanelConfigTemplate;

  // Theme
  themeMode?: EnergyThemeMode;

  // Initial data
  initialSummary?: EnergySummary;

  // Data fetching
  fetchConsumptionData?: (period: number) => Promise<ConsumptionData>;
  fetchDistributionData?: (mode: DistributionMode) => Promise<DistributionData>;

  // Shopping colors (for consistent colors across charts)
  getShoppingColors?: () => Record<string, string> | null;

  // Callbacks
  onMaximizeClick?: () => void;
  onDataLoaded?: (data: ConsumptionData) => void;
  onDistributionModeChange?: (mode: DistributionMode) => void;
  onError?: (error: Error) => void;
}

export interface EnergyPanelInstance {
  // Update methods
  updateSummary: (summary: EnergySummary) => void;
  refreshCharts: (forceRefresh?: boolean) => Promise<void>;
  refreshDistribution: () => Promise<void>;

  // Theme
  setThemeMode: (mode: EnergyThemeMode) => void;
  getThemeMode: () => EnergyThemeMode;

  // Chart control
  setChartPeriod: (period: number) => void;
  setChartType: (type: 'line' | 'bar') => void;
  setVizMode: (mode: 'total' | 'separate') => void;
  setDistributionMode: (mode: DistributionMode) => void;

  // Fullscreen
  openFullscreen: () => void;

  // Lifecycle
  destroy: () => void;

  // DOM reference
  element: HTMLElement;

  // Access to internal chart instances
  getConsumptionChartInstance: () => any;
  getDistributionChartInstance: () => any;
}

export function createEnergyPanel(params: EnergyPanelParams): EnergyPanelInstance;
```

#### Usage Example

```javascript
// In MAIN_UNIQUE_DATASOURCE controller.js onInit():
import { createEnergyPanel } from 'myio-js-library';

self.onInit = async function() {
  const energyContainer = document.getElementById('energy-panel-mount');

  const energyPanel = createEnergyPanel({
    container: energyContainer,
    ctx: self.ctx,
    themeMode: 'light',

    configTemplate: {
      title: 'Gestao de Energia',
      defaultPeriod: 7,
      defaultChartType: 'line',
      defaultVizMode: 'total',
      distributionModes: [
        { value: 'groups', label: 'Por Grupos de Equipamentos' },
        { value: 'elevators', label: 'Elevadores por Shopping' },
        { value: 'escalators', label: 'Escadas Rolantes por Shopping' },
        { value: 'hvac', label: 'Climatizacao por Shopping' },
        { value: 'others', label: 'Outros Equipamentos por Shopping' },
        { value: 'stores', label: 'Lojas por Shopping' },
      ],
    },

    fetchConsumptionData: async (period) => {
      // Fetch from API or orchestrator
      const customerIds = getSelectedShoppingIds() || [window.myioHoldingCustomerId];
      return await fetchConsumptionForPeriod(customerIds, period);
    },

    fetchDistributionData: async (mode) => {
      return await calculateDistributionByMode(mode);
    },

    getShoppingColors: () => {
      const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
      return orchestrator?.getShoppingColors?.() || null;
    },

    onMaximizeClick: () => {
      console.log('Maximize clicked');
    },

    onError: (error) => {
      console.error('Energy panel error:', error);
    }
  });

  // Listen for data updates from orchestrator
  window.addEventListener('myio:energy-summary-ready', (e) => {
    energyPanel.updateSummary(e.detail);
  });

  window.addEventListener('myio:filter-applied', async () => {
    await energyPanel.refreshCharts(true);
  });

  window.addEventListener('myio:equipment-metadata-enriched', async () => {
    await energyPanel.refreshDistribution();
  });
};
```

### Default Theme Configuration

```typescript
export const DEFAULT_LIGHT_THEME: EnergyPanelThemeConfig = {
  panelBackgroundColor: '#ffffff',
  cardBackgroundColor: 'linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)',
  chartBackgroundColor: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
  titleColor: '#1c2743',
  labelColor: '#6b7a90',
  valueColor: '#1c2743',
  trendColor: '#6b7280',
  primaryColor: '#16a34a',
  chartBorderColor: '#86efac',
  trendUpColor: '#dc2626',
  trendDownColor: '#16a34a',
  trendNeutralColor: '#6b7280',
};

export const DEFAULT_DARK_THEME: EnergyPanelThemeConfig = {
  panelBackgroundColor: '#1a1a2e',
  cardBackgroundColor: 'linear-gradient(180deg, #1f2937 0%, #111827 100%)',
  chartBackgroundColor: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
  titleColor: '#f5f7fa',
  labelColor: '#9ca3af',
  valueColor: '#f5f7fa',
  trendColor: '#9ca3af',
  primaryColor: '#22c55e',
  chartBorderColor: '#166534',
  trendUpColor: '#ef4444',
  trendDownColor: '#22c55e',
  trendNeutralColor: '#9ca3af',
};
```

### Event Integration

```typescript
// Events the EnergyPanel listens to (optional auto-subscribe):
'myio:energy-summary-ready'         -> Updates KPI cards
'myio:filter-applied'               -> Refreshes charts
'myio:equipment-metadata-enriched'  -> Refreshes distribution chart
'myio:telemetry:clear'              -> Resets to loading state

// Events the EnergyPanel can dispatch:
'myio:energy-panel-ready'           -> Component initialized
'myio:energy-chart-data-loaded'     -> Chart data fetched
```

### Export in index.ts

```typescript
// Add to src/index.ts

// RFC-0117: Energy Panel Component
export {
  createEnergyPanel,
} from './components/energy-panel';

export type {
  EnergyPanelParams,
  EnergyPanelInstance,
  EnergyPanelConfigTemplate,
  EnergyPanelThemeConfig,
  EnergyThemeMode,
  EnergySummary,
  DistributionMode,
} from './components/energy-panel';
```

---

## Showcase

### File: `showcase/energy-panel.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MYIO - Energy Panel Showcase</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #f5f7fa;
      padding: 20px;
      min-height: 100vh;
    }
    .showcase-header {
      margin-bottom: 20px;
      padding: 16px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .showcase-header h1 {
      font-size: 24px;
      color: #1c2743;
      margin-bottom: 8px;
    }
    .showcase-controls {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: center;
    }
    .control-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .control-group label {
      font-size: 14px;
      color: #6b7a90;
    }
    .control-group select, .control-group button {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    }
    .control-group button {
      background: #16a34a;
      color: white;
      border-color: #16a34a;
    }
    .control-group button:hover {
      background: #15803d;
    }
    #energy-panel-container {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      min-height: 600px;
    }
    .dark-mode #energy-panel-container {
      background: #1a1a2e;
    }
    .dark-mode body {
      background: #0f0f1a;
    }
  </style>
</head>
<body>
  <div class="showcase-header">
    <h1>Energy Panel Component - RFC-0117</h1>
    <div class="showcase-controls">
      <div class="control-group">
        <label>Theme:</label>
        <select id="themeSelect">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div class="control-group">
        <label>Period:</label>
        <select id="periodSelect">
          <option value="7">7 dias</option>
          <option value="14">14 dias</option>
          <option value="30">30 dias</option>
        </select>
      </div>
      <div class="control-group">
        <button id="refreshBtn">Refresh Data</button>
      </div>
      <div class="control-group">
        <button id="simulateDataBtn">Simulate Data Update</button>
      </div>
    </div>
  </div>

  <div id="energy-panel-container"></div>

  <script src="../dist/myio-js-library.umd.js"></script>
  <script>
    // Mock data generator
    function generateMockConsumptionData(period) {
      const labels = [];
      const dailyTotals = [];
      const now = new Date();

      for (let i = period - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

        // Generate realistic consumption (8000-15000 kWh per day)
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const base = isWeekend ? 8000 : 12000;
        const variation = Math.random() * 3000;
        dailyTotals.push(base + variation);
      }

      return {
        labels,
        dailyTotals,
        shoppingData: {},
        shoppingNames: {},
        fetchTimestamp: Date.now()
      };
    }

    function generateMockDistributionData(mode) {
      if (mode === 'groups') {
        return {
          'Elevadores': 1500 + Math.random() * 500,
          'Escadas Rolantes': 800 + Math.random() * 300,
          'Climatizacao': 4000 + Math.random() * 1000,
          'Outros Equipamentos': 2000 + Math.random() * 500,
          'Lojas': 5000 + Math.random() * 1500
        };
      } else {
        return {
          'Shopping A': 3000 + Math.random() * 1000,
          'Shopping B': 2500 + Math.random() * 800,
          'Shopping C': 4000 + Math.random() * 1200,
          'Shopping D': 1800 + Math.random() * 600
        };
      }
    }

    // Initialize panel
    let energyPanel = null;

    function initPanel(themeMode) {
      const container = document.getElementById('energy-panel-container');
      container.innerHTML = '';

      if (energyPanel) {
        energyPanel.destroy();
      }

      energyPanel = MyIOLibrary.createEnergyPanel({
        container: container,
        themeMode: themeMode,

        configTemplate: {
          title: 'Gestao de Energia',
          enableDebugMode: true,
          defaultPeriod: parseInt(document.getElementById('periodSelect').value),
          defaultChartType: 'line',
          defaultVizMode: 'total',
        },

        initialSummary: {
          customerTotal: 15000,
          equipmentsTotal: 8500,
          difference: 6500,
          lastUpdated: new Date().toISOString()
        },

        fetchConsumptionData: async (period) => {
          // Simulate API delay
          await new Promise(r => setTimeout(r, 500));
          return generateMockConsumptionData(period);
        },

        fetchDistributionData: async (mode) => {
          // Simulate API delay
          await new Promise(r => setTimeout(r, 300));
          return generateMockDistributionData(mode);
        },

        onMaximizeClick: () => {
          console.log('Maximize clicked!');
        },

        onDistributionModeChange: (mode) => {
          console.log('Distribution mode changed:', mode);
        },

        onError: (error) => {
          console.error('Energy panel error:', error);
        }
      });

      console.log('Energy panel initialized:', energyPanel);
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', () => {
      initPanel('light');

      // Theme toggle
      document.getElementById('themeSelect').addEventListener('change', (e) => {
        const theme = e.target.value;
        document.body.classList.toggle('dark-mode', theme === 'dark');
        if (energyPanel) {
          energyPanel.setThemeMode(theme);
        }
      });

      // Period change
      document.getElementById('periodSelect').addEventListener('change', (e) => {
        const period = parseInt(e.target.value);
        if (energyPanel) {
          energyPanel.setChartPeriod(period);
        }
      });

      // Refresh button
      document.getElementById('refreshBtn').addEventListener('click', async () => {
        if (energyPanel) {
          await energyPanel.refreshCharts(true);
        }
      });

      // Simulate data update
      document.getElementById('simulateDataBtn').addEventListener('click', () => {
        if (energyPanel) {
          const newSummary = {
            customerTotal: 14000 + Math.random() * 3000,
            equipmentsTotal: 7000 + Math.random() * 2000,
            difference: 5000 + Math.random() * 2000,
            lastUpdated: new Date().toISOString()
          };
          energyPanel.updateSummary(newSummary);
          console.log('Simulated data update:', newSummary);
        }
      });
    });
  </script>
</body>
</html>
```

---

## Drawbacks

1. **Large Component Size**: ~40-50KB added to bundle (including chart components)
2. **Chart Dependency**: Requires Chart.js to be available
3. **Complex Data Flow**: Equipment classification logic adds complexity
4. **Event Coupling**: Tightly coupled to orchestrator event system

---

## Rationale and Alternatives

### Why Library Component?

| Aspect | Widget (Current) | Component (Proposed) |
|--------|-----------------|---------------------|
| Instantiation | ThingsBoard lifecycle | `createEnergyPanel()` |
| Data Updates | `onDataUpdated()` | Event-driven + API methods |
| Styling | External CSS file | Injected + theme support |
| Testing | Requires ThingsBoard | Unit testable + showcase |
| Reusability | Single dashboard | Multiple contexts |

### Alternatives Considered

1. **Keep Widget Only**: Rejected - doesn't fit RFC-0111 architecture
2. **Separate Card + Chart Components**: Rejected - loses cohesion, harder to coordinate
3. **React/Vue Component**: Rejected - library is vanilla JS/TS

---

## Prior Art

### Library Component Patterns

- `createConsumptionChartWidget()` - RFC-0098
- `createDistributionChartWidget()` - RFC-0102
- `createHeaderComponent()` - RFC-0113
- `openWelcomeModal()` - RFC-0112

### Existing ENERGY Widget

- `src/MYIO-SIM/v5.2.0/ENERGY/controller.js` (~2000 lines)
- Fully functional, production-tested
- Reference implementation for component

---

## Unresolved Questions

1. **Card Click Actions**: Should cards be clickable to open detail tooltips?
2. **Chart Sync**: Should consumption and distribution charts share filter state?
3. **Mobile Layout**: How should cards and charts stack on mobile?
4. **Peak Demand Card**: Bring back peak demand card feature?

---

## Future Possibilities

1. **Real-time Updates**: WebSocket integration for live consumption updates
2. **Alerts Integration**: Show alert badges on cards when thresholds exceeded
3. **Export Data**: Allow CSV/Excel export of chart data
4. **Comparison Mode**: Compare consumption between periods
5. **Goals/Targets**: Show progress toward consumption goals

---

## Implementation Plan

### Phase 1: Type Definitions
- [ ] Create `types.ts` with all interfaces
- [ ] Define `EnergyPanelParams`, `EnergySummary`, `DistributionMode`
- [ ] Define theme configuration types

### Phase 2: View Layer
- [ ] Create `EnergyPanelView.ts`
- [ ] Port HTML structure from `template.html`
- [ ] Port CSS from `styles.css` with theme support
- [ ] Implement `KPICards.ts` for summary cards

### Phase 3: Equipment Classifier
- [ ] Create `EquipmentClassifier.ts`
- [ ] Port classification logic from controller.js
- [ ] Add unit tests for classification

### Phase 4: Controller
- [ ] Create `EnergyPanelController.ts`
- [ ] Port business logic from controller.js
- [ ] Wire up `createConsumptionChartWidget` integration
- [ ] Wire up `createDistributionChartWidget` integration

### Phase 5: Entry Function
- [ ] Create `createEnergyPanel.ts`
- [ ] Implement instance methods
- [ ] Add event listeners
- [ ] Handle theme switching

### Phase 6: Showcase
- [ ] Create `showcase/energy-panel.html`
- [ ] Add mock data generators
- [ ] Add interactive controls

### Phase 7: Export & Integration
- [ ] Add exports to `src/index.ts`
- [ ] Create usage documentation
- [ ] Test with `MAIN_UNIQUE_DATASOURCE`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/energy-panel/index.ts` | Public exports |
| `src/components/energy-panel/createEnergyPanel.ts` | Main entry |
| `src/components/energy-panel/EnergyPanelView.ts` | View rendering |
| `src/components/energy-panel/EnergyPanelController.ts` | Business logic |
| `src/components/energy-panel/KPICards.ts` | Summary card components |
| `src/components/energy-panel/EquipmentClassifier.ts` | Equipment classification |
| `src/components/energy-panel/styles.ts` | Injected CSS with themes |
| `src/components/energy-panel/types.ts` | TypeScript interfaces |
| `showcase/energy-panel.html` | Standalone showcase |

## Files to Modify

| File | Change |
|------|--------|
| `src/index.ts` | Add exports for EnergyPanel |

---

## References

- [RFC-0098 Consumption7DaysChart](./RFC-0098-Consumption7DaysChart.md)
- [RFC-0102 DistributionChart](./RFC-0102-DistributionChart.md)
- [RFC-0111 Unified Main Single Datasource](./RFC-0111-Unified-Main-Single-Datasource-Architecture.md)
- [RFC-0113 HeaderComponent](./RFC-0113-HeaderComponent.md)
- [ENERGY Widget Source](../../MYIO-SIM/v5.2.0/ENERGY/)

---

**Document History:**
- 2026-01-02: Initial RFC created from ENERGY widget reverse engineering
