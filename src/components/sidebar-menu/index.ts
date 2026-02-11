/**
 * RFC-0173: Premium Sidebar Menu Component
 *
 * A retractable sidebar menu with premium styling for BAS dashboard navigation.
 *
 * @example
 * ```typescript
 * import { createSidebarMenu } from 'myio-js-library';
 *
 * const sidebar = createSidebarMenu('#sidebar-host', {
 *   themeMode: 'light',
 *   initialState: 'expanded',
 *   header: {
 *     title: 'MYIO BAS',
 *     subtitle: 'Building Automation',
 *   },
 *   sections: [
 *     {
 *       id: 'nav',
 *       title: 'Navigation',
 *       items: [
 *         { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
 *         { id: 'ambientes', label: 'Ambientes', icon: '🏢', badge: 12 },
 *       ],
 *     },
 *   ],
 *   onItemClick: (item, section) => {
 *     console.log('Clicked:', item.id);
 *   },
 * });
 *
 * // Toggle sidebar
 * sidebar.toggle();
 *
 * // Update badge
 * sidebar.updateItemBadge('ambientes', 15);
 *
 * // Set active item
 * sidebar.setActiveItem('dashboard');
 * ```
 */

// Main factory function
export { createSidebarMenu, SidebarMenuController } from './SidebarMenuController';

// View (for advanced usage)
export { SidebarMenuView } from './SidebarMenuView';

// Types
export type {
  SidebarThemeMode,
  SidebarState,
  SidebarMenuItem,
  SidebarMenuSection,
  SidebarHeaderConfig,
  SidebarFooterConfig,
  SidebarMenuConfig,
  SidebarMenuInstance,
} from './types';

export { DEFAULT_SIDEBAR_CONFIG } from './types';

// Styles
export { SIDEBAR_MENU_CSS_PREFIX, injectSidebarMenuStyles } from './styles';

// Icons
export { SIDEBAR_ICONS, getIcon } from './icons';
