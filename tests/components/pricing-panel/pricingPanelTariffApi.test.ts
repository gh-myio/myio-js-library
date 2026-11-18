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

/** Categorias reais do GCDR (envelope de produção). */
const CATEGORIES_BODY = {
  success: true,
  data: {
    items: [
      { key: 'COMMON_AREA', customerId: null, label: 'Área comum', sortOrder: 10, isSystem: true, isActive: true },
      { key: 'SPECIFIC', customerId: null, label: 'Específico', sortOrder: 20, isSystem: true, isActive: true },
      { key: 'ENERGIA_QUIOSQUES_TABOAO', customerId: 'gc-1', label: 'Energia Quiosques Taboão', sortOrder: 30, isSystem: false, isActive: true },
      { key: 'ANTIGA', customerId: 'gc-1', label: 'Antiga', sortOrder: 40, isSystem: false, isActive: false },
    ],
    total: 4,
  },
};

/** Categories + empty tariff on GET; version bump on any write. */
function makeFetchMock(opts: { categoriesStatus?: number } = {}) {
  return vi.fn(async (url: string, init?: { method?: string }) => {
    const method = init?.method || 'GET';
    if (method === 'GET' && String(url).includes('/tariff-categories')) {
      const status = opts.categoriesStatus ?? 200;
      return new Response(
        JSON.stringify(status === 200 ? CATEGORIES_BODY : { success: false, error: { code: 'FORBIDDEN', message: 'x' } }),
        { status, headers: { 'Content-Type': 'application/json' } }
      );
    }
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
  it('loads categories from GCDR, then tariffs for every domain × category, never via localStorage', async () => {
    const fetchMock = makeFetchMock();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    openPricingPanel({
      customers: CUSTOMERS,
      currentUserEmail: 'op@myio.com.br',
      tariffApi: { baseUrl: 'https://gcdr.example', apiKey: 'gcdr_cust_X', year: 2026, fetchImpl: fetchMock as unknown as typeof fetch },
    });
    await flush();
    await flush();

    // 1) categorias do customer (globais + próprias, com inativas)
    const catCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/tariff-categories'));
    expect(String(catCall![0])).toBe('https://gcdr.example/api/v1/tariff-categories?customerId=gc-1&includeInactive=true');
    // 2) select com as ativas na ordem do GCDR; inativa desabilitada
    const sel = q<HTMLSelectElement>('[data-testid="pricing-category"]');
    expect([...sel.options].map((o) => [o.value, o.disabled])).toEqual([
      ['COMMON_AREA', false],
      ['SPECIFIC', false],
      ['ENERGIA_QUIOSQUES_TABOAO', false],
      ['ANTIGA', true],
    ]);
    // 3) tarifas: 2 domínios × 4 categorias (inclui a inativa, para exibir o que já existe)
    const tariffGets = fetchMock.mock.calls.filter(
      (c) => (c[1]?.method || 'GET') === 'GET' && String(c[0]).includes('/tariffs?')
    );
    expect(tariffGets.length).toBe(8);

    // Add a month in a customer-specific category → PATCH with that key, not localStorage.
    sel.value = 'ENERGIA_QUIOSQUES_TABOAO';
    sel.dispatchEvent(new Event('change'));
    addMonth('2026-03', '0,90');
    await flush();

    const patches = fetchMock.mock.calls.filter((c) => c[1]?.method === 'PATCH');
    expect(patches.length).toBe(1);
    expect(String(patches[0][0])).toContain('category=ENERGIA_QUIOSQUES_TABOAO');
    expect(q('[data-testid="pricing-list"]').textContent).toContain('Energia Quiosques Taboão');
    const body = JSON.parse((patches[0][1] as { body: string }).body);
    expect(body.buckets.length).toBe(31 * 24);
    expect(body.buckets[0].price).toBe('0.90');

    // No pricing/audit keys were written to localStorage.
    const pricingWrites = setItem.mock.calls.filter((c) => String(c[0]).includes('pricing'));
    expect(pricingWrites.length).toBe(0);
  });
});

describe('openPricingPanel — categorias GCDR indisponíveis', () => {
  it('falha ao buscar categorias = erro (sem lista de fallback) e Add bloqueado', async () => {
    const fetchMock = makeFetchMock({ categoriesStatus: 403 });
    openPricingPanel({
      customers: CUSTOMERS,
      currentUserEmail: 'op@myio.com.br',
      tariffApi: { baseUrl: 'https://gcdr.example', apiKey: 'k', year: 2026, fetchImpl: fetchMock as unknown as typeof fetch },
    });
    await flush();
    await flush();
    const sel = q<HTMLSelectElement>('[data-testid="pricing-category"]');
    expect(sel.disabled).toBe(true);
    expect([...sel.options].map((o) => o.value)).toEqual(['']);
    expect(q<HTMLButtonElement>('[data-testid="pricing-add"]').disabled).toBe(true);
    expect(q('[data-testid="pricing-error"]').textContent).toContain('categorias de tarifa do GCDR (FORBIDDEN)');
    // sem categorias não busca tarifas
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/tariffs?'))).toBe(false);
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

    const handle = openPricingPanel({
      customers: CUSTOMERS,
      currentUserEmail: 'op@myio.com.br',
      categories: [{ key: 'SPECIFIC', customerId: null, label: 'Específico', isActive: true }],
    });
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

// ---------------------------------------------------------------------------
// ED-1386 — confirmação antes de excluir + DELETE aguardado
// ---------------------------------------------------------------------------
/**
 * Servidor com UMA tarifa (Energia · Área comum · 10–11/03/2026 a R$ 0,90):
 * o GET dessa combinação devolve a árvore diária; o DELETE responde `deleteStatus`.
 * A tarifa só some do "servidor" quando todos os DELETEs dão certo.
 */
function makeSeededFetchMock(opts: { deleteStatus?: number } = {}) {
  const base = makeFetchMock();
  let seeded = true;
  return vi.fn(async (url: string, init?: { method?: string }) => {
    const method = init?.method || 'GET';
    const u = String(url);
    if (method === 'GET' && u.includes('/tariffs?') && u.includes('domain=ENERGY') && u.includes('category=COMMON_AREA') && seeded) {
      return new Response(
        JSON.stringify({ version: 1, tree: { daily: { '03-10': { price: '0.900000' }, '03-11': { price: '0.900000' } } } }),
        { status: 200, headers: { 'Content-Type': 'application/json', ETag: '"1"' } }
      );
    }
    if (method === 'DELETE') {
      const status = opts.deleteStatus ?? 200;
      if (status !== 200) {
        return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL', message: 'boom' } }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      seeded = false;
    }
    return base(url, init);
  });
}

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await flush();
}
function clickDialogButton(label: string): void {
  [...document.querySelectorAll<HTMLButtonElement>('.myio-dialog button')]
    .find((b) => b.textContent?.trim() === label)!
    .click();
}

describe('openPricingPanel — ED-1386 exclusão com confirmação (tariffApi)', () => {
  async function openSeeded(deleteStatus?: number) {
    const fetchMock = makeSeededFetchMock({ deleteStatus });
    const handle = openPricingPanel({
      customers: CUSTOMERS,
      currentUserEmail: 'op@myio.com.br',
      tariffApi: { baseUrl: 'https://gcdr.example', apiKey: 'gcdr_cust_X', year: 2026, fetchImpl: fetchMock as unknown as typeof fetch },
    });
    await settle();
    expect(q('[data-testid="pricing-list"]').children).toHaveLength(1);
    const onRemove = vi.fn();
    handle.on('remove', onRemove);
    return { fetchMock, handle, onRemove };
  }
  const deletes = (m: ReturnType<typeof makeSeededFetchMock>) =>
    m.mock.calls.filter((c) => c[1]?.method === 'DELETE');
  const tariffGets = (m: ReturnType<typeof makeSeededFetchMock>) =>
    m.mock.calls.filter((c) => (c[1]?.method || 'GET') === 'GET' && String(c[0]).includes('/tariffs?'));

  it('✕ mostra domínio, categoria, período e preço; Cancelar não chama a API', async () => {
    const { fetchMock, handle, onRemove } = await openSeeded();
    q<HTMLButtonElement>('[data-testid="pricing-list"] [data-remove]').click();

    const msg = getModal()!.querySelector('.myio-pricing__dialog-host .myio-dialog__message')!.textContent!;
    expect(msg).toContain('Domínio: Energia');
    expect(msg).toContain('Categoria: Área comum');
    expect(msg).toContain('Período: 10/03/2026 a 11/03/2026');
    expect(msg).toContain('Preço: R$ 0,90 R$/kWh');

    clickDialogButton('Cancelar');
    await settle();
    expect(deletes(fetchMock)).toHaveLength(0);
    expect(handle.getEntries()).toHaveLength(1);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('Excluir → DELETE /customers/:id/tariffs (um por dia), aguardado, e a linha sai da lista', async () => {
    const { fetchMock, handle, onRemove } = await openSeeded();
    q<HTMLButtonElement>('[data-testid="pricing-list"] [data-remove]').click();
    clickDialogButton('Excluir');
    await settle();

    const calls = deletes(fetchMock);
    expect(calls).toHaveLength(2);
    expect(String(calls[0][0])).toContain('https://gcdr.example/api/v1/customers/gc-1/tariffs?domain=ENERGY&category=COMMON_AREA&year=2026');
    expect(calls.map((c) => JSON.parse((c[1] as { body: string }).body).bucket.ref)).toEqual(['2026-03-10', '2026-03-11']);
    expect(handle.getEntries()).toHaveLength(0);
    expect(q('[data-testid="pricing-list"]').children).toHaveLength(0);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(q('[data-testid="pricing-error"]').classList.contains('show')).toBe(false);
  });

  it('erro da API: mensagem no painel, lista recarregada do GCDR e tarifa mantida', async () => {
    const { fetchMock, handle, onRemove } = await openSeeded(500);
    const getsBefore = tariffGets(fetchMock).length;

    q<HTMLButtonElement>('[data-testid="pricing-list"] [data-remove]').click();
    clickDialogButton('Excluir');
    await settle();

    const err = q('[data-testid="pricing-error"]');
    expect(err.classList.contains('show')).toBe(true);
    expect(err.textContent).toContain('Falha ao excluir a tarifa no servidor (INTERNAL)');
    // recarga: 2 domínios × 4 categorias
    expect(tariffGets(fetchMock).length - getsBefore).toBe(8);
    expect(handle.getEntries()).toHaveLength(1);
    expect(q('[data-testid="pricing-list"]').children).toHaveLength(1);
    expect(q<HTMLButtonElement>('[data-testid="pricing-list"] [data-remove]').disabled).toBe(false);
    expect(onRemove).not.toHaveBeenCalled();
  });
});
