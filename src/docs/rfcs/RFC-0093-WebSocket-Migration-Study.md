# RFC-0093: WebSocket Migration Study - Real-Time Telemetry via ThingsBoard WebSocket API

- **Status**: Draft (Study) → Ready for Implementation
- **Created**: 2025-12-03
- **Updated**: 2025-12-03 (Review-001 incorporated)
- **Author**: MyIO Team
- **Supersedes**: REST polling mode in RFC-0093-Equipments-Grid-RealTime-Mode

## Scope Declaration

> **This document supersedes the REST polling real-time mode defined in RFC-0093-Equipments-Grid-RealTime-Mode-FULL-IMPLEMENTATION.md.**
> WebSocket becomes the **default engine**. REST polling remains **only as fallback** when WebSocket fails.

### Functions Being Replaced

| Old (REST Polling) | New (WebSocket) |
|-------------------|-----------------|
| `fetchDevicePower()` | `WebSocketService.subscribe()` |
| `fetchAllDevicesPowerAndUpdate()` | `onData()` callback |
| `setInterval()` polling loop | Persistent connection |
| `runRealtimeCycle()` | Event-driven updates |

---

## Executive Summary

Este documento define a migração do modo real-time do widget EQUIPMENTS de polling REST API para WebSocket API do ThingsBoard, alcançando true real-time updates com latência < 100ms.

---

## Current Implementation (REST Polling) - DEPRECATED

```
┌─────────────────────────────────────────────────────────────────┐
│                     EQUIPMENTS Widget                            │
│                                                                  │
│  ┌─────────────────────┐                                        │
│  │  RealTimeService    │    Polling Loop (30s interval)         │
│  │  ─────────────────  │                                        │
│  │  - setInterval 30s  │───▶ For each device:                   │
│  │  - batch 10 devices │     GET /api/plugins/telemetry/DEVICE  │
│  │  - 50ms delay       │         /{id}/values/timeseries        │
│  └─────────────────────┘         ?keys=power&limit=1            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Problems with Polling

| Problem | Impact |
|---------|--------|
| Minimum latency 30s | Not true real-time |
| N HTTP calls per cycle | High bandwidth and CPU |
| No order guarantee | Data may arrive out of order |
| Connection overhead | TCP handshake per request |
| Server load | Multiple DB queries per cycle |

---

## Proposed Implementation (WebSocket) - DEFAULT

```
┌─────────────────────────────────────────────────────────────────┐
│                     EQUIPMENTS Widget                            │
│                                                                  │
│  ┌─────────────────────┐    Single WebSocket Connection         │
│  │  WebSocketService   │                                        │
│  │  ─────────────────  │    wss://host/api/ws + authCmd         │
│  │  - single connection│◀──────────────────────────────────────▶│
│  │  - ENTITY_DATA cmd  │    Push updates (instant)              │
│  │  - auto-reconnect   │                                        │
│  └─────────────────────┘                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Normative Specifications

### 1. Connection Endpoint (MANDATORY)

```javascript
// MUST use this URL format:
const WS_URL = `wss://dashboard.myio-bas.com/api/ws`;

// Authentication MUST be sent via authCmd after connection opens
// DO NOT use token in query string
```

### 2. Authentication (MANDATORY)

```javascript
// MUST send within 10 seconds of connection open:
const authCmd = {
  authCmd: {
    cmdId: 0,
    token: JWT_TOKEN  // From localStorage.getItem('jwt_token')
  }
};
ws.send(JSON.stringify(authCmd));
```

### 3. Command Type (MANDATORY: ENTITY_DATA)

**For Equipments Grid, MUST use `ENTITY_DATA` with `entityList`:**

```javascript
// Standard subscription command for multiple devices:
const subscribeCmd = {
  cmds: [{
    cmdId: uniqueCmdId,
    type: "ENTITY_DATA",
    query: {
      entityFilter: {
        type: "entityList",
        entityType: "DEVICE",
        entityList: deviceIds  // Array of device UUIDs
      },
      entityFields: [
        { type: "ENTITY_FIELD", key: "name" }
      ],
      latestValues: [
        { type: "TIME_SERIES", key: "power" }
      ]
    }
  }]
};
```

> **Note**: `TIMESERIES` command type is reserved for single-device widgets (e.g., DemandModal). Do NOT use for grid.

### 4. Response Handling (MANDATORY)

```javascript
// Initial data response:
{
  "cmdId": 1,
  "data": {
    "data": [
      {
        "entityId": { "entityType": "DEVICE", "id": "device-uuid" },
        "latest": {
          "TIME_SERIES": {
            "power": { "ts": 1733234567890, "value": "3420" }  // Watts
          }
        }
      }
    ]
  }
}

