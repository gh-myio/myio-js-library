# RFC-0100: Temperature Data Migration to MAIN Orchestrator

- **Feature Name:** `temperature_main_orchestrator_migration`
- **Start Date:** 2025-12-08
- **RFC PR:** N/A
- **Status:** Draft

## Summary

Migrate all temperature data fetching logic from the HEADER widget to the MAIN orchestrator, following the established pattern used for Energy and Water domains. This ensures a single source of truth for temperature data and reduces redundant API calls.

## Motivation

Currently, the HEADER widget (`src/MYIO-SIM/v5.2.0/HEADER`) contains:

1. **Datasource aliases** for temperature:
   - `AllTemperatureDevices` with dataKeys: `temperature`, `ownerName`, `connectionStatus`
   - `customers` alias with dataKeys: `minTemperature`, `maxTemperature`

2. **Data fetching functions**:
   - `extractTemperatureRangesByShopping()` - Extracts min/max temperature ranges from `self.ctx.data`
   - `fetchTemperatureAveragesByShopping()` - Fetches temperature averages via ThingsBoard API
   - `extractDevicesWithDetails()` - Extracts device details from context data

This architecture has several problems:

1. **Data duplication** - MAIN already has `AllTemperatureDevices` datasource with additional `ingestionId`
2. **Inconsistent patterns** - Energy and Water use MAIN orchestrator for data fetching, but Temperature uses HEADER
3. **Tight coupling** - HEADER depends on `self.ctx.data` which limits reusability
4. **Multiple API calls** - Each widget fetches its own data instead of using cached data
5. **Filter complexity** - RFC-0099 temperature filtering relies on HEADER having all shopping data

By migrating to MAIN orchestrator, we achieve:

- Single source of truth for temperature data
- Consistent architecture across all domains (Energy, Water, Temperature)
- Centralized caching and filter handling
- Reduced API calls via shared cache
- Cleaner separation of concerns (MAIN fetches, HEADER displays)

## Guide-level Explanation

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         HEADER Widget                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Datasources:                                             │    │
│  │  - AllTemperatureDevices (temperature, ownerName, etc)   │    │
│  │  - customers (minTemperature, maxTemperature)            │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Functions:                                               │    │
│  │  - extractTemperatureRangesByShopping()                  │    │
│  │  - fetchTemperatureAveragesByShopping()                  │    │
│  │  - extractDevicesWithDetails()                           │    │
│  │  - updateTemperatureCard()                               │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MAIN Orchestrator                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Datasources:                                             │    │
│  │  - AllTemperatureDevices (temperature, ownerName,        │    │
│  │    connectionStatus, ingestionId)                        │    │
│  │  - customers (minTemperature, maxTemperature)            │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ MyIOOrchestrator (window.MyIOOrchestrator):              │    │
│  │  - fetchTemperatureData()                                │    │
│  │  - getTemperatureCache()                                 │    │
│  │  - getTemperatureRanges()                                │    │
│  │  - getTemperatureAverages()                              │    │
│  │  - setSelectedShoppings() (already exists)               │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Events Emitted:                                          │    │
│  │  - myio:temperature-data-ready                           │    │
│  │  - myio:temperature-ranges-ready                         │    │
│  │  - myio:temperature-averages-ready                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Events
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         HEADER Widget                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Listeners:                                               │    │
│  │  - myio:temperature-data-ready                           │    │
│  │  - myio:temperature-ranges-ready                         │    │
│  │  - myio:temperature-averages-ready                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Functions (display only):                                │    │
│  │  - updateTemperatureCard(data)                           │    │
│  │  - renderTemperatureKPI()                                │    │
│  │  - renderTemperatureChip()                               │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Usage After Migration

```javascript
// HEADER widget - simplified, display-only
window.addEventListener('myio:temperature-data-ready', (ev) => {
  const { averages, ranges, globalAvg, filteredAvg, isFiltered } = ev.detail;
  updateTemperatureCard({ averages, ranges, globalAvg, filteredAvg, isFiltered });
});

// Request temperature data (if not already loaded)
window.dispatchEvent(new CustomEvent('myio:request-temperature-data'));
```

## Reference-level Explanation

### Phase 1: Consolidate Datasources in MAIN

#### Current MAIN Datasources
MAIN already has `AllTemperatureDevices` with:
- `temperature`
- `ownerName`
- `connectionStatus`
- `ingestionId` (additional)

#### Required Additions to MAIN
Add `customers` datasource with temperature range keys:
- `minTemperature`
- `maxTemperature`

### Phase 2: Migrate Functions to MyIOOrchestrator

