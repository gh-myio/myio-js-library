# RFC-0071: Device Profile Attribute Synchronization to ThingsBoard

- **Feature Name**: `device_profile_attribute_sync`
- **Start Date**: 2025-01-06
- **RFC PR**: N/A
- **Status**: Draft
- **Authors**: MYIO Team

## Summary

This RFC proposes a mechanism to automatically synchronize device profile names from ThingsBoard device profiles to individual device entities as server-scope attributes. This enables efficient device type classification without requiring multiple API calls per device during runtime.

## Motivation

### Current Problem

The MYIO-SIM system currently needs to classify devices by their device profile type (e.g., `3F_MEDIDOR`, `MOTOR`, `CHILLER`) for various purposes:

1. **Equipment categorization** in the EQUIPMENTS widget
2. **Energy distribution** by equipment type in the ENERGY widget
3. **Device type filtering** and statistics

Currently, the device profile information requires either:
- Individual API calls to `/api/device/{entityId}` for each device
- Manual mapping based on device names or labels (error-prone)
- Hardcoded logic that doesn't scale

### Proposed Solution

Implement a one-time synchronization process that:
1. Fetches all device profiles from ThingsBoard
2. For each device in the system, retrieves its `deviceProfileId`
3. Resolves the profile name and saves it as a `deviceProfile` server-scope attribute on the device entity

This allows widgets to access device profile information directly from `ctx.data` without additional API calls.

### Benefits

- **Performance**: Eliminates redundant API calls during widget initialization
- **Consistency**: Single source of truth for device profile information
- **Scalability**: Works efficiently with hundreds of devices
- **Maintainability**: Reduces hardcoded device type logic

## Guide-level Explanation

### How It Works

When the EQUIPMENTS widget initializes, it will:

1. **Fetch device profiles** (one-time per session):
   ```javascript
   GET /api/deviceProfile/names?activeOnly=true
   ```

   Response example:
   ```json
   [
     {
       "id": {
         "entityType": "DEVICE_PROFILE",
         "id": "6c488690-fdbe-11ee-8b82-b386dea39cb5"
       },
       "name": "3F"
     },
     {
       "id": {
         "entityType": "DEVICE_PROFILE",
         "id": "6b31e2a0-8c02-11f0-a06d-e9509531b1d5"
       },
       "name": "3F_MEDIDOR"
     }
   ]
   ```

2. **For each device**, check if `deviceProfile` attribute exists:
   - If **exists**: Skip (already synchronized)
   - If **missing**: Fetch device details and sync

3. **Sync process** for missing attributes:
   ```javascript
   // Get device details
   GET /api/device/{entityId}

   // Extract deviceProfileId from response
   // Look up profile name from cached profiles
   // Save as attribute
   POST /api/plugins/telemetry/DEVICE/{entityId}/attributes/SERVER_SCOPE
   Body: { "deviceProfile": "MOTOR" }
   ```

### Usage Example

After synchronization, device profile is available in `ctx.data`:

```javascript
self.ctx.data.forEach((data) => {
  const deviceProfile = data.datasource?.deviceProfile; // "MOTOR", "3F_MEDIDOR", etc.

  if (deviceProfile === "3F_MEDIDOR") {
    // Handle meter devices
  } else if (deviceProfile === "MOTOR") {
    // Handle motor devices
  }
});
```

## Reference-level Explanation

### Implementation Location

File: `src/MYIO-SIM/V1.0.0/EQUIPEMTNS/controller.js`

### Data Structures

#### Device Profile Map
```typescript
type DeviceProfileId = string;
type DeviceProfileName = string;

interface DeviceProfileMap {
  [key: DeviceProfileId]: DeviceProfileName;
}
```

#### Device Profile Entry
```typescript
interface DeviceProfile {
  id: {
    entityType: "DEVICE_PROFILE";
    id: string;
  };
  name: string;
}
```

#### Device Entity
```typescript
interface Device {
  id: {
    entityType: "DEVICE";
    id: string;
  };
  name: string;
  type: string;
  label: string;
  deviceProfileId: {
    entityType: "DEVICE_PROFILE";
    id: string;
  };
  // ... other fields
}
```

### API Endpoints

#### 1. Fetch Device Profiles
```
GET /api/deviceProfile/names?activeOnly=true
Authorization: Bearer {jwt_token}
```

**Response**: `Array<DeviceProfile>`