// Subsequent updates (push):
{
  "cmdId": 1,
  "update": [
    {
      "entityId": { "entityType": "DEVICE", "id": "device-uuid" },
      "latest": {
        "TIME_SERIES": {
          "power": { "ts": 1733234568000, "value": "3450" }
        }
      }
    }
  ]
}
```

### 5. Unsubscribe (MANDATORY before new subscribe)

```javascript
const unsubscribeCmd = {
  cmds: [{
    cmdId: previousCmdId,
    type: "ENTITY_DATA_UNSUBSCRIBE"
  }]
};
```

---

## Integration with Equipments Grid

### State Integration

```javascript
// WebSocket onData callback MUST update these STATE properties:
STATE.realTimePowerMap.set(deviceId, { value, timestamp });

// And trigger card update:
updateCardPowerDisplay(deviceId, { value, timestamp });
```

### Filter/Pagination Flow

```
User changes filter/search
        │
        ▼
┌─────────────────────────┐
│ Debounce (300ms)        │  ◄── Prevents flood on fast typing
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ Compute visible IDs     │  ◄── Apply filters to STATE.allDevices
│ const visibleIds = ...  │
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ Unsubscribe old cmdId   │  ◄── Clean up previous subscription
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ Subscribe(visibleIds)   │  ◄── New subscription with filtered list
└─────────────────────────┘
```

### Integration Code

```javascript
// In EQUIPMENTS controller:
let currentSubscriptionCmdId = null;
let filterDebounceTimer = null;

function onFilterChange() {
  // Debounce to prevent flood
  clearTimeout(filterDebounceTimer);
  filterDebounceTimer = setTimeout(() => {
    const visibleDeviceIds = getVisibleDeviceIds();

    // Unsubscribe previous
    if (currentSubscriptionCmdId !== null) {
      websocketService.unsubscribe(currentSubscriptionCmdId);
    }

    // Subscribe to new list
    if (visibleDeviceIds.length > 0) {
      currentSubscriptionCmdId = websocketService.subscribe(visibleDeviceIds);
    }
  }, 300);  // 300ms debounce
}

// onData callback - updates STATE and UI
function handleWebSocketData(deviceId, key, value, timestamp) {
  if (key === 'power') {
    STATE.realTimePowerMap.set(deviceId, { value, timestamp });
    updateCardPowerDisplay(deviceId, { value, timestamp });
  }
}
```

---

## Reconnection Strategy (NORMATIVE)

### Backoff Schedule (MUST implement)

| Attempt | Delay |
|---------|-------|
| 1 | 1 second |
| 2 | 2 seconds |
| 3 | 5 seconds |
| 4 | 10 seconds |
| 5 | 30 seconds |
| 6+ | Fallback to REST |

### Token Refresh Handling

```javascript
// MUST check token freshness on reconnect:
async function reconnect() {
  // Get fresh token (may have been refreshed by auth module)
  const freshToken = localStorage.getItem('jwt_token');

  await this.connect();
  this.authenticate(freshToken);  // Use fresh token

  // Re-subscribe to previously subscribed devices
  if (this.lastSubscribedDevices.length > 0) {
    this.subscribe(this.lastSubscribedDevices);
  }
}
```

---

## Engine Selection and Fallback

### Engine Type Definition

```typescript
type RealTimeEngine = 'websocket' | 'rest';

