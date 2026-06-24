# RFC-0177: Alarm Widget — Single-Shopping Premium ThingsBoard Widget

- **Start Date**: 2026-02-21
- **Status**: Draft
- **Branch**: `feat/rfc-0177-alarm-widget`
- **Depends on**: RFC-0175 (AlarmService), RFC-0152 Phase 4 (AlarmsNotificationsPanel component)

---

## Summary

Implement the currently empty `ALARM` widget located at
`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/ALARM/`
as a **premium, single-shopping** alarm panel for ThingsBoard dashboards.

The widget presents alarms scoped to the customer (shopping) that owns the dashboard.
It follows the exact same architecture as the `TELEMETRY` widget — no direct API calls,
fully powered by `window.MyIOLibrary` — and renders the existing
`createAlarmsNotificationsPanelComponent` inside the ThingsBoard widget shell.

The widget has two tabs selectable from its header:

| Tab | Label | Content |
|-----|-------|---------|
| `list` | Alarms & Notifications | Filterable, sortable alarm card list |
| `dashboard` | Dashboard | Stats KPI tiles + trend chart + severity donut |

Because this widget is always placed on a **single shopping's** dashboard, the
`customerName` field on every alarm card is redundant by default and is therefore
**hidden** unless explicitly enabled in the widget settings.

---

## Motivation

The `ALARM` widget directory currently contains only empty stub files
(`template.html`, `styles.css`, `controller.js`, `settingsSchema.json`).

At the same time:
- **RFC-0152 Phase 4** delivered `createAlarmsNotificationsPanelComponent` — a fully
  styled, tested library component for alarm list + dashboard tabs.
- **RFC-0175** delivered `AlarmService` with `getAlarms()`, `getAlarmStats()`,
  `getAlarmTrend()`, and alarm action methods (`acknowledgeAlarm`, `silenceAlarm`,
  `escalateAlarm`, `closeAlarm`).
- The `MAIN_UNIQUE_DATASOURCE` controller already has a working reference implementation
  (`renderAlarmsNotificationsPanel` / `fetchAndUpdateAlarms`) for the Head Office
  (multi-shopping) context.

All the infrastructure is ready. This RFC specifies how to wire it into the standalone
ThingsBoard widget, adapting the Head Office pattern to a single-shopping context.

---

## Design Principles

### 1. Follow the TELEMETRY widget pattern exactly

The TELEMETRY widget is the canonical "premium widget" in this dashboard:

- `template.html` — minimal HTML shell; no business logic, no inline styles.
- `styles.css` — CSS custom properties (`--ink-1`, `--bd`, `--accent`, …) and
  `flex-column` root layout. All widget-specific styles are scoped under a root class.
- `controller.js` — ThingsBoard lifecycle (`onInit`, `onDataUpdated`, `onDestroy`).
  Never makes direct API calls. Uses `window.MyIOLibrary` for components and
  `window.MyIOUtils` for shared utilities (LogHelper, credentials).
- `settingsSchema.json` — minimal ThingsBoard settings form; only what the operator
  needs to configure per widget placement.

### 2. Single customer scope

The widget is always placed on a dashboard that belongs to **one shopping/customer**.
ThingsBoard provides the customer context via `ctx.currentUser.customerId`.
The `CUSTOMER_ING_ID` (ingestion ID used by the Alarms Backend) is read from the
customer's `SERVER_SCOPE` attributes — the same mechanism used by `MAIN_UNIQUE_DATASOURCE`.

Consequences:
- No multi-shopping filter UI needed.
- `customerName` on alarm cards is the same for every alarm → hidden by default
  (controlled by `showCustomerName` widget setting).
- The `tenantId` parameter passed to `AlarmService.getAlarmStats()` /
  `getAlarmTrend()` is the shopping's `CUSTOMER_ING_ID`.

### 3. Component reuse, not reimplementation

The widget **does not** re-implement alarm card rendering, stats tiles, or charts.
It creates a `createAlarmsNotificationsPanelComponent` instance and delegates
all rendering to it. The widget shell is responsible for:

- Reading credentials and initializing `AlarmService`.
- Injecting the component into the ThingsBoard widget container.
- Applying the `showCustomerName` setting to the component.
- Scheduling periodic refresh (configurable interval).
- Forwarding alarm actions to `AlarmService` and refreshing the list on success.
- Destroying the component on `onDestroy`.

