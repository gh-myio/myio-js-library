# RFC-0135: Telegram Notification Queue for ThingsBoard

A **visual node-based queue system** for sending prioritized, rate-limited Telegram notifications from ThingsBoard Rule Chains.

**Version:** 2.0.0 (Rule Chain Native Implementation)

---

## 🎯 What This System Does

Imagine you have hundreds of devices (energy meters, water sensors, temperature controls) generating alarms in ThingsBoard. Instead of sending each alarm immediately to Telegram (which would hit API rate limits and spam your chat), this system:

1. **Queues** messages with priority levels (Critical, High, Medium, Low)
2. **Processes** them in batches (e.g., 5 messages every 60 seconds)
3. **Retries** failed sends automatically with smart backoff
4. **Monitors** queue health with real-time metrics

All using **ThingsBoard's visual Rule Chain editor** - no external databases or servers needed!

---

## 🏗️ Architecture Overview

### The Big Picture

```
📱 DEVICE ALARMS
        ↓
┌─────────────────────────┐
│ 1. ENQUEUE FLOW         │ ← Captures each alarm and adds to priority queue
│    (Event-Driven)        │
└─────────────────────────┘
        ↓ (Stores in ThingsBoard Attributes)
        ↓
┌─────────────────────────┐
│ 2. DISPATCHER FLOW      │ ← Processes queue every 60s, sends to Telegram
│    (Every 60 seconds)    │
└─────────────────────────┘
        ↓
┌─────────────────────────┐
│ 3. MONITOR FLOW         │ ← Collects metrics every 5 minutes
│    (Every 5 minutes)     │
└─────────────────────────┘
        ↓
📊 DASHBOARD METRICS
```

### Why Three Separate Flows?

- **Enqueue**: Runs instantly when an alarm happens (event-driven)
- **Dispatcher**: Runs on a timer to batch-send messages (scheduled)
- **Monitor**: Runs on a timer to track queue health (scheduled)

They work independently but share data through **ThingsBoard Attributes** (think of it as a shared database).

---

## 🚀 Quick Start Guide

### Step 1: Understand ThingsBoard Script Node Limitations

**CRITICAL:** ThingsBoard Script Nodes are **NOT** JavaScript environments. They:

- ❌ **Cannot use `async/await`** - Must return immediately
- ❌ **Cannot use `fetch`** - No HTTP requests in scripts
- ❌ **Cannot use external libraries** - No `import` or `require`
- ✅ **CAN do pure logic** - Math, string manipulation, data transformation

**Solution:** We use **visual nodes** for I/O (REST API Nodes, Enrichment Nodes) and **scripts for logic only**.

---

### Step 2: Configure ThingsBoard

#### 2.1 Create Service Account

ThingsBoard User → Add new user:
- **Username**: `telegram-queue-service@myio.com.br`
- **Password**: (set securely - write it down!)
- **Role**: Customer User
- **Permissions**: Read/write customer attributes

#### 2.2 Add Customer Configuration Attribute

Go to: **Customers** → Select your customer → **Attributes** tab → **SERVER_SCOPE** → Add:

**Attribute Name**: `telegram_queue_config`

**Value** (JSON):
```json
{
  "enabled": true,
  "priorityRules": {
    "deviceProfiles": {
      "ENTRADA": 1,
      "RELOGIO": 1,
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
    "botToken": "YOUR_BOT_TOKEN_FROM_BOTFATHER",
    "chatId": "YOUR_CHAT_ID"
  }
}
```

**How to get Telegram credentials:**
1. Talk to **@BotFather** on Telegram, create a bot, get `botToken`
2. Add bot to your group/channel
3. Get `chatId` using this URL: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`

#### 2.3 Create Virtual Device for Monitoring

**Devices** → **Add Device**:
- **Name**: `telegram-queue-monitor`
- **Type**: Generic
- **Purpose**: Stores queue metrics for dashboards

---

### Step 3: Build the Three Rule Chains

We'll build these step-by-step. Each uses **visual nodes** (drag-and-drop) and **script snippets** (copy-paste from `/rule-chain/scripts/`).

---

## 📥 FLOW 1: Enqueue (Event-Driven)

**Purpose:** When a device alarm fires, capture it and add to the priority queue.

### Visual Node Flow

```
[Alarm Trigger]
      ↓
[Filter: Only Critical Alarms] (optional)
      ↓
[Script 1: Build Message Text]
      ↓
[Script 2: Generate UUID & Normalize]
      ↓
[Enrichment: Get telegram_queue_config]
      ↓
[Script 3: Resolve Priority]
      ↓
[Switch: Check enabled=true]
      ↓ (if true)
[Script 4: Prepare Save]
      ↓
[Save Attributes: Save Entry + Update Index]
      ↓
[Log: Success]
```

### Step-by-Step Node Configuration

#### Node 1.1: Script - Build Message Text

**Purpose:** Format the alarm into human-readable Telegram text

**Script:**
```javascript
var deviceName = msg.deviceName || metadata.deviceName || "Unknown Device";
var alarmType = msg.alarmType || msg.type || "Alert";
var severity = metadata.ss_severity || "INFO";

