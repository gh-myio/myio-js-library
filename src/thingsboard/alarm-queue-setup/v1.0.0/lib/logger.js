/**
 * RFC-0135: Telegram Notification Queue - Logger Module
 *
 * Provides contextual logging for queue operations using LogHelper (RFC-0122).
 * Standardizes log prefixes and provides structured logging helpers.
 *
 * @module logger
 */

import { createLogHelper } from '../../../../utils/logHelper.js';

/**
 * Queue-specific LogHelper instance
 * Configured with module context for all queue operations
 */
export const QueueLogger = createLogHelper({
  debugActive: true, // Enable debug logging for queue operations
  config: {
    module: 'TelegramQueue',
    version: 'v1.0.0'
  }
});

/**
 * Log enqueue operation
 * @param {string} queueId - Queue entry ID
 * @param {string} customerId - Customer UUID
 * @param {string} deviceId - Device UUID
 * @param {number} priority - Priority level (1-4)
 */
export function logEnqueue(queueId, customerId, deviceId, priority) {
  QueueLogger.setConfig({ operation: 'enqueue', queueId });
  QueueLogger.log(
    `Enqueued message - Customer: ${customerId}, Device: ${deviceId}, Priority: ${priority}`
  );
  QueueLogger.clearConfig(['operation', 'queueId']);
}

/**
 * Log dispatch operation
 * @param {string} queueId - Queue entry ID
 * @param {string} status - Final status (SENT, FAILED, RETRY)
 * @param {number} httpStatus - HTTP status code from Telegram API
 * @param {string} [errorMessage] - Error message if failed
 */
export function logDispatch(queueId, status, httpStatus, errorMessage = null) {
  QueueLogger.setConfig({ operation: 'dispatch', queueId });

  if (status === 'SENT') {
    QueueLogger.log(`Dispatched successfully - HTTP ${httpStatus}`);
  } else if (status === 'RETRY') {
    QueueLogger.warn(`Dispatch failed, will retry - HTTP ${httpStatus}: ${errorMessage || 'Unknown error'}`);
  } else if (status === 'FAILED') {
    QueueLogger.error(`Dispatch failed permanently - HTTP ${httpStatus}: ${errorMessage || 'Unknown error'}`);
  }

  QueueLogger.clearConfig(['operation', 'queueId']);
}

/**
 * Log error with context
 * @param {string} operation - Operation name (e.g., 'enqueue', 'dispatch', 'dequeue')
 * @param {Error} error - Error object
 * @param {Object} [context] - Additional context
 */
export function logError(operation, error, context = {}) {
  QueueLogger.setConfig({ operation, ...context });
  QueueLogger.error(`Error in ${operation}:`, error.message, error.stack || '');
  QueueLogger.clearConfig([' operation', ...Object.keys(context)]);
}

/**
 * Log rate limit hit
 * @param {string} customerId - Customer UUID
 * @param {number} waitTimeSeconds - Wait time in seconds before next batch
 */
export function logRateLimit(customerId, waitTimeSeconds) {
  QueueLogger.setConfig({ operation: 'rateLimit', customerId });
  QueueLogger.warn(`Rate limited - Must wait ${Math.ceil(waitTimeSeconds)}s before next batch`);
  QueueLogger.clearConfig(['operation', 'customerId']);
}

/**
 * Log priority resolution
 * @param {string} deviceId - Device UUID
 * @param {string} deviceProfile - Device profile name
 * @param {number} priority - Resolved priority
 * @param {string} source - Resolution source ('deviceOverride', 'deviceProfile', 'global')
 */
export function logPriorityResolution(deviceId, deviceProfile, priority, source) {
  QueueLogger.setConfig({ operation: 'priorityResolve' });
  QueueLogger.log(
    `Priority ${priority} for device ${deviceId} (${deviceProfile}) - Source: ${source}`
  );
  QueueLogger.clearConfig(['operation']);
}

/**
 * Log batch processing start
 * @param {number} batchSize - Number of messages in batch
 * @param {string} customerId - Customer UUID
 */
export function logBatchStart(batchSize, customerId) {
  QueueLogger.setConfig({ operation: 'batch', customerId });
  QueueLogger.log(`Starting batch processing - ${batchSize} messages`);
  QueueLogger.clearConfig(['operation', 'customerId']);
}

