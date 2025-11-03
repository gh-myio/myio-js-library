# RFC-0061: Telemetry Key Selection for Demand Modal Component

- **Feature Name:** `demand_modal_telemetry_key_selection`
- **Start Date:** 2025-11-04
- **RFC PR:** N/A
- **Component:** `DemandModal.ts`
- **Status:** Proposed

## Summary

This RFC proposes adding a telemetry key selector to the Demand Modal component (`openDemandModal`), allowing users to dynamically switch between different telemetry types (Power A/B/C, Current A/B/C, Voltage A/B/C, and Total Power) without closing and reopening the modal. This enhancement will provide a more flexible and user-friendly experience when analyzing device telemetry data.

## Motivation

### Current State

Currently, the `openDemandModal` function accepts a fixed `telemetryQuery` parameter that determines which telemetry keys to fetch and display. Once the modal is open, users cannot change the telemetry type being visualized without closing the modal and reopening it with different parameters.

```typescript
MyIOLibrary.openDemandModal({
  token: jwtToken,
  deviceId: '123-456-789',
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  label: 'Device Name',
  telemetryQuery: {
    keys: 'consumption',  // Fixed - cannot be changed
    intervalType: 'MILLISECONDS',
    interval: 86400000,
    agg: 'MAX',
    limit: 10000
  }
});
```

### Problems with Current Approach

1. **Poor User Experience:** Users must close and reopen the modal to view different telemetry types
2. **Loss of Context:** Date range and other settings are lost when reopening
3. **Performance:** Multiple modal instances increase memory usage
4. **Limited Exploration:** Difficult to compare different telemetry types side-by-side

### Why This Change?

This enhancement addresses these issues by:
- Providing an in-modal dropdown to switch telemetry types
- Maintaining date range and other settings when switching
- Enabling faster data exploration
- Improving overall user experience

## Guide-level Explanation

### User Perspective

When a user opens the Demand Modal, they will see a new dropdown selector positioned prominently in the modal header (next to the date range picker). This selector allows them to choose between different telemetry types:

**Available Options:**

| Display Name | Internal Keys | Description |
|--------------|--------------|-------------|
| **Total Power** (default) | `consumption` | Aggregate power consumption |
| **Power A, B, C** | `a`, `b`, `c` | Three-phase power readings |
| **Current A, B, C** | `current_a`, `current_b`, `current_c` | Three-phase current readings |
| **Voltage A, B, C** | `voltage_a`, `voltage_b`, `voltage_c` | Three-phase voltage readings |

### User Flow

1. User opens Demand Modal with default telemetry type (Total Power or as specified in `telemetryQuery.keys`)
2. User sees current telemetry data displayed in a chart
3. User clicks the telemetry selector dropdown
4. User selects a different telemetry type (e.g., "Current A, B, C")
5. Modal shows a loading state
6. New API call is made with the selected keys
7. Chart re-renders with the new data
8. Date range and other settings are preserved

### Example Usage

```typescript
// Opening with default (Total Power)
MyIOLibrary.openDemandModal({
  token: jwtToken,
  deviceId: '123-456-789',
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  label: 'Device Name',
  telemetryQuery: {
    keys: 'consumption',  // Default selected
    intervalType: 'MILLISECONDS',
    interval: 86400000,
    agg: 'MAX',
    limit: 10000
  }
});

// Opening with pre-selected telemetry type
MyIOLibrary.openDemandModal({
  token: jwtToken,
  deviceId: '123-456-789',
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  label: 'Device Name',
  telemetryQuery: {
    keys: 'current_a,current_b,current_c',  // Pre-select Current A,B,C
    intervalType: 'MILLISECONDS',
    interval: 86400000,
    agg: 'AVG',  // Different aggregation for current
    limit: 10000
  }
});
```

## Reference-level Explanation

### Architecture Changes

#### 1. New Type Definitions

