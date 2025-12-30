# RFC 0110: Device Status Main Rule - Telemetry-Based Offline Detection

- Feature Name: `device-status-main-rule`
- Start Date: 2025-12-30
- RFC PR: (to be assigned)
- Status: **Draft**

---

## Summary

This RFC proposes a unified approach for calculating device status based on telemetry timestamps rather than `connectionStatusTs`. The key insight is that ThingsBoard frequently updates `connectionStatusTs` even when devices are offline, making it unreliable for offline detection. Instead, we should use the timestamp of the actual telemetry data (consumption, pulses, temperature) as the source of truth.

---

## Motivation

### Problem Statement

The current implementation uses `connectionStatusTs` (timestamp of the connectionStatus attribute) to determine if a device is stale/offline. However, ThingsBoard updates this timestamp approximately every minute, even when the device has `connectionStatus: "offline"`. This causes:

1. **False negatives**: Devices that are truly offline are never marked as OFFLINE because their `connectionStatusTs` is always recent
2. **Inconsistent behavior**: The status depends on ThingsBoard's internal update mechanism rather than actual device activity

### Real-World Example

```
Device: PASTEL LOCO
connectionStatus: "offline"
connectionStatusTs: "2025-12-30T06:54:05.228Z" (updated by ThingsBoard)
Actual last telemetry: 3 days ago
Result: Device NOT marked as offline (incorrect)
```

### Domain-Specific Telemetry Behavior

Different device domains have specific telemetry patterns:

