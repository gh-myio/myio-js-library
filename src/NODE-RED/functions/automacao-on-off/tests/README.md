# Tests - func-001-FeriadoCheck

Unit tests for the Node-RED automation function `func-001-FeriadoCheck.js`.

## Setup

```bash
cd tests
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch

# Run with verbose output
npm run test:verbose
```

## Test Structure

### Test Categories

1. **Utility Functions** - Tests for helper functions (toISODate, safeISO, startOfDayLocal, subtractWeekDay)
2. **decide() Function** - Tests for the core decision logic with tolerance
3. **Holiday Exclusive Filtering** - Tests for holiday detection and schedule filtering
4. **Overlapping Schedules** - Tests for accumulated decisions
5. **Midnight Crossing** - Tests for overnight schedules (23:00 - 04:00)
6. **Excluded Days** - Tests for manual day exclusions
7. **Observability Output** - Tests for logging and metrics data
8. **Edge Cases** - Tests for boundary conditions and error handling
9. **Day of Week Handling** - Tests for weekday detection
10. **Holiday No Schedule** - Tests for forced shutdown behavior

### Coverage Target

- **Minimum**: 85% across all metrics (branches, functions, lines, statements)

## Files

- `jest.config.js` - Jest configuration
- `testHelper.js` - Mock utilities and helper functions
- `func-001-FeriadoCheck.test.js` - Main test suite
- `package.json` - Dependencies and scripts

## Test Helper Utilities

### Available Mocks

```javascript
const { flow, node, resetMocks, setupFlowContext } = require('./testHelper');

// flow.get() and flow.set() are mocked
// node.warn(), node.log(), node.error() are mocked
```

### Helper Functions

```javascript
const {
  createSchedule,    // Create schedule object with defaults
  createDevice,      // Create device object
  mockDate,          // Create specific date for testing
  getDayOfWeek,      // Get day abbreviation
  extractFunctions   // Get testable functions
} = require('./testHelper');
```

### Examples

```javascript
// Create a schedule
const schedule = createSchedule({
  startHour: '08:00',
  endHour: '18:00',
  retain: true,
  holiday: false,
  daysWeek: { mon: true, tue: true, wed: true }
});

// Create a specific date
const testDate = mockDate(2025, 12, 25, 10, 30); // Dec 25, 2025 10:30
```

## Test Scenarios Covered

### Scenario 1: Normal Weekday
- Device should activate during work hours (08:00-18:00)
- Device should shutdown outside work hours

### Scenario 2: Holiday with Schedule
- Only holiday-specific schedules should apply
- Normal weekday schedules are filtered out

### Scenario 3: Holiday without Schedule
- Force shutdown when no holiday-specific schedule exists
- reason = 'holiday_no_schedule'

### Scenario 4: Excluded Day
- Always shutdown regardless of schedules
- reason = 'excluded'

### Scenario 5: Overlapping Schedules
- Multiple schedules for same time period
- Accumulated decision logic
- Shutdown takes precedence in conflicts

### Scenario 6: Midnight Crossing
- Schedules that span across midnight (23:00-04:00)
- Correct handling of yesterday's schedule

### Scenario 7: Tolerance Window (retain:false)
- 30-second tolerance for exact time triggers
- Allows for slight execution delays

## Adding New Tests

1. Import test helper:
```javascript
const { ... } = require('./testHelper');
```

2. Reset mocks before each test:
```javascript
beforeEach(() => {
  resetMocks();
});
```

3. Use descriptive test names:
```javascript
test('should activate when inside time window', () => {
  // test code
});
```

## Troubleshooting

### Common Issues

1. **Tests failing on date comparison**
   - Ensure using mockDate() for consistent dates
   - Check month is 1-indexed (January = 1)

2. **Mock not being called**
   - Call resetMocks() in beforeEach
   - Check function is using the mocked globals

3. **Coverage not reaching 85%**
   - Add tests for uncovered branches
   - Check for edge cases in conditional logic

## Coverage Report

After running `npm run test:coverage`, view the HTML report:

```
tests/coverage/lcov-report/index.html
```
