/**
 * RFC-0229 §3.4 — Thin, typed client for the GCDR **customer-config** document
 * (backend: RFC-0057, `gcdr.git/docs/rfcs/RFC-0057-Customer-Config-Document.md`).
 *
 * One endpoint for now, customer-scoped, base path `/api/v1`:
 *   GET /customers/:id/config
 *
 * Design rules for this layer (mirrors `../../components/pricing-panel/tariffApiClient.ts`,
 * RFC-0228's GCDR client):
 *  - **Pure / framework-agnostic.** No DOM, no ThingsBoard. `fetch` is injected
 *    (defaults to `globalThis.fetch`) so it is unit-testable with a mock.
 *  - **Read-only.** This subtask (ED-1149) only dual-reads; writes stay on the
 *    TB Server Scope / Appearance side until each field is separately validated.
 *
 * `loadCustomerConfig()` is the shared dual-read entry point every future
 * Group-A subtask calls — it fetches the whole document once (cached, short
 * TTL, de-duped) and NEVER throws, so callers do one-line reads:
 *   const enabled = (await loadCustomerConfig(cfg))?.alarms?.notificationsEnabled;
 */

/** `alarms` section of the customer-config read model (RFC-0057 DEC-4/DEC-5). */
export interface CustomerAlarmsConfig {
  notificationsEnabled?: boolean;
  showOffline?: boolean;
  showInternalSupport?: boolean;
}

/**
 * Normalized customer-config read model. Deliberately loose/partial — only
 * `alarms` is modeled today; future Group-A subtasks extend this interface as
 * they add fields, one at a time, per RFC-0229.
 */
export interface CustomerConfigReadModel {
  alarms?: CustomerAlarmsConfig;
  [key: string]: unknown;
}

/** Client configuration. Auth is `apiKey` (X-API-Key) OR `jwt` (Bearer). */
export interface CustomerConfigApiClientConfig {
  /** API origin, e.g. `https://gcdr-api.a.myio-bas.com` (with or without a trailing `/api/v1`). */
  baseUrl: string;
  /** Customer API Key (`gcdr_cust_…`) → `X-API-Key`. */
  apiKey?: string;
  /** JWT → `Authorization: Bearer`. */
  jwt?: string;
  /** Optional tenant hint forwarded as `X-Tenant-Id`. */
  tenantId?: string;
  /** Injectable fetch (defaults to `globalThis.fetch`). */
  fetchImpl?: typeof fetch;
  /** Request timeout in ms. Default 5000 — a hung GCDR call must not stall widget bootstrap. */
  timeoutMs?: number;
}

/** Structured customer-config API failure. */
export class CustomerConfigApiError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message || `HTTP_${status}`);
    this.name = 'CustomerConfigApiError';
    this.status = status;
  }
}

/**
 * Joins `baseUrl` + `/api/v1` + `path`, tolerating a `baseUrl` that already
 * ends in `/api/v1` (this widget's `gcdrApiBaseUrl` setting default does;
 * its hardcoded fallback doesn't — see `_fetchGoalsFromGCDR` in
 * MAIN_VIEW/controller.js for the same normalization). Without this, a
 * baseUrl carrying the suffix produces a silent `/api/v1/api/v1/...` 404,
 * which this client's fail-open caller would swallow unnoticed.
 */
