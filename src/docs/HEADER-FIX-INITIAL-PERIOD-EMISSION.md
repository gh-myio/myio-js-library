# HEADER Fix: Initial Period Emission

**Data:** 2025-10-18
**Status:** ✅ IMPLEMENTED (Pending Deployment)
**Versão:** v5.2.0
**Related to:** BUG-FIX-CACHE-EMPTY-DATA-IMPLEMENTED.md

---

## 🐛 Problem Identified

**Symptom:** TELEMETRY widgets not displaying data on initial page load.

**Root Cause Analysis from Log (dashboard.myio-bas.com-1760756323927-CLEAN.log):**

1. **Line 74**: `⭐ Skipping initial period emission - unsupported domain: null`
   - HEADER initializes with `currentDomain = null`
   - Old code tried to emit initial period before domain was set
   - Emission was skipped, leaving orchestrator's `currentPeriod = false`

2. **Line 94**: `myio:dashboard-state skipped (visibleTab=energy, currentPeriod=false)`
   - MENU emits `myio:dashboard-state` with `tab: 'energy'`
   - Orchestrator receives event but `currentPeriod` is still `false`
   - Orchestrator skips `hydrateDomain()` execution

3. **Lines 136, 142**: `No period set, ignoring data provision and hiding busy`
   - TELEMETRY widgets receive `myio:telemetry:provide-data` event
   - But widgets reject the data because their internal `period` is not set
   - Result: widgets show loading spinner forever or display empty state

---

## 🛠️ Solution Implemented

### Fix Location: `HEADER/controller.js` (Lines 287-322)

**Strategy:** Move initial period emission into the `myio:dashboard-state` event listener.

**Implementation:**

```javascript
// RFC-0042: Track if we already emitted initial period
let hasEmittedInitialPeriod = false;

// RFC-0042: Listen for dashboard state changes from MENU
window.addEventListener('myio:dashboard-state', (ev) => {
  const { tab } = ev.detail;
  LogHelper.log(`[HEADER] Dashboard state changed to: ${tab}`);
  currentDomain = tab;
  updateControlsState(tab);

  // RFC-0045 FIX: Emit initial period when domain is set for the first time
  // This ensures orchestrator has currentPeriod set immediately
  if (!hasEmittedInitialPeriod && (tab === 'energy' || tab === 'water')) {
    hasEmittedInitialPeriod = true;

    // Wait for dateRangePicker to be ready
    setTimeout(() => {
      if (self.__range.start && self.__range.end) {
        const startISO = toISO(self.__range.start.toDate(), 'America/Sao_Paulo');
        const endISO = toISO(self.__range.end.toDate(), 'America/Sao_Paulo');

        const initialPeriod = {
          startISO,
          endISO,
          granularity: calcGranularity(startISO, endISO),
          tz: 'America/Sao_Paulo'
        };

        LogHelper.log(`[HEADER] 🚀 Emitting initial period for domain ${tab}:`, initialPeriod);
        emitToAllContexts("myio:update-date", { period: initialPeriod });
      } else {
        LogHelper.warn(`[HEADER] ⚠️ Cannot emit initial period - dateRangePicker not ready yet`);
      }
    }, 300); // Small delay to ensure dateRangePicker is initialized
  }
});
```

---

## 📊 Expected Behavior After Fix

### Correct Initialization Flow:

```
1. HEADER initializes
   ├─ currentDomain = null (expected)
   ├─ dateRangePicker initializes with default range (2025-10-01 to 2025-10-17)
   └─ [HEADER] ⭐ Skipping initial period emission - unsupported domain: null ← STILL OK

2. MENU emits myio:dashboard-state { tab: 'energy' }
   ├─ HEADER receives event
   ├─ Sets currentDomain = 'energy'
   ├─ Checks hasEmittedInitialPeriod = false ✅
   ├─ Waits 300ms for dateRangePicker
   └─ Emits myio:update-date with period:
       { startISO: '2025-10-01T00:00:00-03:00',
         endISO: '2025-10-17T23:59:00-03:00',
         granularity: 'day',
         tz: 'America/Sao_Paulo' }

3. Orchestrator receives myio:update-date
   ├─ Sets currentPeriod = { startISO: '...', endISO: '...', ... }
   ├─ Receives second myio:dashboard-state { tab: 'energy' }
   ├─ Checks: visibleTab = 'energy', currentPeriod = truthy ✅
   └─ Executes hydrateDomain('energy')

4. Orchestrator fetches data
   ├─ fetchAndEnrich() gets 354 items from API
   ├─ writeCache() validates: 354 items > 0 ✅
   ├─ Cache saved successfully
   ├─ emitProvide() validates: 354 items > 0 ✅
   └─ Emits myio:telemetry:provide-data with 354 items

5. TELEMETRY widgets receive data
   ├─ Check: period is set ✅
   ├─ Accept data (354 items)
   ├─ Process and display data
   └─ Hide busy/loading spinner
```

---

## 🔍 Expected Logs After Fix

### Success Scenario:

