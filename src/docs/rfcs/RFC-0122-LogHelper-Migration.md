# RFC-0122: LogHelper Migration and Enhancement

- **Feature Name**: `log_helper_migration`
- **Start Date**: 2026-01-04
- **RFC PR**: N/A
- **Status**: Draft

## Summary

Migrate the `LogHelper` utility from `MAIN_UNIQUE_DATASOURCE/controller.js` to a reusable library module (`src/utils/logUtils.js`) with enhanced configuration capabilities for contextual logging.

## Motivation

The current `LogHelper` implementation in MAIN has several limitations:

1. **Duplication**: The same logging pattern is duplicated across multiple widgets
2. **No Context**: Logs lack contextual information (widget name, function, domain, device)
3. **Hard to Debug**: When multiple widgets log simultaneously, it's difficult to trace the source
4. **No Configuration**: Cannot dynamically adjust logging behavior per instance

### Current Implementation

```javascript
// In MAIN_UNIQUE_DATASOURCE/controller.js
const LogHelper = {
  log: function (...args) {
    if (DEBUG_ACTIVE) {
      console.log(...args);
    }
  },
  warn: function (...args) {
    if (DEBUG_ACTIVE) {
      console.warn(...args);
    }
  },
  error: function (...args) {
    // Errors always logged regardless of DEBUG_ACTIVE
    console.error(...args);
  },
};
```

### Problems

- No way to identify which widget/function generated the log
- No structured metadata in log output
- Cannot filter logs by context in browser console
- No support for different log levels per context

## Guide-level Explanation

### Basic Usage

```javascript
import { createLogHelper } from 'myio-js-library';

// Create a basic logger
const logger = createLogHelper();

logger.log('Simple message');
// Output: Simple message

logger.warn('Warning message');
// Output: Warning message

logger.error('Error message');
// Output: Error message (always logged)
```

### Contextual Logging

```javascript
import { createLogHelper } from 'myio-js-library';

// Create logger with context configuration
const logger = createLogHelper({
  widget: 'MAIN_UNIQUE_DATASOURCE',
  function: 'fetchCredentialsFromThingsBoard',
});

logger.log('Fetching credentials...');
// Output: [WIDGET: MAIN_UNIQUE_DATASOURCE][FUNCTION: fetchCredentialsFromThingsBoard] Fetching credentials...

logger.error('Failed to fetch');
// Output: [WIDGET: MAIN_UNIQUE_DATASOURCE][FUNCTION: fetchCredentialsFromThingsBoard] Failed to fetch
```

### Dynamic Context Updates

```javascript
const logger = createLogHelper({ widget: 'TELEMETRY_GRID' });

// Update context for specific operations
logger.setConfig({ domain: 'water', device: '3F_MEDIDOR_001' });

logger.log('Processing device data');
// Output: [WIDGET: TELEMETRY_GRID][DOMAIN: water][DEVICE: 3F_MEDIDOR_001] Processing device data

// Clear specific context keys
logger.clearConfig(['device']);

logger.log('Domain-level operation');
// Output: [WIDGET: TELEMETRY_GRID][DOMAIN: water] Domain-level operation

// Reset all context
logger.resetConfig();

logger.log('Back to widget only');
// Output: [WIDGET: TELEMETRY_GRID] Back to widget only
```

### Debug Mode Control

```javascript
const logger = createLogHelper({
  widget: 'HEADER',
  debugActive: false, // Disable debug logs
});

logger.log('This will NOT be logged');
logger.warn('This will NOT be logged');
logger.error('This WILL be logged'); // Errors always log

// Enable debug mode dynamically
logger.setDebugActive(true);

logger.log('Now this will be logged');
```

### Integration with MAIN

```javascript
// In MAIN_UNIQUE_DATASOURCE/controller.js
const LogHelper = MyIOLibrary.createLogHelper({
  widget: 'MAIN_UNIQUE_DATASOURCE',
  debugActive: settings.enableDebugMode,
});

// In specific functions
function fetchCredentialsFromThingsBoard() {
  LogHelper.setConfig({ function: 'fetchCredentialsFromThingsBoard' });

  LogHelper.log('Starting credential fetch...');
  // Output: [WIDGET: MAIN_UNIQUE_DATASOURCE][FUNCTION: fetchCredentialsFromThingsBoard] Starting credential fetch...

  // ... function logic ...

  LogHelper.clearConfig(['function']); // Clean up function context
}
```

