# RFC-0093: Equipments Grid Real-Time Telemetry Mode

- **Status**: ✅ Implemented
- **Created**: 2025-12-03
- **Implemented**: 2025-12-03
- **Author**: MyIO Team
- **Related RFCs**: RFC-0082, RFC-0084

## Summary

Add a real-time telemetry mode toggle button to the EQUIPMENTS grid widget that enables continuous monitoring of instantaneous power for all rendered device cards. When activated, device cards transform to prominently display live power readings with automatic 8-second refresh cycles, replacing the historical consumption view.

## Motivation

### Current State

The EQUIPMENTS grid currently displays historical consumption data (kWh) fetched from the API for a selected date range. Users who need to monitor real-time power values must:

1. Open individual device modals
2. Navigate to the "Telemetrias Instantâneas" button
3. View one device at a time in a separate modal

This workflow is inefficient for operations teams who need to monitor multiple devices simultaneously.

### Desired State

Operations teams should be able to:

1. Toggle a single button to switch the entire grid to real-time mode
2. See instantaneous power (kW) for ALL devices simultaneously
3. Monitor connection status updates in real-time
4. Quickly identify devices with anomalous power readings
5. Return to historical view with a single toggle

### Use Cases

1. **Facility Walk-through**: Technicians verifying equipment status during maintenance rounds
2. **Peak Demand Monitoring**: Operations monitoring power during high-demand periods
3. **Fault Detection**: Quick identification of equipment drawing unexpected power
4. **Commissioning**: Verifying newly installed equipment is operational

## Guide-level Explanation

### User Experience

A new toggle button will appear in the EQUIPMENTS grid toolbar, positioned on the right side of the same row as the shopping filter chips:

```
┌─────────────────────────────────────────────────────────────────────┐
│  [🏬 Shopping A] [🏬 Shopping B]              [⚡ Tempo Real: OFF]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Device 1    │  │ Device 2    │  │ Device 3    │                 │
│  │ 125.4 kWh   │  │ 89.2 kWh    │  │ 203.1 kWh   │                 │
│  │ 15.3%       │  │ 10.8%       │  │ 24.7%       │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

When the user clicks the toggle button, the grid transforms:

```
┌─────────────────────────────────────────────────────────────────────┐
│  [🏬 Shopping A] [🏬 Shopping B]              [⚡ Tempo Real: ON ]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Device 1    │  │ Device 2    │  │ Device 3    │                 │
│  │ ⚡ 3.42 kW  │  │ ⚡ 0.00 kW  │  │ ⚡ 8.15 kW  │                 │
│  │ 🕐 há 2s    │  │ 🕐 há 5s    │  │ 🕐 há 1s    │                 │
│  │ 🟢 Online   │  │ 🔴 Offline  │  │ 🟢 Online   │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                      │
│  🔄 Próxima atualização em 6s                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Card Transformation

In real-time mode, each device card changes its display:

| Normal Mode | Real-Time Mode |
|-------------|----------------|
| Consumption (kWh) | **Instantaneous Power (kW)** |
| Percentage (%) | Last Update timestamp |
| Status indicator | Enhanced status indicator |

### Toggle Behavior

- **OFF → ON**: Starts the real-time polling service, transforms cards, shows countdown
- **ON → OFF**: Stops polling, restores cards to historical consumption view
- **Automatic OFF**: Real-time mode automatically disables after 10 minutes to save resources

## Reference-level Explanation

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     EQUIPMENTS Widget                             │
│                                                                   │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐│
│  │  RealTimeService    │    │  Card Renderer                   ││
│  │  ─────────────────  │    │  ─────────────────────────────── ││
│  │  - polling loop     │───▶│  - renderCardComponentHeadOffice ││
│  │  - 8s interval      │    │  - realtime flag check           ││
│  │  - device queue     │    │  - card transformation           ││
│  └─────────────────────┘    └──────────────────────────────────┘│
│           │                                                       │
│           ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ThingsBoard API                                             ││
│  │  GET /api/plugins/telemetry/DEVICE/{id}/values/timeseries   ││
│  │  ?keys=power&limit=1&agg=NONE                               ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### RealTimeService Interface

```typescript
interface RealTimeServiceConfig {
  /** Polling interval in milliseconds (default: 8000) */
  refreshInterval: number;

  /** Maximum runtime before auto-disable in milliseconds (default: 600000 = 10min) */
  maxRuntime: number;

  /** Telemetry key to fetch (default: 'power') */
  telemetryKey: string;

  /** Callback when new data arrives for a device */
  onDataUpdate: (deviceId: string, value: number, timestamp: number) => void;

  /** Callback when service status changes */
  onStatusChange: (isActive: boolean) => void;

  /** Callback for countdown updates */
  onCountdownTick: (secondsRemaining: number) => void;
}

interface RealTimeService {
  /** Start the real-time polling service */
  start(deviceIds: string[]): void;

  /** Stop the service and cleanup */
  stop(): void;

  /** Check if service is currently active */
  isActive(): boolean;

  /** Get time remaining until next refresh */
  getNextRefreshIn(): number;

  /** Update the list of devices to monitor */
  updateDevices(deviceIds: string[]): void;
}
```

