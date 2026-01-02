# RFC 0118: Water Panel Component Library

- Feature Name: `water_panel_component`
- Start Date: 2026-01-02
- RFC PR: (to be assigned)
- Status: **Draft**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0087 (Water Dashboard), RFC-0098 (Consumption7DaysChart), RFC-0102 (DistributionChart), RFC-0117 (EnergyPanel)

---

## Summary

This RFC documents the reverse-engineering of the existing WATER widget (`src/MYIO-SIM/v5.2.0/WATER/`) and proposes extracting its functionality into a reusable **WaterPanelComponent** in the MYIO library. The water panel provides consumption summary cards, time-series charts, and distribution visualizations for the Head Office dashboard.

---

## Motivation

### Current State: WATER Widget (v5.2.0)

The existing WATER widget (`src/MYIO-SIM/v5.2.0/WATER/`) is a ThingsBoard widget that provides:

1. **Title Header**: "Gestao de Agua" with subtitle
2. **KPI Summary Cards**:
   - Consumo Total Lojas (stores water consumption)
   - Consumo Total Area Comum (common area water consumption)
   - Consumo Total (combined total - highlighted card)
3. **Consumption Chart**: 7-day consumption line/bar chart (uses `createConsumptionChartWidget`)
4. **Distribution Chart**: Pie/doughnut chart by category (uses `createDistributionChartWidget`)
5. **Zoom Controls**: Font size adjustment buttons
6. **Shopping Filter Chips**: Visual feedback for active shopping filter
7. **Fullscreen Modal**: Expanded view for consumption chart

### Problem

The WATER functionality is tightly coupled to ThingsBoard widget system. With RFC-0111's architecture:

1. **Library Component**: Need standalone component callable from any widget
2. **Consistent API**: Follow existing library patterns (matching RFC-0117 EnergyPanel)
3. **Reusability**: Support multiple dashboard contexts
4. **Event-Driven**: React to orchestrator events for data updates
5. **Theme Support**: Dark/light mode compatibility

### Goals

1. Extract WATER logic into `createWaterPanel()` library function
2. Expose via `src/index.ts` for consumption
3. Support data updates via CustomEvents
4. Maintain feature parity with existing widget
5. Integrate with existing `createConsumptionChartWidget` and `createDistributionChartWidget`
6. Create showcase for standalone testing
7. Match API patterns with RFC-0117 (EnergyPanel) for consistency

---

## Guide-level Explanation

### Existing WATER Widget Structure

```
src/MYIO-SIM/v5.2.0/WATER/
├── controller.js          # Widget logic (~1600 lines)
├── template.html          # HTML structure (102 lines)
├── styles.css             # CSS styles (424 lines)
├── settings.schema        # Widget settings
├── base.json              # Widget definition
└── dataKeySettings.json   # Data key configuration
```

### Current Features (Reverse Engineering)

#### 1. KPI Summary Cards

```html
<!-- Template Structure -->
<div class="water-dashboard">
  <div class="toolbar-zoom">
    <div class="shopping-filter-chips" id="waterShoppingFilterChips"></div>
    <button id="fontMinus">-</button>
    <button id="fontPlus">+</button>
  </div>

  <h2 class="title">Gestao de Agua</h2>
  <p class="subtitle">Monitoramento de consumo e metricas de eficiencia hidrica</p>

  <div class="cards">
    <!-- Consumo Total Lojas Card -->
    <div class="card" id="total-consumption-stores-card">
      <p class="label">Consumo Total Lojas</p>
      <h3 class="value" id="total-consumption-stores-value"><!-- spinner or value --></h3>
      <span class="trend neutral" id="total-consumption-stores-trend">Aguardando dados...</span>
      <span class="device-info" id="total-consumption-stores-info">Hidrometros de lojas</span>
    </div>

    <!-- Consumo Total Area Comum Card -->
    <div class="card" id="total-consumption-common-area-card">
      <p class="label">Consumo Total Area Comum</p>
      <h3 class="value" id="total-consumption-common-area-value"><!-- spinner or value --></h3>
      <span class="trend neutral" id="total-consumption-common-area-trend">Aguardando dados...</span>
      <span class="device-info" id="total-consumption-common-area-info">Hidrometros de areas comuns</span>
    </div>

    <!-- Consumo Total Card (Highlighted) -->
    <div class="card highlight" id="total-consumption-card">
      <p class="label">Consumo Total</p>
      <h3 class="value" id="total-consumption-value"><!-- spinner or value --></h3>
      <span class="trend neutral" id="total-consumption-trend">Aguardando dados...</span>
      <span class="device-info" id="total-consumption-info">Lojas + Area Comum</span>
    </div>
  </div>

  <div class="charts">
    <div id="water-chart-widget" class="chart-box chart-box-water"></div>
    <div id="water-distribution-widget" class="chart-box chart-box-water"></div>
  </div>
</div>
```

