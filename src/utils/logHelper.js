/**
 * LogHelper utility - shared across all widgets
 *
 * Usage:
 *   import { createLogHelper } from '../utils/logHelper.js';
 *   const DEBUG_ACTIVE = true;
 *   const LogHelper = createLogHelper(DEBUG_ACTIVE);
 *
 *   LogHelper.log('[Component] message');   // Only logs if DEBUG_ACTIVE is true
 *   LogHelper.warn('[Component] warning');  // Only logs if DEBUG_ACTIVE is true
 *   LogHelper.error('[Component] error');   // Always logs (errors are critical)
 */

/**
 * Creates a LogHelper instance with the given debug flag
 * @param {boolean} debugActive - Whether debug logging is enabled
 * @returns {Object} LogHelper instance with log, warn, error methods
 */
export function createLogHelper(debugActive = false) {
  return {
    log: function (...args) {
      if (debugActive) {
        console.log(...args);
      }
    },
    warn: function (...args) {
      if (debugActive) {
        console.warn(...args);
      }
    },
    error: function (...args) {
      // Errors always logged regardless of debugActive
      console.error(...args);
    },
  };
}

/**
 * Default LogHelper instance (debug disabled by default)
 * For production use where debug should be off
 */
export const LogHelper = createLogHelper(false);
