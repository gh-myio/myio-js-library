/**
 * RFC-0135: Telegram Notification Queue - Main Exports
 *
 * Central export file for the Telegram notification queue system.
 * Provides all modules and functions needed for queue operations.
 *
 * @module telegram-queue
 */

// Core operations
export {
  normalizePayload,
  enqueue,
  dequeue,
  updateStatus,
  getQueueStats,
  getQueueEntry,
  cleanupOldEntries,
  shouldRetry,
  buildErrorMessage,
  QueueStatus,
  Priority
} from './v1.0.0/lib/queueCore.js';

// Priority resolution
export {
  resolvePriority,
  fetchCustomerPriorityRules,
  getDeviceProfileDefaultPriority,
  getGlobalFallbackPriority,
  invalidateCache as invalidatePriorityCache,
  clearAllCache as clearAllPriorityCache,
  getCacheStats as getPriorityCacheStats,
  buildDefaultCustomerConfig,
  validateCustomerConfig
} from './v1.0.0/lib/priorityResolver.js';

// Rate limiting
export {
  canSendBatch,
  getWaitTime,
  recordBatchDispatch,
  calculateRetryDelay,
  shouldRetryNow,
  getNextRetryTime,
  getRateLimitStats,
  resetRateLimitState,
  applyRateLimit
} from './v1.0.0/lib/rateLimiter.js';

// Storage
export {
  QueueStorageAdapter,
  createStorageAdapter,
  validateQueueEntry
} from './v1.0.0/lib/storageAdapter.js';

export { ThingsboardStorageAdapter } from './v1.0.0/storage/thingsboardStorage.js';

// Telegram client
export {
  sendMessage,
  validateConfig as validateTelegramConfig,
  formatTelegramError,
  maskToken,
  isRetryableError,
  getRetryAfter,
  buildChatLink,
  escapeHtml,
  truncateMessage
} from './v1.0.0/lib/telegramClient.js';

// Rule Chain functions
export {
  enqueueFunction,
  enqueueFunctionStandalone
} from './v1.0.0/functions/enqueueFunction.js';

export {
  dispatchFunction,
  dispatchFunctionStandalone
} from './v1.0.0/functions/dispatchFunction.js';

export {
  monitorFunction,
  monitorFunctionStandalone
} from './v1.0.0/functions/monitorFunction.js';

// Logger
export {
  QueueLogger,
  logEnqueue,
  logDispatch,
  logError,
  logRateLimit,
  logPriorityResolution,
  logBatchStart,
  logBatchComplete,
  logStorage,
  logConfigLoad,
  logStats,
  logTelegramApi,
  logCleanup,
  logInitialization
} from './v1.0.0/lib/logger.js';

/**
 * Quick start helper - creates and initializes a queue instance
 *
 * @param {Object} config - Configuration
 * @param {string} config.baseUrl - ThingsBoard base URL
 * @param {string} config.customerId - Customer UUID
 * @param {Object} [config.serviceAccount] - Service account credentials
 * @param {string} [config.serviceAccount.username] - Username
 * @param {string} [config.serviceAccount.password] - Password
 * @returns {Promise<Object>} Initialized queue instance
 * @returns {Function} instance.enqueue - Enqueue function
 * @returns {Function} instance.dequeue - Dequeue function
 * @returns {Function} instance.getStats - Get stats function
 * @returns {Object} instance.storage - Storage adapter
 *
 * @example
 * import { createQueue } from 'myio-js-library';
 *
 * const queue = await createQueue({
 *   baseUrl: 'https://tb.example.com',
 *   customerId: 'customer-uuid',
 *   serviceAccount: { username: 'xxx', password: 'yyy' }
 * });
 *
 * const queueId = await queue.enqueue(normalizedPayload);
 * const batch = await queue.dequeue(5);
 * const stats = await queue.getStats();
 */
export async function createQueue(config) {
  const { ThingsboardStorageAdapter } = await import('./v1.0.0/storage/thingsboardStorage.js');
  const { enqueue, dequeue, getQueueStats } = await import('./v1.0.0/lib/queueCore.js');

  // Create and initialize storage
  const storage = new ThingsboardStorageAdapter(config);
  await storage.initialize(config);

  // Return queue instance
  return {
    enqueue: (payload) => enqueue({ storage }, payload),
    dequeue: (batchSize) => dequeue({ storage }, batchSize),
    getStats: (customerId) => getQueueStats({ storage }, customerId),
    storage
  };
}

/**
 * Version information
 */
export const VERSION = '1.0.0';
export const RFC = 'RFC-0135';
