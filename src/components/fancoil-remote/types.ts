/**
 * RFC-0158: Fancoil Remote Control Component Types
 * Migrated from remote-version-fancoil-widget-v1.0.0
 */

export type FancoilStatus = 'on' | 'off' | 'offline';
export type FancoilMode = 'auto' | 'man';
export type FancoilThemeMode = 'light' | 'dark';

export interface FancoilRemoteSettings {
  /** Central ID for API calls */
  centralId?: string;
  /** Minimum temperature setpoint (default: 16) */
  minTemperature?: number;
  /** Maximum temperature setpoint (default: 28) */
  maxTemperature?: number;
  /** Default temperature setpoint (default: 23) */
  defaultTemperature?: number;
  /** Enable debug mode */
  enableDebugMode?: boolean;
  /** Theme mode */
  themeMode?: FancoilThemeMode;
  /** Labels customization */
  labels?: {
    status?: string;
    setPoint?: string;
    auto?: string;
    manual?: string;
    settingsButton?: string;
  };
}

export interface FancoilState {
  /** Current device status (on/off/offline) */
  status: FancoilStatus;
  /** Current mode (auto/manual) */
  mode: FancoilMode;
  /** Current ambient temperature (null if unavailable) */
  ambientTemperature: number | null;
  /** Current power consumption in kW */
  consumption: number;
  /** Temperature setpoint (null if not available) */
  temperatureSetpoint: number | null;
  /** Whether setpoint controls are enabled */
  isSetpointEnabled: boolean;
  /** Device name */
  deviceName: string;
}

export interface FancoilRemoteParams {
  /** Initial settings */
  settings?: FancoilRemoteSettings;
  /** Initial state */
  initialState?: Partial<FancoilState>;
  /** Callback when power button is clicked */
  onPowerToggle?: (currentStatus: FancoilStatus) => Promise<boolean> | boolean;
  /** Callback when temperature is changed */
  onTemperatureChange?: (newTemperature: number) => Promise<boolean> | boolean;
  /** Callback when settings/calendar button is clicked */
  onSettingsClick?: () => void;
  /** Callback for showing confirmation modal */
  onConfirmAction?: (title: string, message: string) => Promise<boolean>;
  /** Callback for showing notification */
  onNotify?: (type: 'success' | 'warning' | 'error', message: string) => void;
}

export interface FancoilRemoteInstance {
  /** Root element */
  element: HTMLElement;
  /** Update the state */
  updateState: (state: Partial<FancoilState>) => void;
  /** Get current state */
  getState: () => FancoilState;
  /** Set theme mode */
  setThemeMode: (mode: FancoilThemeMode) => void;
  /** Destroy the component */
  destroy: () => void;
}

// Image URLs for different consumption states
export const FANCOIL_IMAGES = {
  off: 'https://dashboard.myio-bas.com/api/images/public/G5ldxE6QEljmGxLyUGkjHQt3ddUtbPax',
  fan: 'https://dashboard.myio-bas.com/api/images/public/4A8Sk4WP8QuPqyxwZXCF9I08HxQsbKBy',
  on: 'https://dashboard.myio-bas.com/api/images/public/Huwu3DqdnwB1N9mqlcSRsWzKUD3dPwtJ',
  offline: 'https://dashboard.myio-bas.com/api/images/public/j8gvUT86qM2e3k32WlzXyhA88Fnctloy',
};

// Default settings
export const DEFAULT_FANCOIL_SETTINGS: Required<FancoilRemoteSettings> = {
  centralId: '',
  minTemperature: 16,
  maxTemperature: 28,
  defaultTemperature: 23,
  enableDebugMode: false,
  themeMode: 'light',
  labels: {
    status: 'STATUS',
    setPoint: 'Set Point',
    auto: 'AUTO.',
    manual: 'MAN.',
    settingsButton: '& ',
  },
};

// Default state
export const DEFAULT_FANCOIL_STATE: FancoilState = {
  status: 'offline',
  mode: 'auto',
  ambientTemperature: null,
  consumption: 0,
  temperatureSetpoint: 23,
  isSetpointEnabled: true,
  deviceName: 'Fancoil',
};

/**
 * Get the appropriate image based on consumption level
 */
export function getImageByConsumption(consumption: number): string {
  if (consumption === 0) return FANCOIL_IMAGES.off;
  if (consumption > 0 && consumption <= 0.150) return FANCOIL_IMAGES.fan;
  if (consumption > 0.150) return FANCOIL_IMAGES.on;
  return FANCOIL_IMAGES.offline;
}
