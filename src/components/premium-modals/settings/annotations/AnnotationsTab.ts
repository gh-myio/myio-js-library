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
import { MyIOToast } from '../../../../components/MyIOToast';
import { createDateRangePicker, type DateRangeControl } from '../../../../components/createDateRangePicker';

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

/* Filters + Create Button Container */
.annotations-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: stretch;
}

/* Filters Section - 85% width */
.annotations-filters {
  background: #fff;
  border-radius: 12px;
  padding: 12px 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  flex: 0 0 85%;
  min-width: 0;
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
  min-width: 100px;
}

/* Multiselect Dropdown Styles */
.annotations-filters__multiselect {
  position: relative;
  min-width: 130px;
}

.annotations-filters__multiselect-btn {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  font-size: 12px;
  background: #f8f9fa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  color: #212529;
  text-align: left;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.annotations-filters__multiselect-btn:hover {
  border-color: #6c5ce7;
}

.annotations-filters__multiselect-btn:focus {
  outline: none;
  border-color: #6c5ce7;
  box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.15);
}

.annotations-filters__arrow {
  font-size: 10px;
  color: #6c757d;
  transition: transform 0.2s;
}

.annotations-filters__multiselect.open .annotations-filters__arrow {
  transform: rotate(180deg);
}

.annotations-filters__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-top: 4px;
  display: none;
  max-height: 200px;
  overflow-y: auto;
}

.annotations-filters__multiselect.open .annotations-filters__dropdown {
  display: block;
}

.annotations-filters__checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 12px;
  color: #212529;
  transition: background-color 0.15s;
}

.annotations-filters__checkbox-item:hover {
  background: #f8f9fa;
}

.annotations-filters__checkbox-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #6c5ce7;
  cursor: pointer;
}

.annotations-filters__select,
.annotations-filters__input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  font-size: 12px;
  background: #f8f9fa;
  cursor: pointer;
}

.annotations-filters__select:focus,
.annotations-filters__input:focus {
  outline: none;
  border-color: #6c5ce7;
  box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.15);
}

.annotations-filters__search {
  flex: 2;
}

.annotations-filters__date-range {
  flex: 1.5;
  min-width: 180px;
}

.annotations-filters__date-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  font-size: 12px;
  background: #f8f9fa;
  cursor: pointer;
  box-sizing: border-box;
}

.annotations-filters__date-input:focus {
  outline: none;
  border-color: #6c5ce7;
  box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.15);
}

/* Create Button - fills remaining 15% */
.annotations-create-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 20px;
  flex: 1;
  min-width: 80px;
  background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  font-size: 13px;
  position: relative;
  z-index: 10;
  pointer-events: auto;
}

.annotations-create-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
}

.annotations-create-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(108, 92, 231, 0.3);
}

.annotations-create-btn__icon {
  font-size: 28px;
  line-height: 1;
  pointer-events: none;
}

.annotations-create-btn__text {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  pointer-events: none;
}

/* New Annotation Modal Overlay */
.annotations-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100001;
  animation: annotModalFadeIn 0.2s ease;
}

@keyframes annotModalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.annotations-modal {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 560px;
  width: 95%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: annotModalSlideIn 0.25s ease;
}

