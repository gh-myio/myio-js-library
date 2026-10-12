/**
 * RFC-0238 — real adapters for openDemandPanelV2 inside a ThingsBoard dashboard.
 *
 * - `createTbEnvelopeStore`: customer SERVER_SCOPE attributes (audit envelopes only).
 * - `createGcdrReportJobsApi`: GCDR report-jobs API (RFC-0075, deployed). Every response is
 *   `{ success, data, meta }` — the adapter unwraps `data` and projects `JobStatus` (L-4, L-6).
 * - `demandDevicesFromItems`: dashboard orchestrator items → DemandDevice, never filling one id
 *   namespace with another (tbId → tbDeviceId, gcdrDeviceId → gcdrDeviceId, ingestionId → ingestionId).
 */
import type {
  AuditEvent,
  BatchResult,
  DemandDevice,
  DemandReportEnvelope,
  EnvelopeStore,
  GcdrJobView,
  PortError,
  ReportJobsApi,
  ReportJobsConfig,
  ResultDescriptor,
  SubmitCommand,
  ValidateCommand,
  ValidateResult,
} from '../../utils/reports/demand';
import { parseEnvelope } from '../../utils/reports/demand';

function portError(status: number, code: string, message: string, extra: Partial<PortError> = {}): PortError & Error {
  return Object.assign(new Error(message), { status, code, ...extra });
}

async function request(url: string, init: RequestInit & { signal?: AbortSignal }): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw portError(0, 'ABORTED', 'requisição cancelada');
    throw portError(0, 'NETWORK', (e as Error)?.message || 'falha de rede');
  }
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; details?: unknown }; message?: string }) || {};
    const ra = Number(res.headers?.get?.('Retry-After'));
    // A body without error.code is "unavailable", never a definitive answer (L-16)
    throw portError(res.status, err.error?.code || `HTTP_${res.status}`, err.error?.message || err.message || `HTTP ${res.status}`, {
      details: err.error?.details,
      retryAfter: Number.isFinite(ra) && ra > 0 ? ra : undefined,
    });
  }
  return body;
}

/** `{ success, data, meta }` → data (tolerates a bare body). */
function unwrap<T>(body: unknown): T {
  const b = body as { success?: boolean; data?: unknown };
  return (b && typeof b === 'object' && 'data' in b ? b.data : body) as T;
}

/* ------------------------------------------------------------------ ThingsBoard */
export interface TbEnvelopeStoreOptions {
  /** ThingsBoard origin, e.g. https://dashboard.myio-bas.com ('' = same origin). */
  tbBaseUrl: string;
  /** ThingsBoard customer id (owner of the SERVER_SCOPE attributes). */
  customerId: string;
  /** JWT provider (default: localStorage.jwt_token). */
  getToken?: () => string;
}

