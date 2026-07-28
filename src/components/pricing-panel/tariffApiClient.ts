/**
 * RFC-0228 A1 — Thin, typed client for the GCDR **hourly tariff** API
 * (RFC-0054; contract in `gcdr.git/docs/api/API-Financial-Goals.md`, frozen).
 *
 * Four endpoints, customer-scoped, base path `/api/v1`:
 *   GET    /customers/:id/tariffs?domain=&category=&year=&granularity=
 *   PUT    /customers/:id/tariffs?domain=&category=&year=      (REPLACE year)
 *   PATCH  /customers/:id/tariffs?domain=&category=&year=      (MERGE buckets)
 *   DELETE /customers/:id/tariffs?domain=&category=&year=      (year or sub-bucket)
 *
 * Design rules for this layer:
 *  - **Pure / framework-agnostic.** No DOM, no ThingsBoard. `fetch` is injected
 *    (defaults to `globalThis.fetch`) so it is unit-testable with a mock.
 *  - **Speaks the wire language only** — WIRE domains (`ENERGY`/`WATER`) and WIRE
 *    categories (`COMMON_AREA`/`SPECIFIC`). The panel↔wire mapping lives in the
 *    adapter, never here.
 *  - **Never converts prices to `Number`.** Prices are decimal strings end to end
 *    (`"2.000000"`), preserved verbatim.
 *  - **Optimistic concurrency.** Reads/writes surface `version` (body + `ETag`).
 *    Writes send the guard via `If-Match: "<v>"` header AND body `expectedVersion`
 *    (equal values — the contract requires equality when both are present).
 *  - **Errors surface the stable `code`, never the message** (see §7 taxonomy).
 */

/** WIRE domain (RFC-0054 §3). */
export type WireDomain = 'ENERGY' | 'WATER';
/** WIRE tariff category (RFC-0054 §3). */
export type WireCategory = 'COMMON_AREA' | 'SPECIFIC';
/** Tariff granularity for reads. `day` is the API default. */
export type TariffGranularity = 'year' | 'month' | 'day' | 'hour';

/** One node in the returned price tree. Price is a decimal STRING. */
export interface TariffTreeNode {
  price?: string;
  sourceLevel?: 'YEAR' | 'MONTH' | 'DAY' | 'HOUR';
  derived?: boolean;
  /** Hour override map (key = hour, e.g. `"15"`). */
  hourly?: Record<string, TariffTreeNode>;
  /** Day override map (key = `"MM-DD"` at day granularity, or `"DD"` when nested). */
  daily?: Record<string, TariffTreeNode>;
  /** Month override map (key = `"MM"`). */
  monthly?: Record<string, TariffTreeNode>;
  /** Annual node. */
  annual?: TariffTreeNode;
  value?: unknown;
}

/** Full tariff-read response (RFC-0054 §4.1). */
export interface TariffTreeResponse {
  customerId: string;
  domain: WireDomain;
  category: WireCategory;
  year: number;
  unit?: string;
  currency?: string;
  tariffModel?: string;
  timezone?: string;
  /** Optimistic-concurrency counter. `0` for an empty (never-set) tariff. */
  version: number;
  /** Nested price tree. Empty object for an empty tariff. */
  tree: TariffTreeNode;
}

/** A sparse merge bucket for PATCH (RFC-0054 §5.2). Price is a decimal STRING. */
export interface TariffBucket {
  level: 'DAY' | 'HOUR';
  /** `YYYY-MM-DD` for DAY, `YYYY-MM-DDTHH` for HOUR. */
  ref: string;
  price: string;
}

/** Selects a single `(customer × domain × category × year)` tariff. */
export interface TariffSelector {
  customerId: string;
  domain: WireDomain;
  category: WireCategory;
  year: number;
}