### State Management

New state properties in EQUIPMENTS widget:

```typescript
const STATE = {
  // ... existing properties

  /** Whether real-time mode is active */
  realTimeActive: false,

  /** Map of deviceId -> latest power reading */
  realTimePowerMap: new Map<string, { value: number; timestamp: number }>(),

  /** Reference to RealTimeService instance */
  realTimeService: null as RealTimeService | null,

  /** Timestamp when real-time mode was activated */
  realTimeStartedAt: null as number | null,
};
```

### Card Rendering Logic

Modify `renderCardComponentHeadOffice` function:

```typescript
function renderCardComponentHeadOffice(device: EnrichedDevice): string {
  const isRealTime = STATE.realTimeActive;

  if (isRealTime) {
    const rtData = STATE.realTimePowerMap.get(device.id);
    const power = rtData?.value ?? 0;
    const timestamp = rtData?.timestamp ?? 0;
    const timeSince = formatTimeSince(timestamp);

    return `
      <div class="device-card realtime-mode" data-device-id="${device.id}">
        <div class="card-header">
          <span class="device-name">${device.label}</span>
          <span class="realtime-badge">⚡ LIVE</span>
        </div>
        <div class="card-body">
          <div class="power-value">${formatPower(power)}</div>
          <div class="last-update">🕐 ${timeSince}</div>
          <div class="status-indicator ${getStatusClass(device)}">${getStatusText(device)}</div>
        </div>
      </div>
    `;
  }

  // Normal mode rendering (existing logic)
  return renderNormalCard(device);
}
```

### API Calls

For each device in the visible grid, the service makes:

```
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries?
  keys=power
  &limit=1
  &agg=NONE
  &useStrictDataTypes=true
```

To optimize API load, devices are queried in batches:

```typescript
// Batch devices into groups of 10
const BATCH_SIZE = 10;
const batches = chunkArray(deviceIds, BATCH_SIZE);

for (const batch of batches) {
  await Promise.all(batch.map(id => fetchPowerForDevice(id)));
  await delay(100); // Small delay between batches
}
```

### Toggle Button Implementation

```typescript
function renderRealTimeToggle(): string {
  const isActive = STATE.realTimeActive;

  return `
    <button
      id="realtime-toggle-btn"
      class="realtime-toggle ${isActive ? 'active' : ''}"
      title="${isActive ? 'Desativar tempo real' : 'Ativar tempo real'}"
    >
      <span class="toggle-icon">⚡</span>
      <span class="toggle-label">Tempo Real: ${isActive ? 'ON' : 'OFF'}</span>
    </button>
  `;
}

function bindRealTimeToggle(): void {
  $root().on('click', '#realtime-toggle-btn', () => {
    if (STATE.realTimeActive) {
      stopRealTimeMode();
    } else {
      startRealTimeMode();
    }
  });
}
```

### Countdown Display

When real-time mode is active, show countdown to next refresh:

```typescript
function renderCountdownBadge(seconds: number): void {
  const badge = document.getElementById('realtime-countdown');
  if (badge) {
    badge.textContent = `🔄 Próxima atualização em ${seconds}s`;
    badge.style.display = seconds > 0 ? 'block' : 'none';
  }
}
```

## Drawbacks

1. **Increased API Load**: Polling all visible devices every 8 seconds increases server load
2. **Battery Drain**: Continuous polling may impact mobile device battery
3. **Visual Disruption**: Card transformation may be jarring for users
4. **Stale Data Risk**: If API calls fail, displayed data becomes stale without clear indication
5. **Memory Usage**: Storing real-time data for many devices increases memory footprint

## Rationale and Alternatives

### Why This Design?

1. **Grid-level Toggle**: Single toggle for all cards is simpler than per-card toggles
2. **8-second Interval**: Balances freshness with API load (same as RFC-0082/0084)
3. **Card Transformation**: Clear visual distinction between modes prevents confusion
4. **Auto-disable**: Prevents accidental long-running polling sessions

### Alternatives Considered

#### Alternative A: Per-Card Toggle
Each card has its own real-time toggle.

**Pros**: Granular control, lower API load
**Cons**: Complex UI, inconsistent experience

**Decision**: Rejected - too complex for the use case

#### Alternative B: WebSocket Subscription
Use ThingsBoard WebSocket API for push-based updates.

**Pros**: More efficient, true real-time
**Cons**: Complex implementation, connection management overhead

**Decision**: Deferred to future RFC - polling is simpler for MVP

#### Alternative C: Floating Panel
Show real-time data in a floating panel instead of transforming cards.

**Pros**: Non-destructive, can show both views
**Cons**: Takes screen space, less intuitive

**Decision**: Rejected - card transformation is more intuitive

## Prior Art

- **RFC-0082**: DemandModal Real-Time Mode - Same polling pattern, 8-second interval
- **RFC-0084**: RealTimeTelemetryModal - Modal-based real-time view for single device
- **`RealTimeTelemetryModal.ts`**: Existing implementation to reuse patterns from

