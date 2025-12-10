// RFC-0103: Power Limits Modal View - UI Rendering

import {
  PowerLimitsFormData,
  PowerLimitsModalStyles,
  InstantaneousPowerLimits,
  DEVICE_TYPES,
  TELEMETRY_TYPES,
  STATUS_CONFIG,
  Domain,
  DOMAINS,
  STATUS_ICONS,
} from './types';

export interface PowerLimitsViewConfig {
  deviceType: string;
  telemetryType: string;
  domain: Domain;
  styles?: PowerLimitsModalStyles;
  locale?: string;
  onDeviceTypeChange: (deviceType: string) => void;
  onTelemetryTypeChange: (telemetryType: string) => void;
  onDomainChange: (domain: Domain) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}

export class PowerLimitsModalView {
  private container: HTMLElement | null = null;
  private overlayEl: HTMLElement | null = null;
  private config: PowerLimitsViewConfig;
  private formData: PowerLimitsFormData;
  private isLoading = false;
  private isSaving = false;

  constructor(config: PowerLimitsViewConfig) {
    this.config = config;
    this.formData = {
      deviceType: config.deviceType,
      telemetryType: config.telemetryType,
      domain: config.domain,
      standby: { baseValue: null, topValue: null },
      normal: { baseValue: null, topValue: null },
      alert: { baseValue: null, topValue: null },
      failure: { baseValue: null, topValue: null },
    };
  }

  // Format number with thousand separator (.) and up to 2 decimal places
  private formatNumberForDisplay(value: number | null): string {
    if (value === null || value === undefined) return '';
    // Format with 2 decimal places, using . for thousands and , for decimal
    const parts = value.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
  }

  // Parse formatted string back to number
  private parseFormattedNumber(value: string): number | null {
    if (!value || value.trim() === '') return null;
    // Remove thousand separators (.) and replace decimal separator (, to .)
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  }

  // Handle input formatting on blur
  private formatInputValue(input: HTMLInputElement): void {
    const rawValue = input.value;
    const parsed = this.parseFormattedNumber(rawValue);
    if (parsed !== null) {
      input.value = this.formatNumberForDisplay(parsed);
    }
  }

  // Handle input on focus - show raw value for editing
  private unformatInputValue(input: HTMLInputElement): void {
    const formatted = input.value;
    const parsed = this.parseFormattedNumber(formatted);
    if (parsed !== null) {
      // Show with decimal if exists, otherwise just integer
      input.value = parsed.toString().replace('.', ',');
    }
  }

