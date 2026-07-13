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
}

export interface CustomerGoalsSeries {
  /** Bucket labels (months "Jan".."Dez", days "01/07"…, or hours) */
  labels: string[];
  /** Consumption of the current period, one point per bucket (null = gap) */
  realized: Array<number | null>;
  /** Same buckets, previous year (optional — strip cell/badge omitted when absent) */
  previousYear?: Array<number | null>;
  /** Goal per bucket (optional — strip cell/badge omitted when absent) */
  budget?: Array<number | null>;
  /**
   * Realized broken down per device/meter (optional). When present, the CHART
   * plots one series per entry (palette colors + per-card legend) INSTEAD of
   * the consolidated `realized` line — the card stays one-per-shopping and
   * only the chart changes. Totals/badges keep reading `realized` (falling
   * back to the element-wise sum of the breakdown when `realized` is empty).
   */
  breakdown?: Array<{ name: string; values: Array<number | null> }>;
}

export interface CustomerGoalsTotals {
  realized?: number | null;
  previousYear?: number | null;
  budget?: number | null;
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
