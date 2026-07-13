/**
 * RFC-0218 — GcdrAnnotationsClient tests. Covers the RFC's §Tests list:
 *   2. domainPath normalization (trailing slash) and route assembly
 *   3. listByCustomer/listByEntity aggregate all pages, forward filters
 *   4. envelope unwrap {success,data} and raw-array tolerance
 *   5. retry on 429/503 (backoff, max 3) and NO retry on 400/401/409
 *   6. 409 surfaces ConflictError { finalizedOrStale: true }
 *   7. patch sends If-Match: "<version>"
 *   9. TTL cache hit/expiry + invalidation after create/patch/archive/respond
 *  10. respond({type:'rejected'}) without text → local validation error
 * Plus: required `x-tenant-id` header (real API requirement, not in the
 * RFC's guide-level snippet), the pagination hard-cap warning, and the
 * per-attempt request timeout (code review follow-up on RFC-0218).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GcdrAnnotationsClient } from '../../../src/components/gcdr-annotations/v1.0.0/GcdrAnnotationsClient';
import { ConflictError, ValidationError } from '../../../src/components/gcdr-annotations/v1.0.0/types';

function jsonResponse(status: number, body: unknown): Response {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `STATUS_${status}`,
    json: async () => (text ? JSON.parse(text) : undefined),
    text: async () => text,
  } as unknown as Response;
}

const silentLogger = { log: () => {}, warn: () => {}, error: () => {} };

function baseParams(fetchImpl: typeof fetch, over: Record<string, unknown> = {}) {
  return {
    domainPath: 'https://gcdr-api.a.myio-bas.com/api/v1',
    tenantId: 'tenant-1',
    auth: { apiKey: 'k' },
    fetchImpl,
    logger: silentLogger,
    ...over,
  } as ConstructorParameters<typeof GcdrAnnotationsClient>[0];
}

afterEach(() => {
  vi.useRealTimers();
});

describe('GcdrAnnotationsClient — construction & headers', () => {
  it('throws when domainPath is missing', () => {
    expect(() => new GcdrAnnotationsClient(baseParams(vi.fn(), { domainPath: '' }))).toThrow(/domainPath/);
  });

  it('throws when tenantId is missing', () => {
    expect(() => new GcdrAnnotationsClient(baseParams(vi.fn(), { tenantId: '' }))).toThrow(/tenantId/);
  });

  it('throws when both apiKey and bearerToken are given', () => {
    expect(() =>
      new GcdrAnnotationsClient(baseParams(vi.fn(), { auth: { apiKey: 'k', bearerToken: 't' } }))
    ).toThrow(/exactly one/i);
  });

  it('throws when neither apiKey nor bearerToken is given', () => {
    expect(() => new GcdrAnnotationsClient(baseParams(vi.fn(), { auth: {} }))).toThrow(/exactly one/i);
  });

  it('sends X-API-Key and x-tenant-id headers on every request', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } }));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    await client.list();

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('k');
    expect(headers['x-tenant-id']).toBe('tenant-1');
  });

  it('sends Authorization: Bearer when configured with bearerToken', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } }));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl, { auth: { bearerToken: 'jwt-1' } }));
    await client.list();

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer jwt-1');
    expect(headers['X-API-Key']).toBeUndefined();
  });

  it('normalizes trailing slashes on domainPath but never rewrites host/version', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } }));
    const client = new GcdrAnnotationsClient(
      baseParams(fetchImpl, { domainPath: 'https://gcdr-api.a.myio-bas.com/api/v1///' })
    );
    await client.list();

    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe('https://gcdr-api.a.myio-bas.com/api/v1/annotations');
  });
});

describe('GcdrAnnotationsClient — list / pagination', () => {
  it('listByCustomer aggregates all pages via cursor and forwards filters', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      if (!url.includes('cursor=')) {
        return jsonResponse(200, {
          success: true,
          data: {
            items: [{ id: 'a1' }, { id: 'a2' }],
            pagination: { total: 3, totalPages: 2, hasMore: true, nextCursor: 'cur-2' },
          },
        });
      }
      return jsonResponse(200, {
        success: true,
        data: { items: [{ id: 'a3' }], pagination: { total: 3, totalPages: 2, hasMore: false, nextCursor: null } },
      });
    });
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    const all = await client.listByCustomer('cust-1', { includeArchived: true, type: 'pending' });

    expect(all.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
    expect(calls[0]).toContain('customerId=cust-1');
    expect(calls[0]).toContain('includeArchived=true');
    expect(calls[0]).toContain('type=pending');
    expect(calls[1]).toContain('cursor=cur-2');
  });

  it('listByEntity filters by entityType + entityId', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain('entityType=device');
      expect(url).toContain('entityId=device-42');
      return jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } });
    });
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    await client.listByEntity('device', 'device-42');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('unwraps the {success,data} envelope', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { success: true, data: { items: [{ id: 'a1' }], pagination: { hasMore: false } } })
    );
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    const { items } = await client.list();
    expect(items).toEqual([{ id: 'a1' }]);
  });

  it('tolerates a raw array response body (no envelope)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, [{ id: 'a1' }, { id: 'a2' }]));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    const { items, pagination } = await client.list();
    expect(items).toEqual([{ id: 'a1' }, { id: 'a2' }]);
    expect(pagination).toEqual({ total: null, totalPages: null, hasMore: false, nextCursor: null });
  });

  it('stops at the pagination hard cap and warns', async () => {
    const warn = vi.fn();
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        success: true,
        data: { items: [{ id: 'x' }], pagination: { hasMore: true, nextCursor: 'always-more' } },
      })
    );
    const client = new GcdrAnnotationsClient(
      baseParams(fetchImpl, { maxPages: 3, logger: { log: () => {}, warn, error: () => {} } })
    );
    const all = await client.listByCustomer('cust-1');
    expect(all.length).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('hard cap'));
  });
});

describe('GcdrAnnotationsClient — retry & errors', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('retries on 429 up to maxRetries then succeeds', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls < 3) return jsonResponse(429, { success: false, error: { code: 'RATE_LIMIT', message: 'slow down' } });
      return jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } });
    });
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl, { maxRetries: 3 }));

    const promise = client.list();
    await vi.runAllTimersAsync();
    await promise;

    expect(calls).toBe(3);
  });

  it('retries on 503 then gives up after maxRetries, throwing GcdrAnnotationsError', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(503, { success: false, error: { code: 'DOWN', message: 'unavailable' } }));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl, { maxRetries: 2 }));

    const promise = client.list();
    const assertion = expect(promise).rejects.toMatchObject({ status: 503, code: 'DOWN' });
    await vi.runAllTimersAsync();
    await assertion;

    // 1 initial attempt + 2 retries = 3 calls
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on 400', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, { success: false, error: { code: 'BAD_REQUEST', message: 'nope' } }));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    await expect(client.list()).rejects.toMatchObject({ status: 400 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 401', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'nope' } }));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    await expect(client.list()).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 409 and throws ConflictError with finalizedOrStale', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(409, { success: false, error: { code: 'VERSION_CONFLICT', message: 'stale version' } })
    );
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));

    await expect(client.patch('ann-1', { text: 'x' }, 1)).rejects.toBeInstanceOf(ConflictError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    try {
      await client.patch('ann-1', { text: 'x' }, 1);
    } catch (err) {
      expect((err as ConflictError).finalizedOrStale).toBe(true);
      expect((err as ConflictError).status).toBe(409);
    }
  });
});

describe('GcdrAnnotationsClient — writes', () => {
  it('patch sends If-Match with the expected version and omits version from the body', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers['If-Match']).toBe('7');
      const body = JSON.parse(init.body as string);
      expect(body.version).toBeUndefined();
      expect(body.importance).toBe(5);
      return jsonResponse(200, { success: true, data: { id: 'ann-1', version: 8 } });
    });
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    await client.patch('ann-1', { importance: 5 }, 7);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('archive sends If-Match when a version is given', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers['If-Match']).toBe('3');
      expect(init.method).toBe('POST');
      return jsonResponse(200, { success: true, data: { id: 'ann-1', status: 'archived' } });
    });
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    await client.archive('ann-1', 3);
  });

  it('respond({type:"rejected"}) without text throws locally, no network call', async () => {
    const fetchImpl = vi.fn();
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    await expect(client.respond('ann-1', { type: 'rejected' })).rejects.toBeInstanceOf(ValidationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('respond({type:"approved"}) without text is allowed', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(201, { success: true, data: { id: 'resp-1', type: 'approved' } }));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    await expect(client.respond('ann-1', { type: 'approved' })).resolves.toMatchObject({ id: 'resp-1' });
  });

  it('detach on 204 resolves without attempting to parse a body', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(204, undefined));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    await expect(client.detach('ann-1', 'att-1')).resolves.toBeUndefined();
  });
});

describe('GcdrAnnotationsClient — per-attempt request timeout (code review follow-up)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes an AbortSignal on every attempt', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } }));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    await client.list();

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('defaults requestTimeoutMs to 60_000', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    const fetchImpl = vi.fn(async () => jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } }));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl));
    await client.list();

    expect(spy).toHaveBeenCalledWith(60_000);
  });

  it('honors a custom requestTimeoutMs', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    const fetchImpl = vi.fn(async () => jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } }));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl, { requestTimeoutMs: 15_000 }));
    await client.list();

    expect(spy).toHaveBeenCalledWith(15_000);
  });

  it('a TimeoutError (AbortSignal.timeout expiry) retries through the network-error path', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      return jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } });
    });
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl, { maxRetries: 3 }));

    const promise = client.list();
    await vi.runAllTimersAsync();
    await promise;

    expect(calls).toBe(2);
    vi.useRealTimers();
  });

  it('an AbortError also retries through the network-error path', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls < 2) throw new DOMException('The operation was aborted', 'AbortError');
      return jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } });
    });
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl, { maxRetries: 3 }));

    const promise = client.list();
    await vi.runAllTimersAsync();
    await promise;

    expect(calls).toBe(2);
    vi.useRealTimers();
  });

  it('gives up after maxRetries on a persistent TimeoutError', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl, { maxRetries: 2 }));

    const promise = client.list();
    const assertion = expect(promise).rejects.toBeInstanceOf(DOMException);
    await vi.runAllTimersAsync();
    await assertion;

    // 1 initial attempt + 2 retries = 3 calls
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe('GcdrAnnotationsClient — TTL cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('caches GET responses within the TTL window', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } }));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl, { cacheTtlMs: 60_000 }));

    await client.list();
    await client.list();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after the TTL expires', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } }));
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl, { cacheTtlMs: 1_000 }));

    await client.list();
    vi.advanceTimersByTime(1_001);
    await client.list();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('invalidates the cache after create/patch/archive/respond', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') return jsonResponse(200, { success: true, data: { items: [], pagination: { hasMore: false } } });
      if (method === 'POST' && (_url as string).endsWith('/responses')) {
        return jsonResponse(201, { success: true, data: { id: 'resp-1', type: 'approved' } });
      }
      return jsonResponse(200, { success: true, data: { id: 'ann-1' } });
    });
    const client = new GcdrAnnotationsClient(baseParams(fetchImpl, { cacheTtlMs: 60_000 }));

    await client.list();
    await client.create({ entityType: 'device', entityId: 'd1', customerId: 'c1', text: 't' });
    await client.list();

    // 1 (initial GET) + 1 (create) + 1 (GET again, cache invalidated) = 3
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
