/**
 * RFC-0104: Device Annotations System
 * Public exports for the annotations module
 */

export { AnnotationsTab } from './AnnotationsTab';
export type {
  Annotation,
  AnnotationType,
  UserAnnotationType,
  AnnotationMeta,
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
  ANNOTATION_TYPE_ICONS,
  USER_ANNOTATION_TYPES,
  isSystemAnnotation,
  IMPORTANCE_COLORS,
  STATUS_COLORS,
} from './types';
