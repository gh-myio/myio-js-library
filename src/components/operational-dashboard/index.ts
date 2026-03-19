/**
 * RFC-0152 Phase 5: Operational Dashboard Component
 * Public exports and factory function
 */

import type {
  OperationalDashboardParams,
  OperationalDashboardInstance,
  DashboardKPIs,
  TrendDataPoint,
  DowntimeEntry,
  DashboardPeriod,
  DashboardThemeMode,
} from './types';
import { OperationalDashboardController } from './OperationalDashboardController';

// Re-export types
export type {
  OperationalDashboardParams,
  OperationalDashboardInstance,
  DashboardKPIs,
  TrendDataPoint,
  DowntimeEntry,
  DashboardPeriod,
  DashboardThemeMode,
};

export { DEFAULT_DASHBOARD_KPIS, PERIOD_OPTIONS } from './types';

// Re-export utilities
export {
  calculateMTBF,
  calculateMTTR,
  calculateAvailability,
  calculateFleetKPIs,
  formatHours,
  formatPercentage,
  formatTrend,
  getTrendIcon,
  getTrendClass,
  getPeriodDateRange,
  generateMockTrendData,
  generateMockDowntimeList,
  generateMockKPIs,
} from './utils';

// Re-export chart components
export {
  renderLineChart,
  renderAvailabilityChart,
  renderDualLineChart,
  renderStatusDonutChart,
  renderDowntimeList,
  renderMTBFTimelineChart,
  generateMockMTBFTimelineData,
  updateMTBFTimelineChart,
  initMTBFTimelineTooltips,
  initStatusChartTooltips,
  initAvailabilityChartTooltips,
} from './ChartComponents';

export type { MTBFTimelineSegment, MTBFTimelineData } from './ChartComponents';

// Re-export styles
export {
  OPERATIONAL_DASHBOARD_STYLES,
  injectOperationalDashboardStyles,
  removeOperationalDashboardStyles,
} from './styles';

/**
 * Create an Operational Dashboard component instance
 *
 * @example
 * ```typescript
 * const dashboard = createOperationalDashboardComponent({
 *   container: document.getElementById('dashboard-container'),
 *   themeMode: 'dark',
 *   initialPeriod: 'month',
 *   onPeriodChange: (period) => {
 *     console.log('Period changed:', period);
 *     fetchDataForPeriod(period);
 *   },
 *   onRefresh: () => {
 *     console.log('Refresh requested');
 *     refreshData();
 *   },
 * });
 *
 * // Update data
 * dashboard.updateKPIs(newKPIs);
 * dashboard.updateTrendData(newTrendData);
 * dashboard.updateDowntimeList(newDowntimeList);
 *
 * // Show loading
 * dashboard.setLoading(true);
 *
 * // Cleanup
 * dashboard.destroy();
 * ```
 */
export function createOperationalDashboardComponent(
  params: OperationalDashboardParams
): OperationalDashboardInstance {
  const controller = new OperationalDashboardController(params);

  return {
    element: controller.getElement(),
    updateKPIs: (kpis: DashboardKPIs) => controller.updateKPIs(kpis),
    updateTrendData: (data: TrendDataPoint[]) => controller.updateTrendData(data),
    updateDowntimeList: (list: DowntimeEntry[]) => controller.updateDowntimeList(list),
    setLoading: (isLoading: boolean) => controller.setLoading(isLoading),
    setPeriod: (period: DashboardPeriod) => controller.setPeriod(period),
    getPeriod: () => controller.getPeriod(),
    setThemeMode: (mode: DashboardThemeMode) => controller.setThemeMode(mode),
    getThemeMode: () => controller.getThemeMode(),
    refresh: () => controller.refresh(),
    destroy: () => controller.destroy(),
  };
}
