# RFC-0180: Alarms Tab in Settings Modal + Pre-fetched Bundle Architecture

- **RFC Number:** 0180
- **Status:** Draft
- **Start Date:** 2026-02-24
- **Related RFCs:** RFC-0104 (Annotations Tab), RFC-0179 (openAlarmBundleMapModal)
- **Files Affected:**
  - `src/components/premium-modals/settings/SettingsModalView.ts`
  - `src/components/premium-modals/settings/SettingsController.ts`
  - `src/components/premium-modals/settings/types.ts`
  - `src/components/premium-modals/alarm-bundle-map/openAlarmBundleMapModal.ts`
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`

---

## Summary

This RFC introduces three coordinated changes to the device settings experience:

1. **General tab layout restructure** — hide the "Energy Alarms" form column, expand the device identity card (label, floor, identifier) with a richer layout including a device-profile icon and `deviceName` subtitle, and add a placeholder card where the alarms column was.
2. **New "Alarms" tab in SettingsModal** — a third tab (alongside General and Annotations) that shows the alarm rules currently associated with the open device and allows the user to parametrize them (select/deselect available customer rules via a multi-select table, then save).
3. **Pre-fetched bundle architecture** — MAIN_VIEW pre-fetches the GCDR customer bundle once during initialization and stores it in `window.MyIOOrchestrator`; `AlarmBundleMapParams` gains optional `prefetchedBundle` / `forceRefetch` params so both the full alarm-bundle modal (RFC-0179) and the new Alarms tab can reuse the same data without redundant network calls.

---

## Motivation

### General Tab layout

The current 2-column General tab layout places device identity fields (Label, Floor, Identifier) on the left and alarm threshold inputs on the right. This layout has two problems:

- The alarm inputs (`maxDailyKwh`, `maxNightKwh`, `maxBusinessKwh`) are ThingsBoard SERVER_SCOPE attributes that are decoupled from the richer GCDR rule system introduced in RFC-0179. Maintaining two parallel alarm systems creates confusion.
- The device identity card shows only the TB `deviceLabel` as a section title, with no visual indicator of the device type or `deviceName`.

### Alarms Tab

There is currently no way to associate or remove GCDR alarm rules for a specific device from within the settings modal. The only entry point is the full Alarm Bundle Map modal (RFC-0179), which shows all devices across the shopping and is not focused on a single device.

Users opening the settings modal for a device should be able to see which alarm rules are active for that device and quickly add or remove rules without navigating to a separate modal.

### Pre-fetched Bundle

Every call to `openAlarmBundleMapModal()` (RFC-0179) triggers a full HTTP request to GCDR:

```
GET /api/v1/customers/external/{customerTB_ID}?deep=1&allRules=1&filterOnlyDevicesWithRules=1
```

This data is the same for all devices in the same shopping session. MAIN_VIEW already has access to all the required credentials (`customerTB_ID`, `gcdrTenantId`, `gcdrApiBaseUrl`) at startup and dispatches them through `window.MyIOOrchestrator`. Pre-fetching once and sharing the result eliminates duplicate network calls.

---

## Guide-Level Explanation

### General Tab — new layout

When a user opens the device settings modal, the **General** tab now shows a single expanded identity card:

```
┌────────────────────────────────────────────────────────────────────────┐
│  [icon]  3F SCMOXUARAAC_EL7_L2        (deviceName, muted)               │
│  ────────────────────────────────────────────────────────────────────  │
│  Etiqueta (label)   [___________________________]                      │
│  Andar              [___________________________]                      │
│  Identificador / LUC / SUC  [________________]                         │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  Alarm rules                                                           │
│  Configure alarm rules in the Alarms tab →                             │
└────────────────────────────────────────────────────────────────────────┘
```

- The left card expands horizontally (or takes full row width).
- The device-profile icon (⚡ for energy, 💧 for water, 🌡 for temperature) is shown at the top of the card alongside the TB `deviceLabel` (as the main title).
- The raw `deviceName` (e.g. `3F SCMOXUARAAC_EL7_L2`) is shown in a subtler font next to the icon, for traceability.
- The right column is replaced by a muted placeholder card pointing users to the new Alarms tab.
- The existing alarm inputs (`maxDailyKwh`, `maxNightKwh`, `maxBusinessKwh`) are hidden from the UI but remain in the form model, preserving backward compatibility with saved attributes.

### Alarms Tab

The **Alarms** tab is the third tab in the settings modal (after General and Annotations). It has two sections:

#### Section 1 — Active Alarm Rules

A read-only table listing the GCDR alarm rules currently associated with this device:

| Rule name | Metric | Operator | Value | Priority | Enabled |
|-----------|--------|----------|-------|----------|---------|
| Consumo alto noturno | energy_consumption | GT | 50 kWh | HIGH | ✓ |
| Potência máxima | instantaneous_power | GT | 5000 W | CRITICAL | ✓ |

Rules are resolved from `bundle.devices[].ruleIds → bundle.rules[id]`, where the device is matched by its GCDR `gcdrDeviceId` (stored as a TB SERVER_SCOPE attribute).

If the device has no associated rules, a friendly empty-state card is shown.

#### Section 2 — Parametrize Alarm Rules

A multi-select table listing all customer-level alarm rules available from GCDR (`GET /customers/{gcdrCustomerId}/rules`). Rows already associated with the device are pre-checked.

```
┌────┬──────────────────────────────┬───────────────┬──────────┐
│[✓] │ Consumo alto noturno          │ ALARM_THRESH  │ HIGH     │
│[✓] │ Potência máxima               │ ALARM_THRESH  │ CRITICAL │
│[ ] │ Temperatura ambiente alta     │ ALARM_THRESH  │ MEDIUM   │
│[ ] │ Sem leitura (UNCHANGED)       │ ALARM_THRESH  │ LOW      │
└────┴──────────────────────────────┴───────────────┴──────────┘
                                         [ Save Alarms ]
