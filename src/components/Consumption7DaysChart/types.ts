/**
 * RFC-0098: View Consumption Over 7 Days Component
 * Type definitions for the reusable consumption chart component
 */

// Chart.js type reference (assumes Chart.js is loaded globally or as dependency)
declare const Chart: any;

/**
 * Supported chart domains
 */
export type ChartDomain = 'energy' | 'water' | 'gas' | 'temperature' | string;

/**
 * Theme modes
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Chart visualization types
 */
export type ChartType = 'line' | 'bar';

/**
 * Visualization modes
 */
export type VizMode = 'total' | 'separate';

/**
 * Ideal range configuration for shaded area on chart
 * Used to highlight acceptable/target ranges for any domain
 */
export interface IdealRangeConfig {
  /** Minimum value of the ideal range */
  min: number;
  /** Maximum value of the ideal range */
  max: number;
  /** Color for the shaded area (with alpha for transparency) */
  color?: string;
  /** Border color for the range box */
  borderColor?: string;
  /** Optional label to display */
  label?: string;
  /** Whether to show the range (default: true when min/max are set) */
  enabled?: boolean;
}

/**
 * Temperature reference line configuration
 */
export interface TemperatureReferenceLine {
  /** Value for the reference line */
  value: number;
  /** Label for the reference line */
  label: string;
  /** Line color */
  color: string;
  /** Line style: 'solid', 'dashed', 'dotted' */
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  /** Line width (default: 2) */
  lineWidth?: number;
  /** Fill area above or below the line */
  fillArea?: 'above' | 'below' | 'none';
  /** Fill color (with alpha) */
  fillColor?: string;
}

/**
 * Temperature-specific configuration
 */
export interface TemperatureConfig {
  /** Minimum temperature reference line */
  minThreshold?: TemperatureReferenceLine;
  /** Maximum temperature reference line */
  maxThreshold?: TemperatureReferenceLine;
  /** Ideal range (shows shaded area between min and max) */
  idealRange?: {
    min: number;
    max: number;
    color: string;
    label?: string;
  };
  /** Clamp values outside this range for display */
  clampRange?: {
    min: number;
    max: number;
  };
  /** Show temperature unit in Y-axis (default: true) */
  showUnitInAxis?: boolean;
}

/**
 * Color configuration for the chart
 */
export interface Consumption7DaysColors {
  /** Primary line/bar color */
  primary: string;
  /** Background fill color (for line charts) */
  background: string;
  /** Optional gradient colors [start, end] */
  gradient?: [string, string];
  /** Optional border color */
  borderColor?: string;
  /** Optional point colors for line charts */
  pointBackground?: string;
  pointBorder?: string;
  /** Colors for per-shopping datasets (separate mode) */
  shoppingColors?: string[];
}

/**
 * Single data point for consumption
 */
export interface ConsumptionDataPoint {
  /** ISO date string or formatted label */
  date: string;
  /** Consumption value in base unit */
  value: number;
  /** Optional custom label override */
  label?: string;
}

/**
 * Data point with shopping information (for per-shopping mode)
 */
export interface ShoppingDataPoint extends ConsumptionDataPoint {
  /** Shopping identifier */
  shoppingId: string;
  /** Shopping display name */
  shoppingName: string;
}

/**
 * Structured data for the 7-day consumption chart
 */
export interface Consumption7DaysData {
  /** Array of date labels for X-axis */
  labels: string[];
  /** Array of total consumption values per day */
  dailyTotals: number[];
  /** Optional per-shopping data: { shoppingId: [values per day...] } */
  shoppingData?: Record<string, number[]>;
  /** Optional shopping name mapping: { shoppingId: displayName } */
  shoppingNames?: Record<string, string>;
  /** Timestamp when data was fetched (for cache validation) */
  fetchTimestamp?: number;
  /** Customer IDs used to fetch this data (for cache validation) */
  customerIds?: string[];
}

/**
 * Configuration options for creating the consumption chart
 */
export interface Consumption7DaysConfig {
  // ============================================
  // REQUIRED PARAMETERS
  // ============================================

  /** Domain identifier (energy, water, etc.) - used for logging */
  domain: ChartDomain;

  /** Canvas element ID to render the chart */
  containerId: string;

  /** Base unit for display (kWh, m³, etc.) */
  unit: string;

  /**
   * Data fetching function - must return structured data
   * @param period - Number of days to fetch
   * @returns Promise resolving to consumption data
   */
  fetchData: (period: number) => Promise<Consumption7DaysData>;

  // ============================================
  // OPTIONAL - UNIT CONFIGURATION
  // ============================================

  /** Large unit for values above threshold (MWh, etc.) - null to disable */
  unitLarge?: string | null;

