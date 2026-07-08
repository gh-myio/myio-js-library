# RFC-0108: Measurement Setup Modal

- **Feature Name:** `measurement_setup_modal`
- **Start Date:** 2025-12-23
- **RFC PR:** N/A
- **Status:** Draft

## Summary

Introduce a new modal component for configuring measurement display settings at the shopping (customer) level. This modal allows administrators to customize how values are displayed across different domains (energy, water, temperature), including unit preferences and decimal precision.

## Motivation

Currently, the dashboard displays measurements with hardcoded formatting:
- Energy values auto-convert to MWh when > 1000 kWh
- Water values are shown in cubic meters (m³) with fixed decimal places
- Temperature values are shown in Celsius with fixed precision

This rigidity creates issues:
1. **Precision loss**: Values like `total_value` may be truncated or rounded, losing precision when converted
2. **Inconsistent display**: Different domains have different decimal place defaults
3. **No user preference**: Administrators cannot customize display to their operational needs
4. **Unit flexibility**: Some users prefer seeing all energy values in kWh, even when > 1000

## Guide-level explanation

### Overview

The Measurement Setup Modal provides a centralized configuration interface for display preferences. Settings are persisted at the CUSTOMER (shopping) level in ThingsBoard's `SERVER_SCOPE` attributes.

### Configuration Options

#### Water Domain
| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Unit | `m3` (cubic meters), `liters` | `m3` | Display unit for water consumption |
| Decimal Places | 0-6 | 3 | Number of decimal places to show |
| Auto Scale | `true`, `false` | `true` | Automatically convert between units when appropriate |

When displaying in liters, values are multiplied by 1000 from the stored m³ value, allowing more precision visibility.

#### Energy Domain
| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Unit | `kwh`, `mwh`, `auto` | `auto` | Display unit preference |
| Decimal Places | 0-4 | 3 | Number of decimal places to show |
| Force Unit | `true`, `false` | `false` | When true, always uses selected unit without auto-conversion |

`auto` mode converts to MWh when value > 1000 kWh (current behavior).
`kwh` with `forceUnit: true` keeps all values in kWh regardless of magnitude.

#### Temperature Domain
| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Unit | `celsius`, `fahrenheit` | `celsius` | Temperature unit |
| Decimal Places | 0-3 | 1 | Number of decimal places to show |

### Usage Example

```typescript
import { openMeasurementSetupModal } from 'myio-js-library';

const modal = await openMeasurementSetupModal({
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  customerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  tbBaseUrl: 'https://tb.myio-bas.com',
  onSave: (settings) => {
    console.log('Settings saved:', settings);
    // Refresh dashboard to apply new settings
  },
  onClose: () => console.log('Modal closed')
});

// Clean up when needed
modal.destroy();
```

## Reference-level explanation

### Data Structure

Settings are stored in the `measurementDisplaySettings` attribute on the CUSTOMER entity:

```typescript
interface MeasurementDisplaySettings {
  version: string; // "1.0.0"
  updatedAt: string; // ISO timestamp
  updatedBy?: string; // User ID who last modified

  water: {
    unit: 'm3' | 'liters';
    decimalPlaces: number;
    autoScale: boolean;
  };

  energy: {
    unit: 'kwh' | 'mwh' | 'auto';
    decimalPlaces: number;
    forceUnit: boolean;
  };

  temperature: {
    unit: 'celsius' | 'fahrenheit';
    decimalPlaces: number;
  };
}
```

### Default Values

```typescript
const DEFAULT_SETTINGS: MeasurementDisplaySettings = {
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  water: {
    unit: 'm3',
    decimalPlaces: 3,
    autoScale: true
  },
  energy: {
    unit: 'auto',
    decimalPlaces: 3,
    forceUnit: false
  },
  temperature: {
    unit: 'celsius',
    decimalPlaces: 1
  }
};
```

### API Integration

#### Fetch Settings
```
GET /api/plugins/telemetry/CUSTOMER/{customerId}/values/attributes/SERVER_SCOPE?keys=measurementDisplaySettings
```

#### Save Settings
```
POST /api/plugins/telemetry/CUSTOMER/{customerId}/attributes/SERVER_SCOPE
Content-Type: application/json

{
  "measurementDisplaySettings": { ... }
}
```

### Component Architecture

```
src/components/premium-modals/measurement-setup/
├── index.ts                      # Public exports
├── types.ts                      # TypeScript interfaces
├── openMeasurementSetupModal.ts  # Main entry point
├── MeasurementSetupView.ts       # UI rendering
└── MeasurementSetupPersister.ts  # API persistence layer
```

### Integration with Dashboard

Dashboard widgets should:
1. Fetch `measurementDisplaySettings` on initialization
2. Pass settings to formatting functions
3. Re-render when settings change

Example integration in widget:

```javascript
// In widget controller
const settings = await fetchMeasurementSettings(customerId, token);

// Apply to formatting
const formattedEnergy = formatEnergy(value, {
  unit: settings.energy.unit,
  decimals: settings.energy.decimalPlaces,
  forceUnit: settings.energy.forceUnit
});
```

## Drawbacks

1. **Breaking change potential**: Existing dashboards expect specific formatting
2. **Storage overhead**: Additional attribute per customer
3. **Complexity**: More configuration options to maintain

## Rationale and alternatives

### Why at CUSTOMER level?
- Settings apply to entire shopping/customer
- Consistent display across all users viewing the same shopping
- Administrators control the experience

### Alternatives considered

1. **User-level preferences**: Would create inconsistent views between users
2. **Device-level settings**: Too granular, would be overwhelming
3. **Global defaults only**: Current state, inflexible

## Prior art

- ThingsBoard's built-in widget settings (per-widget, not global)
- Grafana's unit system with per-panel overrides
- Power BI's formatting options

## Unresolved questions

1. Should settings sync across multiple browser tabs?
2. Should there be role-based permissions for changing settings?
3. Should we support custom unit labels (e.g., "kWh" vs "kilowatt-hours")?

## Future possibilities

1. **Per-device overrides**: Allow specific devices to have different formatting
2. **Export format settings**: Apply same formatting to CSV/PDF exports
3. **Scheduled format changes**: Different precision for different time ranges
4. **Localization**: Support for different number formats (1.000,00 vs 1,000.00)
