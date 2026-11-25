/**
 * RFC-0242 — `createMyIOBotClient()`: the transport-only client of the GCDR
 * company bot (gcdr RFC-0087, `/api/v1/bot/*`). No DOM, no framework; the
 * widget is one consumer of it, a host with its own chat UI uses it directly.
 *
 * Behavioural reference: gcdr-frontend `botService.ts` + `useBotChat.ts`
 * (SSE first, JSON fallback when nothing streamed and the failure is the
 * transport; API error codes never retry).
 *
 * Tolerant of GCDR additions the RFC requested but that are not deployed:
 * - `protocolVersion` missing from `/bot/status` → 1;
 * - `?clientThreadKey=` ignored by `GET /bot/conversations` → matched client-side;
 * - `context` body field refused (strict Zod) → one-line prefix (`contextMode: 'prefix'`);
 * - `/bot/actions/*` absent → the 404 surfaces as a `MyIOBotError`.
 *
 * Never logs: credentials only ever live in the request headers.
 */
import {
  MYIO_BOT_PROTOCOL_VERSION,
  type MyIOBotActionResult,
  type MyIOBotContext,
  type MyIOBotConversation,
  type MyIOBotEnvelope,
  type MyIOBotMemory,
  type MyIOBotMemoryProposal,
  type MyIOBotMessage,
  type MyIOBotProposeResult,
  type MyIOBotScopeType,
  type MyIOBotStatus,
  type MyIOBotTurn,
} from './contract';
import { createBotAuthStrategy, type MyIOBotAuth } from './authStrategies';
import { MyIOBotError, botErrorFromEnvelope, isMyIOBotError } from './errors';
import { readBotEvents, type BotResponseLike, type MyIOBotStreamEvent } from './sse';

export interface MyIOBotHostInfo {
  app: string;
  version?: string;
  customerId?: string;
}

export interface MyIOBotClientOptions {
  /** GCDR API base, e.g. `https://gcdr-api.a.myio-bas.com/api/v1`. */
  gcdrApiBaseUrl: string;
  auth: MyIOBotAuth;
  host?: MyIOBotHostInfo;
  /** Injectable fetch (tests, Node). Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
  /** Turn timeout (send/stream). Default 120 000 ms. */
  timeoutMs?: number;
  /** Status / list / get / memory calls. Default 15 000 ms. */
  shortTimeoutMs?: number;
  /**
   * Send `X-MyIO-Bot-Client` / `X-MyIO-Bot-Protocol`. Default **false**: GCDR's
   * CORS `allowedHeaders` does not list them yet, so a browser preflight would
   * fail every call. Turn on once gcdr ships RFC-0242 §GCDR side item 2 (or in Node).
   */
  sendClientHeaders?: boolean;
  /**
   * How `context` reaches the bot. `'prefix'` (default): a one-line
   * `[Contexto: …]` before the message, sent once per conversation and per
   * context value — GCDR's PostMessageSchema is strict and refuses a `context`
   * field today. `'field'`: send `context` next to `message` (when GCDR accepts it).
   */
  contextMode?: 'prefix' | 'field';
  /** Fall back to the JSON turn when SSE fails before any delta (default true). */
  jsonFallback?: boolean;
}

export interface MyIOBotConversationDetail {
  conversation: MyIOBotConversation;
  messages: MyIOBotMessage[];
}

export interface MyIOBotSendInput {
  message: string;
  context?: MyIOBotContext;
}

