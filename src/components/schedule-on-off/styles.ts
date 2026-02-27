/**
 * Schedule On/Off Component Styles
 * Component-specific styles (retain toggle row).
 */

export const SCHEDULE_ON_OFF_CSS_PREFIX = 'myio-sched-onoff';

export const SCHEDULE_ON_OFF_STYLES = `
/* Action selector row */
.myio-sched__action-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}
.myio-sched__action-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.6);
  white-space: nowrap;
  min-width: 36px;
}
.myio-sched--light .myio-sched__action-label {
  color: rgba(0,0,0,0.5);
}
.myio-sched__action-btns {
  display: flex;
  gap: 4px;
  flex: 1;
}
.myio-sched__action-btn {
  flex: 1;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.2);
  background: transparent;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: all 0.15s ease;
}
.myio-sched--light .myio-sched__action-btn {
  border-color: rgba(0,0,0,0.2);
  color: rgba(0,0,0,0.6);
}
.myio-sched__action-btn:hover:not(:disabled) {
  border-color: rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.08);
}
.myio-sched--light .myio-sched__action-btn:hover:not(:disabled) {
  border-color: rgba(0,0,0,0.35);
  background: rgba(0,0,0,0.05);
}
.myio-sched__action-btn--active {
  background: #3b82f6;
  color: #fff;
  border-color: transparent;
}
.myio-sched__action-btn--active:hover:not(:disabled) {
  background: #2563eb;
  border-color: transparent;
}
.myio-sched__action-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
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
