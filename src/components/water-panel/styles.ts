import { ThemeMode } from './types';

export const WATER_PANEL_STYLES = `
  .water-panel-wrap {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1e293b;
    background-color: #f8fafc;
    padding: 16px;
    border-radius: 12px;
  }

  .water-panel-wrap[data-theme="dark"] {
    color: #e2e8f0;
    background-color: #1e293b;
  }

  .water-panel__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
  }

  .water-panel__card {
    background-color: #ffffff;
    padding: 16px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    border: 1px solid #e2e8f0;
    transition: box-shadow 0.2s ease;
  }

  .water-panel__card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__card {
    background-color: #334155;
    border-color: #475569;
  }

  .water-panel__card--total {
    border-left: 4px solid #0288d1;
  }

  .water-panel__card-icon {
    font-size: 2.5em;
    margin-right: 16px;
  }

  .water-panel__card-content {
    flex: 1;
  }

  .water-panel__card-label {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__card-label {
    color: #94a3b8;
  }

  .water-panel__card-value {
    font-size: 1.6em;
    font-weight: 700;
    color: #0288d1;
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__card-value {
    color: #38bdf8;
  }

  .water-panel__card-trend {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__card-trend {
    color: #94a3b8;
  }

  .water-panel__card-count {
    font-size: 12px;
    color: #94a3b8;
    margin-top: 4px;
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__card-count {
    color: #64748b;
  }

  .water-panel__chart-section {
    background-color: #ffffff;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin-bottom: 20px;
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__chart-section {
    background-color: #334155;
    border-color: #475569;
  }

  .water-panel__chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e2e8f0;
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__chart-header {
    border-bottom-color: #475569;
  }

  .water-panel__chart-title-group {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .water-panel__chart-header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #1e293b;
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__chart-header h3 {
    color: #f1f5f9;
  }

  /* Tab styles */
  .water-panel__chart-tabs {
    display: flex;
    gap: 2px;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 8px;
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__chart-tabs {
    background: #1e293b;
  }

  .water-panel__tab {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
    font-size: 12px;
    font-weight: 500;
  }

  .water-panel__tab:hover {
    color: #1e293b;
    background: rgba(0, 0, 0, 0.05);
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__tab:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.1);
  }

  .water-panel__tab.active {
    background: #0288d1;
    color: white;
    box-shadow: 0 1px 3px rgba(2, 136, 209, 0.3);
  }

  .water-panel__tab svg {
    width: 14px;
    height: 14px;
  }

  /* Controls */
  .water-panel__chart-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .water-panel__chart-controls select {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background-color: #ffffff;
    color: #1e293b;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    min-width: 180px;
  }

  .water-panel__chart-controls select:focus {
    outline: none;
    border-color: #0288d1;
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__chart-controls select {
    background-color: #1e293b;
    border-color: #475569;
    color: #e2e8f0;
  }

  .water-panel__period-select {
    min-width: 100px !important;
  }

  .water-panel__distribution-mode {
    min-width: 200px !important;
  }

  .water-panel__maximize-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
  }

  .water-panel__maximize-btn:hover {
    background: #0288d1;
    border-color: #0288d1;
    color: white;
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__maximize-btn {
    border-color: #475569;
    color: #94a3b8;
  }

  .water-panel-wrap[data-theme="dark"] .water-panel__maximize-btn:hover {
    background: #0288d1;
    border-color: #0288d1;
    color: white;
  }

  /* Chart containers */
  .water-panel__consumption-chart,
  .water-panel__distribution-chart {
    min-height: 220px;
    position: relative;
  }

  .water-panel__consumption-chart canvas,
  .water-panel__distribution-chart canvas {
    width: 100% !important;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .water-panel__chart-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .water-panel__chart-title-group {
      width: 100%;
      flex-wrap: wrap;
    }

    .water-panel__chart-controls {
      width: 100%;
      justify-content: flex-start;
    }

    .water-panel__distribution-mode {
      flex: 1;
    }
  }
`;

export function injectWaterPanelStyles() {
  if (typeof document === 'undefined') return;
  const id = 'myio-water-panel-styles';
  if (document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = WATER_PANEL_STYLES;
  document.head.appendChild(style);
}
