import { EnergyPanelController } from './EnergyPanelController';
import { EnergyPanelParams, EnergyPanelState, ChartType, VizMode } from './types';
import { injectEnergyPanelStyles } from './styles';

// Import existing chart components
import { createConsumptionChartWidget, type ConsumptionWidgetInstance } from '../Consumption7DaysChart/createConsumptionChartWidget';
import { createDistributionChartWidget } from '../DistributionChart/createDistributionChartWidget';
import type { Consumption7DaysData } from '../Consumption7DaysChart/types';
import type { DistributionData, DistributionChartInstance } from '../DistributionChart/types';

export class EnergyPanelView {
  private params: EnergyPanelParams;
  private controller: EnergyPanelController;
  private root: HTMLElement | null = null;

  // Chart widget instances (using existing reusable components)
  private consumptionWidget: ConsumptionWidgetInstance | null = null;
  private distributionWidget: DistributionChartInstance | null = null;

  // Unique IDs for this panel instance
  private readonly panelId: string;

  constructor(params: EnergyPanelParams, controller: EnergyPanelController) {
    this.params = params;
    this.controller = controller;
    this.panelId = `energy-panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

    // Initialize charts after DOM is ready
    setTimeout(() => this.initializeCharts(), 0);

    return this.root;
  }

  private buildHTML(state: EnergyPanelState): string {
    const { showCards = true, showConsumptionChart = true, showDistributionChart = true } = this.params;

    return `
      <div class="energy-panel">
        ${showCards ? this.buildCardsHTML(state) : ''}
        ${showConsumptionChart ? this.buildConsumptionChartContainerHTML() : ''}
        ${showDistributionChart ? this.buildDistributionChartContainerHTML() : ''}
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
          <div class="energy-panel__card-icon">&#127968;</div>
          <div class="energy-panel__card-content">
            <div class="energy-panel__card-label">Consumo Lojas</div>
            <div class="energy-panel__card-value">${this.formatEnergy(storesValue)}</div>
            <div class="energy-panel__card-count">${summary?.byCategory?.lojas?.count || 0} medidores</div>
          </div>
        </div>
        <div class="energy-panel__card" data-type="equipments">
          <div class="energy-panel__card-icon">&#x2699;&#xfe0f;</div>
          <div class="energy-panel__card-content">
            <div class="energy-panel__card-label">Consumo Equipamentos</div>
            <div class="energy-panel__card-value">${this.formatEnergy(equipmentsValue)}</div>
            <div class="energy-panel__card-count">${this.getEquipmentCount(summary)} equipamentos</div>
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
      <div class="energy-panel__chart-section">
        <div id="${this.panelId}-consumption-chart" class="energy-panel__consumption-chart"></div>
      </div>
    `;
  }

  /**
   * Container for distribution chart widget (RFC-0102)
   * The createDistributionChartWidget will inject its own HTML structure
   */
  private buildDistributionChartContainerHTML(): string {
    return `
      <div class="energy-panel__chart-section">
        <div id="${this.panelId}-distribution-chart" class="energy-panel__distribution-chart"></div>
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
    return (
      (climatizacao?.count || 0) + (elevadores?.count || 0) + (escadas?.count || 0) + (outros?.count || 0)
    );
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
  private async initializeConsumptionWidget(state: EnergyPanelState): Promise<void> {
    const containerId = `${this.panelId}-consumption-chart`;
    const container = this.root?.querySelector(`#${containerId}`);
    if (!container) {
      console.warn('[EnergyPanel] Consumption chart container not found');
      return;
    }

    try {
      this.consumptionWidget = createConsumptionChartWidget({
        domain: 'energy',
        containerId: containerId,
        title: 'Consumo de Energia',
        unit: 'kWh',
        unitLarge: 'MWh',
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
          console.log('[EnergyPanel] Settings clicked');
        },

        onDataLoaded: (data) => {
          console.log('[EnergyPanel] Consumption data loaded:', data.labels?.length, 'days');
        },

        onError: (error) => {
          console.error('[EnergyPanel] Consumption chart error:', error);
        },

        // Ideal range (from customer settings or orchestrator)
        idealRange: this.params.idealRange || undefined,

        // ThingsBoard container reference
        $container: this.params.$container,
      });

      await this.consumptionWidget.render();
      console.log('[EnergyPanel] Consumption widget initialized');
    } catch (error) {
      console.error('[EnergyPanel] Failed to initialize consumption widget:', error);
    }
  }

