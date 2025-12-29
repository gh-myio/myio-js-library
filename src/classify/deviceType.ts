/**
 * RFC-0109: Device Type Classification
 *
 * Infers the device type from a device name using pattern matching.
 * Used in the Upsell Post-Setup Modal to suggest device types for
 * devices that don't have a deviceType attribute set.
 */

/** All possible device types returned by handleDeviceType */
export type InferredDeviceType =
  | 'COMPRESSOR'
  | 'VENTILADOR'
  | 'ESCADA_ROLANTE'
  | 'ELEVADOR'
  | 'MOTOR'
  | 'RELOGIO'
  | 'ENTRADA'
  | 'CHILLER'
  | 'FANCOIL'
  | 'BOMBA_CAG'
  | '3F_MEDIDOR'
  | 'HIDROMETRO'
  | 'CAIXA_DAGUA'
  | 'TANK'
  | 'SELETOR_AUTO_MANUAL'
  | 'TERMOSTATO'
  | 'SOLENOIDE'
  | 'GLOBAL_AUTOMACAO'
  | 'CONTROLE REMOTO';

/**
 * Infers the device type from a device name.
 *
 * The function normalizes the input name (uppercase, removes diacritics)
 * and matches against known patterns to determine the device type.
 *
 * @param name - The device name to classify
 * @returns The inferred device type
 *
 * @example
 * ```ts
 * handleDeviceType('Compressor AC Norte 01') // 'COMPRESSOR'
 * handleDeviceType('Elevador Social 01')     // 'ELEVADOR'
 * handleDeviceType('Hidrometro Loja 15')     // 'HIDROMETRO'
 * handleDeviceType('Chiller 3F Central')     // 'CHILLER'
 * handleDeviceType('Sensor 3F Entrada')      // '3F_MEDIDOR'
 * ```
 */
export function handleDeviceType(name: string): InferredDeviceType {
  const upper = (name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  // ENERGY - Compressors
  if (upper.includes('COMPRESSOR')) return 'COMPRESSOR';

  // ENERGY - Ventilation
  if (upper.includes('VENT')) return 'VENTILADOR';

  // ENERGY - Escalators
  if (upper.includes('ESRL') || upper.includes('ESCADA')) return 'ESCADA_ROLANTE';

  // ENERGY - Elevators
  if (upper.includes('ELEV')) return 'ELEVADOR';

  // ENERGY - Motors
  if (
    (upper.includes('MOTR') && !upper.includes('CHILLER')) ||
    upper.includes('MOTOR') ||
    upper.includes('RECALQUE')
  ) {
    return 'MOTOR';
  }

  // ENERGY - Clocks/Timers
  if (
    upper.includes('RELOGIO') ||
    upper.includes('RELOG') ||
    upper.includes('REL ')
  ) {
    return 'RELOGIO';
  }

  // ENERGY - Main entrance/substation
  if (
    upper.includes('ENTRADA') ||
    upper.includes('SUBESTACAO') ||
    upper.includes('SUBEST')
  ) {
    return 'ENTRADA';
  }

  // ENERGY - 3-phase meters
  if (upper.includes('3F')) {
    if (upper.includes('CHILLER')) return 'CHILLER';
    if (upper.includes('FANCOIL')) return 'FANCOIL';
    if (upper.includes('TRAFO')) return 'ENTRADA';
    if (upper.includes('ENTRADA')) return 'ENTRADA';
    if (upper.includes('CAG')) return 'BOMBA_CAG';
    return '3F_MEDIDOR';
  }

  // WATER - Hydrometers
  if (upper.includes('HIDR') || upper.includes('BANHEIRO')) {
    return 'HIDROMETRO';
  }

  // WATER - Water tanks
  if (
    upper.includes('CAIXA DAGUA') ||
    upper.includes('CX DAGUA') ||
    upper.includes('CXDAGUA') ||
    upper.includes('SCD')
  ) {
    return 'CAIXA_DAGUA';
  }

  // WATER - Tanks/Reservoirs
  if (
    upper.includes('TANK') ||
    upper.includes('TANQUE') ||
    upper.includes('RESERVATORIO')
  ) {
    return 'TANK';
  }

  // OTHER - Automation selectors
  if (upper.includes('AUTOMATICO')) return 'SELETOR_AUTO_MANUAL';

  // OTHER - Thermostats
  if (
    upper.includes('TERMOSTATO') ||
    upper.includes('TERMO') ||
    upper.includes('TEMP')
  ) {
    return 'TERMOSTATO';
  }

  // OTHER - Solenoids
  if (upper.includes('ABRE')) return 'SOLENOIDE';

  // OTHER - Global automation
  if (upper.includes('AUTOMACAO') || upper.includes('GW_AUTO')) {
    return 'GLOBAL_AUTOMACAO';
  }

  // OTHER - AC Remote controls
  if (upper.includes(' AC ') || upper.endsWith(' AC')) {
    return 'CONTROLE REMOTO';
  }

  // Default
  return '3F_MEDIDOR';
}

/**
 * Map of device types to their domain category
 */
export const DEVICE_TYPE_DOMAIN: Record<InferredDeviceType, 'energy' | 'water' | 'other'> = {
  COMPRESSOR: 'energy',
  VENTILADOR: 'energy',
  ESCADA_ROLANTE: 'energy',
  ELEVADOR: 'energy',
  MOTOR: 'energy',
  RELOGIO: 'energy',
  ENTRADA: 'energy',
  CHILLER: 'energy',
  FANCOIL: 'energy',
  BOMBA_CAG: 'energy',
  '3F_MEDIDOR': 'energy',
  HIDROMETRO: 'water',
  CAIXA_DAGUA: 'water',
  TANK: 'water',
  SELETOR_AUTO_MANUAL: 'other',
  TERMOSTATO: 'other',
  SOLENOIDE: 'other',
  GLOBAL_AUTOMACAO: 'other',
  'CONTROLE REMOTO': 'other',
};

/**
 * Returns suggested device profiles for a given device type
 *
 * @param deviceType - The device type
 * @returns Array of valid device profile options
 */
export function getSuggestedProfiles(deviceType: InferredDeviceType): string[] {
  if (deviceType === '3F_MEDIDOR') {
    return [
      '3F_MEDIDOR',
      'CHILLER',
      'TRAFO',
      'ENTRADA',
      'FANCOIL',
      'BOMBA_CAG',
      'BOMBA_INCENDIO',
      'BOMBA_HIDRAULICA',
      'ELEVADOR',
      'ESCADA_ROLANTE',
    ];
  }

  if (deviceType === 'HIDROMETRO') {
    return ['HIDROMETRO', 'HIDROMETRO_AREA_COMUM', 'HIDROMETRO_SHOPPING'];
  }

  // Default: suggest same as deviceType
  return [deviceType];
}

/**
 * Returns a suggested identifier based on device type
 *
 * @param deviceType - The device type
 * @returns Suggested identifier category
 */
export function getSuggestedIdentifier(deviceType: InferredDeviceType): string {
  const identifierMap: Partial<Record<InferredDeviceType, string>> = {
    ESCADA_ROLANTE: 'ESCADAS_ROLANTES',
    ELEVADOR: 'ELEVADORES',
    BOMBA_CAG: 'CAG',
    ENTRADA: 'ENTRADA',
  };

  return identifierMap[deviceType] || '';
}
