# MYIO JS Library - User Guide

## 🚀 Overview

The MYIO JS Library is a comprehensive JavaScript library designed for creating interactive device cards with advanced features like selection management, drag-and-drop functionality, and chart comparison capabilities. This library is perfect for IoT dashboards, device monitoring systems, and data visualization applications.

## 📦 Installation

### Option 1: NPM Installation
```bash
npm install myio-js-library
```

### Option 2: CDN Usage
```html
<script src="https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js"></script>
```

### Option 3: Local Build
```bash
git clone https://github.com/gh-myio/myio-js-library.git
cd myio-js-library
npm install
npm run build
```

## 🎯 Quick Start

### Basic Setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MYIO Library Demo</title>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="path/to/myio-js-library.umd.min.js"></script>
</head>
<body>
    <div id="cards-container"></div>
    
    <script>
        // Access components from global MyIOLibrary
        const { 
            renderCardComponentV2,
            MyIOSelectionStore, 
            MyIODraggableCard, 
            MyIOChartModal 
        } = MyIOLibrary;
        
        // Your code here...
    </script>
</body>
</html>
```

## 🏗️ Core Components

### 1. Enhanced Card Component (`renderCardComponentV2`)

The main component for rendering interactive device cards with premium styling and advanced features.

#### Basic Usage

```javascript
const entityObject = {
    entityId: "dev-001",
    labelOrName: "Smart Device",
    deviceIdentifier: "DEV-001",
    entityType: "DEVICE",
    deviceType: "MOTOR",
    val: 1250,
    perc: 45,
    connectionStatus: "online",
    valType: "ENERGY",
    centralName: "Main Hub",
    connectionStatusTime: Date.now() - 300000,
    timaVal: Date.now() - 60000
};

const $card = renderCardComponentV2({
    entityObject: entityObject,
    useNewComponents: true,
    enableSelection: true,
    enableDragDrop: true,
    handleActionDashboard: (entity) => {
        console.log('Dashboard clicked for:', entity.labelOrName);
    },
    handleActionReport: (entity) => {
        console.log('Report clicked for:', entity.labelOrName);
    },
    handleActionSettings: (entity) => {
        console.log('Settings clicked for:', entity.labelOrName);
    },
    handleSelect: (entity) => {
        console.log('Selection changed for:', entity.labelOrName);
    },
    handInfo: true,
    handleClickCard: (entity) => {
        console.log('Card clicked:', entity.labelOrName);
    }
});

$("#cards-container").append($card);
```

#### Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `entityObject` | Object | Required | Device data object |
| `useNewComponents` | Boolean | `true` | Enable enhanced features |
| `enableSelection` | Boolean | `true` | Enable selection functionality |
| `enableDragDrop` | Boolean | `true` | Enable drag and drop |
| `handleActionDashboard` | Function | Optional | Dashboard button handler |
| `handleActionReport` | Function | Optional | Report button handler |
| `handleActionSettings` | Function | Optional | Settings button handler |
| `handleSelect` | Function | Optional | Selection change handler |
| `handInfo` | Boolean | `false` | Show info panel |
| `handleClickCard` | Function | Optional | Card click handler |

### 2. Selection Store (`MyIOSelectionStore`)

Manages device selection state across multiple cards with real-time synchronization.

#### Setup and Usage

```javascript
// Setup analytics (optional)
MyIOSelectionStore.setAnalytics({
    track: (event, data) => {
        console.log('Analytics:', event, data);
    }
});

// Listen to selection changes
MyIOSelectionStore.on('selection:change', (data) => {
    console.log('Selection changed:', {
        count: data.selectedIds.length,
        ids: data.selectedIds,
        totals: MyIOSelectionStore.getTotals()
    });
    
    // Update UI based on selection
    updateSelectionSummary(data);
});

// Programmatic selection management
MyIOSelectionStore.add('dev-001');           // Add device to selection
MyIOSelectionStore.remove('dev-001');        // Remove device from selection
MyIOSelectionStore.clear();                  // Clear all selections
MyIOSelectionStore.isSelected('dev-001');    // Check if device is selected