---

## Architecture

```
ThingsBoard Dashboard
│
└── ALARM widget (this RFC)
    │
    ├── template.html          ← Tab nav + #alarmPanelContainer
    ├── styles.css             ← Widget-scoped tab styles + CSS vars
    ├── settingsSchema.json    ← TB settings form
    │
    └── controller.js
        │
        ├── onInit()
        │   ├── Read labelWidget, showCustomerName, defaultTab, refreshInterval from settings
        │   ├── Fetch CUSTOMER_ING_ID from TB customer SERVER_SCOPE attributes
        │   │   └── window.MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage()
        │   ├── Initialize tab state (active = defaultTab setting)
        │   ├── Create createAlarmsNotificationsPanelComponent in #alarmPanelContainer
        │   ├── Call fetchAndUpdateAlarms()
        │   └── Start refresh timer (if refreshIntervalSeconds > 0)
        │
        ├── fetchAndUpdateAlarms()
        │   ├── AlarmService.getAlarms({ state: ['OPEN','ACK','ESCALATED','SNOOZED'] })
        │   ├── AlarmService.getAlarmStats(CUSTOMER_ING_ID, period)
        │   ├── AlarmService.getAlarmTrend(CUSTOMER_ING_ID, period, groupBy)
        │   ├── panelInstance.updateAlarms(alarms)
        │   ├── panelInstance.updateStats(stats)
        │   └── panelInstance.updateTrendData(trend)
        │
        ├── onAlarmAction(action, alarm)
        │   ├── AlarmService.acknowledgeAlarm / silenceAlarm / escalateAlarm / closeAlarm
        │   └── → fetchAndUpdateAlarms()
        │
        └── onDestroy()
            ├── Clear refresh timer
            └── panelInstance.destroy()
```

---

## Files

### All four files are in:
```
src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/ALARM/
```

| File | Current State | Action |
|------|--------------|--------|
| `template.html` | Empty stub | **Implement** |
| `styles.css` | Empty stub | **Implement** |
| `controller.js` | Empty stub | **Implement** |
| `settingsSchema.json` | Empty stub | **Implement** |

---

## `template.html`

The HTML shell provides:
1. A sticky **header** with the widget label, alarm count badge, and tab buttons.
2. A `#alarmPanelContainer` div where the library component is mounted.

```
┌────────────────────────────────────────────────────────────────┐
│  🔔 Alarmes e Notificações   (12)   [Refresh ↺]                │
│  ─────────────────────────────────────────────────────────────  │
│  [ Alarms & Notifications ]   [ Dashboard ]                     │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  #alarmPanelContainer                                            │
│  (createAlarmsNotificationsPanelComponent renders here)          │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

Key element IDs:
- `#alarmWidgetRoot` — root element (scoping class for CSS)
- `#labelWidgetId` — widget label text
- `#alarmCount` — live alarm count badge
- `#btnTabList` — "Alarms & Notifications" tab button
- `#btnTabDashboard` — "Dashboard" tab button
- `#btnRefresh` — manual refresh button
- `#alarmPanelContainer` — mount point for the library component

---

## `styles.css`

Scoped under `.alarm-widget-root`. Follows the same CSS custom property convention
as TELEMETRY (`--ink-1`, `--ink-2`, `--bd`, `--accent`, `--brand`, `--font-ui`, etc.)
so both widgets look visually consistent when placed side by side on the same dashboard.

Key sections:
- **Root layout**: `flex-column`, `height: 100%`, `overflow: hidden`.
- **Header**: sticky, gradient background, `border-radius: 12px`, `box-shadow`.
- **Tab navigation**: two pill buttons; active tab gets `--brand` underline/fill.
- **Count badge**: circular badge next to the label showing total open alarm count.
- **Panel container**: `flex: 1 1 auto; overflow: auto` — scrollable content area.

Dark mode: CSS custom property overrides on `[data-theme="dark"] .alarm-widget-root`.

---

## `settingsSchema.json`

