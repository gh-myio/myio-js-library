/**
 * Gateway Comparison Modal Utilities
 * Re-exports everything from `../gateway/utils` — the comparison modal shares
 * the exact same latency data model, stats, theme, and period-filtering logic
 * as the single-central `GatewayModal`; no need to duplicate any of it.
 */
export {
  calculateLatencyStats,
  calculateUptimeStats,
  formatLatency,
  formatHours,
  formatGatewayDateLabel,
  formatGatewayAxisLabel,
  getGatewayThemeColors,
  GATEWAY_DARK_THEME,
  GATEWAY_LIGHT_THEME,
  DAY_PERIODS,
  CHART_COLORS,
  filterByDayPeriods,
  getSelectedPeriodsLabel,
  interpolateLatency,
  aggregateByDay,
} from '../gateway/utils';

export type {
  GatewayLatencyPoint,
  GatewayLatencyStats,
  GatewayUptimeStats,
  GatewayThemeColors,
  GatewayGranularity,
  DayPeriod,
  DayPeriodConfig,
  DailyLatencyStats,
} from '../gateway/utils';
