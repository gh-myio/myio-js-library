/**
 * RFC-0121: TelemetryGrid Component Types
 * Defines all interfaces for the TelemetryGrid component
 */

// ============================================
// DOMAIN AND CONTEXT TYPES
// ============================================

export type TelemetryDomain = 'energy' | 'water' | 'temperature';

export type TelemetryContext =
  // Energy contexts
  | 'equipments'
  | 'stores'
  // Water contexts
  | 'hidrometro'
  | 'hidrometro_area_comum'
  // Temperature contexts
  | 'termostato'
  | 'termostato_external'
  // Legacy contexts (for backward compatibility)
  | 'entry'
  | 'common_area'
  | 'head_office'
  | 'with_climate_control'
  | 'without_climate_control';

export type ThemeMode = 'dark' | 'light';

export type SortMode =
  | 'cons_desc'
  | 'cons_asc'
  | 'alpha_asc'
  | 'alpha_desc'
  | 'status_asc'
  | 'status_desc'
  | 'shopping_asc'
  | 'shopping_desc';

// ============================================
// DEVICE INTERFACES
// ============================================

export interface TelemetryDevice {
  // Core identifiers
  entityId: string;
  ingestionId: string;
  labelOrName: string;
  deviceIdentifier: string;

  // Device classification
  deviceType: string;
  deviceProfile: string;
  deviceStatus: string;
  connectionStatus: string;

  // Customer/Owner info
  customerId: string;
  customerName?: string;
  centralName: string;
  ownerName: string;

  // Value fields
  val: number | null;
  value: number | null;
  lastValue?: number | null;
  consumption?: number;
  consumption_power?: number;
  pulses?: number;
  temperature?: number;
  temperatureC?: number | null;
  currentTemperature?: number | null;
  instantaneousPower?: number | null;
  operationHours?: string;

  // Card rendering metadata
  valType?: 'energy' | 'water' | 'temperature';
  unit?: string;
  icon?: string;

  // Timestamps
  lastConnectTime?: number;
  lastActivityTime?: number;
  lastDisconnectTime?: number;
  consumptionTs?: number;
  pulsesTs?: number;
  waterVolumeTs?: number;
  temperatureTs?: number;

  // Additional metadata
  aliasName?: string;
  domain?: TelemetryDomain;
  mapInstantaneousPower?: string;
}

// ============================================
// FILTER STATE
// ============================================

export interface FilterState {
  searchTerm: string;
  selectedShoppingIds: string[];
  selectedDeviceIds: Set<string> | null;
  sortMode: SortMode;
  statusFilter: string | null;
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
}

// ============================================
// DOMAIN CONFIGURATION
// ============================================

export interface DomainConfig {
  unit: string;
  unitInstant: string;
  formatValue: (val: number | null) => string;
  formatInstant: (val: number | null) => string;
  telemetryTimestampField: string;
  telemetryTimestampFieldAlt?: string;
  valueField: string;
  cacheKey: string;
  eventReady: string;
  loadingText: string;
  headerLabel: string;
  icon: string;
  delayMins: number;
}

export interface ContextConfig {
  headerLabel: string;
  idPrefix: string;
  widgetName: string;
  filterChipIcon: string;
}

// ============================================
// CONFIG TEMPLATE (from ThingsBoard settings)
// ============================================

export interface TelemetryConfigTemplate {
  // Debug options
  enableDebugMode?: boolean;
  activeTooltipDebug?: boolean;

  // Theme colors
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;

  // Card colors
  cardEquipamentosBackgroundColor?: string;
  cardEquipamentosFontColor?: string;
  cardEnergiaBackgroundColor?: string;
  cardEnergiaFontColor?: string;
  cardTemperaturaBackgroundColor?: string;
  cardTemperaturaFontColor?: string;
  cardAguaBackgroundColor?: string;
  cardAguaFontColor?: string;

  // Header settings
  headerBackgroundColor?: string;
  headerTextColor?: string;

  // Footer settings
  footerBackgroundColor?: string;
  footerTextColor?: string;

  // Additional settings
  [key: string]: unknown;
}

// ============================================
// SHOPPING
// ============================================

export interface Shopping {
  value: string;
  name: string;
  customerId?: string;
}

// ============================================
// CALLBACK TYPES
// ============================================

