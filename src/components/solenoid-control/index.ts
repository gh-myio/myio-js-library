/**
 * RFC-0158: Solenoid Control Component
 * Migrated from acionamento-solenoide-com-on-off
 *
 * A component that renders a solenoid valve control interface.
 * Features:
 * - Valve open/close toggle with confirmation dialog
 * - Visual status display (open, closed, unavailable)
 * - Related devices tracking for API calls
 * - Light/Dark theme support
 *
 * @example
 * ```typescript
 * import { createSolenoidControl } from 'myio-js-library';
 *
 * const solenoid = createSolenoidControl(container, {
 *   settings: {
 *     centralId: 'my-central-id',
 *     themeMode: 'dark',
 *   },
 *   initialState: {
 *     status: 'on',
 *     deviceName: 'Solenoide 01',
 *     relatedDevices: ['Device A', 'Device B'],
 *   },
 *   onToggle: async (currentStatus, deviceName, relatedDevices) => {
 *     // POST to central API
 *     return true;
 *   },
 * });
 *
 * // Update from telemetry
 * solenoid.updateState({ status: 'off' });
 *
 * // Clean up
 * solenoid.destroy();
 * ```
 */

export {
  SolenoidControlController,
  createSolenoidControl,
} from './SolenoidControlController';

export { SolenoidControlView } from './SolenoidControlView';

export {
  SOLENOID_CONTROL_CSS_PREFIX,
  injectSolenoidControlStyles,
} from './styles';

export {
  // Types
  type SolenoidStatus,
  type SolenoidThemeMode,
  type SolenoidControlSettings,
  type SolenoidState,
  type SolenoidControlParams,
  type SolenoidControlInstance,
  // Constants
  SOLENOID_IMAGES,
  DEFAULT_SOLENOID_SETTINGS,
  DEFAULT_SOLENOID_STATE,
} from './types';
