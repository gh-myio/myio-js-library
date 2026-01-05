import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDefaultPeriodCurrentMonthSoFar, getDefaultPeriodCurrentDaySoFar } from '../src/index.ts';

describe('dateUtils', () => {
  // Store original Date
  const RealDate = Date;

  afterEach(() => {
    // Restore Date after each test
    vi.useRealTimers();
  });

  describe('getDefaultPeriodCurrentMonthSoFar', () => {
    it('should return period from 1st of month to end of today', () => {
      // Mock date to 2026-01-15 14:30:00 local time
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 14, 30, 0, 0)); // Jan 15, 2026 14:30:00

      const result = getDefaultPeriodCurrentMonthSoFar();

      // Parse the ISO strings back to Date objects for comparison
      const startDate = new Date(result.startISO);
      const endDate = new Date(result.endISO);

      // Start should be Jan 1st 00:00:00.000 local time
      expect(startDate.getFullYear()).toBe(2026);
      expect(startDate.getMonth()).toBe(0); // January
      expect(startDate.getDate()).toBe(1);
      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
      expect(startDate.getSeconds()).toBe(0);

      // End should be Jan 15th 23:59:59.999 local time
      expect(endDate.getFullYear()).toBe(2026);
      expect(endDate.getMonth()).toBe(0); // January
      expect(endDate.getDate()).toBe(15);
      expect(endDate.getHours()).toBe(23);
      expect(endDate.getMinutes()).toBe(59);
      expect(endDate.getSeconds()).toBe(59);

      expect(result.granularity).toBe('day');
    });

    it('should work on the 1st day of the month', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 1, 10, 0, 0, 0)); // March 1st, 2026

      const result = getDefaultPeriodCurrentMonthSoFar();
      const startDate = new Date(result.startISO);
      const endDate = new Date(result.endISO);

      // Both should be March 1st (same day)
      expect(startDate.getDate()).toBe(1);
      expect(startDate.getMonth()).toBe(2); // March
      expect(endDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(2); // March
    });

    it('should work on the last day of the month', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 31, 23, 0, 0, 0)); // Jan 31st, 2026

      const result = getDefaultPeriodCurrentMonthSoFar();
      const startDate = new Date(result.startISO);
      const endDate = new Date(result.endISO);

      expect(startDate.getDate()).toBe(1);
      expect(endDate.getDate()).toBe(31);
    });

    it('should return valid ISO strings', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 15)); // June 15, 2026

      const result = getDefaultPeriodCurrentMonthSoFar();

      // Should match ISO 8601 format
      expect(result.startISO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.endISO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle year boundary (January)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 5)); // Jan 5, 2026

      const result = getDefaultPeriodCurrentMonthSoFar();
      const startDate = new Date(result.startISO);

      expect(startDate.getFullYear()).toBe(2026);
      expect(startDate.getMonth()).toBe(0); // January
      expect(startDate.getDate()).toBe(1);
    });

    it('should handle February in leap year', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 1, 29)); // Feb 29, 2024 (leap year)

      const result = getDefaultPeriodCurrentMonthSoFar();
      const startDate = new Date(result.startISO);
      const endDate = new Date(result.endISO);

      expect(startDate.getDate()).toBe(1);
      expect(endDate.getDate()).toBe(29);
      expect(endDate.getMonth()).toBe(1); // February
    });
  });

  describe('getDefaultPeriodCurrentDaySoFar', () => {
    it('should return period for current day only', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 14, 30, 0, 0)); // Jan 15, 2026 14:30:00

      const result = getDefaultPeriodCurrentDaySoFar();
      const startDate = new Date(result.startISO);
      const endDate = new Date(result.endISO);

      // Start should be Jan 15th 00:00:00.000 local time
      expect(startDate.getFullYear()).toBe(2026);
      expect(startDate.getMonth()).toBe(0); // January
      expect(startDate.getDate()).toBe(15);
      expect(startDate.getHours()).toBe(0);
      expect(startDate.getMinutes()).toBe(0);
      expect(startDate.getSeconds()).toBe(0);

      // End should be Jan 15th 23:59:59.999 local time
      expect(endDate.getFullYear()).toBe(2026);
      expect(endDate.getMonth()).toBe(0); // January
      expect(endDate.getDate()).toBe(15);
      expect(endDate.getHours()).toBe(23);
      expect(endDate.getMinutes()).toBe(59);
      expect(endDate.getSeconds()).toBe(59);

      expect(result.granularity).toBe('hour');
    });

    it('should have start and end on the same day', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 20, 8, 0, 0, 0)); // July 20, 2026

      const result = getDefaultPeriodCurrentDaySoFar();
      const startDate = new Date(result.startISO);
      const endDate = new Date(result.endISO);

      expect(startDate.getDate()).toBe(endDate.getDate());
      expect(startDate.getMonth()).toBe(endDate.getMonth());
      expect(startDate.getFullYear()).toBe(endDate.getFullYear());
    });

    it('should return valid ISO strings', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 15));

      const result = getDefaultPeriodCurrentDaySoFar();

      expect(result.startISO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.endISO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should have hour granularity', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 1));

      const result = getDefaultPeriodCurrentDaySoFar();
      expect(result.granularity).toBe('hour');
    });

    it('should handle midnight correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 0, 0, 0, 0)); // Exactly midnight

      const result = getDefaultPeriodCurrentDaySoFar();
      const startDate = new Date(result.startISO);
      const endDate = new Date(result.endISO);

      expect(startDate.getDate()).toBe(15);
      expect(endDate.getDate()).toBe(15);
    });

    it('should handle end of day correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 23, 59, 59, 999)); // Just before midnight

      const result = getDefaultPeriodCurrentDaySoFar();
      const startDate = new Date(result.startISO);
      const endDate = new Date(result.endISO);

      expect(startDate.getDate()).toBe(15);
      expect(endDate.getDate()).toBe(15);
    });
  });

  describe('comparison between functions', () => {
    it('CurrentDaySoFar should have same end as CurrentMonthSoFar', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0, 0));

      const monthResult = getDefaultPeriodCurrentMonthSoFar();
      const dayResult = getDefaultPeriodCurrentDaySoFar();

      // Both should end at 23:59:59.999 on the same day
      expect(monthResult.endISO).toBe(dayResult.endISO);
    });

    it('CurrentMonthSoFar should have earlier start than CurrentDaySoFar (unless 1st of month)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0, 0)); // Jan 15

      const monthResult = getDefaultPeriodCurrentMonthSoFar();
      const dayResult = getDefaultPeriodCurrentDaySoFar();

      const monthStart = new Date(monthResult.startISO);
      const dayStart = new Date(dayResult.startISO);

      // Month start should be earlier (Jan 1) than day start (Jan 15)
      expect(monthStart.getTime()).toBeLessThan(dayStart.getTime());
    });

    it('on 1st of month, both should have same start', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 2, 1, 12, 0, 0, 0)); // March 1

      const monthResult = getDefaultPeriodCurrentMonthSoFar();
      const dayResult = getDefaultPeriodCurrentDaySoFar();

      // Both should start at March 1st 00:00:00
      expect(monthResult.startISO).toBe(dayResult.startISO);
    });

    it('CurrentMonthSoFar should have day granularity, CurrentDaySoFar should have hour', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 15));

      const monthResult = getDefaultPeriodCurrentMonthSoFar();
      const dayResult = getDefaultPeriodCurrentDaySoFar();

      expect(monthResult.granularity).toBe('day');
      expect(dayResult.granularity).toBe('hour');
    });
  });
});