## Reference-level Explanation

### File Structure

```
src/utils/
└── logUtils.js          # LogHelper implementation
```

### Types

```typescript
interface LogConfig {
  /** Widget or component name */
  widget?: string;
  /** Function or method name */
  function?: string;
  /** Domain context (energy, water, temperature) */
  domain?: string;
  /** Device identifier */
  device?: string;
  /** Custom context keys */
  [key: string]: string | undefined;
}

interface LogHelperOptions {
  /** Initial context configuration */
  config?: LogConfig;
  /** Whether debug logging is active (default: true) */
  debugActive?: boolean;
  /** Custom prefix format function */
  formatPrefix?: (config: LogConfig) => string;
}

interface LogHelper {
  /** Log message (respects debugActive) */
  log: (...args: any[]) => void;
  /** Log warning (respects debugActive) */
  warn: (...args: any[]) => void;
  /** Log error (always logs) */
  error: (...args: any[]) => void;
  /** Update context configuration */
  setConfig: (config: LogConfig) => void;
  /** Clear specific config keys */
  clearConfig: (keys: string[]) => void;
  /** Reset to initial configuration */
  resetConfig: () => void;
  /** Set debug active state */
  setDebugActive: (active: boolean) => void;
  /** Get current debug active state */
  isDebugActive: () => boolean;
  /** Get current configuration */
  getConfig: () => LogConfig;
}
```

### Implementation

```javascript
/**
 * Create a LogHelper instance with optional context configuration
 *
 * @param {LogHelperOptions} options - Configuration options
 * @returns {LogHelper} LogHelper instance
 */
export function createLogHelper(options = {}) {
  const {
    config: initialConfig = {},
    debugActive: initialDebugActive = true,
    formatPrefix = defaultFormatPrefix,
  } = options;

  let currentConfig = { ...initialConfig };
  let debugActive = initialDebugActive;

  /**
   * Default prefix formatter
   * Converts config to [KEY: value] format with uppercase keys
   */
  function defaultFormatPrefix(config) {
    const entries = Object.entries(config).filter(([_, v]) => v !== undefined);
    if (entries.length === 0) return '';

    return entries
      .map(([key, value]) => `[${key.toUpperCase()}: ${value}]`)
      .join('') + ' ';
  }

  /**
   * Build prefix from current config
   */
  function getPrefix() {
    return formatPrefix(currentConfig);
  }

  return {
    log(...args) {
      if (debugActive) {
        const prefix = getPrefix();
        if (prefix) {
          console.log(prefix, ...args);
        } else {
          console.log(...args);
        }
      }
    },

    warn(...args) {
      if (debugActive) {
        const prefix = getPrefix();
        if (prefix) {
          console.warn(prefix, ...args);
        } else {
          console.warn(...args);
        }
      }
    },

    error(...args) {
      // Errors always logged regardless of debugActive
      const prefix = getPrefix();
      if (prefix) {
        console.error(prefix, ...args);
      } else {
        console.error(...args);
      }
    },

    setConfig(config) {
      currentConfig = { ...currentConfig, ...config };
    },

    clearConfig(keys) {
      keys.forEach(key => {
        delete currentConfig[key];
      });
    },

    resetConfig() {
      currentConfig = { ...initialConfig };
    },

    setDebugActive(active) {
      debugActive = active;
    },

    isDebugActive() {
      return debugActive;
    },

    getConfig() {
      return { ...currentConfig };
    },
  };
}
```

### Prefix Format Examples

| Config | Output Prefix |
|--------|---------------|
| `{ widget: 'MAIN' }` | `[WIDGET: MAIN] ` |
| `{ widget: 'MAIN', function: 'init' }` | `[WIDGET: MAIN][FUNCTION: init] ` |
| `{ domain: 'water', device: '3F_001' }` | `[DOMAIN: water][DEVICE: 3F_001] ` |
| `{}` (empty) | `` (no prefix) |

### Export from Library

```typescript
// src/index.ts
export { createLogHelper } from './utils/logUtils.js';
export type { LogConfig, LogHelperOptions, LogHelper } from './utils/logUtils.js';
```

### Migration in MAIN

