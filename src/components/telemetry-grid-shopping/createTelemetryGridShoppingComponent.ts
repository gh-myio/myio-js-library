/**
 * RFC-0145: TelemetryGridShopping Component Factory
 * Creates and manages a TelemetryGridShopping component instance
 */

import {
  TelemetryGridShoppingParams,
  TelemetryGridShoppingInstance,
  TelemetryDevice,
  TelemetryDomain,
  TelemetryContext,
  ThemeMode,
  SortMode,
  FilterState,
  TelemetryStats,
  CONTEXT_CONFIG,
} from './types';
import { TelemetryGridShoppingController } from './TelemetryGridShoppingController';
import { TelemetryGridShoppingView } from './TelemetryGridShoppingView';

// Type-safe window access helper
const getWindow = (): any => window;

/**
 * Map context to STATE group name
 */
const CONTEXT_TO_STATE_GROUP: Record<TelemetryContext, string> = {
  // Energy contexts
  stores: 'lojas',
  equipments: 'areacomum',
  entrada: 'entrada',
  // Water contexts
  hidrometro: 'lojas',
  hidrometro_area_comum: 'areacomum',
  hidrometro_entrada: 'entrada',
  // Temperature contexts
  termostato: 'lojas',
  termostato_external: 'lojas',
};

/**
 * Transform STATE item to TelemetryDevice format
 * STATE items have different field names than TelemetryDevice expects
 */
function mapStateItemToDevice(item: Record<string, unknown>): TelemetryDevice {
  return {
    // Core identifiers - map STATE fields to TelemetryDevice fields
    entityId: (item.entityId as string) || (item.id as string) || (item.tbId as string) || '',
    ingestionId: (item.ingestionId as string) || (item.id as string) || '',
    labelOrName: (item.labelOrName as string) || (item.label as string) || (item.entityName as string) || '',
    name: (item.name as string) || (item.label as string) || '',
    deviceIdentifier: (item.deviceIdentifier as string) || (item.identifier as string) || (item.label as string) || '',

    // Device classification
    deviceType: (item.deviceType as string) || '',
    deviceProfile: (item.deviceProfile as string) || '',
    deviceStatus: (item.deviceStatus as string) || (item.connectionStatus as string) || '',
    connectionStatus: (item.connectionStatus as string) || '',

    // Customer/Owner info
    customerId: (item.customerId as string) || '',
    customerName: (item.customerName as string) || '',
    centralName: (item.centralName as string) || '',
    ownerName: (item.ownerName as string) || '',

    // Value fields - map 'value' to 'val'
    val: typeof item.val === 'number' ? item.val : (typeof item.value === 'number' ? item.value : null),
    perc: typeof item.perc === 'number' ? item.perc : undefined,
    unit: (item.unit as string) || undefined,

    // Timestamps
    lastConnectTime: item.lastConnectTime as number | undefined,
    lastActivityTime: item.lastActivityTime as number | undefined,

    // Additional metadata
    domain: item.domain as TelemetryDomain | undefined,
    log_annotations: item.log_annotations as Record<string, unknown> | undefined,
  };
}

/**
 * Create a TelemetryGridShopping Component instance
 *
 * @param params - Configuration parameters
 * @returns TelemetryGridShoppingInstance with methods to control the grid
 *
 * @example
 * ```typescript
 * const telemetryGrid = createTelemetryGridShoppingComponent({
 *   container: document.getElementById('telemetryContainer'),
 *   domain: 'energy',
 *   context: 'stores',
 *   devices: devicesFromOrchestrator,
 *   themeMode: 'dark',
 *   labelWidget: 'Lojas',
 *
 *   onCardAction: async (action, device) => {
 *     if (action === 'dashboard') {
 *       console.log('Opening dashboard for:', device.labelOrName);
 *     }
 *   },
 *
 *   onStatsUpdate: (stats) => {
 *     console.log('Stats updated:', stats);
 *   },
 * });
 *
 * // Update devices when data changes
 * telemetryGrid.updateDevices(newDevices);
 *
 * // Change domain/context
 * telemetryGrid.updateConfig({ domain: 'water', context: 'hidrometro' });
 * ```
 */
