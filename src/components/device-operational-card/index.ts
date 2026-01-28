/**
 * RFC-0152 Phase 4: Device Operational Card Component
 * Displays a grid of alarm cards with filtering, sorting, and actions
 *
 * Architecture: Library Component (NOT ThingsBoard Widget)
 * Pattern: Follows src/components/telemetry-grid
 *
 * @example
 * ```typescript
 * const deviceOperationalCard = createDeviceOperationalCardComponent({
 *   container: document.getElementById('container'),
 *   themeMode: 'dark',
 *   enableDebugMode: true,
 *   alarms: mockAlarmsData,
 *   onAlarmClick: (alarm) => {
 *     console.log('Alarm clicked:', alarm);
 *   },
 *   onAlarmAction: (action, alarm) => {
 *     console.log('Alarm action:', action, alarm);
 *   },
 * });
 *
 * // Later: update alarms data
 * deviceOperationalCard.updateAlarms(newAlarmsData);
 *
 * // Cleanup
 * deviceOperationalCard.destroy();
 * ```
 */

import { Alarm, AlarmStats } from '../../types/alarm';
import {
  DeviceOperationalCardParams,
  DeviceOperationalCardInstance,
  ThemeMode,
  DeviceOperationalCardFilterState,
} from './types';
import { DeviceOperationalCardController } from './DeviceOperationalCardController';
import { DeviceOperationalCardView } from './DeviceOperationalCardView';

// Re-export types
export type {
  DeviceOperationalCardParams,
  DeviceOperationalCardInstance,
  ThemeMode,
  DeviceOperationalCardState,
  DeviceOperationalCardFilterState,
  AlarmSortMode,
  AlarmAction,
  OnAlarmClickCallback,
  OnAlarmActionCallback,
  OnAlarmFilterChangeCallback,
  OnAlarmStatsUpdateCallback,
  DeviceOperationalCardEventType,
  DeviceOperationalCardEventHandler,
  AlarmSortOption,
  AlarmFilterTab,
} from './types';

// Re-export shared types from alarm.ts
export type {
  Alarm,
  AlarmCardData,
  AlarmSeverity,
  AlarmState,
  AlarmStats,
  AlarmFilters,
} from '../../types/alarm';

// Re-export utilities and constants
export {
  ALARM_SORT_OPTIONS,
  SEVERITY_ORDER,
  DEFAULT_DEVICE_OPERATIONAL_CARD_FILTER_STATE,
  DEFAULT_ALARM_FILTER_TABS,
} from './types';

export {
  SEVERITY_CONFIG,
  STATE_CONFIG,
  DEFAULT_ALARM_STATS,
  DEFAULT_ALARM_FILTERS,
  getSeverityConfig,
  getStateConfig,
  isAlarmActive,
  formatAlarmRelativeTime,
} from '../../types/alarm';

// Re-export view and controller classes
export { DeviceOperationalCardView } from './DeviceOperationalCardView';
export { DeviceOperationalCardController } from './DeviceOperationalCardController';

// Re-export styles
export {
  DEVICE_OPERATIONAL_CARD_STYLES,
  injectDeviceOperationalCardStyles,
  removeDeviceOperationalCardStyles,
} from './styles';

/**
 * Create a DeviceOperationalCard Component instance
 *
 * @param params - Configuration parameters
 * @returns DeviceOperationalCardInstance with methods to control the component
 */
export function createDeviceOperationalCardComponent(
  params: DeviceOperationalCardParams
): DeviceOperationalCardInstance {
  const { container } = params;

  // Validate container
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error(
      '[DeviceOperationalCardComponent] Invalid container element. Please provide a valid HTMLElement.'
    );
  }

  // Debug logging
  const debug = params.enableDebugMode ?? false;
  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[DeviceOperationalCardComponent]', ...args);
    }
  };

  log('Creating component with params:', {
    themeMode: params.themeMode,
    alarmsCount: params.alarms?.length || 0,
  });

  // Create controller
  const controller = new DeviceOperationalCardController(params);

  // Create view
  const view = new DeviceOperationalCardView(params, controller);

  // Render the component
  const element = view.render();

  log('Component mounted');

  // =========================================================================
  // Instance Methods
  // =========================================================================

  function updateAlarms(alarms: Alarm[]): void {
    log('updateAlarms called with', alarms.length, 'items');
    controller.updateAlarms(alarms);
  }

  function getAlarms(): Alarm[] {
    return controller.getAlarms();
  }

  function getFilteredAlarms(): Alarm[] {
    return controller.getFilteredAlarms();
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

  function getFilters(): DeviceOperationalCardFilterState {
    return controller.getFilters();
  }

  function setFilters(filters: Partial<DeviceOperationalCardFilterState>): void {
    log('setFilters called:', filters);
    controller.setFilters(filters);
  }

  function clearFilters(): void {
    log('clearFilters called');
    controller.clearFilters();
  }

  function getStats(): AlarmStats {
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
    updateAlarms,
    getAlarms,
    getFilteredAlarms,

    // Loading state
    setLoading,

    // Theme methods
    setThemeMode,
    getThemeMode,

    // Filter methods
    getFilters,
    setFilters,
    clearFilters,

    // Stats
    getStats,

    // Actions
    refresh,

    // Lifecycle
    destroy,
  };
}
