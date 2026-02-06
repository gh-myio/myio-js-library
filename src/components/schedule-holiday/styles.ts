/**
 * Schedule Holiday Component Styles
 * Component-specific styles (date input, date list).
 */

export const SCHEDULE_HOLIDAY_CSS_PREFIX = 'myio-sched-holiday';

export const SCHEDULE_HOLIDAY_STYLES = `
/* Component-specific styles for schedule-holiday are minimal;
   most styling comes from scheduling-shared styles. */
`;

let _stylesInjected = false;

export function injectScheduleHolidayStyles(): void {
  if (_stylesInjected) return;
  const existing = document.getElementById('myio-sched-holiday-styles');
  if (existing) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'myio-sched-holiday-styles';
  style.textContent = SCHEDULE_HOLIDAY_STYLES;
  document.head.appendChild(style);
  _stylesInjected = true;
}
