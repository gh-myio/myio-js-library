/**
 * Schedule On/Off Component Styles
 * Component-specific styles (retain toggle row).
 */

export const SCHEDULE_ON_OFF_CSS_PREFIX = 'myio-sched-onoff';

export const SCHEDULE_ON_OFF_STYLES = `
/* Component-specific styles for schedule-on-off are minimal;
   most styling comes from scheduling-shared styles. */
`;

let _stylesInjected = false;

export function injectScheduleOnOffStyles(): void {
  if (_stylesInjected) return;
  const existing = document.getElementById('myio-sched-onoff-styles');
  if (existing) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'myio-sched-onoff-styles';
  style.textContent = SCHEDULE_ON_OFF_STYLES;
  document.head.appendChild(style);
  _stylesInjected = true;
}
