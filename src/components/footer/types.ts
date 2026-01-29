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
export type UnitType = 'energy' | 'water' | 'tank' | 'temperature' | 'alarms';

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
 * Theme-specific configuration for Footer Component
 * Used for darkMode and lightMode settings
 */
export interface FooterThemeConfig {
  // Main Colors
  /** Primary brand color */
  primaryColor?: string;
  /** Primary hover color */
  primaryHoverColor?: string;
  /** Primary dark color */
  primaryDarkColor?: string;

  // Background Colors
  /** Footer background gradient start */
  backgroundGradientStart?: string;
  /** Footer background gradient end */
  backgroundGradientEnd?: string;
  /** Footer border top color */
  borderTopColor?: string;

  // Text Colors
  /** Primary text color */
  textColor?: string;
  /** Secondary/muted text color */
  mutedTextColor?: string;

  // Chip Colors
  /** Chip background color */
  chipBackgroundColor?: string;
  /** Chip border color */
  chipBorderColor?: string;
  /** Chip text color */
  chipTextColor?: string;

  // Button Colors
  /** Compare button background color */
  compareButtonColor?: string;
  /** Compare button hover color */
  compareButtonHoverColor?: string;
  /** Clear button background color */
  clearButtonColor?: string;
  /** Clear button text color */
  clearButtonTextColor?: string;

  // Meta/Totals Colors
  /** Meta section background color */
  metaBackgroundColor?: string;
  /** Meta section border color */
  metaBorderColor?: string;

  // Empty State
  /** Empty message background color */
  emptyBackgroundColor?: string;
  /** Empty message border color */
  emptyBorderColor?: string;
}

/**
 * Configuration template for Footer Component
 * Maps to ThingsBoard widget settingsSchema.json
 * Supports theme-specific settings via darkMode/lightMode
 */
export interface FooterConfigTemplate {
  // Debug
  /** Enable console logging for debugging */
  enableDebugMode?: boolean;

  // Labels (shared across themes)
  /** Empty dock message */
  emptyMessage?: string;
  /** Compare button label */
  compareButtonLabel?: string;
  /** Clear button label */
  clearButtonLabel?: string;

  // Behavior (shared across themes)
  /** Maximum number of selections allowed */
  maxSelections?: number;

  // Theme-specific settings
  /** Dark mode configuration */
  darkMode?: FooterThemeConfig;
  /** Light mode configuration */
  lightMode?: FooterThemeConfig;
}

/**
 * Default theme configuration for dark mode
 */
export const DEFAULT_DARK_THEME: FooterThemeConfig = {
  primaryColor: '#9E8CBE',
  primaryHoverColor: '#B8A5D6',
  primaryDarkColor: '#8472A8',
  backgroundGradientStart: 'rgba(158, 140, 190, 0.95)',
  backgroundGradientEnd: 'rgba(132, 114, 168, 0.98)',
  borderTopColor: 'rgba(184, 165, 214, 0.5)',
  textColor: '#ffffff',
  mutedTextColor: 'rgba(255, 255, 255, 0.7)',
  chipBackgroundColor: 'rgba(158, 140, 190, 0.25)',
  chipBorderColor: 'rgba(184, 165, 214, 0.4)',
  chipTextColor: '#ffffff',
  compareButtonColor: '#3E1A7D',
  compareButtonHoverColor: '#5A2CB8',
  clearButtonColor: 'rgba(200, 200, 200, 0.2)',
  clearButtonTextColor: '#cccccc',
  metaBackgroundColor: 'rgba(158, 140, 190, 0.15)',
  metaBorderColor: 'rgba(184, 165, 214, 0.3)',
  emptyBackgroundColor: 'rgba(158, 140, 190, 0.15)',
  emptyBorderColor: 'rgba(184, 165, 214, 0.4)',
};

/**
 * Default theme configuration for light mode
 */
export const DEFAULT_LIGHT_THEME: FooterThemeConfig = {
  primaryColor: '#7A2FF7',
  primaryHoverColor: '#5A1FD1',
  primaryDarkColor: '#4A19B1',
  backgroundGradientStart: 'rgba(248, 249, 252, 0.98)',
  backgroundGradientEnd: 'rgba(240, 242, 245, 0.98)',
  borderTopColor: 'rgba(158, 140, 190, 0.3)',
  textColor: '#1a1a2e',
  mutedTextColor: '#4a4a6a',
  chipBackgroundColor: 'rgba(122, 47, 247, 0.1)',
  chipBorderColor: 'rgba(122, 47, 247, 0.25)',
  chipTextColor: '#1a1a2e',
  compareButtonColor: '#7A2FF7',
  compareButtonHoverColor: '#5A1FD1',
  clearButtonColor: 'rgba(0, 0, 0, 0.05)',
  clearButtonTextColor: '#4a4a6a',
  metaBackgroundColor: 'rgba(255, 255, 255, 0.8)',
  metaBorderColor: 'rgba(122, 47, 247, 0.2)',
  emptyBackgroundColor: 'rgba(122, 47, 247, 0.05)',
  emptyBorderColor: 'rgba(122, 47, 247, 0.2)',
};

/**
 * Default configuration template values
 */
export const DEFAULT_CONFIG_TEMPLATE: FooterConfigTemplate = {
  enableDebugMode: false,
  emptyMessage: 'Selecione dispositivos para comparar',
  compareButtonLabel: 'Comparar',
  clearButtonLabel: 'Limpar',
  maxSelections: 6,
  darkMode: DEFAULT_DARK_THEME,
  lightMode: DEFAULT_LIGHT_THEME,
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
  /** Optional metadata for alarm comparisons */
  meta?: Record<string, unknown> | null;
  /** Raw alarm object (if selection comes from alarms) */
  alarm?: Record<string, unknown> | null;
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

  /**
   * Configuration template from ThingsBoard widget settings
   * Contains all customization options including theme-specific colors
   * Values here serve as defaults that can be overridden by other params
   */
  configTemplate?: FooterConfigTemplate;

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
