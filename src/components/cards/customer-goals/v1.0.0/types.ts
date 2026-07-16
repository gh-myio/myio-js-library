/**
 * CustomerGoalsCard v1.0.0 — types (RFC-0217)
 * Per-shopping "small multiples" card: 3-series sparkline (Realizado, A-1, Orçado),
 * totals strip and variance badges (vs A-1, vs Orçado).
 * Visual spec: logs/025-card-GoalsByCustomer.png
 */

export type CustomerGoalsThemeMode = 'light' | 'dark';

export type CustomerGoalsChartType = 'line' | 'bar';

export interface CustomerGoalsCardOptions {
  /** 'line' (default) or 'bar'. Orçado stays a dashed LINE overlay in both. */
  chartType?: CustomerGoalsChartType;
  /** Draw point markers on line series (default true). false = smooth line only. */
  showPoints?: boolean;
  /**
   * Stack the breakdown series (default false = side-by-side). Only applies
   * when series.breakdown is present: bar → stacked bars (A-1 keeps its own
   * bar); line → stacked area. Orçado stays an independent dashed line.
   */
  breakdownStacked?: boolean;
  /**
   * Series color overrides — lets the host propagate its dashboard palette
   * (e.g. green head office accent) into the card. Applies to the chart AND
   * the totals-strip labels. Defaults: realized #6c5ce7, previousYear #94a3b8,
   * budget #f59e0b. `breakdownPalette` replaces the built-in multicolor
   * palette used for per-device breakdown series (cycled when devices > colors).
   */
  colors?: {
    realized?: string;
    previousYear?: string;
    /** Meta line (adjustedValue). Default #f59e0b (amber, dashed). */
    budget?: string;
    /** Orçado line (raw value, when `series.orcado` present). Default #0ea5e9 (sky, dashed). */
    orcado?: string;
    breakdownPalette?: string[];
  };
}

export interface CustomerGoalsSeries {
  /** Bucket labels (months "Jan".."Dez", days "01/07"…, or hours) */
  labels: string[];
  /** Consumption of the current period, one point per bucket (null = gap) */
  realized: Array<number | null>;
  /** Same buckets, previous year (optional — strip cell/badge omitted when absent) */
  previousYear?: Array<number | null>;
  /**
   * Goal per bucket = **Meta** (RFC-0052 adjustedValue, budget × margin).
   * Optional — strip cell/badge omitted when absent. When `orcado` (raw budget)
   * is ALSO provided this series is relabeled "Meta" in the chart/legend and the
   * totals-strip Orçado column shows a discrete "Meta <value>" sub-line under the
   * raw Orçado. When `orcado` is absent the card behaves exactly as before (this
   * single series is the dashed amber "Orçado" line — full backward-compat).
   */
  budget?: Array<number | null>;
  /**
   * Raw **Orçado** per bucket = GCDR `value` BEFORE the RFC-0052 margin
   * (optional). When present ALONGSIDE `budget` (= Meta) the chart plots a SECOND
   * overlay line for Orçado (own color/legend entry), `budget` is relabeled
   * "Meta", and the totals-strip Orçado column shows Orçado on top with a discrete
   * "Meta <value>" underneath (3 columns, 2 rows). Absent = legacy single-goal
   * behavior. For DEVICE-granular years (`budgetBreakdown`, per-meter Meta lines)
   * this stays a single CONSOLIDATED Orçado line so the chart is not crowded.
   */
  orcado?: Array<number | null>;
  /**
   * Realized broken down per device/meter (optional). When present, the CHART
   * plots one series per entry (palette colors + per-card legend) INSTEAD of
   * the consolidated `realized` line — the card stays one-per-shopping and
   * only the chart changes. Totals/badges keep reading `realized` (falling
   * back to the element-wise sum of the breakdown when `realized` is empty).
   */
  breakdown?: Array<{ name: string; values: Array<number | null> }>;
  /**
   * Goal (Orçado) broken down per entry meter (optional — RFC-0046 Addendum A
   * DEVICE-granular years). When present, the chart plots one DASHED goal line
   * per entry (palette colors, labeled "Orçado · <name>") INSTEAD of the
   * consolidated `budget` line. Totals/badges keep reading `budget` (falling
   * back to the element-wise sum of this breakdown when `budget` is absent).
   */
  budgetBreakdown?: Array<{ name: string; values: Array<number | null> }>;
  /**
   * Per-meter goal detail for the CONSOLIDATED budget line tooltip (optional).
   * Only used when the consolidated `budget` line is plotted (i.e. no
   * `budgetBreakdown`): hovering the Orçado point appends one line per meter —
   * per-bucket `values` when available, otherwise the `annual` total with an
   * "(anual)" note. Ignored when `budgetBreakdown` is present.
   */
  budgetDetail?: Array<{ name: string; values?: Array<number | null>; annual?: number | null }>;
}

export interface CustomerGoalsTotals {
  realized?: number | null;
  previousYear?: number | null;
  /** Meta total (adjustedValue). */
  budget?: number | null;
  /** Orçado total (raw value). Shown as a sub-line under Orçado when present. */
  orcado?: number | null;
}

export interface CustomerGoalsCardParams {
  container: HTMLElement;
  /** Shopping / unit name (card title) */
  title: string;
  series: CustomerGoalsSeries;
  /** Unit driving tick/total formatting. Default 'kWh'. */
  unit?: string;
  /** e.g. { current: '2026', previous: '2025' } — used in tooltips/aria only */
  yearLabels?: { current: string; previous: string };
  /** Optional totals override; default = sum of non-null series points */
  totals?: CustomerGoalsTotals;
  /** Default 'light' */
  themeMode?: CustomerGoalsThemeMode;
  /** Default 'pt-BR' */
  locale?: string;
  /** Chart rendering options (points on/off, line|bar) */
  options?: CustomerGoalsCardOptions;
  /** Show the expand-to-fullscreen button (default true) */
  expandable?: boolean;
  /** Optional click-through on the card title */
  onClick?: (info: { title: string }) => void;
}

export interface CustomerGoalsCardInstance {
  el: HTMLElement;
  update(partial: Partial<Pick<CustomerGoalsCardParams, 'series' | 'totals' | 'title'>>): void;
  setThemeMode(mode: CustomerGoalsThemeMode): void;
  /** Apply chart options (points on/off, line|bar) and re-render the chart */
  setOptions(options: CustomerGoalsCardOptions): void;
  /** Expand the card to fullscreen / collapse it back. force: true=expand, false=collapse */
  toggleExpand(force?: boolean): void;
  destroy(): void;
}
