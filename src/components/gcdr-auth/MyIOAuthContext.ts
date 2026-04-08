/**
 * RFC-0199 — MyIOAuthContext
 *
 * Client-side GCDR RBAC authorization context.
 *
 * Design patterns used:
 *   - Singleton (exposed on `window.MyIOAuthContext`)
 *   - Strategy (deny-first permission evaluation)
 *   - Observer (`myio:auth-ready` event when loaded)
 *
 * Usage (from widgets):
 *   window.MyIOAuthContext?.can('alarm:ack')   // → boolean
 *   window.MyIOAuthContext?.canAny('alarm:ack', 'alarm:close')
 *   window.addEventListener('myio:auth-ready', handler)
 */

import type { AuthConfig, AuthContextSnapshot } from './types';
import type { GCDRAssignment, GCDRRole, GCDRPolicy, GCDRUser } from '../premium-modals/user-management/types';

export class MyIOAuthContext {
  private allowedActions = new Set<string>();
  private deniedActions  = new Set<string>();
  private snap: AuthContextSnapshot;

  private constructor(snap: AuthContextSnapshot) {
    this.snap = snap;
  }

  // ── Public read-only state ────────────────────────────────────────────────

  get ready():      boolean              { return this.snap.ready; }
  get gcdrUserId(): string | null        { return this.snap.gcdrUserId; }
  get scope():      string               { return this.snap.scope; }
  get error():      string | null        { return this.snap.error; }
  get allowAll():   boolean              { return this.snap.allowAll; }
  get assignments(): GCDRAssignment[]   { return this.snap.assignments; }

  // ── Permission checks ─────────────────────────────────────────────────────

  /**
   * Returns `true` if the current user is allowed to perform `action`.
   *
   * Evaluation order (deny-first):
   *   1. If allowAll (TENANT_ADMIN) → always true
   *   2. If action (or `*`) is in the deny set → false
   *   3. If action (or `*`) is in the allow set → true
   *   4. Otherwise → false  (closed-by-default)
   *
   * Returns `false` while not yet ready.
   */
  can(action: string): boolean {
    if (!this.snap.ready) return false;
    if (this.snap.allowAll) return true;
    if (this.deniedActions.has('*') || this.deniedActions.has(action)) return false;
    return this.allowedActions.has('*') || this.allowedActions.has(action);
  }

  /** True if the user can perform **at least one** of the given actions. */
  canAny(...actions: string[]): boolean {
    return actions.some(a => this.can(a));
  }

  /** True if the user can perform **all** of the given actions. */
  canAll(...actions: string[]): boolean {
    return actions.every(a => this.can(a));
  }

  // ── Factory ───────────────────────────────────────────────────────────────

  /**
   * Initialises the auth context.
   * Resolves immediately when `allowAll` is set or GCDR is not configured.
   * Always dispatches `myio:auth-ready` when done (success or error).
   */
  static async init(config: AuthConfig): Promise<MyIOAuthContext> {
    const scope = config.scope
      ?? (config.customerId ? `customer:${config.customerId}` : '*');

    const ctx = new MyIOAuthContext({
      ready:      false,
      gcdrUserId: null,
      scope,
      allowAll:   config.allowAll ?? false,
      error:      null,
      assignments: [],
    });

    // ── Fast paths ────────────────────────────────────────────────────────

    // TENANT_ADMIN / super-admin bypass — no API calls needed
    if (config.allowAll) {
      ctx.snap.ready = true;
      ctx._dispatch();
      return ctx;
    }

    // GCDR not wired up — skip gracefully (deny all GCDR permissions)
    if (!config.gcdrApiBaseUrl) {
      ctx.snap.ready = true;
      ctx.snap.error = 'GCDR not configured';
      ctx._dispatch();
      return ctx;
    }

    // ── Full GCDR resolution ──────────────────────────────────────────────

    try {
      const hdrs = ctx._gcdrHeaders(config);

      // 1. Resolve GCDR user ID (TB attribute → email search)
      const gcdrUserId = await ctx._resolveGcdrUserId(config, hdrs);
      if (!gcdrUserId) {
        ctx.snap.error = 'GCDR user not found';
        ctx.snap.ready = true;
        ctx._dispatch();
        return ctx;
      }
      ctx.snap.gcdrUserId = gcdrUserId;

      // 2. Fetch all assignments for this user
      const assignRes = await fetch(
        `${config.gcdrApiBaseUrl}/authorization/users/${gcdrUserId}/assignments`,
        { headers: hdrs },
      );
      let allAssignments: GCDRAssignment[] = [];
      if (assignRes.ok) {
        const json = await assignRes.json();
        allAssignments = Array.isArray(json) ? json : (json.assignments ?? []);
      }

      // 3. Filter: only active + (global `*` OR current scope)
      const relevant = allAssignments.filter(
        a => a.status === 'active' && (a.scope === '*' || a.scope === scope),
      );
      ctx.snap.assignments = relevant;

      if (relevant.length === 0) {
        ctx.snap.ready = true;
        ctx._dispatch();
        return ctx;
      }

      // 4. Resolve roles → policies → build permission sets
      const roleKeys = [...new Set(relevant.map(a => a.roleKey))];
      const roles    = await ctx._fetchRoles(config.gcdrApiBaseUrl, roleKeys, hdrs);

      const policyKeys = [...new Set(
        roles.flatMap(r => [...(r.policies ?? []), ...(r.policyIds ?? [])]),
      )];

      if (policyKeys.length > 0) {
        const policies = await ctx._fetchPolicies(config.gcdrApiBaseUrl, policyKeys, hdrs);
        ctx._applyPolicies(policies);
      }
    } catch (err: any) {
      ctx.snap.error = err?.message ?? 'Auth init failed';
    }

    ctx.snap.ready = true;
    ctx._dispatch();
    return ctx;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _gcdrHeaders(config: AuthConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key':    config.gcdrApiKey   || '',
      'X-Tenant-ID':  config.gcdrTenantId || '',
    };
  }

