import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TELEMETRY_CATALOG,
  bucketCount,
  presetRange,
  spEpoch,
  periodErrors,
  finestFittingResolution,
  limitsFromConfig,
  availableResolutions,
  isLocalMidnight,
  localMidnightOf,
  parseLocalDateTime,
  toLocalDateTimeInput,
  canonicalJson,
  canonicalRequestJson,
  requestHash,
  buildRequest,
  buildEnvelope,
  toSubmitCommand,
  toValidateCommand,
  parseEnvelope,
  uuidv7,
  deriveJobView,
  mergeBatch,
  reconciliationEvents,
  needsPolling,
  isUncertainStatus,
  rejectionText,
  type DemandDevice,
  type DemandRequest,
  type JobKnowledge,
} from '../../../../src/utils/reports/demand';

const sha256 = async (b: Uint8Array) => new Uint8Array(createHash('sha256').update(b).digest());
const dev = (n: number, extra: Partial<DemandDevice> = {}): DemandDevice => ({
  tbDeviceId: `tb-${n}`,
  gcdrDeviceId: `00000000-0000-4000-8000-00000000000${n}`,
  ingestionId: null,
  label: `Medidor ${n}`,
  name: `3F MED ${n}`,
  identifier: `LUC ${n}`,
  deviceProfile: '3F_MEDIDOR',
  group: 'lojas',
  ...extra,
});
const USER = { tbUserId: 'tb-user-1', name: 'Rodrigo Lago', email: 'r@x.com' };
const CUSTOMER = { tbCustomerId: 'tb-c', gcdrCustomerId: 'gcdr-c', name: 'Shopping' };

describe('RFC-0238 catalogue', () => {
  it('has the 14 keys of the live modal (mirror of GCDR demandCatalog v1)', () => {
    expect(TELEMETRY_CATALOG.map((t) => t.key)).toEqual([
      'consumption', 'a', 'b', 'c', 'voltage_a', 'voltage_b', 'voltage_c',
      'current_a', 'current_b', 'current_c', 'total_current', 'fp_a', 'fp_b', 'fp_c',
    ]);
  });
});

