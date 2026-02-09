/**
 * Scheduling Shared View Helpers
 * Reusable DOM builders for scheduling components.
 */

import type { DaysWeek, ScheduleEntryBase } from './types';
import { DAY_LABELS_FULL } from './types';
import { SCHED_CSS_PREFIX } from './styles';

/** Escape HTML to prevent XSS */
export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Creates a 7-day + holiday checkbox grid.
 */
export function createDaysGrid(
  prefix: string,
  index: number,
  entry: ScheduleEntryBase,
  disabled: boolean,
  onChange: () => void,
): HTMLElement {
  const wrapper = document.createElement('fieldset');
  wrapper.className = `${SCHED_CSS_PREFIX}__form-control`;

  const legend = document.createElement('legend');
  legend.textContent = 'Dias:';
  wrapper.appendChild(legend);

  const grid = document.createElement('div');
  grid.className = `${SCHED_CSS_PREFIX}__days-grid`;

  const days: (keyof DaysWeek)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  days.forEach((day) => {
    const item = document.createElement('div');
    item.className = `${SCHED_CSS_PREFIX}__day-item`;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = `${SCHED_CSS_PREFIX}__checkbox`;
    cb.checked = entry.daysWeek[day];
    cb.disabled = disabled;
    cb.id = `${prefix}-${index}-${day}`;
    cb.addEventListener('change', () => {
      entry.daysWeek[day] = cb.checked;
      onChange();
    });

    const label = document.createElement('label');
    label.htmlFor = cb.id;
    label.textContent = DAY_LABELS_FULL[day];

    item.appendChild(cb);
    item.appendChild(label);
    grid.appendChild(item);
  });

  // Holiday checkbox
  const holidayItem = document.createElement('div');
  holidayItem.className = `${SCHED_CSS_PREFIX}__day-item`;

  const holidayCb = document.createElement('input');
  holidayCb.type = 'checkbox';
  holidayCb.className = `${SCHED_CSS_PREFIX}__checkbox`;
  holidayCb.checked = entry.holiday;
  holidayCb.disabled = disabled;
  holidayCb.id = `${prefix}-${index}-holiday`;
  holidayCb.addEventListener('change', () => {
    entry.holiday = holidayCb.checked;
    onChange();
  });

  const holidayLabel = document.createElement('label');
  holidayLabel.htmlFor = holidayCb.id;
  holidayLabel.textContent = 'Feriado';

  holidayItem.appendChild(holidayCb);
  holidayItem.appendChild(holidayLabel);
  grid.appendChild(holidayItem);

  wrapper.appendChild(grid);
  return wrapper;
}

/**
 * Creates a time input field wrapped in a fieldset.
 */
export function createTimeInput(
  prefix: string,
  id: string,
  labelText: string,
  value: string,
  disabled: boolean,
  onChange: (val: string) => void,
): HTMLElement {
  const wrapper = document.createElement('fieldset');
  wrapper.className = `${SCHED_CSS_PREFIX}__form-control`;

  const legend = document.createElement('legend');
  legend.textContent = labelText;
  wrapper.appendChild(legend);

  const input = document.createElement('input');
  input.type = 'time';
  input.className = `${SCHED_CSS_PREFIX}__time-input`;
  input.value = value;
  input.disabled = disabled;
  input.id = `${prefix}-${id}`;
  input.addEventListener('change', () => {
    onChange(input.value);
  });

  wrapper.appendChild(input);
  return wrapper;
}

/**
 * Creates a number input field wrapped in a fieldset.
 */
export function createNumberInput(
  prefix: string,
  id: string,
  labelText: string,
  value: number,
  min: number,
  max: number,
  disabled: boolean,
  onChange: (val: number) => void,
): HTMLElement {
  const wrapper = document.createElement('fieldset');
  wrapper.className = `${SCHED_CSS_PREFIX}__form-control`;

  const legend = document.createElement('legend');
  legend.textContent = labelText;
  wrapper.appendChild(legend);

  const input = document.createElement('input');
  input.type = 'number';
  input.className = `${SCHED_CSS_PREFIX}__number-input`;
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.step = '1';
  input.disabled = disabled;
  input.id = `${prefix}-${id}`;
  input.addEventListener('change', () => {
    onChange(Number(input.value));
  });

  wrapper.appendChild(input);
  return wrapper;
}

