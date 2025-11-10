# RFC-0076: ENERGY Widget – Distribution Chart Data Inconsistency Fix

- **Feature Name**: energy-distribution-chart-fix
- **Start Date**: 2025-01-10
- **RFC PR**: N/A
- **Status**: Draft
- **Implementation Path**: `src/MYIO-SIM/V1.0.0/ENERGY/controller.js`

## Summary

Fix data inconsistency in the ENERGY widget's "Distribuição de Energia" (Energy Distribution) chart. Currently, the chart only shows "Outros Equipamentos" (Other Equipment) data and fails to display equipment category breakdowns (Elevators, Escalators, HVAC, etc.) and the "Lojas" (Stores) group that is correctly shown in the "Consumo Total Lojas" card.

## Motivation

### Current Problem

When navigating from EQUIPMENTS widget to ENERGY widget via MENU:

**EQUIPMENTS Widget Shows** (Filter Modal - "Selecionar Equipamentos"):
- TODOS (219)
- COM CONSUMO (172)
- SEM CONSUMO (47)
- ELEVADORES (29)
- ESC. ROLANTE (54)
- CLIMATIZAÇÃO (33)
- OUTROS EQUIP. (103)

**ENERGY Widget Issues**:
1. **"Distribuição de Energia" card**: Only displays "Outros Equipamentos" data
2. **Missing data groups**:
   - Lojas (Stores) - should be shown (visible in "Consumo Total Lojas" card)
   - ELEVADORES (29 devices)
   - ESC. ROLANTE (54 devices)
   - CLIMATIZAÇÃO (33 devices)
   - ÁREA COMUM (Common Area) - should show remainder if exists
3. **Dropdown filter issue**: Selecting "Elevadores por Shopping" returns no data

### Why This Matters

- **Data Consistency**: Equipment counts from EQUIPMENTS should match distribution breakdown in ENERGY
- **User Experience**: Users see 219 total devices but chart only shows partial data
- **Business Value**: Energy distribution by category is critical for consumption analysis
- **Cross-Widget Integrity**: Data should be consistent across MAIN, EQUIPMENTS, and ENERGY widgets

## Guide-level Explanation

### Expected Behavior

When a user navigates to the ENERGY widget, the "Distribuição de Energia" chart should display:

1. **Lojas (Stores)** - Aggregate consumption of store spaces (shown in "Consumo Total Lojas")
2. **ELEVADORES** - 29 elevator devices
3. **ESC. ROLANTE** - 54 escalator devices
4. **CLIMATIZAÇÃO** - 33 HVAC devices (Chiller, Fancoil, AR, Bomba, CAG)
5. **OUTROS EQUIP.** - 103 other equipment devices
6. **ÁREA COMUM** - Remainder/common area consumption (if applicable)

### Dropdown Filters Should Work

When selecting from the "Visualizar:" dropdown:
- ✅ **Por Grupos de Equipamentos** - Show all categories above
- ✅ **Elevadores por Shopping** - Show elevator breakdown per shopping center
- ✅ **Escadas Rolantes por Shopping** - Show escalator breakdown per shopping center
- ✅ **Climatização por Shopping** - Show HVAC breakdown per shopping center
- ✅ **Outros Equipamentos por Shopping** - Show other equipment per shopping center
- ✅ **Lojas por Shopping** - Show stores breakdown per shopping center

## Reference-level Explanation

### Root Cause Analysis

**Investigation Steps**:
1. Review EQUIPMENTS widget data flow to MAIN orchestrator
2. Check ENERGY widget data fetching from MAIN/orchestrator
3. Analyze `updatePieChart()` function in `ENERGY/controller.js`
4. Review device classification logic consistency
5. Examine log file: `dashboard.myio-bas.com-1762809149745.log` (use `clean-log.ps1`)

**Suspected Issues**:
- ENERGY widget may not be receiving complete device data from orchestrator
- `updatePieChart()` may have filtering logic that excludes equipment categories
- Device classification between EQUIPMENTS and ENERGY may be inconsistent
- Shopping filter state may not be properly propagated to ENERGY widget

### Implementation Requirements

#### 1. Data Flow Verification

**Check in MAIN orchestrator** (`src/MYIO-SIM/V1.0.0/MAIN/controller.js`):
```javascript
// Ensure energyCache includes all device types
// Verify MyIOOrchestrator.getEnergyCache() returns complete data
```