```javascript
// Before (in MAIN_UNIQUE_DATASOURCE/controller.js)
const LogHelper = {
  log: function (...args) {
    if (DEBUG_ACTIVE) {
      console.log(...args);
    }
  },
  // ...
};

// After
const LogHelper = (() => {
  const lib = window.MyIOLibrary;
  if (!lib?.createLogHelper) {
    console.error('createLogHelper: MyIOLibrary not available');
    // Minimal fallback for critical errors only
    return {
      log: () => {},
      warn: () => {},
      error: (...args) => console.error(...args),
      setConfig: () => {},
      clearConfig: () => {},
      resetConfig: () => {},
      setDebugActive: () => {},
      isDebugActive: () => false,
      getConfig: () => ({}),
    };
  }
  return lib.createLogHelper({
    widget: 'MAIN_UNIQUE_DATASOURCE',
    debugActive: DEBUG_ACTIVE,
  });
})();
```

## Drawbacks

1. **Slight overhead**: Prefix generation on every log call (minimal impact)
2. **Breaking change**: Existing code using `LogHelper.log()` needs to handle new instance creation
3. **Memory**: Each logger instance maintains its own config state

## Rationale and Alternatives

### Why factory function instead of singleton?

A factory function allows:
- Multiple loggers with different contexts
- Isolated configuration per widget/component
- Better testability (can mock individual instances)

### Alternatives Considered

1. **Global singleton logger**: Rejected because it doesn't support per-widget context
2. **Class-based Logger**: Rejected for simplicity; factory function is sufficient
3. **External logging library (winston, pino)**: Rejected to minimize dependencies and bundle size

## Prior Art

