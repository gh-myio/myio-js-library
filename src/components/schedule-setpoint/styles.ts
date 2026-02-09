/**
 * Schedule Setpoint Component Styles
 * Component-specific styles (setpoint input, error display, overlap highlight).
 */

import { SCHED_CSS_PREFIX } from '../scheduling-shared';

export const SCHEDULE_SETPOINT_CSS_PREFIX = 'myio-sched-setpoint';

export const SCHEDULE_SETPOINT_STYLES = `
.${SCHEDULE_SETPOINT_CSS_PREFIX}__overlap-card {
  border: 1px solid #FF5252 !important;
}

.${SCHEDULE_SETPOINT_CSS_PREFIX}__overlap-error {
  color: #FF5252;
  font-size: 0.85em;
  padding: 4px 8px;
  width: 100%;
}
`;

let _stylesInjected = false;

export function injectScheduleSetpointStyles(): void {
  if (_stylesInjected) return;
  const existing = document.getElementById('myio-sched-setpoint-styles');
  if (existing) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'myio-sched-setpoint-styles';
  style.textContent = SCHEDULE_SETPOINT_STYLES;
  document.head.appendChild(style);
  _stylesInjected = true;
}
