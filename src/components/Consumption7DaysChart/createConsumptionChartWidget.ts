/**
 * RFC-0098: Consumption Chart Widget
 *
 * Creates an inline chart widget that injects all HTML structure into a container.
 * Unlike createConsumptionModal (which creates a modal overlay), this component
 * renders directly into a specified container element.
 *
 * @example
 * ```typescript
 * import { createConsumptionChartWidget } from 'myio-js-library';
 *
 * const widget = createConsumptionChartWidget({
 *   domain: 'energy',
 *   containerId: 'energy-chart-container',
 *   title: 'Consumo dos últimos 7 dias',
 *   unit: 'kWh',
 *   fetchData: async (period) => fetchEnergyData(period),
 * });
 *
 * await widget.render();
 * ```
 */

import type {
  Consumption7DaysConfig,
  Consumption7DaysData,
  ChartType,
  VizMode,
  ThemeMode,
  IdealRangeConfig,
} from './types';

import { createConsumption7DaysChart } from './createConsumption7DaysChart';
import { DEFAULT_COLORS, THEME_COLORS, DEFAULT_CONFIG } from './types';
import { ModalHeader } from '../../utils/ModalHeader';
import { createDateRangePicker, type DateRangeControl } from '../createDateRangePicker';
import { CSS_TOKENS, DATERANGEPICKER_STYLES } from '../premium-modals/internal/styles/tokens';

// ============================================================================
// Types
// ============================================================================

export interface ConsumptionWidgetConfig extends Omit<Consumption7DaysConfig, 'containerId'> {
  /** ID of the container element where the widget will be rendered */
  containerId: string;
  /** Widget title (default: "Consumo dos últimos X dias") */
  title?: string;
  /** Show settings button (default: true) */
  showSettingsButton?: boolean;
  /** Show maximize button (default: true) */
  showMaximizeButton?: boolean;
  /** Show viz mode tabs (default: true) */
  showVizModeTabs?: boolean;
  /** Show chart type tabs (default: true) */
  showChartTypeTabs?: boolean;
  /** Chart height in pixels or CSS value (default: 300) */
  chartHeight?: number | string;
  /** Callback when settings button is clicked */
  onSettingsClick?: () => void;
  /** Callback when maximize button is clicked */
  onMaximizeClick?: () => void;
  /** Custom CSS class for the widget container */
  className?: string;
}

export interface ConsumptionWidgetInstance {
  /** Renders the widget into the container */
  render: () => Promise<void>;
  /** Refreshes the chart data */
  refresh: (forceRefresh?: boolean) => Promise<void>;
  /** Sets the chart type */
  setChartType: (type: ChartType) => void;
  /** Sets the visualization mode */
  setVizMode: (mode: VizMode) => void;
  /** Sets the theme */
  setTheme: (theme: ThemeMode) => void;
  /** Sets the period in days */
  setPeriod: (days: number) => Promise<void>;
  /** Sets the ideal range */
  setIdealRange: (range: IdealRangeConfig | null) => void;
  /** Gets the internal chart instance */
  getChart: () => ReturnType<typeof createConsumption7DaysChart> | null;
  /** Gets the underlying Chart.js instance (for backwards compatibility) */
  getChartInstance: () => any | null;
  /** Gets the cached data */
  getCachedData: () => Consumption7DaysData | null;
  /** Exports data to CSV */
  exportCSV: (filename?: string) => void;
  /** Destroys the widget */
  destroy: () => void;
}

// ============================================================================
// Domain Configuration
// ============================================================================

const DOMAIN_CONFIG: Record<string, { name: string; icon: string; color: string; colors: string[] }> = {
  energy: {
    name: 'Energia',
    icon: '⚡',
    color: '#6c2fbf',
    colors: ['#2563eb', '#16a34a', '#8b5cf6', '#ea580c', '#dc2626'],
  },
  water: {
    name: 'Água',
    icon: '💧',
    color: '#0288d1',
    colors: ['#0288d1', '#06b6d4', '#0891b2', '#22d3ee', '#67e8f9'],
  },
  gas: {
    name: 'Gás',
    icon: '🔥',
    color: '#ea580c',
    colors: ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa'],
  },
  temperature: {
    name: 'Temperatura',
    icon: '🌡️',
    color: '#e65100',
    colors: ['#dc2626', '#059669', '#0ea5e9', '#f59e0b', '#8b5cf6'],
  },
};

// ============================================================================
// Styles
// ============================================================================

