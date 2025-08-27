/**
 * Formats a date to YYYY-MM-DD format
 * @param date - The date to format (Date object, timestamp, or date string)
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateToYMD(date: Date | number | string): string {
  if (!date) {
    return '';
  }
  
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}