#### Functions to Migrate

| Function | Source | Destination | Changes |
|----------|--------|-------------|---------|
| `extractDevicesWithDetails()` | HEADER | MAIN | Use MAIN's `ctx.data` |
| `extractTemperatureRangesByShopping()` | HEADER | MAIN | Use MAIN's `ctx.data` |
| `fetchTemperatureAveragesByShopping()` | HEADER | MAIN | Add caching, use orchestrator state |
| `calcularMedia()` | HEADER | MAIN | No changes needed |

#### New MyIOOrchestrator Methods

```typescript
interface MyIOOrchestrator {
  // Existing methods...

  // RFC-0100: Temperature methods
  fetchTemperatureData(startTs: number, endTs: number): Promise<TemperatureCache>;
  getTemperatureCache(): TemperatureCache | null;
  getTemperatureRanges(): Map<string, TemperatureRange>;
  getTemperatureAverages(): Map<string, TemperatureAverage>;
  getGlobalTemperatureAvg(): number | null;
  getFilteredTemperatureAvg(): number | null;
}

interface TemperatureCache {
  devices: Map<string, DeviceTemperatureData>;
  ranges: Map<string, TemperatureRange>;
  averages: Map<string, TemperatureAverage>;
  globalAvg: number | null;
  filteredAvg: number | null;
  fetchTimestamp: number;
}

interface TemperatureRange {
  min: number;
  max: number;
  entityLabel: string;
}

interface TemperatureAverage {
  avg: number;
  ownerName: string;
  deviceCount: number;
}

interface DeviceTemperatureData {
  id: string;
  ownerName: string;
  connectionStatus: string;
  ingestionId: string;
  temperatures: Array<{ ts: number; value: number }>;
}
```

#### Implementation in MAIN

```javascript
// Add to MyIOOrchestrator in MAIN/controller.js

// ============================================
// RFC-0100: TEMPERATURE DATA MANAGEMENT
// ============================================

let temperatureCache = null;
let temperatureRanges = new Map();
let temperatureAverages = new Map();

/**
 * Extract temperature ranges from ctx.data (customers datasource)
 * @returns {Map<string, {min: number, max: number, entityLabel: string}>}
 */
function extractTemperatureRanges() {
  const rangesMap = new Map();

  self.ctx.data.forEach((data) => {
    // Look for customers datasource with temperature ranges
    if (data.datasource?.aliasName !== 'customers') return;

    const entityLabel = data.datasource?.entityLabel || 'Unknown';
    const entityId = data.datasource?.entityId || entityLabel;

    if (!rangesMap.has(entityId)) {
      rangesMap.set(entityId, { min: null, max: null, entityLabel });
    }

    const entry = rangesMap.get(entityId);

    if (data.dataKey?.name === 'maxTemperature' && data.data?.[0]?.[1] != null) {
      entry.max = Number(data.data[0][1]);
    }
    if (data.dataKey?.name === 'minTemperature' && data.data?.[0]?.[1] != null) {
      entry.min = Number(data.data[0][1]);
    }
  });

  // Filter only valid ranges
  const validRanges = new Map();
  rangesMap.forEach((value, key) => {
    if (value.min != null && value.max != null) {
      validRanges.set(key, value);
    }
  });

  temperatureRanges = validRanges;
  return validRanges;
}

/**
 * Extract temperature devices from ctx.data
 * @returns {Array<DeviceTemperatureData>}
 */
function extractTemperatureDevices() {
  const deviceMap = new Map();

  self.ctx.data.forEach((data) => {
    if (data.datasource?.aliasName !== 'AllTemperatureDevices') return;

    const entityId = data.datasource?.entityId?.id ||
                     data.datasource?.entity?.id?.id ||
                     data.datasource?.entityId;

    if (!entityId) return;

    let device = deviceMap.get(entityId) || {
      id: entityId,
      ownerName: null,
      connectionStatus: null,
      ingestionId: null,
    };

    const keyName = data.dataKey?.name;
    const value = data.data?.[0]?.[1];

    if (keyName === 'ownerName' && value) {
      device.ownerName = value;
    }
    if (keyName === 'connectionStatus' && value) {
      device.connectionStatus = value;
    }
    if (keyName === 'ingestionId' && value) {
      device.ingestionId = value;
    }

    deviceMap.set(entityId, device);
  });

  return Array.from(deviceMap.values());
}

/**
 * Fetch temperature averages for all devices
 * @param {number} startTs - Start timestamp
 * @param {number} endTs - End timestamp
 * @returns {Promise<Map<string, TemperatureAverage>>}
 */
async function fetchTemperatureAverages(startTs, endTs) {
  const tbToken = localStorage.getItem('jwt_token');
  if (!tbToken) {
    LogHelper.warn('[MAIN] JWT not found for temperature fetch');
    return new Map();
  }

  const devices = extractTemperatureDevices();
  const shoppingTemps = new Map();

  for (const device of devices) {
    try {
      const url = `/api/plugins/telemetry/DEVICE/${device.id}/values/timeseries` +
        `?keys=temperature` +
        `&startTs=${encodeURIComponent(startTs)}` +
        `&endTs=${encodeURIComponent(endTs)}` +
        `&limit=50000` +
        `&intervalType=MILLISECONDS` +
        `&interval=7200000` +
        `&agg=AVG`;

      const response = await fetch(url, {
        headers: {
          'X-Authorization': `Bearer ${tbToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const temperatureData = data.temperature || [];

      // Calculate average
      const sum = temperatureData.reduce((acc, t) => acc + parseFloat(t.value || 0), 0);
      const avg = temperatureData.length > 0 ? sum / temperatureData.length : null;

      if (avg != null && !isNaN(avg)) {
        const ownerName = device.ownerName || 'Unknown';
        if (!shoppingTemps.has(ownerName)) {
          shoppingTemps.set(ownerName, { temps: [], ownerName, deviceCount: 0 });
        }
        const entry = shoppingTemps.get(ownerName);
        entry.temps.push(avg);
        entry.deviceCount++;
      }
    } catch (err) {
      LogHelper.error(`[MAIN] Error fetching temperature for device ${device.id}:`, err);
    }
  }

  // Calculate average per shopping
  const result = new Map();
  shoppingTemps.forEach((value, key) => {
    const sum = value.temps.reduce((a, b) => a + b, 0);
    const avg = value.temps.length > 0 ? sum / value.temps.length : null;
    result.set(key, { avg, ownerName: value.ownerName, deviceCount: value.deviceCount });
  });

  temperatureAverages = result;
  return result;
}

