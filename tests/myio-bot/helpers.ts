// RFC-0242 — fake fetch / responses for the bot SDK tests (no network, fake keys only).
import { vi } from 'vitest';

export interface FakeResponseInit {
  status?: number;
  contentType?: string;
  json?: unknown;
  /** SSE chunks (each becomes one reader.read()) */
  chunks?: string[];
  /** Omit the body reader (forces the text() path). */
  noReader?: boolean;
  requestId?: string;
}

export function fakeResponse(init: FakeResponseInit = {}) {
  const status = init.status ?? 200;
  const ct = init.contentType ?? (init.chunks ? 'text/event-stream' : 'application/json');
  const enc = new TextEncoder();
  const chunks = (init.chunks || []).slice();
  const headers: Record<string, string> = { 'content-type': ct };
  if (init.requestId) headers['x-request-id'] = init.requestId;
  const reader = {
    cancelled: false,
    async read() {
      if (!chunks.length) return { done: true, value: undefined };
      return { done: false, value: enc.encode(chunks.shift() as string) };
    },
    async cancel() { reader.cancelled = true; },
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `S${status}`,
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
    body: init.chunks && !init.noReader ? { getReader: () => reader } : null,
    reader,
    async json() {
      if (init.json === undefined) throw new Error('no json');
      return init.json;
    },
    async text() { return (init.chunks || []).join(''); },
  };
}

export const ok = <T>(data: T, status = 200) => fakeResponse({ status, json: { success: true, data, meta: { requestId: 'rid-1' } } });
export const fail = (status: number, code: string, message = code) =>
  fakeResponse({ status, json: { success: false, error: { code, message }, meta: { requestId: 'rid-err' } } });

export function sse(...events: Array<[string, unknown]>): string {
  return events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
}

export type Route = (url: string, init: RequestInit & { headers: Record<string, string> }) => unknown | Promise<unknown>;

/** fetch mock routed by `METHOD /path` (query stripped); records every call. */
export function routedFetch(routes: Record<string, Route>) {
  const calls: Array<{ method: string; url: string; path: string; headers: Record<string, string>; body: unknown }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
    const method = String(init?.method || 'GET').toUpperCase();
    const u = new URL(url);
    const p = u.pathname.replace(/^\/api\/v1/, '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, path: p, headers: init.headers, body });
    const key = Object.keys(routes).find((k) => {
      const [m, pat] = k.split(' ');
      if (m !== method) return false;
      const re = new RegExp('^' + pat.replace(/\{[^}]+\}/g, '[^/]+') + '$');
      return re.test(p);
    });
    if (!key) return fail(404, 'NOT_FOUND', `no route ${method} ${p}`);
    return routes[key](url, init);
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

export const BASE = 'https://gcdr.test/api/v1';

export const conv = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Conversa',
  channel: 'API',
  shared: false,
  status: 'OPEN',
  isOwner: true,
  ownerId: null,
  hasExternalParticipants: false,
  lastTier: null,
  lastProvider: null,
  clientThreadKey: null,
  messageCount: 0,
  createdAt: '2026-11-24T10:00:00.000Z',
  updatedAt: '2026-11-24T10:00:00.000Z',
  ...over,
});

export const turn = (over: Record<string, unknown> = {}) => ({
  conversationId: '11111111-1111-1111-1111-111111111111',
  messageId: 42,
  answer: 'Olá, tudo certo.',
  tier: 'T1',
  provider: 'anthropic',
  model: 'claude-test',
  usage: { tokensIn: 10, tokensOut: 5 },
  costEstimatedUsd: 0.001,
  priced: true,
  memoryIds: [],
  proposals: [],
  toolCalls: [],
  stopReason: 'end_turn',
  ...over,
});

export const statusData = (over: Record<string, unknown> = {}) => ({
  enabled: true,
  master: true,
  providers: [],
  permissions: { use: true, curate: false, curateAll: false, operate: false },
  kind: 'API_KEY',
  ...over,
});

export const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};
