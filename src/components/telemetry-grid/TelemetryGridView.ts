/**
 * RFC-0121: TelemetryGrid View
 * Handles rendering for the TelemetryGrid component
 */

import {
  TelemetryDevice,
  TelemetryDomain,
  TelemetryContext,
  ThemeMode,
  TelemetryGridParams,
  TelemetryStats,
  Shopping,
  DOMAIN_CONFIG,
  CONTEXT_CONFIG,
  TelemetryGridEventType,
  TelemetryGridEventHandler,
  HeaderController,
  FilterModalController,
  DomainConfig,
} from './types';
import { TelemetryGridController } from './TelemetryGridController';
import { injectTelemetryGridStyles } from './styles';

// Type definitions for external libraries
interface CardRenderOptions {
  entityObject: TelemetryDevice;
  debugActive?: boolean;
  activeTooltipDebug?: boolean;
  delayTimeConnectionInMins?: number;
  isSelected?: boolean | (() => boolean);
  handleActionDashboard?: () => void;
  handleActionReport?: () => void;
  handleActionSettings?: () => void;
  handleSelect?: (checked: boolean, entity: TelemetryDevice) => void;
  handleClickCard?: (ev: Event, entity: TelemetryDevice) => void;
  useNewComponents?: boolean;
  enableSelection?: boolean;
  enableDragDrop?: boolean;
  hideInfoMenuItem?: boolean;
}

interface CardInstance {
  destroy?: () => void;
}

export class TelemetryGridView {
  private container: HTMLElement;
  private element: HTMLElement | null = null;
  private params: TelemetryGridParams;
  private controller: TelemetryGridController;
  private eventHandlers = new Map<
    TelemetryGridEventType,
    Set<TelemetryGridEventHandler>
  >();
  private activeCardComponents: CardInstance[] = [];
  private headerController: HeaderController | null = null;
  private filterModalController: FilterModalController | null = null;
  private lastFilterModalDomain: TelemetryDomain | null = null;
  private searchInput: HTMLInputElement | null = null;

  constructor(
    params: TelemetryGridParams,
    controller: TelemetryGridController
  ) {
    this.container = params.container;
    this.params = params;
    this.controller = controller;

    // Inject styles
    injectTelemetryGridStyles();
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  render(): HTMLElement {
    this.element = document.createElement('div');
    this.element.className = 'telemetry-grid-wrap';
    this.element.id = 'telemetryGridWrap';

    // Apply initial theme and domain
    this.applyDomainTheme(this.controller.getDomain());
    this.applyContextAttribute(this.controller.getContext());
    this.applyThemeMode(this.controller.getThemeMode());

    // Build structure
    this.element.innerHTML = this.buildTemplate();

    // Setup header
    this.setupHeader();

    // Setup event listeners
    this.setupEventListeners();

    // Mount to container
    this.container.appendChild(this.element);

    // Render initial cards
    this.renderCards(this.controller.getFilteredDevices());

    return this.element;
  }

  private buildTemplate(): string {
    const domainConfig = DOMAIN_CONFIG[this.controller.getDomain()];

    return `
      <!-- Toolbar with filter chips and controls -->
      <div class="telemetry-grid-toolbar">
        <div class="telemetry-shopping-chips" id="telemetryShoppingChips"></div>
        <div class="telemetry-realtime-controls" id="telemetryRealtimeControls">
          <!-- Domain-specific controls will be injected here -->
        </div>
      </div>

      <!-- Header injected dynamically via buildHeaderDevicesGrid -->
      <div class="telemetry-grid-header" id="telemetryGridHeader"></div>

      <!-- Loading overlay -->
      <div id="telemetryLoadingOverlay" class="telemetry-loading-overlay" style="display: none">
        <div class="telemetry-loading-spinner">
          <svg style="width: 48px; height: 48px" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none"
                stroke="var(--telemetry-primary)"
                stroke-width="5"
                stroke-linecap="round"
                stroke-dasharray="90,150"
                stroke-dashoffset="0"></circle>
          </svg>
          <p id="telemetryLoadingText">${domainConfig.loadingText}</p>
        </div>
      </div>

      <!-- Cards Grid -->
      <section class="telemetry-grid-section" id="telemetryGridSection">
        <div id="telemetryCardsGrid" class="telemetry-cards-grid"></div>
      </section>
    `;
  }

  private setupHeader(): void {
    const headerContainer = this.element?.querySelector('#telemetryGridHeader');
    if (!headerContainer) return;

    const buildHeaderDevicesGrid =
      this.params.buildHeaderDevicesGrid ||
      ((window as unknown as Record<string, Record<string, unknown>>).MyIOUtils
        ?.buildHeaderDevicesGrid as
        | ((config: unknown) => HeaderController | null)
        | undefined);

    if (!buildHeaderDevicesGrid) {
      this.log('buildHeaderDevicesGrid not available');
      return;
    }

    const contextConfig = CONTEXT_CONFIG[this.controller.getContext()];
    const domainConfig = DOMAIN_CONFIG[this.controller.getDomain()];

    this.headerController = buildHeaderDevicesGrid({
      container: headerContainer as HTMLElement,
      domain: this.controller.getDomain(),
      idPrefix: contextConfig.idPrefix,
      themeMode: this.controller.getThemeMode(), // RFC-0125: Pass theme from controller
      labels: {
        total: contextConfig.headerLabel,
        consumption: domainConfig.headerLabel,
      },
      includeSearch: this.params.includeSearch !== false,
      includeFilter: this.params.includeFilter !== false,
      onSearchClick: () => {
        this.emit('filter-click');
      },
      onFilterClick: () => {
        this.openFilterModal();
      },
    });

    // RFC-0140 FIX: Setup search input listener after a short delay
    // to ensure the DOM is ready (buildHeaderDevicesGrid uses setTimeout internally)
    setTimeout(() => {
      this.searchInput = this.headerController?.getSearchInput() || null;
      this.log('Search input element:', this.searchInput ? 'found' : 'not found');

      if (this.searchInput) {
        this.searchInput.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement;
          this.log('Search input changed:', target.value);
          this.controller.setSearchTerm(target.value || '');
          this.emit('search-change', target.value);
        });
        this.log('Search input listener attached');
      }
    }, 50);

