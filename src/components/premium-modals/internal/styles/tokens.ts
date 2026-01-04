// internal/styles/tokens.ts
export const CSS_TOKENS = `
:root {
  /* Brand Colors */
  --myio-brand-700: #3e1a7d;
  --myio-brand-600: #2d1458;
  --myio-accent: #2d1458;
  --myio-danger: #d32f2f;
  --myio-success: #388E3C;
  --myio-warning: #f57c00;
  --myio-info: #1976d2;
  
  /* Neutral Colors */
  --myio-bg: #f7f7f7;
  --myio-card: #ffffff;
  --myio-border: #e0e0e0;
  --myio-text: #333333;
  --myio-text-muted: #666666;
  --myio-text-light: #999999;
  
  /* Layout */
  --myio-shadow: 0 2px 6px rgba(0,0,0,0.08);
  --myio-shadow-lg: 0 4px 12px rgba(0,0,0,0.15);
  --myio-radius: 10px;
  --myio-radius-sm: 6px;
  --myio-spacing: 16px;
  --myio-spacing-sm: 8px;
  --myio-spacing-lg: 24px;
  
  /* Typography */
  --myio-font: 'Roboto', Arial, sans-serif;
  --myio-font-size: 14px;
  --myio-font-size-sm: 12px;
  --myio-font-size-lg: 16px;
  --myio-line-height: 1.4;
  
  /* Z-index */
  --myio-z-modal: 9999;
  --myio-z-backdrop: 9998;
  --myio-z-sticky: 100;
  
  /* Animation */
  --myio-transition: 0.2s ease;
  --myio-transition-slow: 0.3s ease;
}

/* Dark theme tokens */
[data-theme="dark"] {
  --myio-bg: #1a1a1a;
  --myio-card: #2d2d2d;
  --myio-border: #404040;
  --myio-text: #ffffff;
  --myio-text-muted: #cccccc;
  --myio-text-light: #999999;
  --myio-shadow: 0 2px 6px rgba(0,0,0,0.3);
  --myio-shadow-lg: 0 4px 12px rgba(0,0,0,0.4);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  :root {
    --myio-transition: 0s;
    --myio-transition-slow: 0s;
  }
}
`;

