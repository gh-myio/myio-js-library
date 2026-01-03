/**
 * RFC-0113: Header Component Library
 * Type definitions for the Header Component
 */

// ============================================================================
// Card Color Configuration
// ============================================================================

/**
 * Color configuration for a single card
 */
export interface CardColorConfig {
  /** Background color of the card */
  background: string;
  /** Font color of the card */
  font: string;
}

/**
 * Color configuration for all header cards
 */
export interface HeaderCardColors {
  /** Equipment card colors */
  equipment?: CardColorConfig;
  /** Energy card colors */
  energy?: CardColorConfig;
  /** Temperature card colors */
  temperature?: CardColorConfig;
  /** Water card colors */
  water?: CardColorConfig;
}

// ============================================================================
// KPI Data Models
// ============================================================================

/**
 * Equipment KPI data
 */
export interface EquipmentKPI {
  /** Total number of equipments */
  totalEquipments: number;
  /** Number of filtered/active equipments */
  filteredEquipments: number;
  /** Whether all shoppings are selected */
  allShoppingsSelected: boolean;
  /** Equipment categories breakdown */
  categories?: Record<string, number>;
}

/**
 * Energy summary data for a shopping
 */
export interface ShoppingEnergy {
  /** Shopping name */
  name: string;
  /** Shopping identifier */
  value: string;
  /** Total energy consumption */
  total: number;
  /** Percentage of total */
  percentage?: number;
}

/**
 * Energy KPI data
 */
export interface EnergyKPI {
  /** Total consumption for selected customers */
  customerTotal: number;
  /** Total consumption before filtering */
  unfilteredTotal: number;
  /** Whether filter is active */
  isFiltered: boolean;
  /** Equipment-related consumption */
  equipmentsTotal?: number;
  /** Store-related consumption */
  lojasTotal?: number;
  /** Breakdown by shopping */
  shoppingsEnergy?: ShoppingEnergy[];
}

/**
 * Temperature data for a shopping
 */
export interface ShoppingTemperature {
  /** Shopping name */
  name: string;
  /** Average temperature */
  avg: number | null;
  /** Minimum temperature */
  min?: number;
  /** Maximum temperature */
  max?: number;
  /** Temperature range string (e.g., "18-25°C") */
  range?: string;
  /** Status: "ok", "warning", "unknown" */
  status?: 'ok' | 'warning' | 'unknown';
}

/**
 * Temperature KPI data
 */
export interface TemperatureKPI {
  /** Global average temperature */
  globalAvg: number | null;
  /** Filtered average temperature */
  filteredAvg?: number;
  /** Whether filter is active */
  isFiltered: boolean;
  /** Shoppings within temperature range */
  shoppingsInRange: ShoppingTemperature[];
  /** Shoppings outside temperature range */
  shoppingsOutOfRange: ShoppingTemperature[];
  /** Shoppings with unknown temperature status */
  shoppingsUnknownRange?: ShoppingTemperature[];
  /** All temperature devices */
  devices?: Array<{
    name: string;
    value: number;
    location?: string;
  }>;
}

/**
 * Water data for a shopping
 */
export interface ShoppingWater {
  /** Shopping name */
  name: string;
  /** Shopping identifier */
  value: string;
  /** Total water consumption */
  total: number;
  /** Percentage of total */
  percentage?: number;
}

/**
 * Water KPI data
 */
export interface WaterKPI {
  /** Total consumption for selected customers */
  filteredTotal: number;
  /** Total consumption before filtering */
  unfilteredTotal: number;
  /** Whether filter is active */
  isFiltered: boolean;
  /** Common area water consumption */
  commonArea?: number;
  /** Store water consumption */
  stores?: number;
  /** Breakdown by shopping */
  shoppingsWater?: ShoppingWater[];
}

/**
 * All KPI data for the header
 */
export interface CardKPIs {
  /** Equipment KPI */
  equip?: EquipmentKPI;
  /** Energy KPI */
  energy?: EnergyKPI;
  /** Temperature KPI */
  temp?: TemperatureKPI;
  /** Water KPI */
  water?: WaterKPI;
}

// ============================================================================
// Shopping / Filter Types
// ============================================================================

/**
 * Shopping/Customer entity
 */
export interface Shopping {
  /** Display name */
  name: string;
  /** Ingestion ID (unique identifier) */
  value: string;
  /** ThingsBoard customer/entity ID */
  customerId: string;
  /** Ingestion ID (alias) */
  ingestionId?: string;
}

/**
 * Filter selection state
 */
export interface FilterSelection {
  /** Selected mall IDs */
  malls: string[];
  /** Selected floor IDs */
  floors: string[];
  /** Selected place/store IDs */
  places: string[];
}

/**
 * Saved filter preset
 */
