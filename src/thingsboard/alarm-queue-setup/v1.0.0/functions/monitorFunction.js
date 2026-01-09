/**
 * RFC-0135: Telegram Notification Queue - Monitor Function
 *
 * ThingsBoard Rule Chain Function Node
 * Collects queue statistics and returns telemetry for monitoring dashboard
 *
 * Usage in Rule Chain:
 * 1. Generator Node triggers every 5 minutes
 * 2. This function collects queue stats
 * 3. Returns telemetry data for virtual device
 * 4. Dashboard can display queue health metrics
 *
 * @module monitorFunction
 */

// Module-level variables
let _storageAdapter = null;
let _initialized = false;

/**
 * Initialize storage adapter (lazy initialization)
 */
async function initializeStorage(baseUrl, customerId) {
  if (_storageAdapter && _initialized) {
    return _storageAdapter;
  }

  const { ThingsboardStorageAdapter } = await import('../storage/thingsboardStorage.js');

  const config = {
    baseUrl: baseUrl || '',
    customerId: customerId,
    serviceAccount: {
      username: 'telegram-queue-service@myio.com.br',
      password: '' // Set via environment or secure config
    }
  };

  _storageAdapter = new ThingsboardStorageAdapter(config);
  await _storageAdapter.initialize(config);
  _initialized = true;

  return _storageAdapter;
}

/**
 * Main monitor function
 * Collects queue statistics for monitoring
 *
 * @param {Object} msg - Message from Generator Node
 * @param {Object} metadata - ThingsBoard metadata
 * @param {string} msgType - Message type
 * @returns {Promise<Object>} Telemetry data
 */
export async function monitorFunction(msg, metadata, msgType) {
  try {
    // Import dependencies
    const { getQueueStats } = await import('../lib/queueCore.js');
    const { getRateLimitStats } = await import('../lib/rateLimiter.js');
    const { fetchCustomerPriorityRules } = await import('../lib/priorityResolver.js');
    const { QueueLogger, logStats } = await import('../lib/logger.js');

    // Extract context
    const context = {
      customerId: metadata?.customerId || 'unknown'
    };

    QueueLogger.log('Monitor function triggered', { customerId: context.customerId });

    // Get base URL
    const baseUrl = (typeof window !== 'undefined' && window.location)
      ? `${window.location.protocol}//${window.location.host}`
      : '';

    const authToken = (typeof localStorage !== 'undefined')
      ? localStorage.getItem('jwt_token')
      : null;

    // Initialize storage
    const storage = await initializeStorage(baseUrl, context.customerId);

    const config = {
      storage,
      customerId: context.customerId,
      baseUrl,
      authToken
    };

    // Get customer config for rate control settings
    let customerConfig;
    try {
      customerConfig = await fetchCustomerPriorityRules(config, context.customerId);
    } catch (error) {
      // Use defaults if config fetch fails
      customerConfig = {
        rateControl: {
          batchSize: 5,
          delayBetweenBatchesSeconds: 60
        }
      };
    }

    config.rateControl = customerConfig?.rateControl || config.rateControl;

    // Collect queue statistics
    const queueStats = await getQueueStats(config, context.customerId);

    // Collect rate limit statistics
    let rateLimitStats;
    try {
      rateLimitStats = await getRateLimitStats(config, context.customerId);
    } catch (error) {
      QueueLogger.warn('Failed to get rate limit stats:', error);
      rateLimitStats = {
        lastDispatchAt: 0,
        batchCount: 0,
        timeSinceLastDispatchSeconds: 0,
        canSendNow: true,
        waitTimeSeconds: 0
      };
    }

    // Log stats
    logStats(queueStats);

    // Build telemetry data
    const telemetry = {
      // Queue depth by priority
      queue_depth_priority_1: queueStats.queueDepth[1] || 0,
      queue_depth_priority_2: queueStats.queueDepth[2] || 0,
      queue_depth_priority_3: queueStats.queueDepth[3] || 0,
      queue_depth_priority_4: queueStats.queueDepth[4] || 0,

      // Status counts
      pending_count: queueStats.pendingCount || 0,
      failed_count: queueStats.failedCount || 0,
      retry_count: queueStats.retryCount || 0,
      sent_count: queueStats.sentCount || 0,

      // Performance metrics
      average_dispatch_delay_seconds: queueStats.averageDispatchDelaySeconds || 0,

      // Rate limit metrics
      time_since_last_dispatch_seconds: rateLimitStats.timeSinceLastDispatchSeconds || 0,
      can_send_now: rateLimitStats.canSendNow ? 1 : 0,
      wait_time_seconds: rateLimitStats.waitTimeSeconds || 0,
      batch_count: rateLimitStats.batchCount || 0,

      // Total queue depth
      total_queue_depth: (queueStats.queueDepth[1] || 0) +
        (queueStats.queueDepth[2] || 0) +
        (queueStats.queueDepth[3] || 0) +
        (queueStats.queueDepth[4] || 0),

      // Timestamp
      monitor_timestamp: Date.now()
    };

    QueueLogger.log('Monitor data collected', telemetry);

    // Return telemetry
    return {
      msg: telemetry,
      metadata: {
        ...metadata,
        monitorComplete: true
      },
      msgType: 'POST_TELEMETRY_REQUEST'
    };

  } catch (error) {
    const { logError } = await import('../lib/logger.js');
    logError('monitorFunction', error);

    return {
      msg: {
        error: true,
        errorMessage: error.message,
        monitor_timestamp: Date.now()
      },
      metadata,
      msgType: 'POST_TELEMETRY_REQUEST'
    };
  }
}

