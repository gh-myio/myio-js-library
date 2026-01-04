/**
 * LogHelper utility - shared across all widgets
 * RFC-0122: Enhanced with contextual logging support
 *
 * @example Basic usage (backward compatible)
 *   import { createLogHelper } from '../utils/logHelper.js';
 *   const LogHelper = createLogHelper(true);
 *   LogHelper.log('message');
 *
 * @example With context configuration (flexible key/value)
 *   const LogHelper = createLogHelper({
 *     debugActive: true,
 *     config: { widget: 'MAIN', module: 'auth' },
 *   });
 *   LogHelper.log('Starting...');
 *   // Output: [WIDGET: MAIN][MODULE: auth] Starting...
 *
 * @example Dynamic context updates
 *   LogHelper.setConfig({ function: 'fetchData', step: '1' });
 *   LogHelper.log('Fetching...');
 *   // Output: [WIDGET: MAIN][MODULE: auth][FUNCTION: fetchData][STEP: 1] Fetching...
 *
 *   LogHelper.clearConfig(['function', 'step']);
 *   LogHelper.log('Done');
 *   // Output: [WIDGET: MAIN][MODULE: auth] Done
 */

/**
 * @typedef {Object.<string, string>} LogConfig
 * Flexible key-value pairs for context. Any key can be used.
 * Keys will be uppercased in the output prefix.
 *
 * @example
 *   { widget: 'MAIN', function: 'init', domain: 'energy' }
 *   { component: 'Header', action: 'render', customerId: '123' }
 */

/**
 * @typedef {Object} LogHelperOptions
 * @property {boolean} [debugActive=false] - Whether debug logging is active
 * @property {LogConfig} [config={}] - Initial context configuration (any key/value pairs)
 */

/**
 * @typedef {Object} LogHelperInstance
 * @property {function(...any): void} log - Log message (respects debugActive)
 * @property {function(...any): void} warn - Log warning (respects debugActive)
 * @property {function(...any): void} error - Log error (always logs)
 * @property {function(LogConfig): void} setConfig - Add/update context key-value pairs
 * @property {function(string[]): void} clearConfig - Remove specific config keys
 * @property {function(): void} resetConfig - Reset to initial configuration
 * @property {function(boolean): void} setDebugActive - Set debug active state
 * @property {function(): boolean} isDebugActive - Get current debug active state
 * @property {function(): LogConfig} getConfig - Get current configuration
 */

/**
 * Default prefix formatter
 * Converts config to [KEY: value] format with uppercase keys
 * @param {LogConfig} config
 * @returns {string}
 */
function defaultFormatPrefix(config) {
  const entries = Object.entries(config).filter(([_, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return '';

  return (
    entries.map(([key, value]) => `[${key.toUpperCase()}: ${value}]`).join('') + ' '
  );
}

/**
 * Creates a LogHelper instance with optional context configuration
 *
 * @param {boolean|LogHelperOptions} optionsOrDebugActive - Options object or debug flag (backward compatible)
 * @returns {LogHelperInstance} LogHelper instance
 *
 * @example Backward compatible (boolean)
 *   const LogHelper = createLogHelper(true);
 *
 * @example With flexible config
 *   const LogHelper = createLogHelper({
 *     debugActive: true,
 *     config: { widget: 'HEADER', domain: 'energy', customKey: 'value' },
 *   });
 */
export function createLogHelper(optionsOrDebugActive = false) {
  // Backward compatibility: accept boolean
  let options = {};
  if (typeof optionsOrDebugActive === 'boolean') {
    options = { debugActive: optionsOrDebugActive };
  } else if (typeof optionsOrDebugActive === 'object' && optionsOrDebugActive !== null) {
    options = optionsOrDebugActive;
  }

  const {
    debugActive: initialDebugActive = false,
    config: initialConfig = {},
    formatPrefix = defaultFormatPrefix,
  } = options;

  let currentConfig = { ...initialConfig };
  let debugActive = initialDebugActive;

  /**
   * Build prefix from current config
   */
  function getPrefix() {
    return formatPrefix(currentConfig);
  }

  return {
    log(...args) {
      if (debugActive) {
        const prefix = getPrefix();
        if (prefix) {
          console.log(prefix, ...args);
        } else {
          console.log(...args);
        }
      }
    },

    warn(...args) {
      if (debugActive) {
        const prefix = getPrefix();
        if (prefix) {
          console.warn(prefix, ...args);
        } else {
          console.warn(...args);
        }
      }
    },

    error(...args) {
      // Errors always logged regardless of debugActive
      const prefix = getPrefix();
      if (prefix) {
        console.error(prefix, ...args);
      } else {
        console.error(...args);
      }
    },

    setConfig(config) {
      currentConfig = { ...currentConfig, ...config };
    },

    clearConfig(keys) {
      if (Array.isArray(keys)) {
        keys.forEach((key) => {
          delete currentConfig[key];
        });
      }
    },

    resetConfig() {
      currentConfig = { ...initialConfig };
    },

    setDebugActive(active) {
      debugActive = !!active;
    },

    isDebugActive() {
      return debugActive;
    },

    getConfig() {
      return { ...currentConfig };
    },
  };
}

/**
 * Default LogHelper instance (debug disabled by default)
 * For production use where debug should be off
 */
export const LogHelper = createLogHelper(false);
