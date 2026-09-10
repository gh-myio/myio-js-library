/**
 * RFC-0231 §0 — deriveCentralConnectivity (pure, DOM-free grace-window rule).
 */
import { describe, it, expect } from 'vitest';
import { deriveCentralConnectivity } from '../../../src/utils/central/deriveConnectivity';

const GRACE = 10 * 60 * 1000; // 10 min, arbitrary — never hard-coded in the helper
const T0 = Date.parse('2026-09-02T12:00:00.000Z');

const FAILING_PROBE_RESULTS = [
  'TIMEOUT',
  'CONN_REFUSED',
  'HTTP_5XX',
  'PARSE_FAIL',
  'AUTH_ERROR',
  'CONFIG_ERROR',
];

describe('deriveCentralConnectivity — no success baseline', () => {
  it('never monitored + never probed → UNKNOWN (NEVER_SYNCED)', () => {
    const r = deriveCentralConnectivity(
      { monitoringEnabled: false },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r).toEqual({
      connectivity: 'UNKNOWN',
      stale: false,
      pastGrace: false,
      pastHard: false,
      sinceSuccessMs: null,
      reason: 'NEVER_SYNCED',
    });
  });

  it('monitoring ON, probeResult set, but no success baseline → still UNKNOWN', () => {
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult: 'TIMEOUT', lastCheckAt: '2026-09-02T11:59:00.000Z' },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('UNKNOWN');
    expect(r.reason).toBe('NEVER_SYNCED');
  });

  // Deliberate divergence, locked 2026-09-02 (GCDR review): a persisted
  // canonicalStatus === 'OFFLINE' must NOT promote a never-synced central to
  // OFFLINE — this is exactly what stops the false-OFFLINE storm on
  // freshly-imported gateways. canonicalStatus is a display hint only.
  it('canonicalStatus === "OFFLINE" with no success baseline never promotes to OFFLINE', () => {
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, canonicalStatus: 'OFFLINE' },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('UNKNOWN');
    expect(r.reason).toBe('NEVER_SYNCED');
  });
});

describe('deriveCentralConnectivity — has success baseline, monitoring ON', () => {
  it('probeResult === "OK" → ONLINE', () => {
    const r = deriveCentralConnectivity(
      {
        monitoringEnabled: true,
        probeResult: 'OK',
        lastCheckAt: '2026-09-02T11:59:00.000Z',
        lastSuccessAt: '2026-09-02T11:59:00.000Z',
      },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('ONLINE');
    expect(r.reason).toBe('OK');
    expect(r.pastGrace).toBe(false);
    expect(r.stale).toBe(false);
  });

  it('lastCheckAt absent (no evidence of a later failed attempt) → ONLINE', () => {
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, lastSuccessAt: '2026-09-02T11:59:00.000Z' },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('ONLINE');
    expect(r.reason).toBe('OK');
  });

  it.each(FAILING_PROBE_RESULTS)('%s within grace since last success → WARNING', (probeResult) => {
    const lastSuccessAt = new Date(T0 - 2 * 60 * 1000).toISOString(); // 2min ago
    const lastCheckAt = new Date(T0).toISOString(); // failing attempt now: 2min since success, < 10min grace
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult, lastCheckAt, lastSuccessAt },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('WARNING');
    expect(r.reason).toBe('WITHIN_GRACE');
    expect(r.pastGrace).toBe(false);
  });

  it.each(FAILING_PROBE_RESULTS)('%s past grace since last success → OFFLINE', (probeResult) => {
    const lastSuccessAt = new Date(T0 - 20 * 60 * 1000).toISOString(); // 20min ago
    const lastCheckAt = new Date(T0).toISOString(); // 20min since success, > 10min grace
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult, lastCheckAt, lastSuccessAt },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('OFFLINE');
    expect(r.reason).toBe('PAST_GRACE');
    expect(r.pastGrace).toBe(true);
  });

  it('exact grace-boundary equality (sinceLastAttemptFailure === offlineGraceMs) → OFFLINE', () => {
    const lastSuccessAt = new Date(T0 - GRACE).toISOString();
    const lastCheckAt = new Date(T0).toISOString();
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult: 'TIMEOUT', lastCheckAt, lastSuccessAt },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('OFFLINE');
    expect(r.pastGrace).toBe(true);
  });

  it('sinceSuccessMs is nowMs − lastSuccessAt (display value, independent of the verdict)', () => {
    const lastSuccessAt = new Date(T0 - 5 * 60 * 1000).toISOString();
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult: 'OK', lastCheckAt: lastSuccessAt, lastSuccessAt },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.sinceSuccessMs).toBe(5 * 60 * 1000);
  });
});

