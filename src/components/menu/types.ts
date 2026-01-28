/**
 * RFC-0114: Menu Component Library
 * Type definitions for the Menu Component
 */

/**
 * Minimal ThingsBoard context interface for widget integration
 */
export interface ThingsboardWidgetContext {
  $scope?: {
    startDateISO?: string;
    endDateISO?: string;
    mainContentStateId?: string;
    custumer?: Shopping[];
    $applyAsync?: () => void;
  };
  settings?: Record<string, unknown>;
  data?: Array<{
    datasource?: {
      aliasName?: string;
      entityLabel?: string;
      entityId?: string;
    };
    data?: Array<[number, string]>;
  }>;
  filterCustom?: Shopping[];
}

/**
 * Shopping/Customer data structure
 */
export interface Shopping {
  /** Display name of the shopping center */
  name: string;
  /** Unique identifier (usually ingestionId) */
  value: string;
  /** ThingsBoard customer ID */
  customerId: string;
  /** Ingestion ID for API calls */
  ingestionId?: string;
  /** Minimum temperature threshold for this shopping (from customers datasource) */
  minTemperature?: number | null;
  /** Maximum temperature threshold for this shopping (from customers datasource) */
  maxTemperature?: number | null;
}

/**
 * Context option within a tab dropdown
 */
export interface ContextOption {
  /** Unique context identifier */
  id: string;
  /** Target state ID for navigation */
  target: string;
  /** Display title */
  title: string;
  /** Description text */
  description: string;
  /** Icon emoji or character */
  icon: string;
}

/**
 * Tab configuration
 */
export interface TabConfig {
  /** Unique tab identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon emoji or character */
  icon: string;
  /** Available contexts for this tab */
  contexts: ContextOption[];
  /** Default context ID when tab is selected */
  defaultContext?: string;
}

/**
 * Theme mode for the menu component
 */
export type MenuThemeMode = 'light' | 'dark';

/**
 * Theme-specific configuration (colors for cards, buttons, fonts)
 * Used for darkMode and lightMode settings
 */
export interface MenuThemeConfig {
  // Tab Colors
  /** Active tab background color */
  tabActiveBackgroundColor?: string;
  /** Active tab font color */
  tabActiveFontColor?: string;
  /** Inactive tab background color */
  tabInactiveBackgroundColor?: string;
  /** Inactive tab font color */
  tabInactiveFontColor?: string;
  /** Tab border color */
  tabBorderColor?: string;

  // Button Colors
  /** Load button background color */
  loadButtonBackgroundColor?: string;
  /** Load button font color */
  loadButtonFontColor?: string;
  /** Clear button background color */
  clearButtonBackgroundColor?: string;
  /** Clear button font color */
  clearButtonFontColor?: string;
  /** Goals button background color */
  goalsButtonBackgroundColor?: string;
  /** Goals button font color */
  goalsButtonFontColor?: string;
  /** Filter button background color */
  filterButtonBackgroundColor?: string;
  /** Filter button font color */
  filterButtonFontColor?: string;

  // Date Picker Colors
  /** Date picker background color */
  datePickerBackgroundColor?: string;
  /** Date picker font color */
  datePickerFontColor?: string;

  // Context Modal Colors
  /** Context modal background color */
  modalBackgroundColor?: string;
  /** Context modal header background color */
  modalHeaderBackgroundColor?: string;
  /** Context modal text color */
  modalTextColor?: string;
  /** Context modal description color */
  modalDescriptionColor?: string;
  /** Context modal border color */
  modalBorderColor?: string;
  /** Context option hover background color */
  optionHoverBackgroundColor?: string;
  /** Context option active background color */
  optionActiveBackgroundColor?: string;
  /** Context option active border color */
  optionActiveBorderColor?: string;

  // Filter Modal Colors
  /** Filter modal background color */
  filterModalBackgroundColor?: string;
  /** Filter modal text color */
  filterModalTextColor?: string;
  /** Filter modal border color */
  filterModalBorderColor?: string;
  /** Filter chip background color */
  chipBackgroundColor?: string;
  /** Filter chip text color */
  chipTextColor?: string;
  /** Filter chip border color */
  chipBorderColor?: string;
  /** Filter item selected background color */
  filterItemSelectedBackgroundColor?: string;
  /** Filter item selected border color */
  filterItemSelectedBorderColor?: string;
}

/**
 * Configuration template from ThingsBoard widget settings
 * Maps to settingsSchema.json properties with "menu_" prefix
 */
export interface MenuConfigTemplate {
  // Debug mode
  /** Enable console logging for debugging */
  enableDebugMode?: boolean;

