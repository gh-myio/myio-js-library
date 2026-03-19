/**
 * RFC-0152 Phase 3: Operational General List Component
 * Displays a grid of equipment cards (escalators and elevators) with operational KPIs
 *
 * Architecture: Library Component (NOT ThingsBoard Widget)
 * Pattern: Follows src/components/telemetry-grid
 *
 * @example
 * ```typescript
 * const listComponent = createOperationalGeneralListComponent({
 *   container: document.getElementById('container'),
 *   themeMode: 'dark',
 *   enableDebugMode: true,
 *   equipment: mockEquipmentData,
 *   onCardClick: (equipment) => {
 *     console.log('Equipment clicked:', equipment);
 *   },
 *   onFilterChange: (filters) => {
 *     console.log('Filters changed:', filters);
 *   },
 * });
 *
 * // Later: update equipment data
 * listComponent.updateEquipment(newEquipmentData);
 *
 * // Cleanup
 * listComponent.destroy();
 * ```
 */

import {
  OperationalGeneralListParams,
  OperationalGeneralListInstance,
  ThemeMode,
} from './types';
import { OperationalGeneralListController } from './OperationalGeneralListController';
import { OperationalGeneralListView } from './OperationalGeneralListView';

// Re-export types
export type {
  OperationalGeneralListParams,
  OperationalGeneralListInstance,
  ThemeMode,
  OperationalGeneralListState,
  OperationalListEventType,
  OperationalListEventHandler,
  StatusConfig,
} from './types';

// Re-export shared types from operational.ts
export type {
  EquipmentType,
  EquipmentStatus,
  EquipmentCardData,
  EquipmentStats,
  EquipmentFilterState,
} from '../../types/operational';

// Re-export utilities
export {
  STATUS_CONFIG,
  AVAILABILITY_THRESHOLDS,
  getAvailabilityColorFromThresholds,
} from './types';

export {
  getStatusColors,
  getAvailabilityColor,
  calculateMTBF,
  calculateMTTR,
  calculateAvailability,
  DEFAULT_EQUIPMENT_STATS,
  DEFAULT_EQUIPMENT_FILTER_STATE,
} from '../../types/operational';

// Re-export view and controller classes
export { OperationalGeneralListView } from './OperationalGeneralListView';
export { OperationalGeneralListController } from './OperationalGeneralListController';

// Re-export styles
export {
  OPERATIONAL_GENERAL_LIST_STYLES,
  injectOperationalGeneralListStyles,
  removeOperationalGeneralListStyles,
} from './styles';

/**
 * Create an OperationalGeneralList Component instance
 *
 * @param params - Configuration parameters
 * @returns OperationalGeneralListInstance with methods to control the component
 */
export function createOperationalGeneralListComponent(
  params: OperationalGeneralListParams
): OperationalGeneralListInstance {
  const { container } = params;

  // Validate container
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error(
      '[OperationalGeneralListComponent] Invalid container element. Please provide a valid HTMLElement.'
    );
  }

  // Debug logging
  const debug = params.enableDebugMode ?? false;
  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[OperationalGeneralListComponent]', ...args);
    }
  };

  log('Creating component with params:', {
    themeMode: params.themeMode,
    equipmentCount: params.equipment?.length || 0,
  });

  // Create controller
  const controller = new OperationalGeneralListController(params);

  // Create view
  const view = new OperationalGeneralListView(params, controller);

  // Render the component
  const element = view.render();

  log('Component mounted');

  // =========================================================================
  // Instance Methods
  // =========================================================================

  function updateEquipment(
    equipment: import('../../types/operational').EquipmentCardData[]
  ): void {
    log('updateEquipment called with', equipment.length, 'items');
    controller.updateEquipment(equipment);
  }

  function getEquipment(): import('../../types/operational').EquipmentCardData[] {
    return controller.getEquipment();
  }

  function getFilteredEquipment(): import('../../types/operational').EquipmentCardData[] {
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

  function getFilters(): import('../../types/operational').EquipmentFilterState {
    return controller.getFilters();
  }

  function setFilters(
    filters: Partial<import('../../types/operational').EquipmentFilterState>
  ): void {
    log('setFilters called:', filters);
    controller.setFilters(filters);
  }

  function getStats(): import('../../types/operational').EquipmentStats {
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

    // Stats
    getStats,

    // Actions
    refresh,

    // Lifecycle
    destroy,
  };
}