/**
 * Main temperature data fetch function
 * @param {number} startTs - Start timestamp
 * @param {number} endTs - End timestamp
 * @returns {Promise<TemperatureCache>}
 */
async function fetchTemperatureData(startTs, endTs) {
  LogHelper.log('[MAIN] RFC-0100: Fetching temperature data...');

  // Extract ranges from ctx.data
  const ranges = extractTemperatureRanges();

  // Fetch averages from API
  const averages = await fetchTemperatureAverages(startTs, endTs);

  // Calculate global average
  let globalSum = 0;
  let globalCount = 0;
  averages.forEach((avgData) => {
    if (avgData.avg != null) {
      globalSum += avgData.avg;
      globalCount++;
    }
  });
  const globalAvg = globalCount > 0 ? globalSum / globalCount : null;

  // Calculate filtered average based on selected shoppings
  let filteredAvg = globalAvg;
  const selectedIds = selectedShoppingIds || [];
  const isFiltered = selectedIds.length > 0 && selectedIds.length < averages.size;

  if (isFiltered) {
    const selectedNames = (window.custumersSelected || []).map(s => s.name);
    const normalize = (str) => (str || '').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').trim();

    let filteredSum = 0;
    let filteredCount = 0;

    averages.forEach((avgData, ownerName) => {
      if (avgData.avg == null) return;
      const normalizedOwner = normalize(ownerName);
      const isSelected = selectedNames.some(name => {
        const normalizedName = normalize(name);
        return normalizedOwner === normalizedName ||
               normalizedOwner.includes(normalizedName) ||
               normalizedName.includes(normalizedOwner);
      });

      if (isSelected) {
        filteredSum += avgData.avg;
        filteredCount++;
      }
    });

    filteredAvg = filteredCount > 0 ? filteredSum / filteredCount : globalAvg;
  }

  // Build cache
  temperatureCache = {
    devices: extractTemperatureDevices(),
    ranges,
    averages,
    globalAvg,
    filteredAvg,
    isFiltered,
    fetchTimestamp: Date.now(),
  };

  // Dispatch event for HEADER and other widgets
  window.dispatchEvent(new CustomEvent('myio:temperature-data-ready', {
    detail: temperatureCache,
  }));

  LogHelper.log('[MAIN] RFC-0100: Temperature data ready:', {
    deviceCount: temperatureCache.devices.length,
    rangeCount: ranges.size,
    averageCount: averages.size,
    globalAvg,
    filteredAvg,
    isFiltered,
  });

  return temperatureCache;
}

