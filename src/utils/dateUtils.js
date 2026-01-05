/**
 * Date Utilities
 * Common date manipulation functions for MYIO components
 *
 * @module dateUtils
 * @version 1.1.0
 */

/**
 * Get default period for API calls - from 1st day of current month to end of today
 * Returns ISO strings for startTime and endTime
 *
 * @returns {{ startISO: string, endISO: string, granularity: string }}
 *
 * @example
 * // If today is 2026-01-05 in timezone -03:00:
 * const period = getDefaultPeriodCurrentMonthSoFar();
 * // {
 * //   startISO: "2026-01-01T03:00:00.000Z", // Jan 1st 00:00 local time
 * //   endISO: "2026-01-06T02:59:59.999Z",   // Jan 5th 23:59:59 local time
 * //   granularity: "day"
 * // }
 */
export function getDefaultPeriodCurrentMonthSoFar() {
  const now = new Date();
  // Start of first day of current month (00:00:00.000 local time)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  // End of today (23:59:59.999 local time)
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return {
    startISO: startOfMonth.toISOString(),
    endISO: endOfToday.toISOString(),
    granularity: 'day',
  };
}

/**
 * Get default period for API calls - current day only (today)
 * Returns ISO strings for startTime and endTime covering the full day
 *
 * @returns {{ startISO: string, endISO: string, granularity: string }}
 *
 * @example
 * // If today is 2026-01-05 in timezone -03:00:
 * const period = getDefaultPeriodCurrentDaySoFar();
 * // {
 * //   startISO: "2026-01-05T03:00:00.000Z", // Jan 5th 00:00 local time
 * //   endISO: "2026-01-06T02:59:59.999Z",   // Jan 5th 23:59:59 local time
 * //   granularity: "hour"
 * // }
 */
export function getDefaultPeriodCurrentDaySoFar() {
  const now = new Date();
  // Start of today (00:00:00.000 local time)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  // End of today (23:59:59.999 local time)
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return {
    startISO: startOfDay.toISOString(),
    endISO: endOfDay.toISOString(),
    granularity: 'hour',
  };
}
