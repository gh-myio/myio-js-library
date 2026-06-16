/**
 * RFC-0167 — On/Off device status freshness rule
 *
 * ============================================================================
 *   ⏱️  DEVICE STATUS FRESHNESS WINDOW  ⏱️
 * ============================================================================
 *
 *   A telemetry reading is only TRUSTED while it is "fresh" — i.e. while its
 *   timestamp is within this window. Past it, the device may have gone silent,
 *   so we keep showing the LAST known value but flag it as stale (warning icon
 *   + tooltip) instead of pretending it is live.
 *
 *   The window is applied INDEPENDENTLY to two telemetry keys:
 *
 *     • `connectionStatus` → decides whether the device is really ONLINE.
 *         connectionStatus === 'online' AND fresh  ⇒  online.
 *
 *     • `status`           → decides the ON / OFF value.
 *         fresh  ⇒  value (on|off) is live and interactive.
 *         stale  ⇒  value is shown as the LAST known state + warning tooltip.
 *
 *   Tune the whole rule from this single constant.
 * ============================================================================
 */
export const STATUS_FRESHNESS_MAX_HOURS = 12;

/** Same window expressed in milliseconds (derived — do not edit directly). */
export const STATUS_FRESHNESS_MAX_MS = STATUS_FRESHNESS_MAX_HOURS * 60 * 60 * 1000;

export interface DeviceStatusInput {
  /** Raw connectionStatus telemetry value, e.g. 'online' | 'offline'. */
  connectionStatus?: string | null;
  /** Epoch ms of the connectionStatus reading. */
  connectionStatusTs?: number | null;
  /** Raw status telemetry value (on/off in any encoding). */
  statusValue?: string | number | boolean | null;
  /** Epoch ms of the status reading. */
  statusTs?: number | null;
  /** Solenoid semantics: status 'on' means valve CLOSED (inverted). */
  invertLogic?: boolean;
}

export interface DeviceStatusResult {
  /** connectionStatus === 'online' and fresh (or no ts available → trusted). */
  isOnline: boolean;
  /** connectionStatus says online but its ts is older than the window. */
  connectionStale: boolean;
  /** Normalized on/off derived from the status telemetry (null if unknown). */
  value: 'on' | 'off' | null;
  /** We HAVE a status ts and it is older than the window → show last + warning. */
  statusStale: boolean;
  /** Epoch ms of the status reading (echoed for the warning tooltip). */
  statusTs: number | null;
}

/**
 * A timestamp is fresh when it is within STATUS_FRESHNESS_MAX_MS of `nowMs`.
 * A missing/invalid ts is treated as NOT-stale (we cannot assert staleness),
 * so the rule degrades gracefully and never regresses callers without ts.
 */
export function isFresh(ts: number | null | undefined, nowMs: number): boolean {
  if (ts == null || !isFinite(ts as number) || (ts as number) <= 0) return false;
  return nowMs - (ts as number) <= STATUS_FRESHNESS_MAX_MS;
}

/** Whether we have a usable timestamp at all. */
export function hasTs(ts: number | null | undefined): boolean {
  return ts != null && isFinite(ts as number) && (ts as number) > 0;
}

const ON_TOKENS = new Set(['on', '1', 'true', 'ligado', 'ligada', 'aceso', 'acesa', 'aberta', 'aberto', 'ativado']);
const OFF_TOKENS = new Set(['off', '0', 'false', 'desligado', 'desligada', 'apagado', 'apagada', 'fechada', 'fechado', 'desativado']);

/** Normalize any on/off encoding (string/number/boolean) into 'on' | 'off' | null. */
export function normalizeOnOff(
  value: string | number | boolean | null | undefined,
  invertLogic = false
): 'on' | 'off' | null {
  let result: 'on' | 'off' | null = null;
  if (value === null || value === undefined || value === '') {
    result = null;
  } else if (typeof value === 'boolean') {
    result = value ? 'on' : 'off';
  } else if (typeof value === 'number') {
    result = value ? 'on' : 'off';
  } else {
    const v = String(value).trim().toLowerCase();
    if (ON_TOKENS.has(v)) result = 'on';
    else if (OFF_TOKENS.has(v)) result = 'off';
  }
  if (result && invertLogic) result = result === 'on' ? 'off' : 'on';
  return result;
}

/**
 * Apply the freshness rule to a device's connection + status telemetry.
 * @param input  telemetry values + their timestamps
 * @param nowMs  current epoch ms (defaults to Date.now(); injectable for tests)
 */
export function evaluateDeviceStatus(
  input: DeviceStatusInput,
  nowMs: number = Date.now()
): DeviceStatusResult {
  const conn = (input.connectionStatus || '').toString().trim().toLowerCase();
  const connOnline = conn === 'online';
  // No connection ts ⇒ trust the flag (don't regress); with ts ⇒ require freshness.
  const connFresh = hasTs(input.connectionStatusTs) ? isFresh(input.connectionStatusTs, nowMs) : true;

  const value = normalizeOnOff(input.statusValue, input.invertLogic);
  // Stale only when we actually HAVE a status ts that is past the window.
  const statusStale = value != null && hasTs(input.statusTs) && !isFresh(input.statusTs, nowMs);

  return {
    isOnline: connOnline && connFresh,
    connectionStale: connOnline && hasTs(input.connectionStatusTs) && !connFresh,
    value,
    statusStale,
    statusTs: hasTs(input.statusTs) ? (input.statusTs as number) : null,
  };
}

/** Human-friendly timestamp for the stale-status warning tooltip. */
export function formatStatusTimestamp(ts: number | null | undefined, locale = 'pt-BR'): string {
  if (!hasTs(ts)) return '—';
  try {
    return new Date(ts as number).toLocaleString(locale);
  } catch {
    return new Date(ts as number).toISOString();
  }
}
