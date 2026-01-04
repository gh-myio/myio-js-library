/**
 * RFC-0114: Menu Component Library
 * View layer for the Menu Component
 */

import {
  MenuComponentParams,
  MenuConfigTemplate,
  MenuThemeConfig,
  MenuThemeMode,
  MenuEventType,
  MenuEventHandler,
  TabConfig,
  ContextOption,
  Shopping,
  DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_LIGHT_THEME,
  DEFAULT_DARK_THEME,
  DEFAULT_TABS,
} from './types';

/**
 * Menu View - Handles rendering and DOM interactions
 */
export class MenuView {
  private container: HTMLElement;
  private root: HTMLElement;
  private configTemplate: MenuConfigTemplate;
  private themeConfig: Required<MenuThemeConfig>;
  private tabs: TabConfig[];
  private eventHandlers: Map<MenuEventType, MenuEventHandler[]> = new Map();
  private styleElement: HTMLStyleElement | null = null;
  private themeMode: MenuThemeMode = 'light';

  // State
  private activeTabId: string;
  private contextsByTab: Map<string, string> = new Map();
  private pendingTabId: string | null = null; // Tab being previewed in modal

  constructor(private params: MenuComponentParams) {
    this.container = params.container;
    this.configTemplate = { ...DEFAULT_CONFIG_TEMPLATE, ...params.configTemplate };
    this.themeMode = 'light'; // Default, can be changed via setThemeMode
    this.themeConfig = this.getThemeConfig();
    this.tabs = params.tabs ?? DEFAULT_TABS;
    this.activeTabId = params.initialTab ?? this.tabs[0]?.id ?? 'energy';

    // Initialize contexts with defaults
    this.tabs.forEach(tab => {
      this.contextsByTab.set(tab.id, tab.defaultContext ?? tab.contexts[0]?.id ?? '');
    });

    this.root = document.createElement('div');
    this.root.className = `myio-menu-root myio-menu-theme-${this.themeMode}`;

    if (this.configTemplate.enableDebugMode) {
      console.log('[MenuView] ConfigTemplate:', this.configTemplate);
      console.log('[MenuView] ThemeConfig:', this.themeConfig);
      console.log('[MenuView] Tabs:', this.tabs);
      console.log('[MenuView] Theme:', this.themeMode);
    }
  }

  /**
   * Get the theme config based on current theme mode
   */
  private getThemeConfig(): Required<MenuThemeConfig> {
    const defaults = this.themeMode === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
    const userTheme = this.themeMode === 'dark'
      ? this.configTemplate.darkMode
      : this.configTemplate.lightMode;

    return {
      ...defaults,
      ...userTheme,
    } as Required<MenuThemeConfig>;
  }

  /**
   * Render the complete menu view
   */
  public render(): HTMLElement {
    this.injectStyles();
    this.root.innerHTML = this.buildHTML();
    this.bindEvents();
    this.applyDynamicStyles();
    return this.root;
  }

  /**
   * Register event handlers
   */
  public on(event: MenuEventType, handler: MenuEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Emit an event to all registered handlers
   */
  public emit(event: MenuEventType, data?: unknown): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    const styleId = 'myio-menu-component-styles';
    if (document.getElementById(styleId)) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = styleId;
    this.styleElement.textContent = this.getStyles();
    document.head.appendChild(this.styleElement);
  }

