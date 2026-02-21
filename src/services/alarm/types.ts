// RFC-0175: Alarms Backend API response types

export type AvailabilityStatus = 'online' | 'offline' | 'maintenance' | 'warning';

export interface DeviceAvailability {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  customerId: string;
  customerName: string;
  location: string;
  status: AvailabilityStatus;
  availability: number;         // 0-100 percentage
  mtbf: number;                 // hours
  mttr: number;                 // hours
  failureCount: number;
  totalDowntimeHours: number;
  openAlarmCount: number;
  recentAlarmCount: number;
  hasReversal: boolean;
  lastActivityAt: string | null;    // ISO 8601
  lastMaintenanceAt: string | null; // ISO 8601
}

export interface AvailabilitySummary {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  warning: number;
  avgAvailability: number;
  avgMtbf: number;
  avgMttr: number;
  onlineStandby: number;
  onlineNormal: number;
  onlineAlert: number;
  onlineFailure: number;
  maintenanceOnline: number;
  maintenanceOffline: number;
}

export interface AvailabilityFleet {
  customerId: string;
  periodStart: string;
  periodEnd: string;
  totalEquipmentCount: number;
  periodTotalHours: number;
}

export interface AvailabilityResponse {
  fleet: AvailabilityFleet;
  summary: AvailabilitySummary;
  byDevice: DeviceAvailability[];
}

export interface AvailabilityParams {
  customerId: string;
  startAt: string;          // ISO 8601
  endAt: string;            // ISO 8601
  deviceType?: string;      // Comma-separated: 'ESCADA_ROLANTE,ELEVADOR'
  deviceIds?: string;       // Comma-separated device IDs
  includeByDevice?: boolean; // Default: true
}

// =====================================================================
// Raw Alarm API response types (GET /alarms)
// =====================================================================

export interface AlarmApiResponse {
  id: string;
  title: string;
  alarmType: string;
  severity: string;
  state: string;
  tenantId: string;
  customerId?: string;
  centralId?: string;
  deviceId: string;
  deviceType: string;
  description?: string;
  fingerprint: string;
  metadata?: Record<string, unknown>;
  raisedAt: string;        // ISO 8601
  updatedAt: string;       // ISO 8601
  closedAt?: string;
  closedBy?: string;
  resolution?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  snoozedUntil?: string;
  escalatedAt?: string;
  escalatedBy?: string;
  occurrenceCount?: number;
}

export interface AlarmListApiResponse {
  data: AlarmApiResponse[];
  pagination: {
    hasMore: boolean;
    cursor?: string;
    total: number;
  };
}

// =====================================================================
// Raw Stats API response types (GET /api/v1/alarms/stats)
// =====================================================================

export interface AlarmStatsApiResponse {
  total: number;
  bySeverity: Record<string, number>;
  byState: Record<string, number>;
  openCritical: number;
  openHigh: number;
  last24Hours: number;
  avgResolutionTimeMinutes?: number;
}

// =====================================================================
// Raw Trend API response types (GET /api/v1/alarms/stats/trend)
// =====================================================================

export interface AlarmTrendApiPoint {
  period: string;
  count: number;
  bySeverity?: Record<string, number>;
}

// =====================================================================
// Raw Top Offenders response (GET /api/v1/alarms/stats/top-offenders)
// =====================================================================

export interface TopOffenderApiItem {
  deviceId: string;
  deviceName: string;
  customerId?: string;
  customerName?: string;
  alarmCount: number;
  downtimeHours?: number;
}

// =====================================================================
// Raw by-device stats (GET /api/v1/alarms/stats/by-device)
// =====================================================================

export interface DeviceAlarmStatApiItem {
  deviceId: string;
  alarmCount: number;
}

// =====================================================================
// Request parameter types
// =====================================================================

export interface AlarmListParams {
  state?: string[];
  severity?: string[];
  limit?: number;
  cursor?: string;
}
