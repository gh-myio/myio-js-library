/**
 * RFC-0140: MenuShopping Component Factory
 * Creates and manages the Shopping Dashboard menu navigation component
 */

import { MenuShoppingView } from './MenuShoppingView';
import {
  DomainType,
  ThemeMode,
  MenuShoppingParams,
  MenuShoppingInstance,
  MenuShoppingSettings,
  MenuShoppingUserInfo,
  MenuShoppingEventType,
  MenuShoppingEventHandler,
  DEFAULT_MENU_SHOPPING_CONFIG,
  MENU_SHOPPING_CSS_PREFIX,
} from './types';
import { createLibraryVersionChecker } from '../library-version-checker';

// Type-safe window access helpers to avoid global declaration conflicts
const getWindow = (): any => window;
const getLib = (): any => getWindow().MyIOLibrary;

/**
 * Default settings
 */
const DEFAULT_SETTINGS: MenuShoppingSettings = {
  temperatureUnit: 'celsius',
  contractView: 'all',
  measurementType: 'consumption',
};

/**
 * Create a MenuShopping component instance
 */
export function createMenuShoppingComponent(params: MenuShoppingParams): MenuShoppingInstance {
  const {
    container,
    themeMode: initialThemeMode,
    userInfo,
    configTemplate,
    settings: initialSettings,
    onTabChange,
    onSettingsClick,
    onShoppingSelectorClick,
    onLogoutClick,
    onToggleCollapse,
  } = params;

  // Merge config with defaults
  const config = { ...DEFAULT_MENU_SHOPPING_CONFIG, ...configTemplate };

  // Initialize state
  let currentDomain: DomainType = config.initialDomain;
  let currentSettings: MenuShoppingSettings = { ...DEFAULT_SETTINGS, ...initialSettings };
  let collapsed = config.collapsed;
  let themeMode: ThemeMode = initialThemeMode || 'light';

  // Event handlers
  const eventHandlers = new Map<MenuShoppingEventType, Set<MenuShoppingEventHandler>>();

  // Create view with theme mode
  const view = new MenuShoppingView(configTemplate, themeMode);

  // Render view into container
  const element = view.render();
  container.appendChild(element);

  // Set initial user info if provided
  if (userInfo) {
    view.updateUserInfo(userInfo);
  }

  // Version checker instance reference
  let versionCheckerInstance: { destroy: () => void; setTheme?: (theme: string) => void } | null =
    null;

  // Try to get library version
  trySetLibraryVersionChecker();

  // Bind view events to component logic
  bindViewEvents();

  // Listen for global events
  bindGlobalEvents();

  /**
   * Initialize the library version checker component
   */
  function trySetLibraryVersionChecker(): void {
    try {
      const versionContainer = element.querySelector(`#${MENU_SHOPPING_CSS_PREFIX}-version-container`);
      if (!versionContainer) {
        return;
      }

      const lib = getLib();
      const currentVersion = lib?.version || 'unknown';

      // Use createLibraryVersionChecker for full version checking functionality
      versionCheckerInstance = createLibraryVersionChecker(versionContainer as HTMLElement, {
        packageName: 'myio-js-library',
        currentVersion,
        theme: themeMode,
        onStatusChange: (status: string, current: string, latest: string) => {
          if (status === 'outdated') {
            console.log(`[MENU] Library version outdated: ${current} → ${latest}`);
          }
        },
      });
    } catch (err) {
      // Fallback: just show version text
      const lib = getLib();
      if (lib?.version) {
        view.setVersion(lib.version);
      }
    }
  }

  /**
   * Bind view events to component logic
   */
  function bindViewEvents(): void {
    // Tab click
    view.on('tab-click', (domain: unknown, tabId: unknown) => {
      const domainType = domain as DomainType;
      const tabIdStr = tabId as string;

      if (domainType !== currentDomain) {
        currentDomain = domainType;
        view.setActiveDomain(domainType);

        // Emit domain change event
        emitEvent('tab-change', domainType, tabIdStr);
        emitEvent('domain-changed', domainType);

        // Dispatch global event for other components
        dispatchDashboardState(domainType, tabIdStr);

        // Call callback
        onTabChange?.(domainType, tabIdStr);
      }
    });

    // Hamburger click
    view.on('hamburger-click', () => {
      collapsed = !collapsed;
      view.setCollapsed(collapsed);
      emitEvent('collapse-toggle', collapsed);
      onToggleCollapse?.(collapsed);
    });

    // Settings click
    view.on('settings-click', () => {
      emitEvent('settings-click');
      onSettingsClick?.();
    });

    // Shopping selector click
    view.on('shopping-selector-click', () => {
      emitEvent('shopping-selector-click');
      onShoppingSelectorClick?.();
    });

    // Logout click
    view.on('logout-click', () => {
      emitEvent('logout-click');
      onLogoutClick?.();
    });
  }

  /**
   * Bind global window events
   */
  function bindGlobalEvents(): void {
    // Listen for theme changes (both event formats)
    getWindow().addEventListener('myio:theme-changed', handleThemeChange);
    getWindow().addEventListener('myio:theme-change', handleThemeChange);

    // Listen for external domain change requests
    getWindow().addEventListener('myio:set-domain', handleExternalDomainChange);
  }

  /**
   * Handle theme change event
   */
  function handleThemeChange(event: CustomEvent): void {
    const theme = event.detail?.theme || event.detail?.mode;
    if (theme) {
      themeMode = theme;
      element.setAttribute('data-theme', theme);
      view.setThemeMode(theme);
      // Also update version checker theme
      if (versionCheckerInstance?.setTheme) {
        versionCheckerInstance.setTheme(theme);
      }
    }
  }

  /**
   * Handle external domain change request
   */
  function handleExternalDomainChange(event: CustomEvent): void {
    const domain = event.detail?.domain as DomainType;
    if (domain && domain !== currentDomain) {
      instance.setActiveDomain(domain);
    }
  }

  /**
   * Dispatch dashboard state event
   */
  function dispatchDashboardState(domain: DomainType, tabId: string): void {
    const event = new CustomEvent('myio:dashboard-state', {
      detail: {
        domain,
        tab: tabId,
        timestamp: Date.now(),
      },
      bubbles: true,
    });
    getWindow().dispatchEvent(event);
  }

  /**
   * Emit event to handlers
   */
  function emitEvent(event: MenuShoppingEventType, ...args: unknown[]): void {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((h) => h(...args));
    }
  }

  /**
   * Cleanup function
   */
  function cleanup(): void {
    getWindow().removeEventListener('myio:theme-changed', handleThemeChange);
    getWindow().removeEventListener('myio:theme-change', handleThemeChange);
    getWindow().removeEventListener('myio:set-domain', handleExternalDomainChange);
    eventHandlers.clear();
    // Destroy version checker
    if (versionCheckerInstance?.destroy) {
      versionCheckerInstance.destroy();
      versionCheckerInstance = null;
    }
    view.destroy();
  }

  // Create instance object
  const instance: MenuShoppingInstance = {
    getCurrentDomain(): DomainType {
      return currentDomain;
    },

    setActiveDomain(domain: DomainType): void {
      if (domain !== currentDomain) {
        currentDomain = domain;
        view.setActiveDomain(domain);
        emitEvent('domain-changed', domain);
        dispatchDashboardState(domain, `tab-${domain}`);
      }
    },

    setThemeMode(mode: ThemeMode): void {
      themeMode = mode;
      view.setThemeMode(mode);
    },

    updateUserInfo(info: MenuShoppingUserInfo): void {
      view.updateUserInfo(info);
    },

    setCollapsed(isCollapsed: boolean): void {
      collapsed = isCollapsed;
      view.setCollapsed(isCollapsed);
    },

    isCollapsed(): boolean {
      return collapsed;
    },

    setTabEnabled(tabId: string, enabled: boolean): void {
      view.setTabEnabled(tabId, enabled);
    },

    updateSettings(newSettings: Partial<MenuShoppingSettings>): void {
      currentSettings = { ...currentSettings, ...newSettings };
    },

    getSettings(): MenuShoppingSettings {
      return { ...currentSettings };
    },

    setAdminMode(isAdmin: boolean): void {
      view.setAdminMode(isAdmin);
    },

    destroy(): void {
      cleanup();
    },

    getElement(): HTMLElement {
      return element;
    },

    on(event: MenuShoppingEventType, handler: MenuShoppingEventHandler): void {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
    },

    off(event: MenuShoppingEventType, handler: MenuShoppingEventHandler): void {
      eventHandlers.get(event)?.delete(handler);
    },
  };

  return instance;
}
