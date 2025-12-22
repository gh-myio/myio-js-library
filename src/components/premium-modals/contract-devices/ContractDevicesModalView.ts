/**
 * RFC-0107: Contract Devices Modal View
 * Renders the modal UI for managing device count attributes
 */

import { ContractDevicesModalConfig, ContractDeviceCounts, DEVICE_COUNT_KEYS } from './types';

export class ContractDevicesModalView {
  private container: HTMLElement;
  private modal: HTMLElement;
  private form: HTMLFormElement;
  private config: ContractDevicesModalConfig;
  private focusTrapElements: HTMLElement[] = [];
  private originalActiveElement: Element | null = null;

  constructor(config: ContractDevicesModalConfig) {
    this.config = config;
    this.createModal();
  }

  render(initialData: Partial<ContractDeviceCounts>): void {
    this.originalActiveElement = document.activeElement;
    document.body.appendChild(this.container);
    this.populateForm(initialData);
    this.attachEventListeners();
    this.setupAccessibility();
    this.setupFocusTrap();
  }

  close(): void {
    this.teardownFocusTrap();

    if (this.originalActiveElement && 'focus' in this.originalActiveElement) {
      (this.originalActiveElement as HTMLElement).focus();
    }

    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  showError(message: string): void {
    const errorEl = this.modal.querySelector('.error-message') as HTMLElement;
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      errorEl.setAttribute('role', 'alert');
    }
  }

  hideError(): void {
    const errorEl = this.modal.querySelector('.error-message') as HTMLElement;
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  }

  showLoadingState(isLoading: boolean): void {
    const saveBtn = this.modal.querySelector('.btn-save') as HTMLButtonElement;
    const cancelBtn = this.modal.querySelector('.btn-cancel') as HTMLButtonElement;
    const formInputs = this.modal.querySelectorAll('input') as NodeListOf<HTMLInputElement>;

    if (saveBtn) {
      saveBtn.disabled = isLoading;
      saveBtn.textContent = isLoading ? 'Salvando...' : 'Salvar';
    }

    if (cancelBtn) {
      cancelBtn.disabled = isLoading;
    }

    formInputs.forEach((input) => {
      input.disabled = isLoading;
    });
  }

  getFormData(): ContractDeviceCounts {
    const getValue = (name: string): number | null => {
      const input = this.form.querySelector(`[name="${name}"]`) as HTMLInputElement;
      if (!input || input.value === '') return null;
      const num = parseInt(input.value, 10);
      return isNaN(num) ? null : num;
    };

    return {
      energy: {
        total: getValue('energy_total'),
        entries: getValue('energy_entries'),
        commonArea: getValue('energy_commonArea'),
        stores: getValue('energy_stores')
      },
      water: {
        total: getValue('water_total'),
        entries: getValue('water_entries'),
        commonArea: getValue('water_commonArea'),
        stores: getValue('water_stores')
      },
      temperature: {
        total: getValue('temperature_total'),
        internal: getValue('temperature_internal'),
        stores: getValue('temperature_stores')
      }
    };
  }

  private createModal(): void {
    this.container = document.createElement('div');
    this.container.className = 'myio-contract-devices-modal-overlay';
    this.container.innerHTML = this.getModalHTML();
    this.modal = this.container.querySelector('.myio-contract-devices-modal') as HTMLElement;
    this.form = this.modal.querySelector('form') as HTMLFormElement;
  }

  private getModalHTML(): string {
    const width = typeof this.config.width === 'number' ? `${this.config.width}px` : this.config.width;

    return `
      <div class="myio-contract-devices-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="myio-contract-devices-modal" style="width: ${width}">
          <div class="modal-header">
            <h3 id="modal-title">${this.config.title || 'Configurar Dispositivos Contratados'}</h3>
            <button type="button" class="close-btn" aria-label="Fechar">&times;</button>
          </div>
          <div class="modal-body">
            <div class="error-message" style="display: none;" role="alert"></div>
            ${this.config.customerName ? `
              <div class="customer-info">
                <span class="customer-label">Shopping:</span>
                <span class="customer-name">${this.config.customerName}</span>
              </div>
            ` : ''}
            <form novalidate>
              ${this.getFormHTML()}
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-cancel">Fechar</button>
            <button type="button" class="btn-save btn-primary">Salvar</button>
          </div>
        </div>
      </div>
      ${this.getModalCSS()}
    `;
  }

