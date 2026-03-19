/**
 * RFC-0152 Phase 5: Operational Dashboard Types
 * TypeScript definitions for the management dashboard component
 */

// ============================================
// PERIOD TYPES
// ============================================

export type DashboardPeriod = 'today' | 'week' | 'month' | 'quarter';

export type DashboardThemeMode = 'dark' | 'light';

// ============================================
// KPI DATA
// ============================================

export interface DashboardKPIs {
  /** Fleet-wide availability percentage */
  fleetAvailability: number;

  /** Availability trend vs previous period (positive = improvement) */
  availabilityTrend: number;

  /** Average availability across all equipment */
  avgAvailability: number;

  /** Number of active alerts */
  activeAlerts: number;

  /** Fleet-wide average MTBF in hours */
  fleetMTBF: number;

  /** Fleet-wide average MTTR in hours */
  fleetMTTR: number;

  /** Total equipment count */
  totalEquipment: number;

  /** Online equipment count */
  onlineCount: number;

  /** Offline equipment count */
  offlineCount: number;

  /** Maintenance equipment count */
  maintenanceCount: number;

  // RFC-0155: Enhanced status metrics
  /** Online count trend vs previous period */
  onlineTrend?: number;

  /** Offline count trend vs previous period */
  offlineTrend?: number;

  /** Maintenance count trend vs previous period */
  maintenanceTrend?: number;

  /** Equipment offline for more than 24h */
  offlineCriticalCount?: number;

  /** Equipment with recurrent failures (3+ in period) */
  recurrentFailuresCount?: number;

  /** Average time in current status (hours) per category */
  avgTimeInStatus?: {
    online: number;
    offline: number;
    maintenance: number;
  };

  // RFC-0155 Feedback: Enhanced maintenance breakdown
  /** Maintenance breakdown by type */
  maintenanceBreakdown?: {
    /** Scheduled/planned maintenance count */
    scheduled: number;
    /** Corrective/unplanned maintenance count */
    corrective: number;
    /** Average maintenance duration in hours */
    avgDuration: number;
  };

  // RFC-0155 Feedback: SLA configuration
  /** SLA target for availability (default: 95%) */
  availabilitySlaTarget?: number;

  /** Availability trend vs previous period (e.g., -2.5 means 2.5% worse) */
  availabilityTrendValue?: number;

  // RFC-0155 Feedback: Offline hierarchy
  /** Critical offline equipment (essential assets) */
  offlineEssentialCount?: number;
}

export const DEFAULT_DASHBOARD_KPIS: DashboardKPIs = {
  fleetAvailability: 0,
  availabilityTrend: 0,
  avgAvailability: 0,
  activeAlerts: 0,
  fleetMTBF: 0,
  fleetMTTR: 0,
  totalEquipment: 0,
  onlineCount: 0,
  offlineCount: 0,
  maintenanceCount: 0,
  // RFC-0155 defaults
  onlineTrend: 0,
  offlineTrend: 0,
  maintenanceTrend: 0,
  offlineCriticalCount: 0,
  recurrentFailuresCount: 0,
  avgTimeInStatus: {
    online: 0,
    offline: 0,
    maintenance: 0,
  },
  // RFC-0155 Feedback defaults
  maintenanceBreakdown: {
    scheduled: 0,
    corrective: 0,
    avgDuration: 0,
  },
  availabilitySlaTarget: 95,
  availabilityTrendValue: 0,
  offlineEssentialCount: 0,
};

// ============================================
// TREND DATA
// ============================================

export interface TrendDataPoint {
  /** Date/time label */
  label: string;

  /** Timestamp */
  timestamp: number;

  /** Value (availability, MTBF, etc.) */
  value: number;

  /** Optional secondary value (e.g., MTTR) */
  secondaryValue?: number;

  // RFC-0156: Enhanced availability data
  /** Number of failures on this day/period */
  failureCount?: number;

  /** Total downtime hours on this day/period */
  downtimeHours?: number;

  /** Number of affected equipment */
  affectedEquipment?: number;

  /** Flag if there was a significant event */
  hasEvent?: boolean;

  /** Event description (if hasEvent) */
  eventDescription?: string;
}

// ============================================
// DOWNTIME DATA
// ============================================

export interface DowntimeEntry {
  /** Equipment name */
  name: string;

  /** Location/Shopping name */
  location: string;

  /** Total downtime hours */
  downtime: number;

  /** Percentage of total period */
  percentage: number;
}

// ============================================
// CALLBACK TYPES
// ============================================

export type OnPeriodChangeCallback = (period: DashboardPeriod) => void;

export type OnRefreshCallback = () => void;

// ============================================
// COMPONENT PARAMS
// ============================================

export interface OperationalDashboardParams {
  /** Container element */
  container: HTMLElement;

  /** Theme mode */
  themeMode?: DashboardThemeMode;

  /** Enable debug logging */
  enableDebugMode?: boolean;

  /** Initial period */
  initialPeriod?: DashboardPeriod;

  /** Initial KPIs data */
  kpis?: DashboardKPIs;

  /** Initial trend data */
  trendData?: TrendDataPoint[];

  /** Initial downtime list */
  downtimeList?: DowntimeEntry[];

  /** Callback when period changes */
  onPeriodChange?: OnPeriodChangeCallback;

  /** Callback when refresh is requested */
  onRefresh?: OnRefreshCallback;
}

// ============================================
// COMPONENT STATE
// ============================================

export interface OperationalDashboardState {
  themeMode: DashboardThemeMode;
  period: DashboardPeriod;
  kpis: DashboardKPIs;
  trendData: TrendDataPoint[];
  downtimeList: DowntimeEntry[];
  isLoading: boolean;
}

// ============================================
// COMPONENT INSTANCE
// ============================================

export interface OperationalDashboardInstance {
  /** Root DOM element */
  element: HTMLElement;

  /** Update KPIs data */
  updateKPIs: (kpis: DashboardKPIs) => void;

  /** Update trend data */
  updateTrendData: (data: TrendDataPoint[]) => void;

  /** Update downtime list */
  updateDowntimeList: (list: DowntimeEntry[]) => void;

  /** Set loading state */
  setLoading: (isLoading: boolean) => void;

  /** Set period */
  setPeriod: (period: DashboardPeriod) => void;

  /** Get current period */
  getPeriod: () => DashboardPeriod;

  /** Set theme mode */
  setThemeMode: (mode: DashboardThemeMode) => void;

  /** Get theme mode */
  getThemeMode: () => DashboardThemeMode;

  /** Refresh data */
  refresh: () => void;

  /** Destroy and cleanup */
  destroy: () => void;
}

// ============================================
// PERIOD CONFIG
// ============================================

export interface PeriodOption {
  value: DashboardPeriod;
  label: string;
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'month', label: 'Este Mes' },
  { value: 'quarter', label: 'Este Trimestre' },
];