// Get selection data
const totals = MyIOSelectionStore.getTotals();
const display = MyIOSelectionStore.getMultiUnitTotalDisplay();
```

#### Selection Store Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `add(entityId)` | `string` | `void` | Add device to selection |
| `remove(entityId)` | `string` | `void` | Remove device from selection |
| `clear()` | None | `void` | Clear all selections |
| `isSelected(entityId)` | `string` | `boolean` | Check selection status |
| `getTotals()` | None | `Object` | Get aggregated totals |
| `getMultiUnitTotalDisplay()` | None | `string` | Get formatted display string |
| `openComparison()` | None | `void` | Open chart comparison |

### 3. Chart Modal (`MyIOChartModal`)

Provides chart comparison and export functionality for selected devices.

#### Usage

```javascript
// Export functionality
if (MyIOChartModal) {
    // Export as CSV
    MyIOChartModal.exportCsv();
    
    // Export as PNG
    MyIOChartModal.exportPng();
}

// The chart modal is automatically opened when using:
MyIOSelectionStore.openComparison();
```

### 4. Draggable Card (`MyIODraggableCard`)

Enables drag-and-drop functionality for cards with footer dock integration.

#### Automatic Integration

The drag-and-drop functionality is automatically enabled when `enableDragDrop: true` is set in the card configuration. Cards can be dragged to footer docks or other drop zones.

## 🎨 Styling and Themes

### Premium Design Features

The library includes premium styling with:

- **Gradient Backgrounds**: Beautiful linear gradients for depth
- **Glass-morphism Effects**: Modern backdrop blur effects
- **Interactive Animations**: Smooth hover states and transitions
- **Professional Typography**: Optimized font weights and spacing
- **Responsive Design**: Mobile-friendly layouts
- **Dark Mode Support**: Automatic theme detection

### Custom Styling

You can override the default styles by adding custom CSS:

```css
/* Custom card styling */
.device-card-centered.clickable {
    border-radius: 20px !important;
    background: your-custom-gradient !important;
}

/* Custom selection state */
.device-card-centered.selected {
    border-color: #your-color !important;
    box-shadow: 0 8px 24px rgba(your-color, 0.3) !important;
}
```

## 📱 Device Types and Images

### Supported Device Types

The library automatically maps device types to appropriate images:

| Device Type | Image | Description |
|-------------|-------|-------------|
| `MOTOR` | Motor icon | Electric motors and pumps |
| `3F_MEDIDOR` | Meter icon | Three-phase energy meters |
| `RELOGIO` | Clock icon | Time-based devices |
| `HIDROMETRO` | Water meter | Water consumption meters |
| `ENTRADA` | Input icon | System inputs and sensors |
| `CAIXA_DAGUA` | Tank icon | Water tanks and reservoirs |

### Custom Device Images

You can extend the device image mapping by modifying the `getDeviceImageUrl` function or providing custom images in your entity objects.

## 🔧 Advanced Configuration

### Entity Object Structure

```javascript
const entityObject = {
    // Required fields
    entityId: "unique-device-id",
    labelOrName: "Display Name",
    deviceType: "MOTOR", // See supported types above
    val: 1250, // Current value
    perc: 45, // Percentage value
    
    // Optional fields
    deviceIdentifier: "DEV-001", // Device identifier (shown below name)
    entityType: "DEVICE",
    slaveId: "01",
    ingestionId: "ing-001",
    centralId: "central-001",
    connectionStatus: "online", // online, offline, warning, etc.
    centralName: "Main Hub",
    connectionStatusTime: Date.now() - 300000,
    timaVal: Date.now() - 60000,
    valType: "ENERGY", // ENERGY, WATER, TANK
    
    // Additional data
    updatedIdentifiers: {},
    group: "device-group"
};
```

### Connection Status Values

| Status | Description | Visual Indicator |
|--------|-------------|------------------|
| `online` / `connected` | Device is online | Green checkmark ✅ |
| `offline` | Device is offline | Red plug 🔌 (flashing) |
| `warning` | Device has warnings | Yellow warning ⚠️ |
| `danger` | Device has errors | Red alert 🚨 |
| `maintenance` | Device in maintenance | Tool icon 🛠️ |

### Value Types and Units

| Value Type | Unit | Description |
|------------|------|-------------|
| `ENERGY` | kWh | Energy consumption |
| `WATER` | m³ | Water consumption |
| `TANK` | m.c.a | Tank level measurement |

## 📊 Analytics and Monitoring

### Event Tracking

```javascript
// Setup analytics tracking
MyIOSelectionStore.setAnalytics({
    track: (event, data) => {
        // Send to your analytics service
        analytics.track(event, {
            ...data,
            timestamp: new Date().toISOString(),
            userId: getCurrentUserId()
        });
    }
});

