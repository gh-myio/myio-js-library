/**
 * RFC-0152 Phase 4: Alarms Notifications Panel Component
 * Centralized view for alarms with list and dashboard views
 */

import type {
  AlarmsNotificationsPanelParams,
  AlarmsNotificationsPanelInstance,
} from './types';
import { AlarmsNotificationsPanelController } from './AlarmsNotificationsPanelController';
import { AlarmsNotificationsPanelView } from './AlarmsNotificationsPanelView';

// =====================================================================
// Re-export Types
// =====================================================================

export type {
  // Component types
  AlarmsNotificationsPanelParams,
  AlarmsNotificationsPanelInstance,
  AlarmsNotificationsPanelState,
  ThemeMode,
  AlarmsTab,
  AlarmsEventType,
  AlarmsEventHandler,
  AlarmCardParams,
  TrendChartOptions,
  DonutChartOptions,
  BarChartOptions,
} from './types';

// Re-export alarm types from shared
export type {
  AlarmSeverity,
  AlarmState,
  Alarm,
  AlarmCardData,
  AlarmStats,
  AlarmTrendDataPoint,
  AlarmFilters,
  AlarmsPanelTab,
  AlarmsPanelState,
  AlarmReadyEvent,
  AlarmActionEvent,
} from './types';

// Re-export alarm utilities from shared
export {
  SEVERITY_CONFIG,
  STATE_CONFIG,
  DEFAULT_ALARM_STATS,
  DEFAULT_ALARM_FILTERS,
  getSeverityConfig,
  getStateConfig,
  isAlarmActive,
  formatAlarmRelativeTime,
} from './types';

// =====================================================================
// Re-export Classes
// =====================================================================

export { AlarmsNotificationsPanelController } from './AlarmsNotificationsPanelController';
export { AlarmsNotificationsPanelView } from './AlarmsNotificationsPanelView';

// =====================================================================
// Re-export Card and Dashboard Components
// =====================================================================

export {
  renderAlarmCard,
  createAlarmCardElement,
  renderAlarmCards,
  createAlarmCardElements,
} from './AlarmCard';

export {
  renderKPICards,
  updateKPIValues,
  renderTrendChart,
  renderStateDonutChart,
  renderSeverityBarChart,
  renderDashboard,
  updateDashboard,
} from './AlarmDashboard';

// =====================================================================
// Re-export Styles
// =====================================================================

export {
  ALARMS_NOTIFICATIONS_PANEL_STYLES,
  injectAlarmsNotificationsPanelStyles,
  removeAlarmsNotificationsPanelStyles,
} from './styles';

// =====================================================================
// Factory Function
// =====================================================================

/**
 * Create an Alarms Notifications Panel Component instance
 *
 * @example
 * ```typescript
 * const panel = createAlarmsNotificationsPanelComponent({
 *   container: document.getElementById('alarms-container'),
 *   themeMode: 'dark',
 *   alarms: myAlarms,
 *   onAlarmClick: (alarm) => console.log('Clicked:', alarm),
 *   onAcknowledge: (id) => api.acknowledgeAlarm(id),
 * });
 *
 * // Update alarms
 * panel.updateAlarms(newAlarms);
 *
 * // Change tab
 * panel.setActiveTab('dashboard');
 *
 * // Cleanup
 * panel.destroy();
 * ```
 */
export function createAlarmsNotificationsPanelComponent(
  params: AlarmsNotificationsPanelParams
): AlarmsNotificationsPanelInstance {
  // Validate container
  if (!params.container || !(params.container instanceof HTMLElement)) {
    throw new Error('[AlarmsNotificationsPanelComponent] Invalid container element.');
  }

  const debug = params.enableDebugMode ?? false;
  const log = (...args: unknown[]) => {
    if (debug) console.log('[AlarmsNotificationsPanelComponent]', ...args);
  };

  log('Creating component with params:', {
    themeMode: params.themeMode,
    initialTab: params.initialTab,
    alarmsCount: params.alarms?.length || 0,
  });

  // Create controller
  const controller = new AlarmsNotificationsPanelController(params);

  // Create view
  const view = new AlarmsNotificationsPanelView(params, controller);

  // Render
  const element = view.render();

  log('Component mounted');

  // Return public instance API
  return {
    element,

    // Data methods
    updateAlarms: (alarms) => {
      controller.updateAlarms(alarms);
    },

    updateStats: (stats) => {
      controller.updateStats(stats);
    },

    getAlarms: () => {
      return controller.getAlarms();
    },

    getFilteredAlarms: () => {
      return controller.getFilteredAlarms();
    },

    // Loading state
    setLoading: (isLoading) => {
      controller.setLoading(isLoading);
      view.showLoading(isLoading);
    },

    // Tab management
    setActiveTab: (tab) => {
      controller.setActiveTab(tab);
    },

    getActiveTab: () => {
      return controller.getActiveTab();
    },

    // Theme
    setThemeMode: (mode) => {
      controller.setThemeMode(mode);
      view.applyThemeMode(mode);
    },

    getThemeMode: () => {
      return controller.getThemeMode();
    },

    // Filters
    getFilters: () => {
      return controller.getFilters();
    },

    setFilters: (filters) => {
      controller.setFilters(filters);
    },

    clearFilters: () => {
      controller.clearFilters();
    },

    // Actions
    refresh: () => {
      view.refresh();
    },

    destroy: () => {
      log('Destroying component');
      view.destroy();
    },
  };
}
