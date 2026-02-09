// energy/BASControlPanel.ts - RFC-0165: BAS Automation Control Panel
// 30% left panel with device status, remote control, and telemetry

import { BASDeviceData, BASDeviceTelemetry } from './types';

export interface BASControlPanelOptions {
  device: BASDeviceData;
  onRemoteCommand?: (command: 'on' | 'off', device: BASDeviceData) => Promise<void>;
  onTelemetryRefresh?: (device: BASDeviceData) => Promise<BASDeviceTelemetry>;
  refreshInterval?: number; // ms, default 10000
  theme?: 'dark' | 'light';
}

export class BASControlPanel {
  private container: HTMLElement;
  private device: BASDeviceData;
  private options: BASControlPanelOptions;
  private refreshIntervalId: number | null = null;
  private isCommandPending = false;

  constructor(options: BASControlPanelOptions) {
    this.options = options;
    this.device = { ...options.device };
    this.container = document.createElement('div');
    this.container.className = 'myio-bas-control-panel';
    this.render();

    // Start auto-refresh if callback provided
    if (options.onTelemetryRefresh && options.refreshInterval !== 0) {
      this.startAutoRefresh(options.refreshInterval || 10000);
    }
  }

  private render(): void {
    const { device } = this;
    const hasRemote = device.hasRemote;
    const isOn = device.isRemoteOn ?? false;

    this.container.innerHTML = `
      <style>${this.getStyles()}</style>

      <!-- Device Info Section -->
      <div class="myio-bas-section">
        <div class="myio-bas-section__title">Dispositivo</div>
        <div class="myio-bas-device-info">
          <div class="myio-bas-device-label">${this.escapeHtml(device.label)}</div>
          <div class="myio-bas-device-type">${this.escapeHtml(device.deviceType || 'N/A')}</div>
        </div>
      </div>

      <!-- Status Section -->
      <div class="myio-bas-section">
        <div class="myio-bas-section__title">Status</div>
        <div class="myio-bas-status">
          <span class="myio-bas-status__dot myio-bas-status__dot--${device.status}"></span>
          <span class="myio-bas-status__text">${this.getStatusText(device.status)}</span>
        </div>
      </div>

      <!-- Remote Control Section -->
      ${hasRemote ? `
      <div class="myio-bas-section">
        <div class="myio-bas-section__title">Controle Remoto</div>
        <div class="myio-bas-remote-state">
          <span class="myio-bas-remote-indicator ${isOn ? 'myio-bas-remote-indicator--on' : 'myio-bas-remote-indicator--off'}">
            ${isOn ? '● Ligado' : '○ Desligado'}
          </span>
        </div>
        <div class="myio-bas-remote-buttons">
          <button class="myio-bas-remote-btn myio-bas-remote-btn--on ${isOn ? 'active' : ''}" data-command="on" ${device.status === 'offline' ? 'disabled' : ''}>
            <span class="myio-bas-btn-icon">⚡</span>
            Ligar
          </button>
          <button class="myio-bas-remote-btn myio-bas-remote-btn--off ${!isOn ? 'active' : ''}" data-command="off" ${device.status === 'offline' ? 'disabled' : ''}>
            <span class="myio-bas-btn-icon">⏹</span>
            Desligar
          </button>
        </div>
        <div class="myio-bas-command-status" id="bas-command-status"></div>
      </div>
      ` : `
      <div class="myio-bas-section myio-bas-section--muted">
        <div class="myio-bas-section__title">Controle Remoto</div>
        <div class="myio-bas-no-remote">
          <span class="myio-bas-no-remote-icon">🔒</span>
          <span>Dispositivo sem controle remoto</span>
        </div>
      </div>
      `}

      <!-- Telemetry Section -->
      <div class="myio-bas-section myio-bas-section--telemetry">
        <div class="myio-bas-section__header">
          <div class="myio-bas-section__title">Telemetria</div>
          <button class="myio-bas-refresh-btn" id="bas-refresh-btn" title="Atualizar telemetria">
            <span class="myio-bas-refresh-icon">🔄</span>
          </button>
        </div>
        <div class="myio-bas-telemetry-grid" id="bas-telemetry-grid">
          ${this.renderTelemetryItems(device.telemetry)}
        </div>
        <div class="myio-bas-telemetry-updated" id="bas-telemetry-updated">
          ${device.telemetry?.lastUpdate ? `Atualizado: ${this.formatTime(device.telemetry.lastUpdate)}` : ''}
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  private renderTelemetryItems(telemetry?: BASDeviceTelemetry): string {
    if (!telemetry) {
      return `
        <div class="myio-bas-telemetry-empty">
          <span>Sem dados de telemetria</span>
        </div>
      `;
    }

    const items: string[] = [];

    if (telemetry.power !== undefined) {
      items.push(this.renderTelemetryItem('Potência', telemetry.power.toFixed(2), 'kW', '⚡'));
    }
    if (telemetry.consumption !== undefined) {
      items.push(this.renderTelemetryItem('Consumo', telemetry.consumption.toFixed(2), 'kWh', '📊'));
    }
    if (telemetry.current !== undefined) {
      items.push(this.renderTelemetryItem('Corrente', telemetry.current.toFixed(1), 'A', '🔌'));
    }
    if (telemetry.voltage !== undefined) {
      items.push(this.renderTelemetryItem('Tensão', telemetry.voltage.toFixed(0), 'V', '⚡'));
    }
    if (telemetry.temperature !== undefined) {
      items.push(this.renderTelemetryItem('Temperatura', telemetry.temperature.toFixed(1), '°C', '🌡️'));
    }

    if (items.length === 0) {
      return `
        <div class="myio-bas-telemetry-empty">
          <span>Sem dados de telemetria</span>
        </div>
      `;
    }

    return items.join('');
  }

  private renderTelemetryItem(label: string, value: string, unit: string, icon: string): string {
    return `
      <div class="myio-bas-telemetry-item">
        <span class="myio-bas-telemetry-icon">${icon}</span>
        <div class="myio-bas-telemetry-content">
          <span class="myio-bas-telemetry-label">${label}</span>
          <span class="myio-bas-telemetry-value">${value} <span class="myio-bas-telemetry-unit">${unit}</span></span>
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    // Remote control buttons
    const onBtn = this.container.querySelector('[data-command="on"]');
    const offBtn = this.container.querySelector('[data-command="off"]');

    if (onBtn) {
      onBtn.addEventListener('click', () => this.sendCommand('on'));
    }
    if (offBtn) {
      offBtn.addEventListener('click', () => this.sendCommand('off'));
    }

    // Refresh button
    const refreshBtn = this.container.querySelector('#bas-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshTelemetry());
    }
  }

