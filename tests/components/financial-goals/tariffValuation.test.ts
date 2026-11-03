/**
 * RFC-0241 §5.3 — createTariffValuator golden vectors.
 *
 * Covers AC-13 (mid-period tariff change → piecewise sum), AC-14 (partial /
 * missing / uncategorized never yield an amount), AC-15 (parent = round(Σ raw),
 * no Number() round-trip of prices), intraday bands, mixed groups and the
 * consumption-granularity decision.
 */

import { describe, expect, it } from 'vitest';
import {
  createTariffValuator,
  formatMoneyBRL,
  MONEY_HOURLY_MAX_DAYS,
} from '../../../src/components/financial-goals';
import type { TariffTreeResponse } from '../../../src/components/pricing-panel';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Local midnight (America/Sao_Paulo, UTC−3, no DST since 2019) of `YYYY-MM-DD`. */
function spMidnight(date: string): number {
  return Date.parse(`${date}T00:00:00-03:00`);
}

function tree(year: number, t: TariffTreeResponse['tree'], category: 'SPECIFIC' | 'COMMON_AREA' = 'SPECIFIC'): TariffTreeResponse {
  return { customerId: 'gc-1', domain: 'ENERGY', category, year, version: 1, tree: t };
}

/** `n` daily buckets starting at `date`, each with `qty`. */
function dailyBuckets(date: string, n: number, qty: number | ((i: number) => number)) {
  const start = spMidnight(date);
  return Array.from({ length: n }, (_, i) => ({
    startTs: start + i * DAY,
    endTs: start + (i + 1) * DAY,
    qty: typeof qty === 'function' ? qty(i) : qty,
  }));
}

describe('createTariffValuator — priceAt resolution (hour > day > month > annual)', () => {
  const v = createTariffValuator({
    trees: {
      SPECIFIC: [
        tree(2026, {
          annual: { price: '0.500000' },
          monthly: {
            '03': { price: '0.600000', daily: { '10': { price: '0.700000', hourly: { '18': { price: '1.200000' } } } } },
          },
          daily: { '04-01': { price: '0.800000', hourly: { '07': { price: '0.900000' } } } },
        }),
      ],
    },
  });

  it('annual price applies when nothing finer exists', () => {
    expect(v.priceAt('SPECIFIC', spMidnight('2026-01-15') + 5 * HOUR)).toBe('0.500000');
  });
  it('month overrides annual', () => {
    expect(v.priceAt('SPECIFIC', spMidnight('2026-03-02'))).toBe('0.600000');
  });
  it('day (nested under month) overrides month; hour overrides day', () => {
    expect(v.priceAt('SPECIFIC', spMidnight('2026-03-10') + 10 * HOUR)).toBe('0.700000');
    expect(v.priceAt('SPECIFIC', spMidnight('2026-03-10') + 18 * HOUR)).toBe('1.200000');
  });
  it('top-level MM-DD day node and zero-padded hour keys are honoured', () => {
    expect(v.priceAt('SPECIFIC', spMidnight('2026-04-01') + 7 * HOUR)).toBe('0.900000');
    expect(v.priceAt('SPECIFIC', spMidnight('2026-04-01') + 8 * HOUR)).toBe('0.800000');
  });
  it('returns null outside any tariff year or for a category without trees', () => {
    expect(v.priceAt('SPECIFIC', spMidnight('2025-12-31'))).toBeNull();
    expect(v.priceAt('COMMON_AREA', spMidnight('2026-03-02'))).toBeNull();
  });
  it('resolves the local (São Paulo) day, not the UTC day', () => {
    // 2026-03-11T01:00Z is still 2026-03-10 22:00 in São Paulo.
    expect(v.priceAt('SPECIFIC', Date.parse('2026-03-11T01:00:00Z'))).toBe('0.700000');
  });
});