#### 2. Card Data Model

```typescript
interface WaterSummary {
  storesTotal: number;        // Stores water consumption (m3)
  commonAreaTotal: number;    // Common area water consumption (m3)
  totalGeral: number;         // Total = storesTotal + commonAreaTotal
  lastUpdated?: string;       // ISO timestamp
}

interface StoresCardData {
  value: string;              // Formatted value "123,4 m3"
  percentage: number;         // % of total
  info: string;               // "Hidrometros de lojas"
}

interface CommonAreaCardData {
  value: string;              // Formatted value "56,7 m3"
  percentage: number;         // % of total
  info: string;               // "Hidrometros de areas comuns"
}

interface TotalCardData {
  value: string;              // Formatted value "180,1 m3"
  trend: string;              // "Lojas + Area Comum"
  info: string;               // "123,4 m3 lojas | 56,7 m3 area comum"
}
```

#### 3. Water Categorization Logic

```typescript
// Water uses simpler categorization than Energy
// Based on waterValidIds from Orchestrator (ThingsBoard Aliases)

type WaterCategory = 'stores' | 'commonArea';

interface WaterValidIds {
  stores: Set<string>;      // ingestionIds of store hydrometers
  commonArea: Set<string>;  // ingestionIds of common area hydrometers
}

// Categories are determined by ThingsBoard Aliases, not device metadata
// - WATER_STORES alias -> stores category
// - WATER_COMMON_AREA alias -> commonArea category
```

#### 4. Distribution Modes

```typescript
type WaterDistributionMode =
  | 'groups'   // Lojas vs Area Comum (default)
  | 'stores'   // Stores by shopping
  | 'common';  // Common area by shopping
```

#### 5. Event Integration

```javascript
// Events listened to:
'myio:water-data-ready'         -> Updates KPI cards (from MAIN)
'myio:water-totals-updated'     -> Updates KPI cards (from Orchestrator)
'myio:update-date'              -> Refreshes with new date range
'myio:filter-applied'           -> Updates shopping filter chips

// Events dispatched:
'myio:request-water-data'       -> Requests consumption data from MAIN
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

#### 7. Volume Formatting

```typescript
// Water uses m3 (cubic meters) unit
function formatWaterVolume(value: number): string {
  if (value == null || isNaN(value)) return '- m3';
  if (value >= 1000) {
    return (value / 1000).toFixed(2).replace('.', ',') + 'k m3';
  }
  return value.toFixed(1).replace('.', ',') + ' m3';
}
```

---

## Reference-level Explanation

### Proposed Library Component

#### File Structure

```
src/components/water-panel/
├── index.ts                    # Public exports
├── createWaterPanel.ts         # Main entry function
├── WaterPanelView.ts           # View rendering
├── WaterPanelController.ts     # Business logic
├── KPICards.ts                 # Summary card components
├── styles.ts                   # Injected CSS
└── types.ts                    # TypeScript interfaces
```

#### Public API

```typescript
// src/components/water-panel/types.ts

export type WaterThemeMode = 'dark' | 'light';

export type WaterDistributionMode = 'groups' | 'stores' | 'common';

export interface WaterPanelThemeConfig {
  // Background colors
  panelBackgroundColor?: string;
  cardBackgroundColor?: string;
  cardHighlightBackgroundColor?: string;
  chartBackgroundColor?: string;

  // Text colors
  titleColor?: string;
  subtitleColor?: string;
  labelColor?: string;
  valueColor?: string;
  trendColor?: string;

  // Accent colors
  primaryColor?: string;       // Default: blue for water (#0288d1)
  chartBorderColor?: string;

  // Trend colors
  trendUpColor?: string;       // Increase (bad for consumption)
  trendDownColor?: string;     // Decrease (good for consumption)
  trendNeutralColor?: string;

  // Distribution chart colors
  storesColor?: string;        // Default: #10b981 (green)
  commonAreaColor?: string;    // Default: #0288d1 (blue)
}

