/**
 * RFC-0148: TelemetryInfoShopping View
 * Renders category cards and pie chart
 * All class names use tis- prefix to avoid conflicts
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
  FilterGroup,
} from './types';
import { injectStyles } from './styles';

// Chart.js type (loaded externally)
type ChartInstance = {
  data: {
    labels: string[];
    datasets: {
      data: number[];
      backgroundColor: string[];
      borderColor?: string[];
      borderWidth?: number | number[];
    }[];
  };
  update: () => void;
  destroy: () => void;
};

type ChartConstructor = new (
  ctx: CanvasRenderingContext2D,
  config: {
    type: string;
    data: {
      labels: string[];
      datasets: {
        data: number[];
        backgroundColor: string[];
        borderColor?: string[];
        borderWidth?: number | number[];
      }[];
    };
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
  private chartInitRetries = 0;
  private maxChartInitRetries = 10;

  // DOM references
  private modalEl: HTMLElement | null = null;
  private maximizeBtnEl: HTMLElement | null = null;

  // Maximize state
  private isMaximized = false;
  private originalParent: HTMLElement | null = null;
  private originalNextSibling: Node | null = null;

  // RFC-0196 — last group activated by a slice click (null when no
  // active filter). Used for the toggle behaviour: clicking the same
  // slice twice clears the filter.
  private activeSliceGroup: FilterGroup | null = null;
  // Parallel arrays shared between the main chart and the click handler
  // (rebuilt on every refreshChart).
  private chartGroups: FilterGroup[] = [];

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
    this.renderMaximizeButton();
    // Defer chart init to ensure container has dimensions
    // Use longer delay to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.log('Starting chart initialization after render...');
        this.initCharts();
      }, 300);
    });
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
    const title =
      this.params.labelWidget ||
      (this.domain === 'energy' ? 'Informações de Energia' : 'Informações de Água');

    return `
      <header class="tis-header">
        <h2 class="tis-title" id="infoTitleHeader">${title}</h2>
        ${
          this.params.showExpandButton !== false
            ? `
        <button class="tis-btn-expand" id="btnExpandModal" title="Expandir visualização">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </button>
        `
            : ''
        }
      </header>

      <div class="tis-grid" id="infoGrid">
        ${this.domain === 'energy' ? this.buildEnergyCards() : this.buildWaterCards()}
        ${this.params.showChart !== false ? this.buildChartCard() : ''}
      </div>

      ${this.buildModalHTML()}
    `;
  }

  private buildEnergyCards(): string {
    const config = ENERGY_CATEGORY_CONFIG;

    return `
      <div class="tis-card tis-entrada-card" data-category="entrada">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.entrada.icon}</span>
          <h3 class="tis-card-title">${config.entrada.label}</h3>
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="entradaTotal">0,00 kWh</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-lojas-card" data-category="lojas">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.lojas.icon}</span>
          <h3 class="tis-card-title">${config.lojas.label}</h3>
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="lojasTotal">0,00 kWh</span>
            <span class="tis-stat-perc" id="lojasPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-climatizacao-card" data-category="climatizacao">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.climatizacao.icon}</span>
          <h3 class="tis-card-title">${config.climatizacao.label}</h3>
          ${
            config.climatizacao.tooltip
              ? `<span class="tis-tooltip" title="${config.climatizacao.tooltip}">ℹ️</span>`
              : ''
          }
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="climatizacaoTotal">0,00 kWh</span>
            <span class="tis-stat-perc" id="climatizacaoPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-elevadores-card" data-category="elevadores">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.elevadores.icon}</span>
          <h3 class="tis-card-title">${config.elevadores.label}</h3>
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="elevadoresTotal">0,00 kWh</span>
            <span class="tis-stat-perc" id="elevadoresPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-escadas-card" data-category="escadasRolantes">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.escadasRolantes.icon}</span>
          <h3 class="tis-card-title">${config.escadasRolantes.label}</h3>
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="escadasRolantesTotal">0,00 kWh</span>
            <span class="tis-stat-perc" id="escadasRolantesPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-outros-card" data-category="outros">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.outros.icon}</span>
          <h3 class="tis-card-title">${config.outros.label}</h3>
          ${
            config.outros.tooltip
              ? `<span class="tis-tooltip" title="${config.outros.tooltip}">ℹ️</span>`
              : ''
          }
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="outrosTotal">0,00 kWh</span>
            <span class="tis-stat-perc" id="outrosPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-area-comum-card" data-category="areaComum">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.areaComum.icon}</span>
          <h3 class="tis-card-title">${config.areaComum.label}</h3>
          ${
            config.areaComum.tooltip
              ? `<span class="tis-tooltip" title="${config.areaComum.tooltip}">ℹ️</span>`
              : ''
          }
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="areaComumTotal">0,00 kWh</span>
            <span class="tis-stat-perc" id="areaComumPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-erro-card" data-category="erro">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.erro.icon}</span>
          <h3 class="tis-card-title">${config.erro.label}</h3>
          ${
            config.erro.tooltip
              ? `<span class="tis-tooltip" title="${config.erro.tooltip}">ℹ️</span>`
              : ''
          }
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="erroTotal">—</span>
            <span class="tis-stat-perc" id="erroPerc"></span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-total-card" data-category="total">
        <div class="tis-card-header">
          <span class="tis-card-icon">📊</span>
          <h3 class="tis-card-title">Total Consumidores</h3>
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="consumidoresTotal">0,00 kWh</span>
            <span class="tis-stat-perc" id="consumidoresPerc">(100%)</span>
          </div>
        </div>
      </div>
    `;
  }

  private buildWaterCards(): string {
    const config = WATER_CATEGORY_CONFIG;

    return `
      <div class="tis-card tis-entrada-card" data-category="entrada">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.entrada.icon}</span>
          <h3 class="tis-card-title">${config.entrada.label}</h3>
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="entradaTotal">0,000 m³</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-lojas-card" data-category="lojas">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.lojas.icon}</span>
          <h3 class="tis-card-title">${config.lojas.label}</h3>
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="lojasTotal">0,000 m³</span>
            <span class="tis-stat-perc" id="lojasPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-banheiros-card" data-category="banheiros">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.banheiros.icon}</span>
          <h3 class="tis-card-title">${config.banheiros.label}</h3>
          ${
            config.banheiros.tooltip
              ? `<span class="tis-tooltip" title="${config.banheiros.tooltip}">ℹ️</span>`
              : ''
          }
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="banheirosTotal">0,000 m³</span>
            <span class="tis-stat-perc" id="banheirosPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-area-comum-card" data-category="areaComum">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.areaComum.icon}</span>
          <h3 class="tis-card-title">${config.areaComum.label}</h3>
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="areaComumTotal">0,000 m³</span>
            <span class="tis-stat-perc" id="areaComumPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-nao-mapeados-card" data-category="pontosNaoMapeados">
        <div class="tis-card-header">
          <span class="tis-card-icon">${config.pontosNaoMapeados.icon}</span>
          <h3 class="tis-card-title">${config.pontosNaoMapeados.label}</h3>
          ${
            config.pontosNaoMapeados.tooltip
              ? `<span class="tis-tooltip" title="${config.pontosNaoMapeados.tooltip}">ℹ️</span>`
              : ''
          }
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="pontosNaoMapeadosTotal">0,000 m³</span>
            <span class="tis-stat-perc" id="pontosNaoMapeadosPerc">(0%)</span>
          </div>
        </div>
      </div>

      <div class="tis-card tis-total-card" data-category="total">
        <div class="tis-card-header">
          <span class="tis-card-icon">📊</span>
          <h3 class="tis-card-title">Total</h3>
        </div>
        <div class="tis-card-body">
          <div class="tis-stat-row tis-main-stat">
            <span class="tis-stat-value" id="consumidoresTotal">0,000 m³</span>
            <span class="tis-stat-perc" id="consumidoresPerc">(100%)</span>
          </div>
        </div>
      </div>
    `;
  }

  private buildChartCard(): string {
    return `
      <div class="tis-card tis-chart-card">
        <div class="tis-card-header">
          <h3 class="tis-card-title">Distribuição de Consumo</h3>
        </div>
        <div class="tis-card-body">
          <div class="tis-chart-container">
            <canvas id="consumptionPieChart" width="150" height="150" style="max-width: 150px; max-height: 150px;"></canvas>
          </div>
          <div class="tis-chart-legend" id="chartLegend"></div>
        </div>
      </div>
    `;
  }

  private buildModalHTML(): string {
    const title =
      this.domain === 'energy' ? 'Distribuição de Consumo de Energia' : 'Distribuição de Consumo de Água';

    return `
      <div class="tis-modal-overlay tis-hidden" id="modalExpanded">
        <div class="tis-modal-container">
          <button class="tis-btn-close" id="btnCloseModal" title="Fechar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <div class="tis-modal-body">
            <h2 class="tis-modal-title" id="modalTitleHeader">${title}</h2>

            <div class="tis-modal-chart-container">
              <div class="tis-modal-chart-wrapper">
                <canvas id="modalConsumptionPieChart"></canvas>
              </div>
            </div>

            <div class="tis-modal-legend" id="modalChartLegend"></div>
          </div>
        </div>
      </div>
    `;
  }

  private cacheElements(): void {
    this.modalEl = this.root.querySelector('#modalExpanded');
  }

  private bindEvents(): void {
    // Listen for global theme changes
    window.addEventListener('myio:theme-change', ((e: CustomEvent<{ mode: 'light' | 'dark' }>) => {
      this.setThemeMode(e.detail.mode);
    }) as EventListener);

    // Mouse events for maximize button visibility
    this.root.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.root.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

    // Expand button (now triggers maximize instead of modal)
    const btnExpand = this.root.querySelector('#btnExpandModal');
    btnExpand?.addEventListener('click', () => this.toggleMaximize());

    // Close modal (keep for backwards compatibility)
    const btnClose = this.root.querySelector('#btnCloseModal');
    btnClose?.addEventListener('click', () => this.closeModal());

    // Modal backdrop click
    this.modalEl?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('tis-modal-overlay')) {
        this.closeModal();
      }
    });

    // Category cards click
    this.root.querySelectorAll('.tis-card[data-category]').forEach((card) => {
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
      this.chartInitRetries++;
      if (this.chartInitRetries >= this.maxChartInitRetries) {
        console.warn('[TelemetryInfoShoppingView] Chart.js not available after max retries - pie chart will not render');
        return;
      }

      const retryDelay = Math.min(500 * this.chartInitRetries, 3000); // Progressive backoff up to 3s
      this.log(
        `Chart.js not available (retry ${this.chartInitRetries}/${this.maxChartInitRetries}) - will retry in ${retryDelay}ms`
      );
      setTimeout(() => this.initCharts(), retryDelay);
      return;
    }

    // Reset retry counter on success
    this.chartInitRetries = 0;
    this.log('Chart.js found, initializing charts...');

    // Main chart
    const mainCanvas = this.root.querySelector('#consumptionPieChart') as HTMLCanvasElement;
    if (!mainCanvas) {
      this.log('Main canvas not found');
      return;
    }

    // Ensure canvas has dimensions
    const container = mainCanvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      this.log('Chart container dimensions:', rect.width, rect.height);
      if (rect.width === 0 || rect.height === 0) {
        this.log('Container has no dimensions, retrying...');
        setTimeout(() => this.initCharts(), 200);
        return;
      }
    }

    // Destroy existing chart if any
    if (this.mainChart) {
      this.mainChart.destroy();
      this.mainChart = null;
    }

    const ctx = mainCanvas.getContext('2d');
    if (ctx) {
      this.log('Creating main chart with canvas:', mainCanvas.width, mainCanvas.height);
      try {
        this.mainChart = new Chart(ctx, {
          type: 'pie',
          data: {
            labels: ['Sem dados'],
            datasets: [
              {
                data: [1],
                backgroundColor: ['#e0e0e0'],
                borderColor: ['#ffffff'],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            // RFC-0196 — click on slice fires onSliceClick + dispatches
            // myio:filter-applied. The handler computes the group from
            // `chartGroups` (parallel to dataset.data) and toggles
            // visual feedback (4px white ring on active slice; 60%
            // opacity on siblings).
            onClick: (_evt: unknown, elements: Array<{ index: number }>) => {
              if (!elements || elements.length === 0) return;
              const index = elements[0].index;
              const group = this.chartGroups[index];
              if (!group) return;
              this.handleSliceClick(group);
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  // RFC-0196 hover tooltip: percentage + absolute value
                  // (kWh for energy, m³ for water).
                  label: (context: { label: string; parsed: number; dataset: { data: number[] } }) => {
                    const formatter = this.domain === 'energy' ? formatEnergy : formatWater;
                    const total = (context.dataset.data || []).reduce((a, b) => a + b, 0);
                    const perc = total > 0 ? (context.parsed / total) * 100 : 0;
                    return `${context.label}: ${formatPercentage(perc)} · ${formatter(context.parsed)}`;
                  },
                },
              },
            },
          },
        });
        this.log('Main chart created successfully');
      } catch (err) {
        console.error('[TelemetryInfoShoppingView] Error creating chart:', err);
      }
    } else {
      this.log('Could not get 2D context from canvas');
    }
  }

  private initModalChart(): void {
    const Chart = (window as unknown as { Chart?: ChartConstructor }).Chart;
    if (!Chart) {
      this.log('Chart.js not available for modal');
      return;
    }

    const modalCanvas = this.root.querySelector('#modalConsumptionPieChart') as HTMLCanvasElement;
    if (!modalCanvas) {
      this.log('Modal canvas not found');
      return;
    }

    // Destroy existing chart if any
    if (this.modalChart) {
      this.modalChart.destroy();
      this.modalChart = null;
    }

    const ctx = modalCanvas.getContext('2d');
    if (ctx) {
      this.log('Creating modal chart');
      this.modalChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: [],
          datasets: [
            {
              data: [],
              backgroundColor: [],
              borderColor: [],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          // RFC-0196 — modal pie also dispatches slice click events.
          onClick: (_evt: unknown, elements: Array<{ index: number }>) => {
            if (!elements || elements.length === 0) return;
            const index = elements[0].index;
            const group = this.chartGroups[index];
            if (!group) return;
            this.handleSliceClick(group);
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: { label: string; parsed: number; dataset: { data: number[] } }) => {
                  const formatter = this.domain === 'energy' ? formatEnergy : formatWater;
                  const total = (context.dataset.data || []).reduce((a, b) => a + b, 0);
                  const perc = total > 0 ? (context.parsed / total) * 100 : 0;
                  return `${context.label}: ${formatPercentage(perc)} · ${formatter(context.parsed)}`;
                },
              },
            },
          },
        },
      });
    }
  }

  refreshChart(): void {
    const chartData = this.getChartData();
    this.log('Refreshing chart with data:', chartData);

    // RFC-0196 — keep chartGroups in sync with the slice order so
    // onClick can map index → group identifier.
    this.chartGroups = chartData.groups;

    // RFC-0196 — visual feedback: 4px white ring on the active slice;
    // siblings fade to 60% opacity. When no slice is active all
    // borders are 0px and colors are unmodified.
    const { borderColors, borderWidths, fadedColors } = this.computeSliceVisuals(
      chartData.colors,
      chartData.groups
    );

    if (this.mainChart) {
      this.mainChart.data.labels = chartData.labels;
      this.mainChart.data.datasets[0].data = chartData.values;
      this.mainChart.data.datasets[0].backgroundColor = fadedColors;
      this.mainChart.data.datasets[0].borderColor = borderColors;
      this.mainChart.data.datasets[0].borderWidth = borderWidths;
      this.mainChart.update();
      this.log('Main chart updated');
    } else {
      this.log('Main chart not initialized yet');
    }

    if (this.modalChart) {
      this.modalChart.data.labels = chartData.labels;
      this.modalChart.data.datasets[0].data = chartData.values;
      this.modalChart.data.datasets[0].backgroundColor = fadedColors;
      this.modalChart.data.datasets[0].borderColor = borderColors;
      this.modalChart.data.datasets[0].borderWidth = borderWidths;
      this.modalChart.update();
      this.log('Modal chart updated');
    }

    // Update legends
    this.updateLegend('chartLegend', chartData);
    this.updateLegend('modalChartLegend', chartData);
  }

  /**
   * RFC-0196 — compute per-slice border + fade arrays based on the
   * current `activeSliceGroup`. Active slice gets a 4px white border
   * and full opacity; siblings get 0px border and 60% opacity (via
   * background colour modification — Chart.js doesn't expose a
   * per-slice opacity API, so we mutate the colour string).
   */
  private computeSliceVisuals(
    colors: string[],
    groups: FilterGroup[]
  ): { borderColors: string[]; borderWidths: number[]; fadedColors: string[] } {
    const active = this.activeSliceGroup;
    const borderColors: string[] = [];
    const borderWidths: number[] = [];
    const fadedColors: string[] = [];

    for (let i = 0; i < colors.length; i++) {
      const isActive = active != null && groups[i] === active;
      borderColors.push('#ffffff');
      borderWidths.push(isActive ? 4 : 0);
      if (active != null && !isActive) {
        // 60% opacity for non-active slices.
        fadedColors.push(this.fadeColor(colors[i], 0.6));
      } else {
        fadedColors.push(colors[i]);
      }
    }

    return { borderColors, borderWidths, fadedColors };
  }

  /** Apply alpha to a hex (#rrggbb / #rgb) or rgb()/rgba() colour. */
  private fadeColor(color: string, alpha: number): string {
    const c = color.trim();
    if (c.startsWith('#')) {
      const hex = c.slice(1);
      const full =
        hex.length === 3
          ? hex.split('').map((ch) => ch + ch).join('')
          : hex.length === 6
          ? hex
          : null;
      if (!full) return c;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (c.startsWith('rgb(')) {
      return c.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    if (c.startsWith('rgba(')) {
      return c.replace(/rgba\(([^)]+),\s*[\d.]+\)/, (_m, body) => `rgba(${body}, ${alpha})`);
    }
    return c;
  }

  /**
   * RFC-0196 — public slice-click entry point. Toggles the active
   * group (clicking the same slice twice clears the filter), updates
   * the visual ring/fade, fires the `onSliceClick` callback, and
   * dispatches `myio:filter-applied`.
   *
   * Exposed (via the bound `bindEvents` legend hook below) so the
   * legend chips and tests can simulate slice activations without
   * needing a Chart.js click event.
   */
  handleSliceClick(group: FilterGroup): void {
    this.log('handleSliceClick:', group, 'previous:', this.activeSliceGroup);

    // Toggle: same slice twice clears the filter.
    const wasActive = this.activeSliceGroup === group;
    this.activeSliceGroup = wasActive ? null : group;

    // Re-run refreshChart to apply the visual ring/fade.
    this.refreshChart();
    // Re-apply card visual state to keep the corresponding card highlighted.
    this.updateCardActiveState();

    // Fire callback BEFORE the global event so subscribers see the
    // same payload twice without duplication risk.
    this.params.onSliceClick?.(group);

    // RFC-0196 — `myio:filter-applied` event for the dashboard
    // controller. `deviceIds` is intentionally an empty array here —
    // the controller resolves device ids from `window.STATE.itemsBase`
    // since this view does not own the device list.
    if (typeof window !== 'undefined') {
      const detail = {
        domain: this.domain,
        group: this.activeSliceGroup, // null when toggled off
        deviceIds: [] as string[],
      };
      window.dispatchEvent(new CustomEvent('myio:filter-applied', { detail }));
    }
  }

  /**
   * RFC-0196 — apply CSS class `tis-card--active` to the card whose
   * `data-category` matches the current filter group, and
   * `tis-card--faded` to siblings. Group→card mapping bridges
   * snake_case filter groups to the camelCase card data-category.
   */
  private updateCardActiveState(): void {
    const groupToCard: Partial<Record<FilterGroup, string>> = {
      entrada: 'entrada',
      lojas: 'lojas',
      climatizacao: 'climatizacao',
      elevadores: 'elevadores',
      escadas_rolantes: 'escadasRolantes',
      outros: 'outros',
      erro: 'erro',
      banheiros: 'banheiros',
      areaComum: 'areaComum',
    };

    const activeCard =
      this.activeSliceGroup != null ? groupToCard[this.activeSliceGroup] : null;

    this.root.querySelectorAll('.tis-card[data-category]').forEach((el) => {
      const card = el as HTMLElement;
      const cat = card.dataset.category || '';
      if (activeCard == null) {
        card.classList.remove('tis-card--active');
        card.classList.remove('tis-card--faded');
        return;
      }
      if (cat === activeCard) {
        card.classList.add('tis-card--active');
        card.classList.remove('tis-card--faded');
      } else if (cat === 'total') {
        // The "Total Consumidores" card is informational only — do not fade.
        card.classList.remove('tis-card--active');
        card.classList.remove('tis-card--faded');
      } else {
        card.classList.add('tis-card--faded');
        card.classList.remove('tis-card--active');
      }
    });
  }

  /**
   * RFC-0196 — `groups` parallels `labels/values/colors` and gives each
   * slice the canonical filter-group identifier dispatched on click.
   * Energy uses snake_case (`escadas_rolantes`) for cross-component
   * consistency with `buildEquipmentCategorySummary` (RFC-0128). The
   * `erro` slice is included whenever the residual is strictly > 0.
   */
  private getChartData(): {
    labels: string[];
    values: number[];
    colors: string[];
    groups: FilterGroup[];
  } {
    const labels: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];
    const groups: FilterGroup[] = [];

    if (this.domain === 'energy' && this.energyState) {
      const state = this.energyState;
      const categories = [
        { key: 'climatizacao', group: 'climatizacao', data: state.consumidores.climatizacao },
        { key: 'elevadores', group: 'elevadores', data: state.consumidores.elevadores },
        { key: 'escadasRolantes', group: 'escadas_rolantes', data: state.consumidores.escadasRolantes },
        { key: 'lojas', group: 'lojas', data: state.consumidores.lojas },
        { key: 'outros', group: 'outros', data: state.consumidores.outros },
      ] as const;

      categories.forEach(({ key, group, data }) => {
        if (data.total > 0) {
          const config = ENERGY_CATEGORY_CONFIG[key];
          labels.push(config.label);
          values.push(data.total);
          colors.push(this.chartColors[key]);
          groups.push(group as FilterGroup);
        }
      });

      // RFC-0196 — Erro slice (only when residual > 0).
      if (state.erro.total > 0) {
        const cfg = ENERGY_CATEGORY_CONFIG.erro;
        labels.push(cfg.label);
        values.push(state.erro.total);
        colors.push(cfg.color);
        groups.push('erro');
      }
    } else if (this.domain === 'water' && this.waterState) {
      const state = this.waterState;
      const categories = [
        { key: 'lojas' as const, group: 'lojas' as FilterGroup, data: state.lojas },
        { key: 'banheiros' as const, group: 'banheiros' as FilterGroup, data: state.banheiros },
        { key: 'areaComum' as const, group: 'areaComum' as FilterGroup, data: state.areaComum },
        // pontosNaoMapeados has no canonical filter group — treated as
        // residual visualisation only.
        { key: 'pontosNaoMapeados' as const, group: null as FilterGroup | null, data: state.pontosNaoMapeados },
      ];

      categories.forEach(({ key, group, data }) => {
        if (data.total > 0) {
          const config = WATER_CATEGORY_CONFIG[key];
          labels.push(config.label);
          values.push(data.total);
          colors.push(this.chartColors[key]);
          // Use 'areaComum' as the filter-group fallback when no canonical
          // group is defined (pontosNaoMapeados is non-clickable for filter).
          groups.push((group as FilterGroup) || 'areaComum');
        }
      });
    }

    return { labels, values, colors, groups };
  }

  private updateLegend(
    elementId: string,
    chartData: { labels: string[]; values: number[]; colors: string[]; groups: FilterGroup[] }
  ): void {
    const legendEl = this.root.querySelector(`#${elementId}`);
    if (!legendEl) return;

    const formatter = this.domain === 'energy' ? formatEnergy : formatWater;

    legendEl.innerHTML = chartData.labels
      .map(
        (label, i) => `
      <div class="tis-legend-item" data-group="${chartData.groups[i] || ''}">
        <span class="tis-legend-color" style="background-color: ${chartData.colors[i]}"></span>
        <span class="tis-legend-label">${label}</span>
        <span class="tis-legend-value">${formatter(chartData.values[i])}</span>
      </div>
    `
      )
      .join('');

    // RFC-0196 — clicking a legend chip is equivalent to clicking the
    // matching slice. Useful for keyboard-only flows and as a
    // Chart.js-free fallback when the canvas hasn't initialised
    // (e.g. unit tests without Chart.js).
    legendEl.querySelectorAll('.tis-legend-item').forEach((item) => {
      const el = item as HTMLElement;
      const group = el.dataset.group as FilterGroup | undefined;
      if (!group) return;
      if (el.hasAttribute('data-bound')) return;
      el.setAttribute('data-bound', 'true');
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        this.handleSliceClick(group);
      });
    });
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

    // RFC-0196 — calculated residual:
    //   erro = Entrada − (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros)
    // When `erro <= 0` the slice is omitted from the pie and the card
    // renders the placeholder `'—'`.
    const erroFromSummary = summary.erro?.total;
    const erroComputed = entrada - totalConsumidores;
    const erro =
      typeof erroFromSummary === 'number' && Number.isFinite(erroFromSummary)
        ? erroFromSummary
        : erroComputed;

    const calcPerc = (val: number) => (entrada > 0 ? (val / entrada) * 100 : 0);

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
      erro: { total: erro, perc: calcPerc(Math.max(0, erro)) },
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
    this.updateElement(
      '#escadasRolantesPerc',
      `(${formatPercentage(state.consumidores.escadasRolantes.perc)})`
    );
    this.updateElement('#outrosTotal', formatEnergy(state.consumidores.outros.total));
    this.updateElement('#outrosPerc', `(${formatPercentage(state.consumidores.outros.perc)})`);
    this.updateElement('#areaComumTotal', formatEnergy(state.consumidores.areaComum.total));
    this.updateElement('#areaComumPerc', `(${formatPercentage(state.consumidores.areaComum.perc)})`);

    // RFC-0196 — Erro card. When `erro <= 0` the placeholder `'—'` is
    // shown and the percentage cell is cleared (the slice is also
    // omitted from the pie via `getChartData`).
    if (state.erro.total > 0) {
      this.updateElement('#erroTotal', formatEnergy(state.erro.total));
      this.updateElement('#erroPerc', `(${formatPercentage(state.erro.perc)})`);
    } else {
      this.updateElement('#erroTotal', '—');
      this.updateElement('#erroPerc', '');
    }

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

    const calcPerc = (val: number) => (entrada > 0 ? (val / entrada) * 100 : 0);

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
    // RFC-0196 — reset filter state when data is cleared.
    this.activeSliceGroup = null;
    this.updateCardActiveState();

    // Reset all values to zero
    this.root.querySelectorAll('.tis-stat-value').forEach((el) => {
      const isWater = this.domain === 'water';
      el.textContent = isWater ? '0,000 m³' : '0,00 kWh';
    });
    this.root.querySelectorAll('.tis-stat-perc').forEach((el) => {
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
    this.modalEl?.classList.remove('tis-hidden');
    document.body.classList.add('modal-open-telemetry-info');

    // Initialize modal chart with delay to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.initModalChart();
        this.refreshChart();
      }, 50);
    });

    this.params.onExpandClick?.();
  }

  closeModal(): void {
    this.log('closeModal');
    this.modalOpen = false;
    this.modalEl?.classList.add('tis-hidden');
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

      // RFC-0196 — clear filter state when domain switches.
      this.activeSliceGroup = null;

      // Re-render the grid with new domain cards
      const gridEl = this.root.querySelector('#infoGrid');
      if (gridEl) {
        gridEl.innerHTML =
          (domain === 'energy' ? this.buildEnergyCards() : this.buildWaterCards()) +
          (this.params.showChart !== false ? this.buildChartCard() : '');
      }

      // Re-bind events for new cards
      this.bindEvents();
      this.initCharts();

      // Update modal title
      const modalTitle = this.root.querySelector('#modalTitleHeader');
      if (modalTitle) {
        modalTitle.textContent =
          domain === 'energy' ? 'Distribuição de Consumo de Energia' : 'Distribuição de Consumo de Água';
      }
    }
  }

  getDomain(): TelemetryDomain {
    return this.domain;
  }

  /** RFC-0196 — current active filter group, or null when no filter. */
  getActiveGroup(): FilterGroup | null {
    return this.activeSliceGroup;
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

  // =========================================================================
  // Maximize
  // =========================================================================

  private renderMaximizeButton(): void {
    const maximizeBtnHTML = `
      <button class="tis-maximize-btn" title="Maximizar">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor"/>
        </svg>
      </button>
    `;
    this.root.insertAdjacentHTML('beforeend', maximizeBtnHTML);
    this.maximizeBtnEl = this.root.querySelector('.tis-maximize-btn');
    this.maximizeBtnEl?.addEventListener('click', this.toggleMaximize.bind(this));
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.isMaximized || !this.maximizeBtnEl) return;

    const rect = this.root.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const isNearTopRight = x > rect.width - 80 && y < 60;

    this.maximizeBtnEl.style.opacity = isNearTopRight ? '1' : '0';
  }

  private handleMouseLeave(): void {
    if (this.isMaximized || !this.maximizeBtnEl) return;
    this.maximizeBtnEl.style.opacity = '0';
  }

  private toggleMaximize(): void {
    this.isMaximized = !this.isMaximized;

    if (this.isMaximized) {
      // Save original position
      this.originalParent = this.root.parentElement;
      this.originalNextSibling = this.root.nextSibling;

      // Move to body for fullscreen
      document.body.appendChild(this.root);
      this.root.classList.add('tis-maximized');

      // Keep button visible when maximized
      if (this.maximizeBtnEl) {
        this.maximizeBtnEl.style.opacity = '1';
      }
    } else {
      // Restore original position
      this.root.classList.remove('tis-maximized');

      if (this.originalParent) {
        if (this.originalNextSibling) {
          this.originalParent.insertBefore(this.root, this.originalNextSibling);
        } else {
          this.originalParent.appendChild(this.root);
        }
      }

      // Reset button opacity
      if (this.maximizeBtnEl) {
        this.maximizeBtnEl.style.opacity = '0';
      }
    }

    // Update icon
    const icon = this.isMaximized
      ? '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" fill="currentColor"/>'
      : '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor"/>';

    if (this.maximizeBtnEl) {
      this.maximizeBtnEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18">${icon}</svg>`;
    }

    this.params.onExpandClick?.();
  }
}
