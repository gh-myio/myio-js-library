/**
 * Schedule IR Component Types
 * Migrated from agendamento-ir
 */

import type {
  ScheduleEntryBase,
  SchedulingThemeMode,
  SchedulingBaseSettings,
  NotifyFn,
  ConfirmFn,
} from '../scheduling-shared';

export interface IRCommand {
  command_id: string;
  temperature: string;  // Display label (e.g., "22")
  slave_id?: string;
}

export interface IRScheduleEntry extends ScheduleEntryBase {
  time: string;             // HH:MM (single time, not interval)
  action: boolean;          // true = on, false = off
  temperature: string | null; // command_id when action=true
}

export interface IRGroupScheduleEntry extends IRScheduleEntry {
  entityName: string;
  entityId: string;
}

export interface ScheduleIRSettings extends SchedulingBaseSettings {
  themeMode?: SchedulingThemeMode;
}

export interface ScheduleIRState {
  schedules: IRScheduleEntry[];
  groupSchedules: IRGroupScheduleEntry[];
  availableCommands: IRCommand[];
  entityName: string;
  loading: boolean;
}

export interface ScheduleIRParams {
  settings?: ScheduleIRSettings;
  initialState?: Partial<ScheduleIRState>;
  onSave?: (schedules: IRScheduleEntry[]) => Promise<boolean>;
  onConfirm?: ConfirmFn;
  onNotify?: NotifyFn;
  onGroupScheduleClick?: (entry: IRGroupScheduleEntry, event: Event) => void;
}

export interface ScheduleIRInstance {
  element: HTMLElement;
  updateState: (state: Partial<ScheduleIRState>) => void;
  getState: () => ScheduleIRState;
  setThemeMode: (mode: SchedulingThemeMode) => void;
  destroy: () => void;
}

export const DEFAULT_IR_SCHEDULE: IRScheduleEntry = {
  time: '00:00',
  action: false,
  temperature: null,
  daysWeek: {
    mon: false, tue: false, wed: false, thu: false,
    fri: false, sat: false, sun: false,
  },
  holiday: false,
};

export const DEFAULT_IR_STATE: ScheduleIRState = {
  schedules: [],
  groupSchedules: [],
  availableCommands: [],
  entityName: '',
  loading: false,
};

export const DEFAULT_IR_SETTINGS: Required<ScheduleIRSettings> = {
  themeMode: 'dark',
  enableDebugMode: false,
};
