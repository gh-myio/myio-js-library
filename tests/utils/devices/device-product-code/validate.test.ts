import { describe, it, expect } from 'vitest';
import {
  validateDeviceProductCode,
  validateDeviceProductName,
  encodeDeviceProductCode,
  DeviceProductCodeError,
} from '../../../../src/utils/devices/device-product-code';

function baseCode(overrides: { b1?: number; b2?: number; b3?: number; b4?: number } = {}): string {
  // year 2027 (offset 1), month 1 -> B1=17; seq3=0, day=2 -> B2=2; seq=25 -> B3=25; productType 15 -> B4=15
  const b1 = overrides.b1 ?? 17;
  const b2 = overrides.b2 ?? 2;
  const b3 = overrides.b3 ?? 25;
  const b4 = overrides.b4 ?? 15;
  return `${b1}.${b2}.${b3}.${b4}`;
}

describe('RFC-0230 validateDeviceProductCode — malformed inputs, full branch coverage', () => {
  it('accepts a well-formed code', () => {
    expect(validateDeviceProductCode(baseCode()).valid).toBe(true);
  });

  it('rejects a code that is not 4 dotted bytes', () => {
    const r = validateDeviceProductCode('17.2.25');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('invalid-code-shape');
  });

  it('rejects a byte out of 0-255', () => {
    const r = validateDeviceProductCode('300.2.25.15');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('invalid-code-shape');
  });

  it('month 0 and 13 are both rejected', () => {
    // month 0 -> B1 low nibble 0 -> B1 = (1<<4)|0 = 16
    expect(validateDeviceProductCode(baseCode({ b1: 16 })).reason).toBe('month-out-of-range');
    // month 13 -> B1 low nibble 13 -> B1 = (1<<4)|13 = 29
    expect(validateDeviceProductCode(baseCode({ b1: 29 })).reason).toBe('month-out-of-range');
  });

  it('day 0 is rejected (reachable via decode: B2 low 5 bits can hold 0)', () => {
    // day 0, seq3 0 -> B2 = 0
    expect(validateDeviceProductCode(baseCode({ b2: 0 })).reason).toBe('day-out-of-range');
  });

  it('day 32 is rejected at the field-encoding layer (unreachable via decode — B2 low 5 bits max out at 31)', () => {
    expect(() =>
      encodeDeviceProductCode({ year: 2027, month: 1, day: 32, seq3: 0, seq: 25, productType: 15 }),
    ).toThrow(DeviceProductCodeError);
  });

  it('seq3 out of 0-7 is rejected at the field-encoding layer (a raw decoded byte can never produce it — b2>>5 is masked to 3 bits)', () => {
    expect(() =>
      encodeDeviceProductCode({ year: 2027, month: 1, day: 2, seq3: 8, seq: 25, productType: 15 }),
    ).toThrow(DeviceProductCodeError);
    expect(() =>
      encodeDeviceProductCode({ year: 2027, month: 1, day: 2, seq3: -1, seq: 25, productType: 15 }),
    ).toThrow(DeviceProductCodeError);
  });

  it('seq 0 and 255 are both rejected (reserved)', () => {
    expect(validateDeviceProductCode(baseCode({ b3: 0 })).reason).toBe('seq-out-of-range');
    expect(validateDeviceProductCode(baseCode({ b3: 255 })).reason).toBe('seq-out-of-range');
  });

  it('unknown product-type byte is still a structurally valid code (registry membership is a name-layer concern)', () => {
    expect(validateDeviceProductCode(baseCode({ b4: 250 })).valid).toBe(true);
  });
});

describe('RFC-0230 validateDeviceProductName — malformed inputs, full branch coverage', () => {
  it('accepts a well-formed name', () => {
    expect(validateDeviceProductName('3F 270102-0025').valid).toBe(true);
  });

  it('rejects a lowercase prefix', () => {
    const r = validateDeviceProductName('3f 270102-0025');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('invalid-name-shape');
  });

  it('rejects a prefix longer than 12 chars', () => {
    const r = validateDeviceProductName('ABCDEFGHIJKLM 270102-0025');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('invalid-name-shape');
  });

  it('rejects a missing digit group (date or unit)', () => {
    expect(validateDeviceProductName('3F 27010-0025').valid).toBe(false);
    expect(validateDeviceProductName('3F 270102-025').valid).toBe(false);
  });

  it('rejects an unrecognized prefix that also does not match the T{B4} fallback shape', () => {
    const r = validateDeviceProductName('ZZ 270102-0025');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('unknown-prefix');
  });

  it('accepts the T{B4} fallback prefix for an unregistered byte', () => {
    expect(validateDeviceProductName('T250 270102-0025').valid).toBe(true);
  });

  it('rejects NNNN out of 0001-2032', () => {
    expect(validateDeviceProductName('3F 270102-0000').reason).toBe('unit-out-of-range');
    expect(validateDeviceProductName('3F 270102-2033').reason).toBe('unit-out-of-range');
  });
});
