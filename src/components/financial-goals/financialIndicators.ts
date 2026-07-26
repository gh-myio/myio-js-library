/**
 * RFC-0228 A2a — The R$ money overlay row for one shopping card (pilot).
 *
 * Given the existing **quantity** KPIs of a Metas × Consumo card (A-1 / Realizado
 * / Orçado / Meta in kWh/m³) and a normalized {@link MoneyOverlay} (F0,
 * `moneyTypes.ts`), this renderer produces the **parallel R$ view** for that one
 * card:
 *
 *  - When money coverage is honest and complete (`available` +
 *    `coverageComplete:true`): a **R$ row** — Realizado / Orçado / Meta em R$
 *    (decimal strings via {@link formatBRL}) — plus a **deviation chip in R$**
 *    (Realizado vs Meta, falling back to vs A-1), signed/coloured exactly like the
 *    card's kWh/m³ deviation chip (↑ over = red, ↓ under = green, ≈ = grey).
 *  - When coverage is `unavailable` **or** `coverageComplete:false`: it **defers to
 *    A4** ({@link renderCoverageView}) and shows the honest coverage state instead
 *    of any R$ number. It **never invents `R$ 0`** and **never prints a total** over
 *    a partial projection (GCDR RFC-0054 DEC-6; API guide §4.2).
 *  - When there is **no overlay** (money source not configured / gate off): it
 *    returns `null` — the caller appends nothing and the card stays byte-identical
 *    to the kWh-only view.
 *
 * The A5a deep-link callbacks (`onCategorizeDevice`, `onManageCategories`) are
 * passed straight through to A4.
 *
 * ── WORDING CONTRACT (RFC-0228 feedback §8) ─────────────────────────────────────
 * This is coverage/estimation UX, not billing. The R$ row labels itself
 * "Estimativa em R$"; the incomplete/unavailable states reuse A4, which already
 * enforces the no-"fatura"/"faturamento"/"valor final" wording. Do not introduce a
 * billing-grade word here.
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * Design rules (mirroring F0/A4 on this branch):
 *  - **Pure component.** DOM/HTML output + inputs/callbacks only. No `fetch`, no
 *    ThingsBoard, no API calls. It receives a `MoneyOverlay`; it never fetches one.
 *  - **Amounts are decimal STRINGS.** The only `Number()` is inside the deviation
 *    percent (reused from F0 `computeDeltaPct`) — a derived display metric. The R$
 *    row amounts are formatted string-in / string-out ({@link formatBRL}),
 *    never round-tripped through a float.
 *  - **Never `R$ 0`, never `NaN`.** A missing amount renders `—` (F0 `DASH`).
 */

import type { MoneyOverlay } from './moneyTypes';
import { renderCoverageView, type CoverageViewOptions } from './coverageView';
import {
  DASH,
  formatBRL,
  formatBRLDelta,
  formatDeltaPct,
  computeDeltaPct,
} from './moneyFormat';

/**
 * The R$ amounts for a card's money row, each a **decimal string** (`"223000.00"`)
 * or `null`/absent when unknown. Sourced from the overlay's `monetaryValue`s /
 * `money`/`budget` block by the caller (or derived by
 * {@link resolveMoneyRowValues}). A missing value renders `—`, never `R$ 0`.
 */
export interface FinancialMoneyValues {
  /** Realizado em R$ (realized consumption priced). Optional — goal overlays may not carry it. */
  realized?: string | null;
  /** Orçado em R$. Defaults to `overlay.budget.projected.amount` when omitted. */
  orcado?: string | null;
  /** Meta em R$ (native CURRENCY target). Defaults to `overlay.budget.target.amount` when omitted. */
  meta?: string | null;
  /** A-1 em R$ (previous-year realized priced). Optional. */
  prevYear?: string | null;
}

/** Per-role chip palette (defaults mirror the Metas × Consumo `devChip`). */
export interface FinancialChipColors {
  /** Realizado > reference (spending over): red by default. */
  overBg?: string;
  overText?: string;
  /** Realizado < reference (spending under): green by default. */
  underBg?: string;
  underText?: string;
  /** ~equal / no data: grey by default. */
  neutralBg?: string;
  neutralText?: string;
}

/** Per-role value colours for the three R$ figures (label/number tint). */
export interface FinancialValueColors {
  realized?: string;
  orcado?: string;
  meta?: string;
  prevYear?: string;
}

