// FilterableCardGrid.types.ts
export type SortMode = 'CONSUMPTION_DESC' | 'CONSUMPTION_ASC' | 'ALPHA_ASC' | 'ALPHA_DESC';

export interface FilterableItem {
  id: string;
  label: string;
  consumption?: number | null;
  deviceType?: string;
  status?: string;
  [key: string]: any;  // Additional properties for custom rendering
}

export interface CardActions {
  onSelect: (checked: boolean) => void;
  onAction: (action: string, item: FilterableItem) => void;
  isSelected: boolean;
}

export interface CardHandle {
  getRoot: () => HTMLElement;
  update?: (item: FilterableItem) => void;
  destroy?: () => void;
}

export interface FilterOptions {
  searchPlaceholder?: string;
  searchFields?: string[];
  sortModes?: SortMode[];
  showCounter?: boolean;
  showBulkActions?: boolean;
}

export interface GridOptions {
  columns?: string;                   // CSS grid-template-columns
  minCardWidth?: string;
  gap?: string;
  enableVirtualization?: boolean;     // For 1000+ items
  virtualChunkSize?: number;
}

export interface FilterState {
  selectedIds: string[];
  sortMode: SortMode;
  searchTerm: string;
}

export interface I18nDict {
  searchPlaceholder: string;
  filtersButton: string;
  selectedCounter: string;
  emptyStateTitle: string;
  emptyStateDesc: string;
  loadingText: string;
  bulkExport: string;
}

export interface FilterableCardGridParams {
  items: FilterableItem[];
  renderCard?: (item: FilterableItem, actions: CardActions) => HTMLElement | CardHandle;
  initialSelected?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onCardAction?: (action: string, item: FilterableItem) => void;
  onFilterChange?: (filter: FilterState) => void;

  enableFiltering?: boolean;          // default: true
  enableSorting?: boolean;            // default: true
  enableSelection?: boolean;          // default: true
  enableBulkActions?: boolean;        // default: false

  filterOptions?: FilterOptions;
  gridOptions?: GridOptions;
  i18n?: Partial<I18nDict>;
}

export interface FilterableCardGridHandle {
  updateItems: (items: FilterableItem[]) => void;
  setSelection: (selectedIds: string[]) => void;
  getSelection: () => string[];
  applyFilter: (searchTerm: string) => void;
  setSortMode: (mode: SortMode) => void;
  openFilterModal: () => void;
  destroy: () => void;
  getContainer: () => HTMLElement;
}

export interface FilterableGridState {
  items: FilterableItem[];
  selectedIds: Set<string>;
  sortMode: SortMode;
  searchTerm: string;
  enableFiltering: boolean;
  enableSorting: boolean;
  enableSelection: boolean;
  enableBulkActions: boolean;
  filterOptions: Required<FilterOptions>;
  gridOptions: Required<GridOptions>;
  i18n: Required<I18nDict>;
  renderCard?: (item: FilterableItem, actions: CardActions) => HTMLElement | CardHandle;
  onSelectionChange?: (selectedIds: string[]) => void;
  onCardAction?: (action: string, item: FilterableItem) => void;
  onFilterChange?: (filter: FilterState) => void;
}