// RFC-0242 — SSE parser: delta/done/error, split frames, CRLF, JSON fallback, abort.
import { describe, it, expect } from 'vitest';
import { consumeSseBuffer, readBotEvents, type MyIOBotStreamEvent } from '../../src/components/myio-bot/sse';
import { fakeResponse, sse, turn } from './helpers';

async function collect(it: AsyncIterable<MyIOBotStreamEvent>) {
  const out: MyIOBotStreamEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe('consumeSseBuffer', () => {
  it('emits complete blocks and returns the rest', () => {
    const seen: Array<[string, string]> = [];
    const rest = consumeSseBuffer('event: delta\ndata: {"text":"a"}\n\nevent: delta\ndata: {"te', (e, d) => seen.push([e, d]));
    expect(seen).toEqual([['delta', '{"text":"a"}']]);
    expect(rest).toBe('event: delta\ndata: {"te');
  });

  it('normalises CRLF and joins multi-line data', () => {
    const seen: Array<[string, string]> = [];
    consumeSseBuffer('event: x\r\ndata: line1\r\ndata: line2\r\n\r\n', (e, d) => seen.push([e, d]));
    expect(seen).toEqual([['x', 'line1\nline2']]);
  });

  it('defaults the event name to message and skips blocks without data', () => {
    const seen: string[] = [];
    consumeSseBuffer(': keep-alive\n\ndata: 1\n\n', (e) => seen.push(e));
    expect(seen).toEqual(['message']);
  });
});

describe('readBotEvents', () => {
  it('yields delta events then done', async () => {
    const res = fakeResponse({ chunks: [sse(['delta', { text: 'Ol' }], ['delta', { text: 'á' }], ['done', turn()])] });
    const evs = await collect(readBotEvents(res));
    expect(evs.map((e) => e.type)).toEqual(['delta', 'delta', 'done']);
    expect((evs[2] as { turn: { tier: string } }).turn.tier).toBe('T1');
  });

  it('handles frames split across chunks (even inside a JSON payload)', async () => {
    const full = sse(['delta', { text: 'abc' }], ['done', turn({ answer: 'abc' })]);
    const chunks = [full.slice(0, 7), full.slice(7, 23), full.slice(23, 40), full.slice(40)];
    const evs = await collect(readBotEvents(fakeResponse({ chunks })));
    expect(evs.map((e) => e.type)).toEqual(['delta', 'done']);
    expect((evs[0] as { text: string }).text).toBe('abc');
  });

  it('maps the error event to MyIOBotError with code and statusCode', async () => {
    const res = fakeResponse({ chunks: [sse(['delta', { text: 'x' }], ['error', { code: 'BOT_BUDGET_EXCEEDED', message: 'sem verba', statusCode: 429 }])] });
    const evs = await collect(readBotEvents(res));
    const last = evs[evs.length - 1] as { type: string; error: { code: string; status: number; message: string } };
    expect(last.type).toBe('error');
    expect(last.error.code).toBe('BOT_BUDGET_EXCEEDED');
    expect(last.error.status).toBe(429);
    expect(last.error.message).toBe('sem verba');
  });

  it('reports STREAM_INCOMPLETE when the stream ends without done', async () => {
    const evs = await collect(readBotEvents(fakeResponse({ chunks: [sse(['delta', { text: 'x' }])] })));
    expect(evs[evs.length - 1]).toMatchObject({ type: 'error', error: { code: 'STREAM_INCOMPLETE' } });
  });

  it('stops after done and cancels the reader', async () => {
    const res = fakeResponse({ chunks: [sse(['done', turn()]), sse(['delta', { text: 'late' }])] });
    const evs = await collect(readBotEvents(res));
    expect(evs.map((e) => e.type)).toEqual(['done']);
    expect(res.reader.cancelled).toBe(true);
  });

  it('JSON fallback: a non-SSE success envelope becomes done', async () => {
    const res = fakeResponse({ json: { success: true, data: turn({ answer: 'json' }) } });
    const evs = await collect(readBotEvents(res));
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ type: 'done', turn: { answer: 'json' } });
  });

  it('JSON fallback: an error envelope becomes error with the API code', async () => {
    const res = fakeResponse({ status: 503, json: { success: false, error: { code: 'BOT_DISABLED', message: 'off' }, meta: { requestId: 'r9' } } });
    const evs = await collect(readBotEvents(res));
    expect(evs[0]).toMatchObject({ type: 'error', error: { code: 'BOT_DISABLED', status: 503, requestId: 'r9' } });
  });

  it('JSON fallback: a non-JSON error page becomes HTTP_<status>', async () => {
    const res = fakeResponse({ status: 502, contentType: 'text/html' });
    const evs = await collect(readBotEvents(res));
    expect(evs[0]).toMatchObject({ type: 'error', error: { code: 'HTTP_502', status: 502 } });
  });

  it('reads the whole body via text() when there is no reader', async () => {
    const res = fakeResponse({ chunks: [sse(['delta', { text: 'a' }], ['done', turn()])], noReader: true });
    const evs = await collect(readBotEvents(res));
    expect(evs.map((e) => e.type)).toEqual(['delta', 'done']);
  });

  it('abort: yields ABORTED and stops', async () => {
    const ctrl = new AbortController();
    const res = fakeResponse({ chunks: [sse(['delta', { text: 'a' }]), sse(['delta', { text: 'b' }]), sse(['done', turn()])] });
    const out: MyIOBotStreamEvent[] = [];
    for await (const e of readBotEvents(res, ctrl.signal)) {
      out.push(e);
      if (e.type === 'delta') ctrl.abort();
    }
    expect(out.map((e) => e.type)).toEqual(['delta', 'error']);
    expect(out[1]).toMatchObject({ error: { code: 'ABORTED' } });
  });
});
