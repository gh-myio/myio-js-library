/**
 * RFC-0113: Header Component Library
 * Public exports for the Header Component
 */

// Main entry function
export { createHeaderComponent } from './createHeaderComponent';

// View class (for advanced usage)
export { HeaderView } from './HeaderView';

// Filter modal class (for advanced usage)
export { HeaderFilterModal } from './HeaderFilterModal';

// Type exports
export type {
  // Component params & instance
  HeaderComponentParams,
  HeaderComponentInstance,

  // Configuration
  HeaderConfigTemplate,
  HeaderCardColors,
  CardColorConfig,

  // KPI types
  CardKPIs,
  EquipmentKPI,
  EnergyKPI,
  TemperatureKPI,
  WaterKPI,
  ShoppingEnergy,
  ShoppingTemperature,
  ShoppingWater,

  // Shopping/Filter types
  Shopping,
  FilterSelection,
  FilterPreset,
  MallTreeNode,
  FloorTreeNode,
  PlaceTreeNode,

  // Event types
  CardType,
  HeaderEventType,
  HeaderEventHandler,

  // Theme types
  HeaderThemeMode,
  HeaderThemeConfig,

  // Filter modal types
  HeaderFilterModalParams,
  HeaderFilterModalInstance,

  // ThingsBoard context
  ThingsboardWidgetContext,
} from './types';

// Default constants
export {
  HEADER_DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_HEADER_LIGHT_THEME,
  DEFAULT_HEADER_DARK_THEME,
  DEFAULT_CARD_COLORS,
  HEADER_DEFAULT_LOGO_URL,
  HEADER_CSS_PREFIX,
  FILTER_PRESETS_STORAGE_KEY,
} from './types';
