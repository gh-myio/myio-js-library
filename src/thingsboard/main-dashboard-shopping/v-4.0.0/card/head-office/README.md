# Head Office Card Component

The `renderCardCompenteHeadOffice` component provides a premium, atomic UI card for displaying device information in MYIO Head Office dashboards within ThingsBoard widgets.

## Features

- **Atomic Design**: Self-contained with injected CSS, no external dependencies
- **Device Icons**: Comprehensive icon mapping for different device types
- **Status Indicators**: Visual status chips with alert/failure border highlighting
- **Interactive Elements**: 3-dot menu, selection checkbox with light green background, drag-and-drop support
- **Accessibility**: Full keyboard navigation and ARIA support
- **Responsive**: Adapts to different screen sizes
- **Internationalization**: Customizable labels with Portuguese defaults

## Installation

The component is exported from the main MYIO JS Library:

```javascript
import { renderCardCompenteHeadOffice } from 'myio-js-library';
```

Or in ThingsBoard widgets:

```javascript
const card = MyIOLibrary.renderCardCompenteHeadOffice(container, params);
```

## Basic Usage

```javascript
const container = document.getElementById('card-container');

const card = renderCardCompenteHeadOffice(container, {
  entityObject: {
    entityId: 'ELV-002',
    labelOrName: 'Elevador Social Norte 01',
    deviceIdentifier: 'ELV-002',
    deviceType: 'ELEVADOR',
    val: 22.8,
    valType: 'power_kw',
    perc: 89,
    deviceStatus: 'power_on',
    temperatureC: 26,
    operationHours: 8.934
  },
  handleActionDashboard: (event, entity) => {
    console.log('Open dashboard for:', entity.labelOrName);
  },
  handleActionReport: (event, entity) => {
    console.log('Open report for:', entity.labelOrName);
  },
  handleActionSettings: (event, entity) => {
    console.log('Open settings for:', entity.labelOrName);
  },
  handleSelect: (checked, entity) => {
    console.log('Selection changed:', checked, entity.labelOrName);
  },
  handleClickCard: (event, entity) => {
    console.log('Card clicked:', entity.labelOrName);
  },
  enableSelection: true,
  enableDragDrop: true,
  useNewComponents: true
});
```

## API Reference

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `containerEl` | `HTMLElement` | ✅ | DOM element to render the card into |
| `params` | `RenderCardParams` | ✅ | Configuration object |

### RenderCardParams

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `entityObject` | `EntityObject` | ✅ | Device data and metrics |
| `handleActionDashboard` | `Function` | ❌ | Callback for dashboard menu action |
| `handleActionReport` | `Function` | ❌ | Callback for report menu action |
| `handleActionSettings` | `Function` | ❌ | Callback for settings menu action |
| `handleSelect` | `Function` | ❌ | Callback for selection checkbox |
| `handInfo` | `Function` | ❌ | Callback for info icon (future use) |
| `handleClickCard` | `Function` | ❌ | Callback for card body click |
| `useNewComponents` | `boolean` | ❌ | Enable new component features |
| `enableSelection` | `boolean` | ❌ | Show selection checkbox |
| `enableDragDrop` | `boolean` | ❌ | Enable drag and drop |
| `i18n` | `Partial<I18NMap>` | ❌ | Custom labels |

### EntityObject

| Property | Type | Description |
|----------|------|-------------|
| `entityId` | `string` | Unique identifier |
| `labelOrName` | `string` | Display name |
| `deviceIdentifier` | `string` | Device code (e.g., "ELV-002") |
| `deviceType` | `string` | Device type for icon mapping |
| `val` | `number` | Primary metric value |
| `valType` | `string` | Value type: 'power_kw', 'flow_m3h', 'temp_c', 'custom' |
| `perc` | `number` | Efficiency percentage (0-100) |
| `deviceStatus` | `string` | Status: 'power_on', 'standby', 'power_off', 'warning', 'danger', 'maintenance', 'no_info' |
| `temperatureC` | `number` | Temperature in Celsius |
| `operationHours` | `number` | Operation hours (decimal) |
| `timaVal` | `number` | Timestamp of last update |

### Return Value

The function returns a `CardHandle` object:

```javascript
interface CardHandle {
  update(next: Partial<EntityObject>): void;
  destroy(): void;
  getRoot(): HTMLElement;
}
```

## Device Type Icons

The component includes icons for the following device types:

| Device Type | Icon | Description |
|-------------|------|-------------|
| `ELEVADOR` | 🟩 | Elevator cabin with arrows |
| `ELEVADOR_SERVICO` | 🟩 | Service elevator (same icon) |
| `ESCADA_ROLANTE` | 🟦 | Escalator with steps |
| `CHILLER` | 🟥 | Cooling/snowflake icon |
| `PUMP` | 💧 | Water droplet with impeller |
| `COMPRESSOR` | ⚙️ | Air compressor |
| `VENTILADOR` | 🌬️ | Fan with blades |
| `MOTOR` | 🔄 | Electric motor |
| `TERMOSTATO` | 🌡️ | Thermometer |
| `SELETOR_AUTO_MANUAL` | 🔘 | Toggle switch |
| `3F_MEDIDOR` | 📟 | Energy meter gauge |
| `CAIXA_D_AGUA` | 💧 | Water tank |
| *Unknown* | ⚙️ | Generic gear (fallback) |

## Device Status States

The component uses standardized device status values based on the `deviceStatus` utility.