describe('RFC-0238 period and buckets (RFC-0075 §4.5)', () => {
  it('counts buckets anchored at start; 1d counts local calendar days', () => {
    // 10:07 → 11:07 at 15 min: 10:07–10:22, 10:22–10:37, 10:37–10:52, 10:52–11:07
    expect(bucketCount(spEpoch(2026, 9, 5, 10, 7), spEpoch(2026, 9, 5, 11, 7), '15m')).toBe(4);
    // partial last bucket counts
    expect(bucketCount(spEpoch(2026, 9, 5, 10), spEpoch(2026, 9, 5, 10, 16), '15m')).toBe(2);
    // 23:00 → 01:00 touches two local days
    expect(bucketCount(spEpoch(2026, 9, 1, 23), spEpoch(2026, 9, 2, 1), '1d')).toBe(2);
    const lastWeek = presetRange('last7days', spEpoch(2026, 9, 8, 14, 30))!;
    expect(bucketCount(lastWeek.start, lastWeek.end, '15m')).toBe(672);
    expect(bucketCount(lastWeek.start, lastWeek.end, '1d')).toBe(7);
    expect(bucketCount(lastWeek.start, lastWeek.end, '1m')).toBe(7 * 1440);
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
    const feb2028 = presetRange('lastMonth', spEpoch(2028, 2, 15))!;
    expect((feb2028.end - feb2028.start) / 86_400_000).toBe(29);
  });

  it('round-trips datetime-local values in São Paulo time', () => {
    const ms = parseLocalDateTime('2026-10-05T10:07');
    expect(new Date(ms).toISOString()).toBe('2026-10-05T13:07:00.000Z');
    expect(toLocalDateTimeInput(ms)).toBe('2026-10-05T10:07');
    expect(parseLocalDateTime('bad')).toBeNaN();
  });

  // Shape of GET …/report-jobs/config (gcdr ReportJobService.config → limits).
  const CONFIG = {
    demandLabel: 'x',
    limits: { maxDevices: 50, maxTelemetries: 15, maxPoints: 2000000, maxActivePerUser: 10,
      maxDaysByResolution: { '1m': 1, '5m': 7, '15m': 31, '1h': 92, '1d': 92 } },
  };
  const LIMITS = limitsFromConfig(CONFIG)!;

  it('reads the limits in force from the GCDR config (nothing hard-coded)', () => {
    expect(LIMITS).toEqual({ maxDaysByResolution: { '1m': 1, '5m': 7, '15m': 31, '1h': 92, '1d': 92 }, maxDevices: 50, maxTelemetries: 15, maxPoints: 2000000, maxActivePerUser: 10 });
    // GCDR changes 1h to 100 days → the lib follows without a release
    const changed = limitsFromConfig({ limits: { maxDaysByResolution: { '1h': 100, '1d': '120' } } })!;
    expect(changed.maxDaysByResolution).toEqual({ '1h': 100, '1d': 120 });
    expect(availableResolutions(changed).map((r) => r.id)).toEqual(['1h', '1d']);
    expect(limitsFromConfig(null)).toBeNull();
    expect(limitsFromConfig({ demandLabel: 'x' })).toBeNull();
    expect(limitsFromConfig({ limits: { maxDaysByResolution: { '1h': -1, x: 5 } } })).toBeNull();
    expect(availableResolutions(null).map((r) => r.id)).toEqual(['1m', '5m', '15m', '1h', '1d']);
  });

  it('validates the per-resolution limits from the config and suggests the finest fitting one', () => {
    const now = spEpoch(2026, 9, 8);
    const month = presetRange('lastMonth', now)!;
    expect(periodErrors(month, '15m', now, LIMITS)).toEqual([]);
    expect(finestFittingResolution(month, LIMITS)).toBe('15m');
    const fortyDays = { start: spEpoch(2026, 7, 20), end: spEpoch(2026, 8, 29) };
    expect(periodErrors(fortyDays, '15m', now, LIMITS)[0]).toMatch(/intervalos de 15 min, o período máximo é 31 dia/);
    expect(periodErrors(fortyDays, '1h', now, LIMITS)).toEqual([]);
    expect(finestFittingResolution(fortyDays, LIMITS)).toBe('1h');
    const twoDays = { start: spEpoch(2026, 9, 5), end: spEpoch(2026, 9, 7) };
    expect(periodErrors(twoDays, '1m', now, LIMITS)[0]).toMatch(/1 min, o período máximo é 1 dia/);
    expect(finestFittingResolution(twoDays, LIMITS)).toBe('5m');
    expect(periodErrors({ start: spEpoch(2019, 0, 1), end: spEpoch(2019, 0, 2) }, '1h', now, LIMITS)[0]).toMatch(/2019/);
    expect(periodErrors({ start: now, end: now - 1 }, '1h', now, LIMITS)).toEqual(['O fim precisa ser depois do início.']);
    expect(periodErrors({ start: now - 3_600_000, end: now + 10 * 60_000 }, '1h', now, LIMITS)).toEqual(['O fim não pode estar no futuro.']);
  });

  it('without the config no max-period limit is applied client-side (GCDR decides)', () => {
    const now = spEpoch(2026, 9, 8);
    const fortyDays = { start: spEpoch(2026, 7, 20), end: spEpoch(2026, 8, 29) };
    expect(periodErrors(fortyDays, '1m', now)).toEqual([]);
    expect(finestFittingResolution(fortyDays, null)).toBeNull();
  });

  it('1d requires start at local midnight (L-9)', () => {
    const now = spEpoch(2026, 9, 8, 12);
    const start = spEpoch(2026, 9, 5, 10, 7);
    expect(isLocalMidnight(start)).toBe(false);
    expect(localMidnightOf(start)).toBe(spEpoch(2026, 9, 5));
    expect(periodErrors({ start, end: spEpoch(2026, 9, 7) }, '1d', now).join()).toMatch(/meia-noite/);
    expect(periodErrors({ start: spEpoch(2026, 9, 5), end: now }, '1d', now)).toEqual([]);
  });
});

