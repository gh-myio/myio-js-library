/**
 * Asset naming & code utilities (RFC-0206, Phase 2).
 *
 * Cohesive per-entity module (mirrors `device.ts` / `customer.ts`) for:
 *
 *  - `generateAssetCode()`           — opaque asset code `A-<plate>-<plate>`.
 *  - `ASSET_TYPE_CONFIG` / `getAssetTypeConfig()` — framework-neutral asset-type
 *     metadata (icon NAME + color). Mirror of gcdr-frontend's
 *     `CustomerAssetsTab` `ASSET_TYPE_CONFIG`, but storing the lucide-react
 *     export name as a STRING (the library ships no React — UMD/ThingsBoard).
 *  - `applyCustomerCodeToAssetName()` / `assetLocalToken()` — name
 *     standardization (prefix an asset name with a customer code, idempotently).
 *
 * @module asset
 * @see RFC-0206
 */

import { generateMercosulPlate } from './devices/device';
import { CUSTOMER_CODE_RE } from './customer';

/**
 * Generates an opaque, collision-resistant asset code: `A-<plate>-<plate>`
 * (e.g. `A-XDN5R48-JQE6K43`).
 */
export function generateAssetCode(): string {
  return `A-${generateMercosulPlate()}-${generateMercosulPlate()}`;
}

/** Matches a well-formed asset code: `A-<plate>-<plate>`. */
export const ASSET_CODE_RE =
  /^A-[ABCDEFGHJKLMNPQRSTUVWXYZ]{3}[2-9][ABCDEFGHJKLMNPQRSTUVWXYZ][2-9]{2}-[ABCDEFGHJKLMNPQRSTUVWXYZ]{3}[2-9][ABCDEFGHJKLMNPQRSTUVWXYZ][2-9]{2}$/;

/** Returns `true` when `code` is a syntactically valid asset code. */
export function isAssetCode(code?: string | null): boolean {
  return typeof code === 'string' && ASSET_CODE_RE.test(code);
}

/** Canonical asset-type taxonomy (GCDR). */
export type AssetType =
  | 'LOCATION'
  | 'BUILDING'
  | 'FLOOR'
  | 'ROOM'
  | 'EQUIPMENT'
  | 'OTHER';

export interface AssetTypeConfigEntry {
  /** lucide-react export name, e.g. `'Settings2'` — NOT a component. */
  icon: string;
  /** Hex color, e.g. `'#ef4444'`. */
  color: string;
}

/**
 * Framework-neutral mirror of gcdr-frontend's `ASSET_TYPE_CONFIG`.
 * The `icon` is the lucide export NAME (string); React consumers map it to the
 * component at the call site (`const Icon = LUCIDE[cfg.icon]`).
 */
export const ASSET_TYPE_CONFIG: Record<AssetType, AssetTypeConfigEntry> = {
  LOCATION: { icon: 'MapPin', color: '#3b82f6' },
  BUILDING: { icon: 'Building2', color: '#8b5cf6' },
  FLOOR: { icon: 'Layers', color: '#f59e0b' },
  ROOM: { icon: 'DoorOpen', color: '#10b981' },
  EQUIPMENT: { icon: 'Settings2', color: '#ef4444' },
  OTHER: { icon: 'Box', color: '#6b7280' },
};

/**
 * Resolves the config entry for an asset type, falling back to `OTHER` for
 * unknown/empty input. Lookup is case-insensitive.
 */
export function getAssetTypeConfig(type?: string | null): AssetTypeConfigEntry {
  const key = String(type || '').toUpperCase() as AssetType;
  return ASSET_TYPE_CONFIG[key] ?? ASSET_TYPE_CONFIG.OTHER;
}

/**
 * Prefixes an asset name with a customer code for standardization, e.g.
 * `applyCustomerCodeToAssetName('Reservatorio Geral', 'C-XDN5R48-JQE6K43')`
 * -> `'C-XDN5R48-JQE6K43 Reservatorio Geral'`.
 *
 * Idempotent: if `assetName` already starts with `customerCode` (followed by a
 * space or end-of-string), it is returned unchanged. Empty `customerCode`
 * returns the trimmed asset name as-is.
 */
export function applyCustomerCodeToAssetName(
  assetName: string,
  customerCode: string
): string {
  const name = (assetName || '').trim();
  const code = (customerCode || '').trim();
  if (!code) return name;
  if (name === code || name.startsWith(`${code} `)) return name;
  return name ? `${code} ${name}` : code;
}

/**
 * Extracts the "local" token of an asset name by stripping a leading customer
 * code prefix, if present. Inverse of {@link applyCustomerCodeToAssetName} for
 * re-standardization.
 *
 * `assetLocalToken('C-XDN5R48-JQE6K43 Reservatorio Geral')` -> `'Reservatorio Geral'`.
 * Names without a recognizable customer-code prefix are returned trimmed, as-is.
 */
export function assetLocalToken(assetName: string): string {
  const name = (assetName || '').trim();
  const spaceIdx = name.indexOf(' ');
  if (spaceIdx === -1) return name;
  const head = name.slice(0, spaceIdx);
  if (CUSTOMER_CODE_RE.test(head)) {
    return name.slice(spaceIdx + 1).trim();
  }
  return name;
}
