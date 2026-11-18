/**
 * Aba "Categorias" do painel de tarifas (RFC-0081 GCDR): gestão das categorias do
 * customer, devices por categoria (um device = uma categoria) e exclusão com
 * confirmação quando há tarifas/devices.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountCategoriesTab } from '../../../src/components/pricing-panel/categoriesTab';
import { TariffApiClient, categoryKeyFromLabel } from '../../../src/components/pricing-panel/tariffApiClient';

const flush = () => new Promise((r) => setTimeout(r, 0));
const CID = 'gc-1';

function makeClient(over: Record<string, unknown> = {}) {
  const cats = [
    { key: 'SPECIFIC', customerId: null, label: 'Específico', isActive: true, sortOrder: 20 },
    { key: 'QUIOSQUES', customerId: CID, label: 'Quiosques', isActive: true, sortOrder: 30 },
    { key: 'ANTIGA', customerId: CID, label: 'Antiga', isActive: false, sortOrder: 40 },
  ];
  const devices = [
    { id: 'd1', name: 'D1', label: 'Loja 1', tariffCategory: 'QUIOSQUES' },
    { id: 'd2', name: 'D2', label: 'Loja 2', tariffCategory: 'SPECIFIC' },
    { id: 'd3', name: 'D3', label: 'Loja 3', tariffCategory: null },
  ];
  return {
    listCategories: vi.fn(async () => cats.map((c) => ({ ...c }))),
    createCategory: vi.fn(async (b: any) => ({ ...b })),
    updateCategory: vi.fn(async (k: string, p: any) => ({ key: k, ...p })),
    deleteCategory: vi.fn(async () => undefined),
    getCategoryUsage: vi.fn(async () => ({ devices: 0, tariffs: 0, customers: [] })),
    listCustomerDevices: vi.fn(async () => devices.map((d) => ({ ...d }))),
    setDeviceCategory: vi.fn(async (id: string, key: string | null) => ({ id, name: id, tariffCategory: key })),
    ...over,
  } as any;
}

function mount(client: any) {
  const container = document.createElement('div');
  const dialogHost = document.createElement('div');
  document.body.append(container, dialogHost);
  const onChanged = vi.fn();
  const tab = mountCategoriesTab({ container, client, getCustomerId: () => CID, dialogContainer: dialogHost, onChanged });
  return { container, dialogHost, tab, onChanged };
}

const clickDialog = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.myio-dialog button')].find((b) => b.textContent?.trim() === label)!.click();

afterEach(() => {
  document.body.innerHTML = '';
});

describe('categoryKeyFromLabel', () => {
  it('gera key válida do GCDR', () => {
    expect(categoryKeyFromLabel('Quiosques Taboão')).toBe('QUIOSQUES_TABOAO');
    expect(categoryKeyFromLabel('  área comum 2 ')).toBe('AREA_COMUM_2');
    expect(categoryKeyFromLabel('1º piso')).toBe('CAT_1_PISO');
    expect(categoryKeyFromLabel('')).toBe('');
  });
});

describe('aba Categorias', () => {
  it('lista só as categorias do customer (sem as globais), com contagem de devices', async () => {
    const { container, tab } = mount(makeClient());
    await tab.refresh();
    await flush();
    const keys = [...container.querySelectorAll('[data-cat]')].map((e) => e.getAttribute('data-cat'));
    expect(keys).toEqual(['QUIOSQUES', 'ANTIGA']);
    expect(container.querySelector('[data-cat="QUIOSQUES"] [data-testid="cat-devices"]')!.textContent).toContain('(1)');
  });

  it('cria categoria do customer com key derivada do nome', async () => {
    const client = makeClient();
    const { container, tab, onChanged } = mount(client);
    await tab.refresh();
    container.querySelector<HTMLInputElement>('[data-testid="cat-new-label"]')!.value = 'Praça de Alimentação';
    container.querySelector<HTMLButtonElement>('[data-testid="cat-create"]')!.click();
    await flush();
    expect(client.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'PRACA_DE_ALIMENTACAO', label: 'Praça de Alimentação', customerId: CID, isActive: true })
    );
    expect(onChanged).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="cat-notice"]')!.textContent).toContain('criada');
  });

  it('marcar device de outra categoria move para esta (um device = uma categoria); desmarcar tira', async () => {
    const client = makeClient();
    const { container, tab } = mount(client);
    await tab.refresh();
    await flush();
    container.querySelector<HTMLButtonElement>('[data-cat="QUIOSQUES"] [data-act="devices"]')!.click();
    await flush();
    const cb = (id: string) => container.querySelector<HTMLInputElement>(`input[data-dev="${id}"]`)!;
    expect(cb('d1').checked).toBe(true);
    expect(container.textContent).toContain('em Específico');
    cb('d2').checked = true;
    cb('d2').dispatchEvent(new Event('change'));
    cb('d1').checked = false;
    cb('d1').dispatchEvent(new Event('change'));
    expect(container.textContent).toContain('será movido');
    container.querySelector<HTMLButtonElement>('[data-testid="cat-dev-save"]')!.click();
    await flush();
    await flush();
    expect(client.setDeviceCategory).toHaveBeenCalledWith('d2', 'QUIOSQUES');
    expect(client.setDeviceCategory).toHaveBeenCalledWith('d1', null);
    expect(container.querySelector('[data-testid="cat-notice"]')!.textContent).toContain('2 dispositivo(s)');
  });

  it('excluir em uso: confirmação cita tarifas e devices; Cancelar não exclui', async () => {
    const client = makeClient({ getCategoryUsage: vi.fn(async () => ({ devices: 3, tariffs: 2, customers: [CID] })) });
    const { container, tab } = mount(client);
    await tab.refresh();
    container.querySelector<HTMLButtonElement>('[data-cat="QUIOSQUES"] [data-testid="cat-delete"]')!.click();
    await flush();
    const msg = document.querySelector('.myio-dialog')!.textContent!;
    expect(msg).toContain('2 tarifa(s) cadastrada(s) — serão apagadas');
    expect(msg).toContain('3 dispositivo(s) — ficarão sem categoria');
    clickDialog('Cancelar');
    await flush();
    expect(client.deleteCategory).not.toHaveBeenCalled();
  });

  it('excluir em uso confirmado → DELETE com cascade; sem uso → DELETE simples', async () => {
    const client = makeClient({ getCategoryUsage: vi.fn(async () => ({ devices: 1, tariffs: 1, customers: [] })) });
    const { container, tab, onChanged } = mount(client);
    await tab.refresh();
    container.querySelector<HTMLButtonElement>('[data-cat="QUIOSQUES"] [data-testid="cat-delete"]')!.click();
    await flush();
    clickDialog('Excluir');
    await flush();
    await flush();
    expect(client.deleteCategory).toHaveBeenCalledWith('QUIOSQUES', { cascade: true });
    expect(onChanged).toHaveBeenCalled();

    client.getCategoryUsage.mockResolvedValueOnce({ devices: 0, tariffs: 0, customers: [] });
    container.querySelector<HTMLButtonElement>('[data-cat="ANTIGA"] [data-testid="cat-delete"]')!.click();
    await flush();
    expect(document.querySelector('.myio-dialog')!.textContent).toContain('Tem certeza que deseja excluir a categoria "Antiga"');
    clickDialog('Excluir');
    await flush();
    expect(client.deleteCategory).toHaveBeenLastCalledWith('ANTIGA', { cascade: false });
  });

  it('editar renomeia e desativar/ativar usa PATCH', async () => {
    const client = makeClient();
    const { container, tab } = mount(client);
    await tab.refresh();
    container.querySelector<HTMLButtonElement>('[data-cat="QUIOSQUES"] [data-act="edit"]')!.click();
    container.querySelector<HTMLInputElement>('[data-testid="cat-edit-label"]')!.value = 'Quiosques Novos';
    container.querySelector<HTMLButtonElement>('[data-act="save-edit"]')!.click();
    await flush();
    expect(client.updateCategory).toHaveBeenCalledWith('QUIOSQUES', { label: 'Quiosques Novos' });
    container.querySelector<HTMLButtonElement>('[data-cat="ANTIGA"] [data-act="toggle"]')!.click();
    await flush();
    expect(client.updateCategory).toHaveBeenCalledWith('ANTIGA', { isActive: true });
  });

  it('erro do GCDR ao listar aparece na aba (sem lista de fallback)', async () => {
    const client = makeClient({ listCategories: vi.fn(async () => Promise.reject(Object.assign(new Error('x'), { code: 'FORBIDDEN' }))) });
    const { container, tab } = mount(client);
    await tab.refresh();
    expect(container.querySelector('[data-testid="cat-load-error"]')!.textContent).toContain('FORBIDDEN');
    expect(container.querySelector('[data-cat]')).toBeNull();
  });
});

describe('TariffApiClient — categorias e devices', () => {
  function fetchMock(handler: (url: string, init: any) => any) {
    return vi.fn(async (url: string, init: any = {}) => {
      const r = handler(String(url), init);
      if (r === 204) return new Response(null, { status: 204 });
      return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
    });
  }

  it('POST/PATCH/DELETE/usage nos caminhos do GCDR', async () => {
    const f = fetchMock((url, init) =>
      init.method === 'DELETE' ? 204 : { body: { success: true, data: url.includes('/usage') ? { devices: 1, tariffs: 2, customers: ['c'] } : { key: 'K', label: 'L' } } }
    );
    const c = new TariffApiClient({ baseUrl: 'https://g', apiKey: 'k', fetchImpl: f as any });
    await c.createCategory({ key: 'K', label: 'L', customerId: 'c' });
    await c.updateCategory('K', { isActive: false });
    expect(await c.getCategoryUsage('K')).toEqual({ devices: 1, tariffs: 2, customers: ['c'] });
    await c.deleteCategory('K', { cascade: true });
    const calls = f.mock.calls.map(([u, i]: any[]) => `${i.method} ${u}`);
    expect(calls).toEqual([
      'POST https://g/api/v1/tariff-categories',
      'PATCH https://g/api/v1/tariff-categories/K',
      'GET https://g/api/v1/tariff-categories/K/usage',
      'DELETE https://g/api/v1/tariff-categories/K?cascade=true',
    ]);
  });

  it('listCustomerDevices pagina pelo cursor; setDeviceCategory faz PATCH /devices/:id', async () => {
    const f = fetchMock((url, init) => {
      if (init.method === 'PATCH') return { body: { success: true, data: { id: 'd1', name: 'D1', tariffCategory: null } } };
      const page2 = url.includes('cursor=1');
      return {
        body: {
          success: true,
          data: {
            items: [{ id: page2 ? 'd2' : 'd1', name: 'x', tariffCategory: page2 ? 'SPECIFIC' : null }],
            pagination: { hasMore: !page2, nextCursor: page2 ? undefined : '1' },
          },
        },
      };
    });
    const c = new TariffApiClient({ baseUrl: 'https://g', apiKey: 'k', fetchImpl: f as any });
    const list = await c.listCustomerDevices('c', { pageSize: 1 });
    expect(list.map((d) => [d.id, d.tariffCategory])).toEqual([
      ['d1', null],
      ['d2', 'SPECIFIC'],
    ]);
    await c.setDeviceCategory('d1', null);
    const [url, init] = f.mock.calls[2] as any[];
    expect(`${init.method} ${url}`).toBe('PATCH https://g/api/v1/devices/d1');
    expect(JSON.parse(init.body)).toEqual({ tariffCategory: null });
  });
});
