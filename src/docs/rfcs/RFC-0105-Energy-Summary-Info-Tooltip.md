# RFC 0105: Energy Summary Info Tooltip

- **Feature Name:** `energy-summary-info-tooltip`
- **Start Date:** 2025-12-16
- **RFC PR:** [myio-js-library#0105](https://github.com/gh-myio/myio-js-library/pull/0105)
- **MYIO Issue:** [myio-js-library#0105](https://github.com/gh-myio/myio-js-library/issues/0105)

## Summary

This RFC proposes adding a premium info tooltip to the `TELEMETRY_INFO` widget header that displays a comprehensive summary of all energy devices in the dashboard. The tooltip will show device counts by type (with hierarchical breakdown), consumption totals, and device status distribution. The data will be synchronized with the `TELEMETRY` and `MAIN_VIEW` widget controllers through the existing orchestrator infrastructure.

## Motivation

Currently, the `TELEMETRY_INFO` widget displays energy information but lacks a quick overview of the entire dashboard's device ecosystem. Users need to navigate through multiple widgets or manually count devices to understand:

1. **Device Distribution**: How many devices exist by type (meters, equipment, stores)
2. **Equipment Breakdown**: Detailed view of common area equipment (elevators, escalators, chillers, etc.)
3. **Consumption Overview**: Total and per-category consumption values
4. **Health Status**: Quick view of device statuses (online, offline, alert, failure)
5. **Zero Consumption Detection**: Devices that should be consuming but aren't

This RFC addresses these needs by providing:

1. **Instant Overview**: Single hover action reveals complete dashboard summary
2. **Hierarchical Data**: Tree-like structure for equipment categories
3. **Real-time Sync**: Data synchronized with TELEMETRY and MAIN_VIEW controllers
4. **Visual Consistency**: Follows existing premium tooltip patterns (EnergyRangeTooltip)
5. **Status Dashboard**: Quick health check of all monitored devices

## Guide-level explanation

### Product/UX Requirements

The Energy Summary Info Tooltip is accessed by hovering over an info icon next to the "ℹ️ Informações de Energia" header in the TELEMETRY_INFO widget.

#### Visual Design

**Header Integration**

```
+----------------------------------------------------------+
|  ℹ️ Informações de Energia                          [?]  |
+----------------------------------------------------------+
                                                      ^
                                              Info icon (hover target)
```

**Tooltip Layout**

```
+----------------------------------------------------------+
|  📊 Dashboard Energy Summary                              |
+----------------------------------------------------------+
|                                                           |
|  TOTAL DEVICES: 1,167                                    |
|  ├─ Entrada (Input Meters): 15                           |
|  ├─ Lojas (Stores): 874                                  |
|  └─ Área Comum (Common Area): 278                        |
|      ├─ Elevadores: 45                                   |
|      ├─ Escadas Rolantes: 32                             |
|      ├─ Chillers: 8                                      |
|      ├─ Fancoils: 156                                    |
|      ├─ Bombas: 12                                       |
|      ├─ HVAC: 15                                         |
|      └─ Outros: 10                                       |
|                                                           |
+----------------------------------------------------------+
|  ⚡ CONSUMPTION SUMMARY                                   |
+----------------------------------------------------------+
|  Total: 825,158.11 kWh                                   |
|  ├─ Entrada: 825,158.11 kWh                              |
|  ├─ Lojas: 528,612.28 kWh                                |
|  └─ Equipamentos: 296,545.84 kWh                         |
|                                                           |
+----------------------------------------------------------+
|  📡 DEVICE STATUS                                         |
+----------------------------------------------------------+
|  🟢 Online: 1,045 (89.5%)                                |
|  🔴 Offline: 63 (5.4%)                                   |
|  🟡 Alert: 32 (2.7%)                                     |
|  ⚫ Failure: 15 (1.3%)                                   |
|  ⚪ No Info: 12 (1.0%)                                   |
|                                                           |
|  ⚠️ Zero Consumption: 87 devices                         |
|                                                           |
+----------------------------------------------------------+
|  Last Update: 16/12/2025 10:30:45                        |
+----------------------------------------------------------+
```

#### Tooltip Behavior

**Trigger**
- Hover over the info icon `[?]` next to the header
- Tooltip appears after 200ms delay (prevent accidental triggers)
- Tooltip remains visible while mouse is over icon or tooltip itself

**Positioning**
- Appears below and to the left of the icon
- Auto-adjusts to stay within viewport bounds
- Smooth fade-in animation (150ms)

**Dismissal**
- Mouse leaves both icon and tooltip
- 300ms delay before hiding (allows mouse movement to tooltip)
- Smooth fade-out animation (100ms)

**Responsiveness**
- Maximum width: 400px
- Minimum width: 320px
- Scrollable content if exceeds viewport height

### Data Synchronization

The tooltip data is synchronized with:

1. **MAIN_VIEW Controller** (`window.MyIOOrchestrator`)
   - `getLojasDevices()` - Store device list
   - `getEquipmentDevices()` - Equipment device list
   - `energyCache` - Consumption data
   - `classifiedDevices` - Device classification

2. **TELEMETRY Controller**
   - Device status calculations
   - Real-time consumption updates
   - Online/offline counts

### Device Categories

#### Input Meters (Entrada)
- Main building meters
- Identified by `deviceType === '3F_MEDIDOR'` with specific naming patterns
- Usually named with "ENTRADA" or "GERAL"

#### Stores (Lojas)
- Retail space meters
- Classified via `classifiedDevices.lojas` from orchestrator
- Identified by identifier patterns (SUC, LUC codes)

#### Common Area Equipment (Área Comum)

| Category | Portuguese | Device Types |
|----------|------------|--------------|
| Elevators | Elevadores | `ELEVADOR`, `ELV` |
| Escalators | Escadas Rolantes | `ESCADA_ROLANTE`, `ESC` |
| Chillers | Chillers | `CHILLER` |
| Fancoils | Fancoils | `FANCOIL` |
| Pumps | Bombas | `BOMBA` |
| HVAC | HVAC | `HVAC`, `AR_CONDICIONADO` |
| Motors | Motores | `MOTOR` |
| Others | Outros | Unclassified equipment |

### Status Categories

| Status | Color | Description |
|--------|-------|-------------|
| Online | Green 🟢 | Device connected and reporting |
| Offline | Red 🔴 | Device not connected |
| Alert | Yellow 🟡 | Device in warning state |
| Failure | Black ⚫ | Device in failure state |
| No Info | Gray ⚪ | No status information available |

### Zero Consumption Alert

Devices that are online but reporting zero consumption are flagged separately as they may indicate:
- Meter malfunction
- Power supply issues
- Configuration errors

## Reference-level explanation

### Data Model

#### Summary Data Structure

```typescript
interface EnergySummaryData {
  // Timestamp
  lastUpdate: string;  // ISO 8601

  // Device Counts
  totalDevices: number;
  devicesByCategory: {
    entrada: number;
    lojas: number;
    areaComum: EquipmentBreakdown;
  };

  // Consumption
  consumption: {
    total: number;      // kWh
    entrada: number;
    lojas: number;
    equipamentos: number;
  };

  // Status Distribution
  status: {
    online: StatusCount;
    offline: StatusCount;
    alert: StatusCount;
    failure: StatusCount;
    noInfo: StatusCount;
  };

  // Alerts
  zeroConsumptionCount: number;
}

interface EquipmentBreakdown {
  total: number;
  elevadores: number;
  escadasRolantes: number;
  chillers: number;
  fancoils: number;
  bombas: number;
  hvac: number;
  motores: number;
  outros: number;
}

interface StatusCount {
  count: number;
  percentage: number;
}
```

### Component Architecture

#### File Structure

```
src/
├── utils/
│   └── EnergySummaryTooltip.ts    # NEW: Main tooltip component
├── thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/
│   └── TELEMETRY_INFO/
│       ├── template.html           # UPDATE: Add info icon
│       └── controller.js           # UPDATE: Initialize tooltip
```

#### EnergySummaryTooltip Component

```typescript
// src/utils/EnergySummaryTooltip.ts

export interface EnergySummaryTooltipConfig {
  container: HTMLElement;           // Target element for icon
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  theme?: 'dark' | 'light';
  onShow?: () => void;
  onHide?: () => void;
}

export class EnergySummaryTooltip {
  private config: EnergySummaryTooltipConfig;
  private iconElement: HTMLElement;
  private tooltipElement: HTMLElement | null = null;
  private isVisible: boolean = false;
  private hideTimeout: number | null = null;
  private showTimeout: number | null = null;

  constructor(config: EnergySummaryTooltipConfig) {
    this.config = config;
    this.iconElement = this.createIcon();
    this.attachEventListeners();
  }

  /**
   * Create the info icon element
   */
  private createIcon(): HTMLElement {
    const icon = document.createElement('button');
    icon.className = 'energy-summary-info-icon';
    icon.setAttribute('aria-label', 'View energy summary');
    icon.setAttribute('type', 'button');
    icon.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
    `;
    this.config.container.appendChild(icon);
    return icon;
  }

  /**
   * Fetch summary data from orchestrator
   */
  private async fetchSummaryData(): Promise<EnergySummaryData> {
    const orchestrator = window.MyIOOrchestrator;
    if (!orchestrator) {
      throw new Error('MyIOOrchestrator not available');
    }

    const lojas = orchestrator.getLojasDevices?.() || [];
    const equipments = orchestrator.getEquipmentDevices?.() || [];
    const allDevices = [...lojas, ...equipments];

    // Calculate device counts by category
    const devicesByCategory = this.categorizeDevices(equipments);

    // Calculate consumption totals
    const consumption = this.calculateConsumption(lojas, equipments);

    // Calculate status distribution
    const status = this.calculateStatusDistribution(allDevices);

    // Count zero consumption devices
    const zeroConsumptionCount = allDevices.filter(
      d => d.connectionStatus === 'online' && (d.consumption || 0) === 0
    ).length;

    return {
      lastUpdate: new Date().toISOString(),
      totalDevices: allDevices.length,
      devicesByCategory: {
        entrada: this.countEntradaDevices(allDevices),
        lojas: lojas.length,
        areaComum: devicesByCategory
      },
      consumption,
      status,
      zeroConsumptionCount
    };
  }

  /**
   * Categorize equipment devices by type
   */
  private categorizeDevices(equipments: any[]): EquipmentBreakdown {
    const breakdown: EquipmentBreakdown = {
      total: equipments.length,
      elevadores: 0,
      escadasRolantes: 0,
      chillers: 0,
      fancoils: 0,
      bombas: 0,
      hvac: 0,
      motores: 0,
      outros: 0
    };

    equipments.forEach(device => {
      const type = (device.deviceType || '').toUpperCase();
      const label = (device.label || '').toUpperCase();

      if (type.includes('ELEVADOR') || label.includes('ELEVADOR') || label.includes('ELV')) {
        breakdown.elevadores++;
      } else if (type.includes('ESCADA') || label.includes('ESCADA') || label.includes('ESC')) {
        breakdown.escadasRolantes++;
      } else if (type.includes('CHILLER') || label.includes('CHILLER')) {
        breakdown.chillers++;
      } else if (type.includes('FANCOIL') || label.includes('FANCOIL')) {
        breakdown.fancoils++;
      } else if (type.includes('BOMBA') || label.includes('BOMBA')) {
        breakdown.bombas++;
      } else if (type.includes('HVAC') || type.includes('AR_CONDICIONADO') || label.includes('HVAC')) {
        breakdown.hvac++;
      } else if (type.includes('MOTOR') || label.includes('MOTOR')) {
        breakdown.motores++;
      } else {
        breakdown.outros++;
      }
    });

    return breakdown;
  }

  /**
   * Calculate consumption totals
   */
  private calculateConsumption(lojas: any[], equipments: any[]): ConsumptionSummary {
    const lojasTotal = lojas.reduce((sum, d) => sum + (d.total_value || 0), 0);
    const equipmentosTotal = equipments.reduce((sum, d) => sum + (d.total_value || 0), 0);

    return {
      total: lojasTotal + equipmentosTotal,
      entrada: lojasTotal + equipmentosTotal, // Entrada typically equals total
      lojas: lojasTotal,
      equipamentos: equipmentosTotal
    };
  }

  /**
   * Calculate status distribution
   */
  private calculateStatusDistribution(devices: any[]): StatusDistribution {
    const total = devices.length;
    const counts = {
      online: 0,
      offline: 0,
      alert: 0,
      failure: 0,
      noInfo: 0
    };

    devices.forEach(device => {
      const status = (device.connectionStatus || device.deviceStatus || '').toLowerCase();

      if (status === 'online' || status === 'power_on' || status === 'normal') {
        counts.online++;
      } else if (status === 'offline' || status === 'power_off') {
        counts.offline++;
      } else if (status === 'alert' || status === 'warning') {
        counts.alert++;
      } else if (status === 'failure' || status === 'error') {
        counts.failure++;
      } else {
        counts.noInfo++;
      }
    });

    const toStatusCount = (count: number): StatusCount => ({
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0
    });

    return {
      online: toStatusCount(counts.online),
      offline: toStatusCount(counts.offline),
      alert: toStatusCount(counts.alert),
      failure: toStatusCount(counts.failure),
      noInfo: toStatusCount(counts.noInfo)
    };
  }

  /**
   * Render tooltip content
   */
  private renderTooltip(data: EnergySummaryData): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.className = 'energy-summary-tooltip';

    tooltip.innerHTML = `
      <div class="energy-summary-tooltip__header">
        <span class="energy-summary-tooltip__icon">📊</span>
        <span class="energy-summary-tooltip__title">Dashboard Energy Summary</span>
      </div>

      <div class="energy-summary-tooltip__section">
        <div class="energy-summary-tooltip__section-title">
          📱 TOTAL DEVICES: ${data.totalDevices.toLocaleString('pt-BR')}
        </div>
        <div class="energy-summary-tooltip__tree">
          <div class="energy-summary-tooltip__tree-item">
            <span class="tree-branch">├─</span>
            <span class="tree-label">Entrada (Input Meters):</span>
            <span class="tree-value">${data.devicesByCategory.entrada}</span>
          </div>
          <div class="energy-summary-tooltip__tree-item">
            <span class="tree-branch">├─</span>
            <span class="tree-label">Lojas (Stores):</span>
            <span class="tree-value">${data.devicesByCategory.lojas}</span>
          </div>
          <div class="energy-summary-tooltip__tree-item">
            <span class="tree-branch">└─</span>
            <span class="tree-label">Área Comum (Common Area):</span>
            <span class="tree-value">${data.devicesByCategory.areaComum.total}</span>
          </div>
          ${this.renderEquipmentSubtree(data.devicesByCategory.areaComum)}
        </div>
      </div>

      <div class="energy-summary-tooltip__section">
        <div class="energy-summary-tooltip__section-title">⚡ CONSUMPTION SUMMARY</div>
        <div class="energy-summary-tooltip__consumption">
          <div class="consumption-row consumption-row--total">
            <span>Total:</span>
            <span class="consumption-value">${this.formatConsumption(data.consumption.total)} kWh</span>
          </div>
          <div class="consumption-row">
            <span>├─ Entrada:</span>
            <span class="consumption-value">${this.formatConsumption(data.consumption.entrada)} kWh</span>
          </div>
          <div class="consumption-row">
            <span>├─ Lojas:</span>
            <span class="consumption-value">${this.formatConsumption(data.consumption.lojas)} kWh</span>
          </div>
          <div class="consumption-row">
            <span>└─ Equipamentos:</span>
            <span class="consumption-value">${this.formatConsumption(data.consumption.equipamentos)} kWh</span>
          </div>
        </div>
      </div>

      <div class="energy-summary-tooltip__section">
        <div class="energy-summary-tooltip__section-title">📡 DEVICE STATUS</div>
        <div class="energy-summary-tooltip__status">
          ${this.renderStatusRow('🟢', 'Online', data.status.online)}
          ${this.renderStatusRow('🔴', 'Offline', data.status.offline)}
          ${this.renderStatusRow('🟡', 'Alert', data.status.alert)}
          ${this.renderStatusRow('⚫', 'Failure', data.status.failure)}
          ${this.renderStatusRow('⚪', 'No Info', data.status.noInfo)}
        </div>
        ${data.zeroConsumptionCount > 0 ? `
          <div class="energy-summary-tooltip__alert">
            ⚠️ Zero Consumption: ${data.zeroConsumptionCount} devices
          </div>
        ` : ''}
      </div>

      <div class="energy-summary-tooltip__footer">
        Last Update: ${this.formatDate(data.lastUpdate)}
      </div>
    `;

    return tooltip;
  }

  /**
   * Show the tooltip
   */
  public async show(): Promise<void> {
    if (this.isVisible) return;

    try {
      const data = await this.fetchSummaryData();
      this.tooltipElement = this.renderTooltip(data);
      document.body.appendChild(this.tooltipElement);
      this.positionTooltip();

      // Trigger animation
      requestAnimationFrame(() => {
        this.tooltipElement?.classList.add('is-visible');
      });

      this.isVisible = true;
      this.config.onShow?.();
    } catch (error) {
      console.error('[EnergySummaryTooltip] Failed to show tooltip:', error);
    }
  }

  /**
   * Hide the tooltip
   */
  public hide(): void {
    if (!this.isVisible || !this.tooltipElement) return;

    this.tooltipElement.classList.remove('is-visible');

    setTimeout(() => {
      this.tooltipElement?.remove();
      this.tooltipElement = null;
      this.isVisible = false;
      this.config.onHide?.();
    }, 100);
  }

  /**
   * Update tooltip data (for real-time sync)
   */
  public async update(): Promise<void> {
    if (!this.isVisible) return;

    const data = await this.fetchSummaryData();
    const newTooltip = this.renderTooltip(data);

    if (this.tooltipElement) {
      this.tooltipElement.innerHTML = newTooltip.innerHTML;
    }
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.hide();
    this.iconElement.remove();
  }

  // ... helper methods (formatConsumption, formatDate, renderStatusRow, etc.)
}
```

### Template Integration

#### TELEMETRY_INFO/template.html Update

```html
<!-- Before -->
<h2 class="info-title" id="infoTitleHeader">ℹ️ Informações de Energia</h2>

