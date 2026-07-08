/**
 * Formats a Date object into a 'YYYY-MM-DD' string for HTML input fields
 * @param date - The Date object to format
 * @returns Formatted date string in 'YYYY-MM-DD' format
 */
export function formatDateForInput(date: Date): string {
  if (!date || isNaN(date.getTime())) {
    return '';
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Parses a 'YYYY-MM-DD' string into a Date object at midnight local time
 * @param inputDateStr - The input date string in 'YYYY-MM-DD' format
 * @returns Date object set to midnight (00:00:00) local time, or null if invalid
 */
export function parseInputDateToDate(inputDateStr: string): Date | null {
  if (!inputDateStr) {
    return null;
  }
  
  const parts = inputDateStr.split('-');
  if (parts.length !== 3) {
    return null;
  }
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }
  
  return new Date(year, month, day, 0, 0, 0, 0);
}