// Build message
var text = "⚠️ " + severity + " - " + deviceName;
text += "\n" + alarmType;
text += "\nTime: " + new Date().toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo'});

return {
  msg: { text: text },
  metadata: {
    deviceType: msg.deviceType || metadata.deviceType || 'unknown',
    deviceName: deviceName,
    deviceId: metadata.deviceId,
    customerId: metadata.customerId
  },
  msgType: "POST_ATTRIBUTES_REQUEST"
};
```

**Connect to:** Node 1.2

---

#### Node 1.2: Script - Generate UUID & Normalize

**Purpose:** Create unique ID and structure the queue entry

**Script:** Copy entire content from [`rule-chain/scripts/enqueue-normalize.js`](rule-chain/scripts/enqueue-normalize.js)

**What it does:**
- Generates UUID like `a1b2c3d4-e5f6-7890...`
- Extracts `deviceId`, `customerId`, `deviceProfile` from metadata
- Creates timestamp
- Returns structured object

**Connect to:** Node 1.3

---

#### Node 1.3: Enrichment - Get Queue Config

**Node Type:** Customer Attributes (Enrichment)

**Configuration:**
- **Source:** Server attributes
- **Fetch these attributes:**
  - `telegram_queue_config` → store as `telegram_queue_config` in metadata

**Purpose:** Loads the configuration you set in Step 2.2 so the next script can use it.

**Connect to:** Node 1.4

---

#### Node 1.4: Script - Resolve Priority

**Purpose:** Decide if this message is Critical (1), High (2), Medium (3), or Low (4)

**Script:** Copy entire content from [`rule-chain/scripts/enqueue-priority.js`](rule-chain/scripts/enqueue-priority.js)

**How priority is decided (cascade):**
1. **Device Override** (highest priority) - Check if `deviceId` is in `deviceOverrides`
2. **Device Profile Rule** - Check if `deviceProfile` (like "ENTRADA") matches `deviceProfiles`
3. **Customer Global Default** - Use customer's `globalDefault`
4. **System Fallback** - Default to 3 (Medium)

**Example:**
- Device: `3F_MEDIDOR` → Priority 2 (High) because config says `"3F_MEDIDOR": 2`
- Device: `ENTRADA` → Priority 1 (Critical) because config says `"ENTRADA": 1`
- Device: `UNKNOWN_TYPE` → Priority 3 (Medium) because no rule matches

**Connect to:** Node 1.5

---

#### Node 1.5: Switch - Check If Enabled

**Node Type:** Switch

**Configuration:**
```javascript
return msg.enabled === true;
```

**Purpose:** Only proceed if `enabled: true` in config. Allows you to pause the queue without deleting Rule Chains.

**Connections:**
- **True** → Node 1.6
- **False** → Log "Queue Disabled"

---

#### Node 1.6: Script - Prepare Save

**Purpose:** Format the entry and index update for ThingsBoard Attributes

**Script:**
```javascript
var entry = msg.entry;
var priority = entry.priority;

// Get existing priority index
var indexKey = 'telegram_queue_index_priority_' + priority;
var existingIndex = metadata[indexKey];

// Parse if it's a JSON string
if (typeof existingIndex === 'string') {
  try {
    existingIndex = JSON.parse(existingIndex);
  } catch (e) {
    existingIndex = [];
  }
}

// Ensure it's an array
if (!Array.isArray(existingIndex)) {
  existingIndex = [];
}

// Add new queue ID to index
existingIndex.push(entry.queueId);

// Prepare attributes to save
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

**What this creates:**
- `telegram_queue_entry_a1b2c3...`: The full message details
- `telegram_queue_index_priority_2`: Array of queue IDs `["a1b2c3...", "e5f6g7..."]`

**Connect to:** Node 1.7

---

#### Node 1.7: Save Attributes

**Node Type:** Save Attributes

**Configuration:**
- **Entity:** Customer (use `${msg.customerId}`)
- **Scope:** SERVER_SCOPE
- **Attributes:** Use output from Node 1.6 (`msg.attributes`)

**Purpose:** Persist the queue entry and update the priority index in ThingsBoard's database.

**Connect to:** Log Success Node

---

## 🚀 FLOW 2: Dispatcher (Every 60 seconds)

**Purpose:** Process the queue, send messages to Telegram, respect rate limits.

### Visual Node Flow

```
[Generator: 60s Timer]
      ↓
[Enrichment: Get Config + Indexes + Rate Limit State]
      ↓
[Script 1: Check Rate Limit & Build Batch]
      ↓
[Switch: Can Send?]
      ├─ NO → [Log: Rate Limited] → [End]
      └─ YES ↓
[Switch: Empty Queue?]
      ├─ YES → [Log: Queue Empty] → [End]
      └─ NO ↓
[Split Array: Split Batch]
      ↓ (for each queue ID)
[Script 2: Build Attribute Key]
      ↓
[Enrichment: Get Queue Entry]
      ↓
[Script 3: Extract Entry Data]
      ↓
[REST API: POST to Telegram]
      ↓
[Switch: HTTP Status]
      ├─ 200 → [Script: Mark SENT]
      ├─ 429/5xx → [Script: Mark RETRY]
      └─ 400/401/403 → [Script: Mark FAILED]
      ↓
[Script 4: Prepare Index Update]
      ↓
[Save Attributes: Update Entry + Remove from Index]
      ↓
[Save Attributes: Update Rate Limit State]
```

