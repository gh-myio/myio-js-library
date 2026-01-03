/**
 * RFC-0114: Menu Component Library
 * View layer for the Menu Component
 */

import {
  MenuComponentParams,
  MenuConfigTemplate,
  MenuThemeMode,
  MenuEventType,
  MenuEventHandler,
  TabConfig,
  ContextOption,
  Shopping,
  DEFAULT_MENU_CONFIG,
  DEFAULT_MENU_CONFIG_LIGHT,
  DEFAULT_MENU_CONFIG_DARK,
  DEFAULT_TABS,
} from './types';

/**
 * Menu View - Handles rendering and DOM interactions
 */
export class MenuView {
  private container: HTMLElement;
  private root: HTMLElement;
  private config: Required<MenuConfigTemplate>;
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
    this.themeMode = params.configTemplate?.themeMode ?? 'light';
    this.config = this.mergeConfig(params.configTemplate);
    this.tabs = params.tabs ?? DEFAULT_TABS;
    this.activeTabId = params.initialTab ?? this.tabs[0]?.id ?? 'energy';

    // Initialize contexts with defaults
    this.tabs.forEach(tab => {
      this.contextsByTab.set(tab.id, tab.defaultContext ?? tab.contexts[0]?.id ?? '');
    });

    this.root = document.createElement('div');
    this.root.className = `myio-menu-root myio-menu-theme-${this.themeMode}`;

