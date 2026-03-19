/**
 * Schedule IR Component Styles
 * Component-specific styles (action toggle, command dropdown).
 */

export const SCHEDULE_IR_CSS_PREFIX = 'myio-sched-ir';

export const SCHEDULE_IR_STYLES = `
/* Component-specific styles for schedule-ir are minimal;
   most styling comes from scheduling-shared styles. */
`;

let _stylesInjected = false;

export function injectScheduleIRStyles(): void {
  if (_stylesInjected) return;
  const existing = document.getElementById('myio-sched-ir-styles');
  if (existing) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'myio-sched-ir-styles';
  style.textContent = SCHEDULE_IR_STYLES;
  document.head.appendChild(style);
  _stylesInjected = true;
}
