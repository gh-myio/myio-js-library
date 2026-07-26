/**
 * RFC-0228 A6 — R$ money column for aggregate report rows/totals (`reportMoneyColumn.ts`).
 *
 * Proves:
 *  - the R$ cell renders beside kWh, formatted per DEC-8 (exact string, no re-derive);
 *  - the footer total is a **string/cent (BigInt)** sum with **no float drift** — and
 *    prefers the backend-authoritative parent over the row-sum (DEC-8 top-down);
 *  - incomplete/unavailable coverage → A4 coverage indicator, **no number, no R$ 0**;
 *  - the gate: a `null` config yields a disabled column whose fragments are all `''`
 *    (so a host splicing them stays byte-identical when money is off);
 *  - the §8 wording contract (no billing words, no NaN).
 *
 * Also pins the DEC-8 `round_half_up` golden vectors (V1 sum, V2 tie) at the
 * cent-parse boundary. Pure — jsdom, no fetch.
 */

import { describe, it, expect } from 'vitest';
import {
  createReportMoneyColumn,
  isMoneyColumnConfident,
  sumMoneyDecimals,
  decimalStringToCents,
  centsToDecimalString,
  REPORT_MONEY_HEADER,
  type ReportMoneyColumnConfig,
} from '../../../src/components/financial-goals/reportMoneyColumn';
import type { MoneyOverlay } from '../../../src/components/financial-goals/moneyTypes';
import { MONEY_REQUIRES_DEVICE_GRANULARITY } from '../../../src/components/financial-goals/moneyTypes';

/** Words that would turn this projection UX into billing wording (§8). */
const FORBIDDEN = ['fatura', 'faturamento', 'valor final', 'total a pagar'];

function assertNoForbidden(text: string): void {
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN) {
    expect(lower).not.toContain(word);
  }
  expect(text).not.toContain('NaN');
}

const complete: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: true,
  pricedHours: 87600,
  totalHours: 87600,
  uncategorizedDevices: [],
};

const incomplete: MoneyOverlay = {
  state: 'available',
  currency: 'BRL',
  coverageComplete: false,
  pricedHours: 61320,
  totalHours: 87600,
  uncategorizedDevices: [{ deviceId: 'dev-9', code: 'Q9', label: 'Loja 9' }],
};

const unavailable: MoneyOverlay = {
  state: 'unavailable',
  reason: MONEY_REQUIRES_DEVICE_GRANULARITY,
};

function cfg(over: Partial<ReportMoneyColumnConfig> = {}): ReportMoneyColumnConfig {
  return {
    overlay: complete,
    perDevice: { a: '1234.56', b: '10.00', c: '0.44' },
    ...over,
  };
}

// ── cent / string math primitives (DEC-8 half-up + BigInt no-drift) ─────────────

describe('decimalStringToCents / centsToDecimalString (DEC-8 half-up, BigInt)', () => {
  it('parses a plain 2dp decimal string to integer cents', () => {
    expect(decimalStringToCents('1234.56')).toBe(123456n);
    expect(decimalStringToCents('10')).toBe(1000n);
    expect(decimalStringToCents('0.44')).toBe(44n);
    expect(decimalStringToCents('-50.00')).toBe(-5000n);
  });

  it('DEC-8 V2 tie: round_half_up at the 3rd fraction digit, half away from zero', () => {
    // "raw = 2.005000 → 2.01"  (naive float64 toFixed would give 2.00 — must NOT)
    expect(centsToDecimalString(decimalStringToCents('2.005')!)).toBe('2.01');
    // "raw = 644.004999 → 644.00"
    expect(centsToDecimalString(decimalStringToCents('644.004999')!)).toBe('644.00');
    // "raw = 644.005000 → 644.01"
    expect(centsToDecimalString(decimalStringToCents('644.005')!)).toBe('644.01');
  });

  it('carries 0.99x half-up into the integer part without float', () => {
    expect(centsToDecimalString(decimalStringToCents('2.999')!)).toBe('3.00');
  });

  it('returns null for non-decimal input (caller renders —)', () => {
    expect(decimalStringToCents('abc')).toBeNull();
    expect(decimalStringToCents('')).toBeNull();
    expect(decimalStringToCents(null)).toBeNull();
    expect(decimalStringToCents(undefined)).toBeNull();
  });
});

