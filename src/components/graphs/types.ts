/**
 * Participation Chart Component — Types
 *
 * Share-of-total chart (pie/donut or horizontal bars) rendered with hand-rolled
 * SVG (no external chart libraries — library constraint). Each item shows its
 * absolute value + percent participation over the visible total.
 */

export type ParticipationChartType = 'pie' | 'bars';
export type ParticipationChartThemeMode = 'light' | 'dark';
export type ParticipationChartLegendPosition = 'bottom' | 'left' | 'top' | 'right';
export type ParticipationChartPaletteMode = 'myio' | 'random';

export interface ParticipationChartItem {
  /** Stable id — falls back to label when absent */
  id?: string;
  /** Human-readable label (legend, tooltip, bars) */
  label: string;
  /** Absolute value (consumption etc.) — participation percent is derived */
  value: number;
}

export interface ParticipationChartThemeColors {
  /** Chart block background */
  bg?: string;
  /** Main text color */
  text?: string;
  /** Border color */
  border?: string;
}

export interface ParticipationChartLegendSettings {
  /** default true */
  visible?: boolean;
  /** default 'bottom' */
  position?: ParticipationChartLegendPosition;
  /** default true — clicking a chip toggles the item out of the chart */
  selectable?: boolean;
}

export interface ParticipationChartExportSettings {
  /** default true */
  visible?: boolean;
  /** default true */
  pdf?: boolean;
  /** default true */
  png?: boolean;
}

export interface ParticipationChartSettings {
  /** default 'pie' */
  chartType?: ParticipationChartType;
  /** default true — small "Pizza | Barras" pill selector */
  showTypeSelector?: boolean;
  title?: string;
  subtitle?: string;
  /** Explicit colors per item — wins over paletteMode */
  palette?: string[];
  /** default 'myio' — 'random' derives a stable pseudo-random color from each label */
  paletteMode?: ParticipationChartPaletteMode;
  legend?: ParticipationChartLegendSettings;
  /** default 'light' */
  themeMode?: ParticipationChartThemeMode;
  /** Per-mode color overrides */
  theme?: {
    light?: ParticipationChartThemeColors;
    dark?: ParticipationChartThemeColors;
  };
  /** default true (subtle). Object form allows color/radius overrides. */
  border?: boolean | { color?: string; radius?: number };
  exportButtons?: ParticipationChartExportSettings;
  /** default true — InfoTooltip on slice/bar hover */
  tooltip?: boolean;
  /** default false — expand/minimize button (fullscreen overlay) */
  expandable?: boolean;
  /** default pt-BR with 2 decimals */
  formatValue?: (v: number) => string;
}

export interface ParticipationChartParams extends ParticipationChartSettings {
  items: ParticipationChartItem[];
  /** Value unit, e.g. 'kWh', 'm³' — shown in tooltips and bar labels */
  unit?: string;
}

export interface ParticipationChartInstance {
  /** Root element (appended to the container passed to the factory) */
  element: HTMLElement;
  /** Replace the dataset (hidden-item selection is kept by item key) */
  updateData: (items: ParticipationChartItem[]) => void;
  /** Merge-partial settings update and re-render */
  updateSettings: (settings: Partial<ParticipationChartSettings> & { unit?: string }) => void;
  setThemeMode: (mode: ParticipationChartThemeMode) => void;
  /** Keys (id ?? label) of items currently toggled OFF via the legend */
  getHiddenIds: () => string[];
  /** Items currently rendered (not hidden) */
  getVisibleItems: () => ParticipationChartItem[];
  /** Fullscreen overlay */
  expand: () => void;
  minimize: () => void;
  exportPNG: () => Promise<void>;
  exportPDF: () => Promise<void>;
  /** Rasteriza o gráfico em PNG (dataUrl) sem disparar download — p/ compor PDFs externos. */
  toPngDataUrl: () => Promise<{ dataUrl: string; width: number; height: number } | null>;
  destroy: () => void;
}

/**
 * Default MYIO categorical palette — brand purple first + complementary hues.
 * Ordering is CVD-safety-validated (dataviz six-checks: lightness band, chroma
 * floor, adjacent-pair CVD ΔE ≥ 8, normal-vision ΔE ≥ 15) for the light surface.
 */
export const MYIO_CHART_PALETTE: string[] = [
  '#7c3aed', // brand purple
  '#e34948', // red
  '#2a78d6', // blue
  '#008300', // green
  '#e87ba4', // magenta
  '#eda100', // yellow
  '#1baf7a', // aqua
  '#eb6834', // orange
];

/** Same hues stepped for dark surfaces (validated as a set for dark mode). */
export const MYIO_CHART_PALETTE_DARK: string[] = [
  '#9085e9', // brand purple (dark step)
  '#e66767', // red
  '#3987e5', // blue
  '#008300', // green
  '#d55181', // magenta
  '#c98500', // yellow
  '#199e70', // aqua
  '#d95926', // orange
];

export const DEFAULT_PARTICIPATION_CHART_SETTINGS: Required<
  Pick<
    ParticipationChartSettings,
    | 'chartType'
    | 'showTypeSelector'
    | 'paletteMode'
    | 'themeMode'
    | 'border'
    | 'tooltip'
    | 'expandable'
  >
> & {
  legend: Required<ParticipationChartLegendSettings>;
  exportButtons: Required<ParticipationChartExportSettings>;
} = {
  chartType: 'pie',
  showTypeSelector: true,
  paletteMode: 'myio',
  themeMode: 'light',
  border: true,
  tooltip: true,
  expandable: false,
  legend: { visible: true, position: 'bottom', selectable: true },
  exportButtons: { visible: true, pdf: true, png: true },
};
