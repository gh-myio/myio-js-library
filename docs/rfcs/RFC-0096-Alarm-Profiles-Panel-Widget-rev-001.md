# RFC-0096: Alarm Profiles Panel Widget (API-Driven) - Revision 001

- **Feature Name:** `alarm_profiles_panel_widget_api`
- **Start Date:** 2025-12-04
- **RFC PR:** (leave this empty)
- **Implementation Issue:** (leave this empty)
- **Status:** Draft
- **Version:** 1.0.1
- **Author:** MYIO Engineering
- **Target Platform:** ThingsBoard (Custom Widget)

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-04 | Initial RFC - customer-specific device fetching |
| 1.0.1 | 2025-12-04 | **Changed device fetching to use `/api/deviceInfos/all` with client-side filtering** |

---

## Summary

This revision changes the device fetching strategy from customer-specific API calls to a single paginated call that fetches all devices, then filters client-side by customer IDs from the datasource.

---

## Motivation for Revision

The original approach using `/api/customer/{customerId}/devices` had issues:

| Problem | Impact |
|---------|--------|
| Some customers return 0 devices even when devices exist | Widget shows empty state incorrectly |
| Multiple API calls (one per customer) | Slower initial load, more network requests |
| Device-customer relationship not always reliable via this endpoint | Data inconsistency |

The new approach using `/api/deviceInfos/all`:

1. **Single Source of Truth**: Gets ALL devices with their customer assignments
2. **Reliable Data**: The `customerId` field is always populated correctly
3. **Client-side Filtering**: Filter devices where `device.customerId.id` is IN the datasource customer IDs
4. **Pagination Support**: Handle large datasets with pagination

---

## Data Flow Architecture (Revised)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WIDGET DATASOURCE                           │
│                    (Customer Entities Only)                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ctx.data[] = Customer[]                        │
│           Extract customerIds = ['id1', 'id2', 'id3']               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│     API: GET /api/deviceInfos/all?pageSize=300&page=0               │
│              &includeCustomers=true&sortProperty=name               │
│                                                                     │
│     Paginate until hasNext=false                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CLIENT-SIDE FILTER                                     │
│     devices.filter(d => customerIds.includes(d.customerId.id))      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Extract unique deviceProfileIds                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌─────────────────────────┐   ┌─────────────────────────┐
        │ API: GET /api/deviceProfile/{id} │   │ API: GET /api/v2/alarms │
        │ (for each unique profile)       │   │ (with status filters)   │
        └─────────────────────────┘   └─────────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │                  WIDGET UI                               │
        └─────────────────────────────────────────────────────────┘
```

---

## API Endpoint Details

### GET /api/deviceInfos/all

**Endpoint:**
```
GET /api/deviceInfos/all?pageSize={size}&page={page}&includeCustomers=true&sortProperty=name&sortOrder=ASC
```

**Query Parameters:**
- `pageSize`: Number of devices per page (recommended: 300)
- `page`: Page number (0-indexed)
- `includeCustomers`: Set to `true` to include customer information
- `sortProperty`: Sort field (e.g., `name`, `createdTime`)
- `sortOrder`: `ASC` or `DESC`

**Response Structure:**
```typescript
interface DeviceInfosResponse {
  data: DeviceInfo[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
}

interface DeviceInfo {
  id: { entityType: "DEVICE"; id: string };
  createdTime: number;
  tenantId: { entityType: "TENANT"; id: string };
  customerId: { entityType: "CUSTOMER"; id: string };
  name: string;
  type: string;
  label: string;
  deviceProfileId: { entityType: "DEVICE_PROFILE"; id: string };
  firmwareId: string | null;
  softwareId: string | null;
  externalId: string | null;
  version: number;
  ownerName: string | null;
  groups: EntityGroup[];
  active: boolean;
  ownerId: { entityType: string; id: string };
  additionalInfo: object | null;
  deviceData: {
    configuration: { type: string };
    transportConfiguration: { type: string };
  };
}

interface EntityGroup {
  id: { entityType: "ENTITY_GROUP"; id: string };
  name: string;
}
```

---

## Implementation Changes

### Before (v1.0.0)

```javascript
// Fetch devices per customer - PROBLEM: returns 0 for some customers
var devicePromises = customerIds.map(function (customerId) {
  return fetchDevicesForCustomer(ctx, customerId, pageSize);
});
Promise.all(devicePromises).then(...)
```

### After (v1.0.1)

```javascript
// Fetch ALL devices, then filter by customer IDs
fetchAllDevicesWithPagination(ctx, pageSize)
  .then(function (allDevices) {
    // Client-side filter by datasource customer IDs
    var filteredDevices = allDevices.filter(function (device) {
      return customerIds.indexOf(device.customerId) !== -1;
    });
    return filteredDevices;
  })
  .then(...)
```

### New Function: fetchAllDevicesWithPagination

```javascript
function fetchAllDevicesWithPagination(ctx, pageSize) {
  var allDevices = [];
  var currentPage = 0;

  function fetchPage(page) {
    var url = '/api/deviceInfos/all?pageSize=' + pageSize +
              '&page=' + page +
              '&includeCustomers=true&sortProperty=name&sortOrder=ASC';

    return ctx.http.get(url).toPromise()
      .then(function (response) {
        var devices = response.data || [];
        allDevices = allDevices.concat(devices);

        if (response.hasNext) {
          return fetchPage(page + 1);
        }
        return allDevices;
      });
  }

  return fetchPage(0);
}
```

---

## Filtering Logic

```javascript
// Customer IDs from datasource
var customerIds = vm.customers.map(function (c) { return c.id; });

// Filter devices client-side
var filteredDevices = allDevices.filter(function (device) {
  var deviceCustomerId = device.customerId ? device.customerId.id : null;
  return deviceCustomerId && customerIds.indexOf(deviceCustomerId) !== -1;
});
```

---

## Performance Considerations

| Aspect | Old Approach | New Approach |
|--------|-------------|--------------|
| API Calls | N calls (one per customer) | 1-N calls (paginated, ~25 pages for 7000 devices) |
| Data Transfer | Only relevant devices | All devices, then filter |
| Reliability | Some customers return 0 | Consistent results |
| Initial Load | Parallel but unreliable | Sequential pagination |

### Mitigation for Large Datasets

1. **Progress Indicator**: Show "Loading devices... page X of Y"
2. **Caching**: Cache device list for session (optional)
3. **Page Size Tuning**: Use 300-500 per page for balance

---

## Conclusion

This revision addresses the device fetching reliability issue by using `/api/deviceInfos/all` instead of customer-specific endpoints. While it fetches more data initially, it ensures consistent and reliable results across all customer configurations.
