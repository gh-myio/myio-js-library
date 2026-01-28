/**
 * RFC-0152 Phase 4: Device Operational Card Styles
 * CSS styles for the DeviceOperationalCard component
 */

export const DEVICE_OPERATIONAL_CARD_STYLES = `
/* ==========================================
   ALARMS DEVICE GRID - RFC-0152 Phase 4
   ========================================== */

/* Root Container */
.myio-alarms-grid-root {
  --alarms-bg-primary: #ffffff;
  --alarms-bg-secondary: #f8fafc;
  --alarms-bg-card: #ffffff;
  --alarms-text-primary: #1e293b;
  --alarms-text-secondary: #64748b;
  --alarms-text-muted: #94a3b8;
  --alarms-border: #e2e8f0;
  --alarms-border-hover: #cbd5e1;
  --alarms-shadow: rgba(0, 0, 0, 0.1);
  --alarms-accent: #8b5cf6;
  --alarms-accent-light: rgba(139, 92, 246, 0.1);
  --myio-chip-ok-bg: #dbeafe;
  --myio-chip-ok-fg: #1d4ed8;
  --myio-chip-standby-bg: #dcfce7;
  --myio-chip-standby-fg: #15803d;
  --myio-chip-alert-bg: #fef3c7;
  --myio-chip-alert-fg: #b45309;
  --myio-chip-failure-bg: #fee2e2;
  --myio-chip-failure-fg: #b91c1c;
  --myio-chip-power-off-bg: #fecaca;
  --myio-chip-power-off-fg: #dc2626;
  --myio-chip-offline-bg: #e2e8f0;
  --myio-chip-offline-fg: #475569;
  --myio-chip-no-info-bg: #fed7aa;
  --myio-chip-no-info-fg: #c2410c;
  --myio-chip-not-installed-bg: #e9d5ff;
  --myio-chip-not-installed-fg: #7c3aed;

  font-family: 'Inter', 'Roboto', 'Segoe UI', sans-serif;
  background: var(--alarms-bg-primary);
  color: var(--alarms-text-primary);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Dark Theme */
.myio-alarms-grid-root[data-theme="dark"] {
  --alarms-bg-primary: #0f172a;
  --alarms-bg-secondary: #1e293b;
  --alarms-bg-card: #1e293b;
  --alarms-text-primary: #f1f5f9;
  --alarms-text-secondary: #94a3b8;
  --alarms-text-muted: #64748b;
  --alarms-border: #334155;
  --alarms-border-hover: #475569;
  --alarms-shadow: rgba(0, 0, 0, 0.3);
  --myio-chip-offline-bg: #1e293b;
}

/* ==========================================
   HEADER
   ========================================== */

.myio-alarms-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 20px;
  background: var(--alarms-bg-secondary);
  border-bottom: 1px solid var(--alarms-border);
}

.myio-alarms-header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.myio-alarms-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--alarms-text-primary);
}

.myio-alarms-count {
  font-size: 14px;
  color: var(--alarms-text-secondary);
  background: var(--alarms-bg-primary);
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid var(--alarms-border);
}

/* Stats Row */
.myio-alarms-stats-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.myio-alarms-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--alarms-bg-primary);
  border: 1px solid var(--alarms-border);
  border-radius: 8px;
  font-size: 13px;
}

.myio-alarms-stat-value {
  font-weight: 700;
  font-size: 16px;
}

.myio-alarms-stat-label {
  color: var(--alarms-text-secondary);
}

.myio-alarms-stat.critical {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.myio-alarms-stat.critical .myio-alarms-stat-value {
  color: #ef4444;
}

.myio-alarms-stat.high {
  border-color: #f97316;
  background: rgba(249, 115, 22, 0.05);
}

.myio-alarms-stat.high .myio-alarms-stat-value {
  color: #f97316;
}

.myio-alarms-stat.open {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.myio-alarms-stat.open .myio-alarms-stat-value {
  color: #3b82f6;
}

/* ==========================================
   FILTERS ROW
   ========================================== */

.myio-alarms-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.myio-alarms-search-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 300px;
}

.myio-alarms-search-wrap .search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--alarms-text-muted);
  font-size: 14px;
  pointer-events: none;
}

.myio-alarms-search-wrap input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 1px solid var(--alarms-border);
  border-radius: 8px;
  font-size: 14px;
  background: var(--alarms-bg-primary);
  color: var(--alarms-text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.myio-alarms-search-wrap input:focus {
  outline: none;
  border-color: var(--alarms-accent);
  box-shadow: 0 0 0 3px var(--alarms-accent-light);
}

.myio-alarms-search-wrap input::placeholder {
  color: var(--alarms-text-muted);
}

.myio-alarms-filter-select {
  padding: 10px 32px 10px 12px;
  border: 1px solid var(--alarms-border);
  border-radius: 8px;
  font-size: 14px;
  background: var(--alarms-bg-primary);
  color: var(--alarms-text-primary);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  min-width: 140px;
}

.myio-alarms-filter-select:focus {
  outline: none;
  border-color: var(--alarms-accent);
  box-shadow: 0 0 0 3px var(--alarms-accent-light);
}

/* ==========================================
   GRID CONTAINER
   ========================================== */

.myio-alarms-grid {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
  align-content: start;
}

/* ==========================================
   ALARM CARD
   ========================================== */

.myio-alarm-card {
  background: var(--alarms-bg-card);
  border: 1px solid var(--alarms-border);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
}

.myio-alarm-card:hover {
  border-color: var(--alarms-border-hover);
  box-shadow: 0 4px 12px var(--alarms-shadow);
  transform: translateY(-2px);
}

/* Severity Bar */
.myio-alarm-card .severity-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
}

/* Card Content */
.myio-alarm-card-content {
  padding: 16px 16px 16px 20px;
}

/* Card Header */
.myio-alarm-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.myio-alarm-card-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Head-office chip styles (aligned) */
.myio-alarms-grid-root .chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  gap: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.myio-alarms-grid-root .chip--ok,
.myio-alarms-grid-root .chip--power-on {
  background: var(--myio-chip-ok-bg);
  color: var(--myio-chip-ok-fg);
}

.myio-alarms-grid-root .chip--standby {
  background: var(--myio-chip-standby-bg);
  color: var(--myio-chip-standby-fg);
}

.myio-alarms-grid-root .chip--alert,
.myio-alarms-grid-root .chip--warning,
.myio-alarms-grid-root .chip--maintenance {
  background: var(--myio-chip-alert-bg);
  color: var(--myio-chip-alert-fg);
}

.myio-alarms-grid-root .chip--failure {
  background: var(--myio-chip-failure-bg);
  color: var(--myio-chip-failure-fg);
}

.myio-alarms-grid-root .chip--offline {
  background: var(--myio-chip-offline-bg);
  color: var(--myio-chip-offline-fg);
}

.myio-alarms-grid-root .chip--power-off {
  background: var(--myio-chip-power-off-bg);
  color: var(--myio-chip-power-off-fg);
}

.myio-alarms-grid-root .chip--no-info {
  background: var(--myio-chip-no-info-bg);
  color: var(--myio-chip-no-info-fg);
}

.myio-alarms-grid-root .chip--not-installed {
  background: var(--myio-chip-not-installed-bg);
  color: var(--myio-chip-not-installed-fg);
}

.myio-alarm-card-time {
  font-size: 12px;
  color: var(--alarms-text-muted);
  white-space: nowrap;
}

/* Card Title */
.myio-alarm-card-title {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--alarms-text-primary);
  line-height: 1.4;
}

.myio-alarm-card-id {
  font-size: 12px;
  color: var(--alarms-text-muted);
  font-family: monospace;
  margin-bottom: 12px;
}

/* Customer Info */
.myio-alarm-customer-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.myio-alarm-customer-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--alarms-accent-light);
  color: var(--alarms-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.myio-alarm-customer-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.myio-alarm-customer-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--alarms-text-primary);
}

.myio-alarm-source {
  font-size: 12px;
  color: var(--alarms-text-secondary);
}

/* Stats Row */
.myio-alarm-card-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--alarms-border);
  border-bottom: 1px solid var(--alarms-border);
  margin-bottom: 12px;
}

.myio-alarm-stat-item {
  text-align: center;
}

.myio-alarm-stat-item .stat-value {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--alarms-text-primary);
}

.myio-alarm-stat-item .stat-label {
  display: block;
  font-size: 11px;
  color: var(--alarms-text-muted);
  margin-top: 2px;
}

/* Tags Row */
.myio-alarm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.myio-alarm-tag {
  display: inline-flex;
  padding: 4px 8px;
  background: var(--alarms-bg-secondary);
  border-radius: 4px;
  font-size: 11px;
  color: var(--alarms-text-secondary);
}

.myio-alarm-tag.more {
  background: var(--alarms-accent-light);
  color: var(--alarms-accent);
}

/* Card Actions */
.myio-alarm-card-actions {
  display: flex;
  gap: 8px;
}

.myio-alarm-card-actions button {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--alarms-border);
  border-radius: 6px;
  background: var(--alarms-bg-primary);
  color: var(--alarms-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.myio-alarm-card-actions button:hover {
  background: var(--alarms-bg-secondary);
  border-color: var(--alarms-border-hover);
  color: var(--alarms-text-primary);
}

.myio-alarm-card-actions button.btn-ack {
  background: var(--alarms-accent);
  border-color: var(--alarms-accent);
  color: white;
}

.myio-alarm-card-actions button.btn-ack:hover {
  background: #7c3aed;
  border-color: #7c3aed;
}

.myio-alarm-card-actions button.btn-more {
  flex: 0 0 40px;
  padding: 8px;
}

/* Active/Critical Animation */
.myio-alarm-card.is-critical {
  animation: alarmPulse 2s ease-in-out infinite;
}

@keyframes alarmPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
  }
}

/* ==========================================
   LOADING STATE
   ========================================== */

.myio-alarms-loading {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 20px;
  color: var(--alarms-text-secondary);
}

.myio-alarms-loading.show {
  display: flex;
}

.myio-alarms-loading .spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--alarms-border);
  border-top-color: var(--alarms-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ==========================================
   EMPTY STATE
   ========================================== */

.myio-alarms-empty {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--alarms-text-secondary);
}

.myio-alarms-empty.show {
  display: flex;
}

.myio-alarms-empty .empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.myio-alarms-empty p {
  margin: 0;
  font-size: 14px;
}

/* ==========================================
   RESPONSIVE
   ========================================== */

@media (max-width: 768px) {
  .myio-alarms-header {
    padding: 12px 16px;
  }

  .myio-alarms-header-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .myio-alarms-stats-row {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .myio-alarms-filters {
    width: 100%;
  }

  .myio-alarms-search-wrap {
    max-width: none;
    width: 100%;
  }

  .myio-alarms-filter-select {
    flex: 1;
    min-width: 0;
  }

  .myio-alarms-grid {
    padding: 16px;
    grid-template-columns: 1fr;
  }

  .myio-alarm-card-stats {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 480px) {
  .myio-alarms-stat {
    padding: 6px 10px;
  }

  .myio-alarms-stat-value {
    font-size: 14px;
  }

  .myio-alarms-stat-label {
    font-size: 11px;
  }
}
`;

let stylesInjected = false;

/**
 * Inject the device operational card styles into the document head
 */
export function injectDeviceOperationalCardStyles(): void {
  if (stylesInjected) return;

  const styleId = 'myio-device-operational-card-styles';
  if (document.getElementById(styleId)) {
    stylesInjected = true;
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = styleId;
  styleElement.textContent = DEVICE_OPERATIONAL_CARD_STYLES;
  document.head.appendChild(styleElement);
  stylesInjected = true;
}

/**
 * Remove the device operational card styles from the document head
 */
export function removeDeviceOperationalCardStyles(): void {
  const styleId = 'myio-device-operational-card-styles';
  const styleElement = document.getElementById(styleId);
  if (styleElement) {
    styleElement.remove();
    stylesInjected = false;
  }
}
