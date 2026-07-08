/**
 * Generates an array of dates within a specified range
 * @param startDate - Start date of the range
 * @param endDate - End date of the range
 * @param interval - Interval between dates ('day', 'week', 'month', 'year')
 * @returns Array of Date objects within the specified range
 */
export function getDateRangeArray(
  startDate: Date | string | number,
  endDate: Date | string | number,
  interval: 'day' | 'week' | 'month' | 'year' = 'day'
): Date[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates: Date[] = [];
  
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return dates;
  }
  
  const current = new Date(start);
  
  while (current <= end) {
    dates.push(new Date(current));
    
    switch (interval) {
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'year':
        current.setFullYear(current.getFullYear() + 1);
        break;
      default:
        current.setDate(current.getDate() + 1);
    }
  }
  
  return dates;
}
