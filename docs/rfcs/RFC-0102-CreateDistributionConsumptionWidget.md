# RFC-0102: Distribution Consumption Widget Component

- **Feature Name:** `distribution_consumption_widget`
- **Start Date:** 2025-12-08
- **RFC PR:** N/A
- **Status:** Draft

## Summary

Create a new reusable component `createDistributionChartWidget` to replace the hardcoded "Distribuição de Energia/Água" horizontal bar chart currently embedded in ENERGY and WATER widget templates. This component will be exported via `myio-js-library` and provide consistent shopping colors across all widgets and domains.

## Motivation

Currently, the distribution chart in `ENERGY/template.html` and `WATER/template.html` is implemented with:
1. **Hardcoded HTML** - Select dropdown and canvas element in template
2. **Controller logic** - Chart initialization, mode switching, and data calculation in controller.js
3. **Inconsistent colors** - Shopping colors are defined locally in each controller with no synchronization

This leads to several problems:

1. **Code duplication** - Same chart logic exists in ENERGY and WATER controllers
2. **Inconsistent shopping colors** - Shopping A might be blue in ENERGY but orange in WATER
3. **Maintenance burden** - Adding new visualization modes requires changes in multiple places
4. **No color coordination** - The 7-day consumption chart and distribution chart use different color assignments for the same shoppings

By extracting this into a reusable component with centralized color management, we enable:

- Single source of truth for distribution chart behavior
- Consistent shopping colors across all widgets and views
- Easier maintenance and feature additions
- Better integration with the orchestrator's shopping data

## Guide-level Explanation

### Usage Example

```typescript
import {
  createDistributionChartWidget,
  type DistributionChartConfig
} from 'myio-js-library';

// Energy domain configuration
const energyDistribution = createDistributionChartWidget({
  domain: 'energy',
  containerId: 'energy-distribution-widget',
  title: 'Distribuição de Energia',
  unit: 'kWh',
  unitLarge: 'MWh',
  thresholdForLargeUnit: 1000,
  theme: 'light',

  // Visualization modes available
  modes: [
    { value: 'groups', label: 'Por Grupos de Equipamentos' },
    { value: 'elevators', label: 'Elevadores por Shopping' },
    { value: 'escalators', label: 'Escadas Rolantes por Shopping' },
    { value: 'hvac', label: 'Climatização por Shopping' },
    { value: 'others', label: 'Outros Equipamentos por Shopping' },
    { value: 'stores', label: 'Lojas por Shopping' },
  ],
  defaultMode: 'groups',

  // Data fetching
  fetchDistribution: async (mode: string) => {
    return await calculateDistributionByMode(mode);
  },

  // Color configuration (optional - uses defaults if not provided)
  groupColors: {
    'Elevadores': '#3b82f6',
    'Escadas Rolantes': '#8b5cf6',
    'Climatização': '#f59e0b',
    'Outros Equipamentos': '#ef4444',
    'Lojas': '#10b981',
  },

  // Shopping colors from orchestrator (ensures consistency)
  getShoppingColors: () => {
    const orchestrator = window.MyIOOrchestrator;
    return orchestrator?.getShoppingColors?.() || null;
  },
});

await energyDistribution.render();
```

### Water Domain Example

```typescript
const waterDistribution = createDistributionChartWidget({
  domain: 'water',
  containerId: 'water-distribution-widget',
  title: 'Distribuição de Consumo de Água',
  unit: 'm³',
  theme: 'light',

  modes: [
    { value: 'groups', label: 'Lojas vs Área Comum' },
    { value: 'stores', label: 'Lojas por Shopping' },
    { value: 'common', label: 'Área Comum por Shopping' },
  ],
  defaultMode: 'groups',

  fetchDistribution: async (mode: string) => {
    return await calculateWaterDistributionByMode(mode);
  },

  // Uses same shopping colors as ENERGY for consistency
  getShoppingColors: () => {
    const orchestrator = window.MyIOOrchestrator;
    return orchestrator?.getShoppingColors?.() || null;
  },
});
```

