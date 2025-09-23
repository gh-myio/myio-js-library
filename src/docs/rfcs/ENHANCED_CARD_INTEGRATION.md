# Enhanced Card Integration with MYIO Components

## Overview

The `renderCardComponentV2` provides an enhanced version of the original ThingsBoard card component that integrates seamlessly with the new MYIO drag-to-footer dock components (`MyIOSelectionStore`, `MyIODraggableCard`, and `MyIOChartModal`).

## Key Features

### 🔄 **Backward Compatibility**
- Maintains full API compatibility with original `renderCardComponent`
- Automatic fallback to legacy implementation when new components are unavailable
- Progressive enhancement approach

### 🎯 **Enhanced Functionality**
- **Selection Management**: Automatic integration with `MyIOSelectionStore`
- **Drag & Drop**: Built-in drag-and-drop capabilities via `MyIODraggableCard`
- **Visual Feedback**: Enhanced selection states and status indicators
- **Accessibility**: Full keyboard navigation and screen reader support

### ⚡ **Performance Optimized**
- Lazy loading of new components
- Minimal bundle size impact when not used
- Tree-shakeable exports

## Usage Examples

### Basic Usage (Auto-Enhanced)

```javascript
import { renderCardComponentEnhanced } from 'myio-js-library';

// Automatically uses enhanced version if components are available
const card = renderCardComponentEnhanced({
  entityObject: {
    entityId: 'device-001',
    labelOrName: 'Solar Panel A',
    deviceType: 'MOTOR',
    val: 1250,
    valType: 'ENERGY',
    connectionStatus: 'connected'
  },
  handleActionDashboard: (entity) => {
    console.log('Dashboard clicked:', entity.labelOrName);
  },
  handleSelect: (entity) => {
    console.log('Selection changed:', entity.labelOrName);
  }
});

$('#device-container').append(card);
```

### Explicit Version Control

```javascript
import { renderCardComponentV2, renderCardComponentLegacy } from 'myio-js-library';

// Force use of enhanced version
const enhancedCard = renderCardComponentV2({
  entityObject: deviceData,
  useNewComponents: true,
  enableSelection: true,
  enableDragDrop: true,
  handleActionDashboard: handleDashboard
});

// Force use of legacy version
const legacyCard = renderCardComponentLegacy({
  entityObject: deviceData,
  handleActionDashboard: handleDashboard
});
```

### ThingsBoard Widget Integration

```javascript
// In your ThingsBoard widget
import { renderCardComponentEnhanced, MyIOSelectionStore } from 'myio-js-library';

// Setup selection store
MyIOSelectionStore.setAnalytics({
  track: (event, data) => {
    // Send to ThingsBoard telemetry
    ctx.http.post('/api/telemetry', { event, data });
  }
});

// Listen for comparison events
MyIOSelectionStore.on('comparison:open', (data) => {
  // Open comparison dashboard
  ctx.stateController.openState('comparison', {
    entities: data.entities,
    totals: data.totals
  });
});

// Render cards with enhanced functionality
entities.forEach(entity => {
  const card = renderCardComponentEnhanced({
    entityObject: entity,
    enableSelection: true,
    enableDragDrop: true,
    handleActionDashboard: (entity) => {
      ctx.stateController.openState('device-dashboard', {
        entityId: entity.entityId
      });
    },
    handleSelect: (entity) => {
      // Selection is automatically handled by MyIOSelectionStore
      console.log('Entity selected:', entity.labelOrName);
    }
  });
  
  $('#cards-container').append(card);
});
```

## API Reference

### renderCardComponentV2(options)

Enhanced version with new component integration.

**Parameters:**
- `options.entityObject` - Device/entity data (same as original)
- `options.handleActionDashboard` - Dashboard click handler (same as original)
- `options.handleActionReport` - Report click handler (same as original)
- `options.handleActionSettings` - Settings click handler (same as original)
- `options.handleSelect` - Selection handler (same as original)
- `options.handInfo` - Show info panel (same as original)
- `options.handleClickCard` - Card click handler (same as original)
- `options.useNewComponents` - Enable/disable new components (default: true)
- `options.enableSelection` - Enable selection functionality (default: true)
- `options.enableDragDrop` - Enable drag and drop (default: true)

**Returns:** jQuery-like object with enhanced methods

### renderCardComponentEnhanced(options)

Smart wrapper that automatically chooses between enhanced and legacy versions.

**Auto-Detection Logic:**
1. Checks if `MyIOSelectionStore` and `MyIODraggableCard` are available
2. Respects `options.useNewComponents` flag
3. Falls back to legacy implementation if components unavailable

### renderCardComponentLegacy(options)

Direct access to original implementation for compatibility.

## Component Mapping

### Device Type to Icon Mapping

```javascript
const iconMapping = {
  'MOTOR': 'energy',
  '3F_MEDIDOR': 'energy', 
  'RELOGIO': 'energy',
  'HIDROMETRO': 'water',
  'ENTRADA': 'energy',
  'CAIXA_DAGUA': 'water',
  'TANK': 'water'
};
```

### Connection Status Mapping

