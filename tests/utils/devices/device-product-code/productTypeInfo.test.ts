import { describe, it, expect } from 'vitest';
import {
  getDeviceProductTypeIcon,
  getDeviceProductTypeInfo,
  listDeviceProductTypes,
} from '../../../../src/utils/devices/device-product-code';
import { listProductTypeEntries } from '../../../../src/utils/devices/device-product-code/registry/productTypeRegistry';
import {
  deviceIcons,
  DEFAULT_DEVICE_ICON,
  BOX_ICON_DATA_URI,
  getDeviceIcon,
} from '../../../../src/utils/devices/deviceIcons';

describe('RFC-0230 productTypeInfo — presentation helpers', () => {
  it('lists every registered product type, sorted by byte, with label and icon', () => {
    const types = listDeviceProductTypes();
    expect(types.map((t) => t.byte)).toEqual([12, 14, 15, 16, 17, 18, 20]);
    expect(types).toHaveLength(listProductTypeEntries().length);
    for (const t of types) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.icon.length).toBeGreaterThan(0);
    }
  });

  it('20 (CENTRAL) reuses the existing GATEWAY art', () => {
    expect(getDeviceProductTypeIcon(20)).toBe(deviceIcons.GATEWAY);
    expect(getDeviceProductTypeInfo(20)).toMatchObject({
      byte: 20,
      prefix: 'CENTRAL',
      status: 'draft',
      label: 'Central',
      icon: deviceIcons.GATEWAY,
    });
  });

  it('18 (BOX) resolves to the inline SVG placeholder', () => {
    const icon = getDeviceProductTypeIcon(18);
    expect(icon).toBe(BOX_ICON_DATA_URI);
    expect(icon.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);

    const svg = decodeURIComponent(icon.split(',')[1]);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).not.toMatch(/<script|on\w+=/i);
  });

  it('BOX is also available through the generic device icon map', () => {
    expect(getDeviceIcon('BOX')).toBe(BOX_ICON_DATA_URI);
    expect(getDeviceIcon('box')).toBe(BOX_ICON_DATA_URI);
  });

  it('a type without dedicated art (14 REM) and an unregistered byte fall back to the default icon', () => {
    expect(getDeviceProductTypeIcon(14)).toBe(DEFAULT_DEVICE_ICON);
    expect(getDeviceProductTypeIcon(99)).toBe(DEFAULT_DEVICE_ICON);
    expect(getDeviceProductTypeInfo(99)).toBeUndefined();
  });
});
