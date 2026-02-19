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
  console.log(
    '[UpsellModal] Ingestion token obtained, expires in ~',
    Math.round(json.expires_in / 60),
    'min'
  );

  return ingestionToken;
}

interface IngestionGateway {
  id: string;
  name?: string;
  customerId?: string;
  isOnline?: boolean;
  lastSeen?: string;
  isRegistered?: boolean;
  lastEnergyFetchTimestamp?: string | null;
  lastWaterFetchTimestamp?: string | null;
  lastTemperatureFetchTimestamp?: string | null;
  isPaused?: boolean;
  isDeleted?: boolean;
  originalId?: string | null;
  fetchIntervalMs?: number;
  energyFetchIntervalMs?: number;
  waterFetchIntervalMs?: number;
  temperatureFetchIntervalMs?: number;
  assetId?: string | null;
  hardwareUuid?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface IngestionCustomer {
  id: string;
  name?: string;
  description?: string;
  parentId?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface IngestionDeviceRecord {
  id: string;
  name?: string;
  deviceType?: string;
  slaveId?: number;
  gatewayId?: string; // This is the centralId in ThingsBoard
  gateway?: IngestionGateway;
  customerId?: string;
  customer?: IngestionCustomer;
  assetId?: string | null;
  asset?: unknown | null;
  profileId?: string;
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
  const url = `${INGESTION_API_BASE}/management/devices?page=${page}&limit=${limit}&customerId=${encodeURIComponent(
    customerId
  )}&includeInactive=false&sortBy=name&sortOrder=asc`;
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
    console.log(
      `[UpsellModal] Using cached ingestion devices for ${customerId} (${cached.devices.length} devices)`
    );
    return cached.devices as unknown as IngestionDeviceRecord[];
  }

  console.log(`[UpsellModal] Fetching all ingestion devices for customerId=${customerId}`);

  // Fetch first page to get total pages
  const firstPage = await fetchIngestionDevicesPage(token, customerId, 1, 100);
  const allDevices: IngestionDeviceRecord[] = [...(firstPage.data || [])];
  const totalPages = firstPage.pagination?.pages || 1;

  console.log(
    `[UpsellModal] Ingestion has ${totalPages} pages, ${firstPage.pagination?.total || 0} total devices`
  );

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
      console.log(
        '[UpsellModal] Found matching device:',
        device.name,
        'gatewayId:',
        deviceGatewayId,
        'slaveId:',
        device.slaveId
      );
      return device;
    }
  }

  console.log('[UpsellModal] No match found. Looking for centralId:', centralId, 'slaveId:', slaveIdNum);
  // Log first few devices to help debug
  devices.slice(0, 3).forEach((d, i) => {
    console.log(
      `[UpsellModal] Sample device ${i}:`,
      d.name,
      'gatewayId:',
      d.gatewayId || d.gateway?.id,
      'slaveId:',
      d.slaveId
    );
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

interface LojasDeviceData {
  deviceId: string;
  name: string;
  centralId: string;
  slaveId: string;
  label: string;
  identifier: string;
  ingestionId: string;
  currentRelations: Array<{
    from: { entityType: string; id: string };
    to: { entityType: string; id: string };
    type: string;
    typeGroup: string;
  }>;
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
  bulkProfileModal: {
    open: boolean;
    selectedProfileId: string;
    saving: boolean;
  };
  bulkOwnerModal: {
    open: boolean;
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
  // LOJAS mode (RFC-0160)
  lojasMode: boolean;
  lojasDeviceData: LojasDeviceData[];
  lojasDataLoading: boolean;
  // CUSTOM mode config (set when user picks a mode from the CUSTOM picker)
  lojasConfig: {
    id: string;
    label: string;
    profileId: string;
    deviceType: string;
    deviceProfile: string;
  } | null;
  // CUSTOM mode picker modal (replaces old LOJAS shortcut)
  customModeModal: { open: boolean };
  // Bulk Relation Modal (force relation in batch)
  bulkRelationModal: {
    open: boolean;
    target: 'CUSTOMER' | 'ASSET_EXISTING' | 'ASSET_NEW';
    selectedAssetId: string;
    selectedAssetName: string;
    search: string;
    newAssetName: string;
    assetsLoaded: boolean;
  };
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
      const parentA = a.parentCustomerId?.id ? nameMap.get(a.parentCustomerId.id) || '' : '';
      const parentB = b.parentCustomerId?.id ? nameMap.get(b.parentCustomerId.id) || '' : '';
      compare = parentA.toLowerCase().localeCompare(parentB.toLowerCase());
    }
    return order === 'asc' ? compare : -compare;
  });
}

