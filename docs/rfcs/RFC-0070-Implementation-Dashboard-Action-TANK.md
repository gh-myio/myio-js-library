# RFC-0070: Implementation Guide - Dashboard Action for TANK/CAIXA_DAGUA

- **RFC**: 0070-Implementation
- **Parent RFC**: RFC-0070
- **Title**: Dashboard Action Handler Implementation for Water Tank Devices
- **Authors**: MyIO Frontend Guild
- **Status**: Implementation Guide
- **Created**: 2025-01-05

## Overview

This document provides a detailed implementation guide for integrating water tank modal behavior into the `template-card-v5.js` `handleActionDashboard` function. This is part of RFC-0070's implementation plan to support TANK and CAIXA_DAGUA device types in the v5 card rendering system.

## Current State Analysis

### Existing Dashboard Action Handler

**File**: `src/thingsboard/main-dashboard-shopping/v-5.2.0/card/template-card-v5.js`

**Current Behavior** (lines ~958):
- The `handleActionDashboard` callback is defined but the exact routing logic needs to be reviewed
- Currently handles energy devices through `openDashboardPopupEnergy`
- No specialized handling for water tank devices (TANK/CAIXA_DAGUA)

### Device Type Detection

The card component receives `deviceType` from the entity object:

```javascript
const {
  entityId,
  labelOrName,
  deviceIdentifier,
  entityType,
  deviceType,      // ← This identifies TANK, CAIXA_DAGUA, etc.
  slaveId,
  ingestionId,
  val,             // ← Current value (for tanks, this is percentage)
  centralId,
  perc,            // ← Percentage value
  deviceStatus,
  centralName,
  connectionStatusTime,
  timeVal,
} = entityObject;
```

## Implementation Strategy

### Phase 1: Add Device Type Routing

Modify `handleActionDashboard` to detect water tank device types and route to appropriate modal:

```javascript
handleActionDashboard: async () => {
  try {
    // Get JWT token from localStorage (widget context)
    const jwtToken = localStorage.getItem("jwt_token");

    if (!jwtToken) {
      console.error('[Card v5] JWT token not found');
      MyIOToast.show('Authentication required', 'error');
      return;
    }

    // Get time range from widget context
    const startTs = self.ctx?.$scope?.startTs || Date.now() - 86400000; // Default: 24h ago
    const endTs = self.ctx?.$scope?.endTs || Date.now();

    // Route based on device type
    const isWaterTank = deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA';

    if (isWaterTank) {
      // Water tank modal (uses ThingsBoard telemetry)
      console.log('[Card v5] Opening water tank modal for device:', entityId);

      await MyIOLibrary.openDashboardPopupWaterTank({
        deviceId: entityId,
        deviceType: deviceType,
        label: labelOrName,
        currentLevel: perc || val || 0, // Use percentage value
        tbJwtToken: jwtToken,
        startTs: typeof startTs === 'number' ? startTs : new Date(startTs).getTime(),
        endTs: typeof endTs === 'number' ? endTs : new Date(endTs).getTime(),
        timezone: self.ctx?.timeWindow?.timezone || 'America/Sao_Paulo',
        slaveId: slaveId,
        centralId: centralId,
        ingestionId: ingestionId,
        onOpen: (context) => {
          console.log('[Card v5] Water tank modal opened:', context);
        },
        onClose: () => {
          console.log('[Card v5] Water tank modal closed');
        },
        onError: (error) => {
          console.error('[Card v5] Water tank modal error:', error);
          MyIOToast.show(`Error: ${error.message}`, 'error');
        }
      });
    } else {
      // Energy modal (uses Ingestion API)
      console.log('[Card v5] Opening energy modal for device:', entityId);

      // Existing energy modal logic
      await MyIOLibrary.openDashboardPopupEnergy({
        deviceId: entityId,
        startDate: new Date(startTs),
        endDate: new Date(endTs),
        tbJwtToken: jwtToken,
        label: labelOrName,
        customerId: self.ctx?.customerId,
        ingestionId: ingestionId,
        centralId: centralId,
        slaveId: slaveId,
        // ... other energy-specific params
      });
    }

  } catch (error) {
    console.error('[Card v5] Dashboard action error:', error);
    MyIOToast.show('Failed to open dashboard', 'error');
  }
}
```

### Phase 2: Add Feature Detection

Before calling the water tank modal, check if the library function exists:

