# RFC-0099: Temperature Filter Calculation and Header Update

- **Feature Name:** `temperature_filter_header_update`
- **Start Date:** 2025-12-08
- **RFC PR:** N/A
- **Status:** Draft

## Summary

Implement a new calculation mechanism for the Temperature card in the HEADER component that displays comparative average temperatures when shopping centers are filtered through the MENU. This feature will show filtered vs. global average values, similar to the existing behavior for Equipment, Energy Consumption, and Water cards.

## Motivation

Currently, when users filter shopping centers in the MENU component, the Temperature card in the HEADER does not reflect the filtered selection's average compared to the global average. Other metric cards (Equipment, Energy Consumption, Water) already implement this comparison pattern.

This inconsistency leads to:

1. **UX inconsistency** - Temperature behaves differently from other metrics when filtering
2. **Missing context** - Users cannot see how their filtered selection compares to the overall portfolio
3. **Incomplete feature parity** - Temperature lags behind other domains in filter-aware displays

By implementing this feature, we enable:

- Consistent comparison display across all metric cards
- Better decision-making context for temperature analysis
- Complete feature parity with Energy, Water, and Equipment cards
- Clear visual feedback when filters are applied

## Guide-level Explanation

### Current Behavior

When filtering shopping centers (e.g., selecting 2 of 5), the Temperature card shows only the average of the selected shopping centers without any comparison context.

### Proposed Behavior

When shopping centers are filtered, the Temperature card will display:

1. **Filtered average** - The average temperature of selected shopping centers
2. **Global average** - The average temperature across all shopping centers
3. **Percentage difference** - How the filtered selection compares to the global average

### Visual Example

**Scenario:**
- 5 total shopping centers with global average temperature: **25.0°C**
- User filters to 2 shopping centers
- Selected shopping centers have combined average: **23.0°C**

**Display:**

```
┌─────────────────────────────┐
│   Average Temperature       │
│                             │
│      23.0°C / 25.0°C        │
│      8% below average       │
└─────────────────────────────┘
```

### Communication Flow

```
┌────────┐         ┌────────┐         ┌────────┐
│  MENU  │ ──────► │  MAIN  │ ──────► │ HEADER │
│ Filter │ Event   │Orchestr│ Update  │  Card  │
│ Select │         │  ator  │         │ Render │
└────────┘         └────────┘         └────────┘
     │                  │                  │
     │  filterChanged   │                  │
     │  {shoppingIds}   │                  │
     └──────────────────►                  │
                        │  updateHeader    │
                        │  {tempData}      │
                        └──────────────────►
```

## Reference-level Explanation

### Component Interactions

The implementation requires coordination between three components:

| Component | Location | Role |
|-----------|----------|------|
| MENU | `src/MYIO-SIM/v5.2.0/MENU` | Emits filter selection events |
| MAIN | `src/MYIO-SIM/v5.2.0/MAIN` | Orchestrates data flow and calculations |
| HEADER | `src/MYIO-SIM/v5.2.0/HEADER` | Renders comparison display |

### Data Structures

#### Filter Event Payload

```typescript
interface FilterChangedEvent {
  type: 'shopping_filter_changed';
  payload: {
    selectedShoppingIds: string[];
    totalShoppingCount: number;
    isFiltered: boolean;  // true if not all shoppings selected
  };
}
```

#### Temperature Comparison Data

```typescript
interface TemperatureComparisonData {
  filteredAverage: number;      // Average of selected shoppings
  globalAverage: number;        // Average of all shoppings
  percentageDiff: number;       // Difference as percentage
  isAboveAverage: boolean;      // true if filtered > global
  isFiltered: boolean;          // true if filter is active
  selectedCount: number;        // Number of selected shoppings
  totalCount: number;           // Total number of shoppings
}
```

### Calculation Logic

```typescript
function calculateTemperatureComparison(
  allShoppingsData: ShoppingTemperatureData[],
  selectedIds: string[]
): TemperatureComparisonData {
  // Calculate global average (all shoppings)
  const globalAverage = allShoppingsData.reduce(
    (sum, s) => sum + s.averageTemp, 0
  ) / allShoppingsData.length;

  // Filter selected shoppings
  const selectedData = allShoppingsData.filter(
    s => selectedIds.includes(s.id)
  );

  // Calculate filtered average
  const filteredAverage = selectedData.reduce(
    (sum, s) => sum + s.averageTemp, 0
  ) / selectedData.length;

  // Calculate percentage difference
  const percentageDiff = ((filteredAverage - globalAverage) / globalAverage) * 100;

  return {
    filteredAverage,
    globalAverage,
    percentageDiff: Math.abs(percentageDiff),
    isAboveAverage: filteredAverage > globalAverage,
    isFiltered: selectedIds.length < allShoppingsData.length,
    selectedCount: selectedIds.length,
    totalCount: allShoppingsData.length
  };
}
```

### HEADER Card Rendering

```typescript
function renderTemperatureCard(data: TemperatureComparisonData): string {
  const { filteredAverage, globalAverage, percentageDiff, isAboveAverage, isFiltered } = data;

  if (!isFiltered) {
    // No filter applied - show simple display
    return `
      <div class="metric-value">${globalAverage.toFixed(1)}°C</div>
      <div class="metric-label">Average Temperature</div>
    `;
  }

  // Filter applied - show comparison
  const diffLabel = isAboveAverage ? 'above average' : 'below average';
  const diffClass = isAboveAverage ? 'above' : 'below';

  return `
    <div class="metric-value comparison">
      <span class="filtered">${filteredAverage.toFixed(1)}°C</span>
      <span class="separator">/</span>
      <span class="global">${globalAverage.toFixed(1)}°C</span>
    </div>
    <div class="metric-diff ${diffClass}">
      ${percentageDiff.toFixed(0)}% ${diffLabel}
    </div>
  `;
}
```

