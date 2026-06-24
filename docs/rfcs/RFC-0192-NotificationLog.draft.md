# RFC-0192 — Notification Log: Header Bell Button + log_notify Attribute + NotificationLogManager

- **Status**: Draft — Pending author review
- **Date**: 2026-03-12
- **Branch**: `fix/rfc-0152-real-data`
- **Author**: MYIO Engineering

---

## Summary

Introduce a **Notification Log** system across the MYIO shopping dashboard:

1. A new **bell icon button** in the `HEADER` widget, placed next to the existing "Limpar" button,
   that opens a premium modal listing recent alarm notifications.
2. A **`log_notify`** ThingsBoard `SERVER_SCOPE` attribute on the customer entity that caches
   today's notifications as a JSON blob, along with the last confirmed fetch date.
3. A **`NotificationLogManager`** class/object initialised in `MAIN_VIEW/controller.js` and
   exposed on `window.MyIOOrchestrator`, providing `.init()` and
   `.loadByIntervalDate(startDate, endDate)` methods that fetch notifications from the
   **Alarms API**, persist the cache, and broadcast the result to the HEADER modal.

---

## Motivation

The new-alarm toast introduced in the dashboard (RFC-0192 inline implementation) surfaces
real-time alarm arrivals, but operators have no way to review the full notification history
for the current period without opening the full alarm management panel.

The HEADER widget already owns the date period selector. Adding a bell button there gives
operators a **single, contextual entry point** to review all notifications that arrived within
the selected period, without leaving the current dashboard view.

Persisting today's cache in `log_notify` reduces redundant API calls when the operator opens
the modal multiple times in the same session, while the `lastFetchedDate` field allows the
system to know how far back confirmed data exists in the GCDR/Alarms backend.

---

## Detailed Design

### 1. HEADER Widget — Bell Icon Button

**Files**: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/template.html`
and `styles.css`.

A bell icon button (`🔔`) is added immediately to the left of the existing "Limpar" button
in the HEADER toolbar. It opens the Notification Log modal.

```html
<!-- Placed next to the existing "Limpar" button -->
<button id="btn-notification-log" class="header-action-btn header-action-btn--bell"
        title="Histórico de Notificações" onclick="openNotificationLog()">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
  <span class="bell-badge" id="bell-badge" style="display:none;"></span>
</button>
```

The bell badge (`bell-badge`) shows the count of unread/new notifications since the last
modal open. It is updated whenever `myio:alarms-updated` fires with new entries.

#### CSS additions (`styles.css`)

```css
.header-action-btn--bell {
  position: relative;
  /* inherits shared .header-action-btn sizing */
}
.bell-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #dc2626;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  pointer-events: none;
}
```

---

### 2. Notification Log Modal (HEADER)

A **premium modal overlay** rendered by the HEADER widget on `openNotificationLog()`.

- Reads notifications from `window.MyIOOrchestrator.notificationLog.currentDayItems` (today's
  cache) and/or triggers `.loadByIntervalDate()` for the active period.
- Displays a scrollable list of notification cards, grouped by date.
- Each card shows: severity badge · title · device name · timestamp.
- A "Atualizar" (refresh) button re-calls `.loadByIntervalDate()`.

> **[UNRESOLVED — Q4]** Whether the modal shows **only today's cache** or **all notifications
> for the full header period** is pending author decision — see Unresolved Questions.

---

### 3. `log_notify` ThingsBoard Attribute

**Entity**: Customer (`SERVER_SCOPE`)
**Key**: `log_notify`
**Type**: JSON string (serialised)

#### Proposed schema

```jsonc
{
  // The most recent date for which notifications are confirmed present in GCDR/Alarms.
  // Used to know "how far back we trust the data" across sessions.
  "lastFetchedDate": "2026-03-12",

  // Cache for the current calendar day only.
  // Replaced on every successful fetch that covers today.
  "currentDay": {
    "date": "2026-03-12",         // ISO date string (YYYY-MM-DD)
    "fetchedAt": "2026-03-12T14:30:00.000Z",  // timestamp of last successful fetch
    "items": [
      // Array of notification objects returned by the Alarms API endpoint.
      // Schema TBD — see Unresolved Questions (Q2).
    ]
  }
}
```

**Cache strategy**: Only `currentDay` is stored in the attribute. Historical days are fetched
live from the Alarms API on demand and are never persisted to TB (to avoid attribute size
limits). The `lastFetchedDate` field acts as a "watermark" so the UI can show a warning if
the requested period predates the earliest available data.

> **[UNRESOLVED — Q6]** Whether the `PUT` to `log_notify` uses the ThingsBoard SDK
> (`self.ctx.attributeService`) or a direct REST call is pending — see Unresolved Questions.

---

### 4. `NotificationLogManager` — exposed on `MyIOOrchestrator`

**File**: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`

