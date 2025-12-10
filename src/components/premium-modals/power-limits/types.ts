// RFC-0103: Power Limits Setup Modal Types

export type DeviceStatusName = 'standBy' | 'normal' | 'alert' | 'failure';
export type Domain = 'energy' | 'water' | 'temperature';

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
  domain: Domain;
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
  domain?: Domain;
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

export const DOMAINS = [
  { value: 'energy', label: 'Energia', icon: '⚡' },
  { value: 'water', label: 'Água', icon: '💧' },
  { value: 'temperature', label: 'Temperatura', icon: '🌡️' },
] as const;

export const DEVICE_TYPES = [
  { value: 'ELEVADOR', label: 'Elevador' },
  { value: 'ESCADA_ROLANTE', label: 'Escada Rolante' },
  { value: 'MOTOR', label: 'Motor' },
  { value: 'BOMBA', label: 'Bomba' },
  { value: 'CHILLER', label: 'Chiller' },
  { value: 'AR_CONDICIONADO', label: 'Ar Condicionado' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'FANCOIL', label: 'Fancoil' },
  { value: '3F_MEDIDOR', label: 'Medidor Trifásico' },
] as const;

export const TELEMETRY_TYPES = [
  { value: 'consumption', label: 'Potência (kW)', unit: 'kW' },
  { value: 'voltage_a', label: 'Tensão A (V)', unit: 'V' },
  { value: 'voltage_b', label: 'Tensão B (V)', unit: 'V' },
  { value: 'voltage_c', label: 'Tensão C (V)', unit: 'V' },
  { value: 'current_a', label: 'Corrente A (A)', unit: 'A' },
  { value: 'current_b', label: 'Corrente B (A)', unit: 'A' },
  { value: 'current_c', label: 'Corrente C (A)', unit: 'A' },
  { value: 'total_current', label: 'Corrente Total (A)', unit: 'A' },
  { value: 'fp_a', label: 'Fator de Potência A', unit: '' },
  { value: 'fp_b', label: 'Fator de Potência B', unit: '' },
  { value: 'fp_c', label: 'Fator de Potência C', unit: '' },
] as const;

// Icons per domain (from deviceStatus.js)
// standBy = STANDBY, normal = POWER_ON, alert = WARNING, failure = FAILURE
export const STATUS_ICONS: Record<Domain, Record<DeviceStatusName, string>> = {
  energy: {
    standBy: '🔌',   // STANDBY
    normal: '⚡',    // POWER_ON
    alert: '⚠️',    // WARNING
    failure: '🚨',  // FAILURE
  },
  water: {
    standBy: '🚰',   // STANDBY
    normal: '💧',    // POWER_ON
    alert: '⚠️',    // WARNING
    failure: '🚨',  // FAILURE
  },
  temperature: {
    standBy: '🌡️',  // STANDBY
    normal: '🌡️',   // POWER_ON
    alert: '⚠️',    // WARNING
    failure: '🚨',  // FAILURE
  },
};

export const STATUS_CONFIG = {
  standBy: { label: 'StandBy', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)' },
  normal: { label: 'Normal', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  alert: { label: 'Alerta', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
  failure: { label: 'Falha', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
} as const;
