# RFC-0087: Water Consumption Widgets Suite

- **Status**: Draft
- **Created**: 2025-12-01
- **Updated**: 2025-12-01
- **Authors**: Development Team
- **Related**: RFC-0057 (Orchestrator), RFC-0086 (DATA_API_HOST)

## Summary

This RFC introduces a comprehensive suite of water consumption widgets for the MYIO dashboard, mirroring the existing energy consumption widget architecture. The suite includes three new widgets: `WATER_COMMON_AREA`, `WATER_STORES`, and `WATER`, along with corresponding MENU integration.

## Motivation

The current dashboard provides detailed energy consumption monitoring through EQUIPMENTS, STORES, and ENERGY widgets. Water consumption monitoring requires equivalent functionality to:

1. Track water usage in common areas (elevators, HVAC, etc.)
2. Monitor water consumption by individual stores/tenants
3. Provide aggregated views of water consumption by category
4. Enable filtering and comparison capabilities consistent with energy widgets

## Guide-level Explanation

### Widget Architecture

```
MENU (Water Tab)
    │
    ├──► WATER_COMMON_AREA (based on EQUIPMENTS)
    │    └── Displays hydrometers for common areas
    │
    ├──► WATER_STORES (based on STORES)
    │    └── Displays hydrometers for stores/tenants
    │
    └──► WATER (based on WATER_STORES)
         └── Aggregated view: common area vs stores consumption
```

### Widget Descriptions

#### 1. WATER_COMMON_AREA
- **Base**: `EQUIPMENTS` widget
- **Purpose**: Display water consumption from common area hydrometers
- **Features**:
  - Grid of hydrometer cards with consumption data
  - Filtering by status (online/offline, with/without consumption)
  - Sorting options (consumption, alphabetical)
  - Shopping filter integration
  - Statistics header (total devices, total consumption, connectivity)

#### 2. WATER_STORES
- **Base**: `STORES` widget
- **Purpose**: Display water consumption by store/tenant
- **Features**:
  - List of stores with individual water consumption
  - Store search and filtering
  - Shopping filter integration
  - Consumption comparison between stores

#### 3. WATER
- **Base**: `WATER_STORES` widget (structure)
- **Purpose**: Aggregated water consumption dashboard
- **Features**:
  - Summary cards: Common Area vs Stores consumption
  - Percentage breakdown visualization
  - Total water consumption KPI
  - Drill-down navigation to detailed views

### MENU Integration

Add water navigation tab to MENU widget:

```
┌─────────────────────────────────────────┐
│  ENERGIA  │  ÁGUA  │  LOJAS  │  ...    │
└─────────────────────────────────────────┘
                 │
                 ├── Área Comum (WATER_COMMON_AREA)
                 ├── Lojas (WATER_STORES)
                 └── Resumo (WATER)
```

## Reference-level Explanation

### Directory Structure

```
src/MYIO-SIM/v5.2.0/
├── WATER_COMMON_AREA/
│   ├── controller.js    # Based on EQUIPMENTS/controller.js
│   ├── template.html    # Based on EQUIPMENTS/template.html
│   └── style.css        # Based on EQUIPMENTS/style.css
│
├── WATER_STORES/
│   ├── controller.js    # Based on STORES/controller.js
│   ├── template.html    # Based on STORES/template.html
│   └── style.css        # Based on STORES/style.css
│
└── WATER/
    ├── controller.js    # Aggregated view controller
    ├── template.html    # Summary dashboard template
    └── style.css        # Dashboard styles
```

### API Endpoints

Water consumption data is fetched from the DATA_API:

```javascript
// Common Area Hydrometers
GET /api/v1/telemetry/customers/{customerId}/water/devices/totals
    ?startTime={startISO}&endTime={endISO}&deep=1&deviceType=HYDROMETRO_AREA_COMUM

// Store Hydrometers
GET /api/v1/telemetry/customers/{customerId}/water/devices/totals
    ?startTime={startISO}&endTime={endISO}&deep=1&deviceType=HYDROMETRO_LOJA
```

### Data Model

