/**
 * RFC-0125: FilterModal Component Types
 * 3-column filter modal for device grids
 */

export type FilterModalThemeMode = 'dark' | 'light';
export type FilterModalDomain = 'energy' | 'water' | 'temperature';

export type SortMode =
  | 'cons_desc'
  | 'cons_asc'
  | 'alpha_asc'
  | 'alpha_desc'
  | 'status_asc'
  | 'status_desc'
  | 'shopping_asc'
  | 'shopping_desc';

export interface FilterTab {
  id: string;
  label: string;
  filter: (item: FilterableDevice) => boolean;
}

export interface FilterableDevice {
  id?: string;
  entityId?: string;
  ingestionId?: string;
  label?: string;
  name?: string;
  labelOrName?: string;
  deviceName?: string;
  value?: number;
  val?: number;
  lastValue?: number;
  deviceStatus?: string;
  connectionStatus?: string;
  customerId?: string;
  customerName?: string;
  ownerName?: string;
  deviceType?: string;
  deviceProfile?: string;
}

export interface AppliedFilters {
  selectedIds: Set<string> | null;
  sortMode: SortMode;
  statusFilter?: string;
  consumptionFilter?: string;
}

export interface FilterModalParams {
  containerId: string;
  widgetName?: string;
  modalClass?: string;
  primaryColor?: string;
  itemIdAttr?: string;
  filterTabs?: FilterTab[];
  themeMode?: FilterModalThemeMode;
  getItemId?: (item: FilterableDevice) => string;
  getItemLabel?: (item: FilterableDevice) => string;
  getItemValue?: (item: FilterableDevice) => number;
  getItemSubLabel?: (item: FilterableDevice) => string;
  formatValue?: (val: number) => string;
  onApply?: (filters: AppliedFilters) => void;
  onClose?: () => void;
}

export interface FilterModalInstance {
  open: (items: FilterableDevice[], state?: FilterModalState) => void;
  close: () => void;
  setThemeMode: (mode: FilterModalThemeMode) => void;
  destroy: () => void;
}

export interface FilterModalState {
  selectedIds?: Set<string>;
  sortMode?: SortMode;
}

export interface FilterGroup {
  id: string;
  label: string;
  filters: string[];
}

export const FILTER_GROUPS: FilterGroup[] = [
  { id: 'connectivity', label: 'Conectividade', filters: ['online', 'offline', 'notInstalled'] },
  { id: 'maintenance', label: 'Manutenção', filters: ['maintenance'] },
  { id: 'status', label: 'Status', filters: ['alert', 'failure'] },
  {
    id: 'type',
    label: 'Tipo',
    filters: ['elevators', 'escalators', 'hvac', 'others', 'commonArea', 'stores'],
  },
];

export const FILTER_TAB_ICONS: Record<string, string> = {
  online: '⚡',
  offline: '🔴',
  notInstalled: '📦',
  maintenance: '🔧',
  alert: '⚠️',
  failure: '🚨',
  elevators: '🏙',
  escalators: '📶',
  hvac: '❄️',
  others: '⚙️',
  commonArea: '💧',
  stores: '🏪',
  all: '📊',
};

export const STATUS_TO_CONNECTIVITY: Record<string, string> = {
  alert: 'online',
  failure: 'online',
  maintenance: 'online',
  offline: 'offline',
};