describe('RFC-0238 request hash — canonicalisation v2 shared with GCDR (L-8)', () => {
  const fixture = JSON.parse(readFileSync(resolve(__dirname, '../../../fixtures/reports/request-hash-v2.json'), 'utf8')) as {
    cases: Array<{ name: string; request: DemandRequest; canonical: string; hash: string }>;
    jsonCases: Array<{ name: string; value: unknown; canonical: string }>;
  };

  it.each(fixture.cases.map((c) => [c.name, c] as const))('fixture case %s', async (_name, c) => {
    expect(canonicalRequestJson(c.request)).toBe(c.canonical);
    expect(await requestHash(c.request, sha256)).toBe(c.hash);
  });

  it.each(fixture.jsonCases.map((c) => [c.name, c] as const))('canonical JSON case %s', (_name, c) => {
    expect(canonicalJson(c.value)).toBe(c.canonical);
  });

  const req = buildRequest({
    devices: [dev(2), dev(1)],
    range: { start: spEpoch(2026, 9, 1), end: spEpoch(2026, 9, 8) },
    preset: 'last7days',
    resolution: '15m',
    telemetryKeys: ['voltage_a', 'consumption'],
  });

  it('builds the strict GCDR request (catalogue order, estimate, no undefined fields)', () => {
    expect(req.telemetries.map((t) => t.key)).toEqual(['consumption', 'voltage_a']);
    expect(req.estimate).toEqual({ buckets: 672, points: 672 * 2 * 2 });
    expect(req.period).toEqual({ start: '2026-10-01T03:00:00.000Z', end: '2026-10-08T03:00:00.000Z', timezone: 'America/Sao_Paulo', preset: 'last7days' });
    expect(Object.keys(req.devices[0]).sort()).toEqual(['deviceProfile', 'gcdrDeviceId', 'group', 'identifier', 'ingestionId', 'label', 'name', 'tbDeviceId']);
  });

  it('labels/names/order do not change the hash; identifiers and resolution do', async () => {
    const h = await requestHash(req, sha256);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    const renamed = { ...req, devices: [...req.devices].reverse().map((d) => ({ ...d, label: 'x', name: 'y' })) };
    expect(await requestHash(renamed, sha256)).toBe(h);
    expect(await requestHash({ ...req, resolution: '1h' }, sha256)).not.toBe(h);
    expect(await requestHash({ ...req, devices: req.devices.map((d) => ({ ...d, identifier: 'other' })) }, sha256)).not.toBe(h);
  });

  it('skips devices without a GCDR link', () => {
    const r = buildRequest({ devices: [dev(1), dev(2, { gcdrDeviceId: null })], range: { start: 0, end: 3_600_000 }, preset: 'custom', resolution: '1h', telemetryKeys: ['consumption'] });
    expect(r.devices).toHaveLength(1);
  });
});