### Features

1. **Domain-agnostic** - Works with energy, water, or any consumption domain
2. **Configurable modes** - Flexible visualization modes per domain
3. **Consistent shopping colors** - Centralized color assignment via orchestrator
4. **Self-contained HTML** - Injects its own header, select dropdown, and canvas
5. **Theming support** - Light/dark theme support
6. **Horizontal bar chart** - Uses Chart.js horizontal bar chart for better label visibility
7. **Percentage display** - Shows both absolute values and percentages
8. **Maximize support** - Optional fullscreen modal view

## Reference-level Explanation

### Component Structure

```
src/
├── components/
│   └── DistributionChart/
│       ├── index.ts                      # Public API exports
│       ├── types.ts                      # TypeScript interfaces
│       ├── createDistributionChartWidget.ts  # Main factory function
│       ├── chartConfig.ts                # Chart.js configuration builder
│       ├── colorManager.ts               # Centralized color management
│       └── styles.ts                     # CSS-in-JS styles
```

### Type Definitions

```typescript
// src/components/DistributionChart/types.ts

export type DistributionDomain = 'energy' | 'water' | string;

export type ThemeMode = 'light' | 'dark';

export interface DistributionMode {
  value: string;
  label: string;
}

export interface DistributionData {
  [key: string]: number;  // { 'Elevadores': 1500, 'Lojas': 8000, ... }
}

export interface GroupColors {
  [groupName: string]: string;
}

export interface ShoppingColors {
  [shoppingId: string]: string;
}

export interface DistributionChartConfig {
  // Required
  domain: DistributionDomain;
  containerId: string;
  unit: string;
  fetchDistribution: (mode: string) => Promise<DistributionData | null>;

  // Optional - Units
  unitLarge?: string | null;
  thresholdForLargeUnit?: number | null;
  decimalPlaces?: number;

  // Optional - Modes
  modes?: DistributionMode[];
  defaultMode?: string;

  // Optional - Appearance
  title?: string;
  theme?: ThemeMode;
  chartHeight?: number;
  showHeader?: boolean;
  showModeSelector?: boolean;

  // Optional - Colors
  groupColors?: GroupColors;
  getShoppingColors?: () => ShoppingColors | null;

  // Optional - Callbacks
  onModeChange?: (mode: string) => void;
  onDataLoaded?: (data: DistributionData) => void;
  onError?: (error: Error) => void;

  // Optional - ThingsBoard context
  $container?: JQuery<HTMLElement>;
}

export interface DistributionChartInstance {
  render: () => Promise<void>;
  setMode: (mode: string) => Promise<void>;
  refresh: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  destroy: () => void;
  getChartInstance: () => Chart | null;
  getCurrentMode: () => string;
}
```

### Centralized Color Management

A critical feature of this RFC is ensuring consistent shopping colors across all widgets. This is achieved through a centralized color manager in the MAIN orchestrator.

```typescript
// src/components/DistributionChart/colorManager.ts

// Default color palette for shoppings (10 colors, will cycle for more shoppings)
export const DEFAULT_SHOPPING_COLORS = [
  '#3b82f6',  // Blue
  '#8b5cf6',  // Purple
  '#f59e0b',  // Amber
  '#ef4444',  // Red
  '#10b981',  // Emerald
  '#06b6d4',  // Cyan
  '#ec4899',  // Pink
  '#14b8a6',  // Teal
  '#f97316',  // Orange
  '#a855f7',  // Violet
];

// Default colors for equipment groups (energy domain)
export const DEFAULT_ENERGY_GROUP_COLORS: GroupColors = {
  'Elevadores': '#3b82f6',
  'Escadas Rolantes': '#8b5cf6',
  'Climatização': '#f59e0b',
  'Outros Equipamentos': '#ef4444',
  'Lojas': '#10b981',
};

// Default colors for water groups
export const DEFAULT_WATER_GROUP_COLORS: GroupColors = {
  'Lojas': '#10b981',
  'Área Comum': '#0288d1',
};

/**
 * Creates a color assignment map for shoppings
 * Should be called once by the orchestrator during initialization
 */
export function assignShoppingColors(
  shoppingIds: string[]
): ShoppingColors {
  const colors: ShoppingColors = {};

  shoppingIds.forEach((id, index) => {
    colors[id] = DEFAULT_SHOPPING_COLORS[index % DEFAULT_SHOPPING_COLORS.length];
  });

  return colors;
}

/**
 * Gets the color for a specific shopping
 * Falls back to cycling through default colors if not found
 */
export function getShoppingColor(
  shoppingId: string,
  shoppingColors: ShoppingColors | null,
  fallbackIndex: number = 0
): string {
  if (shoppingColors && shoppingColors[shoppingId]) {
    return shoppingColors[shoppingId];
  }
  return DEFAULT_SHOPPING_COLORS[fallbackIndex % DEFAULT_SHOPPING_COLORS.length];
}
```

