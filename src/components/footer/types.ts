/**
 * RFC-0115: Footer Component Library
 * Type definitions for the Footer Component
 */

/**
 * Theme mode for the Footer Component
 */
export type FooterThemeMode = 'dark' | 'light';

/**
 * Unit type for devices (used for comparison validation)
 */
export type UnitType = 'energy' | 'water' | 'tank' | 'temperature';

/**
 * Color palette for the Footer Component
 */
export interface FooterColors {
  /** Primary brand color (default: #9E8CBE) */
  primary: string;
  /** Primary hover color (default: #B8A5D6) */
  primaryHover: string;
  /** Primary dark color (default: #8472A8) */
  primaryDark: string;
  /** Background color (default: #0f1419) */
  background: string;
  /** Surface color (default: #1a1f28) */
  surface: string;
  /** Elevated surface color (default: #242b36) */
  surfaceElevated: string;
  /** Primary text color (default: #ffffff) */
  textPrimary: string;
  /** Secondary text color (default: rgba(255,255,255,0.7)) */
  textSecondary: string;
  /** Tertiary text color (default: rgba(255,255,255,0.5)) */
  textTertiary: string;
  /** Border color (default: rgba(255,255,255,0.08)) */
  border: string;
  /** Error color (default: #ff4444) */
  error: string;
  /** Compare button color (default: #3E1A7D) */
  compareButton: string;
}

/**
 * Default color palette for dark theme
 */
export const DEFAULT_FOOTER_COLORS: FooterColors = {
  primary: '#9E8CBE',
  primaryHover: '#B8A5D6',
  primaryDark: '#8472A8',
  background: '#0f1419',
  surface: '#1a1f28',
  surfaceElevated: '#242b36',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textTertiary: 'rgba(255, 255, 255, 0.5)',
  border: 'rgba(255, 255, 255, 0.08)',
  error: '#ff4444',
  compareButton: '#3E1A7D',
};

/**
 * Selected entity model for the Footer dock
 */
export interface SelectedEntity {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Customer/location name */
  customerName: string;
  /** Last telemetry value */
  lastValue: number;
  /** Unit of measurement (kWh, m3, C, etc) */
  unit: string;
  /** Icon type (determines comparison type) */
  icon: UnitType;
  /** Ingestion API ID (for comparison modal) */
  ingestionId: string;
  /** ThingsBoard entity ID */
  tbId?: string;
  /** Entity type (ASSET, DEVICE) */
  entityType?: string;
  /** Dashboard ID for navigation */
  dashboardId?: string;
  /** Temperature min threshold (for temperature devices) */
  temperatureMin?: number;
  /** Temperature max threshold (for temperature devices) */
  temperatureMax?: number;
}

/**
 * Minimal ThingsBoard context interface
 */
export interface ThingsboardWidgetContext {
  $container?: { [index: number]: HTMLElement };
  scope?: {
    startDateISO?: string;
    endDateISO?: string;
    temperatureMin?: number;
    temperatureMax?: number;
  };
  stateController?: {
    openState: (state: string, params?: Record<string, unknown>, replaceHistory?: boolean) => void;
  };
}

/**
 * Selection store interface (compatible with MyIOSelectionStore)
 */
export interface SelectionStore {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
  add: (entity: SelectedEntity) => boolean;
  remove: (entityId: string) => void;
  clear: () => void;
  getSelectedEntities: () => SelectedEntity[];
  getSelectionCount: () => number;
}

/**
 * Date range for comparison modals
 */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * Parameters for creating the Footer Component
 */
export interface FooterComponentParams {
  /** Container element where footer will be rendered */
  container: HTMLElement;

  /** ThingsBoard widget context (optional, for navigation and date range) */
  ctx?: ThingsboardWidgetContext;

  /** Selection store instance (default: window.MyIOSelectionStore) */
  selectionStore?: SelectionStore;

  /** Maximum number of selections allowed (default: 6) */
  maxSelections?: number;

  /** Message shown when dock is empty */
  emptyMessage?: string;

  /** Label for the compare button */
  compareButtonLabel?: string;

  /** Label for the clear button */
  clearButtonLabel?: string;

  /** Function to get date range for comparison modals */
  getDateRange?: () => DateRange;

  /** Base URL for charts SDK (default: https://graphs.staging.apps.myio-bas.com) */
  chartsBaseUrl?: string;

  /** Data API host for ingestion API */
  dataApiHost?: string;

  /** Function to get ingestion token for API calls */
  getIngestionToken?: () => string | undefined;

  /** Theme mode (default: 'dark') */
  theme?: FooterThemeMode;

  /** Custom color palette */
  colors?: Partial<FooterColors>;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  // ============== Callbacks ==============

  /** Called when compare button is clicked */
  onCompareClick?: (entities: SelectedEntity[], unitType: UnitType) => void;

  /** Called when clear button is clicked */
  onClearClick?: () => void;

  /** Called when a chip is removed */
  onChipRemove?: (entityId: string) => void;

  /** Called when selection changes */
  onSelectionChange?: (entities: SelectedEntity[]) => void;

  /** Called when selection limit is reached */
  onLimitReached?: (limit: number) => void;

  /** Called when mixed unit types are detected */
  onMixedTypes?: (types: string[]) => void;

  /** Called on any error */
  onError?: (error: Error) => void;
}

/**
 * Footer component instance returned by createFooterComponent
 */
export interface FooterComponentInstance {
  // ============== Selection Methods ==============

  /**
   * Add an entity to the selection
   * @returns true if added, false if limit reached or already exists
   */
  addEntity: (entity: SelectedEntity) => boolean;

  /**
   * Remove an entity from the selection
   */
  removeEntity: (entityId: string) => void;

  /**
   * Clear all selected entities
   */
  clearSelection: () => void;

  /**
   * Get all currently selected entities
   */
  getSelectedEntities: () => SelectedEntity[];

  /**
   * Get the count of selected entities
   */
  getSelectionCount: () => number;

  // ============== State Methods ==============

  /**
   * Get the current unit type (energy, water, tank, temperature, or null)
   */
  getCurrentUnitType: () => UnitType | null;

  /**
   * Set the date range for comparison modals
   */
  setDateRange: (start: string, end: string) => void;

  /**
   * Set the theme mode
   */
  setTheme: (theme: FooterThemeMode) => void;

  /**
   * Get the current theme mode
   */
  getTheme: () => FooterThemeMode;

  // ============== UI Methods ==============

  /**
   * Open the comparison modal with current selection
   */
  openCompareModal: () => Promise<void>;

  /**
   * Show the limit reached alert
   */
  showLimitAlert: () => void;

  /**
   * Show the mixed types alert
   */
  showMixedTypesAlert: () => void;

  /**
   * Hide any visible alert
   */
  hideAlert: () => void;

  // ============== Lifecycle ==============

  /**
   * Destroy the component and cleanup resources
   */
  destroy: () => void;

  /** The root DOM element of the footer */
  element: HTMLElement;
}

/**
 * Event types emitted by FooterView
 */
export type FooterEventType =
  | 'compare-click'
  | 'clear-click'
  | 'chip-remove'
  | 'drag-over'
  | 'drop';

/**
 * Event handler for FooterView events
 */
export type FooterEventHandler = (data?: string | SelectedEntity) => void;

/**
 * Comparison modal data source
 */
export interface ComparisonDataSource {
  type: 'device';
  id: string;
  label: string;
}

/**
 * Temperature device for comparison modal
 */
export interface TemperatureDevice {
  id: string;
  label: string;
  tbId?: string;
  customerName?: string;
  temperatureMin?: number;
  temperatureMax?: number;
}
