/**
 * Shared device shape produced by the classification helpers (RFC-0209) — one type
 * consumed by every widget version so the row→device mapping can never diverge.
 */
export interface DeviceMeta {
  id: string;
  entityId: string;
  name: string;
  label: string;
  labelOrName: string;
  deviceType: string;
  deviceProfile: string;
  identifier: string;
  centralName?: string;
  slaveId?: string;
  centralId?: string;
  customerId?: string;
  ownerName?: string;
  ingestionId?: string;
  /** Energy consumption raw value (kept for back-compat; null when absent). */
  consumption: number | null;
  /** Domain primary value (from the domain catalog's valueField). */
  val: number | null;
  value: number | null;
  pulses?: unknown;
  connectionStatus: string;
  deviceStatus: string;
  /** Domain code (e.g. from getDomainFromDeviceType); '' when unknown. */
  domain: string;
  lastActivityTime?: unknown;
  lastConnectTime?: unknown;
  /** Domain-specific raw telemetry field set via computed key (e.g. the temp field). */
  [k: string]: unknown;
}

/** Status aggregation counts produced by buildByStatusFromDevices. */
export interface ByStatusCounts {
  waiting: number;
  offline: number;
  normal: number;
  alert: number;
  failure: number;
  weakConnection: number;
  standby: number;
  noConsumption: number;
}
