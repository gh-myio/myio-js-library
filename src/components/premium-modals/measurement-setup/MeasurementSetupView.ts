// RFC-0108: Measurement Setup Modal View - UI Rendering

import {
  MeasurementSetupFormData,
  MeasurementSetupModalStyles,
  WATER_UNITS,
  ENERGY_UNITS,
  TEMPERATURE_UNITS,
  DECIMAL_OPTIONS,
  DOMAIN_CONFIG,
  DEFAULT_SETTINGS,
  WaterUnit,
  EnergyUnit,
  TemperatureUnit,
} from './types';

export interface MeasurementSetupViewConfig {
  styles?: MeasurementSetupModalStyles;
  onSave: () => Promise<void>;
  onClose: () => void;
}

export class MeasurementSetupView {
  private container: HTMLElement | null = null;
  private overlayEl: HTMLElement | null = null;
  private config: MeasurementSetupViewConfig;
  private formData: MeasurementSetupFormData;
  private isLoading = false;
  private isSaving = false;

  constructor(config: MeasurementSetupViewConfig) {
    this.config = config;
    this.formData = {
      water: { ...DEFAULT_SETTINGS.water },
      energy: { ...DEFAULT_SETTINGS.energy },
      temperature: { ...DEFAULT_SETTINGS.temperature },
    };
  }

