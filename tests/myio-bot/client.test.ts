// RFC-0242 — createMyIOBotClient: envelope, auth, headers, timeouts, errors, resolve(), context, fallbacks.
import { describe, it, expect, vi } from 'vitest';
import {
  createMyIOBotClient,
  MyIOBotError,
  isMyIOBotError,
  applyBotContextPrefix,
  stripBotContextPrefix,
  formatBotContextLine,
  type MyIOBotStreamEvent,
} from '../../src/components/myio-bot';
import { BASE, conv, fail, fakeResponse, ok, routedFetch, sse, statusData, turn } from './helpers';

const CID = '11111111-1111-1111-1111-111111111111';

function client(routes: Parameters<typeof routedFetch>[0], extra: Record<string, unknown> = {}) {
  const r = routedFetch(routes);
  const c = createMyIOBotClient({ gcdrApiBaseUrl: `${BASE}/`, auth: { apiKey: 'test-key', tenantId: 'tenant-test' }, host: { app: 'tests', version: '1.0' }, fetch: r.fetch, ...extra });
  return { c, ...r };
}

async function collect(it: AsyncIterable<MyIOBotStreamEvent>) {
  const out: MyIOBotStreamEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe('auth strategies', () => {
  it('requires exactly one of apiKey / bearerToken', () => {
    const f = vi.fn() as unknown as typeof fetch;
    expect(() => createMyIOBotClient({ gcdrApiBaseUrl: BASE, auth: {}, fetch: f })).toThrow(/required/);
    expect(() => createMyIOBotClient({ gcdrApiBaseUrl: BASE, auth: { apiKey: 'k', bearerToken: 't' }, fetch: f })).toThrow(/exactly one/);
    try {
      createMyIOBotClient({ gcdrApiBaseUrl: BASE, auth: {}, fetch: f });
    } catch (e) {
      expect(isMyIOBotError(e)).toBe(true);
      expect((e as MyIOBotError).code).toBe('CONFIG_ERROR');
    }
  });

  it('requires gcdrApiBaseUrl', () => {
    expect(() => createMyIOBotClient({ gcdrApiBaseUrl: '', auth: { apiKey: 'k' }, fetch: vi.fn() as unknown as typeof fetch })).toThrow(/gcdrApiBaseUrl/);
  });

  it('API key → X-API-Key + X-Tenant-Id, no Authorization', async () => {
    const { c, calls } = client({ 'GET /bot/status': () => ok(statusData()) });
    await c.status();
    expect(calls[0].url).toBe(`${BASE}/bot/status`);
    expect(calls[0].headers['X-API-Key']).toBe('test-key');
    expect(calls[0].headers['X-Tenant-Id']).toBe('tenant-test');
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[0].headers.Accept).toBe('application/json');
  });

  it('bearer → resolved per request (function form)', async () => {
    const r = routedFetch({ 'GET /bot/status': () => ok(statusData({ kind: 'USER' })) });
    let n = 0;
    const c = createMyIOBotClient({ gcdrApiBaseUrl: BASE, auth: { bearerToken: async () => `jwt-${++n}`, tenantId: 't1' }, fetch: r.fetch });
    await c.status();
    await c.status();
    expect(r.calls[0].headers.Authorization).toBe('Bearer jwt-1');
    expect(r.calls[1].headers.Authorization).toBe('Bearer jwt-2');
    expect(r.calls[0].headers['X-API-Key']).toBeUndefined();
  });
});

