// tests/services/ingestion/buildMyioIngestionAuth.test.ts
// Ingestion auth primitive: shared token cache, single-flight, and (RFC-0224) generation-safe
// invalidation, forceRefresh, classified /auth errors and statistics without secrets.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildMyioIngestionAuth,
  clearAllAuthCaches,
  getAuthCacheStats,
  IngestionAuthError,
} from '../../../src/services/ingestion/buildMyioIngestionAuth';

const HOST = 'https://api.example.com/api/v1';
const fetchMock = vi.fn();

const okToken = (access_token: string, expires_in = 3600) =>
  ({ ok: true, status: 200, json: async () => ({ access_token, token_type: 'Bearer', expires_in }) }) as unknown as Response;
const httpError = (status: number, statusText = '') =>
  ({ ok: false, status, statusText, text: async () => 'echo of the request body' }) as unknown as Response;
/** A promise we resolve by hand, to control the order of concurrent /auth answers. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const auth = (over: Partial<Parameters<typeof buildMyioIngestionAuth>[0]> = {}) =>
  buildMyioIngestionAuth({ dataApiHost: HOST, clientId: 'test-client', clientSecret: 'test-secret', ...over });

beforeEach(() => {
  clearAllAuthCaches();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  clearAllAuthCaches();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('buildMyioIngestionAuth — token cache', () => {
  it('creates an instance with the full API', () => {
    const a = auth();
    for (const fn of ['getToken', 'getTokenInfo', 'forceRefresh', 'invalidate', 'getGeneration', 'getExpiryInfo', 'clearCache', 'isTokenValid']) {
      expect(typeof (a as unknown as Record<string, unknown>)[fn]).toBe('function');
    }
  });

  it('requires host, client id and secret', () => {
    expect(() => auth({ dataApiHost: '' })).toThrow('dataApiHost, clientId, and clientSecret are required');
    expect(() => auth({ clientId: '' })).toThrow('dataApiHost, clientId, and clientSecret are required');
    expect(() => auth({ clientSecret: '' })).toThrow('dataApiHost, clientId, and clientSecret are required');
  });

  it('POSTs the client credentials to {dataApiHost}/auth', async () => {
    fetchMock.mockResolvedValueOnce(okToken('test-token-123'));
    expect(await auth().getToken()).toBe('test-token-123');
    expect(fetchMock).toHaveBeenCalledWith(new URL(`${HOST}/auth`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'test-client', client_secret: 'test-secret' }),
    });
  });

  it('returns the cached token on later calls and shares it between instances with the same credentials', async () => {
    fetchMock.mockResolvedValueOnce(okToken('shared'));
    expect(await auth().getToken()).toBe('shared');
    expect(await auth().getToken()).toBe('shared');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps separate caches for different clients and for a rotated secret', async () => {
    fetchMock.mockResolvedValueOnce(okToken('a')).mockResolvedValueOnce(okToken('b')).mockResolvedValueOnce(okToken('c'));
    expect(await auth({ clientId: 'client1' }).getToken()).toBe('a');
    expect(await auth({ clientId: 'client2' }).getToken()).toBe('b');
    expect(await auth({ clientId: 'client1', clientSecret: 'rotated' }).getToken()).toBe('c');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('one /auth for concurrent callers', async () => {
    const answer = deferred<Response>();
    fetchMock.mockReturnValueOnce(answer.promise);
    const a = auth();
    const all = Promise.all([a.getToken(), a.getToken(), auth().getToken()]);
    answer.resolve(okToken('race'));
    expect(await all).toEqual(['race', 'race', 'race']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('expiry information and validity', async () => {
    fetchMock.mockResolvedValueOnce(okToken('t', 3600));
    const a = auth();
    expect(a.isTokenValid()).toBe(false);
    await a.getToken();
    expect(a.isTokenValid()).toBe(true);
    const info = a.getExpiryInfo();
    expect(info.expiresAt).toBeGreaterThan(Date.now());
    expect(info.expiresInSeconds).toBeGreaterThan(3500);
    expect(info.expiresInSeconds).toBeLessThanOrEqual(3600);
  });

  it('renews by clock before expiry (renewSkewSeconds)', async () => {
    fetchMock.mockResolvedValueOnce(okToken('short', 30)).mockResolvedValueOnce(okToken('renewed'));
    const a = auth({ renewSkewSeconds: 60 });
    expect(await a.getToken()).toBe('short');
    expect(await a.getToken()).toBe('renewed');
  });

  it('clearCache (compat) drops the token', async () => {
    fetchMock.mockResolvedValue(okToken('t'));
    const a = auth();
    await a.getToken();
    a.clearCache();
    expect(a.isTokenValid()).toBe(false);
    await a.getToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clearAllAuthCaches: instances keep working on a fresh entry (no orphan cache)', async () => {
    fetchMock.mockResolvedValue(okToken('t'));
    const a1 = auth({ clientId: 'client1' });
    const a2 = auth({ clientId: 'client2' });
    await a1.getToken();
    await a2.getToken();
    expect(getAuthCacheStats().totalCaches).toBe(2);
    clearAllAuthCaches();
    expect(getAuthCacheStats().totalCaches).toBe(0);
    expect(a1.isTokenValid()).toBe(false);
    await a1.getToken();
    expect(auth({ clientId: 'client1' }).isTokenValid()).toBe(true); // shares the new entry
  });
});

describe('buildMyioIngestionAuth — RFC-0224 generation and invalidation', () => {
  it('invalidate bumps the generation; the next token belongs to it', async () => {
    fetchMock.mockResolvedValueOnce(okToken('g0')).mockResolvedValueOnce(okToken('g1'));
    const a = auth();
    expect(await a.getTokenInfo()).toEqual({ token: 'g0', generation: 0 });
    a.invalidate('test');
    expect(a.getGeneration()).toBe(1);
    expect(a.isTokenValid()).toBe(false);
    expect(await a.getTokenInfo()).toEqual({ token: 'g1', generation: 1 });
  });

  it('AC-03: an /auth started before invalidate() never overwrites the newer token', async () => {
    const late = deferred<Response>();
    fetchMock.mockReturnValueOnce(late.promise).mockResolvedValueOnce(okToken('new'));
    const a = auth();
    const old = a.getToken(); // generation 0 in flight
    a.invalidate();
    expect(await a.getToken()).toBe('new'); // generation 1
    late.resolve(okToken('old'));
    expect(await old).toBe('old'); // its caller still gets an answer…
    expect(await a.getToken()).toBe('new'); // …but the cache keeps the newer token
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('forceRefresh(staleGeneration): one /auth even when many callers saw the same stale token', async () => {
    fetchMock.mockResolvedValueOnce(okToken('first')).mockResolvedValueOnce(okToken('second'));
    const a = auth();
    const { generation } = await a.getTokenInfo();
    const tokens = await Promise.all(Array.from({ length: 5 }, () => a.forceRefresh(generation)));
    expect(new Set(tokens)).toEqual(new Set(['second']));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(a.getGeneration()).toBe(generation + 1);
  });

  it('forceRefresh() without a generation always gets a new token', async () => {
    fetchMock.mockResolvedValueOnce(okToken('a')).mockResolvedValueOnce(okToken('b'));
    const a = auth();
    await a.getToken();
    expect(await a.forceRefresh()).toBe('b');
  });
});

describe('buildMyioIngestionAuth — RFC-0224 classified /auth errors', () => {
  it('network errors are retried with backoff (retryable)', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Server down'))
      .mockResolvedValueOnce(okToken('retry-token'));
    expect(await auth({ retryMaxAttempts: 3, retryBaseMs: 1 }).getToken()).toBe('retry-token');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('after the last attempt the network error surfaces with its category', async () => {
    fetchMock.mockRejectedValue(new Error('Persistent network error'));
    const err = await auth({ retryMaxAttempts: 2, retryBaseMs: 1 }).getToken().catch((e) => e);
    expect(err).toBeInstanceOf(IngestionAuthError);
    expect(err).toMatchObject({ category: 'network', retryable: true, status: null });
    expect(err.message).toContain('Persistent network error');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403])('HTTP %i → invalid_client, not retried, body not in the message', async (status) => {
    fetchMock.mockResolvedValue(httpError(status, 'Unauthorized'));
    const err = await auth({ retryMaxAttempts: 3, retryBaseMs: 1 }).getToken().catch((e) => e);
    expect(err).toMatchObject({ category: 'invalid_client', retryable: false, status });
    expect(err.message).toBe(`Auth failed: HTTP ${status} Unauthorized`);
    expect(err.message).not.toContain('echo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('HTTP 503 → server, retryable and retried', async () => {
    fetchMock.mockResolvedValueOnce(httpError(503)).mockResolvedValueOnce(okToken('ok'));
    expect(await auth({ retryMaxAttempts: 2, retryBaseMs: 1 }).getToken()).toBe('ok');
  });

  it('HTTP 404 → server, not retryable', async () => {
    fetchMock.mockResolvedValue(httpError(404, 'Not Found'));
    const err = await auth({ retryMaxAttempts: 3, retryBaseMs: 1 }).getToken().catch((e) => e);
    expect(err).toMatchObject({ category: 'server', retryable: false, status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('malformed answer → malformed_response, not retried', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ token_type: 'Bearer' }) } as unknown as Response);
    const err = await auth({ retryMaxAttempts: 3, retryBaseMs: 1 }).getToken().catch((e) => e);
    expect(err).toMatchObject({ category: 'malformed_response', retryable: false });
    expect(err.message).toContain('Auth response missing required fields');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('buildMyioIngestionAuth — AC-09 no secrets in statistics', () => {
  it('cache statistics expose opaque ids only', () => {
    auth({ clientId: 'client1', clientSecret: 'super-secret-1' });
    auth({ clientId: 'client2', clientSecret: 'super-secret-2' });
    const stats = getAuthCacheStats();
    expect(stats.totalCaches).toBe(2);
    expect(stats.cacheKeys).toHaveLength(2);
    const dump = JSON.stringify(stats);
    expect(dump).not.toContain('super-secret');
    expect(dump).not.toContain('client1');
    stats.cacheKeys.forEach((id) => expect(id).toMatch(/^auth_[0-9a-f]{8}$/));
  });
});
