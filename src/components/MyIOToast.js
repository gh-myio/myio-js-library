/* global window, document */
// src/components/MyIOToast.js
/**
 * MyIO Global Toast Manager
 *
 * A lightweight, globally accessible toast notification system for MyIO applications.
 *
 * Features:
 * - Singleton CONTAINER, but each toast is its own element → toasts STACK vertically
 *   (they no longer overwrite each other when several fire in quick succession).
 * - Multiple toast types: info, success, warning, error
 * - Per-toast automatic dismissal with customizable duration
 * - Smooth slide-in/out animations; stack capped at MAX_TOASTS (oldest dropped)
 * - No external dependencies
 *
 * Usage:
 * ```javascript
 * import { MyIOToast } from 'myio-js-library';
 *
 * MyIOToast.show('Operation completed');            // info
 * MyIOToast.error('Failed to load data');           // stacks below previous toasts
 * const t = MyIOToast.info('Processing…', 0);        // duration 0 = sticky
 * t.hide();                                          // dismiss that specific toast
 * MyIOToast.hide();                                  // dismiss ALL toasts
 * ```
 *
 * @module MyIOToast
 */

import InfoTooltip from '../utils/tooltips/InfoTooltip';

/**
 * ============================================================================
 *   ✂️  TOAST MESSAGE TRUNCATION LIMIT  ✂️
 * ============================================================================
 *   Messages longer than this are truncated with "…" and get a "+" button
 *   that opens the FULL message in the shared InfoTooltip panel (pin/maximize,
 *   same pattern as src/utils/tooltips/InfoTooltip.ts). Keeps long warnings/errors from
 *   blowing up the toast.
 * ============================================================================
 */
const TOAST_MAX_MESSAGE_LENGTH = 100;

/** Maximum number of stacked toasts kept on screen; older ones are dropped. */
const MAX_TOASTS = 6;

