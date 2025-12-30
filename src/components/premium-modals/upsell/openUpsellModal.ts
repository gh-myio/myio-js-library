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

// ============================================================================
// Busy Modal (Progress Indicator)
// ============================================================================

const BUSY_MODAL_ID = 'myio-upsell-busy-modal';

interface BusyModalState {
  isVisible: boolean;
  message: string;
  current: number;
  total: number;
}

const busyState: BusyModalState = {
  isVisible: false,
  message: '',
  current: 0,
  total: 0,
};

function ensureBusyModalDOM(): HTMLElement {
  let modal = document.getElementById(BUSY_MODAL_ID);
  if (modal) return modal;

  const html = `
    <div id="${BUSY_MODAL_ID}" style="
      position: fixed; inset: 0; display: none;
      background: rgba(62, 26, 125, 0.45);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      z-index: 99999;
      align-items: center;
      justify-content: center;
      font-family: 'Roboto', Inter, system-ui, -apple-system, sans-serif;
    ">
      <div style="
        background: ${MYIO_PURPLE_DARK};
        color: #fff;
        border: 1px solid rgba(255,255,255,0.10);
        box-shadow: 0 12px 40px rgba(0,0,0,0.35);
        border-radius: 18px;
        padding: 24px 32px;
        min-width: 340px;
        max-width: 90%;
      ">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
          <div class="upsell-busy-spinner" style="
            width: 24px; height: 24px; border-radius: 50%;
            border: 3px solid rgba(255,255,255,0.25);
            border-top-color: #ffffff;
            animation: upsellBusySpin 0.9s linear infinite;
          "></div>
          <div id="${BUSY_MODAL_ID}-msg" style="
            font-weight: 600;
            font-size: 15px;
            letter-spacing: 0.2px;
          ">Aguarde...</div>
        </div>
        <div style="margin-bottom: 8px;">
          <div style="
            background: rgba(255,255,255,0.15);
            border-radius: 10px;
            height: 8px;
            overflow: hidden;
          ">
            <div id="${BUSY_MODAL_ID}-bar" style="
              background: linear-gradient(90deg, #a78bfa, #8b5cf6);
              height: 100%;
              width: 0%;
              border-radius: 10px;
              transition: width 0.3s ease;
            "></div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: rgba(255,255,255,0.7);">
          <span id="${BUSY_MODAL_ID}-count">0 / 0</span>
          <span id="${BUSY_MODAL_ID}-percent">0%</span>
        </div>
      </div>
    </div>
    <style>
      @keyframes upsellBusySpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper.firstElementChild!);
  document.body.appendChild(wrapper.lastElementChild!); // style tag

  return document.getElementById(BUSY_MODAL_ID)!;
}

function showBusyProgress(message: string, total: number): void {
  busyState.isVisible = true;
  busyState.message = message;
  busyState.current = 0;
  busyState.total = total;

  const modal = ensureBusyModalDOM();
  const msgEl = document.getElementById(`${BUSY_MODAL_ID}-msg`);
  const barEl = document.getElementById(`${BUSY_MODAL_ID}-bar`);
  const countEl = document.getElementById(`${BUSY_MODAL_ID}-count`);
  const percentEl = document.getElementById(`${BUSY_MODAL_ID}-percent`);

  if (msgEl) msgEl.textContent = message;
  if (barEl) barEl.style.width = '0%';
  if (countEl) countEl.textContent = `0 / ${total}`;
  if (percentEl) percentEl.textContent = '0%';

  modal.style.display = 'flex';
}

function updateBusyProgress(current: number, customMessage?: string): void {
  if (!busyState.isVisible) return;

  busyState.current = current;
  const percent = busyState.total > 0 ? Math.round((current / busyState.total) * 100) : 0;

  const msgEl = document.getElementById(`${BUSY_MODAL_ID}-msg`);
  const barEl = document.getElementById(`${BUSY_MODAL_ID}-bar`);
  const countEl = document.getElementById(`${BUSY_MODAL_ID}-count`);
  const percentEl = document.getElementById(`${BUSY_MODAL_ID}-percent`);

  if (customMessage && msgEl) msgEl.textContent = customMessage;
  if (barEl) barEl.style.width = `${percent}%`;
  if (countEl) countEl.textContent = `${current} / ${busyState.total}`;
  if (percentEl) percentEl.textContent = `${percent}%`;
}

function hideBusyProgress(): void {
  busyState.isVisible = false;
  const modal = document.getElementById(BUSY_MODAL_ID);
  if (modal) {
    modal.style.display = 'none';
  }
}

// Ingestion device cache
const ingestionCache = new Map<string, IngestionCache>();

// ============================================================================
// Ingestion API Auth & Device Fetching
// ============================================================================

const INGESTION_AUTH_URL = 'https://api.data.apps.myio-bas.com/api/v1/auth';
const INGESTION_API_BASE = 'https://api.data.apps.myio-bas.com/api/v1';
const INGESTION_CLIENT_ID = 'myioadmi_mekj7xw7_sccibe';
const INGESTION_CLIENT_SECRET = 'KmXhNZu0uydeWZ8scAi43h7P2pntGoWkdzNVMSjbVj3slEsZ5hGVXyayshgJAoqA';

// Token cache
let ingestionToken: string | null = null;
let ingestionTokenExpiresAt = 0;

async function getIngestionToken(): Promise<string> {
  const now = Date.now();
  // Return cached token if still valid (with 60s margin)
  if (ingestionToken && now < ingestionTokenExpiresAt - 60000) {
    return ingestionToken;
  }

  console.log('[UpsellModal] Requesting new ingestion token...');
  const res = await fetch(INGESTION_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: INGESTION_CLIENT_ID,
      client_secret: INGESTION_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ingestion auth failed: ${res.status} ${res.statusText} ${text}`);
  }

  const json = await res.json();
  if (!json?.access_token || !json?.expires_in) {
    throw new Error('Invalid ingestion auth response');
  }

  ingestionToken = json.access_token;
  ingestionTokenExpiresAt = now + Number(json.expires_in) * 1000;
  console.log('[UpsellModal] Ingestion token obtained, expires in ~', Math.round(json.expires_in / 60), 'min');

  return ingestionToken;
}

interface IngestionDeviceRecord {
  id: string;
  name?: string;
  deviceType?: string;
  slaveId?: number;
  gatewayId?: string; // This is the centralId in ThingsBoard
  gateway?: {
    id: string;
    name?: string;
    customerId?: string;
  };
  customerId?: string;
  isActive?: boolean;
}