### Step-by-Step Node Configuration

#### Node 2.1: Generator - 60s Timer

**Node Type:** Generator

**Configuration:**
- **Period:** 60 seconds
- **Originator:** `telegram-queue-dispatcher`
- **Message:** `{}`
- **Metadata:** Set `customerId` to your customer ID

**Purpose:** Triggers the dispatcher every minute.

**Connect to:** Node 2.2

---

#### Node 2.2: Enrichment - Get Everything

**Node Type:** Customer Attributes (Enrichment)

**Configuration - Fetch these attributes:**
- `telegram_queue_config`
- `telegram_queue_ratelimit`
- `telegram_queue_index_priority_1`
- `telegram_queue_index_priority_2`
- `telegram_queue_index_priority_3`
- `telegram_queue_index_priority_4`

**Purpose:** Load all data needed for rate limiting and batch building.

**Connect to:** Node 2.3

---

#### Node 2.3: Script - Check Rate Limit & Build Batch

**Purpose:** Synchronous math to check if enough time passed, extract batch of queue IDs

**Script:** Copy entire content from [`rule-chain/scripts/dispatch-rate-limit.js`](rule-chain/scripts/dispatch-rate-limit.js)

**What it does:**
1. Parse config → Get `delayBetweenBatchesSeconds` (e.g., 60)
2. Parse rate limit state → Get `lastDispatchAt` timestamp
3. Calculate: `now - lastDispatchAt >= 60 seconds?`
4. **If NO** → Return `{rateLimited: true, waitTimeSeconds: 15}`
5. **If YES** → Build batch from priority indexes (Critical first, then High, Medium, Low)
6. Return `{rateLimited: false, batchIds: ["a1b2c3...", "e5f6g7..."], batchSize: 5}`

**Connect to:** Node 2.4

---

#### Node 2.4: Switch - Can Send?

**Node Type:** Switch

**Configuration:**
```javascript
return msg.rateLimited === false && msg.emptyQueue === false;
```

**Connections:**
- **True** → Node 2.5 (proceed to send)
- **False** → Log "Rate Limited" or "Queue Empty" → End

---

#### Node 2.5: Split Array - Split Batch

**Node Type:** Split Array Msg (under "transformation")

**Configuration:**
- **Array field:** `batchIds`
- **Output field:** `queueId`

**Purpose:** Takes `["id1", "id2", "id3"]` and creates 3 separate messages, one per ID.

**What happens:** If batch has 5 IDs, this node fires 5 times - once for each message.

**Connect to:** Node 2.6

---

#### Node 2.6: Script - Build Attribute Key

**Purpose:** Construct the attribute key name dynamically

**Script:**
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

**Connect to:** Node 2.7

---

#### Node 2.7: Enrichment - Get Queue Entry

**Node Type:** Customer Attributes (Enrichment)

**Configuration:**
- **Attribute:** `${msg.attributeKey}` (dynamic - uses value from previous node)
- **Store as:** `queueEntry` in metadata

**Purpose:** Fetch the full entry details: `{queueId, payload: {text: "..."}, priority: 2, ...}`

**Connect to:** Node 2.8

---

#### Node 2.8: Script - Extract Entry Data

**Purpose:** Parse the entry and prepare for Telegram API

**Script:**
```javascript
var entryJson = metadata.queueEntry;
var entry = {};

// Parse if string
if (typeof entryJson === 'string') {
  try {
    entry = JSON.parse(entryJson);
  } catch (e) {
    return {msg: {error: true}, metadata: metadata, msgType: 'POST_TELEMETRY_REQUEST'};
  }
} else {
  entry = entryJson;
}

// Get Telegram config
var config = metadata.telegram_queue_config;
if (typeof config === 'string') {
  config = JSON.parse(config);
}

return {
  msg: {
    entry: entry,
    telegramText: entry.payload.text,
    botToken: config.telegram.botToken,
    chatId: config.telegram.chatId
  },
  metadata: metadata,
  msgType: 'POST_TELEMETRY_REQUEST'
};
```

**Connect to:** Node 2.9

---

#### Node 2.9: REST API Call - Send to Telegram

**Node Type:** REST API Call

**Configuration:**
- **URL:** `https://api.telegram.org/bot${msg.botToken}/sendMessage`
- **Method:** POST
- **Headers:**
  ```json
  {"Content-Type": "application/json"}
  ```
- **Body:**
  ```json
  {
    "chat_id": "${msg.chatId}",
    "text": "${msg.telegramText}",
    "parse_mode": "HTML"
  }
  ```

