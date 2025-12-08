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

    return `
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
            gap: 16px;
            padding: 12px 16px;
            background: ${currentTheme === 'dark' ? '#374151' : '#f7f7f7'};
            border-bottom: 1px solid ${colors.border};
            align-items: center;
            flex-wrap: wrap;
          ">
            <!-- Viz Mode Tabs -->
            <div style="display: flex; gap: 2px; background: ${currentTheme === 'dark' ? '#4b5563' : '#e5e7eb'}; border-radius: 8px; padding: 2px;">
              <button id="${modalId}-viz-total" style="
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                background: ${currentVizMode === 'total' ? '#3e1a7d' : 'transparent'};
                color: ${currentVizMode === 'total' ? 'white' : colors.text};
              ">Consolidado</button>
              <button id="${modalId}-viz-separate" style="
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                background: ${currentVizMode === 'separate' ? '#3e1a7d' : 'transparent'};
                color: ${currentVizMode === 'separate' ? 'white' : colors.text};
              ">Por Shopping</button>
            </div>

            <!-- Chart Type Tabs -->
            <div style="display: flex; gap: 2px; background: ${currentTheme === 'dark' ? '#4b5563' : '#e5e7eb'}; border-radius: 8px; padding: 2px;">
              <button id="${modalId}-type-line" style="
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                background: ${currentChartType === 'line' ? '#3e1a7d' : 'transparent'};
                color: ${currentChartType === 'line' ? 'white' : colors.text};
              ">Linhas</button>
              <button id="${modalId}-type-bar" style="
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                background: ${currentChartType === 'bar' ? '#3e1a7d' : 'transparent'};
                color: ${currentChartType === 'bar' ? 'white' : colors.text};
              ">Barras</button>
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

    // Update viz mode buttons
    const vizTotalBtn = document.getElementById(`${modalId}-viz-total`) as HTMLButtonElement;
    const vizSeparateBtn = document.getElementById(`${modalId}-viz-separate`) as HTMLButtonElement;
    if (vizTotalBtn) {
      vizTotalBtn.style.background = currentVizMode === 'total' ? '#3e1a7d' : 'transparent';
      vizTotalBtn.style.color = currentVizMode === 'total' ? 'white' : colors.text;
    }
    if (vizSeparateBtn) {
      vizSeparateBtn.style.background = currentVizMode === 'separate' ? '#3e1a7d' : 'transparent';
      vizSeparateBtn.style.color = currentVizMode === 'separate' ? 'white' : colors.text;
    }

    // Update chart type buttons
    const typeLineBtn = document.getElementById(`${modalId}-type-line`) as HTMLButtonElement;
    const typeBarBtn = document.getElementById(`${modalId}-type-bar`) as HTMLButtonElement;
    if (typeLineBtn) {
      typeLineBtn.style.background = currentChartType === 'line' ? '#3e1a7d' : 'transparent';
      typeLineBtn.style.color = currentChartType === 'line' ? 'white' : colors.text;
    }
    if (typeBarBtn) {
      typeBarBtn.style.background = currentChartType === 'bar' ? '#3e1a7d' : 'transparent';
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

      // Create chart instance
      chartInstance = createConsumption7DaysChart({
        ...config,
        containerId: `${modalId}-chart`,
        theme: currentTheme,
        defaultChartType: currentChartType,
        defaultVizMode: currentVizMode,
      });

      // Render chart
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
