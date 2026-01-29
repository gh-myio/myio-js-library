/**
 * RFC-0152 Phase 5: Operational Dashboard View
 * Main view layer for the management dashboard
 */

import type {
  DashboardKPIs,
  TrendDataPoint,
  DowntimeEntry,
  DashboardPeriod,
  DashboardThemeMode,
  PERIOD_OPTIONS,
} from './types';
import { injectOperationalDashboardStyles } from './styles';
import { renderPrimaryKPIs, renderSecondaryKPIs } from './KPICard';
import {
  renderAvailabilityChart,
  renderDualLineChart,
  renderStatusDonutChart,
  renderDowntimeList,
  renderMTBFTimelineChart,
  generateMockMTBFTimelineData,
  updateAvailabilityChart,
  updateMtbfMttrChart,
  updateStatusChart,
  updateDowntimeListDOM,
  initMTBFTimelineTooltips,
  initStatusChartTooltips,
  initAvailabilityChartTooltips,
} from './ChartComponents';
import { getTrendClass, getTrendIcon, formatTrend } from './utils';

interface ViewParams {
  container: HTMLElement;
  themeMode: DashboardThemeMode;
  period: DashboardPeriod;
  kpis: DashboardKPIs;
  trendData: TrendDataPoint[];
  downtimeList: DowntimeEntry[];
  onPeriodChange?: (period: DashboardPeriod) => void;
  onRefresh?: () => void;
}

export class OperationalDashboardView {
  private container: HTMLElement;
  private rootEl: HTMLElement | null = null;
  private themeMode: DashboardThemeMode;
  private period: DashboardPeriod;
  private kpis: DashboardKPIs;
  private trendData: TrendDataPoint[];
  private downtimeList: DowntimeEntry[];
  private onPeriodChange?: (period: DashboardPeriod) => void;
  private onRefresh?: () => void;

  // Element IDs
  private readonly ids = {
    root: 'operationalDashboardRoot',
    periodSelector: 'dashboardPeriodSelector',
    refreshBtn: 'dashboardRefreshBtn',
    loadingOverlay: 'dashboardLoading',
    primaryKpis: 'dashboardPrimaryKpis',
    secondaryKpis: 'dashboardSecondaryKpis',
    availabilityChart: 'dashboardAvailabilityChart',
    mtbfMttrChart: 'dashboardMtbfMttrChart',
    statusChart: 'dashboardStatusChart',
    downtimeList: 'dashboardDowntimeList',
  };

  constructor(params: ViewParams) {
    injectOperationalDashboardStyles();

    this.container = params.container;
    this.themeMode = params.themeMode;
    this.period = params.period;
    this.kpis = params.kpis;
    this.trendData = params.trendData;
    this.downtimeList = params.downtimeList;
    this.onPeriodChange = params.onPeriodChange;
    this.onRefresh = params.onRefresh;

    this.render();
    this.attachEventListeners();
    this.initTooltips();
  }

  private initTooltips(): void {
    // Initialize MTBF Timeline tooltips
    initMTBFTimelineTooltips(this.ids.mtbfMttrChart);
    // Initialize Status Chart tooltips (RFC-0155)
    initStatusChartTooltips(this.ids.statusChart);
    // Initialize Availability Chart tooltips (RFC-0156)
    initAvailabilityChartTooltips(this.ids.availabilityChart);
  }

  private render(): void {
    const html = this.buildHTML();
    this.container.innerHTML = html;
    this.rootEl = document.getElementById(this.ids.root);
  }

