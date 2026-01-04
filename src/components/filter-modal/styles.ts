/**
 * RFC-0125: FilterModal Component Styles
 * CSS-in-JS styles for the 3-column filter modal
 */

export function generateFilterModalStyles(containerId: string, modalClass: string, primaryColor: string): string {
  return `
    /* RFC-0125: Filter Modal Styles */
    #${containerId} .${modalClass} {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      backdrop-filter: blur(4px);
      animation: filterModalFadeIn 0.2s ease-in;
    }
    #${containerId} .${modalClass}.hidden { display: none; }
    #${containerId} .${modalClass}-card {
      background: #fff;
      border-radius: 0;
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      box-shadow: none;
      overflow: hidden;
    }
    @media (min-width: 768px) {
      #${containerId} .${modalClass}-card {
        border-radius: 16px;
        width: 90%;
        max-width: 1200px;
        height: auto;
        max-height: 90vh;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
    }
    /* MyIO Premium Header Style */
    #${containerId} .${modalClass}-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #3e1a7d;
      color: white;
      border-radius: 16px 16px 0 0;
      min-height: 32px;
      user-select: none;
    }
    #${containerId} .${modalClass}-header__left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }
    #${containerId} .${modalClass}-header__icon {
      font-size: 18px;
    }
    #${containerId} .${modalClass}-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: white;
      line-height: 1.4;
    }
    #${containerId} .${modalClass}-header__actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    #${containerId} .${modalClass}-header__btn {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.8);
      transition: background-color 0.2s, color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      min-height: 28px;
      line-height: 1;
    }
    #${containerId} .${modalClass}-header__btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: white;
    }
    #${containerId} .${modalClass}-header__btn--close:hover {
      background: rgba(239, 68, 68, 0.3);
      color: #fecaca;
    }
    /* Light theme header */
    #${containerId} .${modalClass}-header--light {
      background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 100%);
      border-bottom: 1px solid #cbd5e1;
    }
    #${containerId} .${modalClass}-header--light h3 {
      color: #475569;
    }
    #${containerId} .${modalClass}-header--light .${modalClass}-header__btn {
      color: rgba(71, 85, 105, 0.8);
    }
    #${containerId} .${modalClass}-header--light .${modalClass}-header__btn:hover {
      background: rgba(0, 0, 0, 0.08);
      color: #1e293b;
    }
    /* Maximized state */
    #${containerId} .${modalClass}-card.maximized {
      max-width: 100%;
      width: 100%;
      max-height: 100vh;
      height: 100vh;
      border-radius: 0;
    }
    #${containerId} .${modalClass}-card.maximized .${modalClass}-header {
      border-radius: 0;
    }
    /* Three-column layout */
    #${containerId} .${modalClass}-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: row;
      gap: 20px;
    }
    #${containerId} .filter-sidebar {
      width: 220px;
      min-width: 220px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      border-right: 1px solid #E6EEF5;
      padding-right: 20px;
    }
    #${containerId} .filter-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      border-right: 1px solid #E6EEF5;
      padding-right: 20px;
    }
    #${containerId} .filter-sortbar {
      width: 160px;
      min-width: 160px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    #${containerId} .${modalClass}-footer {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      padding: 16px 20px;
      border-top: 1px solid #DDE7F1;
    }
    #${containerId} .filter-block {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    #${containerId} .block-label {
      font-size: 14px;
      font-weight: 600;
      color: #1C2743;
    }
    /* Vertical filter tabs in sidebar */
    #${containerId} .filter-tabs {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    #${containerId} .filter-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    #${containerId} .filter-group-all {
      padding-bottom: 10px;
      border-bottom: 1px solid #E6EEF5;
      margin-bottom: 4px;
    }
    #${containerId} .filter-group-all .filter-tab {
      width: 100%;
      justify-content: center;
    }
    #${containerId} .filter-group-label {
      font-size: 11px;
      font-weight: 600;
      color: #6b7a90;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    #${containerId} .filter-group-tabs {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    /* Filter tabs styled like card chips */
    #${containerId} .filter-tab {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      gap: 4px;
      border: none;
      opacity: 0.5;
    }
    #${containerId} .filter-tab:hover { opacity: 0.8; transform: translateY(-1px); }
    #${containerId} .filter-tab.active { opacity: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
    #${containerId} .filter-tab[data-filter="all"] { background: #e2e8f0; color: #475569; }
    #${containerId} .filter-tab[data-filter="online"],
    #${containerId} .filter-tab[data-filter="normal"] { background: #dbeafe; color: #1d4ed8; }
    #${containerId} .filter-tab[data-filter="offline"] { background: #e2e8f0; color: #475569; }
    #${containerId} .filter-tab[data-filter="notInstalled"] { background: #fef3c7; color: #92400e; }
    #${containerId} .filter-tab[data-filter="standby"],
    #${containerId} .filter-tab[data-filter="withConsumption"] { background: #dcfce7; color: #15803d; }
    #${containerId} .filter-tab[data-filter="alert"] { background: #fef3c7; color: #b45309; }
    #${containerId} .filter-tab[data-filter="failure"] { background: #fee2e2; color: #b91c1c; }
    #${containerId} .filter-tab[data-filter="noConsumption"] { background: #e2e8f0; color: #475569; }
    #${containerId} .filter-tab[data-filter="elevators"] { background: #e9d5ff; color: #7c3aed; }
    #${containerId} .filter-tab[data-filter="escalators"] { background: #fce7f3; color: #db2777; }
    #${containerId} .filter-tab[data-filter="hvac"] { background: #cffafe; color: #0891b2; }
    #${containerId} .filter-tab[data-filter="others"] { background: #e7e5e4; color: #57534e; }
    #${containerId} .filter-tab[data-filter="commonArea"] { background: #e0f2fe; color: #0284c7; }
    #${containerId} .filter-tab[data-filter="stores"] { background: #f3e8ff; color: #9333ea; }
    /* Expand button (+) for device list tooltip */
    #${containerId} .filter-tab-expand {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: none;
      background: rgba(0, 0, 0, 0.1);
      color: inherit;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 4px;
      transition: all 0.15s ease;
      flex-shrink: 0;
      opacity: 0.7;
    }
    #${containerId} .filter-tab-expand:hover {
      background: rgba(0, 0, 0, 0.25);
      transform: scale(1.1);
      opacity: 1;
    }
    #${containerId} .filter-search {
      position: relative;
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    #${containerId} .filter-search svg {
      position: absolute;
      left: 10px;
      width: 14px;
      height: 14px;
      fill: #6b7a90;
      pointer-events: none;
    }
    #${containerId} .filter-search input {
      width: 100%;
      padding: 8px 32px 8px 32px;
      border: 1px solid #DDE7F1;
      border-radius: 8px;
      font-size: 12px;
      outline: none;
      box-sizing: border-box;
    }
    #${containerId} .filter-search input:focus {
      border-color: ${primaryColor};
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
    }
    #${containerId} .filter-search .clear-x {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      border: 0;
      background: #f3f4f6;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    #${containerId} .filter-search .clear-x:hover { background: #e5e7eb; }
    #${containerId} .filter-search .clear-x svg { position: static; width: 12px; height: 12px; fill: #6b7280; }
    #${containerId} .inline-actions { display: flex; gap: 8px; margin-top: 8px; }
    #${containerId} .tiny-btn {
      padding: 6px 12px;
      border: 1px solid #DDE7F1;
      border-radius: 6px;
      background: #fff;
      font-size: 12px;
      font-weight: 500;
      color: #1C2743;
      cursor: pointer;
      transition: all 0.2s;
    }
    #${containerId} .tiny-btn:hover { background: #f0f4f8; border-color: ${primaryColor}; color: ${primaryColor}; }
    #${containerId} .checklist {
      min-height: 120px;
      max-height: 340px;
      overflow-y: auto;
      border: 1px solid #DDE7F1;
      border-radius: 8px;
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    #${containerId} .check-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 6px;
      border-radius: 4px;
      transition: background 0.2s;
    }
    #${containerId} .check-item:hover { background: #f8f9fa; }
    #${containerId} .check-item input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; flex-shrink: 0; }
    #${containerId} .check-item label { flex: 1; cursor: pointer; font-size: 11px; color: #1C2743; line-height: 1.3; }
    #${containerId} .radio-grid { display: flex; flex-direction: column; gap: 4px; }
    #${containerId} .radio-grid label {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border: 1px solid #DDE7F1;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 11px;
      color: #1C2743;
    }
    #${containerId} .radio-grid label:hover { background: #f8f9fa; border-color: ${primaryColor}; }
    #${containerId} .radio-grid input[type="radio"] { width: 12px; height: 12px; cursor: pointer; flex-shrink: 0; }
    #${containerId} .radio-grid label:has(input:checked) { background: rgba(37, 99, 235, 0.08); border-color: ${primaryColor}; color: ${primaryColor}; font-weight: 600; }
    #${containerId} .btn {
      padding: 10px 16px;
      border: 1px solid #DDE7F1;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    #${containerId} .btn:hover { background: #f8f9fa; }
    #${containerId} .btn.primary { background: ${primaryColor}; color: #fff; border-color: ${primaryColor}; }
    #${containerId} .btn.primary:hover { filter: brightness(0.9); }
    #${containerId} .icon-btn {
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: background 0.2s;
    }
    #${containerId} .icon-btn:hover { background: #f0f0f0; }
    #${containerId} .icon-btn svg { width: 18px; height: 18px; fill: #1C2743; }
    @keyframes filterModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
    body.filter-modal-open { overflow: hidden !important; }

    /* ========== DARK THEME SUPPORT ========== */
    #${containerId}[data-theme="dark"] .${modalClass}-card {
      background: #1e293b;
      border-color: #334155;
    }
    #${containerId}[data-theme="dark"] .${modalClass}-header {
      border-bottom-color: #334155;
    }
    #${containerId}[data-theme="dark"] .${modalClass}-header h3 {
      color: #f1f5f9;
    }
    #${containerId}[data-theme="dark"] .${modalClass}-footer {
      border-top-color: #334155;
    }
    #${containerId}[data-theme="dark"] .filter-sidebar {
      border-right-color: #334155;
    }
    #${containerId}[data-theme="dark"] .filter-content {
      border-right-color: #334155;
    }
    #${containerId}[data-theme="dark"] .block-label {
      color: #f1f5f9;
    }
    #${containerId}[data-theme="dark"] .filter-group-label {
      color: #94a3b8;
    }
    #${containerId}[data-theme="dark"] .filter-group-all {
      border-bottom-color: #334155;
    }
    #${containerId}[data-theme="dark"] .filter-search input {
      background: #0f172a;
      border-color: #334155;
      color: #f1f5f9;
    }
    #${containerId}[data-theme="dark"] .filter-search input::placeholder {
      color: #64748b;
    }
    #${containerId}[data-theme="dark"] .filter-search input:focus {
      border-color: ${primaryColor};
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
    }
    #${containerId}[data-theme="dark"] .filter-search svg {
      fill: #94a3b8;
    }
    #${containerId}[data-theme="dark"] .filter-search .clear-x {
      background: #334155;
    }
    #${containerId}[data-theme="dark"] .filter-search .clear-x:hover {
      background: #475569;
    }
    #${containerId}[data-theme="dark"] .filter-search .clear-x svg {
      fill: #94a3b8;
    }
    #${containerId}[data-theme="dark"] .checklist {
      background: #0f172a;
      border-color: #334155;
    }
    #${containerId}[data-theme="dark"] .check-item:hover {
      background: #334155;
    }
    #${containerId}[data-theme="dark"] .check-item label {
      color: #e2e8f0;
    }
    #${containerId}[data-theme="dark"] .radio-grid label {
      border-color: #334155;
      color: #e2e8f0;
      background: #0f172a;
    }
    #${containerId}[data-theme="dark"] .radio-grid label:hover {
      background: #1e293b;
      border-color: ${primaryColor};
    }
    #${containerId}[data-theme="dark"] .radio-grid label:has(input:checked) {
      background: rgba(37, 99, 235, 0.15);
      border-color: ${primaryColor};
      color: #60a5fa;
    }
    #${containerId}[data-theme="dark"] .tiny-btn {
      background: #0f172a;
      border-color: #334155;
      color: #e2e8f0;
    }
    #${containerId}[data-theme="dark"] .tiny-btn:hover {
      background: #1e293b;
      border-color: ${primaryColor};
      color: #60a5fa;
    }
    #${containerId}[data-theme="dark"] .btn {
      border-color: #334155;
      color: #e2e8f0;
      background: #0f172a;
    }
    #${containerId}[data-theme="dark"] .btn:hover {
      background: #1e293b;
    }
    #${containerId}[data-theme="dark"] .btn.primary {
      background: ${primaryColor};
      color: #fff;
      border-color: ${primaryColor};
    }
    #${containerId}[data-theme="dark"] .icon-btn:hover {
      background: #334155;
    }
    #${containerId}[data-theme="dark"] .icon-btn svg {
      fill: #f1f5f9;
    }
    #${containerId}[data-theme="dark"] .filter-tab-expand {
      background: rgba(255, 255, 255, 0.1);
    }
    #${containerId}[data-theme="dark"] .filter-tab-expand:hover {
      background: rgba(255, 255, 255, 0.25);
    }
    #${containerId}[data-theme="dark"] .check-item .customer-name {
      color: #38bdf8 !important;
    }
  `;
}
