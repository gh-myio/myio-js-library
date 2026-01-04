/**
 * RFC-0125: HeaderDevicesGrid Component Styles
 * CSS-in-JS styles for the stats header
 */

export const HEADER_DEVICES_GRID_STYLES = `
  /* RFC-0125: HeaderDevicesGrid Component */
  .hdg-header {
    display: flex !important;
    flex-direction: row !important;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .hdg-header .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 80px;
  }

  .hdg-header .stat-item .stat-label {
    font-size: 11px;
    font-weight: 500;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hdg-header .stat-item .stat-value {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
  }

  .hdg-header .stat-item.highlight .stat-value {
    color: #16a34a;
  }

  .hdg-header .filter-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .hdg-header .search-wrap {
    display: none;
    position: relative;
  }

  .hdg-header .search-wrap.active {
    display: block;
  }

  .hdg-header .search-wrap input {
    width: 180px;
    padding: 6px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 13px;
    outline: none;
    transition: all 0.2s;
  }

  .hdg-header .search-wrap input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
  }

  .hdg-header .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: rgba(0,0,0,0.04);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .hdg-header .icon-btn:hover {
    background: rgba(0,0,0,0.08);
    transform: translateY(-1px);
  }

  .hdg-header .icon-btn svg {
    width: 18px;
    height: 18px;
    fill: #475569;
  }

  .hdg-header .icon-btn .icon-minimize {
    display: none;
  }

  /* Dark theme */
  .hdg-header--dark {
    background: linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.95) 100%);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }

  .hdg-header--dark .stat-item .stat-label {
    color: #94a3b8;
  }

  .hdg-header--dark .stat-item .stat-value {
    color: #f1f5f9;
  }

  .hdg-header--dark .stat-item.highlight .stat-value {
    color: #4ade80;
  }

  .hdg-header--dark .search-wrap input {
    background: #0f172a;
    border-color: #334155;
    color: #f1f5f9;
  }

  .hdg-header--dark .search-wrap input::placeholder {
    color: #64748b;
  }

  .hdg-header--dark .search-wrap input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.2);
  }

  .hdg-header--dark .icon-btn {
    background: rgba(255,255,255,0.08);
  }

  .hdg-header--dark .icon-btn:hover {
    background: rgba(255,255,255,0.15);
  }

  .hdg-header--dark .icon-btn svg {
    fill: #e2e8f0;
  }

  /* Maximized state for parent container */
  .telemetry-grid-wrap.maximized {
    position: fixed !important;
    inset: 0 !important;
    z-index: 9999 !important;
    background: var(--bg-color, #f1f5f9) !important;
    padding: 16px !important;
    overflow: auto !important;
  }

  .telemetry-grid-wrap.maximized .hdg-header .icon-btn .icon-maximize {
    display: none;
  }

  .telemetry-grid-wrap.maximized .hdg-header .icon-btn .icon-minimize {
    display: block;
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