```

Clicking **Save Alarms** issues one `PUT /rules/{ruleId}` per changed rule, updating its `scope.entityIds` array (add or remove the device's `gcdrDeviceId`). Because GCDR has no granular add/remove endpoint, the full current `entityIds` array must be read first and then updated.

### Pre-fetched Bundle

The user sees no change — loading is faster because MAIN_VIEW already fetched the bundle before the user opens any settings modal. If the data is stale or missing, both the full Alarm Bundle Map modal and the Alarms tab fall back to fetching on demand.

---

## Reference-Level Explanation

### Part 1 — General Tab Layout Changes (`SettingsModalView.ts`)

#### 1.1 Hide the alarms form column

`getAlarmsHTML()` continues to exist for backward compatibility but is no longer rendered in the General tab HTML. The right `form-column` is replaced by a placeholder card:

```ts
private getAlarmPlaceholderCard(): string {
  return `
    <div class="form-card form-card--muted">
      <h4 class="section-title">Alarm Rules</h4>
      <p class="form-card__hint">
        Configure alarm rules for this device in the
        <button type="button" class="link-btn" data-tab-link="alarms">Alarms tab</button>.
      </p>
    </div>
  `;
}
```

#### 1.2 Expanded identity card

The left `form-card` grows to show icon + deviceName + existing fields:

```html
<div class="form-card">
  <div class="device-identity-header">
    <span class="device-icon">${deviceProfileIcon}</span>
    <div class="device-identity-header__text">
      <h4 class="section-title device-label-title">
        ${this.config.deviceLabel || 'NOT INFORMED'}
      </h4>
      <span class="device-name-subtitle">
        ${this.config.deviceName || ''}
      </span>
    </div>
  </div>
  <!-- Existing fields: label, floor, identifier -->
</div>
```

`deviceName` is a new optional field in `SettingsModalViewConfig` populated from `params.label` (the raw TB device name passed by the TELEMETRY controller).

#### 1.3 Tab link wiring

The placeholder card's "Alarms tab" button triggers `switchTab('alarms')`.

#### 1.4 `switchTab` type extension

```ts
private switchTab(tab: 'general' | 'annotations' | 'alarms'): void { ... }
```

---

### Part 2 — New Alarms Tab (`SettingsModalView.ts`, `SettingsController.ts`, `types.ts`)

#### 2.1 New tab button in `getModalHTML()`

```html
<button type="button" class="modal-tab" data-tab="alarms">
  <!-- Bell icon SVG -->
  Alarms
