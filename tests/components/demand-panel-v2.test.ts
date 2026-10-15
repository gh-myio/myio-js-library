import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { openDemandPanelV2 } from '../../src/components/demand-panel-v2';
import { createGcdrReportJobsApi, projectJob } from '../../src/components/demand-panel-v2/adapters';
import {
  buildTaxonomyChips,
  requestHash,
  type DemandDevice,
  type DemandReportEnvelope,
  type EnvelopeStore,
  type GcdrJobView,
  type ReportJobsApi,
  type SubmitCommand,
  type TaxonomyClassifier,
  type ValidateResult,
} from '../../src/utils/reports/demand';

const sha256 = async (b: Uint8Array) => new Uint8Array(createHash('sha256').update(b).digest());
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

const devices: DemandDevice[] = [
  { tbDeviceId: 'tb-1', gcdrDeviceId: 'g-1', ingestionId: 'i-1', label: 'Entrada', name: 'ENT', identifier: 'ENT-01', deviceProfile: 'ENTRADA' },
  { tbDeviceId: 'tb-2', gcdrDeviceId: 'g-2', ingestionId: 'i-2', label: 'Chiller 1', name: 'CH1', identifier: 'CAG-1', deviceProfile: 'CHILLER' },
  { tbDeviceId: 'tb-3', gcdrDeviceId: null, ingestionId: 'i-3', label: 'Elevador 1', name: 'ELV1', identifier: 'ELV-01', deviceProfile: 'ELEVADOR' },
];
const classifier: TaxonomyClassifier = {
  classify: (d) => ({ ENTRADA: 'entrada', CHILLER: 'climatizacao', ELEVADOR: 'elevadores' } as Record<string, string>)[d.deviceProfile] ?? 'outros',
  describe: (k) => ({ entrada: { label: 'Entrada', order: 0 }, climatizacao: { label: 'Climatização', order: 1 }, elevadores: { label: 'Elevadores', order: 2 } } as Record<string, { label: string; order: number }>)[k],
};

function fakes(opts: { submitFails?: number; validate?: Partial<ValidateResult>; config?: Record<string, unknown> | 'fail' } = {}) {
  const attrs = new Map<string, DemandReportEnvelope>();
  const jobs = new Map<string, GcdrJobView>();
  const submits: SubmitCommand[] = [];
  let validations = 0;
  let failLeft = opts.submitFails ?? 0;
  const store: EnvelopeStore = {
    keys: async () => [...attrs.keys()],
    get: async (keys) => keys.filter((k) => attrs.has(k)).map((k) => ({ key: k, value: attrs.get(k) })),
    put: async (k, e) => { attrs.set(k, JSON.parse(JSON.stringify(e))); },
    appendAudit: async (k, ev) => { const e = attrs.get(k)!; e.audit.push(ev); return JSON.parse(JSON.stringify(e)); },
  };
  const api: ReportJobsApi = {
    submit: async (cmd) => {
      submits.push(cmd);
      if (failLeft-- > 0) throw { status: 503, code: 'UNAVAILABLE', message: 'down' };
      expect(await requestHash(cmd.request, sha256)).toBe(cmd.requestHash);
      const job = jobs.get(cmd.jobId) ?? { jobId: cmd.jobId, status: 'queued' as const, progress: 0, createdAt: new Date().toISOString() };
      jobs.set(cmd.jobId, job);
      return job;
    },
    validate: async () => { validations++; return { ok: true, errors: [], warnings: [], ...opts.validate }; },
    config: async () => {
      if (opts.config === 'fail') throw { status: 503, code: 'UNAVAILABLE' };
      return { demandLabel: 'Potência média em 15 min (demanda estimada)', ...(opts.config || {}) };
    },
    batchGet: async (ids) => ids.map((id) => (jobs.has(id) ? { jobId: id, found: true as const, job: jobs.get(id)! } : { jobId: id, found: false as const })),
    active: async () => [...jobs.values()].filter((j) => j.status === 'queued' || j.status === 'running'),
    cancel: async (id) => { const j = { ...jobs.get(id)!, status: 'cancelled' as const }; jobs.set(id, j); return j; },
    download: async (jobId) => ({ jobId, files: [] }),
  };
  return { store, api, attrs, jobs, submits, validations: () => validations };
}

const click = (sel: string) => (document.querySelector(sel) as HTMLElement).click();