function getWidgetStyles(theme: ThemeMode, primaryColor: string): string {
  const colors = THEME_COLORS[theme];

  return `
    .myio-chart-widget {
      font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
      background: ${colors.chartBackground};
      border: 1px solid ${colors.border};
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .myio-chart-widget.dark {
      background: ${THEME_COLORS.dark.chartBackground};
      border-color: ${THEME_COLORS.dark.border};
    }

    .myio-chart-widget-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid ${colors.border};
      flex-wrap: wrap;
      gap: 12px;
    }

    .myio-chart-widget-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .myio-chart-widget-title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: ${colors.text};
    }

    .myio-chart-widget-tabs {
      display: flex;
      gap: 2px;
      background: ${theme === 'dark' ? '#374151' : '#f3f4f6'};
      padding: 3px;
      border-radius: 8px;
    }

    .myio-chart-widget-tab {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 500;
      border: none;
      background: transparent;
      color: ${colors.textMuted};
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .myio-chart-widget-tab.icon-only {
      padding: 6px 10px;
    }

    .myio-chart-widget-tab svg {
      width: 16px;
      height: 16px;
      pointer-events: none;
    }

    .myio-chart-widget-tab:hover {
      color: ${colors.text};
      background: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
    }

    .myio-chart-widget-tab.active {
      background: ${primaryColor};
      color: white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .myio-chart-widget-btn {
      background: transparent;
      border: 1px solid ${colors.border};
      font-size: 16px;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 6px;
      transition: all 0.2s;
      color: ${colors.text};
    }

    .myio-chart-widget-btn:hover {
      background: ${primaryColor};
      border-color: ${primaryColor};
      color: white;
    }

    .myio-chart-widget-body {
      position: relative;
      padding: 16px 20px;
    }

    .myio-chart-widget-canvas-container {
      position: relative;
      width: 100%;
    }

    .myio-chart-widget-loading {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      border-radius: 8px;
    }

    .myio-chart-widget.dark .myio-chart-widget-loading {
      background: rgba(31, 41, 55, 0.9);
    }

    .myio-chart-widget-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid ${colors.border};
      border-top-color: ${primaryColor};
      border-radius: 50%;
      animation: myio-spin 1s linear infinite;
    }

    @keyframes myio-spin {
      to { transform: rotate(360deg); }
    }

    .myio-chart-widget-footer {
      display: flex;
      justify-content: space-around;
      padding: 16px 20px;
      border-top: 1px solid ${colors.border};
      gap: 16px;
      flex-wrap: wrap;
    }

    .myio-chart-widget-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      min-width: 100px;
    }

    .myio-chart-widget-stat-label {
      font-size: 11px;
      font-weight: 500;
      color: ${colors.textMuted};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .myio-chart-widget-stat-value {
      font-size: 20px;
      font-weight: 700;
      color: ${colors.text};
    }

    .myio-chart-widget-stat-value.primary {
      color: ${primaryColor};
    }

    .myio-chart-widget-stat-sub {
      font-size: 11px;
      color: ${colors.textMuted};
      margin-top: 2px;
    }

    /* Settings Modal Overlay */
    .myio-settings-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      backdrop-filter: blur(4px);
    }

    .myio-settings-overlay.hidden {
      display: none;
    }

    .myio-settings-card {
      background: ${colors.chartBackground};
      border-radius: 10px;
      width: 90%;
      max-width: 860px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    .myio-settings-card .myio-modal-header {
      border-radius: 10px 10px 0 0;
    }

    .myio-settings-body {
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .myio-settings-section {
      background: ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc'};
      border-radius: 10px;
      padding: 16px;
      border: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'};
    }

    .myio-settings-section-label {
      font-size: 13px;
      font-weight: 600;
      color: ${colors.text};
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .myio-settings-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: flex-end;
    }

    .myio-settings-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      min-width: 120px;
    }

    .myio-settings-field-label {
      font-size: 12px;
      font-weight: 500;
      color: ${colors.textMuted};
    }

    .myio-settings-input,
    .myio-settings-select {
      padding: 8px 12px;
      border: 1px solid ${colors.border};
      border-radius: 8px;
      font-size: 12px;
      background: ${colors.chartBackground};
      color: ${colors.text};
      width: 100%;
    }

    .myio-settings-input:focus,
    .myio-settings-select:focus {
      outline: 2px solid ${primaryColor};
      outline-offset: 1px;
    }

    .myio-settings-tabs {
      display: flex;
      gap: 2px;
      background: ${theme === 'dark' ? '#374151' : '#e5e7eb'};
      padding: 3px;
      border-radius: 8px;
    }

    .myio-settings-tab {
      flex: 1;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 500;
      border: none;
      background: transparent;
      color: ${colors.textMuted};
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .myio-settings-tab:hover {
      color: ${colors.text};
      background: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
    }

    .myio-settings-tab.active {
      background: ${primaryColor};
      color: white;
    }

    .myio-settings-footer {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      padding: 16px 20px;
      border-top: 1px solid ${colors.border};
      background: ${theme === 'dark' ? 'rgba(0,0,0,0.2)' : '#fafafa'};
    }

    .myio-settings-btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .myio-settings-btn-secondary {
      background: transparent;
      border: 1px solid ${colors.border};
      color: ${colors.text};
    }

    .myio-settings-btn-secondary:hover {
      background: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f3f4f6'};
    }

    .myio-settings-btn-primary {
      background: ${primaryColor};
      border: none;
      color: white;
    }

    .myio-settings-btn-primary:hover {
      filter: brightness(1.1);
    }

    .myio-settings-hint {
      font-size: 11px;
      color: ${colors.textMuted};
      font-weight: normal;
    }

    .myio-settings-context-group {
      margin-bottom: 12px;
    }

    .myio-settings-context-group:last-child {
      margin-bottom: 0;
    }

    .myio-settings-section + .myio-settings-section {
      margin-top: 12px;
    }

    /* Dropdown styles */
    .myio-settings-dropdown-container {
      position: relative;
    }

    .myio-settings-dropdown-btn {
      padding: 10px 14px;
      border: 1px solid ${colors.border};
      border-radius: 8px;
      font-size: 14px;
      background: ${colors.chartBackground};
      color: ${colors.text};
      cursor: pointer;
      min-width: 180px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
    }

    .myio-settings-dropdown-btn:hover {
      border-color: ${primaryColor};
    }

    .myio-settings-dropdown-arrow {
      font-size: 10px;
      color: ${colors.textMuted};
    }

    .myio-settings-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      z-index: 100001;
      background: ${colors.chartBackground};
      border: 1px solid ${colors.border};
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      min-width: 220px;
      padding: 8px 0;
    }

    .myio-settings-dropdown.hidden {
      display: none;
    }

    .myio-settings-dropdown-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      cursor: pointer;
      font-size: 13px;
      color: ${colors.text};
      transition: background 0.15s;
    }

    .myio-settings-dropdown-option:hover {
      background: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f3f4f6'};
    }

    .myio-settings-dropdown-option input {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: ${primaryColor};
    }

    .myio-settings-dropdown-actions {
      border-top: 1px solid ${colors.border};
      margin-top: 8px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .myio-settings-dropdown-actions button {
      width: 100%;
      padding: 8px;
      background: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f3f4f6'};
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      color: ${colors.text};
      transition: background 0.15s;
    }

    .myio-settings-dropdown-actions button:hover {
      background: ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : '#e5e7eb'};
    }

    /* Suggestion icon styles */
    .myio-settings-section-label span[id$="-settings-suggestion"] {
      transition: opacity 0.2s, transform 0.2s;
    }

    .myio-settings-section-label span[id$="-settings-suggestion"]:hover {
      opacity: 1 !important;
      transform: scale(1.2);
    }

    /* DateRangePicker styles (CSS tokens + premium styling) */
    ${CSS_TOKENS}
    ${DATERANGEPICKER_STYLES}

    /* Fix DateRangePicker buttons alignment */
    .myio-modal-scope .daterangepicker .drp-buttons {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
    }

    .myio-modal-scope .daterangepicker .drp-buttons .btn {
      display: inline-block;
      margin-left: 0;
    }
  `;
}

// ============================================================================
// Main Function
// ============================================================================

