# RFC-0135: Telegram Notification Queue

A **queued, priority-aware, rate-limited notification pipeline** for sending Telegram messages from ThingsBoard Rule Chains.

## Features

- ✅ **Priority-based dispatch** (1=Critical, 2=High, 3=Medium, 4=Low)
- ✅ **Rate limiting** with configurable batch size and delay
- ✅ **Automatic retry** with exponential/linear backoff
- ✅ **ThingsBoard Attributes storage** (no external database required)
- ✅ **Rule Chain integration** via Function Nodes
- ✅ **Comprehensive logging** with RFC-0122 LogHelper
- ✅ **Customer-level configuration** with per-device overrides
- ✅ **Monitoring dashboard** support with telemetry metrics

## Architecture

```
┌─────────────────────────────┐
│ ThingsBoard Rule Chain      │
│ Transformation Script       │
│ (builds Telegram payload)   │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Enqueue Function            │
│ - Normalize payload         │
│ - Resolve priority          │
│ - Persist to queue          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Dispatcher (every 60s)      │
│ - Check rate limits         │
│ - Dequeue batch by priority │
│ - Send to Telegram API      │
│ - Update status             │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Telegram Bot API            │
└─────────────────────────────┘
```

## Understanding the Rule Chain Process

The Telegram Queue system integrates with ThingsBoard through **three separate Rule Chain flows**. Each flow serves a specific purpose and runs independently.

### Flow 1: Message Enqueue (Event-Driven)

**Trigger**: Device alarm or telemetry event
**Frequency**: On-demand (whenever an event occurs)
**Purpose**: Capture notification requests and add them to the queue

```
┌─────────────────┐
│ Device Event    │ ← Alarm triggers, telemetry updates, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ MESSAGE ORIGINATOR                                  │
│ (Root Rule Chain: Alarm notification logic)         │
│ - Filters events (e.g., only critical alarms)       │
│ - Enriches with device metadata                     │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ TRANSFORMATION NODE                                 │
│ Purpose: Build Telegram message payload             │
│                                                      │
│ Input:  Device alarm/telemetry data                 │
│ Output: Formatted message object                    │
│                                                      │
│ Example Script:                                     │
│ ```javascript                                       │
│ var deviceName = msg.deviceName || "Unknown";      │
│ var alarmType = msg.alarmType || "Alert";          │
│ var severity = metadata.ss_severity || "INFO";     │
│                                                      │
│ var text = "⚠️ " + severity + " - " + deviceName;  │
│ text += "\n" + alarmType;                          │
│ text += "\nTime: " + new Date().toLocaleString(); │
│                                                      │
│ return {                                            │
│   msg: { text: text },                             │
│   metadata: {                                       │
│     deviceType: msg.deviceType,                    │
│     deviceName: deviceName,                        │
│     deviceId: metadata.deviceId,                   │
│     customerId: metadata.customerId,               │
│     ts: Date.now().toString()                      │
│   },                                                │
│   msgType: "POST_TELEMETRY_REQUEST"                │
│ };                                                  │
│ ```                                                 │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ FUNCTION NODE: Enqueue                              │
│ Purpose: Add message to priority queue              │
│                                                      │
│ What it does:                                       │
│ 1. Normalizes payload structure                    │
│ 2. Resolves priority based on device profile       │
│    - Checks device overrides (highest priority)    │
│    - Checks device profile rules                   │
│    - Falls back to customer global default         │
│    - Falls back to system default (3=Medium)       │
│ 3. Generates unique queue ID                       │
│ 4. Saves to ThingsBoard SERVER_SCOPE attributes:   │
│    - telegram_queue_entry_{queueId}                │
│    - telegram_queue_index_priority_{1-4}           │
│ 5. Returns success with queueId                    │
│                                                      │
│ Code:                                               │
│ ```javascript                                       │
│ return (async function() {                         │
│   const { enqueueFunction } = await import(       │
│     'myio-js-library'                              │
│   );                                                │
│   return await enqueueFunction(                    │
│     msg, metadata, msgType                         │
│   );                                                │
│ })();                                               │
│ ```                                                 │
│                                                      │
│ Output: { queueId, status: "PENDING", priority }   │
└─────────────────────────────────────────────────────┘
```

