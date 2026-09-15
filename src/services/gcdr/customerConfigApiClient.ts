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
 * `loadCustomerConfig()` fetches the whole document once (cached, short TTL,
 * de-duped) and NEVER throws, so callers do one-line reads:
 *   const enabled = (await loadCustomerConfig(cfg))?.alarms?.notificationsEnabled;
 *
 * `resolveConfigField()` is the shared per-field dual-read primitive every
 * Group-A subtask calls — it wraps `loadCustomerConfig()` with credential
 * gating, timing, GCDR-vs-TB source resolution, and diagnostic logging, so a
 * new field's dual-read is a few lines instead of a bespoke block each time.
 * Every call self-registers into `printResolvedConfigSummary()`'s table, so
 * testing a new field is: reload, read one console.table, done.
 */

/** `alarms` section of the customer-config read model (RFC-0057 DEC-4/DEC-5). */
export interface CustomerAlarmsConfig {
  notificationsEnabled?: boolean;
  showOffline?: boolean;
  showInternalSupport?: boolean;
}

/**
 * `featureButtons` section (RFC-0229 §1) — replaces the legacy TB
 * `canShowDemandButtons` boolean with a 2×3 granular visibility matrix.
 * Mirrors `FeatureButtons` in `gcdr/src/domain/entities/Customer.ts`.
 */
export type FeatureGroup = 'entrada' | 'areacomum' | 'lojas';
export type FeatureGroupFlags = Record<FeatureGroup, boolean>;
export interface CustomerFeatureButtonsConfig {
  demandPeak: FeatureGroupFlags;
  instantTelemetry: FeatureGroupFlags;
}

/**
 * `defaultDashboard` section (RFC-0229 §3.1) — replaces the legacy TB
 * `customerDefaultDashboard` attribute. Both fields independently null-default
 * on the backend (`gcdr/src/services/CustomerConfigService.ts:317-335`) — unlike
 * `alarms`/`featureButtons`/`temperature`, there is no non-null structural
 * default here, so `{id: null, cfg: null}` unambiguously means "never configured".
 */
export interface CustomerDefaultDashboardConfig {
  id: string | null;
  cfg: unknown;
}

/**
 * `temperature` section (RFC-0229 §3.1) — replaces the legacy TB
 * `minTemperature`/`maxTemperature`/`temperatureClampMin`/`temperatureClampMax`
 * attributes. Backend always structurally defaults to `{min:18, max:27,
 * clampMin:15, clampMax:40}` (`gcdr/src/services/CustomerConfigService.ts:38`)
 * when unset — same "can't distinguish not-yet-migrated from real value"
 * limitation already accepted for `alarms`/`featureButtons`.
 */
export interface CustomerTemperatureConfig {
  min: number;
  max: number;
  clampMin: number;
  clampMax: number;
}

/**
 * `display` section (RFC-0229 §3.1) — replaces the legacy TB
 * `measurementDisplaySettings`/`mapInstantaneousPower` attributes. Both
 * sub-fields are opaque JSON on the backend (`z.unknown()`), pure passthrough,
 * null-defaulted per field (no structural-default ambiguity).
 */
export interface CustomerDisplayConfig {
  measurementDisplaySettings: unknown;
  mapInstantaneousPower: unknown;
}

/**
 * `ingestion` section (RFC-0229 §3.1) — replaces the legacy TB `client_id`
 * attribute. `clientId` is a plain, non-secret, null-defaulted string
 * (`gcdr/src/services/CustomerConfigService.ts:346-348`). `clientSecret` is
 * typed here for documentation only — it is ALWAYS the literal string `'***'`
 * on the normal read model (never real plaintext) and is never dual-read; see
 * the `client_secret` TODO in MAIN_VIEW/controller.js and RFC-0231 §1.
 */
export interface CustomerIngestionConfig {
  clientId: string | null;
  clientSecret: '***' | string;
}

