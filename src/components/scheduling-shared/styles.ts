/**
 * Scheduling Shared Styles
 * Common CSS extracted from all 4 scheduling widgets.
 * Prefixed with `myio-sched` to avoid conflicts.
 */

export const SCHED_CSS_PREFIX = 'myio-sched';

export const SCHEDULING_SHARED_STYLES = `
/* ───────── Container ───────── */
.${SCHED_CSS_PREFIX} {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #e0e0e0;
  box-sizing: border-box;
}

.${SCHED_CSS_PREFIX}--light {
  color: #333;
}

/* ───────── Loading State ───────── */
.${SCHED_CSS_PREFIX}__loading {
  height: 100%;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.${SCHED_CSS_PREFIX}__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #673AB5;
  border-radius: 50%;
  animation: myio-sched-spin 0.8s linear infinite;
}

@keyframes myio-sched-spin {
  to { transform: rotate(360deg); }
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__spinner {
  border-color: rgba(0, 0, 0, 0.1);
  border-top-color: #673AB5;
}

/* ───────── Empty State ───────── */
.${SCHED_CSS_PREFIX}__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: #888;
  font-size: 14px;
}

/* ───────── Schedule List ───────── */
.${SCHED_CSS_PREFIX}__list {
  flex: 1;
  padding-bottom: 60px;
}

/* ───────── Fieldset (outer wrapper) ───────── */
.${SCHED_CSS_PREFIX}__fieldset {
  border: none;
  border-radius: 5px;
  display: flex;
  align-items: center;
  flex-direction: row;
  flex-wrap: wrap;
  margin: 10px;
  width: auto;
  padding-left: 10px;
  font-size: 14px;
  background-color: #0f0f17;
  padding-bottom: 5px;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__fieldset {
  background-color: #f5f5f5;
}

/* ───────── Inner fieldset (schedule card) ───────── */
.${SCHED_CSS_PREFIX}__card {
  background-color: #1F2126;
  border: none;
  border-radius: 5px;
  display: flex;
  align-items: center;
  flex-direction: row;
  flex-wrap: wrap;
  margin: 10px;
  width: auto;
  padding-left: 10px;
  font-size: 14px;
  padding-bottom: 5px;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__card {
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
}

/* ───────── Card Legend/Title ───────── */
.${SCHED_CSS_PREFIX}__card-title {
  font-size: 16px;
  padding: 4px 0;
}

/* ───────── Form Control ───────── */
.${SCHED_CSS_PREFIX}__form-control {
  width: 100%;
  border: none;
  border-radius: 5px;
  display: flex;
  align-items: center;
  flex-direction: row;
  flex-wrap: wrap;
  margin: 10px;
  padding-left: 10px;
  font-size: 14px;
  background-color: #0f0f17;
  padding-bottom: 5px;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__form-control {
  background-color: #f0f0f0;
}

.${SCHED_CSS_PREFIX}__form-control legend {
  font-size: 12px;
  color: #aaa;
  padding: 0 4px;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__form-control legend {
  color: #666;
}

/* ───────── Days Grid ───────── */
.${SCHED_CSS_PREFIX}__days-grid {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  margin: 10px;
  flex: 1 1 5px;
}

.${SCHED_CSS_PREFIX}__day-item {
  width: 100px;
  height: 20px;
  display: flex;
  align-items: center;
  margin: 10px;
  margin-right: 10px;
  font-size: 16px;
}

/* ───────── Checkbox Styling ───────── */
.${SCHED_CSS_PREFIX}__checkbox {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-color: #191B1F;
  margin: 0;
  margin-right: 7px;
  font: inherit;
  color: #191B1F;
  width: 1.2em;
  height: 1.2em;
  font-size: 16px;
  border: 1px solid rgba(192, 192, 192, 0.5);
  border-radius: 0.15em;
  transform: translateY(-0.075em);
  display: grid;
  place-content: center;
  cursor: pointer;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__checkbox {
  background-color: #fff;
  border-color: #ccc;
}

.${SCHED_CSS_PREFIX}__checkbox:hover {
  background-color: rgba(192, 192, 192, 0.5);
}

.${SCHED_CSS_PREFIX}__checkbox::before {
  content: "";
  width: 0.65em;
  height: 0.65em;
  transform: scale(0);
  transition: 120ms transform ease-in-out;
  box-shadow: inset 1em 1em white;
  transform-origin: bottom left;
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__checkbox::before {
  box-shadow: inset 1em 1em white;
}

.${SCHED_CSS_PREFIX}__checkbox:checked {
  background-color: #0FC080;
}

.${SCHED_CSS_PREFIX}__checkbox:checked::before {
  transform: scale(1);
}

.${SCHED_CSS_PREFIX}__checkbox:disabled {
  background-color: grey;
  cursor: not-allowed;
}

/* ───────── Time Input ───────── */
.${SCHED_CSS_PREFIX}__time-input {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: 100%;
  padding: 10px;
  font-size: 16px;
  color: white;
  border: none;
  border-radius: 0;
  background-color: inherit;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__time-input {
  color: #333;
}

.${SCHED_CSS_PREFIX}__time-input::-webkit-inner-spin-button,
.${SCHED_CSS_PREFIX}__time-input::-webkit-calendar-picker-indicator,
.${SCHED_CSS_PREFIX}__time-input::-webkit-datetime-edit-ampm-field {
  display: none;
}

.${SCHED_CSS_PREFIX}__time-input:focus {
  outline: none;
  box-shadow: none;
}

/* ───────── Number Input ───────── */
.${SCHED_CSS_PREFIX}__number-input {
  background-color: #333;
  color: #eee;
  border: 1px solid #555;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 16px;
  width: 100%;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__number-input {
  background-color: #fff;
  color: #333;
  border-color: #ccc;
}

.${SCHED_CSS_PREFIX}__number-input:focus {
  outline: none;
  border-color: #777;
  box-shadow: 0 0 3px rgba(150, 150, 150, 0.5);
}

/* ───────── Date Input ───────── */
.${SCHED_CSS_PREFIX}__date-input {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: 100%;
  padding: 10px;
  font-size: 16px;
  color: white;
  border: none;
  border-radius: 0;
  background-color: inherit;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__date-input {
  color: #333;
}

.${SCHED_CSS_PREFIX}__date-input::-webkit-inner-spin-button,
.${SCHED_CSS_PREFIX}__date-input::-webkit-calendar-picker-indicator {
  filter: brightness(0) saturate(100%) invert(100%) sepia(0%) saturate(3091%) hue-rotate(222deg) brightness(110%) contrast(101%);
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__date-input::-webkit-calendar-picker-indicator {
  filter: none;
}

.${SCHED_CSS_PREFIX}__date-input:focus {
  outline: none;
  box-shadow: none;
}

/* ───────── Select (Dropdown) ───────── */
.${SCHED_CSS_PREFIX}__select {
  width: 100%;
  padding: 10px;
  font-size: 16px;
  color: white;
  background-color: #1F2126;
  border: 1px solid rgba(192, 192, 192, 0.5);
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__select {
  color: #333;
  background-color: #fff;
  border-color: #ccc;
}

.${SCHED_CSS_PREFIX}__select:hover {
  border-color: #0FC080;
}

.${SCHED_CSS_PREFIX}__select:focus {
  outline: none;
  border-color: #0FC080;
  box-shadow: 0 0 0 2px rgba(15, 192, 128, 0.2);
}

.${SCHED_CSS_PREFIX}__select option {
  background-color: #1F2126;
  color: white;
  padding: 10px;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__select option {
  background-color: #fff;
  color: #333;
}

.${SCHED_CSS_PREFIX}__select:disabled {
  background-color: #2F3136;
  cursor: not-allowed;
  opacity: 0.7;
}

/* ───────── Buttons ───────── */
.${SCHED_CSS_PREFIX}__btn {
  background-color: #673AB5;
  color: white;
  padding: 10px;
  border-radius: 5px;
  margin: 5px;
  font-size: 16px;
  border: none;
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.1s ease;
}

.${SCHED_CSS_PREFIX}__btn:hover {
  box-shadow: 5px 5px 5px 0px rgba(0,0,0,0.3), 0 10px 20px 0 rgba(0,0,0,0.2);
}

.${SCHED_CSS_PREFIX}__btn:active {
  box-shadow: 2px 2px 2px 0px rgba(0,0,0,0.3), 0 5px 10px 0 rgba(0,0,0,0.2);
  transform: translateY(2px);
}

.${SCHED_CSS_PREFIX}__btn--remove {
  background-color: #673AB5;
}

.${SCHED_CSS_PREFIX}__btn--add {
  background-color: #673AB5;
}

/* ───────── Button Bar (fixed bottom) ───────── */
.${SCHED_CSS_PREFIX}__btn-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  width: 100%;
  height: fit-content;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 8px;
  box-sizing: border-box;
  z-index: 10;
}

/* ───────── Retain Checkbox Row ───────── */
.${SCHED_CSS_PREFIX}__retain-row {
  width: 100%;
  display: flex;
  align-items: center;
  margin: 10px;
  margin-right: 10px;
  padding-left: 10px;
  font-size: 16px;
}

/* ───────── Toggle Switch ───────── */
.${SCHED_CSS_PREFIX}__toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
  cursor: pointer;
}

.${SCHED_CSS_PREFIX}__toggle input[type="checkbox"] {
  display: none;
}

.${SCHED_CSS_PREFIX}__toggle-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #ddd;
  border-radius: 20px;
  box-shadow: inset 0 0 0 2px #ccc;
  transition: background-color 0.3s ease-in-out;
}

.${SCHED_CSS_PREFIX}__toggle-handle {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background-color: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 2px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease-in-out;
}

.${SCHED_CSS_PREFIX}__toggle input[type="checkbox"]:checked + .${SCHED_CSS_PREFIX}__toggle-bg {
  background-color: #0FC080;
  box-shadow: inset 0 0 0 2px #04b360;
}

.${SCHED_CSS_PREFIX}__toggle input[type="checkbox"]:checked + .${SCHED_CSS_PREFIX}__toggle-bg .${SCHED_CSS_PREFIX}__toggle-handle {
  transform: translateX(20px);
}

.${SCHED_CSS_PREFIX}__toggle-label {
  margin: 0 10px;
  font-size: 14px;
}

/* ───────── Group Schedule Warning ───────── */
.${SCHED_CSS_PREFIX}__group-warning {
  font-size: 14px;
  padding: 8px;
  width: 100%;
}

.${SCHED_CSS_PREFIX}__group-warning-icon {
  color: red;
}

.${SCHED_CSS_PREFIX}__group-warning a {
  color: #673AB5;
  text-decoration: underline;
  cursor: pointer;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__group-warning a {
  color: #1976d2;
}

/* ───────── Error Messages ───────── */
.${SCHED_CSS_PREFIX}__error {
  color: #FF5252;
  font-size: 0.8em;
  display: block;
  padding: 2px 4px;
}

.${SCHED_CSS_PREFIX}__footer-error {
  width: 100%;
  padding: 10px;
  color: #FF5252;
  font-size: 14px;
  font-weight: bold;
  text-align: left;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background-color: #1a1a1a;
}

.${SCHED_CSS_PREFIX}--light .${SCHED_CSS_PREFIX}__footer-error {
  background-color: #fff3f3;
  border-top-color: #e0e0e0;
}

/* ───────── Modal Overlay ───────── */
.${SCHED_CSS_PREFIX}__modal-overlay {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: flex-start;
  padding-top: 20vh;
  justify-content: center;
  z-index: 2147483647;
}

.${SCHED_CSS_PREFIX}__modal-backdrop {
  position: fixed;
  z-index: 2147483646;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  top: 0;
  left: 0;
}

.${SCHED_CSS_PREFIX}__modal-content {
  position: relative;
  background: #ffffff;
  border-radius: 16px;
  padding: 24px 32px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  z-index: 2147483647;
  text-align: center;
  max-width: 360px;
  width: 100%;
  font-family: sans-serif;
  color: #222 !important;
}

.${SCHED_CSS_PREFIX}__modal-content h3 {
  margin: 0 0 12px;
  font-size: 1.5em;
  color: inherit;
}

.${SCHED_CSS_PREFIX}__modal-content p {
  font-size: 1.1em;
  margin-bottom: 24px;
  color: inherit;
}

.${SCHED_CSS_PREFIX}__modal-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.${SCHED_CSS_PREFIX}__modal-actions button {
  padding: 8px 16px;
  border: none;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
}

.${SCHED_CSS_PREFIX}__modal-btn-cancel {
  background: #e0e0e0;
  color: #333;
}

.${SCHED_CSS_PREFIX}__modal-btn-confirm {
  background: #1976d2;
  color: #fff;
  transition: background 0.2s ease;
}

.${SCHED_CSS_PREFIX}__modal-btn-confirm:hover {
  background: #1565c0;
}

.${SCHED_CSS_PREFIX}__modal-btn-close {
  background: #1976d2;
  color: #fff;
  transition: background 0.2s ease;
}

.${SCHED_CSS_PREFIX}__modal-btn-close:hover {
  background: #1565c0;
}

/* ───────── Select Wrapper ───────── */
.${SCHED_CSS_PREFIX}__select-wrap {
  width: 100%;
  padding: 10px;
}
`;

let _stylesInjected = false;

export function injectSchedulingSharedStyles(): void {
  if (_stylesInjected) return;
  const existing = document.getElementById('myio-sched-shared-styles');
  if (existing) {
    _stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'myio-sched-shared-styles';
  style.textContent = SCHEDULING_SHARED_STYLES;
  document.head.appendChild(style);
  _stylesInjected = true;
}

export function removeSchedulingSharedStyles(): void {
  const el = document.getElementById('myio-sched-shared-styles');
  if (el) el.remove();
  _stylesInjected = false;
}
