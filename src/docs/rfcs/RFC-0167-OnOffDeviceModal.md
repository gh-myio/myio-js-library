# RFC-0167: On/Off Device Modal

- **Start Date:** 2026-02-10
- **Status:** Draft
- **Related RFCs:** RFC-0165 (BAS Device Modal)

## Summary

Implement a dedicated modal component for On/Off devices (solenoids, lighting switches, relays) in the BAS panel, providing device control, scheduling capabilities, and usage visualization in a unified interface.

## Motivation

Currently, when users click on a device in the BAS panel (`CardGridPanel`), a generic device modal opens. On/Off devices require specialized controls:

1. **Device Control** - Manual on/off toggle with visual feedback
2. **Scheduling** - Automated on/off scheduling for automation
3. **Usage Charts** - Historical usage/consumption visualization

Existing components are already available but not integrated into a cohesive modal experience:
- `MyIOLibrary.createSolenoidControl` - On/Off control component (works for any binary device)
- `src/components/schedule-on-off` - Scheduling component
- `src/components/DistributionChart` - Chart visualization

### Supported Device Types

| Device Profile | Description | Use Case |
|----------------|-------------|----------|
| `SOLENOIDE` | Solenoid valve | Water irrigation, valve control |
| `INTERRUPTOR` | Light switch | Lighting automation |
| `RELE` | Relay | Generic on/off control |
| `BOMBA` | Pump | Water pump control |

## Detailed Design

### Modal Layout

```
+------------------------------------------------------------------+
|  [X] Device Control - {Device Name}                    [?] [_][X]|
+------------------------------------------------------------------+
|          |                                                        |
|  20%     |                    80% width                           |
|  width   |                                                        |
| +------+ | +----------------------------------------------------+ |
| |      | | |                                                    | |
| | ON/  | | |                                                    | |
| | OFF  | | |              Distribution Chart                    | |
| |Control| | |                                                    | |
| | 50%  | | |                  (or)                              | |
| |height| | |                                                    | |
| +------+ | |              Schedule On/Off                       | |
| +------+ | |                                                    | |
| |Sched.| | |                                                    | |
| |Button| | |                                                    | |
| | 50%  | | |                                                    | |
| |height| | +----------------------------------------------------+ |
| +------+ |                                                        |
+------------------------------------------------------------------+
```

### Component Structure

```typescript
// src/components/premium-modals/on-off-device/OnOffDeviceModal.ts

interface OnOffDeviceModalParams {
  container: HTMLElement;
  device: DeviceData;
  deviceType: 'solenoid' | 'switch' | 'relay' | 'pump' | 'generic';
  themeMode: 'light' | 'dark';
  jwtToken: string;
  tbBaseUrl?: string;
  onClose?: () => void;
  onStateChange?: (deviceId: string, state: boolean) => void;
}

interface OnOffDeviceModalInstance {
  element: HTMLElement;
  destroy: () => void;
  setTheme: (mode: 'light' | 'dark') => void;
  updateDeviceState: (state: boolean) => void;
}
```

### File Structure

```
src/components/premium-modals/on-off-device/
├── index.ts                      # Factory function export
├── OnOffDeviceModalView.ts       # DOM rendering
├── OnOffDeviceModalController.ts # State management
├── styles.ts                     # CSS-in-JS styles
├── types.ts                      # TypeScript interfaces
└── deviceConfig.ts               # Device-specific configurations
```

### Device Configuration

```typescript
// src/components/premium-modals/on-off-device/deviceConfig.ts

export const DEVICE_CONFIG: Record<string, DeviceTypeConfig> = {
  SOLENOIDE: {
    icon: '🚿',
    labelOn: 'Aberta',
    labelOff: 'Fechada',
    chartTitle: 'Consumo de Água',
    chartUnit: 'L',
    controlColor: '#3b82f6', // blue
  },
  INTERRUPTOR: {
    icon: '💡',
    labelOn: 'Ligado',
    labelOff: 'Desligado',
    chartTitle: 'Tempo de Uso',
    chartUnit: 'h',
    controlColor: '#eab308', // yellow
  },
  RELE: {
    icon: '⚡',
    labelOn: 'Ativado',
    labelOff: 'Desativado',
    chartTitle: 'Ativações',
    chartUnit: 'ciclos',
    controlColor: '#8b5cf6', // purple
  },
  BOMBA: {
    icon: '💧',
    labelOn: 'Ligada',
    labelOff: 'Desligada',
    chartTitle: 'Tempo de Operação',
    chartUnit: 'h',
    controlColor: '#06b6d4', // cyan
  },
};

export function getDeviceConfig(deviceProfile: string): DeviceTypeConfig {
  const profile = deviceProfile?.toUpperCase() || 'GENERIC';
  return DEVICE_CONFIG[profile] || {
    icon: '🔌',
    labelOn: 'On',
    labelOff: 'Off',
    chartTitle: 'Usage',
    chartUnit: '',
    controlColor: '#64748b',
  };
}
```

### Integration Point

Modify `CardGridPanel` click handler in `MAIN_BAS/controller.js`:

```javascript
// RFC-0167: On/Off device profiles that use the specialized modal
const ON_OFF_DEVICE_PROFILES = ['SOLENOIDE', 'INTERRUPTOR', 'RELE', 'BOMBA'];

handleClickCard: function (item) {
  LogHelper.log('[MAIN_BAS] Device clicked:', item.source);

  const deviceProfile = (item.source?.deviceProfile || '').toUpperCase();

  if (ON_OFF_DEVICE_PROFILES.includes(deviceProfile)) {
    // RFC-0167: Open On/Off Device modal
    openOnOffDeviceModal(item.source, settings);
  } else {
    // RFC-0165: Open generic BAS modal
    openBASDeviceModal(item.source, settings);
  }

  window.dispatchEvent(new CustomEvent('bas:device-clicked', {
    detail: { device: item.source }
  }));
},
```