export interface WaterPanelConfigTemplate {
  // Debug
  enableDebugMode?: boolean;

  // Content
  title?: string;              // Default: "Gestao de Agua"
  subtitle?: string;           // Default: "Monitoramento de consumo..."
  showTitle?: boolean;         // Default: true
  showSubtitle?: boolean;      // Default: true

  // Cards
  showStoresCard?: boolean;    // Default: true
  showCommonAreaCard?: boolean; // Default: true
  showTotalCard?: boolean;     // Default: true
  storesCardLabel?: string;    // Default: "Consumo Total Lojas"
  commonAreaCardLabel?: string; // Default: "Consumo Total Area Comum"
  totalCardLabel?: string;     // Default: "Consumo Total"

  // Charts
  showConsumptionChart?: boolean; // Default: true
  showDistributionChart?: boolean; // Default: true
  defaultPeriod?: number;      // Default: 7 days
  defaultChartType?: 'line' | 'bar';
  defaultVizMode?: 'total' | 'separate';

  // Distribution chart modes
  distributionModes?: Array<{
    value: WaterDistributionMode;
    label: string;
  }>;

  // Toolbar
  showZoomControls?: boolean;  // Default: true
  showFilterChips?: boolean;   // Default: true

  // Theme settings
  darkMode?: WaterPanelThemeConfig;
  lightMode?: WaterPanelThemeConfig;
}

export interface WaterSummary {
  storesTotal: number;
  commonAreaTotal: number;
  totalGeral: number;
  lastUpdated?: string;
}

export interface WaterPanelParams {
  // Container
  container: HTMLElement | string; // Element or ID

  // ThingsBoard context (optional for navigation)
  ctx?: ThingsboardWidgetContext;

  // Configuration template
  configTemplate?: WaterPanelConfigTemplate;

  // Theme
  themeMode?: WaterThemeMode;

  // Initial data
  initialSummary?: WaterSummary;

  // Data fetching
  fetchConsumptionData?: (period: number) => Promise<ConsumptionData>;
  fetchDistributionData?: (mode: WaterDistributionMode) => Promise<DistributionData>;

  // Valid IDs for categorization (from Orchestrator)
  getWaterValidIds?: () => { stores: Set<string>; commonArea: Set<string> } | null;

  // Shopping colors (for consistent colors across charts)
  getShoppingColors?: () => Record<string, string> | null;

  // Callbacks
  onMaximizeClick?: () => void;
  onDataLoaded?: (data: ConsumptionData) => void;
  onDistributionModeChange?: (mode: WaterDistributionMode) => void;
  onZoomChange?: (zoom: number) => void;
  onError?: (error: Error) => void;
}

export interface WaterPanelInstance {
  // Update methods
  updateSummary: (summary: WaterSummary) => void;
  refreshCharts: (forceRefresh?: boolean) => Promise<void>;
  refreshDistribution: () => Promise<void>;

  // Theme
  setThemeMode: (mode: WaterThemeMode) => void;
  getThemeMode: () => WaterThemeMode;

  // Chart control
  setChartPeriod: (period: number) => void;
  setChartType: (type: 'line' | 'bar') => void;
  setVizMode: (mode: 'total' | 'separate') => void;
  setDistributionMode: (mode: WaterDistributionMode) => void;

  // Zoom control
  setZoom: (zoom: number) => void;
  getZoom: () => number;