// Helper: sort devices by field
function sortDevices(devices: Device[], field: DeviceSortField, order: SortOrder): Device[] {
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
      compare = (a.serverAttrs?.deviceType || '')
        .toLowerCase()
        .localeCompare((b.serverAttrs?.deviceType || '').toLowerCase());
    } else if (field === 'deviceProfile') {
      compare = (a.serverAttrs?.deviceProfile || '')
        .toLowerCase()
        .localeCompare((b.serverAttrs?.deviceProfile || '').toLowerCase());
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
    bulkProfileModal: { open: false, selectedProfileId: '', saving: false },
    bulkOwnerModal: { open: false, saving: false },
    columnWidths: {
      label: 280,
      type: 180,
      createdTime: 100,
      deviceType: 80,
      deviceProfile: 90,
      telemetry: 100,
      status: 70,
    },
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
    lojasMode: false,
    lojasDeviceData: [],
    lojasDataLoading: false,
    lojasConfig: null,
    customModeModal: { open: false },
    bulkRelationModal: { open: false, target: 'CUSTOMER', selectedAssetId: '', selectedAssetName: '', search: '', newAssetName: '', assetsLoaded: false },
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
          background: ${MYIO_PURPLE}; color: white; border-radius: ${
    state.isMaximized ? '0' : '10px 10px 0 0'
  };
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
          ${
            state.isLoading
              ? renderLoading(colors, t)
              : error
              ? renderError(colors, t, error)
              : state.currentStep === 1
              ? renderStep1(state, modalId, colors, t)
              : state.currentStep === 2
              ? renderStep2(state, modalId, colors, t)
              : state.currentStep === 3 && state.lojasMode
              ? renderLojasStep3(state, modalId, colors, t)
              : renderStep3(state, modalId, colors, t)
          }
        </div>

        <!-- Footer -->
        <div style="
          padding: 12px 16px; border-top: 1px solid ${colors.border};
          display: flex; justify-content: space-between; background: ${colors.cardBg};
        ">
          <div>
            ${
              state.currentStep > 1
                ? `
              <button id="${modalId}-back" style="
                background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f3f4f6'};
                color: ${colors.text}; border: 1px solid ${colors.border};
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-family: 'Roboto', Arial, sans-serif;
              ">${t.back}</button>
            `
                : ''
            }
          </div>
          <div style="display: flex; gap: 12px;">
            ${
              state.currentStep === 2 &&
              state.deviceSelectionMode === 'multi' &&
              state.selectedDevices.length > 0
                ? `
              <button id="${modalId}-bulk-attr" style="
                background: #f59e0b; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
                display: flex; align-items: center; gap: 6px;
              ">⚡ Forçar Atributo (${state.selectedDevices.length})</button>
              <button id="${modalId}-bulk-profile" style="
                background: #8b5cf6; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
                display: flex; align-items: center; gap: 6px;
              ">🏷️ Forçar Profile (${state.selectedDevices.length})</button>
              <button id="${modalId}-bulk-owner" style="
                background: #10b981; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
                display: flex; align-items: center; gap: 6px;
              " ${!state.selectedCustomer ? 'disabled title="Selecione um Customer primeiro"' : ''}>👤 Atribuir Owner (${state.selectedDevices.length})</button>
              <button id="${modalId}-bulk-relation" style="
                background: #0a6d5e; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
                display: flex; align-items: center; gap: 6px;
              " ${!state.selectedCustomer ? 'disabled title="Selecione um Customer primeiro"' : ''}>🔗 Forçar Relação (${state.selectedDevices.length})</button>
              <button id="${modalId}-custom-shortcut" style="
                background: #ef4444; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
                display: flex; align-items: center; gap: 6px;
              ">🎛️ CUSTOM (${state.selectedDevices.length})</button>
            `
                : ''
            }
            ${
              state.currentStep === 3 && state.lojasMode
                ? `
              <button id="${modalId}-lojas-sync" style="
                background: #3b82f6; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
                display: flex; align-items: center; gap: 6px;
              " ${state.lojasDataLoading ? 'disabled' : ''}>🔄 Sync Ingestion</button>
              <button id="${modalId}-lojas-apply" style="
                background: #ef4444; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
                display: flex; align-items: center; gap: 6px;
              " ${state.lojasDataLoading ? 'disabled' : ''}>🏬 Aplicar ${state.lojasConfig?.label ?? 'LOJAS'} (${state.lojasDeviceData.length})</button>
            `
                : ''
            }
            <button id="${modalId}-cancel" style="
              background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f3f4f6'};
              color: ${colors.text}; border: 1px solid ${colors.border};
              padding: 8px 16px; border-radius: 6px; cursor: pointer;
              font-size: 14px; font-family: 'Roboto', Arial, sans-serif;
            ">${t.cancel}</button>
            ${
              state.currentStep < 3
                ? `
              <button id="${modalId}-next" style="
                background: ${MYIO_PURPLE}; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
              " ${
                state.deviceSelectionMode === 'multi' ? 'disabled title="Desabilitado no modo multi"' : ''
              }>${t.next}</button>
            `
                : state.lojasMode
                ? '' // LOJAS mode uses its own buttons (Sync Ingestion + Aplicar LOJAS)
                : `
              <button id="${modalId}-save" style="
                background: ${colors.success}; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500; font-family: 'Roboto', Arial, sans-serif;
              ">${t.save}</button>
            `
            }
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

    ${
      state.bulkAttributeModal.open
        ? `
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

          <div style="margin-bottom: 16px; padding: 12px; background: ${
            colors.surface
          }; border-radius: 8px; border: 1px solid ${colors.border};">
            <div style="font-size: 12px; color: ${
              colors.textMuted
            }; margin-bottom: 4px;">Devices selecionados:</div>
            <div style="font-size: 14px; color: ${colors.text}; font-weight: 500;">${
            state.selectedDevices.length
          } dispositivos</div>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; color: ${
              colors.textMuted
            }; font-size: 12px; margin-bottom: 6px; font-weight: 500;">
              Atributo (SERVER_SCOPE)
            </label>
            <select id="${modalId}-bulk-attr-select" style="
              width: 100%; padding: 10px 12px; border: 1px solid ${colors.border};
              border-radius: 6px; font-size: 14px; color: ${colors.text};
              background: ${colors.inputBg}; cursor: pointer;
            ">
              <option value="deviceType" ${
                state.bulkAttributeModal.attribute === 'deviceType' ? 'selected' : ''
              }>deviceType</option>
              <option value="deviceProfile" ${
                state.bulkAttributeModal.attribute === 'deviceProfile' ? 'selected' : ''
              }>deviceProfile</option>
              <option value="centralName" ${
                state.bulkAttributeModal.attribute === 'centralName' ? 'selected' : ''
              }>centralName</option>
              <option value="centralId" ${
                state.bulkAttributeModal.attribute === 'centralId' ? 'selected' : ''
              }>centralId</option>
              <option value="identifier" ${
                state.bulkAttributeModal.attribute === 'identifier' ? 'selected' : ''
              }>identifier</option>
            </select>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; color: ${
              colors.textMuted
            }; font-size: 12px; margin-bottom: 6px; font-weight: 500;">
              Valor
            </label>
            <input type="text" id="${modalId}-bulk-attr-value" value="${
            state.bulkAttributeModal.value
          }" placeholder="Digite o valor..." style="
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
              ${
                state.bulkAttributeModal.saving
                  ? 'Salvando...'
                  : 'Salvar para ' + state.selectedDevices.length + ' devices'
              }
            </button>
          </div>
        </div>
      </div>
    `
        : ''
    }

    ${
      state.bulkProfileModal.open
        ? `
      <!-- Bulk Profile Modal -->
      <div class="myio-bulk-profile-overlay" style="
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
              🏷️ Forçar Device Profile (Entity)
            </h3>
            <button id="${modalId}-bulk-profile-close" style="
              background: none; border: none; font-size: 20px; cursor: pointer;
              color: ${colors.textMuted}; padding: 4px;
            ">✕</button>
          </div>

          <div style="margin-bottom: 16px; padding: 12px; background: ${
            colors.surface
          }; border-radius: 8px; border: 1px solid ${colors.border};">
            <div style="font-size: 12px; color: ${
              colors.textMuted
            }; margin-bottom: 4px;">Devices selecionados:</div>
            <div style="font-size: 14px; color: ${colors.text}; font-weight: 500;">${
            state.selectedDevices.length
          } dispositivos</div>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; color: ${
              colors.textMuted
            }; font-size: 12px; margin-bottom: 6px; font-weight: 500;">
              Device Profile (Entity Level)
            </label>
            ${
              state.deviceProfiles.length === 0
                ? `
              <div style="padding: 12px; background: ${colors.warning}20; border-radius: 6px; font-size: 12px; color: ${colors.warning}; margin-bottom: 12px;">
                ⚠️ Clique em "Carregar Profiles" para listar os profiles disponíveis
              </div>
              <button id="${modalId}-bulk-profile-load" style="
                background: ${MYIO_PURPLE}; color: white; border: none;
                padding: 10px 16px; border-radius: 6px; cursor: pointer;
                font-size: 13px; width: 100%;
              ">🔄 Carregar Profiles</button>
            `
                : `
              <select id="${modalId}-bulk-profile-select" style="
                width: 100%; padding: 10px 12px; border: 1px solid ${colors.border};
                border-radius: 6px; font-size: 14px; color: ${colors.text};
                background: ${colors.inputBg}; cursor: pointer;
              ">
                <option value="">-- Selecione um Profile --</option>
                ${state.deviceProfiles
                  .map(
                    (p) => `
                  <option value="${p.id}" ${
                      state.bulkProfileModal.selectedProfileId === p.id ? 'selected' : ''
                    }>${p.name}</option>
                `
                  )
                  .join('')}
              </select>
            `
            }
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="${modalId}-bulk-profile-cancel" style="
              background: ${colors.surface}; color: ${colors.text};
              border: 1px solid ${colors.border}; padding: 10px 20px;
              border-radius: 6px; cursor: pointer; font-size: 14px;
            ">Cancelar</button>
            ${
              state.deviceProfiles.length > 0
                ? `
              <button id="${modalId}-bulk-profile-save" style="
                background: #8b5cf6; color: white; border: none;
                padding: 10px 20px; border-radius: 6px; cursor: pointer;
                font-size: 14px; font-weight: 500;
              " ${state.bulkProfileModal.saving ? 'disabled' : ''}>
                ${
                  state.bulkProfileModal.saving
                    ? 'Salvando...'
                    : 'Aplicar para ' + state.selectedDevices.length + ' devices'
                }
              </button>
            `
                : ''
            }
          </div>
        </div>
      </div>
    `
        : ''
    }

    ${
      state.bulkOwnerModal.open
        ? `
      <!-- Bulk Owner Modal -->
      <div class="myio-bulk-owner-overlay" style="
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
              👤 Atribuir Owner em Lote
            </h3>
            <button id="${modalId}-bulk-owner-close" style="
              background: none; border: none; font-size: 20px; cursor: pointer;
              color: ${colors.textMuted}; padding: 4px;
            ">✕</button>
          </div>

          <div style="margin-bottom: 16px; padding: 12px; background: ${
            colors.surface
          }; border-radius: 8px; border: 1px solid ${colors.border};">
            <div style="font-size: 12px; color: ${
              colors.textMuted
            }; margin-bottom: 4px;">Devices selecionados:</div>
            <div style="font-size: 14px; color: ${colors.text}; font-weight: 500;">${
            state.selectedDevices.length
          } dispositivos</div>
          </div>

          <div style="margin-bottom: 16px; padding: 12px; background: ${
            colors.success
          }20; border-radius: 8px; border: 1px solid ${colors.success}40;">
            <div style="font-size: 12px; color: ${
              colors.textMuted
            }; margin-bottom: 4px;">Novo Owner (Customer):</div>
            <div style="font-size: 14px; color: ${colors.success}; font-weight: 600;">${
            state.selectedCustomer?.name || state.selectedCustomer?.title || 'Não selecionado'
          }</div>
            <div style="font-size: 11px; color: ${colors.textMuted}; margin-top: 4px;">
              ID: ${state.selectedCustomer?.id?.id || 'N/A'}
            </div>
          </div>

          <div style="margin-bottom: 16px; padding: 12px; background: ${
            colors.warning
          }20; border-radius: 8px; border: 1px solid ${colors.warning}40;">
            <div style="font-size: 12px; color: ${colors.warning}; font-weight: 500;">
              ⚠️ Atenção: Esta ação irá atribuir todos os ${state.selectedDevices.length} devices selecionados ao customer "${state.selectedCustomer?.name || state.selectedCustomer?.title}".
            </div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="${modalId}-bulk-owner-cancel" style="
              background: ${colors.surface}; color: ${colors.text};
              border: 1px solid ${colors.border}; padding: 10px 20px;
              border-radius: 6px; cursor: pointer; font-size: 14px;
            ">Cancelar</button>
            <button id="${modalId}-bulk-owner-save" style="
              background: #10b981; color: white; border: none;
              padding: 10px 20px; border-radius: 6px; cursor: pointer;
              font-size: 14px; font-weight: 500;
            " ${state.bulkOwnerModal.saving || !state.selectedCustomer ? 'disabled' : ''}>
              ${
                state.bulkOwnerModal.saving
                  ? 'Salvando...'
                  : 'Atribuir Owner para ' + state.selectedDevices.length + ' devices'
              }
            </button>
          </div>
        </div>
      </div>
    `
        : ''
    }

    ${
      state.customModeModal.open
        ? `
      <!-- CUSTOM Mode Picker Modal -->
      <div style="
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); z-index: 10001;
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="
          background: ${colors.surface}; border-radius: 12px; padding: 24px;
          max-width: 520px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="margin: 0; color: ${colors.text}; font-size: 18px; font-weight: 600;">🎛️ CUSTOM — Selecione o Tipo</h3>
            <button id="${modalId}-custom-cancel" style="background: none; border: none; font-size: 20px; cursor: pointer; color: ${colors.textMuted}; padding: 4px;">✕</button>
          </div>
          <p style="margin: 0 0 16px; font-size: 13px; color: ${colors.textMuted};">
            Escolha o tipo a aplicar em <strong>${state.selectedDevices.length} dispositivos</strong> selecionados.
          </p>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
            ${[
              { id: 'lojas',           icon: '🏬', label: 'Lojas',              sub: '3F_MEDIDOR / 3F_MEDIDOR' },
              { id: 'motor',           icon: '⚙️', label: 'Motor',              sub: '3F_MEDIDOR / MOTOR' },
              { id: 'entrada_energia', icon: '🔌', label: 'Entrada Energia',    sub: '3F_MEDIDOR / ENTRADA' },
              { id: 'hidrometro_lojas',icon: '💧', label: 'Hidrômetro Lojas',   sub: 'HIDROMETRO / HIDROMETRO' },
              { id: 'area_comum_water',icon: '🌊', label: 'Área Comum Água',    sub: 'HIDROMETRO / HIDROMETRO_AREA_COMUM' },
              { id: 'entrada_agua',    icon: '🚰', label: 'Entrada Água',       sub: 'HIDROMETRO / HIDROMETRO_SHOPPING' },
              { id: 'temperatura',     icon: '🌡️', label: 'Temperatura',        sub: 'TERMOSTATO / TERMOSTATO' },
            ].map(m => `
              <button
                id="${modalId}-custom-mode-${m.id}"
                data-mode="${m.id}"
                style="
                  background: ${colors.cardBg}; border: 2px solid ${colors.border};
                  border-radius: 10px; padding: 14px 12px; cursor: pointer; text-align: left;
                  display: flex; flex-direction: column; gap: 4px; transition: border-color 0.15s;
                "
                onmouseover="this.style.borderColor='#ef4444'"
                onmouseout="this.style.borderColor='${colors.border}'"
              >
                <span style="font-size: 22px;">${m.icon}</span>
                <span style="font-size: 14px; font-weight: 600; color: ${colors.text};">${m.label}</span>
                <span style="font-size: 11px; color: ${colors.textMuted};">${m.sub}</span>
              </button>
            `).join('')}
          </div>
          <div style="display: flex; justify-content: flex-end;">
            <button id="${modalId}-custom-cancel-bottom" style="
              background: ${colors.surface}; color: ${colors.text};
              border: 1px solid ${colors.border}; padding: 10px 20px;
              border-radius: 6px; cursor: pointer; font-size: 14px;
            ">Cancelar</button>
          </div>
        </div>
      </div>
    `
        : ''
    }

    ${
      state.bulkRelationModal.open
        ? (() => {
            const rel = state.bulkRelationModal;
            const customerName = state.selectedCustomer?.name || state.selectedCustomer?.title || '';
            const filteredAssets = rel.search
              ? state.customerAssets.filter(a => a.name.toLowerCase().includes(rel.search.toLowerCase()))
              : state.customerAssets;
            return `
      <!-- Bulk Force Relation Modal -->
      <div style="
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6); z-index: 10001;
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="
          background: ${colors.surface}; border-radius: 12px; padding: 24px;
          max-width: 480px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="margin: 0; color: ${colors.text}; font-size: 18px; font-weight: 600;">🔗 Forçar Relação em Lote</h3>
            <button id="${modalId}-bulk-rel-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: ${colors.textMuted}; padding: 4px;">✕</button>
          </div>
          <p style="margin: 0 0 16px; font-size: 13px; color: ${colors.textMuted};">
            Remove todas as relações TO existentes dos <strong>${state.selectedDevices.length}</strong> devices e cria uma nova relação para o destino escolhido.
          </p>

          <!-- Target: Customer -->
          <label style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 8px; border: 2px solid ${rel.target === 'CUSTOMER' ? '#0a6d5e' : colors.border}; cursor: pointer; margin-bottom: 8px;">
            <input type="radio" name="${modalId}-bulk-rel-target" value="CUSTOMER"
              id="${modalId}-bulk-rel-customer"
              ${rel.target === 'CUSTOMER' ? 'checked' : ''}
              style="margin-top: 2px; accent-color: #0a6d5e;">
            <div>
              <div style="font-weight: 600; color: ${colors.text}; font-size: 14px;">Customer</div>
              <div style="font-size: 12px; color: ${colors.textMuted};">${customerName}</div>
            </div>
          </label>

          <!-- Target: Existing Asset -->
          <label style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 8px; border: 2px solid ${rel.target === 'ASSET_EXISTING' ? '#0a6d5e' : colors.border}; cursor: pointer; margin-bottom: 8px; flex-direction: column;">
            <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
              <input type="radio" name="${modalId}-bulk-rel-target" value="ASSET_EXISTING"
                id="${modalId}-bulk-rel-asset-existing"
                ${rel.target === 'ASSET_EXISTING' ? 'checked' : ''}
                style="accent-color: #0a6d5e;">
              <div style="font-weight: 600; color: ${colors.text}; font-size: 14px;">Asset existente</div>
            </div>
            ${rel.target === 'ASSET_EXISTING' ? `
              <div style="width: 100%; padding-left: 26px;">
                ${rel.selectedAssetId ? `
                  <div style="font-size: 13px; color: #0a6d5e; font-weight: 500; margin-bottom: 8px;">✅ ${rel.selectedAssetName}</div>
                ` : ''}
                <input
                  id="${modalId}-bulk-rel-asset-search"
                  type="text"
                  placeholder="Buscar asset..."
                  value="${rel.search}"
                  style="width: 100%; box-sizing: border-box; padding: 6px 10px; border-radius: 6px; border: 1px solid ${colors.border}; background: ${colors.cardBg}; color: ${colors.text}; font-size: 13px; margin-bottom: 8px;"
                />
                ${!rel.assetsLoaded ? `
                  <button id="${modalId}-bulk-rel-load-assets" style="
                    background: #0a6d5e; color: white; border: none; padding: 6px 14px;
                    border-radius: 6px; cursor: pointer; font-size: 13px; margin-bottom: 8px;
                  ">Carregar Assets</button>
                ` : ''}
                <div style="max-height: 180px; overflow-y: auto; border: 1px solid ${colors.border}; border-radius: 6px;">
                  ${filteredAssets.length === 0
                    ? `<div style="padding: 12px; text-align: center; color: ${colors.textMuted}; font-size: 13px;">${rel.assetsLoaded ? 'Nenhum asset encontrado.' : 'Clique em "Carregar Assets".'}</div>`
                    : filteredAssets.map(a => `
                        <div
                          class="bulk-rel-asset-item"
                          data-asset-id="${a.id}"
                          data-asset-name="${a.name}"
                          style="
                            padding: 8px 12px; cursor: pointer; font-size: 13px;
                            color: ${a.id === rel.selectedAssetId ? '#0a6d5e' : colors.text};
                            background: ${a.id === rel.selectedAssetId ? '#e6f4f1' : 'transparent'};
                            font-weight: ${a.id === rel.selectedAssetId ? '600' : '400'};
                            border-bottom: 1px solid ${colors.border};
                          "
                        >${a.name}${a.type ? ` <span style="color:${colors.textMuted};font-size:11px;">(${a.type})</span>` : ''}</div>
                      `).join('')
                  }
                </div>
              </div>
            ` : ''}
          </label>

          <!-- Target: New Asset -->
          <label style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 8px; border: 2px solid ${rel.target === 'ASSET_NEW' ? '#0a6d5e' : colors.border}; cursor: pointer; margin-bottom: 16px; flex-direction: column;">
            <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
              <input type="radio" name="${modalId}-bulk-rel-target" value="ASSET_NEW"
                id="${modalId}-bulk-rel-asset-new"
                ${rel.target === 'ASSET_NEW' ? 'checked' : ''}
                style="accent-color: #0a6d5e;">
              <div style="font-weight: 600; color: ${colors.text}; font-size: 14px;">Novo asset abaixo do customer</div>
            </div>
            ${rel.target === 'ASSET_NEW' ? `
              <div style="width: 100%; padding-left: 26px;">
                <input
                  id="${modalId}-bulk-rel-new-asset-name"
                  type="text"
                  placeholder="Nome do novo asset..."
                  value="${rel.newAssetName}"
                  style="width: 100%; box-sizing: border-box; padding: 6px 10px; border-radius: 6px; border: 1px solid ${colors.border}; background: ${colors.cardBg}; color: ${colors.text}; font-size: 13px;"
                />
              </div>
            ` : ''}
          </label>

          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="${modalId}-bulk-rel-cancel" style="
              background: ${colors.surface}; color: ${colors.text};
              border: 1px solid ${colors.border}; padding: 10px 20px;
              border-radius: 6px; cursor: pointer; font-size: 14px;
            ">Cancelar</button>
            <button id="${modalId}-bulk-rel-save" style="
              background: #0a6d5e; color: white; border: none;
              padding: 10px 20px; border-radius: 6px; cursor: pointer;
              font-size: 14px; font-weight: 500;
            " ${
              (rel.target === 'ASSET_EXISTING' && !rel.selectedAssetId) ||
              (rel.target === 'ASSET_NEW' && !rel.newAssetName.trim())
                ? 'disabled'
                : ''
            }>🔗 Forçar (${state.selectedDevices.length} dev)</button>
          </div>
        </div>
      </div>
            `;
          })()
        : ''
    }
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
          <label style="color: ${
            colors.textMuted
          }; font-size: 12px; font-weight: 500; display: block; margin-bottom: 4px;">
            🔍 ${t.searchCustomers}
          </label>
          <input type="text" id="${modalId}-customer-search" placeholder="${t.searchCustomers}" value="${
    state.customerSearchTerm
  }" style="
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
      ${
        sortedCustomers.length === 0
          ? `<div style="padding: 40px; text-align: center; color: ${colors.textMuted};">${t.noResults}</div>`
          : sortedCustomers
              .map((customer) => {
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
              <div style="font-weight: 500; color: ${colors.text}; font-size: 13px;">${
                  customer.name || customer.title
                }</div>
              <div style="font-size: 11px; color: ${colors.textMuted};">${
                  customer.cnpj || 'ID: ' + customerId.slice(0, 8) + '...'
                }</div>
            </div>
            <div style="min-width: 90px; text-align: center;">
              <div style="font-size: 10px; color: ${colors.textMuted};">Pai</div>
              <div style="font-size: 11px; color: ${
                parentName === 'N/A' ? colors.textMuted : colors.text
              }; font-weight: ${
                  parentName === 'N/A' ? 'normal' : '500'
                }; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;">
                ${parentName}
              </div>
            </div>
            <div style="min-width: 70px; text-align: center;">
              <div style="font-size: 10px; color: ${colors.textMuted};">Owner</div>
              <div style="font-size: 11px; color: ${
                ownerName === 'N/A' ? colors.textMuted : ownerName === 'TENANT' ? colors.primary : colors.text
              }; font-weight: ${
                  ownerName === 'N/A' ? 'normal' : '500'
                }; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70px;">
                ${ownerName}
              </div>
            </div>
            ${
              createdDate
                ? `<div style="min-width: 70px; text-align: center;">
              <div style="font-size: 10px; color: ${colors.textMuted};">Criado</div>
              <div style="font-size: 11px; color: ${colors.text};">${createdDate}</div>
            </div>`
                : ''
            }
            ${isSelected ? `<div style="color: ${colors.success}; font-size: 16px;">✓</div>` : ''}
          </div>
        `;
              })
              .join('')
      }
    </div>
  `;
}

// ============================================================================
// Step 2: Device Selection
// ============================================================================

