/**
 * RFC-0224 — authenticated executor for Data API (Ingestion) requests.
 *
 * Puts the bearer, classifies the answer and, on an authentication error, recovers once per auth
 * scope — one `forceRefresh()` shared by every request of the scope — and repeats the request
 * exactly once. A third call happens only after a proven credential rotation. A recovery that
 * fails for good opens a circuit breaker for the scope instead of looping, and nothing here
 * reloads the page.
 *
 * No browser dependency: lifecycle events go to callbacks (`onLifecycleEvent` and the listeners
 * registered with `onIngestionAuthLifecycle`); the dashboard adapter turns them into toasts and
 * CustomEvents. Events never carry the bearer, the URL or credentials.
 */
import { fnv1aHex, IngestionAuthError, type MyIOAuthInstance } from './buildMyioIngestionAuth';

export type IngestionAuthLifecycleType = 'expired' | 'refresh-started' | 'refreshed' | 'failed';

export type IngestionRecoveryFailureCategory =
  | 'invalid_client'
  | 'network'
  | 'server'
  | 'malformed_response'
  | 'unauthorized'
  | 'circuit_open';

export interface IngestionAuthLifecycleEvent {
  version: 1;
  type: IngestionAuthLifecycleType;
  /** Opaque id of the auth scope (host + client), see `ingestionAuthScopeId`. */
  scopeId: string;
  /** Caller label, e.g. 'fetchGoalsDayTotals' (never a URL). */
  context: string;
  at: number;
  generation: number;
  /** expired: HTTP status of the data answer. */
  status?: number;
  /** refreshed: the recovery needed new credentials. */
  credentialsRotated?: boolean;
  /** failed */
  category?: IngestionRecoveryFailureCategory;
  /** failed */
  retryable?: boolean;
}

export interface IngestionFetchOptions {
  /** Opaque id of the auth scope (host + client) — `ingestionAuthScopeId(host, clientId)`. */
  authScopeId: string;
  /** Current auth instance of the scope (read again after a credential rotation). */
  getAuth: () => MyIOAuthInstance;
  /**
   * Re-reads the client credentials from their source. Resolve with a NEW auth instance only when
   * the credentials changed; resolve null/undefined when they did not (no third call then).
   */
  refreshCredentials?: () => Promise<MyIOAuthInstance | null | void>;
  onLifecycleEvent?: (event: IngestionAuthLifecycleEvent) => void;
  /** Caller label for events and logs. */
  context?: string;
  /**
   * Called for a 403 only: true when the answer says the token is invalid/expired. Default: a
   * 403 is a permission error and is returned as is (AC-06).
   */
  isIngestionAuthError?: (response: Response) => boolean | Promise<boolean>;
  /** Circuit breaker after a final, non-retryable failure. Default 30 s. */
  breakerMs?: number;
  fetchImpl?: typeof fetch;
}

export const INGESTION_AUTH_BREAKER_MS = 30_000;

interface ScopeState {
  /** Shared forceRefresh of the scope and the stale generation it replaces. */
  recovery: Promise<void> | null;
  recoveryFrom: number;
  /** Shared credential re-read of the scope. */
  rotation: Promise<MyIOAuthInstance | null> | null;
  /** Bumped by every recovery; 'refreshed' is emitted once per epoch. */
  epoch: number;
  refreshedEpoch: number;
  breakerUntil: number;
}

const scopes = new Map<string, ScopeState>();
const listeners = new Set<(event: IngestionAuthLifecycleEvent) => void>();
let recoveryEnabled = true;

/** Opaque scope id for a Data API host + client id (no secret involved). */
export function ingestionAuthScopeId(dataApiHost: string, clientId: string): string {
  return `ing_${fnv1aHex(`${dataApiHost}|${clientId}`)}`;
}