describe('deriveCentralConnectivity — monitoring OFF, has success baseline', () => {
  it('keeps last-known ONLINE + stale:true, reason MONITORING_OFF_STALE', () => {
    const lastSuccessAt = new Date(T0 - 60 * 1000).toISOString();
    const r = deriveCentralConnectivity(
      { monitoringEnabled: false, probeResult: 'OK', lastCheckAt: lastSuccessAt, lastSuccessAt },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('ONLINE');
    expect(r.stale).toBe(true);
    expect(r.reason).toBe('MONITORING_OFF_STALE');
  });

  it('keeps last-known OFFLINE + stale:true when frozen state was already past grace', () => {
    const lastSuccessAt = new Date(T0 - 30 * 60 * 1000).toISOString();
    const lastCheckAt = new Date(T0 - 20 * 60 * 1000).toISOString(); // 10min since success at check time
    const r = deriveCentralConnectivity(
      { monitoringEnabled: false, probeResult: 'TIMEOUT', lastCheckAt, lastSuccessAt },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('OFFLINE');
    expect(r.stale).toBe(true);
    expect(r.pastGrace).toBe(true);
    expect(r.reason).toBe('MONITORING_OFF_STALE');
  });

  it('does not drift to OFFLINE merely because wall-clock time passed (anchored to lastCheckAt)', () => {
    const lastSuccessAt = new Date(T0 - 60 * 1000).toISOString();
    const farFuture = T0 + 365 * 24 * 60 * 60 * 1000; // 1 year later
    const r = deriveCentralConnectivity(
      { monitoringEnabled: false, probeResult: 'OK', lastCheckAt: lastSuccessAt, lastSuccessAt },
      { offlineGraceMs: GRACE, nowMs: farFuture }
    );
    expect(r.connectivity).toBe('ONLINE');
    expect(r.reason).toBe('MONITORING_OFF_STALE');
    // sinceSuccessMs uses the live clock (display-only) — it's expected to grow;
    // the verdict itself (connectivity/reason) must not.
    expect(r.sinceSuccessMs).toBe(farFuture - Date.parse(lastSuccessAt));
  });

  it('monitoring OFF with no success baseline is still NEVER_SYNCED, not MONITORING_OFF_STALE', () => {
    const r = deriveCentralConnectivity(
      { monitoringEnabled: false },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('UNKNOWN');
    expect(r.reason).toBe('NEVER_SYNCED');
    expect(r.stale).toBe(false);
  });
});

describe('deriveCentralConnectivity — v2: blipToleranceMs', () => {
  it('omitted (default 0) → any failing attempt reads WARNING at minimum, identical to v1', () => {
    const lastSuccessAt = new Date(T0 - 1000).toISOString(); // 1s ago — would be a "blip" if tolerated
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult: 'TIMEOUT', lastCheckAt: new Date(T0).toISOString(), lastSuccessAt },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('WARNING');
    expect(r.reason).toBe('WITHIN_GRACE');
  });

  it('failure shorter than blipToleranceMs → tolerated, stays ONLINE (BLIP_TOLERATED)', () => {
    const lastSuccessAt = new Date(T0 - 1000).toISOString(); // 1s ago
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult: 'TIMEOUT', lastCheckAt: new Date(T0).toISOString(), lastSuccessAt },
      { offlineGraceMs: GRACE, blipToleranceMs: 5000, nowMs: T0 }
    );
    expect(r.connectivity).toBe('ONLINE');
    expect(r.reason).toBe('BLIP_TOLERATED');
    expect(r.pastGrace).toBe(false);
    expect(r.pastHard).toBe(false);
  });

  it('failure at/past blipToleranceMs → normal WARNING/OFFLINE rule applies', () => {
    const lastSuccessAt = new Date(T0 - 5000).toISOString(); // exactly 5s ago
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult: 'TIMEOUT', lastCheckAt: new Date(T0).toISOString(), lastSuccessAt },
      { offlineGraceMs: GRACE, blipToleranceMs: 5000, nowMs: T0 }
    );
    expect(r.connectivity).toBe('WARNING');
    expect(r.reason).toBe('WITHIN_GRACE');
  });
});

