/**
 * Device Type Config — single source of truth (RFC-0202)
 *
 * Consolidates the previously-duplicated `DEVICE_TYPE_CONFIG` maps that lived
 * inline in `template-card-v5.js`, `template-card-v6.js`, and the `IMAGES` map
 * in `SettingsModalView.ts`.
 *
 * Each entry carries:
 *  - `category`: the domain bucket used for filtering/grouping device cards.
 *  - `image`: the STATIC image URL for the type, or `null` when the type renders
 *    a DYNAMIC image (by status/level/state) handled by the consumer
 *    (e.g. TERMOSTATO by temperature, TANK by level, SOLENOIDE by on/off).
 *
 * Static URLs are NOT hard-coded here — they are referenced from the canonical
 * `deviceIcons` map (RFC-0200) so the opaque image tokens live in exactly one
 * place. `deviceIcons` always returns a concrete URL (even for TERMOSTATO);
 * this superset overrides those to `null` where the card needs dynamic art.
 *
 * @module deviceTypeConfig
 * @see RFC-0200 (deviceIcons — canonical URL map)
 * @see RFC-0202 (consumer migration of the four duplicate copies)
 */

import { deviceIcons } from './deviceIcons';

/** Domain bucket a device type belongs to. */
export type DeviceTypeCategory =
  | 'energy'
  | 'water'
  | 'temperature'
  | 'tank'
  | 'solenoid';

export interface DeviceTypeConfigEntry {
  category: DeviceTypeCategory;
  /** Static URL, or `null` for types rendered with a dynamic image. */
  image: string | null;
}

/**
 * Canonical device-type configuration.
 * `image` references `deviceIcons[type]` for static types; `null` marks types
 * whose image is computed dynamically by the consumer.
 */
export const DEVICE_TYPE_CONFIG: Record<string, DeviceTypeConfigEntry> = {
  // Energy devices
  COMPRESSOR: { category: 'energy', image: null },
  VENTILADOR: { category: 'energy', image: null },
  ESCADA_ROLANTE: { category: 'energy', image: deviceIcons.ESCADA_ROLANTE },
  ELEVADOR: { category: 'energy', image: deviceIcons.ELEVADOR },
  MOTOR: { category: 'energy', image: deviceIcons.MOTOR },
  BOMBA_HIDRAULICA: { category: 'energy', image: deviceIcons.BOMBA_HIDRAULICA },
  BOMBA_CAG: { category: 'energy', image: deviceIcons.BOMBA_CAG },
  BOMBA_INCENDIO: { category: 'energy', image: deviceIcons.BOMBA_INCENDIO },
  BOMBA: { category: 'energy', image: deviceIcons.BOMBA },
  '3F_MEDIDOR': { category: 'energy', image: deviceIcons['3F_MEDIDOR'] },
  RELOGIO: { category: 'energy', image: deviceIcons.RELOGIO },
  ENTRADA: { category: 'energy', image: deviceIcons.ENTRADA },
  SUBESTACAO: { category: 'energy', image: deviceIcons.SUBESTACAO },
  FANCOIL: { category: 'energy', image: deviceIcons.FANCOIL },
  CHILLER: { category: 'energy', image: deviceIcons.CHILLER },
  AR_CONDICIONADO: { category: 'energy', image: null },
  HVAC: { category: 'energy', image: null },

  // Water devices
  HIDROMETRO: { category: 'water', image: deviceIcons.HIDROMETRO },
  HIDROMETRO_AREA_COMUM: { category: 'water', image: deviceIcons.HIDROMETRO_AREA_COMUM },
  HIDROMETRO_SHOPPING: { category: 'water', image: deviceIcons.HIDROMETRO_SHOPPING },
  CAIXA_DAGUA: { category: 'water', image: deviceIcons.CAIXA_DAGUA },

  // Tank devices (dynamic images based on level)
  TANK: { category: 'tank', image: null },

  // Temperature devices (dynamic images based on status)
  TERMOSTATO: { category: 'temperature', image: null },

  // Solenoid devices (dynamic images based on on/off state)
  SOLENOIDE: { category: 'solenoid', image: null },
};

/**
 * Default fallback image when a type is unknown or maps to `null`.
 * NOTE: this is the historical card/SettingsModal flaticon default — distinct
 * from `deviceIcons` `DEFAULT_DEVICE_ICON` (which falls back to 3F_MEDIDOR).
 */
export const DEFAULT_DEVICE_IMAGE =
  'https://cdn-icons-png.flaticon.com/512/1178/1178428.png';

/** Resolves the domain category for a device PROFILE (default `'energy'`). deviceType em desuso. */
export function getDeviceCategory(deviceProfile?: string | null): DeviceTypeCategory {
  const normalizedType = String(deviceProfile || '').toUpperCase();
  return DEVICE_TYPE_CONFIG[normalizedType]?.category || 'energy';
}

/**
 * Resolves the STATIC image URL for a device PROFILE (deviceType em desuso),
 * falling back to the generic flaticon default. Returns the default for
 * dynamic-image types (image `null`).
 */
export function getStaticDeviceImage(deviceProfile?: string | null): string {
  const normalizedType = String(deviceProfile || '').toUpperCase();
  return DEVICE_TYPE_CONFIG[normalizedType]?.image || DEFAULT_DEVICE_IMAGE;
}

/** Returns the set of device-type keys belonging to a given category. */
export function getTypesByCategory(category: DeviceTypeCategory): Set<string> {
  return new Set(
    Object.entries(DEVICE_TYPE_CONFIG)
      .filter(([, cfg]) => cfg.category === category)
      .map(([type]) => type)
  );
}
