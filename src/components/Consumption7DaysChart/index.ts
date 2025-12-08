/**
 * RFC-0098: View Consumption Over 7 Days Component
 *
 * A reusable, domain-agnostic chart component for displaying consumption
 * data over configurable time periods.
 *
 * @example
 * ```typescript
 * import {
 *   createConsumption7DaysChart,
 *   type Consumption7DaysConfig
 * } from 'myio-js-library';
 *
 * // Energy domain
 * const energyChart = createConsumption7DaysChart({
 *   domain: 'energy',
 *   containerId: 'lineChart',
 *   unit: 'kWh',
 *   unitLarge: 'MWh',
 *   thresholdForLargeUnit: 1000,
 *   colors: {
 *     primary: '#2563eb',
 *     background: 'rgba(37, 99, 235, 0.1)',
 *   },
 *   fetchData: async (period) => {
 *     // Fetch energy consumption data
 *     const data = await fetchEnergyAPI(period);
 *     return {
 *       labels: data.dates,
 *       dailyTotals: data.values,
 *     };
 *   },
 * });
 *
 * await energyChart.render();
 *
 * // Water domain
 * const waterChart = createConsumption7DaysChart({
 *   domain: 'water',
 *   containerId: 'waterLineChart',
 *   unit: 'm³',
 *   colors: {
 *     primary: '#0288d1',
 *     background: 'rgba(2, 136, 209, 0.1)',
 *   },
 *   fetchData: async (period) => {
 *     const data = await fetchWaterAPI(period);
 *     return {
 *       labels: data.dates,
 *       dailyTotals: data.values,
 *     };
 *   },
 * });
 *
 * await waterChart.render();
 * ```
 *
 * @module Consumption7DaysChart
 */

// Main factory function
export { createConsumption7DaysChart } from './createConsumption7DaysChart';

// Modal wrapper with MyIO header
export { createConsumptionModal } from './createConsumptionModal';
export type { ConsumptionModalConfig, ConsumptionModalInstance } from './createConsumptionModal';

// Inline widget (injects HTML into container)
export { createConsumptionChartWidget } from './createConsumptionChartWidget';
export type { ConsumptionWidgetConfig, ConsumptionWidgetInstance } from './createConsumptionChartWidget';

// Type exports
export type {
  // Main types
  Consumption7DaysConfig,
  Consumption7DaysInstance,
  Consumption7DaysData,
  Consumption7DaysColors,

  // Supporting types
  ConsumptionDataPoint,
  ShoppingDataPoint,
  ChartDomain,
  ChartType,
  VizMode,

  // Ideal range (all domains)
  IdealRangeConfig,

  // Theme types
  ThemeMode,
  ThemeColors,

  // Temperature types
  TemperatureConfig,
  TemperatureReferenceLine,
} from './types';

// Constants
export { DEFAULT_COLORS, DEFAULT_CONFIG, THEME_COLORS } from './types';