  // Theme Mode
  /** Theme mode: 'light' or 'dark' (default: 'light') */
  themeMode?: MenuThemeMode;

  // Theme-specific settings
  /** Dark mode configuration (colors for cards, buttons, fonts) */
  darkMode?: MenuThemeConfig;
  /** Light mode configuration (colors for cards, buttons, fonts) */
  lightMode?: MenuThemeConfig;

  // Legacy properties (from settingsSchema.json) - for backwards compatibility
  /** Active tab background color (legacy) */
  tabSelecionadoBackgroundColor?: string;
  /** Active tab font color (legacy) */
  tabSelecionadoFontColor?: string;
  /** Inactive tab background color (legacy) */
  tabNaoSelecionadoBackgroundColor?: string;
  /** Inactive tab font color (legacy) */
  tabNaoSelecionadoFontColor?: string;
  /** Load button background color (legacy) */
  botaoCarregarBackgroundColor?: string;
  /** Load button font color (legacy) */
  botaoCarregarFontColor?: string;
  /** Clear button background color (legacy) */
  botaoLimparBackgroundColor?: string;
  /** Clear button font color (legacy) */
  botaoLimparFontColor?: string;
  /** Goals button background color (legacy) */
  botaoMetasBackgroundColor?: string;
  /** Goals button font color (legacy) */
  botaoMetasFontColor?: string;
  /** Filter button background color (legacy) */
  botaoFiltroBackgroundColor?: string;
  /** Filter button font color (legacy) */
  botaoFiltroFontColor?: string;
  /** Date picker background color (legacy) */
  datePickerBackgroundColor?: string;
  /** Date picker font color (legacy) */
  datePickerFontColor?: string;
}

/**
 * Default theme configuration for light mode
 */
export const DEFAULT_LIGHT_THEME: MenuThemeConfig = {
  // Tabs
  tabActiveBackgroundColor: '#2F5848',
  tabActiveFontColor: '#F2F2F2',
  tabInactiveBackgroundColor: '#FFFFFF',
  tabInactiveFontColor: '#1C2743',
  tabBorderColor: '#e0e0e0',

  // Buttons
  loadButtonBackgroundColor: '#2F5848',
  loadButtonFontColor: '#F2F2F2',
  clearButtonBackgroundColor: '#FFFFFF',
  clearButtonFontColor: '#1C2743',
  goalsButtonBackgroundColor: '#6a1b9a',
  goalsButtonFontColor: '#F2F2F2',
  filterButtonBackgroundColor: '#FFFFFF',
  filterButtonFontColor: '#1C2743',

  // Date Picker
  datePickerBackgroundColor: '#FFFFFF',
  datePickerFontColor: '#1C2743',

  // Context Modal
  modalBackgroundColor: '#ffffff',
  modalHeaderBackgroundColor: '#f8fafc',
  modalTextColor: '#1e293b',
  modalDescriptionColor: '#64748b',
  modalBorderColor: '#e2e8f0',
  optionHoverBackgroundColor: '#f1f5f9',
  optionActiveBackgroundColor: '#eff6ff',
  optionActiveBorderColor: '#3b82f6',

  // Filter Modal
  filterModalBackgroundColor: '#ffffff',
  filterModalTextColor: '#344054',
  filterModalBorderColor: '#d9d9d9',
  chipBackgroundColor: '#e0e7ff',
  chipTextColor: '#3730a3',
  chipBorderColor: '#a5b4fc',
  filterItemSelectedBackgroundColor: '#f0f9ff',
  filterItemSelectedBorderColor: '#3b82f6',
};

/**
 * Default theme configuration for dark mode
 */
export const DEFAULT_DARK_THEME: MenuThemeConfig = {
  // Tabs
  tabActiveBackgroundColor: '#2F5848',
  tabActiveFontColor: '#F2F2F2',
  tabInactiveBackgroundColor: '#374151',
  tabInactiveFontColor: '#E5E7EB',
  tabBorderColor: '#4b5563',

  // Buttons
  loadButtonBackgroundColor: '#2F5848',
  loadButtonFontColor: '#F2F2F2',
  clearButtonBackgroundColor: '#374151',
  clearButtonFontColor: '#E5E7EB',
  goalsButtonBackgroundColor: '#7c3aed',
  goalsButtonFontColor: '#F2F2F2',
  filterButtonBackgroundColor: '#374151',
  filterButtonFontColor: '#E5E7EB',

  // Date Picker
  datePickerBackgroundColor: '#374151',
  datePickerFontColor: '#E5E7EB',

  // Context Modal
  modalBackgroundColor: '#1f2937',
  modalHeaderBackgroundColor: '#111827',
  modalTextColor: '#f3f4f6',
  modalDescriptionColor: '#9ca3af',
  modalBorderColor: '#374151',
  optionHoverBackgroundColor: '#374151',
  optionActiveBackgroundColor: '#1e3a5f',
  optionActiveBorderColor: '#3b82f6',

  // Filter Modal
  filterModalBackgroundColor: '#1f2937',
  filterModalTextColor: '#e5e7eb',
  filterModalBorderColor: '#4b5563',
  chipBackgroundColor: '#312e81',
  chipTextColor: '#c7d2fe',
  chipBorderColor: '#4338ca',
  filterItemSelectedBackgroundColor: '#1e3a5f',
  filterItemSelectedBorderColor: '#3b82f6',
};

