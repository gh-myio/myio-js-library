/**
 * RFC-0140: MenuShopping View
 * UI rendering and DOM management for the Shopping Dashboard menu
 */

import {
  DomainType,
  ThemeMode,
  MenuShoppingTab,
  MenuShoppingUserInfo,
  MenuShoppingConfigTemplate,
  DEFAULT_MENU_SHOPPING_CONFIG,
  MENU_SHOPPING_CSS_PREFIX,
} from './types';
import { injectMenuShoppingStyles } from './styles';

const PREFIX = MENU_SHOPPING_CSS_PREFIX;

type ViewEventType =
  | 'tab-click'
  | 'settings-click'
  | 'shopping-selector-click'
  | 'logout-click'
  | 'hamburger-click';

type ViewEventHandler = (...args: unknown[]) => void;

export class MenuShoppingView {
  private root: HTMLElement;
  private config: Required<MenuShoppingConfigTemplate>;
  private eventHandlers = new Map<ViewEventType, Set<ViewEventHandler>>();
  private collapsed = false;
  private activeDomain: DomainType = null;
  private userInfo: MenuShoppingUserInfo | null = null;
  private themeMode: ThemeMode = 'light';

  // DOM elements
  private containerEl: HTMLElement | null = null;
  private userNameEl: HTMLElement | null = null;
  private userEmailEl: HTMLElement | null = null;
  private tabsContainer: HTMLElement | null = null;
  private versionEl: HTMLElement | null = null;
  private hamburgerBtn: HTMLButtonElement | null = null;
  private settingsBtn: HTMLButtonElement | null = null;
  private shoppingSelectorBtn: HTMLButtonElement | null = null;
  private logoutBtn: HTMLButtonElement | null = null;

  constructor(configTemplate?: MenuShoppingConfigTemplate, themeMode?: ThemeMode) {
    this.config = { ...DEFAULT_MENU_SHOPPING_CONFIG, ...configTemplate };
    this.collapsed = this.config.collapsed;
    this.activeDomain = this.config.initialDomain;
    this.themeMode = themeMode || 'light';

    // Inject styles
    injectMenuShoppingStyles();

    // Create root element
    this.root = document.createElement('nav');
    this.root.className = `${PREFIX}-container${this.collapsed ? ' collapsed' : ''}`;
    this.root.setAttribute('aria-label', 'Menu de navegacao');
    this.root.setAttribute('data-theme', this.themeMode);
  }

  /**
   * Set theme mode (light/dark)
   */
  setThemeMode(mode: ThemeMode): void {
    this.themeMode = mode;
    this.root.setAttribute('data-theme', mode);
  }

