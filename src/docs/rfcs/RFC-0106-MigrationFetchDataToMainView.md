# RFC-0106: Migrate Data Fetching to MAIN_VIEW Orchestrator

- **Feature Name**: `centralized-telemetry-orchestrator`
- **Start Date**: 2025-12-18
- **RFC PR**: N/A
- **Authors**: MyIO Frontend Guild
- **Status**: Implemented
- **Related RFCs**: RFC-0042 (Main View Orchestrator), RFC-0056 (Inter-Widget Communication)

---

## Summary

This RFC proposes migrating all telemetry data fetching from individual TELEMETRY widgets to a centralized orchestrator in the MAIN_VIEW widget. Currently, each TELEMETRY widget (Entrada, Lojas, Área Comum, etc.) independently calls the `/api/v1/telemetry/customers/{customerId}/{domain}/devices/totals` endpoint. This RFC consolidates these calls into a single request orchestrated by MAIN_VIEW, which then distributes data to child widgets based on their `aliasName` and `labelWidget` configuration.

---

## Motivation

### Current Architecture Problems

The current architecture suffers from several inefficiencies:

1. **Redundant API Calls**: Each TELEMETRY widget instance calls `fetchApiTotals()` independently. For a typical energy dashboard with 3 columns (Entrada, Lojas, Área Comum), this results in 3 identical API calls to the same endpoint with the same parameters.

2. **Inconsistent Data States**: Since widgets fetch data independently, they may receive responses at different times, leading to temporary inconsistencies in displayed totals and device counts.

3. **Duplicated Business Logic**: Each widget contains its own implementation of:
   - Device classification logic
   - Value aggregation and percentage calculation
   - Error handling and retry logic
   - Cache management

4. **Complex Inter-Widget Coordination**: The current event-based system (`myio:telemetry:provide-data`) was designed as a workaround for data sharing, adding complexity without addressing the root cause.

5. **Maintenance Burden**: Bug fixes and feature enhancements must be applied to multiple widget controllers, increasing the risk of divergence.

### Evidence from Codebase

Current implementation in `TELEMETRY/controller.js`:

```javascript
// Line 1458: Each widget calls this independently
async function fetchApiTotals(startISO, endISO) {
  const url = new URL(`${DATA_API_HOST}/api/v1/telemetry/customers/${CUSTOMER_ING_ID}/energy/devices/totals`);
  // ... fetch logic duplicated in each widget instance
}
```

Widget configuration pattern:
- Widget "Entrada": `labelWidget = "Entrada"`, `domain = "energy"`
- Widget "Lojas": `labelWidget = "Lojas"`, `domain = "energy"`
- Widget "Área Comum": `labelWidget = "Área Comum"`, `domain = "energy"`

All three widgets call the same API endpoint, receiving the same 281+ devices, then filter locally.

### Goals

1. **Single API Call**: MAIN_VIEW makes one request per domain per time period
2. **Centralized Classification**: Device grouping logic lives in one place
3. **Consistent State**: All widgets receive data from the same source simultaneously
4. **Reduced Network Overhead**: Eliminate 66% of redundant API calls (3 → 1)
5. **Simplified Widget Logic**: TELEMETRY widgets become pure renderers

### Non-Goals

- Changing the Data Ingestion API contract
- Modifying ThingsBoard datasource configuration
- Rewriting card rendering components
- Changing the widget visual design

---

## Guide-level Explanation

### For Widget Developers

After this migration, TELEMETRY widgets will no longer fetch data directly. Instead, they will:

1. **Register with the Orchestrator**: On initialization, widgets register their `labelWidget` and `domain` with MAIN_VIEW
2. **Request Data**: Widgets call `window.MyIOOrchestrator.requestData(domain, labelWidget)`
3. **Receive Classified Data**: The orchestrator returns pre-filtered, pre-classified devices