```javascript
handleActionDashboard: async () => {
  const jwtToken = localStorage.getItem("jwt_token");

  if (!jwtToken) {
    MyIOToast.show('Authentication required', 'error');
    return;
  }

  const isWaterTank = deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA';

  if (isWaterTank) {
    // Feature detection: Check if water tank modal is available
    if (typeof MyIOLibrary?.openDashboardPopupWaterTank !== 'function') {
      console.warn('[Card v5] Water tank modal not available in library version');
      MyIOToast.show('Water tank dashboard requires library update', 'warning');
      return;
    }

    // Call water tank modal
    await MyIOLibrary.openDashboardPopupWaterTank({
      // ... params
    });
  } else {
    // Energy modal
    await MyIOLibrary.openDashboardPopupEnergy({
      // ... params
    });
  }
}
```

### Phase 3: Add Loading State

Show visual feedback while modal is loading:

```javascript
handleActionDashboard: async () => {
  const jwtToken = localStorage.getItem("jwt_token");

  if (!jwtToken) {
    MyIOToast.show('Authentication required', 'error');
    return;
  }

  // Show loading indicator
  const loadingToast = MyIOToast.show('Loading dashboard...', 'info');

  try {
    const isWaterTank = deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA';
    const startTs = self.ctx?.$scope?.startTs || Date.now() - 86400000;
    const endTs = self.ctx?.$scope?.endTs || Date.now();

    if (isWaterTank) {
      if (typeof MyIOLibrary?.openDashboardPopupWaterTank !== 'function') {
        throw new Error('Water tank modal not available');
      }

      await MyIOLibrary.openDashboardPopupWaterTank({
        deviceId: entityId,
        deviceType: deviceType,
        label: labelOrName,
        currentLevel: perc || val || 0,
        tbJwtToken: jwtToken,
        startTs: typeof startTs === 'number' ? startTs : new Date(startTs).getTime(),
        endTs: typeof endTs === 'number' ? endTs : new Date(endTs).getTime(),
        timezone: self.ctx?.timeWindow?.timezone || 'America/Sao_Paulo',
        slaveId: slaveId,
        centralId: centralId,
        ingestionId: ingestionId
      });
    } else {
      await MyIOLibrary.openDashboardPopupEnergy({
        deviceId: entityId,
        startDate: new Date(startTs),
        endDate: new Date(endTs),
        tbJwtToken: jwtToken,
        label: labelOrName,
        ingestionId: ingestionId,
        centralId: centralId,
        slaveId: slaveId
      });
    }

    // Hide loading indicator
    loadingToast.hide();

  } catch (error) {
    console.error('[Card v5] Dashboard action error:', error);
    loadingToast.hide();
    MyIOToast.show(`Error: ${error.message}`, 'error');
  }
}
```

## Complete Implementation Example

### Full handleActionDashboard Implementation

