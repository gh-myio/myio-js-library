/**
 * RFC-0173: Sidebar Menu View
 * DOM rendering for the premium retractable sidebar menu
 */

import { SIDEBAR_MENU_CSS_PREFIX, injectSidebarMenuStyles } from './styles';
import { SIDEBAR_ICONS } from './icons';
import type {
  SidebarMenuConfig,
  SidebarMenuSection,
  SidebarMenuItem,
  SidebarHeaderConfig,
  SidebarFooterConfig,
  SidebarState,
  SidebarThemeMode,
  SidebarUserInfo,
} from './types';
import { DEFAULT_SIDEBAR_CONFIG } from './types';

export class SidebarMenuView {
  private root: HTMLElement;
  private config: SidebarMenuConfig;
  private state: SidebarState;
  private themeMode: SidebarThemeMode;
  private activeItemId: string | null = null;
  private collapsedSections: Set<string> = new Set();
  private tooltip: HTMLElement | null = null;

  constructor(container: HTMLElement, config: SidebarMenuConfig) {
    injectSidebarMenuStyles();

    this.config = { ...DEFAULT_SIDEBAR_CONFIG, ...config };
    this.state = this.config.initialState || 'expanded';
    this.themeMode = this.config.themeMode || 'light';

    // Load persisted state if enabled
    if (this.config.persistState && this.config.storageKey) {
      const savedState = localStorage.getItem(this.config.storageKey);
      if (savedState === 'expanded' || savedState === 'collapsed') {
        this.state = savedState;
      }
    }

    this.root = this.createSidebar();
    container.appendChild(this.root);

    // Create tooltip element
    this.createTooltip();
  }

  private createSidebar(): HTMLElement {
    const sidebar = document.createElement('nav');
    sidebar.className = `${SIDEBAR_MENU_CSS_PREFIX} ${this.themeMode}`;
    sidebar.setAttribute('role', 'navigation');
    sidebar.setAttribute('aria-label', 'Menu principal');

    if (this.state === 'collapsed') {
      sidebar.classList.add('collapsed');
    }

    // Apply custom CSS variables if provided
    if (this.config.expandedWidth) {
      sidebar.style.setProperty('--sidebar-expanded-width', this.config.expandedWidth);
    }
    if (this.config.collapsedWidth) {
      sidebar.style.setProperty('--sidebar-collapsed-width', this.config.collapsedWidth);
    }
    if (this.config.primaryColor) {
      sidebar.style.setProperty('--sidebar-primary', this.config.primaryColor);
    }

    // Build sidebar structure
    sidebar.innerHTML = `
      ${this.renderHeader()}
      ${this.config.showSearch ? this.renderSearch() : ''}
      ${this.renderContent()}
      ${this.renderFooter()}
    `;

    // Bind events
    this.bindEvents(sidebar);

    return sidebar;
  }