  /**
   * Two-step GCDR user lookup:
   * 1. Read `gcdrUserConfigs` from TB SERVER_SCOPE attribute (fast path if previously synced)
   * 2. Email search via GCDR API
   */
  private async _resolveGcdrUserId(
    config: AuthConfig,
    gcdrHeaders: Record<string, string>,
  ): Promise<string | null> {
    // Step 1: TB attribute (gcdrUserConfigs.gcdrUserId)
    if (config.currentUserTbId && config.tbBaseUrl && config.jwtToken) {
      try {
        const res = await fetch(
          `${config.tbBaseUrl}/api/plugins/telemetry/USER/${config.currentUserTbId}/values/attributes/SERVER_SCOPE?keys=gcdrUserConfigs`,
          { headers: { 'X-Authorization': `Bearer ${config.jwtToken}` } },
        );
        if (res.ok) {
          const attrs: Array<{ key: string; value: unknown }> = await res.json();
          const gcdrId = (attrs.find(a => a.key === 'gcdrUserConfigs')?.value as any)?.gcdrUserId;
          if (gcdrId) return gcdrId;
        }
      } catch { /* fall through */ }
    }

    // Step 2: GCDR email search
    if (!config.currentUserEmail) return null;
    try {
      const q   = encodeURIComponent(config.currentUserEmail);
      const cid = config.customerId
        ? `&customerId=${encodeURIComponent(config.customerId)}`
        : '';
      const res = await fetch(
        `${config.gcdrApiBaseUrl}/api/v1/users?search=${q}${cid}&limit=10`,
        { headers: gcdrHeaders },
      );
      if (res.ok) {
        const data = await res.json();
        const items: GCDRUser[] = Array.isArray(data)
          ? data
          : (data?.data?.items ?? data?.items ?? []);
        const found = items.find(
          u => u.email?.toLowerCase() === config.currentUserEmail!.toLowerCase(),
        );
        if (found) return found.id;
      }
    } catch { /* return null */ }

    return null;
  }

  /**
   * Fetches roles — tries GET /roles bulk endpoint first, falls back to per-key.
   */
  private async _fetchRoles(
    base: string,
    roleKeys: string[],
    headers: Record<string, string>,
  ): Promise<GCDRRole[]> {
    try {
      const res = await fetch(`${base}/roles`, { headers });
      if (res.ok) {
        const json = await res.json();
        const all: GCDRRole[] = Array.isArray(json)
          ? json
          : (json?.data?.items ?? json?.items ?? json?.data ?? []);
        // Keep only the roles referenced by active assignments
        return all.filter(r => roleKeys.includes(r.key ?? r.id));
      }
    } catch { /* fall through */ }

    // Per-key fallback
    const settled = await Promise.allSettled(
      roleKeys.map(key =>
        fetch(`${base}/roles/${key}`, { headers })
          .then(r => (r.ok ? r.json() : null)),
      ),
    );
    return settled
      .filter((r): r is PromiseFulfilledResult<GCDRRole> => r.status === 'fulfilled' && r.value != null)
      .map(r => r.value);
  }

  /**
   * Fetches policies — tries GET /policies bulk endpoint first, falls back to per-key.
   */
  private async _fetchPolicies(
    base: string,
    policyKeys: string[],
    headers: Record<string, string>,
  ): Promise<GCDRPolicy[]> {
    try {
      const res = await fetch(`${base}/policies`, { headers });
      if (res.ok) {
        const json = await res.json();
        const all: GCDRPolicy[] = Array.isArray(json)
          ? json
          : (json?.data?.items ?? json?.items ?? json?.data ?? []);
        return all.filter(p => policyKeys.includes(p.key ?? p.id));
      }
    } catch { /* fall through */ }

    // Per-key fallback
    const settled = await Promise.allSettled(
      policyKeys.map(key =>
        fetch(`${base}/policies/${key}`, { headers })
          .then(r => (r.ok ? r.json() : null)),
      ),
    );
    return settled
      .filter((r): r is PromiseFulfilledResult<GCDRPolicy> => r.status === 'fulfilled' && r.value != null)
      .map(r => r.value);
  }

  /**
   * Merges all policy allow/deny lists into the context's permission sets.
   * Deny always wins over allow (deny-first strategy).
   */
  private _applyPolicies(policies: GCDRPolicy[]): void {
    for (const policy of policies) {
      for (const action of (policy.allow ?? [])) this.allowedActions.add(action);
      for (const action of (policy.deny  ?? [])) this.deniedActions.add(action);
    }
  }

  /** Dispatches `myio:auth-ready` so widgets can react without polling. */
  private _dispatch(): void {
    window.dispatchEvent(
      new CustomEvent('myio:auth-ready', {
        detail: {
          ready:    this.snap.ready,
          scope:    this.snap.scope,
          allowAll: this.snap.allowAll,
          error:    this.snap.error,
        },
      }),
    );
  }
}

/**
 * Convenience factory — exported for `window.MyIOLibrary.initMyIOAuthContext(config)`.
 *
 * Usage in MAIN_VIEW (after GCDR creds are ready):
 * ```js
 * window.MyIOAuthContext = await window.MyIOLibrary.initMyIOAuthContext({ ... });
 * ```
 */
export async function initMyIOAuthContext(config: AuthConfig): Promise<MyIOAuthContext> {
  return MyIOAuthContext.init(config);
}
