/**
 * RFC-0098: Consumption Modal with MyIO Header
 *
 * Creates a fullscreen modal for the consumption chart using the standard
 * MyIO header with theme toggle, maximize, export and close buttons.
 *
 * @example
 * ```typescript
 * import { createConsumptionModal } from 'myio-js-library';
 *
 * const modal = createConsumptionModal({
 *   domain: 'energy',
 *   title: 'Consumo de Energia',
 *   unit: 'kWh',
 *   fetchData: async (period) => fetchEnergyData(period),
 *   onClose: () => console.log('Modal closed'),
 * });
 *
 * await modal.open();
 * ```
 */

import type {
  Consumption7DaysConfig,
  Consumption7DaysData,
  ChartType,
  VizMode,
  ThemeMode,
} from './types';

import { createConsumption7DaysChart } from './createConsumption7DaysChart';
import { DEFAULT_COLORS, THEME_COLORS, DEFAULT_CONFIG } from './types';
import { createModalHeader, type ModalHeaderInstance, type ModalTheme, type ExportFormat } from '../ModalHeader';

// ============================================================================
// Types
// ============================================================================

export interface ConsumptionModalConfig extends Omit<Consumption7DaysConfig, 'containerId'> {
  /** Modal title */
  title?: string;
  /** Initial theme */
  theme?: ThemeMode;
  /** Callback when modal closes */
  onClose?: () => void;
  /** Container to append modal (default: document.body) */
  container?: HTMLElement;
  /** Export formats available (default: ['csv']) */
  exportFormats?: ExportFormat[];
  /** Custom export handler (receives format, default uses built-in CSV export) */
  onExport?: (format: ExportFormat) => void;
  /** Show settings button (default: true) */
  showSettingsButton?: boolean;
  /** Callback when settings button is clicked */
  onSettingsClick?: () => void;
  /** Initial data to display (skips fetch if provided) */
  initialData?: Consumption7DaysData;
}

