/**
 * RFC-0222 — Customer Energy/Water Pricing Panel (prototype) unit tests.
 *
 * Covers: MyIO-only gating, BRL formatting/parsing, category-scoped overlap and
 * idempotent upsert, energy vs water independence, the audit trail
 * (created/price-changed/deleted), computed KPIs, and the tabbed DOM flow.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openPricingPanel,
  formatBRL,
  parseBRL,
  isPricingAllowed,
  upsertEntry,
  removeEntryByBounds,
  computePricingKpis,
  intervalsOverlap,
  entryBounds,
  periodIdentity,
  type PricingEntry,
} from '../../../src/components/pricing-panel';

const CUSTOMERS = [
  { gcdrCustomerId: 'gc-1', tbId: 'tb-1', title: 'Shopping A' },
  { gcdrCustomerId: 'gc-2', tbId: 'tb-2', title: 'Shopping B' },
];

function entry(
  customerId: string,
  domain: 'energy' | 'water',
  category: 'lojas' | 'area_comum',
  periodKey: string,
  price: number
): PricingEntry {
  return {
    customerId,
    domain,
    category,
    periodType: 'month',
    periodKey,
    pricePerKwh: price,
    currency: 'BRL',
  };
}

function getModal(): HTMLElement | null {
  return document.getElementById('myio-pricing-panel');
}
function q<T extends HTMLElement>(sel: string): T {
  return getModal()!.querySelector(sel) as T;
}

beforeEach(() => {
  vi.useFakeTimers();
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
  getModal()?.remove();
  document.getElementById('myio-pricing-panel-styles')?.remove();
  delete (window as { MyIOUtils?: unknown }).MyIOUtils;
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
describe('pricing helpers', () => {
  it('formats BRL in pt-BR', () => {
    expect(formatBRL(0.75)).toBe('R$ 0,75');
    expect(formatBRL(1.2345)).toBe('R$ 1,2345');
  });

  it('parses pt-BR and plain price strings', () => {
    expect(parseBRL('0,75')).toBe(0.75);
    expect(parseBRL('R$ 1.234,56')).toBeCloseTo(1234.56, 4);
    expect(parseBRL('0.75')).toBe(0.75);
    expect(Number.isNaN(parseBRL(''))).toBe(true);
  });

  it('gates access to @myio.com.br (or SuperAdmin)', () => {
    expect(isPricingAllowed('op@myio.com.br')).toBe(true);
    expect(isPricingAllowed('OP@MYIO.COM.BR')).toBe(true);
    expect(isPricingAllowed('user@client.com')).toBe(false);
    expect(isPricingAllowed(undefined)).toBe(false);
    expect(isPricingAllowed('user@client.com', true)).toBe(true);
  });

  it('encodes domain + category in the identity key', () => {
    const e1 = entry('c', 'energy', 'lojas', '2026-03', 1);
    const e2 = entry('c', 'energy', 'area_comum', '2026-03', 1);
    const e3 = entry('c', 'water', 'lojas', '2026-03', 1);
    expect(periodIdentity(e1)).not.toBe(periodIdentity(e2));
    expect(periodIdentity(e1)).not.toBe(periodIdentity(e3));
  });

  it('detects inclusive interval overlap and month bounds', () => {
    expect(entryBounds(entry('c', 'energy', 'lojas', '2026-03', 1))).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    });
    expect(
      intervalsOverlap({ start: '2026-03-01', end: '2026-03-31' }, { start: '2026-03-15', end: '2026-04-10' })
    ).toBe(true);
    expect(
      intervalsOverlap({ start: '2026-03-01', end: '2026-03-31' }, { start: '2026-04-01', end: '2026-04-10' })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// upsertEntry — idempotency, category scope & audit
// ---------------------------------------------------------------------------
describe('upsertEntry', () => {
  const opts = { by: 'op@myio.com.br', now: '2026-07-16T10:00:00.000Z' };

  it('inserts a new period with a created audit record', () => {
    const r = upsertEntry([], entry('c', 'energy', 'lojas', '2026-03', 0.7), opts);
    expect(r.status).toBe('inserted');
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].version).toBe(1);
    expect(r.entries[0].createdBy).toBe('op@myio.com.br');
    expect(r.audit?.action).toBe('created');
    expect(r.entries[0].history?.[0].action).toBe('created');
  });

  it('idempotent: same period + same price is a noop', () => {
    const first = upsertEntry([], entry('c', 'energy', 'lojas', '2026-03', 0.7), opts).entries;
    const r = upsertEntry(first, entry('c', 'energy', 'lojas', '2026-03', 0.7), opts);
    expect(r.status).toBe('noop');
    expect(r.entries).toHaveLength(1);
    expect(r.audit).toBeUndefined();
  });

  it('idempotent: same period + new price updates and logs price-changed', () => {
    const first = upsertEntry([], entry('c', 'energy', 'lojas', '2026-03', 0.7), opts).entries;
    const r = upsertEntry(first, entry('c', 'energy', 'lojas', '2026-03', 0.9), opts);
    expect(r.status).toBe('updated');
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].pricePerKwh).toBe(0.9);
    expect(r.entries[0].version).toBe(2);
    expect(r.audit?.action).toBe('price-changed');
    expect(r.audit?.before?.pricePerKwh).toBe(0.7);
    expect(r.audit?.after?.pricePerKwh).toBe(0.9);
  });

  it('rejects a different overlapping period WITHIN the same customer/domain/category', () => {
    const base = upsertEntry([], entry('c', 'energy', 'lojas', '2026-03', 0.7), opts).entries;
    const overlappingRange: PricingEntry = {
      customerId: 'c',
      domain: 'energy',
      category: 'lojas',
      periodType: 'range',
      start: '2026-03-15',
      end: '2026-04-05',
      pricePerKwh: 0.8,
      currency: 'BRL',
    };
    const r = upsertEntry(base, overlappingRange, opts);
    expect(r.status).toBe('overlap');
    expect(r.conflict?.periodKey).toBe('2026-03');
  });

  it('energy and water (and lojas vs area_comum) are independent for the same month', () => {
    let e = upsertEntry([], entry('c', 'energy', 'lojas', '2026-03', 0.7), opts).entries;
    e = upsertEntry(e, entry('c', 'water', 'lojas', '2026-03', 8), opts).entries; // same month, other domain
    e = upsertEntry(e, entry('c', 'energy', 'area_comum', '2026-03', 0.6), opts).entries; // other category
    e = upsertEntry(e, entry('other', 'energy', 'lojas', '2026-03', 0.9), opts).entries; // other customer
    expect(e).toHaveLength(4);
  });

  it('removeEntryByBounds drops the row and logs a deleted audit record', () => {
    const e = upsertEntry([], entry('c', 'energy', 'lojas', '2026-03', 0.7), opts).entries;
    const r = removeEntryByBounds(
      e,
      { customerId: 'c', domain: 'energy', category: 'lojas', boundsKey: '2026-03-01__2026-03-31' },
      opts
    );
    expect(r.entries).toHaveLength(0);
    expect(r.audit?.action).toBe('deleted');
    expect(r.audit?.before?.pricePerKwh).toBe(0.7);
  });
});

// ---------------------------------------------------------------------------
// computePricingKpis
// ---------------------------------------------------------------------------
describe('computePricingKpis', () => {
  it('computes counts, per-domain averages, coverage and last update', () => {
    const now = '2026-07-16T10:00:00.000Z';
    let e: PricingEntry[] = [];
    e = upsertEntry(e, entry('c1', 'energy', 'lojas', '2026-03', 0.8), { now }).entries;
    e = upsertEntry(e, entry('c1', 'energy', 'lojas', '2026-04', 1.0), { now }).entries;
    e = upsertEntry(e, entry('c1', 'water', 'area_comum', '2026-03', 10), { now }).entries;

    const kpis = computePricingKpis(e, { customerCount: 2 });
    expect(kpis.totalPeriods).toBe(3);
    expect(kpis.periodsByDomain).toEqual({ energy: 2, water: 1 });
    expect(kpis.avgEnergyPrice).toBeCloseTo(0.9, 6);
    expect(kpis.avgWaterPrice).toBe(10);
    // 2 distinct combos (c1/energy/lojas, c1/water/area_comum) out of 2*4 = 8.
    expect(kpis.coverage).toEqual({ covered: 2, total: 8, pct: 25 });
    expect(kpis.lastUpdatedAt).toBe(now);
  });
});

// ---------------------------------------------------------------------------
// openPricingPanel — gating & tabs (DOM)
// ---------------------------------------------------------------------------
describe('openPricingPanel gating', () => {
  it('blocks non-MyIO users with the locked state and no form', () => {
    const handle = openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'user@client.com' });
    expect(q('[data-testid="pricing-locked"]')).toBeTruthy();
    expect(getModal()!.querySelector('[data-testid="pricing-add"]')).toBeNull();
    expect(handle.getEntries()).toEqual([]);
    // Locked modal still closes.
    handle.close();
    vi.runAllTimers();
    expect(getModal()).toBeNull();
  });

  it('renders the tabbed form for @myio.com.br users', () => {
    openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    expect(q('[data-testid="pricing-add"]')).toBeTruthy();
    expect(q('[data-testid="tab-dashboard"]')).toBeTruthy();
    expect(q('[data-testid="tab-history"]')).toBeTruthy();
  });

  it('renders the form for SuperAdmin even without a MyIO email', () => {
    (window as { MyIOUtils?: { SuperAdmin?: boolean } }).MyIOUtils = { SuperAdmin: true };
    openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'user@client.com' });
    expect(q('[data-testid="pricing-add"]')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// openPricingPanel — add flow (DOM)
// ---------------------------------------------------------------------------
describe('openPricingPanel add flow', () => {
  function selectDomainCategory(domain: 'energy' | 'water', category: 'lojas' | 'area_comum'): void {
    const d = q<HTMLSelectElement>('[data-testid="pricing-domain"]');
    d.value = domain;
    d.dispatchEvent(new Event('change'));
    const c = q<HTMLSelectElement>('[data-testid="pricing-category"]');
    c.value = category;
    c.dispatchEvent(new Event('change'));
  }
  function addMonth(month: string, price: string): void {
    q<HTMLSelectElement>('[data-testid="pricing-type"]').value = 'month';
    q<HTMLSelectElement>('[data-testid="pricing-type"]').dispatchEvent(new Event('change'));
    q<HTMLInputElement>('[data-testid="pricing-month"]').value = month;
    q<HTMLInputElement>('[data-testid="pricing-price"]').value = price;
    q<HTMLButtonElement>('[data-testid="pricing-add"]').click();
  }

  it('adds a period, calls onSave, lists it with a domain+category badge', () => {
    const onSave = vi.fn();
    const handle = openPricingPanel({
      customers: CUSTOMERS,
      currentUserEmail: 'op@myio.com.br',
      onSave,
    });
    selectDomainCategory('energy', 'lojas');
    addMonth('2026-03', '0,75');
    expect(onSave).toHaveBeenCalledTimes(1);
    const entries = handle.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      periodKey: '2026-03',
      pricePerKwh: 0.75,
      domain: 'energy',
      category: 'lojas',
    });
    expect(q('[data-testid="pricing-list"]').textContent).toContain('Energia');
    expect(q('[data-testid="pricing-list"]').textContent).toContain('Lojas');
  });

  it('unit label switches to R$/m³ for water', () => {
    openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    selectDomainCategory('water', 'area_comum');
    expect(q('[data-testid="pricing-unit"]').textContent).toBe('R$/m³');
  });

  it('blocks overlapping periods within the same category with an error', () => {
    const handle = openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    selectDomainCategory('energy', 'lojas');
    addMonth('2026-03', '0,75');
    // Range overlapping March, same domain+category.
    q<HTMLSelectElement>('[data-testid="pricing-type"]').value = 'range';
    q<HTMLSelectElement>('[data-testid="pricing-type"]').dispatchEvent(new Event('change'));
    q<HTMLInputElement>('[data-testid="pricing-start"]').value = '2026-03-20';
    q<HTMLInputElement>('[data-testid="pricing-end"]').value = '2026-04-05';
    q<HTMLInputElement>('[data-testid="pricing-price"]').value = '0,90';
    q<HTMLButtonElement>('[data-testid="pricing-add"]').click();

    expect(q('[data-testid="pricing-error"]').classList.contains('show')).toBe(true);
    expect(handle.getEntries()).toHaveLength(1); // unchanged
  });

  it('same month for water does NOT conflict with energy', () => {
    const handle = openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    selectDomainCategory('energy', 'lojas');
    addMonth('2026-03', '0,75');
    selectDomainCategory('water', 'lojas');
    addMonth('2026-03', '9,50');
    expect(q('[data-testid="pricing-error"]').classList.contains('show')).toBe(false);
    expect(handle.getEntries()).toHaveLength(2);
  });

  it('records add/edit/delete in the audit log (most recent first)', () => {
    const handle = openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    selectDomainCategory('energy', 'lojas');
    addMonth('2026-03', '0,75'); // created
    addMonth('2026-03', '0,90'); // price-changed
    let log = handle.getAuditLog();
    expect(log[0].action).toBe('price-changed');
    expect(log[1].action).toBe('created');
    expect(log[0].by).toBe('op@myio.com.br');

    // Delete the row via the list button.
    q<HTMLButtonElement>('[data-testid="pricing-list"] [data-remove]').click();
    log = handle.getAuditLog();
    expect(log[0].action).toBe('deleted');
    expect(handle.getEntries()).toHaveLength(0);
  });

  it('idempotent add: same month twice updates price, no duplicate row', () => {
    const handle = openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    selectDomainCategory('energy', 'lojas');
    addMonth('2026-03', '0,75');
    addMonth('2026-03', '0,90');
    const entries = handle.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].pricePerKwh).toBe(0.9);
    expect(q('[data-testid="pricing-list"]').children).toHaveLength(1);
  });

  it('Dashboard tab renders KPIs and a filterable report over energy AND water', () => {
    const handle = openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    selectDomainCategory('energy', 'lojas');
    addMonth('2026-03', '0,80');
    selectDomainCategory('water', 'area_comum');
    addMonth('2026-03', '10,00');
    expect(handle.getEntries()).toHaveLength(2);

    q<HTMLButtonElement>('[data-testid="tab-dashboard"]').click();
    expect(q('[data-testid="pricing-kpis"]').children.length).toBeGreaterThan(0);
    expect(q('[data-testid="report-body"]').querySelectorAll('tr')).toHaveLength(2);

    // Filter to water only.
    const filter = q<HTMLSelectElement>('[data-testid="report-domain"]');
    filter.value = 'water';
    filter.dispatchEvent(new Event('change'));
    const rows = q('[data-testid="report-body"]').querySelectorAll('tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Água');
  });

  it('persists to localStorage and rehydrates on reopen', () => {
    const h1 = openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    selectDomainCategory('energy', 'lojas');
    addMonth('2026-05', '1,20');
    h1.close();
    vi.runAllTimers();

    const h2 = openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    expect(h2.getEntries()).toHaveLength(1);
    expect(h2.getEntries()[0].periodKey).toBe('2026-05');
    expect(h2.getAuditLog().length).toBeGreaterThan(0);
  });

  it('rejects an invalid (zero) price', () => {
    const handle = openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    selectDomainCategory('energy', 'lojas');
    addMonth('2026-03', '0');
    expect(q('[data-testid="pricing-error"]').classList.contains('show')).toBe(true);
    expect(handle.getEntries()).toHaveLength(0);
  });
});
