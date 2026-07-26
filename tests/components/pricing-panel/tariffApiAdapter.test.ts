/**
 * RFC-0228 A1 — TariffApiAdapter unit tests (pure mapping + a mocked client).
 *
 * Covers: category/domain maps both directions, price decimal-string
 * preservation + legacy `pricePerKwh` alias, write expansion (day→24h, band→hours),
 * read collapse (equal contiguous hours→band, unequal split, annual→year, empty),
 * leap-year handling, round-trip precision, and version-conflict surfacing.
 */

import { describe, it, expect, vi } from 'vitest';
import type {
  TariffApiClient,
  TariffTreeResponse,
} from '../../../src/components/pricing-panel/tariffApiClient';
import { TariffApiError } from '../../../src/components/pricing-panel/tariffApiClient';
import {
  PANEL_TO_WIRE_DOMAIN,
  PANEL_TO_WIRE_CATEGORY,
  panelDomainToWire,
  wireDomainToPanel,
  panelCategoryToWire,
  wireCategoryToPanel,
  normalizePriceString,
  isLeapYear,
  daysInMonthYear,
  assertValidCivilDate,
  eachDate,
  normalizeBand,
  panelEntryToBand,
  bandToPanelEntry,
  expandDayToHourBuckets,
  expandBandHours,
  expandBandToHourBucketsByYear,
  collapseHoursToBands,
  collapseTreeToBands,
  TariffApiAdapter,
  type TariffBand,
} from '../../../src/components/pricing-panel/tariffApiAdapter';
import type { PricingEntry } from '../../../src/components/pricing-panel/types';

// ---------------------------------------------------------------------------
// Dimension maps (both directions)
// ---------------------------------------------------------------------------
describe('category & domain maps', () => {
  it('maps domains both directions (all values)', () => {
    expect(panelDomainToWire('energy')).toBe('ENERGY');
    expect(panelDomainToWire('water')).toBe('WATER');
    expect(wireDomainToPanel('ENERGY')).toBe('energy');
    expect(wireDomainToPanel('WATER')).toBe('water');
    expect(PANEL_TO_WIRE_DOMAIN.energy).toBe('ENERGY');
  });

  it('maps categories both directions (lojas=SPECIFIC, area_comum=COMMON_AREA)', () => {
    expect(panelCategoryToWire('lojas')).toBe('SPECIFIC');
    expect(panelCategoryToWire('area_comum')).toBe('COMMON_AREA');
    expect(wireCategoryToPanel('SPECIFIC')).toBe('lojas');
    expect(wireCategoryToPanel('COMMON_AREA')).toBe('area_comum');
    expect(PANEL_TO_WIRE_CATEGORY.area_comum).toBe('COMMON_AREA');
  });

  it('round-trips every value', () => {
    (['energy', 'water'] as const).forEach((d) => expect(wireDomainToPanel(panelDomainToWire(d))).toBe(d));
    (['lojas', 'area_comum'] as const).forEach((c) =>
      expect(wireCategoryToPanel(panelCategoryToWire(c))).toBe(c)
    );
  });
});