export interface ConsumptionModalInstance {
  /** Opens the modal */
  open: () => Promise<void>;
  /** Closes the modal */
  close: () => void;
  /** Gets the chart instance */
  getChart: () => ReturnType<typeof createConsumption7DaysChart> | null;
  /** Destroys the modal and chart */
  destroy: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DOMAIN_CONFIG: Record<string, { name: string; icon: string }> = {
  energy: { name: 'Energia', icon: '⚡' },
  water: { name: 'Água', icon: '💧' },
  gas: { name: 'Gás', icon: '🔥' },
  temperature: { name: 'Temperatura', icon: '🌡️' },
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Creates a consumption modal with the standard MyIO header
 */
export function createConsumptionModal(
  config: ConsumptionModalConfig
): ConsumptionModalInstance {
  const modalId = `myio-consumption-modal-${Date.now()}`;
  let modalElement: HTMLElement | null = null;
  let chartInstance: ReturnType<typeof createConsumption7DaysChart> | null = null;
  let headerInstance: ModalHeaderInstance | null = null;
  let currentTheme: ThemeMode = config.theme ?? 'light';
  let currentChartType: ChartType = config.defaultChartType ?? 'line';
  let currentVizMode: VizMode = config.defaultVizMode ?? 'total';
  let isMaximized = false;

  // Get domain config
  const domainCfg = DOMAIN_CONFIG[config.domain] || { name: config.domain, icon: '📊' };
  const title = config.title || `${domainCfg.name} - Histórico de Consumo`;

  /**
   * Get theme colors
   */
  function getThemeColors() {
    return THEME_COLORS[currentTheme];
  }

  // SVG icons for tabs (same as widget)
  const consolidadoIcon = `<svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px;pointer-events:none"><rect x="3" y="3" width="10" height="10" rx="2"/></svg>`;
  const porShoppingIcon = `<svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px;pointer-events:none"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>`;
  const lineChartIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;pointer-events:none"><polyline points="2,12 5,7 9,9 14,3"/></svg>`;
  const barChartIcon = `<svg viewBox="0 0 16 16" fill="currentColor" style="width:14px;height:14px;pointer-events:none"><rect x="1" y="9" width="3" height="6" rx="0.5"/><rect x="6" y="5" width="3" height="10" rx="0.5"/><rect x="11" y="7" width="3" height="8" rx="0.5"/></svg>`;

  // Options
  const showSettingsButton = config.showSettingsButton ?? true;

  /**
   * Render the modal HTML
   */
  function renderModal(): string {
    const colors = getThemeColors();

    // Create header instance
    const exportFormats = config.exportFormats || ['csv'];
    headerInstance = createModalHeader({
      id: modalId,
      title: title,
      icon: domainCfg.icon,
      theme: currentTheme as ModalTheme,
      isMaximized: isMaximized,
      exportFormats: exportFormats,
      onExport: (format: ExportFormat) => {
        // If custom handler provided, use it
        if (config.onExport) {
          config.onExport(format);
        } else {
          // Default: only CSV is supported built-in
          if (format === 'csv') {
            chartInstance?.exportCSV();
          } else {
            console.warn(`[ConsumptionModal] Export format "${format}" requires custom onExport handler`);
          }
        }
      },
      onThemeToggle: (theme) => {
        currentTheme = theme as ThemeMode;
        chartInstance?.setTheme(currentTheme);
        updateModal();
      },
      onMaximize: (maximized) => {
        isMaximized = maximized;
        updateModal();
      },
      onClose: () => {
        instance.close();
      },
    });

    // Inline button styles
    const btnBaseStyle = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    `.replace(/\s+/g, ' ').trim();

    const tabBgColor = currentTheme === 'dark' ? '#4b5563' : '#e5e7eb';
    const activeColor = '#3e1a7d';
    const inactiveTextColor = colors.text;

    return `
      <style>
        .myio-modal-tab-btn {
          ${btnBaseStyle}
        }
        .myio-modal-tab-btn:hover {
          opacity: 0.85;
        }
        .myio-modal-tab-btn.active {
          background: ${activeColor} !important;
          color: white !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .myio-modal-tab-btn svg {
          pointer-events: none;
        }
        .myio-modal-settings-btn {
          background: transparent;
          border: 1px solid ${colors.border};
          font-size: 16px;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 6px;
          transition: all 0.2s;
          color: ${colors.text};
        }
        .myio-modal-settings-btn:hover {
          background: ${activeColor};
          border-color: ${activeColor};
          color: white;
        }
      </style>
      <div class="myio-consumption-modal-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
        z-index: 99998;
        display: flex;
        justify-content: center;
        align-items: center;
      ">
        <div class="myio-consumption-modal-content" style="
          background: ${colors.chartBackground};
          border-radius: ${isMaximized ? '0' : '10px'};
          width: ${isMaximized ? '100%' : '95%'};
          max-width: ${isMaximized ? '100%' : '1200px'};
          height: ${isMaximized ? '100%' : '85vh'};
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          overflow: hidden;
        ">
          <!-- MyIO Premium Header (using ModalHeader component) -->
          ${headerInstance.render()}

          <!-- Controls Bar -->
          <div class="myio-consumption-modal-controls" style="
            display: flex;
            gap: 12px;
            padding: 12px 16px;
            background: ${currentTheme === 'dark' ? '#374151' : '#f7f7f7'};
            border-bottom: 1px solid ${colors.border};
            align-items: center;
            flex-wrap: wrap;
          ">
            <!-- Settings Button -->
            ${showSettingsButton ? `
              <button id="${modalId}-settings-btn" class="myio-modal-settings-btn" title="Configurações">⚙️</button>
            ` : ''}

            <!-- Viz Mode Tabs -->
            <div style="display: flex; gap: 2px; background: ${tabBgColor}; border-radius: 8px; padding: 3px;">
              <button id="${modalId}-viz-total" class="myio-modal-tab-btn ${currentVizMode === 'total' ? 'active' : ''}"
                data-viz="total" title="Consolidado"
                style="background: ${currentVizMode === 'total' ? activeColor : 'transparent'}; color: ${currentVizMode === 'total' ? 'white' : inactiveTextColor};">
                ${consolidadoIcon}
              </button>
              <button id="${modalId}-viz-separate" class="myio-modal-tab-btn ${currentVizMode === 'separate' ? 'active' : ''}"
                data-viz="separate" title="Por Shopping"
                style="background: ${currentVizMode === 'separate' ? activeColor : 'transparent'}; color: ${currentVizMode === 'separate' ? 'white' : inactiveTextColor};">
                ${porShoppingIcon}
              </button>
            </div>

            <!-- Chart Type Tabs -->
            <div style="display: flex; gap: 2px; background: ${tabBgColor}; border-radius: 8px; padding: 3px;">
              <button id="${modalId}-type-line" class="myio-modal-tab-btn ${currentChartType === 'line' ? 'active' : ''}"
                data-type="line" title="Gráfico de Linhas"
                style="background: ${currentChartType === 'line' ? activeColor : 'transparent'}; color: ${currentChartType === 'line' ? 'white' : inactiveTextColor};">
                ${lineChartIcon}
              </button>
              <button id="${modalId}-type-bar" class="myio-modal-tab-btn ${currentChartType === 'bar' ? 'active' : ''}"
                data-type="bar" title="Gráfico de Barras"
                style="background: ${currentChartType === 'bar' ? activeColor : 'transparent'}; color: ${currentChartType === 'bar' ? 'white' : inactiveTextColor};">
                ${barChartIcon}
              </button>
            </div>
          </div>

          <!-- Chart Container -->
          <div style="
            flex: 1;
            padding: 16px;
            min-height: 0;
            position: relative;
            background: ${colors.chartBackground};
          ">
            <canvas id="${modalId}-chart" style="width: 100%; height: 100%;"></canvas>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners
   */
  function setupListeners(): void {
    if (!modalElement) return;

    // Attach header listeners (handles theme, maximize, close, export)
    headerInstance?.attachListeners();

    // Settings button
    if (showSettingsButton) {
      document.getElementById(`${modalId}-settings-btn`)?.addEventListener('click', () => {
        config.onSettingsClick?.();
      });
    }

    // Viz mode buttons
    document.getElementById(`${modalId}-viz-total`)?.addEventListener('click', () => {
      currentVizMode = 'total';
      chartInstance?.setVizMode('total');
      updateControlStyles();
    });
    document.getElementById(`${modalId}-viz-separate`)?.addEventListener('click', () => {
      currentVizMode = 'separate';
      chartInstance?.setVizMode('separate');
      updateControlStyles();
    });

    // Chart type buttons
    document.getElementById(`${modalId}-type-line`)?.addEventListener('click', () => {
      currentChartType = 'line';
      chartInstance?.setChartType('line');
      updateControlStyles();
    });
    document.getElementById(`${modalId}-type-bar`)?.addEventListener('click', () => {
      currentChartType = 'bar';
      chartInstance?.setChartType('bar');
      updateControlStyles();
    });

    // Click outside to close
    modalElement.querySelector('.myio-consumption-modal-overlay')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('myio-consumption-modal-overlay')) {
        instance.close();
      }
    });

    // ESC key to close
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        instance.close();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    (modalElement as any).__handleKeydown = handleKeydown;
  }

  /**
   * Update control button styles without re-rendering the entire modal
   */
  function updateControlStyles(): void {
    const colors = getThemeColors();
    const activeColor = '#3e1a7d';

    // Update viz mode buttons
    const vizTotalBtn = document.getElementById(`${modalId}-viz-total`) as HTMLButtonElement;
    const vizSeparateBtn = document.getElementById(`${modalId}-viz-separate`) as HTMLButtonElement;
    if (vizTotalBtn) {
      vizTotalBtn.classList.toggle('active', currentVizMode === 'total');
      vizTotalBtn.style.background = currentVizMode === 'total' ? activeColor : 'transparent';
      vizTotalBtn.style.color = currentVizMode === 'total' ? 'white' : colors.text;
    }
    if (vizSeparateBtn) {
      vizSeparateBtn.classList.toggle('active', currentVizMode === 'separate');
      vizSeparateBtn.style.background = currentVizMode === 'separate' ? activeColor : 'transparent';
      vizSeparateBtn.style.color = currentVizMode === 'separate' ? 'white' : colors.text;
    }

    // Update chart type buttons
    const typeLineBtn = document.getElementById(`${modalId}-type-line`) as HTMLButtonElement;
    const typeBarBtn = document.getElementById(`${modalId}-type-bar`) as HTMLButtonElement;
    if (typeLineBtn) {
      typeLineBtn.classList.toggle('active', currentChartType === 'line');
      typeLineBtn.style.background = currentChartType === 'line' ? activeColor : 'transparent';
      typeLineBtn.style.color = currentChartType === 'line' ? 'white' : colors.text;
    }
    if (typeBarBtn) {
      typeBarBtn.classList.toggle('active', currentChartType === 'bar');
      typeBarBtn.style.background = currentChartType === 'bar' ? activeColor : 'transparent';
      typeBarBtn.style.color = currentChartType === 'bar' ? 'white' : colors.text;
    }
  }

  /**
   * Update modal (re-render controls and styles)
   */
  function updateModal(): void {
    if (!modalElement) return;

    const cachedData = chartInstance?.getCachedData();

    // Destroy current header and chart
    headerInstance?.destroy();
    chartInstance?.destroy();

    // Re-render modal
    modalElement.innerHTML = renderModal();
    setupListeners();

    // Re-create chart with same data
    if (cachedData) {
      chartInstance = createConsumption7DaysChart({
        ...config,
        containerId: `${modalId}-chart`,
        theme: currentTheme,
        defaultChartType: currentChartType,
        defaultVizMode: currentVizMode,
      });
      chartInstance.update(cachedData);
    }
  }

  // ============================================================================
  // Instance
  // ============================================================================

  const instance: ConsumptionModalInstance = {
    async open(): Promise<void> {
      // Create modal container
      modalElement = document.createElement('div');
      modalElement.id = modalId;
      modalElement.innerHTML = renderModal();

      const container = config.container || document.body;
      container.appendChild(modalElement);

      // Setup listeners
      setupListeners();

      // Create chart instance with initialData passed through config
      chartInstance = createConsumption7DaysChart({
        ...config,
        containerId: `${modalId}-chart`,
        theme: currentTheme,
        defaultChartType: currentChartType,
        defaultVizMode: currentVizMode,
        // RFC-0098: Pass initialData to chart config for instant display
        initialData: config.initialData,
      });

      // Render chart (will use initialData if provided, otherwise fetch)
      await chartInstance.render();
    },

    close(): void {
      if (modalElement) {
        // Remove keydown listener
        const handleKeydown = (modalElement as any).__handleKeydown;
        if (handleKeydown) {
          document.removeEventListener('keydown', handleKeydown);
        }

        // Destroy header
        headerInstance?.destroy();
        headerInstance = null;

        // Destroy chart
        chartInstance?.destroy();
        chartInstance = null;

        // Remove modal
        modalElement.remove();
        modalElement = null;

        // Callback
        config.onClose?.();
      }
    },

    getChart() {
      return chartInstance;
    },

    destroy(): void {
      instance.close();
    },
  };

  return instance;
}
