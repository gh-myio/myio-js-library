/**
 * RFC-0176: GCDR Sync Modal — TB type → GCDR enum mapping + slugify
 */

// ============================================================================
// Asset Type Mapping
// ============================================================================

/** Maps TB asset type keywords → GCDR asset type enum */
const TB_ASSET_TYPE_MAP: Array<{ keywords: string[]; gcdrType: string }> = [
  { keywords: ['shopping', 'mall', 'site', 'campus'], gcdrType: 'SITE' },
  { keywords: ['building', 'predio', 'edificio'], gcdrType: 'BUILDING' },
  { keywords: ['floor', 'andar', 'pavimento'], gcdrType: 'FLOOR' },
  { keywords: ['room', 'sala', 'ambiente'], gcdrType: 'ROOM' },
  { keywords: ['zone', 'area', 'zona'], gcdrType: 'ZONE' },
];

/**
 * Maps a TB asset type string to a GCDR asset type enum value.
 * Matches keywords case-insensitively. Falls back to 'OTHER'.
 */
export function mapAssetType(tbType: string | undefined): string {
  if (!tbType) return 'OTHER';
  const lower = tbType.toLowerCase();
  for (const entry of TB_ASSET_TYPE_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.gcdrType;
    }
  }
  return 'OTHER';
}

// ============================================================================
// Device Type Mapping
// ============================================================================

/** Maps TB device type/profile keywords → GCDR device type enum */
const TB_DEVICE_TYPE_MAP: Array<{ keywords: string[]; gcdrType: string }> = [
  { keywords: ['escada_rolante', 'escalator', 'escada rolante'], gcdrType: 'ACTUATOR' },
  { keywords: ['elevador', 'elevator'], gcdrType: 'ACTUATOR' },
  { keywords: ['bomba', 'pump'], gcdrType: 'ACTUATOR' },
  { keywords: ['3f_medidor', 'medidor', 'meter'], gcdrType: 'METER' },
  { keywords: ['termostato', 'thermostat'], gcdrType: 'SENSOR' },
  { keywords: ['hidrometro', 'water_meter', 'hydrometer'], gcdrType: 'METER' },
  { keywords: ['chiller', 'hvac', 'fancoil', 'ar_condicionado', 'cag'], gcdrType: 'OTHER' },
  { keywords: ['gateway', 'central'], gcdrType: 'GATEWAY' },
];

/**
 * Maps TB device type/profile strings to a GCDR device type enum value.
 * Checks both type and profileName. Falls back to 'OTHER'.
 */
export function mapDeviceType(tbType: string | undefined, tbProfile?: string | undefined): string {
  const candidates = [tbType, tbProfile].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    for (const entry of TB_DEVICE_TYPE_MAP) {
      if (entry.keywords.some((kw) => lower.includes(kw))) {
        return entry.gcdrType;
      }
    }
  }
  return 'OTHER';
}

// ============================================================================
// Slugify
// ============================================================================

/**
 * Converts a text string to a URL-safe slug.
 * - Lowercases
 * - Removes accents/diacritics
 * - Replaces non-alphanumeric chars with hyphens
 * - Trims leading/trailing hyphens
 * - Truncates to maxLen (default 50)
 */
export function slugify(text: string, maxLen = 50): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '') // trim hyphens
    .substring(0, maxLen)
    .replace(/-+$/g, ''); // trim trailing hyphens after truncation
}
