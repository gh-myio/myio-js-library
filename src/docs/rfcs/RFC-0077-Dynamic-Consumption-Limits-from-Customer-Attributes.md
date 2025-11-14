# RFC-0077: Dynamic Consumption Limits from Customer Attributes

- **Feature Name**: `dynamic-consumption-limits-from-customer-attributes`
- **Start Date**: 2025-01-14
- **RFC PR**: #0077
- **Status**: Draft
- **Component**: `MYIO-SIM/V1.0.0/EQUIPMENTS`, `src/utils/deviceStatus.js`

## Summary

**URGENT:** Eliminate hardcoded device consumption limits (standby, alert, failure) switch statement in the EQUIPMENTS widget and replace with a hierarchical configuration system that fetches limits from:
1. **Device-level attributes** (highest priority, device-specific overrides)
2. **Customer-level attributes** (fallback, shopping center defaults)
3. **Hardcoded defaults** (last resort fallback)

Additionally, add a new UI section in SettingsModalView for configuring per-device power limits with visual indicators showing when global (customer-level) values are being used, including a copy-from-global feature. Enhance the `calculateDeviceStatus` utility function to support range-based thresholds (down/up limits) for more granular device status determination.

## Motivation

### Current Problem - URGENT ELIMINATION REQUIRED

**CRITICAL:** The EQUIPMENTS widget contains a hardcoded switch statement that MUST be eliminated urgently. This switch statement prevents per-customer and per-device configuration:

```javascript
// src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js (lines 1224-1254)
let standbyLimit = 100;
let alertLimit = 1000;
let failureLimit = 2000;

switch(deviceType) {
  case 'CHILLER':
    standbyLimit = 1000;
    alertLimit = 6000;
    failureLimit = 8000;
    break;
  case 'AR_CONDICIONADO':
  case 'AC':
    standbyLimit = 500;
    alertLimit = 3000;
    failureLimit = 5000;
    break;
  case 'ELEVADOR':
  case 'ELEVATOR':
    standbyLimit = 150;
    alertLimit = 800;
    failureLimit = 1200;
    break;
  case 'BOMBA':
  case 'PUMP':
    standbyLimit = 200;
    alertLimit = 1000;
    failureLimit = 1500;
    break;
  default:
    break;
}

const deviceStatus = MyIOLibrary.calculateDeviceStatus({
  connectionStatus: mappedConnectionStatus,
  lastConsumptionValue: Number(consumptionValue) || null,
  limitOfPowerOnStandByWatts: standbyLimit,
  limitOfPowerOnAlertWatts: alertLimit,
  limitOfPowerOnFailureWatts: failureLimit
});
```

### Why This Matters - CRITICAL BUSINESS IMPACT

1. **🚨 URGENT: Hardcoded Switch Must Be Eliminated**: The switch statement at lines 1228-1254 prevents all configuration flexibility
2. **No Configuration Flexibility**: Limits are hardcoded in the codebase, requiring code changes and redeployment for adjustments
3. **One-Size-Fits-All Approach**: All customers share the same limits, but different shopping centers may have different equipment characteristics
4. **No Per-Device Overrides**: Cannot configure specific devices with different limits than the shopping center default
5. **Limited Granularity**: Current implementation only supports single threshold values, not ranges (down/up limits)
6. **Business Logic in Code**: Configuration data is mixed with application logic, violating separation of concerns
7. **Scalability Issues**: Adding new device types or adjusting limits requires code modifications
8. **User Experience Gap**: Administrators cannot configure limits via UI, must contact developers

### Desired State - Hierarchical Configuration System

Implement a **three-tier hierarchical system** for consumption limits:

#### Tier 1: Device-Level Attributes (Highest Priority)
Store per-device consumption limits as ThingsBoard device-level server-scope attributes. These override customer-level defaults:

**ThingsBoard Device Attributes (DEVICE entity, server_scope):**
```json
{
  "standbyLimitDownConsumption": 0,
  "standbyLimitUpConsumption": 150,
  "alertLimitDownConsumption": 150,
  "alertLimitUpConsumption": 800,
  "normalLimitDownConsumption": 800,
  "normalLimitUpConsumption": 1200,
  "failureLimitDownConsumption": 1200,
  "failureLimitUpConsumption": 99999
}
```

**Note:** Device-level attributes are OPTIONAL. If not present, system falls back to customer-level (Tier 2).

#### Tier 2: Customer-Level Attributes (Shopping Center Defaults)
Store shopping-center-wide defaults as ThingsBoard customer-level server-scope attributes:

**ThingsBoard Customer Attributes (CUSTOMER entity, server_scope):**
```json
{
  "standbyLimitDownConsumptionElevator": 0,
  "standbyLimitUpConsumptionElevator": 150,
  "alertLimitDownConsumptionElevator": 150,
  "alertLimitUpConsumptionElevator": 800,
  "normalLimitDownConsumptionElevator": 800,
  "normalLimitUpConsumptionElevator": 1200,
  "failureLimitDownConsumptionElevator": 1200,
  "failureLimitUpConsumptionElevator": 99999,

  "standbyLimitDownConsumptionEscalator": 0,
  "standbyLimitUpConsumptionEscalator": 200,
  "alertLimitDownConsumptionEscalator": 200,
  "alertLimitUpConsumptionEscalator": 1000,
  "normalLimitDownConsumptionEscalator": 1000,
  "normalLimitUpConsumptionEscalator": 1500,
  "failureLimitDownConsumptionEscalator": 1500,
  "failureLimitUpConsumptionEscalator": 99999,

  "standbyLimitDownConsumptionMotor": 0,
  "standbyLimitUpConsumptionMotor": 100,
  "alertLimitDownConsumptionMotor": 100,
  "alertLimitUpConsumptionMotor": 500,
  "normalLimitDownConsumptionMotor": 500,
  "normalLimitUpConsumptionMotor": 1000,
  "failureLimitDownConsumptionMotor": 1000,
  "failureLimitUpConsumptionMotor": 99999
}
```

**Note:** Customer-level attributes use device-type suffixes (Elevator, Escalator, Motor, etc.). These are shopping-center-wide defaults.

#### Tier 3: Hardcoded Defaults (Last Resort Fallback)
If neither device-level nor customer-level attributes exist, use hardcoded defaults in the code for backward compatibility.

## Guide-level Explanation

### How It Works Today

When the EQUIPMENTS widget renders a device card, it:

1. Determines the device type (ELEVADOR, ESCADA_ROLANTE, CHILLER, etc.)
2. Uses a hardcoded switch statement to select consumption limits
3. Calls `calculateDeviceStatus()` with single threshold values
4. Displays the calculated status icon (⚡, 🔴, ⚠️, 🚨, etc.)

**Problem Example:**

Shopping Center A has old elevators that consume 1000W normally, while Shopping Center B has modern elevators consuming only 400W. With hardcoded limits, one center will show incorrect statuses.

### How It Will Work After This RFC

When the EQUIPMENTS widget renders a device card, it will:

1. Fetch consumption limits from ThingsBoard customer attributes (cached)
2. Map device type to attribute keys (e.g., `Elevator` → `*ConsumptionElevator`)
3. Extract range-based limits (down/up pairs) for each status tier
4. Call enhanced `calculateDeviceStatus()` with range-based thresholds
5. Display the calculated status icon

**Configuration Example:**

An administrator can configure Shopping Center A's elevator limits via ThingsBoard UI:

```
normalLimitDownConsumptionElevator = 800
normalLimitUpConsumptionElevator = 1200
```

And Shopping Center B's limits differently:

```
normalLimitDownConsumptionElevator = 300
normalLimitUpConsumptionElevator = 500
```

No code changes required.

### User-Facing Changes

**For End Users:**
- No visible UI changes
- More accurate device status indicators based on customer-specific configurations
- Reduced false alarms from miscalibrated thresholds

**For Administrators:**
- Can configure consumption limits per customer via ThingsBoard
- Changes take effect on next widget load (no code deployment needed)
- Can fine-tune limits based on equipment characteristics

**For Developers:**
- Cleaner code without large switch statements
- Centralized limit management
- Easier to add support for new device types

## Reference-level Explanation

### Architecture Overview - Hierarchical Three-Tier System

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ThingsBoard Platform - THREE-TIER HIERARCHY                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ TIER 1: DEVICE Entity (HIGHEST PRIORITY)                         │        │
│  │ Server Scope Attributes (OPTIONAL, device-specific overrides)   │        │
│  │  ├─ standbyLimitDownConsumption: 0                              │        │
│  │  ├─ standbyLimitUpConsumption: 120    ← Device-specific value  │        │
│  │  ├─ normalLimitDownConsumption: 120                             │        │
│  │  ├─ normalLimitUpConsumption: 900                               │        │
│  │  ├─ ... (all 8 limits, no device-type suffix)                  │        │
│  │  └─ NOTE: If not present, fallback to TIER 2                   │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                    │                                          │
│                                    ↓ Fallback if device attrs not found     │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ TIER 2: CUSTOMER Entity (Shopping Center Defaults)              │        │
│  │ Server Scope Attributes (customer-wide, per device type)        │        │
│  │  ├─ standbyLimitDownConsumptionElevator: 0                      │        │
│  │  ├─ standbyLimitUpConsumptionElevator: 150                      │        │
│  │  ├─ normalLimitDownConsumptionElevator: 150                     │        │
│  │  ├─ normalLimitUpConsumptionElevator: 1200                      │        │
│  │  ├─ ... (escalator, motor, chiller, hvac)                       │        │
│  │  └─ NOTE: Device-type suffixes (Elevator, Escalator, etc.)      │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                    │                                          │
│                                    ↓ Fallback if customer attrs not found   │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ TIER 3: HARDCODED DEFAULTS (Last Resort)                        │        │
│  │ Defined in code: DEFAULT_CONSUMPTION_RANGES                     │        │
│  │  └─ Backward compatibility when no attributes configured        │        │
│  └─────────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ ThingsBoard REST API
                                    │ 1. GET /api/plugins/telemetry/DEVICE/{deviceId}/values/attributes/SERVER_SCOPE
                                    │ 2. GET /api/plugins/telemetry/CUSTOMER/{customerId}/values/attributes/SERVER_SCOPE
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ EQUIPMENTS Widget (controller.js)                                            │
│                                                                              │
│  🚨 CRITICAL: ELIMINATE HARDCODED SWITCH (lines 1228-1254)                  │
│                                                                              │
│  1. Fetch customer attributes ONCE on init (cached)                         │
│  2. For each device:                                                         │
│     a. Fetch device-level attributes (TIER 1)                               │
│     b. If device attrs exist → USE THEM (priority)                          │
│     c. If not → map deviceType to customer attrs (TIER 2)                   │
│     d. If not → use hardcoded defaults (TIER 3)                             │
│     e. Calculate status with resolved limits                                │
│  3. Cache both device and customer attributes (5 min TTL)                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ User clicks settings icon on device card
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ SettingsModalView (NEW: Power Limits UI)                                     │
│ (src/components/premium-modals/settings/SettingsModalView.ts)                │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ Modal Header                                                    │         │
│  │  "Configurações - [Device Name]"   ← Device name in header     │         │
│  ├────────────────────────────────────────────────────────────────┤         │
│  │ Modal Body (with scroll if needed)                             │         │
│  │                                                                 │         │
│  │  [Existing: Label Card]                                         │         │
│  │  [Existing: Alarm Configuration Card]                           │         │
│  │                                                                 │         │
│  │  ┌─────────────────────────────────────────────────────────┐   │         │
│  │  │ 🆕 NEW CARD: Power Limits Configuration                 │   │         │
│  │  │                                                          │   │         │
│  │  │  Limites de Potência (Watts)                            │   │         │
│  │  │  ┌──────────────┬────────────┬────────────┬──────────┐  │   │         │
│  │  │  │ Status       │ Min (Down) │ Max (Up)   │ Source   │  │   │         │
│  │  │  ├──────────────┼────────────┼────────────┼──────────┤  │   │         │
│  │  │  │ StandBy      │ [0____]    │ [150___]   │ 🔵 Dev  │  │   │         │
│  │  │  │ Normal       │ [150__]    │ [1200__]   │ 🌐 Glob │  │   │         │
│  │  │  │ Alert        │ [1200_]    │ [1500__]   │ 🌐 Glob │  │   │         │
│  │  │  │ Failure      │ [1500_]    │ [99999_]   │ 🌐 Glob │  │   │         │
│  │  │  └──────────────┴────────────┴────────────┴──────────┘  │   │         │
│  │  │                                                          │   │         │
│  │  │  Legend:                                                 │   │         │
│  │  │    🔵 Dev  = Device-specific value (TIER 1)             │   │         │
│  │  │    🌐 Glob = Global customer value (TIER 2)             │   │         │
│  │  │                                                          │   │         │
│  │  │  Actions:                                                │   │         │
│  │  │    [📋 Copy All from Global] ← Copies customer values  │   │         │
│  │  │    [🗑️ Clear Device Overrides] ← Removes device attrs │   │         │
│  │  └─────────────────────────────────────────────────────────┘   │         │
│  │                                                                 │         │
│  ├────────────────────────────────────────────────────────────────┤         │
│  │ Modal Footer                                                    │         │
│  │  [Fechar] [Salvar]                                             │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  On Save:                                                                    │
│    - POST device-level attributes to ThingsBoard                            │
│    - Invalidate cache                                                        │
│    - Refresh device status in widget                                        │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Function call
                                    ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│ MyIOLibrary.calculateDeviceStatusWithRanges()                                │
