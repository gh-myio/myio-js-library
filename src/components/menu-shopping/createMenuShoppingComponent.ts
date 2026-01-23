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
} from './types';

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

  // Try to get library version
  trySetLibraryVersion();

  // Bind view events to component logic
  bindViewEvents();

  // Listen for global events
  bindGlobalEvents();

  /**
   * Try to set the library version from MyIOLibrary
   */
  function trySetLibraryVersion(): void {
    try {
      const lib = getLib();
      if (lib?.version) {
        view.setVersion(lib.version);
      }
    } catch {
      // Ignore if library not available
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
    // Listen for theme changes
    getWindow().addEventListener('myio:theme-changed', handleThemeChange);

    // Listen for external domain change requests
    getWindow().addEventListener('myio:set-domain', handleExternalDomainChange);
  }

  /**
   * Handle theme change event
   */
  function handleThemeChange(event: CustomEvent): void {
    const theme = event.detail?.theme;
    if (theme) {
      element.setAttribute('data-theme', theme);
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
    getWindow().removeEventListener('myio:set-domain', handleExternalDomainChange);
    eventHandlers.clear();
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
