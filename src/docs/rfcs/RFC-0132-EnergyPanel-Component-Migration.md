# RFC 0132: EnergyPanel Component Migration

- **Feature Name:** `energy-panel-component`
- **Start Date:** 2026-01-07
- **RFC PR:** (to be assigned)
- **Status:** Draft
- **Authors:** MyIO Team
- **Related Components:** RFC-0098 (ConsumptionChart), RFC-0102 (DistributionChart)

---

## Summary

Migrate the ThingsBoard-coupled ENERGY widget (`src/MYIO-SIM/v5.2.0/ENERGY/controller.js`) to a standalone, reusable TypeScript component (`src/components/energy-panel/`) following the architecture established by `telemetry-grid`. This enables:

1. **Decoupling** from ThingsBoard widget lifecycle
2. **Reusability** across different contexts (dashboards, modals, standalone pages)
3. **Testability** via isolated unit tests
4. **Type Safety** with full TypeScript interfaces

---

## Motivation

### Current Problems

The ENERGY widget suffers from tight coupling to ThingsBoard and global state:

```javascript
// Current: Depends on ThingsBoard context
self.onInit = async function() {
  const ctx = self.ctx;
  // ... uses ctx.$container, ctx.settings, ctx.$scope
}

// Current: Depends on global state
const energyData = window.STATE.energy;
const selectedShoppings = window.custumersSelected;

// Current: Global event listeners
window.addEventListener('myio:energy-summary-ready', handler);
```

**Issues:**
- Cannot be tested in isolation
- Cannot be reused outside ThingsBoard
- State scattered across `window.*` globals
- No type safety
- ~1,800 lines of coupled code

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
import { createEnergyPanelComponent } from 'myio-js-library';

// Create component
const panel = createEnergyPanelComponent({
  container: document.getElementById('energy-panel'),
  theme: 'light',
  period: 7,

  // Data fetching
  fetchConsumption: async (customerId, startDate, endDate) => {
    const response = await fetch(`/api/energy/${customerId}?start=${startDate}&end=${endDate}`);
    return response.json();
  },

  // Callbacks
  onFilterChange: (shoppingIds) => console.log('Filter changed:', shoppingIds),
  onPeriodChange: (days) => console.log('Period changed:', days),
  onMaximizeClick: () => openFullscreenModal(),
});

