/**
 * RFC-0152: Alarm Types
 * TypeScript definitions for alarms and notifications panel
 */

// =====================================================================
// Alarm Enums and Types
// =====================================================================

/**
 * Alarm severity levels
 */
export type AlarmSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

/**
 * Alarm state values
 */
export type AlarmState = 'OPEN' | 'ACK' | 'SNOOZED' | 'ESCALATED' | 'CLOSED';

// =====================================================================
// Alarm Data Interfaces
// =====================================================================

/**
 * Alarm data structure
 */
export interface Alarm {
  /** Unique alarm identifier */
  id: string;
  /** ThingsBoard customer ID */
  customerId: string;
  /** Customer/Shopping name */
  customerName: string;
  /** Source device or entity */
  source: string;
  /** Alarm severity */
  severity: AlarmSeverity;
  /** Current alarm state */
  state: AlarmState;
  /** Alarm title */
  title: string;
  /** Detailed description */
  description: string;
  /** Custom tags for categorization */
  tags: Record<string, string>;
  /** First occurrence timestamp (ISO string) */
  firstOccurrence: string;
  /** Last occurrence timestamp (ISO string) */
  lastOccurrence: string;
  /** Number of times this alarm occurred */
  occurrenceCount: number;
  /** Acknowledgement timestamp (ISO string) */
  acknowledgedAt?: string;
  /** User who acknowledged */
  acknowledgedBy?: string;
  /** Snooze until timestamp (ISO string) */
  snoozedUntil?: string;
  /** Closed timestamp (ISO string) */
  closedAt?: string;
  /** User who closed */
  closedBy?: string;
  /** Reason for closing */
  closedReason?: string;
}

/**
 * Alarm card data for display
 */
export interface AlarmCardData {
  /** Unique alarm identifier */
  id: string;
  /** Alarm title */
  title: string;
  /** Alarm severity */
  severity: AlarmSeverity;
  /** Current alarm state */
  state: AlarmState;
  /** Customer/Shopping name */
  customerName: string;
  /** Source device or entity */
  source: string;
  /** Number of times this alarm occurred */
  occurrenceCount: number;
  /** First occurrence timestamp (ISO string) */
  firstOccurrence: string;
  /** Last occurrence timestamp (ISO string) */
  lastOccurrence: string;
  /** Custom tags */
  tags: Record<string, string>;
}

// =====================================================================
// Statistics and Aggregation
// =====================================================================

/**
 * Alarm statistics summary
 */
export interface AlarmStats {
  /** Total alarm count */
  total: number;
  /** Count by severity */
  bySeverity: Record<AlarmSeverity, number>;
  /** Count by state */
  byState: Record<AlarmState, number>;
  /** Open critical alarms count */
  openCritical: number;
  /** Open high severity alarms count */
  openHigh: number;
  /** Alarms in last 24 hours */
  last24Hours: number;
}

/**
 * Alarm trend data point
 */
export interface AlarmTrendDataPoint {
  /** Date/time label */
  label: string;
  /** Timestamp */
  timestamp: number;
  /** Total count */
  total: number;
  /** Count by severity */
  bySeverity?: Record<AlarmSeverity, number>;
}

// =====================================================================
// Filter State
// =====================================================================

/**
 * Alarm filter configuration
 */
export interface AlarmFilters {
  /** Severity filter (multiple selection) */
  severity?: AlarmSeverity[];
  /** State filter (multiple selection) */
  state?: AlarmState[];
  /** Customer ID filter */
  customerId?: string;
  /** Search query */
  search?: string;
  /** Date range start (ISO string) */
  fromDate?: string;
  /** Date range end (ISO string) */
  toDate?: string;
}

/**
 * Active tab in alarms panel
 */
export type AlarmsPanelTab = 'list' | 'dashboard';

/**
 * Alarm panel state
 */
