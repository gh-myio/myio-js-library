/**
 * RFC-0242 — `text/event-stream` reader for `POST /bot/conversations/{id}/messages`.
 *
 * GCDR emits `event: delta` (`{ text }`), then one `event: done` (the full
 * BotTurnResult, same shape as the JSON answer) or `event: error`
 * (`{ code, message, statusCode }`). A response that is NOT an event stream
 * (an error envelope, a proxy that strips SSE, an old API) is parsed as the
 * JSON turn or error — the gcdr-frontend#168 rule.
 *
 * The reader never throws: every failure becomes one `error` event, then the
 * iteration ends.
 */
import type { MyIOBotTurn } from './contract';
import { MyIOBotError, botErrorFromEnvelope } from './errors';

export type MyIOBotStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; turn: MyIOBotTurn }
  | { type: 'error'; error: MyIOBotError };

/** Minimal Response surface used here (real fetch Responses and test doubles both fit). */
export interface BotResponseLike {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  body?: { getReader(): { read(): Promise<{ value?: Uint8Array; done: boolean }>; cancel?(reason?: unknown): Promise<void> | void } } | null;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/**
 * Parses complete `event: x\ndata: …\n\n` blocks out of a growing buffer and
 * returns the unconsumed rest. CRLF is normalised; multi-line `data:` joined.
 */
export function consumeSseBuffer(buffer: string, emit: (event: string, data: string) => void): string {
  let rest = buffer.replace(/\r\n?/g, '\n');
  let idx = rest.indexOf('\n\n');
  while (idx !== -1) {
    const block = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (data.length) emit(event, data.join('\n'));
    idx = rest.indexOf('\n\n');
  }
  return rest;
}

function requestIdOf(res: BotResponseLike): string | undefined {
  return res.headers.get('x-request-id') || undefined;
}

/** A non-SSE answer to a streaming request: the JSON turn, or its error. */
export async function eventFromJsonResponse(res: BotResponseLike): Promise<MyIOBotStreamEvent> {
  const ct = res.headers.get('content-type') || '';
  let json: unknown = null;
  if (ct.includes('json')) {
    try { json = await res.json(); } catch { json = null; }
  }
  const env = json as { success?: boolean; data?: unknown } | null;
  if (res.ok && env && env.success === true && env.data && typeof env.data === 'object') {
    return { type: 'done', turn: env.data as MyIOBotTurn };
  }
  if (res.ok) {
    return { type: 'error', error: new MyIOBotError('INVALID_RESPONSE', 'Resposta inesperada do GCDR (não é SSE nem envelope).', res.status, requestIdOf(res)) };
  }
  return { type: 'error', error: botErrorFromEnvelope(res.status, json, res.statusText, requestIdOf(res)) };
}

function mapSseEvent(event: string, data: string, status: number): MyIOBotStreamEvent | null {
  let parsed: unknown = null;
  try { parsed = JSON.parse(data); } catch { parsed = null; }
  if (event === 'delta') {
    const text = (parsed as { text?: unknown } | null)?.text;
    return typeof text === 'string' && text ? { type: 'delta', text } : null;
  }
  if (event === 'done') {
    return parsed && typeof parsed === 'object'
      ? { type: 'done', turn: parsed as MyIOBotTurn }
      : { type: 'error', error: new MyIOBotError('INVALID_RESPONSE', 'Evento done sem resultado.', status) };
  }
  if (event === 'error') {
    const e = (parsed || {}) as { code?: unknown; message?: unknown; statusCode?: unknown };
    return {
      type: 'error',
      error: new MyIOBotError(
        typeof e.code === 'string' ? e.code : 'ERROR',
        typeof e.message === 'string' ? e.message : 'erro',
        typeof e.statusCode === 'number' ? e.statusCode : 500
      ),
    };
  }
  return null; // unknown events (comments, keep-alives) are ignored
}

function abortedError(): MyIOBotError {
  return new MyIOBotError('ABORTED', 'Resposta cancelada.', 0);
}

/**
 * Reads the events of a bot response. Handles the JSON fallback, split frames,
 * a missing reader (falls back to `text()`), abort, and the stream ending
 * without `done` (STREAM_INCOMPLETE). Stops after the first `done`/`error`.
 */
export async function* readBotEvents(res: BotResponseLike, signal?: AbortSignal): AsyncGenerator<MyIOBotStreamEvent> {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/event-stream')) {
    yield await eventFromJsonResponse(res);
    return;
  }
  const queue: MyIOBotStreamEvent[] = [];
  let finished = false;
  const emit = (event: string, data: string) => {
    if (finished) return;
    const ev = mapSseEvent(event, data, res.status);
    if (!ev) return;
    queue.push(ev);
    if (ev.type !== 'delta') finished = true;
  };

  const reader = res.body && typeof res.body.getReader === 'function' ? res.body.getReader() : null;
  if (!reader) {
    // No ReadableStream (old engines, some iframe polyfills): read it whole.
    let text: string;
    try { text = await res.text(); } catch {
      yield { type: 'error', error: new MyIOBotError('STREAM_UNAVAILABLE', 'Não foi possível ler o stream.', res.status, requestIdOf(res)) };
      return;
    }
    consumeSseBuffer(`${text}\n\n`, emit);
    yield* queue;
    if (!finished) yield { type: 'error', error: new MyIOBotError('STREAM_INCOMPLETE', 'O stream terminou sem resultado.', 502, requestIdOf(res)) };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      if (signal?.aborted) throw abortedError();
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = consumeSseBuffer(buffer, emit);
      while (queue.length) yield queue.shift() as MyIOBotStreamEvent;
      if (finished) {
        try { await reader.cancel?.(); } catch { /* already closed */ }
        return;
      }
    }
    buffer += decoder.decode();
    consumeSseBuffer(`${buffer}\n\n`, emit);
    while (queue.length) yield queue.shift() as MyIOBotStreamEvent;
    if (!finished) yield { type: 'error', error: new MyIOBotError('STREAM_INCOMPLETE', 'O stream terminou sem resultado.', 502, requestIdOf(res)) };
  } catch (e) {
    const aborted = signal?.aborted || (e as { name?: string })?.name === 'AbortError' || (e as MyIOBotError)?.code === 'ABORTED';
    try { await reader.cancel?.(); } catch { /* ignore */ }
    yield {
      type: 'error',
      error: aborted ? abortedError() : new MyIOBotError('STREAM_INCOMPLETE', 'O stream foi interrompido.', 502, requestIdOf(res)),
    };
  }
}
