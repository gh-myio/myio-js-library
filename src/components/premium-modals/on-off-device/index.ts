/**
 * RFC-0167: On/Off Device Modal
 *
 * A modal component for controlling On/Off devices (solenoids, switches, relays, pumps)
 * in the BAS panel. Provides device control, scheduling capabilities, and usage visualization.
 *
 * @example
 * ```typescript
 * import { openOnOffDeviceModal } from 'myio-js-library';
 *
 * // Open modal for a solenoid device
 * const modal = openOnOffDeviceModal(device, {
 *   themeMode: 'dark',
 *   jwtToken: 'your-jwt-token',
 *   onStateChange: (deviceId, state) => {
 *     console.log('Device state changed:', deviceId, state);
 *   },
 *   onScheduleSave: (deviceId, schedules) => {
 *     console.log('Schedules saved:', deviceId, schedules);
 *   },
 *   onClose: () => {
 *     console.log('Modal closed');
 *   },
 * });
 *
 * // Update device state externally
 * modal.updateDeviceState(true);
 *
 * // Change theme
 * modal.setTheme('light');
 *
 * // Close modal programmatically
 * modal.close();
 *
 * // Destroy modal and cleanup
 * modal.destroy();
 * ```
 */

export {
  OnOffDeviceModalController,
  createOnOffDeviceModal,
  openOnOffDeviceModal,
} from './OnOffDeviceModalController';

export { OnOffDeviceModalView } from './OnOffDeviceModalView';

export {
  ON_OFF_MODAL_CSS_PREFIX,
  injectOnOffDeviceModalStyles,
} from './styles';

export {
  ON_OFF_DEVICE_PROFILES,
  DEVICE_CONFIG,
  DEFAULT_DEVICE_CONFIG,
  isOnOffDeviceProfile,
  getDeviceConfig,
  getDeviceType,
  getModalTitle,
} from './deviceConfig';

export {
  // Types
  type OnOffDeviceType,
  type OnOffDeviceThemeMode,
  type OnOffModalView,
  type OnOffDeviceData,
  type DeviceTypeConfig,
  type OnOffScheduleEntry,
  type UsageDataPoint,
  type OnOffDeviceModalParams,
  type OnOffDeviceModalInstance,
  type OnOffDeviceModalState,
  // Constants
  DEFAULT_MODAL_STATE,
} from './types';
