/**
 * RFC-0172: Switch Control Component
 * On/Off interruptor control for ambiente devices
 *
 * A self-contained component with CSS injection for controlling
 * on/off switch states with visual feedback.
 *
 * Features:
 * - Toggle switch with on/off/offline states
 * - Confirmation dialog before toggle
 * - Loading state during API calls
 * - Success/error toast notifications
 * - Light/Dark theme support
 * - Fully injected CSS (no external dependencies)
 *
 * @example
 * ```typescript
 * import { createSwitchControl } from 'myio-js-library';
 *
 * const switchCtrl = createSwitchControl(container, {
 *   settings: {
 *     themeMode: 'dark',
 *     showConfirmation: true,
 *   },
 *   initialState: {
 *     status: 'on',
 *     name: 'Luz da Sala',
 *     id: 'device-123',
 *   },
 *   onToggle: async (newStatus, state) => {
 *     const response = await api.sendCommand(state.id, newStatus);
 *     return response.success;
 *   },
 * });
 *
 * // Update from telemetry
 * switchCtrl.updateState({ status: 'off' });
 *
 * // Clean up
 * switchCtrl.destroy();
 * ```
 */

export {
  SwitchControlController,
  createSwitchControl,
} from './SwitchControlController';

export { SwitchControlView } from './SwitchControlView';

export {
  SWITCH_CONTROL_CSS_PREFIX,
  injectSwitchControlStyles,
} from './styles';

export {
  // Types
  type SwitchStatus,
  type SwitchThemeMode,
  type SwitchControlSettings,
  type SwitchState,
  type SwitchControlParams,
  type SwitchControlInstance,
  // Constants
  DEFAULT_SWITCH_SETTINGS,
  DEFAULT_SWITCH_STATE,
} from './types';
