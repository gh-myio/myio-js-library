/**
 * RFC-0152 Phase 3: Device Operational Card Grid Controller
 * Handles business logic for the equipment grid component
 */

import {
  OperationalEquipment,
  ThemeMode,
  SortMode,
  DeviceOperationalCardGridFilterState,
  DeviceOperationalCardGridStats,
  DeviceOperationalCardGridParams,
  DeviceOperationalCardGridState,
  DEFAULT_GRID_FILTER_STATE,
} from './types';

export class DeviceOperationalCardGridController {
  private state: DeviceOperationalCardGridState;
  private params: DeviceOperationalCardGridParams;
  private onStateChange: ((state: DeviceOperationalCardGridState) => void) | null = null;

  constructor(params: DeviceOperationalCardGridParams) {
    this.params = params;

    this.state = {
      themeMode: params.themeMode || 'dark',
      allEquipment: params.equipment || [],
      filteredEquipment: [],
      filters: { ...DEFAULT_GRID_FILTER_STATE },
      stats: this.createEmptyStats(),
      isLoading: false,
    };

    // Apply initial filters
    this.applyFilters();
  }

  // =========================================================================
  // State Management
  // =========================================================================

  setOnStateChange(callback: (state: DeviceOperationalCardGridState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  getState(): DeviceOperationalCardGridState {
    return { ...this.state };
  }

  // =========================================================================
  // Equipment Management
  // =========================================================================

  updateEquipment(equipment: OperationalEquipment[]): void {
    this.log('updateEquipment called with', equipment.length, 'items');
    this.state.allEquipment = equipment;
    this.applyFilters();
    this.notifyStateChange();
  }

  getEquipment(): OperationalEquipment[] {
    return [...this.state.allEquipment];
  }

  getFilteredEquipment(): OperationalEquipment[] {
    return [...this.state.filteredEquipment];
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

  setTypeFilter(type: 'all' | 'escada' | 'elevador' | 'other'): void {
    this.state.filters.typeFilter = type;
    this.applyFilters();
    this.notifyStateChange();
  }

  setStatusFilter(status: 'all' | 'online' | 'offline' | 'maintenance' | 'warning'): void {
    this.state.filters.statusFilter = status;
    this.applyFilters();
    this.notifyStateChange();
  }

  setCustomerFilter(customerIds: string[]): void {
    this.state.filters.selectedCustomerIds = customerIds;
    this.applyFilters();
    this.notifyStateChange();
  }

  setSortMode(sortMode: SortMode): void {
    this.state.filters.sortMode = sortMode;
    this.applyFilters();
    this.notifyStateChange();
  }

  setFilters(filters: Partial<DeviceOperationalCardGridFilterState>): void {
    this.state.filters = {
      ...this.state.filters,
      ...filters,
    };
    this.applyFilters();
    this.notifyStateChange();
  }

  clearFilters(): void {
    this.state.filters = { ...DEFAULT_GRID_FILTER_STATE };
    this.applyFilters();
    this.notifyStateChange();
  }

  getFilters(): DeviceOperationalCardGridFilterState {
    return { ...this.state.filters };
  }

  private applyFilters(): void {
    let filtered = [...this.state.allEquipment];

    // Apply search filter
    if (this.state.filters.searchQuery) {
      const query = this.state.filters.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (eq) =>
          eq.name.toLowerCase().includes(query) ||
          eq.identifier.toLowerCase().includes(query) ||
          eq.customerName.toLowerCase().includes(query) ||
          eq.location.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (this.state.filters.typeFilter !== 'all') {
      filtered = filtered.filter((eq) => eq.type === this.state.filters.typeFilter);
    }

    // Apply status filter
    if (this.state.filters.statusFilter !== 'all') {
      filtered = filtered.filter((eq) => eq.status === this.state.filters.statusFilter);
    }

    // Apply customer filter
    if (this.state.filters.selectedCustomerIds.length > 0) {
      const customerIdsLower = this.state.filters.selectedCustomerIds.map((id) =>
        id.toLowerCase()
      );
      filtered = filtered.filter((eq) => {
        const customerId = (eq.customerId || '').toLowerCase();
        const customerName = eq.customerName.toLowerCase();
        return (
          customerIdsLower.includes(customerId) ||
          customerIdsLower.includes(customerName)
        );
      });
    }

    // Apply explicit selection filter (from filter modal)
    if (this.state.filters.selectedIds && this.state.filters.selectedIds.size > 0) {
      const selected = this.state.filters.selectedIds;
      filtered = filtered.filter((eq) => selected.has(String(eq.id)));
    }

    // Apply sorting
    filtered = this.sortEquipment(filtered, this.state.filters.sortMode);

    this.state.filteredEquipment = filtered;
    this.state.stats = this.calculateStats(this.state.allEquipment, filtered);

    // Notify stats update
    if (this.params.onStatsUpdate) {
      this.params.onStatsUpdate(this.state.stats);
    }

    // Notify filter change
    if (this.params.onFilterChange) {
      this.params.onFilterChange(this.state.filters);
    }
  }

  private sortEquipment(equipment: OperationalEquipment[], sortMode: SortMode): OperationalEquipment[] {
    const sorted = [...equipment];

    switch (sortMode) {
      case 'availability_desc':
        sorted.sort((a, b) => b.availability - a.availability);
        break;
      case 'availability_asc':
        sorted.sort((a, b) => a.availability - b.availability);
        break;
      case 'mtbf_desc':
        sorted.sort((a, b) => b.mtbf - a.mtbf);
        break;
      case 'mtbf_asc':
        sorted.sort((a, b) => a.mtbf - b.mtbf);
        break;
      case 'mttr_desc':
        sorted.sort((a, b) => b.mttr - a.mttr);
        break;
      case 'mttr_asc':
        sorted.sort((a, b) => a.mttr - b.mttr);
        break;
      case 'alerts_desc':
        sorted.sort((a, b) => (b.recentAlerts + b.openAlarms) - (a.recentAlerts + a.openAlarms));
        break;
      case 'alerts_asc':
        sorted.sort((a, b) => (a.recentAlerts + a.openAlarms) - (b.recentAlerts + b.openAlarms));
        break;
      case 'alpha_asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'alpha_desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'status_asc':
        sorted.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case 'status_desc':
        sorted.sort((a, b) => b.status.localeCompare(a.status));
        break;
    }

    return sorted;
  }

  // =========================================================================
  // Stats Calculation
  // =========================================================================

  getStats(): DeviceOperationalCardGridStats {
    return { ...this.state.stats };
  }

  private calculateStats(
    allEquipment: OperationalEquipment[],
    filteredEquipment: OperationalEquipment[]
  ): DeviceOperationalCardGridStats {
    const stats: DeviceOperationalCardGridStats = {
      total: allEquipment.length,
      online: 0,
      offline: 0,
      maintenance: 0,
      warning: 0,
      avgAvailability: 0,
      avgMtbf: 0,
      avgMttr: 0,
      totalAlerts: 0,
      filteredCount: filteredEquipment.length,
    };

    if (filteredEquipment.length === 0) {
      return stats;
    }

    let totalAvailability = 0;
    let totalMtbf = 0;
    let totalMttr = 0;

    filteredEquipment.forEach((eq) => {
      // Count by status
      switch (eq.status) {
        case 'online':
          stats.online++;
          break;
        case 'offline':
          stats.offline++;
          break;
        case 'maintenance':
          stats.maintenance++;
          break;
        case 'warning':
          stats.warning++;
          break;
      }

      // Sum KPIs
      totalAvailability += eq.availability;
      totalMtbf += eq.mtbf;
      totalMttr += eq.mttr;
      stats.totalAlerts += eq.recentAlerts + eq.openAlarms;
    });

    // Calculate averages
    stats.avgAvailability = totalAvailability / filteredEquipment.length;
    stats.avgMtbf = totalMtbf / filteredEquipment.length;
    stats.avgMttr = totalMttr / filteredEquipment.length;

    return stats;
  }

  private createEmptyStats(): DeviceOperationalCardGridStats {
    return {
      total: 0,
      online: 0,
      offline: 0,
      maintenance: 0,
      warning: 0,
      avgAvailability: 0,
      avgMtbf: 0,
      avgMttr: 0,
      totalAlerts: 0,
      filteredCount: 0,
    };
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
      console.log('[DeviceOperationalCardGridController]', ...args);
    }
  }
}