/** Listens to the lifecycle events of every `ingestionFetch` call. Returns the unsubscribe. */
export function onIngestionAuthLifecycle(listener: (event: IngestionAuthLifecycleEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Feature flag (RFC-0224 §14). Off: no refresh and no repeated request — only the events. */
export function setIngestionAuthRecoveryEnabled(enabled: boolean): void {
  recoveryEnabled = enabled !== false;
}

export function isIngestionAuthRecoveryEnabled(): boolean {
  return recoveryEnabled;
}

/** Forgets breakers and in-flight recoveries (tests, logout). */
export function resetIngestionAuthRecoveryState(): void {
  scopes.clear();
}

function scopeState(id: string): ScopeState {
  let scope = scopes.get(id);
  if (!scope) {
    scope = { recovery: null, recoveryFrom: -1, rotation: null, epoch: 0, refreshedEpoch: 0, breakerUntil: 0 };
    scopes.set(id, scope);
  }
  return scope;
}

function withBearer(input: RequestInfo | URL, init: RequestInit, token: string): RequestInit {
  const base =
    init.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined);
  const headers = new Headers(base);
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

async function isAuthFailure(response: Response, options: IngestionFetchOptions): Promise<boolean> {
  if (response.status === 401) return true;
  if (response.status === 403 && options.isIngestionAuthError) {
    try {
      return !!(await options.isIngestionAuthError(typeof response.clone === 'function' ? response.clone() : response));
    } catch {
      return false;
    }
  }
  return false;
}

/** One forceRefresh per scope: requests that saw the same stale token join it (AC-01). */
function refreshScope(scope: ScopeState, auth: MyIOAuthInstance, staleGeneration: number, onStart: () => void): Promise<void> {
  if (scope.recovery && scope.recoveryFrom === staleGeneration) return scope.recovery;
  if (auth.getGeneration() > staleGeneration) return Promise.resolve(); // already refreshed after our token
  scope.recoveryFrom = staleGeneration;
  scope.epoch += 1;
  onStart();
  // try/finally instead of Promise#finally: some pages replace Promise with a polyfill without it
  const recovery: Promise<void> = (async () => {
    try {
      await null; // `recovery` is assigned before the finally can run, even on a synchronous throw
      await auth.forceRefresh(staleGeneration);
    } finally {
      if (scope.recovery === recovery) scope.recovery = null;
    }
  })();
  scope.recovery = recovery;
  return recovery;
}

/** One credential re-read per scope; resolves with a new instance only when they changed. */
function rotateScope(
  scope: ScopeState,
  refreshCredentials: NonNullable<IngestionFetchOptions['refreshCredentials']>,
): Promise<MyIOAuthInstance | null> {
  if (!scope.rotation) {
    const rotation: Promise<MyIOAuthInstance | null> = (async () => {
      try {
        await null; // `rotation` is assigned before the finally can run, even on a synchronous throw
        const next = (await refreshCredentials()) || null;
        if (next) scope.epoch += 1;
        return next;
      } catch {
        return null;
      } finally {
        if (scope.rotation === rotation) scope.rotation = null;
      }
    })();
    scope.rotation = rotation;
  }
  return scope.rotation;
}

/**
 * `fetch()` for a Data API request, with the bearer of the scope and token-expiry recovery.
 * Returns the answer of the last call made (a non-auth answer as soon as there is one); throws
 * only what `fetch` throws, or the `/auth` error when no token can be obtained at all.
 * `init.body` must be re-sendable (string, FormData…), as the request may be repeated.
 */
export async function ingestionFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: IngestionFetchOptions,
): Promise<Response> {
  const doFetch: typeof fetch = options.fetchImpl || ((...args) => fetch(...args));
  const context = options.context || 'ingestion';
  const scopeId = options.authScopeId;
  const scope = scopeState(scopeId);
  let auth = options.getAuth();

  const emit = (type: IngestionAuthLifecycleType, generation: number, extra: Partial<IngestionAuthLifecycleEvent> = {}) => {
    const event: IngestionAuthLifecycleEvent = { version: 1, type, scopeId, context, at: Date.now(), generation, ...extra };
    const deliver = (fn: (e: IngestionAuthLifecycleEvent) => void) => {
      try {
        fn(event);
      } catch (err) {
        console.warn('[ingestionFetch] lifecycle listener failed:', (err as Error)?.message || err);
      }
    };
    if (options.onLifecycleEvent) deliver(options.onLifecycleEvent);
    listeners.forEach(deliver);
  };
  const refreshed = (epoch: number, generation: number, credentialsRotated: boolean) => {
    if (scope.refreshedEpoch === epoch) return;
    scope.refreshedEpoch = epoch;
    emit('refreshed', generation, { credentialsRotated });
  };

  let info = await auth.getTokenInfo();
  let response = await doFetch(input, withBearer(input, init, info.token));
  if (!(await isAuthFailure(response, options))) return response;

  emit('expired', info.generation, { status: response.status });
  if (!recoveryEnabled) return response;
  if (scope.breakerUntil > Date.now()) {
    emit('failed', info.generation, { category: 'circuit_open', retryable: true });
    return response;
  }

  let failure: { category: IngestionRecoveryFailureCategory; retryable: boolean } = {
    category: 'unauthorized',
    retryable: false,
  };

  // 1 — a new token with the same credentials, then the request again, exactly once (AC-04)
  let stageOneDone = false;
  try {
    await refreshScope(scope, auth, info.generation, () => emit('refresh-started', info.generation));
    const epoch = scope.epoch;
    info = await auth.getTokenInfo();
    stageOneDone = true;
    response = await doFetch(input, withBearer(input, init, info.token));
    if (!(await isAuthFailure(response, options))) {
      if (response.ok) refreshed(epoch, info.generation, false); // only after the data answer (AC-05)
      return response;
    }
  } catch (err) {
    if (stageOneDone || !(err instanceof IngestionAuthError)) throw err;
    failure = { category: err.category, retryable: err.retryable };
    if (err.category !== 'invalid_client') return fail();
  }

  // 2 — the credentials may have been rotated: re-read them, lazily and once per scope. Only a
  // proven rotation earns a third call (AC-07, AC-08).
  if (options.refreshCredentials) {
    const rotated = await rotateScope(scope, options.refreshCredentials);
    if (rotated) {
      auth = rotated;
      const epoch = scope.epoch;
      let tokenReady = false;
      try {
        info = await auth.getTokenInfo();
        tokenReady = true;
        response = await doFetch(input, withBearer(input, init, info.token));
        if (!(await isAuthFailure(response, options))) {
          if (response.ok) refreshed(epoch, info.generation, true);
          return response;
        }
        failure = { category: 'unauthorized', retryable: false };
      } catch (err) {
        if (tokenReady || !(err instanceof IngestionAuthError)) throw err;
        failure = { category: err.category, retryable: err.retryable };
      }
    }
  }
  return fail();

  function fail(): Response {
    if (!failure.retryable) scope.breakerUntil = Date.now() + (options.breakerMs ?? INGESTION_AUTH_BREAKER_MS);
    console.warn(`[ingestionFetch] ${context}: token recovery failed (${failure.category})`);
    emit('failed', info.generation, { category: failure.category, retryable: failure.retryable });
    return response;
  }
}
