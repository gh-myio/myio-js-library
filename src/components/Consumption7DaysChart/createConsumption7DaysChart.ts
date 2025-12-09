/**
 * RFC-0098: View Consumption Over 7 Days Component
 * Factory function to create a reusable consumption chart
 *
 * @example
 * ```typescript
 * import { createConsumption7DaysChart } from 'myio-js-library';
 *
 * const chart = createConsumption7DaysChart({
 *   domain: 'energy',
 *   containerId: 'lineChart',
 *   unit: 'kWh',
 *   unitLarge: 'MWh',
 *   thresholdForLargeUnit: 1000,
 *   fetchData: async (period) => fetchEnergyData(period),
 * });
 *
 * await chart.render();
 * ```
 */

import type {
  Consumption7DaysConfig,
  Consumption7DaysInstance,
  Consumption7DaysData,
  ChartType,
  VizMode,
  ThemeMode,
  IdealRangeConfig,
  TemperatureConfig,
  TemperatureReferenceLine,
} from './types';

import { DEFAULT_COLORS, DEFAULT_CONFIG, THEME_COLORS } from './types';

// Declare Chart.js as global (loaded externally in ThingsBoard)
declare const Chart: any;

/**
 * Creates a consumption chart instance with the given configuration
 *
 * @param config - Chart configuration options
 * @returns Chart instance with public API
 */
