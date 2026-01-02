# RFC 0111: Unified Main Widget with Single Datasource Architecture

- Feature Name: `unified-main-single-datasource`
- Start Date: 2026-01-02
- RFC PR: (to be assigned)
- Status: **Draft**

---

## Summary

This RFC proposes a new unified architecture for the MYIO-SIM Head Office dashboard where the MAIN widget uses a **single datasource** (`AllDevices`) containing all device types mixed together. The MAIN orchestrator will classify and route devices by domain (energy, water, temperature) and context (entry, common_area, stores) to the unified TELEMETRY widget, which dynamically renders content based on MENU selections.

---

## Motivation

### Current Architecture Problems

The current MAIN widget architecture has several limitations:

1. **Multiple Datasources**: Three separate ThingsBoard datasources exist:

   - `equipamentos e lojas` (energy devices)
   - `allhidrodevices` (water meters)
   - `alltemperaturedevices` (temperature sensors)

2. **Multiple Specialized Widgets**: Eight separate widget implementations:

   - EQUIPMENTS (energy/entry)
   - STORES (energy/stores)
   - WATER_COMMON_AREA
   - WATER_STORES
   - TEMPERATURE_SENSORS
   - TEMPERATURE_WITHOUT_CLIMATE_CONTROL
   - ENERGY (summary view)
   - WATER (summary view)

3. **Code Duplication**: Each widget has nearly identical logic for:

   - Device card rendering
   - Status calculation (RFC-0110)
   - Filter modal handling
   - Header statistics
   - Shopping filter integration

4. **Maintenance Burden**: Bug fixes and features must be replicated across all widgets.

5. **Complex State Management**: Each domain has separate data flow paths and caching mechanisms.

### Goals

1. **Single Source of Truth**: One datasource with all devices
2. **Unified Widget**: One TELEMETRY widget configurable for any domain/context
3. **Simplified Architecture**: MAIN orchestrates all data flow
4. **Reduced Codebase**: Eliminate 7+ redundant widget implementations
5. **Consistent UX**: Same behavior and styling across all views

---

## Guide-level Explanation

### ⚠️ IMPORTANT NOTES

**This RFC creates a NEW widget**: `MAIN_UNIQUE_DATASOURCE`

**Do NOT modify these legacy files**:

- `src/MYIO-SIM/v5.2.0/MAIN/` - Old MAIN widget
- `src/MYIO-SIM/v5.2.0/MENU/` - Old MENU widget (now a library component)

### New Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│              MAIN_UNIQUE_DATASOURCE (New Widget)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           ThingsBoard Datasource: "AllDevices"            │  │
│  │  (energy meters + water meters + temperature sensors)     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  MyIOOrchestrator                         │  │
│  │  - Classifies devices by domain (energy/water/temp)       │  │
│  │  - Classifies devices by context (equipments/stores)      │  │
│  │  - Caches classified data in window.MyIOOrchestratorData  │  │
│  │  - Renders library components (Header, Menu, Footer)      │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌────────────┐    ┌─────────────────┐    ┌──────────────┐     │
│  │   HEADER   │    │    TELEMETRY    │    │    FOOTER    │     │
│  │   (lib)    │    │    (widget)     │    │    (lib)     │     │
│  └────────────┘    └─────────────────┘    └──────────────┘     │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Renders cards based on current domain + context         │  │
│  │   - domain: energy | water | temperature                  │  │
│  │   - context: equipments | stores | hidrometro | etc.      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Note: Only 2 widgets remain: MAIN_UNIQUE_DATASOURCE and TELEMETRY
      HEADER, MENU, FOOTER are now MyIOLibrary components (RFC-0113, 0114, 0115)