- [debug](https://www.npmjs.com/package/debug) - Namespace-based logging
- [loglevel](https://www.npmjs.com/package/loglevel) - Minimal logging with levels
- [pino](https://www.npmjs.com/package/pino) - Structured JSON logging

## Unresolved Questions

1. Should we support log levels (debug, info, warn, error)?
2. Should we add timestamp to prefix?
3. Should we support structured JSON output for production?
4. Should we add log persistence (localStorage/IndexedDB)?

## Future Possibilities

1. **Log Levels**: Add `debug`, `info`, `trace` levels with configurable verbosity
2. **Remote Logging**: Send critical errors to a remote endpoint
3. **Log Filtering**: Browser extension or console filter integration
4. **Performance Timing**: Add `time()` and `timeEnd()` methods for profiling
5. **Log Groups**: Support `console.group()` and `console.groupEnd()`

## Appendix: Console Usage Map

Current `console.log`, `console.warn`, and `console.error` usage across the codebase that should be migrated to use `createLogHelper`.

### src/components/

| File | Type | Count | Notes |
|------|------|-------|-------|
| `menu/MenuView.ts` | log | 20 | Debug logs with `[MenuView]` prefix |
| `menu/MenuController.ts` | log/warn | 18 | Debug logs with `[MenuController]` prefix |
| `temperature/TemperatureModal.ts` | error/log/warn | 5 | Error handling and debug |
| `temperature/TemperatureComparisonModal.ts` | error/warn/log | 4 | Error handling |
| `temperature/utils.ts` | warn | 1 | Export warning |
| `DemandModal.ts` | log/warn/error | 12 | Real-time mode, export, errors |
| `RealTimeTelemetryModal.ts` | warn/error | 2 | Chart.js and fetch errors |
| `createInputDateRangePickerInsideDIV.ts` | log/warn/error | 8 | Initialization and cleanup |
| `createDateRangePicker.ts` | error | 1 | Invalid input error |
| `DistributionChart/createDistributionChartWidget.ts` | log/warn/error | 4 | Chart updates |
| `Consumption7DaysChart/createConsumptionModal.ts` | warn | 1 | Export format warning |
| `ExportData/index.ts` | error | 1 | Export failed |
| `GoalsPanel.js` | log/error | 2 | Loading and save errors |
| `SelectionStore.js` | log | 1 | Debug mode toggle |
| `MyIOToast.js` | warn | 1 | Invalid type warning |
| `MockTelemetryGenerator.ts` | log | 3 | Mock data generation |
| `footer/FooterController.ts` | log/warn/error | 3 | Custom logger pattern |
| `footer/ComparisonHandler.ts` | log/warn/error | 3 | Custom logger pattern |
| `telemetry-grid/*.ts` | log | 3 | Debug logs with prefix |
| `premium-modals/header/createHeaderComponent.ts` | log | 1 | Debug mode |
| `premium-modals/report-device/DeviceReportModal.ts` | log/warn/error | 4 | Data loading |
| `premium-modals/report-all/AllReportModal.ts` | log | 1 | Debug mode |
| `premium-modals/measurement-setup/openMeasurementSetupModal.ts` | error | 1 | Form loading error |
| `premium-modals/contract-devices/openContractDevicesModal.ts` | log | 1 | Example in docs |
| `ModalHeader/index.ts` | log | 4 | Examples in docs only |

### src/utils/

| File | Type | Count | Notes |
|------|------|-------|-------|
| `logHelper.js` | log/warn/error | 3 | **Existing LogHelper** (basic) |
| `superAdminUtils.ts` | log/warn/error | 10 | API calls and detection |
| `AnnotationIndicator.ts` | error | 1 | Loading error |
| `deviceType.js` | warn | 1 | Context not found |
| `EnergySummaryTooltip.ts` | error/warn | 2 | Tooltip errors, debug |
| `WaterSummaryTooltip.ts` | error | 1 | Tooltip error |
| `InfoTooltip.ts` | log | 2 | Safety timeout, destroy |

### src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/

| Widget | Type | Count | Notes |
|--------|------|-------|-------|
| `MAIN_VIEW/controller.js` | log/warn/error | 10 | Custom LogHelper pattern |
| `HEADER/controller.js` | log/warn/error | 6 | Custom LogHelper with `[HEADER]` prefix |
| `FOOTER/controller.js` | log/warn/error | 5 | Custom LogHelper with `[FOOTER]` prefix |
| `MENU/controller.js` | log/warn/error | 7 | Custom LogHelper + debug logs |
| `TELEMETRY/controller.js` | log/warn/error | 30+ | RFC-0071 sync, debug, errors |
| `TELEMETRY_INFO/controller.js` | log/warn/error | 25+ | Modal operations, tooltips |

### Summary Statistics

| Category | Files | console.log | console.warn | console.error |
|----------|-------|-------------|--------------|---------------|
| components/ | 25+ | ~70 | ~15 | ~20 |
| utils/ | 7 | ~5 | ~8 | ~5 |
| WIDGET/ | 6 | ~50 | ~15 | ~20 |
| **Total** | **38+** | **~125** | **~38** | **~45** |

### Existing LogHelper Patterns

Several files already use a LogHelper-like pattern:

```javascript
// Pattern 1: WIDGET controllers (HEADER, FOOTER, TELEMETRY_INFO)
const LogHelper = {
  log: (...args) => console.log('[WIDGET_NAME]', ...args),
  warn: (...args) => console.warn('[WIDGET_NAME]', ...args),
  error: (...args) => console.error('[WIDGET_NAME]', ...args),
};

// Pattern 2: FooterController.ts, ComparisonHandler.ts
const logger = {
  log: (...args: unknown[]) => debug && console.log(prefix, ...args),
  warn: (...args: unknown[]) => debug && console.warn(prefix, ...args),
  error: (...args: unknown[]) => console.error(prefix, ...args),
};

// Pattern 3: MAIN_VIEW (with DEBUG_ACTIVE check)
const LogHelper = {
  log: function (...args) {
    if (DEBUG_ACTIVE) console.log(...args);
  },
  // ...
};
```

### Migration Priority

1. **High Priority** (standardize existing LogHelper patterns):
   - `MAIN_VIEW/controller.js`
   - `HEADER/controller.js`
   - `FOOTER/controller.js`
   - `TELEMETRY/controller.js`
   - `TELEMETRY_INFO/controller.js`

2. **Medium Priority** (heavy console usage):
   - `menu/MenuView.ts`
   - `menu/MenuController.ts`
   - `DemandModal.ts`
   - `superAdminUtils.ts`

3. **Low Priority** (sparse usage):
   - Components with 1-3 console calls
   - Documentation examples

## Implementation Checklist

- [x] ~~Create `src/utils/logUtils.js`~~ Enhanced existing `src/utils/logHelper.js` with `createLogHelper`
- [x] Export from `src/index.ts`
- [x] Update MAIN_UNIQUE_DATASOURCE to use library version (`src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js`)
- [ ] Update other widgets to use shared LogHelper pattern
- [ ] Add showcase/demo for testing
- [ ] Update documentation
