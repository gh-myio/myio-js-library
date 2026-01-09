/**
 * RFC-0135: Telegram Notification Queue - Core Operations
 *
 * Core queue operations: enqueue, dequeue, status management.
 * Uses storage adapter for persistence.
 *
 * @module queueCore
 */

import { QueueStatus, Priority } from './storageAdapter.js';
import { logEnqueue, logError } from './logger.js';

/**
 * Generate UUID v4
 * @returns {string} UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normalize payload from Rule Chain Transformation Node
 *
 * @param {Object} msg - Raw message from Rule Chain
 * @param {Object} msg.msg - Message content
 * @param {string} msg.msg.text - Telegram message text
 * @param {Object} msg.metadata - Metadata
 * @param {string} msg.metadata.deviceType - Device type/profile
 * @param {string} msg.metadata.deviceName - Device name
 * @param {string} msg.metadata.ts - Timestamp (string)
 * @param {string} [msg.metadata.deviceId] - Device UUID (optional)
 * @param {string} [msg.metadata.customerId] - Customer UUID (optional)
 * @param {string} msg.msgType - Message type
 * @param {Object} context - ThingsBoard context (optional, for extracting IDs)
 * @param {string} [context.customerId] - Customer ID from context
 * @param {string} [context.deviceId] - Device ID from context
 * @returns {Object} Normalized queue entry (without priority - to be resolved separately)
 *
 * @example
 * const normalized = normalizePayload({
 *   msg: { text: "Alert message" },
 *   metadata: { deviceType: "3F_MEDIDOR", deviceName: "Device 1", ts: "1767878649180" },
 *   msgType: "POST_TELEMETRY_REQUEST"
 * }, { customerId: "customer-uuid", deviceId: "device-uuid" });
 */
export function normalizePayload(msg, context = {}) {
  try {
    // Extract fields from message
    const text = msg?.msg?.text || '';
    const deviceType = msg?.metadata?.deviceType || 'unknown';
    const deviceName = msg?.metadata?.deviceName || 'unknown';
    const ts = msg?.metadata?.ts || Date.now().toString();

    // Extract IDs from metadata or context
    const deviceId = msg?.metadata?.deviceId || context?.deviceId || 'unknown';
    const customerId = msg?.metadata?.customerId || context?.customerId || 'unknown';

    // Parse timestamp
    const createdAt = parseInt(ts, 10) || Date.now();

    // Generate queue ID
    const queueId = generateUUID();

    return {
      queueId,
      customerId,
      deviceId,
      deviceProfile: deviceType,
      payload: {
        text,
        originalDeviceName: deviceName
      },
      status: QueueStatus.PENDING,
      retryCount: 0,
      maxRetries: 3, // Default, can be overridden by customer config
      createdAt,
      lastAttemptAt: null,
      sentAt: null,
      httpStatus: null,
      errorMessage: null,
      responseBody: null
    };
  } catch (error) {
    logError('normalizePayload', error, { msg });
    throw new Error(`Failed to normalize payload: ${error.message}`);
  }
}

/**
 * Enqueue a notification message
 *
 * @param {Object} config - Queue configuration
 * @param {Object} config.storage - Storage adapter instance
 * @param {Object} normalizedPayload - Normalized queue entry (from normalizePayload)
 * @param {number} normalizedPayload.priority - Priority level (1-4) - must be set before calling enqueue
 * @returns {Promise<string>} Queue ID
 *
 * @example
 * const queueId = await enqueue(
 *   { storage: storageAdapter },
 *   { ...normalizedPayload, priority: 1 }
 * );
 */
export async function enqueue(config, normalizedPayload) {
  try {
    const { storage } = config;

    if (!storage) {
      throw new Error('Storage adapter is required');
    }

    if (!normalizedPayload.priority) {
      throw new Error('Priority must be set before enqueue');
    }

    // Save to storage
    const queueId = await storage.save(normalizedPayload);

    // Log enqueue operation
    logEnqueue(
      queueId,
      normalizedPayload.customerId,
      normalizedPayload.deviceId,
      normalizedPayload.priority
    );

    return queueId;
  } catch (error) {
    logError('enqueue', error, { payload: normalizedPayload });
    throw error;
  }
}

