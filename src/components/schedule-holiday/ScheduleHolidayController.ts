/**
 * Schedule Holiday Controller
 * Migrated from feriado-v6
 */

import type {
  ScheduleHolidayParams,
  ScheduleHolidayInstance,
  ScheduleHolidaySettings,
  ScheduleHolidayState,
  HolidayEntry,
} from './types';
import { DEFAULT_HOLIDAY_SETTINGS, DEFAULT_HOLIDAY_STATE } from './types';
import { ScheduleHolidayView } from './ScheduleHolidayView';
import {
  showNotificationModal,
  type SchedulingThemeMode,
} from '../scheduling-shared';

export class ScheduleHolidayController {
  private view: ScheduleHolidayView;
  private settings: Required<ScheduleHolidaySettings>;
  private state: ScheduleHolidayState;

  private onSave?: (holidays: HolidayEntry[]) => Promise<boolean>;
  private onNotify?: (type: 'success' | 'warning' | 'error', message: string) => void;

  constructor(container: HTMLElement, params: ScheduleHolidayParams) {
    this.settings = { ...DEFAULT_HOLIDAY_SETTINGS, ...params.settings };
    this.state = { ...DEFAULT_HOLIDAY_STATE, ...params.initialState };

    this.onSave = params.onSave;
    this.onNotify = params.onNotify;

    this.view = new ScheduleHolidayView({
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
    this.state.holidays.push({
      holidayDates: '',
    });
    this.view.updateState({ holidays: this.state.holidays });
  }

  private handleRemove(index: number): void {
    this.state.holidays.splice(index, 1);
    this.view.updateState({ holidays: this.state.holidays });
  }

  private async handleSave(): Promise<void> {
    if (this.onSave) {
      try {
        const success = await this.onSave([...this.state.holidays]);
        if (success) {
          this.notify('success', 'Feriado salvo com sucesso.');
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

  public updateState(newState: Partial<ScheduleHolidayState>): void {
    Object.assign(this.state, newState);
    this.view.updateState(newState);
  }

  public getState(): ScheduleHolidayState {
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
 * Factory function for creating a Schedule Holiday component.
 */
export function createScheduleHoliday(
  container: HTMLElement,
  params: ScheduleHolidayParams,
): ScheduleHolidayInstance {
  const controller = new ScheduleHolidayController(container, params);
  return {
    element: controller.getElement(),
    updateState: (state) => controller.updateState(state),
    getState: () => controller.getState(),
    setThemeMode: (mode) => controller.setThemeMode(mode),
    destroy: () => controller.destroy(),
  };
}
