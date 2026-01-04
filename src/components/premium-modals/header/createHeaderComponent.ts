/**
 * RFC-0113: Header Component Library
 * Factory function for creating the Header Component
 *
 * Key Differences from openWelcomeModal:
 * - Does NOT create a popup/overlay
 * - Renders INTO a container element (not appends to body)
 * - No backdrop, no close button
 * - Receives data via events rather than fetching
 */

import { HeaderView } from './HeaderView';
import { HeaderFilterModal } from './HeaderFilterModal';
import {
  HeaderComponentParams,
  HeaderComponentInstance,
  CardKPIs,
  CardType,
  Shopping,
  HeaderEventType,
  HeaderEventHandler,
  HeaderThemeMode,
  EquipmentKPI,
  EnergyKPI,
  TemperatureKPI,
  WaterKPI,
} from './types';

// Extend Window interface for MyIOLibrary
declare global {
  interface Window {
    MyIOLibrary?: {
      EnergySummaryTooltip?: {
        show: (trigger: HTMLElement, data: unknown) => void;
        hide: () => void;
      };
      TempSensorSummaryTooltip?: {
        show: (trigger: HTMLElement, data: unknown) => void;
        hide: () => void;
      };
      WaterSummaryTooltip?: {
        show: (trigger: HTMLElement, data: unknown) => void;
        hide: () => void;
      };
      EquipmentSummaryTooltip?: {
        show: (trigger: HTMLElement, data: unknown) => void;
        hide: () => void;
      };
    };
  }
}

/**
 * Create a Header Component instance
 *
 * @param params - Configuration parameters
 * @returns HeaderComponentInstance with methods to update and control the header
 *
 * @example
 * ```typescript
 * const header = createHeaderComponent({
 *   container: document.getElementById('header-mount'),
 *   configTemplate: {
 *     cardEquipamentosBackgroundColor: '#1F3A35',
 *     cardEquipamentosFontColor: '#F2F2F2',
 *   },
 *   onFilterApply: (selection) => {
 *     console.log('Filter applied:', selection);
 *   },
 *   onBackClick: () => {
 *     window.location.href = '/dashboards/welcome';
 *   }
 * });
 *
 * // Listen for orchestrator events
 * window.addEventListener('myio:energy-summary-ready', (e) => {
 *   header.updateEnergyKPI(e.detail);
 * });
 * ```
 */
