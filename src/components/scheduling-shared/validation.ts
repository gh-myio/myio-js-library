/**
 * Scheduling Shared Validation
 * Reusable validators for time format, overlap detection, and range checks.
 */

import type { DaysWeek } from './types';

/**
 * Convert HH:MM time string to minutes since midnight.
 * Returns NaN for invalid format.
 */
export function timeToMinutes(time: string): number {
  if (!/^[0-2]\d:[0-5]\d$/.test(time)) return NaN;
  const [hours, minutes] = time.split(':').map(Number);
  if (hours > 23) return NaN;
  return hours * 60 + minutes;
}

/** Validate HH:MM time format */
export function isValidTimeFormat(time: string): boolean {
  return !isNaN(timeToMinutes(time));
}

/** Validate that end time is after start time */
export function isEndAfterStart(start: string, end: string): boolean {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (isNaN(startMin) || isNaN(endMin)) return false;
  return endMin > startMin;
}

/** Check if two time intervals overlap on common active days */
export function doSchedulesOverlap(
  a: { startTime: string; endTime: string; daysWeek: DaysWeek; holiday: boolean },
  b: { startTime: string; endTime: string; daysWeek: DaysWeek; holiday: boolean },
): boolean {
  const startA = timeToMinutes(a.startTime);
  const endA = timeToMinutes(a.endTime);
  const startB = timeToMinutes(b.startTime);
  const endB = timeToMinutes(b.endTime);

  if (isNaN(startA) || isNaN(endA) || isNaN(startB) || isNaN(endB)) return false;

  const days: (keyof DaysWeek)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const commonDays = days.some((day) => a.daysWeek[day] && b.daysWeek[day]);
  const holidayOverlap = a.holiday && b.holiday;

  if (!commonDays && !holidayOverlap) return false;

  return startA < endB && endA > startB;
}

/** Check if at least one day or holiday is selected */
export function hasSelectedDays(daysWeek: DaysWeek, holiday: boolean): boolean {
  return Object.values(daysWeek).some((v) => v === true) || holiday;
}

/** Validate a number is within min/max range (inclusive) */
export function isInRange(value: number, min: number, max: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}