/**
 * Dequeue next batch of messages by priority
 * Fetches messages ordered by priority (1→2→3→4) then by createdAt (oldest first)
 *
 * @param {Object} config - Queue configuration
 * @param {Object} config.storage - Storage adapter instance
 * @param {number} batchSize - Number of messages to fetch
 * @param {Array<number>} [priorities] - Priority filter (default: [1, 2, 3, 4])
 * @returns {Promise<Array<Object>>} Array of queue entries
 *
 * @example
 * const batch = await dequeue({ storage: storageAdapter }, 5);
 * // Returns up to 5 PENDING messages, prioritized
 */
export async function dequeue(config, batchSize, priorities = [1, 2, 3, 4]) {
  try {
    const { storage } = config;

    if (!storage) {
      throw new Error('Storage adapter is required');
    }

    if (!batchSize || batchSize <= 0) {
      throw new Error('Batch size must be positive');
    }

    // Fetch PENDING entries by priority
    const entries = await storage.fetchByStatusAndPriority(
      QueueStatus.PENDING,
      batchSize,
      priorities
    );

    // Also include RETRY entries (these should be retried)
    if (entries.length < batchSize) {
      const retryEntries = await storage.fetchByStatusAndPriority(
        QueueStatus.RETRY,
        batchSize - entries.length,
        priorities
      );
      entries.push(...retryEntries);
    }

    return entries;
  } catch (error) {
    logError('dequeue', error, { batchSize, priorities });
    throw error;
  }
}

/**
 * Update queue entry status and result data
 *
 * @param {Object} config - Queue configuration
 * @param {Object} config.storage - Storage adapter instance
 * @param {string} queueId - Queue entry ID
 * @param {string} status - New status (SENDING, SENT, FAILED, RETRY)
 * @param {Object} result - Result data
 * @param {number} [result.httpStatus] - HTTP status code from Telegram API
 * @param {string} [result.responseBody] - Response body from Telegram API
 * @param {string} [result.errorMessage] - Error message if failed
 * @param {number} [result.retryCount] - Updated retry count
 * @param {number} [result.sentAt] - Sent timestamp
 * @returns {Promise<void>}
 *
 * @example
 * await updateStatus(
 *   { storage: storageAdapter },
 *   'queue-id',
 *   'SENT',
 *   { httpStatus: 200, sentAt: Date.now() }
 * );
 */
