/**
 * RFC-0135: Telegram Notification Queue - Dispatch Function
 *
 * ThingsBoard Rule Chain Function Node
 * Scheduler that fetches and dispatches messages in batches
 *
 * Usage in Rule Chain:
 * 1. Generator Node triggers every 60 seconds
 * 2. This function fetches next batch from queue
 * 3. Applies rate limiting
 * 4. Sends messages to Telegram API
 * 5. Updates status (SENT/FAILED/RETRY)
 * 6. Returns dispatch summary
 *
 * Module-level mutex to prevent concurrent dispatch (RFC-0126)
 *
 * @module dispatchFunction
 */

// Module-level variables (RFC-0126 pattern)
let _storageAdapter = null;
let _initialized = false;
let _isDispatching = false; // Mutex to prevent concurrent dispatch

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
 * Get customer queue configuration from attributes
 */
async function getCustomerConfig(baseUrl, customerId, authToken) {
  try {
    const url = `${baseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=telegram_queue_config`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok || response.status === 404) {
      // Return default config
      return {
        enabled: true,
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
    }

    const data = await response.json();
    const configJson = data.telegram_queue_config;

    if (!configJson) {
      throw new Error('No queue configuration found');
    }

    return JSON.parse(configJson);
  } catch (error) {
    console.error('[TelegramQueue] Failed to get customer config:', error);
    throw error;
  }
}

/**
 * Main dispatch function
 * Designed to be used in ThingsBoard Rule Chain Function Node
 *
 * @param {Object} msg - Message from Generator Node (can be empty)
 * @param {Object} metadata - ThingsBoard metadata
 * @param {string} msgType - Message type
 * @returns {Promise<Object>} Dispatch summary
 */
export async function dispatchFunction(msg, metadata, msgType) {
  // Check mutex - prevent concurrent dispatch
  if (_isDispatching) {
    const { QueueLogger } = await import('../lib/logger.js');
    QueueLogger.warn('Dispatch already in progress, skipping this cycle');

    return {
      msg: {
        skipped: true,
        reason: 'Dispatch in progress'
      },
      metadata,
      msgType: 'POST_TELEMETRY_REQUEST'
    };
  }

  _isDispatching = true;

  try {
    // Import dependencies
    const { dequeue, updateStatus, shouldRetry } = await import('../lib/queueCore.js');
    const { applyRateLimit, recordBatchDispatch } = await import('../lib/rateLimiter.js');
    const { sendMessage, isRetryableError } = await import('../lib/telegramClient.js');
    const { fetchCustomerPriorityRules } = await import('../lib/priorityResolver.js');
    const { QueueLogger, logBatchStart, logBatchComplete, logDispatch } = await import('../lib/logger.js');

    // Extract context
    const context = {
      customerId: metadata?.customerId || 'unknown'
    };

    QueueLogger.log('Dispatch function triggered', { customerId: context.customerId });

    // Get base URL
    const baseUrl = (typeof window !== 'undefined' && window.location)
      ? `${window.location.protocol}//${window.location.host}`
      : '';

    const authToken = (typeof localStorage !== 'undefined')
      ? localStorage.getItem('jwt_token')
      : null;

    // Initialize storage
    const storage = await initializeStorage(baseUrl, context.customerId);

    // Get customer configuration
    const customerConfig = await getCustomerConfig(baseUrl, context.customerId, authToken);

    if (!customerConfig.enabled) {
      QueueLogger.log('Queue disabled for customer');
      return {
        msg: { skipped: true, reason: 'Queue disabled' },
        metadata,
        msgType: 'POST_TELEMETRY_REQUEST'
      };
    }

    // Build config object
    const config = {
      storage,
      customerId: context.customerId,
      rateControl: customerConfig.rateControl,
      telegram: customerConfig.telegram
    };

    // Check rate limit
    const canSend = await applyRateLimit(config, context.customerId);

    if (!canSend) {
      QueueLogger.log('Rate limited, skipping this cycle');
      return {
        msg: { skipped: true, reason: 'Rate limited' },
        metadata,
        msgType: 'POST_TELEMETRY_REQUEST'
      };
    }

    // Dequeue next batch
    const batchSize = customerConfig.rateControl.batchSize || 5;
    const batch = await dequeue(config, batchSize);

    if (batch.length === 0) {
      QueueLogger.log('Queue empty');
      return {
        msg: {
          batchSize: 0,
          sent: 0,
          failed: 0,
          retry: 0,
          queueEmpty: true
        },
        metadata,
        msgType: 'POST_TELEMETRY_REQUEST'
      };
    }

    logBatchStart(batch.length, context.customerId);

    // Process batch
    const results = { sent: 0, failed: 0, retry: 0 };

    for (const entry of batch) {
      try {
        // Update status to SENDING
        await updateStatus(config, entry.queueId, 'SENDING', {});

        // Send to Telegram
        const response = await sendMessage(
          customerConfig.telegram,
          entry.payload.text
        );

        // Success - update status to SENT
        await updateStatus(config, entry.queueId, 'SENT', {
          httpStatus: 200,
          responseBody: JSON.stringify(response),
          sentAt: Date.now()
        });

        logDispatch(entry.queueId, 'SENT', 200);
        results.sent++;

      } catch (error) {
        // Failed - determine if should retry
        const statusCode = error.statusCode || 0;
        const errorMessage = error.message || 'Unknown error';

        QueueLogger.error(`Failed to send ${entry.queueId}:`, errorMessage);

        // Check if retryable
        const canRetry = isRetryableError(error) && shouldRetry(entry);

        if (canRetry) {
          // Update status to RETRY
          await updateStatus(config, entry.queueId, 'RETRY', {
            httpStatus: statusCode,
            errorMessage,
            retryCount: entry.retryCount + 1
          });

          logDispatch(entry.queueId, 'RETRY', statusCode, errorMessage);
          results.retry++;
        } else {
          // Update status to FAILED
          await updateStatus(config, entry.queueId, 'FAILED', {
            httpStatus: statusCode,
            errorMessage
          });

          logDispatch(entry.queueId, 'FAILED', statusCode, errorMessage);
          results.failed++;
        }
      }
    }

    // Record batch dispatch
    await recordBatchDispatch(config, context.customerId, batch.length);

    logBatchComplete(results.sent, results.failed, results.retry, context.customerId);

    // Return summary
    return {
      msg: {
        batchSize: batch.length,
        sent: results.sent,
        failed: results.failed,
        retry: results.retry,
        timestamp: Date.now()
      },
      metadata: {
        ...metadata,
        dispatchComplete: true
      },
      msgType: 'POST_TELEMETRY_REQUEST'
    };

  } catch (error) {
    const { logError } = await import('../lib/logger.js');
    logError('dispatchFunction', error);

    return {
      msg: {
        error: true,
        errorMessage: error.message,
        errorStack: error.stack
      },
      metadata,
      msgType: 'POST_TELEMETRY_REQUEST'
    };

  } finally {
    // Release mutex
    _isDispatching = false;
  }
}

