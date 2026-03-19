/**
 * RFC-0125: FilterModal Component
 * 3-column filter modal for device grids with status filters, device checklist, and sort options
 */

export * from './types.js';
export { FilterModalView } from './FilterModalView.js';
export { FilterModalController } from './FilterModalController.js';
export { generateFilterModalStyles } from './styles.js';

// RFC-0160: Simplified category-based filter modal for CardGridPanel
export {
  FilterModalComponent,
  WATER_SORT_OPTIONS,
  ENERGY_SORT_OPTIONS,
  TEMPERATURE_SORT_OPTIONS,
  MOTOR_SORT_OPTIONS,
  WATER_DEVICE_CATEGORIES,
} from './FilterModalComponent.js';

export type {
  FilterCategory,
  FilterSortOption,
  FilterDevice,
  FilterModalOptions,
  FilterState,
} from './FilterModalComponent.js';

import type { FilterModalParams, FilterModalInstance } from './types.js';
import { FilterModalController } from './FilterModalController.js';

/**
 * Factory function to create a FilterModal component
 * @param params - Configuration parameters
 * @returns FilterModal instance with open, close, setThemeMode, destroy methods
 */
export function createFilterModalComponent(params: FilterModalParams): FilterModalInstance {
  return new FilterModalController(params);
}
