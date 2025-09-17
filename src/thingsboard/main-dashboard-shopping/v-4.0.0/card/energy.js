/**
 * Formats energy values with appropriate units (kWh, MWh, GWh) using Brazilian locale formatting
 * @param value - The energy value to format
 * @param unit - Optional unit of the energy value ('kWh', 'MWh', 'GWh')
 * @returns Formatted energy string with Brazilian locale number formatting
 */
export function formatEnergy(value, unit) {
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
