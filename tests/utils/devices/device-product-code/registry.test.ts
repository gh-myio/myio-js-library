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
  it('has 5 entries: 12/14/15/20/50', () => {
    expect(listProductTypeEntries()).toHaveLength(5);
    expect(listProductTypeEntries().map((e) => e.byte).sort((a, b) => a - b)).toEqual([12, 14, 15, 20, 50]);
  });

  it('20 (CENTRAL) is a known, ratified type-byte and round-trips code <-> name', () => {
    expect(getProductTypeEntryByByte(20)).toEqual({ byte: 20, prefix: 'CENTRAL', status: 'ratified' });
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

  it('50 (BOX) is a known, ratified type-byte and round-trips code <-> name', () => {
    expect(getProductTypeEntryByByte(50)).toEqual({ byte: 50, prefix: 'BOX', status: 'ratified' });
    expect(getProductTypeEntryByPrefix('BOX')?.byte).toBe(50);

    const value = encodeDeviceProductCode({ year: 2026, month: 1, day: 1, seq3: 0, seq: 1, productType: 50 });
    expect(formatDeviceProductCode(value)).toBe('1.1.1.50');

    const name = deviceProductCodeToName(value);
    expect(name).toBe('BOX 260101-0001');
    expect(deviceNameToDeviceProductCode(name)).toEqual(value);
    expect(decodeDeviceProductCode('1.1.1.50')).toEqual(value);
  });

  it('16, 17 and 18 are no longer registered — they fall back to T{B4}', () => {
    // 16/17: thermostats and tank-level sensors are built on the switch (12).
    // 18: BOX moved to 50.
    for (const byte of [16, 17, 18]) {
      expect(getProductTypeEntryByByte(byte)).toBeUndefined();
      const value = encodeDeviceProductCode({ year: 2026, month: 1, day: 1, seq3: 0, seq: 1, productType: byte });
      expect(deviceProductCodeToName(value).startsWith(`T${byte} `)).toBe(true);
    }
    expect(getProductTypeEntryByPrefix('TEMP')).toBeUndefined();
    expect(getProductTypeEntryByPrefix('TANK')).toBeUndefined();
  });

  it('every registered entry is ratified — there is no draft byte left', () => {
    expect(listProductTypeEntries().every((e) => e.status === 'ratified')).toBe(true);
  });

  it('an unregistered byte falls through to the T{B4} fallback prefix', () => {
    expect(getProductTypeEntryByByte(99)).toBeUndefined();
    const value = encodeDeviceProductCode({ year: 2026, month: 1, day: 1, seq3: 0, seq: 1, productType: 99 });
    const name = deviceProductCodeToName(value);
    expect(name.startsWith('T99 ')).toBe(true);
  });
});
