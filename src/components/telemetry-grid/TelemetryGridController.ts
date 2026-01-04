/**
 * RFC-0121: TelemetryGrid Controller
 * Handles business logic for the TelemetryGrid component
 */

import {
  TelemetryDevice,
  TelemetryDomain,
  TelemetryContext,
  ThemeMode,
  SortMode,
  FilterState,
  TelemetryStats,
  TelemetryGridParams,
  DOMAIN_CONFIG,
  CONTEXT_CONFIG,
  mapContextToOrchestrator,
} from './types';

export interface TelemetryGridState {
  domain: TelemetryDomain;
  context: TelemetryContext;
  themeMode: ThemeMode;
  allDevices: TelemetryDevice[];
  filteredDevices: TelemetryDevice[];
  filters: FilterState;
  stats: TelemetryStats;
  isLoading: boolean;
}

export class TelemetryGridController {
  private state: TelemetryGridState;
  private params: TelemetryGridParams;
  private onStateChange: ((state: TelemetryGridState) => void) | null = null;

  constructor(params: TelemetryGridParams) {
    this.params = params;

    this.state = {
      domain: params.domain,
      context: params.context,
      themeMode: params.themeMode || 'dark',
      allDevices: params.devices || [],
      filteredDevices: [],
      filters: {
        searchTerm: '',
        selectedShoppingIds: [],
        selectedDeviceIds: null,
        sortMode: 'cons_desc',
        statusFilter: null,
      },
      stats: this.createEmptyStats(),
      isLoading: false,
    };

    // Apply initial filters
    this.applyFilters();
  }

  // =========================================================================
  // State Management
  // =========================================================================