    if (this.config.enableDebugMode) {
      console.log('[MenuView] Config:', this.config);
      console.log('[MenuView] Tabs:', this.tabs);
      console.log('[MenuView] Theme:', this.themeMode);
    }
  }

  /**
   * Merge user config with defaults based on theme mode
   */
  private mergeConfig(userConfig?: MenuConfigTemplate): Required<MenuConfigTemplate> {
    const baseConfig = this.themeMode === 'dark' ? DEFAULT_MENU_CONFIG_DARK : DEFAULT_MENU_CONFIG_LIGHT;
    return {
      ...baseConfig,
      ...userConfig,
      themeMode: this.themeMode,
    };
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
    const c = this.config;
    return `
/* ==========================================
   MYIO Menu Component - RFC-0114
   ========================================== */

.myio-menu-root {
  --menu-tab-active-bg: ${c.tabSelecionadoBackgroundColor};
  --menu-tab-active-color: ${c.tabSelecionadoFontColor};
  --menu-tab-inactive-bg: ${c.tabNaoSelecionadoBackgroundColor};
  --menu-tab-inactive-color: ${c.tabNaoSelecionadoFontColor};
  --menu-btn-load-bg: ${c.botaoCarregarBackgroundColor};
  --menu-btn-load-color: ${c.botaoCarregarFontColor};
  --menu-btn-clear-bg: ${c.botaoLimparBackgroundColor};
  --menu-btn-clear-color: ${c.botaoLimparFontColor};
  --menu-btn-goals-bg: ${c.botaoMetasBackgroundColor};
  --menu-btn-goals-color: ${c.botaoMetasFontColor};
  --menu-btn-filter-bg: ${c.botaoFiltroBackgroundColor};
  --menu-btn-filter-color: ${c.botaoFiltroFontColor};
  --menu-datepicker-bg: ${c.datePickerBackgroundColor};
  --menu-datepicker-color: ${c.datePickerFontColor};

  /* Theme-aware colors (light mode defaults) */
  --menu-toolbar-bg: #f8f9fa;
  --menu-toolbar-border: #e0e0e0;
  --menu-modal-bg: #ffffff;
  --menu-modal-header-bg: #f8fafc;
  --menu-modal-border: #e2e8f0;
  --menu-modal-text: #1e293b;
  --menu-modal-desc: #64748b;
  --menu-option-hover-bg: #f1f5f9;
  --menu-option-active-bg: #eff6ff;
  --menu-option-active-border: #3b82f6;
  --menu-option-active-color: #1d4ed8;
  --menu-filter-bg: #ffffff;
  --menu-filter-text: #344054;
  --menu-filter-border: #d9d9d9;
  --menu-filter-hover: #f2f2f2;
  --menu-filter-selected-bg: #f0f9ff;
  --menu-filter-selected-border: #3b82f6;
  --menu-chip-bg: #e0e7ff;
  --menu-chip-text: #3730a3;
  --menu-chip-border: #a5b4fc;

  font-family: 'Inter', 'Roboto', 'Segoe UI', sans-serif;
  width: 100%;
}

/* Dark Theme Overrides */
.myio-menu-root.myio-menu-theme-dark {
  --menu-toolbar-bg: #1f2937;
  --menu-toolbar-border: #374151;
  --menu-modal-bg: #1f2937;
  --menu-modal-header-bg: #111827;
  --menu-modal-border: #374151;
  --menu-modal-text: #f3f4f6;
  --menu-modal-desc: #9ca3af;
  --menu-option-hover-bg: #374151;
  --menu-option-active-bg: #1e3a5f;
  --menu-option-active-border: #3b82f6;
  --menu-option-active-color: #93c5fd;
  --menu-filter-bg: #1f2937;
  --menu-filter-text: #e5e7eb;
  --menu-filter-border: #4b5563;
  --menu-filter-hover: #374151;
  --menu-filter-selected-bg: #1e3a5f;
  --menu-filter-selected-border: #3b82f6;
  --menu-chip-bg: #312e81;
  --menu-chip-text: #c7d2fe;
  --menu-chip-border: #4338ca;
}

/* Toolbar Root */
.myio-toolbar-root {
  background: var(--menu-toolbar-bg);
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.myio-menu-theme-dark .myio-toolbar-root {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Tabs Row */
.myio-tabs-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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
`;
  }

  /**
   * Build the HTML structure
   */
  private buildHTML(): string {
    const showGoals = this.params.showGoalsButton !== false;
    const showFilter = this.params.showFilterButton !== false;
    const showLoad = this.params.showLoadButton !== false;
    const showClear = this.params.showClearButton !== false;

    return `
      <section class="myio-toolbar-root">
        <div class="myio-tabs-row">
          <nav class="myio-tabs" role="tablist" aria-label="Secoes">
            ${this.tabs.map(tab => this.buildTabHTML(tab)).join('')}
          </nav>

          ${showGoals ? this.buildGoalsButtonHTML() : ''}
          ${showFilter ? this.buildFilterButtonHTML() : ''}
          ${this.buildDatePickerHTML()}
          ${showLoad ? this.buildLoadButtonHTML() : ''}
          ${showClear ? this.buildClearButtonHTML() : ''}
          ${this.buildThemeToggleHTML()}
        </div>

        ${this.tabs.map(tab => this.buildContextModalHTML(tab)).join('')}
      </section>

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
   * Apply dynamic styles based on config
   */
  private applyDynamicStyles(): void {
    // CSS variables are already set in getStyles(), but we can update them here if needed
    const c = this.config;
    this.root.style.setProperty('--menu-tab-active-bg', c.tabSelecionadoBackgroundColor);
    this.root.style.setProperty('--menu-tab-active-color', c.tabSelecionadoFontColor);
    this.root.style.setProperty('--menu-tab-inactive-bg', c.tabNaoSelecionadoBackgroundColor);
    this.root.style.setProperty('--menu-tab-inactive-color', c.tabNaoSelecionadoFontColor);
    this.root.style.setProperty('--menu-btn-load-bg', c.botaoCarregarBackgroundColor);
    this.root.style.setProperty('--menu-btn-load-color', c.botaoCarregarFontColor);
    this.root.style.setProperty('--menu-btn-clear-bg', c.botaoLimparBackgroundColor);
    this.root.style.setProperty('--menu-btn-clear-color', c.botaoLimparFontColor);
    this.root.style.setProperty('--menu-btn-goals-bg', c.botaoMetasBackgroundColor);
    this.root.style.setProperty('--menu-btn-goals-color', c.botaoMetasFontColor);
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
    this.config = this.mergeConfig({ ...this.config, themeMode: mode });

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

    if (this.config.enableDebugMode) {
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