</button>
```

#### 2.2 New tab content container

```html
<div id="alarms-tab-content" class="tab-content" style="display: none;">
  <!-- Populated by initAlarmsTab() -->
</div>
```

#### 2.3 `initAlarmsTab()` in `SettingsModalView`

Called from `render()`, analogous to `initAnnotationsTab()` (RFC-0104).

```ts
private async initAlarmsTab(): Promise<void> {
  const container = this.modal.querySelector('#alarms-tab-content') as HTMLElement;
  if (!container) return;

  const { gcdrDeviceId, gcdrCustomerId, gcdrTenantId, gcdrApiBaseUrl, prefetchedBundle } = this.config;

  if (!gcdrDeviceId || !gcdrCustomerId || !gcdrTenantId) {
    container.innerHTML = '<p class="tab-unavailable">Alarm data not available (missing GCDR identifiers).</p>';
    return;
  }

  this.alarmsTab = new AlarmsTab({
    container,
    gcdrDeviceId,
    gcdrCustomerId,
    gcdrTenantId,
    gcdrApiBaseUrl,
    tbDeviceId: this.config.deviceId,
    jwtToken: this.config.jwtToken,
    prefetchedBundle,
  });

  await this.alarmsTab.init();
}
```

#### 2.4 `AlarmsTab` component (new file)

**Location:** `src/components/premium-modals/settings/alarms/AlarmsTab.ts`

```ts
interface AlarmsTabConfig {
  container: HTMLElement;
  gcdrDeviceId: string;
  gcdrCustomerId: string;
  gcdrTenantId: string;
  gcdrApiBaseUrl?: string;
  tbDeviceId: string;
  jwtToken: string;
  prefetchedBundle?: GCDRCustomerBundle | null;
}
```

The component:

1. Resolves bundle: uses `prefetchedBundle` if available, otherwise calls `fetchBundle(customerTB_ID, gcdrTenantId, baseUrl)` from `openAlarmBundleMapModal.ts` (shared function, exported).
2. Matches device in bundle: finds `bundle.devices.find(d => d.externalId === tbDeviceId || d.metadata?.tbId === tbDeviceId)`.
3. Renders Section 1 (active rules): maps `device.ruleIds` to `bundle.rules[id]`, displays in a read-only table.
4. Fetches customer rules for Section 2: `GET /customers/{gcdrCustomerId}/rules`.
5. Renders Section 2 (multi-select): pre-checks rows where `rule.scope.entityIds.includes(gcdrDeviceId)`.
6. Save handler:
   - Collects checked rule IDs vs unchecked rule IDs (compared to initial state).
   - For each changed rule, calls `PUT /rules/{ruleId}` with the updated `scope.entityIds` array.
   - Reads current `entityIds` from the fetched customer rule list (already in memory), then adds or removes `gcdrDeviceId`.

#### 2.5 New params in `OpenDashboardPopupSettingsParams` (`types.ts`)

```ts
/** GCDR identifiers — required to power the Alarms tab */
gcdrDeviceId?: string;
gcdrCustomerId?: string;
gcdrTenantId?: string;
gcdrApiBaseUrl?: string;
/** Pre-fetched GCDR bundle from MAIN_VIEW orchestrator */
prefetchedBundle?: GCDRCustomerBundle | null;
```

#### 2.6 GCDR credentials in `SettingsModalViewConfig`

Same fields mirrored from params into view config.

---

### Part 3 — Pre-fetched Bundle Architecture

#### 3.1 MAIN_VIEW pre-fetch (`MAIN_VIEW/controller.js`)

During `onInit()`, after credentials are established:

```js
async function prefetchAlarmBundle() {
  const orchestrator = window.MyIOOrchestrator;
  const { customerTB_ID, gcdrTenantId, gcdrApiBaseUrl } = orchestrator;

  if (!customerTB_ID || !gcdrTenantId) {
    LogHelper.warn('[MAIN_VIEW] Cannot pre-fetch alarm bundle — missing credentials');
    return;
  }

  try {
    const bundle = await MyIOLibrary.fetchGCDRBundle(customerTB_ID, gcdrTenantId, gcdrApiBaseUrl);
    orchestrator.alarmBundle = bundle;
    orchestrator.alarmBundleFetchedAt = Date.now();
    LogHelper.log('[MAIN_VIEW] RFC-0180: Alarm bundle pre-fetched', {
      devices: bundle.devices.length,
      rules: Object.keys(bundle.rules).length,
    });
    window.dispatchEvent(new CustomEvent('myio:alarm-bundle-ready', { detail: { bundle } }));
  } catch (err) {
    LogHelper.warn('[MAIN_VIEW] RFC-0180: Alarm bundle pre-fetch failed', err);
    orchestrator.alarmBundle = null;
  }
}
```

**Timing:** called after `window.MyIOOrchestrator.credentialsSet = true`, in a non-blocking fire-and-forget fashion (no `await` at the call site).

#### 3.2 Orchestrator fields (new)

```js
window.MyIOOrchestrator = {
  // ... existing fields ...

  // RFC-0180: Pre-fetched GCDR alarm bundle
  alarmBundle: null,          // GCDRCustomerBundle | null
  alarmBundleFetchedAt: null, // number (Date.now()) | null
};
```

#### 3.3 `AlarmBundleMapParams` extension (`openAlarmBundleMapModal.ts`)

```ts
export interface AlarmBundleMapParams {
  customerTB_ID: string;
  gcdrTenantId: string;
  gcdrApiBaseUrl?: string;
  themeMode?: 'dark' | 'light';
  onClose?: () => void;

