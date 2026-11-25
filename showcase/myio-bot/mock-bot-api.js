/* RFC-0242 — in-browser stub of the GCDR bot API (/api/v1/bot/*) for the showcases.
 *
 * window.MyIOBotMock.createFetch(opts) returns a fetch-compatible function that the
 * widget receives through its `fetch` option — the page's global fetch is NOT patched.
 * Answers use the real wire shapes (GCDR envelope, SSE `delta`/`done`/`error`), so the
 * widget runs exactly the code paths it runs against GCDR. No network, no credentials.
 *
 * Scenarios (opts.scenario or setScenario()): 'ok' | '403' | '404' | '503' | 'offline' | 'master-off'.
 * Prompt keywords: "memória"/"lembre" → proposals card; "inativ"/"ação" → D-20 action card;
 * "erro" → SSE error event (BOT_BUDGET_EXCEEDED); "json" → JSON answer instead of SSE.
 */
/* global window, location */
(function () {
  'use strict';
  const uuid = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/[x]/g, () => ((Math.random() * 16) | 0).toString(16));
  const now = () => new Date().toISOString();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function createFetch(opts) {
    const o = Object.assign({ scenario: 'ok', delayMs: 45, curator: true, onRequest: null }, opts || {});
    const conversations = new Map(); // id → { conv, messages }
    let seq = 0;

    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-request-id': uuid() } });
    const okEnv = (data, status) => json(status || 200, { success: true, data, meta: { requestId: uuid(), timestamp: now() } });
    const errEnv = (status, code, message) => json(status, { success: false, error: { code, message }, meta: { requestId: uuid(), timestamp: now() } });

    function view(c, count) {
      return Object.assign({}, c, count === undefined ? {} : { messageCount: count });
    }

    function answerFor(text) {
      const t = text.toLowerCase();
      const base = {
        tier: /^\/think/.test(t) ? 'T1' : /^\/tools/.test(t) ? 'T2' : 'T0',
        provider: 'mock', model: 'showcase-stub-1',
      };
      if (/mem[oó]ria|lembre/.test(t)) {
        return Object.assign(base, {
          answer: 'Anotado. Propus duas memórias para a curadoria: uma do cliente e uma pessoal.',
          proposals: [
            { id: uuid(), summary: 'O cliente tem 2 centrais 2.0 (entrada e trafo).', kind: 'FACT', scopeType: 'CUSTOMER', status: 'DRAFT' },
            { id: uuid(), summary: 'Prefere ver consumo em kWh.', kind: 'PREFERENCE', scopeType: 'USER', status: 'DRAFT' },
          ],
        });
      }
      if (/inativ|a[cç][aã]o/.test(t)) {
        return Object.assign(base, {
          tier: 'T2',
          answer: 'Posso inativar os elevadores deste cliente. Confira os argumentos e confirme no cartão abaixo.',
          pendingAction: {
            id: uuid(), tool: 'devices.deactivate', summary: 'Inativar 3 elevadores (ELV-01, ELV-02, ELV-03)',
            arguments: { category: 'ELEVADOR', devices: ['ELV-01', 'ELV-02', 'ELV-03'], reason: 'manutenção programada' },
            affectedCount: 3, expiresAt: new Date(Date.now() + 120000).toISOString(),
          },
        });
      }
      return Object.assign(base, {
        answer: 'Olá! Sou o MYIO Bot (stub da showcase). Hoje 2 centrais estão online e 1 está offline há 3 h; ' +
          'o consumo de energia do dia está 4% abaixo da meta. Pergunte "lembre que…" para ver o cartão de memórias ' +
          'ou "inativar elevadores" para ver o cartão de confirmação.',
        memoryIds: [uuid()],
      });
    }

    function turnOf(convId, msgId, a, notice) {
      return {
        conversationId: convId, messageId: msgId, answer: a.answer, tier: a.tier, provider: a.provider, model: a.model,
        usage: { tokensIn: 180 + a.answer.length, tokensOut: Math.ceil(a.answer.length / 4) },
        costEstimatedUsd: 0, priced: false, memoryIds: a.memoryIds || [], proposals: a.proposals || [], toolCalls: [],
        stopReason: 'end_turn', notice, pendingAction: a.pendingAction,
      };
    }

    function sseResponse(convId, text, failWith) {
      const enc = new TextEncoder();
      const entry = conversations.get(convId);
      const a = answerFor(text);
      const first = entry.messages.length <= 1;
      const msgId = ++seq;
      const stream = new ReadableStream({
        async start(ctrl) {
          const send = (ev, data) => ctrl.enqueue(enc.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));
          try {
            if (failWith) { await sleep(300); send('error', failWith); ctrl.close(); return; }
            for (const word of a.answer.split(/(?<=\s)/)) { await sleep(o.delayMs); send('delta', { text: word }); }
            const turn = turnOf(convId, msgId, a, first ? 'Stub da showcase: nenhuma pergunta sai deste navegador.' : undefined);
            entry.messages.push({ id: msgId, seq: entry.messages.length + 1, role: 'assistant', content: a.answer, tier: a.tier, provider: a.provider, model: a.model,
              toolCalls: [], memoryIds: turn.memoryIds, tokensIn: turn.usage.tokensIn, tokensOut: turn.usage.tokensOut, costEstimatedUsd: 0, createdAt: now() });
            entry.conv.lastTier = a.tier; entry.conv.lastProvider = a.provider; entry.conv.updatedAt = now();
            send('done', turn);
          } catch { /* aborted by the client */ }
          try { ctrl.close(); } catch { /* already closed */ }
        },
      });
      return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }

    async function handle(method, path, query, body, headers) {
      if (o.scenario === 'offline') throw new TypeError('Failed to fetch (simulado)');
      if (!headers['X-API-Key'] && !headers.Authorization) return errEnv(401, 'UNAUTHORIZED', 'Credencial ausente');
      if (o.scenario === '404') return errEnv(404, 'NOT_FOUND', 'Route GET /api/v1/bot/status not found');
      if (o.scenario === '403') return errEnv(403, 'FORBIDDEN', 'Sem permissão para esta operação do bot (bot.chat.use (ou API key com bot:use))');
      if (o.scenario === '503' && path !== '/bot/status') return errEnv(503, 'BOT_DISABLED', 'O bot da MYIO está desligado (bot_control.MASTER).');
      await sleep(120);

      if (method === 'GET' && path === '/bot/status') {
        if (o.scenario === '503') return errEnv(503, 'BOT_NO_ELIGIBLE_PROVIDER', 'Nenhum provedor elegível para o canal API');
        return okEnv({
          enabled: true, master: o.scenario !== 'master-off',
          providers: [{ name: 'mock', usable: true, residency: 'LOCAL', costTier: 'LOW' }],
          permissions: { use: true, curate: !!o.curator, curateAll: false, operate: false },
          kind: headers['X-API-Key'] ? 'API_KEY' : 'USER',
        });
      }
      if (method === 'GET' && path === '/bot/conversations') {
        // like GCDR today: clientThreadKey is NOT a filter (the client matches it itself)
        const items = Array.from(conversations.values()).map((e) => view(e.conv, e.messages.length)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return okEnv({ items: items.slice(0, Number(query.get('limit') || 100)) });
      }
      if (method === 'POST' && path === '/bot/conversations') {
        const c = { id: uuid(), title: (body && body.title) || 'Conversa', channel: 'API', shared: false, status: 'OPEN', isOwner: true, ownerId: null,
          hasExternalParticipants: false, lastTier: null, lastProvider: null, clientThreadKey: (body && body.clientThreadKey) || null, createdAt: now(), updatedAt: now() };
        conversations.set(c.id, { conv: c, messages: [] });
        return okEnv(view(c, 0), 201);
      }
      let m = path.match(/^\/bot\/conversations\/([^/]+)$/);
      if (m) {
        const e = conversations.get(m[1]);
        if (!e) return errEnv(404, 'NOT_FOUND', 'Conversation not found');
        if (method === 'GET') return okEnv(Object.assign(view(e.conv, e.messages.length), { messages: e.messages }));
        if (method === 'PATCH') { Object.assign(e.conv, body || {}, { updatedAt: now() }); return okEnv(view(e.conv)); }
      }
      m = path.match(/^\/bot\/conversations\/([^/]+)\/messages$/);
      if (m && method === 'POST') {
        const e = conversations.get(m[1]);
        if (!e) return errEnv(404, 'NOT_FOUND', 'Conversation not found');
        const keys = Object.keys(body || {});
        if (keys.some((k) => k !== 'message' && k !== 'attachments')) return errEnv(400, 'VALIDATION_ERROR', `Unrecognized key(s) in object: ${keys.join(', ')}`);
        const text = String(body.message || '');
        e.messages.push({ id: ++seq, seq: e.messages.length + 1, role: 'user', content: text, tier: null, provider: null, model: null, toolCalls: null, memoryIds: [], tokensIn: null, tokensOut: null, costEstimatedUsd: null, createdAt: now() });
        if (e.conv.title === 'Conversa') e.conv.title = text.replace(/^\[Contexto:[^\]]*\]\n/, '').slice(0, 60);
        const plain = text.replace(/^(\/\w+\s*)?\[Contexto:[^\]]*\]\n/, '$1');
        const failWith = /erro/i.test(plain) ? { code: 'BOT_BUDGET_EXCEEDED', message: 'Orçamento diário do T2 excedido (stub)', statusCode: 429 } : null;
        if (/json/i.test(plain) || !(headers.Accept || '').includes('text/event-stream')) {
          if (failWith) return errEnv(429, failWith.code, failWith.message);
          const a = answerFor(plain);
          await sleep(500);
          return okEnv(turnOf(e.conv.id, ++seq, a));
        }
        return sseResponse(e.conv.id, plain, failWith);
      }
      m = path.match(/^\/bot\/memories\/([^/]+)$/);
      if (m && method === 'PATCH') return okEnv({ id: m[1], status: body && body.action === 'approve' ? 'ACTIVE' : 'REJECTED' });
      m = path.match(/^\/bot\/actions\/([^/]+)\/(confirm|cancel)$/);
      if (m && method === 'POST') return okEnv(m[2] === 'confirm' ? { id: m[1], status: 'DONE', summary: '3 elevadores inativados (stub).', affectedCount: 3 } : { id: m[1], status: 'CANCELLED' });
      return errEnv(404, 'NOT_FOUND', `Route ${method} ${path} not found`);
    }

    const fetchImpl = async function (input, init) {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      const method = String((init && init.method) || 'GET').toUpperCase();
      const path = url.pathname.replace(/^.*\/api\/v1/, '');
      const headers = (init && init.headers) || {};
      const body = init && init.body ? JSON.parse(init.body) : undefined;
      if (typeof o.onRequest === 'function') {
        // never hand the credential to the log
        o.onRequest({ method, path: path + url.search, accept: headers.Accept, auth: headers['X-API-Key'] ? 'X-API-Key: ***' : headers.Authorization ? 'Bearer ***' : 'none', body });
      }
      if (init && init.signal && init.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return handle(method, path, url.searchParams, body, headers);
    };
    fetchImpl.setScenario = (s) => { o.scenario = s; };
    fetchImpl.setCurator = (v) => { o.curator = !!v; };
    fetchImpl.reset = () => conversations.clear();
    return fetchImpl;
  }

  window.MyIOBotMock = { createFetch, MOCK_BASE_URL: 'https://gcdr-mock.invalid/api/v1', FAKE_KEY: 'showcase-fake-key' };
})();