/**
 * Standalone version for copy-paste into ThingsBoard
 */
export const dispatchFunctionStandalone = `
// Telegram Queue Dispatch Function
// RFC-0135 - Standalone version for ThingsBoard

// Module-level mutex
var _isDispatching = _isDispatching || false;

// Configuration
var SERVICE_ACCOUNT = {
  username: 'telegram-queue-service@myio.com.br',
  password: 'SET_YOUR_PASSWORD_HERE' // CHANGE THIS
};

// Main function
return (async function() {
  // Prevent concurrent dispatch
  if (_isDispatching) {
    console.log('[TelegramQueue] Dispatch in progress, skipping');
    return { msg: { skipped: true }, metadata: metadata, msgType: 'POST_TELEMETRY_REQUEST' };
  }

  _isDispatching = true;

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

    // Get customer config
    var configUrl = baseUrl + '/api/plugins/telemetry/CUSTOMER/' + customerId + '/values/attributes/SERVER_SCOPE?keys=telegram_queue_config';
    var configResponse = await fetch(configUrl, {
      headers: { 'X-Authorization': 'Bearer ' + serviceToken }
    });

    var customerConfig = { rateControl: { batchSize: 5 }, telegram: { botToken: '', chatId: '' } };
    if (configResponse.ok) {
      var configData = await configResponse.json();
      var configJson = configData.telegram_queue_config;
      if (configJson) {
        customerConfig = JSON.parse(configJson);
      }
    }

    // Check rate limit (simplified)
    var rateLimitKey = 'telegram_queue_ratelimit_' + customerId;
    var rateLimitUrl = baseUrl + '/api/plugins/telemetry/CUSTOMER/' + customerId + '/values/attributes/SERVER_SCOPE?keys=' + rateLimitKey;
    var rateLimitResponse = await fetch(rateLimitUrl, {
      headers: { 'X-Authorization': 'Bearer ' + serviceToken }
    });

    var canSend = true;
    if (rateLimitResponse.ok) {
      var rateLimitData = await rateLimitResponse.json();
      var rateLimitJson = rateLimitData[rateLimitKey];
      if (rateLimitJson) {
        var state = JSON.parse(rateLimitJson);
        var delay = (customerConfig.rateControl.delayBetweenBatchesSeconds || 60) * 1000;
        var timeSince = Date.now() - state.lastDispatchAt;
        canSend = timeSince >= delay;
      }
    }

    if (!canSend) {
      console.log('[TelegramQueue] Rate limited');
      _isDispatching = false;
      return { msg: { skipped: true, reason: 'Rate limited' }, metadata: metadata, msgType: 'POST_TELEMETRY_REQUEST' };
    }

    // Fetch batch from priority indexes
    var batch = [];
    var batchSize = customerConfig.rateControl.batchSize || 5;

    for (var priority = 1; priority <= 4 && batch.length < batchSize; priority++) {
      var indexKey = 'telegram_queue_index_priority_' + priority;
      var indexUrl = baseUrl + '/api/plugins/telemetry/CUSTOMER/' + customerId + '/values/attributes/SERVER_SCOPE?keys=' + indexKey;
      var indexResponse = await fetch(indexUrl, {
        headers: { 'X-Authorization': 'Bearer ' + serviceToken }
      });

      if (indexResponse.ok) {
        var indexData = await indexResponse.json();
        var indexJson = indexData[indexKey];
        if (indexJson) {
          var queueIds = JSON.parse(indexJson);

          for (var i = 0; i < queueIds.length && batch.length < batchSize; i++) {
            var queueId = queueIds[i];
            var entryKey = 'telegram_queue_entry_' + queueId;
            var entryUrl = baseUrl + '/api/plugins/telemetry/CUSTOMER/' + customerId + '/values/attributes/SERVER_SCOPE?keys=' + entryKey;
            var entryResponse = await fetch(entryUrl, {
              headers: { 'X-Authorization': 'Bearer ' + serviceToken }
            });

            if (entryResponse.ok) {
              var entryData = await entryResponse.json();
              var entryJson = entryData[entryKey];
              if (entryJson) {
                var entry = JSON.parse(entryJson);
                if (entry.status === 'PENDING' || entry.status === 'RETRY') {
                  batch.push(entry);
                }
              }
            }
          }
        }
      }
    }

    if (batch.length === 0) {
      console.log('[TelegramQueue] Queue empty');
      _isDispatching = false;
      return { msg: { batchSize: 0, queueEmpty: true }, metadata: metadata, msgType: 'POST_TELEMETRY_REQUEST' };
    }

    console.log('[TelegramQueue] Processing batch of', batch.length);

    // Send messages
    var results = { sent: 0, failed: 0, retry: 0 };

    for (var j = 0; j < batch.length; j++) {
      var entry = batch[j];

      try {
        // Send to Telegram
        var telegramUrl = 'https://api.telegram.org/bot' + customerConfig.telegram.botToken + '/sendMessage';
        var telegramResponse = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: customerConfig.telegram.chatId,
            text: entry.payload.text,
            parse_mode: 'HTML'
          })
        });

        if (telegramResponse.ok) {
          // Success
          entry.status = 'SENT';
          entry.sentAt = Date.now();
          entry.httpStatus = 200;
          results.sent++;
        } else {
          // Failed
          var shouldRetry = entry.retryCount < (customerConfig.rateControl.maxRetries || 3);
          if (shouldRetry) {
            entry.status = 'RETRY';
            entry.retryCount++;
            results.retry++;
          } else {
            entry.status = 'FAILED';
            results.failed++;
          }
          entry.httpStatus = telegramResponse.status;
        }

        // Save updated entry
        var saveUrl = baseUrl + '/api/plugins/telemetry/CUSTOMER/' + customerId + '/SERVER_SCOPE';
        var attributes = {};
        attributes['telegram_queue_entry_' + entry.queueId] = JSON.stringify(entry);
        await fetch(saveUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Authorization': 'Bearer ' + serviceToken
          },
          body: JSON.stringify(attributes)
        });

      } catch (error) {
        console.error('[TelegramQueue] Send error:', error);
        results.failed++;
      }
    }

    // Update rate limit
    var newRateLimit = { lastDispatchAt: Date.now(), batchCount: 1 };
    var rateLimitAttrs = {};
    rateLimitAttrs[rateLimitKey] = JSON.stringify(newRateLimit);
    await fetch(baseUrl + '/api/plugins/telemetry/CUSTOMER/' + customerId + '/SERVER_SCOPE', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': 'Bearer ' + serviceToken
      },
      body: JSON.stringify(rateLimitAttrs)
    });

    console.log('[TelegramQueue] Batch complete:', results);

    _isDispatching = false;
    return {
      msg: { ...results, batchSize: batch.length, timestamp: Date.now() },
      metadata: metadata,
      msgType: 'POST_TELEMETRY_REQUEST'
    };

  } catch (error) {
    console.error('[TelegramQueue] Dispatch error:', error);
    _isDispatching = false;
    return {
      msg: { error: true, errorMessage: error.message },
      metadata: metadata,
      msgType: 'POST_TELEMETRY_REQUEST'
    };
  }
})();
`;

export default dispatchFunction;
