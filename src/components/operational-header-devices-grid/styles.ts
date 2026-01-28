/**
 * RFC-0152: OperationalHeaderDevicesGrid Component Styles
 * Premium CSS-in-JS styles for the operational stats header
 */

export const OPERATIONAL_HEADER_DEVICES_GRID_STYLES = `
  /* RFC-0152: OperationalHeaderDevicesGrid - Premium Header */
  .ohg-header {
    display: flex !important;
    flex-direction: row !important;
    align-items: stretch;
    gap: 0;
    padding: 0;
    background: var(--card-bg, #1e293b);
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
    min-height: 56px;
  }

  /* Title Section */
  .ohg-header .ohg-title-section {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    border-right: 1px solid var(--card-bd, #334155);
    min-width: 180px;
  }

  .ohg-header .ohg-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-1, #f1f5f9);
    white-space: nowrap;
  }

  .ohg-header .ohg-count {
    font-size: 11px;
    color: var(--ink-2, #94a3b8);
    margin-left: 8px;
    background: var(--card-bd, #334155);
    padding: 2px 8px;
    border-radius: 10px;
  }

  /* Stat Items */
  .ohg-header .stat-item {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center;
    gap: 2px;
    flex: 1 1 0;
    min-width: 90px;
    padding: 8px 14px;
    border-right: 1px solid var(--card-bd, #334155);
  }

  .ohg-header .stat-item:last-of-type {
    border-right: none;
  }

  .ohg-header .stat-label {
    font-size: 9px;
    color: var(--ink-2, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .ohg-header .stat-value {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink-1, #f1f5f9);
  }

  /* Status-specific colors */
  .ohg-header .stat-item.online .stat-value {
    color: #22c55e;
  }

  .ohg-header .stat-item.offline .stat-value {
    color: #ef4444;
  }

  .ohg-header .stat-item.maintenance .stat-value {
    color: #f97316;
  }

  /* Availability highlight */
  .ohg-header .stat-item.availability {
    flex: 1.2 1 0;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.2) 100%);
    border-left: 2px solid #8b5cf6;
    border-right: 2px solid #8b5cf6;
  }

  .ohg-header .stat-item.availability .stat-value {
    color: #8b5cf6;
    font-size: 18px;
  }

  /* Filter Actions Section */
  .ohg-header .filter-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-left: 1px solid var(--card-bd, #334155);
    margin-left: auto;
  }

  /* Customer Select */
  .ohg-header .customer-select {
    padding: 6px 28px 6px 10px;
    border: 1px solid var(--card-bd, #334155);
    border-radius: 6px;
    background: transparent;
    color: var(--ink-1, #f1f5f9);
    font-size: 11px;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    min-width: 120px;
    max-width: 160px;
  }

  .ohg-header .customer-select:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  /* Search Wrap */
  .ohg-header .search-wrap {
    display: none;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .ohg-header .search-wrap.active {
    display: block;
  }

  .ohg-header .search-wrap input {
    padding: 6px 10px;
    border: 1px solid var(--card-bd, #334155);
    border-radius: 6px;
    background: transparent;
    color: var(--ink-1, #f1f5f9);
    font-size: 11px;
    width: 140px;
  }

  .ohg-header .search-wrap input:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  .ohg-header .search-wrap input::placeholder {
    color: var(--ink-2, #94a3b8);
  }

  /* Icon Buttons */
  .ohg-header .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--card-bd, #334155);
    border-radius: 6px;
    background: transparent;
    color: var(--ink-2, #94a3b8);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ohg-header .icon-btn.filter-btn {
    background: #3e1a7d;
    border-color: #3e1a7d;
    color: #ffffff;
  }

  .ohg-header .icon-btn.filter-btn:hover {
    filter: brightness(1.1);
    background: #4b1d96;
    border-color: #4b1d96;
  }

  .ohg-header .icon-btn:hover {
    background: #8b5cf6;
    border-color: #8b5cf6;
    color: white;
  }

  .ohg-header .icon-btn svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
    display: block;
  }

  .ohg-header .icon-btn .icon-minimize {
    display: none;
  }

  .ohg-header .icon-btn .icon-maximize {
    display: block;
  }

  /* Light mode */
  .ohg-header--light {
    background: #ffffff;
    border: 1px solid #e2e8f0;
  }

  .ohg-header--light .ohg-title-section {
    border-color: #e2e8f0;
  }

  .ohg-header--light .ohg-title {
    color: #1e293b;
  }

  .ohg-header--light .ohg-count {
    background: #e2e8f0;
    color: #64748b;
  }

  .ohg-header--light .stat-item {
    border-color: #e2e8f0;
  }

  .ohg-header--light .stat-item.availability {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.15) 100%);
    border-left-color: #8b5cf6;
    border-right-color: #8b5cf6;
  }

  .ohg-header--light .stat-label {
    color: #64748b;
  }

  .ohg-header--light .stat-value {
    color: #1e293b;
  }

  .ohg-header--light .filter-actions {
    border-color: #e2e8f0;
  }

  .ohg-header--light .customer-select {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #1e293b;
  }

  .ohg-header--light .search-wrap input {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #1e293b;
  }

  .ohg-header--light .icon-btn {
    border-color: #cbd5e1;
    color: #64748b;
  }

  .ohg-header--light .icon-btn.filter-btn {
    background: #e9d5ff;
    border-color: #e9d5ff;
    color: #5b21b6;
  }

  .ohg-header--light .icon-btn.filter-btn:hover {
    background: #ddd6fe;
    border-color: #ddd6fe;
    color: #4c1d95;
  }

  /* Maximized state */
  .operational-grid-wrap.maximized {
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

  .operational-grid-wrap.maximized .ohg-header {
    position: sticky;
    top: 0;
    z-index: 10;
    margin-bottom: 16px;
  }

  .operational-grid-wrap.maximized .ohg-header .icon-btn .icon-maximize {
    display: none;
  }

  .operational-grid-wrap.maximized .ohg-header .icon-btn .icon-minimize {
    display: block;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .ohg-header {
      flex-wrap: wrap;
    }

    .ohg-header .ohg-title-section {
      flex: 1 1 100%;
      border-right: none;
      border-bottom: 1px solid var(--card-bd, #334155);
    }

    .ohg-header .filter-actions {
      margin-left: 0;
      flex: 1 1 100%;
      justify-content: flex-end;
      border-left: none;
      border-top: 1px solid var(--card-bd, #334155);
    }
  }

  @media (max-width: 768px) {
    .ohg-header .stat-item {
      min-width: 60px;
      padding: 6px 10px;
    }

    .ohg-header .stat-value {
      font-size: 14px;
    }

    .ohg-header .stat-item.availability .stat-value {
      font-size: 16px;
    }

    .ohg-header .customer-select {
      min-width: 100px;
    }

    .ohg-header .search-wrap input {
      width: 120px;
    }
  }
`;

let stylesInjected = false;

export function injectOperationalHeaderDevicesGridStyles(): void {
  if (stylesInjected) return;

  const styleId = 'ohg-styles';
  if (document.getElementById(styleId)) {
    stylesInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = OPERATIONAL_HEADER_DEVICES_GRID_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

export function removeOperationalHeaderDevicesGridStyles(): void {
  const styleId = 'ohg-styles';
  const styleElement = document.getElementById(styleId);
  if (styleElement) {
    styleElement.remove();
    stylesInjected = false;
  }
}
