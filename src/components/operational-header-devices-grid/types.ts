/**
 * RFC-0152: OperationalHeaderDevicesGrid Component Types
 * Premium stats header for operational equipment grids
 */

export type OperationalHeaderThemeMode = 'dark' | 'light';

export interface OperationalHeaderStats {
  online: number;
  offline: number;
  maintenance: number;
  warning: number;
  total: number;
  avgAvailability: number;
  avgMtbf: number;
  avgMttr: number;
}

export interface OperationalHeaderLabels {
  title?: string;
  online?: string;
  offline?: string;
  maintenance?: string;
  availability?: string;
}

export interface CustomerOption {
  id: string;
  name: string;
}

export interface OperationalHeaderDevicesGridParams {
  container: HTMLElement | string;
  idPrefix?: string;
  labels?: OperationalHeaderLabels;
  themeMode?: OperationalHeaderThemeMode;
  includeSearch?: boolean;
  includeFilter?: boolean;
  includeCustomerFilter?: boolean;
  includeMaximize?: boolean;
  customers?: CustomerOption[];
  onSearchChange?: (query: string) => void;
  onFilterClick?: () => void;
  onCustomerChange?: (customerId: string) => void;
  onMaximizeClick?: (maximized: boolean) => void;
}

export interface OperationalHeaderDevicesGridInstance {
  element: HTMLElement | null;
  updateStats: (stats: Partial<OperationalHeaderStats>) => void;
  setThemeMode: (mode: OperationalHeaderThemeMode) => void;
  updateCustomers: (customers: CustomerOption[]) => void;
  setSelectedCustomer: (customerId: string) => void;
  getSearchInput: () => HTMLInputElement | null;
  toggleSearch: (active?: boolean) => void;
  destroy: () => void;
}
