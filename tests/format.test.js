import { describe, it, expect } from 'vitest';
import { formatEnergy, formatAllInSameUnit, fmtPerc } from '../src/index.ts';

describe('Format utilities', () => {
  describe('formatEnergy', () => {
    it('should format energy values with Brazilian locale and explicit unit', () => {
      expect(formatEnergy(1234.56, 'kWh')).toBe('1.234,56 kWh');
      expect(formatEnergy(1000, 'MWh')).toBe('1.000,00 MWh');
      expect(formatEnergy(2500000, 'GWh')).toBe('2.500.000,00 GWh');
    });

    it('should auto-select appropriate unit when no unit provided', () => {
      // Values < 1,000 should use kWh
      expect(formatEnergy(500)).toBe('500,00 kWh');
      expect(formatEnergy(999.99)).toBe('999,99 kWh');
      
      // Values >= 1,000 and < 1,000,000 should convert to MWh
      expect(formatEnergy(1000)).toBe('1,00 MWh');
      expect(formatEnergy(1500)).toBe('1,50 MWh');
      expect(formatEnergy(999999)).toBe('1.000,00 MWh');
      
      // Values >= 1,000,000 should convert to GWh
      expect(formatEnergy(1000000)).toBe('1,00 GWh');
      expect(formatEnergy(2500000)).toBe('2,50 GWh');
    });

    it('should handle null/undefined values', () => {
      expect(formatEnergy(null, 'kWh')).toBe('-');
      expect(formatEnergy(undefined, 'kWh')).toBe('-');
      expect(formatEnergy(NaN, 'kWh')).toBe('-');
      expect(formatEnergy(null)).toBe('-');
      expect(formatEnergy(undefined)).toBe('-');
      expect(formatEnergy(NaN)).toBe('-');
    });

    it('should handle edge cases with auto-unit selection', () => {
      expect(formatEnergy(0)).toBe('0,00 kWh');
      expect(formatEnergy(0.5)).toBe('0,50 kWh');
      expect(formatEnergy(1)).toBe('1,00 kWh');
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

    it('should format array of numbers with default kWh source unit', () => {
      const values = [190404.03999999998, 146399.82999999993, 0];
      const result = formatAllInSameUnit(values, 'kWh');
      expect(result).toEqual(['190.404,04 kWh', '146.399,83 kWh', '0,00 kWh']);
    });

    it('should format array of numbers with specified source unit', () => {
      const values = [1.5, 2.0, 0.5];
      const result = formatAllInSameUnit(values, 'kWh', 'MWh');
      expect(result).toEqual(['1.500,00 kWh', '2.000,00 kWh', '500,00 kWh']);
    });

    it('should handle null/undefined/NaN values in number array', () => {
      const values = [100, null, undefined, NaN, 200];
      const result = formatAllInSameUnit(values, 'kWh');
      expect(result).toEqual(['100,00 kWh', '-', '-', '-', '200,00 kWh']);
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