**Purpose:** Actually send the message to Telegram!

**Connections (by HTTP status):**
- **Success (200-299)** → Node 2.10a (Mark SENT)
- **Client Error (400-499)** → Node 2.10b (Mark FAILED)
- **Server Error (500-599)** → Node 2.10c (Mark RETRY)
- **Timeout** → Node 2.10c (Mark RETRY)

---

#### Node 2.10: Script - Mark Status (3 versions)

**Purpose:** Update entry status based on Telegram response

**Script:** Copy entire content from [`rule-chain/scripts/dispatch-mark-status.js`](rule-chain/scripts/dispatch-mark-status.js)

**Use 3 copies of this script with different inputs:**

**2.10a (Success path):** Add this script before Node 2.10:
```javascript
// Set HTTP status for success
metadata.httpStatus = 200;
return {msg: msg, metadata: metadata, msgType: msgType};
```

**2.10b (Failed path):** Add this script before Node 2.10:
```javascript
// Set HTTP status for client error
metadata.httpStatus = metadata.statusCode || 400;
return {msg: msg, metadata: metadata, msgType: msgType};
```

**2.10c (Retry path):** Add this script before Node 2.10:
```javascript
// Set HTTP status for server error
metadata.httpStatus = metadata.statusCode || 500;
return {msg: msg, metadata: metadata, msgType: msgType};
```

**What it does:**
- If `httpStatus = 200` → Set `status = 'SENT'`, record `sentAt` timestamp
- If `httpStatus = 429 or 5xx` → Increment `retryCount`, set `status = 'RETRY'` (unless maxRetries exceeded → 'FAILED')
- If `httpStatus = 400-499` → Set `status = 'FAILED'` (permanent - bad config)

**All paths connect to:** Node 2.11

---

#### Node 2.11: Script - Prepare Index Update

**Purpose:** Remove entry from priority index if SENT or FAILED

**Script:**
```javascript
var entry = msg.entry;
var needsRemoval = (entry.status === 'SENT' || entry.status === 'FAILED');

if (needsRemoval) {
  var priority = entry.priority;
  var indexKey = 'telegram_queue_index_priority_' + priority;
  var existingIndex = metadata[indexKey];

  // Parse if string
  if (typeof existingIndex === 'string') {
    existingIndex = JSON.parse(existingIndex);
  }
  if (!Array.isArray(existingIndex)) {
    existingIndex = [];
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
    msg: {attributes: attributes, needsRateLimitUpdate: true},
    metadata: metadata,
    msgType: 'POST_ATTRIBUTES_REQUEST'
  };
} else {
  // Just update entry (still in RETRY state)
  var attributes = {};
  attributes['telegram_queue_entry_' + entry.queueId] = JSON.stringify(entry);

  return {
    msg: {attributes: attributes, needsRateLimitUpdate: true},
    metadata: metadata,
    msgType: 'POST_ATTRIBUTES_REQUEST'
  };
}
```

**Connect to:** Node 2.12

---

#### Node 2.12: Save Attributes - Update Entry

**Node Type:** Save Attributes

**Configuration:**
- **Entity:** Customer
- **Scope:** SERVER_SCOPE
- **Attributes:** From `msg.attributes`

**Purpose:** Save the updated entry status (SENT/RETRY/FAILED) and updated index.

**Connect to:** Node 2.13

---

#### Node 2.13: Script - Update Rate Limit State

**Purpose:** Record that we just dispatched a batch

**Script:**
```javascript
var rateLimitState = metadata.telegram_queue_ratelimit;

// Parse if string
if (typeof rateLimitState === 'string') {
  rateLimitState = JSON.parse(rateLimitState);
}
if (!rateLimitState) {
  rateLimitState = {};
}

// Update state
rateLimitState.lastDispatchAt = Date.now();
rateLimitState.batchCount = (rateLimitState.batchCount || 0) + 1;

var attributes = {};
attributes['telegram_queue_ratelimit'] = JSON.stringify(rateLimitState);

return {
  msg: {attributes: attributes},
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**Connect to:** Node 2.14

---

#### Node 2.14: Save Attributes - Update Rate Limit

**Node Type:** Save Attributes

**Configuration:**
- **Entity:** Customer
- **Scope:** SERVER_SCOPE
- **Attributes:** From `msg.attributes`

**Purpose:** Save the rate limit timestamp so next cycle knows when we last sent.

**Connect to:** Log Success

---

## 📊 FLOW 3: Monitor (Every 5 minutes)

**Purpose:** Collect queue metrics for dashboard visualization.

### Visual Node Flow

```
[Generator: 300s Timer]
      ↓
[Enrichment: Get Config + Indexes + Rate Limit State]
      ↓
[Script: Calculate Metrics]
      ↓
