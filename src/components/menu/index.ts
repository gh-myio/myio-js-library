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
  DEFAULT_MENU_CONFIG,
  DEFAULT_MENU_CONFIG_LIGHT,
  DEFAULT_MENU_CONFIG_DARK,
  DEFAULT_TABS,
} from './types';