describe('deriveCentralConnectivity — v2: offlineHardMs', () => {
  const HARD = 2.5 * 60 * 60 * 1000; // 2h30min

  it('omitted → OFFLINE never escalates to OFFLINE_HARD, identical to v1', () => {
    const lastSuccessAt = new Date(T0 - 24 * 60 * 60 * 1000).toISOString(); // 24h ago, way past any reasonable hard tier
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult: 'TIMEOUT', lastCheckAt: new Date(T0).toISOString(), lastSuccessAt },
      { offlineGraceMs: GRACE, nowMs: T0 }
    );
    expect(r.connectivity).toBe('OFFLINE');
    expect(r.reason).toBe('PAST_GRACE');
    expect(r.pastHard).toBe(false);
  });

  it('past grace but before offlineHardMs → OFFLINE / PAST_GRACE, pastHard false', () => {
    const lastSuccessAt = new Date(T0 - 30 * 60 * 1000).toISOString(); // 30min ago: past 10min grace, before 2h30 hard
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult: 'TIMEOUT', lastCheckAt: new Date(T0).toISOString(), lastSuccessAt },
      { offlineGraceMs: GRACE, offlineHardMs: HARD, nowMs: T0 }
    );
    expect(r.connectivity).toBe('OFFLINE');
    expect(r.reason).toBe('PAST_GRACE');
    expect(r.pastHard).toBe(false);
  });

  it('past offlineHardMs → OFFLINE / OFFLINE_HARD, pastHard true, sinceSuccessMs is the outage duration', () => {
    const lastSuccessAt = new Date(T0 - HARD).toISOString(); // exactly at the hard boundary
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult: 'TIMEOUT', lastCheckAt: new Date(T0).toISOString(), lastSuccessAt },
      { offlineGraceMs: GRACE, offlineHardMs: HARD, nowMs: T0 }
    );
    expect(r.connectivity).toBe('OFFLINE');
    expect(r.reason).toBe('OFFLINE_HARD');
    expect(r.pastHard).toBe(true);
    expect(r.sinceSuccessMs).toBe(HARD);
  });

  it('misconfigured offlineHardMs <= offlineGraceMs never fires while still WARNING (pastHard implies pastGrace)', () => {
    const lastSuccessAt = new Date(T0 - 2 * 60 * 1000).toISOString(); // 2min: within 10min grace
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult: 'TIMEOUT', lastCheckAt: new Date(T0).toISOString(), lastSuccessAt },
      { offlineGraceMs: GRACE, offlineHardMs: 60 * 1000 /* 1min — nonsensically lower than grace */, nowMs: T0 }
    );
    expect(r.connectivity).toBe('WARNING');
    expect(r.pastHard).toBe(false); // guarded: never true unless connectivity === 'OFFLINE'
  });

  it('monitoring-off frozen OFFLINE_HARD state keeps pastHard through MONITORING_OFF_STALE', () => {
    const lastSuccessAt = new Date(T0 - HARD - 60 * 1000).toISOString();
    const lastCheckAt = new Date(T0 - 60 * 1000).toISOString();
    const r = deriveCentralConnectivity(
      { monitoringEnabled: false, probeResult: 'TIMEOUT', lastCheckAt, lastSuccessAt },
      { offlineGraceMs: GRACE, offlineHardMs: HARD, nowMs: T0 }
    );
    expect(r.connectivity).toBe('OFFLINE');
    expect(r.stale).toBe(true);
    expect(r.pastHard).toBe(true);
    expect(r.reason).toBe('MONITORING_OFF_STALE'); // stale wins the reason label, pastHard still exposed as a flag
  });
});

describe('deriveCentralConnectivity — nowMs default', () => {
  it('falls back to Date.now() when nowMs is omitted', () => {
    const lastSuccessAt = new Date(Date.now() - 1000).toISOString();
    const r = deriveCentralConnectivity(
      { monitoringEnabled: true, probeResult: 'OK', lastCheckAt: lastSuccessAt, lastSuccessAt },
      { offlineGraceMs: GRACE }
    );
    expect(r.sinceSuccessMs).toBeGreaterThanOrEqual(1000);
    expect(r.sinceSuccessMs).toBeLessThan(5000);
  });
});
