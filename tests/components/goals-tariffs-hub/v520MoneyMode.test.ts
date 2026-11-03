/**
 * RFC-0241 Part B — Shopping v-5.2.0 MAIN_VIEW money display mode (state owner).
 *
 * Same technique as v520Wiring.test.ts: the MAIN_VIEW controller is a ThingsBoard
 * widget script, so the RFC-0241 blocks (Part A gate + Part B money mode) are
 * extracted between their marker comments and evaluated with stubbed collaborators.
 * The REAL library valuation (`valuateDomainMoney`, `sumItemMoney`, …) is used; only
 * the GCDR tariff client and the Ingestion totals are fakes.
 *
 * Covers AC-11 (physical payload untouched), AC-12 (single source item.money),
 * AC-14 (incomplete totals carry the marker), AC-16 (temperature never valued),
 * AC-17 (persistence + eligibility), AC-18 (tariffs-updated re-valuates), Q6/Q8.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as FG from '../../../src/components/financial-goals';

const MAIN_SRC = readFileSync(
  resolve(process.cwd(), 'src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js'),
  'utf8'
);

function extractBlocks(): string {
  const start = MAIN_SRC.indexOf('// ── RFC-0241: Metas e Tarifas');
  const endMarker = '// ── fim RFC-0241 Part B';
  const end = MAIN_SRC.indexOf(endMarker);
  if (start < 0 || end < 0) throw new Error('RFC-0241 block markers not found in MAIN_VIEW');
  return MAIN_SRC.slice(start, end);
}

const PERIOD = { startISO: '2026-01-01T00:00:00-03:00', endISO: '2026-02-01T00:00:00-03:00' };
const PKEY = `tb-1:energy:${PERIOD.startISO}:${PERIOD.endISO}:day`;

let listeners: Array<[string, EventListenerOrEventListenerObject]> = [];
let prices: Record<string, string | null>;

type Harness = {
  setRule: (raw: unknown) => void;
  onProvide: (domain: string, pKey: string) => void;
  getTariff: ReturnType<typeof vi.fn>;
  toastError: ReturnType<typeof vi.fn>;
};

function load(): Harness {
  const LogHelper = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const toastError = vi.fn();
  const getTariff = vi.fn(async (sel: { category: string; year: number; domain: string }) => {
    if (prices.__fail) throw Object.assign(new Error('unauthorized'), { code: 'HTTP_401' });
    const p = prices[sel.category];
    return { ...sel, version: p ? 1 : 0, tree: p ? { annual: { price: p } } : {} };
  });
  (window as any).MyIOLibrary = {
    ...FG,
    createTariffApiClient: vi.fn(() => ({ getTariff })),
  };
  const add = window.addEventListener.bind(window);
  const spy = vi.spyOn(window, 'addEventListener').mockImplementation((type: string, fn: any, opts?: any) => {
    listeners.push([type, fn]);
    add(type, fn, opts);
  });
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'window',
    'LogHelper',
    'toastError',
    '_fetchGoalsFromGCDR',
    'localStorage',
    `${extractBlocks()}\nreturn { _moneySetCategoryRule, _moneyOnProvide };`
  );
  const out = factory(window, LogHelper, toastError, vi.fn(), window.localStorage);
  spy.mockRestore();
  return { setRule: out._moneySetCategoryRule, onProvide: out._moneyOnProvide, getTariff, toastError };
}

function setup(user: { SuperAdmin?: boolean; UserAdmin?: boolean } = { SuperAdmin: true }) {
  const items = [
    { ingestionId: 'd1', value: 100, label: 'Loja 1' },
    { ingestionId: 'd2', value: 50, label: 'Corredor' },
    { ingestionId: 'e1', value: 150, label: 'Entrada' },
  ];
  (window as any).MyIOUtils = {
    SuperAdmin: user.SuperAdmin === true,
    UserAdmin: user.UserAdmin === true,
    currentUserId: 'u1',
    isFeatureVisible: () => true,
    formatEnergyWithSettings: (v: number) => `${v} kWh`,
    formatWaterWithSettings: (v: number) => `${v} m³`,
    fetchGoalsDayTotals: vi.fn(async () => []),
  };
  (window as any).MyIOOrchestrator = {
    gcdrApiBaseUrl: 'https://gcdr.example/api/v1',
    gcdrCustomerId: 'gc-1',
    gcdrTenantId: 'tn-1',
    gcdrApiKey: 'test-key',
    customerTB_ID: 'tb-1',
    getVisibleTab: () => 'energy',
    getCurrentPeriod: () => PERIOD,
    getCredentials: () => ({ CUSTOMER_ING_ID: 'ing-1' }),
    showGlobalBusy: vi.fn(),
    hideGlobalBusy: vi.fn(),
  };
  (window as any).STATE = {
    energy: {
      lojas: { items: [items[0]] },
      areacomum: { items: [items[1]] },
      entrada: { items: [items[2]] },
      summary: {},
      _raw: items,
    },
  };
  (window as any).MyIOOrchestratorData = { energy: { periodKey: PKEY, items, allItems: items } };
  return items;
}

const U = () => (window as any).MyIOUtils;
const RULE = { source: 'classification', SPECIFIC: ['lojas'], COMMON_AREA: ['*'] };

beforeEach(() => {
  listeners = [];
  prices = { SPECIFIC: '0.500000', COMMON_AREA: '1.000000' };
  window.localStorage.clear();
});

afterEach(() => {
  listeners.forEach(([t, fn]) => window.removeEventListener(t, fn));
  vi.useRealTimers();
  delete (window as any).MyIOUtils;
  delete (window as any).MyIOOrchestrator;
  delete (window as any).MyIOOrchestratorData;
  delete (window as any).STATE;
  delete (window as any).MyIOLibrary;
});

describe('RFC-0241 Part B — children use the single source (static, AC-12)', () => {
  const W = (n: string) =>
    readFileSync(resolve(process.cwd(), `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/${n}/controller.js`), 'utf8');
  it('TELEMETRY group total and FOOTER dock show R$ only when formatMoneyTotal says complete', () => {
    const tel = W('TELEMETRY');
    expect(tel).toMatch(/const moneyTotal = _isMoneyMode\(\) \? window\.MyIOUtils\.formatMoneyTotal/);
    expect(tel).toMatch(/if \(moneyTotal\?\.complete\) \{\s*\$total\(\)\.text\(moneyTotal\.text\)/);
    expect(tel).toMatch(/entityObject\.money = window\.MyIOUtils\.getItemMoney\(it, WIDGET_DOMAIN\)/);
    const footer = W('FOOTER');
    expect(footer).toMatch(/if \(moneyTotal\?\.complete\) totals = moneyTotal\.text;/);
    expect(footer).toMatch(/Cobertura incompleta \(\$\{moneyTotal\.covered\} de \$\{moneyTotal\.total\}\)/);
  });
  it('children never dispatch myio:value-display-mode-updated nor touch window.MyIOLibrary for it', () => {
    for (const n of ['TELEMETRY', 'TELEMETRY_INFO', 'FOOTER', 'HEADER']) {
      const src = W(n);
      expect(src).not.toMatch(/dispatchEvent\(\s*new CustomEvent\('myio:value-display-mode-updated'/);
      expect(src).not.toMatch(/dispatchEvent\(\s*new CustomEvent\('myio:money-valuation-ready'/);
    }
    expect(W('HEADER')).toMatch(/window\.MyIOUtils\?\.setValueDisplayMode/);
  });
});

describe('RFC-0241 Part B — MAIN state & eligibility', () => {
  it('default is physical; a non-eligible user cannot switch to R$ (no tariff call, nothing stored)', async () => {
    setup({});
    const h = load();
    expect(U().getValueDisplayMode()).toBe('physical');
    expect(await U().setValueDisplayMode('money', { source: 'test' })).toBe('physical');
    expect(h.getTariff).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(U().getItemMoney({ ingestionId: 'd1' }, 'energy')).toBeNull();
  });

  it('eligible + API available → money: item.money single source, Entrada untouched, events, persisted', async () => {
    const items = setup({ UserAdmin: true });
    const h = load();
    h.setRule(RULE);
    const events: any[] = [];
    const onMode = (e: Event) => events.push(['mode', (e as CustomEvent).detail]);
    const onVal = (e: Event) => events.push(['valuation', (e as CustomEvent).detail]);
    window.addEventListener('myio:value-display-mode-updated', onMode);
    window.addEventListener('myio:money-valuation-ready', onVal);

    expect(await U().setValueDisplayMode('money', { source: 'header' })).toBe('money');
    window.removeEventListener('myio:value-display-mode-updated', onMode);
    window.removeEventListener('myio:money-valuation-ready', onVal);

    expect(U().valueDisplayMode).toBe('money');
    expect(U().moneyDisplayAvailable).toBe(true);
    const m1 = U().getItemMoney(items[0], 'energy');
    expect(m1).toMatchObject({ state: 'complete', currency: 'BRL' });
    expect(FG.roundMoney2(m1.amount)).toBe('50.00'); // 100 kWh × 0,50 (lojas → SPECIFIC)
    expect(FG.roundMoney2(U().getItemMoney('d2', 'energy').amount)).toBe('50.00'); // 50 × 1,00
    expect(U().getItemMoney(items[2], 'energy')).toBeNull(); // Entrada: físico (Q8)
    // annotated payload = same object the widgets read (AC-12)
    expect(items[0]).toHaveProperty('money', m1);
    expect(items[2]).not.toHaveProperty('money');

    const total = U().formatMoneyTotal(items.slice(0, 2), 'energy');
    expect(total).toMatchObject({ complete: true, text: 'R$ 100,00', covered: 2, total: 2 });
    expect(U().formatItemValue(items[0], 'energy')).toBe('R$ 50,00');
    expect(U().formatItemValue(items[2], 'energy')).toBe('150 kWh');

    expect(events.map((e) => e[0])).toEqual(['valuation', 'mode']); // valuation first, then mode
    expect(events[1][1]).toMatchObject({ mode: 'money', available: true, eligible: true, source: 'header' });
    expect(window.localStorage.getItem('myio:value-display-mode:v1:u1:tb-1')).toBe('money');
  });

  it('AC-11: back to physical removes item.money (payload as before) and getters return null', async () => {
    const items = setup();
    const h = load();
    h.setRule(RULE);
    const before = JSON.stringify(items);
    await U().setValueDisplayMode('money');
    expect(JSON.stringify(items)).not.toBe(before);
    await U().setValueDisplayMode('physical');
    expect(JSON.stringify(items)).toBe(before);
    expect(U().getItemMoney(items[0], 'energy')).toBeNull();
    expect(U().formatMoneyTotal(items, 'energy')).toBeNull();
    expect(U().formatItemValue(items[0], 'energy')).toBe('100 kWh');
    expect(window.localStorage.getItem('myio:value-display-mode:v1:u1:tb-1')).toBe('physical');
  });

  it('AC-14: a total with a non-complete member stays physical with "Cobertura incompleta (n de m)"', async () => {
    const items = setup();
    prices.COMMON_AREA = null; // sem tarifa de Área Comum
    const h = load();
    h.setRule(RULE);
    await U().setValueDisplayMode('money');
    const total = U().formatMoneyTotal(items.slice(0, 2), 'energy');
    expect(total).toMatchObject({ complete: false, text: null, covered: 1, total: 2 });
    expect(total.markerHTML).toContain('Cobertura incompleta (1 de 2)');
    expect(U().getItemMoney('d2', 'energy')).toMatchObject({ state: 'missing' });
  });

  it('no moneyCategoryRule → devices uncategorized (no tariff trees loaded beyond the probe)', async () => {
    const items = setup();
    const h = load();
    await U().setValueDisplayMode('money');
    expect(U().getItemMoney(items[0], 'energy')).toMatchObject({ state: 'uncategorized' });
    expect(h.getTariff).toHaveBeenCalledTimes(1); // availability probe only
  });

  it('AC-16: temperature is never valued', async () => {
    setup();
    const h = load();
    h.setRule(RULE);
    await U().setValueDisplayMode('money');
    expect(U().getItemMoney({ ingestionId: 't1' }, 'temperature')).toBeNull();
    expect(U().formatMoneyTotal([{ ingestionId: 't1' }], 'temperature')).toBeNull();
  });

  it('tariff API unreachable → not available, stays physical', async () => {
    setup();
    prices.__fail = 'x';
    load();
    expect(await U().setValueDisplayMode('money')).toBe('physical');
    expect(U().moneyDisplayAvailable).toBe(false);
  });

  it('AC-17: a stored "money" is applied for an eligible user and ignored for an ineligible one', async () => {
    setup();
    window.localStorage.setItem('myio:value-display-mode:v1:u1:tb-1', 'money');
    const h = load();
    h.setRule(RULE);
    const done = new Promise((r) => window.addEventListener('myio:value-display-mode-updated', r, { once: true }));
    window.dispatchEvent(new CustomEvent('myio:user-info-ready', { detail: {} }));
    await done;
    expect(U().getValueDisplayMode()).toBe('money');

    // ineligible user, same stored preference
    listeners.forEach(([t, fn]) => window.removeEventListener(t, fn));
    listeners = [];
    setup({});
    load();
    const done2 = new Promise((r) => window.addEventListener('myio:value-display-mode-updated', r, { once: true }));
    window.dispatchEvent(new CustomEvent('myio:user-info-ready', { detail: {} }));
    await done2;
    expect(U().getValueDisplayMode()).toBe('physical');
  });

  it('AC-18: myio:tariffs-updated re-reads the tariffs and re-valuates without reload', async () => {
    const items = setup();
    const h = load();
    h.setRule(RULE);
    await U().setValueDisplayMode('money');
    expect(FG.roundMoney2(U().getItemMoney(items[0], 'energy').amount)).toBe('50.00');

    vi.useFakeTimers();
    prices.SPECIFIC = '0.800000';
    window.dispatchEvent(new CustomEvent('myio:tariffs-updated', { detail: { domain: 'energy' } }));
    // until the debounce fires, the stale result is withheld (never a wrong R$)
    expect(U().getItemMoney(items[0], 'energy')).toBeNull();
    const ready = new Promise((r) => window.addEventListener('myio:value-display-mode-updated', r, { once: true }));
    await vi.advanceTimersByTimeAsync(2000);
    await ready;
    expect(FG.roundMoney2(U().getItemMoney(items[0], 'energy').amount)).toBe('80.00');
  });

  it('period change (new emitProvide) re-valuates; stale periods never show R$', async () => {
    const items = setup();
    const h = load();
    h.setRule(RULE);
    await U().setValueDisplayMode('money');
    const newKey = PKEY.replace('2026-01-01', '2026-01-02');
    (window as any).MyIOOrchestratorData.energy.periodKey = newKey;
    expect(U().getItemMoney(items[0], 'energy')).toBeNull(); // stale
    const ready = new Promise((r) => window.addEventListener('myio:money-valuation-ready', r, { once: true }));
    h.onProvide('energy', newKey);
    await ready;
    expect(U().getItemMoney(items[0], 'energy')).toMatchObject({ state: 'complete' });
  });

  it('reports: getReportMoney only in money mode, header "Custo estimado (R$)", dashboard period', async () => {
    setup();
    const h = load();
    h.setRule(RULE);
    expect(U().getReportMoney('energy')).toBeNull();
    await U().setValueDisplayMode('money');
    const cfg = U().getReportMoney('energy');
    expect(cfg.headerLabel).toBe('Custo estimado (R$)');
    expect(cfg.perDevice).toEqual({ d1: '50.00', d2: '50.00' });
    expect(cfg.total).toBe('100.00');
    expect(cfg.period).toEqual(PERIOD);
  });
});
