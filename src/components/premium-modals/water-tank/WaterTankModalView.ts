// water-tank/WaterTankModalView.ts - UI rendering for water tank modal

import {
  WaterTankModalContext,
  WaterTankModalError,
  WaterTankTelemetryData,
  OpenDashboardPopupWaterTankOptions,
  WaterTankModalI18n
} from './types';

interface WaterTankModalViewConfig {
  context: WaterTankModalContext;
  params: OpenDashboardPopupWaterTankOptions;
  data: WaterTankTelemetryData;
  onExport: () => void;
  onError: (error: WaterTankModalError) => void;
  onClose: () => void;
  onDateRangeChange?: (startTs: number, endTs: number) => void;
  onParamsChange?: (params: { startTs: number; endTs: number; aggregation: string; limit: number }) => void;
}

// RFC-0107: Chart display mode
type ChartDisplayMode = 'water_level' | 'water_percentage';

/**
 * View class for Water Tank Modal
 *
 * Displays:
 * - Visual water tank with percentage level (water_percentage * 100)
 * - Chart showing water_level (m.c.a) over time
 * - Date range picker to change the time period
 */
export class WaterTankModalView {
  private config: WaterTankModalViewConfig;
  private overlay: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private i18n: WaterTankModalI18n;
  private chartDisplayMode: ChartDisplayMode = 'water_level'; // RFC-0107: Default to water_level (m.c.a)

  constructor(config: WaterTankModalViewConfig) {
    this.config = config;
    this.i18n = this.getI18n();
    // RFC-0107: Use displayKey from params if specified
    if (config.params.displayKey) {
      this.chartDisplayMode = config.params.displayKey;
    }
  }

  /**
   * Get i18n strings with defaults
   */
  private getI18n(): WaterTankModalI18n {
    const defaults: WaterTankModalI18n = {
      title: 'Caixa d\'Água',
      loading: 'Carregando...',
      error: 'Erro ao carregar dados',
      noData: 'Nenhum dado disponível',
      exportCsv: 'Exportar CSV',
      close: 'Fechar',
      currentLevel: 'Nível Atual',
      averageLevel: 'Nível Médio',
      minLevel: 'Nível Mínimo',
      maxLevel: 'Nível Máximo',
      dateRange: 'Período',
      deviceInfo: 'Informações do Dispositivo',
      levelChart: 'Histórico de Nível (m.c.a)',
      percentUnit: '%',
      status: {
        critical: 'Crítico',
        low: 'Baixo',
        medium: 'Médio',
        good: 'Bom',
        full: 'Cheio'
      }
    };

    return {
      ...defaults,
      ...this.config.params.i18n
    };
  }

  /**
   * Get level status based on percentage
   */
  private getLevelStatus(level: number): {
    status: keyof WaterTankModalI18n['status'];
    color: string;
    label: string;
  } {
    if (level < 20) {
      return { status: 'critical', color: '#e74c3c', label: this.i18n.status.critical };
    } else if (level < 40) {
      return { status: 'low', color: '#e67e22', label: this.i18n.status.low };
    } else if (level < 70) {
      return { status: 'medium', color: '#f39c12', label: this.i18n.status.medium };
    } else if (level < 90) {
      return { status: 'good', color: '#27ae60', label: this.i18n.status.good };
    } else {
      return { status: 'full', color: '#3498db', label: this.i18n.status.full };
    }
  }

  /**
   * Get tank image URL based on level percentage (same logic as device card)
   */
  private getTankImageUrl(percentage: number): string {
    if (percentage >= 70) {
      return "https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq"; // 70-100%
    } else if (percentage >= 40) {
      return "https://dashboard.myio-bas.com/api/images/public/4UBbShfXCVWR9wcw6IzVMNran4x1EW5n"; // 40-69%
    } else if (percentage >= 20) {
      return "https://dashboard.myio-bas.com/api/images/public/aB9nX28F54fBBQs1Ht8jKUdYAMcq9QSm"; // 20-39%
    } else {
      return "https://dashboard.myio-bas.com/api/images/public/qLdwhV4qw295poSCa7HinpnmXoN7dAPO"; // 0-19%
    }
  }

  /**
   * Format timestamp to readable date
   */
  private formatDate(ts: number, includeTime: boolean = true): string {
    const date = new Date(ts);
    const dateStr = date.toLocaleDateString('pt-BR');
    if (includeTime) {
      const timeStr = date.toLocaleTimeString('pt-BR');
      return `${dateStr} ${timeStr}`;
    }
    return dateStr;
  }

