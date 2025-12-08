# RFC-0098: View Consumption Over 7 Days Component

- **Feature Name:** `consumption_7_days_chart`
- **Start Date:** 2025-12-07
- **RFC PR:** N/A
- **Status:** Draft

## Summary

Extract the "Consumo dos últimos 7 dias" (Consumption over last 7 days) chart component from the ENERGY widget into a reusable, domain-agnostic component that can be exported via `myio-js-library` and used across multiple domains (energy, water, etc.).

## Motivation

Currently, both `ENERGY` and `WATER` widgets in `src/MYIO-SIM/v5.2.0/` implement their own 7-day consumption charts with duplicated logic. This leads to:

1. **Code duplication** - Same chart initialization, configuration, and rendering logic exists in both widgets
2. **Inconsistent behavior** - Bug fixes in one widget may not propagate to the other
3. **Maintenance burden** - Changes require updates in multiple places
4. **Harder testing** - Each implementation must be tested separately

By extracting this into a reusable component exported from `src/index.ts`, we enable:

- Single source of truth for chart behavior
- Consistent UX across domains
- Easier maintenance and bug fixes
- Better testability
- Flexible theming per domain

## Guide-level Explanation

### Usage Example

```typescript
import {
  createConsumption7DaysChart,
  type Consumption7DaysConfig
} from 'myio-js-library';

// Energy domain configuration
const energyConfig: Consumption7DaysConfig = {
  domain: 'energy',
  containerId: 'lineChart',
  unit: 'kWh',
  unitLarge: 'MWh',
  thresholdForLargeUnit: 1000,
  colors: {
    primary: '#2563eb',
    background: 'rgba(37, 99, 235, 0.1)',
    gradient: ['#f0fdf4', '#dcfce7']
  },
  fetchData: async (period: number) => {
    // Domain-specific data fetching
    return await fetchEnergyConsumption(period);
  }
};

const chart = createConsumption7DaysChart(energyConfig);
await chart.render();

// Water domain configuration
const waterConfig: Consumption7DaysConfig = {
  domain: 'water',
  containerId: 'lineChart',
  unit: 'm³',
  unitLarge: null, // Water doesn't need large unit conversion
  thresholdForLargeUnit: null,
  colors: {
    primary: '#0288d1',
    background: 'rgba(2, 136, 209, 0.1)',
    gradient: ['#f0f9ff', '#bae6fd']
  },
  fetchData: async (period: number) => {
    return await fetchWaterConsumption(period);
  }
};

const waterChart = createConsumption7DaysChart(waterConfig);
await waterChart.render();
```

### Features

1. **Domain-agnostic** - Works with any consumption domain (energy, water, gas, etc.)
2. **Configurable units** - Supports custom units and automatic large-unit conversion
3. **Theming** - Colors and gradients configurable per domain
4. **Chart types** - Supports line and bar chart modes
5. **Visualization modes** - Consolidated view vs per-shopping breakdown
6. **Period configuration** - Configurable period (7 days, 30 days, custom)
7. **Caching** - Built-in cache with configurable TTL
8. **Fixed axis** - Prevents infinite growth animation bug

## Reference-level Explanation

### Component Structure

```
src/
├── components/
│   └── Consumption7DaysChart/
│       ├── index.ts                 # Public API exports
│       ├── types.ts                 # TypeScript interfaces
│       ├── createConsumption7DaysChart.ts  # Main factory function
│       ├── chartConfig.ts           # Chart.js configuration builder
│       ├── dataTransformers.ts      # Data normalization utilities
│       └── styles.ts                # CSS-in-JS styles
```

### Type Definitions

```typescript
// src/components/Consumption7DaysChart/types.ts

export type ChartDomain = 'energy' | 'water' | 'gas' | string;

export type ChartType = 'line' | 'bar';

export type VizMode = 'total' | 'separate';

export interface Consumption7DaysColors {
  primary: string;
  background: string;
  gradient?: [string, string];
  borderColor?: string;
}

export interface ConsumptionDataPoint {
  date: string;       // ISO date or formatted label
  value: number;      // Consumption value
  label?: string;     // Optional custom label
}

export interface ShoppingDataPoint extends ConsumptionDataPoint {
  shoppingId: string;
  shoppingName: string;
}

export interface Consumption7DaysData {
  labels: string[];
  dailyTotals: number[];
  shoppingData?: Record<string, number[]>;
  shoppingNames?: Record<string, string>;
  fetchTimestamp?: number;
}

export interface Consumption7DaysConfig {
  // Required
  domain: ChartDomain;
  containerId: string;
  unit: string;
  fetchData: (period: number) => Promise<Consumption7DaysData>;

  // Optional - Units
  unitLarge?: string | null;
  thresholdForLargeUnit?: number | null;

  // Optional - Appearance
  colors?: Consumption7DaysColors;
  title?: string;
  showLegend?: boolean;

  // Optional - Behavior
  defaultPeriod?: number;           // Default: 7
  defaultChartType?: ChartType;     // Default: 'line'
  defaultVizMode?: VizMode;         // Default: 'total'
  cacheTTL?: number;                // Default: 300000 (5 min)

  // Optional - Callbacks
  onDataLoaded?: (data: Consumption7DaysData) => void;
  onError?: (error: Error) => void;

  // Optional - ThingsBoard context
  $container?: JQuery<HTMLElement>;  // Widget container for $id() helper
}

export interface Consumption7DaysInstance {
  render: () => Promise<void>;
  update: (data?: Consumption7DaysData) => Promise<void>;
  setChartType: (type: ChartType) => void;
  setVizMode: (mode: VizMode) => void;
  setPeriod: (days: number) => Promise<void>;
  refresh: (forceRefresh?: boolean) => Promise<void>;
  destroy: () => void;
  getChartInstance: () => Chart | null;
  getCachedData: () => Consumption7DaysData | null;
}
```

