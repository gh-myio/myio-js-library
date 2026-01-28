/**
 * RFC-0152 Phase 4: Device Operational Card Controller
 * Handles business logic for the DeviceOperationalCard component
 */

import { Alarm, AlarmStats, DEFAULT_ALARM_STATS } from '../../types/alarm';

import {
  ThemeMode,
  DeviceOperationalCardFilterState,
  DeviceOperationalCardState,
  DeviceOperationalCardParams,
  AlarmSortMode,
  SEVERITY_ORDER,
  DEFAULT_DEVICE_OPERATIONAL_CARD_FILTER_STATE,
} from './types';

import type { AlarmSeverity, AlarmState } from '../../types/alarm';

export class DeviceOperationalCardController {
  private state: DeviceOperationalCardState;
  private params: DeviceOperationalCardParams;
  private onStateChange: ((state: DeviceOperationalCardState) => void) | null = null;

  constructor(params: DeviceOperationalCardParams) {
    this.params = params;

    this.state = {
      themeMode: params.themeMode || 'dark',
      allAlarms: params.alarms || [],
      filteredAlarms: [],
      filters: { ...DEFAULT_DEVICE_OPERATIONAL_CARD_FILTER_STATE },
      stats: { ...DEFAULT_ALARM_STATS },
      isLoading: false,
    };

    // Apply initial filters
    this.applyFilters();
  }

  // =========================================================================
  // State Management
  // =========================================================================

