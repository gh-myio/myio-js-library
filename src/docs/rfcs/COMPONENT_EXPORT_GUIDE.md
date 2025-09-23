# MYIO Component Export Guide

This document provides detailed instructions for exporting and using the three main components from the MYIO Drag-to-Footer Dock implementation: **SelectionStore**, **DraggableCard**, and **ChartModal**.

## 📋 Table of Contents

1. [Overview](#overview)
2. [SelectionStore Component](#selectionstore-component)
3. [DraggableCard Component](#draggablecard-component)
4. [ChartModal Component](#chartmodal-component)
5. [Integration Examples](#integration-examples)
6. [Dependencies](#dependencies)
7. [Browser Support](#browser-support)
8. [Troubleshooting](#troubleshooting)

---

## Overview

These components implement the RFC: Drag-to-Footer Dock for Comparative Selection in MYIO SIM. They provide a complete solution for:

- **Global state management** (SelectionStore)
- **Draggable card interface** (DraggableCard)
- **Interactive chart visualization** (ChartModal)

### Component Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  SelectionStore │◄──►│  DraggableCard  │    │   ChartModal    │
│   (Singleton)   │    │   (Multiple)    │    │   (Singleton)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                        │                        ▲
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  ▼
                        ┌─────────────────┐
                        │  Footer Dock    │
                        │  Integration    │
                        └─────────────────┘
```

---

## SelectionStore Component

### 📝 Description

Global singleton for managing selection state, multi-unit totals, time-series data, and analytics across the entire application.

### 🚀 Export Instructions

#### File Location
```
shared/SelectionStore.js
```

#### Dependencies
- None (vanilla JavaScript)

#### Export Method
```javascript
// The component auto-exports to global scope
window.MyIOSelectionStore // Singleton instance
window.MyIOSelectionStoreClass // Class constructor
```

### 📖 Complete API Reference

#### Core Selection Methods

```javascript
// Add item to selection
MyIOSelectionStore.add(id: string): void

// Remove item from selection
MyIOSelectionStore.remove(id: string): void

// Toggle item selection
MyIOSelectionStore.toggle(id: string): void

// Clear all selections
MyIOSelectionStore.clear(): void

// Sync with checkbox state
MyIOSelectionStore.syncFromCheckbox(id: string, checked: boolean): void
```

#### Entity Management

```javascript
// Register entity for selection
MyIOSelectionStore.registerEntity(entity: EntitySummary): void

// Unregister entity
MyIOSelectionStore.unregisterEntity(id: string): void

// Entity structure
interface EntitySummary {
  id: string;
  name: string;
  icon: 'energy' | 'water' | 'temp' | 'net' | 'alert' | 'generic';
  group: string;
  lastValue: number;
  unit: 'kWh' | 'm³' | '°C' | '%';
}
```

#### State Getters

```javascript
// Get selected IDs array
MyIOSelectionStore.getSelectedIds(): string[]

// Get selected entities with full data
MyIOSelectionStore.getSelectedEntities(): EntitySummary[]

// Get computed totals
MyIOSelectionStore.getTotals(): {
  energyKwh: number;
  waterM3: number;
  tempC: number;
  percentage: number;
  count: number;
  unitBreakdown: Record<string, number>;
}

// Check if item is selected
MyIOSelectionStore.isSelected(id: string): boolean

// Get selection count
MyIOSelectionStore.getSelectionCount(): number

// Get multi-unit display string
MyIOSelectionStore.getMultiUnitTotalDisplay(): string
// Returns: "Energy: 1,234 kWh | Water: 567 m³"
```

#### Event System

```javascript
// Listen to events
MyIOSelectionStore.on(event: string, callback: Function): void

// Remove event listener
MyIOSelectionStore.off(event: string, callback: Function): void

// Available events:
// - 'selection:change' - When selection changes
// - 'selection:totals' - When totals are recomputed
// - 'comparison:open' - When comparison is requested
// - 'comparison:too_many' - When >20 items selected

// Event data structures
interface SelectionChangeEvent {
  action: 'add' | 'remove' | 'clear';
  id?: string;
  selectedIds: string[];
  totals: TotalsObject;
}
```

#### Time-Series Data (Phase 2)

```javascript
// Get time-series data with caching
MyIOSelectionStore.getTimeSeriesData(
  entityIds: string[], 
  startDate: Date, 
  endDate: Date
): Promise<TimeSeriesData>

// Invalidate cache
MyIOSelectionStore.invalidateCache(reason?: string): void

// Time-series data structure
interface TimeSeriesData {
  [entityId: string]: {
    timestamp: number;
    value: number;
    unit: string;
  }[];
}
```

#### Analytics Integration

```javascript
// Set analytics provider
MyIOSelectionStore.setAnalytics(analyticsInstance: {
  track: (event: string, payload: object) => void;
}): void

// Manual event tracking
MyIOSelectionStore.trackEvent(eventName: string, payload?: object): void

// Tracked events:
// - footer_dock.drop_add
// - footer_dock.remove_chip
// - footer_dock.total_update
// - card.checkbox_toggle
// - chart_modal.open
// - chart_modal.type_change
// - chart_modal.range_change
// - chart_modal.export
// - chart_modal.too_many_entities
```

#### Comparison Actions

```javascript
// Open comparison (triggers chart modal)
MyIOSelectionStore.openComparison(): boolean

// Drag start tracking
MyIOSelectionStore.startDrag(id: string): void
```

#### Accessibility

```javascript
// Screen reader announcements
MyIOSelectionStore.announceToScreenReader(message: string): void
```

### 💡 Usage Examples

#### Basic Setup
```javascript
// 1. Load the script
<script src="path/to/SelectionStore.js"></script>

// 2. Register entities
const entity = {
  id: 'device-001',
  name: 'Solar Panel North',
  icon: 'energy',
  group: 'RENEWABLE_ENERGY',
  lastValue: 145.6,
  unit: 'kWh'
};
MyIOSelectionStore.registerEntity(entity);

// 3. Listen to changes
MyIOSelectionStore.on('selection:change', (data) => {
  console.log('Selection changed:', data);
  updateUI(data.selectedIds);
});

// 4. Add to selection
MyIOSelectionStore.add('device-001');
```

#### Analytics Integration
```javascript
// Setup analytics
MyIOSelectionStore.setAnalytics({
  track: (event, data) => {
    // Send to your analytics service
    gtag('event', event, data);
    // or
    analytics.track(event, data);
  }
});
```

#### Multi-Unit Display
```javascript
// Get formatted totals
const display = MyIOSelectionStore.getMultiUnitTotalDisplay();
// Returns: "Energy: 1,234 kWh | Water: 567 m³ | Temp: 24.5 °C"

document.getElementById('totals').textContent = display;
```

---

## DraggableCard Component

### 📝 Description

Reusable card component with full drag-and-drop support, checkbox synchronization, and accessibility features.

### 🚀 Export Instructions

#### File Location
```
shared/DraggableCard.js
```

#### Dependencies
- SelectionStore.js (must be loaded first)

#### Export Method
```javascript
// The component exports to global scope
window.MyIODraggableCard // Class constructor
```

### 📖 Complete API Reference

#### Constructor

```javascript
new MyIODraggableCard(
  container: HTMLElement,
  entity: EntitySummary,
  options?: CardOptions
)

interface CardOptions {
  showCheckbox?: boolean;    // Default: true
  draggable?: boolean;       // Default: true
  className?: string;        // Additional CSS class
}
```

#### Entity Structure

```javascript
interface EntitySummary {
  id: string;                // Unique identifier
  name: string;              // Display name
  icon: 'energy' | 'water' | 'temp' | 'net' | 'alert' | 'generic';
  group: string;             // Group/category name
  lastValue: number;         // Current value
  unit: 'kWh' | 'm³' | '°C' | '%'; // Unit of measurement
  status: 'ok' | 'alert' | 'fail' | 'offline'; // Device status
}
```

#### Public Methods

```javascript
// Destroy the card and clean up
card.destroy(): void

// Update entity data
card.updateEntity(newEntity: Partial<EntitySummary>): void

// Manual selection control
card.setSelected(selected: boolean): void
```

#### Event Handling

The component automatically handles:
- **Mouse drag-and-drop** - Standard HTML5 drag API
- **Touch drag** - Long-press (500ms) detection
- **Keyboard navigation** - Tab, Enter, Space, Shift+Enter, Delete
- **Checkbox sync** - Two-way synchronization with SelectionStore

#### Drag Data Transfer

```javascript
// Data set during drag
dataTransfer.setData('text/myio-id', entity.id);
dataTransfer.setData('text/plain', entity.id);
```

#### Accessibility Features

- **ARIA attributes**: `role`, `aria-grabbed`, `aria-selected`, `aria-label`
- **Screen reader support**: Descriptive labels and announcements
- **Keyboard navigation**: Full keyboard accessibility
- **Focus management**: Clear focus indicators

### 💡 Usage Examples

#### Basic Card Creation
```javascript
// 1. Load dependencies
<script src="path/to/SelectionStore.js"></script>
<script src="path/to/DraggableCard.js"></script>

// 2. Create container
const container = document.getElementById('card-grid');

// 3. Define entity
const entity = {
  id: 'pump-001',
  name: 'Water Pump Main',
  icon: 'water',
  group: 'HYDRAULIC_SYSTEM',
  lastValue: 234.7,
  unit: 'm³',
  status: 'ok'
};

// 4. Create card
const card = new MyIODraggableCard(container, entity, {
  showCheckbox: true,
  draggable: true,
  className: 'custom-card'
});
```

#### Multiple Cards with Different Options
```javascript
const entities = [
  { id: 'e1', name: 'Device 1', icon: 'energy', lastValue: 100, unit: 'kWh' },
  { id: 'e2', name: 'Device 2', icon: 'water', lastValue: 200, unit: 'm³' }
];

const cards = entities.map(entity => {
  return new MyIODraggableCard(container, entity, {
    showCheckbox: true,
    draggable: true,
    className: 'grid-card'
  });
});
```

#### Dynamic Updates
```javascript
// Update entity data
card.updateEntity({
  lastValue: 156.8,
  status: 'alert'
});

// Manual selection
card.setSelected(true);

// Cleanup
card.destroy();
```

#### Custom Styling
```css
.custom-card {
  border: 2px solid #00e09e;
  box-shadow: 0 4px 12px rgba(0,224,158,0.2);
}

.custom-card.selected {
  background: linear-gradient(135deg, #f0fdf9, #ecfdf5);
}

.custom-card:hover {
  transform: translateY(-4px);
}
```

---

## ChartModal Component

### 📝 Description

Interactive chart modal for comparative visualization with Chart.js integration, export functionality, and full accessibility support.

### 🚀 Export Instructions

#### File Location
```
shared/ChartModal.js
```

#### Dependencies
- SelectionStore.js (must be loaded first)
- Chart.js (auto-loaded from CDN)

#### Export Method
```javascript
// The component auto-exports singleton to global scope
window.MyIOChartModal // Singleton instance
```

### 📖 Complete API Reference

#### Automatic Integration

The ChartModal automatically integrates with SelectionStore:
```javascript
// Listens for these events:
MyIOSelectionStore.on('comparison:open', data => modal.open(data));
MyIOSelectionStore.on('comparison:too_many', data => modal.showWarning(data));
```

#### Manual Control Methods

```javascript
// Open modal with data
MyIOChartModal.open(data: ComparisonData): Promise<void>

// Close modal
MyIOChartModal.close(): void

// Check if modal is open
MyIOChartModal.isOpen: boolean
```

#### Data Structures

```javascript
interface ComparisonData {
  entities: EntitySummary[];
  totals: TotalsObject;
  count: number;
}

interface ChartConfiguration {
  type: 'line' | 'bar';
  timeRange: 7 | 14 | 30; // days
  maxEntities: 20;
}
```

#### Chart Features

- **Chart Types**: Line chart (default), Stacked bar chart
- **Time Ranges**: 7 days (default), 14 days, 30 days
- **Data Sources**: Real-time time-series data with caching
- **Responsive**: Adapts to container size
- **Interactive**: Hover tooltips, legend toggle

#### Export Functions

```javascript
// Export as CSV
MyIOChartModal.exportCsv(): void
// Downloads: comparativo_[timestamp].csv

// Export as PNG
MyIOChartModal.exportPng(): void
// Downloads: grafico_comparativo_[timestamp].png

// Export as PDF (placeholder)
MyIOChartModal.exportPdf(): void
// Shows implementation notice
```

#### Analytics Events

The modal automatically tracks:
- `chart_modal.open` - Modal opened
- `chart_modal.close` - Modal closed
- `chart_modal.type_change` - Chart type changed
- `chart_modal.range_change` - Time range changed
- `chart_modal.export` - Export action
- `chart_modal.too_many_entities` - >20 entities warning

#### Accessibility Features

- **ARIA dialog** - Proper modal semantics
- **Keyboard navigation** - Tab, Escape, Enter
- **Screen reader** - Announcements and descriptions
- **Focus management** - Trapped focus within modal
- **High contrast** - Accessible color schemes

### 💡 Usage Examples

#### Automatic Usage (Recommended)
```javascript
// 1. Load dependencies
<script src="path/to/SelectionStore.js"></script>
<script src="path/to/ChartModal.js"></script>

// 2. The modal automatically integrates
// When user clicks "Compare" button, modal opens automatically
// No additional code needed!
```

#### Manual Control
```javascript
// Open modal manually
const data = {
  entities: MyIOSelectionStore.getSelectedEntities(),
  totals: MyIOSelectionStore.getTotals(),
  count: MyIOSelectionStore.getSelectionCount()
};

MyIOChartModal.open(data);

// Close modal
MyIOChartModal.close();
```

#### Custom Analytics
```javascript
// The modal uses SelectionStore analytics
MyIOSelectionStore.setAnalytics({
  track: (event, data) => {
    if (event.startsWith('chart_modal.')) {
      // Handle chart-specific analytics
      console.log('Chart event:', event, data);
    }
  }
});
```

#### Styling Customization
```css
/* Override modal styles */
.chart-modal-overlay {
  background: rgba(0, 0, 0, 0.9);
}

.chart-modal-container {
  border-radius: 16px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);
}

.chart-modal-header {
  background: linear-gradient(135deg, #1e293b, #334155);
  color: white;
}
```

---

## Integration Examples

### 🔧 Complete ThingsBoard Widget Integration

#### 1. Widget HTML Template
```html
<div class="widget-container">
  <div class="widget-header">
    <h2>Device Comparison</h2>
  </div>
  <div class="widget-content" id="deviceGrid">
    <!-- Cards will be rendered here -->
  </div>
</div>

<!-- Load components -->
<script src="../shared/SelectionStore.js"></script>
<script src="../shared/DraggableCard.js"></script>
<script src="../shared/ChartModal.js"></script>
```

#### 2. Widget Controller
```javascript
// ThingsBoard widget controller
function initializeWidget(ctx) {
  const container = ctx.$container.find('.widget-content')[0];
  const cards = [];

  // Setup analytics
  MyIOSelectionStore.setAnalytics({
    track: (event, data) => {
      // Send to ThingsBoard telemetry
      ctx.telemetryService.saveEntityTelemetry(
        ctx.defaultSubscription.entityId,
        'ANALYTICS',
        [{ ts: Date.now(), values: { event, data: JSON.stringify(data) } }]
      );
    }
  });

  // Load device data
  ctx.datasources.forEach(datasource => {
    datasource.data.forEach(dataPoint => {
      const entity = {
        id: dataPoint.entityId,
        name: dataPoint.entityName,
        icon: getIconFromType(dataPoint.entityType),
        group: dataPoint.entityLabel,
        lastValue: dataPoint.value,
        unit: dataPoint.unit
      };

      // Create card
      const card = new MyIODraggableCard(container, entity);
      cards.push(card);
    });
  });

  // Cleanup on destroy
  ctx.onDestroy = () => {
    cards.forEach(card => card.destroy());
    MyIOSelectionStore.clear();
  };
}
```

#### 3. Footer Widget Integration
```javascript
// Footer widget controller
function initializeFooter(ctx) {
  const footerContainer = ctx.$container[0];
  
  // Load footer controller
  // (Use existing FOOTER/controller.js)
  
  // The footer automatically integrates with SelectionStore
  // No additional code needed!
}
```

### 🌐 Standalone Web Application

#### 1. HTML Structure
```html
<!DOCTYPE html>
<html>
<head>
  <title>Device Comparison App</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div class="app">
    <header class="app-header">
      <h1>Device Comparison Dashboard</h1>
    </header>
    
    <main class="app-main">
      <div class="device-grid" id="deviceGrid"></div>
    </main>
    
    <footer class="app-footer" id="appFooter">
      <!-- Footer dock will be rendered here -->
    </footer>
  </div>

  <!-- Load components -->
  <script src="components/SelectionStore.js"></script>
  <script src="components/DraggableCard.js"></script>
  <script src="components/ChartModal.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

#### 2. Application Logic
```javascript
// app.js
class DeviceComparisonApp {
  constructor() {
    this.devices = [];
    this.cards = [];
    this.init();
  }

  async init() {
    // Setup analytics
    MyIOSelectionStore.setAnalytics({
      track: (event, data) => {
        // Send to your analytics service
        gtag('event', event, data);
      }
    });

    // Load device data
    this.devices = await this.loadDevices();
    this.renderDevices();
    this.setupFooter();
  }

  async loadDevices() {
    // Load from your API
    const response = await fetch('/api/devices');
    return response.json();
  }

  renderDevices() {
    const container = document.getElementById('deviceGrid');
    
    this.devices.forEach(device => {
      const entity = {
        id: device.id,
        name: device.name,
        icon: device.type,
        group: device.category,
        lastValue: device.currentValue,
        unit: device.unit,
        status: device.status
      };

      const card = new MyIODraggableCard(container, entity);
      this.cards.push(card);
    });
  }

  setupFooter() {
    // Initialize footer dock
    // (Use existing FOOTER/controller.js or create custom footer)
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  new DeviceComparisonApp();
});
```

### 📱 React Integration

#### 1. React Hook Wrapper
```javascript
// useSelectionStore.js
import { useEffect, useState } from 'react';

export function useSelectionStore() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [totals, setTotals] = useState({});

  useEffect(() => {
    const handleSelectionChange = (data) => {
      setSelectedIds(data.selectedIds);
    };

    const handleTotalsChange = (newTotals) => {
      setTotals(newTotals);
    };

    MyIOSelectionStore.on('selection:change', handleSelectionChange);
    MyIOSelectionStore.on('selection:totals', handleTotalsChange);

    return () => {
      MyIOSelectionStore.off('selection:change', handleSelectionChange);
      MyIOSelectionStore.off('selection:totals', handleTotalsChange);
    };
  }, []);

  return {
    selectedIds,
    totals,
    add: (id) => MyIOSelectionStore.add(id),
    remove: (id) => MyIOSelectionStore.remove(id),
    toggle: (id) => MyIOSelectionStore.toggle(id),
    clear: () => MyIOSelectionStore.clear(),
    openComparison: () => MyIOSelectionStore.openComparison()
  };
}
```

#### 2. React Card Component
```javascript
// DeviceCard.jsx
import React, { useRef, useEffect } from 'react';

export function DeviceCard({ entity, className }) {
  const containerRef = useRef();
  const cardRef = useRef();

  useEffect(() => {
    // Create DraggableCard instance
    cardRef.current = new MyIODraggableCard(
      containerRef.current,
      entity,
      { className }
    );

    return () => {
      cardRef.current?.destroy();
    };
  }, [entity, className]);

  return <div ref={containerRef} />;
}
```

#### 3. React App Component
```javascript
// App.jsx
import React, { useEffect } from 'react';
import { DeviceCard } from './DeviceCard';
import { useSelectionStore } from './useSelectionStore';

export function App() {
  const { selectedIds, totals, openComparison } = useSelectionStore();
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    // Load devices
    loadDevices().then(setDevices);
    
    // Setup analytics
    MyIOSelectionStore.setAnalytics({
      track: (event, data) => {
        analytics.track(event, data);
      }
    });
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Device Dashboard</h1>
        <div className="selection-info">
          {selectedIds.length} selected | {totals.count} total
        </div>
        <button 
          onClick={openComparison}
          disabled={selectedIds.length < 2}
        >
          Compare ({selectedIds.length})
        </button>
      </header>
      
      <main className="device-grid">
        {devices.map(device => (
          <DeviceCard 
            key={device.id} 
            entity={device}
            className="react-card"
          />
        ))}
      </main>
    </div>
  );
}
```

---

## Dependencies

### 📦 Required Dependencies

#### SelectionStore
- **None** - Pure vanilla JavaScript

#### DraggableCard
- **SelectionStore.js** - Must be loaded first
- **Modern browser** - HTML5 drag API support

#### ChartModal
- **SelectionStore.js** - Must be loaded first
- **Chart.js** - Auto-loaded from CDN (v4.4.0+)

### 🔗 External Dependencies

#### Chart.js (Auto-loaded)
```html
<!-- Automatically loaded by ChartModal -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
```

#### Optional: jsPDF (for PDF export)
```html
<!-- For full PDF export functionality -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

### 📱 Browser Requirements

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Drag & Drop | 4+ | 3.5+ | 3.1+ | 12+ |
| Touch Events | 22+ | 52+ | 10+ | 12+ |
| ES6 Classes | 49+ | 45+ | 10.1+ | 13+ |
| Chart.js | 88+ | 78+ | 14+ | 88+ |

---

## Browser Support

### ✅ Fully Supported

- **Chrome 88+** (Desktop & Mobile)
- **Firefox 78+** (Desktop & Mobile)
- **Safari 14+** (Desktop & Mobile)
- **Edge 88+** (Desktop)

### ⚠️ Partial Support

- **Safari 10-13** - Touch drag may be inconsistent
- **Firefox Android** - Long-press detection varies
- **Chrome 49-87** - Some ES6 features may need polyfills

### ❌ Not Supported

- **Internet Explorer** - No support
- **Safari < 10** - Missing required APIs
- **Chrome < 49** - Missing ES6 class support

### 🔧 Polyfill Requirements

For older browsers, include:
```html
<!-- ES6 Class polyfill -->
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>

<!-- Touch events polyfill -->
<script src="https://cdn.jsdelivr.net/npm/touch-polyfill@1.0.0/touch-polyfill.min.js"></script>
```

---

## Troubleshooting

### 🐛 Common Issues

#### 1. "MyIOSelectionStore is undefined"
**Cause**: SelectionStore.js not loaded or loaded after other components
**Solution**:
```html
<!-- Correct order -->
<script src="SelectionStore.js"></script>
<script src="DraggableCard.js"></script>
<script src="ChartModal.js"></script>
```

#### 2. Cards not draggable
**Cause**: Missing draggable attribute or event listeners
**Solution**:
```javascript
// Ensure draggable option is true
const card = new MyIODraggableCard(container, entity, {
  draggable: true // Make sure this is set
});
```

#### 3. Chart modal not opening
**Cause**: Chart.js not loaded or less than 2 items selected
**Solution**:
```javascript
// Check selection count
console.log('Selected:', MyIOSelectionStore.getSelectionCount());

// Check Chart.js
console.log('Chart.js loaded:', typeof Chart !== 'undefined');
```

#### 4. Touch drag not working on mobile
**Cause**: Touch events not properly handled
**Solution**:
```javascript
// Ensure touch events are enabled
// Check for 500ms long-press
// Verify touch-action CSS property
```

#### 5. Analytics not firing
**Cause**: Analytics provider not set
**Solution**:
```javascript
// Set analytics provider
MyIOSelectionStore.setAnalytics({
  track: (event, data) => {
    console.log('Analytics:', event, data);
    // Your analytics code here
  }
});
```

### 🔍 Debug Tools

#### Console Commands
```javascript
// Check component status
console.log('SelectionStore:', typeof MyIOSelectionStore);
console.log('DraggableCard:', typeof MyIODraggableCard);
console.log('ChartModal:', typeof MyIOChartModal);

// Check selection state
console.log('Selected IDs:', MyIOSelectionStore.getSelectedIds());
console.log('Totals:', MyIOSelectionStore.getTotals());

// Test analytics
MyIOSelectionStore.trackEvent('test_event', { test: true });

// Force chart modal
MyIOSelectionStore.openComparison();
```

#### Performance Monitoring
```javascript
// Monitor drag performance
let dragStart = 0;
MyIOSelectionStore.on('selection:change', () => {
  if (dragStart) {
    console.log('Drag duration:', Date.now() - dragStart, 'ms');
    dragStart = 0;
  }
});

// Monitor chart render time
const originalOpen = MyIOChartModal.open;
MyIOChartModal.open = function(data) {
  const start = performance.now();
  const result = originalOpen.call(this, data);
  console.log('Chart render time:', performance.now() - start, 'ms');
  return result;
};
```

### 📞 Support

For additional support:

1. **Check browser console** for error messages
2. **Verify load order** of dependencies
3. **Test with minimal example** to isolate issues
4. **Check browser compatibility** table above
5. **Review integration examples** for correct usage patterns

---

## 📄 License & Credits

**Authors:** MYIO Frontend Guild  
**RFC Date:** 2025-09-23  
**Implementation:** Phase 2 Complete  
**License:** MIT (or your organization's license)  
**Status:** Production Ready

For questions or contributions, please refer to the main project documentation.
