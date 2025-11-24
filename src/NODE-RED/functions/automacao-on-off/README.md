# Automation On/Off - Schedule Engine

Node-RED automation functions for device scheduling with holiday support, timezone handling, and midnight crossing logic.

## 📁 Directory Structure

```
automacao-on-off/
├── README.md                          # This file
├── src/
│   ├── func-001-FeriadoCheck.js      # Main schedule processing function
│   └── func-003-LogCleanup.js        # Log retention/cleanup function
├── lib/
│   ├── scheduleEngine.js             # Core testable logic
│   └── utilities.js                  # Date/time utilities
├── tests/
│   ├── func-001-FeriadoCheck.test.js # Main test suite (41 tests)
│   ├── func-003-LogCleanup.test.js   # Log cleanup tests (18 tests)
│   ├── jest.config.js                # Jest configuration
│   ├── package.json                  # Test dependencies
│   └── testHelper.js                 # Test utilities
├── bkp/                              # Backup files per unit
│   ├── README.md                     # Backup documentation
│   ├── BENFICA/
│   ├── CAXIAS/
│   ├── GUADALUPE/
│   ├── JACAREPAGUA/
│   ├── MESQUITA/
│   ├── MOOCA/
│   ├── PIRACICABA/
│   ├── PRAIA-GRANDE/
│   └── SUZANO/
└── docs/                             # Documentation
    ├── ANALISE-MIDNIGHT-CROSSING.md
    ├── BUG-FIX-HOLIDAY-FILTER.md
    ├── BUG-FIX-MIDNIGHT-TODOS-DIAS.md
    ├── LOG-RETENTION-STRATEGY.md
    ├── OBSERVABILIDADE.md
    ├── PLANO-DE-ACAO.md
    └── RESUMO-FINAL-TESTES.md
```

## 🎯 Purpose

This module handles **automated device scheduling** for myio units, including:

- ✅ **Time-based activation/deactivation** of equipment
- ✅ **Holiday schedule support** with exclusive/inclusive policies
- ✅ **Midnight crossing logic** (schedules spanning multiple days)
- ✅ **Timezone conversion** (UTC → São Paulo UTC-3)
- ✅ **Day exclusion** (specific dates to override schedules)
- ✅ **Observability/logging** for troubleshooting
- ✅ **Log retention strategy** (D-3, D-2, D-1, D0)

## 🚀 Quick Start

### 1. Main Schedule Function (func-001-FeriadoCheck.js)

**Node-RED Setup:**
```
[Inject (every 5 min)] → [func-001-FeriadoCheck] → [Switch (shouldActivate/shouldShutdown)] → [MQTT Out]
```

**Flow Variables Required:**
```javascript
flow.get('devices')             // Device list
flow.get('stored_schedules')    // Schedules per device
flow.get('stored_excludedDays') // Excluded dates per device
flow.get('stored_holidays')     // Holiday dates (YYYY-MM-DD array)
flow.get('holiday_policy')      // 'exclusive' (default) or 'inclusive'
```

**Output:**
```javascript
{
  deviceName: "Device 1",
  shouldActivate: true,   // Should turn ON
  shouldShutdown: false,  // Should turn OFF
  payload: {
    device: {...},
    schedules: [...],
    currWeekDay: "sat",
    isHolidayToday: false
  }
}
```

### 2. Log Cleanup Function (func-003-LogCleanup.js)

**Node-RED Setup:**
```
[Inject (daily 02:00 AM)] → [func-003-LogCleanup] → [Debug]
```

**Purpose:** Removes logs older than 4 days to save space.

**Output:**
```javascript
{
  success: true,
  stats: {
    totalBefore: 5000,
    totalAfter: 450,
    deleted: 4550,
    retained: 450,
    cutoffDate: "2025-11-20T00:00:00.000Z",
    daysKept: 4
  }
}
```

## 📝 Core Concepts

### Schedule Format

```javascript
{
  startHour: "17:30",    // Start time (24h format)
  endHour: "05:30",      // End time (can cross midnight)
  retain: true,          // true = maintain state, false = pulse mode
  holiday: false,        // true = holiday schedule, false = normal days
  daysWeek: {            // Active days of week
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: true,
    sun: true
  }
}
```

### Holiday Policy

**Exclusive (default):**
- On holidays: Only schedules with `holiday: true` are active
- On normal days: Only schedules with `holiday: false` are active

**With `holiday: true` + `daysWeek`:**
- Functions on **both** holidays AND marked weekdays
- More flexible, allows "always on" schedules

### Midnight Crossing

