/**
 * RFC-0230 — product-type presentation helpers.
 *
 * Display-only companions to `productTypeRegistry`: a label and an image for
 * each product type byte, so UIs (pickers, generators, showcases) do not need
 * their own hardcoded copy of the registry. Nothing here participates in
 * encode/decode — the registry stays the only source for the lossless
 * code<->name conversion.
 */

import { listProductTypeEntries, getProductTypeEntryByByte } from './registry/productTypeRegistry';
import type { ProductTypeStatus } from './registry/productTypeRegistry';
import { DeviceIconType, deviceIcons, DEFAULT_DEVICE_ICON } from '../deviceIcons';

export interface DeviceProductTypeInfo {
  /** B4 — the product type byte. */
  readonly byte: number;
  /** Canonical device-name prefix (`HIDR`, `3F`, `BOX`, `CENTRAL`…). */
  readonly prefix: string;
  readonly status: ProductTypeStatus;
  /** Legacy/internal label for the byte, if any. */
  readonly legacyLabel?: string;
  /** Friendly pt-BR label for UI rendering. */
  readonly label: string;
  /** Image usable in an `<img src>`: a hosted URL or an inline `data:` SVG. */
  readonly icon: string;
}

/**
 * Product type byte -> presentation. `icon: null` means there is no dedicated
 * art for that type yet; it falls back to `DEFAULT_DEVICE_ICON`.
 */
const PRESENTATION: Readonly<Record<number, { label: string; icon: DeviceIconType | null }>> = {
  12: { label: 'Hidrômetro', icon: DeviceIconType.HIDROMETRO },
  // REM: no dedicated art and no confirmed friendly name yet — label stays the prefix.
  14: { label: 'REM', icon: null },
  15: { label: 'Medidor 3F', icon: DeviceIconType.MEDIDOR_3F },
  // Central (gateway hardware) reuses the existing GATEWAY art.
  20: { label: 'Central', icon: DeviceIconType.GATEWAY },
  50: { label: 'Box', icon: DeviceIconType.BOX },
};

function iconFor(byte: number): string {
  const key = PRESENTATION[byte]?.icon;
  return key ? deviceIcons[key] : DEFAULT_DEVICE_ICON;
}

/**
 * Image for a product type byte, usable directly in an `<img src>`.
 * Unregistered or art-less types return `DEFAULT_DEVICE_ICON`.
 */
export function getDeviceProductTypeIcon(productType: number): string {
  return iconFor(productType);
}

/**
 * Registered product types with their presentation, sorted by byte.
 * Returns `undefined` from `getDeviceProductTypeInfo` for an unregistered byte.
 */
export function listDeviceProductTypes(): DeviceProductTypeInfo[] {
  return listProductTypeEntries()
    .map((entry) => ({
      ...entry,
      label: PRESENTATION[entry.byte]?.label ?? entry.prefix,
      icon: iconFor(entry.byte),
    }))
    .sort((a, b) => a.byte - b.byte);
}

export function getDeviceProductTypeInfo(productType: number): DeviceProductTypeInfo | undefined {
  const entry = getProductTypeEntryByByte(productType);
  if (!entry) return undefined;
  return {
    ...entry,
    label: PRESENTATION[entry.byte]?.label ?? entry.prefix,
    icon: iconFor(entry.byte),
  };
}