// ---------------------------------------------------------------------------
// Price normalization + legacy alias
// ---------------------------------------------------------------------------
describe('normalizePriceString', () => {
  it('preserves a decimal string verbatim (no Number() drift)', () => {
    expect(normalizePriceString({ price: '0.892000' })).toBe('0.892000');
    expect(normalizePriceString({ price: '2.000000' })).toBe('2.000000');
    expect(normalizePriceString({ price: ' 1.234560 ' })).toBe('1.234560');
  });

  it('accepts the legacy numeric pricePerKwh alias and normalizes to a string', () => {
    expect(normalizePriceString({ pricePerKwh: 0.75 })).toBe('0.75');
    expect(normalizePriceString({ pricePerKwh: 2 })).toBe('2.00');
  });

  it('rejects non-positive prices', () => {
    expect(() => normalizePriceString({ price: '0' })).toThrow();
    expect(() => normalizePriceString({ pricePerKwh: -1 })).toThrow();
    expect(() => normalizePriceString({})).toThrow();
  });

  it('normalizeBand never echoes pricePerKwh; canonical price only', () => {
    const band = normalizeBand({
      domain: 'energy',
      category: 'lojas',
      periodType: 'day',
      date: '2026-07-01',
      pricePerKwh: 0.9,
    });
    expect(band.price).toBe('0.90');
    expect('pricePerKwh' in band).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Leap year / calendar
// ---------------------------------------------------------------------------
describe('leap year & calendar', () => {
  it('classifies leap years', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });

  it('Feb has 29 days in a leap year, 28 otherwise', () => {
    expect(daysInMonthYear(2024, 2)).toBe(29);
    expect(daysInMonthYear(2023, 2)).toBe(28);
  });

  it('eachDate includes Feb 29 in a leap year and excludes it otherwise', () => {
    const leap = [...eachDate('2024-02-27', '2024-03-01')];
    expect(leap).toContain('2024-02-29');
    const nonLeap = [...eachDate('2023-02-27', '2023-03-01')];
    expect(nonLeap).not.toContain('2023-02-29');
    expect(nonLeap).toContain('2023-02-28');
  });

  it('assertValidCivilDate rejects 02-29 in a non-leap year', () => {
    expect(() => assertValidCivilDate('2023-02-29')).toThrow();
    expect(() => assertValidCivilDate('2024-02-29')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Write expansion
// ---------------------------------------------------------------------------
describe('write expansion → hourly buckets', () => {
  it('a day price expands to exactly 24 HOUR buckets (T00..T23)', () => {
    const buckets = expandDayToHourBuckets('2026-07-01', '2.000000');
    expect(buckets).toHaveLength(24);
    expect(buckets[0]).toEqual({ level: 'HOUR', ref: '2026-07-01T00', price: '2.000000' });
    expect(buckets[23]).toEqual({ level: 'HOUR', ref: '2026-07-01T23', price: '2.000000' });
    // never carries a numeric alias
    expect(buckets.every((b) => !('pricePerKwh' in b))).toBe(true);
  });

  it('an intraday band (18–19h) expands to exactly those two hours', () => {
    const buckets = expandBandHours('2026-07-01', 18, 19, '1.200000');
    expect(buckets).toEqual([
      { level: 'HOUR', ref: '2026-07-01T18', price: '1.200000' },
      { level: 'HOUR', ref: '2026-07-01T19', price: '1.200000' },
    ]);
  });

  it('a range expands to every hour of every day, grouped by year', () => {
    const band: TariffBand = {
      domain: 'energy',
      category: 'lojas',
      periodType: 'range',
      start: '2026-07-01',
      end: '2026-07-02',
      price: '0.500000',
    };
    const byYear = expandBandToHourBucketsByYear(band);
    expect([...byYear.keys()]).toEqual([2026]);
    expect(byYear.get(2026)).toHaveLength(48);
  });

  it('a cross-year range writes once per year', () => {
    const band: TariffBand = {
      domain: 'energy',
      category: 'lojas',
      periodType: 'range',
      start: '2025-12-31',
      end: '2026-01-01',
      price: '0.500000',
    };
    const byYear = expandBandToHourBucketsByYear(band);
    expect([...byYear.keys()].sort()).toEqual([2025, 2026]);
    expect(byYear.get(2025)).toHaveLength(24);
    expect(byYear.get(2026)).toHaveLength(24);
  });
});

// ---------------------------------------------------------------------------
// Read collapse
// ---------------------------------------------------------------------------
const DIMS = { domain: 'energy', category: 'lojas' } as const;

describe('read collapse ← hourly tree', () => {
  it('24 equal hours collapse to a single day band', () => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, price: '2.000000' }));
    const bands = collapseHoursToBands('2026-07-01', hours, DIMS);
    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ periodType: 'day', date: '2026-07-01', price: '2.000000' });
  });

  it('equal contiguous hours collapse into one band; a differing window stays split', () => {
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      price: h === 18 || h === 19 ? '4.000000' : '2.000000',
    }));
    const bands = collapseHoursToBands('2026-07-01', hours, DIMS);
    // 00–17 band, 18–19 band, 20–23 band
    expect(bands).toHaveLength(3);
    expect(bands[0]).toMatchObject({ periodType: 'band', startHour: 0, endHour: 17, price: '2.000000' });
    expect(bands[1]).toMatchObject({ periodType: 'band', startHour: 18, endHour: 19, price: '4.000000' });
    expect(bands[2]).toMatchObject({ periodType: 'band', startHour: 20, endHour: 23, price: '2.000000' });
  });

  it('alternating unequal hours stay fully split', () => {
    const hours = [
      { hour: 0, price: '1.000000' },
      { hour: 1, price: '2.000000' },
      { hour: 2, price: '1.000000' },
    ];
    const bands = collapseHoursToBands('2026-07-01', hours, DIMS);
    expect(bands).toHaveLength(3);
  });

  it('an annual uniform tree collapses to one year band', () => {
    const bands = collapseTreeToBands(
      { annual: { price: '0.892000' } },
      { year: 2026, domain: 'energy', category: 'lojas' }
    );
    expect(bands).toEqual([
      { domain: 'energy', category: 'lojas', periodType: 'year', year: 2026, price: '0.892000' },
    ]);
  });

  it('an empty tree collapses to no bands', () => {
    expect(collapseTreeToBands({}, { year: 2026, domain: 'energy', category: 'lojas' })).toEqual([]);
  });

  it('a daily tree with a day price + intraday override collapses to day+band pieces', () => {
    const tree = {
      daily: {
        '07-01': {
          price: '2.000000',
          hourly: { '15': { price: '4.000000' } },
        },
      },
    };
    const bands = collapseTreeToBands(tree, { year: 2026, domain: 'energy', category: 'lojas' });
    // 00–14 @2, 15 @4, 16–23 @2
    expect(bands).toHaveLength(3);
    expect(bands.map((b) => b.price)).toEqual(['2.000000', '4.000000', '2.000000']);
    expect(bands[1]).toMatchObject({ periodType: 'band', startHour: 15, endHour: 15 });
  });

  it('contiguous equal-price full days merge into a single range', () => {
    const tree = {
      daily: {
        '07-01': { price: '2.000000' },
        '07-02': { price: '2.000000' },
        '07-03': { price: '2.000000' },
      },
    };
    const bands = collapseTreeToBands(tree, { year: 2026, domain: 'energy', category: 'lojas' });
    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({
      periodType: 'range',
      start: '2026-07-01',
      end: '2026-07-03',
      price: '2.000000',
    });
  });
});