[Save Telemetry: Virtual Device]
```

### Step-by-Step Node Configuration

#### Node 3.1: Generator - 300s Timer

**Node Type:** Generator

**Configuration:**
- **Period:** 300 seconds (5 minutes)
- **Originator:** `telegram-queue-monitor`
- **Message:** `{}`
- **Metadata:** Set `customerId`

**Connect to:** Node 3.2

---

#### Node 3.2: Enrichment - Get Everything

**Node Type:** Customer Attributes (Enrichment)

**Configuration:** Same as Node 2.2 (get config, indexes, rate limit state)

**Connect to:** Node 3.3

---

#### Node 3.3: Script - Calculate Metrics

**Purpose:** Count queue depths, calculate wait times

**Script:** Copy entire content from [`rule-chain/scripts/monitor-calculate.js`](rule-chain/scripts/monitor-calculate.js)

**What it calculates:**
- `queue_depth_priority_1`: Count of Critical messages
- `queue_depth_priority_2`: Count of High messages
- `queue_depth_priority_3`: Count of Medium messages
- `queue_depth_priority_4`: Count of Low messages
- `total_queue_depth`: Sum of all
- `time_since_last_dispatch_seconds`: How long since last send
- `can_send_now`: 1 if ready to send, 0 if rate limited
- `wait_time_seconds`: How many seconds until can send

**Connect to:** Node 3.4

---

#### Node 3.4: Save Telemetry

**Node Type:** Save Telemetry

**Configuration:**
- **Entity:** Device `telegram-queue-monitor` (created in Step 2.3)
- **Telemetry:** All fields from `msg` (output of Node 3.3)

**Purpose:** Store metrics so you can build dashboard widgets (line charts, gauges, etc.)

**Connect to:** Log Success

---

## 📋 Configuration Reference

### Priority Levels Explained

| Priority | Level | When to Use | Example Devices |
|----------|-------|-------------|-----------------|
| **1** | Critical | Infrastructure failures, power loss | ENTRADA, RELOGIO, TRAFO, SUBESTACAO |
| **2** | High | Revenue-impacting issues | 3F_MEDIDOR, HIDROMETRO stores |
| **3** | Medium | Normal monitoring | General equipment, common areas |
| **4** | Low | Informational | TERMOSTATO, comfort settings |

### Rate Control Settings Explained

**`batchSize`**: How many messages to send per cycle
- **Small (3-5)**: Conservative, safer for public Telegram groups
- **Large (10-20)**: Aggressive, for private internal chats

**`delayBetweenBatchesSeconds`**: Minimum time between batches
- **60s**: Standard, prevents spam
- **30s**: Faster, for urgent monitoring
- **120s**: Slower, for low-priority notifications

**`maxRetries`**: How many times to retry failed sends
- **3**: Standard
- **5**: For unreliable networks
- **1**: For testing (fail fast)

**`retryBackoff`**: How retry delays increase
- **exponential**: 10s → 20s → 40s → 80s (doubles each time)
- **linear**: 10s → 20s → 30s → 40s (adds 10s each time)

---

## 🎯 Testing Your Setup

### Step 1: Test Configuration

Go to **Rule Chains** → Create test chain:

```javascript
// Test script to verify config loads
var config = metadata.telegram_queue_config;
if (typeof config === 'string') {
  config = JSON.parse(config);
}

return {
  msg: {
    enabled: config.enabled,
    botToken: config.telegram.botToken.substring(0, 10) + '***',
    chatId: config.telegram.chatId,
    priorityRules: config.priorityRules
  },
  metadata: metadata,
  msgType: 'POST_TELEMETRY_REQUEST'
};
```

### Step 2: Test Single Enqueue

Trigger an alarm on a test device → Check **Customers** → **Attributes**:
- Should see `telegram_queue_entry_<some-uuid>`
- Should see `telegram_queue_index_priority_<number>` with one ID

### Step 3: Test Dispatcher

Wait 60 seconds → Check Telegram chat:
- Should receive the message!

Check Attributes:
- Entry status should change from `PENDING` to `SENT`
- Entry should be removed from priority index
- `telegram_queue_ratelimit` should have `lastDispatchAt` updated

### Step 4: Test Monitoring

Wait 5 minutes → Check device `telegram-queue-monitor` telemetry:
- Should see `total_queue_depth`, `can_send_now`, etc.

---

## 🐛 Troubleshooting

### Problem: Messages Not Enqueueing

**Check:**
1. Rule Chain connected correctly? (Device → Transformation → Enqueue nodes)
2. Script errors? (Look at ThingsBoard Events log)
3. Config exists? (Check customer attributes for `telegram_queue_config`)
4. `enabled: true`? (Check config JSON)

**Debug:** Add Log Nodes after each script to see output.

---

### Problem: Messages Not Sending

**Check:**
1. Dispatcher Generator running? (Should trigger every 60s)
2. Rate limited? (Check `wait_time_seconds` metric - might need to wait)
3. Bot token correct? (Test manually: `curl https://api.telegram.org/bot<TOKEN>/getMe`)
4. Chat ID correct? (Bot must be added to the chat/group)

**Debug:** Add Log Node after Node 2.3 to see `rateLimited` value.

---

