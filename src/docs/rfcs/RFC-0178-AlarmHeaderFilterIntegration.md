# RFC-0178: Alarm View — Header Filter Integration

- **Feature Name**: `alarm-header-filter-integration`
- **RFC Number**: 0178
- **Start Date**: 2026-02-21
- **Status**: Proposed
- **Related RFCs**: RFC-0152 (Alarms Panel), RFC-0175 (Real Data), RFC-0177 (Alarm Widget)

---

## Summary

When the user navigates to the Alarm view via the MENU widget, the HEADER widget
must adapt its controls: enable the date-range picker, Carregar, and Limpar buttons;
hide the "Relatório Consumo Geral" button; and show a (currently disabled) "Relatório
de Alarmes" button. When the user leaves the Alarm view the HEADER restores its
previous state. The selected date range is forwarded to the ALARM widget via a new
`myio:alarm-filter-change` event, which triggers a fresh API call to
`GET /api/v1/alarms` with `from`, `to`, and `customerId` query params.

---

## Motivation

Currently `DOMAIN_BY_STATE.alarm_content = null` in the MENU widget, which causes
the HEADER to receive `tab: null` via `myio:dashboard-state` and call
`updateControlsState(null)` — disabling every control. As a result:

- The user cannot select a date range for alarm queries.
- The Carregar and Limpar buttons are grayed out.
- The `GET /api/v1/alarms` endpoint supports `from` / `to` / `customerId` / `severity`
  / `state` / `alarmType` filters that are never used.
- There is no clear path to a future "Alarm Report" feature.

This RFC wires the existing HEADER controls to the Alarm widget while keeping the
architecture event-driven and without coupling widgets directly.

---

## Detailed Design

### 1. `MENU/controller.js` — Promote alarm domain

Change `DOMAIN_BY_STATE` from:

```js
alarm_content: null,
```

to:

```js
alarm_content: 'alarm',
```

`myio:dashboard-state` now carries `{ tab: 'alarm' }` instead of `{ tab: null }`.

---

### 2. `MAIN_VIEW/controller.js` — Handle `tab === 'alarm'`

The orchestrator's `myio:dashboard-state` handler currently short-circuits on
`!tab`. After the MENU change the value is `'alarm'` (truthy), so it would fall
into `hydrateDomain('alarm', ...)` and fail.

Add an explicit guard before `hydrateDomain`:

```js
if (tab === 'alarm') {
  visibleTab = 'alarm';
  LogHelper.log('[Orchestrator] 🔔 alarm view activated');
  window.dispatchEvent(new CustomEvent('myio:alarm-content-activated'));
  return; // skip domain hydration
}
```

Remove or supersede the previous `if (!tab)` guard added in RFC-0177.

---

### 3. `HEADER/template.html` — Add Alarm Report button

Add after `#tbx-btn-report-general`, hidden by default:

```html
<button
  class="tbx-btn tbx-btn-primary"
  id="tbx-btn-report-alarm"
  title="Relatório de Alarmes"
  disabled
  style="display:none"
>
  <span class="tbx-ico">🔔</span>
  <span>Relatório de Alarmes</span>
</button>
```

---

### 4. `HEADER/controller.js` — `updateControlsState` alarm branch

Extend `updateControlsState(domain)`:

```js
const btnAlarmReport = q('#tbx-btn-report-alarm');

if (domain === 'alarm') {
  // Enable date controls
  if (inputRange)      inputRange.disabled      = false;
  if (btnLoad)         btnLoad.disabled         = false;
  if (btnForceRefresh) btnForceRefresh.disabled = false;

  // Swap report buttons
  if (btnGen)         btnGen.style.display         = 'none';
  if (btnAlarmReport) btnAlarmReport.style.display = '';   // visible, still disabled

} else {
  // Restore report buttons to their default state
  if (btnAlarmReport) btnAlarmReport.style.display = 'none';
  if (btnGen)         btnGen.style.display         = '';

  // Existing energy/water enable logic unchanged
  const isSupported = domain === 'energy' || domain === 'water';
  if (inputRange)      inputRange.disabled      = !isSupported;
  if (btnLoad)         btnLoad.disabled         = !isSupported;
  if (btnForceRefresh) btnForceRefresh.disabled = !isSupported;
  if (btnGen)          btnGen.disabled          = !isSupported;
}
```

#### `btnLoad` click — alarm branch

Inside the existing `btnLoad` click handler, add a branch for `alarm` domain
**before** the energy/water logic:

```js
if (currentDomain.value === 'alarm') {
  const filters = self.getFilters(); // existing helper — returns { startAt, endAt, ... }
  window.dispatchEvent(new CustomEvent('myio:alarm-filter-change', {
    detail: {
      from:       filters.startAt,   // ISO 8601
      to:         filters.endAt,     // ISO 8601
    },
  }));
  return;
}
```

