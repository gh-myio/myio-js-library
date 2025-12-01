# RFC-0087: Shopping Filter for Energy and Water Consumption Cards

- **Status**: Implemented
- **Created**: 2025-12-01
- **Updated**: 2025-12-01
- **Authors**: Development Team
- **Related**: RFC-0086 (DATA_API_HOST), RFC-0057 (Orchestrator)

## Summary

This RFC introduces shopping-based filtering for the Energy and Water consumption cards in the HEADER widget. When users filter by specific shopping centers in the MENU widget, the HEADER cards display both filtered and total consumption values with a relative percentage indicator.

## Motivation

Currently, the Energy and Water cards in the HEADER widget display total consumption across all shopping centers. Users need the ability to:

1. View consumption for specific shopping centers when filters are applied
2. Compare filtered consumption against the total consumption
3. Understand the relative proportion (percentage) of filtered consumption
4. Maintain consistency with how the Equipment card handles filtered data

## Guide-level Explanation

### User Experience

When a user selects specific shopping centers in the MENU filter:

**Before (all shoppings selected):**
```
Consumo de Energia          Água
456 kWh                     45 m³
```

**After (filtered by shopping):**
```
Consumo de Energia          Água
123 kWh / 456 kWh          12 m³ / 45 m³
    27%                        27%
```

The display shows:
- **Primary value**: Filtered consumption (selected shoppings only)
- **Secondary value**: Total consumption (all shoppings) - shown in smaller, gray text
- **Percentage chip**: Relative proportion of filtered vs total

### Filter Synchronization

The shopping filter is synchronized across all widgets via CustomEvents:

```
MENU (filter selection)
    │
    ├──► myio:filter-applied ──► MAIN (Orchestrator)
    │                                   │
    │                                   └──► myio:orchestrator-filter-updated
    │                                               │
    │                                               ├──► HEADER (Energy/Water cards)
    │                                               └──► EQUIPMENTS (Equipment cards)
    │
    └──► myio:filter-applied ──► EQUIPMENTS (direct)
```

## Reference-level Explanation

### Orchestrator Functions (MAIN/controller.js)

New functions added to `MyIOOrchestrator`:

```javascript
// Energy consumption with filter applied
getTotalConsumption()

// Energy consumption without filter (all devices)
getUnfilteredTotalConsumption()

// Water consumption with filter applied
getTotalWaterConsumption()

// Water consumption without filter (all devices)
getUnfilteredTotalWaterConsumption()

// Check if shopping filter is active
isFilterActive()
```

### Water Cache Enhancement

The water cache now includes `customerId` for filtering support:

```javascript
cache.set(device.id, {
  ingestionId: device.id,
  name: device.name,
  total_value: device.total_value || 0,
  customerId: device.customerId || device.customer_id || null, // NEW
  timestamp: Date.now(),
});
```

### Event Flow

1. **Filter Application** (`myio:filter-applied`)
   - Dispatched by MENU when user changes shopping selection
   - Contains `selection` array with `{ name, value }` objects

2. **Orchestrator Update** (`myio:orchestrator-filter-updated`)
   - Dispatched by MAIN after processing filter
   - Contains `selectedShoppingIds` and `isFiltered` flag
   - Ensures HEADER updates after orchestrator has processed the filter

### Display Logic (HEADER)

```javascript
const showComparative = isFiltered &&
                        unfilteredConsumption > 0 &&
                        Math.abs(filteredConsumption - unfilteredConsumption) > 0.01;

if (showComparative) {
  // Show: "123 kWh / 456 kWh" with percentage chip
  kpi.innerHTML = `${filtered} <span style="...">/ ${total}</span>`;
  trend.innerText = `${percentage}%`;
} else {
  // Show only total value
  kpi.innerText = formatted;
  trend.style.display = 'none';
}
```

### Pre-existing Filter Handling

All widgets check for pre-existing filters during initialization:

```javascript
// Check if filter was already applied before widget initialized
if (window.custumersSelected?.length > 0) {
  const shoppingIds = window.custumersSelected.map(s => s.value).filter(v => v);
  STATE.selectedShoppingIds = shoppingIds;
  // Apply filter immediately
}
```

## Files Changed

| File | Changes |
|------|---------|
| `MAIN/controller.js` | Added orchestrator functions, water cache customerId, filter event dispatch |
| `HEADER/controller.js` | Updated energy/water card display logic, filter event handling |
| `HEADER/template.html` | Added `id="water-trend"` to water chip element |
| `EQUIPMENTS/controller.js` | Fixed function definition order for pre-existing filter handling |

## Drawbacks

1. **Increased complexity**: Multiple event handlers and state synchronization
2. **Potential timing issues**: Event-based communication may have race conditions
3. **Memory overhead**: Maintaining both filtered and unfiltered totals

## Rationale and Alternatives

### Why this approach?

1. **Centralized orchestrator**: Single source of truth for consumption data
2. **Event-driven updates**: Decoupled widgets that react to state changes
3. **Graceful degradation**: Falls back to total when filter matches all

### Alternatives considered

1. **Direct function calls**: Would couple widgets tightly
2. **Shared state object**: Would require complex synchronization
3. **Re-fetching data**: Would increase API calls and latency

## Prior Art

- Equipment card already implements similar filtered/total display pattern
- RFC-0057 established the orchestrator pattern for data management

## Unresolved Questions

1. Should percentage be shown when filter results in 0 consumption?
2. Should we add visual indicator (color coding) based on percentage thresholds?
3. How to handle scenarios where API returns devices without customerId?

## Future Possibilities

1. **Per-shopping breakdowns**: Tooltip or expandable view showing consumption by shopping
2. **Historical comparison**: Show filtered vs total over time periods
3. **Export filtered data**: Allow users to export consumption for selected shoppings
4. **Threshold alerts**: Notify when filtered consumption exceeds percentage of total
