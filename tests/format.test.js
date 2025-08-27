import { describe, it, expect } from 'vitest';
import { formatEnergy, formatAllInSameUnit, fmtPerc } from '../src/index.ts';

describe('Format utilities', () => {
  describe('formatEnergy', () => {
    it('should format energy values with Brazilian locale', () => {
      expect(formatEnergy(1234.56, 'kWh')).toBe('1.234,56 kWh');
      expect(formatEnergy(1000, 'MWh')).toBe('1.000,00 MWh');
    });

    it('should handle null/undefined values', () => {
      expect(formatEnergy(null, 'kWh')).toBe('-');
      expect(formatEnergy(undefined, 'kWh')).toBe('-');
      expect(formatEnergy(NaN, 'kWh')).toBe('-');
    });
  });

  describe('formatAllInSameUnit', () => {
    it('should convert and format all values to the same unit', () => {
      const values = [
        { value: 1, unit: 'kWh' },
        { value: 1, unit: 'MWh' },
        { value: 1, unit: 'GWh' }
      ];
      
      const result = formatAllInSameUnit(values, 'kWh');
      expect(result).toEqual(['1,00 kWh', '1.000,00 kWh', '1.000.000,00 kWh']);
    });

    it('should handle null values in array', () => {
      const values = [
        { value: null, unit: 'kWh' },
        { value: 100, unit: 'kWh' }
      ];
      
      const result = formatAllInSameUnit(values, 'kWh');
      expect(result).toEqual(['-', '100,00 kWh']);
    });
  });

  describe('fmtPerc', () => {
    it('should format percentage values with Brazilian locale', () => {
      expect(fmtPerc(0.1234)).toBe('12,34%');
      expect(fmtPerc(0.5)).toBe('50,00%');
      expect(fmtPerc(1)).toBe('100,00%');
    });

    it('should handle null/undefined values', () => {
      expect(fmtPerc(null)).toBe('-');
      expect(fmtPerc(undefined)).toBe('-');
      expect(fmtPerc(NaN)).toBe('-');
    });

    it('should handle edge cases', () => {
      expect(fmtPerc(0.001)).toBe('0,10%');
      expect(fmtPerc(0)).toBe('0,00%');
      expect(fmtPerc(-0.1)).toBe('-10,00%');
      expect(fmtPerc(Infinity)).toBe('-');
      expect(fmtPerc(-Infinity)).toBe('-');
    });
  });
});