### Problem: Queue Growing Too Large

**Solutions:**
1. Increase `batchSize` (e.g., 5 → 10)
2. Decrease `delayBetweenBatchesSeconds` (e.g., 60 → 30)
3. Filter alarms before enqueue (add Switch node to skip low-priority)

---

### Problem: Too Many Messages / Spam

**Solutions:**
1. Decrease `batchSize` (e.g., 10 → 3)
2. Increase `delayBetweenBatchesSeconds` (e.g., 60 → 120)
3. Raise priority thresholds (change device profiles to priority 3 or 4)

---

## 📁 File Structure

```
alarm-queue-setup/
├── README.md (this file)
├── docs/
│   └── RFC-0135-TelegramNotificationQueue.md (specification)
├── index.js (library exports for external use)
└── rule-chain/
    ├── README.md (technical details)
    ├── scripts/
    │   ├── enqueue-normalize.js
    │   ├── enqueue-priority.js
    │   ├── dispatch-rate-limit.js
    │   ├── dispatch-mark-status.js
    │   └── monitor-calculate.js
    └── helpers/
        └── node-config-examples.md (advanced configuration)
```

---

## 🎓 Understanding Key Concepts

### What is a "Queue"?

Think of it like a line at a coffee shop:
- **Enqueue** = Person joins the line
- **Dequeue** = Barista serves the next person
- **Priority** = VIP members skip to front of line
- **Rate Limit** = Barista serves max 5 people per minute

### What are "Attributes" in ThingsBoard?

Attributes are like a shared spreadsheet that Rule Chains can read/write:
- **Server Scope** = Only visible to administrators (secure for tokens)
- **Shared Scope** = Visible to customer users
- **Client Scope** = Set by devices

We use **Server Scope** to store queue data because it's:
- ✅ Persistent (survives server restarts)
- ✅ Secure (not visible to devices)
- ✅ Accessible from all Rule Chains

### Why "Visual Nodes" Instead of Code?

ThingsBoard Rule Chains are like flowcharts:
- Each **box** = One operation (fetch data, transform, save, etc.)
- Each **arrow** = Data flows from one box to the next
- **Scripts** = Only for pure logic (no I/O)

This design:
- ✅ Makes debugging visual (see data at each step)
- ✅ Handles parallelization automatically
- ✅ Prevents blocking operations

---

## 🚀 What's Next?

Once you have the basic setup working:

1. **Add Dashboard Widgets**
   - Line chart: `total_queue_depth` over time
   - Gauge: `wait_time_seconds`
   - Counter: `batch_count_total`

2. **Customize Message Formatting**
   - Add device photos to messages
   - Include dashboard links
   - Format with Telegram HTML/Markdown

3. **Add Advanced Features**
   - Different chat IDs per priority level
   - Scheduled quiet hours (pause at night)
   - Message deduplication (prevent duplicates)

4. **Scale to Multiple Customers**
   - Duplicate Rule Chains per customer
   - Use customer-specific configurations
   - Monitor aggregate metrics

---

## 🔄 Migration Guide: Hybrid Integration with Existing Rule Chains

### Overview: Why Hybrid?

If you already have a working Telegram notification system (like direct REST API calls), you don't have to replace it all at once! This guide shows how to:

1. **Keep existing behavior** for customers not yet migrated
2. **Gradually enable queue** per customer using a simple attribute flag
3. **Coexist** direct send and queue approaches in the same Rule Chain

### Backward Compatibility Strategy

```
┌─────────────────────────────────────────┐
│  ALARM TRIGGER                          │
│          ↓                              │
│  [Check Customer: Queue Enabled?]       │
│          ├─── NO → Direct Send (Old Way)│
│          └─── YES → Enqueue (New Way)   │
└─────────────────────────────────────────┘
```

### Step 1: Add Queue Flag to Customer Attributes

For customers **NOT yet using queue**, add:

**Attribute:** `telegram_queue_enabled`
**Value:** `false`

For customers **ready to use queue**, set:

**Attribute:** `telegram_queue_enabled`
**Value:** `true`

**AND** add full configuration:

**Attribute:** `telegram_queue_config`
**Value:** (see Step 2.2 above)

---

### Step 2: Modify Existing Rule Chain (Example: Obramax)

Let's adapt an existing Rule Chain that currently does direct Telegram send. We'll add a **routing node** that checks the queue flag.

#### Current Flow (Direct Send)

```
[Alarm] → [Build Message] → [Get telegramGroup] → [REST API: Send to Telegram]
```

#### New Hybrid Flow

```
[Alarm]
  ↓
[Build Message]
  ↓
[Enrichment: Get telegram_queue_enabled + telegram_queue_config + telegramGroup]
  ↓
[Switch: Check telegram_queue_enabled]
  ├─── FALSE → [Direct Send Path (Original)]
  │                 ↓
  │            [Use telegramGroup attribute]
  │                 ↓
  │            [REST API: Direct Telegram Send]
  │
  └─── TRUE → [Queue Path (New)]
                    ↓
               [Script: Normalize for Queue]
                    ↓
               [Script: Resolve Priority]
                    ↓
               [Script: Prepare Save]
                    ↓
               [Save Attributes: Enqueue]
```

