/**
 * Schedule IR Controller
 * Migrated from agendamento-ir
 */

import type {
  ScheduleIRParams,
  ScheduleIRInstance,
  ScheduleIRSettings,
  ScheduleIRState,
  IRScheduleEntry,
  IRGroupScheduleEntry,
} from './types';
import { DEFAULT_IR_SETTINGS, DEFAULT_IR_STATE, DEFAULT_IR_SCHEDULE } from './types';
import { ScheduleIRView } from './ScheduleIRView';
import {
  showConfirmModal,
  showNotificationModal,
  DEFAULT_DAYS_WEEK,
  type SchedulingThemeMode,
} from '../scheduling-shared';

export class ScheduleIRController {
  private view: ScheduleIRView;
  private settings: Required<ScheduleIRSettings>;
  private state: ScheduleIRState;

  private onSave?: (schedules: IRScheduleEntry[]) => Promise<boolean>;
  private onConfirm?: (title: string, message: string) => Promise<boolean>;
  private onNotify?: (type: 'success' | 'warning' | 'error', message: string) => void;
  private onGroupScheduleClick?: (entry: IRGroupScheduleEntry, event: Event) => void;

  constructor(container: HTMLElement, params: ScheduleIRParams) {
    this.settings = { ...DEFAULT_IR_SETTINGS, ...params.settings };
    this.state = { ...DEFAULT_IR_STATE, ...params.initialState };

    this.onSave = params.onSave;
    this.onConfirm = params.onConfirm;
    this.onNotify = params.onNotify;
    this.onGroupScheduleClick = params.onGroupScheduleClick;

    this.view = new ScheduleIRView({
      container,
      settings: this.settings,
      initialState: this.state,
      onAdd: () => this.handleAdd(),
      onRemove: (index) => this.handleRemove(index),
      onSave: () => this.handleSave(),
      onGroupClick: this.onGroupScheduleClick,
      onChange: () => {},
    });
  }

  private handleAdd(): void {
    this.state.schedules.push({
      ...DEFAULT_IR_SCHEDULE,
      daysWeek: { ...DEFAULT_DAYS_WEEK },
    });
    this.view.updateState({ schedules: this.state.schedules });
  }

  private handleRemove(index: number): void {
    this.state.schedules.splice(index, 1);
    this.view.updateState({ schedules: this.state.schedules });
  }

  private async handleSave(): Promise<void> {
    let confirmed = false;
    if (this.onConfirm) {
      confirmed = await this.onConfirm(
        'Confirmar agendamento',
        'Tem certeza que deseja confirmar esse novo intervalo de agendamento?',
      );
    } else {
      confirmed = await showConfirmModal(
        this.view.getElement(),
        'Confirmar agendamento',
        'Tem certeza que deseja confirmar esse novo intervalo de agendamento?',
      );
    }

    if (!confirmed) return;

    if (this.onSave) {
      try {
        const success = await this.onSave([...this.state.schedules]);
        if (success) {
          this.notify('success', 'Agendamento salvo com sucesso.');
        }
      } catch {
        this.notify('error', 'Dispositivo Inativo');
      }
    }
  }

  private notify(type: 'success' | 'warning' | 'error', message: string): void {
    if (this.onNotify) {
      this.onNotify(type, message);
    } else {
      showNotificationModal(this.view.getElement(), type, message);
    }
  }

  public updateState(newState: Partial<ScheduleIRState>): void {
    Object.assign(this.state, newState);
    this.view.updateState(newState);
  }

  public getState(): ScheduleIRState {
    return { ...this.state };
  }

  public setThemeMode(mode: SchedulingThemeMode): void {
    this.settings.themeMode = mode;
    this.view.setThemeMode(mode);
  }

  public destroy(): void {
    this.view.destroy();
  }

  public getElement(): HTMLElement {
    return this.view.getElement();
  }
}

/**
 * Factory function for creating a Schedule IR component.
 */
export function createScheduleIR(
  container: HTMLElement,
  params: ScheduleIRParams,
): ScheduleIRInstance {
  const controller = new ScheduleIRController(container, params);
  return {
    element: controller.getElement(),
    updateState: (state) => controller.updateState(state),
    getState: () => controller.getState(),
    setThemeMode: (mode) => controller.setThemeMode(mode),
    destroy: () => controller.destroy(),
  };
}
