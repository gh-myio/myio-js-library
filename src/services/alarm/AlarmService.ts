// RFC-0175: Alarm Service — Singleton facade for Alarms Backend API

import { AlarmApiClient } from './AlarmApiClient';
import type {
  AvailabilityResponse,
  AlarmListParams,
  AlarmStatsApiResponse,
} from './types';
import type { Alarm, AlarmStats, AlarmTrendDataPoint } from '../../types/alarm';
import type { DowntimeEntry } from '../../types/operational';

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < CACHE_TTL_MS;
}

// -----------------------------------------------------------------------
// Inline mapper: AlarmApiResponse → Alarm
// -----------------------------------------------------------------------
function mapApiAlarm(api: import('./types').AlarmApiResponse, customerMap?: Map<string, string>): Alarm {
  return {
    id: api.id,
    customerId: api.customerId ?? api.tenantId,
    customerName: customerMap?.get(api.customerId ?? '') ?? '',
    source: api.deviceId,
    severity: api.severity as Alarm['severity'],
    state: api.state as Alarm['state'],
    title: api.title,
    description: api.description ?? '',
    tags: {
      alarmType: api.alarmType,
      deviceType: api.deviceType,
    },
    firstOccurrence: api.raisedAt,
    lastOccurrence: api.updatedAt,
    occurrenceCount: api.occurrenceCount ?? 1,
    acknowledgedAt: api.acknowledgedAt,
    acknowledgedBy: api.acknowledgedBy,
    snoozedUntil: api.snoozedUntil,
    closedAt: api.closedAt,
    closedBy: api.closedBy,
    closedReason: api.resolution,
  };
}

// -----------------------------------------------------------------------
// Inline mapper: AlarmStatsApiResponse → AlarmStats
// -----------------------------------------------------------------------
function mapApiStats(api: AlarmStatsApiResponse): AlarmStats {
  return {
    total: api.total,
    bySeverity: {
      CRITICAL: api.bySeverity?.CRITICAL ?? 0,
      HIGH: api.bySeverity?.HIGH ?? 0,
      MEDIUM: api.bySeverity?.MEDIUM ?? 0,
      LOW: api.bySeverity?.LOW ?? 0,
      INFO: api.bySeverity?.INFO ?? 0,
    },
    byState: {
      OPEN: api.byState?.OPEN ?? 0,
      ACK: api.byState?.ACK ?? 0,
      SNOOZED: api.byState?.SNOOZED ?? 0,
      ESCALATED: api.byState?.ESCALATED ?? 0,
      CLOSED: api.byState?.CLOSED ?? 0,
    },
    openCritical: api.openCritical,
    openHigh: api.openHigh,
    last24Hours: api.last24Hours,
  };
}

// -----------------------------------------------------------------------
// Inline mapper: AlarmTrendApiPoint[] → AlarmTrendDataPoint[]
// -----------------------------------------------------------------------
function mapApiTrend(
  apiTrend: import('./types').AlarmTrendApiPoint[]
): AlarmTrendDataPoint[] {
  return (apiTrend || []).map((point) => ({
    label: point.period,
    timestamp: new Date(point.period).getTime() || 0,
    total: point.count,
    bySeverity: point.bySeverity
      ? {
          CRITICAL: point.bySeverity.CRITICAL ?? 0,
          HIGH: point.bySeverity.HIGH ?? 0,
          MEDIUM: point.bySeverity.MEDIUM ?? 0,
          LOW: point.bySeverity.LOW ?? 0,
          INFO: point.bySeverity.INFO ?? 0,
        }
      : undefined,
  }));
}

// -----------------------------------------------------------------------
// Inline mapper: TopOffenderApiItem[] → DowntimeEntry[]
// -----------------------------------------------------------------------
function mapApiTopOffenders(
  items: import('./types').TopOffenderApiItem[],
  deviceNameMap: Map<string, string>
): DowntimeEntry[] {
  return (items || []).map((item) => ({
    name: deviceNameMap.get(item.deviceId) ?? item.deviceName ?? item.deviceId,
    location: item.customerName ?? '',
    downtime: item.downtimeHours ?? 0,
    percentage: 0, // computed by caller if needed
  }));
}

class AlarmServiceClass {
  private readonly client = new AlarmApiClient();
  private readonly availabilityCache = new Map<string, CacheEntry<AvailabilityResponse>>();
  private readonly alarmsCache = new Map<string, CacheEntry<Alarm[]>>();
  private readonly statsCache = new Map<string, CacheEntry<AlarmStats>>();
  private readonly trendCache = new Map<string, CacheEntry<AlarmTrendDataPoint[]>>();

  // -----------------------------------------------------------------------
  // Availability (MTBF / MTTR per device)
  // -----------------------------------------------------------------------

