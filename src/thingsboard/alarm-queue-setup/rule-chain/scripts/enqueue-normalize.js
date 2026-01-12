/**
 * RFC-0135 v2.0: Enqueue - Normalize Payload
 *
 * PURE SYNCHRONOUS TRANSFORMATION
 *
 * Purpose: Generate UUID and normalize message payload
 * Node Type: Script Transformation
 * Input: msg.msg.text, metadata.deviceId, metadata.customerId
 * Output: Normalized queue entry structure
 *
 * Usage in Rule Chain:
 * [Transformation Node] → [THIS SCRIPT] → [Enrichment: Get Config]
 */

// UUID Generator (simple collision-safe implementation)
function generateUUID() {
  var timestamp = Date.now().toString(36);
  var random = Math.random().toString(36).substring(2, 15);
  var random2 = Math.random().toString(36).substring(2, 15);
  return timestamp + '-' + random + random2;
}

// Extract values with fallbacks
var text = '';
if (msg.msg && msg.msg.text) {
  text = msg.msg.text;
} else if (msg.text) {
  text = msg.text;
}

var deviceId = metadata.deviceId || msg.deviceId || 'unknown';
var customerId = metadata.customerId || msg.customerId || 'unknown';
var deviceProfile = metadata.deviceType || msg.deviceType || msg.deviceProfile || 'unknown';
var deviceName = metadata.deviceName || msg.deviceName || 'Unknown Device';

// Generate unique queue ID
var queueId = generateUUID();
var createdAt = Date.now();

// Return normalized structure
return {
  msg: {
    queueId: queueId,
    deviceId: deviceId,
    customerId: customerId,
    deviceProfile: deviceProfile,
    deviceName: deviceName,
    text: text,
    createdAt: createdAt
  },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
