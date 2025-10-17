# MYIO-SIM 1.0.0: Date Picker Auto-Fetch Fix Plan

**Status**: ⚠️ Critical Issue
**Created**: 2025-10-16
**Version**: MYIO-SIM 1.0.0
**Reference Implementation**: v-5.2.0

---

## 📋 Executive Summary

### Problem Statement
When users click on dates in the MENU widget's date picker, data is immediately fetched and loaded. This is incorrect behavior - data should only be fetched when the user explicitly clicks the "Carregar" button.

### Root Cause Analysis
The date picker's `onApply` callback (lines 837-871 in MENU/controller.js) immediately dispatches the `myio:update-date` event, which triggers the orchestrator to fetch and propagate data to all widgets.

### Impact
- ❌ Poor UX: Unnecessary API calls on every date selection
- ❌ Performance: Multiple data fetches when user adjusts date range
- ❌ Bandwidth waste: Redundant API requests
- ❌ Server load: Unnecessary backend queries

### Additional Issues Found
1. **Orchestrator not updating HEADER**: Energy consumption card shows old/cached data
2. **Missing domain handling**: EQUIPMENTS and ENERGY widgets don't filter by domain
3. **Architecture mismatch**: MYIO-SIM 1.0.0 deviates from v-5.2.0 patterns

---

## 🔍 Detailed Analysis

### Issue 1: Date Picker Auto-Fetch

**Current Behavior** (INCORRECT):
```
User clicks date → onApply fires → myio:update-date event → Orchestrator fetches → All widgets update
```

**Expected Behavior** (v-5.2.0 pattern):
```
User clicks date → Store selection internally → Wait for "Carregar" click → Then fetch and update
```

**Code Location**: `C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\MENU\controller.js`

**Lines 837-871** (PROBLEM):
```javascript
MyIOLibrary.createDateRangePicker(inputElement, {
  presetStart: startISO,
  presetEnd: endISO,
  maxRangeDays: 365,
  onApply: (result) => {
    // ⚠️ PROBLEM: Immediately dispatches event
    timeStart = result.startISO;
    timeEnd = result.endISO;

    const startMs = new Date(result.startISO).getTime();
    const endMs = new Date(result.endISO).getTime();

    const startISOOffset = result.startISO.replace("Z", "-03:00");
    const endISOOffset = result.endISO.replace("Z", "-03:00");

    console.log("[MENU] START", startMs);
    console.log("[MENU] end", endMs);

    // ⚠️ THIS IS THE PROBLEM - Event dispatched immediately
    window.dispatchEvent(
      new CustomEvent("myio:update-date", {
        detail: {
          startDate: startISOOffset,
          endDate: endISOOffset,
          startUtc: result.startISO,
          endUtc: result.endISO,
          startMs,
          endMs,
          tz: TZ,
        },
      })
    );
  },
})
```

**Reference Implementation** (v-5.2.0 HEADER/controller.js lines 107-124):
```javascript
// v-5.2.0 CORRECT approach - onApply only stores dates, doesn't fetch
MyIOLibrary.createDateRangePicker($inputStart[0], {
  presetStart: presetStart,
  presetEnd: presetEnd,
  onApply: function (result) {
    LogHelper.log("[DateRangePicker] Applied:", result);

    // ✅ ONLY updates internal scope
    self.ctx.$scope.startTs = result.startISO;
    self.ctx.$scope.endTs = result.endISO;

    // ✅ NO event dispatching here!
    // The input display is automatically handled by the component
  },
})

// ✅ Separate "Carregar" button handler (lines 358-377)
btnLoad?.addEventListener("click", () => {
  // RFC-0042: Standardized period emission
  const startISO = toISO(self.ctx.$scope.startTs || inputStart.value + "T00:00:00", 'America/Sao_Paulo');
  const endISO = toISO(self.ctx.$scope.endTs || inputEnd.value + "T23:59:00", 'America/Sao_Paulo');

  const period = {
    startISO,
    endISO,
    granularity: calcGranularity(startISO, endISO),
    tz: 'America/Sao_Paulo'
  };

  LogHelper.log("[HEADER] Emitting standardized period:", period);

  // ✅ ONLY dispatch on explicit button click
  emitToAllContexts("myio:update-date", { period });
  emitToAllContexts("myio:update-date-legacy", { startDate: startISO, endDate: endISO });
});
```