describe('headers', () => {
  it('does not send X-MyIO-Bot-* by default (GCDR CORS does not allow them yet)', async () => {
    const { c, calls } = client({ 'GET /bot/status': () => ok(statusData()) });
    await c.status();
    expect(calls[0].headers['X-MyIO-Bot-Client']).toBeUndefined();
    expect(calls[0].headers['X-MyIO-Bot-Protocol']).toBeUndefined();
  });

  it('sends X-MyIO-Bot-Client and X-MyIO-Bot-Protocol when sendClientHeaders', async () => {
    const { c, calls } = client({ 'GET /bot/status': () => ok(statusData()) }, { sendClientHeaders: true });
    await c.status();
    expect(calls[0].headers['X-MyIO-Bot-Client']).toBe('tests/1.0');
    expect(calls[0].headers['X-MyIO-Bot-Protocol']).toBe('1');
  });

  it('never puts the credential in the URL', async () => {
    const { c, calls } = client({ 'GET /bot/conversations': () => ok({ items: [] }) });
    await c.conversations.list({ scope: 'mine' });
    expect(calls[0].url).not.toContain('test-key');
  });
});

describe('envelope and errors', () => {
  it('status(): unwraps data and defaults protocolVersion to 1', async () => {
    const { c } = client({ 'GET /bot/status': () => ok(statusData()) });
    const s = await c.status();
    expect(s.protocolVersion).toBe(1);
    expect(s.permissions.use).toBe(true);
    expect(s.kind).toBe('API_KEY');
  });

  it('status(): keeps protocolVersion when GCDR sends it', async () => {
    const { c } = client({ 'GET /bot/status': () => ok(statusData({ protocolVersion: 2 })) });
    expect((await c.status()).protocolVersion).toBe(2);
  });

  it('error envelope → MyIOBotError with code, status, requestId', async () => {
    const { c } = client({ 'GET /bot/status': () => fail(403, 'FORBIDDEN', 'Sem permissão') });
    const e = await c.status().catch((x) => x);
    expect(e).toBeInstanceOf(MyIOBotError);
    expect(e).toMatchObject({ code: 'FORBIDDEN', status: 403, message: 'Sem permissão', requestId: 'rid-err' });
  });

  it('non-envelope error → HTTP_<status>', async () => {
    const { c } = client({ 'GET /bot/status': () => fakeResponse({ status: 502, contentType: 'text/html' }) });
    await expect(c.status()).rejects.toMatchObject({ code: 'HTTP_502', status: 502 });
  });

  it('2xx that is not an envelope → INVALID_RESPONSE', async () => {
    const { c } = client({ 'GET /bot/status': () => fakeResponse({ json: { hello: 1 } }) });
    await expect(c.status()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('fetch rejection → NETWORK_ERROR', async () => {
    const f = vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    const c = createMyIOBotClient({ gcdrApiBaseUrl: BASE, auth: { apiKey: 'test-key' }, fetch: f });
    await expect(c.status()).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });

  it('timeout → TIMEOUT (short timeout for status)', async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })) as unknown as typeof fetch;
    const c = createMyIOBotClient({ gcdrApiBaseUrl: BASE, auth: { apiKey: 'test-key' }, fetch: f, shortTimeoutMs: 20 });
    await expect(c.status()).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('caller abort → ABORTED', async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })) as unknown as typeof fetch;
    const c = createMyIOBotClient({ gcdrApiBaseUrl: BASE, auth: { apiKey: 'test-key' }, fetch: f });
    const ctrl = new AbortController();
    const p = c.conversations.send(CID, { message: 'oi' }, ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('never logs (no console output on failures)', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const { c } = client({ 'GET /bot/status': () => fail(401, 'UNAUTHORIZED') });
    await c.status().catch(() => undefined);
    for (const s of spies) { expect(s).not.toHaveBeenCalled(); s.mockRestore(); }
  });
});

