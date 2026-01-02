# RFC 0119: Temperature Panel Component Library

- Feature Name: `temperature_panel_component`
- Start Date: 2026-01-02
- RFC PR: (to be assigned)
- Status: **Draft**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0092 (Temperature Dashboard), RFC-0098 (Consumption7DaysChart), RFC-0100 (Temperature Orchestration), RFC-0117 (EnergyPanel), RFC-0118 (WaterPanel)

---

## Summary

This RFC documents the reverse-engineering of the existing TEMPERATURE widget (`src/MYIO-SIM/v5.2.0/TEMPERATURE/`) and proposes extracting its functionality into a reusable **TemperaturePanelComponent** in the MYIO library. The temperature panel provides KPI summary cards, time-series charts, shopping comparison visualization, and a detailed shopping list for the Head Office dashboard.

---

## Motivation

### Current State: TEMPERATURE Widget (v5.2.0)

The existing TEMPERATURE widget (`src/MYIO-SIM/v5.2.0/TEMPERATURE/`) is a ThingsBoard widget that provides:

1. **KPI Summary Cards (4 cards)**:
   - Temperatura Media Global (with progress bar toward target)
   - Total de Sensores
   - Shoppings Online (with active badge)
   - Alertas (out of range count)
2. **7-Day Temperature Chart**: Time-series using `createConsumptionChartWidget`
3. **Comparison Chart**: Multi-series chart comparing all shoppings
4. **Shopping Temperature List**: Detailed status per shopping center
5. **Temperature Status Logic**: Normal / Hot / Cold / No Info
6. **Temperature Detail Modal**: Detailed view per shopping via `openTemperatureComparisonModal`
7. **Loading Overlay**: Visual feedback during data fetch

### Problem

The TEMPERATURE functionality is tightly coupled to ThingsBoard widget system. With RFC-0111's architecture:

1. **Library Component**: Need standalone component callable from any widget
2. **Consistent API**: Follow existing library patterns (matching RFC-0117, RFC-0118)
3. **Reusability**: Support multiple dashboard contexts
4. **Event-Driven**: React to orchestrator events for data updates
5. **Theme Support**: Dark/light mode compatibility

### Goals

1. Extract TEMPERATURE logic into `createTemperaturePanel()` library function
2. Expose via `src/index.ts` for consumption
3. Support data updates via CustomEvents
4. Maintain feature parity with existing widget
5. Integrate with existing `createConsumptionChartWidget`
6. Create showcase for standalone testing
7. Match API patterns with RFC-0117, RFC-0118 for consistency

---

## Guide-level Explanation

### Existing TEMPERATURE Widget Structure

```
src/MYIO-SIM/v5.2.0/TEMPERATURE/
├── controller.js          # Widget logic (~940 lines)
├── template.html          # HTML structure (93 lines)
├── styles.css             # CSS styles (534 lines)
├── settings.schema        # Widget settings
├── base.json              # Widget definition
└── dataKeySettings.json   # Data key configuration
```

### Current Features (Reverse Engineering)

#### 1. KPI Summary Cards

```html
<!-- Template Structure -->
<section class="tb-temp-root">
  <!-- Loading overlay -->
  <div id="temperature-loading-overlay" class="temperature-loading-overlay">
    <div class="loading-spinner">...</div>
  </div>

  <!-- KPI Header Cards -->
  <header class="header">
    <!-- Average Temperature Card -->
    <div class="kpi-card">
      <div class="kpi-head">
        <span class="kpi-title">Temperatura Media Global</span>
        <i class="kpi-ico">🌡️</i>
      </div>
      <div class="kpi-value" id="avgTemp">--</div>
      <div class="kpi-sub"><span id="avgTempTarget">Meta: 23°C +/- 2°C</span></div>
      <div class="kpi-progress">
        <div class="bar" id="avgTempBar" style="width: 0%"></div>
      </div>
    </div>

    <!-- Total Sensors Card -->
    <div class="kpi-card">
      <div class="kpi-head">
        <span class="kpi-title">Total de Sensores</span>
        <i class="kpi-ico">📊</i>
      </div>
      <div class="kpi-value" id="totalSensors">--</div>
      <div class="kpi-sub">Sensores Monitorados</div>
    </div>

    <!-- Shoppings Online Card -->
    <div class="kpi-card">
      <div class="kpi-head">
        <span class="kpi-title">Shoppings Online</span>
        <i class="kpi-ico">🏬</i>
      </div>
      <div class="kpi-value" id="shoppingsOnline">--</div>
      <div class="kpi-sub"><span class="badge badge-on" id="shoppingsBadge">Ativo</span></div>
    </div>

    <!-- Alerts Card -->
    <div class="kpi-card alert-card">
      <div class="kpi-head">
        <span class="kpi-title">Alertas</span>
        <i class="kpi-ico">⚠️</i>
      </div>
      <div class="kpi-value" id="alertCount">--</div>
      <div class="kpi-sub">Fora do intervalo ideal</div>
    </div>
  </header>

  <!-- Charts Row -->
  <div class="charts-row">
    <section id="temperature-chart-widget" class="chart-card"></section>
    <section class="chart-card">
      <h3 class="chart-title">Comparativo de Temperatura por Shopping</h3>
      <div class="chart-container"><canvas id="tempChart"></canvas></div>
    </section>
  </div>

  <!-- Shopping List -->
  <section class="list-card">
    <h3 class="list-title">Temperatura por Shopping Center</h3>
    <div class="shopping-list" id="shoppingList"><!-- rows --></div>
  </section>
</section>
```