const TOAST_TYPE_META = {
  info:    { icon: 'ℹ️', title: 'Informação' },
  success: { icon: '✅', title: 'Sucesso' },
  warning: { icon: '⚠️', title: 'Aviso' },
  error:   { icon: '🚫', title: 'Erro' },
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

const MyIOToast = (function() {
  let toastContainer = null;

  // CSS: the container is a fixed, top-right vertical STACK; each `.myio-toast` is a card.
  const TOAST_CSS = `
    #myio-global-toast-container {
      position: fixed;
      top: 25px;
      right: 25px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 480px;
      pointer-events: none; /* let clicks pass through the gaps; each toast re-enables */
    }

    #myio-global-toast-container .myio-toast {
      min-width: 320px;
      max-width: 480px;
      padding: 16px 20px;
      background-color: #323232;
      color: white;
      font-family: 'Nunito', system-ui, sans-serif;
      font-size: 14px;
      border-radius: 8px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      border-left: 5px solid transparent;
      display: flex;
      align-items: center;
      word-wrap: break-word;
      pointer-events: auto;
      transform: translateX(480px);
      opacity: 0;
      transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
    }

    #myio-global-toast-container .myio-toast.show {
      transform: translateX(0);
      opacity: 1;
    }

    #myio-global-toast-container .myio-toast.hiding {
      transform: translateX(480px);
      opacity: 0;
    }

    #myio-global-toast-container .myio-toast.info    { background-color: #2196f3; border-color: #1976d2; }
    #myio-global-toast-container .myio-toast.success { background-color: #4caf50; border-color: #388e3c; }
    #myio-global-toast-container .myio-toast.warning { background-color: #ff9800; border-color: #f57c00; }
    #myio-global-toast-container .myio-toast.error   { background-color: #d32f2f; border-color: #b71c1c; }

    #myio-global-toast-container .myio-toast::before { content: 'ℹ️'; margin-right: 12px; font-size: 20px; flex-shrink: 0; }
    #myio-global-toast-container .myio-toast.success::before { content: '✅'; }
    #myio-global-toast-container .myio-toast.warning::before { content: '⚠️'; }
    #myio-global-toast-container .myio-toast.error::before   { content: '🚫'; }

    #myio-global-toast-container .myio-toast-msg {
      flex: 1 1 auto;
      min-width: 0;
    }

    /* "+" button — opens the full message in the InfoTooltip panel */
    #myio-global-toast-container .myio-toast-expand {
      flex-shrink: 0;
      margin-left: 12px;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.25);
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    #myio-global-toast-container .myio-toast-expand:hover {
      background: rgba(255, 255, 255, 0.45);
    }

    @media (max-width: 480px) {
      #myio-global-toast-container {
        top: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
      }
      #myio-global-toast-container .myio-toast {
        min-width: auto;
        max-width: none;
      }
    }
  `;

  /**
   * Create (once) the stack container in the DOM.
   * @private
   */
  function ensureContainer() {
    if (toastContainer && document.body && document.body.contains(toastContainer)) return;

    if (!document.getElementById('myio-global-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'myio-global-toast-styles';
      style.textContent = TOAST_CSS;
      document.head.appendChild(style);
    }

    toastContainer = document.getElementById('myio-global-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'myio-global-toast-container';
      document.body.appendChild(toastContainer);
    }
  }

  /**
   * Animate a toast out and remove it from the DOM.
   * @private
   */
  function removeToast(el) {
    if (!el) return;
    el.classList.remove('show');
    el.classList.add('hiding');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 320);
  }

  /**
   * Show a toast notification. Each call appends a NEW toast to the stack.
   *
   * @param {string} message - The message to display
   * @param {string} [type='info'] - 'info' | 'success' | 'warning' | 'error'
   * @param {number} [duration=3500] - ms before auto-hide; 0 = sticky
   * @returns {{ hide: () => void }} handle to dismiss this specific toast
   *
   * @example
   * MyIOToast.show('Failed to save changes', 'error', 5000);
   */
  function show(message, type = 'info', duration = 3500) {
    ensureContainer();

    const validTypes = ['info', 'success', 'warning', 'error'];
    if (!validTypes.includes(type)) {
      console.warn(`[MyIOToast] Invalid type "${type}". Using "info" instead.`);
      type = 'info';
    }

    const toastEl = document.createElement('div');
    toastEl.className = `myio-toast ${type}`;

    // Messages over TOAST_MAX_MESSAGE_LENGTH are truncated with "…" and get a
    // "+" button that opens the full text in the shared InfoTooltip panel.
    const fullMessage = message == null ? '' : String(message);
    const isLong = fullMessage.length > TOAST_MAX_MESSAGE_LENGTH;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'myio-toast-msg';
    msgSpan.textContent = isLong
      ? fullMessage.slice(0, TOAST_MAX_MESSAGE_LENGTH).trimEnd() + '…'
      : fullMessage;
    if (isLong) msgSpan.title = 'Mensagem truncada — clique em + para ver tudo';
    toastEl.appendChild(msgSpan);

    let toastTimeout = null;
    const doHide = () => {
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = null;
      removeToast(toastEl);
    };

    if (isLong) {
      const meta = TOAST_TYPE_META[type] || TOAST_TYPE_META.info;
      const expandBtn = document.createElement('button');
      expandBtn.type = 'button';
      expandBtn.className = 'myio-toast-expand';
      expandBtn.textContent = '+';
      expandBtn.setAttribute('aria-label', 'Ver mensagem completa');
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Keep this toast on screen while the user reads the full message
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = null;
        InfoTooltip.show(expandBtn, {
          icon: meta.icon,
          title: meta.title,
          content: escapeHtml(fullMessage).replace(/\n/g, '<br>'),
        });
      });
      toastEl.appendChild(expandBtn);
    }

    toastContainer.appendChild(toastEl);

    // Cap the stack: drop the oldest toasts beyond MAX_TOASTS.
    while (toastContainer.children.length > MAX_TOASTS) {
      removeToast(toastContainer.firstElementChild);
    }

    // Force browser reflow so the slide-in animation always plays.
    setTimeout(() => toastEl.classList.add('show'), 10);

    if (duration > 0) {
      toastTimeout = setTimeout(doHide, duration);
    }

    return { hide: doHide };
  }

  /**
   * Dismiss ALL toasts currently on screen.
   *
   * @example
   * MyIOToast.hide();
   */
  function hide() {
    if (toastContainer) {
      Array.from(toastContainer.children).forEach(removeToast);
    }
  }

  /**
   * Show an info toast (alias)
   * @param {string} message - The message to display
   * @param {number} [duration=3500] - Duration in milliseconds
   * @returns {object} Toast instance with hide() method
   */
  function info(message, duration = 3500) {
    return show(message, 'info', duration);
  }

  /**
   * Show a success toast (alias)
   * @param {string} message - The message to display
   * @param {number} [duration=3500] - Duration in milliseconds
   * @returns {object} Toast instance with hide() method
   */
  function success(message, duration = 3500) {
    return show(message, 'success', duration);
  }

  /**
   * Show a warning toast (alias)
   * @param {string} message - The message to display
   * @param {number} [duration=3500] - Duration in milliseconds
   * @returns {object} Toast instance with hide() method
   */
  function warning(message, duration = 3500) {
    return show(message, 'warning', duration);
  }

  /**
   * Show an error toast (alias)
   * @param {string} message - The message to display
   * @param {number} [duration=5000] - Duration in milliseconds (longer for errors)
   * @returns {object} Toast instance with hide() method
   */
  function error(message, duration = 5000) {
    return show(message, 'error', duration);
  }

  // Initialize the container when the DOM is ready
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureContainer);
    } else {
      ensureContainer();
    }
  }

  // Public API
  return {
    show,
    hide,
    info,
    success,
    warning,
    error,
  };
})();

// Export for ES modules
export { MyIOToast };

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MyIOToast };
}
