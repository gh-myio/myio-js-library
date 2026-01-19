/**
 * RFC-0148: TelemetryInfoShopping View
 * Renders category cards and pie chart
 */

import {
  TelemetryDomain,
  ThemeMode,
  EnergySummary,
  WaterSummary,
  EnergyState,
  WaterState,
  TelemetryInfoShoppingParams,
  ChartColors,
  DEFAULT_CHART_COLORS,
  ENERGY_CATEGORY_CONFIG,
  WATER_CATEGORY_CONFIG,
  formatEnergy,
  formatWater,
  formatPercentage,
  CategoryType,
} from './types';
import { injectStyles } from './styles';

// Chart.js type (loaded externally)
type ChartInstance = {
  data: { labels: string[]; datasets: { data: number[]; backgroundColor: string[] }[] };
  update: () => void;
  destroy: () => void;
};

type ChartConstructor = new (
  ctx: CanvasRenderingContext2D,
  config: {
    type: string;
    data: { labels: string[]; datasets: { data: number[]; backgroundColor: string[]; borderWidth?: number }[] };
    options: Record<string, unknown>;
  }
) => ChartInstance;

export class TelemetryInfoShoppingView {
  private root: HTMLElement;
  private params: TelemetryInfoShoppingParams;
  private domain: TelemetryDomain;
  private themeMode: ThemeMode;
  private debugActive: boolean;
  private chartColors: ChartColors;

  // State
  private energyState: EnergyState | null = null;
  private waterState: WaterState | null = null;

  // Chart instances
  private mainChart: ChartInstance | null = null;
  private modalChart: ChartInstance | null = null;
  private modalOpen = false;

  // DOM references
  private modalEl: HTMLElement | null = null;

  constructor(params: TelemetryInfoShoppingParams) {
    this.params = params;
    this.domain = params.domain;
    this.themeMode = params.themeMode || 'light';
    this.debugActive = params.debugActive || false;
    this.chartColors = { ...DEFAULT_CHART_COLORS, ...params.chartColors };
    this.root = this.createRoot();
  }

  private log(...args: unknown[]): void {
    if (this.debugActive) {
      console.log('[TelemetryInfoShoppingView]', ...args);
    }
  }

  // =========================================================================
  // Render
  // =========================================================================

  render(): HTMLElement {
    injectStyles(this.root);
    this.root.innerHTML = this.buildHTML();
    this.cacheElements();
    this.bindEvents();
    this.initCharts();
    return this.root;
  }

  private createRoot(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'telemetry-info-root';
    root.setAttribute('data-theme', this.themeMode);
    root.setAttribute('data-domain', this.domain);
    return root;
  }

  private buildHTML(): string {
    const title = this.params.labelWidget ||
      (this.domain === 'energy' ? 'Informações de Energia' : 'Informações de Água');

    return `
      <header class="info-header">
        <h2 class="info-title" id="infoTitleHeader">${title}</h2>
        ${this.params.showExpandButton !== false ? `
        <button class="btn-expand" id="btnExpandModal" title="Expandir visualização">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </button>
        ` : ''}
      </header>

      <div class="info-grid" id="infoGrid">
        ${this.domain === 'energy' ? this.buildEnergyCards() : this.buildWaterCards()}
        ${this.params.showChart !== false ? this.buildChartCard() : ''}
      </div>

      ${this.buildModalHTML()}
    `;
  }

