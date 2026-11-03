/**
 * RFC-0228 A1 — TariffApiClient unit tests (mocked `fetch`, frozen contract).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  TariffApiClient,
  TariffApiError,
  unwrapGcdrEnvelope,
  type TariffSelector,
} from '../../../src/components/pricing-panel/tariffApiClient';

const SEL: TariffSelector = {
  customerId: 'cust-1',
  domain: 'ENERGY',
  category: 'SPECIFIC',
  year: 2026,
};

function jsonResponse(body: unknown, init: { status?: number; etag?: string } = {}): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (init.etag) headers.set('ETag', init.etag);
  return new Response(body == null ? '' : JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

function makeClient(fetchImpl: typeof fetch) {
  return new TariffApiClient({
    baseUrl: 'https://gcdr.example',
    apiKey: 'gcdr_cust_ABC',
    tenantId: 'tenant-9',
    fetchImpl,
  });
}

describe('TariffApiClient — GET', () => {
  it('builds the customer-scoped URL with domain/category/year/granularity and auth headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ version: 7, tree: { annual: { price: '0.892000' } } }, { etag: '"7"' })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const resp = await client.getTariff(SEL, 'hour');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/customers/cust-1/tariffs');
    expect(url).toContain('domain=ENERGY');
    expect(url).toContain('category=SPECIFIC');
    expect(url).toContain('year=2026');
    expect(url).toContain('granularity=hour');
    expect(init.method).toBe('GET');
    expect(init.headers['X-API-Key']).toBe('gcdr_cust_ABC');
    expect(init.headers['X-Tenant-Id']).toBe('tenant-9');

    expect(resp.version).toBe(7);
    // Price preserved verbatim as a decimal STRING (never Number()).
    expect(resp.tree.annual?.price).toBe('0.892000');
  });

  it('falls back to the ETag when the body omits version; empty tariff is version 0', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ tree: {} }, { etag: '"0"' }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const resp = await client.getTariff(SEL);
    expect(resp.version).toBe(0);
    expect(resp.tree).toEqual({});
  });
});

describe('TariffApiClient — writes carry the concurrency guard', () => {
  it('PUT sends If-Match header and body expectedVersion (equal), returns new version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ version: 8 }, { etag: '"8"' }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const res = await client.putTariff(SEL, { annual: { price: '1.000000' } }, 7);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/customers/cust-1/tariffs');
    expect(init.method).toBe('PUT');
    expect(init.headers['If-Match']).toBe('"7"');
    const body = JSON.parse(init.body);
    expect(body.expectedVersion).toBe(7);
    expect(body.annual.price).toBe('1.000000'); // decimal string, untouched
    expect(res.version).toBe(8);
  });

  it('PATCH sends sparse buckets with decimal-string prices', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ version: 9 }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await client.patchTariff(
      SEL,
      [{ level: 'HOUR', ref: '2026-07-01T18', price: '1.200000' }],
      8
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.buckets).toEqual([{ level: 'HOUR', ref: '2026-07-01T18', price: '1.200000' }]);
    expect(body.expectedVersion).toBe(8);
  });
});

describe('TariffApiClient — DELETE', () => {
  it('whole-year delete (204) returns {} without a body', async () => {
    // A 204 cannot carry a body via the Response constructor; the client only
    // reads `.status` on 204, so a minimal stub is sufficient.
    const fetchMock = vi.fn().mockResolvedValue({ status: 204 } as unknown as Response);
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const res = await client.deleteTariff(SEL);
    expect(res).toEqual({});
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });

  it('sub-bucket delete (200) sends the bucket + guard and returns the new version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ version: 10 }, { etag: '"10"' }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const res = await client.deleteTariff(SEL, {
      bucket: { level: 'DAY', ref: '2026-07-01' },
      expectedVersion: 9,
    });
    const init = fetchMock.mock.calls[0][1];
    const body = JSON.parse(init.body);
    expect(body.bucket).toEqual({ level: 'DAY', ref: '2026-07-01' });
    expect(body.expectedVersion).toBe(9);
    expect(init.headers['If-Match']).toBe('"9"');
    expect(res.version).toBe(10);
  });
});

describe('TariffApiClient — errors surface the stable code', () => {
  it('409 TARIFF_VERSION_CONFLICT throws a TariffApiError carrying currentVersion', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'TARIFF_VERSION_CONFLICT',
            message: 'stale',
            details: { currentVersion: 12 },
          },
        },
        { status: 409 }
      )
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.putTariff(SEL, { annual: { price: '1.000000' } }, 7)).rejects.toMatchObject({
      code: 'TARIFF_VERSION_CONFLICT',
      status: 409,
      currentVersion: 12,
    });
    await expect(
      client.putTariff(SEL, { annual: { price: '1.000000' } }, 7)
    ).rejects.toBeInstanceOf(TariffApiError);
  });

  it('422 TARIFF_PRICE_INVALID surfaces the code, not the message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: 'TARIFF_PRICE_INVALID', message: 'price ≤ 0' } }, { status: 422 })
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.patchTariff(SEL, [], 1)).rejects.toMatchObject({
      code: 'TARIFF_PRICE_INVALID',
      status: 422,
    });
  });
});

describe('TariffApiClient — GCDR success envelope { success, data, meta } (RFC-0241 rev. 2)', () => {
  const META = { requestId: 'r-1', timestamp: '2026-11-03T12:00:00Z' };

  it('GET unwraps body.data (tree + version) — production shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          customerId: 'cust-1',
          domain: 'ENERGY',
          category: 'SPECIFIC',
          year: 2026,
          unit: 'kWh',
          currency: 'BRL',
          tariffModel: 'FLAT',
          timezone: 'America/Sao_Paulo',
          version: 3,
          tree: { annual: { price: '0.950000' } },
        },
        meta: META,
      })
    );
    const resp = await makeClient(fetchMock as unknown as typeof fetch).getTariff(SEL);
    expect(resp.version).toBe(3);
    expect(resp.tree.annual?.price).toBe('0.950000');
    expect(resp.unit).toBe('kWh');
    expect(resp.tariffModel).toBe('FLAT');
    expect(resp.timezone).toBe('America/Sao_Paulo');
  });

  it('GET of an empty (never-set) tariff in the envelope → version 0, empty tree', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, data: { version: 0, tree: {} }, meta: META }));
    const resp = await makeClient(fetchMock as unknown as typeof fetch).getTariff(SEL);
    expect(resp.version).toBe(0);
    expect(resp.tree).toEqual({});
  });

  it('GET still accepts the bare shape (back-compat)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ version: 5, tree: { annual: { price: '1.000000' } } }));
    const resp = await makeClient(fetchMock as unknown as typeof fetch).getTariff(SEL);
    expect(resp.version).toBe(5);
    expect(resp.tree.annual?.price).toBe('1.000000');
  });

  it('PUT/PATCH read the new version from body.data (no drift → no 409 on 2nd save)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { version: 4 }, meta: META }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { version: 9 }, meta: META }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    expect(await client.putTariff(SEL, { annual: { price: '1.000000' } }, 3)).toEqual({ version: 4 });
    expect(
      await client.patchTariff(SEL, [{ level: 'DAY', ref: '2026-01-01', price: '2.000000' }], 8)
    ).toEqual({ version: 9 });
  });

  it('DELETE (bucket) reads the version from body.data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, data: { version: 12 }, meta: META }));
    const res = await makeClient(fetchMock as unknown as typeof fetch).deleteTariff(SEL, {
      bucket: { level: 'DAY', ref: '2026-02-01' },
      expectedVersion: 11,
    });
    expect(res).toEqual({ version: 12 });
  });

  it('error envelope { success:false, error } surfaces the stable code (e.g. missing tariffs:write scope)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: 'INSUFFICIENT_SCOPE', message: 'missing scope' }, meta: META },
        { status: 401 }
      )
    );
    await expect(
      makeClient(fetchMock as unknown as typeof fetch).putTariff(SEL, { annual: { price: '1.000000' } }, 0)
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_SCOPE', status: 401 });
  });

  it('unwrapGcdrEnvelope unwraps only success:true envelopes', () => {
    expect(unwrapGcdrEnvelope({ success: true, data: { a: 1 }, meta: {} })).toEqual({ a: 1 });
    expect(unwrapGcdrEnvelope({ a: 1 })).toEqual({ a: 1 });
    const err = { success: false, error: { code: 'X' } };
    expect(unwrapGcdrEnvelope(err)).toBe(err);
    expect(unwrapGcdrEnvelope(null)).toBe(null);
  });
});