---

### Issue 2: Orchestrator Not Updating HEADER

**Problem**: HEADER energy consumption card doesn't update when orchestrator fetches new data

**Root Cause**: Event listener mismatch between HEADER and MAIN orchestrator

**HEADER/controller.js** (lines 1112-1115):
```javascript
// ⚠️ HEADER listens for 'myio:energy-data-ready'
window.addEventListener('myio:energy-data-ready', (ev) => {
  console.log("[HEADER] Received energy data from orchestrator:", ev.detail);
  updateEnergyCard(ev.detail.cache);
});
```

**MAIN/controller.js** (lines 432-441):
```javascript
// ✅ MAIN DOES dispatch 'myio:energy-data-ready'
window.dispatchEvent(new CustomEvent('myio:energy-data-ready', {
  detail: {
    cache: energyCache,
    totalDevices: energyCache.size,
    startDate: startDateISO,
    endDate: endDateISO,
    timestamp: Date.now(),
    fromCache: false
  }
}));
```

**Additional Problem**: `updateEnergyCard()` has early return logic that prevents updates

**HEADER/controller.js** (lines 1070-1072):
```javascript
if(energyKpi.innerHTML !== '0,00 kWh') {
  return; // ⚠️ WRONG! This prevents updates if card already has data
}
```

**Why This Breaks**:
1. Initial load sets `energyKpi.innerHTML` to formatted value (e.g., "1,234.56 kWh")
2. Next update checks `innerHTML !== '0,00 kWh'` → TRUE (because it has data)
3. Function returns early, never updating the card
4. Result: Card shows stale data forever

---

### Issue 3: Missing Domain Handling

**Problem**: EQUIPMENTS and ENERGY widgets don't filter data by domain (energy/water/temperature)

**v-5.2.0 Pattern** (MENU/controller.js lines 124-145):
```javascript
// RFC-0042: State ID to Domain mapping
const DOMAIN_BY_STATE = {
  telemetry_content: 'energy',
  water_content: 'water',
  temperature_content: 'temperature',
  alarm_content: null // No domain for alarms
};

scope.changeDashboardState = function (e, stateId, index) {
  // RFC-0042: Notify orchestrator of tab change
  const domain = DOMAIN_BY_STATE[stateId];

  // ALWAYS dispatch event, even for null domain (alarms, etc)
  // This ensures HEADER can disable buttons for unsupported domains
  window.dispatchEvent(new CustomEvent('myio:dashboard-state', {
    detail: { tab: domain }
  }));

  // ... rest of implementation
}
```

**MYIO-SIM 1.0.0 Status**:
- ❌ MENU doesn't have tab switching (uses main state switching instead)
- ❌ No `myio:dashboard-state` event dispatching
- ❌ EQUIPMENTS widget doesn't check domain before rendering
- ❌ ENERGY widget is minimal (only charts, no real data handling)

---

## 🛠️ Solution Implementation

### Fix 1: Decouple Date Selection from Data Fetch

**File**: `C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\MENU\controller.js`

**Step 1**: Remove event dispatch from `onApply` callback (lines 837-871)

**BEFORE**:
```javascript
onApply: (result) => {
  timeStart = result.startISO;
  timeEnd = result.endISO;

  const startMs = new Date(result.startISO).getTime();
  const endMs = new Date(result.endISO).getTime();

  const startISOOffset = result.startISO.replace("Z", "-03:00");
  const endISOOffset = result.endISO.replace("Z", "-03:00");

  console.log("[MENU] START", startMs);
  console.log("[MENU] end", endMs);

  // ⚠️ REMOVE THIS - Don't dispatch on date selection
  window.dispatchEvent(
    new CustomEvent("myio:update-date", {
      detail: {
        startDate: startISOOffset,
        endDate: endISOOffset,
        startUtc: result.startISO,
        endUtc: result.endISO,
        startMs,
        endMs,
        tz: TZ,
      },
    })
  );
}
```

