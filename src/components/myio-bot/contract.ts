/**
 * RFC-0242 — wire contract of the GCDR company bot (gcdr RFC-0087, `/api/v1/bot/*`).
 *
 * Hand-written from gcdr `docs/openapi.yaml` (paths `/bot/...`, schemas `Bot*`)
 * and checked against the controller (`src/controllers/bot.controller.ts`) and
 * the Zod DTOs (`src/dto/request/BotDTO.ts`). `tests/myio-bot/contract.snapshot.test.ts`
 * compares the field lists below against a checked-in snapshot of that OpenAPI,
 * so a GCDR change shows up as a failing test here, not in a dashboard.
 *
 * Fields the RFC proposes but GCDR does not expose yet are kept apart in
 * `MYIO_BOT_PROPOSED_EXTENSIONS` and are always optional: the client tolerates
 * their absence (protocolVersion → 1, pendingAction → no action card, …).
 */

/** Protocol spoken by this client. GCDR does not return it yet (absent → 1). */
export const MYIO_BOT_PROTOCOL_VERSION = 1;

export type MyIOBotTier = 'T0' | 'T1' | 'T2';
export type MyIOBotChannel = 'WEB' | 'SLACK' | 'WHATSAPP' | 'TELEGRAM' | 'API';
export type MyIOBotScopeType = 'COMPANY' | 'TEAM' | 'CUSTOMER' | 'USER' | 'CONVERSATION';
export type MyIOBotMemoryKind = 'FACT' | 'PREFERENCE' | 'PROCEDURE' | 'DECISION' | 'GLOSSARY' | 'REFERENCE';
export type MyIOBotMemoryStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'REJECTED';

/** `#/components/schemas/BotPermissions` */
export interface MyIOBotPermissions {
  use: boolean;
  curate: boolean;
  curateAll: boolean;
  operate: boolean;
}

/** `GET /bot/status` → data. `protocolVersion` is an RFC-0242 addition (defaults to 1). */
export interface MyIOBotStatus {
  enabled: boolean;
  /** MASTER switch of bot_control; false → turns answer 503 BOT_DISABLED. */
  master: boolean;
  providers: Array<{ name: string; usable: boolean; residency: 'CLOUD' | 'LOCAL'; costTier: 'LOW' | 'MID' | 'HIGH' }>;
  permissions: MyIOBotPermissions;
  kind: 'USER' | 'API_KEY' | 'MASTER';
  protocolVersion: number;
}

