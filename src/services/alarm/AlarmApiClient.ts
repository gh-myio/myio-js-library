// RFC-0175: Alarms Backend HTTP Client

import type {
  AvailabilityParams,
  AvailabilityResponse,
  AlarmListApiResponse,
  AlarmListParams,
  AlarmStatsApiResponse,
  AlarmTrendApiPoint,
  TopOffenderApiItem,
  DeviceAlarmStatApiItem,
  AlarmBatchResult,
} from './types';

export class AlarmApiClient {
  private baseUrl = '';
  private apiKey = '';

  configure(baseUrl: string, apiKey?: string): void {
    if (baseUrl) this.baseUrl = baseUrl;
    if (apiKey)  this.apiKey  = apiKey;
  }

  private get headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };
  }

  private async request<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers,
      ...options,
    });

    if (!response.ok) {
      throw new Error(`Alarms API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  // Some endpoints return { success: true, data: T[] } — unwrap safely
  private unwrapArray<T>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[];
    if (raw !== null && typeof raw === 'object' && 'data' in (raw as object)) {
      const d = (raw as { data: unknown }).data;
      return Array.isArray(d) ? (d as T[]) : [];
    }
    return [];
  }

  // -----------------------------------------------------------------------
  // Availability (existing endpoint)
  // -----------------------------------------------------------------------

  async getAvailability(params: AvailabilityParams): Promise<AvailabilityResponse> {
    const query = new URLSearchParams({
      customerId: params.customerId,
      startAt: params.startAt,
      endAt: params.endAt,
      includeByDevice: String(params.includeByDevice ?? true),
    });

    if (params.deviceType) query.set('deviceType', params.deviceType);
    if (params.deviceIds) query.set('deviceIds', params.deviceIds);

    return this.request<AvailabilityResponse>(
      `${this.baseUrl}/api/v1/alarms/stats/availability?${query.toString()}`
    );
  }

  // -----------------------------------------------------------------------
  // Alarm list (GET /alarms)
  // -----------------------------------------------------------------------

  async getAlarms(params: AlarmListParams = {}): Promise<AlarmListApiResponse> {
    const query = new URLSearchParams();

    if (params.state?.length)    query.set('state',    params.state.join(','));
    if (params.severity?.length) query.set('severity', params.severity.join(','));
    if (params.alarmType)  query.set('alarmType',  params.alarmType);
    if (params.from)       query.set('from',        params.from);
    if (params.to)         query.set('to',          params.to);
    if (params.customerId) query.set('customerId',  params.customerId);
    query.set('limit', String(params.limit ?? 100));
    if (params.page && params.page > 1) query.set('page', String(params.page));

    const qs = query.toString();
    return this.request<AlarmListApiResponse>(
      `${this.baseUrl}/api/v1/alarms${qs ? `?${qs}` : ''}`
    );
  }

  // -----------------------------------------------------------------------
  // Stats (GET /api/v1/alarms/stats)
  // -----------------------------------------------------------------------

  async getAlarmStats(tenantId: string, period: string): Promise<AlarmStatsApiResponse> {
    const query = new URLSearchParams({ tenantId, period });
    return this.request<AlarmStatsApiResponse>(
      `${this.baseUrl}/api/v1/alarms/stats?${query.toString()}`
    );
  }

  // -----------------------------------------------------------------------
  // Trend (GET /api/v1/alarms/stats/trend)
  // -----------------------------------------------------------------------

  async getAlarmTrend(
    tenantId: string,
    period: string,
    groupBy: string
  ): Promise<AlarmTrendApiPoint[]> {
    const query = new URLSearchParams({ tenantId, period, groupBy });
    const raw = await this.request<unknown>(
      `${this.baseUrl}/api/v1/alarms/stats/trend?${query.toString()}`
    );
    return this.unwrapArray<AlarmTrendApiPoint>(raw);
  }

  // -----------------------------------------------------------------------
  // Top offenders (GET /api/v1/alarms/stats/top-offenders)
  // -----------------------------------------------------------------------

  async getTopOffenders(tenantId: string, limit = 5): Promise<TopOffenderApiItem[]> {
    const query = new URLSearchParams({ tenantId, limit: String(limit) });
    const raw = await this.request<unknown>(
      `${this.baseUrl}/api/v1/alarms/stats/top-offenders?${query.toString()}`
    );
    return this.unwrapArray<TopOffenderApiItem>(raw);
  }

  // -----------------------------------------------------------------------
  // Per-device stats (GET /api/v1/alarms/stats/by-device)
  // -----------------------------------------------------------------------

  async getAlarmStatsByDevice(tenantId: string): Promise<DeviceAlarmStatApiItem[]> {
    const query = new URLSearchParams({ tenantId });
    const raw = await this.request<unknown>(
      `${this.baseUrl}/api/v1/alarms/stats/by-device?${query.toString()}`
    );
    return this.unwrapArray<DeviceAlarmStatApiItem>(raw);
  }

  // -----------------------------------------------------------------------
  // Alarm actions (POST /alarms/:id/...)
  // -----------------------------------------------------------------------

  async acknowledgeAlarm(id: string, acknowledgedBy: string, note?: string): Promise<void> {
    await this.request<unknown>(`${this.baseUrl}/api/v1/alarms/${id}/ack`, {
      method: 'POST',
      body: JSON.stringify({ acknowledgedBy, note }),
    });
  }

  async silenceAlarm(
    id: string,
    silencedBy: string,
    duration: string,
    reason?: string
  ): Promise<void> {
    await this.request<unknown>(`${this.baseUrl}/api/v1/alarms/${id}/silence`, {
      method: 'POST',
      body: JSON.stringify({ silencedBy, duration, reason }),
    });
  }

  async escalateAlarm(id: string, escalatedBy: string, reason?: string): Promise<void> {
    await this.request<unknown>(`${this.baseUrl}/api/v1/alarms/${id}/escalate`, {
      method: 'POST',
      body: JSON.stringify({ escalatedBy, reason }),
    });
  }

  async closeAlarm(id: string, closedBy: string, resolution?: string): Promise<void> {
    await this.request<unknown>(`${this.baseUrl}/api/v1/alarms/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ closedBy, resolution }),
    });
  }

  // -----------------------------------------------------------------------
  // Batch alarm actions (POST /alarms/batch/*)
  // Up to 100 IDs per call; response contains succeeded/failed arrays.
  // -----------------------------------------------------------------------

  async batchAcknowledge(alarmIds: string[], acknowledgedBy: string): Promise<AlarmBatchResult> {
    const res = await this.request<{ data: AlarmBatchResult }>(
      `${this.baseUrl}/api/v1/alarms/batch/ack`,
      { method: 'POST', body: JSON.stringify({ alarmIds, acknowledgedBy }) }
    );
    return res.data;
  }

  async batchSilence(alarmIds: string[], silencedBy: string, duration: string): Promise<AlarmBatchResult> {
    const res = await this.request<{ data: AlarmBatchResult }>(
      `${this.baseUrl}/api/v1/alarms/batch/silence`,
      { method: 'POST', body: JSON.stringify({ alarmIds, silencedBy, duration }) }
    );
    return res.data;
  }

  async batchEscalate(alarmIds: string[], escalatedBy: string): Promise<AlarmBatchResult> {
    const res = await this.request<{ data: AlarmBatchResult }>(
      `${this.baseUrl}/api/v1/alarms/batch/escalate`,
      { method: 'POST', body: JSON.stringify({ alarmIds, escalatedBy }) }
    );
    return res.data;
  }

  async batchClose(alarmIds: string[], closedBy: string, resolution?: string): Promise<AlarmBatchResult> {
    const res = await this.request<{ data: AlarmBatchResult }>(
      `${this.baseUrl}/api/v1/alarms/batch/close`,
      { method: 'POST', body: JSON.stringify({ alarmIds, closedBy, resolution }) }
    );
    return res.data;
  }
}
