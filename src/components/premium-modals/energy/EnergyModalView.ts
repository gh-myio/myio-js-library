// energy/EnergyModalView.ts - UI rendering and DOM manipulation for energy modal

import { toCsv } from '../internal/engines/CsvExporter';
import { fmtPt } from '../internal/engines/NumberFmt';
import { attach as attachDateRangePicker, DateRangeControl } from '../internal/DateRangePickerJQ';
import { 
  EnergyViewConfig, 
  EnergyData, 
  DEFAULT_I18N 
} from './types';
import { 
  formatNumber, 
  formatDate, 
  classifyDevice, 
  getDeviceIcon 
} from './utils';

export class EnergyModalView {
  private modal: any;
  private container: HTMLElement | null = null;
  private chartContainer: HTMLElement | null = null;
  private config: EnergyViewConfig;
  private currentEnergyData: EnergyData | null = null;
  private dateRangePicker: DateRangeControl | null = null;
  private isLoading = false;

  constructor(modal: any, config: EnergyViewConfig) {
    this.modal = modal;
    this.config = config;
    this.render();
  }

  /**
   * Renders the modal content
   */
  private render(): void {
    const content = this.createModalContent();
    this.modal.setContent(content);
    this.setupEventListeners();
  }

  /**
   * Creates the main modal content structure
   */
  private createModalContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'myio-energy-modal-scope';
    
    const { device } = this.config.context;
    const identifier = device.attributes.identifier || 'SEM IDENTIFICADOR';
    const label = device.label || 'SEM ETIQUETA';
    
    container.innerHTML = `
      <style>
        ${this.getModalStyles()}
      </style>
      <div class="myio-modal-scope" style="height: 100%; display: flex; flex-direction: column;">
        <!-- Controls Section -->
        <div style="margin-bottom: 16px; flex-shrink: 0;">
          <div style="display: flex; gap: 16px; align-items: end; margin-bottom: 16px;">
            <div class="myio-form-group" style="margin-bottom: 0;">
              <label class="myio-label" for="date-range">Período</label>
              <input type="text" id="date-range" class="myio-input" readonly placeholder="Selecione o período" style="width: 300px;">
            </div>
            <button id="load-btn" class="myio-btn myio-btn-primary">
              <span class="myio-spinner" id="load-spinner" style="display: none;"></span>
              Carregar
            </button>
            <button id="export-csv-btn" class="myio-btn myio-btn-secondary" disabled>
              Exportar CSV
            </button>
            <button id="close-btn" class="myio-btn myio-btn-secondary">
              Fechar
            </button>
          </div>
        </div>
        
        <!-- Error Container -->
        <div id="energy-error" class="myio-energy-error" style="display: none; flex-shrink: 0;">
          <!-- Error messages will be displayed here -->
        </div>
        
        <!-- Main Chart Container - Full Width -->
        <div id="energy-chart-container" class="myio-energy-chart-container" style="width: 100%; flex: 1; box-sizing: border-box;">
          <div class="myio-loading-state">
            <div class="myio-spinner"></div>
            <p>${this.getI18nText('loading')}</p>
          </div>
        </div>
        
        <!-- KPI Button Section -->
        <div id="energy-kpi-btn" style="display: none; margin-top: 16px; text-align: center; flex-shrink: 0;">
          <button id="show-kpis-btn" class="myio-btn myio-btn-secondary" title="Show detailed metrics">
            <span style="font-size: 16px; font-weight: bold;">+</span>
            <span style="margin-left: 8px;">Show Metrics</span>
          </button>
        </div>
        
      </div>
    `;

    this.container = container;
    this.chartContainer = container.querySelector('#energy-chart-container') as HTMLElement;
    
