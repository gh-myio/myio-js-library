// tests/services/ingestion/ingestionFetch.test.ts
// RFC-0224 — Data API executor with token-expiry recovery, against a fake Ingestion server
// (/auth + one data endpoint). Covers the RFC §12 matrix and AC-01…AC-14.
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildMyioIngestionAuth, clearAllAuthCaches } from '../../../src/services/ingestion/buildMyioIngestionAuth';
import {
  ingestionFetch,
  ingestionAuthScopeId,
  onIngestionAuthLifecycle,
  setIngestionAuthRecoveryEnabled,
  resetIngestionAuthRecoveryState,
  type IngestionAuthLifecycleEvent,
  type IngestionFetchOptions,
} from '../../../src/services/ingestion/ingestionFetch';

const HOST = 'https://api.example.com/api/v1';
const DATA = `${HOST}/telemetry/customers/c-1/energy/devices/totals?startTime=2026-10-01`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Fake Ingestion API: /auth hands out tok-N to valid clients; data accepts only live tokens. */
function createServer() {
  const state = {
    seq: 0,
    live: new Set<string>(),
    clients: new Map<string, string>([
      ['client-a', 'secret-a'],
      ['client-b', 'secret-b'],
    ]),
    authMode: 'ok' as 'ok' | 'server_error' | 'network',
    dataMode: 'tokens' as 'tokens' | 'always401' | 'permission403' | 'expired403',
    authCalls: 0,
    dataCalls: 0,
    bearers: [] as string[],
    authGate: null as Promise<void> | null,
  };
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
    if (url === `${HOST}/auth`) {
      state.authCalls++;
      if (state.authGate) await state.authGate;
      if (state.authMode === 'network') throw new TypeError('Failed to fetch');
      if (state.authMode === 'server_error') return json(503, { error: 'unavailable' });
      const body = JSON.parse(String(init?.body));
      if (state.clients.get(body.client_id) !== body.client_secret) return json(401, { error: 'invalid_client' });
      const token = `tok-${++state.seq}`;
      state.live.add(token);
      return json(200, { access_token: token, expires_in: 3600 });
    }
    state.dataCalls++;
    const bearer = (new Headers(init?.headers).get('Authorization') || '').replace(/^Bearer /, '');
    state.bearers.push(bearer);
    if (state.dataMode === 'permission403') return json(403, { error: 'Forbidden', code: 'NO_PERMISSION' });
    if (state.dataMode === 'always401' || !state.live.has(bearer)) {
      if (state.dataMode === 'expired403') return json(403, { error: 'Forbidden', code: 'TOKEN_EXPIRED' });
      return json(401, { error: 'Invalid token', message: 'Token verification failed' });
    }
    return json(200, { data: [1, 2, 3] });
  });
  return { state, fetchFn, expireAll: () => state.live.clear() };
}

let server: ReturnType<typeof createServer>;
let events: IngestionAuthLifecycleEvent[];

const authFor = (clientId: string, clientSecret: string) =>
  buildMyioIngestionAuth({ dataApiHost: HOST, clientId, clientSecret, retryBaseMs: 1, retryMaxAttempts: 2 });

function call(over: Partial<IngestionFetchOptions> & { clientId?: string; secret?: string } = {}) {
  const { clientId = 'client-a', secret = 'secret-a', ...options } = over;
  return ingestionFetch(
    DATA,
    { headers: { Accept: 'application/json' } },
    {
      authScopeId: ingestionAuthScopeId(HOST, clientId),
      getAuth: () => authFor(clientId, secret),
      context: 'test',
      onLifecycleEvent: (e) => events.push(e),
      ...options,
    },
  );
}
const types = () => events.map((e) => e.type);

beforeEach(() => {
  clearAllAuthCaches();
  resetIngestionAuthRecoveryState();
  setIngestionAuthRecoveryEnabled(true);
  server = createServer();
  vi.stubGlobal('fetch', server.fetchFn);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  events = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ingestionFetch — normal requests', () => {
  it('valid token: one data call, Authorization set, other headers kept, no events', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(server.state.dataCalls).toBe(1);
    const init = server.fetchFn.mock.calls.find(([u]) => String(u).includes('/telemetry/'))![1]!;
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok-1');
    expect(headers.get('Accept')).toBe('application/json');
    expect(events).toEqual([]);
  });

  it('non-auth errors (500, 404) are returned as is', async () => {
    server.fetchFn.mockImplementationOnce(async () => json(200, { access_token: 'tok-x', expires_in: 3600 }));
    server.fetchFn.mockImplementationOnce(async () => json(500, { error: 'boom' }));
    expect((await call()).status).toBe(500);
    expect(events).toEqual([]);
  });
});

