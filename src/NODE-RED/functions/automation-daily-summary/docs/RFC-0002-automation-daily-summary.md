# RFC-0002: Automation Daily Summary Generator

- **Feature Name:** `automation-daily-summary`
- **Start Date:** 2025-11-24
- **RFC PR:** N/A
- **Status:** Draft
- **Version:** 1.0.0

## Summary

A Node-RED function that generates **intelligent daily summaries** of automation events by analyzing D-1 (yesterday's) logs, detecting state changes, identifying patterns, and creating concise per-device reports instead of storing redundant repetitive log entries.

## Motivation

### Problem Statement

Currently, the automation system generates **detailed logs every few seconds** for each device check:

```javascript
// 10:00:00 - Device X: shouldActivate=false (holiday)
// 10:00:05 - Device X: shouldActivate=false (holiday)  // REDUNDANT!
// 10:00:10 - Device X: shouldActivate=false (holiday)  // REDUNDANT!
// 10:00:15 - Device X: shouldActivate=false (holiday)  // REDUNDANT!
// ... (repeated 17,280 times per day per device at 5-second intervals)
```

**Issues:**
1. 📊 **Storage waste** - 99% of logs are redundant (same state repeated)
2. 🔍 **Hard to analyze** - Important state changes buried in noise
3. 🐢 **Slow queries** - Thousands of logs to filter through
4. 💰 **Cost** - Unnecessary database/storage usage
5. 🤯 **Poor UX** - Users can't easily see "what happened yesterday"

### Goals

- ✅ **Detect state changes** - Identify when `shouldActivate` changes (ON→OFF, OFF→ON)
- ✅ **Summarize daily activity** - One summary per device per day
- ✅ **Track key metrics** - Total activations, deactivations, idle time
- ✅ **Identify anomalies** - Devices that never activated, unexpected changes
- ✅ **Reduce storage** - From ~17K logs/device/day to 1 summary/device/day
- ✅ **ThingsBoard Integration** - Send summaries as telemetry to virtual device

### Non-Goals

- ❌ Replacing real-time logging (still needed for debugging)
- ❌ Analyzing historical data beyond D-1
- ❌ Real-time alerting (separate concern)
- ❌ Modifying source automation logs
- ❌ Sending individual device summaries to separate ThingsBoard devices

## Guide-Level Explanation

### Overview

This function runs **daily at 03:00 AM** (low-traffic hours) to analyze **yesterday's (D-1) automation logs** and generate intelligent summaries.

### Architecture Position

```
┌────────────────────────────────────────────────────────────┐
│ Automation Flow                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  func-001-FeriadoCheck  ← Generates logs every 5 seconds  │
│         ↓                                                  │
│  func-002-PersistAdapter ← Stores in automation_logs      │
│         ↓                                                  │
│  flow.get('automation_logs') ← 17,280 logs/device/day    │
│         ↓                                                  │
│  [03:00 AM Daily]                                         │
│         ↓                                                  │
│  func-005-DailySummary ← NEW (this RFC)                  │
│         ↓                                                  │
│  ├─→ flow.set('daily_summaries') ← 1 summary/device/day  │
│  └─→ msg.payload (ThingsBoard format)                     │
│         ↓                                                  │
│  MQTT Out → ThingsBoard (virtual device "automation-log") │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### What Gets Summarized

**Input (17,280 logs for Device1 on D-1):**
```javascript
{
  "automation_log_Device1_1732406400000": { shouldActivate: false, reason: "outside_schedule" },
  "automation_log_Device1_1732406405000": { shouldActivate: false, reason: "outside_schedule" }, // SAME
  "automation_log_Device1_1732406410000": { shouldActivate: false, reason: "outside_schedule" }, // SAME
  // ... (repeated 5,000 times)
  "automation_log_Device1_1732431600000": { shouldActivate: true, reason: "weekday" },  // STATE CHANGE!
  "automation_log_Device1_1732431605000": { shouldActivate: true, reason: "weekday" },  // SAME
  // ... (repeated 8,000 times)
  "automation_log_Device1_1732465200000": { shouldActivate: false, reason: "outside_schedule" }, // STATE CHANGE!
  // ... (repeated 4,000 times)
}
```

**Output 1 - Flow Context (stored in Node-RED):**
```javascript
flow.set('daily_summaries') = {
  "daily_summary_Device1_2025-11-24": {
    device: "Device1",
    date: "2025-11-24",
    totalLogs: 17280,
    stateChanges: [
      {
        timestamp: "2025-11-24T08:00:00.000Z",
        from: { shouldActivate: false, reason: "outside_schedule" },
        to: { shouldActivate: true, reason: "weekday" }
      },
      {
        timestamp: "2025-11-24T17:30:00.000Z",
        from: { shouldActivate: true, reason: "weekday" },
        to: { shouldActivate: false, reason: "outside_schedule" }
      }
    ],
    metrics: {
      totalStateChanges: 2,
      timeActive: 9.5,      // hours
      timeInactive: 14.5,   // hours
      activationCount: 1,
      deactivationCount: 1
    },
    firstLog: "2025-11-24T00:00:05.000Z",
    lastLog: "2025-11-24T23:59:55.000Z",
    anomalies: []
  },
  "daily_summary_Device2_2025-11-24": { /* ... */ },
  // ... all devices
}
```

**Output 2 - ThingsBoard Telemetry (msg.payload for MQTT):**
```javascript
msg.payload = {
  "automation-log": [{  // ← Single virtual device for all summaries
    ts: 1732521600000,  // Timestamp when summary was generated (03:00 AM)
    values: {
      daily_summary: {
        date: "2025-11-24",
        totalDevices: 100,
        devices: {
          "Device1": {
            totalLogs: 17280,
            stateChanges: 2,
            timeActive: 9.5,
            timeInactive: 14.5,
            activationCount: 1,
            anomalies: []
          },
          "Device2": {
            totalLogs: 17280,
            stateChanges: 4,
            timeActive: 12.0,
            timeInactive: 12.0,
            activationCount: 2,
            anomalies: []
          }
          // ... all 100 devices
        }
      }
    }
  }]
}
```

### Key Insight: State Changes vs Repetitions

**Repetitive logs (ignored in summary):**
```javascript
// 10:00:00 - OFF (holiday)
// 10:00:05 - OFF (holiday)  ← Same state, skip
// 10:00:10 - OFF (holiday)  ← Same state, skip
```

**State change (captured in summary):**
```javascript
// 10:00:00 - OFF (holiday)
// 10:00:05 - ON (weekday)   ← STATE CHANGE! Record this
```

## Reference-Level Explanation

### Dual Output Strategy

This function produces **two outputs**:

1. **Flow Context Storage** - Detailed summaries per device (for internal use)
2. **ThingsBoard Telemetry** - Aggregated summary for all devices (for monitoring)

**Why two outputs?**
- Flow context: Full details for each device (state changes, anomalies)
- ThingsBoard: Overview metrics for operational dashboard
- Single virtual device "automation-log" consolidates all device summaries

### Algorithm: State Change Detection

```
1. Load all automation_logs
2. Filter logs for D-1 (yesterday)
3. Group logs by device
4. For each device:
   a. Sort logs by timestamp
   b. Iterate through logs sequentially
   c. Compare shouldActivate with previous log
   d. If different → record state change
   e. Calculate time spent in each state
5. Generate summary with state changes + metrics
6. Store in flow.set('daily_summaries')
7. Format aggregated data for ThingsBoard
8. Return msg.payload with ThingsBoard telemetry format
```

### State Change Detection Logic

```javascript
function detectStateChanges(logs) {
  const changes = [];
  let previousState = null;

  for (const log of logs) {
    const currentState = {
      shouldActivate: log.shouldActivate,
      reason: log.reason
    };

    // First log or state changed
    if (!previousState ||
        previousState.shouldActivate !== currentState.shouldActivate) {

      changes.push({
        timestamp: log.timestamp,
        from: previousState,
        to: currentState
      });
    }

    previousState = currentState;
  }

  return changes;
}
```

### Metrics Calculation

**Time Active/Inactive:**
```javascript
function calculateTimeMetrics(stateChanges, dayStart, dayEnd) {
  let timeActive = 0;
  let timeInactive = 0;
  let currentState = stateChanges[0].to.shouldActivate;
  let stateStartTime = dayStart;

  for (const change of stateChanges) {
    const duration = (change.timestamp - stateStartTime) / (1000 * 60 * 60); // hours

    if (currentState) {
      timeActive += duration;
    } else {
      timeInactive += duration;
    }

    currentState = change.to.shouldActivate;
    stateStartTime = change.timestamp;
  }

  // Add remaining time until end of day
  const remainingDuration = (dayEnd - stateStartTime) / (1000 * 60 * 60);
  if (currentState) {
    timeActive += remainingDuration;
  } else {
    timeInactive += remainingDuration;
  }

  return { timeActive, timeInactive };
}
```

### Anomaly Detection

**Anomalies to detect:**

1. **Never Activated**
   ```javascript
   if (metrics.activationCount === 0) {
     anomalies.push({ type: 'never_activated', severity: 'warning' });
   }
   ```

2. **No Logs for Device**
   ```javascript
   if (totalLogs === 0) {
     anomalies.push({ type: 'no_logs', severity: 'error' });
   }
   ```

3. **Excessive State Changes** (more than expected)
   ```javascript
   if (metrics.totalStateChanges > 10) {
     anomalies.push({ type: 'excessive_changes', count: metrics.totalStateChanges });
   }
   ```

4. **Always Active** (never turned off)
   ```javascript
   if (metrics.timeInactive < 0.1) { // Less than 6 minutes inactive
     anomalies.push({ type: 'always_active', severity: 'info' });
   }
   ```

### ThingsBoard Telemetry Formatting

Following the pattern from `func-004-TelemetryAdapter`, format summary for single virtual device:

```javascript
function formatThingsBoardTelemetry(allSummaries, generatedAt) {
  // Aggregate all device summaries
  const devices = {};
  let totalDevices = 0;

  for (const [key, summary] of Object.entries(allSummaries)) {
    devices[summary.device] = {
      totalLogs: summary.totalLogs,
      stateChanges: summary.metrics.totalStateChanges,
      timeActive: summary.metrics.timeActive,
      timeInactive: summary.metrics.timeInactive,
      activationCount: summary.metrics.activationCount,
      anomalies: summary.anomalies
    };
    totalDevices++;
  }

  // Format as ThingsBoard telemetry
  const telemetryMap = {};
  telemetryMap["automation-log"] = [{  // ← Single virtual device
    ts: generatedAt,
    values: {
      daily_summary: {
        date: new Date(generatedAt).toISOString().split('T')[0],
        totalDevices: totalDevices,
        devices: devices
      }
    }
  }];

  return telemetryMap;
}
```

**Key differences from func-004:**
- Single device name: `"automation-log"` (not per physical device)
- Aggregated data: All devices in one telemetry message
- Summary-level timestamp: When report generated (03:00 AM)

### Summary Storage Format

```javascript
// flow.set('daily_summaries')
{
  "daily_summary_Device1_2025-11-24": {
    device: "Device1",
    deviceId: "device-123",
    date: "2025-11-24",
    totalLogs: 17280,
    stateChanges: [
      {
        timestamp: "2025-11-24T08:00:00.000Z",
        timestampMs: 1732431600000,
        from: {
          shouldActivate: false,
          shouldShutdown: false,
          reason: "outside_schedule"
        },
        to: {
          shouldActivate: true,
          shouldShutdown: false,
          reason: "weekday"
        },
        durationInPreviousState: 8.0 // hours
      }
    ],
    metrics: {
      totalStateChanges: 2,
      timeActive: 9.5,
      timeInactive: 14.5,
      activationCount: 1,
      deactivationCount: 1,
      averageActiveSessionDuration: 9.5, // hours
      averageInactiveSessionDuration: 7.25 // hours
    },
    schedule: {
      startHour: "08:00",
      endHour: "17:30",
      daysActive: ["mon", "tue", "wed", "thu", "fri"]
    },
    firstLog: "2025-11-24T00:00:05.000Z",
    lastLog: "2025-11-24T23:59:55.000Z",
    anomalies: [],
    globalAutoOn: 1, // From logs
    generatedAt: "2025-11-25T03:00:00.000Z",
    generatedBy: "func-005-DailySummary"
  }
}
```

### Edge Cases

| Case | Behavior |
|------|----------|
| **No logs for D-1** | Create summary with `totalLogs: 0`, anomaly: `no_logs` |
| **Single log only** | No state changes, report as static state |
| **Midnight crossing** | Handle state that spans 00:00 |
| **No state changes** | Valid - device maintained same state all day |
| **Missing shouldActivate** | Skip log with warning |
| **Multiple devices** | Process each independently |

## Drawbacks

1. **Delayed visibility** - Summaries only available after 03:00 AM next day
2. **Loss of granularity** - Can't see exact time of every check (but still in raw logs)
3. **Additional processing** - Runs daily analysis job
4. **Memory usage** - Must load D-1 logs into memory

## Rationale and Alternatives

### Why This Design?

1. **State-based approach** - Only track meaningful changes, not repetitions
2. **Daily batch processing** - More efficient than real-time summarization
3. **Separate storage** - Doesn't modify original logs (preserved for debugging)
4. **Simple aggregation** - Easy to query "what happened yesterday per device"

### Alternative Designs Considered

#### Alternative 1: Real-time Summarization

Update summary every time a log is created.

**Pros:** Immediate visibility
**Cons:** High overhead, complex state management, harder to debug

**Rejected:** Batch processing is simpler and sufficient for daily review use case.

#### Alternative 2: Store Only State Changes

Delete repetitive logs, keep only state changes.

**Pros:** Maximum storage savings
**Cons:** Destroys debugging capability, irreversible

**Rejected:** Raw logs are valuable for troubleshooting. Keep both.

#### Alternative 3: Weekly Summaries

Run weekly instead of daily.

**Pros:** Less frequent processing
**Cons:** Too much delay, harder to correlate with events

**Rejected:** Daily cadence aligns with operational review cycles.

### Alternative Implementations

#### Option A: Sliding Window Analysis

Analyze logs using fixed time windows (e.g., hourly blocks).

**Pros:** More structured time segmentation
**Cons:** Loses exact state change timing, arbitrary boundaries

#### Option B: ML-based Pattern Detection

Use machine learning to identify anomalies.

**Pros:** Could detect complex patterns
**Cons:** Overkill for simple state change detection, requires training data

## Prior Art

### Similar Patterns in Codebase

1. **func-003-LogCleanup** (inspiration)
   - Runs daily at 02:00 AM
   - Analyzes automation_logs
   - Performs batch operations
   - This RFC uses similar structure

2. **func-002-PersistAdapter**
   - Creates automation logs
   - Source of data for summaries

### Industry Standards

- **Prometheus** - Time-series metrics with aggregation
- **Elasticsearch** - Log aggregation and summarization
- **CloudWatch** - Daily metrics rollup
- **Grafana** - Dashboard summaries

## Unresolved Questions

### Required Before Stabilization

- [ ] Should we include reason changes even if shouldActivate doesn't change?
  - Example: `shouldActivate=false (holiday)` → `shouldActivate=false (excluded_day)`

- [ ] How long to retain daily summaries? (30 days? 90 days? Forever?)

- [ ] Should anomalies trigger notifications or just log?

- [ ] Include global AutoON state changes in summary?

### Future Possibilities

- [ ] Weekly/monthly aggregate summaries
- [ ] Comparison with previous days (trend analysis)
- [ ] Predictive analytics (expected vs actual behavior)
- [ ] Export summaries to external systems (ThingsBoard, InfluxDB)
- [ ] Dashboard widget showing daily summaries

## Implementation Plan

### Phase 1: Core Summarization (Week 1)

- [ ] Implement state change detection algorithm
- [ ] Implement metrics calculation
- [ ] Store summaries in flow context
- [ ] Add logging for summary generation

### Phase 2: Anomaly Detection (Week 1)

- [ ] Detect "never activated" devices
- [ ] Detect "excessive changes"
- [ ] Detect "always active" devices
- [ ] Detect "no logs" condition

### Phase 3: Testing (Week 2)

- [ ] Create test suite (target: 25+ tests)
- [ ] Test with mock data (1 day, 1 device)
- [ ] Test with multiple devices
- [ ] Test with edge cases (no logs, no changes, midnight crossing)
- [ ] Performance test (100 devices, 17K logs each)

### Phase 4: Integration (Week 2)

- [ ] Create inject node for 03:00 AM daily execution
- [ ] Test in development environment
- [ ] Monitor first execution in staging
- [ ] Document usage in README

### Phase 5: Production (Week 3)

- [ ] Deploy to production
- [ ] Monitor summary generation
- [ ] Verify storage usage reduction
- [ ] Collect user feedback

## Success Metrics

- ✅ **Storage reduction:** > 95% reduction in queryable data (17K logs → 1 summary)
- ✅ **Query performance:** < 100ms to retrieve device summary for D-1
- ✅ **Accuracy:** 100% state change detection (no missed transitions)
- ✅ **Processing time:** < 30s to generate all summaries (100 devices)
- ✅ **Test coverage:** > 85% code coverage

## Documentation Requirements

### User-Facing

- [ ] README.md with examples
- [ ] Integration guide with log-cleanup
- [ ] Dashboard widget examples
- [ ] Troubleshooting guide

### Developer-Facing

- [ ] Inline code comments (English)
- [ ] Test suite documentation
- [ ] Algorithm explanation
- [ ] Performance benchmarks

## Security Considerations

1. **Data Privacy:** Summaries contain same data as logs (no new PII)
2. **Access Control:** Uses same flow context as automation_logs
3. **Storage Limits:** Implement retention policy to prevent unbounded growth
4. **Error Handling:** Never expose sensitive data in error messages

## Dependencies

- **Upstream:** func-002-PersistAdapter (creates automation_logs)
- **Shared:** flow.get('automation_logs')
- **Output:**
  - flow.set('daily_summaries') - Detailed per-device summaries
  - msg.payload - ThingsBoard telemetry format
- **Pattern Reference:** func-004-TelemetryAdapter (ThingsBoard formatting)
- **Downstream:** MQTT Out node → ThingsBoard virtual device "automation-log"
- **Testing:** Jest 29.7.0 (shared from src/NODE-RED)

## Migration Strategy

### For New Deployments

1. Deploy func-005-DailySummary
2. Configure inject node for 03:00 AM
3. Wait 24 hours for first summary
4. Verify summary generation

### For Existing Deployments

1. **Backward Compatible:** Function reads existing logs without modification
2. **Gradual Rollout:** Start with monitoring-only mode
3. **No Data Migration:** Summaries generated from D-1 onwards
4. **Parallel Operation:** Raw logs still available for debugging

## Future Enhancements

### Post-1.0 Features

- [ ] **Trend Analysis:** Compare today vs yesterday
- [ ] **Predictive Alerts:** "Device X should activate at 08:00 but hasn't"
- [ ] **Export API:** Send summaries to external systems
- [ ] **Custom Metrics:** User-defined aggregations
- [ ] **Compression:** Store old summaries in compressed format
- [ ] **Multi-day Aggregation:** Weekly/monthly rollups

## Appendix A: Complete Example

### Input: Raw Logs for Device1 on 2025-11-24

```javascript
flow.get('automation_logs') = {
  // 00:00 - 07:59 (8 hours, 5,760 logs)
  "automation_log_Device1_1732406400000": {
    device: "Device1",
    action: "OFF",
    shouldActivate: false,
    shouldShutdown: false,
    reason: "outside_schedule",
    timestamp: "2025-11-24T00:00:00.000Z",
    timestampMs: 1732406400000
  },
  // ... (5,759 similar logs) ...

  // 08:00 - STATE CHANGE TO ON
  "automation_log_Device1_1732431600000": {
    device: "Device1",
    action: "ON",
    shouldActivate: true,
    shouldShutdown: false,
    reason: "weekday",
    timestamp: "2025-11-24T08:00:00.000Z",
    timestampMs: 1732431600000
  },
  // ... (6,839 logs with shouldActivate=true) ...

  // 17:30 - STATE CHANGE TO OFF
  "automation_log_Device1_1732465200000": {
    device: "Device1",
    action: "OFF",
    shouldActivate: false,
    shouldShutdown: true,
    reason: "outside_schedule",
    timestamp: "2025-11-24T17:30:00.000Z",
    timestampMs: 1732465200000
  },
  // ... (4,680 logs with shouldActivate=false) ...
}

// Total: 17,280 logs for Device1
```

### Output: Daily Summary

```javascript
flow.set('daily_summaries') = {
  "daily_summary_Device1_2025-11-24": {
    device: "Device1",
    deviceId: "device-123",
    date: "2025-11-24",
    totalLogs: 17280,

    stateChanges: [
      {
        timestamp: "2025-11-24T08:00:00.000Z",
        timestampMs: 1732431600000,
        from: {
          shouldActivate: false,
          shouldShutdown: false,
          reason: "outside_schedule"
        },
        to: {
          shouldActivate: true,
          shouldShutdown: false,
          reason: "weekday"
        },
        durationInPreviousState: 8.0 // Device was OFF for 8 hours
      },
      {
        timestamp: "2025-11-24T17:30:00.000Z",
        timestampMs: 1732465200000,
        from: {
          shouldActivate: true,
          shouldShutdown: false,
          reason: "weekday"
        },
        to: {
          shouldActivate: false,
          shouldShutdown: true,
          reason: "outside_schedule"
        },
        durationInPreviousState: 9.5 // Device was ON for 9.5 hours
      }
    ],

    metrics: {
      totalStateChanges: 2,
      timeActive: 9.5,              // hours (08:00 - 17:30)
      timeInactive: 14.5,            // hours (00:00-08:00 + 17:30-24:00)
      activationCount: 1,
      deactivationCount: 1,
      averageActiveSessionDuration: 9.5,
      averageInactiveSessionDuration: 7.25
    },

    schedule: {
      startHour: "08:00",
      endHour: "17:30",
      daysActive: ["mon", "tue", "wed", "thu", "fri"],
      holiday: false
    },

    firstLog: "2025-11-24T00:00:05.000Z",
    lastLog: "2025-11-24T23:59:55.000Z",
    anomalies: [],
    globalAutoOn: 1,

    generatedAt: "2025-11-25T03:00:00.000Z",
    generatedBy: "func-005-DailySummary",
    version: "1.0.0"
  }
}
```

### Storage Reduction

**Before (raw logs):**
- Device1: 17,280 logs × ~500 bytes = ~8.6 MB
- 100 devices: ~860 MB per day

**After (with summaries):**
- Device1: 1 summary × ~2 KB = ~2 KB
- 100 devices: ~200 KB per day
- Raw logs: Still available for debugging

**Savings:** 99.98% reduction in queryable daily data!

---

**Status:** Draft
**Next Review:** TBD
**Assigned Reviewers:** TBD
**Implementation Target:** Q1 2025