// Add to MyIOOrchestrator object
window.MyIOOrchestrator = {
  ...window.MyIOOrchestrator,

  // RFC-0100: Temperature methods
  fetchTemperatureData,
  getTemperatureCache: () => temperatureCache,
  getTemperatureRanges: () => temperatureRanges,
  getTemperatureAverages: () => temperatureAverages,
  getGlobalTemperatureAvg: () => temperatureCache?.globalAvg,
  getFilteredTemperatureAvg: () => temperatureCache?.filteredAvg,
};
```

### Phase 3: Update HEADER to Use Events

```javascript
// HEADER/controller.js - simplified updateTemperatureCard

async function updateTemperatureCard(data = null) {
  const tempKpi = document.getElementById('temp-kpi');
  const tempTrend = document.getElementById('temp-trend');
  const tempChip = document.querySelector('#card-temp .chip');

  // If data not provided, request from orchestrator
  if (!data) {
    // Check cache first
    data = window.MyIOOrchestrator?.getTemperatureCache?.();

    if (!data) {
      // Request fresh data
      window.dispatchEvent(new CustomEvent('myio:request-temperature-data'));
      return; // Will be called again when data is ready
    }
  }

  const { globalAvg, filteredAvg, isFiltered, ranges, averages } = data;

  // RFC-0099: Update KPI with comparative display
  if (tempKpi) {
    tempKpi.style.fontSize = '0.85em';

    const showComparative = isFiltered && globalAvg != null && filteredAvg != null &&
                            Math.abs(filteredAvg - globalAvg) > 0.05;

    if (showComparative) {
      tempKpi.innerHTML = `${filteredAvg.toFixed(1)}°C <span style="font-size: 0.65em; color: #666;">/ ${globalAvg.toFixed(1)}°C</span>`;

      const percentageDiff = ((filteredAvg - globalAvg) / globalAvg) * 100;
      const absDiff = Math.abs(percentageDiff).toFixed(0);
      const isAbove = percentageDiff > 0;

      if (tempTrend) {
        const diffLabel = isAbove ? 'acima da média' : 'abaixo da média';
        const diffColor = isAbove ? '#f57c00' : '#0288d1';
        tempTrend.innerHTML = `<span style="color: ${diffColor};">${absDiff}% ${diffLabel}</span>`;
      }
    } else {
      tempKpi.innerText = globalAvg != null ? `${globalAvg.toFixed(1)}°C` : '--°C';
      if (tempTrend) tempTrend.innerText = '';
    }
  }

  // Update chip status (existing logic simplified)
  updateTemperatureChip(tempChip, averages, ranges);
}

// Listen for temperature data from MAIN
window.addEventListener('myio:temperature-data-ready', (ev) => {
  LogHelper.log('[HEADER] RFC-0100: Received temperature data from MAIN');
  updateTemperatureCard(ev.detail);
});
```

### Phase 4: Add Event Listeners in MAIN

```javascript
// MAIN/controller.js - event listeners

// Request temperature data
window.addEventListener('myio:request-temperature-data', async () => {
  const startTs = window.__MYIO_CURRENT_START_DATE__
    ? new Date(window.__MYIO_CURRENT_START_DATE__).getTime()
    : Date.now() - 7 * 24 * 60 * 60 * 1000;
  const endTs = window.__MYIO_CURRENT_END_DATE__
    ? new Date(window.__MYIO_CURRENT_END_DATE__).getTime()
    : Date.now();

  await window.MyIOOrchestrator.fetchTemperatureData(startTs, endTs);
});

// Refresh temperature on filter change
window.addEventListener('myio:filter-applied', async (ev) => {
  // ... existing filter logic ...

  // RFC-0100: Refresh temperature with new filter
  if (temperatureCache) {
    await window.MyIOOrchestrator.fetchTemperatureData(
      temperatureCache.startTs,
      temperatureCache.endTs
    );
  }
});

