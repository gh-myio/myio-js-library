# RFC 0169: Ambiente Detail Modal Component

- Feature Name: `ambiente_detail_modal`
- Start Date: 2026-02-11
- RFC PR: (to be assigned)
- Status: **Implemented**
- Authors: MYIO Engineering
- Target Version: v0.2.x
- Related Components: RFC-0168 (ASSET_AMBIENT Environment Cards)

---

## Summary

A modal component that displays detailed information about an Ambiente (environment) when a user clicks on an ambiente card. The modal shows aggregated metrics, child devices, and remote control toggles.

---

## Motivation

### Problem

When users click on an ambiente card in the BAS dashboard, they need to see more detailed information about:
- Current environmental conditions (temperature, humidity)
- Energy consumption breakdown by device
- Remote control status and quick toggle actions
- List of all child devices in the ambiente

### Solution

Create a dedicated modal component that:
1. Opens on ambiente card click
2. Displays aggregated metrics prominently
3. Lists energy devices with individual consumption
4. Provides remote control toggles for each remote device
5. Shows status (online/offline/warning) clearly

---

## Guide-level Explanation

### What is the Ambiente Detail Modal?

The `AmbienteDetailModal` is a popup dialog that appears when a user clicks on an ambiente card in the MAIN_BAS dashboard. It provides a detailed view of the ambiente's current state and allows users to interact with remote controls.

### Modal Sections

```
+------------------------------------------+
|  Sala do Nobreak                    [X]  |  <- Header with title
|  Melicidade-SalaNobreak                  |  <- Subtitle (asset name)
+------------------------------------------+
|  [🟢] Ambiente Online                    |  <- Status banner
+------------------------------------------+
|  +--------+  +--------+  +--------+  +--------+
|  | 🌡️    |  | 💧    |  | ⚡     |  | 📱    |
|  | 24.5   |  | 58     |  | 2.1 kW |  | 3     |
|  | Temp   |  | Humid  |  | Consumo|  | Devices|
|  +--------+  +--------+  +--------+  +--------+
|                                          |
|  ⚡ Medidores de Energia (2)             |
|  +--------------------------------------+|
|  | ⚡ 3F Ar Nobreak     |     1.2 kW   ||
|  +--------------------------------------+|
|  | ⚡ 3F Fancoil        |     0.9 kW   ||
|  +--------------------------------------+|
|                                          |
|  🎮 Controles Remotos (1)                |
|  +------------------+                    |
|  | 🟢 Ar Nobreak ON |                    |
|  +------------------+                    |
+------------------------------------------+
|                              [Fechar]    |
+------------------------------------------+
```

### Usage Flow

1. User views ambiente cards in the BAS dashboard
2. User clicks on an ambiente card
3. Modal opens with detailed ambiente information
4. User can:
   - View current metrics (temperature, humidity, consumption)
   - See individual device consumption values
   - Toggle remote controls ON/OFF
   - Close the modal

---

## Reference-level Explanation

### Data Flow

```
Card Click Event
       │
       ▼
handleClickCard(item)
       │
       ├─→ Dispatch 'bas:ambiente-clicked' event
       │
       └─→ openAmbienteDetailModal(ambienteData, source, settings)
              │
              ▼
       MyIOLibrary.openAmbienteDetailModal()
              │
              ▼
       createAmbienteDetailModal()
              │
              ├─→ injectAmbienteModalStyles()
              ├─→ renderModalHTML()
              └─→ attachEventListeners()
                     │
                     ├─→ Close button → close()
                     ├─→ Backdrop click → close()
                     ├─→ Escape key → close()
                     └─→ Remote toggle → onRemoteToggle callback
```

### Component API

#### Types

