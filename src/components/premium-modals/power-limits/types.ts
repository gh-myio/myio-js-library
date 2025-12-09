// RFC-0103: Power Limits Setup Modal Types

export type DeviceStatusName = 'standBy' | 'normal' | 'alert' | 'failure';

export interface StatusLimits {
  deviceStatusName: DeviceStatusName;
  limitsValues: {
    baseValue: number | null;
    topValue: number | null;
  };
}

export interface DeviceTypeLimits {
  deviceType: string;
  name: string;
  description: string;
  limitsByDeviceStatus: StatusLimits[];
}

export interface TelemetryTypeLimits {
  telemetryType: string;
  itemsByDeviceType: DeviceTypeLimits[];
}

export interface InstantaneousPowerLimits {
  version: string;
  limitsByInstantaneoustPowerType: TelemetryTypeLimits[];
}

export interface PowerLimitsFormData {
  deviceType: string;
  telemetryType: string;
  standby: { baseValue: number | null; topValue: number | null };
  normal: { baseValue: number | null; topValue: number | null };
  alert: { baseValue: number | null; topValue: number | null };
  failure: { baseValue: number | null; topValue: number | null };
}

export interface PowerLimitsModalStyles {
  primaryColor?: string;
  successColor?: string;
  warningColor?: string;
  dangerColor?: string;
  infoColor?: string;
  textPrimary?: string;
  textSecondary?: string;
  backgroundColor?: string;
  overlayColor?: string;
  borderRadius?: string;
  buttonRadius?: string;
  zIndex?: number;
  fontFamily?: string;
}

export interface PowerLimitsModalParams {
  // Required parameters
  token: string;
  customerId: string;
  tbBaseUrl?: string;

  // Optional parameters
  deviceType?: string;
  telemetryType?: string;
  existingMapPower?: InstantaneousPowerLimits | null;
  container?: HTMLElement | string;
  onSave?: (json: InstantaneousPowerLimits) => void;
  onClose?: () => void;
  locale?: 'pt-BR' | 'en-US' | string;
  styles?: PowerLimitsModalStyles;
}

export interface PowerLimitsModalInstance {
  destroy(): void;
  getFormData(): PowerLimitsFormData;
  setFormData(data: Partial<PowerLimitsFormData>): void;
}

export interface PowerLimitsError {
  code: 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'AUTH_ERROR' | 'TOKEN_EXPIRED' | 'UNKNOWN_ERROR';
  message: string;
  field?: string;
  cause?: unknown;
}

export const DEVICE_TYPES = [
  { value: 'ELEVADOR', label: 'Elevator' },
  { value: 'ESCADA_ROLANTE', label: 'Escalator' },
  { value: 'MOTOR', label: 'Motor' },
  { value: 'BOMBA', label: 'Pump' },
  { value: 'CHILLER', label: 'Chiller' },
  { value: 'AR_CONDICIONADO', label: 'Air Conditioner' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'FANCOIL', label: 'Fancoil' },
  { value: '3F_MEDIDOR', label: 'Three-phase Meter' },
] as const;

export const TELEMETRY_TYPES = [
  { value: 'consumption', label: 'Consumption (kW)', unit: 'kW' },
  { value: 'voltage_a', label: 'Voltage A (V)', unit: 'V' },
  { value: 'voltage_b', label: 'Voltage B (V)', unit: 'V' },
  { value: 'voltage_c', label: 'Voltage C (V)', unit: 'V' },
  { value: 'current_a', label: 'Current A (A)', unit: 'A' },
  { value: 'current_b', label: 'Current B (A)', unit: 'A' },
  { value: 'current_c', label: 'Current C (A)', unit: 'A' },
  { value: 'total_current', label: 'Total Current (A)', unit: 'A' },
  { value: 'fp_a', label: 'Power Factor A', unit: '' },
  { value: 'fp_b', label: 'Power Factor B', unit: '' },
  { value: 'fp_c', label: 'Power Factor C', unit: '' },
] as const;

export const STATUS_CONFIG = {
  standBy: { label: 'StandBy', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)' },
  normal: { label: 'Normal', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  alert: { label: 'Alert', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
  failure: { label: 'Failure', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
} as const;
