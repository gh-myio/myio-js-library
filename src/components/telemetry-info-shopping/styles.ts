/**
 * RFC-0148: TelemetryInfoShopping Component Styles
 * All styles are scoped to .telemetry-info-root to prevent conflicts
 */

export const TELEMETRY_INFO_SHOPPING_STYLES = `
/* ========== TELEMETRY INFO SHOPPING - SCOPED STYLES ========== */
/* All rules prefixed with .telemetry-info-root to avoid conflicts */

/* ========== CSS VARIABLES ========== */
.telemetry-info-root {
  --tis-primary: #5B2EBC;
  --tis-accent: #00C896;
  --tis-bg: #FFFFFF;
  --tis-bg-secondary: #F9F9F9;
  --tis-text: #222222;
  --tis-text-secondary: #666666;
  --tis-text-tertiary: #999999;
  --tis-border: #E0E0E0;
  --tis-border-light: #F0F0F0;
  --tis-shadow: rgba(0, 0, 0, 0.05);
  --tis-shadow-hover: rgba(0, 0, 0, 0.1);
}

.telemetry-info-root[data-theme="light"] {
  --tis-primary: #5B2EBC;
  --tis-accent: #00C896;
  --tis-bg: #FFFFFF;
  --tis-bg-secondary: #F9F9F9;
  --tis-text: #222222;
  --tis-text-secondary: #666666;
  --tis-text-tertiary: #999999;
  --tis-border: #E0E0E0;
  --tis-border-light: #F0F0F0;
  --tis-shadow: rgba(0, 0, 0, 0.05);
  --tis-shadow-hover: rgba(0, 0, 0, 0.1);
}

.telemetry-info-root[data-theme="dark"] {
  --tis-primary: #a78bfa;
  --tis-accent: #34d399;
  --tis-bg: #1e293b;
  --tis-bg-secondary: #334155;
  --tis-text: #f1f5f9;
  --tis-text-secondary: #94a3b8;
  --tis-text-tertiary: #64748b;
  --tis-border: #475569;
  --tis-border-light: #334155;
  --tis-shadow: rgba(0, 0, 0, 0.2);
  --tis-shadow-hover: rgba(0, 0, 0, 0.3);
}

/* ========== ROOT CONTAINER ========== */
.telemetry-info-root {
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  width: 100% !important;
  padding: 12px !important;
  background: var(--tis-bg) !important;
  color: var(--tis-text) !important;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  box-sizing: border-box !important;
  border-radius: 12px !important;
  overflow: auto !important;
}

.telemetry-info-root *,
.telemetry-info-root *::before,
.telemetry-info-root *::after {
  box-sizing: border-box !important;
}

/* ========== HEADER ========== */
.telemetry-info-root .tis-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  margin-bottom: 12px !important;
  flex-shrink: 0 !important;
}

.telemetry-info-root .tis-title {
  font-size: 14px !important;
  font-weight: 600 !important;
  color: var(--tis-primary) !important;
  margin: 0 !important;
  letter-spacing: -0.01em !important;
}

.telemetry-info-root .tis-btn-expand {
  background: var(--tis-primary) !important;
  color: white !important;
  border: none !important;
  border-radius: 6px !important;
  padding: 6px 10px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s ease !important;
  box-shadow: 0 2px 6px var(--tis-shadow) !important;
}

.telemetry-info-root .tis-btn-expand:hover {
  background: var(--tis-accent) !important;
  box-shadow: 0 4px 12px var(--tis-shadow-hover) !important;
  transform: translateY(-1px) !important;
}

.telemetry-info-root .tis-btn-expand svg {
  width: 16px !important;
  height: 16px !important;
}

/* ========== CONTENT GRID ========== */
.telemetry-info-root .tis-grid {
  display: grid !important;
  grid-template-columns: repeat(2, 1fr) !important;
  gap: 8px !important;
  flex: 1 !important;
  min-height: 0 !important;
  overflow-y: auto !important;
  align-content: start !important;
}

/* ========== CARDS ========== */
.telemetry-info-root .tis-card {
  background: var(--tis-bg-secondary) !important;
  border: 1px solid var(--tis-border) !important;
  border-radius: 8px !important;
  padding: 8px 10px !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  transition: all 0.2s ease !important;
  box-shadow: 0 1px 4px var(--tis-shadow) !important;
  flex-shrink: 0 !important;
}

.telemetry-info-root .tis-card:hover {
  border-color: var(--tis-accent) !important;
  box-shadow: 0 2px 8px var(--tis-shadow-hover) !important;
}

/* Chart card - spans both columns */
.telemetry-info-root .tis-card.tis-chart-card {
  grid-column: 1 / -1 !important;
  min-height: 180px !important;
}

/* Card header */
.telemetry-info-root .tis-card-header {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  margin-bottom: 4px !important;
}

.telemetry-info-root .tis-card-icon {
  font-size: 14px !important;
  line-height: 1 !important;
  flex-shrink: 0 !important;
}

.telemetry-info-root .tis-card-title {
  font-size: 11px !important;
  font-weight: 600 !important;
  margin: 0 !important;
  color: var(--tis-primary) !important;
  letter-spacing: -0.01em !important;
  white-space: nowrap !important;
  flex: 1 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.telemetry-info-root .tis-tooltip {
  font-size: 10px !important;
  color: var(--tis-accent) !important;
  cursor: help !important;
  opacity: 0.7 !important;
  transition: opacity 0.2s ease !important;
  flex-shrink: 0 !important;
  margin-left: auto !important;
}

.telemetry-info-root .tis-tooltip:hover {
  opacity: 1 !important;
}

/* Card body */
.telemetry-info-root .tis-card-body {
  display: flex !important;
  flex-direction: column !important;
  gap: 0 !important;
}

/* ========== STATS ========== */
.telemetry-info-root .tis-stat-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 8px !important;
  font-size: 12px !important;
  line-height: 1.3 !important;
}

.telemetry-info-root .tis-stat-row.tis-main-stat {
  font-size: 13px !important;
  font-weight: 600 !important;
}

.telemetry-info-root .tis-stat-value {
  font-weight: 600 !important;
  color: var(--tis-text) !important;
  text-align: left !important;
  font-variant-numeric: tabular-nums !important;
  flex: 1 !important;
}

.telemetry-info-root .tis-stat-perc {
  color: var(--tis-accent) !important;
  font-weight: 500 !important;
  font-size: 10px !important;
  text-align: right !important;
  flex-shrink: 0 !important;
  font-variant-numeric: tabular-nums !important;
  white-space: nowrap !important;
}

/* ========== CHART ========== */
.telemetry-info-root .tis-chart-container {
  position: relative !important;
  height: 150px !important;
  margin-bottom: 8px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.telemetry-info-root .tis-chart-container canvas {
  max-height: 100% !important;
  max-width: 100% !important;
}

.telemetry-info-root .tis-chart-legend {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 8px !important;
  justify-content: center !important;
  padding-top: 8px !important;
  border-top: 1px solid var(--tis-border-light) !important;
}

.telemetry-info-root .tis-legend-item {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  font-size: 9px !important;
}

.telemetry-info-root .tis-legend-color {
  width: 10px !important;
  height: 10px !important;
  border-radius: 3px !important;
  flex-shrink: 0 !important;
  box-shadow: 0 1px 2px var(--tis-shadow) !important;
}

.telemetry-info-root .tis-legend-label {
  color: var(--tis-text-secondary) !important;
}

.telemetry-info-root .tis-legend-value {
  font-weight: 600 !important;
  color: var(--tis-text) !important;
  font-variant-numeric: tabular-nums !important;
}

/* ========== LOADING STATE ========== */
.telemetry-info-root .tis-card.tis-loading {
  opacity: 0.6 !important;
  pointer-events: none !important;
  position: relative !important;
}

.telemetry-info-root .tis-card.tis-loading::after {
  content: "" !important;
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  width: 20px !important;
  height: 20px !important;
  margin: -10px 0 0 -10px !important;
  border: 2px solid var(--tis-border) !important;
  border-top-color: var(--tis-accent) !important;
  border-radius: 50% !important;
  animation: tis-spin 0.8s linear infinite !important;
}

@keyframes tis-spin {
  to { transform: rotate(360deg); }
}

/* ========== EMPTY STATE ========== */
.telemetry-info-root .tis-empty-state {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 24px !important;
  color: var(--tis-text-secondary) !important;
  text-align: center !important;
  gap: 6px !important;
}

.telemetry-info-root .tis-empty-icon {
  font-size: 32px !important;
  opacity: 0.5 !important;
}

.telemetry-info-root .tis-empty-text {
  font-size: 12px !important;
  color: var(--tis-text-secondary) !important;
}

/* ========== MODAL OVERLAY ========== */
.telemetry-info-root .tis-modal-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  background: rgba(0, 0, 0, 0.75) !important;
  z-index: 2147483647 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  backdrop-filter: blur(8px) !important;
  animation: tis-fadeIn 0.3s ease !important;
  padding: 3vh 3vw !important;
  box-sizing: border-box !important;
}

.telemetry-info-root .tis-modal-overlay.tis-hidden {
  display: none !important;
}

@keyframes tis-fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ========== MODAL CONTAINER ========== */
.telemetry-info-root .tis-modal-container {
  background: linear-gradient(135deg, #FFFFFF 0%, #F8F9FA 100%) !important;
  border-radius: 24px !important;
  width: 100% !important;
  height: 100% !important;
  max-width: 1200px !important;
  max-height: 800px !important;
  display: flex !important;
  flex-direction: column !important;
  box-shadow: 0 50px 100px -20px rgba(50, 50, 93, 0.25) !important;
  animation: tis-modalAppear 0.4s ease !important;
  overflow: hidden !important;
  position: relative !important;
}

.telemetry-info-root[data-theme="dark"] .tis-modal-container {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%) !important;
}

@keyframes tis-modalAppear {
  from {
    opacity: 0;
    transform: scale(0.94) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ========== CLOSE BUTTON ========== */
.telemetry-info-root .tis-btn-close {
  position: absolute !important;
  top: 24px !important;
  right: 24px !important;
  background: rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(10px) !important;
  border: 1px solid rgba(91, 46, 188, 0.1) !important;
  width: 48px !important;
  height: 48px !important;
  border-radius: 50% !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.3s ease !important;
  color: var(--tis-primary) !important;
  z-index: 100 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
}

.telemetry-info-root[data-theme="dark"] .tis-btn-close {
  background: rgba(30, 41, 59, 0.9) !important;
  border-color: rgba(167, 139, 250, 0.2) !important;
}

.telemetry-info-root .tis-btn-close:hover {
  background: var(--tis-primary) !important;
  color: white !important;
  transform: rotate(90deg) scale(1.05) !important;
  box-shadow: 0 8px 24px rgba(91, 46, 188, 0.3) !important;
}

/* ========== MODAL BODY ========== */
.telemetry-info-root .tis-modal-body {
  flex: 1 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 80px 60px 60px 60px !important;
  overflow-y: auto !important;
  width: 100% !important;
}

.telemetry-info-root .tis-modal-title {
  font-size: 28px !important;
  font-weight: 700 !important;
  color: var(--tis-primary) !important;
  margin: 0 0 40px 0 !important;
  text-align: center !important;
  letter-spacing: -0.03em !important;
}

/* ========== MODAL CHART ========== */
.telemetry-info-root .tis-modal-chart-container {
  flex: 1 !important;
  width: 100% !important;
  max-width: 700px !important;
  background: var(--tis-bg) !important;
  border-radius: 20px !important;
  padding: 40px !important;
  margin: 0 auto 32px auto !important;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08) !important;
  border: 1px solid var(--tis-border) !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
}

.telemetry-info-root .tis-modal-chart-wrapper {
  width: 100% !important;
  max-width: 500px !important;
  height: 400px !important;
  min-height: 300px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  position: relative !important;
}

.telemetry-info-root .tis-modal-chart-wrapper canvas {
  max-height: 100% !important;
  max-width: 100% !important;
}

/* ========== MODAL LEGEND ========== */
.telemetry-info-root .tis-modal-legend {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 24px !important;
  justify-content: center !important;
  align-items: center !important;
  padding: 24px 32px !important;
  background: var(--tis-bg-secondary) !important;
  border-radius: 16px !important;
  border: 1px solid var(--tis-border) !important;
  max-width: 700px !important;
  width: 100% !important;
}

.telemetry-info-root .tis-modal-legend .tis-legend-item {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  font-size: 14px !important;
  font-weight: 500 !important;
}

.telemetry-info-root .tis-modal-legend .tis-legend-color {
  width: 20px !important;
  height: 20px !important;
  border-radius: 6px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
}

.telemetry-info-root .tis-modal-legend .tis-legend-label {
  color: var(--tis-text) !important;
}

.telemetry-info-root .tis-modal-legend .tis-legend-value {
  font-weight: 700 !important;
  color: var(--tis-primary) !important;
}

/* ========== RESPONSIVE ========== */
@media (max-width: 768px) {
  .telemetry-info-root {
    padding: 10px !important;
  }

  .telemetry-info-root .tis-grid {
    grid-template-columns: 1fr !important;
    gap: 6px !important;
  }

  .telemetry-info-root .tis-title {
    font-size: 12px !important;
  }

  .telemetry-info-root .tis-card {
    padding: 6px 8px !important;
  }

  .telemetry-info-root .tis-card-title {
    font-size: 10px !important;
  }

  .telemetry-info-root .tis-stat-row.tis-main-stat {
    font-size: 11px !important;
  }

  .telemetry-info-root .tis-chart-container {
    height: 120px !important;
  }

  .telemetry-info-root .tis-modal-body {
    padding: 40px 24px 24px 24px !important;
  }

  .telemetry-info-root .tis-modal-title {
    font-size: 22px !important;
    margin-bottom: 24px !important;
  }

  .telemetry-info-root .tis-modal-chart-container {
    padding: 24px !important;
  }

  .telemetry-info-root .tis-modal-legend {
    flex-direction: column !important;
    gap: 12px !important;
  }
}
`;

export function injectStyles(_container?: HTMLElement): void {
  const styleId = 'telemetry-info-shopping-styles-v2';

  // Check if styles already exist in document head
  if (document.getElementById(styleId)) {
    return;
  }

  // Remove old styles if they exist
  const oldStyles = document.getElementById('telemetry-info-shopping-styles');
  if (oldStyles) {
    oldStyles.remove();
  }

  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = TELEMETRY_INFO_SHOPPING_STYLES;
  document.head.appendChild(styleEl);
}