## Unresolved Questions

1. **Batch Size**: What's the optimal batch size for API calls? (Proposed: 10)
2. **Error Handling**: How to handle partial failures (some devices fail, others succeed)?
3. **Offline Devices**: Should offline devices be polled at all in real-time mode?
4. **Persistence**: Should real-time mode state persist across page refreshes?
5. **Mobile Optimization**: Should mobile devices have longer polling intervals?

## Future Possibilities

1. **WebSocket Migration**: Replace polling with WebSocket subscriptions for true real-time
2. **Threshold Alerts**: Visual/audio alerts when power exceeds configurable thresholds
3. **Historical Comparison**: Show real-time value alongside historical average
4. **Export**: Allow exporting real-time data stream to CSV
5. **Dashboard Integration**: Expose real-time data to other dashboard widgets

## Implementation Plan

### Phase 1: Core Infrastructure
- [ ] Create `RealTimeService` class in EQUIPMENTS widget
- [ ] Add state management for real-time mode
- [ ] Implement toggle button in toolbar

### Phase 2: Card Transformation
- [ ] Modify `renderCardComponentHeadOffice` for real-time mode
- [ ] Add CSS styles for real-time card variant
- [ ] Implement countdown display

### Phase 3: Polling Logic
- [ ] Implement batched API calls
- [ ] Add error handling and retry logic
- [ ] Implement auto-disable timer

### Phase 4: Polish
- [ ] Add loading states during initial fetch
- [ ] Implement smooth transitions between modes
- [ ] Add user feedback (toast notifications)

### Files to Modify

1. **`src/MYIO-SIM/v5.2.0/EQUIPMENTS/controller.js`**
   - Add RealTimeService implementation
   - Modify STATE object
   - Add toggle button to toolbar
   - Modify `renderCardComponentHeadOffice`

2. **`src/MYIO-SIM/v5.2.0/EQUIPMENTS/styles.css`** (if exists)
   - Add real-time mode card styles
   - Add toggle button styles
   - Add countdown badge styles

## References

- RFC-0082: DemandModal Real-Time Mode
- RFC-0084: Real-Time Telemetry Modal
- `src/components/RealTimeTelemetryModal.ts`: Reference implementation
- ThingsBoard Telemetry API: `/api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries`

---

## Implementation Summary (2025-12-03)

### Files Modified

1. **`src/MYIO-SIM/v5.2.0/EQUIPMENTS/template.html`**
   - Added real-time controls container with toggle button and countdown display
   - Lines 6-14: New `realtime-controls` div with `realtimeToggleBtn` and `realtimeCountdown`

2. **`src/MYIO-SIM/v5.2.0/EQUIPMENTS/style.css`**
   - Added 147 lines of CSS for real-time mode styling
   - Lines 600-747: Toggle button, countdown badge, card transformation styles, animations

3. **`src/MYIO-SIM/v5.2.0/EQUIPMENTS/controller.js`**
   - Added real-time state to STATE object (lines 1156-1162)
   - Added REALTIME_CONFIG constants (lines 1165-1171)
   - Added RealTimeService functions (lines 1484-1774):
     - `fetchDevicePower()`: Single device telemetry fetch
     - `fetchAllDevicesPower()`: Batched fetch for all visible devices
     - `updateCardPowerDisplay()`: DOM update for individual cards
     - `formatTimeAgo()`: Relative timestamp formatting
     - `updateCountdownDisplay()`: Countdown badge updates
     - `startRealTimeMode()`: Initialize polling and UI
     - `stopRealTimeMode()`: Cleanup and restore normal view
     - `toggleRealTimeMode()`: Toggle handler
     - `bindRealTimeToggle()`: Event binding
   - Added cleanup in `onDestroy` (lines 1803-1815)
   - Added `bindRealTimeToggle()` call in `onInit` (line 1147)

4. **`src/docs/rfcs/RFC-0093-Equipments-Grid-RealTime-Mode.md`**
   - Created full RFC documentation in Rust RFC style

### Features Implemented

- [x] Toggle button in toolbar (right-aligned next to shopping filter chips)
- [x] Real-time polling service with 8-second interval
- [x] Batched API calls (10 devices per batch with 100ms delay)
- [x] Card transformation with LIVE badge
- [x] Power display in kW format
- [x] Last update timestamp ("há Xs" format)
- [x] Countdown display before next refresh
- [x] Auto-disable after 10 minutes
- [x] Cleanup on widget destroy
- [x] Visual feedback with animations

### Configuration

```javascript
const REALTIME_CONFIG = {
  REFRESH_INTERVAL_MS: 8000,     // 8 seconds between refreshes
  MAX_RUNTIME_MS: 600000,        // 10 minutes auto-disable
  BATCH_SIZE: 10,                // Devices per API batch
  BATCH_DELAY_MS: 100,           // Delay between batches
};
```

### API Endpoint Used

```
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries?keys=power&limit=1&agg=NONE&useStrictDataTypes=true
```
