// SettingsModalView — abas OSs (GCDR work-orders) e Incidentes (alarms-backend), só @myio.com.br.
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../../src/components/premium-modals/central-settings';
import { SettingsModalView } from '../../../src/components/premium-modals/settings/SettingsModalView';
import {
  renderDeviceIncidentsTab,
  renderDeviceWorkOrdersTab,
} from '../../../src/components/premium-modals/settings/myio-ops/DeviceOpsTabs';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const flush = () => new Promise((r) => setTimeout(r, 0));
const api = { gcdrDeviceId: 'gd-1', identifier: '304DEFG', gcdrApiBaseUrl: 'https://gcdr.test/api/v1', alarmsApiBaseUrl: 'https://alarms.test/api/v1', gcdrApiKey: 'k', gcdrTenantId: 't' };

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as any).TicketServiceOrchestrator;
  document.body.innerHTML = '';
});

describe('abas OSs / Incidentes — visibilidade', () => {
  const tabs = (userEmail: string, superadmin = false) => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ data: [] })));
    document.body.innerHTML = '';
    new SettingsModalView({
      deviceId: 'd', customerId: 'c', jwtToken: 'j', tbBaseUrl: 'https://tb.test', domain: 'energy',
      themeMode: 'light', userEmail, superadmin, gcdrDeviceId: 'gd-1', onSave: async () => undefined, onClose: () => undefined,
    } as any).render({});
    return [...document.querySelectorAll<HTMLElement>('.modal-tab')].map((b) => b.dataset.tab);
  };

  it('aparecem para @myio.com.br; não para outros (nem com flag superadmin)', () => {
    expect(tabs('rodrigo@myio.com.br')).toEqual(expect.arrayContaining(['device-os', 'device-incidents']));
    expect(tabs('cliente@shopping.com')).not.toContain('device-os');
    expect(tabs('cliente@shopping.com', true)).not.toContain('device-incidents');
  });

  it('aba de perfil renomeada para "Perfil Disp."', () => {
    tabs('rodrigo@myio.com.br');
    expect(document.querySelector('[data-tab="device-profile"]')!.textContent).toContain('Perfil Disp.');
  });
});

describe('aba OSs', () => {
  it('lista OSs do GCDR por deviceId e o badge soma OSs + chamados FreshDesk', async () => {
    const fetchMock = vi.fn(async () =>
      json({ success: true, data: { items: [
        { id: '1', code: 'OS-ABC1D23', title: 'Troca de TC', type: 'MANUTENCAO', status: 'EM_ANDAMENTO', createdAt: '2026-11-01T10:00:00Z' },
        { id: '2', code: 'OS-XYZ9K88', type: 'CHAMADO', status: 'FINALIZADA', createdAt: '2026-11-02T10:00:00Z' },
      ] } })
    );
    vi.stubGlobal('fetch', fetchMock);
    (window as any).TicketServiceOrchestrator = { getTicketCountForDevice: (id: string) => (id === '304DEFG' ? 3 : 0) };
    const el = document.createElement('div');
    const n = await renderDeviceWorkOrdersTab(el, api);
    expect(n).toBe(5);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://gcdr.test/api/v1/wo/work-orders?deviceId=gd-1&limit=100');
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('k');
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el.textContent).toContain('Em andamento');
    expect(el.textContent).toContain('Chamado');
  });

  it('401 do GCDR → mensagem clara; badge fica só com os chamados', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ success: false }, 401)));
    (window as any).TicketServiceOrchestrator = { getTicketCountForDevice: () => 2 };
    const el = document.createElement('div');
    expect(await renderDeviceWorkOrdersTab(el, api)).toBe(2);
    expect(el.querySelector('.dops-error')!.textContent).toContain('ainda não libera');
  });
});

describe('aba Incidentes', () => {
  it('busca no alarms-backend por device e conta os não resolvidos', async () => {
    const fetchMock = vi.fn(async () =>
      json({ data: [
        { id: 'a', kind: 'NO_CONSUMPTION', severity: 'HIGH', status: 'OPEN', day: '2026-11-09', centralName: 'Central X' },
        { id: 'b', kind: 'NO_CONSUMPTION', severity: 'LOW', status: 'RESOLVED', day: '2026-11-01' },
      ], pagination: { total: 2 } })
    );
    vi.stubGlobal('fetch', fetchMock);
    const el = document.createElement('div');
    expect(await renderDeviceIncidentsTab(el, api)).toBe(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://alarms.test/api/v1/incidents?device=gd-1&sortBy=firstDetectedAt&sortDir=desc&limit=100'
    );
    expect(el.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(el.textContent).toContain('Aberto');
  });

  it('sem gcdrDeviceId → aviso, sem chamada de rede', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const el = document.createElement('div');
    expect(await renderDeviceIncidentsTab(el, { ...api, gcdrDeviceId: '' })).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    await flush();
  });
});
