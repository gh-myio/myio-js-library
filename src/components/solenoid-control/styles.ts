/**
 * RFC-0158: Solenoid Control Component Styles
 * Migrated from acionamento-solenoide-com-on-off
 */

export const SOLENOID_CONTROL_CSS_PREFIX = 'myio-solenoid-ctrl';

let stylesInjected = false;

export function injectSolenoidControlStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${SOLENOID_CONTROL_CSS_PREFIX}-styles`;
  style.textContent = `
    /* =====================================================
       MYIO Solenoid Control Component
       Migrated from acionamento-solenoide-com-on-off
       ===================================================== */

    .${SOLENOID_CONTROL_CSS_PREFIX} {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5%;
      margin: 0;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #18446C;
      box-sizing: border-box;
      overflow: hidden;
    }

    /* Dark theme */
    .${SOLENOID_CONTROL_CSS_PREFIX}--dark {
      color: #e0e0e0;
    }

    /* Valve image area */
    .${SOLENOID_CONTROL_CSS_PREFIX}__valve-area {
      height: 50%;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__valve-img {
      height: 80%;
      max-height: 120px;
      transition: opacity 0.3s ease;
    }

    /* Action button */
    .${SOLENOID_CONTROL_CSS_PREFIX}__action-btn {
      text-align: center;
      cursor: pointer;
      height: 40%;
      max-height: 60px;
      color: white;
      align-items: center;
      justify-content: center;
      gap: 12px;
      display: flex;
      width: 80%;
      max-width: 280px;
      border-radius: 10px;
      background-color: #28a745;
      border: none;
      font-size: 16px;
      font-weight: 600;
      font-family: inherit;
      transition: opacity 0.2s ease, transform 0.1s ease;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__action-btn:hover {
      opacity: 0.9;
      transform: scale(1.02);
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__action-btn:active {
      transform: scale(0.98);
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__action-btn--on {
      background-color: #28a745;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__action-btn--off {
      background-color: #dc3545;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__action-btn--offline {
      background-color: #191B1F;
      cursor: default;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__action-btn--offline:hover {
      opacity: 1;
      transform: none;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__btn-icon {
      font-size: 1.2em;
    }

    /* Slide-in animation for button content */
    .${SOLENOID_CONTROL_CSS_PREFIX}__action-btn span {
      animation: ${SOLENOID_CONTROL_CSS_PREFIX}-slide-in 0.5s ease;
    }

    @keyframes ${SOLENOID_CONTROL_CSS_PREFIX}-slide-in {
      from { transform: translateX(100%); }
      to { transform: translateX(0%); }
    }

    /* Modal overlay */
    .${SOLENOID_CONTROL_CSS_PREFIX}__modal-overlay {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__modal-backdrop {
      position: fixed;
      z-index: 2147483646;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      top: 0;
      left: 0;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__modal {
      position: relative;
      background-color: #fff;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      text-align: center;
      max-width: 90%;
      width: 300px;
      font-family: 'Segoe UI', Arial, sans-serif;
      z-index: 2147483647;
      color: #222;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__modal-message {
      margin-bottom: 20px;
      font-size: 16px;
      line-height: 1.4;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__modal-actions {
      display: flex;
      justify-content: space-around;
      gap: 12px;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__modal-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: opacity 0.2s ease;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__modal-btn:hover {
      opacity: 0.85;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__modal-btn--confirm {
      background-color: #28a745;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__modal-btn--cancel {
      background-color: #dc3545;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__modal-btn--close {
      background-color: #4caf50;
    }

    /* Notification modal variants */
    .${SOLENOID_CONTROL_CSS_PREFIX}__modal--success {
      border: 2px solid #4caf50;
      background: #e8f5e9;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__modal--warning {
      border: 2px solid #ff9800;
      background: #fff3e0;
    }

    .${SOLENOID_CONTROL_CSS_PREFIX}__modal--error {
      border: 2px solid #f44336;
      background: #ffebee;
    }
  `;

  document.head.appendChild(style);
}
