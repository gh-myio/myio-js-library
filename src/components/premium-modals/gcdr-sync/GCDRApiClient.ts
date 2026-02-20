/**
 * RFC-0176: GCDR Sync Modal — GCDR REST API Client
 */

import type { CreateCustomerDto, CreateAssetDto, CreateDeviceDto, GCDREntity } from './types';

const GCDR_BASE_URL = 'https://gcdr-api.a.myio-bas.com';
const GCDR_API_KEY = 'gcdr_cust_tb_master_key_2026';
const RETRY_DELAY_MS = 1000;

export class GCDRApiClient {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // ============================================================================
  // Core fetch with retry
  // ============================================================================

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ data: T | null; conflict: boolean; notFound: boolean }> {
    const url = `${GCDR_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      'X-API-Key': GCDR_API_KEY,
      'x-tenant-id': this.tenantId,
      'Content-Type': 'application/json',
    };

    const attempt = async () => {
      return fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    };

    let response = await attempt();

    // Retry once on 5xx only for idempotent methods (GET/PATCH/PUT).
    // Never retry POST — a failed DB insert retried just produces a duplicate attempt.
    if (response.status >= 500 && method !== 'POST') {
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      response = await attempt();
    }

    if (response.status === 401 || response.status === 403) {
      const text = await response.text().catch(() => '');
      throw new Error(`GCDR auth error (${response.status}): ${text}`);
    }

    if (response.status === 409) {
      return { data: null, conflict: true, notFound: false };
    }

    if (response.status === 422) {
      const text = await response.text().catch(() => '');
      throw new Error(`GCDR validation error: ${text}`);
    }

    if (response.status === 404) {
      return { data: null, conflict: false, notFound: true };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`GCDR API error (${response.status}): ${text}`);
    }

    if (response.status === 204) {
      return { data: null, conflict: false, notFound: false };
    }

    const data = await response.json() as T;
    return { data, conflict: false, notFound: false };
  }

  // ============================================================================
  // Customer
  // ============================================================================

  async createCustomer(dto: CreateCustomerDto): Promise<GCDREntity> {
    const result = await this.request<GCDREntity>('POST', '/api/v1/customers', dto);
    if (result.conflict) {
      throw new Error(`GCDR customer conflict: "${dto.name}" already exists`);
    }
    return result.data!;
  }

  async getCustomer(gcdrId: string): Promise<GCDREntity | null> {
    const result = await this.request<GCDREntity>('GET', `/api/v1/customers/${gcdrId}`);
    if (result.notFound) return null;
    return result.data;
  }

  async updateCustomer(gcdrId: string, dto: Partial<CreateCustomerDto>): Promise<GCDREntity> {
    const result = await this.request<GCDREntity>('PATCH', `/api/v1/customers/${gcdrId}`, dto);
    return result.data!;
  }

  // ============================================================================
  // Asset
  // ============================================================================

  async createAsset(dto: CreateAssetDto): Promise<GCDREntity> {
    const result = await this.request<GCDREntity>('POST', '/api/v1/assets', dto);
    if (result.conflict) {
      throw new Error(`GCDR asset conflict: "${dto.name}" already exists`);
    }
    return result.data!;
  }

  async getAsset(gcdrId: string): Promise<GCDREntity | null> {
    const result = await this.request<GCDREntity>('GET', `/api/v1/assets/${gcdrId}`);
    if (result.notFound) return null;
    return result.data;
  }

  async updateAsset(gcdrId: string, dto: Partial<CreateAssetDto>): Promise<GCDREntity> {
    const result = await this.request<GCDREntity>('PATCH', `/api/v1/assets/${gcdrId}`, dto);
    return result.data!;
  }

  // ============================================================================
  // Device
  // ============================================================================

  async createDevice(dto: CreateDeviceDto): Promise<GCDREntity> {
    const result = await this.request<GCDREntity>('POST', '/api/v1/devices', dto);
    if (result.conflict) {
      throw new Error(`GCDR device conflict: "${dto.name}" already exists`);
    }
    return result.data!;
  }

  async getDevice(gcdrId: string): Promise<GCDREntity | null> {
    const result = await this.request<GCDREntity>('GET', `/api/v1/devices/${gcdrId}`);
    if (result.notFound) return null;
    return result.data;
  }

  async updateDevice(gcdrId: string, dto: Partial<CreateDeviceDto>): Promise<GCDREntity> {
    const result = await this.request<GCDREntity>('PATCH', `/api/v1/devices/${gcdrId}`, dto);
    return result.data!;
  }
}
