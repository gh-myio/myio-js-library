/**
 * RFC-0152 Phase 4: Alarms Notifications Panel Controller
 * Business logic and state management (no DOM operations)
 */

import type { Alarm, AlarmStats, AlarmFilters, AlarmSeverity, AlarmState } from '../../types/alarm';
import { DEFAULT_ALARM_STATS, DEFAULT_ALARM_FILTERS } from '../../types/alarm';
import type {
  AlarmsNotificationsPanelParams,
  AlarmsNotificationsPanelState,
  AlarmsTab,
  ThemeMode,
} from './types';

export class AlarmsNotificationsPanelController {
  private state: AlarmsNotificationsPanelState;
  private params: AlarmsNotificationsPanelParams;
  private onStateChange: ((state: AlarmsNotificationsPanelState) => void) | null = null;
  private debug: boolean;

  constructor(params: AlarmsNotificationsPanelParams) {
    this.params = params;
    this.debug = params.enableDebugMode ?? false;

    // Initialize state
    this.state = {
      themeMode: params.themeMode || 'dark',
      activeTab: params.initialTab || 'list',
      allAlarms: params.alarms || [],
      filteredAlarms: [],
      stats: params.stats || { ...DEFAULT_ALARM_STATS },
      filters: { ...DEFAULT_ALARM_FILTERS },
      isLoading: false,
    };

    // Apply initial filtering
    this.applyFilters();

    // Calculate stats if not provided
    if (!params.stats && params.alarms && params.alarms.length > 0) {
      this.state.stats = this.calculateStats(params.alarms);
    }

    this.log('Controller initialized', this.state);
  }

  // =====================================================================
  // State Change Callback
  // =====================================================================

  /**
   * Register callback for state changes
   */
  setOnStateChange(callback: (state: AlarmsNotificationsPanelState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Notify view of state change
   */
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  // =====================================================================
  // Alarm Data Management
  // =====================================================================

  /**
   * Update alarms data
   */
  updateAlarms(alarms: Alarm[]): void {
    this.log('Updating alarms', { count: alarms.length });
    this.state.allAlarms = alarms;
    this.applyFilters();
    this.state.stats = this.calculateStats(alarms);
    this.notifyStateChange();
  }

  /**
   * Get all alarms
   */
  getAlarms(): Alarm[] {
    return this.state.allAlarms;
  }

  /**
   * Get filtered alarms
   */
  getFilteredAlarms(): Alarm[] {
    return this.state.filteredAlarms;
  }

  // =====================================================================
  // Statistics
  // =====================================================================

  /**
   * Update statistics data
   */
  updateStats(stats: AlarmStats): void {
    this.log('Updating stats', stats);
    this.state.stats = stats;
    this.notifyStateChange();
  }

  /**
   * Get current statistics
   */
  getStats(): AlarmStats {
    return this.state.stats;
  }

  /**
   * Calculate statistics from alarms
   */
  calculateStats(alarms: Alarm[]): AlarmStats {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const stats: AlarmStats = {
      total: alarms.length,
      bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
      byState: { OPEN: 0, ACK: 0, SNOOZED: 0, ESCALATED: 0, CLOSED: 0 },
      openCritical: 0,
      openHigh: 0,
      last24Hours: 0,
    };

    alarms.forEach((alarm) => {
      // Count by severity
      if (stats.bySeverity[alarm.severity] !== undefined) {
        stats.bySeverity[alarm.severity]++;
      }

      // Count by state
      if (stats.byState[alarm.state] !== undefined) {
        stats.byState[alarm.state]++;
      }

      // Count open critical
      if (alarm.severity === 'CRITICAL' && alarm.state === 'OPEN') {
        stats.openCritical++;
      }

      // Count open high
      if (alarm.severity === 'HIGH' && alarm.state === 'OPEN') {
        stats.openHigh++;
      }

      // Count last 24 hours
      try {
        const alarmTime = new Date(alarm.lastOccurrence).getTime();
        if (alarmTime >= oneDayAgo) {
          stats.last24Hours++;
        }
      } catch {
        // Ignore invalid dates
      }
    });

    return stats;
  }

  // =====================================================================
  // Filter Management
  // =====================================================================

  /**
   * Get current filters
   */
  getFilters(): AlarmFilters {
    return { ...this.state.filters };
  }

  /**
   * Set filters (partial update)
   */
  setFilters(filters: Partial<AlarmFilters>): void {
    this.log('Setting filters', filters);
    this.state.filters = { ...this.state.filters, ...filters };
    this.applyFilters();
    this.notifyStateChange();
    this.params.onFilterChange?.(this.state.filters);
  }

  /**
   * Set search term
   */
  setSearchTerm(term: string): void {
    this.setFilters({ search: term });
  }

  /**
   * Set severity filter
   */
  setSeverityFilter(severities: AlarmSeverity[] | undefined): void {
    this.setFilters({ severity: severities });
  }

  /**
   * Set state filter
   */
  setStateFilter(states: AlarmState[] | undefined): void {
    this.setFilters({ state: states });
  }

  /**
   * Set date range filter
   */
  setDateRange(fromDate?: string, toDate?: string): void {
    this.setFilters({ fromDate, toDate });
  }

  /**
   * Set customer filter
   */
  setCustomerFilter(customerId?: string): void {
    this.setFilters({ customerId });
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.log('Clearing filters');
    this.state.filters = { ...DEFAULT_ALARM_FILTERS };
    this.applyFilters();
    this.notifyStateChange();
    this.params.onFilterChange?.(this.state.filters);
  }

  /**
   * Apply all filters to alarms
   */
  private applyFilters(): void {
    const { search, severity, state, fromDate, toDate, customerId } = this.state.filters;

    let filtered = [...this.state.allAlarms];

    // Search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filtered = filtered.filter(
        (alarm) =>
          alarm.title.toLowerCase().includes(searchLower) ||
          alarm.description?.toLowerCase().includes(searchLower) ||
          alarm.source.toLowerCase().includes(searchLower) ||
          alarm.customerName.toLowerCase().includes(searchLower) ||
          alarm.id.toLowerCase().includes(searchLower)
      );
    }

    // Severity filter
    if (severity && severity.length > 0) {
      filtered = filtered.filter((alarm) => severity.includes(alarm.severity));
    }

    // State filter
    if (state && state.length > 0) {
      filtered = filtered.filter((alarm) => state.includes(alarm.state));
    }

    // Date range filter
    if (fromDate) {
      const fromTime = new Date(fromDate).getTime();
      filtered = filtered.filter((alarm) => {
        try {
          return new Date(alarm.lastOccurrence).getTime() >= fromTime;
        } catch {
          return true;
        }
      });
    }

    if (toDate) {
      const toTime = new Date(toDate).getTime() + 24 * 60 * 60 * 1000; // Include full day
      filtered = filtered.filter((alarm) => {
        try {
          return new Date(alarm.lastOccurrence).getTime() <= toTime;
        } catch {
          return true;
        }
      });
    }

    // Customer filter
    if (customerId) {
      filtered = filtered.filter((alarm) => alarm.customerId === customerId);
    }

    // Sort by last occurrence (most recent first)
    filtered.sort((a, b) => {
      try {
        return new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime();
      } catch {
        return 0;
      }
    });

    this.state.filteredAlarms = filtered;
    this.log('Filters applied', { total: this.state.allAlarms.length, filtered: filtered.length });
  }

