import { WaterPanelController } from './WaterPanelController';
import { WaterPanelParams, WaterPanelState, ChartType, VizMode } from './types';
import { injectWaterPanelStyles } from './styles';

// Import existing chart components
import { createConsumptionChartWidget, type ConsumptionWidgetInstance } from '../Consumption7DaysChart/createConsumptionChartWidget';
import { createDistributionChartWidget } from '../DistributionChart/createDistributionChartWidget';
import type { Consumption7DaysData } from '../Consumption7DaysChart/types';
import type { DistributionData, DistributionChartInstance } from '../DistributionChart/types';

export class WaterPanelView {
  private params: WaterPanelParams;
  private controller: WaterPanelController;
  private root: HTMLElement | null = null;

  // Chart widget instances (using existing reusable components)
  private consumptionWidget: ConsumptionWidgetInstance | null = null;
  private distributionWidget: DistributionChartInstance | null = null;

  // Unique IDs for this panel instance
  private readonly panelId: string;

  constructor(params: WaterPanelParams, controller: WaterPanelController) {
    this.params = params;
    this.controller = controller;
    this.panelId = `water-panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

    // Initialize charts after DOM is ready
    setTimeout(() => this.initializeCharts(), 0);

    return this.root;
  }

  private buildHTML(state: WaterPanelState): string {
    const { showCards = true, showConsumptionChart = true, showDistributionChart = true } = this.params;

    return `
      <div class="water-panel">
        ${showCards ? this.buildCardsHTML(state) : ''}
        ${showConsumptionChart ? this.buildConsumptionChartContainerHTML() : ''}
        ${showDistributionChart ? this.buildDistributionChartContainerHTML() : ''}
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
          <div class="water-panel__card-icon">&#x1F4A7;</div>
          <div class="water-panel__card-content">
            <div class="water-panel__card-label">Consumo Lojas</div>
            <div class="water-panel__card-value">${this.formatWater(storesValue)}</div>
            <div class="water-panel__card-trend">${storesPercent.toFixed(1)}% do total</div>
            <div class="water-panel__card-count">${summary?.deviceCount || 0} hidrometros</div>
          </div>
        </div>
        <div class="water-panel__card" data-type="common-area">
          <div class="water-panel__card-icon">&#x1F6BF;</div>
          <div class="water-panel__card-content">
            <div class="water-panel__card-label">Consumo Area Comum</div>
            <div class="water-panel__card-value">${this.formatWater(commonAreaValue)}</div>
            <div class="water-panel__card-trend">${commonAreaPercent.toFixed(1)}% do total</div>
            <div class="water-panel__card-count">Banheiros, limpeza, etc.</div>
          </div>
        </div>
        <div class="water-panel__card water-panel__card--total" data-type="total">
          <div class="water-panel__card-icon">&#x1F4CA;</div>
          <div class="water-panel__card-content">
            <div class="water-panel__card-label">Consumo Total</div>
            <div class="water-panel__card-value">${this.formatWater(totalValue)}</div>
            <div class="water-panel__card-trend">Lojas + Area Comum</div>
            <div class="water-panel__card-count">${summary?.deviceCount || 0} dispositivos</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Container for consumption chart widget (RFC-0098)
   * The createConsumptionChartWidget will inject its own HTML structure
   */
  private buildConsumptionChartContainerHTML(): string {
    return `
      <div class="water-panel__chart-section">
        <div id="${this.panelId}-consumption-chart" class="water-panel__consumption-chart"></div>
      </div>
    `;
  }

  /**
   * Container for distribution chart widget (RFC-0102)
   * The createDistributionChartWidget will inject its own HTML structure
   */
  private buildDistributionChartContainerHTML(): string {
    return `
      <div class="water-panel__chart-section">
        <div id="${this.panelId}-distribution-chart" class="water-panel__distribution-chart"></div>
      </div>
    `;
  }

  private formatWater(value: number): string {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} k m3`;
    }
    return `${value.toFixed(1)} m3`;
  }

  private bindEvents(): void {
    // Card events can be added here if needed
  }

  /**
   * Initialize chart widgets using the existing reusable components
   */
  private async initializeCharts(): Promise<void> {
    if (!this.root) return;

    const state = this.controller.getState();
    const { showConsumptionChart = true, showDistributionChart = true } = this.params;

    // Initialize Consumption Chart Widget (RFC-0098)
    if (showConsumptionChart) {
      await this.initializeConsumptionWidget(state);
    }

    // Initialize Distribution Chart Widget (RFC-0102)
    if (showDistributionChart) {
      await this.initializeDistributionWidget(state);
    }
  }

  /**
   * Initialize the consumption chart using createConsumptionChartWidget
   * This provides: settings modal, ideal range, viz modes, chart types
   */
  private async initializeConsumptionWidget(state: WaterPanelState): Promise<void> {
    const containerId = `${this.panelId}-consumption-chart`;
    const container = this.root?.querySelector(`#${containerId}`);
    if (!container) {
      console.warn('[WaterPanel] Consumption chart container not found');
      return;
    }

    try {
      this.consumptionWidget = createConsumptionChartWidget({
        domain: 'water',
        containerId: containerId,
        title: 'Consumo de Agua',
        unit: 'm3',
        unitLarge: 'k m3',
        thresholdForLargeUnit: 1000,
        theme: state.theme,
        defaultPeriod: state.period,
        defaultChartType: 'line',
        defaultVizMode: 'total',

        // Settings modal options
        showSettingsButton: true,
        showMaximizeButton: true,
        showVizModeTabs: true,
        showChartTypeTabs: true,
        chartHeight: 280,

        // Data fetching - use params callback or mock data
        fetchData: this.params.fetchConsumptionData || this.createMockFetchData(),

        // Callbacks
        onMaximizeClick: () => {
          this.params.onMaximizeClick?.();
        },

        onSettingsClick: () => {
          console.log('[WaterPanel] Settings clicked');
        },

        onDataLoaded: (data) => {
          console.log('[WaterPanel] Consumption data loaded:', data.labels?.length, 'days');
        },

        onError: (error) => {
          console.error('[WaterPanel] Consumption chart error:', error);
        },

        // Ideal range (from customer settings or orchestrator)
        idealRange: this.params.idealRange || undefined,

        // ThingsBoard container reference
        $container: this.params.$container,
      });

      await this.consumptionWidget.render();
      console.log('[WaterPanel] Consumption widget initialized');
    } catch (error) {
      console.error('[WaterPanel] Failed to initialize consumption widget:', error);
    }
  }

