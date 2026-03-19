/**
 * Schedule Holiday View
 * Migrated from feriado-v6
 */

import type {
  ScheduleHolidaySettings,
  ScheduleHolidayState,
  HolidayEntry,
} from './types';
import { DEFAULT_HOLIDAY_SETTINGS, DEFAULT_HOLIDAY_STATE } from './types';
import { injectScheduleHolidayStyles } from './styles';
import {
  SCHED_CSS_PREFIX,
  injectSchedulingSharedStyles,
  createDateInput,
  createScheduleCard,
  createButtonBar,
} from '../scheduling-shared';

export interface ScheduleHolidayViewOptions {
  container: HTMLElement;
  settings?: ScheduleHolidaySettings;
  initialState?: Partial<ScheduleHolidayState>;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onSave?: () => void;
  onChange?: () => void;
}

export class ScheduleHolidayView {
  private container: HTMLElement;
  private settings: Required<ScheduleHolidaySettings>;
  private state: ScheduleHolidayState;
  private root: HTMLElement;

  private onAdd?: () => void;
  private onRemove?: (index: number) => void;
  private onSaveClick?: () => void;
  private onChange?: () => void;

  constructor(options: ScheduleHolidayViewOptions) {
    this.container = options.container;
    this.settings = { ...DEFAULT_HOLIDAY_SETTINGS, ...options.settings };
    this.state = { ...DEFAULT_HOLIDAY_STATE, ...options.initialState };

    this.onAdd = options.onAdd;
    this.onRemove = options.onRemove;
    this.onSaveClick = options.onSave;
    this.onChange = options.onChange;

    injectSchedulingSharedStyles();
    injectScheduleHolidayStyles();

    this.root = document.createElement('div');
    this.root.className = this.getRootClassName();

    this.render();
    this.container.appendChild(this.root);
  }

  private getRootClassName(): string {
    const classes = [SCHED_CSS_PREFIX];
    if (this.settings.themeMode === 'light') {
      classes.push(`${SCHED_CSS_PREFIX}--light`);
    }
    return classes.join(' ');
  }

  public updateState(newState: Partial<ScheduleHolidayState>): void {
    Object.assign(this.state, newState);
    this.render();
  }

  public getState(): ScheduleHolidayState {
    return { ...this.state };
  }

  public setThemeMode(mode: 'light' | 'dark'): void {
    this.settings.themeMode = mode;
    this.root.className = this.getRootClassName();
  }

  public getElement(): HTMLElement {
    return this.root;
  }

  public destroy(): void {
    this.root.remove();
  }

  private render(): void {
    this.root.innerHTML = '';

    if (this.state.loading) {
      const loadingDiv = document.createElement('div');
      loadingDiv.className = `${SCHED_CSS_PREFIX}__loading`;
      const spinner = document.createElement('div');
      spinner.className = `${SCHED_CSS_PREFIX}__spinner`;
      loadingDiv.appendChild(spinner);
      this.root.appendChild(loadingDiv);
      return;
    }

    const list = document.createElement('div');
    list.className = `${SCHED_CSS_PREFIX}__list`;

    // Holiday entries
    this.state.holidays.forEach((holiday, index) => {
      const content = this.buildHolidayContent(holiday, index);
      const card = createScheduleCard(
        'holiday',
        index,
        this.state.entityName || 'Feriado',
        content,
        () => this.onRemove?.(index),
      );
      list.appendChild(card);
    });

    if (this.state.holidays.length === 0) {
      const empty = document.createElement('div');
      empty.className = `${SCHED_CSS_PREFIX}__empty`;
      empty.textContent = 'Nenhum feriado configurado.';
      list.appendChild(empty);
    }

    this.root.appendChild(list);

    // Button bar
    const bar = createButtonBar(
      '+ Data',
      'Salvar',
      () => this.onAdd?.(),
      () => this.onSaveClick?.(),
    );
    this.root.appendChild(bar);
  }

  private buildHolidayContent(holiday: HolidayEntry, index: number): HTMLElement {
    const frag = document.createElement('div');

    const dateInput = createDateInput(
      'holiday',
      `date-${index}`,
      'Data',
      holiday.holidayDates || '',
      false,
      (val) => {
        holiday.holidayDates = val;
        this.onChange?.();
      },
    );
    frag.appendChild(dateInput);

    return frag;
  }
}
