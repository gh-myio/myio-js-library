# RFC 0110: Device Status Main Rule - Telemetry-Based Offline Detection

- Feature Name: `device-status-main-rule`
- Start Date: 2025-12-30
- RFC PR: (to be assigned)
- Status: **Implementing (v3)**

---

## Summary

This RFC proposes a unified approach for calculating device status based on telemetry timestamps rather than `connectionStatusTs`. The key insight is that ThingsBoard frequently updates `connectionStatusTs` even when devices are offline, making it unreliable for offline detection. Instead, we should use the timestamp of the actual telemetry data (consumption, pulses, temperature) as the source of truth.

**Version 2 Update**: Implements a dual threshold system - 60 minutes for `offline`/`bad` status recovery, and 24 hours for `online` status validation.

**Version 3 Update**: Requires DOMAIN-SPECIFIC telemetry for validation. A device without its domain-specific telemetry is considered OFFLINE regardless of connectionStatus.

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
| Water (Hidrômetro) | `pulses` | Only sends when there's variation in flow |
| Water (Caixa d'água) | `water_level`, `water_percentage` | Only sends when water level changes |
| Temperature | `temperature` | Only sends when temperature value changes |

This means telemetry timestamps are meaningful indicators of actual device activity.

### Real-World Example v3 (Domain-Specific Validation)

```
Device: HIDR. SCMPAC-Banheiro6 (label: "Banheiro 6(PENDENTE)")
Domain: water (hidrômetro)
connectionStatus: "online"
lastActivityTime: "2025-12-30T15:16:37.000Z" (recent - ThingsBoard updated)
pulsesTs: null (NEVER received pulses telemetry!)
water_levelTs: null
Expected Result: OFFLINE (no domain-specific telemetry)
```

**The key insight**: Having `connectionStatus: online` and recent `lastActivityTime` is NOT sufficient. The device MUST have its **domain-specific telemetry** to be considered online.

---

## Guide-level Explanation

### The Main Rule (v3 - Domain-Specific + Dual Threshold)

The system validates device status using **domain-specific telemetry** with **two different thresholds**:

#### Pre-condition: Domain-Specific Telemetry Required

**BEFORE applying any threshold check, the device MUST have its domain-specific telemetry timestamp:**

| Domain | Required Telemetry | If Missing |
|--------|-------------------|------------|
| Energy | `consumptionTs` | → OFFLINE |
| Water (Hidrômetro) | `pulsesTs` | → OFFLINE |
| Water (Caixa d'água) | `water_levelTs` OR `water_percentageTs` | → OFFLINE |
| Temperature | `temperatureTs` | → OFFLINE |

**If `telemetryTimestamp` is NULL/undefined** → Device is **OFFLINE** (never received domain-specific data)

#### Threshold Logic (only if telemetryTimestamp exists)

1. **Short Threshold (60 minutes)**: For `offline` and `bad` status - if device has sent telemetry within 60 minutes, treat as online
2. **Long Threshold (24 hours)**: For `online` status - if device hasn't sent telemetry in 24 hours, mark as offline

### Status Priority Matrix (v3)

| connectionStatus | Pre-condition | Threshold | Validation | Result |
|-----------------|---------------|-----------|------------|--------|
| `waiting` | N/A | N/A | None (absolute) | **NOT_INSTALLED** |
| ANY | `telemetryTs` is NULL | N/A | No domain telemetry | **OFFLINE** |
| `bad` | `telemetryTs` exists | 60 mins | Check recent telemetry | If recent → **POWER_ON**, else **WEAK_CONNECTION** |
| `offline` | `telemetryTs` exists | 60 mins | Check recent telemetry | If recent → **POWER_ON**, else **OFFLINE** |
| `online` | `telemetryTs` exists | 24 hours | Check stale telemetry | If stale → **OFFLINE**, else value-based |

### Decision Flow (v3)

```
┌─────────────────────────────┐
│ connectionStatus = waiting? │
└──────────────┬──────────────┘
               │ YES → NOT_INSTALLED (absolute, no discussion)
               │ NO
               ▼
┌───────────────────────────────────────────────────┐
│ Has DOMAIN-SPECIFIC telemetryTs?                  │
│ (consumptionTs for energy, pulsesTs for water,    │
│  temperatureTs for temp, etc.)                    │
└──────────────┬────────────────────────────────────┘
               │ NO (null/undefined) → OFFLINE (never received domain data)
               │ YES
               ▼
┌─────────────────────────────────────────┐
│ connectionStatus = bad?                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Domain telemetry within 60 mins?        │
└──────────────┬──────────────────────────┘
               │ YES → POWER_ON (hide "bad" from client)
               │ NO → WEAK_CONNECTION
               ▼
┌─────────────────────────────────────────┐
│ connectionStatus = offline?             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Domain telemetry within 60 mins?        │
└──────────────┬──────────────────────────┘
               │ YES → POWER_ON (treat as online)
               │ NO → OFFLINE
               ▼
┌─────────────────────────────────────────┐
│ connectionStatus = online?              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Domain telemetry older than 24 hours?   │
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

- **`shortDelayMins`**: 60 minutes (for offline/bad recovery)
- **`delayTimeConnectionInMins`**: Configurable via settings (default 1440 minutes / 24 hours)
- **Rationale**:
  - 60 mins: Short window to detect devices that are briefly disconnected but still working
  - 24 hours: Long window for online devices since telemetry only sends on value change

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

### New Unified Function (v3 - Domain-Specific + Dual Threshold)

```javascript
/**
 * Unified device status calculation based on DOMAIN-SPECIFIC telemetry timestamps.
 *
 * RFC-0110 v3: Domain-specific telemetry required + Dual threshold system
 * - Pre-condition: telemetryTimestamp (domain-specific) MUST exist, else OFFLINE
 * - 60 mins threshold for offline/bad status (short recovery window)
 * - 24h threshold for online status (long validation window)
 *
 * IMPORTANT: telemetryTimestamp MUST be the domain-specific timestamp:
 * - Energy: consumptionTs
 * - Water (hidrômetro): pulsesTs
 * - Water (caixa d'água): water_levelTs or water_percentageTs
 * - Temperature: temperatureTs
 *
 * DO NOT use lastActivityTime or connectionStatusTs as telemetryTimestamp!
 *
 * @param {Object} params
 * @param {string} params.connectionStatus - 'online' | 'offline' | 'waiting' | 'bad'
 * @param {string} [params.domain='energy'] - 'energy' | 'water' | 'temperature'
 * @param {number|null} [params.telemetryValue] - consumption | pulses | temperature
 * @param {number|null} [params.telemetryTimestamp] - Unix timestamp (ms) of DOMAIN-SPECIFIC telemetry
 * @param {number|null} [params.lastActivityTime] - NOT USED in v3 (kept for backward compat)
 * @param {Object} [params.ranges] - { standbyRange, normalRange, alertRange, failureRange }
 * @param {number} [params.delayTimeConnectionInMins=1440] - Long threshold for online status (24h)
 * @param {number} [params.shortDelayMins=60] - Short threshold for offline/bad status (60 mins)
 * @returns {string} DeviceStatusType
 */
export function calculateDeviceStatus({
  connectionStatus,
  domain = 'energy',
  telemetryValue = null,
  telemetryTimestamp = null, // MUST be domain-specific (consumptionTs, pulsesTs, etc.)
  lastActivityTime = null, // v3: NOT USED as fallback anymore
  ranges = null,
  delayTimeConnectionInMins = 1440, // 24h for online status
  shortDelayMins = 60, // 60 mins for offline/bad status
}) {
  // 1. Normalize connectionStatus (RFC-0109)
  const normalizedStatus = normalizeConnectionStatus(connectionStatus);

  // 2. WAITING → NOT_INSTALLED (absolute priority, no discussion)
  if (normalizedStatus === 'waiting') {
    return DeviceStatusType.NOT_INSTALLED;
  }

  // 3. v3: Check if domain-specific telemetry timestamp exists
  // If device NEVER received domain-specific telemetry → OFFLINE
  if (telemetryTimestamp === null || telemetryTimestamp === undefined) {
    console.log(`[RFC-0110 v3] Device has NO domain-specific telemetry (${domain}) → OFFLINE`);
    return DeviceStatusType.OFFLINE;
  }

  // 4. BAD → Check recent telemetry (60 mins threshold)
  // If device has recent telemetry, hide "bad" from client and treat as online
  if (normalizedStatus === 'bad') {
    const hasRecentTelemetry = !isTelemetryStale(telemetryTimestamp, null, shortDelayMins);
    if (hasRecentTelemetry) {
      // Device is working fine, continue to value-based calculation
    } else {
      return DeviceStatusType.WEAK_CONNECTION;
    }
  }

  // 5. OFFLINE → Check recent telemetry (60 mins threshold)
  // If device has recent telemetry, treat as online
  if (normalizedStatus === 'offline') {
    const hasRecentTelemetry = !isTelemetryStale(telemetryTimestamp, null, shortDelayMins);
    if (!hasRecentTelemetry) {
      return DeviceStatusType.OFFLINE;
    }
    // Has recent telemetry → continue to value-based calculation
  }

  // 6. ONLINE → Check stale telemetry (24h threshold)
  // If device hasn't sent domain-specific telemetry in 24h, mark as offline
  if (normalizedStatus === 'online') {
    const telemetryStale = isTelemetryStale(telemetryTimestamp, null, delayTimeConnectionInMins);
    if (telemetryStale) {
      return DeviceStatusType.OFFLINE;
    }
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

### Telemetry Mapping by Domain (v3)

| Domain | Device Type | Telemetry Key | Value Field | Timestamp Field |
|--------|------------|---------------|-------------|-----------------|
| energy | Medidor de energia | `consumption` | `meta.consumption` | `meta.consumptionTs` |
| water | Hidrômetro | `pulses` | `meta.pulses` | `meta.pulsesTs` |
| water | Caixa d'água (Tank) | `water_level` | `meta.water_level` | `meta.waterLevelTs` |
| water | Caixa d'água (Tank) | `water_percentage` | `meta.water_percentage` | `meta.waterPercentageTs` |
| temperature | Sensor de temperatura | `temperature` | `meta.temperature` | `meta.temperatureTs` |

**v3 Important**:
- For water devices, you MUST identify the device subtype (hidrômetro vs caixa d'água) to use the correct telemetry key
- If device is hidrômetro but only has `water_level`, it's OFFLINE (wrong telemetry type)
- If device is caixa d'água but only has `pulses`, it's OFFLINE (wrong telemetry type)

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

### Why dual thresholds (60 mins / 24h)?

**60 minutes for offline/bad recovery:**
- When ThingsBoard reports `offline` or `bad`, we want to quickly validate if the device is actually working
- If device sent telemetry within 60 minutes, it's likely just a transient network issue
- Hides internal "bad" status from clients - no need to show connection quality details

**24 hours for online validation:**
- When ThingsBoard reports `online`, we need a longer window since telemetry only sends on value change
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

**Status: Completed (v2)**

### Files Modified

1. **`src/utils/deviceStatus.js`** ✅
   - Added `isTelemetryStale()` helper function
   - Refactored `calculateDeviceStatus()` with dual threshold API
   - Added `shortDelayMins` parameter (default: 60 mins)
   - Changed `delayTimeConnectionInMins` default to 1440 (24h)
   - Marked old functions as `@deprecated`

2. **`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`** ✅
   - Extract timestamps when parsing telemetry:
     ```javascript
     meta.consumptionTs = row?.data?.[0]?.[0] ?? null;
     meta.pulsesTs = row?.data?.[0]?.[0] ?? null;
     meta.temperatureTs = row?.data?.[0]?.[0] ?? null;
     ```

3. **`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`** ✅
   - Updated both call sites with dual threshold logic
   - Uses SHORT_DELAY_MINS (60) for offline/bad
   - Uses LONG_DELAY_MINS (1440) for online

4. **`src/utils/deviceItem.js`** ✅
   - Updated factory function with dual threshold logic
   - Non-energy devices use same dual threshold approach

5. **`src/MYIO-SIM/v5.2.0/MAIN/controller.js`** ✅
   - Updated `convertConnectionStatusToDeviceStatus()` with dual threshold
   - Full RFC-0110 v2 implementation

6. **`src/index.ts`** ✅
   - Updated exports with `isTelemetryStale`
   - Maintained deprecated aliases

### Dual Threshold Implementation Pattern

```javascript
// RFC-0110 v2: Dual threshold configuration
const SHORT_DELAY_MINS = 60; // For offline/bad status
const LONG_DELAY_MINS = 1440; // For online status (24h default)

// Calculate both thresholds
const hasRecentTelemetry = !isTelemetryStale(telemetryTs, lastActivityTime, SHORT_DELAY_MINS);
const telemetryStaleForOnline = isTelemetryStale(telemetryTs, lastActivityTime, LONG_DELAY_MINS);

// Apply status-specific logic
if (connectionStatus === 'bad') {
  return hasRecentTelemetry ? 'power_on' : 'weak_connection';
}
if (connectionStatus === 'offline') {
  return hasRecentTelemetry ? 'power_on' : 'offline';
}
if (connectionStatus === 'online') {
  return telemetryStaleForOnline ? 'offline' : 'power_on';
}
```

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
    shortDelayMins: 60, // v2: Added for dual threshold
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
