/**
 * RFC-0104: Device Annotations System
 * Main Annotations Tab Component
 */

import type {
  Annotation,
  AnnotationType,
  ImportanceLevel,
  AnnotationStatus,
  LogAnnotationsAttribute,
  AnnotationFilterState,
  PaginationState,
  PermissionSet,
  NewAnnotationData,
  UserInfo,
  AuditEntry,
  AnnotationsTabConfig,
} from './types';

import {
  ANNOTATION_TYPE_LABELS,
  ANNOTATION_TYPE_COLORS,
  IMPORTANCE_LABELS,
  IMPORTANCE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
} from './types';

import { canModifyAnnotation } from '../../../../utils/superAdminUtils';

// ============================================
// UUID GENERATOR
// ============================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================
// CSS STYLES
// ============================================

const ANNOTATIONS_STYLES = `
.annotations-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: #1a1a2e;
  padding: 4px;
}

/* Info Header Banner */
.annotations-header {
  background: linear-gradient(135deg, #e8f4fd 0%, #d4e8f9 100%);
  border: 1px solid #b8d4e8;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.annotations-header__icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.annotations-header__content {
  flex: 1;
}

.annotations-header__title {
  font-size: 14px;
  font-weight: 600;
  color: #1a365d;
  margin-bottom: 4px;
}

.annotations-header__desc {
  font-size: 12px;
  color: #2c5282;
  line-height: 1.4;
}

/* Stats Summary */
.annotations-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e9ecef;
}

.annotations-stats__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #495057;
}

.annotations-stats__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.annotations-stats__dot--pending { background: #d63031; }
.annotations-stats__dot--maintenance { background: #e17055; }
.annotations-stats__dot--activity { background: #00b894; }
.annotations-stats__dot--observation { background: #0984e3; }

.annotations-stats__count {
  font-weight: 600;
  color: #212529;
}

/* Form Section */
.annotations-form {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.annotations-form__title {
  font-size: 14px;
  font-weight: 600;
  color: #212529;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.annotations-form__row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.annotations-form__field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 140px;
}

.annotations-form__field--full {
  flex: 100%;
  min-width: 100%;
}

.annotations-form__label {
  font-size: 11px;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.annotations-form__select,
.annotations-form__input,
.annotations-form__textarea {
  padding: 10px 12px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 13px;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
  color: #212529;
}

.annotations-form__select:focus,
.annotations-form__input:focus,
.annotations-form__textarea:focus {
  outline: none;
  border-color: #6c5ce7;
  box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.15);
}

.annotations-form__textarea {
  min-height: 70px;
  resize: vertical;
}

.annotations-form__char-count {
  font-size: 10px;
  color: #adb5bd;
  text-align: right;
  margin-top: 2px;
}

.annotations-form__char-count--warning {
  color: #fd7e14;
}

.annotations-form__char-count--error {
  color: #dc3545;
}

/* Type Selector Buttons */
.type-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.type-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
  font-weight: 500;
  background: #fff;
}

.type-option:hover {
  border-color: #adb5bd;
}

.type-option.selected {
  border-color: currentColor;
  background: currentColor;
}

.type-option.selected .type-option__label {
  color: #fff;
}

.type-option.selected .type-option__dot {
  background: #fff;
}

.type-option--pending { color: #d63031; }
.type-option--maintenance { color: #e17055; }
.type-option--activity { color: #00b894; }
.type-option--observation { color: #0984e3; }

.type-option__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.type-option__label {
  color: inherit;
}

/* Importance Selector */
.importance-selector {
  display: flex;
  gap: 6px;
}

.importance-option {
  width: 34px;
  height: 34px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s;
  background: #fff;
}

.importance-option:hover {
  border-color: #adb5bd;
}

.importance-option.selected {
  color: #fff !important;
}

.importance-option--1 { color: #74b9ff; }
.importance-option--1.selected { background: #74b9ff; border-color: #74b9ff; }
.importance-option--2 { color: #81ecec; }
.importance-option--2.selected { background: #81ecec; border-color: #81ecec; color: #333 !important; }
.importance-option--3 { color: #fdcb6e; }
.importance-option--3.selected { background: #fdcb6e; border-color: #fdcb6e; color: #333 !important; }
.importance-option--4 { color: #fab1a0; }
.importance-option--4.selected { background: #fab1a0; border-color: #fab1a0; }
.importance-option--5 { color: #ff7675; }
.importance-option--5.selected { background: #ff7675; border-color: #ff7675; }

/* Form Actions */
.annotations-form__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid #e9ecef;
  margin-top: 4px;
}

.annotations-form__btn {
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.annotations-form__btn--secondary {
  background: #e9ecef;
  color: #495057;
}

.annotations-form__btn--secondary:hover {
  background: #dee2e6;
}

.annotations-form__btn--primary {
  background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
  color: #fff;
}

.annotations-form__btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(108, 92, 231, 0.4);
}

.annotations-form__btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.annotations-form__submit {
  background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  align-self: flex-end;
}

.annotations-form__submit:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(108, 92, 231, 0.4);
}

.annotations-form__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Filters Section */
.annotations-filters {
  background: #fff;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.annotations-filters__title {
  font-size: 12px;
  font-weight: 600;
  color: #6c757d;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.annotations-filters__row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.annotations-filters__field {
  flex: 1;
  min-width: 120px;
}

.annotations-filters__select,
.annotations-filters__input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  font-size: 12px;
  background: #f8f9fa;
}

.annotations-filters__search {
  flex: 2;
}

/* Grid Section */
.annotations-grid {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.annotations-grid__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 10px;
  margin-bottom: 12px;
}

.annotations-grid__title {
  font-size: 14px;
  font-weight: 600;
  color: #212529;
  display: flex;
  align-items: center;
  gap: 8px;
}

.annotations-grid__count {
  font-size: 12px;
  color: #6c757d;
  background: #fff;
  padding: 4px 10px;
  border-radius: 12px;
}

.annotations-grid__list {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  align-content: start;
}

/* Card Layout */
.annotation-card {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 14px;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}

.annotation-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.annotation-card--archived {
  opacity: 0.6;
  background: #f8f9fa;
}

.annotation-card--overdue {
  border-color: #d63031;
  background: linear-gradient(135deg, #fff 0%, #fff5f5 100%);
}

.annotation-card__header {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.annotation-card__type,
.annotation-card__importance,
.annotation-card__ack,
.annotation-card__overdue-badge {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.annotation-card__importance {
  color: #333;
}

.annotation-card__ack {
  background: #d4edda;
  color: #155724;
}

.annotation-card__overdue-badge {
  background: #f8d7da;
  color: #721c24;
}

.annotation-card__text {
  font-size: 13px;
  line-height: 1.5;
  color: #212529;
  margin-bottom: 10px;
  flex: 1;
}

.annotation-card__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #6c757d;
  margin-bottom: 8px;
}

.annotation-card__author {
  display: flex;
  align-items: center;
  gap: 6px;
}

.annotation-card__avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #6c5ce7;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
}

.annotation-card__due {
  font-size: 11px;
  color: #6c757d;
  padding: 6px 10px;
  background: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 10px;
}

.annotation-card__due--overdue {
  background: #fee2e2;
  color: #991b1b;
  font-weight: 600;
}

.annotation-card__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-top: 10px;
  border-top: 1px solid #e9ecef;
}

.annotation-card__btn {
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  background: #f1f3f5;
  color: #495057;
}

.annotation-card__btn:hover {
  background: #e9ecef;
}

.annotation-card__btn--edit:hover {
  background: #e8f4fd;
  color: #0984e3;
}

.annotation-card__btn--archive:hover {
  background: #fff3cd;
  color: #856404;
}

.annotation-card__btn--ack:hover {
  background: #d4edda;
  color: #155724;
}

.annotation-card__btn--history:hover {
  background: #e2e3e5;
  color: #383d41;
}

/* Legacy row support */
.annotation-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #fff;
  border-radius: 10px;
  margin-bottom: 8px;
  border: 1px solid #e9ecef;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.annotation-row:hover {
  border-color: #6c5ce7;
  box-shadow: 0 2px 8px rgba(108, 92, 231, 0.1);
}

.annotation-row--archived {
  opacity: 0.6;
  background: #f8f9fa;
}

.annotation-row__checkbox {
  margin-top: 2px;
}

.annotation-row__checkbox input {
  width: 16px;
  height: 16px;
  accent-color: #6c5ce7;
}

.annotation-row__content {
  flex: 1;
  min-width: 0;
}

.annotation-row__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.annotation-row__date {
  font-size: 11px;
  color: #6c757d;
}

.annotation-row__user {
  font-size: 11px;
  color: #495057;
  font-weight: 500;
}

.annotation-row__badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.annotation-row__text {
  font-size: 13px;
  color: #212529;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.annotation-row__actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.annotation-row__btn {
  background: transparent;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.annotation-row__btn:hover {
  background: #f8f9fa;
  border-color: #6c5ce7;
  color: #6c5ce7;
}

.annotation-row__btn--danger:hover {
  background: #fff5f5;
  border-color: #dc3545;
  color: #dc3545;
}

/* Pagination */
.annotations-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid #e9ecef;
  margin-top: auto;
}

.annotations-pagination__btn {
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.annotations-pagination__btn:hover:not(:disabled) {
  background: #6c5ce7;
  color: #fff;
  border-color: #6c5ce7;
}

.annotations-pagination__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.annotations-pagination__info {
  font-size: 12px;
  color: #6c757d;
}

/* Empty State */
.annotations-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #6c757d;
}

.annotations-empty__icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.annotations-empty__text {
  font-size: 14px;
  text-align: center;
}

/* Detail Modal */
.annotation-detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.annotation-detail-modal {
  background: #fff;
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.annotation-detail__header {
  padding: 16px 20px;
  background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.annotation-detail__title {
  font-size: 16px;
  font-weight: 600;
}

.annotation-detail__close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
}

.annotation-detail__content {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.annotation-detail__field {
  margin-bottom: 16px;
}

.annotation-detail__label {
  font-size: 11px;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.annotation-detail__value {
  font-size: 14px;
  color: #212529;
}

.annotation-detail__history {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e9ecef;
}

.annotation-detail__history-title {
  font-size: 12px;
  font-weight: 600;
  color: #6c757d;
  margin-bottom: 12px;
}

.annotation-detail__history-item {
  font-size: 11px;
  color: #6c757d;
  padding: 6px 0;
  border-bottom: 1px solid #f1f3f4;
}

.annotation-detail__footer {
  padding: 16px 20px;
  background: #f8f9fa;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.annotation-detail__btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.annotation-detail__btn--primary {
  background: #6c5ce7;
  color: #fff;
  border: none;
}

.annotation-detail__btn--primary:hover {
  background: #5b4cdb;
}

.annotation-detail__btn--secondary {
  background: #fff;
  color: #495057;
  border: 1px solid #dee2e6;
}

.annotation-detail__btn--danger {
  background: #dc3545;
  color: #fff;
  border: none;
}

.annotation-detail__btn--danger:hover {
  background: #c82333;
}
`;