export type CardAction = 'dashboard' | 'report' | 'settings';

export type OnCardClickCallback = (device: TelemetryDevice) => void;

export type OnCardActionCallback = (
  action: CardAction,
  device: TelemetryDevice
) => void;

export type OnDeviceSelectCallback = (
  deviceId: string,
  selected: boolean,
  device: TelemetryDevice
) => void;

export type OnFilterChangeCallback = (filters: FilterState) => void;

export type OnStatsUpdateCallback = (stats: TelemetryStats) => void;

export type OnContextChangeCallback = (
  domain: TelemetryDomain,
  context: TelemetryContext
) => void;

// ============================================
// COMPONENT PARAMS
// ============================================

export interface TelemetryGridParams {
  // Required
  container: HTMLElement;
  domain: TelemetryDomain;
  context: TelemetryContext;

  // Data source
  devices: TelemetryDevice[];

  // Theme
  themeMode?: ThemeMode;

  // Options
  useNewComponents?: boolean;
  enableSelection?: boolean;
  enableDragDrop?: boolean;
  hideInfoMenuItem?: boolean;
  debugActive?: boolean;
  activeTooltipDebug?: boolean;

  // Include controls
  includeSearch?: boolean;
  includeFilter?: boolean;
  includeShoppingChips?: boolean;

  // Callbacks
  onCardClick?: OnCardClickCallback;
  onCardAction?: OnCardActionCallback;
  onDeviceSelect?: OnDeviceSelectCallback;
  onFilterChange?: OnFilterChangeCallback;
  onStatsUpdate?: OnStatsUpdateCallback;

  // Config template (from ThingsBoard settings)
  configTemplate?: TelemetryConfigTemplate;

  // External dependencies
  buildHeaderDevicesGrid?: (config: HeaderGridConfig) => HeaderController | null;
  createFilterModal?: (config: FilterModalConfig) => FilterModalController | null;

  // Auth and API
  clientId?: string;
  clientSecret?: string;
  getIngestionToken?: () => Promise<string>;
  getDataApiHost?: () => string;
}

// ============================================
// COMPONENT INSTANCE
// ============================================

export interface TelemetryGridInstance {
  element: HTMLElement;

  // Data methods
  updateDevices: (devices: TelemetryDevice[]) => void;
  getDevices: () => TelemetryDevice[];
  getFilteredDevices: () => TelemetryDevice[];

  // Config methods
  updateConfig: (domain: TelemetryDomain, context: TelemetryContext) => void;
  getDomain: () => TelemetryDomain;
  getContext: () => TelemetryContext;

  // Theme methods
  setThemeMode: (mode: ThemeMode) => void;
  getThemeMode: () => ThemeMode;

  // Filter methods
  applyFilter: (shoppingIds: string[]) => void;
  setSearchTerm: (term: string) => void;
  setSortMode: (mode: SortMode) => void;
  clearFilters: () => void;

  // Stats
  getStats: () => TelemetryStats;

  // Actions
  refresh: () => void;
  openFilterModal: () => void;
  closeFilterModal: () => void;

  // Lifecycle
  destroy: () => void;
}

// ============================================
// HEADER GRID TYPES (from buildHeaderDevicesGrid)
// ============================================

export interface HeaderGridConfig {
  container: string | HTMLElement;
  domain: TelemetryDomain;
  idPrefix: string;
  themeMode?: ThemeMode;
  labels: {
    total: string;
    consumption: string;
  };
  includeSearch?: boolean;
  includeFilter?: boolean;
  onSearchClick?: () => void;
  onFilterClick?: () => void;
}

export interface HeaderController {
  updateFromDevices: (
    devices: TelemetryDevice[],
    options?: Record<string, unknown>
  ) => void;
  getSearchInput: () => HTMLInputElement | null;
  setDomain?: (domain: TelemetryDomain) => void;
  destroy?: () => void;
}

// ============================================
// FILTER MODAL TYPES (from createFilterModal)
// ============================================

export interface FilterTab {
  id: string;
  label: string;
  filter: (device: TelemetryDevice) => boolean;
}

export interface SortOption {
  id: SortMode;
  label: string;
  icon: string;
}

export interface AppliedFilters {
  selectedIds: Set<string> | null;
  sortMode: SortMode;
  statusFilter?: string;
  consumptionFilter?: string;
}