### MAIN Orchestrator Integration

The MAIN orchestrator should be updated to assign and expose shopping colors:

```javascript
// In MAIN/controller.js - extractTemperatureRanges or similar initialization function

// RFC-0102: Assign consistent colors to each customer/shopping
function assignCustomerColors() {
  const customers = window.custumersSelected || [];
  const shoppingColors = {};

  const colorPalette = [
    '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#a855f7',
  ];

  customers.forEach((customer, index) => {
    const id = customer.ingestionId || customer.value || customer.customerId;
    shoppingColors[id] = colorPalette[index % colorPalette.length];
  });

  // Store in orchestrator for access by other widgets
  window.MyIOOrchestrator.shoppingColors = shoppingColors;

  console.log('[MAIN] [RFC-0102] Shopping colors assigned:', shoppingColors);
  return shoppingColors;
}

// Expose via orchestrator API
window.MyIOOrchestrator = {
  // ... existing methods ...

  // RFC-0102: Get shopping colors
  getShoppingColors: () => {
    return window.MyIOOrchestrator.shoppingColors || null;
  },

  // RFC-0102: Get color for specific shopping
  getShoppingColor: (shoppingId) => {
    const colors = window.MyIOOrchestrator.shoppingColors || {};
    const fallbackIndex = Object.keys(colors).indexOf(shoppingId);
    return colors[shoppingId] || DEFAULT_SHOPPING_COLORS[Math.max(0, fallbackIndex) % 10];
  },
};
```

### Factory Function Implementation

