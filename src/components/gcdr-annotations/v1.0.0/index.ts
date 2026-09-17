export { GcdrAnnotationsClient, createGcdrAnnotationsClient } from './GcdrAnnotationsClient';
export { adaptGcdrToLegacyAnnotation, adaptGcdrListToLegacyAnnotations, adaptLegacyToGcdrInput } from './adapters';
export { createAuthStrategy, ApiKeyAuth, BearerAuth, type AuthStrategy } from './authStrategies';
export {
  GcdrAnnotationsError,
  GcdrAnnotationsConflictError,
  type GcdrAnnotation,
  type GcdrAnnotationDetail,
  type GcdrAnnotationListPage,
  type GcdrAnnotationListParams,
  type GcdrAnnotationResponse,
  type GcdrAnnotationEvent,
  type GcdrAnnotationAttachment,
  type GcdrAnnotationType,
  type GcdrAnnotationImportance,
  type GcdrFinalizedReason,
  type GcdrResponseType,
  type GcdrEntityType,
  type GcdrUserSnapshot,
  type GcdrCreateAnnotationInput,
  type GcdrPatchAnnotationInput,
  type GcdrRespondInput,
  type GcdrAnnotationsAuthConfig,
  type GcdrAnnotationsClientLogger,
  type GcdrAnnotationsClientParams,
} from './types';
