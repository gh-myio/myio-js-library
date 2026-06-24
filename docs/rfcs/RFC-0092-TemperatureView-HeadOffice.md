# RFC-0092: Temperature View for Head Office Dashboard

- **Status**: Draft
- **Created**: 2025-12-02
- **Updated**: 2025-12-02
- **Authors**: Development Team
- **Related**: RFC-0087 (Water Head Office), RFC-0085 (Temperature Modal), RFC-0057 (Orchestrator)

## Summary

This RFC introduces a Temperature domain view for the Head Office dashboard, consisting of two new widgets: `TEMPERATURE_SENSORS` for displaying individual sensor cards and `TEMPERATURE` for consolidated temperature comparison across shopping centers.

## Motivation

Currently, temperature monitoring is limited to individual device views. Head Office users need:

1. A unified view of all temperature sensors across multiple shopping centers
2. Equipment-style card layout for quick sensor status visualization
3. Consolidated temperature comparison with shopping-level aggregation
4. Average temperature metrics per shopping center for operational decisions

This follows the pattern established by RFC-0087 for Water domain, adapting it to the Temperature domain specifics.

## Guide-level Explanation

### Widget Architecture

The Temperature Head Office view consists of two complementary widgets:

```
┌─────────────────────────────────────────────────────────────────┐
│                         MENU (Filter)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              TEMPERATURE_SENSORS Widget                   │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │  │
│  │  │Sensor 1 │ │Sensor 2 │ │Sensor 3 │ │Sensor 4 │ ...     │  │
│  │  │ 23.5°C  │ │ 24.1°C  │ │ 22.8°C  │ │ 25.0°C  │         │  │
│  │  │ Shop A  │ │ Shop A  │ │ Shop B  │ │ Shop B  │         │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  TEMPERATURE Widget                        │  │
│  │  Shopping Center Average Temperature Comparison           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  📊 Temperature Comparison Chart                    │  │  │
│  │  │     ─── Shopping A (avg 23.8°C)                     │  │  │
│  │  │     ─── Shopping B (avg 24.2°C)                     │  │  │
│  │  │     ─── Shopping C (avg 22.5°C)                     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Widget 1: TEMPERATURE_SENSORS

Displays individual temperature sensor cards in an EQUIPMENTS-style grid layout:

- Fetches sensor data from ThingsBoard API
- Renders cards similar to EQUIPMENTS widget style
- Shows current temperature, sensor name, and shopping center
- Supports filter synchronization via `myio:filter-applied` event
- Color-coded status indicators based on temperature thresholds

### Widget 2: TEMPERATURE

A redesigned comparison panel for shopping-level temperature averages:

- Based on `TemperatureComparisonModal.ts` architecture
- Aggregates sensor data per shopping center
- Displays consolidated average temperatures
- Interactive comparison chart with multi-shopping visualization
- Date range picker for historical analysis

## Reference-level Explanation

### TEMPERATURE_SENSORS Widget

#### Data Flow

```javascript
// 1. Fetch temperature sensors from ThingsBoard
async function fetchTemperatureSensors(token) {
  const devices = await getDevicesByType(token, 'TEMPERATURE_SENSOR');
  return devices.map(device => ({
    id: device.id.id,
    name: device.name,
    label: device.label,
    customerId: device.customerId?.id,
    customerName: device.customerTitle
  }));
}

// 2. Fetch latest telemetry for each sensor
async function fetchSensorTelemetry(token, deviceId) {
  const telemetry = await getLatestTelemetry(token, deviceId, ['temperature']);
  return {
    value: telemetry.temperature?.[0]?.value || null,
    timestamp: telemetry.temperature?.[0]?.ts || null
  };
}

// 3. Render cards with EQUIPMENTS-style layout
function renderSensorCard(sensor, telemetry) {
  return `
    <div class="sensor-card" data-customer-id="${sensor.customerId}">
      <div class="sensor-name">${sensor.label || sensor.name}</div>
      <div class="sensor-value">${formatTemperature(telemetry.value)}</div>
      <div class="sensor-customer">${sensor.customerName}</div>
      <div class="sensor-status ${getStatusClass(telemetry.value)}"></div>
    </div>
  `;
}
```

#### Filter Integration

```javascript
// Listen for filter events from MENU
window.addEventListener('myio:filter-applied', (event) => {
  const { selection } = event.detail;
  const selectedShoppingIds = selection.map(s => s.value).filter(Boolean);

  // Filter displayed sensors
  filterSensorCards(selectedShoppingIds);
});

// Pre-existing filter support
if (window.custumersSelected?.length > 0) {
  const shoppingIds = window.custumersSelected.map(s => s.value).filter(v => v);
  filterSensorCards(shoppingIds);
}
```

### TEMPERATURE Widget

#### Architecture

The TEMPERATURE widget reuses the `TemperatureComparisonModal.ts` core logic but adapts it for:

1. **Shopping-level aggregation**: Groups sensors by `customerId` (shopping center)
2. **Average calculation**: Computes mean temperature per shopping
3. **Inline display**: Renders as dashboard panel instead of modal
4. **Real-time updates**: Subscribes to telemetry WebSocket updates

#### Data Aggregation

```typescript
interface ShoppingTemperatureData {
  shoppingId: string;
  shoppingName: string;
  sensors: TemperatureDevice[];
  averageTemperature: number;
  minTemperature: number;
  maxTemperature: number;
  sensorCount: number;
  lastUpdate: number;
}

