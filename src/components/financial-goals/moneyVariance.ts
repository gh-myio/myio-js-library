/**
 * RFC-0228 A7 — Realized-vs-goal **variance in R$** for consumers (RFC-0182 rows /
 * RFC-0217 card).
 *
 * A2a (`financialIndicators.ts`) renders the *card-level* R$ row + deviation chip;
 * A6 (`reportMoneyColumn.ts`) renders the *aggregate report* R$ cost column. A7 is
 * the **per-consumer variance** variant: given one consumer's **realized R$**
 * (`monetaryProjection`) and its **goal/budget R$** (`currencyBudget`), it produces
 * a signed R$ variance (`realized − goal`) + a % (when the goal is non-zero) and a
 * chip that says **Abaixo da meta (R$)** (favorable), **Acima da meta (R$)**
 * (unfavorable), or — when the verdict is indeterminate or coverage is incomplete —
 * **Variação indisponível** (withheld).
 *
 * ── NAMING BRIDGE (RFC-0228 index §"Colisão de nomes `budget`"; F0 `moneyTypes.ts`) ─
 * A7 speaks **money** names only. `monetaryProjection` = realized R$; `currencyBudget`
 * = the R$ goal/budget target. It NEVER reads or writes the card's existing `budget`
 * prop, which is a **quantity** (kWh/m³) goal line, not money.
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * ── DEC-6 verdict-withholding (GCDR RFC-0054; A3 `budgetView.ts`) ───────────────
 * A conclusion (favorable/unfavorable) is emitted **only** when both amounts are
 * present AND coverage is confidently complete. When the overlay is `unavailable` /
 * `coverageComplete !== true`, an amount is missing, or the caller passes an explicit
 * withhold (a null {@link BudgetVerdict}), A7 returns the **withheld** verdict — no
 * green/red judgment, no fabricated R$ number. This mirrors A3's `buildVerdictHTML`.
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * ── WORDING CONTRACT (RFC-0228 feedback §8) — DO NOT DRIFT ──────────────────────
 * Management/coverage projection UX, not billing. ALLOWED: "Acima da meta (R$)",
 * "Abaixo da meta (R$)", "Variação indisponível", "Na meta (R$)". FORBIDDEN
 * (never emit): "Fatura", "Faturamento", "Valor final", "Total a pagar".
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * Design rules (mirroring F0/A2a/A6 on this branch):
 *  - **Pure.** HTML **strings** in/out (fits both the card's innerHTML model and
 *    `AllReportModal`'s cell splicing) + plain data. No `fetch`, no ThingsBoard.
 *  - **Amounts are decimal STRINGS.** The signed subtraction reuses A2a's
 *    {@link subtractDecimals} (integer-cent math, no float drift) and the sign /
 *    zero-goal test reuses A6's {@link decimalStringToCents} (`BigInt`) — **no
 *    `Number()` round-trip on any money amount**. The only `Number()` is F0's
 *    {@link computeDeltaPct}, a derived display metric.
 *  - **Gate = presence of config.** `createMoneyVarianceColumn(undefined)` yields a
 *    disabled column whose HTML methods all return `''`, and `renderMoneyVariance`
 *    returns `null` when there is nothing to show — so a host stays **byte-identical**
 *    to its pre-A7 output when money is off.
 */

import type { MoneyOverlay, BudgetVerdict } from './moneyTypes';
// A2a: the signed decimal subtraction (integer cents, no float drift). Reused, not duplicated.
import { subtractDecimals, type FinancialChipColors } from './financialIndicators';
// A6: BigInt cent parsing — used for the sign + zero-goal test (no Number() round-trip).
import { decimalStringToCents } from './reportMoneyColumn';
import { DASH, formatBRLDelta, formatDeltaPct, computeDeltaPct } from './moneyFormat';

/** §8 wording — the three chip headlines. No billing word ever. */
export const VARIANCE_LABEL_ABOVE = 'Acima da meta (R$)';
export const VARIANCE_LABEL_BELOW = 'Abaixo da meta (R$)';
export const VARIANCE_LABEL_ONTARGET = 'Na meta (R$)';
export const VARIANCE_LABEL_WITHHELD = 'Variação indisponível';

/** Default per-consumer variance column header (allowed §8 wording). */
export const MONEY_VARIANCE_HEADER = 'Variação vs meta (R$)';

/**
 * Per-consumer money variance input. Uses **money** names (naming bridge): realized
 * R$ is `monetaryProjection`, the R$ goal is `currencyBudget` — never the quantity
 * `budget` prop. When `currencyBudget` is omitted it defaults to the overlay's native
 * budget target (`overlay.budget.target.amount`), mirroring A2a's row resolution.
 */