│ (src/utils/deviceStatus.js)                                                 │
│                                                                              │
│  Enhanced to support range-based thresholds:                                │
│  - standbyRange: { down: 0, up: 150 }                                       │
│  - normalRange: { down: 150, up: 1200 }                                     │
│  - alertRange: { down: 1200, up: 1500 }                                     │
│  - failureRange: { down: 1500, up: 99999 }                                  │
│                                                                              │
│  Logic: Check if consumption falls within each range                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Implementation Details

#### 0. 🚨 URGENT: Eliminate Hardcoded Switch Statement

**Location:** `src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js` (lines 1228-1254)

**CRITICAL ACTION REQUIRED:**

```javascript
// ❌ DELETE THIS ENTIRE SWITCH STATEMENT (lines 1228-1254)
switch(deviceType) {
  case 'CHILLER':
    standbyLimit = 1000;
    alertLimit = 6000;
    failureLimit = 8000;
    break;
  // ... rest of switch cases
}
```

**Replace with hierarchical fetching function (implemented in sections below).**

#### 1. Fetch Device-Level Attributes (TIER 1 - Highest Priority)

**Location:** `src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js`

Add new function to fetch device-specific consumption limits:

```javascript
/**
 * Fetches device-level consumption limit attributes from ThingsBoard
 * These are device-specific overrides (TIER 1 - highest priority)
 *
 * @param {string} deviceId - Device entity ID
 * @returns {Promise<Object|null>} Device consumption limits or null
 */
async function fetchDeviceConsumptionLimits(deviceId) {
  const token = localStorage.getItem("jwt_token");
  if (!token) {
    console.warn("[RFC-0077] JWT token not found");
    return null;
  }

  const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // 404 is expected if device doesn't have custom limits - not an error
      if (response.status === 404) {
        console.log(`[RFC-0077] No device-level limits for ${deviceId}, will use customer defaults`);
        return null;
      }
      console.warn(`[RFC-0077] Failed to fetch device attributes: ${response.status}`);
      return null;
    }

    const attributes = await response.json();

    // Extract consumption limit attributes (no device-type suffix at device level)
    const limits = {};
    for (const attr of attributes) {
      const key = attr.key;
      if (key.includes("LimitDownConsumption") || key.includes("LimitUpConsumption")) {
        limits[key] = Number(attr.value) || 0;
      }
    }

    // Check if we have a complete set (8 attributes required)
    const requiredKeys = [
      'standbyLimitDownConsumption', 'standbyLimitUpConsumption',
      'normalLimitDownConsumption', 'normalLimitUpConsumption',
      'alertLimitDownConsumption', 'alertLimitUpConsumption',
      'failureLimitDownConsumption', 'failureLimitUpConsumption'
    ];

    const hasAllKeys = requiredKeys.every(key => limits.hasOwnProperty(key));

    if (!hasAllKeys) {
      console.warn(`[RFC-0077] Incomplete device-level limits for ${deviceId}, missing keys`);
      return null;
    }

    console.log(`[RFC-0077] ✅ Loaded device-level limits for ${deviceId} (TIER 1)`);
    return limits;

  } catch (error) {
    console.error("[RFC-0077] Error fetching device consumption limits:", error);
    return null;
  }
}
```

#### 2. Fetch Customer Attributes (TIER 2 - Shopping Center Defaults)

**Location:** `src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js`

Add function to fetch customer-wide default limits:

```javascript
/**
 * Fetches consumption limit attributes from ThingsBoard customer entity
 * @param {string} customerId - Customer entity ID
 * @returns {Promise<Object>} Map of attribute keys to values
 */
async function fetchCustomerConsumptionLimits(customerId) {
  const token = localStorage.getItem("jwt_token");
  if (!token) {
    console.warn("[RFC-0077] JWT token not found, using default limits");
    return null;
  }

  const url = `/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[RFC-0077] Failed to fetch customer attributes: ${response.status}`);
      return null;
    }

    const attributes = await response.json();

    // Filter only consumption limit attributes
    const limits = {};
    for (const attr of attributes) {
      const key = attr.key;
      if (key.includes("LimitDownConsumption") || key.includes("LimitUpConsumption")) {
        limits[key] = Number(attr.value) || 0;
      }
    }

    console.log(`[RFC-0077] Loaded ${Object.keys(limits).length} consumption limit attributes for customer ${customerId}`);
    return limits;

  } catch (error) {
    console.error("[RFC-0077] Error fetching customer consumption limits:", error);
    return null;
  }
}
```

#### 2. Cache Attributes

Add caching mechanism to avoid repeated API calls:

```javascript
// Cache structure: Map<customerId, {limits: Object, timestamp: number}>
const consumptionLimitsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Gets consumption limits for a customer (with caching)
 * @param {string} customerId - Customer entity ID
 * @returns {Promise<Object|null>} Consumption limits or null
 */
async function getCachedConsumptionLimits(customerId) {
  if (!customerId) return null;

  // Check cache
  const cached = consumptionLimitsCache.get(customerId);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    console.log(`[RFC-0077] Using cached limits for customer ${customerId}`);
    return cached.limits;
  }

  // Fetch fresh data
  const limits = await fetchCustomerConsumptionLimits(customerId);

  if (limits) {
    consumptionLimitsCache.set(customerId, {
      limits: limits,
      timestamp: now
    });
  }

  return limits;
}
```

#### 3. Extract Range-Based Limits

Create helper to map device type to attribute-based ranges:

```javascript
/**
 * Device type to attribute suffix mapping
 */
const DEVICE_TYPE_ATTRIBUTE_MAP = {
  'ELEVADOR': 'Elevator',
  'ELEVATOR': 'Elevator',
  'ESCADA_ROLANTE': 'Escalator',
  'ESCALATOR': 'Escalator',
  'MOTOR': 'Motor',
  'BOMBA': 'Motor',
  'PUMP': 'Motor',
  'CHILLER': 'Chiller',
  'AR_CONDICIONADO': 'HVAC',
  'AC': 'HVAC',
  'HVAC': 'HVAC',
  'FANCOIL': 'HVAC',
};

/**
 * Extracts range-based consumption limits for a device type
 * @param {Object} customerLimits - Customer attribute map
 * @param {string} deviceType - Device type (e.g., 'ELEVADOR')
 * @returns {Object} Range-based limits or null
 */
function extractConsumptionRanges(customerLimits, deviceType) {
  if (!customerLimits || !deviceType) return null;

  const attributeSuffix = DEVICE_TYPE_ATTRIBUTE_MAP[deviceType.toUpperCase()];
  if (!attributeSuffix) {
    console.warn(`[RFC-0077] No attribute mapping for deviceType: ${deviceType}`);
    return null;
  }

  // Build attribute keys
  const standbyDown = `standbyLimitDownConsumption${attributeSuffix}`;
  const standbyUp = `standbyLimitUpConsumption${attributeSuffix}`;
  const alertDown = `alertLimitDownConsumption${attributeSuffix}`;
  const alertUp = `alertLimitUpConsumption${attributeSuffix}`;
  const normalDown = `normalLimitDownConsumption${attributeSuffix}`;
  const normalUp = `normalLimitUpConsumption${attributeSuffix}`;
  const failureDown = `failureLimitDownConsumption${attributeSuffix}`;
  const failureUp = `failureLimitUpConsumption${attributeSuffix}`;

  // Extract values
  const standbyRange = {
    down: customerLimits[standbyDown],
    up: customerLimits[standbyUp]
  };
  const alertRange = {
    down: customerLimits[alertDown],
    up: customerLimits[alertUp]
  };
  const normalRange = {
    down: customerLimits[normalDown],
    up: customerLimits[normalUp]
  };
  const failureRange = {
    down: customerLimits[failureDown],
    up: customerLimits[failureUp]
  };

  // Validate all ranges exist
  if (
    standbyRange.down === undefined || standbyRange.up === undefined ||
    alertRange.down === undefined || alertRange.up === undefined ||
    normalRange.down === undefined || normalRange.up === undefined ||
    failureRange.down === undefined || failureRange.up === undefined
  ) {
    console.warn(`[RFC-0077] Incomplete range data for ${deviceType} (${attributeSuffix})`);
    return null;
  }

  return {
    standbyRange,
    alertRange,
    normalRange,
    failureRange
  };
}
```

#### 4. Fallback to Hardcoded Defaults

Maintain backward compatibility with default limits:

