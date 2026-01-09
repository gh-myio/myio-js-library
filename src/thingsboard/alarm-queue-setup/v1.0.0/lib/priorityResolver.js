/**
 * RFC-0135: Telegram Notification Queue - Priority Resolver
 *
 * Resolves message priority using cascade:
 * 1. Customer device override (highest priority)
 * 2. Customer device profile rule
 * 3. Global fallback (default: 3 - Medium)
 *
 * Implements module-level caching (RFC-0126) to avoid repeated API calls.
 *
 * @module priorityResolver
 */

import { Priority } from './storageAdapter.js';
import { logPriorityResolution, logConfigLoad, logError, QueueLogger } from './logger.js';

// Module-level cache for priority rules (RFC-0126 pattern)
let _priorityRulesCache = new Map();
let _cacheTimestamps = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Customer configuration schema for priority rules
 * @typedef {Object} CustomerQueueConfig
 * @property {boolean} enabled - Whether queue is enabled for customer
 * @property {Object} priorityRules - Priority rules
 * @property {Object} priorityRules.deviceProfiles - Device profile → priority mapping
 * @property {Object} priorityRules.deviceOverrides - Device UUID → priority mapping
 * @property {number} [priorityRules.globalDefault] - Global default priority
 * @property {Object} rateControl - Rate control settings
 * @property {number} rateControl.batchSize - Messages per batch
 * @property {number} rateControl.delayBetweenBatchesSeconds - Delay between batches
 * @property {number} rateControl.maxRetries - Max retry attempts
 * @property {string} rateControl.retryBackoff - 'exponential' or 'linear'
 * @property {Object} telegram - Telegram configuration
 * @property {string} telegram.botToken - Bot token
 * @property {string} telegram.chatId - Chat ID
 */

/**
 * Resolve priority for a device
 * Uses cascade: device override → device profile → global default
 *
 * @param {Object} config - Configuration
 * @param {string} config.baseUrl - ThingsBoard base URL
 * @param {Object} config.serviceAccount - Service account credentials
 * @param {string} config.authToken - Current auth token (optional, for non-service account calls)
 * @param {string} customerId - Customer UUID
 * @param {string} deviceId - Device UUID
 * @param {string} deviceProfile - Device profile name
 * @returns {Promise<number>} Priority (1-4)
 *
 * @example
 * const priority = await resolvePriority(
 *   { baseUrl: 'https://tb.example.com', serviceAccount: {...} },
 *   'customer-id',
 *   'device-id',
 *   '3F_MEDIDOR'
 * );
 */
export async function resolvePriority(config, customerId, deviceId, deviceProfile) {
  try {
    // Fetch customer priority rules (cached)
    const rules = await fetchCustomerPriorityRules(config, customerId);

    let priority = null;
    let source = null;

    // 1. Check device override
    if (rules?.priorityRules?.deviceOverrides?.[deviceId]) {
      priority = rules.priorityRules.deviceOverrides[deviceId];
      source = 'deviceOverride';
    }
    // 2. Check device profile rule
    else if (rules?.priorityRules?.deviceProfiles?.[deviceProfile]) {
      priority = rules.priorityRules.deviceProfiles[deviceProfile];
      source = 'deviceProfile';
    }
    // 3. Check customer global default
    else if (rules?.priorityRules?.globalDefault) {
      priority = rules.priorityRules.globalDefault;
      source = 'customerGlobal';
    }
    // 4. Use system global fallback
    else {
      priority = getGlobalFallbackPriority();
      source = 'systemGlobal';
    }

    // Validate priority range
    if (priority < 1 || priority > 4) {
      QueueLogger.warn(`Invalid priority ${priority} for device ${deviceId}, using Medium (3)`);
      priority = Priority.MEDIUM;
      source = 'systemGlobal';
    }

    // Log resolution
    logPriorityResolution(deviceId, deviceProfile, priority, source);

    return priority;
  } catch (error) {
    logError('resolvePriority', error, { customerId, deviceId, deviceProfile });
    // On error, return safe default
    return getGlobalFallbackPriority();
  }
}

/**
 * Fetch customer priority rules from ThingsBoard attributes
 * Uses module-level cache with TTL
 *
 * @param {Object} config - Configuration
 * @param {string} config.baseUrl - ThingsBoard base URL
 * @param {string} config.authToken - Auth token
 * @param {string} customerId - Customer UUID
 * @returns {Promise<CustomerQueueConfig|null>} Customer queue configuration or null
 *
 * @example
 * const rules = await fetchCustomerPriorityRules(config, 'customer-id');
 * const priority = rules.priorityRules.deviceProfiles['3F_MEDIDOR'];
 */