```javascript
window.MyIOOrchestrator.notificationLog = {

  /** Today's cached notifications (populated by init or loadByIntervalDate). */
  currentDayItems: [],

  /** Last date for which we have confirmed data from the Alarms API. */
  lastFetchedDate: null,

  /**
   * Initialise: reads log_notify from TB attribute store, populates currentDayItems
   * if today's cache is fresh (fetchedAt within the current calendar day),
   * and exposes lastFetchedDate.
   *
   * Called once from MAIN_VIEW onInit() after orchestrator is ready.
   */
  async init() { /* ... */ },

  /**
   * Fetch notifications for the given date range from the Alarms API,
   * update currentDayItems if the range includes today,
   * persist the updated log_notify attribute to ThingsBoard,
   * and dispatch `myio:notification-log-updated` with the full result set.
   *
   * @param {string} startDate - ISO date string (e.g. "2026-03-05")
   * @param {string} endDate   - ISO date string (e.g. "2026-03-12")
   * @returns {Promise<NotificationItem[]>} All notifications for the period
   */
  async loadByIntervalDate(startDate, endDate) { /* ... */ },

};
```

#### `init()` flow

```
1. Read log_notify from TB (GET SERVER_SCOPE attribute)
2. Parse JSON → extract lastFetchedDate + currentDay
3. If currentDay.date === today AND fetchedAt is from today:
     → populate currentDayItems from cache (no API call)
4. Else:
     → call loadByIntervalDate(today, today) to refresh
5. Dispatch myio:notification-log-updated
```

#### `loadByIntervalDate(startDate, endDate)` flow

```
1. Call Alarms API endpoint with period + customerId
   [UNRESOLVED — Q1: endpoint path/method]
2. Receive array of notification items
   [UNRESOLVED — Q2: item schema]
3. If endDate >= today:
     → update currentDay cache with today's slice of the result
     → PUT log_notify attribute to TB with updated JSON
4. Dispatch myio:notification-log-updated with full result
5. Return full result array
```

#### Date source

The date range for `.loadByIntervalDate()` comes from the period selector managed by the
HEADER widget. The MAIN_VIEW can read the active period via
`window.MyIOOrchestrator.getCurrentPeriod()` which returns `{ startDateISO, endDateISO }`.

The HEADER widget listens to the same dates via `self.ctx.$scope.startDateISO /
endDateISO`. When the period changes (event `myio:update-date`), MAIN can automatically
re-call `.loadByIntervalDate()` with the new range.

> **[UNRESOLVED — Q5]** Whether `loadByIntervalDate` is triggered **automatically** on
> period change or **manually** (user opens modal / clicks refresh) is pending — see
> Unresolved Questions.

---

### 5. New Event

| Event | Payload | Dispatched by |
|-------|---------|---------------|
| `myio:notification-log-updated` | `{ items: NotificationItem[], date: string, fromCache: boolean }` | `NotificationLogManager` after each load |

The HEADER widget listens to this event to refresh the modal content and update the
bell badge count.

---

### 6. Sequence Diagram

```
MAIN_VIEW onInit()
  └─► notificationLog.init()
        ├─ read log_notify from TB
        └─ if stale → loadByIntervalDate(today, today)
                        ├─ GET {alarmsApiBaseUrl}/?endpoint [Q1]
                        ├─ update currentDay cache
                        ├─ PUT log_notify → TB SERVER_SCOPE [Q6]
                        └─ dispatch myio:notification-log-updated

User clicks bell button (HEADER)
  └─► openNotificationLog()
        ├─ reads notificationLog.currentDayItems (fast, from cache)
        ├─ OR calls loadByIntervalDate(headerStart, headerEnd) [Q5]
        └─ renders modal with notification cards

Period changes (myio:update-date)  [Q5 — if auto-load enabled]
  └─► notificationLog.loadByIntervalDate(newStart, newEnd)
```