```

### Data Flow

1. **Initialization**: MAIN loads single datasource `AllDevices` containing all devices
2. **Classification**: MyIOOrchestrator parses `ctx.data` and classifies each device:
   - By **domain**: `energy`, `water`, `temperature`
   - By **context**: `entry`, `common_area`, `stores`, `with_climate_control`, `without_climate_control`
3. **Caching**: Classified data stored in `window.MyIOOrchestratorData`
4. **MENU Selection**: User clicks menu item (e.g., "Water > Stores")
5. **Event Dispatch**: MAIN dispatches `myio:telemetry-config-change` event
6. **TELEMETRY Update**: TELEMETRY widget receives event and re-renders with new domain/context

### Device Classification Rules

| Domain      | Device Type                                                     | Context Determination   |
| ----------- | --------------------------------------------------------------- | ----------------------- |
| energy      | `deviceProfile === '3F_MEDIDOR' && deviceType === '3F_MEDIDOR'` | stores                  |
| energy      | `deviceProfile !== '3F_MEDIDOR'`                                | entry/common_area       |
| water       | `aliasName === 'Todos Hidrometros Lojas'`                       | stores                  |
| water       | `aliasName === 'HidrometrosAreaComum'`                          | common_area             |
| temperature | `deviceType includes 'CLIMA'`                                   | with_climate_control    |
| temperature | `deviceType not includes 'CLIMA'`                               | without_climate_control |

### MENU Integration

**⚠️ NOTE**: MENU is now a **library component** (`createMenuComponent` from MyIOLibrary), not a ThingsBoard widget. It is rendered by MAIN_UNIQUE_DATASOURCE controller.

The Menu component (library) dispatches navigation events:

```javascript
// When user clicks a menu item
window.dispatchEvent(
  new CustomEvent('myio:telemetry-config-change', {
    detail: {
      domain: 'water', // energy | water | temperature
      context: 'stores', // equipments | stores | hidrometro | etc.
      timestamp: Date.now(),
    },
  })
);
```

TELEMETRY widget listens and updates:

```javascript
window.addEventListener('myio:telemetry-config-change', (ev) => {
  WIDGET_DOMAIN = ev.detail.domain;
  WIDGET_CONTEXT = ev.detail.context;
  applyDomainTheme(WIDGET_DOMAIN);
  reflowCards();
});
```

---

## Reference-level Explanation

### New Widget: MAIN_UNIQUE_DATASOURCE

Located at: `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/`

**Structure:**

```
MAIN_UNIQUE_DATASOURCE/
├── base.json              # Widget definition
├── settingsSchema.json    # Configuration schema
├── controller.js          # Orchestrator logic
├── template.html          # Layout with single TELEMETRY container
├── styles.css             # Shared styles
└── dataKeySettings.json   # DataKey configuration for AllDevices
```

### ThingsBoard Datasource Configuration

**Single Datasource: `AllDevices`**

DataKeys required:

```
- deviceType
- deviceProfile
- identifier
- ingestionId
- connectionStatus
- lastActivityTime
- lastConnectTime
- lastDisconnectTime
- centralName
- ownerName
- assetName
- customerId
- consumption (energy)
- pulses (water)
- temperature (temperature)
- water_level (tank)
- water_percentage (tank)
```

### MyIOOrchestrator Enhancements

```javascript
// New method: Classify all devices from single datasource
MyIOOrchestrator.classifyAllDevices = function (ctxData) {
  const classified = {
    energy: { entry: [], common_area: [], stores: [] },
    water: { common_area: [], stores: [] },
    temperature: { with_climate_control: [], without_climate_control: [] },
  };

  ctxData.forEach((row) => {
    const device = extractDeviceMetadata(row);
    const domain = detectDomain(device);
    const context = detectContext(device, domain);

    classified[domain][context].push(device);
  });

  return classified;
};