  private async sendCommand(command: 'on' | 'off'): Promise<void> {
    if (this.isCommandPending || !this.options.onRemoteCommand) return;

    const statusEl = this.container.querySelector('#bas-command-status');
    const buttons = this.container.querySelectorAll('.myio-bas-remote-btn');

    try {
      this.isCommandPending = true;
      buttons.forEach(btn => (btn as HTMLButtonElement).disabled = true);

      if (statusEl) {
        statusEl.innerHTML = `<span class="myio-bas-command-pending">⏳ Enviando comando...</span>`;
      }

      await this.options.onRemoteCommand(command, this.device);

      // Update local state
      this.device.isRemoteOn = command === 'on';

      if (statusEl) {
        statusEl.innerHTML = `<span class="myio-bas-command-success">✓ Comando enviado com sucesso</span>`;
        setTimeout(() => {
          if (statusEl) statusEl.innerHTML = '';
        }, 3000);
      }

      // Update UI
      this.updateRemoteState(command === 'on');

    } catch (error) {
      console.error('[BASControlPanel] Command error:', error);
      if (statusEl) {
        statusEl.innerHTML = `<span class="myio-bas-command-error">✗ Erro ao enviar comando</span>`;
      }
    } finally {
      this.isCommandPending = false;
      buttons.forEach(btn => {
        const btnEl = btn as HTMLButtonElement;
        btnEl.disabled = this.device.status === 'offline';
      });
    }
  }

