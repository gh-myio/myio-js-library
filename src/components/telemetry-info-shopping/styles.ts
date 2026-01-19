/**
 * RFC-0148: TelemetryInfoShopping Component Styles
 * Migrated from TELEMETRY_INFO widget styles.css
 */

export const TELEMETRY_INFO_SHOPPING_STYLES = `
/* ========== CSS VARIABLES (MyIO Design System) ========== */
/* Light mode (default) */
.telemetry-info-root {
  --myio-primary: #5B2EBC;
  --myio-accent: #00C896;
  --myio-bg: #FFFFFF;
  --myio-bg-secondary: #F9F9F9;
  --myio-text: #222222;
  --myio-text-secondary: #666666;
  --myio-text-tertiary: #999999;
  --myio-border: #E0E0E0;
  --myio-border-light: #F0F0F0;
  --myio-shadow: rgba(0, 0, 0, 0.05);
  --myio-shadow-hover: rgba(0, 0, 0, 0.1);
}

/* Light mode explicit */
.telemetry-info-root[data-theme="light"] {
  --myio-primary: #5B2EBC;
  --myio-accent: #00C896;
  --myio-bg: #FFFFFF;
  --myio-bg-secondary: #F9F9F9;
  --myio-text: #222222;
  --myio-text-secondary: #666666;
  --myio-text-tertiary: #999999;
  --myio-border: #E0E0E0;
  --myio-border-light: #F0F0F0;
  --myio-shadow: rgba(0, 0, 0, 0.05);
  --myio-shadow-hover: rgba(0, 0, 0, 0.1);
}

/* Dark mode */
.telemetry-info-root[data-theme="dark"] {
  --myio-primary: #a78bfa;
  --myio-accent: #34d399;
  --myio-bg: #1e293b;
  --myio-bg-secondary: #334155;
  --myio-text: #f1f5f9;
  --myio-text-secondary: #94a3b8;
  --myio-text-tertiary: #64748b;
  --myio-border: #475569;
  --myio-border-light: #334155;
}

/* ========== ROOT CONTAINER ========== */

.telemetry-info-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  background: var(--myio-bg);
  color: var(--myio-text);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
}

.telemetry-info-root * {
  box-sizing: border-box;
}

/* ========== HEADER ========== */

.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.info-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--myio-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.btn-expand {
  background: var(--myio-primary);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px var(--myio-shadow);
}

.btn-expand:hover {
  background: var(--myio-accent);
  box-shadow: 0 4px 12px var(--myio-shadow-hover);
  transform: translateY(-2px);
}

/* ========== CONTENT GRID (2 Columns) ========== */

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* ========== CARDS ========== */

.info-card {
  background: var(--myio-bg-secondary);
  border: 1px solid var(--myio-border);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px var(--myio-shadow);
}

.info-card:hover {
  border-color: var(--myio-accent);
  box-shadow: 0 4px 12px var(--myio-shadow-hover);
  transform: translateY(-2px);
}

/* Chart card spans full width */
.info-card.chart-card {
  grid-column: 1 / -1;
}

/* Card header */
.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.card-icon {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.card-title {
  font-size: 12px;
  font-weight: 600;
  margin: 0;
  color: var(--myio-primary);
  letter-spacing: -0.01em;
  white-space: nowrap;
  flex: 1;
}

.info-tooltip {
  font-size: 12px;
  color: var(--myio-accent);
  cursor: help;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
  margin-left: auto;
}

.info-tooltip:hover {
  opacity: 1;
}

/* Card body */
.card-body {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ========== STATS ========== */

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  line-height: 1.2;
}

.stat-row.main-stat {
  font-size: 14px;
  font-weight: 600;
}

.stat-value {
  font-weight: 600;
  color: var(--myio-text);
  text-align: left;
  font-variant-numeric: tabular-nums;
  flex: 1;
}

.stat-perc {
  color: var(--myio-accent);
  font-weight: 500;
  font-size: 11px;
  text-align: right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ========== CHART ========== */

.chart-container {
  position: relative;
  height: 200px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-container canvas {
  max-height: 100%;
  max-width: 100%;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  padding-top: 12px;
  border-top: 1px solid var(--myio-border-light);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.legend-color {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex-shrink: 0;
  box-shadow: 0 2px 4px var(--myio-shadow);
}

.legend-label {
  color: var(--myio-text-secondary);
}

.legend-value {
  font-weight: 600;
  color: var(--myio-text);
  font-variant-numeric: tabular-nums;
}

/* ========== LOADING STATE ========== */

.info-card.loading {
  opacity: 0.6;
  pointer-events: none;
  position: relative;
}

.info-card.loading::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 24px;
  margin: -12px 0 0 -12px;
  border: 3px solid var(--myio-border);
  border-top-color: var(--myio-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ========== EMPTY STATE ========== */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: var(--myio-text-secondary);
  text-align: center;
  gap: 8px;
  grid-column: 1 / -1;
}

.empty-state-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-state-text {
  font-size: 14px;
  color: var(--myio-text-secondary);
}

/* ========== MODAL OVERLAY ========== */

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.75);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  animation: fadeIn 0.3s ease;
  padding: 3vh 3vw;
  box-sizing: border-box;
}

.modal-overlay.hidden {
  display: none;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ========== MODAL CONTAINER ========== */

.modal-container {
  background: linear-gradient(135deg, #FFFFFF 0%, #F8F9FA 100%);
  border-radius: 24px;
  width: 100%;
  height: 100%;
  max-width: 1200px;
  max-height: 800px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 50px 100px -20px rgba(50, 50, 93, 0.25);
  animation: modalAppear 0.4s ease;
  overflow: hidden;
  position: relative;
}

.telemetry-info-root[data-theme="dark"] .modal-container {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

@keyframes modalAppear {
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

.btn-close-floating {
  position: absolute;
  top: 24px;
  right: 24px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(91, 46, 188, 0.1);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  color: var(--myio-primary);
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.telemetry-info-root[data-theme="dark"] .btn-close-floating {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(167, 139, 250, 0.2);
}

.btn-close-floating:hover {
  background: var(--myio-primary);
  color: white;
  transform: rotate(90deg) scale(1.05);
  box-shadow: 0 8px 24px rgba(91, 46, 188, 0.3);
}

/* ========== MODAL BODY ========== */

.modal-body-clean {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 60px 60px 60px;
  overflow-y: auto;
  width: 100%;
}

.modal-title-clean {
  font-size: 28px;
  font-weight: 700;
  color: var(--myio-primary);
  margin: 0 0 40px 0;
  text-align: center;
  letter-spacing: -0.03em;
}

/* ========== MODAL CHART ========== */

.modal-chart-inner-container {
  flex: 1;
  width: 100%;
  max-width: 700px;
  background: var(--myio-bg);
  border-radius: 20px;
  padding: 40px;
  margin: 0 auto 32px auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--myio-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.modal-chart-wrapper {
  width: 100%;
  max-width: 500px;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-chart-wrapper canvas {
  max-height: 100%;
  max-width: 100%;
}

/* ========== MODAL LEGEND ========== */

.modal-legend-clean {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  justify-content: center;
  align-items: center;
  padding: 24px 32px;
  background: var(--myio-bg-secondary);
  border-radius: 16px;
  border: 1px solid var(--myio-border);
  max-width: 700px;
  width: 100%;
}

.modal-legend-clean .legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
}

.modal-legend-clean .legend-color {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.modal-legend-clean .legend-label {
  color: var(--myio-text);
}

.modal-legend-clean .legend-value {
  font-weight: 700;
  color: var(--myio-primary);
}

/* ========== RESPONSIVE ========== */

@media (max-width: 768px) {
  .telemetry-info-root {
    padding: 12px;
  }

  .info-grid {
    gap: 10px;
  }

  .info-title {
    font-size: 14px;
  }

  .card-title {
    font-size: 11px;
  }

  .stat-row.main-stat {
    font-size: 13px;
  }

  .chart-container {
    height: 180px;
  }

  .modal-body-clean {
    padding: 40px 24px 24px 24px;
  }

  .modal-title-clean {
    font-size: 22px;
    margin-bottom: 24px;
  }

  .modal-chart-inner-container {
    padding: 24px;
  }

  .modal-legend-clean {
    flex-direction: column;
    gap: 12px;
  }
}
`;

export function injectStyles(_container?: HTMLElement): void {
  const styleId = 'telemetry-info-shopping-styles';

  // Check if styles already exist in document head
  if (document.getElementById(styleId)) {
    return;
  }

  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = TELEMETRY_INFO_SHOPPING_STYLES;
  document.head.appendChild(styleEl);
}