  /**
   * Get CSS styles for the menu
   */
  private getStyles(): string {
    return `
/* ==========================================
   MYIO Menu Component - RFC-0114
   Background is TRANSPARENT - colors for cards/buttons/fonts only
   ========================================== */

.myio-menu-root {
  font-family: 'Inter', 'Roboto', 'Segoe UI', sans-serif;
  width: 100%;
}

/* Toolbar Root - TRANSPARENT background */
.myio-toolbar-root {
  background: transparent;
  border-radius: 12px;
  padding: 8px;
}

/* Tabs Row - Flexbox with even distribution */
.myio-tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

/* Menu Blocks - compact, no extra space */
.myio-menu-block {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* Block 2 (actions) */
.myio-menu-actions {
  gap: 6px;
}

/* Block 3 (extras) */
.myio-menu-extras {
  gap: 6px;
}

/* Subtle Divider */
.myio-menu-divider {
  width: 1px;
  height: 28px;
  background: var(--menu-tab-border, rgba(128, 128, 128, 0.3));
  flex-shrink: 0;
}

/* Tabs Navigation */
.myio-tabs {
  display: flex;
  gap: 4px;
}

/* Tab Button */
.myio-menu-root .tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: var(--menu-tab-inactive-bg);
  color: var(--menu-tab-inactive-color);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.myio-menu-root .tab:hover {
  background: var(--menu-filter-hover);
  border-color: var(--menu-filter-border);
}

.myio-menu-root .tab.is-active {
  background: var(--menu-tab-active-bg);
  color: var(--menu-tab-active-color);
  border-color: var(--menu-tab-active-bg);
}

.myio-menu-root .tab .ico {
  font-size: 16px;
}

.myio-menu-root .tab .dropdown-arrow {
  font-size: 10px;
  margin-left: 4px;
  opacity: 0.7;
}

/* Filter Button */
.myio-menu-root .myio-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: var(--menu-btn-filter-bg);
  color: var(--menu-btn-filter-color);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.myio-menu-root .myio-filter-btn:hover {
  background: var(--menu-filter-hover);
  border-color: var(--menu-filter-border);
}

/* Date Picker Container */
.myio-menu-root .tab.date-picker-tab {
  min-width: 280px;
  background: var(--menu-datepicker-bg);
  color: var(--menu-datepicker-color);
}

.myio-menu-root .tab.date-picker-tab input {
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 14px;
  text-align: center;
  cursor: pointer;
  outline: none;
}

/* Action Buttons */
.myio-menu-root .tab.btn-load {
  background: var(--menu-btn-load-bg);
  color: var(--menu-btn-load-color);
  border-color: var(--menu-btn-load-bg);
}

.myio-menu-root .tab.btn-load:hover {
  opacity: 0.9;
}

.myio-menu-root .tab.btn-clear {
  background: var(--menu-btn-clear-bg);
  color: var(--menu-btn-clear-color);
}

.myio-menu-root .tab.btn-clear:hover {
  background: var(--menu-filter-hover);
}

.myio-menu-root .tab.btn-goals {
  background: var(--menu-btn-goals-bg);
  color: var(--menu-btn-goals-color);
  border-color: var(--menu-btn-goals-bg);
}

.myio-menu-root .tab.btn-goals:hover {
  opacity: 0.9;
}

/* Theme Toggle Button */
.myio-menu-root .tab.btn-theme-toggle {
  background: var(--menu-tab-inactive-bg);
  color: var(--menu-tab-inactive-color);
  border-color: var(--menu-filter-border);
  padding: 10px 12px;
  min-width: 44px;
}

.myio-menu-root .tab.btn-theme-toggle:hover {
  background: var(--menu-filter-hover);
}

.myio-menu-root .tab.btn-theme-toggle .theme-icon {
  font-size: 18px;
  line-height: 1;
}

/* Material Icons in buttons */
.myio-menu-root .tab i.material-icons {
  font-size: 18px;
}

/* ==========================================
   Context Modal (Dropdown)
   ========================================== */

.myio-menu-context-modal {
  position: fixed;
  inset: 0;
  display: none;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.myio-menu-context-modal.is-open {
  display: flex;
}

.myio-menu-context-modal-content {
  background: var(--menu-modal-bg);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  width: 320px;
  max-width: 90vw;
  overflow: hidden;
}

.myio-menu-context-modal-header {
  padding: 16px 20px;
  background: var(--menu-modal-header-bg);
  border-bottom: 1px solid var(--menu-modal-border);
  font-weight: 700;
  color: var(--menu-modal-text);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
}

.myio-menu-context-modal-header.energy {
  background: var(--menu-modal-header-bg);
  border-bottom-color: var(--menu-modal-border);
  color: var(--menu-modal-text);
}

.myio-menu-context-modal-header.water {
  background: var(--menu-modal-header-bg);
  border-bottom-color: var(--menu-modal-border);
  color: var(--menu-modal-text);
}

.myio-menu-context-modal-header.temperature {
  background: var(--menu-modal-header-bg);
  border-bottom-color: var(--menu-modal-border);
  color: var(--menu-modal-text);
}

.myio-menu-context-modal-options {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--menu-modal-bg);
}

.myio-menu-context-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}

.myio-menu-context-option:hover {
  background: var(--menu-option-hover-bg);
  border-color: var(--menu-modal-border);
}

.myio-menu-context-option.is-active {
  background: var(--menu-option-active-bg);
  border-color: var(--menu-option-active-border);
  color: var(--menu-option-active-color);
}

/* Domain-specific active states */
.myio-menu-context-option.water.is-active {
  background: var(--menu-option-active-bg);
  border-color: var(--menu-option-active-border);
  color: var(--menu-option-active-color);
}

.myio-menu-context-option.temperature.is-active {
  background: var(--menu-option-active-bg);
  border-color: var(--menu-option-active-border);
  color: var(--menu-option-active-color);
}

.myio-menu-context-option .option-ico {
  font-size: 20px;
}

.myio-menu-context-option .option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.myio-menu-context-option .option-title {
  font-weight: 600;
  font-size: 14px;
  line-height: 1.2;
}

.myio-menu-context-option .option-desc {
  font-size: 12px;
  color: var(--menu-modal-desc);
  margin-top: 2px;
  font-weight: 400;
}

.myio-menu-context-option .option-check {
  font-weight: bold;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s;
  color: var(--menu-option-active-border);
}

.myio-menu-context-option.is-active .option-check {
  opacity: 1;
  transform: scale(1);
}

.myio-menu-context-option.water .option-check {
  color: var(--menu-option-active-border);
}

.myio-menu-context-option.temperature .option-check {
  color: var(--menu-option-active-border);
}

/* ==========================================
   Filter Modal
   ========================================== */

.myio-menu-filter-modal {
  position: fixed;
  inset: 0;
  display: none;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.myio-menu-filter-modal.is-open {
  display: flex;
}

.myio-menu-filter-modal-card {
  background: var(--menu-filter-bg);
  border-radius: 12px;
  max-width: 600px;
  width: 92%;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
}

.myio-menu-filter-modal-header,
.myio-menu-filter-modal-footer {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--menu-filter-bg);
}

.myio-menu-filter-modal-header {
  border-bottom: 1px solid var(--menu-filter-border);
}

.myio-menu-filter-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--menu-filter-text);
}

.myio-menu-filter-modal-footer {
  border-top: 1px solid var(--menu-filter-border);
  gap: 8px;
  color: var(--menu-modal-desc);
}

.myio-menu-filter-modal-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  background: var(--menu-filter-bg);
}

.myio-menu-filter-close-btn {
  cursor: pointer;
  border: 0;
  background: transparent;
  font-size: 24px;
  line-height: 1;
  color: var(--menu-modal-desc);
  padding: 4px;
}

.myio-menu-filter-close-btn:hover {
  color: var(--menu-filter-text);
}

/* Filter Search */
.myio-menu-filter-search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 2px solid var(--menu-filter-border);
  border-radius: 12px;
  padding: 6px 10px;
  background: var(--menu-filter-bg);
}

.myio-menu-filter-search:focus-within {
  border-color: #4F93CE;
  box-shadow: 0 0 0 3px rgba(79, 147, 206, 0.15);
}

.myio-menu-filter-search input {
  width: 100%;
  border: 0;
  outline: 0;
  font-size: 15px;
  padding-left: 28px;
  font-family: inherit;
  background: transparent;
  color: var(--menu-filter-text);
}

.myio-menu-filter-search .search-ico {
  position: absolute;
  left: 10px;
}

/* Filter Row */
.myio-menu-filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.myio-menu-filter-clear-btn {
  border: 0;
  background: transparent;
  font-weight: 600;
  cursor: pointer;
  color: var(--menu-filter-text);
  padding: 8px 12px;
}

.myio-menu-filter-clear-btn:hover {
  background: var(--menu-filter-hover);
  border-radius: 6px;
}

.myio-menu-filter-badge {
  border: 1px solid var(--menu-filter-border);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--menu-filter-text);
  background: var(--menu-filter-bg);
}

/* Filter Chips */
.myio-menu-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.myio-menu-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--menu-chip-border);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  background: var(--menu-chip-bg);
  color: var(--menu-chip-text);
}

.myio-menu-filter-chip .chip-remove {
  cursor: pointer;
  border: 0;
  background: transparent;
  opacity: 0.7;
  font-size: 14px;
  padding: 0;
  line-height: 1;
  color: var(--menu-chip-text);
}

.myio-menu-filter-chip .chip-remove:hover {
  opacity: 1;
}

/* Filter List */
.myio-menu-filter-list {
  flex: 1 1 auto;
  overflow-y: auto;
  max-height: 46vh;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.myio-menu-filter-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--menu-filter-border);
  border-radius: 8px;
  padding: 8px 12px;
  background: var(--menu-filter-bg);
  font-weight: 500;
  color: var(--menu-filter-text);
  cursor: pointer;
  transition: background 0.2s;
  width: 100%;
  text-align: left;
  font-family: inherit;
  font-size: 14px;
}

.myio-menu-filter-item:hover {
  background: var(--menu-filter-hover);
}

.myio-menu-filter-item .checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid var(--menu-filter-text);
  border-radius: 4px;
  flex-shrink: 0;
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: white;
}

.myio-menu-filter-item.selected {
  background: var(--menu-filter-selected-bg);
  border-color: var(--menu-filter-selected-border);
}

.myio-menu-filter-item.selected .checkbox {
  background-color: var(--menu-filter-selected-border);
  border-color: var(--menu-filter-selected-border);
}

/* Filter Footer Buttons */
.myio-menu-filter-cancel-btn {
  border: 0;
  background: transparent;
  font-weight: 600;
  cursor: pointer;
  color: var(--menu-filter-text);
  padding: 10px 16px;
}

.myio-menu-filter-apply-btn {
  border: 0;
  background: var(--menu-btn-load-bg);
  color: var(--menu-btn-load-color);
  font-weight: 700;
  padding: 10px 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.myio-menu-filter-apply-btn:hover {
  opacity: 0.9;
}

.myio-menu-filter-apply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Empty state */
.myio-menu-filter-empty {
  text-align: center;
  padding: 30px;
  color: var(--menu-modal-desc);
}

.myio-menu-filter-reload-btn {
  background: var(--menu-btn-load-bg);
  color: var(--menu-btn-load-color);
  border: 0;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: inherit;
}

.myio-menu-filter-reload-btn:hover {
  opacity: 0.9;
}

/* ==========================================
   Responsive
   ========================================== */

@media (max-width: 768px) {
  .myio-tabs-row {
    flex-direction: column;
    align-items: stretch;
  }

  .myio-tabs {
    flex-wrap: wrap;
    justify-content: center;
  }

  .myio-menu-root .tab {
    flex: 1 1 auto;
    justify-content: center;
  }

  .myio-menu-root .tab.date-picker-tab {
    min-width: 100%;
  }
}

@media (max-width: 480px) {
  .myio-menu-root .tab {
    padding: 8px 12px;
    font-size: 13px;
  }

  .myio-menu-context-modal-content {
    width: 95vw;
    max-width: none;
  }

  .myio-menu-filter-modal-card {
    width: 95vw;
    max-height: 90vh;
  }
}

/* ==========================================
   RESPONSIVE: Hamburger Menu for Mobile
   ========================================== */

/* Hamburger Button - Hidden on desktop */
.myio-menu-hamburger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--menu-tab-border, #e0e0e0);
  border-radius: 8px;
  background: var(--menu-tab-inactive-bg, #fff);
  color: var(--menu-tab-inactive-color, #1C2743);
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.myio-menu-hamburger:hover {
  background: var(--menu-filter-hover, #f1f5f9);
}

/* Mobile Overlay */
.myio-menu-mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 9998;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.myio-menu-mobile-overlay.is-open {
  opacity: 1;
}

/* Mobile Drawer */
.myio-menu-mobile-drawer {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 85%;
  max-width: 320px;
  height: 100vh;
  background: var(--menu-modal-bg, #fff);
  z-index: 9999;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  overflow-y: auto;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
}

.myio-menu-mobile-drawer.is-open {
  transform: translateX(0);
}

/* Mobile Drawer Header */
.myio-menu-mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--menu-tab-border, #e0e0e0);
  background: var(--menu-modal-header-bg, #f8fafc);
}

.myio-menu-mobile-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--menu-modal-text, #1e293b);
}

.myio-menu-mobile-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--menu-modal-desc, #64748b);
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.myio-menu-mobile-close:hover {
  background: var(--menu-filter-hover, #f1f5f9);
  color: var(--menu-modal-text, #1e293b);
}

/* Mobile Drawer Content */
.myio-menu-mobile-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Mobile Section */
.myio-menu-mobile-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.myio-menu-mobile-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--menu-modal-desc, #64748b);
  padding: 0 4px;
}

.myio-menu-mobile-section .tab {
  width: 100%;
  justify-content: flex-start;
}

/* Mobile Date Picker */
.myio-menu-mobile-section .tab.date-picker-tab {
  min-width: unset;
  width: 100%;
}

.myio-menu-mobile-section .tab.date-picker-tab input {
  text-align: left;
}

/* Responsive Breakpoint: Show hamburger, hide desktop menu */
@media (max-width: 900px) {
  /* Show hamburger button */
  .myio-menu-hamburger {
    display: flex;
  }

  /* Show mobile overlay and drawer (controlled by JS) */
  .myio-menu-mobile-overlay,
  .myio-menu-mobile-drawer {
    display: block;
  }

  /* Hide desktop menu items */
  .myio-menu-root .myio-tabs-row > .myio-menu-block,
  .myio-menu-root .myio-tabs-row > .myio-menu-divider {
    display: none;
  }

  /* Keep tabs row but just for hamburger */
  .myio-tabs-row {
    justify-content: flex-start;
  }
}
`;
  }