```javascript
handleActionDashboard: async () => {
  // ============================================
  // STEP 1: Authentication & Context Setup
  // ============================================
  const jwtToken = localStorage.getItem("jwt_token");

  if (!jwtToken) {
    console.error('[Card v5] JWT token not found in localStorage');
    MyIOToast.show('Authentication required. Please login again.', 'error');
    return;
  }

  // Get time range from widget context with fallback
  const widgetContext = self.ctx || {};
  const scopeData = widgetContext.$scope || {};
  const timeWindow = widgetContext.timeWindow || {};

  const startTs = scopeData.startTs || Date.now() - 86400000; // Default: 24 hours ago
  const endTs = scopeData.endTs || Date.now();
  const timezone = timeWindow.timezone || widgetContext.settings?.timezone || 'America/Sao_Paulo';
  const customerId = widgetContext.customerId;

  // ============================================
  // STEP 2: Device Type Detection & Routing
  // ============================================
  const isWaterTank = deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA';
  const modalType = isWaterTank ? 'water-tank' : 'energy';

  console.log('[Card v5] Dashboard action triggered', {
    deviceId: entityId,
    deviceType: deviceType,
    modalType: modalType,
    label: labelOrName,
    timeRange: { startTs, endTs }
  });

  // ============================================
  // STEP 3: Loading State
  // ============================================
  const loadingMessage = isWaterTank
    ? 'Loading water tank data...'
    : 'Loading energy data...';

  const loadingToast = MyIOToast.show(loadingMessage, 'info');

  try {
    // ============================================
    // STEP 4: Modal Invocation
    // ============================================

    if (isWaterTank) {
      // ----------------------------------------
      // WATER TANK MODAL
      // ----------------------------------------

      // Feature detection
      if (typeof MyIOLibrary?.openDashboardPopupWaterTank !== 'function') {
        throw new Error(
          'Water tank modal not available. Please update MyIO library to version X.X.X or higher.'
        );
      }

      // Normalize timestamps
      const normalizedStartTs = typeof startTs === 'number'
        ? startTs
        : new Date(startTs).getTime();

      const normalizedEndTs = typeof endTs === 'number'
        ? endTs
        : new Date(endTs).getTime();

      // Validate timestamps
      if (isNaN(normalizedStartTs) || isNaN(normalizedEndTs)) {
        throw new Error('Invalid date range');
      }

      if (normalizedStartTs >= normalizedEndTs) {
        throw new Error('Start date must be before end date');
      }

      // Open water tank modal
      await MyIOLibrary.openDashboardPopupWaterTank({
        // Required parameters
        deviceId: entityId,
        deviceType: deviceType,
        tbJwtToken: jwtToken,
        startTs: normalizedStartTs,
        endTs: normalizedEndTs,

        // Display information
        label: labelOrName || 'Water Tank',
        currentLevel: perc || val || 0,

        // Optional context
        slaveId: slaveId,
        centralId: centralId,
        ingestionId: ingestionId,
        timezone: timezone,

        // UI configuration
        theme: widgetContext.settings?.theme || 'light',
        closeOnEsc: true,
        enableRealTimeUpdates: false, // Can be enabled later

        // Callbacks
        onOpen: (context) => {
          console.log('[Card v5] Water tank modal opened', context);
          loadingToast.hide();
        },

        onClose: () => {
          console.log('[Card v5] Water tank modal closed');
        },

        onError: (error) => {
          console.error('[Card v5] Water tank modal error', error);
          loadingToast.hide();
          MyIOToast.show(`Error: ${error.message}`, 'error');
        },

        onLevelUpdate: (level, timestamp) => {
          console.log('[Card v5] Water level updated', { level, timestamp });
        }
      });

    } else {
      // ----------------------------------------
      // ENERGY MODAL (Existing)
      // ----------------------------------------

      // Feature detection
      if (typeof MyIOLibrary?.openDashboardPopupEnergy !== 'function') {
        throw new Error('Energy modal not available in library');
      }

      // Open energy modal (existing implementation)
      await MyIOLibrary.openDashboardPopupEnergy({
        deviceId: entityId,
        startDate: new Date(startTs),
        endDate: new Date(endTs),
        tbJwtToken: jwtToken,
        label: labelOrName,
        customerId: customerId,
        ingestionId: ingestionId,
        centralId: centralId,
        slaveId: slaveId,
        timezone: timezone,

        // Callbacks
        onOpen: () => {
          console.log('[Card v5] Energy modal opened');
          loadingToast.hide();
        },

        onClose: () => {
          console.log('[Card v5] Energy modal closed');
        },

        onError: (error) => {
          console.error('[Card v5] Energy modal error', error);
          loadingToast.hide();
          MyIOToast.show(`Error: ${error.message}`, 'error');
        }
      });
    }

  } catch (error) {
    // ============================================
    // STEP 5: Error Handling
    // ============================================
    console.error('[Card v5] Dashboard action failed', {
      error: error,
      deviceId: entityId,
      deviceType: deviceType,
      modalType: modalType
    });

    loadingToast.hide();

    // User-friendly error messages
    let errorMessage = 'Failed to open dashboard';

    if (error.message.includes('not available')) {
      errorMessage = 'Feature not available. Please update the system.';
    } else if (error.message.includes('Authentication') || error.message.includes('token')) {
      errorMessage = 'Authentication failed. Please login again.';
    } else if (error.message.includes('date')) {
      errorMessage = 'Invalid date range selected.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    MyIOToast.show(errorMessage, 'error');
  }
}
```

## Integration Checklist

### Pre-Implementation
- [ ] Verify `MyIOLibrary` is available in widget context
- [ ] Confirm `deviceType` values in database (TANK vs CAIXA_DAGUA)
- [ ] Review time range calculation in widget context
- [ ] Check JWT token availability and validity

### Implementation
- [ ] Add device type detection logic
- [ ] Implement routing to water tank modal
- [ ] Add feature detection for library function
- [ ] Implement loading state indicators
- [ ] Add comprehensive error handling
- [ ] Add logging for debugging

### Testing
- [ ] Test with TANK device type
- [ ] Test with CAIXA_DAGUA device type
- [ ] Test with regular energy devices (regression)
- [ ] Test error states (no token, invalid dates, etc.)
- [ ] Test with different date ranges
- [ ] Test loading indicators
- [ ] Verify console logs are helpful

### Post-Implementation
- [ ] Update widget documentation
- [ ] Add usage examples
- [ ] Create migration guide for other widgets
- [ ] Monitor error logs in production
- [ ] Gather user feedback