### CSS Styling

```css
.metric-value.comparison {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.metric-value .filtered {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--primary-text);
}

.metric-value .separator {
  font-size: 1rem;
  color: var(--secondary-text);
  margin: 0 2px;
}

.metric-value .global {
  font-size: 1rem;
  color: var(--secondary-text);
}

.metric-diff {
  font-size: 0.875rem;
  margin-top: 4px;
}

.metric-diff.below {
  color: var(--color-info, #0288d1);
}

.metric-diff.above {
  color: var(--color-warning, #f57c00);
}
```

### MAIN Orchestrator Integration

The MAIN orchestrator must subscribe to filter events from MENU and propagate updates to HEADER:

```typescript
// In MAIN orchestrator
eventBus.on('shopping_filter_changed', async (event: FilterChangedEvent) => {
  const { selectedShoppingIds, totalShoppingCount, isFiltered } = event.payload;

  // Recalculate temperature comparison
  const temperatureData = await calculateTemperatureComparison(
    cachedShoppingsData,
    selectedShoppingIds
  );

  // Notify HEADER to update
  eventBus.emit('header_update', {
    type: 'temperature',
    data: temperatureData
  });
});
```

## Drawbacks

1. **Additional calculation overhead** - Requires computing global average on every filter change
2. **Event coupling** - MENU, MAIN, and HEADER become more tightly coupled
3. **State synchronization** - Need to ensure temperature data is available when filters change

## Rationale and Alternatives

### Why this design?

1. **Consistency** - Matches existing pattern used by Equipment, Energy, and Water cards
2. **Centralized calculation** - MAIN orchestrator handles all comparison logic
3. **Event-driven** - Decoupled communication via event bus
4. **Clear visual hierarchy** - Filtered value prominent, global value as context

### Alternatives considered

1. **Calculate in HEADER** - Rejected; violates single responsibility, HEADER should only render
2. **Calculate in MENU** - Rejected; MENU should only handle filter selection
3. **Direct component communication** - Rejected; creates tight coupling, harder to maintain

## Prior Art

- **Equipment Card** - Already implements filtered vs. global comparison
- **Energy Consumption Card** - Shows kWh comparison when filtered
- **Water Consumption Card** - Shows m³ comparison when filtered
- **RFC-0042** - Main View Orchestrator pattern (establishes event-driven communication)

## Unresolved Questions

1. Should the percentage difference use 0 or 1 decimal place?
2. Should we highlight temperature extremes (e.g., red if > 26°C)?
3. What threshold determines "significant" difference worth highlighting?
4. Should comparison be based on the current time period selected in MENU?

## Future Possibilities

1. **Trend indicators** - Show if filtered average is trending up/down vs previous period
2. **Alert thresholds** - Visual warnings when temperature exceeds defined limits
3. **Historical comparison** - Compare filtered selection to same period last year
4. **Export capability** - Allow exporting comparison data to reports

## Implementation Plan

### Phase 1: Event Infrastructure
1. Define `FilterChangedEvent` interface in shared types
2. Ensure MENU emits filter events with shopping IDs
3. Verify MAIN orchestrator receives and processes events

### Phase 2: Calculation Logic
1. Implement `calculateTemperatureComparison()` function in MAIN
2. Add caching for global average to avoid redundant calculations
3. Add unit tests for calculation accuracy

### Phase 3: HEADER Integration
1. Update HEADER to listen for temperature update events
2. Implement `renderTemperatureCard()` with comparison mode
3. Add CSS styles for comparison display

### Phase 4: Testing & Polish
1. Test with various filter combinations (1 of 5, 3 of 5, all selected)
2. Verify percentage calculations are accurate
3. Test edge cases (single shopping, no data, loading states)
4. Ensure responsive design works on all screen sizes

## Appendix A: Comparison Display Examples

| Scenario | Filtered Avg | Global Avg | Display |
|----------|--------------|------------|---------|
| 2 of 5 selected, cooler | 23.0°C | 25.0°C | `23.0°C / 25.0°C` - 8% below average |
| 3 of 5 selected, warmer | 26.5°C | 25.0°C | `26.5°C / 25.0°C` - 6% above average |
| 1 of 5 selected, same | 25.0°C | 25.0°C | `25.0°C / 25.0°C` - 0% difference |
| All selected (no filter) | - | 25.0°C | `25.0°C` (no comparison) |

## Appendix B: Event Flow Sequence

```
User Action          MENU              MAIN              HEADER
    │                  │                 │                  │
    │ Select Filter    │                 │                  │
    ├─────────────────►│                 │                  │
    │                  │ filterChanged   │                  │
    │                  ├────────────────►│                  │
    │                  │                 │ calculateTemp    │
    │                  │                 ├──────┐           │
    │                  │                 │      │           │
    │                  │                 │◄─────┘           │
    │                  │                 │ header_update    │
    │                  │                 ├─────────────────►│
    │                  │                 │                  │ render
    │                  │                 │                  ├──────┐
    │                  │                 │                  │      │
    │◄─────────────────┼─────────────────┼──────────────────┼──────┘
    │        UI Updated                                     │
```
