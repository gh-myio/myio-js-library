/**
 * RFC-0152 Phase 4: Device Operational Card Component Types
 * TypeScript definitions for the DeviceOperationalCard component
 */

import {
  Alarm,
  AlarmCardData,
  AlarmSeverity,
  AlarmState,
  AlarmStats,
  AlarmFilters,
} from '../../types/alarm';

// Re-export alarm types for convenience
export type { Alarm, AlarmCardData, AlarmSeverity, AlarmState, AlarmStats, AlarmFilters };

// ============================================
// THEME AND SORT TYPES
// ============================================

export type ThemeMode = 'dark' | 'light';

export type AlarmSortMode =
  | 'severity_desc'
  | 'severity_asc'
  | 'date_desc'
  | 'date_asc'
  | 'occurrences_desc'
  | 'occurrences_asc'
  | 'alpha_asc'
  | 'alpha_desc';

// ============================================
// FILTER STATE
// ============================================

export interface DeviceOperationalCardFilterState {
  /** Search query */
  searchQuery: string;
  /** Severity filter (multiple selection) */
  severityFilter: AlarmSeverity[] | 'all';
  /** State filter (multiple selection) */
  stateFilter: AlarmState[] | 'all';
  /** Customer IDs filter */
  customerIds: string[];
  /** Date range start */
  fromDate: string | null;
  /** Date range end */
  toDate: string | null;
  /** Sort mode */
  sortMode: AlarmSortMode;
}

export const DEFAULT_DEVICE_OPERATIONAL_CARD_FILTER_STATE: DeviceOperationalCardFilterState = {
  searchQuery: '',
  severityFilter: 'all',
  stateFilter: 'all',
  customerIds: [],
  fromDate: null,
  toDate: null,
  sortMode: 'date_desc',
};

// ============================================
// COMPONENT STATE
// ============================================

export interface DeviceOperationalCardState {
  /** Theme mode */
  themeMode: ThemeMode;
  /** All alarms */
  allAlarms: Alarm[];
  /** Filtered alarms */
  filteredAlarms: Alarm[];
  /** Current filters */
  filters: DeviceOperationalCardFilterState;
  /** Statistics */
  stats: AlarmStats;
  /** Loading state */
  isLoading: boolean;
}

// ============================================
// CALLBACK TYPES
// ============================================

export type AlarmAction = 'acknowledge' | 'escalate' | 'snooze' | 'close' | 'details';

export type OnAlarmClickCallback = (alarm: Alarm) => void;

export type OnAlarmActionCallback = (action: AlarmAction, alarm: Alarm) => void;

export type OnAlarmFilterChangeCallback = (filters: DeviceOperationalCardFilterState) => void;

export type OnAlarmStatsUpdateCallback = (stats: AlarmStats) => void;

// ============================================
// COMPONENT PARAMS
// ============================================

export interface DeviceOperationalCardParams {
  /** Container element where component will be rendered */
  container: HTMLElement;

  /** Theme mode */
  themeMode?: ThemeMode;

  /** Enable debug logging */
  enableDebugMode?: boolean;

  /** Enable selection (checkbox + SelectionStore integration) */
  enableSelection?: boolean;

  /** Enable drag and drop */
  enableDragDrop?: boolean;

  /** Initial alarms data (optional, can be set via updateAlarms) */
  alarms?: Alarm[];

  /** Include search input */
  includeSearch?: boolean;

  /** Include filter controls */
  includeFilters?: boolean;

  /** Include stats header */
  includeStats?: boolean;

  /** Callback when alarm card is clicked */
  onAlarmClick?: OnAlarmClickCallback;

  /** Callback when alarm action is triggered */
  onAlarmAction?: OnAlarmActionCallback;

  /** Callback when filter changes */
  onFilterChange?: OnAlarmFilterChangeCallback;

  /** Callback when stats update */
  onStatsUpdate?: OnAlarmStatsUpdateCallback;
}

// ============================================
// COMPONENT INSTANCE
// ============================================

export interface DeviceOperationalCardInstance {
  /** Root DOM element */
  element: HTMLElement;

  // Data methods
  /** Update alarms data */
  updateAlarms: (alarms: Alarm[]) => void;
  /** Get all alarms */
  getAlarms: () => Alarm[];
  /** Get filtered alarms */
  getFilteredAlarms: () => Alarm[];

  // Loading state
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;

  // Theme methods
  /** Set theme mode */
  setThemeMode: (mode: ThemeMode) => void;
  /** Get current theme mode */
  getThemeMode: () => ThemeMode;

  // Filter methods
  /** Get current filters */
  getFilters: () => DeviceOperationalCardFilterState;
  /** Set filters programmatically */
  setFilters: (filters: Partial<DeviceOperationalCardFilterState>) => void;
  /** Clear all filters */
  clearFilters: () => void;

  // Stats
  /** Get current statistics */
  getStats: () => AlarmStats;

  // Actions
  /** Refresh the grid */
  refresh: () => void;

  // Lifecycle
  /** Destroy component and cleanup */
  destroy: () => void;
}

// ============================================
// EVENT TYPES
// ============================================

export type DeviceOperationalCardEventType =
  | 'search-change'
  | 'filter-change'
  | 'sort-change'
  | 'cards-rendered'
  | 'alarm-click'
  | 'alarm-action';

export type DeviceOperationalCardEventHandler = (...args: unknown[]) => void;

// ============================================
// SORT OPTIONS
// ============================================

export interface AlarmSortOption {
  id: AlarmSortMode;
  label: string;
  icon: string;
}

export const ALARM_SORT_OPTIONS: AlarmSortOption[] = [
  { id: 'date_desc', label: 'Mais Recentes', icon: '↓' },
  { id: 'date_asc', label: 'Mais Antigos', icon: '↑' },
  { id: 'severity_desc', label: 'Severidade (maior)', icon: '🔴' },
  { id: 'severity_asc', label: 'Severidade (menor)', icon: '⚪' },
  { id: 'occurrences_desc', label: 'Ocorrências (maior)', icon: '↓' },
  { id: 'occurrences_asc', label: 'Ocorrências (menor)', icon: '↑' },
  { id: 'alpha_asc', label: 'Título (A-Z)', icon: 'A' },
  { id: 'alpha_desc', label: 'Título (Z-A)', icon: 'Z' },
];

// ============================================
// SEVERITY ORDER (for sorting)
// ============================================

export const SEVERITY_ORDER: Record<AlarmSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

// ============================================
// FILTER TABS
// ============================================

export interface AlarmFilterTab {
  id: string;
  label: string;
  filter: (alarm: Alarm) => boolean;
  count?: number;
}

export const DEFAULT_ALARM_FILTER_TABS: AlarmFilterTab[] = [
  { id: 'all', label: 'Todos', filter: () => true },
  { id: 'open', label: 'Abertos', filter: (a) => a.state === 'OPEN' },
  { id: 'critical', label: 'Críticos', filter: (a) => a.severity === 'CRITICAL' },
  { id: 'high', label: 'Altos', filter: (a) => a.severity === 'HIGH' },
  { id: 'acknowledged', label: 'Reconhecidos', filter: (a) => a.state === 'ACK' },
  { id: 'closed', label: 'Fechados', filter: (a) => a.state === 'CLOSED' },
];
