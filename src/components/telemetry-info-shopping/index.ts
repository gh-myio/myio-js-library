/**
 * RFC-0148: TelemetryInfoShopping Component
 * Category breakdown panel with pie chart for energy/water consumption
 */

export { createTelemetryInfoShoppingComponent } from './createTelemetryInfoShoppingComponent';

export type {
  TelemetryInfoShoppingParams,
  TelemetryInfoShoppingInstance,
  TelemetryDomain,
  ThemeMode,
  EnergySummary,
  WaterSummary,
  EnergyState,
  WaterState,
  CategoryType,
  EnergyCategoryType,
  WaterCategoryType,
  CategoryData,
  ChartColors,
  CategoryConfig,
} from './types';

export {
  DEFAULT_CHART_COLORS,
  ENERGY_CATEGORY_CONFIG,
  WATER_CATEGORY_CONFIG,
  formatEnergy,
  formatWater,
  formatPercentage,
} from './types';