export interface MoneyVarianceInput {
  /** Realizado em R$ (RFC-0054 monetary projection). Decimal string. */
  monetaryProjection?: string | null;
  /** Meta/orçamento em R$ (RFC-0054 CURRENCY target). Decimal string. */
  currencyBudget?: string | null;
  /**
   * Coverage overlay (F0) — the DEC-6 gate. `unavailable` or `coverageComplete !==
   * true` → the variance is **withheld** (no judgment, no number). Omitted → coverage
   * is not gating (the caller vouches the amounts are confident).
   */
  overlay?: MoneyOverlay | null;
  /**
   * Explicit withhold override — e.g. a null {@link BudgetVerdict.withinBudget} the
   * caller already resolved. `true` forces the withheld chip regardless of amounts.
   */
  withheld?: boolean;
}

/** The resolved verdict for one consumer's R$ variance. */
export type MoneyVarianceVerdict = 'below' | 'above' | 'onTarget' | 'withheld';

/** The pure result of {@link computeMoneyVariance}. */
export interface MoneyVarianceResult {
  /** `below` (favorable) / `above` (unfavorable) / `onTarget` / `withheld` (DEC-6). */
  verdict: MoneyVarianceVerdict;
  /** Signed R$ variance (`realized − goal`) as a decimal string; `null` when withheld. */
  variance: string | null;
  /** Signed % vs the goal (`null` when the goal is zero, missing, or withheld). */
  pct: number | null;
}

const WITHHELD_RESULT: MoneyVarianceResult = Object.freeze({
  verdict: 'withheld',
  variance: null,
  pct: null,
});

/** A decimal string is "present" when it is a non-empty, non-null string. */
function hasAmount(s: string | null | undefined): s is string {
  return typeof s === 'string' && s.trim() !== '';
}

/**
 * `true` when the overlay withholds the verdict per DEC-6 — i.e. it is present and
 * NOT confidently priced (`unavailable`, or `available` but `coverageComplete !==
 * true`). An absent overlay does not gate (returns `false`). Also honors an
 * explicit null {@link BudgetVerdict} carried on an available overlay's budget.
 */
export function overlayWithholdsVerdict(overlay: MoneyOverlay | null | undefined): boolean {
  if (!overlay || typeof (overlay as { state?: unknown }).state !== 'string') return false;
  if (overlay.state === 'unavailable') return true;
  if (overlay.coverageComplete !== true) return true;
  // A native budget verdict that is explicitly withheld (null) also withholds A7.
  const verdict: BudgetVerdict | undefined = overlay.budget?.verdict;
  if (verdict && verdict.withinBudget !== true && verdict.withinBudget !== false) {
    // Only treat as withheld when a budget block is actually present with a null verdict.
    return true;
  }
  return false;
}

/**
 * Resolve the R$ goal for a consumer: explicit `currencyBudget` wins; otherwise the
 * overlay's native budget target (`overlay.budget.target.amount`). Pure — the decimal
 * string passes through verbatim, never `Number()`-ed.
 */
export function resolveGoalAmount(input: MoneyVarianceInput): string | null {
  if (hasAmount(input.currencyBudget)) return input.currencyBudget as string;
  const overlay = input.overlay;
  if (overlay && overlay.state === 'available' && hasAmount(overlay.budget?.target?.amount)) {
    return overlay.budget!.target!.amount;
  }
  return null;
}

/**
 * Compute the signed R$ variance + verdict for one consumer. **DEC-6**: withholds
 * (no number, no judgment) when the overlay is not confidently priced, when either
 * amount is missing, when the caller forces `withheld`, or when the subtraction is
 * not well-formed. The subtraction reuses A2a's {@link subtractDecimals} (integer
 * cents, no float drift); the sign + zero-goal test reuse A6's
 * {@link decimalStringToCents} (`BigInt`) — no `Number()` touches a money amount.
 */
export function computeMoneyVariance(input: MoneyVarianceInput): MoneyVarianceResult {
  if (!input || input.withheld === true) return WITHHELD_RESULT;
  if (overlayWithholdsVerdict(input.overlay)) return WITHHELD_RESULT;

  const realized = hasAmount(input.monetaryProjection) ? (input.monetaryProjection as string) : null;
  const goal = resolveGoalAmount(input);
  if (realized == null || goal == null) return WITHHELD_RESULT;

  // A2a reuse — signed variance in integer cents (drift-free), returned as a string.
  const variance = subtractDecimals(realized, goal);
  if (variance == null) return WITHHELD_RESULT;

  // A6 reuse — sign of the variance and the zero-goal test via BigInt cents (no Number).
  const varCents = decimalStringToCents(variance);
  const goalCents = decimalStringToCents(goal);
  if (varCents == null) return WITHHELD_RESULT;

  // % only when the goal is a non-zero amount (avoids divide-by-zero / Infinity).
  const pct = goalCents != null && goalCents !== 0n ? computeDeltaPct(realized, goal) : null;

  const verdict: MoneyVarianceVerdict =
    varCents > 0n ? 'above' : varCents < 0n ? 'below' : 'onTarget';
  return { verdict, variance, pct };
}