describe('RFC-0238 taxonomy chips', () => {
  it('only categories present, in taxonomy order, with counts', () => {
    const { chips, categoryOf } = buildTaxonomyChips(devices, classifier);
    expect(chips.map((c) => [c.key, c.label, c.count])).toEqual([['entrada', 'Entrada', 1], ['climatizacao', 'Climatização', 1], ['elevadores', 'Elevadores', 1]]);
    expect(categoryOf.get('tb-2')).toBe('climatizacao');
  });
});

describe('RFC-0238 openDemandPanelV2', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { document.querySelectorAll('.myio-modal-backdrop').forEach((n) => n.remove()); });

  const open = (f: ReturnType<typeof fakes>, extra = {}) => openDemandPanelV2({
    devices, classifier, sha256, store: f.store, api: f.api, graceMs: 50, pollMinMs: 10_000,
    customer: { tbCustomerId: 'tb-c', gcdrCustomerId: 'g-c', name: 'Shopping' },
    user: { tbUserId: 'tb-u', name: 'Rodrigo' },
    ...extra,
  });
  const toSummary = async () => {
    click('[data-action="next"]'); click('[data-action="next"]'); click('[data-action="next"]');
    await flush(8);
  };

  it('renders the standard header, taxonomy chips and blocks devices without GCDR link', async () => {
    const f = fakes();
    open(f);
    await flush();
    expect(document.querySelector('[id$="-close"]')).toBeTruthy();
    expect(document.querySelector('[id$="-maximize"]')).toBeTruthy();
    const chips = [...document.querySelectorAll('[data-action="category"]')].map((c) => c.textContent!.trim());
    expect(chips).toEqual(['Todos · 3', 'Entrada · 1', 'Climatização · 1', 'Elevadores · 1']);
    const blocked = document.querySelector('[data-id="tb-3"]') as HTMLButtonElement;
    expect(blocked.disabled).toBe(true);
    click('[data-action="category"][data-key="climatizacao"]');
    expect(document.querySelectorAll('[data-role="results"] .dp2-item')).toHaveLength(1);
  });

  it('step 2 offers the GCDR resolutions only (no aggregation / raw mode)', async () => {
    const f = fakes();
    open(f, { preselect: ['tb-1'] });
    await flush();
    click('[data-action="next"]');
    const res = [...document.querySelectorAll('[data-action="resolution"]')].map((b) => (b as HTMLElement).dataset.res);
    expect(res).toEqual(['1m', '5m', '15m', '1h', '1d']);
    expect(document.querySelector('[data-action="aggregation"]')).toBeNull();
  });

  it('step 2 limits come from GET …/config (GCDR changes 1h to 100 days → panel follows)', async () => {
    const f = fakes({ config: { limits: { maxDevices: 2, maxDaysByResolution: { '15m': 31, '1h': 100 } } } });
    open(f, { preselect: ['tb-1'] });
    await flush();
    expect(document.body.textContent).toContain('Selecionados · 1 de 2');
    click('[data-action="next"]');
    const chips = [...document.querySelectorAll('[data-action="resolution"]')].map((b) => b.textContent!.replace(/\s+/g, ' ').trim());
    expect(chips).toEqual(['15 min (até 31 d)', '1 hora (até 100 d)']);
  });

  it('without the config no limit is hard-coded: no "(até N d)", no max-period block, server validates', async () => {
    const f = fakes({ config: 'fail' });
    open(f, { preselect: ['tb-1'] });
    await flush();
    expect(document.body.textContent).not.toMatch(/Selecionados · 1 de/);
    click('[data-action="next"]');
    expect(document.querySelector('[data-action="resolution"]')!.textContent).not.toContain('até');
    expect(document.body.textContent).toContain('Não foi possível carregar os limites vigentes');
  });

  it('full flow: validate on step 4, envelope written before the GCDR call, then accepted', async () => {
    const f = fakes();
    open(f, { preselect: ['tb-1', 'tb-2'] });
    await flush();
    await toSummary();
    expect(f.validations()).toBe(1);
    expect(f.attrs.size).toBe(0);                       // validate writes nothing
    expect(document.querySelector('.dp2-sum')!.textContent).toContain('Entrada');
    click('[data-action="confirm"]');
    await flush(12);
    expect(f.attrs.size).toBe(1);
    const env = [...f.attrs.values()][0];
    expect(Object.keys(env)).not.toContain('status');
    expect(env.audit.map((a) => `${a.op}.${a.outcome}`)).toEqual(['submit.requested', 'submit.accepted']);
    expect(f.submits).toHaveLength(1);
    expect(f.submits[0]).toMatchObject({ schemaVersion: 1, requestedBy: { userId: 'tb-u' } });
    expect(f.submits[0].request.devices.map((d) => d.gcdrDeviceId)).toEqual(['g-1', 'g-2']);
    expect(document.querySelector('.dp2-job .dp2-status')!.textContent).toBe('Na fila');
  });

  it('a refused validation blocks the confirm and writes no envelope', async () => {
    const f = fakes({ validate: { ok: false, errors: [{ code: 'VALIDATION_FAILED', reason: 'NO_DATA_IN_PERIOD' }] } });
    open(f, { preselect: ['tb-1'] });
    await flush();
    await toSummary();
    expect((document.querySelector('[data-action="confirm"]') as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).toContain('Não há dados no período escolhido.');
    expect(f.attrs.size).toBe(0);
  });

  it('uncertain submit (5xx twice) → same jobId retried, then "Não enviado" + resend after re-validating', async () => {
    const f = fakes({ submitFails: 2 });
    open(f, { preselect: ['tb-1'] });
    await flush();
    await toSummary();
    click('[data-action="confirm"]');
    await flush(12);
    expect(f.submits.map((s) => s.jobId)).toEqual([f.submits[0].jobId, f.submits[0].jobId]);
    expect([...f.attrs.values()][0].audit.map((a) => a.outcome)).toEqual(['requested']);   // timeouts are not rejections
    await new Promise((r) => setTimeout(r, 120));
    click('[data-action="reload"]');
    await flush(12);
    expect(document.querySelector('.dp2-job .dp2-status')!.textContent).toBe('Não enviado');
    const before = f.validations();
    click('[data-action="resend"]');
    await flush(12);
    expect(f.validations()).toBe(before + 1);
    expect(f.jobs.size).toBe(1);
    expect([...f.attrs.values()][0].audit.map((a) => `${a.op}.${a.outcome}`)).toEqual(['submit.requested', 'resend.accepted']);
  });
});

