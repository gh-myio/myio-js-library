# RFC-0080: Fix Settings Modal JSON Persistence

- **Feature Name**: `fix-settings-modal-json-persistence`
- **Start Date**: 2025-01-25
- **RFC PR**: #0080
- **Status**: Draft
- **Component**: `src/components/premium-modals/settings/SettingsModalView.ts`, `src/components/premium-modals/settings/SettingsPersister.ts`
- **Dependencies**: RFC-0078 (Unified JSON Power Limits Configuration)

## Summary

Fix two critical bugs in the Settings Modal related to RFC-0078 JSON configuration:

1. **Bug 1 - GLOBAL parameters not loading**: The Settings Modal fails to fetch `mapInstantaneousPower` from CUSTOMER SERVER_SCOPE attributes, resulting in empty/default values
2. **Bug 2 - Saving creates individual attributes**: Instead of saving `mapInstantaneousPower` as a single JSON attribute, the persister creates multiple individual attributes like `myio.settings.energy.alertLimitDownConsumption`

## Problem Description

### Bug 1: GLOBAL Parameters Not Loading

**Expected Behavior:**
```
1. Open Settings Modal for device
2. Fetch mapInstantaneousPower from CUSTOMER (SERVER_SCOPE) -> GLOBAL defaults
3. Fetch mapInstantaneousPower from DEVICE (SERVER_SCOPE) -> Device overrides
4. Merge: Device overrides take priority over GLOBAL
5. Display in form with source badges (GLOBAL/DEVICE)
```

**Actual Behavior:**
```
1. Open Settings Modal for device
2. mapInstantaneousPower is not fetched from CUSTOMER
3. Form shows empty/default values
4. Source badges show no GLOBAL configuration
```

**Root Cause:**
The `SettingsModalView.ts` does not call the CUSTOMER attributes fetch endpoint when opening the modal. The `mapInstantaneousPower` passed via `config` may be empty or not properly loaded from CUSTOMER.

### Bug 2: Saving Creates Individual Attributes

**Expected Behavior (RFC-0078):**
```json
// Single attribute saved on DEVICE SERVER_SCOPE
{
  "mapInstantaneousPower": {
    "version": "1.0.0",
    "limitsByInstantaneoustPowerType": [
      {
        "telemetryType": "consumption",
        "itemsByDeviceType": [
          {
            "deviceType": "ELEVADOR",
            "name": "mapInstantaneousPowerElevator",
            "description": "Custom limits for this specific elevator",
            "limitsByDeviceStatus": [...]
          }
        ]
      }
    ]
  }
}
```

**Actual Behavior:**
```
// Multiple individual attributes saved on DEVICE SERVER_SCOPE
myio.settings.energy.__version = 1
myio.settings.energy.alertLimitDownConsumption = 800
myio.settings.energy.alertLimitUpConsumption = 1200
myio.settings.energy.failureLimitDownConsumption = 1200
myio.settings.energy.failureLimitUpConsumption = 99999
myio.settings.energy.identifier = "..."
myio.settings.energy.normalLimitDownConsumption = 150
myio.settings.energy.normalLimitUpConsumption = 800
myio.settings.energy.standbyLimitDownConsumption = 0
myio.settings.energy.standbyLimitUpConsumption = 150
myio.settings.energy.telemetryType = "consumption"
```

**Root Cause:**
The `SettingsPersister.addNamespaceAndVersion()` function iterates over form data and creates namespaced individual attributes instead of building and saving a JSON structure.

## Solution

### Fix 1: Fetch GLOBAL from CUSTOMER

Update `SettingsModalView.ts` to:

1. Accept `customerId` in the config
2. On modal open, fetch `mapInstantaneousPower` from CUSTOMER SERVER_SCOPE
3. Merge with any existing device-level configuration
4. Display source badges correctly

