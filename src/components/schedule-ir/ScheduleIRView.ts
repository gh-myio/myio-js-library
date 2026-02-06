/**
 * Schedule IR View
 * Migrated from agendamento-ir
 */

import type {
  ScheduleIRSettings,
  ScheduleIRState,
  IRScheduleEntry,
  IRGroupScheduleEntry,
} from './types';
import { DEFAULT_IR_SETTINGS, DEFAULT_IR_STATE } from './types';
import { injectScheduleIRStyles } from './styles';
import {
  SCHED_CSS_PREFIX,
  injectSchedulingSharedStyles,
  createDaysGrid,
  createTimeInput,
  createScheduleCard,
  createGroupScheduleCard,
  createButtonBar,
  createSelect,
  createToggleSwitch,
} from '../scheduling-shared';

export interface ScheduleIRViewOptions {
  container: HTMLElement;
  settings?: ScheduleIRSettings;
  initialState?: Partial<ScheduleIRState>;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onSave?: () => void;
  onGroupClick?: (entry: IRGroupScheduleEntry, event: Event) => void;
  onChange?: () => void;
}

export class ScheduleIRView {
  private container: HTMLElement;
  private settings: Required<ScheduleIRSettings>;
  private state: ScheduleIRState;
  private root: HTMLElement;

  private onAdd?: () => void;
  private onRemove?: (index: number) => void;
  private onSaveClick?: () => void;
  private onGroupClick?: (entry: IRGroupScheduleEntry, event: Event) => void;
  private onChange?: () => void;

  constructor(options: ScheduleIRViewOptions) {
    this.container = options.container;
    this.settings = { ...DEFAULT_IR_SETTINGS, ...options.settings };
    this.state = { ...DEFAULT_IR_STATE, ...options.initialState };

    this.onAdd = options.onAdd;
    this.onRemove = options.onRemove;
    this.onSaveClick = options.onSave;
    this.onGroupClick = options.onGroupClick;
    this.onChange = options.onChange;

    injectSchedulingSharedStyles();
    injectScheduleIRStyles();

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

  public updateState(newState: Partial<ScheduleIRState>): void {
    Object.assign(this.state, newState);
    this.render();
  }

  public getState(): ScheduleIRState {
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
      const content = this.buildScheduleContent(schedule, index, false);
      const card = createScheduleCard(
        'ir',
        index,
        this.state.entityName,
        content,
        () => this.onRemove?.(index),
      );
      list.appendChild(card);
    });

    // Group schedules (read-only)
    this.state.groupSchedules.forEach((schedule, index) => {
      const content = this.buildScheduleContent(schedule, this.state.schedules.length + index, true);
      const card = createGroupScheduleCard(
        'ir-group',
        index,
        this.state.entityName,
        content,
        this.onGroupClick ? (e) => this.onGroupClick!(schedule, e) : undefined,
      );
      list.appendChild(card);
    });

    if (this.state.schedules.length === 0 && this.state.groupSchedules.length === 0) {
      const empty = document.createElement('div');
      empty.className = `${SCHED_CSS_PREFIX}__empty`;
      empty.textContent = 'Nenhum agendamento configurado.';
      list.appendChild(empty);
    }

    this.root.appendChild(list);

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
    schedule: IRScheduleEntry,
    index: number,
    disabled: boolean,
  ): HTMLElement {
    const frag = document.createElement('div');

    // Time input (single)
    const timeInput = createTimeInput(
      'ir',
      `time-${index}`,
      'Horário',
      schedule.time,
      disabled,
      (val) => {
        schedule.time = val;
        this.onChange?.();
      },
    );
    frag.appendChild(timeInput);

    // Command dropdown
    const commandOptions = (this.state.availableCommands || []).map((cmd) => ({
      value: cmd.command_id,
      label: `${cmd.temperature}°C`,
    }));

    const selectEl = createSelect(
      'ir',
      `cmd-${index}`,
      'Comando',
      commandOptions,
      schedule.temperature,
      disabled,
      (val) => {
        schedule.temperature = val;
        this.onChange?.();
      },
    );
    frag.appendChild(selectEl);

    // Action toggle (on/off)
    const toggle = createToggleSwitch(
      'ir',
      `action-${index}`,
      schedule.action,
      disabled,
      'Desligar',
      'Ligar',
      (val) => {
        schedule.action = val;
        this.onChange?.();
      },
    );
    frag.appendChild(toggle);

    // Days grid
    const daysGrid = createDaysGrid('ir', index, schedule, disabled, () => {
      this.onChange?.();
    });
    frag.appendChild(daysGrid);

    return frag;
  }
}
