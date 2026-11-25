/**
 * ED-1413 (épico ED-1409) — records device changes made in the Settings modal
 * in GCDR via G-2: `POST {gcdr}/api/v1/devices/:gcdrDeviceId/changes`.
 * GCDR turns a label change into an important `system` annotation.
 *
 * Delivery rules:
 *   - every change carries a client-generated `changeId` (uuid) and is
 *     re-sent with the SAME id, so GCDR can deduplicate (2xx or 409 = done);
 *   - the entry is persisted in localStorage BEFORE the first attempt, so a
 *     closed modal/tab never loses it — `flushPendingDeviceChanges` re-sends
 *     the queue the next time the Settings modal opens;
 *   - retryable failures (network, timeout, 401/403, 408, 429, 5xx, missing
 *     credentials) are retried in-session with backoff; other 4xx are fatal
 *     and dropped.
 *
 * Auth is the same as the modal's other GCDR tabs (X-API-Key + X-Tenant-ID,
 * see `resolveApi`). The customer API key carries no user, hence `changedBy`.
 */
import { MyIOToast } from '../../../MyIOToast';
import { resolveApi, type DeviceOpsApiConfig } from '../myio-ops/DeviceOpsTabs';
import type { ChangeAuthor } from '../types';

export const DEVICE_CHANGES_QUEUE_KEY = 'myio:gcdr-device-changes:queue';
export const DEVICE_CHANGE_SOURCE = 'tb-settings-modal';
/** In-session retry delays after the first failed attempt. */
export const DEVICE_CHANGE_RETRY_DELAYS_MS: readonly number[] = [2000, 8000, 30000];
export const DEVICE_CHANGES_MAX_QUEUE = 50;
export const DEVICE_CHANGES_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;

export const LABEL_CHANGE_RETRY_WARNING =
  'Etiqueta salva, mas o registro no histórico falhou — tentaremos de novo';
export const LABEL_CHANGE_FATAL_WARNING = 'Etiqueta salva, mas o registro no histórico falhou.';

export interface DeviceFieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

/** G-2 request body. */
export interface DeviceChangeBody {
  changeId: string;
  source: string;
  changes: DeviceFieldChange[];
  changedBy?: ChangeAuthor;
}

export interface DeviceChangeEntry {
  changeId: string;
  gcdrDeviceId: string;
  tbDeviceId?: string;
  /** Customer/tenant the entry belongs to — only flushed by that customer's dashboard. */
  scope?: string;
  /** ISO 8601 */
  createdAt: string;
  attempts: number;
  lastError?: string;
  body: DeviceChangeBody;
}

export type DeviceChangeOutcome = 'ok' | 'retryable' | 'fatal';

export interface DeviceChangesDeps {
  /** Credentials/roots; unset fields fall back to `window.MyIOOrchestrator` (see `resolveApi`). */
  api?: Omit<DeviceOpsApiConfig, 'gcdrDeviceId'>;
  /** Current customer scope (gcdrCustomerId/tenant) — entries of other scopes are left queued. */
  scope?: string;
  fetchImpl?: typeof fetch;
  /** Default: `localStorage` (null = no persistence, e.g. storage blocked). */
  storage?: Storage | null;
  toast?: { warning: (message: string, duration?: number) => unknown };
  setTimer?: (fn: () => void, ms: number) => unknown;
  now?: () => number;
  logger?: Pick<Console, 'warn' | 'error'>;
}

export interface RecordMessages {
  retry: string;
  fatal: string;
}

/** changeIds currently being sent — avoids parallel duplicates from retry timers + flush. */
const inFlight = new Set<string>();

function newChangeId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function storageOf(deps: DeviceChangesDeps): Storage | null {
  return deps.storage === undefined ? defaultStorage() : deps.storage;
}

// ─── Queue (localStorage) ────────────────────────────────────────────────────

export function readDeviceChangesQueue(storage: Storage | null = defaultStorage()): DeviceChangeEntry[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(DEVICE_CHANGES_QUEUE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((e) => e && typeof e.changeId === 'string' && typeof e.gcdrDeviceId === 'string' && e.body)
      : [];
  } catch {
    return [];
  }
}

function writeQueue(storage: Storage | null, entries: DeviceChangeEntry[]): void {
  if (!storage) return;
  try {
    if (entries.length === 0) storage.removeItem(DEVICE_CHANGES_QUEUE_KEY);
    else storage.setItem(DEVICE_CHANGES_QUEUE_KEY, JSON.stringify(entries));
  } catch {
    // quota / blocked storage — delivery still happens in-session
  }
}

/** Drops entries past the TTL and keeps only the newest `DEVICE_CHANGES_MAX_QUEUE`. */
export function pruneDeviceChangesQueue(entries: DeviceChangeEntry[], now: number): DeviceChangeEntry[] {
  const fresh = entries.filter((e) => {
    const t = Date.parse(e.createdAt);
    return Number.isNaN(t) || now - t <= DEVICE_CHANGES_TTL_MS;
  });
  return fresh.length > DEVICE_CHANGES_MAX_QUEUE ? fresh.slice(fresh.length - DEVICE_CHANGES_MAX_QUEUE) : fresh;
}

function upsertEntry(storage: Storage | null, entry: DeviceChangeEntry, now: number): void {
  const others = readDeviceChangesQueue(storage).filter((e) => e.changeId !== entry.changeId);
  writeQueue(storage, pruneDeviceChangesQueue([...others, entry], now));
}

function removeEntry(storage: Storage | null, changeId: string): void {
  writeQueue(
    storage,
    readDeviceChangesQueue(storage).filter((e) => e.changeId !== changeId)
  );
}

