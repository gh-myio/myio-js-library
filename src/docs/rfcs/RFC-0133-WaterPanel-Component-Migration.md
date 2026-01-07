# RFC 0133: WaterPanel Component Migration

- **Feature Name:** `water-panel-component`
- **Start Date:** 2026-01-07
- **RFC PR:** (to be assigned)
- **Status:** Draft
- **Authors:** MyIO Team
- **Related Components:** RFC-0098 (ConsumptionChart), RFC-0102 (DistributionChart), RFC-0132 (EnergyPanel)

---

## Summary

Migrate the ThingsBoard-coupled WATER widget (`src/MYIO-SIM/v5.2.0/WATER/controller.js`) to a standalone, reusable TypeScript component (`src/components/water-panel/`) following the architecture established by `telemetry-grid` and `energy-panel`. This enables:

1. **Decoupling** from ThingsBoard widget lifecycle
2. **Reusability** across different contexts (dashboards, modals, standalone pages)
3. **Testability** via isolated unit tests
4. **Type Safety** with full TypeScript interfaces

---

## Motivation

### Current Problems

The WATER widget suffers from tight coupling to ThingsBoard and global state:

```javascript
// Current: Depends on ThingsBoard context
self.onInit = function() {
  const ctx = self.ctx;
  // ... uses ctx.$container, ctx.settings, ctx.$scope
}

// Current: Depends on global state
const orchestrator = window.MyIOOrchestrator;
const selectedShoppings = window.custumersSelected;

// Current: Global event listeners
window.addEventListener('myio:water-summary-ready', handler);
```

**Issues:**
- Cannot be tested in isolation
- Cannot be reused outside ThingsBoard
- State scattered across `window.*` globals
- No type safety
- ~1,500 lines of coupled code

### Goals

1. **Standalone component** that works with any container
2. **Typed API** for data input and callbacks
3. **MVC architecture** separating state from rendering
4. **Showcase page** for development and testing
5. **Wrapper** for ThingsBoard integration

---

## Guide-level Explanation

### Basic Usage

```typescript
import { createWaterPanelComponent } from 'myio-js-library';

// Create component
const panel = createWaterPanelComponent({
  container: document.getElementById('water-panel'),
  theme: 'light',
  period: 7,

  // Data fetching
  fetchConsumption: async (customerId, startDate, endDate) => {
    const response = await fetch(`/api/water/${customerId}?start=${startDate}&end=${endDate}`);
    return response.json();
  },

  // Callbacks
  onFilterChange: (shoppingIds) => console.log('Filter changed:', shoppingIds),
  onPeriodChange: (days) => console.log('Period changed:', days),
  onMaximizeClick: () => openFullscreenModal(),
});

// Update data
panel.updateSummary({
  storesTotal: 1250.5,       // m³
  commonAreaTotal: 875.3,    // m³
  total: 2125.8,             // m³
  deviceCount: 45,
  storesPercentage: 58.8,    // 0-100
  commonAreaPercentage: 41.2,
});

// Apply filter
panel.applyShoppingFilter(['shopping-id-1', 'shopping-id-2']);

// Change period
panel.setPeriod(14);

// Cleanup
panel.destroy();
```

### Visual Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  WATER PANEL                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │
│  │   LOJAS           │  │   ÁREA COMUM      │  │   TOTAL         │  │
│  │   1.250,5 m³      │  │   875,3 m³        │  │   2.125,8 m³    │  │
│  │   58,8% do total  │  │   41,2% do total  │  │   45 hidrôm.    │  │
│  │   30 hidrômetros  │  │   15 hidrômetros  │  │   Lojas + AC    │  │
│  └───────────────────┘  └───────────────────┘  └─────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  CONSUMPTION CHART (7/14/30 days)                           │   │
│  │  [Line/Bar toggle] [Period selector] [Maximize]             │   │
│  │  ╭──────────────────────────────────────────────────────╮   │   │
│  │  │                        📈                             │   │   │
│  │  ╰──────────────────────────────────────────────────────╯   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  DISTRIBUTION CHART                                         │   │
│  │  [Mode: Lojas vs AC | Lojas por Shopping | AC por Shopping] │   │
│  │  ╭──────────────────────────────────────────────────────╮   │   │
│  │  │                        🥧                             │   │   │
│  │  ╰──────────────────────────────────────────────────────╯   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Water vs Energy: Key Differences

