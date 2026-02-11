/**
 * RFC-0172: Switch Control Component Styles
 * CSS-in-JS for on/off interruptor control
 */

export const SWITCH_CONTROL_CSS_PREFIX = 'myio-switch-ctrl';

let stylesInjected = false;

export function injectSwitchControlStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${SWITCH_CONTROL_CSS_PREFIX}-styles`;
  style.textContent = `
    /* =====================================================
       MYIO Switch Control Component
       RFC-0172: On/Off Interruptor Control
       ===================================================== */

    .${SWITCH_CONTROL_CSS_PREFIX} {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: all 0.2s ease;
      cursor: pointer;
      user-select: none;
      min-width: 160px;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}:hover {
      border-color: #2F5848;
      box-shadow: 0 2px 8px rgba(47, 88, 72, 0.15);
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--on {
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      border-color: #4caf50;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--off {
      background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
      border-color: #bdbdbd;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--offline {
      background: #f5f5f5;
      border-color: #9e9e9e;
      cursor: not-allowed;
      opacity: 0.7;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--loading {
      pointer-events: none;
      opacity: 0.8;
    }

    /* Dark theme */
    .${SWITCH_CONTROL_CSS_PREFIX}--dark {
      background: #2d2d2d;
      border-color: #404040;
      color: #e0e0e0;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--dark:hover {
      border-color: #4caf50;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--dark.${SWITCH_CONTROL_CSS_PREFIX}--on {
      background: linear-gradient(135deg, #1b3d1f 0%, #2e5832 100%);
      border-color: #4caf50;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--dark.${SWITCH_CONTROL_CSS_PREFIX}--off {
      background: linear-gradient(135deg, #2d2d2d 0%, #383838 100%);
      border-color: #555;
    }

    /* Toggle switch visual */
    .${SWITCH_CONTROL_CSS_PREFIX}__toggle {
      position: relative;
      width: 50px;
      height: 28px;
      background: #bdbdbd;
      border-radius: 14px;
      transition: all 0.3s ease;
      flex-shrink: 0;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__toggle::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 22px;
      height: 22px;
      background: #ffffff;
      border-radius: 50%;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--on .${SWITCH_CONTROL_CSS_PREFIX}__toggle {
      background: #4caf50;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--on .${SWITCH_CONTROL_CSS_PREFIX}__toggle::after {
      left: 25px;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--offline .${SWITCH_CONTROL_CSS_PREFIX}__toggle {
      background: #9e9e9e;
    }

    /* Loading spinner in toggle */
    .${SWITCH_CONTROL_CSS_PREFIX}--loading .${SWITCH_CONTROL_CSS_PREFIX}__toggle::after {
      animation: ${SWITCH_CONTROL_CSS_PREFIX}-pulse 1s ease-in-out infinite;
    }

    @keyframes ${SWITCH_CONTROL_CSS_PREFIX}-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Info section */
    .${SWITCH_CONTROL_CSS_PREFIX}__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__name {
      font-size: 14px;
      font-weight: 500;
      color: #212121;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--dark .${SWITCH_CONTROL_CSS_PREFIX}__name {
      color: #e0e0e0;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__status {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--on .${SWITCH_CONTROL_CSS_PREFIX}__status {
      color: #2e7d32;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--off .${SWITCH_CONTROL_CSS_PREFIX}__status {
      color: #757575;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--offline .${SWITCH_CONTROL_CSS_PREFIX}__status {
      color: #9e9e9e;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--dark.${SWITCH_CONTROL_CSS_PREFIX}--on .${SWITCH_CONTROL_CSS_PREFIX}__status {
      color: #81c784;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}--dark.${SWITCH_CONTROL_CSS_PREFIX}--off .${SWITCH_CONTROL_CSS_PREFIX}__status {
      color: #9e9e9e;
    }

    /* Status icon */
    .${SWITCH_CONTROL_CSS_PREFIX}__icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    /* ===== Confirmation Modal ===== */
    .${SWITCH_CONTROL_CSS_PREFIX}__modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      animation: ${SWITCH_CONTROL_CSS_PREFIX}-fade-in 0.2s ease;
    }

    @keyframes ${SWITCH_CONTROL_CSS_PREFIX}-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal {
      background: #ffffff;
      border-radius: 12px;
      padding: 24px;
      max-width: 320px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      animation: ${SWITCH_CONTROL_CSS_PREFIX}-slide-up 0.2s ease;
    }

    @keyframes ${SWITCH_CONTROL_CSS_PREFIX}-slide-up {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal-icon {
      font-size: 48px;
      text-align: center;
      margin-bottom: 16px;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal-title {
      font-size: 16px;
      font-weight: 600;
      color: #212121;
      text-align: center;
      margin: 0 0 8px 0;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal-message {
      font-size: 14px;
      color: #616161;
      text-align: center;
      margin: 0 0 20px 0;
      line-height: 1.5;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal-btn {
      flex: 1;
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal-btn:hover {
      transform: translateY(-1px);
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal-btn:active {
      transform: translateY(0);
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal-btn--confirm {
      background: #4caf50;
      color: white;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal-btn--confirm:hover {
      background: #43a047;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal-btn--cancel {
      background: #f5f5f5;
      color: #616161;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__modal-btn--cancel:hover {
      background: #eeeeee;
    }

    /* Feedback toast */
    .${SWITCH_CONTROL_CSS_PREFIX}__toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: white;
      z-index: 10002;
      animation: ${SWITCH_CONTROL_CSS_PREFIX}-toast-in 0.3s ease;
    }

    @keyframes ${SWITCH_CONTROL_CSS_PREFIX}-toast-in {
      from { transform: translateX(-50%) translateY(20px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__toast--success {
      background: #4caf50;
    }

    .${SWITCH_CONTROL_CSS_PREFIX}__toast--error {
      background: #f44336;
    }
  `;

  document.head.appendChild(style);
}