/** Default chip palette — mirrors A2a's `DEFAULT_CHIP` (over=red, under=green, neutral=grey). */
const DEFAULT_CHIP: Required<FinancialChipColors> = {
  overBg: '#fee2e2',
  overText: '#b91c1c',
  underBg: '#dcfce7',
  underText: '#15803d',
  neutralBg: '#f1f5f9',
  neutralText: '#64748b',
};

const CHIP_BASE =
  'border-radius:999px;padding:2px 10px;font:700 11px Nunito,sans-serif;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;';

/**
 * Build the variance chip for one consumer as an HTML **string** (pure — no DOM). The
 * chip carries `data-money-variance="below|above|ontarget|withheld"` for tests.
 *
 * - **below** (favorable): green ↓ "Abaixo da meta (R$)" + signed R$ + %.
 * - **above** (unfavorable): red ↑ "Acima da meta (R$)" + signed R$ + %.
 * - **onTarget**: grey ≈ "Na meta (R$)" + R$ 0,00.
 * - **withheld** (DEC-6): grey "Variação indisponível" — **no number, no judgment**.
 */
export function buildMoneyVarianceHTML(
  input: MoneyVarianceInput,
  chipColors: Required<FinancialChipColors> = DEFAULT_CHIP
): string {
  const r = computeMoneyVariance(input);

  // DEC-6: withheld — never a green/red judgment, never a fabricated R$ number.
  if (r.verdict === 'withheld') {
    return (
      `<span data-money-variance="withheld" style="background:${chipColors.neutralBg};color:${chipColors.neutralText};${CHIP_BASE}">` +
      `${VARIANCE_LABEL_WITHHELD}</span>`
    );
  }

  const amount = hasAmount(r.variance) ? formatBRLDelta(r.variance) : DASH;
  const pctTxt = r.pct == null ? '' : ` &middot; ${formatDeltaPct(r.pct)}`;

  if (r.verdict === 'above') {
    return (
      `<span data-money-variance="above" title="${VARIANCE_LABEL_ABOVE}" style="background:${chipColors.overBg};color:${chipColors.overText};${CHIP_BASE}">` +
      `&#8593; ${VARIANCE_LABEL_ABOVE} ${amount}${pctTxt}</span>`
    );
  }
  if (r.verdict === 'below') {
    return (
      `<span data-money-variance="below" title="${VARIANCE_LABEL_BELOW}" style="background:${chipColors.underBg};color:${chipColors.underText};${CHIP_BASE}">` +
      `&#8595; ${VARIANCE_LABEL_BELOW} ${amount}${pctTxt}</span>`
    );
  }
  // onTarget — neutral, still a real number (variance is exactly 0), never withheld.
  return (
    `<span data-money-variance="ontarget" title="${VARIANCE_LABEL_ONTARGET}" style="background:${chipColors.neutralBg};color:${chipColors.neutralText};${CHIP_BASE}">` +
    `&#8776; ${VARIANCE_LABEL_ONTARGET} ${amount}${pctTxt}</span>`
  );
}

/** Options for {@link renderMoneyVariance} (the RFC-0217 card readout). */
export interface MoneyVarianceOptions extends MoneyVarianceInput {
  /** Optional leading label, e.g. "Meta em R$". Rendered before the chip. */
  label?: string;
  /** Chip palette override (defaults mirror A2a's `DEFAULT_CHIP`). */
  chipColors?: FinancialChipColors;
  /** Document to build in (defaults to the ambient `document`). */
  document?: Document;
}

/**
 * Render the per-consumer R$ variance as a live DOM element for the CustomerGoalsCard
 * (RFC-0217) — or `null` when there is nothing to show (money off), so the card stays
 * byte-identical to its quantity-only view.
 *
 * Gate: returns `null` when no overlay AND no amounts AND no explicit withhold were
 * given. Otherwise returns a `.myio-money-variance` element carrying the chip (which
 * is `withheld` under DEC-6 when coverage/verdict is indeterminate).
 */
