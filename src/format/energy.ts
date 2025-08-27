/**
 * Formats energy values with appropriate units (kWh, MWh, GWh) using Brazilian locale formatting
 * @param value - The energy value to format
 * @param unit - Optional unit of the energy value ('kWh', 'MWh', 'GWh')
 * @returns Formatted energy string with Brazilian locale number formatting
 */
export function formatEnergy(value: number, unit?: string): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }

  let adjustedValue = value;
  let adjustedUnit = unit;

  if (!adjustedUnit) {
    if (value >= 1_000_000) {
      adjustedValue = value / 1_000_000;
      adjustedUnit = 'GWh';
    } else if (value >= 1_000) {
      adjustedValue = value / 1_000;
      adjustedUnit = 'MWh';
    } else {
      adjustedUnit = 'kWh';
    }
  }

  const formattedValue = adjustedValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${formattedValue} ${adjustedUnit}`;
}

/**
 * Formats all energy values to the same unit for consistent display
 * @param values - Array of energy values with their units OR array of numbers (assumes kWh)
 * @param targetUnit - Target unit to convert all values to ('kWh', 'MWh', 'GWh')
 * @param sourceUnit - Source unit when values is an array of numbers (defaults to 'kWh')
 * @returns Array of formatted energy strings in the target unit
 */
export function formatAllInSameUnit(
  values: Array<{value: number, unit: string}> | number[], 
  targetUnit: string,
  sourceUnit: string = 'kWh'
): string[] {
  const unitMultipliers: Record<string, number> = {
    'kWh': 1,
    'MWh': 1000,
    'GWh': 1000000
  };
  
  const targetMultiplier = unitMultipliers[targetUnit] || 1;
  
  // Handle array of numbers
  if (typeof values[0] === 'number') {
    const numberValues = values as number[];
    const sourceMultiplier = unitMultipliers[sourceUnit] || 1;
    
    return numberValues.map(value => {
      if (value === null || value === undefined || isNaN(value)) {
        return '-';
      }
      
      const convertedValue = (value * sourceMultiplier) / targetMultiplier;
      return formatEnergy(convertedValue, targetUnit);
    });
  }
  
  // Handle array of objects (original behavior)
  const objectValues = values as Array<{value: number, unit: string}>;
  return objectValues.map(item => {
    if (item.value === null || item.value === undefined || isNaN(item.value)) {
      return '-';
    }
    
    const sourceMultiplier = unitMultipliers[item.unit] || 1;
    const convertedValue = (item.value * sourceMultiplier) / targetMultiplier;
    
    return formatEnergy(convertedValue, targetUnit);
  });
}