describe('sumMoneyDecimals (integer-cent BigInt sum, no float drift)', () => {
  it('DEC-8 V1-style band sum is exact', () => {
    // 220.00 + 120.00 + 240.00 + 64.00 = 644.00
    expect(sumMoneyDecimals(['220.00', '120.00', '240.00', '64.00'])).toBe('644.00');
  });

  it('does NOT drift on a case that float addition would corrupt', () => {
    // Naive: 0.1 + 0.2 = 0.30000000000000004 ; ten 0.10 accumulate to 0.9999999999999999.
    expect(sumMoneyDecimals(['0.10', '0.20'])).toBe('0.30');
    const tenDimes = Array.from({ length: 10 }, () => '0.10');
    expect(sumMoneyDecimals(tenDimes)).toBe('1.00');
    // Prove the float path WOULD have drifted (guards the test's own premise).
    const floatSum = tenDimes.reduce((s, v) => s + Number(v), 0);
    expect(floatSum).not.toBe(1); // 0.9999999999999999
  });

  it('stays exact beyond Number.MAX_SAFE_INTEGER cents (BigInt)', () => {
    // 99_999_999_999_999.99 + 0.02 = 100_000_000_000_000.01 (cents exceed 2^53)
    expect(sumMoneyDecimals(['99999999999999.99', '0.02'])).toBe('100000000000000.01');
  });

  it('returns null when any value is missing/invalid — an honest "cannot total"', () => {
    expect(sumMoneyDecimals(['1.00', null, '2.00'])).toBeNull();
    expect(sumMoneyDecimals([])).toBeNull();
  });
});

// ── the column: cells, header, total, coverage, gate ────────────────────────────

describe('createReportMoneyColumn — R$ cell beside kWh (available, DEC-8 display)', () => {
  it('renders the R$ cell with the backend string formatted per DEC-8 (exact)', () => {
    const col = createReportMoneyColumn(cfg());
    expect(col.enabled).toBe(true);
    const cell = col.bodyCellHTML('a');
    // "1234.56" → "R$ 1.234,56" (string-based BRL, never Number()-round-tripped).
    expect(cell).toContain('R$ 1.234,56');
    expect(cell).toContain('data-money-col="1"');
    expect(cell.startsWith('<td')).toBe(true);
  });

  it('renders — (not R$ 0) for a device with no money value', () => {
    const col = createReportMoneyColumn(cfg());
    const cell = col.bodyCellHTML('missing-id');
    expect(cell).toContain('—');
    expect(cell).not.toContain('R$ 0');
  });

  it('header uses the allowed §8 label', () => {
    const col = createReportMoneyColumn(cfg());
    expect(col.headerCellHTML()).toContain(REPORT_MONEY_HEADER);
    expect(REPORT_MONEY_HEADER).toBe('Custo projetado (R$)');
    assertNoForbidden(col.headerCellHTML());
  });
});