Schedules like `17:30-05:30` span two days:
- **Saturday 18:00** → Activates (within Sat 17:30 - Sun 05:30)
- **Sunday 02:00** → Activates (still within window)
- **Sunday 06:00** → Deactivates (past 05:30)

### Excluded Days

Specific dates that **override all schedules**:
```javascript
excludedDays: ["2025-12-25", "2025-01-01"]
// Equipment will be OFF on these dates regardless of schedules
```

## 🧪 Testing

### Run All Tests

```bash
cd src/NODE-RED/functions/automacao-on-off/tests
npm test
```

**Expected Output:**
```
Test Suites: 2 passed, 2 total
Tests:       59 passed, 59 total (41 + 18)
Time:        ~8s
```

### Test Coverage

**func-001-FeriadoCheck.test.js (41 tests):**
- Holiday mandatory filtering
- Time comparisons
- Midnight crossing
- Excluded days
- Retain mode
- Multiple schedules
- Edge cases
- Real production scenarios
- Bug fixes validation

**func-003-LogCleanup.test.js (18 tests):**
- Log retention (D0 to D-30)
- Multiple logs
- Edge cases
- Performance (1000 logs)
- Custom configuration

## 📊 Performance

- **Schedule processing:** < 10ms per device
- **Log cleanup:** < 1s for 1000 logs
- **Memory usage:** Minimal (stateless processing)

## 🔧 Configuration

### Adjust Log Retention

Edit `func-003-LogCleanup.js`:
```javascript
const DAYS_TO_KEEP = 4;  // Change to 2, 7, 14, etc.
```

### Change Holiday Policy

```javascript
flow.set('holiday_policy', 'exclusive');  // or 'inclusive'
```

## 📚 Documentation

Detailed docs in `docs/` folder:

| Document | Purpose |
|----------|---------|
| **ANALISE-MIDNIGHT-CROSSING.md** | Midnight crossing logic analysis |
| **BUG-FIX-HOLIDAY-FILTER.md** | Holiday filter fix documentation |
| **BUG-FIX-MIDNIGHT-TODOS-DIAS.md** | "All days active" bug fix |
| **LOG-RETENTION-STRATEGY.md** | Log cleanup strategy (D-3 to D0) |
| **OBSERVABILIDADE.md** | Observability/logging system |
| **PLANO-DE-ACAO.md** | Action plan and recommendations |
| **RESUMO-FINAL-TESTES.md** | Test summary (59 tests) |

## 🏢 Unit Backups

Production code backups stored in `bkp/{UNIT}/`:

- BENFICA
- CAXIAS
- GUADALUPE
- JACAREPAGUA
- MESQUITA
- MOOCA
- PIRACICABA
- PRAIA-GRANDE
- SUZANO

See `bkp/README.md` for backup procedures.

## 🐛 Known Issues & Fixes

### ✅ Fixed Issues

1. **Midnight Crossing with All Days Active** (2025-11-23)
   - Bug: Equipment not activating when all weekdays marked
   - Fix: Removed `!acted` condition, changed precedence to "activate wins"
   - Tests: `BUG-FIX-MIDNIGHT-TODOS-DIAS.md`

2. **Holiday Filter Removing Valid Schedules** (2025-11-23)
   - Bug: Schedules with `holiday: true` + `daysWeek` removed on normal days
   - Fix: Changed filter to be inclusive instead of exclusive
   - Tests: `BUG-FIX-HOLIDAY-FILTER.md`

## 🚨 Troubleshooting

### Schedule Not Activating

1. Check `flow.get('stored_schedules')` has entries
2. Verify `daysWeek` includes current day
3. Check if today is in `excludedDays`
4. Verify time is within startHour-endHour window
5. Check `holiday` flag matches current day type

### Midnight Crossing Issues

1. Ensure both days (yesterday + today) are marked in `daysWeek`
2. Check timezone conversion is correct (UTC → São Paulo)
3. Verify `retain: true` for continuous operation

### Log Cleanup Not Working

1. Check inject node cron configuration
2. Verify `flow.get('automation_logs')` exists
3. Check Node-RED logs for errors
4. Test manual execution first

## 🔗 Related Modules

- **persister-schedule**: Persists automation logs to database
- **../../../thingsboard/**: ThingsBoard dashboard integration

## 📞 Support

For issues or questions:
1. Check documentation in `docs/` folder
2. Review test files for usage examples
3. Check `bkp/{UNIT}/` for production code references
4. Contact myio development team

---

**Version:** 2.0.0
**Last Updated:** 2025-11-24
**Test Coverage:** 59 tests passing (100%)
**Status:** ✅ Production Ready
