/**
 * RFC-0218 — GcdrAnnotationsClient types.
 *
 * GCDR-native annotation shape (`GET/POST /annotations`, GCDR RFC-0036) plus
 * the client's own params/error types. Kept intentionally tolerant (index
 * signature on the annotation shape) since the API guide says unknown fields
 * are ignored, not rejected — this client must not break when GCDR adds a
 * field.
 */

/** GCDR's annotation "kind" — distinct spelling from the legacy RFC-0104 set (see `adapters.ts`). */
export type GcdrAnnotationType = 'observation' | 'pending' | 'maintenance' | 'activity';

export type GcdrAnnotationImportance = 1 | 2 | 3 | 4 | 5;

/** Terminal disposition once an annotation is finalized (`finalized: true`). */
export type GcdrFinalizedReason = 'approved' | 'rejected' | 'archived';

/** A response/comment posted against an annotation. `approved` never requires `text`; the rest do. */
export type GcdrResponseType = 'comment' | 'approved' | 'rejected' | 'archived';

/**
 * The kind of TB/GCDR entity an annotation is attached to. Deliberately a
 * plain string, not a fixed union — GCDR's entity registry is open-ended
 * (RFC-0218 §guide: `listByEntity('device', gcdrDeviceId)`, but any entity
 * type GCDR recognizes works, e.g. a central's own GCDR UUID).
 */
export type GcdrEntityType = string;

export interface GcdrUserSnapshot {
  id: string;
  email: string;
  name: string;
}

export interface GcdrAnnotationResponse {
  id: string;
  type: GcdrResponseType;
  text?: string;
  createdAt: string;
  createdBy: GcdrUserSnapshot;
}

export interface GcdrAnnotationEvent {
  id: string;
  action: string;
  at: string;
  by?: GcdrUserSnapshot;
  [key: string]: unknown;
}

export interface GcdrAnnotationAttachment {
  id: string;
  fileName: string;
  url?: string;
  [key: string]: unknown;
}

/** List-shape annotation — what `GET /annotations` returns per item. */
export interface GcdrAnnotation {
  id: string;
  version: number;
  customerId: string;
  entityType: GcdrEntityType;
  entityId: string;
  text: string;
  type: GcdrAnnotationType;
  importance: GcdrAnnotationImportance;
  finalized: boolean;
  finalizedReason?: GcdrFinalizedReason;
  createdAt: string;
  createdBy: GcdrUserSnapshot;
  dueDate?: string | null;
  /** Tolerant of fields this client doesn't model yet (API guide: "unknown fields ignored"). */
  [key: string]: unknown;
}

/** Detail-shape annotation — `GET /annotations/:id` adds responses/events/mentions/attachments. */
export interface GcdrAnnotationDetail extends GcdrAnnotation {
  responses: GcdrAnnotationResponse[];
  events: GcdrAnnotationEvent[];
  mentions?: string[];
  attachments?: GcdrAnnotationAttachment[];
}

export interface GcdrAnnotationListParams {
  customerId?: string;
  entityType?: GcdrEntityType;
  entityId?: string;
  type?: GcdrAnnotationType;
  status?: string;
  importance?: GcdrAnnotationImportance;
  includeArchived?: boolean;
  page?: number;
  limit?: number;
}

/** One page of `GET /annotations`. */
export interface GcdrAnnotationListPage {
  items: GcdrAnnotation[];
  pagination: {
    page: number;
    limit: number;
    total?: number;
    hasNext?: boolean;
  };
}

export interface GcdrCreateAnnotationInput {
  entityType: GcdrEntityType;
  entityId: string;
  customerId: string;
  text: string;
  type: GcdrAnnotationType;
  importance: GcdrAnnotationImportance;
  dueDate?: string;
}

export type GcdrPatchAnnotationInput = Partial<
  Pick<GcdrCreateAnnotationInput, 'text' | 'type' | 'importance' | 'dueDate'>
>;

export interface GcdrRespondInput {
  type: GcdrResponseType;
  /** Required for every type except `approved` (API guide §5 rule, mirrored in `respond()`). */
  text?: string;
}

/** Auth is a strategy, not an if-chain — see `authStrategies.ts`. Exactly one of the two is required. */
export interface GcdrAnnotationsAuthConfig {
  /** JWT for user-context calls. May be a string or an async provider (token-cache friendly). */
  bearerToken?: string | (() => Promise<string> | string);
  /** Customer API Key (`gcdr_cust_…`) for M2M calls; hierarchyAccess scoping applies server-side. */
  apiKey?: string;
}

export interface GcdrAnnotationsClientLogger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface GcdrAnnotationsClientParams {
  /** Base URL WITH version, e.g. "https://gcdr-api.a.myio-bas.com/api/v1". Never rewritten. */
  domainPath: string;
  auth: GcdrAnnotationsAuthConfig;
  /** Optional GET cache (ms). 0/undefined = disabled. */
  cacheTtlMs?: number;
  /** Injectable for tests; default `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  logger?: GcdrAnnotationsClientLogger;
  /** Hard cap on pages walked by listByCustomer/listByEntity. Default 50. */
  maxPages?: number;
}

/** Structured GCDR Annotations API failure. */
export class GcdrAnnotationsError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message?: string, code?: string) {
    super(message || `HTTP_${status}`);
    this.name = 'GcdrAnnotationsError';
    this.status = status;
    this.code = code;
  }
}

/**
 * 409 from a write (PATCH/archive/respond with a stale `If-Match` version, or
 * an already-finalized annotation). `finalizedOrStale` is always `true` here —
 * callers must re-read (`getById`) and retry with the fresh version, never
 * blind-retry the same write (API guide §5).
 */
export class GcdrAnnotationsConflictError extends GcdrAnnotationsError {
  readonly finalizedOrStale = true;

  constructor(message?: string) {
    super(409, message, 'CONFLICT');
    this.name = 'GcdrAnnotationsConflictError';
  }
}
