/**
 * MyIO Ingestion Authentication Component
 *
 * Factory function that creates authentication instances with shared token caching
 * based on credentials. Multiple instances with the same credentials will share
 * the same token cache for efficiency.
 *
 * RFC-0224: each cache entry carries a generation. `invalidate()` bumps it, and an `/auth`
 * request started under an older generation never publishes its token, so a late answer
 * cannot overwrite a newer token. `/auth` failures are `IngestionAuthError`s with a category.
 * No client secret is kept in clear in cache keys, statistics, errors or logs.
 */

/**
 * Authentication configuration parameters
 */
export interface MyIOAuthConfig {
  dataApiHost: string;
  clientId: string;
  clientSecret: string;
  renewSkewSeconds?: number;
  retryBaseMs?: number;
  retryMaxAttempts?: number;
}

/** A token and the cache generation it was published under. */
export interface MyIOAuthTokenInfo {
  token: string;
  generation: number;
}

/**
 * Authentication instance interface
 */
export interface MyIOAuthInstance {
  getToken(): Promise<string>;
  /** Token plus the generation it belongs to (used by `ingestionFetch` to coordinate recovery). */
  getTokenInfo(): Promise<MyIOAuthTokenInfo>;
  /**
   * Invalidates the token and gets a new one, one `/auth` per cache entry. With `staleGeneration`,
   * it only invalidates when the token is still of that generation — otherwise it returns the
   * current (newer) token.
   */
  forceRefresh(staleGeneration?: number): Promise<string>;
  /** Drops the token and bumps the generation; an `/auth` already running will not publish. */
  invalidate(reason?: string): void;
  getGeneration(): number;
  getExpiryInfo(): { expiresAt: number; expiresInSeconds: number };
  /** @deprecated use `invalidate()` — kept for compatibility. */
  clearCache(): void;
  isTokenValid(): boolean;
}

export type IngestionAuthErrorCategory = 'invalid_client' | 'network' | 'server' | 'malformed_response';

/**
 * `/auth` failure. The response body is not kept: it may echo the request.
 */
export class IngestionAuthError extends Error {
  readonly category: IngestionAuthErrorCategory;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(category: IngestionAuthErrorCategory, status: number | null, message: string) {
    super(message);
    this.name = 'IngestionAuthError';
    this.category = category;
    this.status = status;
    this.retryable = category === 'network' || (category === 'server' && isRetryableStatus(status));
  }
}

function isRetryableStatus(status: number | null): boolean {
  return status == null || status === 408 || status === 429 || status >= 500;
}

/**
 * Internal cache entry structure
 */
interface CacheEntry {
  token: string | null;
  expiresAt: number;
  /** Bumped by invalidate(). */
  generation: number;
  /** Generation the current token was published under. */
  tokenGeneration: number;
  inFlight: Promise<MyIOAuthTokenInfo> | null;
  inFlightGeneration: number;
}

/**
 * Global cache map keyed by host, client and a fingerprint of the secret
 * This allows multiple instances with same credentials to share cache
 */
const globalCache = new Map<string, CacheEntry>();

/** FNV-1a (32 bit) as hex — a non-reversible fingerprint for keys and ids, not a security hash. */
export function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Fingerprint of a secret (64 bit from two FNV-1a passes) — never the secret itself. */
function secretFingerprint(secret: string): string {
  return fnv1aHex(secret) + fnv1aHex(`${secret}\u0001`);
}

/**
 * Generate a cache key from credentials (the secret only as a fingerprint)
 */
function generateCacheKey(config: MyIOAuthConfig): string {
  return `${config.dataApiHost}|${config.clientId}|${secretFingerprint(config.clientSecret)}`;
}

function newEntry(): CacheEntry {
  return { token: null, expiresAt: 0, generation: 0, tokenGeneration: 0, inFlight: null, inFlightGeneration: -1 };
}

/**
 * Create a MyIO Ingestion Authentication instance
 *
 * Multiple instances with the same credentials will share the same token cache,
 * which is efficient and prevents unnecessary API calls.
 *
 * @param config Authentication configuration
 * @returns Authentication instance
 *
 * @example
 * ```typescript
 * const auth = buildMyioIngestionAuth({
 *   dataApiHost: 'https://api.data.apps.myio-bas.com/api/v1',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret'
 * });
 *
 * const token = await auth.getToken();
 * ```
 */
