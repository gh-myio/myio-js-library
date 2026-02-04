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
   EQUIPMENT CARD (RFC-157 Enhanced)
   ========================================== */

.myio-equipment-card {
  background: var(--grid-bg-card);
  border: 1px solid var(--grid-border);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
  /* RFC-157: Reduced min-height for compact layout */
  min-height: 180px;
}

.myio-equipment-card:hover {
  border-color: var(--grid-border-hover);
  box-shadow: 0 4px 12px var(--grid-shadow);
  transform: translateY(-2px);
}

/* RFC-157: Absolute positioned checkbox in top-right corner */
.myio-equipment-card-select-absolute {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  width: 20px;
  height: 20px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.myio-equipment-card-select-absolute .equipment-card-checkbox {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.myio-equipment-card-select-absolute .equipment-card-checkbox-ui {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid var(--grid-border);
  background: var(--grid-bg-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.myio-equipment-card-select-absolute .equipment-card-checkbox-ui::after {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: transparent;
  transform: scale(0.5);
  transition: all 0.15s ease;
}

.myio-equipment-card-select-absolute .equipment-card-checkbox:checked + .equipment-card-checkbox-ui {
  border-color: #7c3aed;
  background: rgba(124, 58, 237, 0.15);
}

.myio-equipment-card-select-absolute .equipment-card-checkbox:checked + .equipment-card-checkbox-ui::after {
  background: #7c3aed;
  transform: scale(1);
}

.myio-equipment-card-select-absolute:hover .equipment-card-checkbox-ui {
  border-color: #7c3aed;
}

/* RFC-157: Cut-out Header Bar (Identity Bar) */
.myio-equipment-card-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  padding-right: 36px; /* Space for checkbox */
  background: var(--grid-bg-secondary);
  border-bottom: 1px solid var(--grid-border);
  gap: 8px;
  position: relative;
}

/* Status-based header accent - Full width top line */
.myio-equipment-card-header-bar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--grid-border);
}

.myio-equipment-card-header-bar.online::before {
  background: #22c55e;
}
.myio-equipment-card-header-bar.offline::before {
  background: #ef4444;
}
.myio-equipment-card-header-bar.maintenance::before {
  background: #f97316;
}
.myio-equipment-card-header-bar.warning::before {
  background: #eab308;
}

.myio-equipment-card-header-bar .header-bar-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.myio-equipment-card-header-bar .myio-equipment-card-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--grid-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.myio-equipment-card-header-bar .myio-equipment-card-type {
  display: block;
  font-size: 10px;
  color: var(--grid-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

/* RFC-157: Card Body (Compact) */
.myio-equipment-card-body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

/* Legacy support: Card Content */
.myio-equipment-card-content {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Legacy: Card Header */
.myio-equipment-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

/* Selection checkbox */
.myio-equipment-card-select {
  position: relative;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.equipment-card-checkbox {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.equipment-card-checkbox-ui {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--grid-border);
  background: rgba(15, 23, 42, 0.4);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.equipment-card-checkbox-ui::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: transparent;
  transform: scale(0.6);
  transition: all 0.15s ease;
}

.equipment-card-checkbox:checked + .equipment-card-checkbox-ui {
  border-color: #7c3aed;
  background: rgba(124, 58, 237, 0.2);
}

.equipment-card-checkbox:checked + .equipment-card-checkbox-ui::after {
  background: #7c3aed;
  transform: scale(1);
}

.myio-equipment-card.is-selected {
  border-color: rgba(124, 58, 237, 0.6);
  box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.4);
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

/* Status Icon (simplified - icon only) */
.myio-equipment-status-icon {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

/* Legacy: Status Badge */
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

/* Reversal Warning (RFC-157: Compact) */
.myio-equipment-reversal-warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid #f59e0b;
  border-radius: 5px;
  padding: 5px 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 8px;
  font-size: 10px;
  color: #92400e;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* RFC-157: 3-Column Metrics Row (Disponibilidade | MTBF | MTTR) */
.myio-equipment-metrics-row {
  display: flex;
  align-items: stretch;
  gap: 6px;
  margin-bottom: 8px;
}

.myio-equipment-metric-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 6px;
  background: var(--grid-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--grid-border);
  min-width: 0;
}

.myio-equipment-metric-block-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--grid-text-primary);
  line-height: 1;
}

.myio-equipment-metric-block-label {
  font-size: 9px;
  font-weight: 600;
  color: var(--grid-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  text-align: center;
}

/* MTBF Block - Blue accent */
.myio-equipment-metric-block.mtbf {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
}

.myio-equipment-metric-block.mtbf .myio-equipment-metric-block-value {
  color: #3b82f6;
}

/* MTTR Block - Orange accent */
.myio-equipment-metric-block.mttr {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}

.myio-equipment-metric-block.mttr .myio-equipment-metric-block-value {
  color: #f59e0b;
}

/* Gauge backgrounds (shared) */
.myio-equipment-gauge-bg {
  fill: none;
  stroke: var(--grid-border);
  stroke-width: 4;
}

.myio-equipment-gauge-fill {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
}

/* Legacy support: Old availability layout */
.myio-equipment-availability {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.myio-equipment-gauge {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}

.myio-equipment-gauge svg {
  width: 100%;
  height: 100%;
  display: block;
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
  font-size: 12px;
  font-weight: 700;
  color: var(--grid-text-primary);
  line-height: 1;
}

.myio-equipment-gauge-value .label {
  font-size: 7px;
  color: var(--grid-text-muted);
  line-height: 1;
  margin-top: 1px;
}

/* Legacy: Metrics column layout */
.myio-equipment-metrics {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.myio-equipment-metric {
  display: flex;
  align-items: center;
  gap: 5px;
}

.myio-equipment-metric-icon {
  font-size: 11px;
}

.myio-equipment-metric-info {
  display: flex;
  flex-direction: column;
}

.myio-equipment-metric-label {
  font-size: 8px;
  color: var(--grid-text-muted);
  line-height: 1;
}

.myio-equipment-metric-value {
  font-size: 11px;
  font-weight: 600;
  color: var(--grid-text-primary);
  line-height: 1.2;
}

/* Alerts Row (RFC-157: Compact) */
.myio-equipment-alerts {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 5px;
  margin-bottom: 6px;
  font-size: 10px;
  color: #dc2626;
}

/* RFC-157: Footer with Customer + Location + Warnings */
.myio-equipment-footer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid var(--grid-border);
}

.myio-equipment-footer-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.myio-equipment-footer .myio-equipment-customer {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}

/* Footer Warnings Row (Reversão + Alertas) */
.myio-equipment-footer-warnings {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.myio-equipment-warning-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  font-weight: 500;
  color: var(--grid-text-secondary);
  white-space: nowrap;
}

.myio-equipment-warning-tag.reversal {
  color: #f59e0b;
}

.myio-equipment-warning-tag.alerts {
  color: #ef4444;
}

.myio-equipment-location {
  font-size: 9px;
  color: var(--grid-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
  text-align: right;
}

/* Customer Badge (RFC-157: Compact) */
.myio-equipment-customer {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid var(--grid-border);
  min-width: 0;
  flex: 1;
}

/* RFC-157: Compact customer avatar */
.myio-equipment-customer-avatar {
  width: 20px;
  height: 20px;
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
  font-size: 9px;
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
