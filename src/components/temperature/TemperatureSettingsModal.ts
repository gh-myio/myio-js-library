/**
 * Temperature Settings Modal Component
 * RFC-0085: Customer-level temperature threshold configuration
 *
 * Allows configuring minTemperature and maxTemperature attributes
 * for a ThingsBoard customer (SERVER_SCOPE).
 */

// ============================================================================
// Types
// ============================================================================

export interface TemperatureSettingsParams {
  /** JWT token for ThingsBoard API */
  token: string;
  /** Customer ID (ThingsBoard UUID) */
  customerId: string;
  /** Customer name for display */
  customerName?: string;
  /** Callback when settings are saved */
  onSave?: (settings: {
    minTemperature: number;
    maxTemperature: number;
    temperatureClampMin?: number;
    temperatureClampMax?: number;
  }) => void;
  /** Callback when modal closes */
  onClose?: () => void;
  /** Callback when API error occurs (e.g., 401 unauthorized) */
  onError?: (error: { status: number; message: string }) => void;
  /** Initial theme */
  theme?: 'dark' | 'light';
  /** When true, shows and allows editing temperatureClampMin/Max (MyIO superadmin only) */
  isSuperAdmin?: boolean;
}

export interface TemperatureSettingsInstance {
  /** Destroys the modal */
  destroy: () => void;
}

interface ModalState {
  customerId: string;
  customerName: string;
  token: string;
  theme: 'dark' | 'light';
  isSuperAdmin: boolean;
  minTemperature: number | null;
  maxTemperature: number | null;
  temperatureClampMin: number | null;
  temperatureClampMax: number | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
}

// ============================================================================
// Theme Colors
// ============================================================================

const DARK_THEME = {
  modalBg: 'linear-gradient(180deg, #1e1e2e 0%, #151521 100%)',
  headerBg: '#3e1a7d',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  inputBg: 'rgba(255, 255, 255, 0.08)',
  inputBorder: 'rgba(255, 255, 255, 0.2)',
  inputText: '#ffffff',
  buttonPrimary: '#3e1a7d',
  buttonPrimaryHover: '#5a2da8',
  buttonSecondary: 'rgba(255, 255, 255, 0.1)',
  success: '#4CAF50',
  error: '#f44336',
  overlay: 'rgba(0, 0, 0, 0.85)'
};

const LIGHT_THEME = {
  modalBg: '#ffffff',
  headerBg: '#3e1a7d',
  textPrimary: '#1a1a2e',
  textSecondary: 'rgba(0, 0, 0, 0.7)',
  textMuted: 'rgba(0, 0, 0, 0.5)',
  inputBg: '#f5f5f5',
  inputBorder: 'rgba(0, 0, 0, 0.2)',
  inputText: '#1a1a2e',
  buttonPrimary: '#3e1a7d',
  buttonPrimaryHover: '#5a2da8',
  buttonSecondary: 'rgba(0, 0, 0, 0.05)',
  success: '#4CAF50',
  error: '#f44336',
  overlay: 'rgba(0, 0, 0, 0.5)'
};

function getColors(theme: 'dark' | 'light') {
  return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchCustomerAttributes(
  customerId: string,
  token: string,
  onError?: (error: { status: number; message: string }) => void
): Promise<{
  minTemperature: number | null;
  maxTemperature: number | null;
  temperatureClampMin: number | null;
  temperatureClampMax: number | null;
}> {
  const url = `/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token}`
    }
  });

  const empty = { minTemperature: null, maxTemperature: null, temperatureClampMin: null, temperatureClampMax: null };

  if (!response.ok) {
    if (response.status === 404 || response.status === 400) {
      return empty;
    }
    if (onError) {
      onError({ status: response.status, message: `Failed to fetch attributes: ${response.status}` });
      return empty;
    }
    throw new Error(`Failed to fetch attributes: ${response.status}`);
  }

  const attributes = await response.json();
  let minTemperature: number | null = null;
  let maxTemperature: number | null = null;
  let temperatureClampMin: number | null = null;
  let temperatureClampMax: number | null = null;

  if (Array.isArray(attributes)) {
    for (const attr of attributes) {
      if (attr.key === 'minTemperature') {
        minTemperature = Number(attr.value);
      } else if (attr.key === 'maxTemperature') {
        maxTemperature = Number(attr.value);
      } else if (attr.key === 'temperatureClampMin') {
        temperatureClampMin = Number(attr.value);
      } else if (attr.key === 'temperatureClampMax') {
        temperatureClampMax = Number(attr.value);
      }
    }
  }

  return { minTemperature, maxTemperature, temperatureClampMin, temperatureClampMax };
}