/** Client configuration. Auth is `apiKey` (X-API-Key) OR `jwt` (Bearer). */
export interface TariffApiClientConfig {
  /** API origin, e.g. `https://gcdr-api.a.myio-bas.com`. `/api/v1` is appended. */
  baseUrl: string;
  /** Customer API Key (`gcdr_cust_…`) → `X-API-Key`. */
  apiKey?: string;
  /** JWT → `Authorization: Bearer`. */
  jwt?: string;
  /** Optional tenant hint forwarded as `X-Tenant-Id`. */
  tenantId?: string;
  /** Injectable fetch (defaults to `globalThis.fetch`). */
  fetchImpl?: typeof fetch;
  /** Base path segment. Defaults to `/api/v1`. */
  basePath?: string;
}

/**
 * Structured tariff API failure. Callers switch on `.code` (stable), never on
 * the human message. `currentVersion` is lifted from `details` for 409s so a
 * version conflict can be surfaced without digging.
 */
export class TariffApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly currentVersion?: number;

  constructor(
    code: string,
    status: number,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(message || code);
    this.name = 'TariffApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    const cv = details && (details as { currentVersion?: unknown }).currentVersion;
    this.currentVersion = typeof cv === 'number' ? cv : undefined;
  }
}

function joinUrl(baseUrl: string, basePath: string, path: string): string {
  const b = baseUrl.replace(/\/+$/, '');
  const bp = basePath ? `/${basePath.replace(/^\/+|\/+$/g, '')}` : '';
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${bp}${p}`;
}

function tariffQuery(sel: TariffSelector, granularity?: TariffGranularity): string {
  const qs = new URLSearchParams();
  qs.set('domain', sel.domain);
  qs.set('category', sel.category);
  qs.set('year', String(sel.year));
  if (granularity) qs.set('granularity', granularity);
  return qs.toString();
}

/** Parse a strong ETag (`"7"`) into a number, if present. */
function parseETagVersion(headers: Headers): number | undefined {
  const raw = headers.get('ETag') || headers.get('etag');
  if (!raw) return undefined;
  const m = /"?(-?\d+)"?/.exec(raw);
  return m ? Number(m[1]) : undefined;
}

export class TariffApiClient {
  private readonly cfg: TariffApiClientConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly basePath: string;

  constructor(config: TariffApiClientConfig) {
    if (!config || !config.baseUrl) {
      throw new Error('TariffApiClient requires a baseUrl.');
    }
    this.cfg = config;
    const injected = config.fetchImpl || (globalThis.fetch as typeof fetch | undefined);
    if (typeof injected !== 'function') {
      throw new Error('TariffApiClient requires a fetch implementation.');
    }
    // Preserve the correct `this` when calling a global fetch.
    this.fetchImpl = config.fetchImpl ? config.fetchImpl : injected.bind(globalThis);
    this.basePath = config.basePath ?? 'api/v1';
  }

  private authHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.cfg.apiKey) h['X-API-Key'] = this.cfg.apiKey;
    if (this.cfg.jwt) h['Authorization'] = `Bearer ${this.cfg.jwt}`;
    if (this.cfg.tenantId) h['X-Tenant-Id'] = this.cfg.tenantId;
    return h;
  }

  /** Read the tariff tree. `granularity` defaults to `day` server-side. */
  async getTariff(
    sel: TariffSelector,
    granularity: TariffGranularity = 'hour'
  ): Promise<TariffTreeResponse> {
    const url = joinUrl(
      this.cfg.baseUrl,
      this.basePath,
      `/customers/${encodeURIComponent(sel.customerId)}/tariffs?${tariffQuery(sel, granularity)}`
    );
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...this.authHeaders() },
    });
    const body = await this.readBody(res);
    if (!res.ok) throw this.toError(res, body);
    const etagVersion = parseETagVersion(res.headers);
    const parsed = (body || {}) as Partial<TariffTreeResponse>;
    return {
      customerId: sel.customerId,
      domain: sel.domain,
      category: sel.category,
      year: sel.year,
      unit: parsed.unit,
      currency: parsed.currency,
      tariffModel: parsed.tariffModel,
      timezone: parsed.timezone,
      version: typeof parsed.version === 'number' ? parsed.version : (etagVersion ?? 0),
      tree: parsed.tree || {},
    };
  }

  /** REPLACE the whole year with a nested price tree. */
  async putTariff(
    sel: TariffSelector,
    tree: TariffTreeNode,
    expectedVersion?: number
  ): Promise<{ version: number }> {
    return this.write('PUT', sel, { ...tree, ...guardBody(expectedVersion) }, expectedVersion);
  }

  /** MERGE sparse buckets into the year (finest level wins). */
  async patchTariff(
    sel: TariffSelector,
    buckets: TariffBucket[],
    expectedVersion?: number
  ): Promise<{ version: number }> {
    return this.write('PATCH', sel, { buckets, ...guardBody(expectedVersion) }, expectedVersion);
  }

  /**
   * DELETE the whole year (no `bucket`) or one sub-bucket (`bucket` present).
   * Whole-year delete is idempotent (204 even if absent).
   */
  async deleteTariff(
    sel: TariffSelector,
    opts: { bucket?: { level: 'DAY' | 'HOUR'; ref: string }; expectedVersion?: number } = {}
  ): Promise<{ version?: number }> {
    const hasBody = Boolean(opts.bucket) || typeof opts.expectedVersion === 'number';
    const url = joinUrl(
      this.cfg.baseUrl,
      this.basePath,
      `/customers/${encodeURIComponent(sel.customerId)}/tariffs?${tariffQuery(sel)}`
    );
    const headers: Record<string, string> = { Accept: 'application/json', ...this.authHeaders() };
    if (typeof opts.expectedVersion === 'number') headers['If-Match'] = `"${opts.expectedVersion}"`;
    const init: RequestInit = { method: 'DELETE', headers };
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify({
        ...(opts.bucket ? { bucket: opts.bucket } : {}),
        ...guardBody(opts.expectedVersion),
      });
    }
    const res = await this.fetchImpl(url, init);
    if (res.status === 204) return {};
    const body = await this.readBody(res);
    if (!res.ok) throw this.toError(res, body);
    const etagVersion = parseETagVersion(res.headers);
    const v = (body && (body as { version?: unknown }).version) ?? etagVersion;
    return typeof v === 'number' ? { version: v } : {};
  }

  private async write(
    method: 'PUT' | 'PATCH',
    sel: TariffSelector,
    body: unknown,
    expectedVersion?: number
  ): Promise<{ version: number }> {
    const url = joinUrl(
      this.cfg.baseUrl,
      this.basePath,
      `/customers/${encodeURIComponent(sel.customerId)}/tariffs?${tariffQuery(sel)}`
    );
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...this.authHeaders(),
    };
    if (typeof expectedVersion === 'number') headers['If-Match'] = `"${expectedVersion}"`;
    const res = await this.fetchImpl(url, { method, headers, body: JSON.stringify(body) });
    const parsed = await this.readBody(res);
    if (!res.ok) throw this.toError(res, parsed);
    const etagVersion = parseETagVersion(res.headers);
    const v = (parsed && (parsed as { version?: unknown }).version) ?? etagVersion;
    return { version: typeof v === 'number' ? v : (expectedVersion ?? 0) + 1 };
  }

  private async readBody(res: Response): Promise<unknown> {
    try {
      const text = await res.text();
      if (!text) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private toError(res: Response, body: unknown): TariffApiError {
    const err = body && (body as { error?: unknown }).error;
    if (err && typeof err === 'object') {
      const e = err as { code?: string; message?: string; details?: Record<string, unknown> };
      return new TariffApiError(
        e.code || `HTTP_${res.status}`,
        res.status,
        e.message,
        e.details
      );
    }
    return new TariffApiError(`HTTP_${res.status}`, res.status, res.statusText);
  }
}

/** Body fragment carrying the optimistic-concurrency guard. */
function guardBody(expectedVersion?: number): { expectedVersion?: number } {
  return typeof expectedVersion === 'number' ? { expectedVersion } : {};
}

/** Convenience factory. */
export function createTariffApiClient(config: TariffApiClientConfig): TariffApiClient {
  return new TariffApiClient(config);
}
