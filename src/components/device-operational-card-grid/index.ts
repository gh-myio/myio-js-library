/**
 * RFC-0152 Phase 3: Device Operational Card Grid Component
 * Displays a grid of operational equipment cards with filtering, sorting, and KPIs
 *
 * Architecture: Library Component (NOT ThingsBoard Widget)
 * Pattern: Follows src/components/telemetry-grid
 *
 * @example
 * ```typescript
 * const equipmentGrid = createDeviceOperationalCardGridComponent({
 *   container: document.getElementById('container'),
 *   themeMode: 'dark',
 *   enableDebugMode: true,
 *   equipment: mockEquipmentData,
 *   onEquipmentClick: (equipment) => {
 *     console.log('Equipment clicked:', equipment);
 *   },
 *   onEquipmentAction: (action, equipment) => {
 *     console.log('Equipment action:', action, equipment);
 *   },
 * });
 *
 * // Later: update equipment data
 * equipmentGrid.updateEquipment(newEquipmentData);
 *
 * // Cleanup
 * equipmentGrid.destroy();
 * ```
 */

import {
  OperationalEquipment,
  DeviceOperationalCardGridParams,
  DeviceOperationalCardGridInstance,
  ThemeMode,
  DeviceOperationalCardGridFilterState,
  DeviceOperationalCardGridStats,
} from './types';
import { DeviceOperationalCardGridController } from './DeviceOperationalCardGridController';
import { DeviceOperationalCardGridView } from './DeviceOperationalCardGridView';

// Re-export types
export type {
  OperationalEquipment,
  EquipmentType,
  EquipmentStatus,
  CustomerOption,
  DeviceOperationalCardGridParams,
  DeviceOperationalCardGridInstance,
  ThemeMode,
  SortMode,
  DeviceOperationalCardGridState,
  DeviceOperationalCardGridFilterState,
  DeviceOperationalCardGridStats,
  EquipmentAction,
  OnEquipmentClickCallback,
  OnEquipmentActionCallback,
  OnGridFilterChangeCallback,
  OnGridStatsUpdateCallback,
  DeviceOperationalCardGridEventType,
  DeviceOperationalCardGridEventHandler,
  GridSortOption,
  GridFilterTab,
} from './types';

// Re-export utilities and constants
export {
  GRID_SORT_OPTIONS,
  DEFAULT_GRID_FILTER_STATE,
  DEFAULT_GRID_FILTER_TABS,
  STATUS_CONFIG,
  TYPE_CONFIG,
} from './types';

// Re-export view and controller classes
export { DeviceOperationalCardGridView } from './DeviceOperationalCardGridView';
export { DeviceOperationalCardGridController } from './DeviceOperationalCardGridController';

// Re-export styles
export {
  DEVICE_OPERATIONAL_CARD_GRID_STYLES,
  injectDeviceOperationalCardGridStyles,
  removeDeviceOperationalCardGridStyles,
} from './styles';

/**
 * Create a DeviceOperationalCardGrid Component instance
 *
 * @param params - Configuration parameters
 * @returns DeviceOperationalCardGridInstance with methods to control the component
 */
export function createDeviceOperationalCardGridComponent(
  params: DeviceOperationalCardGridParams
): DeviceOperationalCardGridInstance {
  const { container } = params;

  // Validate container
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error(
      '[DeviceOperationalCardGridComponent] Invalid container element. Please provide a valid HTMLElement.'
    );
  }

  // Debug logging
  const debug = params.enableDebugMode ?? false;
  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[DeviceOperationalCardGridComponent]', ...args);
    }
  };

  log('Creating component with params:', {
    themeMode: params.themeMode,
    equipmentCount: params.equipment?.length || 0,
  });

  // Create controller
  const controller = new DeviceOperationalCardGridController(params);

  // Create view
  const view = new DeviceOperationalCardGridView(params, controller);

  // Render the component
  const element = view.render();

  log('Component mounted');

  // =========================================================================
  // Instance Methods
  // =========================================================================

  function updateEquipment(equipment: OperationalEquipment[]): void {
    log('updateEquipment called with', equipment.length, 'items');
    controller.updateEquipment(equipment);
  }

  function getEquipment(): OperationalEquipment[] {
    return controller.getEquipment();
  }

  function getFilteredEquipment(): OperationalEquipment[] {
    return controller.getFilteredEquipment();
  }

  function setLoading(isLoading: boolean): void {
    log('setLoading called:', isLoading);
    controller.setLoading(isLoading);
    view.showLoading(isLoading);
  }

  function setThemeMode(mode: ThemeMode): void {
    log('setThemeMode called:', mode);
    controller.setThemeMode(mode);
    view.applyThemeMode(mode);
  }

  function getThemeMode(): ThemeMode {
    return controller.getThemeMode();
  }

  function getFilters(): DeviceOperationalCardGridFilterState {
    return controller.getFilters();
  }

  function setFilters(filters: Partial<DeviceOperationalCardGridFilterState>): void {
    log('setFilters called:', filters);
    controller.setFilters(filters);
  }

  function clearFilters(): void {
    log('clearFilters called');
    controller.clearFilters();
  }

  function setSearchQuery(query: string): void {
    log('setSearchQuery called:', query);
    controller.setSearchQuery(query);
  }

  function setCustomerFilter(customerIds: string[]): void {
    log('setCustomerFilter called:', customerIds);
    controller.setCustomerFilter(customerIds);
  }

  function getStats(): DeviceOperationalCardGridStats {
    return controller.getStats();
  }

  function refresh(): void {
    log('refresh called');
    view.refresh();
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
    updateEquipment,
    getEquipment,
    getFilteredEquipment,

    // Loading state
    setLoading,

    // Theme methods
    setThemeMode,
    getThemeMode,

    // Filter methods
    getFilters,
    setFilters,
    clearFilters,
    setSearchQuery,
    setCustomerFilter,

    // Stats
    getStats,

    // Actions
    refresh,

    // Lifecycle
    destroy,
  };
}
