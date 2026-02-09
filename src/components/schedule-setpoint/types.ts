/**
 * Schedule Setpoint Component Types
 * Migrated from agendamento-setpoint-temperatura-fancoil-v1.0.0
 */

import type {
  ScheduleEntryBase,
  SchedulingThemeMode,
  SchedulingBaseSettings,
  NotifyFn,
  ConfirmFn,
} from '../scheduling-shared';

export interface SetpointScheduleEntry extends ScheduleEntryBase {
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  setpoint: number;    // 16-26 °C
  errors?: Record<string, string>;
}

export interface ScheduleSetpointSettings extends SchedulingBaseSettings {
  themeMode?: SchedulingThemeMode;
  minSetpoint?: number;
  maxSetpoint?: number;
}

export interface ScheduleSetpointDevices {
  fancoil?: string;
  temperature?: string;
  valve?: string;
}

export interface ScheduleSetpointState {
  schedules: SetpointScheduleEntry[];
  entityName: string;
  devices: ScheduleSetpointDevices;
  loading: boolean;
  footerError: string | null;
}

export interface ScheduleSetpointParams {
  settings?: ScheduleSetpointSettings;
  initialState?: Partial<ScheduleSetpointState>;
  onSave?: (schedules: SetpointScheduleEntry[], devices: ScheduleSetpointDevices) => Promise<boolean>;
  onConfirm?: ConfirmFn;
  onNotify?: NotifyFn;
}

export interface ScheduleSetpointInstance {
  element: HTMLElement;
  updateState: (state: Partial<ScheduleSetpointState>) => void;
  getState: () => ScheduleSetpointState;
  setThemeMode: (mode: SchedulingThemeMode) => void;
  destroy: () => void;
}

export const DEFAULT_SETPOINT_SCHEDULE: SetpointScheduleEntry = {
  startTime: '00:00',
  endTime: '00:00',
  setpoint: 23,
  daysWeek: {
    mon: false, tue: false, wed: false, thu: false,
    fri: false, sat: false, sun: false,
  },
  holiday: false,
  errors: {},
};

export const DEFAULT_SETPOINT_STATE: ScheduleSetpointState = {
  schedules: [],
  entityName: '',
  devices: {},
  loading: false,
  footerError: null,
};

export const DEFAULT_SETPOINT_SETTINGS: Required<ScheduleSetpointSettings> = {
  themeMode: 'dark',
  enableDebugMode: false,
  minSetpoint: 16,
  maxSetpoint: 26,
};