export interface MyIOBotClient {
  status(): Promise<MyIOBotStatus>;
  conversations: {
    list(q?: { scope?: 'mine' | 'shared' | 'all'; limit?: number }): Promise<MyIOBotConversation[]>;
    create(input?: { title?: string; clientThreadKey?: string; shared?: boolean }): Promise<MyIOBotConversation>;
    /** The newest OPEN conversation of the caller carrying this key, or null (no create). */
    find(clientThreadKey: string): Promise<MyIOBotConversation | null>;
    /** find-or-create by key. */
    resolve(clientThreadKey: string, opts?: { title?: string }): Promise<MyIOBotConversation>;
    get(id: string): Promise<MyIOBotConversationDetail>;
    patch(id: string, p: { title?: string; shared?: boolean; status?: 'OPEN' | 'CLOSED' }): Promise<MyIOBotConversation>;
    send(id: string, input: MyIOBotSendInput, signal?: AbortSignal): Promise<MyIOBotTurn>;
    stream(id: string, input: MyIOBotSendInput, signal?: AbortSignal): AsyncIterable<MyIOBotStreamEvent>;
  };
  memories: {
    search(q: string, opts?: { scopes?: MyIOBotScopeType[]; limit?: number }): Promise<MyIOBotMemory[]>;
    propose(input: MyIOBotMemoryProposal): Promise<MyIOBotProposeResult>;
    decide(id: string, decision: 'approve' | 'reject', reason?: string): Promise<void>;
  };
  /** RFC-0087 D-20 (phase 2): 404 NOT_FOUND until GCDR ships `/bot/actions/*`. */
  actions: {
    confirm(id: string): Promise<MyIOBotActionResult>;
    cancel(id: string): Promise<void>;
  };
  readonly options: Readonly<Pick<MyIOBotClientOptions, 'gcdrApiBaseUrl' | 'host' | 'contextMode'>>;
}

const DEFAULT_TURN_TIMEOUT = 120_000;
const DEFAULT_SHORT_TIMEOUT = 15_000;
const MAX_MESSAGE = 4000;
const CONTEXT_LINE_MAX = 300;

/** `[Contexto: cliente X · página Y]` — data for the model, stripped from the displayed thread. */
export function formatBotContextLine(ctx: MyIOBotContext | undefined): string {
  if (!ctx) return '';
  const parts: string[] = [];
  const cust = ctx.customerName || ctx.customerId;
  if (cust) parts.push(`cliente ${ctx.customerName && ctx.customerId ? `${ctx.customerName} (${ctx.customerId})` : cust}`);
  if (ctx.entityType || ctx.entityId) parts.push(`${ctx.entityType || 'entidade'} ${ctx.entityId || ''}`.trim());
  if (ctx.page) parts.push(`página ${ctx.page}`);
  if (ctx.note) parts.push(ctx.note);
  if (!parts.length) return '';
  const body = parts.join(' · ').replace(/[\r\n\]]+/g, ' ').slice(0, CONTEXT_LINE_MAX);
  return `[Contexto: ${body}]`;
}

const COMMAND_RE = /^(\/(?:think|tools)\b\s*)/i;
const CONTEXT_PREFIX_RE = /^(\/(?:think|tools)\b\s*)?\[Contexto: [^\]\n]*\]\n/i;

/** Inserts the context line keeping a leading `/think` / `/tools` command first (GCDR reads it only at the start). */
export function applyBotContextPrefix(message: string, line: string): string {
  if (!line) return message;
  const m = message.match(COMMAND_RE);
  const out = m ? `${m[1]}${line}\n${message.slice(m[1].length)}` : `${line}\n${message}`;
  return out.slice(0, MAX_MESSAGE);
}

/** Removes the context prefix from a stored user message (for display). */
export function stripBotContextPrefix(content: string): string {
  return content.replace(CONTEXT_PREFIX_RE, (_all, cmd: string | undefined) => cmd || '');
}

function contextLineOf(content: string): string | null {
  const m = content.match(CONTEXT_PREFIX_RE);
  if (!m) return null;
  const s = m[0].slice((m[1] || '').length);
  return s.slice(0, -1); // drop the trailing \n
}

function canStream(): boolean {
  return typeof TextDecoder !== 'undefined';
}