| Aspect | Water Panel | Energy Panel |
|--------|-------------|--------------|
| **Units** | m³ (metros cúbicos) | kWh (quilowatt-hora) |
| **Categories** | Lojas / Área Comum | Lojas / Equipamentos |
| **Cards** | 3 cards (Lojas, Área Comum, Total) | 2 cards (Lojas, Equipamentos) |
| **Distribution Modes** | groups, stores, common | groups, elevators, hvac, stores |
| **Formatting** | `1.500,50 m³` ou `1.50k m³` | `12.500,5 kWh` ou `12.5 MWh` |
| **Color Scheme** | Blue (#0288d1) | Green (#10b981) |

---

## Reference-level Explanation

### File Structure

```
src/components/water-panel/
├── index.ts                      # Public exports
├── types.ts                      # TypeScript interfaces (~200 lines)
├── createWaterPanelComponent.ts  # Factory function (~150 lines)
├── WaterPanelController.ts       # State management (~300 lines)
├── WaterPanelView.ts             # DOM rendering (~500 lines)
└── styles.ts                     # CSS-in-JS (~500 lines)

showcase/
└── water-panel.html              # Standalone demo (~800 lines)
```

### Types (`types.ts`)

```typescript
// ============ Domain Types ============

export type ThemeMode = 'light' | 'dark';
export type PeriodDays = 7 | 14 | 30;
export type VizMode = 'total' | 'separate';
export type ChartType = 'line' | 'bar';
export type DistributionMode = 'groups' | 'stores' | 'common';

// ============ Data Types ============

export interface WaterCategoryData {
  total: number;      // m³
  count: number;      // device count
  percentage?: number;
}

export interface WaterSummaryData {
  storesTotal: number;           // m³
  commonAreaTotal: number;       // m³
  total: number;                 // m³
  deviceCount: number;
  storesPercentage: number;      // 0-100
  commonAreaPercentage: number;  // 0-100
  byStatus?: {
    online: number;
    offline: number;
    waiting: number;
  };
}

export interface ConsumptionDataPoint {
  date: string;       // ISO date
  value: number;      // m³
  shoppingId?: string;
  shoppingName?: string;
}

export interface DistributionDataPoint {
  id: string;
  label: string;
  value: number;
  percentage: number;
  color?: string;
}

// ============ Fetch Functions ============

export type FetchConsumptionFn = (
  customerId: string,
  startDate: string,
  endDate: string,
  granularity?: '1h' | '1d'
) => Promise<ConsumptionDataPoint[]>;

export type FetchDistributionFn = (
  mode: DistributionMode
) => Promise<DistributionDataPoint[]>;

// ============ Callbacks ============

export type OnFilterChangeCallback = (shoppingIds: string[]) => void;
export type OnPeriodChangeCallback = (days: PeriodDays) => void;
export type OnVizModeChangeCallback = (mode: VizMode) => void;
export type OnMaximizeCallback = () => void;
export type OnRefreshCallback = () => void;

// ============ Component Params ============

export interface WaterPanelParams {
  // Required
  container: HTMLElement;

  // Optional config
  theme?: ThemeMode;
  period?: PeriodDays;
  vizMode?: VizMode;
  chartType?: ChartType;

  // Initial data (optional)
  initialSummary?: WaterSummaryData;

  // Data fetching (optional - for charts)
  fetchConsumption?: FetchConsumptionFn;
  fetchDistribution?: FetchDistributionFn;
  customerId?: string;

  // Filter state (optional)
  selectedShoppingIds?: string[];
  availableShoppings?: Array<{ id: string; name: string }>;

  // Callbacks
  onFilterChange?: OnFilterChangeCallback;
  onPeriodChange?: OnPeriodChangeCallback;
  onVizModeChange?: OnVizModeChangeCallback;
  onMaximizeClick?: OnMaximizeCallback;
  onRefresh?: OnRefreshCallback;

  // Feature flags
  showCards?: boolean;             // default: true
  showConsumptionChart?: boolean;  // default: true
  showDistributionChart?: boolean; // default: true
  enableFullscreen?: boolean;      // default: true
}

// ============ Component Instance ============

export interface WaterPanelInstance {
  // DOM
  element: HTMLElement;

  // Data methods
  updateSummary(data: WaterSummaryData): void;
  getSummary(): WaterSummaryData | null;

  // Config methods
  setTheme(mode: ThemeMode): void;
  getTheme(): ThemeMode;
  setPeriod(days: PeriodDays): void;
  getPeriod(): PeriodDays;
  setVizMode(mode: VizMode): void;
  getVizMode(): VizMode;
  setChartType(type: ChartType): void;
  getChartType(): ChartType;

  // Filter methods
  applyShoppingFilter(ids: string[]): void;
  getSelectedShoppingIds(): string[];
  clearFilters(): void;

  // Actions
  refresh(): void;
  openFullscreen(): void;

  // Lifecycle
  destroy(): void;
}

// ============ Internal State ============

export interface WaterPanelState {
  theme: ThemeMode;
  period: PeriodDays;
  vizMode: VizMode;
  chartType: ChartType;
  selectedShoppingIds: string[];
  summary: WaterSummaryData | null;
  isLoading: boolean;
  error: string | null;
}
```

### Controller (`WaterPanelController.ts`)

```typescript
import {
  WaterPanelParams,
  WaterPanelState,
  WaterSummaryData,
  ThemeMode,
  PeriodDays,
  VizMode,
  ChartType,
} from './types';

export class WaterPanelController {
  private state: WaterPanelState;
  private params: WaterPanelParams;
  private onStateChange: ((state: WaterPanelState) => void) | null = null;

  constructor(params: WaterPanelParams) {
    this.params = params;
    this.state = {
      theme: params.theme || 'light',
      period: params.period || 7,
      vizMode: params.vizMode || 'total',
      chartType: params.chartType || 'line',
      selectedShoppingIds: params.selectedShoppingIds || [],
      summary: params.initialSummary || null,
      isLoading: false,
      error: null,
    };
  }

  // Observer pattern
  setOnStateChange(callback: (state: WaterPanelState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  // Getters
  getState(): WaterPanelState {
    return { ...this.state };
  }

  getSummary(): WaterSummaryData | null {
    return this.state.summary ? { ...this.state.summary } : null;
  }

  // Data updates
  updateSummary(data: WaterSummaryData): void {
    // Calculate percentages if not provided
    const total = data.total || (data.storesTotal + data.commonAreaTotal);
    const storesPercentage = total > 0 ? (data.storesTotal / total) * 100 : 0;
    const commonAreaPercentage = total > 0 ? (data.commonAreaTotal / total) * 100 : 0;

    this.state.summary = {
      ...data,
      total,
      storesPercentage: data.storesPercentage ?? storesPercentage,
      commonAreaPercentage: data.commonAreaPercentage ?? commonAreaPercentage,
    };
    this.notifyStateChange();
  }

  // Config updates
  setTheme(mode: ThemeMode): void {
    if (this.state.theme !== mode) {
      this.state.theme = mode;
      this.notifyStateChange();
    }
  }

  setPeriod(days: PeriodDays): void {
    if (this.state.period !== days) {
      this.state.period = days;
      this.params.onPeriodChange?.(days);
      this.notifyStateChange();
    }
  }

  setVizMode(mode: VizMode): void {
    if (this.state.vizMode !== mode) {
      this.state.vizMode = mode;
      this.params.onVizModeChange?.(mode);
      this.notifyStateChange();
    }
  }

  setChartType(type: ChartType): void {
    if (this.state.chartType !== type) {
      this.state.chartType = type;
      this.notifyStateChange();
    }
  }

  // Filter updates
  applyShoppingFilter(ids: string[]): void {
    this.state.selectedShoppingIds = [...ids];
    this.params.onFilterChange?.(ids);
    this.notifyStateChange();
  }

  clearFilters(): void {
    this.state.selectedShoppingIds = [];
    this.params.onFilterChange?.([]);
    this.notifyStateChange();
  }

  // Loading state
  setLoading(loading: boolean): void {
    this.state.isLoading = loading;
    this.notifyStateChange();
  }

  setError(error: string | null): void {
    this.state.error = error;
    this.notifyStateChange();
  }
}
```

### View (`WaterPanelView.ts`)

```typescript
import { WaterPanelController } from './WaterPanelController';
import { WaterPanelParams, WaterPanelState } from './types';
import { WATER_PANEL_STYLES, injectWaterPanelStyles } from './styles';

export class WaterPanelView {
  private params: WaterPanelParams;
  private controller: WaterPanelController;
  private root: HTMLElement | null = null;
  private consumptionChartInstance: any = null;
  private distributionChartInstance: any = null;

  constructor(params: WaterPanelParams, controller: WaterPanelController) {
    this.params = params;
    this.controller = controller;

    // Subscribe to state changes
    this.controller.setOnStateChange((state) => this.onStateChange(state));
  }

  render(): HTMLElement {
    injectWaterPanelStyles();

    const state = this.controller.getState();

    this.root = document.createElement('div');
    this.root.className = 'water-panel-wrap';
    this.root.setAttribute('data-theme', state.theme);
    this.root.setAttribute('data-domain', 'water');

    this.root.innerHTML = this.buildHTML(state);
    this.bindEvents();
    this.initializeCharts();

    return this.root;
  }

  private buildHTML(state: WaterPanelState): string {
    const { showCards = true, showConsumptionChart = true, showDistributionChart = true } = this.params;

    return `
      <div class="water-panel">
        ${showCards ? this.buildCardsHTML(state) : ''}
        ${showConsumptionChart ? this.buildConsumptionChartHTML() : ''}
        ${showDistributionChart ? this.buildDistributionChartHTML() : ''}
      </div>
    `;
  }

  private buildCardsHTML(state: WaterPanelState): string {
    const summary = state.summary;
    const storesValue = summary?.storesTotal ?? 0;
    const commonAreaValue = summary?.commonAreaTotal ?? 0;
    const totalValue = summary?.total ?? 0;
    const storesPercent = summary?.storesPercentage ?? 0;
    const commonAreaPercent = summary?.commonAreaPercentage ?? 0;

    return `
      <div class="water-panel__cards">
        <div class="water-panel__card" data-type="stores">
          <div class="water-panel__card-icon">💧</div>
          <div class="water-panel__card-content">
            <div class="water-panel__card-label">Consumo Lojas</div>
            <div class="water-panel__card-value">${this.formatWater(storesValue)}</div>
            <div class="water-panel__card-trend">${storesPercent.toFixed(1)}% do total</div>
            <div class="water-panel__card-count">${summary?.deviceCount || 0} hidrômetros</div>
          </div>
        </div>
        <div class="water-panel__card" data-type="common-area">
          <div class="water-panel__card-icon">🚿</div>
          <div class="water-panel__card-content">
            <div class="water-panel__card-label">Consumo Área Comum</div>
            <div class="water-panel__card-value">${this.formatWater(commonAreaValue)}</div>
            <div class="water-panel__card-trend">${commonAreaPercent.toFixed(1)}% do total</div>
            <div class="water-panel__card-count">Banheiros, limpeza, etc.</div>
          </div>
        </div>
        <div class="water-panel__card water-panel__card--total" data-type="total">
          <div class="water-panel__card-icon">📊</div>
          <div class="water-panel__card-content">
            <div class="water-panel__card-label">Consumo Total</div>
            <div class="water-panel__card-value">${this.formatWater(totalValue)}</div>
            <div class="water-panel__card-trend">Lojas + Área Comum</div>
            <div class="water-panel__card-count">${summary?.deviceCount || 0} dispositivos</div>
          </div>
        </div>
      </div>
    `;
  }

  private buildConsumptionChartHTML(): string {
    return `
      <div class="water-panel__chart-section">
        <div class="water-panel__chart-header">
          <h3>Consumo de Água</h3>
          <div class="water-panel__chart-controls">
            <select class="water-panel__period-select">
              <option value="7">7 dias</option>
              <option value="14">14 dias</option>
              <option value="30">30 dias</option>
            </select>
            <button class="water-panel__maximize-btn" title="Expandir">⛶</button>
          </div>
        </div>
        <div class="water-panel__consumption-chart" id="water-consumption-chart"></div>
      </div>
    `;
  }

  private buildDistributionChartHTML(): string {
    return `
      <div class="water-panel__chart-section">
        <div class="water-panel__chart-header">
          <h3>Distribuição de Consumo</h3>
          <div class="water-panel__chart-controls">
            <select class="water-panel__distribution-mode">
              <option value="groups">Lojas vs Área Comum</option>
              <option value="stores">Lojas por Shopping</option>
              <option value="common">Área Comum por Shopping</option>
            </select>
          </div>
        </div>
        <div class="water-panel__distribution-chart" id="water-distribution-chart"></div>
      </div>
    `;
  }

  private formatWater(value: number): string {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2).replace('.', ',')}k m³`;
    }
    return `${value.toFixed(1).replace('.', ',')} m³`;
  }

  private bindEvents(): void {
    if (!this.root) return;

    // Period selector
    const periodSelect = this.root.querySelector('.water-panel__period-select');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        const days = parseInt((e.target as HTMLSelectElement).value) as 7 | 14 | 30;
        this.controller.setPeriod(days);
      });
    }

    // Maximize button
    const maximizeBtn = this.root.querySelector('.water-panel__maximize-btn');
    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', () => {
        this.params.onMaximizeClick?.();
      });
    }

    // Distribution mode selector
    const distModeSelect = this.root.querySelector('.water-panel__distribution-mode');
    if (distModeSelect) {
      distModeSelect.addEventListener('change', (e) => {
        const mode = (e.target as HTMLSelectElement).value;
        this.refreshDistributionChart(mode);
      });
    }
  }

  private initializeCharts(): void {
    // Integration with existing chart components
    // Uses createConsumptionChartWidget and createDistributionChartWidget
  }

  private refreshDistributionChart(mode: string): void {
    // Refresh distribution chart with new mode
  }

  private onStateChange(state: WaterPanelState): void {
    if (!this.root) return;

    // Update theme
    this.root.setAttribute('data-theme', state.theme);

    // Update cards
    this.updateCards(state);

    // Update period selector
    const periodSelect = this.root.querySelector('.water-panel__period-select') as HTMLSelectElement;
    if (periodSelect && periodSelect.value !== String(state.period)) {
      periodSelect.value = String(state.period);
    }
  }

  private updateCards(state: WaterPanelState): void {
    const summary = state.summary;
    if (!summary || !this.root) return;

    // Update stores card
    const storesCard = this.root.querySelector('[data-type="stores"] .water-panel__card-value');
    const storesTrend = this.root.querySelector('[data-type="stores"] .water-panel__card-trend');
    if (storesCard) {
      storesCard.textContent = this.formatWater(summary.storesTotal);
    }
    if (storesTrend) {
      storesTrend.textContent = `${summary.storesPercentage.toFixed(1)}% do total`;
    }

    // Update common area card
    const commonAreaCard = this.root.querySelector('[data-type="common-area"] .water-panel__card-value');
    const commonAreaTrend = this.root.querySelector('[data-type="common-area"] .water-panel__card-trend');
    if (commonAreaCard) {
      commonAreaCard.textContent = this.formatWater(summary.commonAreaTotal);
    }
    if (commonAreaTrend) {
      commonAreaTrend.textContent = `${summary.commonAreaPercentage.toFixed(1)}% do total`;
    }

    // Update total card
    const totalCard = this.root.querySelector('[data-type="total"] .water-panel__card-value');
    if (totalCard) {
      totalCard.textContent = this.formatWater(summary.total);
    }
  }

  destroy(): void {
    this.consumptionChartInstance?.destroy?.();
    this.distributionChartInstance?.destroy?.();
    this.root?.remove();
    this.root = null;
  }
}
```

### Factory (`createWaterPanelComponent.ts`)

```typescript
import { WaterPanelParams, WaterPanelInstance } from './types';
import { WaterPanelController } from './WaterPanelController';
import { WaterPanelView } from './WaterPanelView';