    return container;
  }

  /**
   * Shows loading state
   */
  showLoadingState(): void {
    if (this.chartContainer) {
      this.chartContainer.innerHTML = `
        <div class="myio-loading-state">
          <div class="myio-spinner"></div>
          <p>${this.getI18nText('loading')}</p>
        </div>
      `;
    }
    
    this.hideError();
    this.hideKPIButton();
  }

  /**
   * Shows error message
   */
  showError(message: string): void {
    const errorContainer = document.getElementById('energy-error');
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="myio-error-content">
          <div class="myio-error-icon">⚠️</div>
          <div class="myio-error-message">${message}</div>
        </div>
      `;
      errorContainer.style.display = 'block';
    }
    
    this.hideLoadingState();
  }

  /**
   * Renders energy data (charts, KPIs, table)
   */
  renderEnergyData(energyData: EnergyData): void {
    this.currentEnergyData = energyData;
    
    // Hide loading state and errors
    this.hideLoadingState();
    this.hideError();
    
    // Render chart
    this.renderChart(energyData);
    
    // Show KPI button
    this.showKPIButton();
    
    
    // Enable export button
    const exportBtn = document.getElementById('export-csv-btn') as HTMLButtonElement;
    if (exportBtn) {
      exportBtn.disabled = false;
    }
  }

  /**
   * Renders the energy chart
   */
  private renderChart(energyData: EnergyData): void {
    if (!this.chartContainer) return;

    // Try to use EnergyChartSDK if available
    if (this.tryRenderWithSDK(energyData)) {
      return;
    }

    // Fallback to simple chart implementation
    this.renderFallbackChart(energyData);
  }

  /**
   * Attempts to render chart using EnergyChartSDK
   */
  private tryRenderWithSDK(energyData: EnergyData): boolean {
    try {
      // Destroy previous instance if it exists
      if ((this as any).chartInstance && typeof (this as any).chartInstance.destroy === 'function') {
        (this as any).chartInstance.destroy();
        (this as any).chartInstance = null;
      }

      // Ensure container is clean
      if (this.chartContainer) {
        this.chartContainer.innerHTML = '';
      }

      let renderTelemetryChart;
      if (typeof window !== 'undefined' && (window as any).EnergyChartSDK && typeof (window as any).EnergyChartSDK.renderTelemetryChart === 'function') {
        renderTelemetryChart = (window as any).EnergyChartSDK.renderTelemetryChart;
      } else {
        console.error('[EnergyModalView] EnergyChartSDK v2 (renderTelemetryChart) not loaded!');
        if (this.chartContainer) {
          this.chartContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">EnergyChartSDK v2 (renderTelemetryChart) not loaded. Check widget configuration and browser console.</div>';
        }
        return false;
      }

      // Get current dates from date range picker or use defaults
      let startISO: string, endISO: string;

      if (this.dateRangePicker) {
        const dates = this.dateRangePicker.getDates();
        startISO = dates.startISO;
        endISO = dates.endISO;
      } else {
        // Fallback to original params
        startISO = this.normalizeToSaoPauloISO(this.config.params.startDate, false);
        endISO = this.normalizeToSaoPauloISO(this.config.params.endDate, true);
      }

      const tzIdentifier = this.config.params.timezone || 'America/Sao_Paulo';
      const granularity = this.config.params.granularity || '1d';
      const theme = this.config.params.theme || 'light';
      const ingestionId = this.config.context.resolved.ingestionId;

      console.log(`[EnergyModalView] Initializing v2 chart with: deviceId=${ingestionId}, startDate=${startISO}, endDate=${endISO}, granularity=${granularity}, theme=${theme}, timezone=${tzIdentifier}`);

      const chartConfig = {
        version: 'v2',
        clientId: this.config.params.clientId || 'ADMIN_DASHBOARD_CLIENT',
        clientSecret: this.config.params.clientSecret || 'admin_dashboard_secret_2025',
        deviceId: ingestionId,
        readingType: 'energy',
        startDate: startISO,
        endDate: endISO,
        granularity: granularity,
        theme: theme,
        timezone: tzIdentifier,
        iframeBaseUrl: this.config.params.chartsBaseUrl || 'https://graphs.apps.myio-bas.com',
        apiBaseUrl: this.config.params.dataApiHost || 'https://api.data.apps.myio-bas.com'
      };

      (this as any).chartInstance = renderTelemetryChart(this.chartContainer, chartConfig);

      // Attach event listeners if SDK supports it
      if ((this as any).chartInstance && typeof (this as any).chartInstance.on === 'function') {
        (this as any).chartInstance.on('drilldown', (data: any) => {
          console.log('[EnergyModalView] v2 SDK Drilldown Event:', data);
        });
        (this as any).chartInstance.on('error', (errorData: any) => {
          console.error('[EnergyModalView] v2 SDK Error Event:', errorData);
          if (this.chartContainer) {
            this.chartContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">v2 Chart Error: ${errorData.message || 'Unknown error'}</div>`;
          }
        });
      } else if ((this as any).chartInstance) {
        console.warn("[EnergyModalView] EnergyChartSDK v2 instance does not have an 'on' method for event listeners.");
      }

      return true;
    } catch (error) {
      console.warn('[EnergyModalView] EnergyChartSDK failed, using fallback:', error);
    }

    return false;
  }

  /**
   * Helper function to normalize dates to São Paulo timezone ISO string
   */
  private normalizeToSaoPauloISO(dateLike: string | Date, endOfDay: boolean = false): string {
    let date: Date;
    
    if (typeof dateLike === 'string') {
      // Handle YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
        date = new Date(dateLike + 'T00:00:00-03:00');
      } else {
        date = new Date(dateLike);
      }
    } else {
      date = new Date(dateLike);
    }
    
    // Set to end of day if requested
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    
    return date.toISOString().replace('Z', '-03:00');
  }

  /**
   * Renders a simple fallback chart
   */
  private renderFallbackChart(energyData: EnergyData): void {
    if (!this.chartContainer) return;

    const maxValue = Math.max(...energyData.consumption.map(p => p.value));
    const chartHeight = 300;
    
    const chartHTML = `
      <div class="myio-fallback-chart">
        <h4>${this.getI18nText('energyChart')}</h4>
        <div class="myio-chart-container" style="height: ${chartHeight}px;">
          <svg width="100%" height="100%" viewBox="0 0 800 ${chartHeight}">
            ${energyData.consumption.map((point, index) => {
              const x = (index / (energyData.consumption.length - 1)) * 750 + 25;
              const y = chartHeight - 50 - ((point.value / maxValue) * (chartHeight - 100));
              const barWidth = Math.max(2, 750 / energyData.consumption.length - 2);
              
              return `
                <rect x="${x - barWidth/2}" y="${y}" width="${barWidth}" height="${chartHeight - 50 - y}" 
                      fill="var(--myio-energy-primary, #6366f1)" opacity="0.7">
                  <title>${formatDate(point.timestamp)}: ${formatNumber(point.value)} kWh</title>
                </rect>
              `;
            }).join('')}
            
            <!-- Y-axis -->
            <line x1="25" y1="25" x2="25" y2="${chartHeight - 25}" stroke="#ccc" stroke-width="1"/>
            <!-- X-axis -->
            <line x1="25" y1="${chartHeight - 25}" x2="775" y2="${chartHeight - 25}" stroke="#ccc" stroke-width="1"/>
            
            <!-- Y-axis labels -->
            <text x="15" y="30" text-anchor="end" font-size="12" fill="#666">${formatNumber(maxValue)}</text>
            <text x="15" y="${chartHeight - 30}" text-anchor="end" font-size="12" fill="#666">0</text>
          </svg>
        </div>
        <p class="myio-chart-note">
          ${this.getI18nText('kwhUnit')} consumption over time. Hover over bars for details.
        </p>
      </div>
    `;

    this.chartContainer.innerHTML = chartHTML;
  }

  /**
   * Shows the KPI button
   */
  private showKPIButton(): void {
    const kpiButtonContainer = document.getElementById('energy-kpi-btn');
    if (kpiButtonContainer) {
      kpiButtonContainer.style.display = 'block';
    }
  }


  /**
   * Exports data to CSV
   */
  exportToCsv(): void {
    if (!this.currentEnergyData) {
      throw new Error('No data available for export');
    }

    const { device } = this.config.context;
    const totalConsumption = this.currentEnergyData.consumption.reduce((sum, item) => sum + item.value, 0);
    const now = new Date();
    const timestamp = now.toLocaleDateString('pt-BR') + ' - ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const csvData = [
      ['ENERGY REPORT - DEVICE DETAILS', '', ''],
      ['Device', device.label, ''],
      ['Device ID', device.id, ''],
      ['Export Date', timestamp, ''],
      ['Total Consumption', formatNumber(totalConsumption), 'kWh'],
      ['', '', ''],
      ['Date', 'Consumption (kWh)', ''],
      ...this.currentEnergyData.consumption.map(row => [
        formatDate(row.timestamp), 
        formatNumber(row.value),
        ''
      ])
    ];

    const csvContent = toCsv(csvData);
    this.downloadCSV(csvContent, `energy-report-${device.id}-${new Date().toISOString().split('T')[0]}.csv`);
  }

  /**
   * Downloads CSV file
   */
  private downloadCSV(content: string, filename: string): void {
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + content;
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Gets default start date (first day of current month)
   */
  private getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  }

  /**
   * Gets default end date (today)
   */
  private getDefaultEndDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Loads data with new date range
   */
  private async loadData(): Promise<void> {
    if (this.isLoading) return;

    const loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
    const exportBtn = document.getElementById('export-csv-btn') as HTMLButtonElement;
    const spinner = document.getElementById('load-spinner');

    if (!this.dateRangePicker) {
      this.showError('Seletor de data não inicializado');
      return;
    }

    this.isLoading = true;
    loadBtn.disabled = true;
    exportBtn.disabled = true;
    spinner!.style.display = 'inline-block';

    try {
      const { startISO, endISO } = this.dateRangePicker.getDates();
      
      if (!startISO || !endISO) {
        this.showError('Selecione um período válido');
        return;
      }

      // Show loading state
      this.showLoadingState();

      // Trigger reload via config callback
      if (this.config.onDateRangeChange) {
        await this.config.onDateRangeChange(startISO, endISO);
      }

    } catch (error) {
      this.showError('Erro ao carregar dados: ' + (error as Error).message);
      console.error('Error loading data:', error);
    } finally {
      this.isLoading = false;
      loadBtn.disabled = false;
      spinner!.style.display = 'none';
    }
  }

  /**
   * Sets up event listeners
   */
  private async setupEventListeners(): Promise<void> {
    const exportBtn = document.getElementById('export-csv-btn');
    const closeBtn = document.getElementById('close-btn');
    const loadBtn = document.getElementById('load-btn');
    const showKpisBtn = document.getElementById('show-kpis-btn');
    const dateRangeInput = document.getElementById('date-range') as HTMLInputElement;

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        try {
          this.exportToCsv();
        } catch (error) {
          console.error('[EnergyModalView] Export error:', error);
          this.config.onError({
            code: 'UNKNOWN_ERROR',
            message: 'Failed to export data',
            cause: error
          });
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.modal.close();
      });
    }

    if (loadBtn) {
      loadBtn.addEventListener('click', () => this.loadData());
    }

    if (showKpisBtn) {
      showKpisBtn.addEventListener('click', () => {
        // TODO: Open KPI modal here
        console.log('[EnergyModalView] Show KPIs modal clicked');
        alert('KPI modal functionality to be implemented');
      });
    }

    // Initialize DateRangePicker with widget dates as defaults
    try {
      this.dateRangePicker = await attachDateRangePicker(dateRangeInput, {
        presetStart: this.config.params.startDate instanceof Date 
          ? this.config.params.startDate.toISOString().split('T')[0]
          : this.config.params.startDate,
        presetEnd: this.config.params.endDate instanceof Date
          ? this.config.params.endDate.toISOString().split('T')[0] 
          : this.config.params.endDate,
        maxRangeDays: 31,
        parentEl: this.modal.element,
        onApply: ({ startISO, endISO }) => {
          this.hideError();
          console.log('Date range selected:', { startISO, endISO });
        }
      });
    } catch (error) {
      console.warn('DateRangePicker initialization failed, using fallback:', error);
    }
  }

  /**
   * Helper methods for hiding/showing sections
   */
  private hideLoadingState(): void {
    const loadingState = this.chartContainer?.querySelector('.myio-loading-state');
    if (loadingState) {
      loadingState.remove();
    }
  }

  private hideError(): void {
    const errorContainer = document.getElementById('energy-error');
    if (errorContainer) {
      errorContainer.style.display = 'none';
    }
  }

  private hideKPIButton(): void {
    const kpiButtonContainer = document.getElementById('energy-kpi-btn');
    if (kpiButtonContainer) {
      kpiButtonContainer.style.display = 'none';
    }
  }


  /**
   * Gets internationalized text
   */
  private getI18nText(key: keyof typeof DEFAULT_I18N): string {
    const i18n = this.config.params.i18n || DEFAULT_I18N;
    return i18n[key] || DEFAULT_I18N[key];
  }

  /**
   * Gets modal styles with header color matching openDashboardPopupEnergy
   */
  private getModalStyles(): string {
    const styles = this.config.params.styles || {};
    
    return `
      .myio-energy-modal-scope {
        --myio-energy-primary: ${styles.primaryColor || '#4A148C'};
        --myio-energy-bg: ${styles.backgroundColor || '#ffffff'};
        --myio-energy-text: ${styles.textColor || '#1f2937'};
        --myio-energy-border: ${styles.borderColor || '#e5e7eb'};
        --myio-energy-radius: ${styles.borderRadius || '8px'};
        --myio-energy-font: ${styles.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'};
        
        font-family: var(--myio-energy-font);
        color: var(--myio-energy-text);
      }

      .myio-btn {
        padding: 8px 16px;
        border-radius: var(--myio-energy-radius);
        border: 1px solid var(--myio-energy-border);
        background: var(--myio-energy-bg);
        color: var(--myio-energy-text);
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }

      .myio-btn:hover:not(:disabled) {
        background: #f3f4f6;
      }

      .myio-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .myio-btn-primary {
        background: var(--myio-energy-primary);
        color: white;
        border-color: var(--myio-energy-primary);
      }

      .myio-btn-primary:hover:not(:disabled) {
        background: #6A1B9A;
      }

      .myio-btn-secondary {
        background: #f3f4f6;
        color: var(--myio-energy-text);
        border-color: var(--myio-energy-border);
      }

      .myio-btn-secondary:hover:not(:disabled) {
        background: #e5e7eb;
      }

      .myio-modal-scope {
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
      }

      .myio-energy-chart-container {
        flex: 1 !important;
        min-height: 800px !important;
        height: 800px !important;
        background: var(--myio-energy-bg);
        border-radius: var(--myio-energy-radius);
        border: 1px solid var(--myio-energy-border);
        padding: 10px !important;
        display: block !important;
        overflow: hidden !important;
      }

      .myio-energy-chart-container > iframe {
        width: 100% !important;
        height: 100% !important;
        min-height: 700px !important;
        border: none !important;
      }

      .myio-energy-chart-container iframe,
      .myio-energy-chart-container iframe body,
      .myio-energy-chart-container iframe html {
        height: 100% !important;
        min-height: 700px !important;
      }

      .myio-energy-chart-container .chart-wrapper,
      .myio-energy-chart-container .chart-container,
      .myio-energy-chart-container canvas,
      .myio-energy-chart-container svg {
        height: 700px !important;
        min-height: 700px !important;
      }

      .myio-loading-state {
        text-align: center;
      }

      .myio-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid var(--myio-energy-border);
        border-top: 4px solid var(--myio-energy-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .myio-energy-error {
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: var(--myio-energy-radius);
        padding: 16px;
      }

      .myio-error-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .myio-error-icon {
        font-size: 24px;
      }

      .myio-error-message {
        color: #dc2626;
        font-weight: 500;
      }



      .myio-fallback-chart h4 {
        margin: 0 0 16px 0;
        text-align: center;
      }

      .myio-chart-container {
        border: 1px solid var(--myio-energy-border);
        border-radius: var(--myio-energy-radius);
        overflow: hidden;
      }

      .myio-chart-note {
        margin: 12px 0 0 0;
        font-size: 12px;
        color: #666;
        text-align: center;
      }

      .myio-form-group {
        display: flex;
        flex-direction: column;
      }

      .myio-label {
        font-weight: 500;
        margin-bottom: 5px;
        color: var(--myio-energy-text);
      }

      .myio-input {
        padding: 8px 12px;
        border: 1px solid var(--myio-energy-border);
        border-radius: var(--myio-energy-radius);
        font-size: 14px;
        background: var(--myio-energy-bg);
        color: var(--myio-energy-text);
      }

      .myio-input:focus {
        outline: none;
        border-color: var(--myio-energy-primary);
        box-shadow: 0 0 0 3px rgba(74, 20, 140, 0.1);
      }

      @media (max-width: 768px) {
        .myio-energy-modal-layout {
          grid-template-columns: 1fr;
          grid-template-rows: auto 1fr;
        }
        
        .myio-energy-header {
          flex-direction: column;
          gap: 12px;
          align-items: stretch;
        }
      }
    `;
  }

  /**
   * Destroys the view and cleans up resources
   */
  destroy(): void {
    // Cleanup chart instance
    if ((this as any).chartInstance && typeof (this as any).chartInstance.destroy === 'function') {
      (this as any).chartInstance.destroy();
      (this as any).chartInstance = null;
    }

    // Cleanup DateRangePicker
    if (this.dateRangePicker) {
      this.dateRangePicker.destroy();
      this.dateRangePicker = null;
    }

    // Clear chart container
    if (this.chartContainer) {
      this.chartContainer.innerHTML = '';
    }

    this.currentEnergyData = null;
    this.container = null;
    this.chartContainer = null;
  }
}
