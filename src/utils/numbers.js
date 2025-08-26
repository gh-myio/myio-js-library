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
 * Safe fixed decimal formatting (returns string, or '—' if NaN/Inf).
 * @param {number} x
 * @param {number} [digits=2]
 */
export function toFixedSafe(x, digits = 2) {
  if (!Number.isFinite(x)) return '—';
  return x.toFixed(digits);
}
