/**
 * RFC-0102: Distribution Chart Widget
 * Public API exports
 */

// Main factory function
export { createDistributionChartWidget } from './createDistributionChartWidget';

// Color management utilities
export {
  DEFAULT_SHOPPING_COLORS,
  DEFAULT_ENERGY_GROUP_COLORS,
  DEFAULT_WATER_GROUP_COLORS,
  DEFAULT_GAS_GROUP_COLORS,
  getDefaultGroupColors,
  assignShoppingColors,
  getShoppingColor,
  getGroupColor,
  getThemeColors,
  getHashColor,
} from './colorManager';

// Type exports
export type {
  DistributionDomain,
  ThemeMode,
  DistributionMode,
  DistributionData,
  GroupColors,
  ShoppingColors,
  DistributionThemeColors,
  DistributionChartConfig,
  DistributionChartInstance,
} from './types';
