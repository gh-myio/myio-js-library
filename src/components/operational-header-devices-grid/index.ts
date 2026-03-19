/**
 * RFC-0152: OperationalHeaderDevicesGrid Component
 * Premium stats header for operational equipment grids
 */

import type {
  OperationalHeaderDevicesGridParams,
  OperationalHeaderDevicesGridInstance,
  OperationalHeaderStats,
  OperationalHeaderThemeMode,
  CustomerOption,
} from './types';
import { OperationalHeaderDevicesGridView } from './OperationalHeaderDevicesGridView';

// Re-export types
export type {
  OperationalHeaderDevicesGridParams,
  OperationalHeaderDevicesGridInstance,
  OperationalHeaderStats,
  OperationalHeaderThemeMode,
  OperationalHeaderLabels,
  CustomerOption,
} from './types';

// Re-export view
export { OperationalHeaderDevicesGridView } from './OperationalHeaderDevicesGridView';

// Re-export styles
export {
  OPERATIONAL_HEADER_DEVICES_GRID_STYLES,
  injectOperationalHeaderDevicesGridStyles,
  removeOperationalHeaderDevicesGridStyles,
} from './styles';

/**
 * Create an OperationalHeaderDevicesGrid instance
 */
export function createOperationalHeaderDevicesGridComponent(
  params: OperationalHeaderDevicesGridParams
): OperationalHeaderDevicesGridInstance {
  const view = new OperationalHeaderDevicesGridView(params);

  return {
    element: view.getElement(),
    updateStats: (stats: Partial<OperationalHeaderStats>) => view.updateStats(stats),
    setThemeMode: (mode: OperationalHeaderThemeMode) => view.setThemeMode(mode),
    updateCustomers: (customers: CustomerOption[]) => view.updateCustomers(customers),
    setSelectedCustomer: (customerId: string) => view.setSelectedCustomer(customerId),
    getSearchInput: () => view.getSearchInput(),
    toggleSearch: (active?: boolean) => view.toggleSearch(active),
    destroy: () => view.destroy(),
  };
}