**AFTER**:
```javascript
onApply: (result) => {
  // ✅ ONLY store dates internally
  timeStart = result.startISO;
  timeEnd = result.endISO;

  // Update scope for other components to read (if needed)
  self.ctx.$scope.startDateISO = result.startISO.replace("Z", "-03:00");
  self.ctx.$scope.endDateISO = result.endISO.replace("Z", "-03:00");

  // Update UI display
  const startDate = new Date(result.startISO);
  const endDate = new Date(result.endISO);
  const timeWindow = `Intervalo: ${formatDiaMes(startDate)} - ${formatDiaMes(endDate)}`;
  const timeinterval = document.getElementById("energy-peak");
  if (timeinterval) {
    timeinterval.innerText = timeWindow;
  }

  console.log("[MENU] Date selection updated (no fetch):", {
    start: result.startISO,
    end: result.endISO
  });
}
```

**Step 2**: Create explicit "Carregar" button handler

**Location**: After date picker initialization (around line 872)

**NEW CODE**:
```javascript
// ===== CARREGAR BUTTON HANDLER =====
// Find or create "Carregar" button (assuming it exists in template)
const btnCarregar = document.getElementById("btnCarregar") || document.querySelector("[data-action='load']");

if (btnCarregar) {
  btnCarregar.addEventListener("click", async () => {
    console.log("[MENU] Carregar button clicked - fetching data...");

    // Disable button during fetch
    btnCarregar.disabled = true;
    const originalText = btnCarregar.textContent;
    btnCarregar.textContent = "Carregando...";

    try {
      // Prepare date range with timezone offset
      const startISOOffset = timeStart.replace("Z", "-03:00");
      const endISOOffset = timeEnd.replace("Z", "-03:00");

      const startMs = new Date(timeStart).getTime();
      const endMs = new Date(timeEnd).getTime();

      // Update scope
      self.ctx.$scope.startDateISO = startISOOffset;
      self.ctx.$scope.endDateISO = endISOOffset;

      console.log("[MENU] Dispatching myio:update-date event:", {
        startDate: startISOOffset,
        endDate: endISOOffset
      });

      // ✅ NOW dispatch event to trigger data fetch
      window.dispatchEvent(
        new CustomEvent("myio:update-date", {
          detail: {
            startDate: startISOOffset,
            endDate: endISOOffset,
            startUtc: timeStart,
            endUtc: timeEnd,
            startMs,
            endMs,
            tz: TZ,
          },
        })
      );

      // Also update customer consumption if applicable
      if (window.custumersSelected && window.custumersSelected.length > 0) {
        await updateTotalConsumption(
          window.custumersSelected,
          startISOOffset,
          endISOOffset
        );
      }

    } catch (error) {
      console.error("[MENU] Error loading data:", error);
      alert("Erro ao carregar dados. Tente novamente.");
    } finally {
      // Re-enable button
      btnCarregar.disabled = false;
      btnCarregar.textContent = originalText;
    }
  });

  console.log("[MENU] Carregar button handler registered");
} else {
  console.warn("[MENU] Carregar button not found - please add to template");
}
```

**Step 3**: Update template to include "Carregar" button (if missing)

**File**: `C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\MENU\controller.js`

Look for date picker input section and add button nearby:

```html
<!-- Existing date picker input -->
<input type="text" id="dateRangeInput" />

<!-- ✅ ADD THIS: Carregar button -->
<button id="btnCarregar" class="btn-carregar" title="Carregar dados do período selecionado">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
  <span>Carregar</span>
</button>
```