  /**
   * Initialize the distribution chart using createDistributionChartWidget
   * This provides: mode selector, horizontal bars, shopping colors
   */
  private async initializeDistributionWidget(state: EnergyPanelState): Promise<void> {
    const containerId = `${this.panelId}-distribution-chart`;
    const container = this.root?.querySelector(`#${containerId}`);
    if (!container) {
      console.warn('[EnergyPanel] Distribution chart container not found');
      return;
    }

    try {
      this.distributionWidget = createDistributionChartWidget({
        domain: 'energy',
        containerId: containerId,
        title: 'Distribuicao de Consumo',
        unit: 'kWh',
        unitLarge: 'MWh',
        thresholdForLargeUnit: 1000,
        theme: state.theme,
        chartHeight: 300,
        showHeader: true,
        showModeSelector: true,
        showSettingsButton: false,
        showMaximizeButton: false,
        defaultMode: 'groups',

        // Energy-specific modes
        modes: [
          { value: 'groups', label: 'Por Grupos de Equipamentos' },
          { value: 'elevators', label: 'Elevadores por Shopping' },
          { value: 'escalators', label: 'Escadas Rolantes por Shopping' },
          { value: 'hvac', label: 'Climatizacao por Shopping' },
          { value: 'others', label: 'Outros Equipamentos por Shopping' },
          { value: 'stores', label: 'Lojas por Shopping' },
        ],

        // Data fetching
        fetchDistribution: this.params.fetchDistributionData || this.createMockFetchDistribution(),

        // Callbacks
        onModeChange: (mode) => {
          console.log('[EnergyPanel] Distribution mode changed:', mode);
        },

        onDataLoaded: (data) => {
          console.log('[EnergyPanel] Distribution data loaded:', Object.keys(data).length, 'categories');
        },

        onError: (error) => {
          console.error('[EnergyPanel] Distribution chart error:', error);
        },

        // Get shopping colors from orchestrator
        getShoppingColors: () => {
          return (window as any).MyIOOrchestrator?.getShoppingColors?.() || null;
        },
      });

      await this.distributionWidget.render();
      console.log('[EnergyPanel] Distribution widget initialized');
    } catch (error) {
      console.error('[EnergyPanel] Failed to initialize distribution widget:', error);
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

        // Generate realistic mock data
        const baseValue = 500 + Math.random() * 500;
        const variation = (Math.random() - 0.5) * 200;
        dailyTotals.push(Math.max(100, baseValue + variation));
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
      // Por Grupos de Equipamentos
      if (mode === 'groups') {
        if (summary?.byCategory) {
          return {
            'Lojas': summary.byCategory.lojas?.total || 0,
            'Climatizacao': summary.byCategory.climatizacao?.total || 0,
            'Elevadores': summary.byCategory.elevadores?.total || 0,
            'Escadas Rolantes': summary.byCategory.escadas?.total || 0,
            'Outros': summary.byCategory.outros?.total || 0,
          };
        }
        // Mock data
        return {
          'Lojas': 12500,
          'Climatizacao': 8500,
          'Elevadores': 3200,
          'Escadas Rolantes': 2100,
          'Outros': 1800,
        };
      }

      // Elevadores por Shopping
      if (mode === 'elevators') {
        return {
          'Shopping Aricanduva': 2400,
          'Shopping Interlagos': 1800,
          'Shopping Tucuruvi': 1500,
          'Shopping Penha': 1200,
          'Shopping Tatuape': 900,
        };
      }

      // Escadas Rolantes por Shopping
      if (mode === 'escalators') {
        return {
          'Shopping Aricanduva': 1800,
          'Shopping Interlagos': 1400,
          'Shopping Tucuruvi': 1100,
          'Shopping Penha': 800,
        };
      }

      // Climatizacao por Shopping
      if (mode === 'hvac') {
        return {
          'Shopping Aricanduva': 5200,
          'Shopping Interlagos': 4100,
          'Shopping Tucuruvi': 3800,
          'Shopping Penha': 3200,
          'Shopping Tatuape': 2800,
          'Shopping Santana': 2400,
        };
      }

      // Outros Equipamentos por Shopping
      if (mode === 'others') {
        return {
          'Shopping Aricanduva': 1200,
          'Shopping Interlagos': 900,
          'Shopping Tucuruvi': 700,
        };
      }

      // Lojas por Shopping
      if (mode === 'stores') {
        return {
          'Shopping Aricanduva': 8500,
          'Shopping Interlagos': 7200,
          'Shopping Tucuruvi': 6800,
          'Shopping Penha': 5500,
          'Shopping Tatuape': 5100,
          'Shopping Santana': 4800,
          'Shopping Campo Limpo': 4200,
        };
      }

      return null;
    };
  }

  private onStateChange(state: EnergyPanelState): void {
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
