/**
 * RFC-0228 F0 — Thin, typed client for the **money side of goals** (GCDR
 * RFC-0054; contract in `gcdr.git/docs/api/API-Financial-Goals.md`, frozen).
 *
 * Sits beside the A1 tariff client and mirrors its style exactly:
 *   GET    /customers/:id/goals?domain=&year=&granularity=&withMoney=true   (money overlay)
 *   GET    /customers/:id/goals?domain=&year=&measure=CURRENCY              (native budget read)
 *   PUT    /customers/:id/goals?domain=&year=&measure=CURRENCY              (set budget)
 *   DELETE /customers/:id/goals?domain=&year=&measure=CURRENCY              (delete budget)
 *
 * Design rules (identical to `tariffApiClient` on this branch):
 *  - **Pure / framework-agnostic.** No DOM, no ThingsBoard. `fetch` is injected
 *    (defaults to `globalThis.fetch`) so it is unit-testable with a mock.
 *  - **Never converts money to `Number`.** `monetaryValue`, `amount`, and the
 *    budget tree ride as decimal strings, preserved verbatim (`"223000.00"`).
 *  - **Coverage is a value, not an error.** The money overlay is run through
 *    `normalizeMoneyBlock`; `unavailable`/`coverageComplete:false` are normal
 *    200-body outcomes, never thrown (API guide §7).
 *  - **Optimistic concurrency.** Writes send the guard via `If-Match: "<v>"`
 *    AND body `expectedVersion` (equal values); `409 GOAL_VERSION_CONFLICT`
 *    surfaces `currentVersion` instead of being swallowed.
 *  - **Errors surface the stable `code`, never the message** (§7 taxonomy).
 */

import {
  type MoneyDomain,
  type MonetaryProjection,
  type GoalTreeNode,
  type RawMoneyBlock,
  type RawBudgetBlock,
  normalizeMoneyBlock,
} from './moneyTypes';

/** Goal money granularity for reads. `month` is a common overlay grain. */
export type GoalGranularity = 'year' | 'month' | 'day' | 'hour';

/** Selects a single money-capable goal `(customer × domain × year)`. */
export interface GoalSelector {
  customerId: string;
  domain: MoneyDomain;
  year: number;
}

/** A native CURRENCY budget read (the R$ target goal, `measure=CURRENCY`). */
export interface CurrencyBudgetResponse {
  customerId: string;
  domain: MoneyDomain;
  year: number;
  measure: 'CURRENCY';
  currency?: string;
  /** Optimistic-concurrency counter (`0` = never set). */
  version: number;
  /**
   * The R$ budget tree exactly as returned. Amounts are preserved verbatim —
   * the client never `Number()`s them (the contract keeps money as strings).
   */
  tree: GoalTreeNode;
}

/**
 * Client configuration. Auth is `apiKey` (X-API-Key) OR `jwt` (Bearer).
 * Identical shape to `TariffApiClientConfig`.
 */
export interface GoalsMoneyClientConfig {
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
  /** Base path segment. Defaults to `api/v1`. */
  basePath?: string;
}

/**
 * Structured goals-money API failure. Callers switch on `.code` (stable), never
 * on the human message. `currentVersion` is lifted from `details` for 409s so a
 * `GOAL_VERSION_CONFLICT` is surfaced without digging.
 */
export class GoalsMoneyApiError extends Error {
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
    this.name = 'GoalsMoneyApiError';
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

/** Parse a strong ETag (`"5"`) into a number, if present. */
function parseETagVersion(headers: Headers): number | undefined {
  const raw = headers.get('ETag') || headers.get('etag');
  if (!raw) return undefined;
  const m = /"?(-?\d+)"?/.exec(raw);
  return m ? Number(m[1]) : undefined;
}

/** Body fragment carrying the optimistic-concurrency guard. */
function guardBody(expectedVersion?: number): { expectedVersion?: number } {
  return typeof expectedVersion === 'number' ? { expectedVersion } : {};
}

export class GoalsMoneyClient {
  private readonly cfg: GoalsMoneyClientConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly basePath: string;

  constructor(config: GoalsMoneyClientConfig) {
    if (!config || !config.baseUrl) {
      throw new Error('GoalsMoneyClient requires a baseUrl.');
    }
    this.cfg = config;
    const injected = config.fetchImpl || (globalThis.fetch as typeof fetch | undefined);
    if (typeof injected !== 'function') {
      throw new Error('GoalsMoneyClient requires a fetch implementation.');
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

  private goalsPath(sel: GoalSelector): string {
    return `/customers/${encodeURIComponent(sel.customerId)}/goals`;
  }

  /**
   * Read a quantity goal **in money** (`?withMoney=true`). Returns the quantity
   * tree (values are quantities, `monetaryValue`s are decimal strings), plus the
   * normalized money overlay (`available` | `unavailable`) and, when a CURRENCY
   * goal exists, the folded budget verdict. Coverage states are NOT thrown.
   */
  async getGoalWithMoney(
    args: GoalSelector & { granularity?: GoalGranularity }
  ): Promise<MonetaryProjection> {
    const qs = new URLSearchParams();
    qs.set('domain', args.domain);
    qs.set('year', String(args.year));
    if (args.granularity) qs.set('granularity', args.granularity);
    qs.set('withMoney', 'true');
    const url = joinUrl(this.cfg.baseUrl, this.basePath, `${this.goalsPath(args)}?${qs.toString()}`);

    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...this.authHeaders() },
    });
    const body = await this.readBody(res);
    if (!res.ok) throw this.toError(res, body);