```typescript
/**
 * Telemetry type configuration
 */
interface TelemetryType {
  id: string;
  label: string;
  keys: string | string[];
  defaultAggregation?: 'AVG' | 'MAX' | 'MIN' | 'SUM';
  unit?: string;
  color?: string | string[];  // For multi-phase data
}

/**
 * Available telemetry types
 */
const TELEMETRY_TYPES: Record<string, TelemetryType> = {
  total_power: {
    id: 'total_power',
    label: 'Total Power',
    keys: 'consumption',
    defaultAggregation: 'MAX',
    unit: 'kW',
    color: '#4A148C'
  },
  power_phases: {
    id: 'power_phases',
    label: 'Power A, B, C',
    keys: ['a', 'b', 'c'],
    defaultAggregation: 'MAX',
    unit: 'kW',
    color: ['#FF5722', '#4CAF50', '#2196F3']
  },
  current_phases: {
    id: 'current_phases',
    label: 'Current A, B, C',
    keys: ['current_a', 'current_b', 'current_c'],
    defaultAggregation: 'AVG',
    unit: 'A',
    color: ['#FF5722', '#4CAF50', '#2196F3']
  },
  voltage_phases: {
    id: 'voltage_phases',
    label: 'Voltage A, B, C',
    keys: ['voltage_a', 'voltage_b', 'voltage_c'],
    defaultAggregation: 'AVG',
    unit: 'V',
    color: ['#FF5722', '#4CAF50', '#2196F3']
  }
};
```

#### 2. Component State

```typescript
class DemandModal {
  private currentTelemetryType: TelemetryType;
  private originalTelemetryQuery: DemandModalTelemetryQuery;

  constructor(params: DemandModalParams) {
    // Detect initial telemetry type from keys
    this.currentTelemetryType = this.detectTelemetryType(params.telemetryQuery.keys);
    this.originalTelemetryQuery = params.telemetryQuery;
  }

  private detectTelemetryType(keys: string): TelemetryType {
    // Map incoming keys to telemetry type
    const keyStr = Array.isArray(keys) ? keys.join(',') : keys;

    for (const type of Object.values(TELEMETRY_TYPES)) {
      const typeKeys = Array.isArray(type.keys) ? type.keys.join(',') : type.keys;
      if (typeKeys === keyStr) {
        return type;
      }
    }

    // Default to total_power
    return TELEMETRY_TYPES.total_power;
  }
}
```

#### 3. UI Implementation

**HTML Structure:**

```html
<div class="myio-demand-modal-header">
  <h2 class="myio-demand-modal-title">
    Instantaneous Telemetry - ${deviceLabel}
  </h2>

  <div class="myio-demand-controls">
    <!-- Date Range Picker -->
    <div class="myio-form-group">
      <label for="demand-date-range">Period</label>
      <input type="text" id="demand-date-range" class="myio-input" readonly>
    </div>

    <!-- NEW: Telemetry Type Selector -->
    <div class="myio-form-group">
      <label for="telemetry-type-select">Telemetry Type</label>
      <select id="telemetry-type-select" class="myio-select">
        <option value="total_power" selected>Total Power</option>
        <option value="power_phases">Power A, B, C</option>
        <option value="current_phases">Current A, B, C</option>
        <option value="voltage_phases">Voltage A, B, C</option>
      </select>
    </div>

    <button id="demand-load-btn" class="myio-btn myio-btn-primary">
      Load
    </button>
  </div>
</div>
```

**CSS Styles:**

```css
.myio-select {
  padding: 8px 32px 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white url('data:image/svg+xml;utf8,<svg>...</svg>') no-repeat right 8px center;
  background-size: 16px;
  cursor: pointer;
  min-width: 180px;
}

.myio-select:focus {
  outline: none;
  border-color: #4A148C;
  box-shadow: 0 0 0 3px rgba(74, 20, 140, 0.1);
}

.myio-select:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}
```

#### 4. Event Handling

