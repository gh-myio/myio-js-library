/**
 * RFC-0112: Welcome Modal Head Office Component
 * Type definitions for the Welcome Modal
 */

/**
 * Theme mode for the Welcome Modal
 */
export type WelcomeThemeMode = 'dark' | 'light';

/**
 * Theme-specific configuration (colors, background, logo)
 * Used for darkMode and lightMode settings
 */
export interface WelcomeThemeConfig {
  // Background & Logo (theme-specific)
  /** Background image URL for hero section */
  backgroundUrl?: string;
  /** MYIO logo URL */
  logoUrl?: string;

  // Brand Colors
  /** Primary brand color */
  primaryColor?: string;
  /** Secondary brand color */
  secondaryColor?: string;
  /** Main text color (fallback for all text) */
  textColor?: string;
  /** Muted text color */
  mutedTextColor?: string;

  // Hero Text Colors (granular control)
  /** Hero title color (defaults to textColor) */
  heroTitleColor?: string;
  /** Hero description color (defaults to mutedTextColor) */
  heroDescriptionColor?: string;
  /** CTA button text color (defaults to textColor) */
  ctaTextColor?: string;
  /** CTA button background color (defaults to primaryColor) */
  ctaBackgroundColor?: string;
  /** Shortcuts section title color (defaults to mutedTextColor) */
  shortcutsTitleColor?: string;

  // Gradient Colors
  /** Gradient overlay start color */
  gradientStartColor?: string;
  /** Gradient overlay end color */
  gradientEndColor?: string;

  // User Menu Colors
  /** User menu background color */
  userMenuBackgroundColor?: string;
  /** User menu border color */
  userMenuBorderColor?: string;
  /** Logout button background color */
  logoutButtonBackgroundColor?: string;
  /** Logout button border color */
  logoutButtonBorderColor?: string;

  // Shopping Card Colors
  /** Shopping card background color */
  shoppingCardBackgroundColor?: string;
  /** Shopping card border color */
  shoppingCardBorderColor?: string;
}

/**
 * Configuration template for Welcome Modal
 * Maps to ThingsBoard widget settingsSchema.json
 * Supports theme-specific settings via darkMode/lightMode
 */
export interface WelcomeConfigTemplate {
  // Debug
  /** Enable console logging for debugging */
  enableDebugMode?: boolean;

  // Hero Text Content (shared across themes)
  /** Default hero title */
  defaultHeroTitle?: string;
  /** Default hero description */
  defaultHeroDescription?: string;
  /** Default CTA button label */
  defaultPrimaryLabel?: string;
  /** Default shortcuts section title (default: "Acesso Rápido aos Shoppings") */
  defaultShortcutsTitle?: string;

  // Navigation & Features (shared across themes)
  /** Default dashboard state for primary CTA button */
  defaultPrimaryState?: string;
  /** Show user menu by default */
  showUserMenuByDefault?: boolean;
  /** Enable lazy loading for shopping card images */
  enableLazyLoading?: boolean;
  /** Root margin for IntersectionObserver (lazy loading) */
  lazyLoadRootMargin?: string;

  // Theme-specific settings
  /** Dark mode configuration (colors, background, logo) */
  darkMode?: WelcomeThemeConfig;
  /** Light mode configuration (colors, background, logo) */
  lightMode?: WelcomeThemeConfig;
}

/**
 * Default theme configuration for dark mode
 */
