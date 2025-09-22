/**
 * Formats water volume in cubic meters (M³) using Brazilian locale formatting
 * @param value - The water volume value in cubic meters
 * @param locale - The locale to use for formatting (defaults to 'pt-BR')
 * @returns Formatted water volume string with M³ unit
 */
export function formatWaterVolumeM3(value: number, locale: string = 'pt-BR'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  
  const formattedValue = value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return `${formattedValue} M³`;
}

/**
 * Formats tank head from centimeters to meters of water column (m.c.a.)
 * @param valueCm - The tank head value in centimeters
 * @param locale - The locale to use for formatting (defaults to 'pt-BR')
 * @returns Formatted tank head string in m.c.a. unit
 */
export function formatTankHeadFromCm(valueCm: number, locale: string = 'pt-BR'): string {
  if (valueCm === null || valueCm === undefined || isNaN(valueCm)) {
    return '-';
  }
  
  const valueMeters = valueCm / 100;
  const formattedValue = valueMeters.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return `${formattedValue} m.c.a.`;
}

/**
 * Calculates percentage difference between two values and determines the type of change
 * @param prev - Previous value
 * @param current - Current value
 * @returns Object with percentage value and type of change
 */
export function calcDeltaPercent(prev: number, current: number): {
  value: number;
  type: 'increase' | 'decrease' | 'neutral';
} {
  if (prev === null || prev === undefined || isNaN(prev) || 
      current === null || current === undefined || isNaN(current)) {
    return { value: 0, type: 'neutral' };
  }
  
  if (prev === 0 && current === 0) {
    return { value: 0, type: 'neutral' };
  }
  
  if (prev === 0 && current > 0) {
    return { value: 100, type: 'increase' };
  }
  
  if (prev === 0 && current < 0) {
    return { value: 100, type: 'decrease' };
  }
  
  const percentChange = ((current - prev) / prev) * 100;
  
  if (percentChange > 0) {
    return { value: percentChange, type: 'increase' };
  } else if (percentChange < 0) {
    return { value: Math.abs(percentChange), type: 'decrease' };
  } else {
    return { value: 0, type: 'neutral' };
  }
}

/**
 * Formats water values based on group type (from MAIN_WATER controller)
 * @param value - The value to format in cubic meters
 * @param group - The group type ('Caixas D\'Água', 'Lojas', 'Área Comum')
 * @returns Formatted string with appropriate unit
 */
export function formatWaterByGroup(value: number, group: string): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  
  if (group === "Caixas D'Água") {
    return formatTankHeadFromCm(value);
  }
  
  // Large numbers: express in thousands of m³ with simplified suffix
  if (value >= 1000) {
    return formatWaterVolumeM3(value / 1000) + ' x 10³ ';
  }
  
  return formatWaterVolumeM3(value);
}

/**
 * Formats all values in the same unit for consistent display
 * @param values - Array of values to format
 * @returns Object with format function and unit
 */
export function formatAllInSameWaterUnit(values: number[]): {
  format: (val: number) => string;
  unit: string;
} {
  const max = Math.max(...values.filter(v => !isNaN(v) && v !== null && v !== undefined));
  let divisor = 1;
  let unit = "M³";

  if (max >= 1000000) {
    divisor = 1000000;
    unit = "M³";
  } else if (max >= 1000) {
    divisor = 1000;
    unit = "M³";
  }

  return {
    format: (val: number) => {
      if (val === null || val === undefined || isNaN(val)) {
        return '-';
      }
      return (val / divisor).toFixed(2) + " " + unit;
    },
    unit,
  };
}