  setOnStateChange(callback: (state: TelemetryGridState) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  getState(): TelemetryGridState {
    return { ...this.state };
  }

  // =========================================================================
  // Device Management
  // =========================================================================

  updateDevices(devices: TelemetryDevice[]): void {
    // Ensure all devices have deviceStatus calculated
    const processedDevices = devices.map((device) => {
      if (!device.deviceStatus) {
        device.deviceStatus = this.calculateDeviceStatus(device);
      }
      device.domain = this.state.domain;
      return device;
    });

    this.state.allDevices = processedDevices;
    this.applyFilters();
    this.notifyStateChange();
  }

  getDevices(): TelemetryDevice[] {
    return [...this.state.allDevices];
  }

  getFilteredDevices(): TelemetryDevice[] {
    return [...this.state.filteredDevices];
  }

  // =========================================================================
  // Config Management
  // =========================================================================

  updateConfig(domain: TelemetryDomain, context: TelemetryContext): void {
    this.state.domain = domain;
    this.state.context = context;

    // Update domain on all devices
    this.state.allDevices.forEach((device) => {
      device.domain = domain;
    });

    this.notifyStateChange();
  }

  getDomain(): TelemetryDomain {
    return this.state.domain;
  }

  getContext(): TelemetryContext {
    return this.state.context;
  }

  getMappedContext(): TelemetryContext {
    return mapContextToOrchestrator(this.state.context, this.state.domain);
  }

  getDomainConfig() {
    return DOMAIN_CONFIG[this.state.domain];
  }

  getContextConfig() {
    return CONTEXT_CONFIG[this.state.context];
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

  setSearchTerm(term: string): void {
    this.state.filters.searchTerm = term;
    this.applyFilters();
    this.notifyStateChange();
  }

  setShoppingFilter(shoppingIds: string[]): void {
    this.state.filters.selectedShoppingIds = shoppingIds;
    this.applyFilters();
    this.notifyStateChange();
  }

  setDeviceFilter(deviceIds: Set<string> | null): void {
    this.state.filters.selectedDeviceIds = deviceIds;
    this.applyFilters();
    this.notifyStateChange();
  }

  setSortMode(mode: SortMode): void {
    this.state.filters.sortMode = mode;
    this.applyFilters();
    this.notifyStateChange();
  }

  setStatusFilter(status: string | null): void {
    this.state.filters.statusFilter = status;
    this.applyFilters();
    this.notifyStateChange();
  }

  clearFilters(): void {
    this.state.filters = {
      searchTerm: '',
      selectedShoppingIds: [],
      selectedDeviceIds: null,
      sortMode: 'cons_desc',
      statusFilter: null,
    };
    this.applyFilters();
    this.notifyStateChange();
  }

  getFilters(): FilterState {
    return { ...this.state.filters };
  }

  private applyFilters(): void {
    let filtered = [...this.state.allDevices];

    // Apply search filter
    if (this.state.filters.searchTerm) {
      const term = this.state.filters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          (d.labelOrName || '').toLowerCase().includes(term) ||
          (d.deviceIdentifier || '').toLowerCase().includes(term) ||
          (d.customerName || '').toLowerCase().includes(term)
      );
    }

    // Apply shopping filter
    if (this.state.filters.selectedShoppingIds.length > 0) {
      filtered = filtered.filter((d) =>
        this.state.filters.selectedShoppingIds.includes(d.customerId)
      );
    }

    // Apply device IDs filter
    if (
      this.state.filters.selectedDeviceIds &&
      this.state.filters.selectedDeviceIds.size > 0
    ) {
      filtered = filtered.filter((d) =>
        this.state.filters.selectedDeviceIds!.has(d.entityId)
      );
    }

    // Apply status filter
    if (this.state.filters.statusFilter) {
      filtered = filtered.filter(
        (d) => d.deviceStatus === this.state.filters.statusFilter
      );
    }

    // Apply sort
    filtered = this.sortDevices(filtered, this.state.filters.sortMode);

    this.state.filteredDevices = filtered;
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

  private sortDevices(
    devices: TelemetryDevice[],
    sortMode: SortMode
  ): TelemetryDevice[] {
    return [...devices].sort((a, b) => {
      switch (sortMode) {
        case 'cons_desc':
          return (b.val || 0) - (a.val || 0);
        case 'cons_asc':
          return (a.val || 0) - (b.val || 0);
        case 'alpha_asc':
          return (a.labelOrName || '').localeCompare(b.labelOrName || '');
        case 'alpha_desc':
          return (b.labelOrName || '').localeCompare(a.labelOrName || '');
        case 'status_asc':
          return (a.deviceStatus || '').localeCompare(b.deviceStatus || '');
        case 'status_desc':
          return (b.deviceStatus || '').localeCompare(a.deviceStatus || '');
        case 'shopping_asc':
          return (a.customerName || a.centralName || '').localeCompare(
            b.customerName || b.centralName || '',
            'pt-BR',
            { sensitivity: 'base' }
          );
        case 'shopping_desc':
          return (b.customerName || b.centralName || '').localeCompare(
            a.customerName || a.centralName || '',
            'pt-BR',
            { sensitivity: 'base' }
          );
        default:
          return 0;
      }
    });
  }

  // =========================================================================
  // Stats Calculation
  // =========================================================================

  getStats(): TelemetryStats {
    return { ...this.state.stats };
  }

  private calculateStats(devices: TelemetryDevice[]): TelemetryStats {
    const stats: TelemetryStats = {
      total: this.state.allDevices.length,
      online: 0,
      offline: 0,
      notInstalled: 0,
      noInfo: 0,
      withConsumption: 0,
      noConsumption: 0,
      totalConsumption: 0,
      filteredCount: devices.length,
    };

    devices.forEach((device) => {
      // Status counts
      switch (device.deviceStatus) {
        case 'power_on':
          stats.online++;
          break;
        case 'offline':
          stats.offline++;
          break;
        case 'not_installed':
          stats.notInstalled++;
          break;
        case 'no_info':
          stats.noInfo++;
          break;
      }

      // Consumption counts
      const consumption = Number(device.val) || Number(device.value) || 0;
      if (consumption > 0) {
        stats.withConsumption++;
        stats.totalConsumption += consumption;
      } else {
        stats.noConsumption++;
      }
    });

    return stats;
  }

  private createEmptyStats(): TelemetryStats {
    return {
      total: 0,
      online: 0,
      offline: 0,
      notInstalled: 0,
      noInfo: 0,
      withConsumption: 0,
      noConsumption: 0,
      totalConsumption: 0,
      filteredCount: 0,
    };
  }

  // =========================================================================
  // Device Status Calculation
  // =========================================================================

  calculateDeviceStatus(device: TelemetryDevice): string {
    const domainConfig = DOMAIN_CONFIG[this.state.domain];
    const telemetryTs = this.getTelemetryTimestamp(device, domainConfig);

    // Use centralized RFC-0110 function if available
    const calculateDeviceStatusMasterRules =
      (window as unknown as Record<string, unknown>).MyIOUtils &&
      typeof (
        (window as unknown as Record<string, Record<string, unknown>>).MyIOUtils
          .calculateDeviceStatusMasterRules
      ) === 'function'
        ? (
            (
              window as unknown as Record<
                string,
                { calculateDeviceStatusMasterRules: (opts: unknown) => string }
              >
            ).MyIOUtils.calculateDeviceStatusMasterRules as (
              opts: unknown
            ) => string
          )
        : null;

    if (calculateDeviceStatusMasterRules) {
      return calculateDeviceStatusMasterRules({
        connectionStatus: device.connectionStatus,
        telemetryTimestamp: telemetryTs,
        delayMins: domainConfig.delayMins,
        domain: this.state.domain,
      });
    }

    // Fallback logic
    if (
      !device.connectionStatus ||
      device.connectionStatus === 'offline' ||
      device.connectionStatus === 'disconnected'
    ) {
      return 'offline';
    }

    if (!telemetryTs) {
      return 'no_info';
    }

    const now = Date.now();
    const staleThreshold = domainConfig.delayMins * 60 * 1000;
    if (now - telemetryTs > staleThreshold) {
      return 'offline';
    }

    return 'power_on';
  }

  private getTelemetryTimestamp(
    device: TelemetryDevice,
    domainConfig: { telemetryTimestampField: string; telemetryTimestampFieldAlt?: string }
  ): number | null {
    const primaryField = domainConfig.telemetryTimestampField as keyof TelemetryDevice;
    const altField = domainConfig.telemetryTimestampFieldAlt as keyof TelemetryDevice | undefined;

    let timestamp = device[primaryField] as number | undefined;
    if (!timestamp && altField) {
      timestamp = device[altField] as number | undefined;
    }
    return timestamp || null;
  }

  // =========================================================================
  // Device Selection
  // =========================================================================

  isDeviceSelected(deviceId: string): boolean {
    // Use global selection store if available
    const store =
      ((window as unknown as Record<string, unknown>).MyIOLibrary as Record<
        string,
        { getSelectedIds: () => string[] }
      > | undefined)?.MyIOSelectionStore ||
      ((window as unknown as Record<string, { getSelectedIds: () => string[] }>)
        .MyIOSelectionStore as { getSelectedIds: () => string[] } | undefined);

    if (store && typeof store.getSelectedIds === 'function') {
      return store.getSelectedIds().includes(deviceId);
    }

    return false;
  }

  selectDevice(deviceId: string, device: TelemetryDevice): void {
    const store =
      ((window as unknown as Record<string, unknown>).MyIOLibrary as Record<
        string,
        {
          registerEntity?: (entity: unknown) => void;
          add: (id: string) => void;
        }
      > | undefined)?.MyIOSelectionStore ||
      ((window as unknown as Record<string, unknown>).MyIOSelectionStore as {
        registerEntity?: (entity: unknown) => void;
        add: (id: string) => void;
      } | undefined);

    if (store) {
      if (typeof store.registerEntity === 'function') {
        store.registerEntity(device);
      }
      store.add(deviceId);
    }

    if (this.params.onDeviceSelect) {
      this.params.onDeviceSelect(deviceId, true, device);
    }
  }

  deselectDevice(deviceId: string, device: TelemetryDevice): void {
    const store =
      ((window as unknown as Record<string, unknown>).MyIOLibrary as Record<
        string,
        { remove: (id: string) => void }
      > | undefined)?.MyIOSelectionStore ||
      ((window as unknown as Record<string, unknown>).MyIOSelectionStore as {
        remove: (id: string) => void;
      } | undefined);

    if (store && typeof store.remove === 'function') {
      store.remove(deviceId);
    }

    if (this.params.onDeviceSelect) {
      this.params.onDeviceSelect(deviceId, false, device);
    }
  }

  toggleDeviceSelection(deviceId: string, device: TelemetryDevice): void {
    if (this.isDeviceSelected(deviceId)) {
      this.deselectDevice(deviceId, device);
    } else {
      this.selectDevice(deviceId, device);
    }
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
    if (this.params.debugActive) {
      console.log('[TelemetryGridController]', ...args);
    }
  }
}
