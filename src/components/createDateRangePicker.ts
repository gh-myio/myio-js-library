/**
 * MyIOLibrary DateRangePicker - Public API
 * 
 * A simplified, user-friendly wrapper around the internal DateRangePickerJQ component.
 * Provides a clean API for creating date range pickers with MyIO styling and Portuguese localization.
 */

import { DateRangePickerJQ, type AttachOptions, type DateRangeControl, type DateRangeResult } from './premium-modals/internal/DateRangePickerJQ';

export interface CreateDateRangePickerOptions {
  /** Preset start date (ISO string or YYYY-MM-DD) */
  presetStart?: string;
  /** Preset end date (ISO string or YYYY-MM-DD) */
  presetEnd?: string;
  /** Maximum range in days (default: 31) */
  maxRangeDays?: number;
  /** Parent element for modal positioning */
  parentEl?: HTMLElement;
  /** Callback when date range is applied */
  onApply?: (result: DateRangeResult) => void;
}

/**
 * Creates a MyIO-styled date range picker on the specified input element.
 * 
 * @param input - The input element to attach the date range picker to
 * @param options - Configuration options for the date range picker
 * @returns A DateRangeControl instance with methods to interact with the picker
 * 
 * @example
 * ```typescript
 * const input = document.getElementById('date-range') as HTMLInputElement;
 * const picker = MyIOLibrary.createDateRangePicker(input, {
 *   timePicker: true,
 *   maxSpan: { days: 31 },
 *   ranges: {
 *     'Hoje': 'today',
 *     'Últimos 7 dias': 'last7days',
 *     'Últimos 30 dias': 'last30days'
 *   }
 * });
 * 
 * // Set a default range
 * picker.setRange('thismonth');
 * 
 * // Get selected dates
 * const { startDate, endDate } = picker;
 * ```
 */
export async function createDateRangePicker(
  input: HTMLInputElement, 
  options: CreateDateRangePickerOptions = {}
): Promise<DateRangeControl> {
  // Set default options
  const defaultOptions: AttachOptions = {
    maxRangeDays: 31,
    ...options
  };

  // Use the internal DateRangePickerJQ component
  return await DateRangePickerJQ.attach(input, defaultOptions);
}

// Re-export types for convenience
export type { DateRangeControl, DateRangeResult } from './premium-modals/internal/DateRangePickerJQ';
