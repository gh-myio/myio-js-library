/**
 * RFC-0135: Telegram Notification Queue - Rate Limiter
 *
 * Provides rate limiting and batch control for message dispatch.
 * Enforces:
 * - Batch size limits
 * - Delay between batches
 * - Retry backoff (exponential/linear)
 *
 * Uses storage adapter to persist rate limit state.
 *
 * @module rateLimiter
 */

import { logRateLimit, logError, QueueLogger } from './logger.js';

/**
 * Check if dispatcher can send next batch for customer
 * Checks if enough time has passed since last dispatch
 *
 * @param {Object} config - Configuration
 * @param {Object} config.storage - Storage adapter instance
 * @param {Object} config.rateControl - Rate control settings
 * @param {number} config.rateControl.delayBetweenBatchesSeconds - Delay between batches
 * @param {string} customerId - Customer UUID
 * @returns {Promise<boolean>} True if can send batch, false if must wait
 *
 * @example
 * if (await canSendBatch(config, 'customer-id')) {
 *   // Proceed with dispatch
 * } else {
 *   const waitTime = await getWaitTime(config, 'customer-id');
 *   console.log(`Must wait ${waitTime}ms`);
 * }
 */
export async function canSendBatch(config, customerId) {
  try {
    const { storage, rateControl } = config;

    if (!storage) {
      throw new Error('Storage adapter is required');
    }

    if (!rateControl || typeof rateControl.delayBetweenBatchesSeconds !== 'number') {
      throw new Error('rateControl.delayBetweenBatchesSeconds is required');
    }

    // Get rate limit state from storage
    const state = await storage.getRateLimitState(customerId);

    if (!state || !state.lastDispatchAt || state.lastDispatchAt === 0) {
      // No previous dispatch, can send
      return true;
    }

    const now = Date.now();
    const delayMs = rateControl.delayBetweenBatchesSeconds * 1000;
    const timeSinceLastDispatch = now - state.lastDispatchAt;

    return timeSinceLastDispatch >= delayMs;
  } catch (error) {
    logError('canSendBatch', error, { customerId });
    // On error, allow dispatch (fail open)
    return true;
  }
}

/**
 * Calculate wait time before next batch can be sent
 * Returns 0 if can send immediately
 *
 * @param {Object} config - Configuration
 * @param {Object} config.storage - Storage adapter instance
 * @param {Object} config.rateControl - Rate control settings
 * @param {number} config.rateControl.delayBetweenBatchesSeconds - Delay between batches
 * @param {string} customerId - Customer UUID
 * @returns {Promise<number>} Wait time in milliseconds (0 if can send now)
 *
 * @example
 * const waitMs = await getWaitTime(config, 'customer-id');
 * if (waitMs > 0) {
 *   console.log(`Wait ${Math.ceil(waitMs / 1000)} seconds`);
 * }
 */
export async function getWaitTime(config, customerId) {
  try {
    const { storage, rateControl } = config;

    if (!storage) {
      throw new Error('Storage adapter is required');
    }

    if (!rateControl || typeof rateControl.delayBetweenBatchesSeconds !== 'number') {
      throw new Error('rateControl.delayBetweenBatchesSeconds is required');
    }

    // Get rate limit state from storage
    const state = await storage.getRateLimitState(customerId);

    if (!state || !state.lastDispatchAt || state.lastDispatchAt === 0) {
      return 0; // Can send immediately
    }

    const now = Date.now();
    const delayMs = rateControl.delayBetweenBatchesSeconds * 1000;
    const timeSinceLastDispatch = now - state.lastDispatchAt;
    const waitTime = delayMs - timeSinceLastDispatch;

    return Math.max(0, waitTime);
  } catch (error) {
    logError('getWaitTime', error, { customerId });
    return 0; // On error, return 0 (fail open)
  }
}

/**
 * Record batch dispatch timestamp
 * Updates rate limit state in storage
 *
 * @param {Object} config - Configuration
 * @param {Object} config.storage - Storage adapter instance
 * @param {string} customerId - Customer UUID
 * @param {number} batchSize - Number of messages in batch
 * @returns {Promise<void>}
 *
 * @example
 * // After sending batch
 * await recordBatchDispatch(config, 'customer-id', 5);
 */