// ---------------------------------------------------------------------------
// Decimal-string round-trip
// ---------------------------------------------------------------------------
describe('decimal-string round-trip', () => {
  it('"0.892000" survives expand → tree → collapse unchanged', () => {
    const buckets = expandDayToHourBuckets('2026-07-01', '0.892000');
    // Simulate the server echoing those hours back as a tree.
    const hourly: Record<string, { price: string }> = {};
    buckets.forEach((b) => {
      const h = String(Number(b.ref.slice(-2)));
      hourly[h] = { price: b.price };
    });
    const bands = collapseTreeToBands(
      { daily: { '07-01': { hourly } } },
      { year: 2026, domain: 'energy', category: 'lojas' }
    );
    expect(bands).toHaveLength(1);
    expect(bands[0].price).toBe('0.892000');
  });
});

// ---------------------------------------------------------------------------
// Panel entry ↔ band
// ---------------------------------------------------------------------------
describe('panel entry ↔ band', () => {
  it('a month PricingEntry maps to a month band with a decimal-string price', () => {
    const e: PricingEntry = {
      customerId: 'c',
      domain: 'energy',
      category: 'lojas',
      periodType: 'month',
      periodKey: '2026-03',
      pricePerKwh: 0.75,
      currency: 'BRL',
    };
    const band = panelEntryToBand(e);
    expect(band).toMatchObject({ periodType: 'month', periodKey: '2026-03', price: '0.75' });
  });

  it('a band maps back to a PricingEntry with canonical price + numeric render view', () => {
    const entry = bandToPanelEntry(
      { domain: 'water', category: 'area_comum', periodType: 'range', start: '2026-01-01', end: '2026-12-31', price: '9.500000' },
      'c'
    );
    expect(entry.price).toBe('9.500000');
    expect(entry.pricePerKwh).toBe(9.5);
    expect(entry.periodType).toBe('range');
  });
});

// ---------------------------------------------------------------------------
// Adapter orchestration (mocked client)
// ---------------------------------------------------------------------------
function emptyTariff(sel: { domain: string; category: string; year: number }): TariffTreeResponse {
  return {
    customerId: 'c',
    domain: sel.domain as 'ENERGY' | 'WATER',
    category: sel.category as 'SPECIFIC' | 'COMMON_AREA',
    year: sel.year,
    version: 0,
    tree: {},
  };
}

function mockClient(overrides: Partial<Record<keyof TariffApiClient, unknown>> = {}) {
  return {
    getTariff: vi.fn(async (sel: { domain: string; category: string; year: number }) => emptyTariff(sel)),
    putTariff: vi.fn(async () => ({ version: 1 })),
    patchTariff: vi.fn(async () => ({ version: 1 })),
    deleteTariff: vi.fn(async () => ({ version: 1 })),
    ...overrides,
  } as unknown as TariffApiClient & {
    getTariff: ReturnType<typeof vi.fn>;
    putTariff: ReturnType<typeof vi.fn>;
    patchTariff: ReturnType<typeof vi.fn>;
    deleteTariff: ReturnType<typeof vi.fn>;
  };
}