function joinUrl(baseUrl: string, path: string): string {
  const root = String(baseUrl).replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${root}/api/v1${p}`;
}

export class CustomerConfigApiClient {
  private readonly cfg: CustomerConfigApiClientConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CustomerConfigApiClientConfig) {
    if (!config || !config.baseUrl) {
      throw new Error('CustomerConfigApiClient requires a baseUrl.');
    }
    this.cfg = config;
    const injected = config.fetchImpl || (globalThis.fetch as typeof fetch | undefined);
    if (typeof injected !== 'function') {
      throw new Error('CustomerConfigApiClient requires a fetch implementation.');
    }
    this.fetchImpl = config.fetchImpl ? config.fetchImpl : injected.bind(globalThis);
  }

  private authHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.cfg.apiKey) h['X-API-Key'] = this.cfg.apiKey;
    if (this.cfg.jwt) h['Authorization'] = `Bearer ${this.cfg.jwt}`;
    if (this.cfg.tenantId) h['X-Tenant-Id'] = this.cfg.tenantId;
    return h;
  }

  /** Read the customer-config document. Throws `CustomerConfigApiError` on failure. */
  async getConfig(customerId: string): Promise<CustomerConfigReadModel> {
    const url = joinUrl(this.cfg.baseUrl, `/customers/${encodeURIComponent(customerId)}/config`);
    const timeoutMs = this.cfg.timeoutMs ?? 5000;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json', ...this.authHeaders() },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new CustomerConfigApiError(0, err instanceof Error ? err.message : 'network error');
    }
    const body = await this.readBody(res);
    if (!res.ok) {
      const err = body && (body as { error?: { message?: string } }).error;
      throw new CustomerConfigApiError(res.status, err?.message || res.statusText);
    }
    // GCDR wraps every response as { success, data, meta } (sendSuccess,
    // gcdr/src/middleware/response.ts) — the read model itself lives at .data.
    // Fall back to the raw body when .data is absent (defensive, and keeps
    // this client usable against a hypothetical unwrapped test double).
    const envelope = body as { data?: unknown } | null;
    const payload = envelope && typeof envelope === 'object' && 'data' in envelope
      ? envelope.data
      : body;
    return (payload || {}) as CustomerConfigReadModel;
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
}

/** Convenience factory. */
export function createCustomerConfigApiClient(
  config: CustomerConfigApiClientConfig
): CustomerConfigApiClient {
  return new CustomerConfigApiClient(config);
}

// ---------------------------------------------------------------------------
// Dual-read entry point — RFC-0229 §3.4 GcdrCustomerConfig.loadCustomerConfig()
// ---------------------------------------------------------------------------

export interface LoadCustomerConfigParams extends CustomerConfigApiClientConfig {
  customerId: string;
  /** Cache TTL in ms. Default 60s — shared across every subtask reading this document. */
  ttlMs?: number;
}

interface CacheEntry {
  at: number;
  value: CustomerConfigReadModel | null;
  inFlight?: Promise<CustomerConfigReadModel | null>;
}

const DEFAULT_TTL_MS = 60_000;

// Module-level cache: one fetch of the whole document is shared by every field
// this and future subtasks read off it, keyed per (baseUrl, customerId).
const _cache = new Map<string, CacheEntry>();

/**
 * Fetch (and cache) the customer-config document. Fail-open: returns `null`
 * on missing params, network error, timeout, or non-2xx — never throws — so
 * every dual-read call site can be a one-liner:
 *   const gcdrValue = (await loadCustomerConfig(params))?.alarms?.notificationsEnabled;
 */
export async function loadCustomerConfig(
  params: LoadCustomerConfigParams
): Promise<CustomerConfigReadModel | null> {
  const { customerId, baseUrl, ttlMs = DEFAULT_TTL_MS, ...clientConfig } = params;
  if (!customerId || !baseUrl || (!clientConfig.apiKey && !clientConfig.jwt)) {
    return null;
  }

  const key = `${baseUrl}::${customerId}`;
  const now = Date.now();
  const cached = _cache.get(key);
  if (cached?.inFlight) return cached.inFlight;
  if (cached && now - cached.at < ttlMs) {
    console.log('[GcdrCustomerConfig] loadCustomerConfig: cache hit for', key);
    return cached.value;
  }

  const inFlight = (async () => {
    try {
      const client = new CustomerConfigApiClient({ baseUrl, ...clientConfig });
      const value = await client.getConfig(customerId);
      _cache.set(key, { at: Date.now(), value });
      console.log('[GcdrCustomerConfig] loadCustomerConfig: fetched fresh config for', key);
      return value;
    } catch (err) {
      console.warn(
        '[GcdrCustomerConfig] loadCustomerConfig failed, callers should fall back to TB:',
        err instanceof Error ? err.message : err
      );
      _cache.set(key, { at: Date.now(), value: null });
      return null;
    }
  })();

  _cache.set(key, { at: cached?.at ?? 0, value: cached?.value ?? null, inFlight });
  return inFlight;
}