describe('conversations', () => {
  it('list(): items and query params', async () => {
    const { c, calls } = client({ 'GET /bot/conversations': () => ok({ items: [conv()] }) });
    const items = await c.conversations.list({ scope: 'mine', limit: 5 });
    expect(items).toHaveLength(1);
    expect(calls[0].url).toContain('scope=mine');
    expect(calls[0].url).toContain('limit=5');
  });

  it('create(): only fields GCDR accepts (strict schema)', async () => {
    const { c, calls } = client({ 'POST /bot/conversations': () => ok(conv(), 201) });
    await c.conversations.create({ title: 'x'.repeat(300), clientThreadKey: 'k' });
    expect(Object.keys(calls[0].body as object).sort()).toEqual(['clientThreadKey', 'title']);
    expect((calls[0].body as { title: string }).title).toHaveLength(200);
  });

  it('resolve(): finds by clientThreadKey client-side even when the filter is ignored', async () => {
    const { c, calls } = client({
      'GET /bot/conversations': () => ok({ items: [
        conv({ id: 'a', clientThreadKey: 'other' }),
        conv({ id: 'b', clientThreadKey: 'k1', updatedAt: '2026-11-20T00:00:00Z' }),
        conv({ id: 'c', clientThreadKey: 'k1', updatedAt: '2026-11-23T00:00:00Z' }),
        conv({ id: 'd', clientThreadKey: 'k1', status: 'CLOSED', updatedAt: '2026-11-24T00:00:00Z' }),
      ] }),
    });
    const found = await c.conversations.resolve('k1');
    expect(found.id).toBe('c');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('clientThreadKey=k1');
  });

  it('resolve(): creates with the key when nothing matches', async () => {
    const { c, calls } = client({
      'GET /bot/conversations': () => ok({ items: [conv({ clientThreadKey: 'zzz' })] }),
      'POST /bot/conversations': () => ok(conv({ id: 'new', clientThreadKey: 'k1' }), 201),
    });
    const r = await c.conversations.resolve('k1', { title: 'Moxuara' });
    expect(r.id).toBe('new');
    expect(calls[1].body).toEqual({ clientThreadKey: 'k1', title: 'Moxuara' });
  });

  it('get(): splits the flattened GCDR detail into { conversation, messages }', async () => {
    const { c } = client({
      'GET /bot/conversations/{id}': () => ok({ ...conv({ title: 'T' }), messages: [{ id: 1, seq: 1, role: 'user', content: 'oi' }] }),
    });
    const d = await c.conversations.get(CID);
    expect(d.conversation.title).toBe('T');
    expect((d.conversation as unknown as Record<string, unknown>).messages).toBeUndefined();
    expect(d.messages).toHaveLength(1);
  });

  it('patch(): PATCH body', async () => {
    const { c, calls } = client({ 'PATCH /bot/conversations/{id}': () => ok(conv({ status: 'CLOSED' })) });
    const r = await c.conversations.patch(CID, { status: 'CLOSED' });
    expect(r.status).toBe('CLOSED');
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].body).toEqual({ status: 'CLOSED' });
  });

  it('send(): JSON turn, Accept application/json, body { message } only', async () => {
    const { c, calls } = client({ 'POST /bot/conversations/{id}/messages': () => ok(turn()) });
    const t = await c.conversations.send(CID, { message: 'oi' });
    expect(t.answer).toBe('Olá, tudo certo.');
    expect(calls[0].headers.Accept).toBe('application/json');
    expect(calls[0].body).toEqual({ message: 'oi' });
  });

  it('send(): empty message is a local VALIDATION_ERROR', async () => {
    const { c, calls } = client({});
    await expect(c.conversations.send(CID, { message: '  ' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(calls).toHaveLength(0);
  });
});

describe('context', () => {
  it('formats, prefixes after /think and strips back', () => {
    const line = formatBotContextLine({ customerName: 'Moxuara', page: 'telemetry' });
    expect(line).toBe('[Contexto: cliente Moxuara · página telemetry]');
    const msg = applyBotContextPrefix('/think quais centrais?', line);
    expect(msg.startsWith('/think [Contexto:')).toBe(true);
    expect(stripBotContextPrefix(msg)).toBe('/think quais centrais?');
    expect(stripBotContextPrefix(applyBotContextPrefix('oi', line))).toBe('oi');
    expect(formatBotContextLine({})).toBe('');
  });

  it('prefix mode: sent once per conversation and per context value, never as a field', async () => {
    const { c, calls } = client({ 'POST /bot/conversations/{id}/messages': () => ok(turn()) });
    const ctx = { customerName: 'Moxuara', page: 'telemetry' };
    await c.conversations.send(CID, { message: 'a', context: ctx });
    await c.conversations.send(CID, { message: 'b', context: ctx });
    await c.conversations.send(CID, { message: 'c', context: { ...ctx, page: 'water' } });
    const bodies = calls.map((x) => x.body as { message: string; context?: unknown });
    expect(bodies[0].message).toBe('[Contexto: cliente Moxuara · página telemetry]\na');
    expect(bodies[1].message).toBe('b');
    expect(bodies[2].message).toBe('[Contexto: cliente Moxuara · página water]\nc');
    expect(bodies.every((b) => b.context === undefined)).toBe(true);
  });

  it('prefix mode: a resumed thread whose history already carries the line is not re-prefixed', async () => {
    const { c, calls } = client({
      'GET /bot/conversations/{id}': () => ok({ ...conv(), messages: [{ id: 1, seq: 1, role: 'user', content: '[Contexto: cliente Moxuara]\noi' }] }),
      'POST /bot/conversations/{id}/messages': () => ok(turn()),
    });
    await c.conversations.get(CID);
    await c.conversations.send(CID, { message: 'de novo', context: { customerName: 'Moxuara' } });
    expect((calls[1].body as { message: string }).message).toBe('de novo');
  });

  it('field mode: sends context next to message', async () => {
    const { c, calls } = client({ 'POST /bot/conversations/{id}/messages': () => ok(turn()) }, { contextMode: 'field' });
    await c.conversations.send(CID, { message: 'a', context: { page: 'p' } });
    expect(calls[0].body).toEqual({ message: 'a', context: { page: 'p' } });
  });
});

describe('stream()', () => {
  it('SSE: Accept text/event-stream, deltas then done', async () => {
    const { c, calls } = client({
      'POST /bot/conversations/{id}/messages': () => fakeResponse({ chunks: [sse(['delta', { text: 'Ol' }], ['delta', { text: 'á' }]), sse(['done', turn({ answer: 'Olá' })])] }),
    });
    const evs = await collect(c.conversations.stream(CID, { message: 'oi' }));
    expect(calls[0].headers.Accept).toBe('text/event-stream');
    expect(evs.map((e) => e.type)).toEqual(['delta', 'delta', 'done']);
  });

  it('server that answers JSON instead of SSE → done (no second request)', async () => {
    const { c, calls } = client({ 'POST /bot/conversations/{id}/messages': () => ok(turn({ answer: 'json' })) });
    const evs = await collect(c.conversations.stream(CID, { message: 'oi' }));
    expect(evs).toEqual([{ type: 'done', turn: expect.objectContaining({ answer: 'json' }) }]);
    expect(calls).toHaveLength(1);
  });

  it('API error codes never retry (BOT_DISABLED)', async () => {
    const { c, calls } = client({ 'POST /bot/conversations/{id}/messages': () => fail(503, 'BOT_DISABLED') });
    const evs = await collect(c.conversations.stream(CID, { message: 'oi' }));
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ type: 'error', error: { code: 'BOT_DISABLED', status: 503 } });
    expect(calls).toHaveLength(1);
  });

  it('SSE error event (BOT_BUDGET_EXCEEDED) is surfaced, not retried', async () => {
    const { c, calls } = client({
      'POST /bot/conversations/{id}/messages': () => fakeResponse({ chunks: [sse(['error', { code: 'BOT_BUDGET_EXCEEDED', message: 'x', statusCode: 429 }])] }),
    });
    const evs = await collect(c.conversations.stream(CID, { message: 'oi' }));
    expect(evs[0]).toMatchObject({ type: 'error', error: { code: 'BOT_BUDGET_EXCEEDED' } });
    expect(calls).toHaveLength(1);
  });

  it('transport failure before any delta → one JSON fallback (gcdr-frontend rule)', async () => {
    let n = 0;
    const { c, calls } = client({
      'POST /bot/conversations/{id}/messages': () => (++n === 1 ? fakeResponse({ chunks: [': nothing\n\n'] }) : ok(turn({ answer: 'via json' }))),
    });
    const evs = await collect(c.conversations.stream(CID, { message: 'oi' }));
    expect(calls).toHaveLength(2);
    expect(calls[1].headers.Accept).toBe('application/json');
    expect(evs.map((e) => e.type)).toEqual(['delta', 'done']);
  });

  it('no JSON fallback once something streamed', async () => {
    const { c, calls } = client({
      'POST /bot/conversations/{id}/messages': () => fakeResponse({ chunks: [sse(['delta', { text: 'meio' }])] }),
    });
    const evs = await collect(c.conversations.stream(CID, { message: 'oi' }));
    expect(calls).toHaveLength(1);
    expect(evs[evs.length - 1]).toMatchObject({ type: 'error', error: { code: 'STREAM_INCOMPLETE' } });
  });

  it('jsonFallback: false disables the fallback', async () => {
    const { c, calls } = client({ 'POST /bot/conversations/{id}/messages': () => fakeResponse({ chunks: [''] }) }, { jsonFallback: false });
    const evs = await collect(c.conversations.stream(CID, { message: 'oi' }));
    expect(calls).toHaveLength(1);
    expect(evs[0]).toMatchObject({ type: 'error', error: { code: 'STREAM_INCOMPLETE' } });
  });
});

