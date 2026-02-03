/**
 * RFC-0158: Fancoil Remote Control Component
 * Migrated from remote-version-fancoil-widget-v1.0.0
 *
 * A component that renders a remote control interface for HVAC fancoil units.
 * Features:
 * - Power on/off control
 * - Temperature setpoint adjustment (16-28°C)
 * - Auto/Manual mode display
 * - Ambient temperature and consumption metrics
 * - Confirmation dialogs for actions
 * - Light/Dark theme support
 *
 * @example
 * ```typescript
 * import { createFancoilRemote } from 'myio-js-library';
 *
 * const fancoil = createFancoilRemote(container, {
 *   settings: {
 *     centralId: 'my-central-id',
 *     themeMode: 'dark',
 *   },
 *   initialState: {
 *     status: 'on',
 *     mode: 'auto',
 *     ambientTemperature: 24.5,
 *     consumption: 1.2,
 *     temperatureSetpoint: 23,
 *   },
 *   onPowerToggle: async (currentStatus) => {
 *     // Call API to toggle power
 *     return true; // Return true if successful
 *   },
 *   onTemperatureChange: async (newTemp) => {
 *     // Call API to change temperature
 *     return true; // Return true if successful
 *   },
 *   onSettingsClick: () => {
 *     // Navigate to settings page
 *   },
 * });
 *
 * // Update state from real-time data
 * fancoil.updateState({
 *   ambientTemperature: 25.0,
 *   consumption: 1.5,
 * });
 *
 * // Clean up
 * fancoil.destroy();
 * ```
 */

export {
  FancoilRemoteController,
  createFancoilRemote,
} from './FancoilRemoteController';

export { FancoilRemoteView } from './FancoilRemoteView';

export {
  FANCOIL_REMOTE_CSS_PREFIX,
  injectFancoilRemoteStyles,
} from './styles';

export {
  // Types
  type FancoilStatus,
  type FancoilMode,
  type FancoilThemeMode,
  type FancoilRemoteSettings,
  type FancoilState,
  type FancoilRemoteParams,
  type FancoilRemoteInstance,
  // Constants
  FANCOIL_IMAGES,
  DEFAULT_FANCOIL_SETTINGS,
  DEFAULT_FANCOIL_STATE,
  // Utilities
  getImageByConsumption,
} from './types';
