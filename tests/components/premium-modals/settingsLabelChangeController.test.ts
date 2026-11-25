// ED-1413 — SettingsController: troca de etiqueta confirmada → salva no TB e, só com o TB OK,
// registra no GCDR (G-2). Falha no G-2 não desfaz o TB; a fila reenvia com o mesmo changeId.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// central-settings estende SettingsModalView: importar antes evita o ciclo de import no jsdom
import '../../../src/components/premium-modals/central-settings';
import { SettingsController } from '../../../src/components/premium-modals/settings/SettingsController';
import { MyIOToast } from '../../../src/components/MyIOToast';
import {
  DEVICE_CHANGES_QUEUE_KEY,
  LABEL_CHANGE_RETRY_WARNING,
  buildLabelChangeEntry,
  readDeviceChangesQueue,
} from '../../../src/components/premium-modals/settings/device-changes/deviceChangesQueue';

const flush = () => new Promise((r) => setTimeout(r, 0));
const isG2 = (url: unknown) => /\/api\/v1\/devices\/[^/]+\/changes$/.test(String(url));

function installFetch(g2Status = 201) {
  const fetchMock = vi.fn(async (url: string) => {
    if (isG2(url)) return new Response('{}', { status: g2Status });
    if (String(url).includes('/annotations')) {
      return new Response(JSON.stringify({ items: [], pagination: { page: 1, limit: 100, hasNext: false } }), { status: 200 });
    }
    return new Response('[]', { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const g2Calls = (fetchMock: ReturnType<typeof installFetch>) =>
  fetchMock.mock.calls
    .map((call, i) => ({ call: call as unknown as [string, RequestInit], order: fetchMock.mock.invocationCallOrder[i] }))
    .filter(({ call }) => isG2(call[0]));

async function openModal(opts: { tbLabelOk?: boolean; gcdrDeviceId?: string | null; g2Status?: number } = {}) {
  const fetchMock = installFetch(opts.g2Status ?? 201);
  const persister = {
    saveEntityLabel: vi.fn(async () =>
      opts.tbLabelOk === false
        ? { ok: false, error: { code: 'NETWORK_ERROR', message: 'TB indisponível' } }
        : { ok: true }
    ),
    saveServerScopeAttributes: vi.fn(async () => ({ ok: true, updatedKeys: [] })),
  };
  const attributes: Record<string, unknown> = { floor: 'L3' };
  if (opts.gcdrDeviceId !== null) attributes.gcdrDeviceId = opts.gcdrDeviceId ?? 'gcdr-dev-1';
  const fetcher = { fetchCurrentSettings: vi.fn(async () => ({ entity: { label: 'outback' }, attributes })) };

  const controller = new SettingsController({
    deviceId: 'tb-dev-1',
    jwtToken: 'jwt',
    label: 'outback',
    domain: 'energy',
    userEmail: 'operador@example.com',
    api: { tbBaseUrl: 'https://tb.test' },
    persister,
    fetcher,
  } as any);
  await controller.show();
  await flush();

  const saveWithLabel = async (value: string, confirm = true) => {
    const label = document.querySelector<HTMLInputElement>('#label')!;
    label.value = value;
    label.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('.btn-save')!.click();
    await flush();
    const btn = document.querySelector<HTMLButtonElement>(
      `.myio-dialog__btn--${confirm ? 'primary' : 'secondary'}`
    );
    btn?.click();
    await flush();
  };

  return { controller, fetchMock, persister, saveWithLabel };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  (window as any).MyIOOrchestrator = {
    gcdrApiBaseUrl: 'https://gcdr.test',
    gcdrApiKey: 'gcdr_cust_KEY',
    gcdrTenantId: 'tenant-1',
    gcdrCustomerId: 'cust-1',
  };
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  delete (window as any).MyIOOrchestrator;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('SettingsController — troca de etiqueta registrada no GCDR (ED-1413)', () => {
  it('Confirmar → salva no TB e, depois do OK, chama o G-2 com changeId/source/changes', async () => {
    const { fetchMock, persister, saveWithLabel } = await openModal();
    await saveWithLabel('nova loja');

    await vi.waitFor(() => expect(g2Calls(fetchMock)).toHaveLength(1));
    expect(persister.saveEntityLabel).toHaveBeenCalledWith('tb-dev-1', 'NOVA LOJA');

    const [{ call, order }] = g2Calls(fetchMock);
    expect(call[0]).toBe('https://gcdr.test/api/v1/devices/gcdr-dev-1/changes');
    expect(order).toBeGreaterThan(persister.saveEntityLabel.mock.invocationCallOrder[0]);
    const body = JSON.parse(call[1].body as string);
    expect(body).toMatchObject({
      source: 'tb-settings-modal',
      changes: [{ field: 'label', from: 'OUTBACK', to: 'NOVA LOJA' }],
      changedBy: { email: 'operador@example.com' },
    });
    expect(body.changeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(readDeviceChangesQueue(localStorage)).toHaveLength(0);
  });

  it('Cancelar → nada é salvo (nem TB nem G-2)', async () => {
    const { fetchMock, persister, saveWithLabel } = await openModal();
    await saveWithLabel('nova loja', false);
    await flush();

    expect(persister.saveEntityLabel).not.toHaveBeenCalled();
    expect(g2Calls(fetchMock)).toHaveLength(0);
  });

  it('TB falhou → sem chamada ao G-2', async () => {
    const { fetchMock, persister, saveWithLabel } = await openModal({ tbLabelOk: false });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await saveWithLabel('nova loja');

    await vi.waitFor(() => expect(persister.saveEntityLabel).toHaveBeenCalled());
    await flush();
    expect(g2Calls(fetchMock)).toHaveLength(0);
  });

  it('salvar sem mudar a etiqueta → grava no TB como hoje, sem G-2', async () => {
    const { fetchMock, persister } = await openModal();
    document.querySelector<HTMLButtonElement>('.btn-save')!.click();

    await vi.waitFor(() => expect(persister.saveEntityLabel).toHaveBeenCalledWith('tb-dev-1', 'OUTBACK'));
    await flush();
    expect(document.querySelector('.myio-dialog-overlay')).toBeNull();
    expect(g2Calls(fetchMock)).toHaveLength(0);
  });

  it('device sem gcdrDeviceId → salva no TB, só avisa no console e a modal fecha normalmente', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fetchMock, persister, saveWithLabel } = await openModal({ gcdrDeviceId: null });
    await saveWithLabel('nova loja');

    await vi.waitFor(() => expect(persister.saveEntityLabel).toHaveBeenCalled());
    expect(warn.mock.calls.some((c) => String(c[0]).includes('sem gcdrDeviceId'))).toBe(true);
    expect(g2Calls(fetchMock)).toHaveLength(0);
    expect(readDeviceChangesQueue(localStorage)).toHaveLength(0);
    await vi.waitFor(() => expect(document.querySelector('.myio-device-settings-overlay')).toBeNull(), {
      timeout: 2000,
    });
  });

  it('falha no G-2 → aviso não bloqueante, TB não é desfeito e a troca fica na fila', async () => {
    const toastSpy = vi.spyOn(MyIOToast, 'warning').mockImplementation(() => ({}) as any);
    const { fetchMock, persister, saveWithLabel } = await openModal({ g2Status: 503 });
    await saveWithLabel('nova loja');

    await vi.waitFor(() => expect(toastSpy).toHaveBeenCalledWith(LABEL_CHANGE_RETRY_WARNING, 8000));
    expect(persister.saveEntityLabel).toHaveBeenCalledTimes(1);
    const [queued] = readDeviceChangesQueue(localStorage);
    expect(queued.body.changes).toEqual([{ field: 'label', from: 'OUTBACK', to: 'NOVA LOJA' }]);
    expect(JSON.parse(g2Calls(fetchMock)[0].call[1].body as string).changeId).toBe(queued.changeId);
  });

  it('abrir a modal com troca pendente na fila → reenvia com o mesmo changeId (sem duplicar)', async () => {
    const pending = buildLabelChangeEntry({ gcdrDeviceId: 'gcdr-dev-9', from: 'A', to: 'B', scope: 'cust-1' });
    localStorage.setItem(DEVICE_CHANGES_QUEUE_KEY, JSON.stringify([pending]));

    const { fetchMock } = await openModal();

    await vi.waitFor(() => expect(g2Calls(fetchMock)).toHaveLength(1));
    const [{ call }] = g2Calls(fetchMock);
    expect(call[0]).toBe('https://gcdr.test/api/v1/devices/gcdr-dev-9/changes');
    expect(JSON.parse(call[1].body as string).changeId).toBe(pending.changeId);
    await vi.waitFor(() => expect(readDeviceChangesQueue(localStorage)).toHaveLength(0));
  });
});