describe('memories and actions', () => {
  it('search(): q, scopes, limit → items', async () => {
    const { c, calls } = client({ 'GET /bot/memories/search': () => ok({ items: [{ id: 'm1', rank: 0.5 }] }) });
    const items = await c.memories.search('elevador', { scopes: ['CUSTOMER', 'COMPANY'], limit: 5 });
    expect(items).toHaveLength(1);
    expect(calls[0].url).toContain('q=elevador');
    expect(calls[0].url).toContain('scopes=CUSTOMER%2CCOMPANY');
  });

  it('propose(): POST /bot/memories returns { memory, similar, autoActivated }', async () => {
    const { c } = client({ 'POST /bot/memories': () => ok({ memory: { id: 'm1' }, similar: [], autoActivated: false }, 201) });
    const r = await c.memories.propose({ scope: { scopeType: 'COMPANY' }, kind: 'FACT', summary: 's', content: 'c' });
    expect(r.memory.id).toBe('m1');
  });

  it('decide(): approve / reject (with reason) via PATCH', async () => {
    const { c, calls } = client({ 'PATCH /bot/memories/{id}': () => ok({ id: 'm1' }) });
    await c.memories.decide('m1', 'approve');
    await c.memories.decide('m1', 'reject');
    expect(calls[0].body).toEqual({ action: 'approve' });
    expect(calls[1].body).toEqual({ action: 'reject', reason: 'descartada na conversa' });
  });

  it('actions.confirm / cancel hit /bot/actions/{id}/*', async () => {
    const { c, calls } = client({
      'POST /bot/actions/{id}/confirm': () => ok({ id: 'a1', status: 'DONE' }),
      'POST /bot/actions/{id}/cancel': () => ok({ id: 'a1', status: 'CANCELLED' }),
    });
    expect(await c.actions.confirm('a1')).toMatchObject({ status: 'DONE' });
    await c.actions.cancel('a1');
    expect(calls.map((x) => x.path)).toEqual(['/bot/actions/a1/confirm', '/bot/actions/a1/cancel']);
  });

  it('actions.* surface the 404 of a GCDR without D-20 as MyIOBotError', async () => {
    const { c } = client({});
    const e = await c.actions.confirm('a1').catch((x) => x);
    expect(isMyIOBotError(e)).toBe(true);
    expect(e).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});
