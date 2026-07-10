/** RFC-0218 — GcdrAnnotationsClient public barrel. */

export { GcdrAnnotationsClient, createGcdrAnnotationsClient } from './GcdrAnnotationsClient';
export { adaptGcdrToLegacyAnnotation, adaptLegacyToGcdrInput } from './adapters';
export { ApiKeyAuth, BearerAuth, buildAuthStrategy } from './authStrategies';
export type { AuthStrategy } from './authStrategies';

export {
  GcdrAnnotationsError,
  ConflictError,
  ValidationError,
} from './types';

export type {
  GcdrEntityType,
  GcdrAnnotationType,
  GcdrAnnotationStatus,
  GcdrFinalizedReason,
  GcdrResponseType,
  GcdrEventAction,
  GcdrMentionType,
  GcdrActorSnapshot,
  GcdrAnnotation,
  GcdrAnnotationResponse,
  GcdrAnnotationEvent,
  GcdrAnnotationMention,
  GcdrAnnotationAttachment,
  GcdrAnnotationDetail,
  CreateMentionInput,
  CreateAnnotationInput,
  PatchAnnotationInput,
  CreateResponseInput,
  CreateAttachmentInput,
  ListAnnotationsParams,
  GcdrPagination,
  BearerTokenProvider,
  GcdrAnnotationsAuth,
  GcdrAnnotationsClientParams,
} from './types';
