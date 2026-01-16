# RFC-0135: Telegram Notification Queue for ThingsBoard

A **hybrid queue system** for gradually migrating from direct Telegram sends to a prioritized, rate-limited queue using ThingsBoard Rule Chains.

**Version:** 2.0.0 (Hybrid Integration)

---

## 🎯 What This System Does

Instead of sending every alarm immediately to Telegram (risking rate limits and spam), this queue system:

1. **Queues** messages with priority levels (Critical, High, Medium, Low)
2. **Processes** them in batches (e.g., 5 messages every 60 seconds)
3. **Retries** failed sends automatically with exponential backoff
4. **Monitors** queue health with real-time metrics
5. **Coexists** with your current direct-send setup (gradual migration!)

All using **ThingsBoard Attributes** for storage - no external databases needed.

---

## 🏗️ Architecture Overview

### Hybrid Approach

```
┌─────────────────────────────────────────────────────┐
│  ALARM TRIGGER                                      │
│          ↓                                          │
│  [Filter: Check Customer Queue Enabled?]            │
│          ├─── FAILURE (false) → Direct Send (Old)   │
│          └─── SUCCESS (true) → Enqueue (New)        │
└─────────────────────────────────────────────────────┘
```

**Key Benefit:** Each customer can be migrated independently. No downtime, easy rollback.

---

## 📋 Prerequisites: Customer Configuration

Each customer needs 2 attributes in ThingsBoard. Think of these as "settings" stored on the customer's profile.

### Where to Add Attributes

In ThingsBoard UI:
1. Go to **Customers** menu
2. Click on a customer
3. Click **Attributes** tab
4. Select **SERVER_SCOPE** (not Shared or Client)
5. Click **"+"** button to add new attribute

---

### Attribute 1: Enable/Disable Queue (REQUIRED for all customers)

**Why:** This controls whether THIS customer uses the queue or direct send

**Attribute Details:**
- **Key:** `telegram_queue_enabled`
- **Value Type:** Boolean
- **Value:** `true` or `false`

**When to use `false`:**
- Customer still using old direct-send method
- You haven't tested queue with this customer yet
- Temporary rollback if issues occur

**When to use `true`:**
- Customer is ready for the queue system
- You've added Attribute 2 (configuration) below
- You want batch processing and rate limiting

**JSON Format:**
```json
{
  "key": "telegram_queue_enabled",
  "value": false
}
```

Change to `true` when ready!

---

### Attribute 2: Queue Configuration (ONLY for customers with `telegram_queue_enabled: true`)

**Why:** This tells the queue HOW to behave - priorities, rate limits, and Telegram credentials

**Attribute Details:**
- **Key:** `telegram_queue_config`
- **Value Type:** JSON
- **Value:** Copy and customize the template below

**Template to Copy:**
```json
{
  "priorityRules": {
    "deviceProfiles": {
      "ENTRADA": 1,
      "RELOGIO": 1,
      "TRAFO": 1,
      "SUBESTACAO": 1,
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
    "maxRetries": 3
  },
  "telegram": {
    "botToken": "YOUR_BOT_TOKEN_HERE",
    "chatId": "YOUR_CHAT_ID_HERE"
  }
}
```

**What Each Part Means:**

#### Priority Rules
Determines which alarms are sent first:

| Priority | Meaning | Number | Which Devices |
|----------|---------|--------|---------------|
| Critical | SEND FIRST | 1 | ENTRADA, RELOGIO, TRAFO, SUBESTACAO |
| High | Send second | 2 | 3F_MEDIDOR, HIDROMETRO |
| Medium | Send third | 3 | (Anything not listed - the default) |
| Low | Send last | 4 | TERMOSTATO |

**`deviceProfiles`**: Matches by device type name
**`deviceOverrides`**: Matches by specific device UUID (leave empty `{}` if not needed)
**`globalDefault`**: Used when device doesn't match any rule (recommended: `3`)

#### Rate Control
Prevents Telegram from blocking you:

| Setting | What It Does | Recommended Value |
|---------|--------------|-------------------|
| `batchSize` | How many messages to send at once | `5` |
| `delayBetweenBatchesSeconds` | Seconds to wait between batches | `60` (1 minute) |
| `maxRetries` | How many times to retry failed sends | `3` |

**Example:** With `batchSize: 5` and `delay: 60`, you send 5 messages per minute max.

#### Telegram Credentials
Where to send messages:

| Field | Where to Get It |
|-------|-----------------|
| `botToken` | Chat with **@BotFather** on Telegram → `/newbot` → Copy token |
| `chatId` | 1. Add bot to your Telegram group<br>2. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`<br>3. Look for `"chat":{"id":-100123456789}` |

---

### Quick Setup Checklist

For **each customer** you want to migrate:

- [ ] Add `telegram_queue_enabled: false` (start with false!)
- [ ] Add `telegram_queue_config` with their Telegram bot token and chat ID
- [ ] Test by changing `telegram_queue_enabled: true`
- [ ] Verify messages appear in their Telegram
- [ ] If issues occur, flip back to `false` (instant rollback!)

**Important:** Each customer can have DIFFERENT Telegram bots/groups. Just use different `botToken` and `chatId` in their config.

---

## 🔄 Hybrid Integration with Existing Rule Chains

Now let's modify your existing Rule Chain to support both queue and direct send.

### Current Flow (Direct Send - Example)

Your existing Rule Chain probably looks like this:

```
[Alarm]
  ↓
