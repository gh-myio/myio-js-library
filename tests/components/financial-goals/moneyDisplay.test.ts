/**
 * RFC-0241 Part B (rev. 2) — "constant-price segments" valuation + display-mode helpers.
 *
 * Golden vectors: single price (zero extra Ingestion calls), mid-period price change
 * (AC-13), gap (AC-14), mixed group, uncategorized, hourly band → partial, too many
 * segments, Entrada excluded (Q8). Plus persistence (AC-17), category rule (Q3) and
 * the report money config (honest total, per-bucket valuation).
 */

import { describe, expect, it, vi } from 'vitest';
import {
  valuateDomainMoney,
  buildReportMoneyConfig,
  parseMoneyCategoryRule,
  resolveMoneyCategory,
  readValueDisplayMode,
  writeValueDisplayMode,
  resolveEffectiveDisplayMode,
  valueDisplayModeStorageKey,
  formatItemMoney,
  buildMoneyChipHTML,
  buildMoneyCoverageMarkerHTML,
  sumItemMoney,
  roundMoney2,
  MONEY_MAX_SEGMENT_FETCHES,
} from '../../../src/components/financial-goals';
import type { TariffTreeResponse, TariffTreeNode } from '../../../src/components/pricing-panel';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const sp = (date: string, h = 0) => Date.parse(`${date}T${String(h).padStart(2, '0')}:00:00-03:00`);

const RULE = parseMoneyCategoryRule({ source: 'classification', SPECIFIC: ['lojas'], COMMON_AREA: ['*'] });

type Trees = Partial<Record<string, Record<number, TariffTreeNode>>>; // category → year → tree

function loader(trees: Trees) {
  return vi.fn(async ({ category, year, domain }: { category: string; year: number; domain: string }) => {
    const t = trees[category]?.[year];
    return {
      customerId: 'gc',
      domain,
      category,
      year,
      version: t ? 1 : 0,
      tree: t || {},
    } as TariffTreeResponse;
  });
}

