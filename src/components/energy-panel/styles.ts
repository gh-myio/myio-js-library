import { ThemeMode } from './types';

export const ENERGY_PANEL_STYLES = `
  .energy-panel-wrap {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1e293b;
    background-color: #f8fafc;
    padding: 16px;
    border-radius: 12px;
  }

  .energy-panel-wrap[data-theme="dark"] {
    color: #e2e8f0;
    background-color: #1e293b;
  }

  .energy-panel__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
  }

  .energy-panel__card {
    background-color: #ffffff;
    padding: 16px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    border: 1px solid #e2e8f0;
    transition: box-shadow 0.2s ease;
  }

  .energy-panel__card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__card {
    background-color: #334155;
    border-color: #475569;
  }

  .energy-panel__card-icon {
    font-size: 2.5em;
    margin-right: 16px;
  }

  .energy-panel__card-label {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__card-label {
    color: #94a3b8;
  }

  .energy-panel__card-value {
    font-size: 1.6em;
    font-weight: 700;
    color: #2563eb;
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__card-value {
    color: #60a5fa;
  }

  .energy-panel__card-count {
    font-size: 12px;
    color: #94a3b8;
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__card-count {
    color: #64748b;
  }

  .energy-panel__chart-section {
    background-color: #ffffff;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin-bottom: 20px;
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__chart-section {
    background-color: #334155;
    border-color: #475569;
  }

  .energy-panel__chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e2e8f0;
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__chart-header {
    border-bottom-color: #475569;
  }

  .energy-panel__chart-title-group {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .energy-panel__chart-header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #1e293b;
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__chart-header h3 {
    color: #f1f5f9;
  }

  /* Tab styles */
  .energy-panel__chart-tabs {
    display: flex;
    gap: 2px;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 8px;
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__chart-tabs {
    background: #1e293b;
  }

  .energy-panel__tab {
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

  .energy-panel__tab:hover {
    color: #1e293b;
    background: rgba(0, 0, 0, 0.05);
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__tab:hover {
    color: #e2e8f0;
    background: rgba(255, 255, 255, 0.1);
  }

  .energy-panel__tab.active {
    background: #2563eb;
    color: white;
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);
  }

  .energy-panel__tab svg {
    width: 14px;
    height: 14px;
  }

  /* Controls */
  .energy-panel__chart-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .energy-panel__chart-controls select {
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

  .energy-panel__chart-controls select:focus {
    outline: none;
    border-color: #2563eb;
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__chart-controls select {
    background-color: #1e293b;
    border-color: #475569;
    color: #e2e8f0;
  }

  .energy-panel__period-select {
    min-width: 100px !important;
  }

  .energy-panel__distribution-mode {
    min-width: 220px !important;
  }

  .energy-panel__maximize-btn {
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

  .energy-panel__maximize-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
    color: white;
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__maximize-btn {
    border-color: #475569;
    color: #94a3b8;
  }

  .energy-panel-wrap[data-theme="dark"] .energy-panel__maximize-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
    color: white;
  }

  /* Chart containers */
  .energy-panel__consumption-chart,
  .energy-panel__distribution-chart {
    min-height: 220px;
    position: relative;
  }

  .energy-panel__consumption-chart canvas,
  .energy-panel__distribution-chart canvas {
    width: 100% !important;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .energy-panel__chart-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .energy-panel__chart-title-group {
      width: 100%;
      flex-wrap: wrap;
    }

    .energy-panel__chart-controls {
      width: 100%;
      justify-content: flex-start;
    }

    .energy-panel__distribution-mode {
      flex: 1;
    }
  }
`;

export function injectEnergyPanelStyles() {
  if (!document.getElementById('energy-panel-styles')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'energy-panel-styles';
    styleTag.textContent = ENERGY_PANEL_STYLES;
    document.head.appendChild(styleTag);
  }
}
