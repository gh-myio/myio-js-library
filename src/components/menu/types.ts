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
 * Configuration template from ThingsBoard widget settings
 * Maps to settingsSchema.json properties with "menu_" prefix
 */
export interface MenuConfigTemplate {
  // Theme mode
  /** Theme mode: 'light' or 'dark' (default: 'light') */
  themeMode?: MenuThemeMode;

  // Tab colors
  /** Active tab background color (default: #2F5848) */
  tabSelecionadoBackgroundColor?: string;
  /** Active tab font color (default: #F2F2F2) */
  tabSelecionadoFontColor?: string;
  /** Inactive tab background color (default: #FFFFFF for light, #374151 for dark) */
  tabNaoSelecionadoBackgroundColor?: string;
  /** Inactive tab font color (default: #1C2743 for light, #E5E7EB for dark) */
  tabNaoSelecionadoFontColor?: string;

  // Load button colors
  /** Load button background color (default: #2F5848) */
  botaoCarregarBackgroundColor?: string;
  /** Load button font color (default: #F2F2F2) */
  botaoCarregarFontColor?: string;

  // Clear button colors
  /** Clear button background color (default: #FFFFFF for light, #374151 for dark) */
  botaoLimparBackgroundColor?: string;
  /** Clear button font color (default: #1C2743 for light, #E5E7EB for dark) */
  botaoLimparFontColor?: string;

  // Goals button colors
  /** Goals button background color (default: #6a1b9a) */
  botaoMetasBackgroundColor?: string;
  /** Goals button font color (default: #F2F2F2) */
  botaoMetasFontColor?: string;

  // Filter button colors
  /** Filter button background color (default: #FFFFFF for light, #374151 for dark) */
  botaoFiltroBackgroundColor?: string;
  /** Filter button font color (default: #1C2743 for light, #E5E7EB for dark) */
  botaoFiltroFontColor?: string;

  // Date picker colors
  /** Date picker background color (default: #FFFFFF for light, #374151 for dark) */
  datePickerBackgroundColor?: string;
  /** Date picker font color (default: #1C2743 for light, #E5E7EB for dark) */
  datePickerFontColor?: string;

  // Debug mode
  /** Enable console logging for debugging */
  enableDebugMode?: boolean;
}

/**
 * Default configuration values for light theme
 */
export const DEFAULT_MENU_CONFIG_LIGHT: Required<MenuConfigTemplate> = {
  themeMode: 'light',
  tabSelecionadoBackgroundColor: '#2F5848',
  tabSelecionadoFontColor: '#F2F2F2',
  tabNaoSelecionadoBackgroundColor: '#FFFFFF',
  tabNaoSelecionadoFontColor: '#1C2743',
  botaoCarregarBackgroundColor: '#2F5848',
  botaoCarregarFontColor: '#F2F2F2',
  botaoLimparBackgroundColor: '#FFFFFF',
  botaoLimparFontColor: '#1C2743',
  botaoMetasBackgroundColor: '#6a1b9a',
  botaoMetasFontColor: '#F2F2F2',
  botaoFiltroBackgroundColor: '#FFFFFF',
  botaoFiltroFontColor: '#1C2743',
  datePickerBackgroundColor: '#FFFFFF',
  datePickerFontColor: '#1C2743',
  enableDebugMode: false,
};

/**
 * Default configuration values for dark theme
 */
export const DEFAULT_MENU_CONFIG_DARK: Required<MenuConfigTemplate> = {
  themeMode: 'dark',
  tabSelecionadoBackgroundColor: '#2F5848',
  tabSelecionadoFontColor: '#F2F2F2',
  tabNaoSelecionadoBackgroundColor: '#374151',
  tabNaoSelecionadoFontColor: '#E5E7EB',
  botaoCarregarBackgroundColor: '#2F5848',
  botaoCarregarFontColor: '#F2F2F2',
  botaoLimparBackgroundColor: '#374151',
  botaoLimparFontColor: '#E5E7EB',
  botaoMetasBackgroundColor: '#7c3aed',
  botaoMetasFontColor: '#F2F2F2',
  botaoFiltroBackgroundColor: '#374151',
  botaoFiltroFontColor: '#E5E7EB',
  datePickerBackgroundColor: '#374151',
  datePickerFontColor: '#E5E7EB',
  enableDebugMode: false,
};

/**
 * Default configuration values (light theme)
 */
export const DEFAULT_MENU_CONFIG: Required<MenuConfigTemplate> = DEFAULT_MENU_CONFIG_LIGHT;

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
        id: 'general',
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
