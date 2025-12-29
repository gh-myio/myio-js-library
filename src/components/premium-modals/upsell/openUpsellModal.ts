/**
 * RFC-0109: Upsell Post-Setup Modal
 *
 * Multi-step wizard for device configuration and attribute validation.
 * Allows operators to search for devices, validate server-scope attributes,
 * verify entity relationships, and fix missing configurations.
 *
 * Follows MyIO Premium Modal style (same as TemperatureModal).
 */

import {
  handleDeviceType,
  getSuggestedProfiles,
  type InferredDeviceType,
} from '../../../classify/deviceType';

import type {
  UpsellModalParams,
  UpsellModalInstance,
  Customer,
  Device,
  DeviceAttributes,
  DeviceRelation,
  DeviceServerAttrs,
  DeviceLatestTelemetry,
  IngestionDevice,
  ValidationMap,
  IngestionCache,
  TbEntityId,
} from './types';

// Helper: extract ID string from ThingsBoard entity ID object
function getEntityId(entity: { id: TbEntityId } | null | undefined): string {
  return entity?.id?.id || '';
}

// Re-export types
export type {
  UpsellModalParams,
  UpsellModalInstance,
  Customer,
  Device,
  DeviceAttributes,
  DeviceRelation,
  ValidationMap,
  TbEntityId,
};

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TB_API_BASE = '';
const DEFAULT_INGESTION_API_BASE = 'https://api.data.apps.myio-bas.com';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const MYIO_PURPLE = '#3e1a7d';
const MYIO_PURPLE_DARK = '#2d1360';

// Ingestion device cache
const ingestionCache = new Map<string, IngestionCache>();

// ============================================================================
// Theme Colors
// ============================================================================

interface ThemeColors {
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  inputBg: string;
  cardBg: string;
  success: string;
  warning: string;
  danger: string;
  primary: string;
}

function getThemeColors(theme: 'dark' | 'light'): ThemeColors {
  if (theme === 'dark') {
    return {
      surface: '#1e1e2e',
      text: '#e0e0e0',
      textMuted: '#9ca3af',
      border: 'rgba(255,255,255,0.1)',
      inputBg: 'rgba(255,255,255,0.05)',
      cardBg: 'rgba(255,255,255,0.05)',
      success: '#4caf50',
      warning: '#ff9800',
      danger: '#f44336',
      primary: '#a78bfa',
    };
  }
  return {
    surface: '#ffffff',
    text: '#1f2937',
    textMuted: '#6b7280',
    border: '#e5e7eb',
    inputBg: '#ffffff',
    cardBg: '#fafafa',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    primary: MYIO_PURPLE,
  };
}

// ============================================================================
// Translations
// ============================================================================

const i18n = {
  pt: {
    title: 'Upsell Post-Setup',
    step1: 'Cliente',
    step2: 'Dispositivo',
    step3: 'Validação',
    searchCustomers: 'Buscar clientes...',
    searchDevices: 'Buscar dispositivos...',
    allTypes: 'Todos os tipos',
    allProfiles: 'Todos os perfis',
    serverScopeAttrs: 'Atributos Server-Scope',
    relationTo: 'Relação TO',
    owner: 'Owner',
    back: '← Voltar',
    next: 'Próximo →',
    cancel: 'Cancelar',
    save: '💾 Salvar',
    suggest: 'Sugerir',
    fetch: 'Buscar',
    noResults: 'Nenhum resultado encontrado',
    selectCustomer: 'Selecione um cliente',
    selectDevice: 'Selecione um dispositivo',
    validRelation: 'Relação válida',
    noRelation: 'Nenhuma relação TO encontrada',
    validOwner: 'Owner correto',
    invalidOwner: 'Owner incorreto',
    reassign: 'Reatribuir',
    loading: 'Carregando...',
    errorLoading: 'Erro ao carregar dados',
    saved: 'Alterações salvas com sucesso!',
    errorSaving: 'Erro ao salvar. Tente novamente.',
  },
  en: {
    title: 'Upsell Post-Setup',
    step1: 'Customer',
    step2: 'Device',
    step3: 'Validation',
    searchCustomers: 'Search customers...',
    searchDevices: 'Search devices...',
    allTypes: 'All types',
    allProfiles: 'All profiles',
    serverScopeAttrs: 'Server-Scope Attributes',
    relationTo: 'Relation TO',
    owner: 'Owner',
    back: '← Back',
    next: 'Next →',
    cancel: 'Cancel',
    save: '💾 Save',
    suggest: 'Suggest',
    fetch: 'Fetch',
    noResults: 'No results found',
    selectCustomer: 'Please select a customer',
    selectDevice: 'Please select a device',
    validRelation: 'Valid relation',
    noRelation: 'No TO relation found',
    validOwner: 'Correct owner',
    invalidOwner: 'Invalid owner',
    reassign: 'Reassign',
    loading: 'Loading...',
    errorLoading: 'Error loading data',
    saved: 'Changes saved successfully!',
    errorSaving: 'Error saving. Please try again.',
  },
};

// ============================================================================
// Modal State
// ============================================================================

type CustomerSortField = 'name' | 'createdTime' | 'parentName';
type DeviceSortField = 'name' | 'label' | 'createdTime' | 'type' | 'deviceType' | 'deviceProfile';
type SortOrder = 'asc' | 'desc';

// Column widths for drag-resize
interface ColumnWidths {
  label: number;
  type: number;
  deviceType: number;
  deviceProfile: number;
  telemetry: number;
  status: number;
}

interface ModalState {
  token: string;
  ingestionToken: string;
  tbApiBase: string;
  ingestionApiBase: string;
  theme: 'dark' | 'light';
  locale: string;
  isMaximized: boolean;
  currentStep: number;
  isLoading: boolean;
  customers: Customer[];
  customerNameMap: Map<string, string>; // id -> name for parent lookup
  devices: Device[];
  selectedCustomer: Customer | null;
  selectedDevice: Device | null;
  deviceAttributes: DeviceAttributes;
  deviceRelation: DeviceRelation | null;
  customerSort: { field: CustomerSortField; order: SortOrder };
  deviceSort: { field: DeviceSortField; order: SortOrder };
  deviceFilters: { types: string[]; deviceTypes: string[]; deviceProfiles: string[] };
  deviceSelectionMode: 'single' | 'multi';
  selectedDevices: Device[];
  bulkAttributeModal: {
    open: boolean;
    attribute: string;
    value: string;
    saving: boolean;
  };
  columnWidths: ColumnWidths;
  deviceAttrsLoaded: boolean;
  deviceTelemetryLoaded: boolean;
  telemetryLoading: boolean;
  telemetryLoadedCount: number;
  deviceRelations: DeviceRelation[];
  allRelations: Array<{ from: TbEntityId; to: TbEntityId; type: string }>;
}