#### 2. Fetch Device Details
```
GET /api/device/{deviceId}
Authorization: Bearer {jwt_token}
```

**Response**: `Device`

#### 3. Save Device Attribute
```
POST /api/plugins/telemetry/DEVICE/{deviceId}/attributes/SERVER_SCOPE
Authorization: Bearer {jwt_token}
Content-Type: application/json

Body: {
  "deviceProfile": "MOTOR"
}
```

**Response**: `200 OK` (may be empty body)

### Core Functions

#### fetchDeviceProfiles()
```javascript
/**
 * Fetches all active device profiles from ThingsBoard
 * @returns {Promise<Map<string, string>>} Map of profileId -> profileName
 */
async function fetchDeviceProfiles() {
  const token = localStorage.getItem("jwt_token");
  if (!token) throw new Error("JWT token not found");

  const url = "/api/deviceProfile/names?activeOnly=true";
  const response = await fetch(url, {
    headers: {
      "X-Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch device profiles: ${response.status}`);
  }

  const profiles = await response.json();

  // Build Map: profileId -> profileName
  const profileMap = new Map();
  profiles.forEach(profile => {
    const profileId = profile.id.id;
    const profileName = profile.name;
    profileMap.set(profileId, profileName);
  });

  console.log(`[EQUIPMENTS] Loaded ${profileMap.size} device profiles`);
  return profileMap;
}
```

#### fetchDeviceDetails()
```javascript
/**
 * Fetches device details including deviceProfileId
 * @param {string} deviceId - Device entity ID
 * @returns {Promise<Device>}
 */
