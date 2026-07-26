/**
 * RFC-0228 A6 — R$ money column for **aggregate report rows/totals**.
 *
 * A6 is the report/summary face of the money layer: it puts an R$ figure **beside**
 * the existing kWh/m³ column of `AllReportModal` (RFC-0182) and the energy summary,
 * on the **DEC-8 rounding contract** (GCDR RFC-0054). It reuses A2a/F0 formatting
 * (`formatMoneyBRL`) and A4's honest-coverage discipline (`buildCoverageHTML`) — it
 * re-implements neither a BRL formatter nor a coverage renderer.
 *
 * ── DEC-8 (GCDR RFC-0054-Monetary-Goals-and-Customer-Tariffs.md §DEC-8), verbatim ──
 *   "The server computes every R$; clients consume the decimal string and never
 *    re-derive. Money is `numeric`, serialized as a **decimal string**, never a
 *    JSON number."
 *   "monetaryValue(N) = round_half_up(raw(N), 2)  [round ONCE, at this node's boundary]"
 *   "One rounding boundary, top-down. Parent = round(Σ child full-precision raws),
 *    NOT the sum of children's already-rounded values."
 *   "round_half_up operates on the exact decimal value at 2 places (BRL), half away
 *    from zero."
 *
 * How A6 obeys DEC-8:
 *  1. **Never re-derive.** Per-row R$ (`perDevice[id]`) and the aggregate come from
 *     the backend as decimal strings and are only *formatted* for display via
 *     {@link formatMoneyBRL} — never `Number()`-round-tripped.
 *  2. **Prefer the backend parent total.** Because "Parent = round(Σ child
 *     full-precision raws), NOT the sum of children's already-rounded values", the
 *     backend-authoritative aggregate (`total`) is the correct footer number; A6
 *     shows it verbatim when provided.
 *  3. **String-only fallback sum.** When the backend does not hand down a parent
 *     total, A6 sums the already-2dp per-row values in **integer cents via `BigInt`**
 *     (no float, no new rounding boundary — the rows are already `round_half_up`ed).
 *     This is a display convenience clearly derived from the visible rows, not a
 *     re-derivation of the priced raw.
 *  4. **Honest coverage.** When the overlay is `unavailable` or coverage is
 *     incomplete, the footer/summary shows A4's coverage indicator — **never** R$ 0,
 *     NaN, or a partial sum presented as a complete total.
 *
 * ── WORDING CONTRACT (RFC-0228 feedback §8) — DO NOT DRIFT ──────────────────────
 * Management projection UX, not billing. ALLOWED: "Custo projetado", "Estimado R$",
 * "Cobertura incompleta". FORBIDDEN (never emit): "Fatura", "Faturamento",
 * "Valor final", "Total a pagar".
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * Design rules (mirroring F0/A2a/A4 on this branch):
 *  - **Pure.** HTML **strings** in/out (fits `AllReportModal`'s innerHTML model) +
 *    plain data. No `fetch`, no ThingsBoard. It receives a resolved money config; it
 *    never fetches one.
 *  - **Amounts are decimal STRINGS.** The only integer math is `BigInt` cents; no
 *    `Number()` is applied to a money string.
 *  - **Gate = presence of config.** `createReportMoneyColumn(undefined)` yields a
 *    disabled column whose every HTML method returns `''`, so a host that splices the
 *    fragments in is **byte-identical** to its pre-A6 output when money is off.
 */

import type { MoneyOverlay } from './moneyTypes';
// `formatBRL` is the string-based BRL formatter (top-level re-export: `formatMoneyBRL`).
import { DASH, formatBRL as formatMoneyBRL, formatBRLDelta } from './moneyFormat';
import { buildCoverageHTML } from './coverageView';

/** Default R$ column header — allowed §8 wording, never a billing word. */
export const REPORT_MONEY_HEADER = 'Custo projetado (R$)';