/**
 * Standalone version for copy-paste into ThingsBoard
 */
export const monitorFunctionStandalone = `
// Telegram Queue Monitor Function
// RFC-0135 - Standalone version for ThingsBoard

// Configuration
var SERVICE_ACCOUNT = {
  username: 'telegram-queue-service@myio.com.br',
  password: 'SET_YOUR_PASSWORD_HERE' // CHANGE THIS
};

// Main function
return (async function() {
  try {
    var metadata = ctx.metadata || {};
    var customerId = metadata.customerId || 'unknown';
    var baseUrl = '';

    // Get base URL
    if (typeof window !== 'undefined' && window.location) {
      baseUrl = window.location.protocol + '//' + window.location.host;
    }

    // Authenticate with service account
    var loginResponse = await fetch(baseUrl + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SERVICE_ACCOUNT)
    });

    var loginData = await loginResponse.json();
    var serviceToken = loginData.token;

    // Get all attributes
    var allAttrsUrl = baseUrl + '/api/plugins/telemetry/CUSTOMER/' + customerId + '/values/attributes/SERVER_SCOPE';
    var attrsResponse = await fetch(allAttrsUrl, {
      headers: { 'X-Authorization': 'Bearer ' + serviceToken }
    });

    var allAttrs = {};
    if (attrsResponse.ok) {
      allAttrs = await attrsResponse.json();
    }

    // Calculate stats
    var stats = {
      queueDepth: { 1: 0, 2: 0, 3: 0, 4: 0 },
      pendingCount: 0,
      failedCount: 0,
      retryCount: 0,
      sentCount: 0
    };

    // Parse queue entries
    for (var key in allAttrs) {
      if (key.startsWith('telegram_queue_entry_')) {
        try {
          var entry = JSON.parse(allAttrs[key]);

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
          }
        } catch (e) {
          // Skip invalid entries
        }
      }
    }

    // Get rate limit state
    var rateLimitKey = 'telegram_queue_ratelimit_' + customerId;
    var rateLimitJson = allAttrs[rateLimitKey];
    var timeSinceLastDispatch = 0;

    if (rateLimitJson) {
      try {
        var rateState = JSON.parse(rateLimitJson);
        timeSinceLastDispatch = Math.floor((Date.now() - rateState.lastDispatchAt) / 1000);
      } catch (e) {
        // Use default
      }
    }

    // Build telemetry
    var telemetry = {
      queue_depth_priority_1: stats.queueDepth[1],
      queue_depth_priority_2: stats.queueDepth[2],
      queue_depth_priority_3: stats.queueDepth[3],
      queue_depth_priority_4: stats.queueDepth[4],
      pending_count: stats.pendingCount,
      failed_count: stats.failedCount,
      retry_count: stats.retryCount,
      sent_count: stats.sentCount,
      time_since_last_dispatch_seconds: timeSinceLastDispatch,
      total_queue_depth: stats.queueDepth[1] + stats.queueDepth[2] + stats.queueDepth[3] + stats.queueDepth[4],
      monitor_timestamp: Date.now()
    };

    console.log('[TelegramQueue] Monitor:', telemetry);

    return {
      msg: telemetry,
      metadata: metadata,
      msgType: 'POST_TELEMETRY_REQUEST'
    };

  } catch (error) {
    console.error('[TelegramQueue] Monitor error:', error);
    return {
      msg: { error: true, errorMessage: error.message, monitor_timestamp: Date.now() },
      metadata: metadata,
      msgType: 'POST_TELEMETRY_REQUEST'
    };
  }
})();
`;

export default monitorFunction;
