/**
 * RFC-0104: Device Annotations System
 * Type definitions for the annotations feature
 */

// ============================================
// ANNOTATION TYPES
// ============================================

export type AnnotationType = 'observation' | 'pending' | 'maintenance' | 'activity';
export type ImportanceLevel = 1 | 2 | 3 | 4 | 5;
export type AnnotationStatus = 'created' | 'modified' | 'archived';
export type AuditAction = 'created' | 'modified' | 'archived' | 'approved' | 'rejected' | 'commented' | 'acknowledged';
export type ResponseType = 'approved' | 'rejected' | 'comment' | 'archived';

// ============================================
// USER INFO
// ============================================

export interface UserInfo {
  id: string;
  email: string;
  name: string;
}

// ============================================
// AUDIT ENTRY
// ============================================

export interface AuditEntry {
  timestamp: string; // ISO 8601
  userId: string;
  userName: string;
  userEmail: string;
  action: AuditAction;
  previousVersion?: number;
  changes?: Record<string, { from: unknown; to: unknown }>;
}

// ============================================
// ANNOTATION RESPONSE (Approve/Reject)
// ============================================

export interface AnnotationResponse {
  id: string; // UUID v4
  annotationId: string; // Parent annotation ID
  type: ResponseType; // 'approved' | 'rejected'
  text: string; // Max 255 characters (optional for approved, required for rejected)
  createdAt: string; // ISO 8601 timestamp
  createdBy: UserInfo;
}

// ============================================
// ANNOTATION
// ============================================

export interface Annotation {
  id: string; // UUID v4
  version: number; // Increments on each change

  // Content
  text: string; // Max 255 characters
  type: AnnotationType;
  importance: ImportanceLevel;
  status: AnnotationStatus;

  // Dates
  createdAt: string; // ISO 8601 timestamp
  dueDate?: string; // Optional ISO 8601 date

  // User Attribution
  createdBy: UserInfo;

  // Acknowledgment (legacy - use responses instead)
  acknowledged: boolean;
  acknowledgedBy?: UserInfo;
  acknowledgedAt?: string;

  // Responses (approve/reject with text)
  responses: AnnotationResponse[];

  // Audit Trail
  history: AuditEntry[];
}

// ============================================
// STORAGE STRUCTURE
// ============================================

export interface LogAnnotationsAttribute {
  schemaVersion: string; // "1.0.0"
  deviceId: string; // ThingsBoard device ID
  lastModified: string; // ISO 8601
  lastModifiedBy: UserInfo;
  annotations: Annotation[];
}

// ============================================
// FILTER STATE
// ============================================

export interface AnnotationFilterState {
  dateRange?: {
    start: string;
    end: string;
  };
  // Legacy single-select (deprecated)
  status?: AnnotationStatus | 'all';
  type?: AnnotationType | 'all';
  importance?: ImportanceLevel | 'all';
  // Multiselect lists
  statusList?: AnnotationStatus[];
  typeList?: AnnotationType[];
  importanceList?: ImportanceLevel[];
  // Other filters
  userId?: string | 'all';
  searchText?: string;
  showOverdueOnly?: boolean;
}

// ============================================
// PAGINATION STATE
// ============================================

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// ============================================
// PERMISSION SET
// ============================================

export interface PermissionSet {
  isSuperAdminMyio: boolean;
  isSuperAdminHolding: boolean;
  currentUser: UserInfo;
}

// ============================================
// NEW ANNOTATION DATA
// ============================================

export interface NewAnnotationData {
  text: string;
  type: AnnotationType;
  importance: ImportanceLevel;
  dueDate?: string;
}

// ============================================
// COMPONENT CONFIGS
// ============================================

export interface AnnotationsTabConfig {
  container: HTMLElement;
  deviceId: string;
  jwtToken: string;
  tbBaseUrl?: string;
  currentUser: UserInfo;
  permissions: PermissionSet;
  onAnnotationChange?: (annotations: Annotation[]) => void;
  i18n?: {
    t: (key: string, fallback?: string) => string;
  };
  /** RFC-0144: If false, onboarding tour is never shown. Default: false */
  enableAnnotationsOnboarding?: boolean;
}