  /**
   * Render the menu HTML
   * Structure matches the original MENU widget (shops-menu-root)
   */
  render(): HTMLElement {
    const {
      showUserInfo,
      showSettingsButton,
      showShoppingSelector,
      showLogoutButton,
      showLibraryVersion,
      showHamburgerToggle,
      tabs,
    } = this.config;

    this.root.innerHTML = `
      ${
        showUserInfo
          ? `
      <!-- User info section (matches original) -->
      <div class="${PREFIX}-user">
        <div class="${PREFIX}-user-info">
          <span class="${PREFIX}-user-name">Carregando...</span>
          <span class="${PREFIX}-user-email"></span>
        </div>
      </div>
      `
          : ''
      }

      <!-- Header with hamburger -->
      <div class="${PREFIX}-header">
        ${
          showHamburgerToggle
            ? `
        <button class="${PREFIX}-hamburger" title="Expandir/Recolher menu">☰ Menu</button>
        `
            : ''
        }
      </div>

      <!-- Navigation tabs (matches menu-list) -->
      <div class="${PREFIX}-nav">
        ${tabs
          .map(
            (tab) => `
        <button
          class="${PREFIX}-tab${tab.domain === this.activeDomain ? ' active' : ''}"
          data-domain="${tab.domain || ''}"
          data-tab-id="${tab.id}"
          ${!tab.enabled ? 'disabled' : ''}
          title="${tab.label}"
        >
          <span class="${PREFIX}-tab-icon">${tab.icon}</span>
          <span class="${PREFIX}-tab-label">${tab.label}</span>
        </button>
        `
          )
          .join('')}
      </div>

      <!-- Footer actions (matches menu-footer) -->
      <div class="${PREFIX}-footer">
        ${
          showShoppingSelector
            ? `
        <button class="${PREFIX}-footer-btn shopping-selector" title="Trocar Shopping" style="display: none;">
          <span class="${PREFIX}-footer-btn-icon">🏬</span>
          <span class="${PREFIX}-footer-btn-label">Trocar Shopping</span>
        </button>
        `
            : ''
        }

        ${
          showSettingsButton
            ? `
        <button class="${PREFIX}-footer-btn settings" title="Configuracoes">
          <span class="${PREFIX}-footer-btn-icon">⚙️</span>
          <span class="${PREFIX}-footer-btn-label">Configuracoes</span>
        </button>
        `
            : ''
        }

        ${
          showLogoutButton
            ? `
        <button class="${PREFIX}-footer-btn logout" title="Sair">
          <span class="${PREFIX}-footer-btn-icon">🚪</span>
          <span class="${PREFIX}-footer-btn-label">Sair</span>
        </button>
        `
            : ''
        }
      </div>

      ${
        showLibraryVersion
          ? `
      <!-- Version display (matches lib-version-display) -->
      <div class="${PREFIX}-version" id="${PREFIX}-version-container"></div>
      `
          : ''
      }
    `;

    this.containerEl = this.root;
    this.cacheElements();
    this.bindEvents();

    return this.root;
  }

  /**
   * Cache DOM element references
   */
  private cacheElements(): void {
    this.userNameEl = this.root.querySelector(`.${PREFIX}-user-name`);
    this.userEmailEl = this.root.querySelector(`.${PREFIX}-user-email`);
    this.tabsContainer = this.root.querySelector(`.${PREFIX}-nav`);
    this.versionEl = this.root.querySelector(`.${PREFIX}-version`);
    this.hamburgerBtn = this.root.querySelector(`.${PREFIX}-hamburger`);
    this.settingsBtn = this.root.querySelector(`.${PREFIX}-footer-btn.settings`);
    this.shoppingSelectorBtn = this.root.querySelector(`.${PREFIX}-footer-btn.shopping-selector`);
    this.logoutBtn = this.root.querySelector(`.${PREFIX}-footer-btn.logout`);
  }

  /**
   * Bind DOM event handlers
   */
  private bindEvents(): void {
    // Listen for global theme changes
    window.addEventListener('myio:theme-change', ((e: CustomEvent<{ mode: 'light' | 'dark' }>) => {
      this.setThemeMode(e.detail.mode);
    }) as EventListener);

    // Hamburger toggle
    this.hamburgerBtn?.addEventListener('click', () => {
      this.emit('hamburger-click');
    });

    // Tab clicks
    this.tabsContainer?.querySelectorAll(`.${PREFIX}-tab`).forEach((tab) => {
      tab.addEventListener('click', () => {
        const domain = tab.getAttribute('data-domain') as DomainType;
        const tabId = tab.getAttribute('data-tab-id') || '';
        if (domain) {
          this.emit('tab-click', domain, tabId);
        }
      });
    });

    // Settings button
    this.settingsBtn?.addEventListener('click', () => {
      this.emit('settings-click');
    });

    // Shopping selector button
    this.shoppingSelectorBtn?.addEventListener('click', () => {
      this.emit('shopping-selector-click');
    });

    // Logout button
    this.logoutBtn?.addEventListener('click', () => {
      this.emit('logout-click');
    });

    // Setup tooltips for collapsed mode
    this.setupCollapsedTooltips();
  }

  /**
   * Setup tooltips for collapsed mode
   */
  private setupCollapsedTooltips(): void {
    let tooltip = document.getElementById(`${PREFIX}-tooltip`);
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = `${PREFIX}-tooltip`;
      tooltip.className = `${PREFIX}-tooltip`;
      document.body.appendChild(tooltip);
    }

