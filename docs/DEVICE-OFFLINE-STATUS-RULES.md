# Device Offline Status — Rules & Architecture

> **Scope:** `v-5.2.0` dashboard (MAIN_VIEW + TELEMETRY + template-card-v5)
> **Last updated:** 2026-03-09

---

## 1. Status Types

### 1.1 `DeviceStatusType` — calculated output

Defined in `src/utils/deviceStatus.js`:

| Value | Constant | Visual meaning |
|-------|----------|----------------|
| `power_on` | `POWER_ON` | Device active, sending data |
| `standby` | `STANDBY` | Device idle / low activity |
| `power_off` | `POWER_OFF` | Device powered off |
| `warning` | `WARNING` | Threshold warning |
| `failure` | `FAILURE` | Critical failure |
| `maintenance` | `MAINTENANCE` | Under maintenance |
| `no_info` | `NO_INFO` | Never sent telemetry (no timestamp) |
| `not_installed` | `NOT_INSTALLED` | Waiting to be commissioned |
| `offline` | `OFFLINE` | Was active, stopped sending data (stale) |
| `weak_connection` | `WEAK_CONNECTION` | Unstable connection (RFC-0109) |

> **`no_info` vs `offline`**: Both render as "offline" visually. `no_info` means the device *never* sent telemetry. `offline` means it *was* active and stopped.

### 1.2 `ConnectionStatusType` — raw input from ThingsBoard

| Normalized value | Raw values accepted |
|-----------------|---------------------|
| `'online'` | `online`, `ok`, `running`, `true`, `connected`, `active`, `1` |
| `'waiting'` | `waiting`, `connecting`, `pending` |
| `'bad'` | `bad`, `weak`, `unstable`, `poor`, `degraded` |
| `'offline'` | Everything else (including `null`, `undefined`, `''`) |

Normalization: `normalizeConnectionStatus()` in `src/utils/deviceStatus.js:142`.

---

## 2. Source of Truth: Telemetry Timestamps

ThingsBoard's `connectionStatusTs` (timestamp of last status change) is **unreliable** — it updates approximately every minute even when the device is truly offline. Domain-specific telemetry timestamps are used instead:

| Domain | Timestamp field | ThingsBoard dataKey |
|--------|----------------|---------------------|
| Energy | `meta.consumptionTs` | `consumption` |
| Water | `meta.pulsesTs` | `pulses` |
| Water (alt) | `meta.waterLevelTs` | `water_level` |
| Water (alt) | `meta.waterPercentageTs` | `water_percentage` |
| Temperature | `meta.temperatureTs` | `temperature` |

**Timestamp `0` (epoch 1970) is invalid** — ThingsBoard returns `0` when no data was ever received. Treated as `null`.

Extraction: `buildMetadataMapFromCtxData()` — `MAIN_VIEW/controller.js:4329`.

---

## 3. Offline Decision Logic — `calculateDeviceStatus()`

**File:** `src/utils/deviceStatus.js:411`
**Called by:** `convertConnectionStatusToDeviceStatus()` — `MAIN_VIEW/controller.js:3985`

### Decision cascade (in order):

```
connectionStatus = 'waiting'
  → NOT_INSTALLED  ← absolute priority, no further checks

connectionStatus = 'bad'
  → has telemetryTimestamp AND age < SHORT_DELAY (60 min)?
      yes → continue to value-based calculation
      no  → WEAK_CONNECTION

connectionStatus = 'offline'
  → has telemetryTimestamp AND age < SHORT_DELAY (60 min)?
      yes → continue to value-based calculation (device is still alive)
      no  → OFFLINE

connectionStatus = 'online'
  → has telemetryTimestamp?
      no  → OFFLINE  (device never sent domain telemetry → treated as no_info)
      yes → age > LONG_DELAY (profile-based threshold)?
          yes → OFFLINE  (stale: was online, stopped sending)
          no  → continue to value-based calculation → power_on / standby / warning / etc.
```

### Two thresholds

| Threshold | Constant | Value | Applied to |
|-----------|----------|-------|------------|
| **Short** | `SHORT_DELAY_IN_MINS_TO_BYPASS_OFFLINE_STATUS` | **60 min** | `offline` and `bad` connection status |
| **Long** | `delayTimeConnectionInMins` (profile-based) | see table below | `online` status stale detection |

### Long threshold by device profile

Configured in `widgetSettings.delayTimeSettings` (MAIN_VIEW settings or defaults):

| Profile | Default threshold | Rationale |
|---------|-------------------|-----------|
| `3F_MEDIDOR` (stores) | **60 days** (86 400 min) | Store meters may be idle for long periods |
| Equipment (non-store) | **24h** (1 440 min) | General equipment |
| `HIDROMETRO*` (water) | **48h** (2 880 min) | Water meters poll less frequently |
| `TERMOSTATO*` (temperature) | **24h** (1 440 min) | Thermostats |

Lookup function: `window.MyIOUtils.getDelayTimeConnectionInMins(deviceProfile)` — `MAIN_VIEW/controller.js:238`.

---

## 4. Data Flow