const REALTIME_CONFIG = {
  ENGINE: 'websocket' as RealTimeEngine,  // Default
  FALLBACK_AFTER_FAILURES: 6,             // Switch to REST after 6 failures
  REST_INTERVAL_MS: 30000,                // REST polling interval
};
```

### Fallback Logic

```javascript
let consecutiveFailures = 0;
let currentEngine: RealTimeEngine = REALTIME_CONFIG.ENGINE;

function onWebSocketError() {
  consecutiveFailures++;

  if (consecutiveFailures >= REALTIME_CONFIG.FALLBACK_AFTER_FAILURES) {
    LogHelper.warn('[RealTime] WebSocket failed 6 times, falling back to REST');

    // Show user notification
    MyIOToast.warning(
      'Modo real-time via WebSocket indisponível. Usando polling REST.',
      { duration: 5000 }
    );

    // Switch engine for this session
    currentEngine = 'rest';
    startPollingMode();
  } else {
    scheduleReconnect();
  }
}

function onWebSocketSuccess() {
  consecutiveFailures = 0;  // Reset on success
}
```

---

## Complete Implementation

```javascript
class RealTimeWebSocketService {
  constructor(config) {
    this.config = {
      wsUrl: 'wss://dashboard.myio-bas.com/api/ws',
      keys: ['power'],
      onData: () => {},
      onConnectionChange: () => {},
      onError: () => {},
      autoReconnect: true,
      ...config
    };

    this.ws = null;
    this.cmdIdCounter = 0;
    this.currentCmdId = null;
    this.lastSubscribedDevices = [];
    this.reconnectAttempts = 0;
    this.backoffSchedule = [1000, 2000, 5000, 10000, 30000];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('jwt_token');
      if (!token) {
        reject(new Error('No JWT token available'));
        return;
      }

      this.ws = new WebSocket(this.config.wsUrl);

      this.ws.onopen = () => {
        LogHelper.log('[WebSocket] Connected');
        this.authenticate(token);
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onclose = (event) => {
        LogHelper.log('[WebSocket] Disconnected:', event.code);
        this.config.onConnectionChange(false);

        if (this.config.autoReconnect && event.code !== 1000) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        LogHelper.error('[WebSocket] Error:', error);
        this.config.onError(error);
        reject(error);
      };
    });
  }

  authenticate(token) {
    const authCmd = {
      authCmd: {
        cmdId: this.nextCmdId(),
        token: token
      }
    };
    this.ws.send(JSON.stringify(authCmd));
  }

  subscribe(deviceIds) {
    if (!this.isConnected()) {
      LogHelper.warn('[WebSocket] Not connected, cannot subscribe');
      return null;
    }

    // Unsubscribe previous if exists
    if (this.currentCmdId !== null) {
      this.unsubscribe(this.currentCmdId);
    }

    const cmdId = this.nextCmdId();

    const subscribeCmd = {
      cmds: [{
        cmdId: cmdId,
        type: "ENTITY_DATA",
        query: {
          entityFilter: {
            type: "entityList",
            entityType: "DEVICE",
            entityList: deviceIds
          },
          entityFields: [
            { type: "ENTITY_FIELD", key: "name" }
          ],
          latestValues: this.config.keys.map(key => ({
            type: "TIME_SERIES",
            key: key
          }))
        }
      }]
    };

    this.ws.send(JSON.stringify(subscribeCmd));
    this.currentCmdId = cmdId;
    this.lastSubscribedDevices = [...deviceIds];

    LogHelper.log(`[WebSocket] Subscribed to ${deviceIds.length} devices (cmdId: ${cmdId})`);
    return cmdId;
  }

  unsubscribe(cmdId) {
    if (!this.isConnected() || cmdId === null) return;

    const unsubscribeCmd = {
      cmds: [{
        cmdId: cmdId,
        type: "ENTITY_DATA_UNSUBSCRIBE"
      }]
    };

    this.ws.send(JSON.stringify(unsubscribeCmd));

    if (this.currentCmdId === cmdId) {
      this.currentCmdId = null;
    }

    LogHelper.log(`[WebSocket] Unsubscribed (cmdId: ${cmdId})`);
  }

  handleMessage(message) {
    // Handle authentication response
    if (message.authCmd !== undefined) {
      if (message.authCmd.success) {
        LogHelper.log('[WebSocket] Authentication successful');
        this.reconnectAttempts = 0;  // Reset on success
        this.config.onConnectionChange(true);
      } else {
        LogHelper.error('[WebSocket] Authentication failed');
        this.config.onError(new Error('Authentication failed'));
      }
      return;
    }

    // Handle initial data
    if (message.cmdId && message.data?.data) {
      this.processDataUpdate(message.data.data);
    }

    // Handle push updates
    if (message.cmdId && message.update) {
      this.processDataUpdate(message.update);
    }
  }

  processDataUpdate(dataArray) {
    if (!Array.isArray(dataArray)) return;

    dataArray.forEach(item => {
      const deviceId = item.entityId?.id;
      if (!deviceId) return;

      const latest = item.latest?.TIME_SERIES || {};

      Object.entries(latest).forEach(([key, entry]) => {
        const value = parseFloat(entry.value) || 0;
        const timestamp = entry.ts || Date.now();

        this.config.onData(deviceId, key, value, timestamp);
      });
    });
  }

  scheduleReconnect() {
    const delay = this.backoffSchedule[
      Math.min(this.reconnectAttempts, this.backoffSchedule.length - 1)
    ];

    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.backoffSchedule.length) {
      LogHelper.error('[WebSocket] Max reconnect attempts reached, triggering fallback');
      this.config.onError(new Error('Max reconnect attempts reached'));
      return;
    }

    LogHelper.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();

        // Re-subscribe to previous devices
        if (this.lastSubscribedDevices.length > 0) {
          this.subscribe(this.lastSubscribedDevices);
        }
      } catch (err) {
        // Will trigger another reconnect via onclose
      }
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      if (this.currentCmdId !== null) {
        this.unsubscribe(this.currentCmdId);
      }

      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.currentCmdId = null;
    this.lastSubscribedDevices = [];
  }

  nextCmdId() {
    return ++this.cmdIdCounter;
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSubscribedDevices() {
    return [...this.lastSubscribedDevices];
  }
}
```

---

## Performance Comparison

### Scenario: 50 Visible Devices

| Metric | REST Polling (30s) | WebSocket |
|--------|-------------------|-----------|
| Requests/min | 100 | 0 (after subscribe) |
| Average latency | ~30.2s | < 100ms |
| Bandwidth (est.) | ~200KB/min | ~2KB/min |
| TCP connections | 100/min | 1 |

### Improvements

- **Request reduction**: ~99.9%
- **Latency reduction**: ~99.7%
- **Bandwidth reduction**: ~99%

---

## Implementation Checklist

- [ ] Implement `RealTimeWebSocketService` class
- [ ] Add `currentEngine` state management
- [ ] Implement fallback logic (6 failures → REST)
- [ ] Add debounced filter change handling
- [ ] Integrate with `STATE.realTimePowerMap`
- [ ] Add user notifications for connection status
- [ ] Test reconnection with token refresh
- [ ] Test fallback to REST polling
- [ ] Update UI to show connection mode indicator

---

## References

- [ThingsBoard Telemetry Documentation](https://thingsboard.io/docs/user-guide/telemetry/)
- [ThingsBoard WebSocket API](https://thingsboard.io/docs/user-guide/telemetry/#websocket-api)
- RFC-0093: Equipments Grid Real-Time Mode (Original Implementation)
- RFC-0093-Equipments-Grid-RealTime-Mode-FULL-IMPLEMENTATION.md (REST code to replace)
