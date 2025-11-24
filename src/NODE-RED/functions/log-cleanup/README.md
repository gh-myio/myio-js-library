# Log Cleanup - Automation Log Retention

Node-RED function for automatic cleanup of automation logs with configurable retention policy.

## 📁 Directory Structure

```
log-cleanup/
├── README.md                          # This file
├── src/
│   └── func-003-LogCleanup.js        # Log cleanup function
├── tests/
│   ├── func-003-LogCleanup.test.js   # Test suite (18 tests)
│   └── jest.config.js                # Jest configuration
├── docs/
│   └── LOG-RETENTION-STRATEGY.md     # Detailed retention strategy
└── bkp/                               # Backup files per unit
```

## 🎯 Purpose

This module handles **automatic cleanup of automation logs** to prevent unlimited growth and save storage space.

**Key Features:**
- ✅ **Time-based retention** - Keep only last N days
- ✅ **Configurable policy** - Adjust retention period
- ✅ **Safe operation** - Keeps logs without timestamps
- ✅ **Statistics reporting** - Returns deleted/retained counts
- ✅ **Performance** - Handles 1000+ logs in <1s

**Default Policy:** Keep last 4 days (D-3, D-2, D-1, D0)

## 🚀 Quick Start

### Node-RED Flow Setup

```
[Inject (daily 02:00 AM)] → [func-003-LogCleanup] → [Debug]
```

**Inject Node Configuration:**
- **Repeat:** at a specific time
- **Time:** 02:00 AM (low-traffic hours)
- **On specific days:** Every day

**Input:** None required (reads from flow)

**Output:**
```javascript
{
  success: true,
  stats: {
    totalBefore: 5000,
    totalAfter: 450,
    deleted: 4550,        // Removed 4550 old logs
    retained: 450,        // Kept 450 recent logs
    cutoffDate: "2025-11-20T00:00:00.000Z",
    daysKept: 4,
    executedAt: "2025-11-24T02:00:00.000Z"
  }
}
```

## 📝 How It Works

### 1. Retention Logic

```
┌─────────────────────────────────────────────────┐
│ Timeline                                        │
├─────────────────────────────────────────────────┤
│  D-7  D-6  D-5  D-4  │  D-3  D-2  D-1  D0     │
│  ❌   ❌   ❌   ❌   │  ✅   ✅   ✅   ✅     │
│                      │                          │
│     DELETE           │      KEEP                │
│    (4+ days old)     │   (last 4 days)         │
└─────────────────────────────────────────────────┘
```

**Cutoff Calculation:**
```javascript
const DAYS_TO_KEEP = 4;
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - (DAYS_TO_KEEP - 1));
cutoffDate.setHours(0, 0, 0, 0);
// Example: If today is 2025-11-24, cutoff is 2025-11-21 00:00:00
```

### 2. Process Flow

```
Read flow.get('automation_logs')
        ↓
Extract timestamp from key/logData
        ↓
Compare with cutoff date
        ↓
Keep if >= cutoff, delete if < cutoff
        ↓
Update flow.set('automation_logs')
        ↓
Return statistics
```

### 3. Timestamp Sources

