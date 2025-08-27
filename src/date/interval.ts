/**
 * Determines the appropriate time interval based on date range
 * @param startDate - Start date of the range
 * @param endDate - End date of the range
 * @returns Interval string ('hour', 'day', 'week', 'month', 'year')
 */
export function determineInterval(startDate: Date | string | number, endDate: Date | string | number): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'day';
  }
  
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  if (diffDays <= 1) {
    return 'hour';
  } else if (diffDays <= 7) {
    return 'day';
  } else if (diffDays <= 31) {
    return 'week';
  } else if (diffDays <= 365) {
    return 'month';
  } else {
    return 'year';
  }
}
