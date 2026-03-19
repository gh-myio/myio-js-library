/**
 * RFC-0170: Ambiente Group Modal Styles
 * CSS-in-JS styles for the ambiente group modal
 */

export const AMBIENTE_GROUP_CSS_PREFIX = 'myio-ambiente-group';

let stylesInjected = false;

export function injectAmbienteGroupModalStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${AMBIENTE_GROUP_CSS_PREFIX}-styles`;
  style.textContent = `
    /* =====================================================
       RFC-0170: Ambiente Group Modal Styles
       ===================================================== */

    .${AMBIENTE_GROUP_CSS_PREFIX}-overlay {
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

    .${AMBIENTE_GROUP_CSS_PREFIX}-overlay.visible {
      opacity: 1;
      visibility: visible;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX} {
      background: var(--ambiente-group-bg, #ffffff);
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
      max-width: 95vw;
      max-height: 90vh;
      width: 900px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transform: translateY(20px);
      transition: transform 0.2s ease;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}-overlay.visible .${AMBIENTE_GROUP_CSS_PREFIX} {
      transform: translateY(0);
    }

    /* ===== Header ===== */
    .${AMBIENTE_GROUP_CSS_PREFIX}__header {
      background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%);
      color: white;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__header-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__title {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      color: white;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__title-icon {
      font-size: 24px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subtitle {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.75);
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__close-btn {
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

    .${AMBIENTE_GROUP_CSS_PREFIX}__close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* ===== Body ===== */
    .${AMBIENTE_GROUP_CSS_PREFIX}__body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      background: var(--ambiente-group-body-bg, #f8f9fa);
    }

    /* ===== Summary Cards ===== */
    .${AMBIENTE_GROUP_CSS_PREFIX}__summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__summary-card {
      background: white;
      border-radius: 10px;
      padding: 16px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      border: 1px solid #e9ecef;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__summary-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__summary-value {
      font-size: 24px;
      font-weight: 700;
      color: #212529;
      margin-bottom: 4px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__summary-value.temperature { color: #0d6efd; }
    .${AMBIENTE_GROUP_CSS_PREFIX}__summary-value.humidity { color: #17a2b8; }
    .${AMBIENTE_GROUP_CSS_PREFIX}__summary-value.consumption { color: #198754; }
    .${AMBIENTE_GROUP_CSS_PREFIX}__summary-value.devices { color: #6c757d; }

    .${AMBIENTE_GROUP_CSS_PREFIX}__summary-label {
      font-size: 11px;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__summary-range {
      font-size: 10px;
      color: #adb5bd;
      margin-top: 4px;
    }

    /* ===== Status Bar ===== */
    .${AMBIENTE_GROUP_CSS_PREFIX}__status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: white;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #e9ecef;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__status-dot.online { background: #28a745; }
    .${AMBIENTE_GROUP_CSS_PREFIX}__status-dot.offline { background: #dc3545; }
    .${AMBIENTE_GROUP_CSS_PREFIX}__status-dot.warning { background: #ffc107; }

    /* ===== Sub-Ambientes Section ===== */
    .${AMBIENTE_GROUP_CSS_PREFIX}__section-title {
      font-size: 14px;
      font-weight: 600;
      color: #495057;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambientes {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* ===== Sub-Ambiente Card ===== */
    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente {
      background: white;
      border-radius: 10px;
      border: 1px solid #e9ecef;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente:hover {
      border-color: #1e3a5f;
      box-shadow: 0 4px 12px rgba(30, 58, 95, 0.1);
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      cursor: pointer;
      background: #fafbfc;
      border-bottom: 1px solid #e9ecef;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-status {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-status.online { background: #28a745; }
    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-status.offline { background: #dc3545; }
    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-status.warning { background: #ffc107; }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-name {
      font-size: 14px;
      font-weight: 600;
      color: #212529;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metrics {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric-icon {
      font-size: 14px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric-value {
      font-weight: 600;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric-value.temperature { color: #0d6efd; }
    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric-value.humidity { color: #17a2b8; }
    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metric-value.consumption { color: #198754; }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-arrow {
      font-size: 12px;
      color: #6c757d;
      transition: transform 0.2s;
      margin-left: 16px;
      flex-shrink: 0;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente.expanded .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-arrow {
      transform: rotate(90deg);
    }

    /* ===== Sub-Ambiente Details (Expandable) ===== */
    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-details {
      display: none;
      padding: 16px;
      border-top: 1px solid #e9ecef;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente.expanded .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-details {
      display: block;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__devices-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__device-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: #f8f9fa;
      border-radius: 6px;
      font-size: 12px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__device-icon {
      font-size: 16px;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__device-info {
      flex: 1;
      min-width: 0;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__device-name {
      font-weight: 500;
      color: #212529;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__device-type {
      font-size: 10px;
      color: #6c757d;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__device-value {
      font-weight: 600;
      color: #198754;
    }

    /* ===== Remote Controls ===== */
    .${AMBIENTE_GROUP_CSS_PREFIX}__remotes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e9ecef;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__remote-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid transparent;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__remote-btn.on {
      background: rgba(40, 167, 69, 0.15);
      color: #28a745;
      border-color: rgba(40, 167, 69, 0.3);
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__remote-btn.off {
      background: rgba(108, 117, 125, 0.1);
      color: #6c757d;
      border-color: rgba(108, 117, 125, 0.2);
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__remote-btn:hover {
      transform: scale(1.02);
    }

    /* ===== Footer ===== */
    .${AMBIENTE_GROUP_CSS_PREFIX}__footer {
      padding: 16px 24px;
      border-top: 1px solid #e9ecef;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background: white;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__btn {
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__btn-close {
      background: #6c757d;
      color: white;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}__btn-close:hover {
      background: #5a6268;
    }

    /* ===== Dark Theme ===== */
    .${AMBIENTE_GROUP_CSS_PREFIX}--dark {
      --ambiente-group-bg: #1f2937;
      --ambiente-group-body-bg: #111827;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}--dark .${AMBIENTE_GROUP_CSS_PREFIX}__summary-card,
    .${AMBIENTE_GROUP_CSS_PREFIX}--dark .${AMBIENTE_GROUP_CSS_PREFIX}__status-bar,
    .${AMBIENTE_GROUP_CSS_PREFIX}--dark .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente {
      background: #1f2937;
      border-color: #374151;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}--dark .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-header {
      background: #1a2332;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}--dark .${AMBIENTE_GROUP_CSS_PREFIX}__summary-value,
    .${AMBIENTE_GROUP_CSS_PREFIX}--dark .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-name {
      color: #f3f4f6;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}--dark .${AMBIENTE_GROUP_CSS_PREFIX}__section-title {
      color: #e5e7eb;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}--dark .${AMBIENTE_GROUP_CSS_PREFIX}__device-item {
      background: #374151;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}--dark .${AMBIENTE_GROUP_CSS_PREFIX}__device-name {
      color: #f3f4f6;
    }

    .${AMBIENTE_GROUP_CSS_PREFIX}--dark .${AMBIENTE_GROUP_CSS_PREFIX}__footer {
      background: #1f2937;
      border-color: #374151;
    }

    /* ===== Responsive ===== */
    @media (max-width: 768px) {
      .${AMBIENTE_GROUP_CSS_PREFIX} {
        width: 100%;
        height: 100%;
        max-height: 100vh;
        border-radius: 0;
      }

      .${AMBIENTE_GROUP_CSS_PREFIX}__summary {
        grid-template-columns: repeat(2, 1fr);
      }

      .${AMBIENTE_GROUP_CSS_PREFIX}__subambiente-metrics {
        display: none;
      }

      .${AMBIENTE_GROUP_CSS_PREFIX}__devices-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}
