/**
 * RFC-0228 F0 — Money **display** formatting for the financial-goals frontend.
 *
 * The canonical money representation is a decimal **string** (`"1234.56"`); these
 * helpers parse it **for display only** and never round-trip through a float.
 * The BRL formatter is fully string-based (group-by-thousands, comma decimal), so
 * arbitrarily large amounts group correctly and there is no float artifact. The
 * only `Number()` in this module is inside percent math for the deviation chip —
 * a derived display value, never written back to a canonical amount.
 *
 * Honest-empty rule: a missing/`null`/invalid amount renders {@link DASH} (`—`),
 * **never** `NaN` or a misleading `R$ 0` (RFC-0228 F0 constraint).
 */

/** The em-dash rendered for a missing/unknown money value. */
export const DASH = '—';

/** A decimal string split into sign + integer + (already-2dp) fraction. */
interface DecimalParts {
  negative: boolean;
  intDigits: string;
  frac2: string;
}

/**
 * Parse a decimal string into sign / integer / 2-decimal fraction using pure
 * string ops (half-up rounding on the third fraction digit). Returns `null` for
 * anything that is not a finite decimal string — the caller renders {@link DASH}.
 */
function toDecimalParts(input: string): DecimalParts | null {
  const s = input.trim();
  if (!s) return null;
  // Accept an optional leading sign then digits with an optional single dot.
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;

  const negative = m[1] === '-';
  let intDigits = m[2].replace(/^0+(?=\d)/, ''); // strip leading zeros, keep one
  const frac = m[3] || '';

  // Round to 2 decimals, half-up, using string carry (no float).
  let cents = frac.slice(0, 2).padEnd(2, '0');
  const roundDigit = frac.charAt(2);
  if (roundDigit && roundDigit >= '5') {
    const bumped = String(Number(cents) + 1).padStart(2, '0'); // 0..99 only — safe
    if (bumped.length > 2) {
      // 99 -> 100: carry into the integer part via string increment.
      cents = '00';
      intDigits = incrementDigits(intDigits);
    } else {
      cents = bumped;
    }
  }
  return { negative, intDigits, frac2: cents };
}

/** Increment a non-negative integer given as a digit string (no float). */
function incrementDigits(digits: string): string {
  const arr = digits.split('');
  let i = arr.length - 1;
  for (; i >= 0; i--) {
    if (arr[i] === '9') {
      arr[i] = '0';
    } else {
      arr[i] = String(Number(arr[i]) + 1);
      return arr.join('');
    }
  }
  return '1' + arr.join('');
}

/** Group an integer digit-string in threes with pt-BR dots: `1234567` → `1.234.567`. */
function groupThousands(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Format a decimal **string** amount as pt-BR BRL: `"1234.56"` → `"R$ 1.234,56"`.
 * `null`/`undefined`/empty/invalid → {@link DASH}. Never returns `NaN` or a
 * spurious `R$ 0`. The amount is grouped from the string (safe for large values);
 * no numeric addition is performed, so string inputs like `"0.10"` and `"0.20"`
 * are formatted independently and never summed as floats.
 */
export function formatBRL(amount: string | null | undefined): string {
  if (amount == null) return DASH;
  const parts = toDecimalParts(String(amount));
  if (!parts) return DASH;
  const grouped = groupThousands(parts.intDigits);
  const sign = parts.negative && !(parts.intDigits === '0' && parts.frac2 === '00') ? '-' : '';
  return `R$ ${sign}${grouped},${parts.frac2}`;
}

/**
 * Sign glyph for a numeric delta: positive → `"+"`, negative → `"−"` (true minus),
 * zero/`null`/`NaN` → `""`. Parallels the kWh deviation chips.
 */
export function signOf(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return '';
  return value > 0 ? '+' : '−';
}

/**
 * Compute a signed deviation percentage between two decimal-string amounts:
 * `(current − baseline) / |baseline| × 100`. Returns `null` when either input is
 * invalid or the baseline is zero (avoids divide-by-zero / `Infinity`). This is
 * the one place a `Number()` is used — for a derived display metric only; the
 * canonical amounts remain strings.
 */
export function computeDeltaPct(
  current: string | null | undefined,
  baseline: string | null | undefined
): number | null {
  if (current == null || baseline == null) return null;
  const c = Number(String(current).trim());
  const b = Number(String(baseline).trim());
  if (!Number.isFinite(c) || !Number.isFinite(b) || b === 0) return null;
  return ((c - b) / Math.abs(b)) * 100;
}

/**
 * Format a percentage for the R$ deviation chip: `3.2` → `"+3,2%"`,
 * `-1.5` → `"−1,5%"`, `0` → `"0,0%"`, `null` → {@link DASH}. `digits` controls the
 * fraction length (default 1). Uses the true minus sign to match the kWh chips.
 */
export function formatDeltaPct(pct: number | null | undefined, digits = 1): string {
  if (pct == null || !Number.isFinite(pct)) return DASH;
  const abs = Math.abs(pct).toFixed(digits).replace('.', ',');
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${abs}%`;
}

/**
 * Format a signed R$ deviation for the chip label: `"1234.56"` → `"+R$ 1.234,56"`,
 * `"-50.00"` → `"−R$ 50,00"`. `null`/invalid → {@link DASH}. Keeps the amount a
 * string; only the sign is derived (from the leading `-`).
 */
export function formatBRLDelta(amount: string | null | undefined): string {
  if (amount == null) return DASH;
  const parts = toDecimalParts(String(amount));
  if (!parts) return DASH;
  const isZero = parts.intDigits === '0' && parts.frac2 === '00';
  const sign = isZero ? '' : parts.negative ? '−' : '+';
  const grouped = groupThousands(parts.intDigits);
  return `${sign}R$ ${grouped},${parts.frac2}`;
}
