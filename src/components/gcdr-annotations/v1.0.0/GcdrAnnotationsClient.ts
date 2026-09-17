/**
 * RFC-0218 — GcdrAnnotationsClient: thin, typed client for the GCDR
 * **Annotations API** (`/annotations`, GCDR RFC-0036).
 *
 * One client, shared by every widget surface that today reaches annotations
 * through the TB attribute `log_annotations` — the Repository pattern here
 * mirrors `AlarmApiClient` (route constants + envelope unwrap) and reuses
 * `CustomerDeviceService`'s retry/backoff policy verbatim (max 3, exponential,
 * only on 429/5xx/network — 4xx incl. 409 never retried).
 *
 * `domainPath` is opaque: this client never assembles hosts or API versions —
 * prod/homolog/localhost and a future `/api/v2` are entirely the caller's
 * choice, exactly like `CustomerConfigApiClient` (`services/gcdr/customerConfigApiClient.ts`).
 */
import { createAuthStrategy, type AuthStrategy } from './authStrategies';
import { adaptGcdrListToLegacyAnnotations } from './adapters';
import {
  GcdrAnnotationsConflictError,
  GcdrAnnotationsError,
  type GcdrAnnotation,
  type GcdrAnnotationDetail,
  type GcdrAnnotationListPage,
  type GcdrAnnotationListParams,
  type GcdrAnnotationsClientLogger,
  type GcdrAnnotationsClientParams,
  type GcdrCreateAnnotationInput,
  type GcdrEntityType,
  type GcdrPatchAnnotationInput,
  type GcdrRespondInput,
} from './types';
import type { Annotation } from '../../premium-modals/settings/annotations/types';

/**
 * `RequestInit & { headers?: Record<string,string> }` produces a bad
 * declaration-emit type (TS2322 on dts build) because `RequestInit.headers`
 * is `HeadersInit` (`Headers | string[][] | Record<string,string>`) and
 * intersecting the array-tuple branch with `Record<string,string>` yields an
 * unusable array-like shape. Omitting `headers` first avoids the intersection
 * entirely — this client only ever sends a plain string map.
 */
type RequestInitWithHeaders = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };

const DEFAULT_MAX_PAGES = 50;
const DEFAULT_LIMIT = 100;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 500;

interface CacheEntry {
  at: number;
  value: unknown;
}

function normalizeDomainPath(domainPath: string): string {
  return String(domainPath).replace(/\/+$/, '');
}

