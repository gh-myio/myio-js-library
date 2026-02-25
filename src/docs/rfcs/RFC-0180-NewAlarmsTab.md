# RFC-0180: Alarms Tab in Settings Modal + Customer Alarms Pre-fetch Architecture

- **RFC Number:** 0180
- **Status:** Implemented
- **Start Date:** 2026-02-24
- **Related RFCs:** RFC-0104 (Annotations Tab), RFC-0179 (openAlarmBundleMapModal)
- **Files Affected:**
  - `src/components/premium-modals/settings/alarms/AlarmsTab.ts` *(new)*
  - `src/components/premium-modals/settings/SettingsModalView.ts`
  - `src/components/premium-modals/settings/types.ts`
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`
  - `showcase/main-view-shopping/index.html`

---

## Summary

This RFC introduces two coordinated changes to the device settings experience:

1. **New "Alarmes" tab in SettingsModal** — a third tab (alongside General and Annotations) with two sections:
   - **Section 1 — Alarmes Ativos:** shows live alarm occurrences for the current device, grouped by `ruleId`, rendered using the existing `createAlarmCardElement` component with state-count chips and action buttons (acknowledge, snooze, escalate). Data comes from the **Alarms API** (`https://alarms-api.a.myio-bas.com`).
   - **Section 2 — Parametrizar Regras de Alarme:** a multi-select table of all GCDR customer rules; the user checks/unchecks rules to associate or dissociate the device, then saves. Data comes from the **GCDR API** (`https://gcdr-api.a.myio-bas.com`).

2. **Customer alarms pre-fetch architecture** — MAIN_VIEW pre-fetches all open/active alarms for the customer at startup via a single `GET /api/v1/alarms?customerId=...` call and stores the result in `window.MyIOOrchestrator.customerAlarms`. When the Alarms tab opens, it filters that in-memory cache by `gcdrDeviceId` instead of making a per-device HTTP call.

---

## Motivation

### Alarms Tab

There was no way to inspect or manage alarm occurrences for a specific device from within the settings modal. The only entry point was the full Alarm Bundle Map modal (RFC-0179), which shows all devices across the shopping and is not focused on a single device.

Users opening the settings modal for a device should be able to:
1. See which alarms are currently active for that device (real occurrences, not rule definitions).
2. Quickly associate or dissociate GCDR alarm rules without navigating to a separate modal.

### Pre-fetch Architecture

Making a per-device call to the Alarms API every time the settings modal opens introduces visible loading delay and multiplies network requests when the user browses several devices in quick succession.

MAIN_VIEW already has the GCDR credentials (`gcdrCustomerId`, `gcdrTenantId`) available at startup and is the natural orchestration point for shared data. Fetching once at customer level and filtering locally reduces network traffic to a single startup call.

---

## Guide-Level Explanation

### Alarms Tab — Overview

When a user opens the settings modal for a device the **Alarmes** tab is the third tab (after General and Annotations). It shows two sections stacked vertically.

#### Section 1 — Alarmes Ativos

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔔  Alarmes Ativos                                          [badge: 3 types] │
│     3 ocorrências em 1 tipo                                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ [alarm-card]  Consumo diário excedido        OPEN  HIGH                  │ │
│ │               Aberto × 3                                                 │ │
│ │               [Acknowledge]  [Snooze]  [Escalate]                        │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

- One card per unique `metadata.ruleId` (or `title` as fallback), regardless of how many raw alarm occurrences exist.
- Each card header shows the rule's title, dominant state (most critical), and highest severity.
- The card body shows state-count chips: `"Aberto × 44"`, `"Reconhecido × 2"`, etc.
- The card footer contains the standard action buttons from the shared `AlarmCard` component.
- Actions (acknowledge, snooze, escalate) are applied in bulk to all raw alarm IDs in the group via `Promise.all(group.alarmIds.map(...))`, then the grid refreshes.
- When no alarms are active, an empty-state message is shown.

