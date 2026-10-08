import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  TELEMETRY_CATALOG,
  bucketCount,
  presetRange,
  spEpoch,
  periodErrors,
  finestFittingResolution,
  parseLocalDateTime,
  toLocalDateTimeInput,
  canonicalJson,
  requestHash,
  buildRequest,
  buildEnvelope,
  toSubmitCommand,
  parseEnvelope,
  uuidv7,
  deriveJobView,
  mergeBatch,
  reconciliationEvents,
  needsPolling,
  isUncertainStatus,
  type DemandDevice,
  type JobKnowledge,
} from '../../../../src/utils/reports/demand';

const sha256 = async (b: Uint8Array) => new Uint8Array(createHash('sha256').update(b).digest());
const dev = (n: number, extra: Partial<DemandDevice> = {}): DemandDevice => ({
  tbDeviceId: `tb-${n}`,
  gcdrDeviceId: `gcdr-${n}`,
  ingestionId: `ing-${n}`,
  label: `Medidor ${n}`,
  name: `3F MED ${n}`,
  identifier: `LUC ${n}`,
  deviceProfile: '3F_MEDIDOR',
  group: 'lojas',
  ...extra,
});
const USER = { tbUserId: 'tb-user-1', name: 'Rodrigo Lago' };
const CUSTOMER = { tbCustomerId: 'tb-c', gcdrCustomerId: 'gcdr-c', name: 'Shopping' };

describe('RFC-0238 catalogue', () => {
  it('has the 14 keys of the live modal', () => {
    expect(TELEMETRY_CATALOG.map((t) => t.key)).toEqual([
      'consumption', 'a', 'b', 'c', 'voltage_a', 'voltage_b', 'voltage_c',
      'current_a', 'current_b', 'current_c', 'total_current', 'fp_a', 'fp_b', 'fp_c',
    ]);
  });
});

describe('RFC-0238 period and buckets', () => {
  it('counts grid buckets with partial edges', () => {
    // 10:07 → 11:07 at 15 min intersects 10:00, 10:15, 10:30, 10:45, 11:00
    expect(bucketCount(spEpoch(2026, 9, 5, 10, 7), spEpoch(2026, 9, 5, 11, 7), '15m')).toBe(5);
    // 23:00 → 01:00 crosses local midnight: 2 daily buckets
    expect(bucketCount(spEpoch(2026, 9, 1, 23), spEpoch(2026, 9, 2, 1), '1d')).toBe(2);
    // exact days
    const lastWeek = presetRange('last7days', spEpoch(2026, 9, 8, 14, 30))!;
    expect(bucketCount(lastWeek.start, lastWeek.end, '15m')).toBe(672);
    expect(bucketCount(lastWeek.start, lastWeek.end, '1d')).toBe(7);
    expect(bucketCount(10, 10, '1h')).toBe(0);
  });

  it('resolves presets against one snapshot, half-open', () => {
    const now = spEpoch(2026, 9, 8, 14, 30);
    expect(presetRange('last7days', now)).toEqual({ start: spEpoch(2026, 9, 1), end: spEpoch(2026, 9, 8) });
    expect(presetRange('today', now)).toEqual({ start: spEpoch(2026, 9, 8), end: now });
    expect(presetRange('custom', now)).toBeNull();
  });

  it('handles month boundaries and leap years', () => {
    expect(presetRange('lastMonth', spEpoch(2026, 2, 1, 9))).toEqual({ start: spEpoch(2026, 1, 1), end: spEpoch(2026, 2, 1) });
    expect(presetRange('lastMonth', spEpoch(2026, 0, 31, 9))).toEqual({ start: spEpoch(2025, 11, 1), end: spEpoch(2026, 0, 1) });
    const feb2028 = presetRange('lastMonth', spEpoch(2028, 2, 15))!;
    expect((feb2028.end - feb2028.start) / 86_400_000).toBe(29);
    expect(presetRange('thisMonth', spEpoch(2028, 1, 29, 12))!.start).toBe(spEpoch(2028, 1, 1));
  });

  it('"today" at 00:30 local (03:30Z) is still the local day', () => {
    const now = Date.UTC(2026, 9, 8, 3, 30);
    expect(presetRange('today', now)!.start).toBe(Date.UTC(2026, 9, 8, 3, 0));
  });

  it('round-trips datetime-local values in São Paulo time', () => {
    const ms = parseLocalDateTime('2026-10-05T10:07');
    expect(new Date(ms).toISOString()).toBe('2026-10-05T13:07:00.000Z');
    expect(toLocalDateTimeInput(ms)).toBe('2026-10-05T10:07');
    expect(parseLocalDateTime('bad')).toBeNaN();
  });

  it('validates limits per grouping interval / Bruto and suggests the finest fitting interval', () => {
    const now = spEpoch(2026, 9, 8);
    const month = presetRange('lastMonth', now)!;
    expect(periodErrors(month, '15m', now)).toEqual([]);
    expect(finestFittingResolution(month)).toBe('15m');
    const fortyDays = { start: spEpoch(2026, 7, 20), end: spEpoch(2026, 8, 29) };
    expect(periodErrors(fortyDays, '15m', now)[0]).toMatch(/agrupamento de 15 min, o período máximo é 31 dia/);
    expect(periodErrors(fortyDays, '30m', now)).toEqual([]);
    expect(finestFittingResolution(fortyDays)).toBe('30m');
    expect(periodErrors(fortyDays, null, now)[0]).toMatch(/dados brutos, o período máximo é 31 dia/);
    expect(periodErrors({ start: spEpoch(2019, 0, 1), end: spEpoch(2019, 0, 2) }, '1h', now)[0]).toMatch(/2019/);
    expect(periodErrors({ start: now, end: now - 1 }, '1h', now)).toEqual(['O fim precisa ser depois do início.']);
  });
});