  /** Threshold value to switch to large unit (1000 for kWh->MWh) */
  thresholdForLargeUnit?: number | null;

  /** Decimal places for value display */
  decimalPlaces?: number;

  // ============================================
  // OPTIONAL - APPEARANCE
  // ============================================

  /** Color configuration */
  colors?: Consumption7DaysColors;

  /** Chart title (optional, usually in container header) */
  title?: string;

  /** Show legend below chart */
  showLegend?: boolean;

  /** Line tension for smooth curves (0-1, default: 0.4) */
  lineTension?: number;

  /** Point radius for line charts (default: 4) */
  pointRadius?: number;

  /** Border width for lines/bars (default: 2) */
  borderWidth?: number;

  /** Fill area under line chart (default: true) */
  fill?: boolean;

  /** Theme mode: 'light' or 'dark' (default: 'light') */
  theme?: ThemeMode;

  // ============================================
  // OPTIONAL - BEHAVIOR
  // ============================================

  /** Default period in days (default: 7) */
  defaultPeriod?: number;

  /** Default chart type (default: 'line') */
  defaultChartType?: ChartType;

  /** Default visualization mode (default: 'total') */
  defaultVizMode?: VizMode;

  /** Cache TTL in milliseconds (default: 300000 = 5 min) */
  cacheTTL?: number;

  /** Auto-refresh interval in milliseconds (null to disable) */
  autoRefreshInterval?: number | null;

  // ============================================
  // OPTIONAL - CALLBACKS
  // ============================================

  /** Called when data is successfully loaded */
  onDataLoaded?: (data: Consumption7DaysData) => void;

  /** Called when an error occurs */
  onError?: (error: Error) => void;

  /** Called before rendering (can modify data) */
  onBeforeRender?: (data: Consumption7DaysData) => Consumption7DaysData;

  /** Called after chart is rendered */
  onAfterRender?: (chartInstance: any) => void;

  /**
   * Called when settings button is clicked
   * Use this to open a custom settings modal (e.g., with createDateRangePicker)
   * If not provided, no settings button functionality is added
   */
  onSettingsClick?: () => void;

  /**
   * Called when maximize button is clicked
   * Use this to open fullscreen mode
   * If not provided, no maximize button functionality is added
   */
  onMaximizeClick?: () => void;

  /**
   * Called when export CSV button is clicked
   * If not provided, uses default export behavior
   */
  onExportCSV?: (data: Consumption7DaysData) => void;

  // ============================================
  // OPTIONAL - EXPORT CONFIGURATION
  // ============================================

  /**
   * Enable CSV export functionality (default: true)
   */
  enableExport?: boolean;

  /**
   * ID of the export button element to attach click handler
   */
  exportButtonId?: string;

  /**
   * Custom filename for CSV export (without extension)
   * Default: '{domain}-consumption-{date}'
   */
  exportFilename?: string;

  // ============================================
  // OPTIONAL - IDEAL RANGE (ALL DOMAINS)
  // ============================================

  /**
   * Ideal range configuration for displaying a shaded area on the chart.
   * Shows acceptable/target range for the metric.
   *
   * For temperature: typically comes from customer attributes (minTemperature, maxTemperature)
   * For energy/water/gas: optional, can be set via settings modal
   *
   * @example
   * ```typescript
   * // Temperature with customer-defined range
   * idealRange: {
   *   min: 20,  // minTemperature from customer
   *   max: 24,  // maxTemperature from customer
   *   color: 'rgba(34, 197, 94, 0.15)',
   *   label: 'Faixa Ideal'
   * }
   *
   * // Energy with target consumption
   * idealRange: {
   *   min: 0,
   *   max: 500,  // kWh target
   *   color: 'rgba(37, 99, 235, 0.1)',
   *   label: 'Meta de Consumo'
   * }
   * ```
   */
  idealRange?: IdealRangeConfig;

  // ============================================
  // OPTIONAL - TEMPERATURE SPECIFIC
  // ============================================

  /**
   * Temperature-specific configuration
   * Only applies when domain is 'temperature'
   */
  temperatureConfig?: TemperatureConfig;

  // ============================================
  // OPTIONAL - THINGSBOARD INTEGRATION
  // ============================================

  /**
   * ThingsBoard widget container for proper DOM querying
   * When provided, uses $container.querySelector() instead of document.getElementById()
   */
  $container?: { [key: number]: HTMLElement } | null;

  // ============================================
  // OPTIONAL - BUTTON IDs
  // ============================================

  /**
   * ID of the settings button element to attach click handler
   * Used with onSettingsClick callback
   */
  settingsButtonId?: string;

  /**
   * ID of the maximize button element to attach click handler
   * Used with onMaximizeClick callback
   */
  maximizeButtonId?: string;

  /**
   * ID of the chart title element to update dynamically
   */
  titleElementId?: string;
}

