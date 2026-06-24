# EnergyModalView - Comparison Mode Usage Guide

## Overview

The `EnergyModalView` now supports two modes:
- **Single Mode** (default): Displays chart for a single device
- **Comparison Mode** (new): Displays stacked chart comparing multiple devices

## Installation

The comparison mode is available in version 5.2.0+ of the MyIO Library.

```bash
npm install @myio/library@^5.2.0
```

## Basic Usage

### Single Mode (Original Behavior)

```javascript
// Original usage - still works exactly the same
const modal = MyIOLibrary.openDashboardPopupEnergy({
  deviceId: 'device-uuid-123',
  startDate: '2025-08-01',
  endDate: '2025-08-31',
  tbJwtToken: 'your-jwt-token',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});
```

### Comparison Mode (New)

```javascript
// New comparison mode
const modal = MyIOLibrary.openDashboardPopupEnergy({
  mode: 'comparison',  // ← SPECIFY MODE
  dataSources: [
    { type: 'device', id: 'ingestion-id-1', label: 'Sensor A' },
    { type: 'device', id: 'ingestion-id-2', label: 'Sensor B' },
    { type: 'device', id: 'ingestion-id-3', label: 'Sensor C' }
  ],
  startDate: '2025-08-01',
  endDate: '2025-09-30',
  granularity: '1d',  // ← REQUIRED for comparison
  readingType: 'energy',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});
```

## Configuration Options

### Required Parameters (Comparison Mode)

| Parameter | Type | Description |
|-----------|------|-------------|
| `mode` | `'comparison'` | Must be set to 'comparison' |
| `dataSources` | `Array<{type, id, label}>` | Array of devices to compare (min 2 recommended) |
| `granularity` | `'15m' \| '1h' \| '1d'` | **REQUIRED** for comparison (auto-calculated in single mode) |
| `startDate` | `string \| Date` | Start date (YYYY-MM-DD format preferred) |
| `endDate` | `string \| Date` | End date (YYYY-MM-DD format preferred) |
| `clientId` | `string` | Client ID for SDK authentication |
| `clientSecret` | `string` | Client secret for SDK authentication |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `readingType` | `'energy' \| 'water' \| 'tank'` | `'energy'` | Type of telemetry data |
| `deep` | `boolean` | `false` | Enable deep data fetch (comparison only) |
| `theme` | `'light' \| 'dark'` | `'light'` | Chart theme |
| `timezone` | `string` | `'America/Sao_Paulo'` | Timezone identifier |
| `dataApiHost` | `string` | `'https://api.data.apps.myio-bas.com'` | Data API base URL |

## Integration Examples

### Example 1: From FOOTER Widget (Shopping v5.2.0)

```javascript
// In FOOTER/controller.js
async function openComparisonModal() {
  const selected = MyIOSelectionStore.getSelectedEntities();

  if (selected.length < 2) {
    alert("Selecione pelo menos 2 dispositivos para comparar.");
    return;
  }

  const unitType = this.currentUnitType || this._detectUnitType(selected);
  const readingType = this._mapUnitTypeToReadingType(unitType);

  // Convert selected entities to dataSources
  const dataSources = selected.map(entity => ({
    type: 'device',
    id: entity.ingestionId,  // Use ingestion ID
    label: entity.name || entity.id
  }));

  // Calculate granularity based on date range
  const granularity = this._calculateGranularity(
    this._getStartDate(),
    this._getEndDate()
  );

  // Use EnergyModalView in comparison mode
  const modal = MyIOLibrary.openDashboardPopupEnergy({
    mode: 'comparison',
    dataSources: dataSources,
    readingType: readingType,
    startDate: this._getStartDate(),
    endDate: this._getEndDate(),
    granularity: granularity,
    clientId: window.__MYIO_CLIENT_ID__ || '',
    clientSecret: window.__MYIO_CLIENT_SECRET__ || '',
    dataApiHost: 'https://api.data.apps.myio-bas.com'
  });
}
```

### Example 2: Dynamic Granularity Calculation

```javascript
function calculateGranularity(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  if (diffDays <= 2) {
    return '15m';
  } else if (diffDays <= 7) {
    return '1h';
  } else {
    return '1d';
  }
}

const modal = MyIOLibrary.openDashboardPopupEnergy({
  mode: 'comparison',
  dataSources: devices,
  startDate: '2025-08-01',
  endDate: '2025-08-07',
  granularity: calculateGranularity('2025-08-01', '2025-08-07'),  // Returns '1h'
  clientId: 'client-id',
  clientSecret: 'secret'
});
```