  private buildEnergyCards(): string {
    const config = ENERGY_CATEGORY_CONFIG;

    return `
      <!-- ROW 1: Entrada + Lojas -->
      <div class="info-card entrada-card" data-category="entrada">
        <div class="card-header">
          <span class="card-icon">${config.entrada.icon}</span>
          <h3 class="card-title">${config.entrada.label}</h3>
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="entradaTotal">0,00 kWh</span>
          </div>
        </div>
      </div>

      <div class="info-card lojas-card" data-category="lojas">
        <div class="card-header">
          <span class="card-icon">${config.lojas.icon}</span>
          <h3 class="card-title">${config.lojas.label}</h3>
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="lojasTotal">0,00 kWh</span>
            <span class="stat-perc" id="lojasPerc">(0%)</span>
          </div>
        </div>
      </div>

      <!-- ROW 2: Climatização + Elevadores -->
      <div class="info-card climatizacao-card" data-category="climatizacao">
        <div class="card-header">
          <span class="card-icon">${config.climatizacao.icon}</span>
          <h3 class="card-title">${config.climatizacao.label}</h3>
          ${config.climatizacao.tooltip ? `<span class="info-tooltip" title="${config.climatizacao.tooltip}">ℹ️</span>` : ''}
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="climatizacaoTotal">0,00 kWh</span>
            <span class="stat-perc" id="climatizacaoPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="info-card elevadores-card" data-category="elevadores">
        <div class="card-header">
          <span class="card-icon">${config.elevadores.icon}</span>
          <h3 class="card-title">${config.elevadores.label}</h3>
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="elevadoresTotal">0,00 kWh</span>
            <span class="stat-perc" id="elevadoresPerc">(0%)</span>
          </div>
        </div>
      </div>

      <!-- ROW 3: Esc. Rolantes + Outros -->
      <div class="info-card escadas-card" data-category="escadasRolantes">
        <div class="card-header">
          <span class="card-icon">${config.escadasRolantes.icon}</span>
          <h3 class="card-title">${config.escadasRolantes.label}</h3>
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="escadasRolantesTotal">0,00 kWh</span>
            <span class="stat-perc" id="escadasRolantesPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="info-card outros-card" data-category="outros">
        <div class="card-header">
          <span class="card-icon">${config.outros.icon}</span>
          <h3 class="card-title">${config.outros.label}</h3>
          ${config.outros.tooltip ? `<span class="info-tooltip" title="${config.outros.tooltip}">ℹ️</span>` : ''}
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="outrosTotal">0,00 kWh</span>
            <span class="stat-perc" id="outrosPerc">(0%)</span>
          </div>
        </div>
      </div>

      <!-- ROW 4: Área Comum + Total -->
      <div class="info-card area-comum-card" data-category="areaComum">
        <div class="card-header">
          <span class="card-icon">${config.areaComum.icon}</span>
          <h3 class="card-title">${config.areaComum.label}</h3>
          ${config.areaComum.tooltip ? `<span class="info-tooltip" title="${config.areaComum.tooltip}">ℹ️</span>` : ''}
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="areaComumTotal">0,00 kWh</span>
            <span class="stat-perc" id="areaComumPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="info-card total-card" data-category="total">
        <div class="card-header">
          <span class="card-icon">📊</span>
          <h3 class="card-title">Total Consumidores</h3>
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="consumidoresTotal">0,00 kWh</span>
            <span class="stat-perc" id="consumidoresPerc">(100%)</span>
          </div>
        </div>
      </div>
    `;
  }

