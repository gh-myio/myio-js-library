# RFC-0140: Water Widget Consumption Fix

## Status
Implemented

## Problem

Water widgets (WATER_COMMON_AREA and WATER_STORES) were showing cards without consumption data, even though the data was available and correctly sent to FOOTER when clicking on cards.

### Root Causes

1. **clearValueIfOffline for Water Domain**: WATER_COMMON_AREA was using `clearValueIfOffline()` to clear consumption values when devices were calculated as offline based on stale telemetry. However, for water domain, the API provides accumulated totals that are valid regardless of current connection status.

2. **Status Calculation for Stores**: WATER_STORES was calculating device status using `calculateDeviceStatusMasterRules()`, but stores represent allocation (not physical meters), so status calculation doesn't make sense. All stores should show as "online".

3. **Missing Consumption Properties**: Water widgets were setting `val` and `value` properties but the card component might expect `consumption` or `consumptionValue` properties.

### Key Differences from EQUIPMENTS

EQUIPMENTS widget (which was working correctly):
- Does NOT use `clearValueIfOffline()` - consumption values are never cleared
- For store-type devices, all are shown as online
- Has `val`, `value`, AND `consumption` properties in entity object

Water widgets (before fix):
- Used `clearValueIfOffline()` which cleared values for "offline" devices
- Calculated status for all devices including stores
- Only had `val` and `value` properties

## Solution

### Fix 1: WATER_STORES - All Devices Online

For WATER_STORES, stores represent allocation from water meters to store tenants. They are not physical devices, so status calculation is meaningless.

```javascript
// BEFORE (bug)
let deviceStatus = calculateDeviceStatusMasterRules({
  connectionStatus: mappedStatus,
  telemetryTimestamp: telemetryTimestamp,
  delayMins: 1440,
  domain: 'water',
});
const finalValue = clearValueIfOffline(valNum, deviceStatus);

// AFTER (fix) - RFC-0140
const deviceStatus = 'online';  // Stores are always online
const finalValue = valNum;      // Don't clear value
```

All status-related functions were updated to return 'online' for stores:
- `getStoreStatus()` - always returns 'online'
- `updateWaterStoresStats()` - counts all as online
- `filterAndRender()` - sets deviceStatus to 'online' for all items
- `openFilterModal()` - sets deviceStatus to 'online' for all items

### Fix 2: WATER_COMMON_AREA - Don't Clear Consumption

For WATER_COMMON_AREA, the API provides accumulated consumption totals that are valid for the selected period, regardless of whether the device is currently online or offline.

```javascript
// BEFORE (bug) - RFC-0110 rule was too aggressive for water
const finalValue = clearValueIfOffline(valNum, deviceStatus);

// AFTER (fix) - RFC-0140
// Do NOT clear consumption for water domain
// API provides accumulated totals that are valid regardless of current connection status
const finalValue = valNum;
```

The device status is still calculated and displayed for informational purposes, but it doesn't affect the consumption value.

### Fix 3: Add Explicit Consumption Properties

Both water widgets now set multiple consumption-related properties on the entity object for card component compatibility:

```javascript
const entityObject = {
  val: finalValue,
  value: finalValue,
  lastValue: finalValue,
  consumption: finalValue,       // RFC-0140: Explicit consumption property
  consumptionValue: finalValue,  // RFC-0140: Alternative consumption property
  // ...
};
```

### Fix 4: Debug Logging for Consumption Values

Added logging when building items from MAIN's data to help trace consumption values:

```javascript
const consumptionValue = item.value || item.consumption || item.pulses || 0;
LogHelper.log(`[WATER_COMMON_AREA] Building item: ${item.label}, value=${item.value}, consumption=${item.consumption}, pulses=${item.pulses}, final=${consumptionValue}`);
```

## Files Changed

- `src/MYIO-SIM/v5.2.0/WATER_STORES/controller.js`:
  - `renderList()`: Set deviceStatus='online', don't use clearValueIfOffline
  - `updateWaterStoresStats()`: All devices counted as online
  - `getStoreStatus()`: Always returns 'online'
  - `filterAndRender()`: Set deviceStatus='online' for all items
  - `openFilterModal()`: Set deviceStatus='online' for all items
  - Entity object: Added `consumption` and `consumptionValue` properties

- `src/MYIO-SIM/v5.2.0/WATER_COMMON_AREA/controller.js`:
  - `renderList()`: Don't use clearValueIfOffline for consumption
  - `updateWaterCommonAreaStats()`: Don't use clearValueIfOffline for consumption
  - `waterTbDataHandler()`: Added debug logging for consumption values
  - Entity object: Added `consumption` and `consumptionValue` properties

## Testing

1. Open dashboard with water domain (WATER_COMMON_AREA or WATER_STORES)
2. Select a date range and click "Carregar"
3. **Expected**: Cards should show consumption values (m³)
4. **Before**: Cards showed 0 or no consumption, but clicking sent correct data to FOOTER
5. **After**: Cards show correct consumption from API

### Verify Status Display

For WATER_STORES:
- All devices should show as "online" (green indicator)
- Connectivity stats should show 100%

For WATER_COMMON_AREA:
- Device status is still calculated and displayed
- But consumption values are NOT cleared for offline devices

## Related RFCs

- RFC-0109: Water device classification
- RFC-0110: Device status master rules (clearValueIfOffline)
- RFC-0131: Water API enrichment
- RFC-0094: Water widget standardization
