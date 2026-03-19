/**
 * Schedule Setpoint Controller
 * Migrated from agendamento-setpoint-temperatura-fancoil-v1.0.0
 */

import type {
  ScheduleSetpointParams,
  ScheduleSetpointInstance,
  ScheduleSetpointSettings,
  ScheduleSetpointState,
  SetpointScheduleEntry,
  ScheduleSetpointDevices,
} from './types';
import { DEFAULT_SETPOINT_SETTINGS, DEFAULT_SETPOINT_STATE, DEFAULT_SETPOINT_SCHEDULE } from './types';
import { ScheduleSetpointView } from './ScheduleSetpointView';
import {
  showConfirmModal,
  showNotificationModal,
  isValidTimeFormat,
  isEndAfterStart,
  hasSelectedDays,
  isInRange,
  doSchedulesOverlap,
  DEFAULT_DAYS_WEEK,
  type SchedulingThemeMode,
} from '../scheduling-shared';

export class ScheduleSetpointController {
  private view: ScheduleSetpointView;
  private settings: Required<ScheduleSetpointSettings>;
  private state: ScheduleSetpointState;

  private onSave?: (schedules: SetpointScheduleEntry[], devices: ScheduleSetpointDevices) => Promise<boolean>;
  private onConfirm?: (title: string, message: string) => Promise<boolean>;
  private onNotify?: (type: 'success' | 'warning' | 'error', message: string) => void;

  constructor(container: HTMLElement, params: ScheduleSetpointParams) {
    this.settings = { ...DEFAULT_SETPOINT_SETTINGS, ...params.settings };
    this.state = { ...DEFAULT_SETPOINT_STATE, ...params.initialState };

    this.onSave = params.onSave;
    this.onConfirm = params.onConfirm;
    this.onNotify = params.onNotify;

    this.view = new ScheduleSetpointView({
      container,
      settings: this.settings,
      initialState: this.state,
      onAdd: () => this.handleAdd(),
      onRemove: (index) => this.handleRemove(index),
      onSave: () => this.handleSave(),
      onChange: () => {},
    });
  }

  private handleAdd(): void {
    this.state.schedules.push({
      ...DEFAULT_SETPOINT_SCHEDULE,
      daysWeek: { ...DEFAULT_DAYS_WEEK },
      errors: {},
    });
    this.view.updateState({ schedules: this.state.schedules });
  }

  private handleRemove(index: number): void {
    this.state.schedules.splice(index, 1);
    this.validateAll();
    this.view.updateState({ schedules: this.state.schedules });
  }

  private validateEntry(schedule: SetpointScheduleEntry): boolean {
    schedule.errors = {};

    if (!isValidTimeFormat(schedule.startTime)) {
      schedule.errors.startTime = 'Formato inválido (HH:MM).';
    }
    if (!isValidTimeFormat(schedule.endTime)) {
      schedule.errors.endTime = 'Formato inválido (HH:MM).';
    }

    if (
      isValidTimeFormat(schedule.startTime) &&
      isValidTimeFormat(schedule.endTime) &&
      !isEndAfterStart(schedule.startTime, schedule.endTime)
    ) {
      schedule.errors.endTime = 'Hora final deve ser após a hora inicial.';
    }

    if (!hasSelectedDays(schedule.daysWeek, schedule.holiday)) {
      schedule.errors.daysWeek = 'Selecione pelo menos um dia ou feriado.';
    }

    if (schedule.setpoint === null || schedule.setpoint === undefined) {
      schedule.errors.setpoint = 'Setpoint é obrigatório.';
    } else {
      const val = Number(schedule.setpoint);
      if (!Number.isInteger(val)) {
        schedule.errors.setpoint = 'Deve ser um número inteiro.';
      } else if (!isInRange(val, this.settings.minSetpoint, this.settings.maxSetpoint)) {
        schedule.errors.setpoint = `Deve estar entre ${this.settings.minSetpoint} e ${this.settings.maxSetpoint}.`;
      }
    }

    return Object.keys(schedule.errors).length === 0;
  }

  private validateOverlaps(): boolean {
    let hasOverlap = false;
    const schedules = this.state.schedules;

    // Clear previous overlap errors
    schedules.forEach((s) => {
      if (s.errors) delete s.errors.overlap;
    });

    for (let i = 0; i < schedules.length; i++) {
      const a = schedules[i];
      if (!isValidTimeFormat(a.startTime) || !isValidTimeFormat(a.endTime)) continue;

      for (let j = i + 1; j < schedules.length; j++) {
        const b = schedules[j];
        if (!isValidTimeFormat(b.startTime) || !isValidTimeFormat(b.endTime)) continue;

        if (
          doSchedulesOverlap(
            { startTime: a.startTime, endTime: a.endTime, daysWeek: a.daysWeek, holiday: a.holiday },
            { startTime: b.startTime, endTime: b.endTime, daysWeek: b.daysWeek, holiday: b.holiday },
          )
        ) {
          if (!a.errors) a.errors = {};
          if (!b.errors) b.errors = {};
          a.errors.overlap = 'Conflito com outro horário.';
          b.errors.overlap = 'Conflito com outro horário.';
          hasOverlap = true;
        }
      }
    }

    return !hasOverlap;
  }

  private validateAll(): boolean {
    let allValid = true;
    this.state.schedules.forEach((s) => {
      if (!this.validateEntry(s)) allValid = false;
    });

    const overlapsValid = this.validateOverlaps();
    return allValid && overlapsValid;
  }

  private async handleSave(): Promise<void> {
    if (!this.validateAll()) {
      this.notify('warning', 'Existem erros nos agendamentos. Por favor, corrija-os.');
      this.view.updateState({ schedules: this.state.schedules });
      return;
    }

    // Clear errors on valid
    this.state.schedules.forEach((s) => (s.errors = {}));

    let confirmed = false;
    if (this.onConfirm) {
      confirmed = await this.onConfirm(
        'Confirmar agendamento',
        'Tem certeza que deseja salvar os agendamentos?',
      );
    } else {
      confirmed = await showConfirmModal(
        this.view.getElement(),
        'Confirmar agendamento',
        'Tem certeza que deseja salvar os agendamentos?',
      );
    }

    if (!confirmed) return;

    if (this.onSave) {
      this.view.updateState({ loading: true });
      try {
        // Strip errors from payload
        const cleanSchedules = this.state.schedules.map((s) => {
          const { errors, ...rest } = s;
          return rest as SetpointScheduleEntry;
        });
        const success = await this.onSave(cleanSchedules, { ...this.state.devices });
        if (success) {
          this.notify('success', 'Agendamentos salvos com sucesso.');
        }
      } catch {
        this.notify('error', 'Erro ao salvar agendamentos. Por favor, tente novamente.');
        this.view.updateState({ footerError: 'Erro ao salvar agendamentos. Verifique a conexão ou os dispositivos.' });
      } finally {
        this.view.updateState({ loading: false });
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

  public updateState(newState: Partial<ScheduleSetpointState>): void {
    Object.assign(this.state, newState);
    this.view.updateState(newState);
  }

  public getState(): ScheduleSetpointState {
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
 * Factory function for creating a Schedule Setpoint component.
 */
export function createScheduleSetpoint(
  container: HTMLElement,
  params: ScheduleSetpointParams,
): ScheduleSetpointInstance {
  const controller = new ScheduleSetpointController(container, params);
  return {
    element: controller.getElement(),
    updateState: (state) => controller.updateState(state),
    getState: () => controller.getState(),
    setThemeMode: (mode) => controller.setThemeMode(mode),
    destroy: () => controller.destroy(),
  };
}