  private buildWaterCards(): string {
    const config = WATER_CATEGORY_CONFIG;

    return `
      <!-- ROW 1: Entrada + Lojas -->
      <div class="info-card entrada-card" data-category="entrada">
        <div class="card-header">
          <span class="card-icon">${config.entrada.icon}</span>
          <h3 class="card-title">${config.entrada.label}</h3>
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="entradaTotal">0,000 m³</span>
          </div>
        </div>
      </div>

      <div class="info-card lojas-card" data-category="lojas">
        <div class="card-header">
          <span class="card-icon">${config.lojas.icon}</span>
          <h3 class="card-title">${config.lojas.label}</h3>
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="lojasTotal">0,000 m³</span>
            <span class="stat-perc" id="lojasPerc">(0%)</span>
          </div>
        </div>
      </div>

      <!-- ROW 2: Banheiros + Área Comum -->
      <div class="info-card banheiros-card" data-category="banheiros">
        <div class="card-header">
          <span class="card-icon">${config.banheiros.icon}</span>
          <h3 class="card-title">${config.banheiros.label}</h3>
          ${config.banheiros.tooltip ? `<span class="info-tooltip" title="${config.banheiros.tooltip}">ℹ️</span>` : ''}
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="banheirosTotal">0,000 m³</span>
            <span class="stat-perc" id="banheirosPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="info-card area-comum-card" data-category="areaComum">
        <div class="card-header">
          <span class="card-icon">${config.areaComum.icon}</span>
          <h3 class="card-title">${config.areaComum.label}</h3>
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="areaComumTotal">0,000 m³</span>
            <span class="stat-perc" id="areaComumPerc">(0%)</span>
          </div>
        </div>
      </div>

      <!-- ROW 3: Pontos Não Mapeados + Total -->
      <div class="info-card nao-mapeados-card" data-category="pontosNaoMapeados">
        <div class="card-header">
          <span class="card-icon">${config.pontosNaoMapeados.icon}</span>
          <h3 class="card-title">${config.pontosNaoMapeados.label}</h3>
          ${config.pontosNaoMapeados.tooltip ? `<span class="info-tooltip" title="${config.pontosNaoMapeados.tooltip}">ℹ️</span>` : ''}
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="pontosNaoMapeadosTotal">0,000 m³</span>
            <span class="stat-perc" id="pontosNaoMapeadosPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="info-card total-card" data-category="total">
        <div class="card-header">
          <span class="card-icon">📊</span>
          <h3 class="card-title">Total</h3>
        </div>
        <div class="card-body">
          <div class="stat-row main-stat">
            <span class="stat-value" id="consumidoresTotal">0,000 m³</span>
            <span class="stat-perc" id="consumidoresPerc">(100%)</span>
          </div>
        </div>
      </div>
    `;
  }

  private buildChartCard(): string {
    return `
      <div class="info-card chart-card">
        <div class="card-header">
          <h3 class="card-title">Distribuição de Consumo</h3>
        </div>
        <div class="card-body">
          <div class="chart-container">
            <canvas id="consumptionPieChart"></canvas>
          </div>
          <div class="chart-legend" id="chartLegend"></div>
        </div>
      </div>
    `;
  }

  private buildModalHTML(): string {
    const title = this.domain === 'energy'
      ? 'Distribuição de Consumo de Energia'
      : 'Distribuição de Consumo de Água';

    return `
      <div class="modal-overlay hidden" id="modalExpanded">
        <div class="modal-container">
          <button class="btn-close-floating" id="btnCloseModal" title="Fechar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <div class="modal-body-clean">
            <h2 class="modal-title-clean" id="modalTitleHeader">${title}</h2>

            <div class="modal-chart-inner-container">
              <div class="modal-chart-wrapper">
                <canvas id="modalConsumptionPieChart"></canvas>
              </div>
            </div>

            <div class="modal-legend-clean" id="modalChartLegend"></div>
          </div>
        </div>
      </div>
    `;
  }

  private cacheElements(): void {
    this.modalEl = this.root.querySelector('#modalExpanded');
  }

