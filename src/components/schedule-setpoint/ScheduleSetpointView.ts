/**
 * Schedule Setpoint View
 * Migrated from agendamento-setpoint-temperatura-fancoil-v1.0.0
 */

import type {
  ScheduleSetpointSettings,
  ScheduleSetpointState,
  SetpointScheduleEntry,
} from './types';
import { DEFAULT_SETPOINT_SETTINGS, DEFAULT_SETPOINT_STATE } from './types';
import { injectScheduleSetpointStyles, SCHEDULE_SETPOINT_CSS_PREFIX } from './styles';
import {
  SCHED_CSS_PREFIX,
  injectSchedulingSharedStyles,
  createDaysGrid,
  createTimeInput,
  createNumberInput,
  createButtonBar,
  createErrorSpan,
} from '../scheduling-shared';

export interface ScheduleSetpointViewOptions {
  container: HTMLElement;
  settings?: ScheduleSetpointSettings;
  initialState?: Partial<ScheduleSetpointState>;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onSave?: () => void;
  onChange?: () => void;
}

export class ScheduleSetpointView {
  private container: HTMLElement;
  private settings: Required<ScheduleSetpointSettings>;
  private state: ScheduleSetpointState;
  private root: HTMLElement;

  private onAdd?: () => void;
  private onRemove?: (index: number) => void;
  private onSaveClick?: () => void;
  private onChange?: () => void;

  constructor(options: ScheduleSetpointViewOptions) {
    this.container = options.container;
    this.settings = { ...DEFAULT_SETPOINT_SETTINGS, ...options.settings };
    this.state = { ...DEFAULT_SETPOINT_STATE, ...options.initialState };

    this.onAdd = options.onAdd;
    this.onRemove = options.onRemove;
    this.onSaveClick = options.onSave;
    this.onChange = options.onChange;

    injectSchedulingSharedStyles();
    injectScheduleSetpointStyles();

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

  public updateState(newState: Partial<ScheduleSetpointState>): void {
    Object.assign(this.state, newState);
    this.render();
  }

  public getState(): ScheduleSetpointState {
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

    // Individual schedules
    this.state.schedules.forEach((schedule, index) => {
      const content = this.buildScheduleContent(schedule, index);
      const card = document.createElement('fieldset');
      card.className = `${SCHED_CSS_PREFIX}__card`;
      if (schedule.errors?.overlap) {
        card.classList.add(`${SCHEDULE_SETPOINT_CSS_PREFIX}__overlap-card`);
      }

      const legend = document.createElement('legend');
      legend.className = `${SCHED_CSS_PREFIX}__card-title`;
      legend.textContent = this.state.entityName;
      card.appendChild(legend);

      card.appendChild(content);

      // Overlap error
      if (schedule.errors?.overlap) {
        const overlapErr = document.createElement('span');
        overlapErr.className = `${SCHEDULE_SETPOINT_CSS_PREFIX}__overlap-error`;
        overlapErr.textContent = schedule.errors.overlap;
        card.appendChild(overlapErr);
      }

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = `${SCHED_CSS_PREFIX}__btn ${SCHED_CSS_PREFIX}__btn--remove`;
      removeBtn.textContent = 'Remover';
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', () => this.onRemove?.(index));
      card.appendChild(removeBtn);

      list.appendChild(card);
    });

    if (this.state.schedules.length === 0) {
      const empty = document.createElement('div');
      empty.className = `${SCHED_CSS_PREFIX}__empty`;
      empty.textContent = 'Nenhum agendamento configurado.';
      list.appendChild(empty);
    }

    this.root.appendChild(list);

    // Footer error
    if (this.state.footerError) {
      const footerErr = document.createElement('div');
      footerErr.className = `${SCHED_CSS_PREFIX}__footer-error`;
      footerErr.textContent = this.state.footerError;
      this.root.appendChild(footerErr);
    }

    // Button bar
    const bar = createButtonBar(
      '+ Intervalo',
      'Salvar',
      () => this.onAdd?.(),
      () => this.onSaveClick?.(),
    );
    this.root.appendChild(bar);
  }

  private buildScheduleContent(
    schedule: SetpointScheduleEntry,
    index: number,
  ): HTMLElement {
    const frag = document.createElement('div');

    // Start time
    const startInput = createTimeInput(
      'setpoint',
      `start-${index}`,
      'Início',
      schedule.startTime,
      false,
      (val) => {
        schedule.startTime = val;
        this.onChange?.();
      },
    );
    frag.appendChild(startInput);
    if (schedule.errors?.startTime) {
      frag.appendChild(createErrorSpan(schedule.errors.startTime));
    }

    // End time
    const endInput = createTimeInput(
      'setpoint',
      `end-${index}`,
      'Término',
      schedule.endTime,
      false,
      (val) => {
        schedule.endTime = val;
        this.onChange?.();
      },
    );
    frag.appendChild(endInput);
    if (schedule.errors?.endTime) {
      frag.appendChild(createErrorSpan(schedule.errors.endTime));
    }

    // Days grid
    const daysGrid = createDaysGrid('setpoint', index, schedule, false, () => {
      this.onChange?.();
    });
    frag.appendChild(daysGrid);
    if (schedule.errors?.daysWeek) {
      frag.appendChild(createErrorSpan(schedule.errors.daysWeek));
    }

    // Setpoint
    const setpointInput = createNumberInput(
      'setpoint',
      `setpoint-${index}`,
      'Setpoint (°C):',
      schedule.setpoint,
      this.settings.minSetpoint,
      this.settings.maxSetpoint,
      false,
      (val) => {
        schedule.setpoint = val;
        this.onChange?.();
      },
    );
    frag.appendChild(setpointInput);
    if (schedule.errors?.setpoint) {
      frag.appendChild(createErrorSpan(schedule.errors.setpoint));
    }

    return frag;
  }
}