describe('createTariffValuator — valuate', () => {
  it('single price over the whole period → complete, exact decimal amount', () => {
    const v = createTariffValuator({ trees: { SPECIFIC: [tree(2026, { annual: { price: '0.892000' } })] } });
    const m = v.valuate({ deviceKey: 'd1', category: 'SPECIFIC', buckets: dailyBuckets('2026-05-01', 3, 100.5) });
    expect(m.state).toBe('complete');
    // 301.5 × 0.892 = 268.938
    expect(m.amount).toBe('268.938');
    expect(m.coveredRatio).toBe(1);
    expect(m.priceVaries).toBe(false);
    expect(formatMoneyBRL(m.amount)).toBe('R$ 268,94');
  });

  it('AC-13: tariff change on day 15 → Σ(qty_1..14 × p1) + Σ(qty_15..n × p2)', () => {
    const daily: Record<string, { price: string }> = {};
    for (let d = 15; d <= 31; d++) daily[String(d).padStart(2, '0')] = { price: '0.950000' };
    const v = createTariffValuator({
      trees: { SPECIFIC: [tree(2026, { monthly: { '07': { price: '0.800000', daily } } })] },
    });
    // qty_i = i + 1 (1..31)
    const m = v.valuate({
      deviceKey: 'd1',
      category: 'SPECIFIC',
      buckets: dailyBuckets('2026-07-01', 31, (i) => i + 1),
    });
    // Σ1..14 = 105 → × 0.80 = 84 ; Σ15..31 = 391 → × 0.95 = 371.45 ; total 455.45
    expect(m.state).toBe('complete');
    expect(m.amount).toBe('455.45');
    expect(m.priceVaries).toBe(true);
  });

  it('daily bucket with intraday bands → partial (needs-hourly); hourly buckets → complete', () => {
    const t = tree(2026, {
      annual: { price: '0.500000' },
      daily: { '08-03': { price: '0.500000', hourly: { '18': { price: '1.500000' }, '19': { price: '1.500000' } } } },
    });
    const v = createTariffValuator({ trees: { SPECIFIC: [t] } });
    const daily = v.valuate({ deviceKey: 'd', category: 'SPECIFIC', buckets: dailyBuckets('2026-08-02', 3, 24) });
    expect(daily.state).toBe('partial');
    expect(daily.reason).toBe('needs-hourly');
    expect(daily.amount).toBeUndefined();
    expect(daily.coveredRatio).toBeCloseTo(2 / 3);

    const start = spMidnight('2026-08-03');
    const hourly = Array.from({ length: 24 }, (_, h) => ({ startTs: start + h * HOUR, endTs: start + (h + 1) * HOUR, qty: 1 }));
    const m = v.valuate({ deviceKey: 'd', category: 'SPECIFIC', buckets: hourly });
    // 22 h × 0.5 + 2 h × 1.5 = 14
    expect(m.state).toBe('complete');
    expect(m.amount).toBe('14.00');
  });

  it('intradayLimited → reason intraday-tariff-long-period', () => {
    const v = createTariffValuator({
      trees: { SPECIFIC: [tree(2026, { annual: { price: '0.5' }, daily: { '08-03': { price: '0.5', hourly: { '18': { price: '1' } } } } })] },
    });
    const m = v.valuate(
      { deviceKey: 'd', category: 'SPECIFIC', buckets: dailyBuckets('2026-08-03', 1, 10) },
      { intradayLimited: true }
    );
    expect(m.state).toBe('none');
    expect(m.reason).toBe('intraday-tariff-long-period');
  });

  it('AC-14: gap in tariff coverage → partial, never an amount', () => {
    // Tariff only for 2026; period crosses into 2027.
    const v = createTariffValuator({ trees: { SPECIFIC: [tree(2026, { annual: { price: '0.7' } })] } });
    const m = v.valuate({ deviceKey: 'd', category: 'SPECIFIC', buckets: dailyBuckets('2026-12-30', 4, 10) });
    expect(m.state).toBe('partial');
    expect(m.reason).toBe('no-tariff');
    expect(m.amount).toBeUndefined();
    expect(m.coveredRatio).toBe(0.5);
  });

  it('AC-14: no tariff for the category / uncategorized / no data → no amount', () => {
    const v = createTariffValuator({ trees: { SPECIFIC: [tree(2026, { annual: { price: '0.7' } })] } });
    const none = v.valuate({ deviceKey: 'd', category: 'COMMON_AREA', buckets: dailyBuckets('2026-05-01', 2, 5) });
    expect(none).toMatchObject({ state: 'none', reason: 'no-tariff' });
    expect(none.amount).toBeUndefined();

    const unc = v.valuate({ deviceKey: 'd', category: null, buckets: dailyBuckets('2026-05-01', 2, 5) });
    expect(unc).toMatchObject({ state: 'uncategorized', reason: 'no-category' });
    expect(unc.amount).toBeUndefined();

    const empty = v.valuate({ deviceKey: 'd', category: 'SPECIFIC', buckets: [] });
    expect(empty).toMatchObject({ state: 'none', reason: 'no-data' });
  });

  it('invalid quantities are not silently priced as zero', () => {
    const v = createTariffValuator({ trees: { SPECIFIC: [tree(2026, { annual: { price: '0.7' } })] } });
    const b = dailyBuckets('2026-05-01', 2, 5);
    b[1].qty = Number.NaN;
    const m = v.valuate({ deviceKey: 'd', category: 'SPECIFIC', buckets: b });
    expect(m).toMatchObject({ state: 'partial', reason: 'invalid-qty' });
  });

  it('real zero consumption under full coverage is a legitimate complete 0', () => {
    const v = createTariffValuator({ trees: { SPECIFIC: [tree(2026, { annual: { price: '0.7' } })] } });
    const m = v.valuate({ deviceKey: 'd', category: 'SPECIFIC', buckets: dailyBuckets('2026-05-01', 2, 0) });
    expect(m).toMatchObject({ state: 'complete', amount: '0.00' });
  });

  it('AC-15: prices are not round-tripped through Number (high-precision price kept)', () => {
    // 0.123457 exceeds float-friendly cents; 1_000_000 kWh × 0.123457 = 123457 exactly.
    const v = createTariffValuator({ trees: { SPECIFIC: [tree(2026, { annual: { price: '0.123457' } })] } });
    const m = v.valuate({
      deviceKey: 'd',
      category: 'SPECIFIC',
      buckets: [{ startTs: spMidnight('2026-02-01'), endTs: spMidnight('2026-02-02'), qty: 1_000_000 }],
    });
    expect(m.amount).toBe('123457.00');
    // 0.1 + 0.2 style drift does not occur: 3 × 0.1 kWh × 1.000000
    const v2 = createTariffValuator({ trees: { SPECIFIC: [tree(2026, { annual: { price: '1.000000' } })] } });
    const m2 = v2.valuate({ deviceKey: 'd', category: 'SPECIFIC', buckets: dailyBuckets('2026-02-01', 3, 0.1) });
    expect(m2.amount).toBe('0.30');
  });
});