/**
 * Default configuration template values
 */
export const DEFAULT_CONFIG_TEMPLATE: MenuConfigTemplate = {
  enableDebugMode: false,
  themeMode: 'light',
  darkMode: DEFAULT_DARK_THEME,
  lightMode: DEFAULT_LIGHT_THEME,
};

// Legacy exports for backwards compatibility
export const DEFAULT_MENU_CONFIG_LIGHT = DEFAULT_LIGHT_THEME;
export const DEFAULT_MENU_CONFIG_DARK = DEFAULT_DARK_THEME;
export const DEFAULT_MENU_CONFIG = DEFAULT_CONFIG_TEMPLATE;

/**
 * Default tab configuration following the existing MENU widget structure
 */
export const DEFAULT_TABS: TabConfig[] = [
  {
    id: 'energy',
    label: 'Energia',
    icon: '⚡',
    contexts: [
      {
        id: 'equipments',
        target: 'content_equipments',
        title: 'Equipamentos',
        description: 'Telemetria de equipamentos',
        icon: '⚙️',
      },
      {
        id: 'stores',
        target: 'content_store',
        title: 'Lojas',
        description: 'Telemetria de lojas',
        icon: '🏬',
      },
      {
        id: 'energy_general',
        target: 'content_energy',
        title: 'Geral (Energia)',
        description: 'Visao geral de energia',
        icon: '⚡',
      },
    ],
    defaultContext: 'equipments',
  },
  {
    id: 'water',
    label: 'Agua',
    icon: '💧',
    contexts: [
      {
        id: 'water_common_area',
        target: 'content_water_common_area',
        title: 'Area Comum',
        description: 'Hidrometros de areas comuns',
        icon: '🏢',
      },
      {
        id: 'water_stores',
        target: 'content_water_stores',
        title: 'Lojas',
        description: 'Hidrometros de lojas/lojistas',
        icon: '🏬',
      },
      {
        id: 'water_summary',
        target: 'content_water',
        title: 'Resumo',
        description: 'Visao geral de consumo de agua',
        icon: '📊',
      },
    ],
    defaultContext: 'water_summary',
  },
  {
    id: 'temperature',
    label: 'Temperatura',
    icon: '🌡️',
    contexts: [
      {
        id: 'temperature_sensors',
        target: 'content_temperature_sensors',
        title: 'Ambientes Climatizaveis',
        description: 'Sensores em areas com ar-condicionado',
        icon: '❄️',
      },
      {
        id: 'temperature_sensors_external',
        target: 'content_temperature_sensors_external',
        title: 'Ambientes Nao Climatizaveis',
        description: 'Sensores em areas externas',
        icon: '☀️',
      },
      {
        id: 'temperature_comparison',
        target: 'content_temperature',
        title: 'Resumo Geral',
        description: 'Visao geral de temperatura',
        icon: '📊',
      },
    ],
    defaultContext: 'temperature_sensors',
  },
];

/**
 * RFC-0152: Operational Indicators Tab Configuration
 * This tab is conditionally shown based on customer attribute 'show-indicators-operational-panels'
 */
export const OPERATIONAL_INDICATORS_TAB: TabConfig = {
  id: 'operational',
  label: 'Indicadores Operacionais',
  icon: '📊',
  contexts: [
    {
      id: 'general-list',
      target: 'operational_general_list',
      title: 'Lista Geral',
      description: 'Visao geral dos equipamentos operacionais',
      icon: '📋',
    },
    {
      id: 'alarms',
      target: 'operational_alarms',
      title: 'Alarmes e Notificacoes',
      description: 'Central de alarmes e alertas',
      icon: '🔔',
    },
    {
      id: 'dashboard',
      target: 'operational_dashboard',
      title: 'Dashboard Gerencial',
      description: 'KPIs e indicadores de gestao',
      icon: '📈',
    },
  ],
  defaultContext: 'general-list',
};

