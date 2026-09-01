/**
 * ED-1149 / RFC-0229 §3.4 — CustomerConfigApiClient + loadCustomerConfig()
 * dual-read entry point unit tests (mocked `fetch`).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CustomerConfigApiClient,
  CustomerConfigApiError,
  loadCustomerConfig,
} from '../../../src/services/gcdr/customerConfigApiClient';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(body == null ? '' : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeClient(fetchImpl: typeof fetch, baseUrl = 'https://gcdr.example') {
  return new CustomerConfigApiClient({
    baseUrl,
    apiKey: 'gcdr_cust_ABC',
    tenantId: 'tenant-9',
    fetchImpl,
  });
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.useRealTimers();
});

describe('CustomerConfigApiClient — getConfig', () => {
  it('builds the customer-scoped URL and auth headers, unwraps the {success,data,meta} envelope', async () => {
    // Real GCDR shape (gcdr/src/middleware/response.ts sendSuccess) — every
    // response is wrapped; the read model itself lives at `.data`.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { alarms: { notificationsEnabled: false, showOffline: true } },
        meta: { requestId: 'r1', timestamp: '2026-01-01T00:00:00Z' },
      })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const cfg = await client.getConfig('cust-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://gcdr.example/api/v1/customers/cust-1/config');
    expect(init.method).toBe('GET');
    expect(init.headers['X-API-Key']).toBe('gcdr_cust_ABC');
    expect(init.headers['X-Tenant-Id']).toBe('tenant-9');
    expect(cfg.alarms?.notificationsEnabled).toBe(false);
  });

  it('falls back to a flat (unwrapped) body when there is no .data envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ alarms: { notificationsEnabled: true } })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const cfg = await client.getConfig('cust-1');
    expect(cfg.alarms?.notificationsEnabled).toBe(true);
  });

  it('strips a baseUrl that already ends in /api/v1 instead of doubling it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { alarms: {} } }));
    const client = makeClient(fetchMock as unknown as typeof fetch, 'https://gcdr.example/api/v1');
    await client.getConfig('cust-1');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://gcdr.example/api/v1/customers/cust-1/config');
  });

  it('throws CustomerConfigApiError on a non-2xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'nope' } }, { status: 404 }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.getConfig('cust-1')).rejects.toBeInstanceOf(CustomerConfigApiError);
  });

  it('throws CustomerConfigApiError on a network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network down'));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.getConfig('cust-1')).rejects.toBeInstanceOf(CustomerConfigApiError);
  });
});

describe('loadCustomerConfig — dual-read entry point', () => {
  it('returns the parsed config on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ alarms: { notificationsEnabled: true } })
    );
    const result = await loadCustomerConfig({
      baseUrl: 'https://a.example',
      customerId: 'cust-loadcfg-1',
      apiKey: 'key-1',
      tenantId: 'tenant-1',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result?.alarms?.notificationsEnabled).toBe(true);
  });

  it('fails open to null (never throws) on network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network down'));
    const result = await loadCustomerConfig({
      baseUrl: 'https://a.example',
      customerId: 'cust-loadcfg-2',
      apiKey: 'key-1',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result).toBeNull();
  });

  it('fails open to null (never throws) on a non-2xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, { status: 500 }));
    const result = await loadCustomerConfig({
      baseUrl: 'https://a.example',
      customerId: 'cust-loadcfg-3',
      apiKey: 'key-1',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result).toBeNull();
  });

  it('returns null immediately, with no fetch attempted, when required params are missing', async () => {
    const fetchMock = vi.fn();
    const noCustomerId = await loadCustomerConfig({
      baseUrl: 'https://a.example',
      customerId: '',
      apiKey: 'key-1',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const noAuth = await loadCustomerConfig({
      baseUrl: 'https://a.example',
      customerId: 'cust-loadcfg-4',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(noCustomerId).toBeNull();
    expect(noAuth).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches within the TTL window — a second call does not refetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ alarms: { notificationsEnabled: true } })
    );
    const params = {
      baseUrl: 'https://a.example',
      customerId: 'cust-cache-1',
      apiKey: 'key-1',
      fetchImpl: fetchMock as unknown as typeof fetch,
      ttlMs: 60_000,
    };
    await loadCustomerConfig(params);
    await loadCustomerConfig(params);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches after the TTL expires', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ alarms: { notificationsEnabled: true } })
    );
    const params = {
      baseUrl: 'https://a.example',
      customerId: 'cust-cache-2',
      apiKey: 'key-1',
      fetchImpl: fetchMock as unknown as typeof fetch,
      ttlMs: 1_000,
    };
    await loadCustomerConfig(params);
    vi.advanceTimersByTime(1_001);
    await loadCustomerConfig(params);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('de-dupes concurrent in-flight calls for the same key', async () => {
    let resolveFetch: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    const params = {
      baseUrl: 'https://a.example',
      customerId: 'cust-cache-3',
      apiKey: 'key-1',
      fetchImpl: fetchMock as unknown as typeof fetch,
    };
    const call1 = loadCustomerConfig(params);
    const call2 = loadCustomerConfig(params);
    resolveFetch!(jsonResponse({ alarms: { notificationsEnabled: false } }));
    const [r1, r2] = await Promise.all([call1, call2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1?.alarms?.notificationsEnabled).toBe(false);
    expect(r2?.alarms?.notificationsEnabled).toBe(false);
  });
});
