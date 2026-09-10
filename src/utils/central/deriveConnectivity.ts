/**
 * Central connectivity derivation — RFC-0231 §0 (Central Status Card).
 *
 * Pure, DOM-independent read-side rule shared by the GCDR orchestrator-devices
 * cockpit, the customer centrals list, and this library's Central Status card,
 * so the "is this gateway reachable" grace-window logic is defined once instead
 * of drifting across three implementations. It reproduces the worker's
 * write-side `centralVerdict` from stored timestamps, with one deliberate
 * divergence: a central with no success baseline is `UNKNOWN`, never `OFFLINE`,
 * regardless of `monitoringEnabled` or a persisted `canonicalStatus`.
 */

export type CentralConnectivity = 'ONLINE' | 'OFFLINE' | 'WARNING' | 'UNKNOWN';

export interface CentralConnectivityEvidence {
  monitoringEnabled: boolean;
  /** last_gateway_check_at (ISO) — last ATTEMPT. */
  lastCheckAt?: string | null;
  /** last_gateway_success_check_at (ISO) — last SUCCESS (the baseline). */
  lastSuccessAt?: string | null;
  /** OK|TIMEOUT|CONN_REFUSED|HTTP_5XX|PARSE_FAIL|AUTH_ERROR|CONFIG_ERROR|null */
  probeResult?: string | null;
  /**
   * connection_status — display hint only. Intentionally never read by
   * deriveCentralConnectivity: it must never promote a central to OFFLINE
   * in the absence of a success baseline (see module doc). Callers may use
   * it to seed a badge before evidence loads.
   */
  canonicalStatus?: string | null;
}

export interface DeriveConnectivityOptions {
  /** Grace threshold (ms) — never hard-coded in the helper. */
  offlineGraceMs: number;
  /**
   * v2. A failure shorter than this is tolerated as a "blip" — connectivity
   * stays ONLINE instead of dropping to WARNING. Default 0 (no tolerance,
   * i.e. any failing last attempt immediately reads WARNING at minimum —
   * identical to v1 behavior when omitted).
   */
  blipToleranceMs?: number;
  /**
   * v2. Once a failure (past grace, so already OFFLINE) has lasted this
   * long, `reason` becomes 'OFFLINE_HARD' (connectivity stays 'OFFLINE' —
   * this is a sub-classification, not a 5th top-level state, so existing
   * exhaustive switches over CentralConnectivity keep working unmodified).
   * Default: unset — no hard tier, `reason` stays 'PAST_GRACE' forever
   * (identical to v1 behavior when omitted). Ignored if <= offlineGraceMs.
   */
  offlineHardMs?: number;
  /** Injectable clock; used ONLY for staleness + "since last sync" display. */
  nowMs?: number;
}

export interface CentralConnectivityResult {
  connectivity: CentralConnectivity;
  /** Derived while monitoring is OFF (data no longer refreshed) → show a "stale" badge. */
  stale: boolean;
  /** Genuine down AND no success within grace (measured relative to lastCheckAt). */
  pastGrace: boolean;
  /**
   * v2. True only when `pastGrace` is also true AND the failure has lasted
   * past `offlineHardMs` — i.e. it can never be true while connectivity is
   * anything but 'OFFLINE', even if the caller misconfigures
   * offlineHardMs <= offlineGraceMs.
   */
  pastHard: boolean;
  /** For the "último sync há X" line; null when never synced. Also doubles
   *  as the outage duration when connectivity is 'OFFLINE'. */
  sinceSuccessMs: number | null;
  reason:
    | 'NEVER_SYNCED'
    | 'OK'
    | 'BLIP_TOLERATED'
    | 'WITHIN_GRACE'
    | 'PAST_GRACE'
    | 'OFFLINE_HARD'
    | 'MONITORING_OFF_STALE';
}

export function deriveCentralConnectivity(
  ev: CentralConnectivityEvidence,
  opts: DeriveConnectivityOptions
): CentralConnectivityResult {
  const nowMs = opts.nowMs ?? Date.now();
  const lastSuccessMs = ev.lastSuccessAt ? Date.parse(ev.lastSuccessAt) : null;
  const lastCheckMs = ev.lastCheckAt ? Date.parse(ev.lastCheckAt) : null;

  // No success baseline → UNKNOWN, regardless of monitoringEnabled, probeResult,
  // or a persisted canonicalStatus === 'OFFLINE'. A central never reached is
  // "not yet known", not "confirmed down".
  if (lastSuccessMs == null) {
    return {
      connectivity: 'UNKNOWN',
      stale: false,
      pastGrace: false,
      pastHard: false,
      sinceSuccessMs: null,
      reason: 'NEVER_SYNCED',
    };
  }

  const sinceSuccessMs = nowMs - lastSuccessMs;

  // Verdict computed relative to lastCheckAt (the last observation), not the
  // live clock, so it reproduces exactly what the worker stored at check time
  // and does not drift as wall-clock passes. Absent lastCheckAt means no
  // evidence of a later failed attempt, so it reads as "last attempt was the
  // success".
  const lastAttemptWasSuccess =
    ev.probeResult === 'OK' || lastCheckMs == null || lastCheckMs <= lastSuccessMs;

  let connectivity: CentralConnectivity;
  let pastGrace: boolean;
  let pastHard: boolean;
  let reason: CentralConnectivityResult['reason'];

  if (lastAttemptWasSuccess) {
    connectivity = 'ONLINE';
    pastGrace = false;
    pastHard = false;
    reason = 'OK';
  } else {
    const sinceLastAttemptFailure = (lastCheckMs as number) - lastSuccessMs;
    const blipToleranceMs = opts.blipToleranceMs ?? 0;

    if (sinceLastAttemptFailure < blipToleranceMs) {
      // Tolerated blip — too short to count as a real drop, still reads ONLINE.
      connectivity = 'ONLINE';
      pastGrace = false;
      pastHard = false;
      reason = 'BLIP_TOLERATED';
    } else {
      pastGrace = sinceLastAttemptFailure >= opts.offlineGraceMs;
      pastHard =
        pastGrace && opts.offlineHardMs != null && sinceLastAttemptFailure >= opts.offlineHardMs;
      connectivity = pastGrace ? 'OFFLINE' : 'WARNING';
      reason = pastHard ? 'OFFLINE_HARD' : pastGrace ? 'PAST_GRACE' : 'WITHIN_GRACE';
    }
  }

  // Monitoring OFF with a success baseline → keep the last-known connectivity
  // from the rule above (frozen, anchored to lastCheckAt) but flag it stale —
  // it does not drift to OFFLINE merely because time passed.
  if (!ev.monitoringEnabled) {
    return {
      connectivity,
      stale: true,
      pastGrace,
      pastHard,
      sinceSuccessMs,
      reason: 'MONITORING_OFF_STALE',
    };
  }

  return { connectivity, stale: false, pastGrace, pastHard, sinceSuccessMs, reason };
}
