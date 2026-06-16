/**
 * RFC-0167: On/Off Device Modal - Device Configuration
 * Device-specific settings for different On/Off device types
 */

import type { DeviceTypeConfig, OnOffDeviceType } from './types';

/**
 * Device profiles supported by the On/Off modal
 */
export const ON_OFF_DEVICE_PROFILES = ['SOLENOIDE', 'INTERRUPTOR', 'RELE', 'BOMBA', 'LAMP', 'PLUG'] as const;

/**
 * Check if a device profile is an On/Off device
 */
export function isOnOffDeviceProfile(deviceProfile: string): boolean {
  const profile = (deviceProfile || '').toUpperCase();
  return ON_OFF_DEVICE_PROFILES.includes(profile as typeof ON_OFF_DEVICE_PROFILES[number]);
}

/**
 * Device configuration by device profile
 */
export const DEVICE_CONFIG: Record<string, DeviceTypeConfig> = {
  SOLENOIDE: {
    icon: '🚿',
    labelOn: 'Aberta',
    labelOff: 'Fechada',
    chartTitle: 'Consumo de Água',
    chartUnit: 'L',
    controlColor: '#3b82f6', // blue
  },
  INTERRUPTOR: {
    icon: '💡',
    labelOn: 'Ligado',
    labelOff: 'Desligado',
    chartTitle: 'Tempo de Uso',
    chartUnit: 'h',
    controlColor: '#eab308', // yellow
  },
  RELE: {
    icon: '⚡',
    labelOn: 'Ativado',
    labelOff: 'Desativado',
    chartTitle: 'Ativações',
    chartUnit: 'ciclos',
    controlColor: '#8b5cf6', // purple
  },
  BOMBA: {
    icon: '💧',
    labelOn: 'Ligada',
    labelOff: 'Desligada',
    chartTitle: 'Tempo de Operação',
    chartUnit: 'h',
    controlColor: '#06b6d4', // cyan
  },
  LAMP: {
    icon: '💡',
    labelOn: 'Ligado',
    labelOff: 'Desligado',
    chartTitle: 'Tempo de Uso',
    chartUnit: 'h',
    controlColor: '#eab308', // yellow
  },
  PLUG: {
    icon: '🔌',
    labelOn: 'Ligado',
    labelOff: 'Desligado',
    chartTitle: 'Tempo de Uso',
    chartUnit: 'h',
    controlColor: '#0ea5e9', // sky
  },
};

/**
 * Default configuration for unknown device types
 */
export const DEFAULT_DEVICE_CONFIG: DeviceTypeConfig = {
  icon: '🔌',
  labelOn: 'On',
  labelOff: 'Off',
  chartTitle: 'Uso',
  chartUnit: '',
  controlColor: '#64748b', // gray
};

/**
 * Get device configuration based on device profile
 * @param deviceProfile - Device profile string (e.g., 'SOLENOIDE', 'INTERRUPTOR')
 * @returns Device type configuration
 */
export function getDeviceConfig(deviceProfile: string | undefined): DeviceTypeConfig {
  const profile = (deviceProfile || '').toUpperCase();
  return DEVICE_CONFIG[profile] || DEFAULT_DEVICE_CONFIG;
}

const TYPE_TO_PROFILE: Record<string, string> = {
  solenoid: 'SOLENOIDE',
  switch: 'INTERRUPTOR',
  relay: 'RELE',
  pump: 'BOMBA',
};

/**
 * Get device configuration preferring explicit deviceType over deviceProfile.
 * Use this when the caller passes deviceType explicitly (e.g., deviceType: 'switch').
 */
export function getDeviceConfigByType(
  deviceType: OnOffDeviceType | undefined,
  deviceProfile: string | undefined
): DeviceTypeConfig {
  if (deviceType && deviceType !== 'generic') {
    const profile = TYPE_TO_PROFILE[deviceType];
    if (profile) return DEVICE_CONFIG[profile] || DEFAULT_DEVICE_CONFIG;
  }
  return getDeviceConfig(deviceProfile);
}

/**
 * Map device profile to device type
 * @param deviceProfile - Device profile string
 * @returns OnOffDeviceType
 */
export function getDeviceType(deviceProfile: string | undefined): OnOffDeviceType {
  const profile = (deviceProfile || '').toUpperCase();
  switch (profile) {
    case 'SOLENOIDE':
      return 'solenoid';
    case 'INTERRUPTOR':
      return 'switch';
    case 'RELE':
      return 'relay';
    case 'BOMBA':
      return 'pump';
    default:
      return 'generic';
  }
}

/**
 * Get modal title based on device
 * @param deviceProfile - Device profile string
 * @param deviceName - Device name/label
 * @returns Modal title string
 */
export function getModalTitle(deviceProfile: string | undefined, deviceName: string): string {
  const config = getDeviceConfig(deviceProfile);
  return `Controle - ${deviceName}`;
}
