# RFC-0042 Implementation Status

**Date:** 2025-10-02
**Status:** Core Implementation Complete
**Next Steps:** FOOTER widget enhancement, Debug overlay, Testing

---

## ✅ Completed Tasks

### 1. MAIN_VIEW Widget - Orchestrator Core
**File:** `v-4.0.0/WIDGET/MAIN_VIEW/controller.js`

**Implemented:**
- ✅ Utility functions: `toISO()`, `calcGranularity()`, `cacheKey()`, `normalizeIngestionRow()`, `isValidUUID()`
- ✅ MyIOOrchestrator singleton with:
  - Request coalescing (inFlight Map)
  - Abortable fetches (AbortController)
  - LRU + TTL cache (memCache Map)
  - Stale-while-revalidate hydration
  - Token manager (in-memory only)
  - Metrics tracking
- ✅ Event listeners for:
  - `myio:update-date`
  - `myio:dashboard-state`
  - `myio:telemetry:request-data`
- ✅ Event emitters:
  - `myio:telemetry:provide-data`
  - `myio:orchestrator:cache-hydrated`
  - `myio:orchestrator:error`
  - `myio:token-expired`
  - `myio:token-rotated`
- ✅ Cleanup interval (10 min)
- ✅ Telemetry reporting (5 min)
- ✅ Global API exposure: `window.MyIOOrchestrator`

**Settings Schema:** `v-4.0.0/WIDGET/MAIN_VIEW/settings.schema`
- ✅ cacheTtlMinutes (default: 5)
- ✅ enableStaleWhileRevalidate (default: true)
- ✅ maxCacheSize (default: 50)
- ✅ debugMode (default: false)
- ✅ domainsEnabled (energy, water, temperature)

---

### 2. HEADER Widget - Standardized Period Emission
**File:** `v-4.0.0/WIDGET/HEADER/controller.js`

**Changes:**
- ✅ Added utility functions (`toISO`, `calcGranularity`) with fallback to global
- ✅ Updated `btnLoad` click handler:
  - Converts dates to ISO with timezone (`America/Sao_Paulo`)
  - Calculates granularity (hour/day/month)
  - Emits standardized `Period` object via `myio:update-date`
  - Backward compatibility: emits `myio:update-date-legacy`
- ✅ Updated `btnGen` (All-Report modal):
  - Checks orchestrator cache before building items
  - Uses cached data if available
  - Falls back to TB datasources on cache miss
  - Error handling with user feedback

**Key Lines:**
- Line 137-163: Utility functions
- Line 223-246: btnLoad handler (period emission)
- Line 248-293: btnGen handler (cache-aware modal)

---

### 3. MENU Widget - Tab Change Events
**File:** `v-4.0.0/WIDGET/MENU/controller.js`

**Changes:**
- ✅ Added `DOMAIN_BY_STATE` mapping constant
- ✅ Updated `changeDashboardState()`:
  - Maps ThingsBoard state IDs to domains
  - Emits `myio:dashboard-state` event on tab switch
  - Logs tab changes for debugging

**Key Lines:**
- Line 8-14: Domain mapping
- Line 22-29: Tab change emission

---

### 4. TELEMETRY Widget - Listen-Only Mode
**File:** `v-4.0.0/WIDGET/TELEMETRY/controller.js`

**Changes:**
- ✅ Added widget configuration variables: `WIDGET_DOMAIN`, `WIDGET_GROUP_TYPE`
- ✅ Added `dataProvideHandler` for orchestrator data
- ✅ Implemented data filtering logic:
  - Filters by datasource IDs
  - Filters by GROUP_TYPE (for Energy columns)
  - Deduplicates and validates selections
- ✅ Added `extractDatasourceIds()` utility function
- ✅ Updated `onDestroy()` to remove data listener
- ✅ Set configuration from settings in `onInit()`

**Key Lines:**
- Line 15, 20-21: Handler and config variables
- Line 817-880: Data provision listener and filtering
- Line 949-951: Listener cleanup in onDestroy

