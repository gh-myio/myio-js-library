/**
 * Date Utilities
 * Common date manipulation functions for MYIO components
 *
 * @module dateUtils
 * @version 1.0.0
 */

/**
 * Get default period for API calls - current day (today)
 * Returns ISO strings for startTime and endTime covering the full day
 *
 * @returns {{ startISO: string, endISO: string, granularity: string }}
 *
 * @example
 * const period = getDefaultPeriodCurrentMonthSoFar();
 * // {
 * //   startISO: "2026-01-04T03:00:00.000Z", // Start of day in local time
 * //   endISO: "2026-01-05T02:59:59.999Z",   // End of day in local time
 * //   granularity: "day"
 * // }
 */
export function getDefaultPeriodCurrentMonthSoFar() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return {
    startISO: startOfDay.toISOString(),
    endISO: endOfDay.toISOString(),
    granularity: 'day',
  };
}
