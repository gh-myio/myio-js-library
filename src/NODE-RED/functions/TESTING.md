# Testing Guide - NODE-RED Functions

Unified testing structure for all NODE-RED function modules.

## 📁 Structure

```
src/NODE-RED/
├── package.json              # ✅ Centralized dependencies
├── node_modules/             # ✅ Shared across all tests
├── functions/
│   ├── automacao-on-off/
│   │   └── tests/
│   │       ├── jest.config.js
│   │       └── func-001-FeriadoCheck.test.js (41 tests)
│   ├── persister-schedule/
│   │   └── tests/
│   │       ├── jest.config.js
│   │       └── func-002-PersistAdapter.test.js (25 tests)
│   ├── log-cleanup/
│   │   └── tests/
│   │       ├── jest.config.js
│   │       └── func-003-LogCleanup.test.js (18 tests)
│   └── send-log-action-by-telemetry-per-device/
│       └── tests/
│           ├── jest.config.js
│           └── func-004-TelemetryAdapter.test.js (40 tests)
```

## 🎯 Benefits of Centralized Dependencies

### ✅ Advantages
- **Single install:** `npm install` once at NODE-RED level
- **Consistent versions:** All modules use same Jest version
- **Faster CI/CD:** No need to install dependencies multiple times
- **Smaller repo:** No duplicate `node_modules` folders
- **Easier maintenance:** Update dependencies in one place

### ❌ Old Structure (Duplicated)
```
❌ functions/automacao-on-off/tests/
   ├── package.json
   ├── node_modules/  (266 packages, ~50MB)

❌ functions/persister-schedule/tests/
   ├── package.json
   ├── node_modules/  (266 packages, ~50MB)

Total: ~100MB duplicated
```

### ✅ New Structure (Centralized)
```
✅ src/NODE-RED/
   ├── package.json
   ├── node_modules/  (266 packages, ~50MB)

✅ functions/automacao-on-off/tests/
   └── jest.config.js (uses parent node_modules)

✅ functions/persister-schedule/tests/
   └── jest.config.js (uses parent node_modules)

Total: ~50MB (50% reduction!)
```

## 🚀 Running Tests

### Install Dependencies (Once)

```bash
cd src/NODE-RED
npm install
```

### Run All Module Tests

```bash
npm run test:all-modules
```

### Run Specific Module Tests

```bash
# Test automacao-on-off module (41 tests)
npm run test:automacao

# Test persister-schedule module (25 tests)
npm run test:persister

# Test log-cleanup module (18 tests)
npm run test:log-cleanup

# Test telemetry adapter module (40 tests)
npm run test:telemetry
```

### Run Individual Test Files

```bash
# From NODE-RED directory
npx jest functions/automacao-on-off/tests/func-001-FeriadoCheck.test.js
npx jest functions/persister-schedule/tests/func-002-PersistAdapter.test.js
```

### Watch Mode

```bash
npm run test:watch
```

## 📊 Test Summary

| Module | Tests | Coverage | Status |
|--------|-------|----------|--------|
| **automacao-on-off** | 45 | >85% | ✅ |
| **persister-schedule** | 25 | >85% | ✅ |
| **log-cleanup** | 18 | >85% | ✅ |
| **telemetry-adapter** | 34 | >85% | ✅ |
| **Total** | **122** | ~85% | ✅ |

### automacao-on-off (45 tests)
- func-001-FeriadoCheck.test.js: 45 tests (includes 4 global AutoON tests)

### persister-schedule (25 tests)
- func-002-PersistAdapter.test.js: 25 tests

### log-cleanup (18 tests)
- func-003-LogCleanup.test.js: 18 tests

### telemetry-adapter (40 tests)
- func-004-TelemetryAdapter.test.js: 40 tests

## 🔧 Configuration Files

### Centralized (package.json)

Located at: `src/NODE-RED/package.json`

