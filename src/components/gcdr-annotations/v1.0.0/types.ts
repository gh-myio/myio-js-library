/**
 * RFC-0218 — GcdrAnnotationsClient types.
 *
 * GCDR-native annotation shape (`GET/POST /annotations`, GCDR RFC-0036,
 * `gcdr/src/domain/entities/annotations/Annotation.ts`) plus the client's own
 * params/error types. Kept intentionally tolerant (index signature on the
 * annotation shape) since the API guide says unknown fields are ignored, not
 * rejected — this client must not break when GCDR adds a field.
 */
import type { AuthStrategy } from './authStrategies';

/** GCDR's annotation "kind" — same set as the legacy RFC-0104 `AnnotationType`. */
export type GcdrAnnotationType = 'observation' | 'pending' | 'maintenance' | 'activity';

export type GcdrAnnotationImportance = 1 | 2 | 3 | 4 | 5;

/** Native lifecycle status (GCDR `annotations.status`). */
export type GcdrAnnotationStatus = 'created' | 'modified' | 'archived';

/** Terminal disposition once an annotation is finalized (`finalized: true`). */
export type GcdrFinalizedReason = 'approved' | 'rejected' | 'archived';

/** A response/comment posted against an annotation. `approved` never requires `text`; the rest do. */
export type GcdrResponseType = 'comment' | 'approved' | 'rejected' | 'archived';

/**
 * The kind of entity an annotation is attached to. GCDR accepts
 * `device | work_order | work_order_event`; kept a string so a new GCDR entity
 * type doesn't need a client release.
 */
export type GcdrEntityType = string;

/** Actor snapshot GCDR stores on every row. `email`/`name` may be absent (system actors). */
export interface GcdrUserSnapshot {
  id: string;
  email?: string;
  name?: string;
}

export interface GcdrAnnotationResponse {
  id: string;
  annotationId?: string;
  type: GcdrResponseType;
  text?: string | null;
  createdAt: string;
  createdBy: GcdrUserSnapshot;
}

/** Append-only history row (GCDR `annotation_events`). */
export interface GcdrAnnotationEvent {
  id: string;
  action: string;
  responseId?: string;
  previousVersion?: number;
  changes?: Record<string, { from: unknown; to: unknown }>;
  actor?: GcdrUserSnapshot;
  createdAt: string;
  [key: string]: unknown;
}

export interface GcdrAnnotationAttachment {
  id: string;
  fileAssetId: string;
  responseId?: string;
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
  status?: GcdrAnnotationStatus;
  finalized: boolean;
  finalizedReason?: GcdrFinalizedReason;
  acknowledged?: boolean;
  acknowledgedBy?: GcdrUserSnapshot;
  acknowledgedAt?: string;
  createdAt: string;
  createdBy: GcdrUserSnapshot;
  updatedAt?: string;
  updatedBy?: GcdrUserSnapshot;
  dueDate?: string | null;
  /** Tolerant of fields this client doesn't model yet (API guide: "unknown fields ignored"). */
  [key: string]: unknown;
}

/** Detail-shape annotation — `GET /annotations/:id` adds responses/events/mentions/attachments. */
export interface GcdrAnnotationDetail extends GcdrAnnotation {
  responses: GcdrAnnotationResponse[];
  events: GcdrAnnotationEvent[];
  mentions?: unknown[];
  attachments?: GcdrAnnotationAttachment[];
}

export interface GcdrAnnotationListParams {
  customerId?: string;
  entityType?: GcdrEntityType;
  entityId?: string;
  type?: GcdrAnnotationType;
  status?: GcdrAnnotationStatus;
  importance?: GcdrAnnotationImportance;
  /** Only `true` is sent — GCDR excludes archived annotations by default. */
  includeArchived?: boolean;
  /** Opaque cursor from the previous page's `pagination.nextCursor`. */
  cursor?: string;
  /** Page size, 1..100 (GCDR cap). */
  limit?: number;
}

/** One page of `GET /annotations` (GCDR `PaginatedResult`). */
export interface GcdrAnnotationListPage {
  items: GcdrAnnotation[];
  pagination: {
    total?: number;
    totalPages?: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface GcdrCreateAnnotationInput {
  entityType: GcdrEntityType;
  entityId: string;
  customerId: string;
  text: string;
  type: GcdrAnnotationType;
  importance: GcdrAnnotationImportance;
  /** ISO 8601 with offset (GCDR validates `datetime({ offset: true })`). */
  dueDate?: string;
}

export type GcdrPatchAnnotationInput = Partial<
  Pick<GcdrCreateAnnotationInput, 'text' | 'type' | 'importance' | 'dueDate'>
>;

export interface GcdrRespondInput {
  type: GcdrResponseType;
  /** Required for every type except `approved` (API guide §5 rule, mirrored in `respond()`). */
  text?: string;
  /** Optimistic lock for finalizing responses (sent as `If-Match`). */
  version?: number;
}

type TokenSource = string | (() => Promise<string> | string);

/**
 * Auth is a strategy, not an if-chain — see `authStrategies.ts`. Exactly one
 * of the three credentials is required.
 */
export interface GcdrAnnotationsAuthConfig {
  /** GCDR JWT for user-context calls. May be a string or a provider. */
  bearerToken?: TokenSource;
  /** Customer API Key (`gcdr_cust_…`) for M2M calls. */
  apiKey?: string;
  /**
   * The signed-in user's ThingsBoard JWT, sent as `X-TB-Authorization`
   * (GCDR validates it against ThingsBoard — the dashboard path). Use a
   * provider so a refreshed TB token is picked up on every request.
   */
  tbSessionToken?: TokenSource;
}

export interface GcdrAnnotationsClientLogger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface GcdrAnnotationsClientParams {
  /** Base URL WITH version, e.g. "https://gcdr-api.a.myio-bas.com/api/v1". Never rewritten. */
  domainPath: string;
  /** Credentials; ignored when `authStrategy` is given. */
  auth?: GcdrAnnotationsAuthConfig;
  /** A ready auth strategy (takes precedence over `auth`). */
  authStrategy?: AuthStrategy;
  /** Optional GET cache (ms). 0/undefined = disabled. */
  cacheTtlMs?: number;
  /** Per-request timeout (ms). Default 15000. */
  timeoutMs?: number;
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