export interface FilterPreset {
  /** Unique preset ID */
  id: string;
  /** Preset name */
  name: string;
  /** Saved selection */
  selection: FilterSelection;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Tree node for mall in filter modal
 */
export interface MallTreeNode {
  /** Mall ID */
  id: string;
  /** Mall name */
  name: string;
  /** Floors in this mall */
  children?: FloorTreeNode[];
}

/**
 * Tree node for floor in filter modal
 */
export interface FloorTreeNode {
  /** Floor ID */
  id: string;
  /** Floor name */
  name: string;
  /** Places/stores on this floor */
  children?: PlaceTreeNode[];
}

/**
 * Tree node for place/store in filter modal
 */
export interface PlaceTreeNode {
  /** Place ID */
  id: string;
  /** Place name */
  name: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Card type identifier
 */
export type CardType = 'equipment' | 'energy' | 'temperature' | 'water';

/**
 * Event types emitted/listened by HeaderComponent
 */
export type HeaderEventType =
  | 'filter-applied'
  | 'back-click'
  | 'card-click'
  | 'card-hover'
  | 'filter-btn-click'
  | 'filter-modal-open'
  | 'filter-modal-close'
  | 'request-shoppings'
  | 'request-consumption'
  | 'request-water'
  | 'request-temperature';

/**
 * Event handler function type
 */
export type HeaderEventHandler = (...args: unknown[]) => void;

// ============================================================================
// Theme Mode
// ============================================================================

/**
 * Theme mode for the Header Component
 */
export type HeaderThemeMode = 'light' | 'dark';

// ============================================================================
// Configuration Template (maps to settingsSchema.json)
// ============================================================================

/**
 * Configuration template for Header Component
 * Maps to ThingsBoard widget settingsSchema.json attributes
 */
export interface HeaderConfigTemplate {
  // Theme Mode
  /** Theme mode: 'light' or 'dark' (default: 'light') */
  themeMode?: HeaderThemeMode;

  // Card Colors (from settingsSchema.json)
  /** Equipment card background color */
  cardEquipamentosBackgroundColor?: string;
  /** Equipment card font color */
  cardEquipamentosFontColor?: string;
  /** Energy card background color */
  cardEnergiaBackgroundColor?: string;
  /** Energy card font color */
  cardEnergiaFontColor?: string;
  /** Temperature card background color */
  cardTemperaturaBackgroundColor?: string;
  /** Temperature card font color */
  cardTemperaturaFontColor?: string;
  /** Water card background color */
  cardAguaBackgroundColor?: string;
  /** Water card font color */
  cardAguaFontColor?: string;

  // Logo Configuration
  /** Logo image URL */
  logoUrl?: string;
  /** Logo card background color */
  logoBackgroundColor?: string;

  // Feature Flags
  /** Enable info tooltips on cards */
  enableTooltips?: boolean;
  /** Enable filter modal button */
  enableFilterModal?: boolean;
  /** Show back-to-home button */
  showBackButton?: boolean;

  // Debug
  /** Enable debug logging */
  enableDebugMode?: boolean;
}

// ============================================================================
// Component Parameters
// ============================================================================

/**
 * Minimal ThingsBoard context interface for navigation
 */
export interface ThingsboardWidgetContext {
  stateController?: {
    openState: (state: string, params?: Record<string, unknown>, replaceHistory?: boolean) => void;
  };
  router?: {
    navigateByUrl: (url: string) => void;
  };
  settings?: HeaderConfigTemplate;
  $scope?: Record<string, unknown>;
}

/**
 * Parameters for creating the Header Component
 */
export interface HeaderComponentParams {
  // Required: Container element
  /** Container element to render the header into */
  container: HTMLElement;

  // ThingsBoard context (for navigation)
  /** ThingsBoard widget context */
  ctx?: ThingsboardWidgetContext;

  // Configuration from widget settings
  /** Configuration template from settingsSchema.json */
  configTemplate?: HeaderConfigTemplate;

  // Logo Configuration (override configTemplate)
  /** Logo image URL */
  logoUrl?: string;
  /** URL to navigate when back button is clicked */
  homeUrl?: string;

  // Card Colors (override configTemplate)
  /** Card color overrides */
  cardColors?: HeaderCardColors;

  // Initial KPIs
  /** Initial KPI values */
  initialKPIs?: Partial<CardKPIs>;

  // Shopping data for filter
  /** Available shoppings for filter modal */
  shoppings?: Shopping[];

  // Feature toggles (override configTemplate)
  /** Enable info tooltips on cards */
  enableTooltips?: boolean;
  /** Enable filter modal */
  enableFilterModal?: boolean;
  /** Show back button on logo card */
  showBackButton?: boolean;

