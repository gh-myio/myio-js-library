/**
 * Realtime drawer pure helpers (RFC-0201 Phase-2 work-list row #28 — pod J).
 *
 * These helpers are extracted from `src/components/RealTimeTelemetryModal.ts`
 * so they can be unit-tested in isolation without spinning up the full
 * modal (with chart libs, jQuery date-range picker, fetch loop, etc.).
 *
 * The fixes mirrored here come from the v-5.2.0 production behaviour and
 * are already wired inside `RealTimeTelemetryModal.ts`. Tests in
 * `tests/components/realtime-drawer/` cover the contracts:
 *
 *   1. `scaleFp`              — FP byte (0–255) ÷ 255 → fraction (0–1).
 *   2. `formatSessionRemaining` — mm:ss countdown formatter.
 *   3. `getDeviceChartTitle`  — dynamic chart title derived from device meta.
 *   4. `getRealtimeStatusIcon` — colour-coded status indicator helper.
 *   5. `toFriendlyError`      — PT-BR mapping for fetch / network errors.
 *
 * Boundaries (RFC-0201 Phase-2 pod J):
 *   - No DOM access here (so they can run in any environment).
 *   - No reliance on `STATE.itemsBase` shape — caller passes a minimal
 *     device-info object.
 *   - No mutation of `AlarmServiceOrchestrator`.
 *
 * @module realtime-drawer/helpers
 */

/**
 * The set of telemetry keys that arrive as a 0–255 raw byte from the firmware
 * and need the ÷255 scaling to be displayed as a 0–1 power-factor fraction.
 *
 * Mirrors `RealTimeTelemetryModal.ts` lines 2296 / 2349 / 2422-2423.
 */
export const FP_TELEMETRY_KEYS = ['fp_a', 'fp_b', 'fp_c', 'powerFactor'] as const;

export type FpTelemetryKey = (typeof FP_TELEMETRY_KEYS)[number];

/**
 * Returns true when the given key is a power-factor reading that the firmware
 * encodes as a 0–255 byte (and therefore requires ÷255 scaling).
 */
export function isFpKey(key: string): key is FpTelemetryKey {
  return (FP_TELEMETRY_KEYS as readonly string[]).includes(key);
}

/**
 * Scale a raw FP byte (0–255) into the 0–1 fraction used by the UI.
 *
 * Examples (also asserted in `tests/components/realtime-drawer/fpScaling.test.ts`):
 *   - `scaleFp(255) === 1`
 *   - `scaleFp(128) ≈ 0.5019…`
 *   - `scaleFp(0)   === 0`
 *
 * If the input is not a finite number we return 0 so the chart never renders
 * NaN spikes.
 */
export function scaleFp(rawValue: unknown): number {
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return 0;
  return n / 255;
}

/**
 * Apply ÷255 scaling **only** when the key is one of the FP keys.
 * Non-FP values pass through unchanged. Use this inside a points.map().
 */
export function applyFpScalingIfNeeded(key: string, value: unknown): number {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  return isFpKey(key) ? safe / 255 : safe;
}

/* -------------------------------------------------------------------------- */
/*  Session countdown formatting                                              */
/* -------------------------------------------------------------------------- */

/**
 * Format the remaining session time as `mm:ss` (zero-padded) for the small
 * pill in the modal footer (`#rtt-session-countdown`).
 *
 * Negative or non-finite inputs collapse to `"0:00"` so the UI never shows
 * `"-1:-3"` after a clock skew or pause.
 */
