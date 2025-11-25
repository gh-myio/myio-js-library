# RFC-0082: Demand Modal - Real-Time Monitoring Mode

**Status:** Draft
**Created:** 2025-01-25
**Author:** Claude Code Assistant
**Component:** `DemandModal.ts`
**Related RFCs:** RFC-0015, RFC-0061

---

## 📋 Summary

Add a **Real-Time Mode** to the Demand Modal that continuously updates telemetry data every 8 seconds, displaying live measurements from the current day (00:00 to 23:59).

---

## 🎯 Motivation

### Current Limitation
The Demand Modal currently operates in **historical mode only**:
- User selects start/end dates
- Data is fetched once
- Chart remains static

### Business Need
For operational monitoring, users need to see **live telemetry data** without manual refresh:
- Monitor current power consumption in real-time
- Detect anomalies as they happen
- Track instantaneous demand patterns
- Enable proactive response to consumption spikes

### Use Cases
1. **Operations Team:** Monitor store energy consumption during peak hours
2. **Facilities Manager:** Track HVAC performance in real-time
3. **Energy Analyst:** Observe demand response to external events (weather, promotions)
4. **Maintenance:** Detect equipment issues immediately (abnormal current/voltage)

---

## 🔧 Proposed Solution

### 1. UI Changes

#### New "REAL TIME" Toggle Button
Add a toggle button next to the "Atualizar" (Refresh) button:

```
┌─────────────────────────────────────┐
│  Período                            │
│  [Data Inicial] [Data Final]        │
│  [Atualizar] [🔴 REAL TIME]         │ ← New button
└─────────────────────────────────────┘
```

**Button States:**
- **OFF (default):** Gray outline, text "REAL TIME"
- **ON:** Red/pulsing background, text "AO VIVO" with animated dot

#### Disabled Date Inputs in Real-Time Mode
When Real-Time mode is active:
- Date inputs become **disabled** (grayed out)
- Dates are automatically set to:
  - **Start:** Today at 00:00:00
  - **End:** Today at 23:59:59
- Tooltip: "Datas fixas em modo tempo real"

---

### 2. Real-Time Behavior

#### Initial Load
When user clicks "REAL TIME" button:

1. **Lock Date Range**
   - Set `startDate = TODAY at 00:00:00`
   - Set `endDate = TODAY at 23:59:59`
   - Disable date pickers

2. **Fix Query Parameters**
   - **Interval:** `8000ms` (8 seconds) - **FIXED**
   - **Aggregation:** `AVG` - **FIXED**
   - Disable interval/aggregation selectors (if visible)

3. **Initial Full Fetch**
   - Fetch ALL data from 00:00 to current time
   - Render chart with all historical data for today

4. **Start Auto-Update Loop**
   - Start interval timer (8 seconds)
   - Show visual indicator (pulsing red dot)

#### Incremental Updates (Every 8 Seconds)

**Smart Fetch Strategy:**
```
┌─────────────────────────────────────────────────┐
│  Timeline                                       │
│  00:00 ────────── Last Fetch ── Now             │
│                        ↑            ↑            │
│                        │            │            │
│        Full Fetch  8sec ago    New Fetch        │
│                                Only 8s window    │
└─────────────────────────────────────────────────┘
```

**Fetch Logic:**
```typescript
// Only fetch data AFTER the last fetched timestamp
const incrementalStartTime = lastFetchedTimestamp;
const incrementalEndTime = Date.now();

// Fetch 8 seconds worth of data (not full day)
const newDataPoints = await fetchTelemetry({
  deviceId,
  keys: currentTelemetryKey,
  startTs: incrementalStartTime,
  endTs: incrementalEndTime,
  interval: 8000,  // 8 seconds
  agg: 'AVG'
});
```

**Chart Update:**
- Append new data points to existing chart
- **Do NOT re-fetch full dataset** (performance optimization)
- Update chart X-axis to include new timestamps
- Auto-scroll to show latest data (optional configurable behavior)

