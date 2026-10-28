import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../src/components/premium-modals/central-settings';
import { SettingsModalView } from '../../../src/components/premium-modals/settings/SettingsModalView';
import { WellEquipmentTab } from '../../../src/components/premium-modals/settings/well-equipment/WellEquipmentTab';

const catalog = [
  { id: { id: 'pump-1' }, name: 'Pump one' },
  { id: { id: 'pump-2' }, name: 'Pump two' },
  { id: { id: 'valve-1' }, name: 'Solenoid one' },
  { id: { id: 'wrong-1' }, name: 'Wrong profile' },
  { id: { id: 'cistern-pump-1' }, name: 'Cistern pump' },
];
const equipmentAttributes: Record<string, Array<{ key: string; value: unknown }>> = {
  'pump-1': [
    { key: 'deviceProfile', value: 'BOMBA_POCO' },
    { key: 'gcdrDeviceId', value: 'gcdr-pump-1' },
  ],
  'pump-2': [{ key: 'deviceProfile', value: 'BOMBA_POCO' }],
  'valve-1': [
    { key: 'deviceProfile', value: 'SOLENOIDE' },
    { key: 'gcdrDeviceId', value: 'gcdr-valve-1' },
  ],
  'wrong-1': [{ key: 'deviceProfile', value: 'BOMBA_HIDRAULICA' }],
  'cistern-pump-1': [{ key: 'deviceProfile', value: 'BOMBA_CISTERNA' }],
};

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

function openTab(deviceId = 'well-1', stored: unknown = undefined, writeOk = true) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'POST') return response({}, writeOk, writeOk ? 200 : 500);
    if (url.includes('/api/customer/customer-1/devices')) {
      return response({ data: catalog, hasNext: false });
    }
    if (url.includes(`/${deviceId}/values/attributes/`)) {
      return response(stored === undefined ? [] : [{ key: 'pumpBindings', value: stored }]);
    }
    const equipmentId = Object.keys(equipmentAttributes).find((id) => url.includes(`/${id}/values/attributes/`));
    return response(equipmentAttributes[equipmentId || ''] || []);
  });
  vi.stubGlobal('fetch', fetchMock);
  const tab = new WellEquipmentTab({
    container,
    deviceId,
    deviceProfile: 'CISTERNA',
    customerId: 'customer-1',
    jwtToken: 'jwt',
    tbBaseUrl: 'https://thingsboard.test',
  });
  return { container, fetchMock, tab };
}

function select(container: HTMLElement, selector: string, value: string) {
  const element = container.querySelector<HTMLSelectElement>(selector)!;
  element.value = value;
  element.dispatchEvent(new Event('change'));
}

async function save(container: HTMLElement) {
  container.querySelector<HTMLButtonElement>('#wet-save')!.click();
  await vi.waitFor(() => {
    expect(container.querySelector<HTMLButtonElement>('#wet-save')!.disabled).toBe(false);
  });
}

const modal = () => {
  const all = document.querySelectorAll<HTMLElement>('.myio-device-settings-modal');
  return all[all.length - 1];
};

function openView(overrides: Record<string, unknown>) {
  const view = new SettingsModalView({
    title: 'Settings',
    domain: 'water',
    mapInstantaneousPower: {},
    deviceMapInstaneousPower: {},
    onSave: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  } as any);
  view.render({});
  return view;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([], false, 404)));
});

afterEach(() => {
  document.querySelectorAll('.myio-device-settings-overlay').forEach((element) => element.remove());
  document.querySelectorAll('body > div:not(.myio-device-settings-overlay)').forEach((element) => {
    if (element.querySelector('#wet-save')) element.remove();
  });
  vi.unstubAllGlobals();
});