| Device Status | Chip Color | Border | Description |
|---------------|------------|--------|-------------|
| `power_on` | Blue | None | Device is powered on and operating normally |
| `standby` | Amber | Orange | Device is in standby/idle mode |
| `power_off` | Red | Red | Device is powered off |
| `warning` | Amber | Orange | Device has a warning condition |
| `danger` | Red | Red | Device has a critical error |
| `maintenance` | Amber | Orange | Device is under maintenance |
| `no_info` | Gray | None | No device information available (offline) |

### Connection Status Derivation

The connection status is automatically derived from `deviceStatus`:
- **Connected**: All statuses except `no_info`
- **Offline**: Only `no_info` status

## Theming

Override CSS variables to customize appearance:

```css
:root {
  --myio-card-radius: 12px;
  --myio-card-shadow: 0 1px 4px rgba(0,0,0,0.1);
  --myio-chip-ok-bg: #e3f2fd;
  --myio-chip-ok-fg: #1976d2;
  --myio-eff-bar-a: #2196f3;
  --myio-eff-bar-b: #bbdefb;
}
```

## Internationalization

Customize labels by providing an `i18n` object:

```javascript
const card = renderCardCompenteHeadOffice(container, {
  entityObject: { /* ... */ },
  i18n: {
    in_operation: 'Operating',
    alert: 'Warning',
    failure: 'Error',
    efficiency: 'Efficiency',
    temperature: 'Temp',
    operation_time: 'Runtime',
    menu_dashboard: 'Dashboard',
    menu_report: 'Report',
    menu_settings: 'Settings'
  }
});
```

## ThingsBoard Integration

Example usage in a ThingsBoard widget:

```javascript
// In widget controller.js
const gridContainer = document.getElementById('cards-grid');

entities.forEach((entity, index) => {
  const cardContainer = document.createElement('div');
  cardContainer.className = 'card-cell';
  gridContainer.appendChild(cardContainer);

  const card = MyIOLibrary.renderCardCompenteHeadOffice(cardContainer, {
    entityObject: {
      entityId: entity.id,
      labelOrName: entity.label || entity.name,
      deviceIdentifier: entity.attributes?.deviceCode,
      deviceType: entity.attributes?.deviceType,
      val: entity.timeseries?.power?.[0]?.value,
      valType: 'power_kw',
      perc: entity.timeseries?.efficiency?.[0]?.value,
      deviceStatus: entity.attributes?.deviceStatus || 'no_info',
      temperatureC: entity.timeseries?.temperature?.[0]?.value,
      operationHours: entity.timeseries?.operationHours?.[0]?.value,
      timaVal: entity.timeseries?.power?.[0]?.ts
    },
    handleActionDashboard: (e, ent) => openEntityDashboard(ent),
    handleActionReport: (e, ent) => generateReport(ent),
    handleActionSettings: (e, ent) => openEntitySettings(ent),
    handleSelect: (checked, ent) => updateSelection(ent, checked),
    handleClickCard: (e, ent) => showEntityDetails(ent),
    enableSelection: true,
    enableDragDrop: false,
    useNewComponents: true
  });

  // Store reference for cleanup
  cardInstances.push(card);
});
```

## Updating Cards

Update card data without re-rendering:

```javascript
// Update specific fields
card.update({
  val: 25.3,
  perc: 92,
  temperatureC: 28,
  deviceStatus: 'warning'
});
```

## Cleanup

Always destroy cards when removing them:

```javascript
// Clean up individual card
card.destroy();

// Clean up all cards
cardInstances.forEach(card => card.destroy());
cardInstances.length = 0;
```

## Events

The component emits custom events for drag and drop:

```javascript
// Listen for drag events
container.addEventListener('myio:dragstart', (e) => {
  console.log('Drag started:', e.detail.entityObject);
});

container.addEventListener('myio:drop', (e) => {
  console.log('Dropped:', e.detail.draggedId, 'onto:', e.detail.targetEntity);
});
```

## Accessibility

The component includes comprehensive accessibility features:

- **Keyboard Navigation**: Tab through interactive elements
- **ARIA Labels**: Screen reader support
- **Focus Management**: Visible focus indicators
- **High Contrast**: Supports high contrast mode
- **Reduced Motion**: Respects motion preferences

### Keyboard Shortcuts

- `Tab` - Navigate between interactive elements
- `Enter`/`Space` - Activate buttons and card
- `Escape` - Close menu
- Arrow keys - Navigate menu items

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Performance

- **Bundle Size**: ~15KB minified (CSS + JS + Icons)
- **Runtime**: Vanilla JS, no framework dependencies
- **Memory**: Efficient cleanup prevents memory leaks
- **Rendering**: Optimized DOM updates

## Troubleshooting

### Common Issues

**Card not rendering:**
- Ensure container element exists
- Check that `entityObject.entityId` is provided
- Verify no JavaScript errors in console

**Icons not showing:**
- Check `deviceType` value matches supported types
- Fallback gear icon should appear for unknown types

**Styles not applied:**
- CSS injection happens automatically
- Check for conflicting CSS rules
- Verify no CSP restrictions on inline styles

**Events not firing:**
- Ensure callback functions are provided
- Check event propagation isn't stopped elsewhere
- Verify element isn't being re-rendered

### Debug Mode

Enable debug logging:

```javascript
// Temporary debug logging
console.log('Entity object:', params.entityObject);
console.log('Card root:', card.getRoot());
```

## Migration from V2

If migrating from `renderCardComponentV2`:

```javascript
// Old V2 approach
renderCardComponentV2({
  entity: entityData,
  // ... other options
});

// New Head Office approach
renderCardCompenteHeadOffice(container, {
  entityObject: entityData,
  // ... other options
});
```

Key differences:
- Separate container parameter
- `entity` → `entityObject`
- Built-in CSS injection
- Enhanced accessibility
- Improved performance
