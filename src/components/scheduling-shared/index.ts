/**
 * Scheduling Shared Module
 * Common types, styles, view helpers, and validation for all scheduling components.
 */

// Types
export type {
  SchedulingThemeMode,
  DaysWeek,
  ScheduleEntryBase,
  SchedulingBaseSettings,
  NotifyFn,
  ConfirmFn,
} from './types';

export {
  DEFAULT_DAYS_WEEK,
  DAY_LABELS,
  DAY_LABELS_FULL,
} from './types';

// Styles
export {
  SCHED_CSS_PREFIX,
  SCHEDULING_SHARED_STYLES,
  injectSchedulingSharedStyles,
  removeSchedulingSharedStyles,
} from './styles';

// View Helpers
export {
  escapeHtml,
  createDaysGrid,
  createTimeInput,
  createNumberInput,
  createDateInput,
  createScheduleCard,
  createGroupScheduleCard,
  showConfirmModal,
  showNotificationModal,
  createErrorSpan,
  createToggleSwitch,
  createButtonBar,
  createSelect,
} from './view-helpers';

// Validation
export {
  timeToMinutes,
  isValidTimeFormat,
  isEndAfterStart,
  doSchedulesOverlap,
  hasSelectedDays,
  isInRange,
} from './validation';