### Example 3: With Event Callbacks

```javascript
const modal = MyIOLibrary.openDashboardPopupEnergy({
  mode: 'comparison',
  dataSources: [
    { type: 'device', id: 'dev1', label: 'Device 1' },
    { type: 'device', id: 'dev2', label: 'Device 2' }
  ],
  startDate: '2025-08-01',
  endDate: '2025-08-31',
  granularity: '1d',
  clientId: 'client-id',
  clientSecret: 'secret',
  onOpen: (context) => {
    console.log('Comparison modal opened:', context);
  },
  onClose: () => {
    console.log('Comparison modal closed');
  },
  onError: (error) => {
    console.error('Modal error:', error);
    alert(`Error: ${error.message}`);
  }
});
```

## Key Differences Between Modes

| Aspect | Single Mode | Comparison Mode |
|--------|-------------|-----------------|
| **Device Parameter** | `deviceId` (ThingsBoard UUID) | `dataSources` (array of ingestion IDs) |
| **Granularity** | Optional (auto-calculated) | **REQUIRED** |
| **Date Format** | ISO with timezone (e.g., `2025-08-01T00:00:00-03:00`) | YYYY-MM-DD preferred (e.g., `2025-08-01`) |
| **SDK Function** | `renderTelemetryChart` | `renderTelemetryStackedChart` |
| **Data Fetch** | Via callback (modal fetches data) | SDK internal (no callback needed) |
| **tbJwtToken** | Required | Optional (not needed) |
| **deep Parameter** | Not available | Available (boolean) |

## Validation

The modal will validate configuration on initialization:

### Single Mode Validation
- `deviceId` must be provided
- `tbJwtToken` is required for data fetch

### Comparison Mode Validation
- `dataSources` must be an array with at least 1 device (2+ recommended)
- `granularity` is **required** (will throw error if missing)
- Each dataSource must have `type: 'device'`, `id`, and `label`

## Error Handling

```javascript
try {
  const modal = MyIOLibrary.openDashboardPopupEnergy({
    mode: 'comparison',
    dataSources: devices,
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    // ❌ Missing granularity - will throw error
    clientId: 'id',
    clientSecret: 'secret'
  });
} catch (error) {
  console.error('Failed to open modal:', error.message);
  // Output: "granularity is required for comparison mode"
}
```

## SDK Requirements

### For Comparison Mode
The comparison mode requires the `EnergyChartSDK` to have `renderTelemetryStackedChart` function available:

```javascript
// Check if SDK is loaded
if (window.EnergyChartSDK?.renderTelemetryStackedChart) {
  // Comparison mode is available
} else {
  console.error('Comparison mode requires EnergyChartSDK with renderTelemetryStackedChart');
}
```

## Migration Guide

### Migrating from Custom Comparison Modal

**Before** (custom implementation):
```javascript
this._createComparisonModalOverlay({
  dataSources,
  readingType,
  startDate,
  endDate,
  granularity
});
```

**After** (using EnergyModalView):
```javascript
MyIOLibrary.openDashboardPopupEnergy({
  mode: 'comparison',
  dataSources,
  readingType,
  startDate,
  endDate,
  granularity,
  clientId: window.__MYIO_CLIENT_ID__,
  clientSecret: window.__MYIO_CLIENT_SECRET__
});
```

## Best Practices

1. **Always provide granularity** for comparison mode (required)
2. **Use ingestion IDs** in dataSources, not ThingsBoard UUIDs
3. **Validate device selection** before opening modal (min 2 devices recommended)
4. **Handle errors** with onError callback
5. **Clean up** modal instances on page unload
6. **Date format**: Use 'YYYY-MM-DD' for comparison mode (cleaner, no timezone issues)

## Troubleshooting

### Chart Not Rendering
- Check browser console for errors
- Verify `EnergyChartSDK.renderTelemetryStackedChart` is loaded
- Ensure granularity is provided
- Check that ingestion IDs are valid

### Empty Chart
- Verify date range has data
- Check that devices have telemetry for the period
- Ensure readingType matches device capabilities (energy/water/tank)

### Performance Issues
- Limit dataSources to 5-10 devices max
- Use appropriate granularity (don't use '15m' for 30-day periods)
- Consider enabling caching in SDK configuration

## Support

For issues or questions:
- GitHub Issues: https://github.com/anthropics/claude-code/issues
- Documentation: See RFC-0045 for detailed implementation

---

**Version**: 5.2.0
**Last Updated**: 2025-10-17
**Author**: Claude Code