**Storage After Enqueue**:
```json
// Customer attribute: telegram_queue_entry_{queueId}
{
  "queueId": "a1b2c3d4-...",
  "customerId": "customer-uuid",
  "deviceId": "device-uuid",
  "deviceProfile": "3F_MEDIDOR",
  "priority": 2,
  "payload": {
    "text": "⚠️ HIGH - Medidor Loja 101\nConsumo elevado\n..."
  },
  "status": "PENDING",
  "retryCount": 0,
  "maxRetries": 3,
  "createdAt": 1767878649180,
  "lastAttemptAt": null
}

// Customer attribute: telegram_queue_index_priority_2
["a1b2c3d4-...", "e5f6g7h8-...", ...]
```

---

### Flow 2: Message Dispatch (Scheduled)

**Trigger**: Generator Node (timer)
**Frequency**: Every 60 seconds
**Purpose**: Process queue and send messages to Telegram

```
┌─────────────────┐
│ GENERATOR NODE  │ ← Triggers every 60 seconds
│ Period: 60s     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ FUNCTION NODE: Dispatcher                           │
│ Purpose: Batch process and send queued messages     │
│                                                      │
│ Step 1: CHECK MUTEX                                 │
│ - Prevents concurrent dispatch runs                 │
│ - Uses module-level _isDispatching flag            │
│ - Returns early if already dispatching             │
│                                                      │
│ Step 2: LOAD CUSTOMER CONFIG                        │
│ - Reads telegram_queue_config attribute            │
│ - Extracts rateControl settings                    │
│ - Extracts Telegram bot credentials                │
│                                                      │
│ Step 3: CHECK RATE LIMIT                            │
│ - Reads telegram_queue_ratelimit_{customerId}      │
│ - Compares time since last dispatch                │
│ - If too soon: exit and wait for next cycle        │
│ - If ready: proceed to dequeue                     │
│                                                      │
│ Step 4: DEQUEUE BATCH                               │
│ - Reads index attributes by priority:              │
│   1. telegram_queue_index_priority_1 (Critical)    │
│   2. telegram_queue_index_priority_2 (High)        │
│   3. telegram_queue_index_priority_3 (Medium)      │
│   4. telegram_queue_index_priority_4 (Low)         │
│ - Takes up to batchSize entries (e.g., 5)          │
│ - Fetches full entry for each queue ID             │
│ - Filters for PENDING and RETRY status             │
│ - Checks retry delay for RETRY entries             │
│                                                      │
│ Step 5: SEND TO TELEGRAM                            │
│ For each entry in batch:                           │
│   a. Update status → SENDING                       │
│   b. POST to Telegram Bot API:                     │
│      https://api.telegram.org/bot{token}/sendMessage│
│   c. Handle response:                               │
│      • 200 OK → Update to SENT, record sentAt     │
│      • 429 Rate Limit → Update to RETRY, backoff  │
│      • 400 Bad Request → Update to FAILED         │
│      • 5xx Server Error → Update to RETRY         │
│      • Network Error → Update to RETRY            │
│   d. If RETRY: Check retryCount < maxRetries      │
│      • If yes: status = RETRY, increment count    │
│      • If no: status = FAILED (permanent)         │
│   e. Remove from priority index if SENT/FAILED    │
│                                                      │
│ Step 6: RECORD BATCH DISPATCH                       │
│ - Update telegram_queue_ratelimit_{customerId}:    │
│   {                                                 │
│     lastDispatchAt: Date.now(),                    │
│     batchCount: previous + 1                       │
│   }                                                 │
│                                                      │
│ Step 7: RETURN SUMMARY                              │
│ - sentCount, failedCount, retryCount               │
│ - Logged for monitoring                            │
│                                                      │
│ Code:                                               │
│ ```javascript                                       │
│ return (async function() {                         │
│   const { dispatchFunction } = await import(      │
│     'myio-js-library'                              │
│   );                                                │
│   return await dispatchFunction(                   │
│     msg, metadata, msgType                         │
│   );                                                │
│ })();                                               │
│ ```                                                 │
└─────────────────────────────────────────────────────┘
```

**Rate Limiting Example**:
```javascript
// Customer config: delayBetweenBatchesSeconds = 60
// Last dispatch: 2024-01-08 10:00:00 (sent 5 messages)
// Current time:  2024-01-08 10:00:45 (45 seconds later)

// Check: 45 < 60 → Wait 15 more seconds
// Dispatcher exits, will retry next cycle (60s from now)

// Next cycle:    2024-01-08 10:01:00
// Check: 60 >= 60 → Can send!
// Dequeue next batch and dispatch
```

