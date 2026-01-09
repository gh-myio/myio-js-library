/**
 * RFC-0135: Telegram Notification Queue - ThingsBoard Storage Implementation
 *
 * Implements QueueStorageAdapter using ThingsBoard SERVER_SCOPE attributes.
 * Uses AuthBypass pattern for service account operations.
 *
 * Attribute Naming Convention:
 * - telegram_queue_entry_{queueId} - Individual queue entries (JSON)
 * - telegram_queue_index_priority_{1-4} - Arrays of queueIds by priority
 * - telegram_queue_stats - Statistics object
 * - telegram_queue_ratelimit_{customerId} - Rate limit state per customer
 *
 * @module thingsboardStorage
 */

import { QueueStorageAdapter, validateQueueEntry } from '../lib/storageAdapter.js';
import { QueueLogger, logStorage, logError, logInitialization } from '../lib/logger.js';

/**
 * ThingsBoard Storage Adapter
 * Uses SERVER_SCOPE customer attributes for queue storage
 */
export class ThingsboardStorageAdapter extends QueueStorageAdapter {
  constructor(config) {
    super();
    this.config = config || {};
    this.baseUrl = this.config.baseUrl || '';
    this.serviceAccount = this.config.serviceAccount || {
      username: 'telegram-queue-service@myio.com.br',
      password: ''
    };
    this.customerId = this.config.customerId || null;
    this.initialized = false;

    // Auth state
    this.originalToken = null;
    this.originalRefreshToken = null;
    this.serviceToken = null;
  }

