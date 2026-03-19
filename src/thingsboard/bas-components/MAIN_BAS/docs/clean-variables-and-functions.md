# Cleanup Summary - controller.js

## Completed Cleanups (2026-02-16)

### Variables Removed
- `_ambientesCache` - unused cache
- `_devicesMap` - unused map
- `_ambientesMap` - unused map
- `currentDisplay` - assigned but never read
- `waterCount`, `energyCount`, `temperatureCount` - in mountSidebarMenu (unused)
- `_currentWaterTab` - assigned but never read

### Functions Removed
- `buildSidebarItemsFromHierarchy()` - ~30 lines
- `getLastValue()` - ~10 lines
- `hvacDeviceToAmbienteData()` - ~60 lines
- `createMockFetchData()` - ~25 lines (deprecated)
- `getLeafAmbientes()` - ~20 lines
- `isLeafAmbiente()` - ~5 lines
- `buildAmbienteSublabel()` - ~15 lines
- `getAmbienteIconForAggregates()` - ~8 lines

### Constants Removed
- `ENERGY_TYPE_MAP`
- `CHART_ICON_FILTER`
- `CHART_ICON_MAXIMIZE`

### Parameters Fixed (prefixed with `_`)
- `_results` in Promise.all callback
- `_settings` in `openBASDeviceModal`, `openBASWaterModal`, `openAmbienteDetailModal`, `openWaterTankModal`
- `_classified` in `mountSidebarMenu`
- `_endTs` in `fetchIngestionData`
- Catch block without parameter (modern JS syntax)

## Remaining (Acceptable)
- Hint: "This may be converted to an async function" (line 279) - not a problem

## Estimated Lines Removed
~200 lines of dead code