  private async refreshTelemetry(): Promise<void> {
    if (!this.options.onTelemetryRefresh) return;

    const refreshBtn = this.container.querySelector('#bas-refresh-btn') as HTMLButtonElement;
    const refreshIcon = refreshBtn?.querySelector('.myio-bas-refresh-icon');

    try {
      if (refreshIcon) {
        refreshIcon.classList.add('spinning');
      }

      const telemetry = await this.options.onTelemetryRefresh(this.device);
      this.updateTelemetry(telemetry);

    } catch (error) {
      console.error('[BASControlPanel] Telemetry refresh error:', error);
    } finally {
      if (refreshIcon) {
        refreshIcon.classList.remove('spinning');
      }
    }
  }

  public updateTelemetry(telemetry: BASDeviceTelemetry): void {
    this.device.telemetry = telemetry;

    const grid = this.container.querySelector('#bas-telemetry-grid');
    if (grid) {
      grid.innerHTML = this.renderTelemetryItems(telemetry);
    }

    const updatedEl = this.container.querySelector('#bas-telemetry-updated');
    if (updatedEl && telemetry.lastUpdate) {
      updatedEl.textContent = `Atualizado: ${this.formatTime(telemetry.lastUpdate)}`;
    }
  }

  public updateStatus(status: 'online' | 'offline' | 'unknown'): void {
    this.device.status = status;

    const dot = this.container.querySelector('.myio-bas-status__dot');
    const text = this.container.querySelector('.myio-bas-status__text');

    if (dot) {
      dot.className = `myio-bas-status__dot myio-bas-status__dot--${status}`;
    }
    if (text) {
      text.textContent = this.getStatusText(status);
    }

    // Disable remote buttons if offline
    const buttons = this.container.querySelectorAll('.myio-bas-remote-btn');
    buttons.forEach(btn => {
      (btn as HTMLButtonElement).disabled = status === 'offline';
    });
  }

  public updateRemoteState(isOn: boolean): void {
    this.device.isRemoteOn = isOn;

    const indicator = this.container.querySelector('.myio-bas-remote-indicator');
    if (indicator) {
      indicator.className = `myio-bas-remote-indicator ${isOn ? 'myio-bas-remote-indicator--on' : 'myio-bas-remote-indicator--off'}`;
      indicator.textContent = isOn ? '● Ligado' : '○ Desligado';
    }

    const onBtn = this.container.querySelector('[data-command="on"]');
    const offBtn = this.container.querySelector('[data-command="off"]');

    if (onBtn) onBtn.classList.toggle('active', isOn);
    if (offBtn) offBtn.classList.toggle('active', !isOn);
  }

  public startAutoRefresh(intervalMs: number): void {
    this.stopAutoRefresh();
    this.refreshIntervalId = window.setInterval(() => {
      this.refreshTelemetry();
    }, intervalMs);
  }

