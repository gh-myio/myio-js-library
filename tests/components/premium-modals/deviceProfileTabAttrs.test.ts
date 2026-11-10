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
