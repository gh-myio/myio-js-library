/**
 * RFC-0228 F0 — GoalsMoneyClient (mocked fetch, no live backend).
 *
 * Proves: the withMoney read parses tree + normalized overlay and keeps every
 * amount a decimal string (no drift on "223000.00"); budget PUT sends the
 * decimal tree + expectedVersion + If-Match; a 409 GOAL_VERSION_CONFLICT is
 * surfaced (not swallowed) with currentVersion.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createGoalsMoneyClient,
  GoalsMoneyApiError,
} from '../../../src/components/financial-goals/goalsMoneyClient';

const BASE = 'https://gcdr-api.example.com';

function jsonResponse(body: unknown, init?: { status?: number; etag?: string }): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init?.etag) headers.ETag = init.etag;
  return new Response(JSON.stringify(body), { status: init?.status ?? 200, headers });
}

describe('getGoalWithMoney', () => {
  it('parses the quantity tree + overlay and preserves amounts as decimal strings', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          customerId: 'c1',
          domain: 'ENERGY',
          year: 2026,
          measure: 'QUANTITY',
          version: 5,
          unit: 'kWh',
          money: {
            currency: 'BRL',
            coverageComplete: false,
            pricedHours: 61320,
            totalHours: 87600,
            tariffCoverageGaps: { missing: ['2026-03-01T00'], truncated: false, missingHours: 24 },
            uncategorizedDevices: [{ deviceId: 'd1', code: 'Q303A_L3', label: 'Loja 303A' }],
          },
          budget: {
            projected: { amount: '128000.00', source: 'OVERLAY', coverageComplete: false },
            target: { amount: '120000.00', source: 'NATIVE' },
            variance: null,
            withinBudget: null,
          },
          tree: { annual: { value: 250000, monetaryValue: '223000.00' } },
        },
        { etag: '"5"' }
      )
    );
    const client = createGoalsMoneyClient({ baseUrl: BASE, apiKey: 'gcdr_cust_x', fetchImpl });

    const res = await client.getGoalWithMoney({
      customerId: 'c1',
      domain: 'ENERGY',
      year: 2026,
      granularity: 'month',
    });

    // URL carries withMoney=true and no measure (it is a QUANTITY overlay read).
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain('/customers/c1/goals');
    expect(url).toContain('withMoney=true');
    expect(url).toContain('domain=ENERGY');
    expect(url).toContain('granularity=month');
    expect(url).not.toContain('measure=');

    expect(res.version).toBe(5);
    expect(res.measure).toBe('QUANTITY');
    // monetaryValue preserved verbatim as a string — no float drift.
    expect(res.goal.tree.annual?.monetaryValue).toBe('223000.00');
    expect(typeof res.goal.tree.annual?.monetaryValue).toBe('string');
    // The quantity value stays a number (it is a quantity, not money).
    expect(res.goal.tree.annual?.value).toBe(250000);

    expect(res.money.state).toBe('available');
    if (res.money.state === 'available') {
      expect(res.money.budget!.projected.amount).toBe('128000.00');
      expect(res.money.budget!.target!.amount).toBe('120000.00');
      expect(res.money.budget!.verdict.withinBudget).toBeNull();
      expect(res.money.uncategorizedDevices[0].code).toBe('Q303A_L3');
    }
  });

  it('customer-granular goal → money overlay unavailable (a value, not an error)', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        customerId: 'c1',
        domain: 'ENERGY',
        year: 2026,
        measure: 'QUANTITY',
        version: 2,
        money: { reason: 'MONEY_REQUIRES_DEVICE_GRANULARITY' },
        tree: { annual: { value: 250000 } },
      })
    );
    const client = createGoalsMoneyClient({ baseUrl: BASE, jwt: 'jwt', fetchImpl });
    const res = await client.getGoalWithMoney({ customerId: 'c1', domain: 'ENERGY', year: 2026 });
    expect(res.money.state).toBe('unavailable');
    if (res.money.state === 'unavailable') {
      expect(res.money.reason).toBe('MONEY_REQUIRES_DEVICE_GRANULARITY');
    }
  });
});

describe('getBudget', () => {
  it('reads the CURRENCY goal and keeps the tree verbatim', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          customerId: 'c1',
          domain: 'ENERGY',
          year: 2026,
          measure: 'CURRENCY',
          currency: 'BRL',
          version: 3,
          tree: { annual: { value: '120000.00' } },
        },
        { etag: '"3"' }
      )
    );
    const client = createGoalsMoneyClient({ baseUrl: BASE, apiKey: 'k', fetchImpl });
    const res = await client.getBudget({ customerId: 'c1', domain: 'ENERGY', year: 2026 });
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain('measure=CURRENCY');
    expect(res.version).toBe(3);
    expect(res.tree.annual?.value).toBe('120000.00');
  });
});

describe('putBudget', () => {
  it('sends the decimal tree + expectedVersion in body and If-Match header', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ version: 4 }, { etag: '"4"' }));
    const client = createGoalsMoneyClient({ baseUrl: BASE, apiKey: 'k', fetchImpl });

    const out = await client.putBudget({
      customerId: 'c1',
      domain: 'ENERGY',
      year: 2026,
      tree: { annual: { value: '120000.00' } },
      expectedVersion: 3,
    });

    expect(out.version).toBe(4);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('measure=CURRENCY');
    expect(init.method).toBe('PUT');
    const headers = init.headers as Record<string, string>;
    expect(headers['If-Match']).toBe('"3"');
    const body = JSON.parse(String(init.body));
    // Decimal string preserved in the wire body (no numeric coercion).
    expect(body.annual.value).toBe('120000.00');
    expect(typeof body.annual.value).toBe('string');
    expect(body.expectedVersion).toBe(3);
  });

  it('surfaces 409 GOAL_VERSION_CONFLICT with currentVersion (not swallowed)', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: { code: 'GOAL_VERSION_CONFLICT', message: 'stale', details: { currentVersion: 9 } } },
        { status: 409 }
      )
    );
    const client = createGoalsMoneyClient({ baseUrl: BASE, apiKey: 'k', fetchImpl });

    await expect(
      client.putBudget({
        customerId: 'c1',
        domain: 'ENERGY',
        year: 2026,
        tree: { annual: { value: '120000.00' } },
        expectedVersion: 3,
      })
    ).rejects.toMatchObject({ code: 'GOAL_VERSION_CONFLICT', status: 409, currentVersion: 9 });

    // And it is the typed error class.
    try {
      await client.putBudget({
        customerId: 'c1',
        domain: 'ENERGY',
        year: 2026,
        tree: { annual: { value: '1.00' } },
        expectedVersion: 3,
      });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(GoalsMoneyApiError);
    }
  });
});

describe('deleteBudget', () => {
  it('idempotent whole-year delete returns {} on 204', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const client = createGoalsMoneyClient({ baseUrl: BASE, apiKey: 'k', fetchImpl });
    const out = await client.deleteBudget({ customerId: 'c1', domain: 'ENERGY', year: 2026 });
    expect(out).toEqual({});
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('measure=CURRENCY');
    expect(init.method).toBe('DELETE');
  });

  it('guarded delete sends If-Match + expectedVersion', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ version: 5 }));
    const client = createGoalsMoneyClient({ baseUrl: BASE, apiKey: 'k', fetchImpl });
    await client.deleteBudget({ customerId: 'c1', domain: 'ENERGY', year: 2026, expectedVersion: 4 });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['If-Match']).toBe('"4"');
    expect(JSON.parse(String(init.body)).expectedVersion).toBe(4);
  });
});
