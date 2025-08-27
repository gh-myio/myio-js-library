/**
 * Formats numbers for Brazilian locale
 * @param value - Number to format
 * @returns Formatted number string with pt-BR locale formatting
 */
export function formatNumberReadable(value: number): string {
  if (value == null || isNaN(value)) {
    return '-';
  }
  
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