export const DEFAULT_DARK_THEME: WelcomeThemeConfig = {
  backgroundUrl: 'https://dashboard.myio-bas.com/api/images/public/wntqPf1KcpLX2l182DY86Y4p8pa3bj6F',
  logoUrl: 'https://dashboard.myio-bas.com/api/images/public/1Tl6OQO9NWvexQw18Kkb2VBkN04b8tYG',
  primaryColor: '#7A2FF7',
  secondaryColor: '#5A1FD1',
  textColor: '#F5F7FA',
  mutedTextColor: '#B8C2D8',
  gradientStartColor: 'rgba(10,18,44,0.55)',
  gradientEndColor: 'rgba(10,18,44,0.15)',
  userMenuBackgroundColor: 'rgba(255, 255, 255, 0.15)',
  userMenuBorderColor: 'rgba(255, 255, 255, 0.3)',
  logoutButtonBackgroundColor: 'rgba(255, 255, 255, 0.2)',
  logoutButtonBorderColor: 'rgba(255, 255, 255, 0.4)',
  shoppingCardBackgroundColor: 'rgba(255, 255, 255, 0.1)',
  shoppingCardBorderColor: 'rgba(255, 255, 255, 0.2)',
};

/**
 * Default theme configuration for light mode
 */
export const DEFAULT_LIGHT_THEME: WelcomeThemeConfig = {
  backgroundUrl: 'https://dashboard.myio-bas.com/api/images/public/wntqPf1KcpLX2l182DY86Y4p8pa3bj6F',
  logoUrl: 'https://dashboard.myio-bas.com/api/images/public/1Tl6OQO9NWvexQw18Kkb2VBkN04b8tYG',
  primaryColor: '#7A2FF7',
  secondaryColor: '#5A1FD1',
  textColor: '#1a1a2e',
  mutedTextColor: '#4a4a6a',
  gradientStartColor: 'rgba(255,255,255,0.7)',
  gradientEndColor: 'rgba(248,249,252,0.85)',
  userMenuBackgroundColor: 'rgba(255, 255, 255, 0.85)',
  userMenuBorderColor: 'rgba(0, 0, 0, 0.1)',
  logoutButtonBackgroundColor: 'rgba(0, 0, 0, 0.05)',
  logoutButtonBorderColor: 'rgba(0, 0, 0, 0.12)',
  shoppingCardBackgroundColor: 'rgba(255, 255, 255, 0.9)',
  shoppingCardBorderColor: 'rgba(0, 0, 0, 0.08)',
};

/**
 * Default configuration template values
 */
export const DEFAULT_CONFIG_TEMPLATE: WelcomeConfigTemplate = {
  enableDebugMode: false,
  defaultHeroTitle: 'Bem-vindo ao MYIO Platform',
  defaultHeroDescription: 'Gestão inteligente de energia, água e recursos para shoppings centers',
  defaultPrimaryLabel: 'ACESSAR PAINEL',
  defaultPrimaryState: 'main',
  showUserMenuByDefault: true,
  enableLazyLoading: true,
  lazyLoadRootMargin: '50px',
  darkMode: DEFAULT_DARK_THEME,
  lightMode: DEFAULT_LIGHT_THEME,
};

/**
 * Color palette for the Welcome Modal
 */
export interface WelcomePalette {
  /** Primary brand color (default: #7A2FF7) */
  primary: string;
  /** Secondary brand color (default: #5A1FD1) */
  secondary: string;
  /** Gradient overlay start color (default: rgba(10,18,44,0.55)) */
  gradientStart: string;
  /** Gradient overlay end color (default: rgba(10,18,44,0.15)) */
  gradientEnd: string;
  /** Primary text color (default: #F5F7FA) */
  ink: string;
  /** Muted/secondary text color (default: #B8C2D8) */
  muted: string;
  /** User menu background color */
  userMenuBg?: string;
  /** User menu border color */
  userMenuBorder?: string;
  /** Logout button background color */
  logoutBtnBg?: string;
  /** Logout button border color */
  logoutBtnBorder?: string;
  /** Shopping card background color */
  shoppingCardBg?: string;
  /** Shopping card border color */
  shoppingCardBorder?: string;
}

/**
 * Device counts by domain for shopping card
 */
export interface ShoppingCardDeviceCounts {
  /** Number of energy devices */
  energy?: number;
  /** Number of water devices */
  water?: number;
  /** Number of temperature sensors */
  temperature?: number;
}