**Settings Schema:** `v-4.0.0/WIDGET/TELEMETRY/settings.schema`
- ✅ DOMAIN (energy/water/temperature)
- ✅ GROUP_TYPE (entry_meters/common_area/stores/substation)
- ✅ Required fields: customerTB_ID, DOMAIN

---

## ⏳ Pending Tasks

### 5. FOOTER Widget - Selection Limits
**File:** `v-4.0.0/WIDGET/FOOTER/controller.js`

**Required:**
- Add listener for `myio:footer:update-selection` event
- Enforce 6-item selection limit
- Show toast notification on overflow
- Deduplicate selections
- Sync with MyIOSelectionStore
- Update `destroy()` to remove listener

**Implementation:**
```javascript
// After line 356 in bindEvents()
this.boundFooterUpdate = (ev) => {
  const { selectedIds, count } = ev.detail;
  const MAX_SELECTION = 6;

  if (count > MAX_SELECTION) {
    if (window.MyIOLibrary?.showToast) {
      window.MyIOLibrary.showToast({
        message: `Máximo de ${MAX_SELECTION} itens permitidos.`,
        type: 'warning',
        duration: 3000
      });
    }

    const truncated = selectedIds.slice(-MAX_SELECTION);
    const { MyIOSelectionStore } = window.MyIOLibrary;
    MyIOSelectionStore.clear();
    truncated.forEach(id => MyIOSelectionStore.add(id));
    return;
  }

  // Sync with store (deduplicate)
  const { MyIOSelectionStore } = window.MyIOLibrary;
  const current = new Set(MyIOSelectionStore.getSelectedEntities().map(e => e.id));
  const target = new Set(selectedIds);

  for (const id of target) {
    if (!current.has(id)) MyIOSelectionStore.add(id);
  }

  for (const id of current) {
    if (!target.has(id)) MyIOSelectionStore.remove(id);
  }

  this.renderDock();
};

window.addEventListener('myio:footer:update-selection', this.boundFooterUpdate);

// In destroy()
window.removeEventListener('myio:footer:update-selection', this.boundFooterUpdate);
```

---

### 6. Debug Overlay
**Files:** `v-4.0.0/WIDGET/MAIN_VIEW/template.html`, `controller.js`

**Required:**
- Add HTML overlay to template.html
- Add keyboard listener (Ctrl+Shift+D)
- Implement `updateDebugOverlay()` function
- Add auto-update interval (2s)
- Expose `window.MyIOOrchestratorDebug`

**HTML Template:**
```html
<!-- Add to template.html -->
<div id="myio-orchestrator-debug" style="display: none; position: fixed; bottom: 80px; right: 20px; background: rgba(0,0,0,0.9); color: #0f0; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 11px; z-index: 99999; max-width: 400px; max-height: 400px; overflow-y: auto;">
  <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
    <strong>🔧 Orchestrator Debug</strong>
    <button onclick="document.getElementById('myio-orchestrator-debug').style.display='none'" style="background: none; border: none; color: #0f0; cursor: pointer;">×</button>
  </div>
  <div id="debug-content"></div>
</div>
```