export const MODAL_STYLES = `
.myio-modal-scope {
  font-family: var(--myio-font);
  font-size: var(--myio-font-size);
  line-height: var(--myio-line-height);
  color: var(--myio-text);
  box-sizing: border-box;
}

.myio-modal-scope *,
.myio-modal-scope *::before,
.myio-modal-scope *::after {
  box-sizing: inherit;
}

.myio-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: var(--myio-z-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--myio-spacing);
}

.myio-modal {
  background: var(--myio-card);
  border-radius: var(--myio-radius);
  box-shadow: var(--myio-shadow-lg);
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transform: scale(0.95);
  opacity: 0;
  transition: transform var(--myio-transition), opacity var(--myio-transition);
}

.myio-modal.myio-modal-open {
  transform: scale(1);
  opacity: 1;
}

.myio-modal-header {
  padding: 4px;
  border-bottom: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--myio-brand-700);
  color: white;
  border-radius: var(--myio-radius) var(--myio-radius) 0 0;
  min-height: 20px;
}

.myio-modal-title {
  font-size: 18px !important;
  font-weight: 600;
  margin: 6px !important;
  color: white;
  line-height: 2 !important;
}

.myio-modal-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--myio-radius-sm);
  color: rgba(255, 255, 255, 0.8);
  transition: background-color var(--myio-transition);
}

.myio-modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.myio-modal-close:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.5);
  outline-offset: 2px;
}

.myio-modal-body {
  flex: 1;
  overflow: auto;
  padding: var(--myio-spacing);
}

.myio-modal-footer {
  padding: var(--myio-spacing);
  border-top: 1px solid var(--myio-border);
  display: flex;
  gap: var(--myio-spacing-sm);
  justify-content: flex-end;
}

/* Button styles */
.myio-btn {
  padding: 8px 16px;
  border: none;
  border-radius: var(--myio-radius-sm);
  font-family: inherit;
  font-size: var(--myio-font-size);
  cursor: pointer;
  transition: background-color var(--myio-transition);
  display: inline-flex;
  align-items: center;
  gap: var(--myio-spacing-sm);
}

.myio-btn-primary {
  background: var(--myio-brand-700);
  color: white;
}

.myio-btn-primary:hover {
  background: var(--myio-brand-600);
}

.myio-btn-secondary {
  background: var(--myio-bg);
  color: var(--myio-text);
  border: 1px solid var(--myio-border);
}

.myio-btn-secondary:hover {
  background: var(--myio-border);
}

.myio-btn:focus-visible {
  outline: 2px solid var(--myio-brand-700);
  outline-offset: 2px;
}

.myio-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Form styles */
.myio-form-group {
  margin-bottom: var(--myio-spacing);
}

.myio-label {
  display: block;
  margin-bottom: var(--myio-spacing-sm);
  font-weight: 500;
  color: var(--myio-text);
}

.myio-input {
  width: 100%;
  padding: var(--myio-spacing-sm);
  border: 1px solid var(--myio-border);
  border-radius: var(--myio-radius-sm);
  font-family: inherit;
  font-size: var(--myio-font-size);
  transition: border-color var(--myio-transition);
}

.myio-input:focus {
  outline: none;
  border-color: var(--myio-brand-700);
}

/* Table styles */
.myio-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--myio-font-size);
}

.myio-table th,
.myio-table td {
  padding: var(--myio-spacing-sm) var(--myio-spacing);
  text-align: left;
  border-bottom: 1px solid var(--myio-border);
}

.myio-table th:first-child,
.myio-table td:first-child {
  padding-left: var(--myio-spacing-lg);
}

.myio-table th:last-child,
.myio-table td:last-child {
  padding-right: var(--myio-spacing-lg);
}

.myio-table th {
  background: var(--myio-brand-700);
  color: white;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: var(--myio-z-sticky);
}

.myio-table tbody tr:nth-child(even) {
  background: var(--myio-bg);
}

.myio-table tbody tr:hover {
  background: var(--myio-border);
}

/* Loading spinner */
.myio-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--myio-border);
  border-top: 2px solid var(--myio-brand-700);
  border-radius: 50%;
  animation: myio-spin 1s linear infinite;
}

@keyframes myio-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Utility classes */
.myio-text-center { text-align: center; }
.myio-text-right { text-align: right; }
.myio-text-muted { color: var(--myio-text-muted); }
.myio-text-success { color: var(--myio-success); }
.myio-text-danger { color: var(--myio-danger); }
.myio-mb-0 { margin-bottom: 0; }
.myio-mt-0 { margin-top: 0; }
.myio-p-0 { padding: 0; }
`;