  setOnStateChange(callback: (state: DeviceOperationalCardState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  getState(): DeviceOperationalCardState {
    return { ...this.state };
  }

  // =========================================================================
  // Alarms Management
  // =========================================================================

  updateAlarms(alarms: Alarm[]): void {
    this.log('updateAlarms called with', alarms.length, 'items');
    this.state.allAlarms = alarms;
    this.applyFilters();
    this.notifyStateChange();
  }

  getAlarms(): Alarm[] {
    return [...this.state.allAlarms];
  }

  getFilteredAlarms(): Alarm[] {
    return [...this.state.filteredAlarms];
  }

  // =========================================================================
  // Theme Management
  // =========================================================================

  setThemeMode(mode: ThemeMode): void {
    this.state.themeMode = mode;
    this.notifyStateChange();
  }

  getThemeMode(): ThemeMode {
    return this.state.themeMode;
  }

  // =========================================================================
  // Filter Management
  // =========================================================================

  setSearchQuery(query: string): void {
    this.state.filters.searchQuery = query;
    this.applyFilters();
    this.notifyStateChange();
  }

  setSeverityFilter(severity: AlarmSeverity[] | 'all'): void {
    this.state.filters.severityFilter = severity;
    this.applyFilters();
    this.notifyStateChange();
  }

  setStateFilter(state: AlarmState[] | 'all'): void {
    this.state.filters.stateFilter = state;
    this.applyFilters();
    this.notifyStateChange();
  }

  setCustomerFilter(customerIds: string[]): void {
    this.state.filters.customerIds = customerIds;
    this.applyFilters();
    this.notifyStateChange();
  }

  setSortMode(sortMode: AlarmSortMode): void {
    this.state.filters.sortMode = sortMode;
    this.applyFilters();
    this.notifyStateChange();
  }

  setDateRange(fromDate: string | null, toDate: string | null): void {
    this.state.filters.fromDate = fromDate;
    this.state.filters.toDate = toDate;
    this.applyFilters();
    this.notifyStateChange();
  }

  setFilters(filters: Partial<DeviceOperationalCardFilterState>): void {
    this.state.filters = {
      ...this.state.filters,
      ...filters,
    };
    this.applyFilters();
    this.notifyStateChange();
  }

  clearFilters(): void {
    this.state.filters = { ...DEFAULT_DEVICE_OPERATIONAL_CARD_FILTER_STATE };
    this.applyFilters();
    this.notifyStateChange();
  }

  getFilters(): DeviceOperationalCardFilterState {
    return { ...this.state.filters };
  }

  private applyFilters(): void {
    let filtered = [...this.state.allAlarms];

    // Apply search filter
    if (this.state.filters.searchQuery) {
      const query = this.state.filters.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (alarm) =>
          alarm.title.toLowerCase().includes(query) ||
          alarm.customerName.toLowerCase().includes(query) ||
          alarm.source.toLowerCase().includes(query) ||
          alarm.id.toLowerCase().includes(query)
      );
    }

    // Apply severity filter
    if (this.state.filters.severityFilter !== 'all') {
      const severities = this.state.filters.severityFilter;
      filtered = filtered.filter((alarm) => severities.includes(alarm.severity));
    }

    // Apply state filter
    if (this.state.filters.stateFilter !== 'all') {
      const states = this.state.filters.stateFilter;
      filtered = filtered.filter((alarm) => states.includes(alarm.state));
    }

    // Apply customer filter
    if (this.state.filters.customerIds.length > 0) {
      const customerIdsLower = this.state.filters.customerIds.map((id) =>
        id.toLowerCase()
      );
      filtered = filtered.filter((alarm) => {
        const customerId = (alarm.customerId || '').toLowerCase();
        const customerName = alarm.customerName.toLowerCase();
        return (
          customerIdsLower.includes(customerId) ||
          customerIdsLower.includes(customerName)
        );
      });
    }

    // Apply date range filter
    if (this.state.filters.fromDate) {
      const fromDate = new Date(this.state.filters.fromDate).getTime();
      filtered = filtered.filter(
        (alarm) => new Date(alarm.lastOccurrence).getTime() >= fromDate
      );
    }
    if (this.state.filters.toDate) {
      const toDate = new Date(this.state.filters.toDate).getTime();
      filtered = filtered.filter(
        (alarm) => new Date(alarm.lastOccurrence).getTime() <= toDate
      );
    }

    // Apply sorting
    filtered = this.sortAlarms(filtered, this.state.filters.sortMode);

    this.state.filteredAlarms = filtered;
    this.state.stats = this.calculateStats(this.state.allAlarms);

    // Notify stats update
    if (this.params.onStatsUpdate) {
      this.params.onStatsUpdate(this.state.stats);
    }

    // Notify filter change
    if (this.params.onFilterChange) {
      this.params.onFilterChange(this.state.filters);
    }
  }

  private sortAlarms(alarms: Alarm[], sortMode: AlarmSortMode): Alarm[] {
    const sorted = [...alarms];

    switch (sortMode) {
      case 'date_desc':
        sorted.sort(
          (a, b) =>
            new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime()
        );
        break;
      case 'date_asc':
        sorted.sort(
          (a, b) =>
            new Date(a.lastOccurrence).getTime() - new Date(b.lastOccurrence).getTime()
        );
        break;
      case 'severity_desc':
        sorted.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
        break;
      case 'severity_asc':
        sorted.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
        break;
      case 'occurrences_desc':
        sorted.sort((a, b) => b.occurrenceCount - a.occurrenceCount);
        break;
      case 'occurrences_asc':
        sorted.sort((a, b) => a.occurrenceCount - b.occurrenceCount);
        break;
      case 'alpha_asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'alpha_desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return sorted;
  }

  // =========================================================================
  // Stats Calculation
  // =========================================================================

  getStats(): AlarmStats {
    return { ...this.state.stats };
  }

  private calculateStats(alarms: Alarm[]): AlarmStats {
    const stats: AlarmStats = {
      total: alarms.length,
      bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
      byState: { OPEN: 0, ACK: 0, SNOOZED: 0, ESCALATED: 0, CLOSED: 0 },
      openCritical: 0,
      openHigh: 0,
      last24Hours: 0,
    };

    if (alarms.length === 0) {
      return stats;
    }

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    alarms.forEach((alarm) => {
      // Count by severity
      stats.bySeverity[alarm.severity]++;

      // Count by state
      stats.byState[alarm.state]++;

      // Count open critical
      if (alarm.state === 'OPEN' && alarm.severity === 'CRITICAL') {
        stats.openCritical++;
      }

      // Count open high
      if (alarm.state === 'OPEN' && alarm.severity === 'HIGH') {
        stats.openHigh++;
      }

      // Count last 24 hours
      const alarmTime = new Date(alarm.lastOccurrence).getTime();
      if (alarmTime >= twentyFourHoursAgo) {
        stats.last24Hours++;
      }
    });

    return stats;
  }

  // =========================================================================
  // Loading State
  // =========================================================================

  setLoading(isLoading: boolean): void {
    this.state.isLoading = isLoading;
    this.notifyStateChange();
  }

  isLoading(): boolean {
    return this.state.isLoading;
  }

  // =========================================================================
  // Debug
  // =========================================================================

  private log(...args: unknown[]): void {
    if (this.params.enableDebugMode) {
      console.log('[DeviceOperationalCardController]', ...args);
    }
  }
}