function renderStep2(state: ModalState, modalId: string, colors: ThemeColors, t: typeof i18n.pt): string {
  // Get unique values for filters
  const types = [...new Set(state.devices.map((d) => d.type).filter(Boolean))].sort() as string[];
  const deviceTypes = [
    ...new Set(state.devices.map((d) => d.serverAttrs?.deviceType).filter(Boolean)),
  ].sort() as string[];
  const deviceProfiles = [
    ...new Set(state.devices.map((d) => d.serverAttrs?.deviceProfile).filter(Boolean)),
  ].sort() as string[];
  const statuses = ['online', 'offline', 'waiting', 'bad'];

  const { field: sortField, order: sortOrder } = state.deviceSort;
  const {
    types: filterTypes,
    deviceTypes: filterDeviceTypes,
    deviceProfiles: filterDeviceProfiles,
    statuses: filterStatuses,
  } = state.deviceFilters;
  const searchTerm = state.deviceSearchTerm.toLowerCase();

  // Filter devices by dropdown filters
  let filteredDevices = state.devices.filter((d) => {
    if (filterTypes.length > 0 && !filterTypes.includes(d.type || '')) return false;
    if (filterDeviceTypes.length > 0 && !filterDeviceTypes.includes(d.serverAttrs?.deviceType || ''))
      return false;
    if (filterDeviceProfiles.length > 0 && !filterDeviceProfiles.includes(d.serverAttrs?.deviceProfile || ''))
      return false;
    if (filterStatuses.length > 0) {
      const status = d.latestTelemetry?.connectionStatus?.value || 'offline';
      if (!filterStatuses.includes(status)) return false;
    }
    return true;
  });

  // Apply search term filter for display count
  const searchFilteredDevices = searchTerm
    ? filteredDevices.filter((d) => {
        const name = (d.name || '').toLowerCase();
        const label = (d.label || '').toLowerCase();
        const type = (d.type || '').toLowerCase();
        const deviceType = (d.serverAttrs?.deviceType || '').toLowerCase();
        const deviceProfile = (d.serverAttrs?.deviceProfile || '').toLowerCase();
        return (
          name.includes(searchTerm) ||
          label.includes(searchTerm) ||
          type.includes(searchTerm) ||
          deviceType.includes(searchTerm) ||
          deviceProfile.includes(searchTerm)
        );
      })
    : filteredDevices;

  // Sort devices
  const sortedDevices = sortDevices(filteredDevices, sortField, sortOrder);

  // Grid height based on maximize state
  const gridHeight = state.isMaximized ? 'calc(100vh - 340px)' : '360px';

  const hasActiveFilters =
    filterTypes.length > 0 ||
    filterDeviceTypes.length > 0 ||
    filterDeviceProfiles.length > 0 ||
    filterStatuses.length > 0;

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
          <label style="color: ${
            colors.textMuted
          }; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            🔍 Buscar
          </label>
          <input type="text" id="${modalId}-device-search" placeholder="${t.searchDevices}" value="${
    state.deviceSearchTerm
  }" style="
            width: 100%; padding: 7px 10px; border: 1px solid ${colors.border};
            border-radius: 6px; font-size: 13px; color: ${colors.text};
            background: ${colors.inputBg}; box-sizing: border-box;
          "/>
        </div>
        <div style="min-width: 100px;">
          <label style="color: ${
            colors.textMuted
          }; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            Type ${filterTypes.length > 0 ? `(${filterTypes.length})` : ''}
          </label>
          <select id="${modalId}-device-type-filter" multiple size="1" style="
            width: 100%; padding: 7px 8px; border: 1px solid ${
              filterTypes.length > 0 ? MYIO_PURPLE : colors.border
            };
            border-radius: 6px; font-size: 11px; color: ${colors.text};
            background: ${colors.inputBg}; cursor: pointer; height: 32px;
          ">
            ${types
              .map(
                (type) =>
                  `<option value="${type}" ${filterTypes.includes(type) ? 'selected' : ''}>${type}</option>`
              )
              .join('')}
          </select>
        </div>
        <div style="min-width: 100px;">
          <label style="color: ${
            state.deviceAttrsLoaded ? colors.textMuted : colors.warning
          }; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            deviceType ${filterDeviceTypes.length > 0 ? `(${filterDeviceTypes.length})` : ''} ${
    !state.deviceAttrsLoaded ? '🔒' : ''
  }
          </label>
          <select id="${modalId}-device-devicetype-filter" multiple size="1" style="
            width: 100%; padding: 7px 8px; border: 1px solid ${
              filterDeviceTypes.length > 0 ? MYIO_PURPLE : colors.border
            };
            border-radius: 6px; font-size: 11px; color: ${colors.text};
            background: ${colors.inputBg}; cursor: ${
    state.deviceAttrsLoaded ? 'pointer' : 'not-allowed'
  }; height: 32px;
            opacity: ${state.deviceAttrsLoaded ? '1' : '0.5'};
          " ${!state.deviceAttrsLoaded ? 'disabled' : ''}>
            ${deviceTypes
              .map(
                (dt) =>
                  `<option value="${dt}" ${filterDeviceTypes.includes(dt) ? 'selected' : ''}>${dt}</option>`
              )
              .join('')}
          </select>
        </div>
        <div style="min-width: 100px;">
          <label style="color: ${
            state.deviceAttrsLoaded ? colors.textMuted : colors.warning
          }; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            deviceProfile ${filterDeviceProfiles.length > 0 ? `(${filterDeviceProfiles.length})` : ''} ${
    !state.deviceAttrsLoaded ? '🔒' : ''
  }
          </label>
          <select id="${modalId}-device-profile-filter" multiple size="1" style="
            width: 100%; padding: 7px 8px; border: 1px solid ${
              filterDeviceProfiles.length > 0 ? MYIO_PURPLE : colors.border
            };
            border-radius: 6px; font-size: 11px; color: ${colors.text};
            background: ${colors.inputBg}; cursor: ${
    state.deviceAttrsLoaded ? 'pointer' : 'not-allowed'
  }; height: 32px;
            opacity: ${state.deviceAttrsLoaded ? '1' : '0.5'};
          " ${!state.deviceAttrsLoaded ? 'disabled' : ''}>
            ${deviceProfiles
              .map(
                (p) =>
                  `<option value="${p}" ${filterDeviceProfiles.includes(p) ? 'selected' : ''}>${p}</option>`
              )
              .join('')}
          </select>
        </div>
        <div style="min-width: 100px;">
          <label style="color: ${
            state.deviceTelemetryLoaded ? colors.textMuted : colors.warning
          }; font-size: 11px; font-weight: 500; display: block; margin-bottom: 3px;">
            Status ${filterStatuses.length > 0 ? `(${filterStatuses.length})` : ''} ${
    !state.deviceTelemetryLoaded ? '🔒' : ''
  }
          </label>
          <select id="${modalId}-device-status-filter" multiple size="1" style="
            width: 100%; padding: 7px 8px; border: 1px solid ${
              filterStatuses.length > 0 ? MYIO_PURPLE : colors.border
            };
            border-radius: 6px; font-size: 11px; color: ${colors.text};
            background: ${colors.inputBg}; cursor: ${
    state.deviceTelemetryLoaded ? 'pointer' : 'not-allowed'
  }; height: 32px;
            opacity: ${state.deviceTelemetryLoaded ? '1' : '0.5'};
          " ${!state.deviceTelemetryLoaded ? 'disabled' : ''}>
            ${statuses
              .map(
                (s) => `<option value="${s}" ${filterStatuses.includes(s) ? 'selected' : ''}>${s}</option>`
              )
              .join('')}
          </select>
        </div>
        ${
          hasActiveFilters
            ? `
          <div style="display: flex; align-items: flex-end;">
            <button id="${modalId}-clear-filters" style="
              background: ${colors.danger}; color: white; border: none;
              padding: 7px 12px; border-radius: 6px; cursor: pointer;
              font-size: 11px; font-weight: 500;
            ">✕ Limpar</button>
          </div>
        `
            : ''
        }
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="font-size: 11px; color: ${colors.textMuted};">
            📍 <strong>${state.selectedCustomer?.name || state.selectedCustomer?.title}</strong>
            <span style="margin-left: 8px; color: ${colors.primary};">(${sortedDevices.length}/${
    state.devices.length
  })</span>
          </div>
          ${
            state.attrsLoading
              ? `
            <span style="font-size: 10px; color: ${colors.warning}; padding: 3px 8px; background: ${colors.surface}; border-radius: 4px; border: 1px solid ${colors.border};">
              ⏳ Atributos ${state.attrsLoadedCount}/${state.devices.length}...
            </span>
          `
              : state.deviceAttrsLoaded
              ? `
            <span style="font-size: 10px; color: ${colors.success}; padding: 3px 8px;">
              ✅ Atributos OK
            </span>
          `
              : `
            <button id="${modalId}-load-attrs" style="
              padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;
              background: ${colors.cardBg}; border: 1px solid ${colors.border}; color: ${colors.text};
              display: flex; align-items: center; gap: 4px;
            ">
              🏷️ Carregar Atributos (${searchFilteredDevices.length})
            </button>
          `
          }
          ${
            state.telemetryLoading
              ? `
            <span style="font-size: 10px; color: ${colors.warning}; padding: 3px 8px; background: ${colors.surface}; border-radius: 4px; border: 1px solid ${colors.border};">
              ⏳ Telemetria ${state.telemetryLoadedCount}/${sortedDevices.length}...
            </span>
          `
              : state.deviceTelemetryLoaded
              ? `
            <span style="font-size: 10px; color: ${colors.success}; padding: 3px 8px;">
              ✅ Telemetria OK
            </span>
          `
              : `
            <button id="${modalId}-load-telemetry" style="
              padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;
              background: ${colors.cardBg}; border: 1px solid ${colors.border}; color: ${colors.text};
              display: flex; align-items: center; gap: 4px;
            ">
              📡 Carregar Telemetria (${searchFilteredDevices.length})
            </button>
          `
          }
          <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: ${
            colors.surface
          }; border-radius: 6px; border: 1px solid ${colors.border};">
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
          ${
            state.deviceSelectionMode === 'multi' && state.selectedDevices.length > 0
              ? `
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
          `
              : ''
          }
          ${
            state.deviceSelectionMode === 'multi' && state.selectedDevices.length === 0
              ? `
            <button id="${modalId}-select-all" style="
              padding: 3px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;
              background: transparent; border: 1px solid ${colors.border}; color: ${colors.text};
            ">Selecionar Todos</button>
          `
              : ''
          }
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
      <div style="width: ${
        state.columnWidths.deviceType
      }px; padding: 0 6px; text-align: center; border-right: 1px solid ${colors.border};">
        devType ${!state.deviceAttrsLoaded ? '🔒' : ''}
      </div>
      <div style="width: ${
        state.columnWidths.deviceProfile
      }px; padding: 0 6px; text-align: center; border-right: 1px solid ${colors.border};">
        devProfile ${!state.deviceAttrsLoaded ? '🔒' : ''}
      </div>
      <div style="width: ${
        state.columnWidths.telemetry
      }px; padding: 0 6px; text-align: center; border-right: 1px solid ${colors.border};">
        Telemetria ${!state.deviceTelemetryLoaded ? '🔒' : ''}
      </div>
      <div style="width: ${
        state.columnWidths.status
      }px; padding: 0 6px; text-align: center; border-right: 1px solid ${colors.border};">
        Status ${!state.deviceTelemetryLoaded ? '🔒' : ''}
      </div>
      <div style="width: 24px;"></div>
    </div>

    <div style="
      max-height: ${gridHeight}; overflow-y: auto; border: 1px solid ${colors.border};
      border-radius: 0 0 8px 8px; background: ${colors.surface};
    " id="${modalId}-device-list">
      ${
        sortedDevices.length === 0
          ? `<div style="padding: 40px; text-align: center; color: ${colors.textMuted};">${t.noResults}</div>`
          : sortedDevices.map((device) => renderDeviceRow(device, state, modalId, colors)).join('')
      }
    </div>
  `;
}

// Render a single device row
function renderDeviceRow(device: Device, state: ModalState, modalId: string, colors: ThemeColors): string {
  const deviceId = getEntityId(device);
  const isSelectedSingle =
    state.deviceSelectionMode === 'single' && getEntityId(state.selectedDevice) === deviceId;
  const isSelectedMulti =
    state.deviceSelectionMode === 'multi' && state.selectedDevices.some((d) => getEntityId(d) === deviceId);
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
  const connStatus = state.deviceTelemetryLoaded ? telemetry.connectionStatus?.value || 'offline' : null;
  const statusStyle = connStatus ? statusColors[connStatus] || statusColors.offline : notLoadedStyle;

  // Telemetry display - filter by device type to avoid showing irrelevant telemetry
  const telemetryItems: Array<{ label: string; value: string; unit: string; ts: string }> = [];

  // Determine expected telemetry based on device type or name
  const deviceType = (device.type || '').toLowerCase();
  const deviceName = (device.name || device.label || '').toLowerCase();
  const attrDeviceType = (attrs.deviceType || '').toUpperCase();

  // Water devices: HIDROMETRO, CAIXA_DAGUA, TANK, or name contains 'hidr', 'agua', 'water'
  const isWaterDevice =
    ['HIDROMETRO', 'CAIXA_DAGUA', 'TANK'].includes(attrDeviceType) ||
    deviceName.includes('hidr') ||
    deviceName.includes('agua') ||
    deviceName.includes('water') ||
    deviceType.includes('water');

  // Energy devices: 3F_MEDIDOR, ENTRADA, MOTOR, CHILLER, FANCOIL, COMPRESSOR, ESCADA_ROLANTE, ELEVADOR
  const isEnergyDevice =
    [
      '3F_MEDIDOR',
      'ENTRADA',
      'MOTOR',
      'CHILLER',
      'FANCOIL',
      'COMPRESSOR',
      'ESCADA_ROLANTE',
      'ELEVADOR',
    ].includes(attrDeviceType) ||
    deviceType.includes('energy') ||
    deviceType.includes('meter');

  // Temperature devices: name or type contains 'temp', 'sensor'
  const isTemperatureDevice =
    deviceName.includes('temp') ||
    deviceType.includes('temp') ||
    (deviceName.includes('sensor') && !isWaterDevice && !isEnergyDevice);

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

  const statusTs = telemetry.connectionStatus?.ts
    ? formatDate(telemetry.connectionStatus.ts, state.locale, true)
    : '';

  // Tooltip content for device info
  const tooltipContent = `Name: ${device.name}\\nID: ${deviceId}\\nType: ${
    device.type || 'N/A'
  }\\nCreated: ${formatDate(device.createdTime, state.locale, true)}`;

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
    return telemetryItems
      .map(
        (item) => `
      <span style="display: inline-flex; align-items: center; gap: 1px;">
        <span style="font-size: 9px; color: ${colors.text}; font-weight: 500;" title="${item.label}">${item.value}${item.unit}</span>
        <span class="myio-ts-btn" data-ts="${item.label}: ${item.value}${item.unit}\\n${item.ts}" style="
          cursor: pointer; font-size: 9px; color: ${colors.primary}; font-weight: 600;
        " title="${item.label}: ${item.ts}">(+)</span>
      </span>
    `
      )
      .join('');
  };

  // Render status based on loaded state
  const renderStatusValue = () => {
    if (!state.deviceTelemetryLoaded) {
      return `<span style="font-size: 8px; padding: 2px 6px; border-radius: 3px; background: ${notLoadedStyle.bg}; color: ${notLoadedStyle.text}; font-style: italic;">—</span>`;
    }
    return `
      <span style="font-size: 9px; padding: 2px 6px; border-radius: 3px; background: ${
        statusStyle.bg
      }; color: ${statusStyle.text};">
        ${connStatus}
      </span>
      ${
        statusTs
          ? `<span class="myio-ts-btn" data-ts="${statusTs}" style="
        cursor: pointer; font-size: 10px; color: ${colors.primary}; font-weight: 600;
      " title="${statusTs}">(+)</span>`
          : ''
      }
    `;
  };

  return `
    <div class="myio-list-item ${isSelected ? 'selected' : ''}"
         data-device-id="${deviceId}" style="
      display: flex; align-items: center; gap: 0;
      padding: 6px 12px; border-bottom: 1px solid ${colors.border};
      cursor: pointer; transition: background 0.15s;
    ">
      ${
        state.deviceSelectionMode === 'multi'
          ? `
        <div style="width: 28px; flex-shrink: 0; text-align: center;">
          <input type="checkbox" class="myio-device-checkbox" data-device-id="${deviceId}"
            ${isSelectedMulti ? 'checked' : ''} style="
            width: 16px; height: 16px; cursor: pointer; accent-color: ${MYIO_PURPLE};
          " />
        </div>
      `
          : ''
      }
      <div style="width: 28px; font-size: 16px; flex-shrink: 0;">${getDeviceIcon(device.type)}</div>
      <div style="width: ${
        state.columnWidths.label
      }px; padding: 0 6px; overflow: hidden; display: flex; align-items: center; gap: 4px;">
        <div style="font-weight: 500; color: ${
          colors.text
        }; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;" title="${
    device.label || device.name
  }">
          ${device.label || device.name}
        </div>
        <span class="myio-info-btn" data-device-info="${encodeURIComponent(tooltipContent)}" style="
          cursor: pointer; font-size: 12px; color: ${colors.textMuted}; flex-shrink: 0;
          width: 16px; height: 16px; border-radius: 50%; background: ${colors.cardBg};
          display: flex; align-items: center; justify-content: center; border: 1px solid ${colors.border};
        " title="Ver detalhes">ⓘ</span>
      </div>
      <div style="width: ${
        state.columnWidths.type
      }px; padding: 0 6px; text-align: center; flex-shrink: 0; overflow: hidden;">
        <div style="font-size: 9px; padding: 2px 4px; border-radius: 3px; display: inline-block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
          background: ${device.type?.includes('HIDRO') ? '#dbeafe' : '#fef3c7'};
          color: ${device.type?.includes('HIDRO') ? '#1e40af' : '#92400e'};" title="${device.type || ''}">
          ${device.type || '—'}
        </div>
      </div>
      <div style="width: ${
        state.columnWidths.createdTime
      }px; padding: 0 6px; text-align: center; flex-shrink: 0;">
        <span style="font-size: 9px; color: ${colors.textMuted};">${createdTimeStr}</span>
      </div>
      <div style="width: ${
        state.columnWidths.deviceType
      }px; padding: 0 6px; text-align: center; flex-shrink: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
        ${renderDeviceTypeValue()}
      </div>
      <div style="width: ${
        state.columnWidths.deviceProfile
      }px; padding: 0 6px; text-align: center; flex-shrink: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
        ${renderDeviceProfileValue()}
      </div>
      <div style="width: ${
        state.columnWidths.telemetry
      }px; padding: 0 6px; text-align: center; flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
        ${renderTelemetryValue()}
      </div>
      <div style="width: ${
        state.columnWidths.status
      }px; padding: 0 6px; text-align: center; flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 2px;">
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
  const suggestedCentralName = `Central ${
    state.selectedCustomer.name || state.selectedCustomer.title
  } PADRAO`;
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
        <div style="font-weight: 600; font-size: 16px; color: ${colors.text};">${
    state.selectedDevice.name
  }</div>
        <div style="font-size: 12px; color: ${colors.textMuted};">
          ID: ${deviceId} • Cliente: ${state.selectedCustomer.name || state.selectedCustomer.title}
        </div>
        <div style="font-size: 11px; color: ${colors.textMuted}; margin-top: 4px;">
          Profile: <strong style="color: ${colors.text};">${state.selectedDevice.type || 'default'}</strong>
        </div>
      </div>
    </div>

    <!-- Owner (PRIMEIRO na ordem) -->
    <div style="margin-bottom: 20px;">
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
              ${
                isOwnerValid
                  ? `<strong>CUSTOMER:</strong> "${
                      state.selectedCustomer.name || state.selectedCustomer.title
                    }" (${t.validOwner})`
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
        <div id="${modalId}-change-owner-form" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid ${
    colors.border
  };">
          <div style="display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap;">
            <div style="flex: 2; min-width: 200px;">
              <label style="color: ${
                colors.textMuted
              }; font-size: 10px; display: block; margin-bottom: 4px;">Novo Customer ID</label>
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

    <!-- Relation TO (SEGUNDO na ordem) -->
    <div style="margin-bottom: 20px;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: ${colors.textMuted}; font-weight: 500;">
        🔗 ${t.relationTo}
      </h3>
      <div style="
        padding: 16px; background: ${colors.cardBg}; border: 1px solid ${colors.border}; border-radius: 8px;
      ">
        ${
          hasRelation
            ? `<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px; color: ${colors.success};">✅</span>
                <span style="color: ${colors.text};">
                  <strong>${state.deviceRelation?.toEntityType}:</strong> ${
                state.deviceRelation?.toEntityName || state.deviceRelation?.toEntityId
              }
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
        <div id="${modalId}-add-relation-form" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid ${
    colors.border
  };">
          <div style="display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap;">
            <div style="min-width: 100px;">
              <label style="color: ${
                colors.textMuted
              }; font-size: 10px; display: block; margin-bottom: 4px;">Tipo</label>
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
              <label style="color: ${
                colors.textMuted
              }; font-size: 10px; display: block; margin-bottom: 4px;">🔍 Buscar</label>
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
            display: ${
              state.customerAssets.length > 0 || state.relationSelectorType === 'CUSTOMER' ? 'block' : 'none'
            };
          ">
            ${
              state.relationSelectorType === 'ASSET'
                ? state.customerAssets
                    .filter(
                      (a) =>
                        !state.relationSelectorSearch ||
                        a.name.toLowerCase().includes(state.relationSelectorSearch.toLowerCase())
                    )
                    .map(
                      (asset) => `
                  <div class="relation-entity-item" data-entity-type="ASSET" data-entity-id="${
                    asset.id
                  }" data-entity-name="${asset.name}" style="
                    padding: 8px 12px; cursor: pointer; border-bottom: 1px solid ${colors.border};
                    display: flex; justify-content: space-between; align-items: center;
                  ">
                    <span style="color: ${colors.text}; font-size: 12px;">📦 ${asset.name}</span>
                    <span style="color: ${colors.textMuted}; font-size: 10px;">${asset.type || ''}</span>
                  </div>
                `
                    )
                    .join('') ||
                  `<div style="padding: 12px; color: ${colors.textMuted}; text-align: center; font-size: 11px;">Nenhum asset encontrado</div>`
                : state.customers
                    .filter(
                      (c) =>
                        !state.relationSelectorSearch ||
                        (c.name || c.title || '')
                          .toLowerCase()
                          .includes(state.relationSelectorSearch.toLowerCase())
                    )
                    .slice(0, 50)
                    .map(
                      (customer) => `
                  <div class="relation-entity-item" data-entity-type="CUSTOMER" data-entity-id="${getEntityId(
                    customer
                  )}" data-entity-name="${customer.name || customer.title}" style="
                    padding: 8px 12px; cursor: pointer; border-bottom: 1px solid ${colors.border};
                    display: flex; justify-content: space-between; align-items: center;
                  ">
                    <span style="color: ${colors.text}; font-size: 12px;">👤 ${
                        customer.name || customer.title
                      }</span>
                  </div>
                `
                    )
                    .join('') ||
                  `<div style="padding: 12px; color: ${colors.textMuted}; text-align: center; font-size: 11px;">Nenhum customer encontrado</div>`
            }
          </div>

          <!-- Selected Entity Display -->
          <input type="hidden" id="${modalId}-relation-entity-id" value=""/>
          <div id="${modalId}-relation-selected" style="display: none; margin-top: 10px; padding: 10px; background: ${
    colors.success
  }20; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span id="${modalId}-relation-selected-name" style="color: ${
    colors.text
  }; font-size: 12px;"></span>
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

    <!-- Device Profile (Entity Level) - TERCEIRO na ordem -->
    <div style="margin-bottom: 20px;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: ${colors.textMuted}; font-weight: 500;">
        🏷️ Device Profile (Entity)
      </h3>
      <div style="
        padding: 16px; background: ${colors.cardBg}; border: 1px solid ${colors.border}; border-radius: 8px;
      ">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 200px;">
            <label style="color: ${
              colors.textMuted
            }; font-size: 10px; display: block; margin-bottom: 4px;">Profile Atual</label>
            <div style="font-size: 13px; color: ${colors.text}; font-weight: 500;">
              ${state.selectedDevice.type || 'default'}
            </div>
          </div>
          <div style="flex: 2; min-width: 200px;">
            <label style="color: ${
              colors.textMuted
            }; font-size: 10px; display: block; margin-bottom: 4px;">Alterar para</label>
            <div style="display: flex; gap: 8px;">
              <select id="${modalId}-device-profile-select" style="
                flex: 1; padding: 8px 12px; border: 1px solid ${colors.border};
                border-radius: 6px; font-size: 13px; color: ${colors.text};
                background: ${colors.inputBg};
              ">
                <option value="">-- Selecione --</option>
                ${state.deviceProfiles
                  .map(
                    (p) => `
                  <option value="${p.id}" ${state.selectedDevice?.type === p.name ? 'selected' : ''}>${
                      p.name
                    }</option>
                `
                  )
                  .join('')}
              </select>
              <button id="${modalId}-load-profiles" style="
                background: ${colors.cardBg}; color: ${colors.text}; border: 1px solid ${colors.border};
                padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 11px;
              " title="Carregar profiles">🔄</button>
              <button id="${modalId}-save-profile" style="
                background: ${MYIO_PURPLE}; color: white; border: none;
                padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 11px;
              ">Salvar</button>
            </div>
          </div>
        </div>
        ${
          state.deviceProfiles.length === 0
            ? `
          <div style="margin-top: 8px; padding: 8px; background: ${colors.warning}20; border-radius: 4px; font-size: 11px; color: ${colors.warning};">
            ⚠️ Clique em 🔄 para carregar os profiles disponíveis
          </div>
        `
            : ''
        }
      </div>
    </div>

    <!-- Server-Scope Attributes (QUARTO na ordem) -->
    <div>
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: ${colors.textMuted}; font-weight: 500;">
        📋 ${t.serverScopeAttrs}
      </h3>
      <div style="background: ${colors.cardBg}; border: 1px solid ${
    colors.border
  }; border-radius: 8px; overflow: hidden;">
        ${renderEntityLabelRow(state.selectedDevice.label, state.selectedDevice.name, colors, modalId, t)}
        ${renderAttrRow('centralId', attrs.centralId, true, null, colors, modalId)}
        ${renderAttrRow('slaveId', attrs.slaveId, true, null, colors, modalId)}
        ${renderAttrRow('centralName', attrs.centralName, false, suggestedCentralName, colors, modalId, t)}
        ${renderDeviceTypeSelect(attrs.deviceType, suggestedType, colors, modalId, t)}
        ${renderDeviceProfileSelect(attrs.deviceType || suggestedType, attrs.deviceProfile, colors, modalId)}
        ${renderAttrRow(
          'identifier',
          attrs.identifier,
          false,
          null,
          colors,
          modalId,
          t,
          false,
          'Para LOJAS: LUC/SUC da Loja. Para outros casos, use padrões como: CAG (ecossistema CAG), ESCADA_ROLANTE, ELEVADOR, BOMBA, ENTRADA, TEMPERATURA'
        )}
        ${renderAttrRow('ingestionId', attrs.ingestionId, false, null, colors, modalId, t, true)}
      </div>
    </div>
  `;
}