```javascript
// HEADER initialization
[HEADER] RelatÃ³rio Geral button disabled for domain: null
[HEADER] Carregar button disabled for domain: null
[HEADER] Force Refresh button disabled for domain: null
[tbx] DRP pronto: {startDate: '2025-10-01', endDate: '2025-10-17', ...}
[DateRangePicker] Successfully initialized
[HEADER] ⭐ Skipping initial period emission - unsupported domain: null ← OLD BEHAVIOR (OK)

// MENU sets domain
[Orchestrator] 📄 Received myio:dashboard-state event {tab: 'energy'}
[HEADER] Dashboard state changed to: energy
[HEADER] RelatÃ³rio Geral button enabled for domain: energy
[HEADER] Carregar button enabled for domain: energy
[HEADER] Force Refresh button enabled for domain: energy

// NEW: HEADER emits initial period
[HEADER] 🚀 Emitting initial period for domain energy: {startISO: '2025-10-01T00:00:00-03:00', endISO: '2025-10-17T23:59:00-03:00', granularity: 'day', tz: 'America/Sao_Paulo'}
[HEADER] ✅ Emitted myio:update-date to current window
[HEADER] ✅ Emitted myio:update-date to parent window
[HEADER] Found 4 iframes
[HEADER] ✅ Emitted myio:update-date to iframe 0
[HEADER] ✅ Emitted myio:update-date to iframe 1
[HEADER] ✅ Emitted myio:update-date to iframe 2
[HEADER] ✅ Emitted myio:update-date to iframe 3

// Orchestrator now has currentPeriod set
[Orchestrator] 📄 Received myio:dashboard-state event {tab: 'energy'}
[Orchestrator] 📄 myio:dashboard-state → hydrateDomain(energy) ← NOT SKIPPED!
[Orchestrator] hydrateDomain called for energy: {key: 'energy:...', inFlight: false}
[Orchestrator] 📄 showGlobalBusy() domain=energy
[Orchestrator] 📍 fetchAndEnrich called for energy
[Orchestrator] ✅ Credentials available, proceeding with fetch
[Orchestrator] fetchAndEnrich: fetched 354 items for domain energy
[Orchestrator] 📦 Cache updated for energy: 354 items (v4)
[Orchestrator] 📡 Emitted provide-data for energy with 354 items

// TELEMETRY widgets accept data
[TELEMETRY energy] 📦 Received provide-data event for domain energy, periodKey: energy:..., items: 354
[TELEMETRY] 📄 Processing data from orchestrator...
[TELEMETRY] Received 354 items from orchestrator for domain energy
[TELEMETRY] Filtered 354 items down to 232 items matching datasources
[TELEMETRY] ✅ Data processed successfully - ensuring busy is hidden
[TELEMETRY] ⏸️ hideBusy() called
```

### Key Differences from Current (Broken) Log:

| Line | Current (Broken) | Expected (Fixed) |
|------|------------------|------------------|
| 74 | `⭐ Skipping initial period emission - unsupported domain: null` | Same (this is OK!) |
| ~90 | Missing emission logs | `[HEADER] 🚀 Emitting initial period for domain energy` |
| 94 | `myio:dashboard-state skipped (currentPeriod=false)` | `myio:dashboard-state → hydrateDomain(energy)` |
| 136, 142 | `No period set, ignoring data provision` | `📄 Processing data from orchestrator...` |

---

## 📝 Files Modified

### `HEADER/controller.js`

**Lines 287-322:** Added initial period emission inside `myio:dashboard-state` listener

**Key Changes:**
- Added `hasEmittedInitialPeriod` flag to prevent duplicate emissions
- Moved initial period emission from initialization block into event listener
- Added 300ms delay to ensure dateRangePicker is ready
- Reuses existing `emitToAllContexts()` function to broadcast to all windows/iframes

**Lines Removed:** ~360-386 (old duplicate `setTimeout` block that tried to emit before domain was set)

---

## ✅ Deployment Checklist

### Pre-Deployment

- [x] **Fix Implemented**: Code changes in `HEADER/controller.js`
- [x] **Documentation Created**: This file
- [ ] **Local Testing**: Test in development environment
- [ ] **Log Analysis**: Verify expected logs appear

### Deployment

- [ ] **Build**: Compile updated widget code
- [ ] **Deploy to Test**: Upload to test environment
- [ ] **QA Validation**: Verify flow with new logs
- [ ] **Production Deploy**: Upload to production after approval

### Post-Deployment Validation

- [ ] **Log Review**: Capture new log and verify:
  - `🚀 Emitting initial period for domain energy` appears after domain is set
  - `myio:dashboard-state → hydrateDomain(energy)` appears (not skipped)
  - TELEMETRY widgets show `📄 Processing data from orchestrator...`
  - Data displays correctly in all widgets
- [ ] **User Testing**: Navigate energy → water → energy and verify data displays
- [ ] **Performance**: Check cache hits/misses
- [ ] **Error Handling**: Verify no errors in console

---

## 🔗 Related Documentation

- **Bug Report**: `BUG-REPORT-CACHE-SERVING-EMPTY-DATA.md`
- **Empty Cache Fix**: `BUG-FIX-CACHE-EMPTY-DATA-IMPLEMENTED.md`
- **RFC**: `RFC-0045-FINAL-DELIVERY.md`
- **Orchestrator Guide**: `ORCHESTRATOR-IMPROVEMENTS-SUMMARY.md`

---

## 🎯 Next Steps

1. **Deploy Updated HEADER Widget** to test environment
2. **Capture New Log** with complete initialization flow
3. **Validate** that TELEMETRY widgets display data on initial load
4. **Test Navigation** energy → water → energy to ensure data persists
5. **Production Deploy** after QA approval

---

**Status:** ✅ **CODE READY - AWAITING DEPLOYMENT**
**Next:** Deploy to test environment and capture validation logs
