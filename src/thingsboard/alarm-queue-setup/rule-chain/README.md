# RFC-0135: Telegram Queue - Rule Chain Native Implementation

**Version:** 2.0.0

---

## 🚨 Critical Understanding: ThingsBoard Script Node Limitations

ThingsBoard Rule Chain **Script/Function Nodes are NOT JavaScript environments**. They run in a **strictly synchronous, sandboxed Java context** with the following constraints:

### ❌ What Does NOT Work
- ❌ **No `async/await`** - Scripts must return immediately, no Promise support
- ❌ **No `fetch` API** - Cannot make HTTP requests from scripts
- ❌ **No `window` object** - Backend environment, not browser
- ❌ **No persistent variables** - Module-level variables reset on each execution
- ❌ **No `import/require`** - No module loading in scripts
- ❌ **No external libraries** - Cannot use npm packages in scripts

### ✅ What DOES Work
- ✅ **Pure synchronous logic** - Math, string manipulation, object transformation
- ✅ **`metadata` and `msg` objects** - Available as input to every script
- ✅ **`return` statements** - Must return `{msg, metadata, msgType}` object
- ✅ **Visual node connections** - Connect nodes to pass data between them
- ✅ **REST API Call Nodes** - For HTTP requests (authentication, Telegram API)
- ✅ **Enrichment Nodes** - For fetching attributes from storage
- ✅ **Save Attributes Nodes** - For persisting data

---

## 🎯 Solution: Visual Node-Based Architecture

Instead of monolithic async functions, we **decompose the logic into a pipeline of visual nodes** where:
1. **REST API Nodes** handle all HTTP calls
2. **Enrichment Nodes** fetch data from storage
3. **Script Nodes** contain ONLY pure synchronous transformation logic
4. **Save Attributes Nodes** persist state
5. **Rule Node connections** orchestrate the flow

---

## 📊 Architecture Flows

### Flow 1: Enqueue (Event-Driven)

```
[Transformation: Build Message]
         ↓
[Script: Generate UUID & Normalize] ← Pure sync logic
         ↓
[Enrichment: Get Priority Config] ← Fetches telegram_queue_config
         ↓
[Script: Resolve Priority] ← Pure sync cascade logic
         ↓
[Switch: Check If Enabled]
         ↓ (enabled=true)
[Save Attributes: Save Entry & Update Index] ← Persists queue entry
         ↓
[Log: Success]
```

### Flow 2: Dispatcher (Scheduled - Every 60s)

```
[Generator: 60s Trigger]
         ↓
[Enrichment: Get Config & Rate Limit State]
         ↓
[Script: Check Rate Limit & Build Batch] ← Sync math only
         ↓
    [Switch: Can Send?]
         ├─ NO → [End]
         └─ YES ↓
[Script: Extract Batch IDs] ← Sync array slicing
         ↓
[Enrichment: Get Queue Entries by IDs]
         ↓
[Split Array Msg] ← Splits into individual messages
         ↓ (for each entry)
[REST API: POST to Telegram] ← https://api.telegram.org/bot.../sendMessage
         ↓
    [Switch: HTTP Status]
         ├─ 200 OK → [Script: Mark SENT] → [Save Attributes: Update Entry]
         ├─ 429/5xx → [Script: Increment Retry] → [Save Attributes: Update Entry]
         └─ 400/401 → [Script: Mark FAILED] → [Save Attributes: Update Entry]
         ↓
[Save Attributes: Update Rate Limit State]
```

### Flow 3: Monitor (Scheduled - Every 5min)

```
[Generator: 300s Trigger]
         ↓
[Enrichment: Get All Priority Indexes]
         ↓
[Script: Calculate Queue Depths] ← Sync array.length operations
         ↓
[Enrichment: Get Sample Entries for Stats]
         ↓
[Script: Calculate Metrics] ← Sync aggregation logic
         ↓
[Transformation: Format Telemetry]
         ↓
[Save Telemetry: Virtual Device "telegram-queue-monitor"]
```

