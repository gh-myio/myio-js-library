# MYIO-SIM Energy Widget - Infinite Loop Fix

## Problem
The "Consumo Total" card in the ENERGY widget was stuck in an infinite loop, continuously updating and causing performance issues.

## Root Cause
**Duplicate event handlers** were calling `updateTotalConsumptionCard()`:

1. **Event 1**: `myio:customer-total-consumption` (from HEADER) → calls `updateTotalConsumptionCard()`
2. **Event 2**: `myio:energy-data-ready` (from MAIN orchestrator) → ALSO calls `updateTotalConsumptionCard()`

This created a loop where:
- HEADER emits customer total → ENERGY updates
- MAIN emits energy data → ENERGY updates AGAIN
- If either event re-fires, the cycle repeats infinitely

## Solution

### 1. Added Debounce Flag (Lines 26-27)
```javascript
// ✅ DEBOUNCE: Prevent infinite loops
let isUpdatingTotalConsumption = false;
```

### 2. Wrapped Update Function with Guard (Lines 432-501)
```javascript
function updateTotalConsumptionCard() {
  // ✅ PREVENT INFINITE LOOPS: Check if already updating
  if (isUpdatingTotalConsumption) {
    console.log("[ENERGY] Update already in progress, skipping...");
    return;
  }

  isUpdatingTotalConsumption = true;

  try {
    // ... update logic ...
  } catch (error) {
    // ... error handling ...
  } finally {
    // ✅ Reset flag after a short delay to allow DOM updates
    setTimeout(() => {
      isUpdatingTotalConsumption = false;
    }, 100);
  }
}
```

### 3. Removed Duplicate Update Call (Lines 768-770)
```javascript
// ✅ NOTE: We don't call updateTotalConsumptionCard() here to avoid loops
// The card will be updated when HEADER emits 'myio:customer-total-consumption'
// This event is only for future chart updates
```

## Implementation Details

### Debounce Logic
- **Flag**: `isUpdatingTotalConsumption` prevents concurrent updates
- **Timeout**: 100ms delay before resetting flag allows DOM to finish rendering
- **Early return**: If update is already in progress, function exits immediately

### Event Flow (After Fix)
1. HEADER calculates customer total → emits `myio:customer-total-consumption`
2. ENERGY receives event → sets `customerTotal` in cache
3. ENERGY calls `updateTotalConsumptionCard()` → **debounce flag set to true**
4. Orchestrator emits `myio:energy-data-ready`
5. ENERGY receives event → **does NOT call update (removed)**
6. After 100ms → **flag resets to false**

### Why This Works
- **Single source of truth**: Only `myio:customer-total-consumption` triggers updates
- **Guard against rapid calls**: Debounce prevents multiple simultaneous executions
- **Cache still works**: If data is cached, render happens immediately without API calls

## Testing Checklist
- [x] Card loads without infinite loop
- [x] Cache persists when switching tabs
- [x] Data updates correctly when HEADER emits new total
- [x] No console errors or warnings
- [x] Performance is stable (no excessive re-renders)

## Files Modified
- `src/MYIO-SIM/V1.0.0/ENERGY/controller.js`
  - Line 26-27: Added debounce flag
  - Lines 432-501: Added guard logic to `updateTotalConsumptionCard()`
  - Lines 768-770: Removed duplicate update call

## Related Issues
- **Previous fix**: Type conversion error with `peakData.peakValue.toFixed`
- **Previous fix**: EQUIPMENTS widget orchestrator access

## Notes
- The debounce timeout of 100ms is sufficient for DOM updates
- Future chart updates should use `myio:energy-data-ready` event (currently TODO)
- Cache TTL remains 5 minutes for both peak demand and total consumption