#### Stop Real-Time Mode
When user clicks "REAL TIME" button again (to disable):
1. Stop interval timer
2. Re-enable date pickers
3. Clear interval reference
4. Remove pulsing indicator

---

### 3. Implementation Details

#### New Properties

```typescript
export interface DemandModalParams {
  // ... existing properties

  // RFC-0082: Real-time mode configuration
  enableRealTimeMode?: boolean;         // Allow real-time toggle (default: true)
  realTimeInterval?: number;            // Update interval in ms (default: 8000)
  realTimeAutoScroll?: boolean;         // Auto-scroll to latest data (default: true)
}
```

#### Internal State

```typescript
interface DemandModalState {
  // ... existing state

  // RFC-0082: Real-time mode state
  isRealTimeMode: boolean;              // Current mode flag
  realTimeIntervalId: number | null;    // Interval timer ID
  lastFetchedTimestamp: number | null;  // Last successful fetch timestamp
  realTimeDataBuffer: TelemetryData[];  // Accumulated data for today
}
```

#### Core Methods

##### `enableRealTimeMode()`
```typescript
private enableRealTimeMode(): void {
  // 1. Lock dates to today
  this.state.startDate = getTodayStart();  // 00:00:00
  this.state.endDate = getTodayEnd();      // 23:59:59

  // 2. Disable date inputs
  this.disableDateInputs();

  // 3. Fix query parameters
  this.state.telemetryQuery = {
    interval: 8000,       // 8 seconds
    agg: 'AVG',          // Average
    intervalType: 'MILLISECONDS'
  };

  // 4. Initial full fetch
  await this.fetchFullDayData();

  // 5. Start auto-update loop
  this.startRealTimeLoop();

  // 6. Update UI
  this.updateRealTimeButton(true);
}
```

##### `startRealTimeLoop()`
```typescript
private startRealTimeLoop(): void {
  const intervalMs = this.params.realTimeInterval || 8000;

  this.state.realTimeIntervalId = window.setInterval(async () => {
    try {
      await this.fetchIncrementalData();
      this.updateChart();
    } catch (error) {
      console.error('[DemandModal] Real-time update failed:', error);
      // Continue loop even on error (retry next interval)
    }
  }, intervalMs);

  console.log(`[DemandModal] Real-time mode started (${intervalMs}ms interval)`);
}
```

##### `fetchIncrementalData()`
```typescript
private async fetchIncrementalData(): Promise<void> {
  if (!this.state.lastFetchedTimestamp) {
    throw new Error('No last fetched timestamp available');
  }

  const startTs = this.state.lastFetchedTimestamp;
  const endTs = Date.now();

  // Fetch only new data (8 seconds window)
  const newData = await this.fetcher.fetchTelemetry({
    deviceId: this.params.deviceId,
    keys: this.state.currentTelemetryKey,
    startTs,
    endTs,
    interval: 8000,
    agg: 'AVG'
  });

  // Append to buffer (do NOT replace)
  this.state.realTimeDataBuffer.push(...newData);

  // Update last fetched timestamp
  this.state.lastFetchedTimestamp = endTs;

  console.log(`[DemandModal] Fetched ${newData.length} new data points`);
}
```

##### `disableRealTimeMode()`
```typescript
private disableRealTimeMode(): void {
  // 1. Stop interval timer
  if (this.state.realTimeIntervalId) {
    window.clearInterval(this.state.realTimeIntervalId);
    this.state.realTimeIntervalId = null;
  }

  // 2. Re-enable date inputs
  this.enableDateInputs();

  // 3. Clear real-time state
  this.state.isRealTimeMode = false;
  this.state.lastFetchedTimestamp = null;
  this.state.realTimeDataBuffer = [];

  // 4. Update UI
  this.updateRealTimeButton(false);

  console.log('[DemandModal] Real-time mode stopped');
}
```

---

### 4. UI Components

#### Real-Time Button HTML
```html
<button id="realtime-toggle-btn" class="myio-btn myio-btn-realtime">
  <span class="realtime-indicator"></span>
  <span class="realtime-text">REAL TIME</span>
</button>
```