  public stopAutoRefresh(): void {
    if (this.refreshIntervalId !== null) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public destroy(): void {
    this.stopAutoRefresh();
    this.container.innerHTML = '';
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      default: return 'Desconhecido';
    }
  }

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private getStyles(): string {
    return `
      .myio-bas-control-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
        overflow-y: auto;
      }

      .myio-bas-section {
        background: var(--myio-energy-btn-bg, #f3f4f6);
        border: 1px solid var(--myio-energy-border, #e5e7eb);
        border-radius: 10px;
        padding: 14px;
      }

      .myio-bas-section--muted {
        opacity: 0.7;
      }

      .myio-bas-section--telemetry {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      .myio-bas-section__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .myio-bas-section__title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--myio-energy-text-secondary, #6b7280);
        margin-bottom: 10px;
      }

      .myio-bas-section__header .myio-bas-section__title {
        margin-bottom: 0;
      }

      /* Device Info */
      .myio-bas-device-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .myio-bas-device-label {
        font-size: 15px;
        font-weight: 600;
        color: var(--myio-energy-text, #1f2937);
      }

      .myio-bas-device-type {
        font-size: 12px;
        color: var(--myio-energy-text-secondary, #6b7280);
      }

      /* Status */
      .myio-bas-status {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .myio-bas-status__dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .myio-bas-status__dot--online {
        background: #10b981;
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
      }

      .myio-bas-status__dot--offline {
        background: #ef4444;
        animation: pulse-offline 1.5s ease-in-out infinite;
      }

      .myio-bas-status__dot--unknown {
        background: #9ca3af;
      }

      @keyframes pulse-offline {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .myio-bas-status__text {
        font-size: 14px;
        font-weight: 500;
        color: var(--myio-energy-text, #1f2937);
      }

      /* Remote Control */
      .myio-bas-remote-state {
        margin-bottom: 12px;
      }

      .myio-bas-remote-indicator {
        font-size: 13px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 12px;
      }

      .myio-bas-remote-indicator--on {
        color: #059669;
        background: rgba(16, 185, 129, 0.15);
      }

      .myio-bas-remote-indicator--off {
        color: #6b7280;
        background: rgba(107, 114, 128, 0.15);
      }

      .myio-bas-remote-buttons {
        display: flex;
        gap: 10px;
      }

      .myio-bas-remote-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 12px 14px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
      }

      .myio-bas-remote-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .myio-bas-remote-btn--on {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
      }

      .myio-bas-remote-btn--on:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      }

      .myio-bas-remote-btn--on.active {
        border-color: #047857;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
      }

      .myio-bas-remote-btn--off {
        background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
        color: white;
      }

      .myio-bas-remote-btn--off:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(107, 114, 128, 0.4);
      }

      .myio-bas-remote-btn--off.active {
        border-color: #374151;
        box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.3);
      }

      .myio-bas-btn-icon {
        font-size: 14px;
      }

      .myio-bas-command-status {
        margin-top: 10px;
        font-size: 12px;
        min-height: 18px;
      }

      .myio-bas-command-pending {
        color: #f59e0b;
      }

      .myio-bas-command-success {
        color: #10b981;
      }

      .myio-bas-command-error {
        color: #ef4444;
      }

      .myio-bas-no-remote {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--myio-energy-text-secondary, #6b7280);
        font-size: 13px;
      }

      .myio-bas-no-remote-icon {
        font-size: 16px;
      }

      /* Telemetry */
      .myio-bas-refresh-btn {
        background: transparent;
        border: 1px solid var(--myio-energy-border, #e5e7eb);
        border-radius: 6px;
        padding: 4px 8px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .myio-bas-refresh-btn:hover {
        background: var(--myio-energy-btn-hover, #e5e7eb);
      }

      .myio-bas-refresh-icon {
        font-size: 14px;
        display: inline-block;
      }

      .myio-bas-refresh-icon.spinning {
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        100% { transform: rotate(360deg); }
      }

      .myio-bas-telemetry-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
        overflow-y: auto;
      }

      .myio-bas-telemetry-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        background: var(--myio-energy-input-bg, #ffffff);
        border: 1px solid var(--myio-energy-border, #e5e7eb);
        border-radius: 8px;
      }

      .myio-bas-telemetry-icon {
        font-size: 18px;
        flex-shrink: 0;
      }

      .myio-bas-telemetry-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
      }

      .myio-bas-telemetry-label {
        font-size: 11px;
        color: var(--myio-energy-text-secondary, #6b7280);
      }

      .myio-bas-telemetry-value {
        font-size: 16px;
        font-weight: 600;
        color: var(--myio-energy-text, #1f2937);
      }

      .myio-bas-telemetry-unit {
        font-size: 12px;
        font-weight: 400;
        color: var(--myio-energy-text-secondary, #6b7280);
      }

      .myio-bas-telemetry-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        color: var(--myio-energy-text-secondary, #6b7280);
        font-size: 13px;
      }

      .myio-bas-telemetry-updated {
        font-size: 11px;
        color: var(--myio-energy-text-secondary, #6b7280);
        text-align: right;
        margin-top: 8px;
      }
    `;
  }
}