describe('RFC-0238 request hash', () => {
  const req = buildRequest({
    devices: [dev(2), dev(1)],
    range: { start: spEpoch(2026, 9, 1), end: spEpoch(2026, 9, 8) },
    preset: 'last7days',
    resolution: '15m',
    telemetryKeys: ['voltage_a', 'consumption'],
  });

  it('canonical JSON sorts keys recursively', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: 'x' } })).toBe('{"a":{"c":"x","d":[2,1]},"b":1}');
  });

  it('matches the published test vector', async () => {
    // projection: devices [gcdr-1, gcdr-2], period 2026-10-01T03:00Z → 2026-10-08T03:00Z, MAX · 15m (gaps filled),
    // [consumption, voltage_a], catalog 1
    expect(await requestHash(req, 1, sha256)).toBe('sha256:' + createHash('sha256').update(
      '{"aggregation":"MAX","catalogVersion":1,"devices":["gcdr-1","gcdr-2"],"fillGaps":true,"period":{"end":"2026-10-08T03:00:00.000Z","start":"2026-10-01T03:00:00.000Z","timezone":"America/Sao_Paulo"},"resolution":"15m","telemetries":["consumption","voltage_a"],"type":"demand-report"}'
    ).digest('hex'));
  });

  it('ignores labels/names/order but not the catalogue version', async () => {
    const renamed = { ...req, devices: [...req.devices].reverse().map((d) => ({ ...d, label: 'x', name: 'y' })) };
    expect(await requestHash(renamed, 1, sha256)).toBe(await requestHash(req, 1, sha256));
    expect(await requestHash(req, 2, sha256)).not.toBe(await requestHash(req, 1, sha256));
  });

  it('keeps telemetries in catalogue order in the request', () => {
    expect(req.telemetries.map((t) => t.key)).toEqual(['consumption', 'voltage_a']);
    expect(req.estimate).toEqual({ buckets: 672, points: 672 * 2 * 2 });
    expect(req).toMatchObject({ aggregation: 'MAX', resolution: '15m', fillGaps: true });
  });

  it('Bruto (NONE): every sample — no interval, no point limit, no gap filling, no estimate — and a different hash', async () => {
    const raw = buildRequest({
      devices: [dev(1)],
      range: { start: spEpoch(2026, 9, 1), end: spEpoch(2026, 9, 8) },
      preset: 'last7days',
      aggregation: 'NONE',
      resolution: '15m',
      telemetryKeys: ['consumption'],
    });
    expect(raw).toMatchObject({ aggregation: 'NONE', resolution: null, fillGaps: false, estimate: { buckets: null, points: null } });
    expect(raw).not.toHaveProperty('rawLimit');
    const agg = buildRequest({ devices: [dev(1)], range: { start: spEpoch(2026, 9, 1), end: spEpoch(2026, 9, 8) }, preset: 'last7days', resolution: '15m', telemetryKeys: ['consumption'] });
    expect(await requestHash(raw, 1, sha256)).not.toBe(await requestHash(agg, 1, sha256));
  });
});

