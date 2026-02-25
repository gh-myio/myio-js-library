/**
 * RFC-0145: TelemetryGridShopping Component Types
 * Shopping-style grid for device cards with filters and search
 */

// ============================================
// DOMAIN AND CONTEXT TYPES
// ============================================

export type TelemetryDomain = 'energy' | 'water' | 'temperature';

export type TelemetryContext =
  // Energy contexts
  | 'stores'
  | 'equipments'
  | 'entrada'
  // Water contexts
  | 'hidrometro'
  | 'hidrometro_area_comum'
  | 'hidrometro_entrada'
  // Temperature contexts
  | 'termostato'
  | 'termostato_external';

export type ThemeMode = 'dark' | 'light';

export type SortMode =
  | 'cons_desc'
  | 'cons_asc'
  | 'alpha_asc'
  | 'alpha_desc';

// ============================================
// DEVICE INTERFACE
// ============================================

export interface TelemetryDevice {
  // Core identifiers
  entityId: string;
  ingestionId: string;
  labelOrName: string;
  name?: string;
  deviceIdentifier: string;

  // Device classification
  deviceType: string;
  deviceProfile: string;
  deviceStatus: string;
  connectionStatus: string;

  // Customer/Owner info
  customerId: string;
  customerName?: string;
  centralName?: string;
  ownerName?: string;

  // Value fields
  val: number | null;
  perc?: number;
  unit?: string;

  // Timestamps
  lastConnectTime?: number;
  lastActivityTime?: number;
  lastDisconnectTime?: number;

  // GCDR / connection identifiers (RFC-0180)
  gcdrDeviceId?: string;
  centralId?: string;
  slaveId?: string;
  floor?: string;
  identifier?: string;

  // Additional metadata
  domain?: TelemetryDomain;
  log_annotations?: Record<string, unknown>;
}

// ============================================
// FILTER STATE
// ============================================

export interface FilterState {
  searchTerm: string;
  sortMode: SortMode;
  selectedDeviceIds: string[];
  statusFilter: 'all' | 'online' | 'offline' | 'not_installed';
  consumptionFilter: 'all' | 'with' | 'without';
}

// ============================================
// STATS
// ============================================

export interface TelemetryStats {
  total: number;
  online: number;
  offline: number;
  notInstalled: number;
  noInfo: number;
  withConsumption: number;
  noConsumption: number;
  totalConsumption: number;
  filteredCount: number;
  unit: string;
}

// ============================================
// CALLBACK TYPES
// ============================================

export type CardAction = 'dashboard' | 'report' | 'settings';

export type OnCardActionCallback = (
  action: CardAction,
  device: TelemetryDevice
) => void;

export type OnStatsUpdateCallback = (stats: TelemetryStats) => void;

export type OnFilterChangeCallback = (filterState: FilterState) => void;

export type OnSearchChangeCallback = (searchTerm: string) => void;

// ============================================
// COMPONENT PARAMS
// ============================================

export interface TelemetryGridShoppingParams {
  // Required
  container: HTMLElement;
  domain: TelemetryDomain;
  context: TelemetryContext;

  // Data source
  devices?: TelemetryDevice[];

  // Display
  labelWidget?: string;
  themeMode?: ThemeMode;
  debugActive?: boolean;

  // Card options
  enableSelection?: boolean;
  enableDragDrop?: boolean;

  // Callbacks
  onCardAction?: OnCardActionCallback;
  onStatsUpdate?: OnStatsUpdateCallback;
  onFilterChange?: OnFilterChangeCallback;
  onSearchChange?: OnSearchChangeCallback;
}

// ============================================
// COMPONENT INSTANCE
// ============================================

export interface TelemetryGridShoppingInstance {
  element: HTMLElement;

  // Data methods
  updateDevices: (devices: TelemetryDevice[]) => void;
  getDevices: () => TelemetryDevice[];
  getFilteredDevices: () => TelemetryDevice[];

  // Config methods
  updateConfig: (config: Partial<{
    domain: TelemetryDomain;
    context: TelemetryContext;
    labelWidget: string;
  }>) => void;
  getDomain: () => TelemetryDomain;
  getContext: () => TelemetryContext;

  // Theme methods
  setThemeMode: (mode: ThemeMode) => void;
  getThemeMode: () => ThemeMode;

  // Filter methods
  applyShoppingFilter: (shoppingIds: string[]) => void;
  setSearchTerm: (term: string) => void;
  setSortMode: (mode: SortMode) => void;
  clearFilters: () => void;
  getFilterState: () => FilterState;

  // Stats
  getStats: () => TelemetryStats;

  // Actions
  refresh: () => void;
  openFilterModal: () => void;
  closeFilterModal: () => void;
  showLoading: (show: boolean, message?: string) => void;

  // Lifecycle
  destroy: () => void;
}

// ============================================
// DOMAIN CONFIGURATION
// ============================================

export interface DomainConfig {
  unit: string;
  formatValue: (val: number | null) => string;
  headerLabel: string;
  color: string;
}

export const DOMAIN_CONFIG: Record<TelemetryDomain, DomainConfig> = {
  energy: {
    unit: 'kWh',
    formatValue: (val) => {
      if (val == null || isNaN(val)) return '0,00';
      const num = Number(val);
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    headerLabel: 'Consumo Total',
    color: '#3e1a7d',
  },
  water: {
    unit: 'm³',
    formatValue: (val) => {
      if (val == null || isNaN(val)) return '0,000';
      const num = Number(val);
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    },
    headerLabel: 'Volume Total',
    color: '#0ea5e9',
  },
  temperature: {
    unit: '°C',
    formatValue: (val) => {
      if (val == null || isNaN(val)) return '-';
      return `${Number(val).toFixed(1)}`;
    },
    headerLabel: 'Temperatura',
    color: '#f43f5e',
  },
};

// ============================================
// CONTEXT CONFIGURATION
// ============================================

export interface ContextConfig {
  headerLabel: string;
  icon: string;
}

export const CONTEXT_CONFIG: Record<TelemetryContext, ContextConfig> = {
  // Energy
  stores: { headerLabel: 'Lojas', icon: '🏪' },
  equipments: { headerLabel: 'Equipamentos', icon: '⚙️' },
  entrada: { headerLabel: 'Entrada', icon: '📥' },
  // Water
  hidrometro: { headerLabel: 'Hidrômetros Lojas', icon: '🏪' },
  hidrometro_area_comum: { headerLabel: 'Hidrômetros Área Comum', icon: '🏢' },
  hidrometro_entrada: { headerLabel: 'Hidrômetro Entrada', icon: '📥' },
  // Temperature
  termostato: { headerLabel: 'Termostatos', icon: '🌡️' },
  termostato_external: { headerLabel: 'Termostatos Externos', icon: '🌡️' },
};

// ============================================
// STATUS CLASSIFICATION
// ============================================

export const ONLINE_STATUSES = ['power_on', 'online', 'normal', 'ok', 'running', 'active'];
export const OFFLINE_STATUSES = ['offline', 'no_info'];
export const WAITING_STATUSES = ['waiting', 'aguardando', 'not_installed', 'pending', 'connecting'];

export function getDeviceStatusCategory(status: string): 'online' | 'offline' | 'waiting' | 'unknown' {
  const s = (status || '').toLowerCase();
  if (ONLINE_STATUSES.includes(s)) return 'online';
  if (OFFLINE_STATUSES.includes(s)) return 'offline';
  if (WAITING_STATUSES.includes(s)) return 'waiting';
  return 'unknown';
}