**CSS** (add to `<style>` section):
```css
.btn-carregar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #1D4F91 0%, #2563eb 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-carregar:hover {
  background: linear-gradient(135deg, #1a4076 0%, #1d4ed8 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(29, 78, 145, 0.3);
}

.btn-carregar:active {
  transform: translateY(0);
}

.btn-carregar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-carregar svg {
  width: 18px;
  height: 18px;
}
```

---

### Fix 2: Correct HEADER Energy Card Update Logic

**File**: `C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\HEADER\controller.js`

**Problem Location**: Lines 1070-1072

**BEFORE** (BROKEN):
```javascript
function updateEnergyCard(energyCache) {
  // Find datasources[1] with aliasName="Lojas"
  // Build list of ingestionIds from ctx.data
  const ingestionIds = [];
  const energyKpi = document.getElementById("energy-kpi");
  const energyTrend = document.getElementById("energy-trend");

  console.log(energyKpi.innerHTML);

  // ⚠️ WRONG! This prevents updates
  if(energyKpi.innerHTML !== '0,00 kWh') {
    return; // Early return blocks all future updates!
  }

  // ... rest of function
}
```

**AFTER** (FIXED):
```javascript
function updateEnergyCard(energyCache) {
  const ingestionIds = [];
  const energyKpi = document.getElementById("energy-kpi");
  const energyTrend = document.getElementById("energy-trend");

  // ✅ REMOVED early return - always process updates

  console.log("[HEADER] Updating energy card with cache:", energyCache?.size || 0, "devices");

  self.ctx.data.forEach((data) => {
    console.log('[HEADER] Processing data row:', data);

    // Extract ingestionId from data
    const ingestionId = data.data?.[0]?.[1]; // data[indexOfIngestionId][1] = value
    if (ingestionId) {
      ingestionIds.push(ingestionId);
    }
  });

  console.log("[HEADER] Energy card: Found ingestionIds:", ingestionIds.length);

  // Sum consumption from cache for all ingestionIds
  let totalConsumption = 0;
  if (energyCache) {
    ingestionIds.forEach(ingestionId => {
      const cached = energyCache.get(ingestionId);
      if (cached) {
        totalConsumption += cached.total_value || 0;
        console.log(`[HEADER] Device ${cached.name}: ${cached.total_value} kWh`);
      }
    });
  }

  // ✅ ALWAYS update, even if value is same
  if (energyKpi) {
    const formatted = MyIOLibrary.formatEnergy ? MyIOLibrary.formatEnergy(totalConsumption) : `${totalConsumption.toFixed(2)} kWh`;
    energyKpi.innerText = formatted;
    console.log(`[HEADER] Energy card updated: ${formatted}`);
  }

  // Optional: update trend (can be calculated later based on historical data)
  if (energyTrend) {
    energyTrend.innerText = ""; // Clear for now
  }

  console.log("[HEADER] Energy card update complete:", { totalConsumption, devices: ingestionIds.length });
}
```

**Additional Fix**: Ensure event listener is registered correctly

**Lines 1112-1115** (verify this exists):
```javascript
// ✅ This should already exist, but verify it's present
window.addEventListener('myio:energy-data-ready', (ev) => {
  console.log("[HEADER] Received energy data from orchestrator:", ev.detail);
  updateEnergyCard(ev.detail.cache);
});
```

---

### Fix 3: Implement Domain-Based Data Handling

**File**: `C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\MAIN\controller.js`

**Enhancement 1**: Add domain tracking to orchestrator

**Lines 131-481** (MyIOOrchestrator module):

