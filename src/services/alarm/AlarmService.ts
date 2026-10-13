// RFC-0175: Alarm Service — Singleton facade for Alarms Backend API

import { AlarmApiClient } from './AlarmApiClient';
import type {
  AvailabilityResponse,
  AlarmListParams,
  AlarmListSummary,
  AlarmStatsApiResponse,
  AlarmBatchResult,
  AlarmHistoryEventApi,
} from './types';
import type { Alarm, AlarmStats, AlarmTrendDataPoint } from '../../types/alarm';
import type { DowntimeEntry } from '../../types/operational';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function isFresh<T>(entry: CacheEntry<T> | undefined, ttlMs: number): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < ttlMs;
}

// -----------------------------------------------------------------------
// Inline mapper: AlarmApiResponse → Alarm
// -----------------------------------------------------------------------
function mapApiAlarm(api: import('./types').AlarmApiResponse, customerMap?: Map<string, string>): Alarm {
  return {
    id: api.id,
    customerId: api.customerId ?? api.tenantId,
    customerName: customerMap?.get(api.customerId ?? '') ?? '',
    source: api.deviceName || api.deviceId,
    severity: api.severity as Alarm['severity'],
    state: api.state as Alarm['state'],
    title: api.title,
    description: api.description ?? '',
    tags: {
      alarmType: api.alarmType,
      deviceType: api.deviceType,
    },
    firstOccurrence: api.raisedAt || (api as any).raised_at || (api as any).createdAt || undefined,
    lastOccurrence:  api.lastUpdatedAt || api.updatedAt || (api as any).updated_at || undefined,
    occurrenceCount: api.occurrenceCount ?? api.dispatchCount ?? 1,
    acknowledgedAt: api.acknowledgedAt || undefined,
    acknowledgedBy: api.acknowledgedBy,
    snoozedUntil: api.silencedUntil || api.snoozedUntil || undefined,
    closedAt: api.closedAt || undefined,
    closedBy: api.closedBy,
    closedReason: api.resolution,
    triggerValue: api.metadata?.value as number | string | undefined,
    centralId: api.centralId || undefined,
    deviceId: api.deviceId || undefined,
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
    label: point.label || point.period,
    timestamp: point.timestamp || new Date(point.period).getTime() || 0,
    total: point.total ?? point.count,
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
    downtime: item.downtimeHours ?? ((item.totalDowntimeMinutes ?? 0) / 60),
    percentage: 0, // computed by caller if needed
  }));
}

type AlarmListResult = { data: Alarm[]; summary: AlarmListSummary };

// Alguns alarmes chegam do backend com title = alarmType = UUID da regra (sem nome resolvido)
const RULE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Base da API de regras (GCDR) normalizada com /api/v1; deriva do host de alarmes se não informada. */
function resolveRulesApiBase(explicit: string, alarmsBase: string): string {
  let base = explicit || (globalThis as any)?.MyIOUtils?.gcdrApiBaseUrl || '';
  if (!base && alarmsBase.includes('alarms-api')) base = alarmsBase.replace('alarms-api', 'gcdr-api');
  if (!base) return '';
  base = String(base).replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  return `${base}/api/v1`;
}

class AlarmServiceClass {
  private client = new AlarmApiClient();
  private cacheTtlMs = 3 * 60 * 1000; // 3 min default; overridable via configure()
  private readonly availabilityCache = new Map<string, CacheEntry<AvailabilityResponse>>();
  private readonly alarmsCache = new Map<string, CacheEntry<AlarmListResult>>();
  private readonly statsCache = new Map<string, CacheEntry<AlarmStats>>();
  private readonly trendCache = new Map<string, CacheEntry<AlarmTrendDataPoint[]>>();
  // ruleId → nome da regra (null = não encontrada); sobrevive ao clearCache — nomes de regra quase não mudam
  private readonly ruleNameCache = new Map<string, string | null>();
  private alarmsBaseUrl = '';
  private rulesBaseUrl = '';

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