export function createTbEnvelopeStore(opts: TbEnvelopeStoreOptions): EnvelopeStore {
  const base = `${(opts.tbBaseUrl || '').replace(/\/+$/, '')}/api/plugins/telemetry/CUSTOMER/${encodeURIComponent(opts.customerId)}`;
  const token = () => (opts.getToken ? opts.getToken() : (typeof localStorage !== 'undefined' && localStorage.getItem('jwt_token')) || '');
  const headers = () => ({ 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token()}` });

  const store: EnvelopeStore = {
    async keys(o) {
      const keys = await request(`${base}/keys/attributes/SERVER_SCOPE`, { headers: headers(), signal: o?.signal });
      return Array.isArray(keys) ? (keys as string[]) : [];
    },
    async get(keys, o) {
      const out: Array<{ key: string; value: unknown; lastUpdateTs?: number }> = [];
      for (let i = 0; i < keys.length; i += 50) {   // keep the URL short
        const chunk = keys.slice(i, i + 50).map(encodeURIComponent).join(',');
        const rows = (await request(`${base}/values/attributes/SERVER_SCOPE?keys=${chunk}`, { headers: headers(), signal: o?.signal })) as Array<{ key: string; value: unknown; lastUpdateTs?: number }>;
        (rows || []).forEach((r) => out.push({ key: r.key, value: r.value, lastUpdateTs: r.lastUpdateTs }));
      }
      return out;
    },
    async put(key, envelope, o) {
      await request(`${base}/attributes/SERVER_SCOPE`, { method: 'POST', headers: headers(), body: JSON.stringify({ [key]: envelope }), signal: o?.signal });
    },
    /** Read-modify-write of ONE key — best effort, ThingsBoard has no compare-and-set. */
    async appendAudit(key, event: AuditEvent, o) {
      const [row] = await store.get([key], o);
      const parsed = row ? parseEnvelope(row.value) : null;
      if (!parsed || !parsed.ok) throw portError(404, 'ENVELOPE_NOT_FOUND', 'registro do pedido não encontrado');
      const env: DemandReportEnvelope = { ...parsed.envelope, audit: [...parsed.envelope.audit, event] };
      await store.put(key, env, o);
      return env;
    },
  };
  return store;
}

/* ------------------------------------------------------------------ GCDR */
export interface GcdrReportJobsApiOptions {
  /** GCDR base URL (with or without the trailing /api/v1). */
  baseUrl: string;
  gcdrCustomerId: string;
  /** Auth headers — customer API key with scopes reports:read / reports:write ({ 'X-API-Key', 'X-Tenant-Id' }). */
  getHeaders: () => Record<string, string>;
}

type RawJob = Record<string, unknown> & { jobId: string; progress?: unknown; createdAt?: string };

/** GCDR `JobStatus` → the view the component consumes (`progress.percent` → number). */
export function projectJob(raw: RawJob): GcdrJobView {
  const p = raw.progress as { percent?: number; phase?: string } | number | null | undefined;
  const percent = typeof p === 'number' ? p : p && typeof p.percent === 'number' ? p.percent : null;
  return {
    ...(raw as unknown as GcdrJobView),
    progress: percent,
    phase: (p && typeof p === 'object' ? p.phase : null) ?? null,
    createdAt: String(raw.createdAt || ''),
  };
}

export function createGcdrReportJobsApi(opts: GcdrReportJobsApiOptions): ReportJobsApi {
  const root = `${(opts.baseUrl || '').replace(/\/+$/, '').replace(/\/api\/v1$/, '')}/api/v1/customers/${encodeURIComponent(opts.gcdrCustomerId)}/report-jobs`;
  // Empty values are dropped: without X-Tenant-Id GCDR resolves the tenant from the customer key
  const auth = () => Object.fromEntries(Object.entries(opts.getHeaders() || {}).filter(([, v]) => typeof v === 'string' && v.trim() !== ''));
  const h = (json = false) => ({ Accept: 'application/json', ...(json ? { 'Content-Type': 'application/json' } : {}), ...auth() });
  const post = (url: string, body: unknown, signal?: AbortSignal) =>
    request(url, { method: 'POST', headers: h(true), body: JSON.stringify(body), signal });
  return {
    submit: async (cmd: SubmitCommand, o) => projectJob(unwrap<RawJob>(await post(root, cmd, o?.signal))),
    validate: async (cmd: ValidateCommand, o) => unwrap<ValidateResult>(await post(`${root}/validate`, cmd, o?.signal)),
    config: async (o) => unwrap<ReportJobsConfig>(await request(`${root}/config`, { headers: h(), signal: o?.signal })),
    batchGet: async (jobIds, o) => {
      const data = unwrap<{ items?: RawJob[]; notFound?: string[] }>(await post(`${root}/batch-get`, { jobIds }, o?.signal));
      const out: BatchResult[] = (data?.items || []).map((j) => ({ jobId: j.jobId, found: true as const, job: projectJob(j) }));
      (data?.notFound || []).forEach((jobId) => out.push({ jobId, found: false }));
      return out;
    },
    active: async (o) => {
      const data = unwrap<{ items?: RawJob[] }>(
        await request(`${root}?type=demand-report&status=queued,running&limit=50`, { headers: h(), signal: o?.signal })
      );
      return (data?.items || []).map(projectJob);
    },
    cancel: async (jobId, declared, o) =>
      projectJob(unwrap<RawJob>(await post(`${root}/${encodeURIComponent(jobId)}/cancel`, declared ? { cancelledBy: { userId: declared.tbUserId } } : {}, o?.signal))),
    download: async (jobId, o) => {
      const q = o?.expiresInSeconds ? `?expiresInSeconds=${Math.min(3600, Math.max(1, Math.floor(o.expiresInSeconds)))}` : '';
      return unwrap<ResultDescriptor>(await request(`${root}/${encodeURIComponent(jobId)}/result${q}`, { headers: h(), signal: o?.signal }));
    },
    summary: async (jobId, o) => unwrap<unknown>(await request(`${root}/${encodeURIComponent(jobId)}/summary`, { headers: h(), signal: o?.signal })),
  };
}

/* ------------------------------------------------------------------ devices */
interface OrchestratorItemLike {
  tbId?: string | null;
  entityId?: string | null;
  gcdrDeviceId?: string | null;
  ingestionId?: string | null;
  label?: string | null;
  entityLabel?: string | null;
  name?: string | null;
  entityName?: string | null;
  identifier?: string | null;
  deviceProfile?: string | null;
}

/**
 * Dashboard items → DemandDevice. Uses `tbId` (ThingsBoard entity id) only — items without it are
 * skipped instead of borrowing another id. Duplicates (same tbId) are dropped.
 */
export function demandDevicesFromItems(items: OrchestratorItemLike[]): DemandDevice[] {
  const seen = new Set<string>();
  const out: DemandDevice[] = [];
  for (const it of items || []) {
    const tbId = it?.tbId || null;
    if (!tbId || seen.has(tbId)) continue;
    seen.add(tbId);
    out.push({
      tbDeviceId: tbId,
      gcdrDeviceId: it.gcdrDeviceId || null,
      ingestionId: it.ingestionId || null,
      label: it.label || it.entityLabel || it.identifier || tbId,
      name: it.entityName || it.name || it.label || '',
      identifier: it.identifier || null,
      deviceProfile: it.deviceProfile || '',
    });
  }
  return out;
}

/** ThingsBoard user from the JWT claims (userId, sub = e-mail, first/last name). */
export function tbUserFromJwt(token: string | null | undefined): { tbUserId: string; name: string; email?: string } | null {
  try {
    const claims = JSON.parse(atob(String(token).split('.')[1])) as { userId?: string; sub?: string; firstName?: string; lastName?: string };
    if (!claims.userId) return null;
    const name = [claims.firstName, claims.lastName].filter(Boolean).join(' ') || claims.sub || claims.userId;
    return { tbUserId: claims.userId, name, email: claims.sub };
  } catch {
    return null;
  }
}
