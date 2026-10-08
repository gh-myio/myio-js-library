/**
 * RFC-0238 — real adapters for openDemandPanelV2 inside a ThingsBoard dashboard.
 *
 * - `createTbEnvelopeStore`: customer SERVER_SCOPE attributes (audit envelopes only).
 * - `createGcdrReportJobsApi`: GCDR report-jobs API as proposed in RFC-0238 §6 (the backend
 *   does not exist yet — calls fail with the HTTP status the server returns).
 * - `demandDevicesFromItems`: dashboard orchestrator items → DemandDevice, never filling one id
 *   namespace with another (tbId → tbDeviceId, gcdrDeviceId → gcdrDeviceId, ingestionId → ingestionId).
 */
import type {
  AuditEvent,
  BatchResult,
  DemandDevice,
  DemandReportEnvelopeV1,
  EnvelopeStore,
  GcdrJobView,
  PortError,
  ReportJobsApi,
  SubmitCommand,
} from '../../utils/reports/demand';
import { parseEnvelope } from '../../utils/reports/demand';

function portError(status: number, code: string, message: string): PortError & Error {
  return Object.assign(new Error(message), { status, code });
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
    const err = (body as { error?: { code?: string; message?: string }; message?: string }) || {};
    throw portError(res.status, err.error?.code || `HTTP_${res.status}`, err.error?.message || err.message || `HTTP ${res.status}`);
  }
  return body;
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
      const env: DemandReportEnvelopeV1 = { ...parsed.envelope, audit: [...parsed.envelope.audit, event] };
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
  /** Auth headers (e.g. { 'X-API-Key', 'X-Tenant-ID' }) — resolved on every call. */
  getHeaders: () => Record<string, string>;
}

export function createGcdrReportJobsApi(opts: GcdrReportJobsApiOptions): ReportJobsApi {
  const root = `${(opts.baseUrl || '').replace(/\/+$/, '').replace(/\/api\/v1$/, '')}/api/v1/customers/${encodeURIComponent(opts.gcdrCustomerId)}/report-jobs`;
  const h = (json = false) => ({ Accept: 'application/json', ...(json ? { 'Content-Type': 'application/json' } : {}), ...opts.getHeaders() });
  return {
    submit: (cmd: SubmitCommand, o) => request(root, { method: 'POST', headers: h(true), body: JSON.stringify(cmd), signal: o?.signal }) as Promise<GcdrJobView>,
    batchGet: async (jobIds, o) => {
      const body = (await request(`${root}:batchGet`, { method: 'POST', headers: h(true), body: JSON.stringify({ jobIds }), signal: o?.signal })) as { results?: BatchResult[] } | BatchResult[];
      return Array.isArray(body) ? body : body?.results || [];
    },
    active: async (o) => {
      const body = (await request(`${root}?type=demand-report&status=queued,running&limit=50`, { headers: h(), signal: o?.signal })) as { items?: GcdrJobView[] } | GcdrJobView[];
      return Array.isArray(body) ? body : body?.items || [];
    },
    cancel: (jobId, declared, o) =>
      request(`${root}/${encodeURIComponent(jobId)}/cancel`, { method: 'POST', headers: h(true), body: JSON.stringify(declared ? { declaredBy: declared } : {}), signal: o?.signal }) as Promise<GcdrJobView>,
    download: (jobId, o) => request(`${root}/${encodeURIComponent(jobId)}/result`, { headers: h(), signal: o?.signal }),
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