#### Section 2 — Parametrizar Regras de Alarme

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚙️  Parametrizar Regras de Alarme                                             │
│     Selecione as regras de alarme aplicáveis a este dispositivo e salve      │
├──────────────────────────────────────────────────────────────────────────────┤
│ [✓] Consumo alto noturno     energy_consumption > 50   [HIGH]                │
│ [✓] Potência máxima          instantaneous_power > 5000 [CRITICAL]           │
│ [ ] Temperatura alta         temperature > 28           [MEDIUM]             │
│                                                       [ Salvar Alarmes ]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

- All customer-level GCDR rules are listed.
- Rules already associated with this device (i.e. `rule.scope.entityIds.includes(gcdrDeviceId)`) are pre-checked.
- **Save** issues one `PUT /api/v1/rules/{ruleId}` per *changed* rule with the updated `scope.entityIds` array.
- Because GCDR has no granular add/remove endpoint, the full current `entityIds` array is read from the in-memory rule list, mutated locally, and sent in full.

### Pre-fetch Architecture — User Experience

The user sees no change in UX. Loading is faster because MAIN_VIEW fetched all customer alarms before the user opens any settings modal. If the pre-fetch is still in-flight when the modal opens, the tab falls back to a per-device API call.

---

## Reference-Level Explanation

### Part 1 — AlarmsTab Component

**Location:** `src/components/premium-modals/settings/alarms/AlarmsTab.ts`

#### 1.1 Configuration interface

```ts
interface AlarmsTabConfig {
  container: HTMLElement;
  /** GCDR UUID of this device (SERVER_SCOPE attr `gcdrDeviceId` on TB device) */
  gcdrDeviceId: string;
  /** GCDR UUID of the customer */
  gcdrCustomerId: string;
  /** GCDR Tenant ID — sent as X-Tenant-ID header on all GCDR/Alarms API requests */
  gcdrTenantId: string;
  /** GCDR API base URL. Defaults to https://gcdr-api.a.myio-bas.com */
  gcdrApiBaseUrl?: string;
  /** Alarms API base URL. Defaults to https://alarms-api.a.myio-bas.com */
  alarmsApiBaseUrl?: string;
  /** ThingsBoard device UUID */
  tbDeviceId: string;
  /** JWT token — reserved for future auth flows */
  jwtToken: string;
  /** Pre-fetched GCDR bundle from MAIN_VIEW orchestrator — reserved */
  prefetchedBundle?: GCDRCustomerBundle | null;
  /** Pre-fetched customer alarms from MAIN_VIEW orchestrator (raw API format).
   *  When provided, the tab filters by gcdrDeviceId and skips the per-device call. */
  prefetchedAlarms?: unknown[] | null;
}
```

#### 1.2 Raw alarm shape (`GCDRAlarm`)

Describes the object returned by `GET /api/v1/alarms`:

```ts
interface GCDRAlarm {
  id: string;
  title: string;
  severity: string;      // CRITICAL | HIGH | MEDIUM | LOW | INFO
  state: string;         // OPEN | ACK | ESCALATED | SNOOZED | CLOSED
  alarmType?: string;
  description?: string;
  deviceId?: string;     // gcdrDeviceId — used for pre-fetch filtering
  deviceName?: string;
  raisedAt?: string;         // ISO-8601 timestamp
  lastUpdatedAt?: string;    // ISO-8601 timestamp
  acknowledgedAt?: string;
  metadata?: {
    ruleId?: string;         // primary group key
    value?: number | string;
    threshold?: number | string;
    operator?: string;
    tbDeviceId?: string;
    [key: string]: unknown;
  };
}
```

**Note:** The Alarms API returns `{ "data": GCDRAlarm[] }` (direct array, not a paginated wrapper). Field names differ from ThingsBoard conventions: `raisedAt` / `lastUpdatedAt` instead of `firstOccurrence` / `lastOccurrence`.

#### 1.3 Alarm group aggregation (`GCDRAlarmGroup`)