  /**
   * Fetches MTBF, MTTR, and Availability metrics per device and fleet-wide.
   * Results are cached for 60 seconds.
   */
  async getAvailability(
    customerId: string,
    startAt: string,
    endAt: string
  ): Promise<AvailabilityResponse> {
    if (!customerId) {
      throw new Error('AlarmService.getAvailability: customerId is required');
    }

    const cacheKey = `avail:${customerId}:${startAt}:${endAt}`;
    const cached = this.availabilityCache.get(cacheKey);

    if (isFresh(cached)) return cached.data;

    const data = await this.client.getAvailability({
      customerId,
      startAt,
      endAt,
      includeByDevice: true,
    });

    this.availabilityCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  // -----------------------------------------------------------------------
  // Alarm list
  // -----------------------------------------------------------------------

  /**
   * Fetch alarm list with optional filters.
   * Returns mapped Alarm[] (from src/types/alarm.ts).
   */
  async getAlarms(
    params: AlarmListParams = {},
    customerMap?: Map<string, string>
  ): Promise<Alarm[]> {
    const cacheKey = `alarms:${JSON.stringify(params)}`;
    const cached = this.alarmsCache.get(cacheKey);

    if (isFresh(cached)) return cached.data;

    const response = await this.client.getAlarms(params);
    const data = (response.data || []).map((a) => mapApiAlarm(a, customerMap));

    this.alarmsCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  // -----------------------------------------------------------------------
  // Alarm statistics
  // -----------------------------------------------------------------------

  /**
   * Fetch aggregated alarm statistics for a tenant and time period.
   * Returns mapped AlarmStats (from src/types/alarm.ts).
   */
  async getAlarmStats(tenantId: string, period: string): Promise<AlarmStats> {
    const cacheKey = `stats:${tenantId}:${period}`;
    const cached = this.statsCache.get(cacheKey);

    if (isFresh(cached)) return cached.data;

    const raw = await this.client.getAlarmStats(tenantId, period);
    const data = mapApiStats(raw);

    this.statsCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  // -----------------------------------------------------------------------
  // Alarm trend
  // -----------------------------------------------------------------------

  /**
   * Fetch alarm trend data points.
   * Returns mapped AlarmTrendDataPoint[] (from src/types/alarm.ts).
   */
  async getAlarmTrend(
    tenantId: string,
    period: string,
    groupBy: string
  ): Promise<AlarmTrendDataPoint[]> {
    const cacheKey = `trend:${tenantId}:${period}:${groupBy}`;
    const cached = this.trendCache.get(cacheKey);

    if (isFresh(cached)) return cached.data;

    const raw = await this.client.getAlarmTrend(tenantId, period, groupBy);
    const data = mapApiTrend(raw);

    this.trendCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  // -----------------------------------------------------------------------
  // Top downtime / offenders
  // -----------------------------------------------------------------------

  /**
   * Fetch top devices by alarm count / downtime.
   * Returns mapped DowntimeEntry[] (from src/types/operational.ts).
   *
   * @param deviceNameMap - Optional map of deviceId → friendly name from ThingsBoard cache
   */
  async getTopDowntime(
    tenantId: string,
    deviceNameMap: Map<string, string> = new Map(),
    limit = 5
  ): Promise<DowntimeEntry[]> {
    const items = await this.client.getTopOffenders(tenantId, limit);
    return mapApiTopOffenders(items, deviceNameMap);
  }

  // -----------------------------------------------------------------------
  // Per-device alarm counts
  // -----------------------------------------------------------------------

  /**
   * Fetch alarm counts per device.
   * Returns a Map<deviceId, alarmCount>.
   */
  async getDeviceAlarmCounts(tenantId: string): Promise<Map<string, number>> {
    const items = await this.client.getAlarmStatsByDevice(tenantId);
    const map = new Map<string, number>();
    (items || []).forEach((item) => map.set(item.deviceId, item.alarmCount));
    return map;
  }

  // -----------------------------------------------------------------------
  // Alarm actions
  // -----------------------------------------------------------------------

  async acknowledgeAlarm(id: string, userEmail: string, note?: string): Promise<void> {
    return this.client.acknowledgeAlarm(id, userEmail, note);
  }

  async silenceAlarm(id: string, userEmail: string, duration: string, reason?: string): Promise<void> {
    return this.client.silenceAlarm(id, userEmail, duration, reason);
  }

  async escalateAlarm(id: string, userEmail: string, reason?: string): Promise<void> {
    return this.client.escalateAlarm(id, userEmail, reason);
  }

  async closeAlarm(id: string, userEmail: string, resolution?: string): Promise<void> {
    return this.client.closeAlarm(id, userEmail, resolution);
  }

  // -----------------------------------------------------------------------
  // Cache management
  // -----------------------------------------------------------------------

  clearCache(): void {
    this.availabilityCache.clear();
    this.alarmsCache.clear();
    this.statsCache.clear();
    this.trendCache.clear();
  }
}

export const AlarmService = new AlarmServiceClass();