---

### Step 3: Implementation Details

#### Node 3.1: Enrichment - Get Flags and Config

**Replace your existing "Get telegramGroup" enrichment node** with:

**Node Type:** Customer Attributes (Enrichment)

**Configuration - Fetch these attributes:**
- `telegram_queue_enabled` → Store as `telegram_queue_enabled`
- `telegram_queue_config` → Store as `telegram_queue_config`
- `telegramGroup` → Store as `telegramGroup` (for direct send fallback)

**Purpose:** Load both old and new configurations so the Switch node can decide.

**Connect to:** Node 3.2

---

#### Node 3.2: Switch - Check Queue Enabled

**Node Type:** Switch

**Configuration:**
```javascript
// Parse the flag (might be string or boolean)
var queueEnabled = metadata.telegram_queue_enabled;

if (typeof queueEnabled === 'string') {
  queueEnabled = (queueEnabled.toLowerCase() === 'true');
}

return queueEnabled === true;
```

**Connections:**
- **True** → Node 3.3 (Queue Path)
- **False** → Your existing direct send nodes (unchanged)

---

#### Node 3.3: Script - Normalize for Queue

**Purpose:** Convert your existing message format to queue entry format

**Script:**
```javascript
// Your existing message text (adjust field names as needed)
var text = msg.text || msg.alarmText || metadata.messageText;

// Generate queue ID (simple UUID v4)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

var queueId = generateUUID();
var now = Date.now();

// Extract metadata
var customerId = metadata.customerId;
var deviceId = metadata.deviceId || metadata.originatorId;
var deviceName = metadata.deviceName || msg.deviceName || 'Unknown';
var deviceProfile = metadata.deviceType || metadata.deviceProfile || 'unknown';

// Create normalized entry
var normalizedEntry = {
  queueId: queueId,
  customerId: customerId,
  deviceId: deviceId,
  deviceProfile: deviceProfile,
  deviceName: deviceName,
  payload: {
    text: text,
    alarmType: msg.alarmType || metadata.alarmType,
    severity: metadata.ss_severity || 'INFO'
  },
  status: 'PENDING',
  retryCount: 0,
  createdAt: now,
  sentAt: null,
  lastAttemptAt: null,
  errorMessage: null
};

return {
  msg: {
    entry: normalizedEntry,
    deviceProfile: deviceProfile,
    deviceId: deviceId,
    customerId: customerId
  },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**Connect to:** Node 3.4

---

#### Node 3.4: Script - Resolve Priority

**Purpose:** Same as Node 1.4 from Flow 1

**Script:** Copy entire content from [`rule-chain/scripts/enqueue-priority.js`](rule-chain/scripts/enqueue-priority.js)

**Connect to:** Node 3.5

---

#### Node 3.5: Script - Prepare Save

**Purpose:** Same as Node 1.6 from Flow 1

**Script:** (Same as Flow 1, Node 1.6 - see above)

**Connect to:** Node 3.6

---

#### Node 3.6: Save Attributes - Enqueue

**Purpose:** Same as Node 1.7 from Flow 1

**Node Type:** Save Attributes

**Configuration:**
- **Entity:** Customer
- **Scope:** SERVER_SCOPE
- **Attributes:** From `msg.attributes`

**Connect to:** Log Success

---

### Step 4: Keep Direct Send Path Unchanged

Your existing nodes after the **False** branch of the Switch remain **exactly as they are**:

```
[Switch: FALSE]
  ↓
[Your existing transformation scripts]
  ↓
[REST API Call with hardcoded token]
  ↓
[Log success]
```

**No changes needed!** This ensures customers without `telegram_queue_enabled: true` continue working exactly as before.

---

### Step 5: Migration Checklist

Use this checklist to migrate customers gradually:

#### Pre-Migration (Prepare)
- [ ] Deploy the three queue Rule Chains (Enqueue, Dispatcher, Monitor) - see main setup above
- [ ] Create service account `telegram-queue-service@myio.com.br`
- [ ] Create virtual device `telegram-queue-monitor`
- [ ] Test queue system with ONE pilot customer

#### Per-Customer Migration
- [ ] Customer agrees to pilot the queue system
- [ ] Add `telegram_queue_config` attribute to customer (see Step 2.2)
- [ ] Set `telegram_queue_enabled: true` attribute
- [ ] Monitor for 24 hours:
  - [ ] Messages enqueueing correctly?
  - [ ] Dispatcher sending messages?
  - [ ] No duplicate sends (queue AND direct)?
- [ ] Customer confirms messages working correctly
- [ ] Mark as migrated in spreadsheet

#### Rollback Plan (If Issues)
- [ ] Set `telegram_queue_enabled: false` immediately
- [ ] Customer reverts to direct send (no downtime!)
- [ ] Investigate queue issues offline
- [ ] Fix and retry migration later

---

### Step 6: Special Cases

#### Case 1: Different Telegram Chats Per Customer

**Old Way:** Each customer has `telegramGroup` attribute with different chat ID

**Queue Way:** Each customer has `telegram_queue_config.telegram.chatId`

**Migration:** When you add `telegram_queue_config`, copy the existing `telegramGroup` value:

```json
{
  "telegram": {
    "botToken": "SHARED_BOT_TOKEN",
    "chatId": "<value from telegramGroup attribute>"
  }
}
```

---

#### Case 2: Special Filtering Rules (e.g., Generator/Pump Alarms)

**Old Way:** You have a Switch node checking `msg.isSpecialGroup` or alarm type

**Queue Way:** Keep the filter BEFORE the queue/direct split:

```
[Alarm]
  ↓
