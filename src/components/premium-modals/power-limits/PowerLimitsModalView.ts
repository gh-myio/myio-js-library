// RFC-0103: Power Limits Modal View - UI Rendering

import {
  PowerLimitsFormData,
  PowerLimitsModalStyles,
  InstantaneousPowerLimits,
  DEVICE_TYPES,
  TELEMETRY_TYPES,
  STATUS_CONFIG,
} from './types';

export interface PowerLimitsViewConfig {
  deviceType: string;
  telemetryType: string;
  styles?: PowerLimitsModalStyles;
  locale?: string;
  onDeviceTypeChange: (deviceType: string) => void;
  onTelemetryTypeChange: (telemetryType: string) => void;
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
      standby: { baseValue: null, topValue: null },
      normal: { baseValue: null, topValue: null },
      alert: { baseValue: null, topValue: null },
      failure: { baseValue: null, topValue: null },
    };
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
    return `
      <div class="myio-power-limits-header">
        <div class="myio-power-limits-title-section">
          <span class="myio-power-limits-icon">&#x2699;</span>
          <h2 class="myio-power-limits-title">Power Limits Setup</h2>
        </div>
        <div class="myio-power-limits-actions">
          <button class="myio-btn myio-btn-primary" id="plm-save-btn" type="button">
            <span class="myio-btn-text">Save</span>
            <span class="myio-btn-spinner" style="display: none;"></span>
          </button>
          <button class="myio-btn myio-btn-secondary" id="plm-reset-btn" type="button">Reset</button>
          <button class="myio-btn myio-btn-close" id="plm-close-btn" type="button" aria-label="Close">&times;</button>
        </div>
      </div>
    `;
  }

  private renderSelectors(): string {
    const deviceOptions = DEVICE_TYPES.map(
      (dt) => `<option value="${dt.value}" ${dt.value === this.config.deviceType ? 'selected' : ''}>${dt.label}</option>`
    ).join('');

    const telemetryOptions = TELEMETRY_TYPES.map(
      (tt) => `<option value="${tt.value}" ${tt.value === this.config.telemetryType ? 'selected' : ''}>${tt.label}</option>`
    ).join('');

    return `
      <div class="myio-power-limits-selectors">
        <div class="myio-form-group">
          <label for="plm-device-type">Device Type</label>
          <select id="plm-device-type" class="myio-select">
            ${deviceOptions}
          </select>
        </div>
        <div class="myio-form-group">
          <label for="plm-telemetry-type">Telemetry Type</label>
          <select id="plm-telemetry-type" class="myio-select">
            ${telemetryOptions}
          </select>
        </div>
      </div>
    `;
  }

  private renderStatusCards(): string {
    const statuses = ['standby', 'normal', 'alert', 'failure'] as const;

    const cards = statuses.map((status) => {
      const config = STATUS_CONFIG[status === 'standby' ? 'standBy' : status];
      const formValues = this.formData[status];

      return `
        <div class="myio-power-limits-card-item myio-status-${status}" style="--status-color: ${config.color}; --status-bg: ${config.bgColor};">
          <div class="myio-card-header">
            <span class="myio-status-indicator"></span>
            <span class="myio-status-label">${config.label}</span>
          </div>
          <div class="myio-card-inputs">
            <div class="myio-input-group">
              <label for="plm-${status}-base">Base Value</label>
              <input
                type="number"
                id="plm-${status}-base"
                class="myio-input"
                min="0"
                step="0.01"
                value="${formValues.baseValue ?? ''}"
                placeholder="0"
              >
            </div>
            <div class="myio-input-group">
              <label for="plm-${status}-top">Top Value</label>
              <input
                type="number"
                id="plm-${status}-top"
                class="myio-input"
                min="0"
                step="0.01"
                value="${formValues.topValue ?? ''}"
                placeholder="0"
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
        <span>Loading configuration...</span>
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
        <span class="myio-success-message">Configuration saved successfully!</span>
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

    // Device type change
    const deviceSelect = this.overlayEl.querySelector('#plm-device-type') as HTMLSelectElement;
    deviceSelect?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      this.formData.deviceType = value;
      this.config.onDeviceTypeChange(value);
    });

    // Telemetry type change
    const telemetrySelect = this.overlayEl.querySelector('#plm-telemetry-type') as HTMLSelectElement;
    telemetrySelect?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      this.formData.telemetryType = value;
      this.config.onTelemetryTypeChange(value);
    });

    // Input change handlers
    const statuses = ['standby', 'normal', 'alert', 'failure'] as const;
    statuses.forEach((status) => {
      const baseInput = this.overlayEl?.querySelector(`#plm-${status}-base`) as HTMLInputElement;
      const topInput = this.overlayEl?.querySelector(`#plm-${status}-top`) as HTMLInputElement;

      baseInput?.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        this.formData[status].baseValue = value ? parseFloat(value) : null;
      });

      topInput?.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        this.formData[status].topValue = value ? parseFloat(value) : null;
      });
    });
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
      this.showError((error as Error).message || 'Failed to save configuration');
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
        return `${STATUS_CONFIG[status === 'standby' ? 'standBy' : status].label}: Base value cannot be negative`;
      }
      if (top !== null && top < 0) {
        return `${STATUS_CONFIG[status === 'standby' ? 'standBy' : status].label}: Top value cannot be negative`;
      }

      // Check base <= top
      if (base !== null && top !== null && base > top) {
        return `${STATUS_CONFIG[status === 'standby' ? 'standBy' : status].label}: Base value should not exceed top value`;
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
    if (data.standby) this.formData.standby = { ...data.standby };
    if (data.normal) this.formData.normal = { ...data.normal };
    if (data.alert) this.formData.alert = { ...data.alert };
    if (data.failure) this.formData.failure = { ...data.failure };

    // Update input values
    this.updateInputValues();
  }

  private updateInputValues(): void {
    const statuses = ['standby', 'normal', 'alert', 'failure'] as const;

    statuses.forEach((status) => {
      const baseInput = this.overlayEl?.querySelector(`#plm-${status}-base`) as HTMLInputElement;
      const topInput = this.overlayEl?.querySelector(`#plm-${status}-top`) as HTMLInputElement;

      if (baseInput) {
        baseInput.value = this.formData[status].baseValue?.toString() ?? '';
      }
      if (topInput) {
        topInput.value = this.formData[status].topValue?.toString() ?? '';
      }
    });

    // Update selects
    const deviceSelect = this.overlayEl?.querySelector('#plm-device-type') as HTMLSelectElement;
    const telemetrySelect = this.overlayEl?.querySelector('#plm-telemetry-type') as HTMLSelectElement;

    if (deviceSelect) deviceSelect.value = this.formData.deviceType;
    if (telemetrySelect) telemetrySelect.value = this.formData.telemetryType;
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
        font-family: ${styles.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'};
      }

      .myio-power-limits-overlay.active {
        opacity: 1;
        visibility: visible;
      }

      .myio-power-limits-card {
        background: ${styles.backgroundColor || '#ffffff'};
        border-radius: ${styles.borderRadius || '12px'};
        width: 90%;
        max-width: 875px;
        max-height: 90vh;
        overflow-y: auto;
        transform: scale(0.9);
        transition: transform 0.3s ease;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }

      .myio-power-limits-overlay.active .myio-power-limits-card {
        transform: scale(1);
      }

      .myio-power-limits-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        background: linear-gradient(135deg, ${primaryColor}, ${this.lightenColor(primaryColor, 20)});
        color: white;
        border-radius: 12px 12px 0 0;
      }

      .myio-power-limits-title-section {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .myio-power-limits-icon {
        font-size: 24px;
      }

      .myio-power-limits-title {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0;
      }

      .myio-power-limits-actions {
        display: flex;
        align-items: center;
        gap: 8px;
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
        background: white;
        color: ${primaryColor};
      }

      .myio-btn-primary:hover:not(:disabled) {
        background: #f3f4f6;
      }

      .myio-btn-secondary {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }

      .myio-btn-secondary:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.3);
      }

      .myio-btn-close {
        background: transparent;
        color: white;
        font-size: 24px;
        padding: 4px 8px;
        line-height: 1;
      }

      .myio-btn-close:hover {
        background: rgba(255, 255, 255, 0.1);
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
        grid-template-columns: 1fr 1fr;
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
