/**
 * RFC-0218 §Adapter — GCDR ⇄ legacy RFC-0104 `Annotation` shape
 * (`src/components/premium-modals/settings/annotations/types.ts`). Nothing
 * above the client (AnnotationsTab, orchestrator indices, card badges) needs
 * to change shape during the migration — they keep consuming `Annotation`.
 */
import type {
  Annotation,
  AnnotationResponse,
  AnnotationStatus,
  AnnotationType,
  AuditAction,
  AuditEntry,
  ResponseType,
  UserInfo,
} from '../../premium-modals/settings/annotations/types';
import type {
  GcdrAnnotation,
  GcdrAnnotationDetail,
  GcdrAnnotationEvent,
  GcdrAnnotationResponse,
  GcdrAnnotationType,
  GcdrCreateAnnotationInput,
  GcdrUserSnapshot,
} from './types';

/**
 * Type mapping (RFC-0218 Unresolved Q1 — proposed, not yet confirmed with the
 * GCDR team): legacy has `issue`/`alert`, GCDR has `pending`/`activity`.
 * `observation`/`maintenance` are shared verbatim.
 */
const GCDR_TO_LEGACY_TYPE: Record<GcdrAnnotationType, AnnotationType> = {
  observation: 'observation',
  pending: 'pending',
  maintenance: 'maintenance',
  activity: 'activity',
};

const LEGACY_TO_GCDR_TYPE: Record<AnnotationType, GcdrAnnotationType> = {
  observation: 'observation',
  pending: 'pending',
  maintenance: 'maintenance',
  activity: 'activity',
};

const KNOWN_AUDIT_ACTIONS: ReadonlySet<string> = new Set<AuditAction>([
  'created',
  'modified',
  'archived',
  'approved',
  'rejected',
  'commented',
  'acknowledged',
]);

function toUserInfo(u: GcdrUserSnapshot | undefined): UserInfo {
  return { id: u?.id ?? '', email: u?.email ?? '', name: u?.name ?? '' };
}

/**
 * `finalized`/`finalizedReason` collapse to the legacy top-level `status`.
 * Only `finalizedReason: 'archived'` maps to `status: 'archived'` — approved/
 * rejected annotations stay visible with a response entry, they don't get
 * archived by that alone (mirrors `AnnotationsTab`'s own rule: only an
 * explicit archive response flips `status`, see its `openResponseModal`/
 * `newStatus` logic).
 */
function deriveLegacyStatus(a: GcdrAnnotation): AnnotationStatus {
  if (a.finalized && a.finalizedReason === 'archived') return 'archived';
  return a.version > 1 ? 'modified' : 'created';
}

function adaptResponse(r: GcdrAnnotationResponse, annotationId: string): AnnotationResponse {
  return {
    id: r.id,
    annotationId,
    type: r.type as ResponseType,
    text: r.text ?? '',
    createdAt: r.createdAt,
    createdBy: toUserInfo(r.createdBy),
  };
}

function adaptEvent(e: GcdrAnnotationEvent): AuditEntry {
  const action = KNOWN_AUDIT_ACTIONS.has(e.action) ? (e.action as AuditAction) : 'modified';
  return {
    timestamp: e.at,
    userId: e.by?.id ?? '',
    userName: e.by?.name ?? '',
    userEmail: e.by?.email ?? '',
    action,
  };
}

/**
 * Adapts one GCDR annotation (list or detail shape) to the legacy `Annotation`
 * shape every widget already consumes. `responses`/`events` are only present
 * on the detail shape (`getById`) — a list-shape item adapts with empty
 * arrays, matching the "fetched lazily via getById" note in RFC-0218.
 */
export function adaptGcdrToLegacyAnnotation(g: GcdrAnnotation | GcdrAnnotationDetail): Annotation {
  const detail = g as Partial<GcdrAnnotationDetail>;
  const responses = (detail.responses ?? []).map((r) => adaptResponse(r, g.id));
  const history = (detail.events ?? []).map(adaptEvent);
  const approvedOrRejected = responses.find((r) => r.type === 'approved' || r.type === 'rejected');

  return {
    id: g.id,
    version: g.version,
    text: g.text,
    type: GCDR_TO_LEGACY_TYPE[g.type] ?? 'observation',
    importance: g.importance,
    status: deriveLegacyStatus(g),
    createdAt: g.createdAt,
    dueDate: g.dueDate ?? undefined,
    createdBy: toUserInfo(g.createdBy),
    acknowledged: !!approvedOrRejected,
    acknowledgedBy: approvedOrRejected?.createdBy,
    acknowledgedAt: approvedOrRejected?.createdAt,
    responses,
    history,
  };
}

export function adaptGcdrListToLegacyAnnotations(list: GcdrAnnotation[]): Annotation[] {
  return list.map(adaptGcdrToLegacyAnnotation);
}

/**
 * Builds a `create()` input from the legacy `NewAnnotationData` shape plus the
 * entity/customer context the legacy form doesn't carry (it was always
 * implicit in the TB device SERVER_SCOPE attribute path).
 */
export function adaptLegacyToGcdrInput(
  data: { text: string; type: AnnotationType; importance: number; dueDate?: string },
  entity: { entityType: string; entityId: string; customerId: string }
): GcdrCreateAnnotationInput {
  return {
    entityType: entity.entityType,
    entityId: entity.entityId,
    customerId: entity.customerId,
    text: data.text,
    type: LEGACY_TO_GCDR_TYPE[data.type] ?? 'observation',
    importance: data.importance as GcdrCreateAnnotationInput['importance'],
    dueDate: data.dueDate,
  };
}
