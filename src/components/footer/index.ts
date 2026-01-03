/**
 * RFC-0115: Footer Component Library
 * Public exports
 */

// Main function
export { createFooterComponent } from './createFooterComponent';

// Types
export type {
  FooterComponentParams,
  FooterComponentInstance,
  FooterColors,
  FooterThemeMode,
  FooterThemeConfig,
  FooterConfigTemplate,
  SelectedEntity,
  UnitType,
  DateRange,
  SelectionStore,
  ThingsboardWidgetContext,
  FooterEventType,
  FooterEventHandler,
  ComparisonDataSource,
  TemperatureDevice,
} from './types';

// Constants
export {
  DEFAULT_FOOTER_COLORS,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_CONFIG_TEMPLATE,
} from './types';

// Internal utilities (for advanced use cases)
export { ChipRenderer, chipRenderer } from './ChipRenderer';
export { FooterView } from './FooterView';
export { FooterController } from './FooterController';
export { ComparisonHandler } from './ComparisonHandler';
export {
  showMixedUnitsAlert,
  showLimitAlert,
  showErrorAlert,
  hideAlert,
  isAlertVisible,
  setAlertColors,
} from './AlertDialogs';
export { injectStyles, removeStyles, areStylesInjected, getStyles } from './styles';
