/**
 * RFC-0125: HeaderDevicesGrid Component Styles
 * CSS-in-JS styles for the stats header
 * FIEL ao showcase/telemetry-grid/index.html
 */

export const HEADER_DEVICES_GRID_STYLES = `
  /* RFC-0125: HeaderDevicesGrid Component - FIEL ao TELEMETRY widget */
  .hdg-header {
    display: flex !important;
    flex-direction: row !important;
    align-items: stretch;
    gap: 0;
    padding: 0;
    background: var(--card-bg, #1e293b);
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
  }

  .hdg-header .stat-item {
    display: flex !important;
    flex-direction: column !important;
    gap: 2px;
    flex: 1;
    min-width: 0;
    padding: 12px 16px;
    border-right: 1px solid var(--card-bd, #334155);
  }

  .hdg-header .stat-item:last-of-type {
    border-right: none;
  }

  .hdg-header .stat-label {
    font-size: 11px;
    color: var(--ink-2, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hdg-header .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink-1, #f1f5f9);
  }

  /* Highlight com background de destaque e barras em ambos os lados */
  .hdg-header .stat-item.highlight {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.25) 100%);
    border-left: 3px solid var(--telemetry-primary, #f59e0b);
    border-right: 3px solid var(--telemetry-primary, #f59e0b);
    position: relative;
  }

  .hdg-header .stat-item.highlight .stat-value {
    color: var(--telemetry-primary, #f59e0b);
    font-size: 20px;
  }

  /* Ajuste para o item apos o highlight nao ter borda dupla */
  .hdg-header .stat-item.highlight + .stat-item {
    border-left: none;
  }

  .hdg-header .filter-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-left: 1px solid var(--card-bd, #334155);
  }

  .hdg-header .search-wrap {
    display: none;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .hdg-header .search-wrap.active {
    display: block;
  }

  .hdg-header .search-wrap input {
    padding: 6px 12px;
    border: 1px solid var(--card-bd, #334155);
    border-radius: 6px;
    background: transparent;
    color: var(--ink-1, #f1f5f9);
    font-size: 13px;
    width: 180px;
  }

  .hdg-header .search-wrap input:focus {
    outline: none;
    border-color: var(--telemetry-primary, #f59e0b);
  }

  .hdg-header .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--card-bd, #334155);
    border-radius: 6px;
    background: transparent;
    color: var(--ink-2, #94a3b8);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .hdg-header .icon-btn:hover {
    background: var(--telemetry-primary, #f59e0b);
    border-color: var(--telemetry-primary, #f59e0b);
    color: white;
  }

  .hdg-header .icon-btn svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
    display: block;
  }

  .hdg-header .icon-btn .icon-minimize {
    display: none;
  }

  .hdg-header .icon-btn .icon-maximize {
    display: block;
  }

  /* Light mode */
  .hdg-header--light {
    background: #ffffff;
    border: 1px solid #e2e8f0;
  }

  .hdg-header--light .stat-item {
    border-color: #e2e8f0;
  }

  .hdg-header--light .stat-item.highlight {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.2) 100%);
    border-left-color: var(--telemetry-primary, #f59e0b);
    border-right-color: var(--telemetry-primary, #f59e0b);
  }

  .hdg-header--light .stat-label {
    color: #64748b;
  }

  .hdg-header--light .stat-value {
    color: #1e293b;
  }

  .hdg-header--light .filter-actions {
    border-color: #e2e8f0;
  }

  .hdg-header--light .search-wrap input {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #1e293b;
  }

  .hdg-header--light .icon-btn {
    border-color: #cbd5e1;
    color: #64748b;
  }

  /* Maximized state for parent container */
  .telemetry-grid-wrap.maximized {
    position: fixed !important;
    inset: 0 !important;
    z-index: 99999 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: var(--card-bg, #0f172a) !important;
    border-radius: 0 !important;
    overflow: auto !important;
    padding: 16px !important;
  }

  .telemetry-grid-wrap.maximized .telemetry-grid-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--card-bg, #0f172a);
    padding-bottom: 12px;
  }

  .telemetry-grid-wrap.maximized .telemetry-cards-grid {
    max-height: none !important;
    overflow: visible !important;
  }

  .telemetry-grid-wrap.maximized .hdg-header .icon-btn .icon-maximize {
    display: none;
  }

  .telemetry-grid-wrap.maximized .hdg-header .icon-btn .icon-minimize {
    display: block;
  }

  /* Light mode maximized */
  body.light-mode .telemetry-grid-wrap.maximized {
    background: #f8fafc !important;
  }

  body.light-mode .telemetry-grid-wrap.maximized .telemetry-grid-header {
    background: #f8fafc;
  }
`;

export function injectHeaderDevicesGridStyles(): void {
  const styleId = 'hdg-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = HEADER_DEVICES_GRID_STYLES;
  document.head.appendChild(style);
}