// ============================================================================
// LOJAS Step 3 Rendering (RFC-0160)
// ============================================================================

function renderLojasStep3(state: ModalState, modalId: string, colors: ThemeColors, t: typeof i18n.pt): string {
  if (state.lojasDataLoading) {
    return `
      <div style="padding: 40px; text-align: center; color: ${colors.textMuted};">
        <div style="
          display: inline-block; width: 28px; height: 28px;
          border: 3px solid ${colors.border}; border-top-color: ${MYIO_PURPLE};
          border-radius: 50%; animation: spin 0.8s linear infinite;
        "></div>
        <div style="margin-top: 12px; font-size: 14px;">Carregando dados dos dispositivos...</div>
      </div>
    `;
  }

  const data = state.lojasDeviceData;
  const gridHeight = state.isMaximized ? 'calc(100vh - 340px)' : '400px';

  return `
    <div style="
      padding: 16px; background: ${colors.cardBg}; border-radius: 8px;
      border: 1px solid ${colors.border}; margin-bottom: 12px;
    ">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h3 style="margin: 0; font-size: 16px; color: ${colors.text}; font-weight: 600;">
          🏬 LOJAS — Configuração em Lote (${data.length} dispositivos)
        </h3>
        <div style="font-size: 11px; color: ${colors.textMuted};">
          📍 <strong>${state.selectedCustomer?.name || state.selectedCustomer?.title || ''}</strong>
        </div>
      </div>

      <div style="
        max-height: ${gridHeight}; overflow-y: auto;
        border: 1px solid ${colors.border}; border-radius: 8px;
        background: ${colors.surface};
      " id="${modalId}-lojas-table-container">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: ${colors.cardBg}; position: sticky; top: 0; z-index: 1;">
              <th style="padding: 8px 6px; border-bottom: 2px solid ${colors.border}; text-align: center; width: 32px; color: ${colors.textMuted}; font-size: 10px;">#</th>
              <th style="padding: 8px 6px; border-bottom: 2px solid ${colors.border}; text-align: left; color: ${colors.textMuted}; font-size: 10px;">Nome</th>
              <th style="padding: 8px 6px; border-bottom: 2px solid ${colors.border}; text-align: left; color: ${colors.textMuted}; font-size: 10px; width: 110px;">centralId</th>
              <th style="padding: 8px 6px; border-bottom: 2px solid ${colors.border}; text-align: center; width: 55px; color: ${colors.textMuted}; font-size: 10px;">slaveId</th>
              <th style="padding: 8px 6px; border-bottom: 2px solid ${colors.border}; text-align: left; color: ${colors.textMuted}; font-size: 10px;">Etiqueta</th>
              <th style="padding: 8px 6px; border-bottom: 2px solid ${colors.border}; text-align: left; color: ${colors.textMuted}; font-size: 10px;">Identificador</th>
              <th style="padding: 8px 6px; border-bottom: 2px solid ${colors.border}; text-align: left; width: 85px; color: ${colors.textMuted}; font-size: 10px;">ingestionId</th>
            </tr>
          </thead>
          <tbody>
            ${data
              .map(
                (d, i) => `
              <tr style="border-bottom: 1px solid ${colors.border}; ${i % 2 === 1 ? `background: ${colors.cardBg};` : ''}">
                <td style="padding: 6px; text-align: center; color: ${colors.textMuted}; font-size: 11px;">${i + 1}</td>
                <td style="padding: 6px; color: ${colors.text}; font-weight: 500; font-size: 11px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${d.name}">${d.name}</td>
                <td style="padding: 6px; color: ${colors.textMuted}; font-family: monospace; font-size: 10px; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${d.centralId}">${d.centralId || `<span style="color: ${colors.warning};">—</span>`}</td>
                <td style="padding: 6px; text-align: center; color: ${colors.textMuted}; font-size: 11px;">${d.slaveId || '—'}</td>
                <td style="padding: 6px;">
                  <input type="text" id="${modalId}-lojas-label-${i}" data-lojas-index="${i}" data-lojas-field="label" value="${(d.label || '').replace(/"/g, '&quot;')}" style="
                    width: 100%; padding: 4px 6px; border: 1px solid ${colors.border}; border-radius: 4px;
                    font-size: 11px; color: ${colors.text}; background: ${colors.inputBg}; box-sizing: border-box;
                  "/>
                </td>
                <td style="padding: 6px;">
                  <input type="text" id="${modalId}-lojas-identifier-${i}" data-lojas-index="${i}" data-lojas-field="identifier" value="${(d.identifier || '').replace(/"/g, '&quot;')}" style="
                    width: 100%; padding: 4px 6px; border: 1px solid ${colors.border}; border-radius: 4px;
                    font-size: 11px; color: ${colors.text}; background: ${colors.inputBg}; box-sizing: border-box;
                  "/>
                </td>
                <td style="padding: 6px; font-family: monospace; font-size: 9px; color: ${d.ingestionId ? colors.success : colors.textMuted}; max-width: 85px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${d.ingestionId || ''}">${d.ingestionId || '—'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 10px; font-size: 11px; color: ${colors.textMuted}; display: flex; gap: 16px; flex-wrap: wrap;">
        <span>Profile alvo: <strong style="color: ${colors.text};">3F_MEDIDOR</strong></span>
        <span>deviceType: <strong style="color: ${colors.text};">3F_MEDIDOR</strong></span>
        <span>deviceProfile: <strong style="color: ${colors.text};">3F_MEDIDOR</strong></span>
        <span>Relação: <strong style="color: ${colors.text};">CUSTOMER → DEVICE (Contains)</strong></span>
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
  isFetchable = false,
  helpText?: string
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
      <span style="width: 110px; font-size: 13px; color: ${
        colors.textMuted
      }; font-weight: 500; display: flex; align-items: center; gap: 4px;">
        ${key}
        ${
          helpText
            ? `<span title="${helpText}" style="cursor: help; font-size: 12px; color: ${colors.primary};">ℹ️</span>`
            : ''
        }
      </span>
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
        ${
          !hasValue && suggestion && t
            ? `
          <button data-suggest="${key}" data-value="${suggestion}" style="
            background: ${colors.cardBg}; color: ${colors.text}; border: 1px solid ${colors.border};
            padding: 6px 10px; border-radius: 4px; cursor: pointer;
            font-size: 11px; width: 100%;
          ">${t.suggest}</button>
        `
            : ''
        }
        ${
          !hasValue && isFetchable && t
            ? `
          <button id="${modalId}-fetch-ingestion" style="
            background: ${colors.cardBg}; color: ${colors.text}; border: 1px solid ${colors.border};
            padding: 6px 10px; border-radius: 4px; cursor: pointer;
            font-size: 11px; width: 100%;
          ">${t.fetch}</button>
        `
            : ''
        }
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
    '3F_MEDIDOR',
    'HIDROMETRO',
    'CHILLER',
    'ELEVADOR',
    'ESCADA_ROLANTE',
    'COMPRESSOR',
    'FANCOIL',
    'ENTRADA',
    'CAIXA_DAGUA',
    'TANK',
    'MOTOR',
  ];

  return `
    <div style="
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-bottom: 1px solid ${colors.border};
    ">
      <span style="font-size: 16px;">${icon}</span>
      <span style="width: 110px; font-size: 13px; color: ${
        colors.textMuted
      }; font-weight: 500;">deviceType</span>
      <div style="flex: 1;">
        <select id="${modalId}-deviceType" style="
          width: 100%; padding: 8px 12px; border: 1px solid ${hasValue ? colors.border : colors.warning};
          border-radius: 6px; font-size: 13px; color: ${colors.text};
          background: ${colors.inputBg}; cursor: pointer;
        ">
          <option value="">Select type...</option>
          ${options
            .map((o) => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`)
            .join('')}
        </select>
      </div>
      <div style="width: 80px;">
        ${
          !hasValue
            ? `
          <button data-suggest="deviceType" data-value="${suggested}" style="
            background: ${colors.cardBg}; color: ${colors.text}; border: 1px solid ${colors.border};
            padding: 6px 10px; border-radius: 4px; cursor: pointer;
            font-size: 11px; width: 100%;
          ">${t.suggest}</button>
        `
            : ''
        }
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
  const helpText =
    'IMPORTANTE: deviceType + deviceProfile definem o tipo do device. Se ambos = 3F_MEDIDOR → device é LOJA (energia). Se ambos = HIDROMETRO → device é LOJA (água).';

  return `
    <div style="
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-bottom: 1px solid ${colors.border};
    ">
      <span style="font-size: 16px;">${icon}</span>
      <span style="width: 110px; font-size: 13px; color: ${
        colors.textMuted
      }; font-weight: 500; display: flex; align-items: center; gap: 4px;">
        deviceProfile
        <span title="${helpText}" style="cursor: help; font-size: 12px; color: ${colors.primary};">ℹ️</span>
      </span>
      <div style="flex: 1;">
        <select id="${modalId}-deviceProfile" style="
          width: 100%; padding: 8px 12px; border: 1px solid ${hasValue ? colors.border : colors.warning};
          border-radius: 6px; font-size: 13px; color: ${colors.text};
          background: ${colors.inputBg}; cursor: pointer;
        ">
          <option value="">Select profile...</option>
          ${profiles
            .map((p) => `<option value="${p}" ${value === p ? 'selected' : ''}>${p}</option>`)
            .join('')}
        </select>
      </div>
      <div style="width: 80px;"></div>
    </div>
  `;
}