  private getFormHTML(): string {
    return `
      <div class="form-layout">
        <!-- Energy Section -->
        <div class="domain-card energy-card">
          <div class="domain-header">
            <span class="domain-icon">&#9889;</span>
            <h4>Energia</h4>
          </div>
          <div class="domain-fields">
            <div class="field-group">
              <label for="energy_total">Total Contratado</label>
              <input type="number" id="energy_total" name="energy_total" min="0" step="1" placeholder="0">
              <small class="field-key">${DEVICE_COUNT_KEYS.energy.total}</small>
            </div>
            <div class="field-group">
              <label for="energy_entries">Entradas</label>
              <input type="number" id="energy_entries" name="energy_entries" min="0" step="1" placeholder="0">
              <small class="field-key">${DEVICE_COUNT_KEYS.energy.entries}</small>
            </div>
            <div class="field-group">
              <label for="energy_commonArea">Area Comum</label>
              <input type="number" id="energy_commonArea" name="energy_commonArea" min="0" step="1" placeholder="0">
              <small class="field-key">${DEVICE_COUNT_KEYS.energy.commonArea}</small>
            </div>
            <div class="field-group">
              <label for="energy_stores">Lojas</label>
              <input type="number" id="energy_stores" name="energy_stores" min="0" step="1" placeholder="0">
              <small class="field-key">${DEVICE_COUNT_KEYS.energy.stores}</small>
            </div>
          </div>
        </div>

        <!-- Water Section -->
        <div class="domain-card water-card">
          <div class="domain-header">
            <span class="domain-icon">&#128167;</span>
            <h4>Agua</h4>
          </div>
          <div class="domain-fields">
            <div class="field-group">
              <label for="water_total">Total Contratado</label>
              <input type="number" id="water_total" name="water_total" min="0" step="1" placeholder="0">
              <small class="field-key">${DEVICE_COUNT_KEYS.water.total}</small>
            </div>
            <div class="field-group">
              <label for="water_entries">Entradas</label>
              <input type="number" id="water_entries" name="water_entries" min="0" step="1" placeholder="0">
              <small class="field-key">${DEVICE_COUNT_KEYS.water.entries}</small>
            </div>
            <div class="field-group">
              <label for="water_commonArea">Area Comum</label>
              <input type="number" id="water_commonArea" name="water_commonArea" min="0" step="1" placeholder="0">
              <small class="field-key">${DEVICE_COUNT_KEYS.water.commonArea}</small>
            </div>
            <div class="field-group">
              <label for="water_stores">Lojas</label>
              <input type="number" id="water_stores" name="water_stores" min="0" step="1" placeholder="0">
              <small class="field-key">${DEVICE_COUNT_KEYS.water.stores}</small>
            </div>
          </div>
        </div>

        <!-- Temperature Section -->
        <div class="domain-card temperature-card">
          <div class="domain-header">
            <span class="domain-icon">&#127777;</span>
            <h4>Temperatura</h4>
          </div>
          <div class="domain-fields">
            <div class="field-group">
              <label for="temperature_total">Total Contratado</label>
              <input type="number" id="temperature_total" name="temperature_total" min="0" step="1" placeholder="0">
              <small class="field-key">${DEVICE_COUNT_KEYS.temperature.total}</small>
            </div>
            <div class="field-group">
              <label for="temperature_internal">Sensores Internos</label>
              <input type="number" id="temperature_internal" name="temperature_internal" min="0" step="1" placeholder="0">
              <small class="field-key">${DEVICE_COUNT_KEYS.temperature.internal}</small>
            </div>
            <div class="field-group">
              <label for="temperature_stores">Lojas</label>
              <input type="number" id="temperature_stores" name="temperature_stores" min="0" step="1" placeholder="0">
              <small class="field-key">${DEVICE_COUNT_KEYS.temperature.stores}</small>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private getModalCSS(): string {
    return `
      <style>
        .myio-contract-devices-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .myio-contract-devices-modal {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
          max-width: 95vw;
          max-height: 90vh;
          width: 800px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .myio-contract-devices-modal .modal-header {
          background: linear-gradient(135deg, #3e1a7d 0%, #5c2d91 100%);
          color: white;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .myio-contract-devices-modal .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: white;
        }

        .myio-contract-devices-modal .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: white;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .myio-contract-devices-modal .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .myio-contract-devices-modal .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
          background: #f8f9fa;
        }

        .myio-contract-devices-modal .error-message {
          background: #fee;
          border: 1px solid #fcc;
          color: #c33;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .myio-contract-devices-modal .customer-info {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 16px 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .myio-contract-devices-modal .customer-label {
          color: rgba(255, 255, 255, 0.8);
          font-size: 13px;
          font-weight: 500;
        }

        .myio-contract-devices-modal .customer-name {
          color: white;
          font-size: 16px;
          font-weight: 600;
        }

        .myio-contract-devices-modal .form-layout {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .myio-contract-devices-modal .domain-card {
          background: white;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        .myio-contract-devices-modal .domain-header {
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid #eee;
        }

        .myio-contract-devices-modal .domain-header h4 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: #333;
        }

        .myio-contract-devices-modal .domain-icon {
          font-size: 20px;
        }

        .myio-contract-devices-modal .energy-card .domain-header {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        }

        .myio-contract-devices-modal .water-card .domain-header {
          background: linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%);
        }

        .myio-contract-devices-modal .temperature-card .domain-header {
          background: linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%);
        }

        .myio-contract-devices-modal .domain-fields {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .myio-contract-devices-modal .field-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .myio-contract-devices-modal .field-group label {
          font-size: 13px;
          font-weight: 500;
          color: #555;
        }

        .myio-contract-devices-modal .field-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }

        .myio-contract-devices-modal .field-group input:focus {
          outline: none;
          border-color: #3e1a7d;
          box-shadow: 0 0 0 3px rgba(62, 26, 125, 0.15);
        }

        .myio-contract-devices-modal .field-key {
          font-size: 10px;
          color: #999;
          font-family: 'Courier New', monospace;
        }

        .myio-contract-devices-modal .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: white;
        }