```typescript
private setupTelemetryTypeSelector(): void {
  const selector = document.getElementById('telemetry-type-select') as HTMLSelectElement;

  if (!selector) return;

  // Set initial value
  selector.value = this.currentTelemetryType.id;

  // Handle changes
  selector.addEventListener('change', async (e) => {
    const newTypeId = (e.target as HTMLSelectElement).value;
    const newType = TELEMETRY_TYPES[newTypeId];

    if (!newType) return;

    await this.switchTelemetryType(newType);
  });
}

private async switchTelemetryType(newType: TelemetryType): Promise<void> {
  try {
    // Show loading state
    this.showLoading();

    // Update current type
    this.currentTelemetryType = newType;

    // Build new telemetry query
    const newQuery: DemandModalTelemetryQuery = {
      ...this.originalTelemetryQuery,
      keys: Array.isArray(newType.keys) ? newType.keys.join(',') : newType.keys,
      agg: newType.defaultAggregation || this.originalTelemetryQuery.agg
    };

    // Fetch new data
    const data = await this.fetchTelemetryData(newQuery);

    // Re-render chart
    this.renderChart(data, newType);

    // Hide loading
    this.hideLoading();

  } catch (error) {
    console.error('[DemandModal] Error switching telemetry type:', error);
    this.showError('Failed to load telemetry data: ' + error.message);
    this.hideLoading();
  }
}
```

#### 5. Chart Rendering Adaptations

```typescript
private renderChart(data: TelemetryData[], type: TelemetryType): void {
  const chartContainer = document.getElementById('demand-chart-container');

  if (!chartContainer) return;

  // Determine if single or multi-series chart
  const isMultiSeries = Array.isArray(type.keys);

  if (isMultiSeries) {
    // Render multi-series chart (A, B, C phases)
    this.renderMultiSeriesChart(data, type);
  } else {
    // Render single-series chart (Total Power)
    this.renderSingleSeriesChart(data, type);
  }
}

private renderMultiSeriesChart(data: TelemetryData[], type: TelemetryType): void {
  const series = (type.keys as string[]).map((key, index) => ({
    name: `Phase ${key.toUpperCase().replace(/[^ABC]/g, '')}`,
    data: data.map(d => ({
      x: new Date(d.timestamp).getTime(),
      y: d[key] || 0
    })),
    color: Array.isArray(type.color) ? type.color[index] : type.color
  }));

  const options = {
    chart: {
      type: 'line',
      height: 400
    },
    series: series,
    xaxis: {
      type: 'datetime'
    },
    yaxis: {
      title: {
        text: type.unit || ''
      }
    },
    title: {
      text: type.label,
      align: 'left'
    },
    legend: {
      position: 'top'
    }
  };

  const chart = new ApexCharts(chartContainer, options);
  chart.render();
}
```

### API Contract Changes

#### Before (Current)

```typescript
interface DemandModalParams {
  token: string;
  deviceId: string;
  startDate: string;
  endDate: string;
  label?: string;
  telemetryQuery: {
    keys: string;  // Fixed at modal creation
    intervalType?: string;
    interval?: number;
    agg?: string;
    limit?: number;
  };
  // ... other params
}
```

#### After (Proposed)

```typescript
interface DemandModalParams {
  token: string;
  deviceId: string;
  startDate: string;
  endDate: string;
  label?: string;
  telemetryQuery: {
    keys: string;  // Still sets initial selection
    intervalType?: string;
    interval?: number;
    agg?: string;
    limit?: number;
  };
  // NEW: Optional configuration
  allowTelemetrySwitch?: boolean;  // Default: true
  availableTelemetryTypes?: string[];  // Default: all types
  // ... other params
}
```

**Backward Compatibility:** Existing code continues to work without changes. The selector is shown by default, but can be hidden with `allowTelemetrySwitch: false`.

### Data Flow

```
User selects telemetry type
         ↓
Event handler triggered
         ↓
Show loading state
         ↓
Build new telemetry query with selected keys
         ↓
Fetch data from ThingsBoard API
         ↓
Process and normalize data
         ↓
Destroy existing chart
         ↓
Render new chart with updated data
         ↓
Hide loading state
```

## Drawbacks