function renderEntityLabelRow(
  currentLabel: string | undefined,
  deviceName: string,
  colors: ThemeColors,
  modalId: string,
  t: typeof i18n.pt
): string {
  const hasValue = !!currentLabel;
  const icon = hasValue ? '✅' : '⚠️';
  const suggestedValue = currentLabel || deviceName;
  const helpText =
    'Etiqueta do dispositivo (entityLabel) - aparece no nome exibido da entidade no ThingsBoard';

  return `
    <div style="
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-bottom: 1px solid ${colors.border};
    ">
      <span style="font-size: 16px;">${icon}</span>
      <span style="width: 110px; font-size: 13px; color: ${
        colors.textMuted
      }; font-weight: 500; display: flex; align-items: center; gap: 4px;">
        etiqueta
        <span title="${helpText}" style="cursor: help; font-size: 12px; color: ${colors.primary};">ℹ️</span>
      </span>
      <div style="flex: 1;">
        <input type="text" id="${modalId}-entityLabel" value="${currentLabel || ''}"
               placeholder="Digite a etiqueta do dispositivo..." style="
          width: 100%; padding: 8px 12px; border: 1px solid ${hasValue ? colors.border : colors.warning};
          border-radius: 6px; font-size: 13px; color: ${colors.text};
          background: ${colors.inputBg};
          box-sizing: border-box;
        "/>
      </div>
      <div style="width: 80px;">
        ${
          !hasValue
            ? `
          <button data-suggest="entityLabel" data-value="${suggestedValue}" style="
            background: ${colors.cardBg}; color: ${colors.text}; border: 1px solid ${colors.border};
            padding: 6px 10px; border-radius: 4px; cursor: pointer;
            font-size: 11px; width: 100%;
          ">${t.suggest}</button>
        `
            : ''
        }
      </div>
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

  // Prevent modal from closing when clicking outside (as per RFC requirement #4)
  // Modal can only be closed via X button or Cancel button
  const overlay = container.querySelector('.myio-upsell-modal-overlay') as HTMLElement;
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      // Don't close - only X button and Cancel button can close the modal
    });
    // Prevent clicks on modal content from bubbling to overlay
    const content = overlay.querySelector('.myio-upsell-modal-content') as HTMLElement;
    if (content) {
      content.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

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
    if (state.lojasMode && state.currentStep === 3) {
      // Return to Step 2 with same device selection preserved
      state.lojasMode = false;
      state.lojasDataLoading = false;
      state.currentStep = 2;
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
      return;
    }
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
  container.querySelectorAll('[data-customer-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-customer-id');
      state.selectedCustomer = state.customers.find((c) => c.id?.id === id) || null;
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
  container.querySelectorAll('[data-device-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-device-id');
      state.selectedDevice = state.devices.find((d) => d.id?.id === id) || null;

      // Save scroll position before re-render
      const listEl = document.getElementById(`${modalId}-device-list`);
      const savedScrollTop = listEl ? listEl.scrollTop : 0;

      renderModal(container, state, modalId, t);

      // Restore scroll position after re-render
      requestAnimationFrame(() => {
        const newListEl = document.getElementById(`${modalId}-device-list`);
        if (newListEl) newListEl.scrollTop = savedScrollTop;
      });
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
    state.deviceFilters.types = Array.from(select.selectedOptions).map((o) => o.value);
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Device deviceType filter (multiselect) - serverAttrs.deviceType
  document.getElementById(`${modalId}-device-devicetype-filter`)?.addEventListener('change', (e) => {
    const select = e.target as HTMLSelectElement;
    state.deviceFilters.deviceTypes = Array.from(select.selectedOptions).map((o) => o.value);
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Device profile filter (multiselect) - serverAttrs.deviceProfile
  document.getElementById(`${modalId}-device-profile-filter`)?.addEventListener('change', (e) => {
    const select = e.target as HTMLSelectElement;
    state.deviceFilters.deviceProfiles = Array.from(select.selectedOptions).map((o) => o.value);
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Status filter (only works when telemetry is loaded)
  (document.getElementById(`${modalId}-device-status-filter`) as HTMLSelectElement | null)?.addEventListener(
    'change',
    (e) => {
      const select = e.target as HTMLSelectElement;
      state.deviceFilters.statuses = Array.from(select.selectedOptions).map((o) => o.value);
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    }
  );

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
  container.querySelectorAll('[data-suggest]').forEach((btn) => {
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

    console.log(
      '[UpsellModal] Load attrs clicked - mode:',
      state.deviceSelectionMode,
      'selected:',
      state.selectedDevices.length
    );

    let devicesToLoad: Device[];

    // Priority 1: If single mode with selected device, load only that one
    if (state.deviceSelectionMode === 'single' && state.selectedDevice) {
      devicesToLoad = [state.selectedDevice];
      console.log('[UpsellModal] Loading attrs for SINGLE selected device only:', devicesToLoad.length);
    }
    // Priority 2: If multi-select mode with selected devices, load only those
    else if (state.deviceSelectionMode === 'multi' && state.selectedDevices.length > 0) {
      devicesToLoad = [...state.selectedDevices]; // Clone array
      console.log('[UpsellModal] Loading attrs for SELECTED devices only:', devicesToLoad.length);
    } else {
      // Priority 2: Apply filters (search term, types, deviceTypes, deviceProfiles)
      const {
        types: filterTypes,
        deviceTypes: filterDeviceTypes,
        deviceProfiles: filterDeviceProfiles,
      } = state.deviceFilters;
      const searchTerm = state.deviceSearchTerm.toLowerCase();
      const hasFilters =
        filterTypes.length > 0 ||
        filterDeviceTypes.length > 0 ||
        filterDeviceProfiles.length > 0 ||
        searchTerm;

      devicesToLoad = state.devices.filter((d) => {
        // Apply type filter
        if (filterTypes.length > 0 && !filterTypes.includes(d.type || '')) return false;
        // Apply deviceType filter
        if (filterDeviceTypes.length > 0 && !filterDeviceTypes.includes(d.serverAttrs?.deviceType || ''))
          return false;
        // Apply deviceProfile filter
        if (
          filterDeviceProfiles.length > 0 &&
          !filterDeviceProfiles.includes(d.serverAttrs?.deviceProfile || '')
        )
          return false;
        // Apply search filter
        if (searchTerm) {
          const name = (d.name || '').toLowerCase();
          const label = (d.label || '').toLowerCase();
          const type = (d.type || '').toLowerCase();
          const deviceType = (d.serverAttrs?.deviceType || '').toLowerCase();
          const deviceProfile = (d.serverAttrs?.deviceProfile || '').toLowerCase();
          if (
            !name.includes(searchTerm) &&
            !label.includes(searchTerm) &&
            !type.includes(searchTerm) &&
            !deviceType.includes(searchTerm) &&
            !deviceProfile.includes(searchTerm)
          ) {
            return false;
          }
        }
        return true;
      });
      console.log(
        '[UpsellModal] Loading attrs for',
        hasFilters ? 'filtered' : 'all',
        'devices:',
        devicesToLoad.length
      );
    }

    state.attrsLoading = true;
    state.attrsLoadedCount = 0;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);

    await loadDeviceAttrsInBatch(state, container, modalId, t, onClose, devicesToLoad);

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

    console.log(
      '[UpsellModal] Load telemetry clicked - mode:',
      state.deviceSelectionMode,
      'selected:',
      state.selectedDevices.length
    );

    let devicesToLoad: Device[];

    // Priority 1: If single mode with selected device, load only that one
    if (state.deviceSelectionMode === 'single' && state.selectedDevice) {
      devicesToLoad = [state.selectedDevice];
      console.log('[UpsellModal] Loading telemetry for SINGLE selected device only:', devicesToLoad.length);
    }
    // Priority 2: If multi-select mode with selected devices, load only those
    else if (state.deviceSelectionMode === 'multi' && state.selectedDevices.length > 0) {
      devicesToLoad = [...state.selectedDevices]; // Clone array
      console.log('[UpsellModal] Loading telemetry for SELECTED devices only:', devicesToLoad.length);
    } else {
      // Priority 2: Apply filters (search term, types, deviceTypes, deviceProfiles)
      const {
        types: filterTypes,
        deviceTypes: filterDeviceTypes,
        deviceProfiles: filterDeviceProfiles,
      } = state.deviceFilters;
      const searchTerm = state.deviceSearchTerm.toLowerCase();
      const hasFilters =
        filterTypes.length > 0 ||
        filterDeviceTypes.length > 0 ||
        filterDeviceProfiles.length > 0 ||
        searchTerm;

      devicesToLoad = state.devices.filter((d) => {
        if (filterTypes.length > 0 && !filterTypes.includes(d.type || '')) return false;
        if (filterDeviceTypes.length > 0 && !filterDeviceTypes.includes(d.serverAttrs?.deviceType || ''))
          return false;
        if (
          filterDeviceProfiles.length > 0 &&
          !filterDeviceProfiles.includes(d.serverAttrs?.deviceProfile || '')
        )
          return false;
        // Apply search filter
        if (searchTerm) {
          const name = (d.name || '').toLowerCase();
          const label = (d.label || '').toLowerCase();
          const type = (d.type || '').toLowerCase();
          const deviceType = (d.serverAttrs?.deviceType || '').toLowerCase();
          const deviceProfile = (d.serverAttrs?.deviceProfile || '').toLowerCase();
          if (
            !name.includes(searchTerm) &&
            !label.includes(searchTerm) &&
            !type.includes(searchTerm) &&
            !deviceType.includes(searchTerm) &&
            !deviceProfile.includes(searchTerm)
          ) {
            return false;
          }
        }
        return true;
      });
      console.log(
        '[UpsellModal] Loading telemetry for',
        hasFilters ? 'filtered' : 'all',
        'devices:',
        devicesToLoad.length
      );
    }

    state.telemetryLoading = true;
    state.telemetryLoadedCount = 0;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);

    await loadDeviceTelemetryInBatch(state, container, modalId, t, onClose, devicesToLoad);

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
    const {
      types: filterTypes,
      deviceTypes: filterDeviceTypes,
      deviceProfiles: filterDeviceProfiles,
    } = state.deviceFilters;
    // Select all visible/filtered devices
    let filteredDevices = state.devices.filter((d) => {
      if (filterTypes.length > 0 && !filterTypes.includes(d.type || '')) return false;
      if (filterDeviceTypes.length > 0 && !filterDeviceTypes.includes(d.serverAttrs?.deviceType || ''))
        return false;
      if (
        filterDeviceProfiles.length > 0 &&
        !filterDeviceProfiles.includes(d.serverAttrs?.deviceProfile || '')
      )
        return false;
      return true;
    });
    state.selectedDevices = [...filteredDevices];

    // Save scroll position before re-render
    const listEl = document.getElementById(`${modalId}-device-list`);
    const savedScroll = listEl ? listEl.scrollTop : 0;
    renderModal(container, state, modalId, t);
    requestAnimationFrame(() => {
      const el = document.getElementById(`${modalId}-device-list`);
      if (el) el.scrollTop = savedScroll;
    });
  });

  // Clear Selection button
  document.getElementById(`${modalId}-clear-selection`)?.addEventListener('click', () => {
    state.selectedDevices = [];

    // Save scroll position before re-render
    const listEl = document.getElementById(`${modalId}-device-list`);
    const savedScroll = listEl ? listEl.scrollTop : 0;
    renderModal(container, state, modalId, t);
    requestAnimationFrame(() => {
      const el = document.getElementById(`${modalId}-device-list`);
      if (el) el.scrollTop = savedScroll;
    });
  });

  // Checkbox handlers for multi-select
  const checkboxes = container.querySelectorAll('.myio-device-checkbox');
  checkboxes.forEach((checkbox) => {
    // Use onclick instead of onchange for more reliable behavior
    (checkbox as HTMLInputElement).onclick = (e) => {
      e.stopPropagation();
      const input = e.target as HTMLInputElement;
      const deviceId = input.getAttribute('data-device-id');
      if (!deviceId) return;

      const device = state.devices.find((d) => d.id?.id === deviceId);
      if (!device) return;

      // Use setTimeout to ensure checkbox state is updated
      setTimeout(() => {
        const isChecked = input.checked;

        if (isChecked) {
          // Add to selection if not already present
          if (!state.selectedDevices.some((d) => d.id?.id === deviceId)) {
            state.selectedDevices.push(device);
          }
        } else {
          // Remove from selection
          state.selectedDevices = state.selectedDevices.filter((d) => d.id?.id !== deviceId);
        }

        // Save scroll position before re-render
        const listEl = document.getElementById(`${modalId}-device-list`);
        const savedScroll = listEl ? listEl.scrollTop : 0;

        // Re-render and re-setup
        renderModal(container, state, modalId, t);
        setupEventListeners(container, state, modalId, t, onClose);

        // Restore scroll position after re-render
        requestAnimationFrame(() => {
          const el = document.getElementById(`${modalId}-device-list`);
          if (el) el.scrollTop = savedScroll;
        });
      }, 0);
    };
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
  // Bulk Profile Modal Handlers
  // ========================

  // Open bulk profile modal
  document.getElementById(`${modalId}-bulk-profile`)?.addEventListener('click', () => {
    state.bulkProfileModal.open = true;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Close bulk profile modal (X button)
  document.getElementById(`${modalId}-bulk-profile-close`)?.addEventListener('click', () => {
    state.bulkProfileModal.open = false;
    state.bulkProfileModal.selectedProfileId = '';
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Cancel bulk profile modal
  document.getElementById(`${modalId}-bulk-profile-cancel`)?.addEventListener('click', () => {
    state.bulkProfileModal.open = false;
    state.bulkProfileModal.selectedProfileId = '';
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Load profiles in bulk modal
  document.getElementById(`${modalId}-bulk-profile-load`)?.addEventListener('click', async () => {
    try {
      console.log('[UpsellModal] Loading device profiles for bulk modal...');
      const profiles = await fetchDeviceProfiles(state);
      state.deviceProfiles = profiles;
      console.log('[UpsellModal] Loaded', profiles.length, 'profiles');
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    } catch (error) {
      console.error('[UpsellModal] Error loading profiles:', error);
      alert('Erro ao carregar profiles: ' + (error as Error).message);
    }
  });

  // Profile select change in bulk modal
  document.getElementById(`${modalId}-bulk-profile-select`)?.addEventListener('change', (e) => {
    state.bulkProfileModal.selectedProfileId = (e.target as HTMLSelectElement).value;
  });

  // Save bulk profile
  document.getElementById(`${modalId}-bulk-profile-save`)?.addEventListener('click', async () => {
    await saveBulkProfile(state, container, modalId, t, onClose);
  });

  // ========================
  // Bulk Owner Modal Handlers
  // ========================

  // Open bulk owner modal
  document.getElementById(`${modalId}-bulk-owner`)?.addEventListener('click', () => {
    if (!state.selectedCustomer) {
      alert('Selecione um Customer primeiro no Step 1');
      return;
    }
    state.bulkOwnerModal.open = true;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Close bulk owner modal (X button)
  document.getElementById(`${modalId}-bulk-owner-close`)?.addEventListener('click', () => {
    state.bulkOwnerModal.open = false;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Cancel bulk owner modal
  document.getElementById(`${modalId}-bulk-owner-cancel`)?.addEventListener('click', () => {
    state.bulkOwnerModal.open = false;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Save bulk owner
  document.getElementById(`${modalId}-bulk-owner-save`)?.addEventListener('click', async () => {
    await saveBulkOwner(state, container, modalId, t, onClose);
  });

  // ========================
  // CUSTOM Mode Picker (replaces old LOJAS shortcut)
  // ========================

  document.getElementById(`${modalId}-custom-shortcut`)?.addEventListener('click', () => {
    if (state.selectedDevices.length === 0) return;
    state.customModeModal.open = true;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  const closCustomModal = () => {
    state.customModeModal.open = false;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  };
  document.getElementById(`${modalId}-custom-cancel`)?.addEventListener('click', closCustomModal);
  document.getElementById(`${modalId}-custom-cancel-bottom`)?.addEventListener('click', closCustomModal);

  // Mode card clicks
  CUSTOM_MODES.forEach((mode) => {
    document.getElementById(`${modalId}-custom-mode-${mode.id}`)?.addEventListener('click', async () => {
      state.customModeModal.open = false;
      state.lojasConfig = mode;
      state.lojasMode = true;
      state.currentStep = 3;
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
      await loadLojasData(state, container, modalId, t, onClose);
    });
  });

  // ========================
  // Bulk Force Relation Modal
  // ========================

  document.getElementById(`${modalId}-bulk-relation`)?.addEventListener('click', () => {
    if (!state.selectedCustomer) { alert('Selecione um Customer primeiro no Step 1'); return; }
    state.bulkRelationModal.open = true;
    state.bulkRelationModal.target = 'CUSTOMER';
    state.bulkRelationModal.selectedAssetId = '';
    state.bulkRelationModal.selectedAssetName = '';
    state.bulkRelationModal.search = '';
    state.bulkRelationModal.newAssetName = '';
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  const closeBulkRelModal = () => {
    state.bulkRelationModal.open = false;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  };
  document.getElementById(`${modalId}-bulk-rel-close`)?.addEventListener('click', closeBulkRelModal);
  document.getElementById(`${modalId}-bulk-rel-cancel`)?.addEventListener('click', closeBulkRelModal);

  // Radio: change target
  ['CUSTOMER', 'ASSET_EXISTING', 'ASSET_NEW'].forEach((val) => {
    const radio = document.getElementById(`${modalId}-bulk-rel-${val === 'CUSTOMER' ? 'customer' : val === 'ASSET_EXISTING' ? 'asset-existing' : 'asset-new'}`) as HTMLInputElement | null;
    radio?.addEventListener('change', () => {
      state.bulkRelationModal.target = val as typeof state.bulkRelationModal.target;
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    });
  });

  // Search input
  document.getElementById(`${modalId}-bulk-rel-asset-search`)?.addEventListener('input', (e) => {
    state.bulkRelationModal.search = (e.target as HTMLInputElement).value;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Load assets button
  document.getElementById(`${modalId}-bulk-rel-load-assets`)?.addEventListener('click', async () => {
    if (!state.selectedCustomer) return;
    const customerId = getEntityId(state.selectedCustomer);
    state.customerAssets = await fetchCustomerAssets(state, customerId);
    state.bulkRelationModal.assetsLoaded = true;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Asset item clicks in the list
  container.querySelectorAll('.bulk-rel-asset-item').forEach((el) => {
    (el as HTMLElement).addEventListener('click', () => {
      state.bulkRelationModal.selectedAssetId = (el as HTMLElement).dataset.assetId || '';
      state.bulkRelationModal.selectedAssetName = (el as HTMLElement).dataset.assetName || '';
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    });
  });

  // New asset name input
  document.getElementById(`${modalId}-bulk-rel-new-asset-name`)?.addEventListener('input', (e) => {
    state.bulkRelationModal.newAssetName = (e.target as HTMLInputElement).value;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  });

  // Save / execute
  document.getElementById(`${modalId}-bulk-rel-save`)?.addEventListener('click', async () => {
    await handleBatchForceRelation(state, container, modalId, t, onClose);
  });

  // ========================
  // LOJAS Step 3 Handlers (RFC-0160) — kept for backward compat
  // ========================

  // LOJAS Sync Ingestion button
  document.getElementById(`${modalId}-lojas-sync`)?.addEventListener('click', async () => {
    await handleLojasSyncIngestion(state, container, modalId, t, onClose);
  });

  // LOJAS Apply button
  document.getElementById(`${modalId}-lojas-apply`)?.addEventListener('click', async () => {
    await handleLojasApply(state, container, modalId, t, onClose);
  });

  // LOJAS table input change handlers (save values on input change without re-render)
  if (state.lojasMode && state.currentStep === 3) {
    state.lojasDeviceData.forEach((_d, i) => {
      const labelInput = document.getElementById(`${modalId}-lojas-label-${i}`) as HTMLInputElement;
      const identifierInput = document.getElementById(`${modalId}-lojas-identifier-${i}`) as HTMLInputElement;

      if (labelInput) {
        labelInput.addEventListener('input', () => {
          state.lojasDeviceData[i].label = labelInput.value;
        });
      }
      if (identifierInput) {
        identifierInput.addEventListener('input', () => {
          state.lojasDeviceData[i].identifier = identifierInput.value;
        });
      }
    });
  }

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
    const entityType = (document.getElementById(`${modalId}-relation-entity-type`) as HTMLSelectElement)
      ?.value as 'ASSET' | 'CUSTOMER';
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
    // Don't re-render on search input to avoid losing focus
    // Instead, only update the entity list via DOM manipulation
    const colors = getThemeColors(state.theme);
    updateRelationEntityList(container, state, modalId, colors);
  });

  // Click on Entity Items
  document.querySelectorAll('.relation-entity-item').forEach((item) => {
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
      document.querySelectorAll('.relation-entity-item').forEach((i) => {
        (i as HTMLElement).style.background = '';
      });
      (item as HTMLElement).style.background = `${MYIO_PURPLE}20`;
    });
  });

  // Save Relation
  document.getElementById(`${modalId}-save-relation`)?.addEventListener('click', async () => {
    const entityType = (document.getElementById(`${modalId}-relation-entity-type`) as HTMLSelectElement)
      ?.value;
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

  // ========================
  // Device Profile (Entity Level) Handlers
  // ========================

  // Load Device Profiles
  document.getElementById(`${modalId}-load-profiles`)?.addEventListener('click', async () => {
    try {
      console.log('[UpsellModal] Loading device profiles...');
      const profiles = await fetchDeviceProfiles(state);
      state.deviceProfiles = profiles;
      console.log('[UpsellModal] Loaded', profiles.length, 'profiles');
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    } catch (error) {
      console.error('[UpsellModal] Error loading profiles:', error);
      alert('Erro ao carregar profiles: ' + (error as Error).message);
    }
  });

  // Save Device Profile (Entity Level)
  document.getElementById(`${modalId}-save-profile`)?.addEventListener('click', async () => {
    if (!state.selectedDevice) return;

    const select = document.getElementById(`${modalId}-device-profile-select`) as HTMLSelectElement;
    const newProfileId = select?.value;

    if (!newProfileId) {
      alert('Selecione um profile');
      return;
    }

    try {
      console.log('[UpsellModal] Changing device profile to:', newProfileId);
      await changeDeviceProfile(state, state.selectedDevice, newProfileId);

      // Update local state
      const profile = state.deviceProfiles.find((p) => p.id === newProfileId);
      if (profile && state.selectedDevice) {
        state.selectedDevice.type = profile.name;
        state.selectedDevice.deviceProfileId = { entityType: 'DEVICE_PROFILE', id: newProfileId };
      }

      alert('Device Profile alterado com sucesso!');
      renderModal(container, state, modalId, t);
      setupEventListeners(container, state, modalId, t, onClose);
    } catch (error) {
      console.error('[UpsellModal] Error changing device profile:', error);
      alert('Erro ao alterar profile: ' + (error as Error).message);
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

      const ingestionCustomerIdAttr = customerAttrs.find((a) => a.key === 'ingestionId');
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
        alert(
          `IngestionId encontrado: ${matchingDevice.id}\nDevice: ${matchingDevice.name || 'N/A'}\nTipo: ${
            matchingDevice.deviceType || 'N/A'
          }`
        );
      } else {
        console.log('[UpsellModal] No matching device found for centralId:', centralId, 'slaveId:', slaveId);
        alert(
          `Nenhum device encontrado na API de ingestion com:\ncentralId=${centralId}\nslaveId=${slaveId}\n\nTotal de devices no customer: ${ingestionDevices.length}`
        );
      }
    } catch (error) {
      console.error('[UpsellModal] Error fetching ingestionId:', error);
      alert('Erro ao buscar ingestionId: ' + (error as Error).message);
    }
  });

  // Apply search filters after render (to preserve filter state)
  if (state.customerSearchTerm && state.currentStep === 1) {
    filterCustomerList(
      container,
      state.customers,
      state.customerSearchTerm.toLowerCase(),
      state.selectedCustomer,
      state.customerSort
    );
  }
  if (state.deviceSearchTerm && state.currentStep === 2) {
    filterDeviceListVisual(
      container,
      state.devices,
      state.deviceSearchTerm.toLowerCase(),
      state.deviceFilters,
      state.deviceSort
    );
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
// Relation Entity List Update
// ============================================================================

function updateRelationEntityList(
  container: HTMLElement,
  state: ModalState,
  modalId: string,
  colors: ThemeColors
): void {
  const entityList = container.querySelector(`#${modalId}-relation-entity-list`);
  if (!entityList) return;

  const searchTerm = state.relationSelectorSearch.toLowerCase();

  let filteredData: string;

  if (state.relationSelectorType === 'ASSET') {
    const filteredAssets = state.customerAssets.filter(
      (a) => !searchTerm || a.name.toLowerCase().includes(searchTerm)
    );

    filteredData =
      filteredAssets.length > 0
        ? filteredAssets
            .map(
              (asset) => `
            <div class="relation-entity-item" data-entity-type="ASSET" data-entity-id="${
              asset.id
            }" data-entity-name="${asset.name}" style="
              padding: 8px 12px; cursor: pointer; border-bottom: 1px solid ${colors.border};
              display: flex; justify-content: space-between; align-items: center;
            ">
              <span style="color: ${colors.text}; font-size: 12px;">📦 ${asset.name}</span>
              <span style="color: ${colors.textMuted}; font-size: 10px;">${asset.type || ''}</span>
            </div>
          `
            )
            .join('')
        : `<div style="padding: 12px; color: ${colors.textMuted}; text-align: center; font-size: 11px;">Nenhum asset encontrado</div>`;
  } else {
    const filteredCustomers = state.customers
      .filter((c) => !searchTerm || (c.name || c.title || '').toLowerCase().includes(searchTerm))
      .slice(0, 50);

    filteredData =
      filteredCustomers.length > 0
        ? filteredCustomers
            .map(
              (customer) => `
            <div class="relation-entity-item" data-entity-type="CUSTOMER" data-entity-id="${getEntityId(
              customer
            )}" data-entity-name="${customer.name || customer.title}" style="
              padding: 8px 12px; cursor: pointer; border-bottom: 1px solid ${colors.border};
              display: flex; justify-content: space-between; align-items: center;
            ">
              <span style="color: ${colors.text}; font-size: 12px;">👤 ${
                customer.name || customer.title
              }</span>
            </div>
          `
            )
            .join('')
        : `<div style="padding: 12px; color: ${colors.textMuted}; text-align: center; font-size: 11px;">Nenhum customer encontrado</div>`;
  }

  entityList.innerHTML = filteredData;

  // Re-attach event listeners for the new items
  entityList.querySelectorAll('.relation-entity-item').forEach((item) => {
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
      entityList.querySelectorAll('.relation-entity-item').forEach((i) => {
        (i as HTMLElement).style.background = '';
      });
      (item as HTMLElement).style.background = `${MYIO_PURPLE}20`;
    });
  });
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
  items.forEach((item) => {
    const id = item.getAttribute('data-customer-id');
    const customer = sortedCustomers.find((c) => c.id?.id === id);
    const customerName = customer?.name || customer?.title || '';
    const matches =
      customerName.toLowerCase().includes(search) || customer?.cnpj?.includes(search) || id?.includes(search);
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
  let filtered = devices.filter((d) => {
    if (filters.types.length > 0 && !filters.types.includes(d.type || '')) return false;
    if (filters.deviceTypes.length > 0 && !filters.deviceTypes.includes(d.serverAttrs?.deviceType || ''))
      return false;
    if (
      filters.deviceProfiles.length > 0 &&
      !filters.deviceProfiles.includes(d.serverAttrs?.deviceProfile || '')
    )
      return false;
    return true;
  });

  filtered = sortDevices(filtered, sort.field, sort.order);

  const items = listContainer.querySelectorAll('[data-device-id]');
  items.forEach((item) => {
    const id = item.getAttribute('data-device-id');
    const device = filtered.find((d) => d.id?.id === id);
    if (!device) {
      (item as HTMLElement).style.display = 'none';
      return;
    }
    const matchesSearch =
      !search ||
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

  // Verify that the FROM entity exists before creating the relation
  try {
    if (fromEntityType === 'ASSET') {
      await tbFetch(state, `/api/asset/${fromEntityId}`);
      console.log('[UpsellModal] Verified asset exists:', fromEntityId);
    } else if (fromEntityType === 'CUSTOMER') {
      await tbFetch(state, `/api/customer/${fromEntityId}`);
      console.log('[UpsellModal] Verified customer exists:', fromEntityId);
    }
  } catch (error) {
    console.error('[UpsellModal] FROM entity does not exist:', fromEntityType, fromEntityId, error);
    throw new Error(
      `${fromEntityType} com ID ${fromEntityId} não foi encontrado. Verifique se a entidade existe no ThingsBoard.`
    );
  }

  // ASSET/CUSTOMER is the FROM (container), DEVICE is the TO (contained)
  const relation = {
    from: { entityType: fromEntityType, id: fromEntityId },
    to: { entityType: 'DEVICE', id: deviceId },
    type: 'Contains',
    typeGroup: 'COMMON',
  };
  console.log('[UpsellModal] Creating relation:', relation);

  try {
    await tbPost(state, '/api/relation', relation);
    console.log('[UpsellModal] Relation created successfully');
  } catch (error) {
    console.error('[UpsellModal] Failed to create relation:', error);
    throw new Error(`Erro ao criar relação: ${(error as Error).message}`);
  }
}

// Delete relation: Entity (FROM) -> DEVICE (TO)
async function deleteRelation(state: ModalState, device: Device, relation: DeviceRelation): Promise<void> {
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
    return profiles.map((p) => ({ id: p.id.id, name: p.name }));
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
    return assets.map((a) => ({ id: a.id.id, name: a.name, type: a.type }));
  } catch (error) {
    console.error('[UpsellModal] Error fetching customer assets:', error);
    return [];
  }
}

// Change device profile (entity level) with retry on 409 conflict
async function changeDeviceProfile(
  state: ModalState,
  device: Device,
  newProfileId: string,
  maxRetries = 3
): Promise<void> {
  const deviceId = getEntityId(device);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get the current device data (fresh on each attempt)
      const deviceData = await tbFetch<{
        id: { id: string; entityType: string };
        name: string;
        type: string;
        label?: string;
        deviceProfileId: { id: string; entityType: string };
        customerId?: { id: string; entityType: string };
        tenantId?: { id: string; entityType: string };
        createdTime?: number;
        additionalInfo?: Record<string, unknown>;
        firmwareId?: { id: string; entityType: string } | null;
        softwareId?: { id: string; entityType: string } | null;
        externalId?: { id: string; entityType: string } | null;
      }>(state, `/api/device/${deviceId}`);

      // Update with new profile
      const updatedDevice = {
        ...deviceData,
        deviceProfileId: { id: newProfileId, entityType: 'DEVICE_PROFILE' },
      };

      console.log(`[UpsellModal] Changing device profile to: ${newProfileId} (attempt ${attempt})`);
      await tbPost(state, '/api/device', updatedDevice);

      // Success - exit the retry loop
      return;
    } catch (error) {
      const errorMessage = (error as Error).message || '';

      // Check if it's a 409 conflict error
      if (errorMessage.includes('409') && attempt < maxRetries) {
        console.warn(`[UpsellModal] 409 Conflict on attempt ${attempt}, retrying...`);
        // Small delay before retry
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        continue;
      }

      // Not a 409 or max retries reached - throw the error
      throw error;
    }
  }
}

