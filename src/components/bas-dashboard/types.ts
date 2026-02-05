/**
 * RFC-0158: Building Automation System (BAS) Dashboard Types
 */

export type BASDashboardThemeMode = 'light' | 'dark';

export type WaterDeviceType = 'hydrometer' | 'cistern' | 'tank' | 'solenoid';
export type WaterDeviceStatus = 'online' | 'offline' | 'unknown';
export type HVACDeviceStatus = 'active' | 'inactive' | 'no_reading';
export type MotorDeviceStatus = 'running' | 'stopped' | 'unknown';
export type MotorDeviceType = 'pump' | 'motor' | 'other';

export interface WaterDevice {
  id: string;
  name: string;
  type: WaterDeviceType;
  floor?: string | null;
  value: number;
  unit: string;
  status: WaterDeviceStatus;
  lastUpdate: number;
}

export interface HVACDevice {
  id: string;
  name: string;
  floor: string;
  temperature: number | null;
  consumption: number | null;
  status: HVACDeviceStatus;
  setpoint?: number | null;
}

export interface MotorDevice {
  id: string;
  name: string;
  floor?: string | null;
  consumption: number;
  status: MotorDeviceStatus;
  type: MotorDeviceType;
}

export interface CardCustomStyle {
  fontSize?: string;
  backgroundColor?: string;
  fontColor?: string;
  width?: string;
  height?: string;
}

export interface BASDashboardSettings {
  enableDebugMode?: boolean;
  defaultThemeMode?: BASDashboardThemeMode;
  dashboardTitle?: string;
  floorsLabel?: string;
  environmentsLabel?: string;
  pumpsMotorsLabel?: string;
  temperatureChartTitle?: string;
  consumptionChartTitle?: string;
  showFloorsSidebar?: boolean;
  showWaterInfrastructure?: boolean;
  showEnvironments?: boolean;
  showPumpsMotors?: boolean;
  showCharts?: boolean;
  primaryColor?: string;
  warningColor?: string;
  errorColor?: string;
  successColor?: string;
  cardCustomStyle?: CardCustomStyle;
  sidebarBackgroundImage?: string;
}

export interface BASDashboardParams {
  settings?: BASDashboardSettings;
  waterDevices?: WaterDevice[];
  hvacDevices?: HVACDevice[];
  motorDevices?: MotorDevice[];
  floors?: string[];
  themeMode?: BASDashboardThemeMode;
  onFloorSelect?: (floor: string | null) => void;
  onDeviceClick?: (device: WaterDevice | HVACDevice | MotorDevice) => void;
}

export interface BASDashboardData {
  waterDevices: WaterDevice[];
  hvacDevices: HVACDevice[];
  motorDevices: MotorDevice[];
  floors: string[];
}

export interface BASDashboardInstance {
  element: HTMLElement;
  updateData: (data: Partial<BASDashboardData>) => void;
  setThemeMode: (mode: BASDashboardThemeMode) => void;
  getThemeMode: () => BASDashboardThemeMode;
  setSelectedFloor: (floor: string | null) => void;
  getSelectedFloor: () => string | null;
  resize: () => void;
  destroy: () => void;
}

export interface BASDashboardState {
  selectedFloor: string | null;
  waterDevices: WaterDevice[];
  hvacDevices: HVACDevice[];
  motorDevices: MotorDevice[];
  floors: string[];
  themeMode: BASDashboardThemeMode;
  isLoading: boolean;
}

export type BASEventType =
  | 'bas:floor-changed'
  | 'bas:water-updated'
  | 'bas:hvac-updated'
  | 'bas:motors-updated'
  | 'bas:theme-changed'
  | 'bas:device-clicked';

// Default settings
export const DEFAULT_BAS_SETTINGS: Required<BASDashboardSettings> = {
  enableDebugMode: false,
  defaultThemeMode: 'light',
  dashboardTitle: 'DASHBOARD',
  floorsLabel: 'Andares',
  environmentsLabel: 'Ambientes',
  pumpsMotorsLabel: 'Bombas e Motores',
  temperatureChartTitle: 'Temperatura do dia atual de todos os ambientes',
  consumptionChartTitle: 'Consumo do dia atual de todos os ambientes',
  showFloorsSidebar: true,
  showWaterInfrastructure: true,
  showEnvironments: true,
  showPumpsMotors: true,
  showCharts: true,
  primaryColor: '#2F5848',
  warningColor: '#f57c00',
  errorColor: '#c62828',
  successColor: '#2e7d32',
  cardCustomStyle: undefined,
  sidebarBackgroundImage: undefined,
};