describe('ingestionFetch — RFC-0224 recovery', () => {
  it('AC-04/AC-05: 401 → one new token → the request is repeated once → result returned; refreshed after the data answer', async () => {
    await call(); // tok-1
    server.expireAll();
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [1, 2, 3] });
    expect(server.state.bearers.slice(-2)).toEqual(['tok-1', 'tok-2']);
    expect(types()).toEqual(['expired', 'refresh-started', 'refreshed']);
    expect(events[0]).toMatchObject({ status: 401, context: 'test' });
    expect(events[2]).toMatchObject({ credentialsRotated: false });
  });

  it('AC-01: 20 concurrent 401s on one scope → a single /auth, each request repeated once, one set of events', async () => {
    await call();
    server.expireAll();
    const authBefore = server.state.authCalls;
    const dataBefore = server.state.dataCalls;
    const results = await Promise.all(Array.from({ length: 20 }, () => call()));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(server.state.authCalls - authBefore).toBe(1);
    expect(server.state.dataCalls - dataBefore).toBe(40);
    expect(types().filter((t) => t === 'refresh-started')).toHaveLength(1);
    expect(types().filter((t) => t === 'refreshed')).toHaveLength(1);
    expect(types().filter((t) => t === 'expired')).toHaveLength(20); // one per logical operation
  });

  it('AC-02: two clients recover independently', async () => {
    await call({ clientId: 'client-a', secret: 'secret-a' });
    await call({ clientId: 'client-b', secret: 'secret-b' });
    server.expireAll();
    const [a, b] = await Promise.all([
      call({ clientId: 'client-a', secret: 'secret-a' }),
      call({ clientId: 'client-b', secret: 'secret-b' }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const started = events.filter((e) => e.type === 'refresh-started');
    expect(new Set(started.map((e) => e.scopeId)).size).toBe(2);
  });

  it('AC-03: a request that saw an old token reuses the recovery that already happened (no second /auth)', async () => {
    await call();
    const stale = authFor('client-a', 'secret-a');
    const { generation } = await stale.getTokenInfo();
    server.expireAll();
    await call(); // recovers: generation + 1
    const authBefore = server.state.authCalls;
    await stale.forceRefresh(generation); // late caller with the old generation
    expect(server.state.authCalls).toBe(authBefore);
  });

  it('AC-07: /auth rejects the old secret, credentials were rotated → new instance, last attempt succeeds', async () => {
    await call();
    server.expireAll();
    server.state.clients.set('client-a', 'secret-NEW'); // rotated in ThingsBoard SERVER_SCOPE
    const refreshCredentials = vi.fn(async () => authFor('client-a', 'secret-NEW'));
    const res = await call({ refreshCredentials });
    expect(res.status).toBe(200);
    expect(refreshCredentials).toHaveBeenCalledTimes(1);
    expect(types()).toEqual(['expired', 'refresh-started', 'refreshed']);
    expect(events[2]).toMatchObject({ credentialsRotated: true });
    expect(server.state.dataCalls).toBe(3); // first ok, the 401, the call after rotation
  });

  it('AC-08: /auth rejects and credentials did not change → failure without a third call', async () => {
    await call();
    server.expireAll();
    server.state.clients.delete('client-a'); // client revoked, nothing new to read
    const refreshCredentials = vi.fn(async () => null);
    const dataBefore = server.state.dataCalls;
    const res = await call({ refreshCredentials });
    expect(res.status).toBe(401);
    expect(server.state.dataCalls - dataBefore).toBe(1);
    expect(events.at(-1)).toMatchObject({ type: 'failed', category: 'invalid_client', retryable: false });
  });

  it('new token still gets 401 → credentials re-read once → controlled failure (no loop)', async () => {
    await call();
    server.state.dataMode = 'always401';
    const refreshCredentials = vi.fn(async () => null);
    const dataBefore = server.state.dataCalls;
    const res = await call({ refreshCredentials });
    expect(res.status).toBe(401);
    expect(refreshCredentials).toHaveBeenCalledTimes(1);
    expect(server.state.dataCalls - dataBefore).toBe(2);
    expect(events.at(-1)).toMatchObject({ type: 'failed', category: 'unauthorized', retryable: false });
  });

  it('AC-06: a 403 without an explicit token code is a permission error — returned, no recovery', async () => {
    await call();
    server.state.dataMode = 'permission403';
    const authBefore = server.state.authCalls;
    const res = await call({ isIngestionAuthError: async (r) => (await r.json()).code === 'TOKEN_EXPIRED' });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'NO_PERMISSION' }); // body still readable by the caller
    expect(server.state.authCalls).toBe(authBefore);
    expect(events).toEqual([]);
  });

  it('a 403 with the expired-token code follows the 401 flow', async () => {
    await call();
    server.expireAll();
    server.state.dataMode = 'expired403';
    const res = await call({ isIngestionAuthError: async (r) => (await r.json()).code === 'TOKEN_EXPIRED' });
    expect(res.status).toBe(200);
    expect(types()).toEqual(['expired', 'refresh-started', 'refreshed']);
    expect(events[0]).toMatchObject({ status: 403 });
  });

  it('AC-14: /auth down (503 / network) → retryable failure, no circuit breaker', async () => {
    await call();
    server.expireAll();
    server.state.authMode = 'server_error';
    expect((await call()).status).toBe(401);
    expect(events.at(-1)).toMatchObject({ type: 'failed', category: 'server', retryable: true });
    // with no token left, the next request cannot even start: the classified /auth error surfaces
    server.state.authMode = 'network';
    await expect(call()).rejects.toMatchObject({ name: 'IngestionAuthError', category: 'network', retryable: true });
    server.state.authMode = 'ok';
    events = [];
    expect((await call()).status).toBe(200); // not blocked by a breaker
  });

  it('AC-10: a final failure opens the circuit breaker — no /auth while open, recovery again after it', async () => {
    await call();
    server.state.dataMode = 'always401';
    await call({ breakerMs: 40 });
    const authBefore = server.state.authCalls;
    events = [];
    expect((await call({ breakerMs: 40 })).status).toBe(401);
    expect(server.state.authCalls).toBe(authBefore);
    expect(types()).toEqual(['expired', 'failed']);
    expect(events[1]).toMatchObject({ category: 'circuit_open' });
    await new Promise((r) => setTimeout(r, 60));
    server.state.dataMode = 'tokens';
    server.expireAll();
    expect((await call({ breakerMs: 40 })).status).toBe(200);
  });

  it('feature flag off: no refresh and no repetition — only the expired event', async () => {
    await call();
    server.expireAll();
    setIngestionAuthRecoveryEnabled(false);
    const authBefore = server.state.authCalls;
    expect((await call()).status).toBe(401);
    expect(server.state.authCalls).toBe(authBefore);
    expect(types()).toEqual(['expired']);
  });

  it('a throwing listener does not stop the recovery; global listeners receive the events', async () => {
    const global: string[] = [];
    const off1 = onIngestionAuthLifecycle(() => {
      throw new Error('listener bug');
    });
    const off2 = onIngestionAuthLifecycle((e) => global.push(e.type));
    try {
      await call();
      server.expireAll();
      expect((await call({ onLifecycleEvent: () => { throw new Error('bug'); } })).status).toBe(200);
      expect(global).toEqual(['expired', 'refresh-started', 'refreshed']);
    } finally {
      off1();
      off2();
    }
  });

  it('a network error of the data call itself is thrown as before', async () => {
    await call();
    server.fetchFn.mockImplementationOnce(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(call()).rejects.toThrow('Failed to fetch');
  });
});

