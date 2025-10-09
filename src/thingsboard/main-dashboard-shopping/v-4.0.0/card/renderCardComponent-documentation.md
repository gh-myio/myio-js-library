# renderCardComponent Function - Technical Documentation

## Overview

The `renderCardComponent` function is a JavaScript module that generates interactive device cards for a ThingsBoard dashboard interface. It creates dynamic HTML cards with flip animations, action buttons, and real-time status indicators for IoT devices.

## Function Signature

```javascript
export function renderCardComponent({
  entityObject,
  handleActionDashboard,
  handleActionReport,
  handleActionSettings,
  handleSelect,
  handInfo,
  handleClickCard,
})
```

## Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityObject` | Object | Contains all device/entity data and metadata |

### Optional Parameters (Event Handlers)

| Parameter | Type | Description |
|-----------|------|-------------|
| `handleActionDashboard` | Function | Callback for dashboard action button |
| `handleActionReport` | Function | Callback for report action button |
| `handleActionSettings` | Function | Callback for settings action button |
| `handleSelect` | Function | Callback for selection checkbox |
| `handInfo` | Boolean | Flag to show/hide info button |
| `handleClickCard` | Function | Callback for card click events |

## Entity Object Structure

The `entityObject` parameter contains the following properties:

```javascript
{
  entityId: string,           // Unique identifier for the entity
  labelOrName: string,        // Display name for the device
  entityType: string,         // Type classification of the entity
  deviceType: string,         // Specific device type (MOTOR, HIDROMETRO, etc.)
  slaveId: string,           // Slave device identifier
  ingestionId: string,       // Data ingestion identifier
  val: number,               // Current consumption/measurement value
  centralId: string,         // Central system identifier
  updatedIdentifiers: Object, // Updated identification data (default: {})
  isOn: boolean,             // Device operational status (default: false)
  perc: number,              // Percentage value (default: 0)
  group: string,             // Device grouping classification
  deviceStatus: string,      // Device status: 'power_on', 'standby', 'power_off', 'warning', 'danger', 'maintenance', 'no_info'
  centralName: string,       // Name of the central system
  connectionStatusTime: string, // Timestamp of last connection
  timaVal: string,           // Timestamp of last telemetry value
  valType: string,           // Value type ("ENERGY", "WATER", "TANK")
}
```

## Return Value

Returns a jQuery object (`$card`) representing the complete device card DOM element with all event handlers attached.

## Core Functionality

### 1. Data Processing and Formatting

- **Value Formatting**: Formats consumption values based on `valType`
  - `ENERGY`: Uses `MyIO.formatEnergyByGroup()`
  - `WATER`: Formats as "X m³"
  - `TANK`: Formats as "X m.c.a"
  - Default: Raw value

- **Percentage Formatting**: Uses `MyIO.formatNumberReadable()` for percentage display

- **Date/Time Processing**: 
  - Formats connection timestamps
  - Calculates time differences for "last seen" functionality
  - Applies color coding based on data freshness

### 2. MyIO Library Integration

The function includes a fallback mechanism for the MyIO library:

```javascript
const MyIO = (typeof MyIOLibrary !== "undefined" && MyIOLibrary) ||
  (typeof window !== "undefined" && window.MyIOLibrary) || {
    formatEnergyByGroup: (v, g) => `${v} kWh`,
    formatNumberReadable: (n) => Number(n ?? 0).toFixed(1),
  };
```

### 3. Dynamic CSS Injection

Injects comprehensive CSS styles once per page load, including:
- Card layout and hover effects
- Flip animation styles
- Status indicators and color schemes
- Responsive design elements

### 4. Device Image Mapping

Maps device types to specific images:

```javascript
const deviceImages = {
  MOTOR: "https://dashboard.myio-bas.com/api/images/public/8Ezn8qVBJ3jXD0iDfnEAZ0MZhAP1b5Ts",
  "3F_MEDIDOR": "https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k",
  RELOGIO: "https://dashboard.myio-bas.com/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB",
  HIDROMETRO: "https://dashboard.myio-bas.com/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4",
  ENTRADA: "https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU",
  CAIXA_DAGUA: "https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq",
};
```