export interface FilterModalConfig {
  widgetName: string;
  containerId: string;
  modalClass: string;
  primaryColor: string;
  itemIdAttr: string;
  themeMode?: ThemeMode;
  filterTabs: FilterTab[];
  getItemId?: (item: TelemetryDevice) => string;
  getItemLabel?: (item: TelemetryDevice) => string;
  getItemValue?: (item: TelemetryDevice) => number;
  getItemSubLabel?: (item: TelemetryDevice) => string;
  formatValue?: (val: number) => string;
  onApply?: (filters: AppliedFilters) => void;
  onClose?: () => void;
}

export interface FilterModalController {
  open: (devices: TelemetryDevice[]) => void;
  close: () => void;
  destroy?: () => void;
}

// ============================================
// VIEW EVENTS
// ============================================

export type TelemetryGridEventType =
  | 'search-change'
  | 'filter-click'
  | 'sort-change'
  | 'cards-rendered'
  | 'device-click'
  | 'device-action';

export type TelemetryGridEventHandler = (...args: unknown[]) => void;

// ============================================
// CONSTANTS
// ============================================

export const DOMAIN_CONFIG: Record<TelemetryDomain, DomainConfig> = {
  energy: {
    unit: 'kWh',
    unitInstant: 'kW',
    formatValue: (val) => {
      if (val == null || isNaN(val)) return '-';
      const num = Number(val);
      if (num >= 1000000) return `${(num / 1000000).toFixed(2)} GWh`;
      if (num >= 1000) return `${(num / 1000).toFixed(2)} MWh`;
      return `${num.toFixed(2)} kWh`;
    },
    formatInstant: (val) => {
      if (val == null || isNaN(val)) return '-';
      const num = Number(val);
      if (num >= 1000) return `${(num / 1000).toFixed(2)} MW`;
      return `${num.toFixed(2)} kW`;
    },
    telemetryTimestampField: 'consumptionTs',
    valueField: 'consumption_power',
    cacheKey: 'energy',
    eventReady: 'myio:energy-data-ready',
    loadingText: 'Carregando dados de energia...',
    headerLabel: 'Consumo Total',
    icon: 'energy',
    delayMins: 1440,
  },
  water: {
    unit: 'm³',
    unitInstant: 'L',
    formatValue: (val) => {
      if (val == null || isNaN(val)) return '-';
      const num = Number(val);
      const m3 = num / 1000;
      if (m3 >= 1000) return `${(m3 / 1000).toFixed(2)} dam³`;
      return `${m3.toFixed(3)} m³`;
    },
    formatInstant: (val) => {
      if (val == null || isNaN(val)) return '-';
      return `${Number(val).toFixed(0)} L`;
    },
    telemetryTimestampField: 'pulsesTs',
    telemetryTimestampFieldAlt: 'waterVolumeTs',
    valueField: 'pulses',
    cacheKey: 'water',
    eventReady: 'myio:water-tb-data-ready',
    loadingText: 'Carregando dados de agua...',
    headerLabel: 'Volume Total',
    icon: 'water',
    delayMins: 1440,
  },
  temperature: {
    unit: '°C',
    unitInstant: '°C',
    formatValue: (val) => {
      if (val == null || isNaN(val)) return '-';
      return `${Number(val).toFixed(1)}°C`;
    },
    formatInstant: (val) => {
      if (val == null || isNaN(val)) return '-';
      return `${Number(val).toFixed(1)}°C`;
    },
    telemetryTimestampField: 'temperatureTs',
    valueField: 'temperature',
    cacheKey: 'temperature',
    eventReady: 'myio:temperature-data-ready',
    loadingText: 'Carregando dados de temperatura...',
    headerLabel: 'Temperatura Media',
    icon: 'temperature',
    delayMins: 60,
  },
};

