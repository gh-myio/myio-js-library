/**
 * RFC-0140: MenuShopping Component Types
 * Shopping Dashboard menu navigation with tabs, settings, and user info
 */

export const MENU_SHOPPING_CSS_PREFIX = 'msh';

/**
 * Theme mode for the component
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Domain types for tab navigation
 */
export type DomainType = 'energy' | 'water' | 'temperature' | 'alarms' | null;

/**
 * Tab item configuration
 */
export interface MenuShoppingTab {
  id: string;
  domain: DomainType;
  label: string;
  icon: string;
  enabled: boolean;
}

/**
 * User info for display
 */
export interface MenuShoppingUserInfo {
  name: string;
  email: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  customerId?: string;
}

/**
 * Settings state
 */
export interface MenuShoppingSettings {
  temperatureUnit: 'celsius' | 'fahrenheit';
  contractView: 'all' | 'active' | 'inactive';
  measurementType: 'consumption' | 'demand';
}

/**
 * Dashboard state event detail
 */
export interface DashboardStateEvent {
  domain: DomainType;
  tab: string;
  timestamp: number;
}

/**
 * Configuration template for the component
 */
export interface MenuShoppingConfigTemplate {
  /** Show user info section */
  showUserInfo?: boolean;
  /** Show settings button */
  showSettingsButton?: boolean;
  /** Show shopping selector button (admin only) */
  showShoppingSelector?: boolean;
  /** Show logout button */
  showLogoutButton?: boolean;
  /** Show library version */
  showLibraryVersion?: boolean;
  /** Show hamburger toggle for collapse */
  showHamburgerToggle?: boolean;
  /** Available tabs */
  tabs?: MenuShoppingTab[];
  /** Initial domain */
  initialDomain?: DomainType;
  /** Collapsed state */
  collapsed?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_MENU_SHOPPING_CONFIG: Required<MenuShoppingConfigTemplate> = {
  showUserInfo: true,
  showSettingsButton: true,
  showShoppingSelector: true,
  showLogoutButton: true,
  showLibraryVersion: true,
  showHamburgerToggle: true,
  tabs: [
    { id: 'tab-energy', domain: 'energy', label: 'Energia', icon: '⚡', enabled: true },
    { id: 'tab-water', domain: 'water', label: 'Agua', icon: '💧', enabled: true },
    { id: 'tab-temperature', domain: 'temperature', label: 'Temperatura', icon: '🌡️', enabled: true },
  ],
  initialDomain: 'energy',
  collapsed: false,
};

/**
 * Parameters for creating the component
 */
export interface MenuShoppingParams {
  /** Container element to render into */
  container: HTMLElement;
  /** Theme mode (light/dark), defaults to light */
  themeMode?: ThemeMode;
  /** User info to display */
  userInfo?: MenuShoppingUserInfo;
  /** Configuration template */
  configTemplate?: MenuShoppingConfigTemplate;
  /** Initial settings */
  settings?: Partial<MenuShoppingSettings>;
  /** Callback when tab changes */
  onTabChange?: (domain: DomainType, tabId: string) => void;
  /** Callback when settings button clicked */
  onSettingsClick?: () => void;
  /** Callback when shopping selector clicked */
  onShoppingSelectorClick?: () => void;
  /** Callback when logout clicked */
  onLogoutClick?: () => void;
  /** Callback when hamburger toggle clicked */
  onToggleCollapse?: (collapsed: boolean) => void;
}

/**
 * Instance returned by createMenuShoppingComponent
 */
export interface MenuShoppingInstance {
  /** Get current domain */
  getCurrentDomain(): DomainType;
  /** Set active tab/domain */
  setActiveDomain(domain: DomainType): void;
  /** Set theme mode (light/dark) */
  setThemeMode(mode: ThemeMode): void;
  /** Update user info */
  updateUserInfo(userInfo: MenuShoppingUserInfo): void;
  /** Set collapsed state */
  setCollapsed(collapsed: boolean): void;
  /** Get collapsed state */
  isCollapsed(): boolean;
  /** Enable/disable a tab */
  setTabEnabled(tabId: string, enabled: boolean): void;
  /** Update settings */
  updateSettings(settings: Partial<MenuShoppingSettings>): void;
  /** Get current settings */
  getSettings(): MenuShoppingSettings;
  /** Show/hide admin controls */
  setAdminMode(isAdmin: boolean): void;
  /** Destroy the component */
  destroy(): void;
  /** Get the root element */
  getElement(): HTMLElement;
  /** Subscribe to events */
  on(event: MenuShoppingEventType, handler: MenuShoppingEventHandler): void;
  /** Unsubscribe from events */
  off(event: MenuShoppingEventType, handler: MenuShoppingEventHandler): void;
}

/**
 * Event types emitted by the component
 */
export type MenuShoppingEventType =
  | 'tab-change'
  | 'settings-click'
  | 'shopping-selector-click'
  | 'logout-click'
  | 'collapse-toggle'
  | 'domain-changed';

/**
 * Event handler type
 */
export type MenuShoppingEventHandler = (...args: unknown[]) => void;
