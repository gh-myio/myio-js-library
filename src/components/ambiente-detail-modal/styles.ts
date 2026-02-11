/**
 * RFC-0168: Ambiente Detail Modal Styles
 * CSS-in-JS styles for the ambiente detail modal
 */

export const AMBIENTE_MODAL_CSS_PREFIX = 'myio-ambiente-modal';

let stylesInjected = false;

export function injectAmbienteModalStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${AMBIENTE_MODAL_CSS_PREFIX}-styles`;
  style.textContent = `
    /* =====================================================
       RFC-0168: Ambiente Detail Modal Styles
       ===================================================== */

    .${AMBIENTE_MODAL_CSS_PREFIX}-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease, visibility 0.2s ease;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}-overlay.visible {
      opacity: 1;
      visibility: visible;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX} {
      background: var(--ambiente-modal-bg, #ffffff);
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
      max-width: 95vw;
      max-height: 90vh;
      width: 800px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transform: translateY(20px);
      transition: transform 0.2s ease;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}-overlay.visible .${AMBIENTE_MODAL_CSS_PREFIX} {
      transform: translateY(0);
    }

    /* ===== Header ===== */
    .${AMBIENTE_MODAL_CSS_PREFIX}__header {
      background: linear-gradient(135deg, #2F5848 0%, #1e3a2f 100%);
      color: white;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__header-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__title {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: white;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__subtitle {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.75);
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__close-btn {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: white;
      padding: 0;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: background 0.2s;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* ===== Body ===== */
    .${AMBIENTE_MODAL_CSS_PREFIX}__body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      background: var(--ambiente-modal-body-bg, #f8f9fa);
    }

    /* ===== Status Banner ===== */
    .${AMBIENTE_MODAL_CSS_PREFIX}__status-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__status-banner.online {
      background: rgba(40, 167, 69, 0.1);
      border: 1px solid rgba(40, 167, 69, 0.3);
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__status-banner.offline {
      background: rgba(220, 53, 69, 0.1);
      border: 1px solid rgba(220, 53, 69, 0.3);
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__status-banner.warning {
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__status-dot.online {
      background: #28a745;
      box-shadow: 0 0 8px rgba(40, 167, 69, 0.5);
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__status-dot.offline {
      background: #dc3545;
      animation: pulse-offline 1s infinite;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__status-dot.warning {
      background: #ffc107;
    }

    @keyframes pulse-offline {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__status-text {
      font-size: 14px;
      font-weight: 500;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__status-text.online { color: #28a745; }
    .${AMBIENTE_MODAL_CSS_PREFIX}__status-text.offline { color: #dc3545; }
    .${AMBIENTE_MODAL_CSS_PREFIX}__status-text.warning { color: #d39e00; }

    /* ===== Metrics Grid ===== */
    .${AMBIENTE_MODAL_CSS_PREFIX}__metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__metric-card {
      background: white;
      border-radius: 10px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      border: 1px solid #e9ecef;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__metric-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__metric-icon {
      font-size: 20px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__metric-label {
      font-size: 12px;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__metric-value {
      font-size: 28px;
      font-weight: 700;
      color: #212529;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__metric-value.temperature { color: #0d6efd; }
    .${AMBIENTE_MODAL_CSS_PREFIX}__metric-value.humidity { color: #17a2b8; }
    .${AMBIENTE_MODAL_CSS_PREFIX}__metric-value.consumption { color: #198754; }

    .${AMBIENTE_MODAL_CSS_PREFIX}__metric-unit {
      font-size: 14px;
      font-weight: 400;
      color: #6c757d;
      margin-left: 4px;
    }

    /* ===== Section ===== */
    .${AMBIENTE_MODAL_CSS_PREFIX}__section {
      margin-bottom: 24px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__section-title {
      font-size: 14px;
      font-weight: 600;
      color: #495057;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__section-icon {
      font-size: 16px;
    }

    /* ===== Device List ===== */
    .${AMBIENTE_MODAL_CSS_PREFIX}__device-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__device-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e9ecef;
      transition: border-color 0.2s;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__device-item:hover {
      border-color: #2F5848;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__device-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__device-icon {
      font-size: 20px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__device-name {
      font-size: 14px;
      font-weight: 500;
      color: #212529;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__device-type {
      font-size: 11px;
      color: #6c757d;
      margin-top: 2px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__device-value {
      font-size: 16px;
      font-weight: 600;
      color: #198754;
    }

    /* ===== Remote Controls ===== */
    .${AMBIENTE_MODAL_CSS_PREFIX}__remote-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__remote-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      border-radius: 10px;
      border: 2px solid transparent;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      min-width: 140px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__remote-btn.on {
      background: rgba(40, 167, 69, 0.15);
      color: #28a745;
      border-color: rgba(40, 167, 69, 0.4);
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__remote-btn.on:hover {
      background: rgba(40, 167, 69, 0.25);
      border-color: #28a745;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__remote-btn.off {
      background: rgba(108, 117, 125, 0.1);
      color: #6c757d;
      border-color: rgba(108, 117, 125, 0.3);
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__remote-btn.off:hover {
      background: rgba(108, 117, 125, 0.2);
      border-color: #6c757d;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__remote-icon {
      font-size: 20px;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__remote-name {
      flex: 1;
      text-align: left;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__remote-status {
      font-weight: 600;
    }

    /* ===== Empty State ===== */
    .${AMBIENTE_MODAL_CSS_PREFIX}__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      color: #6c757d;
      text-align: center;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__empty-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__empty-text {
      font-size: 14px;
    }

    /* ===== Footer ===== */
    .${AMBIENTE_MODAL_CSS_PREFIX}__footer {
      padding: 16px 24px;
      border-top: 1px solid #e9ecef;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background: white;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__btn {
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__btn-close {
      background: #6c757d;
      color: white;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}__btn-close:hover {
      background: #5a6268;
    }

    /* ===== Dark Theme ===== */
    .${AMBIENTE_MODAL_CSS_PREFIX}--dark {
      --ambiente-modal-bg: #1f2937;
      --ambiente-modal-body-bg: #111827;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}--dark .${AMBIENTE_MODAL_CSS_PREFIX}__metric-card {
      background: #1f2937;
      border-color: #374151;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}--dark .${AMBIENTE_MODAL_CSS_PREFIX}__device-item {
      background: #1f2937;
      border-color: #374151;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}--dark .${AMBIENTE_MODAL_CSS_PREFIX}__section-title {
      color: #e5e7eb;
      border-color: #374151;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}--dark .${AMBIENTE_MODAL_CSS_PREFIX}__metric-value {
      color: #f3f4f6;
    }

    .${AMBIENTE_MODAL_CSS_PREFIX}--dark .${AMBIENTE_MODAL_CSS_PREFIX}__footer {
      background: #1f2937;
      border-color: #374151;
    }

    /* ===== Responsive ===== */
    @media (max-width: 600px) {
      .${AMBIENTE_MODAL_CSS_PREFIX} {
        width: 100%;
        height: 100%;
        max-height: 100vh;
        border-radius: 0;
      }

      .${AMBIENTE_MODAL_CSS_PREFIX}__metrics-grid {
        grid-template-columns: 1fr 1fr;
      }

      .${AMBIENTE_MODAL_CSS_PREFIX}__metric-value {
        font-size: 22px;
      }

      .${AMBIENTE_MODAL_CSS_PREFIX}__remote-controls {
        flex-direction: column;
      }

      .${AMBIENTE_MODAL_CSS_PREFIX}__remote-btn {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);
}