```javascript
/**
 * Default consumption ranges for each device type (fallback)
 * Used when customer attributes are not available
 */
const DEFAULT_CONSUMPTION_RANGES = {
  'ELEVADOR': {
    standbyRange: { down: 0, up: 150 },
    normalRange: { down: 150, up: 800 },
    alertRange: { down: 800, up: 1200 },
    failureRange: { down: 1200, up: 99999 }
  },
  'ESCALATOR': {
    standbyRange: { down: 0, up: 200 },
    normalRange: { down: 200, up: 1000 },
    alertRange: { down: 1000, up: 1500 },
    failureRange: { down: 1500, up: 99999 }
  },
  'CHILLER': {
    standbyRange: { down: 0, up: 1000 },
    normalRange: { down: 1000, up: 6000 },
    alertRange: { down: 6000, up: 8000 },
    failureRange: { down: 8000, up: 99999 }
  },
  'HVAC': {
    standbyRange: { down: 0, up: 500 },
    normalRange: { down: 500, up: 3000 },
    alertRange: { down: 3000, up: 5000 },
    failureRange: { down: 5000, up: 99999 }
  },
  'MOTOR': {
    standbyRange: { down: 0, up: 200 },
    normalRange: { down: 200, up: 1000 },
    alertRange: { down: 1000, up: 1500 },
    failureRange: { down: 1500, up: 99999 }
  },
  'DEFAULT': {
    standbyRange: { down: 0, up: 100 },
    normalRange: { down: 100, up: 1000 },
    alertRange: { down: 1000, up: 2000 },
    failureRange: { down: 2000, up: 99999 }
  }
};

/**
 * Gets consumption ranges for a device type (with fallback to defaults)
 * @param {Object} customerLimits - Customer attributes (may be null)
 * @param {string} deviceType - Device type
 * @returns {Object} Consumption ranges
 */
function getConsumptionRanges(customerLimits, deviceType) {
  // Try to get from customer attributes
  if (customerLimits) {
    const ranges = extractConsumptionRanges(customerLimits, deviceType);
    if (ranges) return ranges;
  }

  // Fallback to defaults
  const attributeSuffix = DEVICE_TYPE_ATTRIBUTE_MAP[deviceType.toUpperCase()];
  const defaultRanges = DEFAULT_CONSUMPTION_RANGES[attributeSuffix] || DEFAULT_CONSUMPTION_RANGES['DEFAULT'];

  console.log(`[RFC-0077] Using default ranges for ${deviceType}`);
  return defaultRanges;
}
```

#### 5. Hierarchical Resolution in EQUIPMENTS Widget

**🚨 CRITICAL:** Replace the hardcoded switch statement with hierarchical attribute resolution.

**Location:** `src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js`

```javascript
// Cache for device-level attributes
// Map<deviceId, {limits: Object, timestamp: number}>
const deviceConsumptionLimitsCache = new Map();
const DEVICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Gets consumption limits with hierarchical resolution:
 * TIER 1: Device-level attributes (highest priority)
 * TIER 2: Customer-level attributes by device type
 * TIER 3: Hardcoded defaults (fallback)
 *
 * @param {string} deviceId - Device entity ID
 * @param {string} deviceType - Device type (for customer-level lookup)
 * @param {Object} customerLimits - Pre-fetched customer limits (TIER 2)
 * @returns {Promise<Object>} Consumption ranges with source indicator
 */
async function getConsumptionRangesHierarchical(deviceId, deviceType, customerLimits) {
  // TIER 1: Try device-level attributes first (highest priority)
  const cached = deviceConsumptionLimitsCache.get(deviceId);
  const now = Date.now();

  let deviceLimits = null;

  if (cached && (now - cached.timestamp) < DEVICE_CACHE_TTL_MS) {
    deviceLimits = cached.limits;
  } else {
    // Fetch fresh device attributes
    deviceLimits = await fetchDeviceConsumptionLimits(deviceId);
    if (deviceLimits) {
      deviceConsumptionLimitsCache.set(deviceId, {
        limits: deviceLimits,
        timestamp: now
      });
    }
  }

  // If device has custom limits, use them (TIER 1)
  if (deviceLimits) {
    const ranges = extractDeviceLevelRanges(deviceLimits);
    if (ranges) {
      console.log(`[RFC-0077] Using DEVICE-level limits for ${deviceId} (TIER 1)`);
      return {
        ...ranges,
        source: 'device', // Indicator for UI
        tier: 1
      };
    }
  }

  // TIER 2: Fall back to customer-level attributes (by device type)
  if (customerLimits) {
    const ranges = extractConsumptionRanges(customerLimits, deviceType);
    if (ranges) {
      console.log(`[RFC-0077] Using CUSTOMER-level limits for ${deviceType} (TIER 2)`);
      return {
        ...ranges,
        source: 'customer',
        tier: 2
      };
    }
  }

  // TIER 3: Last resort - hardcoded defaults
  const ranges = getDefaultRanges(deviceType);
  console.log(`[RFC-0077] Using HARDCODED defaults for ${deviceType} (TIER 3)`);
  return {
    ...ranges,
    source: 'hardcoded',
    tier: 3
  };
}

/**
 * Extracts ranges from device-level limits (no device-type suffix)
 */
function extractDeviceLevelRanges(deviceLimits) {
  const standbyRange = {
    down: deviceLimits['standbyLimitDownConsumption'],
    up: deviceLimits['standbyLimitUpConsumption']
  };
  const alertRange = {
    down: deviceLimits['alertLimitDownConsumption'],
    up: deviceLimits['alertLimitUpConsumption']
  };
  const normalRange = {
    down: deviceLimits['normalLimitDownConsumption'],
    up: deviceLimits['normalLimitUpConsumption']
  };
  const failureRange = {
    down: deviceLimits['failureLimitDownConsumption'],
    up: deviceLimits['failureLimitUpConsumption']
  };

  // Validate all ranges exist
  if (
    standbyRange.down !== undefined && standbyRange.up !== undefined &&
    normalRange.down !== undefined && normalRange.up !== undefined &&
    alertRange.down !== undefined && alertRange.up !== undefined &&
    failureRange.down !== undefined && failureRange.up !== undefined
  ) {
    return { standbyRange, normalRange, alertRange, failureRange };
  }

  return null;
}

/**
 * Gets default ranges for a device type (TIER 3)
 */
function getDefaultRanges(deviceType) {
  const attributeSuffix = DEVICE_TYPE_ATTRIBUTE_MAP[deviceType.toUpperCase()];
  return DEFAULT_CONSUMPTION_RANGES[attributeSuffix] || DEFAULT_CONSUMPTION_RANGES['DEFAULT'];
}

/**
 * Modified renderList to use hierarchical resolution
 */
async function renderList() {
  // ... existing code ...

  // Fetch customer consumption limits ONCE per render (cached)
  const customerId = self.ctx.settings.customerId || window.custumersSelected?.[0]?.value;
  const customerLimits = await getCachedConsumptionLimits(customerId);

  if (customerLimits) {
    console.log(`[RFC-0077] Successfully loaded customer consumption limits (TIER 2)`);
  } else {
    console.log(`[RFC-0077] No customer limits found, will use defaults (TIER 3)`);
  }

  // Process each device
  for (const device of devices) {
    // ... existing device processing ...

    const deviceProfile = findValue(device.values, "deviceProfile", "").toUpperCase();
    let deviceType = findValue(device.values, "deviceType", "").toUpperCase();

    if (deviceType === "3F_MEDIDOR" && deviceProfile !== "N/D") {
      deviceType = deviceProfile;
    }

    const deviceId = device.id?.id || device.id;

    // 🚨 CRITICAL: Use hierarchical resolution instead of switch statement
    // ❌ DELETE: switch(deviceType) { ... }
    // ✅ REPLACE WITH:
    const rangesWithSource = await getConsumptionRangesHierarchical(
      deviceId,
      deviceType,
      customerLimits
    );

    // Calculate device status using range-based calculation
    const deviceStatus = MyIOLibrary.calculateDeviceStatusWithRanges({
      connectionStatus: mappedConnectionStatus,
      lastConsumptionValue: Number(consumptionValue) || null,
      ranges: rangesWithSource
    });

    // Store source info for UI (SettingsModal will use this)
    device._consumptionLimitsSource = rangesWithSource.source; // 'device', 'customer', or 'hardcoded'
    device._consumptionLimitsTier = rangesWithSource.tier; // 1, 2, or 3

    // ... rest of device processing ...
  }
}
```

#### 5.1. SettingsModalView UI Enhancement

**🆕 NEW FEATURE:** Add Power Limits configuration UI to SettingsModalView.

**Location:** `src/components/premium-modals/settings/SettingsModalView.ts`

**Key Changes:**

1. **Move device name to modal header** to avoid repetition
2. **Add scrollable modal body** for new Power Limits card
3. **Add Power Limits Configuration card** below existing Alarm card
4. **Show source indicators** (🔵 Device / 🌐 Global)
5. **Add "Copy from Global" button** to copy customer values to device
6. **Add "Clear Overrides" button** to remove device-level attributes

**Implementation:**