function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name ?? '';
  const message = String((err as { message?: string }).message ?? '').toLowerCase();
  return name === 'TypeError' || message.includes('network') || message.includes('failed to fetch');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GcdrAnnotationsClient {
  private readonly domainPath: string;
  private readonly authStrategy: AuthStrategy;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: GcdrAnnotationsClientLogger;
  private readonly cacheTtlMs: number;
  private readonly maxPages: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(params: GcdrAnnotationsClientParams) {
    if (!params || !params.domainPath) {
      throw new Error('GcdrAnnotationsClient requires a domainPath.');
    }
    this.domainPath = normalizeDomainPath(params.domainPath);
    this.authStrategy = createAuthStrategy(params.auth);
    const injected = params.fetchImpl || (globalThis.fetch as typeof fetch | undefined);
    if (typeof injected !== 'function') {
      throw new Error('GcdrAnnotationsClient requires a fetch implementation.');
    }
    this.fetchImpl = params.fetchImpl ? params.fetchImpl : injected.bind(globalThis);
    this.logger = params.logger ?? console;
    this.cacheTtlMs = params.cacheTtlMs ?? 0;
    this.maxPages = params.maxPages ?? DEFAULT_MAX_PAGES;
  }

  /** Drops every cached GET response. Called automatically after any write. */
  invalidate(): void {
    this.cache.clear();
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  /** One page of `GET /annotations` with the given filters. */
  async list(params: GcdrAnnotationListParams = {}): Promise<GcdrAnnotationListPage> {
    const query = new URLSearchParams();
    if (params.customerId) query.set('customerId', params.customerId);
    if (params.entityType) query.set('entityType', params.entityType);
    if (params.entityId) query.set('entityId', params.entityId);
    if (params.type) query.set('type', params.type);
    if (params.status) query.set('status', params.status);
    if (params.importance !== undefined) query.set('importance', String(params.importance));
    if (params.includeArchived !== undefined) query.set('includeArchived', String(params.includeArchived));
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? DEFAULT_LIMIT));

    const raw = await this._requestJson<unknown>(`/annotations?${query.toString()}`, { method: 'GET' });
    return this._toListPage(raw, params.page ?? 1, params.limit ?? DEFAULT_LIMIT);
  }

  /** Every annotation of a customer, aggregated across as many pages as it takes (capped at `maxPages`). */
  async listByCustomer(
    customerId: string,
    params: Omit<GcdrAnnotationListParams, 'customerId'> = {}
  ): Promise<GcdrAnnotation[]> {
    return this._listAll({ ...params, customerId });
  }

  /** Every annotation attached to one entity (e.g. a device, or a central identified by its GCDR UUID). */
  async listByEntity(
    entityType: GcdrEntityType,
    entityId: string,
    params: Omit<GcdrAnnotationListParams, 'entityType' | 'entityId'> = {}
  ): Promise<GcdrAnnotation[]> {
    return this._listAll({ ...params, entityType, entityId });
  }

  /** Full detail — responses, events (audit trail), mentions, attachments. */
  async getById(id: string): Promise<GcdrAnnotationDetail> {
    const raw = await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}`, { method: 'GET' });
    return this._unwrap<GcdrAnnotationDetail>(raw);
  }

  /** Convenience bridge — same `Annotation[]` shape `AnnotationsTab`/orchestrators already consume. */
  toLegacyAnnotations(list: GcdrAnnotation[]): Annotation[] {
    return adaptGcdrListToLegacyAnnotations(list);
  }

  // ── Writes ─────────────────────────────────────────────────────────────

  async create(input: GcdrCreateAnnotationInput): Promise<GcdrAnnotation> {
    const raw = await this._requestJson<unknown>('/annotations', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    this.invalidate();
    return this._unwrap<GcdrAnnotation>(raw);
  }

  /** Optimistic lock via `If-Match: "<version>"` — a stale version raises `GcdrAnnotationsConflictError`. */
  async patch(id: string, changes: GcdrPatchAnnotationInput, version: number): Promise<GcdrAnnotation> {
    const raw = await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
      headers: { 'If-Match': `"${version}"` },
    });
    this.invalidate();
    return this._unwrap<GcdrAnnotation>(raw);
  }

  async archive(id: string, version: number): Promise<GcdrAnnotation> {
    const raw = await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      headers: { 'If-Match': `"${version}"` },
    });
    this.invalidate();
    return this._unwrap<GcdrAnnotation>(raw);
  }

  /**
   * Posts a response (comment/approve/reject/archive). `text` is required for
   * every type except `approved` — mirrored client-side so a caller gets an
   * immediate, local error instead of a round trip (API guide §5 rule).
   */
  async respond(id: string, input: GcdrRespondInput): Promise<GcdrAnnotation> {
    if (input.type !== 'approved' && !input.text) {
      throw new GcdrAnnotationsError(400, `respond(): 'text' is required for response type '${input.type}'.`);
    }
    const raw = await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}/responses`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    this.invalidate();
    return this._unwrap<GcdrAnnotation>(raw);
  }

  async mention(id: string, userId: string): Promise<void> {
    await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}/mentions`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    this.invalidate();
  }

  async attach(id: string, attachment: { fileName: string; url: string }): Promise<void> {
    await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}/attachments`, {
      method: 'POST',
      body: JSON.stringify(attachment),
    });
    this.invalidate();
  }

  async detach(id: string, attachmentId: string): Promise<void> {
    await this._requestJson<unknown>(
      `/annotations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
      { method: 'DELETE' }
    );
    this.invalidate();
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async _listAll(params: GcdrAnnotationListParams): Promise<GcdrAnnotation[]> {
    const limit = params.limit ?? DEFAULT_LIMIT;
    const out: GcdrAnnotation[] = [];
    for (let page = 1; page <= this.maxPages; page++) {
      const result = await this.list({ ...params, page, limit });
      out.push(...result.items);
      if (!result.pagination.hasNext) return out;
      if (page === this.maxPages) {
        this.logger.warn(
          `[GcdrAnnotationsClient] hit hard page cap of ${this.maxPages} — some annotations may be missing.`
        );
      }
    }
    return out;
  }

  private _toListPage(raw: unknown, page: number, limit: number): GcdrAnnotationListPage {
    const body = raw as { data?: unknown; pagination?: GcdrAnnotationListPage['pagination'] } | unknown[] | null;
    if (Array.isArray(body)) {
      return { items: body as GcdrAnnotation[], pagination: { page, limit, hasNext: false } };
    }
    const items = Array.isArray((body as { data?: unknown })?.data)
      ? ((body as { data: unknown[] }).data as GcdrAnnotation[])
      : [];
    const pagination = (body as { pagination?: GcdrAnnotationListPage['pagination'] })?.pagination ?? {
      page,
      limit,
      hasNext: items.length >= limit,
    };
    return { items, pagination };
  }

  /** Unwraps the `{success, data}` envelope; tolerates an already-flat body (test doubles, future API versions). */
  private _unwrap<T>(raw: unknown): T {
    const envelope = raw as { data?: unknown } | null;
    if (envelope && typeof envelope === 'object' && 'data' in envelope) {
      return envelope.data as T;
    }
    return raw as T;
  }

  private async _requestJson<T>(path: string, init: RequestInitWithHeaders): Promise<T> {
    const url = `${this.domainPath}${path.startsWith('/') ? path : `/${path}`}`;
    const method = init.method ?? 'GET';
    const cacheKey = `${method}::${url}`;

    if (method === 'GET' && this.cacheTtlMs > 0) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.at < this.cacheTtlMs) {
        return cached.value as T;
      }
    }

    const result = await this._doRequest<T>(url, init);

    if (method === 'GET' && this.cacheTtlMs > 0) {
      this.cache.set(cacheKey, { at: Date.now(), value: result });
    }
    return result;
  }

  private async _doRequest<T>(url: string, init: RequestInitWithHeaders): Promise<T> {
    let attempt = 0;

    while (true) {
      const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers || {}) };
      if (init.body !== undefined) headers['Content-Type'] = 'application/json';
      await this.authStrategy.apply(headers);

      try {
        const res = await this.fetchImpl(url, { ...init, headers });

        if ((res.status === 429 || res.status >= 500) && attempt < DEFAULT_MAX_RETRIES) {
          const backoffMs = DEFAULT_RETRY_BASE_MS * Math.pow(2, attempt);
          this.logger.warn(
            `[GcdrAnnotationsClient] ${res.status} on ${url} — retry ${attempt + 1}/${DEFAULT_MAX_RETRIES} in ${backoffMs}ms`
          );
          attempt++;
          await sleep(backoffMs);
          continue;
        }

        const body = await this._readBody(res);

        if (res.status === 409) {
          const err = body && (body as { error?: { message?: string } }).error;
          throw new GcdrAnnotationsConflictError(err?.message || res.statusText);
        }

        if (!res.ok) {
          const err = body && (body as { error?: { message?: string; code?: string } }).error;
          throw new GcdrAnnotationsError(res.status, err?.message || res.statusText, err?.code);
        }

        return body as T;
      } catch (err) {
        if (err instanceof GcdrAnnotationsError) throw err;
        if (isNetworkError(err) && attempt < DEFAULT_MAX_RETRIES) {
          const backoffMs = DEFAULT_RETRY_BASE_MS * Math.pow(2, attempt);
          this.logger.warn(
            `[GcdrAnnotationsClient] network error on ${url} — retry ${attempt + 1}/${DEFAULT_MAX_RETRIES} in ${backoffMs}ms`
          );
          attempt++;
          await sleep(backoffMs);
          continue;
        }
        throw new GcdrAnnotationsError(0, err instanceof Error ? err.message : 'network error');
      }
    }
  }

  private async _readBody(res: Response): Promise<unknown> {
    try {
      const text = await res.text();
      if (!text) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}

/** Cached GET note: only `list()` (and therefore `listByCustomer`/`listByEntity`) is cached; writes always invalidate. */
export function createGcdrAnnotationsClient(params: GcdrAnnotationsClientParams): GcdrAnnotationsClient {
  return new GcdrAnnotationsClient(params);
}
