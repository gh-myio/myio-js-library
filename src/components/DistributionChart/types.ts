/**
 * RFC-0102: Distribution Chart Widget Types
 * TypeScript interfaces for the distribution chart component
 */

export type DistributionDomain = 'energy' | 'water' | 'gas' | string;

export type ThemeMode = 'light' | 'dark';

/**
 * Visualization mode configuration
 */
export interface DistributionMode {
  value: string;
  label: string;
}

/**
 * Distribution data - key-value pairs of category/shopping to consumption value
 */
export interface DistributionData {
  [key: string]: number;
}

/**
 * Color mapping for equipment groups
 */
export interface GroupColors {
  [groupName: string]: string;
}

/**
 * Color mapping for shoppings (from orchestrator)
 */
export interface ShoppingColors {
  [shoppingId: string]: string;
}

/**
 * Theme colors for chart rendering
 */
export interface DistributionThemeColors {
  text: string;
  secondaryText: string;
  background: string;
  cardBackground: string;
  border: string;
  grid: string;
}

/**
 * Main configuration for createDistributionChartWidget
 */
export interface DistributionChartConfig {
  // Required
  /** Domain identifier (energy, water, etc.) */
  domain: DistributionDomain;
  /** Container element ID where widget will be injected */
  containerId: string;
  /** Unit of measurement (kWh, m³, etc.) */
  unit: string;
  /** Function to fetch distribution data for a given mode */
  fetchDistribution: (mode: string) => Promise<DistributionData | null>;

  // Optional - Units
  /** Large unit for values above threshold (MWh, etc.) */
  unitLarge?: string | null;
  /** Threshold to switch to large unit */
  thresholdForLargeUnit?: number | null;
  /** Decimal places for formatting (default: 2) */
  decimalPlaces?: number;

  // Optional - Modes
  /** Available visualization modes */
  modes?: DistributionMode[];
  /** Default mode to display (default: 'groups') */
  defaultMode?: string;

  // Optional - Appearance
  /** Widget title */
  title?: string;
  /** Theme mode (default: 'light') */
  theme?: ThemeMode;
  /** Chart height in pixels (default: 300) */
  chartHeight?: number;
  /** Show header with title (default: true) */
  showHeader?: boolean;
  /** Show mode selector dropdown (default: true) */
  showModeSelector?: boolean;
  /** Show settings button (default: false) */
  showSettingsButton?: boolean;
  /** Show maximize button (default: false) */
  showMaximizeButton?: boolean;

  // Optional - Colors
  /** Custom colors for equipment groups */
  groupColors?: GroupColors;
  /** Function to get shopping colors from orchestrator */
  getShoppingColors?: () => ShoppingColors | null;
  /** Function to get shopping names from orchestrator */
  getShoppingNames?: () => Record<string, string> | null;

  // Optional - Callbacks
  /** Called when mode changes */
  onModeChange?: (mode: string) => void;
  /** Called when data is loaded */
  onDataLoaded?: (data: DistributionData) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called when settings button is clicked */
  onSettingsClick?: () => void;
  /** Called when maximize button is clicked */
  onMaximizeClick?: () => void;

  // Optional - ThingsBoard context
  /** jQuery container for ThingsBoard widget context */
  $container?: { [0]: HTMLElement } | HTMLElement[];
}

/**
 * Instance returned by createDistributionChartWidget
 */
export interface DistributionChartInstance {
  /** Render the widget into the container */
  render: () => Promise<void>;
  /** Change visualization mode */
  setMode: (mode: string) => Promise<void>;
  /** Refresh data from source */
  refresh: () => Promise<void>;
  /** Change theme */
  setTheme: (theme: ThemeMode) => void;
  /** Destroy the widget and clean up */
  destroy: () => void;
  /** Get the Chart.js instance */
  getChartInstance: () => Chart | null;
  /** Get current mode */
  getCurrentMode: () => string;
  /** Get current data */
  getCurrentData: () => DistributionData | null;
}

// Re-export Chart type for consumers
declare global {
  interface Window {
    Chart: typeof Chart;
  }
}

// Chart.js type stub (actual Chart.js types would be imported if available)
declare class Chart {
  constructor(ctx: CanvasRenderingContext2D, config: any);
  data: any;
  options: any;
  update(mode?: string): void;
  destroy(): void;
}
