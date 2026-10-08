import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { openDemandPanelV2 } from '../../src/components/demand-panel-v2';
import {
  buildTaxonomyChips,
  requestHash,
  type DemandDevice,
  type DemandReportEnvelopeV1,
  type EnvelopeStore,
  type GcdrJobView,
  type ReportJobsApi,
  type SubmitCommand,
  type TaxonomyClassifier,
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

function fakes(opts: { submitFails?: number } = {}) {
  const attrs = new Map<string, DemandReportEnvelopeV1>();
  const jobs = new Map<string, GcdrJobView>();
  const submits: SubmitCommand[] = [];
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
      expect(await requestHash(cmd.request, cmd.catalogVersion, sha256)).toBe(cmd.requestHash);
      const job = jobs.get(cmd.jobId) ?? { jobId: cmd.jobId, status: 'queued' as const, progress: 0, createdAt: new Date().toISOString() };
      jobs.set(cmd.jobId, job);
      return job;
    },
    batchGet: async (ids) => ids.map((id) => (jobs.has(id) ? { jobId: id, found: true as const, job: jobs.get(id)! } : { jobId: id, found: false as const })),
    active: async () => [...jobs.values()].filter((j) => j.status === 'queued' || j.status === 'running'),
    cancel: async (id) => { const j = { ...jobs.get(id)!, status: 'cancelled' as const }; jobs.set(id, j); return j; },
    download: async () => ({}),
  };
  return { store, api, attrs, jobs, submits };
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

  it('full flow: envelope written before the GCDR call, then accepted', async () => {
    const f = fakes();
    open(f, { preselect: ['tb-1', 'tb-2'] });
    await flush();
    click('[data-action="next"]');
    click('[data-action="next"]');
    click('[data-action="next"]');
    expect(document.querySelector('.dp2-sum')!.textContent).toContain('Entrada');
    click('[data-action="confirm"]');
    await flush(12);
    expect(f.attrs.size).toBe(1);
    const env = [...f.attrs.values()][0];
    expect(Object.keys(env)).not.toContain('status');
    expect(env.audit.map((a) => `${a.op}.${a.outcome}`)).toEqual(['submit.requested', 'submit.accepted']);
    expect(f.submits).toHaveLength(1);
    expect(f.submits[0].request.devices.map((d) => d.gcdrDeviceId)).toEqual(['g-1', 'g-2']);
    expect(document.querySelector('.dp2-job .dp2-status')!.textContent).toBe('Na fila');
  });

  it('uncertain submit (5xx twice) → same jobId retried, then "Não enviado" + idempotent resend', async () => {
    const f = fakes({ submitFails: 2 });
    open(f, { preselect: ['tb-1'] });
    await flush();
    click('[data-action="next"]'); click('[data-action="next"]'); click('[data-action="next"]');
    click('[data-action="confirm"]');
    await flush(12);
    expect(f.submits.map((s) => s.jobId)).toEqual([f.submits[0].jobId, f.submits[0].jobId]);
    expect([...f.attrs.values()][0].audit.map((a) => a.outcome)).toEqual(['requested']);   // timeouts are not rejections
    await new Promise((r) => setTimeout(r, 120));
    click('[data-action="reload"]');
    await flush(12);
    expect(document.querySelector('.dp2-job .dp2-status')!.textContent).toBe('Não enviado');
    click('[data-action="resend"]');
    await flush(12);
    expect(f.jobs.size).toBe(1);
    expect([...f.attrs.values()][0].audit.map((a) => `${a.op}.${a.outcome}`)).toEqual(['submit.requested', 'resend.accepted']);
  });
});