describe('valuateDomainMoney — golden vectors', () => {
  it('single price for the whole period: reuses MAIN totals (0 Ingestion calls) and values total × price', async () => {
    const fetchSeg = vi.fn();
    const r = await valuateDomainMoney({
      domain: 'energy',
      startTs: sp('2026-01-01'),
      endTs: sp('2026-02-01'),
      devices: [{ key: 'd1', group: 'lojas' }],
      rule: RULE,
      loadTree: loader({ SPECIFIC: { 2026: { annual: { price: '0.500000' } } } }),
      periodTotals: { d1: 100 },
      fetchSegmentTotals: fetchSeg,
    });
    expect(fetchSeg).not.toHaveBeenCalled();
    expect(r.segmentFetches).toBe(0);
    expect(r.byKey.get('d1')).toMatchObject({ state: 'complete', currency: 'BRL', coverage: 1 });
    expect(roundMoney2(r.byKey.get('d1')!.amount)).toBe('50.00');
    expect(r.coverage).toMatchObject({ state: 'complete', covered: 1, total: 1 });
  });

  it('AC-13: price change mid-period → Σ(qty₁ × p₁) + Σ(qty₂ × p₂), one /devices/totals per segment', async () => {
    const fetchSeg = vi.fn(async (s: number) => (s === sp('2026-01-20') ? { d1: 10 } : { d1: 20 }));
    const r = await valuateDomainMoney({
      domain: 'energy',
      startTs: sp('2026-01-20'),
      endTs: sp('2026-02-10'),
      devices: [{ key: 'd1', group: 'lojas' }],
      rule: RULE,
      loadTree: loader({
        SPECIFIC: { 2026: { monthly: { '01': { price: '0.500000' }, '02': { price: '0.800000' } } } },
      }),
      periodTotals: { d1: 30 },
      fetchSegmentTotals: fetchSeg,
    });
    expect(r.plan.segments).toHaveLength(2);
    expect(fetchSeg).toHaveBeenCalledTimes(2);
    expect(fetchSeg.mock.calls[0]).toEqual([sp('2026-01-20'), sp('2026-02-01')]);
    expect(fetchSeg.mock.calls[1]).toEqual([sp('2026-02-01'), sp('2026-02-10')]);
    const m = r.byKey.get('d1')!;
    expect(m.state).toBe('complete');
    expect(m.priceVaries).toBe(true);
    expect(roundMoney2(m.amount)).toBe('21.00'); // 10×0.5 + 20×0.8
  });

  it('a one-day override splits the period in three segments (day 15)', async () => {
    const fetchSeg = vi.fn(async (s: number) => (s === sp('2026-03-15') ? { d1: 4 } : { d1: 10 }));
    const r = await valuateDomainMoney({
      domain: 'water',
      startTs: sp('2026-03-10'),
      endTs: sp('2026-03-20'),
      devices: [{ key: 'd1', group: 'areacomum' }],
      rule: RULE,
      loadTree: loader({ COMMON_AREA: { 2026: { annual: { price: '10.000000' }, daily: { '03-15': { price: '12.500000' } } } } }),
      periodTotals: { d1: 24 },
      fetchSegmentTotals: fetchSeg,
    });
    expect(r.plan.segments.map((s) => [s.startTs, s.endTs])).toEqual([
      [sp('2026-03-10'), sp('2026-03-15')],
      [sp('2026-03-15'), sp('2026-03-16')],
      [sp('2026-03-16'), sp('2026-03-20')],
    ]);
    expect(roundMoney2(r.byKey.get('d1')!.amount)).toBe('250.00'); // 10×10 + 4×12.5 + 10×10
  });

  it('AC-14: tariff covers only part of the period → partial, no amount (never R$ 0)', async () => {
    const r = await valuateDomainMoney({
      domain: 'energy',
      startTs: sp('2025-12-25'),
      endTs: sp('2026-01-05'),
      devices: [{ key: 'd1', group: 'lojas' }],
      rule: RULE,
      loadTree: loader({ SPECIFIC: { 2026: { annual: { price: '1.000000' } } } }),
      periodTotals: { d1: 99 },
      fetchSegmentTotals: async () => ({ d1: 5 }),
    });
    const m = r.byKey.get('d1')!;
    expect(m.state).toBe('partial');
    expect(m.amount).toBeUndefined();
    expect(m.reason).toBe('no-tariff');
    expect(m.coverage).toBeGreaterThan(0.3);
    expect(m.coverage).toBeLessThan(0.4); // 4 of 11 days
    expect(formatItemMoney(m)).toBeNull();
  });

  it('no tariff at all for the category → missing ("Sem tarifa")', async () => {
    const r = await valuateDomainMoney({
      domain: 'energy',
      startTs: sp('2026-01-01'),
      endTs: sp('2026-01-31'),
      devices: [{ key: 'd1', group: 'lojas' }],
      rule: RULE,
      loadTree: loader({}),
      periodTotals: { d1: 1 },
    });
    expect(r.byKey.get('d1')).toMatchObject({ state: 'missing', reason: 'no-tariff' });
    expect(buildMoneyChipHTML(r.byKey.get('d1'))).toContain('Sem tarifa');
  });

  it('mixed group: R$ Σ only when every member is complete', async () => {
    const r = await valuateDomainMoney({
      domain: 'energy',
      startTs: sp('2026-01-01'),
      endTs: sp('2026-01-31'),
      devices: [
        { key: 'shop', group: 'lojas' },
        { key: 'common', group: 'areacomum' },
      ],
      rule: RULE,
      loadTree: loader({ SPECIFIC: { 2026: { annual: { price: '1.000000' } } } }), // no COMMON_AREA tariff
      periodTotals: { shop: 10, common: 20 },
    });
    expect(r.byKey.get('shop')!.state).toBe('complete');
    expect(r.byKey.get('common')!.state).toBe('missing');
    expect(r.coverage).toEqual({ state: 'partial', covered: 1, total: 2 });
    expect(buildMoneyCoverageMarkerHTML(r.coverage)).toContain('Cobertura incompleta (1 de 2)');
  });

  it('uncategorized: no customer rule → every device stays physical with "Sem categoria"', async () => {
    const load = loader({ SPECIFIC: { 2026: { annual: { price: '1.000000' } } } });
    const r = await valuateDomainMoney({
      domain: 'energy',
      startTs: sp('2026-01-01'),
      endTs: sp('2026-01-31'),
      devices: [{ key: 'd1', group: 'lojas' }],
      rule: null,
      loadTree: load,
      periodTotals: { d1: 1 },
    });
    expect(load).not.toHaveBeenCalled();
    expect(r.byKey.get('d1')).toMatchObject({ state: 'uncategorized' });
    expect(buildMoneyChipHTML(r.byKey.get('d1'))).toContain('Sem categoria');
  });

  it('hourly band inside a day → partial ("tarifa horária ainda não suportada"), no per-hour fetching', async () => {
    const fetchSeg = vi.fn(async () => ({ d1: 10 }));
    const r = await valuateDomainMoney({
      domain: 'energy',
      startTs: sp('2026-01-01'),
      endTs: sp('2026-01-31'),
      devices: [{ key: 'd1', group: 'lojas' }],
      rule: RULE,
      loadTree: loader({
        SPECIFIC: { 2026: { annual: { price: '0.500000' }, daily: { '01-10': { hourly: { '18': { price: '1.200000' } } } } } },
      }),
      periodTotals: { d1: 30 },
      fetchSegmentTotals: fetchSeg,
    });
    // [1..10) priced · [10] hourly (one segment, not 24) · [11..31) priced
    expect(r.plan.segments.map((s) => s.states.SPECIFIC)).toEqual(['priced', 'hourly', 'priced']);
    expect(fetchSeg).toHaveBeenCalledTimes(2);
    const m = r.byKey.get('d1')!;
    expect(m.state).toBe('partial');
    expect(m.reason).toBe('needs-hourly');
    expect(buildMoneyChipHTML(m)).toContain('Tarifa parcial');
    expect(buildMoneyChipHTML(m)).toContain('Tarifa horária ainda não suportada');
  });

  it(`more than ${MONEY_MAX_SEGMENT_FETCHES} price segments → no fetch, devices partial`, async () => {
    const daily: Record<string, TariffTreeNode> = {};
    for (let d = 1; d <= 40; d += 2) {
      const dt = new Date(sp('2026-01-01') + (d - 1) * DAY + 12 * HOUR);
      const key = `${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      daily[key] = { price: '2.000000' };
    }
    const fetchSeg = vi.fn();
    const r = await valuateDomainMoney({
      domain: 'energy',
      startTs: sp('2026-01-01'),
      endTs: sp('2026-02-10'),
      devices: [{ key: 'd1', group: 'lojas' }],
      rule: RULE,
      loadTree: loader({ SPECIFIC: { 2026: { annual: { price: '1.000000' }, daily } } }),
      periodTotals: { d1: 1 },
      fetchSegmentTotals: fetchSeg,
    });
    expect(r.plan.tooMany).toBe(true);
    expect(fetchSeg).not.toHaveBeenCalled();
    expect(r.byKey.get('d1')).toMatchObject({ state: 'partial', reason: 'too-many-segments' });
  });

  it('Q8: Entrada / tanks are never valued (not in byKey)', async () => {
    const r = await valuateDomainMoney({
      domain: 'energy',
      startTs: sp('2026-01-01'),
      endTs: sp('2026-01-31'),
      devices: [
        { key: 'e', group: 'entrada' },
        { key: 't', group: 'transformadores' },
      ],
      rule: parseMoneyCategoryRule({ SPECIFIC: ['*'] }),
      loadTree: loader({ SPECIFIC: { 2026: { annual: { price: '1.000000' } } } }),
      periodTotals: { e: 1, t: 1 },
    });
    expect(r.byKey.size).toBe(0);
  });

  it('a failed segment fetch → partial (no-data), never a silent partial sum', async () => {
    const r = await valuateDomainMoney({
      domain: 'energy',
      startTs: sp('2026-01-20'),
      endTs: sp('2026-02-10'),
      devices: [{ key: 'd1', group: 'lojas' }],
      rule: RULE,
      loadTree: loader({ SPECIFIC: { 2026: { monthly: { '01': { price: '0.5' }, '02': { price: '0.8' } } } } }),
      periodTotals: { d1: 30 },
      fetchSegmentTotals: vi
        .fn()
        .mockResolvedValueOnce({ d1: 10 })
        .mockRejectedValueOnce(new Error('HTTP 500')),
    });
    expect(r.byKey.get('d1')).toMatchObject({ state: 'partial', reason: 'no-data' });
  });
});

describe('AC-15 — rounding: parent = round(Σ raw), not Σ round', () => {
  it('three 0.335 items → 1.01 (raw 1.005), not 1.02', () => {
    const items = [1, 2, 3].map(() => ({ state: 'complete', amount: '0.335' }));
    const s = sumItemMoney(items);
    expect(s.amount).toBe('1.005');
    expect(roundMoney2(s.amount)).toBe('1.01');
    expect(items.map((i) => roundMoney2(i.amount)).join()).toBe('0.34,0.34,0.34'); // Σ round would be 1.02
  });
  it('an empty list is "none" — never R$ 0', () => {
    expect(sumItemMoney([])).toEqual({ state: 'none', covered: 0, total: 0 });
  });
});

describe('category rule (Q3) and persistence (AC-17)', () => {
  it('explicit group wins over the wildcard; no rule → null', () => {
    expect(resolveMoneyCategory(RULE, 'lojas')).toBe('SPECIFIC');
    expect(resolveMoneyCategory(RULE, 'areacomum')).toBe('COMMON_AREA');
    expect(resolveMoneyCategory(RULE, 'Area_Comum')).toBe('COMMON_AREA');
    expect(resolveMoneyCategory(null, 'lojas')).toBeNull();
    expect(parseMoneyCategoryRule('{"source":"classification","SPECIFIC":["lojas"],"COMMON_AREA":["*"]}')).toEqual(RULE);
    expect(parseMoneyCategoryRule('not json')).toBeNull();
    expect(parseMoneyCategoryRule({ source: 'other', SPECIFIC: ['lojas'] })).toBeNull();
  });

  it('mode persists per user × shopping; storage errors fall back to physical', () => {
    const key = valueDisplayModeStorageKey('u1', 'c1');
    expect(key).toBe('myio:value-display-mode:v1:u1:c1');
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(readValueDisplayMode(storage, key)).toBe('physical');
    expect(writeValueDisplayMode(storage, key, 'money')).toBe(true);
    expect(readValueDisplayMode(storage, key)).toBe('money');
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readValueDisplayMode(broken, key)).toBe('physical');
    expect(writeValueDisplayMode(broken, key, 'money')).toBe(false);
  });

  it('a stored "money" is ignored when the user is ineligible or tariffs unavailable', () => {
    expect(resolveEffectiveDisplayMode({ requested: 'money', eligible: true, available: true })).toBe('money');
    expect(resolveEffectiveDisplayMode({ requested: 'money', eligible: false, available: true })).toBe('physical');
    expect(resolveEffectiveDisplayMode({ requested: 'money', eligible: true, available: false })).toBe('physical');
  });
});

describe('buildReportMoneyConfig (AllReportModal A6 column, rev. 2)', () => {
  async function result(withCommonTariff: boolean) {
    return valuateDomainMoney({
      domain: 'energy',
      startTs: sp('2026-01-01'),
      endTs: sp('2026-02-01'),
      devices: [
        { key: 'a', group: 'lojas' },
        { key: 'b', group: 'areacomum' },
      ],
      rule: RULE,
      loadTree: loader({
        SPECIFIC: { 2026: { annual: { price: '0.333333' }, daily: { '01-10': { price: '0.5', hourly: { '18': { price: '1.200000' } } } } } },
        ...(withCommonTariff ? { COMMON_AREA: { 2026: { annual: { price: '1.000000' } } } } : {}),
      }),
      periodTotals: { a: 10, b: 2 },
      fetchSegmentTotals: async () => ({ a: 5, b: 1 }),
    });
  }

  it('header "Custo estimado (R$)", 2dp per row, total only when every row is complete', async () => {
    const r = await result(true);
    const cfg = buildReportMoneyConfig(r);
    expect(cfg.headerLabel).toBe('Custo estimado (R$)');
    // 'a' has an hourly band on Jan 10 → partial → no row amount, no total
    expect(cfg.perDevice.a).toBeNull();
    expect(cfg.perDevice.b).toBe('3.00'); // 3 segments × 1 m³... (1+1+1) × 1.0
    expect(cfg.total).toBeNull();
    expect(cfg.overlay).toMatchObject({ state: 'available', coverageComplete: false });
  });

  it('valuateBucket prices an hourly row exactly at the band (no extra fetch)', async () => {
    const cfg = buildReportMoneyConfig(await result(false));
    const h18 = cfg.valuateBucket!('a', sp('2026-01-10', 18), sp('2026-01-10', 19), 2);
    expect(h18).toMatchObject({ state: 'complete' });
    expect(roundMoney2(h18!.amount)).toBe('2.40'); // 2 × 1.2
    // a daily row of the band day mixes prices → partial (no amount)
    expect(cfg.valuateBucket!('a', sp('2026-01-10'), sp('2026-01-11'), 24)).toMatchObject({ state: 'partial' });
    // missing COMMON_AREA tariff → missing; unknown device → null
    expect(cfg.valuateBucket!('b', sp('2026-01-02'), sp('2026-01-03'), 1)).toMatchObject({ state: 'missing' });
    expect(cfg.valuateBucket!('zzz', sp('2026-01-02'), sp('2026-01-03'), 1)).toBeNull();
  });
});