**JavaScript (add to controller.js):**
```javascript
// After orchestrator definition
if (MyIOOrchestrator.config.debugMode) {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      const overlay = document.getElementById('myio-orchestrator-debug');
      if (overlay) {
        overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
        updateDebugOverlay();
      }
    }
  });

  function updateDebugOverlay() {
    const content = document.getElementById('debug-content');
    if (!content) return;

    const stats = MyIOOrchestrator.getCacheStats();
    const period = MyIOOrchestrator.getCurrentPeriod();

    content.innerHTML = `
      <div><strong>Visible Tab:</strong> ${MyIOOrchestrator.getVisibleTab()}</div>
      <div><strong>Period:</strong> ${period ? period.startISO.slice(0,10) + ' → ' + period.endISO.slice(0,10) : 'N/A'}</div>
      <div><strong>Granularity:</strong> ${period?.granularity || 'N/A'}</div>
      <hr style="border-color: #0f0; margin: 8px 0;">
      <div><strong>Cache Hit Rate:</strong> ${stats.hitRate.toFixed(1)}%</div>
      <div><strong>Total Requests:</strong> ${stats.totalRequests}</div>
      <div><strong>Cache Size:</strong> ${stats.cacheSize} entries</div>
      <div><strong>In-Flight:</strong> ${stats.inFlightCount} fetches</div>
      <hr style="border-color: #0f0; margin: 8px 0;">
      <div><strong>Last 5 Hydrations:</strong></div>
      <ul style="margin: 5px 0; padding-left: 20px; font-size: 10px;">
        ${MyIOOrchestrator.metrics.hydrationTimes.slice(-5).reverse().map(h =>
          `<li>${h.domain}: ${h.duration}ms (${h.fromCache ? 'CACHE' : 'FRESH'})</li>`
        ).join('')}
      </ul>
    `;
  }

  setInterval(() => {
    const overlay = document.getElementById('myio-orchestrator-debug');
    if (overlay && overlay.style.display !== 'none') {
      updateDebugOverlay();
    }
  }, 2000);
}

window.MyIOOrchestratorDebug = {
  getMetrics: () => MyIOOrchestrator.metrics,
  getCacheContents: () => Array.from(MyIOOrchestrator.memCache?.entries?.() || []),
  clearCache: () => MyIOOrchestrator.invalidateCache('*'),
  exportMetrics: () => {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: MyIOOrchestrator.metrics.generateTelemetrySummary(),
      cacheContents: Array.from(MyIOOrchestrator.memCache?.entries?.() || []).map(([key, entry]) => ({
        key,
        hydratedAt: new Date(entry.hydratedAt).toISOString(),
        itemCount: entry.data.length,
        ageSec: Math.round((Date.now() - entry.hydratedAt) / 1000)
      }))
    };
    console.log('[Orchestrator Debug Export]', JSON.stringify(data, null, 2));
    return data;
  }
};
```

---

## 🔧 Critical Missing Piece: Data Enrichment in Orchestrator

**Issue:** The orchestrator's `fetchAndEnrich()` function currently returns an empty array (line 436-440 in MAIN_VIEW/controller.js).

**Solution:** Extract and move the following functions from TELEMETRY widget to MAIN_VIEW orchestrator:

### Functions to Move:

1. **`buildAuthoritativeItems()`** (TELEMETRY line 276-318)
   - Builds device list from TB datasources
   - Resolves TB IDs and ingestion IDs
   - Extracts attributes (slaveId, centralId, deviceType)

2. **`buildTbAttrIndex()`** (TELEMETRY line 243-259)
   - Indexes TB attributes by entity ID

3. **`buildTbIdIndexes()`** (TELEMETRY line 260-273)
   - Creates identifier → tbId and ingestionId → tbId maps

4. **`enrichItemsWithTotals()`** (TELEMETRY line 344-357)
   - Joins TB device list with API totals
   - Calculates values and percentages

**Update `fetchAndEnrich()` in MAIN_VIEW:**
```javascript
async function fetchAndEnrich(domain, period) {
  switch (domain) {
    case 'energy':
    case 'water':
      // Get ThingsBoard device list (needs ctx from widget)
      // This is the challenge: orchestrator doesn't have ctx
      // SOLUTION: Widgets must provide their datasources via event

      // For now, fetch API totals only
      const apiMap = await fetchApiTotals(domain, period);

      // Emit raw API data for widgets to enrich locally
      return Array.from(apiMap.values());

    case 'temperature':
      // Temperature: TB-only (no ingestion)
      return [];

    default:
      throw new Error(`Unknown domain: ${domain}`);
  }
}
```