### Factory Function

```typescript
// src/components/Consumption7DaysChart/createConsumption7DaysChart.ts

import Chart from 'chart.js/auto';
import type {
  Consumption7DaysConfig,
  Consumption7DaysInstance,
  Consumption7DaysData
} from './types';

export function createConsumption7DaysChart(
  config: Consumption7DaysConfig
): Consumption7DaysInstance {

  // Internal state
  let chartInstance: Chart | null = null;
  let cachedData: Consumption7DaysData | null = null;
  let currentPeriod = config.defaultPeriod ?? 7;
  let currentChartType = config.defaultChartType ?? 'line';
  let currentVizMode = config.defaultVizMode ?? 'total';

  // Helper to get element within container (ThingsBoard compatibility)
  const $id = (id: string): HTMLElement | null => {
    if (config.$container) {
      return config.$container[0].querySelector(`#${id}`);
    }
    return document.getElementById(id);
  };

  // Calculate fixed Y-axis max to prevent infinite growth
  const calculateYAxisMax = (values: number[]): number => {
    const maxValue = Math.max(...values, 0);
    const roundTo = config.thresholdForLargeUnit
      ? config.thresholdForLargeUnit / 10
      : 50;
    return maxValue > 0
      ? Math.ceil((maxValue * 1.1) / roundTo) * roundTo
      : roundTo * 5;
  };

  // Format value with unit
  const formatValue = (value: number): string => {
    if (config.unitLarge && config.thresholdForLargeUnit && value >= config.thresholdForLargeUnit) {
      return `${(value / config.thresholdForLargeUnit).toFixed(2)} ${config.unitLarge}`;
    }
    return `${value.toFixed(1)} ${config.unit}`;
  };

  // Build Chart.js configuration
  const buildChartConfig = (data: Consumption7DaysData) => {
    const yAxisMax = calculateYAxisMax(data.dailyTotals);

    return {
      type: currentChartType,
      data: {
        labels: data.labels,
        datasets: [{
          label: `Consumo (${config.unit})`,
          data: data.dailyTotals,
          borderColor: config.colors?.primary ?? '#2563eb',
          backgroundColor: config.colors?.background ?? 'rgba(37, 99, 235, 0.1)',
          fill: currentChartType === 'line',
          tension: 0.4,
          borderWidth: 2,
          pointRadius: currentChartType === 'line' ? 4 : 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // Prevent infinite growth bug
        plugins: {
          legend: { display: config.showLegend ?? false },
          tooltip: {
            callbacks: {
              label: (context) => formatValue(context.parsed.y)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: yAxisMax, // Fixed max prevents animation loop
            title: {
              display: true,
              text: config.unit
            },
            ticks: {
              callback: (value) => formatValue(Number(value))
            }
          }
        }
      }
    };
  };

  // Public API
  return {
    async render() {
      const canvas = $id(config.containerId) as HTMLCanvasElement;
      if (!canvas) {
        throw new Error(`[${config.domain.toUpperCase()}] Canvas #${config.containerId} not found`);
      }

      if (typeof Chart === 'undefined') {
        throw new Error(`[${config.domain.toUpperCase()}] Chart.js not loaded`);
      }

      // Fetch data
      cachedData = await config.fetchData(currentPeriod);
      cachedData.fetchTimestamp = Date.now();

      // Destroy existing chart
      if (chartInstance) {
        chartInstance.destroy();
      }

      // Create new chart
      const ctx = canvas.getContext('2d');
      chartInstance = new Chart(ctx, buildChartConfig(cachedData));

      config.onDataLoaded?.(cachedData);
      console.log(`[${config.domain.toUpperCase()}] Chart initialized with yAxisMax:`,
        calculateYAxisMax(cachedData.dailyTotals));
    },

    async update(data) {
      if (data) {
        cachedData = data;
        cachedData.fetchTimestamp = Date.now();
      }

      if (chartInstance && cachedData) {
        chartInstance.data = buildChartConfig(cachedData).data;
        chartInstance.options = buildChartConfig(cachedData).options;
        chartInstance.update('none'); // No animation
      }
    },

    setChartType(type) {
      currentChartType = type;
      if (cachedData) this.update();
    },

    setVizMode(mode) {
      currentVizMode = mode;
      if (cachedData) this.update();
    },

    async setPeriod(days) {
      currentPeriod = days;
      await this.refresh(true);
    },

    async refresh(forceRefresh = false) {
      if (!forceRefresh && cachedData?.fetchTimestamp) {
        const age = Date.now() - cachedData.fetchTimestamp;
        if (age < (config.cacheTTL ?? 300000)) {
          return; // Cache still valid
        }
      }
      await this.render();
    },

    destroy() {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      cachedData = null;
    },

    getChartInstance: () => chartInstance,
    getCachedData: () => cachedData
  };
}
```

### Export from index.ts

```typescript
// Add to src/index.ts

// RFC-0098: Consumption 7 Days Chart Component
export {
  createConsumption7DaysChart
} from './components/Consumption7DaysChart';

export type {
  Consumption7DaysConfig,
  Consumption7DaysInstance,
  Consumption7DaysData,
  Consumption7DaysColors,
  ConsumptionDataPoint,
  ShoppingDataPoint,
  ChartDomain,
  ChartType,
  VizMode
} from './components/Consumption7DaysChart/types';
```

## Drawbacks

1. **Breaking change** - Existing widgets would need refactoring to use the new component
2. **Bundle size** - Adds to the library bundle, even if not all consumers use charts
3. **Chart.js dependency** - Assumes Chart.js is available globally or bundled

## Rationale and Alternatives

### Why this design?

1. **Factory pattern** - Allows multiple instances with different configurations
2. **Domain-agnostic** - Color scheme and units are configurable, not hardcoded
3. **ThingsBoard compatible** - The `$container` option enables proper DOM querying within widgets
4. **Animation fix built-in** - The `animation: false` and `max: yAxisMax` fixes are baked in

### Alternatives considered

1. **React/Vue component** - Rejected because ThingsBoard widgets use vanilla JS
2. **Extend Chart.js plugin** - More complex and less flexible for domain-specific needs
3. **CSS-only solution** - Doesn't address the data fetching and caching needs

## Prior Art

- **Chart.js** - The underlying charting library
- **RFC-0097** - Energy chart period configuration (builds on this)
- **MYIO-SIM-ENERGY-INFINITE-LOOP-FIX.md** - Documents the animation bug fix

## Unresolved Questions

1. Should the component handle the "Per Shopping" visualization mode, or should that be a separate component?
2. Should we bundle Chart.js or require it as a peer dependency?
3. How to handle the fullscreen/maximize feature?

## Future Possibilities

1. **Distribution chart component** - Similar extraction for the bar chart (Distribuição de Energia/Água)
2. **PDF export** - Built-in export to PDF functionality
3. **Comparison mode** - Compare current period with previous period
4. **Granularity selector** - Hour/Day/Week/Month aggregation options
5. **Real-time updates** - WebSocket subscription for live data

## Implementation Plan

### Phase 1: Extract Component
1. Create `src/components/Consumption7DaysChart/` directory structure
2. Implement types and interfaces
3. Implement factory function with basic functionality
4. Add exports to `src/index.ts`

### Phase 2: Migrate ENERGY Widget
1. Refactor `ENERGY/controller.js` to use the new component
2. Verify all existing functionality works
3. Test fullscreen mode compatibility

### Phase 3: Migrate WATER Widget
1. Refactor `WATER/controller.js` to use the new component
2. Update WATER-specific configurations (colors, units)
3. Test integration with WATER data sources

### Phase 4: Documentation & Testing
1. Add unit tests for the component
2. Update widget documentation
3. Create migration guide for existing implementations

## Appendix A: CSS Requirements

The consuming widget must include these CSS rules to prevent infinite growth:

```css
.chart-box canvas {
  flex: 1;
  min-height: 250px !important;
  max-height: 300px !important; /* CRITICAL: Prevents infinite growth */
  width: 100% !important;
  height: 300px !important;
}
```

## Appendix B: Known Issues Fixed

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| Y-axis grows infinitely | Chart.js animation + auto-scaling | `animation: false` + `max: yAxisMax` |
| Canvas not found | Global `document.getElementById` in widget context | `$container.querySelector()` helper |
| Duplicate rendering | Multiple event handlers triggering updates | Debounce flag pattern |
