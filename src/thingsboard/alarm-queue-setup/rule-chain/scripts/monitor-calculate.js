/**
 * RFC-0135 v2.0: Monitor - Calculate Queue Metrics
 *
 * PURE SYNCHRONOUS AGGREGATION LOGIC
 *
 * Purpose: Calculate queue statistics from index arrays
 * Node Type: Script Transformation
 * Input: metadata (with priority indexes and rate limit state from Enrichment)
 * Output: Telemetry metrics object
 *
 * Metrics Calculated:
 * - Queue depth per priority level
 * - Total queue depth
 * - Time since last dispatch
 * - Can send now indicator
 * - Wait time before next batch
 *
 * Usage in Rule Chain:
 * [Enrichment: Get Indexes+RateLimit+Config] → [THIS SCRIPT] → [Save Telemetry]
 */

// Helper to safely parse and get array length
function getArrayLength(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  try {
    var parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch (e) {
    return 0;
  }
}

// Get queue depths from priority indexes
var depth1 = getArrayLength(metadata.telegram_queue_index_priority_1);
var depth2 = getArrayLength(metadata.telegram_queue_index_priority_2);
var depth3 = getArrayLength(metadata.telegram_queue_index_priority_3);
var depth4 = getArrayLength(metadata.telegram_queue_index_priority_4);

var totalDepth = depth1 + depth2 + depth3 + depth4;

// Parse rate limit state
var rateLimitState = {};
var lastDispatchAt = 0;
var batchCount = 0;

if (metadata.telegram_queue_ratelimit) {
  try {
    if (typeof metadata.telegram_queue_ratelimit === 'string') {
      rateLimitState = JSON.parse(metadata.telegram_queue_ratelimit);
    } else {
      rateLimitState = metadata.telegram_queue_ratelimit;
    }

    lastDispatchAt = rateLimitState.lastDispatchAt || 0;
    batchCount = rateLimitState.batchCount || 0;
  } catch (e) {
    // Use defaults
  }
}

// Parse configuration for rate control settings
var config = {};
var delaySeconds = 60; // Default

if (metadata.telegram_queue_config) {
  try {
    if (typeof metadata.telegram_queue_config === 'string') {
      config = JSON.parse(metadata.telegram_queue_config);
    } else {
      config = metadata.telegram_queue_config;
    }

    if (config.rateControl && config.rateControl.delayBetweenBatchesSeconds) {
      delaySeconds = config.rateControl.delayBetweenBatchesSeconds;
    }
  } catch (e) {
    // Use default
  }
}

// Calculate time metrics
var now = Date.now();
var timeSinceLastMs = lastDispatchAt > 0 ? (now - lastDispatchAt) : 0;
var timeSinceLastSeconds = Math.floor(timeSinceLastMs / 1000);

// Calculate can send now and wait time
var requiredDelayMs = delaySeconds * 1000;
var canSendNow = 0;
var waitTimeSeconds = 0;

if (timeSinceLastMs >= requiredDelayMs) {
  canSendNow = 1;
  waitTimeSeconds = 0;
} else {
  canSendNow = 0;
  waitTimeSeconds = Math.ceil((requiredDelayMs - timeSinceLastMs) / 1000);
}

// Build telemetry object for virtual device
var telemetry = {
  // Queue depths by priority
  queue_depth_priority_1: depth1,
  queue_depth_priority_2: depth2,
  queue_depth_priority_3: depth3,
  queue_depth_priority_4: depth4,

  // Totals
  total_queue_depth: totalDepth,

  // Dispatch metrics
  time_since_last_dispatch_seconds: timeSinceLastSeconds,
  batch_count_total: batchCount,

  // Rate limit indicators
  can_send_now: canSendNow,
  wait_time_seconds: waitTimeSeconds,

  // Timestamp
  timestamp: now
};

// Return for Save Telemetry Node
return {
  msg: telemetry,
  metadata: metadata,
  msgType: 'POST_TELEMETRY_REQUEST'
};