/**
 * Creates a date input field wrapped in a fieldset.
 */
export function createDateInput(
  prefix: string,
  id: string,
  labelText: string,
  value: string,
  disabled: boolean,
  onChange: (val: string) => void,
): HTMLElement {
  const wrapper = document.createElement('fieldset');
  wrapper.className = `${SCHED_CSS_PREFIX}__form-control`;

  const legend = document.createElement('legend');
  legend.textContent = labelText;
  wrapper.appendChild(legend);

  const input = document.createElement('input');
  input.type = 'date';
  input.className = `${SCHED_CSS_PREFIX}__date-input`;
  input.value = value;
  input.disabled = disabled;
  input.id = `${prefix}-${id}`;
  input.addEventListener('change', () => {
    onChange(input.value);
  });

  wrapper.appendChild(input);
  return wrapper;
}

/**
 * Creates a schedule card wrapper with optional remove button.
 */
export function createScheduleCard(
  prefix: string,
  index: number,
  title: string,
  content: HTMLElement,
  onRemove?: () => void,
): HTMLElement {
  const card = document.createElement('fieldset');
  card.className = `${SCHED_CSS_PREFIX}__card`;

  const legend = document.createElement('legend');
  legend.className = `${SCHED_CSS_PREFIX}__card-title`;
  legend.textContent = title;
  card.appendChild(legend);

  card.appendChild(content);

  if (onRemove) {
    const removeBtn = document.createElement('button');
    removeBtn.className = `${SCHED_CSS_PREFIX}__btn ${SCHED_CSS_PREFIX}__btn--remove`;
    removeBtn.textContent = 'Remover';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', onRemove);
    card.appendChild(removeBtn);
  }

  return card;
}

/**
 * Creates a read-only group schedule card with warning message.
 */
export function createGroupScheduleCard(
  prefix: string,
  index: number,
  title: string,
  content: HTMLElement,
  onGroupClick?: (e: Event) => void,
): HTMLElement {
  const card = document.createElement('fieldset');
  card.className = `${SCHED_CSS_PREFIX}__card`;

  const legend = document.createElement('legend');
  legend.className = `${SCHED_CSS_PREFIX}__card-title`;
  legend.textContent = title;
  card.appendChild(legend);

  card.appendChild(content);

  const warning = document.createElement('p');
  warning.className = `${SCHED_CSS_PREFIX}__group-warning`;
  warning.innerHTML = `<span class="${SCHED_CSS_PREFIX}__group-warning-icon">Atenção:</span> Esse agendamento foi configurado a partir de um <b>grupo de dispositivos</b>`;

  if (onGroupClick) {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = ', clique aqui para alterar';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      onGroupClick(e);
    });
    warning.appendChild(link);
  }

  card.appendChild(warning);
  return card;
}

/**
 * Shows a confirm modal and returns a promise that resolves with the user's choice.
 */
export function showConfirmModal(
  container: HTMLElement,
  title: string,
  message: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = `${SCHED_CSS_PREFIX}__modal-overlay`;

    overlay.innerHTML = `
      <div class="${SCHED_CSS_PREFIX}__modal-backdrop"></div>
      <div class="${SCHED_CSS_PREFIX}__modal-content">
        <h3>${escapeHtml(title)}</h3>
        <p>${message}</p>
        <div class="${SCHED_CSS_PREFIX}__modal-actions">
          <button class="${SCHED_CSS_PREFIX}__modal-btn-cancel">Cancelar</button>
          <button class="${SCHED_CSS_PREFIX}__modal-btn-confirm">Confirmar</button>
        </div>
      </div>
    `;

    const target = container || document.body;
    target.appendChild(overlay);

    const cancel = overlay.querySelector(`.${SCHED_CSS_PREFIX}__modal-btn-cancel`)!;
    const confirm = overlay.querySelector(`.${SCHED_CSS_PREFIX}__modal-btn-confirm`)!;

    cancel.addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });

    confirm.addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });
  });
}

/**
 * Shows a notification modal (auto-closes after timeout).
 */