export async function fetchCustomerPriorityRules(config, customerId) {
  try {
    // Check cache
    const cached = getCachedRules(customerId);
    if (cached !== null) {
      return cached;
    }

    // Fetch from ThingsBoard
    const baseUrl = config.baseUrl || '';
    const authToken = config.authToken || localStorage.getItem('jwt_token');

    const url = `${baseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=telegram_queue_config`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${authToken}`
      }
    });

    if (response.status === 404) {
      // No configuration found, cache null
      setCachedRules(customerId, null);
      logConfigLoad(customerId, false);
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch customer config: HTTP ${response.status}`);
    }

    const data = await response.json();
    const configJson = data.telegram_queue_config;

    if (!configJson) {
      setCachedRules(customerId, null);
      logConfigLoad(customerId, false);
      return null;
    }

    // Parse configuration
    const customerConfig = JSON.parse(configJson);

    // Validate structure
    if (!customerConfig.priorityRules) {
      QueueLogger.warn(`Invalid config structure for customer ${customerId}, using defaults`);
      setCachedRules(customerId, null);
      return null;
    }

    // Cache and return
    setCachedRules(customerId, customerConfig);
    logConfigLoad(customerId, true, customerConfig.enabled);

    return customerConfig;
  } catch (error) {
    logError('fetchCustomerPriorityRules', error, { customerId });
    // On error, return null (will use global defaults)
    return null;
  }
}

/**
 * Get default priority for device profile
 * Based on device profile name patterns
 *
 * @param {string} deviceProfile - Device profile name
 * @returns {number} Default priority (1-4)
 *
 * @example
 * const priority = getDeviceProfileDefaultPriority('ENTRADA'); // Returns 1 (Critical)
 * const priority = getDeviceProfileDefaultPriority('3F_MEDIDOR'); // Returns 2 (High)
 */
export function getDeviceProfileDefaultPriority(deviceProfile) {
  const profile = (deviceProfile || '').toUpperCase();

  // Critical priority for entrada/infrastructure devices
  if (profile.includes('ENTRADA') || profile.includes('RELOGIO') ||
      profile.includes('TRAFO') || profile.includes('SUBESTACAO')) {
    return Priority.CRITICAL;
  }

  // High priority for meters and hydrometers
  if (profile.includes('3F_MEDIDOR') || profile.includes('HIDROMETRO')) {
    return Priority.HIGH;
  }

  // Low priority for thermostats
  if (profile.includes('TERMOSTATO')) {
    return Priority.LOW;
  }

  // Medium priority for everything else
  return Priority.MEDIUM;
}

/**
 * Get global fallback priority
 * Used when no customer configuration exists
 *
 * @returns {number} Global default priority (3 - Medium)
 */
export function getGlobalFallbackPriority() {
  return Priority.MEDIUM;
}

/**
 * Invalidate cache for a customer
 * Useful when configuration is updated
 *
 * @param {string} customerId - Customer UUID
 *
 * @example
 * invalidateCache('customer-id'); // Forces next fetch to reload from API
 */
export function invalidateCache(customerId) {
  _priorityRulesCache.delete(customerId);
  _cacheTimestamps.delete(customerId);
  QueueLogger.log(`Cache invalidated for customer ${customerId}`);
}

/**
 * Clear all cached priority rules
 * Useful for testing or manual cache refresh
 */
export function clearAllCache() {
  const count = _priorityRulesCache.size;
  _priorityRulesCache.clear();
  _cacheTimestamps.clear();
  QueueLogger.log(`Cleared ${count} cached priority rules`);
}

/**
 * Get cached rules for customer if still valid
 * @private
 */
function getCachedRules(customerId) {
  if (!_priorityRulesCache.has(customerId)) {
    return null;
  }

  const timestamp = _cacheTimestamps.get(customerId);
  const now = Date.now();

  // Check if cache expired
  if (now - timestamp > CACHE_TTL_MS) {
    _priorityRulesCache.delete(customerId);
    _cacheTimestamps.delete(customerId);
    return null;
  }

  return _priorityRulesCache.get(customerId);
}

/**
 * Set cached rules for customer
 * @private
 */