  // Filter chips
  updateFilterChips: (shoppings: Shopping[]) => void;

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

export function createWaterPanel(params: WaterPanelParams): WaterPanelInstance;
```

#### Usage Example

```javascript
// In MAIN_UNIQUE_DATASOURCE controller.js onInit():
import { createWaterPanel } from 'myio-js-library';

self.onInit = async function() {
  const waterContainer = document.getElementById('water-panel-mount');

  const waterPanel = createWaterPanel({
    container: waterContainer,
    ctx: self.ctx,
    themeMode: 'light',

    configTemplate: {
      title: 'Gestao de Agua',
      subtitle: 'Monitoramento de consumo e metricas de eficiencia hidrica',
      defaultPeriod: 7,
      defaultChartType: 'line',
      defaultVizMode: 'total',
      distributionModes: [
        { value: 'groups', label: 'Lojas vs Area Comum' },
        { value: 'stores', label: 'Lojas por Shopping' },
        { value: 'common', label: 'Area Comum por Shopping' },
      ],
    },

    fetchConsumptionData: async (period) => {
      const customerIds = getSelectedShoppingIds() || [window.myioHoldingCustomerId];
      return await fetchWaterConsumptionForPeriod(customerIds, period);
    },

    fetchDistributionData: async (mode) => {
      return await calculateWaterDistributionByMode(mode);
    },

    getWaterValidIds: () => {
      const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
      return orchestrator?.getWaterValidIds?.() || null;
    },

    getShoppingColors: () => {
      const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
      return orchestrator?.getShoppingColors?.() || null;
    },

    onMaximizeClick: () => {
      console.log('Maximize clicked');
    },

    onError: (error) => {
      console.error('Water panel error:', error);
    }
  });

  // Listen for data updates from orchestrator
  window.addEventListener('myio:water-totals-updated', (e) => {
    const { stores, commonArea, total } = e.detail;
    waterPanel.updateSummary({
      storesTotal: stores,
      commonAreaTotal: commonArea,
      totalGeral: total,
      lastUpdated: new Date().toISOString()
    });
  });

  window.addEventListener('myio:filter-applied', async (e) => {
    const selection = e.detail?.selection || [];
    waterPanel.updateFilterChips(selection);
    await waterPanel.refreshCharts(true);
  });
};
```

### Default Theme Configuration

```typescript
export const DEFAULT_LIGHT_THEME: WaterPanelThemeConfig = {
  panelBackgroundColor: 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)',
  cardBackgroundColor: 'linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)',
  cardHighlightBackgroundColor: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
  chartBackgroundColor: '#ffffff',
  titleColor: '#0c4a6e',
  subtitleColor: '#64748b',
  labelColor: '#64748b',
  valueColor: '#0c4a6e',
  trendColor: '#64748b',
  primaryColor: '#0288d1',
  chartBorderColor: '#bae6fd',
  trendUpColor: '#dc2626',
  trendDownColor: '#16a34a',
  trendNeutralColor: '#64748b',
  storesColor: '#10b981',
  commonAreaColor: '#0288d1',
};

export const DEFAULT_DARK_THEME: WaterPanelThemeConfig = {
  panelBackgroundColor: 'linear-gradient(180deg, #0c4a6e 0%, #0f172a 100%)',
  cardBackgroundColor: 'linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)',
  cardHighlightBackgroundColor: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
  chartBackgroundColor: '#1e3a5f',
  titleColor: '#f0f9ff',
  subtitleColor: '#94a3b8',
  labelColor: '#94a3b8',
  valueColor: '#f0f9ff',
  trendColor: '#94a3b8',
  primaryColor: '#38bdf8',
  chartBorderColor: '#0369a1',
  trendUpColor: '#ef4444',
  trendDownColor: '#22c55e',
  trendNeutralColor: '#94a3b8',
  storesColor: '#34d399',
  commonAreaColor: '#38bdf8',
};
```

### Event Integration

```typescript
// Events the WaterPanel listens to (optional auto-subscribe):
'myio:water-data-ready'         -> Updates KPI cards (legacy)
'myio:water-totals-updated'     -> Updates KPI cards (preferred)
'myio:filter-applied'           -> Updates filter chips, refreshes charts
'myio:update-date'              -> Refreshes with new date range

// Events the WaterPanel can dispatch:
'myio:water-panel-ready'        -> Component initialized
'myio:request-water-data'       -> Requests data from MAIN/Orchestrator
```

### Export in index.ts

```typescript
// Add to src/index.ts

// RFC-0118: Water Panel Component
export {
  createWaterPanel,
} from './components/water-panel';

export type {
  WaterPanelParams,
  WaterPanelInstance,
  WaterPanelConfigTemplate,
  WaterPanelThemeConfig,
  WaterThemeMode,
  WaterSummary,
  WaterDistributionMode,
} from './components/water-panel';
```

---

## Showcase

### File: `showcase/water-panel.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MYIO - Water Panel Showcase</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #f0f9ff;
      padding: 20px;
      min-height: 100vh;
    }
    .showcase-header {
      margin-bottom: 20px;
      padding: 16px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(2, 136, 209, 0.1);
    }
    .showcase-header h1 {
      font-size: 24px;
      color: #0c4a6e;
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
      color: #64748b;
    }
    .control-group select, .control-group button {
      padding: 8px 12px;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    }
    .control-group button {
      background: #0288d1;
      color: white;
      border-color: #0288d1;
    }
    .control-group button:hover {
      background: #0369a1;
    }
    #water-panel-container {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(2, 136, 209, 0.1);
      min-height: 700px;
    }
    .dark-mode #water-panel-container {
      background: #0c4a6e;
    }
    .dark-mode body {
      background: #0f172a;
    }
  </style>
