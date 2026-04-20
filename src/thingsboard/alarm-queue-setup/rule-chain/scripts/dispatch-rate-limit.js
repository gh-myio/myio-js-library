/**
 * RFC-0135 v2.0: Dispatcher - Rate Limit Check & Build Batch
 *
 * PURE SYNCHRONOUS LOGIC
 *
 * Purpose: Check rate limiting and extract batch of queue IDs
 * Node Type: Script Transformation
 * Input: metadata (with config and indexes from Enrichment Node)
 * Output: Batch decision (rateLimited: true/false, batchIds: [...])
 *
 * Usage in Rule Chain:
 * [Enrichment: Get Config+Indexes+RateLimit] → [THIS SCRIPT] → [Switch: rateLimited?]
 */

// Parse configuration
var config = {};
var rateControl = {};
var batchSize = 5;
var delayBetweenBatchesSeconds = 60;

if (metadata.telegram_queue_config) {
  try {
    if (typeof metadata.telegram_queue_config === 'string') {
      config = JSON.parse(metadata.telegram_queue_config);
    } else {
      config = metadata.telegram_queue_config;
    }

    if (config.rateControl) {
      rateControl = config.rateControl;
      batchSize = rateControl.batchSize || 5;
      delayBetweenBatchesSeconds = rateControl.delayBetweenBatchesSeconds || 60;
    }
  } catch (e) {
    // Use defaults
  }
}

// Parse rate limit state
var rateLimitState = {};
var lastDispatchAt = 0;

if (metadata.telegram_queue_ratelimit) {
  try {
    if (typeof metadata.telegram_queue_ratelimit === 'string') {
      rateLimitState = JSON.parse(metadata.telegram_queue_ratelimit);
    } else {
      rateLimitState = metadata.telegram_queue_ratelimit;
    }

    lastDispatchAt = rateLimitState.lastDispatchAt || 0;
  } catch (e) {
    // Use defaults
  }
}

// ===== RATE LIMIT CHECK (Synchronous Math) =====
var now = Date.now();
var timeSinceLastMs = now - lastDispatchAt;
var requiredDelayMs = delayBetweenBatchesSeconds * 1000;

// Check if we're rate limited
if (timeSinceLastMs < requiredDelayMs) {
  // RATE LIMITED - Cannot send yet
  var waitTimeSeconds = Math.ceil((requiredDelayMs - timeSinceLastMs) / 1000);

  return {
    msg: {
      rateLimited: true,
      waitTimeSeconds: waitTimeSeconds,
      timeSinceLastSeconds: Math.floor(timeSinceLastMs / 1000),
      requiredDelaySeconds: delayBetweenBatchesSeconds
    },
    metadata: metadata,
    msgType: 'POST_TELEMETRY_REQUEST'
  };
}

// ===== NOT RATE LIMITED - Build Batch =====

// Helper to parse array safely
function parseArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    var parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Get priority indexes
var p1 = parseArray(metadata.telegram_queue_index_priority_1);
var p2 = parseArray(metadata.telegram_queue_index_priority_2);
var p3 = parseArray(metadata.telegram_queue_index_priority_3);
var p4 = parseArray(metadata.telegram_queue_index_priority_4);

// Build batch respecting priority order (Critical → High → Medium → Low)
var batch = [];

// Priority 1 (Critical)
for (var i = 0; i < p1.length && batch.length < batchSize; i++) {
  batch.push(p1[i]);
}

// Priority 2 (High)
for (var i = 0; i < p2.length && batch.length < batchSize; i++) {
  batch.push(p2[i]);
}

// Priority 3 (Medium)
for (var i = 0; i < p3.length && batch.length < batchSize; i++) {
  batch.push(p3[i]);
}

// Priority 4 (Low)
for (var i = 0; i < p4.length && batch.length < batchSize; i++) {
  batch.push(p4[i]);
}

// If no messages in queue, return empty batch
if (batch.length === 0) {
  return {
    msg: {
      rateLimited: false,
      emptyQueue: true,
      batchIds: [],
      batchSize: 0
    },
    metadata: metadata,
    msgType: 'POST_TELEMETRY_REQUEST'
  };
}

// Return batch for processing
return {
  msg: {
    rateLimited: false,
    emptyQueue: false,
    batchIds: batch,
    batchSize: batch.length,
    customerId: metadata.customerId
  },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
