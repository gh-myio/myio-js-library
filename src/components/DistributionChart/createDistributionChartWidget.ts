/**
 * RFC-0102: Distribution Chart Widget
 * Self-contained horizontal bar chart for consumption distribution
 * Supports ENERGY, WATER, and other domains with consistent shopping colors
 */

import type {
  DistributionChartConfig,
  DistributionChartInstance,
  DistributionData,
  ThemeMode,
  DistributionThemeColors,
} from './types';

import {
  getDefaultGroupColors,
  getShoppingColor,
  getGroupColor,
  getThemeColors,
  getHashColor,
  DEFAULT_SHOPPING_COLORS,
} from './colorManager';

// SVG Icons (same as createConsumptionChartWidget for consistency)
const settingsIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;pointer-events:none"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

const maximizeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;pointer-events:none"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;

/**
 * Create a distribution chart widget
 * Injects all HTML into the container element
 */
export function createDistributionChartWidget(
  config: DistributionChartConfig
): DistributionChartInstance {
  // Generate unique widget ID
  const widgetId = `distribution-${config.domain}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Internal state
  let chartInstance: any = null;
  let currentMode = config.defaultMode || 'groups';
  let currentTheme: ThemeMode = config.theme || 'light';
  let currentData: DistributionData | null = null;
  let containerElement: HTMLElement | null = null;
  let isLoading = false;

  // Configuration with defaults
  const title = config.title || getDomainTitle(config.domain);
  const chartHeight = config.chartHeight || 300;
  const showHeader = config.showHeader !== false;
  const showModeSelector = config.showModeSelector !== false;
  const showSettingsButton = config.showSettingsButton ?? false;
  const showMaximizeButton = config.showMaximizeButton ?? false;
  const decimalPlaces = config.decimalPlaces ?? 2;
  const modes = config.modes || getDefaultModes(config.domain);
  const groupColors = config.groupColors || getDefaultGroupColors(config.domain);

  /**
   * Get default title based on domain
   */
  function getDomainTitle(domain: string): string {
    const titles: Record<string, string> = {
      energy: 'Distribuição de Energia',
      water: 'Distribuição de Água',
      gas: 'Distribuição de Gás',
      temperature: 'Distribuição de Temperatura',
    };
    return titles[domain.toLowerCase()] || `Distribuição de ${domain}`;
  }

  /**
   * Get default modes based on domain
   */
  function getDefaultModes(domain: string): { value: string; label: string }[] {
    if (domain === 'water') {
      return [
        { value: 'groups', label: 'Lojas vs Área Comum' },
        { value: 'stores', label: 'Lojas por Shopping' },
        { value: 'common', label: 'Área Comum por Shopping' },
      ];
    }

    // Default for energy and others
    return [
      { value: 'groups', label: 'Por Grupos de Equipamentos' },
      { value: 'elevators', label: 'Elevadores por Shopping' },
      { value: 'escalators', label: 'Escadas Rolantes por Shopping' },
      { value: 'hvac', label: 'Climatização por Shopping' },
      { value: 'others', label: 'Outros Equipamentos por Shopping' },
      { value: 'stores', label: 'Lojas por Shopping' },
    ];
  }

  /**
   * Helper to get element within container (ThingsBoard compatibility)
   */
  function $id(id: string): HTMLElement | null {
    if (config.$container) {
      return config.$container[0].querySelector(`#${id}`);
    }
    return document.getElementById(id);
  }

  /**
   * Format value with unit
   */
  function formatValue(value: number): string {
    if (config.unitLarge && config.thresholdForLargeUnit && value >= config.thresholdForLargeUnit) {
      return `${(value / config.thresholdForLargeUnit).toFixed(decimalPlaces)} ${config.unitLarge}`;
    }
    return `${value.toFixed(decimalPlaces)} ${config.unit}`;
  }

  /**
   * Get color for a distribution entry
   */
  function getColor(key: string, index: number, isGroupMode: boolean): string {
    if (isGroupMode) {
      return getGroupColor(key, groupColors, config.domain, index);
    }

    // For shopping-based modes, try to get from orchestrator
    const shoppingColors = config.getShoppingColors?.();
    return getShoppingColor(key, shoppingColors, index);
  }

  /**
   * Get theme colors
   */
  function getColors(): DistributionThemeColors {
    return getThemeColors(currentTheme);
  }

  /**
   * Check if current mode is a group mode (not per-shopping)
   */
  function isGroupMode(): boolean {
    return currentMode === 'groups';
  }

  /**
   * Render the widget HTML
   */
  function renderHTML(): string {
    const colors = getColors();

    const modeOptions = modes
      .map(
        (m) =>
          `<option value="${m.value}" ${m.value === currentMode ? 'selected' : ''}>${m.label}</option>`
      )
      .join('');

    // Header buttons
    const headerButtons = [];
    if (showSettingsButton) {
      headerButtons.push(`
        <button id="${widgetId}-settings-btn" class="myio-dist-btn" title="Configurações">
          ${settingsIcon}
        </button>
      `);
    }
    if (showMaximizeButton) {
      headerButtons.push(`
        <button id="${widgetId}-maximize-btn" class="myio-dist-btn" title="Expandir">
          ${maximizeIcon}
        </button>
      `);
    }

    return `
      <style>
        #${widgetId} {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #${widgetId} .myio-dist-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        #${widgetId} .myio-dist-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: ${colors.text};
        }
        #${widgetId} .myio-dist-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #${widgetId} .myio-dist-label {
          font-size: 12px;
          color: ${colors.secondaryText};
        }
        #${widgetId} .myio-dist-select {
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid ${colors.border};
          background: ${colors.cardBackground};
          color: ${colors.text};
          font-size: 12px;
          cursor: pointer;
          min-width: 180px;
        }
        #${widgetId} .myio-dist-select:focus {
          outline: none;
          border-color: #3e1a7d;
        }
        #${widgetId} .myio-dist-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 8px;
          border: 1px solid ${colors.border};
          border-radius: 6px;
          background: transparent;
          color: ${colors.text};
          cursor: pointer;
          transition: all 0.2s;
        }
        #${widgetId} .myio-dist-btn:hover {
          background: #3e1a7d;
          border-color: #3e1a7d;
          color: white;
        }
        #${widgetId} .myio-dist-chart-container {
          position: relative;
          height: ${chartHeight}px;
        }
        #${widgetId} .myio-dist-loading {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${colors.cardBackground}ee;
          z-index: 10;
        }
        #${widgetId} .myio-dist-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid ${colors.border};
          border-top-color: #3e1a7d;
          border-radius: 50%;
          animation: myio-dist-spin 0.8s linear infinite;
        }
        @keyframes myio-dist-spin {
          to { transform: rotate(360deg); }
        }
        #${widgetId} .myio-dist-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: ${colors.secondaryText};
          font-size: 14px;
        }
        #${widgetId} .myio-dist-empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
          opacity: 0.5;
        }
      </style>

      <div id="${widgetId}" class="myio-distribution-widget" style="
        background: ${colors.cardBackground};
        border-radius: 12px;
        padding: 16px;
        height: 100%;
        display: flex;
        flex-direction: column;
      ">
        ${showHeader ? `
          <div class="myio-dist-header">
            <h4 class="myio-dist-title">${title}</h4>
            <div class="myio-dist-controls">
              ${showModeSelector && modes.length > 1 ? `
                <label for="${widgetId}-mode" class="myio-dist-label">Visualizar:</label>
                <select id="${widgetId}-mode" class="myio-dist-select">
                  ${modeOptions}
                </select>
              ` : ''}
              ${headerButtons.join('')}
            </div>
          </div>
        ` : ''}

        <div class="myio-dist-chart-container">
          <canvas id="${widgetId}-canvas"></canvas>
          <div id="${widgetId}-loading" class="myio-dist-loading" style="display: none;">
            <div class="myio-dist-spinner"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Show/hide loading indicator
   */
  function setLoading(loading: boolean): void {
    isLoading = loading;
    const loadingEl = $id(`${widgetId}-loading`);
    if (loadingEl) {
      loadingEl.style.display = loading ? 'flex' : 'none';
    }
  }

  /**
   * Build chart data from distribution
   */
  function buildChartData(distribution: DistributionData): {
    labels: string[];
    data: number[];
    backgroundColors: string[];
    total: number;
  } {
    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColors: string[] = [];

    const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
    const isGroup = isGroupMode();

    // Sort by value descending
    const entries = Object.entries(distribution)
      .filter(([_, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]);

    entries.forEach(([key, value], index) => {
      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
      labels.push(`${key} (${formatValue(value)} - ${percentage}%)`);
      data.push(value);
      backgroundColors.push(getColor(key, index, isGroup));
    });

    return { labels, data, backgroundColors, total };
  }

  /**
   * Render empty state
   */
  function renderEmptyState(): void {
    const container = $id(`${widgetId}-canvas`)?.parentElement;
    if (container) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'myio-dist-empty';
      emptyEl.innerHTML = `
        <div class="myio-dist-empty-icon">📊</div>
        <div>Sem dados disponíveis</div>
      `;

      // Hide canvas
      const canvas = $id(`${widgetId}-canvas`) as HTMLCanvasElement;
      if (canvas) canvas.style.display = 'none';

      // Add empty state if not already present
      const existingEmpty = container.querySelector('.myio-dist-empty');
      if (!existingEmpty) {
        container.appendChild(emptyEl);
      }
    }
  }

  /**
   * Remove empty state
   */
  function removeEmptyState(): void {
    const container = $id(`${widgetId}-canvas`)?.parentElement;
    if (container) {
      const emptyEl = container.querySelector('.myio-dist-empty');
      if (emptyEl) emptyEl.remove();

      const canvas = $id(`${widgetId}-canvas`) as HTMLCanvasElement;
      if (canvas) canvas.style.display = 'block';
    }
  }

  /**
   * Create or update the chart
   */
  async function updateChart(): Promise<void> {
    const canvas = $id(`${widgetId}-canvas`) as HTMLCanvasElement;
    if (!canvas) {
      console.error(`[${config.domain.toUpperCase()}] Distribution canvas not found`);
      return;
    }

    setLoading(true);

    try {
      // Fetch data
      const distribution = await config.fetchDistribution(currentMode);

      if (!distribution || Object.keys(distribution).length === 0) {
        console.warn(`[${config.domain.toUpperCase()}] No distribution data for mode: ${currentMode}`);
        currentData = null;
        setLoading(false);
        renderEmptyState();
        return;
      }

      removeEmptyState();
      currentData = distribution;

      const { labels, data, backgroundColors, total } = buildChartData(distribution);
      const colors = getColors();

      // Get Chart.js from global scope
      const Chart = (window as any).Chart;
      if (!Chart) {
        throw new Error('Chart.js not loaded');
      }

      // Destroy existing chart
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }

      // Create new chart
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: `Consumo (${config.unit})`,
              data,
              backgroundColor: backgroundColors,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y', // Horizontal bar chart
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  const value = context.parsed.x || 0;
                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                  return `${formatValue(value)} (${percentage}%)`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                callback: (value: number) => formatValue(Number(value)),
                color: colors.secondaryText,
                font: { size: 11 },
              },
              grid: { color: colors.grid },
            },
            y: {
              ticks: {
                font: { size: 11 },
                color: colors.text,
              },
              grid: { display: false },
            },
          },
        },
      });

      config.onDataLoaded?.(distribution);
      console.log(`[${config.domain.toUpperCase()}] Distribution chart updated for mode: ${currentMode}`);
    } catch (error) {
      console.error(`[${config.domain.toUpperCase()}] Error updating distribution chart:`, error);
      config.onError?.(error as Error);
      renderEmptyState();
    } finally {
      setLoading(false);
    }
  }

  /**
   * Setup event listeners
   */
  function setupListeners(): void {
    // Mode selector
    const modeSelect = $id(`${widgetId}-mode`) as HTMLSelectElement;
    if (modeSelect) {
      modeSelect.addEventListener('change', async (e) => {
        currentMode = (e.target as HTMLSelectElement).value;
        config.onModeChange?.(currentMode);
        await updateChart();
      });
    }

    // Settings button
    if (showSettingsButton) {
      const settingsBtn = $id(`${widgetId}-settings-btn`);
      if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
          config.onSettingsClick?.();
        });
      }
    }

    // Maximize button
    if (showMaximizeButton) {
      const maximizeBtn = $id(`${widgetId}-maximize-btn`);
      if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => {
          config.onMaximizeClick?.();
        });
      }
    }
  }

  /**
   * Update theme-dependent styles
   */
  function updateThemeStyles(): void {
    const colors = getColors();
    const widget = $id(widgetId);
    if (widget) {
      widget.style.background = colors.cardBackground;

      const title = widget.querySelector('.myio-dist-title') as HTMLElement;
      if (title) title.style.color = colors.text;

      const labels = widget.querySelectorAll('.myio-dist-label') as NodeListOf<HTMLElement>;
      labels.forEach((l) => (l.style.color = colors.secondaryText));

      const select = widget.querySelector('.myio-dist-select') as HTMLElement;
      if (select) {
        select.style.background = colors.cardBackground;
        select.style.color = colors.text;
        select.style.borderColor = colors.border;
      }

      const buttons = widget.querySelectorAll('.myio-dist-btn') as NodeListOf<HTMLElement>;
      buttons.forEach((b) => {
        b.style.color = colors.text;
        b.style.borderColor = colors.border;
      });
    }
  }

  // Public API
  const instance: DistributionChartInstance = {
    async render(): Promise<void> {
      containerElement = $id(config.containerId);
      if (!containerElement) {
        throw new Error(`Container #${config.containerId} not found`);
      }

      containerElement.innerHTML = renderHTML();
      setupListeners();
      await updateChart();
    },

    async setMode(mode: string): Promise<void> {
      currentMode = mode;
      const modeSelect = $id(`${widgetId}-mode`) as HTMLSelectElement;
      if (modeSelect) {
        modeSelect.value = mode;
      }
      config.onModeChange?.(mode);
      await updateChart();
    },

    async refresh(): Promise<void> {
      await updateChart();
    },

    setTheme(theme: ThemeMode): void {
      currentTheme = theme;
      updateThemeStyles();
      // Rebuild chart with new theme colors
      if (currentData) {
        updateChart();
      }
    },

    destroy(): void {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      if (containerElement) {
        containerElement.innerHTML = '';
      }
      currentData = null;
    },

    getChartInstance: () => chartInstance,
    getCurrentMode: () => currentMode,
    getCurrentData: () => currentData,
  };

  return instance;
}
