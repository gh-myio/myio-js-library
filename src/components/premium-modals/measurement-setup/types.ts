// RFC-0108: Measurement Setup Modal Types

export type WaterUnit = 'm3' | 'liters';
export type EnergyUnit = 'kwh' | 'mwh' | 'auto';
export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type Domain = 'energy' | 'water' | 'temperature';

export interface WaterDisplaySettings {
  unit: WaterUnit;
  decimalPlaces: number;
  autoScale: boolean;
}

export interface EnergyDisplaySettings {
  unit: EnergyUnit;
  decimalPlaces: number;
  forceUnit: boolean;
}

export interface TemperatureDisplaySettings {
  unit: TemperatureUnit;
  decimalPlaces: number;
}

export interface MeasurementDisplaySettings {
  version: string;
  updatedAt: string;
  updatedBy?: string;
  water: WaterDisplaySettings;
  energy: EnergyDisplaySettings;
  temperature: TemperatureDisplaySettings;
}

export interface MeasurementSetupFormData {
  water: WaterDisplaySettings;
  energy: EnergyDisplaySettings;
  temperature: TemperatureDisplaySettings;
}

export interface MeasurementSetupModalStyles {
  primaryColor?: string;
  successColor?: string;
  warningColor?: string;
  dangerColor?: string;
  textPrimary?: string;
  textSecondary?: string;
  backgroundColor?: string;
  overlayColor?: string;
  borderRadius?: string;
  buttonRadius?: string;
  zIndex?: number;
  fontFamily?: string;
}

export interface MeasurementSetupModalParams {
  // Required parameters
  token: string;
  customerId: string;
  tbBaseUrl?: string;

  // Optional parameters
  existingSettings?: MeasurementDisplaySettings | null;
  container?: HTMLElement | string;
  onSave?: (settings: MeasurementDisplaySettings) => void;
  onClose?: () => void;
  styles?: MeasurementSetupModalStyles;
}

export interface MeasurementSetupModalInstance {
  destroy(): void;
  getFormData(): MeasurementSetupFormData;
  setFormData(data: Partial<MeasurementSetupFormData>): void;
}

export interface MeasurementSetupError {
  code: 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'AUTH_ERROR' | 'TOKEN_EXPIRED' | 'UNKNOWN_ERROR';
  message: string;
  field?: string;
  cause?: unknown;
}

export interface PersistResult {
  ok: boolean;
  error?: MeasurementSetupError;
  settings?: MeasurementDisplaySettings;
}

// Constants for UI (Portuguese)
export const WATER_UNITS = [
  { value: 'm3', label: 'Metros Cúbicos (m³)' },
  { value: 'liters', label: 'Litros (L)' },
] as const;

export const ENERGY_UNITS = [
  { value: 'auto', label: 'Automático (kWh/MWh)' },
  { value: 'kwh', label: 'Quilowatt-hora (kWh)' },
  { value: 'mwh', label: 'Megawatt-hora (MWh)' },
] as const;

export const TEMPERATURE_UNITS = [
  { value: 'celsius', label: 'Celsius (°C)' },
  { value: 'fahrenheit', label: 'Fahrenheit (°F)' },
] as const;

export const DECIMAL_OPTIONS = [
  { value: 0, label: '0 casas' },
  { value: 1, label: '1 casa' },
  { value: 2, label: '2 casas' },
  { value: 3, label: '3 casas' },
  { value: 4, label: '4 casas' },
  { value: 5, label: '5 casas' },
  { value: 6, label: '6 casas' },
] as const;

export const DOMAIN_CONFIG = {
  water: {
    icon: '💧',
    label: 'Água',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  energy: {
    icon: '⚡',
    label: 'Energia',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  temperature: {
    icon: '🌡️',
    label: 'Temperatura',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
  },
} as const;

export const DEFAULT_SETTINGS: MeasurementDisplaySettings = {
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  water: {
    unit: 'm3',
    decimalPlaces: 3,
    autoScale: true,
  },
  energy: {
    unit: 'auto',
    decimalPlaces: 3,
    forceUnit: false,
  },
  temperature: {
    unit: 'celsius',
    decimalPlaces: 1,
  },
};
