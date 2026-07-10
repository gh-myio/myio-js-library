/**
 * RFC-0218 — GcdrAnnotationsClient types.
 *
 * Shapes mirror the GCDR OpenAPI `Annotations` tag (RFC-0036) verbatim —
 * see gcdr.git/docs/openapi.yaml, schemas `Annotation`, `AnnotationDetail`,
 * `AnnotationResponse`, `AnnotationEvent`, `AnnotationMention`,
 * `AnnotationAttachment`, `CreateAnnotationRequest`, `UpdateAnnotationRequest`.
 */

import type { Annotation as LegacyAnnotation } from '../../premium-modals/settings/annotations/types';

// ============================================================================
// Enums (verbatim from the GCDR schema)
// ============================================================================

export type GcdrEntityType = 'device' | 'work_order' | 'work_order_event';
export type GcdrAnnotationType = 'observation' | 'pending' | 'maintenance' | 'activity';
export type GcdrAnnotationStatus = 'created' | 'modified' | 'archived';
export type GcdrFinalizedReason = 'approved' | 'rejected' | 'archived';
export type GcdrResponseType = 'approved' | 'rejected' | 'comment' | 'archived';
export type GcdrEventAction =
  | 'created'
  | 'modified'
  | 'archived'
  | 'approved'
  | 'rejected'
  | 'commented'
  | 'acknowledged';
export type GcdrMentionType = 'user' | 'device';

// ============================================================================
// Core resource shapes
// ============================================================================

export interface GcdrActorSnapshot {
  id: string | null;
  email: string | null;
  name: string | null;
}

export interface GcdrAnnotation {
  id: string;
  tenantId: string;
  customerId: string;
  entityType: GcdrEntityType;
  entityId: string;
  text: string;
  type: GcdrAnnotationType;
  importance: 1 | 2 | 3 | 4 | 5;
  status: GcdrAnnotationStatus;
  finalized: boolean;
  finalizedReason: GcdrFinalizedReason | null;
  dueDate: string | null;
  createdBy: GcdrActorSnapshot;
  updatedBy: GcdrActorSnapshot | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface GcdrAnnotationResponse {
  id: string;
  annotationId: string;
  type: GcdrResponseType;
  text: string | null;
  createdBy: GcdrActorSnapshot;
  createdAt: string;
}

export interface GcdrAnnotationEvent {
  id: string;
  annotationId: string;
  responseId: string | null;
  action: GcdrEventAction;
  previousVersion: number | null;
  changes: Record<string, unknown> | null;
  actor: GcdrActorSnapshot;
  createdAt: string;
}

export interface GcdrAnnotationMention {
  id: string;
  annotationId: string;
  responseId: string | null;
  mentionType: GcdrMentionType;
  mentionedUserId: string | null;
  mentionedDeviceId: string | null;
  actor: GcdrActorSnapshot;
  createdAt: string;
}

export interface GcdrAnnotationAttachment {
  id: string;
  annotationId: string;
  responseId: string | null;
  fileAssetId: string;
  createdBy: GcdrActorSnapshot;
  createdAt: string;
}

export interface GcdrAnnotationDetail extends GcdrAnnotation {
  responses: GcdrAnnotationResponse[];
  events: GcdrAnnotationEvent[];
  mentions: GcdrAnnotationMention[];
  attachments: GcdrAnnotationAttachment[];
}

// ============================================================================
// Request inputs
// ============================================================================

export interface CreateMentionInput {
  mentionType: GcdrMentionType;
  mentionedUserId?: string | null;
  mentionedDeviceId?: string | null;
  responseId?: string | null;
}

export interface CreateAnnotationInput {
  entityType: GcdrEntityType;
  entityId: string;
  customerId: string;
  text: string;
  type?: GcdrAnnotationType;
  importance?: 1 | 2 | 3 | 4 | 5;
  dueDate?: string | null;
  mentions?: CreateMentionInput[];
}

export interface PatchAnnotationInput {
  text?: string;
  type?: GcdrAnnotationType;
  importance?: 1 | 2 | 3 | 4 | 5;
  dueDate?: string | null;
  /** Expected version for optimistic lock — sent as `If-Match` header, not body. */
  version?: number;
}

export interface CreateResponseInput {
  type: GcdrResponseType;
  /** Required for every type except `approved` (mirrored by local validation). */
  text?: string;
  version?: number;
}

export interface CreateAttachmentInput {
  fileAssetId: string;
  responseId?: string | null;
}

// ============================================================================
// List / pagination
// ============================================================================

export interface ListAnnotationsParams {
  entityType?: GcdrEntityType;
  entityId?: string;
  customerId?: string;
  type?: GcdrAnnotationType;
  status?: GcdrAnnotationStatus;
  importance?: 1 | 2 | 3 | 4 | 5;
  mentionedUserId?: string;
  mentionedDeviceId?: string;
  hasAttachments?: boolean;
  includeArchived?: boolean;
  /** Items per page. API default 20, max 100. */
  limit?: number;
  /** Opaque cursor from a previous page's `pagination.nextCursor`. */
  cursor?: string;
}

/** GCDR RFC-0036 `/annotations` pagination envelope — cursor-based, NOT page/limit. */
export interface GcdrPagination {
  total: number | null;
  totalPages: number | null;
  hasMore: boolean;
  nextCursor: string | null;
}

// ============================================================================
// Auth
// ============================================================================

export type BearerTokenProvider = string | (() => Promise<string> | string);

export interface GcdrAnnotationsAuth {
  /** JWT for user-context calls. String or async provider (token-cache friendly). */
  bearerToken?: BearerTokenProvider;
  /** Customer API Key (gcdr_cust_…) for M2M; hierarchyAccess scoping applies. */
  apiKey?: string;
}

export interface GcdrAnnotationsClientParams {
  /** Base URL WITH version, e.g. "https://gcdr-api.a.myio-bas.com/api/v1". Never rewritten. */
  domainPath: string;
  /**
   * GCDR tenant UUID sent as the required `x-tenant-id` header on every
   * request (openapi.yaml `#/components/parameters/TenantId`) — not part of
   * the RFC-0218 guide-level snippet, but a hard API requirement.
   */
  tenantId: string;
  auth: GcdrAnnotationsAuth;
  /** Optional GET cache (ms). 0/undefined = disabled. */
  cacheTtlMs?: number;
  /** Injectable for tests; default globalThis.fetch. */
  fetchImpl?: typeof fetch;
  logger?: { log: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
  /** Max retry attempts on 429/5xx/network errors. Default 3. */
  maxRetries?: number;
  /** Hard cap on pagination loop iterations for listByCustomer/listByEntity. Default 50. */
  maxPages?: number;
}

// ============================================================================
// Errors
// ============================================================================

export class GcdrAnnotationsError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'GcdrAnnotationsError';
    this.status = status;
    this.code = code;
  }
}

/** 409 responses — caller must re-read, never blind-retry (API guide §5). */
export class ConflictError extends GcdrAnnotationsError {
  readonly finalizedOrStale = true as const;

  constructor(message: string, code = 'CONFLICT') {
    super(409, code, message);
    this.name = 'ConflictError';
  }
}

/** Thrown by `respond()` before any network call — mirrors the API's own rule. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Re-export the legacy shape so callers don't need a second import for the
// adapter's return type.
export type { LegacyAnnotation };