describe('RFC-0238 envelope', () => {
  const req = buildRequest({
    devices: [dev(1)],
    range: { start: spEpoch(2026, 9, 1), end: spEpoch(2026, 9, 8) },
    preset: 'last7days',
    resolution: '1h',
    telemetryKeys: ['consumption'],
  });

  it('builds a v1 envelope with no status/result fields', async () => {
    const e = await buildEnvelope({ request: req, now: Date.UTC(2026, 9, 8, 12), user: USER, customer: CUSTOMER, idGen: () => 'fixed', sha256 });
    expect(e.jobId).toBe('drj_fixed');
    expect(Object.keys(e)).toEqual(['schemaVersion', 'type', 'jobId', 'catalogVersion', 'hashAlgorithm', 'requestHash', 'requestedAt', 'requestedBy', 'customer', 'request', 'audit']);
    expect(e.audit).toEqual([{ op: 'submit', outcome: 'requested', at: '2026-10-08T12:00:00.000Z', by: 'tb-user-1' }]);
    const cmd = toSubmitCommand(e);
    expect(cmd.request).toBe(e.request);
    expect(cmd.requestHash).toBe(e.requestHash);
    expect(cmd.declaredRequester).toBeUndefined();
    expect(toSubmitCommand(e, { includeDeclaredRequester: true }).declaredRequester).toEqual({ tbUserId: 'tb-user-1' });
  });

  it('parseEnvelope rejects unknown versions and broken JSON', async () => {
    const e = await buildEnvelope({ request: req, now: 0, user: USER, customer: CUSTOMER, sha256 });
    expect(parseEnvelope(e).ok).toBe(true);
    expect(parseEnvelope(JSON.stringify(e)).ok).toBe(true);
    expect(parseEnvelope({ ...e, schemaVersion: 2 })).toEqual({ ok: false, reason: 'unknown-version', schemaVersion: 2 });
    expect(parseEnvelope('{oops')).toEqual({ ok: false, reason: 'invalid-json' });
  });

  it('uuidv7 is time-ordered', () => {
    const a = uuidv7(1_000, () => new Uint8Array(10));
    const b = uuidv7(2_000, () => new Uint8Array(10));
    expect(a < b).toBe(true);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('RFC-0238 job presentation state', () => {
  const now = Date.UTC(2026, 9, 8, 12);
  const base = async (audit?: any[]) => {
    const req = buildRequest({ devices: [dev(1)], range: { start: spEpoch(2026, 9, 1), end: spEpoch(2026, 9, 2) }, preset: 'custom', resolution: '1h', telemetryKeys: ['consumption'] });
    const e = await buildEnvelope({ request: req, now: now - 60_000, user: USER, customer: CUSTOMER, sha256 });
    if (audit) e.audit = audit;
    return e;
  };
  const opts = { now, inflight: false, uncertain: false, graceMs: 120_000, idempotencyWindowMs: 3_600_000 };

  it('GCDR answer wins', async () => {
    const e = await base();
    const job = { jobId: e.jobId, status: 'running' as const, progress: 40, createdAt: '' };
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: true, job } }).state).toBe('running');
    const expired = { ...job, status: 'succeeded' as const, result: { available: false } };
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: true, job: expired } }).state).toBe('result_expired');
  });

  it('not found: sending inside the grace, not_received after, expired outside the window', async () => {
    const e = await base();
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: false } }).state).toBe('sending');
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: false }, uncertain: true })).toMatchObject({ state: 'send_uncertain', canResend: true });
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: false }, graceMs: 1000 })).toMatchObject({ state: 'not_received', canResend: true });
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: false }, idempotencyWindowMs: 1000 })).toMatchObject({ state: 'expired', canResend: false });
  });

  it('a query failure is not "not found" and still allows the idempotent resend', async () => {
    const e = await base();
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { queryError: 'UNAVAILABLE' } })).toMatchObject({ state: 'query_unavailable', canResend: true });
  });

  it('rejections: 422 never resends, 429 may', async () => {
    const r422 = await base([{ op: 'submit', outcome: 'requested', at: '', by: 'u' }, { op: 'submit', outcome: 'rejected', at: '', by: 'u', code: 'VALIDATION_FAILED' }]);
    expect(deriveJobView({ ...opts, envelope: r422, knowledge: { found: false } })).toMatchObject({ state: 'rejected', code: 'VALIDATION_FAILED', canResend: false });
    const r429 = await base([{ op: 'submit', outcome: 'requested', at: '', by: 'u' }, { op: 'submit', outcome: 'rejected', at: '', by: 'u', code: 'ACTIVE_JOBS_LIMIT' }]);
    expect(deriveJobView({ ...opts, envelope: r429, knowledge: { found: false } }).canResend).toBe(true);
  });

  it('mergeBatch never downgrades a confirmed job on a transient 404', () => {
    const known = new Map<string, JobKnowledge>([['j1', { found: true, job: { jobId: 'j1', status: 'queued', progress: 0, createdAt: '' } }]]);
    mergeBatch(known, [{ jobId: 'j1', found: false }, { jobId: 'j2', found: false }]);
    expect(known.get('j1')).toMatchObject({ found: true });
    expect(known.get('j2')).toEqual({ found: false });
  });

  it('reconciles only what GCDR can prove', async () => {
    const e = await base();
    const job = { jobId: e.jobId, status: 'cancelled' as const, progress: null, createdAt: 'c', cancelledAt: 'x', cancelledBy: { principal: 'apikey', declared: { tbUserId: 'tb-9' } } };
    expect(reconciliationEvents(e, job)).toEqual([
      { op: 'submit', outcome: 'accepted', at: 'c', by: 'tb-user-1', source: 'reconciled' },
      { op: 'cancel', outcome: 'accepted', at: 'x', by: 'tb-9', source: 'reconciled' },
    ]);
  });

  it('classifies uncertain responses and polling states', () => {
    expect([0, 500, 503].every(isUncertainStatus)).toBe(true);
    expect([403, 409, 422, 429].some(isUncertainStatus)).toBe(false);
    expect(needsPolling('send_uncertain')).toBe(true);
    expect(needsPolling('not_received')).toBe(false);
    expect(needsPolling('succeeded')).toBe(false);
  });
});
