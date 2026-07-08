# RFC-0070: Implement Water Tank Modal Component (TANK/CAIXA_DAGUA)

- **RFC**: 0070
- **Title**: Implement Water Tank Modal Component for v5 Card Rendering
- **Authors**: MyIO Frontend Guild
- **Status**: Draft
- **Created**: 2025-01-05
- **Target Version**: next minor of the library

## Related Components

- `src/components/premium-modals/energy/openDashboardPopupEnergy.ts` (reference pattern)
- `src/components/premium-modals/water-tank/` (to be created)
- `src/thingsboard/main-dashboard-shopping/v-5.2.0/card/template-card-v5.js`
- `src/thingsboard/main-dashboard-shopping/v.3.6.0/WIDGET/WATER/controller.js` (reference implementation)

## Summary

We are proposing a new reusable, library-level modal `openDashboardPopupWaterTank` that:

- Shows water tank level detail (chart + KPIs) for TANK/CAIXA_DAGUA device types
- **Does NOT fetch data from Ingestion API** (unlike energy modals)
- Fetches telemetry data directly from **ThingsBoard REST API**
- Displays water level charts with percentage-based visualization
- Shows real-time tank status with color-coded imagery (critical/low/medium/full)
- Reuses design patterns from `openDashboardPopupEnergy` and `AllReportModal`
- Implements proper authentication flow without localStorage dependencies

## Motivation

### Current State Problems

1. **Inconsistent Water Tank Handling**: The existing v.3.6.0 WATER widget (`openDashboardPopupWater`) has a specialized implementation that is tightly coupled to widget context and uses ThingsBoard telemetry API, but this pattern is not available in the v5 card rendering system.

2. **deviceType Gap in v5**: The v5 card component (`template-card-v5.js`) currently handles energy devices well through `openDashboardPopupEnergy`, but lacks equivalent handling for `TANK` and `CAIXA_DAGUA` device types.

3. **Different Data Source Architecture**: Water tank data comes from ThingsBoard telemetry (sensor readings), not from aggregated consumption data in the Ingestion API. This requires a fundamentally different data fetching strategy.

4. **Unique Visualization Requirements**: Water tanks require:
   - Percentage-based level indicators (0-100%)
   - Visual tank imagery showing fill level
   - MCA (meters of water column) measurements
   - Different alert thresholds (critical < 20%, low < 40%, medium < 70%, full ≥ 70%)

### Goals

- **Dedicated Water Tank Modal**: Create `openDashboardPopupWaterTank` following RFC-0026 patterns
- **ThingsBoard Native**: Fetch data exclusively from ThingsBoard telemetry REST API
- **Percentage-Based Visualization**: Display tank levels as percentages with appropriate imagery
- **No Ingestion API Dependency**: Unlike energy modals, this component should not call Ingestion API
- **v5 Card Integration**: Enable `template-card-v5.js` to seamlessly open water tank modals
- **Reusable Component**: Library-level component callable from any widget or dashboard

### Non-Goals

