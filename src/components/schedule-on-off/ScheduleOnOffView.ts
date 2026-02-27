/**
 * Schedule On/Off View
 * Migrated from agendamento-individual-on-off-v1.0.0
 */

import type {
  ScheduleOnOffSettings,
  ScheduleOnOffState,
  OnOffScheduleEntry,
  OnOffGroupScheduleEntry,
} from './types';
import { DEFAULT_ON_OFF_SETTINGS, DEFAULT_ON_OFF_STATE, DEFAULT_ON_OFF_SCHEDULE } from './types';
import { injectScheduleOnOffStyles } from './styles';
import {
  SCHED_CSS_PREFIX,
  injectSchedulingSharedStyles,
  createDaysGrid,
  createTimeInput,
  createScheduleCard,
  createGroupScheduleCard,
  createButtonBar,
  DEFAULT_DAYS_WEEK,
} from '../scheduling-shared';

export interface ScheduleOnOffViewOptions {
  container: HTMLElement;
  settings?: ScheduleOnOffSettings;
  initialState?: Partial<ScheduleOnOffState>;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onSave?: () => void;
  onGroupClick?: (entry: OnOffGroupScheduleEntry, event: Event) => void;
  onChange?: () => void;
}

export class ScheduleOnOffView {
  private container: HTMLElement;
  private settings: Required<ScheduleOnOffSettings>;
  private state: ScheduleOnOffState;
  private root: HTMLElement;

  private onAdd?: () => void;
  private onRemove?: (index: number) => void;
  private onSaveClick?: () => void;
  private onGroupClick?: (entry: OnOffGroupScheduleEntry, event: Event) => void;
  private onChange?: () => void;

  constructor(options: ScheduleOnOffViewOptions) {
    this.container = options.container;
    this.settings = { ...DEFAULT_ON_OFF_SETTINGS, ...options.settings };
    this.state = { ...DEFAULT_ON_OFF_STATE, ...options.initialState };

    this.onAdd = options.onAdd;
    this.onRemove = options.onRemove;
    this.onSaveClick = options.onSave;
    this.onGroupClick = options.onGroupClick;
    this.onChange = options.onChange;

    injectSchedulingSharedStyles();
    injectScheduleOnOffStyles();

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

  public updateState(newState: Partial<ScheduleOnOffState>): void {
    Object.assign(this.state, newState);
    this.render();
  }

  public getState(): ScheduleOnOffState {
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
        'onoff',
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
        'onoff-group',
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
    schedule: OnOffScheduleEntry,
    index: number,
    disabled: boolean,
  ): HTMLElement {
    const frag = document.createElement('div');

    // Start time
    const startInput = createTimeInput(
      'onoff',
      `start-${index}`,
      'Início',
      schedule.startHour,
      disabled,
      (val) => {
        schedule.startHour = val;
        this.onChange?.();
      },
    );
    frag.appendChild(startInput);

    // End time
    const endInput = createTimeInput(
      'onoff',
      `end-${index}`,
      'Término',
      schedule.endHour,
      disabled,
      (val) => {
        schedule.endHour = val;
        this.onChange?.();
      },
    );
    frag.appendChild(endInput);

    // Action selector (Ligar/Desligar, Aberta/Fechada, etc.)
    const labelOn  = this.settings.labelOn  || 'Ligar';
    const labelOff = this.settings.labelOff || 'Desligar';
    const currentAction = schedule.action ?? 'on';

    const actionRow = document.createElement('div');
    actionRow.className = `${SCHED_CSS_PREFIX}__action-row`;

    const actionLabel = document.createElement('span');
    actionLabel.className = `${SCHED_CSS_PREFIX}__action-label`;
    actionLabel.textContent = 'Ação:';
    actionRow.appendChild(actionLabel);

    const actionBtns = document.createElement('div');
    actionBtns.className = `${SCHED_CSS_PREFIX}__action-btns`;

    (['on', 'off'] as const).forEach((value) => {
      const text = value === 'on' ? labelOn : labelOff;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `${SCHED_CSS_PREFIX}__action-btn` +
        (currentAction === value ? ` ${SCHED_CSS_PREFIX}__action-btn--active` : '');
      btn.textContent = text;
      btn.disabled = disabled;
      if (!disabled) {
        btn.addEventListener('click', () => {
          schedule.action = value;
          actionBtns.querySelectorAll(`.${SCHED_CSS_PREFIX}__action-btn`).forEach(b => {
            b.classList.toggle(`${SCHED_CSS_PREFIX}__action-btn--active`, b === btn);
          });
          this.onChange?.();
        });
      }
      actionBtns.appendChild(btn);
    });

    actionRow.appendChild(actionBtns);
    frag.appendChild(actionRow);

    // Retain checkbox
    const retainRow = document.createElement('div');
    retainRow.className = `${SCHED_CSS_PREFIX}__retain-row`;

    const retainCb = document.createElement('input');
    retainCb.type = 'checkbox';
    retainCb.className = `${SCHED_CSS_PREFIX}__checkbox`;
    retainCb.checked = schedule.retain;
    retainCb.disabled = disabled;
    retainCb.id = `onoff-retain-${index}`;
    retainCb.addEventListener('change', () => {
      schedule.retain = retainCb.checked;
      this.onChange?.();
    });

    const retainLabel = document.createElement('label');
    retainLabel.htmlFor = retainCb.id;
    retainLabel.textContent = 'Retentivo';

    retainRow.appendChild(retainCb);
    retainRow.appendChild(retainLabel);
    frag.appendChild(retainRow);

    // Days grid
    const daysGrid = createDaysGrid('onoff', index, schedule, disabled, () => {
      this.onChange?.();
    });
    frag.appendChild(daysGrid);

    return frag;
  }
}