        .myio-contract-devices-modal .modal-footer button {
          padding: 10px 24px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .myio-contract-devices-modal .btn-cancel {
          background: #6c757d;
          color: white;
        }

        .myio-contract-devices-modal .btn-cancel:hover:not(:disabled) {
          background: #545b62;
        }

        .myio-contract-devices-modal .btn-primary {
          background: #3e1a7d;
          color: white;
        }

        .myio-contract-devices-modal .btn-primary:hover:not(:disabled) {
          background: #2d1458;
        }

        .myio-contract-devices-modal .modal-footer button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Responsive */
        @media (max-width: 900px) {
          .myio-contract-devices-modal .form-layout {
            grid-template-columns: 1fr;
          }

          .myio-contract-devices-modal {
            width: 95vw !important;
          }
        }

        /* Scrollbar */
        .myio-contract-devices-modal .modal-body::-webkit-scrollbar {
          width: 6px;
        }

        .myio-contract-devices-modal .modal-body::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }

        .myio-contract-devices-modal .modal-body::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }
      </style>
    `;
  }

  private populateForm(data: Partial<ContractDeviceCounts>): void {
    const setValue = (name: string, value: number | null | undefined) => {
      const input = this.form.querySelector(`[name="${name}"]`) as HTMLInputElement;
      if (input && value !== null && value !== undefined) {
        input.value = String(value);
      }
    };

    if (data.energy) {
      setValue('energy_total', data.energy.total);
      setValue('energy_entries', data.energy.entries);
      setValue('energy_commonArea', data.energy.commonArea);
      setValue('energy_stores', data.energy.stores);
    }

    if (data.water) {
      setValue('water_total', data.water.total);
      setValue('water_entries', data.water.entries);
      setValue('water_commonArea', data.water.commonArea);
      setValue('water_stores', data.water.stores);
    }

    if (data.temperature) {
      setValue('temperature_total', data.temperature.total);
      setValue('temperature_internal', data.temperature.internal);
      setValue('temperature_stores', data.temperature.stores);
    }
  }

  private attachEventListeners(): void {
    // Close button
    const closeBtn = this.modal.querySelector('.close-btn') as HTMLButtonElement;
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.config.onClose();
      });
    }

    // Cancel button
    const cancelBtn = this.modal.querySelector('.btn-cancel') as HTMLButtonElement;
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.config.onClose();
      });
    }

    // Save button
    const saveBtn = this.modal.querySelector('.btn-save') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        this.hideError();
        const formData = this.getFormData();
        await this.config.onSave(formData);
      });
    }

    // Backdrop click
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('myio-contract-devices-modal-overlay') && this.config.closeOnBackdrop !== false) {
        this.config.onClose();
      }
    });
  }

  private setupAccessibility(): void {
    const firstInput = this.modal.querySelector('input') as HTMLInputElement;
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }

    this.modal.setAttribute('aria-labelledby', 'modal-title');
  }

  private setupFocusTrap(): void {
    this.focusTrapElements = Array.from(
      this.modal.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')
    ) as HTMLElement[];

    this.modal.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private teardownFocusTrap(): void {
    this.modal.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.config.closeOnBackdrop !== false) {
      event.preventDefault();
      this.config.onClose();
      return;
    }

    if (event.key === 'Tab') {
      const firstElement = this.focusTrapElements[0];
      const lastElement = this.focusTrapElements[this.focusTrapElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }
}