Multiple raw alarm occurrences sharing the same `metadata.ruleId` are collapsed into one group before rendering:

```ts
interface GCDRAlarmGroup {
  ruleId: string;
  title: string;
  alarmType?: string;
  severity: string;        // highest severity across group
  dominantState: string;   // most-critical state (OPEN > ESCALATED > SNOOZED > ACK)
  stateCounts: Record<string, number>; // { OPEN: 44, ACK: 2, ... }
  totalCount: number;
  firstOccurrence: string; // earliest raisedAt
  lastOccurrence: string;  // latest lastUpdatedAt
  alarmIds: string[];      // all raw alarm IDs — used for bulk actions
}
```

Grouping key precedence: `metadata.ruleId` → `alarm.title` → `alarm.id`.

Sort order: most-critical `dominantState` first (OPEN=0, ESCALATED=1, SNOOZED=2, ACK=3), then highest `severity` within the same state.

#### 1.4 Mapping to `Alarm` type (`mapGroupToAlarm`)

`createAlarmCardElement` from `AlarmsNotificationsPanel/AlarmCard.ts` expects an `Alarm` object. The bridge function converts a `GCDRAlarmGroup`:

```ts
private mapGroupToAlarm(group: GCDRAlarmGroup): Alarm {
  // State-count chips sorted most-critical first: ["Aberto × 44", "Reconhecido × 2"]
  const stateChips = Object.entries(group.stateCounts)
    .sort((a, b) => STATE_PRIORITY[a[0]] - STATE_PRIORITY[b[0]])
    .map(([state, count]) => `${STATE_LABELS[state] || state} × ${count}`);

  return {
    id:              group.ruleId,
    customerId:      this.config.gcdrCustomerId,
    severity:        group.severity as AlarmSeverity,
    state:           group.dominantState as AlarmState,
    title:           group.title,
    firstOccurrence: group.firstOccurrence,
    lastOccurrence:  group.lastOccurrence,
    occurrenceCount: group.totalCount,
    _alarmTypes:     stateChips,   // displayed as scrollable chips in card body
    // ...other required fields set to empty defaults
  };
}
```

#### 1.5 Card rendering (`populateAlarmsGrid`)

```ts
const el = createAlarmCardElement(alarm, {
  showCustomerName: false,
  showDeviceBadge:  false,
  alarmTypes:       alarm._alarmTypes,
  onAcknowledge: async () => {
    await Promise.all(group.alarmIds.map(id => postAlarmAction(alarmsBaseUrl, id, 'acknowledge')));
    await refreshAlarmsGrid(alarmsBaseUrl);
  },
});

// snooze / escalate fire as bubbling CustomEvents on the card element
el.addEventListener('alarm-snooze',   async () => { /* bulk snooze + refresh */ });
el.addEventListener('alarm-escalate', async () => { /* bulk escalate + refresh */ });

grid.appendChild(el);
```

The grid wrapper uses `div.myio-alarms-panel.at-alarms-panel-host` so the shared `ALARMS_NOTIFICATIONS_PANEL_STYLES` CSS variables and `.alarm-card` rules apply. The tab also injects its own scoped `at-*` styles.

#### 1.6 `init()` flow

```
AlarmsTab.init()
  |
  |-- injectStyles()    (ALARMS_NOTIFICATIONS_PANEL_STYLES + at-* overrides)
  |-- container.innerHTML = loadingHTML
  |
  |-- if prefetchedAlarms != null
  |     alarmsPromise = Promise.resolve(
  |       prefetchedAlarms.filter(a => a.deviceId === gcdrDeviceId)
  |     )
  |   else
  |     alarmsPromise = fetchActiveAlarms(alarmsBaseUrl)
  |
  |-- [alarmsPromise, fetchCustomerRules(gcdrBaseUrl)] run in Promise.all
  |
  |-- groupAlarms(alarms) → alarmGroups
  |-- build initialCheckedRuleIds from rules whose scope.entityIds includes gcdrDeviceId
  |
  |-- container.innerHTML = renderTab()
  |-- populateAlarmsGrid()
  `-- attachTabListeners()
