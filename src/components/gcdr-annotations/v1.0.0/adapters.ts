/**
 * RFC-0218 — Adapter pattern: GCDR ⇄ legacy RFC-0104 `Annotation`.
 *
 * Correction over the RFC-0218 draft's "Unresolved Q1": the legacy
 * `AnnotationType` (`src/components/premium-modals/settings/annotations/types.ts`)
 * is already `'observation' | 'pending' | 'maintenance' | 'activity'` —
 * IDENTICAL to the GCDR schema's `type` enum. There is no `issue`/`alert`
 * mapping in the real codebase (the RFC's proposed `pending→issue`,
 * `activity→alert` table does not match the shipped type and would corrupt
 * every downstream filter/badge that switches on `type`). Same for
 * `status` (`created|modified|archived` on both sides) and `ResponseType`
 * (`approved|rejected|comment|archived` on both sides) — all three enums
 * pass through unchanged.
 */

import type {
  Annotation as LegacyAnnotation,
  AnnotationResponse as LegacyAnnotationResponse,
  AuditEntry as LegacyAuditEntry,
  UserInfo as LegacyUserInfo,
} from '../../premium-modals/settings/annotations/types';
import type {
  CreateAnnotationInput,
  CreateMentionInput,
  GcdrActorSnapshot,
  GcdrAnnotation,
  GcdrAnnotationDetail,
  GcdrAnnotationEvent,
  GcdrAnnotationResponse,
  GcdrAnnotationType,
} from './types';

function isDetail(a: GcdrAnnotation | GcdrAnnotationDetail): a is GcdrAnnotationDetail {
  return Array.isArray((a as GcdrAnnotationDetail).responses);
}

function actorToUserInfo(actor: GcdrActorSnapshot | null | undefined): LegacyUserInfo {
  return {
    id: actor?.id ?? '',
    email: actor?.email ?? '',
    name: actor?.name ?? '',
  };
}

function adaptResponse(r: GcdrAnnotationResponse): LegacyAnnotationResponse {
  return {
    id: r.id,
    annotationId: r.annotationId,
    type: r.type,
    text: r.text ?? '',
    createdAt: r.createdAt,
    createdBy: actorToUserInfo(r.createdBy),
  };
}

function adaptEvent(e: GcdrAnnotationEvent): LegacyAuditEntry {
  const entry: LegacyAuditEntry = {
    timestamp: e.createdAt,
    userId: e.actor?.id ?? '',
    userName: e.actor?.name ?? '',
    userEmail: e.actor?.email ?? '',
    action: e.action,
  };
  if (e.previousVersion !== null && e.previousVersion !== undefined) {
    entry.previousVersion = e.previousVersion;
  }
  if (e.changes && typeof e.changes === 'object') {
    // Tolerant per RFC-0218: unknown/mismatched shapes are passed through
    // as best-effort; consumers that don't recognize a key just ignore it.
    entry.changes = e.changes as Record<string, { from: unknown; to: unknown }>;
  }
  return entry;
}

/**
 * Maps one GCDR annotation (list or detail shape) to the RFC-0104 `Annotation`
 * shape every existing widget surface (AnnotationsTab, AnnotationIndicator,
 * HeaderAnnotationsPanel) already consumes. `responses`/`history` are only
 * populated when a `GcdrAnnotationDetail` (from `getById`) is passed in —
 * list-shaped input yields empty arrays for both, matching the "fetched
 * lazily via getById" note in RFC-0218.
 */
export function adaptGcdrToLegacyAnnotation(
  gcdr: GcdrAnnotation | GcdrAnnotationDetail
): LegacyAnnotation {
  const detail = isDetail(gcdr) ? gcdr : null;

  const annotation: LegacyAnnotation = {
    id: gcdr.id,
    version: gcdr.version,
    text: gcdr.text,
    type: gcdr.type,
    importance: gcdr.importance,
    status: gcdr.status,
    createdAt: gcdr.createdAt,
    createdBy: actorToUserInfo(gcdr.createdBy),
    // Deprecated in RFC-0104 ("legacy - use responses instead"); GCDR has no
    // equivalent field, so this is always false on adapted objects.
    acknowledged: false,
    responses: detail ? detail.responses.map(adaptResponse) : [],
    history: detail ? detail.events.map(adaptEvent) : [],
  };
  if (gcdr.dueDate) annotation.dueDate = gcdr.dueDate;

  return annotation;
}

/**
 * Builds a `CreateAnnotationRequest`-shaped input from the fields the
 * SettingsModal's "new annotation" form already collects (RFC-0104
 * `NewAnnotationData`), plus the polymorphic-target context the form itself
 * doesn't know about.
 */
export function adaptLegacyToGcdrInput(
  draft: { text: string; type: GcdrAnnotationType; importance: 1 | 2 | 3 | 4 | 5; dueDate?: string },
  context: { entityType: CreateAnnotationInput['entityType']; entityId: string; customerId: string },
  mentions?: CreateMentionInput[]
): CreateAnnotationInput {
  const input: CreateAnnotationInput = {
    entityType: context.entityType,
    entityId: context.entityId,
    customerId: context.customerId,
    text: draft.text,
    type: draft.type,
    importance: draft.importance,
  };
  if (draft.dueDate) input.dueDate = draft.dueDate;
  if (mentions && mentions.length > 0) input.mentions = mentions;
  return input;
}