export function createHeaderComponent(params: HeaderComponentParams): HeaderComponentInstance {
  const { container } = params;

  // Validate container
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('[HeaderComponent] Invalid container element. Please provide a valid HTMLElement.');
  }

  // Create view
  const view = new HeaderView(params);
  const element = view.render();

  // Create filter modal (lazy initialization)
  let filterModal: HeaderFilterModal | null = null;

  // Event handlers map
  const eventHandlers = new Map<HeaderEventType, Set<HeaderEventHandler>>();

  // Current state
  let currentShoppings: Shopping[] = params.shoppings || [];
  let selectedShoppings: Shopping[] = [];
  const tooltipData: Record<CardType, unknown> = {
    equipment: null,
    energy: null,
    temperature: null,
    water: null,
  };

  // Debug mode
  const debug = params.configTemplate?.enableDebugMode ?? false;
  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[HeaderComponent]', ...args);
    }
  };

  /**
   * Emit an event to registered handlers
   */
  function emit(event: HeaderEventType, ...args: unknown[]): void {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }

  // =========================================================================
  // Wire up view events
  // =========================================================================

  view.on('back-click', () => {
    log('Back button clicked');

    // Call user callback
    params.onBackClick?.();

    // Dispatch event to open welcome modal
    window.dispatchEvent(new CustomEvent('myio:open-welcome-modal', {
      detail: { source: 'header-back-button', timestamp: Date.now() }
    }));

    emit('back-click');
  });

  view.on('card-click', (cardType: CardType) => {
    log('Card clicked:', cardType);
    params.onCardClick?.(cardType);
    emit('card-click', cardType);
  });

  view.on('card-hover', (cardType: CardType, isHovering: boolean, triggerElement: HTMLElement) => {
    if (isHovering && params.enableTooltips !== false) {
      showTooltipForCard(cardType, triggerElement);
    }
    params.onCardHover?.(cardType, isHovering);
    emit('card-hover', cardType, isHovering);
  });

  // =========================================================================
  // Tooltip integration (RFC-0105)
  // =========================================================================

  /**
   * Normalize energy data to the format expected by EnergySummaryTooltip
   * RFC-0121: Ensures byStatus and byCategory exist with all required properties
   */
  function normalizeEnergyData(data: unknown): unknown {
    const d = data as Record<string, unknown>;
    // If data already has proper byStatus object, return as-is
    if (d.byStatus && typeof d.byStatus === 'object') {
      return data;
    }

    // Default status object
    const defaultStatus = {
      waiting: 0,
      weakConnection: 0,
      offline: 0,
      normal: 0,
      alert: 0,
      failure: 0,
      standby: 0,
      noConsumption: 0,
      waitingDevices: [],
      weakConnectionDevices: [],
      offlineDevices: [],
      normalDevices: [],
      alertDevices: [],
      failureDevices: [],
      standbyDevices: [],
      noConsumptionDevices: [],
    };

    // Create normalized data with default byStatus and byCategory
    return {
      totalDevices: d.totalDevices ?? d.deviceCount ?? 0,
      totalConsumption: d.customerTotal ?? d.totalConsumption ?? 0,
      unit: d.unit ?? 'kWh',
      // EnergySummaryTooltip expects byCategory (array) not categories
      byCategory: d.byCategory ?? d.categories ?? [],
      // EnergySummaryTooltip expects byStatus (object) not status
      byStatus: {
        ...defaultStatus,
        ...((d.byStatus as object) || (d.status as object) || {}),
      },
      // Pass through other properties
      equipmentsTotal: d.equipmentsTotal,
      lojasTotal: d.lojasTotal,
      customerTotal: d.customerTotal,
      unfilteredTotal: d.unfilteredTotal,
      isFiltered: d.isFiltered,
    };
  }

  /**
   * Normalize water data to the format expected by WaterSummaryTooltip
   * RFC-0121: Ensures byStatus and byCategory exist with all required properties
   */
  function normalizeWaterData(data: unknown): unknown {
    const d = data as Record<string, unknown>;
    // If data already has proper byStatus object, return as-is
    if (d.byStatus && typeof d.byStatus === 'object') {
      return data;
    }

    // Default status object
    const defaultStatus = {
      waiting: 0,
      weakConnection: 0,
      offline: 0,
      normal: 0,
      alert: 0,
      failure: 0,
      standby: 0,
      noConsumption: 0,
      waitingDevices: [],
      weakConnectionDevices: [],
      offlineDevices: [],
      normalDevices: [],
      alertDevices: [],
      failureDevices: [],
      standbyDevices: [],
      noConsumptionDevices: [],
    };

    // Create normalized data with default byStatus and byCategory
    return {
      totalDevices: d.totalDevices ?? d.deviceCount ?? 0,
      totalConsumption: d.filteredTotal ?? d.totalConsumption ?? 0,
      unit: d.unit ?? 'm³',
      // WaterSummaryTooltip expects byCategory (array) not categories
      byCategory: d.byCategory ?? d.categories ?? [],
      // WaterSummaryTooltip expects byStatus (object) not status
      byStatus: {
        ...defaultStatus,
        ...((d.byStatus as object) || (d.status as object) || {}),
      },
      // Pass through other properties
      filteredTotal: d.filteredTotal,
      unfilteredTotal: d.unfilteredTotal,
      commonArea: d.commonArea,
      stores: d.stores,
      isFiltered: d.isFiltered,
    };
  }

  /**
   * Normalize temperature data to the format expected by TempSensorSummaryTooltip
   * RFC-0121: Ensures devices array exists
   */
  function normalizeTemperatureData(data: unknown): unknown {
    const d = data as Record<string, unknown>;
    // If data already has proper devices array, return as-is
    if (Array.isArray(d.devices) && d.devices.length > 0) {
      return data;
    }
    // Create normalized data
    return {
      ...d,
      devices: d.devices ?? [],
      globalAvg: d.globalAvg,
      filteredAvg: d.filteredAvg,
      shoppingsInRange: d.shoppingsInRange ?? [],
      shoppingsOutOfRange: d.shoppingsOutOfRange ?? [],
      shoppingsUnknownRange: d.shoppingsUnknownRange ?? [],
    };
  }

  function showTooltipForCard(cardType: CardType, triggerElement: HTMLElement): void {
    const data = tooltipData[cardType];
    if (!data) {
      log('No tooltip data for card:', cardType);
      return;
    }

    const lib = window.MyIOLibrary;
    if (!lib) {
      log('MyIOLibrary not available for tooltips');
      return;
    }

    switch (cardType) {
      case 'equipment':
        // EquipmentSummaryTooltip may not exist yet
        if (lib.EquipmentSummaryTooltip) {
          lib.EquipmentSummaryTooltip.show(triggerElement, data);
        } else {
          log('EquipmentSummaryTooltip not available');
        }
        break;
      case 'energy':
        if (lib.EnergySummaryTooltip) {
          const normalizedData = normalizeEnergyData(data);
          log('Showing energy tooltip with normalized data:', normalizedData);
          lib.EnergySummaryTooltip.show(triggerElement, normalizedData);
        }
        break;
      case 'temperature':
        if (lib.TempSensorSummaryTooltip) {
          const normalizedData = normalizeTemperatureData(data);
          log('Showing temperature tooltip with normalized data:', normalizedData);
          lib.TempSensorSummaryTooltip.show(triggerElement, normalizedData);
        }
        break;
      case 'water':
        if (lib.WaterSummaryTooltip) {
          const normalizedData = normalizeWaterData(data);
          log('Showing water tooltip with normalized data:', normalizedData);
          lib.WaterSummaryTooltip.show(triggerElement, normalizedData);
        }
        break;
    }
  }

  // =========================================================================
  // Global event listeners (orchestrator events)
  // =========================================================================

  function handleEnergySummary(ev: Event): void {
    const data = (ev as CustomEvent).detail as EnergyKPI;
    log('Energy summary received:', data);
    tooltipData.energy = data;
    view.updateEnergyCard(data);
  }

  function handleWaterSummary(ev: Event): void {
    const data = (ev as CustomEvent).detail as WaterKPI;
    log('Water summary received:', data);
    tooltipData.water = data;
    view.updateWaterCard(data);
  }

  function handleTemperatureData(ev: Event): void {
    const data = (ev as CustomEvent).detail as TemperatureKPI;
    log('Temperature data received:', data);
    tooltipData.temperature = data;
    view.updateTemperatureCard(data);
  }

  function handleEquipmentCount(ev: Event): void {
    const data = (ev as CustomEvent).detail as EquipmentKPI;
    log('Equipment count received:', data);
    tooltipData.equipment = data;
    view.updateEquipmentCard(data);
  }

  function handleShoppingsData(ev: Event): void {
    const { shoppings = [] } = (ev as CustomEvent).detail || {};
    log('Shoppings data received:', shoppings.length);
    currentShoppings = shoppings;
    filterModal?.updateShoppings(shoppings);
  }

  function setupEventListeners(): void {
    window.addEventListener('myio:energy-summary-ready', handleEnergySummary);
    window.addEventListener('myio:water-summary-ready', handleWaterSummary);
    window.addEventListener('myio:temperature-data-ready', handleTemperatureData);
    window.addEventListener('myio:equipment-count-updated', handleEquipmentCount);
    window.addEventListener('myio:shoppings-data-ready', handleShoppingsData);
    log('Event listeners registered');
  }

  function removeEventListeners(): void {
    window.removeEventListener('myio:energy-summary-ready', handleEnergySummary);
    window.removeEventListener('myio:water-summary-ready', handleWaterSummary);
    window.removeEventListener('myio:temperature-data-ready', handleTemperatureData);
    window.removeEventListener('myio:equipment-count-updated', handleEquipmentCount);
    window.removeEventListener('myio:shoppings-data-ready', handleShoppingsData);
    log('Event listeners removed');
  }

  // =========================================================================
  // Filter modal methods
  // =========================================================================

  function openFilterModal(): void {
    if (!filterModal) {
      filterModal = new HeaderFilterModal({
        shoppings: currentShoppings,
        selectedShoppings,
        onApply: (selection) => {
          selectedShoppings = selection;
          params.onFilterApply?.(selection);
          emit('filter-applied', selection);

          // Dispatch global event for other widgets
          window.dispatchEvent(
            new CustomEvent('myio:filter-applied', {
              detail: { selection, ts: Date.now() },
            })
          );
        },
        onClose: () => {
          emit('filter-modal-close');
        },
      });
    }
    filterModal.open();
    emit('filter-modal-open');
  }

  function closeFilterModal(): void {
    filterModal?.close();
  }

  // =========================================================================
  // Instance methods
  // =========================================================================

  function updateKPIs(kpis: Partial<CardKPIs>): void {
    if (kpis.equip) {
      tooltipData.equipment = kpis.equip;
      view.updateEquipmentCard(kpis.equip);
    }
    if (kpis.energy) {
      tooltipData.energy = kpis.energy;
      view.updateEnergyCard(kpis.energy);
    }
    if (kpis.temp) {
      tooltipData.temperature = kpis.temp;
      view.updateTemperatureCard(kpis.temp);
    }
    if (kpis.water) {
      tooltipData.water = kpis.water;
      view.updateWaterCard(kpis.water);
    }
  }

  function updateEquipmentKPI(data: EquipmentKPI): void {
    tooltipData.equipment = data;
    view.updateEquipmentCard(data);
  }

  function updateEnergyKPI(data: EnergyKPI): void {
    tooltipData.energy = data;
    view.updateEnergyCard(data);
  }

  function updateTemperatureKPI(data: TemperatureKPI): void {
    tooltipData.temperature = data;
    view.updateTemperatureCard(data);
  }

  function updateWaterKPI(data: WaterKPI): void {
    tooltipData.water = data;
    view.updateWaterCard(data);
  }

  function updateTooltipData(cardType: CardType, data: unknown): void {
    tooltipData[cardType] = data;
  }

  function updateShoppings(shoppings: Shopping[]): void {
    currentShoppings = shoppings;
    filterModal?.updateShoppings(shoppings);
  }

  function getSelectedShoppings(): Shopping[] {
    return [...selectedShoppings];
  }

  function setSelectedShoppings(shoppings: Shopping[]): void {
    selectedShoppings = shoppings;
  }

  // =========================================================================
  // Theme methods
  // =========================================================================

  function setThemeMode(mode: HeaderThemeMode): void {
    log('Setting theme mode:', mode);
    view.setThemeMode(mode);
  }

  function getThemeMode(): HeaderThemeMode {
    return view.getThemeMode();
  }

  function destroy(): void {
    log('Destroying component');

    // Remove event listeners
    removeEventListeners();

    // Destroy filter modal
    filterModal?.destroy();
    filterModal = null;

    // Destroy view
    view.destroy();

    // Clear event handlers
    eventHandlers.clear();
  }

  function on(event: HeaderEventType, handler: HeaderEventHandler): void {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, new Set());
    }
    eventHandlers.get(event)!.add(handler);
  }

  function off(event: HeaderEventType, handler: HeaderEventHandler): void {
    eventHandlers.get(event)?.delete(handler);
  }

  // =========================================================================
  // Initialize
  // =========================================================================

  // Setup event listeners
  setupEventListeners();

  // Append to container
  container.appendChild(element);
  log('Component mounted');

  // Request initial data from orchestrator
  window.dispatchEvent(new CustomEvent('myio:request-shoppings-data'));

  // Apply initial KPIs if provided
  if (params.initialKPIs) {
    updateKPIs(params.initialKPIs);
  }

  // =========================================================================
  // Return instance
  // =========================================================================

  return {
    // Update methods
    updateKPIs,
    updateEquipmentKPI,
    updateEnergyKPI,
    updateTemperatureKPI,
    updateWaterKPI,
    updateTooltipData,

    // Shopping/Filter
    updateShoppings,
    openFilterModal,
    closeFilterModal,
    getSelectedShoppings,
    setSelectedShoppings,

    // Theme
    setThemeMode,
    getThemeMode,

    // Lifecycle
    destroy,
    element,

    // Event registration
    on,
    off,
  };
}