export function formatSessionRemaining(remainingMs: number): string {
  const ms = Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : 0;
  const totalSeconds = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * True when a session countdown has hit zero. Used to stop polling and to
 * surface the "Sessão expirada — clique para retomar" affordance.
 */
export function isSessionExpired(expiresAtMs: number, now: number = Date.now()): boolean {
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return true;
  return now >= expiresAtMs;
}

/* -------------------------------------------------------------------------- */
/*  Dynamic chart title                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Minimal subset of `BaseItem` that the realtime drawer needs for its chart
 * title. Keeping this loose avoids pulling the full `BaseItem` shape into a
 * test. The drawer caller passes the full BaseItem; we only read what we use.
 */
export interface RealtimeDeviceInfo {
  label?: string;
  labelOrName?: string;
  name?: string;
  identifier?: string;
}

/**
 * Pick the friendliest available human label for a device. Prefer
 * `label`, then `labelOrName`, then `name`, then `identifier`, else
 * the PT-BR fallback `"Dispositivo"`.
 */
export function getDeviceDisplayLabel(device?: RealtimeDeviceInfo | null): string {
  if (!device) return 'Dispositivo';
  return (
    (device.label && device.label.trim()) ||
    (device.labelOrName && device.labelOrName.trim()) ||
    (device.name && device.name.trim()) ||
    (device.identifier && device.identifier.trim()) ||
    'Dispositivo'
  );
}

/**
 * Compose the realtime drawer's chart `<h3>` text from the device label.
 * This mirrors the `updateChartTitle()` logic in `RealTimeTelemetryModal.ts`
 * but expressed as a pure function so we can assert against it.
 */
export function getDeviceChartTitle(device?: RealtimeDeviceInfo | null): string {
  return `Telemetria em Tempo Real — ${getDeviceDisplayLabel(device)}`;
}

/* -------------------------------------------------------------------------- */
/*  Status icon next to the numeric realtime value                            */
/* -------------------------------------------------------------------------- */

/**
 * Normalised status bucket used for the small adjacent-to-value dot.
 * Maps from the project's `DeviceStatusType` plus the connection-status
 * shorthands used inside the drawer (`ok` / `weak` / `offline`).
 */
export type RealtimeStatusBucket = 'online' | 'weak' | 'offline' | 'unknown';

const ONLINE_STATUS = new Set([
  'power_on',
  'online',
  'normal',
  'ok',
  'running',
  'active',
]);
const OFFLINE_STATUS = new Set(['offline', 'no_info']);
const WEAK_STATUS = new Set(['weak_connection', 'conexao_fraca', 'bad', 'weak']);

/**
 * Map any device-status string to one of the four buckets the dot uses.
 * Falls back to `'unknown'` so unknown strings do not render as `online`
 * (which would be misleading).
 */
export function bucketStatus(deviceStatus?: string | null): RealtimeStatusBucket {
  if (!deviceStatus) return 'unknown';
  const k = String(deviceStatus).toLowerCase().trim();
  if (ONLINE_STATUS.has(k)) return 'online';
  if (OFFLINE_STATUS.has(k)) return 'offline';
  if (WEAK_STATUS.has(k)) return 'weak';
  return 'unknown';
}

/**
 * Map a status bucket to the CSS class used for the colour dot adjacent to
 * the numeric realtime value. Tests assert the class is present in the DOM.
 */
export function statusDotClass(bucket: RealtimeStatusBucket): string {
  switch (bucket) {
    case 'online':
      return 'rtt-status-dot rtt-status-dot--online';
    case 'weak':
      return 'rtt-status-dot rtt-status-dot--weak';
    case 'offline':
      return 'rtt-status-dot rtt-status-dot--offline';
    default:
      return 'rtt-status-dot rtt-status-dot--unknown';
  }
}

/**
 * Pick the icon emoji + colour for the dot in one helper. Kept separate from
 * `statusDotClass` so a Shadow-DOM consumer can use one without the other.
 */
export function getRealtimeStatusIcon(deviceStatus?: string | null): {
  bucket: RealtimeStatusBucket;
  className: string;
  ariaLabel: string;
} {
  const bucket = bucketStatus(deviceStatus);
  const className = statusDotClass(bucket);
  const ariaLabel = (() => {
    switch (bucket) {
      case 'online':
        return 'Dispositivo online';
      case 'weak':
        return 'Conexão fraca';
      case 'offline':
        return 'Dispositivo offline';
      default:
        return 'Status desconhecido';
    }
  })();
  return { bucket, className, ariaLabel };
}

/* -------------------------------------------------------------------------- */
/*  Friendly errors                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Default PT-BR fallback for any otherwise-unrecognised realtime fetch error.
 *
 * Tests assert this exact string never includes the word "Error" (raw stack
 * trace leak) and that it is in PT-BR.
 */
export const REALTIME_DEFAULT_FRIENDLY_ERROR =
  'Não foi possível carregar dados em tempo real. Tente novamente.';

/**
 * Map a thrown value (Error, string, anything) into a user-safe PT-BR message.
 * Preserves the original error in the console for debugging via `console.error`
 * but never returns the raw `error.message` (which may include status codes,
 * URLs, or stack-trace fragments).
 */
export function toFriendlyError(err: unknown): string {
  // Always log the technical detail for debugging
  // eslint-disable-next-line no-console
  console.error('[RealTimeTelemetry] Error:', err);

  const raw =
    err instanceof Error
      ? err.message ?? ''
      : typeof err === 'string'
        ? err
        : '';
  const lc = raw.toLowerCase();

  if (/token.*expired|authentication token|token_expired|jwt expired/.test(lc)) {
    return 'Sessão expirada. Recarregue a página para continuar.';
  }
  if (/401|403|unauthorized|forbidden|insufficient permissions/.test(lc)) {
    return 'Sem permissão para acessar este dispositivo.';
  }
  if (/404|not found|device not found/.test(lc)) {
    return 'Dispositivo não encontrado. Verifique a integração ou contate o suporte.';
  }
  if (/failed to fetch|network|networkerror|timeout|timed out/.test(lc)) {
    return 'Falha de rede. Verifique sua conexão e tente novamente.';
  }
  return REALTIME_DEFAULT_FRIENDLY_ERROR;
}