`customerId` (gcdrCustomerId) is owned by the ALARM widget itself (`_customerIngId`,
fetched from ThingsBoard SERVER_SCOPE attributes) and **must not** travel through
the HEADER event — the ALARM widget always appends it independently.

---

### 5. `ALARM/controller.js` — Consume `myio:alarm-filter-change`

#### Module-level state

```js
let _activeFilters = {}; // { from?, to? }
```

#### Registration in `onInit` (alongside the existing activation handler)

```js
window.addEventListener('myio:alarm-filter-change', (ev) => {
  _activeFilters = {
    from: ev.detail?.from || null,
    to:   ev.detail?.to   || null,
  };
  LogHelper.log('Alarm filter changed:', _activeFilters);
  window.MyIOLibrary?.AlarmService?.clearCache?.();
  _fetchAndUpdate();
});
```

Clean up in `onDestroy` (same pattern as `_themeChangeHandler`).

#### `customerId` — source and mandatory rule

`customerId` is the **gcdrCustomerId**, stored in the ThingsBoard customer's
`SERVER_SCOPE` attributes under the key `ingestionId`. It is fetched once in
`onInit` via `fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt)` and
stored as `_customerIngId`.

> **Rule**: every call to `AlarmService.getAlarms` MUST include
> `customerId: _customerIngId`. Without it the backend cannot scope results to
> the correct customer. If `_customerIngId` is empty the call must be aborted
> and an error logged.

#### `_fetchAndUpdate` — pass filters to `getAlarms`

```js
// Guard: customerId is mandatory
if (!_customerIngId) {
  LogHelper.error('_fetchAndUpdate aborted: _customerIngId (gcdrCustomerId) is empty');
  _isRefreshing = false;
  return;
}

const [alarms, stats, trend] = await Promise.all([
  AlarmService.getAlarms({
    state:      ['OPEN', 'ACK', 'ESCALATED', 'SNOOZED'],
    limit:      _maxAlarms,
    customerId: _customerIngId,           // always required
    from:       _activeFilters.from  || undefined,
    to:         _activeFilters.to    || undefined,
  }),
  // stats / trend unchanged
]);
```

#### Actual API response shape

`GET /api/v1/alarms` returns:

```json
{
  "data": [ /* AlarmApiResponse[] */ ],
  "pagination": {
    "hasMore": true,
    "cursor":  "50"
  },
  "summary": {
    "total":       100,
    "byState":    { "OPEN": 40, "ACK": 5, "SNOOZED": 2, "ESCALATED": 3, "CLOSED": 50 },
    "bySeverity": { "CRITICAL": 5, "HIGH": 20, "MEDIUM": 50, "LOW": 15, "INFO": 10 },
    "byAlarmType":{ "TEMPERATURE_HIGH": 60, "DOOR_OPEN": 40 }
  }
}
```

Key observations:

- `summary.total` replaces the old `pagination.total` field (pagination only has
  `hasMore` + `cursor`).
- `summary.byState` / `summary.bySeverity` / `summary.byAlarmType` provide all
  the data previously requested from a separate `getAlarmStats` call — **making
  `getAlarmStats` redundant** when fetching alarms with a date filter.
- The ALARM widget can update the count badge and stats panel directly from
  `summary`, removing the parallel `getAlarmStats` call in `_fetchAndUpdate`.

#### Updated `_fetchAndUpdate` — using embedded summary

```js
// Single call — summary is embedded in the response
const response = await AlarmService.getAlarms({
  state:      ['OPEN', 'ACK', 'ESCALATED', 'SNOOZED'],
  limit:      _maxAlarms,
  customerId: _customerIngId,       // always required
  from:       _activeFilters.from || undefined,
  to:         _activeFilters.to   || undefined,
});

const alarms  = response.data;
const summary = response.summary;

_panelInstance?.updateAlarms?.(alarms);
if (summary) _panelInstance?.updateStats?.(summary);

// Count badge: open + escalated from summary.byState
const openCount = (summary?.byState?.OPEN ?? 0) + (summary?.byState?.ESCALATED ?? 0);
_updateCountBadge(openCount);
```

Trend data still requires a separate `getAlarmTrend` call (not embedded).

#### `AlarmListParams` type extension (`src/services/alarm/types.ts`)

```ts
export interface AlarmListParams {
  state?:      string[];
  severity?:   string[];
  alarmType?:  string;
  from?:       string;  // ISO 8601
  to?:         string;  // ISO 8601
  customerId?: string;  // gcdrCustomerId — mandatory at runtime (see guard above)
  limit?:      number;
  cursor?:     string;
}
```

#### `AlarmListApiResponse` — add `summary`, fix `pagination` (`src/services/alarm/types.ts`)