@keyframes annotModalSlideIn {
  from { transform: translateY(-20px) scale(0.95); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

.annotations-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
  color: #fff;
}

.annotations-modal__title {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.annotations-modal__close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.annotations-modal__close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.annotations-modal__content {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.annotations-modal__footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  justify-content: flex-end;
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
  private filterDateRangePicker: DateRangeControl | null = null;
  private modalDateRangePicker: DateRangeControl | null = null;
  private newAnnotationModal: HTMLElement | null = null;

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

  /**
   * Show a confirmation modal and return user's choice
   * Replaces native confirm() for better UX
   */
  private showConfirmation(message: string, title: string = 'Confirmar'): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'annotations-confirm-overlay';
      overlay.innerHTML = `
        <div class="annotations-confirm-modal">
          <div class="annotations-confirm-header">
            <span class="annotations-confirm-icon">⚠️</span>
            <span class="annotations-confirm-title">${title}</span>
          </div>
          <div class="annotations-confirm-body">
            <p>${message}</p>
          </div>
          <div class="annotations-confirm-actions">
            <button class="annotations-confirm-btn annotations-confirm-btn--cancel" data-action="cancel">
              Cancelar
            </button>
            <button class="annotations-confirm-btn annotations-confirm-btn--confirm" data-action="confirm">
              Confirmar
            </button>
          </div>
        </div>
      `;

      // Inject styles if not present
      if (!document.getElementById('annotations-confirm-styles')) {
        const style = document.createElement('style');
        style.id = 'annotations-confirm-styles';
        style.textContent = `
          .annotations-confirm-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100001;
            animation: confirmFadeIn 0.2s ease;
          }
          @keyframes confirmFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .annotations-confirm-modal {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
            overflow: hidden;
            animation: confirmSlideIn 0.25s ease;
          }
          @keyframes confirmSlideIn {
            from { transform: translateY(-20px) scale(0.95); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
          .annotations-confirm-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 16px 20px;
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-bottom: 1px solid #f59e0b;
          }
          .annotations-confirm-icon {
            font-size: 20px;
          }
          .annotations-confirm-title {
            font-weight: 600;
            color: #92400e;
            font-size: 16px;
          }
          .annotations-confirm-body {
            padding: 20px;
          }
          .annotations-confirm-body p {
            margin: 0;
            color: #374151;
            font-size: 14px;
            line-height: 1.5;
          }
          .annotations-confirm-actions {
            display: flex;
            gap: 12px;
            padding: 16px 20px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            justify-content: flex-end;
          }
          .annotations-confirm-btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
          }
          .annotations-confirm-btn--cancel {
            background: #e5e7eb;
            color: #374151;
          }
          .annotations-confirm-btn--cancel:hover {
            background: #d1d5db;
          }
          .annotations-confirm-btn--confirm {
            background: #f59e0b;
            color: white;
          }
          .annotations-confirm-btn--confirm:hover {
            background: #d97706;
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(overlay);

      const cleanup = (result: boolean) => {
        overlay.remove();
        resolve(result);
      };

      overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => cleanup(false));
      overlay.querySelector('[data-action="confirm"]')?.addEventListener('click', () => cleanup(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });
    });
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
      MyIOToast.show('Erro ao salvar anotação. Tente novamente.', 'error');
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
      const annotationAny = annotation as unknown as Record<string, unknown>;
      if (annotationAny[key] !== value) {
        changeRecord[key] = {
          from: annotationAny[key],
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
      MyIOToast.show('Erro ao atualizar anotação. Tente novamente.', 'error');
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
      MyIOToast.show('Erro ao arquivar anotação. Tente novamente.', 'error');
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

    // Filter by status (multiselect)
    if (this.filters.statusList && this.filters.statusList.length > 0) {
      result = result.filter((a) => this.filters.statusList!.includes(a.status));
    }

    // Filter by type (multiselect)
    if (this.filters.typeList && this.filters.typeList.length > 0) {
      result = result.filter((a) => this.filters.typeList!.includes(a.type));
    }

    // Filter by importance (multiselect)
    if (this.filters.importanceList && this.filters.importanceList.length > 0) {
      result = result.filter((a) => this.filters.importanceList!.includes(a.importance));
    }

    // Filter by date range
    if (this.filters.dateRange?.start && this.filters.dateRange?.end) {
      const startDate = new Date(this.filters.dateRange.start).getTime();
      const endDate = new Date(this.filters.dateRange.end).getTime();
      result = result.filter((a) => {
        const annotationDate = new Date(a.createdAt).getTime();
        return annotationDate >= startDate && annotationDate <= endDate;
      });
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
        ${this.renderToolbar()}
        ${this.renderGrid()}
        ${this.renderPagination()}
      </div>
    `;

    this.attachEventListeners();
    this.initFilterDateRangePicker();
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

  private renderToolbar(): string {
    return `
      <div class="annotations-toolbar">
        <div class="annotations-filters">
          <div class="annotations-filters__title">Filtros</div>
          <div class="annotations-filters__row">
            <!-- Status Multiselect -->
            <div class="annotations-filters__field annotations-filters__multiselect">
              <button type="button" class="annotations-filters__multiselect-btn" id="filter-status-btn">
                <span>${this.getStatusFilterLabel()}</span>
                <span class="annotations-filters__arrow">▼</span>
              </button>
              <div class="annotations-filters__dropdown" id="filter-status-dropdown">
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-status" value="all" ${!this.filters.statusList || this.filters.statusList.length === 0 ? 'checked' : ''}>
                  <span>Todos</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-status" value="created" ${this.filters.statusList?.includes('created') ? 'checked' : ''}>
                  <span>${STATUS_LABELS.created}</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-status" value="modified" ${this.filters.statusList?.includes('modified') ? 'checked' : ''}>
                  <span>${STATUS_LABELS.modified}</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-status" value="archived" ${this.filters.statusList?.includes('archived') ? 'checked' : ''}>
                  <span>${STATUS_LABELS.archived}</span>
                </label>
              </div>
            </div>

            <!-- Type Multiselect -->
            <div class="annotations-filters__field annotations-filters__multiselect">
              <button type="button" class="annotations-filters__multiselect-btn" id="filter-type-btn">
                <span>${this.getTypeFilterLabel()}</span>
                <span class="annotations-filters__arrow">▼</span>
              </button>
              <div class="annotations-filters__dropdown" id="filter-type-dropdown">
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-type" value="all" ${!this.filters.typeList || this.filters.typeList.length === 0 ? 'checked' : ''}>
                  <span>Todos</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-type" value="pending" ${this.filters.typeList?.includes('pending') ? 'checked' : ''}>
                  <span>${ANNOTATION_TYPE_LABELS.pending}</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-type" value="maintenance" ${this.filters.typeList?.includes('maintenance') ? 'checked' : ''}>
                  <span>${ANNOTATION_TYPE_LABELS.maintenance}</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-type" value="activity" ${this.filters.typeList?.includes('activity') ? 'checked' : ''}>
                  <span>${ANNOTATION_TYPE_LABELS.activity}</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-type" value="observation" ${this.filters.typeList?.includes('observation') ? 'checked' : ''}>
                  <span>${ANNOTATION_TYPE_LABELS.observation}</span>
                </label>
              </div>
            </div>

            <!-- Importance Multiselect -->
            <div class="annotations-filters__field annotations-filters__multiselect">
              <button type="button" class="annotations-filters__multiselect-btn" id="filter-importance-btn">
                <span>${this.getImportanceFilterLabel()}</span>
                <span class="annotations-filters__arrow">▼</span>
              </button>
              <div class="annotations-filters__dropdown" id="filter-importance-dropdown">
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-importance" value="all" ${!this.filters.importanceList || this.filters.importanceList.length === 0 ? 'checked' : ''}>
                  <span>Todas</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-importance" value="1" ${this.filters.importanceList?.includes(1) ? 'checked' : ''}>
                  <span>${IMPORTANCE_LABELS[1]}</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-importance" value="2" ${this.filters.importanceList?.includes(2) ? 'checked' : ''}>
                  <span>${IMPORTANCE_LABELS[2]}</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-importance" value="3" ${this.filters.importanceList?.includes(3) ? 'checked' : ''}>
                  <span>${IMPORTANCE_LABELS[3]}</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-importance" value="4" ${this.filters.importanceList?.includes(4) ? 'checked' : ''}>
                  <span>${IMPORTANCE_LABELS[4]}</span>
                </label>
                <label class="annotations-filters__checkbox-item">
                  <input type="checkbox" name="filter-importance" value="5" ${this.filters.importanceList?.includes(5) ? 'checked' : ''}>
                  <span>${IMPORTANCE_LABELS[5]}</span>
                </label>
              </div>
            </div>

            <!-- Date Range Filter -->
            <div class="annotations-filters__field annotations-filters__date-range">
              <input
                type="text"
                class="annotations-filters__date-input"
                id="filter-date-range"
                placeholder="Filtrar por período..."
                readonly
              >
            </div>

            <!-- Search -->
            <div class="annotations-filters__field annotations-filters__search">
              <input
                type="text"
                class="annotations-filters__input"
                id="filter-search"
                placeholder="Buscar..."
                value="${this.filters.searchText || ''}"
              >
            </div>
          </div>
        </div>

        <!-- Create Button -->
        <button type="button" class="annotations-create-btn" id="open-new-annotation-modal">
          <span class="annotations-create-btn__icon">+</span>
          <span class="annotations-create-btn__text">Nova</span>
        </button>
      </div>
    `;
  }

  private getStatusFilterLabel(): string {
    if (!this.filters.statusList || this.filters.statusList.length === 0) {
      return 'Todos Status';
    }
    if (this.filters.statusList.length === 1) {
      return STATUS_LABELS[this.filters.statusList[0]];
    }
    return `${this.filters.statusList.length} selecionados`;
  }

  private getTypeFilterLabel(): string {
    if (!this.filters.typeList || this.filters.typeList.length === 0) {
      return 'Todos Tipos';
    }
    if (this.filters.typeList.length === 1) {
      return ANNOTATION_TYPE_LABELS[this.filters.typeList[0]];
    }
    return `${this.filters.typeList.length} selecionados`;
  }

  private getImportanceFilterLabel(): string {
    if (!this.filters.importanceList || this.filters.importanceList.length === 0) {
      return 'Todas Importâncias';
    }
    if (this.filters.importanceList.length === 1) {
      return IMPORTANCE_LABELS[this.filters.importanceList[0]];
    }
    return `${this.filters.importanceList.length} selecionadas`;
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
    // Open New Annotation Modal button
    const openModalBtn = this.container.querySelector('#open-new-annotation-modal') as HTMLButtonElement;
    if (openModalBtn) {
      openModalBtn.onclick = () => {
        this.showNewAnnotationModal();
      };
    } else {
      console.warn('[AnnotationsTab] Create button not found');
    }

    // Multiselect dropdown toggles
    this.setupMultiselectDropdown('filter-status', (values) => {
      if (values.includes('all') || values.length === 0) {
        this.filters.statusList = undefined;
      } else {
        this.filters.statusList = values as AnnotationStatus[];
      }
      this.pagination.currentPage = 1;
      this.render();
    });

    this.setupMultiselectDropdown('filter-type', (values) => {
      if (values.includes('all') || values.length === 0) {
        this.filters.typeList = undefined;
      } else {
        this.filters.typeList = values as AnnotationType[];
      }
      this.pagination.currentPage = 1;
      this.render();
    });

    this.setupMultiselectDropdown('filter-importance', (values) => {
      if (values.includes('all') || values.length === 0) {
        this.filters.importanceList = undefined;
      } else {
        this.filters.importanceList = values.map(v => parseInt(v)) as ImportanceLevel[];
      }
      this.pagination.currentPage = 1;
      this.render();
    });

    // Search filter
    const filterSearch = this.container.querySelector('#filter-search') as HTMLInputElement;
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

      card.querySelector('[data-action="archive"]')?.addEventListener('click', async () => {
        if (await this.showConfirmation('Tem certeza que deseja arquivar esta anotação?', 'Arquivar Anotação')) {
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

      row.querySelector('[data-action="archive"]')?.addEventListener('click', async () => {
        if (await this.showConfirmation('Tem certeza que deseja arquivar esta anotação?', 'Arquivar Anotação')) {
          this.archiveAnnotation(id);
        }
      });
    });
  }

  // ============================================
  // MULTISELECT DROPDOWN HELPER
  // ============================================

  private setupMultiselectDropdown(
    filterName: string,
    onChange: (selectedValues: string[]) => void
  ): void {
    const btn = this.container.querySelector(`#${filterName}-btn`);
    const dropdown = this.container.querySelector(`#${filterName}-dropdown`);
    const multiselect = btn?.closest('.annotations-filters__multiselect');

    if (!btn || !dropdown || !multiselect) return;

    // Toggle dropdown on button click
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other open dropdowns
      this.container.querySelectorAll('.annotations-filters__multiselect.open').forEach((el) => {
        if (el !== multiselect) el.classList.remove('open');
      });
      multiselect.classList.toggle('open');
    });

    // Handle checkbox changes
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const allCheckbox = dropdown.querySelector('input[value="all"]') as HTMLInputElement;

        if (checkbox.value === 'all' && checkbox.checked) {
          // "All" selected - uncheck others
          checkboxes.forEach((cb) => {
            if (cb !== allCheckbox) cb.checked = false;
          });
        } else if (checkbox.value !== 'all' && checkbox.checked) {
          // Specific value selected - uncheck "all"
          if (allCheckbox) allCheckbox.checked = false;
        }

        // Collect selected values
        const selected: string[] = [];
        checkboxes.forEach((cb) => {
          if (cb.checked && cb.value !== 'all') {
            selected.push(cb.value);
          }
        });

        // If none selected or "all" is checked, treat as all
        if (selected.length === 0) {
          if (allCheckbox) allCheckbox.checked = true;
        }

        // Update button label
        const labelSpan = btn.querySelector('span:first-child');
        if (labelSpan) {
          if (selected.length === 0) {
            const filterType = filterName.replace('filter-', '');
            if (filterType === 'status') labelSpan.textContent = 'Todos Status';
            else if (filterType === 'type') labelSpan.textContent = 'Todos Tipos';
            else if (filterType === 'importance') labelSpan.textContent = 'Todas Importâncias';
          } else if (selected.length === 1) {
            const filterType = filterName.replace('filter-', '');
            if (filterType === 'status') labelSpan.textContent = STATUS_LABELS[selected[0] as AnnotationStatus];
            else if (filterType === 'type') labelSpan.textContent = ANNOTATION_TYPE_LABELS[selected[0] as AnnotationType];
            else if (filterType === 'importance') labelSpan.textContent = IMPORTANCE_LABELS[parseInt(selected[0]) as ImportanceLevel];
          } else {
            labelSpan.textContent = `${selected.length} selecionados`;
          }
        }

        onChange(selected);
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!multiselect.contains(e.target as Node)) {
        multiselect.classList.remove('open');
      }
    });
  }

  // ============================================
  // FILTER DATE RANGE PICKER
  // ============================================

  private async initFilterDateRangePicker(): Promise<void> {
    const dateInput = this.container.querySelector('#filter-date-range') as HTMLInputElement;
    if (!dateInput) return;

    // Add clear button functionality via double-click on input
    dateInput.addEventListener('dblclick', () => {
      if (this.filters.dateRange) {
        this.filters.dateRange = undefined;
        dateInput.value = '';
        this.pagination.currentPage = 1;
        this.render();
      }
    });
    dateInput.title = 'Duplo clique para limpar filtro de data';

    try {
      this.filterDateRangePicker = await createDateRangePicker(dateInput, {
        includeTime: true,
        timePrecision: 'minute',
        maxRangeDays: 365,
        locale: 'pt-BR',
        parentEl: this.container,
        onApply: (result) => {
          this.filters.dateRange = {
            start: result.startISO,
            end: result.endISO,
          };
          this.pagination.currentPage = 1;
          this.render();
        },
      });
    } catch (error) {
      console.warn('[AnnotationsTab] DateRangePicker initialization failed:', error);
    }
  }

  // ============================================
  // NEW ANNOTATION MODAL
  // ============================================

  private async showNewAnnotationModal(): Promise<void> {
    // Remove existing modal if present
    this.newAnnotationModal?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'annotations-modal-overlay';
    this.newAnnotationModal = overlay;

    overlay.innerHTML = `
      <div class="annotations-modal">
        <div class="annotations-modal__header">
          <span class="annotations-modal__title">✏️ Nova Anotação</span>
          <button class="annotations-modal__close" data-action="close">&times;</button>
        </div>
        <div class="annotations-modal__content">
          <!-- Text Area -->
          <div class="annotations-form__field annotations-form__field--full" style="margin-bottom: 16px;">
            <label class="annotations-form__label">Texto da Anotação</label>
            <textarea
              class="annotations-form__textarea"
              id="new-annotation-text"
              placeholder="Digite sua anotação (máx. 255 caracteres)..."
              maxlength="255"
              style="min-height: 100px;"
            ></textarea>
            <div class="annotations-form__char-count" id="new-annotation-char-count">0 / 255</div>
          </div>

          <!-- Type Selector -->
          <div class="annotations-form__field" style="margin-bottom: 16px;">
            <label class="annotations-form__label">Tipo</label>
            <div class="type-selector" id="new-annotation-type-selector">
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

          <!-- Importance Selector -->
          <div class="annotations-form__field" style="margin-bottom: 16px;">
            <label class="annotations-form__label">Importância</label>
            <div class="importance-selector" id="new-annotation-importance-selector">
              <div class="importance-option importance-option--1" data-importance="1" title="Muito Baixa">1</div>
              <div class="importance-option importance-option--2" data-importance="2" title="Baixa">2</div>
              <div class="importance-option importance-option--3 selected" data-importance="3" title="Média">3</div>
              <div class="importance-option importance-option--4" data-importance="4" title="Alta">4</div>
              <div class="importance-option importance-option--5" data-importance="5" title="Muito Alta">5</div>
            </div>
          </div>

          <!-- Due Date Range -->
          <div class="annotations-form__field" style="margin-bottom: 16px;">
            <label class="annotations-form__label">Data Limite (opcional)</label>
            <input
              type="text"
              class="annotations-form__input"
              id="new-annotation-due-date"
              placeholder="Selecione a data limite..."
              readonly
              style="cursor: pointer;"
            >
          </div>
        </div>
        <div class="annotations-modal__footer">
          <button class="annotations-form__btn annotations-form__btn--secondary" data-action="cancel">
            Cancelar
          </button>
          <button class="annotations-form__btn annotations-form__btn--primary" id="new-annotation-submit" disabled>
            Criar Anotação
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Setup event listeners for the modal
    const textArea = overlay.querySelector('#new-annotation-text') as HTMLTextAreaElement;
    const charCount = overlay.querySelector('#new-annotation-char-count');
    const submitBtn = overlay.querySelector('#new-annotation-submit') as HTMLButtonElement;

    // Character count
    textArea?.addEventListener('input', () => {
      const len = textArea.value.length;
      if (charCount) {
        charCount.textContent = `${len} / 255`;
        charCount.className = 'annotations-form__char-count' +
          (len > 240 ? ' annotations-form__char-count--warning' : '') +
          (len >= 255 ? ' annotations-form__char-count--error' : '');
      }
      if (submitBtn) {
        submitBtn.disabled = len === 0;
      }
    });

    // Type selector
    const typeSelector = overlay.querySelector('#new-annotation-type-selector');
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
    const importanceSelector = overlay.querySelector('#new-annotation-importance-selector');
    if (importanceSelector) {
      const importanceOptions = importanceSelector.querySelectorAll('.importance-option');
      importanceOptions.forEach((opt) => {
        opt.addEventListener('click', () => {
          importanceOptions.forEach((o) => o.classList.remove('selected'));
          opt.classList.add('selected');
        });
      });
    }

    // Initialize DateRangePicker for due date (using same start/end for single date)
    const dueDateInput = overlay.querySelector('#new-annotation-due-date') as HTMLInputElement;
    if (dueDateInput) {
      try {
        this.modalDateRangePicker = await createDateRangePicker(dueDateInput, {
          includeTime: true,
          timePrecision: 'minute',
          locale: 'pt-BR',
          parentEl: overlay.querySelector('.annotations-modal') as HTMLElement,
          onApply: (result) => {
            // Store the selected date/time in the input
            dueDateInput.setAttribute('data-due-date', result.startISO);
          },
        });
      } catch (error) {
        console.warn('[AnnotationsTab] Modal DateRangePicker initialization failed:', error);
        // Fallback to native datetime-local input
        dueDateInput.type = 'datetime-local';
        dueDateInput.removeAttribute('readonly');
        dueDateInput.style.cursor = 'text';
      }
    }

    // Close handlers
    const closeModal = () => {
      this.modalDateRangePicker?.destroy?.();
      this.modalDateRangePicker = null;
      overlay.remove();
      this.newAnnotationModal = null;
    };

    overlay.querySelector('[data-action="close"]')?.addEventListener('click', closeModal);
    overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Submit handler
    submitBtn?.addEventListener('click', async () => {
      const selectedType = overlay.querySelector('.type-option.selected') as HTMLElement;
      const type = (selectedType?.dataset.type || 'observation') as AnnotationType;

      const selectedImportance = overlay.querySelector('.importance-option.selected') as HTMLElement;
      const importance = parseInt(selectedImportance?.dataset.importance || '3') as ImportanceLevel;

      // Get due date from data attribute (set by DateRangePicker onApply) or fallback input
      let dueDate: string | undefined;
      const storedDueDate = dueDateInput?.getAttribute('data-due-date');
      if (storedDueDate) {
        dueDate = storedDueDate;
      } else if (dueDateInput?.value) {
        // Fallback for native datetime-local input
        dueDate = new Date(dueDateInput.value).toISOString();
      }

      const text = textArea.value.trim();

      if (text) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvando...';
        await this.addAnnotation({ text, type, importance, dueDate });
        submitBtn.textContent = 'Criar Anotação';
        closeModal();
      }
    });

    // Focus on textarea
    textArea?.focus();
  }

  // ============================================
  // EDIT MODAL
  // ============================================

  /**
   * Show a styled input modal for editing annotation text
   * Replaces native prompt() for better UX
   */
  private showInputModal(title: string, placeholder: string, initialValue: string): Promise<string | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'annotations-input-overlay';
      overlay.innerHTML = `
        <div class="annotations-input-modal">
          <div class="annotations-input-header">
            <span class="annotations-input-icon">✏️</span>
            <span class="annotations-input-title">${title}</span>
          </div>
          <div class="annotations-input-body">
            <textarea
              class="annotations-input-textarea"
              placeholder="${placeholder}"
              maxlength="255"
            >${initialValue}</textarea>
            <div class="annotations-input-char-count">
              <span id="input-char-count">${initialValue.length}</span> / 255
            </div>
          </div>
          <div class="annotations-input-actions">
            <button class="annotations-input-btn annotations-input-btn--cancel" data-action="cancel">
              Cancelar
            </button>
            <button class="annotations-input-btn annotations-input-btn--confirm" data-action="confirm">
              Salvar
            </button>
          </div>
        </div>
      `;

      // Inject styles if not present
      if (!document.getElementById('annotations-input-styles')) {
        const style = document.createElement('style');
        style.id = 'annotations-input-styles';
        style.textContent = `
          .annotations-input-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100001;
            animation: inputFadeIn 0.2s ease;
          }
          @keyframes inputFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .annotations-input-modal {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
            overflow: hidden;
            animation: inputSlideIn 0.25s ease;
          }
          @keyframes inputSlideIn {
            from { transform: translateY(-20px) scale(0.95); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
          .annotations-input-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 16px 20px;
            background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
            border-bottom: 1px solid #5b4cdb;
          }
          .annotations-input-icon {
            font-size: 20px;
          }
          .annotations-input-title {
            font-weight: 600;
            color: white;
            font-size: 16px;
          }
          .annotations-input-body {
            padding: 20px;
          }
          .annotations-input-textarea {
            width: 100%;
            min-height: 100px;
            padding: 12px;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
            resize: vertical;
            color: #212529;
          }
          .annotations-input-textarea:focus {
            outline: none;
            border-color: #6c5ce7;
            box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.15);
          }
          .annotations-input-char-count {
            font-size: 11px;
            color: #6c757d;
            text-align: right;
            margin-top: 6px;
          }
          .annotations-input-actions {
            display: flex;
            gap: 12px;
            padding: 16px 20px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            justify-content: flex-end;
          }
          .annotations-input-btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
          }
          .annotations-input-btn--cancel {
            background: #e5e7eb;
            color: #374151;
          }
          .annotations-input-btn--cancel:hover {
            background: #d1d5db;
          }
          .annotations-input-btn--confirm {
            background: #6c5ce7;
            color: white;
          }
          .annotations-input-btn--confirm:hover {
            background: #5b4cdb;
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(overlay);

      const textarea = overlay.querySelector('.annotations-input-textarea') as HTMLTextAreaElement;
      const charCount = overlay.querySelector('#input-char-count') as HTMLSpanElement;

      // Focus and select text
      textarea.focus();
      textarea.select();

      // Update char count on input
      textarea.addEventListener('input', () => {
        charCount.textContent = String(textarea.value.length);
      });

      const cleanup = (result: string | null) => {
        overlay.remove();
        resolve(result);
      };

      overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => cleanup(null));
      overlay.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
        const value = textarea.value.trim();
        cleanup(value || null);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(null);
      });

      // Handle Enter key (Ctrl+Enter to submit)
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
          const value = textarea.value.trim();
          cleanup(value || null);
        }
        if (e.key === 'Escape') {
          cleanup(null);
        }
      });
    });
  }

  private async showEditModal(id: string): Promise<void> {
    const annotation = this.annotations.find((a) => a.id === id);
    if (!annotation) return;

    const newText = await this.showInputModal(
      'Editar Anotação',
      'Digite o novo texto da anotação...',
      annotation.text
    );

    if (newText && newText !== annotation.text) {
      await this.editAnnotation(id, { text: newText });
      this.render();
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
      if (await this.showConfirmation('Tem certeza que deseja arquivar esta anotação?', 'Arquivar Anotação')) {
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