```

---

### Part 2 — Two Separate API Services

This RFC uses two distinct backend services:

| Service | Base URL | Auth | Purpose |
|---------|----------|------|---------|
| Alarms API | `https://alarms-api.a.myio-bas.com` | `X-API-Key` + `X-Tenant-ID` | Alarm occurrences (Section 1) |
| GCDR API | `https://gcdr-api.a.myio-bas.com` | `X-API-Key` + `X-Tenant-ID` | Rule definitions (Section 2) |

Both use the same integration key: `gcdr_cust_tb_integration_key_2026`.

#### Alarms API endpoints used

```
# Section 1 — per-device fallback (when pre-fetch not available)
GET {alarmsBaseUrl}/api/v1/alarms
  ?deviceId={gcdrDeviceId}
  &state=OPEN,ACK,ESCALATED,SNOOZED
  &limit=100
  &page=1

# Pre-fetch — customer-wide (MAIN_VIEW at startup)
GET {alarmsBaseUrl}/api/v1/alarms
  ?state=OPEN,ACK,ESCALATED,SNOOZED
  &customerId={gcdrCustomerId}
  &limit=100

# Alarm actions (acknowledge / snooze / escalate)
POST {alarmsBaseUrl}/api/v1/alarms/{alarmId}/{action}
```

Response shape: `{ "data": GCDRAlarm[] }` where `data` is a direct array.

#### GCDR API endpoints used

```
# Section 2 — list all customer rules
GET {gcdrBaseUrl}/api/v1/customers/{gcdrCustomerId}/rules

# Section 2 — update rule scope (full array replacement)
PUT {gcdrBaseUrl}/api/v1/rules/{ruleId}
Body: { "scope": { "type": "DEVICE", "entityIds": ["uuid1", "uuid2"] } }
```

---

### Part 3 — Customer Alarms Pre-fetch (`MAIN_VIEW/controller.js`)

#### 3.1 New function `_prefetchCustomerAlarms`

Added near `fetchDeviceCountAttributes` in MAIN_VIEW:

```js
async function _prefetchCustomerAlarms(gcdrCustomerId, gcdrTenantId, alarmsBaseUrl) {
  const ALARMS_API_KEY = 'gcdr_cust_tb_integration_key_2026';
  const url = `${alarmsBaseUrl}/api/v1/alarms`
    + `?state=OPEN,ACK,ESCALATED,SNOOZED`
    + `&customerId=${encodeURIComponent(gcdrCustomerId)}`
    + `&limit=100`;

  const response = await fetch(url, {
    headers: {
      'X-API-Key': ALARMS_API_KEY,
      'X-Tenant-ID': gcdrTenantId || '',
      'Accept': 'application/json',
    },
  });
  if (!response.ok) return;

  const json = await response.json();
  const alarms = Array.isArray(json.data)
    ? json.data
    : (json.items ?? json.data?.items ?? []);

  if (window.MyIOOrchestrator) {
    window.MyIOOrchestrator.customerAlarms = alarms;
  }
}
```

#### 3.2 Call site in MAIN_VIEW `onInit`

Invoked fire-and-forget (no `await`) after `gcdrCustomerId` is published to the orchestrator:

```js
if (gcdrCustomerId) {
  _prefetchCustomerAlarms(
    gcdrCustomerId,
    gcdrTenantId,
    window.MyIOOrchestrator?.alarmsApiBaseUrl || 'https://alarms-api.a.myio-bas.com',
  );
}
```

#### 3.3 Orchestrator fields (new)

```js
window.MyIOOrchestrator = {
  // ... existing fields ...

  // RFC-0180: Pre-fetched customer alarms
  customerAlarms: null,   // GCDRAlarm[] | null (raw Alarms API objects)
};
```

---

### Part 4 — TELEMETRY Controller Pass-through