[Transform: Build Message Text]
  ↓
[Enrichment: Get telegramGroup]
  ↓
[REST API: Send to Telegram]
```

### New Hybrid Flow

We'll add a **routing Filter** that checks if queue is enabled:

```
[Alarm]
  ↓
[Transform: Build Message Text]
  ↓
[Enrichment: Get telegram_queue_enabled + telegram_queue_config + telegramGroup]
  ↓
[Filter: Check telegram_queue_enabled]
  ├─── FAILURE (false) → [Your existing direct send nodes - UNCHANGED]
  │                           ↓
  │                      [REST API: Direct Telegram Send]
  │
  └─── SUCCESS (true) → [Queue Path - NEW]
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

## 🛠️ Step-by-Step Node Configuration

### Node 1: Transform - Build Message Text

**Node Type:** Script (Transformation)

**Purpose:** Format alarm into human-readable text

**Script:**
```javascript
// Extract alarm details from ThingsBoard context
var deviceName = metadata.deviceName || 'Unknown Device';
var alarmType = metadata.alarmType || 'Alert';

// ThingsBoard alarm severity (CRITICAL, MAJOR, MINOR, WARNING, INDETERMINATE)
// Available in metadata.severity after alarm node processing
var severity = metadata.severity || 'INFO';

// Build Telegram message text
var text = '⚠️ ' + severity + ' - ' + deviceName;
text += '\n' + alarmType;
text += '\nTime: ' + new Date().toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo'});

// Store in msg.text for next nodes
return {
  msg: {
    text: text,
    alarmType: alarmType,
    severity: severity
  },
  metadata: metadata,
  msgType: msgType
};
```

**Where does `metadata.severity` come from?**
- ThingsBoard **Alarm nodes** automatically add alarm metadata to the message context
- When an alarm is created/updated, ThingsBoard populates these metadata fields:
  - `metadata.severity` - Alarm severity (CRITICAL, MAJOR, MINOR, WARNING, INDETERMINATE)
  - `metadata.alarmType` - Type of alarm (e.g., "High Temperature", "Power Loss")
  - `metadata.deviceName` - Name of the device that triggered the alarm
  - `metadata.deviceType` - Device profile/type
  - `metadata.deviceId` - UUID of the device
  - `metadata.customerId` - UUID of the customer

**Important:** This node should come AFTER an alarm processing node (e.g., "Create Alarm", "Clear Alarm", or "Alarm Rule" node) in your Rule Chain so these metadata fields are populated.

**Connect to:** Node 2

---

### Node 2: Enrichment - Get Attributes

**Node Type:** Customer Attributes (Enrichment)

**Purpose:** Load queue configuration and existing telegram settings

**Configuration - Fetch these attributes:**
- `telegram_queue_enabled` → Store as `telegram_queue_enabled`
- `telegram_queue_config` → Store as `telegram_queue_config`
- `telegramGroup` → Store as `telegramGroup` (for direct send fallback - if you have this)

**Why all three?**
- `telegram_queue_enabled` - Determines routing (queue vs direct)
- `telegram_queue_config` - Used by queue path for priority/rate limiting
- `telegramGroup` - Used by direct send path (your old system)

**Connect to:** Node 3

---

### Node 3: Filter - Route Based on Queue Enabled

**Node Type:** Check Message Script (Filter)

**Purpose:** Route to queue (new) or direct send (old) based on customer flag

**Script:**
```javascript
// Parse the flag (might be string "true"/"false" or boolean true/false)
var queueEnabled = metadata.telegram_queue_enabled;

// Convert string to boolean if needed
if (typeof queueEnabled === 'string') {
  queueEnabled = (queueEnabled.toLowerCase() === 'true');
} else if (typeof queueEnabled !== 'boolean') {
  queueEnabled = false; // Default to false (direct send) if undefined
}

// Return true to route to SUCCESS path (queue), false to FAILURE path (direct send)
return queueEnabled === true;
```

**Configuration:**
- **Node Type:** Check Message Script (under "Filter" nodes category)
- **Script language:** JavaScript (TBEL)

**Connections:**
- **Success** relation → Connect to Node 4 (Queue Path - Normalize)
- **Failure** relation → Connect to your existing direct send nodes (UNCHANGED)

**What happens:**
- Returns `true` → Message goes to SUCCESS output → Queue path
- Returns `false` → Message goes to FAILURE output → Direct send path

---

## 🆕 Queue Path Nodes (New)

These nodes only run when `telegram_queue_enabled: true`.

### Node 4: Script - Normalize for Queue

**Node Type:** Script (Transformation)

**Purpose:** Convert message to queue entry format

**Script:**
```javascript
// Extract message text from previous transformation
var text = msg.text || msg.message || '';

// Extract alarm details
var alarmType = msg.alarmType || metadata.alarmType || 'Alarm';
var severity = msg.severity || metadata.severity || 'INFO';

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

// Extract metadata from ThingsBoard context
var customerId = metadata.customerId;
var deviceId = metadata.deviceId || metadata.originatorId;
var deviceName = metadata.deviceName || 'Unknown';
var deviceProfile = metadata.deviceType || metadata.deviceProfile || 'unknown';

// Create normalized queue entry
var normalizedEntry = {
  queueId: queueId,
  customerId: customerId,
  deviceId: deviceId,
  deviceProfile: deviceProfile,
  deviceName: deviceName,
  payload: {
    text: text,
    alarmType: alarmType,
    severity: severity
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

**Connect to:** Node 5

---

### Node 5: Script - Resolve Priority

**Node Type:** Script (Transformation)

**Purpose:** Determine message priority (1=Critical, 2=High, 3=Medium, 4=Low)

**Script:**
```javascript
var entry = msg.entry;
var deviceProfile = entry.deviceProfile;
var deviceId = entry.deviceId;
var customerId = entry.customerId;

