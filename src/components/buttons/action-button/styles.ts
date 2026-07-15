/**
 * RFC-0158: Action Button Component Styles
 * Migrated from action-button widget
 */

export const ACTION_BUTTON_CSS_PREFIX = 'myio-action-btn';

let stylesInjected = false;

export function injectActionButtonStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = `${ACTION_BUTTON_CSS_PREFIX}-styles`;
  style.textContent = `
    /* =====================================================
       MYIO Action Button Component
       Migrated from action-button widget
       ===================================================== */

    .${ACTION_BUTTON_CSS_PREFIX} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: none;
      cursor: pointer;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 600;
      white-space: nowrap;
      transition: all 0.2s ease;
      box-sizing: border-box;
      outline: none;
      position: relative;
      user-select: none;
      text-decoration: none;
      line-height: 1;
    }

    /* Sizes */
    .${ACTION_BUTTON_CSS_PREFIX}--small {
      padding: 6px 14px;
      font-size: 12px;
      min-height: 32px;
    }

    .${ACTION_BUTTON_CSS_PREFIX}--medium {
      padding: 10px 20px;
      font-size: 14px;
      min-height: 40px;
    }

    .${ACTION_BUTTON_CSS_PREFIX}--large {
      padding: 14px 28px;
      font-size: 16px;
      min-height: 48px;
    }

    /* Full-width modifier */
    .${ACTION_BUTTON_CSS_PREFIX}--full-width {
      display: flex;
      width: 100%;
    }

    /* Filled variant */
    .${ACTION_BUTTON_CSS_PREFIX}--filled {
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    .${ACTION_BUTTON_CSS_PREFIX}--filled:hover:not(:disabled) {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      filter: brightness(1.08);
    }

    .${ACTION_BUTTON_CSS_PREFIX}--filled:active:not(:disabled) {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      filter: brightness(0.95);
      transform: translateY(1px);
    }

    /* Outlined variant */
    .${ACTION_BUTTON_CSS_PREFIX}--outlined {
      background: transparent;
      border: 2px solid currentColor;
    }

    .${ACTION_BUTTON_CSS_PREFIX}--outlined:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.04);
    }

    .${ACTION_BUTTON_CSS_PREFIX}--outlined:active:not(:disabled) {
      background: rgba(0, 0, 0, 0.08);
      transform: translateY(1px);
    }

    /* Dark theme outlined */
    .${ACTION_BUTTON_CSS_PREFIX}--dark.${ACTION_BUTTON_CSS_PREFIX}--outlined:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
    }

    .${ACTION_BUTTON_CSS_PREFIX}--dark.${ACTION_BUTTON_CSS_PREFIX}--outlined:active:not(:disabled) {
      background: rgba(255, 255, 255, 0.12);
    }

    /* Text variant */
    .${ACTION_BUTTON_CSS_PREFIX}--text {
      background: transparent;
      border: none;
      box-shadow: none;
    }

    .${ACTION_BUTTON_CSS_PREFIX}--text:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.04);
    }

    .${ACTION_BUTTON_CSS_PREFIX}--text:active:not(:disabled) {
      background: rgba(0, 0, 0, 0.08);
      transform: translateY(1px);
    }

    .${ACTION_BUTTON_CSS_PREFIX}--dark.${ACTION_BUTTON_CSS_PREFIX}--text:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
    }

    .${ACTION_BUTTON_CSS_PREFIX}--dark.${ACTION_BUTTON_CSS_PREFIX}--text:active:not(:disabled) {
      background: rgba(255, 255, 255, 0.12);
    }

    /* Disabled state */
    .${ACTION_BUTTON_CSS_PREFIX}:disabled {
      cursor: not-allowed;
      opacity: 0.45;
      pointer-events: none;
    }

    /* Icon */
    .${ACTION_BUTTON_CSS_PREFIX}__icon {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      font-size: 1.15em;
    }

    /* Focus visible */
    .${ACTION_BUTTON_CSS_PREFIX}:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
  `;

  document.head.appendChild(style);
}
