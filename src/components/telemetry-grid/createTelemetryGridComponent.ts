/**
 * RFC-0121: TelemetryGrid Component Factory
 * Creates and manages a TelemetryGrid component instance
 */

import {
  TelemetryGridParams,
  TelemetryGridInstance,
  TelemetryDevice,
  TelemetryDomain,
  TelemetryContext,
  ThemeMode,
  SortMode,
  TelemetryStats,
  Shopping,
} from './types';
import { TelemetryGridController } from './TelemetryGridController';
import { TelemetryGridView } from './TelemetryGridView';

/**
 * Create a TelemetryGrid Component instance
 *
 * @param params - Configuration parameters
 * @returns TelemetryGridInstance with methods to control the grid
 *
 * @example
 * ```typescript
 * const telemetryGrid = createTelemetryGridComponent({
 *   container: document.getElementById('telemetry-mount'),
 *   domain: 'energy',
 *   context: 'equipments',
 *   devices: devicesFromOrchestrator,
 *   themeMode: 'dark',
 *   debugActive: true,
 *
 *   onCardAction: async (action, device) => {
 *     console.log('Card action:', action, device.labelOrName);
 *   },
 *
 *   onStatsUpdate: (stats) => {
 *     console.log('Stats updated:', stats);
 *     // Update header component with new stats
 *   },
 * });
 *
 * // Later: Update devices when data changes
 * telemetryGrid.updateDevices(newDevices);
 *
 * // Change domain/context
 * telemetryGrid.updateConfig('water', 'hidrometro');
 * ```
 */
export function createTelemetryGridComponent(
  params: TelemetryGridParams
): TelemetryGridInstance {
  const { container } = params;

  // Validate container
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error(
      '[TelemetryGridComponent] Invalid container element. Please provide a valid HTMLElement.'
    );
  }

  // Debug logging
  const debug = params.debugActive ?? false;
  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[TelemetryGridComponent]', ...args);
    }
  };

  log('Creating component with params:', {
    domain: params.domain,
    context: params.context,
    deviceCount: params.devices?.length || 0,
    themeMode: params.themeMode,
  });

  // Create controller
  const controller = new TelemetryGridController(params);

  // Create view
  const view = new TelemetryGridView(params, controller);

  // Render the component
  const element = view.render();

  log('Component mounted');

  // =========================================================================
  // Instance Methods
  // =========================================================================

  function updateDevices(devices: TelemetryDevice[]): void {
    log('updateDevices called with', devices.length, 'devices');
    controller.updateDevices(devices);
  }

  function getDevices(): TelemetryDevice[] {
    return controller.getDevices();
  }

  function getFilteredDevices(): TelemetryDevice[] {
    return controller.getFilteredDevices();
  }

  function updateConfig(
    domain: TelemetryDomain,
    context: TelemetryContext
  ): void {
    log('updateConfig called:', domain, context);

    // Update controller
    controller.updateConfig(domain, context);

    // Update view themes
    view.applyDomainTheme(domain);
    view.applyContextAttribute(context);

    // Trigger re-render
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

  function applyFilter(shoppingIds: string[]): void {
    log('applyFilter called with', shoppingIds.length, 'shoppings:', shoppingIds);
    controller.setShoppingFilter(shoppingIds);
    // Log result after filter applied
    const filtered = controller.getFilteredDevices();
    log('After filter - filtered devices:', filtered.length);
  }

  function setSearchTerm(term: string): void {
    log('setSearchTerm called:', term);
    controller.setSearchTerm(term);
  }

  function setSortMode(mode: SortMode): void {
    log('setSortMode called:', mode);
    controller.setSortMode(mode);
  }

  function clearFilters(): void {
    log('clearFilters called');
    controller.clearFilters();
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

  function renderShoppingChips(shoppings: Shopping[]): void {
    view.renderShoppingChips(shoppings);
  }

  function destroy(): void {
    log('destroy called');
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
    applyFilter,
    setSearchTerm,
    setSortMode,
    clearFilters,

    // Stats
    getStats,

    // Actions
    refresh,
    openFilterModal,
    closeFilterModal,

    // Lifecycle
    destroy,
  };
}