/** `#/components/schemas/BotConversation` */
export interface MyIOBotConversation {
  id: string;
  title: string;
  channel: MyIOBotChannel | string;
  shared: boolean;
  status: 'OPEN' | 'CLOSED' | string;
  isOwner: boolean;
  ownerId: string | null;
  hasExternalParticipants: boolean;
  lastTier: string | null;
  lastProvider: string | null;
  clientThreadKey: string | null;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** One row of `GET /bot/conversations/{id}` → data.messages (controller shape; the OpenAPI only describes it in prose). */
export interface MyIOBotMessage {
  id: number;
  seq: number;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tier: string | null;
  provider: string | null;
  model: string | null;
  toolCalls: unknown;
  memoryIds: string[];
  tokensIn: number | null;
  tokensOut: number | null;
  costEstimatedUsd: number | null;
  createdAt: string;
}

/** Item of `BotTurnResult.proposals` — a DRAFT memory the bot already created. */
export interface MyIOBotProposal {
  id: string;
  summary: string;
  kind: string;
  scopeType: string;
  status: string;
}

/**
 * RFC-0087 D-20 (phase 2, NOT in GCDR yet) — a write tool waiting for a human
 * confirmation. The widget renders it only when a turn carries it.
 */
export interface MyIOBotPendingAction {
  id: string;
  tool: string;
  summary: string;
  arguments: Record<string, unknown>;
  affectedCount?: number | null;
  expiresAt?: string | null;
}

/** `#/components/schemas/BotTurnResult` (+ `pendingAction`, RFC-0242 / D-20 extension). */
export interface MyIOBotTurn {
  conversationId: string;
  messageId: number;
  answer: string;
  tier: MyIOBotTier;
  tierReason?: string;
  cappedFrom?: MyIOBotTier;
  degradedFrom?: MyIOBotTier;
  provider: string;
  model: string;
  usage: { tokensIn: number; tokensOut: number; tokensCached?: number };
  costEstimatedUsd: number;
  priced: boolean;
  memoryIds: string[];
  proposals: MyIOBotProposal[];
  toolCalls: string[];
  stopReason: string;
  /** DATA_POLICY noticeText on the first turn of a conversation. */
  notice?: string;
  redactions?: number;
  pendingAction?: MyIOBotPendingAction | null;
}

/** `#/components/schemas/BotMemorySource` (+ server-filled provenance on stored rows). */
export interface MyIOBotMemorySource {
  url?: string;
  document?: string;
  excerpt?: string;
  version?: string;
  [extra: string]: unknown;
}

/** `#/components/schemas/BotMemory` */
export interface MyIOBotMemory {
  id: string;
  tenantId: string;
  scopeType: MyIOBotScopeType;
  customerId: string | null;
  userId: string | null;
  conversationId: string | null;
  teamKey: string | null;
  kind: MyIOBotMemoryKind;
  content: string;
  summary: string;
  tags: string[];
  source: MyIOBotMemorySource;
  confidence: number;
  validFrom: string;
  validTo: string | null;
  supersededBy: string | null;
  status: MyIOBotMemoryStatus;
  retrievalCount: number;
  lastRetrievedAt: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on `/bot/memories/search` hits (FTS rank). */
  rank?: number;
}

/** `#/components/schemas/BotMemoryScope` */
export interface MyIOBotMemoryScope {
  scopeType: MyIOBotScopeType;
  customerId?: string;
  userId?: string;
  conversationId?: string;
  teamKey?: string;
}

/** `#/components/schemas/BotMemoryProposal` (request body of `POST /bot/memories`). */
export interface MyIOBotMemoryProposal {
  scope: MyIOBotMemoryScope;
  kind: MyIOBotMemoryKind;
  summary: string;
  content: string;
  tags?: string[];
  confidence?: number;
  source?: { url?: string; document?: string; excerpt?: string; version?: string };
  validTo?: string | null;
}

/** `POST /bot/memories` → data. */
export interface MyIOBotProposeResult {
  memory: MyIOBotMemory;
  similar: Array<{ id: string; summary: string; status: string; similarity: number }>;
  autoActivated: boolean;
}

/** `POST /bot/actions/{id}/confirm` → data (D-20, phase 2 — shape not defined by GCDR yet). */
export interface MyIOBotActionResult {
  id?: string;
  status?: string;
  summary?: string;
  affectedCount?: number;
  [extra: string]: unknown;
}

/**
 * Host context sent with each turn (never scraped). GCDR does not accept a
 * `context` body field yet (PostMessageSchema is `.strict()` → 400), so the
 * client renders it as a one-line prefix by default (`contextMode: 'prefix'`).
 */
export interface MyIOBotContext {
  customerId?: string;
  customerName?: string;
  entityId?: string;
  entityType?: string;
  page?: string;
  note?: string;
}

/** The GCDR envelope (RFC-0241 Phase 0). */
export interface MyIOBotEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: unknown };
  meta?: { requestId?: string; timestamp?: string };
}

// ── Drift detection (used by tests/myio-bot/contract.snapshot.test.ts) ─────

type Missing<T, K extends readonly PropertyKey[]> = Exclude<keyof T, K[number]>;
/** Compile-time guard: the list names every key of T (an omission is a TS error on `npm run build`). */
function fieldsOf<T>() {
  return <K extends readonly (keyof T)[]>(...keys: K & (Missing<T, K> extends never ? unknown : { __missing: Missing<T, K> })) =>
    keys as readonly string[];
}

