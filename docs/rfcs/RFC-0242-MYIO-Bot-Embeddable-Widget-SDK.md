# RFC-0242 — MYIO Bot as an embeddable SDK: a vanilla client and a floating chat widget exported by the library, so any MYIO system (ThingsBoard dashboards, presetup, admin pages, partner portals) talks to the company bot of GCDR RFC-0087

- **Feature name:** `myio-bot` (`createMyIOBotClient`, `createMyIOBotWidget`, `openMyIOBotPanel`; UMD side bundle `myio-bot-widget.umd.min.js`, global `window.MyIOBotWidget`)
- **Start date:** 2026-11-23
- **Status:** **Phase 0+1 implemented (branch feat/rfc-0242-myio-bot-sdk)** — 2026-11-24, uncommitted: contract + OpenAPI snapshot test, client (SSE/JSON fallback), widget (Shadow DOM, states, proposals, D-20 action card), second UMD bundle `myio-bot-widget.umd.min.js` + `MyIOLibrary.loadBotWidget()`, showcases `showcase/myio-bot/` and `showcase/main-view-shopping/`. Phase 2+ not started. **Addendum 2026-11-25 — §GCDR integration (RFC-0092): company entitlement, user scope, MYIO treated as a company, visibility states, deep link; specified, not built (phase 1b).** Draft rev. 1 (2026-11-23) was written the day the bot went live in production (`gcdr-web.a.myio-bas.com/bot`, gcdr#250/#251/#253/#255, gcdr-frontend#168/#169).
- **Branch:** `feat/rfc-0242-myio-bot-sdk` (from `desenv`)
- **Jira:** none yet
- **Related RFCs (this repo):** `RFC-sdk-auth-and-tb-customer-credentials.md` (auth client + TB customer credentials provider: the credential model this RFC reuses), RFC-0218 (`GcdrAnnotationsClient`: the `AuthStrategy` pattern — exactly one of API key / bearer — and the envelope unwrapping this RFC copies), RFC-0215 (Settings hub: the `open*Modal(options) → handle` component convention), RFC-0205 (`openConfirmDialog`: the confirmation primitive reused for bot actions), RFC-0241 §Phase 0 (GCDR envelope `{ success, data, meta }` / `{ success: false, error: { message, code } }`, API-key scopes enforced by GCDR).
- **Related RFCs (gcdr.git):** **RFC-0087** (MYIO company bot: provider port, shared memory, tiers, `/api/v1/bot/*`, permissions `bot.chat.use` / scope `bot:use`, D-13 API keys get the key's customer reach and no `USER` scope, D-14 eligibility by `DATA_POLICY` per channel, **D-20 write tools behind a server-side confirmation**, O-10 first tools), RFC-0043 (the Copiloto being retired; its React `CopilotWidget` is the behavioural reference for this component), RFC-0079 (channels: `bot_channel` enum, outbox), `docs/API-KEYS-CONSUMERS.md` (how customer API keys are issued and scoped).
- **Key files (proposed):** `src/components/myio-bot/{client.ts, sse.ts, contract.ts, authStrategies.ts, widget/{launcher.ts, panel.ts, thread.ts, composer.ts, actionCard.ts, styles.ts, i18n.ts}, index.ts}`, `src/index.ts` (exports), `rollup.config.mjs` (second UMD entry), `scripts/check-bundle-size.mjs` (per-bundle limits), `tests/myio-bot/*.test.ts`, `docs/rfcs/RFC-0242-*.md`.

---

# Summary

Export from `myio-js-library` two things: a **transport-only client** for the GCDR bot API (`createMyIOBotClient`) and a **floating chat widget** built on it (`createMyIOBotWidget` / `openMyIOBotPanel`), both vanilla TypeScript with no framework dependency, so that every MYIO surface that already loads this library — ThingsBoard dashboards (`main-dashboard-shopping v-5.2.0`, `MYIO-SIM`), the presetup pages, the inline admin pages of the GCDR API, future partner portals — gets the same "MYIO Bot" button that gcdr-frontend has, talking to the same `/api/v1/bot/*` endpoints with the same memory, tiers, data policy and audit. The library owns the **wire contract** (one typed module mirroring the GCDR OpenAPI paths for `/bot/*`), the **SSE streaming** parser, the **auth strategies** (GCDR JWT or customer API key with scope `bot:use`), the **thread resumption** per host page (`clientThreadKey`), and — when GCDR RFC-0087 phase 2 ships — the **confirmation card** for write actions (D-20), rendered by the widget but decided by the server. The core UMD bundle stays under its 26 KB gzip limit: the widget ships as a **second UMD bundle** loaded on demand; ESM/CJS consumers import it from `src/index.ts` and tree-shake as usual.

# Motivation

- **One bot, many front doors.** RFC-0087 made the bot a service of the company: routing by tier, swappable providers, curated shared memory, budget, audit. Today the only door is `gcdr-web.a.myio-bas.com/bot` plus a React widget inside the same app. The people who would use it most — shopping operators on the ThingsBoard dashboards, the presetup technician, a partner looking at a single customer — never open gcdr-web. Every one of those surfaces already loads `myio-js-library` by `<script>` (UMD) or by import; the bot has to arrive the same way.
- **Do not fork the chat.** gcdr-frontend#168 shipped a full React implementation of the conversation (SSE with JSON fallback, tier badges, proposals card, error states). A second hand-written copy per host would drift on the first contract change. The library is the place where MYIO already keeps "the one implementation" of dashboard pieces (cards V6, settings hub, annotations client, GCDR login); the bot client belongs there.
- **The contract is young and will move.** Phase 2 of RFC-0087 adds tools with per-call re-authorization, pending actions with confirmation (D-20), `pgvector` retrieval; phase 3 adds Slack and WhatsApp identities. A typed contract module with a protocol version in the library, versioned on npm, is how hosts upgrade deliberately instead of breaking silently when GCDR redeploys.
- **Credentials already have a home.** ThingsBoard widgets already fetch the customer's GCDR API key from TB customer attributes (`RFC-sdk-auth-and-tb-customer-credentials`), and GCDR already enforces API-key scopes (RFC-0241 Phase 0, `tariffs:write` → 401). The bot only needs the key to carry `bot:use`, which RFC-0087 §4.9 already defines. No new auth system.
- **The owner's direction (2026-11-23):** retire the Copiloto, keep the floating menu, rename it "MYIO Bot", and make it a component "preferably in the library, to use the MYIO bot in other systems". This RFC is that proposal.

# Guide-level explanation

## For a ThingsBoard widget author (UMD, zero build)

```html
<script defer src="https://unpkg.com/myio-js-library@0.1.600/dist/myio-js-library.umd.min.js"></script>
<script>
  // MAIN_VIEW already resolved the customer's GCDR credentials (RFC-sdk-auth-and-tb-customer-credentials)
  const widget = await MyIOLibrary.loadBotWidget();   // injects myio-bot-widget.umd.min.js of the SAME version, once
  const bot = widget.createMyIOBotWidget({
    gcdrApiBaseUrl: 'https://gcdr-api.a.myio-bas.com/api/v1',
    auth: { apiKey: creds.gcdrApiKey, tenantId: creds.gcdrTenantId },
    host: { app: 'tb-main-dashboard-shopping', version: '5.2.0', customerId: ctx.customerId },
    thread: { key: `tb:${ctx.customerId}:${ctx.userEmail}` },   // resumes the same conversation on reload
    context: { customerId: ctx.customerId, customerName: ctx.customerName, page: 'telemetry' },
    position: 'bottom-right',
    locale: 'pt-BR',
  });
  bot.on('error', (e) => console.warn('[MYIO Bot]', e.code, e.message));
</script>
```

The launcher appears bottom-right with the label **"MYIO Bot"**. Clicking it opens the panel: the thread of the host page (resumed by `thread.key`), a composer, and under each answer a compact line with tier, provider and model. If the API answers `403`, `404` (`BOT_ENABLED` off) or `503` (`BOT_DISABLED`, no eligible provider), the panel shows the same human messages gcdr-web shows and the launcher stays visible but muted. Nothing of the host page is sent to the bot except what `context` names: the widget never scrapes the DOM.

## For an ESM/CJS consumer (presetup, alarms-frontend, a Node tool)

```ts
import { createMyIOBotClient, createMyIOBotWidget } from 'myio-js-library';

const client = createMyIOBotClient({
  gcdrApiBaseUrl: GCDR_URL,
  auth: { bearerToken: () => session.accessToken },        // GCDR JWT from myio-gcdr-login or the host's session
});
const status = await client.status();                       // { enabled, permissions: { use, curate, operate }, protocolVersion }
const conv = await client.conversations.create({ title: 'Moxuara — elevadores' });
for await (const ev of client.conversations.stream(conv.id, { message: 'quais centrais estão offline?' })) {
  if (ev.type === 'delta') process.stdout.write(ev.text);
  if (ev.type === 'done') console.log('\n', ev.turn.tier, ev.turn.provider, ev.turn.model);
}
```

The client is the whole protocol; the widget is one consumer of it. A host that has its own chat UI (alarms-frontend is Next.js) uses the client only.

## For the GCDR team

Nothing changes in the API for phase 1 of this RFC: the widget speaks the contract gcdr-frontend#168 already speaks. Two small additions are requested from GCDR and listed in §Reference-level → GCDR side: a `protocolVersion` field in `GET /bot/status` and the acceptance of an `X-MyIO-Bot-Client` header stored in the conversation's metadata, so the Operação tab can tell which host a conversation came from. The pending-action endpoints of RFC-0087 phase 2 (D-20) are consumed by the widget when they exist; until then the action card is not rendered.

## What the user sees

| State | Launcher | Panel |
|---|---|---|
| Ready | "MYIO Bot" pill, Nunito, host accent colour | Thread of `thread.key`; composer with `/think` `/tools` hints; "Abrir no GCDR" link to `gcdr-web/bot#chat?c=<id>` when the host passes `gcdrWebUrl` |
| Streaming | pulsing dot | Partial answer grows; cancel button aborts the fetch |
| Answer | — | Tier · provider · model · tokens; "memórias usadas" expandable; proposals card (Aprovar / Descartar) when the answer carries `proposals[]` and the principal may curate |
| Pending action (phase 2) | badge "1 ação aguardando" | Card with the exact arguments and affected count; **Confirmar** / **Cancelar**; expires with a countdown (server TTL) |
| 403 / 404 / 503 | muted pill | "Acesso restrito" / "Bot não disponível neste ambiente" / "Bot desligado" with the API message |
| Offline / CORS | muted pill | "Sem conexão com o GCDR" and a retry |

# Reference-level explanation

## Module layout

```
src/components/myio-bot/
  contract.ts         # TS types mirroring docs/openapi.yaml of gcdr (paths /bot/*) + PROTOCOL_VERSION = 1
  authStrategies.ts   # ApiKeyAuth (X-API-Key + X-Tenant-Id) | BearerAuth (static or () => Promise<string>) — RFC-0218 pattern
  client.ts           # createMyIOBotClient(): status(), conversations.{list,create,get,patch,send,stream}, memories.{search,propose,decide}, actions.{confirm,cancel}
  sse.ts              # text/event-stream parser (delta | done | error), JSON fallback, AbortSignal
  errors.ts           # MyIOBotError { code, status, message, requestId }; isMyIOBotError()
  widget/
    index.ts          # createMyIOBotWidget(options) → MyIOBotWidgetHandle; openMyIOBotPanel(options)
    launcher.ts       # floating pill, position, hidden-state persistence (localStorage key myio:bot:launcherHidden)
    panel.ts          # Shadow DOM root, header ("MYIO Bot"), thread, composer, states
    thread.ts         # messages, turn footer (tier/provider/model/tokens), memories-used, proposals card
    actionCard.ts     # D-20 pending action: arguments table, affected count, Confirmar/Cancelar, countdown
    composer.ts       # textarea, Enter/Shift+Enter, slash hints, cancel while streaming
    styles.ts         # CSS string injected into the shadow root; Nunito via Google Fonts link unless host opts out
    i18n.ts           # pt-BR (default) and en strings
  index.ts            # public surface of the module
```

`src/index.ts` gains:

```ts
// RFC-0242: MYIO Bot SDK — client (protocol) and floating widget (UI). The UMD core
// does NOT bundle the widget (26 KB limit); use MyIOLibrary.loadBotWidget() there.
export { createMyIOBotClient, MyIOBotError, isMyIOBotError, MYIO_BOT_PROTOCOL_VERSION } from './components/myio-bot';
export { createMyIOBotWidget, openMyIOBotPanel, loadBotWidget } from './components/myio-bot/widget';
export type { MyIOBotClient, MyIOBotClientOptions, MyIOBotAuth, MyIOBotWidgetOptions, MyIOBotWidgetHandle, MyIOBotTurn, MyIOBotStreamEvent, MyIOBotPendingAction } from './components/myio-bot';
```

## Public API

```ts
interface MyIOBotAuth {
  apiKey?: string; tenantId?: string;                       // customer API key with scope bot:use (X-API-Key, X-Tenant-Id)
  bearerToken?: string | (() => string | Promise<string>);  // GCDR JWT (myio-gcdr-login, host session)
}                                                            // exactly one of apiKey / bearerToken, else throws (RFC-0218)

interface MyIOBotClientOptions {
  gcdrApiBaseUrl: string;                                    // '.../api/v1'
  auth: MyIOBotAuth;
  host: { app: string; version?: string; customerId?: string };   // → X-MyIO-Bot-Client header
  fetch?: typeof fetch;                                      // injectable for tests / Node
  timeoutMs?: number;                                        // default 120_000 for a turn; status/list 15_000
}

interface MyIOBotClient {
  status(): Promise<{ enabled: boolean; permissions: { use: boolean; curate: boolean; curateAll: boolean; operate: boolean }; protocolVersion: number }>;
  conversations: {
    list(q?: { scope?: 'mine' | 'all'; limit?: number }): Promise<MyIOBotConversation[]>;
    create(input: { title?: string; clientThreadKey?: string }): Promise<MyIOBotConversation>;
    resolve(clientThreadKey: string): Promise<MyIOBotConversation>;      // find-or-create by key
    get(id: string): Promise<{ conversation: MyIOBotConversation; messages: MyIOBotMessage[] }>;
    patch(id: string, p: { title?: string; shared?: boolean; status?: 'OPEN' | 'CLOSED' }): Promise<MyIOBotConversation>;
    send(id: string, input: { message: string; context?: MyIOBotContext }): Promise<MyIOBotTurn>;       // JSON, no stream
    stream(id: string, input: { message: string; context?: MyIOBotContext }, signal?: AbortSignal): AsyncIterable<MyIOBotStreamEvent>;
  };
  memories: { search(q: string): Promise<MyIOBotMemory[]>; propose(input: MyIOBotMemoryProposal): Promise<MyIOBotMemory>; decide(id: string, d: 'approve' | 'reject'): Promise<void> };
  actions:  { confirm(id: string): Promise<MyIOBotActionResult>; cancel(id: string): Promise<void> };   // phase 2 (D-20); 404 until GCDR ships it
}

type MyIOBotStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; turn: MyIOBotTurn }                      // tier, provider, model, usage, memoryIds, proposals[], pendingAction?
  | { type: 'error'; error: MyIOBotError };

interface MyIOBotWidgetOptions extends MyIOBotClientOptions {
  thread?: { key: string } | { conversationId: string };   // resumption; default key = `${host.app}:${host.customerId ?? '-'}:${principal}`
  context?: MyIOBotContext;                                 // { customerId?, customerName?, entityId?, entityType?, page?, note? } — sent with every turn, never scraped
  position?: 'bottom-right' | 'bottom-left';
  locale?: 'pt-BR' | 'en';
  theme?: { accent?: string; dark?: boolean; fontLink?: false };
  gcdrWebUrl?: string;                                      // enables "Abrir no GCDR"
  launcher?: { label?: string; hiddenKey?: string; startOpen?: boolean };
  container?: HTMLElement;                                  // default document.body
}

interface MyIOBotWidgetHandle {
  open(): void; close(): void; toggle(): void; destroy(): void;
  ask(message: string, opts?: { newThread?: boolean }): Promise<MyIOBotTurn>;   // programmatic entry point ("ask about this OS")
  setContext(ctx: MyIOBotContext): void;
  on(event: 'open' | 'close' | 'turn' | 'error' | 'action', cb: (payload: unknown) => void): () => void;
  readonly client: MyIOBotClient;
}
```

## Wire contract (what the client sends and expects)

Mirrors gcdr `docs/openapi.yaml` paths `/bot/status`, `/bot/conversations`, `/bot/conversations/{id}`, `/bot/conversations/{id}/messages`, `/bot/memories`, `/bot/memories/search`, `/bot/memories/{id}`; every success is the GCDR envelope `{ success: true, data, meta }` and every error `{ success: false, error: { message, code }, meta }` (RFC-0241 Phase 0). `contract.ts` is **hand-written from the OpenAPI** and carries `MYIO_BOT_PROTOCOL_VERSION`; a test compares the type's field list against a checked-in JSON snapshot of the GCDR OpenAPI components so a GCDR change shows up as a failing test in the library, not in a dashboard.

- **Headers:** `Authorization: Bearer …` or `X-API-Key` + `X-Tenant-Id` (strategy); `Content-Type: application/json`; `Accept: text/event-stream` on `stream()`, `application/json` otherwise; `X-MyIO-Bot-Client: <app>/<version>` (new, §GCDR side); `X-MyIO-Bot-Protocol: 1`.
- **Streaming:** `POST /bot/conversations/{id}/messages` with `Accept: text/event-stream` → events `delta` (`{ text }`), `done` (the full turn, same shape as the JSON answer), `error` (`{ code, message }`). If the response is not `text/event-stream` (an error envelope, a proxy that strips SSE, an old API) the body is parsed as the JSON turn or error — the gcdr-frontend#168 rule. If the transport cannot stream at all (no `ReadableStream`, TB iframe quirks), `send()` is used. API error codes never retry: `BOT_DISABLED`, `BOT_NO_ELIGIBLE_PROVIDER`, `BOT_BUDGET_EXCEEDED`, `BOT_PROVIDER_EXHAUSTED`, `FORBIDDEN`.
- **Thread resumption:** `conversations.resolve(key)` does `GET /bot/conversations?clientThreadKey=<key>` and creates with `clientThreadKey` when empty. GCDR already has `bot_conversations.client_thread_key` with the partial unique index (RFC-0087 87-10); the list filter is the one addition if it is not exposed yet (§GCDR side).
- **Context:** `context` is sent as a `context` object next to `message`; the GCDR side renders it as a labelled data block in the prompt (RFC-0087 §4.8 (e), data not instructions). Until GCDR accepts the field, the client prefixes the first message of a new thread with a one-line "Contexto: cliente X, página Y" and omits it afterwards — documented as the fallback, removed when the field exists.
- **Pending actions (phase 2, D-20):** a `done` turn may carry `pendingAction: { id, tool, summary, arguments, affectedCount, expiresAt }`; the widget renders `actionCard` and calls `POST /bot/actions/{id}/confirm` or `/cancel`. The widget never executes anything itself and never confirms without a click; the server re-authorizes with the principal at confirmation time.

## Bundles and size

- **ESM/CJS (`dist/index.js`, `dist/index.cjs`):** the module is exported from `src/index.ts`; bundlers tree-shake it.
- **UMD core (`dist/myio-js-library.umd.min.js`, limit 26 KB gzip):** exports `createMyIOBotClient` (≈ 3 KB: fetch, SSE parser, auth) and `loadBotWidget()` (≈ 0.3 KB), **not** the widget UI. `loadBotWidget()` injects `<script src="<same base URL as the core>/myio-bot-widget.umd.min.js">` once, resolves `window.MyIOBotWidget`, and rejects with `MyIOBotError('WIDGET_LOAD_FAILED')` after 10 s. The base URL is derived from the core's own `<script src>` (`document.currentScript` captured at load) so a pinned version stays pinned (`@0.1.600` loads the widget `@0.1.600`, never `@latest`).
- **UMD widget (`dist/myio-bot-widget.umd.min.js`, new, own limit 20 KB gzip):** second `rollup` input (`src/components/myio-bot/widget/umd.ts`), global `window.MyIOBotWidget`, depends on nothing from the core at runtime (it re-bundles the client; duplication ≈ 3 KB is accepted to keep the two files independent). `scripts/check-bundle-size.mjs` gains a per-file table instead of one constant.
- **Styles:** a Shadow DOM root with the CSS string of `styles.ts`; the Nunito `<link>` is added to `document.head` once unless `theme.fontLink === false` (ThingsBoard pages already load it). No global CSS, no `!important` wars with the dashboard.

## GCDR side (requests to gcdr.git, not blocking phase 1)

1. `GET /bot/status` adds `protocolVersion: 1`; a client whose `X-MyIO-Bot-Protocol` is higher than the server's gets `426 PROTOCOL_UNSUPPORTED` (the widget shows "Atualize o GCDR" instead of failing oddly).
2. `X-MyIO-Bot-Client` stored in `bot_conversations.metadata.client` and shown in the Operação tab / conversation list; `channel` stays `WEB` (no enum migration; a dedicated `EMBED` channel is §Unresolved).
3. `GET /bot/conversations?clientThreadKey=` filter if absent.
4. `context` object accepted on `POST …/messages` and rendered as data in the prompt.
5. Phase 2 (RFC-0087 D-20): `POST /bot/actions/{id}/confirm|cancel` and `pendingAction` on the turn.
6. `ALLOWED_ORIGINS` of the production API must list every host that embeds the widget (ThingsBoard origin, presetup); the widget documents the CORS failure explicitly ("Sem conexão com o GCDR — origem não autorizada").

## GCDR integration — who sees the bot, for which company, with which scope (RFC-0092; addendum 2026-11-25)

GCDR **RFC-0092 phase 1** (gcdr#273, in production since 2026-11-25, migration 0140) put a per-company entitlement and a two-key rule in front of every `/bot/*` chat route. The widget of 0.1.598 was written before it: it reads `enabled` / `permissions` from `GET /bot/status` and does not know the `access` object nor the new error codes, so a user whose company has no bot sees the pill, types, and only then gets a `403`. This section is the contract the library follows from phase 1b on. Source of truth in gcdr.git: `src/services/bot/entitlement/{BotAccessGate.ts, gate.ts, errors.ts}`, `src/middleware/requireBotAccess.ts`, `docs/rfcs/RFC-0092-MYIO-Bot-Customer-Entitlement-ThingsBoard.md`.

### 1. The switches, in the order GCDR evaluates them

The first "no" decides; `GET /bot/status` evaluates the same rows without consuming anything (no session, no rate token).

| # | Switch | Where it lives in GCDR | Who manages it | Refusal (HTTP / `error.code`) |
|---|---|---|---|---|
| 1 | **Platform** | `bot_control` scope `MASTER` | gcdr-web `/bot#operation` (`bot.control.operate`) | 503 `BOT_PLATFORM_OFF` |
| 2 | **Principal** | GCDR JWT (a person) or customer API key | login / API keys | 401 |
| 3 | **Company of the request** | resolution order of §2 below | — | 404 `BOT_CUSTOMER_NOT_FOUND` |
| 4 | **Company profile** (entitlement) | `customer_bot_entitlements`: status `INACTIVE` / `TRIAL` / `ACTIVE` / `SUSPENDED` (+ reason), plan (`bot_plans`), `capabilities` (`channels` WEB / API / THINGSBOARD, `tiers`, `allowWrite`, `tools`, `memory`), trial end, contract window; a holding covers its children only with `applies_to_descendants` | gcdr-web customer page → tab **Bot**; API `PUT /customers/:id/bot`, `POST /customers/:id/bot/status`, `GET /bot/plans` | 403 `BOT_CUSTOMER_DISABLED` · `BOT_CUSTOMER_SUSPENDED` · `BOT_CHANNEL_NOT_ALLOWED` |
| 5 | **User profile** (scope) | permission `bot.chat.use` (read) and `bot.actions.execute` (write — also needs the company's `allowWrite`); roles **`role:bot-reader`** / **`role:bot-writer`** assigned with scope `customer:<id>` (or the tenant); customer API keys: scope `bot:use` = `bot:read`, `bot:write` reserved | gcdr-web user → Acessos; delegated RBAC by customer API key (`rbac:write`, gcdr#266) | 403 `BOT_PERMISSION_MISSING` · `BOT_WRITE_NOT_ALLOWED` |
| 6 | **Limits** | plan ⊕ overrides: sessions (concurrent / per day / idle / max), messages per minute, input size, monthly quota (`included` + charged overage, `hardCap` default 2× included) | tab Bot of the customer | 429 `BOT_LIMIT_REACHED` (`details.limit`, `details.resetAt`) · 400 `BOT_MESSAGE_TOO_LONG` · 401 `BOT_SESSION_ENDED` |

**The two keys:** the company must have the bot (row 4) **and** the user must hold the scope (row 5). Either one missing means no bot — a user with `role:bot-reader` in a company that is off sees nothing, and an enabled company does not open the bot to users without the role.

### 2. Which company a request is about (row 3)

- **Customer API key** → its own customer (a `TENANT` key → the home customer).
- **A person** → (a) an explicit `customerId` the person reaches — `GET /bot/status?customerId=`, `POST /bot/conversations` body, `POST /bot/ask` body; one outside the reach is refused, never silently replaced; (b) the conversation's customer (`bot_conversations.scope_customer_id`); (c) `users.customer_id`; (d) the single customer the person reaches; (e) the home customer `BOT_HOME_CUSTOMER_ID` (default MYIO `56614a70-326f-11ef-ad2c-53aeabe7d3fa`).
- **Library rule:** when the host sets `context.customerId`, the client sends it as `customerId` on `status()` and `conversations.create()` (and `resolve()`). Never on `POST …/messages`: `PostMessageSchema` is strict and the conversation already carries its company.
- **Thread key:** a conversation belongs to one company, so the default key becomes `${host.app}:${customerId ?? '-'}:${userKey}`; switching the company of the page (`setContext` with another `customerId`) re-evaluates `status()` and resolves another thread.

### 3. MYIO is a company too (owner decision, 2026-11-25)

> *"mesmo sendo admin myio, seria bom tratar como uma empresa, ou seja, até mesmo o user da myio teria que ter scope de acesso e habilitado para myio"* — owner.

**Today (gcdr#273):** the master key and **platform admins bypass rows 4 and 6** (`isBypass()` in `BotAccessGate.ts`; they are still metered against the request customer), and a person's `bot.chat.use` comes from RBAC (`permissionGranted` over the effective permissions), which a broad admin policy also satisfies.

**Decision:**

1. **No person bypasses the company switch.** A MYIO admin is a user of the company MYIO (`56614a70-…`), resolved by the same row 3 (`users.customer_id` = MYIO, or the home customer), and passes rows 4–6 like any customer: MYIO's entitlement must be `ACTIVE` (0140 seeds it `ACTIVE`, plan `INTERNAL`) with the channel in use (`WEB` today, `THINGSBOARD` when the widget runs on dashboards).
2. **The scope is explicit.** A MYIO user chats only with `role:bot-reader` (writes: `role:bot-writer`) assigned with scope `customer:<MYIO>` or the tenant — never implied by the admin role or by a wildcard policy. For `bot.*`, only grants that name the bot count.
3. **Managing the bot is not using it.** The admin keeps every management power — the platform switch, plans, enabling / suspending companies, assigning the bot roles, `bot.control.operate`, `bot.memory.curate*` — independent of row 5.
4. **Suspending MYIO turns the bot off for MYIO users too:** a per-company kill switch below `MASTER`, the same for MYIO as for any customer.
5. **MYIO usage is metered as a company** (plan `INTERNAL`), so usage reports and quota warnings tell the truth about internal use.
6. **The master key** is a technical credential (smoke tests, ops scripts), not a person: it keeps its current behaviour until O-11 decides.

**GCDR changes this requires (gcdr.git, RFC-0092 amendment, phase 1b):** (a) `isBypass()` → the master key only (platform admins pass rows 4 and 6); (b) the bot permissions ignore wildcard grants (`*`, `bot.*` from an admin policy) and require `role:bot-reader` / `role:bot-writer` or a policy that names `bot.chat.use` / `bot.actions.execute`; (c) before deploying, assign `role:bot-reader` (`customer:<MYIO>`) to the MYIO users who used the bot in the last 30 days (`bot_usage_daily` / `bot_conversations`), so nobody loses access by surprise; (d) `/bot/status` reports the real `reason` for admins too.

### 4. What `GET /bot/status` tells the widget

```json
{
  "enabled": true, "master": true, "kind": "USER",
  "permissions": { "use": true, "execute": false, "curate": false, "curateAll": false, "operate": false },
  "access": {
    "available": false,
    "reason": "BOT_CUSTOMER_DISABLED",
    "customer": { "id": "84e0370e-…", "name": "Moxuara", "status": "INACTIVE", "statusReason": null },
    "permissions": { "read": true, "write": false },
    "quota": {
      "tokens":   { "included": 2000000, "hardCap": 4000000, "used": 1650000, "overage": 0, "percent": 82.5 },
      "usd":      { "included": null, "hardCap": null, "used": 3.1, "overage": 0, "percent": null },
      "messages": { "included": 3000, "hardCap": 6000, "used": 2410, "overage": 0, "percent": 80.3 }
    }
  }
}
```

- `access.available` is the one switch the widget obeys; `access.reason` is the first refusing row (`null` when available); `access.customer` names the company the request resolved to; `access.permissions.write` decides whether the action card (D-20) can ever render; `access.quota` is the month (UTC) of the company, `null` without an entitlement row.
- The status answers **200** in every case above (only an unauthenticated call is 401), so the widget calls it **at mount**, not on the first open: visibility is decided before the pill is drawn.
- **Tolerance:** a server without `access` (before RFC-0092) → the 0.1.598 behaviour (`enabled` / `permissions.use`).

### 5. Visibility and states in the widget

New options: `visibility?: 'auto' | 'always'` (default `'auto'`: the pill is not drawn when the user cannot use the bot; `'always'` for support / admin pages: a muted pill that explains why), an `'access'` event (`handle.on('access', cb)`, payload = `access`) so the host can react, `statusRefreshMs` (default 300 000) and a re-check of `status()` after any 403 / 429 of a turn.

| `access.reason` | Pill (`auto`) | Pill (`always`) | Panel |
|---|---|---|---|
| `null` (available) | visible | visible | chat; header "MYIO Bot · `customer.name`"; banner when a quota reaches 80 % / 100 % of `included` |
| `BOT_PLATFORM_OFF` | muted | muted | "O MYIO Bot está desligado no momento"; no composer |
| `BOT_CUSTOMER_NOT_FOUND` | hidden | muted | "Não foi possível identificar o cliente" |
| `BOT_CUSTOMER_DISABLED` | hidden | muted | "O MYIO Bot não está habilitado para `customer.name`" + `statusReason` |
| `BOT_CUSTOMER_SUSPENDED` | muted | muted | "suspenso para `customer.name`" + `statusReason`; **no history, no thread list** (RFC-0092 O-4) |
| `BOT_CHANNEL_NOT_ALLOWED` | hidden | muted | "não liberado neste canal para `customer.name`" |
| `BOT_PERMISSION_MISSING` | hidden | muted | "Você não tem permissão para usar o MYIO Bot. Peça acesso ao administrador." |
| `BOT_LIMIT_REACHED` | visible | visible | history readable; composer disabled with `details.resetAt` ("volta em 01/12") |

Per turn: `BOT_WRITE_NOT_ALLOWED` → no action card; `BOT_MESSAGE_TOO_LONG` → inline error, the text stays in the composer; `BOT_SESSION_ENDED` → one silent re-resolve of the thread (new session), then the message. The widget shows the server's `error.message` (already pt-BR) and uses `error.code` for the title and icon, `error.details` (`customerId`, `status`, `reason`, `limit`, `resetAt`) for the line under it — never a client-side guess.

### 6. Deep link and client identification

- **"Abrir no GCDR"** → `${gcdrWebUrl}/bot?c=<id>#chat` (canonical, as gcdr-web's `botPageHref`). 0.1.598 generates `/bot#chat?c=<id>`; gcdr-web accepts both since `feat/bot-widget-library-sdk`, but the library moves to the canonical form.
- **Client header:** GCDR already reads **`X-Bot-Client`** (`^[A-Za-z0-9._:-]{1,64}$`, already in the CORS `allowedHeaders`) and keys the session by it (`bot_sessions.client_key`). The library sends `X-Bot-Client: <host.app>` always; `X-MyIO-Bot-Client` / `X-MyIO-Bot-Protocol` stay behind `sendClientHeaders` until GCDR lists them (§GCDR side, item 2).

### 7. ThingsBoard (RFC-0092 phase 2 — blocked on its O-8, the allowed ThingsBoard hosts)

- The company needs `THINGSBOARD` in `capabilities.channels`; the user needs the same scope of row 5.
- New auth strategy `auth: { thingsboard: { tbBaseUrl, tbToken: () => string | Promise<string> } }`: the client exchanges the ThingsBoard JWT at `POST /bot/auth/thingsboard` for a GCDR token (`aud gcdr-bot`, 15 min) and renews it before it expires. Person chat on a dashboard never uses an API key in the browser.
- The ThingsBoard customer maps to `customers.external_id`; the ThingsBoard user must exist in GCDR (active e-mail within the company's reach), else 403 `BOT_USER_NOT_PROVISIONED` (no auto-provisioning, RFC-0092 O-1).

### 8. Changes by repository

| Repository | Change |
|---|---|
| **myio-js-library** (next release) | `status()` at mount; `access` handling, `visibility`, `'access'` event, states of §5, quota banner; new codes in i18n; `customerId` on `status()` / `create()` / `resolve()`; thread key with the company; `X-Bot-Client`; deep link `/bot?c=<id>#chat`; tests |
| **gcdr** | MYIO as a company (§3 a–d); later, phase 2 token exchange |
| **gcdr-web** | phase 4 (already in progress): mounts the library widget; passes `context.customerId` on pages about one company (customer detail, OS of a customer); `visibility: 'auto'` |

### 9. Tests (library)

One fixture per `access.reason` (pill hidden / muted, panel text, no composer where the table says so); a server without `access`; quota at 79 / 80 / 100 % of `included`; suspended company → no history request is made; a 403 in the middle of a conversation re-evaluates `status()` and updates the pill; `customerId` reaches `status()` and `create()` but never `POST …/messages`; `X-Bot-Client` on every call; deep link format.

### 10. Open points

- **O-11 — Master key.** Keep its bypass of rows 4 and 6, or no chat at all with it (status and operation only)? Default: unchanged until decided.
- **O-12 — Visibility per host.** Default `'auto'` everywhere; `'always'` only on support / admin pages.
- **O-13 — Who sees the quota banner.** Default: every user sees 100 %; 80 % only for users who can manage the company's bot.

## Security

- **Principal is the host's, never the library's.** The widget holds whatever credential the host gives it, exactly like `GcdrAnnotationsClient` and `initMyIOAuthContext` do today. A customer API key carries the key's customer reach and no `USER` memory scope (RFC-0087 D-13): on a shared dashboard the bot cannot propose personal memories and sees only that customer. A GCDR JWT carries the person's permissions; `status().permissions` drives which controls the widget renders, and the server enforces them anyway.
- **No DOM scraping, no telemetry.** Only `context` fields the host sets are sent. The widget does not read the page, cookies or storage beyond its own `localStorage` key for the hidden launcher.
- **Data policy is the server's.** Eligibility by `DATA_POLICY` per channel (D-14) decides whether a cloud provider may see a given thread; the widget shows the notice text the server returns (`DATA_POLICY.default.noticeText`) above the composer, as gcdr-web does.
- **Write actions need a human.** D-20: the widget renders the pending action and sends a confirmation; it never infers consent from text, never auto-confirms, and shows the server's own summary and count, not a client-side guess.
- **Secrets in TB attributes.** Unchanged from `RFC-sdk-auth-and-tb-customer-credentials`: the key lives in the TB customer attribute, is read at widget init, never logged. The library's `createLogHelper` redaction rules apply to the client's debug logs.

## Tests

- `tests/myio-bot/client.test.ts`: envelope unwrapping, auth strategies (exactly one), headers, timeouts, error classes, `resolve()` find-or-create.
- `tests/myio-bot/sse.test.ts`: delta/done/error parsing from a fake `ReadableStream`, split frames, JSON fallback, abort.
- `tests/myio-bot/widget.test.ts` (jsdom): launcher mount/hide/persist, thread resume, send → stream → footer, 403/404/503 states, proposals card, action card confirm/cancel, `destroy()` leaves no node.
- `tests/myio-bot/contract.snapshot.test.ts`: field list vs the checked-in GCDR OpenAPI snapshot (`tests/myio-bot/gcdr-bot-openapi.snapshot.json`, refreshed by a script from `gcdr.git/docs/openapi.yaml`).
- `scripts/smoke-test.js` gains an inline HTML page that loads the UMD core, calls `loadBotWidget()` against a stub server and asserts the pill renders — the ThingsBoard scenario.

## Rollout

| Phase | Content | Exit | Estimate |
|---|---|---|---|
| **0 — Contract** | `contract.ts`, snapshot test, `authStrategies`, `errors`; GCDR asks 1–3 filed as a gcdr PR | snapshot test green against production OpenAPI | 1 day |
| **1 — Client + widget** | `client.ts`, `sse.ts`, widget (launcher, panel, thread, composer, states, proposals), second UMD bundle, `loadBotWidget()`, size limits, tests; export from `src/index.ts`; npm release `0.1.x` | an inline HTML page with the UMD and a customer API key chats with production; gcdr-web parity on states and footer | 4–5 days |
| **1b — GCDR access (RFC-0092)** | §GCDR integration: status at mount, `access` states and visibility, quota banner, codes, `customerId` on status/create, thread key with the company, `X-Bot-Client`, deep link `/bot?c=<id>#chat`; GCDR side: MYIO as a company (no admin bypass, explicit scope) | a fixture per `access.reason` green; gcdr-web (first consumer, phase 4) hides the pill for a user without scope and for a company without the bot | 2–3 days (library) + GCDR change |
| **2 — First host** | `main-dashboard-shopping v-5.2.0`: MENU gets the pill, MAIN_VIEW passes credentials and `context` (customer, page); presetup pages the same | operators use it for one week; conversations show `client = tb-main-dashboard-shopping` in Operação | 2 days + 1 week |
| **3 — Actions** | `actionCard` wired to RFC-0087 phase 2 pending actions (D-20); "inativar os elevadores do Moxuara" confirmed from a dashboard | T-12 of RFC-0087 passes through the widget; audit row shows the host | after gcdr phase 2 |
| **4 — gcdr-web converges** | gcdr-frontend mounts the library widget (vanilla inside a React ref) and deletes its own `BotWidget`, keeping the full `/bot` page; alarms-frontend uses the client | one chat implementation across MYIO | 2 days |

# Drawbacks

- **Two bundles to version.** The on-demand widget bundle must match the core's version; `loadBotWidget()` derives the URL from the core's `<script src>`, but a host that copies the core to its own CDN must copy the widget too. Documented; a mismatch fails loudly (`WIDGET_LOAD_FAILED`).
- **Duplication for a while.** Until phase 4, gcdr-frontend keeps its React widget and the library its vanilla one; the wire contract is shared through `contract.ts` and the OpenAPI snapshot, the UI is not.
- **Credential surface grows.** A customer API key with `bot:use` on a shared dashboard means anyone at that screen talks to the bot as that customer. That is the same exposure the dashboards already accept for tariffs and annotations, and the server's reach checks bound it; still, it is one more thing a key can do.
- **CORS and `ALLOWED_ORIGINS` become operational work:** each new host origin is a production env change on the GCDR API.

# Rationale and alternatives

- **Why a library module and not an iframe of gcdr-web?** An iframe would carry gcdr-web's auth (JWT, login page), not the host's credential, and could not receive `context` cheaply; it would also break on ThingsBoard's CSP and sizing. The vanilla widget follows how every other GCDR-backed piece reached the dashboards (annotations, settings hub, login).
- **Why a second UMD bundle instead of growing the core?** The core has a 26 KB gzip budget that every widget on every dashboard pays on each load; a chat UI with styles is ≈ 15–20 KB. Lazy-loading keeps the bill on the pages that open the bot.
- **Why a hand-written `contract.ts` and not generated types?** The library has no codegen step and the `/bot/*` surface is ~20 shapes; a snapshot test gives the drift detection generated types would, without a new toolchain. Revisit if the surface triples.
- **Why `clientThreadKey` and not a thread per page load?** Operators reload dashboards all day; a fresh thread each time loses the context the bot just built. The key is the host's choice (customer + user by default), so two users on the same customer do not share a thread unless the host says so.
- **Alternative considered: a React component in a separate package.** Rejected: ThingsBoard widgets are zero-build vanilla; a React package would serve gcdr-frontend only, which already has one.

# Prior art

- `GcdrAnnotationsClient` (RFC-0218): auth strategy selection, envelope handling, error classes — copied here.
- `openSettingsHubModal` (RFC-0215) and `openConfirmDialog` (RFC-0205): the `open*(options) → handle` convention and the confirmation primitive.
- `myio-gcdr-login` (`gcdrClient.ts`): the GCDR JWT flow a host can use to obtain the bearer token.
- gcdr-frontend `src/services/api/botService.ts` + `src/hooks/useBotChat.ts` (#168): SSE/JSON rules, error states, proposals — the behavioural reference; the library ports the behaviour, not the React code.
- Intercom/Crisp-style embeddable chat SDKs: launcher + panel + `window.X.load()` with a pinned version; the on-demand second bundle follows that shape.

# Unresolved questions

- **U-1 — Channel.** Keep `channel = WEB` with `metadata.client`, or add an `EMBED` (or per-host) value to `bot_channel` so `DATA_POLICY` and `ROUTING.channels` can treat dashboards differently from gcdr-web (e.g. no tools on a shared screen)? Default: `WEB` + metadata in phase 1; decide before phase 3, because D-20 actions from a shared dashboard may deserve a stricter policy.
- **U-2 — Who holds the credential on a shared dashboard.** The customer API key (today's pattern) means every viewer acts as the customer; a per-person GCDR JWT (via `myio-gcdr-login`) means a login step on the dashboard. Default: API key for reads and chat, JWT required for any D-20 action (the server can enforce "actions need a user principal").
- **U-3 — One UI or two.** Phase 4 proposes that gcdr-frontend adopt the library widget; the owner may prefer to keep the React one for the full page and use the library only elsewhere.
- **U-4 — Version floor.** Should GCDR refuse protocol versions older than N (forcing dashboards to update the pinned library), or keep serving old clients indefinitely? Default: serve N-1, warn in Operação.
- **U-5 — Telemetry of use.** Whether the widget reports open/close/turn counts to GCDR for the §5.0 metrics of RFC-0087 (today only turns are counted, server-side). Default: no client telemetry; the server already sees every turn.

# Future possibilities

- A `MyIOBotWidget` slot for host-provided quick prompts ("status das centrais", "OS abertas hoje") rendered as chips above the composer.
- Voice input on mobile dashboards (Web Speech API) feeding the same `ask()`.
- A Node-RED node (`NODE-RED/` in this repo) wrapping `createMyIOBotClient` so a central can ask the bot in a flow — with `channel` and data policy decided first (U-1).
- Embedding the Memória curation tab for curators inside the dashboards, once phase 2 of RFC-0087 stabilises the memory API.