    const etagVersion = parseETagVersion(res.headers);
    const parsed = (body || {}) as {
      measure?: string;
      version?: number;
      unit?: string;
      tree?: GoalTreeNode;
      money?: RawMoneyBlock;
      budget?: RawBudgetBlock;
    };
    const version =
      typeof parsed.version === 'number' ? parsed.version : etagVersion ?? 0;
    const measure = parsed.measure === 'CURRENCY' ? 'CURRENCY' : 'QUANTITY';

    return {
      customerId: args.customerId,
      domain: args.domain,
      year: args.year,
      measure,
      version,
      goal: {
        domain: args.domain,
        unit: typeof parsed.unit === 'string' ? parsed.unit : '',
        // Tree is passed through verbatim — amounts/monetaryValues stay strings.
        tree: parsed.tree || {},
        version,
      },
      money: normalizeMoneyBlock(parsed.money, parsed.budget),
    };
  }

  /** Read the native CURRENCY budget goal (R$ target tree). */
  async getBudget(sel: GoalSelector): Promise<CurrencyBudgetResponse> {
    const qs = new URLSearchParams();
    qs.set('domain', sel.domain);
    qs.set('year', String(sel.year));
    qs.set('measure', 'CURRENCY');
    const url = joinUrl(this.cfg.baseUrl, this.basePath, `${this.goalsPath(sel)}?${qs.toString()}`);

    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...this.authHeaders() },
    });
    const body = await this.readBody(res);
    if (!res.ok) throw this.toError(res, body);

    const etagVersion = parseETagVersion(res.headers);
    const parsed = (body || {}) as Partial<CurrencyBudgetResponse>;
    return {
      customerId: sel.customerId,
      domain: sel.domain,
      year: sel.year,
      measure: 'CURRENCY',
      currency: parsed.currency,
      version: typeof parsed.version === 'number' ? parsed.version : etagVersion ?? 0,
      tree: parsed.tree || {},
    };
  }

  /**
   * Set the native CURRENCY budget (PUT replace). The `tree` is sent **verbatim**
   * (`{ annual: { value: "120000.00" } }` or `{ monthly: {…} }`) — the client
   * does not coerce amounts, keeping the decimal-string contract end to end.
   * The optimistic guard rides both `If-Match` and body `expectedVersion`.
   */
  async putBudget(
    args: GoalSelector & { tree: GoalTreeNode; expectedVersion?: number }
  ): Promise<{ version: number }> {
    const qs = new URLSearchParams();
    qs.set('domain', args.domain);
    qs.set('year', String(args.year));
    qs.set('measure', 'CURRENCY');
    const url = joinUrl(this.cfg.baseUrl, this.basePath, `${this.goalsPath(args)}?${qs.toString()}`);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...this.authHeaders(),
    };
    if (typeof args.expectedVersion === 'number') {
      headers['If-Match'] = `"${args.expectedVersion}"`;
    }
    const res = await this.fetchImpl(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...args.tree, ...guardBody(args.expectedVersion) }),
    });
    const parsed = await this.readBody(res);
    if (!res.ok) throw this.toError(res, parsed);
    const etagVersion = parseETagVersion(res.headers);
    const v = (parsed && (parsed as { version?: unknown }).version) ?? etagVersion;
    return { version: typeof v === 'number' ? v : (args.expectedVersion ?? 0) + 1 };
  }

  /**
   * Delete the native CURRENCY budget. Whole-year delete is idempotent (204).
   * The optimistic guard rides both `If-Match` and body `expectedVersion`.
   */
  async deleteBudget(
    args: GoalSelector & { expectedVersion?: number }
  ): Promise<{ version?: number }> {
    const qs = new URLSearchParams();
    qs.set('domain', args.domain);
    qs.set('year', String(args.year));
    qs.set('measure', 'CURRENCY');
    const url = joinUrl(this.cfg.baseUrl, this.basePath, `${this.goalsPath(args)}?${qs.toString()}`);

    const headers: Record<string, string> = { Accept: 'application/json', ...this.authHeaders() };
    const init: RequestInit = { method: 'DELETE', headers };
    if (typeof args.expectedVersion === 'number') {
      headers['If-Match'] = `"${args.expectedVersion}"`;
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(guardBody(args.expectedVersion));
    }
    const res = await this.fetchImpl(url, init);
    if (res.status === 204) return {};
    const body = await this.readBody(res);
    if (!res.ok) throw this.toError(res, body);
    const etagVersion = parseETagVersion(res.headers);
    const v = (body && (body as { version?: unknown }).version) ?? etagVersion;
    return typeof v === 'number' ? { version: v } : {};
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

  private toError(res: Response, body: unknown): GoalsMoneyApiError {
    const err = body && (body as { error?: unknown }).error;
    if (err && typeof err === 'object') {
      const e = err as { code?: string; message?: string; details?: Record<string, unknown> };
      return new GoalsMoneyApiError(e.code || `HTTP_${res.status}`, res.status, e.message, e.details);
    }
    return new GoalsMoneyApiError(`HTTP_${res.status}`, res.status, res.statusText);
  }
}

/** Convenience factory (mirrors `createTariffApiClient`). */
export function createGoalsMoneyClient(config: GoalsMoneyClientConfig): GoalsMoneyClient {
  return new GoalsMoneyClient(config);
}