async function saveCustomerAttributes(
  customerId: string,
  token: string,
  minTemperature: number,
  maxTemperature: number,
  onError?: (error: { status: number; message: string }) => void,
  temperatureClampMin?: number | null,
  temperatureClampMax?: number | null
): Promise<void> {
  const url = `/api/plugins/telemetry/CUSTOMER/${customerId}/SERVER_SCOPE`;

  const attributes: Record<string, number> = {
    minTemperature,
    maxTemperature,
  };
  if (temperatureClampMin !== undefined && temperatureClampMin !== null) {
    attributes.temperatureClampMin = temperatureClampMin;
  }
  if (temperatureClampMax !== undefined && temperatureClampMax !== null) {
    attributes.temperatureClampMax = temperatureClampMax;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(attributes)
  });

  if (!response.ok) {
    // Call onError callback if provided
    if (onError) {
      onError({ status: response.status, message: `Failed to save attributes: ${response.status}` });
      return;
    }
    throw new Error(`Failed to save attributes: ${response.status}`);
  }
}

// ============================================================================
// Modal Rendering
// ============================================================================

function renderModal(
  container: HTMLElement,
  state: ModalState,
  modalId: string,
  onClose: () => void,
  onSave: (min: number, max: number, clampMin?: number | null, clampMax?: number | null) => Promise<void>
): void {
  const colors = getColors(state.theme);

  const minValue = state.minTemperature !== null ? state.minTemperature : '';
  const maxValue = state.maxTemperature !== null ? state.maxTemperature : '';
  const clampMinValue = state.temperatureClampMin !== null ? state.temperatureClampMin : '';
  const clampMaxValue = state.temperatureClampMax !== null ? state.temperatureClampMax : '';

  container.innerHTML = `
    <style>
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

      #${modalId} {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: ${colors.overlay};
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease-out;
      }

      #${modalId} .modal-content {
        background: ${colors.modalBg};
        border-radius: 16px;
        width: 90%;
        max-width: 900px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        animation: slideIn 0.3s ease-out;
        overflow: hidden;
      }

      #${modalId} .modal-header {
        background: ${colors.headerBg};
        padding: 20px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      #${modalId} .modal-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        font-family: 'Roboto', sans-serif;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      #${modalId} .close-btn {
        width: 32px;
        height: 32px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        color: #fff;
        font-size: 18px;
      }

      #${modalId} .close-btn:hover {
        background: rgba(255, 68, 68, 0.25);
        border-color: rgba(255, 68, 68, 0.5);
      }

      #${modalId} .modal-body {
        padding: 24px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }

      #${modalId} .modal-body-col {
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      #${modalId} .modal-messages {
        grid-column: 1 / -1;
      }

      #${modalId} .form-group {
        margin-bottom: 20px;
      }

      #${modalId} .form-label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: ${colors.textSecondary};
        margin-bottom: 8px;
      }

      #${modalId} .form-input {
        width: 100%;
        padding: 12px 16px;
        font-size: 16px;
        background: ${colors.inputBg};
        border: 1px solid ${colors.inputBorder};
        border-radius: 8px;
        color: ${colors.inputText};
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }

      #${modalId} .form-input:focus {
        border-color: ${colors.buttonPrimary};
      }

      #${modalId} .form-input::placeholder {
        color: ${colors.textMuted};
      }

      #${modalId} .form-hint {
        font-size: 12px;
        color: ${colors.textMuted};
        margin-top: 6px;
      }

      #${modalId} .temperature-range {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      #${modalId} .range-preview {
        margin-top: 20px;
        padding: 16px;
        background: rgba(76, 175, 80, 0.1);
        border: 1px dashed ${colors.success};
        border-radius: 8px;
        text-align: center;
      }

      #${modalId} .range-preview-label {
        font-size: 12px;
        color: ${colors.textMuted};
        margin-bottom: 8px;
      }

      #${modalId} .range-preview-value {
        font-size: 24px;
        font-weight: 600;
        color: ${colors.success};
      }

      #${modalId} .modal-footer {
        padding: 16px 24px;
        border-top: 1px solid ${colors.inputBorder};
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      #${modalId} .btn {
        padding: 10px 24px;
        font-size: 14px;
        font-weight: 500;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      #${modalId} .btn-secondary {
        background: ${colors.buttonSecondary};
        color: ${colors.textSecondary};
        border: 1px solid ${colors.inputBorder};
      }

      #${modalId} .btn-secondary:hover {
        background: ${colors.inputBg};
      }

      #${modalId} .btn-primary {
        background: ${colors.buttonPrimary};
        color: #fff;
      }

      #${modalId} .btn-primary:hover {
        background: ${colors.buttonPrimaryHover};
      }

      #${modalId} .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      #${modalId} .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      #${modalId} .message {
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 14px;
      }

      #${modalId} .message-error {
        background: rgba(244, 67, 54, 0.1);
        border: 1px solid ${colors.error};
        color: ${colors.error};
      }

      #${modalId} .message-success {
        background: rgba(76, 175, 80, 0.1);
        border: 1px solid ${colors.success};
        color: ${colors.success};
      }

      #${modalId} .loading-overlay {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        color: ${colors.textSecondary};
      }

      #${modalId} .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid ${colors.inputBorder};
        border-top-color: ${colors.buttonPrimary};
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 16px;
      }
    </style>

    <div id="${modalId}" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">
            <span>🌡️</span>
            Configurações${state.customerName ? ` — ${state.customerName}` : ''}
          </h2>
          <button class="close-btn" id="${modalId}-close">&times;</button>
        </div>

        <div class="modal-body">
          ${state.isLoading ? `
            <div class="modal-messages" style="grid-column:1/-1;">
              <div class="loading-overlay">
                <div class="loading-spinner"></div>
                <div>Carregando configurações...</div>
              </div>
            </div>
          ` : `
            ${state.error || state.successMessage ? `
              <div class="modal-messages">
                ${state.error ? `<div class="message message-error">${state.error}</div>` : ''}
                ${state.successMessage ? `<div class="message message-success">${state.successMessage}</div>` : ''}
              </div>
            ` : ''}

            <!-- Left column: comfort range inputs -->
            <div class="modal-body-col">
              <div class="form-group">
                <label class="form-label">Faixa de Temperatura Ideal</label>
                <div class="temperature-range">
                  <div>
                    <input
                      type="number"
                      id="${modalId}-min"
                      class="form-input"
                      placeholder="Mínima"
                      value="${minValue}"
                      step="0.5"
                      min="0"
                      max="50"
                    />
                    <div class="form-hint">Temperatura mínima (°C)</div>
                  </div>
                  <div>
                    <input
                      type="number"
                      id="${modalId}-max"
                      class="form-input"
                      placeholder="Máxima"
                      value="${maxValue}"
                      step="0.5"
                      min="0"
                      max="50"
                    />
                    <div class="form-hint">Temperatura máxima (°C)</div>
                  </div>
                </div>
              </div>

              <div class="range-preview" id="${modalId}-preview">
                <div class="range-preview-label">Faixa de conforto configurada</div>
                <div class="range-preview-value" id="${modalId}-preview-value">
                  ${minValue && maxValue ? `${minValue}°C — ${maxValue}°C` : 'Não definida'}
                </div>
              </div>
            </div>

            <!-- Right column: superadmin clamp section -->
            <div class="modal-body-col">
              ${state.isSuperAdmin ? `
                <div style="padding:16px; background:${colors.inputBg}; border-radius:10px; border:1px dashed ${colors.inputBorder}; height:100%; box-sizing:border-box;">
                  <div style="font-size:12px; font-weight:600; color:${colors.textMuted}; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:14px;">
                    🔧 Filtro de Outliers — apenas MyIO
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label">Faixa de Validação (Clamp)</label>
                    <div class="temperature-range">
                      <div>
                        <input
                          type="number"
                          id="${modalId}-clamp-min"
                          class="form-input"
                          placeholder="Ex: 10"
                          value="${clampMinValue}"
                          step="1"
                          min="-20"
                          max="50"
                        />
                        <div class="form-hint">Mínimo válido (°C) — padrão: 15</div>
                      </div>
                      <div>
                        <input
                          type="number"
                          id="${modalId}-clamp-max"
                          class="form-input"
                          placeholder="Ex: 45"
                          value="${clampMaxValue}"
                          step="1"
                          min="20"
                          max="80"
                        />
                        <div class="form-hint">Máximo válido (°C) — padrão: 40</div>
                      </div>
                    </div>
                    <div class="form-hint" style="margin-top:8px;">Leituras fora desta faixa são descartadas como erro de sensor.</div>
                  </div>
                </div>
              ` : `
                <div style="display:flex; align-items:center; justify-content:center; height:100%; min-height:120px; color:${colors.textMuted}; font-size:13px; text-align:center; padding:16px;">
                  Configure a faixa de temperatura ideal para alertas e o painel de monitoramento.
                </div>
              `}
            </div>
          `}
        </div>

        ${!state.isLoading ? `
          <div class="modal-footer">
            <button class="btn btn-secondary" id="${modalId}-cancel">Cancelar</button>
            <button class="btn btn-primary" id="${modalId}-save" ${state.isSaving ? 'disabled' : ''}>
              ${state.isSaving ? '<div class="spinner"></div> Salvando...' : 'Salvar'}
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Event handlers
  const closeBtn = document.getElementById(`${modalId}-close`);
  const cancelBtn = document.getElementById(`${modalId}-cancel`);
  const saveBtn = document.getElementById(`${modalId}-save`);
  const minInput = document.getElementById(`${modalId}-min`) as HTMLInputElement;
  const maxInput = document.getElementById(`${modalId}-max`) as HTMLInputElement;
  const clampMinInput = document.getElementById(`${modalId}-clamp-min`) as HTMLInputElement | null;
  const clampMaxInput = document.getElementById(`${modalId}-clamp-max`) as HTMLInputElement | null;
  const previewValue = document.getElementById(`${modalId}-preview-value`);
  const overlay = document.getElementById(modalId);

  // Close handlers
  closeBtn?.addEventListener('click', onClose);
  cancelBtn?.addEventListener('click', onClose);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) onClose();
  });

  // Update preview on input change
  const updatePreview = () => {
    if (previewValue && minInput && maxInput) {
      const min = minInput.value;
      const max = maxInput.value;
      if (min && max) {
        previewValue.textContent = `${min}°C - ${max}°C`;
      } else {
        previewValue.textContent = 'Não definida';
      }
    }
  };

  minInput?.addEventListener('input', updatePreview);
  maxInput?.addEventListener('input', updatePreview);

  // Save handler
  saveBtn?.addEventListener('click', async () => {
    if (!minInput || !maxInput) return;

    const min = parseFloat(minInput.value);
    const max = parseFloat(maxInput.value);

    // Validation — comfort range
    if (isNaN(min) || isNaN(max)) {
      state.error = 'Por favor, preencha ambos os valores.';
      renderModal(container, state, modalId, onClose, onSave);
      return;
    }

    if (min >= max) {
      state.error = 'A temperatura mínima deve ser menor que a máxima.';
      renderModal(container, state, modalId, onClose, onSave);
      return;
    }

    if (min < 0 || max > 50) {
      state.error = 'Os valores devem estar entre 0°C e 50°C.';
      renderModal(container, state, modalId, onClose, onSave);
      return;
    }

    // Clamp values (superadmin only)
    let clampMin: number | null = null;
    let clampMax: number | null = null;
    if (state.isSuperAdmin && clampMinInput && clampMaxInput) {
      const cMin = clampMinInput.value !== '' ? parseFloat(clampMinInput.value) : null;
      const cMax = clampMaxInput.value !== '' ? parseFloat(clampMaxInput.value) : null;
      if (cMin !== null && cMax !== null) {
        if (isNaN(cMin) || isNaN(cMax)) {
          state.error = 'Os valores de clamp devem ser números válidos.';
          renderModal(container, state, modalId, onClose, onSave);
          return;
        }
        if (cMin >= cMax) {
          state.error = 'O clamp mínimo deve ser menor que o clamp máximo.';
          renderModal(container, state, modalId, onClose, onSave);
          return;
        }
        clampMin = cMin;
        clampMax = cMax;
      }
    }

    await onSave(min, max, clampMin, clampMax);
  });
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Opens the temperature settings modal for a customer
 */