```
ThingsBoard ctx.data
  │
  ▼
buildMetadataMapFromCtxData()          MAIN_VIEW/controller.js:4329
  │  Extracts: connectionStatus, consumptionTs, pulsesTs, temperatureTs, ...
  │
  ▼
createOrchestratorItem()               MAIN_VIEW/controller.js:4146
  │  Calls: convertConnectionStatusToDeviceStatus()
  │           → calculateDeviceStatus()
  │  Produces: item.deviceStatus = 'offline' | 'power_on' | ...
  │
  ▼  (event: myio:data-ready)
  │
TELEMETRY onDataUpdated()
  │
  ▼
STATE.itemsBase[].deviceStatus         TELEMETRY/controller.js:4329 (normal path)
                                       TELEMETRY/controller.js:4252 (fallback path, 2s)
  │
  ▼  (window._telemetryAuthoritativeItems = STATE.itemsBase)
  │
renderCardComponentV5()                card/template-card-v5.js
  │  isDeviceOffline(deviceStatus)     → true if 'offline' | 'no_info'
  │  mapDeviceStatusToCardStatus()     → 'offline'
  │  → adds CSS class .offline to card
```

### Two render paths in TELEMETRY

Both propagate `deviceStatus` identically:

| Path | Trigger | Location |
|------|---------|----------|
| **Normal** | `onDataUpdated` with orchestrator data | `controller.js:4329` |
| **Fallback** | 2-second timeout after `onInit` (no data yet) | `controller.js:4252` |

---

## 5. Visual Rendering — Offline Card

**File:** `card/template-card-v5.js`

### Status determination (line ~349)

```javascript
const isOffline = isDeviceOffline(deviceStatus);
// true when deviceStatus === 'offline' || deviceStatus === 'no_info'

const cardStatus = mapDeviceStatusToCardStatus(deviceStatus);
// 'offline' → CSS class .offline
// 'no_info' → CSS class .unknown  (different class, same visual treatment below)
```

### CSS applied when `cardStatus === 'offline'`

```css
/* Card border + animation */
.device-card-centered.offline {
  border: 2px solid #ef4444 !important;
  background: linear-gradient(145deg, #fef2f2 0%, #fee2e2 50%, #fef2f2 100%) !important;
  animation: premium-offline-pulse 2s infinite !important;
}

/* Top color bar */
.device-card-centered.offline::before {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

/* Box-shadow pulse animation */
@keyframes premium-offline-pulse {
  0%, 100% { box-shadow: 0 8px 32px rgba(239,68,68,0.15), 0 2px 8px rgba(239,68,68,0.1); }
  50%       { box-shadow: 0 12px 40px rgba(239,68,68,0.25), 0 4px 12px rgba(239,68,68,0.2); }
}

/* Connection icon (dot) */
.device-card-centered .connection-status-icon[data-conn="offline"] {
  background: #94a3b8;  /* grey */
}
```

### Status icons per domain

| Status | Energy | Water | Temperature |
|--------|--------|-------|-------------|
| `offline` | 🔴 | 🔴 | 🔴 |
| `no_info` | ❓️ | ❓️ | ❓️ |
| `weak_connection` | 📶 | 📶 | 📶 |
| `not_installed` | 📦 | 📦 | 📦 |
| `power_on` | ⚡ | 💧 | 🌡️ |

---

## 6. Key Files & Functions Reference

| File | Function | Line | Role |
|------|----------|------|------|
| `src/utils/deviceStatus.js` | `calculateDeviceStatus()` | 411 | Core offline decision logic |
| `src/utils/deviceStatus.js` | `normalizeConnectionStatus()` | 142 | Raw → normalized connection status |
| `src/utils/deviceStatus.js` | `isTelemetryStale()` | 188 | Timestamp age check |
| `src/utils/deviceStatus.js` | `isDeviceOffline()` | 275 | `true` if `offline` or `no_info` |
| `src/utils/deviceStatus.js` | `mapDeviceStatusToCardStatus()` | 236 | DeviceStatus → CSS card class |
| `MAIN_VIEW/controller.js` | `buildMetadataMapFromCtxData()` | 4329 | Extracts timestamps from ctx.data |
| `MAIN_VIEW/controller.js` | `createOrchestratorItem()` | 4146 | Builds item with calculated deviceStatus |
| `MAIN_VIEW/controller.js` | `convertConnectionStatusToDeviceStatus()` | 3985 | Adapter: calls calculateDeviceStatus |
| `MAIN_VIEW/controller.js` | `SHORT_DELAY_IN_MINS_TO_BYPASS_OFFLINE_STATUS` | 3048 | Constant: 60 min short threshold |
| `MAIN_VIEW/controller.js` | `getDelayTimeConnectionInMins()` | 238 | Profile → long threshold lookup |
| `TELEMETRY/controller.js` | `STATE.itemsBase` mapping (normal) | 4329 | Propagates deviceStatus to cards |
| `TELEMETRY/controller.js` | `STATE.itemsBase` mapping (fallback) | 4252 | 2s fallback path |
| `card/template-card-v5.js` | `renderCardComponentV5()` | ~349 | Determines CSS class, icon, animation |

---

## 7. Known Debug Code (Production)

`card/template-card-v5.js` contains hardcoded debug logging for specific devices. These are investigation artifacts that remain in production code:

- `'3F SCMAL3L4304ABC'` — logs full status breakdown on every render
- `'burguer'` (Burger King) — logs full status breakdown on every render

These should be removed when the corresponding issues are confirmed resolved.

---

## 8. Related RFCs

| RFC | Subject |
|-----|---------|
| RFC-0109 | `WEAK_CONNECTION` status (`bad` connection input) |
| RFC-0110 | Device status master rules — telemetry timestamp as source of truth |
| RFC-0130 | Per-profile delay thresholds (stores 60d, equipment 24h, water 48h) |
| RFC-0155 | Equipment count by status |
