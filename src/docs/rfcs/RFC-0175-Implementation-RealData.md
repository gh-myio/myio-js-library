# RFC-0175: Implementation Plan - Replace Mock Data with Real Alarms Backend API

- **Start Date**: 2026-02-19
- **RFC PR**: N/A (draft)
- **Status**: Draft
- **Depends on**: RFC-0152 (Operational Indicators Panels), RFC-0175 (Alarms Real Usage)
- **Branch**: `fix/rfc-0152-real-data`

---

## Summary

This document is the **code-level implementation plan** for replacing mock data in RFC-0152 Operational Indicators panels with real data from the Alarms Backend API. It identifies every file that needs to be created or modified, the exact code changes required, and the order of implementation.

For the architectural design and API contracts, see `RFC-0175-AlarmsRealUsage.draft.md`.
For the backend team requirements, see `RFC-0175-AlarmsBackendRequirements.md`.

---

## Current State Analysis

### Existing Components (All Using Mock Data)

| Component | Directory | Factory Function | Mock Source |
|-----------|-----------|-----------------|-------------|
| **General List (Phase 3)** | `src/components/device-operational-card-grid/` | `createDeviceOperationalCardGridComponent` | `generateMockOperationalEquipment()` in controller.js |
| **Alarms Panel (Phase 4)** | `src/components/AlarmsNotificationsPanel/` | `createAlarmsNotificationsPanelComponent` | `generateMockAlarms()` in controller.js |
| **Dashboard (Phase 5)** | `src/components/operational-dashboard/` | `createOperationalDashboardComponent` | `generateMockKPIs()`, `generateMockTrendData()`, `generateMockDowntimeList()` |

### Existing Type Definitions (No Changes Needed)

| File | Types | Status |
|------|-------|--------|
| `src/types/alarm.ts` | `Alarm`, `AlarmStats`, `AlarmTrendDataPoint`, `AlarmFilters`, `AlarmCardData` | Already matches Alarms Backend schema |
| `src/types/operational.ts` | `EquipmentCardData`, `DashboardKPIs`, `DowntimeEntry`, `TrendDataPoint`, `EquipmentStats` | Already matches target data shape |

### Mock Data Functions in controller.js (To Be Replaced)

| Function | Line | Used By | Replace With |
|----------|------|---------|--------------|
| `generateMockOperationalEquipment()` | ~4190 | `renderOperationalGeneralList()` | TB `myio:data-ready` + `AlarmService.getDeviceAlarmCounts()` |
| `generateMockAlarms()` | ~4427 | `renderAlarmsNotificationsPanel()` | `AlarmService.getAlarms()` |
| `generateMockKPIs()` | ~4273 (inline) | `renderOperationalDashboard()` | `AlarmService.getAlarmStats()` + TB equipment data |
| `generateMockTrendData()` | ~4286 (inline) | `renderOperationalDashboard()` | `AlarmService.getAlarmTrend()` |
| `generateMockDowntimeList()` | ~4287 (inline) | `renderOperationalDashboard()` | `AlarmService.getTopDowntime()` |

---

## Files to Create

### Phase A: AlarmService Core Infrastructure

| # | File | Description |
|---|------|-------------|
| A1 | `src/services/alarm/index.ts` | Public exports for AlarmService module |
| A2 | `src/services/alarm/AlarmService.ts` | Main singleton facade |
| A3 | `src/services/alarm/clients/AlarmApiClient.ts` | HTTP client for Alarms Backend REST API |
| A4 | `src/services/alarm/cache/ServiceCache.ts` | In-memory TTL cache |
| A5 | `src/services/alarm/config/apiConfig.ts` | URL resolution + production defaults |
| A6 | `src/services/alarm/types.ts` | API response types (raw shapes from backend) |
| A7 | `src/services/alarm/errors.ts` | `AlarmApiError` class |

### Phase B: Mappers

