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
}

/**
 * View class for Water Tank Modal
 *
 * Responsibilities:
 * - Render modal HTML structure
 * - Display telemetry data and charts
 * - Handle UI interactions
 * - Manage modal lifecycle (show, hide, destroy)
 */
export class WaterTankModalView {
  private config: WaterTankModalViewConfig;
  private overlay: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private i18n: WaterTankModalI18n;

  constructor(config: WaterTankModalViewConfig) {
    this.config = config;
    this.i18n = this.getI18n();
  }

  /**
   * Get i18n strings with defaults
   */
  private getI18n(): WaterTankModalI18n {
    const defaults: WaterTankModalI18n = {
      title: 'Water Tank',
      loading: 'Loading...',
      error: 'Error loading data',
      noData: 'No data available',
      exportCsv: 'Export CSV',
      close: 'Close',
      currentLevel: 'Current Level',
      averageLevel: 'Average Level',
      minLevel: 'Minimum Level',
      maxLevel: 'Maximum Level',
      dateRange: 'Date Range',
      deviceInfo: 'Device Information',
      levelChart: 'Level Chart',
      percentUnit: '%',
      status: {
        critical: 'Critical',
        low: 'Low',
        medium: 'Medium',
        good: 'Good',
        full: 'Full'
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
   * Render the modal HTML
   */
  public render(): void {
    const { context, params, data } = this.config;
    const currentLevel = data.summary.currentLevel ?? context.device.currentLevel ?? 0;
    const levelStatus = this.getLevelStatus(currentLevel);

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
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      width: ${params.ui?.width || 900}px;
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
   * Render modal header
   */
  private renderHeader(): string {
    const { context, params } = this.config;
    const title = params.ui?.title || `${this.i18n.title} - ${context.device.label}`;

    return `
      <div class="myio-water-tank-modal-header" style="
        padding: 20px 24px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <h2 style="
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #2c3e50;
        ">${title}</h2>
        <button class="myio-water-tank-modal-close" style="
          background: none;
          border: none;
          font-size: 24px;
          color: #7f8c8d;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s ease;
        " title="${this.i18n.close}">
          ×
        </button>
      </div>
    `;
  }

  /**
   * Render modal body
   */
  private renderBody(): string {
    return `
      <div class="myio-water-tank-modal-body" style="
        padding: 24px;
        overflow-y: auto;
        flex: 1;
      ">
        ${this.renderSummaryCards()}
        ${this.renderChart()}
        ${this.renderDeviceInfo()}
      </div>
      ${this.renderFooter()}
    `;
  }

  /**
   * Render summary cards
   */
  private renderSummaryCards(): string {
    const { data } = this.config;
    const currentLevel = data.summary.currentLevel ?? 0;
    const levelStatus = this.getLevelStatus(currentLevel);

    return `
      <div style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      ">
        ${this.renderSummaryCard(
          this.i18n.currentLevel,
          `${currentLevel.toFixed(1)}${this.i18n.percentUnit}`,
          levelStatus.color,
          levelStatus.label
        )}
        ${this.renderSummaryCard(
          this.i18n.averageLevel,
          `${data.summary.avgLevel.toFixed(1)}${this.i18n.percentUnit}`,
          '#3498db'
        )}
        ${this.renderSummaryCard(
          this.i18n.minLevel,
          `${data.summary.minLevel.toFixed(1)}${this.i18n.percentUnit}`,
          '#e74c3c'
        )}
        ${this.renderSummaryCard(
          this.i18n.maxLevel,
          `${data.summary.maxLevel.toFixed(1)}${this.i18n.percentUnit}`,
          '#27ae60'
        )}
      </div>
    `;
  }

  /**
   * Render a single summary card
   */
  private renderSummaryCard(label: string, value: string, color: string, badge?: string): string {
    return `
      <div style="
        background: linear-gradient(135deg, ${color}15 0%, ${color}05 100%);
        border: 1px solid ${color}30;
        border-radius: 8px;
        padding: 16px;
        position: relative;
      ">
        ${badge ? `
          <div style="
            position: absolute;
            top: 12px;
            right: 12px;
            background: ${color};
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
          ">${badge}</div>
        ` : ''}
        <div style="
          font-size: 12px;
          color: #7f8c8d;
          margin-bottom: 8px;
          font-weight: 500;
        ">${label}</div>
        <div style="
          font-size: 28px;
          font-weight: 700;
          color: ${color};
        ">${value}</div>
      </div>
    `;
  }

  /**
   * Render chart section
   */
  private renderChart(): string {
    const { data } = this.config;

    if (data.telemetry.length === 0) {
      return `
        <div style="
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 48px;
          text-align: center;
          margin-bottom: 24px;
        ">
          <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">📊</div>
          <div style="color: #7f8c8d; font-size: 16px;">${this.i18n.noData}</div>
        </div>
      `;
    }

    // Simple ASCII-style chart with canvas
    return `
      <div style="
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 24px;
      ">
        <h3 style="
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #2c3e50;
        ">${this.i18n.levelChart}</h3>
        <canvas id="myio-water-tank-chart" style="width: 100%; height: 300px;"></canvas>
        <div style="
          margin-top: 16px;
          font-size: 12px;
          color: #7f8c8d;
          text-align: center;
        ">
          ${this.i18n.dateRange}: ${this.formatDate(data.summary.firstReadingTs!, false)} - ${this.formatDate(data.summary.lastReadingTs!, false)}
        </div>
      </div>
    `;
  }

  /**
   * Render device info section
   */
  private renderDeviceInfo(): string {
    const { context, data } = this.config;

    return `
      <div style="
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 20px;
      ">
        <h3 style="
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #2c3e50;
        ">${this.i18n.deviceInfo}</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
          ${this.renderInfoRow('Device ID', context.device.id)}
          ${this.renderInfoRow('Label', context.device.label)}
          ${context.device.type ? this.renderInfoRow('Type', context.device.type) : ''}
          ${context.metadata.slaveId ? this.renderInfoRow('Slave ID', String(context.metadata.slaveId)) : ''}
          ${context.metadata.centralId ? this.renderInfoRow('Central ID', context.metadata.centralId) : ''}
          ${this.renderInfoRow('Total Readings', String(data.summary.totalReadings))}
          ${this.renderInfoRow('Data Keys', data.metadata.keys.join(', '))}
        </div>
      </div>
    `;
  }

  /**
   * Render an info row
   */
  private renderInfoRow(label: string, value: string): string {
    return `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #7f8c8d; font-size: 13px;">${label}:</span>
        <span style="color: #2c3e50; font-size: 13px; font-weight: 500; margin-left: 8px;">${value}</span>
      </div>
    `;
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

  private handleEscapeKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.config.onClose();
    }
  }

  /**
   * Render chart using Canvas API
   */
  private renderCanvasChart(): void {
    const canvas = document.getElementById('myio-water-tank-chart') as HTMLCanvasElement;
    if (!canvas) return;

    const { data } = this.config;
    if (data.telemetry.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = 300 * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = 300;
    const padding = 40;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw axes
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw grid lines
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height - 2 * padding) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = '#7f8c8d';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`${(100 - i * 20)}%`, padding - 10, y + 4);
    }

    // Draw data line
    const points = data.telemetry;
    if (points.length < 2) return;

    const xScale = (width - 2 * padding) / (points.length - 1);
    const yScale = (height - 2 * padding) / 100;

    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.beginPath();

    points.forEach((point, index) => {
      const x = padding + index * xScale;
      const y = height - padding - point.value * yScale;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw data points
    ctx.fillStyle = '#3498db';
    points.forEach((point, index) => {
      const x = padding + index * xScale;
      const y = height - padding - point.value * yScale;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
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