## Card Structure

### Front Side
- **Action Panel**: Vertical button strip with dashboard, report, settings, and selection actions
- **Device Information**: Title, image, and consumption data
- **Status Indicators**: Connection status with visual alerts
- **Info Button**: Triggers flip to back side (if `handInfo` is true)

### Back Side
- **System Information**: Central name and connection details
- **Consumption Details**: Enhanced value display with icons
- **Telemetry Information**: Last data timestamp with time difference calculation
- **Return Button**: Flips back to front side

## Event Handling

### Action Buttons
- **Dashboard**: Calls `handleActionDashboard(entityObject)`
- **Report**: Calls `handleActionReport(entityObject)`
- **Settings**: Calls `handleActionSettings(entityObject)`
- **Selection**: Calls `handleSelect(entityObject)`

### Card Interactions
- **Card Click**: Calls `handleClickCard()` or falls back to `handleActionDashboard()`
- **Info Button**: Triggers card flip animation
- **Event Propagation**: Properly managed to prevent conflicts

## Visual States

### Device Status
The component supports standardized device status values:
- **power_on**: Device operating normally (green indicators)
- **standby**: Device in standby mode (amber indicators)
- **power_off**: Device powered off (red indicators)
- **warning**: Warning condition (amber indicators, flashing)
- **danger**: Critical error (red indicators, flashing)
- **maintenance**: Under maintenance (amber indicators)
- **no_info**: No device info/offline (gray indicators, blinking border)

### Data Freshness Indicators
- **Recent (< 30 min)**: Green color (`#5cb85c`)
- **Moderate (30 min - 24 hours)**: Orange color (`#e89105`)
- **Stale (> 24 hours)**: Red color (`#cc2900`)
- **No Data**: Gray color (`#d6dcdd`)

### Animation Effects
- **Hover**: Scale transform (1.05x)
- **Flip**: 3D rotation animation (180° Y-axis)
- **Flash**: Pulsing animation for status indicators
- **Border Blink**: Animated border for offline devices

## Dependencies

- **jQuery**: Required for DOM manipulation and event handling
- **MyIO Library**: Optional, with built-in fallbacks for formatting functions
- **Modern Browser**: CSS3 transforms and animations support

## Usage Example

```javascript
import { renderCardComponent } from './template-card.js';

const deviceCard = renderCardComponent({
  entityObject: {
    entityId: "device-001",
    labelOrName: "Motor Principal",
    deviceType: "MOTOR",
    val: 1250.5,
    valType: "ENERGY",
    deviceStatus: "power_on",
    // ... other properties
  },
  handleActionDashboard: (entity) => {
    console.log('Dashboard clicked for:', entity.labelOrName);
  },
  handleActionReport: (entity) => {
    console.log('Report clicked for:', entity.labelOrName);
  },
  handInfo: true,
});

// Append to container
$('#device-container').append(deviceCard);
```

## Performance Considerations

- **CSS Injection**: Styles are injected only once per page load
- **Event Delegation**: Efficient event handling with proper propagation control
- **Image Optimization**: Uses CDN-hosted images with fallback
- **Memory Management**: Proper jQuery object handling

## Browser Compatibility

- **Modern Browsers**: Full feature support
- **CSS3 Support**: Required for animations and transforms
- **ES6 Features**: Uses destructuring, template literals, arrow functions

## Security Considerations

- **XSS Prevention**: Proper HTML escaping for dynamic content
- **Event Isolation**: Controlled event propagation
- **External Resources**: Uses HTTPS for all external image URLs

## Maintenance Notes

- **Image URLs**: Hardcoded CDN URLs may need updating
- **CSS Classes**: Extensive CSS injection should be considered for external stylesheet
- **Library Dependencies**: MyIO library integration should be documented for consumers