#### CSS Styles
```css
/* Real-time button (inactive) */
.myio-btn-realtime {
  background: transparent;
  border: 2px solid #666;
  color: #666;
  transition: all 0.3s ease;
}

/* Real-time button (active) */
.myio-btn-realtime.active {
  background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%);
  border-color: #d32f2f;
  color: white;
  box-shadow: 0 0 12px rgba(244, 67, 54, 0.5);
}

/* Pulsing red dot indicator */
.realtime-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
  margin-right: 6px;
}

.myio-btn-realtime.active .realtime-indicator {
  background: white;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

/* Text change when active */
.myio-btn-realtime.active .realtime-text::before {
  content: "AO VIVO";
}
```

---

### 5. Chart Update Strategy

#### Plotly Update (Efficient)
Use `Plotly.extendTraces()` instead of full re-render:

```typescript
private updateChart(): void {
  if (!this.chart || !this.state.realTimeDataBuffer) return;

  const newPoints = this.getNewDataPoints();

  if (newPoints.length === 0) return;

  // Efficient update: append new data without re-rendering entire chart
  Plotly.extendTraces(
    this.chartContainer,
    {
      x: [newPoints.map(p => p.timestamp)],
      y: [newPoints.map(p => p.value)]
    },
    [0]  // Trace index
  );

  // Auto-scroll to latest data (optional)
  if (this.params.realTimeAutoScroll) {
    this.scrollToLatest();
  }
}
```

---

### 6. Error Handling

#### Network Failure
```typescript
private async fetchIncrementalData(): Promise<void> {
  try {
    // ... fetch logic
  } catch (error) {
    console.error('[DemandModal] Real-time fetch failed:', error);

    // Show transient error indicator (do NOT stop loop)
    this.showTransientError('Falha ao atualizar. Tentando novamente...');

    // Continue loop (will retry in 8 seconds)
  }
}
```

#### Token Expiration
```typescript
private async fetchIncrementalData(): Promise<void> {
  try {
    // ... fetch logic
  } catch (error) {
    if (error.status === 401) {
      // Token expired - stop real-time mode
      this.disableRealTimeMode();
      this.showError('Sessão expirada. Modo tempo real desativado.');
    }
  }
}
```

---

## 📊 Technical Specifications

### API Calls

#### Initial Full Fetch (00:00 to now)
```
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries
?keys=consumption
&startTs=1737763200000    (Today 00:00:00)
&endTs=1737820000000      (Current time)
&interval=8000
&agg=AVG
&limit=10800              (3 hours * 60min * 60sec / 8sec = 1350 points)
```

#### Incremental Fetch (Last 8 seconds)
```
GET /api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries
?keys=consumption
&startTs=1737819992000    (Last fetch timestamp)
&endTs=1737820000000      (Current time)
&interval=8000
&agg=AVG
&limit=1                  (Only 1 new point expected)
```

### Performance Considerations

#### Data Volume
- **24 hours** = 86,400 seconds
- **8 second interval** = 10,800 data points per day
- **3 telemetry keys** (A/B/C phases) = 32,400 points total
- **Estimated payload:** ~500KB per day (uncompressed)

#### Optimization Strategy
1. ✅ **Incremental fetches** (8s windows, not full day)
2. ✅ **Chart append** (extend traces, not full re-render)
3. ✅ **Data buffering** (keep in memory, no re-fetch on chart updates)
4. ✅ **Error recovery** (continue loop on failure)

---

## 🎨 User Experience

### Visual Feedback

#### Mode Indicator
```
┌────────────────────────────────────┐
│ ● AO VIVO                          │  ← Pulsing red dot
│ Atualizando a cada 8 segundos      │
└────────────────────────────────────┘
```

#### Auto-Scroll Behavior
- **Enabled (default):** Chart automatically scrolls to show latest data
- **Disabled:** User can pan/zoom freely without auto-scroll interruption

