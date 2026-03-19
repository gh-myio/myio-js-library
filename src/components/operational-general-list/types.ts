/**
 * RFC-0152 Phase 3: Operational General List Component Types
 * Component-specific TypeScript definitions
 */

// Re-export shared operational types
export {
  EquipmentType,
  EquipmentStatus,
  EquipmentCardData,
  EquipmentStats,
  EquipmentFilterState,
  getStatusColors,
  getAvailabilityColor,
  DEFAULT_EQUIPMENT_STATS,
  DEFAULT_EQUIPMENT_FILTER_STATE,
} from '../../types/operational';

// ============================================
// THEME MODE
// ============================================

export type ThemeMode = 'dark' | 'light';

// ============================================
// COMPONENT PARAMS
// ============================================

export interface OperationalGeneralListParams {
  /** Container element where component will be rendered */
  container: HTMLElement;

  /** Theme mode */
  themeMode?: ThemeMode;

  /** Enable debug logging */
  enableDebugMode?: boolean;

  /** Enable selection checkboxes */
  enableSelection?: boolean;

  /** Enable drag and drop to footer */
  enableDragDrop?: boolean;

  /** Customer list for header filter */
  customers?: { id: string; name: string }[];

  /** Initial equipment data (optional, can be set via updateEquipment) */
  equipment?: import('../../types/operational').EquipmentCardData[];

  /** Callback when equipment card is clicked */
  onCardClick?: (equipment: import('../../types/operational').EquipmentCardData) => void;

  /** Callback when filter changes */
  onFilterChange?: (filters: import('../../types/operational').EquipmentFilterState) => void;

  /** Callback when stats are updated */
  onStatsUpdate?: (stats: import('../../types/operational').EquipmentStats) => void;
}

// ============================================
// COMPONENT INSTANCE
// ============================================

export interface OperationalGeneralListInstance {
  /** Root DOM element */
  element: HTMLElement;

  /** Update equipment data */
  updateEquipment: (equipment: import('../../types/operational').EquipmentCardData[]) => void;

  /** Get all equipment */
  getEquipment: () => import('../../types/operational').EquipmentCardData[];

  /** Get filtered equipment */
  getFilteredEquipment: () => import('../../types/operational').EquipmentCardData[];

  /** Set loading state */
  setLoading: (isLoading: boolean) => void;

  /** Set theme mode */
  setThemeMode: (mode: ThemeMode) => void;

  /** Get current theme mode */
  getThemeMode: () => ThemeMode;

  /** Get current filter state */
  getFilters: () => import('../../types/operational').EquipmentFilterState;

  /** Set filters programmatically */
  setFilters: (filters: Partial<import('../../types/operational').EquipmentFilterState>) => void;

  /** Get current stats */
  getStats: () => import('../../types/operational').EquipmentStats;

  /** Refresh the view */
  refresh: () => void;

  /** Destroy component and cleanup */
  destroy: () => void;
}

// ============================================
// CONTROLLER STATE
// ============================================

export interface OperationalGeneralListState {
  themeMode: ThemeMode;
  allEquipment: import('../../types/operational').EquipmentCardData[];
  filteredEquipment: import('../../types/operational').EquipmentCardData[];
  filters: import('../../types/operational').EquipmentFilterState;
  stats: import('../../types/operational').EquipmentStats;
  isLoading: boolean;
}

// ============================================
// VIEW EVENT TYPES
// ============================================

export type OperationalListEventType =
  | 'search-change'
  | 'filter-change'
  | 'status-filter-change'
  | 'type-filter-change'
  | 'card-click'
  | 'cards-rendered';

export type OperationalListEventHandler = (...args: unknown[]) => void;

// ============================================
// STATUS CONFIGURATION
// ============================================

export interface StatusConfig {
  bg: string;
  border: string;
  text: string;
  label: string;
}

export const STATUS_CONFIG: Record<import('../../types/operational').EquipmentStatus, StatusConfig> = {
  online: {
    bg: '#dcfce7',
    border: '#22c55e',
    text: '#166534',
    label: 'Online',
  },
  offline: {
    bg: '#fee2e2',
    border: '#ef4444',
    text: '#991b1b',
    label: 'Offline',
  },
  maintenance: {
    bg: '#fef3c7',
    border: '#f59e0b',
    text: '#92400e',
    label: 'Manutencao',
  },
};

// ============================================
// AVAILABILITY COLOR THRESHOLDS
// ============================================

export const AVAILABILITY_THRESHOLDS = {
  excellent: { min: 95, color: '#22c55e' }, // Green
  warning: { min: 80, color: '#f59e0b' },   // Amber
  critical: { min: 0, color: '#ef4444' },   // Red
};

export function getAvailabilityColorFromThresholds(availability: number): string {
  if (availability >= AVAILABILITY_THRESHOLDS.excellent.min) {
    return AVAILABILITY_THRESHOLDS.excellent.color;
  }
  if (availability >= AVAILABILITY_THRESHOLDS.warning.min) {
    return AVAILABILITY_THRESHOLDS.warning.color;
  }
  return AVAILABILITY_THRESHOLDS.critical.color;
}