/**
 * `tickets` section (RFC-0229 §3.1) — replaces the legacy TB
 * `tickets_enabled`/`tickets_only_to_myio` attributes. Backend always
 * structurally defaults to `{enabled:false, onlyToMyio:true}`
 * (`gcdr/src/services/CustomerConfigService.ts:37`) — same "can't distinguish
 * not-yet-migrated from real value" limitation as `alarms`/`featureButtons`/
 * `temperature`, and it happens to match this widget's own TB-side defaults.
 */
export interface CustomerTicketsConfig {
  enabled: boolean;
  onlyToMyio: boolean;
}

/**
 * Normalized customer-config read model. Deliberately loose/partial — new
 * sections are added here as future Group-A subtasks need them, one at a
 * time, per RFC-0229.
 */
export interface CustomerConfigReadModel {
  alarms?: CustomerAlarmsConfig;
  featureButtons?: CustomerFeatureButtonsConfig;
  defaultDashboard?: CustomerDefaultDashboardConfig;
  temperature?: CustomerTemperatureConfig;
  display?: CustomerDisplayConfig;
  ingestion?: CustomerIngestionConfig;
  tickets?: CustomerTicketsConfig;
  /**
   * TODO(ED-1149 / RFC-0229 §3.1): typed but NOT wired to any dual-read yet.
   * `deviceClassificationProfile` already has a separate, in-progress GCDR
   * store (RFC-0207 v3.2's `/entities/resolve`-based
   * `createGcdrResolveProfileSource()`, MAIN_VIEW/controller.js:1422,
   * currently disabled — its `entities → ClassificationNode` adapter isn't
   * built yet, RFC-0207 §v3.2-B/G). Layering a `resolveConfigField()` dual-read
   * against THIS field, without reconciling the two paths, would create two
   * competing "GCDR truth" sources for one piece of data. Needs a scoping
   * decision from RFC-0207's owner before it's implemented — see the matching
   * TODO at MAIN_VIEW/controller.js:1326. Backend shape confirmed opaque/JSON,
   * null-defaulted (`gcdr/src/domain/entities/Customer.ts:129`).
   */
  classificationProfile?: unknown;
  [key: string]: unknown;
}

function isFeatureGroupFlags(v: unknown): v is FeatureGroupFlags {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as FeatureGroupFlags).entrada === 'boolean' &&
    typeof (v as FeatureGroupFlags).areacomum === 'boolean' &&
    typeof (v as FeatureGroupFlags).lojas === 'boolean'
  );
}

/**
 * Light shape guard for `featureButtons` — GCDR always server-merges
 * `createDefaultFeatureButtons()` when the section is absent, so a malformed
 * matrix can only come from a client-side bug, not real-world variance.
 */
