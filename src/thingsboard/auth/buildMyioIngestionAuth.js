/**
 * MyIO Ingestion Authentication Component (JavaScript version)
 * 
 * Factory function that creates authentication instances with shared token caching
 * based on credentials. Multiple instances with the same credentials will share
 * the same token cache for efficiency.
 */

/**
 * Global cache map keyed by credentials hash
 * This allows multiple instances with same credentials to share cache
 */
const globalCache = new Map();

/**
 * Generate a cache key from credentials
 */
function generateCacheKey(config) {
  return `${config.dataApiHost}:${config.clientId}:${config.clientSecret}`;
}

/**
 * Create a MyIO Ingestion Authentication instance
 * 
 * Multiple instances with the same credentials will share the same token cache,
 * which is efficient and prevents unnecessary API calls.
 * 
 * @param {Object} config Authentication configuration
 * @param {string} config.dataApiHost API host URL
 * @param {string} config.clientId Client ID for authentication
 * @param {string} config.clientSecret Client secret for authentication
 * @param {number} [config.renewSkewSeconds=60] Seconds before expiry to renew token
 * @param {number} [config.retryBaseMs=500] Base retry delay in milliseconds
 * @param {number} [config.retryMaxAttempts=3] Maximum retry attempts
 * @returns {Object} Authentication instance
 * 
 * @example
 * ```javascript
 * const auth = buildMyioIngestionAuth({
 *   dataApiHost: 'https://api.data.apps.myio-bas.com',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret'
 * });
 * 
 * const token = await auth.getToken();
 * ```
 */
export function buildMyioIngestionAuth(config) {
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

  const authUrl = new URL(`${dataApiHost}/api/v1/auth`);
  const cacheKey = generateCacheKey(config);
  
  // Get or create cache entry for this set of credentials
  if (!globalCache.has(cacheKey)) {
    globalCache.set(cacheKey, {
      token: null,
      expiresAt: 0,
      inFlight: null
    });
  }
  
  const cache = globalCache.get(cacheKey);

  function now() {
    return Date.now();
  }

  function aboutToExpire() {
    if (!cache.token) return true;
    const skewMs = renewSkewSeconds * 1000;
    return now() >= cache.expiresAt - skewMs;
  }

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function requestNewToken() {
    const body = {
      client_id: clientId,
      client_secret: clientSecret,
    };

    let attempt = 0;
    while (true) {
      try {
        const response = await fetch(authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(
            `Auth failed: HTTP ${response.status} ${response.statusText} ${text}`
          );
        }

        const json = await response.json();
        
        // Validate response format
        if (!json || !json.access_token || !json.expires_in) {
          throw new Error('Auth response missing required fields (access_token, expires_in)');
        }

        // Update cache
        cache.token = json.access_token;
        cache.expiresAt = now() + Number(json.expires_in) * 1000;

        console.log(
          `[MyIOAuth] New token obtained for ${clientId}. Expires in ~${Math.round(Number(json.expires_in) / 60)} min`
        );

        return cache.token;
      } catch (error) {
        attempt++;
        console.warn(
          `[MyIOAuth] Error obtaining token (attempt ${attempt}/${retryMaxAttempts}):`,
          error instanceof Error ? error.message : error
        );
        
        if (attempt >= retryMaxAttempts) {
          throw error;
        }
        
        const backoff = retryBaseMs * Math.pow(2, attempt - 1);
        await sleep(backoff);
      }
    }
  }

  async function getToken() {
    // Prevent multiple parallel token requests for the same credentials
    if (cache.inFlight) {
      return cache.inFlight;
    }

    if (aboutToExpire()) {
      cache.inFlight = requestNewToken().finally(() => {
        cache.inFlight = null;
      });
      return cache.inFlight;
    }

    return cache.token;
  }

  function getExpiryInfo() {
    return {
      expiresAt: cache.expiresAt,
      expiresInSeconds: Math.max(0, Math.floor((cache.expiresAt - now()) / 1000)),
    };
  }

  function clearCache() {
    cache.token = null;
    cache.expiresAt = 0;
    cache.inFlight = null;
  }

  function isTokenValid() {
    // Check if cache still exists (might have been cleared globally)
    if (!globalCache.has(cacheKey)) {
      return false;
    }
    return !aboutToExpire();
  }

  return {
    getToken,
    getExpiryInfo,
    clearCache,
    isTokenValid
  };
}

/**
 * Clear all cached tokens (useful for testing or logout scenarios)
 */
export function clearAllAuthCaches() {
  globalCache.clear();
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getAuthCacheStats() {
  return {
    totalCaches: globalCache.size,
    cacheKeys: Array.from(globalCache.keys())
  };
}

// Global function for ThingsBoard widgets
if (typeof window !== 'undefined') {
  window.buildMyioIngestionAuth = buildMyioIngestionAuth;
  window.clearAllAuthCaches = clearAllAuthCaches;
  window.getAuthCacheStats = getAuthCacheStats;
}