#### 2. Data Models

```typescript
interface TemperatureKPIs {
  globalAvgTemp: number | null;  // Global average temperature
  totalSensors: number;          // Total sensor count
  shoppingsOnline: number;       // Number of shoppings with data
  alertCount: number;            // Shoppings out of range
}

interface ShoppingSeries {
  label: string;                 // Shopping name
  customerId: string;            // ThingsBoard customer ID
  avgTemp: number | null;        // Average temperature
  minTemp: number | null;        // Minimum temperature
  maxTemp: number | null;        // Maximum temperature
  sensorCount: number;           // Number of sensors
  lastUpdate: number;            // Timestamp of last update
  data: Array<{ t: string; v: number }>; // Time series data points
}

interface TemperatureSensor {
  id: string;
  name: string;
  label: string;
  temperature: number | null;
  lastUpdate: number | null;
  customerId: string;
  customerName: string;
  temperatureMin: number;        // Default: 18
  temperatureMax: number;        // Default: 26
}
```

#### 3. Temperature Status Logic

```typescript
type TemperatureStatus = 'normal' | 'hot' | 'cold' | 'no_info';

function getTemperatureStatus(
  avgTemp: number | null,
  target: number = 23,
  tolerance: number = 2
): TemperatureStatus {
  if (avgTemp === null || avgTemp === undefined || isNaN(avgTemp)) {
    return 'no_info';
  }
  if (avgTemp < target - tolerance) return 'cold';
  if (avgTemp > target + tolerance) return 'hot';
  return 'normal';
}

// Status display labels
const STATUS_LABELS = {
  normal: 'Normal',
  cold: 'Frio',
  hot: 'Quente',
  no_info: 'Sem Dados',
};
```

#### 4. Shopping Aggregation

```typescript
// Aggregates sensor data by shopping center
function aggregateByShoppingCenter(sensors: TemperatureSensor[]): ShoppingSeries[] {
  const shoppingMap = new Map<string, ShoppingSeries>();

  sensors.forEach(sensor => {
    const customerId = sensor.customerId || 'unknown';
    const customerName = sensor.customerName || 'Desconhecido';

    if (!shoppingMap.has(customerId)) {
      shoppingMap.set(customerId, {
        customerId,
        label: customerName,
        sensors: [],
        temperatures: [],
        avgTemp: null,
        minTemp: null,
        maxTemp: null,
        sensorCount: 0,
        lastUpdate: 0,
        data: [],
      });
    }

    const shopping = shoppingMap.get(customerId)!;
    shopping.sensors.push(sensor);

    if (sensor.temperature !== null && !isNaN(sensor.temperature)) {
      shopping.temperatures.push(Number(sensor.temperature));
      shopping.lastUpdate = Math.max(shopping.lastUpdate, sensor.lastUpdate || 0);
    }
  });

  // Calculate aggregates
  return Array.from(shoppingMap.values()).map(shopping => {
    const temps = shopping.temperatures;
    if (temps.length > 0) {
      shopping.avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      shopping.minTemp = Math.min(...temps);
      shopping.maxTemp = Math.max(...temps);
    }
    shopping.sensorCount = shopping.sensors.length;
    return shopping;
  }).sort((a, b) => (b.avgTemp || 0) - (a.avgTemp || 0)); // Sort by temp descending
}
```