  /**
   * Format timestamp to ISO date string for input
   */
  private formatDateForInput(ts: number): string {
    const date = new Date(ts);
    return date.toISOString().split('T')[0];
  }

  /**
   * Render the modal HTML
   */
  public render(): void {
    const { params } = this.config;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'myio-water-tank-modal-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: ${params.zIndex || 10000};
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'myio-water-tank-modal';
    this.modal.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      width: ${params.ui?.width || 700}px;
      max-width: 95vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      transform: scale(0.9);
      transition: transform 0.3s ease;
    `;

    // Modal content
    this.modal.innerHTML = `
      ${this.renderHeader()}
      ${this.renderBody()}
    `;

    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render modal header - MyIO Premium Style
   */
  private renderHeader(): string {
    const { context, params } = this.config;
    const title = params.ui?.title || `${this.i18n.title} - ${context.device.label}`;

    return `
      <div class="myio-water-tank-modal-header" style="
        padding: 4px 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #3e1a7d;
        color: white;
        border-radius: 12px 12px 0 0;
        min-height: 20px;
      ">
        <h2 style="
          margin: 6px;
          font-size: 18px;
          font-weight: 600;
          color: white;
          line-height: 2;
        ">💧 ${title}</h2>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button class="myio-water-tank-modal-close" title="${this.i18n.close}" style="
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
            color: rgba(255,255,255,0.8);
            transition: background-color 0.2s;
          ">×</button>
        </div>
      </div>
    `;
  }

  /**
   * RFC-0107: Render modal body with new layout
   * Left side: Tank visualization with percentage
   * Right side: Chart with controls (larger area)
   */
  private renderBody(): string {
    return `
      <div class="myio-water-tank-modal-body" style="
        padding: 20px;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
      ">
        ${this.renderControlsBar()}
        <div style="
          display: flex;
          gap: 20px;
          flex: 1;
          min-height: 400px;
        ">
          ${this.renderTankPanel()}
          ${this.renderChartPanel()}
        </div>
      </div>
      ${this.renderFooter()}
    `;
  }

  /**
   * RFC-0107: Render controls bar with date range, aggregation, and limit
   */
  private renderControlsBar(): string {
    const { params } = this.config;
    const startDate = this.formatDateForInput(params.startTs);
    const endDate = this.formatDateForInput(params.endTs);
    const currentAggregation = params.aggregation || 'NONE';
    const currentLimit = params.limit || 1000;

    return `
      <div style="
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 13px; font-weight: 500; color: #2c3e50;">De:</label>
          <input type="date" id="myio-water-tank-start-date" value="${startDate}" style="
            padding: 6px 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 13px;
            color: #2c3e50;
            cursor: pointer;
          "/>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 13px; font-weight: 500; color: #2c3e50;">Até:</label>
          <input type="date" id="myio-water-tank-end-date" value="${endDate}" style="
            padding: 6px 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 13px;
            color: #2c3e50;
            cursor: pointer;
          "/>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 13px; font-weight: 500; color: #2c3e50;">Agregação:</label>
          <select id="myio-water-tank-aggregation" style="
            padding: 6px 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 13px;
            color: #2c3e50;
            background: white;
            cursor: pointer;
          ">
            <option value="NONE" ${currentAggregation === 'NONE' ? 'selected' : ''}>Nenhuma</option>
            <option value="AVG" ${currentAggregation === 'AVG' ? 'selected' : ''}>Média</option>
            <option value="MIN" ${currentAggregation === 'MIN' ? 'selected' : ''}>Mínimo</option>
            <option value="MAX" ${currentAggregation === 'MAX' ? 'selected' : ''}>Máximo</option>
            <option value="SUM" ${currentAggregation === 'SUM' ? 'selected' : ''}>Soma</option>
            <option value="COUNT" ${currentAggregation === 'COUNT' ? 'selected' : ''}>Contagem</option>
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 13px; font-weight: 500; color: #2c3e50;">Limite:</label>
          <select id="myio-water-tank-limit" style="
            padding: 6px 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 13px;
            color: #2c3e50;
            background: white;
            cursor: pointer;
          ">
            <option value="100" ${currentLimit === 100 ? 'selected' : ''}>100</option>
            <option value="500" ${currentLimit === 500 ? 'selected' : ''}>500</option>
            <option value="1000" ${currentLimit === 1000 ? 'selected' : ''}>1000</option>
            <option value="2000" ${currentLimit === 2000 ? 'selected' : ''}>2000</option>
            <option value="5000" ${currentLimit === 5000 ? 'selected' : ''}>5000</option>
          </select>
        </div>
        <button id="myio-water-tank-apply-dates" style="
          background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
          color: white;
          border: none;
          padding: 6px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        ">
          Aplicar
        </button>
      </div>
    `;
  }

  /**
   * RFC-0107: Render tank panel (left side)
   */
  private renderTankPanel(): string {
    const { data, context } = this.config;

    // Get water_percentage from telemetry or context
    let percentage = 0;

    // Try to get the latest water_percentage value
    const percentagePoints = data.telemetry.filter(p => p.key === 'water_percentage');
    if (percentagePoints.length > 0) {
      const latestPercentage = percentagePoints[percentagePoints.length - 1].value;
      percentage = latestPercentage <= 1.5 ? latestPercentage * 100 : latestPercentage;
    } else if (context.device.currentLevel !== undefined) {
      const level = context.device.currentLevel;
      percentage = level <= 1.5 ? level * 100 : level;
    }

    const levelStatus = this.getLevelStatus(Math.min(percentage, 100));
    const tankImageUrl = this.getTankImageUrl(Math.min(percentage, 100));
    const displayPercentage = percentage.toFixed(1);

    return `
      <div style="
        width: 200px;
        min-width: 200px;
        background: linear-gradient(135deg, ${levelStatus.color}10 0%, ${levelStatus.color}05 100%);
        border: 1px solid ${levelStatus.color}30;
        border-radius: 12px;
        padding: 24px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
      ">
        <img src="${tankImageUrl}" alt="Water Tank" style="
          width: 100px;
          height: auto;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
        "/>
        <div style="
          font-size: 42px;
          font-weight: 700;
          color: ${levelStatus.color};
          line-height: 1;
        ">${displayPercentage}%</div>
        <div style="
          background: ${levelStatus.color};
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        ">${levelStatus.label}</div>
        <div style="
          font-size: 12px;
          color: #7f8c8d;
          text-align: center;
        ">${this.i18n.currentLevel}</div>
      </div>
    `;
  }

  /**
   * RFC-0107: Render chart panel (right side) with maximize button
   */
  private renderChartPanel(): string {
    const chartPoints = this.getChartDataPoints();
    const chartTitle = this.chartDisplayMode === 'water_percentage'
      ? 'Histórico de Nível (%)'
      : this.i18n.levelChart;

    if (chartPoints.length === 0) {
      const displayLabel = this.chartDisplayMode === 'water_percentage' ? '%' : 'm.c.a';
      return `
        <div style="
          flex: 1;
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
        ">
          <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">📊</div>
          <div style="color: #7f8c8d; font-size: 16px;">${this.i18n.noData}</div>
          <div style="color: #bdc3c7; font-size: 13px; margin-top: 8px;">
            Sem dados de ${this.chartDisplayMode === 'water_percentage' ? 'percentual' : 'nível'} (${displayLabel}) disponíveis
          </div>
        </div>
      `;
    }

    const firstTs = chartPoints[0]?.ts;
    const lastTs = chartPoints[chartPoints.length - 1]?.ts;

    return `
      <div id="myio-water-tank-chart-panel" style="
        flex: 1;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        position: relative;
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        ">
          <h3 style="
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: #2c3e50;
          ">${chartTitle}</h3>
          <div style="
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <select id="myio-water-tank-display-mode" style="
              padding: 4px 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 12px;
              color: #2c3e50;
              background: white;
              cursor: pointer;
            ">
              <option value="water_level" ${this.chartDisplayMode === 'water_level' ? 'selected' : ''}>Nível (m.c.a)</option>
              <option value="water_percentage" ${this.chartDisplayMode === 'water_percentage' ? 'selected' : ''}>Percentual (%)</option>
            </select>
            <button id="myio-water-tank-maximize" title="Maximizar gráfico" style="
              background: #f0f0f0;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 4px 8px;
              cursor: pointer;
              font-size: 14px;
              display: flex;
              align-items: center;
              justify-content: center;
            ">⛶</button>
          </div>
        </div>
        <div style="flex: 1; min-height: 300px;">
          <canvas id="myio-water-tank-chart" style="width: 100%; height: 100%;"></canvas>
        </div>
        ${firstTs && lastTs ? `
          <div style="
            margin-top: 8px;
            font-size: 11px;
            color: #7f8c8d;
            text-align: center;
          ">
            ${this.formatDate(firstTs, false)} — ${this.formatDate(lastTs, false)}
            (${chartPoints.length} leituras)
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render date range picker
   */
  private renderDateRangePicker(): string {
    const { params } = this.config;
    const startDate = this.formatDateForInput(params.startTs);
    const endDate = this.formatDateForInput(params.endTs);

    return `
      <div style="
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 14px; font-weight: 500; color: #2c3e50;">De:</label>
          <input type="date" id="myio-water-tank-start-date" value="${startDate}" style="
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            color: #2c3e50;
            cursor: pointer;
          "/>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 14px; font-weight: 500; color: #2c3e50;">Até:</label>
          <input type="date" id="myio-water-tank-end-date" value="${endDate}" style="
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            color: #2c3e50;
            cursor: pointer;
          "/>
        </div>
        <button id="myio-water-tank-apply-dates" style="
          background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        ">
          Aplicar
        </button>
      </div>
    `;
  }

  /**
   * Render tank visualization with percentage
   */
  private renderTankVisualization(): string {
    const { data, context } = this.config;

    // Get water_percentage from telemetry or context
    // water_percentage is 0-1, so multiply by 100 for display
    let percentage = 0;

    // Try to get the latest water_percentage value
    const percentagePoints = data.telemetry.filter(p => p.key === 'water_percentage');
    if (percentagePoints.length > 0) {
      const latestPercentage = percentagePoints[percentagePoints.length - 1].value;
      // If value is <= 1, it's in 0-1 format, multiply by 100
      percentage = latestPercentage <= 1 ? latestPercentage * 100 : latestPercentage;
    } else if (context.device.currentLevel !== undefined) {
      // Fallback to currentLevel from context
      const level = context.device.currentLevel;
      percentage = level <= 1 ? level * 100 : level;
    }

    const levelStatus = this.getLevelStatus(percentage);
    const tankImageUrl = this.getTankImageUrl(percentage);

    return `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 32px;
        padding: 24px;
        background: linear-gradient(135deg, ${levelStatus.color}10 0%, ${levelStatus.color}05 100%);
        border: 1px solid ${levelStatus.color}30;
        border-radius: 12px;
        margin-bottom: 24px;
      ">
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        ">
          <img src="${tankImageUrl}" alt="Water Tank" style="
            width: 120px;
            height: auto;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
          "/>
          <div style="
            background: ${levelStatus.color};
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          ">${levelStatus.label}</div>
        </div>

        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        ">
          <div style="
            font-size: 48px;
            font-weight: 700;
            color: ${levelStatus.color};
            line-height: 1;
          ">${percentage.toFixed(1)}%</div>
          <div style="
            font-size: 14px;
            color: #7f8c8d;
            font-weight: 500;
          ">${this.i18n.currentLevel}</div>
        </div>
      </div>
    `;
  }

  /**
   * RFC-0107: Render chart section with display mode selector
   * Shows water_level (m.c.a) or water_percentage (%) based on user selection
   */
  private renderChart(): string {
    const { data } = this.config;

    // Get data points for current display mode
    const chartPoints = this.getChartDataPoints();

    if (chartPoints.length === 0) {
      const displayLabel = this.chartDisplayMode === 'water_percentage' ? '%' : 'm.c.a';
      return `
        <div style="
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 48px;
          text-align: center;
        ">
          <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">📊</div>
          <div style="color: #7f8c8d; font-size: 16px;">${this.i18n.noData}</div>
          <div style="color: #bdc3c7; font-size: 13px; margin-top: 8px;">
            No ${this.chartDisplayMode} (${displayLabel}) data available for this period
          </div>
        </div>
      `;
    }

    const firstTs = chartPoints[0]?.ts;
    const lastTs = chartPoints[chartPoints.length - 1]?.ts;
    const chartTitle = this.chartDisplayMode === 'water_percentage'
      ? 'Water Level History (%)'
      : this.i18n.levelChart;

    return `
      <div style="
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 20px;
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        ">
          <h3 style="
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #2c3e50;
          ">${chartTitle}</h3>
          <div style="
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <span style="font-size: 13px; color: #7f8c8d;">Display:</span>
            <select id="myio-water-tank-display-mode" style="
              padding: 6px 12px;
              border: 1px solid #ddd;
              border-radius: 6px;
              font-size: 13px;
              color: #2c3e50;
              background: white;
              cursor: pointer;
            ">
              <option value="water_level" ${this.chartDisplayMode === 'water_level' ? 'selected' : ''}>Level (m.c.a)</option>
              <option value="water_percentage" ${this.chartDisplayMode === 'water_percentage' ? 'selected' : ''}>Percentage (%)</option>
            </select>
          </div>
        </div>
        <canvas id="myio-water-tank-chart" style="width: 100%; height: 280px;"></canvas>
        ${firstTs && lastTs ? `
          <div style="
            margin-top: 12px;
            font-size: 12px;
            color: #7f8c8d;
            text-align: center;
          ">
            ${this.formatDate(firstTs, false)} — ${this.formatDate(lastTs, false)}
            (${chartPoints.length} readings)
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * RFC-0107: Get chart data points based on current display mode
   */
  private getChartDataPoints(): Array<{ ts: number; value: number; key?: string }> {
    const { data } = this.config;

    if (this.chartDisplayMode === 'water_percentage') {
      // Filter for water_percentage points
      const percentagePoints = data.telemetry.filter(p => p.key === 'water_percentage');
      // Convert from 0-1 to 0-100 if needed
      return percentagePoints.map(p => ({
        ...p,
        value: p.value <= 1.5 ? p.value * 100 : p.value
      }));
    } else {
      // Filter for water_level points
      return data.telemetry.filter(p =>
        p.key === 'water_level' || p.key === 'waterLevel' || p.key === 'nivel' || p.key === 'level'
      );
    }
  }

  /**
   * Render footer with actions
   */
  private renderFooter(): string {
    const { params } = this.config;

    if (!params.ui?.showExport) {
      return '';
    }

    return `
      <div class="myio-water-tank-modal-footer" style="
        padding: 16px 24px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      ">
        <button class="myio-water-tank-export-btn" style="
          background: #3498db;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s ease;
        ">
          ${this.i18n.exportCsv}
        </button>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.overlay || !this.modal) return;

    // Close button
    const closeBtn = this.modal.querySelector('.myio-water-tank-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.config.onClose());
    }

    // Export button
    const exportBtn = this.modal.querySelector('.myio-water-tank-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.config.onExport());
    }

    // Date range apply button - now also reads aggregation and limit
    const applyDatesBtn = this.modal.querySelector('#myio-water-tank-apply-dates');
    if (applyDatesBtn) {
      applyDatesBtn.addEventListener('click', () => this.handleApplyParams());
    }

    // RFC-0107: Display mode selector
    const displayModeSelect = this.modal.querySelector('#myio-water-tank-display-mode') as HTMLSelectElement;
    if (displayModeSelect) {
      displayModeSelect.addEventListener('change', () => {
        this.chartDisplayMode = displayModeSelect.value as ChartDisplayMode;
        this.refreshChart();
      });
    }

    // RFC-0107: Maximize button
    const maximizeBtn = this.modal.querySelector('#myio-water-tank-maximize');
    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', () => this.handleMaximize());
    }

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.config.onClose();
      }
    });

    // Close on ESC key
    if (this.config.params.closeOnEsc) {
      this.handleEscapeKey = this.handleEscapeKey.bind(this);
      document.addEventListener('keydown', this.handleEscapeKey);
    }

    // Render chart after DOM is ready
    requestAnimationFrame(() => {
      this.renderCanvasChart();
    });
  }

  /**
   * Handle date range change (legacy - kept for compatibility)
   */
  private handleDateRangeChange(): void {
    this.handleApplyParams();
  }

  /**
   * RFC-0107: Handle apply params (date range, aggregation, limit)
   */
  private handleApplyParams(): void {
    if (!this.modal) return;

    const startInput = this.modal.querySelector('#myio-water-tank-start-date') as HTMLInputElement;
    const endInput = this.modal.querySelector('#myio-water-tank-end-date') as HTMLInputElement;
    const aggregationSelect = this.modal.querySelector('#myio-water-tank-aggregation') as HTMLSelectElement;
    const limitSelect = this.modal.querySelector('#myio-water-tank-limit') as HTMLSelectElement;

    if (startInput && endInput) {
      const startTs = new Date(startInput.value).setHours(0, 0, 0, 0);
      const endTs = new Date(endInput.value).setHours(23, 59, 59, 999);

      if (startTs >= endTs) {
        alert('Start date must be before end date');
        return;
      }

      const aggregation = aggregationSelect?.value || 'NONE';
      const limit = parseInt(limitSelect?.value || '1000', 10);

      console.log('[WaterTankModalView] Params changed:', {
        startTs,
        endTs,
        aggregation,
        limit,
        startDate: new Date(startTs).toISOString(),
        endDate: new Date(endTs).toISOString()
      });

      // Update local params
      this.config.params.startTs = startTs;
      this.config.params.endTs = endTs;
      this.config.params.aggregation = aggregation as OpenDashboardPopupWaterTankOptions['aggregation'];
      this.config.params.limit = limit;

      // Use new callback if available, otherwise fall back to onDateRangeChange
      if (this.config.onParamsChange) {
        this.config.onParamsChange({ startTs, endTs, aggregation, limit });
      } else if (this.config.onDateRangeChange) {
        this.config.onDateRangeChange(startTs, endTs);
      }
    }
  }

  /**
   * RFC-0107: Handle maximize/restore chart
   */
  private isMaximized = false;
  private originalModalStyle: string = '';

  private handleMaximize(): void {
    if (!this.modal) return;

    const chartPanel = this.modal.querySelector('#myio-water-tank-chart-panel') as HTMLElement;
    const tankPanel = chartPanel?.previousElementSibling as HTMLElement;
    const maximizeBtn = this.modal.querySelector('#myio-water-tank-maximize') as HTMLButtonElement;

    if (!chartPanel) return;

    if (this.isMaximized) {
      // Restore original layout
      this.modal.style.cssText = this.originalModalStyle;
      if (tankPanel) tankPanel.style.display = '';
      chartPanel.style.cssText = `
        flex: 1;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        position: relative;
      `;
      if (maximizeBtn) maximizeBtn.textContent = '⛶';
      this.isMaximized = false;
    } else {
      // Maximize chart
      this.originalModalStyle = this.modal.style.cssText;
      this.modal.style.width = '95vw';
      this.modal.style.height = '90vh';
      this.modal.style.maxWidth = '95vw';
      if (tankPanel) tankPanel.style.display = 'none';
      chartPanel.style.cssText = `
        flex: 1;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        position: relative;
        min-height: 100%;
      `;
      if (maximizeBtn) maximizeBtn.textContent = '⛶';
      this.isMaximized = true;
    }

    // Re-render chart with new size
    requestAnimationFrame(() => {
      this.renderCanvasChart();
    });
  }

  private handleEscapeKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.config.onClose();
    }
  }

  /**
   * RFC-0107: Refresh chart when display mode changes
   */
  private refreshChart(): void {
    if (!this.modal) return;

    // Update chart title
    const chartTitle = this.chartDisplayMode === 'water_percentage'
      ? 'Water Level History (%)'
      : this.i18n.levelChart;

    const titleEl = this.modal.querySelector('.myio-water-tank-modal-body h3:last-of-type');
    if (titleEl) {
      titleEl.textContent = chartTitle;
    }

    // Re-render canvas chart with new data
    this.renderCanvasChart();
  }

  /**
   * RFC-0107: Render chart using Canvas API
   * Shows water_level (m.c.a) or water_percentage (%) based on display mode
   */
  private renderCanvasChart(): void {
    const canvas = document.getElementById('myio-water-tank-chart') as HTMLCanvasElement;
    if (!canvas) return;

    // Get data points based on current display mode
    const points = this.getChartDataPoints();

    if (points.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = 280 * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = 280;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate data range
    const values = points.map(p => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;
    const valuePadding = valueRange * 0.1;

    const chartMinY = minValue - valuePadding;
    const chartMaxY = maxValue + valuePadding;
    const chartRangeY = chartMaxY - chartMinY;

    // Draw background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(padding.left, padding.top, width - padding.left - padding.right, height - padding.top - padding.bottom);

    // Draw grid lines and Y-axis labels
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#666';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';

    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + (height - padding.top - padding.bottom) * (i / ySteps);
      const value = chartMaxY - (chartRangeY * i / ySteps);

      // Grid line
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-axis label (m.c.a)
      ctx.fillText(`${value.toFixed(2)}`, padding.left - 8, y + 4);
    }

    // Y-axis title - RFC-0107: Show correct unit based on display mode
    const yAxisLabel = this.chartDisplayMode === 'water_percentage' ? '%' : 'm.c.a';
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.fillText(yAxisLabel, 0, 0);
    ctx.restore();

    // Draw axes
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw data line
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const xScale = chartWidth / (points.length - 1);

    // Fill area under curve
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);

    points.forEach((point, index) => {
      const x = padding.left + index * xScale;
      const y = padding.top + chartHeight - ((point.value - chartMinY) / chartRangeY) * chartHeight;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(padding.left + (points.length - 1) * xScale, height - padding.bottom);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(52, 152, 219, 0.3)');
    gradient.addColorStop(1, 'rgba(52, 152, 219, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    points.forEach((point, index) => {
      const x = padding.left + index * xScale;
      const y = padding.top + chartHeight - ((point.value - chartMinY) / chartRangeY) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw data points (only if not too many)
    if (points.length <= 50) {
      ctx.fillStyle = '#3498db';
      points.forEach((point, index) => {
        const x = padding.left + index * xScale;
        const y = padding.top + chartHeight - ((point.value - chartMinY) / chartRangeY) * chartHeight;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw X-axis labels (timestamps)
    ctx.fillStyle = '#888';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';

    const xLabelCount = Math.min(6, points.length);
    const xLabelStep = Math.floor(points.length / xLabelCount);

    for (let i = 0; i < points.length; i += xLabelStep) {
      const x = padding.left + i * xScale;
      const date = new Date(points[i].ts);
      const label = `${date.getDate()}/${date.getMonth() + 1}`;
      ctx.fillText(label, x, height - padding.bottom + 16);
    }

    // Draw last point label
    if (points.length > 1) {
      const lastX = padding.left + (points.length - 1) * xScale;
      const lastDate = new Date(points[points.length - 1].ts);
      const lastLabel = `${lastDate.getDate()}/${lastDate.getMonth() + 1}`;
      ctx.fillText(lastLabel, lastX, height - padding.bottom + 16);
    }
  }

  /**
   * Update data and re-render chart with new layout
   */
  public updateData(data: WaterTankTelemetryData): void {
    this.config.data = data;

    // Re-render with new layout (controls bar, tank panel, chart panel)
    if (this.modal) {
      const bodyEl = this.modal.querySelector('.myio-water-tank-modal-body');
      if (bodyEl) {
        bodyEl.innerHTML = `
          ${this.renderControlsBar()}
          <div style="
            display: flex;
            gap: 20px;
            flex: 1;
            min-height: 400px;
          ">
            ${this.renderTankPanel()}
            ${this.renderChartPanel()}
          </div>
        `;

        // Re-attach apply params event
        const applyDatesBtn = this.modal.querySelector('#myio-water-tank-apply-dates');
        if (applyDatesBtn) {
          applyDatesBtn.addEventListener('click', () => this.handleApplyParams());
        }

        // Re-attach display mode selector event
        const displayModeSelect = this.modal.querySelector('#myio-water-tank-display-mode') as HTMLSelectElement;
        if (displayModeSelect) {
          displayModeSelect.addEventListener('change', () => {
            this.chartDisplayMode = displayModeSelect.value as ChartDisplayMode;
            this.refreshChart();
          });
        }

        // Re-attach maximize button event
        const maximizeBtn = this.modal.querySelector('#myio-water-tank-maximize');
        if (maximizeBtn) {
          maximizeBtn.addEventListener('click', () => this.handleMaximize());
        }

        // Re-render chart
        requestAnimationFrame(() => {
          this.renderCanvasChart();
        });
      }
    }
  }

  /**
   * Show the modal with animation
   */
  public show(): void {
    if (!this.overlay || !this.modal) return;

    requestAnimationFrame(() => {
      if (this.overlay && this.modal) {
        this.overlay.style.opacity = '1';
        this.modal.style.transform = 'scale(1)';
      }
    });
  }

  /**
   * Destroy the modal and cleanup
   */
  public destroy(): void {
    // Remove event listeners
    if (this.config.params.closeOnEsc) {
      document.removeEventListener('keydown', this.handleEscapeKey);
    }

    // Animate out
    if (this.overlay && this.modal) {
      this.overlay.style.opacity = '0';
      this.modal.style.transform = 'scale(0.9)';

      setTimeout(() => {
        if (this.overlay) {
          document.body.removeChild(this.overlay);
          this.overlay = null;
          this.modal = null;
        }
      }, 300);
    }
  }
}
