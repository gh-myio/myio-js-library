/**
 * RFC-0140: MenuShopping Component
 * Shopping Dashboard menu navigation with tabs, settings, and user info
 */

export { createMenuShoppingComponent } from './createMenuShoppingComponent';
export { MenuShoppingView } from './MenuShoppingView';
export { injectMenuShoppingStyles, MENU_SHOPPING_STYLES } from './styles';

export type {
  DomainType as MenuShoppingDomainType,
  ThemeMode as MenuShoppingThemeMode,
  MenuShoppingTab,
  MenuShoppingUserInfo,
  MenuShoppingSettings,
  DashboardStateEvent as MenuShoppingDashboardStateEvent,
  MenuShoppingConfigTemplate,
  MenuShoppingParams,
  MenuShoppingInstance,
  MenuShoppingEventType,
  MenuShoppingEventHandler,
} from './types';

export {
  MENU_SHOPPING_CSS_PREFIX,
  DEFAULT_MENU_SHOPPING_CONFIG,
} from './types';