/** Config for the R$ report column. Absent/`null` → the column is disabled (gate off). */
export interface ReportMoneyColumnConfig {
  /**
   * Aggregate money overlay (F0) — drives the honest-coverage gate for the total:
   *  - `available` + `coverageComplete:true` → a numeric R$ total is shown.
   *  - `unavailable` / `coverageComplete:false` → A4 coverage indicator, no number.
   */
  overlay: MoneyOverlay;
  /** Per-device R$ (backend `monetaryValue`, DEC-8 2dp) keyed by device id (ingestionId). */
  perDevice: Record<string, string | null | undefined>;
  /**
   * Backend-authoritative aggregate R$ (DEC-8 top-down parent). **Preferred** for the
   * footer total when present; when absent A6 falls back to a BigInt-cent row sum.
   */
  total?: string | null;
  /**
   * Optional R$ deviation vs the meta (e.g. `overlay.budget.verdict.variance`).
   * Rendered as a small "vs Meta" note beside the total when coverage is complete.
   * A7 owns the per-consumer variance chip — A6 only surfaces the report-total delta.
   */
  variance?: string | null;
  /** Column header label override (defaults to {@link REPORT_MONEY_HEADER}). */
  headerLabel?: string;
}

/** The resolved report/summary total: either a confident amount or a coverage state. */
export type ReportMoneyTotal =
  | { kind: 'amount'; amount: string; formatted: string; source: 'backend' | 'row-sum' }
  | { kind: 'coverage'; overlay: MoneyOverlay };

/** A disabled or enabled R$ column, exposing pure HTML-string fragments for a host. */
export interface ReportMoneyColumn {
  /** `false` when no config was given (gate off) — every method below returns `''`/`null`. */
  readonly enabled: boolean;
  /** `<th>` for the R$ column, or `''` when disabled. */
  headerCellHTML(): string;
  /** `<td>` R$ cell for one device id (formatted backend string or `—`), or `''` when disabled. */
  bodyCellHTML(deviceId: string | null | undefined): string;
  /** Just the formatted cell inner (`"R$ …"`/`—`) without a `<td>`, or `''` when disabled. */
  cellValueHTML(deviceId: string | null | undefined): string;
  /**
   * Resolve the footer/summary total honestly. `rowValues` (aligned to the counted
   * rows) is only used for the DEC-8 fallback row-sum when no backend total is given.
   * Returns `null` when disabled.
   */
  resolveTotal(rowValues?: Array<string | null | undefined>): ReportMoneyTotal | null;
  /**
   * Footer/summary total as HTML: a formatted R$ (+ optional "vs Meta" note) when
   * coverage is complete, else A4's coverage indicator. `''` when disabled.
   */
  totalHTML(rowValues?: Array<string | null | undefined>): string;
}

/** True when the overlay is confidently priced (available + fully covered). */
export function isMoneyColumnConfident(overlay: MoneyOverlay | null | undefined): boolean {
  return (
    !!overlay &&
    (overlay as { state?: string }).state === 'available' &&
    (overlay as { coverageComplete?: boolean }).coverageComplete === true
  );
}

/** A decimal string is "present" when it is a non-empty, non-null string. */
function hasAmount(s: string | null | undefined): s is string {
  return typeof s === 'string' && s.trim() !== '';
}

/**
 * Parse a decimal string into **integer cents** as a `BigInt` — pure string ops, no
 * float. Per DEC-8 the input is already `round_half_up(·,2)`; a stray 3rd digit is
 * defensively rounded half-up (half away from zero) via BigInt carry, never `Number`.
 * Returns `null` for anything that is not a finite decimal string.
 */
export function decimalStringToCents(s: string | null | undefined): bigint | null {
  if (!hasAmount(s)) return null;
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!m) return null;
  const negative = m[1] === '-';
  const whole = BigInt(m[2]);
  const frac = m[3] || '';
  let cents = BigInt(frac.slice(0, 2).padEnd(2, '0')); // 0..99
  // round_half_up on the 3rd fraction digit (defensive; DEC-8 rows are already 2dp).
  if (frac.charAt(2) >= '5') cents += 1n; // may reach 100 → carries into `whole` below
  const total = whole * 100n + cents;
  return negative ? -total : total;
}

/** Format `BigInt` cents back to a 2dp decimal string (`-12345n` → `"-123.45"`). */
export function centsToDecimalString(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const rem = abs % 100n;
  return `${negative ? '-' : ''}${whole.toString()}.${rem.toString().padStart(2, '0')}`;
}

/**
 * Sum a set of decimal-string amounts and return a decimal string — **integer-cent
 * `BigInt` math, never float** (so `"0.10" + "0.20"` is exactly `"0.30"`, and a long
 * run of `x.xx` cents that would drift under `Number()` addition does not drift here).
 *
 * DEC-8: the rows are already `round_half_up(·,2)`; summing their 2dp cents introduces
 * **no new rounding boundary**. Returns `null` when the input is empty or **any** value
 * is missing/invalid — an honest "cannot total", never a silent partial sum.
 */