export function createWaterPanelComponent(params: WaterPanelParams): WaterPanelInstance {
  // Validate required params
  if (!params.container) {
    throw new Error('[WaterPanel] container is required');
  }

  // Create controller and view
  const controller = new WaterPanelController(params);
  const view = new WaterPanelView(params, controller);

  // Render into container
  const element = view.render();
  params.container.appendChild(element);

  // Return public API
  return {
    element,

    // Data methods
    updateSummary: (data) => controller.updateSummary(data),
    getSummary: () => controller.getSummary(),

    // Config methods
    setTheme: (mode) => controller.setTheme(mode),
    getTheme: () => controller.getState().theme,
    setPeriod: (days) => controller.setPeriod(days),
    getPeriod: () => controller.getState().period,
    setVizMode: (mode) => controller.setVizMode(mode),
    getVizMode: () => controller.getState().vizMode,
    setChartType: (type) => controller.setChartType(type),
    getChartType: () => controller.getState().chartType,

    // Filter methods
    applyShoppingFilter: (ids) => controller.applyShoppingFilter(ids),
    getSelectedShoppingIds: () => [...controller.getState().selectedShoppingIds],
    clearFilters: () => controller.clearFilters(),

    // Actions
    refresh: () => {
      params.onRefresh?.();
    },
    openFullscreen: () => {
      params.onMaximizeClick?.();
    },

    // Lifecycle
    destroy: () => view.destroy(),
  };
}
```

---

## Implementation Plan

### Phase 1: Types & Structure
- [ ] Create `src/components/water-panel/` directory
- [ ] Create `types.ts` with all interfaces
- [ ] Create `index.ts` with exports

### Phase 2: Controller
- [ ] Implement `WaterPanelController.ts`
- [ ] Add state management logic
- [ ] Add observer pattern
- [ ] Add percentage calculation logic

### Phase 3: View
- [ ] Implement `WaterPanelView.ts`
- [ ] Create 3-card rendering (Stores, CommonArea, Total)
- [ ] Integrate consumption chart (RFC-0098)
- [ ] Integrate distribution chart (RFC-0102)

### Phase 4: Styles
- [ ] Create `styles.ts` with CSS-in-JS
- [ ] Add theme support (light/dark)
- [ ] Add responsive layout for 3 cards
- [ ] Use water color scheme (#0288d1)

### Phase 5: Factory
- [ ] Implement `createWaterPanelComponent.ts`
- [ ] Wire up controller + view
- [ ] Return public API

### Phase 6: Showcase
- [ ] Create `showcase/water-panel.html`
- [ ] Add mock data generator
- [ ] Add controls for testing all features

### Phase 7: ThingsBoard Wrapper
- [ ] Create wrapper that bridges global state to component
- [ ] Test integration with existing dashboard

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/water-panel/index.ts` | Create | Public exports |
| `src/components/water-panel/types.ts` | Create | TypeScript interfaces |
| `src/components/water-panel/createWaterPanelComponent.ts` | Create | Factory function |
| `src/components/water-panel/WaterPanelController.ts` | Create | State management |
| `src/components/water-panel/WaterPanelView.ts` | Create | DOM rendering |
| `src/components/water-panel/styles.ts` | Create | CSS-in-JS styles |
| `showcase/water-panel.html` | Create | Standalone demo |
| `src/index.ts` | Modify | Add exports |

