/**
 * RFC-0228 F0 — money display formatting (decimal-string in, pt-BR BRL out).
 *
 * Proves: "1234.56" → "R$ 1.234,56"; null/missing/invalid → "—" (never NaN,
 * never a misleading R$ 0); large values group; and independent string inputs
 * like "0.10"/"0.20" are formatted verbatim, never summed as floats.
 */

import { describe, it, expect } from 'vitest';
import {
  formatBRL,
  formatBRLDelta,
  formatDeltaPct,
  computeDeltaPct,
  signOf,
  DASH,
} from '../../../src/components/financial-goals/moneyFormat';

describe('formatBRL', () => {
  it('formats a plain decimal string', () => {
    expect(formatBRL('1234.56')).toBe('R$ 1.234,56');
  });

  it('pads to two decimals', () => {
    expect(formatBRL('223000')).toBe('R$ 223.000,00');
    expect(formatBRL('0.1')).toBe('R$ 0,10');
  });

  it('groups large values (millions/billions) correctly', () => {
    expect(formatBRL('1000000.00')).toBe('R$ 1.000.000,00');
    expect(formatBRL('1234567890.99')).toBe('R$ 1.234.567.890,99');
  });

  it('renders — for null / undefined / empty / invalid (never NaN, never R$ 0)', () => {
    expect(formatBRL(null)).toBe(DASH);
    expect(formatBRL(undefined)).toBe(DASH);
    expect(formatBRL('')).toBe(DASH);
    expect(formatBRL('abc')).toBe(DASH);
    expect(formatBRL('R$ 5')).toBe(DASH); // not a bare decimal string
    expect(formatBRL(null)).not.toContain('NaN');
    expect(formatBRL(null)).not.toContain('0');
  });

  it('does not sum inputs — "0.10" and "0.20" format independently (no float error)', () => {
    // If these were ever added as JS numbers (0.1 + 0.2 = 0.30000000000000004),
    // formatting would drift. Each string is formatted verbatim instead.
    expect(formatBRL('0.10')).toBe('R$ 0,10');
    expect(formatBRL('0.20')).toBe('R$ 0,20');
    // The canonical string is the source of truth; no arithmetic is performed.
    expect(formatBRL('0.30')).toBe('R$ 0,30');
  });

  it('rounds half-up on the third decimal using string carry (no float)', () => {
    expect(formatBRL('1.005')).toBe('R$ 1,01');
    expect(formatBRL('0.999')).toBe('R$ 1,00'); // carry into the integer part
    expect(formatBRL('9.996')).toBe('R$ 10,00');
    expect(formatBRL('1.004')).toBe('R$ 1,00');
  });

  it('handles a negative amount', () => {
    expect(formatBRL('-1500.00')).toBe('R$ -1.500,00');
    expect(formatBRL('-0.00')).toBe('R$ 0,00'); // negative zero shows no sign
  });
});

describe('formatBRLDelta', () => {
  it('adds an explicit sign for the deviation chip', () => {
    expect(formatBRLDelta('1234.56')).toBe('+R$ 1.234,56');
    expect(formatBRLDelta('-50.00')).toBe('−R$ 50,00');
    expect(formatBRLDelta('0')).toBe('R$ 0,00');
  });
  it('renders — for missing/invalid', () => {
    expect(formatBRLDelta(null)).toBe(DASH);
    expect(formatBRLDelta('nope')).toBe(DASH);
  });
});

describe('formatDeltaPct + computeDeltaPct + signOf', () => {
  it('computes a signed deviation percentage from decimal strings', () => {
    // (128000 - 120000) / 120000 * 100 = 6.666…%
    const pct = computeDeltaPct('128000.00', '120000.00');
    expect(pct).toBeCloseTo(6.6667, 3);
    expect(formatDeltaPct(pct)).toBe('+6,7%');
  });

  it('returns null (→ —) when the baseline is zero or inputs invalid', () => {
    expect(computeDeltaPct('100', '0')).toBeNull();
    expect(computeDeltaPct(null, '100')).toBeNull();
    expect(computeDeltaPct('x', '100')).toBeNull();
    expect(formatDeltaPct(null)).toBe(DASH);
  });

  it('formats zero and negative percentages with the true minus sign', () => {
    expect(formatDeltaPct(0)).toBe('0,0%');
    expect(formatDeltaPct(-1.5)).toBe('−1,5%');
    expect(formatDeltaPct(3.2)).toBe('+3,2%');
  });

  it('signOf returns +/−/empty', () => {
    expect(signOf(5)).toBe('+');
    expect(signOf(-5)).toBe('−');
    expect(signOf(0)).toBe('');
    expect(signOf(null)).toBe('');
    expect(signOf(NaN)).toBe('');
  });
});
