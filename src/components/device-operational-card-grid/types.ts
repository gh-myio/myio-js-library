/**
 * RFC-0152 Phase 3: Device Operational Card Grid Types
 * TypeScript definitions for the grid component that displays operational equipment cards
 */

// ============================================
// EQUIPMENT TYPES
// ============================================

export type EquipmentType = 'escada' | 'elevador' | 'other';

export type EquipmentStatus = 'online' | 'offline' | 'maintenance' | 'warning';

export type ThemeMode = 'dark' | 'light';

export type SortMode =
  | 'availability_desc'
  | 'availability_asc'
  | 'mtbf_desc'
  | 'mtbf_asc'
  | 'mttr_desc'
  | 'mttr_asc'
  | 'alerts_desc'
  | 'alerts_asc'
  | 'alpha_asc'
  | 'alpha_desc'
  | 'status_asc'
  | 'status_desc';

// ============================================
// EQUIPMENT INTERFACE
// ============================================

export interface OperationalEquipment {
  // Core identifiers
  id: string;
  name: string;
  identifier: string;

  // Equipment classification
  type: EquipmentType;
  status: EquipmentStatus;

  // Customer/Location info
  customerId: string;
  customerName: string;
  location: string;

  // Operational KPIs
  availability: number; // 0-100 percentage
  mtbf: number; // Mean Time Between Failures (hours)
  mttr: number; // Mean Time To Repair (hours)

  // Alert info
  hasReversal: boolean;
  recentAlerts: number;
  openAlarms: number;

  // Timestamps
  lastActivityTime?: number;
  lastMaintenanceTime?: number;

  // Additional metadata
  tags?: Record<string, string>;
}

// ============================================
// FILTER STATE
// ============================================

export interface DeviceOperationalCardGridFilterState {
  searchQuery: string;
  selectedCustomerIds: string[];
  selectedIds: Set<string> | null;
  typeFilter: EquipmentType | 'all';
  statusFilter: EquipmentStatus | 'all';
  sortMode: SortMode;
}

export const DEFAULT_GRID_FILTER_STATE: DeviceOperationalCardGridFilterState = {
  searchQuery: '',
  selectedCustomerIds: [],
  selectedIds: null,
  typeFilter: 'all',
  statusFilter: 'all',
  sortMode: 'availability_desc',
};

// ============================================
// STATS
// ============================================

export interface DeviceOperationalCardGridStats {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  warning: number;
  avgAvailability: number;
  avgMtbf: number;
  avgMttr: number;
  totalAlerts: number;
  filteredCount: number;
}

// ============================================
// CALLBACK TYPES
// ============================================

export type EquipmentAction = 'details' | 'maintenance' | 'history' | 'alarms';

export type OnEquipmentClickCallback = (equipment: OperationalEquipment) => void;

export type OnEquipmentActionCallback = (
  action: EquipmentAction,
  equipment: OperationalEquipment
) => void;

export type OnGridFilterChangeCallback = (filters: DeviceOperationalCardGridFilterState) => void;

export type OnGridStatsUpdateCallback = (stats: DeviceOperationalCardGridStats) => void;

// ============================================
// COMPONENT PARAMS
// ============================================

export interface CustomerOption {
  id: string;
  name: string;
}

export interface DeviceOperationalCardGridParams {
  /** Container element where component will be rendered */
  container: HTMLElement;

  /** Theme mode */
  themeMode?: ThemeMode;

  /** Enable debug logging */
  enableDebugMode?: boolean;

  /** Initial equipment data */
  equipment?: OperationalEquipment[];

  /** List of customers for filter dropdown */
  customers?: CustomerOption[];

  /** Include search input */
  includeSearch?: boolean;

  /** Include filter controls */
  includeFilters?: boolean;

  /** Include stats header */
  includeStats?: boolean;

  /** Callback when equipment card is clicked */
  onEquipmentClick?: OnEquipmentClickCallback;

  /** Callback when equipment action is triggered */
  onEquipmentAction?: OnEquipmentActionCallback;

  /** Callback when filter changes */
  onFilterChange?: OnGridFilterChangeCallback;

  /** Callback when stats update */
  onStatsUpdate?: OnGridStatsUpdateCallback;
}

// ============================================
// COMPONENT STATE
// ============================================

export interface DeviceOperationalCardGridState {
  themeMode: ThemeMode;
  allEquipment: OperationalEquipment[];
  filteredEquipment: OperationalEquipment[];
  filters: DeviceOperationalCardGridFilterState;
  stats: DeviceOperationalCardGridStats;
  isLoading: boolean;
}

