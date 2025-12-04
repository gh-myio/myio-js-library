# RFC-0096: Alarm Profiles Panel Widget (API-Driven)

- **Feature Name:** `alarm_profiles_panel_widget_api`
- **Start Date:** 2025-12-04
- **RFC PR:** (leave this empty)
- **Implementation Issue:** (leave this empty)
- **Status:** Draft
- **Version:** 1.0.0
- **Author:** MYIO Engineering
- **Target Platform:** ThingsBoard (Custom Widget)

---

## Summary

This RFC defines an API-driven Alarm Profiles Panel Widget for the MYIO ThingsBoard ecosystem. Unlike the previous datasource-based approach (RFC-0095), this widget uses ThingsBoard REST APIs to dynamically fetch devices, device profiles, alarm rules, and active alarms.

The widget receives only **Customer entities** via the datasource, then orchestrates API calls to build a complete alarm-aware operational panel.

---

## Motivation

### Why API-Driven?

The datasource-based approach (RFC-0095) has limitations:

| Limitation | Impact |
|------------|--------|
| Complex datasource configuration | Requires 3 separate datasources with specific attribute mappings |
| Static data binding | Cannot easily traverse entity relationships |
| Limited alarm rule visibility | Alarm rules are embedded in device profiles, not directly accessible via datasources |

The API-driven approach provides:

1. **Simplified Configuration**: Only Customer entities in datasource
2. **Dynamic Data Fetching**: Traverse Customer → Devices → Device Profiles → Alarms
3. **Complete Alarm Rule Access**: Direct access to `profileData.alarms[]` with full rule definitions
4. **Real-time Alarm Status**: Query `/api/v2/alarms` with status filters

### Use Cases

1. **Operations Dashboard**: View all devices and alarms across multiple customers
2. **Alarm Rule Audit**: Inspect what alarm rules are configured per device profile
3. **Active Alarm Monitoring**: Filter and view active/acknowledged/cleared alarms

---

## Guide-level Explanation

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WIDGET DATASOURCE                           │
│                    (Customer Entities Only)                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ctx.data[] = Customer[]                        │
│           Each item contains: customerId, name, etc.                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │ Customer A│   │ Customer B│   │ Customer C│
            └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
                  │               │               │
                  ▼               ▼               ▼
        ┌─────────────────────────────────────────────────┐
        │              API: GET /api/customer/{id}/devices │
        └─────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────┐
        │              Aggregate All Devices               │
        │         Extract unique deviceProfileIds          │
        └─────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌─────────────────────────┐   ┌─────────────────────────┐
        │ API: GET /api/deviceProfile/{id} │   │ API: GET /api/v2/alarms │
        │ (for each unique profile)       │   │ (with status filters)   │
        └─────────────────────────┘   └─────────────────────────┘
                    │                               │
                    ▼                               ▼
        ┌─────────────────────────┐   ┌─────────────────────────┐
        │ Device Profiles with    │   │ Active/Cleared Alarms   │
        │ Alarm Rules (profileData│   │ with severity, status   │
        │ .alarms[])              │   │                         │
        └─────────────────────────┘   └─────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
        ┌─────────────────────────────────────────────────┐
        │                  WIDGET UI                       │
        │  - Device Profile Selector (multi-select)        │
        │  - Devices Grid (filtered by selected profiles)  │
        │  - Alarms List (filtered by profiles + status)   │
        │  - Profile Details Modal (alarm rules view)      │
        └─────────────────────────────────────────────────┘
