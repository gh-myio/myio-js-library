/**
 * Format ratio 0..1 as percentage string (e.g., 0.1234 -> "12.34%").
 * @param {number} x
 * @param {number} [digits=2]
 */
export function fmtPerc(x, digits = 2) {
  if (!Number.isFinite(x)) return '—';
  return (x * 100).toFixed(digits) + '%';
}

/**
 * Format a percentage value (already 0-100) with consistent decimal places.
 * Use this for displaying percentages across components to ensure consistency.
 * @param {number} value - Percentage value (0-100 scale)
 * @param {number} [digits=1] - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage without % symbol (e.g., "85.5")
 */
export function formatPercentage(value, digits = 1) {
  if (!Number.isFinite(value)) return '0.0';
  return value.toFixed(digits);
}

/**
 * Calculate and format a percentage from a fraction (numerator/denominator).
 * @param {number} numerator
 * @param {number} denominator
 * @param {number} [digits=1] - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage without % symbol (e.g., "85.5")
 */
export function calcPercentage(numerator, denominator, digits = 1) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return '0.0';
  }
  const percent = (numerator / denominator) * 100;
  return percent.toFixed(digits);
}

/**
 * Safe fixed decimal formatting (returns string, or '—' if NaN/Inf).
 * @param {number} x
 * @param {number} [digits=2]
 */
export function toFixedSafe(x, digits = 2) {
  if (!Number.isFinite(x)) return '—';
  return x.toFixed(digits);
}