  /**
   * Build the HTML structure
   * Layout: [Tabs] | [Filter, Calendar, Load, Clear] | [Goals, Theme]
   */
  private buildHTML(): string {
    const showGoals = this.params.showGoalsButton !== false;
    const showFilter = this.params.showFilterButton !== false;
    const showLoad = this.params.showLoadButton !== false;
    const showClear = this.params.showClearButton !== false;

    return `
      <section class="myio-toolbar-root">
        <div class="myio-tabs-row">
          <!-- Hamburger Button (visible on mobile only) -->
          <button class="myio-menu-hamburger" aria-label="Abrir menu" aria-expanded="false">
            ☰
          </button>

          <!-- Block 1: Domain Tabs (Energy, Water, Temperature) -->
          <nav class="myio-tabs myio-menu-block" role="tablist" aria-label="Secoes">
            ${this.tabs.map(tab => this.buildTabHTML(tab)).join('')}
          </nav>

          <!-- Divider 1 (centered in its grid cell) -->
          <span class="myio-menu-divider"></span>

          <!-- Block 2: Filter, Calendar, Load, Clear -->
          <div class="myio-menu-block myio-menu-actions">
            ${showFilter ? this.buildFilterButtonHTML() : ''}
            ${this.buildDatePickerHTML()}
            ${showLoad ? this.buildLoadButtonHTML() : ''}
            ${showClear ? this.buildClearButtonHTML() : ''}
          </div>

          <!-- Divider 2 (centered in its grid cell) -->
          <span class="myio-menu-divider"></span>

          <!-- Block 3: Goals and Theme -->
          <div class="myio-menu-block myio-menu-extras">
            ${showGoals ? this.buildGoalsButtonHTML() : ''}
            ${this.buildThemeToggleHTML()}
          </div>
        </div>

        ${this.tabs.map(tab => this.buildContextModalHTML(tab)).join('')}
      </section>

      <!-- Mobile Menu Overlay -->
      <div class="myio-menu-mobile-overlay" aria-hidden="true"></div>

      <!-- Mobile Menu Drawer -->
      <nav class="myio-menu-mobile-drawer" aria-label="Menu mobile" aria-hidden="true">
        <div class="myio-menu-mobile-header">
          <h3>Menu</h3>
          <button class="myio-menu-mobile-close" aria-label="Fechar menu">×</button>
        </div>
        <div class="myio-menu-mobile-content">
          <!-- Section: Navegacao -->
          <div class="myio-menu-mobile-section">
            <span class="myio-menu-mobile-section-title">Navegação</span>
            ${this.tabs.map(tab => this.buildMobileTabHTML(tab)).join('')}
          </div>

          <!-- Section: Filtros -->
          <div class="myio-menu-mobile-section">
            <span class="myio-menu-mobile-section-title">Filtros e Período</span>
            ${showFilter ? this.buildFilterButtonHTML() : ''}
            ${this.buildMobileDatePickerHTML()}
          </div>

          <!-- Section: Acoes -->
          <div class="myio-menu-mobile-section">
            <span class="myio-menu-mobile-section-title">Ações</span>
            ${showLoad ? this.buildLoadButtonHTML() : ''}
            ${showClear ? this.buildClearButtonHTML() : ''}
          </div>

          <!-- Section: Extras -->
          <div class="myio-menu-mobile-section">
            <span class="myio-menu-mobile-section-title">Configurações</span>
            ${showGoals ? this.buildGoalsButtonHTML() : ''}
            ${this.buildThemeToggleHTML()}
          </div>
        </div>
      </nav>

      ${this.buildFilterModalHTML()}
    `;
  }

