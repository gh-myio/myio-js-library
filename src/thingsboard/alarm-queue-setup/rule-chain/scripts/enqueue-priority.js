/**
 * RFC-0135 v2.0: Enqueue - Resolve Priority
 *
 * PURE SYNCHRONOUS CASCADE LOGIC
 *
 * Purpose: Resolve message priority using cascade rules
 * Node Type: Script Transformation
 * Input: msg (normalized payload), metadata.telegram_queue_config (from Enrichment)
 * Output: Complete queue entry with priority
 *
 * Priority Cascade:
 * 1. Device Override (highest priority)
 * 2. Device Profile Rule
 * 3. Customer Global Default
 * 4. System Fallback (Medium = 3)
 *
 * Usage in Rule Chain:
 * [Enrichment: Get telegram_queue_config] → [THIS SCRIPT] → [Switch: Check enabled]
 */

// Get configuration (from Enrichment Node)
var config = {};
var priorityRules = {};
var deviceOverrides = {};
var deviceProfiles = {};
var globalDefault = 3;

// Safe config extraction
if (metadata.telegram_queue_config) {
  try {
    // Config may be string or object
    if (typeof metadata.telegram_queue_config === 'string') {
      config = JSON.parse(metadata.telegram_queue_config);
    } else {
      config = metadata.telegram_queue_config;
    }

    if (config.priorityRules) {
      priorityRules = config.priorityRules;
      deviceOverrides = priorityRules.deviceOverrides || {};
      deviceProfiles = priorityRules.deviceProfiles || {};
      if (priorityRules.globalDefault) {
        globalDefault = priorityRules.globalDefault;
      }
    }
  } catch (e) {
    // Parsing failed, use defaults
  }
}

// Extract device info from message
var deviceId = msg.deviceId;
var deviceProfile = (msg.deviceProfile || '').toUpperCase();

// Initialize priority resolution
var priority = 3; // System fallback (Medium)
var source = 'systemGlobal';

// CASCADE LEVEL 1: Device Override (highest priority)
if (deviceOverrides[deviceId]) {
  priority = deviceOverrides[deviceId];
  source = 'deviceOverride';
}
// CASCADE LEVEL 2: Device Profile Rule
else if (deviceProfiles[deviceProfile]) {
  priority = deviceProfiles[deviceProfile];
  source = 'deviceProfile';
}
// CASCADE LEVEL 3: Customer Global Default
else if (globalDefault && source === 'systemGlobal') {
  priority = globalDefault;
  source = 'customerGlobal';
}

// System-wide device profile defaults (fallback when no config exists)
if (source === 'systemGlobal' || source === 'customerGlobal') {
  // Critical (Priority 1): Infrastructure devices
  if (deviceProfile.indexOf('ENTRADA') >= 0 ||
      deviceProfile.indexOf('RELOGIO') >= 0 ||
      deviceProfile.indexOf('TRAFO') >= 0 ||
      deviceProfile.indexOf('SUBESTACAO') >= 0) {
    if (source === 'systemGlobal') {
      priority = 1;
      source = 'systemDefault';
    }
  }
  // High (Priority 2): Meters
  else if (deviceProfile === '3F_MEDIDOR' ||
           deviceProfile.indexOf('HIDROMETRO') >= 0 ||
           deviceProfile.indexOf('MEDIDOR') >= 0) {
    if (source === 'systemGlobal') {
      priority = 2;
      source = 'systemDefault';
    }
  }
  // Low (Priority 4): Thermostats
  else if (deviceProfile.indexOf('TERMOSTATO') >= 0) {
    if (source === 'systemGlobal') {
      priority = 4;
      source = 'systemDefault';
    }
  }
}

// Validate priority is in range 1-4
if (priority < 1 || priority > 4 || isNaN(priority)) {
  priority = 3; // Fallback to Medium
}

// Build complete queue entry
var entry = {
  queueId: msg.queueId,
  customerId: msg.customerId,
  deviceId: msg.deviceId,
  deviceProfile: msg.deviceProfile,
  priority: priority,
  prioritySource: source,
  payload: {
    text: msg.text,
    originalDeviceName: msg.deviceName
  },
  status: 'PENDING',
  retryCount: 0,
  maxRetries: 3,
  createdAt: msg.createdAt,
  lastAttemptAt: null
};

// Check if queue is enabled
var enabled = config.enabled !== false; // Default to true if not specified

return {
  msg: {
    entry: entry,
    enabled: enabled,
    priority: priority
  },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