| # | File | Description |
|---|------|-------------|
| B1 | `src/services/alarm/mappers/alarmMapper.ts` | `AlarmApiResponse` -> `Alarm` |
| B2 | `src/services/alarm/mappers/statsMapper.ts` | Stats API response -> `AlarmStats` |
| B3 | `src/services/alarm/mappers/trendMapper.ts` | Trend API response -> `AlarmTrendDataPoint[]` |
| B4 | `src/services/alarm/mappers/equipmentMapper.ts` | TB device + alarm data -> `EquipmentCardData` |
| B5 | `src/services/alarm/mappers/downtimeMapper.ts` | Top offenders -> `DowntimeEntry[]` |
| B6 | `src/services/alarm/mappers/kpiMapper.ts` | TB equipment + alarm stats -> `DashboardKPIs` |

### Phase E: WebSocket

| # | File | Description |
|---|------|-------------|
| E1 | `src/services/alarm/websocket/AlarmWebSocket.ts` | WebSocket client with reconnect |

---

## Files to Modify

### controller.js (Main Widget Controller)

**File**: `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`

This is the primary file where mock data is consumed. All three render functions must be updated.

#### Change 1: Add AlarmService Initialization in `onInit()`

**Location**: After `fetchOperationalIndicatorsAccess()` (~line 2438)

```javascript
// RFC-0175: Initialize AlarmService for real alarm data
let _alarmService = null;
let _alarmServiceReady = false;

async function initAlarmService() {
  try {
    const customerTB_ID = getCustomerTB_ID();
    const jwt = getJwtToken();

    if (!customerTB_ID || !jwt) {
      LogHelper.warn('[RFC-0175] Missing customerTB_ID or JWT for AlarmService init');
      return;
    }

    // Read GCDR credentials from TB customer SERVER_SCOPE attributes
    const attrs = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage?.(customerTB_ID, jwt);
    const gcdrEmail = attrs?.['gcdr-service-email'];
    const gcdrPassword = attrs?.['gcdr-service-password'];
    const gcdrApiUrl = attrs?.['gcdr-api-url'] || 'https://gcdr-api.a.myio-bas.com';
    const alarmsApiUrl = attrs?.['alarms-api-url'] || 'https://alarms-api.a.myio-bas.com';

    if (!gcdrEmail || !gcdrPassword) {
      LogHelper.warn('[RFC-0175] Missing GCDR credentials in customer attributes');
      return;
    }

    // Login to GCDR to obtain JWT with alarm-orchestrator audience
    const loginResponse = await fetch(`${gcdrApiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: gcdrEmail, password: gcdrPassword }),
    });

    if (!loginResponse.ok) {
      LogHelper.error('[RFC-0175] GCDR login failed:', loginResponse.status);
      return;
    }

    const { accessToken, refreshToken } = await loginResponse.json();

    // Initialize AlarmService singleton
    _alarmService = MyIOLibrary.AlarmService.getInstance({
      alarmsApiUrl,
      token: accessToken,
      refreshToken,
      tenantId: attrs?.['tenant-id'] || customerTB_ID,
      wsUrl: alarmsApiUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws',
      cacheTtlMs: 30000,
      requestTimeoutMs: 10000,
    });

    _alarmServiceReady = true;
    LogHelper.log('[RFC-0175] AlarmService initialized successfully');
  } catch (error) {
    LogHelper.error('[RFC-0175] Failed to initialize AlarmService:', error);
  }
}
```

**Call in onInit**: Add `await initAlarmService();` after `fetchOperationalIndicatorsAccess()`.

#### Change 2: Replace `renderAlarmsNotificationsPanel()` (Phase 4)

**Location**: ~line 4386

**Before** (current mock):
```javascript
const mockAlarms = generateMockAlarms();
alarmsNotificationsPanelInstance = MyIOLibrary.createAlarmsNotificationsPanelComponent({
  container,
  ...
  alarms: mockAlarms,
  ...
});
```

**After** (real data):
```javascript
function renderAlarmsNotificationsPanel(container) {
  if (!container) return;
  LogHelper.log('[MAIN_UNIQUE] RFC-0175: renderAlarmsNotificationsPanel called');
  destroyAllPanels();

  if (!MyIOLibrary?.createAlarmsNotificationsPanelComponent) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">AlarmsNotificationsPanel not available</div>';
    return;
  }

  container.innerHTML = '';
  currentViewMode = 'alarms-panel';

  // Create component with empty data initially (loading state)
  alarmsNotificationsPanelInstance = MyIOLibrary.createAlarmsNotificationsPanelComponent({
    container,
    themeMode: currentThemeMode,
    enableDebugMode: settings.enableDebugMode,
    alarms: [],
    onAlarmClick: (alarm) => {
      LogHelper.log('[RFC-0175] Alarm clicked:', alarm.title || alarm.id);
    },
    onAlarmAction: async (action, alarm) => {
      LogHelper.log('[RFC-0175] Alarm action:', action, alarm.id);
      if (_alarmService) {
        try {
          const userEmail = window.MyIOUtils?.currentUser?.email || 'unknown';
          if (action === 'acknowledge') await _alarmService.acknowledgeAlarm(alarm.id, userEmail);
          else if (action === 'snooze') await _alarmService.silenceAlarm(alarm.id, userEmail, '4h');
          else if (action === 'escalate') await _alarmService.escalateAlarm(alarm.id, userEmail);
          else if (action === 'close') await _alarmService.closeAlarm(alarm.id, userEmail);
          // Refresh alarm list after action
          await fetchAndUpdateAlarms();
        } catch (err) {
          LogHelper.error('[RFC-0175] Alarm action failed:', err);
        }
      }
    },
    onTabChange: (tab) => {
      LogHelper.log('[RFC-0175] Alarm tab changed:', tab);
    },
  });

  // Fetch real data
  fetchAndUpdateAlarms();
}

