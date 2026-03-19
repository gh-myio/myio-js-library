/**
 * Schedule Holiday Component
 * Migrated from feriado-v6
 *
 * A component for managing holiday dates (date input + list with remove).
 *
 * @example
 * ```typescript
 * import { createScheduleHoliday } from 'myio-js-library';
 *
 * const scheduler = createScheduleHoliday(container, {
 *   settings: { themeMode: 'dark' },
 *   initialState: {
 *     entityName: 'Central',
 *     holidays: [
 *       { holidayDates: '2026-01-01' },
 *       { holidayDates: '2026-12-25' },
 *     ],
 *   },
 *   onSave: async (holidays) => {
 *     // Send to API
 *     return true;
 *   },
 * });
 * ```
 */

export {
  ScheduleHolidayController,
  createScheduleHoliday,
} from './ScheduleHolidayController';

export { ScheduleHolidayView } from './ScheduleHolidayView';

export {
  SCHEDULE_HOLIDAY_CSS_PREFIX,
  injectScheduleHolidayStyles,
} from './styles';

export {
  type HolidayEntry,
  type ScheduleHolidaySettings,
  type ScheduleHolidayState,
  type ScheduleHolidayParams,
  type ScheduleHolidayInstance,
  DEFAULT_HOLIDAY_STATE,
  DEFAULT_HOLIDAY_SETTINGS,
} from './types';