describe('createReportMoneyColumn — footer total (honest, DEC-8)', () => {
  it('sums the visible rows via cent math when no backend total is provided', () => {
    const col = createReportMoneyColumn(cfg());
    const rows = ['1234.56', '10.00', '0.44']; // = 1245.00
    const total = col.resolveTotal(rows);
    expect(total).not.toBeNull();
    expect(total!.kind).toBe('amount');
    if (total!.kind === 'amount') {
      expect(total!.amount).toBe('1245.00');
      expect(total!.formatted).toBe('R$ 1.245,00');
      expect(total!.source).toBe('row-sum');
    }
    expect(col.totalHTML(rows)).toContain('R$ 1.245,00');
  });

  it('PREFERS the backend-authoritative parent over the row-sum (DEC-8 top-down)', () => {
    // Rows of already-rounded children sum to 644.00, but the backend parent =
    // round(Σ full-precision raws) = 644.01. DEC-8 says show the parent, not the sum.
    const col = createReportMoneyColumn(cfg({ total: '644.01' }));
    const total = col.resolveTotal(['322.00', '322.00']); // = 644.00
    expect(total!.kind).toBe('amount');
    if (total!.kind === 'amount') {
      expect(total!.amount).toBe('644.01');
      expect(total!.source).toBe('backend');
    }
    expect(col.totalHTML(['322.00', '322.00'])).toContain('R$ 644,01');
  });

  it('renders a "vs Meta" note when the overlay carries a variance', () => {
    const col = createReportMoneyColumn(cfg({ total: '1000.00', variance: '-50.00' }));
    const html = col.totalHTML();
    expect(html).toContain('vs Meta');
    expect(html).toContain('−R$ 50,00'); // true-minus signed delta
    assertNoForbidden(html);
  });

  it('falls back to coverage when rows are missing under a complete overlay', () => {
    const col = createReportMoneyColumn(cfg());
    const total = col.resolveTotal(['1234.56', null]); // cannot honestly total
    expect(total!.kind).toBe('coverage');
    const html = col.totalHTML(['1234.56', null]);
    expect(html).not.toContain('data-money-total="amount"');
    expect(html).not.toContain('R$ 0');
  });
});

describe('createReportMoneyColumn — honest coverage (incomplete / unavailable)', () => {
  it('incomplete coverage → A4 indicator, NO numeric total, NO R$ 0', () => {
    const col = createReportMoneyColumn(cfg({ overlay: incomplete, total: '900.00' }));
    expect(isMoneyColumnConfident(incomplete)).toBe(false);
    const total = col.resolveTotal(['500.00', '400.00']);
    expect(total!.kind).toBe('coverage'); // even with a backend total present
    const html = col.totalHTML(['500.00', '400.00']);
    expect(html).toContain('Cobertura incompleta');
    expect(html).not.toContain('data-money-total="amount"');
    expect(html).not.toContain('R$ 0');
    assertNoForbidden(html);
  });

  it('unavailable coverage → A4 indicator, no number', () => {
    const col = createReportMoneyColumn(cfg({ overlay: unavailable }));
    const total = col.resolveTotal(['1.00']);
    expect(total!.kind).toBe('coverage');
    const html = col.totalHTML();
    expect(html).toContain('indisponível');
    expect(html).not.toContain('R$ 0');
    assertNoForbidden(html);
  });
});

describe('createReportMoneyColumn — GATE OFF is byte-identical', () => {
  it('a null/undefined config yields a disabled column whose fragments are all ""', () => {
    for (const c of [null, undefined]) {
      const col = createReportMoneyColumn(c);
      expect(col.enabled).toBe(false);
      expect(col.headerCellHTML()).toBe('');
      expect(col.bodyCellHTML('a')).toBe('');
      expect(col.cellValueHTML('a')).toBe('');
      expect(col.totalHTML(['1.00'])).toBe('');
      expect(col.resolveTotal(['1.00'])).toBeNull();
    }
  });

  it('splicing the disabled fragments into a host template changes nothing', () => {
    const col = createReportMoneyColumn(null);
    const baseline =
      `<tr><td>ID</td><td>Name</td><td>123 kWh</td><td>10%</td></tr>`;
    const withColumn =
      `<tr><td>ID</td><td>Name</td><td>123 kWh</td>${col.bodyCellHTML('a')}<td>10%</td></tr>`;
    expect(withColumn).toBe(baseline); // byte-identical when the money gate is off
  });
});

describe('createReportMoneyColumn — wording contract across every state', () => {
  it('emits no billing-grade word and no NaN in any state', () => {
    const states: MoneyOverlay[] = [complete, incomplete, unavailable];
    for (const overlay of states) {
      const col = createReportMoneyColumn(cfg({ overlay, total: '1234.56', variance: '12.34' }));
      assertNoForbidden(col.headerCellHTML());
      assertNoForbidden(col.bodyCellHTML('a'));
      assertNoForbidden(col.totalHTML(['1234.56']));
    }
  });
});
