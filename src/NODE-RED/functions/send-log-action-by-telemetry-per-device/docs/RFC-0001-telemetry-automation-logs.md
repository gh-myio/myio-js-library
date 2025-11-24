# RFC-0001: Send Automation Logs via Telemetry per Device

- **Feature Name:** `send-log-action-by-telemetry-per-device`
- **Start Date:** 2025-11-24
- **RFC PR:** N/A
- **Status:** Draft
- **Version:** 1.0.0

## Summary

A Node-RED function that transforms automation log events from the persister-schedule module into MQTT telemetry messages formatted for ThingsBoard ingestion, sending automation action logs per device without duplicating device name or timestamp data.

## Motivation

### Problem Statement

Currently, the automation system generates detailed logs through the persister-schedule module (func-002-PersistAdapter), but these logs remain stored only in Node-RED's flow context. There is no mechanism to:

1. **Export logs to external systems** for long-term storage and analysis
2. **Visualize automation events** in ThingsBoard dashboards
3. **Correlate automation actions** with device telemetry data
4. **Monitor automation performance** across the fleet

### Goals

- ✅ Transform persisted automation logs into ThingsBoard-compatible telemetry
- ✅ Send telemetry per device (one message per device)
- ✅ Minimize payload size (avoid redundant data)
- ✅ Maintain compatibility with existing persister-schedule output
- ✅ Enable real-time monitoring of automation actions in ThingsBoard

### Non-Goals

- ❌ Replacing the existing flow-based log storage
- ❌ Modifying the persister-schedule module
- ❌ Handling MQTT connection/retry logic (delegated to MQTT node)
- ❌ Aggregating logs across multiple devices in a single message

## Guide-Level Explanation

### Overview

This function acts as a **telemetry adapter** that sits at the end of the persister-schedule flow. It receives automation log events and transforms them into a format that ThingsBoard can ingest as device telemetry.

### Architecture Position

```
┌─────────────────────────────────────────────────────────────────┐
│ Automation Flow                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  func-001-FeriadoCheck                                         │
│         ↓                                                       │
│  func-002-PersistAdapter  ← You are here (existing)            │
│         ↓                                                       │
│  func-004-TelemetryAdapter ← NEW (this RFC)                    │
│         ↓                                                       │
│  MQTT Out → ThingsBoard                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Input Format

The function receives output from `func-002-PersistAdapter`:

```javascript
{
  payload: {
    key: "automation_log_Device1_1732445678123",
    value: {
      device: "Device1",
      deviceId: "device-123",
      action: "ON",
      shouldActivate: true,
      shouldShutdown: false,
      reason: "weekday",
      schedule: { /* ... */ },
      context: { /* ... */ },
      timestamp: "2025-11-24T12:00:00.000Z",
      timestampMs: 1732445678123
    }
  }
}
```

### Output Format

The function produces ThingsBoard telemetry format:

```javascript
{
  payload: {
    "Device1": [{
      ts: 1732445678123,
      values: {
        automation_log: {
          action: "ON",
          shouldActivate: true,
          shouldShutdown: false,
          reason: "weekday",
          // ... other relevant fields
        }
      }
    }]
  }
}
```

### Key Design Decisions

1. **No device name in log object** - Device name is the map key, not duplicated in values
2. **No timestamp duplication** - Uses `ts` field at telemetry level, not inside `automation_log`
3. **Simplified payload** - Only sends relevant automation data, excludes verbose context
4. **Per-device format** - Each device gets its own telemetry entry for proper ThingsBoard routing

## Reference-Level Explanation

### Data Flow

```
Input (from persister-schedule)
  ↓
Extract device name and timestamp
  ↓
Build automation_log object (excluding device/timestamp)
  ↓
Format as ThingsBoard telemetry per device
  ↓
Output to MQTT node
```

### Transformation Logic

#### Step 1: Extract Core Data

```javascript
const logData = msg.payload.value;
const deviceName = logData.device;
const timestampMs = logData.timestampMs;
```

#### Step 2: Build automation_log Object

Include only relevant fields, excluding:
- `device` (already in map key)
- `timestamp` / `timestampMs` (already in `ts` field)
- `deviceId` (ThingsBoard already knows this via MQTT topic)

```javascript
const automation_log = {
  action: logData.action,
  shouldActivate: logData.shouldActivate,
  shouldShutdown: logData.shouldShutdown,
  reason: logData.reason,
  schedule: logData.schedule,
  context: logData.context
};
```

#### Step 3: Format as ThingsBoard Telemetry

```javascript
const telemetryMap = {};
telemetryMap[deviceName] = [{
  ts: timestampMs,
  values: {
    automation_log: automation_log
  }
}];

