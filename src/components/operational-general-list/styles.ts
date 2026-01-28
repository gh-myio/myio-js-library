/**
 * RFC-0152 Phase 3: Operational General List Component Styles
 * Purple theme for operational indicators domain
 */

export const OPERATIONAL_GENERAL_LIST_STYLES = `
/* ====== OPERATIONAL GENERAL LIST COMPONENT ====== */
/* Purple theme for operational indicators */

.myio-operational-list-root {
  /* Operational domain - Purple */
  --operational-primary: #8b5cf6;
  --operational-primary-light: #f3e8ff;
  --operational-primary-dark: #7c3aed;
  --operational-gradient: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  --operational-shadow: rgba(139, 92, 246, 0.35);
  --operational-accent: #a78bfa;

  /* Status colors */
  --status-online-bg: #dcfce7;
  --status-online-border: #22c55e;
  --status-online-text: #166534;
  --status-offline-bg: #fee2e2;
  --status-offline-border: #ef4444;
  --status-offline-text: #991b1b;
  --status-maintenance-bg: #fef3c7;
  --status-maintenance-border: #f59e0b;
  --status-maintenance-text: #92400e;

  /* Availability colors */
  --availability-excellent: #22c55e;
  --availability-warning: #f59e0b;
  --availability-critical: #ef4444;

  /* Common tokens */
  --fs: 0.94;
  --card-grad: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
  --card-bd: #dde7f1;
  --ink-1: #1c2743;
  --ink-2: #6b7a90;
  --shadow: 0 8px 24px rgba(31, 116, 164, 0.08);
  --shadow-hover: 0 14px 36px rgba(31, 116, 164, 0.16);
  --radius: 16px;

  /* Typography */
  --fs-2xs: calc(11px * var(--fs));
  --fs-xs: calc(12px * var(--fs));
  --fs-sm: calc(13px * var(--fs));
  --fs-md: calc(14px * var(--fs));
  --fs-lg: calc(16px * var(--fs));
  --fs-xl: calc(20px * var(--fs));
  --fs-xxl: calc(28px * var(--fs));

  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* ====== LIGHT/DARK THEME MODE ====== */
.myio-operational-list-root[data-theme="light"] {
  --card-grad: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
  --card-bd: #dde7f1;
  --ink-1: #1c2743;
  --ink-2: #6b7a90;
  --bg-primary: #f8fafc;
  --shadow: 0 8px 24px rgba(31, 116, 164, 0.08);
  --shadow-hover: 0 14px 36px rgba(31, 116, 164, 0.16);
}

.myio-operational-list-root[data-theme="dark"] {
  --card-grad: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  --card-bd: #334155;
  --ink-1: #f1f5f9;
  --ink-2: #94a3b8;
  --bg-primary: #0f172a;
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  --shadow-hover: 0 14px 36px rgba(0, 0, 0, 0.4);
}

/* ====== HEADER ====== */
.myio-operational-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--card-bd);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  background: var(--card-grad);
  flex-shrink: 0;
}

.myio-operational-header .header-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.myio-operational-header .header-title h2 {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: 600;
  color: var(--ink-1);
}

.myio-operational-header .equipment-count {
  font-size: var(--fs-sm);
  color: var(--ink-2);
}

.myio-operational-header .header-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

/* ====== SEARCH INPUT ====== */
.myio-operational-header .search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-primary, #f8fafc);
  border: 1px solid var(--card-bd);
  border-radius: 8px;
  min-width: 200px;
  transition: border-color 0.2s ease;
}

.myio-operational-header .search-wrap:focus-within {
  border-color: var(--operational-primary);
}

.myio-operational-header .search-wrap .search-icon {
  color: var(--ink-2);
  font-size: 14px;
}

.myio-operational-header .search-wrap input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: var(--fs-sm);
  color: var(--ink-1);
  outline: none;
  padding: 0;
}

.myio-operational-header .search-wrap input::placeholder {
  color: var(--ink-2);
}

/* ====== FILTER SELECTS ====== */
.myio-operational-header .filter-select {
  padding: 8px 12px;
  border: 1px solid var(--card-bd);
  border-radius: 8px;
  background: var(--bg-primary, #f8fafc);
  color: var(--ink-1);
  font-size: var(--fs-sm);
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s ease;
}

.myio-operational-header .filter-select:focus {
  border-color: var(--operational-primary);
}

.myio-operational-list-root[data-theme="dark"] .filter-select {
  background: #1e293b;
}

/* ====== GRID SECTION ====== */
.myio-operational-grid {
  flex: 1;
  overflow: auto;
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  align-content: start;
}

@media (min-width: 1920px) {
  .myio-operational-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }
}

@media (min-width: 1600px) and (max-width: 1919px) {
  .myio-operational-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 18px;
  }
}

@media (min-width: 1280px) and (max-width: 1599px) {
  .myio-operational-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
}

@media (max-width: 1279px) {
  .myio-operational-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
  }
}

/* ====== EQUIPMENT CARD ====== */
.equipment-card {
  position: relative;
  background: var(--card-grad);
  border: 1px solid var(--card-bd);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
}

.equipment-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
  border-color: var(--operational-accent);
}

/* Card Header */
.equipment-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.equipment-card .card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.equipment-card .card-name {
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--ink-1);
}

.equipment-card .card-type {
  font-size: var(--fs-xs);
  color: var(--ink-2);
}

.equipment-card .card-location {
  font-size: var(--fs-xs);
  color: var(--operational-primary);
  font-weight: 500;
}

/* Status Badge */
.equipment-card .status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: var(--fs-xs);
  font-weight: 600;
  border: 1px solid;
}

/* Reversal Warning */
.equipment-card .reversal-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid var(--status-maintenance-border);
  border-radius: 8px;
  font-size: var(--fs-sm);
  color: var(--status-maintenance-text);
  animation: pulse-warning 2s ease-in-out infinite;
}

@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Availability Gauge */
.equipment-card .availability-gauge {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 16px auto;
}

.equipment-card .availability-gauge svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.equipment-card .availability-gauge .gauge-bg {
  fill: none;
  stroke: var(--card-bd);
  stroke-width: 10;
}

.equipment-card .availability-gauge .gauge-value {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
}

.equipment-card .gauge-label {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.equipment-card .gauge-label .value {
  font-size: var(--fs-xxl);
  font-weight: 700;
  color: var(--ink-1);
}

.equipment-card .gauge-label .label {
  font-size: var(--fs-xs);
  color: var(--ink-2);
}

/* Metrics Row */
.equipment-card .metrics-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--card-bd);
  border-bottom: 1px solid var(--card-bd);
}

.equipment-card .metric {
  display: flex;
  align-items: center;
  gap: 8px;
}

.equipment-card .metric-icon {
  font-size: 18px;
}

.equipment-card .metric-data {
  display: flex;
  flex-direction: column;
}

.equipment-card .metric-label {
  font-size: var(--fs-2xs);
  color: var(--ink-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.equipment-card .metric-value {
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--ink-1);
}

/* Alerts Badge */
.equipment-card .alerts-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: var(--fs-sm);
  color: var(--status-offline-text);
}

/* Card Footer */
.equipment-card .card-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--card-bd);
}

.equipment-card .customer-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: var(--operational-primary-light);
  border-radius: 6px;
  font-size: var(--fs-xs);
  color: var(--operational-primary-dark);
  font-weight: 500;
}

/* ====== LOADING STATE ====== */
.myio-operational-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.95);
  z-index: 100;
  backdrop-filter: blur(4px);
}

.myio-operational-list-root[data-theme="dark"] .myio-operational-loading {
  background: rgba(15, 23, 42, 0.95);
}

.myio-operational-loading .spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--card-bd);
  border-top-color: var(--operational-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.myio-operational-loading p {
  margin-top: 16px;
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--ink-1);
}

/* ====== EMPTY STATE ====== */
.myio-operational-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.myio-operational-empty .empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.myio-operational-empty p {
  font-size: var(--fs-lg);
  color: var(--ink-2);
  margin: 0;
}

/* ====== SCROLLBAR STYLING ====== */
.myio-operational-grid::-webkit-scrollbar {
  width: 8px;
}

.myio-operational-grid::-webkit-scrollbar-track {
  background: transparent;
}

.myio-operational-grid::-webkit-scrollbar-thumb {
  background: var(--card-bd);
  border-radius: 4px;
}

.myio-operational-grid::-webkit-scrollbar-thumb:hover {
  background: var(--ink-2);
}
`;

/**
 * Inject styles into the document
 */
export function injectOperationalGeneralListStyles(): void {
  const styleId = 'operational-general-list-styles';

  // Check if already injected
  if (document.getElementById(styleId)) {
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = OPERATIONAL_GENERAL_LIST_STYLES;
  document.head.appendChild(styleElement);
}

/**
 * Remove injected styles from the document
 */
export function removeOperationalGeneralListStyles(): void {
  const styleElement = document.getElementById('operational-general-list-styles');
  if (styleElement) {
    styleElement.remove();
  }
}
