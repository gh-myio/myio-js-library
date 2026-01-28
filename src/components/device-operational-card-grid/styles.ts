/**
 * RFC-0152 Phase 3: Device Operational Card Grid Styles
 * CSS styles for the grid component
 */

export const DEVICE_OPERATIONAL_CARD_GRID_STYLES = `
/* ==========================================
   DEVICE OPERATIONAL CARD GRID - RFC-0152 Phase 3
   ========================================== */

/* Root Container */
.myio-equipment-grid-root {
  --grid-bg-primary: #ffffff;
  --grid-bg-secondary: #f8fafc;
  --grid-bg-card: #ffffff;
  --grid-text-primary: #1e293b;
  --grid-text-secondary: #64748b;
  --grid-text-muted: #94a3b8;
  --grid-border: #e2e8f0;
  --grid-border-hover: #cbd5e1;
  --grid-shadow: rgba(0, 0, 0, 0.1);
  --grid-accent: #8b5cf6;
  --grid-accent-light: rgba(139, 92, 246, 0.1);

  font-family: 'Inter', 'Roboto', 'Segoe UI', sans-serif;
  background: var(--grid-bg-primary);
  color: var(--grid-text-primary);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Dark Theme */
.myio-equipment-grid-root[data-theme="dark"] {
  --grid-bg-primary: #0f172a;
  --grid-bg-secondary: #1e293b;
  --grid-bg-card: #1e293b;
  --grid-text-primary: #f1f5f9;
  --grid-text-secondary: #94a3b8;
  --grid-text-muted: #64748b;
  --grid-border: #334155;
  --grid-border-hover: #475569;
  --grid-shadow: rgba(0, 0, 0, 0.3);
}

/* ==========================================
   HEADER CONTAINER - Uses Premium Header Component
   ========================================== */

.myio-equipment-header-container {
  flex-shrink: 0;
}

/* Inline Filters Row */
.myio-equipment-inline-filters {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: var(--grid-bg-secondary);
  border-bottom: 1px solid var(--grid-border);
  align-items: center;
  flex-wrap: wrap;
}

/* Hide inline filters for operational grid (use premium filter modal instead) */
.operational-grid-wrap .myio-equipment-inline-filters {
  display: none;
}

/* ==========================================
   FILTERS ROW - Compact inline
   ========================================== */

.myio-equipment-filters {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: center;
  margin-left: auto;
}

.myio-equipment-search-wrap {
  position: relative;
  min-width: 140px;
  max-width: 180px;
}

.myio-equipment-search-wrap .search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--grid-text-muted);
  font-size: 11px;
  pointer-events: none;
}

.myio-equipment-search-wrap input {
  width: 100%;
  padding: 6px 8px 6px 26px;
  border: 1px solid var(--grid-border);
  border-radius: 6px;
  font-size: 11px;
  background: var(--grid-bg-primary);
  color: var(--grid-text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.myio-equipment-search-wrap input:focus {
  outline: none;
  border-color: var(--grid-accent);
  box-shadow: 0 0 0 2px var(--grid-accent-light);
}

.myio-equipment-search-wrap input::placeholder {
  color: var(--grid-text-muted);
}

.myio-equipment-filter-select {
  padding: 6px 24px 6px 8px;
  border: 1px solid var(--grid-border);
  border-radius: 6px;
  font-size: 11px;
  background: var(--grid-bg-primary);
  color: var(--grid-text-primary);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  min-width: 100px;
}

.myio-equipment-filter-select:focus {
  outline: none;
  border-color: var(--grid-accent);
  box-shadow: 0 0 0 2px var(--grid-accent-light);
}

/* ==========================================
   GRID CONTAINER
   ========================================== */

.myio-equipment-grid {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  align-content: start;
}

/* ==========================================
   EQUIPMENT CARD
   ========================================== */

.myio-equipment-card {
  background: var(--grid-bg-card);
  border: 1px solid var(--grid-border);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
  min-height: 220px;
}

.myio-equipment-card:hover {
  border-color: var(--grid-border-hover);
  box-shadow: 0 4px 12px var(--grid-shadow);
  transform: translateY(-2px);
}

/* Status Bar */
.myio-equipment-card .status-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
}

.myio-equipment-card .status-bar.online { background: #22c55e; }
.myio-equipment-card .status-bar.offline { background: #ef4444; }
.myio-equipment-card .status-bar.maintenance { background: #f97316; }
.myio-equipment-card .status-bar.warning { background: #eab308; }

/* Card Content */
.myio-equipment-card-content {
  padding: 12px 12px 12px 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Card Header */
.myio-equipment-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}

.myio-equipment-card-title-wrap {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.myio-equipment-card-title {
  margin: 0 0 2px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--grid-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.myio-equipment-card-type {
  display: block;
  font-size: 11px;
  color: var(--grid-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.myio-equipment-card-location {
  display: block;
  font-size: 10px;
  color: var(--grid-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Status Badge */
.myio-equipment-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border: 1px solid;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Reversal Warning */
.myio-equipment-reversal-warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid #f59e0b;
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 10px;
  color: #92400e;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Availability Gauge */
.myio-equipment-availability {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.myio-equipment-gauge {
  position: relative;
  width: 60px;
  height: 60px;
  flex-shrink: 0;
}

.myio-equipment-gauge svg {
  width: 100%;
  height: 100%;
  display: block;
  transform: rotate(-90deg);
}

.myio-equipment-gauge-bg {
  fill: none;
  stroke: var(--grid-border);
  stroke-width: 6;
}

.myio-equipment-gauge-fill {
  fill: none;
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
}

.myio-equipment-gauge-value {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.myio-equipment-gauge-value .value {
  font-size: 13px;
  font-weight: 700;
  color: var(--grid-text-primary);
  line-height: 1;
}

.myio-equipment-gauge-value .label {
  font-size: 8px;
  color: var(--grid-text-muted);
  line-height: 1;
}

/* Metrics Row */
.myio-equipment-metrics {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.myio-equipment-metric {
  display: flex;
  align-items: center;
  gap: 6px;
}

.myio-equipment-metric-icon {
  font-size: 12px;
}

.myio-equipment-metric-info {
  display: flex;
  flex-direction: column;
}

.myio-equipment-metric-label {
  font-size: 9px;
  color: var(--grid-text-muted);
}

.myio-equipment-metric-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--grid-text-primary);
}

/* Alerts Row */
.myio-equipment-alerts {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  margin: 4px 0 8px 0;
  font-size: 10px;
  color: #dc2626;
}

/* Customer Badge */
.myio-equipment-customer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--grid-border);
}

.myio-equipment-customer-avatar {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: var(--grid-accent-light);
  color: var(--grid-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 700;
  flex-shrink: 0;
}

.myio-equipment-customer-name {
  font-size: 10px;
  color: var(--grid-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ==========================================
   LOADING STATE
   ========================================== */

.myio-equipment-loading {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 20px;
  color: var(--grid-text-secondary);
}

.myio-equipment-loading.show {
  display: flex;
}

.myio-equipment-loading .spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--grid-border);
  border-top-color: var(--grid-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ==========================================
   EMPTY STATE
   ========================================== */

.myio-equipment-empty {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--grid-text-secondary);
}

.myio-equipment-empty.show {
  display: flex;
}

.myio-equipment-empty .empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.myio-equipment-empty p {
  margin: 0;
  font-size: 14px;
}

/* ==========================================
   RESPONSIVE
   ========================================== */

@media (max-width: 1024px) {
  .myio-equipment-header {
    flex-wrap: wrap;
  }

  .myio-equipment-filters {
    margin-left: 0;
    width: 100%;
    flex-wrap: wrap;
  }
}

@media (max-width: 768px) {
  .myio-equipment-header {
    padding: 8px 12px;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .myio-equipment-header-top {
    justify-content: space-between;
    width: 100%;
  }

  .myio-equipment-stats-row {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 4px;
    flex-wrap: nowrap;
  }

  .myio-equipment-filters {
    width: 100%;
    flex-wrap: wrap;
  }

  .myio-equipment-search-wrap {
    max-width: none;
    flex: 1;
    min-width: 120px;
  }

  .myio-equipment-filter-select {
    flex: 1;
    min-width: 80px;
  }

  .myio-equipment-grid {
    padding: 8px;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .myio-equipment-stat {
    padding: 3px 6px;
  }

  .myio-equipment-stat-value {
    font-size: 11px;
  }

  .myio-equipment-stat-label {
    font-size: 9px;
  }

  .myio-equipment-grid {
    grid-template-columns: 1fr;
  }
}
`;

let stylesInjected = false;

/**
 * Inject the device operational card grid styles into the document head
 */
export function injectDeviceOperationalCardGridStyles(): void {
  if (stylesInjected) return;

  const styleId = 'myio-device-operational-card-grid-styles';
  if (document.getElementById(styleId)) {
    stylesInjected = true;
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = DEVICE_OPERATIONAL_CARD_GRID_STYLES;
  document.head.appendChild(styleElement);
  stylesInjected = true;
}

/**
 * Remove the device operational card grid styles from the document head
 */
export function removeDeviceOperationalCardGridStyles(): void {
  const styleId = 'myio-device-operational-card-grid-styles';
  const styleElement = document.getElementById(styleId);
  if (styleElement) {
    styleElement.remove();
    stylesInjected = false;
  }
}