/**
 * Log batch processing completion
 * @param {number} sent - Number successfully sent
 * @param {number} failed - Number permanently failed
 * @param {number} retry - Number queued for retry
 * @param {string} customerId - Customer UUID
 */
export function logBatchComplete(sent, failed, retry, customerId) {
  QueueLogger.setConfig({ operation: 'batch', customerId });
  QueueLogger.log(`Batch complete - Sent: ${sent}, Failed: ${failed}, Retry: ${retry}`);
  QueueLogger.clearConfig(['operation', 'customerId']);
}

/**
 * Log storage operation
 * @param {string} operation - Storage operation ('save', 'fetch', 'update', 'delete')
 * @param {number} [count] - Number of entries affected
 * @param {number} [durationMs] - Operation duration in milliseconds
 */
export function logStorage(operation, count = null, durationMs = null) {
  QueueLogger.setConfig({ operation: 'storage' });

  let message = `Storage ${operation}`;
  if (count !== null) message += ` - ${count} entries`;
  if (durationMs !== null) message += ` (${durationMs}ms)`;

  QueueLogger.log(message);
  QueueLogger.clearConfig(['operation']);
}

/**
 * Log configuration load
 * @param {string} customerId - Customer UUID
 * @param {boolean} found - Whether configuration was found
 * @param {boolean} [enabled] - Whether queue is enabled
 */
export function logConfigLoad(customerId, found, enabled = null) {
  QueueLogger.setConfig({ operation: 'config', customerId });

  if (!found) {
    QueueLogger.warn('Customer configuration not found - using defaults');
  } else if (enabled === false) {
    QueueLogger.log('Queue disabled for customer');
  } else {
    QueueLogger.log('Customer configuration loaded');
  }

  QueueLogger.clearConfig(['operation', 'customerId']);
}

/**
 * Log queue statistics
 * @param {Object} stats - Queue statistics
 * @param {Object} stats.queueDepth - Queue depth by priority
 * @param {number} stats.pendingCount - Total pending messages
 * @param {number} stats.failedCount - Total failed messages
 */
export function logStats(stats) {
  QueueLogger.setConfig({ operation: 'stats' });
  QueueLogger.log(
    `Queue stats - Pending: ${stats.pendingCount}, Failed: ${stats.failedCount}, ` +
    `By priority: [1:${stats.queueDepth[1] || 0}, 2:${stats.queueDepth[2] || 0}, ` +
    `3:${stats.queueDepth[3] || 0}, 4:${stats.queueDepth[4] || 0}]`
  );
  QueueLogger.clearConfig(['operation']);
}

/**
 * Log Telegram API call
 * @param {string} method - API method (e.g., 'sendMessage')
 * @param {number} httpStatus - HTTP status code
 * @param {boolean} success - Whether call was successful
 */
export function logTelegramApi(method, httpStatus, success) {
  QueueLogger.setConfig({ operation: 'telegram' });

  if (success) {
    QueueLogger.log(`Telegram API ${method} - HTTP ${httpStatus} OK`);
  } else {
    QueueLogger.warn(`Telegram API ${method} - HTTP ${httpStatus} FAILED`);
  }

  QueueLogger.clearConfig(['operation']);
}

/**
 * Log cleanup operation
 * @param {number} deleted - Number of entries deleted
 * @param {number} cutoffTimestamp - Cutoff timestamp used
 */
export function logCleanup(deleted, cutoffTimestamp) {
  QueueLogger.setConfig({ operation: 'cleanup' });
  const cutoffDate = new Date(cutoffTimestamp).toISOString();
  QueueLogger.log(`Cleanup complete - Deleted ${deleted} entries older than ${cutoffDate}`);
  QueueLogger.clearConfig(['operation']);
}

/**
 * Log initialization
 * @param {string} storageType - Storage adapter type (e.g., 'thingsboard', 'postgresql')
 * @param {boolean} success - Whether initialization was successful
 */
export function logInitialization(storageType, success) {
  QueueLogger.setConfig({ operation: 'init' });

  if (success) {
    QueueLogger.log(`Initialized with ${storageType} storage`);
  } else {
    QueueLogger.error(`Failed to initialize ${storageType} storage`);
  }

  QueueLogger.clearConfig(['operation']);
}
