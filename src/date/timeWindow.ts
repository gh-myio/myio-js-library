/**
 * Creates a time window from two input date strings with timezone offset
 * @param startYmd - Start date in 'YYYY-MM-DD' format
 * @param endYmd - End date in 'YYYY-MM-DD' format
 * @param tzOffset - Timezone offset string (e.g., '-03:00')
 * @returns Object with start and end timestamps in milliseconds
 */
export function timeWindowFromInputYMD(
  startYmd: string,
  endYmd: string,
  tzOffset: string = '-03:00'
): { startTs: number; endTs: number } {
  if (!startYmd || !endYmd) {
    return { startTs: 0, endTs: 0 };
  }
  
  // Parse the date strings
  const startParts = startYmd.split('-');
  const endParts = endYmd.split('-');
  
  if (startParts.length !== 3 || endParts.length !== 3) {
    return { startTs: 0, endTs: 0 };
  }
  
  // Create dates at start and end of day
  const startDate = new Date(
    parseInt(startParts[0], 10),
    parseInt(startParts[1], 10) - 1,
    parseInt(startParts[2], 10),
    0, 0, 0, 0
  );
  
  const endDate = new Date(
    parseInt(endParts[0], 10),
    parseInt(endParts[1], 10) - 1,
    parseInt(endParts[2], 10),
    23, 59, 59, 999
  );
  
  return {
    startTs: startDate.getTime(),
    endTs: endDate.getTime()
  };
}

/**
 * Formats a date with timezone offset for API calls
 * @param date - The date to format
 * @param endOfDay - Whether to set to end of day (23:59:59.999)
 * @param tzOffset - Timezone offset string (e.g., '-03:00')
 * @returns Formatted date string with timezone offset
 */
export function formatDateWithTimezoneOffset(
  date: Date,
  endOfDay: boolean = false,
  tzOffset: string = '-03:00'
): string {
  if (!date || isNaN(date.getTime())) {
    return '';
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  let hours, minutes, seconds, milliseconds;
  
  if (endOfDay) {
    hours = '23';
    minutes = '59';
    seconds = '59';
    milliseconds = '999';
  } else {
    hours = String(date.getHours()).padStart(2, '0');
    minutes = String(date.getMinutes()).padStart(2, '0');
    seconds = String(date.getSeconds()).padStart(2, '0');
    milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  }
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${tzOffset}`;
}

/**
 * Gets São Paulo ISO string with fixed offset (from MAIN_WATER controller)
 * @param dateStr - Date string in 'YYYY-MM-DD' format
 * @param endOfDay - Whether to set to end of day
 * @returns ISO string with São Paulo timezone offset
 */
export function getSaoPauloISOStringFixed(dateStr: string, endOfDay: boolean = false): string {
  if (!dateStr) return '';
  
  if (endOfDay) {
    return `${dateStr}T23:59:59.999-03:00`;
  } else {
    return `${dateStr}T00:00:00.000-03:00`;
  }
}