export interface AlarmsPanelState {
  /** Active tab */
  activeTab: AlarmsPanelTab;
  /** All alarms */
  alarms: Alarm[];
  /** Filtered alarms */
  filteredAlarms: Alarm[];
  /** Statistics */
  stats: AlarmStats | null;
  /** Current filters */
  filters: AlarmFilters;
  /** Loading state */
  isLoading: boolean;
}

// =====================================================================
// Event Types
// =====================================================================

/**
 * Alarm data ready event detail
 */
export interface AlarmReadyEvent {
  /** Alarm list */
  alarms: Alarm[];
  /** Alarm statistics */
  stats: AlarmStats;
}

/**
 * Alarm action event detail
 */
export interface AlarmActionEvent {
  /** Alarm ID */
  alarmId: string;
  /** Action type */
  action: 'acknowledge' | 'escalate' | 'snooze' | 'close';
  /** Additional data */
  data?: Record<string, unknown>;
}

// =====================================================================
// Configuration
// =====================================================================

/**
 * Severity display configuration
 */
export const SEVERITY_CONFIG: Record<
  AlarmSeverity,
  { bg: string; border: string; text: string; icon: string; label: string }
> = {
  CRITICAL: {
    bg: 'rgba(239, 68, 68, 0.1)',
    border: '#ef4444',
    text: '#dc2626',
    icon: '🔴',
    label: 'Crítico',
  },
  HIGH: {
    bg: 'rgba(249, 115, 22, 0.1)',
    border: '#f97316',
    text: '#ea580c',
    icon: '🟠',
    label: 'Alto',
  },
  MEDIUM: {
    bg: 'rgba(234, 179, 8, 0.1)',
    border: '#eab308',
    text: '#ca8a04',
    icon: '🟡',
    label: 'Médio',
  },
  LOW: {
    bg: 'rgba(59, 130, 246, 0.1)',
    border: '#3b82f6',
    text: '#2563eb',
    icon: '🔵',
    label: 'Baixo',
  },
  INFO: {
    bg: 'rgba(107, 114, 128, 0.1)',
    border: '#6b7280',
    text: '#4b5563',
    icon: '⚪',
    label: 'Informativo',
  },
};

/**
 * State display configuration
 */
export const STATE_CONFIG: Record<AlarmState, { label: string; color: string }> = {
  OPEN: { label: 'Aberto', color: '#ef4444' },
  ACK: { label: 'Reconhecido', color: '#f59e0b' },
  SNOOZED: { label: 'Adiado', color: '#8b5cf6' },
  ESCALATED: { label: 'Escalado', color: '#dc2626' },
  CLOSED: { label: 'Fechado', color: '#6b7280' },
};

// =====================================================================
// Default Values
// =====================================================================

export const DEFAULT_ALARM_STATS: AlarmStats = {
  total: 0,
  bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
  byState: { OPEN: 0, ACK: 0, SNOOZED: 0, ESCALATED: 0, CLOSED: 0 },
  openCritical: 0,
  openHigh: 0,
  last24Hours: 0,
};

export const DEFAULT_ALARM_FILTERS: AlarmFilters = {
  severity: undefined,
  state: undefined,
  customerId: undefined,
  search: '',
  fromDate: undefined,
  toDate: undefined,
};

// =====================================================================
// Utility Functions
// =====================================================================

/**
 * Get severity configuration
 */
export function getSeverityConfig(severity: AlarmSeverity) {
  return SEVERITY_CONFIG[severity];
}

/**
 * Get state configuration
 */
export function getStateConfig(state: AlarmState) {
  return STATE_CONFIG[state];
}

/**
 * Check if alarm is active (requires attention)
 */
export function isAlarmActive(state: AlarmState): boolean {
  return state === 'OPEN' || state === 'ESCALATED';
}

/**
 * Format relative time for alarm display
 */
export function formatAlarmRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}m atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days < 7) return `${days}d atrás`;

  return date.toLocaleDateString('pt-BR');
}