// ============================================================================
// LOJAS Functions (RFC-0160)
// ============================================================================

const PROFILE_3F_MEDIDOR_ID = '6b31e2a0-8c02-11f0-a06d-e9509531b1d5';

// ============================================================================
// CUSTOM Mode — Profile IDs & Config
// ============================================================================

const PROFILE_MOTOR_ID                 = '36aad760-9181-11f0-a06d-e9509531b1d5';
const PROFILE_ENERGIA_GERAL_ENTRADA_ID = '5c5b8010-b02e-11f0-9722-210aa9448abc';
const PROFILE_HIDROMETRO_LOJAS_ID      = 'a603a7d0-8b74-11f0-a06d-e9509531b1d5';
const PROFILE_HIDROMETRO_AREA_COMUM_ID = 'b8bb8ac0-9ef5-11f0-afe1-175479a33d89';
const PROFILE_HIDROMETRO_SHOPPING_ID   = '8db30580-9fa7-11f0-afe1-175479a33d89';
const PROFILE_TERMOSTATO_ID            = 'c4268e90-9c85-11f0-afe1-175479a33d89';

const CUSTOM_MODES: Array<{
  id: string;
  label: string;
  profileId: string;
  deviceType: string;
  deviceProfile: string;
}> = [
  { id: 'lojas',            label: 'Lojas',             profileId: PROFILE_3F_MEDIDOR_ID,         deviceType: '3F_MEDIDOR', deviceProfile: '3F_MEDIDOR'           },
  { id: 'motor',            label: 'Motor',             profileId: PROFILE_MOTOR_ID,               deviceType: '3F_MEDIDOR', deviceProfile: 'MOTOR'                },
  { id: 'entrada_energia',  label: 'Entrada Energia',   profileId: PROFILE_ENERGIA_GERAL_ENTRADA_ID, deviceType: '3F_MEDIDOR', deviceProfile: 'ENTRADA'            },
  { id: 'hidrometro_lojas', label: 'Hidrômetro Lojas',  profileId: PROFILE_HIDROMETRO_LOJAS_ID,   deviceType: 'HIDROMETRO', deviceProfile: 'HIDROMETRO'           },
  { id: 'area_comum_water', label: 'Área Comum Água',   profileId: PROFILE_HIDROMETRO_AREA_COMUM_ID, deviceType: 'HIDROMETRO', deviceProfile: 'HIDROMETRO_AREA_COMUM' },
  { id: 'entrada_agua',     label: 'Entrada Água',      profileId: PROFILE_HIDROMETRO_SHOPPING_ID, deviceType: 'HIDROMETRO', deviceProfile: 'HIDROMETRO_SHOPPING' },
  { id: 'temperatura',      label: 'Temperatura',       profileId: PROFILE_TERMOSTATO_ID,          deviceType: 'TERMOSTATO', deviceProfile: 'TERMOSTATO'          },
];

