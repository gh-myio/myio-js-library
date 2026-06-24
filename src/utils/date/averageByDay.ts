/**
 * Type definition for timed value data
 */
export type TimedValue = {
  ts: number | Date;
  value: number;
};

/**
 * Calculates the average value per day from time-series data
 * @param data - Array of objects with timestamp and value properties
 * @returns Array of objects with day (YYYY-MM-DD) and average value
 */
export function averageByDay<T extends TimedValue>(
  data: T[]
): Array<{ day: string; average: number }> {
  if (!data || data.length === 0) {
    return [];
  }
  
  const grouped: Record<string, number[]> = {};
  
  data.forEach((item) => {
    if (!item || item.value === null || item.value === undefined || isNaN(item.value)) {
      return;
    }
    
    // Convert timestamp to Date object
    const date = new Date(item.ts);
    if (isNaN(date.getTime())) {
      return;
    }
    
    // Format date as YYYY-MM-DD
    const day = date.toISOString().split('T')[0];
    
    if (!grouped[day]) {
      grouped[day] = [];
    }
    
    grouped[day].push(Number(item.value));
  });
  
  // Calculate average for each day
  const result = Object.entries(grouped).map(([day, values]) => {
    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    
    return {
      day,
      average
    };
  });
  
  // Sort by day
  result.sort((a, b) => a.day.localeCompare(b.day));
  
  return result;
}

/**
 * Groups time-series data by day and returns all values for each day
 * @param data - Array of objects with timestamp and value properties
 * @returns Object with day as key and array of values as value
 */
export function groupByDay<T extends TimedValue>(
  data: T[]
): Record<string, number[]> {
  if (!data || data.length === 0) {
    return {};
  }
  
  const grouped: Record<string, number[]> = {};
  
  data.forEach((item) => {
    if (!item || item.value === null || item.value === undefined || isNaN(item.value)) {
      return;
    }
    
    // Convert timestamp to Date object
    const date = new Date(item.ts);
    if (isNaN(date.getTime())) {
      return;
    }
    
    // Format date as YYYY-MM-DD
    const day = date.toISOString().split('T')[0];
    
    if (!grouped[day]) {
      grouped[day] = [];
    }
    
    grouped[day].push(Number(item.value));
  });
  
  return grouped;
}