export function openTemperatureSettingsModal(
  params: TemperatureSettingsParams
): TemperatureSettingsInstance {
  const modalId = `myio-temp-settings-${Date.now()}`;

  // Initialize state
  const state: ModalState = {
    customerId: params.customerId,
    customerName: params.customerName || '',
    token: params.token,
    theme: params.theme || 'light',
    isSuperAdmin: params.isSuperAdmin ?? false,
    minTemperature: null,
    maxTemperature: null,
    temperatureClampMin: null,
    temperatureClampMax: null,
    isLoading: true,
    isSaving: false,
    error: null,
    successMessage: null
  };

  // Create container
  const container = document.createElement('div');
  container.id = `${modalId}-container`;
  document.body.appendChild(container);

  // Cleanup function
  const destroy = () => {
    container.remove();
    params.onClose?.();
  };

  // Save function
  const handleSave = async (min: number, max: number, clampMin?: number | null, clampMax?: number | null) => {
    state.isSaving = true;
    state.error = null;
    state.successMessage = null;
    renderModal(container, state, modalId, destroy, handleSave);

    try {
      await saveCustomerAttributes(state.customerId, state.token, min, max, params.onError, clampMin, clampMax);

      state.minTemperature = min;
      state.maxTemperature = max;
      if (state.isSuperAdmin) {
        state.temperatureClampMin = clampMin ?? null;
        state.temperatureClampMax = clampMax ?? null;
      }
      state.isSaving = false;
      state.successMessage = 'Configurações salvas com sucesso!';

      renderModal(container, state, modalId, destroy, handleSave);

      // Call onSave callback
      params.onSave?.({
        minTemperature: min,
        maxTemperature: max,
        ...(state.isSuperAdmin && clampMin !== null && clampMax !== null
          ? { temperatureClampMin: clampMin!, temperatureClampMax: clampMax! }
          : {}),
      });

      // Auto-close after success
      setTimeout(() => {
        destroy();
      }, 1500);
    } catch (error) {
      state.isSaving = false;
      state.error = `Erro ao salvar: ${(error as Error).message}`;
      renderModal(container, state, modalId, destroy, handleSave);
    }
  };

  // Initial render
  renderModal(container, state, modalId, destroy, handleSave);

  // Fetch current values
  fetchCustomerAttributes(state.customerId, state.token, params.onError)
    .then(({ minTemperature, maxTemperature, temperatureClampMin, temperatureClampMax }) => {
      state.minTemperature = minTemperature;
      state.maxTemperature = maxTemperature;
      state.temperatureClampMin = temperatureClampMin;
      state.temperatureClampMax = temperatureClampMax;
      state.isLoading = false;
      renderModal(container, state, modalId, destroy, handleSave);
    })
    .catch((error) => {
      state.isLoading = false;
      state.error = `Erro ao carregar: ${(error as Error).message}`;
      renderModal(container, state, modalId, destroy, handleSave);
    });

  return { destroy };
}