**ADD** to state management (after line 140):
```javascript
const MyIOOrchestrator = (() => {
  // ========== BUSY OVERLAY MANAGEMENT ==========
  const BUSY_OVERLAY_ID = 'myio-orchestrator-busy-overlay';
  let globalBusyState = {
    isVisible: false,
    timeoutId: null,
    startTime: null,
    currentDomain: null,  // ← Already exists
    requestCount: 0
  };

  // ✅ ADD: Domain tracking
  let activeDomain = 'energy'; // Default domain

  function setActiveDomain(domain) {
    const validDomains = ['energy', 'water', 'temperature'];
    if (validDomains.includes(domain)) {
      activeDomain = domain;
      console.log(`[Orchestrator] Active domain set to: ${domain}`);

      // Dispatch event to notify other widgets
      window.dispatchEvent(new CustomEvent('myio:domain-changed', {
        detail: { domain }
      }));
    } else {
      console.warn(`[Orchestrator] Invalid domain: ${domain}`);
    }
  }

  function getActiveDomain() {
    return activeDomain;
  }
```

**ADD** to return object (line 471):
```javascript
return {
  fetchEnergyData,
  getCache,
  getCachedDevice,
  invalidateCache,
  clearStorageCache,
  showGlobalBusy,
  hideGlobalBusy,
  getBusyState: () => ({ ...globalBusyState }),
  // ✅ NEW: Domain management
  setActiveDomain,
  getActiveDomain
};
```

**Enhancement 2**: Listen for domain changes from MENU

**ADD** after line 623 (after existing event listener):
```javascript
// ===== ORCHESTRATOR: Listen for domain changes from MENU =====
window.addEventListener('myio:switch-main-state', (ev) => {
  console.log("[MAIN] [Orchestrator] Main state switch received:", ev.detail);
  const { targetStateId } = ev.detail;

  // Map state ID to domain
  const DOMAIN_BY_STATE = {
    'content_equipments': 'energy',  // Default
    'content_energy': 'energy',
    'content_water': 'water',
    'content_temperature': 'temperature'
  };

  const domain = DOMAIN_BY_STATE[targetStateId] || 'energy';
  MyIOOrchestrator.setActiveDomain(domain);

  console.log(`[MAIN] [Orchestrator] Domain set to: ${domain} for state: ${targetStateId}`);
});
```

---

### Fix 4: Update EQUIPMENTS Widget for Domain Filtering

**File**: `C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\EQUIPEMTNS\controller.js`

**ADD** domain awareness to data rendering (around line 680):

**BEFORE** `self.onInit`:
```javascript
self.onInit = async function () {
  setTimeout(async () => {
    // ... existing code ...
```

**AFTER** (add domain check):
```javascript
self.onInit = async function () {
  // ✅ Check active domain from orchestrator
  const currentDomain = window.MyIOOrchestrator?.getActiveDomain?.() || 'energy';
  console.log(`[EQUIPMENTS] Initializing for domain: ${currentDomain}`);

  setTimeout(async () => {
    // Show loading overlay immediately (FIX from previous improvement plan)
    showLoadingOverlay(true);

    // ... existing code ...

    // ✅ Filter devices by domain when rendering
    const relevantDevices = devicesList.filter(device => {
      // Domain-specific filtering logic
      // For now, show all devices in energy domain
      // Future: add device.domain property check
      return currentDomain === 'energy';
    });

    console.log(`[EQUIPMENTS] Filtered ${relevantDevices.length} devices for domain ${currentDomain}`);

    // Continue with rendering using relevantDevices instead of devicesList
```

---

### Fix 5: Update ENERGY Widget for Domain Filtering

**File**: `C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\V1.0.0\ENERGY\controller.js`

**Current State**: Widget only has Chart.js mock data (lines 1-60)

**Enhancement Required**: Add real data handling