  // Callbacks
  /** Called when filter is applied */
  onFilterApply?: (selection: Shopping[]) => void;
  /** Called when back button is clicked */
  onBackClick?: () => void;
  /** Called when a card is clicked */
  onCardClick?: (cardType: CardType) => void;
  /** Called when hovering over a card */
  onCardHover?: (cardType: CardType, isHovering: boolean) => void;
}

// ============================================================================
// Component Instance
// ============================================================================

/**
 * Instance returned by createHeaderComponent
 */
export interface HeaderComponentInstance {
  // Update methods
  /** Update all KPIs at once */
  updateKPIs: (kpis: Partial<CardKPIs>) => void;
  /** Update equipment KPI */
  updateEquipmentKPI: (data: EquipmentKPI) => void;
  /** Update energy KPI */
  updateEnergyKPI: (data: EnergyKPI) => void;
  /** Update temperature KPI */
  updateTemperatureKPI: (data: TemperatureKPI) => void;
  /** Update water KPI */
  updateWaterKPI: (data: WaterKPI) => void;

  // Tooltip data updates
  /** Update tooltip data for a specific card */
  updateTooltipData: (cardType: CardType, data: unknown) => void;

  // Shopping/Filter methods
  /** Update available shoppings */
  updateShoppings: (shoppings: Shopping[]) => void;
  /** Open the filter modal */
  openFilterModal: () => void;
  /** Close the filter modal */
  closeFilterModal: () => void;
  /** Get currently selected shoppings */
  getSelectedShoppings: () => Shopping[];
  /** Set selected shoppings */
  setSelectedShoppings: (shoppings: Shopping[]) => void;

  // Theme methods
  /** Set the theme mode (light or dark) */
  setThemeMode: (mode: HeaderThemeMode) => void;
  /** Get the current theme mode */
  getThemeMode: () => HeaderThemeMode;

  // Lifecycle
  /** Destroy the component and cleanup */
  destroy: () => void;

  // DOM reference
  /** The component's root DOM element */
  element: HTMLElement;

  // Event registration
  /** Register an event handler */
  on: (event: HeaderEventType, handler: HeaderEventHandler) => void;
  /** Unregister an event handler */
  off: (event: HeaderEventType, handler: HeaderEventHandler) => void;
}

// ============================================================================
// Filter Modal Types
// ============================================================================

/**
 * Parameters for HeaderFilterModal
 */
export interface HeaderFilterModalParams {
  /** Available shoppings */
  shoppings: Shopping[];
  /** Initially selected shoppings */
  selectedShoppings?: Shopping[];
  /** Saved filter presets */
  presets?: FilterPreset[];
  /** Called when filter is applied */
  onApply?: (selection: Shopping[]) => void;
  /** Called when modal is closed */
  onClose?: () => void;
}

/**
 * Instance returned by HeaderFilterModal
 */
export interface HeaderFilterModalInstance {
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
  /** Update available shoppings */
  updateShoppings: (shoppings: Shopping[]) => void;
  /** Get current selection */
  getSelection: () => Shopping[];
  /** Destroy the modal and cleanup */
  destroy: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default card colors (from settingsSchema.json)
 */
export const DEFAULT_CARD_COLORS: HeaderCardColors = {
  equipment: { background: '#1F3A35', font: '#F2F2F2' },
  energy: { background: '#1F3A35', font: '#F2F2F2' },
  temperature: { background: '#1F3A35', font: '#F2F2F2' },
  water: { background: '#1F3A35', font: '#F2F2F2' },
};

/**
 * Default configuration template (from settingsSchema.json)
 */
export const HEADER_DEFAULT_CONFIG_TEMPLATE: HeaderConfigTemplate = {
  // Card Colors
  cardEquipamentosBackgroundColor: '#1F3A35',
  cardEquipamentosFontColor: '#F2F2F2',
  cardEnergiaBackgroundColor: '#1F3A35',
  cardEnergiaFontColor: '#F2F2F2',
  cardTemperaturaBackgroundColor: '#1F3A35',
  cardTemperaturaFontColor: '#F2F2F2',
  cardAguaBackgroundColor: '#1F3A35',
  cardAguaFontColor: '#F2F2F2',

  // Logo
  logoUrl: 'https://dashboard.myio-bas.com/api/images/public/Gi9qaUMi2Z7G2wrdReKzMCZu5epG17lX',
  logoBackgroundColor: '#1F3A35',

  // Features
  enableTooltips: true,
  enableFilterModal: true,
  showBackButton: true,
  enableDebugMode: false,
};

/**
 * Default logo URL
 */
export const HEADER_DEFAULT_LOGO_URL =
  'https://dashboard.myio-bas.com/api/images/public/Gi9qaUMi2Z7G2wrdReKzMCZu5epG17lX';

/**
 * CSS class prefix for header component
 */
export const HEADER_CSS_PREFIX = 'myio-header';

/**
 * LocalStorage key for filter presets
 */
export const FILTER_PRESETS_STORAGE_KEY = 'myio_dashboard_filter_presets_v1';