```typescript
// src/components/DistributionChart/createDistributionChartWidget.ts

import Chart from 'chart.js/auto';
import type {
  DistributionChartConfig,
  DistributionChartInstance,
  DistributionData,
  ThemeMode,
} from './types';
import {
  DEFAULT_ENERGY_GROUP_COLORS,
  DEFAULT_WATER_GROUP_COLORS,
  DEFAULT_SHOPPING_COLORS,
} from './colorManager';

export function createDistributionChartWidget(
  config: DistributionChartConfig
): DistributionChartInstance {

  const widgetId = `distribution-${config.domain}-${Date.now()}`;
  let chartInstance: Chart | null = null;
  let currentMode = config.defaultMode || 'groups';
  let currentTheme: ThemeMode = config.theme || 'light';
  let containerElement: HTMLElement | null = null;

  // Default group colors based on domain
  const defaultGroupColors = config.domain === 'water'
    ? DEFAULT_WATER_GROUP_COLORS
    : DEFAULT_ENERGY_GROUP_COLORS;

  const groupColors = config.groupColors || defaultGroupColors;

  // Helper to get element
  const $id = (id: string): HTMLElement | null => {
    if (config.$container) {
      return config.$container[0].querySelector(`#${id}`);
    }
    return document.getElementById(id);
  };

  // Format value with unit
  function formatValue(value: number): string {
    if (config.unitLarge && config.thresholdForLargeUnit && value >= config.thresholdForLargeUnit) {
      return `${(value / config.thresholdForLargeUnit).toFixed(config.decimalPlaces ?? 2)} ${config.unitLarge}`;
    }
    return `${value.toFixed(config.decimalPlaces ?? 2)} ${config.unit}`;
  }

  // Get color for a distribution entry
  function getColor(key: string, index: number, isGroupMode: boolean): string {
    if (isGroupMode) {
      return groupColors[key] || DEFAULT_SHOPPING_COLORS[index % DEFAULT_SHOPPING_COLORS.length];
    }

    // For shopping-based modes, try to get from orchestrator
    const shoppingColors = config.getShoppingColors?.();
    if (shoppingColors && shoppingColors[key]) {
      return shoppingColors[key];
    }

    return DEFAULT_SHOPPING_COLORS[index % DEFAULT_SHOPPING_COLORS.length];
  }

  // Render the widget HTML
  function renderHTML(): string {
    const title = config.title || `Distribuição de ${config.domain === 'water' ? 'Água' : 'Energia'}`;
    const modes = config.modes || [{ value: 'groups', label: 'Por Grupos' }];
    const showHeader = config.showHeader !== false;
    const showModeSelector = config.showModeSelector !== false;
    const chartHeight = config.chartHeight || 300;

    const modeOptions = modes.map(m =>
      `<option value="${m.value}" ${m.value === currentMode ? 'selected' : ''}>${m.label}</option>`
    ).join('');

    return `
      <div id="${widgetId}" class="myio-distribution-widget" style="
        background: ${currentTheme === 'dark' ? '#1f2937' : '#fff'};
        border-radius: 12px;
        padding: 16px;
        height: 100%;
        display: flex;
        flex-direction: column;
      ">
        ${showHeader ? `
          <div class="distribution-header" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 12px;
          ">
            <h4 style="
              margin: 0;
              font-size: 16px;
              font-weight: 600;
              color: ${currentTheme === 'dark' ? '#f3f4f6' : '#1f2937'};
            ">${title}</h4>
            ${showModeSelector && modes.length > 1 ? `
              <div class="distribution-controls" style="display: flex; align-items: center; gap: 8px;">
                <label for="${widgetId}-mode" style="
                  font-size: 12px;
                  color: ${currentTheme === 'dark' ? '#9ca3af' : '#6b7280'};
                ">Visualizar:</label>
                <select id="${widgetId}-mode" style="
                  padding: 6px 10px;
                  border-radius: 6px;
                  border: 1px solid ${currentTheme === 'dark' ? '#374151' : '#e5e7eb'};
                  background: ${currentTheme === 'dark' ? '#374151' : '#fff'};
                  color: ${currentTheme === 'dark' ? '#f3f4f6' : '#1f2937'};
                  font-size: 12px;
                  cursor: pointer;
                ">
                  ${modeOptions}
                </select>
              </div>
            ` : ''}
          </div>
        ` : ''}
        <div class="distribution-chart-container" style="flex: 1; min-height: ${chartHeight}px;">
          <canvas id="${widgetId}-canvas"></canvas>
        </div>
      </div>
    `;
  }

  // Build chart data from distribution
  function buildChartData(distribution: DistributionData) {
    const isGroupMode = currentMode === 'groups';
    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColors: string[] = [];

    const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);

    Object.entries(distribution)
      .filter(([_, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]) // Sort by value descending
      .forEach(([key, value], index) => {
        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
        labels.push(`${key} (${formatValue(value)} - ${percentage}%)`);
        data.push(value);
        backgroundColors.push(getColor(key, index, isGroupMode));
      });

    return { labels, data, backgroundColors, total };
  }

  // Create or update chart
  async function updateChart() {
    const canvas = $id(`${widgetId}-canvas`) as HTMLCanvasElement;
    if (!canvas) {
      console.error(`[${config.domain.toUpperCase()}] Distribution canvas not found`);
      return;
    }

    try {
      const distribution = await config.fetchDistribution(currentMode);

      if (!distribution) {
        console.warn(`[${config.domain.toUpperCase()}] No distribution data for mode: ${currentMode}`);
        return;
      }

      const { labels, data, backgroundColors, total } = buildChartData(distribution);

      // Destroy existing chart
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }

      // Create new chart
      const ctx = canvas.getContext('2d');
      chartInstance = new Chart(ctx!, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Consumo',
            data,
            backgroundColor: backgroundColors,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y', // Horizontal bar chart
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = context.parsed.x || 0;
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                  return `${formatValue(value)} (${percentage}%)`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                callback: (value) => formatValue(Number(value)),
                color: currentTheme === 'dark' ? '#9ca3af' : '#6b7280',
              },
              grid: {
                color: currentTheme === 'dark' ? '#374151' : '#e5e7eb',
              },
            },
            y: {
              ticks: {
                font: { size: 11 },
                color: currentTheme === 'dark' ? '#f3f4f6' : '#1f2937',
              },
              grid: { display: false },
            },
          },
        },
      });

      config.onDataLoaded?.(distribution);
      console.log(`[${config.domain.toUpperCase()}] Distribution chart updated for mode: ${currentMode}`);

    } catch (error) {
      console.error(`[${config.domain.toUpperCase()}] Error updating distribution chart:`, error);
      config.onError?.(error as Error);
    }
  }

  // Setup event listeners
  function setupListeners() {
    const modeSelect = $id(`${widgetId}-mode`) as HTMLSelectElement;
    if (modeSelect) {
      modeSelect.addEventListener('change', async (e) => {
        currentMode = (e.target as HTMLSelectElement).value;
        config.onModeChange?.(currentMode);
        await updateChart();
      });
    }
  }

  // Public API
  const instance: DistributionChartInstance = {
    async render() {
      containerElement = $id(config.containerId);
      if (!containerElement) {
        throw new Error(`Container #${config.containerId} not found`);
      }

      containerElement.innerHTML = renderHTML();
      setupListeners();
      await updateChart();
    },

    async setMode(mode: string) {
      currentMode = mode;
      const modeSelect = $id(`${widgetId}-mode`) as HTMLSelectElement;
      if (modeSelect) {
        modeSelect.value = mode;
      }
      await updateChart();
    },

    async refresh() {
      await updateChart();
    },

    setTheme(theme: ThemeMode) {
      currentTheme = theme;
      if (containerElement) {
        containerElement.innerHTML = renderHTML();
        setupListeners();
        updateChart();
      }
    },

    destroy() {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      if (containerElement) {
        containerElement.innerHTML = '';
      }
    },

    getChartInstance: () => chartInstance,
    getCurrentMode: () => currentMode,
  };

  return instance;
}
```

### Export from index.ts

```typescript
// Add to src/index.ts