  render(targetContainer?: HTMLElement): HTMLElement {
    // Create overlay
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'myio-power-limits-overlay';
    this.overlayEl.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="myio-power-limits-card">
        ${this.renderHeader()}
        ${this.renderSelectors()}
        ${this.renderStatusCards()}
        ${this.renderToolbar()}
        ${this.renderLoadingState()}
        ${this.renderErrorState()}
        ${this.renderSuccessState()}
      </div>
    `;

    // Append to target or body
    const target = targetContainer || document.body;
    target.appendChild(this.overlayEl);
    this.container = this.overlayEl.querySelector('.myio-power-limits-card');

    // Setup event listeners
    this.setupEventListeners();

    // Animate in
    requestAnimationFrame(() => {
      this.overlayEl?.classList.add('active');
    });

    return this.overlayEl;
  }

  private renderHeader(): string {
    // Simple header following ModalPremiumShell pattern
    return `
      <div class="myio-modal-header">
        <h2 class="myio-modal-title">⚙️ Configuração de Limites</h2>
        <button class="myio-modal-close" id="plm-close-btn" type="button" aria-label="Fechar modal">×</button>
      </div>
    `;
  }

  private renderToolbar(): string {
    return `
      <div class="myio-power-limits-toolbar">
        <div class="myio-toolbar-actions">
          <button class="myio-btn myio-btn-secondary" id="plm-reset-btn" type="button">Limpar</button>
          <button class="myio-btn myio-btn-primary" id="plm-save-btn" type="button">
            <span class="myio-btn-text">Salvar</span>
            <span class="myio-btn-spinner" style="display: none;"></span>
          </button>
        </div>
      </div>
    `;
  }

  private renderSelectors(): string {
    const domain = this.formData.domain || 'energy';

    const domainOptions = DOMAINS.map(
      (d) => `<option value="${d.value}" ${d.value === domain ? 'selected' : ''}>${d.icon} ${d.label}</option>`
    ).join('');

    // Domain-specific configuration for Device Type and Telemetry Type
    let deviceTypeContent: string;
    let telemetryLabel: string;

    switch (domain) {
      case 'temperature':
        // Temperature: Fixed device and telemetry
        deviceTypeContent = `<div class="myio-fixed-value">Sensor de Temperatura</div>`;
        telemetryLabel = 'Temperatura em Celsius';
        break;
      case 'water':
        // Water: Fixed device and telemetry
        deviceTypeContent = `<div class="myio-fixed-value">Hidrômetro</div>`;
        telemetryLabel = 'Litros';
        break;
      case 'energy':
      default:
        // Energy: Show full device type dropdown
        deviceTypeContent = `<select id="plm-device-type" class="myio-select">
          ${DEVICE_TYPES.map(
            (dt) => `<option value="${dt.value}" ${dt.value === this.formData.deviceType ? 'selected' : ''}>${dt.label}</option>`
          ).join('')}
        </select>`;
        telemetryLabel = 'Potência (kW)';
        break;
    }

    return `
      <div class="myio-power-limits-selectors">
        <div class="myio-form-group">
          <label for="plm-domain">Domínio</label>
          <select id="plm-domain" class="myio-select">
            ${domainOptions}
          </select>
        </div>
        <div class="myio-form-group">
          <label>Tipo de Dispositivo</label>
          ${deviceTypeContent}
        </div>
        <div class="myio-form-group">
          <label>Tipo de Telemetria</label>
          <div class="myio-fixed-value">${telemetryLabel}</div>
        </div>
      </div>
    `;
  }

  private renderStatusCards(): string {
    const statuses = ['standby', 'normal', 'alert', 'failure'] as const;
    const domain = this.formData.domain || 'energy';
    const domainIcons = STATUS_ICONS[domain];

    const cards = statuses.map((status) => {
      const statusKey = status === 'standby' ? 'standBy' : status;
      const config = STATUS_CONFIG[statusKey];
      const formValues = this.formData[status];
      const icon = domainIcons[statusKey];

      return `
        <div class="myio-power-limits-card-item myio-status-${status}" style="--status-color: ${config.color}; --status-bg: ${config.bgColor};">
          <div class="myio-card-header">
            <span class="myio-status-icon">${icon}</span>
            <span class="myio-status-indicator"></span>
            <span class="myio-status-label">${config.label}</span>
          </div>
          <div class="myio-card-inputs">
            <div class="myio-input-group">
              <label for="plm-${status}-base">Limite Inferior</label>
              <input
                type="text"
                id="plm-${status}-base"
                class="myio-input myio-formatted-number"
                inputmode="decimal"
                value="${this.formatNumberForDisplay(formValues.baseValue)}"
                placeholder="0,00"
              >
            </div>
            <div class="myio-input-group">
              <label for="plm-${status}-top">Limite Superior</label>
              <input
                type="text"
                id="plm-${status}-top"
                class="myio-input myio-formatted-number"
                inputmode="decimal"
                value="${this.formatNumberForDisplay(formValues.topValue)}"
                placeholder="0,00"
              >
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="myio-power-limits-grid" id="plm-grid">
        ${cards}
      </div>
    `;
  }

  private renderLoadingState(): string {
    return `
      <div class="myio-power-limits-loading" id="plm-loading" style="display: none;">
        <div class="myio-spinner"></div>
        <span>Carregando configuração...</span>
      </div>
    `;
  }

  private renderErrorState(): string {
    return `
      <div class="myio-power-limits-error" id="plm-error" style="display: none;">
        <span class="myio-error-icon">&#x26A0;</span>
        <span class="myio-error-message" id="plm-error-msg"></span>
      </div>
    `;
  }

  private renderSuccessState(): string {
    return `
      <div class="myio-power-limits-success" id="plm-success" style="display: none;">
        <span class="myio-success-icon">&#x2713;</span>
        <span class="myio-success-message">Configuração salva com sucesso!</span>
      </div>
    `;
  }

  private setupEventListeners(): void {
    if (!this.overlayEl) return;

    // Close button
    const closeBtn = this.overlayEl.querySelector('#plm-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    // Overlay click to close
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.close();
      }
    });

    // ESC key to close
    document.addEventListener('keydown', this.handleKeyDown);

    // Save button
    const saveBtn = this.overlayEl.querySelector('#plm-save-btn');
    saveBtn?.addEventListener('click', () => this.handleSave());

    // Reset button
    const resetBtn = this.overlayEl.querySelector('#plm-reset-btn');
    resetBtn?.addEventListener('click', () => this.handleReset());

    // Domain change - re-renders selectors to update device type and telemetry
    const domainSelect = this.overlayEl.querySelector('#plm-domain') as HTMLSelectElement;
    domainSelect?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value as Domain;
      this.formData.domain = value;

      // Update device type and telemetry type based on domain
      switch (value) {
        case 'temperature':
          this.formData.deviceType = 'SENSOR_TEMPERATURA';
          this.formData.telemetryType = 'temperature';
          break;
        case 'water':
          this.formData.deviceType = 'HIDROMETRO';
          this.formData.telemetryType = 'liters';
          break;
        case 'energy':
        default:
          this.formData.telemetryType = 'consumption';
          break;
      }

      this.config.onDomainChange(value);
      // Re-render selectors and status cards
      this.updateSelectorsUI();
      this.updateStatusIcons();
    });

    // Device type change (only exists for energy/water domains)
    this.setupDeviceTypeListener();

    // Input change handlers with number formatting
    const statuses = ['standby', 'normal', 'alert', 'failure'] as const;
    statuses.forEach((status) => {
      const baseInput = this.overlayEl?.querySelector(`#plm-${status}-base`) as HTMLInputElement;
      const topInput = this.overlayEl?.querySelector(`#plm-${status}-top`) as HTMLInputElement;

      // Base input handlers
      if (baseInput) {
        baseInput.addEventListener('focus', () => this.unformatInputValue(baseInput));
        baseInput.addEventListener('blur', () => {
          this.formData[status].baseValue = this.parseFormattedNumber(baseInput.value);
          this.formatInputValue(baseInput);
        });
        baseInput.addEventListener('keydown', (e) => this.handleNumberKeydown(e));
      }

      // Top input handlers
      if (topInput) {
        topInput.addEventListener('focus', () => this.unformatInputValue(topInput));
        topInput.addEventListener('blur', () => {
          this.formData[status].topValue = this.parseFormattedNumber(topInput.value);
          this.formatInputValue(topInput);
        });
        topInput.addEventListener('keydown', (e) => this.handleNumberKeydown(e));
      }
    });
  }

  // Handle keyboard input to allow only valid number characters
  private handleNumberKeydown(e: KeyboardEvent): void {
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    const isDigit = /^\d$/.test(e.key);
    const isComma = e.key === ',';
    const isAllowedKey = allowedKeys.includes(e.key);
    const hasCtrl = e.ctrlKey || e.metaKey;

    if (!isDigit && !isComma && !isAllowedKey && !hasCtrl) {
      e.preventDefault();
    }

    // Only allow one comma
    if (isComma) {
      const input = e.target as HTMLInputElement;
      if (input.value.includes(',')) {
        e.preventDefault();
      }
    }
  }

  // Update status icons when domain changes
  private updateStatusIcons(): void {
    const domain = this.formData.domain || 'energy';
    const domainIcons = STATUS_ICONS[domain];
    const statuses = ['standby', 'normal', 'alert', 'failure'] as const;

    statuses.forEach((status) => {
      const statusKey = status === 'standby' ? 'standBy' : status;
      const iconEl = this.overlayEl?.querySelector(`.myio-status-${status} .myio-status-icon`) as HTMLElement;
      if (iconEl) {
        iconEl.textContent = domainIcons[statusKey];
      }
    });
  }

  // Update selectors UI when domain changes
  private updateSelectorsUI(): void {
    const selectorsContainer = this.overlayEl?.querySelector('.myio-power-limits-selectors');
    if (selectorsContainer) {
      selectorsContainer.outerHTML = this.renderSelectors();
      // Re-attach domain listener
      const domainSelect = this.overlayEl?.querySelector('#plm-domain') as HTMLSelectElement;
      domainSelect?.addEventListener('change', (e) => {
        const value = (e.target as HTMLSelectElement).value as Domain;
        this.formData.domain = value;

        // Update device type and telemetry type based on domain
        switch (value) {
          case 'temperature':
            this.formData.deviceType = 'SENSOR_TEMPERATURA';
            this.formData.telemetryType = 'temperature';
            break;
          case 'water':
            this.formData.deviceType = 'HIDROMETRO';
            this.formData.telemetryType = 'liters';
            break;
          case 'energy':
          default:
            this.formData.telemetryType = 'consumption';
            break;
        }

        this.config.onDomainChange(value);
        this.updateSelectorsUI();
        this.updateStatusIcons();
      });
      // Re-attach device type listener if present (only for energy domain)
      this.setupDeviceTypeListener();
    }
  }

  // Setup device type listener (only for energy/water domains)
  private setupDeviceTypeListener(): void {
    const deviceSelect = this.overlayEl?.querySelector('#plm-device-type') as HTMLSelectElement;
    if (deviceSelect) {
      deviceSelect.addEventListener('change', (e) => {
        const value = (e.target as HTMLSelectElement).value;
        this.formData.deviceType = value;
        this.config.onDeviceTypeChange(value);
      });
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  private async handleSave(): Promise<void> {
    if (this.isSaving) return;

    // Validate form
    const validationError = this.validateForm();
    if (validationError) {
      this.showError(validationError);
      return;
    }

    this.isSaving = true;
    this.showSaveLoading(true);
    this.hideError();
    this.hideSuccess();

    try {
      await this.config.onSave();
      this.showSuccess();
      // Auto-hide success after 3 seconds
      setTimeout(() => this.hideSuccess(), 3000);
    } catch (error) {
      this.showError((error as Error).message || 'Falha ao salvar configuração');
    } finally {
      this.isSaving = false;
      this.showSaveLoading(false);
    }
  }

  private handleReset(): void {
    // Reset form to initial loaded values
    const statuses = ['standby', 'normal', 'alert', 'failure'] as const;
    statuses.forEach((status) => {
      const baseInput = this.overlayEl?.querySelector(`#plm-${status}-base`) as HTMLInputElement;
      const topInput = this.overlayEl?.querySelector(`#plm-${status}-top`) as HTMLInputElement;

      if (baseInput) baseInput.value = '';
      if (topInput) topInput.value = '';

      this.formData[status] = { baseValue: null, topValue: null };
    });

    this.hideError();
    this.hideSuccess();
  }

  private validateForm(): string | null {
    const statuses = ['standby', 'normal', 'alert', 'failure'] as const;

    for (const status of statuses) {
      const base = this.formData[status].baseValue;
      const top = this.formData[status].topValue;

      // Check for negative values
      if (base !== null && base < 0) {
        return `${STATUS_CONFIG[status === 'standby' ? 'standBy' : status].label}: Limite inferior não pode ser negativo`;
      }
      if (top !== null && top < 0) {
        return `${STATUS_CONFIG[status === 'standby' ? 'standBy' : status].label}: Limite superior não pode ser negativo`;
      }

      // Check base <= top
      if (base !== null && top !== null && base > top) {
        return `${STATUS_CONFIG[status === 'standby' ? 'standBy' : status].label}: Limite inferior não pode ser maior que o limite superior`;
      }
    }

    return null;
  }

  close(): void {
    document.removeEventListener('keydown', this.handleKeyDown);

    if (this.overlayEl) {
      this.overlayEl.classList.remove('active');
      setTimeout(() => {
        this.overlayEl?.remove();
        this.overlayEl = null;
        this.container = null;
        this.config.onClose();
      }, 300);
    }
  }

  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.overlayEl?.remove();
    this.overlayEl = null;
    this.container = null;
  }

  showLoading(): void {
    this.isLoading = true;
    const loadingEl = this.overlayEl?.querySelector('#plm-loading') as HTMLElement;
    const gridEl = this.overlayEl?.querySelector('#plm-grid') as HTMLElement;

    if (loadingEl) loadingEl.style.display = 'flex';
    if (gridEl) gridEl.style.opacity = '0.5';
  }

  hideLoading(): void {
    this.isLoading = false;
    const loadingEl = this.overlayEl?.querySelector('#plm-loading') as HTMLElement;
    const gridEl = this.overlayEl?.querySelector('#plm-grid') as HTMLElement;

    if (loadingEl) loadingEl.style.display = 'none';
    if (gridEl) gridEl.style.opacity = '1';
  }

  showSaveLoading(show: boolean): void {
    const saveBtn = this.overlayEl?.querySelector('#plm-save-btn') as HTMLButtonElement;
    const btnText = saveBtn?.querySelector('.myio-btn-text') as HTMLElement;
    const btnSpinner = saveBtn?.querySelector('.myio-btn-spinner') as HTMLElement;

    if (saveBtn) saveBtn.disabled = show;
    if (btnText) btnText.style.display = show ? 'none' : 'inline';
    if (btnSpinner) btnSpinner.style.display = show ? 'inline-block' : 'none';
  }

  showError(message: string): void {
    const errorEl = this.overlayEl?.querySelector('#plm-error') as HTMLElement;
    const errorMsg = this.overlayEl?.querySelector('#plm-error-msg') as HTMLElement;

    if (errorEl) errorEl.style.display = 'flex';
    if (errorMsg) errorMsg.textContent = message;
  }

  hideError(): void {
    const errorEl = this.overlayEl?.querySelector('#plm-error') as HTMLElement;
    if (errorEl) errorEl.style.display = 'none';
  }

  showSuccess(): void {
    const successEl = this.overlayEl?.querySelector('#plm-success') as HTMLElement;
    if (successEl) successEl.style.display = 'flex';
  }

  hideSuccess(): void {
    const successEl = this.overlayEl?.querySelector('#plm-success') as HTMLElement;
    if (successEl) successEl.style.display = 'none';
  }

  getFormData(): PowerLimitsFormData {
    return { ...this.formData };
  }

  setFormData(data: Partial<PowerLimitsFormData>): void {
    if (data.deviceType) this.formData.deviceType = data.deviceType;
    if (data.telemetryType) this.formData.telemetryType = data.telemetryType;
    if (data.domain) this.formData.domain = data.domain;
    if (data.standby) this.formData.standby = { ...data.standby };
    if (data.normal) this.formData.normal = { ...data.normal };
    if (data.alert) this.formData.alert = { ...data.alert };
    if (data.failure) this.formData.failure = { ...data.failure };

    // Update input values
    this.updateInputValues();
    // Update icons for domain
    this.updateStatusIcons();
  }

  private updateInputValues(): void {
    const statuses = ['standby', 'normal', 'alert', 'failure'] as const;

    statuses.forEach((status) => {
      const baseInput = this.overlayEl?.querySelector(`#plm-${status}-base`) as HTMLInputElement;
      const topInput = this.overlayEl?.querySelector(`#plm-${status}-top`) as HTMLInputElement;

      if (baseInput) {
        baseInput.value = this.formatNumberForDisplay(this.formData[status].baseValue);
      }
      if (topInput) {
        topInput.value = this.formatNumberForDisplay(this.formData[status].topValue);
      }
    });

    // Update selects
    const domainSelect = this.overlayEl?.querySelector('#plm-domain') as HTMLSelectElement;
    const deviceSelect = this.overlayEl?.querySelector('#plm-device-type') as HTMLSelectElement;

    if (domainSelect) domainSelect.value = this.formData.domain;
    if (deviceSelect) deviceSelect.value = this.formData.deviceType;
    // Telemetry type is fixed as "consumption" - no update needed
  }

  private getStyles(): string {
    const styles = this.config.styles || {};
    const primaryColor = styles.primaryColor || '#4A148C';
    const successColor = styles.successColor || '#22c55e';
    const warningColor = styles.warningColor || '#f59e0b';
    const dangerColor = styles.dangerColor || '#ef4444';
    const infoColor = styles.infoColor || '#3b82f6';

    return `
      .myio-power-limits-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: ${styles.zIndex || 10000};
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        font-family: ${styles.fontFamily || "'Roboto', Arial, sans-serif"};
      }

      .myio-power-limits-overlay.active {
        opacity: 1;
        visibility: visible;
      }

      .myio-power-limits-card {
        background: ${styles.backgroundColor || '#ffffff'};
        border-radius: ${styles.borderRadius || '10px'};
        width: 90%;
        max-width: 1104px;
        max-height: 90vh;
        overflow-y: auto;
        transform: scale(0.9);
        transition: transform 0.3s ease;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }

      .myio-power-limits-overlay.active .myio-power-limits-card {
        transform: scale(1);
      }

      /* Header - ModalPremiumShell pattern */
      .myio-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px;
        background: ${primaryColor};
        border-radius: 10px 10px 0 0;
        min-height: 20px;
      }

      .myio-modal-title {
        margin: 6px;
        font-size: 18px;
        font-weight: 600;
        color: white;
        line-height: 2;
      }

      .myio-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 4px 12px;
        border-radius: 6px;
        color: rgba(255, 255, 255, 0.8);
        transition: background-color 0.2s, color 0.2s;
        line-height: 1;
      }

      .myio-modal-close:hover {
        background-color: rgba(255, 255, 255, 0.2);
        color: white;
      }

      /* Toolbar with Save/Reset buttons */
      .myio-power-limits-toolbar {
        display: flex;
        justify-content: flex-end;
        padding: 16px 24px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
      }

      .myio-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .myio-btn {
        padding: 8px 16px;
        border-radius: ${styles.buttonRadius || '6px'};
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .myio-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .myio-btn-primary {
        background: ${primaryColor};
        color: white;
      }

      .myio-btn-primary:hover:not(:disabled) {
        background: ${this.lightenColor(primaryColor, -10)};
      }

      .myio-btn-secondary {
        background: #e5e7eb;
        color: #374151;
      }

      .myio-btn-secondary:hover:not(:disabled) {
        background: #d1d5db;
      }

      .myio-btn-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid ${primaryColor};
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .myio-power-limits-selectors {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 16px;
        padding: 20px 24px;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
      }

      .myio-form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .myio-form-group label {
        font-size: 13px;
        font-weight: 500;
        color: #374151;
      }

      .myio-select, .myio-input {
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        background: white;
        color: #1f2937;
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      .myio-select:focus, .myio-input:focus {
        outline: none;
        border-color: ${primaryColor};
        box-shadow: 0 0 0 3px ${this.hexToRgba(primaryColor, 0.1)};
      }

      .myio-fixed-value {
        padding: 10px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 14px;
        background: #f9fafb;
        color: #6b7280;
      }

      .myio-power-limits-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        padding: 24px;
        transition: opacity 0.3s;
      }

      .myio-power-limits-card-item {
        background: var(--status-bg);
        border: 1px solid var(--status-color);
        border-radius: 8px;
        padding: 16px;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .myio-power-limits-card-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .myio-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }

      .myio-status-icon {
        font-size: 18px;
        line-height: 1;
      }

      .myio-status-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--status-color);
      }

      .myio-status-label {
        font-weight: 600;
        font-size: 14px;
        color: #1f2937;
      }

      .myio-card-inputs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .myio-input-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .myio-input-group label {
        font-size: 11px;
        font-weight: 500;
        color: #6b7280;
        text-transform: uppercase;
      }

      .myio-power-limits-loading,
      .myio-power-limits-error,
      .myio-power-limits-success {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 16px 24px;
        margin: 0 24px 24px;
        border-radius: 8px;
      }

      .myio-power-limits-loading {
        background: #f3f4f6;
        color: #6b7280;
      }

      .myio-power-limits-error {
        background: #fef2f2;
        color: ${dangerColor};
        border: 1px solid ${dangerColor};
      }

      .myio-power-limits-success {
        background: #f0fdf4;
        color: ${successColor};
        border: 1px solid ${successColor};
      }

      .myio-spinner {
        width: 24px;
        height: 24px;
        border: 3px solid #e5e7eb;
        border-top-color: ${primaryColor};
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      .myio-error-icon, .myio-success-icon {
        font-size: 20px;
      }

      @media (max-width: 600px) {
        .myio-power-limits-selectors,
        .myio-power-limits-grid {
          grid-template-columns: 1fr;
        }

        .myio-power-limits-header {
          flex-direction: column;
          gap: 12px;
          text-align: center;
        }

        .myio-power-limits-actions {
          width: 100%;
          justify-content: center;
        }
      }
    `;
  }

  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  private hexToRgba(hex: string, alpha: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const R = num >> 16;
    const G = (num >> 8) & 0x00ff;
    const B = num & 0x0000ff;
    return `rgba(${R}, ${G}, ${B}, ${alpha})`;
  }
}