describe('createTariffValuator — sum (mixed groups, DEC-8)', () => {
  const v = createTariffValuator({
    trees: {
      SPECIFIC: [tree(2026, { annual: { price: '0.001000' } })],
      COMMON_AREA: [tree(2026, { annual: { price: '0.002000' } }, 'COMMON_AREA')],
    },
  });

  it('AC-15: parent total is round(Σ raw), not Σ round', () => {
    // Each device: 4 kWh × 0.001 = 0.004 → rounds to R$ 0,00 alone; Σ raw = 0.012 → R$ 0,01.
    const devices = [1, 2, 3].map((i) =>
      v.valuate({ deviceKey: `d${i}`, category: 'SPECIFIC', buckets: dailyBuckets('2026-05-01', 1, 4) })
    );
    devices.forEach((d) => expect(formatMoneyBRL(d.amount)).toBe('R$ 0,00'));
    const s = v.sum(devices);
    expect(s).toMatchObject({ state: 'complete', covered: 3, total: 3, amount: '0.012' });
    expect(formatMoneyBRL(s.amount)).toBe('R$ 0,01');
  });

  it('mixed categories are each priced by their own tariff; total only when all complete', () => {
    const a = v.valuate({ deviceKey: 'a', category: 'SPECIFIC', buckets: dailyBuckets('2026-05-01', 1, 1000) }); // 1.00
    const b = v.valuate({ deviceKey: 'b', category: 'COMMON_AREA', buckets: dailyBuckets('2026-05-01', 1, 1000) }); // 2.00
    expect(v.sum([a, b])).toMatchObject({ state: 'complete', amount: '3.00' });

    const c = v.valuate({ deviceKey: 'c', category: null, buckets: dailyBuckets('2026-05-01', 1, 1000) });
    const partial = v.sum([a, b, c]);
    expect(partial).toEqual({ state: 'partial', covered: 2, total: 3 });
    expect(partial.amount).toBeUndefined();
  });

  it('empty list / nothing complete → none, no amount', () => {
    expect(v.sum([])).toEqual({ state: 'none', covered: 0, total: 0 });
    expect(v.sum([{ state: 'uncategorized' }])).toEqual({ state: 'none', covered: 0, total: 1 });
  });
});

describe('createTariffValuator — chooseGranularity', () => {
  const flat = createTariffValuator({ trees: { SPECIFIC: [tree(2026, { annual: { price: '0.5' } })] } });
  const banded = createTariffValuator({
    trees: { SPECIFIC: [tree(2026, { annual: { price: '0.5' }, daily: { '05-10': { price: '0.5', hourly: { '18': { price: '1.0' } } } } })] },
  });

  it('1d when no day has intraday variation (even with a mid-period change)', () => {
    expect(flat.chooseGranularity(['SPECIFIC'], spMidnight('2026-05-01'), spMidnight('2026-06-01'))).toEqual({
      granularity: '1d',
      intradayLimited: false,
    });
  });
  it('1h when intraday bands exist and the period is ≤ MONEY_HOURLY_MAX_DAYS', () => {
    expect(MONEY_HOURLY_MAX_DAYS).toBe(31);
    expect(banded.chooseGranularity(['SPECIFIC'], spMidnight('2026-05-01'), spMidnight('2026-06-01'))).toEqual({
      granularity: '1h',
      intradayLimited: false,
    });
  });
  it('1d + intradayLimited when intraday bands exist and the period is longer', () => {
    expect(banded.chooseGranularity(['SPECIFIC'], spMidnight('2026-04-01'), spMidnight('2026-06-01'))).toEqual({
      granularity: '1d',
      intradayLimited: true,
    });
  });
});