  /**
   * Initialize the distribution chart using createDistributionChartWidget
   * This provides: mode selector, horizontal bars, shopping colors
   */
  private async initializeDistributionWidget(state: WaterPanelState): Promise<void> {
    const containerId = `${this.panelId}-distribution-chart`;
    const container = this.root?.querySelector(`#${containerId}`);
    if (!container) {
      console.warn('[WaterPanel] Distribution chart container not found');
      return;
    }

    try {
      this.distributionWidget = createDistributionChartWidget({
        domain: 'water',
        containerId: containerId,
        title: 'Distribuicao de Consumo',
        unit: 'm3',
        unitLarge: 'k m3',
        thresholdForLargeUnit: 1000,
        theme: state.theme,
        chartHeight: 300,
        showHeader: true,
        showModeSelector: true,
        showSettingsButton: false,
        showMaximizeButton: false,
        defaultMode: 'groups',

        // Water-specific modes
        modes: [
          { value: 'groups', label: 'Lojas vs Area Comum' },
          { value: 'stores', label: 'Lojas por Shopping' },
          { value: 'common', label: 'Area Comum por Shopping' },
        ],

        // Data fetching
        fetchDistribution: this.params.fetchDistributionData || this.createMockFetchDistribution(),

        // Callbacks
        onModeChange: (mode) => {
          console.log('[WaterPanel] Distribution mode changed:', mode);
        },

        onDataLoaded: (data) => {
          console.log('[WaterPanel] Distribution data loaded:', Object.keys(data).length, 'categories');
        },

        onError: (error) => {
          console.error('[WaterPanel] Distribution chart error:', error);
        },

        // Get shopping colors from orchestrator
        getShoppingColors: () => {
          return (window as any).MyIOOrchestrator?.getShoppingColors?.() || null;
        },
      });

      await this.distributionWidget.render();
      console.log('[WaterPanel] Distribution widget initialized');
    } catch (error) {
      console.error('[WaterPanel] Failed to initialize distribution widget:', error);
    }
  }