export function createTelemetryGridShoppingComponent(
  params: TelemetryGridShoppingParams
): TelemetryGridShoppingInstance {
  const { container } = params;

  // Validate container
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error(
      '[TelemetryGridShoppingComponent] Invalid container element. Please provide a valid HTMLElement.'
    );
  }

  // Debug logging
  const debug = params.debugActive ?? false;
  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[TelemetryGridShoppingComponent]', ...args);
    }
  };

  log('Creating component with params:', {
    domain: params.domain,
    context: params.context,
    deviceCount: params.devices?.length || 0,
    themeMode: params.themeMode,
    labelWidget: params.labelWidget,
  });

  // Create controller
  const controller = new TelemetryGridShoppingController(params);

  // Create view
  const view = new TelemetryGridShoppingView(params, controller);

  // Render the component
  const element = view.render();

  // Mount to container
  container.innerHTML = '';
  container.appendChild(element);

  log('Component mounted');

  // =========================================================================
  // Auto-subscribe to Orchestrator Events
  // =========================================================================

  /**
   * Extract devices from window.STATE based on domain and context
   */
  function extractDevicesFromState(domain: TelemetryDomain, context: TelemetryContext): TelemetryDevice[] {
    try {
      const STATE = getWindow().STATE;
      if (!STATE || !STATE[domain]) {
        log('STATE not available or domain not found:', domain);
        return [];
      }

      const stateGroup = CONTEXT_TO_STATE_GROUP[context];
      if (!stateGroup) {
        log('Unknown context:', context);
        return [];
      }

      const groupData = STATE[domain][stateGroup];
      if (!groupData || !groupData.items) {
        log(`No items in STATE.${domain}.${stateGroup}`);
        return [];
      }

      log(`Found ${groupData.items.length} items in STATE.${domain}.${stateGroup}`);

      // Map STATE items to TelemetryDevice format
      const mappedItems = (groupData.items as Record<string, unknown>[]).map(mapStateItemToDevice);
      log(`Mapped ${mappedItems.length} items to TelemetryDevice format`);
      return mappedItems;
    } catch (err) {
      log('Error extracting devices from STATE:', err);
      return [];
    }
  }

  /**
   * Handle provide-data event from orchestrator
   */
  function handleProvideData(event: CustomEvent): void {
    const eventDomain = event.detail?.domain;
    const currentDomain = controller.getDomain();
    const currentContext = controller.getContext();

    // Only process events for our domain
    if (eventDomain !== currentDomain) {
      return;
    }

    log(`Received myio:provide-data for ${eventDomain}, context: ${currentContext}`);

    // Extract items from STATE
    const devices = extractDevicesFromState(currentDomain, currentContext);
    if (devices.length > 0) {
      controller.updateDevices(devices);
      view.refresh();
      log(`Updated with ${devices.length} devices from STATE`);
    }
  }

  // Register event listener
  getWindow().addEventListener('myio:provide-data', handleProvideData);
  log('Event listener registered for myio:provide-data');

  // Check if STATE already has data (for late component creation)
  const initialDomain = params.domain;
  const initialContext = params.context;
  const initialDevices = extractDevicesFromState(initialDomain, initialContext);
  if (initialDevices.length > 0 && (!params.devices || params.devices.length === 0)) {
    log(`Loading initial data from STATE: ${initialDevices.length} devices`);
    controller.updateDevices(initialDevices);
    view.refresh();
  }

  // =========================================================================
  // Instance Methods
  // =========================================================================

  function updateDevices(devices: TelemetryDevice[]): void {
    log('updateDevices called with', devices.length, 'devices');
    controller.updateDevices(devices);
    view.refresh();
  }

  function getDevices(): TelemetryDevice[] {
    return controller.getDevices();
  }

  function getFilteredDevices(): TelemetryDevice[] {
    return controller.getFilteredDevices();
  }

  function updateConfig(config: Partial<{
    domain: TelemetryDomain;
    context: TelemetryContext;
    labelWidget: string;
  }>): void {
    log('updateConfig called:', config);

    if (config.domain !== undefined && config.context !== undefined) {
      controller.updateConfig(config.domain, config.context);
      view.applyDomainTheme(config.domain);
      view.applyContextAttribute(config.context);
    }

    if (config.labelWidget !== undefined) {
      view.updateLabel(config.labelWidget);
    } else if (config.context !== undefined) {
      // Update label from context config
      const contextConfig = CONTEXT_CONFIG[config.context];
      if (contextConfig) {
        view.updateLabel(contextConfig.headerLabel);
      }
    }

    view.refresh();
  }

  function getDomain(): TelemetryDomain {
    return controller.getDomain();
  }

  function getContext(): TelemetryContext {
    return controller.getContext();
  }

  function setThemeMode(mode: ThemeMode): void {
    log('setThemeMode called:', mode);
    controller.setThemeMode(mode);
    view.applyThemeMode(mode);
  }

  function getThemeMode(): ThemeMode {
    return controller.getThemeMode();
  }

  function applyShoppingFilter(shoppingIds: string[]): void {
    log('applyShoppingFilter called with', shoppingIds.length, 'shoppings');
    controller.setShoppingFilter(shoppingIds);
    view.refresh();
  }

  function setSearchTerm(term: string): void {
    log('setSearchTerm called:', term);
    controller.setSearchTerm(term);
    view.refresh();
  }

  function setSortMode(mode: SortMode): void {
    log('setSortMode called:', mode);
    controller.setSortMode(mode);
    view.refresh();
  }

  function clearFilters(): void {
    log('clearFilters called');
    controller.clearFilters();
    view.refresh();
  }

  function getFilterState(): FilterState {
    return controller.getFilterState();
  }

  function getStats(): TelemetryStats {
    return controller.getStats();
  }

  function refresh(): void {
    log('refresh called');
    view.refresh();
  }

  function openFilterModal(): void {
    log('openFilterModal called');
    view.openFilterModal();
  }

  function closeFilterModal(): void {
    log('closeFilterModal called');
    view.closeFilterModal();
  }

  function showLoading(show: boolean, message?: string): void {
    view.showLoading(show, message);
  }

  function destroy(): void {
    log('destroy called');
    // Remove event listener
    getWindow().removeEventListener('myio:provide-data', handleProvideData);
    view.destroy();
  }

  // =========================================================================
  // Return Instance
  // =========================================================================

  return {
    element,

    // Data methods
    updateDevices,
    getDevices,
    getFilteredDevices,

    // Config methods
    updateConfig,
    getDomain,
    getContext,

    // Theme methods
    setThemeMode,
    getThemeMode,

    // Filter methods
    applyShoppingFilter,
    setSearchTerm,
    setSortMode,
    clearFilters,
    getFilterState,

    // Stats
    getStats,

    // Actions
    refresh,
    openFilterModal,
    closeFilterModal,
    showLoading,

    // Lifecycle
    destroy,
  };
}
