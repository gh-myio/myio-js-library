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
} from './types';

const ALARMS_BASE_URL = 'https://alarms-api.a.myio-bas.com';
const API_KEY = 'gcdr_cust_tb_integration_key_2026';

export class AlarmApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl = ALARMS_BASE_URL, apiKey = API_KEY) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
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

    if (params.state?.length) {
      params.state.forEach((s) => query.append('state', s));
    }
    if (params.severity?.length) {
      params.severity.forEach((s) => query.append('severity', s));
    }
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);

    const qs = query.toString();
    return this.request<AlarmListApiResponse>(
      `${this.baseUrl}/alarms${qs ? `?${qs}` : ''}`
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
    return this.request<AlarmTrendApiPoint[]>(
      `${this.baseUrl}/api/v1/alarms/stats/trend?${query.toString()}`
    );
  }

  // -----------------------------------------------------------------------
  // Top offenders (GET /api/v1/alarms/stats/top-offenders)
  // -----------------------------------------------------------------------

  async getTopOffenders(tenantId: string, limit = 5): Promise<TopOffenderApiItem[]> {
    const query = new URLSearchParams({ tenantId, limit: String(limit) });
    return this.request<TopOffenderApiItem[]>(
      `${this.baseUrl}/api/v1/alarms/stats/top-offenders?${query.toString()}`
    );
  }

  // -----------------------------------------------------------------------
  // Per-device stats (GET /api/v1/alarms/stats/by-device)
  // -----------------------------------------------------------------------

  async getAlarmStatsByDevice(tenantId: string): Promise<DeviceAlarmStatApiItem[]> {
    const query = new URLSearchParams({ tenantId });
    return this.request<DeviceAlarmStatApiItem[]>(
      `${this.baseUrl}/api/v1/alarms/stats/by-device?${query.toString()}`
    );
  }

  // -----------------------------------------------------------------------
  // Alarm actions (POST /alarms/:id/...)
  // -----------------------------------------------------------------------

  async acknowledgeAlarm(id: string, acknowledgedBy: string, note?: string): Promise<void> {
    await fetch(`${this.baseUrl}/alarms/${id}/ack`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ acknowledgedBy, note }),
    });
  }

  async silenceAlarm(
    id: string,
    silencedBy: string,
    duration: string,
    reason?: string
  ): Promise<void> {
    await fetch(`${this.baseUrl}/alarms/${id}/silence`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ silencedBy, duration, reason }),
    });
  }

  async escalateAlarm(id: string, escalatedBy: string, reason?: string): Promise<void> {
    await fetch(`${this.baseUrl}/alarms/${id}/escalate`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ escalatedBy, reason }),
    });
  }

  async closeAlarm(id: string, closedBy: string, resolution?: string): Promise<void> {
    await fetch(`${this.baseUrl}/alarms/${id}/close`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ closedBy, resolution }),
    });
  }
}
