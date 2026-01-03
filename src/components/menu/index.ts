/**
 * RFC-0114: Menu Component Library
 * Public exports
 */

// Main entry function
export { createMenuComponent } from './createMenuComponent';

// View class (for advanced usage)
export { MenuView } from './MenuView';

// Controller class (for advanced usage)
export { MenuController } from './MenuController';

// Types
export type {
  MenuComponentParams,
  MenuComponentInstance,
  MenuConfigTemplate,
  MenuThemeConfig,
  MenuThemeMode,
  TabConfig,
  ContextOption,
  Shopping,
  ThingsboardWidgetContext,
  MenuEventType,
  MenuEventHandler,
  MenuState,
} from './types';

// Default configurations
export {
  DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_LIGHT_THEME,
  DEFAULT_DARK_THEME,
  DEFAULT_TABS,
  // Legacy exports
  DEFAULT_MENU_CONFIG,
  DEFAULT_MENU_CONFIG_LIGHT,
  DEFAULT_MENU_CONFIG_DARK,
} from './types';