export function isFeatureButtonsMatrix(v: unknown): v is CustomerFeatureButtonsConfig {
  return (
    !!v &&
    typeof v === 'object' &&
    isFeatureGroupFlags((v as CustomerFeatureButtonsConfig).demandPeak) &&
    isFeatureGroupFlags((v as CustomerFeatureButtonsConfig).instantTelemetry)
  );
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

// ---------------------------------------------------------------------------
// resolveConfigField() — the shared per-field dual-read primitive every
// Group-A subtask calls, built on top of loadCustomerConfig() above. It owns
// credential-gating, timing, and diagnostic logging so each subtask's call
// site is a few lines instead of a bespoke ~50-line block per field.
// ---------------------------------------------------------------------------

export type ConfigFieldSource =
  | 'GCDR'
  | 'TB (no GCDR bootstrap creds)'
  | 'TB (GCDR reachable but no usable value)'
  | 'TB (GCDR unreachable)';

export interface ResolveConfigFieldParams<T> extends LoadCustomerConfigParams {
  /** Human label for the diagnostic log line and the central summary table, e.g. 'featureButtons'. */
  fieldLabel: string;
  /** Pull just this field out of the whole doc; return undefined if absent/malformed to trigger the fallback. Only called with a non-null cfg. */
  extract: (cfg: CustomerConfigReadModel) => T | undefined;
  /** Caller-resolved TB value, including any legacy-mapping transform already applied. */
  fallbackValue: T;
}

export interface ResolveConfigFieldResult<T> {
  value: T;
  source: ConfigFieldSource;
  gcdrConfig: CustomerConfigReadModel | null;
}

interface ResolvedFieldEntry {
  fieldLabel: string;
  value: unknown;
  source: ConfigFieldSource;
  at: number;
}

// Keyed by fieldLabel, not customerId — one browser tab loads one TB customer
// per session, so a fresh onInit pass simply overwrites every entry before
// anyone reads the summary. See printResolvedConfigSummary() below.
const _resolvedFieldsLog = new Map<string, ResolvedFieldEntry>();

function _recordResolvedField(fieldLabel: string, value: unknown, source: ConfigFieldSource): void {
  _resolvedFieldsLog.set(fieldLabel, { fieldLabel, value, source, at: Date.now() });
}

/**
 * Resolve one customer-config field: GCDR-first, TB fallback. Never throws —
 * on any failure (no creds, unreachable, no usable value) it returns
 * `fallbackValue` with a `source` explaining why. Every call self-registers
 * into the central summary log (see `printResolvedConfigSummary`).
 */
export async function resolveConfigField<T>(
  params: ResolveConfigFieldParams<T>
): Promise<ResolveConfigFieldResult<T>> {
  const { fieldLabel, extract, fallbackValue, ...loadParams } = params;
  const { customerId, baseUrl, apiKey, jwt } = loadParams;

  const hasCreds = !!(customerId && baseUrl && (apiKey || jwt));
  if (!hasCreds) {
    console.log(
      `[GcdrCustomerConfig] ⏭️ ${fieldLabel}: pulando busca no GCDR — sem credenciais de bootstrap`
    );
    _recordResolvedField(fieldLabel, fallbackValue, 'TB (no GCDR bootstrap creds)');
    return { value: fallbackValue, source: 'TB (no GCDR bootstrap creds)', gcdrConfig: null };
  }

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const cfg = await loadCustomerConfig(loadParams);
  const dt = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);

  if (!cfg) {
    console.warn(
      `[GcdrCustomerConfig] ⚠️ ${fieldLabel}: GCDR inalcançável (${dt}ms) — usando fallback TB:`,
      fallbackValue
    );
    _recordResolvedField(fieldLabel, fallbackValue, 'TB (GCDR unreachable)');
    return { value: fallbackValue, source: 'TB (GCDR unreachable)', gcdrConfig: null };
  }

  const extracted = extract(cfg);
  if (extracted === undefined) {
    console.warn(
      `[GcdrCustomerConfig] ⚠️ ${fieldLabel}: GCDR ok (${dt}ms) mas sem valor utilizável — usando fallback TB:`,
      fallbackValue
    );
    _recordResolvedField(fieldLabel, fallbackValue, 'TB (GCDR reachable but no usable value)');
    return { value: fallbackValue, source: 'TB (GCDR reachable but no usable value)', gcdrConfig: cfg };
  }

  console.log(`[GcdrCustomerConfig] ✅ ${fieldLabel}: resolvido do GCDR (${dt}ms):`, extracted);
  _recordResolvedField(fieldLabel, extracted, 'GCDR');
  return { value: extracted, source: 'GCDR', gcdrConfig: cfg };
}

/**
 * Prints one console.table with every ED-1149 field resolved so far this
 * session — the at-a-glance view for manual testing as more Group-A fields
 * are added. Zero extra code needed per subtask: every resolveConfigField()
 * call self-registers.
 */
export function printResolvedConfigSummary(): void {
  const rows = Array.from(_resolvedFieldsLog.values()).map(({ fieldLabel, value, source }) => ({
    field: fieldLabel,
    value: typeof value === 'object' ? JSON.stringify(value) : value,
    source,
  }));
  const onGcdr = rows.filter((r) => r.source === 'GCDR').length;
  console.log(
    `[GcdrCustomerConfig] ── Resumo dos campos ED-1149 (${onGcdr}/${rows.length} já lidos do GCDR) ──`
  );
  console.table(rows);
}