describe('RFC-0238 envelope and commands (RFC-0075 §4.2.3)', () => {
  const req = buildRequest({
    devices: [dev(1)],
    range: { start: spEpoch(2026, 9, 1), end: spEpoch(2026, 9, 8) },
    preset: 'last7days',
    resolution: '1h',
    telemetryKeys: ['consumption'],
  });

  it('builds a schema-2 envelope with no status/result fields and a strict submit body', async () => {
    const e = await buildEnvelope({ request: req, now: Date.UTC(2026, 9, 8, 12), user: USER, customer: CUSTOMER, idGen: () => '0198f0a0-0000-7000-8000-000000000001', sha256 });
    expect(e.jobId).toBe('drj_0198f0a0-0000-7000-8000-000000000001');
    expect(e.schemaVersion).toBe(2);
    expect(Object.keys(e)).toEqual(['schemaVersion', 'type', 'jobId', 'catalogVersion', 'hashAlgorithm', 'requestHash', 'requestedAt', 'requestedBy', 'customer', 'request', 'options', 'audit']);
    expect(e.requestHash).toBe(await requestHash(req, sha256));
    const cmd = toSubmitCommand(e);
    expect(Object.keys(cmd).sort()).toEqual(['catalogVersion', 'jobId', 'request', 'requestHash', 'requestedBy', 'schemaVersion', 'type']);
    expect(cmd).toMatchObject({ schemaVersion: 1, type: 'demand-report', catalogVersion: 1, requestedBy: { userId: 'tb-user-1' } });
    expect(cmd.request).toBe(e.request);
  });

  it('options are stored and replayed exactly (else 409 OPTIONS_MISMATCH)', async () => {
    const e = await buildEnvelope({ request: req, now: 0, user: USER, customer: CUSTOMER, options: { force: true }, sha256 });
    expect(toSubmitCommand(e).force).toBe(true);
    const v = toValidateCommand(req, USER, { force: true });
    expect(v).toMatchObject({ schemaVersion: 1, force: true, request: req });
    expect(v).not.toHaveProperty('jobId');
    expect(v).not.toHaveProperty('requestHash');
  });

  it('parseEnvelope rejects schema 1 drafts, unknown versions and broken JSON', async () => {
    const e = await buildEnvelope({ request: req, now: 0, user: USER, customer: CUSTOMER, sha256 });
    expect(parseEnvelope(e).ok).toBe(true);
    expect(parseEnvelope(JSON.stringify(e)).ok).toBe(true);
    expect(parseEnvelope({ ...e, schemaVersion: 1 })).toEqual({ ok: false, reason: 'unknown-version', schemaVersion: 1 });
    expect(parseEnvelope('{oops')).toEqual({ ok: false, reason: 'invalid-json' });
  });

  it('uuidv7 is time-ordered and matches the GCDR jobId pattern', () => {
    const a = uuidv7(1_000, () => new Uint8Array(10));
    const b = uuidv7(2_000, () => new Uint8Array(10));
    expect(a < b).toBe(true);
    expect(`drj_${a}`).toMatch(/^drj_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('RFC-0238 job presentation state (L-1, L-2, L-12, L-13, L-16, L-19)', () => {
  const now = Date.UTC(2026, 9, 8, 12);
  const base = async (audit?: any[]) => {
    const req = buildRequest({ devices: [dev(1)], range: { start: spEpoch(2026, 9, 1), end: spEpoch(2026, 9, 2) }, preset: 'custom', resolution: '1h', telemetryKeys: ['consumption'] });
    const e = await buildEnvelope({ request: req, now: now - 60_000, user: USER, customer: CUSTOMER, sha256 });
    if (audit) e.audit = audit;
    return e;
  };
  const opts = { now, inflight: false, uncertain: false, graceMs: 120_000, idempotencyWindowMs: 3_600_000 };

  it('a job found in GCDR wins; resultAvailability is the download rule', async () => {
    const e = await base([{ op: 'submit', outcome: 'rejected', at: '', by: 'u', code: 'VALIDATION_FAILED' }]);
    const job = { jobId: e.jobId, status: 'running' as const, progress: 40, createdAt: '' };
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: true, job } }).state).toBe('running');
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: true, job: { ...job, status: 'expired' } } }).state).toBe('result_expired');
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: true, job: { ...job, status: 'succeeded', resultAvailability: 'expired' } } }).state).toBe('result_expired');
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: true, job: { ...job, status: 'succeeded', resultAvailability: 'purged' } } }).state).toBe('purged');
  });

  it('not found: sending inside the grace, "Não enviado" inside the window, "Pedido antigo" after', async () => {
    const e = await base();
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: false } }).state).toBe('sending');
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: false }, uncertain: true })).toMatchObject({ state: 'send_uncertain', canResend: true });
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: false }, graceMs: 1000 })).toMatchObject({ state: 'not_received', canResend: true });
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { found: false }, idempotencyWindowMs: 1000 })).toMatchObject({ state: 'old_request', canResend: false });
  });

  it('a query failure is "Status indisponível" and never resends', async () => {
    const e = await base();
    expect(deriveJobView({ ...opts, envelope: e, knowledge: { queryError: 'HTTP_503' } })).toMatchObject({ state: 'query_unavailable', canResend: false });
  });

  it('rejections: 422/409 never resend, 429 may; the reason is kept', async () => {
    const r422 = await base([{ op: 'submit', outcome: 'requested', at: '', by: 'u' }, { op: 'submit', outcome: 'rejected', at: '', by: 'u', code: 'VALIDATION_FAILED', reason: 'PERIOD_TOO_LONG' }]);
    expect(deriveJobView({ ...opts, envelope: r422, knowledge: { found: false } })).toMatchObject({ state: 'rejected', code: 'VALIDATION_FAILED', reason: 'PERIOD_TOO_LONG', canResend: false });
    const r429 = await base([{ op: 'submit', outcome: 'requested', at: '', by: 'u' }, { op: 'submit', outcome: 'rejected', at: '', by: 'u', code: 'ACTIVE_JOBS_LIMIT' }]);
    expect(deriveJobView({ ...opts, envelope: r429, knowledge: { found: false } }).canResend).toBe(true);
  });

  it('pt-BR texts from code + details.reason', () => {
    expect(rejectionText('VALIDATION_FAILED', 'DEVICE_NO_SOURCE')).toMatch(/fonte de dados/);
    expect(rejectionText('ACTIVE_JOBS_LIMIT', undefined, undefined, { limit: 'day', max: 20 })).toBe('Limite atingido: relatórios gerados hoje (máx. 20).');
    expect(rejectionText('JOB_ID_CONFLICT')).toMatch(/Duplicar e editar/);
  });

  it('mergeBatch never downgrades a confirmed job on a transient not-found', () => {
    const known = new Map<string, JobKnowledge>([['j1', { found: true, job: { jobId: 'j1', status: 'queued', progress: 0, createdAt: '' } }]]);
    mergeBatch(known, [{ jobId: 'j1', found: false }, { jobId: 'j2', found: false }]);
    expect(known.get('j1')).toMatchObject({ found: true });
    expect(known.get('j2')).toEqual({ found: false });
  });

  it('reconciles only what GCDR can prove, with the declared canceller (never invented)', async () => {
    const e = await base();
    const job = { jobId: e.jobId, status: 'cancelled' as const, progress: null, createdAt: 'c', cancelledAt: 'x', cancelledBy: { declared: { userId: 'tb-9' }, credentialKind: 'apiKey' } };
    expect(reconciliationEvents(e, job)).toEqual([
      { op: 'submit', outcome: 'accepted', at: 'c', by: 'tb-user-1', source: 'reconciled' },
      { op: 'cancel', outcome: 'accepted', at: 'x', by: 'tb-9', source: 'reconciled' },
    ]);
    expect(reconciliationEvents(e, { ...job, cancelledBy: { credentialKind: 'apiKey' } })[1].by).toBe('desconhecido');
  });

  it('classifies uncertain responses and polling states', () => {
    expect([0, 500, 503].every(isUncertainStatus)).toBe(true);
    expect([403, 409, 422, 429].some(isUncertainStatus)).toBe(false);
    expect(needsPolling('send_uncertain')).toBe(true);
    expect(needsPolling('query_unavailable')).toBe(false);
    expect(needsPolling('succeeded')).toBe(false);
  });
});