// Update data
panel.updateSummary({
  storesTotal: 12500.5,      // kWh
  equipmentsTotal: 8750.3,   // kWh
  total: 21250.8,            // kWh
  deviceCount: 45,
  byCategory: {
    lojas: { total: 12500.5, count: 30 },
    climatizacao: { total: 5000.2, count: 8 },
    elevadores: { total: 2000.1, count: 4 },
    escadas: { total: 1000.0, count: 2 },
    outros: { total: 750.0, count: 1 },
  },
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
┌─────────────────────────────────────────────────────────────┐
│  ENERGY PANEL                                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │   LOJAS             │  │   EQUIPAMENTOS      │          │
│  │   12.500,5 kWh      │  │   8.750,3 kWh       │          │
│  │   30 medidores      │  │   15 equipamentos   │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  CONSUMPTION CHART (7/14/30 days)                   │   │
│  │  [Line/Bar toggle] [Period selector] [Maximize]     │   │
│  │  ╭──────────────────────────────────────────────╮   │   │
│  │  │                    📈                         │   │   │
│  │  ╰──────────────────────────────────────────────╯   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  DISTRIBUTION CHART                                 │   │
│  │  [Mode: Groups | Elevators | HVAC | Stores]         │   │
│  │  ╭──────────────────────────────────────────────╮   │   │
│  │  │                    🥧                         │   │   │
│  │  ╰──────────────────────────────────────────────╯   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Reference-level Explanation

### File Structure

```
src/components/energy-panel/
├── index.ts                      # Public exports
├── types.ts                      # TypeScript interfaces (~200 lines)
├── createEnergyPanelComponent.ts # Factory function (~150 lines)
├── EnergyPanelController.ts      # State management (~300 lines)
├── EnergyPanelView.ts            # DOM rendering (~400 lines)
└── styles.ts                     # CSS-in-JS (~500 lines)

showcase/
└── energy-panel.html             # Standalone demo (~800 lines)
```

### Types (`types.ts`)

```typescript
// ============ Domain Types ============

export type ThemeMode = 'light' | 'dark';
export type PeriodDays = 7 | 14 | 30;
export type VizMode = 'total' | 'separate';
export type ChartType = 'line' | 'bar';
export type DistributionMode = 'groups' | 'elevators' | 'escalators' | 'hvac' | 'stores' | 'others';

// ============ Data Types ============

export interface EnergyCategoryData {
  total: number;      // kWh
  count: number;      // device count
  percentage?: number;
}

export interface EnergySummaryData {
  storesTotal: number;
  equipmentsTotal: number;
  total: number;
  deviceCount: number;
  byCategory: {
    lojas: EnergyCategoryData;
    climatizacao: EnergyCategoryData;
    elevadores: EnergyCategoryData;
    escadas: EnergyCategoryData;
    outros: EnergyCategoryData;
  };
  byStatus?: {
    online: number;
    offline: number;
    waiting: number;
  };
}

export interface ConsumptionDataPoint {
  date: string;       // ISO date
  value: number;      // kWh
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

export interface EnergyPanelParams {
  // Required
  container: HTMLElement;

  // Optional config
  theme?: ThemeMode;
  period?: PeriodDays;
  vizMode?: VizMode;
  chartType?: ChartType;

  // Initial data (optional)
  initialSummary?: EnergySummaryData;

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
  showCards?: boolean;           // default: true
  showConsumptionChart?: boolean; // default: true
  showDistributionChart?: boolean; // default: true
  enableFullscreen?: boolean;     // default: true
}

// ============ Component Instance ============

export interface EnergyPanelInstance {
  // DOM
  element: HTMLElement;

  // Data methods
  updateSummary(data: EnergySummaryData): void;
  getSummary(): EnergySummaryData | null;

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

export interface EnergyPanelState {
  theme: ThemeMode;
  period: PeriodDays;
  vizMode: VizMode;
  chartType: ChartType;
  selectedShoppingIds: string[];
  summary: EnergySummaryData | null;
  isLoading: boolean;
  error: string | null;
}
```

### Controller (`EnergyPanelController.ts`)

```typescript
import {
  EnergyPanelParams,
  EnergyPanelState,
  EnergySummaryData,
  ThemeMode,
  PeriodDays,
  VizMode,
  ChartType,
} from './types';

export class EnergyPanelController {
  private state: EnergyPanelState;
  private params: EnergyPanelParams;
  private onStateChange: ((state: EnergyPanelState) => void) | null = null;

  constructor(params: EnergyPanelParams) {
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
  setOnStateChange(callback: (state: EnergyPanelState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  // Getters
  getState(): EnergyPanelState {
    return { ...this.state };
  }

  getSummary(): EnergySummaryData | null {
    return this.state.summary ? { ...this.state.summary } : null;
  }

  // Data updates
  updateSummary(data: EnergySummaryData): void {
    this.state.summary = { ...data };
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

### View (`EnergyPanelView.ts`)

```typescript
import { EnergyPanelController } from './EnergyPanelController';
import { EnergyPanelParams, EnergyPanelState } from './types';
import { ENERGY_PANEL_STYLES, injectEnergyPanelStyles } from './styles';

export class EnergyPanelView {
  private params: EnergyPanelParams;
  private controller: EnergyPanelController;
  private root: HTMLElement | null = null;
  private consumptionChartInstance: any = null;
  private distributionChartInstance: any = null;

  constructor(params: EnergyPanelParams, controller: EnergyPanelController) {
    this.params = params;
    this.controller = controller;

    // Subscribe to state changes
    this.controller.setOnStateChange((state) => this.onStateChange(state));
  }

  render(): HTMLElement {
    injectEnergyPanelStyles();

    const state = this.controller.getState();

    this.root = document.createElement('div');
    this.root.className = 'energy-panel-wrap';
    this.root.setAttribute('data-theme', state.theme);
    this.root.setAttribute('data-domain', 'energy');

    this.root.innerHTML = this.buildHTML(state);
    this.bindEvents();
    this.initializeCharts();

    return this.root;
  }

  private buildHTML(state: EnergyPanelState): string {
    const { showCards = true, showConsumptionChart = true, showDistributionChart = true } = this.params;

    return `
      <div class="energy-panel">
        ${showCards ? this.buildCardsHTML(state) : ''}
        ${showConsumptionChart ? this.buildConsumptionChartHTML() : ''}
        ${showDistributionChart ? this.buildDistributionChartHTML() : ''}
      </div>
    `;
  }

  private buildCardsHTML(state: EnergyPanelState): string {
    const summary = state.summary;
    const storesValue = summary?.storesTotal ?? 0;
    const equipmentsValue = summary?.equipmentsTotal ?? 0;

    return `
      <div class="energy-panel__cards">
        <div class="energy-panel__card" data-type="stores">
          <div class="energy-panel__card-icon">🏬</div>
          <div class="energy-panel__card-content">
            <div class="energy-panel__card-label">Consumo Lojas</div>
            <div class="energy-panel__card-value">${this.formatEnergy(storesValue)}</div>
            <div class="energy-panel__card-count">${summary?.byCategory?.lojas?.count || 0} medidores</div>
          </div>
        </div>
        <div class="energy-panel__card" data-type="equipments">
          <div class="energy-panel__card-icon">⚙️</div>
          <div class="energy-panel__card-content">
            <div class="energy-panel__card-label">Consumo Equipamentos</div>
            <div class="energy-panel__card-value">${this.formatEnergy(equipmentsValue)}</div>
            <div class="energy-panel__card-count">${this.getEquipmentCount(summary)} equipamentos</div>
          </div>
        </div>
      </div>
    `;
  }

  private buildConsumptionChartHTML(): string {
    return `
      <div class="energy-panel__chart-section">
        <div class="energy-panel__chart-header">
          <h3>Consumo de Energia</h3>
          <div class="energy-panel__chart-controls">
            <select class="energy-panel__period-select">
              <option value="7">7 dias</option>
              <option value="14">14 dias</option>
              <option value="30">30 dias</option>
            </select>
            <button class="energy-panel__maximize-btn" title="Expandir">⛶</button>
          </div>
        </div>
        <div class="energy-panel__consumption-chart" id="energy-consumption-chart"></div>
      </div>
    `;
  }

  private buildDistributionChartHTML(): string {
    return `
      <div class="energy-panel__chart-section">
        <div class="energy-panel__chart-header">
          <h3>Distribuição de Consumo</h3>
          <div class="energy-panel__chart-controls">
            <select class="energy-panel__distribution-mode">
              <option value="groups">Por Categoria</option>
              <option value="stores">Por Loja</option>
              <option value="elevators">Elevadores</option>
              <option value="hvac">Climatização</option>
            </select>
          </div>
        </div>
        <div class="energy-panel__distribution-chart" id="energy-distribution-chart"></div>
      </div>
    `;
  }

  private formatEnergy(value: number): string {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} MWh`;
    }
    return `${value.toFixed(1)} kWh`;
  }

  private getEquipmentCount(summary: any): number {
    if (!summary?.byCategory) return 0;
    const { climatizacao, elevadores, escadas, outros } = summary.byCategory;
    return (climatizacao?.count || 0) + (elevadores?.count || 0) +
           (escadas?.count || 0) + (outros?.count || 0);
  }

  private bindEvents(): void {
    if (!this.root) return;

    // Period selector
    const periodSelect = this.root.querySelector('.energy-panel__period-select');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        const days = parseInt((e.target as HTMLSelectElement).value) as 7 | 14 | 30;
        this.controller.setPeriod(days);
      });
    }

    // Maximize button
    const maximizeBtn = this.root.querySelector('.energy-panel__maximize-btn');
    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', () => {
        this.params.onMaximizeClick?.();
      });
    }

    // Distribution mode selector
    const distModeSelect = this.root.querySelector('.energy-panel__distribution-mode');
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

  private onStateChange(state: EnergyPanelState): void {
    if (!this.root) return;

    // Update theme
    this.root.setAttribute('data-theme', state.theme);

    // Update cards
    this.updateCards(state);

    // Update period selector
    const periodSelect = this.root.querySelector('.energy-panel__period-select') as HTMLSelectElement;
    if (periodSelect && periodSelect.value !== String(state.period)) {
      periodSelect.value = String(state.period);
    }
  }

  private updateCards(state: EnergyPanelState): void {
    const summary = state.summary;
    if (!summary || !this.root) return;

    const storesCard = this.root.querySelector('[data-type="stores"] .energy-panel__card-value');
    const equipmentsCard = this.root.querySelector('[data-type="equipments"] .energy-panel__card-value');

    if (storesCard) {
      storesCard.textContent = this.formatEnergy(summary.storesTotal);
    }
    if (equipmentsCard) {
      equipmentsCard.textContent = this.formatEnergy(summary.equipmentsTotal);
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

### Factory (`createEnergyPanelComponent.ts`)

```typescript
import { EnergyPanelParams, EnergyPanelInstance } from './types';
import { EnergyPanelController } from './EnergyPanelController';
import { EnergyPanelView } from './EnergyPanelView';

export function createEnergyPanelComponent(params: EnergyPanelParams): EnergyPanelInstance {
  // Validate required params
  if (!params.container) {
    throw new Error('[EnergyPanel] container is required');
  }

  // Create controller and view
  const controller = new EnergyPanelController(params);
  const view = new EnergyPanelView(params, controller);

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

### Phase 1: Types & Structure (Day 1)
- [ ] Create `src/components/energy-panel/` directory
- [ ] Create `types.ts` with all interfaces
- [ ] Create `index.ts` with exports

### Phase 2: Controller (Day 2)
- [ ] Implement `EnergyPanelController.ts`
- [ ] Add state management logic
- [ ] Add observer pattern

### Phase 3: View (Days 3-4)
- [ ] Implement `EnergyPanelView.ts`
- [ ] Create card rendering
- [ ] Integrate consumption chart (RFC-0098)
- [ ] Integrate distribution chart (RFC-0102)

### Phase 4: Styles (Day 4)
- [ ] Create `styles.ts` with CSS-in-JS
- [ ] Add theme support (light/dark)
- [ ] Add responsive layout

### Phase 5: Factory (Day 5)
- [ ] Implement `createEnergyPanelComponent.ts`
- [ ] Wire up controller + view
- [ ] Return public API

### Phase 6: Showcase (Day 6)
- [ ] Create `showcase/energy-panel.html`
- [ ] Add mock data generator
- [ ] Add controls for testing all features

### Phase 7: ThingsBoard Wrapper (Day 7)
- [ ] Create wrapper that bridges global state to component
- [ ] Test integration with existing dashboard

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/energy-panel/index.ts` | Create | Public exports |
| `src/components/energy-panel/types.ts` | Create | TypeScript interfaces |
| `src/components/energy-panel/createEnergyPanelComponent.ts` | Create | Factory function |
| `src/components/energy-panel/EnergyPanelController.ts` | Create | State management |
| `src/components/energy-panel/EnergyPanelView.ts` | Create | DOM rendering |
| `src/components/energy-panel/styles.ts` | Create | CSS-in-JS styles |
| `showcase/energy-panel.html` | Create | Standalone demo |
| `src/index.ts` | Modify | Add exports |

---

## Migration Guide

### From Widget to Component

**Before (ThingsBoard Widget):**
```javascript
// ENERGY/controller.js
self.onInit = async function() {
  // Depends on self.ctx, window.STATE, window.MyIOUtils
  window.addEventListener('myio:energy-summary-ready', (ev) => {
    updateCards(ev.detail);
  });
};
```

**After (Standalone Component):**
```typescript
// ThingsBoard wrapper
self.onInit = async function() {
  const panel = createEnergyPanelComponent({
    container: self.ctx.$container[0],
    theme: 'light',
    onMaximizeClick: () => openFullscreenModal(),
  });

  // Bridge global events to component
  window.addEventListener('myio:energy-summary-ready', (ev) => {
    panel.updateSummary(ev.detail);
  });

  self.onDestroy = () => panel.destroy();
};
```

---

## Testing/Showcase

### Showcase Features

1. **Domain Controls:** Theme toggle (light/dark)
2. **Data Controls:** Generate mock data button
3. **Period Controls:** 7/14/30 day selector
4. **Filter Controls:** Shopping multi-select
5. **Live Stats:** Display current state

### Mock Data Generator

```javascript
function generateMockSummary() {
  return {
    storesTotal: Math.random() * 20000,
    equipmentsTotal: Math.random() * 15000,
    total: Math.random() * 35000,
    deviceCount: Math.floor(Math.random() * 100),
    byCategory: {
      lojas: { total: Math.random() * 15000, count: 30 },
      climatizacao: { total: Math.random() * 8000, count: 8 },
      elevadores: { total: Math.random() * 3000, count: 4 },
      escadas: { total: Math.random() * 2000, count: 2 },
      outros: { total: Math.random() * 1000, count: 3 },
    },
  };
}
```

---

## Drawbacks

1. **Initial Effort:** Requires significant refactoring of existing widget
2. **Dual Maintenance:** During migration, both widget and component must be maintained
3. **Breaking Changes:** ThingsBoard wrapper API may differ from original widget

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

**Decision:** Vanilla TypeScript (like telemetry-grid) for consistency and minimal dependencies.

---

## Unresolved Questions

1. **Chart Integration:** Should charts be embedded or pluggable?
2. **Fullscreen Modal:** Should modal be part of component or external?
3. **API Caching:** Should component handle its own cache or rely on external?

---

## Future Possibilities

1. **WaterPanel Component:** Same architecture for water domain
2. **TemperaturePanel Component:** Same architecture for temperature domain
3. **UnifiedDashboard Component:** Combines all domains in single component
4. **React/Vue Wrappers:** Framework-specific wrappers for component