```json
{
  "scripts": {
    "test": "jest --verbose --coverage",
    "test:automacao": "jest --config=functions/automacao-on-off/tests/jest.config.js",
    "test:persister": "jest --config=functions/persister-schedule/tests/jest.config.js",
    "test:log-cleanup": "jest --config=functions/log-cleanup/tests/jest.config.js",
    "test:telemetry": "jest --config=functions/send-log-action-by-telemetry-per-device/tests/jest.config.js",
    "test:all-modules": "npm run test:automacao && npm run test:persister && npm run test:log-cleanup && npm run test:telemetry"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

### Module-Specific (jest.config.js)

Each module has its own `jest.config.js` for specific settings:

**automacao-on-off/tests/jest.config.js:**
```javascript
module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  testMatch: ['**/*.test.js'],
  rootDir: '.'
};
```

**persister-schedule/tests/jest.config.js:**
```javascript
module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: ['**/*.test.js'],
  rootDir: '.'
};
```

## 📝 Adding New Tests

### 1. Create Test File

```bash
# Example: new module
mkdir -p functions/new-module/tests
touch functions/new-module/tests/func-new.test.js
```

### 2. Create Jest Config

```bash
cp functions/automacao-on-off/tests/jest.config.js \
   functions/new-module/tests/jest.config.js
```

### 3. Add Script to package.json

```json
{
  "scripts": {
    "test:new-module": "jest --config=functions/new-module/tests/jest.config.js"
  }
}
```

### 4. Run Tests

```bash
npm run test:new-module
```

## 🔍 Troubleshooting

### Cannot find module 'jest'

**Problem:** Jest not installed

**Solution:**
```bash
cd src/NODE-RED
npm install
```

### Tests not found

**Problem:** Wrong path in jest.config.js

**Solution:** Check `rootDir` in jest.config.js points to test directory

### Coverage threshold not met

**Problem:** Code coverage below threshold

**Solution:** Add more tests or lower threshold in jest.config.js

## 📚 Test Patterns

### Mock Flow Context

```javascript
function createMockFlow() {
  const storage = {};
  return {
    get: jest.fn((key) => storage[key]),
    set: jest.fn((key, value) => {
      storage[key] = value;
    }),
    _storage: storage
  };
}
```

### Mock Node Context

```javascript
function createMockNode() {
  const logs = [];
  const errors = [];
  return {
    log: jest.fn((message) => logs.push(message)),
    error: jest.fn((message) => errors.push(message)),
    _logs: logs,
    _errors: errors
  };
}
```

### Test Structure

```javascript
describe('Module Name - Feature', () => {
  let msg, flow, node;

  beforeEach(() => {
    flow = createMockFlow();
    node = createMockNode();
    msg = {};
  });

  describe('Category 1: Basic Tests ✅', () => {
    test('✅ Should do something', () => {
      // Arrange
      msg.payload = { data: 'test' };

      // Act
      const result = functionUnderTest(msg, flow, node);

      // Assert
      expect(result).not.toBeNull();
    });
  });
});
```

## 🎯 Best Practices

1. **✅ Use centralized dependencies** - Install at NODE-RED level
2. **✅ Module-specific configs** - Each module has its own jest.config.js
3. **✅ Clear test categories** - Organize tests by functionality
4. **✅ Meaningful names** - Use descriptive test names with ✅/❌
5. **✅ Mock external dependencies** - Mock flow/node contexts
6. **✅ Test edge cases** - Include null, undefined, malformed data
7. **✅ Coverage thresholds** - Maintain >80% coverage
8. **✅ Fast tests** - Keep tests under 10s total

## 📊 CI/CD Integration

### GitHub Actions Example

```yaml
name: Node-RED Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: cd src/NODE-RED && npm install
      - run: cd src/NODE-RED && npm run test:all-modules
```

## 🔗 Related Documentation

- `functions/automacao-on-off/README.md` - Automation module docs
- `functions/persister-schedule/README.md` - Persistence module docs
- `functions/log-cleanup/README.md` - Log cleanup module docs
- `functions/send-log-action-by-telemetry-per-device/README.md` - Telemetry adapter docs
- `functions/send-log-action-by-telemetry-per-device/docs/RFC-0001-telemetry-automation-logs.md` - Telemetry RFC

---

**Last Updated:** 2025-11-24
**Total Tests:** 122 (45 + 25 + 18 + 34)
**Status:** ✅ All Passing