  /**
   * Build a single tab button HTML
   * Only active tab shows context detail, others show only domain label
   */
  private buildTabHTML(tab: TabConfig): string {
    const isActive = tab.id === this.activeTabId;
    const label = this.getTabLabel(tab.id, isActive);

    return `
      <button
        id="menuTab_${tab.id}"
        class="tab ${isActive ? 'is-active' : ''}"
        data-tab-id="${tab.id}"
        role="tab"
        aria-selected="${isActive}"
        aria-controls="menuContextModal_${tab.id}"
      >
        <span class="ico">${tab.icon}</span>
        <span class="tab-label">${label}</span>
        ${isActive ? '<span class="dropdown-arrow">▼</span>' : ''}
      </button>
    `;
  }

  /**
   * Get tab label based on active state
   * Active tab: "Domain: Context" (e.g., "Energia: Equipamentos")
   * Inactive tab: "Domain" only (e.g., "Agua")
   */
  private getTabLabel(tabId: string, isActive: boolean): string {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return '';

    if (isActive) {
      const currentContextId = this.contextsByTab.get(tabId) ?? tab.defaultContext ?? tab.contexts[0]?.id;
      const currentContext = tab.contexts.find(c => c.id === currentContextId);
      return currentContext ? `${tab.label}: ${currentContext.title}` : tab.label;
    }

    return tab.label;
  }

  /**
   * Update all tab labels based on current active tab
   */
  private updateAllTabLabels(): void {
    this.tabs.forEach(tab => {
      const isActive = tab.id === this.activeTabId;
      const tabEl = this.root.querySelector(`#menuTab_${tab.id}`);
      if (!tabEl) return;

      // Update label
      const labelEl = tabEl.querySelector('.tab-label');
      if (labelEl) {
        labelEl.textContent = this.getTabLabel(tab.id, isActive);
      }

      // Show/hide dropdown arrow (only on active tab)
      const arrowEl = tabEl.querySelector('.dropdown-arrow');
      if (isActive && !arrowEl) {
        // Add arrow if missing
        const arrow = document.createElement('span');
        arrow.className = 'dropdown-arrow';
        arrow.textContent = '▼';
        tabEl.appendChild(arrow);
      } else if (!isActive && arrowEl) {
        // Remove arrow if present
        arrowEl.remove();
      }
    });
  }

