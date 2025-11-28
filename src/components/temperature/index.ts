/**
 * Temperature Modal Components
 * RFC-0085: Temperature Modal Component
 *
 * Exports temperature modal components and utilities.
 */

// Main components
export { openTemperatureModal } from './TemperatureModal';
export { openTemperatureComparisonModal } from './TemperatureComparisonModal';

// Types from TemperatureModal
export type {
  TemperatureModalParams,
  TemperatureModalInstance
} from './TemperatureModal';

// Types from TemperatureComparisonModal
export type {
  TemperatureComparisonModalParams,
  TemperatureComparisonModalInstance,
  TemperatureDevice
} from './TemperatureComparisonModal';

// Types and utilities from utils
export type {
  TemperatureTelemetry,
  TemperatureStats,
  DailyTemperatureStats,
  ClampRange,
  TemperatureGranularity,
  ThemeColors
} from './utils';

export {
  fetchTemperatureData,
  clampTemperature,
  calculateStats,
  interpolateTemperature,
  aggregateByDay,
  formatTemperature,
  formatDateLabel,
  formatTooltip,
  exportTemperatureCSV,
  getThemeColors,
  DEFAULT_CLAMP_RANGE,
  CHART_COLORS,
  DARK_THEME,
  LIGHT_THEME
} from './utils';