### Left Panel Components (20% width)

#### 1. On/Off Control (50% height)
```typescript
const config = getDeviceConfig(device.deviceProfile);

const deviceControl = MyIOLibrary.createSolenoidControl({
  container: leftTopContainer,
  deviceId: device.id,
  initialState: device.attributes?.state || false,
  themeMode: themeMode,
  labels: {
    on: config.labelOn,
    off: config.labelOff,
  },
  icon: config.icon,
  color: config.controlColor,
  onStateChange: async (newState) => {
    await sendDeviceCommand(device.id, newState);
  }
});
```

#### 2. Schedule Button (50% height)
```typescript
const scheduleButton = MyIOLibrary.createActionButton({
  container: leftBottomContainer,
  icon: '📅',
  label: 'Agendamento',
  variant: 'secondary',
  onClick: () => toggleScheduleView()
});
```

### Right Panel (80% width)

Toggle between two views:

#### View 1: Distribution Chart (default)
```typescript
const config = getDeviceConfig(device.deviceProfile);

const chart = MyIOLibrary.createDistributionChart({
  container: rightContainer,
  data: usageData,
  themeMode: themeMode,
  title: config.chartTitle,
  unit: config.chartUnit,
});
```

#### View 2: Schedule On/Off
```typescript
const schedule = MyIOLibrary.createScheduleOnOff({
  container: rightContainer,
  deviceId: device.id,
  schedules: existingSchedules,
  onSave: async (schedules) => {
    await saveSchedules(device.id, schedules);
  }
});
```

### State Management

```typescript
type ModalView = 'chart' | 'schedule';

interface OnOffDeviceModalState {
  currentView: ModalView;
  deviceState: boolean;
  isLoading: boolean;
  schedules: Schedule[];
  chartData: DistributionDataPoint[];
  deviceConfig: DeviceTypeConfig;
}
```

### View Toggle Logic

```typescript
function toggleScheduleView() {
  if (state.currentView === 'chart') {
    // Hide chart, show schedule
    chartContainer.style.display = 'none';
    scheduleContainer.style.display = 'block';
    scheduleButton.setLabel('Ver Gráfico');
    scheduleButton.setIcon('📊');
    state.currentView = 'schedule';
  } else {
    // Hide schedule, show chart
    scheduleContainer.style.display = 'none';
    chartContainer.style.display = 'block';
    scheduleButton.setLabel('Agendamento');
    scheduleButton.setIcon('📅');
    state.currentView = 'chart';
  }
}
```

## Implementation Plan

### Phase 1: Modal Structure
- [ ] Create `OnOffDeviceModal` component structure
- [ ] Implement basic modal layout (20/80 split)
- [ ] Add close button and header with device icon
- [ ] Style with theme support (light/dark)
- [ ] Create `deviceConfig.ts` with device-specific settings

### Phase 2: Left Panel Integration
- [ ] Integrate `SolenoidControl` component (rename to generic?)
- [ ] Add schedule toggle button with `ActionButton`
- [ ] Handle device state changes
- [ ] Apply device-specific labels and colors

### Phase 3: Right Panel Views
- [ ] Integrate `DistributionChart` with mock data
- [ ] Integrate `ScheduleOnOff` component
- [ ] Implement view toggle logic
- [ ] Apply device-specific chart titles/units

### Phase 4: MAIN_BAS Integration
- [ ] Define `ON_OFF_DEVICE_PROFILES` array
- [ ] Modify `handleClickCard` to detect supported profiles
- [ ] Add `openOnOffDeviceModal` function
- [ ] Pass required settings (jwtToken, themeMode, etc.)

### Phase 5: API Integration
- [ ] Implement device RPC commands (on/off)
- [ ] Fetch real usage data for chart
- [ ] Save/load schedules from device attributes

## Existing Components Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| `createSolenoidControl` | `src/components/solenoid-control` | On/Off toggle control |
| `createScheduleOnOff` | `src/components/schedule-on-off` | Time-based scheduling |
| `createDistributionChart` | `src/components/DistributionChart` | Usage visualization |
| `createActionButton` | `src/components/action-button` | Generic action buttons |
| `EnergyDataModal` | `src/components/premium-modals/energy` | Reference implementation |

## Drawbacks

- Adds complexity to the BAS panel click handling
- Requires maintaining another modal component
- Mock data initially may confuse users
- `SolenoidControl` component name is specific but used generically

## Alternatives

1. **Extend BAS Device Modal** - Add on/off-specific tab to existing RFC-0165 modal
   - Rejected: Would make BAS modal too complex for non-controllable devices

2. **Inline Controls** - Show controls directly in the card grid
   - Rejected: Not enough space for scheduling and charts

3. **Separate modals per device type** - Create SolenoidModal, SwitchModal, etc.
   - Rejected: Too much code duplication, all share same functionality

## Unresolved Questions

1. Should `SolenoidControl` component be renamed to `OnOffControl`?
2. What RPC method names are used for each device type?
3. Should schedules be stored as device attributes or server-side?
4. Maximum number of schedules per device?
5. Should we support momentary (pulse) mode for some devices?

## Future Possibilities

- Device grouping (control multiple lights at once)
- Scene support (predefined states for multiple devices)
- Energy monitoring integration for switches
- Voice control integration
- Geofencing-based automation
- Sunrise/sunset scheduling
