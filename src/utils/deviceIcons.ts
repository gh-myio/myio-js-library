/**
 * Device Icons Utilities (RFC-0200)
 *
 * Canonical mapping from device-type identifiers to static image URLs, plus
 * Portuguese display labels and helpers (`getDeviceIcon`, `isDeviceIconType`,
 * `DEFAULT_DEVICE_ICON`).
 *
 * Mirrors the shape of the mobile app's `core/devices/icons.ts`
 * (myio-app-5.2.0) so the two codebases can converge over time, while
 * keeping the library's existing asset host
 * (`dashboard.myio-bas.com/api/images/public/<token>`).
 *
 * @module deviceIcons
 * @see RFC-0200
 */

/**
 * Canonical device-type identifiers used as image keys.
 * Values match the strings emitted by ThingsBoard `deviceType` /
 * `deviceProfile` attributes (uppercase, snake_case where applicable).
 *
 * NOTE: this mirrors `myio-app-5.2.0/src/core/devices/icons.ts::DeviceIcon`.
 * Keep both in sync when adding new types.
 */
export const DeviceIconType = {
  ESCADA_ROLANTE: 'ESCADA_ROLANTE',
  ELEVADOR: 'ELEVADOR',
  MOTOR: 'MOTOR',
  BOMBA_HIDRAULICA: 'BOMBA_HIDRAULICA',
  BOMBA_CAG: 'BOMBA_CAG',
  BOMBA_INCENDIO: 'BOMBA_INCENDIO',
  BOMBA: 'BOMBA',
  MEDIDOR_3F: '3F_MEDIDOR',
  RELOGIO: 'RELOGIO',
  ENTRADA: 'ENTRADA',
  SUBESTACAO: 'SUBESTACAO',
  FANCOIL: 'FANCOIL',
  CHILLER: 'CHILLER',
  HIDROMETRO: 'HIDROMETRO',
  HIDROMETRO_AREA_COMUM: 'HIDROMETRO_AREA_COMUM',
  HIDROMETRO_SHOPPING: 'HIDROMETRO_SHOPPING',
  CAIXA_DAGUA: 'CAIXA_DAGUA',
  TERMOSTATO: 'TERMOSTATO',
} as const;

export type DeviceIconType =
  (typeof DeviceIconType)[keyof typeof DeviceIconType];

/** Static URL map (current opaque-token strategy). */
export const deviceIcons: Record<DeviceIconType, string> = {
  ESCADA_ROLANTE:        'https://dashboard.myio-bas.com/api/images/public/EJ997iB2HD1AYYUHwIloyQOOszeqb2jp',
  ELEVADOR:              'https://dashboard.myio-bas.com/api/images/public/rAjOvdsYJLGah6w6BABPJSD9znIyrkJX',
  MOTOR:                 'https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT',
  BOMBA_HIDRAULICA:      'https://dashboard.myio-bas.com/api/images/public/rbO2wQb6iKBtX0Ec04DFDcO3Qg04EOoD',
  BOMBA_CAG:             'https://dashboard.myio-bas.com/api/images/public/rbO2wQb6iKBtX0Ec04DFDcO3Qg04EOoD',
  BOMBA_INCENDIO:        'https://dashboard.myio-bas.com/api/images/public/YJkELCk9kluQSM6QXaFINX6byQWI7vbB',
  BOMBA:                 'https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT',
  '3F_MEDIDOR':          'https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k',
  RELOGIO:               'https://dashboard.myio-bas.com/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB',
  ENTRADA:               'https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU',
  SUBESTACAO:            'https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU',
  FANCOIL:               'https://dashboard.myio-bas.com/api/images/public/4BWMuVIFHnsfqatiV86DmTrOB7IF0X8Y',
  CHILLER:               'https://dashboard.myio-bas.com/api/images/public/27Rvy9HbNoPz8KKWPa0SBDwu4kQ827VU',
  HIDROMETRO:            'https://dashboard.myio-bas.com/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4',
  HIDROMETRO_AREA_COMUM: 'https://dashboard.myio-bas.com/api/images/public/IbEhjsvixAxwKg1ntGGZc5xZwwvGKv2t',
  HIDROMETRO_SHOPPING:   'https://dashboard.myio-bas.com/api/images/public/OIMmvN4ZTKYDvrpPGYY5agqMRoSaWNTI',
  CAIXA_DAGUA:           'https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq',
  TERMOSTATO:            'https://dashboard.myio-bas.com/api/images/public/rtCcq6kZZVCD7wgJywxEurRZwR8LA7Q7',
};

/** Friendly Portuguese labels for UI rendering (pickers, tooltips, captions). */
export const deviceIconLabels: Record<DeviceIconType, string> = {
  ESCADA_ROLANTE:        'Escada Rolante',
  ELEVADOR:              'Elevador',
  MOTOR:                 'Motor',
  BOMBA_HIDRAULICA:      'Bomba Hidráulica',
  BOMBA_CAG:             'Bomba CAG',
  BOMBA_INCENDIO:        'Bomba Incêndio',
  BOMBA:                 'Bomba',
  '3F_MEDIDOR':          'Medidor 3F',
  RELOGIO:               'Relógio',
  ENTRADA:               'Entrada',
  SUBESTACAO:            'Subestação',
  FANCOIL:               'Fancoil',
  CHILLER:               'Chiller',
  HIDROMETRO:            'Hidrômetro',
  HIDROMETRO_AREA_COMUM: 'Hidrômetro Área Comum',
  HIDROMETRO_SHOPPING:   'Hidrômetro Shopping',
  CAIXA_DAGUA:           "Caixa d'Água",
  TERMOSTATO:            'Termostato',
};

/** Default fallback URL when type is unknown or not yet mapped. */
export const DEFAULT_DEVICE_ICON =
  'https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k'; // generic 3F_MEDIDOR

/**
 * Resolves the static image URL for a given device type string.
 * Lookup is case-insensitive on the input; the canonical keys are uppercase.
 *
 * @param deviceType - typically `ctx.data` deviceType or deviceProfile attribute
 * @returns the mapped URL, or `DEFAULT_DEVICE_ICON` when not recognised
 */
export function getDeviceIcon(deviceType?: string | null): string {
  const key = String(deviceType || '').toUpperCase();
  return (deviceIcons as Record<string, string>)[key] ?? DEFAULT_DEVICE_ICON;
}

/** Type guard — narrows an arbitrary string to `DeviceIconType` if valid. */
export function isDeviceIconType(value: string): value is DeviceIconType {
  return value.toUpperCase() in deviceIcons;
}