  /**
   * Initialize storage
   * Validates configuration and tests authentication
   */
  async initialize(config) {
    try {
      if (config) {
        this.config = { ...this.config, ...config };
        if (config.baseUrl) this.baseUrl = config.baseUrl;
        if (config.serviceAccount) this.serviceAccount = config.serviceAccount;
        if (config.customerId) this.customerId = config.customerId;
      }

      // Validate required configuration
      if (!this.customerId) {
        throw new Error('customerId is required for ThingsBoard storage');
      }

      if (!this.serviceAccount.username || !this.serviceAccount.password) {
        throw new Error('Service account credentials are required');
      }

      // Test authentication
      await this.withServiceAuth(async () => {
        // Simple test: try to fetch customer attributes
        const url = `${this.baseUrl}/api/plugins/telemetry/CUSTOMER/${this.customerId}/values/attributes/SERVER_SCOPE`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
          }
        });

        if (!response.ok && response.status !== 404) {
          throw new Error(`Failed to access customer attributes: HTTP ${response.status}`);
        }
      });

      this.initialized = true;
      logInitialization('thingsboard', true);
    } catch (error) {
      logInitialization('thingsboard', false);
      logError('initialize', error);
      throw error;
    }
  }

  /**
   * Save queue entry
   * Saves entry as individual attribute and updates priority index
   */
  async save(entry) {
    const startTime = Date.now();

    try {
      // Validate entry
      const validation = validateQueueEntry(entry);
      if (!validation.valid) {
        throw new Error(`Invalid queue entry: ${validation.errors.join(', ')}`);
      }

      await this.withServiceAuth(async () => {
        // Save entry as attribute
        const entryKey = `telegram_queue_entry_${entry.queueId}`;
        const indexKey = `telegram_queue_index_priority_${entry.priority}`;

        // Fetch current priority index
        const currentIndex = await this.getAttribute(indexKey) || [];

        // Add queue ID to index if not already present and status is PENDING
        if (entry.status === 'PENDING' && !currentIndex.includes(entry.queueId)) {
          currentIndex.push(entry.queueId);
        }

        // Batch update: entry + index
        const attributes = {
          [entryKey]: JSON.stringify(entry),
          [indexKey]: JSON.stringify(currentIndex)
        };

        await this.setAttributes(attributes);
      });

      const duration = Date.now() - startTime;
      logStorage('save', 1, duration);

      return entry.queueId;
    } catch (error) {
      logError('save', error, { queueId: entry.queueId });
      throw error;
    }
  }

  /**
   * Fetch entries by status and priority
   * Returns entries ordered by priority (1→2→3→4) then by createdAt (oldest first)
   */
  async fetchByStatusAndPriority(status, limit, priorities = [1, 2, 3, 4]) {
    const startTime = Date.now();

    try {
      const entries = [];

      await this.withServiceAuth(async () => {
        // Fetch from each priority level in order
        for (const priority of priorities.sort()) {
          if (entries.length >= limit) break;

          const indexKey = `telegram_queue_index_priority_${priority}`;
          const queueIds = await this.getAttribute(indexKey) || [];

          // Fetch entries for these queue IDs
          for (const queueId of queueIds) {
            if (entries.length >= limit) break;

            const entryKey = `telegram_queue_entry_${queueId}`;
            const entryJson = await this.getAttribute(entryKey);

            if (entryJson) {
              try {
                const entry = JSON.parse(entryJson);

                // Filter by status
                if (entry.status === status) {
                  entries.push(entry);
                }
              } catch (parseError) {
                QueueLogger.warn(`Failed to parse entry ${queueId}:`, parseError);
              }
            }
          }
        }

        // Sort by createdAt (oldest first) within same priority
        entries.sort((a, b) => a.createdAt - b.createdAt);
      });

      const duration = Date.now() - startTime;
      logStorage('fetch', entries.length, duration);

      return entries.slice(0, limit);
    } catch (error) {
      logError('fetchByStatusAndPriority', error, { status, limit });
      throw error;
    }
  }

  /**
   * Update queue entry
   * Updates entry and manages priority indexes if status changes
   */
  async updateEntry(queueId, updates) {
    const startTime = Date.now();

    try {
      await this.withServiceAuth(async () => {
        const entryKey = `telegram_queue_entry_${queueId}`;

        // Fetch current entry
        const entryJson = await this.getAttribute(entryKey);
        if (!entryJson) {
          throw new Error(`Entry not found: ${queueId}`);
        }

        const entry = JSON.parse(entryJson);
        const oldStatus = entry.status;
        const priority = entry.priority;

        // Apply updates
        Object.assign(entry, updates);

        // If status changed, update priority indexes
        const attributes = {
          [entryKey]: JSON.stringify(entry)
        };

        if (updates.status && updates.status !== oldStatus) {
          const indexKey = `telegram_queue_index_priority_${priority}`;
          const currentIndex = await this.getAttribute(indexKey) || [];

          // Remove from PENDING index if status changed from PENDING
          if (oldStatus === 'PENDING' && updates.status !== 'PENDING') {
            const filteredIndex = currentIndex.filter(id => id !== queueId);
            attributes[indexKey] = JSON.stringify(filteredIndex);
          }

          // Add to PENDING index if status changed to PENDING or RETRY
          if ((updates.status === 'PENDING' || updates.status === 'RETRY') && !currentIndex.includes(queueId)) {
            currentIndex.push(queueId);
            attributes[indexKey] = JSON.stringify(currentIndex);
          }
        }

        await this.setAttributes(attributes);
      });

      const duration = Date.now() - startTime;
      logStorage('update', 1, duration);
    } catch (error) {
      logError('updateEntry', error, { queueId });
      throw error;
    }
  }

  /**
   * Get queue statistics
   * Calculates stats from all queue entries
   */
  async getStats(customerId = null) {
    const startTime = Date.now();

    try {
      const stats = {
        queueDepth: { 1: 0, 2: 0, 3: 0, 4: 0 },
        pendingCount: 0,
        failedCount: 0,
        retryCount: 0,
        sentCount: 0,
        averageDispatchDelaySeconds: 0
      };

      await this.withServiceAuth(async () => {
        const allAttributes = await this.getAllAttributes();
        const entries = [];
        let totalDelay = 0;
        let sentWithDelay = 0;

        // Parse all queue entries
        for (const [key, value] of Object.entries(allAttributes)) {
          if (key.startsWith('telegram_queue_entry_')) {
            try {
              const entry = JSON.parse(value);

              // Filter by customerId if provided
              if (customerId && entry.customerId !== customerId) continue;

              entries.push(entry);

              // Count by status
              if (entry.status === 'PENDING') {
                stats.pendingCount++;
                stats.queueDepth[entry.priority]++;
              } else if (entry.status === 'FAILED') {
                stats.failedCount++;
              } else if (entry.status === 'RETRY') {
                stats.retryCount++;
                stats.queueDepth[entry.priority]++;
              } else if (entry.status === 'SENT') {
                stats.sentCount++;

                // Calculate dispatch delay if sentAt is available
                if (entry.sentAt && entry.createdAt) {
                  totalDelay += (entry.sentAt - entry.createdAt) / 1000;
                  sentWithDelay++;
                }
              }
            } catch (parseError) {
              QueueLogger.warn(`Failed to parse entry ${key}:`, parseError);
            }
          }
        }

        // Calculate average dispatch delay
        if (sentWithDelay > 0) {
          stats.averageDispatchDelaySeconds = Math.round(totalDelay / sentWithDelay);
        }
      });

      const duration = Date.now() - startTime;
      logStorage('getStats', 0, duration);

      return stats;
    } catch (error) {
      logError('getStats', error);
      throw error;
    }
  }

  /**
   * Delete entries older than timestamp
   * Cleanup operation for TTL enforcement
   */
  async deleteOlderThan(timestampMs, customerId = null) {
    const startTime = Date.now();
    let deletedCount = 0;

    try {
      await this.withServiceAuth(async () => {
        const allAttributes = await this.getAllAttributes();
        const keysToDelete = [];
        const priorityIndexes = {
          1: new Set(),
          2: new Set(),
          3: new Set(),
          4: new Set()
        };

        // Find entries to delete
        for (const [key, value] of Object.entries(allAttributes)) {
          if (key.startsWith('telegram_queue_entry_')) {
            try {
              const entry = JSON.parse(value);

              // Filter by customerId and timestamp
              if (customerId && entry.customerId !== customerId) continue;

              if (entry.createdAt < timestampMs) {
                keysToDelete.push(key);
                deletedCount++;

                // Track queue IDs to remove from indexes
                priorityIndexes[entry.priority].add(entry.queueId);
              }
            } catch (parseError) {
              QueueLogger.warn(`Failed to parse entry ${key}:`, parseError);
            }
          }
        }

        // Delete entries
        if (keysToDelete.length > 0) {
          await this.deleteAttributes(keysToDelete);
        }

        // Update priority indexes
        for (let priority = 1; priority <= 4; priority++) {
          const idsToRemove = priorityIndexes[priority];
          if (idsToRemove.size > 0) {
            const indexKey = `telegram_queue_index_priority_${priority}`;
            const currentIndex = await this.getAttribute(indexKey) || [];
            const filteredIndex = currentIndex.filter(id => !idsToRemove.has(id));

            await this.setAttributes({
              [indexKey]: JSON.stringify(filteredIndex)
            });
          }
        }
      });

      const duration = Date.now() - startTime;
      logStorage('delete', deletedCount, duration);

      return deletedCount;
    } catch (error) {
      logError('deleteOlderThan', error, { timestampMs });
      throw error;
    }
  }

  /**
   * Get rate limit state for customer
   */
  async getRateLimitState(customerId) {
    try {
      const key = `telegram_queue_ratelimit_${customerId}`;

      return await this.withServiceAuth(async () => {
        const stateJson = await this.getAttribute(key);

        if (!stateJson) {
          // Return default state
          return {
            lastDispatchAt: 0,
            batchCount: 0,
            updatedAt: Date.now()
          };
        }

        return JSON.parse(stateJson);
      });
    } catch (error) {
      logError('getRateLimitState', error, { customerId });
      throw error;
    }
  }

  /**
   * Update rate limit state for customer
   */
  async updateRateLimitState(customerId, state) {
    try {
      const key = `telegram_queue_ratelimit_${customerId}`;

      await this.withServiceAuth(async () => {
        await this.setAttributes({
          [key]: JSON.stringify({
            ...state,
            updatedAt: Date.now()
          })
        });
      });
    } catch (error) {
      logError('updateRateLimitState', error, { customerId });
      throw error;
    }
  }

  /**
   * Get single queue entry by ID
   */
  async getEntry(queueId) {
    try {
      const entryKey = `telegram_queue_entry_${queueId}`;

      return await this.withServiceAuth(async () => {
        const entryJson = await this.getAttribute(entryKey);

        if (!entryJson) {
          return null;
        }

        return JSON.parse(entryJson);
      });
    } catch (error) {
      logError('getEntry', error, { queueId });
      throw error;
    }
  }

  /**
   * Close storage (no-op for ThingsBoard)
   */
  async close() {
    this.initialized = false;
  }

  // ============================================================
  // HELPER METHODS - ThingsBoard API Integration
  // ============================================================

  /**
   * Get single attribute value
   */
  async getAttribute(key) {
    const url = `${this.baseUrl}/api/plugins/telemetry/CUSTOMER/${this.customerId}/values/attributes/SERVER_SCOPE?keys=${key}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to get attribute ${key}: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data[key] || null;
  }

  /**
   * Get all attributes for customer
   */
  async getAllAttributes() {
    const url = `${this.baseUrl}/api/plugins/telemetry/CUSTOMER/${this.customerId}/values/attributes/SERVER_SCOPE`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
      }
    });

    if (response.status === 404) {
      return {};
    }

    if (!response.ok) {
      throw new Error(`Failed to get all attributes: HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Set multiple attributes
   */
  async setAttributes(attributes) {
    const url = `${this.baseUrl}/api/plugins/telemetry/CUSTOMER/${this.customerId}/SERVER_SCOPE`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
      },
      body: JSON.stringify(attributes)
    });

    if (!response.ok) {
      throw new Error(`Failed to set attributes: HTTP ${response.status}`);
    }
  }

  /**
   * Delete multiple attributes
   */
  async deleteAttributes(keys) {
    const url = `${this.baseUrl}/api/plugins/telemetry/CUSTOMER/${this.customerId}/SERVER_SCOPE?keys=${keys.join(',')}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete attributes: HTTP ${response.status}`);
    }
  }

  // ============================================================
  // AUTH BYPASS PATTERN (RFC-0002)
  // ============================================================

  /**
   * Save current user session
   */
  saveSession() {
    this.originalToken = localStorage.getItem('jwt_token');
    this.originalRefreshToken = localStorage.getItem('refresh_token');
    QueueLogger.log('Session saved');
  }

  /**
   * Restore original user session
   */
  restoreSession() {
    if (this.originalToken) {
      localStorage.setItem('jwt_token', this.originalToken);
    }
    if (this.originalRefreshToken) {
      localStorage.setItem('refresh_token', this.originalRefreshToken);
    }
    QueueLogger.log('Session restored');
  }

  /**
   * Authenticate with service account
   */
  async authenticateService() {
    const loginUrl = `${this.baseUrl}/api/auth/login`;
    const body = {
      username: this.serviceAccount.username,
      password: this.serviceAccount.password
    };

    QueueLogger.log('Authenticating with service account...');

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Service auth failed: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('No token in auth response');
    }

    this.serviceToken = data.token;
    localStorage.setItem('jwt_token', data.token);

    if (data.refreshToken) {
      localStorage.setItem('refresh_token', data.refreshToken);
    }

    QueueLogger.log('Service authentication successful');

    return data.token;
  }

  /**
   * Execute function with service account authentication
   * Saves current session, authenticates, executes fn, then restores session
   */
  async withServiceAuth(fn) {
    this.saveSession();

    try {
      await this.authenticateService();
      const result = await fn();
      this.restoreSession();
      return result;
    } catch (error) {
      this.restoreSession();
      throw error;
    }
  }
}
