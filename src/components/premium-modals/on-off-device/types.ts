/**
 * RFC-0167: On/Off Device Modal Types
 * Modal for controlling On/Off devices (solenoids, switches, relays, pumps)
 */

export type OnOffDeviceType = 'solenoid' | 'switch' | 'relay' | 'pump' | 'generic';
export type OnOffDeviceThemeMode = 'light' | 'dark';
export type OnOffModalView = 'chart' | 'schedule';

/**
 * Device data passed to the modal
 */
export interface OnOffDeviceData {
  id: string;
  entityId?: string;
  label: string;
  name?: string;
  deviceType?: string;
  deviceProfile?: string;
  status?: 'online' | 'offline' | 'unknown';
  attributes?: Record<string, any>;
  rawData?: Record<string, any>;
}

/**
 * Device type configuration for customizing labels and colors
 */
export interface DeviceTypeConfig {
  icon: string;
  labelOn: string;
  labelOff: string;
  chartTitle: string;
  chartUnit: string;
  controlColor: string;
}

/**
 * Schedule entry for on/off scheduling
 */
export interface OnOffScheduleEntry {
  id?: string;
  startHour: string;
  endHour: string;
  daysWeek: {
    mon: boolean;
    tue: boolean;
    wed: boolean;
    thu: boolean;
    fri: boolean;
    sat: boolean;
    sun: boolean;
  };
  holiday: boolean;
  retain: boolean;
}

/**
 * Usage data point for chart
 */
export interface UsageDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

/**
 * Modal parameters
 */
export interface OnOffDeviceModalParams {
  /** Container element to append modal to */
  container?: HTMLElement;
  /** Device data */
  device: OnOffDeviceData;
  /** Device type for configuration */
  deviceType?: OnOffDeviceType;
  /** Theme mode */
  themeMode?: OnOffDeviceThemeMode;
  /** JWT token for ThingsBoard API */
  jwtToken?: string;
  /** ThingsBoard base URL */
  tbBaseUrl?: string;
  /** Callback when modal closes */
  onClose?: () => void;
  /** Callback when device state changes */
  onStateChange?: (deviceId: string, state: boolean) => void;
  /** Callback when schedules are saved */
  onScheduleSave?: (deviceId: string, schedules: OnOffScheduleEntry[]) => void;
  /** Central ID for RPC commands */
  centralId?: string;
  /** Enable debug mode */
  enableDebugMode?: boolean;
  /** Callback when refresh is requested */
  onRefresh?: (deviceId: string) => void;
  /** Callback when date range changes */
  onDateRangeChange?: (deviceId: string, startISO: string, endISO: string) => void;
}

/**
 * Modal instance returned by factory
 */
export interface OnOffDeviceModalInstance {
  /** Modal root element */
  element: HTMLElement;
  /** Destroy the modal */
  destroy: () => void;
  /** Close the modal */
  close: () => void;
  /** Set theme mode */
  setTheme: (mode: OnOffDeviceThemeMode) => void;
  /** Update device state */
  updateDeviceState: (state: boolean) => void;
}

/**
 * Internal modal state
 */
export interface OnOffDeviceModalState {
  currentView: OnOffModalView;
  deviceState: boolean;
  isLoading: boolean;
  schedules: OnOffScheduleEntry[];
  usageData: UsageDataPoint[];
  deviceConfig: DeviceTypeConfig;
}

/**
 * Default modal state
 */
export const DEFAULT_MODAL_STATE: OnOffDeviceModalState = {
  currentView: 'chart',
  deviceState: false,
  isLoading: false,
  schedules: [],
  usageData: [],
  deviceConfig: {
    icon: '🔌',
    labelOn: 'On',
    labelOff: 'Off',
    chartTitle: 'Usage',
    chartUnit: '',
    controlColor: '#64748b',
  },
};
