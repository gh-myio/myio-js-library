/**
 * Formats energy values with appropriate units (kWh, MWh, GWh) using Brazilian locale formatting
 * @param value - The energy value to format
 * @param unit - The unit of the energy value ('kWh', 'MWh', 'GWh')
 * @returns Formatted energy string with Brazilian locale number formatting
 */
export function formatEnergy(value: number, unit: string): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  
  const formattedValue = value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return `${formattedValue} ${unit}`;
}

/**
 * Formats all energy values to the same unit for consistent display
 * @param values - Array of energy values with their units
 * @param targetUnit - Target unit to convert all values to ('kWh', 'MWh', 'GWh')
 * @returns Array of formatted energy strings in the target unit
 */
export function formatAllInSameUnit(values: Array<{value: number, unit: string}>, targetUnit: string): string[] {
  const unitMultipliers: Record<string, number> = {
    'kWh': 1,
    'MWh': 1000,
    'GWh': 1000000
  };
  
  const targetMultiplier = unitMultipliers[targetUnit] || 1;
  
  return values.map(item => {
    if (item.value === null || item.value === undefined || isNaN(item.value)) {
      return '-';
    }
    
    const sourceMultiplier = unitMultipliers[item.unit] || 1;
    const convertedValue = (item.value * sourceMultiplier) / targetMultiplier;
    
    return formatEnergy(convertedValue, targetUnit);
  });
}