  /** Pre-fetched GCDRCustomerBundle; if provided and forceRefetch is false, skips the API call. */
  prefetchedBundle?: GCDRCustomerBundle | null;
  /** If true, always fetches fresh data even when prefetchedBundle is provided. */
  forceRefetch?: boolean;
}
```

Inside `openAlarmBundleMapModal`:

```ts
const bundle =
  params.prefetchedBundle && !params.forceRefetch
    ? params.prefetchedBundle
    : await fetchBundle(params.customerTB_ID, params.gcdrTenantId, baseUrl);
```

#### 3.4 `fetchBundle` exported as library function

`fetchBundle` is currently a module-private function. It must be exported from `openAlarmBundleMapModal.ts` and re-exported from `src/index.ts` as `fetchGCDRBundle` so MAIN_VIEW can call it via `MyIOLibrary.fetchGCDRBundle(...)`.

```ts
// openAlarmBundleMapModal.ts
export { fetchBundle as fetchGCDRBundle };

// index.ts
export { fetchGCDRBundle } from './components/premium-modals/alarm-bundle-map/openAlarmBundleMapModal';
```

#### 3.5 ALARM widget call site update

When the ALARM widget calls `openAlarmBundleMapModal`, it passes the orchestrator's cached bundle:

```js
MyIOLibrary.openAlarmBundleMapModal({
  customerTB_ID,
  gcdrTenantId,
  gcdrApiBaseUrl,
  themeMode: _currentTheme,
  prefetchedBundle: window.MyIOOrchestrator?.alarmBundle ?? null,
  forceRefetch: false,
});
```

#### 3.6 `openDashboardPopupSettings` call site update (TELEMETRY controller)

```js
await MyIO.openDashboardPopupSettings({
  // ... existing params ...
  gcdrDeviceId: it.gcdrDeviceId || null,
  gcdrCustomerId: window.MyIOOrchestrator?.gcdrCustomerId || null,
  gcdrTenantId:   window.MyIOOrchestrator?.gcdrTenantId  || null,
  gcdrApiBaseUrl: window.MyIOOrchestrator?.gcdrApiBaseUrl || null,
  prefetchedBundle: window.MyIOOrchestrator?.alarmBundle ?? null,
});
```

`it.gcdrDeviceId` must be mapped in MAIN_VIEW when building the entity from datasource rows (already a dataKey in `All3Fs`, `AllTempDevices`, `AllHidrosDevices`).

---

### Part 4 — Data Flow Diagram

```
MAIN_VIEW onInit()
  |
  |-- setCredentials() --> MyIOOrchestrator.credentialsSet = true
  |                       MyIOOrchestrator.customerTB_ID = ...
  |                       MyIOOrchestrator.gcdrTenantId = ...
  |
  `-- prefetchAlarmBundle() [fire-and-forget]
       |
       `-- fetchGCDRBundle(customerTB_ID, gcdrTenantId, baseUrl)
            |
            |   GET /api/v1/customers/external/{customerTB_ID}?deep=1&allRules=1&...
            `-- MyIOOrchestrator.alarmBundle = GCDRCustomerBundle
               dispatchEvent('myio:alarm-bundle-ready')

---------------------------------------------------------------------------

User clicks settings gear on a device card (TELEMETRY widget)
  |
  `-- openDashboardPopupSettings({
       gcdrDeviceId, gcdrCustomerId, gcdrTenantId,
       prefetchedBundle: MyIOOrchestrator.alarmBundle
     })
       |
       `-- SettingsModalView.render()
            |-- initAnnotationsTab()  [RFC-0104]
            `-- initAlarmsTab()       [RFC-0180]
                 |
                 `-- AlarmsTab.init()
                      |-- bundle = prefetchedBundle ?? fetchGCDRBundle(...)
                      |-- Section 1: device rules from bundle
                      `-- Section 2: GET /customers/{gcdrCustomerId}/rules
                           `-- Save: PUT /rules/{id} { scope.entityIds: [...] }
```