```ts
export interface AlarmListSummary {
  total:       number;
  byState:     Record<string, number>;
  bySeverity:  Record<string, number>;
  byAlarmType: Record<string, number>;
}

export interface AlarmListApiResponse {
  data:       AlarmApiResponse[];
  pagination: {
    hasMore: boolean;
    cursor?: string;
    // NOTE: total is now in summary, not pagination
  };
  summary: AlarmListSummary;
}
```

#### `AlarmApiClient.getAlarms` — forward new params and fix path

```ts
// Fix path: /alarms → /api/v1/alarms
// Forward new query params
if (params.alarmType)   query.set('alarmType',   params.alarmType);
if (params.from)        query.set('from',         params.from);
if (params.to)          query.set('to',           params.to);
if (params.customerId)  query.set('customerId',   params.customerId);
```

---

### 6. `MAIN_VIEW/settingsSchema.json` + `controller.js` — `alarmsApiBaseUrl`

Add setting:

```json
"alarmsApiBaseUrl": {
  "title": "Alarms API Base URL",
  "type": "string",
  "default": "https://alarms-api.a.myio-bas.com/api/v1",
  "description": "Base URL for the Alarms Backend REST API (without trailing slash)."
}
```

Store in orchestrator:

```js
window.MyIOOrchestrator.alarmsApiBaseUrl = settings.alarmsApiBaseUrl
  || 'https://alarms-api.a.myio-bas.com/api/v1';
```

`AlarmService` exposes a `configure(baseUrl)` method (added in this RFC) that the
ALARM widget calls in `onInit`:

```js
const alarmsUrl = window.MyIOOrchestrator?.alarmsApiBaseUrl;
if (alarmsUrl) MyIOLibrary.AlarmService?.configure?.(alarmsUrl);
```

---

## Files Changed

| File | Change |
|------|--------|
| `MENU/controller.js` | `alarm_content: null` → `'alarm'` |
| `MAIN_VIEW/controller.js` | Guard `tab === 'alarm'`; store `alarmsApiBaseUrl` in orchestrator |
| `MAIN_VIEW/settingsSchema.json` | Add `alarmsApiBaseUrl` property |
| `HEADER/template.html` | Add `#tbx-btn-report-alarm` (hidden, disabled) |
| `HEADER/controller.js` | `updateControlsState` alarm branch; `btnLoad` alarm click |
| `ALARM/controller.js` | Listen `myio:alarm-filter-change`; pass filters to `getAlarms`; call `AlarmService.configure` |
| `src/services/alarm/types.ts` | Extend `AlarmListParams` with `from`, `to`, `customerId`, `alarmType` |
| `src/services/alarm/AlarmApiClient.ts` | Fix path `/alarms` → `/api/v1/alarms`; forward new params; add `configure(baseUrl)` |
| `src/services/alarm/AlarmService.ts` | Expose `configure(baseUrl)` delegating to client |

---

## Event Flow Diagram

```
User clicks "Alarmes" in MENU
  │
  ├─► myio:dashboard-state { tab: 'alarm' }
  │     ├─► HEADER: updateControlsState('alarm')
  │     │     → enable date range, Carregar, Limpar
  │     │     → hide btnGen, show btnAlarmReport (disabled)
  │     └─► MAIN_VIEW: set visibleTab='alarm'
  │           → dispatch myio:alarm-content-activated
  │                 └─► ALARM widget: refresh data
  │
User selects date range and clicks "Carregar"
  │
  ├─► HEADER emits myio:alarm-filter-change { from, to }
  │
  └─► ALARM widget:
        _activeFilters = { from, to }
        AlarmService.getAlarms({ state, limit, from, to, customerId })
          → GET /api/v1/alarms?state=OPEN&...&from=...&to=...&customerId=...

User clicks another MENU item (energy / water / temperature)
  │
  └─► myio:dashboard-state { tab: 'energy' }
        └─► HEADER: updateControlsState('energy')
              → hide btnAlarmReport, restore btnGen
              → enable/disable per existing logic
```

---

## Drawbacks

- `updateControlsState` grows a third branch; could be refactored into a
  domain-config map in the future.
- HEADER emitting `myio:alarm-filter-change` introduces a mild cross-domain
  dependency; could alternatively be done with a direct widget-to-widget
  shared state via the orchestrator.

---

## Alternatives

- **Alarm-specific filter UI inside the ALARM widget itself** — avoids HEADER
  coupling but duplicates date-picker logic and breaks layout consistency.
- **Dispatch `myio:update-date` reusing existing event** — requires ALARM widget
  to listen to an event intended for energy/water, creating semantic confusion.

---

## Unresolved Questions

- Should `severity`, `state`, and `alarmType` filters be exposed in the HEADER
  or inside the ALARM panel component itself?
- When should the "Relatório de Alarmes" button be enabled? After a successful
  fetch? Or only after a real report endpoint exists?
- Should `_activeFilters` persist across tab switches (e.g., user goes to energy
  and comes back to alarm — keep last date range) or reset to default?
