/**
 * Gateway Modal Components
 * Probe-latency history for one central/gateway — rewritten to closely mirror
 * `src/components/temperature/index.ts`'s structure (see GatewayModal.ts's
 * file doc for the exact fidelity target and deliberate deltas).
 */

// Main component
export { openGatewayModal } from './GatewayModal';

// Types from GatewayModal
export type { GatewayModalParams, GatewayModalInstance, GatewayModalLabels, GatewayModalSourceConfig } from './GatewayModal';

// Types and utilities from utils
export type {
  GatewayLatencyPoint,
  GatewayLatencyStats,
  GatewayUptimeStats,
  GatewayThemeColors,
  GatewayGranularity,
  DayPeriod,
  DayPeriodConfig,
  DailyLatencyStats,
} from './utils';

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
  exportLatencyCSV,
} from './utils';

// PDF export
export { exportGatewayPdf } from './exportGatewayPdf';
export type { GatewayPdfOptions } from './exportGatewayPdf';
