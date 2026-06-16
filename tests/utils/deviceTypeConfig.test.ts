import { describe, it, expect } from 'vitest';
import {
  DEVICE_TYPE_CONFIG,
  DEFAULT_DEVICE_IMAGE,
  getDeviceCategory,
  getStaticDeviceImage,
  getTypesByCategory,
} from '../../src/utils/deviceTypeConfig';
import { deviceIcons } from '../../src/utils/deviceIcons';

describe('RFC-0202 deviceTypeConfig — single source of truth', () => {
  describe('config integrity', () => {
    it('every entry has a category and an image field (URL or null)', () => {
      for (const [type, cfg] of Object.entries(DEVICE_TYPE_CONFIG)) {
        expect(cfg, type).toHaveProperty('category');
        expect(cfg, type).toHaveProperty('image');
        expect(['energy', 'water', 'temperature', 'tank', 'solenoid']).toContain(cfg.category);
        expect(cfg.image === null || typeof cfg.image === 'string').toBe(true);
      }
    });

    it('static image URLs are sourced from deviceIcons (defined once)', () => {
      for (const [type, cfg] of Object.entries(DEVICE_TYPE_CONFIG)) {
        if (cfg.image !== null && type in deviceIcons) {
          expect(cfg.image, type).toBe((deviceIcons as Record<string, string>)[type]);
        }
      }
    });

    it('keeps dynamic-image types as null (TERMOSTATO / TANK / SOLENOIDE)', () => {
      expect(DEVICE_TYPE_CONFIG.TERMOSTATO.image).toBeNull();
      expect(DEVICE_TYPE_CONFIG.TANK.image).toBeNull();
      expect(DEVICE_TYPE_CONFIG.SOLENOIDE.image).toBeNull();
    });

    it('keeps null-image energy types (COMPRESSOR / VENTILADOR / AR_CONDICIONADO / HVAC)', () => {
      for (const t of ['COMPRESSOR', 'VENTILADOR', 'AR_CONDICIONADO', 'HVAC']) {
        expect(DEVICE_TYPE_CONFIG[t].image, t).toBeNull();
        expect(DEVICE_TYPE_CONFIG[t].category, t).toBe('energy');
      }
    });
  });

  describe('getDeviceCategory', () => {
    it('resolves known types case-insensitively', () => {
      expect(getDeviceCategory('hidrometro')).toBe('water');
      expect(getDeviceCategory('FANCOIL')).toBe('energy');
      expect(getDeviceCategory('Termostato')).toBe('temperature');
      expect(getDeviceCategory('SOLENOIDE')).toBe('solenoid');
      expect(getDeviceCategory('TANK')).toBe('tank');
    });

    it('defaults to energy for unknown / empty input', () => {
      expect(getDeviceCategory('NOPE')).toBe('energy');
      expect(getDeviceCategory('')).toBe('energy');
      expect(getDeviceCategory(null)).toBe('energy');
      expect(getDeviceCategory(undefined)).toBe('energy');
    });
  });

  describe('getStaticDeviceImage', () => {
    it('returns the static URL for static types', () => {
      expect(getStaticDeviceImage('FANCOIL')).toBe(deviceIcons.FANCOIL);
      expect(getStaticDeviceImage('hidrometro')).toBe(deviceIcons.HIDROMETRO);
    });

    it('falls back to the flaticon default for dynamic-image and unknown types', () => {
      expect(getStaticDeviceImage('TERMOSTATO')).toBe(DEFAULT_DEVICE_IMAGE);
      expect(getStaticDeviceImage('TANK')).toBe(DEFAULT_DEVICE_IMAGE);
      expect(getStaticDeviceImage('SOLENOIDE')).toBe(DEFAULT_DEVICE_IMAGE);
      expect(getStaticDeviceImage('NOPE')).toBe(DEFAULT_DEVICE_IMAGE);
      expect(getStaticDeviceImage(null)).toBe(DEFAULT_DEVICE_IMAGE);
      expect(DEFAULT_DEVICE_IMAGE).toContain('flaticon');
    });
  });

  describe('getTypesByCategory', () => {
    it('returns the set of types for each category', () => {
      expect(getTypesByCategory('water').has('HIDROMETRO')).toBe(true);
      expect(getTypesByCategory('water').has('FANCOIL')).toBe(false);
      expect(getTypesByCategory('temperature').has('TERMOSTATO')).toBe(true);
      expect(getTypesByCategory('solenoid').has('SOLENOIDE')).toBe(true);
      expect(getTypesByCategory('tank').has('TANK')).toBe(true);
    });

    it('energy set includes both static and null-image energy types', () => {
      const energy = getTypesByCategory('energy');
      expect(energy.has('FANCOIL')).toBe(true);
      expect(energy.has('COMPRESSOR')).toBe(true);
      expect(energy.has('3F_MEDIDOR')).toBe(true);
    });
  });
});