// Parse queue config from metadata
var config = metadata.telegram_queue_config;
if (typeof config === 'string') {
  try {
    config = JSON.parse(config);
  } catch (e) {
    config = null;
  }
}

var priority = 3; // Default: Medium
var prioritySource = 'systemDefault';

// Priority resolution cascade (highest priority first)
if (config && config.priorityRules) {
  var rules = config.priorityRules;

  // 1. Check device override (specific device UUID)
  if (rules.deviceOverrides && rules.deviceOverrides[deviceId]) {
    priority = rules.deviceOverrides[deviceId];
    prioritySource = 'deviceOverride';
  }
  // 2. Check device profile rule (device type/profile)
  else if (rules.deviceProfiles && rules.deviceProfiles[deviceProfile]) {
    priority = rules.deviceProfiles[deviceProfile];
    prioritySource = 'deviceProfile';
  }
  // 3. Check customer global default
  else if (rules.globalDefault) {
    priority = rules.globalDefault;
    prioritySource = 'customerGlobal';
  }
}

// Ensure priority is 1-4
if (priority < 1) priority = 1;
if (priority > 4) priority = 4;

// Add priority to entry
entry.priority = priority;
entry.prioritySource = prioritySource;

return {
  msg: {
    entry: entry
  },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**Connect to:** Node 6

---

### Node 6: Script - Prepare Save

**Node Type:** Script (Transformation)

**Purpose:** Format entry and priority index for ThingsBoard Attributes

**Script:**
```javascript
var entry = msg.entry;
var priority = entry.priority;

// Get existing priority index from metadata
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

// Save queue entry
attributes['telegram_queue_entry_' + entry.queueId] = JSON.stringify(entry);

// Update priority index
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

**Connect to:** Node 7

---

### Node 7: Save Attributes - Enqueue

**Node Type:** Save Attributes

**Purpose:** Persist queue entry to ThingsBoard

**Configuration:**
- **Entity:** Customer (use `${msg.customerId}`)
- **Scope:** SERVER_SCOPE
- **Attributes:** Use `${msg.attributes}` (from previous node)

**What gets saved:**
- `telegram_queue_entry_<queueId>` - The full message entry
- `telegram_queue_index_priority_<1-4>` - Updated array of queue IDs for this priority

**Connect to:** Log Success (optional)

---

## 🔁 Keep Direct Send Path Unchanged

Your existing nodes after the **Failure** branch of Node 3 remain **exactly as they are**:

```
[Filter: FAILURE]
  ↓
[Your existing transformation scripts] (no changes)
  ↓
[REST API Call with bot token] (no changes)
  ↓
[Log success] (no changes)
```

**This is critical:** Customers with `telegram_queue_enabled: false` continue working normally with zero changes to their notification flow.

---

## 🚀 Dispatcher Rule Chain (Processes Queue)

After messages are enqueued via Node 7, you need a **separate Rule Chain** that runs on a timer to process the queue and send messages to Telegram.

### What You Need to Create:

**Create NEW Rule Chain:** "Telegram Queue Dispatcher"

**Trigger:** Timer Generator - Every 60 seconds

**Purpose:** Fetch pending messages, send to Telegram in batches, respect rate limits

---

### Dispatcher Node 1: Generator - Timer Trigger

**Previous Node:** None (starting node)
**Next Node:** Dispatcher Node 2

**Node Type:** Generator

**Configuration:**
- **Period:** 60 seconds
- **Originator:** System (or Tenant entity)
- **Message count:** 1
- **Message:** `{}` (empty JSON object)
- **Metadata:** Leave empty

**Purpose:** Triggers the dispatcher every 60 seconds for ALL customers

**Connection:** Success relation → Dispatcher Node 2

---

### Dispatcher Node 2: Script - Build Customer List

**Previous Node:** Dispatcher Node 1
**Next Node:** Dispatcher Node 3

**Node Type:** Script (Transformation)

**Purpose:** Provide list of customer UUIDs to process

**Script:**
```javascript
// CONFIGURE THIS: Add your customer UUIDs here
var customers = [
  "CUSTOMER_UUID_1",
  "CUSTOMER_UUID_2",
  "CUSTOMER_UUID_3"
  // Add more customer IDs as needed
];

// Return array for Split Array node
return {
  msg: customers,
  metadata: metadata,
  msgType: msgType
};
```

**Note:** Update this script whenever you add/remove customers. Each customer with `telegram_queue_enabled: true` should be in this list.

**Connection:** Success relation → Dispatcher Node 3

---

### Dispatcher Node 3: Split Array - Process Each Customer

**Previous Node:** Dispatcher Node 2
**Next Node:** Dispatcher Node 4

**Node Type:** Split Array Msg

**Configuration:**
- **No configuration needed** - Automatically iterates over customer UUID array

**Purpose:** Create separate parallel message flow for each customer

**What happens:** If you have 10 customers in the list, Nodes 4-22 will run 10 times in parallel

**Connection:** Success relation → Dispatcher Node 4

---

### Dispatcher Node 4: Script - Build Customer Context

**Previous Node:** Dispatcher Node 3
**Next Node:** Dispatcher Node 5

**Node Type:** Script (Transformation)

**Purpose:** Convert customer UUID string to metadata object

**Script:**
```javascript
// msg is now a single customer UUID string (from Split Array)
var customerId = msg;

return {
  msg: {},
  metadata: {
    customerId: customerId
  },
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**Connection:** Success relation → Dispatcher Node 5

---

### Dispatcher Node 5: Change Originator - Set to Customer

**Previous Node:** Dispatcher Node 4
**Next Node:** Dispatcher Node 6

**Node Type:** Change Originator

**Purpose:** Switch message originator to customer entity for enrichment

**Configuration:**
- **Originator source:** Customer
- **Customer ID pattern:** `${metadata.customerId}`

**Why needed:** Next node needs customer context to fetch customer attributes

**Connection:** Success relation → Dispatcher Node 6

---

### Dispatcher Node 6: Enrichment - Fetch Queue Data

**Previous Node:** Dispatcher Node 5
**Next Node:** Dispatcher Node 7

**Node Type:** Customer Attributes (Enrichment)

**Configuration - Fetch these attributes:**
- `telegram_queue_config` → Store as `telegram_queue_config`
- `telegram_queue_ratelimit` → Store as `telegram_queue_ratelimit`
- `telegram_queue_index_priority_1` → Store as `telegram_queue_index_priority_1`
- `telegram_queue_index_priority_2` → Store as `telegram_queue_index_priority_2`
- `telegram_queue_index_priority_3` → Store as `telegram_queue_index_priority_3`
- `telegram_queue_index_priority_4` → Store as `telegram_queue_index_priority_4`

**Purpose:** Load all data needed for rate limiting and batch building

**Connection:** Success relation → Dispatcher Node 7

---

### Dispatcher Node 7:

**Previous Node:** Dispatcher Node 6
**Next Node:** Dispatcher Node 8

**Node Type:** Script (Transformation)

**Purpose:** Synchronous math to check if enough time passed + extract queue IDs

**Script:** Copy entire content from [`rule-chain/scripts/dispatch-rate-limit.js`](rule-chain/scripts/dispatch-rate-limit.js)

**What it does:**
1. Parse `telegram_queue_config` → Get `batchSize` (e.g., 5) and `delayBetweenBatchesSeconds` (e.g., 60)
2. Parse `telegram_queue_ratelimit` → Get `lastDispatchAt` timestamp
3. Calculate: `now - lastDispatchAt >= 60 seconds?`
4. **If NO (rate limited)** → Return `{rateLimited: true, waitTimeSeconds: 15}`
5. **If YES** → Build batch from priority indexes (Critical first, then High, Medium, Low)
6. **If queue empty** → Return `{emptyQueue: true, batchIds: []}`
7. **If has messages** → Return `{rateLimited: false, batchIds: ["uuid1", "uuid2", ...], batchSize: 5}`

**Connection:** Success relation → Dispatcher Node 8

---

### Dispatcher Node 8:

**Previous Node:** Dispatcher Node 7
**Next Nodes:** Dispatcher Node 9 (if has messages) OR Log Node (if rate limited/empty)

**Node Type:** Check Message Script (Filter)

**Purpose:** Route based on rate limit status and queue state

**Script:**
```javascript
// Skip if rate limited or queue empty
return msg.rateLimited === false && msg.emptyQueue === false;
```

**Connections:**
- **Success** relation → Dispatcher Node 9 (has messages to send)
- **Failure** relation → Log Node "Skipped: Rate Limited or Empty" (end flow)

---

### Dispatcher Node 9:

**Previous Node:** Dispatcher Node 8 (Success path)
**Next Node:** Dispatcher Node 10

**Node Type:** Change Originator

**Purpose:** Switch message originator to customer entity for next enrichment

**Configuration:**
- **Originator source:** Customer
- **Customer ID pattern:** `${metadata.customerId}` OR `${msg.customerId}`

**Why needed:** Next node needs customer context to fetch queue entries

**Connection:** Success relation → Dispatcher Node 10

---

### Dispatcher Node 10:

**Previous Node:** Dispatcher Node 9
**Next Node:** Dispatcher Node 11

**Node Type:** Script (Transformation)

**Purpose:** Extract raw array from msg object for Split Array node

**Why needed:** ThingsBoard's "Split Array Msg" node expects `msg` to BE an array `["id1", "id2"]`, not an object containing an array `{batchIds: ["id1", "id2"]}`. This script converts the format.

**Script:**
```javascript
// Extract the batch IDs array from msg object
var batchIds = msg.batchIds || [];

// Return the array as the root msg (required for Split Array node)
return {
  msg: batchIds,  // Now msg IS the array: ["uuid1", "uuid2", ...]
  metadata: metadata,
  msgType: msgType
};
```

**Connection:** Success relation → Dispatcher Node 11

---

### Dispatcher Node 11:

**Previous Node:** Dispatcher Node 10
**Next Node:** Dispatcher Node 12 (runs multiple times - once per queue ID)

**Node Type:** Split Array Msg (under "Transformation" category)

**Configuration:**
- **No configuration needed** - The standard "Split Array Msg" node automatically iterates over the root `msg` array

**Purpose:** Takes `["uuid1", "uuid2", "uuid3"]` array and creates 3 separate message flows

**What happens:** If batch has 5 queue IDs, this node fires 5 times - once per message. Each subsequent node runs 5 times in parallel. Each iteration receives one string (the queue ID) as `msg`.

**Connection:** Success relation → Dispatcher Node 12

---

### Dispatcher Node 12:

**Previous Node:** Dispatcher Node 11
**Next Node:** Dispatcher Node 13

**Node Type:** Script (Transformation)

**Purpose:** Construct attribute key dynamically from queue ID

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

**Connection:** Success relation → Dispatcher Node 13

---

### Dispatcher Node 13:

**Previous Node:** Dispatcher Node 12
**Next Node:** Dispatcher Node 14

**Node Type:** Customer Attributes (Enrichment)

**Configuration:**
- **Attribute:** Use `${msg.attributeKey}` (dynamic - gets value from previous node)
- **Store as:** `queueEntry` in metadata

**Purpose:** Fetch the full entry: `{queueId, payload: {text: "..."}, priority: 2, status: "PENDING", ...}`

**Connection:** Success relation → Dispatcher Node 14

---

### Dispatcher Node 14:

**Previous Node:** Dispatcher Node 13
**Next Node:** Dispatcher Node 15

**Node Type:** Script (Transformation)

**Purpose:** Extract data from entry and config for Telegram API call

**Script:**
```javascript
// Parse queue entry
var entryJson = metadata.queueEntry;
var entry = {};

if (typeof entryJson === 'string') {
  try {
    entry = JSON.parse(entryJson);
  } catch (e) {
    return {msg: {error: true, reason: 'Invalid entry JSON'}, metadata: metadata, msgType: msgType};
  }
} else {
  entry = entryJson;
}

// Parse config
var config = metadata.telegram_queue_config;
if (typeof config === 'string') {
  try {
    config = JSON.parse(config);
  } catch (e) {
    return {msg: {error: true, reason: 'Invalid config JSON'}, metadata: metadata, msgType: msgType};
  }
}

// Extract Telegram credentials
var botToken = config.telegram.botToken;
var chatId = config.telegram.chatId;
var text = entry.payload.text;

return {
  msg: {
    entry: entry,
    text: text,
    chatId: chatId,
    botToken: botToken
  },
  metadata: metadata,
  msgType: 'POST_TELEMETRY_REQUEST'
};
```

**Connection:** Success relation → Dispatcher Node 15

---

### Dispatcher Node 15:

**Previous Node:** Dispatcher Node 14
**Next Nodes:** Dispatcher Node 16a/12b/12c (depending on HTTP response)

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
    "text": "${msg.text}",
    "parse_mode": "HTML"
  }
  ```

**Purpose:** Actually send the message to Telegram!

**Connections (by HTTP response):**
- **Success (200-299)** → Dispatcher Node 16 (Switch/Router)
- **Client Error (400-499)** → Dispatcher Node 16 (Switch/Router)
- **Server Error (500-599)** → Dispatcher Node 16 (Switch/Router)
- **Timeout/Network Error** → Dispatcher Node 16 (Switch/Router)

**Important:** Connect ALL output relations from the REST API node to the same Switch node (Node 12). The Switch will route based on status code.

---

### Dispatcher Node 16:

**Previous Node:** Dispatcher Node 15 (all response types)
**Next Nodes:** Node 17a, 13b, or 13c (depending on status code)

**Node Type:** Switch (under "Filter" category)

**Purpose:** Route message to correct status update script based on Telegram API response

**Visual Flow:**
```
[Node 11: REST API Call]
         ↓ (all responses)
[Node 12: SWITCH - Check statusCode]
         ├─ Success (200-299) ──→ [Node 17a: Mark SENT]
         ├─ ClientError (400-499) ──→ [Node 17b: Mark FAILED]
         └─ Retry (500+ or unknown) ──→ [Node 17c: Mark RETRY/FAILED]
                                              ↓
                                              ↓ (all merge here)
                                              ↓
                                        [Node 14: Prepare Index Update]
```

**Script:**
```javascript
// Check the HTTP status code returned by Telegram
var status = metadata.statusCode ? parseInt(metadata.statusCode) : 0;

if (status >= 200 && status < 300) {
    return ['Success']; // Route to Node 17a (Mark SENT)
} else if (status >= 400 && status < 500) {
    return ['ClientError']; // Route to Node 17b (Mark FAILED)
} else {
    return ['Retry']; // Route to Node 17c (Mark RETRY - for 500+ or unknown)
}
```

**Connections - Create these custom relations:**

In ThingsBoard, after creating the Switch node:
1. Click "Add" to create a new relation named **"Success"** → Connect to Node 17a
2. Click "Add" to create a new relation named **"ClientError"** → Connect to Node 17b
3. Click "Add" to create a new relation named **"Retry"** → Connect to Node 17c

The relation names MUST match exactly what the script returns: `['Success']`, `['ClientError']`, `['Retry']`

---

### Dispatcher Node 17:

**Previous Node:** Dispatcher Node 16 (Switch)
**Next Node:** Dispatcher Node 18

**Node Type:** Script (Transformation) - Create 3 SEPARATE nodes with different status logic

**Purpose:** Update entry status based on Telegram API response

**13a: Success Path (200-299) - Mark SENT**
```javascript
var entry = msg.entry;
entry.status = 'SENT';
entry.sentAt = Date.now();
entry.lastAttemptAt = Date.now();

return {
  msg: {entry: entry},
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**13b: Client Error Path (400-499) - Mark FAILED**
```javascript
var entry = msg.entry;
entry.status = 'FAILED';
entry.lastAttemptAt = Date.now();
entry.errorMessage = 'Client error: ' + (metadata.statusCode || 400);

return {
  msg: {entry: entry},
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**13c: Retry Path (500-599 or timeout) - Mark RETRY or FAILED**
```javascript
var entry = msg.entry;

// Parse config for maxRetries
var config = metadata.telegram_queue_config;
if (typeof config === 'string') {
  config = JSON.parse(config);
}
var maxRetries = config.rateControl.maxRetries || 3;

// Increment retry count
entry.retryCount = (entry.retryCount || 0) + 1;
entry.lastAttemptAt = Date.now();

// Check if max retries exceeded
if (entry.retryCount >= maxRetries) {
  entry.status = 'FAILED';
  entry.errorMessage = 'Max retries exceeded';
} else {
  entry.status = 'RETRY';
  entry.errorMessage = 'Retryable error: ' + (metadata.statusCode || 'timeout');
}

return {
  msg: {entry: entry},
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**Connection:** All three scripts (13a, 13b, 13c) connect via Success relation → Dispatcher Node 18

---

### Dispatcher Node 18:

**Previous Node:** Dispatcher Node 17 (any of the 3 versions: 13a, 13b, or 13c)
**Next Node:** Dispatcher Node 19

**Node Type:** Script (Transformation)

**Purpose:** Remove entry from priority index if SENT or FAILED (done), keep if RETRY

**Script:**
```javascript
var entry = msg.entry;
var needsRemoval = (entry.status === 'SENT' || entry.status === 'FAILED');

var attributes = {};

// Always update the entry
attributes['telegram_queue_entry_' + entry.queueId] = JSON.stringify(entry);

if (needsRemoval) {
  // Remove from priority index
  var priority = entry.priority;
  var indexKey = 'telegram_queue_index_priority_' + priority;
  var existingIndex = metadata[indexKey];

  // Parse index
  if (typeof existingIndex === 'string') {
    try {
      existingIndex = JSON.parse(existingIndex);
    } catch (e) {
      existingIndex = [];
    }
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

  attributes[indexKey] = JSON.stringify(newIndex);
}

return {
  msg: {
    attributes: attributes,
    customerId: entry.customerId
  },
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**Connection:** Success relation → Dispatcher Node 19

---

### Dispatcher Node 19:

**Previous Node:** Dispatcher Node 18
**Next Node:** Dispatcher Node 60

**Node Type:** Save Attributes

**Configuration:**
- **Entity:** Customer (use `${msg.customerId}`)
- **Scope:** SERVER_SCOPE
- **Attributes:** `${msg.attributes}`

**Purpose:** Persist updated entry status and modified priority index

**Connection:** Success relation → Dispatcher Node 60

---

### Dispatcher Node 20:

**Previous Node:** Dispatcher Node 19
**Next Node:** Dispatcher Node 61

**Node Type:** Script (Transformation)

**Purpose:** Record that we just dispatched a batch

**Script:**
```javascript
var rateLimitState = metadata.telegram_queue_ratelimit;

// Parse if string
if (typeof rateLimitState === 'string') {
  try {
    rateLimitState = JSON.parse(rateLimitState);
  } catch (e) {
    rateLimitState = {};
  }
}
if (!rateLimitState) {
  rateLimitState = {};
}

// Update timestamp
rateLimitState.lastDispatchAt = Date.now();
rateLimitState.batchCount = (rateLimitState.batchCount || 0) + 1;

var attributes = {};
attributes['telegram_queue_ratelimit'] = JSON.stringify(rateLimitState);

return {
  msg: {attributes: attributes, customerId: metadata.customerId},
  metadata: metadata,
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**Connection:** Success relation → Dispatcher Node 61

---

### Dispatcher Node 21:

**Previous Node:** Dispatcher Node 60
**Next Node:** None (end of flow)

**Node Type:** Save Attributes

**Configuration:**
- **Entity:** Customer (use `${msg.customerId}`)
- **Scope:** SERVER_SCOPE
- **Attributes:** `${msg.attributes}`

**Purpose:** Save the rate limit timestamp so next cycle knows when we last sent

**Connection:** Success relation → Log Success (optional, end of flow)

---

## 📊 Monitor Rule Chain (Collects Metrics)

After the Dispatcher is running, optionally create a Monitor Rule Chain for dashboard visibility.

### What You Need to Create:

**Create NEW Rule Chain:** "Telegram Queue Monitor"

**Trigger:** Timer Generator - Every 300 seconds (5 minutes)

**Purpose:** Calculate queue statistics for dashboard widgets

---

### Monitor Node 1: Generator - Timer Trigger

**Previous Node:** None (starting node)
**Next Node:** Monitor Node 2

**Node Type:** Generator

**Configuration:**
- **Period:** 300 seconds (5 minutes)
- **Originator:** System (or Tenant entity)
- **Message count:** 1
- **Message:** `{}`
- **Metadata:** Leave empty

**Purpose:** Triggers the monitor every 5 minutes for ALL customers

**Connection:** Success relation → Monitor Node 2

---

### Monitor Node 2: Script - Build Customer List

**Previous Node:** Monitor Node 1
**Next Node:** Monitor Node 3

**Node Type:** Script (Transformation)

**Purpose:** Provide list of customer UUIDs to monitor

**Script:**
```javascript
// CONFIGURE THIS: Same customer list as Dispatcher Node 2
var customers = [
  "CUSTOMER_UUID_1",
  "CUSTOMER_UUID_2",
  "CUSTOMER_UUID_3"
  // Add more customer IDs as needed
];

// Return array for Split Array node
return {
  msg: customers,
  metadata: metadata,
  msgType: msgType
};
```

**Note:** Keep this synchronized with Dispatcher Node 2

**Connection:** Success relation → Monitor Node 3

---

### Monitor Node 3: Split Array - Process Each Customer

**Previous Node:** Monitor Node 2
**Next Node:** Monitor Node 4

**Node Type:** Split Array Msg

**Configuration:**
- **No configuration needed** - Automatically iterates over customer UUID array

**Purpose:** Create separate parallel message flow for each customer

**What happens:** If you have 10 customers, Nodes 4-7 will run 10 times in parallel

**Connection:** Success relation → Monitor Node 4

---

### Monitor Node 4: Script - Build Customer Context

**Previous Node:** Monitor Node 3
**Next Node:** Monitor Node 5

**Node Type:** Script (Transformation)

**Purpose:** Convert customer UUID string to metadata object

**Script:**
```javascript
// msg is now a single customer UUID string (from Split Array)
var customerId = msg;

return {
  msg: {},
  metadata: {
    customerId: customerId
  },
  msgType: 'POST_ATTRIBUTES_REQUEST'
};
```

**Connection:** Success relation → Monitor Node 5

---

### Monitor Node 5: Change Originator - Set to Customer

**Previous Node:** Monitor Node 4
**Next Node:** Monitor Node 6

**Node Type:** Change Originator

**Purpose:** Switch message originator to customer entity for enrichment

**Configuration:**
- **Originator source:** Customer
- **Customer ID pattern:** `${metadata.customerId}`

**Connection:** Success relation → Monitor Node 6

---

### Monitor Node 6: Enrichment - Fetch Queue Data

**Previous Node:** Monitor Node 5
**Next Node:** Monitor Node 7

**Node Type:** Customer Attributes (Enrichment)

**Configuration - Fetch these attributes:**
- `telegram_queue_config`
- `telegram_queue_ratelimit`
- `telegram_queue_index_priority_1`
- `telegram_queue_index_priority_2`
- `telegram_queue_index_priority_3`
- `telegram_queue_index_priority_4`

**Connection:** Success relation → Monitor Node 7

---

### Monitor Node 7: Script - Calculate Metrics

**Previous Node:** Monitor Node 6
**Next Node:** Monitor Node 8

**Node Type:** Script (Transformation)

**Purpose:** Count queue depths, calculate wait times

**Script:** Copy entire content from [`rule-chain/scripts/monitor-calculate.js`](rule-chain/scripts/monitor-calculate.js)

**What it calculates:**
```javascript
{
  "queue_depth_priority_1": 5,     // Count of Critical messages
  "queue_depth_priority_2": 12,    // Count of High messages
  "queue_depth_priority_3": 23,    // Count of Medium messages
  "queue_depth_priority_4": 8,     // Count of Low messages
  "total_queue_depth": 48,          // Sum of all priorities
  "time_since_last_dispatch_seconds": 45,  // How long since last send
  "can_send_now": 0,                // 1 if ready, 0 if rate limited
  "wait_time_seconds": 15           // How many seconds until can send
}
```

**Connection:** Success relation → Monitor Node 8

---

### Monitor Node 8: Save Telemetry

**Previous Node:** Monitor Node 7
**Next Node:** None (end of flow)

**Node Type:** Save Telemetry

**Configuration:**
- **Entity:** Customer (originator - the customer whose metrics we're saving)
- **Telemetry:** All fields from `msg` (output of Node 7)
- **TTL:** 0 (keep forever) or set retention period

**Purpose:** Store metrics per customer so you can build ThingsBoard dashboard widgets

**Important:** Each customer will have their own telemetry saved to their Customer entity. This allows you to:
- Build customer-specific dashboards showing their queue metrics
- Monitor individual customer queue health
- Track queue performance per customer

**Alternative Approach:**
If you want centralized monitoring, create one device per customer named `telegram-queue-monitor-{customerId}` and change originator in Node 5 to that device instead of the customer entity.

**Connection:** Success relation → Log Success (optional, end of flow)

---

## 📊 Migration Strategy

### Pre-Migration (Prepare)

- [ ] Deploy Dispatcher Rule Chain (process queue every 60s)
- [ ] Deploy Monitor Rule Chain (collect metrics every 5 minutes)
- [ ] Create `telegram-queue-monitor` virtual device
- [ ] Test with 1 internal customer

### Per-Customer Migration

- [ ] Add `telegram_queue_config` attribute (see Prerequisites)
- [ ] Set `telegram_queue_enabled: false` initially (keeps direct send)
- [ ] Modify your alarm Rule Chain to include hybrid routing (Nodes 2-7 above)
- [ ] Test: Trigger alarm, confirm direct send still works
- [ ] Set `telegram_queue_enabled: true` to switch to queue
- [ ] Monitor for 24 hours:
  - [ ] Check `telegram-queue-monitor` metrics
  - [ ] Verify messages arriving in Telegram
  - [ ] Check for duplicates (both queue AND direct sending)
- [ ] Customer confirms working
- [ ] Mark as migrated

### Rollback Plan

If issues occur:
- [ ] Set `telegram_queue_enabled: false` immediately
- [ ] Customer reverts to direct send instantly (no downtime!)
- [ ] Investigate queue issues offline
- [ ] Fix and retry migration later

---

## 🐛 Troubleshooting

### Problem: Messages Not Enqueueing

**Check:**
1. Filter node routing correctly? (Node 3 should output to SUCCESS for queue path)
2. `telegram_queue_enabled` attribute set to `true`?
3. Script errors? (ThingsBoard Events log)
4. `telegram_queue_config` attribute exists and valid JSON?

**Debug:** Add Log Node after each script to inspect `msg` and `metadata`.

---

### Problem: Messages Not Sending from Queue

**Check:**
1. Dispatcher Rule Chain deployed and active?
2. Generator node triggering every 60s?
3. Rate limited? (Check `time_since_last_dispatch_seconds` metric - must be ≥ 60s)
4. Bot token correct in `telegram_queue_config.telegram.botToken`?
5. Chat ID correct in `telegram_queue_config.telegram.chatId`?

**Debug:** Add Log Node in Dispatcher after rate limit check to see if batches are being built.

---

### Problem: Duplicate Messages (Queue AND Direct)

**Cause:** Filter node not routing correctly

**Fix:** Check Node 3 script - ensure it returns `true` for queue path, `false` for direct path. Verify Success/Failure relations are connected correctly.

---

### Problem: Queue Growing Too Large

**Solutions:**
1. Increase `batchSize` in config (e.g., 5 → 10)
2. Decrease `delayBetweenBatchesSeconds` (e.g., 60 → 30)
3. Add pre-filtering before enqueue (skip low-priority alarms)

---

## 📁 File Structure

```
alarm-queue-setup/
├── README.md (this file - hybrid integration guide)
├── docs/
│   └── RFC-0135-TelegramNotificationQueue.md (full specification)
├── index.js (exports script paths and schemas)
└── rule-chain/
    ├── README.md (technical details)
    ├── scripts/
    │   ├── enqueue-normalize.js (Node 4 script - full version)
    │   ├── enqueue-priority.js (Node 5 script - full version)
    │   ├── dispatch-rate-limit.js (Dispatcher: rate limit check)
    │   ├── dispatch-mark-status.js (Dispatcher: update status)
    │   └── monitor-calculate.js (Monitor: calculate metrics)
    └── helpers/
        └── node-config-examples.md (advanced configuration)
```

---

## 🎓 Key Concepts

### Priority Resolution Cascade

Priority is determined in this order:

1. **Device Override** (highest priority) - Specific device UUID in `deviceOverrides`
2. **Device Profile Rule** - Device type/profile in `deviceProfiles`
3. **Customer Global Default** - Fallback in `globalDefault`
4. **System Default** - 3 (Medium) if nothing configured

Example:
- Device `uuid-123` with profile `3F_MEDIDOR`
- Config: `deviceOverrides: {"uuid-123": 1}`, `deviceProfiles: {"3F_MEDIDOR": 2}`
- Result: Priority = 1 (device override wins)

### Rate Limiting

Prevents spamming Telegram:
- **Batch Size:** Send max N messages per cycle (e.g., 5)
- **Delay:** Wait M seconds between batches (e.g., 60s)
- **Enforcement:** Dispatcher checks `lastDispatchAt` timestamp, skips if `now - lastDispatchAt < delayBetweenBatchesSeconds`

### Retry Logic

Failed sends are retried automatically:
- **Retryable errors:** 429 (rate limit), 5xx (server error), 0 (network)
- **Non-retryable:** 400-499 (client error - bad config)
- **Backoff:**
  - Exponential: 10s → 20s → 40s → 80s
  - Linear: 10s → 20s → 30s → 40s
- **Max retries:** Configurable (default: 3), then marked FAILED

---

## 📊 Comparison: Direct Send vs Queue

| Feature | Direct Send (Old) | Queue System (New) |
|---------|-------------------|---------------------|
| **Rate Limiting** | ❌ No - Telegram may block | ✅ Yes - Configurable |
| **Priority** | ❌ No - All equal | ✅ Yes - 4 levels |
| **Retry** | ❌ No - Lost on failure | ✅ Yes - Exponential backoff |
| **Monitoring** | ❌ No metrics | ✅ Yes - Dashboard ready |
| **Scalability** | ⚠️ Poor - Spams | ✅ Good - Batches |
| **Configuration** | ⚠️ Hardcoded | ✅ Per-customer attributes |
| **Migration** | N/A | ✅ Gradual, zero downtime |

---

## 📞 Support

- **Issues**: File in project repository
- **Questions**: Contact MYIO Platform Team
- **Full Specification**: See `docs/RFC-0135-TelegramNotificationQueue.md`
- **Technical Details**: See `rule-chain/README.md`

---

**RFC-0135 v2.0.0** | Hybrid Integration Guide | © 2026 MYIO Platform
