/**
 * RFC-0228 F0 — Money foundation: the **naming bridge** + normalized money types.
 *
 * The word `budget` collides three ways across this codebase and the GCDR wire
 * (RFC-0228 index §"Colisão de nomes `budget`"; feedback-v1 §3). This module
 * resolves the collision **explicitly** so no downstream (A4/A2a/A3) code can
 * conflate them:
 *
 *   1. {@link QuantityGoal}       — the existing kWh/m³ **Meta / Orçado** line.
 *                                    This is what local components today call
 *                                    `budget` (`CustomerGoalsCard/types.ts`:
 *                                    `budget`/`budgetBreakdown`/`orcado`,
 *                                    GCDR RFC-0052 `adjustedValue`).
 *                                    **NOT money.** A quantity in kWh or m³.
 *   2. {@link MonetaryProjection} — R$ **derived** from `?withMoney=true`
 *                                    (the `money` block + per-node
 *                                    `monetaryValue`). A projection, not a target.
 *   3. {@link CurrencyBudget}     — the **native** `measure=CURRENCY` target
 *                                    (GCDR RFC-0054 `budget.target`). The only
 *                                    one that should carry the frontend name
 *                                    `currencyBudget`.
 *
 * Design rules (mirroring the A1 tariff client on this branch):
 *  - **Pure / framework-agnostic.** No DOM, no ThingsBoard.
 *  - **Amounts are decimal STRINGS end to end** (`"223000.00"`), never JSON
 *    numbers. Nothing here calls `Number()` — display formatting lives in
 *    `moneyFormat.ts`.
 *  - **Honest coverage is a first-class value, not an error.** The `unavailable`
 *    state and `coverageComplete:false` are normal 200-body outcomes
 *    (API guide §4.2, §7; GCDR RFC-0054 DEC-6). `withinBudget`/`variance` stay
 *    `null` while coverage is incomplete.
 */

/** Money-capable (SUM) domain for goals overlay/budget. Mirrors WIRE domain. */
export type MoneyDomain = 'ENERGY' | 'WATER';

/**
 * Bridge #1 — the **quantity** goal line (kWh / m³). This is the RFC-0052
 * `adjustedValue` "Meta / Orçado" that local components already expose under the
 * prop name `budget`. Kept here **only to name it away from money**: a
 * `QuantityGoal` is a consumption target, never R$. Downstream code that means
 * "the kWh/m³ goal" should reference this type, never a `budget` money field.
 */
export interface QuantityGoal {
  /** SUM domain the goal belongs to. */
  domain: MoneyDomain;
  /** Physical unit of the target, e.g. `"kWh"` or `"m³"`. NOT a currency. */
  unit: string;
  /**
   * The nested quantity tree exactly as the goals API returns it. `value`s are
   * quantities (numbers on the wire); a `monetaryValue` sibling, when present,
   * is the money **projection** (decimal string) — see {@link MonetaryProjection}.
   */
  tree: GoalTreeNode;
  /** Optimistic-concurrency counter (`0` = never set). */
  version: number;
}

/** One node of a goals tree (quantity `value` + optional money projection). */
export interface GoalTreeNode {
  /** Quantity target at this node (kWh/m³) — a number on the wire. NOT money. */
  value?: number;
  /**
   * R$ projection for this node from `?withMoney=true` — a **decimal string**
   * (`"223000.00"`). Preserved verbatim; never `Number()`-ed or summed here.
   */
  monetaryValue?: string;
  annual?: GoalTreeNode;
  monthly?: Record<string, GoalTreeNode>;
  daily?: Record<string, GoalTreeNode>;
  hourly?: Record<string, GoalTreeNode>;
  [k: string]: unknown;
}

/** A device excluded from a money sum because it carries no `tariffCategory`. */
export interface UncategorizedDevice {
  deviceId: string;
  code?: string;
  label?: string;
}

/** Tariff-coverage gap detail from the `money` block (API guide §4.2). */
export interface TariffCoverageGaps {
  /** Missing hour refs, e.g. `["2026-03-01T00"]`. */
  missing: string[];
  /** `true` when the `missing` list was capped for size. */
  truncated: boolean;
  /** Count of device-hours with no priced tariff. */
  missingHours: number;
}

