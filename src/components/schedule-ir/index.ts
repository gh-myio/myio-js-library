/**
 * Schedule IR Component
 * Migrated from agendamento-ir
 *
 * A component for scheduling IR commands with single time + on/off action.
 * Supports individual schedules and read-only group schedules.
 *
 * @example
 * ```typescript
 * import { createScheduleIR } from 'myio-js-library';
 *
 * const scheduler = createScheduleIR(container, {
 *   settings: { themeMode: 'dark' },
 *   initialState: {
 *     entityName: 'IR Device',
 *     availableCommands: [
 *       { command_id: 'cmd_22', temperature: '22', slave_id: '1' },
 *       { command_id: 'cmd_24', temperature: '24', slave_id: '2' },
 *     ],
 *     schedules: [],
 *   },
 *   onSave: async (schedules) => {
 *     // Send to API
 *     return true;
 *   },
 * });
 * ```
 */

export {
  ScheduleIRController,
  createScheduleIR,
} from './ScheduleIRController';

export { ScheduleIRView } from './ScheduleIRView';

export {
  SCHEDULE_IR_CSS_PREFIX,
  injectScheduleIRStyles,
} from './styles';

export {
  type IRCommand,
  type IRScheduleEntry,
  type IRGroupScheduleEntry,
  type ScheduleIRSettings,
  type ScheduleIRState,
  type ScheduleIRParams,
  type ScheduleIRInstance,
  DEFAULT_IR_SCHEDULE,
  DEFAULT_IR_STATE,
  DEFAULT_IR_SETTINGS,
} from './types';