---

## 📝 Script Node Templates

### 1. Enqueue: Generate UUID & Normalize

**Purpose:** Pure synchronous data transformation
**Input:** `msg.msg.text`, `metadata.deviceId`, etc.
**Output:** Normalized payload structure

```javascript
// UUID Generator (simple, collision-safe for queue use)
function generateUUID() {
  var timestamp = Date.now().toString(36);
  var random = Math.random().toString(36).substring(2, 15);
  return timestamp + '-' + random;
}

// Main logic
var text = msg.msg && msg.msg.text ? msg.msg.text : '';
var deviceId = metadata.deviceId || 'unknown';
var customerId = metadata.customerId || 'unknown';
var deviceProfile = metadata.deviceType || msg.deviceType || 'unknown';
var queueId = generateUUID();

return {
  msg: {
    queueId: queueId,
    deviceId: deviceId,
    customerId: customerId,
    deviceProfile: deviceProfile,
    text: text,
    createdAt: Date.now()
  },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

### 2. Enqueue: Resolve Priority

**Purpose:** Pure synchronous priority cascade
**Input:** `msg.deviceProfile`, `metadata.telegram_queue_config` (from Enrichment Node)
**Output:** Priority number (1-4)

```javascript
// Priority resolution cascade
var config = metadata.telegram_queue_config || {};
var priorityRules = config.priorityRules || {};
var deviceOverrides = priorityRules.deviceOverrides || {};
var deviceProfiles = priorityRules.deviceProfiles || {};
var globalDefault = priorityRules.globalDefault || 3;

var deviceId = msg.deviceId;
var deviceProfile = (msg.deviceProfile || '').toUpperCase();
var priority = 3; // System fallback
var source = 'systemGlobal';

// Cascade: 1. Device Override
if (deviceOverrides[deviceId]) {
  priority = deviceOverrides[deviceId];
  source = 'deviceOverride';
}
// 2. Device Profile Rule
else if (deviceProfiles[deviceProfile]) {
  priority = deviceProfiles[deviceProfile];
  source = 'deviceProfile';
}
// 3. Customer Global Default
else if (globalDefault) {
  priority = globalDefault;
  source = 'customerGlobal';
}

// Default profile mappings (if no config exists)
if (source === 'systemGlobal') {
  if (deviceProfile.indexOf('ENTRADA') >= 0 ||
      deviceProfile.indexOf('RELOGIO') >= 0 ||
      deviceProfile.indexOf('TRAFO') >= 0 ||
      deviceProfile.indexOf('SUBESTACAO') >= 0) {
    priority = 1; // Critical
  } else if (deviceProfile === '3F_MEDIDOR' ||
             deviceProfile.indexOf('HIDROMETRO') >= 0) {
    priority = 2; // High
  } else if (deviceProfile.indexOf('TERMOSTATO') >= 0) {
    priority = 4; // Low
  }
}