/**
 * Meta counts for shopping card (users, alarms, notifications)
 */
export interface ShoppingCardMetaCounts {
  /** Number of users with access */
  users?: number;
  /** Number of active alarms */
  alarms?: number;
  /** Number of unread notifications */
  notifications?: number;
}

/**
 * Shopping card configuration
 */
export interface ShoppingCard {
  /** Display title for the shopping center */
  title: string;
  /** Optional subtitle (shown if deviceCounts not provided) */
  subtitle?: string;
  /** ThingsBoard dashboard ID to navigate to */
  dashboardId: string;
  /** Entity ID (usually the customer/asset ID) */
  entityId: string;
  /** Entity type (default: "ASSET") */
  entityType?: string;
  /** Optional background image URL for the card */
  bgImageUrl?: string;
  /** Optional button ID for analytics tracking */
  buttonId?: string;
  /** Device counts by domain (replaces subtitle if provided) */
  deviceCounts?: ShoppingCardDeviceCounts;
  /** Meta counts (users, alarms, notifications) - shown above title */
  metaCounts?: ShoppingCardMetaCounts;
}

/**
 * User information displayed in the user menu
 */
export interface UserInfo {
  /** User's full name */
  fullName: string;
  /** User's email address */
  email: string;
}

/**
 * Minimal ThingsBoard context interface for navigation
 */
export interface ThingsboardWidgetContext {
  stateController?: {
    openState: (state: string, params?: Record<string, unknown>, replaceHistory?: boolean) => void;
  };
  router?: {
    navigateByUrl: (url: string) => void;
  };
  logout?: () => void;
}

/**
 * Parameters for opening the Welcome Modal
 */
export interface WelcomeModalParams {
  // ThingsBoard context (optional for navigation - can work standalone)
  ctx?: ThingsboardWidgetContext;

  /**
   * Configuration template from ThingsBoard widget settings
   * Contains all customization options from settingsSchema.json
   * Values here serve as defaults that can be overridden by other params
   */
  configTemplate?: WelcomeConfigTemplate;

  // Theme Mode (controlled by MAIN component)
  /**
   * Current theme mode (dark or light)
   * Controlled by the MAIN component and exposed globally
   */
  themeMode?: WelcomeThemeMode;
  /**
   * Whether to show the theme toggle button (sun/moon icon)
   * Default: true
   */
  showThemeToggle?: boolean;

  // Brand Configuration (override configTemplate if provided)
  /** URL for the brand logo (top-left corner) */
  logoUrl?: string;
  /** Color palette for theming */
  palette?: Partial<WelcomePalette>;
  /** Background image URL for the hero section */
  backgroundUrl?: string;

  // Hero Content (override configTemplate if provided)
  /** Main welcome title (default: "Bem-vindo ao MYIO Platform") */
  heroTitle?: string;
  /** Description text below the title */
  heroDescription?: string;
  /** CTA button label (default: "ACESSAR PAINEL") */
  ctaLabel?: string;
  /** State to navigate to when CTA is clicked (default: "main") */
  ctaState?: string;
  /** Shortcuts section title (default: "Acesso Rápido aos Shoppings") */
  shortcutsTitle?: string;

  // User Menu
  /** Whether to show the user menu (default: true) */
  showUserMenu?: boolean;
  /** User information to display. If not provided, will attempt to fetch from API */
  userInfo?: UserInfo;

  // Shopping Cards
  /** Array of shopping cards to display */
  shoppingCards?: ShoppingCard[];

  // Modal Behavior
  /** Close modal when clicking backdrop (default: false for full-screen) */
  closeOnBackdrop?: boolean;
  /** Close modal when pressing Escape key (default: true) */
  closeOnEscape?: boolean;
  /** Close modal when CTA button is clicked (default: true) */
  closeOnCtaClick?: boolean;
  /** Close modal when a shopping card is clicked (default: true) */
  closeOnCardClick?: boolean;