**Before (Current)**:
```javascript
// In TELEMETRY widget
async function loadData() {
  const apiMap = await fetchApiTotals(startISO, endISO);  // Makes API call
  const myDevices = filterByGroup(apiMap, labelWidget);    // Local filtering
  renderCards(myDevices);
}
```

**After (Proposed)**:
```javascript
// In TELEMETRY widget
async function loadData() {
  const myDevices = await window.MyIOOrchestrator.getDevices(domain, labelWidget);
  renderCards(myDevices);  // Widget only renders
}
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          MAIN_VIEW                                   │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    MyIOOrchestrator                              ││
│  │  ┌─────────────────┐    ┌──────────────────────────────────────┐││
│  │  │  API Fetcher    │───▶│  Device Classifier                   │││
│  │  │  (single call)  │    │  - Entrada devices                   │││
│  │  └─────────────────┘    │  - Lojas devices                     │││
│  │                         │  - Área Comum devices                 │││
│  │                         │  - Climatização devices               │││
│  │                         │  - Other categories...                │││
│  │                         └──────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────┘│
│         │                    │                    │                  │
│         ▼                    ▼                    ▼                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│  │  TELEMETRY  │     │  TELEMETRY  │     │  TELEMETRY  │            │
│  │  (Entrada)  │     │  (Lojas)    │     │ (Área Comum)│            │
│  │             │     │             │     │             │            │
│  │  Render     │     │  Render     │     │  Render     │            │
│  │  Only       │     │  Only       │     │  Only       │            │
│  └─────────────┘     └─────────────┘     └─────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Reference-level Explanation

### Orchestrator API

The orchestrator will be exposed via `window.MyIOOrchestrator` with the following interface:

```typescript
interface MyIOOrchestrator {
  // Core data access
  fetchDomainData(domain: Domain, startISO: string, endISO: string): Promise<void>;
  getDevices(domain: Domain, labelWidget: string): EnrichedDevice[];
  getDevicesByCategory(domain: Domain, category: string): EnrichedDevice[];

  // Aggregations
  getTotalConsumption(domain: Domain, labelWidget?: string): number;
  getDeviceCount(domain: Domain, labelWidget?: string): number;
  getStatusBreakdown(domain: Domain): StatusSummary;

  // Cache management
  invalidateCache(domain?: Domain): void;
  getCacheKey(domain: Domain, startISO: string, endISO: string): string;

  // Event subscription
  onDataReady(domain: Domain, callback: (data: DomainData) => void): () => void;
  onError(callback: (error: Error) => void): () => void;

  // Configuration
  registerWidget(widgetId: string, domain: Domain, labelWidget: string): void;
  unregisterWidget(widgetId: string): void;
}

type Domain = 'energy' | 'water' | 'temperature';

interface EnrichedDevice {
  id: string;
  ingestionId: string;
  label: string;
  entityLabel: string;
  deviceIdentifier: string;
  value: number;
  deviceStatus: DeviceStatus;
  category: string;
  labelWidget: string;
}

type DeviceStatus = 'power_on' | 'power_off' | 'warning' | 'failure' |
                    'standby' | 'maintenance' | 'no_info' | 'offline';
