/**
 * RFC-0228 A1 — openPricingPanel persistence gate.
 *
 * Verifies the `tariffApi` gate: WITH it, the panel loads/saves through the
 * hourly-tariff API and never touches localStorage as a source of truth;
 * WITHOUT it, the panel keeps its byte-identical localStorage prototype.
 *
 * Real timers + a mocked `fetch` (via the `tariffApi.fetchImpl` test seam).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openPricingPanel } from '../../../src/components/pricing-panel';

const CUSTOMERS = [{ gcdrCustomerId: 'gc-1', tbId: 'tb-1', title: 'Shopping A' }];

function getModal(): HTMLElement | null {
  return document.getElementById('myio-pricing-panel');
}
function q<T extends HTMLElement>(sel: string): T {
  return getModal()!.querySelector(sel) as T;
}
function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function addMonth(month: string, price: string): void {
  q<HTMLSelectElement>('[data-testid="pricing-type"]').value = 'month';
  q<HTMLSelectElement>('[data-testid="pricing-type"]').dispatchEvent(new Event('change'));
  q<HTMLInputElement>('[data-testid="pricing-month"]').value = month;
  q<HTMLInputElement>('[data-testid="pricing-price"]').value = price;
  q<HTMLButtonElement>('[data-testid="pricing-add"]').click();
}

/** Empty tariff on GET; version bump on any write. */
function makeFetchMock() {
  return vi.fn(async (_url: string, init?: { method?: string }) => {
    const method = init?.method || 'GET';
    if (method === 'GET') {
      return new Response(JSON.stringify({ version: 0, tree: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ETag: '"0"' },
      });
    }
    return new Response(JSON.stringify({ version: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ETag: '"1"' },
    });
  });
}

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});

afterEach(() => {
  getModal()?.remove();
  document.getElementById('myio-pricing-panel-styles')?.remove();
  delete (window as { MyIOUtils?: unknown }).MyIOUtils;
  vi.restoreAllMocks();
});

describe('openPricingPanel — tariffApi gate ON', () => {
  it('loads via the API on open (4 combos) and never persists pricing to localStorage', async () => {
    const fetchMock = makeFetchMock();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    openPricingPanel({
      customers: CUSTOMERS,
      currentUserEmail: 'op@myio.com.br',
      tariffApi: { baseUrl: 'https://gcdr.example', apiKey: 'gcdr_cust_X', year: 2026, fetchImpl: fetchMock as unknown as typeof fetch },
    });
    await flush();

    // Initial hydration read all four (domain × category) tariffs.
    const gets = fetchMock.mock.calls.filter((c) => (c[1]?.method || 'GET') === 'GET');
    expect(gets.length).toBe(4);

    // Add a month → routes to a PATCH, not localStorage.
    addMonth('2026-03', '0,90');
    await flush();

    const patches = fetchMock.mock.calls.filter((c) => c[1]?.method === 'PATCH');
    expect(patches.length).toBe(1);
    const body = JSON.parse((patches[0][1] as { body: string }).body);
    expect(body.buckets.length).toBe(31 * 24);
    expect(body.buckets[0].price).toBe('0.90');

    // No pricing/audit keys were written to localStorage.
    const pricingWrites = setItem.mock.calls.filter((c) => String(c[0]).includes('pricing'));
    expect(pricingWrites.length).toBe(0);
  });
});

describe('openPricingPanel — RFC-0241 allowed / lockCustomer', () => {
  it('AC-08: caller-asserted allowed=true opens the editable panel for a non-MyIO admin, via tariffApi only', async () => {
    const fetchMock = makeFetchMock();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    openPricingPanel({
      customers: CUSTOMERS,
      currentUserEmail: 'admin@shopping.com.br',
      allowed: true,
      lockCustomer: true,
      tariffApi: { baseUrl: 'https://gcdr.example', apiKey: 'test-key', year: 2026, fetchImpl: fetchMock as unknown as typeof fetch },
    });
    await flush();
    expect(q('[data-testid="pricing-locked"]')).toBeNull();
    expect(q('[data-testid="pricing-add"]')).not.toBeNull();
    // lockCustomer hides the selector but keeps the single customer selected.
    expect(q<HTMLElement>('[data-testid="pricing-customer-field"]').style.display).toBe('none');
    expect(q<HTMLSelectElement>('[data-testid="pricing-customer"]').value).toBe('gc-1');
    addMonth('2026-03', '0,90');
    await flush();
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'PATCH')).toBe(true);
    expect(setItem.mock.calls.filter((c) => String(c[0]).includes('pricing')).length).toBe(0);
  });

  it('caller-asserted allowed=false shows the locked view even for a MyIO user', () => {
    openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br', allowed: false });
    expect(q('[data-testid="pricing-locked"]')).not.toBeNull();
  });

  it('without allowed the built-in @myio.com.br gate still applies', () => {
    openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'admin@shopping.com.br' });
    expect(q('[data-testid="pricing-locked"]')).not.toBeNull();
  });

  it('customer selector stays visible without lockCustomer', () => {
    openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    expect(q<HTMLElement>('[data-testid="pricing-customer-field"]').style.display).toBe('');
  });
});

describe('openPricingPanel — tariffApi gate OFF (localStorage prototype unchanged)', () => {
  it('persists to localStorage and does not call fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    const handle = openPricingPanel({ customers: CUSTOMERS, currentUserEmail: 'op@myio.com.br' });
    const d = q<HTMLSelectElement>('[data-testid="pricing-domain"]');
    d.value = 'energy';
    d.dispatchEvent(new Event('change'));
    addMonth('2026-05', '1,20');
    await flush();

    expect(handle.getEntries()).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    const pricingWrites = setItem.mock.calls.filter((c) => String(c[0]).includes('pricing'));
    expect(pricingWrites.length).toBeGreaterThan(0);
  });
});
