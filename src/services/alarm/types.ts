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
