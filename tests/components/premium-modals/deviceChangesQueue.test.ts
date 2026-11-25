// ED-1413 — fila de registro de alterações do device no GCDR (G-2: POST /devices/:id/changes).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEVICE_CHANGES_MAX_QUEUE,
  DEVICE_CHANGES_QUEUE_KEY,
  DEVICE_CHANGES_TTL_MS,
  DEVICE_CHANGE_RETRY_DELAYS_MS,
  LABEL_CHANGE_FATAL_WARNING,
  LABEL_CHANGE_RETRY_WARNING,
  buildLabelChangeEntry,
  flushPendingDeviceChanges,
  readDeviceChangesQueue,
  recordDeviceChange,
  type DeviceChangesDeps,
} from '../../../src/components/premium-modals/settings/device-changes/deviceChangesQueue';

const AUTHOR = { id: 'u-1', email: 'operador@example.com', name: 'Operador' };
const API = { gcdrApiBaseUrl: 'https://gcdr.test/api/v1', gcdrApiKey: 'gcdr_cust_KEY', gcdrTenantId: 'tenant-1' };

const entry = (over: Partial<Parameters<typeof buildLabelChangeEntry>[0]> = {}) =>
  buildLabelChangeEntry({ gcdrDeviceId: 'gcdr-dev-1', tbDeviceId: 'tb-dev-1', from: 'OUTBACK', to: 'NOVA LOJA', changedBy: AUTHOR, scope: 'cust-1', ...over });

const respond = (status: number) => new Response(status === 204 ? null : '{}', { status });

function setup(statuses: number[], extra: Partial<DeviceChangesDeps> = {}) {
  const queue = [...statuses];
  const fetchImpl = vi.fn(async () => respond(queue.length > 1 ? queue.shift()! : queue[0]));
  const toast = { warning: vi.fn() };
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const logger = { warn: vi.fn(), error: vi.fn() };
  const deps: DeviceChangesDeps = {
    api: API,
    scope: 'cust-1',
    fetchImpl: fetchImpl as unknown as typeof fetch,
    storage: localStorage,
    toast,
    setTimer: (fn, ms) => timers.push({ fn, ms }),
    logger,
    ...extra,
  };
  const runNextTimer = async () => {
    const t = timers.shift();
    if (!t) throw new Error('no timer scheduled');
    t.fn();
    await new Promise((r) => setTimeout(r, 0));
    return t.ms;
  };
  return { deps, fetchImpl, toast, timers, logger, runNextTimer };
}

