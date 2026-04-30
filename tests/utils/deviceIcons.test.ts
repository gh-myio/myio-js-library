import { describe, it, expect } from 'vitest';
import {
  DeviceIconType,
  deviceIcons,
  deviceIconLabels,
  DEFAULT_DEVICE_ICON,
  getDeviceIcon,
  isDeviceIconType,
} from '../../src/utils/deviceIcons';

describe('RFC-0200 deviceIcons utility', () => {
  // Test 1: Every DeviceIconType key has a corresponding deviceIcons URL
  // and deviceIconLabels entry — no orphans in either map.
  describe('Test 1: map completeness — no orphan keys', () => {
    it('every DeviceIconType value has a corresponding deviceIcons URL', () => {
      const typeValues = Object.values(DeviceIconType);
      for (const value of typeValues) {
        expect(deviceIcons).toHaveProperty(value);
        expect(typeof deviceIcons[value]).toBe('string');
        expect(deviceIcons[value].length).toBeGreaterThan(0);
      }
    });

    it('every DeviceIconType value has a corresponding deviceIconLabels entry', () => {
      const typeValues = Object.values(DeviceIconType);
      for (const value of typeValues) {
        expect(deviceIconLabels).toHaveProperty(value);
        expect(typeof deviceIconLabels[value]).toBe('string');
        expect(deviceIconLabels[value].length).toBeGreaterThan(0);
      }
    });

    it('deviceIcons has no extra keys beyond DeviceIconType values', () => {
      const allowed = new Set(Object.values(DeviceIconType));
      for (const key of Object.keys(deviceIcons)) {
        expect(allowed.has(key as (typeof DeviceIconType)[keyof typeof DeviceIconType])).toBe(
          true,
        );
      }
    });

    it('deviceIconLabels has no extra keys beyond DeviceIconType values', () => {
      const allowed = new Set(Object.values(DeviceIconType));
      for (const key of Object.keys(deviceIconLabels)) {
        expect(allowed.has(key as (typeof DeviceIconType)[keyof typeof DeviceIconType])).toBe(
          true,
        );
      }
    });

    it('the const-as-const enum exposes the expected 18 entries', () => {
      expect(Object.keys(DeviceIconType).length).toBe(18);
      expect(Object.keys(deviceIcons).length).toBe(18);
      expect(Object.keys(deviceIconLabels).length).toBe(18);
    });
  });

  // Test 2: getDeviceIcon is case-insensitive
  describe('Test 2: getDeviceIcon is case-insensitive', () => {
    it("'fancoil', 'FANCOIL', and 'Fancoil' all resolve to the same URL", () => {
      const lower = getDeviceIcon('fancoil');
      const upper = getDeviceIcon('FANCOIL');
      const mixed = getDeviceIcon('Fancoil');
      expect(lower).toBe(upper);
      expect(upper).toBe(mixed);
      expect(lower).toBe(deviceIcons.FANCOIL);
    });

    it('case-insensitive lookup also works for HIDROMETRO_AREA_COMUM', () => {
      expect(getDeviceIcon('hidrometro_area_comum')).toBe(
        deviceIcons.HIDROMETRO_AREA_COMUM,
      );
      expect(getDeviceIcon('HiDrOmEtRo_ArEa_CoMuM')).toBe(
        deviceIcons.HIDROMETRO_AREA_COMUM,
      );
    });
  });

  // Test 3: getDeviceIcon falls back to DEFAULT_DEVICE_ICON for null/undefined/''/unknown
  describe('Test 3: getDeviceIcon fallback semantics', () => {
    it('falls back for null', () => {
      expect(getDeviceIcon(null)).toBe(DEFAULT_DEVICE_ICON);
    });

    it('falls back for undefined', () => {
      expect(getDeviceIcon(undefined)).toBe(DEFAULT_DEVICE_ICON);
    });

    it('falls back for empty string', () => {
      expect(getDeviceIcon('')).toBe(DEFAULT_DEVICE_ICON);
    });

    it('falls back for unknown strings', () => {
      expect(getDeviceIcon('NOT_A_REAL_TYPE')).toBe(DEFAULT_DEVICE_ICON);
      expect(getDeviceIcon('totally-unknown')).toBe(DEFAULT_DEVICE_ICON);
      expect(getDeviceIcon('   ')).toBe(DEFAULT_DEVICE_ICON);
    });

    it('falls back without arguments', () => {
      expect(getDeviceIcon()).toBe(DEFAULT_DEVICE_ICON);
    });
  });

  // Test 4: isDeviceIconType narrows valid strings and rejects invalid ones
  describe('Test 4: isDeviceIconType type guard', () => {
    it('returns true for canonical (uppercase) keys', () => {
      expect(isDeviceIconType('FANCOIL')).toBe(true);
      expect(isDeviceIconType('TERMOSTATO')).toBe(true);
      expect(isDeviceIconType('CAIXA_DAGUA')).toBe(true);
      expect(isDeviceIconType('3F_MEDIDOR')).toBe(true);
    });

    it('returns true for case-insensitive variants', () => {
      expect(isDeviceIconType('fancoil')).toBe(true);
      expect(isDeviceIconType('Termostato')).toBe(true);
      expect(isDeviceIconType('caixa_dagua')).toBe(true);
    });

    it('returns false for unknown strings', () => {
      expect(isDeviceIconType('NOT_A_TYPE')).toBe(false);
      expect(isDeviceIconType('')).toBe(false);
      expect(isDeviceIconType('random')).toBe(false);
      expect(isDeviceIconType('FANCOIL2')).toBe(false);
    });
  });

  // Test 5: '3F_MEDIDOR' round-trips through case-insensitive normalisation
  describe("Test 5: '3F_MEDIDOR' digit-prefix key round-trip", () => {
    it('resolves identically across case variations', () => {
      const upper = getDeviceIcon('3F_MEDIDOR');
      const lower = getDeviceIcon('3f_medidor');
      const mixed = getDeviceIcon('3f_Medidor');
      expect(upper).toBe(lower);
      expect(lower).toBe(mixed);
      expect(upper).toBe(deviceIcons['3F_MEDIDOR']);
    });

    it('isDeviceIconType accepts both cases of the digit-prefix key', () => {
      expect(isDeviceIconType('3F_MEDIDOR')).toBe(true);
      expect(isDeviceIconType('3f_medidor')).toBe(true);
      expect(isDeviceIconType('3f_Medidor')).toBe(true);
    });

    it('DeviceIconType.MEDIDOR_3F exposes the canonical 3F_MEDIDOR value', () => {
      expect(DeviceIconType.MEDIDOR_3F).toBe('3F_MEDIDOR');
      expect(deviceIconLabels[DeviceIconType.MEDIDOR_3F]).toBe('Medidor 3F');
    });
  });
});
