/**
 * Schedule On/Off Component
 * Migrated from agendamento-individual-on-off-v1.0.0
 *
 * A component for scheduling on/off time intervals with day-of-week selection.
 * Supports individual schedules and read-only group schedules.
 *
 * @example
 * ```typescript
 * import { createScheduleOnOff } from 'myio-js-library';
 *
 * const scheduler = createScheduleOnOff(container, {
 *   settings: { themeMode: 'dark' },
 *   initialState: {
 *     entityName: 'Device A',
 *     schedules: [
 *       {
 *         startHour: '08:00', endHour: '18:00',
 *         retain: false, holiday: false,
 *         daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
 *       },
 *     ],
 *   },
 *   onSave: async (schedules) => {
 *     // Send to API
 *     return true;
 *   },
 * });
 * ```
 */

export {
  ScheduleOnOffController,
  createScheduleOnOff,
} from './ScheduleOnOffController';

export { ScheduleOnOffView } from './ScheduleOnOffView';

export {
  SCHEDULE_ON_OFF_CSS_PREFIX,
  injectScheduleOnOffStyles,
} from './styles';

export {
  type OnOffScheduleEntry,
  type OnOffGroupScheduleEntry,
  type ScheduleOnOffSettings,
  type ScheduleOnOffState,
  type ScheduleOnOffParams,
  type ScheduleOnOffInstance,
  DEFAULT_ON_OFF_SCHEDULE,
  DEFAULT_ON_OFF_STATE,
  DEFAULT_ON_OFF_SETTINGS,
} from './types';
