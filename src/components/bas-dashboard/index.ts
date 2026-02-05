/**
 * RFC-0158: Building Automation System (BAS) Dashboard Component
 * Public exports and factory function
 */

import type {
  BASDashboardParams,
  BASDashboardInstance,
  BASDashboardData,
  BASDashboardThemeMode,
  BASDashboardSettings,
  CardCustomStyle,
  WaterDevice,
  HVACDevice,
  MotorDevice,
  WaterDeviceType,
  WaterDeviceStatus,
  HVACDeviceStatus,
  MotorDeviceStatus,
  MotorDeviceType,
  BASDashboardState,
  BASEventType,
} from './types';
import { DEFAULT_BAS_SETTINGS } from './types';
import { BASDashboardController } from './BASDashboardController';

// Re-export types
export type {
  BASDashboardParams,
  BASDashboardInstance,
  BASDashboardData,
  BASDashboardThemeMode,
  BASDashboardSettings,
  CardCustomStyle,
  WaterDevice,
  HVACDevice,
  MotorDevice,
  WaterDeviceType,
  WaterDeviceStatus,
  HVACDeviceStatus,
  MotorDeviceStatus,
  MotorDeviceType,
  BASDashboardState,
  BASEventType,
};

export { DEFAULT_BAS_SETTINGS };

// Re-export View and Controller
export { BASDashboardView } from './BASDashboardView';
export { BASDashboardController } from './BASDashboardController';

// Re-export styles
export {
  BAS_DASHBOARD_CSS_PREFIX,
  BAS_DASHBOARD_STYLES,
  injectBASDashboardStyles,
  removeBASDashboardStyles,
} from './styles';

/**
 * Create a BAS Dashboard component instance
 *
 * @example
 * ```typescript
 * const dashboard = createBASDashboard(container, {
 *   settings: {
 *     dashboardTitle: 'Building Automation',
 *     primaryColor: '#2F5848',
 *   },
 *   themeMode: 'dark',
 *   waterDevices: [...],
 *   hvacDevices: [...],
 *   motorDevices: [...],
 *   floors: ['01', '02', '03'],
 *   onFloorSelect: (floor) => {
 *     console.log('Floor selected:', floor);
 *   },
 *   onDeviceClick: (device) => {
 *     console.log('Device clicked:', device);
 *   },
 * });
 *
 * // Update data
 * dashboard.updateData({
 *   waterDevices: newWaterDevices,
 *   hvacDevices: newHvacDevices,
 * });
 *
 * // Change theme
 * dashboard.setThemeMode('light');
 *
 * // Cleanup
 * dashboard.destroy();
 * ```
 */
export function createBASDashboard(
  container: HTMLElement,
  params: BASDashboardParams = {}
): BASDashboardInstance {
  const controller = new BASDashboardController(container, params);

  return {
    element: controller.getElement(),
    updateData: (data: Partial<BASDashboardData>) => controller.updateData(data),
    setThemeMode: (mode: BASDashboardThemeMode) => controller.setThemeMode(mode),
    getThemeMode: () => controller.getThemeMode(),
    setSelectedFloor: (floor: string | null) => controller.setSelectedFloor(floor),
    getSelectedFloor: () => controller.getSelectedFloor(),
    resize: () => controller.resize(),
    destroy: () => controller.destroy(),
  };
}