#### 5. Event Integration

```javascript
// Events listened to:
'myio:filter-applied'           -> Updates selected shoppings, refreshes
'myio:update-date'              -> Updates date range, refreshes
'myio:temperature-data-ready'   -> Updates with orchestrator data

// Events dispatched:
'myio:request-temperature-data' -> Requests data from orchestrator
```

#### 6. Comparison Chart Configuration

```typescript
// Multi-series line chart comparing shoppings
const chartConfig = {
  type: 'line',
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      y: {
        suggestedMin: 18,
        suggestedMax: 30,
        ticks: { callback: (value) => `${value}°C` },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
      },
    },
  },
};

// Color palette for shopping series
const SHOPPING_COLORS = [
  { border: '#e65100', bg: 'rgba(230, 81, 0, 0.1)' },
  { border: '#1565c0', bg: 'rgba(21, 101, 192, 0.1)' },
  { border: '#2e7d32', bg: 'rgba(46, 125, 50, 0.1)' },
  { border: '#7b1fa2', bg: 'rgba(123, 31, 162, 0.1)' },
  { border: '#c62828', bg: 'rgba(198, 40, 40, 0.1)' },
  { border: '#00838f', bg: 'rgba(0, 131, 143, 0.1)' },
  { border: '#ef6c00', bg: 'rgba(239, 108, 0, 0.1)' },
  { border: '#6a1b9a', bg: 'rgba(106, 27, 154, 0.1)' },
];
```

---

## Reference-level Explanation

### Proposed Library Component

#### File Structure

```
src/components/temperature-panel/
├── index.ts                    # Public exports
├── createTemperaturePanel.ts   # Main entry function
├── TemperaturePanelView.ts     # View rendering
├── TemperaturePanelController.ts # Business logic
├── KPICards.ts                 # KPI card components
├── ComparisonChart.ts          # Shopping comparison chart
├── ShoppingList.ts             # Shopping list component
├── TemperatureAggregator.ts    # Data aggregation logic
├── styles.ts                   # Injected CSS
└── types.ts                    # TypeScript interfaces
```

#### Public API

