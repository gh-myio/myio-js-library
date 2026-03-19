/**
 * RFC-0152: Operational Indicators Types
 * Shared TypeScript definitions for operational indicators panels
 */

// =====================================================================
// Customer Attributes
// =====================================================================

/**
 * Customer attributes for operational indicators feature gating
 */
export interface OperationalIndicatorsAttributes {
  /** Feature flag to enable/disable operational indicators panels */
  'show-indicators-operational-panels': boolean;
}

// =====================================================================
// Equipment Types
// =====================================================================

/**
 * Equipment type classification
 */
export type EquipmentType = 'escada' | 'elevador';

/**
 * Equipment operational status
 */
export type EquipmentStatus = 'online' | 'offline' | 'maintenance';

/**
 * Equipment card data for General List panel
 */
export interface EquipmentCardData {
  /** Unique equipment identifier */
  id: string;
  /** Display name (e.g., 'ESC-01', 'ELV-02') */
  name: string;
  /** Equipment type */
  type: EquipmentType;
  /** Current operational status */
  status: EquipmentStatus;
  /** Availability percentage (0-100) */
  availability: number;
  /** Mean Time Between Failures in hours */
  mtbf: number;
  /** Mean Time To Repair in hours */
  mttr: number;
  /** Flag indicating reversal detection */
  hasReversal: boolean;
  /** Count of recent alerts for this equipment */
  recentAlerts: number;
  /** Customer/Shopping name */
  customerName: string;
  /** Location within the shopping (e.g., 'Piso 1', 'Torre A') */
  location: string;
  /** ThingsBoard customer ID */
  customerId?: string;
  /** Device entity ID */
  entityId?: string;
}

/**
 * Equipment statistics summary
 */
export interface EquipmentStats {
  /** Total number of equipment */
  total: number;
  /** Number of online equipment */
  online: number;
  /** Number of offline equipment */
  offline: number;
  /** Number of equipment under maintenance */
  maintenance: number;
  /** Fleet-wide availability percentage */
  fleetAvailability: number;
  /** Average MTBF across fleet */
  avgMtbf: number;
  /** Average MTTR across fleet */
  avgMttr: number;
}

// =====================================================================
// Dashboard KPI Types
// =====================================================================

/**
 * Time period for dashboard data
 */
export type DashboardPeriod = 'today' | 'week' | 'month' | 'quarter';

/**
 * Dashboard KPIs for Management Dashboard panel
 */
export interface DashboardKPIs {
  /** Fleet-wide availability percentage */
  fleetAvailability: number;
  /** Availability trend vs previous period */
  availabilityTrend: number;
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
}

/**
 * Equipment downtime entry for top downtime list
 */
export interface DowntimeEntry {
  /** Equipment name */
  name: string;
  /** Location/Shopping name */
  location: string;
  /** Total downtime hours */
  downtime: number;
  /** Downtime percentage of total period */
  percentage: number;
}

/**
 * Trend data point for charts
 */
export interface TrendDataPoint {
  /** Date/time label */
  label: string;
  /** Timestamp */
  timestamp: number;
  /** Value */
  value: number;
}

// =====================================================================
// Filter State Types
// =====================================================================

/**
 * Filter state for equipment list
 */
export interface EquipmentFilterState {
  /** Search query */
  searchQuery: string;
  /** Status filter */
  statusFilter: EquipmentStatus | 'all';
  /** Type filter */
  typeFilter: EquipmentType | 'all';
  /** Customer IDs filter */
  customerIds: string[];
  /** Optional selected equipment IDs (premium filter modal) */
  selectedIds?: Set<string> | null;
  /** Optional sort mode (premium filter modal) */
  sortMode?: 'cons_desc' | 'cons_asc' | 'alpha_asc' | 'alpha_desc' | 'status_asc' | 'status_desc' | 'shopping_asc' | 'shopping_desc';
}

// =====================================================================
// Event Types
// =====================================================================

/**
 * Operational indicators access event detail
 */
export interface OperationalIndicatorsAccessEvent {
  /** Whether operational indicators feature is enabled */
  enabled: boolean;
}

/**
 * Operational context change event detail
 */
export interface OperationalContextChangeEvent {
  /** Context ID (general-list, alarms, dashboard) */
  context: string;
}

/**
 * Equipment data ready event detail
 */
export interface OperationalEquipmentReadyEvent {
  /** Equipment list */
  equipment: EquipmentCardData[];
  /** Equipment statistics */
  stats: EquipmentStats;
}

// =====================================================================
// Store Interface
// =====================================================================

/**
 * Operational Store interface for global state management
 */
export interface OperationalStore {
  /** Feature enabled state */
  enabled: boolean;
  /** Equipment data */
  equipment: EquipmentCardData[];
  /** Equipment statistics */
  equipmentStats: EquipmentStats;
  /** Dashboard KPIs */
  dashboardKPIs: DashboardKPIs | null;
  /** Selected equipment IDs */
  selectedEquipmentIds: Set<string>;
  /** Current period */
  period: DashboardPeriod;
  /** Filter state */
  filters: EquipmentFilterState;
}

// =====================================================================
// Utility Functions
// =====================================================================

/**
 * Calculate MTBF from operating hours, maintenance hours, and failure count
 */
export function calculateMTBF(
  operatingHours: number,
  maintenanceHours: number,
  failureCount: number
): number {
  if (failureCount === 0) return operatingHours;
  return (operatingHours - maintenanceHours) / failureCount;
}

/**
 * Calculate MTTR from maintenance hours and failure count
 */
export function calculateMTTR(maintenanceHours: number, failureCount: number): number {
  if (failureCount === 0) return 0;
  return maintenanceHours / failureCount;
}

/**
 * Calculate availability from MTBF and MTTR
 * Availability = (MTBF / (MTBF + MTTR)) * 100
 */
export function calculateAvailability(mtbf: number, mttr: number): number {
  if (mtbf + mttr === 0) return 100;
  return (mtbf / (mtbf + mttr)) * 100;
}

/**
 * Get status color configuration
 */
export function getStatusColors(status: EquipmentStatus): {
  bg: string;
  border: string;
  text: string;
} {
  const colors: Record<EquipmentStatus, { bg: string; border: string; text: string }> = {
    online: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
    offline: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
    maintenance: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  };
  return colors[status];
}

/**
 * Get availability color based on percentage
 */
export function getAvailabilityColor(availability: number): string {
  if (availability >= 95) return '#22c55e'; // Green
  if (availability >= 80) return '#f59e0b'; // Amber
  return '#ef4444'; // Red
}

// =====================================================================
// Default Values
// =====================================================================

export const DEFAULT_EQUIPMENT_STATS: EquipmentStats = {
  total: 0,
  online: 0,
  offline: 0,
  maintenance: 0,
  fleetAvailability: 0,
  avgMtbf: 0,
  avgMttr: 0,
};

export const DEFAULT_EQUIPMENT_FILTER_STATE: EquipmentFilterState = {
  searchQuery: '',
  statusFilter: 'all',
  typeFilter: 'all',
  customerIds: [],
  selectedIds: null,
  sortMode: 'cons_desc',
};

export const DEFAULT_DASHBOARD_KPIS: DashboardKPIs = {
  fleetAvailability: 0,
  availabilityTrend: 0,
  fleetMTBF: 0,
  fleetMTTR: 0,
  totalEquipment: 0,
  onlineCount: 0,
  offlineCount: 0,
  maintenanceCount: 0,
};