/** Options for {@link renderFinancialIndicators}. */
export interface FinancialIndicatorsOptions {
  /**
   * The normalized money overlay for this card (F0). Drives the gate:
   *  - `null`/`undefined` → renderer returns `null` (money off → no R$ row).
   *  - `unavailable` / `available`+`coverageComplete:false` → A4 coverage view.
   *  - `available`+`coverageComplete:true` → the R$ row.
   */
  overlay: MoneyOverlay | null | undefined;
  /**
   * Explicit R$ amounts (decimal strings). When omitted for `orcado`/`meta`, they
   * are derived from `overlay.budget`. `realized`/`prevYear` are only shown when
   * given (a goal `withMoney` read does not carry realized R$).
   */
  money?: FinancialMoneyValues;
  /**
   * Deviation-chip reference: `'meta'` (default; falls back to `'prevYear'` when
   * Meta em R$ is absent) or `'prevYear'`.
   */
  chipBaseline?: 'meta' | 'prevYear';
  /** Chip palette override (defaults mirror the card's kWh chip). */
  chipColors?: FinancialChipColors;
  /** Value-figure colour override (defaults: Realizado blue, Orçado orange, Meta purple). */
  valueColors?: FinancialValueColors;
  /** A5a per-device deep-link, passed through to A4 in the incomplete state. */
  onCategorizeDevice?: (deviceId: string) => void;
  /** A5a generic deep-link, passed through to A4 in the unavailable state. */
  onManageCategories?: () => void;
  /** Document to build in (defaults to the ambient `document`). */
  document?: Document;
}

/** Default chip palette — identical hues to the Metas × Consumo `devChip`. */
const DEFAULT_CHIP: Required<FinancialChipColors> = {
  overBg: '#fee2e2',
  overText: '#b91c1c',
  underBg: '#dcfce7',
  underText: '#15803d',
  neutralBg: '#f1f5f9',
  neutralText: '#64748b',
};

/** Default value hues — Realizado blue, Orçado orange, Meta purple, A-1 grey. */
const DEFAULT_VALUE_COLORS: Required<FinancialValueColors> = {
  realized: '#2563eb',
  orcado: '#f59e0b',
  meta: '#7c3aed',
  prevYear: '#94a3b8',
};

/** |pct| below this reads as "≈" (neutral) — parallel to the kWh chip. */
const APPROX_PCT = 1;

/** A decimal string is "present" when it is a non-empty, non-null string. */
function hasAmount(s: string | null | undefined): s is string {
  return typeof s === 'string' && s.trim() !== '';
}

/**
 * Resolve the three R$ figures for the row: explicit `money.*` wins; otherwise
 * `orcado` ← `overlay.budget.projected.amount` and `meta` ← `overlay.budget.target.amount`.
 * `realized`/`prevYear` come only from `money` (a goal overlay carries no realized R$).
 * Pure — decimal strings pass through verbatim, never `Number()`-ed.
 */
export function resolveMoneyRowValues(
  overlay: MoneyOverlay | null | undefined,
  money?: FinancialMoneyValues
): Required<FinancialMoneyValues> {
  const budget =
    overlay && overlay.state === 'available' ? overlay.budget : undefined;
  const orcado = hasAmount(money?.orcado)
    ? (money!.orcado as string)
    : hasAmount(budget?.projected?.amount)
    ? (budget!.projected.amount as string)
    : null;
  const meta = hasAmount(money?.meta)
    ? (money!.meta as string)
    : hasAmount(budget?.target?.amount)
    ? (budget!.target!.amount as string)
    : null;
  return {
    realized: hasAmount(money?.realized) ? (money!.realized as string) : null,
    orcado,
    meta,
    prevYear: hasAmount(money?.prevYear) ? (money!.prevYear as string) : null,
  };
}

const CHIP_BASE =
  'border-radius:999px;padding:2px 10px;font:700 11px Nunito,sans-serif;white-space:nowrap;';

/**
 * Build the deviation chip (Realizado vs reference) from two R$ decimal strings.
 * Arrow + percent, coloured by sign exactly like the card's kWh chip: ↑ over = red,
 * ↓ under = green, ≈ (|pct|<1) / missing = grey. The signed R$ delta rides in the
 * `title`. Returns an HTML string. `computeDeltaPct` is the single allowed
 * `Number()` (a display metric); the R$ amounts stay strings.
 */
function chipHTML(
  realized: string | null,
  reference: string | null,
  colors: Required<FinancialChipColors>
): string {
  const pct = computeDeltaPct(realized, reference);
  if (pct == null) {
    return `<span data-fin-chip="none" style="background:${colors.neutralBg};color:${colors.neutralText};${CHIP_BASE}">${DASH}</span>`;
  }
  const deltaAmount =
    hasAmount(realized) && hasAmount(reference)
      ? formatBRLDelta(subtractDecimals(realized, reference))
      : DASH;
  const pctTxt = formatDeltaPct(pct);
  if (Math.abs(pct) < APPROX_PCT) {
    return `<span data-fin-chip="approx" title="${deltaAmount}" style="background:${colors.neutralBg};color:${colors.neutralText};${CHIP_BASE}">&#8776; ${pctTxt}</span>`;
  }
  if (pct > 0) {
    return `<span data-fin-chip="over" title="${deltaAmount}" style="background:${colors.overBg};color:${colors.overText};${CHIP_BASE}">&#8593; ${pctTxt}</span>`;
  }
  return `<span data-fin-chip="under" title="${deltaAmount}" style="background:${colors.underBg};color:${colors.underText};${CHIP_BASE}">&#8595; ${pctTxt}</span>`;
}

