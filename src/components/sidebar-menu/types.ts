/**
 * RFC-0173: Premium Sidebar Menu Component Types
 * TypeScript interfaces for the retractable sidebar menu
 */

export type SidebarThemeMode = 'light' | 'dark';
export type SidebarState = 'expanded' | 'collapsed';

/**
 * Individual menu item
 */
export interface SidebarMenuItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon (SVG string or emoji) */
  icon: string;
  /** Optional badge (count or text) */
  badge?: number | string;
  /** Disabled state */
  disabled?: boolean;
  /** Sub-menu items */
  children?: SidebarMenuItem[];
  /** Custom data attached to item */
  data?: Record<string, unknown>;
}

/**
 * Menu section grouping items
 */
export interface SidebarMenuSection {
  /** Unique identifier */
  id: string;
  /** Optional section header title */
  title?: string;
  /** Items in this section */
  items: SidebarMenuItem[];
  /** Can section be collapsed */
  collapsible?: boolean;
  /** Initial collapsed state */
  collapsed?: boolean;
}

/**
 * User info configuration for header
 */
export interface SidebarUserInfo {
  /** User display name */
  name?: string;
  /** User email */
  email?: string;
}

/**
 * Header configuration
 */
export interface SidebarHeaderConfig {
  /** Logo URL or SVG string */
  logo?: string;
  /** Application title */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Show theme toggle button (sun/moon) */
  showThemeToggle?: boolean;
  /** User info to display below title */
  userInfo?: SidebarUserInfo;
}

/**
 * Footer configuration
 */
export interface SidebarFooterConfig {
  /** Footer menu items */
  items?: SidebarMenuItem[];
  /** Show logout button */
  showLogout?: boolean;
  /** Logout button label */
  logoutLabel?: string;
  /** Show version number */
  showVersion?: boolean;
  /** Version string */
  version?: string;
}

/**
 * Sidebar menu configuration
 */
export interface SidebarMenuConfig {
  /** Theme mode */
  themeMode?: SidebarThemeMode;
  /** Initial state */
  initialState?: SidebarState;
  /** Width when expanded (default: 260px) */
  expandedWidth?: string;
  /** Width when collapsed (default: 64px) */
  collapsedWidth?: string;
  /** Menu sections */
  sections: SidebarMenuSection[];
  /** Header configuration */
  header?: SidebarHeaderConfig;
  /** Footer configuration */
  footer?: SidebarFooterConfig;
  /** Show search bar */
  showSearch?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Persist state in localStorage */
  persistState?: boolean;
  /** localStorage key for state */
  storageKey?: string;
  /** Callback when item is clicked */
  onItemClick?: (item: SidebarMenuItem, section: SidebarMenuSection) => void;
  /** Callback when state changes */
  onStateChange?: (state: SidebarState) => void;
  /** Callback when search query changes */
  onSearch?: (query: string) => void;
  /** Callback when theme toggle is clicked */
  onThemeToggle?: (currentTheme: SidebarThemeMode) => void;
  /** Callback when logout is clicked */
  onLogout?: () => void;
  /** Primary color for accents */
  primaryColor?: string;
}

/**
 * Sidebar menu instance interface
 */
export interface SidebarMenuInstance {
  /** Get the root DOM element */
  getElement(): HTMLElement;
  /** Expand the sidebar */
  expand(): void;
  /** Collapse the sidebar */
  collapse(): void;
  /** Toggle expanded/collapsed state */
  toggle(): void;
  /** Get current state */
  getState(): SidebarState;
  /** Set theme mode */
  setThemeMode(mode: SidebarThemeMode): void;
  /** Update menu sections */
  updateSections(sections: SidebarMenuSection[]): void;
  /** Update item badge */
  updateItemBadge(itemId: string, badge: number | string | null): void;
  /** Set active item */
  setActiveItem(itemId: string | null): void;
  /** Get active item ID */
  getActiveItem(): string | null;
  /** Update user info in header */
  updateUserInfo(userInfo: SidebarUserInfo): void;
  /** Get current theme mode */
  getThemeMode(): SidebarThemeMode;
  /** Destroy and cleanup */
  destroy(): void;
}

/**
 * Default configuration values
 */
export const DEFAULT_SIDEBAR_CONFIG: Required<Omit<SidebarMenuConfig, 'sections' | 'onItemClick' | 'onStateChange' | 'onSearch' | 'onThemeToggle' | 'onLogout'>> = {
  themeMode: 'light',
  initialState: 'expanded',
  expandedWidth: '260px',
  collapsedWidth: '64px',
  header: {
    title: 'Menu',
  },
  footer: {
    showVersion: false,
  },
  showSearch: false,
  searchPlaceholder: 'Buscar...',
  persistState: false,
  storageKey: 'myio-sidebar-state',
  primaryColor: '#2F5848',
};