const sentBody = (fetchImpl: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse((fetchImpl.mock.calls[call] as unknown as [string, RequestInit])[1].body as string);

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('deviceChangesQueue — envio para o G-2', () => {
  it('POST no endpoint do G-2 com X-API-Key / X-Tenant-ID e o corpo do contrato', async () => {
    const { deps, fetchImpl } = setup([201]);
    const e = entry();
    await recordDeviceChange(e, deps);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://gcdr.test/api/v1/devices/gcdr-dev-1/changes');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'X-API-Key': 'gcdr_cust_KEY',
      'X-Tenant-ID': 'tenant-1',
      'Content-Type': 'application/json',
    });
    expect(sentBody(fetchImpl)).toEqual({
      changeId: e.changeId,
      source: 'tb-settings-modal',
      changes: [{ field: 'label', from: 'OUTBACK', to: 'NOVA LOJA' }],
      changedBy: AUTHOR,
    });
    expect(e.changeId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('2xx → sai da fila, sem aviso', async () => {
    const { deps, toast } = setup([201]);
    expect(await recordDeviceChange(entry(), deps)).toBe('ok');
    expect(readDeviceChangesQueue(localStorage)).toHaveLength(0);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('falha (500) → aviso não bloqueante, fica na fila e reenvia com o MESMO changeId', async () => {
    const { deps, fetchImpl, toast, timers, runNextTimer } = setup([500, 500, 201]);
    const e = entry();

    expect(await recordDeviceChange(e, deps)).toBe('retryable');
    expect(toast.warning).toHaveBeenCalledWith(LABEL_CHANGE_RETRY_WARNING, 8000);
    expect(readDeviceChangesQueue(localStorage).map((q) => q.changeId)).toEqual([e.changeId]);
    expect(timers[0].ms).toBe(DEVICE_CHANGE_RETRY_DELAYS_MS[0]);

    expect(await runNextTimer()).toBe(DEVICE_CHANGE_RETRY_DELAYS_MS[0]); // 2ª tentativa: 500
    expect(await runNextTimer()).toBe(DEVICE_CHANGE_RETRY_DELAYS_MS[1]); // 3ª tentativa: 201

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect([0, 1, 2].map((i) => sentBody(fetchImpl, i).changeId)).toEqual([e.changeId, e.changeId, e.changeId]);
    expect(readDeviceChangesQueue(localStorage)).toHaveLength(0);
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it('erro de rede é retentável', async () => {
    const { deps } = setup([201]);
    deps.fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await recordDeviceChange(entry(), deps)).toBe('retryable');
    expect(readDeviceChangesQueue(localStorage)[0].lastError).toBe('Failed to fetch');
  });

  it('esgotadas as tentativas da sessão, a entrada continua na fila para a próxima abertura', async () => {
    const { deps, timers, runNextTimer } = setup([503]);
    await recordDeviceChange(entry(), deps);
    for (let i = 0; i < DEVICE_CHANGE_RETRY_DELAYS_MS.length; i++) await runNextTimer();

    expect(timers).toHaveLength(0);
    const [queued] = readDeviceChangesQueue(localStorage);
    expect(queued.attempts).toBe(1 + DEVICE_CHANGE_RETRY_DELAYS_MS.length);
  });

  it('409 (changeId já registrado) conta como sucesso — idempotente', async () => {
    const { deps } = setup([409]);
    expect(await recordDeviceChange(entry(), deps)).toBe('ok');
    expect(readDeviceChangesQueue(localStorage)).toHaveLength(0);
  });

  it('400 → descartado com console.error e aviso sem "tentaremos de novo"', async () => {
    const { deps, toast, timers, logger } = setup([400]);
    expect(await recordDeviceChange(entry(), deps)).toBe('fatal');
    expect(readDeviceChangesQueue(localStorage)).toHaveLength(0);
    expect(timers).toHaveLength(0);
    expect(logger.error).toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(LABEL_CHANGE_FATAL_WARNING, 8000);
  });

  it('sem gcdrApiKey (nem no MyIOOrchestrator) → retentável, sem chamar a rede', async () => {
    const { deps, fetchImpl } = setup([201], { api: { gcdrApiBaseUrl: 'https://gcdr.test' } });
    expect(await recordDeviceChange(entry(), deps)).toBe('retryable');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(readDeviceChangesQueue(localStorage)).toHaveLength(1);
  });
});

describe('deviceChangesQueue — reenvio na próxima abertura (flush)', () => {
  it('reenvia o que ficou na fila com o mesmo changeId e esvazia', async () => {
    const failing = setup([500]);
    const e = entry();
    await recordDeviceChange(e, failing.deps); // fica na fila (a modal "fechou")

    const later = setup([201]);
    const result = await flushPendingDeviceChanges(later.deps);

    expect(result).toEqual({ sent: 1, remaining: 0 });
    expect(sentBody(later.fetchImpl).changeId).toBe(e.changeId);
    expect(later.toast.warning).not.toHaveBeenCalled();
  });

  it('mantém entradas de outro customer (scope) para o dashboard dele', async () => {
    localStorage.setItem(DEVICE_CHANGES_QUEUE_KEY, JSON.stringify([entry({ scope: 'outro-cust' })]));
    const { deps, fetchImpl } = setup([201]);
    expect(await flushPendingDeviceChanges(deps)).toEqual({ sent: 0, remaining: 1 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('descarta entradas além do TTL e mantém no máximo DEVICE_CHANGES_MAX_QUEUE', async () => {
    const now = Date.parse('2026-11-25T12:00:00Z');
    const old = entry({ now: () => now - DEVICE_CHANGES_TTL_MS - 1 });
    const many = Array.from({ length: DEVICE_CHANGES_MAX_QUEUE + 5 }, () => entry({ now: () => now }));
    localStorage.setItem(DEVICE_CHANGES_QUEUE_KEY, JSON.stringify([old, ...many]));

    const { deps, fetchImpl } = setup([500], { now: () => now });
    await flushPendingDeviceChanges(deps);

    const ids = fetchImpl.mock.calls.map((_, i) => sentBody(fetchImpl, i).changeId);
    expect(ids).not.toContain(old.changeId);
    expect(ids).toHaveLength(DEVICE_CHANGES_MAX_QUEUE);
    expect(readDeviceChangesQueue(localStorage)).toHaveLength(DEVICE_CHANGES_MAX_QUEUE);
  });

  it('fila corrompida no localStorage é ignorada sem lançar', async () => {
    localStorage.setItem(DEVICE_CHANGES_QUEUE_KEY, '{not json');
    const { deps } = setup([201]);
    await expect(flushPendingDeviceChanges(deps)).resolves.toEqual({ sent: 0, remaining: 0 });
  });
});