```json
{
  "schema": {
    "type": "object",
    "title": "Alarm Widget Settings",
    "properties": {
      "labelWidget": {
        "type": "string",
        "title": "Widget Label",
        "default": "Alarmes e Notificações"
      },
      "defaultTab": {
        "type": "string",
        "title": "Default Tab",
        "enum": ["list", "dashboard"],
        "default": "list",
        "description": "Tab shown when the widget first loads"
      },
      "showCustomerName": {
        "type": "boolean",
        "title": "Show Customer Name on Alarm Cards",
        "default": false,
        "description": "Enable only when this widget is placed on a multi-customer context. On single-shopping dashboards this is redundant."
      },
      "refreshIntervalSeconds": {
        "type": "number",
        "title": "Auto-Refresh Interval (seconds)",
        "default": 60,
        "description": "Set to 0 to disable auto-refresh."
      },
      "maxAlarmsVisible": {
        "type": "number",
        "title": "Max Alarms in List",
        "default": 50,
        "description": "Maximum number of alarms fetched and displayed in the list tab."
      },
      "enableDebugMode": {
        "type": "boolean",
        "title": "Enable Debug Mode",
        "default": false
      }
    }
  },
  "form": [
    "labelWidget",
    "defaultTab",
    "showCustomerName",
    "refreshIntervalSeconds",
    "maxAlarmsVisible",
    "enableDebugMode"
  ]
}
```

---

## `controller.js` — Key Logic

### Widget lifecycle entry points

```javascript
// ThingsBoard lifecycle — called once
self.onInit = async function () { ... };

// ThingsBoard lifecycle — called on widget resize / data update (not used for data)
self.onDataUpdated = function () { /* no-op */ };

// ThingsBoard lifecycle — called on widget destroy
self.onDestroy = function () { ... };
```

### `onInit` flow

```javascript
self.onInit = async function () {
  // 1. Bootstrap shared utilities
  const LogHelper = window.MyIOUtils?.LogHelper || fallbackLogger;
  const MyIOLibrary = window.MyIOLibrary;

  // 2. Read widget settings
  const settings = self.ctx.settings || {};
  const labelWidget = settings.labelWidget || 'Alarmes e Notificações';
  const defaultTab  = settings.defaultTab  || 'list';
  const showCustomerName     = settings.showCustomerName     ?? false;
  const refreshIntervalSecs  = settings.refreshIntervalSeconds ?? 60;
  const maxAlarmsVisible     = settings.maxAlarmsVisible ?? 50;
  const enableDebugMode      = settings.enableDebugMode  ?? false;

  // 3. Fetch CUSTOMER_ING_ID from TB customer SERVER_SCOPE attributes
  //    (same mechanism as MAIN_UNIQUE_DATASOURCE)
  const customerTB_ID = self.ctx.currentUser?.customerId?.id || '';
  const jwt = self.ctx.authUser?.jwtToken || '';
  const attrs = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
  const CUSTOMER_ING_ID = attrs?.['ingestionId'] || '';

  // 4. Mount createAlarmsNotificationsPanelComponent
  const container = document.getElementById('alarmPanelContainer');
  panelInstance = MyIOLibrary.createAlarmsNotificationsPanelComponent({
    container,
    themeMode: detectThemeMode(),
    enableDebugMode,
    alarms: [],
    onAlarmClick: (alarm) => { /* optional: open detail */ },
    onAlarmAction: async (action, alarm) => {
      await handleAlarmAction(action, alarm);
    },
    onTabChange: (tab) => { /* sync internal tab state if needed */ },
  });

  // 5. Set initial tab (driven by setting)
  activateTab(defaultTab);

  // 6. Initial data fetch
  await fetchAndUpdateAlarms();

  // 7. Auto-refresh
  if (refreshIntervalSecs > 0) {
    refreshTimer = setInterval(fetchAndUpdateAlarms, refreshIntervalSecs * 1000);
  }
};
```

### `fetchAndUpdateAlarms` (async helper)

