/**
 * Formats a percentage value with Brazilian locale formatting
 * @param value - The percentage value to format (as a decimal, e.g., 0.15 for 15%)
 * @returns Formatted percentage string with Brazilian locale number formatting
 */
export function fmtPerc(value: number): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return '-';
  }
  
  const percentage = value * 100;
  return percentage.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + '%';
}