/**
 * Parameters for creating the Menu Component
 */
export interface MenuComponentParams {
  /** Container element where menu will be rendered */
  container: HTMLElement;

  /** ThingsBoard widget context (optional) */
  ctx?: ThingsboardWidgetContext;

  /**
   * Configuration template from widget settings
   * Maps to settingsSchema.json properties
   */
  configTemplate?: MenuConfigTemplate;

  /** Tab configuration (defaults to DEFAULT_TABS) */
  tabs?: TabConfig[];

  /** Initial active tab ID (default: 'energy') */
  initialTab?: string;

  /** Initial date range */
  initialDateRange?: {
    start: Date | string;
    end: Date | string;
  };

  /** Date locale for formatting (default: 'pt-BR') */
  dateLocale?: string;

  /** Shopping/customer data for filter modal */
  shoppings?: Shopping[];

  // Feature toggles
  /** Show goals button (default: true) */
  showGoalsButton?: boolean;
  /** Show filter button (default: true) */
  showFilterButton?: boolean;
  /** Show load button (default: true) */
  showLoadButton?: boolean;
  /** Show clear button (default: true) */
  showClearButton?: boolean;

  // Callbacks
  /** Called when a tab is clicked */
  onTabChange?: (tabId: string, contextId: string, targetStateId: string) => void;
  /** Called when a context is selected within a tab */
  onContextChange?: (tabId: string, contextId: string, targetStateId: string) => void;
  /** Called when date range changes */
  onDateRangeChange?: (start: Date, end: Date) => void;
  /** Called when filter is applied */
  onFilterApply?: (selection: Shopping[]) => void;
  /** Called when load button is clicked */
  onLoad?: () => void;
  /** Called when clear button is clicked */
  onClear?: () => void;
  /** Called when goals button is clicked */
  onGoals?: () => void;
  /** Called when shoppings data is ready */
  onShoppingsReady?: (shoppings: Shopping[]) => void;
  /** Called when theme mode changes */
  onThemeChange?: (themeMode: MenuThemeMode) => void;
}

/**
 * Menu Component instance returned by createMenuComponent
 */
export interface MenuComponentInstance {
  // Tab control methods
  /** Set the active tab by ID */
  setActiveTab: (tabId: string) => void;
  /** Get the current active tab ID */
  getActiveTab: () => string;
  /** Set the active context for a specific tab */
  setContext: (tabId: string, contextId: string) => void;
  /** Get the current context for a specific tab */
  getContext: (tabId: string) => string;

  // Date control methods
  /** Set the date range */
  setDateRange: (start: Date, end: Date) => void;
  /** Get the current date range */
  getDateRange: () => { start: Date; end: Date };

  // Filter modal methods
  /** Open the shopping filter modal */
  openFilterModal: () => void;
  /** Close the shopping filter modal */
  closeFilterModal: () => void;
  /** Get currently selected shoppings */
  getSelectedShoppings: () => Shopping[];
  /** Set selected shoppings programmatically */
  setSelectedShoppings: (shoppings: Shopping[]) => void;
  /** Update available shoppings list */
  updateShoppings: (shoppings: Shopping[]) => void;

  // Action methods
  /** Trigger the load action programmatically */
  triggerLoad: () => void;
  /** Trigger the clear action programmatically */
  triggerClear: () => void;

  // Theme methods
  /** Set the theme mode ('light' or 'dark') */
  setThemeMode: (mode: MenuThemeMode) => void;
  /** Get the current theme mode */
  getThemeMode: () => MenuThemeMode;

  // Lifecycle
  /** Destroy the component and clean up resources */
  destroy: () => void;

  // DOM reference
  /** The menu component's root DOM element */
  element: HTMLElement;
}

/**
 * Event types emitted by the Menu Component
 */
export type MenuEventType =
  | 'tab-change'
  | 'context-change'
  | 'date-change'
  | 'filter-apply'
  | 'load'
  | 'clear'
  | 'goals'
  | 'shoppings-ready'
  | 'theme-change';

/**
 * Event handler function type
 */
export type MenuEventHandler = (data?: unknown) => void;

/**
 * Internal state for the Menu Component
 */
export interface MenuState {
  activeTabId: string;
  contextsByTab: Map<string, string>;
  dateRange: { start: Date; end: Date };
  selectedShoppings: Shopping[];
  availableShoppings: Shopping[];
  filterModalOpen: boolean;
}