**REPLACE** entire controller with:
```javascript
/* global self, ctx */

// Debug configuration
const DEBUG_ACTIVE = false;

// LogHelper utility
const LogHelper = {
  log: function(...args) {
    if (DEBUG_ACTIVE) {
      console.log(...args);
    }
  },
  warn: function(...args) {
    if (DEBUG_ACTIVE) {
      console.warn(...args);
    }
  },
  error: function(...args) {
    if (DEBUG_ACTIVE) {
      console.error(...args);
    }
  }
};

self.onInit = async function() {
  // ✅ Check active domain
  const currentDomain = window.MyIOOrchestrator?.getActiveDomain?.() || 'energy';

  if (currentDomain !== 'energy') {
    console.log(`[ENERGY] Widget disabled for domain: ${currentDomain}`);
    // Hide widget or show "not applicable" message
    return;
  }

  console.log("[ENERGY] Initializing energy charts...");

  // ===== LISTEN FOR ENERGY DATA FROM ORCHESTRATOR =====
  window.addEventListener('myio:energy-data-ready', (ev) => {
    console.log("[ENERGY] Received energy data:", ev.detail);
    const { cache } = ev.detail;

    // Update charts with real data
    updateCharts(cache);
  });

  // Initialize charts with empty state
  initializeCharts();
}

function initializeCharts() {
  // Line chart for consumption over time
  const lineCtx = document.getElementById("lineChart")?.getContext("2d");
  if (lineCtx) {
    window.energyLineChart = new Chart(lineCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Consumo Real",
          data: [],
          borderColor: "#2563eb",
          backgroundColor: "transparent",
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } }
      }
    });
  }

  // Pie chart for distribution by device type
  const pieCtx = document.getElementById("pieChart")?.getContext("2d");
  if (pieCtx) {
    window.energyPieChart = new Chart(pieCtx, {
      type: "doughnut",
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: ["#3b82f6","#8b5cf6","#f59e0b","#ef4444","#10b981","#a3e635"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "right",
            labels: { usePointStyle: true }
          }
        },
        cutout: "70%"
      }
    });
  }

  console.log("[ENERGY] Charts initialized with empty state");
}

function updateCharts(energyCache) {
  if (!energyCache || energyCache.size === 0) {
    console.log("[ENERGY] No data to display");
    return;
  }

  // Convert cache to array for processing
  const devices = Array.from(energyCache.values());

  // Update pie chart with distribution
  if (window.energyPieChart) {
    const labels = devices.map(d => d.name);
    const data = devices.map(d => d.total_value || 0);

    window.energyPieChart.data.labels = labels;
    window.energyPieChart.data.datasets[0].data = data;
    window.energyPieChart.update();

    console.log(`[ENERGY] Pie chart updated with ${devices.length} devices`);
  }

  // TODO: Update line chart with time-series data when available
  console.log("[ENERGY] Charts updated successfully");
}

self.onDestroy = function() {
  // Cleanup charts
  if (window.energyLineChart) {
    window.energyLineChart.destroy();
    delete window.energyLineChart;
  }
  if (window.energyPieChart) {
    window.energyPieChart.destroy();
    delete window.energyPieChart;
  }
};
```

---

## 📊 Testing Plan

### Test Case 1: Date Picker Behavior
**Steps**:
1. Open MYIO-SIM 1.0.0
2. Click on date picker to change dates
3. Verify NO data fetch occurs (check Network tab)
4. Click "Carregar" button
5. Verify data fetch occurs (check Network tab)
6. Verify all widgets update with new data

**Expected Result**: ✅ Data only fetches on "Carregar" click

---

### Test Case 2: HEADER Energy Card Update
**Steps**:
1. Load MYIO-SIM with initial date range
2. Verify energy card shows correct total
3. Change date range and click "Carregar"
4. Verify energy card updates with new total
5. Repeat with different date ranges

**Expected Result**: ✅ Energy card always updates with fresh data

---

### Test Case 3: Domain Filtering
**Steps**:
1. Switch to "Equipamentos" view (energy domain)
2. Verify EQUIPMENTS widget shows energy devices
3. Switch to "Água" view (water domain)
4. Verify EQUIPMENTS widget filters to water devices
5. Verify ENERGY widget is hidden or disabled

**Expected Result**: ✅ Widgets respect domain filtering

---

## 📝 Implementation Checklist

