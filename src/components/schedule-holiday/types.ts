/**
 * Schedule Holiday Component Types
 * Migrated from feriado-v6
 */

import type {
  SchedulingThemeMode,
  SchedulingBaseSettings,
  NotifyFn,
} from '../scheduling-shared';

export interface HolidayEntry {
  holidayDates: string; // ISO date string YYYY-MM-DD
}

export interface ScheduleHolidaySettings extends SchedulingBaseSettings {
  themeMode?: SchedulingThemeMode;
}

export interface ScheduleHolidayState {
  holidays: HolidayEntry[];
  entityName: string;
  loading: boolean;
}

export interface ScheduleHolidayParams {
  settings?: ScheduleHolidaySettings;
  initialState?: Partial<ScheduleHolidayState>;
  onSave?: (holidays: HolidayEntry[]) => Promise<boolean>;
  onNotify?: NotifyFn;
}

export interface ScheduleHolidayInstance {
  element: HTMLElement;
  updateState: (state: Partial<ScheduleHolidayState>) => void;
  getState: () => ScheduleHolidayState;
  setThemeMode: (mode: SchedulingThemeMode) => void;
  destroy: () => void;
}

export const DEFAULT_HOLIDAY_STATE: ScheduleHolidayState = {
  holidays: [],
  entityName: '',
  loading: false,
};

export const DEFAULT_HOLIDAY_SETTINGS: Required<ScheduleHolidaySettings> = {
  themeMode: 'dark',
  enableDebugMode: false,
};