describe('WellEquipmentTab', () => {
  it('loads partial bindings, filters by equipment profile and saves canonical partial JSON', async () => {
    const stored = {
      pumps: [{ tbId: 'pump-1', gcdrId: 'old-gcdr', code: 'B1', label: 'Poço B1 custom', thresholdW: 25 }],
      valves: [],
    };
    const { container, fetchMock, tab } = openTab('well-1', stored);
    await tab.init();

    expect(container.querySelector<HTMLSelectElement>('#wet-b1-device')!.value).toBe('pump-1');
    expect(container.querySelector<HTMLSelectElement>('#wet-b2-device')!.querySelector('[value="wrong-1"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('#wet-b1-label')!.value).toBe('Poço B1 custom');
    select(container, '#wet-b2-device', 'pump-2');
    await save(container);

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      pumpBindings: {
        pumps: [
          { tbId: 'pump-1', gcdrId: 'gcdr-pump-1', code: 'B1', label: 'Poço B1 custom', thresholdW: 25 },
          { tbId: 'pump-2', code: 'B2', label: 'Pump two' },
        ],
        valves: [],
      },
    });
    expect(container.textContent).toContain('Vínculos salvos com sucesso.');
  });

  it('BOMBA_CISTERNA behaves like BOMBA_POCO: listed for B1/B2 (not S) and saved as a pump', async () => {
    const { container, fetchMock, tab } = openTab();
    await tab.init();
    const opt = (sel: string) => container.querySelector(`${sel} [value="cistern-pump-1"]`);
    expect(opt('#wet-b1-device')).not.toBeNull();
    expect(opt('#wet-b2-device')).not.toBeNull();
    expect(opt('#wet-s-device')).toBeNull();
    select(container, '#wet-b1-device', 'pump-1');
    select(container, '#wet-b2-device', 'cistern-pump-1');
    await save(container);

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body)).pumpBindings.pumps).toEqual([
      { tbId: 'pump-1', gcdrId: 'gcdr-pump-1', code: 'B1', label: 'Pump one' },
      { tbId: 'cistern-pump-1', code: 'B2', label: 'Cistern pump' },
    ]);
  });

  it('saves full bindings with stable B1/B2/S codes and editable labels', async () => {
    const { container, fetchMock, tab } = openTab();
    await tab.init();
    select(container, '#wet-b1-device', 'pump-1');
    select(container, '#wet-b2-device', 'pump-2');
    select(container, '#wet-s-device', 'valve-1');
    container.querySelector<HTMLInputElement>('#wet-b2-label')!.value = 'Bomba B2 custom';
    await save(container);

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      pumpBindings: {
        pumps: [
          { tbId: 'pump-1', gcdrId: 'gcdr-pump-1', code: 'B1', label: 'Pump one' },
          { tbId: 'pump-2', code: 'B2', label: 'Bomba B2 custom' },
        ],
        valves: [{ tbId: 'valve-1', gcdrId: 'gcdr-valve-1', code: 'S', label: 'Solenoid one' }],
      },
    });
  });

  it('keeps an unchanged unavailable binding while saving other slot changes', async () => {
    const stored = {
      pumps: [{ tbId: 'legacy-pump', code: 'B1', label: 'Bomba antiga' }],
      valves: [],
    };
    const { container, fetchMock, tab } = openTab('well-1', stored);
    await tab.init();
    select(container, '#wet-b2-device', 'pump-2');
    await save(container);

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body)).pumpBindings.pumps).toEqual([
      { tbId: 'legacy-pump', code: 'B1', label: 'Bomba antiga' },
      { tbId: 'pump-2', code: 'B2', label: 'Pump two' },
    ]);
    expect(container.textContent).toContain('Vínculos salvos com sucesso.');
  });

  it('saves an empty canonical configuration and permits equipment reuse across wells', async () => {
    const first = openTab('well-1');
    await first.tab.init();
    await save(first.container);
    const emptyPost = first.fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(emptyPost?.[1]?.body))).toEqual({ pumpBindings: { pumps: [], valves: [] } });

    const wellA = openTab('well-a');
    await wellA.tab.init();
    select(wellA.container, '#wet-b1-device', 'pump-1');
    await save(wellA.container);

    const wellB = openTab('well-b');
    await wellB.tab.init();
    select(wellB.container, '#wet-b1-device', 'pump-1');
    await save(wellB.container);
    const sharedPost = wellB.fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(sharedPost?.[1]?.body)).pumpBindings.pumps[0].tbId).toBe('pump-1');
  });

  it('rejects duplicate pumps without persisting', async () => {
    const { container, fetchMock, tab } = openTab();
    await tab.init();
    select(container, '#wet-b1-device', 'pump-1');
    select(container, '#wet-b2-device', 'pump-1');
    await save(container);
    expect(container.textContent).toContain('Selecione bombas diferentes');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('reports read and write failures without showing success', async () => {
    const readFailure = openTab();
    readFailure.fetchMock.mockImplementation(async (input, init) => {
      if (String(input).includes('/values/attributes/SERVER_SCOPE?keys=pumpBindings')) return response({}, false, 403);
      if (String(input).includes('/api/customer/customer-1/devices')) return response({ data: [], hasNext: false });
      return response([]);
    });
    await readFailure.tab.init();
    expect(readFailure.container.textContent).toContain('HTTP 403');
    expect(readFailure.container.querySelector('#wet-save')).toBeNull();

    const writeFailure = openTab('well-1', undefined, false);
    await writeFailure.tab.init();
    await save(writeFailure.container);
    expect(writeFailure.container.textContent).toContain('Falha ao salvar os vínculos: HTTP 500');
    expect(writeFailure.container.textContent).not.toContain('Vínculos salvos com sucesso.');
  });

  it('stops when customer pagination claims another empty page', async () => {
    const { container, fetchMock, tab } = openTab();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/customer/customer-1/devices')) {
        return response({ data: [], hasNext: true });
      }
      if (url.includes('/well-1/values/attributes/')) {
        return response([]);
      }
      return response([]);
    });
    await tab.init();
    expect(container.textContent).toContain('Paginação do catálogo não avançou');
    expect(container.querySelector('#wet-save')).toBeNull();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/api/customer/')).length).toBe(1);
  });

  it('keeps a partial catalog usable when an individual equipment attribute read fails', async () => {
    const { container, fetchMock, tab } = openTab();
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (init?.method === 'POST') return response({});
      if (url.includes('/api/customer/customer-1/devices')) return response({ data: catalog, hasNext: false });
      if (url.includes('/well-1/values/attributes/')) return response([]);
      if (url.includes('/pump-1/values/attributes/')) return response([], false, 403);
      const id = Object.keys(equipmentAttributes).find((candidate) => url.includes(`/${candidate}/values/attributes/`));
      return response(equipmentAttributes[id || ''] || []);
    });
    await tab.init();
    expect(container.querySelector<HTMLSelectElement>('#wet-b2-device')!.querySelector('[value="pump-2"]')).not.toBeNull();
    expect(container.textContent).toContain('equipamento(s) não puderam ser verificados');
  });
});

describe('well equipment settings visibility', () => {
  it('shows the tab only for a cistern profile and SuperAdmin', () => {
    openView({ deviceProfile: 'CISTERNA', superadmin: true });
    expect(modal().querySelector('[data-tab="well-equipment"]')).not.toBeNull();
    document.querySelectorAll('.myio-device-settings-overlay').forEach((element) => element.remove());

    openView({ deviceProfile: 'CISTERNA_ENTRADA', superadmin: true });
    expect(modal().querySelector('[data-tab="well-equipment"]')).not.toBeNull();
    document.querySelectorAll('.myio-device-settings-overlay').forEach((element) => element.remove());

    openView({ deviceProfile: 'CISTERNA', superadmin: false, userEmail: 'operator@example.com' });
    expect(modal().querySelector('[data-tab="well-equipment"]')).toBeNull();
    document.querySelectorAll('.myio-device-settings-overlay').forEach((element) => element.remove());

    openView({ deviceProfile: 'BOMBA_POCO', superadmin: true });
    expect(modal().querySelector('[data-tab="well-equipment"]')).toBeNull();
  });
});