```typescript
// src/components/premium-modals/settings/SettingsModalView.ts

interface PowerLimit {
  down: number;
  up: number;
  source: 'device' | 'customer' | 'hardcoded';
}

interface PowerLimitsConfig {
  standby: PowerLimit;
  normal: PowerLimit;
  alert: PowerLimit;
  failure: PowerLimit;
}

export class SettingsModalView {
  // ... existing properties ...

  private deviceId: string;
  private deviceType: string;
  private customerId: string;
  private deviceName: string;

  constructor(config: ModalConfig) {
    this.config = config;
    this.deviceId = config.deviceId;
    this.deviceType = config.deviceType;
    this.customerId = config.customerId;
    this.deviceName = config.deviceName || 'Dispositivo';
    this.createModal();
  }

  /**
   * Modified getModalHTML to include device name in header
   */
  private getModalHTML(): string {
    const width = typeof this.config.width === 'number'
      ? `${this.config.width}px`
      : this.config.width;

    return `
      <div class="myio-settings-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="myio-settings-modal" style="width: ${width}">
          <div class="modal-header">
            <h3 id="modal-title">Configurações - ${this.deviceName}</h3>
            <button type="button" class="close-btn" aria-label="Fechar">&times;</button>
          </div>
          <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
            <div class="error-message" style="display: none;" role="alert" aria-live="polite"></div>
            <form novalidate>
              ${this.getFormHTML()}
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-cancel">Fechar</button>
            <button type="button" class="btn-save btn-primary">Salvar</button>
          </div>
        </div>
      </div>
      ${this.getModalCSS()}
    `;
  }

  /**
   * Modified getFormHTML to add Power Limits card
   */
  private getFormHTML(): string {
    const deviceType = this.config.deviceType;
    const customerName = this.config.customerName;
    const deviceLabel = this.config.deviceLabel || 'NÃO INFORMADO';

    return `
      <div class="form-layout">
        <!-- Existing: Label Card (with customerName display) -->
        <div class="form-card">
          <h4 class="section-title">Identificação</h4>

          <!-- Customer Name Display (read-only, above device label) -->
          ${customerName ? `
            <div class="form-group">
              <label class="form-label-readonly">Shopping</label>
              <div class="form-value-readonly customer-name-display">
                <span class="customer-icon">🏢</span>
                <span class="customer-name-text">${customerName}</span>
              </div>
            </div>
          ` : ''}

          <!-- Device Label Display (read-only) -->
          <div class="form-group">
            <label class="form-label-readonly">Rótulo do Dispositivo</label>
            <div class="form-value-readonly device-label-display">
              ${deviceLabel}
            </div>
          </div>

          <!-- Editable Label Input (if needed for editing) -->
          <div class="form-group">
            <label for="label">Editar Rótulo</label>
            <input
              type="text"
              id="label"
              name="label"
              class="form-control"
              maxlength="100"
              placeholder="${deviceLabel}"
            />
            <small class="form-hint">Deixe em branco para manter o rótulo atual</small>
          </div>
        </div>

        <!-- Existing: Alarm Configuration Card -->
        <div class="form-card">
          <h4 class="section-title">Configuração de Alarme</h4>
          <!-- ... existing alarm fields ... -->
        </div>

        <!-- 🆕 NEW: Power Limits Configuration Card -->
        ${deviceType !== 'TANK' && deviceType !== 'CAIXA_DAGUA' ? this.getPowerLimitsCardHTML() : ''}
      </div>
    `;
  }

  /**
   * 🆕 NEW: Renders Power Limits Configuration Card
   */
  private getPowerLimitsCardHTML(): string {
    return `
      <div class="form-card power-limits-card">
        <h4 class="section-title">Limites de Potência (Watts)</h4>
        <p class="section-description">
          Configure os limites de consumo para este dispositivo.
          Valores específicos do dispositivo sobrescrevem os valores globais do shopping.
        </p>

        <div class="power-limits-table-container">
          <table class="power-limits-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Mínimo (Down)</th>
                <th>Máximo (Up)</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              <!-- StandBy Row -->
              <tr data-limit-type="standby">
                <td class="limit-label">
                  <span class="status-badge status-standby">StandBy</span>
                </td>
                <td>
                  <input
                    type="number"
                    name="standbyLimitDownConsumption"
                    class="form-control-sm limit-input"
                    min="0"
                    step="1"
                    data-limit-type="standby"
                    data-limit-bound="down"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    name="standbyLimitUpConsumption"
                    class="form-control-sm limit-input"
                    min="0"
                    step="1"
                    data-limit-type="standby"
                    data-limit-bound="up"
                  />
                </td>
                <td class="limit-source">
                  <span class="source-indicator" data-source-for="standby">
                    <span class="source-icon">🌐</span>
                    <span class="source-text">Global</span>
                  </span>
                </td>
              </tr>

              <!-- Normal Row -->
              <tr data-limit-type="normal">
                <td class="limit-label">
                  <span class="status-badge status-normal">Normal</span>
                </td>
                <td>
                  <input
                    type="number"
                    name="normalLimitDownConsumption"
                    class="form-control-sm limit-input"
                    min="0"
                    step="1"
                    data-limit-type="normal"
                    data-limit-bound="down"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    name="normalLimitUpConsumption"
                    class="form-control-sm limit-input"
                    min="0"
                    step="1"
                    data-limit-type="normal"
                    data-limit-bound="up"
                  />
                </td>
                <td class="limit-source">
                  <span class="source-indicator" data-source-for="normal">
                    <span class="source-icon">🌐</span>
                    <span class="source-text">Global</span>
                  </span>
                </td>
              </tr>

              <!-- Alert Row -->
              <tr data-limit-type="alert">
                <td class="limit-label">
                  <span class="status-badge status-alert">Alerta</span>
                </td>
                <td>
                  <input
                    type="number"
                    name="alertLimitDownConsumption"
                    class="form-control-sm limit-input"
                    min="0"
                    step="1"
                    data-limit-type="alert"
                    data-limit-bound="down"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    name="alertLimitUpConsumption"
                    class="form-control-sm limit-input"
                    min="0"
                    step="1"
                    data-limit-type="alert"
                    data-limit-bound="up"
                  />
                </td>
                <td class="limit-source">
                  <span class="source-indicator" data-source-for="alert">
                    <span class="source-icon">🌐</span>
                    <span class="source-text">Global</span>
                  </span>
                </td>
              </tr>

              <!-- Failure Row -->
              <tr data-limit-type="failure">
                <td class="limit-label">
                  <span class="status-badge status-failure">Falha</span>
                </td>
                <td>
                  <input
                    type="number"
                    name="failureLimitDownConsumption"
                    class="form-control-sm limit-input"
                    min="0"
                    step="1"
                    data-limit-type="failure"
                    data-limit-bound="down"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    name="failureLimitUpConsumption"
                    class="form-control-sm limit-input"
                    min="0"
                    step="1"
                    data-limit-type="failure"
                    data-limit-bound="up"
                  />
                </td>
                <td class="limit-source">
                  <span class="source-indicator" data-source-for="failure">
                    <span class="source-icon">🌐</span>
                    <span class="source-text">Global</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="power-limits-legend">
          <div class="legend-item">
            <span class="source-icon">🔵</span>
            <span class="legend-text">Dispositivo</span>
            <small>Valor específico deste dispositivo</small>
          </div>
          <div class="legend-item">
            <span class="source-icon">🌐</span>
            <span class="legend-text">Global</span>
            <small>Valor padrão do shopping (customer)</small>
          </div>
        </div>

        <div class="power-limits-actions">
          <button
            type="button"
            class="btn-copy-global"
            title="Copiar todos os valores globais para este dispositivo"
          >
            <span>📋</span> Copiar do Global
          </button>
          <button
            type="button"
            class="btn-clear-overrides"
            title="Remover valores específicos e usar apenas valores globais"
          >
            <span>🗑️</span> Limpar Personalizações
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 🆕 NEW: Fetches and populates power limits data
   */
  private async populatePowerLimits(): Promise<void> {
    try {
      // Fetch device-level limits (TIER 1)
      const deviceLimits = await this.fetchDeviceLimits(this.deviceId);

      // Fetch customer-level limits (TIER 2)
      const customerLimits = await this.fetchCustomerLimits(this.customerId, this.deviceType);

      // Populate form fields
      this.populatePowerLimitsForm(deviceLimits, customerLimits);

    } catch (error) {
      console.error('[RFC-0077] Error fetching power limits:', error);
      this.showError('Erro ao carregar limites de potência');
    }
  }

  /**
   * Fetches device-level limits
   */
  private async fetchDeviceLimits(deviceId: string): Promise<PowerLimitsConfig | null> {
    const token = localStorage.getItem('jwt_token');
    if (!token) return null;

    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`;

    try {
      const response = await fetch(url, {
        headers: {
          'X-Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) return null; // No device overrides
        throw new Error(`HTTP ${response.status}`);
      }

      const attributes = await response.json();
      return this.parseLimitsFromAttributes(attributes, 'device');

    } catch (error) {
      console.warn('[RFC-0077] Could not fetch device limits:', error);
      return null;
    }
  }

  /**
   * Fetches customer-level limits for device type
   */
  private async fetchCustomerLimits(customerId: string, deviceType: string): Promise<PowerLimitsConfig | null> {
    const token = localStorage.getItem('jwt_token');
    if (!token) return null;

    const url = `/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE`;

    try {
      const response = await fetch(url, {
        headers: {
          'X-Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const attributes = await response.json();
      return this.parseLimitsFromAttributes(attributes, 'customer', deviceType);

    } catch (error) {
      console.warn('[RFC-0077] Could not fetch customer limits:', error);
      return null;
    }
  }

  /**
   * Parses attributes into PowerLimitsConfig
   */
  private parseLimitsFromAttributes(
    attributes: any[],
    source: 'device' | 'customer',
    deviceType?: string
  ): PowerLimitsConfig | null {
    const suffix = source === 'device' ? '' : this.getDeviceTypeSuffix(deviceType || this.deviceType);

    const standbyDown = attributes.find(a => a.key === `standbyLimitDownConsumption${suffix}`)?.value;
    const standbyUp = attributes.find(a => a.key === `standbyLimitUpConsumption${suffix}`)?.value;
    const normalDown = attributes.find(a => a.key === `normalLimitDownConsumption${suffix}`)?.value;
    const normalUp = attributes.find(a => a.key === `normalLimitUpConsumption${suffix}`)?.value;
    const alertDown = attributes.find(a => a.key === `alertLimitDownConsumption${suffix}`)?.value;
    const alertUp = attributes.find(a => a.key === `alertLimitUpConsumption${suffix}`)?.value;
    const failureDown = attributes.find(a => a.key === `failureLimitDownConsumption${suffix}`)?.value;
    const failureUp = attributes.find(a => a.key === `failureLimitUpConsumption${suffix}`)?.value;

    if (standbyDown === undefined || standbyUp === undefined ||
        normalDown === undefined || normalUp === undefined ||
        alertDown === undefined || alertUp === undefined ||
        failureDown === undefined || failureUp === undefined) {
      return null;
    }

    return {
      standby: { down: Number(standbyDown), up: Number(standbyUp), source },
      normal: { down: Number(normalDown), up: Number(normalUp), source },
      alert: { down: Number(alertDown), up: Number(alertUp), source },
      failure: { down: Number(failureDown), up: Number(failureUp), source }
    };
  }

  /**
   * Maps device type to attribute suffix
   */
  private getDeviceTypeSuffix(deviceType: string): string {
    const map: Record<string, string> = {
      'ELEVADOR': 'Elevator',
      'ELEVATOR': 'Elevator',
      'ESCADA_ROLANTE': 'Escalator',
      'ESCALATOR': 'Escalator',
      'MOTOR': 'Motor',
      'BOMBA': 'Motor',
      'PUMP': 'Motor',
      'CHILLER': 'Chiller',
      'AR_CONDICIONADO': 'HVAC',
      'AC': 'HVAC',
      'HVAC': 'HVAC',
      'FANCOIL': 'HVAC'
    };
    return map[deviceType.toUpperCase()] || '';
  }

  /**
   * Populates form with power limits data
   */
  private populatePowerLimitsForm(
    deviceLimits: PowerLimitsConfig | null,
    customerLimits: PowerLimitsConfig | null
  ): void {
    const limitTypes = ['standby', 'normal', 'alert', 'failure'] as const;

    limitTypes.forEach(type => {
      const deviceLimit = deviceLimits?.[type];
      const customerLimit = customerLimits?.[type];

      // Use device limit if exists, otherwise customer limit
      const activeLimit = deviceLimit || customerLimit;
      const source = deviceLimit ? 'device' : 'customer';

      if (activeLimit) {
        // Populate input fields
        const downInput = this.modal.querySelector(
          `input[name="${type}LimitDownConsumption"]`
        ) as HTMLInputElement;
        const upInput = this.modal.querySelector(
          `input[name="${type}LimitUpConsumption"]`
        ) as HTMLInputElement;

        if (downInput) downInput.value = String(activeLimit.down);
        if (upInput) upInput.value = String(activeLimit.up);

        // Update source indicator
        const sourceIndicator = this.modal.querySelector(
          `.source-indicator[data-source-for="${type}"]`
        ) as HTMLElement;

        if (sourceIndicator) {
          const icon = sourceIndicator.querySelector('.source-icon') as HTMLElement;
          const text = sourceIndicator.querySelector('.source-text') as HTMLElement;

          if (source === 'device') {
            icon.textContent = '🔵';
            text.textContent = 'Dispositivo';
            sourceIndicator.classList.add('source-device');
            sourceIndicator.classList.remove('source-customer');
          } else {
            icon.textContent = '🌐';
            text.textContent = 'Global';
            sourceIndicator.classList.add('source-customer');
            sourceIndicator.classList.remove('source-device');
          }
        }
      }
    });

    // Store customer limits for "Copy from Global" feature
    this.modal.dataset.customerLimits = JSON.stringify(customerLimits);
  }

  /**
   * 🆕 NEW: Handles "Copy from Global" button click
   */
  private handleCopyFromGlobal(): void {
    const customerLimitsJson = this.modal.dataset.customerLimits;
    if (!customerLimitsJson) {
      this.showError('Valores globais não disponíveis');
      return;
    }

    const customerLimits: PowerLimitsConfig = JSON.parse(customerLimitsJson);
    const limitTypes = ['standby', 'normal', 'alert', 'failure'] as const;

    limitTypes.forEach(type => {
      const customerLimit = customerLimits[type];
      if (customerLimit) {
        const downInput = this.modal.querySelector(
          `input[name="${type}LimitDownConsumption"]`
        ) as HTMLInputElement;
        const upInput = this.modal.querySelector(
          `input[name="${type}LimitUpConsumption"]`
        ) as HTMLInputElement;

        if (downInput) downInput.value = String(customerLimit.down);
        if (upInput) upInput.value = String(customerLimit.up);

        // Update source indicator to show it will become device-specific after save
        const sourceIndicator = this.modal.querySelector(
          `.source-indicator[data-source-for="${type}"]`
        ) as HTMLElement;

        if (sourceIndicator) {
          const icon = sourceIndicator.querySelector('.source-icon') as HTMLElement;
          const text = sourceIndicator.querySelector('.source-text') as HTMLElement;
          icon.textContent = '🔵';
          text.textContent = 'Dispositivo (após salvar)';
          sourceIndicator.classList.add('source-device');
          sourceIndicator.classList.remove('source-customer');
        }
      }
    });

    console.log('[RFC-0077] Copied global limits to device fields');
  }

  /**
   * 🆕 NEW: Handles "Clear Overrides" button click
   */
  private async handleClearOverrides(): Promise<void> {
    if (!confirm('Remover todas as personalizações deste dispositivo e usar apenas valores globais?')) {
      return;
    }

    try {
      await this.deleteDeviceLimits(this.deviceId);

      // Refresh form to show customer limits
      await this.populatePowerLimits();

      console.log('[RFC-0077] Cleared device-level overrides');
    } catch (error) {
      console.error('[RFC-0077] Error clearing overrides:', error);
      this.showError('Erro ao limpar personalizações');
    }
  }

  /**
   * Deletes device-level limit attributes
   */
  private async deleteDeviceLimits(deviceId: string): Promise<void> {
    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error('JWT token not found');

    const attributeKeys = [
      'standbyLimitDownConsumption', 'standbyLimitUpConsumption',
      'normalLimitDownConsumption', 'normalLimitUpConsumption',
      'alertLimitDownConsumption', 'alertLimitUpConsumption',
      'failureLimitDownConsumption', 'failureLimitUpConsumption'
    ];

    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/SERVER_SCOPE?keys=${attributeKeys.join(',')}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }

  /**
   * Modified attachEventListeners to include power limits buttons
   */
  private attachEventListeners(): void {
    // ... existing event listeners ...

    // 🆕 NEW: Copy from Global button
    const copyGlobalBtn = this.modal.querySelector('.btn-copy-global') as HTMLButtonElement;
    if (copyGlobalBtn) {
      copyGlobalBtn.addEventListener('click', () => this.handleCopyFromGlobal());
    }

    // 🆕 NEW: Clear Overrides button
    const clearOverridesBtn = this.modal.querySelector('.btn-clear-overrides') as HTMLButtonElement;
    if (clearOverridesBtn) {
      clearOverridesBtn.addEventListener('click', () => this.handleClearOverrides());
    }

    // ... rest of existing event listeners ...
  }

  /**
   * Modified render to fetch and populate power limits
   */
  async render(initialData: Record<string, any>): Promise<void> {
    this.originalActiveElement = document.activeElement;
    document.body.appendChild(this.container);

    this.populateForm(initialData);

    // 🆕 NEW: Fetch and populate power limits
    await this.populatePowerLimits();

    this.attachEventListeners();
    this.setupAccessibility();
    this.setupFocusTrap();
    this.applyTheme();
  }

  /**
   * Modified getFormData to include power limits
   */
  getFormData(): Record<string, any> {
    const formData = new FormData(this.form);
    const data: Record<string, any> = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        // Convert limit fields to numbers
        if (key.includes('LimitDownConsumption') || key.includes('LimitUpConsumption')) {
          data[key] = Number(value) || 0;
        } else {
          data[key] = value;
        }
      }
    }

    return data;
  }

  /**
   * 🆕 NEW: Adds CSS for Power Limits card and customer name display
   */
  private getPowerLimitsCSS(): string {
    return `
      <style>
        /* Customer Name Display */
        .form-label-readonly {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--myio-text-2, #666);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-value-readonly {
          padding: 10px 12px;
          background-color: var(--myio-bg-2, #f5f5f5);
          border-radius: 6px;
          font-size: 14px;
          color: var(--myio-text-1, #333);
          font-weight: 500;
          border: 1px solid var(--myio-border, #e0e0e0);
        }

        .customer-name-display {
          display: flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 16px;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
        }

        .customer-icon {
          font-size: 18px;
        }

        .customer-name-text {
          font-weight: 600;
          font-size: 15px;
        }

        .device-label-display {
          font-family: 'Courier New', monospace;
          background-color: var(--myio-bg-1, #fafafa);
        }

        .form-hint {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: var(--myio-text-3, #999);
          font-style: italic;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group:last-child {
          margin-bottom: 0;
        }

        /* Power Limits Card */
        .power-limits-card {
          margin-top: 16px;
        }

        .section-description {
          font-size: 13px;
          color: var(--myio-text-2, #666);
          margin-bottom: 16px;
          line-height: 1.4;
        }

        .power-limits-table-container {
          overflow-x: auto;
          margin-bottom: 16px;
        }

        .power-limits-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .power-limits-table thead {
          background-color: var(--myio-bg-2, #f5f5f5);
        }

        .power-limits-table th {
          padding: 10px 8px;
          text-align: left;
          font-weight: 600;
          color: var(--myio-text-1, #333);
          border-bottom: 2px solid var(--myio-border, #ddd);
        }

        .power-limits-table td {
          padding: 12px 8px;
          border-bottom: 1px solid var(--myio-border, #eee);
        }

        .power-limits-table tbody tr:hover {
          background-color: var(--myio-bg-hover, #f9f9f9);
        }

        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-standby {
          background-color: #e3f2fd;
          color: #1976d2;
        }

        .status-normal {
          background-color: #e8f5e9;
          color: #388e3c;
        }

        .status-alert {
          background-color: #fff3e0;
          color: #f57c00;
        }

        .status-failure {
          background-color: #ffebee;
          color: #d32f2f;
        }

        .form-control-sm {
          width: 100%;
          max-width: 120px;
          padding: 6px 10px;
          border: 1px solid var(--myio-border, #ddd);
          border-radius: 4px;
          font-size: 13px;
        }

        .form-control-sm:focus {
          outline: none;
          border-color: var(--myio-primary, #4CAF50);
          box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
        }

        .limit-source {
          text-align: center;
        }

        .source-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .source-indicator.source-device {
          background-color: #e3f2fd;
          color: #1565c0;
        }

        .source-indicator.source-customer {
          background-color: #f3e5f5;
          color: #7b1fa2;
        }

        .source-icon {
          font-size: 14px;
        }

        .power-limits-legend {
          display: flex;
          gap: 20px;
          padding: 12px;
          background-color: var(--myio-bg-2, #f9f9f9);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .legend-item small {
          color: var(--myio-text-3, #888);
          font-size: 11px;
        }

        .power-limits-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn-copy-global,
        .btn-clear-overrides {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: 1px solid var(--myio-border, #ddd);
          border-radius: 6px;
          background-color: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-copy-global:hover {
          background-color: #e3f2fd;
          border-color: #1976d2;
          color: #1976d2;
        }

        .btn-clear-overrides:hover {
          background-color: #ffebee;
          border-color: #d32f2f;
          color: #d32f2f;
        }

        .btn-copy-global:active,
        .btn-clear-overrides:active {
          transform: translateY(1px);
        }

        /* Modal Body Scroll */
        .modal-body {
          max-height: 70vh;
          overflow-y: auto;
          padding: 20px;
        }

        .modal-body::-webkit-scrollbar {
          width: 8px;
        }

        .modal-body::-webkit-scrollbar-track {
          background: #f1f1f1;
        }

        .modal-body::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }

        .modal-body::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      </style>
    `;
  }

  /**
   * Modified getModalCSS to include power limits styles
   */
  private getModalCSS(): string {
    return `
      ${this.getExistingModalCSS()}
      ${this.getPowerLimitsCSS()}
    `;
  }
}
```

**Key Features of the UI:**

1. **Device Name in Header**: Avoids repetition, shows "Configurações - [Device Name]"
2. **Customer Name Display**: Shows shopping name (🏢 icon) above device label when available
3. **Device Label Display**: Shows current device label with fallback "NÃO INFORMADO" (NOT "Outback")
4. **Scrollable Body**: Modal body has max-height 70vh with scroll for long content
5. **Power Limits Table**: Clean table showing all 4 status tiers (StandBy, Normal, Alert, Failure)
6. **Source Indicators**: Visual badges showing 🔵 Device or 🌐 Global for each limit
7. **Copy from Global Button**: One-click copy of customer values to device fields
8. **Clear Overrides Button**: Removes device-level attributes, reverting to customer defaults
9. **Legend**: Explains the source indicators clearly
10. **Responsive Design**: Table scrolls horizontally on small screens

#### 5.2. MYIO-SIM Widgets Integration

**CRITICAL:** All MYIO-SIM widgets MUST pass `customerName` when opening SettingsModalView.

**Location:** All widgets in `src/MYIO-SIM/V1.0.0/**/controller.js`

**Affected Widgets:**
- EQUIPMENTS
- STORES
- ENERGY
- MENU
- MAIN
- TELEMETRY (v-5.2.0)

**Implementation Pattern:**

```javascript
// src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js
// src/MYIO-SIM/V1.0.0/STORES/controller.js
// etc.

/**
 * Handles opening settings modal for a device
 * IMPORTANT: Must include customerName for proper display
 */
function handleActionSettings(device) {
  console.log("[RFC-0077] Opening settings for device:", device.id);

  // Extract customerName (already implemented in EQUIPMENTS and STORES)
  const customerName = device.customerName || extractCustomerName(device);

  // Prepare settings data with ALL required fields
  const settingsData = {
    // Identity
    deviceId: device.id || device.ingestionId,
    deviceName: device.name || device.label,
    deviceLabel: device.label || device.labelOrName || 'NÃO INFORMADO',
    deviceType: device.deviceType,

    // 🆕 CRITICAL: Customer information
    customerName: customerName, // Shopping name - MUST be included
    customerId: device.customerId,

    // Location information
    location: extractLocation(device),
    floor: device.floor,
    zone: device.zone,

    // Technical metadata
    deviceProfile: device.deviceProfile,
    connectionStatus: device.connectionStatus,
    lastUpdate: device.lastUpdate,
    consumption: device.consumption,

    // Context for the popup
    context: 'equipments', // or 'stores', 'energy', etc.
    origin: 'MYIO-SIM-EQUIPMENTS'
  };

  // Call standardized component
  if (typeof window.MyIOLibrary?.openDashboardPopupSettings === 'function') {
    window.MyIOLibrary.openDashboardPopupSettings(settingsData);
  } else {
    console.error("[RFC-0077] openDashboardPopupSettings not available");
  }
}

/**
 * Helper: Extract customer name from device
 * (This function should already exist in EQUIPMENTS and STORES from previous work)
 */
function extractCustomerName(device) {
  // Priority 1: device.customerName (if already set)
  if (device.customerName) return device.customerName;

  // Priority 2: Look up in custumersSelected by customerId
  if (device.customerId && window.custumersSelected && Array.isArray(window.custumersSelected)) {
    const customer = window.custumersSelected.find(c => c.value === device.customerId);
    if (customer) return customer.name;
  }

  // Priority 3: Try to get from energyCache via ingestionId
  if (device.ingestionId) {
    const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
    if (orchestrator && typeof orchestrator.getEnergyCache === 'function') {
      const energyCache = orchestrator.getEnergyCache();
      const cached = energyCache.get(device.ingestionId);
      if (cached && cached.customerName) {
        return cached.customerName;
      }
    }
  }

  // Priority 4: Fallback to customerId substring
  if (device.customerId) {
    return `Shopping ${device.customerId.substring(0, 8)}...`;
  }

  // Last resort: return null (UI will not show customer name section)
  return null;
}
```

**Example Usage in EQUIPMENTS Widget:**

```javascript
// src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js

// In renderList(), ensure customerName is added to device object
for (const device of devices) {
  // ... existing device processing ...

  // Add customerName to device object
  device.customerName = getShoppingNameForDevice(device);

  // ... rest of processing ...
}

// When settings icon is clicked
function handleSettingsClick(device) {
  handleActionSettings(device); // Will include customerName
}
```

**Example Usage in STORES Widget:**

```javascript
// src/MYIO-SIM/V1.0.0/STORES/controller.js

// In renderList()
for (const it of items) {
  // ... existing processing ...

  // Add customerName (already implemented)
  const customerName = getShoppingNameForDevice(it);

  const entityObject = {
    // ... existing fields ...
    customerName: customerName, // Shopping name
  };

  // ... rest of processing ...
}
```

**Visual Result in SettingsModalView:**

When `customerName` is provided:
```
┌──────────────────────────────────────┐
│ Configurações - Elevador 01          │
├──────────────────────────────────────┤
│ [Card: Identificação]                │
│                                       │
│  SHOPPING                            │
│  ┌────────────────────────────────┐  │
│  │ 🏢  Shopping Obramax           │  │ ← Purple gradient
│  └────────────────────────────────┘  │
│                                       │
│  RÓTULO DO DISPOSITIVO              │
│  ┌────────────────────────────────┐  │
│  │ Elevador 01 - Piso Térreo     │  │ ← Gray background
│  └────────────────────────────────┘  │
│                                       │
│  Editar Rótulo                       │
│  [____________________________]      │
│  Deixe em branco para manter atual   │
└──────────────────────────────────────┘
```

When `customerName` is NOT provided:
```
┌──────────────────────────────────────┐
│ Configurações - Elevador 01          │
├──────────────────────────────────────┤
│ [Card: Identificação]                │
│                                       │
│  RÓTULO DO DISPOSITIVO              │
│  ┌────────────────────────────────┐  │
│  │ Elevador 01 - Piso Térreo     │  │
│  └────────────────────────────────┘  │
│                                       │
│  Editar Rótulo                       │
│  [____________________________]      │
│  Deixe em branco para manter atual   │
└──────────────────────────────────────┘
```

**Fallback Behavior:**

| Scenario | deviceLabel Value | Display |
|----------|------------------|---------|
| `deviceLabel: "Elevador 01"` | "Elevador 01" | "Elevador 01" |
| `deviceLabel: ""` | "" | "NÃO INFORMADO" |
| `deviceLabel: null` | null | "NÃO INFORMADO" |
| `deviceLabel: undefined` | undefined | "NÃO INFORMADO" |
| Missing parameter | undefined | "NÃO INFORMADO" |

**CRITICAL NOTES:**

1. ✅ **customerName is OPTIONAL** - UI gracefully handles null/undefined
2. ✅ **deviceLabel fallback is "NÃO INFORMADO"** - NOT "Outback"
3. ✅ **Customer name shows with purple gradient** - visually distinct
4. ✅ **Device label shows in monospace font** - clearly identifies device
5. ✅ **All MYIO-SIM widgets MUST implement** - consistency across platform

#### 6. Enhance calculateDeviceStatus Function

**Location:** `src/utils/deviceStatus.js`

Add new function to support range-based calculation:

```javascript
/**
 * Calculates device status based on connection status and consumption ranges
 * Enhanced version supporting range-based (down/up) thresholds
 *
 * @param {Object} params - Configuration object
 * @param {string} params.connectionStatus - Connection status: "waiting", "offline", or "online"
 * @param {number|null} params.lastConsumptionValue - Last power consumption value in watts
 * @param {Object} params.ranges - Range-based thresholds
 * @param {Object} params.ranges.standbyRange - Standby range: { down: number, up: number }
 * @param {Object} params.ranges.normalRange - Normal operation range: { down: number, up: number }
 * @param {Object} params.ranges.alertRange - Alert/warning range: { down: number, up: number }
 * @param {Object} params.ranges.failureRange - Failure range: { down: number, up: number }
 * @returns {string} Device status from DeviceStatusType enum
 *
 * @example
 * // Device in normal operation
 * calculateDeviceStatusWithRanges({
 *   connectionStatus: "online",
 *   lastConsumptionValue: 900,
 *   ranges: {
 *     standbyRange: { down: 0, up: 150 },
 *     normalRange: { down: 150, up: 1200 },
 *     alertRange: { down: 1200, up: 1500 },
 *     failureRange: { down: 1500, up: 99999 }
 *   }
 * }); // Returns "power_on"
 *
 * @example
 * // Device in standby
 * calculateDeviceStatusWithRanges({
 *   connectionStatus: "online",
 *   lastConsumptionValue: 80,
 *   ranges: {
 *     standbyRange: { down: 0, up: 150 },
 *     normalRange: { down: 150, up: 1200 },
 *     alertRange: { down: 1200, up: 1500 },
 *     failureRange: { down: 1500, up: 99999 }
 *   }
 * }); // Returns "standby"
 *
 * @example
 * // Device in alert zone
 * calculateDeviceStatusWithRanges({
 *   connectionStatus: "online",
 *   lastConsumptionValue: 1300,
 *   ranges: {
 *     standbyRange: { down: 0, up: 150 },
 *     normalRange: { down: 150, up: 1200 },
 *     alertRange: { down: 1200, up: 1500 },
 *     failureRange: { down: 1500, up: 99999 }
 *   }
 * }); // Returns "warning"
 */
export function calculateDeviceStatusWithRanges({
  connectionStatus,
  lastConsumptionValue,
  ranges
}) {
  // Validate connectionStatus
  const validConnectionStatuses = ["waiting", "offline", "online"];
  if (!validConnectionStatuses.includes(connectionStatus)) {
    return DeviceStatusType.MAINTENANCE;
  }

  // If waiting for installation
  if (connectionStatus === "waiting") {
    return DeviceStatusType.NOT_INSTALLED;
  }

  // If offline
  if (connectionStatus === "offline") {
    return DeviceStatusType.NO_INFO;
  }

  // If online but no consumption data
  if (connectionStatus === "online" && (lastConsumptionValue === null || lastConsumptionValue === undefined)) {
    return DeviceStatusType.POWER_ON;
  }

  // If online with consumption data
  if (connectionStatus === "online" && lastConsumptionValue !== null && lastConsumptionValue !== undefined) {
    const consumption = Number(lastConsumptionValue);

    // Check if consumption is valid
    if (isNaN(consumption)) {
      return DeviceStatusType.MAINTENANCE;
    }

    // Validate ranges exist
    if (!ranges || !ranges.standbyRange || !ranges.normalRange || !ranges.alertRange || !ranges.failureRange) {
      console.error("[RFC-0077] Invalid ranges provided to calculateDeviceStatusWithRanges");
      return DeviceStatusType.MAINTENANCE;
    }

    // Check each range (order matters: check from most critical to least critical)

    // Failure: consumption in failure range
    if (consumption >= ranges.failureRange.down && consumption <= ranges.failureRange.up) {
      return DeviceStatusType.FAILURE;
    }

    // Alert/Warning: consumption in alert range
    if (consumption >= ranges.alertRange.down && consumption <= ranges.alertRange.up) {
      return DeviceStatusType.WARNING;
    }

    // Normal operation: consumption in normal range
    if (consumption >= ranges.normalRange.down && consumption <= ranges.normalRange.up) {
      return DeviceStatusType.POWER_ON;
    }

    // Standby: consumption in standby range
    if (consumption >= ranges.standbyRange.down && consumption <= ranges.standbyRange.up) {
      return DeviceStatusType.STANDBY;
    }

    // If consumption doesn't fit any range, treat as maintenance needed
    console.warn(`[RFC-0077] Consumption ${consumption}W doesn't fit any defined range`);
    return DeviceStatusType.MAINTENANCE;
  }

  // Fallback
  return DeviceStatusType.MAINTENANCE;
}
```

#### 7. Export New Function

**Location:** `src/index.ts`

```typescript
export {
  // ... existing exports ...
  calculateDeviceStatusWithRanges
} from './utils/deviceStatus';
```

### Data Flow Summary

1. **Widget Initialization**: EQUIPMENTS widget fetches customer attributes on load
2. **Caching**: Attributes cached in memory with 5-minute TTL
3. **Device Processing**: For each device, map deviceType to attribute suffix
4. **Range Extraction**: Extract down/up limits for standby/normal/alert/failure
5. **Status Calculation**: Call enhanced `calculateDeviceStatusWithRanges()` with ranges
6. **Fallback Mechanism**: Use hardcoded defaults if attributes unavailable
7. **Display**: Render device card with calculated status icon

## Drawbacks

1. **API Dependency**: Widget relies on ThingsBoard API availability for custom limits
2. **Migration Complexity**: Existing customers need attributes populated in ThingsBoard
3. **Backward Compatibility**: Must maintain fallback to hardcoded defaults
4. **Cache Invalidation**: 5-minute cache means changes take up to 5 minutes to reflect
5. **Testing Complexity**: Need to test with various customer configurations
6. **Attribute Management**: Administrators must manually configure attributes per customer

## Rationale and Alternatives

### Why This Approach?

1. **Separation of Concerns**: Configuration data separate from application code
2. **Per-Customer Flexibility**: Each customer can have custom limits
3. **No Code Deployment**: Limit changes don't require redeployment
4. **Granular Control**: Range-based (down/up) thresholds provide precision
5. **ThingsBoard Native**: Leverages existing ThingsBoard attribute system
6. **Backward Compatible**: Falls back to hardcoded defaults if attributes missing

### Alternative Approaches Considered

#### Alternative 1: External Configuration Service

Store limits in a separate microservice or database.

**Pros:**
- Independent of ThingsBoard
- More flexible data model
- Easier bulk updates

**Cons:**
- Additional infrastructure
- Another service to maintain
- Not integrated with ThingsBoard

**Why Not Chosen:** Adds unnecessary complexity when ThingsBoard already provides attribute storage.

#### Alternative 2: Device-Level Attributes

Store limits on each device entity instead of customer level.

**Pros:**
- Per-device customization
- More granular control

**Cons:**
- Massive data duplication (100+ devices per customer)
- Harder to manage bulk updates
- Performance impact (fetch attributes for each device)

**Why Not Chosen:** Customer-level attributes are sufficient and more manageable.

#### Alternative 3: Keep Hardcoded, Add Config File

Use a JSON/YAML configuration file in the codebase.

**Pros:**
- Simple implementation
- Version controlled

**Cons:**
- Still requires code deployment for changes
- No per-customer flexibility
- Not integrated with ThingsBoard

**Why Not Chosen:** Doesn't solve the core problem of requiring code changes.

#### Alternative 4: Admin UI for Configuration

Build a custom admin interface for managing limits.

**Pros:**
- User-friendly interface
- Validation and error handling

**Cons:**
- Requires building new UI
- Duplicates ThingsBoard's attribute management
- More code to maintain

**Why Not Chosen:** ThingsBoard already provides attribute management UI.

## Prior Art

### Similar Patterns in MYIO Platform

1. **RFC-0071**: Device Profile Attribute Sync - Similar pattern of syncing ThingsBoard attributes
2. **MyIOOrchestrator**: Uses caching for device data fetching
3. **TELEMETRY Widget**: Fetches telemetry data from ThingsBoard with caching

### Industry Patterns

- **Feature Flags Systems**: LaunchDarkly, Optimizely use similar configuration-driven approaches
- **IoT Platforms**: AWS IoT, Azure IoT use device/customer attributes for configuration
- **SCADA Systems**: Often use tag-based configuration for alarm thresholds

## Unresolved Questions

### Questions to Investigate

1. **Attribute Naming Convention**: Should we use camelCase or snake_case for attribute keys?
   - **Proposed:** camelCase (consistent with existing codebase)

2. **Cache Duration**: Is 5 minutes appropriate or should it be configurable?
   - **Proposed:** 5 minutes with option to force refresh

3. **Overlapping Ranges**: What if administrator configures overlapping ranges?
   - **Proposed:** Add validation to prevent overlaps

4. **Missing Attributes**: Should we fail gracefully or show a warning to admin?
   - **Proposed:** Fail gracefully with console warning

5. **Attribute Population**: How will existing customers get attributes populated?
   - **Proposed:** Migration script or manual setup

6. **Real-time Updates**: Should widget listen for attribute changes via WebSocket?
   - **Proposed:** Phase 2 feature - use cache for Phase 1

### Migration Path

**Option A: Automatic Migration**
- Script to populate default attributes for all existing customers
- Run as one-time migration

**Option B: Gradual Rollout**
- New customers get attributes by default
- Existing customers use hardcoded defaults until configured

**Recommended:** Option B (gradual rollout) to minimize risk.

## Future Possibilities

### Phase 2 Enhancements

1. **Real-time Attribute Updates**: Use ThingsBoard WebSocket to listen for attribute changes
2. **Bulk Attribute Management**: Admin UI for managing limits across multiple customers
3. **Attribute Validation**: API endpoint to validate range consistency and overlaps
4. **Historical Tracking**: Log limit changes for audit trail
5. **AI-Powered Recommendations**: Suggest optimal limits based on historical consumption data

### Additional Device Types

Extend attribute mapping to support:
- Water devices (TANK, CAIXA_DAGUA)
- Other equipment types as they're added

### Unified Configuration System

Create a shared configuration service for all MYIO widgets:
- Centralized attribute caching
- Consistent attribute naming convention
- Shared validation logic
- Configuration version control

## Implementation Checklist

### Phase 1: Core Implementation (Backend & Logic)

**🚨 CRITICAL - Eliminate Hardcoded Switch:**
- [ ] **DELETE hardcoded switch statement** (EQUIPMENTS/controller.js lines 1228-1254)

**Device-Level Attributes (TIER 1):**
- [ ] Add `fetchDeviceConsumptionLimits()` function to EQUIPMENTS/controller.js
- [ ] Implement device-level attributes cache with 5-minute TTL
- [ ] Add `extractDeviceLevelRanges()` function (no device-type suffix)

**Customer-Level Attributes (TIER 2):**
- [ ] Add `fetchCustomerConsumptionLimits()` function to EQUIPMENTS/controller.js
- [ ] Implement customer-level cache mechanism with 5-minute TTL
- [ ] Create `DEVICE_TYPE_ATTRIBUTE_MAP` mapping
- [ ] Implement `extractConsumptionRanges()` function (with device-type suffix)

**Hierarchical Resolution:**
- [ ] Implement `getConsumptionRangesHierarchical()` function
- [ ] Define `DEFAULT_CONSUMPTION_RANGES` fallback (TIER 3)
- [ ] Add `getDefaultRanges()` helper function
- [ ] Modify `renderList()` to use hierarchical resolution
- [ ] Store source info (tier, source) in device object for UI

**Device Status Calculation:**
- [ ] Add `calculateDeviceStatusWithRanges()` to deviceStatus.js
- [ ] Export new function from index.ts
- [ ] Add comprehensive console logging for debugging

### Phase 1.5: SettingsModalView UI Enhancement

**Customer Name Display:**
- [ ] Modify `getFormHTML()` to show customerName above deviceLabel
- [ ] Add conditional rendering for customerName (only if provided)
- [ ] Change deviceLabel fallback from "Outback" to "NÃO INFORMADO"
- [ ] Add purple gradient styling for customer name display
- [ ] Add 🏢 icon for shopping name
- [ ] Add monospace font for device label display

**Power Limits Configuration Card:**
- [ ] Add `getPowerLimitsCardHTML()` function
- [ ] Create power limits table with 4 rows (StandBy, Normal, Alert, Failure)
- [ ] Add Min/Max input fields for each tier
- [ ] Add source indicators (🔵 Device / 🌐 Global)
- [ ] Add legend explaining source indicators
- [ ] Add "Copy from Global" button
- [ ] Add "Clear Overrides" button

**Data Fetching & Population:**
- [ ] Add `fetchDeviceLimits()` function (TIER 1)
- [ ] Add `fetchCustomerLimits()` function (TIER 2)
- [ ] Add `parseLimitsFromAttributes()` function
- [ ] Add `getDeviceTypeSuffix()` mapping helper
- [ ] Add `populatePowerLimits()` async function
- [ ] Add `populatePowerLimitsForm()` function
- [ ] Update source indicators dynamically based on data source

**User Actions:**
- [ ] Implement `handleCopyFromGlobal()` button handler
- [ ] Implement `handleClearOverrides()` button handler
- [ ] Add `deleteDeviceLimits()` DELETE API call
- [ ] Add confirmation dialog for clearing overrides
- [ ] Refresh form after clearing overrides

**Styling:**
- [ ] Add CSS for customer name display (purple gradient)
- [ ] Add CSS for device label display (monospace, gray)
- [ ] Add CSS for power limits table
- [ ] Add CSS for status badges (color-coded)
- [ ] Add CSS for source indicators
- [ ] Add CSS for legend
- [ ] Add CSS for action buttons (hover effects)
- [ ] Add CSS for scrollable modal body (max-height 70vh)

**Integration:**
- [ ] Modify constructor to accept deviceId, deviceType, customerId, customerName, deviceName
- [ ] Modify getModalHTML to include deviceName in header
- [ ] Modify render to call populatePowerLimits
- [ ] Modify attachEventListeners to wire up new buttons
- [ ] Modify getFormData to include power limit fields

### Phase 1.6: MYIO-SIM Widgets Integration

**EQUIPMENTS Widget:**
- [ ] Ensure `getShoppingNameForDevice()` exists (already implemented)
- [ ] Add customerName to device object in renderList
- [ ] Update `handleActionSettings()` to pass customerName
- [ ] Pass deviceLabel with fallback "NÃO INFORMADO"

**STORES Widget:**
- [ ] Ensure `getShoppingNameForDevice()` exists (already implemented)
- [ ] Add customerName to entityObject in renderList
- [ ] Update `handleActionSettings()` to pass customerName
- [ ] Pass deviceLabel with fallback "NÃO INFORMADO"

**ENERGY Widget:**
- [ ] Add `extractCustomerName()` helper function
- [ ] Add customerName to device objects
- [ ] Update `handleActionSettings()` to pass customerName

**MENU Widget:**
- [ ] Add `extractCustomerName()` helper function
- [ ] Update `handleActionSettings()` to pass customerName

**TELEMETRY Widget (v-5.2.0):**
- [ ] Verify customerName is already being passed
- [ ] Verify deviceLabel is passed with correct fallback

### Phase 2: Testing

- [ ] Unit tests for `calculateDeviceStatusWithRanges()`
- [ ] Unit tests for `extractConsumptionRanges()`
- [ ] Integration tests with mock ThingsBoard API
- [ ] Test with customer attributes present
- [ ] Test with customer attributes missing (fallback)
- [ ] Test with invalid/incomplete attributes
- [ ] Test cache expiration behavior
- [ ] Test with all supported device types

### Phase 3: Documentation

- [ ] Document attribute naming convention
- [ ] Create migration guide for administrators
- [ ] Update EQUIPMENTS widget documentation
- [ ] Add JSDoc comments to all new functions
- [ ] Create ThingsBoard attribute setup guide

### Phase 4: Deployment

- [ ] Deploy to staging environment
- [ ] Test with real customer data
- [ ] Create default attributes for test customer
- [ ] Verify fallback behavior works
- [ ] Monitor console logs for errors
- [ ] Gradual rollout to production customers

## Testing Strategy

### Unit Tests

```javascript
describe('RFC-0077: Dynamic Consumption Limits', () => {
  describe('extractConsumptionRanges', () => {
    it('should extract ranges for ELEVADOR device type', () => {
      const customerLimits = {
        'standbyLimitDownConsumptionElevator': 0,
        'standbyLimitUpConsumptionElevator': 150,
        'alertLimitDownConsumptionElevator': 150,
        'alertLimitUpConsumptionElevator': 800,
        'normalLimitDownConsumptionElevator': 800,
        'normalLimitUpConsumptionElevator': 1200,
        'failureLimitDownConsumptionElevator': 1200,
        'failureLimitUpConsumptionElevator': 99999
      };

      const ranges = extractConsumptionRanges(customerLimits, 'ELEVADOR');

      expect(ranges.standbyRange).toEqual({ down: 0, up: 150 });
      expect(ranges.normalRange).toEqual({ down: 800, up: 1200 });
      expect(ranges.alertRange).toEqual({ down: 150, up: 800 });
      expect(ranges.failureRange).toEqual({ down: 1200, up: 99999 });
    });

    it('should return null for unsupported device type', () => {
      const customerLimits = { /* ... */ };
      const ranges = extractConsumptionRanges(customerLimits, 'UNKNOWN_TYPE');
      expect(ranges).toBeNull();
    });

    it('should return null for incomplete attributes', () => {
      const customerLimits = {
        'standbyLimitDownConsumptionElevator': 0,
        // Missing other attributes
      };
      const ranges = extractConsumptionRanges(customerLimits, 'ELEVADOR');
      expect(ranges).toBeNull();
    });
  });

  describe('calculateDeviceStatusWithRanges', () => {
    const ranges = {
      standbyRange: { down: 0, up: 150 },
      normalRange: { down: 150, up: 1200 },
      alertRange: { down: 1200, up: 1500 },
      failureRange: { down: 1500, up: 99999 }
    };

    it('should return standby for low consumption', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 80,
        ranges
      });
      expect(status).toBe(DeviceStatusType.STANDBY);
    });

    it('should return power_on for normal consumption', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 900,
        ranges
      });
      expect(status).toBe(DeviceStatusType.POWER_ON);
    });

    it('should return warning for alert range consumption', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 1300,
        ranges
      });
      expect(status).toBe(DeviceStatusType.WARNING);
    });

    it('should return failure for high consumption', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 2000,
        ranges
      });
      expect(status).toBe(DeviceStatusType.FAILURE);
    });

    it('should return no_info for offline device', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'offline',
        lastConsumptionValue: null,
        ranges
      });
      expect(status).toBe(DeviceStatusType.NO_INFO);
    });

    it('should return maintenance for invalid ranges', () => {
      const status = calculateDeviceStatusWithRanges({
        connectionStatus: 'online',
        lastConsumptionValue: 900,
        ranges: null
      });
      expect(status).toBe(DeviceStatusType.MAINTENANCE);
    });
  });

  describe('getConsumptionRanges', () => {
    it('should return customer limits when available', () => {
      const customerLimits = { /* valid attributes */ };
      const ranges = getConsumptionRanges(customerLimits, 'ELEVADOR');
      expect(ranges).toBeDefined();
      expect(ranges.standbyRange).toBeDefined();
    });

    it('should fallback to defaults when customer limits null', () => {
      const ranges = getConsumptionRanges(null, 'ELEVADOR');
      expect(ranges).toEqual(DEFAULT_CONSUMPTION_RANGES['ELEVADOR']);
    });

    it('should use DEFAULT when device type not in mapping', () => {
      const ranges = getConsumptionRanges(null, 'UNKNOWN');
      expect(ranges).toEqual(DEFAULT_CONSUMPTION_RANGES['DEFAULT']);
    });
  });
});
```

### Integration Tests

```javascript
describe('EQUIPMENTS Widget with Dynamic Limits', () => {
  it('should fetch customer attributes on init', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { key: 'standbyLimitDownConsumptionElevator', value: 0 },
        { key: 'standbyLimitUpConsumptionElevator', value: 150 },
        // ... more attributes
      ]
    });

    global.fetch = mockFetch;

    await renderList();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/plugins/telemetry/CUSTOMER/'),
      expect.any(Object)
    );
  });

  it('should use cached limits on subsequent renders', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    global.fetch = mockFetch;

    // First render
    await renderList();
    const firstCallCount = mockFetch.mock.calls.length;

    // Second render (within cache TTL)
    await renderList();
    const secondCallCount = mockFetch.mock.calls.length;

    expect(secondCallCount).toBe(firstCallCount); // No additional fetch
  });

  it('should fallback to defaults when API fails', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('API Error'));
    global.fetch = mockFetch;

    await renderList();

    // Should still render devices with default limits
    expect(document.querySelectorAll('.equipment-card')).not.toHaveLength(0);
  });
});
```

### Manual Test Cases

1. **Happy Path - Custom Attributes**
   - [ ] Configure custom attributes in ThingsBoard for test customer
   - [ ] Load EQUIPMENTS widget
   - [ ] Verify console log shows "Successfully loaded customer consumption limits"
   - [ ] Verify device status icons reflect custom limits

2. **Fallback - No Attributes**
   - [ ] Remove attributes from customer in ThingsBoard
   - [ ] Load EQUIPMENTS widget
   - [ ] Verify console log shows "Using default consumption limits"
   - [ ] Verify device status icons use hardcoded defaults

3. **Cache Behavior**
   - [ ] Load widget (attributes fetched)
   - [ ] Change attributes in ThingsBoard
   - [ ] Reload widget within 5 minutes
   - [ ] Verify old limits still used (cached)
   - [ ] Wait 5 minutes
   - [ ] Reload widget
   - [ ] Verify new limits fetched

4. **Device Type Coverage**
   - [ ] Test ELEVADOR devices
   - [ ] Test ESCADA_ROLANTE devices
   - [ ] Test MOTOR/BOMBA devices
   - [ ] Test CHILLER devices
   - [ ] Test AC/HVAC devices
   - [ ] Test 3F_MEDIDOR devices with deviceProfile

5. **Edge Cases**
   - [ ] Consumption exactly on range boundary
   - [ ] Consumption = 0
   - [ ] Consumption = null
   - [ ] Very high consumption (> 99999W)
   - [ ] Incomplete attribute set
   - [ ] Invalid attribute values (non-numeric)

## Success Metrics

- Zero hardcoded switch statements in production code for consumption limits
- 100% of customers can configure custom limits without code deployment
- < 100ms overhead for attribute fetching (cached)
- Zero regressions in device status calculation accuracy
- Fallback mechanism works in 100% of API failure scenarios
- Console logs provide clear debugging information
- Configuration changes reflect within cache TTL (5 minutes)

## References

- **EQUIPMENTS Widget**: `src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js` (lines 1224-1261)
- **calculateDeviceStatus**: `src/utils/deviceStatus.js` (lines 279-339)
- **RFC-0071**: Device Profile Attribute Sync
- **ThingsBoard Attributes API**: https://thingsboard.io/docs/user-guide/attributes/
- **ThingsBoard REST API**: https://thingsboard.io/docs/api/

## Related RFCs

- **RFC-0071**: Device Profile Attribute Sync - Similar pattern of fetching device attributes
- **RFC-0072**: EQUIPMENTS UI Improvements - UI/UX improvements for same widget
- **RFC-0042**: Main View Orchestrator - Caching patterns for data fetching

## Appendix: Attribute Key Reference

### Complete Attribute List (per customer)

```
# Elevator Limits
standbyLimitDownConsumptionElevator: 0
standbyLimitUpConsumptionElevator: 150
alertLimitDownConsumptionElevator: 150
alertLimitUpConsumptionElevator: 800
normalLimitDownConsumptionElevator: 800
normalLimitUpConsumptionElevator: 1200
failureLimitDownConsumptionElevator: 1200
failureLimitUpConsumptionElevator: 99999

