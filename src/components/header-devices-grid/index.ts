/**
 * RFC-0125: HeaderDevicesGrid Component
 * Stats header for device grids with connectivity, consumption, and action buttons
 */

export * from './types.js';
export { HeaderDevicesGridView } from './HeaderDevicesGridView.js';
export { HeaderDevicesGridController } from './HeaderDevicesGridController.js';
export { HEADER_DEVICES_GRID_STYLES, injectHeaderDevicesGridStyles } from './styles.js';

import type { HeaderDevicesGridParams, HeaderDevicesGridInstance } from './types.js';
import { HeaderDevicesGridController } from './HeaderDevicesGridController.js';

/**
 * Factory function to create a HeaderDevicesGrid component
 * @param params - Configuration parameters
 * @returns HeaderDevicesGrid instance with updateStats, updateFromDevices, setThemeMode, destroy methods
 */
export function createHeaderDevicesGridComponent(
  params: HeaderDevicesGridParams
): HeaderDevicesGridInstance {
  return new HeaderDevicesGridController(params);
}