export function createConsumptionChartWidget(config: ConsumptionWidgetConfig): ConsumptionWidgetInstance {
  const widgetId = `myio-widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  let containerElement: HTMLElement | null = null;
  let chartInstance: ReturnType<typeof createConsumption7DaysChart> | null = null;
  let styleElement: HTMLStyleElement | null = null;
  let settingsModalElement: HTMLElement | null = null;
  let settingsHeaderHTML = '';
  let dateRangePickerInstance: DateRangeControl | null = null;

  // State
  let currentTheme: ThemeMode = config.theme ?? 'light';
  let currentChartType: ChartType = config.defaultChartType ?? 'line';
  let currentVizMode: VizMode = config.defaultVizMode ?? 'total';
  let currentPeriod = config.defaultPeriod ?? 7;
  let currentIdealRange: IdealRangeConfig | null = config.idealRange ?? null;
  let isLoading = false;

  // Settings modal temp state
  let tempPeriod = currentPeriod;
  let tempChartType = currentChartType;
  let tempVizMode = currentVizMode;
  let tempTheme = currentTheme;
  let tempIdealRange: IdealRangeConfig | null = currentIdealRange;

  // Date range state for settings modal
  let tempStartDate: string | null = null;
  let tempEndDate: string | null = null;

  // Suggestion state for ideal range
  let currentSuggestion: { min: number; max: number; avg: number } | null = null;

  // Domain config
  const domainCfg = DOMAIN_CONFIG[config.domain] || DOMAIN_CONFIG.energy;
  const primaryColor = config.colors?.primary || domainCfg.color;
  const domainColors = config.colors?.shoppingColors || domainCfg.colors;

  // Options with defaults
  const showSettingsButton = config.showSettingsButton ?? true;
  const showMaximizeButton = config.showMaximizeButton ?? true;
  const showVizModeTabs = config.showVizModeTabs ?? true;
  const showChartTypeTabs = config.showChartTypeTabs ?? true;
  const chartHeight =
    typeof config.chartHeight === 'number' ? `${config.chartHeight}px` : config.chartHeight ?? '300px';

  /**
   * Generate the widget title
   */
  function getTitle(): string {
    if (config.title) return config.title;
    const domainName = config.domain === 'temperature' ? 'Temperatura' : 'Consumo';
    return `${domainName} dos últimos ${currentPeriod} dias`;
  }

  /**
   * Render the widget HTML
   */
  function renderHTML(): string {
    // SVG icons for viz modes
    const consolidadoIcon = `<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="2"/></svg>`;
    const porShoppingIcon = `<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>`;

    // SVG icons for chart types
    const lineChartIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,12 5,7 9,9 14,3"/></svg>`;
    const barChartIcon = `<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="9" width="3" height="6" rx="0.5"/><rect x="6" y="5" width="3" height="10" rx="0.5"/><rect x="11" y="7" width="3" height="8" rx="0.5"/></svg>`;

    return `
      <div id="${widgetId}" class="myio-chart-widget ${currentTheme === 'dark' ? 'dark' : ''} ${
      config.className || ''
    }">
        <div class="myio-chart-widget-header">
          <div class="myio-chart-widget-title-group">
            ${
              showSettingsButton
                ? `
              <button id="${widgetId}-settings-btn" class="myio-chart-widget-btn" title="Configurações">⚙️</button>
            `
                : ''
            }
            <h4 id="${widgetId}-title" class="myio-chart-widget-title">${getTitle()}</h4>
            ${
              showVizModeTabs
                ? `
              <div class="myio-chart-widget-tabs" id="${widgetId}-viz-tabs">
                <button class="myio-chart-widget-tab icon-only ${
                  currentVizMode === 'total' ? 'active' : ''
                }" data-viz="total" title="Consolidado">${consolidadoIcon}</button>
                <button class="myio-chart-widget-tab icon-only ${
                  currentVizMode === 'separate' ? 'active' : ''
                }" data-viz="separate" title="Por Shopping">${porShoppingIcon}</button>
              </div>
            `
                : ''
            }
            ${
              showChartTypeTabs
                ? `
              <div class="myio-chart-widget-tabs" id="${widgetId}-type-tabs">
                <button class="myio-chart-widget-tab icon-only ${
                  currentChartType === 'line' ? 'active' : ''
                }" data-type="line" title="Gráfico de Linhas">${lineChartIcon}</button>
                <button class="myio-chart-widget-tab icon-only ${
                  currentChartType === 'bar' ? 'active' : ''
                }" data-type="bar" title="Gráfico de Barras">${barChartIcon}</button>
              </div>
            `
                : ''
            }
            ${
              showMaximizeButton
                ? `
              <button id="${widgetId}-maximize-btn" class="myio-chart-widget-btn" title="Maximizar">⛶</button>
            `
                : ''
            }
          </div>
        </div>
        <div class="myio-chart-widget-body">
          <div id="${widgetId}-loading" class="myio-chart-widget-loading" style="display: none;">
            <div class="myio-chart-widget-spinner"></div>
          </div>
          <div class="myio-chart-widget-canvas-container" style="height: ${chartHeight};">
            <canvas id="${widgetId}-canvas"></canvas>
          </div>
        </div>
        <div class="myio-chart-widget-footer" id="${widgetId}-footer">
          <div class="myio-chart-widget-stat">
            <span class="myio-chart-widget-stat-label">Total Período</span>
            <span id="${widgetId}-stat-total" class="myio-chart-widget-stat-value primary">--</span>
          </div>
          <div class="myio-chart-widget-stat">
            <span class="myio-chart-widget-stat-label">Média Diária</span>
            <span id="${widgetId}-stat-avg" class="myio-chart-widget-stat-value">--</span>
          </div>
          <div class="myio-chart-widget-stat">
            <span class="myio-chart-widget-stat-label">Dia de Pico</span>
            <span id="${widgetId}-stat-peak" class="myio-chart-widget-stat-value">--</span>
            <span id="${widgetId}-stat-peak-date" class="myio-chart-widget-stat-sub"></span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render the settings modal HTML (header will be injected separately)
   */
  function renderSettingsModal(): string {
    const unit = config.unit ?? '';
    const isTemperature = config.domain === 'temperature';

    // SVG icons (same as widget header)
    const consolidadoIcon = `<svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px;pointer-events:none"><rect x="3" y="3" width="10" height="10" rx="2"/></svg>`;
    const porShoppingIcon = `<svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px;pointer-events:none"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>`;
    const lineChartIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;pointer-events:none"><polyline points="2,12 5,7 9,9 14,3"/></svg>`;
    const barChartIcon = `<svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px;pointer-events:none"><rect x="1" y="9" width="3" height="6" rx="0.5"/><rect x="6" y="5" width="3" height="10" rx="0.5"/><rect x="11" y="7" width="3" height="8" rx="0.5"/></svg>`;

    // Generate header HTML using ModalHeader component
    settingsHeaderHTML = ModalHeader.generateHTML({
      modalId: `${widgetId}-settings`,
      title: 'Configurações',
      icon: '⚙️',
      theme: tempTheme,
      showThemeToggle: false,
      showMaximize: false,
      showClose: true,
    });

    return `
      <div id="${widgetId}-settings-overlay" class="myio-settings-overlay myio-modal-scope hidden">
        <div class="myio-settings-card">
          ${settingsHeaderHTML}
          <div class="myio-settings-body">
            <!-- CONTEXT 1: Período e Dados -->
            <div class="myio-settings-context-group">
              <!-- Período -->
              <div class="myio-settings-section">
                <div class="myio-settings-section-label">📅 Período</div>
                <div class="myio-settings-row">
                  <div class="myio-settings-field" style="flex: 1;">
                    <input type="text" id="${widgetId}-settings-daterange" class="myio-settings-input"
                      readonly placeholder="Selecione o período..." style="cursor: pointer;">
                  </div>
                </div>
              </div>

              <!-- Dados -->
              <div class="myio-settings-section">
                <div class="myio-settings-section-label">📊 Dados</div>
                <div class="myio-settings-row">
                  <!-- Granularity Select -->
                  <div class="myio-settings-field">
                    <label class="myio-settings-field-label">Granularidade</label>
                    <select id="${widgetId}-settings-granularity" class="myio-settings-select">
                      <option value="1d" selected>📆 Por Dia</option>
                      <option value="1h">🕐 Por Hora</option>
                    </select>
                  </div>

                  <!-- Weekday Filter -->
                  <div class="myio-settings-field">
                    <label class="myio-settings-field-label">Dias da Semana</label>
                    <div class="myio-settings-dropdown-container">
                      <button type="button" id="${widgetId}-settings-weekday-btn" class="myio-settings-dropdown-btn">
                        <span id="${widgetId}-settings-weekday-label">Todos os dias</span>
                        <span class="myio-settings-dropdown-arrow">▼</span>
                      </button>
                      <div id="${widgetId}-settings-weekday-dropdown" class="myio-settings-dropdown hidden">
                        <label class="myio-settings-dropdown-option">
                          <input type="checkbox" name="${widgetId}-weekday" value="dom" checked /> Domingo
                        </label>
                        <label class="myio-settings-dropdown-option">
                          <input type="checkbox" name="${widgetId}-weekday" value="seg" checked /> Segunda-feira
                        </label>
                        <label class="myio-settings-dropdown-option">
                          <input type="checkbox" name="${widgetId}-weekday" value="ter" checked /> Terça-feira
                        </label>
                        <label class="myio-settings-dropdown-option">
                          <input type="checkbox" name="${widgetId}-weekday" value="qua" checked /> Quarta-feira
                        </label>
                        <label class="myio-settings-dropdown-option">
                          <input type="checkbox" name="${widgetId}-weekday" value="qui" checked /> Quinta-feira
                        </label>
                        <label class="myio-settings-dropdown-option">
                          <input type="checkbox" name="${widgetId}-weekday" value="sex" checked /> Sexta-feira
                        </label>
                        <label class="myio-settings-dropdown-option">
                          <input type="checkbox" name="${widgetId}-weekday" value="sab" checked /> Sábado
                        </label>
                        <div class="myio-settings-dropdown-actions">
                          <button type="button" id="${widgetId}-settings-weekday-all">Selecionar Todos</button>
                          <button type="button" id="${widgetId}-settings-weekday-clear">Limpar</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Day Period Filter (only visible when hourly) -->
                  <div class="myio-settings-field" id="${widgetId}-settings-dayperiod-field" style="display: none;">
                    <label class="myio-settings-field-label">Períodos do Dia</label>
                    <div class="myio-settings-dropdown-container">
                      <button type="button" id="${widgetId}-settings-dayperiod-btn" class="myio-settings-dropdown-btn">
                        <span id="${widgetId}-settings-dayperiod-label">Todos os períodos</span>
                        <span class="myio-settings-dropdown-arrow">▼</span>
                      </button>
                      <div id="${widgetId}-settings-dayperiod-dropdown" class="myio-settings-dropdown hidden">
                        <label class="myio-settings-dropdown-option">
                          <input type="checkbox" name="${widgetId}-dayperiod" value="madrugada" checked /> Madrugada (00h-06h)
                        </label>
                        <label class="myio-settings-dropdown-option">
                          <input type="checkbox" name="${widgetId}-dayperiod" value="manha" checked /> Manhã (06h-12h)
                        </label>
                        <label class="myio-settings-dropdown-option">
                          <input type="checkbox" name="${widgetId}-dayperiod" value="tarde" checked /> Tarde (12h-18h)
                        </label>
                        <label class="myio-settings-dropdown-option">
                          <input type="checkbox" name="${widgetId}-dayperiod" value="noite" checked /> Noite (18h-24h)
                        </label>
                        <div class="myio-settings-dropdown-actions">
                          <button type="button" id="${widgetId}-settings-dayperiod-all">Selecionar Todos</button>
                          <button type="button" id="${widgetId}-settings-dayperiod-clear">Limpar</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- CONTEXT 2: Faixa Ideal -->
            <div class="myio-settings-context-group">
              <div class="myio-settings-section">
                <div class="myio-settings-section-label">
                  🎯 Faixa Ideal
                  <span class="myio-settings-hint" id="${widgetId}-settings-range-hint">(opcional - deixe zerado para não exibir)</span>
                  <span
                    id="${widgetId}-settings-suggestion"
                    title=""
                    style="cursor: pointer; font-size: 16px; opacity: 0.7; transition: opacity 0.2s; margin-left: 4px;"
                  >💡</span>
                </div>
                <div class="myio-settings-row">
                  <div class="myio-settings-field" style="min-width: 100px;">
                    <label class="myio-settings-field-label">Mínimo (${unit})</label>
                    <input type="number" id="${widgetId}-settings-range-min" class="myio-settings-input"
                      value="${tempIdealRange?.min ?? ''}" placeholder="0" step="0.1">
                  </div>
                  <div class="myio-settings-field" style="min-width: 100px;">
                    <label class="myio-settings-field-label">Máximo (${unit})</label>
                    <input type="number" id="${widgetId}-settings-range-max" class="myio-settings-input"
                      value="${tempIdealRange?.max ?? ''}" placeholder="0" step="0.1">
                  </div>
                  <div class="myio-settings-field" style="flex: 1;">
                    <label class="myio-settings-field-label">Rótulo</label>
                    <input type="text" id="${widgetId}-settings-range-label" class="myio-settings-input"
                      value="${tempIdealRange?.label ?? ''}" placeholder="${
      isTemperature ? 'Faixa Ideal' : 'Meta de Consumo'
    }">
                  </div>
                </div>
              </div>
            </div>

            <!-- CONTEXT 3: Visualização -->
            <div class="myio-settings-context-group">
              <div class="myio-settings-section">
                <div class="myio-settings-section-label">🎨 Visualização</div>
                <div class="myio-settings-row" style="gap: 20px; flex-wrap: wrap;">
                  <!-- Chart Type -->
                  <div class="myio-settings-field" style="flex: 1; min-width: 180px;">
                    <label class="myio-settings-field-label">Tipo de Gráfico</label>
                    <div class="myio-settings-tabs" id="${widgetId}-settings-chart-type">
                      <button class="myio-settings-tab ${
                        tempChartType === 'line' ? 'active' : ''
                      }" data-type="line">${lineChartIcon} Linhas</button>
                      <button class="myio-settings-tab ${
                        tempChartType === 'bar' ? 'active' : ''
                      }" data-type="bar">${barChartIcon} Barras</button>
                    </div>
                  </div>

                  <!-- Viz Mode -->
                  <div class="myio-settings-field" style="flex: 1; min-width: 200px;">
                    <label class="myio-settings-field-label">Agrupamento</label>
                    <div class="myio-settings-tabs" id="${widgetId}-settings-viz-mode">
                      <button class="myio-settings-tab ${
                        tempVizMode === 'total' ? 'active' : ''
                      }" data-viz="total">${consolidadoIcon} Consolidado</button>
                      <button class="myio-settings-tab ${
                        tempVizMode === 'separate' ? 'active' : ''
                      }" data-viz="separate">${porShoppingIcon} Por Shopping</button>
                    </div>
                  </div>

                  <!-- Theme -->
                  <div class="myio-settings-field" style="flex: 1; min-width: 160px;">
                    <label class="myio-settings-field-label">Tema</label>
                    <div class="myio-settings-tabs" id="${widgetId}-settings-theme">
                      <button class="myio-settings-tab ${
                        tempTheme === 'light' ? 'active' : ''
                      }" data-theme="light">☀️ Light</button>
                      <button class="myio-settings-tab ${
                        tempTheme === 'dark' ? 'active' : ''
                      }" data-theme="dark">🌙 Dark</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="myio-settings-footer">
            <button id="${widgetId}-settings-reset" class="myio-settings-btn myio-settings-btn-secondary">Resetar</button>
            <button id="${widgetId}-settings-apply" class="myio-settings-btn myio-settings-btn-primary">Carregar</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Inject styles into the document
   */
  function injectStyles(): void {
    if (styleElement) return;

    styleElement = document.createElement('style');
    styleElement.id = `${widgetId}-styles`;
    styleElement.textContent = getWidgetStyles(currentTheme, primaryColor);
    document.head.appendChild(styleElement);
  }

  /**
   * Update styles for theme change
   */
  function updateStyles(): void {
    if (styleElement) {
      styleElement.textContent = getWidgetStyles(currentTheme, primaryColor);
    }
  }

  /**
   * Setup event listeners
   */
  function setupListeners(): void {
    // Settings button - opens built-in settings modal
    if (showSettingsButton) {
      document.getElementById(`${widgetId}-settings-btn`)?.addEventListener('click', () => {
        openSettingsModal();
        config.onSettingsClick?.();
      });
    }

    // Maximize button
    if (showMaximizeButton && config.onMaximizeClick) {
      document.getElementById(`${widgetId}-maximize-btn`)?.addEventListener('click', () => {
        config.onMaximizeClick?.();
      });
    }

    // Viz mode tabs
    if (showVizModeTabs) {
      document.getElementById(`${widgetId}-viz-tabs`)?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('myio-chart-widget-tab')) {
          const mode = target.dataset.viz as VizMode;
          if (mode) {
            instance.setVizMode(mode);
          }
        }
      });
    }

    // Chart type tabs
    if (showChartTypeTabs) {
      document.getElementById(`${widgetId}-type-tabs`)?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('myio-chart-widget-tab')) {
          const type = target.dataset.type as ChartType;
          if (type) {
            instance.setChartType(type);
          }
        }
      });
    }
  }

  /**
   * Update tab active states
   */
  function updateTabStates(): void {
    // Viz mode tabs
    document.querySelectorAll(`#${widgetId}-viz-tabs .myio-chart-widget-tab`).forEach((tab) => {
      const btn = tab as HTMLButtonElement;
      btn.classList.toggle('active', btn.dataset.viz === currentVizMode);
    });

    // Chart type tabs
    document.querySelectorAll(`#${widgetId}-type-tabs .myio-chart-widget-tab`).forEach((tab) => {
      const btn = tab as HTMLButtonElement;
      btn.classList.toggle('active', btn.dataset.type === currentChartType);
    });
  }

  /**
   * Update title element
   */
  function updateTitle(): void {
    const titleEl = document.getElementById(`${widgetId}-title`);
    if (titleEl) {
      titleEl.textContent = getTitle();
    }
  }

  /**
   * Show/hide loading overlay
   */
  function setLoading(loading: boolean): void {
    isLoading = loading;
    const loadingEl = document.getElementById(`${widgetId}-loading`);
    if (loadingEl) {
      loadingEl.style.display = loading ? 'flex' : 'none';
    }
  }

  /**
   * Format value with unit
   */
  function formatValue(value: number): string {
    const unit = config.unit ?? '';
    const unitLarge = config.unitLarge;
    const threshold = config.thresholdForLargeUnit ?? 1000;

    if (unitLarge && Math.abs(value) >= threshold) {
      return `${(value / threshold).toFixed(2)} ${unitLarge}`;
    }
    return `${value.toFixed(2)} ${unit}`;
  }

  /**
   * Update footer statistics
   */
  function updateFooterStats(data: Consumption7DaysData): void {
    const totalEl = document.getElementById(`${widgetId}-stat-total`);
    const avgEl = document.getElementById(`${widgetId}-stat-avg`);
    const peakEl = document.getElementById(`${widgetId}-stat-peak`);
    const peakDateEl = document.getElementById(`${widgetId}-stat-peak-date`);

    if (!data.dailyTotals || data.dailyTotals.length === 0) {
      if (totalEl) totalEl.textContent = '--';
      if (avgEl) avgEl.textContent = '--';
      if (peakEl) peakEl.textContent = '--';
      if (peakDateEl) peakDateEl.textContent = '';
      return;
    }

    const isTemperature = config.domain === 'temperature';
    const totals = data.dailyTotals;
    const labels = data.labels ?? [];

    // Calculate stats
    const total = totals.reduce((a, b) => a + b, 0);
    const avg = total / totals.length;
    const peakValue = Math.max(...totals);
    const peakIndex = totals.indexOf(peakValue);
    const peakDate = labels[peakIndex] ?? '';

    // Update total (for temperature, show average instead)
    if (totalEl) {
      if (isTemperature) {
        totalEl.textContent = formatValue(avg);
        const labelEl = totalEl.previousElementSibling;
        if (labelEl) labelEl.textContent = 'Média Período';
      } else {
        totalEl.textContent = formatValue(total);
      }
    }

    // Update average
    if (avgEl) {
      avgEl.textContent = formatValue(avg);
    }

    // Update peak
    if (peakEl) {
      peakEl.textContent = formatValue(peakValue);
    }
    if (peakDateEl) {
      peakDateEl.textContent = peakDate;
    }
  }

  // ============================================================================
  // Settings Modal Functions
  // ============================================================================

  /**
   * Open settings modal
   */
  async function openSettingsModal(): Promise<void> {
    // Reset temp state to current values
    tempPeriod = currentPeriod;
    tempChartType = currentChartType;
    tempVizMode = currentVizMode;
    tempTheme = currentTheme;
    tempIdealRange = currentIdealRange ? { ...currentIdealRange } : null;

    // Reset date range picker instance for re-initialization
    dateRangePickerInstance = null;

    // Create modal if doesn't exist
    if (!settingsModalElement) {
      settingsModalElement = document.createElement('div');
      settingsModalElement.innerHTML = renderSettingsModal();
      document.body.appendChild(settingsModalElement.firstElementChild!);
      settingsModalElement = document.getElementById(`${widgetId}-settings-overlay`);
      await setupSettingsModalListeners();
    } else {
      // Re-initialize date range picker if modal already exists
      await setupSettingsModalListeners();
    }

    // Update modal values
    updateSettingsModalValues();

    // Update suggestion tooltip
    updateIdealRangeSuggestionTooltip();

    // Show modal
    settingsModalElement?.classList.remove('hidden');
  }

  /**
   * Close settings modal
   */
  function closeSettingsModal(): void {
    settingsModalElement?.classList.add('hidden');
    // Don't destroy header instance - keep it for reuse
    // Destroy date range picker instance
    if (dateRangePickerInstance) {
      dateRangePickerInstance.destroy();
      dateRangePickerInstance = null;
    }
  }

  /**
   * Update settings modal input values
   */
  function updateSettingsModalValues(): void {
    // Period
    const periodSelect = document.getElementById(`${widgetId}-settings-period`) as HTMLSelectElement;
    if (periodSelect) periodSelect.value = String(tempPeriod);

    // Ideal range
    const minInput = document.getElementById(`${widgetId}-settings-range-min`) as HTMLInputElement;
    const maxInput = document.getElementById(`${widgetId}-settings-range-max`) as HTMLInputElement;
    const labelInput = document.getElementById(`${widgetId}-settings-range-label`) as HTMLInputElement;
    if (minInput) minInput.value = tempIdealRange?.min?.toString() ?? '';
    if (maxInput) maxInput.value = tempIdealRange?.max?.toString() ?? '';
    if (labelInput) labelInput.value = tempIdealRange?.label ?? '';

    // Update tabs
    updateSettingsModalTabs();
  }

  /**
   * Update settings modal tab states
   */
  function updateSettingsModalTabs(): void {
    // Chart type tabs
    document.querySelectorAll(`#${widgetId}-settings-chart-type .myio-settings-tab`).forEach((tab) => {
      const btn = tab as HTMLButtonElement;
      btn.classList.toggle('active', btn.dataset.type === tempChartType);
    });

    // Viz mode tabs
    document.querySelectorAll(`#${widgetId}-settings-viz-mode .myio-settings-tab`).forEach((tab) => {
      const btn = tab as HTMLButtonElement;
      btn.classList.toggle('active', btn.dataset.viz === tempVizMode);
    });

    // Theme tabs
    document.querySelectorAll(`#${widgetId}-settings-theme .myio-settings-tab`).forEach((tab) => {
      const btn = tab as HTMLButtonElement;
      btn.classList.toggle('active', btn.dataset.theme === tempTheme);
    });
  }

  /**
   * Update weekday dropdown label based on selected checkboxes
   */
  function updateWeekdayLabel(): void {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(`input[name="${widgetId}-weekday"]`);
    const checked = Array.from(checkboxes).filter((cb) => cb.checked);
    const label = document.getElementById(`${widgetId}-settings-weekday-label`);
    if (label) {
      if (checked.length === 0) {
        label.textContent = 'Nenhum dia';
      } else if (checked.length === checkboxes.length) {
        label.textContent = 'Todos os dias';
      } else {
        label.textContent = `${checked.length} dias selecionados`;
      }
    }
  }

  /**
   * Update day period dropdown label based on selected checkboxes
   */
  function updateDayPeriodLabel(): void {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(`input[name="${widgetId}-dayperiod"]`);
    const checked = Array.from(checkboxes).filter((cb) => cb.checked);
    const label = document.getElementById(`${widgetId}-settings-dayperiod-label`);
    if (label) {
      if (checked.length === 0) {
        label.textContent = 'Nenhum período';
      } else if (checked.length === checkboxes.length) {
        label.textContent = 'Todos os períodos';
      } else {
        label.textContent = `${checked.length} períodos selecionados`;
      }
    }
  }

  /**
   * Calculate suggested ideal range based on data average (±15%)
   */
  function calculateIdealRangeSuggestion(): { min: number; max: number; avg: number } {
    const data = chartInstance?.getCachedData();
    if (!data || !data.dailyTotals || data.dailyTotals.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }

    const total = data.dailyTotals.reduce((a, b) => a + b, 0);
    const avg = total / data.dailyTotals.length;
    const min = avg * 0.85; // -15%
    const max = avg * 1.15; // +15%

    return {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(avg * 10) / 10,
    };
  }

  /**
   * Update the suggestion tooltip with calculated values
   */
  function updateIdealRangeSuggestionTooltip(): void {
    const suggestion = calculateIdealRangeSuggestion();
    const suggestionEl = document.getElementById(`${widgetId}-settings-suggestion`);
    const hintEl = document.getElementById(`${widgetId}-settings-range-hint`);
    const unit = config.unit ?? '';
    const isTemperature = config.domain === 'temperature';

    // Store current suggestion for applying later
    currentSuggestion = suggestion;

    // Update hint text based on domain
    if (hintEl) {
      if (isTemperature) {
        hintEl.textContent = '(valores carregados do cliente)';
      } else {
        hintEl.textContent = '(opcional - deixe zerado para não exibir)';
      }
    }

    // Update tooltip
    if (suggestionEl) {
      if (suggestion.avg > 0) {
        const tooltipText = `Sugestão: ${suggestion.min} - ${suggestion.max} ${unit} (média ±15%). Clique para aplicar.`;
        suggestionEl.title = tooltipText;
        suggestionEl.style.display = 'inline';
      } else {
        suggestionEl.style.display = 'none';
      }
    }
  }

  /**
   * Apply the suggested ideal range to the inputs
   */
  function applyIdealRangeSuggestion(): void {
    if (!currentSuggestion || (currentSuggestion.min === 0 && currentSuggestion.max === 0)) {
      return;
    }

    const minInput = document.getElementById(`${widgetId}-settings-range-min`) as HTMLInputElement;
    const maxInput = document.getElementById(`${widgetId}-settings-range-max`) as HTMLInputElement;
    const labelInput = document.getElementById(`${widgetId}-settings-range-label`) as HTMLInputElement;

    if (minInput) minInput.value = String(currentSuggestion.min);
    if (maxInput) maxInput.value = String(currentSuggestion.max);
    if (labelInput) labelInput.value = 'Faixa Sugerida';

    // Update temp state
    tempIdealRange = {
      min: currentSuggestion.min,
      max: currentSuggestion.max,
      label: 'Faixa Sugerida',
    };
  }

  /**
   * Setup settings modal event listeners
   */
  async function setupSettingsModalListeners(): Promise<void> {
    // Attach header listeners (handles close button)
    ModalHeader.setupHandlers({
      modalId: `${widgetId}-settings`,
      onClose: () => closeSettingsModal(),
    });

    // Initialize DateRangePicker
    const dateRangeInput = document.getElementById(`${widgetId}-settings-daterange`) as HTMLInputElement;
    if (dateRangeInput && !dateRangePickerInstance) {
      try {
        // Calculate default date range based on current period
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - tempPeriod);

        // Use existing tempStartDate/tempEndDate if set
        const presetStart = tempStartDate || startDate.toISOString();
        const presetEnd = tempEndDate || endDate.toISOString();

        dateRangePickerInstance = await createDateRangePicker(dateRangeInput, {
          presetStart,
          presetEnd,
          includeTime: true,
          timePrecision: 'hour',
          maxRangeDays: 90,
          locale: 'pt-BR',
          parentEl: document.getElementById(`${widgetId}-settings-overlay`) as HTMLElement,
          onApply: (result) => {
            tempStartDate = result.startISO;
            tempEndDate = result.endISO;
            // Calculate period in hours
            const start = new Date(result.startISO);
            const end = new Date(result.endISO);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffHours = diffTime / (1000 * 60 * 60);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            tempPeriod = diffDays || 7;

            // If period is <= 2 days, force granularity to hourly
            const granularitySelect = document.getElementById(
              `${widgetId}-settings-granularity`
            ) as HTMLSelectElement;
            if (granularitySelect && diffHours <= 48) {
              granularitySelect.value = '1h';
              // Show day period field for hourly granularity
              const dayPeriodField = document.getElementById(`${widgetId}-settings-dayperiod-field`);
              if (dayPeriodField) dayPeriodField.style.display = 'block';
            }

            console.log('[ConsumptionChartWidget] Date range applied:', {
              start: result.startISO,
              end: result.endISO,
              hours: diffHours,
              days: tempPeriod,
            });
          },
        });
      } catch (error) {
        console.warn('[ConsumptionChartWidget] DateRangePicker initialization failed:', error);
      }
    }

    // Overlay click to close
    document.getElementById(`${widgetId}-settings-overlay`)?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('myio-settings-overlay')) {
        closeSettingsModal();
      }
    });

    // Granularity select - show/hide day period field
    document.getElementById(`${widgetId}-settings-granularity`)?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement;
      const dayPeriodField = document.getElementById(`${widgetId}-settings-dayperiod-field`);
      if (dayPeriodField) {
        dayPeriodField.style.display = select.value === '1h' ? 'block' : 'none';
      }
    });

    // Suggestion icon click - apply suggested values
    document.getElementById(`${widgetId}-settings-suggestion`)?.addEventListener('click', () => {
      applyIdealRangeSuggestion();
    });

    // Weekday dropdown toggle
    document.getElementById(`${widgetId}-settings-weekday-btn`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById(`${widgetId}-settings-weekday-dropdown`);
      dropdown?.classList.toggle('hidden');
    });

    // Weekday checkboxes
    document.querySelectorAll<HTMLInputElement>(`input[name="${widgetId}-weekday"]`).forEach((cb) => {
      cb.addEventListener('change', updateWeekdayLabel);
    });

    // Weekday select all
    document.getElementById(`${widgetId}-settings-weekday-all`)?.addEventListener('click', () => {
      document.querySelectorAll<HTMLInputElement>(`input[name="${widgetId}-weekday"]`).forEach((cb) => {
        cb.checked = true;
      });
      updateWeekdayLabel();
    });

    // Weekday clear all
    document.getElementById(`${widgetId}-settings-weekday-clear`)?.addEventListener('click', () => {
      document.querySelectorAll<HTMLInputElement>(`input[name="${widgetId}-weekday"]`).forEach((cb) => {
        cb.checked = false;
      });
      updateWeekdayLabel();
    });

    // Day period dropdown toggle
    document.getElementById(`${widgetId}-settings-dayperiod-btn`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById(`${widgetId}-settings-dayperiod-dropdown`);
      dropdown?.classList.toggle('hidden');
    });

    // Day period checkboxes
    document.querySelectorAll<HTMLInputElement>(`input[name="${widgetId}-dayperiod"]`).forEach((cb) => {
      cb.addEventListener('change', updateDayPeriodLabel);
    });

    // Day period select all
    document.getElementById(`${widgetId}-settings-dayperiod-all`)?.addEventListener('click', () => {
      document.querySelectorAll<HTMLInputElement>(`input[name="${widgetId}-dayperiod"]`).forEach((cb) => {
        cb.checked = true;
      });
      updateDayPeriodLabel();
    });

    // Day period clear all
    document.getElementById(`${widgetId}-settings-dayperiod-clear`)?.addEventListener('click', () => {
      document.querySelectorAll<HTMLInputElement>(`input[name="${widgetId}-dayperiod"]`).forEach((cb) => {
        cb.checked = false;
      });
      updateDayPeriodLabel();
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const weekdayDropdown = document.getElementById(`${widgetId}-settings-weekday-dropdown`);
      const dayperiodDropdown = document.getElementById(`${widgetId}-settings-dayperiod-dropdown`);

      if (
        weekdayDropdown &&
        !target.closest(`#${widgetId}-settings-weekday-btn`) &&
        !target.closest(`#${widgetId}-settings-weekday-dropdown`)
      ) {
        weekdayDropdown.classList.add('hidden');
      }
      if (
        dayperiodDropdown &&
        !target.closest(`#${widgetId}-settings-dayperiod-btn`) &&
        !target.closest(`#${widgetId}-settings-dayperiod-dropdown`)
      ) {
        dayperiodDropdown.classList.add('hidden');
      }
    });

    // Chart type tabs
    document.getElementById(`${widgetId}-settings-chart-type`)?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('myio-settings-tab')) {
        tempChartType = target.dataset.type as ChartType;
        updateSettingsModalTabs();
      }
    });

    // Viz mode tabs
    document.getElementById(`${widgetId}-settings-viz-mode`)?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('myio-settings-tab')) {
        tempVizMode = target.dataset.viz as VizMode;
        updateSettingsModalTabs();
      }
    });

    // Theme tabs
    document.getElementById(`${widgetId}-settings-theme`)?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('myio-settings-tab')) {
        tempTheme = target.dataset.theme as ThemeMode;
        updateSettingsModalTabs();
      }
    });

    // Reset button
    document.getElementById(`${widgetId}-settings-reset`)?.addEventListener('click', async () => {
      tempPeriod = config.defaultPeriod ?? 7;
      tempChartType = config.defaultChartType ?? 'line';
      tempVizMode = config.defaultVizMode ?? 'total';
      tempTheme = config.theme ?? 'light';
      tempIdealRange = config.idealRange ?? null;

      // Reset date range
      tempStartDate = null;
      tempEndDate = null;

      // Re-initialize DateRangePicker with default dates
      if (dateRangePickerInstance) {
        dateRangePickerInstance.destroy();
        dateRangePickerInstance = null;
      }
      const dateRangeInput = document.getElementById(`${widgetId}-settings-daterange`) as HTMLInputElement;
      if (dateRangeInput) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - tempPeriod);
        try {
          dateRangePickerInstance = await createDateRangePicker(dateRangeInput, {
            presetStart: startDate.toISOString(),
            presetEnd: endDate.toISOString(),
            includeTime: true,
            timePrecision: 'hour',
            maxRangeDays: 90,
            locale: 'pt-BR',
            parentEl: document.getElementById(`${widgetId}-settings-overlay`) as HTMLElement,
            onApply: (result) => {
              tempStartDate = result.startISO;
              tempEndDate = result.endISO;
              const start = new Date(result.startISO);
              const end = new Date(result.endISO);
              const diffTime = Math.abs(end.getTime() - start.getTime());
              const diffHours = diffTime / (1000 * 60 * 60);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              tempPeriod = diffDays || 7;

              // If period is <= 2 days, force granularity to hourly
              const granularitySelect = document.getElementById(
                `${widgetId}-settings-granularity`
              ) as HTMLSelectElement;
              if (granularitySelect && diffHours <= 48) {
                granularitySelect.value = '1h';
                const dayPeriodField = document.getElementById(`${widgetId}-settings-dayperiod-field`);
                if (dayPeriodField) dayPeriodField.style.display = 'block';
              }
            },
          });
        } catch (error) {
          console.warn('[ConsumptionChartWidget] DateRangePicker reset failed:', error);
        }
      }

      // Reset granularity to daily
      const granularitySelect = document.getElementById(
        `${widgetId}-settings-granularity`
      ) as HTMLSelectElement;
      if (granularitySelect) granularitySelect.value = '1d';

      // Hide day period field
      const dayPeriodField = document.getElementById(`${widgetId}-settings-dayperiod-field`);
      if (dayPeriodField) dayPeriodField.style.display = 'none';

      // Reset weekday checkboxes
      document.querySelectorAll<HTMLInputElement>(`input[name="${widgetId}-weekday"]`).forEach((cb) => {
        cb.checked = true;
      });
      updateWeekdayLabel();

      // Reset day period checkboxes
      document.querySelectorAll<HTMLInputElement>(`input[name="${widgetId}-dayperiod"]`).forEach((cb) => {
        cb.checked = true;
      });
      updateDayPeriodLabel();

      updateSettingsModalValues();
    });

    // Apply button
    document.getElementById(`${widgetId}-settings-apply`)?.addEventListener('click', async () => {
      // Get ideal range values
      const minInput = document.getElementById(`${widgetId}-settings-range-min`) as HTMLInputElement;
      const maxInput = document.getElementById(`${widgetId}-settings-range-max`) as HTMLInputElement;
      const labelInput = document.getElementById(`${widgetId}-settings-range-label`) as HTMLInputElement;
      const periodSelect = document.getElementById(`${widgetId}-settings-period`) as HTMLSelectElement;

      const min = parseFloat(minInput?.value || '0');
      const max = parseFloat(maxInput?.value || '0');
      const label = labelInput?.value || '';
      tempPeriod = parseInt(periodSelect?.value || '7', 10);

      // Update ideal range
      if (min > 0 || max > 0) {
        tempIdealRange = { min, max, label };
      } else {
        tempIdealRange = null;
      }

      // Apply changes
      closeSettingsModal();

      // Update theme first (affects styles)
      if (tempTheme !== currentTheme) {
        instance.setTheme(tempTheme);
      }

      // Update chart type
      if (tempChartType !== currentChartType) {
        instance.setChartType(tempChartType);
      }

      // Update viz mode
      if (tempVizMode !== currentVizMode) {
        instance.setVizMode(tempVizMode);
      }

      // Update ideal range
      if (JSON.stringify(tempIdealRange) !== JSON.stringify(currentIdealRange)) {
        instance.setIdealRange(tempIdealRange);
      }

      // Update period (triggers data fetch)
      if (tempPeriod !== currentPeriod) {
        await instance.setPeriod(tempPeriod);
      }
    });
  }

  // ============================================================================
  // Instance
  // ============================================================================

  const instance: ConsumptionWidgetInstance = {
    async render(): Promise<void> {
      // Get container
      containerElement = document.getElementById(config.containerId);
      if (!containerElement) {
        console.error(`[ConsumptionWidget] Container #${config.containerId} not found`);
        return;
      }

      // Inject styles
      injectStyles();

      // Render HTML
      containerElement.innerHTML = renderHTML();

      // Setup listeners
      setupListeners();

      // Show loading
      setLoading(true);

      // Create chart instance
      chartInstance = createConsumption7DaysChart({
        ...config,
        containerId: `${widgetId}-canvas`,
        theme: currentTheme,
        defaultChartType: currentChartType,
        defaultVizMode: currentVizMode,
        defaultPeriod: currentPeriod,
        idealRange: currentIdealRange,
        colors: {
          primary: primaryColor,
          background: `${primaryColor}20`,
          shoppingColors: domainColors,
          ...config.colors,
        },
        onDataLoaded: (data) => {
          setLoading(false);
          updateFooterStats(data);
          config.onDataLoaded?.(data);
        },
        onError: (error) => {
          setLoading(false);
          config.onError?.(error);
        },
      });

      // Render chart
      await chartInstance.render();
      setLoading(false);
    },

    async refresh(forceRefresh = false): Promise<void> {
      if (!chartInstance) return;
      setLoading(true);
      await chartInstance.refresh(forceRefresh);
      setLoading(false);
    },

    setChartType(type: ChartType): void {
      if (currentChartType === type) return;
      currentChartType = type;
      chartInstance?.setChartType(type);
      updateTabStates();
    },

    setVizMode(mode: VizMode): void {
      if (currentVizMode === mode) return;
      currentVizMode = mode;
      chartInstance?.setVizMode(mode);
      updateTabStates();
    },

    setTheme(theme: ThemeMode): void {
      if (currentTheme === theme) return;
      currentTheme = theme;
      chartInstance?.setTheme(theme);

      // Update widget classes
      const widget = document.getElementById(widgetId);
      if (widget) {
        widget.classList.toggle('dark', theme === 'dark');
      }

      updateStyles();
    },

    async setPeriod(days: number): Promise<void> {
      if (currentPeriod === days) return;
      currentPeriod = days;
      updateTitle();
      setLoading(true);
      await chartInstance?.setPeriod(days);
      setLoading(false);
    },

    setIdealRange(range: IdealRangeConfig | null): void {
      currentIdealRange = range;
      chartInstance?.setIdealRange(range);
    },

    getChart() {
      return chartInstance;
    },

    // Alias for backwards compatibility with createConsumption7DaysChart API
    getChartInstance() {
      return chartInstance?.getChartInstance?.() ?? null;
    },

    getCachedData() {
      return chartInstance?.getCachedData() ?? null;
    },

    exportCSV(filename?: string): void {
      chartInstance?.exportCSV(filename);
    },

    destroy(): void {
      // Destroy chart
      chartInstance?.destroy();
      chartInstance = null;

      // Remove styles
      if (styleElement) {
        styleElement.remove();
        styleElement = null;
      }

      // Settings header is handled by static API - no cleanup needed

      // Destroy date range picker
      if (dateRangePickerInstance) {
        dateRangePickerInstance.destroy();
        dateRangePickerInstance = null;
      }

      // Remove settings modal
      if (settingsModalElement) {
        settingsModalElement.remove();
        settingsModalElement = null;
      }

      // Clear container
      if (containerElement) {
        containerElement.innerHTML = '';
        containerElement = null;
      }
    },
  };

  return instance;
}