export const CONTEXT_CONFIG: Record<TelemetryContext, ContextConfig> = {
  // Energy contexts
  equipments: {
    headerLabel: 'Total de Equipamentos',
    idPrefix: 'equipments',
    widgetName: 'TELEMETRY_EQUIPMENTS',
    filterChipIcon: '⚡',
  },
  stores: {
    headerLabel: 'Total de Lojas',
    idPrefix: 'stores',
    widgetName: 'TELEMETRY_STORES',
    filterChipIcon: '🏪',
  },
  // Water contexts
  hidrometro_area_comum: {
    headerLabel: 'Total Area Comum',
    idPrefix: 'hidrometro_area_comum',
    widgetName: 'TELEMETRY_WATER_COMMON_AREA',
    filterChipIcon: '🏢',
  },
  hidrometro: {
    headerLabel: 'Total de Lojas',
    idPrefix: 'hidrometro',
    widgetName: 'TELEMETRY_WATER_STORES',
    filterChipIcon: '🏪',
  },
  // Temperature contexts
  termostato: {
    headerLabel: 'Ambientes Climatizaveis',
    idPrefix: 'termostato',
    widgetName: 'TELEMETRY_TEMP_CLIMATIZED',
    filterChipIcon: '❄️',
  },
  termostato_external: {
    headerLabel: 'Ambientes Nao Climatizaveis',
    idPrefix: 'termostato_external',
    widgetName: 'TELEMETRY_TEMP_NOT_CLIMATIZED',
    filterChipIcon: '🌡️',
  },
  // Legacy contexts
  entry: {
    headerLabel: 'Total de Equipamentos',
    idPrefix: 'entry',
    widgetName: 'TELEMETRY_ENTRY',
    filterChipIcon: '⚙️',
  },
  common_area: {
    headerLabel: 'Total Area Comum',
    idPrefix: 'common',
    widgetName: 'TELEMETRY_COMMON_AREA',
    filterChipIcon: '🏢',
  },
  head_office: {
    headerLabel: 'Total Sede/Matriz',
    idPrefix: 'head_office',
    widgetName: 'TELEMETRY_HEAD_OFFICE',
    filterChipIcon: '🏬',
  },
  with_climate_control: {
    headerLabel: 'Sensores c/ Climatizacao',
    idPrefix: 'temp_climate',
    widgetName: 'TELEMETRY_TEMP_WITH_CLIMATE',
    filterChipIcon: '❄️',
  },
  without_climate_control: {
    headerLabel: 'Sensores s/ Climatizacao',
    idPrefix: 'temp_no_climate',
    widgetName: 'TELEMETRY_TEMP_WITHOUT_CLIMATE',
    filterChipIcon: '🌡️',
  },
};

/**
 * Map legacy context names to orchestrator context names
 */
export function mapContextToOrchestrator(
  context: TelemetryContext,
  _domain: TelemetryDomain
): TelemetryContext {
  const contextMap: Partial<Record<TelemetryContext, TelemetryContext>> = {
    head_office: 'equipments',
    entry: 'equipments',
    common_area: 'equipments',
    with_climate_control: 'termostato',
    without_climate_control: 'termostato_external',
  };
  return contextMap[context] || context;
}

/**
 * Default filter tabs for the filter modal
 */
export const DEFAULT_FILTER_TABS: FilterTab[] = [
  { id: 'all', label: 'Todos', filter: () => true },
  { id: 'online', label: 'Online', filter: (d) => d.deviceStatus === 'power_on' },
  { id: 'offline', label: 'Offline', filter: (d) => d.deviceStatus === 'offline' },
  {
    id: 'notInstalled',
    label: 'Nao Instalado',
    filter: (d) => d.deviceStatus === 'not_installed',
  },
  {
    id: 'withConsumption',
    label: 'Com Consumo',
    filter: (d) => {
      const consumption = Number(d.val) || Number(d.value) || 0;
      return consumption > 0;
    },
  },
  {
    id: 'noConsumption',
    label: 'Sem Consumo',
    filter: (d) => {
      const consumption = Number(d.val) || Number(d.value) || 0;
      return consumption === 0;
    },
  },
];

/**
 * Get sort options for a domain
 */
export function getSortOptions(domain: TelemetryDomain): SortOption[] {
  const config = DOMAIN_CONFIG[domain];
  return [
    { id: 'cons_desc', label: `${config.headerLabel} (maior)`, icon: '↓' },
    { id: 'cons_asc', label: `${config.headerLabel} (menor)`, icon: '↑' },
    { id: 'alpha_asc', label: 'Nome (A-Z)', icon: 'A' },
    { id: 'alpha_desc', label: 'Nome (Z-A)', icon: 'Z' },
  ];
}