```typescript
interface AmbienteData {
  id: string;
  label: string;
  identifier?: string;
  temperature: number | null;
  humidity: number | null;
  consumption: number | null;
  energyDevices: AmbienteEnergyDevice[];
  remoteDevices: AmbienteRemoteDevice[];
  isOn?: boolean;
  hasRemote?: boolean;
  status: 'online' | 'offline' | 'warning';
  hasSetupWarning: boolean;
  devices: AmbienteChildDevice[];
  childDeviceCount: number;
}

interface AmbienteEnergyDevice {
  id: string;
  name: string;
  label: string;
  deviceType: string;
  consumption: number | null;
  status: string;
}

interface AmbienteRemoteDevice {
  id: string;
  name: string;
  label: string;
  deviceType: string;
  isOn: boolean;
  status: string;
}

interface AmbienteDetailModalConfig {
  themeMode?: 'light' | 'dark';
  jwtToken?: string;
  showTimelineChart?: boolean;
  onRemoteToggle?: (isOn: boolean, remote: AmbienteRemoteDevice) => void;
  onClose?: () => void;
}

interface AmbienteDetailModalInstance {
  open: () => void;
  close: () => void;
  update: (data: AmbienteData) => void;
  destroy: () => void;
}
```

#### Functions

```typescript
// Create modal instance
function createAmbienteDetailModal(
  data: AmbienteData,
  source: AmbienteHierarchyNode | null,
  config?: AmbienteDetailModalConfig
): AmbienteDetailModalInstance;

// Convenience function - creates and opens modal
function openAmbienteDetailModal(
  data: AmbienteData,
  source: AmbienteHierarchyNode | null,
  config?: AmbienteDetailModalConfig
): AmbienteDetailModalInstance;
```

### CSS Classes

| Class | Description |
|-------|-------------|
| `.myio-ambiente-modal-overlay` | Overlay backdrop |
| `.myio-ambiente-modal` | Main modal container |
| `.myio-ambiente-modal__header` | Header with title and close button |
| `.myio-ambiente-modal__status-banner` | Status indicator banner |
| `.myio-ambiente-modal__metrics-grid` | Grid of metric cards |
| `.myio-ambiente-modal__metric-card` | Individual metric card |
| `.myio-ambiente-modal__section` | Section container |
| `.myio-ambiente-modal__device-list` | List of devices |
| `.myio-ambiente-modal__device-item` | Individual device row |
| `.myio-ambiente-modal__remote-controls` | Remote control buttons container |
| `.myio-ambiente-modal__remote-btn` | Remote toggle button |
| `.myio-ambiente-modal__footer` | Footer with close button |

### Theme Support

The modal supports light and dark themes via CSS custom properties:

```css
/* Light theme (default) */
--ambiente-modal-bg: #ffffff;
--ambiente-modal-body-bg: #f8f9fa;

/* Dark theme */
.myio-ambiente-modal--dark {
  --ambiente-modal-bg: #1f2937;
  --ambiente-modal-body-bg: #111827;
}
```

---

## Implementation Details

### File Structure

```
src/components/ambiente-detail-modal/
├── AmbienteDetailModal.ts   # Main component logic
├── styles.ts                # CSS-in-JS styles
├── types.ts                 # TypeScript interfaces
└── index.ts                 # Public exports
```

### Controller Integration

In `controller.js`, the modal is opened via:

```javascript
function openAmbienteDetailModal(ambienteData, source, settings) {
  if (!MyIOLibrary.openAmbienteDetailModal) {
    LogHelper.warn('[MAIN_BAS] openAmbienteDetailModal not available');
    return;
  }

  var jwtToken = localStorage.getItem('jwt_token');

  MyIOLibrary.openAmbienteDetailModal(ambienteData, source, {
    themeMode: 'light',
    jwtToken: jwtToken,
    onRemoteToggle: function (isOn, remote) {
      window.dispatchEvent(
        new CustomEvent('bas:ambiente-remote-toggle', {
          detail: { isOn: isOn, ambiente: ambienteData, remote: remote },
        })
      );
    },
    onClose: function () {
      LogHelper.log('[MAIN_BAS] Ambiente Detail modal closed');
    },
  });
}
```

### Event Handling

| Event | Trigger | Action |
|-------|---------|--------|
| `bas:ambiente-clicked` | Card click | Dispatched before modal opens |
| `bas:ambiente-remote-toggle` | Remote button click | Dispatched with isOn state and remote data |

---

## Accessibility

The modal implements the following accessibility features:

1. **Focus Management**
   - Focus is trapped within the modal when open
   - Focus returns to trigger element on close

2. **Keyboard Navigation**
   - `Escape` key closes the modal
   - `Tab` cycles through interactive elements