  // Callbacks
  /** Called when the modal is closed */
  onClose?: () => void;
  /** Called when the CTA button is clicked */
  onCtaClick?: () => void;
  /** Called when a shopping card is clicked */
  onCardClick?: (card: ShoppingCard) => void;
  /** Called when the logout button is clicked */
  onLogout?: () => void;
  /**
   * Called when the theme toggle button is clicked
   * The MAIN component should handle this to update global theme
   */
  onThemeChange?: (newTheme: WelcomeThemeMode) => void;
}

/**
 * Instance returned by openWelcomeModal
 */
export interface WelcomeModalInstance {
  /** Close the modal programmatically */
  close: () => void;
  /** The modal's root DOM element */
  element: HTMLElement;
  /** Register event handlers */
  on: (event: 'close', handler: () => void) => void;
  /** Set the theme mode programmatically (e.g., from MAIN component) */
  setThemeMode: (mode: WelcomeThemeMode) => void;
  /** Get the current theme mode */
  getThemeMode: () => WelcomeThemeMode;
}

/**
 * Default palette values
 */
export const DEFAULT_PALETTE: WelcomePalette = {
  primary: '#7A2FF7',
  secondary: '#5A1FD1',
  gradientStart: 'rgba(10,18,44,0.55)',
  gradientEnd: 'rgba(10,18,44,0.15)',
  ink: '#F5F7FA',
  muted: '#B8C2D8',
  userMenuBg: 'rgba(255,255,255,0.08)',
  userMenuBorder: 'rgba(255,255,255,0.12)',
  logoutBtnBg: 'rgba(255,255,255,0.08)',
  logoutBtnBorder: 'rgba(255,255,255,0.15)',
  shoppingCardBg: 'rgba(255,255,255,0.06)',
  shoppingCardBorder: 'rgba(255,255,255,0.1)',
};

/**
 * Default shopping cards for Head Office
 */
export const DEFAULT_SHOPPING_CARDS: ShoppingCard[] = [
  {
    title: 'Mestre Álvaro',
    dashboardId: 'dashboard-mestre-alvaro',
    entityId: 'entity-mestre-alvaro',
    entityType: 'ASSET',
    deviceCounts: { energy: 45, water: 12, temperature: 8 },
    metaCounts: { users: 12, alarms: 3, notifications: 5 },
  },
  {
    title: 'Mont Serrat',
    dashboardId: 'dashboard-mont-serrat',
    entityId: 'entity-mont-serrat',
    entityType: 'ASSET',
    deviceCounts: { energy: 38, water: 10, temperature: 6 },
    metaCounts: { users: 8, alarms: 1, notifications: 2 },
  },
  {
    title: 'Vitória Mall',
    dashboardId: 'dashboard-vitoria-mall',
    entityId: 'entity-vitoria-mall',
    entityType: 'ASSET',
    deviceCounts: { energy: 52, water: 15, temperature: 10 },
    metaCounts: { users: 15, alarms: 5, notifications: 8 },
  },
  {
    title: 'Shopping Norte',
    dashboardId: 'dashboard-norte',
    entityId: 'entity-norte',
    entityType: 'ASSET',
    deviceCounts: { energy: 33, water: 8, temperature: 5 },
    metaCounts: { users: 6, alarms: 0, notifications: 1 },
  },
  {
    title: 'Shopping Sul',
    dashboardId: 'dashboard-sul',
    entityId: 'entity-sul',
    entityType: 'ASSET',
    deviceCounts: { energy: 41, water: 11, temperature: 7 },
    metaCounts: { users: 10, alarms: 2, notifications: 4 },
  },
  {
    title: 'Shopping Leste',
    dashboardId: 'dashboard-leste',
    entityId: 'entity-leste',
    entityType: 'ASSET',
    deviceCounts: { energy: 29, water: 7, temperature: 4 },
    metaCounts: { users: 5, alarms: 1, notifications: 0 },
  },
];