| Domain | Telemetry Key | Behavior |
|--------|---------------|----------|
| Energy | `consumption` | Only sends when value changes (e.g., motor at constant 1000W won't send repeatedly) |
| Water | `pulses` | Only sends when there's variation in flow |
| Temperature | `temperature` | Only sends when temperature value changes |

This means telemetry timestamps are meaningful indicators of actual device activity.

---

## Guide-level Explanation

### The Main Rule

**`connectionStatus = offline` is the TRIGGER for validation** - when we see this status, we must validate the actual telemetry timestamp to confirm if the device is truly offline.

### Status Priority Matrix

| connectionStatus | Validation | Result |
|-----------------|------------|--------|
| `waiting` | None (absolute) | **NOT_INSTALLED** |
| `bad` | None | **WEAK_CONNECTION** |
| `offline` | Check telemetry timestamp | OFFLINE if stale, else value-based |
| `online` | Check telemetry timestamp | OFFLINE if stale, else value-based |

### Decision Flow

```
┌─────────────────────────────┐
│ connectionStatus = waiting? │
└──────────────┬──────────────┘
               │ YES → NOT_INSTALLED (absolute, no discussion)
               │ NO
               ▼
┌─────────────────────────────┐
│ connectionStatus = bad?     │
└──────────────┬──────────────┘
               │ YES → WEAK_CONNECTION (not offline)
               │ NO
               ▼
┌─────────────────────────────┐
│ connectionStatus = offline  │
│ OR online?                  │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Get telemetry timestamp:    │
│ - Energy: consumptionTs     │
│ - Water: pulsesTs           │
│ - Temperature: temperatureTs│
│ Fallback: lastActivityTime  │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Is (now - telemetryTs) > delayMins?     │
│ Default: 1440 mins (24 hours)           │
└──────────────┬──────────────────────────┘
               │ YES → OFFLINE
               │ NO → Calculate from telemetry value
               ▼
┌─────────────────────────────┐
│ Use ranges to determine:    │
│ STANDBY, POWER_ON, etc.     │
└─────────────────────────────┘
```

### Configuration

- **`delayTimeConnectionInMins`**: Configurable via settings
- **Default value**: `1440` minutes (24 hours)
- **Rationale**: Since telemetry only sends on value change, devices may legitimately not send data for extended periods

---

## Reference-level Explanation

### Current Functions (to be unified)

```javascript
// Function 1: Check if connection is stale
isConnectionStale({ connectionStatusTs, lastActivityTime, delayTimeConnectionInMins })

// Function 2: Calculate status with limits
calculateDeviceStatus({ connectionStatus, lastConsumptionValue, limits... })

// Function 3: Calculate status with ranges
calculateDeviceStatusWithRanges({ connectionStatus, lastConsumptionValue, ranges })
```

### New Unified Function

```javascript
/**
 * Unified device status calculation based on telemetry timestamps.
 *
 * @param {Object} params
 * @param {string} params.connectionStatus - 'online' | 'offline' | 'waiting' | 'bad'
 * @param {string} [params.domain='energy'] - 'energy' | 'water' | 'temperature'
 * @param {number|null} [params.telemetryValue] - consumption | pulses | temperature
 * @param {number|null} [params.telemetryTimestamp] - Unix timestamp (ms) of telemetry
 * @param {number|null} [params.lastActivityTime] - Fallback timestamp from ThingsBoard
 * @param {Object} [params.ranges] - { standbyRange, normalRange, alertRange, failureRange }
 * @param {number} [params.delayTimeConnectionInMins=1440] - Stale threshold in minutes
 * @returns {string} DeviceStatusType
 */
export function calculateDeviceStatus({
  connectionStatus,
  domain = 'energy',
  telemetryValue = null,
  telemetryTimestamp = null,
  lastActivityTime = null,
  ranges = null,
  delayTimeConnectionInMins = 1440,
}) {
  // 1. Normalize connectionStatus (RFC-0109)
  const normalizedStatus = normalizeConnectionStatus(connectionStatus);

  // 2. WAITING → NOT_INSTALLED (absolute priority)
  if (normalizedStatus === 'waiting') {
    return DeviceStatusType.NOT_INSTALLED;
  }

  // 3. BAD → WEAK_CONNECTION (not offline)
  if (normalizedStatus === 'bad') {
    return DeviceStatusType.WEAK_CONNECTION;
  }

  // 4. Check if telemetry is stale
  const telemetryStale = isTelemetryStale(
    telemetryTimestamp,
    lastActivityTime,
    delayTimeConnectionInMins
  );

  // 5. If connectionStatus = offline AND telemetry is stale → OFFLINE
  if (normalizedStatus === 'offline' && telemetryStale) {
    return DeviceStatusType.OFFLINE;
  }

  // 6. If connectionStatus = online BUT telemetry is stale → OFFLINE
  if (normalizedStatus === 'online' && telemetryStale) {
    return DeviceStatusType.OFFLINE;
  }

  // 7. Calculate status based on telemetry value
  return calculateStatusFromValue(telemetryValue, ranges, domain);
}
```

### Helper Function

```javascript
/**
 * Check if telemetry timestamp indicates a stale connection.
 *
 * @param {number|null} telemetryTimestamp - Primary timestamp source
 * @param {number|null} lastActivityTime - Fallback timestamp
 * @param {number} delayMins - Threshold in minutes (default: 1440)
 * @returns {boolean} True if telemetry is stale
 */
function isTelemetryStale(telemetryTimestamp, lastActivityTime, delayMins = 1440) {
  // Use telemetryTimestamp or lastActivityTime as fallback
  const timestamp = telemetryTimestamp || lastActivityTime;

  // No timestamp available = assume not stale (conservative)
  if (!timestamp) return false;

  const now = Date.now();
  const delayMs = delayMins * 60 * 1000;

  return (now - timestamp) > delayMs;
}
```

### Telemetry Mapping by Domain

| Domain | Telemetry Key | Value Field | Timestamp Field |
|--------|---------------|-------------|-----------------|
| energy | consumption | `meta.consumption` | `meta.consumptionTs` |
| water | pulses | `meta.pulses` | `meta.pulsesTs` |
| temperature | temperature | `meta.temperature` | `meta.temperatureTs` |

### ThingsBoard Data Structure

When extracting telemetry from ThingsBoard:
```javascript
// row.data[0][0] = timestamp (Unix ms)
// row.data[0][1] = value
const val = row?.data?.[0]?.[1] ?? null;
const ts = row?.data?.[0]?.[0] ?? null;
```

---

## Drawbacks

1. **Breaking change**: Existing call sites need to be updated to pass `telemetryTimestamp`
2. **Fallback dependency**: When `telemetryTimestamp` is not available, relies on `lastActivityTime` which may also be unreliable

---

## Rationale and Alternatives

### Why telemetry timestamp instead of connectionStatusTs?

- **connectionStatusTs**: Updated by ThingsBoard internally (~1 min intervals), doesn't reflect device activity
- **telemetryTimestamp**: Updated ONLY when device sends data, reflects actual device activity

### Why 1440 minutes (24h) as default?

- Telemetry only sends on value change
- Devices may legitimately be idle for extended periods (e.g., motor not running, no water flow)
- 24h is a reasonable "no activity" threshold before declaring offline

### Alternatives Considered

1. **Keep using connectionStatusTs**: Rejected - causes false negatives
2. **Use both timestamps**: Adds complexity without benefit
3. **Use only lastActivityTime**: Less precise than domain-specific telemetry

---

## Prior Art

- **RFC-0109**: Connection status normalization (`waiting`, `bad`, `offline`, `online`)
- **ThingsBoard lastActivityTime**: Built-in device activity tracking (used as fallback)

---

## Unresolved Questions

1. Should `delayTimeConnectionInMins` be domain-specific?
2. How to handle devices that never send telemetry after installation?

---

## Future Possibilities

1. Domain-specific delay thresholds (e.g., temperature sensors may have longer idle periods)
2. Alerting system for devices approaching stale threshold
3. Historical analysis of telemetry frequency per device type

---

## Implementation Plan

### Files to Modify

1. **`src/utils/deviceStatus.js`**
   - Refactor `calculateDeviceStatus()` with new API
   - Add `isTelemetryStale()` helper
   - Mark old functions as `@deprecated`

2. **`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`**
   - Extract timestamps when parsing telemetry:
     ```javascript
     meta.consumptionTs = row?.data?.[0]?.[0] ?? null;
     meta.pulsesTs = row?.data?.[0]?.[0] ?? null;
     meta.temperatureTs = row?.data?.[0]?.[0] ?? null;
     ```

3. **`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`**
   - Update calls to use new API with `telemetryTimestamp`

4. **`src/utils/deviceItem.js`**
   - Update factory function to use unified API

5. **`src/MYIO-SIM/v5.2.0/` widgets**
   - Update all status calculations

6. **`src/index.ts`**
   - Update exports, maintain deprecated aliases

### Backward Compatibility

```javascript
// Deprecated alias for existing code
export function calculateDeviceStatusWithRanges(params) {
  console.warn('[DEPRECATED] Use calculateDeviceStatus instead');
  return calculateDeviceStatus({
    connectionStatus: params.connectionStatus,
    domain: 'energy',
    telemetryValue: params.lastConsumptionValue,
    telemetryTimestamp: params.telemetryTimestamp ?? null,
    ranges: params.ranges,
    delayTimeConnectionInMins: params.delayTimeConnectionInMins ?? 1440,
  });
}
```

---

## Appendix: Status Types

```typescript
type DeviceStatus =
  | 'power_on'      // Device operating normally
  | 'standby'       // Device in standby/idle
  | 'power_off'     // Device powered off
  | 'warning'       // Alert condition
  | 'failure'       // Failure condition
  | 'maintenance'   // Under maintenance
  | 'no_info'       // No data available
  | 'not_installed' // connectionStatus = waiting
  | 'offline'       // Telemetry stale beyond threshold
  | 'weak_connection'; // connectionStatus = bad
```