**Retry Backoff Examples**:

**Exponential** (default):
```
Retry 0: Wait 10s  (10 * 2^0)
Retry 1: Wait 20s  (10 * 2^1)
Retry 2: Wait 40s  (10 * 2^2)
Retry 3: Wait 80s  (10 * 2^3) → Then mark FAILED
```

**Linear**:
```
Retry 0: Wait 10s  (10 * 1)
Retry 1: Wait 20s  (10 * 2)
Retry 2: Wait 30s  (10 * 3)
Retry 3: Wait 40s  (10 * 4) → Then mark FAILED
```

---

### Flow 3: Queue Monitoring (Scheduled)

**Trigger**: Generator Node (timer)
**Frequency**: Every 5 minutes
**Purpose**: Collect metrics for dashboard visualization

```
┌─────────────────┐
│ GENERATOR NODE  │ ← Triggers every 300 seconds (5 min)
│ Period: 300s    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ FUNCTION NODE: Monitor                              │
│ Purpose: Collect queue statistics                   │
│                                                      │
│ What it does:                                       │
│ 1. Reads all queue index attributes:                │
│    - telegram_queue_index_priority_1/2/3/4         │
│    - Counts entries in each                        │
│                                                      │
│ 2. Scans queue entries to calculate:               │
│    - pendingCount (status = PENDING)               │
│    - retryCount (status = RETRY)                   │
│    - failedCount (status = FAILED)                 │
│    - sentCount (recent, last hour)                 │
│                                                      │
│ 3. Calculates average dispatch delay:              │
│    - (sentAt - createdAt) for recently sent msgs   │
│                                                      │
│ 4. Reads rate limit state:                         │
│    - telegram_queue_ratelimit_{customerId}         │
│    - timeSinceLastDispatch                         │
│    - canSendNow (boolean)                          │
│    - waitTimeSeconds                               │
│                                                      │
│ 5. Returns telemetry object                        │
│                                                      │
│ Code:                                               │
│ ```javascript                                       │
│ return (async function() {                         │
│   const { monitorFunction } = await import(       │
│     'myio-js-library'                              │
│   );                                                │
│   return await monitorFunction(                    │
│     msg, metadata, msgType                         │
│   );                                                │
│ })();                                               │
│ ```                                                 │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ SAVE TELEMETRY NODE                                 │
│ Target: Virtual device "telegram-queue-monitor"     │
│                                                      │
│ Telemetry data:                                     │
│ {                                                    │
│   "queue_depth_priority_1": 2,                     │
│   "queue_depth_priority_2": 5,                     │
│   "queue_depth_priority_3": 12,                    │
│   "queue_depth_priority_4": 8,                     │
│   "pending_count": 27,                             │
│   "failed_count": 3,                               │
│   "retry_count": 5,                                │
│   "sent_count": 120,                               │
│   "average_dispatch_delay_seconds": 45,            │
│   "time_since_last_dispatch_seconds": 30,          │
│   "can_send_now": 0,                               │
│   "wait_time_seconds": 30,                         │
│   "total_queue_depth": 27,                         │
│   "timestamp": 1767878649180                       │
│ }                                                    │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ DASHBOARD WIDGETS                                   │
│ - Line chart: total_queue_depth over time          │
│ - Bar chart: queue depth by priority               │
│ - Gauge: average_dispatch_delay_seconds            │
│ - Status indicator: can_send_now                   │
│ - Counter: failed_count, sent_count                │
└─────────────────────────────────────────────────────┘
```

---

### Complete Rule Chain Setup

**Rule Chain 1: Enqueue Flow**
```
[Device] → [Message Type Switch] → [Transformation] → [Enqueue Function]
                                                              │
                                                              ▼
                                                     [Log Success/Error]
```

**Rule Chain 2: Dispatcher Flow**
```
[Generator 60s] → [Dispatch Function] → [Log Results]
```

**Rule Chain 3: Monitor Flow**
```
[Generator 300s] → [Monitor Function] → [Save Telemetry] → [Virtual Device]
```