```javascript
const statusMapping = {
  'connected': 'ok',
  'offline': 'offline',
  'power_on': 'ok',
  'standby': 'alert',
  'power_off': 'fail',
  'warning': 'alert',
  'danger': 'fail',
  'maintenance': 'alert'
};
```

### Value Type to Unit Mapping

```javascript
const unitMapping = {
  'ENERGY': 'kWh',
  'WATER': 'm³',
  'TANK': 'm.c.a'
};
```

## Enhanced Features

### 1. Selection Integration

Cards automatically register with `MyIOSelectionStore`:

```javascript
// Entity is automatically registered
MyIOSelectionStore.registerEntity({
  id: entityId,
  name: labelOrName,
  icon: mapDeviceTypeToIcon(deviceType),
  group: deviceIdentifier,
  lastValue: val,
  unit: determineUnit(valType),
  status: mapConnectionStatus(connectionStatus)
});

// Selection state is synchronized
MyIOSelectionStore.on('selection:change', (data) => {
  // Card visual state updates automatically
});
```

### 2. Drag and Drop

Enhanced cards support drag-and-drop:

```javascript
// Drag data includes entity information
card.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('text/myio-id', entityId);
  e.dataTransfer.setData('application/json', JSON.stringify(entityObject));
});
```

### 3. Visual Enhancements

- **Selection State**: Green border and background gradient
- **Status Indicators**: Color-coded status dots
- **Hover Effects**: Smooth scale transitions
- **Offline Animation**: Blinking red border for offline devices

### 4. Info Panel

Enhanced info panel with formatted data:

```javascript
// Displays connection and telemetry information
const infoContent = `
  <strong>Central:</strong> ${centralName}<br>
  <strong>Última Conexão:</strong> ${connectionDate}<br>
  <strong>Última Telemetria:</strong> ${telemetryDate} (${timeAgo})
`;
```

## Migration Guide

### From Original to Enhanced

1. **No Code Changes Required** (for basic usage):
   ```javascript
   // This automatically uses enhanced version if available
   import { renderCardComponent } from 'myio-js-library';
   ```

2. **Explicit Enhanced Usage**:
   ```javascript
   // Change import to use enhanced version explicitly
   import { renderCardComponentEnhanced } from 'myio-js-library';
   ```

3. **Enable New Features**:
   ```javascript
   const card = renderCardComponentEnhanced({
     entityObject: data,
     enableSelection: true,    // Enable selection store integration
     enableDragDrop: true,     // Enable drag and drop
     handleSelect: (entity) => {
       // Handle selection events
     }
   });
   ```

### Compatibility Notes

- **jQuery Compatibility**: Returns jQuery-like object with same methods
- **Event Handling**: All original event handlers work unchanged
- **Styling**: Enhanced CSS is additive, doesn't break existing styles
- **Performance**: Minimal overhead when new features are disabled

## Best Practices

### 1. Progressive Enhancement

```javascript
// Check for component availability
const hasEnhancedComponents = typeof MyIOSelectionStore !== 'undefined';

const card = renderCardComponent({
  entityObject: data,
  useNewComponents: hasEnhancedComponents,
  enableSelection: hasEnhancedComponents,
  handleActionDashboard: handleDashboard
});
```

### 2. Selection Management

```javascript
// Setup analytics before using selection
MyIOSelectionStore.setAnalytics({
  track: (event, data) => {
    analytics.track(event, data);
  }
});

// Listen for comparison events
MyIOSelectionStore.on('comparison:open', async (data) => {
  if (data.count >= 2) {
    await MyIOChartModal.open(data);
  }
});
```

### 3. Cleanup

```javascript
// Cleanup when removing cards
card.destroy(); // Removes event listeners and DOM elements
```

## Browser Support

- **Modern Browsers**: Full functionality with all features
- **Legacy Browsers**: Automatic fallback to original implementation
- **Mobile**: Touch-friendly drag and drop with long-press detection

## Performance Considerations

- **Bundle Size**: +~15KB when enhanced components are used
- **Runtime**: Minimal performance impact
- **Memory**: Automatic cleanup prevents memory leaks
- **Network**: Chart.js loaded on-demand only when needed

## Troubleshooting

### Common Issues

1. **Components Not Loading**:
   ```javascript
   // Check if components are available
   console.log('SelectionStore:', typeof MyIOSelectionStore);
   console.log('DraggableCard:', typeof MyIODraggableCard);
   ```

2. **Selection Not Working**:
   ```javascript
   // Ensure entity is registered
   MyIOSelectionStore.registerEntity(entityData);
   ```

3. **Styling Issues**:
   ```javascript
   // Check if enhanced styles are loaded
   console.log('Enhanced styles:', !!document.getElementById('myio-enhanced-card-styles'));
   ```

### Debug Mode

```javascript
// Enable debug logging
MyIOSelectionStore.setDebug(true);

// Check component versions
console.log('MYIO Components Version:', MyIOSelectionStore.version);
```

## Future Enhancements

- **Real-time Updates**: WebSocket integration for live data updates
- **Advanced Filtering**: Filter cards by selection criteria
- **Bulk Operations**: Multi-select actions and bulk operations
- **Custom Themes**: Configurable color schemes and layouts
- **Export Integration**: Direct export from card selection