  // =====================================================================
  // Tab Management
  // =====================================================================

  /**
   * Set active tab
   */
  setActiveTab(tab: AlarmsTab): void {
    if (this.state.activeTab !== tab) {
      this.log('Changing tab', { from: this.state.activeTab, to: tab });
      this.state.activeTab = tab;
      this.notifyStateChange();
      this.params.onTabChange?.(tab);
    }
  }

  /**
   * Get current active tab
   */
  getActiveTab(): AlarmsTab {
    return this.state.activeTab;
  }

  // =====================================================================
  // Theme Management
  // =====================================================================

  /**
   * Set theme mode
   */
  setThemeMode(mode: ThemeMode): void {
    if (this.state.themeMode !== mode) {
      this.log('Changing theme', { from: this.state.themeMode, to: mode });
      this.state.themeMode = mode;
      this.notifyStateChange();
    }
  }

  /**
   * Get current theme mode
   */
  getThemeMode(): ThemeMode {
    return this.state.themeMode;
  }

  // =====================================================================
  // Loading State
  // =====================================================================

  /**
   * Set loading state
   */
  setLoading(isLoading: boolean): void {
    if (this.state.isLoading !== isLoading) {
      this.state.isLoading = isLoading;
      this.notifyStateChange();
    }
  }

  /**
   * Get loading state
   */
  isLoading(): boolean {
    return this.state.isLoading;
  }

  // =====================================================================
  // Alarm Actions
  // =====================================================================

  /**
   * Handle alarm click
   */
  handleAlarmClick(alarm: Alarm): void {
    this.log('Alarm clicked', { id: alarm.id });
    this.params.onAlarmClick?.(alarm);
  }

  /**
   * Handle acknowledge action
   */
  async handleAcknowledge(alarmId: string): Promise<void> {
    this.log('Acknowledge requested', { alarmId });
    if (this.params.onAcknowledge) {
      await this.params.onAcknowledge(alarmId);
    }
  }

  /**
   * Handle escalate action
   */
  async handleEscalate(alarmId: string): Promise<void> {
    this.log('Escalate requested', { alarmId });
    if (this.params.onEscalate) {
      await this.params.onEscalate(alarmId);
    }
  }

  /**
   * Handle snooze action
   */
  async handleSnooze(alarmId: string, until: string): Promise<void> {
    this.log('Snooze requested', { alarmId, until });
    if (this.params.onSnooze) {
      await this.params.onSnooze(alarmId, until);
    }
  }

  /**
   * Handle close action
   */
  async handleClose(alarmId: string, reason: string): Promise<void> {
    this.log('Close requested', { alarmId, reason });
    if (this.params.onClose) {
      await this.params.onClose(alarmId, reason);
    }
  }

  // =====================================================================
  // State Access
  // =====================================================================

  /**
   * Get full state (for view)
   */
  getState(): AlarmsNotificationsPanelState {
    return { ...this.state };
  }

  // =====================================================================
  // Debug Logging
  // =====================================================================

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[AlarmsNotificationsPanelController]', ...args);
    }
  }
}