</head>
<body>
  <div class="showcase-header">
    <h1>Water Panel Component - RFC-0118</h1>
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
      <div class="control-group">
        <button id="simulateFilterBtn">Simulate Filter</button>
      </div>
    </div>
  </div>

  <div id="water-panel-container"></div>

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

        // Generate realistic water consumption (50-200 m3 per day)
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const base = isWeekend ? 60 : 120;
        const variation = Math.random() * 80;
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
          'Lojas': 450 + Math.random() * 150,
          'Area Comum': 250 + Math.random() * 100
        };
      } else {
        return {
          'Shopping A': 180 + Math.random() * 60,
          'Shopping B': 150 + Math.random() * 50,
          'Shopping C': 220 + Math.random() * 70,
          'Shopping D': 100 + Math.random() * 40
        };
      }
    }

    // Initialize panel
    let waterPanel = null;

    function initPanel(themeMode) {
      const container = document.getElementById('water-panel-container');
      container.innerHTML = '';

      if (waterPanel) {
        waterPanel.destroy();
      }

      waterPanel = MyIOLibrary.createWaterPanel({
        container: container,
        themeMode: themeMode,

        configTemplate: {
          title: 'Gestao de Agua',
          subtitle: 'Monitoramento de consumo e metricas de eficiencia hidrica',
          enableDebugMode: true,
          defaultPeriod: parseInt(document.getElementById('periodSelect').value),
          defaultChartType: 'line',
          defaultVizMode: 'total',
        },

        initialSummary: {
          storesTotal: 456.7,
          commonAreaTotal: 234.5,
          totalGeral: 691.2,
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

        onZoomChange: (zoom) => {
          console.log('Zoom changed:', zoom);
        },

        onError: (error) => {
          console.error('Water panel error:', error);
        }
      });

      console.log('Water panel initialized:', waterPanel);
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', () => {
      initPanel('light');

      // Theme toggle
      document.getElementById('themeSelect').addEventListener('change', (e) => {
        const theme = e.target.value;
        document.body.classList.toggle('dark-mode', theme === 'dark');
        if (waterPanel) {
          waterPanel.setThemeMode(theme);
        }
      });

      // Period change
      document.getElementById('periodSelect').addEventListener('change', (e) => {
        const period = parseInt(e.target.value);
        if (waterPanel) {
          waterPanel.setChartPeriod(period);
        }
      });

      // Refresh button
      document.getElementById('refreshBtn').addEventListener('click', async () => {
        if (waterPanel) {
          await waterPanel.refreshCharts(true);
        }
      });

      // Simulate data update
      document.getElementById('simulateDataBtn').addEventListener('click', () => {
        if (waterPanel) {
          const newSummary = {
            storesTotal: 400 + Math.random() * 200,
            commonAreaTotal: 200 + Math.random() * 100,
            totalGeral: 0,
            lastUpdated: new Date().toISOString()
          };
          newSummary.totalGeral = newSummary.storesTotal + newSummary.commonAreaTotal;
          waterPanel.updateSummary(newSummary);
          console.log('Simulated data update:', newSummary);
        }
      });

      // Simulate filter
      document.getElementById('simulateFilterBtn').addEventListener('click', () => {
        if (waterPanel) {
          const mockShoppings = [
            { name: 'Shopping Mestre Alvaro', value: 'id-1' },
            { name: 'Shopping Mont Serrat', value: 'id-2' },
          ];
          waterPanel.updateFilterChips(mockShoppings);
          console.log('Simulated filter:', mockShoppings);
        }
      });
    });
  </script>