#### Loading States
- **Initial load:** "Carregando dados do dia..."
- **Incremental update:** Small spinner in corner (non-intrusive)
- **Error state:** "Falha ao atualizar. Tentando novamente em 8s..."

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('RFC-0082: Real-Time Mode', () => {
  it('should lock dates to today when enabled', () => {
    modal.enableRealTimeMode();
    expect(modal.state.startDate).toBe(getTodayStart());
    expect(modal.state.endDate).toBe(getTodayEnd());
  });

  it('should fetch incrementally every 8 seconds', async () => {
    modal.enableRealTimeMode();
    await wait(8000);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // Initial + 1 update
  });

  it('should stop interval when disabled', () => {
    modal.enableRealTimeMode();
    modal.disableRealTimeMode();
    expect(clearInterval).toHaveBeenCalled();
  });
});
```

### Integration Tests
1. Enable real-time mode → Verify dates locked
2. Wait 8 seconds → Verify incremental fetch occurred
3. Disable real-time mode → Verify dates unlocked
4. Simulate network error → Verify loop continues

---

## 🚀 Implementation Plan

### Phase 1: Core Functionality (RFC-0082)
- [ ] Add real-time toggle button UI
- [ ] Implement date locking logic
- [ ] Create incremental fetch method
- [ ] Add interval timer management
- [ ] Implement chart append logic

### Phase 2: Polish & UX
- [ ] Add pulsing animation to button
- [ ] Implement auto-scroll behavior
- [ ] Add transient error handling
- [ ] Create mode indicator component

### Phase 3: Testing & Documentation
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update component documentation
- [ ] Add usage examples

---

## 📚 References

- **RFC-0015:** Demand Modal Component (original implementation)
- **RFC-0061:** Telemetry Key Selection (current modal structure)
- **ThingsBoard Telemetry API:** https://thingsboard.io/docs/user-guide/telemetry/

---

## 🔄 Migration Guide

### For Existing Users
Real-time mode is **opt-in** and fully backward compatible:

```typescript
// Existing code (no changes needed)
openDemandModal({
  token: jwt,
  deviceId: 'abc123',
  startDate: '2025-01-01T00:00:00-03:00',
  endDate: '2025-01-31T23:59:59-03:00'
});

// New real-time mode (optional parameters)
openDemandModal({
  token: jwt,
  deviceId: 'abc123',
  startDate: '2025-01-25T00:00:00-03:00',
  endDate: '2025-01-25T23:59:59-03:00',
  enableRealTimeMode: true,      // Show real-time button (default: true)
  realTimeInterval: 8000,         // Update every 8 seconds (default: 8000)
  realTimeAutoScroll: true        // Auto-scroll to latest (default: true)
});
```

---

## ✅ Acceptance Criteria

1. ✅ Real-time toggle button appears next to "Atualizar" button
2. ✅ Date inputs become disabled when real-time mode is active
3. ✅ Dates are locked to today (00:00 to 23:59)
4. ✅ Initial fetch retrieves all data from today 00:00 to now
5. ✅ Chart updates every 8 seconds with NEW data only
6. ✅ Incremental fetches use 8-second window (not full day)
7. ✅ Chart appends new data points (no full re-render)
8. ✅ Button shows pulsing red indicator when active
9. ✅ Real-time mode stops when button is clicked again
10. ✅ Error handling allows loop to continue on network failure

---

## 📝 Open Questions

1. **Should interval be configurable via UI?**
   - Proposed: Keep 8 seconds fixed (simplicity)
   - Alternative: Add dropdown with 5s/10s/15s options

2. **Should we limit real-time mode to current day only?**
   - Proposed: Yes, lock to today (00:00-23:59)
   - Alternative: Allow any date range with real-time updates

3. **How to handle midnight rollover?**
   - Proposed: Auto-disable real-time mode at 00:00, show notification
   - Alternative: Auto-switch to next day

4. **Should we persist real-time mode across modal reopens?**
   - Proposed: No, always start in historical mode
   - Alternative: Remember last state in localStorage

---

**End of RFC-0082**
