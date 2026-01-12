# RFC-0135 v2.0: Rule Chain Node Configuration Examples

This guide provides **exact configuration** for each node type in the Telegram Queue Rule Chains.

---

## 🔧 Enqueue Rule Chain Configuration

### Node 1: Transformation - Build Message Payload

**Node Type:** `Transformation Script`
**Purpose:** Initial message formatting from alarm/telemetry
**Script:**

```javascript
var deviceName = msg.deviceName || metadata.deviceName || "Unknown";
var alarmType = msg.alarmType || msg.type || "Alert";
var severity = metadata.ss_severity || "INFO";

var text = "⚠️ " + severity + " - " + deviceName;
text += "\n" + alarmType;
text += "\nTime: " + new Date().toLocaleString();

return {
  msg: { text: text },
  metadata: {
    deviceType: msg.deviceType || metadata.deviceType,
    deviceName: deviceName,
    deviceId: metadata.deviceId,
    customerId: metadata.customerId,
    ts: Date.now().toString()
  },
  msgType: "POST_TELEMETRY_REQUEST"
};
```

**Connections:**
- Success → Node 2 (Normalize Payload)

---

### Node 2: Script - Normalize Payload

**Node Type:** `Script Transformation`
**Purpose:** Generate UUID and structure entry
**Script:** Copy from [`scripts/enqueue-normalize.js`](../scripts/enqueue-normalize.js)

**Connections:**
- Success → Node 3 (Enrichment: Get Config)

---

### Node 3: Enrichment - Get Queue Config

**Node Type:** `Customer Attributes` (Enrichment)
**Purpose:** Fetch `telegram_queue_config`

**Configuration:**
- Source: Server attributes
- Attribute mapping:
  - `telegram_queue_config` → `telegram_queue_config`

**Connections:**
- Success → Node 4 (Resolve Priority)
- Failure → Log Error Node

---

### Node 4: Script - Resolve Priority

**Node Type:** `Script Transformation`
**Purpose:** Apply priority cascade rules
**Script:** Copy from [`scripts/enqueue-priority.js`](../scripts/enqueue-priority.js)

**Connections:**
- Success → Node 5 (Switch: Check Enabled)

---

### Node 5: Switch - Check If Enabled

**Node Type:** `Switch`
**Purpose:** Filter based on queue enabled flag

**Configuration:**
```javascript
return msg.enabled === true;
```

**Connections:**
- True → Node 6 (Save Entry)
- False → Log (Queue Disabled)

---

### Node 6: Save Attributes - Save Queue Entry

**Node Type:** `Save Attributes`
**Purpose:** Persist entry and update priority index

**Configuration:**
- Entity: Customer (from metadata.customerId)
- Scope: SERVER_SCOPE
- Attributes to save:
  ```javascript
  {
    "telegram_queue_entry_${msg.entry.queueId}": "${JSON.stringify(msg.entry)}",
    "telegram_queue_index_priority_${msg.priority}": "${concatenateArrays(metadata['telegram_queue_index_priority_' + msg.priority], [msg.entry.queueId])}"
  }
  ```

**Note:** Use a preceding script to prepare the index update:

```javascript
// Helper script before Save Attributes
var entry = msg.entry;
var priority = entry.priority;

// Get existing index
var indexKey = 'telegram_queue_index_priority_' + priority;
var existingIndex = metadata[indexKey] || [];

// Parse if string
if (typeof existingIndex === 'string') {
  try {
    existingIndex = JSON.parse(existingIndex);
  } catch (e) {
    existingIndex = [];
  }
}

// Add new entry
existingIndex.push(entry.queueId);

// Prepare attributes
var attributes = {};
attributes['telegram_queue_entry_' + entry.queueId] = JSON.stringify(entry);
attributes[indexKey] = JSON.stringify(existingIndex);

return {
  msg: {
    attributes: attributes,
    customerId: entry.customerId
  },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**Connections:**
- Success → Log Success
- Failure → Log Error

---

## 🚀 Dispatcher Rule Chain Configuration

### Node 1: Generator - 60s Trigger

**Node Type:** `Generator`
**Purpose:** Schedule dispatcher execution

**Configuration:**
- Message generation period: 60 seconds
- Message originator: `telegram-queue-dispatcher`
- Periodic message:
  ```json
  {}
  ```

**Connections:**
- Output → Node 2 (Enrichment: Get All Config)

---

### Node 2: Enrichment - Get Config, Indexes, Rate Limit

**Node Type:** `Customer Attributes` (Enrichment)

**Configuration:**
- Source: Server attributes
- Attribute mapping:
  - `telegram_queue_config` → `telegram_queue_config`
  - `telegram_queue_ratelimit` → `telegram_queue_ratelimit`
  - `telegram_queue_index_priority_1` → `telegram_queue_index_priority_1`
  - `telegram_queue_index_priority_2` → `telegram_queue_index_priority_2`
  - `telegram_queue_index_priority_3` → `telegram_queue_index_priority_3`
  - `telegram_queue_index_priority_4` → `telegram_queue_index_priority_4`

**Note:** Use metadata.customerId from generator or set a default customer ID in generator config.

**Connections:**
- Success → Node 3 (Check Rate Limit)
- Failure → Log Error

---

### Node 3: Script - Check Rate Limit & Build Batch

**Node Type:** `Script Transformation`
**Purpose:** Rate limit check and batch extraction
**Script:** Copy from [`scripts/dispatch-rate-limit.js`](../scripts/dispatch-rate-limit.js)

**Connections:**
- Success → Node 4 (Switch: Rate Limited?)

---

### Node 4: Switch - Check Rate Limited

**Node Type:** `Switch`

**Configuration:**
```javascript
return msg.rateLimited === false && msg.emptyQueue === false;
```

**Connections:**
- True → Node 5 (Split Array)
- False → Log (Rate Limited or Empty)

---

### Node 5: Split Array - Split Batch into Individual Messages

**Node Type:** `Split Array Msg`

**Configuration:**
- Array field: `msg.batchIds`
- Output field: `queueId`

**Connections:**
- Split → Node 6 (Enrichment: Get Entry)

---

### Node 6: Enrichment - Get Queue Entry by ID

**Node Type:** `Customer Attributes` (Enrichment)

**Configuration:**
- Source: Server attributes
- Attribute mapping (dynamic):
  - `telegram_queue_entry_${queueId}` → `queueEntry`

**Note:** Use preceding script to build dynamic attribute key:

```javascript
var queueId = msg;
var attributeKey = 'telegram_queue_entry_' + queueId;