// Aggregate sensor data by shopping center
function aggregateByShoppingCenter(
  devices: TemperatureDevice[],
  telemetryData: Map<string, TemperatureTelemetry[]>
): ShoppingTemperatureData[] {
  const shoppingMap = new Map<string, ShoppingTemperatureData>();

  devices.forEach(device => {
    const shoppingId = device.customerId || 'unknown';
    const sensorData = telemetryData.get(device.id) || [];

    if (!shoppingMap.has(shoppingId)) {
      shoppingMap.set(shoppingId, {
        shoppingId,
        shoppingName: device.customerName || 'Unknown',
        sensors: [],
        averageTemperature: 0,
        minTemperature: Infinity,
        maxTemperature: -Infinity,
        sensorCount: 0,
        lastUpdate: 0
      });
    }

    const shopping = shoppingMap.get(shoppingId)!;
    shopping.sensors.push(device);

    if (sensorData.length > 0) {
      const latest = sensorData[sensorData.length - 1];
      const temp = Number(latest.value);

      shopping.averageTemperature += temp;
      shopping.sensorCount++;
      shopping.minTemperature = Math.min(shopping.minTemperature, temp);
      shopping.maxTemperature = Math.max(shopping.maxTemperature, temp);
      shopping.lastUpdate = Math.max(shopping.lastUpdate, latest.ts);
    }
  });

  // Calculate final averages
  shoppingMap.forEach(shopping => {
    if (shopping.sensorCount > 0) {
      shopping.averageTemperature /= shopping.sensorCount;
    }
  });

  return Array.from(shoppingMap.values());
}
```

#### Comparison Chart

Adapts `drawComparisonChart` from `TemperatureComparisonModal.ts`:

```typescript
// Chart with shopping centers as series instead of individual sensors
function drawShoppingComparisonChart(
  canvasId: string,
  shoppingData: ShoppingTemperatureData[],
  state: WidgetState
): void {
  // Similar to TemperatureComparisonModal but:
  // - Each line represents a shopping center
  // - Y-axis shows average temperature
  // - Legend shows shopping names with sensor counts
  // - Tooltip shows shopping details
}
```

### Event Communication

```
MENU (filter selection)
    │
    ├──► myio:filter-applied ──► MAIN (Orchestrator)
    │                                   │
    │                                   └──► myio:orchestrator-filter-updated
    │                                               │
    │                                               ├──► TEMPERATURE_SENSORS
    │                                               └──► TEMPERATURE
    │
    └──► myio:filter-applied ──► TEMPERATURE_SENSORS (direct)
                              └──► TEMPERATURE (direct)
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `MYIO-SIM/v5.2.0/TEMPERATURE_SENSORS/controller.js` | Create | Sensor cards widget controller |
| `MYIO-SIM/v5.2.0/TEMPERATURE_SENSORS/template.html` | Create | Card grid template |
| `MYIO-SIM/v5.2.0/TEMPERATURE_SENSORS/style.css` | Create | EQUIPMENTS-style card styling |
| `MYIO-SIM/v5.2.0/TEMPERATURE/controller.js` | Rewrite | Comparison panel controller |
| `MYIO-SIM/v5.2.0/TEMPERATURE/template.html` | Modify | Update for inline panel display |
| `MYIO-SIM/v5.2.0/TEMPERATURE/style.css` | Modify | Panel and chart styling |
| `MYIO-SIM/v5.2.0/MAIN/controller.js` | Modify | Add temperature orchestrator functions |
| `MYIO-SIM/v5.2.0/MENU/controller.js` | Modify | Add temperature menu item |

## Drawbacks

1. **API Load**: Multiple sensors require multiple telemetry calls or batch requests
2. **Complexity**: Two widgets instead of one increases maintenance burden
3. **State Synchronization**: Must keep filter state consistent across widgets
4. **Memory Usage**: Caching telemetry data for multiple shopping centers

## Rationale and Alternatives

### Why Two Widgets?

1. **Separation of Concerns**: Sensor-level detail vs shopping-level overview
2. **Flexible Layout**: Can arrange widgets independently on dashboard
3. **Consistent Pattern**: Follows Water domain architecture from RFC-0087

### Alternatives Considered

1. **Single Combined Widget**: Would be too complex and harder to maintain
2. **Modal-only Approach**: Loses dashboard integration and real-time visibility
3. **Reuse EQUIPMENTS Widget**: Different data source and display requirements

## Prior Art

- RFC-0087: Water Head Office - Similar dual-widget pattern
- RFC-0085: Temperature Modal Component - Base comparison logic
- EQUIPMENTS Widget: Card grid layout reference
- `TemperatureComparisonModal.ts`: Chart and data processing utilities

## Unresolved Questions

1. Should temperature thresholds be configurable per shopping center?
2. How to handle sensors with stale data (no recent readings)?
3. Should we show trend indicators (rising/falling temperature)?
4. What is the optimal polling interval for real-time updates?
5. Should the comparison chart support exporting to PDF/image?

## Future Possibilities

1. **Alert Integration**: Push notifications for out-of-range temperatures
2. **Historical Analysis**: Monthly/yearly comparison views
3. **Predictive Analytics**: Temperature trend prediction
4. **HVAC Integration**: Link to equipment controls for temperature management
5. **Energy Correlation**: Cross-reference with energy consumption patterns
