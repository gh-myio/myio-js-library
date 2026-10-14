// tests/components/premium-modals-auth-recovery.test.ts
// RFC-0224 (phase 4, Shopping): AuthClient.fetch and the modals opened from the Shopping
// dashboard (AllReport, energy modal) renew an expired token once and repeat the request.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthClient } from '../../src/components/premium-modals/internal/engines/AuthClient';
import { EnergyDataFetcher } from '../../src/components/premium-modals/energy/EnergyDataFetcher';
import { AllReportModal } from '../../src/components/premium-modals/report-all/AllReportModal';
import { clearAllAuthCaches } from '../../src/services/ingestion/buildMyioIngestionAuth';
import { resetIngestionAuthRecoveryState, setIngestionAuthRecoveryEnabled } from '../../src/services/ingestion/ingestionFetch';

const HOST = 'https://api.example.com/api/v1';
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** /auth hands out tok-N; the data API rejects the tokens listed in `rejected` with 401. */
function createServer(dataBody: unknown) {
  const state = { seq: 0, rejected: new Set<string>(), bearers: [] as string[], authCalls: 0, authDown: false };
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
    if (url === `${HOST}/auth`) {
      state.authCalls++;
      if (state.authDown) throw new TypeError('Failed to fetch');
      return json(200, { access_token: `tok-${++state.seq}`, expires_in: 3600 });
    }
    const bearer = (new Headers(init?.headers).get('Authorization') || '').replace(/^Bearer /, '');
    state.bearers.push(bearer);
    if (state.rejected.has(bearer)) return json(401, { error: 'Invalid token', message: 'Token verification failed' });
    return json(200, dataBody);
  });
  return { state, fetchFn };
}

let server: ReturnType<typeof createServer>;

beforeEach(() => {
  clearAllAuthCaches();
  resetIngestionAuthRecoveryState();
  setIngestionAuthRecoveryEnabled(true);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const useServer = (body: unknown) => {
  server = createServer(body);
  vi.stubGlobal('fetch', server.fetchFn);
};

describe('AuthClient.fetch', () => {
  it('with client credentials: a 401 renews the token once and repeats the request', async () => {
    useServer({ ok: true });
    const client = new AuthClient({ clientId: 'c', clientSecret: 's', base: HOST });
    await client.getBearer(); // tok-1, now "expired" on the server
    server.state.rejected.add('tok-1');
    const res = await client.fetch(`${HOST}/telemetry/x`, {}, { context: 'test', fallbackToken: 'static-token' });
    expect(res.status).toBe(200);
    expect(server.state.bearers).toEqual(['tok-1', 'tok-2']);
  });

  it('without client credentials: uses the given ingestionToken, as before', async () => {
    useServer({ ok: true });
    const res = await new AuthClient({}).fetch(`${HOST}/telemetry/x`, {}, { fallbackToken: 'static-token' });
    expect(res.status).toBe(200);
    expect(server.state.bearers).toEqual(['static-token']);
    expect(server.state.authCalls).toBe(0);
  });

  it('credentials that cannot produce a token fall back to the given ingestionToken', async () => {
    useServer({ ok: true });
    server.state.authDown = true;
    const client = new AuthClient({ clientId: 'c', clientSecret: 's', base: HOST });
    const res = await client.fetch(`${HOST}/telemetry/x`, {}, { fallbackToken: 'static-token' });
    expect(res.status).toBe(200);
    expect(server.state.bearers).toEqual(['static-token']);
  });

  it('no credentials and no token → clear error', async () => {
    useServer({ ok: true });
    await expect(new AuthClient({}).fetch(`${HOST}/telemetry/x`)).rejects.toThrow('ingestionToken is required');
  });
});

describe('AllReport (Relatórios) — the 401 of the showcase', () => {
  const params = (over: Record<string, unknown> = {}) =>
    ({
      customerId: 'cust-1',
      domain: 'energy',
      api: { clientId: 'c', clientSecret: 's', dataApiBaseUrl: HOST, ingestionToken: 'stale-token-from-dashboard-load' },
      ui: { theme: 'light' },
      itemsList: [],
      ...over,
    }) as never;

  it('totals: an expired token is renewed and the report loads', async () => {
    useServer({ data: [{ id: 'ing-1', total_value: 42 }] });
    const auth = new AuthClient({ clientId: 'c', clientSecret: 's', base: HOST });
    await auth.getBearer(); // the dashboard token (tok-1)…
    server.state.rejected.add('tok-1'); // …expired while the dashboard stayed open
    const modal = new AllReportModal(params());
    const data = await (modal as unknown as { fetchCustomerTotals(a: string, b: string): Promise<unknown> }).fetchCustomerTotals(
      '2026-10-01T00:00:00-03:00',
      '2026-10-14T00:00:00-03:00',
    );
    expect(data).toEqual({ data: [{ id: 'ing-1', total_value: 42 }] });
    expect(server.state.bearers).toEqual(['tok-1', 'tok-2']);
  });

  it('without client credentials the given token is used as before (and a 401 stays a 401)', async () => {
    useServer({ data: [] });
    server.state.rejected.add('stale');
    const modal = new AllReportModal(params({ api: { dataApiBaseUrl: HOST, ingestionToken: 'stale' } }));
    await expect(
      (modal as unknown as { fetchCustomerTotals(a: string, b: string): Promise<unknown> }).fetchCustomerTotals('a', 'b'),
    ).rejects.toThrow('Erro na API: 401');
    expect(server.state.authCalls).toBe(0);
  });
});

describe('Energy modal (EnergyDataFetcher)', () => {
  it('an expired token is renewed and the series loads', async () => {
    useServer({ data: [{ consumption: [{ timestamp: '2026-10-13T00:00:00.000Z', value: 5 }] }] });
    const fetcher = new EnergyDataFetcher({ dataApiHost: HOST, clientId: 'c', clientSecret: 's', ingestionToken: 'stale' });
    await new AuthClient({ clientId: 'c', clientSecret: 's', base: HOST }).getBearer();
    server.state.rejected.add('tok-1');
    const result = await fetcher.fetchEnergyData({
      ingestionId: 'ing-1',
      startISO: '2026-10-13T00:00:00.000Z',
      endISO: '2026-10-14T00:00:00.000Z',
      granularity: '1d',
    });
    expect(result).toBeTruthy();
    expect(server.state.bearers).toEqual(['tok-1', 'tok-2']);
  });
});