```typescript
// src/components/temperature-panel/types.ts

export type TemperatureThemeMode = 'dark' | 'light';

export type TemperatureStatus = 'normal' | 'hot' | 'cold' | 'no_info';

export interface TemperaturePanelThemeConfig {
  // Background colors
  panelBackgroundColor?: string;
  cardBackgroundColor?: string;
  alertCardBackgroundColor?: string;
  chartBackgroundColor?: string;
  listCardBackgroundColor?: string;

  // Text colors
  titleColor?: string;
  subtitleColor?: string;
  labelColor?: string;
  valueColor?: string;

  // Brand colors
  primaryColor?: string;         // Default: orange for temperature (#e65100)
  primaryLightColor?: string;    // Default: #ff9800
  accentColor?: string;          // Default: #ff5722

  // Status colors
  normalColor?: string;          // Default: #15a34a (green)
  hotColor?: string;             // Default: #c62828 (red)
  coldColor?: string;            // Default: #1565c0 (blue)
  noInfoColor?: string;          // Default: #bdbdbd (gray)

  // Progress bar colors
  progressBackgroundColor?: string;
  progressBarColor?: string;
}

export interface TemperatureTarget {
  value: number;                 // Target temperature (default: 23)
  tolerance: number;             // Tolerance range (default: 2)
}

export interface TemperaturePanelConfigTemplate {
  // Debug
  enableDebugMode?: boolean;

  // Target configuration
  targetTemp?: number;           // Default: 23
  targetTolerance?: number;      // Default: 2

  // Ideal range for 7-day chart
  minTemperature?: number;       // Default: 20
  maxTemperature?: number;       // Default: 24

  // KPI Cards
  showAvgTempCard?: boolean;     // Default: true
  showTotalSensorsCard?: boolean; // Default: true
  showShoppingsOnlineCard?: boolean; // Default: true
  showAlertsCard?: boolean;      // Default: true

  // Charts
  showTimeSeriesChart?: boolean; // Default: true
  showComparisonChart?: boolean; // Default: true
  defaultPeriod?: number;        // Default: 7 days
  defaultChartType?: 'line' | 'bar';
  defaultVizMode?: 'total' | 'separate';

  // Shopping List
  showShoppingList?: boolean;    // Default: true
  enableShoppingClick?: boolean; // Default: true (opens detail modal)

  // Theme settings
  darkMode?: TemperaturePanelThemeConfig;
  lightMode?: TemperaturePanelThemeConfig;
}

export interface TemperatureKPIs {
  globalAvgTemp: number | null;
  totalSensors: number;
  shoppingsOnline: number;
  alertCount: number;
}

export interface ShoppingSeries {
  label: string;
  customerId: string;
  avgTemp: number | null;
  minTemp: number | null;
  maxTemp: number | null;
  sensorCount: number;
  lastUpdate: number;
  data: Array<{ t: string; v: number }>;
}

export interface TemperatureSensor {
  id: string;
  name: string;
  label: string;
  temperature: number | null;
  lastUpdate: number | null;
  customerId: string;
  customerName: string;
  temperatureMin?: number;
  temperatureMax?: number;
}

export interface TemperaturePanelParams {
  // Container
  container: HTMLElement | string;

  // ThingsBoard context (optional)
  ctx?: ThingsboardWidgetContext;

  // Configuration template
  configTemplate?: TemperaturePanelConfigTemplate;

  // Theme
  themeMode?: TemperatureThemeMode;

  // Initial data
  initialKPIs?: TemperatureKPIs;
  initialShoppingSeries?: ShoppingSeries[];

  // Data fetching
  fetchTimeSeriesData?: (period: number) => Promise<TimeSeriesData>;
  fetchShoppingData?: () => Promise<ShoppingSeries[]>;
  fetchSensorData?: () => Promise<TemperatureSensor[]>;

  // Orchestrator integration
  getTemperatureCache?: () => OrchestratorTemperatureCache | null;

  // Shopping colors (for consistent colors across charts)
  getShoppingColors?: () => Record<string, string> | null;

  // Callbacks
  onShoppingClick?: (shopping: ShoppingSeries) => void;
  onDataLoaded?: (data: { kpis: TemperatureKPIs; shoppings: ShoppingSeries[] }) => void;
  onError?: (error: Error) => void;
}

export interface TemperaturePanelInstance {
  // Update methods
  updateKPIs: (kpis: TemperatureKPIs) => void;
  updateShoppingSeries: (series: ShoppingSeries[]) => void;
  refreshAll: (forceRefresh?: boolean) => Promise<void>;

  // Theme
  setThemeMode: (mode: TemperatureThemeMode) => void;
  getThemeMode: () => TemperatureThemeMode;

  // Target configuration
  setTarget: (target: number, tolerance: number) => void;
  getTarget: () => TemperatureTarget;

  // Chart control
  setChartPeriod: (period: number) => void;
  setChartType: (type: 'line' | 'bar') => void;
  setVizMode: (mode: 'total' | 'separate') => void;

  // Loading state
  showLoading: (show: boolean) => void;

  // Lifecycle
  destroy: () => void;

  // DOM reference
  element: HTMLElement;

  // Access to internal chart instances
  getTimeSeriesChartInstance: () => any;
  getComparisonChartInstance: () => any;
}

export function createTemperaturePanel(params: TemperaturePanelParams): TemperaturePanelInstance;
```

#### Usage Example