---

### Part 5 — GCDR Rules API calls

#### List available customer rules (Section 2 data source)

```
GET {gcdrApiBaseUrl}/customers/{gcdrCustomerId}/rules
Headers:
  X-API-Key: gcdr_cust_tb_integration_key_2026
  X-Tenant-ID: {gcdrTenantId}
```

Response: `{ items: Rule[], count: number }`

Each `Rule`:
```json
{
  "id": "uuid",
  "name": "string",
  "type": "ALARM_THRESHOLD",
  "priority": "HIGH | MEDIUM | LOW | CRITICAL",
  "enabled": true,
  "scope": {
    "type": "DEVICE",
    "entityIds": ["gcdr-device-uuid-1", "gcdr-device-uuid-2"]
  },
  "alarmConfig": {
    "metric": "instantaneous_power | energy_consumption | temperature | ...",
    "operator": "GT | LT | BETWEEN | ...",
    "value": 5000,
    "valueHigh": null
  }
}
```

#### Associate/dissociate device from a rule (Save handler)

```
PUT {gcdrApiBaseUrl}/rules/{ruleId}
Headers:
  X-API-Key: gcdr_cust_tb_integration_key_2026
  X-Tenant-ID: {gcdrTenantId}
  Content-Type: application/json
Body:
{
  "scope": {
    "type": "DEVICE",
    "entityIds": ["gcdr-device-uuid-1", "gcdr-device-uuid-3"]
  }
}
```

Important: there are no granular add/remove endpoints. The `entityIds` array must be replaced entirely. The save handler must read the current `entityIds` from the in-memory rule object and add or remove the current `gcdrDeviceId` before sending.

---

### Part 6 — Matching devices in bundle

The GCDR bundle device can be matched to the current TB device using:

```ts
const bundleDevice = bundle.devices.find(d =>
  d.externalId === tbDeviceId ||
  d.metadata?.tbId === tbDeviceId
);
```

If no match is found (device not yet synced to GCDR), Section 1 shows an empty-state and Section 2 is still available (rules can be associated by `gcdrDeviceId` directly).

---

## Drawbacks

- **GCDR sync dependency:** The Alarms tab is only functional if the device has been synced to GCDR (i.e., `gcdrDeviceId` is set on the TB device SERVER_SCOPE attributes). Devices not yet synced will show an unavailability notice.
- **Pre-fetch adds startup latency to MAIN_VIEW:** Although the call is fire-and-forget, it still consumes bandwidth on every dashboard load, even if the user never opens the alarm bundle or any settings modal.
- **Array replacement for rule association:** The `PUT /rules/{id}` pattern requires reading the current `entityIds` before writing. A race condition exists if two users modify the same rule simultaneously. This is a GCDR API constraint, not addressable in this RFC.