export function createConsumption7DaysChart(
  config: Consumption7DaysConfig
): Consumption7DaysInstance {
  // ============================================
  // INTERNAL STATE
  // ============================================

  let chartInstance: any = null;
  let cachedData: Consumption7DaysData | null = null;
  let currentPeriod = config.defaultPeriod ?? DEFAULT_CONFIG.defaultPeriod;
  let currentChartType: ChartType = config.defaultChartType ?? DEFAULT_CONFIG.defaultChartType;
  let currentVizMode: VizMode = config.defaultVizMode ?? DEFAULT_CONFIG.defaultVizMode;
  let currentTheme: ThemeMode = config.theme ?? DEFAULT_CONFIG.defaultTheme;
  let currentIdealRange: IdealRangeConfig | null = config.idealRange ?? null;
  let isRendered = false;
  let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

  // Merge colors with defaults for the domain
  const colors = {
    ...DEFAULT_COLORS[config.domain] ?? DEFAULT_COLORS.energy,
    ...config.colors,
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  /**
   * Gets element by ID within the widget container (ThingsBoard compatibility)
   * Falls back to document.getElementById if no container provided
   */
  function $id(id: string): HTMLElement | null {
    if (config.$container && config.$container[0]) {
      return config.$container[0].querySelector(`#${id}`);
    }
    return document.getElementById(id);
  }

  /**
   * Logs a message with domain prefix
   */
  function log(level: 'log' | 'warn' | 'error', ...args: any[]): void {
    const prefix = `[${config.domain.toUpperCase()}]`;
    console[level](prefix, ...args);
  }

  /**
   * Calculate fixed Y-axis max to prevent infinite growth animation bug
   * Adds 10% padding and rounds to a nice number
   */
  function calculateYAxisMax(values: number[]): number {
    const maxValue = Math.max(...values, 0);

    // Temperature domain has different handling
    if (config.domain === 'temperature') {
      const tempConfig = config.temperatureConfig;
      if (tempConfig?.clampRange) {
        return tempConfig.clampRange.max;
      }
      // For temperature, add small padding
      const maxWithThreshold = Math.max(
        maxValue,
        tempConfig?.maxThreshold?.value ?? 0,
        tempConfig?.idealRange?.max ?? 0
      );
      return Math.ceil(maxWithThreshold + 5);
    }

    if (maxValue === 0) {
      // Default max when no data
      return config.thresholdForLargeUnit
        ? config.thresholdForLargeUnit / 2
        : 500;
    }

    // Determine rounding factor based on magnitude
    let roundTo: number;
    if (config.thresholdForLargeUnit && maxValue >= config.thresholdForLargeUnit) {
      roundTo = config.thresholdForLargeUnit / 10; // e.g., 100 for kWh
    } else if (maxValue >= 1000) {
      roundTo = 100;
    } else if (maxValue >= 100) {
      roundTo = 50;
    } else if (maxValue >= 10) {
      roundTo = 10;
    } else {
      roundTo = 5;
    }

    // Add 10% padding and round up
    return Math.ceil((maxValue * 1.1) / roundTo) * roundTo;
  }

  /**
   * Calculate Y-axis min for temperature charts
   */
  function calculateYAxisMin(values: number[]): number | undefined {
    if (config.domain !== 'temperature') {
      return 0; // Non-temperature charts start at 0
    }

    const tempConfig = config.temperatureConfig;
    if (tempConfig?.clampRange) {
      return tempConfig.clampRange.min;
    }

    const minValue = Math.min(...values);
    const minWithThreshold = Math.min(
      minValue,
      tempConfig?.minThreshold?.value ?? minValue,
      tempConfig?.idealRange?.min ?? minValue
    );

    return Math.floor(minWithThreshold - 5);
  }

  /**
   * Build temperature reference line annotations for Chart.js
   */
  function buildTemperatureAnnotations(): Record<string, any> {
    const tempConfig = config.temperatureConfig;
    if (!tempConfig || config.domain !== 'temperature') {
      return {};
    }

    const annotations: Record<string, any> = {};

    // Helper to create line annotation
    const createLineAnnotation = (line: TemperatureReferenceLine, id: string) => {
      const borderDash = line.lineStyle === 'dashed' ? [6, 6] :
        line.lineStyle === 'dotted' ? [2, 2] : [];

      return {
        type: 'line',
        yMin: line.value,
        yMax: line.value,
        borderColor: line.color,
        borderWidth: line.lineWidth ?? 2,
        borderDash,
        label: {
          display: true,
          content: line.label,
          position: 'end',
          backgroundColor: line.color,
          color: '#fff',
          font: { size: 10, weight: 'bold' },
          padding: { x: 4, y: 2 },
        },
      };
    };

    // Min threshold line
    if (tempConfig.minThreshold) {
      annotations['minThreshold'] = createLineAnnotation(tempConfig.minThreshold, 'minThreshold');
    }

    // Max threshold line
    if (tempConfig.maxThreshold) {
      annotations['maxThreshold'] = createLineAnnotation(tempConfig.maxThreshold, 'maxThreshold');
    }

    // Ideal range (shaded area)
    if (tempConfig.idealRange) {
      annotations['idealRange'] = {
        type: 'box',
        yMin: tempConfig.idealRange.min,
        yMax: tempConfig.idealRange.max,
        backgroundColor: tempConfig.idealRange.color,
        borderWidth: 0,
        label: tempConfig.idealRange.label ? {
          display: true,
          content: tempConfig.idealRange.label,
          position: { x: 'start', y: 'center' },
          color: '#666',
          font: { size: 10 },
        } : undefined,
      };
    }

    return annotations;
  }

  /**
   * Build ideal range annotation for any domain
   * Shows a shaded box between min and max values
   */
  function buildIdealRangeAnnotation(): Record<string, any> {
    if (!currentIdealRange) {
      return {};
    }

    // Check if range is valid (min and max are set and different)
    const { min, max, enabled = true } = currentIdealRange;
    if (!enabled || (min === 0 && max === 0) || min >= max) {
      return {};
    }

    // Default colors based on domain
    const defaultColors: Record<string, { bg: string; border: string }> = {
      temperature: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)' },
      energy: { bg: 'rgba(37, 99, 235, 0.1)', border: 'rgba(37, 99, 235, 0.3)' },
      water: { bg: 'rgba(2, 136, 209, 0.1)', border: 'rgba(2, 136, 209, 0.3)' },
      gas: { bg: 'rgba(234, 88, 12, 0.1)', border: 'rgba(234, 88, 12, 0.3)' },
    };

    const domainDefaults = defaultColors[config.domain] || defaultColors.energy;

    return {
      idealRangeBox: {
        type: 'box',
        yMin: min,
        yMax: max,
        backgroundColor: currentIdealRange.color || domainDefaults.bg,
        borderColor: currentIdealRange.borderColor || domainDefaults.border,
        borderWidth: 1,
        label: currentIdealRange.label ? {
          display: true,
          content: currentIdealRange.label,
          position: { x: 'start', y: 'center' },
          color: '#666',
          font: { size: 10, style: 'italic' },
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          padding: { x: 4, y: 2 },
        } : undefined,
      },
    };
  }

  /**
   * Format a value with the appropriate unit
   */
  function formatValue(value: number, includeUnit = true): string {
    const decimals = config.decimalPlaces ?? DEFAULT_CONFIG.decimalPlaces;

    if (
      config.unitLarge &&
      config.thresholdForLargeUnit &&
      value >= config.thresholdForLargeUnit
    ) {
      const converted = value / config.thresholdForLargeUnit;
      return includeUnit
        ? `${converted.toFixed(decimals)} ${config.unitLarge}`
        : converted.toFixed(decimals);
    }

    return includeUnit
      ? `${value.toFixed(decimals)} ${config.unit}`
      : value.toFixed(decimals);
  }

  /**
   * Format tick value for axis display
   */
  function formatTickValue(value: number): string {
    if (
      config.unitLarge &&
      config.thresholdForLargeUnit &&
      value >= config.thresholdForLargeUnit
    ) {
      return `${(value / config.thresholdForLargeUnit).toFixed(1)}`;
    }
    return value.toFixed(0);
  }

  /**
   * Build Chart.js configuration object
   */
  function buildChartConfig(data: Consumption7DaysData): any {
    const yAxisMax = calculateYAxisMax(data.dailyTotals);
    const yAxisMin = calculateYAxisMin(data.dailyTotals);
    const tension = config.lineTension ?? DEFAULT_CONFIG.lineTension;
    const pointRadius = config.pointRadius ?? DEFAULT_CONFIG.pointRadius;
    const borderWidth = config.borderWidth ?? DEFAULT_CONFIG.borderWidth;
    const fill = config.fill ?? DEFAULT_CONFIG.fill;
    const showLegend = config.showLegend ?? DEFAULT_CONFIG.showLegend;
    const themeColors = THEME_COLORS[currentTheme];
    const isTemperature = config.domain === 'temperature';

    // Build datasets based on vizMode
    let datasets: any[];

    if (currentVizMode === 'separate' && data.shoppingData && data.shoppingNames) {
      // Per-shopping datasets - use config colors or defaults
      const shoppingColors = colors.shoppingColors || [
        '#2563eb', '#16a34a', '#ea580c', '#dc2626', '#8b5cf6',
        '#0891b2', '#65a30d', '#d97706', '#be185d', '#0d9488',
      ];

      datasets = Object.entries(data.shoppingData).map(([shoppingId, values], index) => ({
        label: data.shoppingNames?.[shoppingId] || shoppingId,
        data: values,
        borderColor: shoppingColors[index % shoppingColors.length],
        backgroundColor: currentChartType === 'line'
          ? `${shoppingColors[index % shoppingColors.length]}20`
          : shoppingColors[index % shoppingColors.length],
        fill: currentChartType === 'line' && fill,
        tension,
        borderWidth,
        pointRadius: currentChartType === 'line' ? pointRadius : 0,
        pointBackgroundColor: shoppingColors[index % shoppingColors.length],
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }));
    } else {
      // Consolidated single dataset
      const datasetLabel = isTemperature
        ? `Temperatura (${config.unit})`
        : `Consumo (${config.unit})`;

      datasets = [
        {
          label: datasetLabel,
          data: data.dailyTotals,
          borderColor: colors.primary,
          backgroundColor: currentChartType === 'line' ? colors.background : colors.primary,
          fill: currentChartType === 'line' && fill,
          tension,
          borderWidth,
          pointRadius: currentChartType === 'line' ? pointRadius : 0,
          pointBackgroundColor: colors.pointBackground || colors.primary,
          pointBorderColor: colors.pointBorder || '#fff',
          pointBorderWidth: 2,
          borderRadius: currentChartType === 'bar' ? 4 : 0,
        },
      ];
    }

    // Build annotations (temperature-specific + ideal range for all domains)
    const temperatureAnnotations = buildTemperatureAnnotations();
    const idealRangeAnnotations = buildIdealRangeAnnotation();
    const allAnnotations = { ...temperatureAnnotations, ...idealRangeAnnotations };

    // Determine Y-axis unit label
    const yAxisLabel =
      config.unitLarge && config.thresholdForLargeUnit && yAxisMax >= config.thresholdForLargeUnit
        ? config.unitLarge
        : config.unit;

    return {
      type: currentChartType,
      data: {
        labels: data.labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // CRITICAL: Prevents infinite growth bug
        plugins: {
          legend: {
            display: showLegend || currentVizMode === 'separate',
            position: 'bottom' as const,
            labels: {
              color: themeColors.text,
            },
          },
          tooltip: {
            backgroundColor: themeColors.tooltipBackground,
            titleColor: themeColors.tooltipText,
            bodyColor: themeColors.tooltipText,
            borderColor: themeColors.border,
            borderWidth: 1,
            callbacks: {
              label: function (context: any) {
                const value = context.parsed.y || 0;
                const label = context.dataset.label || '';
                return `${label}: ${formatValue(value)}`;
              },
            },
          },
          // Reference lines and ideal range (requires chartjs-plugin-annotation)
          annotation: Object.keys(allAnnotations).length > 0 ? {
            annotations: allAnnotations,
          } : undefined,
        },
        scales: {
          y: {
            beginAtZero: !isTemperature, // Temperature can have negative values
            min: yAxisMin,
            max: yAxisMax, // CRITICAL: Fixed max prevents animation loop
            grid: {
              color: themeColors.grid,
            },
            title: {
              display: true,
              text: yAxisLabel,
              font: { size: 12 },
              color: themeColors.text,
            },
            ticks: {
              font: { size: 11 },
              color: themeColors.textMuted,
              callback: function (value: number) {
                return formatTickValue(value);
              },
            },
          },
          x: {
            grid: {
              color: themeColors.grid,
            },
            ticks: {
              font: { size: 11 },
              color: themeColors.textMuted,
            },
          },
        },
      },
    };
  }

  /**
   * Validate that Chart.js is available
   */
  function validateChartJs(): boolean {
    if (typeof Chart === 'undefined') {
      log('error', 'Chart.js not loaded. Cannot initialize chart.');
      config.onError?.(new Error('Chart.js not loaded'));
      return false;
    }
    return true;
  }

  /**
   * Validate that canvas element exists
   */
  function validateCanvas(): HTMLCanvasElement | null {
    const canvas = $id(config.containerId) as HTMLCanvasElement | null;
    if (!canvas) {
      log('error', `Canvas #${config.containerId} not found`);
      config.onError?.(new Error(`Canvas #${config.containerId} not found`));
      return null;
    }
    return canvas;
  }

  /**
   * Setup auto-refresh if configured
   */
  function setupAutoRefresh(): void {
    if (config.autoRefreshInterval && config.autoRefreshInterval > 0) {
      if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
      }
      autoRefreshTimer = setInterval(async () => {
        log('log', 'Auto-refreshing data...');
        await instance.refresh(true);
      }, config.autoRefreshInterval);
    }
  }

  /**
   * Cleanup auto-refresh timer
   */
  function cleanupAutoRefresh(): void {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  /**
   * Setup button handlers (settings, maximize, export)
   */
  function setupButtonHandlers(): void {
    // Settings button handler
    if (config.settingsButtonId && config.onSettingsClick) {
      const settingsBtn = $id(config.settingsButtonId);
      if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
          log('log', 'Settings button clicked');
          config.onSettingsClick?.();
        });
        log('log', 'Settings button handler attached');
      }
    }

    // Maximize button handler
    if (config.maximizeButtonId && config.onMaximizeClick) {
      const maximizeBtn = $id(config.maximizeButtonId);
      if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => {
          log('log', 'Maximize button clicked');
          config.onMaximizeClick?.();
        });
        log('log', 'Maximize button handler attached');
      }
    }

    // Export button handler
    const enableExport = config.enableExport ?? DEFAULT_CONFIG.enableExport;
    if (enableExport && config.exportButtonId) {
      const exportBtn = $id(config.exportButtonId);
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          log('log', 'Export button clicked');
          if (config.onExportCSV && cachedData) {
            config.onExportCSV(cachedData);
          } else {
            instance.exportCSV();
          }
        });
        log('log', 'Export button handler attached');
      }
    }
  }

  /**
   * Generate CSV content from data
   */
  function generateCSVContent(data: Consumption7DaysData): string {
    const rows: string[] = [];
    const decimals = config.decimalPlaces ?? DEFAULT_CONFIG.decimalPlaces;

    // Header row
    if (currentVizMode === 'separate' && data.shoppingData && data.shoppingNames) {
      const shoppingHeaders = Object.keys(data.shoppingData).map(
        id => data.shoppingNames?.[id] || id
      );
      rows.push(['Data', ...shoppingHeaders, 'Total'].join(';'));

      // Data rows
      data.labels.forEach((label, index) => {
        const shoppingValues = Object.keys(data.shoppingData!).map(
          id => data.shoppingData![id][index].toFixed(decimals)
        );
        rows.push([label, ...shoppingValues, data.dailyTotals[index].toFixed(decimals)].join(';'));
      });
    } else {
      // Simple total view
      rows.push(['Data', `Consumo (${config.unit})`].join(';'));
      data.labels.forEach((label, index) => {
        rows.push([label, data.dailyTotals[index].toFixed(decimals)].join(';'));
      });
    }

    // Summary row
    const total = data.dailyTotals.reduce((sum, v) => sum + v, 0);
    const avg = total / data.dailyTotals.length;
    rows.push('');
    rows.push(['Total', total.toFixed(decimals)].join(';'));
    rows.push(['Média', avg.toFixed(decimals)].join(';'));

    return rows.join('\n');
  }

  /**
   * Download CSV file
   */
  function downloadCSV(content: string, filename: string): void {
    // Add BOM for Excel UTF-8 compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    log('log', `CSV exported: ${filename}.csv`);
  }

  /**
   * Update the title element with current period
   */
  function updateTitle(): void {
    if (config.titleElementId) {
      const titleEl = $id(config.titleElementId);
      if (titleEl) {
        if (currentPeriod === 0) {
          titleEl.textContent = `Consumo - Período Personalizado`;
        } else {
          titleEl.textContent = `Consumo dos últimos ${currentPeriod} dias`;
        }
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  const instance: Consumption7DaysInstance = {
    async render(): Promise<void> {
      log('log', 'Rendering chart...');

      // Validate prerequisites
      if (!validateChartJs()) return;
      const canvas = validateCanvas();
      if (!canvas) return;

      try {
        // RFC-0098: Use initialData if provided (instant display), otherwise fetch
        if (config.initialData) {
          log('log', 'Using initial data (instant display)');
          cachedData = config.initialData;
          cachedData.fetchTimestamp = cachedData.fetchTimestamp || Date.now();
        } else {
          // Fetch data from API
          log('log', `Fetching ${currentPeriod} days of data...`);
          cachedData = await config.fetchData(currentPeriod);
          cachedData.fetchTimestamp = Date.now();
        }

        // Apply pre-render hook if provided
        if (config.onBeforeRender) {
          cachedData = config.onBeforeRender(cachedData);
        }

        // Destroy existing chart
        if (chartInstance) {
          chartInstance.destroy();
          chartInstance = null;
        }

        // Create new chart
        const ctx = canvas.getContext('2d');
        const chartConfig = buildChartConfig(cachedData);
        chartInstance = new Chart(ctx, chartConfig);
        isRendered = true;

        // Calculate Y-axis max for logging
        const yAxisMax = calculateYAxisMax(cachedData.dailyTotals);
        log('log', `Chart initialized with yAxisMax: ${yAxisMax}`);

        // Callbacks
        config.onDataLoaded?.(cachedData);
        config.onAfterRender?.(chartInstance);

        // Setup button handlers (settings, maximize)
        setupButtonHandlers();

        // Update title
        updateTitle();

        // Setup auto-refresh
        setupAutoRefresh();
      } catch (error) {
        log('error', 'Failed to render chart:', error);
        config.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    },

    async update(data?: Consumption7DaysData): Promise<void> {
      if (data) {
        cachedData = data;
        cachedData.fetchTimestamp = Date.now();
      }

      if (!chartInstance || !cachedData) {
        log('warn', 'Cannot update: chart not initialized or no data');
        return;
      }

      // Apply pre-render hook if provided
      let renderData = cachedData;
      if (config.onBeforeRender) {
        renderData = config.onBeforeRender(cachedData);
      }

      const chartConfig = buildChartConfig(renderData);

      // Update chart data and options
      chartInstance.data = chartConfig.data;
      chartInstance.options = chartConfig.options;
      chartInstance.update('none'); // No animation

      log('log', 'Chart updated');
    },

    setChartType(type: ChartType): void {
      if (currentChartType === type) return;

      log('log', `Changing chart type to: ${type}`);
      currentChartType = type;

      if (cachedData && chartInstance) {
        // Need to recreate chart for type change
        const canvas = validateCanvas();
        if (canvas) {
          chartInstance.destroy();
          const ctx = canvas.getContext('2d');
          chartInstance = new Chart(ctx, buildChartConfig(cachedData));
        }
      }
    },

    setVizMode(mode: VizMode): void {
      if (currentVizMode === mode) return;

      log('log', `Changing viz mode to: ${mode}`);
      currentVizMode = mode;

      if (cachedData) {
        this.update();
      }
    },

    async setPeriod(days: number): Promise<void> {
      if (currentPeriod === days) return;

      log('log', `Changing period to: ${days} days`);
      currentPeriod = days;
      updateTitle();
      await this.refresh(true);
    },

    async refresh(forceRefresh = false): Promise<void> {
      // Check cache validity
      if (!forceRefresh && cachedData?.fetchTimestamp) {
        const age = Date.now() - cachedData.fetchTimestamp;
        const ttl = config.cacheTTL ?? DEFAULT_CONFIG.cacheTTL;

        if (age < ttl) {
          log('log', `Using cached data (age: ${Math.round(age / 1000)}s)`);
          return;
        }
      }

      log('log', 'Refreshing data...');
      await this.render();
    },

    destroy(): void {
      log('log', 'Destroying chart...');

      cleanupAutoRefresh();

      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }

      cachedData = null;
      isRendered = false;
    },

    getChartInstance(): any | null {
      return chartInstance;
    },

    getCachedData(): Consumption7DaysData | null {
      return cachedData;
    },

    getState() {
      return {
        period: currentPeriod,
        chartType: currentChartType,
        vizMode: currentVizMode,
        theme: currentTheme,
        isRendered,
      };
    },

    exportCSV(filename?: string): void {
      if (!cachedData) {
        log('warn', 'Cannot export: no data available');
        return;
      }

      const defaultFilename = config.exportFilename ||
        `${config.domain}-consumo-${new Date().toISOString().slice(0, 10)}`;
      const csvContent = generateCSVContent(cachedData);
      downloadCSV(csvContent, filename || defaultFilename);
    },

    setTheme(theme: ThemeMode): void {
      if (currentTheme === theme) return;

      log('log', `Changing theme to: ${theme}`);
      currentTheme = theme;

      if (cachedData && chartInstance) {
        // Recreate chart with new theme colors
        const canvas = validateCanvas();
        if (canvas) {
          chartInstance.destroy();
          const ctx = canvas.getContext('2d');
          chartInstance = new Chart(ctx, buildChartConfig(cachedData));
        }
      }
    },

    setIdealRange(range: IdealRangeConfig | null): void {
      const rangeChanged = JSON.stringify(currentIdealRange) !== JSON.stringify(range);
      if (!rangeChanged) return;

      if (range) {
        log('log', `Setting ideal range: ${range.min} - ${range.max}`);
      } else {
        log('log', 'Clearing ideal range');
      }

      currentIdealRange = range;

      // Re-render chart to show/hide ideal range
      if (cachedData && chartInstance) {
        const canvas = validateCanvas();
        if (canvas) {
          chartInstance.destroy();
          const ctx = canvas.getContext('2d');
          chartInstance = new Chart(ctx, buildChartConfig(cachedData));
        }
      }
    },

    getIdealRange(): IdealRangeConfig | null {
      return currentIdealRange;
    },
  };

  return instance;
}
