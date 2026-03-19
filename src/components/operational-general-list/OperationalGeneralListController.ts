/**
 * RFC-0152 Phase 3: Operational General List Controller
 * Handles business logic for the OperationalGeneralList component
 */

import {
  EquipmentCardData,
  EquipmentStatus,
  EquipmentType,
  EquipmentFilterState,
  EquipmentStats,
  DEFAULT_EQUIPMENT_FILTER_STATE,
  DEFAULT_EQUIPMENT_STATS,
} from '../../types/operational';

import {
  ThemeMode,
  OperationalGeneralListParams,
  OperationalGeneralListState,
} from './types';

export class OperationalGeneralListController {
  private state: OperationalGeneralListState;
  private params: OperationalGeneralListParams;
  private onStateChange: ((state: OperationalGeneralListState) => void) | null = null;

  constructor(params: OperationalGeneralListParams) {
    this.params = params;

    this.state = {
      themeMode: params.themeMode || 'dark',
      allEquipment: params.equipment || [],
      filteredEquipment: [],
      filters: { ...DEFAULT_EQUIPMENT_FILTER_STATE },
      stats: { ...DEFAULT_EQUIPMENT_STATS },
      isLoading: false,
    };

    // Apply initial filters
    this.applyFilters();
  }

  // =========================================================================
  // State Management
  // =========================================================================

  setOnStateChange(callback: (state: OperationalGeneralListState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  getState(): OperationalGeneralListState {
    return { ...this.state };
  }

  // =========================================================================
  // Equipment Management
  // =========================================================================

  updateEquipment(equipment: EquipmentCardData[]): void {
    this.log('updateEquipment called with', equipment.length, 'items');
    this.state.allEquipment = equipment;
    this.applyFilters();
    this.notifyStateChange();
  }

  getEquipment(): EquipmentCardData[] {
    return [...this.state.allEquipment];
  }

  getFilteredEquipment(): EquipmentCardData[] {
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

  setStatusFilter(status: EquipmentStatus | 'all'): void {
    this.state.filters.statusFilter = status;
    this.applyFilters();
    this.notifyStateChange();
  }

  setTypeFilter(type: EquipmentType | 'all'): void {
    this.state.filters.typeFilter = type;
    this.applyFilters();
    this.notifyStateChange();
  }

  setCustomerFilter(customerIds: string[]): void {
    this.state.filters.customerIds = customerIds;
    this.applyFilters();
    this.notifyStateChange();
  }

  setFilters(filters: Partial<EquipmentFilterState>): void {
    this.state.filters = {
      ...this.state.filters,
      ...filters,
    };
    this.applyFilters();
    this.notifyStateChange();
  }

  clearFilters(): void {
    this.state.filters = { ...DEFAULT_EQUIPMENT_FILTER_STATE };
    this.applyFilters();
    this.notifyStateChange();
  }

  getFilters(): EquipmentFilterState {
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
          eq.customerName.toLowerCase().includes(query) ||
          eq.location.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (this.state.filters.statusFilter !== 'all') {
      filtered = filtered.filter(
        (eq) => eq.status === this.state.filters.statusFilter
      );
    }

    // Apply type filter
    if (this.state.filters.typeFilter !== 'all') {
      filtered = filtered.filter(
        (eq) => eq.type === this.state.filters.typeFilter
      );
    }

    // Apply customer filter
    if (this.state.filters.customerIds.length > 0) {
      const customerIdsLower = this.state.filters.customerIds.map((id) =>
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

    // Apply selected IDs filter (premium modal)
    if (this.state.filters.selectedIds && this.state.filters.selectedIds.size > 0) {
      filtered = filtered.filter((eq) => this.state.filters.selectedIds?.has(eq.id));
    }

    // Apply sort mode (premium modal)
    const sortMode = this.state.filters.sortMode;
    if (sortMode) {
      filtered = [...filtered].sort((a, b) => {
        switch (sortMode) {
          case 'alpha_asc':
            return a.name.localeCompare(b.name);
          case 'alpha_desc':
            return b.name.localeCompare(a.name);
          case 'status_asc':
            return String(a.status).localeCompare(String(b.status));
          case 'status_desc':
            return String(b.status).localeCompare(String(a.status));
          case 'shopping_asc':
            return String(a.customerName).localeCompare(String(b.customerName));
          case 'shopping_desc':
            return String(b.customerName).localeCompare(String(a.customerName));
          case 'cons_asc':
            return (a.recentAlerts || 0) - (b.recentAlerts || 0);
          case 'cons_desc':
          default:
            return (b.recentAlerts || 0) - (a.recentAlerts || 0);
        }
      });
    }

    this.state.filteredEquipment = filtered;
    this.state.stats = this.calculateStats(filtered);

    // Notify stats update
    if (this.params.onStatsUpdate) {
      this.params.onStatsUpdate(this.state.stats);
    }

    // Notify filter change
    if (this.params.onFilterChange) {
      this.params.onFilterChange(this.state.filters);
    }
  }

  // =========================================================================
  // Stats Calculation
  // =========================================================================

  getStats(): EquipmentStats {
    return { ...this.state.stats };
  }

  private calculateStats(equipment: EquipmentCardData[]): EquipmentStats {
    const stats: EquipmentStats = {
      total: equipment.length,
      online: 0,
      offline: 0,
      maintenance: 0,
      fleetAvailability: 0,
      avgMtbf: 0,
      avgMttr: 0,
    };

    if (equipment.length === 0) {
      return stats;
    }

    let totalAvailability = 0;
    let totalMtbf = 0;
    let totalMttr = 0;

    equipment.forEach((eq) => {
      // Status counts
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
      }

      // Accumulate for averages
      totalAvailability += eq.availability;
      totalMtbf += eq.mtbf;
      totalMttr += eq.mttr;
    });

    // Calculate averages
    stats.fleetAvailability = totalAvailability / equipment.length;
    stats.avgMtbf = totalMtbf / equipment.length;
    stats.avgMttr = totalMttr / equipment.length;

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
      console.log('[OperationalGeneralListController]', ...args);
    }
  }
}