**Check in ENERGY widget** (`src/MYIO-SIM/V1.0.0/ENERGY/controller.js`):
```javascript
// Verify data reception from orchestrator
// Check if all 219 devices are available
```

#### 2. Device Classification Consistency

Ensure ENERGY uses the same classification as EQUIPMENTS:
```javascript
// Two-tier classification:
// 1. Check deviceType
// 2. If deviceType === '3F_MEDIDOR', check deviceProfile
// 3. Check for CAG in identifier/labelOrName for HVAC
```

#### 3. Chart Data Aggregation

Fix `updatePieChart()` to include all categories:
```javascript
async function updatePieChart(mode) {
  // Aggregate by category:
  // - Lojas (stores/shopping spaces)
  // - Elevadores (ELEVADOR or 3F_MEDIDOR + ELEVADOR profile)
  // - Escadas Rolantes (ESCADA_ROLANTE or 3F_MEDIDOR + ESCADA_ROLANTE profile)
  // - Climatização (CHILLER, FANCOIL, AR, BOMBA, HVAC, CAG devices)
  // - Outros Equipamentos (remaining devices)
  // - Área Comum (common area remainder if exists)
}
```

#### 4. Shopping-Level Breakdown

Fix dropdown filters to show per-shopping breakdowns:
```javascript
// When mode === 'elevators', 'escalators', 'hvac', 'others', 'stores'
// Group by customerId (shopping center)
// Show consumption per shopping for selected category
```

### Technical Specifications

**Files to Modify**:
- `src/MYIO-SIM/V1.0.0/ENERGY/controller.js`
  - Function: `updatePieChart(mode)`
  - Function: `fetchDevicesByCategory()` (if exists, or create)
  - Function: `aggregateConsumptionByType()` (if exists, or create)

**Data Sources**:
- `window.MyIOOrchestrator.getEnergyCache()` - Main device data source
- `window.custumersSelected` - Shopping filter state
- `self.ctx.settings.customerId` - Current customer context

**Expected Data Structure**:
```javascript
{
  labels: ["Lojas", "Elevadores", "Esc. Rolantes", "Climatização", "Outros", "Área Comum"],
  datasets: [{
    data: [1200, 350, 280, 450, 180, 40], // kWh values
    backgroundColor: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#94a3b8", "#6366f1"]
  }]
}
```

## Drawbacks

- **Implementation Complexity**: May require refactoring data aggregation logic
- **Performance**: Aggregating 219 devices by category may impact chart update speed
- **Testing Scope**: Need to test all 6 dropdown filter modes with various device combinations
- **Data Dependency**: Relies on MAIN orchestrator providing complete device data

## Rationale and Alternatives

### Why This Approach?

1. **Consistency First**: Ensures data matches across all widgets
2. **Root Cause Fix**: Addresses underlying data flow issues, not just symptoms
3. **Comprehensive**: Fixes both category breakdown and dropdown filters
4. **Maintainable**: Uses existing classification logic from EQUIPMENTS

### Alternative Approaches

**Alternative 1: Cache Device Data in ENERGY Widget**
- Pro: Independent of orchestrator updates
- Con: Data duplication, sync issues

**Alternative 2: Only Fix Dropdown Filters**
- Pro: Simpler implementation
- Con: Doesn't address root cause of missing categories

**Alternative 3: Rewrite Chart from Scratch**
- Pro: Clean slate, modern approach
- Con: High risk, time-consuming, may introduce new bugs

### Why Not Alternatives?

The proposed approach is preferred because it:
- Fixes the root cause without major refactoring
- Maintains consistency with existing widget architecture
- Reuses proven classification logic from EQUIPMENTS
- Minimizes risk of introducing new issues

## Prior Art

### Similar Issues in Other Widgets

- **EQUIPMENTS Filter Modal**: Successfully categorizes devices into groups
- **MAIN Orchestrator**: Already aggregates device data via energyCache
- **TELEMETRY Widget**: Handles device classification with deviceType + deviceProfile pattern

### Lessons Learned

1. **Two-tier classification works**: deviceType → deviceProfile (for 3F_MEDIDOR)
2. **CAG detection**: identifier/labelOrName containing "CAG" = HVAC
3. **Shopping filters**: `window.custumersSelected` is the source of truth
4. **Event-driven updates**: `myio:filter-applied` events propagate filter changes

## Unresolved Questions