    const showTooltip = (el: HTMLElement, text: string) => {
      if (!this.collapsed || !tooltip) return;
      const rect = el.getBoundingClientRect();
      tooltip.textContent = text;
      tooltip.style.left = rect.right + 8 + 'px';
      tooltip.style.top = rect.top + rect.height / 2 - 12 + 'px';
      tooltip.classList.add('show');
    };

    const hideTooltip = () => {
      tooltip?.classList.remove('show');
    };

    // Add tooltip listeners to tabs
    this.tabsContainer?.querySelectorAll(`.${PREFIX}-tab`).forEach((tab) => {
      const label = tab.querySelector(`.${PREFIX}-tab-label`)?.textContent || '';
      tab.addEventListener('mouseenter', () => showTooltip(tab as HTMLElement, label));
      tab.addEventListener('mouseleave', hideTooltip);
    });

    // Add tooltip listeners to footer buttons
    [this.settingsBtn, this.shoppingSelectorBtn, this.logoutBtn].forEach((btn) => {
      if (!btn) return;
      const label = btn.querySelector(`.${PREFIX}-footer-btn-label`)?.textContent || '';
      btn.addEventListener('mouseenter', () => showTooltip(btn, label));
      btn.addEventListener('mouseleave', hideTooltip);
    });
  }

  /**
   * Update user info display
   */
  updateUserInfo(userInfo: MenuShoppingUserInfo): void {
    this.userInfo = userInfo;

    if (this.userNameEl) {
      this.userNameEl.textContent = userInfo.name || '--';
    }

    if (this.userEmailEl) {
      this.userEmailEl.textContent = userInfo.email || '--';
    }

    // Show/hide admin features
    this.setAdminMode(userInfo.isAdmin || false);
  }

  /**
   * Set admin mode (show/hide admin-only controls)
   */
  setAdminMode(isAdmin: boolean): void {
    if (this.shoppingSelectorBtn) {
      this.shoppingSelectorBtn.style.display = isAdmin ? 'flex' : 'none';
    }
  }

  /**
   * Set active tab/domain
   */
  setActiveDomain(domain: DomainType): void {
    this.activeDomain = domain;

    this.tabsContainer?.querySelectorAll(`.${PREFIX}-tab`).forEach((tab) => {
      const tabDomain = tab.getAttribute('data-domain');
      if (tabDomain === domain) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  /**
   * Get current active domain
   */
  getActiveDomain(): DomainType {
    return this.activeDomain;
  }

  /**
   * Set collapsed state
   */
  setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    if (collapsed) {
      this.root.classList.add('collapsed');
    } else {
      this.root.classList.remove('collapsed');
    }
  }

  /**
   * Get collapsed state
   */
  isCollapsed(): boolean {
    return this.collapsed;
  }

  /**
   * Enable/disable a tab
   */
  setTabEnabled(tabId: string, enabled: boolean): void {
    const tab = this.tabsContainer?.querySelector(`[data-tab-id="${tabId}"]`) as HTMLButtonElement;
    if (tab) {
      tab.disabled = !enabled;
    }
  }

  /**
   * Update library version display
   */
  setVersion(version: string): void {
    if (this.versionEl) {
      this.versionEl.textContent = `v${version}`;
    }
  }

  /**
   * Event emission
   */
  private emit(event: ViewEventType, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((h) => h(...args));
    }
  }

  /**
   * Register event handler
   */
  on(event: ViewEventType, handler: ViewEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove event handler
   */
  off(event: ViewEventType, handler: ViewEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Destroy the view
   */
  destroy(): void {
    this.eventHandlers.clear();
    this.root.remove();

    // Remove tooltip if created
    const tooltip = document.getElementById(`${PREFIX}-tooltip`);
    tooltip?.remove();
  }

  /**
   * Get root element
   */
  getElement(): HTMLElement {
    return this.root;
  }
}