`openDashboardPopupSettings` in the TELEMETRY widget now forwards both `prefetchedBundle` (RFC-0179) and `prefetchedAlarms` (RFC-0180):

```js
await MyIO.openDashboardPopupSettings({
  // ... existing params ...
  prefetchedBundle:  window.MyIOOrchestrator?.alarmBundle    ?? null,
  prefetchedAlarms:  window.MyIOOrchestrator?.customerAlarms ?? null,
});
```

---

### Part 5 — `types.ts` additions

Added to both `OpenDashboardPopupSettingsParams` and `ModalConfig`:

```ts
/** Pre-fetched customer alarms from MAIN_VIEW orchestrator (raw GCDR API format).
 *  AlarmsTab filters by gcdrDeviceId and skips the per-device API call when present. */
prefetchedAlarms?: unknown[] | null;
```

Typed as `unknown[]` (not `GCDRAlarm[]`) so that no GCDR types leak into the top-level settings API. The cast happens internally inside `AlarmsTab.init()`.

---

### Part 6 — Showcase integration (`showcase/main-view-shopping/index.html`)

```js
let _cachedCustomerAlarms = null;

async function fetchCustomerAlarms() {
  const url = `${alarmsApiBaseUrl}/api/v1/alarms`
    + `?state=OPEN,ACK,ESCALATED,SNOOZED`
    + `&customerId=${encodeURIComponent(_GCDR_CUSTOMER_ID)}`
    + `&limit=100`;
  const res  = await fetch(url, {
    headers: { 'X-API-Key': alarmsApiKey, 'X-Tenant-ID': _GCDR_TENANT_ID, Accept: 'application/json' },
  });
  const json = await res.json();
  _cachedCustomerAlarms = Array.isArray(json.data) ? json.data : (json.items ?? json.data?.items ?? []);
}
```

`fetchCustomerAlarms()` is called at the end of `loadRealData()`. Both `handleCardSettings` and `openSettingsRFC180` pass `prefetchedAlarms: _cachedCustomerAlarms` to `openDashboardPopupSettings`.

---

### Part 7 — Data Flow Diagram

```
MAIN_VIEW onInit()
  |
  |-- publishCredentials() → MyIOOrchestrator.gcdrCustomerId = ...
  |                          MyIOOrchestrator.gcdrTenantId   = ...
  |
  `-- _prefetchCustomerAlarms(gcdrCustomerId, gcdrTenantId, alarmsBaseUrl) [fire-and-forget]
       |
       `-- GET {alarmsBaseUrl}/api/v1/alarms?customerId=...&state=OPEN,...&limit=100
            |
            `-- MyIOOrchestrator.customerAlarms = GCDRAlarm[]

──────────────────────────────────────────────────────────────────────────────────────

User clicks settings gear on device card (TELEMETRY widget)
  |
  `-- openDashboardPopupSettings({
        gcdrDeviceId,
        gcdrCustomerId,
        gcdrTenantId,
        prefetchedBundle:  MyIOOrchestrator.alarmBundle    (RFC-0179)
        prefetchedAlarms:  MyIOOrchestrator.customerAlarms (RFC-0180)
      })
        |
        `-- SettingsModalView.render()
             |-- initAnnotationsTab()   [RFC-0104]
             `-- initAlarmsTab()        [RFC-0180]
                  |
                  `-- AlarmsTab.init()
                       |
                       |-- Section 1: prefetchedAlarms.filter(a => a.deviceId === gcdrDeviceId)
                       |   └── (or) GET /api/v1/alarms?deviceId={gcdrDeviceId}&state=...
                       |          ↓
                       |        groupAlarms() → GCDRAlarmGroup[]
                       |        mapGroupToAlarm() → Alarm
                       |        createAlarmCardElement(alarm, params)
                       |
                       `-- Section 2: GET /api/v1/customers/{gcdrCustomerId}/rules
                            └── Save: PUT /api/v1/rules/{id} { scope.entityIds: [...] }
```