1. **Increased Complexity:** Adds more state management and event handling to the component
2. **API Load:** Each telemetry type switch triggers a new API call, potentially increasing load
3. **Chart Library Dependency:** Requires chart library to handle multi-series data properly
4. **Testing Surface:** More code paths to test (each telemetry type combination)

## Rationale and Alternatives

### Why This Design?

1. **User-Centric:** Dropdown is a familiar UI pattern for selection
2. **Progressive Enhancement:** Works with existing API without breaking changes
3. **Configurable:** Can be disabled if not needed
4. **Extensible:** Easy to add new telemetry types in the future

### Alternatives Considered

#### Alternative 1: Multiple Modals
Open separate modals for each telemetry type.

**Rejected because:**
- Poor UX (context loss)
- Memory overhead
- Cluttered screen

#### Alternative 2: Tabs
Use tabs instead of dropdown.

**Rejected because:**
- Takes more horizontal space
- Less scalable (too many tabs becomes unwieldy)
- Dropdown is more compact

#### Alternative 3: Checkbox Multi-Select
Allow selecting multiple telemetry types simultaneously.

**Deferred because:**
- More complex implementation
- Potential for overwhelming charts
- Can be added in future iteration

## Prior Art

Similar patterns exist in:

1. **Grafana:** Metric selector in query editor
2. **ThingsBoard:** Telemetry key selector in widget configuration
3. **Power BI:** Measure selector in visualizations
4. **Google Analytics:** Metric dropdown in reports

## Unresolved Questions

1. **Caching Strategy:** Should we cache data for previously selected telemetry types?
   - **Proposal:** Implement LRU cache with 5-minute TTL

2. **Multi-Selection:** Should users be able to select multiple telemetry types at once?
   - **Proposal:** Defer to future RFC (RFC-0062)

3. **Custom Telemetry Types:** Should users be able to define custom telemetry type configurations?
   - **Proposal:** Defer to future enhancement

4. **Export Behavior:** When exporting to CSV/PDF, should all telemetry types be included or just current?
   - **Proposal:** Only export currently selected type (keep it simple)

## Future Possibilities

### Phase 2 Enhancements (RFC-0062)

1. **Multi-Select Mode:** Allow selecting multiple telemetry types simultaneously
2. **Comparison Mode:** Side-by-side comparison of different telemetry types
3. **Custom Formulas:** Allow users to create custom calculations (e.g., `a + b + c`)

### Phase 3 Enhancements (RFC-0063)

1. **Real-time Updates:** WebSocket support for live telemetry streaming
2. **Anomaly Detection:** Highlight unusual readings in the chart
3. **Statistical Analysis:** Add min/max/avg/percentile overlays

## Implementation Plan

### Phase 1: Core Functionality (Sprint 1)
- [ ] Add telemetry type definitions and constants
- [ ] Implement telemetry type detection logic
- [ ] Add dropdown UI component
- [ ] Implement type switching logic
- [ ] Update chart rendering for multi-series data

### Phase 2: Polish & Testing (Sprint 2)
- [ ] Add loading states and error handling
- [ ] Implement unit tests
- [ ] Add integration tests
- [ ] Update documentation
- [ ] Add usage examples

### Phase 3: Documentation & Release
- [ ] Update component README
- [ ] Create migration guide
- [ ] Add JSDoc comments
- [ ] Update TypeScript types
- [ ] Release as minor version bump

## Success Metrics

1. **Adoption Rate:** % of modal instances using telemetry selector
2. **User Satisfaction:** Feedback scores from users
3. **Performance:** API response time < 500ms for telemetry switches
4. **Stability:** Error rate < 0.1% for telemetry switches

## References

- [ThingsBoard Telemetry API Documentation](https://thingsboard.io/docs/user-guide/telemetry/)
- [ApexCharts Multi-Series Documentation](https://apexcharts.com/docs/chart-types/line-chart/)
- [RFC-0015: MyIO DemandModal Component](./RFC-0015-MyIO-DemandModal-Component.md)

---

**Authors:** Claude Code Assistant
**Last Updated:** 2025-11-04
**Status:** Proposed - Awaiting Review
