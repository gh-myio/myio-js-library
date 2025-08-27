import { describe, it, expect } from 'vitest';
import { formatDateToYMD, determineInterval, getSaoPauloISOString, getDateRangeArray } from '../src/index.ts';

describe('Date utilities', () => {
  describe('formatDateToYMD', () => {
    it('should format dates to YYYY-MM-DD', () => {
      const date = new Date('2023-12-25T10:30:00Z');
      expect(formatDateToYMD(date)).toBe('2023-12-25');
    });

    it('should handle string dates', () => {
      // Use a more explicit date format to avoid timezone issues
      expect(formatDateToYMD('2023-01-15T12:00:00Z')).toBe('2023-01-15');
    });

    it('should handle invalid dates', () => {
      expect(formatDateToYMD('invalid')).toBe('');
      expect(formatDateToYMD(null)).toBe('');
      expect(formatDateToYMD(undefined)).toBe('');
    });
  });

  describe('determineInterval', () => {
    it('should return hour for same day', () => {
      const start = new Date('2023-01-01T00:00:00Z');
      const end = new Date('2023-01-01T12:00:00Z');
      expect(determineInterval(start, end)).toBe('hour');
    });

    it('should return day for week range', () => {
      const start = new Date('2023-01-01');
      const end = new Date('2023-01-05');
      expect(determineInterval(start, end)).toBe('day');
    });

    it('should return month for year range', () => {
      const start = new Date('2023-01-01');
      const end = new Date('2023-06-01');
      expect(determineInterval(start, end)).toBe('month');
    });

    it('should handle invalid dates', () => {
      expect(determineInterval('invalid', 'invalid')).toBe('day');
    });

    it('should handle exact boundary conditions', () => {
      const start = new Date('2023-01-01T00:00:00Z');
      
      // Exactly 2 days
      const exactly2Days = new Date(start.getTime() + (2 * 24 * 60 * 60 * 1000));
      expect(determineInterval(start, exactly2Days)).toBe('day');
      
      // 2 days + 1 millisecond
      const over2Days = new Date(start.getTime() + (2 * 24 * 60 * 60 * 1000) + 1);
      expect(determineInterval(start, over2Days)).toBe('day');
      
      // Exactly 7 days
      const exactly7Days = new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000));
      expect(determineInterval(start, exactly7Days)).toBe('day');
      
      // 7 days + 1 millisecond
      const over7Days = new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000) + 1);
      expect(determineInterval(start, over7Days)).toBe('week');
    });
  });

  describe('getSaoPauloISOString', () => {
    it('should return ISO string for start of day', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      const result = getSaoPauloISOString(date, 'start');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return ISO string for end of day', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      const result = getSaoPauloISOString(date, 'end');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle invalid dates', () => {
      expect(getSaoPauloISOString('invalid')).toBe('');
    });
  });

  describe('getDateRangeArray', () => {
    it('should generate daily date range', () => {
      const start = new Date('2023-01-01');
      const end = new Date('2023-01-03');
      const result = getDateRangeArray(start, end, 'day');
      
      expect(result).toHaveLength(3);
      expect(result[0].toISOString().split('T')[0]).toBe('2023-01-01');
      expect(result[2].toISOString().split('T')[0]).toBe('2023-01-03');
    });

    it('should generate weekly date range', () => {
      const start = new Date('2023-01-01');
      const end = new Date('2023-01-15');
      const result = getDateRangeArray(start, end, 'week');
      
      expect(result).toHaveLength(3);
    });

    it('should handle invalid dates', () => {
      const result = getDateRangeArray('invalid', 'invalid');
      expect(result).toEqual([]);
    });

    it('should handle end date before start date', () => {
      const start = new Date('2023-01-05');
      const end = new Date('2023-01-01');
      const result = getDateRangeArray(start, end);
      expect(result).toEqual([]);
    });
  });
});
