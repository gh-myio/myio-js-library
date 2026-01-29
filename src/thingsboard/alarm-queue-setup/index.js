/**
 * RFC-0135: Telegram Notification Queue - Rule Chain Scripts
 *
 * This module provides scripts for building a Telegram notification queue system
 * within ThingsBoard Rule Chains.
 *
 * IMPORTANT: This is NOT a library of functions. These are script templates
 * designed to be copied into ThingsBoard Script Transformation nodes.
 *
 * Architecture:
 * - Pure synchronous transformations (no async/await)
 * - Visual node-based workflow (not standalone functions)
 * - ThingsBoard Attributes for storage (no external database)
 * - Three independent Rule Chain flows: Enqueue, Dispatcher, Monitor
 *
 * @module telegram-queue
 * @see /src/thingsboard/alarm-queue-setup/README.md for complete setup guide
 * @see /src/thingsboard/alarm-queue-setup/rule-chain/README.md for technical details
 */

/**
 * Script Templates for ThingsBoard Rule Chain Nodes
 *
 * These scripts are designed to be copied into Script Transformation nodes
 * within ThingsBoard Rule Chains. They perform pure synchronous transformations.
 *
 * DO NOT import these directly - copy the script content into your Rule Chain nodes.
 */

// Re-export script file paths for documentation purposes
export const SCRIPT_PATHS = {
  // Enqueue Flow Scripts
  enqueueNormalize: './rule-chain/scripts/enqueue-normalize.js',
  enqueuePriority: './rule-chain/scripts/enqueue-priority.js',

  // Dispatcher Flow Scripts
  dispatchRateLimit: './rule-chain/scripts/dispatch-rate-limit.js',
  dispatchMarkStatus: './rule-chain/scripts/dispatch-mark-status.js',

  // Monitor Flow Scripts
  monitorCalculate: './rule-chain/scripts/monitor-calculate.js'
};

/**
 * Configuration Schema Reference
 *
 * ThingsBoard Attribute: telegram_queue_config (SERVER_SCOPE)
 * Stored per customer
 */
export const CONFIG_SCHEMA = {
  enabled: 'boolean',
  priorityRules: {
    deviceProfiles: 'object', // { "3F_MEDIDOR": 2, "HIDROMETRO": 3 }
    deviceOverrides: 'object', // { "device-uuid": 1 }
    globalDefault: 'number'    // 1-4
  },
  rateControl: {
    batchSize: 'number',                    // Messages per batch (default: 5)
    delayBetweenBatchesSeconds: 'number',   // Seconds between batches (default: 60)
    maxRetries: 'number',                   // Max retry attempts (default: 3)
    retryBackoff: 'string'                  // "exponential" or "linear"
  },
  telegram: {
    botToken: 'string',   // Telegram bot token
    chatId: 'string'      // Telegram chat ID
  }
};

/**
 * Storage Schema Reference
 *
 * ThingsBoard Attributes (SERVER_SCOPE) per customer:
 *
 * Queue Entries:
 * - telegram_queue_entry_{queueId} - Individual message entries
 *
 * Priority Indexes:
 * - telegram_queue_index_priority_1 - Array of queueIds for priority 1 (Critical)
 * - telegram_queue_index_priority_2 - Array of queueIds for priority 2 (High)
 * - telegram_queue_index_priority_3 - Array of queueIds for priority 3 (Medium)
 * - telegram_queue_index_priority_4 - Array of queueIds for priority 4 (Low)
 *
 * Rate Limiting:
 * - telegram_queue_ratelimit - { lastDispatchAt: timestamp }
 *
 * Configuration:
 * - telegram_queue_config - Customer configuration (see CONFIG_SCHEMA)
 */