<!-- After -->
<div class="info-header-container">
  <h2 class="info-title" id="infoTitleHeader">ℹ️ Informações de Energia</h2>
  <div id="energySummaryInfoIcon" class="energy-summary-info-container"></div>
</div>
```

#### TELEMETRY_INFO/controller.js Update

```javascript
// In onInit or appropriate lifecycle method
import { EnergySummaryTooltip } from '@myio/js-library';

// Initialize tooltip
const infoIconContainer = document.getElementById('energySummaryInfoIcon');
if (infoIconContainer) {
  const summaryTooltip = new EnergySummaryTooltip({
    container: infoIconContainer,
    position: 'bottom-left',
    theme: 'dark'
  });

  // Optional: Update on orchestrator data changes
  window.addEventListener('myio:energy-summary-ready', () => {
    summaryTooltip.update();
  });
}
```

### CSS Styles

```css
/* Energy Summary Info Icon */
.energy-summary-info-container {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
}

.energy-summary-info-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.2s ease;
}

.energy-summary-info-icon:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

/* Tooltip Container */
.energy-summary-tooltip {
  position: fixed;
  z-index: 10000;
  min-width: 320px;
  max-width: 400px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: #fff;
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  overflow: hidden;
}

.energy-summary-tooltip.is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Header */
.energy-summary-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.energy-summary-tooltip__title {
  font-weight: 600;
  font-size: 14px;
}