```

### Device Classification Logic

The orchestrator will implement centralized classification based on `ctx.data` aliasName matching:

```javascript
function classifyDevices(rawDevices, datasources) {
  const classified = {
    entrada: [],
    lojas: [],
    areaComum: [],
    climatizacao: [],
    elevadores: [],
    escadasRolantes: [],
    outros: []
  };

  // Build ingestionId → labelWidget mapping from datasources
  const ingestionToLabel = new Map();
  datasources.forEach(ds => {
    const aliasName = ds.aliasName || ds.name;
    const labelWidget = deriveLabelWidget(aliasName);
    ds.devices?.forEach(d => {
      ingestionToLabel.set(d.ingestionId, labelWidget);
    });
  });

  // Classify each device
  rawDevices.forEach(device => {
    const labelWidget = ingestionToLabel.get(device.id) || 'outros';
    const category = deriveCategory(device, labelWidget);
    classified[category].push({
      ...device,
      labelWidget,
      category
    });
  });

  return classified;
}
```

### Datasource Configuration

MAIN_VIEW will aggregate datasources from all configured aliases:

```javascript
// MAIN_VIEW widget settings
const DATASOURCE_ALIASES = {
  energy: [
    'MedidoresEntrada',      // → labelWidget: 'Entrada'
    'TodosEquipamentos',     // → labelWidget: 'Área Comum' (filtered by category)
    'EquipamentosLojas'      // → labelWidget: 'Lojas'
  ],
  water: [
    'HidrometrosAreaComum',  // → labelWidget: 'Área Comum'
    'TodosHidrometrosLojas'  // → labelWidget: 'Lojas'
  ]
};
```

### Event System

The orchestrator will emit events for reactive widget updates:

```javascript
// Event types
const ORCHESTRATOR_EVENTS = {
  DATA_FETCHING: 'myio:orchestrator:fetching',
  DATA_READY: 'myio:orchestrator:data-ready',
  DATA_ERROR: 'myio:orchestrator:error',
  CACHE_HIT: 'myio:orchestrator:cache-hit',
  CACHE_INVALIDATED: 'myio:orchestrator:cache-invalidated'
};

// Event payload structure
interface DataReadyEvent {
  domain: Domain;
  timestamp: number;
  deviceCount: number;
  totalConsumption: number;
  cacheKey: string;
}
```

### Migration Path for TELEMETRY Widget

The TELEMETRY widget controller will be refactored:

**Remove**:
- `fetchApiTotals()` function
- `enrichItemsWithTotals()` function
- `filterByCategoryLabel()` function
- Local cache management
- Direct API calls

**Add**:
- Orchestrator registration in `onInit`
- Data request via `MyIOOrchestrator.getDevices()`
- Event listener for `DATA_READY` events

**Keep**:
- `renderCardComponentV5()` calls
- UI state management
- User interaction handlers

### Caching Strategy

```javascript
const CACHE_CONFIG = {
  TTL_MS: 5 * 60 * 1000,  // 5 minutes
  STORAGE_KEY_PREFIX: 'myio_orchestrator_',
  MAX_ENTRIES: 10         // Per domain
};