```

### User Workflow

1. **Widget Loads**: Receives Customer entities from datasource
2. **Auto-Fetch**: Widget automatically fetches all devices for each customer via API
3. **Profile Extraction**: Unique device profile IDs are extracted from devices
4. **Profile Details**: Device profiles are fetched with full alarm rule definitions
5. **Alarm Query**: Active alarms are fetched via API with configurable filters
6. **UI Display**: User can select profiles, view devices, inspect alarms, and see alarm rules

---

## Reference-level Explanation

### API Endpoints Used

#### 1. Get Customer Devices

```
GET /api/customer/{customerId}/devices?pageSize={size}&page={page}
```

**Response Structure:**
```typescript
interface CustomerDevicesResponse {
  data: Device[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

interface Device {
  id: { entityType: "DEVICE"; id: string };
  createdTime: number;
  tenantId: { entityType: "TENANT"; id: string };
  customerId: { entityType: "CUSTOMER"; id: string };
  name: string;
  type: string;
  label: string;
  deviceProfileId: { entityType: "DEVICE_PROFILE"; id: string };
  // ... additional fields
}
```

#### 2. Get Device Profile Details

```
GET /api/deviceProfile/{deviceProfileId}?inlineImages=true
```

**Response Structure:**
```typescript
interface DeviceProfile {
  id: { entityType: "DEVICE_PROFILE"; id: string };
  name: string;
  description: string;
  defaultRuleChainId: { entityType: "RULE_CHAIN"; id: string } | null;
  profileData: {
    configuration: object;
    transportConfiguration: object;
    provisionConfiguration: object;
    alarms: AlarmRule[];
  };
}

interface AlarmRule {
  id: string;
  alarmType: string;
  createRules: {
    [severity: string]: {
      condition: AlarmCondition;
      schedule: object | null;
      alarmDetails: string | null;
      dashboardId: string | null;
    };
  };
  clearRule: {
    condition: AlarmCondition;
    schedule: object | null;
    alarmDetails: string | null;
    dashboardId: string | null;
  };
  propagate: boolean;
  propagateToOwner: boolean;
  propagateToTenant: boolean;
}

interface AlarmCondition {
  condition: ConditionItem[];
  spec: { type: string };
}

interface ConditionItem {
  key: { type: string; key: string };
  valueType: string;
  predicate: {
    type: string;
    operation: string;
    value: { defaultValue: string };
    ignoreCase?: boolean;
  };
}
```

#### 3. Get Alarms

```
GET /api/v2/alarms?pageSize={size}&page={page}&sortProperty=createdTime&sortOrder=DESC&statusList={statuses}
```

**Query Parameters:**
- `pageSize`: Number of alarms per page (default: 100)
- `page`: Page number (0-indexed)
- `sortProperty`: Sort field (e.g., `createdTime`)
- `sortOrder`: `ASC` or `DESC`
- `statusList`: Comma-separated list: `ACTIVE`, `CLEARED`, `ACK`, `UNACK`

**Response Structure:**
```typescript
interface AlarmsResponse {
  data: Alarm[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

interface Alarm {
  id: { entityType: "ALARM"; id: string };
  createdTime: number;
  tenantId: { entityType: "TENANT"; id: string };
  customerId: { entityType: "CUSTOMER"; id: string };
  type: string;  // Alarm type name
  originator: { entityType: "DEVICE"; id: string };
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "WARNING" | "INDETERMINATE";
  acknowledged: boolean;
  cleared: boolean;
  startTs: number;
  endTs: number;
  ackTs: number;
  clearTs: number;
  originatorName: string;
  originatorLabel: string;
  name: string;
  status: "ACTIVE_UNACK" | "ACTIVE_ACK" | "CLEARED_UNACK" | "CLEARED_ACK";
  details: object;
}
```

### Widget Controller Architecture

```javascript
self.onInit = function() {
  var ctx = self.ctx;
  var vm = self;

  // State
  vm.customers = [];      // From datasource
  vm.devices = [];        // From API
  vm.deviceProfiles = {}; // { [profileId]: ProfileData }
  vm.alarms = [];         // From API

  // UI State
  vm.loading = true;
  vm.selectedProfileIds = [];
  vm.viewMode = 'devices'; // 'devices' | 'alarms'

  // Methods
  vm.fetchAllData = fetchAllData;
  vm.fetchDevicesForCustomer = fetchDevicesForCustomer;
  vm.fetchDeviceProfile = fetchDeviceProfile;
  vm.fetchAlarms = fetchAlarms;
};

self.onDataUpdated = function() {
  // Extract customers from datasource
  extractCustomersFromDatasource();

  // Trigger API fetch chain
  fetchAllData();
};

async function fetchAllData() {
  vm.loading = true;

  try {
    // 1. Fetch devices for all customers
    await fetchAllDevices();

    // 2. Extract unique profile IDs and fetch profiles
    await fetchAllProfiles();

    // 3. Fetch alarms
    await fetchAlarms();

    vm.loading = false;
    ctx.detectChanges();
  } catch (error) {
    vm.error = error.message;
    vm.loading = false;
    ctx.detectChanges();
  }
}
```

### API Call Implementation

```javascript
function fetchDevicesForCustomer(customerId) {
  var url = '/api/customer/' + customerId + '/devices?pageSize=1000&page=0';

  return ctx.http.get(url).toPromise().then(function(response) {
    return response.data || [];
  });
}

function fetchDeviceProfile(profileId) {
  var url = '/api/deviceProfile/' + profileId + '?inlineImages=false';

  return ctx.http.get(url).toPromise();
}

function fetchAlarms(statusList) {
  var statuses = statusList || 'ACTIVE,CLEARED';
  var url = '/api/v2/alarms?pageSize=500&page=0&sortProperty=createdTime&sortOrder=DESC&statusList=' + statuses;

  return ctx.http.get(url).toPromise().then(function(response) {
    return response.data || [];
  });
}
```

### Widget Settings Schema

```json
{
  "schema": {
    "type": "object",
    "title": "Alarm Profiles Panel Settings",
    "properties": {
      "api": {
        "type": "object",
        "title": "API Settings",
        "properties": {
          "devicesPageSize": {
            "type": "number",
            "title": "Devices page size",
            "default": 1000
          },
          "alarmsPageSize": {
            "type": "number",
            "title": "Alarms page size",
            "default": 500
          },
          "defaultAlarmStatuses": {
            "type": "string",
            "title": "Default alarm statuses (comma-separated)",
            "default": "ACTIVE"
          }
        }
      },
      "appearance": {
        "type": "object",
        "title": "Appearance",
        "properties": {
          "showHeader": { "type": "boolean", "default": true },
          "headerTitle": { "type": "string", "default": "Alarm Profiles Panel" }
        }
      }
    }
  }
}
```

---

## Drawbacks

1. **API Rate Limits**: Multiple API calls per customer may hit rate limits on large installations
2. **Latency**: Sequential API calls increase initial load time
3. **Authentication**: Requires user to have API permissions for all endpoints
4. **Pagination Complexity**: Must handle pagination for large datasets

---

## Rationale and Alternatives

### Why This Approach?

| Aspect | Datasource Approach (RFC-0095) | API Approach (RFC-0096) |
|--------|-------------------------------|-------------------------|
| Configuration | 3 complex datasources | 1 simple datasource (Customers) |
| Data traversal | Limited to flat data | Full entity relationship traversal |
| Alarm rules | Not accessible | Full access via `profileData.alarms` |
| Real-time alarms | Requires alarm datasource config | Direct API query with filters |
| Flexibility | Rigid schema | Adaptable to any data structure |

### Alternatives Considered

#### Alternative 1: Hybrid Approach
Use datasources for devices and API only for profiles/alarms.
**Rejected**: Still requires complex datasource configuration.

#### Alternative 2: Server-side Aggregation
Create a custom ThingsBoard rule node to aggregate data.
**Rejected**: Requires backend changes, increases deployment complexity.

---

## Prior Art

- **ThingsBoard Entities Table Widget**: Uses similar API-driven approach for entity queries
- **ThingsBoard Alarm Table Widget**: Uses `/api/v2/alarms` endpoint
- **RFC-0095**: Previous datasource-based approach (superseded by this RFC)

---

## Unresolved Questions

1. **Caching Strategy**: Should we cache device profiles to reduce API calls?
2. **Pagination UI**: How to handle pagination for large alarm lists?
3. **Real-time Updates**: Should alarms update via WebSocket subscription?
4. **Cross-customer Filtering**: Allow filtering devices/alarms by specific customers?

---

## Future Possibilities

1. **WebSocket Integration**: Subscribe to alarm updates for real-time refresh
2. **Alarm Acknowledgment**: Add inline acknowledge/clear actions
3. **Profile Comparison**: Compare alarm rules across device profiles
4. **Export Functionality**: Export alarm history to CSV/PDF
5. **Alarm Trend Charts**: Visualize alarm frequency over time

---

## Appendix A: Complete API Call Sequence

```
1. Widget receives ctx.data[] with Customer entities
   └── Extract customerId for each customer

2. For each customerId:
   └── GET /api/customer/{customerId}/devices?pageSize=1000&page=0
       └── Collect all devices, handle pagination if hasNext=true

3. Extract unique deviceProfileId values from all devices

4. For each unique deviceProfileId:
   └── GET /api/deviceProfile/{deviceProfileId}
       └── Store profile with alarm rules

5. GET /api/v2/alarms?statusList=ACTIVE&pageSize=500&page=0
   └── Collect alarms, optionally filter by originator (device)

6. Render UI with aggregated data
```

---

## Appendix B: Alarm Severity Mapping

| ThingsBoard Severity | Display Color | Badge Class |
|---------------------|---------------|-------------|
| CRITICAL | Red (#b71c1c) | ap-badge-critical |
| MAJOR | Orange-Red (#e53935) | ap-badge-major |
| MINOR | Amber (#ffb300) | ap-badge-minor |
| WARNING | Yellow (#ffeb3b) | ap-badge-warning |
| INDETERMINATE | Blue (#bbdefb) | ap-badge-info |

---

## Appendix C: Alarm Status Mapping

| Status | Description | Display |
|--------|-------------|---------|
| ACTIVE_UNACK | Active, not acknowledged | Red badge |
| ACTIVE_ACK | Active, acknowledged | Orange badge |
| CLEARED_UNACK | Cleared, not acknowledged | Green badge |
| CLEARED_ACK | Cleared and acknowledged | Gray badge |

---

## Conclusion

The API-driven approach (RFC-0096) provides a more flexible and maintainable solution than the datasource-based approach (RFC-0095). By using ThingsBoard REST APIs, the widget can:

1. Traverse entity relationships dynamically
2. Access complete alarm rule definitions
3. Query alarms with flexible filters
4. Simplify widget configuration to a single Customer datasource

This approach aligns with modern widget development practices and provides the foundation for future enhancements like real-time updates and alarm management actions.