/**
 * Public API returned by createConsumption7DaysChart()
 */
export interface Consumption7DaysInstance {
  /**
   * Render the chart (fetches data and creates Chart.js instance)
   */
  render: () => Promise<void>;

  /**
   * Update chart with new or existing data
   * @param data - Optional new data; uses cached data if not provided
   */
  update: (data?: Consumption7DaysData) => Promise<void>;

  /**
   * Change chart type (line/bar)
   * @param type - New chart type
   */
  setChartType: (type: ChartType) => void;

  /**
   * Change visualization mode (total/separate)
   * @param mode - New visualization mode
   */
  setVizMode: (mode: VizMode) => void;

  /**
   * Change the period and re-fetch data
   * @param days - New period in days
   */
  setPeriod: (days: number) => Promise<void>;

  /**
   * Refresh data from source
   * @param forceRefresh - Bypass cache if true
   */
  refresh: (forceRefresh?: boolean) => Promise<void>;

  /**
   * Destroy the chart instance and clean up resources
   */
  destroy: () => void;

  /**
   * Get the underlying Chart.js instance
   */
  getChartInstance: () => any | null;

  /**
   * Get currently cached data
   */
  getCachedData: () => Consumption7DaysData | null;

  /**
   * Get current configuration state
   */
  getState: () => {
    period: number;
    chartType: ChartType;
    vizMode: VizMode;
    theme: ThemeMode;
    isRendered: boolean;
  };

  /**
   * Export current data to CSV file
   * @param filename - Optional custom filename (without extension)
   */
  exportCSV: (filename?: string) => void;

  /**
   * Set theme mode
   * @param theme - 'light' or 'dark'
   */
  setTheme: (theme: ThemeMode) => void;

  /**
   * Set or update the ideal range
   * Pass null to remove the ideal range
   * @param range - Ideal range configuration or null to clear
   */
  setIdealRange: (range: IdealRangeConfig | null) => void;

  /**
   * Get the current ideal range configuration
   */
  getIdealRange: () => IdealRangeConfig | null;
}

/**
 * Default color schemes for common domains
 */
export const DEFAULT_COLORS: Record<string, Consumption7DaysColors> = {
  energy: {
    primary: '#2563eb',
    background: 'rgba(37, 99, 235, 0.1)',
    gradient: ['#f0fdf4', '#dcfce7'],
    pointBackground: '#2563eb',
    pointBorder: '#ffffff',
  },
  water: {
    primary: '#0288d1',
    background: 'rgba(2, 136, 209, 0.1)',
    gradient: ['#f0f9ff', '#bae6fd'],
    pointBackground: '#0288d1',
    pointBorder: '#ffffff',
  },
  gas: {
    primary: '#ea580c',
    background: 'rgba(234, 88, 12, 0.1)',
    gradient: ['#fff7ed', '#fed7aa'],
    pointBackground: '#ea580c',
    pointBorder: '#ffffff',
  },
  temperature: {
    primary: '#dc2626',
    background: 'rgba(220, 38, 38, 0.1)',
    gradient: ['#fef2f2', '#fecaca'],
    pointBackground: '#dc2626',
    pointBorder: '#ffffff',
  },
};

/**
 * Theme color configurations
 */
export interface ThemeColors {
  /** Chart background color */
  chartBackground: string;
  /** Text color */
  text: string;
  /** Muted text color */
  textMuted: string;
  /** Grid line color */
  grid: string;
  /** Border color */
  border: string;
  /** Tooltip background */
  tooltipBackground: string;
  /** Tooltip text */
  tooltipText: string;
}

/**
 * Default theme colors for light and dark modes
 */
export const THEME_COLORS: Record<ThemeMode, ThemeColors> = {
  light: {
    chartBackground: '#ffffff',
    text: '#1f2937',
    textMuted: '#6b7280',
    grid: 'rgba(0, 0, 0, 0.1)',
    border: '#e5e7eb',
    tooltipBackground: '#ffffff',
    tooltipText: '#1f2937',
  },
  dark: {
    chartBackground: '#1f2937',
    text: '#f9fafb',
    textMuted: '#9ca3af',
    grid: 'rgba(255, 255, 255, 0.1)',
    border: '#374151',
    tooltipBackground: '#374151',
    tooltipText: '#f9fafb',
  },
};

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
  defaultPeriod: 7,
  defaultChartType: 'line' as ChartType,
  defaultVizMode: 'total' as VizMode,
  defaultTheme: 'light' as ThemeMode,
  cacheTTL: 300000, // 5 minutes
  decimalPlaces: 1,
  lineTension: 0.4,
  pointRadius: 4,
  borderWidth: 2,
  fill: true,
  showLegend: false,
  enableExport: true,
};