// RFC-0102: Distribution Chart Widget Component
export {
  createDistributionChartWidget,
  DEFAULT_SHOPPING_COLORS,
  DEFAULT_ENERGY_GROUP_COLORS,
  DEFAULT_WATER_GROUP_COLORS,
  assignShoppingColors,
  getShoppingColor,
} from './components/DistributionChart';

export type {
  DistributionChartConfig,
  DistributionChartInstance,
  DistributionData,
  DistributionMode,
  GroupColors,
  ShoppingColors,
} from './components/DistributionChart/types';
```

## Drawbacks

1. **Breaking change** - Existing ENERGY and WATER widgets need refactoring
2. **Orchestrator dependency** - Relies on MAIN orchestrator for consistent colors
3. **Bundle size** - Adds to the library bundle size

## Rationale and Alternatives

### Why this design?

1. **Centralized colors** - The orchestrator assigns colors once, ensuring consistency
2. **Factory pattern** - Matches `createConsumptionChartWidget` pattern from RFC-0098
3. **Self-contained** - Widget injects its own HTML, reducing template complexity
4. **Domain flexibility** - Works for energy, water, and future domains

### Alternatives considered

1. **CSS variables for colors** - Less flexible, harder to assign per-shopping
2. **Local color storage** - Would still lead to inconsistencies between widgets
3. **Random color assignment** - Poor UX, colors change on each refresh

## Prior Art

- **RFC-0098** - View Consumption Over 7 Days Component (similar architecture)
- **RFC-0076** - ENERGY Distribution Chart Data Inconsistency (documents current issues)
- **Chart.js** - The underlying charting library

## Unresolved Questions

1. Should the color assignment happen in MAIN orchestrator or in a separate color service?
2. How to handle cases where a shopping is added/removed dynamically?
3. Should colors persist in localStorage for consistency across sessions?

## Future Possibilities

1. **Color customization UI** - Allow users to customize shopping colors
2. **Color themes** - Predefined color palettes (corporate, pastel, high-contrast)
3. **Comparison mode** - Show distribution comparison between periods
4. **Export to PDF** - Built-in export functionality
5. **Drill-down** - Click on a bar to see detailed breakdown

## Implementation Plan

### Phase 1: Color Management Infrastructure
1. Create `colorManager.ts` with default palettes
2. Update MAIN orchestrator to assign and expose shopping colors
3. Add `getShoppingColors()` and `getShoppingColor(id)` to orchestrator API

### Phase 2: Component Development
1. Create `src/components/DistributionChart/` directory structure
2. Implement types and interfaces
3. Implement `createDistributionChartWidget` factory function
4. Add CSS-in-JS styles with theme support

### Phase 3: ENERGY Widget Migration
1. Update `ENERGY/template.html` to use container div only
2. Refactor `ENERGY/controller.js` to use the new component
3. Verify all visualization modes work correctly
4. Test color consistency with 7-day chart

### Phase 4: WATER Widget Migration
1. Update `WATER/template.html` to use container div only
2. Refactor `WATER/controller.js` to use the new component
3. Verify water-specific modes work correctly

### Phase 5: Integration Testing
1. Test color consistency across ENERGY and WATER widgets
2. Test with multiple shoppings selected
3. Test theme switching
4. Verify no color conflicts with consumption charts

## Appendix A: Current Template to Replace

```html
<!-- ENERGY/template.html - Current implementation -->
<div class="chart-box">
  <div class="chart-header">
    <h4>Distribuição de Energia</h4>
    <div class="chart-controls">
      <label for="distributionMode" class="control-label">Visualizar:</label>
      <select id="distributionMode" class="chart-select">
        <option value="groups">Por Grupos de Equipamentos</option>
        <option value="elevators">Elevadores por Shopping</option>
        <option value="escalators">Escadas Rolantes por Shopping</option>
        <option value="hvac">Climatização por Shopping</option>
        <option value="others">Outros Equipamentos por Shopping</option>
        <option value="stores">Lojas por Shopping</option>
      </select>
    </div>
  </div>
  <canvas id="pieChart"></canvas>