/** Parse a decimal string into integer cents (half-up on the 3rd digit), or null. */
function parseCents(s: string | null | undefined): number | null {
  if (!hasAmount(s)) return null;
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const whole = Number(m[2]);
  const frac = (m[3] || '').padEnd(3, '0');
  let cents = Number(frac.slice(0, 2));
  if (frac.charAt(2) >= '5') cents += 1;
  const total = whole * 100 + cents;
  return Number.isFinite(total) ? sign * total : null;
}

/**
 * Subtract two decimal strings and return a decimal string (`"1234.56"`), used only
 * for the chip's title/tooltip R$ delta. Pure cents math (2dp, sign preserved) —
 * no float round-trip on the amounts. Returns `null` on invalid input.
 */
export function subtractDecimals(
  a: string | null | undefined,
  b: string | null | undefined
): string | null {
  const pa = parseCents(a);
  const pb = parseCents(b);
  if (pa == null || pb == null) return null;
  const diff = pa - pb; // BRL cents for a panel sum are well within MAX_SAFE_INTEGER
  const neg = diff < 0;
  const abs = Math.abs(diff);
  const intPart = Math.trunc(abs / 100);
  const cents = String(abs % 100).padStart(2, '0');
  return `${neg ? '-' : ''}${intPart}.${cents}`;
}

/** One R$ figure cell: coloured label + formatted amount (or `—`). */
function figureHTML(label: string, amount: string | null, color: string): string {
  return (
    `<span style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">` +
    `<span style="color:${color};font-weight:700;">${label}</span>` +
    `<b style="color:var(--gc-text2, #334155);font-weight:700;">${formatBRL(amount)}</b>` +
    `</span>`
  );
}

/**
 * Build the R$ row (available + complete state) as an HTML **string** (pure — no
 * DOM). Realizado / Orçado / Meta em R$ + the deviation chip. Directly testable.
 */
export function buildFinancialRowHTML(
  values: Required<FinancialMoneyValues>,
  chipBaseline: 'meta' | 'prevYear',
  chipColors: Required<FinancialChipColors>,
  valueColors: Required<FinancialValueColors>
): string {
  const reference =
    chipBaseline === 'prevYear'
      ? values.prevYear
      : hasAmount(values.meta)
      ? values.meta
      : values.prevYear;
  const figures = [
    figureHTML('Realizado', values.realized, valueColors.realized),
    figureHTML('Orçado', values.orcado, valueColors.orcado),
    figureHTML('Meta', values.meta, valueColors.meta),
  ].join('');
  return (
    `<div class="myio-fin__row" data-fin-row="1" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">` +
    `<div style="font:600 11px Nunito,sans-serif;color:var(--gc-muted, #64748b);display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;">` +
    `<span aria-hidden="true">💰</span>` +
    figures +
    `</div>` +
    chipHTML(values.realized, reference, chipColors) +
    `</div>` +
    `<div class="myio-fin__note" style="font:600 10px Nunito,sans-serif;color:var(--gc-muted, #94a3b8);margin-top:2px;">Estimativa em R$</div>`
  );
}

/**
 * Render the R$ money view for one shopping card as a live DOM element — or `null`
 * when there is no overlay (money off).
 *
 * - No overlay → `null` (caller appends nothing; card unchanged).
 * - `unavailable` / `available`+`coverageComplete:false` → **A4**
 *   {@link renderCoverageView} (honest coverage; never R$ numbers, never R$ 0).
 * - `available`+`coverageComplete:true` → the R$ row (Realizado/Orçado/Meta em R$
 *   + deviation chip). The element carries `data-fin-state="available-money"`.
 */
export function renderFinancialIndicators(
  options: FinancialIndicatorsOptions
): HTMLElement | null {
  const overlay = options?.overlay;
  // Gate: no overlay (money source not configured / not resolved) → no R$ row.
  if (!overlay || typeof (overlay as { state?: unknown }).state !== 'string') {
    return null;
  }

  const doc =
    options.document || (typeof document !== 'undefined' ? document : undefined);
  if (!doc) {
    throw new Error(
      'renderFinancialIndicators requires a document (pass options.document in non-DOM envs).'
    );
  }

  const coverageOpts: CoverageViewOptions = {
    onCategorizeDevice: options.onCategorizeDevice,
    onManageCategories: options.onManageCategories,
    document: doc,
  };

  // Defer to A4 for every non-confident state — unavailable OR partial coverage.
  if (overlay.state === 'unavailable' || overlay.coverageComplete !== true) {
    return renderCoverageView(overlay, coverageOpts);
  }

  // available + coverageComplete: the R$ row.
  const values = resolveMoneyRowValues(overlay, options.money);
  const chipColors: Required<FinancialChipColors> = { ...DEFAULT_CHIP, ...options.chipColors };
  const valueColors: Required<FinancialValueColors> = {
    ...DEFAULT_VALUE_COLORS,
    ...options.valueColors,
  };
  const chipBaseline = options.chipBaseline === 'prevYear' ? 'prevYear' : 'meta';

  const root = doc.createElement('div');
  root.className = 'myio-fin';
  root.setAttribute('data-fin-state', 'available-money');
  root.innerHTML = buildFinancialRowHTML(values, chipBaseline, chipColors, valueColors);
  return root;
}
