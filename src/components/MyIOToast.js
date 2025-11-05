// src/components/MyIOToast.js
/**
 * MyIO Global Toast Manager
 *
 * A lightweight, globally accessible toast notification system for MyIO applications.
 *
 * Features:
 * - Singleton pattern: Only one toast container in the DOM
 * - Multiple toast types: info, success, warning, error
 * - Automatic dismissal with customizable duration
 * - Smooth animations
 * - No external dependencies
 *
 * Usage:
 * ```javascript
 * import { MyIOToast } from 'myio-js-library';
 *
 * // Show a simple warning toast
 * MyIOToast.show('Operation completed');
 *
 * // Show an error toast
 * MyIOToast.show('Failed to load data', 'error');
 *
 * // Show toast with custom duration (5 seconds)
 * MyIOToast.show('Processing...', 'info', 5000);
 *
 * // Hide toast immediately
 * MyIOToast.hide();
 * ```
 *
 * @module MyIOToast
 */

const MyIOToast = (function() {
  let toastContainer = null;
  let toastTimeout = null;

  // CSS for toast styling
  const TOAST_CSS = `
    #myio-global-toast-container {
      position: fixed;
      top: 25px;
      right: 25px;
      z-index: 99999;
      min-width: 320px;
      max-width: 480px;
      padding: 16px 20px;
      background-color: #323232;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      border-radius: 8px;
      transform: translateX(400px);
      transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
      opacity: 0;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      border-left: 5px solid transparent;
      display: flex;
      align-items: center;
      word-wrap: break-word;
      pointer-events: auto;
    }

    #myio-global-toast-container.show {
      transform: translateX(0);
      opacity: 1;
    }

    #myio-global-toast-container.info {
      background-color: #2196f3;
      border-color: #1976d2;
    }

    #myio-global-toast-container.success {
      background-color: #4caf50;
      border-color: #388e3c;
    }

    #myio-global-toast-container.warning {
      background-color: #ff9800;
      border-color: #f57c00;
    }

    #myio-global-toast-container.error {
      background-color: #d32f2f;
      border-color: #b71c1c;
    }

    #myio-global-toast-container::before {
      content: 'ℹ️';
      margin-right: 12px;
      font-size: 20px;
      flex-shrink: 0;
    }

    #myio-global-toast-container.success::before {
      content: '✅';
    }

    #myio-global-toast-container.warning::before {
      content: '⚠️';
    }

    #myio-global-toast-container.error::before {
      content: '🚫';
    }

    @media (max-width: 480px) {
      #myio-global-toast-container {
        top: 10px;
        right: 10px;
        left: 10px;
        min-width: auto;
        max-width: none;
      }
    }
  `;

  /**
   * Create toast element in DOM (runs only once)
   * @private
   */
  function createToastElement() {
    if (document.getElementById('myio-global-toast-container')) {
      toastContainer = document.getElementById('myio-global-toast-container');
      return;
    }

    // Inject CSS into <head>
    if (!document.getElementById('myio-global-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'myio-global-toast-styles';
      style.textContent = TOAST_CSS;
      document.head.appendChild(style);
    }

    // Create HTML element and append to <body>
    toastContainer = document.createElement('div');
    toastContainer.id = 'myio-global-toast-container';
    document.body.appendChild(toastContainer);
  }

  /**
   * Show a toast notification
   *
   * @param {string} message - The message to display
   * @param {string} [type='info'] - Toast type: 'info', 'success', 'warning', or 'error'
   * @param {number} [duration=3500] - Duration in milliseconds before auto-hide
   * @returns {object} Toast instance with hide() method
   *
   * @example
   * // Simple info toast
   * MyIOToast.show('Processing your request...');
   *
   * @example
   * // Error toast with custom duration
   * MyIOToast.show('Failed to save changes', 'error', 5000);
   *
   * @example
   * // Manual control
   * const toast = MyIOToast.show('Loading...', 'info');
   * // Later...
   * toast.hide();
   */
  function show(message, type = 'info', duration = 3500) {
    if (!toastContainer) {
      createToastElement();
    }

    // Clear any existing timeout
    clearTimeout(toastTimeout);

    // Validate type
    const validTypes = ['info', 'success', 'warning', 'error'];
    if (!validTypes.includes(type)) {
      console.warn(`[MyIOToast] Invalid type "${type}". Using "info" instead.`);
      type = 'info';
    }

    // Set message and type
    toastContainer.textContent = message;
    toastContainer.className = ''; // Reset classes
    toastContainer.classList.add(type);

    // Force browser reflow to ensure animation always works
    setTimeout(() => {
      toastContainer.classList.add('show');
    }, 10);

    // Auto-hide after duration
    if (duration > 0) {
      toastTimeout = setTimeout(() => {
        hide();
      }, duration);
    }

    // Return object with hide method for manual control
    return {
      hide: hide
    };
  }

  /**
   * Hide the toast immediately
   *
   * @example
   * MyIOToast.hide();
   */
  function hide() {
    if (toastContainer) {
      toastContainer.classList.remove('show');
      clearTimeout(toastTimeout);
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

  // Initialize toast element when DOM is ready
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createToastElement);
    } else {
      createToastElement();
    }
  }

  // Public API
  return {
    show,
    hide,
    info,
    success,
    warning,
    error
  };
})();

// Export for ES modules
export { MyIOToast };

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MyIOToast };
}