    if (isFresh(cached, this.cacheTtlMs)) return cached.data;

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
   * Fetch alarm list with optional filters, auto-paginating until hasMore is false.
   * Returns { data: Alarm[], summary: AlarmListSummary } with all pages merged.
   * The summary comes from page 1 (reflects full dataset totals).
   */
  async getAlarms(
    params: AlarmListParams = {},
    customerMap?: Map<string, string>
  ): Promise<AlarmListResult> {
    const cacheKey = `alarms:${JSON.stringify(params)}`;
    const cached = this.alarmsCache.get(cacheKey);

    if (isFresh(cached, this.cacheTtlMs)) return cached.data;

    let allData: import('../../types/alarm').Alarm[] = [];
    let summary: import('./types').AlarmListSummary | undefined;
    let totalPages = 1;
    let page = 1;

    // ruleId → título "bom" (de alarmes da mesma regra que vieram com título legível)
    const titleByRuleId = new Map<string, string>();

    while (page <= totalPages) {
      const response = await this.client.getAlarms({ ...params, page });
      for (const a of response.data || []) {
        const rid = a.metadata?.ruleId;
        if (rid && a.title && !RULE_ID_RE.test(a.title)) titleByRuleId.set(String(rid), a.title);
      }
      const pageData = (response.data || []).map((a) => mapApiAlarm(a, customerMap));
      allData = allData.concat(pageData);
      if (page === 1) {
        summary = response.summary; // summary reflects full dataset
        totalPages = response.pagination?.totalPages ?? 1;
      }
      page++;
    }

    await this.resolveRuleIdTitles(allData, titleByRuleId);

    const result: AlarmListResult = { data: allData, summary };

    this.alarmsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
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

    if (isFresh(cached, this.cacheTtlMs)) return cached.data;

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

    if (isFresh(cached, this.cacheTtlMs)) return cached.data;

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

  /**
   * Histórico de transições do alarme (abertura/reabertura/fechamento/ack…).
   * Falha de rede/API devolve [] — o detalhe do alarme degrada para só a abertura.
   */
  async getAlarmHistory(id: string): Promise<AlarmHistoryEventApi[]> {
    try {
      return await this.client.getAlarmHistory(id);
    } catch {
      return [];
    }
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
  // Batch alarm actions (POST /alarms/batch/*)
  // -----------------------------------------------------------------------

  async batchAcknowledge(alarmIds: string[], userEmail: string): Promise<AlarmBatchResult> {
    return this.client.batchAcknowledge(alarmIds, userEmail);
  }

  async batchSilence(alarmIds: string[], userEmail: string, duration: string): Promise<AlarmBatchResult> {
    return this.client.batchSilence(alarmIds, userEmail, duration);
  }

  async batchEscalate(alarmIds: string[], userEmail: string): Promise<AlarmBatchResult> {
    return this.client.batchEscalate(alarmIds, userEmail);
  }

  async batchClose(alarmIds: string[], userEmail: string, resolution?: string): Promise<AlarmBatchResult> {
    return this.client.batchClose(alarmIds, userEmail, resolution);
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  /**
   * Set the Alarms API base URL (e.g. from MAIN_VIEW orchestrator settings).
   * Clears the cache so subsequent calls use the new endpoint.
   */
  configure(
    baseUrl: string | null | undefined,
    cacheTtlMs?: number,
    apiKey?: string,
    rulesBaseUrl?: string
  ): void {
    this.client.configure(baseUrl ?? '', apiKey);
    if (baseUrl) this.alarmsBaseUrl = baseUrl;
    if (rulesBaseUrl) this.rulesBaseUrl = rulesBaseUrl;
    if (cacheTtlMs && cacheTtlMs > 0) this.cacheTtlMs = cacheTtlMs;
    this.clearCache();
  }

  /**
   * Alarmes com title = UUID da regra recebem o nome legível: primeiro o título de
   * outro alarme da mesma regra; senão o nome da regra no GCDR (GET /rules/:id, cacheado).
   * Falha de lookup mantém o UUID (nunca quebra a listagem).
   */
  private async resolveRuleIdTitles(alarms: Alarm[], titleByRuleId: Map<string, string>): Promise<void> {
    const pending = alarms.filter((a) => a.title && RULE_ID_RE.test(a.title));
    if (!pending.length) return;

    const rulesBase = resolveRulesApiBase(this.rulesBaseUrl, this.alarmsBaseUrl);
    const toFetch = [
      ...new Set(pending.map((a) => a.title).filter((rid) => !titleByRuleId.has(rid) && !this.ruleNameCache.has(rid))),
    ];
    if (rulesBase && toFetch.length) {
      const CONCURRENCY = 6;
      for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
        await Promise.all(
          toFetch.slice(i, i + CONCURRENCY).map(async (rid) => {
            try {
              this.ruleNameCache.set(rid, await this.client.getRuleName(rulesBase, rid));
            } catch {
              this.ruleNameCache.set(rid, null);
            }
          })
        );
      }
    }

    for (const alarm of pending) {
      const rid = alarm.title;
      const name = titleByRuleId.get(rid) || this.ruleNameCache.get(rid);
      if (!name) continue;
      alarm.title = name;
      if (alarm.tags?.alarmType === rid) alarm.tags.alarmType = name;
    }
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