export function buildMyioIngestionAuth(config: MyIOAuthConfig): MyIOAuthInstance {
  const {
    dataApiHost,
    clientId,
    clientSecret,
    renewSkewSeconds = 60,
    retryBaseMs = 500,
    retryMaxAttempts = 3
  } = config;

  // Validate required parameters
  if (!dataApiHost || !clientId || !clientSecret) {
    throw new Error('dataApiHost, clientId, and clientSecret are required');
  }

  const authUrl = new URL(`${dataApiHost}/auth`);
  const cacheKey = generateCacheKey(config);

  // Get or create cache entry for this set of credentials
  if (!globalCache.has(cacheKey)) {
    globalCache.set(cacheKey, newEntry());
  }

  // Looked up on every call, so clearAllAuthCaches() never leaves instances on an orphan entry
  function entry(): CacheEntry {
    let cache = globalCache.get(cacheKey);
    if (!cache) {
      cache = newEntry();
      globalCache.set(cacheKey, cache);
    }
    return cache;
  }

  function now(): number {
    return Date.now();
  }

  function aboutToExpire(cache: CacheEntry): boolean {
    if (!cache.token) return true;
    const skewMs = renewSkewSeconds * 1000;
    return now() >= cache.expiresAt - skewMs;
  }

  async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function authenticateOnce(): Promise<{ token: string; expiresIn: number }> {
    let response: Response;
    try {
      response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
    } catch (error) {
      throw new IngestionAuthError('network', null, `Auth request failed: ${error instanceof Error ? error.message : 'network error'}`);
    }

    if (!response.ok) {
      const category: IngestionAuthErrorCategory =
        response.status === 400 || response.status === 401 || response.status === 403 ? 'invalid_client' : 'server';
      throw new IngestionAuthError(category, response.status, `Auth failed: HTTP ${response.status} ${response.statusText || ''}`.trim());
    }

    let json: { access_token?: string; expires_in?: number | string } | null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    // Validate response format
    if (!json || !json.access_token || !json.expires_in) {
      throw new IngestionAuthError('malformed_response', response.status, 'Auth response missing required fields (access_token, expires_in)');
    }
    return { token: json.access_token, expiresIn: Number(json.expires_in) };
  }

  async function requestNewToken(cache: CacheEntry, generation: number): Promise<MyIOAuthTokenInfo> {
    let attempt = 0;
    while (true) {
      try {
        const { token, expiresIn } = await authenticateOnce();

        // Publish only if nothing invalidated this generation meanwhile
        if (cache.generation === generation) {
          cache.token = token;
          cache.expiresAt = now() + expiresIn * 1000;
          cache.tokenGeneration = generation;
        }

        console.log(
          `[MyIOAuth] New token obtained for ${clientId}. Expires in ~${Math.round(expiresIn / 60)} min`
        );

        return { token, generation };
      } catch (error) {
        attempt++;
        const authError = error instanceof IngestionAuthError ? error : null;
        console.warn(
          `[MyIOAuth] Error obtaining token (attempt ${attempt}/${retryMaxAttempts}):`,
          error instanceof Error ? error.message : error
        );

        if (attempt >= retryMaxAttempts || (authError && !authError.retryable)) {
          throw error;
        }

        const backoff = retryBaseMs * Math.pow(2, attempt - 1);
        await sleep(backoff);
      }
    }
  }

  function startRequest(cache: CacheEntry): Promise<MyIOAuthTokenInfo> {
    const generation = cache.generation;
    // try/finally instead of Promise#finally: some pages replace Promise with a polyfill without it
    const flight: Promise<MyIOAuthTokenInfo> = (async () => {
      try {
        return await requestNewToken(cache, generation);
      } finally {
        if (cache.inFlight === flight) cache.inFlight = null;
      }
    })();
    cache.inFlight = flight;
    cache.inFlightGeneration = generation;
    return flight;
  }

  async function getTokenInfo(): Promise<MyIOAuthTokenInfo> {
    const cache = entry();
    // Prevent multiple parallel token requests for the same credentials
    if (cache.inFlight && cache.inFlightGeneration === cache.generation) {
      return cache.inFlight;
    }

    if (aboutToExpire(cache)) {
      return startRequest(cache);
    }

    return { token: cache.token!, generation: cache.tokenGeneration };
  }

  async function getToken(): Promise<string> {
    return (await getTokenInfo()).token;
  }

  function invalidate(_reason?: string): void {
    const cache = entry();
    cache.generation += 1;
    cache.token = null;
    cache.expiresAt = 0;
    cache.inFlight = null;
  }

  async function forceRefresh(staleGeneration?: number): Promise<string> {
    const cache = entry();
    if (staleGeneration === undefined || cache.generation <= staleGeneration) {
      invalidate('forceRefresh');
    }
    return getToken();
  }

  function getGeneration(): number {
    return entry().generation;
  }

  function getExpiryInfo(): { expiresAt: number; expiresInSeconds: number } {
    const cache = globalCache.get(cacheKey);
    const expiresAt = cache ? cache.expiresAt : 0;
    return {
      expiresAt,
      expiresInSeconds: Math.max(0, Math.floor((expiresAt - now()) / 1000)),
    };
  }

  function clearCache(): void {
    invalidate('clearCache');
  }

  function isTokenValid(): boolean {
    // Check if cache still exists (might have been cleared globally)
    const cache = globalCache.get(cacheKey);
    if (!cache) {
      return false;
    }
    return !aboutToExpire(cache);
  }

  return {
    getToken,
    getTokenInfo,
    forceRefresh,
    invalidate,
    getGeneration,
    getExpiryInfo,
    clearCache,
    isTokenValid
  };
}

/**
 * Clear all cached tokens (useful for testing or logout scenarios)
 */
export function clearAllAuthCaches(): void {
  globalCache.clear();
}

/**
 * Get cache statistics (useful for debugging) — opaque ids only, no credentials.
 */
export function getAuthCacheStats(): { totalCaches: number; cacheKeys: string[] } {
  return {
    totalCaches: globalCache.size,
    cacheKeys: Array.from(globalCache.keys()).map((key) => `auth_${fnv1aHex(key)}`)
  };
}