```javascript
// In MAIN_UNIQUE_DATASOURCE controller.js onInit():
import { createTemperaturePanel } from 'myio-js-library';

self.onInit = async function() {
  const tempContainer = document.getElementById('temperature-panel-mount');

  const tempPanel = createTemperaturePanel({
    container: tempContainer,
    ctx: self.ctx,
    themeMode: 'light',

    configTemplate: {
      targetTemp: 23,
      targetTolerance: 2,
      minTemperature: 20,
      maxTemperature: 24,
      defaultPeriod: 7,
      defaultChartType: 'line',
      enableShoppingClick: true,
    },

    fetchTimeSeriesData: async (period) => {
      const orchestrator = window.MyIOOrchestrator;
      if (orchestrator?.fetchTemperatureDayAverages) {
        const endTs = Date.now();
        const startTs = endTs - period * 24 * 60 * 60 * 1000;
        return await orchestrator.fetchTemperatureDayAverages(startTs, endTs);
      }
      return null;
    },

    getTemperatureCache: () => {
      const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
      return orchestrator?.getTemperatureCache?.() || null;
    },

    getShoppingColors: () => {
      const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
      return orchestrator?.getShoppingColors?.() || null;
    },

    onShoppingClick: (shopping) => {
      console.log('Shopping clicked:', shopping.label);
      // Open detailed temperature modal
      MyIOLibrary.openTemperatureComparisonModal({
        token: localStorage.getItem('jwt_token'),
        devices: getShoppingSensors(shopping.customerId),
        startDate: getDateRange().start,
        endDate: getDateRange().end,
      });
    },

    onError: (error) => {
      console.error('Temperature panel error:', error);
    }
  });

  // Listen for data updates from orchestrator
  window.addEventListener('myio:temperature-data-ready', (e) => {
    const data = e.detail;
    if (data?.allShoppingsData) {
      const shoppingSeries = data.allShoppingsData.map(shop => ({
        label: shop.name,
        customerId: shop.customerId,
        avgTemp: shop.avg,
        sensorCount: shop.deviceCount || 0,
        data: [],
      }));

      tempPanel.updateShoppingSeries(shoppingSeries);
      tempPanel.updateKPIs({
        globalAvgTemp: data.globalAvg || data.filteredAvg,
        totalSensors: data.devices?.length || 0,
        shoppingsOnline: shoppingSeries.length,
        alertCount: data.shoppingsOutOfRange?.length || 0,
      });
    }
  });

  window.addEventListener('myio:filter-applied', async () => {
    await tempPanel.refreshAll(true);
  });
};
```

### Default Theme Configuration

```typescript
export const DEFAULT_LIGHT_THEME: TemperaturePanelThemeConfig = {
  panelBackgroundColor: 'transparent',
  cardBackgroundColor: '#ffffff',
  alertCardBackgroundColor: 'linear-gradient(135deg, #fff3e0, #ffe0b2)',
  chartBackgroundColor: '#ffffff',
  listCardBackgroundColor: '#ffffff',
  titleColor: '#1c2743',
  subtitleColor: '#6b7a90',
  labelColor: '#6b7a90',
  valueColor: '#e65100',
  primaryColor: '#e65100',
  primaryLightColor: '#ff9800',
  accentColor: '#ff5722',
  normalColor: '#15a34a',
  hotColor: '#c62828',
  coldColor: '#1565c0',
  noInfoColor: '#bdbdbd',
  progressBackgroundColor: '#eff5fa',
  progressBarColor: 'linear-gradient(90deg, #e65100, #ff9800)',
};

export const DEFAULT_DARK_THEME: TemperaturePanelThemeConfig = {
  panelBackgroundColor: '#1a1a2e',
  cardBackgroundColor: '#252536',
  alertCardBackgroundColor: 'linear-gradient(135deg, #3d2507, #5c3a0a)',
  chartBackgroundColor: '#252536',
  listCardBackgroundColor: '#252536',
  titleColor: '#f5f7fa',
  subtitleColor: '#9ca3af',
  labelColor: '#9ca3af',
  valueColor: '#ff9800',
  primaryColor: '#ff9800',
  primaryLightColor: '#ffb74d',
  accentColor: '#ff7043',
  normalColor: '#22c55e',
  hotColor: '#ef4444',
  coldColor: '#3b82f6',
  noInfoColor: '#6b7280',
  progressBackgroundColor: '#374151',
  progressBarColor: 'linear-gradient(90deg, #ff9800, #ffb74d)',
};
```

### Event Integration

```typescript
// Events the TemperaturePanel listens to (optional auto-subscribe):
'myio:temperature-data-ready'   -> Updates KPIs and shopping list
'myio:filter-applied'           -> Refreshes with new filter
'myio:update-date'              -> Refreshes with new date range

// Events the TemperaturePanel can dispatch:
'myio:temperature-panel-ready'  -> Component initialized
'myio:request-temperature-data' -> Requests data from orchestrator
```

### Export in index.ts

```typescript
// Add to src/index.ts

// RFC-0119: Temperature Panel Component
export {
  createTemperaturePanel,
} from './components/temperature-panel';

export type {
  TemperaturePanelParams,
  TemperaturePanelInstance,
  TemperaturePanelConfigTemplate,
  TemperaturePanelThemeConfig,
  TemperatureThemeMode,
  TemperatureKPIs,
  TemperatureStatus,
  ShoppingSeries,
  TemperatureSensor,
  TemperatureTarget,
} from './components/temperature-panel';
```

---

## Showcase

