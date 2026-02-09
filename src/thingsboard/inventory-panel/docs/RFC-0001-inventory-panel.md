# RFC-0001: Inventory Panel Widget

- **Feature Name:** `inventory_panel`
- **Start Date:** 2026-02-02
- **RFC PR:** N/A
- **ThingsBoard Version:** 3.6+

## Summary

A ThingsBoard widget for device inventory management, featuring a dual-tab interface: one for hierarchical device listing with tree grouping (Customer and Type, with optional Profile), and another for a dashboard with charts and statistics (total devices, active/inactive counts, devices per customer/type). Inspired by `alarm-panel-setup` v1.0.0.

## Motivation

Current ThingsBoard deployments lack a unified view for:
- Visualizing all devices across multiple customers in a single panel
- Grouping devices by customer, device type, or device profile in a tree structure
- Providing quick analytics on device status distribution
- Exporting inventory data for reporting and auditing purposes

This widget addresses these needs by providing a comprehensive inventory management solution.

## Guide-level Explanation

### Overview

The Inventory Panel widget provides two main views:

1. **Devices Tab** - A hierarchical list of all devices with:
   - Tree grouping by Customer or Device Type (Profile optional)
   - Flat list view option
   - Search and filter capabilities
   - Device status indicators (active/inactive)
   - Click-to-navigate to device details

2. **Dashboard Tab** - Analytics and statistics including:
   - Total devices count
   - Active devices (`device.active === true`)
   - Inactive devices
   - Devices per customer chart (bar)
   - Devices per device type chart (donut)
   - Devices per device profile chart (optional)
   - Export to CSV/PDF functionality

### User Interface

```
+----------------------------------------------------------+
|  Inventory Panel                           [Export] [Refresh]
+----------------------------------------------------------+
|  [Devices]  [Dashboard]                                   |
+----------------------------------------------------------+
|                                                          |
|  Tab Content Area                                        |
|                                                          |
+----------------------------------------------------------+
```

#### Devices Tab Structure

```
+----------------------------------------------------------+
| Search: [________________] | Group by: [Customer ▼]       |
+----------------------------------------------------------+
| ▼ Customer A (15 devices)                                 |
|   ├─ Device 001          ● Active    3F_MEDIDOR          |
|   ├─ Device 002          ○ Inactive  TERMOSTATO          |
|   └─ Device 003          ● Active    HIDROMETRO          |
| ▼ Customer B (8 devices)                                  |
|   ├─ Device 004          ● Active    3F_MEDIDOR          |
|   └─ Device 005          ○ Inactive  3F_MEDIDOR          |
+----------------------------------------------------------+
```

#### Dashboard Tab Structure

```
+----------------------------------------------------------+
|  +----------------+  +----------------+  +----------------+
|  | Total Devices  |  | Active         |  | Inactive       |
|  |     156        |  |     142        |  |     14         |
|  +----------------+  +----------------+  +----------------+
|                                                          |
|  +---------------------------+  +------------------------+
|  | Devices by Customer       |  | Devices by Type        |
|  | [Bar Chart - Top 10]      |  | [Donut Chart]          |
|  +---------------------------+  +------------------------+
|                                                          |
|  [Export CSV]  [Export PDF]                              |
+----------------------------------------------------------+
```

## Reference-level Explanation

### Architecture

```
inventory-panel/
├── v1.0.0/
│   ├── controller.js      # Main widget logic
│   ├── template.html      # Angular template
│   ├── style.css          # Widget styles
│   └── settings.schema    # Configuration schema
└── docs/
    └── RFC-0001-inventory-panel.md
```

### Data Model

#### Device Object
```javascript
{
  id: { id: string, entityType: 'DEVICE' },
  name: string,
  type: string,
  label: string,
  deviceProfileId: { id: string, entityType: 'DEVICE_PROFILE' },
  deviceProfileName: string,
  customerId: { id: string, entityType: 'CUSTOMER' },
  customerTitle: string,
  active: boolean,
  createdTime: number,
  additionalInfo: object
}
```