async function fetchAndUpdateAlarms() {
  if (!_alarmServiceReady || !_alarmService) {
    // Fallback to mock data if service not available
    LogHelper.warn('[RFC-0175] AlarmService not ready, using mock data');
    const mockAlarms = generateMockAlarms();
    alarmsNotificationsPanelInstance?.updateAlarms?.(mockAlarms);
    return;
  }

  try {
    alarmsNotificationsPanelInstance?.setLoading?.(true);

    const tenantId = _alarmService.config?.tenantId || '';

    // Fetch alarms and stats in parallel
    const [alarms, stats, trend] = await Promise.all([
      _alarmService.getAlarms({ state: ['OPEN', 'ACK', 'ESCALATED', 'SNOOZED'] }),
      _alarmService.getAlarmStats(tenantId, 'week'),
      _alarmService.getAlarmTrend(tenantId, 'week', 'day'),
    ]);

    alarmsNotificationsPanelInstance?.updateAlarms?.(alarms);
    alarmsNotificationsPanelInstance?.updateStats?.(stats);
    alarmsNotificationsPanelInstance?.updateTrendData?.(trend);
  } catch (error) {
    LogHelper.error('[RFC-0175] Failed to fetch alarms:', error);
    // Fallback to mock
    const mockAlarms = generateMockAlarms();
    alarmsNotificationsPanelInstance?.updateAlarms?.(mockAlarms);
  } finally {
    alarmsNotificationsPanelInstance?.setLoading?.(false);
  }
}
```

#### Change 3: Replace `renderOperationalGeneralList()` (Phase 3)

**Location**: ~line 4331

**Before** (mock): `const mockEquipment = generateMockOperationalEquipment();`

**After** (real data):
```javascript
function renderOperationalGeneralList(container) {
  if (!container) return;
  LogHelper.log('[MAIN_UNIQUE] RFC-0175: renderOperationalGeneralList called');
  destroyAllPanels();

  if (!MyIOLibrary?.createDeviceOperationalCardGridComponent) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">DeviceOperationalCardGrid not available</div>';
    return;
  }

  container.innerHTML = '';
  currentViewMode = 'operational-grid';

  // Create component with empty data (loading state)
  operationalGridInstance = MyIOLibrary.createDeviceOperationalCardGridComponent({
    container,
    themeMode: currentThemeMode,
    enableDebugMode: settings.enableDebugMode,
    equipment: [],
    customers: [],
    includeSearch: true,
    includeFilters: true,
    includeStats: true,
    enableSelection: true,
    enableDragDrop: true,
    onEquipmentClick: (eq) => {
      LogHelper.log('[RFC-0175] Equipment clicked:', eq.name);
    },
    onEquipmentAction: (action, eq) => {
      LogHelper.log('[RFC-0175] Equipment action:', action, eq.name);
    },
  });

  fetchAndUpdateEquipment();
}