// Events automatically tracked:
// - selection:add
// - selection:remove
// - selection:clear
// - comparison:open
// - export:csv
// - export:png
// - card:click
// - action:dashboard
// - action:report
// - action:settings
```

### Custom Event Logging

```javascript
function logAnalytics(event, data, type = 'event') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${event}:`, data);
    
    // Send to your logging service
    logger.log({
        event,
        data,
        type,
        timestamp
    });
}
```

## 🎮 Interactive Features

### Selection Management UI

```javascript
// Update selection summary
function updateSelectionSummary(selectionData) {
    const summaryElement = document.getElementById('summary-text');
    const compareBtn = document.getElementById('compare-btn');
    
    if (selectionData.selectedIds.length === 0) {
        summaryElement.textContent = 'No items selected';
        compareBtn.disabled = true;
    } else {
        const display = MyIOSelectionStore.getMultiUnitTotalDisplay();
        summaryElement.innerHTML = `
            <strong>${selectionData.selectedIds.length} items selected</strong><br>
            ${display}
        `;
        compareBtn.disabled = selectionData.selectedIds.length < 2;
    }
}

// Control buttons
document.getElementById('select-all-btn').addEventListener('click', () => {
    entities.forEach(entity => {
        MyIOSelectionStore.add(entity.entityId);
    });
});

document.getElementById('clear-btn').addEventListener('click', () => {
    MyIOSelectionStore.clear();
});

document.getElementById('compare-btn').addEventListener('click', () => {
    MyIOSelectionStore.openComparison();
});
```

### Drag and Drop Integration

```javascript
// Setup drop zones
const dropZone = document.getElementById('footer-dock');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const entityData = JSON.parse(e.dataTransfer.getData('application/json'));
    console.log('Dropped entity:', entityData);
    
    // Handle the dropped entity
    addToFooterDock(entityData);
});
```

## 🔄 Version Compatibility

### Legacy Support

The library maintains backward compatibility with the original card component:

```javascript
// Use legacy version
const $legacyCard = renderCardComponent({
    entityObject: entityObject,
    // ... legacy options
});

// Or explicitly disable new components
const $card = renderCardComponentV2({
    entityObject: entityObject,
    useNewComponents: false, // Falls back to legacy
    // ... other options
});
```

### Migration Guide

To migrate from the legacy version:

1. Replace `renderCardComponent` with `renderCardComponentV2`
2. Add new configuration options as needed
3. Set up `MyIOSelectionStore` for selection management
4. Update event handlers to use the new callback structure

## 🐛 Troubleshooting

### Common Issues

#### 1. "MyIOLibrary is not defined"
**Solution**: Ensure the UMD script is loaded before your code:
```html
<script src="path/to/myio-js-library.umd.min.js"></script>
<script>
    // Your code here - MyIOLibrary should now be available
</script>
```

#### 2. Cards not rendering
**Solution**: Check that jQuery is loaded and the container element exists:
```javascript
$(document).ready(function() {
    // Your card rendering code here
});
```

