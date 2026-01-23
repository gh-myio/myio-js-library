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
  AuditAction,
  AnnotationsTabConfig,
  AnnotationResponse,
  ResponseType,
} from './types';

import {
  ANNOTATION_TYPE_LABELS,
  ANNOTATION_TYPE_COLORS,
  IMPORTANCE_LABELS,
  IMPORTANCE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  RESPONSE_TYPE_LABELS,
  RESPONSE_TYPE_COLORS,
  RESPONSE_TYPE_ICONS,
} from './types';

import { canModifyAnnotation } from '../../../../utils/superAdminUtils';
import { MyIOToast } from '../../../../components/MyIOToast';
import { createDateRangePicker, type DateRangeControl } from '../../../../components/createDateRangePicker';
import { ModalHeader } from '../../../../utils/ModalHeader';
import { version as LIB_VERSION } from '../../../../index';

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

/* ============================================
   PREMIUM FILTER PANEL - MYIO Academy (Light Mode Default)
   ============================================ */
.annotations-premium-filter {
  background: #ffffff;
  border-radius: 16px;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.annotations-premium-filter__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
}

.annotations-premium-filter__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.annotations-premium-filter__brand-icon {
  font-size: 20px;
}

.annotations-premium-filter__brand-text {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.5px;
}

.annotations-premium-filter__brand-badge {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: #1e293b;
  font-size: 9px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.annotations-premium-filter__toggle {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
}

.annotations-premium-filter__toggle:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Compact Create Button in Premium Filter */
.annotations-create-btn-compact {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.annotations-create-btn-compact:hover {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.annotations-create-btn-compact:active {
  transform: translateY(0);
}

/* Stats Row */
.annotations-premium-filter__stats {
  display: flex;
  gap: 8px;
  padding: 14px 20px;
  border-bottom: 1px solid #e9ecef;
  flex-wrap: wrap;
  background: #f8f9fa;
}

.annotations-premium-filter__stat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #ffffff;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e9ecef;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.annotations-premium-filter__stat:hover {
  background: #f8f9fa;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.annotations-premium-filter__stat.active {
  border-color: currentColor;
  background: rgba(108, 92, 231, 0.08);
}

.annotations-premium-filter__stat-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.annotations-premium-filter__stat-dot--pending { background: #ff6b6b; }
.annotations-premium-filter__stat-dot--maintenance { background: #ffa94d; }
.annotations-premium-filter__stat-dot--activity { background: #51cf66; }
.annotations-premium-filter__stat-dot--observation { background: #339af0; }

.annotations-premium-filter__stat-count {
  font-size: 14px;
  font-weight: 700;
  color: #212529;
}

.annotations-premium-filter__stat-label {
  font-size: 12px;
  color: #6c757d;
}

/* Filters Body */
.annotations-premium-filter__body {
  padding: 20px;
}

.annotations-premium-filter__row {
  display: flex;
  gap: 16px;
  flex-wrap: nowrap;
  align-items: stretch;
}

.annotations-premium-filter__field {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.annotations-premium-filter__field--search {
  flex: 2 1 0;
  min-width: 0;
}

.annotations-premium-filter__field--date {
  flex: 1 1 0;
  min-width: 0;
}

.annotations-premium-filter__label {
  font-size: 10px;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Multiselect in Premium Filter */
.annotations-premium-filter__multiselect {
  position: relative;
}

.annotations-premium-filter__multiselect-btn {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  color: #212529;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.annotations-premium-filter__multiselect-btn:hover {
  background: #e9ecef;
  border-color: #ced4da;
}

.annotations-premium-filter__multiselect-btn:focus {
  outline: none;
  border-color: #6c5ce7;
  box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.15);
}

.annotations-premium-filter__arrow {
  font-size: 10px;
  color: #6c757d;
  transition: transform 0.2s;
}

.annotations-premium-filter__multiselect.open .annotations-premium-filter__arrow {
  transform: rotate(180deg);
}

.annotations-premium-filter__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 999999;
  margin-top: 4px;
  display: none;
  max-height: 220px;
  overflow-y: auto;
}

.annotations-premium-filter__multiselect.open .annotations-premium-filter__dropdown {
  display: block;
}

.annotations-premium-filter__checkbox-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 12px;
  color: #212529;
  transition: background-color 0.15s;
}

.annotations-premium-filter__checkbox-item:hover {
  background: #f8f9fa;
}

.annotations-premium-filter__checkbox-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #6c5ce7;
  cursor: pointer;
}

/* Text Input in Premium Filter */
.annotations-premium-filter__input {
  width: 100%;
  height: 38px;
  padding: 0 12px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  color: #212529;
  font-size: 12px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.annotations-premium-filter__input::placeholder {
  color: #adb5bd;
}

.annotations-premium-filter__input:focus {
  outline: none;
  background: #ffffff;
  border-color: #6c5ce7;
  box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.15);
}

/* Actions Row */
.annotations-premium-filter__actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid #e9ecef;
  margin-top: 12px;
  background: #f8f9fa;
}

.annotations-premium-filter__clear-btn {
  background: transparent;
  border: 1px solid #dee2e6;
  color: #6c757d;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.annotations-premium-filter__clear-btn:hover {
  background: #e9ecef;
  color: #212529;
  border-color: #ced4da;
}

.annotations-premium-filter__result-count {
  font-size: 12px;
  color: #6c757d;
}

.annotations-premium-filter__result-count strong {
  color: #212529;
  font-weight: 600;
}

/* Footer Academy */
.annotations-premium-filter__footer {
  background: #f8f9fa;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-top: 1px solid #e9ecef;
}

.annotations-premium-filter__footer-icon {
  font-size: 14px;
}

.annotations-premium-filter__footer-text {
  font-size: 11px;
  font-weight: 600;
  color: #6c757d;
  letter-spacing: 0.3px;
}

.annotations-premium-filter__footer-version {
  font-size: 10px;
  color: #adb5bd;
  font-weight: 500;
}

/* ============================================
   PREMIUM FILTER PANEL - Dark Mode
   ============================================ */
.annotations-premium-filter--dark {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.annotations-premium-filter--dark .annotations-premium-filter__stats {
  background: transparent;
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.annotations-premium-filter--dark .annotations-premium-filter__stat {
  background: rgba(255, 255, 255, 0.08);
  border-color: transparent;
  box-shadow: none;
}

.annotations-premium-filter--dark .annotations-premium-filter__stat:hover {
  background: rgba(255, 255, 255, 0.15);
  box-shadow: none;
}

.annotations-premium-filter--dark .annotations-premium-filter__stat.active {
  background: rgba(255, 255, 255, 0.12);
}

.annotations-premium-filter--dark .annotations-premium-filter__stat-count {
  color: #fff;
}

.annotations-premium-filter--dark .annotations-premium-filter__stat-label {
  color: #94a3b8;
}

.annotations-premium-filter--dark .annotations-premium-filter__label {
  color: #64748b;
}

.annotations-premium-filter--dark .annotations-premium-filter__multiselect-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
}

.annotations-premium-filter--dark .annotations-premium-filter__multiselect-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
}

.annotations-premium-filter--dark .annotations-premium-filter__arrow {
  color: #94a3b8;
}

.annotations-premium-filter--dark .annotations-premium-filter__dropdown {
  background: #1e293b;
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.annotations-premium-filter--dark .annotations-premium-filter__checkbox-item {
  color: #e2e8f0;
}

.annotations-premium-filter--dark .annotations-premium-filter__checkbox-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.annotations-premium-filter--dark .annotations-premium-filter__input {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
}

.annotations-premium-filter--dark .annotations-premium-filter__input::placeholder {
  color: #64748b;
}

.annotations-premium-filter--dark .annotations-premium-filter__input:focus {
  background: rgba(255, 255, 255, 0.12);
}

.annotations-premium-filter--dark .annotations-premium-filter__actions {
  background: transparent;
  border-top-color: rgba(255, 255, 255, 0.1);
}

.annotations-premium-filter--dark .annotations-premium-filter__clear-btn {
  border-color: rgba(255, 255, 255, 0.2);
  color: #94a3b8;
}

.annotations-premium-filter--dark .annotations-premium-filter__clear-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}

.annotations-premium-filter--dark .annotations-premium-filter__result-count {
  color: #94a3b8;
}

.annotations-premium-filter--dark .annotations-premium-filter__result-count strong {
  color: #fff;
}

.annotations-premium-filter--dark .annotations-premium-filter__footer {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border-top-color: rgba(255, 255, 255, 0.05);
}

.annotations-premium-filter--dark .annotations-premium-filter__footer-text {
  color: #94a3b8;
}

.annotations-premium-filter--dark .annotations-premium-filter__footer-version {
  color: #64748b;
}

/* Legacy Stats Summary - kept for compatibility */
.annotations-stats {
  display: none;
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

/* Label Row with Tour Button */
.annotations-form__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.annotations-form__tour-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.annotations-form__tour-btn:hover {
  background: linear-gradient(135deg, #5b4cdb 0%, #8b7cf7 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(108, 92, 231, 0.4);
}

.annotations-form__tour-btn svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
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
  flex-wrap: wrap;
  gap: 6px;
}

.importance-option {
  flex: 1;
  min-width: 70px;
  padding: 8px 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 600;
  font-size: 11px;
  transition: all 0.2s;
  background: #fff;
  text-align: center;
  white-space: nowrap;
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
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
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
  flex-shrink: 0;
}

.annotations-grid__help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #6c5ce7;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.annotations-grid__help:hover {
  background: #5b4cdb;
  transform: scale(1.1);
}

.annotations-grid__count {
  font-size: 12px;
  color: #6c757d;
  background: #fff;
  padding: 4px 10px;
  border-radius: 12px;
  flex-shrink: 0;
}

/* Quick Search in Header */
.annotations-grid__search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 6px 12px;
  max-width: 280px;
  transition: all 0.2s;
}

.annotations-grid__search:focus-within {
  border-color: #6c5ce7;
  box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.15);
}

.annotations-grid__search-icon {
  color: #6c757d;
  font-size: 14px;
  flex-shrink: 0;
}

.annotations-grid__search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #212529;
  outline: none;
  min-width: 0;
}

.annotations-grid__search-input::placeholder {
  color: #adb5bd;
}

/* Action Buttons in Header */
.annotations-grid__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.annotations-grid__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 16px;
}

.annotations-grid__btn--filter {
  background: #f1f3f4;
  color: #495057;
}

.annotations-grid__btn--filter:hover {
  background: #e9ecef;
  color: #212529;
}

.annotations-grid__btn--filter.active {
  background: #6c5ce7;
  color: #fff;
}

.annotations-grid__btn--create {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: #fff;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
  width: auto;
  min-width: 140px;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.annotations-grid__btn--create:hover {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.4);
}

.annotations-grid__btn--create:active {
  transform: translateY(0);
}

/* Icon Buttons (SVG based) */
.annotations-grid__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: #f1f3f4;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.annotations-grid__icon-btn svg {
  fill: #495057;
  transition: fill 0.2s;
}

.annotations-grid__icon-btn:hover {
  background: #e9ecef;
}

.annotations-grid__icon-btn:hover svg {
  fill: #212529;
}

.annotations-grid__icon-btn.active {
  background: #6c5ce7;
}

.annotations-grid__icon-btn.active svg {
  fill: #fff;
}

/* Search Container (always visible) */
.annotations-grid__search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 6px 10px;
  min-width: 180px;
  max-width: 250px;
  flex: 1;
}

.annotations-grid__search-icon {
  color: #6c757d;
  flex-shrink: 0;
}

.annotations-grid__search:focus-within {
  border-color: #6c5ce7;
  box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.15);
}

.annotations-grid__search:focus-within .annotations-grid__search-icon {
  color: #6c5ce7;
}

.annotations-grid__search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #212529;
  outline: none;
  min-width: 0;
  width: 100%;
}

.annotations-grid__search-input::placeholder {
  color: #adb5bd;
}

/* Clear Search Button */
.annotations-grid__search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: #e9ecef;
  border-radius: 50%;
  color: #495057;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.annotations-grid__search-clear:hover {
  background: #6c5ce7;
  color: #fff;
}

/* ============================================
   FILTER MODAL OVERLAY
   ============================================ */
.annotations-filter-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 999998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: annotationsFilterFadeIn 0.2s ease;
}

@keyframes annotationsFilterFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.annotations-filter-modal {
  background: transparent;
  border-radius: 16px;
  width: 100%;
  max-width: 700px;
  min-height: 620px;
  max-height: 90vh;
  overflow: visible;
  animation: annotationsFilterSlideIn 0.3s ease;
}

@keyframes annotationsFilterSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.annotations-filter-modal__close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.1);
  border: none;
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  z-index: 10;
}

