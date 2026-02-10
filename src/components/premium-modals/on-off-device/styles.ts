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
      height: 100%;
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

    /* Control container (50% of left panel height) */
    .${ON_OFF_MODAL_CSS_PREFIX}__control-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }

    /* Schedule button container (50% of left panel height) */
    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-btn-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 0;
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
      padding: 16px;
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
      display: none;
    }

    /* ===== Chart View ===== */
    .${ON_OFF_MODAL_CSS_PREFIX}__chart-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--onoff-border-color, #e5e7eb);
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--onoff-text-color, #1f2937);
      margin: 0;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__chart-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      background: var(--onoff-chart-bg, #ffffff);
      border: 1px solid var(--onoff-border-color, #e5e7eb);
      border-radius: 8px;
      padding: 24px;
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
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--onoff-border-color, #e5e7eb);
      margin-bottom: 16px;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--onoff-text-color, #1f2937);
      margin: 0;
    }

    .${ON_OFF_MODAL_CSS_PREFIX}__schedule-content {
      flex: 1;
      overflow: auto;
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
    }
  `;

  document.head.appendChild(style);
}