### Questions to Investigate

1. **Data Completeness**: Does `MyIOOrchestrator.getEnergyCache()` include all 219 devices?
2. **Lojas Definition**: How is "Lojas" (stores) consumption calculated vs equipment consumption?
3. **Área Comum**: When should "Área Comum" (common area) be shown? Is there a threshold?
4. **Performance**: What is acceptable chart update time with 219 devices?
5. **Mock Data**: Should we update `MOCK_DEBUG_DAY_CONSUMPTION` to include category breakdowns?

### Log Analysis Required

Review `dashboard.myio-bas.com-1762809149745.log` (after running `clean-log.ps1`) to answer:
- Are all 219 devices being loaded in ENERGY widget?
- What does the orchestrator cache contain?
- Are there any errors during chart rendering?
- What data is actually being passed to Chart.js?

### Testing Scenarios

Before implementation, verify:
1. ✅ EQUIPMENTS shows 219 devices with correct category counts
2. ❌ ENERGY "Distribuição de Energia" only shows "Outros Equipamentos"
3. ❌ Dropdown "Elevadores por Shopping" returns no data
4. ✅ "Consumo Total Lojas" card shows correct store consumption

After implementation, verify:
1. ✅ ENERGY chart shows all categories (Lojas, Elevadores, Esc. Rolantes, CLIMATIZAÇÃO, Outros, Área Comum)
2. ✅ Category counts match EQUIPMENTS filter modal
3. ✅ All dropdown filters return data
4. ✅ Shopping filter changes update chart correctly
5. ✅ Data remains consistent when navigating between widgets

## Future Possibilities

### Phase 2 Enhancements

1. **Real-time Updates**: Chart refreshes when devices come online/offline
2. **Time-series View**: Show distribution changes over time (7 days, 30 days)
3. **Cost Breakdown**: Show monetary cost by category, not just consumption
4. **Efficiency Metrics**: Show kWh per device for each category
5. **Anomaly Detection**: Highlight categories with unusual consumption patterns

### Integration Opportunities

- **FOOTER Widget**: Show selected category details when clicking chart segments
- **EQUIPMENTS Widget**: Link from chart to filtered equipment list
- **Reports**: Export distribution data to PDF/Excel

### Architecture Improvements

- **Shared Classification Service**: Extract device categorization into reusable module
- **Centralized Data Cache**: Single source of truth for all widgets
- **State Management**: Implement Redux or similar for cross-widget state

## Implementation Checklist

- [ ] Analyze log file with `clean-log.ps1`
- [ ] Verify data completeness in ENERGY widget
- [ ] Review `updatePieChart()` current implementation
- [ ] Implement category aggregation logic
- [ ] Add "Lojas" group to chart
- [ ] Fix dropdown filters (elevators, escalators, hvac, others, stores)
- [ ] Add "Área Comum" if applicable
- [ ] Ensure device classification consistency
- [ ] Test all 6 dropdown modes
- [ ] Verify shopping filter integration
- [ ] Add console logging for debugging
- [ ] Performance testing with 219 devices
- [ ] Cross-widget data validation
- [ ] Update documentation
- [ ] Create test scenarios document

## References

- **EQUIPMENTS Widget**: `src/MYIO-SIM/V1.0.0/EQUIPMENTS/controller.js`
- **ENERGY Widget**: `src/MYIO-SIM/V1.0.0/ENERGY/controller.js`
- **MAIN Orchestrator**: `src/MYIO-SIM/V1.0.0/MAIN/controller.js`
- **MENU Widget**: `src/MYIO-SIM/V1.0.0/MENU/controller.js`
- **Log File**: `dashboard.myio-bas.com-1762809149745.log`
- **Log Cleaner**: `src/MYIO-SIM/V1.0.0/clean-log.ps1`

## Related RFCs

- **RFC-0072**: EQUIPMENTS UI Improvements (filter modal with device categories)
- **RFC-0073**: ENERGY Dashboard Enhancements (7-day chart, configuration modal)
- **RFC-0074**: FOOTER Layout Integration
- **RFC-0065**: Device Type Coverage Audit

## Notes

- Original draft: `RFC-0076-FixEnergyView..draft.md`
- Device counts from actual data: 219 total, 172 with consumption, 47 without
- Category breakdown: Elevators (29), Escalators (54), HVAC (33), Others (103)
- Critical for production deployment - affects data integrity across dashboard