  /**
   * Build context modal HTML for a tab
   */
  private buildContextModalHTML(tab: TabConfig): string {
    const currentContextId = this.contextsByTab.get(tab.id) ?? tab.defaultContext ?? tab.contexts[0]?.id;

    return `
      <div
        id="menuContextModal_${tab.id}"
        class="myio-menu-context-modal"
        data-tab-id="${tab.id}"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menuContextModalTitle_${tab.id}"
      >
        <div class="myio-menu-context-modal-content">
          <div class="myio-menu-context-modal-header ${tab.id}">
            <span class="ico">${tab.icon}</span>
            <span id="menuContextModalTitle_${tab.id}">Selecione o contexto de ${tab.label}</span>
          </div>
          <div class="myio-menu-context-modal-options">
            ${tab.contexts.map(ctx => this.buildContextOptionHTML(tab, ctx, ctx.id === currentContextId)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Build a single context option HTML
   */
  private buildContextOptionHTML(tab: TabConfig, ctx: ContextOption, isActive: boolean): string {
    return `
      <button
        class="myio-menu-context-option ${tab.id} ${isActive ? 'is-active' : ''}"
        data-tab-id="${tab.id}"
        data-context-id="${ctx.id}"
        data-target="${ctx.target}"
      >
        <span class="option-ico">${ctx.icon}</span>
        <div class="option-info">
          <div class="option-title">${ctx.title}</div>
          <div class="option-desc">${ctx.description}</div>
        </div>
        <span class="option-check">✓</span>
      </button>
    `;
  }

  /**
   * Build Goals button HTML
   */
  private buildGoalsButtonHTML(): string {
    return `
      <button id="menuGoalsBtn" class="tab btn-goals" title="Configurar metas de consumo">
        <i class="material-icons">flag</i>
        Metas
      </button>
    `;
  }

  /**
   * Build Filter button HTML
   */
  private buildFilterButtonHTML(): string {
    return `
      <button id="menuFilterBtn" class="myio-filter-btn" type="button" title="Filtro de Shoppings">
        <span class="ico">⎇</span> Filtro
      </button>
    `;
  }

  /**
   * Build Date Picker HTML
   */
  private buildDatePickerHTML(): string {
    return `
      <button class="tab date-picker-tab">
        <span class="ico">📅</span>
        <input
          id="menuDateInput"
          type="text"
          name="menuDateRange"
          placeholder="Selecione o periodo"
          readonly
          title="Clique para alterar o intervalo de datas"
        />
      </button>
    `;
  }

  /**
   * Build Mobile Tab HTML (for mobile drawer)
   */
  private buildMobileTabHTML(tab: TabConfig): string {
    const isActive = tab.id === this.activeTabId;
    const currentContextId = this.contextsByTab.get(tab.id) ?? tab.defaultContext ?? tab.contexts[0]?.id;
    const currentContext = tab.contexts.find(c => c.id === currentContextId);
    const contextTitle = currentContext ? currentContext.title : '';

    return `
      <button
        class="tab ${isActive ? 'is-active' : ''}"
        data-tab-id="${tab.id}"
        data-mobile-tab="true"
      >
        <span class="ico">${tab.icon}</span>
        <span class="tab-label">${tab.label}${contextTitle ? `: ${contextTitle}` : ''}</span>
        <span class="dropdown-arrow">▼</span>
      </button>
    `;
  }

  /**
   * Build Mobile Date Picker HTML (for mobile drawer)
   */
  private buildMobileDatePickerHTML(): string {
    return `
      <button class="tab date-picker-tab" data-mobile-date="true">
        <span class="ico">📅</span>
        <input
          id="menuMobileDateInput"
          type="text"
          name="menuMobileDateRange"
          placeholder="Selecione o periodo"
          readonly
          title="Clique para alterar o intervalo de datas"
        />
      </button>
    `;
  }

  /**
   * Build Load button HTML
   */
  private buildLoadButtonHTML(): string {
    return `
      <button id="menuLoadBtn" class="tab btn-load" title="Carregar dados">
        <i class="material-icons">refresh</i>
        Carregar
      </button>
    `;
  }

  /**
   * Build Clear button HTML
   */
  private buildClearButtonHTML(): string {
    return `
      <button id="menuClearBtn" class="tab btn-clear" title="Limpar cache e recarregar">
        <i class="material-icons">delete_sweep</i>
        Limpar
      </button>
    `;
  }

  /**
   * Build Theme Toggle button HTML
   */
  private buildThemeToggleHTML(): string {
    const isDark = this.themeMode === 'dark';
    return `
      <button id="menuThemeToggleBtn" class="tab btn-theme-toggle ${isDark ? 'is-dark' : ''}" title="Alternar tema claro/escuro">
        <span class="theme-icon">${isDark ? '🌙' : '☀️'}</span>
      </button>
    `;
  }

  /**
   * Build Filter Modal HTML
   */
  private buildFilterModalHTML(): string {
    return `
      <div id="menuFilterModal" class="myio-menu-filter-modal" role="dialog" aria-modal="true" aria-labelledby="menuFilterTitle">
        <div class="myio-menu-filter-modal-card">
          <header class="myio-menu-filter-modal-header">
            <h3 id="menuFilterTitle">Filtro de Shoppings</h3>
            <button class="myio-menu-filter-close-btn" data-close="true" aria-label="Fechar">×</button>
          </header>

          <div class="myio-menu-filter-modal-body">
            <div class="myio-menu-filter-row">
              <div class="myio-menu-filter-search">
                <span class="search-ico">🔎</span>
                <input id="menuFilterSearch" type="text" placeholder="Buscar shopping..." autocomplete="off">
              </div>
              <button class="myio-menu-filter-clear-btn" id="menuFilterClearBtn" title="Limpar selecao">Limpar</button>
              <span id="menuFilterCount" class="myio-menu-filter-badge">0 selecionados</span>
            </div>

            <div id="menuFilterChips" class="myio-menu-filter-chips"></div>

            <div class="myio-menu-filter-content">
              <div class="myio-menu-filter-list" id="menuFilterList" role="listbox" aria-label="Lista de shoppings"></div>
            </div>
          </div>

          <footer class="myio-menu-filter-modal-footer">
            <div style="flex:1; color:#6b7280; font-size:12px;">
              Selecione os shoppings para aplicar o filtro.
            </div>
            <button class="myio-menu-filter-cancel-btn" data-close="true">Cancelar</button>
            <button class="myio-menu-filter-apply-btn" id="menuFilterApplyBtn">Aplicar filtro</button>
          </footer>
        </div>
      </div>
    `;
  }

  /**
   * Bind event listeners
   */
  private bindEvents(): void {
    // Tab clicks
    this.root.querySelectorAll('.tab[data-tab-id]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tabId = (tab as HTMLElement).dataset.tabId!;
        this.handleTabClick(tabId);
      });
    });

    // Context modal backdrop clicks
    this.root.querySelectorAll('.myio-menu-context-modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeAllContextModals();
        }
      });
    });

    // Context option clicks
    this.root.querySelectorAll('.myio-menu-context-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const el = option as HTMLElement;
        const tabId = el.dataset.tabId!;
        const contextId = el.dataset.contextId!;
        const target = el.dataset.target!;
        this.handleContextSelect(tabId, contextId, target);
      });
    });

    // Goals button
    const goalsBtn = this.root.querySelector('#menuGoalsBtn');
    if (goalsBtn) {
      goalsBtn.addEventListener('click', () => this.emit('goals'));
    }

    // Filter button
    const filterBtn = this.root.querySelector('#menuFilterBtn');
    if (filterBtn) {
      filterBtn.addEventListener('click', () => this.openFilterModal());
    }

    // Load button
    const loadBtn = this.root.querySelector('#menuLoadBtn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => this.emit('load'));
    }

    // Clear button
    const clearBtn = this.root.querySelector('#menuClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.emit('clear'));
    }

    // Theme toggle button
    const themeToggleBtn = this.root.querySelector('#menuThemeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const newMode = this.themeMode === 'light' ? 'dark' : 'light';
        this.setThemeMode(newMode);
      });
    }

    // Filter modal close buttons
    this.root.querySelectorAll('#menuFilterModal [data-close]').forEach(btn => {
      btn.addEventListener('click', () => this.closeFilterModal());
    });

    // Filter modal backdrop click
    const filterModal = this.root.querySelector('#menuFilterModal');
    if (filterModal) {
      filterModal.addEventListener('click', (e) => {
        if (e.target === filterModal) {
          this.closeFilterModal();
        }
      });
    }

    // Filter apply button
    const applyBtn = this.root.querySelector('#menuFilterApplyBtn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.handleFilterApply());
    }

    // Filter clear button
    const clearFilterBtn = this.root.querySelector('#menuFilterClearBtn');
    if (clearFilterBtn) {
      clearFilterBtn.addEventListener('click', () => this.handleFilterClear());
    }

    // Filter search input
    const searchInput = this.root.querySelector('#menuFilterSearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderFilterList());
    }

    // ==========================================
    // Mobile Menu Handling
    // ==========================================

    // Hamburger button - open mobile menu
    const hamburgerBtn = this.root.querySelector('.myio-menu-hamburger') as HTMLElement;
    if (this.configTemplate.enableDebugMode) {
      console.log('[MenuView] Hamburger button found:', !!hamburgerBtn);
      if (hamburgerBtn) {
        const computedStyle = window.getComputedStyle(hamburgerBtn);
        console.log('[MenuView] Hamburger display:', computedStyle.display);
        console.log('[MenuView] Hamburger visible:', computedStyle.display !== 'none');
      }
    }
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.configTemplate.enableDebugMode) {
          console.log('[MenuView] Hamburger clicked!');
        }
        this.openMobileMenu();
      });
    }

    // Mobile close button
    const mobileCloseBtn = this.root.querySelector('.myio-menu-mobile-close');
    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener('click', () => this.closeMobileMenu());
    }

    // Mobile overlay - close on click
    const mobileOverlay = this.root.querySelector('.myio-menu-mobile-overlay');
    if (mobileOverlay) {
      mobileOverlay.addEventListener('click', () => this.closeMobileMenu());
    }

    // Mobile tabs - trigger context modal
    this.root.querySelectorAll('.myio-menu-mobile-drawer .tab[data-tab-id]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tabId = (tab as HTMLElement).dataset.tabId!;
        this.closeMobileMenu();
        // Small delay to let mobile menu close animation complete
        setTimeout(() => this.handleTabClick(tabId), 150);
      });
    });

    // Sync mobile date picker with desktop date picker
    const mobileDateInput = this.root.querySelector('#menuMobileDateInput') as HTMLInputElement;
    const desktopDateInput = this.root.querySelector('#menuDateInput') as HTMLInputElement;
    if (mobileDateInput && desktopDateInput) {
      // Keep them in sync
      const syncDates = () => {
        mobileDateInput.value = desktopDateInput.value;
      };
      // Initial sync
      syncDates();
      // Observe changes (using MutationObserver for value changes)
      const observer = new MutationObserver(syncDates);
      observer.observe(desktopDateInput, { attributes: true, attributeFilter: ['value'] });
      // Also sync on input event
      desktopDateInput.addEventListener('change', syncDates);
    }
  }

  /**
   * Open mobile menu drawer
   */
  private openMobileMenu(): void {
    const overlay = this.root.querySelector('.myio-menu-mobile-overlay') as HTMLElement;
    const drawer = this.root.querySelector('.myio-menu-mobile-drawer') as HTMLElement;
    const hamburger = this.root.querySelector('.myio-menu-hamburger');

    if (this.configTemplate.enableDebugMode) {
      console.log('[MenuView] openMobileMenu called');
      console.log('[MenuView] Overlay found:', !!overlay);
      console.log('[MenuView] Drawer found:', !!drawer);
      if (overlay) {
        const overlayStyle = window.getComputedStyle(overlay);
        console.log('[MenuView] Overlay display:', overlayStyle.display);
      }
      if (drawer) {
        const drawerStyle = window.getComputedStyle(drawer);
        console.log('[MenuView] Drawer display:', drawerStyle.display);
      }
    }

    if (overlay && drawer) {
      overlay.classList.add('is-open');
      drawer.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      drawer.setAttribute('aria-hidden', 'false');
      hamburger?.setAttribute('aria-expanded', 'true');

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      if (this.configTemplate.enableDebugMode) {
        console.log('[MenuView] Mobile menu opened successfully');
      }
    }
  }

  /**
   * Close mobile menu drawer
   */
  private closeMobileMenu(): void {
    const overlay = this.root.querySelector('.myio-menu-mobile-overlay');
    const drawer = this.root.querySelector('.myio-menu-mobile-drawer');
    const hamburger = this.root.querySelector('.myio-menu-hamburger');

    if (overlay && drawer) {
      overlay.classList.remove('is-open');
      drawer.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      drawer.setAttribute('aria-hidden', 'true');
      hamburger?.setAttribute('aria-expanded', 'false');

      // Restore body scroll
      document.body.style.overflow = '';
    }
  }

  /**
   * Handle tab click
   */
  private handleTabClick(tabId: string): void {
    // Store the tab being clicked as pending (not yet confirmed)
    this.pendingTabId = tabId;

    // Open context modal for this tab (don't change active tab yet)
    this.openContextModal(tabId);
  }

  /**
   * Open context modal for a tab
   */
  private openContextModal(tabId: string): void {
    this.closeAllContextModals();

    const modal = this.root.querySelector(`#menuContextModal_${tabId}`);
    if (modal) {
      modal.classList.add('is-open');

      // Sync active state with current context
      const currentContextId = this.contextsByTab.get(tabId);
      modal.querySelectorAll('.myio-menu-context-option').forEach(opt => {
        const optContextId = (opt as HTMLElement).dataset.contextId;
        opt.classList.toggle('is-active', optContextId === currentContextId);
      });
    }
  }