# Escalator Limits
standbyLimitDownConsumptionEscalator: 0
standbyLimitUpConsumptionEscalator: 200
alertLimitDownConsumptionEscalator: 200
alertLimitUpConsumptionEscalator: 1000
normalLimitDownConsumptionEscalator: 1000
normalLimitUpConsumptionEscalator: 1500
failureLimitDownConsumptionEscalator: 1500
failureLimitUpConsumptionEscalator: 99999

# Motor/Pump Limits
standbyLimitDownConsumptionMotor: 0
standbyLimitUpConsumptionMotor: 200
alertLimitDownConsumptionMotor: 200
alertLimitUpConsumptionMotor: 1000
normalLimitDownConsumptionMotor: 1000
normalLimitUpConsumptionMotor: 1500
failureLimitDownConsumptionMotor: 1500
failureLimitUpConsumptionMotor: 99999

# Chiller Limits
standbyLimitDownConsumptionChiller: 0
standbyLimitUpConsumptionChiller: 1000
alertLimitDownConsumptionChiller: 1000
alertLimitUpConsumptionChiller: 6000
normalLimitDownConsumptionChiller: 6000
normalLimitUpConsumptionChiller: 8000
failureLimitDownConsumptionChiller: 8000
failureLimitUpConsumptionChiller: 99999

