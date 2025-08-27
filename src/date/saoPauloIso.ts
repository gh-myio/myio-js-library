/**
 * Gets an ISO string for a date at the edge of the day in São Paulo timezone
 * @param date - The date to convert
 * @param edge - Whether to get start ('start') or end ('end') of day
 * @returns ISO string adjusted for São Paulo timezone
 */
export function getSaoPauloISOString(date: Date | string | number, edge: 'start' | 'end' = 'start'): string {
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  // São Paulo timezone offset (UTC-3, but considering daylight saving time)
  const saoPauloOffset = -3; // hours
  
  // Create a new date adjusted for São Paulo timezone
  const saoPauloDate = new Date(dateObj.getTime() + (saoPauloOffset * 60 * 60 * 1000));
  
  if (edge === 'start') {
    saoPauloDate.setHours(0, 0, 0, 0);
  } else {
    saoPauloDate.setHours(23, 59, 59, 999);
  }
  
  // Convert back to UTC for ISO string
  const utcDate = new Date(saoPauloDate.getTime() - (saoPauloOffset * 60 * 60 * 1000));
  
  return utcDate.toISOString();
}