describe('TariffApiAdapter', () => {
  it('loads all four combos; an empty tariff (version 0) yields no entries', async () => {
    const client = mockClient();
    const adapter = new TariffApiAdapter(client, { year: 2026 });
    const entries = await adapter.loadEntriesForCustomer('c');
    expect(client.getTariff).toHaveBeenCalledTimes(4); // ENERGY/WATER × SPECIFIC/COMMON_AREA
    expect(entries).toEqual([]);
  });

  it('collapses a loaded annual tariff into one panel entry', async () => {
    const client = mockClient({
      getTariff: vi.fn(async (sel: { domain: string; category: string; year: number }) =>
        sel.domain === 'ENERGY' && sel.category === 'SPECIFIC'
          ? { ...emptyTariff(sel), version: 3, tree: { annual: { price: '0.892000' } } }
          : emptyTariff(sel)
      ),
    });
    const adapter = new TariffApiAdapter(client, { year: 2026 });
    const entries = await adapter.loadEntriesForCustomer('c');
    expect(entries).toHaveLength(1);
    expect(entries[0].price).toBe('0.892000');
    expect(entries[0]).toMatchObject({ domain: 'energy', category: 'lojas', periodType: 'range' });
  });

  it('saveEntry(month) PATCHes hourly buckets with the seen version as the guard', async () => {
    const client = mockClient({
      getTariff: vi.fn(async (sel: { domain: string; category: string; year: number }) => ({
        ...emptyTariff(sel),
        version: 5,
      })),
    });
    const adapter = new TariffApiAdapter(client, { year: 2026 });
    await adapter.loadEntriesForCustomer('c'); // seeds version cache to 5
    const entry: PricingEntry = {
      customerId: 'c',
      domain: 'energy',
      category: 'lojas',
      periodType: 'month',
      periodKey: '2026-03',
      pricePerKwh: 0.9,
      currency: 'BRL',
    };
    await adapter.saveEntry('c', entry);
    expect(client.patchTariff).toHaveBeenCalledTimes(1);
    const [sel, buckets, expectedVersion] = client.patchTariff.mock.calls[0];
    expect(sel).toMatchObject({ domain: 'ENERGY', category: 'SPECIFIC', year: 2026 });
    expect(expectedVersion).toBe(5);
    expect(buckets).toHaveLength(31 * 24); // March 2026
    expect(buckets[0].price).toBe('0.90');
  });

  it('saveEntry(year band) PUTs an annual replace with a decimal-string price', async () => {
    const client = mockClient();
    const adapter = new TariffApiAdapter(client, { year: 2026 });
    await adapter.saveEntry('c', {
      domain: 'water',
      category: 'area_comum',
      periodType: 'year',
      year: 2026,
      price: '7.500000',
    });
    expect(client.putTariff).toHaveBeenCalledTimes(1);
    const [sel, tree] = client.putTariff.mock.calls[0];
    expect(sel).toMatchObject({ domain: 'WATER', category: 'COMMON_AREA', year: 2026 });
    expect(tree).toEqual({ annual: { price: '7.500000' } });
  });

  it('deleteEntry(single day) issues a DAY sub-bucket DELETE', async () => {
    const client = mockClient();
    const adapter = new TariffApiAdapter(client, { year: 2026 });
    const entry: PricingEntry = {
      customerId: 'c',
      domain: 'energy',
      category: 'lojas',
      periodType: 'range',
      start: '2026-07-01',
      end: '2026-07-01',
      pricePerKwh: 1,
      currency: 'BRL',
    };
    await adapter.deleteEntry('c', entry);
    expect(client.deleteTariff).toHaveBeenCalledTimes(1);
    const [sel, opts] = client.deleteTariff.mock.calls[0];
    expect(sel).toMatchObject({ domain: 'ENERGY', category: 'SPECIFIC', year: 2026 });
    expect(opts.bucket).toEqual({ level: 'DAY', ref: '2026-07-01' });
  });

  it('surfaces a 409 TARIFF_VERSION_CONFLICT from a write (never swallowed)', async () => {
    const conflict = new TariffApiError('TARIFF_VERSION_CONFLICT', 409, 'stale', { currentVersion: 12 });
    const client = mockClient({
      patchTariff: vi.fn(async () => {
        throw conflict;
      }),
    });
    const adapter = new TariffApiAdapter(client, { year: 2026 });
    const entry: PricingEntry = {
      customerId: 'c',
      domain: 'energy',
      category: 'lojas',
      periodType: 'range',
      start: '2026-07-01',
      end: '2026-07-01',
      pricePerKwh: 1,
      currency: 'BRL',
    };
    await expect(adapter.saveEntry('c', entry)).rejects.toMatchObject({
      code: 'TARIFF_VERSION_CONFLICT',
      currentVersion: 12,
    });
  });
});