#### 3. Selection not working
**Solution**: Ensure `enableSelection: true` and `MyIOSelectionStore` is available:
```javascript
if (MyIOSelectionStore) {
    // Selection functionality available
} else {
    console.error('MyIOSelectionStore not available');
}
```

#### 4. Images not loading
**Solution**: Check device type mapping and image URLs:
```javascript
// Verify device type is supported
const supportedTypes = ['MOTOR', '3F_MEDIDOR', 'RELOGIO', 'HIDROMETRO', 'ENTRADA', 'CAIXA_DAGUA'];
console.log('Supported types:', supportedTypes);
```

### Debug Mode

Enable debug logging:
```javascript
// Enable verbose logging
MyIOSelectionStore.setAnalytics({
    track: (event, data) => {
        console.log('🔍 Debug:', event, data);
    }
});
```

## 📚 Examples

### Complete Working Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MYIO Library Example</title>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="path/to/myio-js-library.umd.min.js"></script>
    <style>
        .cards-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        .selection-summary {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="selection-summary">
        <h3>Selection Summary</h3>
        <div id="summary-text">No items selected</div>
        <button id="compare-btn" disabled>Compare Selected</button>
        <button id="clear-btn">Clear Selection</button>
        <button id="select-all-btn">Select All</button>
    </div>
    
    <div class="cards-container" id="cards-container"></div>

    <script>
        const { renderCardComponentV2, MyIOSelectionStore } = MyIOLibrary;
        
        // Sample data
        const devices = [
            {
                entityId: "dev-001",
                labelOrName: "Smart Motor",
                deviceIdentifier: "MOT-001",
                deviceType: "MOTOR",
                val: 1250,
                perc: 45,
                connectionStatus: "online",
                valType: "ENERGY"
            },
            {
                entityId: "dev-002",
                labelOrName: "Water Meter",
                deviceIdentifier: "HID-001",
                deviceType: "HIDROMETRO",
                val: 156,
                perc: 85,
                connectionStatus: "online",
                valType: "WATER"
            }
        ];
        
        // Setup selection store
        MyIOSelectionStore.on('selection:change', (data) => {
            const summaryText = document.getElementById('summary-text');
            const compareBtn = document.getElementById('compare-btn');
            
            if (data.selectedIds.length === 0) {
                summaryText.textContent = 'No items selected';
                compareBtn.disabled = true;
            } else {
                const display = MyIOSelectionStore.getMultiUnitTotalDisplay();
                summaryText.innerHTML = `
                    <strong>${data.selectedIds.length} items selected</strong><br>
                    ${display}
                `;
                compareBtn.disabled = data.selectedIds.length < 2;
            }
        });
        
        // Render cards
        devices.forEach(device => {
            const $card = renderCardComponentV2({
                entityObject: device,
                useNewComponents: true,
                enableSelection: true,
                enableDragDrop: true,
                handleActionDashboard: (entity) => {
                    alert(`Dashboard for ${entity.labelOrName}`);
                },
                handleActionReport: (entity) => {
                    alert(`Report for ${entity.labelOrName}`);
                },
                handleActionSettings: (entity) => {
                    alert(`Settings for ${entity.labelOrName}`);
                }
            });
            
            $("#cards-container").append($card);
        });
        
        // Button handlers
        document.getElementById('compare-btn').addEventListener('click', () => {
            MyIOSelectionStore.openComparison();
        });
        
        document.getElementById('clear-btn').addEventListener('click', () => {
            MyIOSelectionStore.clear();
        });
        
        document.getElementById('select-all-btn').addEventListener('click', () => {
            devices.forEach(device => {
                MyIOSelectionStore.add(device.entityId);
            });
        });
    </script>
</body>
</html>
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [GitHub Wiki](https://github.com/gh-myio/myio-js-library/wiki)
- **Issues**: [GitHub Issues](https://github.com/gh-myio/myio-js-library/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gh-myio/myio-js-library/discussions)

---

**Happy coding with MYIO JS Library! 🚀**