---

## Files to Modify / Create

| File | Change |
|------|--------|
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/template.html` | Add bell button + badge next to "Limpar" |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/styles.css` | Bell button + badge styles + modal overlay styles |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/controller.js` | `openNotificationLog()` + modal render + `myio:notification-log-updated` listener |
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` | `NotificationLogManager` object + `.init()` + `.loadByIntervalDate()` + expose on `MyIOOrchestrator` |

---

## Drawbacks

- `log_notify` is a TB `SERVER_SCOPE` attribute — ThingsBoard imposes a practical size limit
  on attribute values (~64 KB). Caching only `currentDay` mitigates this, but if today has
  a very large number of notifications, the attribute may still grow large.
- The `PUT` to `log_notify` runs on every `loadByIntervalDate` call that covers today. If
  the period selector fires frequently (e.g. user drags a date range), this could generate
  excessive write traffic to ThingsBoard. Debouncing is recommended.

---

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Store full history in `log_notify` | TB attribute size limits; historical data should be fetched live |
| Use `localStorage` instead of TB attribute | Not available in ThingsBoard iframe context; not synced across devices/sessions |
| Poll the Alarms API on a timer | Unnecessary load; period-driven fetch is sufficient |

---

## Unresolved Questions

> These questions must be answered by the author before implementation begins.

### Q1 — Alarms API endpoint path

What is the URL, HTTP method, and query parameter format for the notification history
endpoint in the Alarms API?

```
Expected form (TBD):
GET {alarmsApiBaseUrl}/api/v1/notifications?customerId=...&from=...&to=...&limit=...
```

Is it `/notifications`, `/alarms`, or another path? Are `from`/`to` ISO timestamps or
date strings? Is pagination supported?

---

### Q2 — Notification object schema

What does a notification object returned by the endpoint look like? Is it identical to
the `GCDRAlarm` shape already used in `AlarmsTab` and `AlarmServiceOrchestrator`?

```jsonc
// Known GCDRAlarm fields (current):
{
  "id": "...", "title": "...", "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "state": "OPEN|ACK|...", "deviceId": "...", "deviceName": "...",
  "raisedAt": "...", "lastUpdatedAt": "...", "metadata": { ... }
}
// Are notification objects the same shape, or is there a separate schema?
```

---

### Q3 — `log_notify` JSON structure

Is the proposed schema in Section 3 (`lastFetchedDate` + `currentDay.items`) correct, or
does the author want a different structure? For example:

- Should `currentDay.items` be stored as a summary (count + top severity) rather than
  full objects, to reduce attribute size?
- Should multiple recent days be cached (e.g. last 3 days) rather than only today?

---

### Q4 — Modal scope: today's cache vs full period

When the operator opens the modal via the bell button:

**(a) Today-only** — shows only `currentDay.items` from the cache (fast, no API call).
The period selector does not affect the modal content.

**(b) Full period** — calls `.loadByIntervalDate(headerStart, headerEnd)` on every open,
fetching all notifications for the currently selected date range.

Which behaviour is desired?

---

### Q5 — Trigger for `loadByIntervalDate`

Should `.loadByIntervalDate()` be called:

- **Automatically** when the HEADER period changes (`myio:update-date` event)?
- **On modal open** (lazy — only when the user clicks the bell)?
- **On a timer** (e.g. every N minutes during an active session)?
- A **combination** (auto on period change + refresh button inside modal)?

---

### Q6 — ThingsBoard attribute write method

Should the `PUT` to `log_notify` use:

- **ThingsBoard internal SDK**: `self.ctx.attributeService.saveEntityAttributes(...)` —
  available in the widget context, no separate auth required.
- **Direct REST**: `PUT /api/plugins/telemetry/CUSTOMER/{customerTB_ID}/attributes/SERVER_SCOPE`
  with the JWT token from `localStorage` — same pattern already used in this codebase.

Which is preferred?