interface IngestionPageResponse {
  data: IngestionDeviceRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

async function fetchIngestionDevicesPage(
  token: string,
  customerId: string,
  page: number,
  limit = 100
): Promise<IngestionPageResponse> {
  const url = `${INGESTION_API_BASE}/management/devices?page=${page}&limit=${limit}&customerId=${encodeURIComponent(customerId)}&includeInactive=false&sortBy=name&sortOrder=asc`;
  console.log(`[UpsellModal] Fetching ingestion devices page ${page}:`, url);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ingestion API error: ${res.status} ${res.statusText} ${text}`);
  }

  return res.json();
}

async function fetchIngestionDevicesAllPaged(customerId: string): Promise<IngestionDeviceRecord[]> {
  const token = await getIngestionToken();

  // Check cache first
  const cacheKey = `ingestion_${customerId}`;
  const cached = ingestionCache.get(cacheKey);
  if (cached && Date.now() < cached.timestamp + cached.ttl) {
    console.log(`[UpsellModal] Using cached ingestion devices for ${customerId} (${cached.devices.length} devices)`);
    return cached.devices as unknown as IngestionDeviceRecord[];
  }

  console.log(`[UpsellModal] Fetching all ingestion devices for customerId=${customerId}`);

  // Fetch first page to get total pages
  const firstPage = await fetchIngestionDevicesPage(token, customerId, 1, 100);
  const allDevices: IngestionDeviceRecord[] = [...(firstPage.data || [])];
  const totalPages = firstPage.pagination?.pages || 1;

  console.log(`[UpsellModal] Ingestion has ${totalPages} pages, ${firstPage.pagination?.total || 0} total devices`);

  // Fetch remaining pages
  for (let p = 2; p <= totalPages; p++) {
    const page = await fetchIngestionDevicesPage(token, customerId, p, 100);
    allDevices.push(...(page.data || []));
  }

  console.log(`[UpsellModal] Fetched ${allDevices.length} devices from ingestion`);

  // Cache for 5 minutes
  ingestionCache.set(cacheKey, {
    customerId,
    devices: allDevices as unknown as IngestionDevice[],
    timestamp: Date.now(),
    ttl: CACHE_TTL_MS,
  });

  return allDevices;
}

function findIngestionDeviceByCentralSlaveId(
  devices: IngestionDeviceRecord[],
  centralId: string,
  slaveId: string | number
): IngestionDeviceRecord | null {
  const slaveIdNum = typeof slaveId === 'string' ? parseInt(slaveId, 10) : slaveId;

  for (const device of devices) {
    // In ingestion API: gatewayId or gateway.id corresponds to ThingsBoard's centralId
    const deviceGatewayId = device.gatewayId || device.gateway?.id;
    if (deviceGatewayId === centralId && device.slaveId === slaveIdNum) {
      console.log('[UpsellModal] Found matching device:', device.name, 'gatewayId:', deviceGatewayId, 'slaveId:', device.slaveId);
      return device;
    }
  }

  console.log('[UpsellModal] No match found. Looking for centralId:', centralId, 'slaveId:', slaveIdNum);
  // Log first few devices to help debug
  devices.slice(0, 3).forEach((d, i) => {
    console.log(`[UpsellModal] Sample device ${i}:`, d.name, 'gatewayId:', d.gatewayId || d.gateway?.id, 'slaveId:', d.slaveId);
  });

  return null;
}

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
  createdTime: number;
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
  customerSearchTerm: string;
  deviceSort: { field: DeviceSortField; order: SortOrder };
  deviceSearchTerm: string;
  deviceFilters: { types: string[]; deviceTypes: string[]; deviceProfiles: string[]; statuses: string[] };
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
  attrsLoading: boolean;
  attrsLoadedCount: number;
  deviceTelemetryLoaded: boolean;
  telemetryLoading: boolean;
  telemetryLoadedCount: number;
  deviceRelations: DeviceRelation[];
  allRelations: Array<{ from: TbEntityId; to: TbEntityId; type: string }>;
  // Device profiles from ThingsBoard
  deviceProfiles: Array<{ id: string; name: string }>;
  // Assets for relation selector
  customerAssets: Array<{ id: string; name: string; type?: string }>;
  // Relation selector modal
  relationSelectorOpen: boolean;
  relationSelectorType: 'ASSET' | 'CUSTOMER';
  relationSelectorSearch: string;
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
    customerSearchTerm: '',
    deviceSort: { field: 'name', order: 'asc' },
    deviceSearchTerm: '',
    deviceFilters: { types: [], deviceTypes: [], deviceProfiles: [], statuses: [] },
    deviceSelectionMode: 'single',
    selectedDevices: [],
    bulkAttributeModal: { open: false, attribute: 'deviceType', value: '', saving: false },
    columnWidths: { label: 280, type: 180, createdTime: 100, deviceType: 80, deviceProfile: 90, telemetry: 100, status: 70 },
    deviceAttrsLoaded: false,
    attrsLoading: false,
    attrsLoadedCount: 0,
    deviceTelemetryLoaded: false,
    telemetryLoading: false,
    telemetryLoadedCount: 0,
    deviceRelations: [],
    allRelations: [],
    deviceProfiles: [],
    customerAssets: [],
    relationSelectorOpen: false,
    relationSelectorType: 'ASSET',
    relationSelectorSearch: '',
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
          <input type="text" id="${modalId}-customer-search" placeholder="${t.searchCustomers}" value="${state.customerSearchTerm}" style="
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
  const statuses = ['online', 'offline', 'waiting', 'bad'];

  const { field: sortField, order: sortOrder } = state.deviceSort;
  const { types: filterTypes, deviceTypes: filterDeviceTypes, deviceProfiles: filterDeviceProfiles, statuses: filterStatuses } = state.deviceFilters;
  const searchTerm = state.deviceSearchTerm.toLowerCase();

  // Filter devices by dropdown filters
  let filteredDevices = state.devices.filter(d => {
    if (filterTypes.length > 0 && !filterTypes.includes(d.type || '')) return false;
    if (filterDeviceTypes.length > 0 && !filterDeviceTypes.includes(d.serverAttrs?.deviceType || '')) return false;
    if (filterDeviceProfiles.length > 0 && !filterDeviceProfiles.includes(d.serverAttrs?.deviceProfile || '')) return false;
    if (filterStatuses.length > 0) {
      const status = d.latestTelemetry?.connectionStatus?.value || 'offline';
      if (!filterStatuses.includes(status)) return false;
    }
    return true;
  });

  // Apply search term filter for display count
  const searchFilteredDevices = searchTerm ? filteredDevices.filter(d => {
    const name = (d.name || '').toLowerCase();
    const label = (d.label || '').toLowerCase();
    const type = (d.type || '').toLowerCase();
    const deviceType = (d.serverAttrs?.deviceType || '').toLowerCase();
    const deviceProfile = (d.serverAttrs?.deviceProfile || '').toLowerCase();
    return name.includes(searchTerm) || label.includes(searchTerm) || type.includes(searchTerm) ||
           deviceType.includes(searchTerm) || deviceProfile.includes(searchTerm);
  }) : filteredDevices;

  // Sort devices
  const sortedDevices = sortDevices(filteredDevices, sortField, sortOrder);

  // Grid height based on maximize state
  const gridHeight = state.isMaximized ? 'calc(100vh - 340px)' : '360px';

  const hasActiveFilters = filterTypes.length > 0 || filterDeviceTypes.length > 0 || filterDeviceProfiles.length > 0 || filterStatuses.length > 0;

  // Helper for sortable column header
  const renderSortableHeader = (col: string, label: string, field: DeviceSortField, width: number) => {
    const isActive = sortField === field;
    const arrow = isActive ? (sortOrder === 'asc' ? '▲' : '▼') : '▽';
    return `
      <div id="${modalId}-sort-col-${col}" data-sort-field="${field}" style="
        width: ${width}px; padding: 0 6px; display: flex; align-items: center; justify-content: space-between;
        border-right: 1px solid ${colors.border}; cursor: pointer; user-select: none;
        ${isActive ? `background: rgba(62,26,125,0.1);` : ''}
      ">
        <span>${label}</span>
        <span style="font-size: 8px; color: ${isActive ? MYIO_PURPLE : colors.textMuted};">${arrow}</span>
      </div>
    `;
  };

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
          <input type="text" id="${modalId}-device-search" placeholder="${t.searchDevices}" value="${state.deviceSearchTerm}" style="
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
          <label style="color: ${state.deviceAttrsLoaded ? colors.textMuted : colors.warning}; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            deviceType ${filterDeviceTypes.length > 0 ? `(${filterDeviceTypes.length})` : ''} ${!state.deviceAttrsLoaded ? '🔒' : ''}
          </label>
          <select id="${modalId}-device-devicetype-filter" multiple size="1" style="
            width: 100%; padding: 7px 8px; border: 1px solid ${filterDeviceTypes.length > 0 ? MYIO_PURPLE : colors.border};
            border-radius: 6px; font-size: 11px; color: ${colors.text};
            background: ${colors.inputBg}; cursor: ${state.deviceAttrsLoaded ? 'pointer' : 'not-allowed'}; height: 32px;
            opacity: ${state.deviceAttrsLoaded ? '1' : '0.5'};
          " ${!state.deviceAttrsLoaded ? 'disabled' : ''}>
            ${deviceTypes.map(dt => `<option value="${dt}" ${filterDeviceTypes.includes(dt) ? 'selected' : ''}>${dt}</option>`).join('')}
          </select>
        </div>
        <div style="min-width: 100px;">
          <label style="color: ${state.deviceAttrsLoaded ? colors.textMuted : colors.warning}; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            deviceProfile ${filterDeviceProfiles.length > 0 ? `(${filterDeviceProfiles.length})` : ''} ${!state.deviceAttrsLoaded ? '🔒' : ''}
          </label>
          <select id="${modalId}-device-profile-filter" multiple size="1" style="
            width: 100%; padding: 7px 8px; border: 1px solid ${filterDeviceProfiles.length > 0 ? MYIO_PURPLE : colors.border};
            border-radius: 6px; font-size: 11px; color: ${colors.text};
            background: ${colors.inputBg}; cursor: ${state.deviceAttrsLoaded ? 'pointer' : 'not-allowed'}; height: 32px;
            opacity: ${state.deviceAttrsLoaded ? '1' : '0.5'};
          " ${!state.deviceAttrsLoaded ? 'disabled' : ''}>
            ${deviceProfiles.map(p => `<option value="${p}" ${filterDeviceProfiles.includes(p) ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div style="min-width: 100px;">
          <label style="color: ${state.deviceTelemetryLoaded ? colors.textMuted : colors.warning}; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            Status ${filterStatuses.length > 0 ? `(${filterStatuses.length})` : ''} ${!state.deviceTelemetryLoaded ? '🔒' : ''}
          </label>
          <select id="${modalId}-device-status-filter" multiple size="1" style="
            width: 100%; padding: 7px 8px; border: 1px solid ${filterStatuses.length > 0 ? MYIO_PURPLE : colors.border};
            border-radius: 6px; font-size: 11px; color: ${colors.text};
            background: ${colors.inputBg}; cursor: ${state.deviceTelemetryLoaded ? 'pointer' : 'not-allowed'}; height: 32px;
            opacity: ${state.deviceTelemetryLoaded ? '1' : '0.5'};
          " ${!state.deviceTelemetryLoaded ? 'disabled' : ''}>
            ${statuses.map(s => `<option value="${s}" ${filterStatuses.includes(s) ? 'selected' : ''}>${s}</option>`).join('')}
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
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="font-size: 11px; color: ${colors.textMuted};">
            📍 <strong>${state.selectedCustomer?.name || state.selectedCustomer?.title}</strong>
            <span style="margin-left: 8px; color: ${colors.primary};">(${sortedDevices.length}/${state.devices.length})</span>
          </div>
          ${state.attrsLoading ? `
            <span style="font-size: 10px; color: ${colors.warning}; padding: 3px 8px; background: ${colors.surface}; border-radius: 4px; border: 1px solid ${colors.border};">
              ⏳ Atributos ${state.attrsLoadedCount}/${state.devices.length}...
            </span>
          ` : state.deviceAttrsLoaded ? `
            <span style="font-size: 10px; color: ${colors.success}; padding: 3px 8px;">
              ✅ Atributos OK
            </span>
          ` : `
            <button id="${modalId}-load-attrs" style="
              padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;
              background: ${colors.cardBg}; border: 1px solid ${colors.border}; color: ${colors.text};
              display: flex; align-items: center; gap: 4px;
            ">
              🏷️ Carregar Atributos (${searchFilteredDevices.length})
            </button>
          `}
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
            ">
              📡 Carregar Telemetria (${searchFilteredDevices.length})
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
      </div>
    </div>

    <!-- Device Grid Header with Sortable Columns -->
    <div id="${modalId}-grid-header" style="
      display: flex; align-items: center; gap: 0; padding: 8px 12px;
      background: ${colors.cardBg}; border: 1px solid ${colors.border};
      border-bottom: none; border-radius: 8px 8px 0 0; font-size: 9px;
      font-weight: 600; color: ${colors.textMuted}; text-transform: uppercase;
    ">
      ${state.deviceSelectionMode === 'multi' ? `<div style="width: 28px; text-align: center;">☑</div>` : ''}
      <div style="width: 28px;"></div>
      ${renderSortableHeader('label', 'Label', 'label', state.columnWidths.label)}
      ${renderSortableHeader('type', 'Type', 'type', state.columnWidths.type)}
      ${renderSortableHeader('createdTime', 'Criado', 'createdTime', state.columnWidths.createdTime)}
      <div style="width: ${state.columnWidths.deviceType}px; padding: 0 6px; text-align: center; border-right: 1px solid ${colors.border};">
        devType ${!state.deviceAttrsLoaded ? '🔒' : ''}
      </div>
      <div style="width: ${state.columnWidths.deviceProfile}px; padding: 0 6px; text-align: center; border-right: 1px solid ${colors.border};">
        devProfile ${!state.deviceAttrsLoaded ? '🔒' : ''}
      </div>
      <div style="width: ${state.columnWidths.telemetry}px; padding: 0 6px; text-align: center; border-right: 1px solid ${colors.border};">
        Telemetria ${!state.deviceTelemetryLoaded ? '🔒' : ''}
      </div>
      <div style="width: ${state.columnWidths.status}px; padding: 0 6px; text-align: center; border-right: 1px solid ${colors.border};">
        Status ${!state.deviceTelemetryLoaded ? '🔒' : ''}
      </div>
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

  // Not loaded styling (gray)
  const notLoadedStyle = { bg: '#f3f4f6', text: '#9ca3af' };

  // Only show status if telemetry is loaded
  const connStatus = state.deviceTelemetryLoaded ? (telemetry.connectionStatus?.value || 'offline') : null;
  const statusStyle = connStatus ? (statusColors[connStatus] || statusColors.offline) : notLoadedStyle;

  // Telemetry display - filter by device type to avoid showing irrelevant telemetry
  const telemetryItems: Array<{ label: string; value: string; unit: string; ts: string }> = [];

  // Determine expected telemetry based on device type or name
  const deviceType = (device.type || '').toLowerCase();
  const deviceName = (device.name || device.label || '').toLowerCase();
  const attrDeviceType = (attrs.deviceType || '').toUpperCase();

  // Water devices: HIDROMETRO, CAIXA_DAGUA, TANK, or name contains 'hidr', 'agua', 'water'
  const isWaterDevice = ['HIDROMETRO', 'CAIXA_DAGUA', 'TANK'].includes(attrDeviceType) ||
    deviceName.includes('hidr') || deviceName.includes('agua') || deviceName.includes('water') ||
    deviceType.includes('water');

  // Energy devices: 3F_MEDIDOR, ENTRADA, MOTOR, CHILLER, FANCOIL, COMPRESSOR, ESCADA_ROLANTE, ELEVADOR
  const isEnergyDevice = ['3F_MEDIDOR', 'ENTRADA', 'MOTOR', 'CHILLER', 'FANCOIL', 'COMPRESSOR', 'ESCADA_ROLANTE', 'ELEVADOR'].includes(attrDeviceType) ||
    deviceType.includes('energy') || deviceType.includes('meter');

  // Temperature devices: name or type contains 'temp', 'sensor'
  const isTemperatureDevice = deviceName.includes('temp') || deviceType.includes('temp') ||
    deviceName.includes('sensor') && !isWaterDevice && !isEnergyDevice;

  if (state.deviceTelemetryLoaded) {
    // Only show telemetry that makes sense for the device type
    // Energy: show consumption
    if (telemetry.consumption && telemetry.consumption.ts && telemetry.consumption.value != null) {
      if (isEnergyDevice || (!isWaterDevice && !isTemperatureDevice)) {
        telemetryItems.push({
          label: 'consumption',
          value: telemetry.consumption.value.toFixed(1),
          unit: 'W',
          ts: formatDate(telemetry.consumption.ts, state.locale, true),
        });
      }
    }

    // Water: show pulses
    if (telemetry.pulses && telemetry.pulses.ts && telemetry.pulses.value != null) {
      if (isWaterDevice || (!isEnergyDevice && !isTemperatureDevice)) {
        telemetryItems.push({
          label: 'pulses',
          value: String(telemetry.pulses.value),
          unit: 'L',
          ts: formatDate(telemetry.pulses.ts, state.locale, true),
        });
      }
    }

    // Temperature: only show if device is a temperature sensor or has temp in name
    if (telemetry.temperature && telemetry.temperature.ts && telemetry.temperature.value != null) {
      if (isTemperatureDevice || (!isWaterDevice && !isEnergyDevice)) {
        // Additional check: don't show 0.0 temperature for water/energy devices
        const tempValue = telemetry.temperature.value;
        const isReasonableTemp = tempValue !== 0 || isTemperatureDevice;
        if (isReasonableTemp) {
          telemetryItems.push({
            label: 'temperature',
            value: tempValue.toFixed(1),
            unit: '°C',
            ts: formatDate(telemetry.temperature.ts, state.locale, true),
          });
        }
      }
    }
  }

  const statusTs = telemetry.connectionStatus?.ts ? formatDate(telemetry.connectionStatus.ts, state.locale, true) : '';

  // Tooltip content for device info
  const tooltipContent = `Name: ${device.name}\\nID: ${deviceId}\\nType: ${device.type || 'N/A'}\\nCreated: ${formatDate(device.createdTime, state.locale, true)}`;

  // Format createdTime
  const createdTimeStr = device.createdTime ? formatDate(device.createdTime, state.locale) : '—';

  // Render deviceType/deviceProfile based on attrs loaded state
  const renderDeviceTypeValue = () => {
    if (!state.deviceAttrsLoaded) {
      return `<span style="font-size: 8px; color: ${colors.textMuted}; font-style: italic;">—</span>`;
    }
    return attrs.deviceType
      ? `<span style="font-size: 9px; color: ${colors.text};" title="${attrs.deviceType}">${attrs.deviceType}</span>`
      : `<span style="font-size: 9px; color: ${colors.textMuted};">—</span>`;
  };

  const renderDeviceProfileValue = () => {
    if (!state.deviceAttrsLoaded) {
      return `<span style="font-size: 8px; color: ${colors.textMuted}; font-style: italic;">—</span>`;
    }
    return attrs.deviceProfile
      ? `<span style="font-size: 9px; color: ${colors.text};" title="${attrs.deviceProfile}">${attrs.deviceProfile}</span>`
      : `<span style="font-size: 9px; color: ${colors.textMuted};">—</span>`;
  };

  // Render telemetry based on loaded state
  const renderTelemetryValue = () => {
    if (!state.deviceTelemetryLoaded) {
      return `<span style="font-size: 8px; color: ${colors.textMuted}; font-style: italic;">—</span>`;
    }
    if (telemetryItems.length === 0) {
      return `<span style="font-size: 9px; color: ${colors.textMuted};">—</span>`;
    }
    return telemetryItems.map(item => `
      <span style="display: inline-flex; align-items: center; gap: 1px;">
        <span style="font-size: 9px; color: ${colors.text}; font-weight: 500;" title="${item.label}">${item.value}${item.unit}</span>
        <span class="myio-ts-btn" data-ts="${item.label}: ${item.value}${item.unit}\\n${item.ts}" style="
          cursor: pointer; font-size: 9px; color: ${colors.primary}; font-weight: 600;
        " title="${item.label}: ${item.ts}">(+)</span>
      </span>
    `).join('');
  };

  // Render status based on loaded state
  const renderStatusValue = () => {
    if (!state.deviceTelemetryLoaded) {
      return `<span style="font-size: 8px; padding: 2px 6px; border-radius: 3px; background: ${notLoadedStyle.bg}; color: ${notLoadedStyle.text}; font-style: italic;">—</span>`;
    }
    return `
      <span style="font-size: 9px; padding: 2px 6px; border-radius: 3px; background: ${statusStyle.bg}; color: ${statusStyle.text};">
        ${connStatus}
      </span>
      ${statusTs ? `<span class="myio-ts-btn" data-ts="${statusTs}" style="
        cursor: pointer; font-size: 10px; color: ${colors.primary}; font-weight: 600;
      " title="${statusTs}">(+)</span>` : ''}
    `;
  };

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
      <div style="width: ${state.columnWidths.type}px; padding: 0 6px; text-align: center; flex-shrink: 0; overflow: hidden;">
        <div style="font-size: 9px; padding: 2px 4px; border-radius: 3px; display: inline-block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
          background: ${device.type?.includes('HIDRO') ? '#dbeafe' : '#fef3c7'};
          color: ${device.type?.includes('HIDRO') ? '#1e40af' : '#92400e'};" title="${device.type || ''}">
          ${device.type || '—'}
        </div>
      </div>
      <div style="width: ${state.columnWidths.createdTime}px; padding: 0 6px; text-align: center; flex-shrink: 0;">
        <span style="font-size: 9px; color: ${colors.textMuted};">${createdTimeStr}</span>
      </div>
      <div style="width: ${state.columnWidths.deviceType}px; padding: 0 6px; text-align: center; flex-shrink: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
        ${renderDeviceTypeValue()}
      </div>
      <div style="width: ${state.columnWidths.deviceProfile}px; padding: 0 6px; text-align: center; flex-shrink: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
        ${renderDeviceProfileValue()}
      </div>
      <div style="width: ${state.columnWidths.telemetry}px; padding: 0 6px; text-align: center; flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
        ${renderTelemetryValue()}
      </div>
      <div style="width: ${state.columnWidths.status}px; padding: 0 6px; text-align: center; flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 2px;">
        ${renderStatusValue()}
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
          <div style="display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap;">
            <div style="min-width: 100px;">
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
            <div style="flex: 1; min-width: 200px;">
              <label style="color: ${colors.textMuted}; font-size: 10px; display: block; margin-bottom: 4px;">🔍 Buscar</label>
              <input type="text" id="${modalId}-relation-search" placeholder="Buscar por nome..." style="
                width: 100%; padding: 6px 8px; border: 1px solid ${colors.border};
                border-radius: 4px; font-size: 12px; color: ${colors.text};
                background: ${colors.inputBg}; box-sizing: border-box;
              " value="${state.relationSelectorSearch}"/>
            </div>
            <div style="display: flex; gap: 4px; align-items: flex-end; padding-top: 16px;">
              <button id="${modalId}-load-relation-entities" style="
                background: ${MYIO_PURPLE}; color: white; border: none;
                padding: 6px 12px; border-radius: 4px; cursor: pointer;
                font-size: 11px;
              ">Carregar</button>
              <button id="${modalId}-cancel-add-relation" style="
                background: ${colors.cardBg}; color: ${colors.text}; border: 1px solid ${colors.border};
                padding: 6px 12px; border-radius: 4px; cursor: pointer;
                font-size: 11px;
              ">Cancelar</button>
            </div>
          </div>

          <!-- Entity List -->
          <div id="${modalId}-relation-entity-list" style="
            margin-top: 10px; max-height: 200px; overflow-y: auto;
            border: 1px solid ${colors.border}; border-radius: 4px;
            display: ${state.customerAssets.length > 0 || state.relationSelectorType === 'CUSTOMER' ? 'block' : 'none'};
          ">
            ${state.relationSelectorType === 'ASSET' ?
              state.customerAssets
                .filter(a => !state.relationSelectorSearch || a.name.toLowerCase().includes(state.relationSelectorSearch.toLowerCase()))
                .map(asset => `
                  <div class="relation-entity-item" data-entity-type="ASSET" data-entity-id="${asset.id}" data-entity-name="${asset.name}" style="
                    padding: 8px 12px; cursor: pointer; border-bottom: 1px solid ${colors.border};
                    display: flex; justify-content: space-between; align-items: center;
                  ">
                    <span style="color: ${colors.text}; font-size: 12px;">📦 ${asset.name}</span>
                    <span style="color: ${colors.textMuted}; font-size: 10px;">${asset.type || ''}</span>
                  </div>
                `).join('') || `<div style="padding: 12px; color: ${colors.textMuted}; text-align: center; font-size: 11px;">Nenhum asset encontrado</div>`
            :
              state.customers
                .filter(c => !state.relationSelectorSearch || (c.name || c.title || '').toLowerCase().includes(state.relationSelectorSearch.toLowerCase()))
                .slice(0, 50)
                .map(customer => `
                  <div class="relation-entity-item" data-entity-type="CUSTOMER" data-entity-id="${getEntityId(customer)}" data-entity-name="${customer.name || customer.title}" style="
                    padding: 8px 12px; cursor: pointer; border-bottom: 1px solid ${colors.border};
                    display: flex; justify-content: space-between; align-items: center;
                  ">
                    <span style="color: ${colors.text}; font-size: 12px;">👤 ${customer.name || customer.title}</span>
                  </div>
                `).join('') || `<div style="padding: 12px; color: ${colors.textMuted}; text-align: center; font-size: 11px;">Nenhum customer encontrado</div>`
            }
          </div>

          <!-- Selected Entity Display -->
          <input type="hidden" id="${modalId}-relation-entity-id" value=""/>
          <div id="${modalId}-relation-selected" style="display: none; margin-top: 10px; padding: 10px; background: ${colors.success}20; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span id="${modalId}-relation-selected-name" style="color: ${colors.text}; font-size: 12px;"></span>
              <button id="${modalId}-save-relation" style="
                background: ${colors.success}; color: white; border: none;
                padding: 6px 12px; border-radius: 4px; cursor: pointer;
                font-size: 11px;
              ">✓ Salvar Relação</button>
            </div>
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
    state.customerSearchTerm = (e.target as HTMLInputElement).value; // Preserve original case
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
    state.deviceSearchTerm = (e.target as HTMLInputElement).value; // Preserve original case
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

  // Status filter (only works when telemetry is loaded)
  (document.getElementById(`${modalId}-device-status-filter`) as HTMLSelectElement | null)?.addEventListener('change', (e) => {
    const select = e.target as HTMLSelectElement;
    state.deviceFilters.statuses = Array.from(select.selectedOptions).map(o => o.value);
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Clear filters button
  document.getElementById(`${modalId}-clear-filters`)?.addEventListener('click', () => {
    state.deviceFilters = { types: [], deviceTypes: [], deviceProfiles: [], statuses: [] };
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Sortable column headers - click to sort
  const sortableColumns: Array<{ col: string; field: DeviceSortField }> = [
    { col: 'label', field: 'label' },
    { col: 'type', field: 'type' },
    { col: 'createdTime', field: 'createdTime' },
  ];

  sortableColumns.forEach(({ col, field }) => {
    document.getElementById(`${modalId}-sort-col-${col}`)?.addEventListener('click', () => {
      if (state.deviceSort.field === field) {
        state.deviceSort.order = state.deviceSort.order === 'asc' ? 'desc' : 'asc';
      } else {
        state.deviceSort = { field, order: field === 'createdTime' ? 'desc' : 'asc' };
      }
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    });
  });

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
  // Load Attributes Button
  // ========================

  document.getElementById(`${modalId}-load-attrs`)?.addEventListener('click', async () => {
    if (state.attrsLoading) return;

    // Get filtered devices based on current filters and search term
    const { types: filterTypes } = state.deviceFilters;
    const searchTerm = state.deviceSearchTerm.toLowerCase();
    const filteredDevices = state.devices.filter(d => {
      // Apply type filter
      if (filterTypes.length > 0 && !filterTypes.includes(d.type || '')) return false;
      // Apply search filter
      if (searchTerm) {
        const name = (d.name || '').toLowerCase();
        const label = (d.label || '').toLowerCase();
        const type = (d.type || '').toLowerCase();
        if (!name.includes(searchTerm) && !label.includes(searchTerm) && !type.includes(searchTerm)) {
          return false;
        }
      }
      return true;
    });

    state.attrsLoading = true;
    state.attrsLoadedCount = 0;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);

    await loadDeviceAttrsInBatch(state, container, modalId, t, onClose, filteredDevices);

    state.attrsLoading = false;
    state.deviceAttrsLoaded = true;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // ========================
  // Load Telemetry Button
  // ========================

  document.getElementById(`${modalId}-load-telemetry`)?.addEventListener('click', async () => {
    if (state.telemetryLoading) return;

    // Get filtered devices based on current filters and search term
    const { types: filterTypes, deviceTypes: filterDeviceTypes, deviceProfiles: filterDeviceProfiles } = state.deviceFilters;
    const searchTerm = state.deviceSearchTerm.toLowerCase();
    const filteredDevices = state.devices.filter(d => {
      if (filterTypes.length > 0 && !filterTypes.includes(d.type || '')) return false;
      if (filterDeviceTypes.length > 0 && !filterDeviceTypes.includes(d.serverAttrs?.deviceType || '')) return false;
      if (filterDeviceProfiles.length > 0 && !filterDeviceProfiles.includes(d.serverAttrs?.deviceProfile || '')) return false;
      // Apply search filter
      if (searchTerm) {
        const name = (d.name || '').toLowerCase();
        const label = (d.label || '').toLowerCase();
        const type = (d.type || '').toLowerCase();
        const deviceType = (d.serverAttrs?.deviceType || '').toLowerCase();
        const deviceProfile = (d.serverAttrs?.deviceProfile || '').toLowerCase();
        if (!name.includes(searchTerm) && !label.includes(searchTerm) && !type.includes(searchTerm) &&
            !deviceType.includes(searchTerm) && !deviceProfile.includes(searchTerm)) {
          return false;
        }
      }
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
    state.customerAssets = [];
    state.relationSelectorSearch = '';
  });

  // Load Relation Entities (Assets or Customers)
  document.getElementById(`${modalId}-load-relation-entities`)?.addEventListener('click', async () => {
    const entityType = (document.getElementById(`${modalId}-relation-entity-type`) as HTMLSelectElement)?.value as 'ASSET' | 'CUSTOMER';
    state.relationSelectorType = entityType;

    if (entityType === 'ASSET' && state.selectedCustomer) {
      const customerId = getEntityId(state.selectedCustomer);
      console.log('[UpsellModal] Loading assets for customer:', customerId);
      state.customerAssets = await fetchCustomerAssets(state, customerId);
    }
    // Customers are already loaded in state.customers

    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);

    // Show the form again
    const form = document.getElementById(`${modalId}-add-relation-form`);
    if (form) form.style.display = 'block';
  });

  // Relation Type Change
  document.getElementById(`${modalId}-relation-entity-type`)?.addEventListener('change', (e) => {
    state.relationSelectorType = (e.target as HTMLSelectElement).value as 'ASSET' | 'CUSTOMER';
    state.relationSelectorSearch = '';
    // Clear selection
    const selectedDiv = document.getElementById(`${modalId}-relation-selected`);
    if (selectedDiv) selectedDiv.style.display = 'none';
    const hiddenInput = document.getElementById(`${modalId}-relation-entity-id`) as HTMLInputElement;
    if (hiddenInput) hiddenInput.value = '';
  });

  // Relation Search Input
  document.getElementById(`${modalId}-relation-search`)?.addEventListener('input', (e) => {
    state.relationSelectorSearch = (e.target as HTMLInputElement).value;
    // Re-render just the list
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
    // Show the form again
    const form = document.getElementById(`${modalId}-add-relation-form`);
    if (form) form.style.display = 'block';
  });

  // Click on Entity Items
  document.querySelectorAll('.relation-entity-item').forEach(item => {
    item.addEventListener('click', () => {
      const entityType = item.getAttribute('data-entity-type');
      const entityId = item.getAttribute('data-entity-id');
      const entityName = item.getAttribute('data-entity-name');

      // Set the hidden input
      const hiddenInput = document.getElementById(`${modalId}-relation-entity-id`) as HTMLInputElement;
      if (hiddenInput) hiddenInput.value = entityId || '';

      // Show selected entity
      const selectedDiv = document.getElementById(`${modalId}-relation-selected`);
      const selectedName = document.getElementById(`${modalId}-relation-selected-name`);
      if (selectedDiv && selectedName) {
        selectedDiv.style.display = 'block';
        selectedName.textContent = `✓ ${entityType}: ${entityName}`;
      }

      // Highlight selected item
      document.querySelectorAll('.relation-entity-item').forEach(i => {
        (i as HTMLElement).style.background = '';
      });
      (item as HTMLElement).style.background = `${MYIO_PURPLE}20`;
    });
  });

  // Save Relation
  document.getElementById(`${modalId}-save-relation`)?.addEventListener('click', async () => {
    const entityType = (document.getElementById(`${modalId}-relation-entity-type`) as HTMLSelectElement)?.value;
    const entityId = (document.getElementById(`${modalId}-relation-entity-id`) as HTMLInputElement)?.value;
    if (!entityId || !state.selectedDevice) {
      alert('Selecione uma entidade da lista');
      return;
    }
    try {
      await createRelation(state, state.selectedDevice, entityType as 'ASSET' | 'CUSTOMER', entityId);
      state.deviceRelation = { toEntityType: entityType as 'ASSET' | 'CUSTOMER', toEntityId: entityId };
      state.customerAssets = [];
      state.relationSelectorSearch = '';
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

  // Fetch Ingestion ID
  document.getElementById(`${modalId}-fetch-ingestion`)?.addEventListener('click', async () => {
    if (!state.selectedDevice || !state.selectedCustomer) return;

    const attrs = state.deviceAttributes;
    const centralId = attrs.centralId;
    const slaveId = attrs.slaveId;

    if (!centralId || !slaveId) {
      alert('centralId e slaveId são necessários para buscar o ingestionId');
      return;
    }

    console.log('[UpsellModal] Fetching ingestionId for centralId:', centralId, 'slaveId:', slaveId);

    try {
      // Step 1: Get customer's ingestionId attribute (this is the customerId for ingestion API)
      const customerId = getEntityId(state.selectedCustomer);
      console.log('[UpsellModal] Fetching customer attributes for customerId:', customerId);

      const customerAttrs = await tbFetch<Array<{ key: string; value: unknown }>>(
        state,
        `/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE`
      );
      console.log('[UpsellModal] Customer attributes:', customerAttrs);

      const ingestionCustomerIdAttr = customerAttrs.find(a => a.key === 'ingestionId');
      const ingestionCustomerId = ingestionCustomerIdAttr?.value as string;

      if (!ingestionCustomerId) {
        alert('Customer não tem atributo ingestionId configurado. Configure primeiro no ThingsBoard.');
        return;
      }

      console.log('[UpsellModal] Customer ingestionId (for ingestion API):', ingestionCustomerId);

      // Step 2: Fetch all devices from ingestion API (cached for 5 min)
      const ingestionDevices = await fetchIngestionDevicesAllPaged(ingestionCustomerId);
      console.log('[UpsellModal] Fetched', ingestionDevices.length, 'devices from ingestion');

      // Step 3: Find matching device by centralId + slaveId
      const matchingDevice = findIngestionDeviceByCentralSlaveId(ingestionDevices, centralId, slaveId);

      if (matchingDevice) {
        const input = document.getElementById(`${modalId}-ingestionId`) as HTMLInputElement;
        if (input) {
          input.value = matchingDevice.id;
          input.style.borderColor = '#4caf50';
        }
        console.log('[UpsellModal] Found matching ingestion device:', matchingDevice);
        alert(`IngestionId encontrado: ${matchingDevice.id}\nDevice: ${matchingDevice.name || 'N/A'}\nTipo: ${matchingDevice.deviceType || 'N/A'}`);
      } else {
        console.log('[UpsellModal] No matching device found for centralId:', centralId, 'slaveId:', slaveId);
        alert(`Nenhum device encontrado na API de ingestion com:\ncentralId=${centralId}\nslaveId=${slaveId}\n\nTotal de devices no customer: ${ingestionDevices.length}`);
      }
    } catch (error) {
      console.error('[UpsellModal] Error fetching ingestionId:', error);
      alert('Erro ao buscar ingestionId: ' + (error as Error).message);
    }
  });

  // Apply search filters after render (to preserve filter state)
  if (state.customerSearchTerm && state.currentStep === 1) {
    filterCustomerList(container, state.customers, state.customerSearchTerm.toLowerCase(), state.selectedCustomer, state.customerSort);
  }
  if (state.deviceSearchTerm && state.currentStep === 2) {
    filterDeviceListVisual(container, state.devices, state.deviceSearchTerm.toLowerCase(), state.deviceFilters, state.deviceSort);
  }
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
  console.log('[UpsellModal] POST', path, data);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Authorization': `Bearer ${state.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    console.error('[UpsellModal] POST error:', res.status, res.statusText, errorText);
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  // Handle empty responses (some endpoints return 200 with no body)
  const text = await res.text();
  if (!text) {
    console.log('[UpsellModal] POST success (empty response)');
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    console.log('[UpsellModal] POST success (non-JSON response):', text);
    return {} as T;
  }
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

// Create relation: Entity (ASSET/CUSTOMER) -> DEVICE (entity "Contains" device)
async function createRelation(
  state: ModalState,
  device: Device,
  fromEntityType: 'ASSET' | 'CUSTOMER',
  fromEntityId: string
): Promise<void> {
  const deviceId = getEntityId(device);
  // ASSET/CUSTOMER is the FROM (container), DEVICE is the TO (contained)
  const relation = {
    from: { entityType: fromEntityType, id: fromEntityId },
    to: { entityType: 'DEVICE', id: deviceId },
    type: 'Contains',
    typeGroup: 'COMMON',
  };
  console.log('[UpsellModal] Creating relation:', relation);
  await tbPost(state, '/api/relation', relation);
}

// Delete relation: Entity (FROM) -> DEVICE (TO)
async function deleteRelation(
  state: ModalState,
  device: Device,
  relation: DeviceRelation
): Promise<void> {
  const deviceId = getEntityId(device);
  // relation stores the FROM entity info (what contains this device)
  const params = new URLSearchParams({
    fromId: relation.toEntityId,
    fromType: relation.toEntityType,
    toId: deviceId,
    toType: 'DEVICE',
    relationType: relation.relationType || 'Contains',
    relationTypeGroup: relation.relationTypeGroup || 'COMMON',
  });
  console.log('[UpsellModal] Deleting relation:', params.toString());
  await tbDelete(state, `/api/relation?${params.toString()}`);
}

// Fetch device profiles from ThingsBoard
async function fetchDeviceProfiles(state: ModalState): Promise<Array<{ id: string; name: string }>> {
  try {
    const profiles = await tbFetch<Array<{ id: { id: string }; name: string }>>(
      state,
      '/api/deviceProfile/names?activeOnly=true'
    );
    console.log('[UpsellModal] Fetched device profiles:', profiles.length);
    return profiles.map(p => ({ id: p.id.id, name: p.name }));
  } catch (error) {
    console.error('[UpsellModal] Error fetching device profiles:', error);
    return [];
  }
}

// Fetch assets for a customer
async function fetchCustomerAssets(
  state: ModalState,
  customerId: string
): Promise<Array<{ id: string; name: string; type?: string }>> {
  try {
    const response = await tbFetch<{ data: Array<{ id: { id: string }; name: string; type?: string }> }>(
      state,
      `/api/customer/${customerId}/assets?pageSize=1000&page=0`
    );
    const assets = response.data || [];
    console.log('[UpsellModal] Fetched customer assets:', assets.length);
    return assets.map(a => ({ id: a.id.id, name: a.name, type: a.type }));
  } catch (error) {
    console.error('[UpsellModal] Error fetching customer assets:', error);
    return [];
  }
}

// Change device profile (entity level)
async function changeDeviceProfile(
  state: ModalState,
  device: Device,
  newProfileId: string
): Promise<void> {
  const deviceId = getEntityId(device);
  // Get the current device data
  const deviceData = await tbFetch<{
    id: { id: string; entityType: string };
    name: string;
    type: string;
    label?: string;
    deviceProfileId: { id: string; entityType: string };
    customerId?: { id: string; entityType: string };
  }>(state, `/api/device/${deviceId}`);

  // Update with new profile
  const updatedDevice = {
    ...deviceData,
    deviceProfileId: { id: newProfileId, entityType: 'DEVICE_PROFILE' },
  };

  console.log('[UpsellModal] Changing device profile to:', newProfileId);
  await tbPost(state, '/api/device', updatedDevice);
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
    state.attrsLoading = false;
    state.attrsLoadedCount = 0;
    state.deviceTelemetryLoaded = false;
    state.telemetryLoading = false;
    state.telemetryLoadedCount = 0;
    state.isLoading = false;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
    // Attrs and telemetry are now loaded on demand via buttons
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
  onClose?: () => void,
  filteredDevices?: Device[]
): Promise<void> {
  // Use filtered devices if provided, otherwise use all
  const devicesToLoad = filteredDevices || state.devices;
  if (devicesToLoad.length === 0) return;

  const deviceIds = devicesToLoad.map(d => getEntityId(d));
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 1500;

  // Show progress modal
  showBusyProgress('Carregando atributos dos dispositivos...', deviceIds.length);

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

      // Update progress counter and modal
      const processed = Math.min(i + BATCH_SIZE, deviceIds.length);
      state.attrsLoadedCount = processed;
      updateBusyProgress(processed);

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
    state.attrsLoading = false;
    hideBusyProgress();

    if (state.currentStep === 2) {
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    }
  } catch (error) {
    console.error('[UpsellModal] Error loading device attrs:', error);
    state.attrsLoading = false;
    hideBusyProgress();
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

  // Show progress modal
  showBusyProgress('Carregando telemetria dos dispositivos...', deviceIds.length);

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

      // Update progress modal
      updateBusyProgress(state.telemetryLoadedCount);

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
    hideBusyProgress();

    if (state.currentStep === 2) {
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    }
  } catch (error) {
    console.error('[UpsellModal] Error loading device telemetry:', error);
    state.telemetryLoading = false;
    hideBusyProgress();
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

    // Fetch relations - find entities that contain this device (FROM -> DEVICE)
    // Query: what entities have this device as the TO (i.e., what contains this device)
    interface RelationResponse {
      from: { entityType: string; id: string };
      to: { entityType: string; id: string };
      type: string;
      typeGroup: string;
    }
    const relations = await tbFetch<RelationResponse[]>(
      state,
      `/api/relations?toId=${deviceId}&toType=DEVICE&relationTypeGroup=COMMON`
    );
    console.log('[UpsellModal] Device relations:', relations);

    if (relations.length > 0) {
      // The FROM entity is what contains the device
      const rel = relations[0];
      state.deviceRelation = {
        toEntityType: rel.from.entityType as 'ASSET' | 'CUSTOMER' | 'DEVICE',
        toEntityId: rel.from.id,
        relationType: rel.type || 'Contains',
        relationTypeGroup: rel.typeGroup || 'COMMON',
      };
      console.log('[UpsellModal] Device is contained by:', state.deviceRelation);
    } else {
      state.deviceRelation = null;
      console.log('[UpsellModal] Device has no container relation');
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

  // Show progress modal
  showBusyProgress(`Salvando atributo "${attribute}"...`, devices.length);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Save attribute to each device
  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
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

    // Update progress modal
    updateBusyProgress(i + 1);
  }

  // Hide progress modal
  hideBusyProgress();

  // Reset modal state
  state.bulkAttributeModal.saving = false;
  state.bulkAttributeModal.open = false;
  state.bulkAttributeModal.value = '';

  // Show result message
  if (errorCount === 0) {
    alert(`Atributo "${attribute}" salvo com sucesso para ${successCount} dispositivos!`);
  } else {
    alert(
      `Atributo salvo para ${successCount} dispositivos.\n` +
      `Erro em ${errorCount} dispositivos:\n${errors.slice(0, 5).join('\n')}` +
      (errors.length > 5 ? `\n... e mais ${errors.length - 5} erros` : '')
    );
  }

  // Clear selection and re-render
  state.selectedDevices = [];
  renderModal(container, state, modalId, t);
}
