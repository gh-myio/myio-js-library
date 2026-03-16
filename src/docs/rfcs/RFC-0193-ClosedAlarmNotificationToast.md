# RFC-0193 — Closed Alarm Notification Toast

- **Status**: Implemented
- **Date**: 2026-03-13
- **Branch**: `fix/rfc-0152-real-data`
- **Author**: MYIO Engineering

---

## Summary

Extend the new-alarm notification toast (RFC-0192 inline) with a symmetric **closed-alarm toast** that appears when alarms disappear from the active queue, indicating they were resolved/closed since the last refresh cycle.

---

## Motivation

RFC-0192 surfaces new alarm arrivals via a floating toast. However, operators have no equivalent visual signal when alarms are resolved. Knowing that an alarm closed is equally important for situational awareness — it confirms that corrective action was effective without requiring the operator to open the full alarms panel.

---

## Design

### Detection mechanism

`_buildAlarmServiceOrchestrator` already maintains `_lastKnownAlarmIds` (a `Set<id>`). The new mechanism adds a parallel `_lastKnownAlarmMap` (`Map<id, alarm>`) that preserves the full alarm objects from the previous cycle.

On each subsequent rebuild:

```
closedAlarms = alarms in _lastKnownAlarmMap whose id is NOT in currentIds
```

These are alarms that were active in the previous cycle but absent from the current one — i.e., they closed (resolved, manually closed, expired, etc.).

The first call (cold start, `_lastKnownAlarmIds === null`) never triggers either toast.

### Visual design

| Property       | New alarm toast                  | Closed alarm toast              |
|----------------|----------------------------------|---------------------------------|
| Accent colour  | severity-based (red/amber/blue)  | `#10b981` (green)               |
| Icon           | 🔔                               | ✅                               |
| Count line     | "N novo(s) alarme(s) detectado(s)" | "N alarme(s) encerrado(s)"    |
| Detail line    | alarm title + device name        | alarm title + device name       |
| DOM id         | `myio-alarm-notification`        | `myio-alarm-closed-notification` |
| Auto-dismiss   | 6 s                              | 5 s                             |
| Timer variable | `_alarmNotificationTimer`        | `_alarmClosedNotifTimer`        |

Both toasts can coexist simultaneously (different DOM ids, different timers).

---

## Implementation

**File**: `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`

### New module-level variables (alongside `_lastKnownAlarmIds`)

```js
let _lastKnownAlarmMap    = null; // Map<id, alarm> — used for closed-alarm detection
let _alarmClosedNotifTimer = null;
```

### New function `_showClosedAlarmNotification(closedAlarms)`

Mirrors `_showNewAlarmNotification` but uses green accent, ✅ icon, and "encerrado" copy.

### Updated diff block inside `_buildAlarmServiceOrchestrator`

```js
// Before (RFC-0192):
const currentIds = new Set(normalizedAlarms.map(a => a.id).filter(Boolean));
if (_lastKnownAlarmIds !== null) {
  const newAlarms = normalizedAlarms.filter(a => a.id && !_lastKnownAlarmIds.has(a.id));
  if (newAlarms.length > 0) _showNewAlarmNotification(newAlarms);
}
_lastKnownAlarmIds = currentIds;

// After (RFC-0193):
const currentIds = new Set(normalizedAlarms.map(a => a.id).filter(Boolean));
const currentMap = new Map(normalizedAlarms.filter(a => a.id).map(a => [a.id, a]));
if (_lastKnownAlarmIds !== null) {
  const newAlarms    = normalizedAlarms.filter(a => a.id && !_lastKnownAlarmIds.has(a.id));
  const closedAlarms = [..._lastKnownAlarmMap.values()].filter(a => !currentIds.has(a.id));
  if (newAlarms.length    > 0) _showNewAlarmNotification(newAlarms);
  if (closedAlarms.length > 0) _showClosedAlarmNotification(closedAlarms);
}
_lastKnownAlarmIds = currentIds;
_lastKnownAlarmMap = currentMap;
```

---

## Limitations

- Detection is based on the active-alarm list (`OPEN,ACK,ESCALATED,SNOOZED`). An alarm that closes between two refresh cycles is correctly detected. An alarm closed before the first prefetch is never surfaced.
- The toast does not distinguish between "closed by operator" and "auto-expired" — both appear as "encerrado".
- If the refresh interval is long (default 180 s), the toast may appear with a delay relative to the actual closure time.

---

## Files Changed

| File | Change |
|------|--------|
| `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js` | Add `_lastKnownAlarmMap`, `_alarmClosedNotifTimer`, `_showClosedAlarmNotification`; update diff block |
