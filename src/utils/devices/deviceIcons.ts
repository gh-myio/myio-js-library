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
  TRANSFORMADOR: 'TRANSFORMADOR',
  FANCOIL: 'FANCOIL',
  CHILLER: 'CHILLER',
  HIDROMETRO: 'HIDROMETRO',
  HIDROMETRO_AREA_COMUM: 'HIDROMETRO_AREA_COMUM',
  HIDROMETRO_SHOPPING: 'HIDROMETRO_SHOPPING',
  CAIXA_DAGUA: 'CAIXA_DAGUA',
  TERMOSTATO: 'TERMOSTATO',
  COMPRESSOR: 'COMPRESSOR',
  VENTILADOR: 'VENTILADOR',
  SOLENOIDE: 'SOLENOIDE',
  GATEWAY: 'GATEWAY',
  BOX: 'BOX',
} as const;

export type DeviceIconType =
  (typeof DeviceIconType)[keyof typeof DeviceIconType];

/**
 * BOX (device enclosure, RFC-0058 / product type 18): no uploaded art asset yet.
 * Initial hand-drawn placeholder (a cardboard box in perspective), inlined as a data URI so it works in an
 * `<img src>` exactly like the hosted icons. Replace with the hosted asset
 * once one is uploaded.
 */
const BOX_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" stroke-linejoin="round">' +
  '<ellipse cx="48" cy="85" rx="36" ry="5" fill="#000" opacity=".08"/>' +
  // top, left (short) face, right (long) face
  '<polygon points="12,40 56,22 84,36 40,54" fill="#E3BC85" stroke="#7A5527" stroke-width="2"/>' +
  '<polygon points="12,40 40,54 40,84 12,70" fill="#C99A5B" stroke="#7A5527" stroke-width="2"/>' +
  '<polygon points="40,54 84,36 84,66 40,84" fill="#B5823F" stroke="#7A5527" stroke-width="2"/>' +
  // packing tape over the top seam, folding down the short face
  '<polygon points="22.6,45.3 66.6,27.3 73.4,30.7 29.4,48.7" fill="#F3DDB0"/>' +
  '<polygon points="22.6,45.3 29.4,48.7 29.4,59 22.6,55.6" fill="#E6CB96"/>' +
  '<path d="M26 47L70 29" stroke="#7A5527" stroke-width="1" opacity=".55"/>' +
  // shipping label on the long face
  '<polygon points="64.2,59.1 77.4,53.7 77.4,62.7 64.2,68.1" fill="#FBF6EC" stroke="#7A5527" stroke-width="1"/>' +
  '<path d="M66.6 61.4l8.6-3.5M66.6 64.6l5.6-2.3" stroke="#7A5527" stroke-width="1.2" stroke-linecap="round"/>' +
  '</svg>';

/** `data:` URI of the BOX placeholder — usable anywhere a hosted icon URL is. */
export const BOX_ICON_DATA_URI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(BOX_ICON_SVG);

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
  // TRANSFORMADOR (RFC-0234): no dedicated art asset yet — shares ENTRADA/SUBESTACAO's
  // icon until a distinct one is uploaded. Explicit entry (not DEFAULT_DEVICE_ICON
  // fallback) so it's visually grouped with the meters it's electrically closest to.
  TRANSFORMADOR:         'https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU',
  FANCOIL:               'https://dashboard.myio-bas.com/api/images/public/4BWMuVIFHnsfqatiV86DmTrOB7IF0X8Y',
  CHILLER:               'https://dashboard.myio-bas.com/api/images/public/27Rvy9HbNoPz8KKWPa0SBDwu4kQ827VU',
  HIDROMETRO:            'https://dashboard.myio-bas.com/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4',
  HIDROMETRO_AREA_COMUM: 'https://dashboard.myio-bas.com/api/images/public/IbEhjsvixAxwKg1ntGGZc5xZwwvGKv2t',
  HIDROMETRO_SHOPPING:   'https://dashboard.myio-bas.com/api/images/public/OIMmvN4ZTKYDvrpPGYY5agqMRoSaWNTI',
  CAIXA_DAGUA:           'https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq',
  TERMOSTATO:            'https://dashboard.myio-bas.com/api/images/public/rtCcq6kZZVCD7wgJywxEurRZwR8LA7Q7',
  // COMPRESSOR shares FANCOIL art; VENTILADOR shares MOTOR/BOMBA art (single static icons, no on/off variation).
  COMPRESSOR:            'https://dashboard.myio-bas.com/api/images/public/4BWMuVIFHnsfqatiV86DmTrOB7IF0X8Y',
  VENTILADOR:            'https://dashboard.myio-bas.com/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT',
  // SOLENOIDE: single representative (on); dynamic on/off/offline lives in solenoid-control SOLENOID_IMAGES.
  SOLENOIDE:             'https://dashboard.myio-bas.com/api/images/public/Tnq47Vd1TxhhqhYoHvzS73WVh1X84fPa',
  // GATEWAY: central/gateway hardware (OrangePi) — used by SettingsModalView's
  // "Central" tab identity card. Previously fell through to DEFAULT_DEVICE_ICON.
  GATEWAY:               'https://dashboard.myio-bas.com/api/images/public/kNlazDO8Yy90R5O12i17EqkQUFsNj44b',
  // BOX: device enclosure (RFC-0058). Inline SVG placeholder until a hosted asset exists.
  BOX:                   BOX_ICON_DATA_URI,
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
  TRANSFORMADOR:         'Transformador',
  FANCOIL:               'Fancoil',
  CHILLER:               'Chiller',
  HIDROMETRO:            'Hidrômetro',
  HIDROMETRO_AREA_COMUM: 'Hidrômetro Área Comum',
  HIDROMETRO_SHOPPING:   'Hidrômetro Shopping',
  CAIXA_DAGUA:           "Caixa d'Água",
  TERMOSTATO:            'Termostato',
  COMPRESSOR:            'Compressor',
  VENTILADOR:            'Ventilador',
  SOLENOIDE:             'Solenoide',
  GATEWAY:               'Gateway',
  BOX:                   'Box',
};

/** Default fallback URL when type is unknown or not yet mapped. */
export const DEFAULT_DEVICE_ICON =
  'https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k'; // generic 3F_MEDIDOR

/**
 * Resolves the static image URL for a given device profile string.
 * Lookup is case-insensitive on the input; the canonical keys are uppercase.
 *
 * @param deviceProfile - o attr `deviceProfile` do device (deviceType está em desuso)
 * @returns the mapped URL, or `DEFAULT_DEVICE_ICON` when not recognised
 */
export function getDeviceIcon(deviceProfile?: string | null): string {
  const key = String(deviceProfile || '').toUpperCase();
  return (deviceIcons as Record<string, string>)[key] ?? DEFAULT_DEVICE_ICON;
}

/** Type guard — narrows an arbitrary string to `DeviceIconType` if valid. */
export function isDeviceIconType(value: string): value is DeviceIconType {
  return value.toUpperCase() in deviceIcons;
}
