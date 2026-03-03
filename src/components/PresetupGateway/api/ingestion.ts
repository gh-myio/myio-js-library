import type { PresetupAuth } from './auth';
import type {
  GatewayInfo,
  IngestionApiDevice,
  LookupPair,
  LookupResult,
} from '../types';

/**
 * Ingestion API client — gateway + device CRUD and lookup.
 * Ported from presetup-nextjs/src/services/sync/ingestion-api.ts
 * and presetup-nextjs/src/services/ingestion.ts.
 */
export class IngestionApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly auth: PresetupAuth,
  ) {}

  private async headers(): Promise<HeadersInit> {
    const token = await this.auth.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
    const res = await fetch(url, { ...init, headers: await this.headers() });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ingestion API error: HTTP ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // ── Gateway ────────────────────────────────────────────────────────────────

  async fetchGateway(gatewayId: string): Promise<GatewayInfo | null> {
    try {
      const result = await this.request<{ data: GatewayInfo }>(`/gateways/${gatewayId}`);
      return result.data ?? null;
    } catch (err: any) {
      if (err.message?.includes('HTTP 404')) return null;
      throw err;
    }
  }

  // ── Devices ────────────────────────────────────────────────────────────────

  async fetchDevicesByGateway(gatewayId: string): Promise<IngestionApiDevice[]> {
    const devices: IngestionApiDevice[] = [];
    let page = 1;

    while (true) {
      const params = new URLSearchParams({
        gatewayId,
        includeInactive: 'false',
        page: String(page),
        limit: '200',
        sortBy: 'name',
        sortOrder: 'asc',
      });

      const result = await this.request<{
        data: IngestionApiDevice[];
        pagination?: { pages?: number; total?: number; limit?: number };
      }>(`/devices?${params.toString()}`);

      const data = Array.isArray(result?.data) ? result.data : [];
      devices.push(...data);

      const pages =
        result?.pagination?.pages ??
        (result?.pagination?.total && result?.pagination?.limit
          ? Math.ceil(result.pagination.total / result.pagination.limit)
          : 1);

      if (page >= pages) break;
      page++;
    }

    return devices;
  }

  async fetchDevice(deviceId: string): Promise<IngestionApiDevice | null> {
    try {
      const result = await this.request<{ data: IngestionApiDevice }>(`/devices/${deviceId}`);
      return result.data ?? null;
    } catch (err: any) {
      if (err.message?.includes('HTTP 404')) return null;
      throw err;
    }
  }

  async createDevice(payload: Record<string, unknown>): Promise<{ data: { id: string } }> {
    return this.request('/devices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateDevice(
    deviceId: string,
    payload: Record<string, unknown>,
  ): Promise<{ data: IngestionApiDevice }> {
    return this.request(`/devices/${deviceId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async lookupDevices(pairs: LookupPair[]): Promise<LookupResult[]> {
    const result = await this.request<{ data: LookupResult[] }>('/devices/lookup', {
      method: 'POST',
      body: JSON.stringify({ pairs }),
    });
    return result.data ?? [];
  }
}