// Premium DateRangePicker styling with MyIO brand colors
// Global styles (no scope) for menu and other components
export const DATERANGEPICKER_STYLES = `
/* ==========================================
   MyIO Premium DateRangePicker - Global Styles
   ========================================== */

.daterangepicker {
  font-family: 'Inter', 'Roboto', Arial, sans-serif;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  background: #ffffff;
  z-index: 10000;
}

/* Wider ranges panel */
.daterangepicker.show-ranges.ltr .drp-calendar.left {
  border-left: 1px solid #e0e0e0;
}

.daterangepicker .ranges {
  min-width: 200px;
  width: auto !important;
}

.daterangepicker .ranges ul {
  width: 100% !important;
  min-width: 180px;
}

.daterangepicker .ranges li {
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
}

.daterangepicker .calendar-table {
  background: #ffffff;
  border: none;
}

.daterangepicker .calendar-table th,
.daterangepicker .calendar-table td {
  border: none;
  padding: 8px;
  text-align: center;
  font-size: 13px;
  color: #333333;
}

.daterangepicker .calendar-table th {
  background: #f7f7f7;
  color: #333333;
  font-weight: 600;
}

.daterangepicker .calendar-table td.available {
  color: #333333;
}

.daterangepicker .calendar-table td.available:hover {
  background: #f0f0f0;
  color: #333333;
}

.daterangepicker .calendar-table td.off {
  color: #999999;
}

.daterangepicker .calendar-table td.in-range {
  background: rgba(62, 26, 125, 0.1);
  color: #333333;
}

.daterangepicker .calendar-table td.start-date,
.daterangepicker .calendar-table td.end-date {
  background: #3e1a7d;
  color: white;
  border-radius: 4px;
}

.daterangepicker .calendar-table td.active {
  background: #3e1a7d;
  color: white;
  border-radius: 4px;
}

/* Premium button styling for Aplicar/Cancelar */
.daterangepicker .drp-buttons {
  border-top: 1px solid #e0e0e0;
  padding: 12px 16px;
  background: #f7f7f7;
  text-align: right;
}

.daterangepicker .drp-buttons .btn {
  margin-left: 8px;
  padding: 10px 20px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 90px;
}

/* Aplicar button - MyIO Primary Purple */
.daterangepicker .drp-buttons .applyBtn {
  background: linear-gradient(135deg, #3e1a7d 0%, #2d1458 100%);
  color: white;
  box-shadow: 0 2px 6px rgba(62, 26, 125, 0.3);
}

.daterangepicker .drp-buttons .applyBtn:hover {
  background: linear-gradient(135deg, #4a2391 0%, #3e1a7d 100%);
  box-shadow: 0 4px 12px rgba(62, 26, 125, 0.4);
  transform: translateY(-1px);
}

/* Cancelar button - Secondary */
.daterangepicker .drp-buttons .cancelBtn {
  background: #ffffff;
  color: #333333;
  border: 2px solid #e0e0e0;
}

.daterangepicker .drp-buttons .cancelBtn:hover {
  background: #f7f7f7;
  border-color: #3e1a7d;
  color: #3e1a7d;
}

/* Ranges (preset buttons) styling */
.daterangepicker .ranges {
  background: #f7f7f7;
  border-right: 1px solid #e0e0e0;
  padding: 8px 0;
}

.daterangepicker .ranges ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.daterangepicker .ranges li {
  padding: 10px 16px;
  margin: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  font-weight: 500;
  color: #333333;
}

.daterangepicker .ranges li:hover {
  background: rgba(62, 26, 125, 0.1);
  color: #3e1a7d;
}

.daterangepicker .ranges li.active {
  background: #3e1a7d;
  color: white;
  font-weight: 600;
}

/* Time picker styling */
.daterangepicker .calendar-time {
  border-top: 1px solid #e0e0e0;
  background: #f7f7f7;
  padding: 10px;
  text-align: center;
}

.daterangepicker .calendar-time select {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 6px 10px;
  font-family: inherit;
  font-size: 13px;
  background: #ffffff;
  color: #333333;
  margin: 0 2px;
}

.daterangepicker .calendar-time select:focus {
  outline: none;
  border-color: #3e1a7d;
  box-shadow: 0 0 0 2px rgba(62, 26, 125, 0.2);
}

/* Header styling */
.daterangepicker .drp-calendar {
  background: #ffffff;
  padding: 8px;
}

.daterangepicker .month {
  color: #3e1a7d;
  font-weight: 700;
  font-size: 14px;
}

.daterangepicker th.month {
  background: transparent;
}

.daterangepicker .prev,
.daterangepicker .next {
  color: #3e1a7d;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #ffffff;
  transition: all 0.2s ease;
  padding: 4px 8px;
}

.daterangepicker .prev:hover,
.daterangepicker .next:hover {
  background: #3e1a7d;
  color: white;
  border-color: #3e1a7d;
}

/* Selected date label */
.daterangepicker .drp-selected {
  font-size: 13px;
  font-weight: 500;
  color: #333333;
  padding-right: 10px;
}

/* ==========================================
   Scoped styles for modals (kept for compatibility)
   ========================================== */

.myio-modal-scope .daterangepicker {
  font-family: var(--myio-font);
  border: 1px solid var(--myio-border);
  border-radius: var(--myio-radius);
  box-shadow: var(--myio-shadow-lg);
  background: var(--myio-card);
  z-index: var(--myio-z-popover, 10000);
}

.myio-modal-scope .daterangepicker .calendar-table {
  background: var(--myio-card);
  border: none;
}

.myio-modal-scope .daterangepicker .calendar-table th,
.myio-modal-scope .daterangepicker .calendar-table td {
  border: none;
  padding: 8px;
  text-align: center;
  font-size: 13px;
}

.myio-modal-scope .daterangepicker .calendar-table th {
  background: var(--myio-bg);
  color: var(--myio-text);
  font-weight: 600;
}

.myio-modal-scope .daterangepicker .calendar-table td.available:hover {
  background: var(--myio-bg);
  color: var(--myio-text);
}

.myio-modal-scope .daterangepicker .calendar-table td.in-range {
  background: rgba(74, 20, 140, 0.1);
  color: var(--myio-text);
}

.myio-modal-scope .daterangepicker .calendar-table td.start-date,
.myio-modal-scope .daterangepicker .calendar-table td.end-date {
  background: var(--myio-brand-700);
  color: white;
  border-radius: 4px;
}

.myio-modal-scope .daterangepicker .calendar-table td.active {
  background: var(--myio-brand-700);
  color: white;
  border-radius: 4px;
}

/* Premium button styling for Aplicar/Cancelar */
.myio-modal-scope .daterangepicker .drp-buttons {
  border-top: 1px solid var(--myio-border);
  padding: 12px 16px;
  background: var(--myio-bg);
  text-align: right;
}

.myio-modal-scope .daterangepicker .drp-buttons .btn {
  margin-left: 8px;
  padding: 8px 16px;
  border-radius: var(--myio-radius-sm);
  font-family: var(--myio-font);
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all var(--myio-transition);
  min-width: 80px;
}

/* Aplicar button - MyIO Primary */
.myio-modal-scope .daterangepicker .drp-buttons .applyBtn {
  background: linear-gradient(135deg, var(--myio-brand-700) 0%, var(--myio-accent) 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(74, 20, 140, 0.2);
}

.myio-modal-scope .daterangepicker .drp-buttons .applyBtn:hover {
  background: linear-gradient(135deg, var(--myio-brand-600) 0%, var(--myio-brand-700) 100%);
  box-shadow: 0 4px 8px rgba(74, 20, 140, 0.3);
  transform: translateY(-1px);
}

.myio-modal-scope .daterangepicker .drp-buttons .applyBtn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(74, 20, 140, 0.2);
}

/* Cancelar button - MyIO Secondary */
.myio-modal-scope .daterangepicker .drp-buttons .cancelBtn {
  background: var(--myio-card);
  color: var(--myio-text);
  border: 1px solid var(--myio-border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.myio-modal-scope .daterangepicker .drp-buttons .cancelBtn:hover {
  background: var(--myio-bg);
  border-color: var(--myio-brand-700);
  color: var(--myio-brand-700);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.myio-modal-scope .daterangepicker .drp-buttons .cancelBtn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* Ranges (preset buttons) styling */
.myio-modal-scope .daterangepicker .ranges {
  background: var(--myio-bg);
  border-right: 1px solid var(--myio-border);
}

.myio-modal-scope .daterangepicker .ranges li {
  padding: 10px 16px;
  margin: 2px 8px;
  border-radius: var(--myio-radius-sm);
  cursor: pointer;
  transition: all var(--myio-transition);
  font-size: 13px;
  color: var(--myio-text);
}

.myio-modal-scope .daterangepicker .ranges li:hover {
  background: rgba(74, 20, 140, 0.1);
  color: var(--myio-brand-700);
}

.myio-modal-scope .daterangepicker .ranges li.active {
  background: var(--myio-brand-700);
  color: white;
  font-weight: 500;
}

/* Time picker styling */
.myio-modal-scope .daterangepicker .calendar-time {
  border-top: 1px solid var(--myio-border);
  background: var(--myio-bg);
  padding: 8px;
}

.myio-modal-scope .daterangepicker .calendar-time select {
  border: 1px solid var(--myio-border);
  border-radius: var(--myio-radius-sm);
  padding: 4px 8px;
  font-family: var(--myio-font);
  background: var(--myio-card);
  color: var(--myio-text);
}

.myio-modal-scope .daterangepicker .calendar-time select:focus {
  outline: none;
  border-color: var(--myio-brand-700);
  box-shadow: 0 0 0 2px rgba(74, 20, 140, 0.2);
}

/* Header styling */
.myio-modal-scope .daterangepicker .drp-calendar {
  background: var(--myio-card);
}

.myio-modal-scope .daterangepicker .month {
  color: var(--myio-brand-700);
  font-weight: 600;
  font-size: 14px;
}

.myio-modal-scope .daterangepicker .prev,
.myio-modal-scope .daterangepicker .next {
  color: var(--myio-brand-700);
  border: 1px solid var(--myio-border);
  border-radius: var(--myio-radius-sm);
  background: var(--myio-card);
  transition: all var(--myio-transition);
}

.myio-modal-scope .daterangepicker .prev:hover,
.myio-modal-scope .daterangepicker .next:hover {
  background: var(--myio-brand-700);
  color: white;
  border-color: var(--myio-brand-700);
}
`;