#### State Management
```javascript
var state = {
  // UI State
  loading: boolean,
  error: string | null,
  activeTab: 'devices' | 'dashboard',

  // Data
  devices: Device[],
  customers: Customer[],
  deviceProfiles: DeviceProfile[],

  // Devices Tab
  groupBy: 'customer' | 'type' | 'profile' | 'none',
  searchText: string,
  expandedGroups: { [key: string]: boolean },
  selectedDeviceIds: string[],

  // Dashboard Tab
  stats: {
    total: number,
    active: number,
    inactive: number,
    byCustomer: { [customerId: string]: { name: string, count: number, active: number } },
    byType: { [type: string]: { count: number, active: number } },
    byProfile: { [profileId: string]: { name: string, count: number, active: number } }
  },

  // Export
  exportOptions: {
    includeInactive: boolean,
    format: 'csv' | 'pdf'
  }
};
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/deviceInfos/all` | GET | Fetch all devices with customer info (paginated) |
| `/api/deviceProfiles` | GET | Fetch device profiles |
| `/api/customers` | GET | Fetch customers |

### Key Functions

#### Data Loading
```javascript
async function fetchAllDevices(pageSize = 1000) {
  // Paginated fetch of all devices
  // Returns: Device[]
}

async function fetchCustomers() {
  // Fetch all customers for grouping
  // Returns: Customer[]
}

async function fetchDeviceProfiles() {
  // Fetch all device profiles
  // Returns: DeviceProfile[]
}
```

#### Tree Building
```javascript
function buildTreeData(devices, groupBy) {
  // Groups devices into tree structure by customer/type/profile
  // Returns: TreeNode[]
}

function filterDevices(devices, searchText) {
  // Filters devices by search text (name, type, label, customer, profile)
  // Returns: Device[]
}
```

#### Statistics Calculation
```javascript
function calculateStats(devices) {
  // Aggregates device statistics
  // Returns: { total, active, inactive, byCustomer, byType, byProfile }
}
```

#### Export Functions
```javascript
function exportToCSV(devices) {
  // Generates and downloads CSV file
  // Columns: Name, Type, Profile, Customer, Status, Created
}

function exportToPDF(devices, stats) {
  // Generates and downloads PDF report with summary and device list
}
```

### Settings Schema

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "default": "Inventory Panel"
      },
      "defaultTab": {
        "type": "string",
        "enum": ["devices", "dashboard"],
        "default": "devices"
      },
      "defaultGroupBy": {
        "type": "string",
        "enum": ["customer", "type", "profile", "none"],
        "default": "customer"
      },
      "pageSize": {
        "type": "number",
        "default": 1000
      },
      "showExportButton": {
        "type": "boolean",
        "default": true
      },
      "refreshInterval": {
        "type": "number",
        "default": 0,
        "description": "Auto-refresh interval in seconds (0 = disabled)"
      }
    }
  }
}
```

## Drawbacks

1. **Performance**: Loading all devices at once may be slow for large deployments (1000+ devices)
2. **Memory**: Tree structure with many nodes can consume significant memory
3. **API Load**: Multiple API calls required for full data loading

## Rationale and Alternatives

### Why this design?

- **Dual-tab interface**: Separates listing from analytics
- **Tree grouping**: Natural way to organize hierarchical data (Customer → Device)
- **Pure JS rendering**: Avoids Angular complexity, easier to maintain

### Alternatives Considered

1. **Single scrolling view**: Rejected due to information overload
2. **Server-side grouping**: Rejected due to API limitations in ThingsBoard
3. **Virtual scrolling**: Could be added later for performance optimization

## Prior Art

- **alarm-panel-setup**: Similar architecture and UI patterns
- **ThingsBoard Entity Table**: Native widget, but lacks tree grouping

## Unresolved Questions

1. Should we support multi-select for bulk operations?
2. Should dashboard charts be configurable by the user?
3. Should we cache data locally for faster subsequent loads?

## Future Possibilities

1. **Bulk Operations**: Select multiple devices for batch actions
2. **Custom Columns**: User-configurable columns in device list
3. **Real-time Updates**: WebSocket integration for live status updates
4. **Drill-down**: Click chart segments to filter device list
5. **Saved Filters**: Persist user filter preferences
