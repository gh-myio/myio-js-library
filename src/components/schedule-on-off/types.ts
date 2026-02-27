/**
 * Schedule On/Off Component Types
 * Migrated from agendamento-individual-on-off-v1.0.0
 */

import type {
  ScheduleEntryBase,
  SchedulingThemeMode,
  SchedulingBaseSettings,
  NotifyFn,
  ConfirmFn,
} from '../scheduling-shared';

export interface OnOffScheduleEntry extends ScheduleEntryBase {
  startHour: string;   // HH:MM
  endHour: string;     // HH:MM
  retain: boolean;     // Pulse (false) or retain (true)
  action?: 'on' | 'off'; // 'on' = ligar/abrir, 'off' = desligar/fechar (default: 'on')
}

export interface OnOffGroupScheduleEntry extends OnOffScheduleEntry {
  entityName: string;
  entityId: string;
}

export interface ScheduleOnOffSettings extends SchedulingBaseSettings {
  themeMode?: SchedulingThemeMode;
  labelOn?: string;   // Label for 'on' action (e.g. "Ligar", "Aberta")
  labelOff?: string;  // Label for 'off' action (e.g. "Desligar", "Fechada")
}

export interface ScheduleOnOffState {
  schedules: OnOffScheduleEntry[];
  groupSchedules: OnOffGroupScheduleEntry[];
  entityName: string;
  loading: boolean;
}

export interface ScheduleOnOffParams {
  settings?: ScheduleOnOffSettings;
  initialState?: Partial<ScheduleOnOffState>;
  onSave?: (schedules: OnOffScheduleEntry[]) => Promise<boolean>;
  onConfirm?: ConfirmFn;
  onNotify?: NotifyFn;
  onGroupScheduleClick?: (entry: OnOffGroupScheduleEntry, event: Event) => void;
}

export interface ScheduleOnOffInstance {
  element: HTMLElement;
  updateState: (state: Partial<ScheduleOnOffState>) => void;
  getState: () => ScheduleOnOffState;
  setThemeMode: (mode: SchedulingThemeMode) => void;
  destroy: () => void;
}

export const DEFAULT_ON_OFF_SCHEDULE: OnOffScheduleEntry = {
  startHour: '00:00',
  endHour: '03:00',
  daysWeek: {
    mon: false, tue: false, wed: false, thu: false,
    fri: false, sat: false, sun: false,
  },
  holiday: false,
  retain: false,
  action: 'on',
};

export const DEFAULT_ON_OFF_STATE: ScheduleOnOffState = {
  schedules: [],
  groupSchedules: [],
  entityName: '',
  loading: false,
};

export const DEFAULT_ON_OFF_SETTINGS: Required<ScheduleOnOffSettings> = {
  themeMode: 'dark',
  enableDebugMode: false,
  labelOn: 'Ligar',
  labelOff: 'Desligar',
};