return {
  msg: {
    queueId: msg.queueId,
    customerId: msg.customerId,
    deviceId: msg.deviceId,
    deviceProfile: msg.deviceProfile,
    priority: priority,
    prioritySource: source,
    payload: {
      text: msg.text
    },
    status: 'PENDING',
    retryCount: 0,
    maxRetries: 3,
    createdAt: msg.createdAt,
    lastAttemptAt: null
  },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

### 3. Dispatcher: Check Rate Limit & Build Batch

**Purpose:** Synchronous rate limit check and batch ID extraction
**Input:** `metadata.telegram_queue_ratelimit`, `metadata.telegram_queue_config`, `metadata.telegram_queue_index_priority_X`
**Output:** Batch of queue IDs to process OR rate-limited signal

```javascript
// Get config
var config = metadata.telegram_queue_config || {};
var rateControl = config.rateControl || {};
var batchSize = rateControl.batchSize || 5;
var delayBetweenBatchesSeconds = rateControl.delayBetweenBatchesSeconds || 60;

// Get rate limit state
var rateLimitState = metadata.telegram_queue_ratelimit || {};
var lastDispatchAt = rateLimitState.lastDispatchAt || 0;

// Check rate limit (synchronous math)
var now = Date.now();
var timeSinceLastMs = now - lastDispatchAt;
var requiredDelayMs = delayBetweenBatchesSeconds * 1000;

if (timeSinceLastMs < requiredDelayMs) {
  // Rate limited - exit early
  var waitTimeSeconds = Math.ceil((requiredDelayMs - timeSinceLastMs) / 1000);
  return {
    msg: {
      rateLimited: true,
      waitTimeSeconds: waitTimeSeconds
    },
    metadata: metadata,
    msgType: 'POST_TELEMETRY_REQUEST'
  };
}

// Not rate limited - build batch from priority indexes
var batch = [];

// Priority 1 (Critical)
var p1 = metadata.telegram_queue_index_priority_1 || [];
if (Array.isArray(p1)) {
  for (var i = 0; i < p1.length && batch.length < batchSize; i++) {
    batch.push(p1[i]);
  }
}

// Priority 2 (High)
var p2 = metadata.telegram_queue_index_priority_2 || [];
if (Array.isArray(p2)) {
  for (var i = 0; i < p2.length && batch.length < batchSize; i++) {
    batch.push(p2[i]);
  }
}

// Priority 3 (Medium)
var p3 = metadata.telegram_queue_index_priority_3 || [];
if (Array.isArray(p3)) {
  for (var i = 0; i < p3.length && batch.length < batchSize; i++) {
    batch.push(p3[i]);
  }
}

// Priority 4 (Low)
var p4 = metadata.telegram_queue_index_priority_4 || [];
if (Array.isArray(p4)) {
  for (var i = 0; i < p4.length && batch.length < batchSize; i++) {
    batch.push(p4[i]);
  }
}

return {
  msg: {
    rateLimited: false,
    batchIds: batch,
    batchSize: batch.length
  },
  metadata: metadata,
  msgType: 'POST_TELEMETRY_REQUEST'
};
```

### 4. Dispatcher: Mark Entry Status

**Purpose:** Update entry status based on Telegram API response
**Input:** `msg` (queue entry), `metadata.httpStatus` (from REST API Node response)
**Output:** Updated entry object

```javascript
var entry = msg;
var httpStatus = metadata.httpStatus || 0;
var now = Date.now();

// Handle response status
if (httpStatus === 200) {
  // Success
  entry.status = 'SENT';
  entry.sentAt = now;
} else if (httpStatus === 429 || (httpStatus >= 500 && httpStatus < 600)) {
  // Retryable error
  entry.retryCount = (entry.retryCount || 0) + 1;
  entry.lastAttemptAt = now;

  if (entry.retryCount >= entry.maxRetries) {
    entry.status = 'FAILED';
    entry.errorMessage = 'Max retries exceeded';
  } else {
    entry.status = 'RETRY';
  }
} else if (httpStatus >= 400 && httpStatus < 500) {
  // Permanent failure
  entry.status = 'FAILED';
  entry.errorMessage = 'HTTP ' + httpStatus + ' - Client error';
} else {
  // Network error
  entry.retryCount = (entry.retryCount || 0) + 1;
  entry.lastAttemptAt = now;

  if (entry.retryCount >= entry.maxRetries) {
    entry.status = 'FAILED';
    entry.errorMessage = 'Network error - max retries exceeded';
  } else {
    entry.status = 'RETRY';
  }
}

return {
  msg: entry,
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

### 5. Monitor: Calculate Queue Depths

**Purpose:** Synchronous array length calculations
**Input:** `metadata.telegram_queue_index_priority_X`
**Output:** Queue depth metrics

```javascript
var p1 = metadata.telegram_queue_index_priority_1 || [];
var p2 = metadata.telegram_queue_index_priority_2 || [];
var p3 = metadata.telegram_queue_index_priority_3 || [];
var p4 = metadata.telegram_queue_index_priority_4 || [];

var depth1 = Array.isArray(p1) ? p1.length : 0;
var depth2 = Array.isArray(p2) ? p2.length : 0;
var depth3 = Array.isArray(p3) ? p3.length : 0;
var depth4 = Array.isArray(p4) ? p4.length : 0;

var totalDepth = depth1 + depth2 + depth3 + depth4;

// Get rate limit state
var rateLimitState = metadata.telegram_queue_ratelimit || {};
var lastDispatchAt = rateLimitState.lastDispatchAt || 0;
var now = Date.now();
var timeSinceLastSeconds = lastDispatchAt > 0 ? Math.floor((now - lastDispatchAt) / 1000) : 0;

// Get config for wait time calc
var config = metadata.telegram_queue_config || {};
var rateControl = config.rateControl || {};
var delaySeconds = rateControl.delayBetweenBatchesSeconds || 60;

var timeSinceLastMs = now - lastDispatchAt;
var requiredDelayMs = delaySeconds * 1000;
var canSendNow = timeSinceLastMs >= requiredDelayMs ? 1 : 0;
var waitTimeSeconds = canSendNow === 1 ? 0 : Math.ceil((requiredDelayMs - timeSinceLastMs) / 1000);

return {
  msg: {
    queue_depth_priority_1: depth1,
    queue_depth_priority_2: depth2,
    queue_depth_priority_3: depth3,
    queue_depth_priority_4: depth4,
    total_queue_depth: totalDepth,
    time_since_last_dispatch_seconds: timeSinceLastSeconds,
    can_send_now: canSendNow,
    wait_time_seconds: waitTimeSeconds,
    timestamp: now
  },
  metadata: metadata,
  msgType: 'POST_TELEMETRY_REQUEST'
};
```

---

## 🔧 Rule Chain Configuration Steps

### Step 1: Create Service Account

ThingsBoard User:
- Username: `telegram-queue-service@myio.com.br`
- Password: (securely stored)
- Role: CUSTOMER_USER with permissions for customer attributes

### Step 2: Configure Customer Attributes

Add `telegram_queue_config` (SERVER_SCOPE):
```json
{
  "enabled": true,
  "priorityRules": {
    "deviceProfiles": {
      "ENTRADA": 1,
      "3F_MEDIDOR": 2,
      "HIDROMETRO": 2,
      "TERMOSTATO": 4
    },
    "deviceOverrides": {},
    "globalDefault": 3
  },
  "rateControl": {
    "batchSize": 5,
    "delayBetweenBatchesSeconds": 60,
    "maxRetries": 3,
    "retryBackoff": "exponential"
  },
  "telegram": {
    "botToken": "YOUR_BOT_TOKEN",
    "chatId": "YOUR_CHAT_ID"
  }
}
```

### Step 3: Build Rule Chains (Visual Editor)

See `flows/` directory for JSON exports of complete Rule Chains ready to import.

---

## 📦 Directory Structure

```
rule-chain/
├── README.md (this file)
├── scripts/
│   ├── enqueue-normalize.js
│   ├── enqueue-priority.js
│   ├── dispatch-rate-limit.js
│   ├── dispatch-mark-status.js
│   └── monitor-calculate.js
├── flows/
│   ├── 01-enqueue-chain.json
│   ├── 02-dispatch-chain.json
│   └── 03-monitor-chain.json
└── helpers/
    └── node-config-examples.md
```

---

## ✅ Key Advantages

- ✅ **Native ThingsBoard integration** - No async/fetch issues
- ✅ **Debuggable** - See data flow between nodes in real-time
- ✅ **Maintainable** - Each node has a single responsibility
- ✅ **Scalable** - ThingsBoard handles parallelization automatically
- ✅ **Monitorable** - Rule Chain statistics built-in
- ✅ **Testable** - Can test individual nodes in isolation

---

**RFC-0135 v2.0.0** | Rule Chain Native | © 2026 MYIO Platform