function isQueued(storage: Storage | null, changeId: string): boolean {
  // Without storage there is nothing to compare against — keep retrying in-session.
  return !storage || readDeviceChangesQueue(storage).some((e) => e.changeId === changeId);
}

// ─── Entry + transport ───────────────────────────────────────────────────────

export function buildLabelChangeEntry(input: {
  gcdrDeviceId: string;
  tbDeviceId?: string;
  from: string;
  to: string;
  changedBy?: ChangeAuthor;
  scope?: string;
  now?: () => number;
}): DeviceChangeEntry {
  const changeId = newChangeId();
  return {
    changeId,
    gcdrDeviceId: input.gcdrDeviceId,
    tbDeviceId: input.tbDeviceId,
    scope: input.scope || undefined,
    createdAt: new Date((input.now ?? Date.now)()).toISOString(),
    attempts: 0,
    body: {
      changeId,
      source: DEVICE_CHANGE_SOURCE,
      changes: [{ field: 'label', from: input.from, to: input.to }],
      ...(input.changedBy ? { changedBy: input.changedBy } : {}),
    },
  };
}

/** One POST to G-2, classified. Never throws. */
export async function postDeviceChange(
  entry: DeviceChangeEntry,
  deps: DeviceChangesDeps = {}
): Promise<{ outcome: DeviceChangeOutcome; status?: number; error?: string }> {
  const api = resolveApi({ ...(deps.api || {}), gcdrDeviceId: entry.gcdrDeviceId });
  if (!api.headers['X-API-Key']) return { outcome: 'retryable', error: 'missing gcdrApiKey' };

  const url = `${api.gcdrRoot}/api/v1/devices/${encodeURIComponent(entry.gcdrDeviceId)}/changes`;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { ...api.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(entry.body),
      signal: controller?.signal,
    });
    // 409: this changeId was already recorded — the change is in GCDR.
    if (res.ok || res.status === 409) return { outcome: 'ok', status: res.status };
    const retryable = res.status >= 500 || [401, 403, 408, 429].includes(res.status);
    return { outcome: retryable ? 'retryable' : 'fatal', status: res.status, error: `HTTP ${res.status}` };
  } catch (error) {
    return { outcome: 'retryable', error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function sendEntry(entry: DeviceChangeEntry, deps: DeviceChangesDeps): Promise<DeviceChangeOutcome> {
  const storage = storageOf(deps);
  const now = (deps.now ?? Date.now)();
  inFlight.add(entry.changeId);
  try {
    const result = await postDeviceChange(entry, deps);
    entry.attempts += 1;
    if (result.outcome === 'retryable') {
      entry.lastError = result.error;
      upsertEntry(storage, entry, now);
    } else {
      removeEntry(storage, entry.changeId);
      if (result.outcome === 'fatal') {
        (deps.logger ?? console).error('[DeviceChanges] ED-1413: GCDR rejected the change — dropped', {
          changeId: entry.changeId,
          gcdrDeviceId: entry.gcdrDeviceId,
          status: result.status,
        });
      }
    }
    return result.outcome;
  } finally {
    inFlight.delete(entry.changeId);
  }
}

/**
 * Queues the change, sends it and keeps retrying in the background on
 * retryable failures (same changeId). Resolves with the FIRST attempt's
 * outcome — retries continue after it resolves. Never throws.
 */
export async function recordDeviceChange(
  entry: DeviceChangeEntry,
  deps: DeviceChangesDeps = {},
  messages: RecordMessages = { retry: LABEL_CHANGE_RETRY_WARNING, fatal: LABEL_CHANGE_FATAL_WARNING }
): Promise<DeviceChangeOutcome> {
  const storage = storageOf(deps);
  const toast = deps.toast ?? MyIOToast;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));

  upsertEntry(storage, entry, (deps.now ?? Date.now)());

  const scheduleRetry = (index: number): void => {
    if (index >= DEVICE_CHANGE_RETRY_DELAYS_MS.length) return; // stays queued → next modal open
    setTimer(() => {
      void (async () => {
        if (!isQueued(storage, entry.changeId) || inFlight.has(entry.changeId)) return;
        const outcome = await sendEntry(entry, deps);
        if (outcome === 'retryable') scheduleRetry(index + 1);
      })();
    }, DEVICE_CHANGE_RETRY_DELAYS_MS[index]);
  };

  const outcome = await sendEntry(entry, deps);
  if (outcome === 'retryable') {
    toast.warning(messages.retry, 8000);
    scheduleRetry(0);
  } else if (outcome === 'fatal') {
    toast.warning(messages.fatal, 8000);
  }
  return outcome;
}

/**
 * Re-sends every queued change of the current scope (same changeId). Called
 * when the Settings modal opens. Silent — no toast. Never throws.
 */
export async function flushPendingDeviceChanges(
  deps: DeviceChangesDeps = {}
): Promise<{ sent: number; remaining: number }> {
  const storage = storageOf(deps);
  if (!storage) return { sent: 0, remaining: 0 };

  const pruned = pruneDeviceChangesQueue(readDeviceChangesQueue(storage), (deps.now ?? Date.now)());
  writeQueue(storage, pruned);

  let sent = 0;
  for (const entry of pruned) {
    if (deps.scope && entry.scope && entry.scope !== deps.scope) continue;
    if (inFlight.has(entry.changeId)) continue;
    const outcome = await sendEntry(entry, deps);
    if (outcome === 'ok') sent += 1;
  }
  return { sent, remaining: readDeviceChangesQueue(storage).length };
}
