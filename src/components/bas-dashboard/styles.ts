/**
 * RFC-0158: Building Automation System (BAS) Dashboard Styles
 * Aligned with TARGET design: Dark navy background, high contrast, enterprise-grade
 */

export const BAS_DASHBOARD_CSS_PREFIX = 'bas-dashboard';

export const BAS_DASHBOARD_STYLES = `
/* RFC-0158: BAS Dashboard Component Styles - TARGET Aligned */

/* CSS Variables - Dark Theme (Default) */
.${BAS_DASHBOARD_CSS_PREFIX} {
  --bas-bg-main: #0B1220;
  --bas-bg-panel: #101A2B;
  --bas-bg-card: #FFFFFF;
  --bas-border-subtle: rgba(255, 255, 255, 0.10);
  --bas-text-primary: rgba(255, 255, 255, 0.92);
  --bas-text-muted: rgba(255, 255, 255, 0.60);
  --bas-text-on-card: #1a1a1a;
  --bas-text-muted-on-card: #666;
  --bas-primary-color: #2F5848;
  --bas-primary-light: #3d7a62;
  --bas-success-color: #2e7d32;
  --bas-warning-color: #f57c00;
  --bas-error-color: #c62828;
  --bas-hover-bg: rgba(255, 255, 255, 0.05);
  --bas-active-bg: rgba(47, 88, 72, 0.3);

  /* Spacing system */
  --bas-space-8: 8px;
  --bas-space-12: 12px;
  --bas-space-16: 16px;
  --bas-space-18: 18px;
  --bas-space-24: 24px;
  --bas-gap: 18px;

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  font-family: 'Roboto', 'Segoe UI', sans-serif;
  overflow: hidden;
  background: var(--bas-bg-main);
  color: var(--bas-text-primary);
}

/* Light theme override */
.${BAS_DASHBOARD_CSS_PREFIX}--light {
  --bas-bg-main: #f0f2f5;
  --bas-bg-panel: #ffffff;
  --bas-bg-card: #FFFFFF;
  --bas-border-subtle: rgba(0, 0, 0, 0.08);
  --bas-text-primary: #1a1a1a;
  --bas-text-muted: #666;
  --bas-text-on-card: #1a1a1a;
  --bas-text-muted-on-card: #666;
  --bas-hover-bg: rgba(0, 0, 0, 0.04);
  --bas-active-bg: rgba(47, 88, 72, 0.15);
}

/* ========================================
   HEADER
   ======================================== */
.${BAS_DASHBOARD_CSS_PREFIX}__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--bas-space-16) var(--bas-space-24);
  background: var(--bas-bg-panel);
  border-bottom: 1px solid var(--bas-border-subtle);
}

.${BAS_DASHBOARD_CSS_PREFIX}__title {
  font-size: 18px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--bas-text-primary);
  margin: 0;
}

/* ========================================
   MAIN CONTENT - 3 Column Layout
   ======================================== */
.${BAS_DASHBOARD_CSS_PREFIX}__content {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: var(--bas-bg-main);
}

/* ========================================
   MAIN AREA
   ======================================== */
.${BAS_DASHBOARD_CSS_PREFIX}__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bas-bg-main);
}

/* ========================================
   RIGHT PANEL - Lists (Environments & Motors)
   ======================================== */
.${BAS_DASHBOARD_CSS_PREFIX}__right-panel {
  width: 520px;
  min-width: 520px;
  display: flex;
  flex-direction: row;
  background: var(--bas-bg-panel);
  border-left: 1px solid var(--bas-border-subtle);
  overflow: hidden;
}

/* Panels-only mode: right panel fills entire container */
.${BAS_DASHBOARD_CSS_PREFIX}__content--panels-only {
  flex: 1;
}

.${BAS_DASHBOARD_CSS_PREFIX}__content--panels-only .${BAS_DASHBOARD_CSS_PREFIX}__right-panel {
  width: 100%;
  min-width: unset;
  border-left: none;
}

.${BAS_DASHBOARD_CSS_PREFIX}__panel-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.${BAS_DASHBOARD_CSS_PREFIX}__panel-section + .${BAS_DASHBOARD_CSS_PREFIX}__panel-section {
  border-left: 1px solid var(--bas-border-subtle);
}

.${BAS_DASHBOARD_CSS_PREFIX}__panel-header {
  padding: var(--bas-space-16);
  border-bottom: 1px solid var(--bas-border-subtle);
}

.${BAS_DASHBOARD_CSS_PREFIX}__panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--bas-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.${BAS_DASHBOARD_CSS_PREFIX}__panel-list {
  flex: 1;
  overflow-y: auto;
}

/* ========================================
   HVAC List Items - Row Style
   ======================================== */
.${BAS_DASHBOARD_CSS_PREFIX}__hvac-item {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 var(--bas-space-16);
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-bottom: 1px solid var(--bas-border-subtle);
}

.${BAS_DASHBOARD_CSS_PREFIX}__hvac-item:hover {
  background: var(--bas-hover-bg);
}

.${BAS_DASHBOARD_CSS_PREFIX}__hvac-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: var(--bas-space-12);
  flex-shrink: 0;
}

.${BAS_DASHBOARD_CSS_PREFIX}__hvac-status--active {
  background: var(--bas-success-color);
  box-shadow: 0 0 8px rgba(46, 125, 50, 0.5);
}

.${BAS_DASHBOARD_CSS_PREFIX}__hvac-status--inactive {
  background: var(--bas-text-muted);
}

.${BAS_DASHBOARD_CSS_PREFIX}__hvac-status--no_reading {
  background: var(--bas-warning-color);
}

.${BAS_DASHBOARD_CSS_PREFIX}__hvac-info {
  flex: 1;
  min-width: 0;
}

.${BAS_DASHBOARD_CSS_PREFIX}__hvac-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--bas-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.${BAS_DASHBOARD_CSS_PREFIX}__hvac-floor {
  font-size: 11px;
  color: var(--bas-text-muted);
  margin-top: 2px;
}

.${BAS_DASHBOARD_CSS_PREFIX}__hvac-values {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: var(--bas-space-12);
}

.${BAS_DASHBOARD_CSS_PREFIX}__hvac-temp {
  font-size: 16px;
  font-weight: 700;
  color: var(--bas-primary-light);
}

.${BAS_DASHBOARD_CSS_PREFIX}__hvac-consumption {
  font-size: 11px;
  color: var(--bas-text-muted);
  margin-top: 2px;
}

/* ========================================
   Motor/Pump List Items - Row Style
   ======================================== */
.${BAS_DASHBOARD_CSS_PREFIX}__motor-item {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 var(--bas-space-16);
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-bottom: 1px solid var(--bas-border-subtle);
}

.${BAS_DASHBOARD_CSS_PREFIX}__motor-item:hover {
  background: var(--bas-hover-bg);
}

.${BAS_DASHBOARD_CSS_PREFIX}__motor-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: var(--bas-space-12);
  flex-shrink: 0;
}

.${BAS_DASHBOARD_CSS_PREFIX}__motor-status--running {
  background: var(--bas-success-color);
  box-shadow: 0 0 8px rgba(46, 125, 50, 0.5);
}

.${BAS_DASHBOARD_CSS_PREFIX}__motor-status--stopped {
  background: var(--bas-text-muted);
}

.${BAS_DASHBOARD_CSS_PREFIX}__motor-status--unknown {
  background: var(--bas-warning-color);
}

.${BAS_DASHBOARD_CSS_PREFIX}__motor-info {
  flex: 1;
  min-width: 0;
}

.${BAS_DASHBOARD_CSS_PREFIX}__motor-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--bas-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.${BAS_DASHBOARD_CSS_PREFIX}__motor-type {
  font-size: 11px;
  color: var(--bas-text-muted);
  text-transform: capitalize;
  margin-top: 2px;
}

.${BAS_DASHBOARD_CSS_PREFIX}__motor-consumption {
  font-size: 16px;
  font-weight: 700;
  color: var(--bas-primary-light);
  margin-left: var(--bas-space-12);
}

.${BAS_DASHBOARD_CSS_PREFIX}__motor-consumption--off {
  color: var(--bas-text-muted);
  font-weight: 500;
}

/* ========================================
   STATES: Empty, Loading
   ======================================== */
.${BAS_DASHBOARD_CSS_PREFIX}__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--bas-space-24);
  color: var(--bas-text-muted);
  font-size: 13px;
}

.${BAS_DASHBOARD_CSS_PREFIX}__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--bas-space-24);
}

.${BAS_DASHBOARD_CSS_PREFIX}__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--bas-border-subtle);
  border-top-color: var(--bas-primary-color);
  border-radius: 50%;
  animation: bas-spin 0.8s linear infinite;
}

@keyframes bas-spin {
  to { transform: rotate(360deg); }
}

/* ========================================
   RESPONSIVE
   ======================================== */
@media (max-width: 1400px) {
  .${BAS_DASHBOARD_CSS_PREFIX}__right-panel {
    width: 440px;
    min-width: 440px;
  }
}

@media (max-width: 1200px) {
  .${BAS_DASHBOARD_CSS_PREFIX}__charts-grid {
    grid-template-columns: 1fr;
  }

  .${BAS_DASHBOARD_CSS_PREFIX}__right-panel {
    width: 380px;
    min-width: 380px;
  }
}

@media (max-width: 900px) {
  .${BAS_DASHBOARD_CSS_PREFIX}__content {
    flex-direction: column;
  }

  .${BAS_DASHBOARD_CSS_PREFIX}__right-panel {
    width: 100%;
    min-width: unset;
    border-left: none;
    border-top: 1px solid var(--bas-border-subtle);
    max-height: 280px;
  }

  .${BAS_DASHBOARD_CSS_PREFIX}__panel-section {
    flex: 1;
  }

  .${BAS_DASHBOARD_CSS_PREFIX}__panel-section:first-child {
    border-left: none;
  }
}
`;

let styleInjected = false;

export function injectBASDashboardStyles(): void {
  if (styleInjected) return;

  const styleElement = document.createElement('style');
  styleElement.id = 'bas-dashboard-styles';
  styleElement.textContent = BAS_DASHBOARD_STYLES;
  document.head.appendChild(styleElement);
  styleInjected = true;
}

export function removeBASDashboardStyles(): void {
  const styleElement = document.getElementById('bas-dashboard-styles');
  if (styleElement) {
    styleElement.remove();
    styleInjected = false;
  }
}