export async function updateStatus(config, queueId, status, result = {}) {
  try {
    const { storage } = config;

    if (!storage) {
      throw new Error('Storage adapter is required');
    }

    if (!Object.values(QueueStatus).includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    // Build updates object
    const updates = {
      status,
      lastAttemptAt: Date.now()
    };

    // Add result data
    if (result.httpStatus !== undefined) {
      updates.httpStatus = result.httpStatus;
    }

    if (result.responseBody !== undefined) {
      updates.responseBody = result.responseBody;
    }

    if (result.errorMessage !== undefined) {
      updates.errorMessage = result.errorMessage;
    }

    if (result.retryCount !== undefined) {
      updates.retryCount = result.retryCount;
    }

    if (result.sentAt !== undefined) {
      updates.sentAt = result.sentAt;
    }

    // Update in storage
    await storage.updateEntry(queueId, updates);
  } catch (error) {
    logError('updateStatus', error, { queueId, status });
    throw error;
  }
}

/**
 * Get queue statistics
 *
 * @param {Object} config - Queue configuration
 * @param {Object} config.storage - Storage adapter instance
 * @param {string} [customerId] - Optional customer ID to filter stats
 * @returns {Promise<Object>} Queue statistics
 * @returns {Object} stats.queueDepth - Queue depth by priority { 1: count, 2: count, 3: count, 4: count }
 * @returns {number} stats.pendingCount - Total pending messages
 * @returns {number} stats.failedCount - Total failed messages
 * @returns {number} stats.retryCount - Total messages pending retry
 * @returns {number} stats.sentCount - Total sent messages (recent)
 * @returns {number} stats.averageDispatchDelaySeconds - Average time from enqueue to send
 *
 * @example
 * const stats = await getQueueStats({ storage: storageAdapter });
 * console.log(`Pending: ${stats.pendingCount}, Failed: ${stats.failedCount}`);
 */
export async function getQueueStats(config, customerId = null) {
  try {
    const { storage } = config;

    if (!storage) {
      throw new Error('Storage adapter is required');
    }

    const stats = await storage.getStats(customerId);
    return stats;
  } catch (error) {
    logError('getQueueStats', error, { customerId });
    throw error;
  }
}

/**
 * Get single queue entry by ID
 *
 * @param {Object} config - Queue configuration
 * @param {Object} config.storage - Storage adapter instance
 * @param {string} queueId - Queue entry ID
 * @returns {Promise<Object|null>} Queue entry or null if not found
 *
 * @example
 * const entry = await getQueueEntry({ storage: storageAdapter }, 'queue-id');
 * if (entry) {
 *   console.log(`Status: ${entry.status}, Priority: ${entry.priority}`);
 * }
 */
export async function getQueueEntry(config, queueId) {
  try {
    const { storage } = config;

    if (!storage) {
      throw new Error('Storage adapter is required');
    }

    const entry = await storage.getEntry(queueId);
    return entry;
  } catch (error) {
    logError('getQueueEntry', error, { queueId });
    throw error;
  }
}

/**
 * Cleanup old queue entries (TTL enforcement)
 * Deletes entries older than specified days
 *
 * @param {Object} config - Queue configuration
 * @param {Object} config.storage - Storage adapter instance
 * @param {number} [daysOld=30] - Number of days to retain
 * @param {string} [customerId] - Optional customer ID to limit cleanup scope
 * @returns {Promise<number>} Number of deleted entries
 *
 * @example
 * const deleted = await cleanupOldEntries({ storage: storageAdapter }, 30);
 * console.log(`Deleted ${deleted} old entries`);
 */
export async function cleanupOldEntries(config, daysOld = 30, customerId = null) {
  try {
    const { storage } = config;

    if (!storage) {
      throw new Error('Storage adapter is required');
    }

    const cutoffTimestamp = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const deletedCount = await storage.deleteOlderThan(cutoffTimestamp, customerId);

    return deletedCount;
  } catch (error) {
    logError('cleanupOldEntries', error, { daysOld, customerId });
    throw error;
  }
}

/**
 * Determine if entry should be retried based on retry count and max retries
 *
 * @param {Object} entry - Queue entry
 * @param {number} entry.retryCount - Current retry count
 * @param {number} entry.maxRetries - Maximum retry attempts
 * @returns {boolean} True if should retry, false if should fail permanently
 *
 * @example
 * if (shouldRetry(entry)) {
 *   await updateStatus(config, entry.queueId, 'RETRY', { retryCount: entry.retryCount + 1 });
 * } else {
 *   await updateStatus(config, entry.queueId, 'FAILED');
 * }
 */
export function shouldRetry(entry) {
  return entry.retryCount < entry.maxRetries;
}

/**
 * Build error message for queue operation
 *
 * @param {string} operation - Operation name
 * @param {Error} error - Error object
 * @param {Object} [context] - Additional context
 * @returns {string} Formatted error message
 */
export function buildErrorMessage(operation, error, context = {}) {
  const contextStr = Object.entries(context)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');

  return `${operation} failed${contextStr ? ` (${contextStr})` : ''}: ${error.message}`;
}

// Export constants for convenience
export { QueueStatus, Priority };
