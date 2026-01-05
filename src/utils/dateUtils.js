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

/**
 * Get the first day of the current month at 00:00:00.000 local time
 *
 * @returns {Date} First day of current month
 *
 * @example
 * const firstDay = getFirstDayOfMonth();
 * // If today is 2026-01-15, returns Date for 2026-01-01 00:00:00.000
 */
export function getFirstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Get the first day of a specific month at 00:00:00.000 local time
 *
 * @param {Date|number} dateOrYear - Date object or year number
 * @param {number} [month] - Month (0-11) if first param is year
 * @returns {Date} First day of specified month
 *
 * @example
 * getFirstDayOfMonthFor(new Date(2026, 5, 15)); // June 1st, 2026
 * getFirstDayOfMonthFor(2026, 5); // June 1st, 2026
 */
export function getFirstDayOfMonthFor(dateOrYear, month) {
  if (dateOrYear instanceof Date) {
    return new Date(dateOrYear.getFullYear(), dateOrYear.getMonth(), 1, 0, 0, 0, 0);
  }
  return new Date(dateOrYear, month, 1, 0, 0, 0, 0);
}

/**
 * Get the last day of the current month at 23:59:59.999 local time
 *
 * @returns {Date} Last day of current month
 *
 * @example
 * const lastDay = getLastDayOfMonth();
 * // If today is 2026-01-15, returns Date for 2026-01-31 23:59:59.999
 */
export function getLastDayOfMonth() {
  const now = new Date();
  // Day 0 of next month = last day of current month
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}