- [ ] **Fix 1: Date Picker**
  - [ ] Remove `myio:update-date` dispatch from `onApply` callback
  - [ ] Update `onApply` to only store dates internally
  - [ ] Create "Carregar" button handler
  - [ ] Add "Carregar" button to template (if missing)
  - [ ] Add CSS styles for button

- [ ] **Fix 2: HEADER Energy Card**
  - [ ] Remove early return logic from `updateEnergyCard()`
  - [ ] Add detailed logging to `updateEnergyCard()`
  - [ ] Verify event listener registration

- [ ] **Fix 3: Domain Handling**
  - [ ] Add domain tracking to orchestrator
  - [ ] Listen for `myio:switch-main-state` events
  - [ ] Dispatch `myio:domain-changed` events

- [ ] **Fix 4: EQUIPMENTS Widget**
  - [ ] Add domain awareness to `onInit`
  - [ ] Implement device filtering by domain
  - [ ] Move `showLoadingOverlay(true)` before setTimeout (from previous fix)

- [ ] **Fix 5: ENERGY Widget**
  - [ ] Replace mock implementation with real data handling
  - [ ] Listen for `myio:energy-data-ready` events
  - [ ] Update charts with real cache data

- [ ] **Testing**
  - [ ] Test date picker behavior (no auto-fetch)
  - [ ] Test "Carregar" button (explicit fetch)
  - [ ] Test HEADER energy card updates
  - [ ] Test domain filtering (energy/water/temperature)
  - [ ] Test cross-widget data flow

---

## 🎯 Success Criteria

1. ✅ Date picker does NOT trigger data fetch on selection
2. ✅ "Carregar" button explicitly triggers data fetch
3. ✅ HEADER energy card updates correctly on data changes
4. ✅ EQUIPMENTS widget filters devices by domain
5. ✅ ENERGY widget shows domain-specific data
6. ✅ No unnecessary API calls
7. ✅ Consistent behavior with v-5.2.0 patterns

---

## 🔄 Rollback Plan

If issues occur after implementation:

1. **Rollback Fix 1** (Date Picker):
   ```bash
   git checkout HEAD -- src/MYIO-SIM/V1.0.0/MENU/controller.js
   ```

2. **Rollback Fix 2** (HEADER):
   ```bash
   git checkout HEAD -- src/MYIO-SIM/V1.0.0/HEADER/controller.js
   ```

3. **Rollback All Changes**:
   ```bash
   git checkout HEAD -- src/MYIO-SIM/V1.0.0/
   ```

---

## 📚 Related Documents

- `MYIO-SIM-MENU-LIMPAR-BUTTON-IMPROVEMENTS.md` - LIMPAR button and ShowBusy fixes
- `RFC-0042` - Domain-based data handling (v-5.2.0 reference)
- `RFC-0045-EnergyModalView-Comparison-Mode.md` - Energy modal enhancements

---

## 📅 Timeline

- **Investigation**: ✅ Complete (2025-10-16)
- **Fix Plan Creation**: ✅ Complete (2025-10-16)
- **Implementation**: ⏳ Pending
- **Testing**: ⏳ Pending
- **Deployment**: ⏳ Pending

---

## ✍️ Author Notes

This fix plan addresses critical UX and performance issues in MYIO-SIM 1.0.0. The root cause is a deviation from the v-5.2.0 architecture where date selection and data fetching were properly decoupled.

**Key Insight**: v-5.2.0 uses a clear separation of concerns:
- **Date picker** → Stores selection
- **"Carregar" button** → Triggers fetch
- **Orchestrator** → Manages cache and propagation
- **Domain events** → Enable/disable widgets based on active domain

MYIO-SIM 1.0.0 attempted to simplify this but introduced the auto-fetch bug. This plan restores the correct architecture while maintaining MYIO-SIM's widget structure.

---

**Status**: ✅ Ready for Implementation
**Priority**: 🔴 Critical
**Complexity**: 🟡 Medium (4-6 hours estimated)