```javascript
async function fetchAndUpdateAlarms() {
  const AlarmService = window.MyIOLibrary?.AlarmService;

  if (!AlarmService || !CUSTOMER_ING_ID) {
    LogHelper.warn('[ALARM] AlarmService or CUSTOMER_ING_ID not available');
    return;
  }

  try {
    panelInstance?.setLoading?.(true);

    const [alarms, stats, trend] = await Promise.all([
      AlarmService.getAlarms({
        state: ['OPEN', 'ACK', 'ESCALATED', 'SNOOZED'],
        limit: maxAlarmsVisible,
      }),
      AlarmService.getAlarmStats(CUSTOMER_ING_ID, 'week'),
      AlarmService.getAlarmTrend(CUSTOMER_ING_ID, 'week', 'day'),
    ]);

    panelInstance?.updateAlarms?.(alarms);
    panelInstance?.updateStats?.(stats);
    panelInstance?.updateTrendData?.(trend);

    // Update count badge in header
    const openCount = alarms.filter(a => a.state === 'OPEN' || a.state === 'ESCALATED').length;
    updateCountBadge(openCount);
  } catch (err) {
    LogHelper.error('[ALARM] fetchAndUpdateAlarms failed:', err);
  } finally {
    panelInstance?.setLoading?.(false);
  }
}
```

### Alarm actions

```javascript
async function handleAlarmAction(action, alarm) {
  const AlarmService = window.MyIOLibrary?.AlarmService;
  if (!AlarmService) return;

  const userEmail = self.ctx.currentUser?.email || 'unknown';

  try {
    if (action === 'acknowledge') await AlarmService.acknowledgeAlarm(alarm.id, userEmail);
    else if (action === 'snooze')  await AlarmService.silenceAlarm(alarm.id, userEmail, '4h');
    else if (action === 'escalate') await AlarmService.escalateAlarm(alarm.id, userEmail);
    else if (action === 'close')    await AlarmService.closeAlarm(alarm.id, userEmail);

    // Invalidate cache and re-fetch
    AlarmService.clearCache?.();
    await fetchAndUpdateAlarms();
  } catch (err) {
    LogHelper.error('[ALARM] Action failed:', action, err);
  }
}
```

### `onDestroy`

```javascript
self.onDestroy = function () {
  if (refreshTimer) clearInterval(refreshTimer);
  panelInstance?.destroy?.();
  panelInstance = null;
};
```

---

## Tab Navigation

The widget header contains two tab buttons that control the visible tab
**inside** the `createAlarmsNotificationsPanelComponent`. The component
already supports two built-in views (`list` and `dashboard`); the widget
header buttons are visual affordances that call the component's internal
tab-switch mechanism.

```
[● Alarms & Notifications]  [ Dashboard ]
         ↑ active
```

Active tab indicator: bottom border in `--brand` color (`#1f6fb5`), same as
the accent used across TELEMETRY and other premium widgets.

The `defaultTab` setting controls which tab is pre-selected on load.

---

## Single-Shopping vs Head Office Differences

| Aspect | Head Office (MAIN_UNIQUE_DATASOURCE) | This widget (ALARM) |
|--------|--------------------------------------|---------------------|
| Shopping scope | All shoppings, multi-customer | Single shopping only |
| Customer ID source | `CUSTOMER_ING_ID` from `attrs.ingestionId` | Same — from `ctx.currentUser.customerId` → attributes |
| `customerName` on cards | Always shown (disambiguates shopping) | **Hidden by default** (`showCustomerName = false`) |
| Multi-shopping filter | Yes (shopping selector in menu) | **Not needed** |
| Placement | Embedded inside MAIN widget panel | **Standalone ThingsBoard widget** |
| Datasource | `MAIN_UNIQUE_DATASOURCE` controller | Independent — owns its own lifecycle |
| Refresh | Triggered by ThingsBoard `onDataUpdated` | **Timer-based** (`refreshIntervalSeconds`) |

---

## `showCustomerName` Setting Behavior

