/**
 * Schedule Setpoint Component
 * Migrated from agendamento-setpoint-temperatura-fancoil-v1.0.0
 *
 * A component for scheduling HVAC setpoint temperature with time intervals,
 * full validation (time format, overlap, range), and inline error display.
 *
 * @example
 * ```typescript
 * import { createScheduleSetpoint } from 'myio-js-library';
 *
 * const scheduler = createScheduleSetpoint(container, {
 *   settings: { themeMode: 'dark', minSetpoint: 16, maxSetpoint: 26 },
 *   initialState: {
 *     entityName: 'Fancoil A',
 *     devices: { fancoil: 'id1', temperature: 'id2', valve: 'id3' },
 *   },
 *   onSave: async (schedules, devices) => {
 *     // Send to API
 *     return true;
 *   },
 * });
 * ```
 */

export {
  ScheduleSetpointController,
  createScheduleSetpoint,
} from './ScheduleSetpointController';

export { ScheduleSetpointView } from './ScheduleSetpointView';

export {
  SCHEDULE_SETPOINT_CSS_PREFIX,
  injectScheduleSetpointStyles,
} from './styles';

export {
  type SetpointScheduleEntry,
  type ScheduleSetpointSettings,
  type ScheduleSetpointDevices,
  type ScheduleSetpointState,
  type ScheduleSetpointParams,
  type ScheduleSetpointInstance,
  DEFAULT_SETPOINT_SCHEDULE,
  DEFAULT_SETPOINT_STATE,
  DEFAULT_SETPOINT_SETTINGS,
} from './types';
