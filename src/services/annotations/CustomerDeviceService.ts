/**
 * RFC-0203 M2 — Customer Device Service.
 *
 * Minimal TB REST client for fetching all devices of a customer (paginated)
 * plus their SERVER_SCOPE attributes in batches. Used by the
 * AnnotationServiceOrchestrator to gather cross-domain device data that the
 * widget's domain-scoped `ctx.data` does NOT include.
 *
 * Mirrors the lightweight class-based style of `AlarmApiClient` — no shared
 * HTTP utility (`src/net/http.js` is commented out), just `fetch` direct with
 * concurrency + backoff added explicitly.
 *
 * AC-9: paginated devices fetch (`pageSize=1000`).
 * AC-10: batch attributes fetch — chunks of 100, 50ms between chunks, 429 backoff.
 */

// ============================================================================
// Public types
// ============================================================================

export interface TbDeviceInfo {
  id: { id: string; entityType: 'DEVICE' };
  name: string;
  label?: string;
  type?: string;
  deviceProfileName?: string;
  customerId?: { id: string };
  /** Raw passthrough for fields we don't model explicitly */
  [key: string]: unknown;
}

export interface TbDeviceInfoFlat {
  /** Device UUID */
  id: string;
  /** Raw device name */
  name: string;
  /** Display label (falls back to name) */
  label: string;
  /** Device type / profile (raw, no classification) */
  deviceType: string;
}

export interface TbAttributeKv {
  key: string;
  value: unknown;
  lastUpdateTs?: number;
}

export interface CustomerDeviceServiceConfig {
  /** Customer UUID */
  customerId: string;
  /** TB base URL (no trailing slash). E.g. "https://dashboard.myio-bas.com" */
  tbHost: string;
  /** JWT for `X-Authorization: Bearer ${jwt}` header */
  jwt: string;
  /** Page size for deviceInfos paging (default 1000) */
  pageSize?: number;
  /** Max concurrent in-flight attribute requests (default 5) */
  concurrency?: number;
  /** ms delay between attribute chunks (default 50) */
  chunkDelayMs?: number;
  /** Max retries on 429 / network errors (default 3) */
  maxRetries?: number;
  /** Optional logger; defaults to console */
  logger?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
}

// ============================================================================
// Service
// ============================================================================

export class CustomerDeviceService {
  private readonly customerId: string;
  private readonly tbHost: string;
  private readonly jwt: string;
  private readonly pageSize: number;
  private readonly concurrency: number;
  private readonly chunkDelayMs: number;
  private readonly maxRetries: number;
  private readonly logger: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;

  constructor(cfg: CustomerDeviceServiceConfig) {
    this.customerId = cfg.customerId;
    this.tbHost = cfg.tbHost.replace(/\/+$/, '');
    this.jwt = cfg.jwt;
    this.pageSize = cfg.pageSize ?? 1000;
    this.concurrency = cfg.concurrency ?? 5;
    this.chunkDelayMs = cfg.chunkDelayMs ?? 50;
    this.maxRetries = cfg.maxRetries ?? 3;
    // Defensive: callers may pass a partial logger (e.g. widget LogHelper
    // missing .debug). Normalize so all 4 methods exist, falling back to
    // `log` (then no-op). Fixes runtime TypeError "this.logger.debug is not
    // a function" reported in v-5.2.0 dashboard log.
    const raw = (cfg.logger ?? console) as Partial<Console> & { log?: (...a: unknown[]) => void };
    const noop = (): void => {
      /* no-op */
    };
    const log = raw.log || noop;
    this.logger = {
      debug: (raw.debug as (...a: unknown[]) => void) || log,
      info: (raw.info as (...a: unknown[]) => void) || log,
      warn: (raw.warn as (...a: unknown[]) => void) || log,
      error: (raw.error as (...a: unknown[]) => void) || log,
    };
  }

