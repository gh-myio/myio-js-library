/**
 * RFC-0135: Telegram Notification Queue - Storage Adapter Interface
 *
 * Provides unified interface for queue storage operations.
 * Supports multiple backends (ThingsBoard Attributes, PostgreSQL, Redis).
 *
 * @module storageAdapter
 */

/**
 * Abstract base class for queue storage adapters
 * All storage implementations must extend this class and implement all methods
 */
export class QueueStorageAdapter {
  /**
   * Initialize storage connection
   * @param {Object} config - Storage configuration
   * @param {string} config.type - Storage type ('thingsboard', 'postgresql', 'redis')
   * @param {Object} config.thingsboard - ThingsBoard configuration (if applicable)
   * @param {string} config.thingsboard.baseUrl - ThingsBoard API base URL
   * @param {Object} config.thingsboard.serviceAccount - Service account credentials
   * @param {string} config.thingsboard.serviceAccount.username - Service account username
   * @param {string} config.thingsboard.serviceAccount.password - Service account password
   * @returns {Promise<void>}
   */
  async initialize(config) {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Save queue entry to storage
   * @param {Object} entry - Queue entry object
   * @param {string} entry.queueId - Unique queue entry ID (UUID)
   * @param {string} entry.customerId - Customer UUID
   * @param {string} entry.deviceId - Device UUID
   * @param {string} entry.deviceProfile - Device profile name
   * @param {number} entry.priority - Priority level (1-4)
   * @param {Object} entry.payload - Message payload
   * @param {string} entry.payload.text - Telegram message text
   * @param {string} entry.status - Entry status (PENDING, SENDING, SENT, FAILED, RETRY)
   * @param {number} entry.retryCount - Current retry count
   * @param {number} entry.maxRetries - Maximum retry attempts
   * @param {number} entry.createdAt - Creation timestamp (milliseconds)
   * @param {number} [entry.lastAttemptAt] - Last attempt timestamp
   * @param {number} [entry.sentAt] - Sent timestamp
   * @param {number} [entry.httpStatus] - HTTP status code from Telegram API
   * @param {string} [entry.errorMessage] - Error message if failed
   * @param {string} [entry.responseBody] - Response body from Telegram API
   * @returns {Promise<string>} Queue ID
   */
  async save(entry) {
    throw new Error('save() must be implemented by subclass');
  }

  /**
   * Fetch queue entries by status and priority
   * @param {string} status - Entry status to fetch (PENDING, SENDING, FAILED, RETRY)
   * @param {number} limit - Maximum number of entries to fetch
   * @param {Array<number>} [priorities] - Priority filter (e.g., [1, 2, 3, 4]). If provided, fetches in priority order (lowest number first)
   * @returns {Promise<Array<Object>>} Array of queue entries sorted by priority then createdAt (oldest first)
   */
  async fetchByStatusAndPriority(status, limit, priorities = [1, 2, 3, 4]) {
    throw new Error('fetchByStatusAndPriority() must be implemented by subclass');
  }

  /**
   * Update queue entry fields
   * @param {string} queueId - Queue entry ID
   * @param {Object} updates - Fields to update
   * @param {string} [updates.status] - New status
   * @param {number} [updates.retryCount] - Updated retry count
   * @param {number} [updates.lastAttemptAt] - Last attempt timestamp
   * @param {number} [updates.sentAt] - Sent timestamp
   * @param {number} [updates.httpStatus] - HTTP status code
   * @param {string} [updates.errorMessage] - Error message
   * @param {string} [updates.responseBody] - Response body
   * @returns {Promise<void>}
   */
  async updateEntry(queueId, updates) {
    throw new Error('updateEntry() must be implemented by subclass');
  }

  /**
   * Get queue statistics
   * @param {string} [customerId] - Optional customer ID to filter stats
   * @returns {Promise<Object>} Statistics object
   * @returns {Object} stats.queueDepth - Queue depth by priority { 1: count, 2: count, 3: count, 4: count }
   * @returns {number} stats.pendingCount - Total pending messages
   * @returns {number} stats.failedCount - Total failed messages
   * @returns {number} stats.retryCount - Total messages pending retry
   * @returns {number} stats.sentCount - Total sent messages (recent, e.g., last 24h)
   * @returns {number} stats.averageDispatchDelaySeconds - Average time from enqueue to send
   */
  async getStats(customerId = null) {
    throw new Error('getStats() must be implemented by subclass');
  }

  /**
   * Delete entries older than specified timestamp
   * Used for cleanup/TTL enforcement
   * @param {number} timestampMs - Cutoff timestamp in milliseconds
   * @param {string} [customerId] - Optional customer ID to limit cleanup scope
   * @returns {Promise<number>} Number of deleted entries
   */
  async deleteOlderThan(timestampMs, customerId = null) {
    throw new Error('deleteOlderThan() must be implemented by subclass');
  }

  /**
   * Get rate limit state for a customer
   * @param {string} customerId - Customer UUID
   * @returns {Promise<Object>} Rate limit state
   * @returns {number} state.lastDispatchAt - Last dispatch timestamp (milliseconds)
   * @returns {number} state.batchCount - Number of batches sent in current window
   * @returns {number} state.updatedAt - State update timestamp
   */
  async getRateLimitState(customerId) {
    throw new Error('getRateLimitState() must be implemented by subclass');
  }

  /**
   * Update rate limit state for a customer
   * @param {string} customerId - Customer UUID
   * @param {Object} state - Rate limit state
   * @param {number} state.lastDispatchAt - Last dispatch timestamp (milliseconds)
   * @param {number} [state.batchCount] - Number of batches sent in current window
   * @returns {Promise<void>}
   */
  async updateRateLimitState(customerId, state) {
    throw new Error('updateRateLimitState() must be implemented by subclass');
  }

  /**
   * Get a single queue entry by ID
   * @param {string} queueId - Queue entry ID
   * @returns {Promise<Object|null>} Queue entry or null if not found
   */
  async getEntry(queueId) {
    throw new Error('getEntry() must be implemented by subclass');
  }

  /**
   * Close storage connection and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() must be implemented by subclass');
  }
}

/**
 * Factory function to create storage adapter instance
 * @param {Object} config - Storage configuration
 * @param {string} config.type - Storage type ('thingsboard', 'postgresql', 'redis')
 * @returns {QueueStorageAdapter} Storage adapter instance
 * @throws {Error} If storage type is unknown
 */
export function createStorageAdapter(config) {
  const type = config.type || 'thingsboard';

  switch (type.toLowerCase()) {
    case 'thingsboard':
      // Dynamic import to avoid circular dependencies
      // Import is handled at runtime when factory is called
      throw new Error('ThingsBoard storage adapter must be imported and created directly. Use: import { ThingsboardStorageAdapter } from "./storage/thingsboardStorage.js"');

    case 'postgresql':
      throw new Error('PostgreSQL storage adapter not yet implemented. Use ThingsBoard storage for now.');

    case 'redis':
      throw new Error('Redis storage adapter not yet implemented. Use ThingsBoard storage for now.');

    default:
      throw new Error(`Unknown storage type: ${type}. Supported types: thingsboard, postgresql, redis`);
  }
}

/**
 * Validate queue entry object
 * @param {Object} entry - Queue entry to validate
 * @returns {Object} Validation result
 * @returns {boolean} result.valid - Whether entry is valid
 * @returns {Array<string>} result.errors - Array of validation error messages
 */
export function validateQueueEntry(entry) {
  const errors = [];

  if (!entry) {
    errors.push('Entry is null or undefined');
    return { valid: false, errors };
  }

  // Required fields
  if (!entry.queueId || typeof entry.queueId !== 'string') {
    errors.push('queueId is required and must be a string');
  }

  if (!entry.customerId || typeof entry.customerId !== 'string') {
    errors.push('customerId is required and must be a string');
  }

  if (!entry.deviceId || typeof entry.deviceId !== 'string') {
    errors.push('deviceId is required and must be a string');
  }

  if (!entry.deviceProfile || typeof entry.deviceProfile !== 'string') {
    errors.push('deviceProfile is required and must be a string');
  }

  if (typeof entry.priority !== 'number' || entry.priority < 1 || entry.priority > 4) {
    errors.push('priority is required and must be a number between 1 and 4');
  }

  if (!entry.payload || typeof entry.payload !== 'object') {
    errors.push('payload is required and must be an object');
  } else if (!entry.payload.text || typeof entry.payload.text !== 'string') {
    errors.push('payload.text is required and must be a string');
  }

  const validStatuses = ['PENDING', 'SENDING', 'SENT', 'FAILED', 'RETRY'];
  if (!entry.status || !validStatuses.includes(entry.status)) {
    errors.push(`status is required and must be one of: ${validStatuses.join(', ')}`);
  }

  if (typeof entry.retryCount !== 'number' || entry.retryCount < 0) {
    errors.push('retryCount is required and must be a non-negative number');
  }

  if (typeof entry.createdAt !== 'number' || entry.createdAt <= 0) {
    errors.push('createdAt is required and must be a positive number (timestamp in milliseconds)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Status constants for queue entries
 */
export const QueueStatus = {
  PENDING: 'PENDING',
  SENDING: 'SENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  RETRY: 'RETRY'
};

/**
 * Priority constants
 */
export const Priority = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4
};
