/**
 * RFC-0135: Telegram Notification Queue - Enqueue Function
 *
 * ThingsBoard Rule Chain Function Node
 * Receives message from Transformation Node and enqueues it for dispatch
 *
 * Usage in Rule Chain:
 * 1. Transformation Node builds Telegram message payload
 * 2. This function normalizes, resolves priority, and enqueues
 * 3. Returns success message with queueId
 *
 * Module-level caching pattern (RFC-0126) to handle timing issues
 *
 * @module enqueueFunction
 */

// NOTE: This is designed to be used as a ThingsBoard Function Node
// It can be imported as a library export OR copy-pasted into ThingsBoard UI

// Module-level variables (RFC-0126 pattern)
let _storageAdapter = null;
let _initialized = false;

/**
 * Initialize storage adapter (lazy initialization)
 * Called on first message, caches adapter instance
 */
async function initializeStorage(baseUrl, customerId) {
  if (_storageAdapter && _initialized) {
    return _storageAdapter;
  }

  // Import dependencies (when used as library)
  // When copy-pasted to ThingsBoard, these would be inlined
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
 * Main enqueue function
 * Designed to be used in ThingsBoard Rule Chain Function Node
 *
 * @param {Object} msg - Message from Rule Chain
 * @param {Object} msg.msg - Message content
 * @param {string} msg.msg.text - Telegram message text
 * @param {Object} msg.metadata - Metadata
 * @param {string} msg.metadata.deviceType - Device type/profile
 * @param {string} msg.metadata.deviceName - Device name
 * @param {string} msg.metadata.ts - Timestamp
 * @param {string} msg.msgType - Message type
 * @param {Object} metadata - ThingsBoard metadata (with deviceId, etc.)
 * @param {string} msgType - Message type
 * @returns {Promise<Object>} Result message
 *
 * @example ThingsBoard Function Node code:
 * ```javascript
 * return (async function() {
 *   const { enqueueFunction } = await import('myio-js-library');
 *   return await enqueueFunction(msg, metadata, msgType);
 * })();
 * ```
 */
export async function enqueueFunction(msg, metadata, msgType) {
  try {
    // Import dependencies
    const { normalizePayload, enqueue } = await import('../lib/queueCore.js');
    const { resolvePriority } = await import('../lib/priorityResolver.js');
    const { QueueLogger, logEnqueue } = await import('../lib/logger.js');

    // Extract context from ThingsBoard
    // In ThingsBoard Rule Chain, metadata contains deviceId, customerId, etc.
    const context = {
      deviceId: metadata?.deviceId || msg?.metadata?.deviceId || 'unknown',
      customerId: metadata?.customerId || msg?.metadata?.customerId || 'unknown'
    };

    QueueLogger.log('Enqueue function called', { context });

    // Get base URL (from window or environment)
    const baseUrl = (typeof window !== 'undefined' && window.location)
      ? `${window.location.protocol}//${window.location.host}`
      : '';

    // Initialize storage
    const storage = await initializeStorage(baseUrl, context.customerId);

    // 1. Normalize payload
    const normalized = normalizePayload(msg, context);

    QueueLogger.log('Payload normalized', {
      queueId: normalized.queueId,
      deviceId: normalized.deviceId,
      deviceProfile: normalized.deviceProfile
    });

    // 2. Resolve priority
    const priorityConfig = {
      baseUrl,
      authToken: (typeof localStorage !== 'undefined')
        ? localStorage.getItem('jwt_token')
        : null
    };

    const priority = await resolvePriority(
      priorityConfig,
      normalized.customerId,
      normalized.deviceId,
      normalized.deviceProfile
    );

    QueueLogger.log(`Priority resolved: ${priority}`);

    // Add priority to normalized payload
    normalized.priority = priority;

    // 3. Enqueue
    const queueId = await enqueue({ storage }, normalized);

    QueueLogger.log(`Message enqueued successfully: ${queueId}`);

    // 4. Return success message
    return {
      msg: {
        queueId,
        status: 'PENDING',
        priority,
        enqueuedAt: normalized.createdAt,
        text: normalized.payload.text
      },
      metadata: {
        ...metadata,
        queueId,
        queueStatus: 'PENDING'
      },
      msgType: 'POST_TELEMETRY_REQUEST'
    };
  } catch (error) {
    // Import logger for error logging
    const { logError } = await import('../lib/logger.js');
    logError('enqueueFunction', error, { msg });

    // Return error message
    return {
      msg: {
        error: true,
        errorMessage: error.message,
        errorStack: error.stack
      },
      metadata: {
        ...metadata,
        queueError: error.message
      },
      msgType: 'POST_TELEMETRY_REQUEST'
    };
  }
}

/**
 * Standalone version for copy-paste into ThingsBoard
 * This version has all dependencies inlined
 *
 * To use in ThingsBoard Function Node:
 * 1. Copy the entire function below
 * 2. Paste into ThingsBoard Rule Chain Function Node
 * 3. Configure service account credentials
 * 4. Save and deploy
 */
export const enqueueFunctionStandalone = `
// Telegram Queue Enqueue Function
// RFC-0135 - Standalone version for ThingsBoard

// Module-level cache
var _storageAdapter = null;
var _priorityRulesCache = {};

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
    var deviceId = metadata.deviceId || msg.metadata?.deviceId || 'unknown';
    var deviceProfile = msg.metadata?.deviceType || 'unknown';
    var text = msg.msg?.text || '';
    var baseUrl = ''; // Will be set from window.location

    // Get base URL
    if (typeof window !== 'undefined' && window.location) {
      baseUrl = window.location.protocol + '//' + window.location.host;
    }

    // Generate UUID
    function generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    // Normalize payload
    var queueId = generateUUID();
    var entry = {
      queueId: queueId,
      customerId: customerId,
      deviceId: deviceId,
      deviceProfile: deviceProfile,
      payload: { text: text },
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      createdAt: Date.now()
    };

    // Resolve priority (simplified - always uses Medium for standalone)
    entry.priority = 3; // Medium

    // Save to ThingsBoard attributes
    var entryKey = 'telegram_queue_entry_' + queueId;
    var indexKey = 'telegram_queue_index_priority_' + entry.priority;

    // Authenticate with service account
    var loginResponse = await fetch(baseUrl + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SERVICE_ACCOUNT)
    });

    var loginData = await loginResponse.json();
    var serviceToken = loginData.token;

    // Get current index
    var getIndexUrl = baseUrl + '/api/plugins/telemetry/CUSTOMER/' + customerId + '/values/attributes/SERVER_SCOPE?keys=' + indexKey;
    var indexResponse = await fetch(getIndexUrl, {
      headers: { 'X-Authorization': 'Bearer ' + serviceToken }
    });

    var currentIndex = [];
    if (indexResponse.ok) {
      var indexData = await indexResponse.json();
      var indexJson = indexData[indexKey];
      if (indexJson) {
        currentIndex = JSON.parse(indexJson);
      }
    }

    // Add to index
    currentIndex.push(queueId);

    // Save entry and index
    var saveUrl = baseUrl + '/api/plugins/telemetry/CUSTOMER/' + customerId + '/SERVER_SCOPE';
    var attributes = {};
    attributes[entryKey] = JSON.stringify(entry);
    attributes[indexKey] = JSON.stringify(currentIndex);

    await fetch(saveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': 'Bearer ' + serviceToken
      },
      body: JSON.stringify(attributes)
    });

    console.log('[TelegramQueue] Enqueued:', queueId);

    return {
      msg: {
        queueId: queueId,
        status: 'PENDING',
        priority: entry.priority
      },
      metadata: metadata,
      msgType: 'POST_TELEMETRY_REQUEST'
    };
  } catch (error) {
    console.error('[TelegramQueue] Enqueue error:', error);
    return {
      msg: { error: true, errorMessage: error.message },
      metadata: metadata,
      msgType: 'POST_TELEMETRY_REQUEST'
    };
  }
})();
`;

// Export for library use
export default enqueueFunction;
