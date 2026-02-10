# RFC-0165: BAS Device Modal with Automation Control Panel

- **Status:** Draft
- **Author:** Code Assist
- **Created:** 2026-02-09
- **Target Release:** 0.1.372

## Summary

Extend the existing `EnergyModal` component to support a BAS (Building Automation System) mode with a split-panel layout: 30% left panel for device automation controls (on/off, status, remote commands) and 70% right panel for the consumption chart.

## Motivation

In BAS dashboards, users need more than just viewing consumption charts. When clicking on motor/pump cards in the `MAIN_BAS` widget, users expect to:

1. See the device's energy consumption chart
2. Control the device (turn on/off) if it has remote capability
3. View device status and telemetry in real-time
4. Execute automation commands

Currently, the `EnergyModal` only shows charts. This RFC adds a dedicated automation control panel for BAS devices, particularly those with `deviceType` or `deviceProfile` = `REMOTE`.

## Goals

1. Add `basMode` option to `EnergyModal` that enables split-panel layout
2. Create `BASControlPanel` component for the 30% left panel
3. Maintain backward compatibility - existing usage unchanged
4. Integrate with `MAIN_BAS` controller for motor/pump card clicks
5. Create showcase for validation

## Non-Goals

- Changing the chart rendering logic
- Modifying ThingsBoard backend APIs
- Implementing complex scheduling (separate feature)

## Design

### 1. Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Date Range] [Load] [Export]          [Theme] [Close]              │
├──────────────────────┬──────────────────────────────────────────────┤
│                      │                                              │
│  BAS Control Panel   │              Chart Container                 │
│      (30%)           │                  (70%)                       │
│                      │                                              │
│  ┌────────────────┐  │  ┌────────────────────────────────────────┐  │
│  │ Device Status  │  │  │                                        │  │
│  │ ● Online       │  │  │                                        │  │
│  ├────────────────┤  │  │         Energy Consumption             │  │
│  │ Remote Control │  │  │              Chart                     │  │
│  │ [  ON  ] [OFF] │  │  │                                        │  │
│  ├────────────────┤  │  │                                        │  │
│  │ Telemetry      │  │  │                                        │  │
│  │ Power: 1.5 kW  │  │  │                                        │  │
│  │ Current: 6.2 A │  │  │                                        │  │
│  │ Voltage: 220 V │  │  └────────────────────────────────────────┘  │
│  └────────────────┘  │                                              │
│                      │                                              │
└──────────────────────┴──────────────────────────────────────────────┘
```

### 2. New Types

```typescript
// New option for BAS mode
interface OpenDashboardPopupEnergyOptions {
  // ... existing options ...

  /** Enable BAS mode with automation control panel */
  basMode?: boolean;

  /** Device object for automation control (required when basMode=true) */
  basDevice?: BASDeviceData;

  /** Callback for remote control commands */
  onRemoteCommand?: (command: 'on' | 'off', device: BASDeviceData) => Promise<void>;

  /** Callback for device telemetry refresh */
  onTelemetryRefresh?: (device: BASDeviceData) => Promise<BASDeviceTelemetry>;
}

interface BASDeviceData {
  id: string;
  entityId: string;
  label: string;
  deviceType: string;
  deviceProfile?: string;
  hasRemote: boolean;
  isRemoteOn?: boolean;
  status: 'online' | 'offline' | 'unknown';
  telemetry?: BASDeviceTelemetry;
}

interface BASDeviceTelemetry {
  power?: number;        // kW
  current?: number;      // A
  voltage?: number;      // V
  temperature?: number;  // °C
  consumption?: number;  // kWh
  lastUpdate?: number;   // timestamp
}
```

### 3. BASControlPanel Component

New component at `src/components/premium-modals/energy/BASControlPanel.ts`:

```typescript
export class BASControlPanel {
  private container: HTMLElement;
  private device: BASDeviceData;
  private onRemoteCommand: (cmd: 'on' | 'off') => Promise<void>;
  private onTelemetryRefresh: () => Promise<BASDeviceTelemetry>;
  private refreshInterval: number | null = null;

  constructor(options: BASControlPanelOptions) { ... }

  render(): HTMLElement { ... }

  updateStatus(status: 'online' | 'offline' | 'unknown'): void { ... }

  updateTelemetry(telemetry: BASDeviceTelemetry): void { ... }

  setRemoteState(isOn: boolean): void { ... }

  startAutoRefresh(intervalMs: number): void { ... }

  stopAutoRefresh(): void { ... }

  destroy(): void { ... }
}
```

### 4. EnergyModalView Modifications

Modify `createModalContent()` to support BAS layout:

```typescript
private createModalContent(): HTMLElement {
  const basMode = this.config.params.basMode === true;

  if (basMode) {
    return this.createBASModeContent();
  }

  // ... existing single/comparison mode content ...
}

