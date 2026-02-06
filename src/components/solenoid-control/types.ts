/**
 * RFC-0158: Solenoid Control Component Types
 * Migrated from acionamento-solenoide-com-on-off
 */

export type SolenoidStatus = 'on' | 'off' | 'offline';
export type SolenoidThemeMode = 'light' | 'dark';

export interface SolenoidControlSettings {
  /** Central ID for API calls */
  centralId?: string;
  /** Enable debug mode */
  enableDebugMode?: boolean;
  /** Theme mode */
  themeMode?: SolenoidThemeMode;
  /** Custom background color */
  backgroundColor?: string;
  /** Labels customization */
  labels?: {
    confirmMessage?: string;
    open?: string;
    closed?: string;
    unavailable?: string;
    confirmYes?: string;
    confirmNo?: string;
  };
}

export interface SolenoidState {
  /** Current valve status (on=open / off=closed / offline) */
  status: SolenoidStatus;
  /** Device name */
  deviceName: string;
  /** Names of related devices to include in toggle operations */
  relatedDevices: string[];
}

export interface SolenoidControlParams {
  /** Initial settings */
  settings?: SolenoidControlSettings;
  /** Initial state */
  initialState?: Partial<SolenoidState>;
  /** Callback when valve toggle is confirmed */
  onToggle?: (
    currentStatus: SolenoidStatus,
    deviceName: string,
    relatedDevices: string[],
  ) => Promise<boolean> | boolean;
  /** Callback for showing confirmation modal */
  onConfirmAction?: (title: string, message: string) => Promise<boolean>;
  /** Callback for showing notification */
  onNotify?: (type: 'success' | 'warning' | 'error', message: string) => void;
}

export interface SolenoidControlInstance {
  /** Root element */
  element: HTMLElement;
  /** Update the state */
  updateState: (state: Partial<SolenoidState>) => void;
  /** Get current state */
  getState: () => SolenoidState;
  /** Set theme mode */
  setThemeMode: (mode: SolenoidThemeMode) => void;
  /** Destroy the component */
  destroy: () => void;
}

/** Valve image URLs by status */
export const SOLENOID_IMAGES: Record<SolenoidStatus, string> = {
  on: 'https://dashboard.myio-bas.com/api/images/public/Tnq47Vd1TxhhqhYoHvzS73WVh1X84fPa',
  off: 'https://dashboard.myio-bas.com/api/images/public/dzVDTk3IxrOYkJ1sH92nXQFBaW53kVgs',
  offline: 'https://dashboard.myio-bas.com/api/images/public/gkSGqEFP4rgApNArjEoctM0BoLZMiKz6',
};

/** Default settings */
export const DEFAULT_SOLENOID_SETTINGS: Required<SolenoidControlSettings> = {
  centralId: '',
  enableDebugMode: false,
  themeMode: 'light',
  backgroundColor: '',
  labels: {
    confirmMessage: 'Deseja alterar o estado do solenoide?',
    open: 'Aberto',
    closed: 'Fechado',
    unavailable: 'Indisponivel',
    confirmYes: 'Sim',
    confirmNo: 'Nao',
  },
};

/** Default state */
export const DEFAULT_SOLENOID_STATE: SolenoidState = {
  status: 'offline',
  deviceName: 'Solenoide',
  relatedDevices: [],
};