return {
  msg: {
    queueId: queueId,
    attributeKey: attributeKey
  },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**Connections:**
- Success → Node 7 (REST API: Send to Telegram)
- Not Found → Log (Entry Missing)

---

### Node 7: REST API Call - Send to Telegram

**Node Type:** `REST API Call`

**Configuration:**
- URL template:
  ```
  https://api.telegram.org/bot${metadata.telegram_queue_config.telegram.botToken}/sendMessage
  ```
- Request method: POST
- Headers:
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- Body template:
  ```json
  {
    "chat_id": "${metadata.telegram_queue_config.telegram.chatId}",
    "text": "${msg.entry.payload.text}",
    "parse_mode": "HTML"
  }
  ```

**Connections:**
- Success (200-299) → Node 8 (Mark Success)
- Client Error (400-499) → Node 9 (Mark Failed)
- Server Error (500-599) → Node 10 (Mark Retry)
- Timeout → Node 10 (Mark Retry)

---

### Node 8: Script - Mark Status (Success)

**Purpose:** Handle successful send
**Script:** Copy from [`scripts/dispatch-mark-status.js`](../scripts/dispatch-mark-status.js)

Set `metadata.httpStatus = 200` before this script.

**Connections:**
- Success → Node 11 (Save Updated Entry)

---

### Node 9: Script - Mark Status (Failed)

**Purpose:** Handle permanent failure
**Script:** Same as Node 8, but set `metadata.httpStatus = 400` (or actual status)

**Connections:**
- Success → Node 11 (Save Updated Entry)

---

### Node 10: Script - Mark Status (Retry)

**Purpose:** Handle retryable error
**Script:** Same as Node 8, but set `metadata.httpStatus = 500` (or actual status)

**Connections:**
- Success → Node 11 (Save Updated Entry)

---

### Node 11: Save Attributes - Update Entry & Remove from Index

**Node Type:** `Save Attributes` + Script combo

**First, preceding script to prepare removal:**

```javascript
var entry = msg.entry;
var needsIndexUpdate = (entry.status === 'SENT' || entry.status === 'FAILED');

if (needsIndexUpdate) {
  var priority = entry.priority;
  var indexKey = 'telegram_queue_index_priority_' + priority;
  var existingIndex = metadata[indexKey] || [];

  // Parse if string
  if (typeof existingIndex === 'string') {
    try {
      existingIndex = JSON.parse(existingIndex);
    } catch (e) {
      existingIndex = [];
    }
  }

  // Remove this queue ID
  var newIndex = [];
  for (var i = 0; i < existingIndex.length; i++) {
    if (existingIndex[i] !== entry.queueId) {
      newIndex.push(existingIndex[i]);
    }
  }

  // Prepare attributes
  var attributes = {};
  attributes['telegram_queue_entry_' + entry.queueId] = JSON.stringify(entry);
  attributes[indexKey] = JSON.stringify(newIndex);

  return {
    msg: { attributes: attributes },
    metadata: metadata,
    msgType: 'POST_ATTRIBUTES_REQUEST'
  };
} else {
  // Just update entry
  var attributes = {};
  attributes['telegram_queue_entry_' + entry.queueId] = JSON.stringify(entry);

  return {
    msg: { attributes: attributes },
    metadata: metadata,
    msgType: 'POST_ATTRIBUTES_REQUEST'
  };
}
```

**Connections:**
- Success → Node 12 (Update Rate Limit)

---

### Node 12: Save Attributes - Update Rate Limit State

**Node Type:** `Save Attributes`

**Preceding script:**

```javascript
var rateLimitState = metadata.telegram_queue_ratelimit || {};
rateLimitState.lastDispatchAt = Date.now();
rateLimitState.batchCount = (rateLimitState.batchCount || 0) + 1;

var attributes = {};
attributes['telegram_queue_ratelimit'] = JSON.stringify(rateLimitState);

return {
  msg: { attributes: attributes },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**Connections:**
- Success → Log Success

---

## 📊 Monitor Rule Chain Configuration

### Node 1: Generator - 300s Trigger

**Node Type:** `Generator`

**Configuration:**
- Period: 300 seconds (5 minutes)
- Message: `{}`

**Connections:**
- Output → Node 2

---

### Node 2: Enrichment - Get Indexes & State

**Node Type:** `Customer Attributes` (Enrichment)

**Configuration:** Same as Dispatcher Node 2

**Connections:**
- Success → Node 3

---

### Node 3: Script - Calculate Metrics

**Node Type:** `Script Transformation`
**Script:** Copy from [`scripts/monitor-calculate.js`](../scripts/monitor-calculate.js)

**Connections:**
- Success → Node 4

---

### Node 4: Save Telemetry - Virtual Device

**Node Type:** `Save Telemetry`

**Configuration:**
- Device: `telegram-queue-monitor` (create virtual device first)
- Telemetry: Use output from Node 3

**Connections:**
- Success → Log Success

---

## 🎯 Quick Setup Checklist

1. ✅ Create service account `telegram-queue-service@myio.com.br`
2. ✅ Configure `telegram_queue_config` customer attribute
3. ✅ Create virtual device `telegram-queue-monitor`
4. ✅ Import Enqueue Rule Chain (build from nodes above)
5. ✅ Import Dispatcher Rule Chain
6. ✅ Import Monitor Rule Chain
7. ✅ Connect alarm rules to Enqueue chain
8. ✅ Test with single alarm
9. ✅ Monitor telemetry on dashboard

---

**RFC-0135 v2.0** | Node Configuration Guide | © 2026 MYIO Platform