async function fetchDeviceDetails(deviceId) {
  const token = localStorage.getItem("jwt_token");
  if (!token) throw new Error("JWT token not found");

  const url = `/api/device/${deviceId}`;
  const response = await fetch(url, {
    headers: {
      "X-Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch device ${deviceId}: ${response.status}`);
  }

  return await response.json();
}
```

#### addDeviceProfileAttribute()
```javascript
/**
 * Saves deviceProfile as a server-scope attribute on the device
 * @param {string} deviceId - Device entity ID
 * @param {string} deviceProfile - Profile name (e.g., "MOTOR", "3F_MEDIDOR")
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function addDeviceProfileAttribute(deviceId, deviceProfile) {
  const t = Date.now();

  try {
    if (!deviceId) throw new Error("deviceId is required");
    if (deviceProfile == null || deviceProfile === "") {
      throw new Error("deviceProfile is required");
    }

    const token = localStorage.getItem("jwt_token");
    if (!token) throw new Error("jwt_token not found in localStorage");

    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
    const headers = {
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${token}`,
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ deviceProfile }),
    });

    const bodyText = await res.text().catch(() => "");

    if (!res.ok) {
      throw new Error(
        `[addDeviceProfileAttribute] HTTP ${res.status} ${res.statusText} - ${bodyText}`
      );
    }

    let data = null;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      // Response may not be JSON
    }

    const dt = Date.now() - t;
    console.log(
      `[EQUIPMENTS] ✅ POST deviceProfile ok | device=${deviceId} | "${deviceProfile}" | ${dt}ms`
    );

    return { ok: true, status: res.status, data };
  } catch (err) {
    const dt = Date.now() - t;
    console.error(
      `[EQUIPMENTS] ❌ POST deviceProfile failed | device=${deviceId} | "${deviceProfile}" | ${dt}ms | error: ${err?.message || err}`
    );
    throw err;
  }
}
```

#### syncDeviceProfileAttributes()
```javascript
/**
 * Main synchronization function
 * Checks all devices and syncs missing deviceProfile attributes
 * @returns {Promise<{synced: number, skipped: number, errors: number}>}
 */
async function syncDeviceProfileAttributes() {
  console.log("[EQUIPMENTS] Starting device profile synchronization...");

  try {
    // Step 1: Fetch all device profiles
    const profileMap = await fetchDeviceProfiles();

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Step 2: Process each device in ctx.data
    const deviceMap = new Map();

    self.ctx.data.forEach((data) => {
      const entityId = data.datasource?.entity?.id?.id;
      const existingProfile = data.datasource?.deviceProfile;

      if (!entityId) return;

      // Skip if already has deviceProfile attribute
      if (existingProfile) {
        skipped++;
        return;
      }

      // Store for processing (deduplicate by entityId)
      if (!deviceMap.has(entityId)) {
        deviceMap.set(entityId, data.datasource);
      }
    });

    console.log(`[EQUIPMENTS] Found ${deviceMap.size} devices without deviceProfile attribute`);

    // Step 3: Fetch device details and sync attributes
    for (const [entityId, datasource] of deviceMap) {
      try {
        // Fetch device details to get deviceProfileId
        const deviceDetails = await fetchDeviceDetails(entityId);
        const deviceProfileId = deviceDetails.deviceProfileId?.id;

        if (!deviceProfileId) {
          console.warn(`[EQUIPMENTS] Device ${entityId} has no deviceProfileId`);
          errors++;
          continue;
        }

        // Look up profile name from map
        const profileName = profileMap.get(deviceProfileId);

        if (!profileName) {
          console.warn(`[EQUIPMENTS] Profile ID ${deviceProfileId} not found in map`);
          errors++;
          continue;
        }

        // Save attribute
        await addDeviceProfileAttribute(entityId, profileName);
        synced++;

        console.log(`[EQUIPMENTS] Synced ${datasource.entityLabel || datasource.entityName} -> ${profileName}`);

      } catch (error) {
        console.error(`[EQUIPMENTS] Failed to sync device ${entityId}:`, error);
        errors++;
      }
    }

    console.log(`[EQUIPMENTS] Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);

    return { synced, skipped, errors };

  } catch (error) {
    console.error("[EQUIPMENTS] Fatal error during sync:", error);
    throw error;
  }
}
```

### Integration Point

In `EQUIPEMTNS/controller.js`, within the `self.ctx.data.forEach` loop:

```javascript
// BEFORE: Existing code
self.ctx.data.forEach((data) => {
  const entityId = data.datasource.entity.id.id;

  // ✅ EXISTING LOGIC: Store ingestionId mapping
  if (data.dataKey.name === "ingestionId" && data.data[0][1]) {
    const ingestionId = data.data[0][1];
    ingestionIdToEntityIdMap.set(ingestionId, entityId);
  }

  // ... rest of loop
});

// AFTER: Add sync check (run once on initialization)
if (!window.__deviceProfileSyncComplete) {
  await syncDeviceProfileAttributes();
  window.__deviceProfileSyncComplete = true;
}
```

## Drawbacks

1. **Initial Delay**: First load will be slower due to synchronization
2. **API Load**: Generates multiple API calls (though only once per device)
3. **Permission Requirements**: Requires write access to device attributes
4. **Stale Data**: If device profiles change in ThingsBoard, attributes won't auto-update

## Rationale and Alternatives

### Why This Design?

- **Server-scope attributes** are the appropriate ThingsBoard mechanism for enriching device metadata
- **One-time sync** minimizes ongoing performance impact
- **Cached profile map** reduces API calls during sync

### Alternative Approaches Considered

1. **Runtime API calls**: Fetch device details every time (rejected due to performance)
2. **Client-side localStorage cache**: Not shared across widgets/sessions
3. **Hardcoded mapping**: Not maintainable as system scales
4. **Device name parsing**: Error-prone and fragile

## Prior Art

Similar patterns exist in:
- ThingsBoard's own device enrichment mechanisms
- Kubernetes label synchronization
- AWS resource tagging systems

## Unresolved Questions

1. **Sync frequency**: Should we periodically re-sync to catch profile changes?
2. **Error handling**: How to handle partial sync failures?
3. **Performance**: Should we batch attribute updates?
4. **Migration**: How to handle existing devices with incorrect attributes?

## Future Possibilities

1. **Automatic re-sync** when device profiles are modified
2. **Bulk attribute API** for faster synchronization
3. **Sync status dashboard** showing attribute coverage
4. **Profile validation** to ensure attributes match actual profiles
5. **Webhook integration** for real-time updates

## Implementation Checklist

- [ ] Implement `fetchDeviceProfiles()`
- [ ] Implement `fetchDeviceDetails()`
- [ ] Implement `addDeviceProfileAttribute()`
- [ ] Implement `syncDeviceProfileAttributes()`
- [ ] Add sync trigger in EQUIPMENTS widget initialization
- [ ] Add error handling and retry logic
- [ ] Add progress logging
- [ ] Test with multiple device profiles
- [ ] Test with hundreds of devices
- [ ] Document in widget README
- [ ] Add configuration option to disable sync if needed
