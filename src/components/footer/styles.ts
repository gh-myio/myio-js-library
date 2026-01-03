/**
 * RFC-0115: Footer Component Library
 * CSS styles for the Footer Component
 * Uses CSS custom properties for dynamic theming
 */

const STYLE_ID = 'myio-footer-component-styles';

/**
 * Check if styles are already injected
 */
export function areStylesInjected(): boolean {
  return !!document.getElementById(STYLE_ID);
}

/**
 * Inject CSS styles into the document head
 */
export function injectStyles(): void {
  if (areStylesInjected()) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = getStyles();
  document.head.appendChild(style);
}

/**
 * Remove injected styles
 */
export function removeStyles(): void {
  const style = document.getElementById(STYLE_ID);
  if (style) {
    style.remove();
  }
}

/**
 * Get the CSS styles string
 * Uses CSS custom properties that are set inline by FooterView
 */
export function getStyles(): string {
  return `
/* ==========================================
   MYIO Footer Component - Premium Design System
   RFC-0115: Footer Component Library
   ========================================== */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.myio-footer-component {
  /* Fallback Design Tokens - Dark Theme */
  --fc-primary: #9E8CBE;
  --fc-primary-hover: #B8A5D6;
  --fc-primary-dark: #8472A8;
  --fc-bg-gradient-start: rgba(158, 140, 190, 0.95);
  --fc-bg-gradient-end: rgba(132, 114, 168, 0.98);
  --fc-border-top: rgba(184, 165, 214, 0.5);
  --fc-text: #ffffff;
  --fc-text-muted: rgba(255, 255, 255, 0.7);
  --fc-chip-bg: rgba(158, 140, 190, 0.25);
  --fc-chip-border: rgba(184, 165, 214, 0.4);
  --fc-chip-text: #ffffff;
  --fc-compare-btn: #3E1A7D;
  --fc-compare-btn-hover: #5A2CB8;
  --fc-clear-btn: rgba(200, 200, 200, 0.2);
  --fc-clear-btn-text: #cccccc;
  --fc-meta-bg: rgba(158, 140, 190, 0.15);
  --fc-meta-border: rgba(184, 165, 214, 0.3);
  --fc-empty-bg: rgba(158, 140, 190, 0.15);
  --fc-empty-border: rgba(184, 165, 214, 0.4);

  /* Static tokens */
  --fc-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --fc-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
  --fc-shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --fc-radius-sm: 6px;
  --fc-radius-md: 10px;
  --fc-radius-lg: 14px;
  --fc-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  --fc-error: #ff4444;

  /* Layout */
  position: relative;
  width: 100%;
  height: 46px;
  z-index: 1000;

  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 18px;
  box-sizing: border-box;

  /* Visual */
  font-family: var(--fc-font-family);
  color: var(--fc-text);
  background: linear-gradient(
    180deg,
    var(--fc-bg-gradient-start) 0%,
    var(--fc-bg-gradient-end) 100%
  );
  border-top: 2px solid var(--fc-border-top);
  box-shadow:
    var(--fc-shadow-lg),
    0 -2px 24px rgba(158, 140, 190, 0.3);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

/* ==========================================
   Dock Area (chips container)
   ========================================== */

.myio-footer-dock {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 10px 0;
  margin: 0 -8px;
  padding-left: 8px;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--fc-primary) transparent;
}

.myio-footer-dock::-webkit-scrollbar {
  height: 6px;
}

.myio-footer-dock::-webkit-scrollbar-track {
  background: rgba(158, 140, 190, 0.08);
  border-radius: 3px;
}

.myio-footer-dock::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, var(--fc-primary) 0%, var(--fc-primary-hover) 100%);
  border-radius: 3px;
  box-shadow: 0 0 8px rgba(158, 140, 190, 0.4);
}

/* ==========================================
   Chip Component
   ========================================== */

.myio-footer-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  height: 34px;
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--fc-chip-bg) 0%, rgba(158, 140, 190, 0.15) 100%);
  border: 1px solid var(--fc-chip-border);
  border-radius: var(--fc-radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  white-space: nowrap;
  cursor: default;
  transition: var(--fc-transition);
  animation: fcChipSlideIn 0.3s ease-out;
  position: relative;
  overflow: hidden;
}

@keyframes fcChipSlideIn {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.myio-footer-chip:hover {
  background: linear-gradient(135deg, rgba(158, 140, 190, 0.35) 0%, rgba(158, 140, 190, 0.25) 100%);
  border-color: rgba(184, 165, 214, 0.6);
  box-shadow: 0 6px 16px rgba(158, 140, 190, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  transform: translateY(-3px);
}

.myio-footer-chip-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex-shrink: 0;
}

.myio-footer-chip-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--fc-chip-text);
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.myio-footer-chip-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--fc-chip-text);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.myio-footer-chip-remove {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  margin-left: 5px;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.myio-footer-chip-remove:hover {
  background: linear-gradient(135deg, rgba(255, 68, 68, 0.25) 0%, rgba(255, 68, 68, 0.15) 100%);
  border-color: rgba(255, 68, 68, 0.5);
  color: #ff4444;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(255, 68, 68, 0.3);
}

.myio-footer-chip-remove svg {
  position: relative;
  z-index: 1;
  width: 16px;
  height: 16px;
  stroke-width: 2.5;
  stroke-linecap: round;
}

/* ==========================================
   Empty State
   ========================================== */

.myio-footer-empty {
  color: var(--fc-text);
  font-size: 15px;
  font-weight: 600;
  padding: 12px 24px;
  opacity: 0.9;
  background: linear-gradient(135deg, var(--fc-empty-bg) 0%, transparent 100%);
  border: 1px dashed var(--fc-empty-border);
  border-radius: var(--fc-radius-md);
  text-shadow: 0 0 8px rgba(158, 140, 190, 0.3);
  animation: fcPulseGlow 2s ease-in-out infinite;
}

@keyframes fcPulseGlow {
  0%, 100% { opacity: 0.7; box-shadow: 0 0 0 rgba(158, 140, 190, 0.3); }
  50% { opacity: 1; box-shadow: 0 0 16px rgba(158, 140, 190, 0.3); }
}

/* ==========================================
   Right Section (meta + buttons)
   ========================================== */

.myio-footer-right {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
}

.myio-footer-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0px;
  padding: 4px 9px;
  min-width: 100px;
  background: linear-gradient(135deg, var(--fc-meta-bg) 0%, rgba(158, 140, 190, 0.08) 100%);
  border: 1px solid var(--fc-meta-border);
  border-radius: var(--fc-radius-md);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.myio-footer-meta-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--fc-text);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 0 0 8px rgba(158, 140, 190, 0.4);
}

.myio-footer-totals {
  font-size: 11px;
  font-weight: 700;
  color: var(--fc-text);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* ==========================================
   Clear Button
   ========================================== */

.myio-footer-clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: linear-gradient(135deg, var(--fc-clear-btn) 0%, rgba(200, 200, 200, 0.1) 100%);
  border: 1px solid rgba(200, 200, 200, 0.3);
  border-radius: var(--fc-radius-md);
  color: var(--fc-clear-btn-text);
  cursor: pointer;
  transition: var(--fc-transition);
}

.myio-footer-clear-btn:hover {
  background: linear-gradient(135deg, rgba(200, 200, 200, 0.3) 0%, rgba(200, 200, 200, 0.2) 100%);
  border-color: rgba(200, 200, 200, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(200, 200, 200, 0.3);
}

.myio-footer-clear-btn:disabled {
  background: rgba(128, 128, 128, 0.2);
  border-color: rgba(128, 128, 128, 0.1);
  color: rgba(128, 128, 128, 0.5);
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
}

.myio-footer-clear-btn:disabled:hover {
  transform: none;
  box-shadow: none;
}

.myio-footer-clear-btn svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

/* ==========================================
   Compare Button
   ========================================== */

.myio-footer-compare {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 32px;
  min-width: 100px;
  padding: 0 16px;
  font-family: var(--fc-font-family);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  background: var(--fc-compare-btn);
  border: none;
  border-radius: var(--fc-radius-md);
  color: #ffffff;
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(62, 26, 125, 0.5), 0 4px 16px rgba(62, 26, 125, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: var(--fc-transition);
}

.myio-footer-compare:hover {
  background: linear-gradient(135deg, var(--fc-compare-btn-hover) 0%, var(--fc-compare-btn) 100%);
  box-shadow: 0 0 0 1px rgba(62, 26, 125, 0.7), 0 6px 24px rgba(62, 26, 125, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.myio-footer-compare:disabled {
  background: rgba(128, 128, 128, 0.3);
  color: rgba(255, 255, 255, 0.5);
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
  transform: none;
}

.myio-footer-compare::after {
  content: '\\2192'; /* Right arrow */
  font-size: 14px;
  margin-left: 2px;
  transition: transform 0.2s;
}

.myio-footer-compare:hover::after {
  transform: translateX(4px);
}

.myio-footer-compare:disabled::after {
  display: none;
}

/* ==========================================
   Alert Overlay
   ========================================== */

.myio-footer-alert-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  animation: fcAlertFadeIn 0.2s ease-out;
}

@keyframes fcAlertFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.myio-footer-alert-box {
  position: relative;
  max-width: 480px;
  width: 90%;
  padding: 32px;
  background: linear-gradient(135deg, #242b36 0%, #1a1f28 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  animation: fcAlertSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fcAlertSlideUp {
  from { opacity: 0; transform: translateY(40px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.myio-footer-alert-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.2) 0%, rgba(255, 152, 0, 0.2) 100%);
  border: 2px solid rgba(255, 193, 7, 0.5);
  border-radius: 50%;
  color: #ffc107;
  font-size: 32px;
}

.myio-footer-alert-title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
  letter-spacing: -0.02em;
}

.myio-footer-alert-message {
  margin: 0 0 28px;
  font-size: 16px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  line-height: 1.6;
}

.myio-footer-alert-button {
  width: 100%;
  height: 48px;
  font-family: var(--fc-font-family);
  font-size: 15px;
  font-weight: 700;
  text-transform: uppercase;
  background: linear-gradient(135deg, #9E8CBE 0%, #8472A8 100%);
  border: none;
  border-radius: 12px;
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(158, 140, 190, 0.4);
  transition: var(--fc-transition);
}

.myio-footer-alert-button:hover {
  background: linear-gradient(135deg, #B8A5D6 0%, #9E8CBE 100%);
  box-shadow: 0 6px 24px rgba(158, 140, 190, 0.5);
  transform: translateY(-2px);
}

/* ==========================================
   Light Theme Overrides
   ========================================== */

.myio-footer-component--light {
  box-shadow:
    0 -4px 20px rgba(0, 0, 0, 0.1),
    0 -1px 0 rgba(158, 140, 190, 0.2);
}

.myio-footer-component--light .myio-footer-chip-name,
.myio-footer-component--light .myio-footer-chip-value {
  text-shadow: none;
}

.myio-footer-component--light .myio-footer-chip-remove {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.5);
}

.myio-footer-component--light .myio-footer-chip-remove:hover {
  background: rgba(255, 68, 68, 0.15);
  border-color: rgba(255, 68, 68, 0.4);
  color: #dc2626;
}

.myio-footer-component--light .myio-footer-meta {
  box-shadow: none;
}

.myio-footer-component--light .myio-footer-meta-title,
.myio-footer-component--light .myio-footer-totals {
  text-shadow: none;
}

.myio-footer-component--light .myio-footer-empty {
  text-shadow: none;
}

/* ==========================================
   Responsive
   ========================================== */

@media (max-width: 768px) {
  .myio-footer-component {
    height: auto;
    min-height: 46px;
    padding: 8px 12px;
    gap: 10px;
    flex-wrap: wrap;
  }

  .myio-footer-dock {
    order: 2;
    width: 100%;
    padding: 8px 0;
    margin: 0;
  }

  .myio-footer-right {
    order: 1;
    width: 100%;
    justify-content: space-between;
    gap: 10px;
  }

  .myio-footer-meta {
    min-width: auto;
    flex: 1;
  }

  .myio-footer-compare {
    min-width: 80px;
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .myio-footer-chip {
    padding: 4px 8px;
    height: 30px;
  }

  .myio-footer-chip-name {
    font-size: 9px;
  }

  .myio-footer-chip-value {
    font-size: 11px;
  }

  .myio-footer-chip-remove {
    width: 18px;
    height: 18px;
  }

  .myio-footer-chip-remove svg {
    width: 12px;
    height: 12px;
  }
}
`;
}