### File: `showcase/temperature-panel.html`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MYIO - Temperature Panel Showcase</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #f5f8fb;
      padding: 20px;
      min-height: 100vh;
    }
    .showcase-header {
      margin-bottom: 20px;
      padding: 16px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(230, 81, 0, 0.1);
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
    .control-group select, .control-group input, .control-group button {
      padding: 8px 12px;
      border: 1px solid #e6eef5;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    }
    .control-group input[type="number"] {
      width: 60px;
    }
    .control-group button {
      background: #e65100;
      color: white;
      border-color: #e65100;
    }
    .control-group button:hover {
      background: #bf360c;
    }
    #temperature-panel-container {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(230, 81, 0, 0.1);
      min-height: 800px;
    }
    .dark-mode #temperature-panel-container {
      background: #1a1a2e;
    }
    .dark-mode body {
      background: #0f0f1a;
    }
  </style>
</head>
<body>
  <div class="showcase-header">
    <h1>Temperature Panel Component - RFC-0119</h1>
    <div class="showcase-controls">
      <div class="control-group">
        <label>Theme:</label>
        <select id="themeSelect">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div class="control-group">
        <label>Target:</label>
        <input type="number" id="targetTemp" value="23" min="15" max="30">
        <label>+/-</label>
        <input type="number" id="targetTolerance" value="2" min="1" max="5">
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
        <button id="simulateDataBtn">Simulate Update</button>
      </div>
    </div>
  </div>

  <div id="temperature-panel-container"></div>

  <script src="../dist/myio-js-library.umd.js"></script>
  <script>
    // Mock data generators
    function generateMockTimeSeriesData(period) {
      const labels = [];
      const dailyTotals = [];
      const now = new Date();

      for (let i = period - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

        // Generate realistic temperature (20-26°C range)
        const base = 22 + Math.sin(i * 0.5) * 2;
        const variation = (Math.random() - 0.5) * 2;
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

    function generateMockShoppingSeries() {
      const shoppings = [
        { label: 'Shopping Mestre Alvaro', customerId: 'id-1' },
        { label: 'Shopping Mont Serrat', customerId: 'id-2' },
        { label: 'Shopping Vitoria Mall', customerId: 'id-3' },
        { label: 'Shopping Norte', customerId: 'id-4' },
      ];

      const hours = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];

      return shoppings.map(shop => {
        const baseTemp = 20 + Math.random() * 6;
        const data = hours.map(t => ({
          t,
          v: baseTemp + (Math.random() - 0.5) * 3
        }));

        return {
          ...shop,
          avgTemp: baseTemp,
          minTemp: baseTemp - 2,
          maxTemp: baseTemp + 2,
          sensorCount: Math.floor(5 + Math.random() * 15),
          lastUpdate: Date.now(),
          data
        };
      });
    }

    // Initialize panel
    let tempPanel = null;

    function initPanel(themeMode) {
      const container = document.getElementById('temperature-panel-container');
      container.innerHTML = '';

      if (tempPanel) {
        tempPanel.destroy();
      }

      const targetTemp = parseInt(document.getElementById('targetTemp').value);
      const targetTolerance = parseInt(document.getElementById('targetTolerance').value);

      const mockShoppings = generateMockShoppingSeries();

      tempPanel = MyIOLibrary.createTemperaturePanel({
        container: container,
        themeMode: themeMode,

        configTemplate: {
          enableDebugMode: true,
          targetTemp: targetTemp,
          targetTolerance: targetTolerance,
          minTemperature: targetTemp - targetTolerance,
          maxTemperature: targetTemp + targetTolerance,
          defaultPeriod: parseInt(document.getElementById('periodSelect').value),
          defaultChartType: 'line',
          enableShoppingClick: true,
        },

        initialKPIs: {
          globalAvgTemp: 22.8,
          totalSensors: 45,
          shoppingsOnline: 4,
          alertCount: 1
        },

        initialShoppingSeries: mockShoppings,

        fetchTimeSeriesData: async (period) => {
          await new Promise(r => setTimeout(r, 500));
          return generateMockTimeSeriesData(period);
        },

        fetchShoppingData: async () => {
          await new Promise(r => setTimeout(r, 300));
          return generateMockShoppingSeries();
        },

        onShoppingClick: (shopping) => {
          console.log('Shopping clicked:', shopping.label);
          alert(`Clicked: ${shopping.label}\nTemp: ${shopping.avgTemp?.toFixed(1)}°C\nSensors: ${shopping.sensorCount}`);
        },

        onError: (error) => {
          console.error('Temperature panel error:', error);
        }
      });

      console.log('Temperature panel initialized:', tempPanel);
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', () => {
      initPanel('light');

      // Theme toggle
      document.getElementById('themeSelect').addEventListener('change', (e) => {
        const theme = e.target.value;
        document.body.classList.toggle('dark-mode', theme === 'dark');
        if (tempPanel) {
          tempPanel.setThemeMode(theme);
        }
      });

      // Target change
      document.getElementById('targetTemp').addEventListener('change', () => {
        const target = parseInt(document.getElementById('targetTemp').value);
        const tolerance = parseInt(document.getElementById('targetTolerance').value);
        if (tempPanel) {
          tempPanel.setTarget(target, tolerance);
        }
      });

      document.getElementById('targetTolerance').addEventListener('change', () => {
        const target = parseInt(document.getElementById('targetTemp').value);
        const tolerance = parseInt(document.getElementById('targetTolerance').value);
        if (tempPanel) {
          tempPanel.setTarget(target, tolerance);
        }
      });

      // Period change
      document.getElementById('periodSelect').addEventListener('change', (e) => {
        const period = parseInt(e.target.value);
        if (tempPanel) {
          tempPanel.setChartPeriod(period);
        }
      });

      // Refresh button
      document.getElementById('refreshBtn').addEventListener('click', async () => {
        if (tempPanel) {
          await tempPanel.refreshAll(true);
        }
      });

      // Simulate data update
      document.getElementById('simulateDataBtn').addEventListener('click', () => {
        if (tempPanel) {
          const mockShoppings = generateMockShoppingSeries();
          const globalAvg = mockShoppings.reduce((sum, s) => sum + (s.avgTemp || 0), 0) / mockShoppings.length;
          const target = parseInt(document.getElementById('targetTemp').value);
          const tolerance = parseInt(document.getElementById('targetTolerance').value);
          const alertCount = mockShoppings.filter(s =>
            s.avgTemp && (s.avgTemp < target - tolerance || s.avgTemp > target + tolerance)
          ).length;

          tempPanel.updateShoppingSeries(mockShoppings);
          tempPanel.updateKPIs({
            globalAvgTemp: globalAvg,
            totalSensors: mockShoppings.reduce((sum, s) => sum + s.sensorCount, 0),
            shoppingsOnline: mockShoppings.length,
            alertCount: alertCount
          });
          console.log('Simulated data update');
        }
      });
    });
  </script>