async function fetchAndUpdateEquipment() {
  // Equipment data from ThingsBoard (already available via cached data)
  const classifiedDevices = _cachedClassified || window.MyIOOrchestrator?.getAllDevices?.() || [];

  // Filter to escalators and elevators only
  const operationalDevices = classifiedDevices.filter((device) => {
    const category = MyIOLibrary.classifyEquipment?.(device);
    return category === 'escadas_rolantes' || category === 'elevadores';
  });

  if (operationalDevices.length === 0) {
    // Fallback to mock if no TB devices found
    LogHelper.warn('[RFC-0175] No operational devices from TB, using mock');
    const mockEquipment = generateMockOperationalEquipment();
    const customers = extractCustomersFromEquipment(mockEquipment);
    operationalGridInstance?.updateEquipment?.(mockEquipment);
    return;
  }

  // Get customer names from TB cache
  const customerMap = new Map();
  (_cachedShoppings || []).forEach((c) => {
    if (c.id?.id) customerMap.set(c.id.id, c.name || c.title || '');
  });

  // Get alarm counts per device from Alarms Backend (if available)
  let alarmCountMap = new Map();
  if (_alarmServiceReady && _alarmService) {
    try {
      const tenantId = _alarmService.config?.tenantId || '';
      alarmCountMap = await _alarmService.getDeviceAlarmCounts(tenantId);
    } catch (err) {
      LogHelper.warn('[RFC-0175] Failed to fetch device alarm counts:', err);
    }
  }

  // Map TB devices + alarm counts to EquipmentCardData
  const equipment = operationalDevices.map((device) => {
    const deviceId = device.id?.id || device.entityId || '';
    const customerId = device.customerId?.id || '';
    const customerName = customerMap.get(customerId) || '';
    const recentAlerts = alarmCountMap.get(deviceId) || 0;

    return MyIOLibrary.mapTBDeviceToEquipment?.(device, customerName, {
      recentAlerts,
      hasReversal: false,
      avgResolutionMinutes: 0,
    }) || {
      id: deviceId,
      name: device.name || device.label || '',
      type: MyIOLibrary.classifyEquipment?.(device) === 'elevadores' ? 'elevador' : 'escada',
      status: 'online',
      availability: 95,
      mtbf: 500,
      mttr: 2,
      hasReversal: false,
      recentAlerts,
      customerName,
      location: device.label || '',
      customerId,
      entityId: deviceId,
    };
  });

  // Build customers list
  const customers = extractCustomersFromEquipment(equipment);

  operationalGridInstance?.updateEquipment?.(equipment);
}