/**
 * Bridge #3 — the **native** R$ budget target (`measure=CURRENCY`,
 * GCDR RFC-0054 `budget.target`). This is the ONLY concept that should carry the
 * frontend name `currencyBudget`. Amount is a decimal string.
 */
export interface CurrencyBudget {
  /** R$ target amount (decimal string). */
  amount: string;
  /** Provenance, e.g. `"NATIVE"`. */
  source: string;
}

/**
 * The budget **verdict** — projection vs. native target. Both fields are
 * **nullable and null together** while coverage is incomplete: the UI must never
 * declare in/over-budget over a partial projection (GCDR RFC-0054 DEC-6).
 */
export interface BudgetVerdict {
  /** `true`/`false` only when fully covered; `null` while `coverageComplete:false`. */
  withinBudget: boolean | null;
  /** R$ variance (projection − target) as a decimal string; `null` while incomplete. */
  variance: string | null;
}

/**
 * The normalized budget overlay carried inside an `available` {@link MoneyOverlay}.
 * Wraps the wire `budget` block's `variance`/`withinBudget` into a single
 * {@link BudgetVerdict} so callers read one honest verdict, not two loose fields.
 */
export interface BudgetOverlay {
  /** R$ projection derived from the overlay (may be partial). */
  projected: { amount: string; source: string; coverageComplete: boolean };
  /** Native R$ target, present only when a CURRENCY goal exists. */
  target?: CurrencyBudget;
  /** The suppressed-while-incomplete verdict (DEC-6). */
  verdict: BudgetVerdict;
}

/**
 * Bridge #2 — the R$ **money overlay**, normalized into a discriminated union
 * that removes the `money:null`-vs-`money:{reason}` ambiguity the wire carries
 * (feedback-v1 §6). Exactly two states, both first-class 200-body outcomes:
 *
 *  - `available`   — a device-granular goal was priced; `coverageComplete` says
 *                    whether every device-hour was covered. Amounts are decimal
 *                    strings. `budget` present only when a CURRENCY goal exists.
 *  - `unavailable` — no money view (e.g. a customer-granular goal →
 *                    `MONEY_REQUIRES_DEVICE_GRANULARITY`). NOT an error.
 */
export type MoneyOverlay =
  | {
      state: 'available';
      currency: string;
      coverageComplete: boolean;
      /** Priced device-hours (numerator of coverage). */
      pricedHours?: number;
      /** Total device-hours (denominator of coverage). */
      totalHours?: number;
      tariffCoverageGaps?: TariffCoverageGaps;
      uncategorizedDevices: UncategorizedDevice[];
      budget?: BudgetOverlay;
    }
  | {
      state: 'unavailable';
      reason: 'MONEY_REQUIRES_DEVICE_GRANULARITY' | string;
    };

/**
 * Bridge #2 as a standalone read — the R$ projection over a whole goal, with the
 * normalized overlay and the (verbatim, string-amount) tree it priced. Returned
 * by `goalsMoneyClient.getGoalWithMoney`.
 */
export interface MonetaryProjection {
  customerId: string;
  domain: MoneyDomain;
  year: number;
  /** Goal measure — `QUANTITY` for a withMoney overlay read. */
  measure: 'QUANTITY' | 'CURRENCY';
  /** Optimistic-concurrency counter. */
  version: number;
  /** The quantity goal that was priced (values are quantities; strings stay strings). */
  goal: QuantityGoal;
  /** Normalized money overlay (`available` | `unavailable`). */
  money: MoneyOverlay;
}

/** Canonical terminal reason for a withheld money view. */
export const MONEY_REQUIRES_DEVICE_GRANULARITY = 'MONEY_REQUIRES_DEVICE_GRANULARITY';

/** The raw money block as it may arrive on the wire (either ambiguous shape). */
export type RawMoneyBlock =
  | null
  | undefined
  | {
      reason?: string;
      currency?: string;
      coverageComplete?: boolean;
      pricedHours?: number;
      totalHours?: number;
      tariffCoverageGaps?: TariffCoverageGaps;
      uncategorizedDevices?: UncategorizedDevice[];
      [k: string]: unknown;
    };

/** The raw `budget` sibling block as it arrives on the wire (API guide §4.2). */
export type RawBudgetBlock =
  | null
  | undefined
  | {
      projected?: { amount?: string; source?: string; coverageComplete?: boolean };
      target?: { amount?: string; source?: string } | null;
      variance?: string | null;
      withinBudget?: boolean | null;
      [k: string]: unknown;
    };

