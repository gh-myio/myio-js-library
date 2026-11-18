// DeviceProfileTab — datas legíveis nos atributos SERVER_SCOPE e contract/floor editáveis.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DeviceProfileTab,
  attrTimestampMs,
  relativeTime,
} from '../../../src/components/premium-modals/settings/device-profile/DeviceProfileTab';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('attrTimestampMs / relativeTime', () => {
  it('reconhece epoch ms e ISO só em chaves de data', () => {
    expect(attrTimestampMs('lastActivityTime', 1794270486125)).toBe(1794270486125);
    expect(attrTimestampMs('gcdrSyncAt', '2026-11-09T12:00:00.000Z')).toBe(Date.parse('2026-11-09T12:00:00.000Z'));
    expect(attrTimestampMs('inactivityAlarmTime', '1794021365439')).toBe(1794021365439);
    expect(attrTimestampMs('slaveId', 1794270486125)).toBeNull(); // chave não é de data
    expect(attrTimestampMs('inactivityAlarmTime', 1440)).toBeNull(); // minutos, não epoch
  });

  it('relativo em pt-BR', () => {
    const now = Date.parse('2026-11-09T12:00:00Z');
    expect(relativeTime(now - 5 * 60000, now)).toBe('há 5 min');
    expect(relativeTime(now - 3 * 3600000, now)).toBe('há 3 h');
    expect(relativeTime(now - 4 * 86400000, now)).toBe('há 4 dias');
  });
});

describe('DeviceProfileTab — seção Todos os atributos', () => {
  const open = async (attrs: Array<{ key: string; value: unknown }>) => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return json({});
      if (url.includes('/values/attributes/SERVER_SCOPE')) return json(attrs);
      return json({ id: { id: 'dev-1', entityType: 'DEVICE' }, name: 'D', label: 'L' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const tab = new DeviceProfileTab({ container, deviceId: 'dev-1', jwtToken: 'jwt', tbBaseUrl: 'https://tb.test' });
    await tab.init();
    return { container, fetchMock };
  };

  it('datas ficam legíveis, com o valor bruto no tooltip', async () => {
    const { container } = await open([
      { key: 'lastActivityTime', value: 1794270486125 },
      { key: 'gcdrSyncAt', value: '2026-11-09T12:00:00.000Z' },
    ]);
    const v = container.querySelector('[data-field="lastActivityTime"] .dpt-value')!;
    expect(v.textContent).not.toContain('1794270486125');
    expect(v.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(v.getAttribute('title')).toBe('1794270486125');
    expect(container.querySelector('[data-field="gcdrSyncAt"] .dpt-value')!.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('contract e floor são editáveis (mesmo sem o atributo) e gravam no SERVER_SCOPE', async () => {
    const { container, fetchMock } = await open([{ key: 'contract', value: '013412' }]);
    expect(container.querySelector('[data-field="contract"]')!.getAttribute('data-kind')).toBe('attr-text');
    expect(container.querySelector('[data-field="floor"]')!.getAttribute('data-kind')).toBe('attr-text');

    (container.querySelector('[data-field="floor"] [data-action="edit"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    const input = container.querySelector('[data-field="floor"] input[data-edit]') as HTMLInputElement;
    input.value = 'L3';
    (container.querySelector('[data-field="floor"] [data-action="save"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));

    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST')!;
    expect(String(post[0])).toContain('/attributes/SERVER_SCOPE');
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({ floor: 'L3' });
    expect(container.querySelector('[data-field="floor"] .dpt-value')!.textContent).toBe('L3');
  });
});

describe('DeviceProfileTab — categoria de tarifa (GCDR)', () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const open = async (opts: { gcdr?: boolean; attrs?: Array<{ key: string; value: unknown }> } = {}) => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.startsWith('https://gcdr.test')) {
        if (init?.method === 'PATCH') {
          const body = JSON.parse(String(init.body));
          return json({ success: true, data: { id: 'g-dev', customerId: 'g-cust', tariffCategory: body.tariffCategory } });
        }
        if (u.includes('/tariff-categories')) {
          return json({
            success: true,
            data: {
              items: [
                { key: 'SPECIFIC', customerId: null, label: 'Específico', isActive: true },
                { key: 'QUIOSQUES', customerId: 'g-cust', label: 'Quiosques', isActive: true },
                { key: 'VELHA', customerId: 'g-cust', label: 'Velha', isActive: false },
              ],
            },
          });
        }
        return json({ success: true, data: { id: 'g-dev', customerId: 'g-cust', name: 'D', tariffCategory: 'SPECIFIC' } });
      }
      if (u.includes('/values/attributes/SERVER_SCOPE')) return json(opts.attrs ?? [{ key: 'gcdrDeviceId', value: 'g-dev' }]);
      return json({ id: { id: 'dev-1', entityType: 'DEVICE' }, name: 'D', label: 'L' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const tab = new DeviceProfileTab({
      container,
      deviceId: 'dev-1',
      jwtToken: 'jwt',
      tbBaseUrl: 'https://tb.test',
      gcdr: opts.gcdr === false ? undefined : { baseUrl: 'https://gcdr.test', apiKey: 'k', tenantId: 't' },
    });
    await tab.init();
    return { container, fetchMock };
  };

  it('sempre mostra a categoria atual do device (label do GCDR)', async () => {
    const { container, fetchMock } = await open();
    expect(container.querySelector('[data-testid="dpt-tariff-category"]')!.textContent).toBe('Específico');
    expect(fetchMock.mock.calls.some(([u]) => String(u) === 'https://gcdr.test/api/v1/devices/g-dev')).toBe(true);
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes('/tariff-categories?customerId=g-cust&includeInactive=true'))
    ).toBe(true);
  });

  it('altera individualmente via PATCH /devices/:id (inativa não é oferecida)', async () => {
    const { container, fetchMock } = await open();
    (container.querySelector('[data-field="tariffCategory"] [data-action="edit"]') as HTMLButtonElement).click();
    await tick();
    const sel = container.querySelector('[data-testid="dpt-tariff-category-select"]') as HTMLSelectElement;
    expect([...sel.options].map((o) => o.value)).toEqual(['', 'SPECIFIC', 'QUIOSQUES']);
    sel.value = 'QUIOSQUES';
    (container.querySelector('[data-field="tariffCategory"] [data-action="save"]') as HTMLButtonElement).click();
    await tick();
    await tick();
    const patch = fetchMock.mock.calls.find(([, i]) => (i as RequestInit)?.method === 'PATCH')!;
    expect(String(patch[0])).toBe('https://gcdr.test/api/v1/devices/g-dev');
    expect(JSON.parse(String((patch[1] as RequestInit).body))).toEqual({ tariffCategory: 'QUIOSQUES' });
    expect(container.querySelector('[data-testid="dpt-tariff-category"]')!.textContent).toBe('Quiosques');
  });

  it('sem gcdrDeviceId ou sem GCDR configurado: mostra o motivo', async () => {
    const a = await open({ attrs: [] });
    expect(a.container.querySelector('[data-testid="dpt-tariff-category"]')!.textContent).toBe('Device sem gcdrDeviceId');
    document.body.innerHTML = '';
    const b = await open({ gcdr: false });
    expect(b.container.querySelector('[data-testid="dpt-tariff-category"]')!.textContent).toBe('GCDR não configurado no dashboard');
  });
});