    // Update header with initial data
    if (this.headerController) {
      this.headerController.updateFromDevices(
        this.controller.getFilteredDevices(),
        {}
      );
    }

    this.log('Header built via buildHeaderDevicesGrid');
  }

  private setupEventListeners(): void {
    // Controller state changes trigger re-render
    this.controller.setOnStateChange((state) => {
      this.renderCards(state.filteredDevices);

      // Update header
      if (this.headerController) {
        this.headerController.updateFromDevices(state.filteredDevices, {});
      }
    });
  }

  // =========================================================================
  // Card Rendering
  // =========================================================================

  renderCards(devices: TelemetryDevice[]): void {
    // Cleanup old card instances
    this.destroyCards();

    const grid = this.element?.querySelector('#telemetryCardsGrid');
    if (!grid) {
      this.log('Cards grid container not found');
      return;
    }

    grid.innerHTML = '';

    if (devices.length === 0) {
      this.renderEmptyState(grid as HTMLElement);
      return;
    }

    const domainConfig = DOMAIN_CONFIG[this.controller.getDomain()];
    const delayTimeConnectionInMins = domainConfig.delayMins;

    const renderCardComponentHeadOffice = (
      window as unknown as Record<string, Record<string, unknown>>
    ).MyIOLibrary?.renderCardComponentHeadOffice as
      | ((container: HTMLElement, options: CardRenderOptions) => CardInstance)
      | undefined;

    if (!renderCardComponentHeadOffice) {
      this.log('renderCardComponentHeadOffice not available');
      this.renderFallbackCards(grid as HTMLElement, devices);
      return;
    }

    const currentDomain = this.controller.getDomain();

    devices.forEach((device) => {
      const container = document.createElement('div');
      grid.appendChild(container);

      // Ensure customer name is set
      const getCustomerName = (
        window as unknown as Record<string, Record<string, unknown>>
      ).MyIOUtils?.getCustomerNameForDevice as
        | ((device: TelemetryDevice) => string)
        | undefined;
      if (getCustomerName && !device.customerName) {
        device.customerName = getCustomerName(device);
      }

      // Transform device for domain-specific rendering
      const entityObject = this.prepareEntityObjectForDomain(device, currentDomain, domainConfig);

      const cardInstance = renderCardComponentHeadOffice(container, {
        entityObject,
        debugActive: this.params.debugActive,
        activeTooltipDebug: this.params.activeTooltipDebug,
        delayTimeConnectionInMins,

        isSelected: () => this.controller.isDeviceSelected(device.entityId),

        handleActionDashboard: () => {
          this.log('Dashboard action for:', device.entityId);
          this.params.onCardAction?.('dashboard', device);
        },

        handleActionReport: () => {
          this.log('Report action for:', device.entityId);
          this.params.onCardAction?.('report', device);
        },

        handleActionSettings: () => {
          this.log('Settings action for:', device.entityId);
          this.params.onCardAction?.('settings', device);
        },

        handleSelect: (checked: boolean, entity: TelemetryDevice) => {
          if (checked) {
            this.controller.selectDevice(entity.entityId, entity);
          } else {
            this.controller.deselectDevice(entity.entityId, entity);
          }
        },

        handleClickCard: (ev: Event, entity: TelemetryDevice) => {
          this.log('Card clicked:', entity.labelOrName);
          this.params.onCardClick?.(entity);
          this.emit('device-click', entity);
        },

        useNewComponents: this.params.useNewComponents ?? true,
        enableSelection: this.params.enableSelection ?? true,
        enableDragDrop: this.params.enableDragDrop ?? true,
        hideInfoMenuItem: this.params.hideInfoMenuItem ?? true,
      });

      this.activeCardComponents.push(cardInstance);
    });

    this.log(
      `Cards rendered: ${devices.length} ${this.controller.getDomain()} devices (${this.controller.getContext()} context)`
    );
    this.emit('cards-rendered', devices.length);
  }

  private renderEmptyState(container: HTMLElement): void {
    const domainConfig = DOMAIN_CONFIG[this.controller.getDomain()];

    container.innerHTML = `
      <div class="telemetry-empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <h3>Nenhum dispositivo encontrado</h3>
        <p>Nao ha dispositivos ${domainConfig.cacheKey} para exibir no momento.</p>
      </div>
    `;
  }

  private renderFallbackCards(
    container: HTMLElement,
    devices: TelemetryDevice[]
  ): void {
    // Simple fallback rendering if renderCardComponentHeadOffice is not available
    devices.forEach((device) => {
      const card = document.createElement('div');
      card.className = 'telemetry-card';
      card.innerHTML = `
        <div style="font-weight: 600;">${device.labelOrName || 'Unknown'}</div>
        <div style="font-size: 12px; color: var(--ink-2);">${device.deviceIdentifier || '-'}</div>
        <div style="font-size: 14px; font-weight: 500; color: var(--telemetry-primary-dark);">
          ${DOMAIN_CONFIG[this.controller.getDomain()].formatValue(device.val)}
        </div>
        <div style="font-size: 11px; color: var(--ink-2);">Status: ${device.deviceStatus}</div>
      `;
      container.appendChild(card);
    });
  }

  private destroyCards(): void {
    if (Array.isArray(this.activeCardComponents)) {
      this.activeCardComponents.forEach((comp) => {
        if (comp && typeof comp.destroy === 'function') {
          comp.destroy();
        }
      });
      this.activeCardComponents = [];
    }
  }

  /**
   * Prepare entity object for domain-specific card rendering.
   * Temperature cards need different field mappings than energy/water cards.
   */
  private prepareEntityObjectForDomain(
    device: TelemetryDevice,
    domain: TelemetryDomain,
    domainConfig: DomainConfig
  ): TelemetryDevice {
    // For temperature domain, map temperature value to val and set correct metadata
    if (domain === 'temperature') {
      const tempValue = device.temperature ?? device.val ?? null;
      return {
        ...device,
        // Temperature value fields (card component uses val/lastValue)
        val: tempValue,
        lastValue: tempValue,
        temperatureC: tempValue,
        currentTemperature: tempValue,
        // Card metadata for temperature rendering
        valType: 'temperature',
        unit: '°C',
        icon: 'temperature',
        // Keep domain and context
        domain: 'temperature',
      };
    }

    // For water domain, ensure correct metadata
    if (domain === 'water') {
      return {
        ...device,
        valType: 'water',
        unit: 'm³',
        icon: 'water',
        domain: 'water',
      };
    }

    // For energy domain (default), ensure correct metadata
    return {
      ...device,
      valType: 'energy',
      unit: 'kWh',
      icon: 'energy',
      domain: 'energy',
    };
  }

  // =========================================================================
  // Shopping Chips
  // =========================================================================

  renderShoppingChips(shoppings: Shopping[]): void {
    const chipsContainer = this.element?.querySelector(
      '#telemetryShoppingChips'
    );
    if (!chipsContainer) return;

    chipsContainer.innerHTML = '';

    if (!shoppings || shoppings.length === 0) {
      return;
    }

    const contextConfig = CONTEXT_CONFIG[this.controller.getContext()];

    shoppings.forEach((shopping) => {
      const chip = document.createElement('span');
      chip.className = 'filter-chip';
      chip.innerHTML = `<span class="filter-chip-icon">${contextConfig.filterChipIcon}</span><span>${shopping.name}</span>`;
      chipsContainer.appendChild(chip);
    });

    this.log('Rendered', shoppings.length, 'shopping filter chips');
  }

  // =========================================================================
  // Loading Overlay
  // =========================================================================

  showLoading(show: boolean, message?: string): void {
    const overlay = this.element?.querySelector('#telemetryLoadingOverlay');
    const textEl = this.element?.querySelector('#telemetryLoadingText');

    if (overlay) {
      (overlay as HTMLElement).style.display = show ? 'flex' : 'none';
      if (textEl && message) {
        textEl.textContent = message;
      }
    }
  }

  // =========================================================================
  // Theme and Domain
  // =========================================================================

  applyDomainTheme(domain: TelemetryDomain): void {
    if (this.element) {
      this.element.setAttribute('data-domain', domain);
      this.log(`Applied ${domain} theme`);
    }

    // Update header domain to use correct unit formatting
    if (this.headerController?.setDomain) {
      this.headerController.setDomain(domain);
      this.log(`Updated header domain to ${domain}`);
    }
  }

  applyContextAttribute(context: TelemetryContext): void {
    if (this.element) {
      this.element.setAttribute('data-context', context);
      this.log(`Applied ${context} context`);
    }
  }

  applyThemeMode(themeMode: ThemeMode): void {
    if (this.element) {
      this.element.setAttribute('data-theme', themeMode);
      this.log(`Applied ${themeMode} theme mode`);
    }
  }

  // =========================================================================
  // Filter Modal
  // =========================================================================

  openFilterModal(): void {
    this.log('openFilterModal called');

    // Check params first, then fallback to window.MyIOUtils
    const paramsCreateFilterModal = this.params.createFilterModal;
    const windowCreateFilterModal = (
      window as unknown as Record<string, Record<string, unknown>>
    ).MyIOUtils?.createFilterModal as
      | ((config: unknown) => FilterModalController | null)
      | undefined;

    this.log('createFilterModal sources:', {
      fromParams: !!paramsCreateFilterModal,
      fromWindow: !!windowCreateFilterModal,
      myIOUtilsExists: !!(window as unknown as Record<string, unknown>).MyIOUtils,
    });

    const createFilterModal = paramsCreateFilterModal || windowCreateFilterModal;

    if (!createFilterModal) {
      this.log('createFilterModal not available');
      return;
    }

    this.log('createFilterModal found, creating modal...');

    const currentDomain = this.controller.getDomain();
    const contextConfig = CONTEXT_CONFIG[this.controller.getContext()];
    const domainConfig = DOMAIN_CONFIG[currentDomain];

    // Recreate filter modal if domain changed (to use correct formatValue)
    if (this.filterModalController && this.lastFilterModalDomain !== currentDomain) {
      this.log(`Domain changed from ${this.lastFilterModalDomain} to ${currentDomain}, recreating filter modal`);
      if (typeof this.filterModalController.destroy === 'function') {
        this.filterModalController.destroy();
      }
      this.filterModalController = null;
    }

    if (!this.filterModalController) {
      this.lastFilterModalDomain = currentDomain;

      this.filterModalController = createFilterModal({
        widgetName: contextConfig.widgetName,
        containerId: `${contextConfig.idPrefix}FilterModalGlobal`,
        modalClass: 'telemetry-modal',
        primaryColor: this.getCSSVariableValue('--telemetry-primary') || '#f59e0b',
        itemIdAttr: 'data-device-id',
        themeMode: this.controller.getThemeMode(), // RFC-0125: Pass theme from controller
        filterTabs: [
          { id: 'all', label: 'Todos', filter: () => true },
          {
            id: 'online',
            label: 'Online',
            filter: (d: TelemetryDevice) => {
              const status = (d.deviceStatus || '').toLowerCase();
              return status === 'power_on' || status === 'normal' || status === 'standby' || status === 'alert';
            },
          },
          {
            id: 'offline',
            label: 'Offline',
            filter: (d: TelemetryDevice) => (d.deviceStatus || '').toLowerCase() === 'offline',
          },
          {
            id: 'notInstalled',
            label: 'Nao Instalado',
            filter: (d: TelemetryDevice) => (d.deviceStatus || '').toLowerCase() === 'not_installed',
          },
          {
            id: 'withConsumption',
            label: 'Com Consumo',
            filter: (d: TelemetryDevice) => {
              const consumption = Number(d.val) || Number(d.value) || 0;
              return consumption > 0;
            },
          },
          {
            id: 'noConsumption',
            label: 'Sem Consumo',
            filter: (d: TelemetryDevice) => {
              const consumption = Number(d.val) || Number(d.value) || 0;
              return consumption === 0;
            },
          },
        ],
        getItemId: (d: TelemetryDevice) => d.entityId || '',
        getItemLabel: (d: TelemetryDevice) => d.labelOrName || d.deviceIdentifier || '',
        getItemValue: (d: TelemetryDevice) => Number(d.val) || Number(d.value) || 0,
        getItemSubLabel: (d: TelemetryDevice) => d.customerName || d.ownerName || '',
        formatValue: (val: number) => domainConfig.formatValue ? domainConfig.formatValue(val) : `${val.toFixed(2)}`,
        onApply: (filters) => {
          // RFC-0125: Handle filter apply with both selectedIds and sortMode
          this.log('Filter applied:', filters);
          if (filters.selectedIds !== undefined) {
            this.controller.setDeviceFilter(filters.selectedIds);
          }
          if (filters.sortMode) {
            this.controller.setSortMode(filters.sortMode as 'cons_desc' | 'cons_asc' | 'alpha_asc' | 'alpha_desc' | 'shopping_asc' | 'shopping_desc');
            this.emit('sort-change', filters.sortMode);
          }
        },
        onClose: () => {
          this.log('Filter modal closed');
        },
      });
    }

    if (this.filterModalController) {
      // Recalculate device status before opening modal
      const devices = this.controller.getDevices();
      devices.forEach((device) => {
        device.deviceStatus = this.controller.calculateDeviceStatus(device);
      });
      this.filterModalController.open(devices);
    }
  }

  closeFilterModal(): void {
    this.filterModalController?.close();
  }

  private getCSSVariableValue(varName: string): string | null {
    try {
      if (this.element && window.getComputedStyle) {
        return window
          .getComputedStyle(this.element)
          .getPropertyValue(varName)
          .trim();
      }
    } catch (e) {
      this.log('getCSSVariableValue error:', e);
    }
    return null;
  }

  // =========================================================================
  // Event System
  // =========================================================================

  on(event: TelemetryGridEventType, handler: TelemetryGridEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: TelemetryGridEventType, handler: TelemetryGridEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: TelemetryGridEventType, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }

  // =========================================================================
  // Update Methods
  // =========================================================================

  updateStats(stats: TelemetryStats): void {
    // Update header with new stats if available
    if (this.headerController) {
      this.headerController.updateFromDevices(
        this.controller.getFilteredDevices(),
        {}
      );
    }
  }

  refresh(): void {
    this.renderCards(this.controller.getFilteredDevices());
  }

  // =========================================================================
  // Getters
  // =========================================================================

  getElement(): HTMLElement | null {
    return this.element;
  }

  getSearchInput(): HTMLInputElement | null {
    return this.searchInput;
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  destroy(): void {
    this.log('Destroying view');

    // Destroy cards
    this.destroyCards();

    // Destroy filter modal
    if (
      this.filterModalController &&
      typeof this.filterModalController.destroy === 'function'
    ) {
      this.filterModalController.destroy();
    }
    this.filterModalController = null;

    // Destroy header
    if (
      this.headerController &&
      typeof this.headerController.destroy === 'function'
    ) {
      this.headerController.destroy();
    }
    this.headerController = null;

    // Clear event handlers
    this.eventHandlers.clear();

    // Remove element
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }

  // =========================================================================
  // Debug
  // =========================================================================

  private log(...args: unknown[]): void {
    if (this.params.debugActive) {
      console.log('[TelemetryGridView]', ...args);
    }
  }
}