export const STORAGE_SCHEMA = {
  queueEntry: {
    attributeKey: 'telegram_queue_entry_{queueId}',
    structure: {
      queueId: 'string',
      customerId: 'string',
      deviceId: 'string',
      deviceProfile: 'string',
      deviceName: 'string',
      priority: 'number',      // 1-4
      text: 'string',
      status: 'string',        // PENDING, SENDING, SENT, FAILED, RETRY
      retryCount: 'number',
      maxRetries: 'number',
      createdAt: 'number',     // timestamp
      sentAt: 'number|null',   // timestamp
      lastAttemptAt: 'number|null',
      errorMessage: 'string|null',
      prioritySource: 'string' // deviceOverride, deviceProfile, customerGlobal, systemDefault
    }
  },
  priorityIndexes: {
    priority1: 'telegram_queue_index_priority_1', // Array of queueIds
    priority2: 'telegram_queue_index_priority_2',
    priority3: 'telegram_queue_index_priority_3',
    priority4: 'telegram_queue_index_priority_4'
  },
  rateLimit: {
    attributeKey: 'telegram_queue_ratelimit',
    structure: {
      lastDispatchAt: 'number' // timestamp
    }
  },
  config: {
    attributeKey: 'telegram_queue_config',
    structure: CONFIG_SCHEMA
  }
};

/**
 * Priority Levels Reference
 */
export const PRIORITY_LEVELS = {
  CRITICAL: 1,  // Infrastructure devices (ENTRADA, RELOGIO, TRAFO, SUBESTACAO)
  HIGH: 2,      // Meters (3F_MEDIDOR, HIDROMETRO)
  MEDIUM: 3,    // Default fallback
  LOW: 4        // Thermostats (TERMOSTATO)
};

/**
 * Queue Status Values Reference
 */
export const QUEUE_STATUS = {
  PENDING: 'PENDING',   // Waiting in queue
  SENDING: 'SENDING',   // Currently being sent
  SENT: 'SENT',         // Successfully sent
  FAILED: 'FAILED',     // Failed after max retries
  RETRY: 'RETRY'        // Failed but will retry
};

/**
 * Default Configuration
 */
export const DEFAULT_CONFIG = {
  enabled: true,
  priorityRules: {
    deviceProfiles: {
      // Infrastructure (Critical)
      'ENTRADA': 1,
      'RELOGIO': 1,
      'TRAFO': 1,
      'SUBESTACAO': 1,

      // Meters (High)
      '3F_MEDIDOR': 2,
      'HIDROMETRO': 2,

      // Thermostats (Low)
      'TERMOSTATO': 4
    },
    deviceOverrides: {},
    globalDefault: 3
  },
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

/**
 * Rule Chain Flow Descriptions
 */
export const FLOWS = {
  enqueue: {
    name: 'FLOW 1: Enqueue Message',
    trigger: 'Event-driven (alarm/notification)',
    purpose: 'Capture and queue incoming messages with priority',
    nodes: 7,
    scripts: ['enqueue-normalize.js', 'enqueue-priority.js']
  },
  dispatcher: {
    name: 'FLOW 2: Dispatcher (v9 - Zombie Killer)',
    trigger: 'Timer-based (every 60 seconds)',
    purpose: 'Process queue and send messages to Telegram - ALL customers with dynamic routing',
    nodes: 22,
    scripts: ['dispatch-rate-limit.js', 'dispatch-parse-v9.js', 'dispatch-mark-status.js']
  },
  monitor: {
    name: 'FLOW 3: Monitor',
    trigger: 'Timer-based (every 300 seconds)',
    purpose: 'Collect queue metrics for dashboard monitoring - ALL customers',
    nodes: 8,
    scripts: ['monitor-calculate.js']
  }
};

/**
 * Version information
 */
export const VERSION = '2.2.0';
export const RFC = 'RFC-0135';

/**
 * Documentation Links
 */
export const DOCS = {
  mainReadme: '/src/thingsboard/alarm-queue-setup/README.md',
  technicalDetails: '/src/thingsboard/alarm-queue-setup/rule-chain/README.md',
  nodeConfiguration: '/src/thingsboard/alarm-queue-setup/rule-chain/helpers/node-config-examples.md',
  rfc: '/src/thingsboard/alarm-queue-setup/docs/RFC-0135-TelegramNotificationQueue.md'
};

// Note: This module does not export executable functions.
// It provides script templates and configuration references for ThingsBoard Rule Chains.
// See README.md for complete setup instructions.
