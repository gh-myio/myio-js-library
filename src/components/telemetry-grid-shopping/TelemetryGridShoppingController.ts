/**
 * RFC-0145: TelemetryGridShopping Controller
 * Handles business logic: filtering, sorting, stats calculation
 */

import {
  TelemetryDevice,
  TelemetryDomain,
  TelemetryContext,
  ThemeMode,
  SortMode,
  FilterState,
  TelemetryStats,
  TelemetryGridShoppingParams,
  DOMAIN_CONFIG,
  getDeviceStatusCategory,
} from './types';

export class TelemetryGridShoppingController {
  private devices: TelemetryDevice[] = [];
  private filteredDevices: TelemetryDevice[] = [];
  private domain: TelemetryDomain;
  private context: TelemetryContext;
  private themeMode: ThemeMode;
  private debugActive: boolean;

  private filterState: FilterState = {
    searchTerm: '',
    sortMode: 'cons_desc',
    selectedDeviceIds: [],
    statusFilter: 'all',
    consumptionFilter: 'all',
  };

  private onStatsUpdate?: (stats: TelemetryStats) => void;
  private onFilterChange?: (filterState: FilterState) => void;

  constructor(params: TelemetryGridShoppingParams) {
    this.domain = params.domain;
    this.context = params.context;
    this.themeMode = params.themeMode || 'dark';
    this.debugActive = params.debugActive || false;
    this.devices = params.devices || [];
    this.onStatsUpdate = params.onStatsUpdate;
    this.onFilterChange = params.onFilterChange;

    this.applyFiltersAndSort();
  }

  private log(...args: unknown[]): void {
    if (this.debugActive) {
      console.log('[TelemetryGridShoppingController]', ...args);
    }
  }

  // =========================================================================
  // Device Management
  // =========================================================================

  updateDevices(devices: TelemetryDevice[]): void {
    this.log('updateDevices called with', devices.length, 'devices');
    this.devices = devices;
    this.applyFiltersAndSort();
  }

  getDevices(): TelemetryDevice[] {
    return this.devices;
  }

  getFilteredDevices(): TelemetryDevice[] {
    return this.filteredDevices;
  }

  // =========================================================================
  // Config
  // =========================================================================

  updateConfig(domain: TelemetryDomain, context: TelemetryContext): void {
    this.log('updateConfig:', domain, context);
    this.domain = domain;
    this.context = context;
    this.applyFiltersAndSort();
  }

  getDomain(): TelemetryDomain {
    return this.domain;
  }

  getContext(): TelemetryContext {
    return this.context;
  }

  // =========================================================================
  // Theme
  // =========================================================================

  setThemeMode(mode: ThemeMode): void {
    this.themeMode = mode;
  }

  getThemeMode(): ThemeMode {
    return this.themeMode;
  }

  // =========================================================================
  // Filtering
  // =========================================================================

  setSearchTerm(term: string): void {
    this.log('setSearchTerm:', term);
    this.filterState.searchTerm = term;
    this.applyFiltersAndSort();
    this.notifyFilterChange();
  }

  setSortMode(mode: SortMode): void {
    this.log('setSortMode:', mode);
    this.filterState.sortMode = mode;
    this.applyFiltersAndSort();
    this.notifyFilterChange();
  }

  setShoppingFilter(shoppingIds: string[]): void {
    this.log('setShoppingFilter:', shoppingIds);
    // Filter devices by customerId matching any of the shopping IDs
    // Empty array = no filter (show all)
    this.filterState.selectedDeviceIds = shoppingIds;
    this.applyFiltersAndSort();
    this.notifyFilterChange();
  }

  setStatusFilter(status: 'all' | 'online' | 'offline' | 'not_installed'): void {
    this.filterState.statusFilter = status;
    this.applyFiltersAndSort();
    this.notifyFilterChange();
  }

  setConsumptionFilter(filter: 'all' | 'with' | 'without'): void {
    this.filterState.consumptionFilter = filter;
    this.applyFiltersAndSort();
    this.notifyFilterChange();
  }

  setSelectedDeviceIds(ids: string[]): void {
    this.filterState.selectedDeviceIds = ids;
    this.applyFiltersAndSort();
    this.notifyFilterChange();
  }

  clearFilters(): void {
    this.log('clearFilters');
    this.filterState = {
      searchTerm: '',
      sortMode: 'cons_desc',
      selectedDeviceIds: [],
      statusFilter: 'all',
      consumptionFilter: 'all',
    };
    this.applyFiltersAndSort();
    this.notifyFilterChange();
  }