  private renderHeader(): string {
    const header = this.config.header || {};
    const logo = header.logo || SIDEBAR_ICONS.logo;
    const showThemeToggle = header.showThemeToggle !== false; // default true
    const userInfo = header.userInfo;

    return `
      <div class="${SIDEBAR_MENU_CSS_PREFIX}__header">
        <div class="${SIDEBAR_MENU_CSS_PREFIX}__header-top">
          <div class="${SIDEBAR_MENU_CSS_PREFIX}__logo">
            ${logo}
          </div>
          <div class="${SIDEBAR_MENU_CSS_PREFIX}__header-text">
            ${header.title ? `<span class="${SIDEBAR_MENU_CSS_PREFIX}__title">${header.title}</span>` : ''}
            ${header.subtitle ? `<span class="${SIDEBAR_MENU_CSS_PREFIX}__subtitle">${header.subtitle}</span>` : ''}
          </div>
          ${showThemeToggle ? `
            <button
              class="${SIDEBAR_MENU_CSS_PREFIX}__theme-toggle"
              data-action="theme-toggle"
              aria-label="Alternar tema"
              title="${this.themeMode === 'dark' ? 'Tema escuro' : 'Tema claro'}"
            >
              ${this.themeMode === 'dark' ? SIDEBAR_ICONS.moon : SIDEBAR_ICONS.sun}
            </button>
          ` : ''}
          <button
            class="${SIDEBAR_MENU_CSS_PREFIX}__toggle"
            data-action="toggle"
            aria-label="${this.state === 'expanded' ? 'Recolher menu' : 'Expandir menu'}"
            aria-expanded="${this.state === 'expanded'}"
          >
            ${this.state === 'expanded' ? SIDEBAR_ICONS.chevronLeft : SIDEBAR_ICONS.chevronRight}
          </button>
        </div>
        ${userInfo ? `
          <div class="${SIDEBAR_MENU_CSS_PREFIX}__user-info">
            <span class="${SIDEBAR_MENU_CSS_PREFIX}__user-name">${userInfo.name || ''}</span>
            <span class="${SIDEBAR_MENU_CSS_PREFIX}__user-email">${userInfo.email || ''}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderSearch(): string {
    const placeholder = this.config.searchPlaceholder || 'Buscar...';

    return `
      <div class="${SIDEBAR_MENU_CSS_PREFIX}__search">
        <div class="${SIDEBAR_MENU_CSS_PREFIX}__search-wrapper">
          <span class="${SIDEBAR_MENU_CSS_PREFIX}__search-icon">
            ${SIDEBAR_ICONS.search}
          </span>
          <input
            type="text"
            class="${SIDEBAR_MENU_CSS_PREFIX}__search-input"
            placeholder="${placeholder}"
            data-action="search"
            aria-label="Buscar"
          />
        </div>
      </div>
    `;
  }

  private renderContent(): string {
    const sections = this.config.sections || [];

    return `
      <div class="${SIDEBAR_MENU_CSS_PREFIX}__content" role="menu">
        ${sections.map(section => this.renderSection(section)).join('')}
      </div>
    `;
  }

  private renderSection(section: SidebarMenuSection): string {
    const isCollapsed = this.collapsedSections.has(section.id);
    const collapsedClass = isCollapsed ? 'collapsed' : '';

    return `
      <div class="${SIDEBAR_MENU_CSS_PREFIX}__section ${collapsedClass}" data-section-id="${section.id}">
        ${section.title ? `
          <div class="${SIDEBAR_MENU_CSS_PREFIX}__section-header" ${section.collapsible ? 'data-action="toggle-section"' : ''}>
            <span class="${SIDEBAR_MENU_CSS_PREFIX}__section-title">${section.title}</span>
            ${section.collapsible ? `
              <span class="${SIDEBAR_MENU_CSS_PREFIX}__section-toggle">
                ${SIDEBAR_ICONS.chevronDown}
              </span>
            ` : ''}
          </div>
        ` : ''}
        <div class="${SIDEBAR_MENU_CSS_PREFIX}__section-items" role="group" aria-label="${section.title || 'Menu items'}">
          ${section.items.map(item => this.renderItem(item, section)).join('')}
        </div>
      </div>
    `;
  }

  private renderItem(item: SidebarMenuItem, section: SidebarMenuSection): string {
    const isActive = this.activeItemId === item.id;
    const activeClass = isActive ? 'active' : '';
    const disabledClass = item.disabled ? 'disabled' : '';

    return `
      <div
        class="${SIDEBAR_MENU_CSS_PREFIX}__item ${activeClass} ${disabledClass}"
        data-item-id="${item.id}"
        data-section-id="${section.id}"
        data-action="item-click"
        role="menuitem"
        tabindex="${item.disabled ? -1 : 0}"
        aria-current="${isActive ? 'page' : 'false'}"
        ${item.disabled ? 'aria-disabled="true"' : ''}
      >
        <span class="${SIDEBAR_MENU_CSS_PREFIX}__item-icon">
          ${item.icon}
        </span>
        <div class="${SIDEBAR_MENU_CSS_PREFIX}__item-content">
          <span class="${SIDEBAR_MENU_CSS_PREFIX}__item-label">${item.label}</span>
        </div>
        ${item.badge !== undefined ? `
          <span class="${SIDEBAR_MENU_CSS_PREFIX}__item-badge" data-badge-id="${item.id}">
            ${item.badge}
          </span>
        ` : ''}
        <span class="${SIDEBAR_MENU_CSS_PREFIX}__tooltip">${item.label}</span>
      </div>
    `;
  }

  private renderFooter(): string {
    const footer = this.config.footer || {};
    const showLogout = footer.showLogout !== false; // default true
    const logoutLabel = footer.logoutLabel || 'Sair';

    if (!footer.items?.length && !footer.showVersion && !showLogout) {
      return '';
    }

    return `
      <div class="${SIDEBAR_MENU_CSS_PREFIX}__footer">
        ${footer.items?.length ? `
          <div class="${SIDEBAR_MENU_CSS_PREFIX}__footer-items">
            ${footer.items.map(item => this.renderFooterItem(item)).join('')}
          </div>
        ` : ''}
        ${showLogout ? `
          <button
            class="${SIDEBAR_MENU_CSS_PREFIX}__logout"
            data-action="logout"
            aria-label="${logoutLabel}"
            title="${logoutLabel}"
          >
            <span class="${SIDEBAR_MENU_CSS_PREFIX}__logout-icon">${SIDEBAR_ICONS.logout}</span>
            <span class="${SIDEBAR_MENU_CSS_PREFIX}__logout-text">${logoutLabel}</span>
          </button>
        ` : ''}
        ${footer.showVersion && footer.version ? `
          <div class="${SIDEBAR_MENU_CSS_PREFIX}__version">
            v${footer.version}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderFooterItem(item: SidebarMenuItem): string {
    const disabledClass = item.disabled ? 'disabled' : '';

    return `
      <div
        class="${SIDEBAR_MENU_CSS_PREFIX}__item ${disabledClass}"
        data-item-id="${item.id}"
        data-section-id="footer"
        data-action="item-click"
        role="menuitem"
        tabindex="${item.disabled ? -1 : 0}"
        ${item.disabled ? 'aria-disabled="true"' : ''}
      >
        <span class="${SIDEBAR_MENU_CSS_PREFIX}__item-icon">
          ${item.icon}
        </span>
        <div class="${SIDEBAR_MENU_CSS_PREFIX}__item-content">
          <span class="${SIDEBAR_MENU_CSS_PREFIX}__item-label">${item.label}</span>
        </div>
        <span class="${SIDEBAR_MENU_CSS_PREFIX}__tooltip">${item.label}</span>
      </div>
    `;
  }

  private createTooltip(): void {
    this.tooltip = document.createElement('div');
    this.tooltip.className = `${SIDEBAR_MENU_CSS_PREFIX}__tooltip-global`;
    this.tooltip.style.cssText = `
      position: fixed;
      padding: 8px 12px;
      background: #1f2937;
      color: #ffffff;
      font-size: 13px;
      font-weight: 500;
      border-radius: 6px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, visibility 0.15s ease;
      z-index: 10000;
      pointer-events: none;
    `;
    document.body.appendChild(this.tooltip);
  }

  private bindEvents(sidebar: HTMLElement): void {
    // Toggle button
    sidebar.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest('[data-action]')?.getAttribute('data-action');

      if (action === 'toggle') {
        this.toggle();
      } else if (action === 'theme-toggle') {
        this.handleThemeToggle();
      } else if (action === 'logout') {
        this.handleLogout();
      } else if (action === 'toggle-section') {
        const sectionEl = target.closest('[data-section-id]');
        if (sectionEl) {
          const sectionId = sectionEl.getAttribute('data-section-id');
          if (sectionId) {
            this.toggleSection(sectionId);
          }
        }
      } else if (action === 'item-click') {
        const itemEl = target.closest('[data-item-id]') as HTMLElement;
        if (itemEl && !itemEl.classList.contains('disabled')) {
          const itemId = itemEl.getAttribute('data-item-id');
          const sectionId = itemEl.getAttribute('data-section-id');
          if (itemId && sectionId) {
            this.handleItemClick(itemId, sectionId);
          }
        }
      }
    });

    // Search input
    const searchInput = sidebar.querySelector('[data-action="search"]') as HTMLInputElement;
    if (searchInput) {
      let debounceTimer: number;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(() => {
          if (this.config.onSearch) {
            this.config.onSearch(searchInput.value);
          }
        }, 300);
      });
    }

    // Keyboard navigation
    sidebar.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement;

      if (e.key === 'Enter' || e.key === ' ') {
        if (target.hasAttribute('data-action')) {
          e.preventDefault();
          target.click();
        }
      } else if (e.key === 'Escape') {
        if (this.state === 'expanded') {
          this.collapse();
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = Array.from(sidebar.querySelectorAll(`[data-action="item-click"]:not(.disabled)`)) as HTMLElement[];
        const currentIndex = items.indexOf(target);

        if (currentIndex !== -1) {
          e.preventDefault();
          const nextIndex = e.key === 'ArrowDown'
            ? (currentIndex + 1) % items.length
            : (currentIndex - 1 + items.length) % items.length;
          items[nextIndex].focus();
        }
      }
    });

    // Tooltip on hover for collapsed state
    sidebar.addEventListener('mouseenter', (e) => {
      if (this.state !== 'collapsed') return;

      const target = e.target as HTMLElement;
      const itemEl = target.closest(`[data-item-id]`) as HTMLElement;

      if (itemEl && this.tooltip) {
        const rect = itemEl.getBoundingClientRect();
        const label = itemEl.querySelector(`.${SIDEBAR_MENU_CSS_PREFIX}__item-label`)?.textContent || '';

        this.tooltip.textContent = label;
        this.tooltip.style.left = `${rect.right + 12}px`;
        this.tooltip.style.top = `${rect.top + rect.height / 2}px`;
        this.tooltip.style.transform = 'translateY(-50%)';
        this.tooltip.style.opacity = '1';
        this.tooltip.style.visibility = 'visible';
      }
    }, true);

    sidebar.addEventListener('mouseleave', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(`[data-item-id]`) && this.tooltip) {
        this.tooltip.style.opacity = '0';
        this.tooltip.style.visibility = 'hidden';
      }
    }, true);
  }

  private handleThemeToggle(): void {
    // Toggle theme
    const newTheme: SidebarThemeMode = this.themeMode === 'dark' ? 'light' : 'dark';
    this.setThemeMode(newTheme);

    // Update button icon
    const themeBtn = this.root.querySelector(`[data-action="theme-toggle"]`);
    if (themeBtn) {
      themeBtn.innerHTML = newTheme === 'dark' ? SIDEBAR_ICONS.moon : SIDEBAR_ICONS.sun;
      themeBtn.setAttribute('title', newTheme === 'dark' ? 'Tema escuro' : 'Tema claro');
    }

    // Callback
    if (this.config.onThemeToggle) {
      this.config.onThemeToggle(newTheme);
    }
  }

  private handleLogout(): void {
    if (this.config.onLogout) {
      this.config.onLogout();
    }
  }

  private handleItemClick(itemId: string, sectionId: string): void {
    // Find the item and section
    let item: SidebarMenuItem | undefined;
    let section: SidebarMenuSection | undefined;

    if (sectionId === 'footer') {
      section = { id: 'footer', items: this.config.footer?.items || [] };
      item = section.items.find(i => i.id === itemId);
    } else {
      section = this.config.sections?.find(s => s.id === sectionId);
      if (section) {
        item = section.items.find(i => i.id === itemId);
      }
    }

    if (item && section && this.config.onItemClick) {
      this.config.onItemClick(item, section);
    }
  }

  private toggleSection(sectionId: string): void {
    const sectionEl = this.root.querySelector(`[data-section-id="${sectionId}"]`);
    if (!sectionEl) return;

    if (this.collapsedSections.has(sectionId)) {
      this.collapsedSections.delete(sectionId);
      sectionEl.classList.remove('collapsed');
    } else {
      this.collapsedSections.add(sectionId);
      sectionEl.classList.add('collapsed');
    }
  }

  // Public methods

  getElement(): HTMLElement {
    return this.root;
  }

  expand(): void {
    if (this.state === 'expanded') return;

    this.state = 'expanded';
    this.root.classList.remove('collapsed');

    // Update toggle button
    const toggleBtn = this.root.querySelector(`[data-action="toggle"]`);
    if (toggleBtn) {
      toggleBtn.innerHTML = SIDEBAR_ICONS.chevronLeft;
      toggleBtn.setAttribute('aria-label', 'Recolher menu');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }

    this.persistState();

    if (this.config.onStateChange) {
      this.config.onStateChange(this.state);
    }
  }

  collapse(): void {
    if (this.state === 'collapsed') return;

    this.state = 'collapsed';
    this.root.classList.add('collapsed');

    // Update toggle button
    const toggleBtn = this.root.querySelector(`[data-action="toggle"]`);
    if (toggleBtn) {
      toggleBtn.innerHTML = SIDEBAR_ICONS.chevronRight;
      toggleBtn.setAttribute('aria-label', 'Expandir menu');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }

    this.persistState();

    if (this.config.onStateChange) {
      this.config.onStateChange(this.state);
    }
  }

  toggle(): void {
    if (this.state === 'expanded') {
      this.collapse();
    } else {
      this.expand();
    }
  }

  getState(): SidebarState {
    return this.state;
  }

  setThemeMode(mode: SidebarThemeMode): void {
    this.themeMode = mode;
    this.root.classList.remove('light', 'dark');
    this.root.classList.add(mode);
  }

  updateSections(sections: SidebarMenuSection[]): void {
    this.config.sections = sections;
    const contentEl = this.root.querySelector(`.${SIDEBAR_MENU_CSS_PREFIX}__content`);
    if (contentEl) {
      contentEl.innerHTML = sections.map(section => this.renderSection(section)).join('');
    }
  }

  updateItemBadge(itemId: string, badge: number | string | null): void {
    const badgeEl = this.root.querySelector(`[data-badge-id="${itemId}"]`);
    const itemEl = this.root.querySelector(`[data-item-id="${itemId}"]`);

    if (badge === null) {
      // Remove badge
      if (badgeEl) {
        badgeEl.remove();
      }
    } else if (badgeEl) {
      // Update existing badge
      badgeEl.textContent = String(badge);
    } else if (itemEl) {
      // Create new badge
      const newBadge = document.createElement('span');
      newBadge.className = `${SIDEBAR_MENU_CSS_PREFIX}__item-badge`;
      newBadge.setAttribute('data-badge-id', itemId);
      newBadge.textContent = String(badge);

      // Insert before tooltip
      const tooltipEl = itemEl.querySelector(`.${SIDEBAR_MENU_CSS_PREFIX}__tooltip`);
      if (tooltipEl) {
        itemEl.insertBefore(newBadge, tooltipEl);
      } else {
        itemEl.appendChild(newBadge);
      }
    }

    // Update config
    for (const section of this.config.sections || []) {
      const item = section.items.find(i => i.id === itemId);
      if (item) {
        if (badge === null) {
          delete item.badge;
        } else {
          item.badge = badge;
        }
        break;
      }
    }
  }

  setActiveItem(itemId: string | null): void {
    // Remove previous active
    const prevActive = this.root.querySelector(`.${SIDEBAR_MENU_CSS_PREFIX}__item.active`);
    if (prevActive) {
      prevActive.classList.remove('active');
      prevActive.setAttribute('aria-current', 'false');
    }

    this.activeItemId = itemId;

    if (itemId) {
      const newActive = this.root.querySelector(`[data-item-id="${itemId}"]`);
      if (newActive) {
        newActive.classList.add('active');
        newActive.setAttribute('aria-current', 'page');
      }
    }
  }

  getActiveItem(): string | null {
    return this.activeItemId;
  }

  updateUserInfo(userInfo: SidebarUserInfo): void {
    // Update config
    if (!this.config.header) {
      this.config.header = {};
    }
    this.config.header.userInfo = userInfo;

    // Update DOM
    const userInfoEl = this.root.querySelector(`.${SIDEBAR_MENU_CSS_PREFIX}__user-info`);
    if (userInfoEl) {
      const nameEl = userInfoEl.querySelector(`.${SIDEBAR_MENU_CSS_PREFIX}__user-name`);
      const emailEl = userInfoEl.querySelector(`.${SIDEBAR_MENU_CSS_PREFIX}__user-email`);
      if (nameEl) nameEl.textContent = userInfo.name || '';
      if (emailEl) emailEl.textContent = userInfo.email || '';
    } else if (userInfo.name || userInfo.email) {
      // Create user info element if it doesn't exist
      const headerEl = this.root.querySelector(`.${SIDEBAR_MENU_CSS_PREFIX}__header`);
      if (headerEl) {
        const newUserInfo = document.createElement('div');
        newUserInfo.className = `${SIDEBAR_MENU_CSS_PREFIX}__user-info`;
        newUserInfo.innerHTML = `
          <span class="${SIDEBAR_MENU_CSS_PREFIX}__user-name">${userInfo.name || ''}</span>
          <span class="${SIDEBAR_MENU_CSS_PREFIX}__user-email">${userInfo.email || ''}</span>
        `;
        headerEl.appendChild(newUserInfo);
      }
    }
  }

  getThemeMode(): SidebarThemeMode {
    return this.themeMode;
  }

  private persistState(): void {
    if (this.config.persistState && this.config.storageKey) {
      localStorage.setItem(this.config.storageKey, this.state);
    }
  }

  destroy(): void {
    // Remove tooltip from body
    if (this.tooltip && this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }

    // Remove sidebar from DOM
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}
