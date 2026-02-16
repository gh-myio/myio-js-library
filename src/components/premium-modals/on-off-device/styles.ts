/**
 * RFC-0167: On/Off Device Modal Styles
 * CSS-in-JS styles for the On/Off device modal
 */

export const ON_OFF_MODAL_CSS_PREFIX = 'myio-onoff-modal';

let stylesInjected = false;

export function injectOnOffDeviceModalStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${ON_OFF_MODAL_CSS_PREFIX}-styles`;
  style.textContent = `
    /* =====================================================
       RFC-0167: On/Off Device Modal Styles
       ===================================================== */

    .${ON_OFF_MODAL_CSS_PREFIX} {
      display: flex;
      flex-direction: row;
      width: 100%;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      box-sizing: border-box;
      overflow: hidden;
    }

    /* ===== Left Panel (20% width) ===== */
    .${ON_OFF_MODAL_CSS_PREFIX}__left-panel {
      width: 20%;
      min-width: 180px;
      max-width: 280px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
      border-right: 1px solid var(--onoff-border-color, #e5e7eb);
      background: var(--onoff-panel-bg, #f9fafb);
      box-sizing: border-box;
    }

    /* Control container (top area - takes available space) */
    .${ON_OFF_MODAL_CSS_PREFIX}__control-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }

    /* Bottom buttons container (schedule + refresh at bottom) */
    .${ON_OFF_MODAL_CSS_PREFIX}__bottom-buttons {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--onoff-border-color, #e5e7eb);
      margin-top: auto;
    }

    /* Schedule button container */
    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 16px 24px;
      background: var(--onoff-btn-bg, #ffffff);
      border: 2px solid var(--onoff-border-color, #e5e7eb);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      width: 100%;
      max-width: 200px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn:hover {
      background: var(--onoff-btn-hover-bg, #f3f4f6);
      border-color: var(--onoff-primary-color, #3b82f6);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn:active {
      transform: translateY(0);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn-icon {
      font-size: 32px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--onoff-text-color, #374151);
    }

    /* ===== Right Panel (80% width) ===== */
    .${ON_OFF_MODAL_CSS_PREFIX}__right-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 12px 8px;
      overflow: hidden;
      box-sizing: border-box;
    }

    /* View container for chart/schedule toggle */
    .${ON_OFF_MODAL_CSS_PREFIX}__view-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: auto;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__view-container--hidden {
      display: none !important;
    }

    /* ===== Right Panel Toolbar (date picker) ===== */
    .${ON_OFF_MODAL_CSS_PREFIX}__toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--onoff-border-color, #e5e7eb);
      flex-shrink: 0;
      background: var(--onoff-panel-bg, #f9fafb);
      border-radius: 8px 8px 0 0;
    }

    /* ===== Export Buttons ===== */
    .${ON_OFF_MODAL_CSS_PREFIX}__export-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--onoff-btn-bg, #ffffff);
      border: 1px solid var(--onoff-border-color, #e5e7eb);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      color: var(--onoff-text-muted, #6b7280);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__export-btn:hover {
      color: var(--onoff-primary-color, #3b82f6);
      border-color: var(--onoff-primary-color, #3b82f6);
      background: rgba(59, 130, 246, 0.05);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__export-btn:active {
      transform: scale(0.97);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__export-btn svg {
      flex-shrink: 0;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__toolbar-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--onoff-text-muted, #6b7280);
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__date-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      max-width: 300px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__date-input-icon {
      position: absolute;
      left: 10px;
      pointer-events: none;
      display: flex;
      align-items: center;
      color: var(--onoff-text-muted, #9ca3af);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__date-input-icon svg {
      width: 14px;
      height: 14px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__date-input {
      padding: 7px 12px 7px 30px;
      border: 1px solid var(--onoff-border-color, #e5e7eb);
      border-radius: 8px;
      font-size: 13px;
      color: var(--onoff-text-color, #1f2937);
      background: var(--onoff-btn-bg, #ffffff);
      cursor: pointer;
      box-sizing: border-box;
      width: 100%;
      font-family: inherit;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__date-input::placeholder {
      color: var(--onoff-text-muted, #9ca3af);
      font-style: italic;
      font-size: 12px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__date-input:hover {
      border-color: var(--onoff-primary-color, #3b82f6);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__date-input:focus {
      outline: none;
      border-color: var(--onoff-primary-color, #3b82f6);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    /* ===== Chart View ===== */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: auto;
      animation: ${ON_OFF_MODAL_CSS_PREFIX}-fadeIn 0.3s ease;
      /* Remove any extra space at bottom */
      justify-content: flex-start;
    }

    @keyframes ${ON_OFF_MODAL_CSS_PREFIX}-fadeIn {
      from { opacity: 0.5; }
      to { opacity: 1; }
    }

    /* Make timeline chart responsive inside the modal */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline {
      width: 100%;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 8px;
      min-height: 280px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__svg {
      width: 100%;
      height: auto;
      overflow: visible;
    }

    /* Fix axis labels clipping — increase readability */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__axis-label {
      font-size: 11px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__date-label {
      font-size: 10px;
    }

    /* Summary: horizontal distribution with proper text colors */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__summary {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-around;
      gap: 16px;
      padding: 10px 12px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__summary-item {
      flex-direction: row;
      gap: 6px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__summary-value {
      font-size: 15px;
      color: #1f2937;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__summary-label {
      font-size: 12px;
      color: #6b7280;
    }

    /* Legend: horizontal with proper text colors */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__legend {
      display: flex;
      flex-direction: row;
      justify-content: center;
      gap: 20px;
      padding-top: 4px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__legend-item {
      font-size: 12px;
      color: #374151;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__legend-color {
      width: 10px;
      height: 10px;
    }

    /* Header text color fix for light mode */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__header-period,
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__header-stats {
      color: #6b7280;
    }

    /* Tooltip: Premium style with status icon */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__tooltip {
      z-index: 100001;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      color: #1f2937;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
      padding: 14px 16px;
      min-width: 180px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__tooltip-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 700;
      padding-bottom: 10px;
      margin-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__tooltip-title--on {
      color: #16a34a;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__tooltip-title--off {
      color: #64748b;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__tooltip-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 4px 0;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__tooltip-label {
      color: #64748b;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__tooltip-value {
      color: #1e293b;
      font-size: 13px;
      font-weight: 600;
    }

    /* SVG axis label fill for light mode */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__axis-label {
      fill: #374151;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__date-label {
      fill: #6b7280;
    }

    /* Border and background for chart container */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__container {
      background: var(--onoff-btn-bg, #ffffff);
      border: 1px solid var(--onoff-border-color, #e5e7eb);
      border-radius: 8px;
    }

    /* Header inside the modal */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__header {
      padding-bottom: 6px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__header-period {
      font-size: 12px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__header-stats {
      font-size: 11px;
    }

    /* Usage summary stats */
    .${ON_OFF_MODAL_CSS_PREFIX}__usage-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      width: 100%;
      margin-bottom: 24px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__usage-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      background: var(--onoff-stat-bg, #f9fafb);
      border-radius: 8px;
      border: 1px solid var(--onoff-border-color, #e5e7eb);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__usage-stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--onoff-primary-color, #3b82f6);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__usage-stat-label {
      font-size: 13px;
      color: var(--onoff-text-muted, #6b7280);
      margin-top: 4px;
    }

    /* Chart placeholder */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--onoff-text-muted, #9ca3af);
      font-size: 14px;
      gap: 8px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-placeholder-icon {
      font-size: 48px;
      opacity: 0.5;
    }

    /* ===== Schedule View ===== */
    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--onoff-border-color, #e5e7eb);
      margin-bottom: 12px;
      flex-shrink: 0;
      background: var(--onoff-panel-bg, #f9fafb);
      border-radius: 8px 8px 0 0;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--onoff-text-color, #1f2937);
      margin: 0;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-content {
      flex: 1;
      overflow: auto;
      position: relative;
      padding: 8px 4px;
    }

    /* Add spacing to schedule items inside the modal */
    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-content .myio-sched__interval {
      margin-bottom: 12px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-content .myio-sched__form {
      padding: 12px;
      gap: 10px;
    }

    /* ===== Schedule button bar override (keep inside modal) ===== */
    .${ON_OFF_MODAL_CSS_PREFIX} .myio-sched__btn-bar {
      position: sticky;
      bottom: 0;
      left: 0;
      justify-content: flex-start;
      padding: 12px 16px;
      background: var(--onoff-panel-bg, #f9fafb);
      border-top: 1px solid var(--onoff-border-color, #e5e7eb);
      z-index: 2;
    }

    /* ===== Refresh Button ===== */
    .${ON_OFF_MODAL_CSS_PREFIX}__refresh-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 14px;
      background: transparent;
      border: 1px solid var(--onoff-border-color, #e5e7eb);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      color: var(--onoff-text-muted, #6b7280);
      margin-top: 8px;
      align-self: center;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__refresh-btn:hover {
      color: var(--onoff-primary-color, #3b82f6);
      border-color: var(--onoff-primary-color, #3b82f6);
      background: rgba(59, 130, 246, 0.05);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__refresh-btn:active {
      transform: scale(0.97);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__refresh-icon {
      display: inline-flex;
      align-items: center;
      transition: transform 0.3s ease;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__refresh-icon svg {
      width: 14px;
      height: 14px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__refresh-btn--loading .${ON_OFF_MODAL_CSS_PREFIX}__refresh-icon {
      animation: ${ON_OFF_MODAL_CSS_PREFIX}-spin 0.8s linear infinite;
    }

    /* ===== Loading State ===== */
    .${ON_OFF_MODAL_CSS_PREFIX}__loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 48px;
      color: var(--onoff-text-muted, #6b7280);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--onoff-border-color, #e5e7eb);
      border-top-color: var(--onoff-primary-color, #3b82f6);
      border-radius: 50%;
      animation: ${ON_OFF_MODAL_CSS_PREFIX}-spin 0.8s linear infinite;
    }

    @keyframes ${ON_OFF_MODAL_CSS_PREFIX}-spin {
      to { transform: rotate(360deg); }
    }

    /* ===== Error State ===== */
    .${ON_OFF_MODAL_CSS_PREFIX}__error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 48px;
      color: var(--onoff-error-color, #dc2626);
      text-align: center;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__error-icon {
      font-size: 48px;
    }

    /* ===== Dark Theme ===== */
    .${ON_OFF_MODAL_CSS_PREFIX}--dark {
      --onoff-bg: #1f2937;
      --onoff-panel-bg: #111827;
      --onoff-btn-bg: #374151;
      --onoff-btn-hover-bg: #4b5563;
      --onoff-chart-bg: #1f2937;
      --onoff-stat-bg: #374151;
      --onoff-text-color: #f3f4f6;
      --onoff-text-muted: #9ca3af;
      --onoff-border-color: #4b5563;
      --onoff-primary-color: #60a5fa;
      --onoff-error-color: #f87171;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn-label {
      color: #e5e7eb;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__date-input {
      background: #1f2937;
      border-color: #4b5563;
      color: #f3f4f6;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__date-input:hover {
      border-color: #60a5fa;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__date-input-icon {
      color: #6b7280;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__refresh-btn {
      border-color: #4b5563;
      color: #9ca3af;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__refresh-btn:hover {
      color: #60a5fa;
      border-color: #60a5fa;
      background: rgba(96, 165, 250, 0.08);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__export-btn {
      background: #374151;
      border-color: #4b5563;
      color: #9ca3af;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__export-btn:hover {
      color: #60a5fa;
      border-color: #60a5fa;
      background: rgba(96, 165, 250, 0.08);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__toolbar {
      background: #111827;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .myio-sched__btn-bar {
      background: #111827;
      border-top-color: #4b5563;
    }

    /* Dark theme: chart text colors */
    .${ON_OFF_MODAL_CSS_PREFIX}--dark .myio-onoff-timeline__summary-value {
      color: #f3f4f6 !important;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .myio-onoff-timeline__summary-label {
      color: #9ca3af !important;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .myio-onoff-timeline__legend-item {
      color: #d1d5db !important;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .myio-onoff-timeline__header-period,
    .${ON_OFF_MODAL_CSS_PREFIX}--dark .myio-onoff-timeline__header-stats {
      color: #9ca3af !important;
    }

    /* ... (código existente do tema escuro) ... */

    /* Dark theme: Tooltip overrides */
    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__tooltip {
      background: var(--onoff-panel-bg, #1f2937); /* Fundo escuro */
      border-color: var(--onoff-border-color, #4b5563); /* Borda cinza escuro */
      color: var(--onoff-text-color, #f3f4f6); /* Texto claro */
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5); /* Sombra mais forte */
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__tooltip-title {
      border-bottom-color: var(--onoff-border-color, #4b5563);
      color: var(--onoff-text-color, #f3f4f6);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__tooltip-label {
      color: var(--onoff-text-muted, #9ca3af);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}--dark .${ON_OFF_MODAL_CSS_PREFIX}__chart-content .myio-onoff-timeline__tooltip-value {
      color: var(--onoff-text-color, #f3f4f6);
    }

    /* ===== Responsive ===== */
    @media (max-width: 768px) {
      .${ON_OFF_MODAL_CSS_PREFIX} {
        flex-direction: column;
      }

      .${ON_OFF_MODAL_CSS_PREFIX}__left-panel {
        width: 100%;
        max-width: none;
        flex-direction: row;
        border-right: none;
        border-bottom: 1px solid var(--onoff-border-color, #e5e7eb);
        padding: 12px;
      }

      .${ON_OFF_MODAL_CSS_PREFIX}__control-container,
      .${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn-container {
        flex: 1;
      }

      .${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn {
        padding: 12px 16px;
      }

      .${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn-icon {
        font-size: 24px;
      }

      .${ON_OFF_MODAL_CSS_PREFIX}__toolbar {
        flex-wrap: wrap;
      }

      .${ON_OFF_MODAL_CSS_PREFIX}__date-input-wrapper {
        max-width: none;
      }

      .${ON_OFF_MODAL_CSS_PREFIX}__refresh-btn {
        padding: 5px 10px;
        font-size: 11px;
      }
    }

    .myio-onoff-modal__schedule-view {
      max-height: 704px;
    }

    .myio-onoff-modal__schedule-view {
      min-height: 435px;
    }
  `;

    

  document.head.appendChild(style);
}