private createBASModeContent(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'myio-energy-modal-scope myio-energy-modal--bas';

  container.innerHTML = `
    <style>${this.getModalStyles()}</style>
    <div class="myio-modal-scope" style="height: 100%; display: flex; flex-direction: column;">
      <!-- Controls Section (same as before) -->
      ...

      <!-- BAS Split Layout -->
      <div class="myio-energy-bas-layout">
        <!-- Left: Control Panel (30%) -->
        <div id="bas-control-panel" class="myio-energy-bas-control"></div>

        <!-- Right: Chart (70%) -->
        <div id="energy-chart-container" class="myio-energy-chart-container myio-energy-bas-chart"></div>
      </div>
    </div>
  `;

  return container;
}
```

### 5. CSS for BAS Layout

```css
.myio-energy-bas-layout {
  display: flex;
  flex: 1;
  gap: 16px;
  min-height: 0;
}

.myio-energy-bas-control {
  width: 30%;
  min-width: 280px;
  max-width: 350px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.myio-energy-bas-chart {
  flex: 1;
  min-width: 0;
}

/* Control Panel Sections */
.myio-bas-section {
  background: var(--myio-energy-btn-bg);
  border: 1px solid var(--myio-energy-border);
  border-radius: var(--myio-energy-radius);
  padding: 16px;
}

.myio-bas-section__title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--myio-energy-text-secondary);
  margin-bottom: 12px;
}

.myio-bas-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.myio-bas-status__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.myio-bas-status__dot--online {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}

.myio-bas-status__dot--offline {
  background: #ef4444;
  animation: pulse-red 1.5s infinite;
}

.myio-bas-remote-buttons {
  display: flex;
  gap: 8px;
}

.myio-bas-remote-btn {
  flex: 1;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.myio-bas-remote-btn--on {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
}

.myio-bas-remote-btn--off {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: none;
}

.myio-bas-telemetry-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.myio-bas-telemetry-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.myio-bas-telemetry-label {
  font-size: 11px;
  color: var(--myio-energy-text-secondary);
}

.myio-bas-telemetry-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--myio-energy-text);
}
```

### 6. Integration with MAIN_BAS

Update `mountEnergyPanel` in `controller.js` to open BAS modal on card click:

```javascript
function handleMotorCardClick(device, ctx) {
  // Build BAS device data from classified device
  const basDevice = {
    id: device.id,
    entityId: device.entityId,
    label: device.label || device.name,
    deviceType: device.deviceType,
    deviceProfile: device.deviceProfile,
    hasRemote: device.hasRemote || isRemoteDevice(device),
    isRemoteOn: device.isOn,
    status: device.status || 'unknown',
    telemetry: {
      power: device.rawData?.power,
      current: device.rawData?.current,
      voltage: device.rawData?.voltage,
      consumption: device.rawData?.consumption,
    }
  };

  // Open modal in BAS mode
  MyIOLibrary.openDashboardPopupEnergy({
    basMode: true,
    basDevice: basDevice,
    deviceId: device.entityId,
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
    tbJwtToken: ctx.http?.token,
    readingType: 'energy',
    onRemoteCommand: async (command, dev) => {
      return sendRemoteCommand(ctx, dev.entityId, command);
    },
    onTelemetryRefresh: async (dev) => {
      return fetchDeviceTelemetry(ctx, dev.entityId);
    },
    onClose: () => {
      console.log('[MAIN_BAS] BAS modal closed');
    }
  });
}
```

## Implementation Plan

### Phase 1: BASControlPanel Component
1. Create `BASControlPanel.ts` with status, remote control, telemetry sections
2. Add CSS styles for the control panel
3. Implement auto-refresh for telemetry

### Phase 2: EnergyModalView BAS Mode
1. Add `basMode` option to types
2. Implement `createBASModeContent()` in EnergyModalView
3. Add BAS layout CSS
4. Initialize BASControlPanel when basMode=true

### Phase 3: MAIN_BAS Integration
1. Update `handleMotorCardClick` to open BAS modal
2. Implement `sendRemoteCommand` function
3. Implement `fetchDeviceTelemetry` function
4. Test with real ThingsBoard devices

### Phase 4: Showcase
1. Create/update `showcase/myio-bas/index.html`
2. Add mock device data
3. Test BAS modal with various device states

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `src/components/premium-modals/energy/types.ts` | Modify | Add BAS types |
| `src/components/premium-modals/energy/BASControlPanel.ts` | Create | Control panel component |
| `src/components/premium-modals/energy/EnergyModalView.ts` | Modify | Add BAS mode support |
| `src/thingsboard/bas-components/MAIN_BAS/controller.js` | Modify | Card click handler |
| `showcase/myio-bas/index.html` | Update | Add BAS modal showcase |

## Testing

1. **Unit Tests**
   - BASControlPanel renders correctly
   - Remote buttons trigger callbacks
   - Telemetry updates display correctly

2. **Integration Tests**
   - Modal opens in BAS mode from MAIN_BAS
   - Chart renders alongside control panel
   - Remote commands execute successfully

3. **Visual Tests**
   - Layout responsive at different sizes
   - Dark/light theme support
   - Status indicators animate correctly

## Backward Compatibility

- `basMode` defaults to `false`, preserving existing behavior
- No changes to existing API signatures
- Existing modal usage continues to work unchanged

## Open Questions

1. Should telemetry auto-refresh be configurable interval?
2. Should we show command history in the control panel?
3. Should remote buttons be disabled when device is offline?

---

_RFC-0165 - BAS Device Modal with Automation Control Panel_
_Created: 2026-02-09_