---

## Rationale and Alternatives

### Why hide, not remove, the energy alarm inputs?

The `maxDailyKwh`, `maxNightKwh`, `maxBusinessKwh` inputs are stored as ThingsBoard SERVER_SCOPE attributes and may still be consumed by existing rule chains or reports. Removing them from the UI while keeping the model intact preserves backward compatibility without a migration.

### Why pre-fetch in MAIN_VIEW and not on-demand per device?

Fetching on first open of any settings modal would introduce a visible loading delay and cause duplicate fetches if the user opens several modals in quick succession. MAIN_VIEW has the orchestrator credentials already available immediately after startup and is the natural orchestration point for shared data.

### Why not embed the full Alarm Bundle Map modal UI in the tab?

The full bundle modal (RFC-0179) shows all devices across the shopping, grouped by asset. That view is appropriate for an operational overview. The Alarms tab in settings is intentionally scoped to a single device, keeping the UX focused on the device being configured.

### Alternative considered: separate Alarm Settings component

An `AlarmSettingsModal` could be opened from a button on the General tab instead of a new tab. This was rejected because opening a second modal on top of settings creates a confusing z-index/focus stack and breaks the tab metaphor established by RFC-0104.

---

## Prior Art

- **RFC-0104** (`AnnotationsTab`) — established the pattern for initializing a secondary tab component from `SettingsModalView.render()`.
- **RFC-0179** (`openAlarmBundleMapModal`) — defined `AlarmBundleMapParams`, `fetchBundle`, and `GCDRCustomerBundle`. This RFC extends all three.
- **RFC-0126** (MenuShoppingFilterSync) — established the module-level caching and fire-and-forget pre-fetch pattern used in MAIN_VIEW.

---

## Unresolved Questions

1. **`gcdrCustomerId` propagation path:** The draft specifies that `gcdrCustomerId` is a customer-level SERVER_SCOPE attribute fetched via the `customer` alias datasource. Does MAIN_VIEW already read and store this in the orchestrator, or does it need to be added? This needs to be confirmed in `MAIN_VIEW/controller.js` during implementation.
2. **`gcdrDeviceId` field name on entity object:** The TELEMETRY controller builds entity objects from metadata. Confirm the exact field name used (possibly `ingestionId` or a dedicated `gcdrDeviceId` field) to avoid mapping errors.
3. **Bundle staleness policy:** Should there be a TTL for `alarmBundleFetchedAt`? If the user spends a long time on the dashboard, the bundle may be stale. A simple TTL check (e.g. 10 minutes) or a manual refresh button in the Alarms tab could be added, but is deferred to a follow-up RFC.
4. **Alarms tab visibility by domain:** Should the Alarms tab be conditionally rendered only for certain domains (e.g. energy only), or for all device types? The current energy alarm inputs are domain-conditional. GCDR rules are metric-based and apply to all domains — recommend showing the tab for all domains, with Section 2 filtered by metrics relevant to the device type.
5. **API Key security:** `gcdr_cust_tb_integration_key_2026` is the same key used by RFC-0179. Confirm this key has the appropriate scope for `GET /customers/:id/rules` and `PUT /rules/:id` (write permission needed for save).

---

## Future Possibilities

- **Rule creation from within the tab:** Currently only association/dissociation of existing customer rules is supported. A future RFC could add an inline "Create Rule" flow using `POST /rules`.
- **Rule parameter editing:** Allow editing `alarmConfig` (metric, operator, value, schedule) inline in the Alarms tab for rules associated with this device.
- **Bundle refresh button:** A manual "Refresh alarm data" action in the tab header that calls `fetchGCDRBundle` with `forceRefetch: true` and updates `MyIOOrchestrator.alarmBundle`.
- **`myio:alarm-bundle-ready` event consumer:** ALARM widget could listen for this event to skip its own fetch when the bundle is already available in the orchestrator.
