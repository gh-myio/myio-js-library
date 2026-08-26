import { describe, it, expect } from 'vitest';
import {
  decodeDeviceProductCode,
  formatDeviceProductCode,
  deviceProductCodeToName,
  deviceNameToDeviceProductCode,
  validateDeviceProductName,
  DeviceProductCodeError,
} from '../../../../src/utils/devices/device-product-code';

// Transcribed verbatim from gcdr.git/docs/specs/rules-devices-code/v2/DEVICE-NAME-SPEC.md
// §6 "Worked examples". Any future edit to those worked examples requires a
// matching fixture update here in the same PR.
const GOLDEN_FIXTURES: Array<{ code: string; name: string }> = [
  { code: '17.2.25.15', name: '3F 270102-0025' },
  { code: '1.1.1.12', name: 'HIDR 260101-0001' },
  { code: '1.34.10.15', name: '3F 260102-0264' },
  { code: '252.1.254.14', name: 'REM 411201-0254' },
];

describe('RFC-0230 name.ts — golden fixtures (DEVICE-NAME-SPEC.md §6)', () => {
  for (const { code, name } of GOLDEN_FIXTURES) {
    it(`${code} <-> ${name}`, () => {
      const decoded = decodeDeviceProductCode(code);
      expect(deviceProductCodeToName(decoded)).toBe(name);

      const fromName = deviceNameToDeviceProductCode(name);
      expect(fromName).toEqual(decoded);
      expect(formatDeviceProductCode(fromName)).toBe(code);
    });
  }
});

describe('RFC-0230 name.ts — space-vs-hyphen guardrail', () => {
  it('rejects a hyphen after the prefix (must stay a space, per attributes-sync.js word-boundary matching)', () => {
    expect(() => deviceNameToDeviceProductCode('3F-270102-0025')).toThrow(DeviceProductCodeError);
    expect(validateDeviceProductName('3F-270102-0025').valid).toBe(false);
    expect(validateDeviceProductName('3F-270102-0025').reason).toBe('invalid-name-shape');
  });

  it('accepts the correctly space-separated form', () => {
    expect(validateDeviceProductName('3F 270102-0025').valid).toBe(true);
  });
});

describe('RFC-0230 name.ts — functional-prefix non-invertibility', () => {
  it('a functional-keyword prefix fails deviceNameToDeviceProductCode with a typed, non-silent error', () => {
    expect(() => deviceNameToDeviceProductCode('COMPRESSOR 270102-0025')).toThrow(DeviceProductCodeError);
    try {
      deviceNameToDeviceProductCode('COMPRESSOR 270102-0025');
      expect.fail('expected a throw');
    } catch (e) {
      expect(e).toBeInstanceOf(DeviceProductCodeError);
      expect((e as InstanceType<typeof DeviceProductCodeError>).reason).toBe('non-invertible-prefix');
    }
  });
});