/* Sections */
.energy-summary-tooltip__section {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.energy-summary-tooltip__section:last-of-type {
  border-bottom: none;
}

.energy-summary-tooltip__section-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.9);
}

/* Tree Structure */
.energy-summary-tooltip__tree {
  padding-left: 8px;
}

.energy-summary-tooltip__tree-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.tree-branch {
  color: rgba(255, 255, 255, 0.4);
}

.tree-label {
  color: rgba(255, 255, 255, 0.8);
}

.tree-value {
  color: #64b5f6;
  font-weight: 600;
  margin-left: auto;
}

/* Equipment Subtree */
.energy-summary-tooltip__subtree {
  padding-left: 24px;
}

.energy-summary-tooltip__subtree .energy-summary-tooltip__tree-item {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

/* Consumption */
.consumption-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

.consumption-row--total {
  font-weight: 600;
  color: #81c784;
}

.consumption-value {
  font-family: 'JetBrains Mono', monospace;
}

/* Status */
.energy-summary-tooltip__status {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-row__percentage {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  margin-left: auto;
}

/* Alert */
.energy-summary-tooltip__alert {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(255, 152, 0, 0.15);
  border-radius: 6px;
  border-left: 3px solid #ff9800;
  font-size: 12px;
}

/* Footer */
.energy-summary-tooltip__footer {
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.2);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  text-align: right;
}
```

### Integration with Orchestrator

The tooltip fetches data from `window.MyIOOrchestrator` which is populated by the MAIN_VIEW controller:

```javascript
// Data sources from MAIN_VIEW/controller.js
window.MyIOOrchestrator = {
  // ...existing methods

  getLojasDevices: () => classifiedDevices.lojas,
  getEquipmentDevices: () => classifiedDevices.equipments,
  getAllEnergyDevices: () => classifiedDevices.all,

  // Summary data (already calculated)
  getEnergySummary: () => ({
    lojasTotal: sumLojasConsumption,
    equipmentsTotal: sumEquipmentsConsumption,
    totalDevices: classifiedDevices.all.length,
    onlineCount: onlineDevicesCount,
    offlineCount: offlineDevicesCount,
    zeroConsumptionCount: zeroConsumptionDevicesCount
  })
};
```

## Drawbacks

1. **Performance**: Tooltip renders on hover, requiring data aggregation each time. May need caching for large device counts.

2. **Data Freshness**: Summary data may be slightly stale depending on orchestrator update frequency.

3. **Visual Complexity**: Dense information display may overwhelm some users.

4. **Mobile UX**: Hover-based tooltips don't work well on touch devices; may need alternative trigger.

## Rationale and alternatives

### Why a Tooltip?

- **Non-intrusive**: Doesn't take permanent screen space
- **On-demand**: Users access only when needed
- **Consistent**: Follows existing EnergyRangeTooltip pattern
- **Contextual**: Positioned near related header

### Alternatives Considered

1. **Dedicated Panel**: Always-visible summary panel
   - Pro: Always accessible
   - Con: Takes valuable screen real estate

2. **Modal Dialog**: Click to open full summary
   - Pro: More space for detailed info
   - Con: Interrupts workflow

3. **Sidebar Widget**: Collapsible sidebar with summary
   - Pro: Expandable detail
   - Con: Complex UI change

## Prior art

1. **EnergyRangeTooltip**: Existing premium tooltip in MYIO library
2. **Google Analytics Dashboard Tooltips**: Hover summaries for metric cards
3. **Grafana Panel Info**: Info icon revealing panel details

## Unresolved questions

1. **Real-time Updates**: Should tooltip auto-refresh while visible?
2. **Click vs Hover**: Should there be a click-to-pin option?
3. **Export**: Should users be able to copy/export summary data?
4. **Customization**: Should users configure which sections appear?

## Future possibilities

1. **Drill-down Navigation**: Click categories to filter main grid
2. **Historical Comparison**: Show changes vs previous period
3. **Alerts Integration**: Link to alarm panel from status section
4. **PDF Export**: Generate summary report from tooltip data
5. **Customizable Layout**: User preferences for section order/visibility

## Implementation Plan

### Phase 1: Core Component
- [ ] Create `EnergySummaryTooltip.ts` in `src/utils/`
- [ ] Implement data fetching from orchestrator
- [ ] Build tooltip rendering with all sections
- [ ] Add CSS styles

### Phase 2: Integration
- [ ] Update `TELEMETRY_INFO/template.html` with icon container
- [ ] Update `TELEMETRY_INFO/controller.js` to initialize tooltip
- [ ] Wire up orchestrator data events

### Phase 3: Polish
- [ ] Positioning and viewport handling
- [ ] Animation and transitions
- [ ] Responsive adjustments
- [ ] Accessibility (keyboard, ARIA)

### Phase 4: Testing
- [ ] Create showcase demo with mock data
- [ ] Test with various device counts
- [ ] Cross-browser testing
- [ ] Performance profiling

## Showcase Examples

```typescript
// showcase/energy-summary-tooltip-demo.ts

import { EnergySummaryTooltip } from '@myio/js-library';

// Mock orchestrator data
window.MyIOOrchestrator = {
  getLojasDevices: () => generateMockLojas(874),
  getEquipmentDevices: () => generateMockEquipments(293),
  getEnergySummary: () => ({
    lojasTotal: 528612.28,
    equipmentsTotal: 296545.84,
    totalDevices: 1167,
    onlineCount: 1045,
    offlineCount: 63,
    zeroConsumptionCount: 87
  })
};

// Initialize demo
const container = document.getElementById('demo-header');
const tooltip = new EnergySummaryTooltip({
  container,
  position: 'bottom-left',
  theme: 'dark'
});

// Demo controls
document.getElementById('show-tooltip')?.addEventListener('click', () => tooltip.show());
document.getElementById('hide-tooltip')?.addEventListener('click', () => tooltip.hide());
document.getElementById('update-tooltip')?.addEventListener('click', () => tooltip.update());
```