# HVAC (AC/Fancoil) Limits
standbyLimitDownConsumptionHVAC: 0
standbyLimitUpConsumptionHVAC: 500
alertLimitDownConsumptionHVAC: 500
alertLimitUpConsumptionHVAC: 3000
normalLimitDownConsumptionHVAC: 3000
normalLimitUpConsumptionHVAC: 5000
failureLimitDownConsumptionHVAC: 5000
failureLimitUpConsumptionHVAC: 99999
```

### Attribute Setup via ThingsBoard UI

1. Navigate to **Customers** in ThingsBoard
2. Select customer entity
3. Go to **Attributes** tab
4. Select **Server attributes** scope
5. Click **Add attribute**
6. Enter attribute key (e.g., `standbyLimitDownConsumptionElevator`)
7. Enter value (e.g., `0`)
8. Click **Add**
9. Repeat for all attributes

### Bulk Import via REST API

```bash
#!/bin/bash
# Script to populate default attributes for a customer

CUSTOMER_ID="your-customer-id-here"
JWT_TOKEN="your-jwt-token-here"

curl -X POST "https://dashboard.myio-bas.com/api/plugins/telemetry/CUSTOMER/${CUSTOMER_ID}/attributes/SERVER_SCOPE" \
  -H "Content-Type: application/json" \
  -H "X-Authorization: Bearer ${JWT_TOKEN}" \
  -d '{
    "standbyLimitDownConsumptionElevator": 0,
    "standbyLimitUpConsumptionElevator": 150,
    "alertLimitDownConsumptionElevator": 150,
    "alertLimitUpConsumptionElevator": 800,
    "normalLimitDownConsumptionElevator": 800,
    "normalLimitUpConsumptionElevator": 1200,
    "failureLimitDownConsumptionElevator": 1200,
    "failureLimitUpConsumptionElevator": 99999
  }'
```

---

**End of RFC-0077**