</div>
```

### After Migration

```html
<!-- ENERGY/template.html - After RFC-0102 -->
<div id="energy-distribution-widget" class="chart-box"></div>
```

## Appendix B: Color Consistency Matrix

| Widget | Chart Type | Color Source | Expected Behavior |
|--------|-----------|--------------|-------------------|
| ENERGY | 7-day consumption | Orchestrator | Shopping A = Blue everywhere |
| ENERGY | Distribution (per shopping) | Orchestrator | Shopping A = Blue |
| ENERGY | Distribution (groups) | groupColors | Elevadores = always #3b82f6 |
| WATER | 7-day consumption | Orchestrator | Shopping A = Blue (same as ENERGY) |
| WATER | Distribution (per shopping) | Orchestrator | Shopping A = Blue |
| WATER | Distribution (groups) | groupColors | Lojas = always #10b981 |
| TEMPERATURE | 7-day chart | Orchestrator | Shopping A = Blue (same as others) |

## Appendix C: Showcase

A live demo is available at `showcase/distribution-chart.html` demonstrating:

1. **ENERGY Distribution Widget** - Equipment groups and per-shopping breakdown
2. **WATER Distribution Widget** - Stores vs Common Area breakdown
3. **Color Consistency Demo** - Shows same shopping colors across domains
4. **Theme Toggle** - Light/dark mode support
5. **Mode Switching** - Interactive mode selector

See also: `showcase/index.html` for the full component catalog.