/** Field list per OpenAPI component schema, as this client models it. */
export const MYIO_BOT_CONTRACT_FIELDS: Record<string, readonly string[]> = {
  BotPermissions: fieldsOf<MyIOBotPermissions>()('use', 'curate', 'curateAll', 'operate'),
  BotConversation: fieldsOf<MyIOBotConversation>()(
    'id', 'title', 'channel', 'shared', 'status', 'isOwner', 'ownerId', 'hasExternalParticipants',
    'lastTier', 'lastProvider', 'clientThreadKey', 'messageCount', 'createdAt', 'updatedAt'
  ),
  BotTurnResult: fieldsOf<MyIOBotTurn>()(
    'conversationId', 'messageId', 'answer', 'tier', 'tierReason', 'cappedFrom', 'degradedFrom', 'provider', 'model',
    'usage', 'costEstimatedUsd', 'priced', 'memoryIds', 'proposals', 'toolCalls', 'stopReason', 'notice', 'redactions',
    'pendingAction'
  ),
  BotMemory: fieldsOf<MyIOBotMemory>()(
    'id', 'tenantId', 'scopeType', 'customerId', 'userId', 'conversationId', 'teamKey', 'kind', 'content', 'summary',
    'tags', 'source', 'confidence', 'validFrom', 'validTo', 'supersededBy', 'status', 'retrievalCount',
    'lastRetrievedAt', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'rank'
  ),
  BotMemoryScope: fieldsOf<MyIOBotMemoryScope>()('scopeType', 'customerId', 'userId', 'conversationId', 'teamKey'),
  BotMemoryProposal: fieldsOf<MyIOBotMemoryProposal>()('scope', 'kind', 'summary', 'content', 'tags', 'confidence', 'source', 'validTo'),
  /** Inline schema of `GET /bot/status` → data. */
  'GET /bot/status': fieldsOf<MyIOBotStatus>()('enabled', 'master', 'providers', 'permissions', 'kind', 'protocolVersion'),
};

/** Fields this client models that GCDR's OpenAPI does not have (RFC-0242 §GCDR side / D-20). Always optional on the wire. */
export const MYIO_BOT_PROPOSED_EXTENSIONS: Record<string, readonly string[]> = {
  BotTurnResult: ['pendingAction'],
  BotMemory: ['rank'],
  'GET /bot/status': ['protocolVersion'],
};

/** Every (method, path) this client calls. Paths under `/bot/actions` are RFC-0087 phase 2 (not in GCDR yet). */
export const MYIO_BOT_ENDPOINTS: ReadonlyArray<{ method: string; path: string; proposed?: boolean }> = [
  { method: 'get', path: '/bot/status' },
  { method: 'get', path: '/bot/conversations' },
  { method: 'post', path: '/bot/conversations' },
  { method: 'get', path: '/bot/conversations/{id}' },
  { method: 'patch', path: '/bot/conversations/{id}' },
  { method: 'post', path: '/bot/conversations/{id}/messages' },
  { method: 'get', path: '/bot/memories/search' },
  { method: 'post', path: '/bot/memories' },
  { method: 'patch', path: '/bot/memories/{id}' },
  { method: 'post', path: '/bot/actions/{id}/confirm', proposed: true },
  { method: 'post', path: '/bot/actions/{id}/cancel', proposed: true },
];

/** Request-body fields this client sends, per endpoint (must be accepted by GCDR's strict Zod schemas). */
export const MYIO_BOT_REQUEST_FIELDS: Record<string, readonly string[]> = {
  'POST /bot/conversations': ['title', 'shared', 'clientThreadKey'],
  'PATCH /bot/conversations/{id}': ['title', 'shared', 'status'],
  'POST /bot/conversations/{id}/messages': ['message'],
  'PATCH /bot/memories/{id}': ['action', 'reason'],
};

/** API error codes that must never be retried (RFC-0242 §Streaming). */
export const MYIO_BOT_NON_RETRYABLE_CODES: readonly string[] = [
  'BOT_DISABLED',
  'BOT_NO_ELIGIBLE_PROVIDER',
  'BOT_BUDGET_EXCEEDED',
  'BOT_PROVIDER_EXHAUSTED',
  'FORBIDDEN',
];