/**
 * Collapse the two backend money shapes into the single normalized
 * {@link MoneyOverlay} discriminated union (feedback-v1 §6):
 *
 *  - `money: null` (the reason travels out-of-band; `null` cannot carry a field)
 *      → `{ state: 'unavailable', reason: MONEY_REQUIRES_DEVICE_GRANULARITY }`.
 *  - `money: { reason }` (no coverage fields)
 *      → `{ state: 'unavailable', reason }`.
 *  - a populated block (has `currency` or `coverageComplete`)
 *      → `{ state: 'available', … }`, amounts kept as decimal strings.
 *
 * The optional `rawBudget` (the sibling `budget` block, not inside `money`) is
 * folded into the `available` variant's `budget`, with `variance`/`withinBudget`
 * wrapped into a {@link BudgetVerdict}. Coverage/verdict values are passed through
 * untouched — never coerced to `true`/`false`/`0` (DEC-6 honesty).
 */
export function normalizeMoneyBlock(
  raw: RawMoneyBlock,
  rawBudget?: RawBudgetBlock
): MoneyOverlay {
  // Shape A: money is null/undefined — reason cannot ride on `null`, so use the
  // canonical terminal reason. This is a coverage state, not an error.
  if (raw == null) {
    return { state: 'unavailable', reason: MONEY_REQUIRES_DEVICE_GRANULARITY };
  }

  const hasCoverageFields =
    typeof raw.currency === 'string' || typeof raw.coverageComplete === 'boolean';

  // Shape B: money is `{ reason }` with no coverage fields — unavailable.
  if (!hasCoverageFields) {
    const reason =
      typeof raw.reason === 'string' && raw.reason
        ? raw.reason
        : MONEY_REQUIRES_DEVICE_GRANULARITY;
    return { state: 'unavailable', reason };
  }

  // Shape C: a populated, available money block.
  const overlay: Extract<MoneyOverlay, { state: 'available' }> = {
    state: 'available',
    currency: typeof raw.currency === 'string' ? raw.currency : 'BRL',
    coverageComplete: raw.coverageComplete === true,
    uncategorizedDevices: Array.isArray(raw.uncategorizedDevices)
      ? raw.uncategorizedDevices
      : [],
  };
  if (typeof raw.pricedHours === 'number') overlay.pricedHours = raw.pricedHours;
  if (typeof raw.totalHours === 'number') overlay.totalHours = raw.totalHours;
  if (raw.tariffCoverageGaps) overlay.tariffCoverageGaps = raw.tariffCoverageGaps;

  const budget = normalizeBudgetBlock(rawBudget);
  if (budget) overlay.budget = budget;

  return overlay;
}

/**
 * Normalize the wire `budget` sibling block into a {@link BudgetOverlay}, wrapping
 * `variance`/`withinBudget` into one {@link BudgetVerdict}. Returns `undefined`
 * when no budget block is present (no CURRENCY goal). Null verdict fields are
 * preserved as `null` — never coerced (DEC-6).
 */
export function normalizeBudgetBlock(
  rawBudget: RawBudgetBlock
): BudgetOverlay | undefined {
  if (rawBudget == null || typeof rawBudget !== 'object') return undefined;
  const projected = rawBudget.projected;
  if (!projected || typeof projected.amount !== 'string') return undefined;

  const overlay: BudgetOverlay = {
    projected: {
      amount: projected.amount,
      source: typeof projected.source === 'string' ? projected.source : 'OVERLAY',
      coverageComplete: projected.coverageComplete === true,
    },
    verdict: {
      // Explicit `null` when withheld; only pass a boolean through unchanged.
      withinBudget:
        typeof rawBudget.withinBudget === 'boolean' ? rawBudget.withinBudget : null,
      // Variance stays a decimal string, or null while incomplete.
      variance:
        typeof rawBudget.variance === 'string' ? rawBudget.variance : null,
    },
  };
  if (
    rawBudget.target &&
    typeof rawBudget.target === 'object' &&
    typeof rawBudget.target.amount === 'string'
  ) {
    overlay.target = {
      amount: rawBudget.target.amount,
      source:
        typeof rawBudget.target.source === 'string'
          ? rawBudget.target.source
          : 'NATIVE',
    };
  }
  return overlay;
}