export interface AnnotationFormConfig {
  container: HTMLElement;
  onSubmit: (data: NewAnnotationData) => Promise<void>;
  i18n?: {
    t: (key: string, fallback?: string) => string;
  };
}

export interface AnnotationGridConfig {
  container: HTMLElement;
  annotations: Annotation[];
  permissions: PermissionSet;
  filters: AnnotationFilterState;
  pagination: PaginationState;
  onEdit: (id: string) => void;
  onArchive: (id: string) => void;
  onAcknowledge: (id: string) => void;
  onFilterChange: (filters: AnnotationFilterState) => void;
  onPageChange: (page: number) => void;
  i18n?: {
    t: (key: string, fallback?: string) => string;
  };
}

export interface AnnotationDetailModalConfig {
  annotation: Annotation;
  permissions: PermissionSet;
  onSave: (id: string, changes: Partial<Annotation>) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onClose: () => void;
  i18n?: {
    t: (key: string, fallback?: string) => string;
  };
}

// ============================================
// CARD INDICATOR CONFIG
// ============================================

export interface AnnotationIndicatorConfig {
  container: HTMLElement;
  annotations: Annotation[];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onClick?: () => void;
}

// ============================================
// I18N LABELS
// ============================================

export const ANNOTATION_TYPE_LABELS: Record<AnnotationType, string> = {
  observation: 'Observação',
  pending: 'Pendência',
  maintenance: 'Manutenção',
  activity: 'Atividade',
};

export const ANNOTATION_TYPE_LABELS_EN: Record<AnnotationType, string> = {
  observation: 'Observation',
  pending: 'Pending',
  maintenance: 'Maintenance',
  activity: 'Activity',
};

export const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  1: 'Muito Baixa',
  2: 'Baixa',
  3: 'Normal',
  4: 'Alta',
  5: 'Muito Alta',
};

export const IMPORTANCE_LABELS_EN: Record<ImportanceLevel, string> = {
  1: 'Very Low',
  2: 'Low',
  3: 'Normal',
  4: 'High',
  5: 'Very High',
};

export const STATUS_LABELS: Record<AnnotationStatus, string> = {
  created: 'Criado',
  modified: 'Modificado',
  archived: 'Arquivado',
};

export const STATUS_LABELS_EN: Record<AnnotationStatus, string> = {
  created: 'Created',
  modified: 'Modified',
  archived: 'Archived',
};

// ============================================
// COLORS
// ============================================

export const ANNOTATION_TYPE_COLORS: Record<AnnotationType, string> = {
  observation: '#2196F3', // Blue
  pending: '#F44336', // Red
  maintenance: '#FF9800', // Yellow/Orange
  activity: '#4CAF50', // Green
};

export const IMPORTANCE_COLORS: Record<ImportanceLevel, string> = {
  1: '#9E9E9E', // Gray
  2: '#64B5F6', // Light Blue
  3: '#2196F3', // Blue
  4: '#FF9800', // Orange
  5: '#F44336', // Red
};

export const STATUS_COLORS: Record<AnnotationStatus, string> = {
  created: '#4CAF50', // Green
  modified: '#FF9800', // Orange
  archived: '#9E9E9E', // Gray
};

// ============================================
// RESPONSE TYPE LABELS & COLORS
// ============================================

export const RESPONSE_TYPE_LABELS: Record<ResponseType, string> = {
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  comment: 'Comentário',
  archived: 'Arquivado',
};

export const RESPONSE_TYPE_LABELS_EN: Record<ResponseType, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  comment: 'Comment',
  archived: 'Archived',
};

export const RESPONSE_TYPE_COLORS: Record<ResponseType, string> = {
  approved: '#10B981', // Green
  rejected: '#EF4444', // Red
  comment: '#0284C7', // Blue
  archived: '#6B7280', // Gray
};

export const RESPONSE_TYPE_ICONS: Record<ResponseType, string> = {
  approved: '✓',
  rejected: '✗',
  comment: '💬',
  archived: '⬇️',
};
