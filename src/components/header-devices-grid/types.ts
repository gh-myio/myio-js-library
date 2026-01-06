/**
 * RFC-0125: HeaderDevicesGrid Component Types
 * Stats header for device grids with connectivity, consumption, and action buttons
 */

export type HeaderDevicesDomain = 'energy' | 'water' | 'temperature';
export type HeaderDevicesThemeMode = 'dark' | 'light';

export interface HeaderStats {
  online: number;
  total: number;
  consumption: number;
  zeroCount: number;
}

export interface HeaderLabels {
  connectivity?: string;
  total?: string;
  consumption?: string;
  zero?: string;
}

export interface HeaderDevicesGridParams {
  container: HTMLElement | string;
  domain?: HeaderDevicesDomain;
  idPrefix?: string;
  labels?: HeaderLabels;
  themeMode?: HeaderDevicesThemeMode;
  includeSearch?: boolean;
  includeFilter?: boolean;
  onSearchClick?: () => void;
  onFilterClick?: () => void;
  onMaximizeClick?: (maximized: boolean) => void;
}

export interface HeaderDevicesGridInstance {
  element: HTMLElement;
  updateStats: (stats: HeaderStats) => void;
  updateFromDevices: (devices: HeaderDevice[], options?: { cache?: Map<string, { total_value: number }> }) => void;
  setThemeMode: (mode: HeaderDevicesThemeMode) => void;
  setDomain: (domain: HeaderDevicesDomain) => void;
  getSearchInput: () => HTMLInputElement | null;
  toggleSearch: (active?: boolean) => void;
  destroy: () => void;
}

export interface HeaderDevice {
  entityId?: string;
  ingestionId?: string;
  deviceStatus?: string;
  val?: number;
  value?: number;
  lastValue?: number;
}

export interface HeaderDomainConfig {
  totalLabel: string;
  consumptionLabel: string;
  zeroLabel: string;
  unit: string;
  formatValue: (value: number) => string;
}
