// ============ Domain Types ============

export type ThemeMode = 'light' | 'dark';
export type PeriodDays = 7 | 14 | 30;
export type VizMode = 'total' | 'separate';
export type ChartType = 'line' | 'bar';
export type DistributionMode = 'groups' | 'stores' | 'common';

// ============ Data Types ============

export interface WaterCategoryData {
  total: number; // m³
  count: number; // device count
  percentage?: number;
}

export interface WaterSummaryData {
  storesTotal: number; // m³
  commonAreaTotal: number; // m³
  total: number; // m³
  deviceCount: number;
  storesPercentage: number; // 0-100
  commonAreaPercentage: number; // 0-100
  byStatus?: {
    online: number;
    offline: number;
    waiting: number;
  };
}

export interface ConsumptionDataPoint {
  date: string; // ISO date
  value: number; // m³
  shoppingId?: string;
  shoppingName?: string;
}

export interface DistributionDataPoint {
  id: string;
  label: string;
  value: number;
  percentage: number;
  color?: string;
}

// ============ Fetch Functions ============

export type FetchConsumptionFn = (
  customerId: string,
  startDate: string,
  endDate: string,
  granularity?: '1h' | '1d'
) => Promise<ConsumptionDataPoint[]>;

export type FetchDistributionFn = (mode: DistributionMode) => Promise<DistributionDataPoint[]>;

// New types for chart widget integration (RFC-0098, RFC-0102)
import type { Consumption7DaysData, IdealRangeConfig } from '../Consumption7DaysChart/types';
import type { DistributionData } from '../DistributionChart/types';

export type FetchConsumptionDataFn = (period: number) => Promise<Consumption7DaysData>;
export type FetchDistributionDataFn = (mode: string) => Promise<DistributionData | null>;

export type { IdealRangeConfig };

// ============ Callbacks ============

export type OnFilterChangeCallback = (shoppingIds: string[]) => void;
export type OnPeriodChangeCallback = (days: PeriodDays) => void;
export type OnVizModeChangeCallback = (mode: VizMode) => void;
export type OnMaximizeCallback = () => void;
export type OnRefreshCallback = () => void;

// ============ Component Params ============

export interface WaterPanelParams {
  // Required
  container: HTMLElement;

  // Optional config
  theme?: ThemeMode;
  period?: PeriodDays;
  vizMode?: VizMode;
  chartType?: ChartType;

  // Initial data (optional)
  initialSummary?: WaterSummaryData;

  // Legacy data fetching (optional - for charts)
  fetchConsumption?: FetchConsumptionFn;
  fetchDistribution?: FetchDistributionFn;
  customerId?: string;

  // New fetch functions for chart widgets (RFC-0098, RFC-0102)
  fetchConsumptionData?: FetchConsumptionDataFn;
  fetchDistributionData?: FetchDistributionDataFn;

  // Ideal range for consumption chart
  idealRange?: IdealRangeConfig;

  // Filter state (optional)
  selectedShoppingIds?: string[];
  availableShoppings?: Array<{ id: string; name: string }>;

  // Callbacks
  onFilterChange?: OnFilterChangeCallback;
  onPeriodChange?: OnPeriodChangeCallback;
  onVizModeChange?: OnVizModeChangeCallback;
  onMaximizeClick?: OnMaximizeCallback;
  onRefresh?: OnRefreshCallback;

  // Feature flags
  showCards?: boolean; // default: true
  showConsumptionChart?: boolean; // default: true
  showDistributionChart?: boolean; // default: true
  enableFullscreen?: boolean; // default: true

  // ThingsBoard widget container reference
  $container?: { [key: number]: HTMLElement } | null;
}

// ============ Component Instance ============

export interface WaterPanelInstance {
  // DOM
  element: HTMLElement;

  // Data methods
  updateSummary(data: WaterSummaryData): void;
  getSummary(): WaterSummaryData | null;

  // Config methods
  setTheme(mode: ThemeMode): void;
  getTheme(): ThemeMode;
  setPeriod(days: PeriodDays): void;
  getPeriod(): PeriodDays;
  setVizMode(mode: VizMode): void;
  getVizMode(): VizMode;
  setChartType(type: ChartType): void;
  getChartType(): ChartType;

  // Filter methods
  applyShoppingFilter(ids: string[]): void;
  getSelectedShoppingIds(): string[];
  clearFilters(): void;

  // Actions
  refresh(): void;
  openFullscreen(): void;

  // Lifecycle
  destroy(): void;
}

// ============ Internal State ============

export interface WaterPanelState {
  theme: ThemeMode;
  period: PeriodDays;
  vizMode: VizMode;
  chartType: ChartType;
  selectedShoppingIds: string[];
  summary: WaterSummaryData | null;
  isLoading: boolean;
  error: string | null;
}