// ============================================
// ANNOTATIONS TAB CLASS
// ============================================

export class AnnotationsTab {
  private container: HTMLElement;
  private deviceId: string;
  private jwtToken: string;
  private currentUser: UserInfo;
  private permissions: PermissionSet;
  private annotations: Annotation[] = [];
  private filters: AnnotationFilterState = { status: 'all', type: 'all', importance: 'all' };
  private pagination: PaginationState = { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0 };
  private onAnnotationChange?: (annotations: Annotation[]) => void;
  private styleElement: HTMLStyleElement | null = null;

  constructor(config: AnnotationsTabConfig) {
    this.container = config.container;
    this.deviceId = config.deviceId;
    this.jwtToken = config.jwtToken;
    this.currentUser = config.currentUser;
    this.permissions = config.permissions;
    this.onAnnotationChange = config.onAnnotationChange;
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  public async init(): Promise<void> {
    this.injectStyles();
    await this.loadAnnotations();
    this.render();
  }

  public destroy(): void {
    this.styleElement?.remove();
    this.container.innerHTML = '';
  }

  // ============================================
  // DATA METHODS
  // ============================================

  private async loadAnnotations(): Promise<void> {
    try {
      const response = await fetch(
        `/api/plugins/telemetry/DEVICE/${this.deviceId}/values/attributes/SERVER_SCOPE?keys=log_annotations`,
        {
          headers: {
            'X-Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.warn('[AnnotationsTab] Failed to load annotations:', response.status);
        this.annotations = [];
        return;
      }

      const attributes = await response.json();
      const attr = attributes.find((a: { key: string }) => a.key === 'log_annotations');

      if (!attr?.value) {
        this.annotations = [];
        return;
      }

      const data: LogAnnotationsAttribute =
        typeof attr.value === 'string' ? JSON.parse(attr.value) : attr.value;

      this.annotations = data.annotations || [];
    } catch (error) {
      console.error('[AnnotationsTab] Error loading annotations:', error);
      this.annotations = [];
    }
  }

  private async saveAnnotations(): Promise<boolean> {
    try {
      const data: LogAnnotationsAttribute = {
        schemaVersion: '1.0.0',
        deviceId: this.deviceId,
        lastModified: new Date().toISOString(),
        lastModifiedBy: this.currentUser,
        annotations: this.annotations,
      };

      const response = await fetch(
        `/api/plugins/telemetry/DEVICE/${this.deviceId}/SERVER_SCOPE`,
        {
          method: 'POST',
          headers: {
            'X-Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ log_annotations: data }),
        }
      );

      if (!response.ok) {
        console.error('[AnnotationsTab] Failed to save annotations:', response.status);
        return false;
      }

      this.onAnnotationChange?.(this.annotations);
      return true;
    } catch (error) {
      console.error('[AnnotationsTab] Error saving annotations:', error);
      return false;
    }
  }

  // ============================================
  // ANNOTATION OPERATIONS
  // ============================================

  private async addAnnotation(data: NewAnnotationData): Promise<void> {
    const now = new Date().toISOString();
    const newAnnotation: Annotation = {
      id: generateUUID(),
      version: 1,
      text: data.text,
      type: data.type,
      importance: data.importance,
      status: 'created',
      createdAt: now,
      dueDate: data.dueDate,
      createdBy: this.currentUser,
      acknowledged: false,
      history: [
        {
          timestamp: now,
          userId: this.currentUser.id,
          userName: this.currentUser.name,
          userEmail: this.currentUser.email,
          action: 'created',
        },
      ],
    };

    this.annotations.unshift(newAnnotation);
    const success = await this.saveAnnotations();

    if (success) {
      this.render();
    } else {
      this.annotations.shift();
      alert('Erro ao salvar anotação. Tente novamente.');
    }
  }

  private async editAnnotation(id: string, changes: Partial<Annotation>): Promise<void> {
    const index = this.annotations.findIndex((a) => a.id === id);
    if (index === -1) return;

    const annotation = this.annotations[index];
    const now = new Date().toISOString();

    // Build change record
    const changeRecord: Record<string, { from: unknown; to: unknown }> = {};
    for (const [key, value] of Object.entries(changes)) {
      if ((annotation as Record<string, unknown>)[key] !== value) {
        changeRecord[key] = {
          from: (annotation as Record<string, unknown>)[key],
          to: value,
        };
      }
    }

    const auditEntry: AuditEntry = {
      timestamp: now,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      userEmail: this.currentUser.email,
      action: 'modified',
      previousVersion: annotation.version,
      changes: changeRecord,
    };

    const updatedAnnotation: Annotation = {
      ...annotation,
      ...changes,
      version: annotation.version + 1,
      status: 'modified',
      history: [...annotation.history, auditEntry],
    };

    this.annotations[index] = updatedAnnotation;
    const success = await this.saveAnnotations();

    if (!success) {
      this.annotations[index] = annotation;
      alert('Erro ao atualizar anotação. Tente novamente.');
    }
  }

  private async archiveAnnotation(id: string): Promise<void> {
    const index = this.annotations.findIndex((a) => a.id === id);
    if (index === -1) return;

    const annotation = this.annotations[index];
    const now = new Date().toISOString();

    const auditEntry: AuditEntry = {
      timestamp: now,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      userEmail: this.currentUser.email,
      action: 'archived',
      previousVersion: annotation.version,
    };

    const updatedAnnotation: Annotation = {
      ...annotation,
      version: annotation.version + 1,
      status: 'archived',
      history: [...annotation.history, auditEntry],
    };

    this.annotations[index] = updatedAnnotation;
    const success = await this.saveAnnotations();

    if (success) {
      this.render();
    } else {
      this.annotations[index] = annotation;
      alert('Erro ao arquivar anotação. Tente novamente.');
    }
  }

  private async acknowledgeAnnotation(id: string): Promise<void> {
    const index = this.annotations.findIndex((a) => a.id === id);
    if (index === -1) return;

    const annotation = this.annotations[index];
    const now = new Date().toISOString();

    const auditEntry: AuditEntry = {
      timestamp: now,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      userEmail: this.currentUser.email,
      action: 'acknowledged',
    };

    const updatedAnnotation: Annotation = {
      ...annotation,
      acknowledged: !annotation.acknowledged,
      acknowledgedBy: annotation.acknowledged ? undefined : this.currentUser,
      acknowledgedAt: annotation.acknowledged ? undefined : now,
      history: [...annotation.history, auditEntry],
    };

    this.annotations[index] = updatedAnnotation;
    const success = await this.saveAnnotations();

    if (success) {
      this.render();
    } else {
      this.annotations[index] = annotation;
    }
  }

  // ============================================
  // FILTERING AND PAGINATION
  // ============================================

  private getFilteredAnnotations(): Annotation[] {
    let result = [...this.annotations];

    // Filter by status
    if (this.filters.status && this.filters.status !== 'all') {
      result = result.filter((a) => a.status === this.filters.status);
    }

    // Filter by type
    if (this.filters.type && this.filters.type !== 'all') {
      result = result.filter((a) => a.type === this.filters.type);
    }

    // Filter by importance
    if (this.filters.importance && this.filters.importance !== 'all') {
      result = result.filter((a) => a.importance === this.filters.importance);
    }

    // Filter by search text
    if (this.filters.searchText) {
      const search = this.filters.searchText.toLowerCase();
      result = result.filter(
        (a) =>
          a.text.toLowerCase().includes(search) ||
          a.createdBy.name.toLowerCase().includes(search) ||
          a.createdBy.email.toLowerCase().includes(search)
      );
    }

    return result;
  }

  private getPaginatedAnnotations(): Annotation[] {
    const filtered = this.getFilteredAnnotations();
    this.pagination.totalItems = filtered.length;
    this.pagination.totalPages = Math.ceil(filtered.length / this.pagination.pageSize);

    const start = (this.pagination.currentPage - 1) * this.pagination.pageSize;
    return filtered.slice(start, start + this.pagination.pageSize);
  }

  // ============================================
  // RENDER METHODS
  // ============================================

  private injectStyles(): void {
    if (document.getElementById('annotations-tab-styles')) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = 'annotations-tab-styles';
    this.styleElement.textContent = ANNOTATIONS_STYLES;
    document.head.appendChild(this.styleElement);
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="annotations-tab">
        ${this.renderHeader()}
        ${this.renderStats()}
        ${this.renderForm()}
        ${this.renderFilters()}
        ${this.renderGrid()}
        ${this.renderPagination()}
      </div>
    `;

    this.attachEventListeners();
    this.attachFormSelectors();
  }

  private renderHeader(): string {
    return `
      <div class="annotations-header">
        <span class="annotations-header__icon">📋</span>
        <div class="annotations-header__content">
          <div class="annotations-header__title">Anotações do Dispositivo</div>
          <div class="annotations-header__desc">
            Registre observações, pendências, atividades de manutenção e outras informações importantes sobre este dispositivo.
            As anotações ficam salvas no histórico e podem ser consultadas a qualquer momento.
          </div>
        </div>
      </div>
    `;
  }

  private renderStats(): string {
    const stats = {
      pending: this.annotations.filter(a => a.type === 'pending' && a.status !== 'archived').length,
      maintenance: this.annotations.filter(a => a.type === 'maintenance' && a.status !== 'archived').length,
      activity: this.annotations.filter(a => a.type === 'activity' && a.status !== 'archived').length,
      observation: this.annotations.filter(a => a.type === 'observation' && a.status !== 'archived').length,
    };

    return `
      <div class="annotations-stats">
        <div class="annotations-stats__item">
          <span class="annotations-stats__dot annotations-stats__dot--pending"></span>
          <span><span class="annotations-stats__count">${stats.pending}</span> pendência(s)</span>
        </div>
        <div class="annotations-stats__item">
          <span class="annotations-stats__dot annotations-stats__dot--maintenance"></span>
          <span><span class="annotations-stats__count">${stats.maintenance}</span> manutenção(ões)</span>
        </div>
        <div class="annotations-stats__item">
          <span class="annotations-stats__dot annotations-stats__dot--activity"></span>
          <span><span class="annotations-stats__count">${stats.activity}</span> atividade(s)</span>
        </div>
        <div class="annotations-stats__item">
          <span class="annotations-stats__dot annotations-stats__dot--observation"></span>
          <span><span class="annotations-stats__count">${stats.observation}</span> observação(ões)</span>
        </div>
      </div>
    `;
  }

  private renderForm(): string {
    return `
      <div class="annotations-form">
        <div class="annotations-form__title">✏️ Nova Anotação</div>

        <div class="annotations-form__row">
          <div class="annotations-form__field annotations-form__field--full">
            <label class="annotations-form__label">Texto da Anotação</label>
            <textarea
              class="annotations-form__textarea"
              id="annotation-text"
              placeholder="Digite sua anotação (máx. 255 caracteres)..."
              maxlength="255"
            ></textarea>
            <div class="annotations-form__char-count" id="char-count">0 / 255</div>
          </div>
        </div>

        <div class="annotations-form__row">
          <div class="annotations-form__field">
            <label class="annotations-form__label">Tipo</label>
            <div class="type-selector" id="type-selector">
              <div class="type-option type-option--pending selected" data-type="pending">
                <span class="type-option__dot"></span>
                <span class="type-option__label">Pendência</span>
              </div>
              <div class="type-option type-option--maintenance" data-type="maintenance">
                <span class="type-option__dot"></span>
                <span class="type-option__label">Manutenção</span>
              </div>
              <div class="type-option type-option--activity" data-type="activity">
                <span class="type-option__dot"></span>
                <span class="type-option__label">Atividade</span>
              </div>
              <div class="type-option type-option--observation" data-type="observation">
                <span class="type-option__dot"></span>
                <span class="type-option__label">Observação</span>
              </div>
            </div>
          </div>
        </div>

        <div class="annotations-form__row">
          <div class="annotations-form__field">
            <label class="annotations-form__label">Importância</label>
            <div class="importance-selector" id="importance-selector">
              <div class="importance-option importance-option--1" data-importance="1" title="Muito Baixa">1</div>
              <div class="importance-option importance-option--2" data-importance="2" title="Baixa">2</div>
              <div class="importance-option importance-option--3 selected" data-importance="3" title="Média">3</div>
              <div class="importance-option importance-option--4" data-importance="4" title="Alta">4</div>
              <div class="importance-option importance-option--5" data-importance="5" title="Muito Alta">5</div>
            </div>
          </div>
          <div class="annotations-form__field">
            <label class="annotations-form__label">Data Limite (opcional)</label>
            <input type="datetime-local" class="annotations-form__input" id="annotation-due-date">
          </div>
        </div>

        <div class="annotations-form__actions">
          <button class="annotations-form__btn annotations-form__btn--secondary" id="clear-form-btn" type="button">
            Limpar
          </button>
          <button class="annotations-form__btn annotations-form__btn--primary" id="add-annotation-btn" type="button" disabled>
            Criar Anotação
          </button>
        </div>
      </div>
    `;
  }

  private attachFormSelectors(): void {
    // Type selector
    const typeSelector = this.container.querySelector('#type-selector');
    if (typeSelector) {
      const typeOptions = typeSelector.querySelectorAll('.type-option');
      typeOptions.forEach((opt) => {
        opt.addEventListener('click', () => {
          typeOptions.forEach((o) => o.classList.remove('selected'));
          opt.classList.add('selected');
        });
      });
    }

    // Importance selector
    const importanceSelector = this.container.querySelector('#importance-selector');
    if (importanceSelector) {
      const importanceOptions = importanceSelector.querySelectorAll('.importance-option');
      importanceOptions.forEach((opt) => {
        opt.addEventListener('click', () => {
          importanceOptions.forEach((o) => o.classList.remove('selected'));
          opt.classList.add('selected');
        });
      });
    }

    // Clear form button
    const clearBtn = this.container.querySelector('#clear-form-btn');
    clearBtn?.addEventListener('click', () => {
      this.clearForm();
    });
  }

  private clearForm(): void {
    const textArea = this.container.querySelector('#annotation-text') as HTMLTextAreaElement;
    const dueDate = this.container.querySelector('#annotation-due-date') as HTMLInputElement;
    const charCount = this.container.querySelector('#char-count');
    const addBtn = this.container.querySelector('#add-annotation-btn') as HTMLButtonElement;

    if (textArea) textArea.value = '';
    if (dueDate) dueDate.value = '';
    if (charCount) charCount.textContent = '0 / 255';
    if (addBtn) addBtn.disabled = true;

    // Reset type selector to pending
    const typeOptions = this.container.querySelectorAll('.type-option');
    typeOptions.forEach((o) => o.classList.remove('selected'));
    this.container.querySelector('.type-option--pending')?.classList.add('selected');

    // Reset importance selector to 3
    const importanceOptions = this.container.querySelectorAll('.importance-option');
    importanceOptions.forEach((o) => o.classList.remove('selected'));
    this.container.querySelector('.importance-option--3')?.classList.add('selected');
  }

  private renderFilters(): string {
    return `
      <div class="annotations-filters">
        <div class="annotations-filters__title">Filtros</div>
        <div class="annotations-filters__row">
          <div class="annotations-filters__field">
            <select class="annotations-filters__select" id="filter-status">
              <option value="all">Todos Status</option>
              <option value="created">${STATUS_LABELS.created}</option>
              <option value="modified">${STATUS_LABELS.modified}</option>
              <option value="archived">${STATUS_LABELS.archived}</option>
            </select>
          </div>
          <div class="annotations-filters__field">
            <select class="annotations-filters__select" id="filter-type">
              <option value="all">Todos Tipos</option>
              <option value="observation">${ANNOTATION_TYPE_LABELS.observation}</option>
              <option value="pending">${ANNOTATION_TYPE_LABELS.pending}</option>
              <option value="maintenance">${ANNOTATION_TYPE_LABELS.maintenance}</option>
              <option value="activity">${ANNOTATION_TYPE_LABELS.activity}</option>
            </select>
          </div>
          <div class="annotations-filters__field">
            <select class="annotations-filters__select" id="filter-importance">
              <option value="all">Todas Importâncias</option>
              <option value="1">${IMPORTANCE_LABELS[1]}</option>
              <option value="2">${IMPORTANCE_LABELS[2]}</option>
              <option value="3">${IMPORTANCE_LABELS[3]}</option>
              <option value="4">${IMPORTANCE_LABELS[4]}</option>
              <option value="5">${IMPORTANCE_LABELS[5]}</option>
            </select>
          </div>
          <div class="annotations-filters__field annotations-filters__search">
            <input
              type="text"
              class="annotations-filters__input"
              id="filter-search"
              placeholder="Buscar..."
            >
          </div>
        </div>
      </div>
    `;
  }

  private renderGrid(): string {
    const paginated = this.getPaginatedAnnotations();

    if (paginated.length === 0) {
      return `
        <div class="annotations-grid">
          <div class="annotations-empty">
            <div class="annotations-empty__icon">📋</div>
            <div class="annotations-empty__text">
              ${this.annotations.length === 0
                ? 'Nenhuma anotação encontrada.<br>Adicione a primeira anotação acima.'
                : 'Nenhuma anotação corresponde aos filtros selecionados.'}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="annotations-grid">
        <div class="annotations-grid__header">
          <span class="annotations-grid__title">📋 Anotações Registradas</span>
          <span class="annotations-grid__count">${this.pagination.totalItems} registro(s)</span>
        </div>
        <div class="annotations-grid__list">
          ${paginated.map((a) => this.renderCard(a)).join('')}
        </div>
      </div>
    `;
  }

  private isOverdue(annotation: Annotation): boolean {
    if (!annotation.dueDate || annotation.status === 'archived') return false;
    return new Date(annotation.dueDate) < new Date();
  }

  private formatDate(isoString: string): string {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private renderCard(annotation: Annotation): string {
    const canModify = canModifyAnnotation(annotation, this.permissions);
    const typeColor = ANNOTATION_TYPE_COLORS[annotation.type];
    const importanceColor = IMPORTANCE_COLORS[annotation.importance];
    const overdue = this.isOverdue(annotation);
    const authorInitial = annotation.createdBy.name.charAt(0).toUpperCase();

    const cardClasses = [
      'annotation-card',
      annotation.status === 'archived' ? 'annotation-card--archived' : '',
      overdue ? 'annotation-card--overdue' : '',
    ].filter(Boolean).join(' ');

    return `
      <div class="${cardClasses}" data-id="${annotation.id}">
        <div class="annotation-card__header">
          <div class="annotation-card__type" style="background: ${typeColor}20; color: ${typeColor}; border: 1px solid ${typeColor}40;">
            ${ANNOTATION_TYPE_LABELS[annotation.type]}
          </div>
          <div class="annotation-card__importance" style="background: ${importanceColor}">
            ${IMPORTANCE_LABELS[annotation.importance]}
          </div>
          ${annotation.acknowledged ? '<div class="annotation-card__ack">✓ Reconhecida</div>' : ''}
          ${overdue ? '<div class="annotation-card__overdue-badge">⚠️ Vencida</div>' : ''}
        </div>

        <div class="annotation-card__text">${annotation.text}</div>

        <div class="annotation-card__meta">
          <div class="annotation-card__author">
            <span class="annotation-card__avatar">${authorInitial}</span>
            <span>${annotation.createdBy.name}</span>
          </div>
          <div class="annotation-card__date">${this.formatDate(annotation.createdAt)}</div>
        </div>

        ${annotation.dueDate ? `
          <div class="annotation-card__due ${overdue ? 'annotation-card__due--overdue' : ''}">
            Prazo: ${this.formatDate(annotation.dueDate)}
          </div>
        ` : ''}

        <div class="annotation-card__actions">
          ${canModify && annotation.status !== 'archived' ? `
            <button class="annotation-card__btn annotation-card__btn--edit" data-action="edit">✏️ Editar</button>
            <button class="annotation-card__btn annotation-card__btn--archive" data-action="archive">📦 Arquivar</button>
          ` : ''}
          ${!annotation.acknowledged ? `
            <button class="annotation-card__btn annotation-card__btn--ack" data-action="acknowledge">✓ Reconhecer</button>
          ` : ''}
          <button class="annotation-card__btn annotation-card__btn--history" data-action="details">📜 Histórico</button>
        </div>
      </div>
    `;
  }

  // Legacy row render (kept for compatibility)
  private renderRow(annotation: Annotation): string {
    const canModify = canModifyAnnotation(annotation, this.permissions);
    const typeColor = ANNOTATION_TYPE_COLORS[annotation.type];
    const importanceColor = IMPORTANCE_COLORS[annotation.importance];
    const statusColor = STATUS_COLORS[annotation.status];
    const date = new Date(annotation.createdAt).toLocaleString('pt-BR');
    const truncatedText = annotation.text.length > 50
      ? annotation.text.substring(0, 50) + '...'
      : annotation.text;

    return `
      <div class="annotation-row ${annotation.status === 'archived' ? 'annotation-row--archived' : ''}" data-id="${annotation.id}">
        <div class="annotation-row__checkbox">
          <input
            type="checkbox"
            ${annotation.acknowledged ? 'checked' : ''}
            data-action="acknowledge"
            title="Marcar como visto"
          >
        </div>
        <div class="annotation-row__content">
          <div class="annotation-row__meta">
            <span class="annotation-row__date">${date}</span>
            <span class="annotation-row__user">${annotation.createdBy.name}</span>
            <span class="annotation-row__badge" style="background: ${typeColor}; color: #fff;">
              ${ANNOTATION_TYPE_LABELS[annotation.type]}
            </span>
            <span class="annotation-row__badge" style="background: ${importanceColor}20; color: ${importanceColor}; border: 1px solid ${importanceColor};">
              ${IMPORTANCE_LABELS[annotation.importance]}
            </span>
            <span class="annotation-row__badge" style="background: ${statusColor}20; color: ${statusColor};">
              ${STATUS_LABELS[annotation.status]}
            </span>
          </div>
          <div class="annotation-row__text" title="${annotation.text}">${truncatedText}</div>
        </div>
        <div class="annotation-row__actions">
          <button class="annotation-row__btn" data-action="details">Detalhes</button>
          ${canModify && annotation.status !== 'archived' ? `
            <button class="annotation-row__btn annotation-row__btn--danger" data-action="archive">Arquivar</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderPagination(): string {
    if (this.pagination.totalPages <= 1) return '';

    return `
      <div class="annotations-pagination">
        <button
          class="annotations-pagination__btn"
          id="prev-page"
          ${this.pagination.currentPage <= 1 ? 'disabled' : ''}
        >← Anterior</button>
        <span class="annotations-pagination__info">
          Página ${this.pagination.currentPage} de ${this.pagination.totalPages}
        </span>
        <button
          class="annotations-pagination__btn"
          id="next-page"
          ${this.pagination.currentPage >= this.pagination.totalPages ? 'disabled' : ''}
        >Próxima →</button>
      </div>
    `;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private attachEventListeners(): void {
    // Form events
    const textArea = this.container.querySelector('#annotation-text') as HTMLTextAreaElement;
    const charCount = this.container.querySelector('#char-count');
    const addBtn = this.container.querySelector('#add-annotation-btn') as HTMLButtonElement;

    textArea?.addEventListener('input', () => {
      const len = textArea.value.length;
      if (charCount) {
        charCount.textContent = `${len} / 255`;
        charCount.className = 'annotations-form__char-count' +
          (len > 240 ? ' annotations-form__char-count--warning' : '') +
          (len >= 255 ? ' annotations-form__char-count--error' : '');
      }
      if (addBtn) {
        addBtn.disabled = len === 0;
      }
    });

    addBtn?.addEventListener('click', async () => {
      // Get type from visual selector
      const selectedType = this.container.querySelector('.type-option.selected') as HTMLElement;
      const type = (selectedType?.dataset.type || 'observation') as AnnotationType;

      // Get importance from visual selector
      const selectedImportance = this.container.querySelector('.importance-option.selected') as HTMLElement;
      const importance = parseInt(selectedImportance?.dataset.importance || '3') as ImportanceLevel;

      const dueDate = (this.container.querySelector('#annotation-due-date') as HTMLInputElement).value || undefined;
      const text = textArea.value.trim();

      if (text) {
        addBtn.disabled = true;
        addBtn.textContent = 'Salvando...';
        await this.addAnnotation({ text, type, importance, dueDate });
        addBtn.textContent = 'Criar Anotação';
        this.clearForm();
      }
    });

    // Filter events
    const filterStatus = this.container.querySelector('#filter-status') as HTMLSelectElement;
    const filterType = this.container.querySelector('#filter-type') as HTMLSelectElement;
    const filterImportance = this.container.querySelector('#filter-importance') as HTMLSelectElement;
    const filterSearch = this.container.querySelector('#filter-search') as HTMLInputElement;

    filterStatus?.addEventListener('change', () => {
      this.filters.status = filterStatus.value as AnnotationStatus | 'all';
      this.pagination.currentPage = 1;
      this.render();
    });

    filterType?.addEventListener('change', () => {
      this.filters.type = filterType.value as AnnotationType | 'all';
      this.pagination.currentPage = 1;
      this.render();
    });

    filterImportance?.addEventListener('change', () => {
      this.filters.importance = filterImportance.value === 'all' ? 'all' : parseInt(filterImportance.value) as ImportanceLevel;
      this.pagination.currentPage = 1;
      this.render();
    });

    filterSearch?.addEventListener('input', () => {
      this.filters.searchText = filterSearch.value;
      this.pagination.currentPage = 1;
      this.render();
    });

    // Pagination events
    this.container.querySelector('#prev-page')?.addEventListener('click', () => {
      if (this.pagination.currentPage > 1) {
        this.pagination.currentPage--;
        this.render();
      }
    });

    this.container.querySelector('#next-page')?.addEventListener('click', () => {
      if (this.pagination.currentPage < this.pagination.totalPages) {
        this.pagination.currentPage++;
        this.render();
      }
    });

    // Card action events (new card layout)
    this.container.querySelectorAll('.annotation-card').forEach((card) => {
      const id = card.getAttribute('data-id');
      if (!id) return;

      card.querySelector('[data-action="acknowledge"]')?.addEventListener('click', () => {
        this.acknowledgeAnnotation(id);
      });

      card.querySelector('[data-action="details"]')?.addEventListener('click', () => {
        this.showDetailModal(id);
      });

      card.querySelector('[data-action="archive"]')?.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja arquivar esta anotação?')) {
          this.archiveAnnotation(id);
        }
      });

      card.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
        this.showEditModal(id);
      });
    });

    // Legacy row action events (kept for compatibility)
    this.container.querySelectorAll('.annotation-row').forEach((row) => {
      const id = row.getAttribute('data-id');
      if (!id) return;

      row.querySelector('[data-action="acknowledge"]')?.addEventListener('change', () => {
        this.acknowledgeAnnotation(id);
      });

      row.querySelector('[data-action="details"]')?.addEventListener('click', () => {
        this.showDetailModal(id);
      });

      row.querySelector('[data-action="archive"]')?.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja arquivar esta anotação?')) {
          this.archiveAnnotation(id);
        }
      });
    });
  }

  // ============================================
  // EDIT MODAL
  // ============================================

  private showEditModal(id: string): void {
    const annotation = this.annotations.find((a) => a.id === id);
    if (!annotation) return;

    const newText = prompt('Editar texto da anotação:', annotation.text);
    if (newText && newText.trim() !== annotation.text) {
      this.updateAnnotation(id, { text: newText.trim() });
    }
  }

  // ============================================
  // DETAIL MODAL
  // ============================================

  private showDetailModal(id: string): void {
    const annotation = this.annotations.find((a) => a.id === id);
    if (!annotation) return;

    const canModify = canModifyAnnotation(annotation, this.permissions);
    const overlay = document.createElement('div');
    overlay.className = 'annotation-detail-overlay';

    overlay.innerHTML = `
      <div class="annotation-detail-modal">
        <div class="annotation-detail__header">
          <span class="annotation-detail__title">Detalhes da Anotação</span>
          <button class="annotation-detail__close">&times;</button>
        </div>
        <div class="annotation-detail__content">
          <div class="annotation-detail__field">
            <div class="annotation-detail__label">Tipo</div>
            <div class="annotation-detail__value">
              <span style="color: ${ANNOTATION_TYPE_COLORS[annotation.type]}">
                ${ANNOTATION_TYPE_LABELS[annotation.type]}
              </span>
            </div>
          </div>
          <div class="annotation-detail__field">
            <div class="annotation-detail__label">Importância</div>
            <div class="annotation-detail__value">
              <span style="color: ${IMPORTANCE_COLORS[annotation.importance]}">
                ${IMPORTANCE_LABELS[annotation.importance]}
              </span>
            </div>
          </div>
          <div class="annotation-detail__field">
            <div class="annotation-detail__label">Status</div>
            <div class="annotation-detail__value">
              <span style="color: ${STATUS_COLORS[annotation.status]}">
                ${STATUS_LABELS[annotation.status]}
              </span>
            </div>
          </div>
          <div class="annotation-detail__field">
            <div class="annotation-detail__label">Criado por</div>
            <div class="annotation-detail__value">${annotation.createdBy.name} (${annotation.createdBy.email})</div>
          </div>
          <div class="annotation-detail__field">
            <div class="annotation-detail__label">Data de Criação</div>
            <div class="annotation-detail__value">${new Date(annotation.createdAt).toLocaleString('pt-BR')}</div>
          </div>
          ${annotation.dueDate ? `
            <div class="annotation-detail__field">
              <div class="annotation-detail__label">Data Limite</div>
              <div class="annotation-detail__value">${new Date(annotation.dueDate).toLocaleDateString('pt-BR')}</div>
            </div>
          ` : ''}
          <div class="annotation-detail__field">
            <div class="annotation-detail__label">Texto</div>
            <div class="annotation-detail__value">${annotation.text}</div>
          </div>
          ${annotation.acknowledged ? `
            <div class="annotation-detail__field">
              <div class="annotation-detail__label">Reconhecido por</div>
              <div class="annotation-detail__value">
                ${annotation.acknowledgedBy?.name} em ${new Date(annotation.acknowledgedAt || '').toLocaleString('pt-BR')}
              </div>
            </div>
          ` : ''}
          <div class="annotation-detail__history">
            <div class="annotation-detail__history-title">Histórico (${annotation.history.length} eventos)</div>
            ${annotation.history.map((h) => `
              <div class="annotation-detail__history-item">
                <strong>${h.action}</strong> por ${h.userName} em ${new Date(h.timestamp).toLocaleString('pt-BR')}
              </div>
            `).join('')}
          </div>
        </div>
        <div class="annotation-detail__footer">
          ${canModify && annotation.status !== 'archived' ? `
            <button class="annotation-detail__btn annotation-detail__btn--danger" data-action="archive">
              Arquivar
            </button>
          ` : ''}
          <button class="annotation-detail__btn annotation-detail__btn--secondary" data-action="close">
            Fechar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    overlay.querySelector('.annotation-detail__close')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-action="archive"]')?.addEventListener('click', async () => {
      if (confirm('Tem certeza que deseja arquivar esta anotação?')) {
        overlay.remove();
        await this.archiveAnnotation(id);
      }
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
}

// Export default
export default AnnotationsTab;