.annotations-filter-modal__close:hover {
  background: rgba(0, 0, 0, 0.2);
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
  position: relative;
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

.annotation-card__ack--approved {
  background: #d4edda;
  color: #155724;
}

.annotation-card__ack--rejected {
  background: #f8d7da;
  color: #721c24;
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
  justify-content: space-around;
  gap: 4px;
  padding-top: 10px;
  border-top: 1px solid #e9ecef;
  width: 100%;
}

.annotation-card__btn {
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  background: #f1f3f5;
  color: #495057;
  flex: 1;
  text-align: center;
}

.annotation-card__btn:hover:not(:disabled) {
  background: #e9ecef;
}

.annotation-card__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.annotation-card__btn--edit:hover:not(:disabled) {
  background: #e8f4fd;
  color: #0984e3;
}

.annotation-card__btn--archive:hover:not(:disabled) {
  background: #fff3cd;
  color: #856404;
}

.annotation-card__btn--history {
  position: relative;
}

.annotation-card__btn--history:hover:not(:disabled) {
  background: #e0e7ff;
  color: #4338ca;
}

.annotation-card__btn--comment {
  background: #e0f2fe;
  color: #0284c7;
  border: 1px solid #bae6fd;
}

.annotation-card__btn--comment:hover:not(:disabled) {
  background: #bae6fd;
  color: #0369a1;
  border-color: #7dd3fc;
}

/* History count badge */
.annotation-card__btn-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #6c5ce7;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* RFC-0104 Amendment: Approve/Reject buttons */
.annotation-card__btn--approve {
  background: #d1fae5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.annotation-card__btn--approve:hover:not(:disabled) {
  background: #a7f3d0;
  color: #047857;
  border-color: #6ee7b7;
}

.annotation-card__btn--reject {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.annotation-card__btn--reject:hover:not(:disabled) {
  background: #fecaca;
  color: #dc2626;
  border-color: #fca5a5;
}

/* Response Modal Styles */
.response-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  opacity: 0;
  transition: opacity 0.2s;
}

.response-modal-overlay--visible {
  opacity: 1;
}

.response-modal {
  background: #fff;
  border-radius: 16px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  transform: scale(0.9);
  transition: transform 0.2s;
}

.response-modal-overlay--visible .response-modal {
  transform: scale(1);
}

.response-modal__header {
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 12px;
}

.response-modal__header--approve {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
}

.response-modal__header--reject {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
}

.response-modal__header--comment {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
}

.response-modal__header--archive {
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
}

.response-modal__icon {
  font-size: 24px;
}

.response-modal__title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.response-modal__body {
  padding: 20px;
}

.response-modal__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.response-modal__label--required::after {
  content: ' *';
  color: #dc2626;
}

.response-modal__textarea {
  width: 100%;
  min-height: 100px;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  font-family: inherit;
}

.response-modal__textarea:focus {
  outline: none;
  border-color: #6c5ce7;
  box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.15);
}

.response-modal__char-count {
  font-size: 11px;
  color: #9ca3af;
  text-align: right;
  margin-top: 4px;
}

.response-modal__char-count--warning {
  color: #f59e0b;
}

.response-modal__char-count--error {
  color: #dc2626;
}

.response-modal__footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.response-modal__btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.response-modal__btn--cancel {
  background: #e5e7eb;
  color: #4b5563;
}

.response-modal__btn--cancel:hover {
  background: #d1d5db;
}

.response-modal__btn--approve {
  background: #10b981;
  color: #fff;
}

.response-modal__btn--approve:hover {
  background: #059669;
}

.response-modal__btn--reject {
  background: #ef4444;
  color: #fff;
}

.response-modal__btn--reject:hover {
  background: #dc2626;
}

.response-modal__btn--comment {
  background: #0284c7;
  color: #fff;
}

.response-modal__btn--comment:hover {
  background: #0369a1;
}

.response-modal__btn--archive-modal {
  background: #6b7280;
  color: #fff;
}

.response-modal__btn--archive-modal:hover {
  background: #4b5563;
}

.response-modal__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Help Tooltip */
.annotation-help-tooltip {
  position: fixed;
  z-index: 100001;
  background: #1e293b;
  color: #f1f5f9;
  border-radius: 12px;
  padding: 16px;
  max-width: 360px;
  min-width: 320px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  font-size: 13px;
  line-height: 1.5;
}

.annotation-help-tooltip__title {
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.annotation-help-tooltip__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}

.annotation-help-tooltip__item:last-child {
  margin-bottom: 0;
}

.annotation-help-tooltip__icon {
  flex-shrink: 0;
  font-size: 14px;
}

.annotation-help-tooltip__icon--approve {
  color: #10b981;
}

.annotation-help-tooltip__icon--reject {
  color: #ef4444;
}

.annotation-help-tooltip__section {
  margin-bottom: 12px;
}

.annotation-help-tooltip__section:last-child {
  margin-bottom: 0;
}

.annotation-help-tooltip__section-title {
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  color: #94a3b8;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #334155;
}

.annotation-help-tooltip__rule {
  font-size: 12px;
  color: #cbd5e1;
  margin-bottom: 4px;
  padding-left: 4px;
}

.annotation-help-tooltip__rule:last-child {
  margin-bottom: 0;
}

/* Response Display in Card */
.annotation-card__responses {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
}

.annotation-card__response {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 6px;
  font-size: 12px;
}

.annotation-card__response:last-child {
  margin-bottom: 0;
}

.annotation-card__response--approved {
  background: #ecfdf5;
  border-left: 3px solid #10b981;
}

.annotation-card__response--rejected {
  background: #fef2f2;
  border-left: 3px solid #ef4444;
}

.annotation-card__response-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.annotation-card__response-content {
  flex: 1;
}

.annotation-card__response-text {
  color: #374151;
  margin-bottom: 4px;
}

.annotation-card__response-meta {
  color: #9ca3af;
  font-size: 11px;
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
  backdrop-filter: blur(2px);
}

.annotation-detail-modal {
  background: #fff;
  border-radius: 10px;
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
}

.annotation-detail-modal * {
  box-sizing: border-box;
}

.annotation-detail__content {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

/* Badge Row - Tipo, Importância, Status */
.annotation-detail__badges-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e9ecef;
}

.annotation-detail__badge-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.annotation-detail__badge-label {
  font-size: 9px;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
}

.annotation-detail__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.annotation-detail__field {
  margin-bottom: 12px;
}

