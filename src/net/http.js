/**
 * Fetch wrapper with timeout & retries (exponential backoff + jitter).
 * Requires Node >=18 (fetch built-in) or browser environment.
 * @param {string|URL} url
 * @param {RequestInit & { timeoutMs?: number, maxRetries?: number, baseDelayMs?: number }} [opts]
 * @returns {Promise<Response>}
 */
export async function http(url, opts = {}) {
  const {
    timeoutMs = 10000,
    maxRetries = 2,
    baseDelayMs = 150,
    ...init
  } = opts;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok && shouldRetry(res.status) && attempt < maxRetries) {
        attempt++;
        await delay(backoff(attempt, baseDelayMs));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt < maxRetries && isRetryableError(err)) {
        attempt++;
        await delay(backoff(attempt, baseDelayMs));
        continue;
      }
      throw err;
    }
  }
}

function shouldRetry(status) {
  return status >= 500 || status === 429;
}
function isRetryableError(err) {
  return err?.name === 'AbortError' || err?.code === 'ECONNRESET';
}
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
function backoff(attempt, base) {
  const exp = base * Math.pow(2, attempt - 1);
  const jitter = Math.random() * base;
  return Math.min(2000, exp + jitter); // cap at 2s
}