  render(targetContainer?: HTMLElement): HTMLElement {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'myio-measurement-setup-overlay';
    this.overlayEl.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="myio-measurement-setup-card">
        ${this.renderHeader()}
        <div class="myio-measurement-setup-body">
          ${this.renderWaterSection()}
          ${this.renderEnergySection()}
          ${this.renderTemperatureSection()}
        </div>
        ${this.renderToolbar()}
        ${this.renderLoadingState()}
        ${this.renderErrorState()}
        ${this.renderSuccessState()}
      </div>
    `;

    const target = targetContainer || document.body;
    target.appendChild(this.overlayEl);
    this.container = this.overlayEl.querySelector('.myio-measurement-setup-card');

    this.setupEventListeners();

    requestAnimationFrame(() => {
      this.overlayEl?.classList.add('active');
    });

    return this.overlayEl;
  }

  private renderHeader(): string {
    return `
      <div class="myio-modal-header">
        <h2 class="myio-modal-title">📐 Configuração de Medidas</h2>
        <button class="myio-modal-close" id="msm-close-btn" type="button" aria-label="Fechar modal">×</button>
      </div>
    `;
  }

  private renderWaterSection(): string {
    const cfg = DOMAIN_CONFIG.water;

    return `
      <div class="myio-measurement-section" style="--section-color: ${cfg.color}; --section-bg: ${cfg.bgColor};">
        <div class="myio-section-header">
          <span class="myio-section-icon">${cfg.icon}</span>
          <span class="myio-section-title">${cfg.label}</span>
        </div>
        <div class="myio-section-content">
          <div class="myio-form-group">
            <label for="msm-water-unit">Unidade</label>
            <select id="msm-water-unit" class="myio-select">
              ${WATER_UNITS.map(u => `
                <option value="${u.value}" ${u.value === this.formData.water.unit ? 'selected' : ''}>
                  ${u.label}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="myio-form-group">
            <label for="msm-water-decimals">Casas Decimais</label>
            <select id="msm-water-decimals" class="myio-select">
              ${DECIMAL_OPTIONS.map(d => `
                <option value="${d.value}" ${d.value === this.formData.water.decimalPlaces ? 'selected' : ''}>
                  ${d.label}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="myio-form-group myio-checkbox-group">
            <label class="myio-checkbox-label">
              <input type="checkbox" id="msm-water-autoscale" ${this.formData.water.autoScale ? 'checked' : ''}>
              <span class="myio-checkbox-text">Escala automática (L↔m³)</span>
            </label>
            <span class="myio-form-hint">Converte automaticamente entre unidades</span>
          </div>
        </div>
        <div class="myio-section-preview">
          <span class="myio-preview-label">Exemplo:</span>
          <span class="myio-preview-value" id="msm-water-preview">1.234,567 m³</span>
        </div>
      </div>
    `;
  }

  private renderEnergySection(): string {
    const cfg = DOMAIN_CONFIG.energy;

    return `
      <div class="myio-measurement-section" style="--section-color: ${cfg.color}; --section-bg: ${cfg.bgColor};">
        <div class="myio-section-header">
          <span class="myio-section-icon">${cfg.icon}</span>
          <span class="myio-section-title">${cfg.label}</span>
        </div>
        <div class="myio-section-content">
          <div class="myio-form-group">
            <label for="msm-energy-unit">Unidade</label>
            <select id="msm-energy-unit" class="myio-select">
              ${ENERGY_UNITS.map(u => `
                <option value="${u.value}" ${u.value === this.formData.energy.unit ? 'selected' : ''}>
                  ${u.label}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="myio-form-group">
            <label for="msm-energy-decimals">Casas Decimais</label>
            <select id="msm-energy-decimals" class="myio-select">
              ${DECIMAL_OPTIONS.filter(d => d.value <= 4).map(d => `
                <option value="${d.value}" ${d.value === this.formData.energy.decimalPlaces ? 'selected' : ''}>
                  ${d.label}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="myio-form-group myio-checkbox-group">
            <label class="myio-checkbox-label">
              <input type="checkbox" id="msm-energy-forceunit" ${this.formData.energy.forceUnit ? 'checked' : ''}>
              <span class="myio-checkbox-text">Forçar unidade selecionada</span>
            </label>
            <span class="myio-form-hint">Quando ativo, não converte automaticamente kWh↔MWh</span>
          </div>
        </div>
        <div class="myio-section-preview">
          <span class="myio-preview-label">Exemplo:</span>
          <span class="myio-preview-value" id="msm-energy-preview">1.234,567 kWh</span>
        </div>
      </div>
    `;
  }

  private renderTemperatureSection(): string {
    const cfg = DOMAIN_CONFIG.temperature;

    return `
      <div class="myio-measurement-section" style="--section-color: ${cfg.color}; --section-bg: ${cfg.bgColor};">
        <div class="myio-section-header">
          <span class="myio-section-icon">${cfg.icon}</span>
          <span class="myio-section-title">${cfg.label}</span>
        </div>
        <div class="myio-section-content">
          <div class="myio-form-group">
            <label for="msm-temp-unit">Unidade</label>
            <select id="msm-temp-unit" class="myio-select">
              ${TEMPERATURE_UNITS.map(u => `
                <option value="${u.value}" ${u.value === this.formData.temperature.unit ? 'selected' : ''}>
                  ${u.label}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="myio-form-group">
            <label for="msm-temp-decimals">Casas Decimais</label>
            <select id="msm-temp-decimals" class="myio-select">
              ${DECIMAL_OPTIONS.filter(d => d.value <= 3).map(d => `
                <option value="${d.value}" ${d.value === this.formData.temperature.decimalPlaces ? 'selected' : ''}>
                  ${d.label}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
        <div class="myio-section-preview">
          <span class="myio-preview-label">Exemplo:</span>
          <span class="myio-preview-value" id="msm-temp-preview">23,5 °C</span>
        </div>
      </div>
    `;
  }

  private renderToolbar(): string {
    return `
      <div class="myio-measurement-setup-toolbar">
        <div class="myio-toolbar-actions">
          <button class="myio-btn myio-btn-secondary" id="msm-reset-btn" type="button">
            Restaurar Padrão
          </button>
          <button class="myio-btn myio-btn-primary" id="msm-save-btn" type="button">
            <span class="myio-btn-text">Salvar</span>
            <span class="myio-btn-spinner" style="display: none;"></span>
          </button>
        </div>
      </div>
    `;
  }

  private renderLoadingState(): string {
    return `
      <div class="myio-measurement-setup-loading" id="msm-loading" style="display: none;">
        <div class="myio-spinner"></div>
        <span>Carregando configuração...</span>
      </div>
    `;
  }

  private renderErrorState(): string {
    return `
      <div class="myio-measurement-setup-error" id="msm-error" style="display: none;">
        <span class="myio-error-icon">&#x26A0;</span>
        <span class="myio-error-message" id="msm-error-msg"></span>
      </div>
    `;
  }

  private renderSuccessState(): string {
    return `
      <div class="myio-measurement-setup-success" id="msm-success" style="display: none;">
        <span class="myio-success-icon">&#x2713;</span>
        <span class="myio-success-message">Configuração salva com sucesso!</span>
      </div>
    `;
  }

  private setupEventListeners(): void {
    if (!this.overlayEl) return;

    // Close button
    const closeBtn = this.overlayEl.querySelector('#msm-close-btn');
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
    const saveBtn = this.overlayEl.querySelector('#msm-save-btn');
    saveBtn?.addEventListener('click', () => this.handleSave());

    // Reset button
    const resetBtn = this.overlayEl.querySelector('#msm-reset-btn');
    resetBtn?.addEventListener('click', () => this.handleReset());

    // Water settings
    const waterUnit = this.overlayEl.querySelector('#msm-water-unit') as HTMLSelectElement;
    const waterDecimals = this.overlayEl.querySelector('#msm-water-decimals') as HTMLSelectElement;
    const waterAutoScale = this.overlayEl.querySelector('#msm-water-autoscale') as HTMLInputElement;

    waterUnit?.addEventListener('change', (e) => {
      this.formData.water.unit = (e.target as HTMLSelectElement).value as WaterUnit;
      this.updatePreviews();
    });
    waterDecimals?.addEventListener('change', (e) => {
      this.formData.water.decimalPlaces = parseInt((e.target as HTMLSelectElement).value, 10);
      this.updatePreviews();
    });
    waterAutoScale?.addEventListener('change', (e) => {
      this.formData.water.autoScale = (e.target as HTMLInputElement).checked;
    });

    // Energy settings
    const energyUnit = this.overlayEl.querySelector('#msm-energy-unit') as HTMLSelectElement;
    const energyDecimals = this.overlayEl.querySelector('#msm-energy-decimals') as HTMLSelectElement;
    const energyForceUnit = this.overlayEl.querySelector('#msm-energy-forceunit') as HTMLInputElement;

    energyUnit?.addEventListener('change', (e) => {
      this.formData.energy.unit = (e.target as HTMLSelectElement).value as EnergyUnit;
      this.updatePreviews();
    });
    energyDecimals?.addEventListener('change', (e) => {
      this.formData.energy.decimalPlaces = parseInt((e.target as HTMLSelectElement).value, 10);
      this.updatePreviews();
    });
    energyForceUnit?.addEventListener('change', (e) => {
      this.formData.energy.forceUnit = (e.target as HTMLInputElement).checked;
    });

    // Temperature settings
    const tempUnit = this.overlayEl.querySelector('#msm-temp-unit') as HTMLSelectElement;
    const tempDecimals = this.overlayEl.querySelector('#msm-temp-decimals') as HTMLSelectElement;

    tempUnit?.addEventListener('change', (e) => {
      this.formData.temperature.unit = (e.target as HTMLSelectElement).value as TemperatureUnit;
      this.updatePreviews();
    });
    tempDecimals?.addEventListener('change', (e) => {
      this.formData.temperature.decimalPlaces = parseInt((e.target as HTMLSelectElement).value, 10);
      this.updatePreviews();
    });

    // Initial preview update
    this.updatePreviews();
  }

  private updatePreviews(): void {
    // Water preview
    const waterPreview = this.overlayEl?.querySelector('#msm-water-preview') as HTMLElement;
    if (waterPreview) {
      const sampleValue = 1234.567;
      const unit = this.formData.water.unit === 'liters' ? 'L' : 'm³';
      const displayValue = this.formData.water.unit === 'liters' ? sampleValue * 1000 : sampleValue;
      waterPreview.textContent = this.formatNumber(displayValue, this.formData.water.decimalPlaces) + ' ' + unit;
    }

    // Energy preview
    const energyPreview = this.overlayEl?.querySelector('#msm-energy-preview') as HTMLElement;
    if (energyPreview) {
      const sampleValueKwh = 1234.567;
      let displayValue = sampleValueKwh;
      let unit = 'kWh';

      if (this.formData.energy.unit === 'mwh') {
        displayValue = sampleValueKwh / 1000;
        unit = 'MWh';
      } else if (this.formData.energy.unit === 'auto' && sampleValueKwh > 1000) {
        displayValue = sampleValueKwh / 1000;
        unit = 'MWh';
      }

      energyPreview.textContent = this.formatNumber(displayValue, this.formData.energy.decimalPlaces) + ' ' + unit;
    }

    // Temperature preview
    const tempPreview = this.overlayEl?.querySelector('#msm-temp-preview') as HTMLElement;
    if (tempPreview) {
      const sampleCelsius = 23.5;
      let displayValue = sampleCelsius;
      let unit = '°C';

      if (this.formData.temperature.unit === 'fahrenheit') {
        displayValue = (sampleCelsius * 9 / 5) + 32;
        unit = '°F';
      }

      tempPreview.textContent = this.formatNumber(displayValue, this.formData.temperature.decimalPlaces) + ' ' + unit;
    }
  }

  private formatNumber(value: number, decimals: number): string {
    const parts = value.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decimals > 0 ? parts.join(',') : parts[0];
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  private async handleSave(): Promise<void> {
    if (this.isSaving) return;

    this.isSaving = true;
    this.showSaveLoading(true);
    this.hideError();
    this.hideSuccess();

    try {
      await this.config.onSave();
      this.showSuccess();
      setTimeout(() => this.hideSuccess(), 3000);
    } catch (error) {
      this.showError((error as Error).message || 'Falha ao salvar configuração');
    } finally {
      this.isSaving = false;
      this.showSaveLoading(false);
    }
  }

  private handleReset(): void {
    this.formData = {
      water: { ...DEFAULT_SETTINGS.water },
      energy: { ...DEFAULT_SETTINGS.energy },
      temperature: { ...DEFAULT_SETTINGS.temperature },
    };

    this.updateFormInputs();
    this.updatePreviews();
    this.hideError();
    this.hideSuccess();
  }

  private updateFormInputs(): void {
    // Water
    const waterUnit = this.overlayEl?.querySelector('#msm-water-unit') as HTMLSelectElement;
    const waterDecimals = this.overlayEl?.querySelector('#msm-water-decimals') as HTMLSelectElement;
    const waterAutoScale = this.overlayEl?.querySelector('#msm-water-autoscale') as HTMLInputElement;

    if (waterUnit) waterUnit.value = this.formData.water.unit;
    if (waterDecimals) waterDecimals.value = String(this.formData.water.decimalPlaces);
    if (waterAutoScale) waterAutoScale.checked = this.formData.water.autoScale;

    // Energy
    const energyUnit = this.overlayEl?.querySelector('#msm-energy-unit') as HTMLSelectElement;
    const energyDecimals = this.overlayEl?.querySelector('#msm-energy-decimals') as HTMLSelectElement;
    const energyForceUnit = this.overlayEl?.querySelector('#msm-energy-forceunit') as HTMLInputElement;

    if (energyUnit) energyUnit.value = this.formData.energy.unit;
    if (energyDecimals) energyDecimals.value = String(this.formData.energy.decimalPlaces);
    if (energyForceUnit) energyForceUnit.checked = this.formData.energy.forceUnit;

    // Temperature
    const tempUnit = this.overlayEl?.querySelector('#msm-temp-unit') as HTMLSelectElement;
    const tempDecimals = this.overlayEl?.querySelector('#msm-temp-decimals') as HTMLSelectElement;

    if (tempUnit) tempUnit.value = this.formData.temperature.unit;
    if (tempDecimals) tempDecimals.value = String(this.formData.temperature.decimalPlaces);
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
    const loadingEl = this.overlayEl?.querySelector('#msm-loading') as HTMLElement;
    const bodyEl = this.overlayEl?.querySelector('.myio-measurement-setup-body') as HTMLElement;

    if (loadingEl) loadingEl.style.display = 'flex';
    if (bodyEl) bodyEl.style.opacity = '0.5';
  }

  hideLoading(): void {
    this.isLoading = false;
    const loadingEl = this.overlayEl?.querySelector('#msm-loading') as HTMLElement;
    const bodyEl = this.overlayEl?.querySelector('.myio-measurement-setup-body') as HTMLElement;

    if (loadingEl) loadingEl.style.display = 'none';
    if (bodyEl) bodyEl.style.opacity = '1';
  }

  showSaveLoading(show: boolean): void {
    const saveBtn = this.overlayEl?.querySelector('#msm-save-btn') as HTMLButtonElement;
    const btnText = saveBtn?.querySelector('.myio-btn-text') as HTMLElement;
    const btnSpinner = saveBtn?.querySelector('.myio-btn-spinner') as HTMLElement;

    if (saveBtn) saveBtn.disabled = show;
    if (btnText) btnText.style.display = show ? 'none' : 'inline';
    if (btnSpinner) btnSpinner.style.display = show ? 'inline-block' : 'none';
  }

  showError(message: string): void {
    const errorEl = this.overlayEl?.querySelector('#msm-error') as HTMLElement;
    const errorMsg = this.overlayEl?.querySelector('#msm-error-msg') as HTMLElement;

    if (errorEl) errorEl.style.display = 'flex';
    if (errorMsg) errorMsg.textContent = message;
  }

  hideError(): void {
    const errorEl = this.overlayEl?.querySelector('#msm-error') as HTMLElement;
    if (errorEl) errorEl.style.display = 'none';
  }

  showSuccess(): void {
    const successEl = this.overlayEl?.querySelector('#msm-success') as HTMLElement;
    if (successEl) successEl.style.display = 'flex';
  }

  hideSuccess(): void {
    const successEl = this.overlayEl?.querySelector('#msm-success') as HTMLElement;
    if (successEl) successEl.style.display = 'none';
  }

  getFormData(): MeasurementSetupFormData {
    return {
      water: { ...this.formData.water },
      energy: { ...this.formData.energy },
      temperature: { ...this.formData.temperature },
    };
  }

  setFormData(data: Partial<MeasurementSetupFormData>): void {
    if (data.water) this.formData.water = { ...data.water };
    if (data.energy) this.formData.energy = { ...data.energy };
    if (data.temperature) this.formData.temperature = { ...data.temperature };

    this.updateFormInputs();
    this.updatePreviews();
  }

  private getStyles(): string {
    const styles = this.config.styles || {};
    const primaryColor = styles.primaryColor || '#4A148C';
    const successColor = styles.successColor || '#22c55e';
    const dangerColor = styles.dangerColor || '#ef4444';

    return `
      .myio-measurement-setup-overlay {
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

      .myio-measurement-setup-overlay.active {
        opacity: 1;
        visibility: visible;
      }

      .myio-measurement-setup-card {
        background: ${styles.backgroundColor || '#ffffff'};
        border-radius: ${styles.borderRadius || '8px'};
        width: 90%;
        max-width: 580px;
        max-height: 90vh;
        overflow-y: auto;
        transform: scale(0.9);
        transition: transform 0.3s ease;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }

      .myio-measurement-setup-overlay.active .myio-measurement-setup-card {
        transform: scale(1);
      }

      /* Header */
      .myio-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        background: ${primaryColor};
        border-radius: 8px 8px 0 0;
        min-height: 18px;
      }

      .myio-modal-title {
        margin: 4px;
        font-size: 14px;
        font-weight: 600;
        color: white;
        line-height: 1.5;
      }

      .myio-modal-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        padding: 2px 8px;
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.8);
        transition: background-color 0.2s, color 0.2s;
        line-height: 1;
      }

      .myio-modal-close:hover {
        background-color: rgba(255, 255, 255, 0.2);
        color: white;
      }

      /* Body */
      .myio-measurement-setup-body {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        transition: opacity 0.3s;
      }

      /* Section cards */
      .myio-measurement-section {
        background: var(--section-bg);
        border: 1px solid var(--section-color);
        border-radius: 6px;
        padding: 10px 12px;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .myio-measurement-section:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }

      .myio-section-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }

      .myio-section-icon {
        font-size: 16px;
        line-height: 1;
      }

      .myio-section-title {
        font-weight: 600;
        font-size: 13px;
        color: #1f2937;
      }

      .myio-section-content {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
      }

      .myio-section-preview {
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px dashed rgba(0, 0, 0, 0.08);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .myio-preview-label {
        font-size: 11px;
        color: #6b7280;
      }

      .myio-preview-value {
        font-size: 13px;
        font-weight: 600;
        color: var(--section-color);
        font-family: 'Consolas', 'Monaco', monospace;
      }

      /* Form elements */
      .myio-form-group {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .myio-form-group label {
        font-size: 11px;
        font-weight: 500;
        color: #374151;
      }

      .myio-select {
        padding: 6px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 12px;
        background: white;
        color: #1f2937;
        transition: border-color 0.2s, box-shadow 0.2s;
        cursor: pointer;
      }

      .myio-select:focus {
        outline: none;
        border-color: ${primaryColor};
        box-shadow: 0 0 0 2px ${this.hexToRgba(primaryColor, 0.1)};
      }

      .myio-checkbox-group {
        grid-column: 1 / -1;
      }

      .myio-checkbox-label {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }

      .myio-checkbox-label input[type="checkbox"] {
        width: 14px;
        height: 14px;
        accent-color: ${primaryColor};
        cursor: pointer;
      }

      .myio-checkbox-text {
        font-size: 12px;
        color: #374151;
      }

      .myio-form-hint {
        font-size: 10px;
        color: #9ca3af;
        margin-top: 2px;
      }

      /* Toolbar */
      .myio-measurement-setup-toolbar {
        display: flex;
        justify-content: flex-end;
        padding: 10px 16px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        border-radius: 0 0 8px 8px;
      }

      .myio-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .myio-btn {
        padding: 6px 14px;
        border-radius: ${styles.buttonRadius || '4px'};
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 4px;
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
        width: 12px;
        height: 12px;
        border: 2px solid white;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* Loading, Error, Success states */
      .myio-measurement-setup-loading,
      .myio-measurement-setup-error,
      .myio-measurement-setup-success {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 12px;
        margin: 0 16px 12px;
        border-radius: 4px;
        font-size: 12px;
      }

      .myio-measurement-setup-loading {
        background: #f3f4f6;
        color: #6b7280;
      }

      .myio-measurement-setup-error {
        background: #fef2f2;
        color: ${dangerColor};
        border: 1px solid ${dangerColor};
      }

      .myio-measurement-setup-success {
        background: #f0fdf4;
        color: ${successColor};
        border: 1px solid ${successColor};
      }

      .myio-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #e5e7eb;
        border-top-color: ${primaryColor};
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      .myio-error-icon, .myio-success-icon {
        font-size: 14px;
      }

      @media (max-width: 500px) {
        .myio-section-content {
          grid-template-columns: 1fr;
        }

        .myio-toolbar-actions {
          flex-direction: column;
          width: 100%;
        }

        .myio-btn {
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