  /**
   * Create mock data fetcher for showcase/demo purposes
   */
  private createMockFetchData(): (period: number) => Promise<Consumption7DaysData> {
    return async (period: number): Promise<Consumption7DaysData> => {
      const labels: string[] = [];
      const dailyTotals: number[] = [];
      const today = new Date();

      for (let i = period - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));

        // Generate realistic mock data for water (smaller values than energy)
        const baseValue = 50 + Math.random() * 50;
        const variation = (Math.random() - 0.5) * 20;
        dailyTotals.push(Math.max(10, baseValue + variation));
      }

      // Mock per-shopping data
      const shoppingData: Record<string, number[]> = {
        'shopping-1': dailyTotals.map(v => v * 0.35),
        'shopping-2': dailyTotals.map(v => v * 0.25),
        'shopping-3': dailyTotals.map(v => v * 0.25),
        'shopping-4': dailyTotals.map(v => v * 0.15),
      };

      const shoppingNames: Record<string, string> = {
        'shopping-1': 'Shopping Aricanduva',
        'shopping-2': 'Shopping Interlagos',
        'shopping-3': 'Shopping Tucuruvi',
        'shopping-4': 'Shopping Penha',
      };

      return {
        labels,
        dailyTotals,
        shoppingData,
        shoppingNames,
        fetchTimestamp: Date.now(),
      };
    };
  }

  /**
   * Create mock distribution data fetcher for showcase/demo purposes
   */
  private createMockFetchDistribution(): (mode: string) => Promise<DistributionData | null> {
    const state = this.controller.getState();
    const summary = state.summary;

    return async (mode: string): Promise<DistributionData | null> => {
      // Lojas vs Area Comum
      if (mode === 'groups') {
        const storesTotal = summary?.storesTotal || 850;
        const commonAreaTotal = summary?.commonAreaTotal || 650;
        return {
          'Lojas': storesTotal,
          'Area Comum': commonAreaTotal,
        };
      }

      // Lojas por Shopping
      if (mode === 'stores') {
        return {
          'Shopping Aricanduva': 180,
          'Shopping Interlagos': 150,
          'Shopping Tucuruvi': 140,
          'Shopping Penha': 120,
          'Shopping Tatuape': 110,
          'Shopping Santana': 100,
        };
      }

      // Area Comum por Shopping
      if (mode === 'common') {
        return {
          'Shopping Aricanduva': 150,
          'Shopping Interlagos': 130,
          'Shopping Tucuruvi': 120,
          'Shopping Penha': 100,
          'Shopping Tatuape': 90,
        };
      }

      return null;
    };
  }

  private onStateChange(state: WaterPanelState): void {
    if (!this.root) return;

    // Update theme
    this.root.setAttribute('data-theme', state.theme);

    // Update chart themes
    if (this.consumptionWidget) {
      this.consumptionWidget.setTheme(state.theme);
    }
    if (this.distributionWidget) {
      this.distributionWidget.setTheme(state.theme);
    }

    // Update cards
    this.updateCards(state);
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

  /**
   * Public method to refresh consumption chart data
   */
  async refreshConsumptionChart(): Promise<void> {
    if (this.consumptionWidget) {
      await this.consumptionWidget.refresh(true);
    }
  }

  /**
   * Public method to refresh distribution chart data
   */
  async refreshDistributionChart(): Promise<void> {
    if (this.distributionWidget) {
      await this.distributionWidget.refresh();
    }
  }

  /**
   * Public method to set ideal range on consumption chart
   */
  setIdealRange(range: { min: number; max: number; label?: string } | null): void {
    if (this.consumptionWidget) {
      this.consumptionWidget.setIdealRange(range ? {
        min: range.min,
        max: range.max,
        label: range.label,
        enabled: true,
      } : null);
    }
  }

  destroy(): void {
    // Destroy chart widgets
    if (this.consumptionWidget) {
      this.consumptionWidget.destroy();
      this.consumptionWidget = null;
    }
    if (this.distributionWidget) {
      this.distributionWidget.destroy();
      this.distributionWidget = null;
    }

    // Remove DOM
    this.root?.remove();
    this.root = null;
  }
}
