/**
 * Schedule On/Off Controller
 * Migrated from agendamento-individual-on-off-v1.0.0
 */

import type {
  ScheduleOnOffParams,
  ScheduleOnOffInstance,
  ScheduleOnOffSettings,
  ScheduleOnOffState,
  OnOffScheduleEntry,
  OnOffGroupScheduleEntry,
} from './types';
import { DEFAULT_ON_OFF_SETTINGS, DEFAULT_ON_OFF_STATE, DEFAULT_ON_OFF_SCHEDULE } from './types';
import { ScheduleOnOffView } from './ScheduleOnOffView';
import {
  showConfirmModal,
  showNotificationModal,
  DEFAULT_DAYS_WEEK,
  type SchedulingThemeMode,
} from '../scheduling-shared';

export class ScheduleOnOffController {
  private view: ScheduleOnOffView;
  private settings: Required<ScheduleOnOffSettings>;
  private state: ScheduleOnOffState;

  private onSave?: (schedules: OnOffScheduleEntry[]) => Promise<boolean>;
  private onConfirm?: (title: string, message: string) => Promise<boolean>;
  private onNotify?: (type: 'success' | 'warning' | 'error', message: string) => void;
  private onGroupScheduleClick?: (entry: OnOffGroupScheduleEntry, event: Event) => void;

  constructor(container: HTMLElement, params: ScheduleOnOffParams) {
    this.settings = { ...DEFAULT_ON_OFF_SETTINGS, ...params.settings };
    this.state = { ...DEFAULT_ON_OFF_STATE, ...params.initialState };

    this.onSave = params.onSave;
    this.onConfirm = params.onConfirm;
    this.onNotify = params.onNotify;
    this.onGroupScheduleClick = params.onGroupScheduleClick;

    this.view = new ScheduleOnOffView({
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
      ...DEFAULT_ON_OFF_SCHEDULE,
      daysWeek: { ...DEFAULT_DAYS_WEEK },
    });
    this.view.updateState({ schedules: this.state.schedules });
  }

  private handleRemove(index: number): void {
    this.state.schedules.splice(index, 1);
    this.view.updateState({ schedules: this.state.schedules });
  }

  private async handleSave(): Promise<void> {
    // Confirm before saving
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
          this.notify('success', 'Agendamento efetuado com sucesso!');
        }
      } catch {
        this.notify('error', 'Falha ao salvar novo agendamento.');
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

  public updateState(newState: Partial<ScheduleOnOffState>): void {
    Object.assign(this.state, newState);
    this.view.updateState(newState);
  }

  public getState(): ScheduleOnOffState {
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
 * Factory function for creating a Schedule On/Off component.
 */
export function createScheduleOnOff(
  container: HTMLElement,
  params: ScheduleOnOffParams,
): ScheduleOnOffInstance {
  const controller = new ScheduleOnOffController(container, params);
  return {
    element: controller.getElement(),
    updateState: (state) => controller.updateState(state),
    getState: () => controller.getState(),
    setThemeMode: (mode) => controller.setThemeMode(mode),
    destroy: () => controller.destroy(),
  };
}