**Visual in ThingsBoard UI**:
```
Enqueue Rule Chain:
┌──────────┐     ┌─────────────┐     ┌────────────┐
│  Alarm   │────▶│ Transform   │────▶│  Enqueue   │
│ Trigger  │     │   Message   │     │  Function  │
└──────────┘     └─────────────┘     └────────────┘

Dispatch Rule Chain:
┌──────────┐     ┌────────────┐
│Generator │────▶│  Dispatch  │
│  (60s)   │     │  Function  │
└──────────┘     └────────────┘

Monitor Rule Chain:
┌──────────┐     ┌────────────┐     ┌──────────┐
│Generator │────▶│  Monitor   │────▶│   Save   │
│ (300s)   │     │  Function  │     │Telemetry │
└──────────┘     └────────────┘     └──────────┘
```

## Installation

```bash
npm install myio-js-library
```

## Quick Start

### 1. Configure Customer Attributes

In ThingsBoard, add the `telegram_queue_config` attribute to your customer (SERVER_SCOPE):

```json
{
  "enabled": true,
  "priorityRules": {
    "deviceProfiles": {
      "3F_MEDIDOR": 2,
      "HIDROMETRO": 2,
      "ENTRADA": 1,
      "TERMOSTATO": 4
    },
    "deviceOverrides": {
      "critical-device-uuid": 1
    },
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

### 2. Create Service Account

Create a ThingsBoard user for queue operations:
- Username: `telegram-queue-service@myio.com.br`
- Password: (set securely)
- Role: CUSTOMER_USER with permissions to read/write customer attributes

### 3. Set Up Rule Chain

#### Enqueue Flow

1. **Transformation Node** - Build message payload:
```javascript
// Build Telegram message
var text = "Alert: " + msg.deviceName + " - " + msg.alarmType;

return {
  msg: {
    text: text
  },
  metadata: {
    deviceType: msg.deviceType,
    deviceName: msg.deviceName,
    deviceId: metadata.deviceId,
    customerId: metadata.customerId,
    ts: Date.now().toString()
  },
  msgType: "POST_TELEMETRY_REQUEST"
};
```

2. **Function Node: Enqueue** - Use library import:
```javascript
return (async function() {
  const { enqueueFunction } = await import('myio-js-library');
  return await enqueueFunction(msg, metadata, msgType);
})();
```

**OR** copy-paste the standalone version from [enqueueFunction.js](v1.0.0/functions/enqueueFunction.js) (see `enqueueFunctionStandalone` export).

#### Dispatch Flow

1. **Generator Node** - Trigger every 60 seconds
2. **Function Node: Dispatcher** - Use library import:
```javascript
return (async function() {
  const { dispatchFunction } = await import('myio-js-library');
  return await dispatchFunction(msg, metadata, msgType);
})();
```

**OR** copy-paste the standalone version from [dispatchFunction.js](v1.0.0/functions/dispatchFunction.js) (see `dispatchFunctionStandalone` export).

#### Monitor Flow

1. **Generator Node** - Trigger every 5 minutes
2. **Function Node: Monitor** - Use library import:
```javascript
return (async function() {
  const { monitorFunction } = await import('myio-js-library');
  return await monitorFunction(msg, metadata, msgType);
})();
```

3. **Save Telemetry Node** - Save to virtual device `telegram-queue-monitor`

## Library API

### Core Operations

```javascript
import {
  normalizePayload,
  enqueue,
  dequeue,
  updateStatus,
  getQueueStats,
  createQueue
} from 'myio-js-library';

// Create queue instance
const queue = await createQueue({
  baseUrl: 'https://tb.example.com',
  customerId: 'customer-uuid',
  serviceAccount: {
    username: 'telegram-queue-service@myio.com.br',
    password: 'your-password'
  }
});

// Enqueue message
const normalized = normalizePayload(msg, context);
normalized.priority = 1; // Critical
const queueId = await queue.enqueue(normalized);

// Dequeue batch
const batch = await queue.dequeue(5);

// Get statistics
const stats = await queue.getStats();
console.log(`Pending: ${stats.pendingCount}, Failed: ${stats.failedCount}`);
```

### Priority Resolution

```javascript
import {
  resolvePriority,
  buildDefaultCustomerConfig,
  validateCustomerConfig
} from 'myio-js-library';

// Resolve priority for device
const priority = await resolvePriority(
  config,
  'customer-id',
  'device-id',
  '3F_MEDIDOR'
);

// Create default config
const defaultConfig = buildDefaultCustomerConfig({
  telegram: {
    botToken: 'your-token',
    chatId: 'your-chat-id'
  }
});