  private buildHTML(): string {
    return `
      <div class="myio-dashboard-root" id="${this.ids.root}" data-theme="${this.themeMode}">
        <!-- Header -->
        <header class="dashboard-header">
          <h1>Dashboard Gerencial</h1>
          <div class="header-actions">
            <select id="${this.ids.periodSelector}" class="period-select">
              <option value="today" ${this.period === 'today' ? 'selected' : ''}>Hoje</option>
              <option value="week" ${this.period === 'week' ? 'selected' : ''}>Esta Semana</option>
              <option value="month" ${this.period === 'month' ? 'selected' : ''}>Este Mes</option>
              <option value="quarter" ${this.period === 'quarter' ? 'selected' : ''}>Este Trimestre</option>
            </select>
            <button class="refresh-btn" id="${this.ids.refreshBtn}" title="Atualizar">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Primary KPIs -->
        <section class="kpi-grid primary" id="${this.ids.primaryKpis}">
          ${renderPrimaryKPIs(this.kpis)}
        </section>

        <!-- Secondary KPIs -->
        <section class="kpi-grid secondary" id="${this.ids.secondaryKpis}">
          ${renderSecondaryKPIs(this.kpis)}
        </section>

        <!-- Charts Grid -->
        <section class="charts-grid">
          <!-- Availability Trend (RFC-0156 Enhanced) -->
          <div class="chart-tile">
            <h3>Disponibilidade por Periodo</h3>
            <div class="chart-area" id="${this.ids.availabilityChart}">
              ${renderAvailabilityChart(this.trendData, { periodLabel: this.getPeriodLabel() })}
            </div>
          </div>

          <!-- MTBF Timeline -->
          <div class="chart-tile">
            <h3>Timeline MTBF - Operacao vs Paradas</h3>
            <div class="chart-area" id="${this.ids.mtbfMttrChart}">
              ${renderMTBFTimelineChart(generateMockMTBFTimelineData())}
            </div>
          </div>

          <!-- Status Distribution -->
          <div class="chart-tile">
            <h3>Equipamentos por Status</h3>
            <div class="chart-area" id="${this.ids.statusChart}">
              ${renderStatusDonutChart(this.kpis)}
            </div>
          </div>

          <!-- Top Downtime -->
          <div class="chart-tile">
            <h3>Top 5 - Maior Downtime</h3>
            <div class="downtime-list" id="${this.ids.downtimeList}">
              ${renderDowntimeList(this.downtimeList)}
            </div>
          </div>
        </section>

        <!-- Loading Overlay -->
        <div class="loading-overlay" id="${this.ids.loadingOverlay}">
          <div class="spinner"></div>
          <p>Carregando dados...</p>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Period selector
    const periodSelector = document.getElementById(
      this.ids.periodSelector
    ) as HTMLSelectElement | null;
    if (periodSelector) {
      periodSelector.addEventListener('change', () => {
        const newPeriod = periodSelector.value as DashboardPeriod;
        this.period = newPeriod;
        this.onPeriodChange?.(newPeriod);
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById(this.ids.refreshBtn);
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.onRefresh?.();
      });
    }
  }

  // ============================================
  // PUBLIC UPDATE METHODS
  // ============================================

  public updateKPIs(kpis: DashboardKPIs): void {
    this.kpis = kpis;

    // Update primary KPIs
    const primaryContainer = document.getElementById(this.ids.primaryKpis);
    if (primaryContainer) {
      primaryContainer.innerHTML = renderPrimaryKPIs(kpis);
    }

    // Update secondary KPIs
    const secondaryContainer = document.getElementById(this.ids.secondaryKpis);
    if (secondaryContainer) {
      secondaryContainer.innerHTML = renderSecondaryKPIs(kpis);
    }

    // Update status chart
    updateStatusChart(this.ids.statusChart, kpis);
  }

  public updateTrendData(data: TrendDataPoint[]): void {
    this.trendData = data;

    // Update availability chart
    updateAvailabilityChart(this.ids.availabilityChart, data);

    // Update MTBF/MTTR chart
    updateMtbfMttrChart(this.ids.mtbfMttrChart, data);
  }

  public updateDowntimeList(list: DowntimeEntry[]): void {
    this.downtimeList = list;
    updateDowntimeListDOM(this.ids.downtimeList, list);
  }

  public setLoading(isLoading: boolean): void {
    const overlay = document.getElementById(this.ids.loadingOverlay);
    if (overlay) {
      overlay.classList.toggle('visible', isLoading);
    }

    // Also toggle spinning animation on refresh button
    const refreshBtn = document.getElementById(this.ids.refreshBtn);
    if (refreshBtn) {
      refreshBtn.classList.toggle('spinning', isLoading);
    }
  }

  public setPeriod(period: DashboardPeriod): void {
    this.period = period;

    const periodSelector = document.getElementById(
      this.ids.periodSelector
    ) as HTMLSelectElement | null;
    if (periodSelector) {
      periodSelector.value = period;
    }
  }

  public setThemeMode(mode: DashboardThemeMode): void {
    this.themeMode = mode;

    if (this.rootEl) {
      this.rootEl.setAttribute('data-theme', mode);
    }
  }

  public getElement(): HTMLElement {
    return this.rootEl || this.container;
  }

  public destroy(): void {
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
  }

  /**
   * Get human-readable period label
   */
  private getPeriodLabel(): string {
    switch (this.period) {
      case 'today':
        return 'hoje';
      case 'week':
        return 'esta semana';
      case 'month':
        return 'ultimos 30 dias';
      case 'quarter':
        return 'este trimestre';
      default:
        return 'periodo selecionado';
    }
  }
}