.annotation-detail__label {
  font-size: 9px;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.annotation-detail__value {
  font-size: 12px;
  color: #212529;
  line-height: 1.4;
}

.annotation-detail__description {
  background: #f8f9fa;
  padding: 10px;
  border-radius: 6px;
  font-size: 12px;
  color: #212529;
  line-height: 1.5;
  white-space: pre-wrap;
}

.annotation-detail__history {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e9ecef;
}

.annotation-detail__history-title {
  font-size: 10px;
  font-weight: 600;
  color: #6c757d;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.annotation-detail__history-item {
  font-size: 10px;
  color: #6c757d;
  padding: 4px 0;
  border-bottom: 1px solid #f1f3f4;
}

/* Response boxes (approved/rejected/archived) */
.annotation-detail__response-box {
  padding: 10px;
  border-radius: 6px;
  margin-top: 8px;
}

.annotation-detail__response-box .annotation-detail__label {
  font-size: 9px;
}

.annotation-detail__response-box .annotation-detail__value {
  font-size: 11px;
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

/* Responsive badges - stack on small screens */
@media (max-width: 480px) {
  .annotation-detail-overlay {
    padding: 8px;
    box-sizing: border-box;
  }

  .annotation-detail-modal {
    width: calc(100% - 16px) !important;
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    margin: 0 auto;
    box-sizing: border-box;
  }

  .annotation-detail-modal * {
    box-sizing: border-box;
  }

  .annotation-detail__content {
    padding: 12px;
  }

  .annotation-detail__badges-row {
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
    padding-bottom: 10px;
  }

  .annotation-detail__badge-group {
    flex: none;
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #f8f9fa;
    border-radius: 6px;
  }

  .annotation-detail__badge-label {
    font-size: 10px;
    margin-bottom: 0;
  }

  .annotation-detail__field {
    margin-bottom: 10px;
  }

  .annotation-detail__description {
    padding: 8px;
    font-size: 11px;
  }

  .annotation-detail__history {
    margin-top: 12px;
    padding-top: 10px;
  }

  .annotation-detail__footer {
    padding: 12px;
    flex-direction: column;
    gap: 8px;
  }

  .annotation-detail__btn {
    width: 100%;
    padding: 12px 16px;
    font-size: 14px;
  }
}

/* ============================================
   ONBOARDING TOUR STYLES (RFC-0144)
   ============================================ */

.annotation-tour-highlight {
  outline: 3px solid #6c5ce7 !important;
  outline-offset: 4px !important;
  border-radius: 8px !important;
  animation: annotationTourPulse 1.5s ease-in-out infinite !important;
}

@keyframes annotationTourPulse {
  0%, 100% { outline-color: #6c5ce7; outline-width: 3px; }
  50% { outline-color: #a29bfe; outline-width: 5px; }
}

/* Tour Popover - Light Mode (default) */
.annotation-tour-popover {
  position: fixed;
  z-index: 999999;
  background: #ffffff;
  color: #212529;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.08);
  max-width: 340px;
  min-width: 280px;
  animation: annotationTourSlideIn 0.3s ease;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

@keyframes annotationTourSlideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.annotation-tour-popover__arrow {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #ffffff;
  transform: rotate(45deg);
  box-shadow: -2px -2px 4px rgba(0, 0, 0, 0.05);
}

.annotation-tour-popover__arrow--top {
  top: -6px;
  left: 50%;
  margin-left: -6px;
}

.annotation-tour-popover__arrow--bottom {
  bottom: -6px;
  left: 50%;
  margin-left: -6px;
}

.annotation-tour-popover__arrow--left {
  right: -6px;
  top: 50%;
  margin-top: -6px;
}

.annotation-tour-popover__arrow--right {
  left: -6px;
  top: 50%;
  margin-top: -6px;
}

.annotation-tour-popover__header {
  padding: 16px 16px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.annotation-tour-popover__icon {
  font-size: 24px;
}

.annotation-tour-popover__title {
  font-size: 16px;
  font-weight: 600;
  color: #6c5ce7;
}

.annotation-tour-popover__step {
  font-size: 11px;
  color: #6c757d;
  margin-left: auto;
  background: #f1f3f5;
  padding: 2px 8px;
  border-radius: 10px;
}

.annotation-tour-popover__body {
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.6;
  color: #495057;
}

.annotation-tour-popover__footer {
  padding: 12px 16px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  border-top: 1px solid #e9ecef;
}

.annotation-tour-popover__nav {
  display: flex;
  gap: 8px;
}

.annotation-tour-popover__btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.annotation-tour-popover__btn--skip {
  background: transparent;
  color: #6c757d;
}

.annotation-tour-popover__btn--skip:hover {
  color: #212529;
  background: #f1f3f5;
}

.annotation-tour-popover__btn--prev {
  background: #f1f3f5;
  color: #495057;
}

.annotation-tour-popover__btn--prev:hover {
  background: #e9ecef;
}

.annotation-tour-popover__btn--next {
  background: #6c5ce7;
  color: #fff;
}

.annotation-tour-popover__btn--next:hover {
  background: #5b4cdb;
}

.annotation-tour-popover__btn--finish {
  background: #10b981;
  color: #fff;
}

.annotation-tour-popover__btn--finish:hover {
  background: #059669;
}

.annotation-tour-popover__progress {
  display: flex;
  gap: 4px;
  justify-content: center;
  padding: 0 16px 12px;
}

.annotation-tour-popover__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #dee2e6;
  transition: all 0.2s;
}

.annotation-tour-popover__dot--active {
  background: #6c5ce7;
  width: 16px;
  border-radius: 3px;
}

/* MYIO Academy Footer - Light Mode */
.annotation-tour-popover__academy {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 10px 16px;
  border-top: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 0 0 12px 12px;
}

.annotation-tour-popover__academy-icon {
  font-size: 16px;
}

.annotation-tour-popover__academy-text {
  font-size: 12px;
  font-weight: 600;
  color: #495057;
  letter-spacing: 0.5px;
}

.annotation-tour-popover__academy-version {
  font-size: 10px;
  color: #adb5bd;
  font-weight: 500;
  opacity: 0.8;
}

/* Tour Highlight for elements - Spotlight effect with box-shadow */
.tour-highlight {
  position: relative !important;
  z-index: 1000001 !important;
  border-radius: 8px;
  outline: 3px solid #6c5ce7 !important;
  outline-offset: 4px;
  animation: annotationTourPulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6) !important;
}

/* Main tour highlight (for annotations tab) */
.annotation-tour-highlight {
  position: relative !important;
  z-index: 1000001 !important;
  border-radius: 8px;
  outline: 3px solid #6c5ce7 !important;
  outline-offset: 4px;
  animation: annotationTourPulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6) !important;
}

/* Tour Backdrop - Now just for click blocking, transparent */
.annotation-tour-backdrop {
  position: fixed;
  inset: 0;
  background: transparent;
  z-index: 999997;
  pointer-events: none;
}

/* Modal-specific popover (higher z-index) */
.annotation-tour-popover--modal {
  z-index: 1000002;
}

/* Modal-specific backdrop (higher z-index for modals) */
.annotation-tour-backdrop--modal {
  z-index: 999999;
}

/* ============================================
   DARK MODE SUPPORT FOR TOUR
   ============================================ */
.annotation-tour-popover--dark {
  background: #1e293b;
  color: #fff;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.annotation-tour-popover--dark .annotation-tour-popover__arrow {
  background: #1e293b;
  box-shadow: none;
}

.annotation-tour-popover--dark .annotation-tour-popover__title {
  color: #a78bfa;
}

.annotation-tour-popover--dark .annotation-tour-popover__step {
  color: #94a3b8;
  background: #334155;
}

.annotation-tour-popover--dark .annotation-tour-popover__body {
  color: #e2e8f0;
}

.annotation-tour-popover--dark .annotation-tour-popover__footer {
  border-top-color: #334155;
}

.annotation-tour-popover--dark .annotation-tour-popover__btn--skip {
  color: #94a3b8;
}

.annotation-tour-popover--dark .annotation-tour-popover__btn--skip:hover {
  color: #fff;
  background: #334155;
}

.annotation-tour-popover--dark .annotation-tour-popover__btn--prev {
  background: #334155;
  color: #fff;
}

.annotation-tour-popover--dark .annotation-tour-popover__btn--prev:hover {
  background: #475569;
}

.annotation-tour-popover--dark .annotation-tour-popover__dot {
  background: #475569;
}

.annotation-tour-popover--dark .annotation-tour-popover__dot--active {
  background: #a78bfa;
}

.annotation-tour-popover--dark .annotation-tour-popover__academy {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-top-color: #334155;
}

.annotation-tour-popover--dark .annotation-tour-popover__academy-text {
  color: #e2e8f0;
}

/* Welcome modal for first-run - Light Mode */
.annotation-tour-welcome {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999998;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.annotation-tour-welcome__modal {
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  animation: annotationTourSlideIn 0.3s ease;
}

.annotation-tour-welcome__icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.annotation-tour-welcome__title {
  font-size: 22px;
  font-weight: 600;
  color: #212529;
  margin-bottom: 12px;
}

.annotation-tour-welcome__description {
  font-size: 14px;
  color: #6c757d;
  line-height: 1.6;
  margin-bottom: 24px;
}

.annotation-tour-welcome__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.annotation-tour-welcome__btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.annotation-tour-welcome__btn--later {
  background: #f1f3f5;
  color: #6c757d;
}

.annotation-tour-welcome__btn--later:hover {
  background: #e9ecef;
  color: #212529;
}

.annotation-tour-welcome__btn--start {
  background: #6c5ce7;
  color: #fff;
}

.annotation-tour-welcome__btn--start:hover {
  background: #5b4cdb;
}

.annotation-tour-welcome__academy {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 12px 24px;
  border-top: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 0 0 16px 16px;
  margin-top: 20px;
  margin-left: -32px;
  margin-right: -32px;
  margin-bottom: -32px;
}

.annotation-tour-welcome__academy-icon {
  font-size: 20px;
}

.annotation-tour-welcome__academy-text {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
  letter-spacing: 0.5px;
}

.annotation-tour-welcome__academy-version {
  font-size: 11px;
  color: #adb5bd;
  font-weight: 500;
  opacity: 0.8;
}

/* Header tour button */
.annotation-tour-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(108, 92, 231, 0.1);
  color: #6c5ce7;
  border: 1px solid rgba(108, 92, 231, 0.3);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.annotation-tour-button:hover {
  background: rgba(108, 92, 231, 0.2);
  border-color: #6c5ce7;
}
`;

// ============================================
// ONBOARDING TOUR STEPS DEFINITION
// ============================================

interface TourStep {
  target: string;
  icon: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const ANNOTATION_TOUR_STEPS: TourStep[] = [
  // Header with title and description
  {
    target: '.annotations-header',
    icon: '📋',
    title: 'Anotações do Dispositivo',
    content: 'Bem-vindo ao sistema de anotações! Aqui você pode registrar observações, pendências, manutenções e atividades sobre o dispositivo.',
    position: 'bottom',
  },
  // Grid Header
  {
    target: '.annotations-grid__header',
    icon: '🔧',
    title: 'Barra de Ferramentas',
    content: 'Esta barra contém a <strong>busca rápida</strong>, botão de <strong>filtros avançados</strong> e botão para <strong>criar nova anotação</strong>.',
    position: 'bottom',
  },
  // Quick Search
  {
    target: '.annotations-grid__search',
    icon: '🔍',
    title: 'Busca Rápida',
    content: 'Digite para buscar anotações pelo texto. A busca é feita em tempo real enquanto você digita.',
    position: 'bottom',
  },
  // Filter Button
  {
    target: '#open-filter-modal',
    icon: '🎛️',
    title: 'Filtros Avançados',
    content: 'Clique para abrir os <strong>Filtros Avançados</strong>. Filtre por tipo, status, importância ou período.',
    position: 'bottom',
  },
  // Create Button
  {
    target: '#grid-create-btn',
    icon: '➕',
    title: 'Criar Nova Anotação',
    content: 'Clique no botão <strong>+</strong> para criar uma nova anotação. Você poderá escolher o tipo, importância e adicionar uma data limite.',
    position: 'bottom',
  },
  // Grid
  {
    target: '.annotations-grid',
    icon: '📋',
    title: 'Lista de Anotações',
    content: 'Aqui você visualiza todas as anotações registradas. Cada card mostra tipo, importância, status e as ações disponíveis.',
    position: 'top',
  },
  {
    target: '.annotations-grid__help',
    icon: '❓',
    title: 'Ajuda Rápida',
    content: 'Clique no botão <strong>?</strong> a qualquer momento para ver uma explicação detalhada de todas as ações disponíveis.',
    position: 'left',
  },
  // Individual Action Steps
  {
    target: '.annotation-card__actions',
    icon: '🎯',
    title: 'Ações Disponíveis',
    content: 'Cada anotação possui botões de ação. Vamos conhecer cada um deles nos próximos passos.',
    position: 'top',
  },
  {
    target: '.annotation-card__btn--edit',
    icon: '✏️',
    title: 'Editar Anotação',
    content: 'Clique para <strong>modificar</strong> o conteúdo, tipo, importância ou data de vencimento da anotação. Apenas o criador ou administradores podem editar.',
    position: 'top',
  },
  {
    target: '.annotation-card__btn--archive',
    icon: '⬇️',
    title: 'Arquivar Anotação',
    content: 'Use para <strong>arquivar</strong> anotações concluídas ou que não são mais relevantes. Anotações arquivadas ficam ocultas por padrão, mas podem ser visualizadas com filtros.',
    position: 'top',
  },
  {
    target: '.annotation-card__btn--approve',
    icon: '✓',
    title: 'Aprovar Anotação',
    content: 'Clique para <strong>aprovar</strong> uma anotação. Você pode adicionar um comentário opcional. A aprovação fica registrada com seu nome e data.',
    position: 'top',
  },
  {
    target: '.annotation-card__btn--reject',
    icon: '✗',
    title: 'Rejeitar Anotação',
    content: 'Use para <strong>rejeitar</strong> uma anotação. É obrigatório informar o motivo da rejeição. O autor será notificado sobre a rejeição.',
    position: 'top',
  },
  {
    target: '.annotation-card__btn--comment',
    icon: '💬',
    title: 'Adicionar Comentário',
    content: 'Adicione <strong>comentários</strong> para discussões, esclarecimentos ou atualizações sem alterar o conteúdo original da anotação.',
    position: 'top',
  },
  {
    target: '.annotation-card__btn--history',
    icon: '📜',
    title: 'Ver Histórico',
    content: 'Visualize o <strong>histórico completo</strong> de alterações: quem criou, editou, aprovou ou rejeitou, com data e hora de cada ação.',
    position: 'top',
  },
];

// Tour steps for New Annotation Modal
const NEW_ANNOTATION_TOUR_STEPS: TourStep[] = [
  {
    target: '#new-annotation-text',
    icon: '✏️',
    title: 'Texto da Anotação',
    content: 'Digite aqui o conteúdo da sua anotação. Seja claro e objetivo. O limite é de <strong>255 caracteres</strong>.',
    position: 'bottom',
  },
  {
    target: '#new-annotation-type-selector',
    icon: '🏷️',
    title: 'Tipo de Anotação',
    content: '<strong>Pendência:</strong> algo a ser resolvido<br><strong>Manutenção:</strong> serviço técnico<br><strong>Atividade:</strong> ação realizada<br><strong>Observação:</strong> informação geral',
    position: 'bottom',
  },
  {
    target: '#new-annotation-importance-selector',
    icon: '⭐',
    title: 'Nível de Importância',
    content: 'Defina a prioridade de <strong>1 (Muito Baixa)</strong> a <strong>5 (Muito Alta)</strong>. Isso ajuda a organizar e priorizar as anotações.',
    position: 'bottom',
  },
  {
    target: '#new-annotation-due-date',
    icon: '📅',
    title: 'Data Limite',
    content: 'Opcional. Defina uma data limite para anotações que precisam de acompanhamento. Anotações vencidas serão <strong>destacadas em vermelho</strong>.',
    position: 'top',
  },
  {
    target: '#new-annotation-submit',
    icon: '✅',
    title: 'Criar Anotação',
    content: 'Após preencher os campos, clique aqui para <strong>salvar</strong> a anotação. O botão só fica ativo quando o texto é preenchido.',
    position: 'top',
  },
];

const TOUR_STORAGE_KEY = 'myio_annotations_tour_completed';
const TOUR_VERSION = '1.3.0'; // v1.3.0: Updated targets for new header layout with search, filter modal button, and create button

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

  // Onboarding Tour State (RFC-0144)
  private tourCurrentStep: number = 0;
  private tourPopover: HTMLElement | null = null;
  private tourBackdrop: HTMLElement | null = null;
  private tourActive: boolean = false;

  // New Annotation Modal Tour State
  private newAnnotationTourStep: number = 0;
  private newAnnotationTourPopover: HTMLElement | null = null;
  private newAnnotationTourBackdrop: HTMLElement | null = null;
  private newAnnotationTourActive: boolean = false;

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
    // RFC-0144: Onboarding is triggered via onTabActivated() when user switches to this tab
  }

  public destroy(): void {
    this.endTour();
    this.styleElement?.remove();
    this.container.innerHTML = '';
  }

  // ============================================
  // ONBOARDING TOUR METHODS (RFC-0144)
  // ============================================

  /**
   * Check if this is the user's first time using annotations
   * Only triggers when the Annotations tab is actually visible in Settings modal
   */
  private checkFirstRunOnboarding(): void {
    const storageKey = `${TOUR_STORAGE_KEY}_${this.deviceId}`;
    const stored = localStorage.getItem(storageKey);

    // Only show onboarding if container is visible (tab is active)
    const isVisible = this.container.offsetParent !== null;
    if (!isVisible) {
      return; // Tab not visible, don't show tour yet
    }

    if (!stored) {
      // First run - show welcome modal after a short delay
      setTimeout(() => this.showWelcomeModal(), 500);
    } else {
      try {
        const data = JSON.parse(stored);
        // Check if version changed (show tour for new features)
        if (data.version !== TOUR_VERSION) {
          setTimeout(() => this.showWelcomeModal(), 500);
        }
      } catch {
        // Invalid data, show welcome
        setTimeout(() => this.showWelcomeModal(), 500);
      }
    }
  }

  /**
   * Called when the Annotations tab becomes visible/active
   * This is the entry point for showing the onboarding tour
   */
  public onTabActivated(): void {
    this.checkFirstRunOnboarding();
  }

  /**
   * Mark the tour as completed in localStorage
   */
  private markTourCompleted(): void {
    const storageKey = `${TOUR_STORAGE_KEY}_${this.deviceId}`;
    localStorage.setItem(storageKey, JSON.stringify({
      version: TOUR_VERSION,
      completedAt: new Date().toISOString(),
      userId: this.currentUser.id,
    }));
  }

  /**
   * Show the welcome modal for first-time users
   */
  private showWelcomeModal(): void {
    const modal = document.createElement('div');
    modal.className = 'annotation-tour-welcome';
    modal.innerHTML = `
      <div class="annotation-tour-welcome__modal">
        <div class="annotation-tour-welcome__icon">📝</div>
        <h2 class="annotation-tour-welcome__title">Bem-vindo às Anotações!</h2>
        <p class="annotation-tour-welcome__description">
          Este é seu primeiro acesso ao sistema de anotações.
          Gostaria de fazer um tour rápido para conhecer as funcionalidades?
        </p>
        <div class="annotation-tour-welcome__actions">
          <button class="annotation-tour-welcome__btn annotation-tour-welcome__btn--later" data-action="later">
            Depois
          </button>
          <button class="annotation-tour-welcome__btn annotation-tour-welcome__btn--start" data-action="start">
            Iniciar Tour
          </button>
        </div>
        <div class="annotation-tour-welcome__academy">
          <span class="annotation-tour-welcome__academy-icon">🎓</span>
          <span class="annotation-tour-welcome__academy-text">MYIO Academy</span>
          <span class="annotation-tour-welcome__academy-version">v${LIB_VERSION}</span>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Bind events
    modal.querySelector('[data-action="later"]')?.addEventListener('click', () => {
      modal.remove();
      this.markTourCompleted();
    });

    modal.querySelector('[data-action="start"]')?.addEventListener('click', () => {
      modal.remove();
      this.startTour();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        this.markTourCompleted();
      }
    });
  }

  /**
   * Start the guided tour
   */
  public startTour(): void {
    if (this.tourActive) return;

    // Verify container is visible and has content
    if (!this.container || this.container.offsetParent === null) {
      console.warn('[Tour] Container not visible, cannot start tour');
      return;
    }

    // Verify the annotations header exists (first step target)
    const header = this.container.querySelector('.annotations-header');
    if (!header) {
      console.warn('[Tour] Header not found, waiting for render...');
      // Re-render and try again after a short delay
      this.render();
      setTimeout(() => {
        if (this.container.querySelector('.annotations-header')) {
          this.startTourInternal();
        } else {
          console.error('[Tour] Header still not found after re-render');
        }
      }, 100);
      return;
    }

    this.startTourInternal();
  }

  /**
   * Internal method to actually start the tour
   */
  private startTourInternal(): void {
    this.tourActive = true;
    this.tourCurrentStep = 0;

    // Create backdrop overlay
    this.tourBackdrop = document.createElement('div');
    this.tourBackdrop.className = 'annotation-tour-backdrop';
    document.body.appendChild(this.tourBackdrop);

    this.showTourStep(0);
  }

  /**
   * Show a specific tour step
   */
  private showTourStep(stepIndex: number): void {
    // Remove previous highlight and popover
    this.clearTourElements();

    if (stepIndex < 0 || stepIndex >= ANNOTATION_TOUR_STEPS.length) {
      this.endTour();
      return;
    }

    const step = ANNOTATION_TOUR_STEPS[stepIndex];
    const target = this.container.querySelector(step.target) as HTMLElement;

    if (!target) {
      // Skip to next step if target not found
      if (stepIndex < ANNOTATION_TOUR_STEPS.length - 1) {
        this.showTourStep(stepIndex + 1);
      } else {
        this.endTour();
      }
      return;
    }

    this.tourCurrentStep = stepIndex;

    // Scroll target into view
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Wait for scroll, then show highlight
    setTimeout(() => {
      // Add highlight to target
      target.classList.add('annotation-tour-highlight');

      // Create and position popover
      this.createTourPopover(step, target, stepIndex);
    }, 300);
  }

  /**
   * Create the tour popover
   */
  private createTourPopover(step: TourStep, target: HTMLElement, stepIndex: number): void {
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === ANNOTATION_TOUR_STEPS.length - 1;
    const totalSteps = ANNOTATION_TOUR_STEPS.length;

    const popover = document.createElement('div');
    popover.className = 'annotation-tour-popover';

    // Progress dots
    const dots = Array.from({ length: totalSteps }, (_, i) =>
      `<div class="annotation-tour-popover__dot ${i === stepIndex ? 'annotation-tour-popover__dot--active' : ''}"></div>`
    ).join('');

    popover.innerHTML = `
      <div class="annotation-tour-popover__arrow annotation-tour-popover__arrow--${step.position === 'top' ? 'bottom' : step.position === 'bottom' ? 'top' : step.position}"></div>
      <div class="annotation-tour-popover__header">
        <span class="annotation-tour-popover__icon">${step.icon}</span>
        <span class="annotation-tour-popover__title">${step.title}</span>
        <span class="annotation-tour-popover__step">${stepIndex + 1}/${totalSteps}</span>
      </div>
      <div class="annotation-tour-popover__body">${step.content}</div>
      <div class="annotation-tour-popover__progress">${dots}</div>
      <div class="annotation-tour-popover__footer">
        <button class="annotation-tour-popover__btn annotation-tour-popover__btn--skip" data-action="skip">
          Pular Tour
        </button>
        <div style="display: flex; gap: 8px;">
          ${!isFirst ? '<button class="annotation-tour-popover__btn annotation-tour-popover__btn--prev" data-action="prev">Anterior</button>' : ''}
          <button class="annotation-tour-popover__btn ${isLast ? 'annotation-tour-popover__btn--finish' : 'annotation-tour-popover__btn--next'}" data-action="${isLast ? 'finish' : 'next'}">
            ${isLast ? 'Concluir' : 'Próximo'}
          </button>
        </div>
      </div>
      <div class="annotation-tour-popover__academy">
        <span class="annotation-tour-popover__academy-icon">🎓</span>
        <span class="annotation-tour-popover__academy-text">MYIO Academy</span>
        <span class="annotation-tour-popover__academy-version">v${LIB_VERSION}</span>
      </div>
    `;

    document.body.appendChild(popover);
    this.tourPopover = popover;

    // Position popover
    this.positionPopover(popover, target, step.position);

    // Bind events
    popover.querySelector('[data-action="skip"]')?.addEventListener('click', () => this.endTour());
    popover.querySelector('[data-action="prev"]')?.addEventListener('click', () => this.showTourStep(stepIndex - 1));
    popover.querySelector('[data-action="next"]')?.addEventListener('click', () => this.showTourStep(stepIndex + 1));
    popover.querySelector('[data-action="finish"]')?.addEventListener('click', () => this.endTour());
  }

  /**
   * Position the popover relative to the target element
   */
  private positionPopover(popover: HTMLElement, target: HTMLElement, position: string): void {
    const targetRect = target.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const gap = 12;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = targetRect.top - popoverRect.height - gap;
        left = targetRect.left + (targetRect.width - popoverRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + (targetRect.width - popoverRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - popoverRect.height) / 2;
        left = targetRect.left - popoverRect.width - gap;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - popoverRect.height) / 2;
        left = targetRect.right + gap;
        break;
    }

    // Keep popover within viewport
    const padding = 10;
    top = Math.max(padding, Math.min(top, window.innerHeight - popoverRect.height - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - popoverRect.width - padding));

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  /**
   * Clear tour elements (highlight, popover)
   */
  private clearTourElements(): void {
    // Remove highlight from all elements
    this.container.querySelectorAll('.annotation-tour-highlight').forEach(el => {
      el.classList.remove('annotation-tour-highlight');
    });

    // Remove popover
    this.tourPopover?.remove();
    this.tourPopover = null;
  }

  /**
   * End the tour
   */
  private endTour(): void {
    this.clearTourElements();

    // Remove backdrop
    this.tourBackdrop?.remove();
    this.tourBackdrop = null;

    this.tourActive = false;
    this.tourCurrentStep = 0;
    this.markTourCompleted();
  }

  /**
   * Reset the tour (for testing or user request)
   */
  public resetTour(): void {
    const storageKey = `${TOUR_STORAGE_KEY}_${this.deviceId}`;
    localStorage.removeItem(storageKey);
  }

  /**
   * Close all active tours (main tour and new annotation tour)
   */
  private closeAllTours(): void {
    if (this.tourActive) {
      this.endTour();
    }
    if (this.newAnnotationTourActive) {
      this.endNewAnnotationTour();
    }
  }

  // ============================================
  // NEW ANNOTATION MODAL TOUR
  // ============================================

  /**
   * Start the tour for the New Annotation modal
   */
  private startNewAnnotationTour(): void {
    if (this.newAnnotationTourActive) return;

    this.newAnnotationTourActive = true;
    this.newAnnotationTourStep = 0;

    // Create backdrop overlay (with higher z-index for modal context)
    this.newAnnotationTourBackdrop = document.createElement('div');
    this.newAnnotationTourBackdrop.className = 'annotation-tour-backdrop annotation-tour-backdrop--modal';
    document.body.appendChild(this.newAnnotationTourBackdrop);

    this.showNewAnnotationTourStep();
  }

  /**
   * Show current step of the New Annotation tour
   */
  private showNewAnnotationTourStep(): void {
    // Remove previous popover
    this.newAnnotationTourPopover?.remove();

    const steps = NEW_ANNOTATION_TOUR_STEPS;
    if (this.newAnnotationTourStep >= steps.length) {
      this.endNewAnnotationTour();
      return;
    }

    const step = steps[this.newAnnotationTourStep];
    const modal = this.newAnnotationModal;
    if (!modal) {
      this.endNewAnnotationTour();
      return;
    }

    const targetEl = modal.querySelector(step.target) as HTMLElement;
    if (!targetEl) {
      // Skip to next step if target not found
      this.newAnnotationTourStep++;
      this.showNewAnnotationTourStep();
      return;
    }

    // Highlight target
    targetEl.style.position = 'relative';
    targetEl.style.zIndex = '1000001';
    targetEl.classList.add('tour-highlight');

    // Create popover
    const popover = document.createElement('div');
    popover.className = 'annotation-tour-popover annotation-tour-popover--modal';

    // Determine arrow position based on popover position
    const arrowPosition = step.position === 'top' ? 'bottom' : step.position === 'bottom' ? 'top' : step.position;

    // Progress dots (migalhas)
    const dots = Array.from({ length: steps.length }, (_, i) =>
      `<div class="annotation-tour-popover__dot ${i === this.newAnnotationTourStep ? 'annotation-tour-popover__dot--active' : ''}"></div>`
    ).join('');

    const isFirst = this.newAnnotationTourStep === 0;
    const isLast = this.newAnnotationTourStep === steps.length - 1;

    popover.innerHTML = `
      <div class="annotation-tour-popover__arrow annotation-tour-popover__arrow--${arrowPosition}"></div>
      <div class="annotation-tour-popover__header">
        <span class="annotation-tour-popover__icon">${step.icon}</span>
        <span class="annotation-tour-popover__title">${step.title}</span>
        <span class="annotation-tour-popover__step">${this.newAnnotationTourStep + 1}/${steps.length}</span>
      </div>
      <div class="annotation-tour-popover__body">${step.content}</div>
      <div class="annotation-tour-popover__progress">${dots}</div>
      <div class="annotation-tour-popover__footer">
        <button class="annotation-tour-popover__btn annotation-tour-popover__btn--skip" data-action="skip">
          Pular Tour
        </button>
        <div class="annotation-tour-popover__nav">
          ${!isFirst ? '<button class="annotation-tour-popover__btn annotation-tour-popover__btn--prev" data-action="prev">Anterior</button>' : ''}
          <button class="annotation-tour-popover__btn ${isLast ? 'annotation-tour-popover__btn--finish' : 'annotation-tour-popover__btn--next'}" data-action="${isLast ? 'finish' : 'next'}">
            ${isLast ? 'Concluir' : 'Próximo'}
          </button>
        </div>
      </div>
      <div class="annotation-tour-popover__academy">
        <span class="annotation-tour-popover__academy-icon">🎓</span>
        <span class="annotation-tour-popover__academy-text">MYIO Academy</span>
        <span class="annotation-tour-popover__academy-version">v${LIB_VERSION}</span>
      </div>
    `;

    document.body.appendChild(popover);
    this.newAnnotationTourPopover = popover;

    // Position popover
    this.positionNewAnnotationTourPopover(popover, targetEl, step.position);

    // Event listeners
    popover.querySelector('[data-action="next"]')?.addEventListener('click', () => {
      this.clearNewAnnotationTourHighlight();
      this.newAnnotationTourStep++;
      this.showNewAnnotationTourStep();
    });

    popover.querySelector('[data-action="prev"]')?.addEventListener('click', () => {
      this.clearNewAnnotationTourHighlight();
      this.newAnnotationTourStep--;
      this.showNewAnnotationTourStep();
    });

    popover.querySelector('[data-action="skip"]')?.addEventListener('click', () => this.endNewAnnotationTour());
    popover.querySelector('[data-action="finish"]')?.addEventListener('click', () => this.endNewAnnotationTour());
  }

  /**
   * Position the tour popover relative to target element
   */
  private positionNewAnnotationTourPopover(
    popover: HTMLElement,
    target: HTMLElement,
    position: 'top' | 'bottom' | 'left' | 'right'
  ): void {
    const targetRect = target.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const gap = 12;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + (targetRect.width / 2) - (popoverRect.width / 2);
        break;
      case 'top':
        top = targetRect.top - popoverRect.height - gap;
        left = targetRect.left + (targetRect.width / 2) - (popoverRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (popoverRect.height / 2);
        left = targetRect.left - popoverRect.width - gap;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (popoverRect.height / 2);
        left = targetRect.right + gap;
        break;
    }

    // Keep within viewport
    const padding = 10;
    left = Math.max(padding, Math.min(left, window.innerWidth - popoverRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - popoverRect.height - padding));

    popover.style.position = 'fixed';
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.zIndex = '1000002';
  }

  /**
   * Clear highlight from current tour target
   */
  private clearNewAnnotationTourHighlight(): void {
    const modal = this.newAnnotationModal;
    if (!modal) return;

    modal.querySelectorAll('.tour-highlight').forEach((el) => {
      (el as HTMLElement).style.zIndex = '';
      (el as HTMLElement).style.position = '';
      el.classList.remove('tour-highlight');
    });
  }

  /**
   * End the New Annotation modal tour
   */
  private endNewAnnotationTour(): void {
    this.clearNewAnnotationTourHighlight();
    this.newAnnotationTourPopover?.remove();
    this.newAnnotationTourPopover = null;

    // Remove backdrop
    this.newAnnotationTourBackdrop?.remove();
    this.newAnnotationTourBackdrop = null;

    this.newAnnotationTourActive = false;
    this.newAnnotationTourStep = 0;
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
      responses: [],
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
  // RFC-0104 AMENDMENT: APPROVE/REJECT RESPONSES
  // ============================================

  /**
   * Render responses (approve/reject) for an annotation
   */
  private renderResponses(annotation: Annotation): string {
    const responses = annotation.responses || [];
    if (responses.length === 0) return '';

    return `
      <div class="annotation-card__responses">
        ${responses.map(response => `
          <div class="annotation-card__response annotation-card__response--${response.type}">
            <span class="annotation-card__response-icon">${RESPONSE_TYPE_ICONS[response.type]}</span>
            <div class="annotation-card__response-content">
              ${response.text ? `<div class="annotation-card__response-text">${response.text}</div>` : ''}
              <div class="annotation-card__response-meta">
                ${RESPONSE_TYPE_LABELS[response.type]} por ${response.createdBy.name} em ${this.formatDate(response.createdAt)}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Open modal for approve/reject response
   */
  private openResponseModal(annotationId: string, type: ResponseType): void {
    // Close any active tour before showing response modal
    this.closeAllTours();

    const annotation = this.annotations.find(a => a.id === annotationId);
    if (!annotation) return;

    const isApprove = type === 'approved';
    const isReject = type === 'rejected';
    const isComment = type === 'comment';

    // Configure modal based on type
    let title: string;
    let icon: string;
    let headerClass: string;
    let btnClass: string;
    let labelText: string;
    let labelClass: string;
    let placeholder: string;
    let confirmText: string;
    let isRequired: boolean;

    if (isApprove) {
      title = 'Aprovar Anotação';
      icon = '✓';
      headerClass = 'response-modal__header--approve';
      btnClass = 'response-modal__btn--approve';
      labelText = 'Observação (opcional)';
      labelClass = '';
      placeholder = 'Adicione uma observação se desejar...';
      confirmText = 'Aprovar';
      isRequired = false;
    } else if (isReject) {
      title = 'Rejeitar Anotação';
      icon = '✗';
      headerClass = 'response-modal__header--reject';
      btnClass = 'response-modal__btn--reject';
      labelText = 'Justificativa';
      labelClass = 'response-modal__label--required';
      placeholder = 'Explique o motivo da rejeição (obrigatório)';
      confirmText = 'Rejeitar';
      isRequired = true;
    } else if (isComment) {
      // Comment
      title = 'Adicionar Comentário';
      icon = '💬';
      headerClass = 'response-modal__header--comment';
      btnClass = 'response-modal__btn--comment';
      labelText = 'Comentário';
      labelClass = 'response-modal__label--required';
      placeholder = 'Digite seu comentário...';
      confirmText = 'Comentar';
      isRequired = true;
    } else {
      // Archived
      title = 'Arquivar Anotação';
      icon = '⬇️';
      headerClass = 'response-modal__header--archive';
      btnClass = 'response-modal__btn--archive-modal';
      labelText = 'Justificativa';
      labelClass = 'response-modal__label--required';
      placeholder = 'Explique o motivo do arquivamento (obrigatório)';
      confirmText = 'Arquivar';
      isRequired = true;
    }

    const overlay = document.createElement('div');
    overlay.className = 'response-modal-overlay';
    overlay.innerHTML = `
      <div class="response-modal">
        <div class="response-modal__header ${headerClass}">
          <span class="response-modal__icon">${icon}</span>
          <span class="response-modal__title">${title}</span>
        </div>
        <div class="response-modal__body">
          <label class="response-modal__label ${labelClass}">${labelText}</label>
          <textarea
            class="response-modal__textarea"
            id="response-text"
            maxlength="255"
            placeholder="${placeholder}"
          ></textarea>
          <div class="response-modal__char-count">
            <span id="char-count">0</span>/255
          </div>
        </div>
        <div class="response-modal__footer">
          <button class="response-modal__btn response-modal__btn--cancel" data-action="cancel">Cancelar</button>
          <button class="response-modal__btn ${btnClass}" data-action="confirm" ${isRequired ? 'disabled' : ''}>
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    // Add to document body (to escape any modal stacking context)
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('response-modal-overlay--visible');
    });

    // Get elements
    const textarea = overlay.querySelector('#response-text') as HTMLTextAreaElement;
    const charCount = overlay.querySelector('#char-count') as HTMLSpanElement;
    const confirmBtn = overlay.querySelector('[data-action="confirm"]') as HTMLButtonElement;
    const cancelBtn = overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement;

    // Character count and validation
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCount.textContent = String(len);

      const countContainer = charCount.parentElement;
      if (countContainer) {
        countContainer.classList.remove('response-modal__char-count--warning', 'response-modal__char-count--error');
        if (len > 240) {
          countContainer.classList.add('response-modal__char-count--error');
        } else if (len > 200) {
          countContainer.classList.add('response-modal__char-count--warning');
        }
      }

      // For reject and comment, require text
      if (isRequired) {
        confirmBtn.disabled = len === 0;
      }
    });

    // Cancel handler
    cancelBtn.addEventListener('click', () => {
      overlay.classList.remove('response-modal-overlay--visible');
      setTimeout(() => overlay.remove(), 200);
    });

    // Confirm handler
    confirmBtn.addEventListener('click', async () => {
      const text = textarea.value.trim();

      // Validate for reject
      if (!isApprove && !text) {
        MyIOToast.show('Justificativa é obrigatória para rejeição.', 'error');
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Salvando...';

      await this.addResponse(annotationId, type, text);

      overlay.classList.remove('response-modal-overlay--visible');
      setTimeout(() => overlay.remove(), 200);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('response-modal-overlay--visible');
        setTimeout(() => overlay.remove(), 200);
      }
    });

    // Close on Escape
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        overlay.classList.remove('response-modal-overlay--visible');
        setTimeout(() => overlay.remove(), 200);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Focus textarea
    setTimeout(() => textarea.focus(), 100);
  }

  /**
   * Add a response to an annotation
   */
  private async addResponse(annotationId: string, type: ResponseType, text: string): Promise<void> {
    const index = this.annotations.findIndex(a => a.id === annotationId);
    if (index === -1) return;

    const annotation = this.annotations[index];
    const now = new Date().toISOString();

    const response: AnnotationResponse = {
      id: generateUUID(),
      annotationId,
      type,
      text,
      createdAt: now,
      createdBy: this.currentUser,
    };

    // Map response type to audit action
    const auditAction = type === 'comment' ? 'commented' : type;

    const auditEntry: AuditEntry = {
      timestamp: now,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      userEmail: this.currentUser.email,
      action: auditAction as AuditAction,
      previousVersion: annotation.version,
    };

    // For archive type, also set status to archived
    const newStatus = type === 'archived' ? 'archived' : annotation.status;

    // Only mark as acknowledged for approve/reject (finalizing actions)
    const shouldMarkAcknowledged = type === 'approved' || type === 'rejected';

    const updatedAnnotation: Annotation = {
      ...annotation,
      version: annotation.version + 1,
      status: newStatus,
      acknowledged: shouldMarkAcknowledged ? true : annotation.acknowledged,
      acknowledgedBy: shouldMarkAcknowledged ? this.currentUser : annotation.acknowledgedBy,
      acknowledgedAt: shouldMarkAcknowledged ? now : annotation.acknowledgedAt,
      responses: [...(annotation.responses || []), response],
      history: [...annotation.history, auditEntry],
    };

    this.annotations[index] = updatedAnnotation;
    const success = await this.saveAnnotations();

    if (success) {
      const actionLabels: Record<ResponseType, string> = {
        approved: 'aprovada',
        rejected: 'rejeitada',
        comment: 'comentário adicionado',
        archived: 'arquivada',
      };
      MyIOToast.show(`Anotação ${actionLabels[type]} com sucesso!`, 'success');
      this.render();
    } else {
      this.annotations[index] = annotation;
      MyIOToast.show('Erro ao salvar resposta. Tente novamente.', 'error');
    }
  }

  /**
   * Show help tooltip for approve/reject actions
   */
  private showHelpTooltip(anchor: HTMLElement): void {
    // Remove existing tooltip
    const existing = document.querySelector('.annotation-help-tooltip');
    if (existing) {
      existing.remove();
      return; // Toggle off if clicking again
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'annotation-help-tooltip';
    tooltip.innerHTML = `
      <div class="annotation-help-tooltip__title">
        <span>ℹ️</span>
        <span>Ajuda - Ações da Anotação</span>
      </div>
      <div class="annotation-help-tooltip__section">
        <div class="annotation-help-tooltip__section-title">Botões de Ação:</div>
        <div class="annotation-help-tooltip__item">
          <span class="annotation-help-tooltip__icon">✏️</span>
          <div><strong>Editar:</strong> Modifica o texto da anotação</div>
        </div>
        <div class="annotation-help-tooltip__item">
          <span class="annotation-help-tooltip__icon">⬇️</span>
          <div><strong>Arquivar:</strong> Move para histórico de arquivados</div>
        </div>
        <div class="annotation-help-tooltip__item">
          <span class="annotation-help-tooltip__icon annotation-help-tooltip__icon--approve">✓</span>
          <div><strong>Aprovar:</strong> Confirma revisão (observação opcional)</div>
        </div>
        <div class="annotation-help-tooltip__item">
          <span class="annotation-help-tooltip__icon annotation-help-tooltip__icon--reject">✗</span>
          <div><strong>Rejeitar:</strong> Indica problema (justificativa obrigatória)</div>
        </div>
        <div class="annotation-help-tooltip__item">
          <span class="annotation-help-tooltip__icon">📜</span>
          <div><strong>Histórico:</strong> Ver detalhes e observações</div>
        </div>
      </div>
      <div class="annotation-help-tooltip__section">
        <div class="annotation-help-tooltip__section-title">Regras de Estado:</div>
        <div class="annotation-help-tooltip__rule">
          • Após <strong>aprovar</strong> ou <strong>rejeitar</strong>, a anotação é finalizada
        </div>
        <div class="annotation-help-tooltip__rule">
          • Anotações finalizadas não podem ser editadas ou arquivadas
        </div>
        <div class="annotation-help-tooltip__rule">
          • Observações/justificativas ficam visíveis no histórico
        </div>
      </div>
    `;

    document.body.appendChild(tooltip);

    // Position near anchor
    const rect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.bottom + 10;

    // Keep within viewport
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top + tooltipRect.height > window.innerHeight - 10) {
      top = rect.top - tooltipRect.height - 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // Close on click outside
    const closeHandler = (e: MouseEvent) => {
      if (!tooltip.contains(e.target as Node) && e.target !== anchor) {
        tooltip.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 100);

    // Close on Escape
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        tooltip.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
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
        ${this.renderGrid()}
        ${this.renderPagination()}
      </div>
    `;

    this.attachEventListeners();
    this.attachGridHeaderListeners();
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
        <button class="annotation-tour-button" data-action="start-tour" title="Iniciar tour guiado">
          🎓 Tour
        </button>
      </div>
    `;
  }

  /**
   * Renders the Premium Filter Panel - MYIO Academy
   * Consolidates stats and filters into a single premium component
   */
  private renderPremiumFilter(): string {
    const stats = {
      pending: this.annotations.filter(a => a.type === 'pending' && a.status !== 'archived').length,
      maintenance: this.annotations.filter(a => a.type === 'maintenance' && a.status !== 'archived').length,
      activity: this.annotations.filter(a => a.type === 'activity' && a.status !== 'archived').length,
      observation: this.annotations.filter(a => a.type === 'observation' && a.status !== 'archived').length,
    };

    const totalFiltered = this.getFilteredAnnotations().length;
    const totalAnnotations = this.annotations.filter(a => a.status !== 'archived').length;

    return `
      <div class="annotations-premium-filter">
        <!-- Header with MYIO Academy branding -->
        <div class="annotations-premium-filter__header">
          <div class="annotations-premium-filter__brand">
            <span class="annotations-premium-filter__brand-icon">🔍</span>
            <span class="annotations-premium-filter__brand-text">Filtros Avançados</span>
            <span class="annotations-premium-filter__brand-badge">Premium</span>
          </div>
          <button type="button" class="annotations-create-btn-compact" id="open-new-annotation-modal-premium" title="Criar Nova Anotação">
            <span>➕</span>
            <span>Nova</span>
          </button>
        </div>

        <!-- Stats Row - Clickable type chips -->
        <div class="annotations-premium-filter__stats">
          <div class="annotations-premium-filter__stat ${this.isTypeFilterActive('pending') ? 'active' : ''}" data-filter-type="pending" style="color: #ff6b6b;">
            <span class="annotations-premium-filter__stat-dot annotations-premium-filter__stat-dot--pending"></span>
            <span class="annotations-premium-filter__stat-count">${stats.pending}</span>
            <span class="annotations-premium-filter__stat-label">Pendência(s)</span>
          </div>
          <div class="annotations-premium-filter__stat ${this.isTypeFilterActive('maintenance') ? 'active' : ''}" data-filter-type="maintenance" style="color: #ffa94d;">
            <span class="annotations-premium-filter__stat-dot annotations-premium-filter__stat-dot--maintenance"></span>
            <span class="annotations-premium-filter__stat-count">${stats.maintenance}</span>
            <span class="annotations-premium-filter__stat-label">Manutenção(ões)</span>
          </div>
          <div class="annotations-premium-filter__stat ${this.isTypeFilterActive('activity') ? 'active' : ''}" data-filter-type="activity" style="color: #51cf66;">
            <span class="annotations-premium-filter__stat-dot annotations-premium-filter__stat-dot--activity"></span>
            <span class="annotations-premium-filter__stat-count">${stats.activity}</span>
            <span class="annotations-premium-filter__stat-label">Atividade(s)</span>
          </div>
          <div class="annotations-premium-filter__stat ${this.isTypeFilterActive('observation') ? 'active' : ''}" data-filter-type="observation" style="color: #339af0;">
            <span class="annotations-premium-filter__stat-dot annotations-premium-filter__stat-dot--observation"></span>
            <span class="annotations-premium-filter__stat-count">${stats.observation}</span>
            <span class="annotations-premium-filter__stat-label">Observação(ões)</span>
          </div>
        </div>

        <!-- Filters Body -->
        <div class="annotations-premium-filter__body">
          <div class="annotations-premium-filter__row">
            <!-- Status Multiselect -->
            <div class="annotations-premium-filter__field">
              <label class="annotations-premium-filter__label">Status</label>
              <div class="annotations-premium-filter__multiselect">
                <button type="button" class="annotations-premium-filter__multiselect-btn" id="premium-filter-status-btn">
                  <span>${this.getStatusFilterLabel()}</span>
                  <span class="annotations-premium-filter__arrow">▼</span>
                </button>
                <div class="annotations-premium-filter__dropdown" id="premium-filter-status-dropdown">
                  <label class="annotations-premium-filter__checkbox-item">
                    <input type="checkbox" name="premium-filter-status" value="all" ${!this.filters.statusList || this.filters.statusList.length === 0 ? 'checked' : ''}>
                    <span>Todos</span>
                  </label>
                  <label class="annotations-premium-filter__checkbox-item">
                    <input type="checkbox" name="premium-filter-status" value="created" ${this.filters.statusList?.includes('created') ? 'checked' : ''}>
                    <span>${STATUS_LABELS.created}</span>
                  </label>
                  <label class="annotations-premium-filter__checkbox-item">
                    <input type="checkbox" name="premium-filter-status" value="modified" ${this.filters.statusList?.includes('modified') ? 'checked' : ''}>
                    <span>${STATUS_LABELS.modified}</span>
                  </label>
                  <label class="annotations-premium-filter__checkbox-item">
                    <input type="checkbox" name="premium-filter-status" value="archived" ${this.filters.statusList?.includes('archived') ? 'checked' : ''}>
                    <span>${STATUS_LABELS.archived}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Importance Multiselect -->
            <div class="annotations-premium-filter__field">
              <label class="annotations-premium-filter__label">Importância</label>
              <div class="annotations-premium-filter__multiselect">
                <button type="button" class="annotations-premium-filter__multiselect-btn" id="premium-filter-importance-btn">
                  <span>${this.getImportanceFilterLabel()}</span>
                  <span class="annotations-premium-filter__arrow">▼</span>
                </button>
                <div class="annotations-premium-filter__dropdown" id="premium-filter-importance-dropdown">
                  <label class="annotations-premium-filter__checkbox-item">
                    <input type="checkbox" name="premium-filter-importance" value="all" ${!this.filters.importanceList || this.filters.importanceList.length === 0 ? 'checked' : ''}>
                    <span>Todas</span>
                  </label>
                  <label class="annotations-premium-filter__checkbox-item">
                    <input type="checkbox" name="premium-filter-importance" value="1" ${this.filters.importanceList?.includes(1) ? 'checked' : ''}>
                    <span>${IMPORTANCE_LABELS[1]}</span>
                  </label>
                  <label class="annotations-premium-filter__checkbox-item">
                    <input type="checkbox" name="premium-filter-importance" value="2" ${this.filters.importanceList?.includes(2) ? 'checked' : ''}>
                    <span>${IMPORTANCE_LABELS[2]}</span>
                  </label>
                  <label class="annotations-premium-filter__checkbox-item">
                    <input type="checkbox" name="premium-filter-importance" value="3" ${this.filters.importanceList?.includes(3) ? 'checked' : ''}>
                    <span>${IMPORTANCE_LABELS[3]}</span>
                  </label>
                  <label class="annotations-premium-filter__checkbox-item">
                    <input type="checkbox" name="premium-filter-importance" value="4" ${this.filters.importanceList?.includes(4) ? 'checked' : ''}>
                    <span>${IMPORTANCE_LABELS[4]}</span>
                  </label>
                  <label class="annotations-premium-filter__checkbox-item">
                    <input type="checkbox" name="premium-filter-importance" value="5" ${this.filters.importanceList?.includes(5) ? 'checked' : ''}>
                    <span>${IMPORTANCE_LABELS[5]}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Date Range Filter -->
            <div class="annotations-premium-filter__field annotations-premium-filter__field--date">
              <label class="annotations-premium-filter__label">Período</label>
              <input
                type="text"
                class="annotations-premium-filter__input"
                id="premium-filter-date-range"
                placeholder="Selecionar período..."
                readonly
              >
            </div>

            <!-- Search -->
            <div class="annotations-premium-filter__field annotations-premium-filter__field--search">
              <label class="annotations-premium-filter__label">Buscar</label>
              <input
                type="text"
                class="annotations-premium-filter__input"
                id="premium-filter-search"
                placeholder="Buscar por texto..."
                value="${this.filters.searchText || ''}"
              >
            </div>
          </div>

          <!-- Actions Row -->
          <div class="annotations-premium-filter__actions">
            <button type="button" class="annotations-premium-filter__clear-btn" id="premium-clear-filters">
              🗑️ Limpar Filtros
            </button>
            <div class="annotations-premium-filter__result-count">
              Exibindo <strong>${totalFiltered}</strong> de <strong>${totalAnnotations}</strong> anotações
            </div>
          </div>
        </div>

        <!-- Footer Academy -->
        <div class="annotations-premium-filter__footer">
          <span class="annotations-premium-filter__footer-icon">🎓</span>
          <span class="annotations-premium-filter__footer-text">MYIO Academy</span>
          <span class="annotations-premium-filter__footer-badge">Premium</span>
        </div>
      </div>
    `;
  }

  /**
   * Check if a type filter is currently active
   */
  private isTypeFilterActive(type: string): boolean {
    return this.filters.typeList?.includes(type as any) || false;
  }

  /**
   * Attach event listeners for the premium filter panel
   */
  private attachPremiumFilterListeners(): void {
    // Stat chips click - toggle type filter
    this.container.querySelectorAll('.annotations-premium-filter__stat').forEach((stat) => {
      stat.addEventListener('click', () => {
        const type = stat.getAttribute('data-filter-type') as any;
        if (type) {
          this.toggleTypeFilter(type);
        }
      });
    });

    // Multiselect buttons
    this.container.querySelectorAll('.annotations-premium-filter__multiselect-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const multiselect = btn.closest('.annotations-premium-filter__multiselect');
        if (multiselect) {
          // Close others
          this.container.querySelectorAll('.annotations-premium-filter__multiselect.open').forEach((el) => {
            if (el !== multiselect) el.classList.remove('open');
          });
          multiselect.classList.toggle('open');
        }
      });
    });

    // Status checkboxes
    this.container.querySelectorAll('input[name="premium-filter-status"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => this.handlePremiumStatusFilterChange());
    });

    // Importance checkboxes
    this.container.querySelectorAll('input[name="premium-filter-importance"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => this.handlePremiumImportanceFilterChange());
    });

    // Search input
    const searchInput = this.container.querySelector('#premium-filter-search') as HTMLInputElement;
    if (searchInput) {
      let debounceTimer: ReturnType<typeof setTimeout>;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.filters.searchText = searchInput.value;
          this.applyFilters();
        }, 300);
      });
    }

    // Clear filters button
    const clearBtn = this.container.querySelector('#premium-clear-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAllFilters());
    }

    // Create button in premium filter
    const createBtn = this.container.querySelector('#open-new-annotation-modal-premium');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showNewAnnotationModal());
    }

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.annotations-premium-filter__multiselect')) {
        this.container.querySelectorAll('.annotations-premium-filter__multiselect.open').forEach((el) => {
          el.classList.remove('open');
        });
      }
    });
  }

  /**
   * Toggle a type filter on/off
   */
  private toggleTypeFilter(type: string): void {
    if (!this.filters.typeList) {
      this.filters.typeList = [];
    }

    const index = this.filters.typeList.indexOf(type as any);
    if (index >= 0) {
      this.filters.typeList.splice(index, 1);
    } else {
      this.filters.typeList.push(type as any);
    }

    this.applyFilters();
  }

  /**
   * Handle status filter change in premium filter
   */
  private handlePremiumStatusFilterChange(): void {
    const checkboxes = this.container.querySelectorAll('input[name="premium-filter-status"]') as NodeListOf<HTMLInputElement>;
    const allCheckbox = this.container.querySelector('input[name="premium-filter-status"][value="all"]') as HTMLInputElement;
    const selectedValues: string[] = [];

    checkboxes.forEach((cb) => {
      if (cb.value !== 'all' && cb.checked) {
        selectedValues.push(cb.value);
      }
    });

    // If "all" is checked or nothing selected, clear filter
    if (allCheckbox?.checked || selectedValues.length === 0) {
      this.filters.statusList = [];
      checkboxes.forEach((cb) => {
        cb.checked = cb.value === 'all';
      });
    } else {
      this.filters.statusList = selectedValues as any[];
      if (allCheckbox) allCheckbox.checked = false;
    }

    // Update button label
    const btn = this.container.querySelector('#premium-filter-status-btn span:first-child');
    if (btn) btn.textContent = this.getStatusFilterLabel();

    this.applyFilters();
  }

  /**
   * Handle importance filter change in premium filter
   */
  private handlePremiumImportanceFilterChange(): void {
    const checkboxes = this.container.querySelectorAll('input[name="premium-filter-importance"]') as NodeListOf<HTMLInputElement>;
    const allCheckbox = this.container.querySelector('input[name="premium-filter-importance"][value="all"]') as HTMLInputElement;
    const selectedValues: number[] = [];

    checkboxes.forEach((cb) => {
      if (cb.value !== 'all' && cb.checked) {
        selectedValues.push(parseInt(cb.value, 10));
      }
    });

    // If "all" is checked or nothing selected, clear filter
    if (allCheckbox?.checked || selectedValues.length === 0) {
      this.filters.importanceList = [];
      checkboxes.forEach((cb) => {
        cb.checked = cb.value === 'all';
      });
    } else {
      this.filters.importanceList = selectedValues as any[];
      if (allCheckbox) allCheckbox.checked = false;
    }

    // Update button label
    const btn = this.container.querySelector('#premium-filter-importance-btn span:first-child');
    if (btn) btn.textContent = this.getImportanceFilterLabel();

    this.applyFilters();
  }

  /**
   * Clear all filters
   */
  private clearAllFilters(): void {
    this.filters = {
      statusList: [],
      typeList: [],
      importanceList: [],
      searchText: '',
      dateRange: undefined,
    };
    this.pagination.currentPage = 1;
    this.refreshView();
  }

  /**
   * Apply filters and refresh the view
   */
  private applyFilters(): void {
    this.pagination.currentPage = 1;
    this.refreshView();
  }

  /**
   * Refresh the view, preserving focus on search input if active
   */
  private refreshView(): void {
    // Check if search input is focused before re-render
    const searchInput = this.container.querySelector('#grid-quick-search') as HTMLInputElement;
    const wasSearchFocused = document.activeElement === searchInput;
    const searchValue = searchInput?.value || '';
    const cursorPosition = searchInput?.selectionStart || 0;

    this.render();

    // Restore focus if it was on search input
    if (wasSearchFocused) {
      const newSearchInput = this.container.querySelector('#grid-quick-search') as HTMLInputElement;
      if (newSearchInput) {
        newSearchInput.focus();
        newSearchInput.setSelectionRange(cursorPosition, cursorPosition);
      }
    }
  }

  /**
   * Check if any filters are currently active
   */
  private hasActiveFilters(): boolean {
    return (
      (this.filters.statusList && this.filters.statusList.length > 0) ||
      (this.filters.typeList && this.filters.typeList.length > 0) ||
      (this.filters.importanceList && this.filters.importanceList.length > 0) ||
      !!this.filters.searchText ||
      !!this.filters.dateRange
    );
  }

  /**
   * Attach event listeners for the grid header elements
   */
  private attachGridHeaderListeners(): void {
    // Quick search input
    const searchInput = this.container.querySelector('#grid-quick-search') as HTMLInputElement;
    if (searchInput) {
      let debounceTimer: ReturnType<typeof setTimeout>;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.filters.searchText = searchInput.value;
          this.applyFilters();
        }, 300);
      });
    }

    // Clear search button
    const clearSearchBtn = this.container.querySelector('#clear-search');
    if (clearSearchBtn && searchInput) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.filters.searchText = '';
        this.applyFilters();
        searchInput.focus();
      });
    }

    // Filter modal button
    const filterBtn = this.container.querySelector('#open-filter-modal');
    if (filterBtn) {
      filterBtn.addEventListener('click', () => this.showFilterModal());
    }

    // Create button
    const createBtn = this.container.querySelector('#grid-create-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showNewAnnotationModal());
    }
  }

  // =========================================
  // FILTER MODAL
  // =========================================

  private filterModal: HTMLElement | null = null;

  private showFilterModal(): void {
    // Close any active tour before showing filter modal
    this.closeAllTours();

    // Remove existing modal if present
    this.filterModal?.remove();

    const stats = {
      pending: this.annotations.filter(a => a.type === 'pending' && a.status !== 'archived').length,
      maintenance: this.annotations.filter(a => a.type === 'maintenance' && a.status !== 'archived').length,
      activity: this.annotations.filter(a => a.type === 'activity' && a.status !== 'archived').length,
      observation: this.annotations.filter(a => a.type === 'observation' && a.status !== 'archived').length,
    };

    const totalFiltered = this.getFilteredAnnotations().length;
    const totalAnnotations = this.annotations.filter(a => a.status !== 'archived').length;

    const overlay = document.createElement('div');
    overlay.className = 'annotations-filter-modal-overlay';
    this.filterModal = overlay;

    overlay.innerHTML = `
      <div class="annotations-filter-modal">
        <div class="annotations-premium-filter" style="position: relative;">
          <button type="button" class="annotations-filter-modal__close" data-action="close">&times;</button>

          <!-- Header -->
          <div class="annotations-premium-filter__header">
            <div class="annotations-premium-filter__brand">
              <span class="annotations-premium-filter__brand-icon">🔍</span>
              <span class="annotations-premium-filter__brand-text">Filtros Avançados</span>
            </div>
          </div>

          <!-- Stats Row - Clickable type chips -->
          <div class="annotations-premium-filter__stats">
            <div class="annotations-premium-filter__stat ${this.isTypeFilterActive('pending') ? 'active' : ''}" data-filter-type="pending" style="color: #ff6b6b;">
              <span class="annotations-premium-filter__stat-dot annotations-premium-filter__stat-dot--pending"></span>
              <span class="annotations-premium-filter__stat-count">${stats.pending}</span>
              <span class="annotations-premium-filter__stat-label">Pendência(s)</span>
            </div>
            <div class="annotations-premium-filter__stat ${this.isTypeFilterActive('maintenance') ? 'active' : ''}" data-filter-type="maintenance" style="color: #ffa94d;">
              <span class="annotations-premium-filter__stat-dot annotations-premium-filter__stat-dot--maintenance"></span>
              <span class="annotations-premium-filter__stat-count">${stats.maintenance}</span>
              <span class="annotations-premium-filter__stat-label">Manutenção(ões)</span>
            </div>
            <div class="annotations-premium-filter__stat ${this.isTypeFilterActive('activity') ? 'active' : ''}" data-filter-type="activity" style="color: #51cf66;">
              <span class="annotations-premium-filter__stat-dot annotations-premium-filter__stat-dot--activity"></span>
              <span class="annotations-premium-filter__stat-count">${stats.activity}</span>
              <span class="annotations-premium-filter__stat-label">Atividade(s)</span>
            </div>
            <div class="annotations-premium-filter__stat ${this.isTypeFilterActive('observation') ? 'active' : ''}" data-filter-type="observation" style="color: #339af0;">
              <span class="annotations-premium-filter__stat-dot annotations-premium-filter__stat-dot--observation"></span>
              <span class="annotations-premium-filter__stat-count">${stats.observation}</span>
              <span class="annotations-premium-filter__stat-label">Observação(ões)</span>
            </div>
          </div>

          <!-- Filters Body -->
          <div class="annotations-premium-filter__body">
            <div class="annotations-premium-filter__row">
              <!-- Status Multiselect -->
              <div class="annotations-premium-filter__field">
                <label class="annotations-premium-filter__label">Status</label>
                <div class="annotations-premium-filter__multiselect">
                  <button type="button" class="annotations-premium-filter__multiselect-btn" id="modal-filter-status-btn">
                    <span>${this.getStatusFilterLabel()}</span>
                    <span class="annotations-premium-filter__arrow">▼</span>
                  </button>
                  <div class="annotations-premium-filter__dropdown" id="modal-filter-status-dropdown">
                    <label class="annotations-premium-filter__checkbox-item">
                      <input type="checkbox" name="modal-filter-status" value="all" ${!this.filters.statusList || this.filters.statusList.length === 0 ? 'checked' : ''}>
                      <span>Todos</span>
                    </label>
                    <label class="annotations-premium-filter__checkbox-item">
                      <input type="checkbox" name="modal-filter-status" value="created" ${this.filters.statusList?.includes('created') ? 'checked' : ''}>
                      <span>${STATUS_LABELS.created}</span>
                    </label>
                    <label class="annotations-premium-filter__checkbox-item">
                      <input type="checkbox" name="modal-filter-status" value="modified" ${this.filters.statusList?.includes('modified') ? 'checked' : ''}>
                      <span>${STATUS_LABELS.modified}</span>
                    </label>
                    <label class="annotations-premium-filter__checkbox-item">
                      <input type="checkbox" name="modal-filter-status" value="archived" ${this.filters.statusList?.includes('archived') ? 'checked' : ''}>
                      <span>${STATUS_LABELS.archived}</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Importance Multiselect -->
              <div class="annotations-premium-filter__field">
                <label class="annotations-premium-filter__label">Importância</label>
                <div class="annotations-premium-filter__multiselect">
                  <button type="button" class="annotations-premium-filter__multiselect-btn" id="modal-filter-importance-btn">
                    <span>${this.getImportanceFilterLabel()}</span>
                    <span class="annotations-premium-filter__arrow">▼</span>
                  </button>
                  <div class="annotations-premium-filter__dropdown" id="modal-filter-importance-dropdown">
                    <label class="annotations-premium-filter__checkbox-item">
                      <input type="checkbox" name="modal-filter-importance" value="all" ${!this.filters.importanceList || this.filters.importanceList.length === 0 ? 'checked' : ''}>
                      <span>Todas</span>
                    </label>
                    <label class="annotations-premium-filter__checkbox-item">
                      <input type="checkbox" name="modal-filter-importance" value="1" ${this.filters.importanceList?.includes(1) ? 'checked' : ''}>
                      <span>${IMPORTANCE_LABELS[1]}</span>
                    </label>
                    <label class="annotations-premium-filter__checkbox-item">
                      <input type="checkbox" name="modal-filter-importance" value="2" ${this.filters.importanceList?.includes(2) ? 'checked' : ''}>
                      <span>${IMPORTANCE_LABELS[2]}</span>
                    </label>
                    <label class="annotations-premium-filter__checkbox-item">
                      <input type="checkbox" name="modal-filter-importance" value="3" ${this.filters.importanceList?.includes(3) ? 'checked' : ''}>
                      <span>${IMPORTANCE_LABELS[3]}</span>
                    </label>
                    <label class="annotations-premium-filter__checkbox-item">
                      <input type="checkbox" name="modal-filter-importance" value="4" ${this.filters.importanceList?.includes(4) ? 'checked' : ''}>
                      <span>${IMPORTANCE_LABELS[4]}</span>
                    </label>
                    <label class="annotations-premium-filter__checkbox-item">
                      <input type="checkbox" name="modal-filter-importance" value="5" ${this.filters.importanceList?.includes(5) ? 'checked' : ''}>
                      <span>${IMPORTANCE_LABELS[5]}</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Date Range Filter -->
              <div class="annotations-premium-filter__field annotations-premium-filter__field--date">
                <label class="annotations-premium-filter__label">Período</label>
                <input
                  type="text"
                  class="annotations-premium-filter__input"
                  id="modal-filter-date-range"
                  placeholder="Selecionar período..."
                  readonly
                >
              </div>
            </div>

            <!-- Actions Row -->
            <div class="annotations-premium-filter__actions">
              <button type="button" class="annotations-premium-filter__clear-btn" id="modal-clear-filters">
                🗑️ Limpar Filtros
              </button>
              <div class="annotations-premium-filter__result-count">
                Exibindo <strong>${totalFiltered}</strong> de <strong>${totalAnnotations}</strong> anotações
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.attachFilterModalListeners(overlay);
    this.initModalFilterDatePicker(overlay);
  }

  private attachFilterModalListeners(overlay: HTMLElement): void {
    // Close button
    overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this.closeFilterModal();
    });

    // Backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeFilterModal();
      }
    });

    // ESC key
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeFilterModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Stat chips click - toggle type filter
    overlay.querySelectorAll('.annotations-premium-filter__stat').forEach((stat) => {
      stat.addEventListener('click', () => {
        const type = stat.getAttribute('data-filter-type') as any;
        if (type) {
          this.toggleTypeFilter(type);
          this.closeFilterModal();
        }
      });
    });

    // Multiselect buttons
    overlay.querySelectorAll('.annotations-premium-filter__multiselect-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const multiselect = btn.closest('.annotations-premium-filter__multiselect');
        if (multiselect) {
          overlay.querySelectorAll('.annotations-premium-filter__multiselect.open').forEach((el) => {
            if (el !== multiselect) el.classList.remove('open');
          });
          multiselect.classList.toggle('open');
        }
      });
    });

    // Status checkboxes
    overlay.querySelectorAll('input[name="modal-filter-status"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => this.handleModalStatusFilterChange(overlay));
    });

    // Importance checkboxes
    overlay.querySelectorAll('input[name="modal-filter-importance"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => this.handleModalImportanceFilterChange(overlay));
    });

    // Clear filters button
    const clearBtn = overlay.querySelector('#modal-clear-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearAllFilters();
        this.closeFilterModal();
      });
    }

    // Close dropdowns on outside click
    overlay.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.annotations-premium-filter__multiselect')) {
        overlay.querySelectorAll('.annotations-premium-filter__multiselect.open').forEach((el) => {
          el.classList.remove('open');
        });
      }
    });
  }

  private handleModalStatusFilterChange(overlay: HTMLElement): void {
    const checkboxes = overlay.querySelectorAll('input[name="modal-filter-status"]') as NodeListOf<HTMLInputElement>;
    const allCheckbox = overlay.querySelector('input[name="modal-filter-status"][value="all"]') as HTMLInputElement;
    const selectedValues: string[] = [];

    checkboxes.forEach((cb) => {
      if (cb.value !== 'all' && cb.checked) {
        selectedValues.push(cb.value);
      }
    });

    if (allCheckbox?.checked || selectedValues.length === 0) {
      this.filters.statusList = [];
      checkboxes.forEach((cb) => {
        cb.checked = cb.value === 'all';
      });
    } else {
      this.filters.statusList = selectedValues as any[];
      if (allCheckbox) allCheckbox.checked = false;
    }

    const btn = overlay.querySelector('#modal-filter-status-btn span:first-child');
    if (btn) btn.textContent = this.getStatusFilterLabel();

    this.applyFilters();
  }

  private handleModalImportanceFilterChange(overlay: HTMLElement): void {
    const checkboxes = overlay.querySelectorAll('input[name="modal-filter-importance"]') as NodeListOf<HTMLInputElement>;
    const allCheckbox = overlay.querySelector('input[name="modal-filter-importance"][value="all"]') as HTMLInputElement;
    const selectedValues: number[] = [];

    checkboxes.forEach((cb) => {
      if (cb.value !== 'all' && cb.checked) {
        selectedValues.push(parseInt(cb.value, 10));
      }
    });

    if (allCheckbox?.checked || selectedValues.length === 0) {
      this.filters.importanceList = [];
      checkboxes.forEach((cb) => {
        cb.checked = cb.value === 'all';
      });
    } else {
      this.filters.importanceList = selectedValues as any[];
      if (allCheckbox) allCheckbox.checked = false;
    }

    const btn = overlay.querySelector('#modal-filter-importance-btn span:first-child');
    if (btn) btn.textContent = this.getImportanceFilterLabel();

    this.applyFilters();
  }

  private async initModalFilterDatePicker(overlay: HTMLElement): Promise<void> {
    const dateInput = overlay.querySelector('#modal-filter-date-range') as HTMLInputElement;
    if (!dateInput) return;

    dateInput.addEventListener('dblclick', () => {
      if (this.filters.dateRange) {
        this.filters.dateRange = undefined;
        dateInput.value = '';
        this.applyFilters();
      }
    });
    dateInput.title = 'Duplo clique para limpar filtro de data';

    try {
      await createDateRangePicker(dateInput, {
        includeTime: true,
        timePrecision: 'minute',
        maxRangeDays: 365,
        locale: 'pt-BR',
        parentEl: overlay,
        onApply: (result) => {
          this.filters.dateRange = {
            start: result.startISO,
            end: result.endISO,
          };
          this.applyFilters();
        },
      });
    } catch (error) {
      console.warn('[AnnotationsTab] Filter Modal DateRangePicker initialization failed:', error);
    }
  }

  private closeFilterModal(): void {
    this.filterModal?.remove();
    this.filterModal = null;
  }

  // =========================================
  // LEGACY METHODS (kept for compatibility)
  // =========================================

  /** @deprecated Use renderPremiumFilter instead */
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
              <div class="importance-option importance-option--1" data-importance="1" title="1 - Muito Baixa">${IMPORTANCE_LABELS[1]}</div>
              <div class="importance-option importance-option--2" data-importance="2" title="2 - Baixa">${IMPORTANCE_LABELS[2]}</div>
              <div class="importance-option importance-option--3 selected" data-importance="3" title="3 - Normal">${IMPORTANCE_LABELS[3]}</div>
              <div class="importance-option importance-option--4" data-importance="4" title="4 - Alta">${IMPORTANCE_LABELS[4]}</div>
              <div class="importance-option importance-option--5" data-importance="5" title="5 - Muito Alta">${IMPORTANCE_LABELS[5]}</div>
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

    // Textarea input handler (character count + enable/disable button)
    const textArea = this.container.querySelector('#annotation-text') as HTMLTextAreaElement;
    const charCount = this.container.querySelector('#char-count');
    const addBtn = this.container.querySelector('#add-annotation-btn') as HTMLButtonElement;

    if (textArea) {
      textArea.addEventListener('input', () => {
        const len = textArea.value.length;
        if (charCount) {
          charCount.textContent = `${len} / 255`;
          charCount.className = 'annotations-form__char-count' +
            (len > 240 ? ' annotations-form__char-count--warning' : '') +
            (len >= 255 ? ' annotations-form__char-count--error' : '');
        }
        if (addBtn) {
          addBtn.disabled = len === 0 || len > 255;
        }
      });
    }

    // Add annotation button
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        if (!textArea || textArea.value.trim().length === 0) return;

        const selectedType = this.container.querySelector('.type-option.selected') as HTMLElement;
        const selectedImportance = this.container.querySelector('.importance-option.selected') as HTMLElement;
        const dueDateInput = this.container.querySelector('#annotation-due-date') as HTMLInputElement;

        const type = (selectedType?.dataset.type || 'pending') as AnnotationType;
        const importance = parseInt(selectedImportance?.dataset.importance || '3') as ImportanceLevel;
        const dueDate = dueDateInput?.value || undefined;

        await this.addAnnotation({
          text: textArea.value.trim(),
          type,
          importance,
          dueDate,
        });

        this.clearForm();
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
    const hasActiveFilters = this.hasActiveFilters();

    const headerHtml = `
      <div class="annotations-grid__header">
        <span class="annotations-grid__title">
          📋 Anotações Registradas
          <span class="annotations-grid__help" data-action="grid-help" title="Ajuda sobre ações">?</span>
        </span>
        <span class="annotations-grid__count">${this.pagination.totalItems} registro(s)</span>

        <!-- Action Buttons -->
        <div class="annotations-grid__actions">
          <!-- Search Input (always visible) -->
          <div class="annotations-grid__search" id="search-container">
            <svg class="annotations-grid__search-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6zM4 9.5C4 6.46 6.46 4 9.5 4S15 6.46 15 9.5 12.54 15 9.5 15 4 12.54 4 9.5z"/>
            </svg>
            <input
              type="text"
              class="annotations-grid__search-input"
              id="grid-quick-search"
              placeholder="Buscar anotações..."
              value="${this.filters.searchText || ''}"
            >
            <button type="button" class="annotations-grid__search-clear" id="clear-search" title="Limpar busca">×</button>
          </div>

          <!-- Filter Button -->
          <button
            type="button"
            class="annotations-grid__icon-btn ${hasActiveFilters ? 'active' : ''}"
            id="open-filter-modal"
            title="Filtros Avançados"
            aria-label="Filtros"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/>
            </svg>
          </button>

          <!-- Create Button -->
          <button
            type="button"
            class="annotations-grid__btn annotations-grid__btn--create"
            id="grid-create-btn"
            title="Nova Anotação"
          >
            Nova Anotação +
          </button>
        </div>
      </div>
    `;

    if (paginated.length === 0) {
      return `
        <div class="annotations-grid">
          ${headerHtml}
          <div class="annotations-empty">
            <div class="annotations-empty__icon">📋</div>
            <div class="annotations-empty__text">
              ${this.annotations.length === 0
                ? 'Nenhuma anotação encontrada.<br>Clique em ➕ para adicionar a primeira anotação.'
                : 'Nenhuma anotação corresponde aos filtros selecionados.<br>Tente limpar a busca ou ajustar os filtros.'}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="annotations-grid">
        ${headerHtml}
        <div class="annotations-grid__list">
          ${paginated.map((a) => this.renderCard(a)).join('')}
        </div>
      </div>
    `;
  }

  private isOverdue(annotation: Annotation): boolean {
    if (!annotation.dueDate || annotation.status === 'archived') return false;
    try {
      const dueDate = new Date(annotation.dueDate);
      if (isNaN(dueDate.getTime())) return false;
      return dueDate < new Date();
    } catch (e) {
      return false;
    }
  }

  private formatDate(isoString: string): string {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '-';
    }
  }

  private renderCard(annotation: Annotation): string {
    const canModify = canModifyAnnotation(annotation, this.permissions);
    const typeColor = ANNOTATION_TYPE_COLORS[annotation.type];
    const importanceColor = IMPORTANCE_COLORS[annotation.importance];
    const overdue = this.isOverdue(annotation);
    const authorInitial = annotation.createdBy.name.charAt(0).toUpperCase();
    // RFC-0104: Hide approve/reject buttons if annotation already has a response
    const hasResponse = annotation.responses && annotation.responses.length > 0;
    const lastResponse = hasResponse ? annotation.responses[annotation.responses.length - 1] : null;
    const responseStatus = lastResponse?.type as ResponseType | null;

    const cardClasses = [
      'annotation-card',
      annotation.status === 'archived' ? 'annotation-card--archived' : '',
      overdue ? 'annotation-card--overdue' : '',
    ].filter(Boolean).join(' ');

    // Determine which buttons should be disabled
    const isArchived = annotation.status === 'archived';
    const isFinalized = responseStatus === 'approved' || responseStatus === 'rejected';
    const cannotModify = !canModify || isArchived || isFinalized;
    const cannotRespond = isArchived || isFinalized;
    const cannotComment = isArchived || isFinalized;

    // Count for history badge (history events + responses)
    const historyCount = (annotation.history?.length || 0) + (annotation.responses?.length || 0);

    return `
      <div class="${cardClasses}" data-id="${annotation.id}">
        <div class="annotation-card__header">
          <div class="annotation-card__type" style="background: ${typeColor}20; color: ${typeColor}; border: 1px solid ${typeColor}40;">
            ${ANNOTATION_TYPE_LABELS[annotation.type]}
          </div>
          <div class="annotation-card__importance" style="background: ${importanceColor}">
            ${IMPORTANCE_LABELS[annotation.importance]}
          </div>
          ${responseStatus === 'approved' ? '<div class="annotation-card__ack annotation-card__ack--approved">✓ Aprovada</div>' : ''}
          ${responseStatus === 'rejected' ? '<div class="annotation-card__ack annotation-card__ack--rejected">✗ Rejeitada</div>' : ''}
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
          <button class="annotation-card__btn annotation-card__btn--edit" data-action="edit" title="Editar anotação" ${cannotModify ? 'disabled' : ''}>✏️</button>
          <button class="annotation-card__btn annotation-card__btn--archive" data-action="archive" title="Arquivar anotação" ${cannotModify ? 'disabled' : ''}>⬇️</button>
          <button class="annotation-card__btn annotation-card__btn--approve" data-action="approve" title="Aprovar anotação" ${cannotRespond ? 'disabled' : ''}>✓</button>
          <button class="annotation-card__btn annotation-card__btn--reject" data-action="reject" title="Rejeitar anotação" ${cannotRespond ? 'disabled' : ''}>✗</button>
          <button class="annotation-card__btn annotation-card__btn--comment" data-action="comment" title="Adicionar comentário" ${cannotComment ? 'disabled' : ''}>💬</button>
          <button class="annotation-card__btn annotation-card__btn--history" data-action="details" title="Ver histórico (${historyCount})">
            📜
            ${historyCount > 0 ? `<span class="annotation-card__btn-badge">${historyCount}</span>` : ''}
          </button>
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
    const date = this.formatDate(annotation.createdAt);
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
      // Use addEventListener instead of onclick for better reliability
      openModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[AnnotationsTab] Create button clicked');
        this.showNewAnnotationModal();
      });
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

      card.querySelector('[data-action="archive"]')?.addEventListener('click', (e) => {
        if ((e.target as HTMLButtonElement).disabled) return;
        this.openResponseModal(id, 'archived');
      });

      card.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
        if ((e.target as HTMLButtonElement).disabled) return;
        this.showEditModal(id);
      });

      // RFC-0104 Amendment: Approve/Reject handlers
      card.querySelector('[data-action="approve"]')?.addEventListener('click', (e) => {
        if ((e.target as HTMLButtonElement).disabled) return;
        this.openResponseModal(id, 'approved');
      });

      card.querySelector('[data-action="reject"]')?.addEventListener('click', (e) => {
        if ((e.target as HTMLButtonElement).disabled) return;
        this.openResponseModal(id, 'rejected');
      });

      card.querySelector('[data-action="comment"]')?.addEventListener('click', (e) => {
        if ((e.target as HTMLButtonElement).disabled) return;
        this.openResponseModal(id, 'comment');
      });

    });

    // Grid header help button
    this.container.querySelector('[data-action="grid-help"]')?.addEventListener('click', (e) => {
      this.showHelpTooltip(e.target as HTMLElement);
    });

    // Tour button (RFC-0144)
    this.container.querySelector('[data-action="start-tour"]')?.addEventListener('click', () => {
      this.startTour();
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
        this.openResponseModal(id, 'archived');
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
    // Try premium filter first, then fallback to legacy filter
    const dateInput = this.container.querySelector('#premium-filter-date-range') as HTMLInputElement
      || this.container.querySelector('#filter-date-range') as HTMLInputElement;
    if (!dateInput) return;

    // Add clear button functionality via double-click on input
    dateInput.addEventListener('dblclick', () => {
      if (this.filters.dateRange) {
        this.filters.dateRange = undefined;
        dateInput.value = '';
        this.pagination.currentPage = 1;
        this.refreshView();
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
          this.refreshView();
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
    // Close any active tour before showing new annotation modal
    this.closeAllTours();

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
            <div class="annotations-form__label-row">
              <label class="annotations-form__label">Texto da Anotação</label>
              <button type="button" class="annotations-form__tour-btn" id="new-annotation-tour-btn" title="Ver tutorial">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                </svg>
                Tour
              </button>
            </div>
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
              <div class="importance-option importance-option--1" data-importance="1" title="1 - Muito Baixa">${IMPORTANCE_LABELS[1]}</div>
              <div class="importance-option importance-option--2" data-importance="2" title="2 - Baixa">${IMPORTANCE_LABELS[2]}</div>
              <div class="importance-option importance-option--3 selected" data-importance="3" title="3 - Normal">${IMPORTANCE_LABELS[3]}</div>
              <div class="importance-option importance-option--4" data-importance="4" title="4 - Alta">${IMPORTANCE_LABELS[4]}</div>
              <div class="importance-option importance-option--5" data-importance="5" title="5 - Muito Alta">${IMPORTANCE_LABELS[5]}</div>
            </div>
          </div>

          <!-- Due Date -->
          <div class="annotations-form__field" style="margin-bottom: 16px;">
            <label class="annotations-form__label">Data Limite (opcional)</label>
            <input
              type="datetime-local"
              class="annotations-form__input"
              id="new-annotation-due-date"
              style="cursor: text;"
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

    // Due date input (using native datetime-local)
    const dueDateInput = overlay.querySelector('#new-annotation-due-date') as HTMLInputElement;

    // Tour button - starts the New Annotation modal tour
    const tourBtn = overlay.querySelector('#new-annotation-tour-btn');
    if (tourBtn) {
      tourBtn.addEventListener('click', () => {
        this.startNewAnnotationTour();
      });
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

      // Get due date from native datetime-local input
      let dueDate: string | undefined;
      if (dueDateInput?.value) {
        try {
          const dateValue = new Date(dueDateInput.value);
          if (!isNaN(dateValue.getTime())) {
            dueDate = dateValue.toISOString();
          }
        } catch (e) {
          console.warn('[AnnotationsTab] Invalid due date value:', dueDateInput.value);
        }
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
    // Close any active tour before showing edit modal
    this.closeAllTours();

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
    // Close any active tour before showing detail modal
    this.closeAllTours();

    const annotation = this.annotations.find((a) => a.id === id);
    if (!annotation) return;

    const modalId = `annotation-detail-${Date.now()}`;
    const canModify = canModifyAnnotation(annotation, this.permissions);
    const hasResponse = annotation.responses && annotation.responses.length > 0;
    const lastResponse = hasResponse ? annotation.responses[annotation.responses.length - 1] : null;
    const responseStatus = lastResponse?.type as ResponseType | null;
    const overlay = document.createElement('div');
    overlay.className = 'annotation-detail-overlay';

    // Get colors for badges
    const typeColor = ANNOTATION_TYPE_COLORS[annotation.type];
    const importanceColor = IMPORTANCE_COLORS[annotation.importance];
    const statusColor = STATUS_COLORS[annotation.status];

    overlay.innerHTML = `
      <div class="annotation-detail-modal">
        ${ModalHeader.generateInlineHTML({
          icon: '📝',
          title: 'Detalhes da Anotação',
          modalId,
          theme: 'dark',
          isMaximized: false,
          showThemeToggle: false,
          showMaximize: false,
          showClose: true,
          primaryColor: '#6c5ce7',
          borderRadius: '10px 10px 0 0',
        })}
        <div class="annotation-detail__content">
          <!-- Badges Row: Tipo, Importância, Status -->
          <div class="annotation-detail__badges-row">
            <div class="annotation-detail__badge-group">
              <span class="annotation-detail__badge-label">Tipo</span>
              <span class="annotation-detail__badge" style="background: ${typeColor}20; color: ${typeColor}; border: 1px solid ${typeColor}40;">
                ${ANNOTATION_TYPE_LABELS[annotation.type]}
              </span>
            </div>
            <div class="annotation-detail__badge-group">
              <span class="annotation-detail__badge-label">Importância</span>
              <span class="annotation-detail__badge" style="background: ${importanceColor}; color: #fff;">
                ${IMPORTANCE_LABELS[annotation.importance]}
              </span>
            </div>
            <div class="annotation-detail__badge-group">
              <span class="annotation-detail__badge-label">Status</span>
              <span class="annotation-detail__badge" style="background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40;">
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
            <div class="annotation-detail__value">${this.formatDate(annotation.createdAt)}</div>
          </div>
          ${annotation.dueDate ? `
            <div class="annotation-detail__field">
              <div class="annotation-detail__label">Data Limite</div>
              <div class="annotation-detail__value">${this.formatDate(annotation.dueDate)}</div>
            </div>
          ` : ''}
          <div class="annotation-detail__field">
            <div class="annotation-detail__label">Descrição</div>
            <div class="annotation-detail__description">${annotation.text}</div>
          </div>
          ${responseStatus === 'approved' ? `
            <div class="annotation-detail__field annotation-detail__response-box" style="background: #d4edda;">
              <div class="annotation-detail__label" style="color: #155724;">✓ Aprovado por</div>
              <div class="annotation-detail__value" style="margin-bottom: 6px;">
                ${lastResponse?.createdBy?.name} em ${this.formatDate(lastResponse?.createdAt || '')}
              </div>
              ${lastResponse?.text ? `
                <div class="annotation-detail__label" style="color: #155724; margin-top: 6px;">Observação:</div>
                <div class="annotation-detail__value" style="font-style: italic;">${lastResponse.text}</div>
              ` : ''}
            </div>
          ` : ''}
          ${responseStatus === 'rejected' ? `
            <div class="annotation-detail__field annotation-detail__response-box" style="background: #f8d7da;">
              <div class="annotation-detail__label" style="color: #721c24;">✗ Rejeitado por</div>
              <div class="annotation-detail__value" style="margin-bottom: 6px;">
                ${lastResponse?.createdBy?.name} em ${this.formatDate(lastResponse?.createdAt || '')}
              </div>
              ${lastResponse?.text ? `
                <div class="annotation-detail__label" style="color: #721c24; margin-top: 6px;">Justificativa:</div>
                <div class="annotation-detail__value" style="font-style: italic;">${lastResponse.text}</div>
              ` : ''}
            </div>
          ` : ''}
          ${responseStatus === 'archived' && lastResponse?.text ? `
            <div class="annotation-detail__field annotation-detail__response-box" style="background: #e9ecef;">
              <div class="annotation-detail__label" style="color: #495057;">⬇️ Arquivado por</div>
              <div class="annotation-detail__value" style="margin-bottom: 6px;">
                ${lastResponse?.createdBy?.name} em ${this.formatDate(lastResponse?.createdAt || '')}
              </div>
              <div class="annotation-detail__label" style="color: #495057; margin-top: 6px;">Justificativa:</div>
              <div class="annotation-detail__value" style="font-style: italic;">${lastResponse.text}</div>
            </div>
          ` : ''}
          <div class="annotation-detail__history">
            <div class="annotation-detail__history-title">Histórico (${annotation.history.length} eventos)</div>
            ${annotation.history.map((h) => `
              <div class="annotation-detail__history-item">
                <strong>${h.action}</strong> por ${h.userName} em ${this.formatDate(h.timestamp)}
              </div>
            `).join('')}
          </div>
        </div>
        <div class="annotation-detail__footer">
          ${canModify && annotation.status !== 'archived' && !hasResponse ? `
            <button class="annotation-detail__btn annotation-detail__btn--danger" data-action="archive">
              ⬇️ Arquivar
            </button>
          ` : ''}
          <button class="annotation-detail__btn annotation-detail__btn--secondary" data-action="close">
            Fechar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners - use ModalHeader setupHandlers for close button
    ModalHeader.setupHandlers({
      modalId,
      onClose: () => overlay.remove(),
    });
    overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('[data-action="archive"]')?.addEventListener('click', () => {
      overlay.remove();
      this.openResponseModal(id, 'archived');
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
}

// Export default
export default AnnotationsTab;