```javascript
// Water device structure
{
  id: string,              // Device ingestion ID
  name: string,            // Device name
  total_value: number,     // Total consumption in m³
  customerId: string,      // Shopping/customer ID for filtering
  deviceType: string,      // 'HYDROMETRO_AREA_COMUM' | 'HYDROMETRO_LOJA'
  status: string,          // 'online' | 'offline'
  timestamp: number        // Last update timestamp
}
```

### Event Integration

```javascript
// Water widgets listen to existing events
window.addEventListener('myio:filter-applied', handleShoppingFilter);
window.addEventListener('myio:update-date', handleDateChange);
window.addEventListener('myio:orchestrator-filter-updated', handleOrchestratorUpdate);

// Water widgets emit consumption events
window.dispatchEvent(new CustomEvent('myio:water-common-area-ready', { detail }));
window.dispatchEvent(new CustomEvent('myio:water-stores-ready', { detail }));
```

### MENU Changes

Add water state handling in MENU/controller.js:

```javascript
// New states for water navigation
const WATER_STATES = {
  WATER_COMMON_AREA: 'water_common_area',
  WATER_STORES: 'water_stores',
  WATER: 'water_summary'
};

// Water tab click handler
function handleWaterTabClick(subState) {
  publishSwitch(subState);
  // Update date params for water widgets
  window.dispatchEvent(new CustomEvent('myio:update-date', {
    detail: { startDate: startDateISO, endDate: endDateISO }
  }));
}
```

## Implementation Plan

### Phase 1: WATER_COMMON_AREA
1. Copy EQUIPMENTS widget structure
2. Modify API calls to fetch water data
3. Update labels and units (kWh → m³)
4. Filter by `deviceType = 'HYDROMETRO_AREA_COMUM'`
5. Test with shopping filter integration

### Phase 2: WATER_STORES
1. Copy STORES widget structure
2. Modify API calls to fetch store water data
3. Update labels and units
4. Filter by `deviceType = 'HYDROMETRO_LOJA'`
5. Test with shopping filter integration

### Phase 3: WATER (Aggregated)
1. Create summary dashboard layout
2. Fetch data from both common area and stores
3. Calculate percentages and totals
4. Implement drill-down navigation

### Phase 4: MENU Integration
1. Add water tab to MENU template
2. Implement water sub-navigation
3. Handle state switching for water widgets
4. Test complete flow

## Files to Create

| File | Based On | Purpose |
|------|----------|---------|
| `WATER_COMMON_AREA/controller.js` | `EQUIPMENTS/controller.js` | Common area hydrometers logic |
| `WATER_COMMON_AREA/template.html` | `EQUIPMENTS/template.html` | Common area UI template |
| `WATER_COMMON_AREA/style.css` | `EQUIPMENTS/style.css` | Common area styles |
| `WATER_STORES/controller.js` | `STORES/controller.js` | Store hydrometers logic |
| `WATER_STORES/template.html` | `STORES/template.html` | Stores UI template |
| `WATER_STORES/style.css` | `STORES/style.css` | Stores styles |
| `WATER/controller.js` | New | Aggregated dashboard logic |
| `WATER/template.html` | New | Summary dashboard template |
| `WATER/style.css` | New | Dashboard styles |

## Files to Modify

| File | Changes |
|------|---------|
| `MENU/controller.js` | Add water tab handling and navigation |
| `MENU/template.html` | Add water tab UI elements |
| `MAIN/controller.js` | Add water state management if needed |

## Drawbacks

1. **Code duplication**: Significant overlap with energy widgets
2. **Maintenance burden**: Changes to EQUIPMENTS/STORES may need replication
3. **API load**: Additional API calls for water data

## Rationale and Alternatives

### Why separate widgets?
- Clear separation of concerns (energy vs water)
- Independent feature development and testing
- Consistent with existing architecture patterns

### Alternatives considered
1. **Single unified consumption widget**: Too complex, mixed concerns
2. **Parameterized widgets**: Would require significant refactoring
3. **Shared base class**: JavaScript widget system doesn't support inheritance well

## Future Possibilities

1. **Combined energy/water dashboard**: Side-by-side comparison
2. **Consumption alerts**: Threshold-based notifications for water usage
3. **Historical trends**: Water consumption over time charts
4. **Leak detection**: Anomaly detection for unusual water consumption patterns
5. **Cost calculation**: Water billing integration