[Filter: isSpecialGroup]
  ├─ TRUE → [Special handling]
  └─ FALSE → [Switch: Queue Enabled?]
                ├─ TRUE → Queue
                └─ FALSE → Direct
```

---

#### Case 3: Multiple Bot Tokens (Different Customers Use Different Bots)

**Queue Way:** Each customer's `telegram_queue_config` has their own `botToken`:

```json
{
  "telegram": {
    "botToken": "1234567890:AAH...",  // Customer A's bot
    "chatId": "-100123456789"
  }
}
```

```json
{
  "telegram": {
    "botToken": "9876543210:BBG...",  // Customer B's bot
    "chatId": "-100987654321"
  }
}
```

The Dispatcher will use each customer's bot token from their config.

---

### Step 7: Monitoring Hybrid Deployment

#### Metrics to Track

| Metric | Where to Find | Expected Value |
|--------|---------------|----------------|
| Customers using direct send | Count customers with `telegram_queue_enabled: false` | Decreases over time |
| Customers using queue | Count customers with `telegram_queue_enabled: true` | Increases over time |
| Queue depth per customer | Device telemetry `total_queue_depth` | < 50 (healthy) |
| Failed sends | Queue entries with `status: FAILED` | < 5% of total |

#### Dashboard Widget (Optional)

Create a ThingsBoard widget that shows migration progress:

**Datasource:** Virtual device `telegram-queue-monitor`
**Metric:** `customers_migrated_count` (you can add this to monitor script)

**Visual:** Progress bar showing "45 out of 100 customers migrated"

---

### Step 8: Full Migration Timeline Example

**Week 1: Prepare**
- Deploy queue Rule Chains
- Test with 1 internal customer
- Train support team

**Week 2-4: Pilot (10 customers)**
- Migrate 2-3 customers per week
- Monitor closely for issues
- Gather feedback

**Week 5-8: Gradual Rollout (50 customers)**
- Migrate 10-15 customers per week
- Automated monitoring alerts
- Confidence builds

**Week 9-12: Final Push (40 customers)**
- Migrate remaining customers
- Decommission old direct send nodes
- Full queue deployment complete

---

### Step 9: Post-Migration Cleanup

Once ALL customers migrated to queue:

1. **Remove Switch Node** - No longer need queue enabled check
2. **Delete Direct Send Nodes** - Old REST API call nodes no longer used
3. **Remove Old Attributes** - Delete `telegramGroup` attributes (now using `telegram_queue_config.telegram.chatId`)
4. **Simplify Rule Chain** - Alarm → Normalize → Enqueue (much cleaner!)

---

## 📊 Comparison: Direct Send vs Queue

| Feature | Direct Send (Old) | Queue System (New) |
|---------|-------------------|---------------------|
| **Rate Limiting** | ❌ No - Telegram may block | ✅ Yes - Configurable batches |
| **Priority** | ❌ No - All equal | ✅ Yes - 4 levels |
| **Retry** | ❌ No - Lost on failure | ✅ Yes - Exponential backoff |
| **Monitoring** | ❌ No metrics | ✅ Yes - Dashboard metrics |
| **Scalability** | ⚠️ Poor - Spams on many alarms | ✅ Good - Batches automatically |
| **Configuration** | ⚠️ Hardcoded in Rule Chain | ✅ Per-customer attributes |
| **Migration Effort** | N/A | ✅ Gradual, low risk |

---

## 🎓 Understanding the Hybrid Approach

### Why Not Replace Everything at Once?

**Risk Management:**
- 100 customers × direct replacement = **high risk** (all fail if bug exists)
- 5 customers × gradual migration = **low risk** (rollback easily)

**Business Continuity:**
- Direct send keeps working during migration
- No notification downtime
- Customer confidence maintained

**Testing in Production:**
- Real-world validation with small group
- Discover edge cases early
- Fix issues before wide rollout

---

## 📞 Support

- **Issues**: File in project repository
- **Questions**: Contact MYIO Platform Team
- **Documentation**: See [`rule-chain/README.md`](rule-chain/README.md) for technical details
- **Migration Help**: Refer to this Hybrid Integration section

---

**RFC-0135 v2.0.0** | ThingsBoard Rule Chain Native | © 2026 MYIO Platform