  /**
   * Close all context modals
   * @param confirmed - If true, the user selected a context; if false, cancelled
   */
  private closeAllContextModals(confirmed = false): void {
    this.root.querySelectorAll('.myio-menu-context-modal').forEach(modal => {
      modal.classList.remove('is-open');
    });

    // If not confirmed (user closed without selecting), clear pending state
    if (!confirmed) {
      this.pendingTabId = null;
    }
  }

  /**
   * Handle context selection
   */
  private handleContextSelect(tabId: string, contextId: string, target: string): void {
    // Update internal state
    this.contextsByTab.set(tabId, contextId);

    // Check if this is a new tab activation
    const isNewTab = this.activeTabId !== tabId;

    // Update active tab to the selected one
    this.activeTabId = tabId;
    this.pendingTabId = null; // Clear pending state

    // Update tab active states
    this.root.querySelectorAll('.tab[data-tab-id]').forEach(tab => {
      const id = (tab as HTMLElement).dataset.tabId;
      tab.classList.toggle('is-active', id === tabId);
    });

    // Update all tab labels (active shows context, others show only domain)
    this.updateAllTabLabels();

    // Update active state in modal
    const modal = this.root.querySelector(`#menuContextModal_${tabId}`);
    if (modal) {
      modal.querySelectorAll('.myio-menu-context-option').forEach(opt => {
        const optContextId = (opt as HTMLElement).dataset.contextId;
        opt.classList.toggle('is-active', optContextId === contextId);
      });
    }

    // Close modal (confirmed = true because user selected a context)
    this.closeAllContextModals(true);

    // Emit events
    this.emit('context-change', { tabId, contextId, target });

    if (isNewTab) {
      this.emit('tab-change', { tabId, contextId, target });
    }
  }