---

## Dependencies to Decouple

| Widget Atual | Componente Novo |
|--------------|-----------------|
| `window.MyIOOrchestrator.getWaterCache()` | `updateSummary()` method |
| `window.MyIOOrchestrator.getWaterTotals()` | Props injection |
| `window.custumersSelected` | `onFilterChange` callback |
| `self.ctx` (ThingsBoard) | `container: HTMLElement` |
| `myio:water-summary-ready` event | `updateSummary()` method |
| `myio:water-data-ready` event | Data passed via props |
| `document.getElementById()` | Internal refs |

---

## Migration Guide

### From Widget to Component

**Before (ThingsBoard Widget):**
```javascript
// WATER/controller.js
self.onInit = function() {
  // Depends on self.ctx, window.MyIOOrchestrator, window.MyIOUtils
  window.addEventListener('myio:water-summary-ready', (ev) => {
    const { stores, commonArea, filteredTotal } = ev.detail;
    cacheTotalConsumption(stores, commonArea, filteredTotal);
    updateAllCards({ storesTotal: stores, commonAreaTotal: commonArea, totalGeral: filteredTotal });
  });
};
```

**After (Standalone Component):**
```typescript
// ThingsBoard wrapper
self.onInit = function() {
  const panel = createWaterPanelComponent({
    container: self.ctx.$container[0],
    theme: 'light',
    onMaximizeClick: () => openFullscreenModal(),
  });

  // Bridge global events to component
  window.addEventListener('myio:water-summary-ready', (ev) => {
    const { stores, commonArea, filteredTotal } = ev.detail;
    panel.updateSummary({
      storesTotal: stores,
      commonAreaTotal: commonArea,
      total: filteredTotal,
      deviceCount: ev.detail.deviceCount || 0,
    });
  });

  self.onDestroy = () => panel.destroy();
};
```