// Validate config
const validation = validateCustomerConfig(customerConfig);
if (!validation.valid) {
  console.error('Invalid config:', validation.errors);
}
```

### Rate Limiting

```javascript
import {
  canSendBatch,
  getWaitTime,
  recordBatchDispatch,
  calculateRetryDelay
} from 'myio-js-library';

// Check if can send
if (await canSendBatch(config, customerId)) {
  // Send batch
  await sendBatch();
  await recordBatchDispatch(config, customerId, batchSize);
} else {
  const waitMs = await getWaitTime(config, customerId);
  console.log(`Wait ${Math.ceil(waitMs / 1000)}s`);
}

// Calculate retry delay
const delay = calculateRetryDelay(2, 'exponential', 10);
// Result: 40000ms (10s * 2^2)
```

### Telegram Client

```javascript
import {
  sendMessage,
  validateTelegramConfig,
  isRetryableError,
  truncateMessage
} from 'myio-js-library';

// Validate config
const validation = await validateTelegramConfig({
  botToken: 'your-token',
  chatId: 'your-chat-id'
}, true); // Send test message

if (validation.valid) {
  console.log(`Bot: ${validation.botInfo.first_name}`);
}

// Send message
try {
  const response = await sendMessage({
    botToken: 'your-token',
    chatId: 'your-chat-id'
  }, 'Hello from Queue!');
  console.log(`Sent: ${response.result.message_id}`);
} catch (error) {
  if (isRetryableError(error)) {
    // Queue for retry
  } else {
    // Permanent failure
  }
}

// Truncate long messages
const text = truncateMessage(veryLongText, 4096);
```

### Storage Adapter

```javascript
import {
  ThingsboardStorageAdapter,
  validateQueueEntry
} from 'myio-js-library';

// Create storage adapter
const storage = new ThingsboardStorageAdapter({
  baseUrl: 'https://tb.example.com',
  customerId: 'customer-uuid',
  serviceAccount: {
    username: 'telegram-queue-service@myio.com.br',
    password: 'your-password'
  }
});

await storage.initialize();

// Validate entry before saving
const validation = validateQueueEntry(entry);
if (validation.valid) {
  await storage.save(entry);
}

// Get statistics
const stats = await storage.getStats('customer-id');