- No Ingestion API integration (water tanks don't use aggregated consumption data)
- No CSV export of raw consumption data (focus on current level monitoring)
- No historical comparison features (can be added in future RFC if needed)
- No complex interval aggregation (display real-time or recent telemetry)

## Guide-Level Explanation

### Problem Solved

The `openDashboardPopupWaterTank` API solves the problem of displaying real-time water tank level monitoring for TANK and CAIXA_DAGUA devices. It provides a unified interface for:

- Fetching water level telemetry from ThingsBoard
- Displaying tank level visualization with percentage indicators
- Showing tank status with color-coded imagery
- Handling authentication and error states consistently
- Integrating seamlessly with v5 card rendering system

### Developer Usage

```typescript
// Basic usage with required parameters
MyIOLibrary.openDashboardPopupWaterTank({
  deviceId: 'DEVICE_UUID',
  deviceType: 'CAIXA_DAGUA',
  tbJwtToken: myTbToken,
  startTs: Date.now() - 86400000, // Last 24 hours
  endTs: Date.now(),
});

// Full configuration
MyIOLibrary.openDashboardPopupWaterTank({
  deviceId: 'DEVICE_UUID',
  deviceType: 'TANK',
  label: 'Caixa Superior',
  tbJwtToken: myTbToken,
  startTs: startDate.getTime(),
  endTs: endDate.getTime(),
  timezone: 'America/Sao_Paulo',
  tbBaseUrl: 'https://dashboard.myio-bas.com',
  onOpen: (ctx) => console.log('Tank modal opened', ctx),
  onClose: () => console.log('Tank modal closed'),
  theme: 'light'
});

// Integration with v5 card
// In template-card-v5.js handleActionDashboard:
if (deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA') {
  await MyIOLibrary.openDashboardPopupWaterTank({
    deviceId: entityId,
    deviceType: deviceType,
    label: labelOrName,
    tbJwtToken: jwtToken,
    startTs: self.ctx.$scope.startTs,
    endTs: self.ctx.$scope.endTs,
    currentLevel: val, // Current percentage
    timezone: self.ctx.timeWindow.timezone
  });
} else {
  // Existing energy modal
  await MyIOLibrary.openDashboardPopupEnergy({...});
}
```

### Modal Lifecycle

1. **Parameter Validation**: Validates deviceId, deviceType, tbJwtToken, timestamps
2. **Entity Fetch**: Retrieves device information and attributes from ThingsBoard
3. **Telemetry Query**: Fetches water level telemetry data using ThingsBoard REST API
4. **Status Calculation**: Determines tank status (critical/low/medium/full) based on percentage
5. **UI Rendering**: Displays modal with tank visualization and current level
6. **Chart Rendering**: Renders time-series chart of water levels
7. **Real-time Updates**: (Optional) Subscribe to WebSocket updates for live data
8. **Cleanup**: Properly disposes of resources, subscriptions, and event listeners

### Visual Design

The modal should display:

**Header Section:**
- Tank icon with current fill level visualization
- Device label/name
- Current percentage (large, prominent)
- Status indicator (color-coded badge)

**Main Content:**
- Tank image (changes based on level):
  - Critical (< 20%): Red/empty tank
  - Low (20-40%): Orange/quarter-full
  - Medium (40-70%): Yellow/half-full
  - Full (≥ 70%): Green/full tank
- Current measurement in MCA (meters of water column)
- Time-series chart showing level changes
- Last update timestamp

**Footer Section:**
- Settings button (open settings modal)
- Close button
- (Optional) Refresh button for manual updates

## Reference-Level Explanation

### Public API

```typescript
export function openDashboardPopupWaterTank(
  options: OpenDashboardPopupWaterTankOptions
): { close: () => void };

export interface OpenDashboardPopupWaterTankOptions {
  // Identity / Context (REQUIRED)
  deviceId: string;                    // TB device UUID
  deviceType: 'TANK' | 'CAIXA_DAGUA'; // Device type identifier
  tbJwtToken: string;                  // REQUIRED for TB REST API

  // Time Range (REQUIRED)
  startTs: number;                     // Timestamp in milliseconds
  endTs: number;                       // Timestamp in milliseconds

  // Optional Display Information
  label?: string;                      // Display label (fallback to TB entity label)
  currentLevel?: number;               // Current level percentage (0-100)

  // Optional Entity Information
  slaveId?: number | string;           // Device slave ID
  centralId?: string;                  // Gateway/central ID
  ingestionId?: string;                // Ingestion system identifier

  // Endpoints / Environment
  tbBaseUrl?: string;                  // default: current origin
  timezone?: string;                   // default: "America/Sao_Paulo"
  theme?: 'light' | 'dark';            // default: 'light'

  // Behavior Configuration
  closeOnEsc?: boolean;                // default: true
  enableRealTimeUpdates?: boolean;     // default: false (WebSocket subscription)
  refreshInterval?: number;            // Polling interval in ms (if not using WebSocket)
  zIndex?: number;                     // default: 10000

  // Callbacks
  onOpen?: (context: WaterTankModalContext) => void;
  onClose?: () => void;
  onError?: (error: WaterTankError) => void;
  onLevelUpdate?: (level: number, timestamp: number) => void;
}

export interface WaterTankModalContext {
  deviceId: string;
  label: string;
  currentLevel: number;
  status: 'critical' | 'low' | 'medium' | 'full';
  lastUpdate: number;
  attributes: Record<string, any>;
}

export interface WaterTankError {
  code: 'AUTH_ERROR' | 'FETCH_ERROR' | 'INVALID_DATA' | 'NETWORK_ERROR';
  message: string;
  details?: any;
}
```

### ThingsBoard API Integration

Unlike energy modals that use the Ingestion API, this component uses ThingsBoard's native telemetry API:

#### 1. Entity Information
```http
GET /api/device/{deviceId}
Headers:
  X-Authorization: Bearer {tbJwtToken}
```

#### 2. Server Attributes
```http
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/attributes?scope=SERVER_SCOPE
Headers:
  X-Authorization: Bearer {tbJwtToken}
```

#### 3. Telemetry Data (Time-Series)
```http
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries
Query Parameters:
  keys=waterLevel,percentage,mca (or device-specific keys)
  startTs={startTimestamp}
  endTs={endTimestamp}
  interval={interval} (e.g., 3600000 for 1 hour)
  agg=AVG (aggregation function)
Headers:
  X-Authorization: Bearer {tbJwtToken}
```

#### 4. Latest Telemetry (Current Value)
```http
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries?keys=percentage
Headers:
  X-Authorization: Bearer {tbJwtToken}
```

#### 5. WebSocket Subscription (Optional)
```typescript
// Subscribe to real-time updates
const ws = new WebSocket(`wss://${tbHost}/api/ws/plugins/telemetry?token=${tbJwtToken}`);
ws.send(JSON.stringify({
  tsSubCmds: [{
    entityType: "DEVICE",
    entityId: deviceId,
    scope: "LATEST_TELEMETRY",
    cmdId: 1
  }],
  historyCmds: [],
  attrSubCmds: []
}));
```

### Data Processing

#### Level Calculation
```typescript
function calculateTankStatus(percentage: number): TankStatus {
  if (percentage < 20) return 'critical';
  if (percentage < 40) return 'low';
  if (percentage < 70) return 'medium';
  return 'full';
}

function getTankImageUrl(status: TankStatus): string {
  const imageMap = {
    critical: '/api/images/public/qLdwhV4qw295poSCa7HinpnmXoN7dAPO',
    low: '/api/images/public/aB9nX28F54fBBQs1Ht8jKUdYAMcq9QSm',
    medium: '/api/images/public/4UBbShfXCVWR9wcw6IzVMNran4x1EW5n',
    full: '/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq'
  };
  return imageMap[status];
}
```

#### Chart Data Transformation
```typescript
interface TelemetryDataPoint {
  ts: number;
  value: string | number;
}

function transformToChartData(
  telemetry: Record<string, TelemetryDataPoint[]>
): ChartDataPoint[] {
  const percentageData = telemetry.percentage || [];
  return percentageData.map(point => ({
    timestamp: point.ts,
    value: typeof point.value === 'string' ? parseFloat(point.value) : point.value,
    label: new Date(point.ts).toLocaleString('pt-BR')
  }));
}
```

### Component Architecture

```
src/components/premium-modals/water-tank/
├── openDashboardPopupWaterTank.ts       # Main entry point
├── WaterTankModalController.ts          # Business logic & state management
├── WaterTankModalView.ts                # UI rendering
├── WaterTankTelemetryFetcher.ts         # ThingsBoard API client
├── WaterTankChartRenderer.ts            # Chart visualization
├── types.ts                             # TypeScript interfaces
└── README.md                            # Component documentation
```

### Implementation Plan

#### Phase 1: Core Infrastructure (Week 1)
- [ ] Create component directory structure
- [ ] Define TypeScript interfaces in `types.ts`
- [ ] Implement `WaterTankTelemetryFetcher` for ThingsBoard API calls
- [ ] Add unit tests for data fetching and transformation

#### Phase 2: UI Components (Week 2)
- [ ] Implement `WaterTankModalView` with HTML/CSS
- [ ] Create tank visualization with status-based imagery
- [ ] Add responsive layout and mobile support
- [ ] Implement accessibility features (ARIA, keyboard navigation)

#### Phase 3: Chart Integration (Week 2-3)
- [ ] Implement `WaterTankChartRenderer` using Chart.js or similar
- [ ] Add time-series visualization for water levels
- [ ] Implement zoom, pan, and tooltip interactions
- [ ] Add loading states and empty state handling

#### Phase 4: Controller & Lifecycle (Week 3)
- [ ] Implement `WaterTankModalController` for state management
- [ ] Add modal lifecycle methods (open, close, update)
- [ ] Implement error handling and retry logic
- [ ] Add callback hooks (onOpen, onClose, onError)

#### Phase 5: Integration (Week 4)
- [ ] Create main entry point `openDashboardPopupWaterTank`
- [ ] Update `template-card-v5.js` to handle TANK/CAIXA_DAGUA types
- [ ] Add to library exports in `src/index.ts`
- [ ] Write integration tests

#### Phase 6: Optional Features (Week 5)
- [ ] WebSocket real-time updates
- [ ] Polling for periodic data refresh
- [ ] Settings modal integration
- [ ] Alert threshold indicators

#### Phase 7: Documentation & Release (Week 5-6)
- [ ] Write comprehensive README with examples
- [ ] Add JSDoc comments to all public APIs
- [ ] Create usage examples in docs
- [ ] Update library changelog
- [ ] Publish beta version for testing

## Comparison: Energy vs Water Tank Modals

| Feature | Energy Modal | Water Tank Modal |
|---------|-------------|------------------|
| **Data Source** | Ingestion API | ThingsBoard Telemetry API |
| **Authentication** | Ingestion Token OR ClientId/Secret | ThingsBoard JWT only |
| **Data Type** | Aggregated consumption (kWh) | Real-time sensor readings (%) |
| **Time Series** | Daily/hourly aggregates | Raw telemetry time-series |
| **Visualization** | Bar/line charts, totals | Level indicator, tank image |
| **Export** | CSV download | (Not initially required) |
| **Comparison** | Period-over-period | (Not initially required) |
| **Real-time** | No | Optional (WebSocket) |

## Security Considerations

1. **No localStorage Access**: Component must receive `tbJwtToken` via parameters
2. **Token Validation**: Validate JWT before making API calls
3. **CORS Headers**: Ensure ThingsBoard API allows cross-origin requests
4. **XSS Protection**: Sanitize all user-provided content and labels
5. **Rate Limiting**: Implement exponential backoff for failed requests
6. **WebSocket Security**: Use secure WebSocket (wss://) and validate messages

## Testing Strategy

### Unit Tests
- Data fetching and transformation logic
- Status calculation (critical/low/medium/full)
- Chart data transformation
- Error handling and retry logic

### Integration Tests
- Mock ThingsBoard API responses
- Test modal lifecycle (open → load → close)
- Test WebSocket subscription and updates
- Test error states and recovery

### E2E Tests
- Test from v5 card click → modal opens → data loads
- Test with different device types (TANK vs CAIXA_DAGUA)
- Test with various date ranges
- Test responsive behavior on different screen sizes

## Migration Path

### For Existing v3.6.0 WATER Widget Users

The existing `openDashboardPopupWater` function in v3.6.0 WATER widget can be gradually migrated to use the new library component:

**Before (Widget-Specific):**
```javascript
await openDashboardPopupWater(
  entityId,
  entityType,
  entitySlaveId,
  entityCentralId,
  entityLabel,
  entityConsumption,
  percent
);
```

**After (Library Component):**
```javascript
await MyIOLibrary.openDashboardPopupWaterTank({
  deviceId: entityId,
  deviceType: entityType,
  label: entityLabel,
  currentLevel: percent,
  tbJwtToken: jwtToken,
  startTs: startTs.getTime(),
  endTs: endTs.getTime()
});
```

### For v5 Card Integration

```javascript
// In template-card-v5.js - handleActionDashboard
const handleActionDashboard = async () => {
  const jwtToken = localStorage.getItem("jwt_token");

  // Route based on device type
  if (deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA') {
    await MyIOLibrary.openDashboardPopupWaterTank({
      deviceId: entityId,
      deviceType: deviceType,
      label: labelOrName,
      currentLevel: perc,
      tbJwtToken: jwtToken,
      startTs: self.ctx.$scope.startTs,
      endTs: self.ctx.$scope.endTs
    });
  } else {
    // Existing energy modal for other device types
    await MyIOLibrary.openDashboardPopupEnergy({
      deviceId: entityId,
      // ... other params
    });
  }
};
```

## Future Enhancements

The following features could be added in future RFCs:

1. **Historical Analysis**: Compare tank levels across different time periods
2. **Predictive Alerts**: Estimate time until empty/full based on usage patterns
3. **Multi-Tank View**: Display multiple tanks in a single modal
4. **CSV Export**: Export historical level data
5. **Mobile App Integration**: Deep linking from mobile apps
6. **Offline Support**: Cache recent data for offline viewing
7. **Advanced Filtering**: Filter by time of day, weekday/weekend
8. **Alert Configuration**: Set custom thresholds directly in modal

## Open Questions

1. **Chart Library**: Should we use Chart.js, ApexCharts, or a custom solution?
2. **Real-time Updates**: Should WebSocket subscription be enabled by default?
3. **Data Retention**: How far back should we allow date range selection?
4. **Mobile Optimization**: Should we have a dedicated mobile layout?
5. **Accessibility**: What WCAG level should we target (A, AA, or AAA)?

## Alternatives Considered

### Alternative 1: Extend Energy Modal
**Pros**: Reuse existing infrastructure
**Cons**: Energy and tank data have fundamentally different structures; would add complexity

### Alternative 2: Keep in Widget Layer
**Pros**: Simpler initial implementation
**Cons**: Code duplication across widgets; not reusable

### Alternative 3: Create Generic Telemetry Modal
**Pros**: Could handle any telemetry type
**Cons**: Too generic; loses domain-specific optimizations

**Decision**: Proceed with dedicated water tank modal (this RFC)

## References

- [RFC-0026: openDashboardPopupEnergy](./RFC-0026-openDashboardPopupEnergy.md)
- [ThingsBoard REST API Documentation](https://thingsboard.io/docs/reference/rest-api/)
- [ThingsBoard WebSocket API](https://thingsboard.io/docs/user-guide/telemetry/#websocket-api)
- Existing implementation: `src/thingsboard/main-dashboard-shopping/v.3.6.0/WIDGET/WATER/controller.js`

## Changelog

- 2025-01-05: Initial draft created
