/**
 * Formats numbers for Brazilian locale with robust input handling
 * @param value - Value to format (number, string, or any other type)
 * @param locale - Locale string (default: 'pt-BR')
 * @param minimumFractionDigits - Minimum decimal places (default: 2)
 * @param maximumFractionDigits - Maximum decimal places (default: 2)
 * @returns Formatted number string with locale formatting, or '-' for invalid inputs
 */
export function formatNumberReadable(
  value,
  locale = 'pt-BR',
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
) {
  // Convert string inputs, handling comma decimal separators
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);

  // Check if the result is a finite number
  if (!Number.isFinite(n)) {
    return '-';
  }

  // Normalize -0 to 0
  const safe = Object.is(n, -0) ? 0 : n;

  return safe.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits
  });
}
