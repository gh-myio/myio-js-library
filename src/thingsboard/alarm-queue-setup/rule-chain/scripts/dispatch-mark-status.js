/**
 * RFC-0135 v2.0: Dispatcher - Mark Entry Status
 *
 * PURE SYNCHRONOUS STATUS UPDATE LOGIC
 *
 * Purpose: Update queue entry status based on Telegram API response
 * Node Type: Script Transformation
 * Input: msg (queue entry), metadata.httpStatus (from REST API Call Node)
 * Output: Updated queue entry with new status
 *
 * Status Mapping:
 * - 200 OK → SENT
 * - 429 Rate Limit → RETRY (increment retryCount)
 * - 5xx Server Error → RETRY (increment retryCount)
 * - 400-499 Client Error → FAILED (permanent)
 * - 0 Network Error → RETRY (increment retryCount)
 *
 * Usage in Rule Chain:
 * [REST API: Telegram] → [THIS SCRIPT] → [Save Attributes: Update Entry]
 */

// Get queue entry (should be in msg from previous enrichment)
var entry = msg.entry || msg;

// Get HTTP status from REST API Call Node response
// ThingsBoard REST API Node sets this in metadata
var httpStatus = metadata.httpStatus || metadata.statusCode || 0;

// Get response body if available
var responseBody = metadata.responseBody || {};

// Current timestamp
var now = Date.now();

// Initialize fields if missing
if (!entry.retryCount) entry.retryCount = 0;
if (!entry.maxRetries) entry.maxRetries = 3;

// ===== STATUS DETERMINATION LOGIC =====

if (httpStatus === 200) {
  // ===== SUCCESS =====
  entry.status = 'SENT';
  entry.sentAt = now;
  entry.errorMessage = null;
}
else if (httpStatus === 429) {
  // ===== TELEGRAM RATE LIMIT (429 Too Many Requests) =====
  entry.retryCount = entry.retryCount + 1;
  entry.lastAttemptAt = now;

  if (entry.retryCount >= entry.maxRetries) {
    entry.status = 'FAILED';
    entry.errorMessage = 'Telegram rate limit - max retries exceeded';
  } else {
    entry.status = 'RETRY';
    entry.errorMessage = 'Telegram rate limit (429)';

    // Extract retry_after if provided by Telegram
    if (responseBody.parameters && responseBody.parameters.retry_after) {
      entry.retryAfterSeconds = responseBody.parameters.retry_after;
    }
  }
}
else if (httpStatus >= 500 && httpStatus < 600) {
  // ===== SERVER ERROR (5xx) - Retryable =====
  entry.retryCount = entry.retryCount + 1;
  entry.lastAttemptAt = now;

  if (entry.retryCount >= entry.maxRetries) {
    entry.status = 'FAILED';
    entry.errorMessage = 'Server error ' + httpStatus + ' - max retries exceeded';
  } else {
    entry.status = 'RETRY';
    entry.errorMessage = 'Server error ' + httpStatus;
  }
}
else if (httpStatus >= 400 && httpStatus < 500) {
  // ===== CLIENT ERROR (4xx) - NOT Retryable =====
  // These are permanent failures (invalid token, chat not found, etc.)
  entry.status = 'FAILED';
  entry.errorMessage = 'Client error ' + httpStatus;

  if (responseBody.description) {
    entry.errorMessage = entry.errorMessage + ': ' + responseBody.description;
  }

  // Common 4xx errors:
  // 400 = Bad Request (invalid message format)
  // 401 = Unauthorized (invalid bot token)
  // 403 = Forbidden (bot blocked or no permission)
  // 404 = Not Found (chat doesn't exist)
}
else if (httpStatus === 0) {
  // ===== NETWORK ERROR - Retryable =====
  entry.retryCount = entry.retryCount + 1;
  entry.lastAttemptAt = now;

  if (entry.retryCount >= entry.maxRetries) {
    entry.status = 'FAILED';
    entry.errorMessage = 'Network error - max retries exceeded';
  } else {
    entry.status = 'RETRY';
    entry.errorMessage = 'Network error (connection failed)';
  }
}
else {
  // ===== UNKNOWN STATUS - Treat as retryable =====
  entry.retryCount = entry.retryCount + 1;
  entry.lastAttemptAt = now;

  if (entry.retryCount >= entry.maxRetries) {
    entry.status = 'FAILED';
    entry.errorMessage = 'Unknown error (HTTP ' + httpStatus + ') - max retries exceeded';
  } else {
    entry.status = 'RETRY';
    entry.errorMessage = 'Unknown error (HTTP ' + httpStatus + ')';
  }
}

// Prepare output for Save Attributes Node
// Format: telegram_queue_entry_{queueId}
var attributeKey = 'telegram_queue_entry_' + entry.queueId;
var attributes = {};
attributes[attributeKey] = JSON.stringify(entry);

return {
  msg: {
    entry: entry,
    attributes: attributes,
    needsIndexUpdate: (entry.status === 'SENT' || entry.status === 'FAILED')
  },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
