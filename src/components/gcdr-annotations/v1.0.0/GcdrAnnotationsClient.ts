/**
 * RFC-0218 — GcdrAnnotationsClient.
 *
 * Single data-access layer for the GCDR Annotations API (`/annotations`,
 * RFC-0036 / openapi.yaml tag `Annotations`). Repository pattern: one place
 * that knows routes, envelopes, pagination and retry — mirrors
 * `AlarmApiClient` (src/services/alarm/AlarmApiClient.ts), the existing
 * GCDR client template, while reusing the exact retry/backoff policy from
 * `CustomerDeviceService._requestJson`
 * (src/services/annotations/CustomerDeviceService.ts:228-264).
 */

import { buildAuthStrategy, type AuthStrategy } from './authStrategies';
import { adaptGcdrToLegacyAnnotation } from './adapters';
import {
  ConflictError,
  GcdrAnnotationsError,
  ValidationError,
  type CreateAnnotationInput,
  type CreateAttachmentInput,
  type CreateMentionInput,
  type CreateResponseInput,
  type GcdrAnnotation,
  type GcdrAnnotationAttachment,
  type GcdrAnnotationDetail,
  type GcdrAnnotationMention,
  type GcdrAnnotationResponse,
  type GcdrAnnotationsClientParams,
  type GcdrEntityType,
  type GcdrPagination,
  type LegacyAnnotation,
  type ListAnnotationsParams,
  type PatchAnnotationInput,
} from './types';

type SimpleLogger = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_PAGES = 50;
const DEFAULT_LIST_LIMIT = 100;