When `showCustomerName = false` (default):
- The `customerName` field is **not rendered** on alarm cards.
- The alarm card layout uses the freed space to expand the title/description area.
- No visual change to the Dashboard tab (stats/charts don't reference customer names).

When `showCustomerName = true`:
- The `customerName` is rendered on cards as a secondary label below the source.
- Use case: operator places this widget on a cross-customer reporting dashboard
  (unusual, but supported).

The setting is passed to `createAlarmsNotificationsPanelComponent` via a component
prop or a CSS class toggle on `#alarmWidgetRoot`.

---

## Period Mapping (Dashboard tab)

The Dashboard tab stats and charts default to `'week'` period. A period selector
within the component allows switching to `'day'` / `'month'`. The widget maps
UI periods to `AlarmService` API parameters identically to how
`fetchAndUpdateDashboard()` does it in MAIN_UNIQUE_DATASOURCE:

| UI Period | `AlarmService` period | `groupBy` |
|-----------|----------------------|-----------|
| Today | `'day'` | `'hour'` |
| This Week | `'week'` | `'day'` |
| This Month | `'month'` | `'day'` |

---

## CSS Architecture

Root class: `.alarm-widget-root` (set on `#alarmWidgetRoot` in template.html).

CSS custom properties mirror the TELEMETRY widget palette so both widgets
look visually consistent when placed side by side:

```css
.alarm-widget-root {
  --ink-1:   #1c2743;
  --ink-2:   #6b7a90;
  --bd:      #e8eef4;
  --card:    #ffffff;
  --accent:  #1f6fb5;
  --brand:   #1f6fb5;
  --shadow:  0 8px 24px rgba(0,0,0,0.06);
  --font-ui: Inter, 'Inter var', system-ui, sans-serif;

  /* Alarm-specific */
  --alarm-critical: #ef4444;
  --alarm-high:     #f97316;
  --alarm-medium:   #eab308;
  --alarm-low:      #3b82f6;
  --alarm-info:     #6b7280;
}

/* Dark mode */
[data-theme="dark"] .alarm-widget-root {
  --ink-1: #f1f5f9;
  --ink-2: #94a3b8;
  --bd:    #334155;
  --card:  #1e293b;
  --brand: #60a5fa;
}
```

---

## Error & Loading States

| State | Behavior |
|-------|----------|
| Loading (first render) | `panelInstance.setLoading(true)` — component shows spinner overlay |
| Loading (refresh) | Same — spinner does not clear existing list (non-blocking) |
| `AlarmService` unavailable | Warning logged; panel remains empty with a user-visible message |
| API error | Error logged; panel retains last successful data; optional error banner |
| No alarms | Component renders its built-in empty state ("Nenhum alarme encontrado") |

---

## Testing Checklist

- [ ] Widget renders on a single-shopping ThingsBoard dashboard
- [ ] `CUSTOMER_ING_ID` correctly resolved from TB customer attributes
- [ ] Alarm list tab shows real alarms from `AlarmService.getAlarms()`
- [ ] Dashboard tab shows real stats, trend chart, severity donut
- [ ] `customerName` hidden by default; visible when `showCustomerName = true`
- [ ] Acknowledge action changes alarm state to ACK and refreshes the list
- [ ] Snooze, escalate, close actions work correctly
- [ ] Auto-refresh fires at the configured interval
- [ ] Manual refresh button clears cache and re-fetches
- [ ] Count badge in header reflects current open + escalated alarm count
- [ ] `defaultTab = 'dashboard'` opens the widget on the dashboard tab
- [ ] Dark mode renders correctly
- [ ] Widget destroys cleanly (no timer leaks, component cleanup)
- [ ] Empty state shows when customer has no alarms
- [ ] Error state shows gracefully when API is unreachable
- [ ] `maxAlarmsVisible` limits the number of alarms fetched

---

## Open Questions

1. **Theme detection**: Should the widget read `themeMode` from `ctx.settings` or
   detect it from the ThingsBoard page class? (TELEMETRY reads from settings; follow
   the same approach for consistency.)

2. **Real-time updates**: Should the widget connect `AlarmService` WebSocket for
   push updates, or rely solely on the polling timer? WebSocket is the ideal
   long-term solution but adds complexity; polling is simpler and aligns with the
   `MAIN_UNIQUE_DATASOURCE` timer approach.

3. **Alarm detail modal**: Should clicking an alarm card open a detail side-sheet
   inside the widget, or fire a ThingsBoard `openDashboard` navigation action?
   Deferred to a follow-up RFC.

---

## Dependencies

| Dependency | Status |
|------------|--------|
| `createAlarmsNotificationsPanelComponent` | ✅ Available (RFC-0152 Phase 4) |
| `AlarmService.getAlarms / getAlarmStats / getAlarmTrend` | ✅ Available (RFC-0175) |
| `AlarmService.acknowledgeAlarm / silenceAlarm / escalateAlarm / closeAlarm` | ✅ Available (RFC-0175) |
| `fetchThingsboardCustomerAttrsFromStorage` | ✅ Available in `MyIOLibrary` |
| `AlarmService.clearCache()` | ✅ Available (RFC-0175) |

No new library exports required. All infrastructure is in place.