// ============================================================================
// Bulk Force Relation Handler
// ============================================================================

async function handleBatchForceRelation(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  if (!state.selectedCustomer) return;

  const rel = state.bulkRelationModal;
  const devices = state.selectedDevices;
  const customerId = getEntityId(state.selectedCustomer);

  // Determine target entity
  let fromEntityType: 'CUSTOMER' | 'ASSET';
  let fromEntityId: string;
  let fromEntityName: string;

  if (rel.target === 'CUSTOMER') {
    fromEntityType = 'CUSTOMER';
    fromEntityId = customerId;
    fromEntityName = state.selectedCustomer.name || state.selectedCustomer.title || 'Customer';
  } else if (rel.target === 'ASSET_EXISTING') {
    if (!rel.selectedAssetId) return;
    fromEntityType = 'ASSET';
    fromEntityId = rel.selectedAssetId;
    fromEntityName = rel.selectedAssetName;
  } else {
    // ASSET_NEW: create the asset first
    const newAssetName = rel.newAssetName.trim();
    if (!newAssetName) return;
    fromEntityType = 'ASSET';
    fromEntityName = newAssetName;
    try {
      const created = await tbPost<{ id: { id: string } }>(state, '/api/asset', {
        name: newAssetName,
        type: 'default',
        customerId: { entityType: 'CUSTOMER', id: customerId },
      });
      fromEntityId = created.id.id;
    } catch (err) {
      alert(`Erro ao criar asset "${newAssetName}": ${(err as Error).message}`);
      return;
    }
  }

  const confirmMsg =
    `Forçar relação para ${devices.length} dispositivos?\n\n` +
    `Destino: ${fromEntityType} → ${fromEntityName}\n\n` +
    `Todas as relações TO existentes serão removidas e substituídas.\n\nDeseja continuar?`;
  if (!confirm(confirmMsg)) return;

  // Close the sub-modal before showing busy
  state.bulkRelationModal.open = false;
  renderModal(container, state, modalId, t);
  setupEventListeners(container, state, modalId, t, onClose);

  showBusyProgress('Forçando relações em lote...', devices.length);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    const deviceId = getEntityId(device);
    const deviceName = device.label || device.name;

    try {
      updateBusyProgress(i + 1, `[${i + 1}/${devices.length}] ${deviceName}: Buscando relações...`);

      // Fetch existing TO relations
      const relationsResp = await tbFetch<Array<{ from: { id: string; entityType: string }; type: string; typeGroup: string }>>(
        state,
        `/api/relations?toId=${deviceId}&toType=DEVICE&relationTypeGroup=COMMON`
      );
      const existingRelations = Array.isArray(relationsResp) ? relationsResp : [];

      // Delete all existing relations
      if (existingRelations.length > 0) {
        updateBusyProgress(i + 1, `[${i + 1}/${devices.length}] ${deviceName}: Removendo relações...`);
        for (const existing of existingRelations) {
          try {
            const params = new URLSearchParams({
              fromId:            existing.from.id,
              fromType:          existing.from.entityType,
              toId:              deviceId,
              toType:            'DEVICE',
              relationType:      existing.type || 'Contains',
              relationTypeGroup: existing.typeGroup || 'COMMON',
            });
            await tbDelete(state, `/api/relation?${params.toString()}`);
          } catch (e) {
            console.warn('[UpsellModal] Error deleting relation in batch:', e);
          }
        }
      }

      // Create new relation
      updateBusyProgress(i + 1, `[${i + 1}/${devices.length}] ${deviceName}: Criando relação...`);
      await tbPost(state, '/api/relation', {
        from: { entityType: fromEntityType, id: fromEntityId },
        to:   { entityType: 'DEVICE', id: deviceId },
        type: 'Contains',
        typeGroup: 'COMMON',
      });

      successCount++;
    } catch (err) {
      errorCount++;
      errors.push(`${deviceName}: ${(err as Error).message}`);
      console.error(`[UpsellModal] Error forcing relation for ${deviceName}:`, err);
    }

    updateBusyProgress(i + 1);
  }

  hideBusyProgress();

  if (errorCount === 0) {
    alert(`Relações forçadas com sucesso para ${successCount} dispositivos!`);
  } else {
    alert(
      `Relações forçadas para ${successCount} dispositivos.\n` +
        `Erro em ${errorCount} dispositivos:\n${errors.slice(0, 5).join('\n')}` +
        (errors.length > 5 ? `\n... e mais ${errors.length - 5} erros` : '')
    );
  }

  state.selectedDevices = [];
  state.deviceSelectionMode = 'single';
  renderModal(container, state, modalId, t);
  setupEventListeners(container, state, modalId, t, onClose);
}