describe('ingestionFetch — RFC-0224 safety', () => {
  it('AC-09: events never carry the bearer, the URL or credentials', async () => {
    await call();
    server.expireAll();
    server.state.clients.set('client-a', 'secret-NEW');
    await call({ refreshCredentials: async () => authFor('client-a', 'secret-NEW') });
    server.state.dataMode = 'always401';
    await call({ secret: 'secret-NEW', refreshCredentials: async () => null });
    expect(types()).toContain('failed');
    const dump = JSON.stringify(events);
    for (const secret of ['secret-a', 'secret-NEW', 'tok-', 'Bearer', 'telemetry', 'client-a']) {
      expect(dump).not.toContain(secret);
    }
    events.forEach((e) => expect(e.version).toBe(1));
  });

  it('scope ids are opaque and stable', () => {
    const id = ingestionAuthScopeId(HOST, 'client-a');
    expect(id).toMatch(/^ing_[0-9a-f]{8}$/);
    expect(ingestionAuthScopeId(HOST, 'client-a')).toBe(id);
    expect(ingestionAuthScopeId(HOST, 'client-b')).not.toBe(id);
  });

  it('works without browser globals: the executor and the primitive never touch window/document/location', () => {
    for (const file of ['ingestionFetch.ts', 'buildMyioIngestionAuth.ts']) {
      const src = readFileSync(`src/services/ingestion/${file}`, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(src).not.toMatch(/\bwindow\b|\bdocument\b|\blocation\b/);
    }
  });
});

describe('ingestionFetch — robustness', () => {
  it('works when Promise#finally is missing (pages with an old Promise polyfill)', async () => {
    const original = Promise.prototype.finally;
    // @ts-expect-error — simulate a polyfilled Promise without finally
    delete Promise.prototype.finally;
    try {
      await call();
      server.expireAll();
      const res = await Promise.all([call(), call()]);
      expect(res.map((r) => r.status)).toEqual([200, 200]);
      server.state.dataMode = 'always401';
      expect((await call({ refreshCredentials: async () => null })).status).toBe(401);
    } finally {
      Promise.prototype.finally = original;
    }
  });

  it('a refreshCredentials that throws synchronously ends as a controlled failure', async () => {
    await call();
    server.state.dataMode = 'always401';
    const res = await call({
      refreshCredentials: (() => {
        throw new Error('sync bug');
      }) as never,
    });
    expect(res.status).toBe(401);
    expect(events.at(-1)).toMatchObject({ type: 'failed', category: 'unauthorized' });
  });
});
