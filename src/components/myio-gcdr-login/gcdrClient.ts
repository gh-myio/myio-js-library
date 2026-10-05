/**
 * RFC-0236 §4.6 — the only implementation of the GCDR login contract
 * (gcdr.git desenv: AuthService.login, AppError, errorHandler, app.ts limiter).
 */
import type { MyioGcdrClientOptions, MyioGcdrLoginResult, MyioGcdrLoginSubmitFn } from './types';

const DEFAULT_TIMEOUT_MS = 15000;

function timeoutError(): Error {
  const e = new Error('GCDR login timed out');
  (e as Error & { myioGcdrCode: string }).myioGcdrCode = 'TIMEOUT';
  return e;
}

export function createMyioGcdrLoginSubmit(options: MyioGcdrClientOptions): MyioGcdrLoginSubmitFn {
  if (!options || typeof options.apiUrl !== 'string' || !options.apiUrl.trim()) {
    throw new TypeError('[MYIO Login] gcdr.apiUrl must be a non-empty string');
  }
  if (typeof options.tenantId !== 'string' || !options.tenantId.trim()) {
    throw new TypeError('[MYIO Login] gcdr.tenantId must be a non-empty string');
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!(typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0)) {
    throw new TypeError('[MYIO Login] gcdr.timeoutMs must be a positive number');
  }
  const base = options.apiUrl.replace(/\/+$/, '').replace(/\/api\/v\d+$/, '');
  const url = `${base}/api/v1/auth/login`;

  return async (input, ctx) => {
    const doFetch = options.fetch ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
    if (!doFetch) throw new TypeError('fetch is not available');

    const ac = new AbortController();
    let timedOut = false;
    const onOuterAbort = () => ac.abort();
    if (ctx?.signal) {
      if (ctx.signal.aborted) ac.abort();
      else ctx.signal.addEventListener('abort', onOuterAbort, { once: true });
    }
    const timer = setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, timeoutMs);

    const body: Record<string, string> = { email: input.email, password: input.password };
    if (input.captchaToken) body.captchaToken = input.captchaToken;

    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': options.tenantId, ...(options.extraHeaders ?? {}) },
        body: JSON.stringify(body),
        credentials: 'omit',
        redirect: 'error',
        signal: ac.signal,
      });
    } catch (err) {
      if (timedOut) throw timeoutError();
      if (ac.signal.aborted) throw err; // outer abort: the view ignores it
      return { ok: false, code: 'NETWORK' };
    } finally {
      clearTimeout(timer);
      ctx?.signal?.removeEventListener('abort', onOuterAbort);
    }

    let json: unknown = undefined;
    try {
      json = await res.json();
    } catch {
      json = undefined;
    }
    return mapGcdrResponse(res.status, json);
  };
}

/** Pure mapping of a GCDR answer (exported for the contract test). */
export function mapGcdrResponse(status: number, json: unknown): MyioGcdrLoginResult {
  const j = (json && typeof json === 'object' ? json : {}) as {
    success?: boolean;
    data?: { accessToken?: unknown; mfaRequired?: unknown };
    error?: { code?: unknown; details?: { remainingAttempts?: unknown } };
  };
  if (status >= 200 && status < 300) {
    const data = j.data;
    if (data && data.mfaRequired === true) return { ok: false, code: 'MFA_REQUIRED' };
    if (data && typeof data.accessToken === 'string' && data.accessToken) return { ok: true, session: data };
    return { ok: false, code: 'INTEGRATION_ERROR' };
  }
  const code = typeof j.error?.code === 'string' ? j.error.code : undefined;
  const remaining = j.error?.details?.remainingAttempts;
  switch (status) {
    case 400:
      return { ok: false, code: code === 'CAPTCHA_FAILED' ? 'CAPTCHA_FAILED' : 'SERVER' };
    case 401:
      return code === 'INVALID_CREDENTIALS' && typeof remaining === 'number'
        ? { ok: false, code: 'INVALID_CREDENTIALS', remainingAttempts: remaining }
        : { ok: false, code: 'INVALID_CREDENTIALS' };
    case 403:
      return { ok: false, code: code === 'ACCOUNT_LOCKED' ? 'ACCOUNT_LOCKED' : 'SERVER' };
    case 429:
      return { ok: false, code: 'TOO_MANY_REQUESTS' };
    default:
      return { ok: false, code: 'SERVER' };
  }
}
