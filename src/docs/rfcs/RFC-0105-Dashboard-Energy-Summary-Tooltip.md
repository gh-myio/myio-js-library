# RFC 0105: Dashboard Energy Summary Tooltip

- **Feature Name:** `dashboard-energy-summary-tooltip`
- **Start Date:** 2025-12-16
- **RFC PR:** [myio-js-library#0105](https://github.com/gh-myio/myio-js-library/pull/0105)
- **MYIO Issue:** [myio-js-library#0105](https://github.com/gh-myio/myio-js-library/issues/0105)

## Summary

This RFC proposes a premium summary tooltip for the TELEMETRY_INFO widget header in the Shopping Dashboard. The tooltip will be displayed next to the "Energy Information" title and provide a comprehensive, real-time overview of all energy devices, their statuses, consumption totals, and category breakdowns. The component will be synchronized with the TELEMETRY and MAIN_VIEW widget controllers.

## Motivation

Currently, the TELEMETRY_INFO widget displays energy consumption data by category (Entrada, Lojas, Climatization, Elevators, Escalators, Common Area, etc.) but lacks a quick summary view showing:

1. **Total Device Count**: No immediate visibility into how many energy devices are being monitored
2. **Device Status Overview**: Users cannot quickly see how many devices are offline, in alert, failure, or operating normally
3. **Category Breakdown**: No tree-view structure showing device distribution across categories and subcategories
4. **Consumption Summary**: No aggregated consumption totals visible at a glance

This RFC addresses these gaps by providing:

1. **Premium Tooltip Component**: A rich, interactive tooltip following the established `EnergyRangeTooltip` pattern
2. **Real-Time Synchronization**: Data synchronized with TELEMETRY and MAIN_VIEW controllers
3. **Hierarchical Category View**: Tree structure for common area subcategories (elevators, escalators, chillers, fancoils, pumps, etc.)
4. **Device Status Matrix**: Visual breakdown of device statuses (normal, alert, failure, standby, offline, no consumption)

## Guide-level explanation

### Product/UX Requirements

The tooltip will appear when users hover over an info icon (or the title itself) positioned to the right of the "Energy Information" header in the TELEMETRY_INFO widget.

#### Header Layout

```
+----------------------------------------------------------+
|  [icon] Informacoes de Energia  [?]  <-- Tooltip trigger  |
+----------------------------------------------------------+
```

The `[?]` or info icon triggers the premium tooltip on hover.

#### Tooltip Layout

```
+------------------------------------------------------------------+
|  [lightning] Energy Dashboard Summary                             |
+------------------------------------------------------------------+
|                                                                   |
|  TOTAL DEVICES: 127                                               |
|  +------------------------------------------------------------+  |
|  | By Type                          | Count  | Consumption    |  |
|  +------------------------------------------------------------+  |
|  | [icon] Entrada (Input)           |    3   |  45,230 kWh    |  |
|  | [icon] Lojas (Stores)            |   85   |  28,450 kWh    |  |
|  | [icon] Area Comum (Common Area)  |   39   |  16,780 kWh    |  |
|  |   +-- Elevadores (Elevators)     |    8   |   3,200 kWh    |  |
|  |   +-- Esc. Rolantes (Escalators) |    6   |   2,100 kWh    |  |
|  |   +-- Chillers                   |    4   |   5,600 kWh    |  |
|  |   +-- Fancoils                   |   12   |   2,800 kWh    |  |
|  |   +-- Bombas (Pumps)             |    6   |   1,980 kWh    |  |
|  |   +-- Outros (Others)            |    3   |   1,100 kWh    |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  DEVICE STATUS                                                    |
|  +------------------------------------------------------------+  |
|  |  [green] Normal: 98  | [yellow] Alert: 12 | [red] Failure: 3 |  |
|  |  [blue] Standby: 8  | [gray] Offline: 4  | [dim] No Data: 2 |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  TOTAL CONSUMPTION: 90,460 kWh                                    |
|                                                                   |
+------------------------------------------------------------------+
```

### Data Source

The tooltip will consume data from two existing widget controllers:

1. **TELEMETRY Controller** (`main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`)
   - Provides device list with real-time telemetry
   - Contains device categorization logic
   - Calculates consumption totals per category

2. **MAIN_VIEW Controller** (`main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`)
   - Orchestrates inter-widget communication
   - Manages filter state and device selection
   - Provides aggregated group data

### Category Types

The tooltip will display devices organized by the existing category classification:

| Category | Icon | Description |
|----------|------|-------------|
| Entrada (Input) | `[downArrow]` | Main power input meters |
| Lojas (Stores) | `[store]` | Retail tenant meters |
| Climatizacao (HVAC) | `[snowflake]` | Climate control equipment |
| Elevadores (Elevators) | `[elevator]` | Vertical transportation |
| Esc. Rolantes (Escalators) | `[escalator]` | Moving stairs |
| Chillers | `[temp]` | Cooling units |
| Fancoils | `[fan]` | Air handling units |
| Bombas (Pumps) | `[pump]` | Water/fluid pumps |
| Outros (Others) | `[gear]` | Uncategorized equipment |

### Device Status Types

Following the established pattern from `EnergyRangeTooltip.ts`:

| Status | Color | Condition |
|--------|-------|-----------|
| Normal | Green (`#22c55e`) | Power within normalRange |
| Alert | Yellow (`#f59e0b`) | Power within alertRange |
| Failure | Red (`#ef4444`) | Power within failureRange |
| Standby | Blue (`#3b82f6`) | Power within standbyRange |
| Offline | Gray (`#6b7280`) | No telemetry data |
| No Consumption | Dim (`#9ca3af`) | Power = 0 for extended period |

## Reference-level explanation

### Data Model

#### Summary Data Structure

```typescript
interface DashboardEnergySummary {
  totalDevices: number;
  totalConsumption: number;
  unit: 'kWh' | 'MWh';

  byCategory: CategorySummary[];
  byStatus: StatusSummary;

  lastUpdated: string; // ISO 8601
}

interface CategorySummary {
  id: string;
  name: string;
  icon: string;
  deviceCount: number;
  consumption: number;
  percentage: number;
  children?: CategorySummary[]; // For tree structure
}

interface StatusSummary {
  normal: number;
  alert: number;
  failure: number;
  standby: number;
  offline: number;
  noConsumption: number;
}
```

#### Tooltip Configuration

```typescript
interface EnergySummaryTooltipConfig {
  containerId: string;
  triggerElement: HTMLElement;
  dataSource: {
    telemetryController: any;
    mainViewController: any;
  };
  refreshInterval?: number; // ms, default 30000
  showTree?: boolean; // Show category tree, default true
  showStatus?: boolean; // Show status matrix, default true
}
```

### Component Architecture

#### File Structure

```
src/utils/
├── EnergyRangeTooltip.ts           # Existing - reference pattern
└── EnergySummaryTooltip.ts         # NEW - dashboard summary tooltip

src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/
├── TELEMETRY_INFO/
│   ├── template.html               # Add tooltip trigger element
│   ├── controller.js               # Initialize tooltip component
│   └── style.css                   # Add tooltip trigger styles
├── TELEMETRY/
│   └── controller.js               # Expose summary data API
└── MAIN_VIEW/
    └── controller.js               # Provide aggregated data
```

### CSS Styles

Following the `EnergyRangeTooltip` pattern:

```css
/* ============================================
   Energy Summary Tooltip
   ============================================ */
.energy-summary-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
  transform: translateY(5px);
}

.energy-summary-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.energy-summary-tooltip__content {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08);
  min-width: 400px;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: #1e293b;
}

.energy-summary-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(90deg, #ecfdf5 0%, #d1fae5 100%);
  border-bottom: 1px solid #6ee7b7;
  position: sticky;
  top: 0;
}

.energy-summary-tooltip__icon {
  font-size: 18px;
}

.energy-summary-tooltip__title {
  font-weight: 700;
  font-size: 14px;
  color: #047857;
}

.energy-summary-tooltip__body {
  padding: 16px;
}

/* Category Tree */
.energy-summary-tooltip__category-tree {
  margin: 12px 0;
}

.energy-summary-tooltip__category-row {
  display: grid;
  grid-template-columns: 1fr 60px 100px;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  align-items: center;
}

.energy-summary-tooltip__category-row:hover {
  background: #f1f5f9;
}

.energy-summary-tooltip__category-row.child {
  padding-left: 32px;
  font-size: 11px;
  color: #64748b;
}

.energy-summary-tooltip__category-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.energy-summary-tooltip__category-icon {
  font-size: 14px;
}

.energy-summary-tooltip__category-count {
  text-align: center;
  font-weight: 600;
  color: #475569;
}

.energy-summary-tooltip__category-consumption {
  text-align: right;
  font-weight: 600;
  color: #059669;
}

/* Status Matrix */
.energy-summary-tooltip__status-matrix {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 16px 0;
}

.energy-summary-tooltip__status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.energy-summary-tooltip__status-item.normal {
  background: #dcfce7;
  color: #15803d;
}

.energy-summary-tooltip__status-item.alert {
  background: #fef3c7;
  color: #b45309;
}

.energy-summary-tooltip__status-item.failure {
  background: #fee2e2;
  color: #b91c1c;
}

.energy-summary-tooltip__status-item.standby {
  background: #dbeafe;
  color: #1d4ed8;
}

.energy-summary-tooltip__status-item.offline {
  background: #f3f4f6;
  color: #6b7280;
}

.energy-summary-tooltip__status-item.no-consumption {
  background: #f8fafc;
  color: #9ca3af;
}

.energy-summary-tooltip__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.energy-summary-tooltip__status-dot.normal { background: #22c55e; }
.energy-summary-tooltip__status-dot.alert { background: #f59e0b; }
.energy-summary-tooltip__status-dot.failure { background: #ef4444; }
.energy-summary-tooltip__status-dot.standby { background: #3b82f6; }
.energy-summary-tooltip__status-dot.offline { background: #6b7280; }
.energy-summary-tooltip__status-dot.no-consumption { background: #d1d5db; }

/* Total Consumption Footer */
.energy-summary-tooltip__total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  margin: 16px -16px -16px;
  border-radius: 0 0 12px 12px;
}

.energy-summary-tooltip__total-label {
  font-weight: 600;
  color: #475569;
}

.energy-summary-tooltip__total-value {
  font-size: 18px;
  font-weight: 700;
  color: #059669;
}
```

### Implementation

#### EnergySummaryTooltip Component

```typescript
// src/utils/EnergySummaryTooltip.ts

export interface DashboardEnergySummary {
  totalDevices: number;
  totalConsumption: number;
  unit: 'kWh' | 'MWh';
  byCategory: CategorySummary[];
  byStatus: StatusSummary;
  lastUpdated: string;
}

export interface CategorySummary {
  id: string;
  name: string;
  icon: string;
  deviceCount: number;
  consumption: number;
  percentage: number;
  children?: CategorySummary[];
}

export interface StatusSummary {
  normal: number;
  alert: number;
  failure: number;
  standby: number;
  offline: number;
  noConsumption: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  entrada: '📥',
  lojas: '🏪',
  climatizacao: '❄️',
  elevadores: '🛗',
  escadas: '🎢',
  chillers: '🧊',
  fancoils: '💨',
  bombas: '💧',
  outros: '⚙️',
  areaComum: '🏢'
};

export const EnergySummaryTooltip = {
  containerId: 'myio-energy-summary-tooltip',

  getContainer(): HTMLElement {
    injectCSS();
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'energy-summary-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  calculateSummary(telemetryData: any[], mainViewData: any): DashboardEnergySummary {
    const summary: DashboardEnergySummary = {
      totalDevices: 0,
      totalConsumption: 0,
      unit: 'kWh',
      byCategory: [],
      byStatus: {
        normal: 0,
        alert: 0,
        failure: 0,
        standby: 0,
        offline: 0,
        noConsumption: 0
      },
      lastUpdated: new Date().toISOString()
    };

    // Process telemetry data to build summary
    // ... implementation details

    return summary;
  },

  buildCategoryTree(data: any[]): CategorySummary[] {
    // Build hierarchical category structure
    const categories: CategorySummary[] = [
      { id: 'entrada', name: 'Entrada', icon: CATEGORY_ICONS.entrada, deviceCount: 0, consumption: 0, percentage: 0 },
      { id: 'lojas', name: 'Lojas', icon: CATEGORY_ICONS.lojas, deviceCount: 0, consumption: 0, percentage: 0 },
      {
        id: 'areaComum',
        name: 'Area Comum',
        icon: CATEGORY_ICONS.areaComum,
        deviceCount: 0,
        consumption: 0,
        percentage: 0,
        children: [
          { id: 'elevadores', name: 'Elevadores', icon: CATEGORY_ICONS.elevadores, deviceCount: 0, consumption: 0, percentage: 0 },
          { id: 'escadas', name: 'Esc. Rolantes', icon: CATEGORY_ICONS.escadas, deviceCount: 0, consumption: 0, percentage: 0 },
          { id: 'climatizacao', name: 'Climatizacao', icon: CATEGORY_ICONS.climatizacao, deviceCount: 0, consumption: 0, percentage: 0 },
          { id: 'chillers', name: 'Chillers', icon: CATEGORY_ICONS.chillers, deviceCount: 0, consumption: 0, percentage: 0 },
          { id: 'fancoils', name: 'Fancoils', icon: CATEGORY_ICONS.fancoils, deviceCount: 0, consumption: 0, percentage: 0 },
          { id: 'bombas', name: 'Bombas', icon: CATEGORY_ICONS.bombas, deviceCount: 0, consumption: 0, percentage: 0 },
          { id: 'outros', name: 'Outros', icon: CATEGORY_ICONS.outros, deviceCount: 0, consumption: 0, percentage: 0 }
        ]
      }
    ];

    return categories;
  },

  renderHTML(summary: DashboardEnergySummary): string {
    const categoryRows = this.renderCategoryTree(summary.byCategory);
    const statusMatrix = this.renderStatusMatrix(summary.byStatus);

    return `
      <div class="energy-summary-tooltip__content">
        <div class="energy-summary-tooltip__header">
          <span class="energy-summary-tooltip__icon">⚡</span>
          <span class="energy-summary-tooltip__title">Energy Dashboard Summary</span>
        </div>
        <div class="energy-summary-tooltip__body">
          <div class="energy-summary-tooltip__total-devices">
            <strong>Total Devices:</strong> ${summary.totalDevices}
          </div>

          <div class="energy-summary-tooltip__category-tree">
            <div class="energy-summary-tooltip__category-header">
              <span>Category</span>
              <span>Devices</span>
              <span>Consumption</span>
            </div>
            ${categoryRows}
          </div>

          <div class="energy-summary-tooltip__section-title">Device Status</div>
          <div class="energy-summary-tooltip__status-matrix">
            ${statusMatrix}
          </div>
        </div>
        <div class="energy-summary-tooltip__total">
          <span class="energy-summary-tooltip__total-label">Total Consumption</span>
          <span class="energy-summary-tooltip__total-value">${this.formatConsumption(summary.totalConsumption)} ${summary.unit}</span>
        </div>
      </div>
    `;
  },

  renderCategoryTree(categories: CategorySummary[]): string {
    return categories.map(cat => {
      let html = `
        <div class="energy-summary-tooltip__category-row">
          <span class="energy-summary-tooltip__category-name">
            <span class="energy-summary-tooltip__category-icon">${cat.icon}</span>
            ${cat.name}
          </span>
          <span class="energy-summary-tooltip__category-count">${cat.deviceCount}</span>
          <span class="energy-summary-tooltip__category-consumption">${this.formatConsumption(cat.consumption)} kWh</span>
        </div>
      `;

      if (cat.children && cat.children.length > 0) {
        cat.children.forEach(child => {
          html += `
            <div class="energy-summary-tooltip__category-row child">
              <span class="energy-summary-tooltip__category-name">
                <span class="energy-summary-tooltip__category-icon">${child.icon}</span>
                ${child.name}
              </span>
              <span class="energy-summary-tooltip__category-count">${child.deviceCount}</span>
              <span class="energy-summary-tooltip__category-consumption">${this.formatConsumption(child.consumption)} kWh</span>
            </div>
          `;
        });
      }

      return html;
    }).join('');
  },

  renderStatusMatrix(status: StatusSummary): string {
    return `
      <div class="energy-summary-tooltip__status-item normal">
        <span class="energy-summary-tooltip__status-dot normal"></span>
        Normal: ${status.normal}
      </div>
      <div class="energy-summary-tooltip__status-item alert">
        <span class="energy-summary-tooltip__status-dot alert"></span>
        Alert: ${status.alert}
      </div>
      <div class="energy-summary-tooltip__status-item failure">
        <span class="energy-summary-tooltip__status-dot failure"></span>
        Failure: ${status.failure}
      </div>
      <div class="energy-summary-tooltip__status-item standby">
        <span class="energy-summary-tooltip__status-dot standby"></span>
        Standby: ${status.standby}
      </div>
      <div class="energy-summary-tooltip__status-item offline">
        <span class="energy-summary-tooltip__status-dot offline"></span>
        Offline: ${status.offline}
      </div>
      <div class="energy-summary-tooltip__status-item no-consumption">
        <span class="energy-summary-tooltip__status-dot no-consumption"></span>
        No Data: ${status.noConsumption}
      </div>
    `;
  },

  formatConsumption(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(2) + ' MWh';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(2) + ' MWh';
    }
    return value.toFixed(2);
  },

  show(triggerElement: HTMLElement, summary: DashboardEnergySummary, event?: MouseEvent): void {
    const container = this.getContainer();
    container.innerHTML = this.renderHTML(summary);

    // Position tooltip
    let left: number, top: number;
    if (event) {
      left = event.clientX + 8;
      top = event.clientY + 8;
    } else {
      const rect = triggerElement.getBoundingClientRect();
      left = rect.left;
      top = rect.bottom + 8;
    }

    // Adjust for viewport bounds
    const tooltipWidth = 450;
    const tooltipHeight = 500;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }
    if (left < 10) left = 10;
    if (top + tooltipHeight > window.innerHeight - 10) {
      top = (event?.clientY || top) - tooltipHeight - 8;
    }
    if (top < 10) top = 10;

    container.style.left = left + 'px';
    container.style.top = top + 'px';
    container.classList.add('visible');
  },

  hide(): void {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible');
    }
  },

  attach(element: HTMLElement, getDataFn: () => DashboardEnergySummary): () => void {
    const handleMouseEnter = (e: MouseEvent) => {
      const summary = getDataFn();
      this.show(element, summary, e);
    };

    const handleMouseLeave = () => {
      this.hide();
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      this.hide();
    };
  }
};
```

### Template Integration

#### TELEMETRY_INFO Template Update

```html
<!-- TELEMETRY_INFO/template.html -->
<header class="info-header">
  <h2 class="info-title" id="infoTitleHeader">Energy Information</h2>
  <button
    class="btn-info-summary"
    id="btnInfoSummary"
    title="View energy summary">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12" y2="8"/>
    </svg>
  </button>
  <!-- existing expand button -->
</header>
```

#### Controller Integration

```javascript
// TELEMETRY_INFO/controller.js

// Import or reference the tooltip
// const { EnergySummaryTooltip } = window.MyIOLibrary;

function initSummaryTooltip() {
  const triggerBtn = document.getElementById('btnInfoSummary');
  if (!triggerBtn) return;

  // Get data from sibling widgets
  const getSummaryData = () => {
    // Access TELEMETRY controller data
    const telemetryData = window.TELEMETRY_getData?.() || [];
    // Access MAIN_VIEW controller data
    const mainViewData = window.MAIN_VIEW_getData?.() || {};

    return EnergySummaryTooltip.calculateSummary(telemetryData, mainViewData);
  };

  // Attach tooltip
  EnergySummaryTooltip.attach(triggerBtn, getSummaryData);
}
```

## Drawbacks

1. **Performance Overhead**: Real-time calculation of summary data may impact performance with large device counts
2. **Data Synchronization**: Requires tight coupling with TELEMETRY and MAIN_VIEW controllers
3. **CSS Complexity**: Additional CSS for premium tooltip styling increases bundle size
4. **Browser Compatibility**: Fixed positioning and CSS Grid may have edge cases in older browsers

## Rationale and alternatives

### Why a Tooltip?

- **Non-intrusive**: Doesn't take permanent screen space
- **Contextual**: Appears exactly where users need it
- **Familiar Pattern**: Follows established `EnergyRangeTooltip` design
- **Premium Feel**: Enhances perceived quality of the dashboard

### Alternatives Considered

1. **Expandable Panel**: A collapsible section in the header - rejected as too intrusive
2. **Separate Widget**: A dedicated summary widget - rejected as redundant
3. **Modal Dialog**: A full-screen summary view - rejected as overkill for quick info
4. **Sidebar Panel**: A persistent side panel - rejected as space-consuming

### Why Tree Structure for Categories?

- **Hierarchical Data**: Common area subdivides into multiple subcategories
- **Clarity**: Users can see both aggregate and detailed breakdowns
- **Expandability**: Easy to add new subcategories without UI changes

## Prior art

1. **EnergyRangeTooltip**: Existing premium tooltip pattern in MYIO library
2. **Google Analytics Tooltips**: Rich hover tooltips with multiple data dimensions
3. **Grafana Panel Tooltips**: Context-sensitive data summaries
4. **TELEMETRY_INFO Modal**: Existing expanded view pattern for consumption charts

## Unresolved questions

1. **Refresh Rate**: How often should the tooltip data refresh while visible?
2. **Animation**: Should tree nodes be collapsible/expandable within the tooltip?
3. **Export**: Should the tooltip include a "copy summary" or "export" action?
4. **Mobile**: How should the tooltip behave on touch devices?
5. **Theming**: Should there be dark mode support for the tooltip?

## Future possibilities

1. **Interactive Filtering**: Click on a category to filter the main view
2. **Historical Comparison**: Show comparison with previous period
3. **Alerts Inline**: Display active alarms within the tooltip
4. **Device Quick Access**: Click to navigate to specific device
5. **Custom Categories**: Allow users to define custom category groupings
6. **Sharing**: Generate shareable snapshot of current summary

## Implementation Plan

### Phase 1: Core Component
- [ ] Create `src/utils/EnergySummaryTooltip.ts` following `EnergyRangeTooltip` pattern
- [ ] Define TypeScript interfaces for summary data structures
- [ ] Implement CSS styles with premium design

### Phase 2: Data Integration
- [ ] Add data export API to `TELEMETRY/controller.js`
- [ ] Add data export API to `MAIN_VIEW/controller.js`
- [ ] Implement `calculateSummary()` function with real data mapping

### Phase 3: Template Integration
- [ ] Add tooltip trigger button to `TELEMETRY_INFO/template.html`
- [ ] Initialize tooltip in `TELEMETRY_INFO/controller.js`
- [ ] Wire up inter-widget communication

### Phase 4: Testing and Showcase
- [ ] Create showcase example with mock data in `/showcase`
- [ ] Test with various device counts and categories
- [ ] Verify responsive behavior and edge cases

### Phase 5: Polish
- [ ] Performance optimization for large datasets
- [ ] Accessibility improvements (keyboard navigation, ARIA)
- [ ] Documentation and usage examples

## Showcase Examples

```typescript
// showcase/energy-summary-tooltip-demo.ts

import { EnergySummaryTooltip } from '@myio/js-library';

// Mock summary data
const mockSummary: DashboardEnergySummary = {
  totalDevices: 127,
  totalConsumption: 90460,
  unit: 'kWh',
  byCategory: [
    { id: 'entrada', name: 'Entrada', icon: '📥', deviceCount: 3, consumption: 45230, percentage: 50 },
    { id: 'lojas', name: 'Lojas', icon: '🏪', deviceCount: 85, consumption: 28450, percentage: 31 },
    {
      id: 'areaComum',
      name: 'Area Comum',
      icon: '🏢',
      deviceCount: 39,
      consumption: 16780,
      percentage: 19,
      children: [
        { id: 'elevadores', name: 'Elevadores', icon: '🛗', deviceCount: 8, consumption: 3200, percentage: 3.5 },
        { id: 'escadas', name: 'Esc. Rolantes', icon: '🎢', deviceCount: 6, consumption: 2100, percentage: 2.3 },
        { id: 'chillers', name: 'Chillers', icon: '🧊', deviceCount: 4, consumption: 5600, percentage: 6.2 },
        { id: 'fancoils', name: 'Fancoils', icon: '💨', deviceCount: 12, consumption: 2800, percentage: 3.1 },
        { id: 'bombas', name: 'Bombas', icon: '💧', deviceCount: 6, consumption: 1980, percentage: 2.2 },
        { id: 'outros', name: 'Outros', icon: '⚙️', deviceCount: 3, consumption: 1100, percentage: 1.2 }
      ]
    }
  ],
  byStatus: {
    normal: 98,
    alert: 12,
    failure: 3,
    standby: 8,
    offline: 4,
    noConsumption: 2
  },
  lastUpdated: new Date().toISOString()
};

// Demo showcase
document.getElementById('demo-trigger')?.addEventListener('mouseenter', (e) => {
  EnergySummaryTooltip.show(e.target as HTMLElement, mockSummary, e);
});

document.getElementById('demo-trigger')?.addEventListener('mouseleave', () => {
  EnergySummaryTooltip.hide();
});
```
