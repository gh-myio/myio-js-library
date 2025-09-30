// energy/EnergyModalView.ts - UI rendering and DOM manipulation for energy modal

import { toCsv } from '../internal/engines/CsvExporter';
import { fmtPt } from '../internal/engines/NumberFmt';
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
    
    container.innerHTML = `
      <style>
        ${this.getModalStyles()}
      </style>
      <div class="myio-energy-modal-layout">
        <!-- Left Column: Device Summary -->
        <div class="myio-energy-device-summary">
          ${this.renderDeviceSummary()}
        </div>
        
        <!-- Right Column: Chart and Data -->
        <div class="myio-energy-chart-section">
          <div class="myio-energy-header">
            <h3>${this.config.context.device.label}</h3>
            <div class="myio-energy-actions">
              <button id="export-csv-btn" class="myio-btn myio-btn-secondary" disabled>
                ${this.getI18nText('exportCsv')}
              </button>
              <button id="close-btn" class="myio-btn myio-btn-outline">
                ${this.getI18nText('close')}
              </button>
            </div>
          </div>
          
          <div id="energy-chart-container" class="myio-energy-chart-container">
            <div class="myio-loading-state">
              <div class="myio-spinner"></div>
              <p>${this.getI18nText('loading')}</p>
            </div>
          </div>
          
          <div id="energy-error" class="myio-energy-error" style="display: none;">
            <!-- Error messages will be displayed here -->
          </div>
          
          <div id="energy-kpis" class="myio-energy-kpis" style="display: none;">
            <!-- KPIs will be populated by renderEnergyData -->
          </div>
          
          <div id="energy-table" class="myio-energy-table" style="display: none;">
            <!-- Table will be populated by renderEnergyData -->
          </div>
        </div>
      </div>
    `;

    this.container = container;
    this.chartContainer = container.querySelector('#energy-chart-container') as HTMLElement;
    
    return container;
  }

  /**
   * Renders the device summary card
   */
  private renderDeviceSummary(): string {
    const { device, resolved } = this.config.context;
    const classification = classifyDevice(device.attributes);
    const icon = getDeviceIcon(classification);
    
    return `
      <div class="myio-device-card">
        <div class="myio-device-icon">
          ${icon}
        </div>
        <div class="myio-device-info">
          <h4>${device.label}</h4>
          <p class="myio-device-id">${device.id}</p>
          ${resolved.ingestionId ? `<p class="myio-ingestion-id">ID: ${resolved.ingestionId}</p>` : ''}
          ${device.attributes.floor ? `<p class="myio-device-floor">Floor: ${device.attributes.floor}</p>` : ''}
          ${device.attributes.NumLoja ? `<p class="myio-store-number">Store: ${device.attributes.NumLoja}</p>` : ''}
        </div>
      </div>
      
      <div class="myio-device-metadata">
        <h5>${this.getI18nText('deviceSummary')}</h5>
        <div class="myio-metadata-grid">
          ${resolved.centralId ? `<div><span>Central ID:</span> ${resolved.centralId}</div>` : ''}
          ${resolved.slaveId ? `<div><span>Slave ID:</span> ${resolved.slaveId}</div>` : ''}
          ${resolved.customerId ? `<div><span>Customer ID:</span> ${resolved.customerId}</div>` : ''}
        </div>
      </div>
    `;
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
    this.hideKPIs();
    this.hideTable();
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
    
    // Render KPIs
    this.renderKPIs(energyData);
    
    // Render data table
    this.renderDataTable(energyData);
    
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
      // Check if EnergyChartSDK is available
      if (typeof window !== 'undefined' && (window as any).EnergyChartSDK) {
        const chartConfig = {
          apiBaseUrl: this.config.params.dataApiHost,
          iframeBaseUrl: this.config.params.chartsBaseUrl,
          timezone: this.config.params.timezone || 'America/Sao_Paulo',
          deviceId: this.config.context.resolved.ingestionId,
          startDate: this.config.params.startDate,
          endDate: this.config.params.endDate,
          granularity: this.config.params.granularity || '1d',
          theme: this.config.params.theme || 'light',
          
          // Authentication
          ...(this.config.params.ingestionToken 
            ? { token: this.config.params.ingestionToken }
            : { 
                clientId: this.config.params.clientId, 
                clientSecret: this.config.params.clientSecret 
              }
          )
        };

        (window as any).EnergyChartSDK.renderTelemetryChart(this.chartContainer, chartConfig);
        return true;
      }
    } catch (error) {
      console.warn('[EnergyModalView] EnergyChartSDK failed, using fallback:', error);
    }
    
    return false;
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
   * Renders KPI cards
   */
  private renderKPIs(energyData: EnergyData): void {
    const kpisContainer = document.getElementById('energy-kpis');
    if (!kpisContainer) return;

    const totalConsumption = energyData.consumption.reduce((sum, item) => sum + item.value, 0);
    const averageDaily = totalConsumption / Math.max(1, energyData.consumption.length);
    const peakDay = energyData.consumption.reduce((max, item) => 
      item.value > max.value ? item : max, energyData.consumption[0] || { value: 0, timestamp: '' });

    kpisContainer.innerHTML = `
      <div class="myio-kpi-grid">
        <div class="myio-kpi-card">
          <div class="myio-kpi-value">${formatNumber(totalConsumption)} ${this.getI18nText('kwhUnit')}</div>
          <div class="myio-kpi-label">${this.getI18nText('totalConsumption')}</div>
        </div>
        <div class="myio-kpi-card">
          <div class="myio-kpi-value">${formatNumber(averageDaily)} ${this.getI18nText('kwhUnit')}</div>
          <div class="myio-kpi-label">${this.getI18nText('averageDaily')}</div>
        </div>
        <div class="myio-kpi-card">
          <div class="myio-kpi-value">${formatNumber(peakDay.value)} ${this.getI18nText('kwhUnit')}</div>
          <div class="myio-kpi-label">${this.getI18nText('peakDay')}</div>
          ${peakDay.timestamp ? `<div class="myio-kpi-date">${formatDate(peakDay.timestamp)}</div>` : ''}
        </div>
      </div>
    `;

    kpisContainer.style.display = 'block';
  }

  /**
   * Renders data table
   */
  private renderDataTable(energyData: EnergyData): void {
    const tableContainer = document.getElementById('energy-table');
    if (!tableContainer) return;

    const tableHTML = `
      <div class="myio-table-container">
        <h4>Consumption Data</h4>
        <div class="myio-table-wrapper">
          <table class="myio-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Consumption (${this.getI18nText('kwhUnit')})</th>
              </tr>
            </thead>
            <tbody>
              ${energyData.consumption.map(item => `
                <tr>
                  <td>${formatDate(item.timestamp)}</td>
                  <td>${formatNumber(item.value)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    tableContainer.innerHTML = tableHTML;
    tableContainer.style.display = 'block';
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
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    const exportBtn = document.getElementById('export-csv-btn');
    const closeBtn = document.getElementById('close-btn');

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

  private hideKPIs(): void {
    const kpisContainer = document.getElementById('energy-kpis');
    if (kpisContainer) {
      kpisContainer.style.display = 'none';
    }
  }

  private hideTable(): void {
    const tableContainer = document.getElementById('energy-table');
    if (tableContainer) {
      tableContainer.style.display = 'none';
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
   * Gets modal styles
   */
  private getModalStyles(): string {
    const styles = this.config.params.styles || {};
    
    return `
      .myio-energy-modal-scope {
        --myio-energy-primary: ${styles.primaryColor || '#6366f1'};
        --myio-energy-bg: ${styles.backgroundColor || '#ffffff'};
        --myio-energy-text: ${styles.textColor || '#1f2937'};
        --myio-energy-border: ${styles.borderColor || '#e5e7eb'};
        --myio-energy-radius: ${styles.borderRadius || '8px'};
        --myio-energy-font: ${styles.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'};
        
        font-family: var(--myio-energy-font);
        color: var(--myio-energy-text);
      }

      .myio-energy-modal-layout {
        display: grid;
        grid-template-columns: 300px 1fr;
        gap: 24px;
        height: 100%;
        padding: 20px;
      }

      .myio-energy-device-summary {
        background: var(--myio-energy-bg);
        border-radius: var(--myio-energy-radius);
        padding: 20px;
        border: 1px solid var(--myio-energy-border);
        height: fit-content;
      }

      .myio-device-card {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
      }

      .myio-device-icon {
        font-size: 48px;
        width: 64px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--myio-energy-primary);
        border-radius: var(--myio-energy-radius);
        color: white;
      }

      .myio-device-info h4 {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
      }

      .myio-device-info p {
        margin: 4px 0;
        font-size: 14px;
        color: #666;
      }

      .myio-device-metadata h5 {
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
      }

      .myio-metadata-grid div {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--myio-energy-border);
      }

      .myio-energy-chart-section {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .myio-energy-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .myio-energy-header h3 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
      }

      .myio-energy-actions {
        display: flex;
        gap: 12px;
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

      .myio-btn-secondary {
        background: var(--myio-energy-primary);
        color: white;
        border-color: var(--myio-energy-primary);
      }

      .myio-btn-secondary:hover:not(:disabled) {
        background: #5856eb;
      }

      .myio-energy-chart-container {
        flex: 1;
        min-height: 400px;
        background: var(--myio-energy-bg);
        border-radius: var(--myio-energy-radius);
        border: 1px solid var(--myio-energy-border);
        padding: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
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

      .myio-kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }

      .myio-kpi-card {
        background: var(--myio-energy-bg);
        border: 1px solid var(--myio-energy-border);
        border-radius: var(--myio-energy-radius);
        padding: 20px;
        text-align: center;
      }

      .myio-kpi-value {
        font-size: 24px;
        font-weight: bold;
        color: var(--myio-energy-primary);
        margin-bottom: 8px;
      }

      .myio-kpi-label {
        font-size: 14px;
        color: #666;
        margin-bottom: 4px;
      }

      .myio-kpi-date {
        font-size: 12px;
        color: #999;
      }

      .myio-table-container h4 {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
      }

      .myio-table-wrapper {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid var(--myio-energy-border);
        border-radius: var(--myio-energy-radius);
      }

      .myio-table {
        width: 100%;
        border-collapse: collapse;
      }

      .myio-table th,
      .myio-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--myio-energy-border);
      }

      .myio-table th {
        background: #f9fafb;
        font-weight: 600;
        position: sticky;
        top: 0;
      }

      .myio-table td:last-child {
        text-align: right;
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
        
        .myio-energy-actions {
          justify-content: center;
        }
      }
    `;
  }

  /**
   * Destroys the view and cleans up resources
   */
  destroy(): void {
    this.currentEnergyData = null;
    this.container = null;
    this.chartContainer = null;
  }
}
