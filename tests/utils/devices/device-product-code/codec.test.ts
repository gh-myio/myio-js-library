import { describe, it, expect } from 'vitest';
import {
  encodeDeviceProductCode,
  decodeDeviceProductCode,
  formatDeviceProductCode,
  DeviceProductCodeError,
} from '../../../../src/utils/devices/device-product-code';
import type { DeviceProductCodeFields } from '../../../../src/utils/devices/device-product-code';

const YEARS = [2026, 2027, 2033, 2041];
const MONTHS = [1, 6, 12];
const DAYS = [1, 15, 31];
const SEQ3S = [0, 4, 7];
const SEQS = [1, 127, 254];
const PRODUCT_TYPES = [12, 14, 15, 16, 17, 18, 99]; // 99 is an intentionally unregistered byte

function fieldsFor(year: number, month: number, day: number, seq3: number, seq: number, productType: number): DeviceProductCodeFields {
  return { year, month, day, seq3, seq, productType };
}

describe('RFC-0230 device-product-code — round-trip invariants', () => {
  it('decode(encode/format(x)) === x across a deterministic enumeration of the valid domain', () => {
    for (const year of YEARS) {
      for (const month of MONTHS) {
        for (const day of DAYS) {
          for (const seq3 of SEQ3S) {
            for (const seq of SEQS) {
              for (const productType of PRODUCT_TYPES) {
                const fields = fieldsFor(year, month, day, seq3, seq, productType);
                const value = encodeDeviceProductCode(fields);
                const code = formatDeviceProductCode(value);
                const decoded = decodeDeviceProductCode(code);
                expect(decoded).toEqual(value);
                expect(decoded).toEqual(fields);
              }
            }
          }
        }
      }
    }
  });

  it('decode(encode/format(x)) === x across a bounded random-sampling loop', () => {
    for (let i = 0; i < 500; i++) {
      const fields = fieldsFor(
        2026 + Math.floor(Math.random() * 16),
        1 + Math.floor(Math.random() * 12),
        1 + Math.floor(Math.random() * 31),
        Math.floor(Math.random() * 8),
        1 + Math.floor(Math.random() * 254),
        Math.floor(Math.random() * 256),
      );
      const value = encodeDeviceProductCode(fields);
      const code = formatDeviceProductCode(value);
      expect(decodeDeviceProductCode(code)).toEqual(fields);
    }
  });

  it('matches the worked example from DEVICE-NAME-SPEC.md §6', () => {
    const code = decodeDeviceProductCode('17.2.25.15');
    expect(code).toEqual({ year: 2027, month: 1, day: 2, seq3: 0, seq: 25, productType: 15 });
  });
});

describe('RFC-0230 device-product-code — boundary years', () => {
  it('accepts both edges of the valid 2026-2041 range', () => {
    expect(() => encodeDeviceProductCode(fieldsFor(2026, 1, 1, 0, 1, 15))).not.toThrow();
    expect(() => encodeDeviceProductCode(fieldsFor(2041, 12, 31, 7, 254, 15))).not.toThrow();
  });

  it('rejects both sides of the boundary, not just the ceiling', () => {
    expect(() => encodeDeviceProductCode(fieldsFor(2025, 1, 1, 0, 1, 15))).toThrow(DeviceProductCodeError);
    expect(() => encodeDeviceProductCode(fieldsFor(2042, 1, 1, 0, 1, 15))).toThrow(DeviceProductCodeError);
  });
});