msg.payload = telemetryMap;
return msg;
```

### Edge Cases

| Case | Behavior |
|------|----------|
| **Missing payload** | Return `null`, log warning |
| **Missing device name** | Return `null`, log error |
| **Missing timestamp** | Use `Date.now()` as fallback |
| **Invalid log data** | Return `null`, log error with details |
| **Device name with spaces** | Preserve as-is (no normalization) |
| **Device name with multipliers** | Keep original name (let downstream handle) |

### Performance Considerations

- **Processing time:** < 1ms per log entry
- **Memory usage:** Minimal (single object transformation)
- **MQTT payload size:** ~200-500 bytes per device (compressed)

### Comparison with Inspiration Code

The inspiration code sends `connectionStatus`:

```javascript
deviceStatusMap[deviceName] = [{
  ts: new Date().getTime(),
  values: {
    connectionStatus: slaveStatusMap[devices[device].slaveId]
  }
}];
```

This RFC sends `automation_log` instead:

```javascript
telemetryMap[deviceName] = [{
  ts: timestampMs,
  values: {
    automation_log: { /* automation data */ }
  }
}];
```

**Key Differences:**
- ✅ Uses existing timestamp from log (not `new Date()`)
- ✅ Sends structured automation data (not single status value)
- ✅ No device multiplier handling (not needed for logs)
- ✅ No slave/device mapping lookup (data already available)

## Drawbacks

1. **Additional MQTT traffic** - Every automation action generates telemetry
2. **ThingsBoard storage** - Logs stored both in Node-RED and ThingsBoard (duplication)
3. **Coupling to ThingsBoard format** - Hard to switch telemetry platforms
4. **No batching** - Sends one message per automation event (could be optimized)

## Rationale and Alternatives

### Why This Design?

1. **Follows existing pattern** - Mimics proven connectionStatus telemetry structure
2. **Simple transformation** - Pure function, no external dependencies
3. **Compatible with ThingsBoard** - Uses standard telemetry format
4. **Minimal payload** - Excludes redundant data (device name, timestamp)

### Alternative Designs Considered

#### Alternative 1: Include Device Name in Log

```javascript
values: {
  automation_log: {
    device: "Device1",  // Redundant!
    action: "ON",
    // ...
  }
}
```

**Rejected:** Device name is already the map key. Duplication wastes bandwidth.

#### Alternative 2: Send Multiple Devices per Message

```javascript
payload: {
  "Device1": [{ ts: 123, values: { automation_log: {...} } }],
  "Device2": [{ ts: 456, values: { automation_log: {...} } }],
  // ...
}
```

**Rejected:** Automation events happen per device, not in batches. Complexity not justified.

#### Alternative 3: Send All Log Fields (Including Context)

```javascript
values: {
  automation_log: {
    action: "ON",
    schedule: { /* full schedule */ },
    context: { /* full context */ },  // Verbose!
    // ...
  }
}
```

**Rejected:** Too verbose. Context data is useful for Node-RED debugging but not needed in ThingsBoard.

**Current Design (Selected):** Balance between completeness and payload size.

### Alternative Implementations

#### Option A: Batch Multiple Logs

Wait for N logs or T seconds, then send batch.

**Pros:** Reduced MQTT messages
**Cons:** Increased latency, more complex state management

#### Option B: Use ThingsBoard Attributes Instead

Send as device attribute instead of telemetry.

**Pros:** Lower storage usage
**Cons:** Loses time-series history, harder to query

## Prior Art

### Similar Patterns in Codebase

1. **Connection Status Telemetry** (inspiration code)
   - Sends device connection status to ThingsBoard
   - Uses same map structure: `deviceMap[name] = [{ ts, values }]`

2. **func-002-PersistAdapter** (persister-schedule)
   - Transforms automation events for storage
   - Produces the input for this function

3. **ThingsBoard MQTT Integration**
   - Existing MQTT nodes handle connection/retry
   - This function only formats payload

### Industry Standards

- **ThingsBoard Telemetry API:** Standard `{ ts, values }` format
- **MQTT Topic Structure:** `v1/devices/me/telemetry` (handled by MQTT node)
- **Time-series Data:** Millisecond timestamps (Unix epoch)

## Unresolved Questions

### Required Before Stabilization

- [ ] Should we include `schedule` object in telemetry? (verbose but useful)
- [ ] Should we include `context` object? (useful for debugging)
- [ ] What happens if MQTT queue is full? (rely on MQTT node buffering?)
- [ ] Should we add a rate limiter for high-frequency automation?

### Future Possibilities

- [ ] Add telemetry batching for high-volume scenarios
- [ ] Support multiple telemetry backends (not just ThingsBoard)
- [ ] Add telemetry filtering (e.g., only send "ON" actions)
- [ ] Add compression for large payloads
- [ ] Add telemetry versioning for backward compatibility

## Implementation Plan

### Phase 1: Core Function (Week 1)

- [ ] Implement basic transformation logic
- [ ] Handle edge cases (missing data, null checks)
- [ ] Add logging for debugging

### Phase 2: Testing (Week 1)

- [ ] Create test suite with Jest (target: 20+ tests)
- [ ] Test with mock persister-schedule output
- [ ] Test edge cases (null, undefined, malformed)
- [ ] Performance test (1000 logs)

### Phase 3: Integration (Week 2)

- [ ] Connect to persister-schedule flow
- [ ] Configure MQTT node for ThingsBoard
- [ ] Test end-to-end in development environment
- [ ] Verify telemetry appears in ThingsBoard

### Phase 4: Production (Week 3)

- [ ] Deploy to staging environment
- [ ] Monitor MQTT traffic and ThingsBoard storage
- [ ] Document in README.md
- [ ] Add to TESTING.md guide

## Success Metrics

- ✅ **Functionality:** All automation logs appear in ThingsBoard within 1 second
- ✅ **Reliability:** 99.9% delivery rate (MQTT QoS 1)
- ✅ **Performance:** < 1ms processing time per log
- ✅ **Payload Size:** < 500 bytes per telemetry message
- ✅ **Test Coverage:** > 85% code coverage

## Documentation Requirements

### User-Facing

- [ ] README.md with quick start guide
- [ ] Integration guide with persister-schedule
- [ ] ThingsBoard dashboard setup instructions
- [ ] Troubleshooting guide

### Developer-Facing

- [ ] Inline code comments (English)
- [ ] Test suite documentation
- [ ] Architecture diagrams
- [ ] Performance benchmarks

## Security Considerations

1. **MQTT Authentication:** Handled by MQTT node (out of scope)
2. **Data Sanitization:** No PII in automation logs (already safe)
3. **Payload Validation:** Validate input before sending to MQTT
4. **Error Handling:** Never expose sensitive data in error messages

## Dependencies

- **Upstream:** func-002-PersistAdapter (persister-schedule)
- **Downstream:** MQTT Out node (Node-RED contrib)
- **External:** ThingsBoard server (telemetry endpoint)
- **Testing:** Jest 29.7.0 (shared from src/NODE-RED)

## Migration Strategy

### For New Deployments

1. Add func-004-TelemetryAdapter after persister-schedule
2. Configure MQTT node with ThingsBoard credentials
3. Deploy and verify telemetry in ThingsBoard

### For Existing Deployments

1. **Backward Compatible:** Function is additive, doesn't modify existing flows
2. **Opt-in:** Deploy only in flows that need telemetry export
3. **No Data Migration:** Existing logs remain in flow context

## Future Enhancements

### Post-1.0 Features

- [ ] **Telemetry Filtering:** Only send specific actions (e.g., errors only)
- [ ] **Batching:** Group multiple logs into single MQTT message
- [ ] **Compression:** Gzip payload for large logs
- [ ] **Sampling:** Send 1/N logs for high-frequency devices
- [ ] **Retry Logic:** Built-in retry for failed MQTT sends
- [ ] **Metrics Dashboard:** Send aggregated metrics (total actions/hour)

## References

1. **ThingsBoard Telemetry API:** https://thingsboard.io/docs/user-guide/telemetry/
2. **MQTT Protocol Specification:** https://mqtt.org/mqtt-specification/
3. **Node-RED MQTT Nodes:** https://flows.nodered.org/node/node-red-contrib-mqtt-broker
4. **func-002-PersistAdapter:** `../persister-schedule/src/func-002-PersistAdapter.js`
5. **Inspiration Code:** Connection status telemetry (internal reference)

## Appendix A: Complete Example

### Input (from persister-schedule)

```javascript
{
  payload: {
    key: "automation_log_HVAC_Zone1_1732445678123",
    value: {
      device: "HVAC Zone 1",
      deviceId: "hvac-zone-1",
      action: "ON",
      shouldActivate: true,
      shouldShutdown: false,
      reason: "weekday",
      schedule: {
        startHour: "08:00",
        endHour: "18:00",
        retain: true,
        holiday: false,
        daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true }
      },
      context: {
        isHolidayToday: false,
        currentWeekDay: "mon",
        holidayPolicy: "exclusive",
        totalSchedules: 1
      },
      timestamp: "2025-11-24T12:00:00.000Z",
      timestampMs: 1732445678123
    }
  }
}
```

### Output (to MQTT node)

```javascript
{
  payload: {
    "HVAC Zone 1": [{
      ts: 1732445678123,
      values: {
        automation_log: {
          action: "ON",
          shouldActivate: true,
          shouldShutdown: false,
          reason: "weekday",
          schedule: {
            startHour: "08:00",
            endHour: "18:00",
            retain: true,
            holiday: false,
            daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true }
          }
        }
      }
    }]
  }
}
```

### ThingsBoard Result

In ThingsBoard telemetry view for device "HVAC Zone 1":

| Timestamp | Key | Value |
|-----------|-----|-------|
| 2025-11-24 12:00:00 | automation_log.action | "ON" |
| 2025-11-24 12:00:00 | automation_log.shouldActivate | true |
| 2025-11-24 12:00:00 | automation_log.shouldShutdown | false |
| 2025-11-24 12:00:00 | automation_log.reason | "weekday" |

---

**Status:** Draft
**Next Review:** TBD
**Assigned Reviewers:** TBD
**Implementation Target:** Q1 2025