export async function recordBatchDispatch(config, customerId, batchSize) {
  try {
    const { storage } = config;

    if (!storage) {
      throw new Error('Storage adapter is required');
    }

    const now = Date.now();

    // Get current state
    const currentState = await storage.getRateLimitState(customerId);

    // Update state
    const newState = {
      lastDispatchAt: now,
      batchCount: (currentState.batchCount || 0) + 1
    };

    await storage.updateRateLimitState(customerId, newState);

    QueueLogger.log(`Recorded batch dispatch for customer ${customerId}: ${batchSize} messages`);
  } catch (error) {
    logError('recordBatchDispatch', error, { customerId, batchSize });
    // Don't throw - recording failure shouldn't block dispatch
  }
}

/**
 * Calculate retry delay with backoff strategy
 * Supports exponential and linear backoff
 *
 * @param {number} retryCount - Current retry attempt (0-based)
 * @param {string} backoffStrategy - 'exponential' or 'linear'
 * @param {number} baseDelaySeconds - Base delay in seconds
 * @returns {number} Delay in milliseconds
 *
 * @example
 * // Exponential backoff
 * const delay1 = calculateRetryDelay(0, 'exponential', 10); // 10000ms (10s)
 * const delay2 = calculateRetryDelay(1, 'exponential', 10); // 20000ms (20s)
 * const delay3 = calculateRetryDelay(2, 'exponential', 10); // 40000ms (40s)
 *
 * @example
 * // Linear backoff
 * const delay1 = calculateRetryDelay(0, 'linear', 10); // 10000ms (10s)
 * const delay2 = calculateRetryDelay(1, 'linear', 10); // 20000ms (20s)
 * const delay3 = calculateRetryDelay(2, 'linear', 10); // 30000ms (30s)
 */
export function calculateRetryDelay(retryCount, backoffStrategy, baseDelaySeconds) {
  if (retryCount < 0) {
    retryCount = 0;
  }

  if (baseDelaySeconds <= 0) {
    baseDelaySeconds = 10; // Default 10 seconds
  }

  const baseDelayMs = baseDelaySeconds * 1000;

  if (backoffStrategy === 'exponential') {
    // Exponential: delay * 2^retryCount
    return baseDelayMs * Math.pow(2, retryCount);
  } else if (backoffStrategy === 'linear') {
    // Linear: delay * (retryCount + 1)
    return baseDelayMs * (retryCount + 1);
  } else {
    // Unknown strategy, use linear
    QueueLogger.warn(`Unknown backoff strategy: ${backoffStrategy}, using linear`);
    return baseDelayMs * (retryCount + 1);
  }
}

/**
 * Check if message should be retried based on last attempt time and retry delay
 *
 * @param {Object} entry - Queue entry
 * @param {number} entry.lastAttemptAt - Last attempt timestamp
 * @param {number} entry.retryCount - Current retry count
 * @param {Object} rateControl - Rate control settings
 * @param {string} rateControl.retryBackoff - Backoff strategy
 * @param {number} [rateControl.retryBaseDelaySeconds=10] - Base delay for retries
 * @returns {boolean} True if enough time has passed, false if should wait
 *
 * @example
 * if (shouldRetryNow(entry, rateControl)) {
 *   // Retry the message
 * } else {
 *   // Wait longer
 * }
 */
export function shouldRetryNow(entry, rateControl) {
  if (!entry.lastAttemptAt) {
    return true; // No previous attempt, can retry
  }

  const backoffStrategy = rateControl.retryBackoff || 'exponential';
  const baseDelaySeconds = rateControl.retryBaseDelaySeconds || 10;

  const requiredDelay = calculateRetryDelay(entry.retryCount, backoffStrategy, baseDelaySeconds);
  const timeSinceLastAttempt = Date.now() - entry.lastAttemptAt;

  return timeSinceLastAttempt >= requiredDelay;
}

