import { describe, expect, it, vi } from 'vitest';
import { createMyioGcdrLoginSubmit, mapGcdrResponse } from '../../../src/components/myio-gcdr-login/gcdrClient';

const env = (code: string, details?: Record<string, unknown>) => ({
  success: false,
  error: { code, message: 'texto do backend', ...(details ? { details } : {}) },
  meta: { requestId: 'r', timestamp: 't' },
});

describe('RFC-0236 §4.6 — GCDR response mapping', () => {
  it.each([
    [200, { success: true, data: { accessToken: 'a', refreshToken: 'b' } }, { ok: true }],
    [200, { success: true, data: { mfaRequired: true, mfaToken: 'm' } }, { ok: false, code: 'MFA_REQUIRED' }],
    [200, { success: true, data: {} }, { ok: false, code: 'INTEGRATION_ERROR' }],
    [200, undefined, { ok: false, code: 'INTEGRATION_ERROR' }],
    [400, env('CAPTCHA_FAILED'), { ok: false, code: 'CAPTCHA_FAILED' }],
    [400, env('VALIDATION_ERROR'), { ok: false, code: 'SERVER' }],
    [401, env('INVALID_CREDENTIALS', { remainingAttempts: 3 }), { ok: false, code: 'INVALID_CREDENTIALS', remainingAttempts: 3 }],
    [401, env('UNAUTHORIZED'), { ok: false, code: 'INVALID_CREDENTIALS' }],
    [401, undefined, { ok: false, code: 'INVALID_CREDENTIALS' }],
    [403, env('ACCOUNT_LOCKED'), { ok: false, code: 'ACCOUNT_LOCKED' }],
    [403, env('FORBIDDEN'), { ok: false, code: 'SERVER' }],
    [429, env('RATE_LIMITED'), { ok: false, code: 'TOO_MANY_REQUESTS' }],
    [500, env('INTERNAL'), { ok: false, code: 'SERVER' }],
  ])('%i %j', (status, body, expected) => {
    expect(mapGcdrResponse(status, body)).toMatchObject(expected);
  });

  it('never surfaces error.message', () => {
    const r = mapGcdrResponse(401, env('UNAUTHORIZED'));
    expect(JSON.stringify(r)).not.toContain('texto do backend');
  });
});

describe('RFC-0236 §4.6 — request', () => {
  it('posts the documented shape', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { accessToken: 'x' } }), { status: 200 }));
    const submit = createMyioGcdrLoginSubmit({ apiUrl: 'https://api.test/api/v1/', tenantId: 'T', fetch: fetchMock as unknown as typeof fetch, extraHeaders: { 'x-a': '1' } });
    const r = await submit({ email: 'a@b.com', password: ' p ', remember: true, locale: 'pt-BR' }, { signal: new AbortController().signal, attempt: 1 });
    expect(r).toMatchObject({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/auth/login');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect((init.headers as Record<string, string>)['x-tenant-id']).toBe('T');
    expect((init.headers as Record<string, string>)['x-a']).toBe('1');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'a@b.com', password: ' p ' });
  });

  it('network failure → NETWORK', async () => {
    const submit = createMyioGcdrLoginSubmit({ apiUrl: 'https://api.test', tenantId: 'T', fetch: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch });
    await expect(submit({ email: 'a@b.com', password: 'p', remember: false, locale: 'en' }, { signal: new AbortController().signal, attempt: 1 })).resolves.toEqual({ ok: false, code: 'NETWORK' });
  });

  it('timeout rejects with a TIMEOUT-tagged error', async () => {
    vi.useFakeTimers();
    const slow = ((_u: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch;
    const submit = createMyioGcdrLoginSubmit({ apiUrl: 'https://api.test', tenantId: 'T', fetch: slow, timeoutMs: 1000 });
    const p = submit({ email: 'a@b.com', password: 'p', remember: false, locale: 'en' }, { signal: new AbortController().signal, attempt: 1 });
    const assertion = expect(p).rejects.toMatchObject({ myioGcdrCode: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    vi.useRealTimers();
  });

  it('rejects invalid options', () => {
    expect(() => createMyioGcdrLoginSubmit({ apiUrl: '', tenantId: 'T' })).toThrow(TypeError);
    expect(() => createMyioGcdrLoginSubmit({ apiUrl: 'x', tenantId: '' })).toThrow(TypeError);
    expect(() => createMyioGcdrLoginSubmit({ apiUrl: 'x', tenantId: 'T', timeoutMs: 0 })).toThrow(TypeError);
  });
});