// ============================================
// COMPONENT INSTANCE
// ============================================

export interface DeviceOperationalCardGridInstance {
  /** Root DOM element */
  element: HTMLElement;

  // Data methods
  updateEquipment: (equipment: OperationalEquipment[]) => void;
  getEquipment: () => OperationalEquipment[];
  getFilteredEquipment: () => OperationalEquipment[];

  // Loading state
  setLoading: (isLoading: boolean) => void;

  // Theme methods
  setThemeMode: (mode: ThemeMode) => void;
  getThemeMode: () => ThemeMode;

  // Filter methods
  getFilters: () => DeviceOperationalCardGridFilterState;
  setFilters: (filters: Partial<DeviceOperationalCardGridFilterState>) => void;
  clearFilters: () => void;
  setSearchQuery: (query: string) => void;
  setCustomerFilter: (customerIds: string[]) => void;

  // Stats
  getStats: () => DeviceOperationalCardGridStats;

  // Actions
  refresh: () => void;

  // Lifecycle
  destroy: () => void;
}

// ============================================
// EVENT TYPES
// ============================================

export type DeviceOperationalCardGridEventType =
  | 'search-change'
  | 'filter-change'
  | 'sort-change'
  | 'cards-rendered'
  | 'equipment-click'
  | 'equipment-action'
  | 'filter-click'
  | 'customer-change'
  | 'maximize-change';

export type DeviceOperationalCardGridEventHandler = (...args: unknown[]) => void;

// ============================================
// SORT OPTIONS
// ============================================

export interface GridSortOption {
  id: SortMode;
  label: string;
  icon: string;
}

export const GRID_SORT_OPTIONS: GridSortOption[] = [
  { id: 'availability_desc', label: 'Disponibilidade (maior)', icon: '📊' },
  { id: 'availability_asc', label: 'Disponibilidade (menor)', icon: '📊' },
  { id: 'mtbf_desc', label: 'MTBF (maior)', icon: '⏱️' },
  { id: 'mtbf_asc', label: 'MTBF (menor)', icon: '⏱️' },
  { id: 'mttr_desc', label: 'MTTR (maior)', icon: '🔧' },
  { id: 'mttr_asc', label: 'MTTR (menor)', icon: '🔧' },
  { id: 'alerts_desc', label: 'Alertas (maior)', icon: '🔔' },
  { id: 'alerts_asc', label: 'Alertas (menor)', icon: '🔔' },
  { id: 'alpha_asc', label: 'Nome (A-Z)', icon: 'A' },
  { id: 'alpha_desc', label: 'Nome (Z-A)', icon: 'Z' },
  { id: 'status_asc', label: 'Status (A-Z)', icon: '🟢' },
  { id: 'status_desc', label: 'Status (Z-A)', icon: '🔴' },
];

// ============================================
// FILTER TABS
// ============================================

export interface GridFilterTab {
  id: string;
  label: string;
  filter: (equipment: OperationalEquipment) => boolean;
  count?: number;
}

export const DEFAULT_GRID_FILTER_TABS: GridFilterTab[] = [
  { id: 'all', label: 'Todos', filter: () => true },
  { id: 'online', label: 'Online', filter: (e) => e.status === 'online' },
  { id: 'offline', label: 'Offline', filter: (e) => e.status === 'offline' },
  { id: 'maintenance', label: 'Manutencao', filter: (e) => e.status === 'maintenance' },
  { id: 'warning', label: 'Alerta', filter: (e) => e.status === 'warning' || e.hasReversal },
  { id: 'escadas', label: 'Escadas', filter: (e) => e.type === 'escada' },
  { id: 'elevadores', label: 'Elevadores', filter: (e) => e.type === 'elevador' },
];

// ============================================
// STATUS CONFIGURATION
// ============================================

export const STATUS_CONFIG: Record<EquipmentStatus, { label: string; color: string; bg: string; icon: string }> = {
  online: { label: 'Online', color: '#166534', bg: '#dcfce7', icon: '🟢' },
  offline: { label: 'Offline', color: '#991b1b', bg: '#fee2e2', icon: '🔴' },
  maintenance: { label: 'Manutencao', color: '#92400e', bg: '#fef3c7', icon: '🟠' },
  warning: { label: 'Alerta', color: '#854d0e', bg: '#fef9c3', icon: '⚠️' },
};

export const TYPE_CONFIG: Record<EquipmentType, { label: string; icon: string }> = {
  escada: { label: 'Escada Rolante', icon: '🎢' },
  elevador: { label: 'Elevador', icon: '🛗' },
  other: { label: 'Outro', icon: '⚙️' },
};
