/**
 * Simple water value formatting (same as MAIN controller)
 * @param value - The water volume value in cubic meters
 * @returns Formatted water volume string with m³ unit
 */
export function formatWater(value: number): string {
  const num = Number(value) || 0;
  return `${num.toFixed(2)} m³`;
}

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
 * ED-1375: single source of truth for the tank `water_level` unit rule.
 * The telemetry key arrives in centimeters; M.C.A (metros de coluna d'água) = cm / 100.
 * Used by the device card badge (via formatTankHeadFromCm) and the water tank chart modal.
 * @param valueCm - Tank head in centimeters
 * @returns Tank head in meters of water column (NaN when not numeric)
 */
export function tankHeadCmToMca(valueCm: number): number {
  return Number(valueCm) / 100;
}

/**
 * ED-1375: pt-BR fixed-decimal number (same rule as the device card: toFixed + comma).
 * @example formatPtBrFixed(7.098) → "7,10"
 */
export function formatPtBrFixed(value: number, decimals: number = 2): string {
  const num = Number(value);
  if (value === null || value === undefined || isNaN(num)) return '-';
  return num.toFixed(decimals).replace('.', ',');
}

/**
 * ED-1375: tank level percentage exactly as the device card shows it —
 * no clamp at 100, 2 decimals, pt-BR comma (e.g. 121 → "121,00%").
 * @param percent - Percentage already in 0-100+ range (water_percentage * 100)
 */
export function formatTankLevelPercent(percent: number, decimals: number = 2): string {
  const txt = formatPtBrFixed(percent, decimals);
  return txt === '-' ? '-' : `${txt}%`;
}

/**
 * Formats tank head from centimeters to meters of water column (M.C.A)
 * @param valueCm - The tank head value in centimeters
 * @param locale - The locale to use for formatting (defaults to 'pt-BR')
 * @returns Formatted tank head string in M.C.A unit (e.g. "12,21 M.C.A")
 */
export function formatTankHeadFromCm(valueCm: number, locale: string = 'pt-BR'): string {
  if (valueCm === null || valueCm === undefined || isNaN(valueCm)) {
    return '-';
  }

  const valueMeters = tankHeadCmToMca(valueCm);
  const formattedValue = valueMeters.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return `${formattedValue} M.C.A`;
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