export function showNotificationModal(
  container: HTMLElement,
  type: 'success' | 'warning' | 'error',
  message: string,
  autoCloseMs = 6000,
): void {
  const icons: Record<string, string> = {
    success: 'Sucesso',
    warning: 'Atenção',
    error: 'Erro',
  };

  const title = icons[type] || 'Info';

  const overlay = document.createElement('div');
  overlay.className = `${SCHED_CSS_PREFIX}__modal-overlay`;

  overlay.innerHTML = `
    <div class="${SCHED_CSS_PREFIX}__modal-backdrop"></div>
    <div class="${SCHED_CSS_PREFIX}__modal-content">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="${SCHED_CSS_PREFIX}__modal-actions">
        <button class="${SCHED_CSS_PREFIX}__modal-btn-close">Fechar</button>
      </div>
    </div>
  `;

  const target = container || document.body;
  target.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector(`.${SCHED_CSS_PREFIX}__modal-btn-close`)!.addEventListener('click', close);

  if (autoCloseMs > 0) {
    setTimeout(close, autoCloseMs);
  }
}

/**
 * Creates an error message span element.
 */
export function createErrorSpan(message: string): HTMLElement {
  const span = document.createElement('span');
  span.className = `${SCHED_CSS_PREFIX}__error`;
  span.textContent = message;
  return span;
}

/**
 * Creates a toggle switch (on/off).
 */
export function createToggleSwitch(
  prefix: string,
  id: string,
  checked: boolean,
  disabled: boolean,
  labelOff: string,
  labelOn: string,
  onChange: (val: boolean) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = `${SCHED_CSS_PREFIX}__retain-row`;

  const offLabel = document.createElement('span');
  offLabel.className = `${SCHED_CSS_PREFIX}__toggle-label`;
  offLabel.textContent = labelOff;
  row.appendChild(offLabel);

  const toggle = document.createElement('label');
  toggle.className = `${SCHED_CSS_PREFIX}__toggle`;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.disabled = disabled;
  input.id = `${prefix}-${id}`;
  input.addEventListener('change', () => {
    onChange(input.checked);
  });

  const bg = document.createElement('div');
  bg.className = `${SCHED_CSS_PREFIX}__toggle-bg`;

  const handle = document.createElement('div');
  handle.className = `${SCHED_CSS_PREFIX}__toggle-handle`;
  bg.appendChild(handle);

  toggle.appendChild(input);
  toggle.appendChild(bg);
  row.appendChild(toggle);

  const onLabel = document.createElement('span');
  onLabel.className = `${SCHED_CSS_PREFIX}__toggle-label`;
  onLabel.textContent = labelOn;
  row.appendChild(onLabel);

  return row;
}

/**
 * Creates the fixed bottom button bar.
 */
export function createButtonBar(
  addLabel: string,
  saveLabel: string,
  onAdd: () => void,
  onSave: () => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = `${SCHED_CSS_PREFIX}__btn-bar`;

  const addBtn = document.createElement('button');
  addBtn.className = `${SCHED_CSS_PREFIX}__btn ${SCHED_CSS_PREFIX}__btn--add`;
  addBtn.textContent = addLabel;
  addBtn.type = 'button';
  addBtn.addEventListener('click', onAdd);

  const saveBtn = document.createElement('button');
  saveBtn.className = `${SCHED_CSS_PREFIX}__btn`;
  saveBtn.textContent = saveLabel;
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', onSave);

  bar.appendChild(addBtn);
  bar.appendChild(saveBtn);
  return bar;
}

/**
 * Creates a select dropdown.
 */
export function createSelect(
  prefix: string,
  id: string,
  labelText: string,
  options: Array<{ value: string; label: string }>,
  selectedValue: string | null,
  disabled: boolean,
  onChange: (val: string | null) => void,
): HTMLElement {
  const wrapper = document.createElement('fieldset');
  wrapper.className = `${SCHED_CSS_PREFIX}__form-control`;

  const legend = document.createElement('legend');
  legend.textContent = labelText;
  wrapper.appendChild(legend);

  const selectWrap = document.createElement('div');
  selectWrap.className = `${SCHED_CSS_PREFIX}__select-wrap`;

  const select = document.createElement('select');
  select.className = `${SCHED_CSS_PREFIX}__select`;
  select.disabled = disabled;
  select.id = `${prefix}-${id}`;

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Selecione um comando';
  select.appendChild(defaultOpt);

  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (selectedValue === opt.value) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    onChange(select.value || null);
  });

  selectWrap.appendChild(select);
  wrapper.appendChild(selectWrap);
  return wrapper;
}
