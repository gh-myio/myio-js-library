// internal/styles/tokens.ts
export const CSS_TOKENS = `
:root {
  /* Brand Colors */
  --myio-brand-700: #4A148C;
  --myio-brand-600: #5c307d;
  --myio-accent: #5c307d;
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
  padding: var(--myio-spacing);
  border-bottom: 1px solid var(--myio-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--myio-card);
}

.myio-modal-title {
  font-size: var(--myio-font-size-lg);
  font-weight: 600;
  margin: 0;
  color: var(--myio-brand-700);
}

.myio-modal-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--myio-radius-sm);
  color: var(--myio-text-muted);
  transition: background-color var(--myio-transition);
}

.myio-modal-close:hover {
  background: var(--myio-bg);
  color: var(--myio-text);
}

.myio-modal-close:focus-visible {
  outline: 2px solid var(--myio-brand-700);
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
  padding: var(--myio-spacing-sm);
  text-align: left;
  border-bottom: 1px solid var(--myio-border);
}

.myio-table th {
  background: var(--myio-bg);
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