---

## Testing/Showcase

### Showcase Features

1. **Theme Controls:** Toggle light/dark theme
2. **Data Controls:** Generate mock data button
3. **Period Controls:** 7/14/30 day selector
4. **Filter Controls:** Shopping multi-select
5. **Live Stats:** Display current state
6. **3-Card Layout:** Responsive for different screen sizes

### Mock Data Generator

```javascript
function generateMockSummary() {
  const storesTotal = Math.random() * 2000;
  const commonAreaTotal = Math.random() * 1500;
  const total = storesTotal + commonAreaTotal;

  return {
    storesTotal,
    commonAreaTotal,
    total,
    deviceCount: Math.floor(Math.random() * 50) + 10,
    storesPercentage: (storesTotal / total) * 100,
    commonAreaPercentage: (commonAreaTotal / total) * 100,
  };
}
```

---

## Drawbacks

1. **Initial Effort:** Requires significant refactoring of existing widget
2. **Dual Maintenance:** During migration, both widget and component must be maintained
3. **Breaking Changes:** ThingsBoard wrapper API may differ from original widget
4. **3-Card Layout Complexity:** More complex responsive layout than EnergyPanel's 2 cards

---

## Alternatives

### Alternative 1: Incremental Refactoring
Refactor widget in-place without creating separate component.
- **Pros:** Less code duplication
- **Cons:** Still coupled to ThingsBoard

### Alternative 2: React/Vue Component
Use a framework instead of vanilla TypeScript.
- **Pros:** Better state management, ecosystem
- **Cons:** Adds dependency, bundle size increase

### Alternative 3: Extend EnergyPanel
Make EnergyPanel generic to support both energy and water.
- **Pros:** Code reuse
- **Cons:** Complex conditionals, different card layouts

**Decision:** Separate vanilla TypeScript component (like telemetry-grid) for consistency and minimal dependencies. Water has enough differences (3 cards, different categories) to warrant its own component.

---

## Unresolved Questions

1. **Chart Integration:** Should charts be embedded or pluggable?
2. **Fullscreen Modal:** Should modal be part of component or external?
3. **API Caching:** Should component handle its own cache or rely on external?
4. **3-Card Responsive:** Best breakpoints for 3-card layout (stack vs grid)?

---

## Future Possibilities

1. **TemperaturePanel Component:** Same architecture for temperature domain
2. **UnifiedDashboard Component:** Combines all domains in single component
3. **React/Vue Wrappers:** Framework-specific wrappers for component
4. **Shared CardComponent:** Extract card rendering to shared component used by both Energy and Water panels