```typescript
// In SettingsModalView.ts
private async fetchGlobalPowerLimits(): Promise<InstantaneousPowerLimits | null> {
  const customerId = this.config.customerId;
  if (!customerId || !this.config.jwtToken) {
    console.warn('[SettingsModal] Cannot fetch GLOBAL - missing customerId or token');
    return null;
  }

  try {
    const url = `/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=mapInstantaneousPower`;
    const response = await fetch(url, {
      headers: {
        'X-Authorization': `Bearer ${this.config.jwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const attrs = await response.json();
    const powerLimitsAttr = attrs.find((a: any) => a.key === 'mapInstantaneousPower');

    if (!powerLimitsAttr) {
      console.log('[SettingsModal] No GLOBAL mapInstantaneousPower found');
      return null;
    }

    const value = typeof powerLimitsAttr.value === 'string'
      ? JSON.parse(powerLimitsAttr.value)
      : powerLimitsAttr.value;

    console.log('[SettingsModal] Loaded GLOBAL mapInstantaneousPower:', value);
    return value;
  } catch (error) {
    console.error('[SettingsModal] Failed to fetch GLOBAL power limits:', error);
    return null;
  }
}
```

### Fix 2: Save as JSON Structure

Update `SettingsPersister.ts` to build and save `mapInstantaneousPower` as a single JSON attribute:

```typescript
// In SettingsPersister.ts
private buildMapInstantaneousPower(
  formData: Record<string, any>,
  existingMap: InstantaneousPowerLimits | null,
  deviceType: string
): InstantaneousPowerLimits {
  // Start with existing or create new structure
  const result: InstantaneousPowerLimits = existingMap ? { ...existingMap } : {
    version: '1.0.0',
    limitsByInstantaneoustPowerType: []
  };

  // Find or create telemetry type entry
  const telemetryType = formData.telemetryType || 'consumption';
  let telemetryConfig = result.limitsByInstantaneoustPowerType.find(
    t => t.telemetryType === telemetryType
  );

  if (!telemetryConfig) {
    telemetryConfig = {
      telemetryType,
      itemsByDeviceType: []
    };
    result.limitsByInstantaneoustPowerType.push(telemetryConfig);
  }

  // Find or create device type entry
  let deviceConfig = telemetryConfig.itemsByDeviceType.find(
    d => d.deviceType === deviceType
  );

  if (!deviceConfig) {
    deviceConfig = {
      deviceType,
      name: `mapInstantaneousPower${deviceType}`,
      description: `Custom limits for ${deviceType}`,
      limitsByDeviceStatus: []
    };
    telemetryConfig.itemsByDeviceType.push(deviceConfig);
  }

  // Update limits from form data
  deviceConfig.limitsByDeviceStatus = [
    {
      deviceStatusName: 'standBy',
      limitsValues: {
        baseValue: Number(formData.standbyLimitDownConsumption) || 0,
        topValue: Number(formData.standbyLimitUpConsumption) || 0
      }
    },
    {
      deviceStatusName: 'normal',
      limitsValues: {
        baseValue: Number(formData.normalLimitDownConsumption) || 0,
        topValue: Number(formData.normalLimitUpConsumption) || 0
      }
    },
    {
      deviceStatusName: 'alert',
      limitsValues: {
        baseValue: Number(formData.alertLimitDownConsumption) || 0,
        topValue: Number(formData.alertLimitUpConsumption) || 0
      }
    },
    {
      deviceStatusName: 'failure',
      limitsValues: {
        baseValue: Number(formData.failureLimitDownConsumption) || 0,
        topValue: Number(formData.failureLimitUpConsumption) || 0
      }
    }
  ];

  return result;
}

