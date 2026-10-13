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
 * Type mapping: the legacy RFC-0104 set and GCDR's are the same four values
 * (pre-RFC-0104 `issue`/`alert` are normalized by the GCDR backfill).
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
  return { id: u?.id ?? '', email: u?.email ?? '', name: u?.name ?? u?.email ?? '' };
}

/**
 * GCDR's native `status` is the legacy one (created/modified/archived). Older
 * payloads without it fall back to finalized + version: only
 * `finalizedReason: 'archived'` means archived — an approved/rejected
 * annotation stays visible with its decision as a response.
 */
function deriveLegacyStatus(a: GcdrAnnotation): AnnotationStatus {
  if (a.status === 'created' || a.status === 'modified' || a.status === 'archived') return a.status;
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
  const entry: AuditEntry = {
    timestamp: e.createdAt,
    userId: e.actor?.id ?? '',
    userName: e.actor?.name ?? e.actor?.email ?? '',
    userEmail: e.actor?.email ?? '',
    action,
  };
  if (typeof e.previousVersion === 'number') entry.previousVersion = e.previousVersion;
  if (e.changes) entry.changes = e.changes;
  return entry;
}

/**
 * Legacy date inputs are `YYYY-MM-DD` (São Paulo day); GCDR wants an ISO
 * datetime with offset. Anything unparseable is dropped rather than sent.
 */
export function toGcdrDueDate(dueDate: string | undefined | null): string | undefined {
  if (!dueDate) return undefined;
  const value = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? `${dueDate}T00:00:00-03:00` : dueDate;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
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
  const decision = [...responses].reverse().find((r) => r.type === 'approved' || r.type === 'rejected');
  // Native acknowledge fields win (migrated data); otherwise a decision response acknowledges.
  const acknowledged = g.acknowledged === true || !!decision;

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
    acknowledged,
    acknowledgedBy: g.acknowledgedBy ? toUserInfo(g.acknowledgedBy) : decision?.createdBy,
    acknowledgedAt: g.acknowledgedAt ?? decision?.createdAt,
    finalized: g.finalized === true,
    finalizedReason: g.finalizedReason,
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
    dueDate: toGcdrDueDate(data.dueDate),
  };
}