3. **ARIA Attributes**
   - `role="dialog"` on modal
   - `aria-modal="true"` to indicate modal state
   - `aria-labelledby` pointing to title

4. **Screen Reader Support**
   - Status announcements
   - Button labels
   - Metric descriptions

---

## Responsive Design

The modal adapts to different screen sizes:

| Breakpoint | Behavior |
|------------|----------|
| `> 600px` | Standard modal (800px width) |
| `<= 600px` | Full screen, 2-column metrics grid |

---

## Examples

### Example 1: Basic Usage

```typescript
import { openAmbienteDetailModal } from 'myio-js-library';

const ambienteData = {
  id: 'amb-001',
  label: 'Sala do Nobreak',
  temperature: 24.5,
  humidity: 58,
  consumption: 2100,
  status: 'online',
  hasSetupWarning: false,
  energyDevices: [
    { id: 'dev-1', name: '3F Ar Nobreak', consumption: 1200 },
    { id: 'dev-2', name: '3F Fancoil', consumption: 900 },
  ],
  remoteDevices: [
    { id: 'rem-1', name: 'Ar Nobreak', isOn: true },
  ],
  devices: [],
  childDeviceCount: 3,
};

openAmbienteDetailModal(ambienteData, null, {
  onRemoteToggle: (isOn, remote) => {
    console.log(`Toggle ${remote.name} to ${isOn ? 'ON' : 'OFF'}`);
  },
});
```

### Example 2: With Source Hierarchy

```typescript
const source = {
  id: 'asset-001',
  name: 'Melicidade-SalaNobreak',
  assetType: 'ASSET_AMBIENT',
  displayLabel: 'Sala do Nobreak',
};

openAmbienteDetailModal(ambienteData, source, {
  themeMode: 'dark',
});
```

### Example 3: Empty Ambiente (Setup Warning)

```typescript
const emptyAmbiente = {
  id: 'amb-002',
  label: 'Novo Ambiente',
  temperature: null,
  humidity: null,
  consumption: null,
  status: 'warning',
  hasSetupWarning: true,
  energyDevices: [],
  remoteDevices: [],
  devices: [],
  childDeviceCount: 0,
};

openAmbienteDetailModal(emptyAmbiente, null);
// Shows warning: "Este ambiente ainda não possui dispositivos configurados."
```

---

## Testing

### Unit Tests

1. `createAmbienteDetailModal` creates instance correctly
2. `open()` adds modal to DOM and shows overlay
3. `close()` removes modal and cleans up
4. `update()` refreshes modal content
5. Remote toggle callbacks fire correctly

### Integration Tests

1. Card click opens modal with correct data
2. Remote toggle dispatches correct event
3. Escape key closes modal
4. Backdrop click closes modal

### Manual Tests

1. Click ambiente card → modal opens
2. Verify metrics display correctly
3. Toggle remote control → verify event
4. Close modal → verify cleanup
5. Test responsive layout on mobile

---

## Future Enhancements

1. **Timeline Chart**: Add on/off activation timeline for remote devices
2. **History Tab**: Show historical temperature/consumption data
3. **Scheduling**: Quick access to schedule remote activations
4. **Alerts**: Display active alerts for the ambiente
5. **Device Details**: Click on device to open device detail modal

---

## Files Modified/Created

| File | Change Type |
|------|-------------|
| `src/components/ambiente-detail-modal/AmbienteDetailModal.ts` | Created |
| `src/components/ambiente-detail-modal/styles.ts` | Created |
| `src/components/ambiente-detail-modal/types.ts` | Created |
| `src/components/ambiente-detail-modal/index.ts` | Created |
| `src/index.ts` | Modified (added exports) |
| `src/thingsboard/bas-components/MAIN_BAS/controller.js` | Modified (added modal integration) |

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-02-11 | 1.0 | MYIO Engineering | Initial implementation |

---

## References

- [RFC-0168: ASSET_AMBIENT Environment Cards](./RFC-0168-AssetAmbientEnvironmentCards.md)
- [RFC-0167: On/Off Device Modal](./RFC-0167-OnOffDeviceModal.md)
- [SettingsModalView.ts](../../components/premium-modals/settings/SettingsModalView.ts)