  private bindEvents(): void {
    // Expand button
    const btnExpand = this.root.querySelector('#btnExpandModal');
    btnExpand?.addEventListener('click', () => this.openModal());

    // Close modal
    const btnClose = this.root.querySelector('#btnCloseModal');
    btnClose?.addEventListener('click', () => this.closeModal());

    // Modal backdrop click
    this.modalEl?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
        this.closeModal();
      }
    });

    // Category cards click
    this.root.querySelectorAll('.info-card[data-category]').forEach((card) => {
      card.addEventListener('click', () => {
        const category = (card as HTMLElement).dataset.category as CategoryType;
        this.params.onCategoryClick?.(category);
      });
    });
  }

  // =========================================================================
  // Charts
  // =========================================================================

  private initCharts(): void {
    const Chart = (window as unknown as { Chart?: ChartConstructor }).Chart;
    if (!Chart) {
      this.log('Chart.js not available');
      return;
    }

    // Main chart
    const mainCanvas = this.root.querySelector('#consumptionPieChart') as HTMLCanvasElement;
    if (mainCanvas) {
      const ctx = mainCanvas.getContext('2d');
      if (ctx) {
        this.mainChart = new Chart(ctx, {
          type: 'pie',
          data: {
            labels: [],
            datasets: [{
              data: [],
              backgroundColor: [],
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context: { label: string; parsed: number }) => {
                    const formatter = this.domain === 'energy' ? formatEnergy : formatWater;
                    return `${context.label}: ${formatter(context.parsed)}`;
                  },
                },
              },
            },
          },
        });
      }
    }
  }

  private initModalChart(): void {
    const Chart = (window as unknown as { Chart?: ChartConstructor }).Chart;
    if (!Chart) return;

    const modalCanvas = this.root.querySelector('#modalConsumptionPieChart') as HTMLCanvasElement;
    if (modalCanvas && !this.modalChart) {
      const ctx = modalCanvas.getContext('2d');
      if (ctx) {
        this.modalChart = new Chart(ctx, {
          type: 'pie',
          data: {
            labels: [],
            datasets: [{
              data: [],
              backgroundColor: [],
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context: { label: string; parsed: number }) => {
                    const formatter = this.domain === 'energy' ? formatEnergy : formatWater;
                    return `${context.label}: ${formatter(context.parsed)}`;
                  },
                },
              },
            },
          },
        });
      }
    }
  }

  refreshChart(): void {
    const chartData = this.getChartData();

    if (this.mainChart) {
      this.mainChart.data.labels = chartData.labels;
      this.mainChart.data.datasets[0].data = chartData.values;
      this.mainChart.data.datasets[0].backgroundColor = chartData.colors;
      this.mainChart.update();
    }

    if (this.modalChart) {
      this.modalChart.data.labels = chartData.labels;
      this.modalChart.data.datasets[0].data = chartData.values;
      this.modalChart.data.datasets[0].backgroundColor = chartData.colors;
      this.modalChart.update();
    }

    // Update legends
    this.updateLegend('chartLegend', chartData);
    this.updateLegend('modalChartLegend', chartData);
  }

  private getChartData(): { labels: string[]; values: number[]; colors: string[] } {
    const labels: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];

    if (this.domain === 'energy' && this.energyState) {
      const state = this.energyState;
      const categories = [
        { key: 'climatizacao', data: state.consumidores.climatizacao },
        { key: 'elevadores', data: state.consumidores.elevadores },
        { key: 'escadasRolantes', data: state.consumidores.escadasRolantes },
        { key: 'lojas', data: state.consumidores.lojas },
        { key: 'outros', data: state.consumidores.outros },
        { key: 'areaComum', data: state.consumidores.areaComum },
      ] as const;

      categories.forEach(({ key, data }) => {
        if (data.total > 0) {
          const config = ENERGY_CATEGORY_CONFIG[key];
          labels.push(config.label);
          values.push(data.total);
          colors.push(this.chartColors[key]);
        }
      });
    } else if (this.domain === 'water' && this.waterState) {
      const state = this.waterState;
      const categories = [
        { key: 'lojas' as const, data: state.lojas },
        { key: 'banheiros' as const, data: state.banheiros },
        { key: 'areaComum' as const, data: state.areaComum },
        { key: 'pontosNaoMapeados' as const, data: state.pontosNaoMapeados },
      ];

      categories.forEach(({ key, data }) => {
        if (data.total > 0) {
          const config = WATER_CATEGORY_CONFIG[key];
          labels.push(config.label);
          values.push(data.total);
          colors.push(this.chartColors[key]);
        }
      });
    }

    return { labels, values, colors };
  }

  private updateLegend(elementId: string, chartData: { labels: string[]; values: number[]; colors: string[] }): void {
    const legendEl = this.root.querySelector(`#${elementId}`);
    if (!legendEl) return;

    const formatter = this.domain === 'energy' ? formatEnergy : formatWater;

    legendEl.innerHTML = chartData.labels.map((label, i) => `
      <div class="legend-item">
        <span class="legend-color" style="background-color: ${chartData.colors[i]}"></span>
        <span class="legend-label">${label}</span>
        <span class="legend-value">${formatter(chartData.values[i])}</span>
      </div>
    `).join('');
  }

  // =========================================================================
  // Data Methods
  // =========================================================================

  setEnergyData(summary: EnergySummary): void {
    this.log('setEnergyData:', summary);

    const entrada = summary.entrada?.total || 0;
    const lojas = summary.lojas?.total || 0;
    const climatizacao = summary.climatizacao?.total || 0;
    const elevadores = summary.elevadores?.total || 0;
    const escadasRolantes = summary.escadasRolantes?.total || 0;
    const outros = summary.outros?.total || 0;

    const totalConsumidores = lojas + climatizacao + elevadores + escadasRolantes + outros;
    const areaComum = Math.max(0, entrada - totalConsumidores);

    const calcPerc = (val: number) => entrada > 0 ? (val / entrada) * 100 : 0;

    this.energyState = {
      entrada: { total: entrada, perc: 100 },
      consumidores: {
        climatizacao: { total: climatizacao, perc: calcPerc(climatizacao) },
        elevadores: { total: elevadores, perc: calcPerc(elevadores) },
        escadasRolantes: { total: escadasRolantes, perc: calcPerc(escadasRolantes) },
        lojas: { total: lojas, perc: calcPerc(lojas) },
        outros: { total: outros, perc: calcPerc(outros) },
        areaComum: { total: areaComum, perc: calcPerc(areaComum) },
        totalGeral: totalConsumidores + areaComum,
      },
      grandTotal: entrada,
    };

    this.updateEnergyUI();
    this.refreshChart();
  }

  private updateEnergyUI(): void {
    if (!this.energyState) return;

    const state = this.energyState;

    this.updateElement('#entradaTotal', formatEnergy(state.entrada.total));
    this.updateElement('#lojasTotal', formatEnergy(state.consumidores.lojas.total));
    this.updateElement('#lojasPerc', `(${formatPercentage(state.consumidores.lojas.perc)})`);
    this.updateElement('#climatizacaoTotal', formatEnergy(state.consumidores.climatizacao.total));
    this.updateElement('#climatizacaoPerc', `(${formatPercentage(state.consumidores.climatizacao.perc)})`);
    this.updateElement('#elevadoresTotal', formatEnergy(state.consumidores.elevadores.total));
    this.updateElement('#elevadoresPerc', `(${formatPercentage(state.consumidores.elevadores.perc)})`);
    this.updateElement('#escadasRolantesTotal', formatEnergy(state.consumidores.escadasRolantes.total));
    this.updateElement('#escadasRolantesPerc', `(${formatPercentage(state.consumidores.escadasRolantes.perc)})`);
    this.updateElement('#outrosTotal', formatEnergy(state.consumidores.outros.total));
    this.updateElement('#outrosPerc', `(${formatPercentage(state.consumidores.outros.perc)})`);
    this.updateElement('#areaComumTotal', formatEnergy(state.consumidores.areaComum.total));
    this.updateElement('#areaComumPerc', `(${formatPercentage(state.consumidores.areaComum.perc)})`);
    this.updateElement('#consumidoresTotal', formatEnergy(state.consumidores.totalGeral));
  }

  setWaterData(summary: WaterSummary): void {
    this.log('setWaterData:', summary);

    const entrada = summary.entrada?.total || 0;
    const lojas = summary.lojas?.total || 0;
    const banheiros = summary.banheiros?.total || 0;
    const areaComum = summary.areaComum?.total || 0;

    const totalMapeado = lojas + banheiros + areaComum;
    const pontosNaoMapeados = Math.max(0, entrada - totalMapeado);
    const hasInconsistency = pontosNaoMapeados < 0;

    const calcPerc = (val: number) => entrada > 0 ? (val / entrada) * 100 : 0;

    this.waterState = {
      entrada: { total: entrada, perc: 100 },
      lojas: { total: lojas, perc: calcPerc(lojas) },
      banheiros: { total: banheiros, perc: calcPerc(banheiros) },
      areaComum: { total: areaComum, perc: calcPerc(areaComum) },
      pontosNaoMapeados: {
        total: pontosNaoMapeados,
        perc: calcPerc(pontosNaoMapeados),
        hasInconsistency,
      },
      grandTotal: entrada,
    };

    this.updateWaterUI();
    this.refreshChart();
  }

  private updateWaterUI(): void {
    if (!this.waterState) return;

    const state = this.waterState;

    this.updateElement('#entradaTotal', formatWater(state.entrada.total));
    this.updateElement('#lojasTotal', formatWater(state.lojas.total));
    this.updateElement('#lojasPerc', `(${formatPercentage(state.lojas.perc)})`);
    this.updateElement('#banheirosTotal', formatWater(state.banheiros.total));
    this.updateElement('#banheirosPerc', `(${formatPercentage(state.banheiros.perc)})`);
    this.updateElement('#areaComumTotal', formatWater(state.areaComum.total));
    this.updateElement('#areaComumPerc', `(${formatPercentage(state.areaComum.perc)})`);
    this.updateElement('#pontosNaoMapeadosTotal', formatWater(state.pontosNaoMapeados.total));
    this.updateElement('#pontosNaoMapeadosPerc', `(${formatPercentage(state.pontosNaoMapeados.perc)})`);
    this.updateElement('#consumidoresTotal', formatWater(state.grandTotal));
  }

  private updateElement(selector: string, value: string): void {
    const el = this.root.querySelector(selector);
    if (el) {
      el.textContent = value;
    }
  }

  clearData(): void {
    this.energyState = null;
    this.waterState = null;

    // Reset all values to zero
    this.root.querySelectorAll('.stat-value').forEach((el) => {
      const isWater = this.domain === 'water';
      el.textContent = isWater ? '0,000 m³' : '0,00 kWh';
    });
    this.root.querySelectorAll('.stat-perc').forEach((el) => {
      el.textContent = '(0%)';
    });

    this.refreshChart();
  }

  getState(): EnergyState | WaterState | null {
    return this.domain === 'energy' ? this.energyState : this.waterState;
  }

  // =========================================================================
  // Modal
  // =========================================================================

  openModal(): void {
    this.log('openModal');
    this.modalOpen = true;
    this.modalEl?.classList.remove('hidden');
    document.body.classList.add('modal-open-telemetry-info');

    // Initialize modal chart if not already
    this.initModalChart();
    this.refreshChart();

    this.params.onExpandClick?.();
  }

  closeModal(): void {
    this.log('closeModal');
    this.modalOpen = false;
    this.modalEl?.classList.add('hidden');
    document.body.classList.remove('modal-open-telemetry-info');
  }

  isModalOpen(): boolean {
    return this.modalOpen;
  }

  // =========================================================================
  // Public Methods
  // =========================================================================

  setDomain(domain: TelemetryDomain): void {
    if (domain !== this.domain) {
      this.domain = domain;
      this.root.setAttribute('data-domain', domain);

      // Re-render the grid with new domain cards
      const gridEl = this.root.querySelector('#infoGrid');
      if (gridEl) {
        gridEl.innerHTML = (domain === 'energy' ? this.buildEnergyCards() : this.buildWaterCards()) +
          (this.params.showChart !== false ? this.buildChartCard() : '');
      }

      // Re-bind events for new cards
      this.bindEvents();
      this.initCharts();

      // Update modal title
      const modalTitle = this.root.querySelector('#modalTitleHeader');
      if (modalTitle) {
        modalTitle.textContent = domain === 'energy'
          ? 'Distribuição de Consumo de Energia'
          : 'Distribuição de Consumo de Água';
      }
    }
  }

  getDomain(): TelemetryDomain {
    return this.domain;
  }

  setThemeMode(mode: ThemeMode): void {
    this.themeMode = mode;
    this.root.setAttribute('data-theme', mode);
  }

  setLabel(label: string): void {
    const titleEl = this.root.querySelector('#infoTitleHeader');
    if (titleEl) {
      titleEl.textContent = label;
    }
  }

  destroy(): void {
    this.log('destroy');
    this.mainChart?.destroy();
    this.modalChart?.destroy();
    this.closeModal();
    this.root.remove();
  }

  getElement(): HTMLElement {
    return this.root;
  }
}
