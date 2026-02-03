/**
 * RFC-0158: Fancoil Remote Control Component Styles
 * Migrated from remote-version-fancoil-widget-v1.0.0
 */

export const FANCOIL_REMOTE_CSS_PREFIX = 'myio-fancoil-remote';

let stylesInjected = false;

export function injectFancoilRemoteStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${FANCOIL_REMOTE_CSS_PREFIX}-styles`;
  style.textContent = `
    /* =====================================================
       MYIO Fancoil Remote Control Component
       Migrated from remote-version-fancoil-widget-v1.0.0
       ===================================================== */

    .${FANCOIL_REMOTE_CSS_PREFIX} {
      min-width: 280px;
      max-width: 320px;
      width: 100%;
      height: auto;
      background: #BBB8A6;
      border-radius: 18px;
      padding: 12px;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #18446C;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow:
        0 10px 25px rgba(0, 0, 0, 0.25),
        0 4px 6px rgba(0, 0, 0, 0.15),
        0 0 1px rgba(0, 0, 0, 0.1);
      transition: box-shadow 0.3s ease, transform 0.3s ease;
      box-sizing: border-box;
    }

    /* Dark theme */
    .${FANCOIL_REMOTE_CSS_PREFIX}--dark {
      background: #3a3a3a;
      color: #e0e0e0;
    }

    /* LCD Display Area */
    .${FANCOIL_REMOTE_CSS_PREFIX}__lcd {
      background: #ffffff;
      border-radius: 8px;
      padding: 15px;
      box-shadow: inset 0 0 4px #999;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}--dark .${FANCOIL_REMOTE_CSS_PREFIX}__lcd {
      background: #2a2a2a;
      box-shadow: inset 0 0 4px #000;
    }

    /* Status Bar */
    .${FANCOIL_REMOTE_CSS_PREFIX}__status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      margin-bottom: 15px;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__status-label {
      font-size: 1.4em;
      text-align: left;
      margin-left: 10px;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__status-chip {
      padding: 4px 12px;
      border-radius: 8px;
      font-size: 0.85em;
      color: white;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__status-chip--on {
      background-color: #4caf50;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__status-chip--off {
      background-color: #ed4465;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__status-chip--offline {
      background-color: #757575;
    }

    /* Mode Toggle */
    .${FANCOIL_REMOTE_CSS_PREFIX}__mode-toggle {
      display: flex;
      justify-content: space-between;
      background: #e0e0e0;
      border-radius: 8px;
      padding: 4px;
      margin: 6px 0;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}--dark .${FANCOIL_REMOTE_CSS_PREFIX}__mode-toggle {
      background: #444;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__mode-option {
      flex: 1;
      text-align: center;
      font-weight: bold;
      padding: 6px 0;
      border-radius: 6px;
      color: #555;
      transition: all 0.2s ease;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}--dark .${FANCOIL_REMOTE_CSS_PREFIX}__mode-option {
      color: #aaa;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__mode-option--active {
      background-color: #4caf50;
      color: white !important;
      box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.2);
    }

    /* Image Block */
    .${FANCOIL_REMOTE_CSS_PREFIX}__image-block {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 15px;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__ac-image-wrapper {
      padding: 4px;
      border-radius: 6px;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__ac-image {
      height: 65px;
      width: auto;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__metrics {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      font-size: 0.9em;
      font-weight: bold;
      gap: 8px;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__metric {
      font-size: 1.3em;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__metric-icon {
      font-size: 1.1em;
    }

    /* Setpoint Grid */
    .${FANCOIL_REMOTE_CSS_PREFIX}__setpoint-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 15px;
      align-items: center;
      justify-items: center;
      margin-top: 15px;
      margin-bottom: 15px;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__grid-label {
      font-weight: bold;
      font-size: 1.3em;
      justify-self: center;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__grid-value {
      background: #e0f2f1;
      padding: 8px 25px;
      border-radius: 10px;
      box-shadow: inset 0 0 4px #999;
      font-size: 1.2em;
      font-weight: 600;
      min-width: 80px;
      text-align: center;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}--dark .${FANCOIL_REMOTE_CSS_PREFIX}__grid-value {
      background: #1a3a3a;
      box-shadow: inset 0 0 4px #000;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__grid-value--disabled {
      background: #f5f5f5;
      color: #999;
    }

    /* Buttons */
    .${FANCOIL_REMOTE_CSS_PREFIX}__btn {
      width: 60px;
      height: 48px;
      background: #eee;
      border: none;
      border-radius: 10px;
      font-size: 1.2em;
      box-shadow: 0 4px #999;
      color: #18446C;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__btn:active {
      box-shadow: inset 0 2px 4px #666;
      transform: translateY(2px);
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__btn:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__btn:disabled {
      cursor: not-allowed;
      opacity: 0.3;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__btn--power {
      width: 70px;
      font-size: 1.4em;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__btn--power-active {
      background-color: #76BEFF;
      color: white;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__btn--power-active:hover:not(:disabled) {
      background: #5aa8e8;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__btn-group {
      display: flex;
      flex-direction: row;
      gap: 8px;
      justify-content: center;
    }

    /* Actions Bar */
    .${FANCOIL_REMOTE_CSS_PREFIX}__actions {
      background: #726F6F;
      padding: 12px;
      border-radius: 10px;
      text-align: center;
      font-size: 1.3em;
      font-weight: bold;
      box-shadow: 0 3px #555;
      cursor: pointer;
      color: white;
      transition: all 0.2s ease;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__actions:hover {
      transform: scale(1.03);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__actions:active {
      transform: scale(0.98);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    /* Modal Styles */
    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-overlay {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: flex-start;
      padding-top: 20vh;
      justify-content: center;
      z-index: 2147483647;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-backdrop {
      position: fixed;
      z-index: 2147483646;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      top: 0;
      left: 0;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-content {
      position: relative;
      background: #ffffff;
      border-radius: 16px;
      padding: 24px 32px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      text-align: center;
      max-width: 360px;
      width: 90%;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #222;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-content--success {
      background: #e8f5e9;
      border: 2px solid #4caf50;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-content--warning {
      background: #fff3e0;
      border: 2px solid #ff9800;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-content--error {
      background: #ffebee;
      border: 2px solid #f44336;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-title {
      margin: 0 0 12px;
      font-size: 1.4em;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-message {
      font-size: 1.05em;
      margin-bottom: 20px;
      line-height: 1.4;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-actions {
      display: flex;
      justify-content: center;
      gap: 16px;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn {
      padding: 10px 20px;
      border: none;
      font-weight: bold;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1em;
      transition: all 0.2s ease;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn--cancel {
      background: #e0e0e0;
      color: #333;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn--cancel:hover {
      background: #d0d0d0;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn--confirm {
      background: #1976d2;
      color: #fff;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn--confirm:hover {
      background: #1565c0;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn--close {
      background: #4caf50;
      color: white;
    }

    .${FANCOIL_REMOTE_CSS_PREFIX}__modal-btn--close:hover {
      background: #43a047;
    }

    /* Responsive adjustments */
    @media (max-width: 320px) {
      .${FANCOIL_REMOTE_CSS_PREFIX} {
        min-width: 260px;
        padding: 10px;
      }

      .${FANCOIL_REMOTE_CSS_PREFIX}__status-label {
        font-size: 1.2em;
      }

      .${FANCOIL_REMOTE_CSS_PREFIX}__metric {
        font-size: 1.1em;
      }

      .${FANCOIL_REMOTE_CSS_PREFIX}__grid-label {
        font-size: 1.1em;
      }

      .${FANCOIL_REMOTE_CSS_PREFIX}__btn {
        width: 50px;
        height: 42px;
      }
    }
  `;

  document.head.appendChild(style);
}