// New method: Get devices for specific domain/context
MyIOOrchestrator.getDevices = function (domain, context) {
  const data = window.MyIOOrchestratorData?.classified;
  return data?.[domain]?.[context] || [];
};
```

### TELEMETRY Widget Updates

The existing TELEMETRY widget (created in previous session) already supports:

- `domain` setting: energy, water, temperature
- `context` setting: entry, common_area, stores, with_climate_control, without_climate_control
- Dynamic color theming per domain
- RFC-0110 device status calculation

**New capability needed**: Listen for runtime configuration changes

```javascript
// In TELEMETRY controller.js onInit():
window.addEventListener('myio:telemetry-config-change', (ev) => {
  const { domain, context } = ev.detail;

  // Update widget configuration
  WIDGET_DOMAIN = domain;
  WIDGET_CONTEXT = context;

  // Apply visual theme
  applyDomainTheme(domain);
  applyContextAttribute(context);

  // Get new data from orchestrator
  const devices = window.MyIOOrchestrator?.getDevices(domain, context) || [];
  STATE.allDevices = devices;

  // Re-render
  initializeCards(devices);
  updateHeader(devices);
});
```

### Template Structure

```html
<!-- MAIN_UNIQUE_DATASOURCE template.html -->
<div class="main-wrap" id="mainWrap">
  <!-- HEADER State -->
  <section id="headerSection">
    <tb-dashboard-state stateId="header"></tb-dashboard-state>
  </section>

  <!-- MENU State -->
  <section id="menuSection">
    <tb-dashboard-state stateId="menu"></tb-dashboard-state>
  </section>

  <!-- TELEMETRY (Single Dynamic Container) -->
  <section id="mainView">
    <tb-dashboard-state stateId="telemetry"></tb-dashboard-state>
  </section>

  <!-- FOOTER State -->
  <section id="footerSection">
    <tb-dashboard-state stateId="footer"></tb-dashboard-state>
  </section>