// Refresh temperature on date change
window.addEventListener('myio:update-date', async (ev) => {
  // ... existing date logic ...

  // RFC-0100: Refresh temperature with new dates
  const startTs = new Date(ev.detail.startDate).getTime();
  const endTs = new Date(ev.detail.endDate).getTime();
  await window.MyIOOrchestrator.fetchTemperatureData(startTs, endTs);
});
```

## Drawbacks

1. **Migration complexity** - Requires careful coordination between MAIN and HEADER
2. **Temporary duplication** - During migration, both widgets may have temperature logic
3. **Datasource changes** - Need to add `customers` datasource to MAIN widget configuration
4. **Testing overhead** - All temperature-related features need re-testing

## Rationale and Alternatives

### Why this design?

1. **Consistency** - Follows established pattern for Energy and Water domains
2. **Single source of truth** - All data fetching in one place
3. **Better caching** - Orchestrator can manage cache lifecycle
4. **Filter integration** - Orchestrator already handles shopping filter state
5. **Reduced complexity** - HEADER becomes display-only

### Alternatives Considered

1. **Keep in HEADER** - Rejected; inconsistent with other domains
2. **Duplicate in both** - Rejected; maintenance burden, data inconsistency
3. **Create separate TEMPERATURE widget** - Rejected; over-engineering for current needs

## Prior Art

- **RFC-0042** - Main View Orchestrator pattern
- **RFC-0093** - Energy data orchestration
- **RFC-0087** - Water data orchestration
- **RFC-0099** - Temperature filter comparison (uses this data)

## Unresolved Questions

1. Should temperature data be cached with the same TTL as Energy/Water?
2. How to handle devices without ownerName (unknown shopping)?
3. Should we add temperature to the ingestion API for consistency?

## Future Possibilities

1. **Temperature Alerts** - MAIN can emit alerts when temperatures exceed ranges
2. **Real-time Updates** - WebSocket integration for live temperature data
3. **Historical Comparison** - Compare temperature trends across periods
4. **Temperature API** - Migrate to ingestion API like Energy/Water

## Implementation Plan

### Phase 1: Datasource Migration (Day 1)
1. Verify MAIN has `AllTemperatureDevices` datasource with all required keys
2. Add `customers` datasource to MAIN with `minTemperature`, `maxTemperature`
3. Test datasource configuration in ThingsBoard

### Phase 2: Function Migration (Day 2)
1. Copy `extractTemperatureRangesByShopping()` to MAIN
2. Copy `fetchTemperatureAveragesByShopping()` to MAIN
3. Copy `extractDevicesWithDetails()` to MAIN
4. Copy `calcularMedia()` helper to MAIN
5. Wrap functions in MyIOOrchestrator object

### Phase 3: Event System (Day 3)
1. Add `myio:temperature-data-ready` event emission in MAIN
2. Add `myio:request-temperature-data` listener in MAIN
3. Add event listener in HEADER for `myio:temperature-data-ready`
4. Update `updateTemperatureCard()` to accept data parameter

### Phase 4: HEADER Cleanup (Day 4)
1. Remove datasource configuration from HEADER widget
2. Remove data fetching functions from HEADER
3. Keep only display/render functions
4. Test RFC-0099 comparative display still works

### Phase 5: Testing & Documentation (Day 5)
1. Test filter interaction (MENU → MAIN → HEADER)
2. Test date range changes
3. Test initial load without cache
4. Update HEADER documentation
5. Update MAIN documentation

## Appendix A: Files to Modify

| File | Changes |
|------|---------|
| `MAIN/controller.js` | Add temperature functions to MyIOOrchestrator |
| `MAIN/settings.schema` | Add `customers` datasource (if not present) |
| `HEADER/controller.js` | Remove data fetching, add event listener |
| `HEADER/settings.schema` | Remove temperature datasources |

## Appendix B: Event Flow Diagram

```
┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐
│  MENU  │     │  MAIN  │     │ HEADER │     │  USER  │
└───┬────┘     └───┬────┘     └───┬────┘     └───┬────┘
    │              │              │              │
    │ filter-applied              │              │
    ├─────────────►│              │              │
    │              │              │              │
    │              │ fetchTemperatureData()      │
    │              ├──────────┐   │              │
    │              │          │   │              │
    │              │◄─────────┘   │              │
    │              │              │              │
    │              │ temperature-data-ready      │
    │              ├─────────────►│              │
    │              │              │              │
    │              │              │ updateTemperatureCard()
    │              │              ├──────────┐   │
    │              │              │          │   │
    │              │              │◄─────────┘   │
    │              │              │              │
    │              │              │         UI Updated
    │              │              ├─────────────►│
    │              │              │              │
```

## Appendix C: Comparison with Current Architecture

| Aspect | Current (HEADER) | Proposed (MAIN) |
|--------|------------------|-----------------|
| Data fetching | HEADER widget | MAIN orchestrator |
| Caching | None | MyIOOrchestrator cache |
| Filter handling | HEADER reads window.custumersSelected | Orchestrator manages filter state |
| API calls | On every updateTemperatureCard() | Once, then cached |
| Code location | Scattered in HEADER | Centralized in MAIN |
| Pattern | Different from Energy/Water | Same as Energy/Water |