async saveServerScopeAttributes(
  deviceId: string,
  attributes: Record<string, unknown>,
  deviceType: string,
  existingMap: InstantaneousPowerLimits | null
): Promise<{ ok: boolean; updatedKeys?: string[]; error?: SettingsError }> {
  try {
    // Build JSON structure for power limits
    const mapInstantaneousPower = this.buildMapInstantaneousPower(
      attributes,
      existingMap,
      deviceType
    );

    // Save as single JSON attribute
    const payload = {
      mapInstantaneousPower: mapInstantaneousPower
    };

    const res = await fetch(
      `${this.tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`,
      {
        method: 'POST',
        headers: {
          'X-Authorization': `Bearer ${this.jwtToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      throw this.createHttpError(res.status, await res.text().catch(() => ''));
    }

    return {
      ok: true,
      updatedKeys: ['mapInstantaneousPower']
    };

  } catch (error) {
    console.error('[SettingsPersister] Attributes save failed:', error);
    return { ok: false, error: this.mapError(error) };
  }
}
```

## Data Flow After Fix

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SETTINGS MODAL OPEN                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Fetch GLOBAL from CUSTOMER                                       │
│     GET /api/plugins/telemetry/CUSTOMER/{id}/values/attributes/      │
│         SERVER_SCOPE?keys=mapInstantaneousPower                      │
│                                                                      │
│  2. Fetch DEVICE overrides                                          │
│     GET /api/plugins/telemetry/DEVICE/{id}/values/attributes/        │
│         SERVER_SCOPE?keys=mapInstantaneousPower                      │
│                                                                      │
│  3. Merge with priority: DEVICE > GLOBAL > DEFAULTS                  │
│                                                                      │
│  4. Populate form with merged values                                 │
│     - Show source badges (GLOBAL/DEVICE/DEFAULT)                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     SETTINGS MODAL SAVE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Collect form data                                               │
│                                                                      │
│  2. Build mapInstantaneousPower JSON structure                      │
│     {                                                                │
│       "version": "1.0.0",                                           │
│       "limitsByInstantaneoustPowerType": [                          │
│         {                                                            │
│           "telemetryType": "consumption",                           │
│           "itemsByDeviceType": [                                    │
│             {                                                        │
│               "deviceType": "ELEVADOR",                             │
│               "limitsByDeviceStatus": [...]                         │
│             }                                                        │
│           ]                                                          │
│         }                                                            │
│       ]                                                              │
│     }                                                                │
│                                                                      │
│  3. Save to DEVICE SERVER_SCOPE                                     │
│     POST /api/plugins/telemetry/DEVICE/{id}/attributes/SERVER_SCOPE │
│     Body: { "mapInstantaneousPower": {...} }                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Migration

### Cleaning Up Legacy Attributes

For devices that already have the incorrectly saved individual attributes, a cleanup script should be run:

```javascript
// Migration script to clean up legacy individual attributes
async function cleanupLegacyAttributes(deviceId, jwtToken) {
  const legacyKeys = [
    'myio.settings.energy.__version',
    'myio.settings.energy.alertLimitDownConsumption',
    'myio.settings.energy.alertLimitUpConsumption',
    'myio.settings.energy.failureLimitDownConsumption',
    'myio.settings.energy.failureLimitUpConsumption',
    'myio.settings.energy.identifier',
    'myio.settings.energy.normalLimitDownConsumption',
    'myio.settings.energy.normalLimitUpConsumption',
    'myio.settings.energy.standbyLimitDownConsumption',
    'myio.settings.energy.standbyLimitUpConsumption',
    'myio.settings.energy.telemetryType'
  ];

  // Delete individual attributes
  await fetch(`/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`, {
    method: 'DELETE',
    headers: {
      'X-Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ keys: legacyKeys })
  });
}
```

## Implementation Checklist

- [x] Update `SettingsModalView.ts` to accept `customerId` in config (via types.ts ModalConfig)
- [x] Add `fetchGlobalPowerLimits()` method to fetch from CUSTOMER (SettingsController.fetchGlobalMapInstantaneousPower)
- [x] Update modal initialization to fetch GLOBAL before rendering (SettingsController.show)
- [x] Update `SettingsPersister.ts` to build JSON structure instead of individual attributes
- [x] Add `buildMapInstantaneousPower()` method (SettingsPersister.ts)
- [x] Update `saveServerScopeAttributes()` to save single JSON attribute
- [x] Pass `deviceType` and `existingMap` to persister (via constructor apiConfig)
- [x] Add `updateMapInstantaneousPower()` method to SettingsModalView.ts
- [ ] Update source badges to show correct GLOBAL/DEVICE origin
- [ ] Create migration script to cleanup legacy attributes
- [ ] Test with real device and customer data

## Testing

1. Open Settings Modal for device with GLOBAL configuration
   - Verify GLOBAL values load correctly
   - Verify source badges show "GLOBAL"

2. Save device-specific overrides
   - Verify `mapInstantaneousPower` is saved as single JSON attribute
   - Verify no individual `myio.settings.energy.*` attributes are created

3. Re-open Settings Modal
   - Verify device overrides take priority over GLOBAL
   - Verify source badges show "DEVICE" for overridden values

4. Clear device overrides
   - Verify GLOBAL values are restored
   - Verify source badges revert to "GLOBAL"