export function renderMoneyVariance(options: MoneyVarianceOptions): HTMLElement | null {
  if (!options) return null;
  const hasOverlay =
    !!options.overlay && typeof (options.overlay as { state?: unknown }).state === 'string';
  const hasAnyAmount = hasAmount(options.monetaryProjection) || hasAmount(options.currencyBudget);
  // Gate off → nothing to append (card unchanged).
  if (!hasOverlay && !hasAnyAmount && options.withheld !== true) return null;

  const doc = options.document || (typeof document !== 'undefined' ? document : undefined);
  if (!doc) {
    throw new Error(
      'renderMoneyVariance requires a document (pass options.document in non-DOM envs).'
    );
  }

  const chipColors: Required<FinancialChipColors> = { ...DEFAULT_CHIP, ...options.chipColors };
  const root = doc.createElement('div');
  root.className = 'myio-money-variance';
  root.setAttribute('data-money-variance-row', '1');
  const label = hasAmount(options.label)
    ? `<span class="myio-money-variance__label" style="font:600 11px Nunito,sans-serif;color:var(--gc-muted, #64748b);margin-right:6px;">${escapeText(
        options.label as string
      )}</span>`
    : '';
  root.innerHTML =
    `<div style="display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px;">` +
    label +
    buildMoneyVarianceHTML(options, chipColors) +
    `</div>`;
  return root;
}

/** Escape untrusted label text for safe HTML interpolation. */
function escapeText(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Config for the per-consumer variance report column (mirrors A6's factory shape). */
export interface MoneyVarianceColumnConfig {
  /** Aggregate coverage overlay (F0) — DEC-6 gate for every row's verdict. */
  overlay: MoneyOverlay;
  /** Realizado R$ per device id (monetaryProjection). Same map A6 uses for its cost cell. */
  perDeviceRealized: Record<string, string | null | undefined>;
  /** Meta/orçamento R$ per device id (currencyBudget). Its presence enables the column. */
  perDeviceGoal: Record<string, string | null | undefined>;
  /** Column header label override (defaults to {@link MONEY_VARIANCE_HEADER}). */
  headerLabel?: string;
  /** Chip palette override. */
  chipColors?: FinancialChipColors;
}

/** A disabled or enabled variance column, exposing pure HTML-string fragments. */
export interface MoneyVarianceColumn {
  /** `false` when no config was given (gate off) — every method below returns `''`. */
  readonly enabled: boolean;
  /** `<th>` for the variance column, or `''` when disabled. */
  headerCellHTML(): string;
  /** `<td>` variance chip for one device id, or `''` when disabled. */
  bodyCellHTML(deviceId: string | null | undefined): string;
  /** Just the chip inner (without a `<td>`), or `''` when disabled. */
  cellValueHTML(deviceId: string | null | undefined): string;
}

const DISABLED_COLUMN: MoneyVarianceColumn = {
  enabled: false,
  headerCellHTML: () => '',
  bodyCellHTML: () => '',
  cellValueHTML: () => '',
};

/**
 * Build the per-consumer R$ variance column from a resolved config (mirrors A6's
 * `createReportMoneyColumn`). **Gate:** a `null`/absent config — or one with no
 * `perDeviceGoal` map — returns {@link DISABLED_COLUMN}, whose fragments are all `''`,
 * so a host splicing them stays byte-identical to its pre-A7 output.
 */
export function createMoneyVarianceColumn(
  config?: MoneyVarianceColumnConfig | null
): MoneyVarianceColumn {
  if (
    !config ||
    typeof (config.overlay as { state?: unknown })?.state !== 'string' ||
    !config.perDeviceGoal
  ) {
    return DISABLED_COLUMN;
  }

  const overlay = config.overlay;
  const perDeviceRealized = config.perDeviceRealized || {};
  const perDeviceGoal = config.perDeviceGoal || {};
  const label = config.headerLabel || MONEY_VARIANCE_HEADER;
  const chipColors: Required<FinancialChipColors> = { ...DEFAULT_CHIP, ...config.chipColors };

  const chipFor = (deviceId: string | null | undefined): string => {
    const id = hasAmount(deviceId) ? (deviceId as string) : null;
    return buildMoneyVarianceHTML(
      {
        overlay,
        monetaryProjection: id ? perDeviceRealized[id] : null,
        currencyBudget: id ? perDeviceGoal[id] : null,
      },
      chipColors
    );
  };

  return {
    enabled: true,
    headerCellHTML: () =>
      `<th data-money-variance-col="1" style="text-align:right;white-space:nowrap;">${label}</th>`,
    bodyCellHTML: (deviceId) =>
      `<td data-money-variance-col="1" data-label="${label}" style="text-align:right;">${chipFor(
        deviceId
      )}</td>`,
    cellValueHTML: (deviceId) => chipFor(deviceId),
  };
}