---

## Drawbacks

- **GCDR dependency:** The Alarms tab requires `gcdrDeviceId` and `gcdrCustomerId`. Devices not yet synced to GCDR show an unavailability notice.
- **Pre-fetch memory footprint:** The full customer alarm list is held in `MyIOOrchestrator.customerAlarms` for the session lifetime. For customers with many active alarms this could be a few hundred KB.
- **No pagination:** The pre-fetch and per-device calls both use `limit=100`. Customers with more than 100 open alarms will not see all occurrences.
- **Array replacement for rule association:** `PUT /rules/{id}` replaces the full `entityIds` array, creating a potential race condition if two users modify the same rule simultaneously. This is a GCDR API constraint.

---

## Rationale and Alternatives

### Why show alarm occurrences, not rule definitions, in Section 1?

Showing rule definitions from the GCDR bundle (original plan) tells the user *what rules exist*, but not whether those rules are currently firing. Real alarm occurrences (`GET /api/v1/alarms`) are immediately actionable — the user can acknowledge or escalate directly from the modal.

### Why group by `ruleId` instead of showing individual alarms?

A high-frequency threshold rule can produce dozens of identical alarm records. Showing 44 individual "Consumo alto noturno" cards adds no information and overwhelms the UI. One card per rule type with a state-count chip ("Aberto × 44") is both compact and informative.

### Why reuse `createAlarmCardElement` instead of a custom card?

The shared `AlarmCard` component already handles severity/state color coding, action buttons, snooze/escalate `CustomEvent` emission, and responsive layout. Reusing it keeps visual consistency with the Alarms Notifications Panel and eliminates duplicated styling effort.

### Why pre-fetch at customer level instead of per-device?

A device-level call on every modal open adds ~200 ms of latency and multiplies requests when the user browses several devices. A single customer-level call at startup is cached for the session and filtered locally in O(n) time.

### Why not embed a refresh button?

Session data is unlikely to change significantly during a single dashboard visit. A refresh-on-action pattern (the grid auto-refreshes after each acknowledge/snooze/escalate) keeps the stale-data window small without adding UI chrome.

---

## Prior Art

- **RFC-0104** (`AnnotationsTab`) — established the `initXxxTab()` pattern in `SettingsModalView.render()`.
- **RFC-0179** (`openAlarmBundleMapModal`) — defined `AlarmBundleMapParams` and the GCDR bundle pre-fetch; introduced `prefetchedBundle` in `types.ts`.
- **RFC-0126** (MenuShoppingFilterSync) — established the module-level cache and fire-and-forget pre-fetch pattern used in MAIN_VIEW.

---

## Unresolved Questions / Deferred Items

1. **Pagination:** The `limit=100` cap means more than 100 open alarms are silently truncated. A follow-up RFC should add server-side pagination or scroll-based loading.
2. **Bundle staleness:** `MyIOOrchestrator.customerAlarms` is fetched once and never invalidated. A TTL-based refresh (e.g. 10 minutes) or manual "Refresh" button could be added in a follow-up.
3. **General Tab layout restructure:** The original draft planned to hide the energy alarm inputs (`maxDailyKwh`, etc.) and expand the device identity card with a profile icon + `deviceName` subtitle. This was deferred and should be tracked as a separate RFC.
4. **Alarm creation from the tab:** Currently only association/dissociation of existing customer rules is supported. Inline `POST /rules` creation is deferred.

---

## Future Possibilities

- **Rule parameter editing:** Allow editing `alarmConfig` (metric, operator, value, schedule) inline in Section 2 for rules associated with the device.
- **`myio:customer-alarms-ready` event:** MAIN_VIEW could dispatch an event when `customerAlarms` is populated, allowing the Alarms tab to react if the pre-fetch completed after the modal opened (currently falls back to per-device call).
- **Cross-device alarm summary:** A future header/menu badge showing total open alarm count across all devices, powered by the same pre-fetched `customerAlarms` array.