// Helper: format timestamp to locale date string
function formatDate(timestamp: number | undefined, locale: string, includeTime = false): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  if (!includeTime) return dateStr;
  const timeStr = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr} ${timeStr}`;
}

// Helper: sort customers by field
function sortCustomers(
  customers: Customer[],
  field: CustomerSortField,
  order: SortOrder,
  nameMap?: Map<string, string>
): Customer[] {
  return [...customers].sort((a, b) => {
    let compare = 0;
    if (field === 'name') {
      const nameA = (a.name || a.title || '').toLowerCase();
      const nameB = (b.name || b.title || '').toLowerCase();
      compare = nameA.localeCompare(nameB);
    } else if (field === 'createdTime') {
      compare = (a.createdTime || 0) - (b.createdTime || 0);
    } else if (field === 'parentName' && nameMap) {
      const parentA = a.parentCustomerId?.id ? (nameMap.get(a.parentCustomerId.id) || '') : '';
      const parentB = b.parentCustomerId?.id ? (nameMap.get(b.parentCustomerId.id) || '') : '';
      compare = parentA.toLowerCase().localeCompare(parentB.toLowerCase());
    }
    return order === 'asc' ? compare : -compare;
  });
}

// Helper: sort devices by field
function sortDevices(
  devices: Device[],
  field: DeviceSortField,
  order: SortOrder
): Device[] {
  return [...devices].sort((a, b) => {
    let compare = 0;
    if (field === 'name') {
      compare = (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
    } else if (field === 'label') {
      compare = (a.label || '').toLowerCase().localeCompare((b.label || '').toLowerCase());
    } else if (field === 'createdTime') {
      compare = (a.createdTime || 0) - (b.createdTime || 0);
    } else if (field === 'type') {
      compare = (a.type || '').toLowerCase().localeCompare((b.type || '').toLowerCase());
    } else if (field === 'deviceType') {
      compare = (a.serverAttrs?.deviceType || '').toLowerCase().localeCompare((b.serverAttrs?.deviceType || '').toLowerCase());
    } else if (field === 'deviceProfile') {
      compare = (a.serverAttrs?.deviceProfile || '').toLowerCase().localeCompare((b.serverAttrs?.deviceProfile || '').toLowerCase());
    }
    return order === 'asc' ? compare : -compare;
  });
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Opens the Upsell Post-Setup Modal
 */
export function openUpsellModal(params: UpsellModalParams): UpsellModalInstance {
  const modalId = `myio-upsell-modal-${Date.now()}`;
  const t = i18n[params.lang || 'pt'];

  // Initialize state
  const state: ModalState = {
    token: params.thingsboardToken,
    ingestionToken: params.ingestionToken,
    tbApiBase: params.tbApiBase || DEFAULT_TB_API_BASE,
    ingestionApiBase: params.ingestionApiBase || DEFAULT_INGESTION_API_BASE,
    theme: 'light',
    locale: params.lang === 'en' ? 'en-US' : 'pt-BR',
    isMaximized: false,
    currentStep: 1,
    isLoading: true,
    customers: [],
    customerNameMap: new Map(),
    devices: [],
    selectedCustomer: null,
    selectedDevice: null,
    deviceAttributes: {},
    deviceRelation: null,
    customerSort: { field: 'name', order: 'asc' },
    deviceSort: { field: 'name', order: 'asc' },
    deviceFilters: { types: [], deviceTypes: [], deviceProfiles: [] },
    deviceSelectionMode: 'single',
    selectedDevices: [],
    bulkAttributeModal: { open: false, attribute: 'deviceType', value: '', saving: false },
    columnWidths: { label: 140, type: 70, deviceType: 80, deviceProfile: 90, telemetry: 100, status: 70 },
    deviceAttrsLoaded: false,
    deviceTelemetryLoaded: false,
    telemetryLoading: false,
    telemetryLoadedCount: 0,
    deviceRelations: [],
    allRelations: [],
  };

  // Load saved theme
  const savedTheme = localStorage.getItem('myio-upsell-modal-theme') as 'dark' | 'light';
  if (savedTheme) state.theme = savedTheme;

  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.id = modalId;
  document.body.appendChild(modalContainer);

  // Render modal
  renderModal(modalContainer, state, modalId, t);

  // Fetch initial data
  loadCustomers(state, modalContainer, modalId, t, params.onClose);

  // Return instance
  return {
    close: () => closeModal(modalContainer, params.onClose),
    getStep: () => state.currentStep,
    getCustomer: () => state.selectedCustomer,
    getDevice: () => state.selectedDevice,
    getContainer: () => modalContainer,
  };
}

// ============================================================================
// Close Modal
// ============================================================================

function closeModal(container: HTMLElement, onClose?: () => void): void {
  container.remove();
  onClose?.();
}

// ============================================================================
// Rendering
// ============================================================================

function renderModal(
  container: HTMLElement,
  state: ModalState,
  modalId: string,
  t: typeof i18n.pt,
  error?: Error
): void {
  const colors = getThemeColors(state.theme);
  const contentMaxWidth = state.isMaximized ? '100%' : '1040px';
  const contentMaxHeight = state.isMaximized ? '100vh' : '90vh';
  const contentBorderRadius = state.isMaximized ? '0' : '10px';

  container.innerHTML = `
    <div class="myio-upsell-modal-overlay" style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); z-index: 9998;
      display: flex; justify-content: center; align-items: center;
      backdrop-filter: blur(2px);
    ">
      <div class="myio-upsell-modal-content" style="
        background: ${colors.surface}; border-radius: ${contentBorderRadius};
        max-width: ${contentMaxWidth}; width: ${state.isMaximized ? '100%' : '95%'};
        max-height: ${contentMaxHeight}; height: ${state.isMaximized ? '100%' : 'auto'};
        overflow: hidden; display: flex; flex-direction: column;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: 'Roboto', Arial, sans-serif;
      ">
        <!-- Header - MyIO Premium Style -->
        <div style="
          padding: 4px 8px; display: flex; align-items: center; justify-content: space-between;
          background: ${MYIO_PURPLE}; color: white; border-radius: ${state.isMaximized ? '0' : '10px 10px 0 0'};
          min-height: 20px;
        ">
          <h2 style="margin: 6px; font-size: 18px; font-weight: 600; color: white; line-height: 2;">
            📦 ${t.title}
          </h2>
          <div style="display: flex; gap: 4px; align-items: center;">
            <!-- Theme Toggle -->
            <button id="${modalId}-theme-toggle" title="Alternar tema" style="
              background: none; border: none; font-size: 16px; cursor: pointer;
              padding: 4px 8px; border-radius: 6px; color: rgba(255,255,255,0.8);
              transition: background-color 0.2s;
            ">${state.theme === 'dark' ? '☀️' : '🌙'}</button>
            <!-- Maximize Button -->
            <button id="${modalId}-maximize" title="${state.isMaximized ? 'Restaurar' : 'Maximizar'}" style="
              background: none; border: none; font-size: 16px; cursor: pointer;
              padding: 4px 8px; border-radius: 6px; color: rgba(255,255,255,0.8);
              transition: background-color 0.2s;
            ">${state.isMaximized ? '🗗' : '🗖'}</button>
            <!-- Close Button -->
            <button id="${modalId}-close" title="Fechar" style="
              background: none; border: none; font-size: 20px; cursor: pointer;
              padding: 4px 8px; border-radius: 6px; color: rgba(255,255,255,0.8);
              transition: background-color 0.2s;
            ">×</button>
          </div>
        </div>

        <!-- Body -->
        <div style="flex: 1; overflow-y: auto; padding: 16px;">
          <!-- Steps Indicator -->
          <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 20px;">
            ${renderStepIndicator(1, t.step1, state.currentStep, colors)}
            <div style="display: flex; align-items: center; color: ${colors.textMuted};">→</div>
            ${renderStepIndicator(2, t.step2, state.currentStep, colors)}
            <div style="display: flex; align-items: center; color: ${colors.textMuted};">→</div>
            ${renderStepIndicator(3, t.step3, state.currentStep, colors)}
          </div>

          <!-- Step Content -->
          ${state.isLoading
            ? renderLoading(colors, t)
            : error
              ? renderError(colors, t, error)
              : state.currentStep === 1
                ? renderStep1(state, modalId, colors, t)
                : state.currentStep === 2
                  ? renderStep2(state, modalId, colors, t)
                  : renderStep3(state, modalId, colors, t)
          }
        </div>

        <!-- Footer -->
        <div style="
          padding: 12px 16px; border-top: 1px solid ${colors.border};
          display: flex; justify-content: space-between; background: ${colors.cardBg};
        ">
          <div>
            ${state.currentStep > 1 ? `
              <button id="${modalId}-back" style="
                background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f3f4f6'};
                color: ${colors.text}; border: 1px solid ${colors.border};
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-family: 'Roboto', Arial, sans-serif;
              ">${t.back}</button>
            ` : ''}
          </div>
          <div style="display: flex; gap: 12px;">
            ${state.currentStep === 2 && state.deviceSelectionMode === 'multi' && state.selectedDevices.length > 0 ? `
              <button id="${modalId}-bulk-attr" style="
                background: #f59e0b; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
                display: flex; align-items: center; gap: 6px;
              ">⚡ Forçar Atributo (${state.selectedDevices.length})</button>
            ` : ''}
            <button id="${modalId}-cancel" style="
              background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f3f4f6'};
              color: ${colors.text}; border: 1px solid ${colors.border};
              padding: 8px 16px; border-radius: 6px; cursor: pointer;
              font-size: 14px; font-family: 'Roboto', Arial, sans-serif;
            ">${t.cancel}</button>
            ${state.currentStep < 3 ? `
              <button id="${modalId}-next" style="
                background: ${MYIO_PURPLE}; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
              " ${state.deviceSelectionMode === 'multi' ? 'disabled title="Desabilitado no modo multi"' : ''}>${t.next}</button>
            ` : `
              <button id="${modalId}-save" style="
                background: ${colors.success}; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
              ">${t.save}</button>
            `}
          </div>
        </div>
      </div>
    </div>
    <style>
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      #${modalId} input:focus, #${modalId} select:focus {
        outline: 2px solid ${MYIO_PURPLE};
        outline-offset: 1px;
      }
      #${modalId} button:hover:not(:disabled) {
        opacity: 0.9;
      }
      #${modalId} button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      #${modalId} .myio-upsell-modal-content > div:first-child button:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
      }
      #${modalId} .myio-list-item:hover {
        background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#f3f4f6'} !important;
      }
      #${modalId} .myio-list-item.selected {
        background: ${state.theme === 'dark' ? 'rgba(167,139,250,0.2)' : '#ede9fe'} !important;
        border-left: 3px solid ${MYIO_PURPLE} !important;
      }
    </style>

    ${state.bulkAttributeModal.open ? `
      <!-- Bulk Attribute Modal -->
      <div class="myio-bulk-attr-overlay" style="
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); z-index: 10001;
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="
          background: ${colors.surface}; border-radius: 12px; padding: 24px;
          max-width: 450px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; color: ${colors.text}; font-size: 18px; font-weight: 600;">
              ⚡ Forçar Atributo
            </h3>
            <button id="${modalId}-bulk-close" style="
              background: none; border: none; font-size: 20px; cursor: pointer;
              color: ${colors.textMuted}; padding: 4px;
            ">✕</button>
          </div>

          <div style="margin-bottom: 16px; padding: 12px; background: ${colors.surface}; border-radius: 8px; border: 1px solid ${colors.border};">
            <div style="font-size: 12px; color: ${colors.textMuted}; margin-bottom: 4px;">Devices selecionados:</div>
            <div style="font-size: 14px; color: ${colors.text}; font-weight: 500;">${state.selectedDevices.length} dispositivos</div>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; color: ${colors.textMuted}; font-size: 12px; margin-bottom: 6px; font-weight: 500;">
              Atributo (SERVER_SCOPE)
            </label>
            <select id="${modalId}-bulk-attr-select" style="
              width: 100%; padding: 10px 12px; border: 1px solid ${colors.border};
              border-radius: 6px; font-size: 14px; color: ${colors.text};
              background: ${colors.inputBg}; cursor: pointer;
            ">
              <option value="deviceType" ${state.bulkAttributeModal.attribute === 'deviceType' ? 'selected' : ''}>deviceType</option>
              <option value="deviceProfile" ${state.bulkAttributeModal.attribute === 'deviceProfile' ? 'selected' : ''}>deviceProfile</option>
              <option value="centralName" ${state.bulkAttributeModal.attribute === 'centralName' ? 'selected' : ''}>centralName</option>
              <option value="centralId" ${state.bulkAttributeModal.attribute === 'centralId' ? 'selected' : ''}>centralId</option>
              <option value="identifier" ${state.bulkAttributeModal.attribute === 'identifier' ? 'selected' : ''}>identifier</option>
            </select>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; color: ${colors.textMuted}; font-size: 12px; margin-bottom: 6px; font-weight: 500;">
              Valor
            </label>
            <input type="text" id="${modalId}-bulk-attr-value" value="${state.bulkAttributeModal.value}" placeholder="Digite o valor..." style="
              width: 100%; padding: 10px 12px; border: 1px solid ${colors.border};
              border-radius: 6px; font-size: 14px; color: ${colors.text};
              background: ${colors.inputBg}; box-sizing: border-box;
            "/>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="${modalId}-bulk-cancel" style="
              background: ${colors.surface}; color: ${colors.text};
              border: 1px solid ${colors.border}; padding: 10px 20px;
              border-radius: 6px; cursor: pointer; font-size: 14px;
            ">Cancelar</button>
            <button id="${modalId}-bulk-save" style="
              background: #f59e0b; color: white; border: none;
              padding: 10px 20px; border-radius: 6px; cursor: pointer;
              font-size: 14px; font-weight: 500;
            " ${state.bulkAttributeModal.saving ? 'disabled' : ''}>
              ${state.bulkAttributeModal.saving ? 'Salvando...' : 'Salvar para ' + state.selectedDevices.length + ' devices'}
            </button>
          </div>
        </div>
      </div>
    ` : ''}
  `;

  // Setup event listeners
  setupEventListeners(container, state, modalId, t);
}

function renderStepIndicator(step: number, label: string, currentStep: number, colors: ThemeColors): string {
  const isActive = step === currentStep;
  const isCompleted = step < currentStep;
  const bgColor = isActive ? MYIO_PURPLE : isCompleted ? colors.success : colors.cardBg;
  const textColor = isActive || isCompleted ? 'white' : colors.textMuted;
  const borderColor = isActive || isCompleted ? 'transparent' : colors.border;

  return `
    <div style="
      display: flex; align-items: center; gap: 8px;
      padding: 6px 14px; border-radius: 20px;
      background: ${bgColor}; color: ${textColor};
      border: 1px solid ${borderColor};
      font-size: 13px; font-weight: 500;
    ">
      <span style="
        width: 22px; height: 22px; border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex; align-items: center; justify-content: center;
        font-weight: 600; font-size: 12px;
      ">${isCompleted ? '✓' : step}</span>
      <span>${label}</span>
    </div>
  `;
}

function renderLoading(colors: ThemeColors, t: typeof i18n.pt): string {
  return `
    <div style="text-align: center; padding: 60px 20px; color: ${colors.textMuted};">
      <div style="animation: spin 1s linear infinite; font-size: 40px; margin-bottom: 16px;">↻</div>
      <div style="font-size: 16px;">${t.loading}</div>
    </div>
  `;
}

function renderError(colors: ThemeColors, t: typeof i18n.pt, error: Error): string {
  return `
    <div style="text-align: center; padding: 60px 20px; color: ${colors.danger};">
      <div style="font-size: 40px; margin-bottom: 16px;">⚠️</div>
      <div style="font-size: 16px; margin-bottom: 8px;">${t.errorLoading}</div>
      <div style="font-size: 13px; color: ${colors.textMuted};">${error.message}</div>
    </div>
  `;
}

// ============================================================================
// Step 1: Customer Selection
// ============================================================================

function renderStep1(state: ModalState, modalId: string, colors: ThemeColors, t: typeof i18n.pt): string {
  const { field: sortField, order: sortOrder } = state.customerSort;
  const sortedCustomers = sortCustomers(state.customers, sortField, sortOrder, state.customerNameMap);
  const sortIcon = sortOrder === 'asc' ? '↑' : '↓';

  const btnStyle = (isActive: boolean) => `
    background: ${isActive ? MYIO_PURPLE : colors.cardBg};
    color: ${isActive ? 'white' : colors.text};
    border: 1px solid ${isActive ? MYIO_PURPLE : colors.border};
    padding: 6px 12px; border-radius: 6px; cursor: pointer;
    font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 4px;
  `;

  // Helper to get parent name
  const getParentName = (customer: Customer): string => {
    if (!customer.parentCustomerId?.id) return 'N/A';
    return state.customerNameMap.get(customer.parentCustomerId.id) || 'N/A';
  };

  // Helper to get owner name
  const getOwnerName = (customer: Customer): string => {
    if (!customer.ownerId?.id) return 'N/A';
    // If owner is a customer, look up the name
    if (customer.ownerId.entityType === 'CUSTOMER') {
      return state.customerNameMap.get(customer.ownerId.id) || 'N/A';
    }
    // If owner is a tenant, show TENANT
    return 'TENANT';
  };

  return `
    <div style="
      padding: 16px; background: ${colors.cardBg}; border-radius: 8px;
      border: 1px solid ${colors.border}; margin-bottom: 16px;
    ">
      <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px;">
          <label style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500; display: block; margin-bottom: 4px;">
            🔍 ${t.searchCustomers}
          </label>
          <input type="text" id="${modalId}-customer-search" placeholder="${t.searchCustomers}" style="
            width: 100%; padding: 10px 14px; border: 1px solid ${colors.border};
            border-radius: 6px; font-size: 14px; color: ${colors.text};
            background: ${colors.inputBg}; box-sizing: border-box;
          "/>
        </div>
        <div style="display: flex; gap: 6px;">
          <button id="${modalId}-sort-name" style="${btnStyle(sortField === 'name')}">
            Nome ${sortField === 'name' ? sortIcon : ''}
          </button>
          <button id="${modalId}-sort-parent" style="${btnStyle(sortField === 'parentName')}">
            Pai ${sortField === 'parentName' ? sortIcon : ''}
          </button>
          <button id="${modalId}-sort-date" style="${btnStyle(sortField === 'createdTime')}">
            Data ${sortField === 'createdTime' ? sortIcon : ''}
          </button>
        </div>
      </div>
    </div>

    <div style="
      max-height: 350px; overflow-y: auto; border: 1px solid ${colors.border};
      border-radius: 8px; background: ${colors.surface};
    " id="${modalId}-customer-list">
      ${sortedCustomers.length === 0
        ? `<div style="padding: 40px; text-align: center; color: ${colors.textMuted};">${t.noResults}</div>`
        : sortedCustomers.map(customer => {
            const customerId = getEntityId(customer);
            const isSelected = getEntityId(state.selectedCustomer) === customerId;
            const createdDate = formatDate(customer.createdTime, state.locale);
            const parentName = getParentName(customer);
            const ownerName = getOwnerName(customer);
            return `
          <div class="myio-list-item ${isSelected ? 'selected' : ''}"
               data-customer-id="${customerId}" style="
            display: flex; align-items: center; gap: 10px;
            padding: 12px 14px; border-bottom: 1px solid ${colors.border};
            cursor: pointer; transition: background 0.15s;
          ">
            <div style="font-size: 24px;">🏢</div>
            <div style="flex: 1; min-width: 100px;">
              <div style="font-weight: 500; color: ${colors.text}; font-size: 13px;">${customer.name || customer.title}</div>
              <div style="font-size: 11px; color: ${colors.textMuted};">${customer.cnpj || 'ID: ' + customerId.slice(0, 8) + '...'}</div>
            </div>
            <div style="min-width: 90px; text-align: center;">
              <div style="font-size: 10px; color: ${colors.textMuted};">Pai</div>
              <div style="font-size: 11px; color: ${parentName === 'N/A' ? colors.textMuted : colors.text}; font-weight: ${parentName === 'N/A' ? 'normal' : '500'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;">
                ${parentName}
              </div>
            </div>
            <div style="min-width: 70px; text-align: center;">
              <div style="font-size: 10px; color: ${colors.textMuted};">Owner</div>
              <div style="font-size: 11px; color: ${ownerName === 'N/A' ? colors.textMuted : ownerName === 'TENANT' ? colors.primary : colors.text}; font-weight: ${ownerName === 'N/A' ? 'normal' : '500'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70px;">
                ${ownerName}
              </div>
            </div>
            ${createdDate ? `<div style="min-width: 70px; text-align: center;">
              <div style="font-size: 10px; color: ${colors.textMuted};">Criado</div>
              <div style="font-size: 11px; color: ${colors.text};">${createdDate}</div>
            </div>` : ''}
            ${isSelected ? `<div style="color: ${colors.success}; font-size: 16px;">✓</div>` : ''}
          </div>
        `;}).join('')
      }
    </div>
  `;
}

// ============================================================================
// Step 2: Device Selection
// ============================================================================

function renderStep2(state: ModalState, modalId: string, colors: ThemeColors, t: typeof i18n.pt): string {
  // Get unique values for filters
  const types = [...new Set(state.devices.map(d => d.type).filter(Boolean))].sort() as string[];
  const deviceTypes = [...new Set(state.devices.map(d => d.serverAttrs?.deviceType).filter(Boolean))].sort() as string[];
  const deviceProfiles = [...new Set(state.devices.map(d => d.serverAttrs?.deviceProfile).filter(Boolean))].sort() as string[];

  const { field: sortField, order: sortOrder } = state.deviceSort;
  const { types: filterTypes, deviceTypes: filterDeviceTypes, deviceProfiles: filterDeviceProfiles } = state.deviceFilters;

  // Filter devices
  let filteredDevices = state.devices.filter(d => {
    if (filterTypes.length > 0 && !filterTypes.includes(d.type || '')) return false;
    if (filterDeviceTypes.length > 0 && !filterDeviceTypes.includes(d.serverAttrs?.deviceType || '')) return false;
    if (filterDeviceProfiles.length > 0 && !filterDeviceProfiles.includes(d.serverAttrs?.deviceProfile || '')) return false;
    return true;
  });

  // Sort devices
  const sortedDevices = sortDevices(filteredDevices, sortField, sortOrder);
  const sortIcon = sortOrder === 'asc' ? '↑' : '↓';

  // Grid height based on maximize state
  const gridHeight = state.isMaximized ? 'calc(100vh - 340px)' : '360px';

  const btnStyle = (isActive: boolean) => `
    background: ${isActive ? MYIO_PURPLE : colors.cardBg};
    color: ${isActive ? 'white' : colors.text};
    border: 1px solid ${isActive ? MYIO_PURPLE : colors.border};
    padding: 4px 8px; border-radius: 4px; cursor: pointer;
    font-size: 10px; font-weight: 500;
  `;

  const hasActiveFilters = filterTypes.length > 0 || filterDeviceTypes.length > 0 || filterDeviceProfiles.length > 0;

  return `
    <div style="
      padding: 12px; background: ${colors.cardBg}; border-radius: 8px;
      border: 1px solid ${colors.border}; margin-bottom: 12px;
    ">
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
        <div style="flex: 2; min-width: 160px;">
          <label style="color: ${colors.textMuted}; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            🔍 Buscar
          </label>
          <input type="text" id="${modalId}-device-search" placeholder="${t.searchDevices}" style="
            width: 100%; padding: 7px 10px; border: 1px solid ${colors.border};
            border-radius: 6px; font-size: 13px; color: ${colors.text};
            background: ${colors.inputBg}; box-sizing: border-box;
          "/>
        </div>
        <div style="min-width: 100px;">
          <label style="color: ${colors.textMuted}; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            Type ${filterTypes.length > 0 ? `(${filterTypes.length})` : ''}
          </label>
          <select id="${modalId}-device-type-filter" multiple size="1" style="
            width: 100%; padding: 7px 8px; border: 1px solid ${filterTypes.length > 0 ? MYIO_PURPLE : colors.border};
            border-radius: 6px; font-size: 11px; color: ${colors.text};
            background: ${colors.inputBg}; cursor: pointer; height: 32px;
          ">
            ${types.map(type => `<option value="${type}" ${filterTypes.includes(type) ? 'selected' : ''}>${type}</option>`).join('')}
          </select>
        </div>
        <div style="min-width: 100px;">
          <label style="color: ${colors.textMuted}; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            deviceType ${filterDeviceTypes.length > 0 ? `(${filterDeviceTypes.length})` : ''}
          </label>
          <select id="${modalId}-device-devicetype-filter" multiple size="1" style="
            width: 100%; padding: 7px 8px; border: 1px solid ${filterDeviceTypes.length > 0 ? MYIO_PURPLE : colors.border};
            border-radius: 6px; font-size: 11px; color: ${colors.text};
            background: ${colors.inputBg}; cursor: pointer; height: 32px;
          ">
            ${deviceTypes.map(dt => `<option value="${dt}" ${filterDeviceTypes.includes(dt) ? 'selected' : ''}>${dt}</option>`).join('')}
          </select>
        </div>
        <div style="min-width: 100px;">
          <label style="color: ${colors.textMuted}; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            deviceProfile ${filterDeviceProfiles.length > 0 ? `(${filterDeviceProfiles.length})` : ''}
          </label>
          <select id="${modalId}-device-profile-filter" multiple size="1" style="
            width: 100%; padding: 7px 8px; border: 1px solid ${filterDeviceProfiles.length > 0 ? MYIO_PURPLE : colors.border};
            border-radius: 6px; font-size: 11px; color: ${colors.text};
            background: ${colors.inputBg}; cursor: pointer; height: 32px;
          ">
            ${deviceProfiles.map(p => `<option value="${p}" ${filterDeviceProfiles.includes(p) ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        ${hasActiveFilters ? `
          <div style="display: flex; align-items: flex-end;">
            <button id="${modalId}-clear-filters" style="
              background: ${colors.danger}; color: white; border: none;
              padding: 7px 12px; border-radius: 6px; cursor: pointer;
              font-size: 11px; font-weight: 500;
            ">✕ Limpar</button>
          </div>
        ` : ''}
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 11px; color: ${colors.textMuted};">
            📍 <strong>${state.selectedCustomer?.name || state.selectedCustomer?.title}</strong>
            <span style="margin-left: 8px; color: ${colors.primary};">(${sortedDevices.length}/${state.devices.length})</span>
            ${!state.deviceAttrsLoaded ? `<span style="color: ${colors.warning}; margin-left: 6px;">⏳ attrs...</span>` : ''}
          </div>
          ${state.telemetryLoading ? `
            <span style="font-size: 10px; color: ${colors.warning}; padding: 3px 8px; background: ${colors.surface}; border-radius: 4px; border: 1px solid ${colors.border};">
              ⏳ Telemetria ${state.telemetryLoadedCount}/${sortedDevices.length}...
            </span>
          ` : state.deviceTelemetryLoaded ? `
            <span style="font-size: 10px; color: ${colors.success}; padding: 3px 8px;">
              ✅ Telemetria OK
            </span>
          ` : `
            <button id="${modalId}-load-telemetry" style="
              padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;
              background: ${colors.cardBg}; border: 1px solid ${colors.border}; color: ${colors.text};
              display: flex; align-items: center; gap: 4px;
            " ${!state.deviceAttrsLoaded ? 'disabled' : ''}>
              📡 Carregar Telemetria (${sortedDevices.length})
            </button>
          `}
          <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: ${colors.surface}; border-radius: 6px; border: 1px solid ${colors.border};">
            <span style="font-size: 10px; color: ${colors.textMuted};">Modo:</span>
            <button id="${modalId}-mode-single" style="
              padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; border: none;
              background: ${state.deviceSelectionMode === 'single' ? MYIO_PURPLE : 'transparent'};
              color: ${state.deviceSelectionMode === 'single' ? 'white' : colors.textMuted};
            ">Single</button>
            <button id="${modalId}-mode-multi" style="
              padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; border: none;
              background: ${state.deviceSelectionMode === 'multi' ? MYIO_PURPLE : 'transparent'};
              color: ${state.deviceSelectionMode === 'multi' ? 'white' : colors.textMuted};
            ">Multi</button>
          </div>
          ${state.deviceSelectionMode === 'multi' && state.selectedDevices.length > 0 ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; color: ${colors.success}; font-weight: 500;">
                ✓ ${state.selectedDevices.length} selecionados
              </span>
              <button id="${modalId}-select-all" style="
                padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;
                background: transparent; border: 1px solid ${colors.border}; color: ${colors.text};
              ">Todos</button>
              <button id="${modalId}-clear-selection" style="
                padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;
                background: transparent; border: 1px solid ${colors.border}; color: ${colors.textMuted};
              ">Limpar</button>
            </div>
          ` : ''}
          ${state.deviceSelectionMode === 'multi' && state.selectedDevices.length === 0 ? `
            <button id="${modalId}-select-all" style="
              padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;
              background: transparent; border: 1px solid ${colors.border}; color: ${colors.text};
            ">Selecionar Todos</button>
          ` : ''}
        </div>
        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
          <button id="${modalId}-sort-device-label" style="${btnStyle(sortField === 'label')}">
            Label ${sortField === 'label' ? sortIcon : ''}
          </button>
          <button id="${modalId}-sort-device-type" style="${btnStyle(sortField === 'type')}">
            Type ${sortField === 'type' ? sortIcon : ''}
          </button>
          <button id="${modalId}-sort-device-devicetype" style="${btnStyle(sortField === 'deviceType')}">
            devType ${sortField === 'deviceType' ? sortIcon : ''}
          </button>
          <button id="${modalId}-sort-device-profile" style="${btnStyle(sortField === 'deviceProfile')}">
            devProf ${sortField === 'deviceProfile' ? sortIcon : ''}
          </button>
        </div>
      </div>
    </div>

    <!-- Device Grid Header -->
    <div id="${modalId}-grid-header" style="
      display: flex; align-items: center; gap: 0; padding: 8px 12px;
      background: ${colors.cardBg}; border: 1px solid ${colors.border};
      border-bottom: none; border-radius: 8px 8px 0 0; font-size: 9px;
      font-weight: 600; color: ${colors.textMuted}; text-transform: uppercase;
    ">
      ${state.deviceSelectionMode === 'multi' ? `<div style="width: 28px; text-align: center;">☑</div>` : ''}
      <div style="width: 28px;"></div>
      <div data-col="label" class="myio-col-resize" style="width: ${state.columnWidths.label}px; padding: 0 6px; cursor: col-resize; border-right: 1px solid ${colors.border}; user-select: none;">Label</div>
      <div data-col="type" class="myio-col-resize" style="width: ${state.columnWidths.type}px; padding: 0 6px; text-align: center; cursor: col-resize; border-right: 1px solid ${colors.border}; user-select: none;">Type</div>
      <div data-col="deviceType" class="myio-col-resize" style="width: ${state.columnWidths.deviceType}px; padding: 0 6px; text-align: center; cursor: col-resize; border-right: 1px solid ${colors.border}; user-select: none;">devType</div>
      <div data-col="deviceProfile" class="myio-col-resize" style="width: ${state.columnWidths.deviceProfile}px; padding: 0 6px; text-align: center; cursor: col-resize; border-right: 1px solid ${colors.border}; user-select: none;">devProfile</div>
      <div data-col="telemetry" class="myio-col-resize" style="width: ${state.columnWidths.telemetry}px; padding: 0 6px; text-align: center; cursor: col-resize; border-right: 1px solid ${colors.border}; user-select: none;">Telemetria</div>
      <div data-col="status" class="myio-col-resize" style="width: ${state.columnWidths.status}px; padding: 0 6px; text-align: center; cursor: col-resize; border-right: 1px solid ${colors.border}; user-select: none;">Status</div>
      <div style="width: 24px;"></div>
    </div>

    <div style="
      max-height: ${gridHeight}; overflow-y: auto; border: 1px solid ${colors.border};
      border-radius: 0 0 8px 8px; background: ${colors.surface};
    " id="${modalId}-device-list">
      ${sortedDevices.length === 0
        ? `<div style="padding: 40px; text-align: center; color: ${colors.textMuted};">${t.noResults}</div>`
        : sortedDevices.map(device => renderDeviceRow(device, state, modalId, colors)).join('')
      }
    </div>
  `;
}

// Render a single device row
function renderDeviceRow(device: Device, state: ModalState, modalId: string, colors: ThemeColors): string {
  const deviceId = getEntityId(device);
  const isSelectedSingle = state.deviceSelectionMode === 'single' && getEntityId(state.selectedDevice) === deviceId;
  const isSelectedMulti = state.deviceSelectionMode === 'multi' && state.selectedDevices.some(d => getEntityId(d) === deviceId);
  const isSelected = isSelectedSingle || isSelectedMulti;

  const attrs = device.serverAttrs || {};
  const telemetry = device.latestTelemetry || {};

  // Connection status styling
  const statusColors: Record<string, { bg: string; text: string }> = {
    online: { bg: '#dcfce7', text: '#166534' },
    offline: { bg: '#fee2e2', text: '#991b1b' },
    waiting: { bg: '#fef3c7', text: '#92400e' },
    bad: { bg: '#fce7f3', text: '#9d174d' },
  };
  const connStatus = telemetry.connectionStatus?.value || 'offline';
  const statusStyle = statusColors[connStatus] || statusColors.offline;

  // Telemetry display - support hybrid devices with multiple telemetry types
  const telemetryItems: Array<{ label: string; value: string; unit: string; ts: string }> = [];

  if (telemetry.consumption) {
    telemetryItems.push({
      label: 'consumption',
      value: telemetry.consumption.value.toFixed(1),
      unit: 'W',
      ts: formatDate(telemetry.consumption.ts, state.locale, true),
    });
  }
  if (telemetry.pulses) {
    telemetryItems.push({
      label: 'pulses',
      value: String(telemetry.pulses.value),
      unit: 'L',
      ts: formatDate(telemetry.pulses.ts, state.locale, true),
    });
  }
  if (telemetry.temperature) {
    telemetryItems.push({
      label: 'temperature',
      value: telemetry.temperature.value.toFixed(1),
      unit: '°C',
      ts: formatDate(telemetry.temperature.ts, state.locale, true),
    });
  }

  const statusTs = telemetry.connectionStatus?.ts ? formatDate(telemetry.connectionStatus.ts, state.locale, true) : '';

  // Tooltip content for device info
  const tooltipContent = `Name: ${device.name}\\nID: ${deviceId}\\nType: ${device.type || 'N/A'}\\nCreated: ${formatDate(device.createdTime, state.locale, true)}`;

  return `
    <div class="myio-list-item ${isSelected ? 'selected' : ''}"
         data-device-id="${deviceId}" style="
      display: flex; align-items: center; gap: 0;
      padding: 6px 12px; border-bottom: 1px solid ${colors.border};
      cursor: pointer; transition: background 0.15s;
    ">
      ${state.deviceSelectionMode === 'multi' ? `
        <div style="width: 28px; flex-shrink: 0; text-align: center;">
          <input type="checkbox" class="myio-device-checkbox" data-device-id="${deviceId}"
            ${isSelectedMulti ? 'checked' : ''} style="
            width: 16px; height: 16px; cursor: pointer; accent-color: ${MYIO_PURPLE};
          " onclick="event.stopPropagation();" />
        </div>
      ` : ''}
      <div style="width: 28px; font-size: 16px; flex-shrink: 0;">${getDeviceIcon(device.type)}</div>
      <div style="width: ${state.columnWidths.label}px; padding: 0 6px; overflow: hidden; display: flex; align-items: center; gap: 4px;">
        <div style="font-weight: 500; color: ${colors.text}; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;" title="${device.label || device.name}">
          ${device.label || device.name}
        </div>
        <span class="myio-info-btn" data-device-info="${encodeURIComponent(tooltipContent)}" style="
          cursor: pointer; font-size: 12px; color: ${colors.textMuted}; flex-shrink: 0;
          width: 16px; height: 16px; border-radius: 50%; background: ${colors.cardBg};
          display: flex; align-items: center; justify-content: center; border: 1px solid ${colors.border};
        " title="Ver detalhes">ⓘ</span>
      </div>
      <div style="width: ${state.columnWidths.type}px; padding: 0 6px; text-align: center; flex-shrink: 0;">
        <div style="font-size: 9px; padding: 2px 4px; border-radius: 3px; display: inline-block;
          background: ${device.type?.includes('HIDRO') ? '#dbeafe' : '#fef3c7'};
          color: ${device.type?.includes('HIDRO') ? '#1e40af' : '#92400e'};">
          ${device.type || '—'}
        </div>
      </div>
      <div style="width: ${state.columnWidths.deviceType}px; padding: 0 6px; text-align: center; flex-shrink: 0; overflow: hidden;">
        <div style="font-size: 9px; color: ${attrs.deviceType ? colors.text : colors.textMuted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${attrs.deviceType || ''}">
          ${attrs.deviceType || '—'}
        </div>
      </div>
      <div style="width: ${state.columnWidths.deviceProfile}px; padding: 0 6px; text-align: center; flex-shrink: 0; overflow: hidden;">
        <div style="font-size: 9px; color: ${attrs.deviceProfile ? colors.text : colors.textMuted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${attrs.deviceProfile || ''}">
          ${attrs.deviceProfile || '—'}
        </div>
      </div>
      <div style="width: ${state.columnWidths.telemetry}px; padding: 0 6px; text-align: center; flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
        ${telemetryItems.length === 0 ? `<span style="font-size: 9px; color: ${colors.textMuted};">—</span>` : telemetryItems.map(item => `
          <span style="display: inline-flex; align-items: center; gap: 1px;">
            <span style="font-size: 9px; color: ${colors.text}; font-weight: 500;" title="${item.label}">${item.value}${item.unit}</span>
            <span class="myio-ts-btn" data-ts="${item.label}: ${item.value}${item.unit}\\n${item.ts}" style="
              cursor: pointer; font-size: 9px; color: ${colors.primary}; font-weight: 600;
            " title="${item.label}: ${item.ts}">(+)</span>
          </span>
        `).join('')}
      </div>
      <div style="width: ${state.columnWidths.status}px; padding: 0 6px; text-align: center; flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 2px;">
        <span style="font-size: 9px; padding: 2px 6px; border-radius: 3px; background: ${statusStyle.bg}; color: ${statusStyle.text};">
          ${connStatus}
        </span>
        ${statusTs ? `<span class="myio-ts-btn" data-ts="${statusTs}" style="
          cursor: pointer; font-size: 10px; color: ${colors.primary}; font-weight: 600;
        " title="${statusTs}">(+)</span>` : ''}
      </div>
      <div style="width: 24px; flex-shrink: 0; text-align: center;">
        ${isSelected ? `<span style="color: ${colors.success}; font-size: 14px;">✓</span>` : ''}
      </div>
    </div>
  `;
}

function getDeviceIcon(type?: string): string {
  const icons: Record<string, string> = {
    COMPRESSOR: '❄️',
    CHILLER: '🌡️',
    ELEVADOR: '🛗',
    ESCADA_ROLANTE: '📶',
    HIDROMETRO: '💧',
    CAIXA_DAGUA: '🪣',
    TANK: '🛢️',
    '3F_MEDIDOR': '⚡',
    ENTRADA: '🔌',
    FANCOIL: '🌀',
  };
  return icons[type || ''] || '📟';
}

// ============================================================================
// Step 3: Validation Map
// ============================================================================

function renderStep3(state: ModalState, modalId: string, colors: ThemeColors, t: typeof i18n.pt): string {
  if (!state.selectedDevice || !state.selectedCustomer) {
    return `<div style="padding: 40px; text-align: center; color: ${colors.textMuted};">No device selected</div>`;
  }

  const deviceId = getEntityId(state.selectedDevice);
  const customerId = getEntityId(state.selectedCustomer);
  const deviceCustomerId = state.selectedDevice.customerId?.id || '';

  const suggestedType = handleDeviceType(state.selectedDevice.name);
  const suggestedCentralName = `Central ${state.selectedCustomer.name || state.selectedCustomer.title} PADRAO`;
  const isOwnerValid = deviceCustomerId === customerId;
  const hasRelation = state.deviceRelation !== null;

  const attrs = state.deviceAttributes;

  return `
    <!-- Device Header Card -->
    <div style="
      padding: 16px; background: ${colors.cardBg}; border-radius: 8px;
      border: 1px solid ${colors.border}; margin-bottom: 16px;
      display: flex; align-items: center; gap: 16px;
    ">
      <div style="font-size: 40px;">${getDeviceIcon(state.selectedDevice.type)}</div>
      <div style="flex: 1;">
        <div style="font-weight: 600; font-size: 16px; color: ${colors.text};">${state.selectedDevice.name}</div>
        <div style="font-size: 12px; color: ${colors.textMuted};">
          ID: ${deviceId} • Cliente: ${state.selectedCustomer.name || state.selectedCustomer.title}
        </div>
      </div>
    </div>

    <!-- Server-Scope Attributes -->
    <div style="margin-bottom: 20px;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: ${colors.textMuted}; font-weight: 500;">
        📋 ${t.serverScopeAttrs}
      </h3>
      <div style="background: ${colors.cardBg}; border: 1px solid ${colors.border}; border-radius: 8px; overflow: hidden;">
        ${renderAttrRow('centralId', attrs.centralId, true, null, colors, modalId)}
        ${renderAttrRow('slaveId', attrs.slaveId, true, null, colors, modalId)}
        ${renderAttrRow('centralName', attrs.centralName, false, suggestedCentralName, colors, modalId, t)}
        ${renderDeviceTypeSelect(attrs.deviceType, suggestedType, colors, modalId, t)}
        ${renderDeviceProfileSelect(attrs.deviceType || suggestedType, attrs.deviceProfile, colors, modalId)}
        ${renderAttrRow('identifier', attrs.identifier, false, null, colors, modalId)}
        ${renderAttrRow('ingestionId', attrs.ingestionId, false, null, colors, modalId, t, true)}
      </div>
    </div>

    <!-- Relation TO -->
    <div style="margin-bottom: 20px;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: ${colors.textMuted}; font-weight: 500;">
        🔗 ${t.relationTo}
      </h3>
      <div style="
        padding: 16px; background: ${colors.cardBg}; border: 1px solid ${colors.border}; border-radius: 8px;
      ">
        ${hasRelation
          ? `<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px; color: ${colors.success};">✅</span>
                <span style="color: ${colors.text};">
                  <strong>${state.deviceRelation?.toEntityType}:</strong> ${state.deviceRelation?.toEntityName || state.deviceRelation?.toEntityId}
                </span>
              </div>
              <button id="${modalId}-delete-relation" style="
                background: ${colors.danger}; color: white; border: none;
                padding: 6px 12px; border-radius: 4px; cursor: pointer;
                font-size: 11px; display: flex; align-items: center; gap: 4px;
              ">🗑️ Remover</button>
            </div>`
          : `<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">⚠️</span>
                <span style="color: ${colors.warning};">${t.noRelation}</span>
              </div>
              <button id="${modalId}-add-relation" style="
                background: ${MYIO_PURPLE}; color: white; border: none;
                padding: 6px 12px; border-radius: 4px; cursor: pointer;
                font-size: 11px; display: flex; align-items: center; gap: 4px;
              ">➕ Adicionar</button>
            </div>`
        }

        <!-- Add Relation Form (hidden by default) -->
        <div id="${modalId}-add-relation-form" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid ${colors.border};">
          <div style="display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 100px;">
              <label style="color: ${colors.textMuted}; font-size: 10px; display: block; margin-bottom: 4px;">Tipo</label>
              <select id="${modalId}-relation-entity-type" style="
                width: 100%; padding: 6px 8px; border: 1px solid ${colors.border};
                border-radius: 4px; font-size: 12px; color: ${colors.text};
                background: ${colors.inputBg};
              ">
                <option value="ASSET">ASSET</option>
                <option value="CUSTOMER">CUSTOMER</option>
              </select>
            </div>
            <div style="flex: 2; min-width: 200px;">
              <label style="color: ${colors.textMuted}; font-size: 10px; display: block; margin-bottom: 4px;">ID da Entidade</label>
              <input type="text" id="${modalId}-relation-entity-id" placeholder="Ex: asset-id-123..." style="
                width: 100%; padding: 6px 8px; border: 1px solid ${colors.border};
                border-radius: 4px; font-size: 12px; color: ${colors.text};
                background: ${colors.inputBg}; box-sizing: border-box;
              "/>
            </div>
            <button id="${modalId}-save-relation" style="
              background: ${colors.success}; color: white; border: none;
              padding: 6px 12px; border-radius: 4px; cursor: pointer;
              font-size: 11px;
            ">Salvar</button>
            <button id="${modalId}-cancel-add-relation" style="
              background: ${colors.cardBg}; color: ${colors.text}; border: 1px solid ${colors.border};
              padding: 6px 12px; border-radius: 4px; cursor: pointer;
              font-size: 11px;
            ">Cancelar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Owner -->
    <div>
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: ${colors.textMuted}; font-weight: 500;">
        👤 ${t.owner}
      </h3>
      <div style="
        padding: 16px; background: ${colors.cardBg}; border: 1px solid ${colors.border}; border-radius: 8px;
      ">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px; color: ${isOwnerValid ? colors.success : colors.danger};">
              ${isOwnerValid ? '✅' : '❌'}
            </span>
            <span style="color: ${colors.text};">
              ${isOwnerValid
                ? `<strong>CUSTOMER:</strong> "${state.selectedCustomer.name || state.selectedCustomer.title}" (${t.validOwner})`
                : `<span style="color: ${colors.danger};"><strong>ERROR:</strong> ${t.invalidOwner} - Owner atual: ${deviceCustomerId}</span>`
              }
            </span>
          </div>
          <button id="${modalId}-change-owner" style="
            background: ${isOwnerValid ? colors.cardBg : MYIO_PURPLE};
            color: ${isOwnerValid ? colors.text : 'white'};
            border: 1px solid ${isOwnerValid ? colors.border : MYIO_PURPLE};
            padding: 6px 12px; border-radius: 4px; cursor: pointer;
            font-size: 11px; display: flex; align-items: center; gap: 4px;
          ">${isOwnerValid ? '✏️ Alterar' : '🔧 Corrigir'}</button>
        </div>

        <!-- Change Owner Form (hidden by default) -->
        <div id="${modalId}-change-owner-form" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid ${colors.border};">
          <div style="display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap;">
            <div style="flex: 2; min-width: 200px;">
              <label style="color: ${colors.textMuted}; font-size: 10px; display: block; margin-bottom: 4px;">Novo Customer ID</label>
              <input type="text" id="${modalId}-new-owner-id"
                     value="${customerId}"
                     placeholder="Customer ID..." style="
                width: 100%; padding: 6px 8px; border: 1px solid ${colors.border};
                border-radius: 4px; font-size: 12px; color: ${colors.text};
                background: ${colors.inputBg}; box-sizing: border-box;
              "/>
            </div>
            <button id="${modalId}-save-owner" style="
              background: ${colors.success}; color: white; border: none;
              padding: 6px 12px; border-radius: 4px; cursor: pointer;
              font-size: 11px;
            ">Salvar</button>
            <button id="${modalId}-cancel-change-owner" style="
              background: ${colors.cardBg}; color: ${colors.text}; border: 1px solid ${colors.border};
              padding: 6px 12px; border-radius: 4px; cursor: pointer;
              font-size: 11px;
            ">Cancelar</button>
          </div>
          <div style="margin-top: 8px; padding: 8px; background: #fef3c7; border-radius: 4px; font-size: 11px; color: #92400e;">
            ⚠️ Para corrigir o owner, use o ID do customer selecionado: <strong>${customerId}</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAttrRow(
  key: string,
  value: unknown,
  readonly: boolean,
  suggestion: string | null,
  colors: ThemeColors,
  modalId: string,
  t?: typeof i18n.pt,
  isFetchable = false
): string {
  const hasValue = value !== null && value !== undefined && value !== '';
  const icon = hasValue ? '✅' : '⚠️';
  const inputBorder = hasValue ? colors.border : colors.warning;

  return `
    <div style="
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-bottom: 1px solid ${colors.border};
    ">
      <span style="font-size: 16px;">${icon}</span>
      <span style="width: 110px; font-size: 13px; color: ${colors.textMuted}; font-weight: 500;">${key}</span>
      <div style="flex: 1;">
        <input type="text" id="${modalId}-${key}" value="${value || ''}"
               ${readonly ? 'disabled' : ''} placeholder="Enter ${key}..." style="
          width: 100%; padding: 8px 12px; border: 1px solid ${inputBorder};
          border-radius: 6px; font-size: 13px; color: ${colors.text};
          background: ${readonly ? colors.cardBg : colors.inputBg};
          box-sizing: border-box;
        "/>
      </div>
      <div style="width: 80px;">
        ${!hasValue && suggestion && t ? `
          <button data-suggest="${key}" data-value="${suggestion}" style="
            background: ${colors.cardBg}; color: ${colors.text}; border: 1px solid ${colors.border};
            padding: 6px 10px; border-radius: 4px; cursor: pointer;
            font-size: 11px; width: 100%;
          ">${t.suggest}</button>
        ` : ''}
        ${!hasValue && isFetchable && t ? `
          <button id="${modalId}-fetch-ingestion" style="
            background: ${colors.cardBg}; color: ${colors.text}; border: 1px solid ${colors.border};
            padding: 6px 10px; border-radius: 4px; cursor: pointer;
            font-size: 11px; width: 100%;
          ">${t.fetch}</button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderDeviceTypeSelect(
  value: unknown,
  suggested: string,
  colors: ThemeColors,
  modalId: string,
  t: typeof i18n.pt
): string {
  const hasValue = !!value;
  const icon = hasValue ? '✅' : '⚠️';
  const options = [
    '3F_MEDIDOR', 'HIDROMETRO', 'CHILLER', 'ELEVADOR', 'ESCADA_ROLANTE',
    'COMPRESSOR', 'FANCOIL', 'ENTRADA', 'CAIXA_DAGUA', 'TANK', 'MOTOR',
  ];

  return `
    <div style="
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-bottom: 1px solid ${colors.border};
    ">
      <span style="font-size: 16px;">${icon}</span>
      <span style="width: 110px; font-size: 13px; color: ${colors.textMuted}; font-weight: 500;">deviceType</span>
      <div style="flex: 1;">
        <select id="${modalId}-deviceType" style="
          width: 100%; padding: 8px 12px; border: 1px solid ${hasValue ? colors.border : colors.warning};
          border-radius: 6px; font-size: 13px; color: ${colors.text};
          background: ${colors.inputBg}; cursor: pointer;
        ">
          <option value="">Select type...</option>
          ${options.map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
      <div style="width: 80px;">
        ${!hasValue ? `
          <button data-suggest="deviceType" data-value="${suggested}" style="
            background: ${colors.cardBg}; color: ${colors.text}; border: 1px solid ${colors.border};
            padding: 6px 10px; border-radius: 4px; cursor: pointer;
            font-size: 11px; width: 100%;
          ">${t.suggest}</button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderDeviceProfileSelect(
  deviceType: string,
  value: unknown,
  colors: ThemeColors,
  modalId: string
): string {
  const hasValue = !!value;
  const icon = hasValue ? '✅' : '⚠️';
  const profiles = getSuggestedProfiles(deviceType as InferredDeviceType);

  return `
    <div style="
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-bottom: 1px solid ${colors.border};
    ">
      <span style="font-size: 16px;">${icon}</span>
      <span style="width: 110px; font-size: 13px; color: ${colors.textMuted}; font-weight: 500;">deviceProfile</span>
      <div style="flex: 1;">
        <select id="${modalId}-deviceProfile" style="
          width: 100%; padding: 8px 12px; border: 1px solid ${hasValue ? colors.border : colors.warning};
          border-radius: 6px; font-size: 13px; color: ${colors.text};
          background: ${colors.inputBg}; cursor: pointer;
        ">
          <option value="">Select profile...</option>
          ${profiles.map(p => `<option value="${p}" ${value === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div style="width: 80px;"></div>
    </div>
  `;
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners(
  container: HTMLElement,
  state: ModalState,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): void {
  // Close handlers
  const closeHandler = () => closeModal(container, onClose);

  container.querySelector('.myio-upsell-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeHandler();
  });

  document.getElementById(`${modalId}-close`)?.addEventListener('click', closeHandler);
  document.getElementById(`${modalId}-cancel`)?.addEventListener('click', closeHandler);

  // Theme toggle
  document.getElementById(`${modalId}-theme-toggle`)?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('myio-upsell-modal-theme', state.theme);
    renderModal(container, state, modalId, t);
  });

  // Maximize toggle
  document.getElementById(`${modalId}-maximize`)?.addEventListener('click', () => {
    state.isMaximized = !state.isMaximized;
    renderModal(container, state, modalId, t);
  });

  // Navigation buttons
  document.getElementById(`${modalId}-back`)?.addEventListener('click', () => {
    if (state.currentStep > 1) {
      state.currentStep--;
      renderModal(container, state, modalId, t);
    }
  });

  document.getElementById(`${modalId}-next`)?.addEventListener('click', async () => {
    if (state.currentStep === 1 && !state.selectedCustomer) {
      alert(t.selectCustomer);
      return;
    }
    if (state.currentStep === 2 && !state.selectedDevice) {
      alert(t.selectDevice);
      return;
    }

    state.currentStep++;

    if (state.currentStep === 2) {
      state.isLoading = true;
      renderModal(container, state, modalId, t);
      await loadDevices(state, container, modalId, t, onClose);
    } else if (state.currentStep === 3) {
      state.isLoading = true;
      renderModal(container, state, modalId, t);
      await loadValidationData(state, container, modalId, t, onClose);
    } else {
      renderModal(container, state, modalId, t);
    }
  });

  // Save button
  document.getElementById(`${modalId}-save`)?.addEventListener('click', async () => {
    await saveChanges(state, container, modalId, t, onClose);
  });

  // Customer selection
  container.querySelectorAll('[data-customer-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-customer-id');
      state.selectedCustomer = state.customers.find(c => c.id?.id === id) || null;
      state.selectedDevice = null;
      renderModal(container, state, modalId, t);
    });
  });

  // Customer search
  document.getElementById(`${modalId}-customer-search`)?.addEventListener('input', (e) => {
    const search = (e.target as HTMLInputElement).value.toLowerCase();
    filterCustomerList(container, state.customers, search, state.selectedCustomer, state.customerSort);
  });

  // Customer sort by name
  document.getElementById(`${modalId}-sort-name`)?.addEventListener('click', () => {
    if (state.customerSort.field === 'name') {
      state.customerSort.order = state.customerSort.order === 'asc' ? 'desc' : 'asc';
    } else {
      state.customerSort = { field: 'name', order: 'asc' };
    }
    renderModal(container, state, modalId, t);
  });

  // Customer sort by parent
  document.getElementById(`${modalId}-sort-parent`)?.addEventListener('click', () => {
    if (state.customerSort.field === 'parentName') {
      state.customerSort.order = state.customerSort.order === 'asc' ? 'desc' : 'asc';
    } else {
      state.customerSort = { field: 'parentName', order: 'asc' };
    }
    renderModal(container, state, modalId, t);
  });

  // Customer sort by date
  document.getElementById(`${modalId}-sort-date`)?.addEventListener('click', () => {
    if (state.customerSort.field === 'createdTime') {
      state.customerSort.order = state.customerSort.order === 'asc' ? 'desc' : 'asc';
    } else {
      state.customerSort = { field: 'createdTime', order: 'desc' };
    }
    renderModal(container, state, modalId, t);
  });

  // Device selection
  container.querySelectorAll('[data-device-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-device-id');
      state.selectedDevice = state.devices.find(d => d.id?.id === id) || null;
      renderModal(container, state, modalId, t);
    });
  });

  // Device search - just filter visually without re-rendering
  document.getElementById(`${modalId}-device-search`)?.addEventListener('input', (e) => {
    const search = (e.target as HTMLInputElement).value.toLowerCase();
    filterDeviceListVisual(container, state.devices, search, state.deviceFilters, state.deviceSort);
  });

  // Device type filter (multiselect) - device.type
  document.getElementById(`${modalId}-device-type-filter`)?.addEventListener('change', (e) => {
    const select = e.target as HTMLSelectElement;
    state.deviceFilters.types = Array.from(select.selectedOptions).map(o => o.value);
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Device deviceType filter (multiselect) - serverAttrs.deviceType
  document.getElementById(`${modalId}-device-devicetype-filter`)?.addEventListener('change', (e) => {
    const select = e.target as HTMLSelectElement;
    state.deviceFilters.deviceTypes = Array.from(select.selectedOptions).map(o => o.value);
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Device profile filter (multiselect) - serverAttrs.deviceProfile
  document.getElementById(`${modalId}-device-profile-filter`)?.addEventListener('change', (e) => {
    const select = e.target as HTMLSelectElement;
    state.deviceFilters.deviceProfiles = Array.from(select.selectedOptions).map(o => o.value);
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Clear filters button
  document.getElementById(`${modalId}-clear-filters`)?.addEventListener('click', () => {
    state.deviceFilters = { types: [], deviceTypes: [], deviceProfiles: [] };
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Device sort buttons
  const deviceSortFields: DeviceSortField[] = ['label', 'type', 'deviceType', 'deviceProfile'];
  const deviceSortBtnIds: Record<DeviceSortField, string> = {
    name: `${modalId}-sort-device-name`,
    label: `${modalId}-sort-device-label`,
    createdTime: `${modalId}-sort-device-date`,
    type: `${modalId}-sort-device-type`,
    deviceType: `${modalId}-sort-device-devicetype`,
    deviceProfile: `${modalId}-sort-device-profile`,
  };

  deviceSortFields.forEach(field => {
    document.getElementById(deviceSortBtnIds[field])?.addEventListener('click', () => {
      if (state.deviceSort.field === field) {
        state.deviceSort.order = state.deviceSort.order === 'asc' ? 'desc' : 'asc';
      } else {
        state.deviceSort = { field, order: field === 'createdTime' ? 'desc' : 'asc' };
      }
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    });
  });

  // Setup drag-resize for columns
  setupColumnResize(container, state, modalId, t, onClose);

  // Setup info tooltip buttons
  setupInfoTooltips(container, state);

  // Suggestion buttons
  container.querySelectorAll('[data-suggest]').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.getAttribute('data-suggest');
      const value = btn.getAttribute('data-value');
      const input = document.getElementById(`${modalId}-${field}`) as HTMLInputElement | HTMLSelectElement;
      if (input && value) {
        input.value = value;
        input.style.borderColor = '';
      }
    });
  });

  // Escape key
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeHandler();
  };
  document.addEventListener('keydown', escHandler);

  // ========================
  // Load Telemetry Button
  // ========================

  document.getElementById(`${modalId}-load-telemetry`)?.addEventListener('click', async () => {
    if (state.telemetryLoading) return;

    // Get filtered devices based on current filters
    const { types: filterTypes, deviceTypes: filterDeviceTypes, deviceProfiles: filterDeviceProfiles } = state.deviceFilters;
    const filteredDevices = state.devices.filter(d => {
      if (filterTypes.length > 0 && !filterTypes.includes(d.type || '')) return false;
      if (filterDeviceTypes.length > 0 && !filterDeviceTypes.includes(d.serverAttrs?.deviceType || '')) return false;
      if (filterDeviceProfiles.length > 0 && !filterDeviceProfiles.includes(d.serverAttrs?.deviceProfile || '')) return false;
      return true;
    });

    state.telemetryLoading = true;
    state.telemetryLoadedCount = 0;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);

    await loadDeviceTelemetryInBatch(state, container, modalId, t, onClose, filteredDevices);

    state.telemetryLoading = false;
    state.deviceTelemetryLoaded = true;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // ========================
  // Multiselect Mode Handlers
  // ========================

  // Mode toggle: Single
  document.getElementById(`${modalId}-mode-single`)?.addEventListener('click', () => {
    if (state.deviceSelectionMode !== 'single') {
      state.deviceSelectionMode = 'single';
      state.selectedDevices = [];
      renderModal(container, state, modalId, t);
    }
  });

  // Mode toggle: Multi
  document.getElementById(`${modalId}-mode-multi`)?.addEventListener('click', () => {
    if (state.deviceSelectionMode !== 'multi') {
      state.deviceSelectionMode = 'multi';
      state.selectedDevice = null;
      renderModal(container, state, modalId, t);
    }
  });

  // Select All button
  document.getElementById(`${modalId}-select-all`)?.addEventListener('click', () => {
    const { types: filterTypes, deviceTypes: filterDeviceTypes, deviceProfiles: filterDeviceProfiles } = state.deviceFilters;
    // Select all visible/filtered devices
    let filteredDevices = state.devices.filter(d => {
      if (filterTypes.length > 0 && !filterTypes.includes(d.type || '')) return false;
      if (filterDeviceTypes.length > 0 && !filterDeviceTypes.includes(d.serverAttrs?.deviceType || '')) return false;
      if (filterDeviceProfiles.length > 0 && !filterDeviceProfiles.includes(d.serverAttrs?.deviceProfile || '')) return false;
      return true;
    });
    state.selectedDevices = [...filteredDevices];
    renderModal(container, state, modalId, t);
  });

  // Clear Selection button
  document.getElementById(`${modalId}-clear-selection`)?.addEventListener('click', () => {
    state.selectedDevices = [];
    renderModal(container, state, modalId, t);
  });

  // Checkbox handlers for multi-select
  container.querySelectorAll('.myio-device-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const deviceId = (e.target as HTMLInputElement).getAttribute('data-device-id');
      const isChecked = (e.target as HTMLInputElement).checked;
      const device = state.devices.find(d => d.id?.id === deviceId);

      if (!device) return;

      if (isChecked) {
        // Add to selection if not already present
        if (!state.selectedDevices.some(d => d.id?.id === deviceId)) {
          state.selectedDevices.push(device);
        }
      } else {
        // Remove from selection
        state.selectedDevices = state.selectedDevices.filter(d => d.id?.id !== deviceId);
      }
      renderModal(container, state, modalId, t);
    });
  });

  // ========================
  // Bulk Attribute Modal Handlers
  // ========================

  // Open bulk attribute modal
  document.getElementById(`${modalId}-bulk-attr`)?.addEventListener('click', () => {
    state.bulkAttributeModal.open = true;
    renderModal(container, state, modalId, t);
  });

  // Close bulk attribute modal (X button)
  document.getElementById(`${modalId}-bulk-close`)?.addEventListener('click', () => {
    state.bulkAttributeModal.open = false;
    state.bulkAttributeModal.value = '';
    renderModal(container, state, modalId, t);
  });

  // Cancel bulk attribute modal
  document.getElementById(`${modalId}-bulk-cancel`)?.addEventListener('click', () => {
    state.bulkAttributeModal.open = false;
    state.bulkAttributeModal.value = '';
    renderModal(container, state, modalId, t);
  });

  // Attribute select change
  document.getElementById(`${modalId}-bulk-attr-select`)?.addEventListener('change', (e) => {
    state.bulkAttributeModal.attribute = (e.target as HTMLSelectElement).value;
  });

  // Value input change
  document.getElementById(`${modalId}-bulk-attr-value`)?.addEventListener('input', (e) => {
    state.bulkAttributeModal.value = (e.target as HTMLInputElement).value;
  });

  // Save bulk attributes
  document.getElementById(`${modalId}-bulk-save`)?.addEventListener('click', async () => {
    await saveBulkAttribute(state, container, modalId, t, onClose);
  });

  // ========================
  // Step 3: Owner & Relation Handlers
  // ========================

  // Change Owner - show form
  document.getElementById(`${modalId}-change-owner`)?.addEventListener('click', () => {
    const form = document.getElementById(`${modalId}-change-owner-form`);
    if (form) {
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
  });

  // Cancel Change Owner
  document.getElementById(`${modalId}-cancel-change-owner`)?.addEventListener('click', () => {
    const form = document.getElementById(`${modalId}-change-owner-form`);
    if (form) form.style.display = 'none';
  });

  // Save New Owner
  document.getElementById(`${modalId}-save-owner`)?.addEventListener('click', async () => {
    const newOwnerId = (document.getElementById(`${modalId}-new-owner-id`) as HTMLInputElement)?.value;
    if (!newOwnerId || !state.selectedDevice) {
      alert('ID do Customer é obrigatório');
      return;
    }
    try {
      await changeDeviceOwner(state, state.selectedDevice, newOwnerId);
      state.selectedDevice.customerId = { entityType: 'CUSTOMER', id: newOwnerId };
      alert('Owner alterado com sucesso!');
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    } catch (error) {
      alert('Erro ao alterar owner: ' + (error as Error).message);
    }
  });

  // Add Relation - show form
  document.getElementById(`${modalId}-add-relation`)?.addEventListener('click', () => {
    const form = document.getElementById(`${modalId}-add-relation-form`);
    if (form) form.style.display = 'block';
  });

  // Cancel Add Relation
  document.getElementById(`${modalId}-cancel-add-relation`)?.addEventListener('click', () => {
    const form = document.getElementById(`${modalId}-add-relation-form`);
    if (form) form.style.display = 'none';
  });

  // Save Relation
  document.getElementById(`${modalId}-save-relation`)?.addEventListener('click', async () => {
    const entityType = (document.getElementById(`${modalId}-relation-entity-type`) as HTMLSelectElement)?.value;
    const entityId = (document.getElementById(`${modalId}-relation-entity-id`) as HTMLInputElement)?.value;
    if (!entityId || !state.selectedDevice) {
      alert('ID da Entidade é obrigatório');
      return;
    }
    try {
      await createRelation(state, state.selectedDevice, entityType as 'ASSET' | 'CUSTOMER', entityId);
      state.deviceRelation = { toEntityType: entityType as 'ASSET' | 'CUSTOMER', toEntityId: entityId };
      alert('Relação criada com sucesso!');
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    } catch (error) {
      alert('Erro ao criar relação: ' + (error as Error).message);
    }
  });

  // Delete Relation
  document.getElementById(`${modalId}-delete-relation`)?.addEventListener('click', async () => {
    if (!state.selectedDevice || !state.deviceRelation) return;
    if (!confirm('Tem certeza que deseja remover esta relação?')) return;
    try {
      await deleteRelation(state, state.selectedDevice, state.deviceRelation);
      state.deviceRelation = null;
      alert('Relação removida com sucesso!');
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    } catch (error) {
      alert('Erro ao remover relação: ' + (error as Error).message);
    }
  });
}

// ============================================================================
// Column Resize
// ============================================================================

function setupColumnResize(
  container: HTMLElement,
  state: ModalState,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): void {
  const header = document.getElementById(`${modalId}-grid-header`);
  if (!header) return;

  const cols = header.querySelectorAll('.myio-col-resize');
  cols.forEach((col) => {
    const colName = (col as HTMLElement).dataset.col as keyof ColumnWidths;
    if (!colName) return;

    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(50, startWidth + diff);
      state.columnWidths[colName] = newWidth;

      // Update header column width
      (col as HTMLElement).style.width = newWidth + 'px';

      // Update all row cells for this column
      const rows = container.querySelectorAll(`[data-device-id]`);
      rows.forEach((row) => {
        const colIndex = Array.from(cols).indexOf(col);
        const cells = row.querySelectorAll('div');
        // Skip checkbox (if present) and icon column
        const offset = state.deviceSelectionMode === 'multi' ? 2 : 1;
        const cell = cells[colIndex + offset];
        if (cell) {
          (cell as HTMLElement).style.width = newWidth + 'px';
        }
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    col.addEventListener('mousedown', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      // Only start resize if clicking on the right edge (last 6px)
      const rect = (col as HTMLElement).getBoundingClientRect();
      if (mouseEvent.clientX > rect.right - 8) {
        e.preventDefault();
        startX = mouseEvent.clientX;
        startWidth = state.columnWidths[colName];
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }
    });
  });
}

// ============================================================================
// Info Tooltip (following InfoTooltip.ts pattern)
// ============================================================================

function setupInfoTooltips(container: HTMLElement, state: ModalState): void {
  const colors = getThemeColors(state.theme);

  container.querySelectorAll('.myio-info-btn').forEach((btn) => {
    btn.addEventListener('mouseenter', (e) => {
      e.stopPropagation();
      const infoStr = (btn as HTMLElement).dataset.deviceInfo;
      if (!infoStr) return;

      const info = decodeURIComponent(infoStr).replace(/\\n/g, '\n');
      showMiniTooltip(btn as HTMLElement, info, colors);
    });

    btn.addEventListener('mouseleave', () => {
      hideMiniTooltip();
    });
  });

  // Timestamp tooltips
  container.querySelectorAll('.myio-ts-btn').forEach((btn) => {
    btn.addEventListener('mouseenter', (e) => {
      e.stopPropagation();
      const ts = (btn as HTMLElement).dataset.ts;
      if (!ts) return;
      showMiniTooltip(btn as HTMLElement, ts, colors);
    });

    btn.addEventListener('mouseleave', () => {
      hideMiniTooltip();
    });
  });
}

let miniTooltipEl: HTMLElement | null = null;

function showMiniTooltip(trigger: HTMLElement, content: string, colors: ThemeColors): void {
  hideMiniTooltip();

  miniTooltipEl = document.createElement('div');
  miniTooltipEl.id = 'myio-upsell-mini-tooltip';
  miniTooltipEl.style.cssText = `
    position: fixed;
    z-index: 99999;
    background: ${colors.surface};
    border: 1px solid ${colors.border};
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 11px;
    color: ${colors.text};
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    white-space: pre-line;
    max-width: 280px;
    font-family: 'Roboto', Arial, sans-serif;
  `;
  miniTooltipEl.textContent = content;
  document.body.appendChild(miniTooltipEl);

  const rect = trigger.getBoundingClientRect();
  const tooltipRect = miniTooltipEl.getBoundingClientRect();

  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  let top = rect.bottom + 6;

  // Keep within viewport
  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  if (top + tooltipRect.height > window.innerHeight - 10) {
    top = rect.top - tooltipRect.height - 6;
  }

  miniTooltipEl.style.left = left + 'px';
  miniTooltipEl.style.top = top + 'px';
}

function hideMiniTooltip(): void {
  if (miniTooltipEl) {
    miniTooltipEl.remove();
    miniTooltipEl = null;
  }
}

// ============================================================================
// Customer/Device Filtering
// ============================================================================

function filterCustomerList(
  container: HTMLElement,
  customers: Customer[],
  search: string,
  selected: Customer | null,
  sort?: { field: CustomerSortField; order: SortOrder }
): void {
  const listContainer = container.querySelector('[id$="-customer-list"]');
  if (!listContainer) return;

  // Get sorted customers to match display order
  const sortedCustomers = sort ? sortCustomers(customers, sort.field, sort.order) : customers;

  const items = listContainer.querySelectorAll('[data-customer-id]');
  items.forEach(item => {
    const id = item.getAttribute('data-customer-id');
    const customer = sortedCustomers.find(c => c.id?.id === id);
    const customerName = customer?.name || customer?.title || '';
    const matches = customerName.toLowerCase().includes(search) ||
                    customer?.cnpj?.includes(search) ||
                    id?.includes(search);
    (item as HTMLElement).style.display = matches ? 'flex' : 'none';
  });
}

function filterDeviceListVisual(
  container: HTMLElement,
  devices: Device[],
  search: string,
  filters: { types: string[]; deviceTypes: string[]; deviceProfiles: string[] },
  sort: { field: DeviceSortField; order: SortOrder }
): void {
  const listContainer = container.querySelector('[id$="-device-list"]');
  if (!listContainer) return;

  // Filter and sort devices
  let filtered = devices.filter(d => {
    if (filters.types.length > 0 && !filters.types.includes(d.type || '')) return false;
    if (filters.deviceTypes.length > 0 && !filters.deviceTypes.includes(d.serverAttrs?.deviceType || '')) return false;
    if (filters.deviceProfiles.length > 0 && !filters.deviceProfiles.includes(d.serverAttrs?.deviceProfile || '')) return false;
    return true;
  });

  filtered = sortDevices(filtered, sort.field, sort.order);

  const items = listContainer.querySelectorAll('[data-device-id]');
  items.forEach(item => {
    const id = item.getAttribute('data-device-id');
    const device = filtered.find(d => d.id?.id === id);
    if (!device) {
      (item as HTMLElement).style.display = 'none';
      return;
    }
    const matchesSearch = !search ||
      device.name?.toLowerCase().includes(search) ||
      device.label?.toLowerCase().includes(search) ||
      device.type?.toLowerCase().includes(search) ||
      device.serverAttrs?.deviceType?.toLowerCase().includes(search) ||
      device.serverAttrs?.deviceProfile?.toLowerCase().includes(search);
    (item as HTMLElement).style.display = matchesSearch ? 'flex' : 'none';
  });
}

// ============================================================================
// API Functions
// ============================================================================

async function tbFetch<T>(state: ModalState, path: string): Promise<T> {
  const url = `${state.tbApiBase}${path}`;
  const res = await fetch(url, {
    headers: {
      'X-Authorization': `Bearer ${state.token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function tbPost<T>(state: ModalState, path: string, data: unknown): Promise<T> {
  const url = `${state.tbApiBase}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Authorization': `Bearer ${state.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function tbDelete(state: ModalState, path: string): Promise<void> {
  const url = `${state.tbApiBase}${path}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'X-Authorization': `Bearer ${state.token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
}

// Change device owner (assign to new customer)
async function changeDeviceOwner(state: ModalState, device: Device, newCustomerId: string): Promise<void> {
  const deviceId = getEntityId(device);
  // Use the assign device to customer endpoint
  await tbPost(state, `/api/customer/${newCustomerId}/device/${deviceId}`, {});
}

// Create relation from device TO entity
async function createRelation(
  state: ModalState,
  device: Device,
  toEntityType: 'ASSET' | 'CUSTOMER',
  toEntityId: string
): Promise<void> {
  const deviceId = getEntityId(device);
  const relation = {
    from: { entityType: 'DEVICE', id: deviceId },
    to: { entityType: toEntityType, id: toEntityId },
    type: 'Contains',
    typeGroup: 'COMMON',
  };
  await tbPost(state, '/api/relation', relation);
}

// Delete relation from device TO entity
async function deleteRelation(
  state: ModalState,
  device: Device,
  relation: DeviceRelation
): Promise<void> {
  const deviceId = getEntityId(device);
  const params = new URLSearchParams({
    fromId: deviceId,
    fromType: 'DEVICE',
    relationType: 'Contains',
    relationTypeGroup: 'COMMON',
    toId: relation.toEntityId,
    toType: relation.toEntityType,
  });
  await tbDelete(state, `/api/relation?${params.toString()}`);
}

async function loadCustomers(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  try {
    const response = await tbFetch<{ data: Customer[] }>(state, '/api/customers?pageSize=1000&page=0');
    state.customers = response.data || [];

    // Build customer name map for parent lookup
    state.customerNameMap.clear();
    state.customers.forEach(c => {
      const id = c.id?.id;
      const name = c.name || c.title || '';
      if (id && name) {
        state.customerNameMap.set(id, name);
      }
    });

    state.isLoading = false;
    renderModal(container, state, modalId, t);
  } catch (error) {
    console.error('[UpsellModal] Error loading customers:', error);
    state.isLoading = false;
    renderModal(container, state, modalId, t, error as Error);
  }
}

async function loadDevices(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  if (!state.selectedCustomer) return;

  try {
    const customerId = getEntityId(state.selectedCustomer);
    const response = await tbFetch<{ data: Device[] }>(
      state,
      `/api/customer/${customerId}/devices?pageSize=1000&page=0`
    );
    state.devices = response.data || [];
    state.deviceAttrsLoaded = false;
    state.deviceTelemetryLoaded = false;
    state.isLoading = false;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);

    // Start loading attrs in background (telemetry loaded on demand via button)
    loadDeviceAttrsInBatch(state, container, modalId, t, onClose);
  } catch (error) {
    console.error('[UpsellModal] Error loading devices:', error);
    state.isLoading = false;
    renderModal(container, state, modalId, t, error as Error);
  }
}

// Load server-scope attributes for all devices in batch
async function loadDeviceAttrsInBatch(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  if (state.devices.length === 0) return;

  const deviceIds = state.devices.map(d => getEntityId(d));
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 1500;

  try {
    for (let i = 0; i < deviceIds.length; i += BATCH_SIZE) {
      const batch = deviceIds.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (deviceId) => {
        try {
          const attrs = await tbFetch<Array<{ key: string; value: unknown }>>(
            state,
            `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`
          );
          return { deviceId, attrs };
        } catch {
          return { deviceId, attrs: [] };
        }
      });

      const results = await Promise.all(promises);

      results.forEach(({ deviceId, attrs }) => {
        const device = state.devices.find(d => getEntityId(d) === deviceId);
        if (device) {
          device.serverAttrs = {};
          attrs.forEach((a: { key: string; value: unknown }) => {
            if (device.serverAttrs) {
              (device.serverAttrs as Record<string, unknown>)[a.key] = a.value;
            }
          });
        }
      });

      // Re-render to show progress
      if (state.currentStep === 2) {
        renderModal(container, state, modalId, t);
        setupEventListeners(container, state, modalId, t, onClose);
      }

      // Delay before next batch (if not last batch)
      if (i + BATCH_SIZE < deviceIds.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    state.deviceAttrsLoaded = true;
    if (state.currentStep === 2) {
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    }
  } catch (error) {
    console.error('[UpsellModal] Error loading device attrs:', error);
  }
}

// Load latest telemetry for filtered devices in batch (on demand)
async function loadDeviceTelemetryInBatch(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void,
  filteredDevices?: Device[]
): Promise<void> {
  // Use filtered devices if provided, otherwise use all
  const devicesToLoad = filteredDevices || state.devices;
  if (devicesToLoad.length === 0) return;

  const deviceIds = devicesToLoad.map(d => getEntityId(d));
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 1500;
  const telemetryKeys = 'pulses,consumption,temperature,connectionStatus';

  try {
    for (let i = 0; i < deviceIds.length; i += BATCH_SIZE) {
      const batch = deviceIds.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (deviceId) => {
        try {
          const telemetry = await tbFetch<Record<string, Array<{ ts: number; value: string | number }>>>(
            state,
            `/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${telemetryKeys}`
          );
          return { deviceId, telemetry };
        } catch {
          return { deviceId, telemetry: {} };
        }
      });

      const results = await Promise.all(promises);

      results.forEach(({ deviceId, telemetry }) => {
        const device = state.devices.find(d => getEntityId(d) === deviceId);
        if (device) {
          device.latestTelemetry = {};
          if (telemetry.pulses?.[0]) {
            device.latestTelemetry.pulses = {
              value: Number(telemetry.pulses[0].value),
              ts: telemetry.pulses[0].ts,
            };
          }
          if (telemetry.consumption?.[0]) {
            device.latestTelemetry.consumption = {
              value: Number(telemetry.consumption[0].value),
              ts: telemetry.consumption[0].ts,
            };
          }
          if (telemetry.temperature?.[0]) {
            device.latestTelemetry.temperature = {
              value: Number(telemetry.temperature[0].value),
              ts: telemetry.temperature[0].ts,
            };
          }
          if (telemetry.connectionStatus?.[0]) {
            device.latestTelemetry.connectionStatus = {
              value: telemetry.connectionStatus[0].value as 'online' | 'offline' | 'waiting' | 'bad',
              ts: telemetry.connectionStatus[0].ts,
            };
          }
        }
      });

      // Update progress counter
      state.telemetryLoadedCount = Math.min(i + BATCH_SIZE, deviceIds.length);

      // Re-render to show progress
      if (state.currentStep === 2) {
        renderModal(container, state, modalId, t);
        setupEventListeners(container, state, modalId, t, onClose);
      }

      // Delay before next batch (if not last batch)
      if (i + BATCH_SIZE < deviceIds.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    state.deviceTelemetryLoaded = true;
    if (state.currentStep === 2) {
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    }
  } catch (error) {
    console.error('[UpsellModal] Error loading device telemetry:', error);
  }
}

async function loadValidationData(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  if (!state.selectedDevice) return;

  const deviceId = getEntityId(state.selectedDevice);

  try {
    // Fetch server-scope attributes
    const attrs = await tbFetch<Array<{ key: string; value: unknown }>>(
      state,
      `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`
    );

    state.deviceAttributes = {};
    attrs.forEach(a => {
      state.deviceAttributes[a.key as keyof DeviceAttributes] = a.value as string;
    });

    // Fetch relations
    const relations = await tbFetch<Array<{ to: { entityType: string; id: string } }>>(
      state,
      `/api/relations?fromId=${deviceId}&fromType=DEVICE&relationTypeGroup=COMMON&direction=TO`
    );

    if (relations.length > 0) {
      state.deviceRelation = {
        toEntityType: relations[0].to.entityType as 'ASSET' | 'CUSTOMER',
        toEntityId: relations[0].to.id,
      };
    } else {
      state.deviceRelation = null;
    }

    state.isLoading = false;
    renderModal(container, state, modalId, t);
  } catch (error) {
    console.error('[UpsellModal] Error loading validation data:', error);
    state.isLoading = false;
    renderModal(container, state, modalId, t, error as Error);
  }
}

async function saveChanges(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  if (!state.selectedDevice) return;

  const deviceId = getEntityId(state.selectedDevice);
  const attrs: Record<string, string> = {};

  // Collect values from inputs
  const fields = ['centralName', 'deviceType', 'deviceProfile', 'identifier', 'ingestionId'];
  fields.forEach(field => {
    const input = document.getElementById(`${modalId}-${field}`) as HTMLInputElement | HTMLSelectElement;
    if (input && input.value) {
      attrs[field] = input.value;
    }
  });

  try {
    await tbPost(state, `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`, attrs);
    alert(t.saved);
    closeModal(container, onClose);
  } catch (error) {
    console.error('[UpsellModal] Error saving:', error);
    alert(t.errorSaving);
  }
}

/**
 * Save a single attribute to multiple devices in bulk
 */
async function saveBulkAttribute(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  const { attribute, value } = state.bulkAttributeModal;
  const devices = state.selectedDevices;

  if (!attribute || !value) {
    alert('Por favor, preencha o atributo e o valor.');
    return;
  }

  if (devices.length === 0) {
    alert('Nenhum dispositivo selecionado.');
    return;
  }

  // Update modal state to show saving
  state.bulkAttributeModal.saving = true;
  renderModal(container, state, modalId, t);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Save attribute to each device
  for (const device of devices) {
    const deviceId = getEntityId(device);
    const attrs: Record<string, string> = { [attribute]: value };

    try {
      await tbPost(state, `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`, attrs);
      successCount++;
    } catch (error) {
      errorCount++;
      errors.push(`${device.name}: ${(error as Error).message}`);
      console.error(`[UpsellModal] Error saving to device ${device.name}:`, error);
    }
  }

  // Reset modal state
  state.bulkAttributeModal.saving = false;
  state.bulkAttributeModal.open = false;
  state.bulkAttributeModal.value = '';

  // Show result message
  if (errorCount === 0) {
    alert(`✅ Atributo "${attribute}" salvo com sucesso para ${successCount} dispositivos!`);
  } else {
    alert(
      `⚠️ Atributo salvo para ${successCount} dispositivos.\n` +
      `❌ Erro em ${errorCount} dispositivos:\n${errors.slice(0, 5).join('\n')}` +
      (errors.length > 5 ? `\n... e mais ${errors.length - 5} erros` : '')
    );
  }

  // Clear selection and re-render
  state.selectedDevices = [];
  renderModal(container, state, modalId, t);
}