function setCachedRules(customerId, rules) {
  _priorityRulesCache.set(customerId, rules);
  _cacheTimestamps.set(customerId, Date.now());
}

/**
 * Get cache statistics
 * Useful for monitoring and debugging
 *
 * @returns {Object} Cache stats
 * @returns {number} stats.size - Number of cached entries
 * @returns {number} stats.ttlMs - Cache TTL in milliseconds
 * @returns {Array<string>} stats.customerIds - List of cached customer IDs
 */
export function getCacheStats() {
  return {
    size: _priorityRulesCache.size,
    ttlMs: CACHE_TTL_MS,
    customerIds: Array.from(_priorityRulesCache.keys())
  };
}

/**
 * Build default customer queue configuration
 * Useful for creating initial configuration
 *
 * @param {Object} [overrides] - Override default values
 * @returns {CustomerQueueConfig} Default configuration
 *
 * @example
 * const config = buildDefaultCustomerConfig({
 *   telegram: { botToken: 'xxx', chatId: '-123' }
 * });
 */
export function buildDefaultCustomerConfig(overrides = {}) {
  const defaults = {
    enabled: true,
    priorityRules: {
      deviceProfiles: {
        '3F_MEDIDOR': Priority.HIGH,
        'HIDROMETRO': Priority.HIGH,
        'ENTRADA': Priority.CRITICAL,
        'TERMOSTATO': Priority.LOW
      },
      deviceOverrides: {},
      globalDefault: Priority.MEDIUM
    },
    rateControl: {
      batchSize: 5,
      delayBetweenBatchesSeconds: 60,
      maxRetries: 3,
      retryBackoff: 'exponential'
    },
    telegram: {
      botToken: '',
      chatId: ''
    }
  };

  // Deep merge overrides
  return mergeDeep(defaults, overrides);
}

/**
 * Validate customer queue configuration
 * Checks for required fields and valid values
 *
 * @param {CustomerQueueConfig} config - Configuration to validate
 * @returns {Object} Validation result
 * @returns {boolean} result.valid - Whether config is valid
 * @returns {Array<string>} result.errors - Array of validation errors
 *
 * @example
 * const result = validateCustomerConfig(config);
 * if (!result.valid) {
 *   console.error('Invalid config:', result.errors);
 * }
 */
export function validateCustomerConfig(config) {
  const errors = [];

  if (!config) {
    errors.push('Configuration is null or undefined');
    return { valid: false, errors };
  }

  // Check enabled flag
  if (typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  // Check priorityRules
  if (!config.priorityRules) {
    errors.push('priorityRules is required');
  } else {
    if (!config.priorityRules.deviceProfiles || typeof config.priorityRules.deviceProfiles !== 'object') {
      errors.push('priorityRules.deviceProfiles must be an object');
    }

    if (!config.priorityRules.deviceOverrides || typeof config.priorityRules.deviceOverrides !== 'object') {
      errors.push('priorityRules.deviceOverrides must be an object');
    }
  }

  // Check rateControl
  if (!config.rateControl) {
    errors.push('rateControl is required');
  } else {
    if (typeof config.rateControl.batchSize !== 'number' || config.rateControl.batchSize <= 0) {
      errors.push('rateControl.batchSize must be a positive number');
    }

    if (typeof config.rateControl.delayBetweenBatchesSeconds !== 'number' || config.rateControl.delayBetweenBatchesSeconds < 0) {
      errors.push('rateControl.delayBetweenBatchesSeconds must be a non-negative number');
    }

    if (typeof config.rateControl.maxRetries !== 'number' || config.rateControl.maxRetries < 0) {
      errors.push('rateControl.maxRetries must be a non-negative number');
    }

    if (!['exponential', 'linear'].includes(config.rateControl.retryBackoff)) {
      errors.push('rateControl.retryBackoff must be "exponential" or "linear"');
    }
  }

  // Check telegram
  if (!config.telegram) {
    errors.push('telegram configuration is required');
  } else {
    if (!config.telegram.botToken || typeof config.telegram.botToken !== 'string') {
      errors.push('telegram.botToken is required and must be a string');
    }

    if (!config.telegram.chatId || typeof config.telegram.chatId !== 'string') {
      errors.push('telegram.chatId is required and must be a string');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Deep merge two objects
 * @private
 */
function mergeDeep(target, source) {
  const output = { ...target };

  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      output[key] = mergeDeep(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }

  return output;
}