function normalizeLogger(raw?: Partial<SimpleLogger>): SimpleLogger {
  const noop = (): void => {
    /* no-op */
  };
  return {
    log: raw?.log ?? noop,
    warn: raw?.warn ?? noop,
    error: raw?.error ?? noop,
  };
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

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

export class GcdrAnnotationsClient {
  private readonly domainPath: string;
  private readonly tenantId: string;
  private readonly authStrategy: AuthStrategy;
  private readonly cacheTtlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly logger: SimpleLogger;
  private readonly maxRetries: number;
  private readonly maxPages: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(params: GcdrAnnotationsClientParams) {
    if (!params.domainPath) {
      throw new Error('GcdrAnnotationsClient: domainPath is required');
    }
    if (!params.tenantId) {
      throw new Error('GcdrAnnotationsClient: tenantId is required (sent as the x-tenant-id header)');
    }
    // Only trailing slashes are normalized — host/version are the caller's choice.
    this.domainPath = params.domainPath.replace(/\/+$/, '');
    this.tenantId = params.tenantId;
    this.authStrategy = buildAuthStrategy(params.auth);
    this.cacheTtlMs = params.cacheTtlMs ?? 0;
    this.fetchImpl = params.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.logger = normalizeLogger(params.logger);
    this.maxRetries = params.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.maxPages = params.maxPages ?? DEFAULT_MAX_PAGES;
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  /** One page of `GET /annotations`. Callers that want everything should use listByCustomer/listByEntity. */
  async list(filters: ListAnnotationsParams = {}): Promise<{ items: GcdrAnnotation[]; pagination: GcdrPagination }> {
    const query = new URLSearchParams();
    if (filters.entityType) query.set('entityType', filters.entityType);
    if (filters.entityId) query.set('entityId', filters.entityId);
    if (filters.customerId) query.set('customerId', filters.customerId);
    if (filters.type) query.set('type', filters.type);
    if (filters.status) query.set('status', filters.status);
    if (filters.importance !== undefined) query.set('importance', String(filters.importance));
    if (filters.mentionedUserId) query.set('mentionedUserId', filters.mentionedUserId);
    if (filters.mentionedDeviceId) query.set('mentionedDeviceId', filters.mentionedDeviceId);
    if (filters.hasAttachments !== undefined) query.set('hasAttachments', String(filters.hasAttachments));
    if (filters.includeArchived !== undefined) query.set('includeArchived', String(filters.includeArchived));
    if (filters.limit !== undefined) query.set('limit', String(filters.limit));
    if (filters.cursor) query.set('cursor', filters.cursor);

    const qs = query.toString();
    const raw = await this._requestJson<unknown>(`/annotations${qs ? `?${qs}` : ''}`);
    const data = this._unwrapEnvelope<{ items?: unknown; pagination?: Partial<GcdrPagination> }>(raw);

    const items: GcdrAnnotation[] = Array.isArray((data as { items?: unknown })?.items)
      ? ((data as { items: GcdrAnnotation[] }).items)
      : Array.isArray(data)
        ? (data as unknown as GcdrAnnotation[])
        : [];

    const rawPagination = (data as { pagination?: Partial<GcdrPagination> })?.pagination;
    const pagination: GcdrPagination = {
      total: rawPagination?.total ?? null,
      totalPages: rawPagination?.totalPages ?? null,
      hasMore: rawPagination?.hasMore ?? false,
      nextCursor: rawPagination?.nextCursor ?? null,
    };

    return { items, pagination };
  }

  /** Every annotation of a customer in one paginated sweep — the migration call. */
  async listByCustomer(
    customerId: string,
    opts: Omit<ListAnnotationsParams, 'customerId' | 'entityType' | 'entityId' | 'limit' | 'cursor'> = {}
  ): Promise<GcdrAnnotation[]> {
    return this._listAll({ ...opts, customerId });
  }

  /** Every annotation of one polymorphic target (e.g. a device). */
  async listByEntity(
    entityType: GcdrEntityType,
    entityId: string,
    opts: Omit<ListAnnotationsParams, 'entityType' | 'entityId' | 'limit' | 'cursor'> = {}
  ): Promise<GcdrAnnotation[]> {
    return this._listAll({ ...opts, entityType, entityId });
  }

  async getById(id: string): Promise<GcdrAnnotationDetail> {
    const raw = await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}`);
    return this._unwrapEnvelope<GcdrAnnotationDetail>(raw);
  }

  // ── Writes ─────────────────────────────────────────────────────────────

  async create(input: CreateAnnotationInput): Promise<GcdrAnnotationDetail> {
    const raw = await this._requestJson<unknown>('/annotations', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    this.invalidate();
    return this._unwrapEnvelope<GcdrAnnotationDetail>(raw);
  }

  /** `expectedVersion` (or `changes.version`) is sent as `If-Match`, never in the body. */
  async patch(id: string, changes: PatchAnnotationInput, expectedVersion?: number): Promise<GcdrAnnotationDetail> {
    const version = expectedVersion ?? changes.version;
    const { version: _omit, ...body } = changes;
    void _omit;
    const headers: Record<string, string> = {};
    if (version !== undefined) headers['If-Match'] = String(version);

    const raw = await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    this.invalidate();
    return this._unwrapEnvelope<GcdrAnnotationDetail>(raw);
  }

  async archive(id: string, expectedVersion?: number): Promise<GcdrAnnotationDetail> {
    const headers: Record<string, string> = {};
    if (expectedVersion !== undefined) headers['If-Match'] = String(expectedVersion);

    const raw = await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      headers,
    });
    this.invalidate();
    return this._unwrapEnvelope<GcdrAnnotationDetail>(raw);
  }

  /** `text` is required for every response type except `approved` (mirrors the API's own rule, checked locally first). */
  async respond(id: string, input: CreateResponseInput): Promise<GcdrAnnotationResponse> {
    if (input.type !== 'approved' && !input.text) {
      throw new ValidationError(`respond(): "text" is required for response type "${input.type}"`);
    }
    const raw = await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}/responses`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    this.invalidate();
    return this._unwrapEnvelope<GcdrAnnotationResponse>(raw);
  }

  async mention(id: string, input: CreateMentionInput): Promise<GcdrAnnotationMention> {
    const raw = await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}/mentions`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    this.invalidate();
    return this._unwrapEnvelope<GcdrAnnotationMention>(raw);
  }

  async attach(id: string, input: CreateAttachmentInput): Promise<GcdrAnnotationAttachment> {
    const raw = await this._requestJson<unknown>(`/annotations/${encodeURIComponent(id)}/attachments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    this.invalidate();
    return this._unwrapEnvelope<GcdrAnnotationAttachment>(raw);
  }

  async detach(id: string, attachmentId: string): Promise<void> {
    await this._requestJson<void>(
      `/annotations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
      { method: 'DELETE' }
    );
    this.invalidate();
  }

  // ── Legacy bridge ──────────────────────────────────────────────────────

  /** Same shape the widgets/badges already consume (RFC-0104 Annotation[]). */
  toLegacyAnnotations(list: Array<GcdrAnnotation | GcdrAnnotationDetail>): LegacyAnnotation[] {
    return list.map(adaptGcdrToLegacyAnnotation);
  }

  /** Drops the GET cache. Called automatically after every write; exposed for external invalidation (e.g. `myio:annotation-changed`). */
  invalidate(): void {
    this.cache.clear();
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private async _listAll(filters: ListAnnotationsParams): Promise<GcdrAnnotation[]> {
    const items: GcdrAnnotation[] = [];
    let cursor: string | undefined = filters.cursor;
    let page = 0;

    while (page < this.maxPages) {
      const result = await this.list({ ...filters, limit: filters.limit ?? DEFAULT_LIST_LIMIT, cursor });
      items.push(...result.items);
      page++;
      if (!result.pagination.hasMore || !result.pagination.nextCursor) return items;
      cursor = result.pagination.nextCursor;
    }

    this.logger.warn(
      `[GcdrAnnotationsClient] pagination hard cap (${this.maxPages} pages) reached — results may be truncated`
    );
    return items;
  }

  private _unwrapEnvelope<T>(raw: unknown): T {
    if (raw !== null && typeof raw === 'object' && 'data' in (raw as Record<string, unknown>)) {
      return (raw as { data: T }).data;
    }
    return raw as T;
  }

  private async _requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.domainPath}${path}`;
    const method = (options.method ?? 'GET').toUpperCase();
    const cacheable = this.cacheTtlMs > 0 && method === 'GET';

    if (cacheable) {
      const cached = this._cacheGet(url);
      if (cached !== undefined) return cached as T;
    }

    const authHeaders: Record<string, string> = {};
    await this.authStrategy.apply(authHeaders);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': this.tenantId,
      ...authHeaders,
      ...(options.headers as Record<string, string> | undefined),
    };

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, { ...options, method, headers });
      } catch (err) {
        if (attempt < this.maxRetries && isNetworkError(err)) {
          const backoffMs = 2 ** attempt * 1000;
          this.logger.warn(
            `[GcdrAnnotationsClient] network error on ${url} — retry ${attempt + 1}/${this.maxRetries} in ${backoffMs}ms`
          );
          attempt++;
          await sleep(backoffMs);
          continue;
        }
        throw err;
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt < this.maxRetries) {
          const backoffMs = 2 ** attempt * 1000;
          this.logger.warn(
            `[GcdrAnnotationsClient] ${res.status} on ${url} — retry ${attempt + 1}/${this.maxRetries} in ${backoffMs}ms`
          );
          attempt++;
          await sleep(backoffMs);
          continue;
        }
      }

      if (!res.ok) {
        throw await this._buildError(res);
      }

      const value = await this._parseBody<T>(res);
      if (cacheable) this._cacheSet(url, value);
      return value;
    }
  }

  private async _parseBody<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  private async _buildError(res: Response): Promise<GcdrAnnotationsError> {
    let code = 'UNKNOWN';
    let message = `GCDR annotations API error: ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.message) message = body.error.message;
    } catch {
      // Non-JSON error body — keep the default message.
    }
    if (res.status === 409) return new ConflictError(message, code);
    return new GcdrAnnotationsError(res.status, code, message);
  }

  private _cacheGet(key: string): unknown {
    const hit = this.cache.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return hit.value;
  }

  private _cacheSet(key: string, value: unknown): void {
    this.cache.set(key, { expiresAt: Date.now() + this.cacheTtlMs, value });
  }
}

export function createGcdrAnnotationsClient(params: GcdrAnnotationsClientParams): GcdrAnnotationsClient {
  return new GcdrAnnotationsClient(params);
}
