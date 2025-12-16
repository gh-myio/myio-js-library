/**
 * RFC-0104: Device Annotations System
 * Public exports for the annotations module
 */

export { AnnotationsTab } from './AnnotationsTab';
export type {
  Annotation,
  AnnotationType,
  ImportanceLevel,
  AnnotationStatus,
  AuditAction,
  UserInfo,
  AuditEntry,
  LogAnnotationsAttribute,
  AnnotationFilterState,
  PaginationState,
  PermissionSet,
  NewAnnotationData,
  AnnotationsTabConfig,
  AnnotationFormConfig,
  AnnotationGridConfig,
  AnnotationDetailModalConfig,
  AnnotationIndicatorConfig,
} from './types';

export {
  ANNOTATION_TYPE_LABELS,
  ANNOTATION_TYPE_LABELS_EN,
  IMPORTANCE_LABELS,
  IMPORTANCE_LABELS_EN,
  STATUS_LABELS,
  STATUS_LABELS_EN,
  ANNOTATION_TYPE_COLORS,
  IMPORTANCE_COLORS,
  STATUS_COLORS,
} from './types';