interface CacheEntry {
  key: string;
  data: EnrichedDevice[];
  timestamp: number;
  expiresAt: number;
}
```

Cache invalidation triggers:
1. Manual `invalidateCache()` call
2. Date range change from HEADER widget
3. TTL expiration
4. User refresh action

---

## Drawbacks

### 1. Migration Complexity

Refactoring all TELEMETRY widget instances requires careful coordination:
- Multiple widget files need updates
- Testing must cover all widget configurations
- Rollback strategy needed if issues arise

### 2. Single Point of Failure

Centralizing data fetching means MAIN_VIEW becomes critical:
- If orchestrator fails, all widgets fail
- Error recovery must be robust
- Fallback mechanisms may be needed

### 3. Memory Overhead

Storing all devices in MAIN_VIEW increases memory footprint:
- 281+ devices × multiple domains
- Classified copies for each widget group
- May impact low-memory devices

### 4. Timing Dependencies

Widgets depend on orchestrator initialization:
- Widgets must wait for `DATA_READY` event
- Loading states need coordination
- Race conditions possible during init

---

## Rationale and Alternatives

### Why This Approach?

1. **Proven Pattern**: MYIO-SIM already uses centralized orchestration successfully (see `MYIO-SIM/v5.2.0/MAIN/controller.js`)

2. **RFC-0042 Foundation**: This builds on the existing orchestrator infrastructure defined in RFC-0042

3. **Minimal UI Changes**: Widget rendering logic remains unchanged, only data source changes

### Alternatives Considered

#### Alternative A: Shared Service Worker

Use a Service Worker to intercept and cache API calls:

**Pros**:
- No widget changes needed
- Automatic deduplication at network level
- Works across browser tabs

**Cons**:
- Complex Service Worker lifecycle
- Browser compatibility concerns
- Harder to debug
- No control over classification logic

**Decision**: Rejected due to complexity and reduced control.

#### Alternative B: Backend Aggregation Endpoint

Create a new API endpoint that returns pre-classified data:

**Pros**:
- Simplest frontend implementation
- Server-side caching
- Reduced data transfer

**Cons**:
- Requires backend changes
- Coupling between frontend labels and API
- Harder to iterate on classification rules

**Decision**: Rejected due to backend dependency and flexibility concerns.

#### Alternative C: Keep Current Architecture with Deduplication

Add request deduplication at the API client level:

**Pros**:
- Minimal changes
- Widgets remain independent

**Cons**:
- Doesn't address duplicated logic
- Complex coordination
- Doesn't improve maintainability

**Decision**: Rejected as it doesn't address root causes.

---

## Prior Art

### MYIO-SIM Implementation

The `MYIO-SIM/v5.2.0/MAIN/controller.js` already implements centralized data fetching:

```javascript
// From MYIO-SIM MAIN controller
async function fetchEnergyDayConsumption(customerId, startTs, endTs, granularity = '1d') {
  const url = `${getDataApiHost()}/api/v1/telemetry/customers/${customerId}/energy/devices/totals/...`;
  // Single fetch, distributed to child widgets
}
```

This pattern has been validated in production and provides a reference implementation.

### ThingsBoard Native Orchestration

ThingsBoard's internal architecture uses a similar pattern where the main dashboard state manages data flow to child widgets. This RFC aligns with ThingsBoard's architectural principles.

### Industry Patterns

- **Redux/Flux**: Centralized state management is standard in React ecosystems
- **Apollo Client**: GraphQL clients normalize and cache data centrally
- **RxJS BehaviorSubject**: Angular applications often use centralized observables

---

## Unresolved Questions

### Before Implementation

1. **Graceful Degradation**: Should widgets have a fallback to direct API calls if orchestrator fails?

2. **Partial Updates**: How should the orchestrator handle partial data updates (e.g., single device refresh)?

3. **Cross-Tab Sync**: Should cache be shared across browser tabs via `BroadcastChannel`?

4. **Widget Loading Order**: How to handle widgets that initialize before MAIN_VIEW?

### During Implementation

5. **Performance Benchmarks**: What are acceptable latency thresholds for orchestrator operations?

6. **Memory Limits**: At what device count should pagination or virtualization be implemented?

7. **Error Boundaries**: How should classification errors for individual devices be handled?

### Post-Implementation

8. **Monitoring**: What metrics should be tracked for orchestrator health?

9. **Debugging Tools**: Should a debug panel be added for orchestrator state inspection?

---

## Future Possibilities

### Phase 2: Temperature Domain

Extend orchestrator to handle temperature sensors:
- Currently uses ThingsBoard datasources directly
- Future: Migrate to Data Ingestion API when available
- Unified interface across all domains

### Phase 3: Real-Time Updates

Implement WebSocket subscriptions for live data:
- Orchestrator manages WebSocket connections
- Push updates to widgets
- Reduce polling overhead

### Phase 4: Predictive Caching

Use usage patterns to pre-fetch data:
- Anticipate date range changes
- Pre-warm cache for likely next views
- ML-based prediction for power users

### Phase 5: Offline Support

Enable offline-first architecture:
- IndexedDB persistence
- Sync queue for offline changes
- Conflict resolution strategy

---

## Ready Components (No Changes Required)

The following components are **already compatible** with RFC-0106 and require no modifications:

### Library Tooltip Components

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| EnergySummaryTooltip | `src/utils/EnergySummaryTooltip.ts` | ✅ Ready | Accepts `deviceStatusAggregation` via `receivedData` |
| WaterSummaryTooltip | `src/utils/WaterSummaryTooltip.ts` | ✅ Ready | Accepts `deviceStatusAggregation` via `receivedData` |

These components implement RFC-0105 patterns:
- Primary: Use `receivedData.deviceStatusAggregation` from widget controller
- Fallback: Direct `MyIOOrchestratorData` access (for iframe scenarios)
- Consistency: Use orchestrator item count as source of truth for `totalDevices`

### Interface Contract

The tooltip `buildSummaryFromState()` interface remains stable:

```typescript
// EnergySummaryTooltip
buildSummaryFromState(state: any, receivedData: any, domain: string = 'energy'): DashboardEnergySummary