  /**
   * Open filter modal
   */
  public openFilterModal(): void {
    const modal = this.root.querySelector('#menuFilterModal');
    if (modal) {
      modal.classList.add('is-open');
      this.renderFilterList();
      // Focus search input
      const searchInput = this.root.querySelector('#menuFilterSearch') as HTMLInputElement;
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
      }
    }
  }

  /**
   * Close filter modal
   */
  public closeFilterModal(): void {
    const modal = this.root.querySelector('#menuFilterModal');
    if (modal) {
      modal.classList.remove('is-open');
    }
  }

  // Filter modal state
  private filterSelection: Set<string> = new Set();
  private availableShoppings: Shopping[] = [];

  /**
   * Update available shoppings
   */
  public updateShoppings(shoppings: Shopping[]): void {
    this.availableShoppings = shoppings;

    // Select all by default if no selection exists
    if (this.filterSelection.size === 0) {
      shoppings.forEach(s => this.filterSelection.add(s.value));
    }

    this.renderFilterList();
  }

  /**
   * Get selected shoppings
   */
  public getSelectedShoppings(): Shopping[] {
    return this.availableShoppings.filter(s => this.filterSelection.has(s.value));
  }

  /**
   * Set selected shoppings
   */
  public setSelectedShoppings(shoppings: Shopping[]): void {
    this.filterSelection.clear();
    shoppings.forEach(s => this.filterSelection.add(s.value));
    this.renderFilterList();
  }

  /**
   * Render filter list
   */
  private renderFilterList(): void {
    const listEl = this.root.querySelector('#menuFilterList') as HTMLElement;
    const chipsEl = this.root.querySelector('#menuFilterChips') as HTMLElement;
    const countEl = this.root.querySelector('#menuFilterCount') as HTMLElement;
    const searchInput = this.root.querySelector('#menuFilterSearch') as HTMLInputElement;
    const applyBtn = this.root.querySelector('#menuFilterApplyBtn') as HTMLButtonElement;

    if (!listEl) return;

    const query = (searchInput?.value || '').toLowerCase();
    const filtered = this.availableShoppings.filter(s =>
      !query || s.name.toLowerCase().includes(query) || s.value.toLowerCase().includes(query)
    );

    // Render count
    const count = this.filterSelection.size;
    if (countEl) {
      countEl.textContent = `${count} selecionado${count === 1 ? '' : 's'}`;
    }

    // Disable apply button if no selection (minimum 1 required)
    if (applyBtn) {
      applyBtn.disabled = count === 0;
    }

    // Render chips
    if (chipsEl) {
      const selected = this.availableShoppings.filter(s => this.filterSelection.has(s.value));
      chipsEl.innerHTML = selected.map(s => `
        <span class="myio-menu-filter-chip" data-value="${s.value}">
          <span>${s.name}</span>
          <button class="chip-remove" title="Remover" aria-label="Remover">×</button>
        </span>
      `).join('');

      // Bind chip remove buttons
      chipsEl.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const chip = (e.target as HTMLElement).closest('.myio-menu-filter-chip') as HTMLElement;
          const value = chip?.dataset.value;
          if (value) {
            this.filterSelection.delete(value);
            this.renderFilterList();
          }
        });
      });
    }

    // Render list
    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="myio-menu-filter-empty">
          <div>Nenhum shopping disponivel.</div>
          <button class="myio-menu-filter-reload-btn">
            <span>🔄</span> Tentar Recarregar
          </button>
        </div>
      `;

      const reloadBtn = listEl.querySelector('.myio-menu-filter-reload-btn');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
          this.emit('shoppings-ready', null);
        });
      }
      return;
    }

    listEl.innerHTML = filtered.map(s => `
      <button
        class="myio-menu-filter-item ${this.filterSelection.has(s.value) ? 'selected' : ''}"
        data-value="${s.value}"
      >
        <div class="checkbox">${this.filterSelection.has(s.value) ? '✓' : ''}</div>
        <span>${s.name}</span>
      </button>
    `).join('');

    // Bind item clicks
    listEl.querySelectorAll('.myio-menu-filter-item').forEach(item => {
      item.addEventListener('click', () => {
        const value = (item as HTMLElement).dataset.value!;
        if (this.filterSelection.has(value)) {
          this.filterSelection.delete(value);
        } else {
          this.filterSelection.add(value);
        }
        this.renderFilterList();
      });
    });
  }

  /**
   * Handle filter apply
   */
  private handleFilterApply(): void {
    const selected = this.getSelectedShoppings();
    this.emit('filter-apply', selected);
    this.closeFilterModal();
  }

  /**
   * Handle filter clear
   */
  private handleFilterClear(): void {
    this.filterSelection.clear();
    const searchInput = this.root.querySelector('#menuFilterSearch') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
    }
    this.renderFilterList();
  }

  /**
   * Apply dynamic styles based on themeConfig
   */
  private applyDynamicStyles(): void {
    const t = this.themeConfig;

    // Tab colors
    this.root.style.setProperty('--menu-tab-active-bg', t.tabActiveBackgroundColor);
    this.root.style.setProperty('--menu-tab-active-color', t.tabActiveFontColor);
    this.root.style.setProperty('--menu-tab-inactive-bg', t.tabInactiveBackgroundColor);
    this.root.style.setProperty('--menu-tab-inactive-color', t.tabInactiveFontColor);
    this.root.style.setProperty('--menu-tab-border', t.tabBorderColor);

    // Button colors
    this.root.style.setProperty('--menu-btn-load-bg', t.loadButtonBackgroundColor);
    this.root.style.setProperty('--menu-btn-load-color', t.loadButtonFontColor);
    this.root.style.setProperty('--menu-btn-clear-bg', t.clearButtonBackgroundColor);
    this.root.style.setProperty('--menu-btn-clear-color', t.clearButtonFontColor);
    this.root.style.setProperty('--menu-btn-goals-bg', t.goalsButtonBackgroundColor);
    this.root.style.setProperty('--menu-btn-goals-color', t.goalsButtonFontColor);
    this.root.style.setProperty('--menu-btn-filter-bg', t.filterButtonBackgroundColor);
    this.root.style.setProperty('--menu-btn-filter-color', t.filterButtonFontColor);

    // Date picker colors
    this.root.style.setProperty('--menu-datepicker-bg', t.datePickerBackgroundColor);
    this.root.style.setProperty('--menu-datepicker-color', t.datePickerFontColor);

    // Context modal colors
    this.root.style.setProperty('--menu-modal-bg', t.modalBackgroundColor);
    this.root.style.setProperty('--menu-modal-header-bg', t.modalHeaderBackgroundColor);
    this.root.style.setProperty('--menu-modal-text', t.modalTextColor);
    this.root.style.setProperty('--menu-modal-desc', t.modalDescriptionColor);
    this.root.style.setProperty('--menu-modal-border', t.modalBorderColor);
    this.root.style.setProperty('--menu-option-hover-bg', t.optionHoverBackgroundColor);
    this.root.style.setProperty('--menu-option-active-bg', t.optionActiveBackgroundColor);
    this.root.style.setProperty('--menu-option-active-border', t.optionActiveBorderColor);

    // Filter modal colors
    this.root.style.setProperty('--menu-filter-bg', t.filterModalBackgroundColor);
    this.root.style.setProperty('--menu-filter-text', t.filterModalTextColor);
    this.root.style.setProperty('--menu-filter-border', t.filterModalBorderColor);
    this.root.style.setProperty('--menu-filter-hover', t.optionHoverBackgroundColor);
    this.root.style.setProperty('--menu-chip-bg', t.chipBackgroundColor);
    this.root.style.setProperty('--menu-chip-text', t.chipTextColor);
    this.root.style.setProperty('--menu-chip-border', t.chipBorderColor);
    this.root.style.setProperty('--menu-filter-selected-bg', t.filterItemSelectedBackgroundColor);
    this.root.style.setProperty('--menu-filter-selected-border', t.filterItemSelectedBorderColor);
  }

  /**
   * Update the active tab
   */
  public setActiveTab(tabId: string): void {
    this.activeTabId = tabId;

    this.root.querySelectorAll('.tab[data-tab-id]').forEach(tab => {
      const id = (tab as HTMLElement).dataset.tabId;
      tab.classList.toggle('is-active', id === tabId);
    });

    // Update all tab labels (active shows context, others show only domain)
    this.updateAllTabLabels();
  }

  /**
   * Get the active tab ID
   */
  public getActiveTab(): string {
    return this.activeTabId;
  }

  /**
   * Set the context for a specific tab
   */
  public setContext(tabId: string, contextId: string): void {
    this.contextsByTab.set(tabId, contextId);

    // Update tab label only if this tab is active
    // (inactive tabs only show domain, not context)
    if (tabId === this.activeTabId) {
      const tabLabel = this.root.querySelector(`#menuTab_${tabId} .tab-label`);
      if (tabLabel) {
        tabLabel.textContent = this.getTabLabel(tabId, true);
      }
    }
  }

  /**
   * Get the context for a specific tab
   */
  public getContext(tabId: string): string {
    return this.contextsByTab.get(tabId) ?? '';
  }

  /**
   * Get the date input element
   */
  public getDateInput(): HTMLInputElement | null {
    return this.root.querySelector('#menuDateInput');
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.closeAllContextModals();
    this.closeFilterModal();
    this.eventHandlers.clear();

    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  /**
   * Set the theme mode (light or dark)
   */
  public setThemeMode(mode: MenuThemeMode): void {
    this.themeMode = mode;
    this.themeConfig = this.getThemeConfig();

    // Update root class
    this.root.classList.remove('myio-menu-theme-light', 'myio-menu-theme-dark');
    this.root.classList.add(`myio-menu-theme-${mode}`);

    // Update CSS variables on root
    this.applyDynamicStyles();

    // Update theme toggle button
    const themeToggleBtn = this.root.querySelector('#menuThemeToggleBtn');
    if (themeToggleBtn) {
      const iconEl = themeToggleBtn.querySelector('.theme-icon');
      if (iconEl) {
        iconEl.textContent = mode === 'dark' ? '🌙' : '☀️';
      }
      themeToggleBtn.classList.toggle('is-dark', mode === 'dark');
    }

    if (this.configTemplate.enableDebugMode) {
      console.log('[MenuView] Theme changed to:', mode);
    }

    // Emit theme change event
    this.emit('theme-change', { themeMode: mode });
  }

  /**
   * Get the current theme mode
   */
  public getThemeMode(): MenuThemeMode {
    return this.themeMode;
  }

  /**
   * Get the root element
   */
  public getElement(): HTMLElement {
    return this.root;
  }
}