## Testing Scenarios

### Scenario 1: Water Tank Device (TANK)
```javascript
// Entity object
{
  deviceType: 'TANK',
  entityId: 'abc-123',
  labelOrName: 'Caixa Superior',
  perc: 75,
  val: 75,
  slaveId: 101,
  centralId: 'gateway-01'
}

// Expected: Opens water tank modal with 75% level
```

### Scenario 2: Water Tank Device (CAIXA_DAGUA)
```javascript
// Entity object
{
  deviceType: 'CAIXA_DAGUA',
  entityId: 'def-456',
  labelOrName: 'Caixa Térrea',
  perc: 30,
  val: 30
}

// Expected: Opens water tank modal with 30% level (low status)
```

### Scenario 3: Energy Device (Fallback)
```javascript
// Entity object
{
  deviceType: 'MOTOR',
  entityId: 'ghi-789',
  labelOrName: 'Motor Piscina',
  val: 150, // kWh
  perc: 0
}

// Expected: Opens energy modal (existing behavior)
```

### Scenario 4: Missing JWT Token
```javascript
// localStorage.getItem('jwt_token') returns null

// Expected:
// - Error toast: "Authentication required"
// - Console error logged
// - No modal opens
```

### Scenario 5: Library Function Not Available
```javascript
// MyIOLibrary.openDashboardPopupWaterTank is undefined

// Expected:
// - Warning toast: "Feature not available"
// - Console warning logged
// - No modal opens
```

## Error Handling Matrix

| Error Type | User Message | Developer Action | Recovery |
|------------|--------------|------------------|----------|
| Missing JWT | "Authentication required. Please login again." | Log error | Redirect to login |
| Invalid dates | "Invalid date range selected." | Log dates | Show date picker |
| Library version | "Feature not available. Please update." | Log version | Update library |
| Network error | "Connection failed. Please try again." | Log error + retry count | Retry button |
| Unknown device type | "Device type not supported." | Log deviceType | Contact support |

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Only load water tank modal code when needed
2. **Caching**: Cache device metadata to reduce API calls
3. **Debouncing**: Prevent multiple rapid clicks on dashboard button
4. **Progressive Loading**: Show modal shell before data loads
5. **WebSocket Connection**: Reuse WebSocket connection if already open

### Performance Metrics

Target metrics for dashboard action:
- **Time to Modal Open**: < 500ms
- **Time to First Data**: < 2 seconds
- **Memory Usage**: < 10MB additional
- **CPU Usage**: < 30% peak during chart rendering

## Monitoring & Logging

### Key Metrics to Track

```javascript
// Example analytics event
MyIOAnalytics.track('dashboard_action', {
  deviceType: deviceType,
  modalType: isWaterTank ? 'water-tank' : 'energy',
  timeToOpen: Date.now() - startTime,
  success: true,
  error: null
});
```

### Log Levels

- **DEBUG**: Function entry/exit, parameter values
- **INFO**: Modal opened/closed, user actions
- **WARN**: Feature not available, fallback behaviors
- **ERROR**: Exceptions, API failures, invalid data

## Migration Path

### From v3.6.0 WATER Widget

**Old Code**:
```javascript
await openDashboardPopupWater(
  entityId,
  entityType,
  entitySlaveId,
  entityCentralId,
  entityLabel,
  entityComsuption,
  percent
);
```

**New Code**:
```javascript
await MyIOLibrary.openDashboardPopupWaterTank({
  deviceId: entityId,
  deviceType: entityType,
  label: entityLabel,
  currentLevel: percent,
  tbJwtToken: jwtToken,
  startTs: startTs,
  endTs: endTs,
  slaveId: entitySlaveId,
  centralId: entityCentralId
});
```

## Documentation Updates Needed

1. **Widget README**: Add water tank modal documentation
2. **Library API Docs**: Document `openDashboardPopupWaterTank` function
3. **Migration Guide**: Create guide for upgrading from v3.6.0
4. **Troubleshooting**: Add common issues and solutions
5. **Examples**: Add complete code examples

## References

- [RFC-0070: Main Specification](./RFC-0070-ImplementCardTANK-At-renderComponentv5.md)
- [RFC-0026: Energy Modal Reference](./RFC-0026-openDashboardPopupEnergy.md)
- ThingsBoard Telemetry API: https://thingsboard.io/docs/reference/rest-api/
- Existing Water Widget: `src/thingsboard/main-dashboard-shopping/v.3.6.0/WIDGET/WATER/controller.js`

## Changelog

- 2025-01-05: Initial implementation guide created