export function createMyIOBotClient(options: MyIOBotClientOptions): MyIOBotClient {
  if (!options || !options.gcdrApiBaseUrl) {
    throw new MyIOBotError('CONFIG_ERROR', 'MyIO Bot: gcdrApiBaseUrl is required.');
  }
  const base = String(options.gcdrApiBaseUrl).replace(/\/+$/, '');
  const auth = createBotAuthStrategy(options.auth);
  const injected = options.fetch || (typeof globalThis !== 'undefined' ? (globalThis.fetch as typeof fetch | undefined) : undefined);
  if (typeof injected !== 'function') throw new MyIOBotError('CONFIG_ERROR', 'MyIO Bot: no fetch implementation available.');
  const doFetch: typeof fetch = options.fetch ? options.fetch : injected.bind(globalThis);
  const turnTimeout = options.timeoutMs ?? DEFAULT_TURN_TIMEOUT;
  const shortTimeout = options.shortTimeoutMs ?? DEFAULT_SHORT_TIMEOUT;
  const contextMode = options.contextMode ?? 'prefix';
  const jsonFallback = options.jsonFallback !== false;
  const host = options.host;
  /** conversationId → context lines already delivered in that conversation (prefix mode). */
  const contextSent = new Map<string, Set<string>>();

  async function headersFor(accept: string, hasBody: boolean): Promise<Record<string, string>> {
    const h: Record<string, string> = { Accept: accept };
    if (hasBody) h['Content-Type'] = 'application/json';
    if (options.sendClientHeaders) {
      h['X-MyIO-Bot-Protocol'] = String(MYIO_BOT_PROTOCOL_VERSION);
      if (host?.app) h['X-MyIO-Bot-Client'] = host.version ? `${host.app}/${host.version}` : host.app;
    }
    await auth.apply(h);
    return h;
  }

  /** fetch with a timeout merged into the caller's signal; transport failures become MyIOBotError. */
  async function rawFetch(method: string, path: string, init: { body?: unknown; accept?: string; timeoutMs: number; signal?: AbortSignal }): Promise<{ res: BotResponseLike; done: () => void; failure: () => MyIOBotError }> {
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, init.timeoutMs);
    const onAbort = () => ctrl.abort();
    if (init.signal) {
      if (init.signal.aborted) ctrl.abort();
      else init.signal.addEventListener('abort', onAbort, { once: true });
    }
    const done = () => { clearTimeout(timer); init.signal?.removeEventListener('abort', onAbort); };
    const failure = () =>
      timedOut
        ? new MyIOBotError('TIMEOUT', 'O GCDR demorou demais para responder.', 0)
        : init.signal?.aborted
          ? new MyIOBotError('ABORTED', 'Requisição cancelada.', 0)
          : new MyIOBotError('NETWORK_ERROR', 'Sem conexão com o GCDR (rede ou origem não autorizada).', 0);
    const hasBody = init.body !== undefined;
    try {
      const headers = await headersFor(init.accept || 'application/json', hasBody);
      if (ctrl.signal.aborted) throw failure();
      const res = (await doFetch(`${base}${path}`, {
        method,
        headers,
        body: hasBody ? JSON.stringify(init.body) : undefined,
        signal: ctrl.signal,
      })) as unknown as BotResponseLike;
      return { res, done, failure };
    } catch (e) {
      done();
      if (isMyIOBotError(e)) throw e;
      throw failure();
    }
  }

  async function request<T>(method: string, path: string, init: { body?: unknown; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<T> {
    const { res, done, failure } = await rawFetch(method, path, { ...init, timeoutMs: init.timeoutMs ?? shortTimeout });
    try {
      const rid = res.headers.get('x-request-id') || undefined;
      let json: unknown = null;
      if (res.status !== 204) {
        try { json = await res.json(); } catch { json = null; }
      }
      if (!res.ok) throw botErrorFromEnvelope(res.status, json, res.statusText, rid);
      if (res.status === 204) return undefined as T;
      const env = json as MyIOBotEnvelope<T> | null;
      if (!env || typeof env !== 'object' || env.success !== true) {
        if (env && env.success === false) throw botErrorFromEnvelope(res.status, env, res.statusText, rid);
        throw new MyIOBotError('INVALID_RESPONSE', 'Resposta inesperada do GCDR.', res.status, rid);
      }
      return env.data as T;
    } catch (e) {
      if (isMyIOBotError(e)) throw e;
      throw failure();
    } finally {
      done();
    }
  }

  const enc = encodeURIComponent;

  function bodyFor(id: string, input: MyIOBotSendInput): { body: Record<string, unknown>; commit: () => void } {
    const message = String(input.message ?? '');
    if (!message.trim()) throw new MyIOBotError('VALIDATION_ERROR', 'Mensagem vazia.', 400);
    if (contextMode === 'field' && input.context) {
      return { body: { message: message.slice(0, MAX_MESSAGE), context: input.context }, commit: () => undefined };
    }
    const line = formatBotContextLine(input.context);
    const seen = contextSent.get(id);
    if (!line || seen?.has(line)) return { body: { message: message.slice(0, MAX_MESSAGE) }, commit: () => undefined };
    return {
      body: { message: applyBotContextPrefix(message, line) },
      commit: () => {
        const s = contextSent.get(id) || new Set<string>();
        s.add(line);
        contextSent.set(id, s);
      },
    };
  }

  async function send(id: string, input: MyIOBotSendInput, signal?: AbortSignal): Promise<MyIOBotTurn> {
    const { body, commit } = bodyFor(id, input);
    const turn = await request<MyIOBotTurn>('POST', `/bot/conversations/${enc(id)}/messages`, { body, timeoutMs: turnTimeout, signal });
    commit();
    return turn;
  }

  async function* stream(id: string, input: MyIOBotSendInput, signal?: AbortSignal): AsyncGenerator<MyIOBotStreamEvent> {
    let prepared: ReturnType<typeof bodyFor>;
    try { prepared = bodyFor(id, input); } catch (e) { yield { type: 'error', error: e as MyIOBotError }; return; }
    const viaJson = async function* (): AsyncGenerator<MyIOBotStreamEvent> {
      try {
        const turn = await send(id, input, signal);
        if (turn?.answer) yield { type: 'delta', text: turn.answer };
        yield { type: 'done', turn };
      } catch (e) {
        yield { type: 'error', error: isMyIOBotError(e) ? e : new MyIOBotError('ERROR', String(e)) };
      }
    };
    if (!canStream()) { yield* viaJson(); return; }

    let handle: Awaited<ReturnType<typeof rawFetch>>;
    try {
      handle = await rawFetch('POST', `/bot/conversations/${enc(id)}/messages`, { body: prepared.body, accept: 'text/event-stream', timeoutMs: turnTimeout, signal });
    } catch (e) {
      const err = e as MyIOBotError;
      // Transport failure before anything streamed: the JSON path is worth one try (gcdr-frontend rule).
      if (jsonFallback && err.code === 'NETWORK_ERROR') { yield* viaJson(); return; }
      yield { type: 'error', error: err };
      return;
    }
    let streamedAny = false;
    try {
      for await (const ev of readBotEvents(handle.res, signal)) {
        if (ev.type === 'delta') { streamedAny = true; yield ev; continue; }
        if (ev.type === 'done') { prepared.commit(); yield ev; return; }
        const transport = ev.error.code === 'STREAM_UNAVAILABLE' || ev.error.code === 'STREAM_INCOMPLETE';
        if (jsonFallback && transport && !streamedAny && !signal?.aborted) { handle.done(); yield* viaJson(); return; }
        yield ev;
        return;
      }
    } finally {
      handle.done();
    }
  }

  async function list(q: { scope?: 'mine' | 'shared' | 'all'; limit?: number; clientThreadKey?: string } = {}): Promise<MyIOBotConversation[]> {
    const qs = new URLSearchParams();
    if (q.scope) qs.set('scope', q.scope);
    if (q.limit) qs.set('limit', String(q.limit));
    if (q.clientThreadKey) qs.set('clientThreadKey', q.clientThreadKey);
    const s = qs.toString();
    const data = await request<{ items?: MyIOBotConversation[] }>('GET', `/bot/conversations${s ? `?${s}` : ''}`);
    return Array.isArray(data?.items) ? data.items : [];
  }

  async function find(key: string): Promise<MyIOBotConversation | null> {
    // GCDR ignores unknown query params today → match client-side either way.
    const items = await list({ scope: 'mine', limit: 200, clientThreadKey: key });
    const hits = items
      .filter((c) => c && c.clientThreadKey === key && c.status !== 'CLOSED')
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return hits[0] || null;
  }

  async function get(id: string): Promise<MyIOBotConversationDetail> {
    // GCDR returns the conversation flattened with `messages` (`{ ...conversation, messages }`).
    const data = await request<MyIOBotConversation & { messages?: MyIOBotMessage[] }>('GET', `/bot/conversations/${enc(id)}`);
    const { messages, ...conversation } = data || ({} as MyIOBotConversation & { messages?: MyIOBotMessage[] });
    const msgs = Array.isArray(messages) ? messages : [];
    const seen = new Set<string>();
    for (const m of msgs) {
      if (m.role === 'user' && typeof m.content === 'string') {
        const line = contextLineOf(m.content);
        if (line) seen.add(line);
      }
    }
    if (seen.size) contextSent.set(id, seen);
    return { conversation: conversation as MyIOBotConversation, messages: msgs };
  }

  return {
    options: { gcdrApiBaseUrl: base, host, contextMode },
    async status() {
      const s = await request<Partial<MyIOBotStatus>>('GET', '/bot/status');
      const p = (s?.permissions || {}) as Partial<MyIOBotStatus['permissions']>;
      return {
        enabled: s?.enabled !== false,
        master: s?.master !== false,
        providers: Array.isArray(s?.providers) ? s.providers : [],
        permissions: { use: !!p.use, curate: !!p.curate, curateAll: !!p.curateAll, operate: !!p.operate },
        kind: (s?.kind as MyIOBotStatus['kind']) || 'USER',
        protocolVersion: typeof s?.protocolVersion === 'number' ? s.protocolVersion : 1,
      };
    },
    conversations: {
      list: (q) => list(q),
      create: (input = {}) => {
        const body: Record<string, unknown> = {};
        if (input.title) body.title = String(input.title).slice(0, 200);
        if (input.shared !== undefined) body.shared = input.shared;
        if (input.clientThreadKey) body.clientThreadKey = String(input.clientThreadKey).slice(0, 120);
        return request<MyIOBotConversation>('POST', '/bot/conversations', { body });
      },
      find,
      async resolve(key, opts = {}) {
        const k = String(key).slice(0, 120);
        const hit = await find(k);
        if (hit) return hit;
        const body: Record<string, unknown> = { clientThreadKey: k };
        if (opts.title) body.title = String(opts.title).slice(0, 200);
        return request<MyIOBotConversation>('POST', '/bot/conversations', { body });
      },
      get,
      patch: (id, p) => request<MyIOBotConversation>('PATCH', `/bot/conversations/${enc(id)}`, { body: p }),
      send,
      stream: (id, input, signal) => stream(id, input, signal),
    },
    memories: {
      async search(q, opts = {}) {
        const qs = new URLSearchParams({ q });
        if (opts.scopes?.length) qs.set('scopes', opts.scopes.join(','));
        if (opts.limit) qs.set('limit', String(opts.limit));
        const data = await request<{ items?: MyIOBotMemory[] }>('GET', `/bot/memories/search?${qs.toString()}`);
        return Array.isArray(data?.items) ? data.items : [];
      },
      propose: (input) => request<MyIOBotProposeResult>('POST', '/bot/memories', { body: input }),
      async decide(id, decision, reason) {
        const body: Record<string, unknown> = { action: decision };
        if (decision === 'reject') body.reason = (reason || 'descartada na conversa').slice(0, 200);
        await request<unknown>('PATCH', `/bot/memories/${enc(id)}`, { body });
      },
    },
    actions: {
      confirm: (id) => request<MyIOBotActionResult>('POST', `/bot/actions/${enc(id)}/confirm`, { body: {}, timeoutMs: turnTimeout }),
      async cancel(id) {
        await request<unknown>('POST', `/bot/actions/${enc(id)}/cancel`, { body: {} });
      },
    },
  };
}

export type { MyIOBotStreamEvent };