export function sumMoneyDecimals(values: Array<string | null | undefined>): string | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  let acc = 0n;
  for (const v of values) {
    const c = decimalStringToCents(v);
    if (c == null) return null; // cannot honestly total with a missing/invalid row
    acc += c;
  }
  return centsToDecimalString(acc);
}

/** One R$ figure cell inner: formatted backend string, or `—` (never `R$ 0`/NaN). */
function cellInner(value: string | null | undefined): string {
  return `<span data-money-cell="1">${formatMoneyBRL(value ?? null)}</span>`;
}

/** The variance-vs-meta note ("vs Meta ±R$ …"), or `''` when absent. */
function varianceNoteHTML(variance: string | null | undefined): string {
  if (!hasAmount(variance)) return '';
  return (
    `<span data-money-variance="1" style="margin-left:6px;font:600 10px Nunito,sans-serif;color:var(--myio-text-muted,#94a3b8);">` +
    `vs Meta ${formatBRLDelta(variance)}` +
    `</span>`
  );
}

const DISABLED_COLUMN: ReportMoneyColumn = {
  enabled: false,
  headerCellHTML: () => '',
  bodyCellHTML: () => '',
  cellValueHTML: () => '',
  resolveTotal: () => null,
  totalHTML: () => '',
};

/**
 * Build the R$ report column from a resolved money config. **Gate:** a `null`/absent
 * config returns {@link DISABLED_COLUMN} — every HTML method emits `''`, so a host
 * that interpolates the fragments stays byte-identical to its pre-A6 output.
 */
export function createReportMoneyColumn(
  config?: ReportMoneyColumnConfig | null
): ReportMoneyColumn {
  if (!config || typeof (config.overlay as { state?: unknown })?.state !== 'string') {
    return DISABLED_COLUMN;
  }

  const overlay = config.overlay;
  const perDevice = config.perDevice || {};
  const label = config.headerLabel || REPORT_MONEY_HEADER;

  const valueFor = (deviceId: string | null | undefined): string | null | undefined =>
    hasAmount(deviceId) ? perDevice[deviceId as string] : null;

  const resolveTotal = (
    rowValues?: Array<string | null | undefined>
  ): ReportMoneyTotal => {
    // Honest coverage: only a confidently-priced overlay yields a number.
    if (!isMoneyColumnConfident(overlay)) {
      return { kind: 'coverage', overlay };
    }
    // DEC-8: "Parent = round(Σ child full-precision raws), NOT the sum of children's
    // already-rounded values" — so the backend parent total is authoritative; prefer it.
    if (hasAmount(config.total)) {
      return {
        kind: 'amount',
        amount: config.total as string,
        formatted: formatMoneyBRL(config.total as string),
        source: 'backend',
      };
    }
    // Fallback: sum the already-2dp rows in integer cents (no float, no re-rounding).
    const summed = sumMoneyDecimals(rowValues || []);
    if (summed == null) {
      // Cannot honestly total (missing rows) → defer to the coverage indicator.
      return { kind: 'coverage', overlay };
    }
    return {
      kind: 'amount',
      amount: summed,
      formatted: formatMoneyBRL(summed),
      source: 'row-sum',
    };
  };

  return {
    enabled: true,
    headerCellHTML: () =>
      `<th data-money-col="1" style="text-align:right;white-space:nowrap;">${label}</th>`,
    bodyCellHTML: (deviceId) =>
      `<td data-money-col="1" data-label="${label}" style="text-align:right;font-weight:bold;">${cellInner(
        valueFor(deviceId)
      )}</td>`,
    cellValueHTML: (deviceId) => cellInner(valueFor(deviceId)),
    resolveTotal,
    totalHTML: (rowValues) => {
      const total = resolveTotal(rowValues);
      if (total.kind === 'coverage') {
        // A4 owns the honest coverage UI — never a number, never R$ 0.
        return `<span data-money-total="coverage">${buildCoverageHTML(total.overlay, false)}</span>`;
      }
      return (
        `<span data-money-total="amount" data-money-source="${total.source}">${total.formatted}</span>` +
        varianceNoteHTML(config.variance)
      );
    },
  };
}

/** Re-export so hosts can pull the DASH sentinel without a second import. */
export { DASH };