</div>
```

### Event Contracts

**Note**: "MENU" below refers to the library component (`createMenuComponent`), NOT the old MENU widget.

| Event Name                     | Dispatched By          | Listened By       | Payload                                          |
| ------------------------------ | ---------------------- | ----------------- | ------------------------------------------------ |
| `myio:telemetry-config-change` | Menu Component (lib)   | TELEMETRY         | `{ domain, context, timestamp }`                 |
| `myio:devices-classified`      | MAIN_UNIQUE_DATASOURCE | TELEMETRY, HEADER | `{ classified, timestamp }`                      |
| `myio:filter-applied`          | Menu Component (lib)   | TELEMETRY         | `{ selection: Customer[] }`                      |
| `myio:date-params`             | MAIN_UNIQUE_DATASOURCE | TELEMETRY         | `{ globalStartDateFilter, globalEndDateFilter }` |

---

## Drawbacks

1. **Breaking Change**: Requires new ThingsBoard dashboard configuration with `AllDevices` datasource
2. **Migration Effort**: Existing dashboards need datasource reconfiguration
3. **Single Point of Failure**: All data flows through one datasource
4. **Initial Load Size**: Larger initial payload (all devices at once)
5. **Backward Compatibility**: Old EQUIPMENTS/STORES/WATER widgets become deprecated

---

## Rationale and Alternatives

### Why Single Datasource?

**Advantages:**

- Unified device inventory at MAIN level
- Single metadata extraction pass
- Consistent device classification
- Simplified orchestrator logic
- Easier cross-domain queries (e.g., "all offline devices")

**Alternatives Considered:**

1. **Keep Multiple Datasources**: Rejected - maintains code duplication
2. **Merge Widgets Without Datasource Change**: Rejected - still requires multi-datasource coordination
3. **Server-Side Aggregation**: Rejected - requires API changes, adds latency

### Why Dynamic TELEMETRY Instead of Multiple Views?

**Current approach (RFC-0057):** Pre-render all view containers, show/hide based on state

**New approach:** Single TELEMETRY container, dynamic content based on domain/context

**Benefits:**

- Smaller DOM footprint
- Single widget to maintain
- Consistent rendering logic
- Faster state switches (no hidden pre-rendered widgets)

---

## Prior Art

- **RFC-0057**: State-based navigation without iframes (MYIO-SIM Welcome)
- **RFC-0079**: Menu navigation restructure
- **RFC-0110**: Device status main rule (telemetry-based offline detection)
- **TELEMETRY Widget**: Unified widget with domain/context configuration (this session)

---

## Unresolved Questions

1. **Performance**: How does single datasource performance compare to multiple smaller datasources?
2. **Pagination**: Should `AllDevices` support server-side pagination for large installations?
3. **Real-time Updates**: How to handle WebSocket subscriptions for mixed device types?
4. **Migration Path**: What is the upgrade path for existing dashboard installations?
5. **Caching Strategy**: Should classified data be persisted across page reloads?

---

## Future Possibilities

1. **Cross-Domain Search**: Search across all device types from single widget
2. **Unified Alerts Panel**: Show alerts from all domains in one view
3. **Device Comparison**: Compare devices across different domains
4. **Bulk Operations**: Apply actions to devices regardless of domain
5. **Custom Grouping**: User-defined device groups beyond domain/context
6. **Dashboard Templates**: Pre-configured layouts for different customer sizes

---

## Implementation Plan

### Phase 1: Datasource Configuration

1. Create `AllDevices` alias in ThingsBoard
2. Configure all required dataKeys
3. Test data availability

### Phase 2: MAIN_UNIQUE_DATASOURCE Widget

1. Create widget folder structure
2. Implement unified metadata extraction
3. Implement device classification logic
4. Add event dispatching for config changes

### Phase 3: TELEMETRY Widget Enhancement

1. Add runtime config change listener
2. Implement dynamic data fetching from orchestrator
3. Test all domain/context combinations

### Phase 4: Menu Component Integration (Library)

1. Ensure Menu component (library) dispatches `myio:telemetry-config-change` events
2. Map menu items to domain/context pairs in MAIN_UNIQUE_DATASOURCE
3. Test navigation flow between Menu and TELEMETRY widget

**Note**: This refers to `createMenuComponent` (library), NOT the old MENU widget

### Phase 5: Migration & Cleanup

1. Create migration guide for existing dashboards
2. Mark old widgets as deprecated
3. Update documentation

---

## Files to Create/Modify

### ⚠️ IMPORTANT: Legacy Files - DO NOT MODIFY

The following are from the **old architecture** and must NOT be modified:

- `src/MYIO-SIM/v5.2.0/MAIN/` - Old MAIN widget (keep untouched)
- `src/MYIO-SIM/v5.2.0/MENU/` - Old MENU widget (keep untouched, now a library component)

### Files to Create (New Widget)

| File                                         | Purpose                                              |
| -------------------------------------------- | ---------------------------------------------------- |
| `MAIN_UNIQUE_DATASOURCE/template.html`       | Layout with library component containers             |
| `MAIN_UNIQUE_DATASOURCE/controller.js`       | Orchestrator + device classification + library calls |
| `MAIN_UNIQUE_DATASOURCE/styles.css`          | Layout styles + panel modal styles                   |
| `MAIN_UNIQUE_DATASOURCE/settingsSchema.json` | Configuration (darkMode/lightMode, card colors)      |

### Files to Modify

| File                      | Change                                            |
| ------------------------- | ------------------------------------------------- |
| `TELEMETRY/controller.js` | Add `myio:telemetry-config-change` event listener |

**Note**: ThingsBoard auto-generates `base.json` and `dataKeySettings.json` when you create the widget.

---

## Appendix: Domain/Context Matrix

| Domain      | Context                 | Widget Replaced                     | Device Filter                             |
| ----------- | ----------------------- | ----------------------------------- | ----------------------------------------- |
| energy      | entry                   | EQUIPMENTS                          | `!isStoreDevice(device)`                  |
| energy      | common_area             | EQUIPMENTS                          | `!isStoreDevice(device)`                  |
| energy      | stores                  | STORES                              | `isStoreDevice(device)`                   |
| water       | common_area             | WATER_COMMON_AREA                   | `aliasName === 'HidrometrosAreaComum'`    |
| water       | stores                  | WATER_STORES                        | `aliasName === 'Todos Hidrometros Lojas'` |
| temperature | with_climate_control    | TEMPERATURE_SENSORS                 | `deviceType includes 'CLIMA'`             |
| temperature | without_climate_control | TEMPERATURE_WITHOUT_CLIMATE_CONTROL | `deviceType not includes 'CLIMA'`         |
