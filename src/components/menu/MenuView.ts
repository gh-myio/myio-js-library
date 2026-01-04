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

import { ModalHeader } from '../../utils/ModalHeader';
import type { ModalHeaderController } from '../../utils/ModalHeader';

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

  // Filter Modal (RFC-0121 ModalHeader controller pattern)
  private filterModalHeaderController: ModalHeaderController | null = null;

  // Unified Navigation Modal (RFC-0121 ModalHeader controller pattern)
  private unifiedModalHeaderController: ModalHeaderController | null = null;

  constructor(private params: MenuComponentParams) {
    this.container = params.container;
    this.configTemplate = { ...DEFAULT_CONFIG_TEMPLATE, ...params.configTemplate };
    this.themeMode = 'light'; // Default, can be changed via setThemeMode
    this.themeConfig = this.getThemeConfig();
    this.tabs = params.tabs ?? DEFAULT_TABS;
    this.activeTabId = params.initialTab ?? this.tabs[0]?.id ?? 'energy';

    // Initialize contexts with defaults
    this.tabs.forEach((tab) => {
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
    const userTheme =
      this.themeMode === 'dark' ? this.configTemplate.darkMode : this.configTemplate.lightMode;

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
    handlers.forEach((handler) => handler(data));
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
   Unified Toolbar Bar Design
   ========================================== */

.myio-menu-root {
  font-family: 'Inter', 'Roboto', 'Segoe UI', sans-serif;
  width: 100%;
}

/* Toolbar Root - Container */
.myio-toolbar-root {
  background: transparent;
  padding: 0;
}

/* ==========================================
   Unified Toolbar Bar
   ========================================== */

.myio-toolbar-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--menu-bar-bg, rgba(255, 255, 255, 0.95));
  border: 1px solid var(--menu-bar-border, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 6px 16px;
  gap: 0;
  width: 100%;
  overflow: hidden;
}

/* Dark theme bar */
.myio-menu-theme-dark .myio-toolbar-bar {
  background: var(--menu-bar-bg, rgba(30, 41, 59, 0.95));
  border-color: var(--menu-bar-border, rgba(255, 255, 255, 0.1));
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}

/* Toolbar Sections */
.myio-toolbar-section {
  display: flex;
  align-items: center;
  gap: 2px;
}

.myio-toolbar-section--nav {
  flex: 0 0 auto;
}

.myio-toolbar-section--filters {
  flex: 1 1 auto;
  justify-content: center;
}

.myio-toolbar-section--actions {
  flex: 0 0 auto;
  justify-content: flex-end;
  gap: 8px;
}

/* Section Divider - Flexible spacer with line */
.myio-toolbar-divider {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  max-width: 60px;
  height: 28px;
}

.myio-toolbar-divider::after {
  content: '';
  width: 1px;
  height: 100%;
  background: var(--menu-bar-divider, rgba(0, 0, 0, 0.12));
}

.myio-menu-theme-dark .myio-toolbar-divider::after {
  background: var(--menu-bar-divider, rgba(255, 255, 255, 0.15));
}

/* ==========================================
   Toolbar Items (Buttons)
   ========================================== */

.myio-toolbar-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--menu-item-color, #475569);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  min-height: 36px;
}

.myio-toolbar-item:hover {
  background: var(--menu-item-hover-bg, rgba(0, 0, 0, 0.05));
}

.myio-toolbar-item:active {
  background: var(--menu-item-active-bg, rgba(0, 0, 0, 0.08));
}

/* Dark theme items */
.myio-menu-theme-dark .myio-toolbar-item {
  color: var(--menu-item-color, #e2e8f0);
}

.myio-menu-theme-dark .myio-toolbar-item:hover {
  background: var(--menu-item-hover-bg, rgba(255, 255, 255, 0.08));
}

.myio-menu-theme-dark .myio-toolbar-item:active {
  background: var(--menu-item-active-bg, rgba(255, 255, 255, 0.12));
}

/* Item Icon */
.myio-toolbar-item .ico {
  font-size: 16px;
  line-height: 1;
}

/* Item with dropdown arrow */
.myio-toolbar-item .dropdown-arrow {
  font-size: 9px;
  opacity: 0.6;
  margin-left: 2px;
}

/* ==========================================
   Navigation Button (Primary)
   ========================================== */

.myio-toolbar-item--nav {
  background: var(--menu-nav-bg, #3e1a7d);
  color: var(--menu-nav-color, #ffffff);
  font-weight: 600;
  padding: 8px 16px;
}

.myio-toolbar-item--nav:hover {
  background: var(--menu-nav-hover-bg, #4c2391);
}

.myio-toolbar-item--nav .nav-label {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ==========================================
   Filter Button
   ========================================== */

.myio-toolbar-item--filter {
  color: var(--menu-filter-color, #6366f1);
}

.myio-toolbar-item--filter:hover {
  background: rgba(99, 102, 241, 0.1);
}

.myio-menu-theme-dark .myio-toolbar-item--filter {
  color: var(--menu-filter-color, #a5b4fc);
}

.myio-menu-theme-dark .myio-toolbar-item--filter:hover {
  background: rgba(99, 102, 241, 0.2);
}

/* ==========================================
   Date Picker - MyIO Premium Style
   ========================================== */

.myio-toolbar-item--date {
  min-width: 340px;
  padding: 0;
  background: transparent;
  border: 2px solid var(--menu-date-border, #3e1a7d);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
  align-items: stretch;
}

.myio-toolbar-item--date:hover {
  border-color: var(--menu-date-hover-border, #5a2d9e);
  box-shadow: 0 0 0 3px rgba(62, 26, 125, 0.15);
}

.myio-toolbar-item--date:focus-within {
  border-color: var(--menu-date-focus-border, #3e1a7d);
  box-shadow: 0 0 0 3px rgba(62, 26, 125, 0.25);
}

.myio-toolbar-item--date .ico {
  background: var(--menu-date-icon-bg, #3e1a7d);
  color: white;
  padding: 0 12px;
  margin: 0;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
}

.myio-toolbar-item--date input {
  flex: 1;
  border: none;
  background: var(--menu-date-input-bg, #ffffff);
  color: var(--menu-date-input-color, #1e293b);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 12px;
  cursor: pointer;
  outline: none;
  min-width: 200px;
}

.myio-toolbar-item--date input::placeholder {
  color: var(--menu-date-placeholder, #64748b);
  font-weight: 500;
}

/* Dark theme date picker */
.myio-menu-theme-dark .myio-toolbar-item--date {
  border-color: var(--menu-date-border, #6b46c1);
}

.myio-menu-theme-dark .myio-toolbar-item--date:hover {
  border-color: var(--menu-date-hover-border, #805ad5);
  box-shadow: 0 0 0 3px rgba(107, 70, 193, 0.2);
}

.myio-menu-theme-dark .myio-toolbar-item--date .ico {
  background: var(--menu-date-icon-bg, #6b46c1);
}

.myio-menu-theme-dark .myio-toolbar-item--date input {
  background: var(--menu-date-input-bg, #1e293b);
  color: var(--menu-date-input-color, #f1f5f9);
}

.myio-menu-theme-dark .myio-toolbar-item--date input::placeholder {
  color: var(--menu-date-placeholder, #94a3b8);
}

/* ==========================================
   Action Buttons
   ========================================== */

.myio-toolbar-item--load {
  background: var(--menu-load-bg, #10b981);
  color: var(--menu-load-color, #ffffff);
}

.myio-toolbar-item--load:hover {
  background: var(--menu-load-hover-bg, #059669);
}

.myio-toolbar-item--clear {
  color: var(--menu-clear-color, #94a3b8);
}

.myio-toolbar-item--clear:hover {
  color: var(--menu-clear-hover-color, #64748b);
  background: rgba(148, 163, 184, 0.1);
}

.myio-menu-theme-dark .myio-toolbar-item--clear {
  color: var(--menu-clear-color, #94a3b8);
}

.myio-menu-theme-dark .myio-toolbar-item--clear:hover {
  color: var(--menu-clear-hover-color, #cbd5e1);
  background: rgba(148, 163, 184, 0.15);
}

.myio-toolbar-item--goals {
  background: var(--menu-goals-bg, #f59e0b);
  color: var(--menu-goals-color, #ffffff);
}

.myio-toolbar-item--goals:hover {
  background: var(--menu-goals-hover-bg, #d97706);
}

/* ==========================================
   Icon-only Buttons
   ========================================== */

.myio-toolbar-item--icon {
  padding: 8px;
  min-width: 36px;
  width: 36px;
}

.myio-toolbar-item--icon .theme-icon {
  font-size: 18px;
  line-height: 1;
}

/* Material Icons in buttons */
.myio-toolbar-item i.material-icons {
  font-size: 18px;
}

/* ==========================================
   Legacy .tab class support (for compatibility)
   ========================================== */

.myio-menu-root .tab {
  display: none; /* Hide legacy tabs */
}

/* Keep filter button visible if using old class */
.myio-menu-root .myio-filter-btn {
  display: none; /* Hide legacy filter button */
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
  max-width: 966px;
  width: 92%;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
}

.myio-menu-filter-modal-footer {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--menu-filter-bg);
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
  padding: 10px 14px;
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

.myio-menu-filter-item .filter-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.myio-menu-filter-item .filter-item-icons {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.myio-menu-filter-item .filter-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  width: 64px;
  height: 32px;
  border-radius: 8px;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.08);
  cursor: help;
  transition: all 0.2s ease;
}

.myio-menu-filter-item .filter-icon:hover {
  transform: scale(1.05);
}

.myio-menu-filter-item .filter-icon .count {
  font-size: 12px;
  font-weight: 600;
  color: var(--menu-filter-text);
  margin-left: 2px;
}

/* Icon colors */
.myio-menu-filter-item .filter-icon.users {
  color: #a78bfa;
}
.myio-menu-filter-item .filter-icon.users:hover {
  background: rgba(124, 58, 237, 0.2);
  border-color: rgba(124, 58, 237, 0.4);
}

.myio-menu-filter-item .filter-icon.alarms {
  color: #f87171;
}
.myio-menu-filter-item .filter-icon.alarms:hover {
  background: rgba(220, 38, 38, 0.2);
  border-color: rgba(220, 38, 38, 0.4);
}

.myio-menu-filter-item .filter-icon.notifications {
  color: #fbbf24;
}
.myio-menu-filter-item .filter-icon.notifications:hover {
  background: rgba(234, 179, 8, 0.2);
  border-color: rgba(234, 179, 8, 0.4);
}

.myio-menu-filter-item .filter-icon.energy {
  color: #22c55e;
}
.myio-menu-filter-item .filter-icon.energy:hover {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.4);
}

.myio-menu-filter-item .filter-icon.water {
  color: #3b82f6;
}
.myio-menu-filter-item .filter-icon.water:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
}

.myio-menu-filter-item .filter-icon.temperature {
  color: #f97316;
}
.myio-menu-filter-item .filter-icon.temperature:hover {
  background: rgba(249, 115, 22, 0.2);
  border-color: rgba(249, 115, 22, 0.4);
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

@media (max-width: 1200px) {
  .myio-toolbar-item--date {
    min-width: 180px;
  }

  .myio-toolbar-item--nav .nav-label {
    max-width: 150px;
  }
}

@media (max-width: 768px) {
  .myio-toolbar-bar {
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px;
  }

  .myio-toolbar-section--filters {
    order: 3;
    flex: 1 1 100%;
    justify-content: center;
  }

  .myio-toolbar-divider {
    display: none;
  }

  .myio-toolbar-item--date {
    min-width: 160px;
  }
}

@media (max-width: 480px) {
  .myio-toolbar-item {
    padding: 6px 10px;
    font-size: 12px;
  }

  .myio-toolbar-item--icon {
    width: 32px;
    min-width: 32px;
    padding: 6px;
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

  /* Hide the unified toolbar bar on mobile */
  .myio-toolbar-bar {
    display: none;
  }
}

/* ==========================================
   UNIFIED NAVIGATION MODAL (3 Columns)
   ========================================== */

/* Unified Modal Backdrop */
.myio-unified-modal {
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

.myio-unified-modal.is-open {
  display: flex;
}

/* Unified Modal Content */
.myio-unified-modal-content {
  background: var(--menu-modal-bg, #fff);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Unified Modal Header - Uses ModalHeader component (RFC-0121) */
/* .myio-modal-header styles come from ModalHeader.ts */

/* Unified Modal Maximized State */
.myio-unified-modal-content--maximized {
  max-width: calc(100vw - 40px) !important;
  max-height: calc(100vh - 40px) !important;
  width: calc(100vw - 40px) !important;
  height: calc(100vh - 40px) !important;
}

.myio-unified-modal-content--maximized .myio-modal-header {
  border-radius: 0 !important;
}

/* Unified Modal Body - 3 Columns */
.myio-unified-modal-body {
  display: flex;
  flex-direction: row;
  gap: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

/* Single Column */
.myio-unified-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--menu-modal-border, #e2e8f0);
  min-width: 0;
}

.myio-unified-column:last-child {
  border-right: none;
}

/* Column Header */
.myio-unified-column-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  font-weight: 700;
  font-size: 14px;
  color: #1c2743;
  border-bottom: 1px solid var(--menu-modal-border, #e2e8f0);
}

.myio-unified-column-header .ico {
  font-size: 18px;
}

/* Column Options */
.myio-unified-column-options {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  overflow-y: auto;
}

/* Single Option */
.myio-unified-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}

.myio-unified-option:hover {
  background: var(--menu-option-hover-bg, #f8fafc);
  border-color: var(--menu-modal-border, #cbd5e1);
}

.myio-unified-option.is-active {
  background: var(--menu-option-active-bg, #eff6ff);
  border-color: var(--menu-option-active-border, #1d4f91);
}

/* Domain-specific hover/active colors */
.myio-unified-option.energy:hover {
  background: #fff8e1;
  border-color: #ffcc80;
}
.myio-unified-option.energy.is-active {
  background: #fff8e1;
  border-color: #f59e0b;
}

.myio-unified-option.water:hover {
  background: #e3f2fd;
  border-color: #90caf9;
}
.myio-unified-option.water.is-active {
  background: #e3f2fd;
  border-color: #1976d2;
}

.myio-unified-option.temperature:hover {
  background: #fff3e0;
  border-color: #ffcc80;
}
.myio-unified-option.temperature.is-active {
  background: #fff3e0;
  border-color: #e65100;
}

.myio-unified-option .option-ico {
  font-size: 20px;
  flex-shrink: 0;
}

.myio-unified-option .option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.myio-unified-option .option-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--menu-modal-text, #1c2743);
  line-height: 1.3;
}

.myio-unified-option .option-desc {
  font-size: 11px;
  color: var(--menu-modal-desc, #64748b);
  margin-top: 2px;
  font-weight: 400;
  line-height: 1.3;
}

.myio-unified-option .option-check {
  font-size: 16px;
  font-weight: bold;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.2s ease;
  color: var(--menu-option-active-border, #1d4f91);
  flex-shrink: 0;
}

.myio-unified-option.is-active .option-check {
  opacity: 1;
  transform: scale(1);
}

.myio-unified-option.energy .option-check {
  color: #f59e0b;
}

.myio-unified-option.water .option-check {
  color: #1976d2;
}

.myio-unified-option.temperature .option-check {
  color: #e65100;
}

/* Responsive - Stack columns on smaller screens */
@media (max-width: 700px) {
  .myio-unified-modal-body {
    flex-direction: column;
  }

  .myio-unified-column {
    border-right: none;
    border-bottom: 1px solid var(--menu-modal-border, #e2e8f0);
  }

  .myio-unified-column:last-child {
    border-bottom: none;
  }

  .myio-unified-modal-content {
    max-width: 95vw;
    max-height: 90vh;
  }
}
`;
  }

  /**
   * Build the HTML structure
   * Layout: Unified Toolbar Bar with sections
   * [Navigation] | [Filter, Calendar] | [Load, Clear, Goals, Theme]
   */
  private buildHTML(): string {
    const showGoals = this.params.showGoalsButton !== false;
    const showFilter = this.params.showFilterButton !== false;
    const showLoad = this.params.showLoadButton !== false;
    const showClear = this.params.showClearButton !== false;

    return `
      <section class="myio-toolbar-root">
        <!-- Hamburger Button (visible on mobile only) -->
        <button class="myio-menu-hamburger" aria-label="Abrir menu" aria-expanded="false">
          ☰
        </button>

        <!-- Unified Toolbar Bar -->
        <div class="myio-toolbar-bar">
          <!-- Navigation -->
          ${this.buildUnifiedNavButtonHTML()}

          <div class="myio-toolbar-divider"></div>

          <!-- Filter -->
          ${showFilter ? this.buildFilterButtonHTML() : ''}

          ${showFilter ? '<div class="myio-toolbar-divider"></div>' : ''}

          <!-- Date Picker -->
          ${this.buildDatePickerHTML()}

          <div class="myio-toolbar-divider"></div>

          <!-- Load -->
          ${showLoad ? this.buildLoadButtonHTML() : ''}

          ${showLoad ? '<div class="myio-toolbar-divider"></div>' : ''}

          <!-- Clear -->
          ${showClear ? this.buildClearButtonHTML() : ''}

          ${showClear ? '<div class="myio-toolbar-divider"></div>' : ''}

          <!-- Goals -->
          ${showGoals ? this.buildGoalsButtonHTML() : ''}

          ${showGoals ? '<div class="myio-toolbar-divider"></div>' : ''}

          <!-- Theme Toggle -->
          ${this.buildThemeToggleHTML()}
        </div>

        ${this.buildUnifiedContextModalHTML()}
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
            ${this.tabs.map((tab) => this.buildMobileTabHTML(tab)).join('')}
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
   * Build the unified navigation button HTML
   * Shows current active tab and context (e.g., "Energia > Equipamentos")
   */
  private buildUnifiedNavButtonHTML(): string {
    const activeTab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!activeTab) return '';

    const currentContextId =
      this.contextsByTab.get(this.activeTabId) ?? activeTab.defaultContext ?? activeTab.contexts[0]?.id;
    const currentContext = activeTab.contexts.find((c) => c.id === currentContextId);
    const label = currentContext ? `${activeTab.label} > ${currentContext.title}` : activeTab.label;

    return `
      <button
        id="menuUnifiedNavBtn"
        class="myio-toolbar-item myio-toolbar-item--nav"
        aria-haspopup="dialog"
        aria-expanded="false"
      >
        <span class="ico">${activeTab.icon}</span>
        <span class="nav-label">${label}</span>
        <span class="dropdown-arrow">▼</span>
      </button>
    `;
  }

  /**
   * Update the unified navigation button label
   */
  private updateUnifiedNavButton(): void {
    const btn = this.root.querySelector('#menuUnifiedNavBtn');
    if (!btn) return;

    const activeTab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!activeTab) return;

    const currentContextId =
      this.contextsByTab.get(this.activeTabId) ?? activeTab.defaultContext ?? activeTab.contexts[0]?.id;
    const currentContext = activeTab.contexts.find((c) => c.id === currentContextId);
    const label = currentContext ? `${activeTab.label} > ${currentContext.title}` : activeTab.label;

    const iconEl = btn.querySelector('.ico');
    const labelEl = btn.querySelector('.nav-label');

    if (iconEl) iconEl.textContent = activeTab.icon;
    if (labelEl) labelEl.textContent = label;
  }

  /**
   * Build the unified context modal with 3 columns
   */
  private buildUnifiedContextModalHTML(): string {
    const headerHTML = ModalHeader.generateHTML({
      icon: '📊',
      title: 'Selecione a visualização',
      modalId: 'menuUnified',
      theme: 'dark',
      isMaximized: false,
      showThemeToggle: true,
      showMaximize: true,
      showClose: true,
      borderRadius: '16px 16px 0 0',
    });

    return `
      <div
        id="menuUnifiedContextModal"
        class="myio-unified-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menuUnified-header"
      >
        <div class="myio-unified-modal-content">
          ${headerHTML}
          <div class="myio-unified-modal-body">
            ${this.tabs.map((tab) => this.buildUnifiedColumnHTML(tab)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Build a single column for the unified modal
   */
  private buildUnifiedColumnHTML(tab: TabConfig): string {
    const currentContextId = this.contextsByTab.get(tab.id) ?? tab.defaultContext ?? tab.contexts[0]?.id;
    const isActiveTab = tab.id === this.activeTabId;

    // Define header background colors per domain
    const headerColors: Record<string, string> = {
      energy: 'linear-gradient(135deg, #fff3e0 0%, #ffcc80 100%)', // Orange tone
      water: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',   // Blue tone
      temperature: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', // Reddish tone
    };

    return `
      <div class="myio-unified-column ${tab.id} ${isActiveTab ? 'is-active-column' : ''}">
        <div class="myio-unified-column-header" style="background: ${headerColors[tab.id] || '#f8fafc'}">
          <span class="ico">${tab.icon}</span>
          <span>${tab.label}</span>
        </div>
        <div class="myio-unified-column-options">
          ${tab.contexts
            .map((ctx) => {
              const isActive = isActiveTab && ctx.id === currentContextId;
              return `
              <button
                class="myio-unified-option ${tab.id} ${isActive ? 'is-active' : ''}"
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
            })
            .join('')}
        </div>
      </div>
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
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return '';

    if (isActive) {
      const currentContextId = this.contextsByTab.get(tabId) ?? tab.defaultContext ?? tab.contexts[0]?.id;
      const currentContext = tab.contexts.find((c) => c.id === currentContextId);
      return currentContext ? `${tab.label}: ${currentContext.title}` : tab.label;
    }

    return tab.label;
  }

  /**
   * Update all tab labels based on current active tab
   */
  private updateAllTabLabels(): void {
    this.tabs.forEach((tab) => {
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
            ${tab.contexts
              .map((ctx) => this.buildContextOptionHTML(tab, ctx, ctx.id === currentContextId))
              .join('')}
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
      <button id="menuGoalsBtn" class="myio-toolbar-item myio-toolbar-item--goals" title="Configurar metas de consumo">
        <span class="ico">🎯</span>
        <span>Metas</span>
      </button>
    `;
  }

  /**
   * Build Filter button HTML
   */
  private buildFilterButtonHTML(): string {
    return `
      <button id="menuFilterBtn" class="myio-toolbar-item myio-toolbar-item--filter" type="button" title="Filtro de Shoppings">
        <span class="ico">🏢</span>
        <span>Filtro de Shoppings</span>
      </button>
    `;
  }

  /**
   * Build Date Picker HTML - MyIO Premium Style with time
   */
  private buildDatePickerHTML(): string {
    return `
      <div class="myio-toolbar-item myio-toolbar-item--date">
        <span class="ico">📅</span>
        <input
          id="menuDateInput"
          type="text"
          name="menuDateRange"
          placeholder="DD/MM/AA HH:mm até DD/MM/AA HH:mm"
          readonly
          title="Clique para selecionar período com data e hora"
        />
      </div>
    `;
  }

  /**
   * Build Mobile Tab HTML (for mobile drawer)
   */
  private buildMobileTabHTML(tab: TabConfig): string {
    const isActive = tab.id === this.activeTabId;
    const currentContextId = this.contextsByTab.get(tab.id) ?? tab.defaultContext ?? tab.contexts[0]?.id;
    const currentContext = tab.contexts.find((c) => c.id === currentContextId);
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
      <button id="menuLoadBtn" class="myio-toolbar-item myio-toolbar-item--load" title="Carregar dados">
        <span class="ico">🔍</span>
        <span>Carregar</span>
      </button>
    `;
  }

  /**
   * Build Clear button HTML
   */
  private buildClearButtonHTML(): string {
    return `
      <button id="menuClearBtn" class="myio-toolbar-item myio-toolbar-item--clear" title="Limpar cache e recarregar">
        <span class="ico">🗑️</span>
        <span>Limpar</span>
      </button>
    `;
  }

  /**
   * Build Theme Toggle button HTML
   */
  private buildThemeToggleHTML(): string {
    const isDark = this.themeMode === 'dark';
    return `
      <button id="menuThemeToggleBtn" class="myio-toolbar-item myio-toolbar-item--icon ${
        isDark ? 'is-dark' : ''
      }" title="Alternar tema claro/escuro">
        <span class="theme-icon">${isDark ? '🌙' : '☀️'}</span>
      </button>
    `;
  }

  /**
   * Build Filter Modal HTML
   */
  private buildFilterModalHTML(): string {
    const headerHTML = ModalHeader.generateHTML({
      icon: '🏢',
      title: 'Filtro de Shoppings',
      modalId: 'menuFilter',
      theme: this.getFilterModalDefaultTheme(),
      isMaximized: false,
      showThemeToggle: true,
      showMaximize: true,
      showClose: true,
      borderRadius: '12px 12px 0 0',
    });

    return `
      <div id="menuFilterModal" class="myio-menu-filter-modal" role="dialog" aria-modal="true" aria-labelledby="menuFilter-header">
        <div class="myio-menu-filter-modal-card">
          ${headerHTML}

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
    // ==========================================
    // Unified Navigation Modal
    // ==========================================

    // Unified nav button click - open modal
    const unifiedNavBtn = this.root.querySelector('#menuUnifiedNavBtn');
    if (unifiedNavBtn) {
      unifiedNavBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openUnifiedModal();
      });
    }

    // Unified modal backdrop click - close
    const unifiedModal = this.root.querySelector('#menuUnifiedContextModal');
    if (unifiedModal) {
      unifiedModal.addEventListener('click', (e) => {
        if (e.target === unifiedModal) {
          this.closeUnifiedModal();
        }
      });
    }

    // Unified modal header controller (RFC-0121)
    this.ensureUnifiedModalHeaderController();

    // Unified option clicks
    this.root.querySelectorAll('.myio-unified-option').forEach((option) => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const el = option as HTMLElement;
        const tabId = el.dataset.tabId!;
        const contextId = el.dataset.contextId!;
        const target = el.dataset.target!;
        this.handleUnifiedOptionSelect(tabId, contextId, target);
      });
    });

    // ==========================================
    // Legacy Tab clicks (kept for compatibility)
    // ==========================================
    this.root.querySelectorAll('.tab[data-tab-id]').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tabId = (tab as HTMLElement).dataset.tabId!;
        this.handleTabClick(tabId);
      });
    });

    // Context modal backdrop clicks
    this.root.querySelectorAll('.myio-menu-context-modal').forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeAllContextModals();
        }
      });
    });

    // Context option clicks
    this.root.querySelectorAll('.myio-menu-context-option').forEach((option) => {
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

    // Filter modal close buttons (legacy data-close attribute)
    this.root.querySelectorAll('#menuFilterModal [data-close]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeFilterModal());
    });

    // RFC-0121: ModalHeader controller pattern (encapsulated state)
    this.ensureFilterModalHeaderController();

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
    this.root.querySelectorAll('.myio-menu-mobile-drawer .tab[data-tab-id]').forEach((tab) => {
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

  // ==========================================
  // Unified Modal Methods
  // ==========================================

  /**
   * Open the unified context modal
   */
  private openUnifiedModal(): void {
    this.ensureUnifiedModalHeaderController();

    const modal = this.root.querySelector('#menuUnifiedContextModal');
    const btn = this.root.querySelector('#menuUnifiedNavBtn');

    if (modal) {
      modal.classList.add('is-open');
      btn?.setAttribute('aria-expanded', 'true');

      // Update active states in the modal
      this.updateUnifiedModalActiveStates();

      if (this.configTemplate.enableDebugMode) {
        console.log('[MenuView] Unified modal opened');
      }
    }
  }

  /**
   * Close the unified context modal
   */
  private closeUnifiedModal(): void {
    const modal = this.root.querySelector('#menuUnifiedContextModal');
    const btn = this.root.querySelector('#menuUnifiedNavBtn');

    if (modal) {
      modal.classList.remove('is-open');
      btn?.setAttribute('aria-expanded', 'false');

      // Reset header controller state
      this.unifiedModalHeaderController?.reset();
      if (this.unifiedModalHeaderController) {
        this.applyUnifiedModalTheme(this.unifiedModalHeaderController.getTheme());
        this.applyUnifiedModalMaximize(this.unifiedModalHeaderController.isMaximized());
      }

      if (this.configTemplate.enableDebugMode) {
        console.log('[MenuView] Unified modal closed');
      }
    }
  }

  /**
   * Ensure unified modal header controller is initialized
   */
  private ensureUnifiedModalHeaderController(): void {
    if (this.unifiedModalHeaderController) return;

    const modalContent = this.root.querySelector('.myio-unified-modal-content') as HTMLElement | null;
    if (!modalContent) return;

    const headerEl = this.root.querySelector('#menuUnified-header') as HTMLElement | null;

    this.unifiedModalHeaderController = ModalHeader.createController({
      modalId: 'menuUnified',
      theme: 'dark',
      themeTarget: headerEl ?? undefined,
      lightThemeClass: 'myio-modal-header--light',
      maximizeTarget: modalContent,
      maximizedClass: 'myio-unified-modal-content--maximized',
      onThemeChange: (theme) => this.applyUnifiedModalTheme(theme),
      onMaximizeChange: (isMaximized) => this.applyUnifiedModalMaximize(isMaximized),
      onClose: () => this.closeUnifiedModal(),
    });

    this.unifiedModalHeaderController.reset();
    this.applyUnifiedModalTheme(this.unifiedModalHeaderController.getTheme());
    this.applyUnifiedModalMaximize(this.unifiedModalHeaderController.isMaximized());
  }

  /**
   * Apply theme to unified modal
   */
  private applyUnifiedModalTheme(theme: 'dark' | 'light'): void {
    const modalContent = this.root.querySelector('.myio-unified-modal-content') as HTMLElement | null;
    if (!modalContent) return;

    modalContent.style.background = theme === 'light' ? '#ffffff' : '#ffffff';

    if (this.configTemplate.enableDebugMode) {
      console.log('[MenuView] Unified modal theme:', theme);
    }
  }

  /**
   * Apply maximize state to unified modal
   */
  private applyUnifiedModalMaximize(isMaximized: boolean): void {
    const modalContent = this.root.querySelector('.myio-unified-modal-content') as HTMLElement | null;
    if (!modalContent) return;

    if (isMaximized) {
      modalContent.style.maxWidth = 'calc(100vw - 40px)';
      modalContent.style.maxHeight = 'calc(100vh - 40px)';
      modalContent.style.width = 'calc(100vw - 40px)';
      modalContent.style.height = 'calc(100vh - 40px)';
    } else {
      modalContent.style.maxWidth = '';
      modalContent.style.maxHeight = '';
      modalContent.style.width = '';
      modalContent.style.height = '';
    }

    if (this.configTemplate.enableDebugMode) {
      console.log('[MenuView] Unified modal maximized:', isMaximized);
    }
  }

  /**
   * Update active states in the unified modal
   */
  private updateUnifiedModalActiveStates(): void {
    this.root.querySelectorAll('.myio-unified-option').forEach((opt) => {
      const el = opt as HTMLElement;
      const tabId = el.dataset.tabId!;
      const contextId = el.dataset.contextId!;

      const currentContextId = this.contextsByTab.get(tabId);
      const isActiveTab = tabId === this.activeTabId;
      const isActive = isActiveTab && contextId === currentContextId;

      el.classList.toggle('is-active', isActive);
    });

    // Update column active states
    this.root.querySelectorAll('.myio-unified-column').forEach((col) => {
      const tabId = col.classList.contains('energy')
        ? 'energy'
        : col.classList.contains('water')
        ? 'water'
        : col.classList.contains('temperature')
        ? 'temperature'
        : '';
      col.classList.toggle('is-active-column', tabId === this.activeTabId);
    });
  }

  /**
   * Handle option selection in the unified modal
   */
  private handleUnifiedOptionSelect(tabId: string, contextId: string, target: string): void {
    // Update internal state
    this.contextsByTab.set(tabId, contextId);

    // Check if this is a new tab activation
    const isNewTab = this.activeTabId !== tabId;

    // Update active tab to the selected one
    this.activeTabId = tabId;

    // Update the unified navigation button
    this.updateUnifiedNavButton();

    // Update active states in the modal
    this.updateUnifiedModalActiveStates();

    // Close the modal
    this.closeUnifiedModal();

    // Emit events
    this.emit('context-change', { tabId, contextId, target });

    if (isNewTab) {
      this.emit('tab-change', { tabId, contextId, target });
    }

    if (this.configTemplate.enableDebugMode) {
      console.log('[MenuView] Unified option selected:', { tabId, contextId, target });
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
      modal.querySelectorAll('.myio-menu-context-option').forEach((opt) => {
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
    this.root.querySelectorAll('.myio-menu-context-modal').forEach((modal) => {
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
    this.root.querySelectorAll('.tab[data-tab-id]').forEach((tab) => {
      const id = (tab as HTMLElement).dataset.tabId;
      tab.classList.toggle('is-active', id === tabId);
    });

    // Update all tab labels (active shows context, others show only domain)
    this.updateAllTabLabels();

    // Update active state in modal
    const modal = this.root.querySelector(`#menuContextModal_${tabId}`);
    if (modal) {
      modal.querySelectorAll('.myio-menu-context-option').forEach((opt) => {
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
    this.ensureFilterModalHeaderController();

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

    // RFC-0121: reset modal header state when closing
    this.filterModalHeaderController?.reset();
    if (this.filterModalHeaderController) {
      this.applyFilterModalTheme(this.filterModalHeaderController.getTheme());
      this.applyFilterModalMaximize(this.filterModalHeaderController.isMaximized());
    }
  }

  private getFilterModalDefaultTheme(): 'dark' | 'light' {
    return 'dark';
  }

  private ensureFilterModalHeaderController(): void {
    if (this.filterModalHeaderController) return;

    const modalCard = this.root.querySelector('.myio-menu-filter-modal-card') as HTMLElement | null;
    if (!modalCard) return;

    const headerEl = this.root.querySelector('#menuFilter-header') as HTMLElement | null;

    this.filterModalHeaderController = ModalHeader.createController({
      modalId: 'menuFilter',
      theme: this.getFilterModalDefaultTheme(),
      themeTarget: headerEl ?? undefined,
      lightThemeClass: 'myio-modal-header--light',
      maximizeTarget: modalCard,
      maximizedClass: 'myio-menu-filter-modal-card--maximized',
      onThemeChange: (theme) => this.applyFilterModalTheme(theme),
      onMaximizeChange: (isMaximized) => this.applyFilterModalMaximize(isMaximized),
      onClose: () => this.closeFilterModal(),
    });

    this.filterModalHeaderController.reset();
    this.applyFilterModalTheme(this.filterModalHeaderController.getTheme());
    this.applyFilterModalMaximize(this.filterModalHeaderController.isMaximized());
  }

  private applyFilterModalTheme(theme: 'dark' | 'light'): void {
    const modalCard = this.root.querySelector('.myio-menu-filter-modal-card') as HTMLElement | null;
    if (!modalCard) return;

    modalCard.style.background = theme === 'light' ? '#ffffff' : 'var(--menu-filter-bg, #ffffff)';

    if (this.configTemplate.enableDebugMode) {
      console.log('[MenuView] Filter modal theme:', theme);
    }
  }

  private applyFilterModalMaximize(isMaximized: boolean): void {
    const modalCard = this.root.querySelector('.myio-menu-filter-modal-card') as HTMLElement | null;
    if (!modalCard) return;

    if (isMaximized) {
      modalCard.style.maxWidth = 'calc(100vw - 40px)';
      modalCard.style.maxHeight = 'calc(100vh - 40px)';
      modalCard.style.width = 'calc(100vw - 40px)';
      modalCard.style.height = 'calc(100vh - 40px)';
    } else {
      modalCard.style.maxWidth = '966px';
      modalCard.style.maxHeight = '86vh';
      modalCard.style.width = '92%';
      modalCard.style.height = '';
    }

    if (this.configTemplate.enableDebugMode) {
      console.log('[MenuView] Filter modal maximized:', isMaximized);
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
      shoppings.forEach((s) => this.filterSelection.add(s.value));
    }

    this.renderFilterList();
  }

  /**
   * Get selected shoppings
   */
  public getSelectedShoppings(): Shopping[] {
    return this.availableShoppings.filter((s) => this.filterSelection.has(s.value));
  }

  /**
   * Set selected shoppings
   */
  public setSelectedShoppings(shoppings: Shopping[]): void {
    this.filterSelection.clear();
    shoppings.forEach((s) => this.filterSelection.add(s.value));
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
    const filtered = this.availableShoppings.filter(
      (s) => !query || s.name.toLowerCase().includes(query) || s.value.toLowerCase().includes(query)
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
      const selected = this.availableShoppings.filter((s) => this.filterSelection.has(s.value));
      chipsEl.innerHTML = selected
        .map(
          (s) => `
        <span class="myio-menu-filter-chip" data-value="${s.value}">
          <span>${s.name}</span>
          <button class="chip-remove" title="Remover" aria-label="Remover">×</button>
        </span>
      `
        )
        .join('');

      // Bind chip remove buttons
      chipsEl.querySelectorAll('.chip-remove').forEach((btn) => {
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

    listEl.innerHTML = filtered
      .map((s) => {
        const counts = this.getShoppingDeviceCounts(s.name);
        return `
        <button
          class="myio-menu-filter-item ${this.filterSelection.has(s.value) ? 'selected' : ''}"
          data-value="${s.value}"
          data-name="${s.name}"
        >
          <div class="checkbox">${this.filterSelection.has(s.value) ? '✓' : ''}</div>
          <span class="filter-item-name">${s.name}</span>
          <div class="filter-item-icons">
            <span class="filter-icon users" data-tooltip-type="users" data-shopping="${
              s.name
            }">👥 <span class="count">${counts.users}</span></span>
            <span class="filter-icon alarms" data-tooltip-type="alarms" data-shopping="${
              s.name
            }">🚨 <span class="count">${counts.alarms}</span></span>
            <span class="filter-icon notifications" data-tooltip-type="notifications" data-shopping="${
              s.name
            }">🔔 <span class="count">${counts.notifications}</span></span>
            <span class="filter-icon energy" data-tooltip-type="energy" data-shopping="${
              s.name
            }">⚡ <span class="count">${counts.energy}</span></span>
            <span class="filter-icon water" data-tooltip-type="water" data-shopping="${
              s.name
            }">💧 <span class="count">${counts.water}</span></span>
            <span class="filter-icon temperature" data-tooltip-type="temperature" data-shopping="${
              s.name
            }">🌡️ <span class="count">${counts.temperature}</span></span>
          </div>
        </button>
      `;
      })
      .join('');

    // Bind item clicks (checkbox area)
    listEl.querySelectorAll('.myio-menu-filter-item').forEach((item) => {
      item.addEventListener('click', (e: Event) => {
        // Don't toggle if clicking on an icon
        const target = e.target as HTMLElement;
        if (target.closest('.filter-icon')) {
          e.stopPropagation();
          return;
        }
        const value = (item as HTMLElement).dataset.value!;
        if (this.filterSelection.has(value)) {
          this.filterSelection.delete(value);
        } else {
          this.filterSelection.add(value);
        }
        this.renderFilterList();
      });
    });

    // Bind tooltip icon clicks/hover
    this.bindFilterTooltipEvents(listEl);
  }

  /**
   * Bind tooltip events for filter icons
   */
  private bindFilterTooltipEvents(listEl: Element): void {
    const icons = listEl.querySelectorAll('.filter-icon[data-tooltip-type]');

    icons.forEach((icon) => {
      const showHandler = (e: Event) => {
        e.stopPropagation();
        const el = e.currentTarget as HTMLElement;
        const tooltipType = el.dataset.tooltipType as string;
        const shoppingName = el.dataset.shopping as string;

        this.showFilterTooltip(tooltipType, shoppingName, el);
      };

      const hideHandler = () => {
        this.hideFilterTooltips();
      };

      icon.addEventListener('mouseenter', showHandler);
      icon.addEventListener('click', showHandler);
      icon.addEventListener('mouseleave', hideHandler);
    });
  }

  /**
   * Hide all filter tooltips with delayed hide
   */
  private hideFilterTooltips(): void {
    const win = window as any;
    const MyIOLibrary = win.MyIOLibrary;

    if (!MyIOLibrary) return;

    // Call startDelayedHide for each tooltip type (they have internal timeout management)
    // Note: Some tooltips use _startDelayedHide, others use startDelayedHide
    const tooltips = [
      'EnergySummaryTooltip',
      'WaterSummaryTooltip',
      'TempSensorSummaryTooltip',
      'UsersSummaryTooltip',
      'AlarmsSummaryTooltip',
      'NotificationsSummaryTooltip',
    ];

    tooltips.forEach((name) => {
      const tooltip = MyIOLibrary[name];
      if (tooltip) {
        // Try both method names for compatibility
        if (typeof tooltip._startDelayedHide === 'function') {
          tooltip._startDelayedHide();
        } else if (typeof tooltip.startDelayedHide === 'function') {
          tooltip.startDelayedHide();
        }
      }
    });
  }

  /**
   * Show tooltip for filter icon using MyIOLibrary tooltips
   */
  private showFilterTooltip(type: string, shoppingName: string, triggerElement: HTMLElement): void {
    const win = window as any;
    const MyIOLibrary = win.MyIOLibrary;

    if (!MyIOLibrary) {
      if (this.configTemplate.enableDebugMode) {
        console.warn('[MenuView] MyIOLibrary not available for tooltips');
      }
      return;
    }

    // Build tooltip data for this shopping
    const tooltipData = this.buildFilterTooltipData(type, shoppingName);

    switch (type) {
      case 'energy':
        if (MyIOLibrary.EnergySummaryTooltip) {
          MyIOLibrary.EnergySummaryTooltip.show(triggerElement, tooltipData);
        }
        break;
      case 'water':
        if (MyIOLibrary.WaterSummaryTooltip) {
          MyIOLibrary.WaterSummaryTooltip.show(triggerElement, tooltipData);
        }
        break;
      case 'temperature':
        if (MyIOLibrary.TempSensorSummaryTooltip) {
          MyIOLibrary.TempSensorSummaryTooltip.show(triggerElement, tooltipData);
        }
        break;
      case 'users':
        if (MyIOLibrary.UsersSummaryTooltip) {
          MyIOLibrary.UsersSummaryTooltip.show(triggerElement, tooltipData);
        }
        break;
      case 'alarms':
        if (MyIOLibrary.AlarmsSummaryTooltip) {
          MyIOLibrary.AlarmsSummaryTooltip.show(triggerElement, tooltipData);
        }
        break;
      case 'notifications':
        if (MyIOLibrary.NotificationsSummaryTooltip) {
          MyIOLibrary.NotificationsSummaryTooltip.show(triggerElement, tooltipData);
        }
        break;
    }
  }

  /**
   * Get device counts for a shopping
   */
  private getShoppingDeviceCounts(shoppingName: string): {
    users: number;
    alarms: number;
    notifications: number;
    energy: number;
    water: number;
    temperature: number;
  } {
    const win = window as any;
    const orchestratorData = win.MyIOOrchestratorData;

    const normalizedName = shoppingName.toLowerCase().trim();

    const filterByOwner = (items: any[]): any[] => {
      if (!items || !Array.isArray(items)) return [];
      return items.filter((d: any) => {
        const ownerName = (d.ownerName || d.customerName || '').toLowerCase().trim();
        return (
          ownerName === normalizedName ||
          ownerName.includes(normalizedName) ||
          normalizedName.includes(ownerName)
        );
      });
    };

    const energyItems = filterByOwner(orchestratorData?.energy?.items || []);
    const waterItems = filterByOwner(orchestratorData?.water?.items || []);
    const temperatureItems = filterByOwner(orchestratorData?.temperature?.items || []);

    return {
      users: 0,
      alarms: 0,
      notifications: 0,
      energy: energyItems.length,
      water: waterItems.length,
      temperature: temperatureItems.length,
    };
  }

  /**
   * Build tooltip data for a shopping
   */
  private buildFilterTooltipData(type: string, shoppingName: string): any {
    const now = new Date().toISOString();
    const win = window as any;
    const orchestratorData = win.MyIOOrchestratorData;

    // Helper to filter devices by shopping name
    const filterByOwner = (items: any[]): any[] => {
      if (!items || !Array.isArray(items)) return [];
      const normalizedName = shoppingName.toLowerCase().trim();
      return items.filter((d: any) => {
        const ownerName = (d.ownerName || d.customerName || '').toLowerCase().trim();
        return (
          ownerName === normalizedName ||
          ownerName.includes(normalizedName) ||
          normalizedName.includes(ownerName)
        );
      });
    };

    // Get filtered devices
    const energyItems = filterByOwner(orchestratorData?.energy?.items || []);
    const waterItems = filterByOwner(orchestratorData?.water?.items || []);
    const temperatureItems = filterByOwner(orchestratorData?.temperature?.items || []);

    switch (type) {
      case 'energy':
        return {
          totalDevices: energyItems.length,
          totalConsumption: energyItems.reduce(
            (sum: number, d: any) => sum + Number(d.value || d.consumption || 0),
            0
          ),
          unit: 'kWh',
          byCategory: [
            {
              id: 'equipamentos',
              name: 'Equipamentos',
              icon: '⚡',
              deviceCount: energyItems.length,
              consumption: 0,
              percentage: 0,
            },
          ],
          byStatus: { normal: energyItems.length, offline: 0, alert: 0 },
          lastUpdated: now,
          customerName: shoppingName,
        };
      case 'water':
        return {
          totalDevices: waterItems.length,
          totalConsumption: waterItems.reduce(
            (sum: number, d: any) => sum + Number(d.value || d.pulses || 0),
            0
          ),
          unit: 'm³',
          byCategory: [
            {
              id: 'hidrometros',
              name: 'Hidrômetros',
              icon: '💧',
              deviceCount: waterItems.length,
              consumption: 0,
              percentage: 0,
            },
          ],
          byStatus: { normal: waterItems.length, offline: 0, alert: 0 },
          lastUpdated: now,
          customerName: shoppingName,
        };
      case 'temperature':
        return {
          devices: temperatureItems.slice(0, 10).map((d: any) => ({
            name: d.label || d.name || 'Sensor',
            temp: Number(d.temperature || 0),
            status: Number(d.temperature || 0) > 26 || Number(d.temperature || 0) < 18 ? 'warn' : 'ok',
          })),
          temperatureMin: 18,
          temperatureMax: 26,
          lastUpdated: now,
          customerName: shoppingName,
        };
      case 'users':
        return {
          totalUsers: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          byRole: { admin: 0, operator: 0, viewer: 0 },
          lastUpdated: now,
          customerName: shoppingName,
        };
      case 'alarms':
        return {
          totalAlarms: 0,
          activeAlarms: 0,
          acknowledgedAlarms: 0,
          bySeverity: { critical: 0, warning: 0, info: 0 },
          lastUpdated: now,
          customerName: shoppingName,
        };
      case 'notifications':
        return {
          totalNotifications: 0,
          unreadNotifications: 0,
          readNotifications: 0,
          byType: { system: 0, alert: 0, info: 0, success: 0 },
          lastUpdated: now,
          customerName: shoppingName,
        };
      default:
        return {};
    }
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

    this.root.querySelectorAll('.tab[data-tab-id]').forEach((tab) => {
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

    this.filterModalHeaderController?.destroy();
    this.filterModalHeaderController = null;

    this.unifiedModalHeaderController?.destroy();
    this.unifiedModalHeaderController = null;

    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  /**
   * Set the theme mode (light or dark)
   */
  public setThemeMode(mode: MenuThemeMode): void {
    // Guard: Avoid loop if theme is already the same
    if (this.themeMode === mode) return;

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