  getFilterState(): FilterState {
    return { ...this.filterState };
  }

  private notifyFilterChange(): void {
    if (this.onFilterChange) {
      this.onFilterChange(this.getFilterState());
    }
  }

  // =========================================================================
  // Core Filter & Sort Logic
  // =========================================================================

  private applyFiltersAndSort(): void {
    let result = [...this.devices];

    // 1. Search filter
    if (this.filterState.searchTerm) {
      const term = this.filterState.searchTerm.toLowerCase();
      result = result.filter((d) => {
        const name = (d.labelOrName || d.name || '').toLowerCase();
        const identifier = (d.deviceIdentifier || '').toLowerCase();
        return name.includes(term) || identifier.includes(term);
      });
    }

    // 2. Shopping/Customer filter (by customerId)
    if (this.filterState.selectedDeviceIds.length > 0) {
      const ids = new Set(this.filterState.selectedDeviceIds);
      result = result.filter((d) => ids.has(d.customerId) || ids.has(d.entityId));
    }

    // 3. Status filter
    if (this.filterState.statusFilter !== 'all') {
      result = result.filter((d) => {
        const category = getDeviceStatusCategory(d.deviceStatus);
        if (this.filterState.statusFilter === 'online') return category === 'online';
        if (this.filterState.statusFilter === 'offline') return category === 'offline';
        if (this.filterState.statusFilter === 'not_installed') return category === 'waiting';
        return true;
      });
    }

    // 4. Consumption filter
    if (this.filterState.consumptionFilter !== 'all') {
      result = result.filter((d) => {
        const val = Number(d.val) || 0;
        if (this.filterState.consumptionFilter === 'with') return val > 0;
        if (this.filterState.consumptionFilter === 'without') return val === 0;
        return true;
      });
    }

    // 5. Sort
    result = this.sortDevices(result, this.filterState.sortMode);

    // 6. Calculate percentages
    const totalConsumption = result.reduce((sum, d) => sum + (Number(d.val) || 0), 0);
    result = result.map((d) => ({
      ...d,
      perc: totalConsumption > 0 ? ((Number(d.val) || 0) / totalConsumption) * 100 : 0,
    }));

    this.filteredDevices = result;
    this.log('applyFiltersAndSort result:', result.length, 'devices');

    // Notify stats update
    this.notifyStatsUpdate();
  }

  private sortDevices(devices: TelemetryDevice[], mode: SortMode): TelemetryDevice[] {
    return [...devices].sort((a, b) => {
      const aVal = Number(a.val) || 0;
      const bVal = Number(b.val) || 0;
      const aName = (a.labelOrName || a.name || '').toLowerCase();
      const bName = (b.labelOrName || b.name || '').toLowerCase();

      switch (mode) {
        case 'cons_desc':
          return bVal - aVal || aName.localeCompare(bName);
        case 'cons_asc':
          return aVal - bVal || aName.localeCompare(bName);
        case 'alpha_asc':
          return aName.localeCompare(bName);
        case 'alpha_desc':
          return bName.localeCompare(aName);
        default:
          return 0;
      }
    });
  }

  // =========================================================================
  // Stats
  // =========================================================================

  getStats(): TelemetryStats {
    const devices = this.filteredDevices;
    const config = DOMAIN_CONFIG[this.domain];

    const stats: TelemetryStats = {
      total: this.devices.length,
      online: 0,
      offline: 0,
      notInstalled: 0,
      noInfo: 0,
      withConsumption: 0,
      noConsumption: 0,
      totalConsumption: 0,
      filteredCount: devices.length,
      unit: config.unit,
    };

    devices.forEach((d) => {
      // Status counting
      const category = getDeviceStatusCategory(d.deviceStatus);
      if (category === 'online') stats.online++;
      else if (category === 'offline') stats.offline++;
      else if (category === 'waiting') stats.notInstalled++;
      else stats.noInfo++;

      // Consumption counting
      const val = Number(d.val) || 0;
      if (val > 0) {
        stats.withConsumption++;
        stats.totalConsumption += val;
      } else {
        stats.noConsumption++;
      }
    });

    return stats;
  }

  private notifyStatsUpdate(): void {
    if (this.onStatsUpdate) {
      this.onStatsUpdate(this.getStats());
    }
  }
}