// WaterSummaryTooltip
buildSummaryFromState(state: any, receivedData: any, includeBathrooms: boolean, domain: string = 'water'): DashboardWaterSummary

// receivedData can contain:
interface ReceivedData {
  deviceStatusAggregation?: {
    hasData: boolean;
    normal: number;
    alert: number;
    failure: number;
    standby: number;
    offline: number;
    noConsumption: number;
    normalDevices: DeviceInfo[];
    alertDevices: DeviceInfo[];
    failureDevices: DeviceInfo[];
    standbyDevices: DeviceInfo[];
    offlineDevices: DeviceInfo[];
    noConsumptionDevices: DeviceInfo[];
  };
  // ... other fields
}
```

When RFC-0106 is implemented, the widget controller will:
1. Get devices from `MyIOOrchestrator.getDevices(domain, labelWidget)`
2. Aggregate device status using existing `aggregateDeviceStatusFromOrchestrator()` function
3. Pass aggregation to tooltip via `receivedData.deviceStatusAggregation`

No changes to the library components are needed.

---

## Implementation Plan

### Phase 1: Orchestrator Core

- [ ] Implement `MyIOOrchestrator` class in MAIN_VIEW
- [ ] Add `fetchDomainData()` with caching
- [ ] Implement device classification logic
- [ ] Add event emission system
- [ ] Unit tests for orchestrator

### Phase 2: Widget Migration (Week 3-4)

- [ ] Refactor TELEMETRY controller to use orchestrator
- [ ] Update widget initialization sequence
- [ ] Remove deprecated `fetchApiTotals()` calls
- [ ] Integration tests for data flow

### Phase 3: TELEMETRY_INFO Migration (Week 5)

- [ ] Update summary tooltip data source
- [ ] Migrate device status aggregation
- [ ] Update `buildSummaryFromState()` to use orchestrator

> **Note**: The library tooltip components (`EnergySummaryTooltip.ts` and `WaterSummaryTooltip.ts`) are **already prepared** for this migration:
> - They accept `deviceStatusAggregation` via `receivedData` parameter
> - They have fallback to direct `MyIOOrchestratorData` access
> - They use orchestrator item count as source of truth for `totalDevices`
>
> These components require **no changes** - only the widget controller needs to update its data source from `fetchApiTotals()` to `MyIOOrchestrator.getDevices()`.

### Phase 4: Validation & Cleanup (Week 6)

- [ ] End-to-end testing
- [ ] Performance benchmarking
- [ ] Documentation updates
- [ ] Code cleanup and removal of deprecated functions

---

## References

- [RFC-0042: MAIN_VIEW Orchestrator](./RFC-0042-main-view-orchestrator-shopping-shell.md)
- [RFC-0056: Inter-Widget Communication](./RFC-0056-FIX-inter-widget-communication-plan.md)
- [RFC-0105: Summary Tooltip Device Status](./RFC-0105-*.md) *(device status aggregation)*
- [MYIO-SIM MAIN Controller](../../MYIO-SIM/v5.2.0/MAIN/controller.js)
- [TELEMETRY Controller](../../thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js)
- [TELEMETRY_INFO Controller](../../thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/controller.js)
- [EnergySummaryTooltip](../../utils/EnergySummaryTooltip.ts) *(already prepared for RFC-0106)*
- [WaterSummaryTooltip](../../utils/WaterSummaryTooltip.ts) *(already prepared for RFC-0106)*
- [Data Ingestion API Documentation](https://api.data.apps.myio-bas.com/docs)