**Priority order:**
1. Log key: `automation_log_DeviceName_1732445678123` (extract timestamp)
2. LogData.timestampMs: `1732445678123`
3. LogData.timestamp: `"2025-11-24T12:00:00.000Z"`
4. **No timestamp:** Keep for safety (won't delete)

## 🔧 Configuration

### Change Retention Period

Edit `func-003-LogCleanup.js`:

```javascript
const DAYS_TO_KEEP = 4;  // Default: 4 days

// Examples:
// 2 days:  const DAYS_TO_KEEP = 2;
// 7 days:  const DAYS_TO_KEEP = 7;
// 14 days: const DAYS_TO_KEEP = 14;
```

### Execution Schedule

**Recommended:** Daily at 02:00 AM (low-traffic)

**Alternatives:**
- Weekly: Sunday 02:00 AM (for longer retention)
- Manual: On-demand via inject button
- Triggered: After specific events

## 📊 Storage Impact

### Estimated Savings

**Scenario:** 100 devices, 288 events/day per device

| Retention | Total Logs | Storage | Savings |
|-----------|-----------|---------|---------|
| **30 days** | 864,000 | ~500 MB | Baseline |
| **7 days** | 201,600 | ~117 MB | 77% |
| **4 days** (default) | 115,200 | ~67 MB | 87% |
| **2 days** | 57,600 | ~33 MB | 93% |

**Default (4 days) = 87% space reduction!**

## 🧪 Testing

### Run Tests

```bash
cd src/NODE-RED
npm run test:log-cleanup
```

**Expected Output:**
```
Test Suites: 1 passed, 1 total
Tests:       18 passed, 18 total
Time:        ~6s
```

### Test Coverage

**func-003-LogCleanup.test.js (18 tests):**

| Category | Tests | Description |
|----------|-------|-------------|
| **Retenção Básica** | 7 | D0 to D-30 retention |
| **Múltiplos Logs** | 3 | Multiple logs, mixed ages |
| **Edge Cases** | 4 | Empty logs, no timestamp, malformed |
| **Volume de Dados** | 2 | 100 logs, 1000 logs performance |
| **Configuração** | 2 | Custom retention periods |

## 🚨 Troubleshooting

### Cleanup Not Running

**Check:**
1. ✅ Inject node configured correctly?
2. ✅ Inject node connected to func-003-LogCleanup?
3. ✅ Check Node-RED logs for errors
4. ✅ Test manual execution (click inject button)

**Debug:**
```javascript
// Add to start of func-003-LogCleanup.js
const logsCount = Object.keys(flow.get('automation_logs') || {}).length;
node.warn(`Starting cleanup with ${logsCount} logs`);
```

### No Logs Being Deleted

**Possible causes:**
1. All logs are within retention period (expected behavior)
2. Logs don't have timestamps (kept for safety)
3. Cutoff date calculation error

**Verify:**
```javascript
// Check cutoff date
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 3);
node.warn(`Cutoff: ${cutoffDate.toISOString()}`);
```

### Too Many Logs Deleted

**Check:**
1. ✅ `DAYS_TO_KEEP` configured correctly?
2. ✅ Server timezone correct?
3. ✅ Timestamps in logs are valid?

## 📈 Performance

- **Processing time:** < 1s for 1000 logs
- **Memory usage:** Minimal (in-place filtering)
- **Impact:** Runs in background, no user interruption

**Benchmark:**
```
100 logs:   ~5ms
1000 logs:  ~15ms (tested)
10000 logs: ~150ms (estimated)
```

## 🔗 Integration

### With Automation Module

Cleans logs created by:
- `automacao-on-off/func-001-FeriadoCheck.js`
- `persister-schedule/func-002-PersistAdapter.js`

**Log format:**
```javascript
flow.get('automation_logs') = {
  "automation_log_Device1_1732445678123": {
    device: "Device1",
    action: "ON",
    timestamp: "2025-11-24T12:00:00.000Z",
    timestampMs: 1732445678123
  },
  // ... more logs
}
```

### With Monitoring Dashboard

Statistics can be sent to dashboard for monitoring:
- Total logs before/after cleanup
- Deleted count
- Retention policy effectiveness

## 📚 Documentation

### Key Documents

- `docs/LOG-RETENTION-STRATEGY.md` - Complete retention strategy guide
- `../automacao-on-off/README.md` - Automation module (creates logs)
- `../persister-schedule/README.md` - Persistence module (stores logs)

### Code References

- `src/func-003-LogCleanup.js:14` - `DAYS_TO_KEEP` configuration
- `src/func-003-LogCleanup.js:21-26` - Cutoff date calculation
- `src/func-003-LogCleanup.js:34-68` - Filtering logic

## 🏢 Unit Backups

Backup files can be stored in `bkp/{UNIT}/` (same structure as other modules).

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-24 | Initial separation from automacao-on-off |
| 1.0.0 | 2025-11-23 | Original implementation |

## 📝 Best Practices

### Do's ✅
- ✅ Run daily in low-traffic hours (02:00 AM)
- ✅ Monitor statistics after first execution
- ✅ Keep at least 2-3 days for troubleshooting
- ✅ Test in development first
- ✅ Back up logs before major changes

### Don'ts ❌
- ❌ Don't set DAYS_TO_KEEP < 2 (too aggressive)
- ❌ Don't run every minute (unnecessary)
- ❌ Don't manually edit automation_logs (use cleanup)
- ❌ Don't delete logs with ongoing investigations

## 🎯 Future Enhancements

- [ ] Export deleted logs to archive before removal
- [ ] Compress old logs (D-2, D-3) instead of deleting
- [ ] Support for multiple retention policies per device
- [ ] Automatic adjustment based on storage limits
- [ ] Integration with external log aggregation tools

## 🔐 Safety Features

1. **Keeps logs without timestamps** - Won't delete if uncertain
2. **Returns detailed statistics** - Full visibility of operation
3. **Non-destructive on error** - Returns null, doesn't update on failure
4. **Configurable** - Easy to adjust without code changes

---

**Version:** 1.0.0
**Last Updated:** 2025-11-24
**Test Coverage:** 18 tests passing (100%)
**Status:** ✅ Production Ready
**Dependencies:** None (standalone module)
**Used by:** automacao-on-off, persister-schedule
