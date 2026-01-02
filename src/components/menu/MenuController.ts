/**
 * RFC-0114: Menu Component Library
 * Controller layer - business logic and event coordination
 */

import { MenuView } from './MenuView';
import {
  MenuComponentParams,
  MenuComponentInstance,
  MenuConfigTemplate,
  MenuThemeMode,
  Shopping,
  MenuState,
  DEFAULT_MENU_CONFIG,
  DEFAULT_TABS,
} from './types';

/**
 * Menu Controller - Handles business logic and coordinates between
 * the view layer and external systems (ThingsBoard, MAIN widget)
 */
export class MenuController implements MenuComponentInstance {
  private view: MenuView;
  private state: MenuState;
  private config: Required<MenuConfigTemplate>;
  private params: MenuComponentParams;
  private datePickerInstance: unknown = null;
  private destroyed = false;

  constructor(params: MenuComponentParams) {
    this.params = params;
    this.config = this.mergeConfig(params.configTemplate);

    // Initialize state
    const tabs = params.tabs ?? DEFAULT_TABS;
    const initialTab = params.initialTab ?? tabs[0]?.id ?? 'energy';
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const contextsByTab = new Map<string, string>();
    tabs.forEach((tab) => {
      contextsByTab.set(tab.id, tab.defaultContext ?? tab.contexts[0]?.id ?? '');
    });

    this.state = {
      activeTabId: initialTab,
      contextsByTab,
      dateRange: {
        start: params.initialDateRange?.start ? new Date(params.initialDateRange.start) : startOfMonth,
        end: params.initialDateRange?.end ? new Date(params.initialDateRange.end) : now,
      },
      selectedShoppings: params.shoppings ? [...params.shoppings] : [],
      availableShoppings: params.shoppings ?? [],
      filterModalOpen: false,
    };

    // Create view
    this.view = new MenuView(params);

    // Wire up view events
    this.wireViewEvents();

    if (this.config.enableDebugMode) {
      console.log('[MenuController] Initialized:', {
        state: this.state,
        config: this.config,
      });
    }
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(userConfig?: MenuConfigTemplate): Required<MenuConfigTemplate> {
    return {
      ...DEFAULT_MENU_CONFIG,
      ...userConfig,
    };
  }

  /**
   * Wire up events from the view
   */
  private wireViewEvents(): void {
    // Tab change
    this.view.on('tab-change', (data: unknown) => {
      const { tabId, contextId, target } = data as { tabId: string; contextId: string; target: string };
      this.state.activeTabId = tabId;
      this.state.contextsByTab.set(tabId, contextId);

      this.params.onTabChange?.(tabId, contextId, target);
      this.dispatchCustomEvent('myio:switch-main-state', { targetStateId: target, source: 'menu' });
      this.dispatchCustomEvent('myio:dashboard-state', { domain: tabId, stateId: target });

      if (this.config.enableDebugMode) {
        console.log('[MenuController] Tab changed:', { tabId, contextId, target });
      }
    });

    // Context change
    this.view.on('context-change', (data: unknown) => {
      const { tabId, contextId, target } = data as { tabId: string; contextId: string; target: string };
      this.state.contextsByTab.set(tabId, contextId);

      this.params.onContextChange?.(tabId, contextId, target);
      this.dispatchCustomEvent('myio:switch-main-state', { targetStateId: target, source: 'menu' });
      this.dispatchCustomEvent('myio:dashboard-state', { domain: tabId, stateId: target });

      if (this.config.enableDebugMode) {
        console.log('[MenuController] Context changed:', { tabId, contextId, target });
      }
    });

    // Goals button
    this.view.on('goals', () => {
      this.params.onGoals?.();
      this.dispatchCustomEvent('myio:open-goals-panel', {});

      if (this.config.enableDebugMode) {
        console.log('[MenuController] Goals clicked');
      }
    });

    // Filter apply
    this.view.on('filter-apply', (data: unknown) => {
      const selection = data as Shopping[];
      this.state.selectedShoppings = selection;

      this.params.onFilterApply?.(selection);
      this.dispatchCustomEvent('myio:filter-applied', { selection });

      // Update ThingsBoard scope if available
      if (this.params.ctx?.$scope) {
        this.params.ctx.$scope.custumer = selection;
        this.params.ctx.filterCustom = selection;
        this.params.ctx.$scope.$applyAsync?.();
      }

      if (this.config.enableDebugMode) {
        console.log('[MenuController] Filter applied:', selection);
      }
    });

    // Load button
    this.view.on('load', () => {
      this.params.onLoad?.();
      this.dispatchCustomEvent('myio:request-reload', {});

      if (this.config.enableDebugMode) {
        console.log('[MenuController] Load clicked');
      }
    });

    // Clear button
    this.view.on('clear', () => {
      this.params.onClear?.();
      this.dispatchCustomEvent('myio:force-refresh', {});

      if (this.config.enableDebugMode) {
        console.log('[MenuController] Clear clicked');
      }
    });

    // Shoppings ready (reload request from filter modal)
    this.view.on('shoppings-ready', () => {
      this.dispatchCustomEvent('myio:request-shoppings', {});
    });

    // Theme change
    this.view.on('theme-change', (data: unknown) => {
      const { themeMode } = data as { themeMode: MenuThemeMode };
      this.params.onThemeChange?.(themeMode);
      this.dispatchCustomEvent('myio:theme-change', { themeMode });

      if (this.config.enableDebugMode) {
        console.log('[MenuController] Theme changed:', themeMode);
      }
    });
  }

  /**
   * Initialize the component - render and setup
   */
  public initialize(): HTMLElement {
    const element = this.view.render();

    // Append to container
    this.params.container.appendChild(element);

    // Initialize date picker
    this.initializeDatePicker();

    // Initialize shoppings
    if (this.params.shoppings && this.params.shoppings.length > 0) {
      this.view.updateShoppings(this.params.shoppings);
    }

    return element;
  }

  /**
   * Initialize date picker using library's DateRangePicker if available
   */
  private initializeDatePicker(): void {
    const dateInput = this.view.getDateInput();
    if (!dateInput) return;

    // Check if createDateRangePicker is available from global MyIOLibrary
    const win = window as unknown as { MyIOLibrary?: { createDateRangePicker?: (options: unknown) => unknown } };
    const createDateRangePicker = win.MyIOLibrary?.createDateRangePicker;

    if (createDateRangePicker && typeof createDateRangePicker === 'function') {
      try {
        this.datePickerInstance = createDateRangePicker({
          input: dateInput,
          initialRange: this.state.dateRange,
          locale: this.params.dateLocale ?? 'pt-BR',
          onChange: (start: Date, end: Date) => {
            this.handleDateChange(start, end);
          },
        });

        if (this.config.enableDebugMode) {
          console.log('[MenuController] DateRangePicker initialized');
        }
      } catch (error) {
        console.warn('[MenuController] Failed to initialize DateRangePicker:', error);
        this.setupFallbackDatePicker(dateInput);
      }
    } else {
      this.setupFallbackDatePicker(dateInput);
    }

    // Set initial value display
    this.updateDateDisplay();
  }

  /**
   * Setup fallback date picker (simple date inputs)
   */
  private setupFallbackDatePicker(dateInput: HTMLInputElement): void {
    // Use the input as a clickable trigger that shows a prompt
    dateInput.addEventListener('click', () => {
      // This is a simple fallback - in production, users should include the DateRangePicker
      const startStr = prompt('Data inicial (DD/MM/AAAA):', this.formatDateBR(this.state.dateRange.start));
      if (!startStr) return;

      const endStr = prompt('Data final (DD/MM/AAAA):', this.formatDateBR(this.state.dateRange.end));
      if (!endStr) return;

      const start = this.parseDateBR(startStr);
      const end = this.parseDateBR(endStr);

      if (start && end) {
        this.handleDateChange(start, end);
      }
    });

    if (this.config.enableDebugMode) {
      console.log('[MenuController] Using fallback date picker');
    }
  }

  /**
   * Handle date range change
   */
  private handleDateChange(start: Date, end: Date): void {
    this.state.dateRange = { start, end };

    this.updateDateDisplay();
    this.params.onDateRangeChange?.(start, end);

    // Dispatch custom event with full date info
    const startUtc = start.toISOString();
    const endUtc = end.toISOString();
    const startMs = start.getTime();
    const endMs = end.getTime();

    this.dispatchCustomEvent('myio:update-date', {
      startDate: this.formatDateISO(start),
      endDate: this.formatDateISO(end),
      startUtc,
      endUtc,
      startMs,
      endMs,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    // Update ThingsBoard scope if available
    if (this.params.ctx?.$scope) {
      this.params.ctx.$scope.startDateISO = startUtc;
      this.params.ctx.$scope.endDateISO = endUtc;
      this.params.ctx.$scope.$applyAsync?.();
    }

    if (this.config.enableDebugMode) {
      console.log('[MenuController] Date changed:', { start, end });
    }
  }

  /**
   * Update date display in input
   */
  private updateDateDisplay(): void {
    const dateInput = this.view.getDateInput();
    if (dateInput) {
      const { start, end } = this.state.dateRange;
      dateInput.value = `${this.formatDateBR(start)} - ${this.formatDateBR(end)}`;
    }
  }

  /**
   * Format date as DD/MM/YYYY (Brazilian format)
   */
  private formatDateBR(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Parse date from DD/MM/YYYY format
   */
  private parseDateBR(str: string): Date | null {
    const parts = str.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);

    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return null;

    return date;
  }

  /**
   * Format date as ISO (YYYY-MM-DD)
   */
  private formatDateISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Dispatch a custom event on the document
   */
  private dispatchCustomEvent(eventName: string, detail: unknown): void {
    const event = new CustomEvent(eventName, {
      detail: { ...(detail as object), ts: Date.now() },
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    if (this.config.enableDebugMode) {
      console.log(`[MenuController] Dispatched ${eventName}:`, detail);
    }
  }

  // ==========================================
  // Public API (MenuComponentInstance)
  // ==========================================

  /**
   * Set the active tab by ID
   */
  public setActiveTab(tabId: string): void {
    this.state.activeTabId = tabId;
    this.view.setActiveTab(tabId);
  }

  /**
   * Get the current active tab ID
   */
  public getActiveTab(): string {
    return this.state.activeTabId;
  }

  /**
   * Set the active context for a specific tab
   */
  public setContext(tabId: string, contextId: string): void {
    this.state.contextsByTab.set(tabId, contextId);
    this.view.setContext(tabId, contextId);
  }

  /**
   * Get the current context for a specific tab
   */
  public getContext(tabId: string): string {
    return this.state.contextsByTab.get(tabId) ?? '';
  }

  /**
   * Set the date range
   */
  public setDateRange(start: Date, end: Date): void {
    this.state.dateRange = { start, end };
    this.updateDateDisplay();
  }

  /**
   * Get the current date range
   */
  public getDateRange(): { start: Date; end: Date } {
    return { ...this.state.dateRange };
  }

  /**
   * Open the shopping filter modal
   */
  public openFilterModal(): void {
    this.state.filterModalOpen = true;
    this.view.openFilterModal();
  }

  /**
   * Close the shopping filter modal
   */
  public closeFilterModal(): void {
    this.state.filterModalOpen = false;
    this.view.closeFilterModal();
  }

  /**
   * Get currently selected shoppings
   */
  public getSelectedShoppings(): Shopping[] {
    return this.view.getSelectedShoppings();
  }

  /**
   * Set selected shoppings programmatically
   */
  public setSelectedShoppings(shoppings: Shopping[]): void {
    this.state.selectedShoppings = shoppings;
    this.view.setSelectedShoppings(shoppings);
  }

  /**
   * Update available shoppings list
   */
  public updateShoppings(shoppings: Shopping[]): void {
    this.state.availableShoppings = shoppings;

    // If no selection, select all
    if (this.state.selectedShoppings.length === 0) {
      this.state.selectedShoppings = [...shoppings];
    }

    this.view.updateShoppings(shoppings);

    // Emit event
    this.params.onShoppingsReady?.(shoppings);
    this.dispatchCustomEvent('myio:customers-ready', { count: shoppings.length, customers: shoppings });

    if (this.config.enableDebugMode) {
      console.log('[MenuController] Shoppings updated:', shoppings.length);
    }
  }

  /**
   * Trigger the load action programmatically
   */
  public triggerLoad(): void {
    this.view.emit('load');
  }

  /**
   * Trigger the clear action programmatically
   */
  public triggerClear(): void {
    this.view.emit('clear');
  }

  /**
   * Set the theme mode ('light' or 'dark')
   */
  public setThemeMode(mode: MenuThemeMode): void {
    this.view.setThemeMode(mode);

    if (this.config.enableDebugMode) {
      console.log('[MenuController] Theme mode set to:', mode);
    }
  }

  /**
   * Get the current theme mode
   */
  public getThemeMode(): MenuThemeMode {
    return this.view.getThemeMode();
  }

  /**
   * Destroy the component and clean up resources
   */
  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // Cleanup date picker if it has destroy method
    if (
      this.datePickerInstance &&
      typeof (this.datePickerInstance as { destroy?: () => void }).destroy === 'function'
    ) {
      (this.datePickerInstance as { destroy: () => void }).destroy();
    }

    // Cleanup view
    this.view.destroy();

    if (this.config.enableDebugMode) {
      console.log('[MenuController] Destroyed');
    }
  }

  /**
   * Get the menu component's root DOM element
   */
  public get element(): HTMLElement {
    return this.view.getElement();
  }
}