**Better Solution:** Have TELEMETRY widgets provide their datasources on init:
```javascript
// In TELEMETRY onInit
window.dispatchEvent(new CustomEvent('myio:telemetry:register', {
  detail: {
    domain: WIDGET_DOMAIN,
    datasources: self.ctx.datasources,
    data: self.ctx.data
  }
}));

// In orchestrator
const widgetRegistry = new Map(); // domain → { datasources, data }[]

window.addEventListener('myio:telemetry:register', (ev) => {
  const { domain, datasources, data } = ev.detail;
  if (!widgetRegistry.has(domain)) {
    widgetRegistry.set(domain, []);
  }
  widgetRegistry.get(domain).push({ datasources, data });
});

// Then in fetchAndEnrich
async function fetchAndEnrich(domain, period) {
  const widgets = widgetRegistry.get(domain) || [];
  if (widgets.length === 0) {
    console.warn(`[Orchestrator] No widgets registered for domain ${domain}`);
    return [];
  }

  // Merge all datasources from all widgets
  const allDatasources = widgets.flatMap(w => w.datasources);
  const allData = widgets.flatMap(w => w.data);

  // Build authoritative list
  const items = buildAuthoritativeItems(allDatasources, allData);

  // Fetch API totals
  const apiMap = await fetchApiTotals(domain, period);

  // Enrich
  return enrichItemsWithTotals(items, apiMap);
}
```

---

## 📋 Testing Checklist

### Unit Tests (Browser Console)
- [ ] `window.MyIOOrchestrator` is defined
- [ ] `window.MyIOOrchestrator.getCacheStats()` returns valid object
- [ ] `window.toISO(new Date())` returns ISO string with timezone
- [ ] `window.calcGranularity()` calculates correct granularity

### Integration Tests
- [ ] Click "Load" in HEADER → emits `myio:update-date` with Period object
- [ ] Switch tabs in MENU → emits `myio:dashboard-state` with domain
- [ ] TELEMETRY widgets receive data from orchestrator (check console logs)
- [ ] Cache hit on second Energy tab load (check `getCacheStats()`)
- [ ] Selection limit enforced at 6 items in FOOTER

### Performance Tests
- [ ] Single API call for 3 Energy widgets (check Network tab)
- [ ] Cache hit ratio > 70% after 1 min (check `getCacheStats()`)
- [ ] Memory usage < 10MB (check `getCacheStats().cacheSize`)

### Edge Cases
- [ ] DST boundary dates (Oct/Nov) handled correctly
- [ ] Rapid tab switching triggers request coalescing
- [ ] Token rotation invalidates cache
- [ ] Huge device sets (2000+) don't crash

---

## 🚀 Deployment Steps

1. **Phase 1: Enable Debug Mode**
   - Set `debugMode: true` in MAIN_VIEW settings
   - Test orchestrator in isolation
   - Verify no errors in console

2. **Phase 2: Enable One Domain**
   - Set `domainsEnabled.energy: true`, others `false`
   - Set TELEMETRY widgets to `DOMAIN: "energy"`
   - Test Energy tab only

3. **Phase 3: Enable All Domains**
   - Set all `domainsEnabled: true`
   - Configure Water and Temperature widgets
   - Test tab switching

4. **Phase 4: Monitor Metrics**
   - Check `window.MyIOOrchestrator.getCacheStats()`
   - Verify cache hit ratio > 70%
   - Check network calls reduced

5. **Phase 5: Production**
   - Set `debugMode: false`
   - Enable telemetry reporting
   - Monitor ThingsBoard for metrics

---

## 📖 Documentation

### For Developers
- See `RFC-0042-plan.md` for detailed implementation guide
- See `RFC-0042-main-view-orchestrator-shopping-shell.md` for architecture

### For Users
- Press `Ctrl+Shift+D` to toggle debug overlay (if debugMode enabled)
- Use `window.MyIOOrchestratorDebug.exportMetrics()` to export telemetry

---

## 🐛 Known Issues

1. **Data enrichment incomplete**: Orchestrator's `fetchAndEnrich()` needs widget datasources
2. **FOOTER selection limit**: Not yet implemented
3. **Debug overlay**: Not yet added to template
4. **Temperature domain**: No ingestion API integration yet

---

## ✨ Next Actions

1. Complete data enrichment in orchestrator (widget registration pattern)
2. Implement FOOTER selection limits
3. Add debug overlay
4. Test end-to-end with all 3 domains
5. Performance tuning and optimization

---

**Last Updated:** 2025-10-02
**Implementation Progress:** 70% Complete
