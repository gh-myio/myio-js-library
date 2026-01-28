/**
 * RFC-0152 Phase 4: Alarms Notifications Panel Types
 * TypeScript definitions for the alarms panel component
 */

// Re-export alarm types from shared types
export type {
  AlarmSeverity,
  AlarmState,
  Alarm,
  AlarmCardData,
  AlarmStats,
  AlarmTrendDataPoint,
  AlarmFilters,
  AlarmsPanelTab,
  AlarmsPanelState,
  AlarmReadyEvent,
  AlarmActionEvent,
} from '../../types/alarm';

export {
  SEVERITY_CONFIG,
  STATE_CONFIG,
  DEFAULT_ALARM_STATS,
  DEFAULT_ALARM_FILTERS,
  getSeverityConfig,
  getStateConfig,
  isAlarmActive,
  formatAlarmRelativeTime,
} from '../../types/alarm';

// =====================================================================
// Component Types
// =====================================================================

/**
 * Theme mode for the component
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Active tab in the panel
 */
export type AlarmsTab = 'list' | 'dashboard';

// =====================================================================
// Component Parameters
// =====================================================================

/**
 * Parameters for creating the AlarmsNotificationsPanel component
 */
export interface AlarmsNotificationsPanelParams {
  /** Container element to render into */
  container: HTMLElement;
  /** Theme mode (default: 'dark') */
  themeMode?: ThemeMode;
  /** Enable debug logging */
  enableDebugMode?: boolean;
  /** Initial alarms data */
  alarms?: import('../../types/alarm').Alarm[];
  /** Initial statistics data */
  stats?: import('../../types/alarm').AlarmStats;
  /** Initial active tab (default: 'list') */
  initialTab?: AlarmsTab;

  // Callbacks
  /** Called when an alarm card is clicked */
  onAlarmClick?: (alarm: import('../../types/alarm').Alarm) => void;
  /** Called when acknowledge button is clicked */
  onAcknowledge?: (alarmId: string) => Promise<void> | void;
  /** Called when escalate action is triggered */
  onEscalate?: (alarmId: string) => Promise<void> | void;
  /** Called when snooze action is triggered */
  onSnooze?: (alarmId: string, until: string) => Promise<void> | void;
  /** Called when close action is triggered */
  onClose?: (alarmId: string, reason: string) => Promise<void> | void;
  /** Called when tab changes */
  onTabChange?: (tab: AlarmsTab) => void;
  /** Called when filters change */
  onFilterChange?: (filters: import('../../types/alarm').AlarmFilters) => void;
}

// =====================================================================
// Component Instance
// =====================================================================

/**
 * Public API returned by createAlarmsNotificationsPanelComponent
 */
export interface AlarmsNotificationsPanelInstance {
  /** Root element of the component */
  element: HTMLElement;

  // Data methods
  /** Update the alarms data */
  updateAlarms: (alarms: import('../../types/alarm').Alarm[]) => void;
  /** Update the statistics data */
  updateStats: (stats: import('../../types/alarm').AlarmStats) => void;
  /** Get all alarms */
  getAlarms: () => import('../../types/alarm').Alarm[];
  /** Get filtered alarms */
  getFilteredAlarms: () => import('../../types/alarm').Alarm[];

  // Loading state
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;

  // Tab management
  /** Set active tab */
  setActiveTab: (tab: AlarmsTab) => void;
  /** Get current active tab */
  getActiveTab: () => AlarmsTab;

  // Theme
  /** Set theme mode */
  setThemeMode: (mode: ThemeMode) => void;
  /** Get current theme mode */
  getThemeMode: () => ThemeMode;

  // Filters
  /** Get current filters */
  getFilters: () => import('../../types/alarm').AlarmFilters;
  /** Set filters (partial update) */
  setFilters: (filters: Partial<import('../../types/alarm').AlarmFilters>) => void;
  /** Clear all filters */
  clearFilters: () => void;

  // Actions
  /** Refresh the view */
  refresh: () => void;
  /** Destroy the component and cleanup */
  destroy: () => void;
}

// =====================================================================
// Internal State
// =====================================================================

/**
 * Internal state for the component
 */
export interface AlarmsNotificationsPanelState {
  /** Current theme mode */
  themeMode: ThemeMode;
  /** Current active tab */
  activeTab: AlarmsTab;
  /** All alarms */
  allAlarms: import('../../types/alarm').Alarm[];
  /** Filtered alarms (after applying filters) */
  filteredAlarms: import('../../types/alarm').Alarm[];
  /** Statistics data */
  stats: import('../../types/alarm').AlarmStats;
  /** Current filter configuration */
  filters: import('../../types/alarm').AlarmFilters;
  /** Loading state */
  isLoading: boolean;
}

// =====================================================================
// Event System
// =====================================================================

/**
 * Event types emitted by the component
 */
export type AlarmsEventType =
  | 'tab-change'
  | 'filter-change'
  | 'alarm-click'
  | 'alarm-acknowledge'
  | 'alarm-escalate'
  | 'alarm-snooze'
  | 'alarm-close'
  | 'cards-rendered'
  | 'stats-updated'
  | 'loading-change';

/**
 * Event handler function type
 */
export type AlarmsEventHandler = (...args: unknown[]) => void;

// =====================================================================
// Alarm Card Types
// =====================================================================

/**
 * Parameters for rendering alarm cards
 */
export interface AlarmCardParams {
  /** Callback when card is clicked */
  onCardClick?: (alarm: import('../../types/alarm').Alarm) => void;
  /** Callback when acknowledge button is clicked */
  onAcknowledge?: (alarmId: string) => void;
  /** Callback when details button is clicked */
  onDetails?: (alarmId: string) => void;
  /** Callback when more button is clicked */
  onMore?: (alarmId: string, event: MouseEvent) => void;
  /** Current theme mode */
  themeMode?: ThemeMode;
}

// =====================================================================
// Dashboard Types
// =====================================================================

/**
 * Options for trend chart rendering
 */
export interface TrendChartOptions {
  /** Chart width in pixels */
  width?: number;
  /** Chart height in pixels */
  height?: number;
  /** Padding around the chart */
  padding?: number;
  /** Line color */
  lineColor?: string;
  /** Point color */
  pointColor?: string;
  /** Fill color (gradient) */
  fillColor?: string;
  /** Show grid lines */
  showGrid?: boolean;
}

/**
 * Options for donut chart rendering
 */
export interface DonutChartOptions {
  /** Chart size (width and height) */
  size?: number;
  /** Donut thickness */
  thickness?: number;
  /** Show center text */
  showTotal?: boolean;
}

/**
 * Options for bar chart rendering
 */
export interface BarChartOptions {
  /** Chart width */
  width?: number;
  /** Bar height */
  barHeight?: number;
  /** Gap between bars */
  gap?: number;
  /** Show values */
  showValues?: boolean;
}
