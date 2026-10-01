import { describe, it, expect } from 'vitest';
import {
  encodeDeviceProductCode,
  decodeDeviceProductCode,
  formatDeviceProductCode,
  deviceProductCodeToName,
  deviceNameToDeviceProductCode,
} from '../../../../src/utils/devices/device-product-code';
import {
  getProductTypeEntryByByte,
  getProductTypeEntryByPrefix,
  listProductTypeEntries,
} from '../../../../src/utils/devices/device-product-code/registry/productTypeRegistry';

describe('RFC-0230 productTypeRegistry', () => {
  it('has 7 entries: 12/14/15/16/17/18/20', () => {
    expect(listProductTypeEntries()).toHaveLength(7);
    expect(listProductTypeEntries().map((e) => e.byte).sort((a, b) => a - b)).toEqual([12, 14, 15, 16, 17, 18, 20]);
  });

  it('20 (CENTRAL) is a known type-byte, flagged draft, and round-trips code <-> name', () => {
    expect(getProductTypeEntryByByte(20)).toEqual({ byte: 20, prefix: 'CENTRAL', status: 'draft' });
    expect(getProductTypeEntryByPrefix('CENTRAL')?.byte).toBe(20);

    const input = { year: 2026, month: 1, day: 1, seq3: 0, seq: 1, productType: 20 };
    const value = encodeDeviceProductCode(input);
    expect(formatDeviceProductCode(value)).toBe('1.1.1.20');

    const name = deviceProductCodeToName(value);
    expect(name).toBe('CENTRAL 260101-0001');
    expect(name.startsWith('T20')).toBe(false);

    expect(deviceNameToDeviceProductCode(name)).toEqual(value);
    expect(decodeDeviceProductCode('1.1.1.20')).toEqual(value);
  });

  it('19 stays unregistered (reserved in GCDR for BOX_GROUP) — falls back to T19', () => {
    expect(getProductTypeEntryByByte(19)).toBeUndefined();
    const value = encodeDeviceProductCode({ year: 2026, month: 1, day: 1, seq3: 0, seq: 1, productType: 19 });
    expect(deviceProductCodeToName(value).startsWith('T19 ')).toBe(true);
  });

  it('12 decodes/encodes to prefix HIDR — never the legacy "switch" label', () => {
    const entry = getProductTypeEntryByByte(12);
    expect(entry?.prefix).toBe('HIDR');
    expect(entry?.legacyLabel).toBe('switch');
    expect(getProductTypeEntryByPrefix('switch')).toBeUndefined();

    const value = encodeDeviceProductCode({ year: 2026, month: 1, day: 1, seq3: 0, seq: 1, productType: 12 });
    const name = deviceProductCodeToName(value);
    expect(name.startsWith('HIDR ')).toBe(true);
  });

  it('18 (BOX) is a known, ratified type-byte — decodes as BOX, not the T{B4} fallback', () => {
    const entry = getProductTypeEntryByByte(18);
    expect(entry).toEqual({ byte: 18, prefix: 'BOX', status: 'ratified' });

    const value = encodeDeviceProductCode({ year: 2026, month: 1, day: 1, seq3: 0, seq: 1, productType: 18 });
    const name = deviceProductCodeToName(value);
    expect(name.startsWith('BOX ')).toBe(true);
    expect(name.startsWith('T18')).toBe(false);
  });

  it('16 (TEMP) and 17 (TANK) round-trip correctly while still flagged draft', () => {
    expect(getProductTypeEntryByByte(16)).toEqual({ byte: 16, prefix: 'TEMP', status: 'draft' });
    expect(getProductTypeEntryByByte(17)).toEqual({ byte: 17, prefix: 'TANK', status: 'draft' });

    const temp = encodeDeviceProductCode({ year: 2026, month: 1, day: 1, seq3: 0, seq: 1, productType: 16 });
    expect(deviceProductCodeToName(temp).startsWith('TEMP ')).toBe(true);
    const tank = encodeDeviceProductCode({ year: 2026, month: 1, day: 1, seq3: 0, seq: 1, productType: 17 });
    expect(deviceProductCodeToName(tank).startsWith('TANK ')).toBe(true);
  });

  it('an unregistered byte falls through to the T{B4} fallback prefix', () => {
    expect(getProductTypeEntryByByte(99)).toBeUndefined();
    const value = encodeDeviceProductCode({ year: 2026, month: 1, day: 1, seq3: 0, seq: 1, productType: 99 });
    const name = deviceProductCodeToName(value);
    expect(name.startsWith('T99 ')).toBe(true);
  });
});
