export type ThemeMode = 'light' | 'dark';
export type PeriodDays = 7 | 14 | 30;
export type VizMode = 'total' | 'separate';
export type ChartType = 'line' | 'bar';
export type DistributionMode = 'groups' | 'elevators' | 'escalators' | 'hvac' | 'stores' | 'others';

export interface EnergyCategoryData {
  total: number; // kWh
  count: number; // device count
  percentage?: number;
}

export interface EnergySummaryData {
  storesTotal: number;
  equipmentsTotal: number;
  entradaTotal: number;
  areaComumTotal: number;
  consumidoresTotal: number; // Total Consumidores = Lojas + Climatização + Elevadores + Esc. Rolantes + Outros
  total: number;
  deviceCount: number;
  byCategory: {
    entrada: EnergyCategoryData;
    lojas: EnergyCategoryData;
    climatizacao: EnergyCategoryData;
    elevadores: EnergyCategoryData;
    escadas: EnergyCategoryData;
    outros: EnergyCategoryData;
    areaComum: EnergyCategoryData; // Área Comum = Entrada - Consumidores
  };
  byStatus?: {
    online: number;
    offline: number;
    waiting: number;
  };
}

export interface ConsumptionDataPoint {
  date: string; // ISO date
  value: number; // kWh
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

export type FetchConsumptionFn = (
  customerId: string,
  startDate: string,
  endDate: string,
  granularity?: '1h' | '1d'
) => Promise<ConsumptionDataPoint[]>;

export type FetchDistributionFn = (mode: DistributionMode) => Promise<DistributionDataPoint[]>;

// New types for chart widget integration (RFC-0098, RFC-0102)
import type { Consumption7DaysData } from '../Consumption7DaysChart/types';
import type { DistributionData } from '../DistributionChart/types';
import type { IdealRangeConfig } from '../Consumption7DaysChart/types';

export type FetchConsumptionDataFn = (period: number) => Promise<Consumption7DaysData>;
export type FetchDistributionDataFn = (mode: string) => Promise<DistributionData | null>;

export type OnFilterChangeCallback = (shoppingIds: string[]) => void;
export type OnPeriodChangeCallback = (days: PeriodDays) => void;
export type OnVizModeChangeCallback = (mode: VizMode) => void;
export type OnMaximizeCallback = () => void;
export type OnRefreshCallback = () => void;

export interface EnergyPanelParams {
  container: HTMLElement;

  theme?: ThemeMode;
  period?: PeriodDays;
  vizMode?: VizMode;
  chartType?: ChartType;

  initialSummary?: EnergySummaryData;

  // Legacy fetch functions
  fetchConsumption?: FetchConsumptionFn;
  fetchDistribution?: FetchDistributionFn;
  customerId?: string;

  // New fetch functions for chart widgets (RFC-0098, RFC-0102)
  fetchConsumptionData?: FetchConsumptionDataFn;
  fetchDistributionData?: FetchDistributionDataFn;

  // Ideal range for consumption chart
  idealRange?: IdealRangeConfig;

  selectedShoppingIds?: string[];
  availableShoppings?: Array<{ id: string; name: string }>;

  onFilterChange?: OnFilterChangeCallback;
  onPeriodChange?: OnPeriodChangeCallback;
  onVizModeChange?: OnVizModeChangeCallback;
  onMaximizeClick?: OnMaximizeCallback;
  onRefresh?: OnRefreshCallback;

  showCards?: boolean;
  showConsumptionChart?: boolean;
  showDistributionChart?: boolean;
  enableFullscreen?: boolean;

  // ThingsBoard widget container reference
  $container?: { [key: number]: HTMLElement } | null;
}

export interface EnergyPanelInstance {
  element: HTMLElement;

  updateSummary(data: EnergySummaryData): void;
  getSummary(): EnergySummaryData | null;

  setTheme(mode: ThemeMode): void;
  getTheme(): ThemeMode;
  setPeriod(days: PeriodDays): void;
  getPeriod(): PeriodDays;
  setVizMode(mode: VizMode): void;
  getVizMode(): VizMode;
  setChartType(type: ChartType): void;
  getChartType(): ChartType;

  applyShoppingFilter(ids: string[]): void;
  getSelectedShoppingIds(): string[];
  clearFilters(): void;

  refresh(): void;
  openFullscreen(): void;

  destroy(): void;
}

export interface EnergyPanelState {
  theme: ThemeMode;
  period: PeriodDays;
  vizMode: VizMode;
  chartType: ChartType;
  selectedShoppingIds: string[];
  summary: EnergySummaryData | null;
  isLoading: boolean;
  error: string | null;
}
