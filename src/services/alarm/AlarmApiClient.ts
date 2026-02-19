// RFC-0175: Alarms Backend HTTP Client

import type { AvailabilityParams, AvailabilityResponse } from './types';

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

  async getAvailability(params: AvailabilityParams): Promise<AvailabilityResponse> {
    const query = new URLSearchParams({
      customerId: params.customerId,
      startAt: params.startAt,
      endAt: params.endAt,
      includeByDevice: String(params.includeByDevice ?? true),
    });

    if (params.deviceType) query.set('deviceType', params.deviceType);
    if (params.deviceIds) query.set('deviceIds', params.deviceIds);

    const url = `${this.baseUrl}/api/v1/alarms/stats/availability?${query.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Alarms API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<AvailabilityResponse>;
  }
}