  private get headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${this.jwt}`,
    };
  }

  /**
   * Fetches ALL devices of the customer using TB's paginated `deviceInfos`
   * endpoint. Hard limit: 10 pages (i.e. 10× pageSize devices) — beyond that
   * we log a warning and stop, to protect the dashboard from runaway fetches.
   *
   * AC-9
   */
  async fetchAllCustomerDevices(): Promise<TbDeviceInfoFlat[]> {
    const HARD_PAGE_CAP = 10;
    const out: TbDeviceInfoFlat[] = [];

    for (let page = 0; page < HARD_PAGE_CAP; page++) {
      const url =
        `${this.tbHost}/api/customer/${encodeURIComponent(this.customerId)}/deviceInfos` +
        `?pageSize=${this.pageSize}&page=${page}`;

      const data = await this._requestJson<{
        data: TbDeviceInfo[];
        hasNext: boolean;
        totalElements?: number;
      }>(url);

      const flat = (data?.data ?? []).map(this._flatten);
      out.push(...flat);

      if (!data?.hasNext) break;
      if (page === HARD_PAGE_CAP - 1) {
        this.logger.warn(
          `[CustomerDeviceService] hit hard page cap of ${HARD_PAGE_CAP} for customer ${this.customerId}; some devices may be missing.`
        );
      }
    }

    this.logger.debug(
      `[CustomerDeviceService] fetched ${out.length} devices for customer ${this.customerId}`
    );
    return out;
  }

  /**
   * Fetches SERVER_SCOPE attributes for a batch of devices. Splits into chunks
   * of `concurrency` (default 5), sequenced with a 50ms delay between chunks.
   * Returns a Map<deviceId, Record<key, value>> of attribute values.
   *
   * Failures per device are logged and skipped — the rest still returns.
   *
   * AC-10
   */
  async fetchAttributesBatch(
    deviceIds: string[],
    keys: string[]
  ): Promise<Map<string, Record<string, unknown>>> {
    const result = new Map<string, Record<string, unknown>>();
    if (deviceIds.length === 0 || keys.length === 0) return result;

    const keysParam = keys.map(encodeURIComponent).join(',');

    for (let i = 0; i < deviceIds.length; i += this.concurrency) {
      const slice = deviceIds.slice(i, i + this.concurrency);
      const settled = await Promise.allSettled(
        slice.map((deviceId) =>
          this._fetchAttributesForDevice(deviceId, keysParam).then(
            (attrs) => ({ deviceId, attrs })
          )
        )
      );

      for (const r of settled) {
        if (r.status === 'fulfilled') {
          result.set(r.value.deviceId, r.value.attrs);
        } else {
          this.logger.warn(
            '[CustomerDeviceService] attribute fetch failed for one device:',
            r.reason
          );
        }
      }

      if (i + this.concurrency < deviceIds.length) {
        await _sleep(this.chunkDelayMs);
      }
    }

    return result;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private _flatten(d: TbDeviceInfo): TbDeviceInfoFlat {
    const id = typeof d.id === 'object' && d.id?.id ? d.id.id : String((d.id as unknown) ?? '');
    return {
      id,
      name: d.name ?? '',
      label: d.label ?? d.name ?? '',
      deviceType: d.type ?? d.deviceProfileName ?? '',
    };
  }

  private async _fetchAttributesForDevice(
    deviceId: string,
    keysParam: string
  ): Promise<Record<string, unknown>> {
    const url =
      `${this.tbHost}/api/plugins/telemetry/DEVICE/${encodeURIComponent(deviceId)}` +
      `/values/attributes/SERVER_SCOPE?keys=${keysParam}`;

    const list = await this._requestJson<TbAttributeKv[]>(url);
    const flat: Record<string, unknown> = {};
    for (const kv of list ?? []) {
      if (kv && typeof kv.key === 'string') flat[kv.key] = kv.value;
    }
    return flat;
  }

  private async _requestJson<T>(url: string): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        const res = await fetch(url, { method: 'GET', headers: this.headers });

        if (res.status === 429 || res.status >= 500) {
          if (attempt < this.maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 1000;
            this.logger.warn(
              `[CustomerDeviceService] ${res.status} on ${url} — retry ${attempt + 1}/${this.maxRetries} in ${backoffMs}ms`
            );
            attempt++;
            await _sleep(backoffMs);
            continue;
          }
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} on ${url}`);
        }

        return (await res.json()) as T;
      } catch (err) {
        if (attempt < this.maxRetries && _isNetworkError(err)) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            `[CustomerDeviceService] network error on ${url} — retry ${attempt + 1}/${this.maxRetries} in ${backoffMs}ms`
          );
          attempt++;
          await _sleep(backoffMs);
          continue;
        }
        throw err;
      }
    }
  }
}

// ============================================================================
// Module-private helpers
// ============================================================================

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function _isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name ?? '';
  const message = String((err as { message?: string }).message ?? '').toLowerCase();
  return name === 'TypeError' || message.includes('network') || message.includes('failed to fetch');
}