function extractCustomersFromEquipment(equipment) {
  return Array.from(
    equipment.reduce((map, eq) => {
      const id = eq.customerId || eq.customerName;
      if (id && eq.customerName) map.set(id, eq.customerName);
      return map;
    }, new Map())
  ).map(([id, name]) => ({ id, name }));
}
```

#### Change 4: Replace `renderOperationalDashboard()` (Phase 5)

**Location**: ~line 4254

**Before** (mock): Inline mock KPIs, trend, downtime.

**After** (real data):
```javascript
function renderOperationalDashboard(container) {
  if (!container) return;
  LogHelper.log('[MAIN_UNIQUE] RFC-0175: renderOperationalDashboard called');
  destroyAllPanels();

  if (!MyIOLibrary?.createOperationalDashboardComponent) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">OperationalDashboard not available</div>';
    return;
  }

  container.innerHTML = '';
  currentViewMode = 'operational-dashboard';

  // Default empty values from types
  const defaultKPIs = MyIOLibrary.DEFAULT_DASHBOARD_KPIS || {
    fleetAvailability: 0, availabilityTrend: 0, fleetMTBF: 0, fleetMTTR: 0,
    totalEquipment: 0, onlineCount: 0, offlineCount: 0, maintenanceCount: 0,
  };

  operationalDashboardInstance = MyIOLibrary.createOperationalDashboardComponent({
    container,
    themeMode: currentThemeMode,
    enableDebugMode: settings.enableDebugMode,
    initialPeriod: 'month',
    kpis: defaultKPIs,
    trendData: [],
    downtimeList: [],
    onPeriodChange: async (period) => {
      LogHelper.log('[RFC-0175] Dashboard period changed:', period);
      await fetchAndUpdateDashboard(period);
    },
    onRefresh: async () => {
      LogHelper.log('[RFC-0175] Dashboard refresh requested');
      const period = operationalDashboardInstance?.getPeriod?.() || 'month';
      await fetchAndUpdateDashboard(period);
    },
  });

  // Initial fetch
  fetchAndUpdateDashboard('month');
}

