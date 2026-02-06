/**
 * Scheduling Shared Types
 * Common types used across all scheduling components.
 */

export type SchedulingThemeMode = 'light' | 'dark';

export interface DaysWeek {
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
}

export const DEFAULT_DAYS_WEEK: DaysWeek = {
  mon: false,
  tue: false,
  wed: false,
  thu: false,
  fri: false,
  sat: false,
  sun: false,
};

export const DAY_LABELS: Record<keyof DaysWeek, string> = {
  mon: 'Seg',
  tue: 'Ter',
  wed: 'Qua',
  thu: 'Qui',
  fri: 'Sex',
  sat: 'Sáb',
  sun: 'Dom',
};

export const DAY_LABELS_FULL: Record<keyof DaysWeek, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

export interface ScheduleEntryBase {
  daysWeek: DaysWeek;
  holiday: boolean;
}

export interface SchedulingBaseSettings {
  themeMode?: SchedulingThemeMode;
  enableDebugMode?: boolean;
}

export type NotifyFn = (type: 'success' | 'warning' | 'error', message: string) => void;
export type ConfirmFn = (title: string, message: string) => Promise<boolean>;