describe('RFC-0238 GCDR adapter (RFC-0075 responses)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    ({ ok: status < 400, status, text: async () => JSON.stringify(body), headers: { get: (h: string) => headers[h] ?? null } }) as unknown as Response;

  it('unwraps { success, data }, projects progress and maps batch-get notFound', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return respond(200, { success: true, data: { items: [{ jobId: 'drj_a', status: 'running', progress: { percent: 42, phase: 'fetching' }, createdAt: 'c' }], notFound: ['drj_b'] }, meta: {} });
    });
    const api = createGcdrReportJobsApi({ baseUrl: 'https://gcdr/api/v1', gcdrCustomerId: 'cid', getHeaders: () => ({ 'X-API-Key': 'k', 'X-Tenant-Id': '' }) });
    const res = await api.batchGet(['drj_a', 'drj_b']);
    expect(calls[0].url).toBe('https://gcdr/api/v1/customers/cid/report-jobs/batch-get');
    expect((calls[0].init.headers as Record<string, string>)['X-Tenant-Id']).toBeUndefined();   // empty header dropped
    expect(res).toEqual([
      { jobId: 'drj_a', found: true, job: expect.objectContaining({ progress: 42, phase: 'fetching' }) },
      { jobId: 'drj_b', found: false },
    ]);
  });

  it('errors carry code, details.reason and Retry-After', async () => {
    vi.stubGlobal('fetch', async () => respond(429, { success: false, error: { code: 'ACTIVE_JOBS_LIMIT', message: 'limit', details: { limit: 'user', max: 10 } } }, { 'Retry-After': '60' }));
    const api = createGcdrReportJobsApi({ baseUrl: 'https://gcdr', gcdrCustomerId: 'cid', getHeaders: () => ({}) });
    await expect(api.submit({} as SubmitCommand)).rejects.toMatchObject({ status: 429, code: 'ACTIVE_JOBS_LIMIT', details: { limit: 'user', max: 10 }, retryAfter: 60 });
  });

  it('projectJob keeps numeric progress and nulls missing', () => {
    expect(projectJob({ jobId: 'j', progress: 7, createdAt: 'c' }).progress).toBe(7);
    expect(projectJob({ jobId: 'j', createdAt: 'c' }).progress).toBeNull();
  });
});