async function fetchAndUpdateDashboard(period) {
  operationalDashboardInstance?.setLoading?.(true);

  try {
    if (!_alarmServiceReady || !_alarmService) {
      // Fallback to mock
      LogHelper.warn('[RFC-0175] AlarmService not ready, using mock dashboard data');
      const mockKPIs = MyIOLibrary.generateMockKPIs?.() || {};
      const mockTrendData = MyIOLibrary.generateMockTrendData?.(period) || [];
      const mockDowntimeList = MyIOLibrary.generateMockDowntimeList?.() || [];
      operationalDashboardInstance?.updateKPIs?.(mockKPIs);
      operationalDashboardInstance?.updateTrendData?.(mockTrendData);
      operationalDashboardInstance?.updateDowntimeList?.(mockDowntimeList);
      return;
    }

    const tenantId = _alarmService.config?.tenantId || '';

    // Map UI period to API parameters
    const apiPeriod = { today: 'day', week: 'week', month: 'month', quarter: 'month' }[period] || 'month';
    const groupBy = { today: 'hour', week: 'day', month: 'day', quarter: 'week' }[period] || 'day';

    // Fetch stats, trend, and top offenders in parallel
    const [alarmStats, trendData, topOffenders] = await Promise.all([
      _alarmService.getAlarmStats(tenantId, apiPeriod),
      _alarmService.getAlarmTrend(tenantId, apiPeriod, groupBy),
      _alarmService.getTopDowntime(tenantId, new Map(), 5),
    ]);

    // Compute KPIs from TB equipment data + alarm stats
    const classifiedDevices = _cachedClassified || [];
    const operationalDevices = classifiedDevices.filter((d) => {
      const cat = MyIOLibrary.classifyEquipment?.(d);
      return cat === 'escadas_rolantes' || cat === 'elevadores';
    });

    const total = operationalDevices.length;
    const onlineCount = operationalDevices.filter((d) => {
      const s = MyIOLibrary.calculateDeviceStatusMasterRules?.(d) || '';
      return ['power_on', 'online', 'normal', 'ok', 'running', 'active'].includes(s);
    }).length;
    const offlineCount = total - onlineCount;

    const kpis = {
      fleetAvailability: total > 0 ? (onlineCount / total) * 100 : 0,
      availabilityTrend: 0,
      fleetMTBF: alarmStats.total > 0 ? (720 / alarmStats.total) * total : 720,
      fleetMTTR: 0, // Will come from avgResolutionTimeMinutes if available
      totalEquipment: total,
      onlineCount,
      offlineCount,
      maintenanceCount: 0,
    };

    // Map trend data to TrendDataPoint format
    const mappedTrend = (trendData || []).map((point) => ({
      label: point.label || point.period || '',
      timestamp: point.timestamp || new Date(point.label || point.period || '').getTime(),
      value: point.total || point.count || 0,
    }));

    operationalDashboardInstance?.updateKPIs?.(kpis);
    operationalDashboardInstance?.updateTrendData?.(mappedTrend);
    operationalDashboardInstance?.updateDowntimeList?.(topOffenders);
  } catch (error) {
    LogHelper.error('[RFC-0175] Failed to fetch dashboard data:', error);
    // Fallback to mock
    const mockKPIs = MyIOLibrary.generateMockKPIs?.() || {};
    operationalDashboardInstance?.updateKPIs?.(mockKPIs);
  } finally {
    operationalDashboardInstance?.setLoading?.(false);
  }
}
```

#### Change 5: WebSocket Integration (Phase E)

**Location**: After `initAlarmService()` in onInit

```javascript
// RFC-0175: Connect WebSocket for real-time alarm updates
function connectAlarmWebSocket() {
  if (!_alarmServiceReady || !_alarmService) return;

  _alarmService.connectRealTime();

  _alarmService.onAlarmCreated((alarm) => {
    LogHelper.log('[RFC-0175] WS: New alarm received:', alarm.id);
    // If alarms panel is active, prepend alarm and refresh stats
    if (currentViewMode === 'alarms-panel' && alarmsNotificationsPanelInstance) {
      fetchAndUpdateAlarms();
    }
  });

  _alarmService.onAlarmUpdated((alarm) => {
    LogHelper.log('[RFC-0175] WS: Alarm updated:', alarm.id, alarm.state);
    // If alarms panel is active, refresh
    if (currentViewMode === 'alarms-panel' && alarmsNotificationsPanelInstance) {
      fetchAndUpdateAlarms();
    }
  });
}
```

#### Change 6: Cleanup in `onDestroy()`

```javascript
// RFC-0175: Cleanup AlarmService
if (_alarmService) {
  _alarmService.disconnectRealTime();
  MyIOLibrary.AlarmService?.resetInstance?.();
  _alarmService = null;
  _alarmServiceReady = false;
}
```

### src/index.ts (Library Exports)

**File**: `src/index.ts`

Add AlarmService exports:

```typescript
// RFC-0175: AlarmService
export { AlarmService } from './services/alarm';
export type { AlarmServiceConfig } from './services/alarm';
export { mapApiAlarmToAlarm } from './services/alarm/mappers/alarmMapper';
export { mapApiStatsToAlarmStats } from './services/alarm/mappers/statsMapper';
export { mapTBDeviceToEquipment } from './services/alarm/mappers/equipmentMapper';
```

---

## Implementation Order

### Phase A: Core Infrastructure (No UI Changes)

**Priority**: Highest (blocks everything)
**Backend dependency**: CORS must be configured, GCDR credentials available in TB attributes

```
1. Create src/services/alarm/errors.ts
2. Create src/services/alarm/types.ts
3. Create src/services/alarm/cache/ServiceCache.ts
4. Create src/services/alarm/config/apiConfig.ts
5. Create src/services/alarm/clients/AlarmApiClient.ts
6. Create src/services/alarm/AlarmService.ts (skeleton with getAlarms, getAlarmStats)
7. Create src/services/alarm/index.ts
8. Update src/index.ts to export AlarmService
```

**Acceptance criteria**:
- `AlarmService.getInstance(config)` creates singleton
- `getAlarms()` fetches from `/alarms` with Bearer token
- `getAlarmStats()` fetches from `/api/v1/alarms/stats`
- Cache returns stale data on API error
- 401 error triggers console warning

### Phase B: Mappers

**Priority**: High
**Depends on**: Phase A

```
1. Create src/services/alarm/mappers/alarmMapper.ts
2. Create src/services/alarm/mappers/statsMapper.ts
3. Create src/services/alarm/mappers/trendMapper.ts
4. Create src/services/alarm/mappers/equipmentMapper.ts
5. Create src/services/alarm/mappers/downtimeMapper.ts
6. Create src/services/alarm/mappers/kpiMapper.ts
```

**Acceptance criteria**:
- `mapApiAlarmToAlarm()` correctly maps all fields (see RFC-0175 section 3.1)
- `mapApiStatsToAlarmStats()` handles missing severity/state keys with defaults
- `mapTBDeviceToEquipment()` uses `classifyEquipment()` and `calculateDeviceStatusMasterRules()`
- All mappers handle null/undefined gracefully

### Phase C: Alarms Panel Real Data (Phase 4)

**Priority**: High
**Depends on**: Phase A + B

```
1. Add initAlarmService() to controller.js onInit
2. Replace renderAlarmsNotificationsPanel() in controller.js
3. Add fetchAndUpdateAlarms() helper
4. Verify AlarmsNotificationsPanelController supports dynamic updates
```

**Acceptance criteria**:
- Alarm list populated from `GET /alarms`
- Stats populated from `GET /api/v1/alarms/stats`
- Trend chart from `GET /api/v1/alarms/stats/trend`
- Acknowledge/escalate/close actions call POST endpoints
- Graceful fallback to mock data if AlarmService unavailable
- Customer names enriched from TB cache

### Phase D: General List Real Data (Phase 3)

**Priority**: Medium
**Depends on**: Phase A + B

```
1. Replace renderOperationalGeneralList() in controller.js
2. Add fetchAndUpdateEquipment() helper
3. Use _cachedClassified from myio:data-ready for device data
4. Merge alarm counts from AlarmService.getDeviceAlarmCounts()
```

**Acceptance criteria**:
- Equipment cards populated from ThingsBoard device data
- `classifyEquipment()` filters to escalators + elevators only
- Alert count badges from Alarms Backend `by-device` endpoint
- Fallback to mock if no TB devices or AlarmService unavailable
- Customer names from `_cachedShoppings`

### Phase E: Dashboard Real Data (Phase 5)

**Priority**: Medium
**Depends on**: Phase A + B + D

```
1. Replace renderOperationalDashboard() in controller.js
2. Add fetchAndUpdateDashboard() helper
3. Compute DashboardKPIs from TB equipment + alarm stats
4. Map trend data to TrendDataPoint format
5. Map top offenders to DowntimeEntry format
```

**Acceptance criteria**:
- Fleet availability computed from online/total equipment ratio
- MTBF/MTTR approximated from alarm counts + resolution time
- Trend chart from alarm trend API
- Top 5 downtime from top-offenders API, enriched with TB device names
- Period selector maps to correct API params (today->day, quarter->month)

### Phase F: WebSocket Real-Time

**Priority**: Low
**Depends on**: Phase C

```
1. Create src/services/alarm/websocket/AlarmWebSocket.ts
2. Add connectAlarmWebSocket() to controller.js
3. Subscribe to alarm.created and alarm.updated
4. Auto-refresh active panel on WS events
```

**Acceptance criteria**:
- WebSocket connects with tenant filter
- New alarms trigger list refresh
- State changes trigger list refresh
- Auto-reconnect on disconnect (max 5 attempts, exponential backoff)
- Clean disconnect on widget destroy

### Phase G: Cleanup

**Priority**: Low
**Depends on**: All above phases validated

```
1. Remove generateMockOperationalEquipment() from controller.js
2. Remove generateMockAlarms() from controller.js
3. Remove inline mock KPIs/trend/downtime from controller.js
4. Keep mock generators as fallback functions (prefixed with _fallback_)
5. Update log messages from [MAIN_UNIQUE] to [RFC-0175]
```

---

## Testing Strategy

### Local Testing (Before Backend)

While waiting for CORS and credentials setup:

1. **Unit test mappers**: Feed sample JSON from ONBOARDING.md into mapper functions, verify output matches expected types
2. **Mock API server**: Use a local Fastify server or MSW (Mock Service Worker) that returns the response shapes from RFC-0175
3. **Integration with showcase**: Update `showcase/` pages to test AlarmService with mock server

### Integration Testing (With Backend)

1. **CORS verification**: Open browser console on TB dashboard, attempt `fetch()` to Alarms Backend
2. **Auth flow**: Verify GCDR login returns JWT accepted by Alarms Backend
3. **Data flow**: Navigate to each panel, verify real data appears
4. **Fallback**: Disconnect from network, verify panels show cached or empty data
5. **Actions**: Acknowledge an alarm, verify state changes in UI and backend

### Regression Checklist

- [ ] Phase 3: Equipment cards render with real TB devices
- [ ] Phase 3: Alert count badges show real alarm counts
- [ ] Phase 3: Filters (search, status, type) still work
- [ ] Phase 4: Alarm list shows real alarms from backend
- [ ] Phase 4: Severity/state badges correct
- [ ] Phase 4: Acknowledge button changes alarm state
- [ ] Phase 4: Dashboard tab shows real stats
- [ ] Phase 5: KPI cards show computed values
- [ ] Phase 5: Trend chart shows real data
- [ ] Phase 5: Top 5 downtime shows real data
- [ ] Phase 5: Period selector works
- [ ] All phases: Mock fallback works when service unavailable
- [ ] All phases: Theme toggle still works
- [ ] All phases: Loading states show during fetch
- [ ] All phases: No console errors
- [ ] WebSocket: Real-time updates appear (if backend supports WS)

---

## Dependencies & Blockers

| Blocker | Owner | Status | Impact |
|---------|-------|--------|--------|
| CORS enabled on Alarms Backend | Backend team | Pending (RFC-0175-AlarmsBackendRequirements.md sent) | Blocks all phases |
| GCDR service credentials in TB attributes | DevOps | Pending | Blocks Phase A (auth) |
| `GET /stats/by-device` response confirmed | Backend team | Pending | Blocks Phase D (alert counts) |
| ThingsBoard has operational devices (ESC/ELV) | Customer setup | Available in staging | Required for Phase D |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Backend not ready | Every render function falls back to mock data if AlarmService is unavailable |
| CORS blocked | Can be tested locally with browser extension; production needs backend fix |
| Token expiration | AlarmService retries with token refresh on 401 |
| API response shape mismatch | Mappers use defensive defaults (`?? 0`, `?? ''`, `?? []`) |
| ThingsBoard timing issues | AlarmService init runs after `fetchOperationalIndicatorsAccess()` which already handles TB attrs |
| Bundle size increase | AlarmService module is tree-shakeable; only imported by controller.js |

---

## File Summary

| Action | Count | Files |
|--------|-------|-------|
| **CREATE** | 13 | All files in `src/services/alarm/` |
| **MODIFY** | 2 | `controller.js` (mock -> real), `src/index.ts` (exports) |
| **DELETE** | 0 | Mock functions kept as fallback initially |
| **Total** | 15 | |

---

## Timeline Estimate

| Phase | Description | Complexity | Dependencies |
|-------|-------------|-----------|-------------|
| A | Core infrastructure | Medium | CORS + credentials |
| B | Mappers | Low | Phase A |
| C | Alarms panel real data | Medium | Phase A + B |
| D | General list real data | Medium | Phase A + B |
| E | Dashboard real data | Medium | Phase A + B + D |
| F | WebSocket | Low | Phase C |
| G | Cleanup | Low | All validated |