/**
 * Get next retry time for a queue entry
 * Returns timestamp when entry should be retried
 *
 * @param {Object} entry - Queue entry
 * @param {number} entry.lastAttemptAt - Last attempt timestamp
 * @param {number} entry.retryCount - Current retry count
 * @param {Object} rateControl - Rate control settings
 * @param {string} rateControl.retryBackoff - Backoff strategy
 * @param {number} [rateControl.retryBaseDelaySeconds=10] - Base delay for retries
 * @returns {number} Timestamp when entry should be retried
 *
 * @example
 * const nextRetryTime = getNextRetryTime(entry, rateControl);
 * const nextRetryDate = new Date(nextRetryTime);
 * console.log(`Retry at: ${nextRetryDate.toISOString()}`);
 */
export function getNextRetryTime(entry, rateControl) {
  if (!entry.lastAttemptAt) {
    return Date.now(); // Can retry immediately
  }

  const backoffStrategy = rateControl.retryBackoff || 'exponential';
  const baseDelaySeconds = rateControl.retryBaseDelaySeconds || 10;

  const delay = calculateRetryDelay(entry.retryCount, backoffStrategy, baseDelaySeconds);

  return entry.lastAttemptAt + delay;
}

/**
 * Calculate rate limit statistics for monitoring
 *
 * @param {Object} config - Configuration
 * @param {Object} config.storage - Storage adapter instance
 * @param {string} customerId - Customer UUID
 * @returns {Promise<Object>} Rate limit statistics
 * @returns {number} stats.lastDispatchAt - Last dispatch timestamp
 * @returns {number} stats.batchCount - Number of batches sent
 * @returns {number} stats.timeSinceLastDispatchSeconds - Time since last dispatch
 * @returns {boolean} stats.canSendNow - Whether can send batch now
 * @returns {number} stats.waitTimeSeconds - Wait time if cannot send now
 *
 * @example
 * const stats = await getRateLimitStats(config, 'customer-id');
 * console.log(`Last dispatch: ${new Date(stats.lastDispatchAt).toISOString()}`);
 * console.log(`Can send now: ${stats.canSendNow}`);
 */
export async function getRateLimitStats(config, customerId) {
  try {
    const { storage, rateControl } = config;

    if (!storage) {
      throw new Error('Storage adapter is required');
    }

    const state = await storage.getRateLimitState(customerId);
    const now = Date.now();

    const timeSinceLastDispatch = state.lastDispatchAt
      ? now - state.lastDispatchAt
      : 0;

    const canSend = await canSendBatch(config, customerId);
    const waitTime = await getWaitTime(config, customerId);

    return {
      lastDispatchAt: state.lastDispatchAt || 0,
      batchCount: state.batchCount || 0,
      timeSinceLastDispatchSeconds: Math.floor(timeSinceLastDispatch / 1000),
      canSendNow: canSend,
      waitTimeSeconds: Math.ceil(waitTime / 1000)
    };
  } catch (error) {
    logError('getRateLimitStats', error, { customerId });
    throw error;
  }
}

/**
 * Reset rate limit state for customer
 * Useful for testing or manual intervention
 *
 * @param {Object} config - Configuration
 * @param {Object} config.storage - Storage adapter instance
 * @param {string} customerId - Customer UUID
 * @returns {Promise<void>}
 *
 * @example
 * await resetRateLimitState(config, 'customer-id');
 * // Customer can now send immediately
 */
export async function resetRateLimitState(config, customerId) {
  try {
    const { storage } = config;

    if (!storage) {
      throw new Error('Storage adapter is required');
    }

    await storage.updateRateLimitState(customerId, {
      lastDispatchAt: 0,
      batchCount: 0
    });

    QueueLogger.log(`Reset rate limit state for customer ${customerId}`);
  } catch (error) {
    logError('resetRateLimitState', error, { customerId });
    throw error;
  }
}

/**
 * Apply rate limit check and log if rate limited
 * Convenience function combining check and logging
 *
 * @param {Object} config - Configuration
 * @param {string} customerId - Customer UUID
 * @returns {Promise<boolean>} True if can send, false if rate limited
 *
 * @example
 * if (await applyRateLimit(config, 'customer-id')) {
 *   // Dispatch batch
 * } else {
 *   // Wait for next cycle
 * }
 */
export async function applyRateLimit(config, customerId) {
  const canSend = await canSendBatch(config, customerId);

  if (!canSend) {
    const waitTime = await getWaitTime(config, customerId);
    const waitSeconds = Math.ceil(waitTime / 1000);
    logRateLimit(customerId, waitSeconds);
  }

  return canSend;
}
