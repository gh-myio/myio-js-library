/**
 * RFC-0172: Switch Control Component Types
 * On/Off interruptor control for ambiente devices
 */

export type SwitchStatus = 'on' | 'off' | 'offline';
export type SwitchThemeMode = 'light' | 'dark';

export interface SwitchControlSettings {
  /** Theme mode */
  themeMode?: SwitchThemeMode;
  /** Background color override */
  backgroundColor?: string;
  /** Labels customization */
  labels?: {
    on?: string;
    off?: string;
    offline?: string;
    confirmOn?: string;
    confirmOff?: string;
    confirmYes?: string;
    confirmNo?: string;
  };
  /** Show confirmation dialog before toggle */
  showConfirmation?: boolean;
}

export interface SwitchState {
  /** Current switch status */
  status: SwitchStatus;
  /** Device/switch name */
  name: string;
  /** Device ID */
  id: string;
  /** Is currently loading/processing */
  isLoading?: boolean;
}

export interface SwitchControlParams {
  /** Component settings */
  settings?: SwitchControlSettings;
  /** Initial state */
  initialState?: Partial<SwitchState>;
  /**
   * Toggle callback - called when user toggles the switch
   * @param newStatus The new status being requested
   * @param state Current state
   * @returns Promise that resolves to true if successful
   */
  onToggle?: (newStatus: SwitchStatus, state: SwitchState) => Promise<boolean>;
}

export interface SwitchControlInstance {
  /** Get the root DOM element */
  getElement(): HTMLElement;
  /** Update switch state */
  updateState(newState: Partial<SwitchState>): void;
  /** Get current state */
  getState(): SwitchState;
  /** Set theme mode */
  setThemeMode(mode: SwitchThemeMode): void;
  /** Destroy and cleanup */
  destroy(): void;
}

// Default settings
export const DEFAULT_SWITCH_SETTINGS: Required<SwitchControlSettings> = {
  themeMode: 'light',
  backgroundColor: '',
  labels: {
    on: 'Ligado',
    off: 'Desligado',
    offline: 'Indisponivel',
    confirmOn: 'Deseja LIGAR este interruptor?',
    confirmOff: 'Deseja DESLIGAR este interruptor?',
    confirmYes: 'Sim',
    confirmNo: 'Nao',
  },
  showConfirmation: true,
};

// Default state
export const DEFAULT_SWITCH_STATE: SwitchState = {
  status: 'off',
  name: 'Interruptor',
  id: '',
  isLoading: false,
};