async function loadLojasData(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  state.lojasDataLoading = true;
  renderModal(container, state, modalId, t);
  setupEventListeners(container, state, modalId, t, onClose);

  const devices = state.selectedDevices;
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 1500;

  showBusyProgress('Carregando dados para LOJAS...', devices.length);

  // Initialize lojasDeviceData from selected devices
  state.lojasDeviceData = devices.map((d) => ({
    deviceId: getEntityId(d),
    name: d.name || '',
    centralId: '',
    slaveId: '',
    label: d.label || d.name || '',
    identifier: '',
    ingestionId: '',
    currentRelations: [],
  }));

  try {
    for (let i = 0; i < devices.length; i += BATCH_SIZE) {
      const batch = devices.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (device, batchIdx) => {
        const deviceId = getEntityId(device);
        const idx = i + batchIdx;

        // Load server-scope attributes
        try {
          const attrs = await tbFetch<Array<{ key: string; value: unknown }>>(
            state,
            `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`
          );
          const attrMap: Record<string, string> = {};
          attrs.forEach((a) => {
            attrMap[a.key] = String(a.value ?? '');
          });

          state.lojasDeviceData[idx].centralId = attrMap.centralId || '';
          state.lojasDeviceData[idx].slaveId = attrMap.slaveId || '';
          state.lojasDeviceData[idx].identifier = attrMap.identifier || '';
          state.lojasDeviceData[idx].ingestionId = attrMap.ingestionId || '';
          // Use existing label from device, fallback to name
          if (!state.lojasDeviceData[idx].label) {
            state.lojasDeviceData[idx].label = device.name || '';
          }
        } catch (e) {
          console.warn('[UpsellModal] Error loading attrs for LOJAS:', deviceId, e);
        }

        // Load existing relations (device is TO = contained by something)
        try {
          const relations = await tbFetch<
            Array<{
              from: { entityType: string; id: string };
              to: { entityType: string; id: string };
              type: string;
              typeGroup: string;
            }>
          >(state, `/api/relations?toId=${deviceId}&toType=DEVICE&relationTypeGroup=COMMON`);
          state.lojasDeviceData[idx].currentRelations = relations;
        } catch (e) {
          console.warn('[UpsellModal] Error loading relations for LOJAS:', deviceId, e);
        }
      });

      await Promise.all(promises);
      updateBusyProgress(Math.min(i + BATCH_SIZE, devices.length));

      if (i + BATCH_SIZE < devices.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    hideBusyProgress();
    state.lojasDataLoading = false;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  } catch (error) {
    console.error('[UpsellModal] Error loading LOJAS data:', error);
    hideBusyProgress();
    state.lojasDataLoading = false;
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  }
}

async function handleLojasSyncIngestion(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  if (!state.selectedCustomer) return;

  // Read current input values before sync
  for (let i = 0; i < state.lojasDeviceData.length; i++) {
    const labelInput = document.getElementById(`${modalId}-lojas-label-${i}`) as HTMLInputElement;
    const identifierInput = document.getElementById(`${modalId}-lojas-identifier-${i}`) as HTMLInputElement;
    if (labelInput) state.lojasDeviceData[i].label = labelInput.value;
    if (identifierInput) state.lojasDeviceData[i].identifier = identifierInput.value;
  }

  const customerId = getEntityId(state.selectedCustomer);

  try {
    // Get customer's ingestionId attribute
    const customerAttrs = await tbFetch<Array<{ key: string; value: unknown }>>(
      state,
      `/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE`
    );
    const ingestionCustomerIdAttr = customerAttrs.find((a) => a.key === 'ingestionId');
    const ingestionCustomerId = ingestionCustomerIdAttr?.value as string;

    if (!ingestionCustomerId) {
      alert('Customer não tem atributo ingestionId configurado. Configure primeiro no ThingsBoard.');
      return;
    }

    console.log('[UpsellModal] LOJAS sync - Customer ingestionId:', ingestionCustomerId);

    // Fetch all ingestion devices (uses 5-minute cache)
    showBusyProgress('Sincronizando ingestion...', state.lojasDeviceData.length);
    const ingestionDevices = await fetchIngestionDevicesAllPaged(ingestionCustomerId);
    console.log('[UpsellModal] LOJAS sync - Fetched', ingestionDevices.length, 'ingestion devices');

    let matchCount = 0;
    for (let i = 0; i < state.lojasDeviceData.length; i++) {
      const d = state.lojasDeviceData[i];
      if (d.centralId && d.slaveId) {
        const match = findIngestionDeviceByCentralSlaveId(ingestionDevices, d.centralId, d.slaveId);
        if (match) {
          d.ingestionId = match.id;
          matchCount++;
        }
      }
      updateBusyProgress(i + 1);
    }

    hideBusyProgress();
    alert(`Sync concluído! ${matchCount}/${state.lojasDeviceData.length} dispositivos sincronizados.`);
    renderModal(container, state, modalId, t);
    setupEventListeners(container, state, modalId, t, onClose);
  } catch (error) {
    hideBusyProgress();
    console.error('[UpsellModal] Error syncing LOJAS ingestion:', error);
    alert('Erro ao sincronizar ingestion: ' + (error as Error).message);
  }
}

async function handleLojasApply(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  if (!state.selectedCustomer) return;

  const customerId = getEntityId(state.selectedCustomer);
  const data = state.lojasDeviceData;
  if (data.length === 0) return;

  // Read current values from inputs
  for (let i = 0; i < data.length; i++) {
    const labelInput = document.getElementById(`${modalId}-lojas-label-${i}`) as HTMLInputElement;
    const identifierInput = document.getElementById(`${modalId}-lojas-identifier-${i}`) as HTMLInputElement;
    if (labelInput) data[i].label = labelInput.value;
    if (identifierInput) data[i].identifier = identifierInput.value;
  }

  const activeConfig = state.lojasConfig ?? CUSTOM_MODES[0];
  const confirmMsg =
    `Aplicar configuração "${activeConfig.label}" para ${data.length} dispositivos?\n\n` +
    `Cada device receberá:\n` +
    `- Label atualizado (etiqueta)\n` +
    `- Profile: ${activeConfig.deviceProfile}\n` +
    `- deviceType/deviceProfile: ${activeConfig.deviceType} / ${activeConfig.deviceProfile}\n` +
    `- Relações existentes removidas\n` +
    `- Nova relação: Customer → Device (Contains)\n\n` +
    `Deseja continuar?`;
  if (!confirm(confirmMsg)) return;

  showBusyProgress(`Aplicando ${activeConfig.label}...`, data.length);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const device = state.selectedDevices.find((dev) => getEntityId(dev) === d.deviceId);
    if (!device) continue;

    try {
      // Step A: Update device label
      updateBusyProgress(i + 1, `[${i + 1}/${data.length}] ${d.name}: Atualizando label...`);
      const deviceData = await tbFetch<Record<string, unknown>>(state, `/api/device/${d.deviceId}`);
      deviceData.label = d.label;
      await tbPost(state, '/api/device', deviceData);

      // Step B: Force device profile
      updateBusyProgress(i + 1, `[${i + 1}/${data.length}] ${d.name}: Alterando profile...`);
      await changeDeviceProfile(state, device, activeConfig.profileId);

      // Step C: Set server-scope attributes
      updateBusyProgress(i + 1, `[${i + 1}/${data.length}] ${d.name}: Salvando atributos...`);
      const attrs: Record<string, string> = {
        deviceType: activeConfig.deviceType,
        deviceProfile: activeConfig.deviceProfile,
        identifier: d.identifier,
      };
      if (d.ingestionId) {
        attrs.ingestionId = d.ingestionId;
      }
      await tbPost(state, `/api/plugins/telemetry/DEVICE/${d.deviceId}/attributes/SERVER_SCOPE`, attrs);

      // Step D: Delete existing relations (device is TO)
      if (d.currentRelations.length > 0) {
        updateBusyProgress(i + 1, `[${i + 1}/${data.length}] ${d.name}: Removendo relações...`);
        for (const rel of d.currentRelations) {
          try {
            const params = new URLSearchParams({
              fromId: rel.from.id,
              fromType: rel.from.entityType,
              toId: d.deviceId,
              toType: 'DEVICE',
              relationType: rel.type || 'Contains',
              relationTypeGroup: rel.typeGroup || 'COMMON',
            });
            await tbDelete(state, `/api/relation?${params.toString()}`);
          } catch (e) {
            console.warn('[UpsellModal] Error deleting relation for LOJAS:', e);
          }
        }
      }

      // Step E: Create customer relation
      updateBusyProgress(i + 1, `[${i + 1}/${data.length}] ${d.name}: Criando relação...`);
      await tbPost(state, '/api/relation', {
        from: { entityType: 'CUSTOMER', id: customerId },
        to: { entityType: 'DEVICE', id: d.deviceId },
        type: 'Contains',
        typeGroup: 'COMMON',
      });

      successCount++;
    } catch (error) {
      errorCount++;
      errors.push(`${d.name}: ${(error as Error).message}`);
      console.error(`[UpsellModal] Error applying LOJAS for ${d.name}:`, error);
    }

    updateBusyProgress(i + 1);
  }

  hideBusyProgress();

  if (errorCount === 0) {
    alert(`"${activeConfig.label}" aplicado com sucesso para ${successCount} dispositivos!`);
  } else {
    alert(
      `"${activeConfig.label}" aplicado para ${successCount} dispositivos.\n` +
        `Erro em ${errorCount} dispositivos:\n${errors.slice(0, 5).join('\n')}` +
        (errors.length > 5 ? `\n... e mais ${errors.length - 5} erros` : '')
    );
  }

  // Return to Step 2
  state.lojasMode = false;
  state.lojasConfig = null;
  state.currentStep = 2;
  state.selectedDevices = [];
  renderModal(container, state, modalId, t);
  setupEventListeners(container, state, modalId, t, onClose);
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
    state.customers.forEach((c) => {
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

  const deviceIds = devicesToLoad.map((d) => getEntityId(d));
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
        const device = state.devices.find((d) => getEntityId(d) === deviceId);
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
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
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

  const deviceIds = devicesToLoad.map((d) => getEntityId(d));
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
        const device = state.devices.find((d) => getEntityId(d) === deviceId);
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
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
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
    attrs.forEach((a) => {
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
      const fromEntityType = rel.from.entityType as 'ASSET' | 'CUSTOMER' | 'DEVICE';
      const fromEntityId = rel.from.id;

      // Fetch entity name
      let entityName = '';
      try {
        if (fromEntityType === 'ASSET') {
          const asset = await tbFetch<{ name: string }>(state, `/api/asset/${fromEntityId}`);
          entityName = asset.name;
        } else if (fromEntityType === 'CUSTOMER') {
          const customer = await tbFetch<{ name?: string; title?: string }>(
            state,
            `/api/customer/${fromEntityId}`
          );
          entityName = customer.name || customer.title || '';
        } else if (fromEntityType === 'DEVICE') {
          const device = await tbFetch<{ name: string }>(state, `/api/device/${fromEntityId}`);
          entityName = device.name;
        }
      } catch (e) {
        console.warn('[UpsellModal] Could not fetch entity name:', e);
      }

      state.deviceRelation = {
        toEntityType: fromEntityType,
        toEntityId: fromEntityId,
        toEntityName: entityName,
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
  fields.forEach((field) => {
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

/**
 * Save device profile (entity level) to multiple devices in bulk
 */
async function saveBulkProfile(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  const { selectedProfileId } = state.bulkProfileModal;
  const devices = state.selectedDevices;

  if (!selectedProfileId) {
    alert('Por favor, selecione um Device Profile.');
    return;
  }

  if (devices.length === 0) {
    alert('Nenhum dispositivo selecionado.');
    return;
  }

  // Get profile name for display
  const profile = state.deviceProfiles.find((p) => p.id === selectedProfileId);
  const profileName = profile?.name || selectedProfileId;

  // Update modal state to show saving
  state.bulkProfileModal.saving = true;
  renderModal(container, state, modalId, t);

  // Show progress modal
  showBusyProgress(`Alterando Device Profile para "${profileName}"...`, devices.length);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Change profile for each device
  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];

    try {
      await changeDeviceProfile(state, device, selectedProfileId);
      successCount++;

      // Update device in local state
      device.type = profileName;
      device.deviceProfileId = { entityType: 'DEVICE_PROFILE', id: selectedProfileId };
    } catch (error) {
      errorCount++;
      errors.push(`${device.name}: ${(error as Error).message}`);
      console.error(`[UpsellModal] Error changing profile for device ${device.name}:`, error);
    }

    // Update progress modal
    updateBusyProgress(i + 1);
  }

  // Hide progress modal
  hideBusyProgress();

  // Reset modal state
  state.bulkProfileModal.saving = false;
  state.bulkProfileModal.open = false;
  state.bulkProfileModal.selectedProfileId = '';

  // Show result message
  if (errorCount === 0) {
    alert(`Device Profile alterado para "${profileName}" em ${successCount} dispositivos!`);
  } else {
    alert(
      `Profile alterado para ${successCount} dispositivos.\n` +
        `Erro em ${errorCount} dispositivos:\n${errors.slice(0, 5).join('\n')}` +
        (errors.length > 5 ? `\n... e mais ${errors.length - 5} erros` : '')
    );
  }

  // Clear selection and re-render
  state.selectedDevices = [];
  renderModal(container, state, modalId, t);
}

/**
 * Save owner (customer) to multiple devices in bulk
 */
async function saveBulkOwner(
  state: ModalState,
  container: HTMLElement,
  modalId: string,
  t: typeof i18n.pt,
  onClose?: () => void
): Promise<void> {
  const devices = state.selectedDevices;
  const newCustomerId = state.selectedCustomer?.id?.id;
  const customerName = state.selectedCustomer?.name || state.selectedCustomer?.title || 'Unknown';

  if (!newCustomerId) {
    alert('Por favor, selecione um Customer no Step 1 primeiro.');
    return;
  }

  if (devices.length === 0) {
    alert('Nenhum dispositivo selecionado.');
    return;
  }

  // Update modal state to show saving
  state.bulkOwnerModal.saving = true;
  renderModal(container, state, modalId, t);

  // Show progress modal
  showBusyProgress(`Atribuindo Owner "${customerName}"...`, devices.length);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Change owner for each device
  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];

    try {
      await changeDeviceOwner(state, device, newCustomerId);
      successCount++;

      // Update device in local state
      device.customerId = { entityType: 'CUSTOMER', id: newCustomerId };
    } catch (error) {
      errorCount++;
      errors.push(`${device.name}: ${(error as Error).message}`);
      console.error(`[UpsellModal] Error changing owner for device ${device.name}:`, error);
    }

    // Update progress modal
    updateBusyProgress(i + 1);
  }

  // Hide progress modal
  hideBusyProgress();

  // Reset modal state
  state.bulkOwnerModal.saving = false;
  state.bulkOwnerModal.open = false;

  // Show result message
  if (errorCount === 0) {
    alert(`Owner alterado para "${customerName}" em ${successCount} dispositivos!`);
  } else {
    alert(
      `Owner alterado para ${successCount} dispositivos.\n` +
        `Erro em ${errorCount} dispositivos:\n${errors.slice(0, 5).join('\n')}` +
        (errors.length > 5 ? `\n... e mais ${errors.length - 5} erros` : '')
    );
  }

  // Clear selection and re-render
  state.selectedDevices = [];
  renderModal(container, state, modalId, t);
}