// Cleanup old entries (30 days)
const deleted = await storage.deleteOlderThan(
  Date.now() - 30 * 24 * 60 * 60 * 1000,
  'customer-id'
);
```

## Configuration Reference

### Customer Queue Config (SERVER_SCOPE Attribute)

```typescript
{
  // Enable/disable queue for customer
  enabled: boolean;

  // Priority rules
  priorityRules: {
    // Device profile → priority mapping
    deviceProfiles: {
      [profileName: string]: 1 | 2 | 3 | 4;
    };

    // Device-specific overrides (highest priority)
    deviceOverrides: {
      [deviceId: string]: 1 | 2 | 3 | 4;
    };

    // Global default for this customer
    globalDefault?: 1 | 2 | 3 | 4;
  };

  // Rate control settings
  rateControl: {
    // Number of messages per batch
    batchSize: number;

    // Delay between batches (seconds)
    delayBetweenBatchesSeconds: number;

    // Maximum retry attempts
    maxRetries: number;

    // Retry backoff strategy
    retryBackoff: 'exponential' | 'linear';

    // Base delay for retries (seconds, optional)
    retryBaseDelaySeconds?: number;
  };

  // Telegram configuration
  telegram: {
    // Bot token from @BotFather
    botToken: string;

    // Chat or group ID
    chatId: string;

    // Parse mode (optional)
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';

    // Disable notification sound (optional)
    disableNotification?: boolean;
  };
}
```

### Priority Levels

| Priority | Level | Use Case |
|----------|-------|----------|
| 1 | **Critical** | Entrada devices, infrastructure alarms |
| 2 | **High** | 3F_MEDIDOR, HIDROMETRO_SHOPPING |
| 3 | **Medium** | Regular meters, general notifications |
| 4 | **Low** | Thermostats, informational messages |

### Rate Control Examples

**Conservative (e-commerce):**
```json
{
  "batchSize": 5,
  "delayBetweenBatchesSeconds": 60,
  "maxRetries": 3,
  "retryBackoff": "exponential"
}
```

**Aggressive (internal monitoring):**
```json
{
  "batchSize": 10,
  "delayBetweenBatchesSeconds": 30,
  "maxRetries": 5,
  "retryBackoff": "linear"
}
```

## Monitoring & Observability

### Telemetry Metrics

The monitor function publishes these metrics (every 5 minutes):

| Metric | Description |
|--------|-------------|
| `queue_depth_priority_1` | Pending messages with priority 1 |
| `queue_depth_priority_2` | Pending messages with priority 2 |
| `queue_depth_priority_3` | Pending messages with priority 3 |
| `queue_depth_priority_4` | Pending messages with priority 4 |
| `pending_count` | Total pending messages |
| `failed_count` | Total permanently failed messages |
| `retry_count` | Total messages queued for retry |
| `sent_count` | Total sent messages (recent) |
| `average_dispatch_delay_seconds` | Average time from enqueue to send |
| `time_since_last_dispatch_seconds` | Time since last batch |
| `can_send_now` | Whether dispatcher can send (1=yes, 0=no) |
| `wait_time_seconds` | Wait time before next batch |
| `total_queue_depth` | Sum of all priority queues |

### Dashboard Widgets

Create ThingsBoard widgets using the telemetry data:

1. **Queue Depth Chart** - Line chart showing `total_queue_depth` over time
2. **Priority Distribution** - Bar chart of `queue_depth_priority_*`
3. **Success Rate** - Calculate from `sent_count` vs `failed_count`
4. **Average Delay** - Gauge showing `average_dispatch_delay_seconds`

## Troubleshooting

### Messages not being sent

1. Check customer config: `telegram_queue_config` attribute exists
2. Verify `enabled: true`
3. Check bot token and chat ID
4. Verify dispatcher is running (Generator Node active)
5. Check rate limits: `wait_time_seconds` metric
6. Review ThingsBoard logs for errors

### High queue depth

1. Increase `batchSize` in rate control
2. Decrease `delayBetweenBatchesSeconds`
3. Check for Telegram API rate limits (429 errors)
4. Verify messages are valid (not too long)

### Messages failing permanently

1. Validate bot token: Run `validateTelegramConfig()`
2. Check chat ID is correct
3. Ensure bot is member of group (for group chats)
4. Review `failed_count` telemetry
5. Check queue entries for `errorMessage` field

### Priority not working

1. Verify priority rules in customer config
2. Check device profile names match exactly
3. Use device overrides for critical devices
4. Review logs: `[OPERATION: priorityResolve]` entries
5. Clear priority cache if rules were updated

## Migration from Direct Telegram API

### Before (Direct API)

```
Transformation → REST API Call (Telegram)
```

### After (Queue System)

```
Transformation → Enqueue Function → Queue
                                   ↓
Generator → Dispatcher → Telegram API
```

### Migration Steps

1. Deploy queue infrastructure (service account, Rule Chains)
2. Configure customer attributes (`telegram_queue_config`)
3. Test with one customer first
4. Monitor queue metrics
5. Migrate remaining customers
6. Archive old direct API nodes

## Security Considerations

- **Bot tokens** stored encrypted in customer attributes (SERVER_SCOPE)
- **Service account** has minimal permissions (read customer attrs, write telemetry)
- **Logs** mask tokens (show only first 10 chars)
- **Attribute access** restricted to CUSTOMER_USER role
- **No plaintext secrets** in Rule Chain code

## Performance

### Benchmarks

- **Enqueue**: < 50ms per message
- **Dequeue**: < 100ms for batch of 100
- **Dispatch**: < 500ms per message (including Telegram API)
- **Storage**: Supports 1000+ entries per customer

### Scaling

- **Horizontal**: Multiple Rule Chain instances share queue (via ThingsBoard attributes)
- **Vertical**: Increase batch size and frequency
- **Limitations**: ThingsBoard attributes limited to ~1000 entries per customer

## Future Enhancements

- [ ] External database support (PostgreSQL/Redis) for higher throughput
- [ ] Multi-channel support (Email, WhatsApp, Webhooks)
- [ ] SLA-based escalation rules
- [ ] Dead-letter queue for permanently failed messages
- [ ] Message deduplication window
- [ ] Scheduled quiet hours per customer
- [ ] Premium Setup Panel UI widget

## Contributing

See [CLAUDE.md](../../.claude/CLAUDE.md) for development patterns and conventions.

## License

Internal MYIO Platform - Not for public distribution

## Support

For issues, contact the MYIO Platform Team or file an issue in the project repository.

---

**RFC-0135** | Version 1.0.0 | © 2026 MYIO Platform