</body>
</html>
```

---

## Drawbacks

1. **Component Size**: ~35-45KB added to bundle (including chart components)
2. **Chart Dependency**: Requires Chart.js to be available
3. **Simpler Categorization**: Water only has 2 categories vs Energy's 5+ equipment types
4. **Event Coupling**: Tightly coupled to orchestrator event system

---

## Rationale and Alternatives

### Why Library Component?

| Aspect | Widget (Current) | Component (Proposed) |
|--------|-----------------|---------------------|
| Instantiation | ThingsBoard lifecycle | `createWaterPanel()` |
| Data Updates | `onDataUpdated()` | Event-driven + API methods |
| Styling | External CSS file | Injected + theme support |
| Testing | Requires ThingsBoard | Unit testable + showcase |
| Reusability | Single dashboard | Multiple contexts |

### Consistency with EnergyPanel (RFC-0117)

Water and Energy panels share similar structure:
- Both have KPI summary cards
- Both use `createConsumptionChartWidget` for time-series
- Both use `createDistributionChartWidget` for distribution
- Both support theme modes and filter integration

API consistency allows developers to easily work with both.

### Alternatives Considered

1. **Keep Widget Only**: Rejected - doesn't fit RFC-0111 architecture
2. **Merge with EnergyPanel**: Rejected - different categorization, different color themes
3. **Generic ResourcePanel**: Rejected - too abstract, loses domain specificity

---

## Prior Art

### Library Component Patterns

- `createConsumptionChartWidget()` - RFC-0098
- `createDistributionChartWidget()` - RFC-0102
- `createEnergyPanel()` - RFC-0117
- `createHeaderComponent()` - RFC-0113

### Existing WATER Widget

- `src/MYIO-SIM/v5.2.0/WATER/controller.js` (~1600 lines)
- Fully functional, production-tested
- Reference implementation for component

---

## Unresolved Questions

1. **Leak Detection**: Add leak detection alerts to cards?
2. **Comparison Mode**: Show comparison with previous period?
3. **Export Data**: Allow CSV/Excel export of chart data?
4. **Mobile Layout**: How should cards and charts stack on mobile?

---

## Future Possibilities

1. **Leak Detection Alerts**: Show warning badges when anomalies detected
2. **Real-time Updates**: WebSocket integration for live consumption
3. **Conservation Goals**: Show progress toward water conservation targets
4. **Weather Correlation**: Correlate consumption with weather data
5. **Per-meter Detail View**: Click on distribution to see meter-level data

---

## Implementation Plan

### Phase 1: Type Definitions
- [ ] Create `types.ts` with all interfaces
- [ ] Define `WaterPanelParams`, `WaterSummary`, `WaterDistributionMode`
- [ ] Define theme configuration types

### Phase 2: View Layer
- [ ] Create `WaterPanelView.ts`
- [ ] Port HTML structure from `template.html`
- [ ] Port CSS from `styles.css` with theme support
- [ ] Implement `KPICards.ts` for summary cards
- [ ] Implement zoom controls and filter chips

### Phase 3: Controller
- [ ] Create `WaterPanelController.ts`
- [ ] Port business logic from controller.js
- [ ] Wire up `createConsumptionChartWidget` integration
- [ ] Wire up `createDistributionChartWidget` integration
- [ ] Implement cache management

### Phase 4: Entry Function
- [ ] Create `createWaterPanel.ts`
- [ ] Implement instance methods
- [ ] Add event listeners
- [ ] Handle theme switching

### Phase 5: Showcase
- [ ] Create `showcase/water-panel.html`
- [ ] Add mock data generators
- [ ] Add interactive controls

### Phase 6: Export & Integration
- [ ] Add exports to `src/index.ts`
- [ ] Create usage documentation
- [ ] Test with `MAIN_UNIQUE_DATASOURCE`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/water-panel/index.ts` | Public exports |
| `src/components/water-panel/createWaterPanel.ts` | Main entry |
| `src/components/water-panel/WaterPanelView.ts` | View rendering |
| `src/components/water-panel/WaterPanelController.ts` | Business logic |
| `src/components/water-panel/KPICards.ts` | Summary card components |
| `src/components/water-panel/styles.ts` | Injected CSS with themes |
| `src/components/water-panel/types.ts` | TypeScript interfaces |
| `showcase/water-panel.html` | Standalone showcase |

## Files to Modify

| File | Change |
|------|--------|
| `src/index.ts` | Add exports for WaterPanel |

---

## References

- [RFC-0087 Water Consumption Dashboard](./RFC-0087-Water-Dashboard.md)
- [RFC-0098 Consumption7DaysChart](./RFC-0098-Consumption7DaysChart.md)
- [RFC-0102 DistributionChart](./RFC-0102-DistributionChart.md)
- [RFC-0117 EnergyPanelComponent](./RFC-0117-EnergyPanelComponent.md)
- [WATER Widget Source](../../MYIO-SIM/v5.2.0/WATER/)

---

**Document History:**
- 2026-01-02: Initial RFC created from WATER widget reverse engineering