</body>
</html>
```

---

## Drawbacks

1. **Larger Component**: Temperature panel has more features (comparison chart, shopping list, status logic)
2. **Chart.js Dependency**: Requires Chart.js for both time-series and comparison charts
3. **Complex Status Logic**: Temperature status (normal/hot/cold) requires target configuration
4. **Shopping Modal Integration**: Depends on `openTemperatureComparisonModal` for detail view

---

## Rationale and Alternatives

### Why Library Component?

| Aspect | Widget (Current) | Component (Proposed) |
|--------|-----------------|---------------------|
| Instantiation | ThingsBoard lifecycle | `createTemperaturePanel()` |
| Data Updates | `onDataUpdated()` | Event-driven + API methods |
| Styling | External CSS file | Injected + theme support |
| Testing | Requires ThingsBoard | Unit testable + showcase |
| Reusability | Single dashboard | Multiple contexts |

### Differences from Energy/Water Panels

| Feature | Energy | Water | Temperature |
|---------|--------|-------|-------------|
| KPI Cards | 2 | 3 | 4 |
| Status Logic | None | None | normal/hot/cold |
| Target Config | None | None | Yes (with tolerance) |
| Comparison Chart | Distribution | Distribution | Multi-series line |
| Shopping List | None | None | Yes (with click) |

### Alternatives Considered

1. **Reuse Energy/Water Pattern**: Rejected - temperature has unique status logic and comparison chart
2. **Merge All Resource Panels**: Rejected - too complex, domains are different
3. **Separate Comparison Component**: Considered - could extract, but cohesion is important

---

## Prior Art

### Library Component Patterns

- `createConsumptionChartWidget()` - RFC-0098
- `createEnergyPanel()` - RFC-0117
- `createWaterPanel()` - RFC-0118
- `openTemperatureComparisonModal()` - Existing library function

### Existing TEMPERATURE Widget

- `src/MYIO-SIM/v5.2.0/TEMPERATURE/controller.js` (~940 lines)
- Fully functional, production-tested
- Reference implementation for component

---

## Unresolved Questions

1. **Real-time Updates**: Should comparison chart update in real-time?
2. **Alert Notifications**: Add visual/audio alerts for out-of-range temperatures?
3. **Historical Analysis**: Add ability to compare current vs historical averages?
4. **Sensor Drill-down**: Allow clicking on individual sensors in the list?

---

## Future Possibilities

1. **Heat Map Visualization**: Show temperature as a heat map overlay on shopping floor plan
2. **Trend Prediction**: ML-based temperature trend prediction
3. **HVAC Integration**: Link to HVAC controls for automatic adjustment
4. **Alert Rules**: Configurable alert thresholds per shopping
5. **Comparative Analysis**: Week-over-week or month-over-month comparison

---

## Implementation Plan

### Phase 1: Type Definitions
- [ ] Create `types.ts` with all interfaces
- [ ] Define `TemperaturePanelParams`, `TemperatureKPIs`, `ShoppingSeries`
- [ ] Define theme configuration types
- [ ] Define status types and labels

### Phase 2: View Layer
- [ ] Create `TemperaturePanelView.ts`
- [ ] Port HTML structure from `template.html`
- [ ] Port CSS from `styles.css` with theme support
- [ ] Implement `KPICards.ts` for KPI cards (4 cards)
- [ ] Implement loading overlay

### Phase 3: Charts
- [ ] Create `ComparisonChart.ts` for multi-series shopping comparison
- [ ] Wire up `createConsumptionChartWidget` for 7-day chart
- [ ] Implement ideal range visualization

### Phase 4: Shopping List
- [ ] Create `ShoppingList.ts` component
- [ ] Implement status-based styling (normal/hot/cold/no_info)
- [ ] Add click handler for detail modal

### Phase 5: Controller
- [ ] Create `TemperaturePanelController.ts`
- [ ] Port business logic from controller.js
- [ ] Implement `TemperatureAggregator.ts` for data aggregation
- [ ] Handle target/tolerance configuration

### Phase 6: Entry Function
- [ ] Create `createTemperaturePanel.ts`
- [ ] Implement instance methods
- [ ] Add event listeners
- [ ] Handle theme switching

### Phase 7: Showcase
- [ ] Create `showcase/temperature-panel.html`
- [ ] Add mock data generators
- [ ] Add interactive controls

### Phase 8: Export & Integration
- [ ] Add exports to `src/index.ts`
- [ ] Create usage documentation
- [ ] Test with `MAIN_UNIQUE_DATASOURCE`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/temperature-panel/index.ts` | Public exports |
| `src/components/temperature-panel/createTemperaturePanel.ts` | Main entry |
| `src/components/temperature-panel/TemperaturePanelView.ts` | View rendering |
| `src/components/temperature-panel/TemperaturePanelController.ts` | Business logic |
| `src/components/temperature-panel/KPICards.ts` | KPI card components |
| `src/components/temperature-panel/ComparisonChart.ts` | Shopping comparison chart |
| `src/components/temperature-panel/ShoppingList.ts` | Shopping list with status |
| `src/components/temperature-panel/TemperatureAggregator.ts` | Data aggregation |
| `src/components/temperature-panel/styles.ts` | Injected CSS with themes |
| `src/components/temperature-panel/types.ts` | TypeScript interfaces |
| `showcase/temperature-panel.html` | Standalone showcase |

## Files to Modify

| File | Change |
|------|--------|
| `src/index.ts` | Add exports for TemperaturePanel |

---

## References

- [RFC-0092 Temperature Dashboard](./RFC-0092-Temperature-Dashboard.md)
- [RFC-0098 Consumption7DaysChart](./RFC-0098-Consumption7DaysChart.md)
- [RFC-0100 Temperature Orchestration](./RFC-0100-Temperature-Orchestration.md)
- [RFC-0117 EnergyPanelComponent](./RFC-0117-EnergyPanelComponent.md)
- [RFC-0118 WaterPanelComponent](./RFC-0118-WaterPanelComponent.md)
- [TEMPERATURE Widget Source](../../MYIO-SIM/v5.2.0/TEMPERATURE/)

---

**Document History:**
- 2026-01-02: Initial RFC created from TEMPERATURE widget reverse engineering
