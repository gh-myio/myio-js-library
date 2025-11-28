/**
 * Temperature Comparison Modal Component
 * RFC-0085: Multi-device temperature comparison visualization
 *
 * Displays temperature telemetry data for multiple devices with comparison chart.
 * Fetches data from ThingsBoard API.
 */

import {
  fetchTemperatureData,
  calculateStats,
  interpolateTemperature,
  aggregateByDay,
  formatTemperature,
  formatDateLabel,
  getThemeColors,
  getTodaySoFar,
  filterByDayPeriods,
  getSelectedPeriodsLabel,
  DEFAULT_CLAMP_RANGE,
  CHART_COLORS,
  DAY_PERIODS,
  type TemperatureTelemetry,
  type TemperatureStats,
  type ClampRange,
  type TemperatureGranularity,
  type ThemeColors,
  type DayPeriod
} from './utils';

import { createDateRangePicker, type DateRangeControl } from '../createDateRangePicker';

// ============================================================================
// Types
// ============================================================================

export interface TemperatureDevice {
  /** ThingsBoard device UUID */
  id: string;
  /** Device label for legend */
  label: string;
  /** Alternative ThingsBoard ID */
  tbId?: string;
}

export interface TemperatureComparisonModalParams {
  /** JWT token for ThingsBoard API */
  token: string;
  /** Array of devices to compare */
  devices: TemperatureDevice[];
  /** Start date in ISO format */
  startDate: string;
  /** End date in ISO format */
  endDate: string;
  /** Container element or selector */
  container?: HTMLElement | string;
  /** Callback when modal closes */
  onClose?: () => void;
  /** Locale for formatting */
  locale?: 'pt-BR' | 'en-US';
  /** Outlier clamping range */
  clampRange?: ClampRange;
  /** Initial granularity */
  granularity?: TemperatureGranularity;
  /** Initial theme */
  theme?: 'dark' | 'light';
}

export interface TemperatureComparisonModalInstance {
  /** Destroys the modal */
  destroy: () => void;
  /** Updates data with new date range */
  updateData: (startDate: string, endDate: string, granularity?: TemperatureGranularity) => Promise<void>;
}

interface DeviceData {
  device: TemperatureDevice;
  data: TemperatureTelemetry[];
  stats: TemperatureStats;
  color: string;
}

// ============================================================================
// Modal State
// ============================================================================

interface ModalState {
  token: string;
  devices: TemperatureDevice[];
  startTs: number;
  endTs: number;
  granularity: TemperatureGranularity;
  theme: 'dark' | 'light';
  clampRange: ClampRange;
  locale: string;
  deviceData: DeviceData[];
  isLoading: boolean;
  dateRangePicker: DateRangeControl | null;
  selectedPeriods: DayPeriod[];
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Opens a temperature comparison modal for multiple devices
 */
export async function openTemperatureComparisonModal(
  params: TemperatureComparisonModalParams
): Promise<TemperatureComparisonModalInstance> {
  const modalId = `myio-temp-comparison-modal-${Date.now()}`;

  // Default to "Today So Far" if dates not provided
  const defaultDateRange = getTodaySoFar();
  const startTs = params.startDate ? new Date(params.startDate).getTime() : defaultDateRange.startTs;
  const endTs = params.endDate ? new Date(params.endDate).getTime() : defaultDateRange.endTs;

  // Initialize state
  const state: ModalState = {
    token: params.token,
    devices: params.devices,
    startTs,
    endTs,
    granularity: params.granularity || 'hour',
    theme: params.theme || 'dark',
    clampRange: params.clampRange || DEFAULT_CLAMP_RANGE,
    locale: params.locale || 'pt-BR',
    deviceData: [],
    isLoading: true,
    dateRangePicker: null,
    selectedPeriods: ['madrugada', 'manha', 'tarde', 'noite'] // All periods selected by default
  };

  // Load saved preferences
  const savedGranularity = localStorage.getItem('myio-temp-comparison-granularity') as TemperatureGranularity;
  const savedTheme = localStorage.getItem('myio-temp-comparison-theme') as 'dark' | 'light';
  if (savedGranularity) state.granularity = savedGranularity;
  if (savedTheme) state.theme = savedTheme;

  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.id = modalId;
  document.body.appendChild(modalContainer);

  // Render modal
  renderModal(modalContainer, state, modalId);

  // Fetch initial data
  await fetchAllDevicesData(state);
  renderModal(modalContainer, state, modalId);
  drawComparisonChart(modalId, state);

  // Setup event listeners (async for DateRangePicker initialization)
  await setupEventListeners(modalContainer, state, modalId, params.onClose);

  // Return instance
  return {
    destroy: () => {
      modalContainer.remove();
      params.onClose?.();
    },
    updateData: async (startDate: string, endDate: string, granularity?: TemperatureGranularity) => {
      state.startTs = new Date(startDate).getTime();
      state.endTs = new Date(endDate).getTime();
      if (granularity) state.granularity = granularity;
      state.isLoading = true;
      renderModal(modalContainer, state, modalId);

      await fetchAllDevicesData(state);
      renderModal(modalContainer, state, modalId);
      drawComparisonChart(modalId, state);
      setupEventListeners(modalContainer, state, modalId, params.onClose);
    }
  };
}

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchAllDevicesData(state: ModalState): Promise<void> {
  state.isLoading = true;
  state.deviceData = [];

  try {
    const results = await Promise.all(
      state.devices.map(async (device, index) => {
        const deviceId = device.tbId || device.id;
        try {
          const data = await fetchTemperatureData(state.token, deviceId, state.startTs, state.endTs);
          const stats = calculateStats(data, state.clampRange);
          return {
            device,
            data,
            stats,
            color: CHART_COLORS[index % CHART_COLORS.length]
          };
        } catch (error) {
          console.error(`[TemperatureComparisonModal] Error fetching data for ${device.label}:`, error);
          return {
            device,
            data: [],
            stats: { avg: 0, min: 0, max: 0, count: 0 },
            color: CHART_COLORS[index % CHART_COLORS.length]
          };
        }
      })
    );

    state.deviceData = results;
  } catch (error) {
    console.error('[TemperatureComparisonModal] Error fetching data:', error);
  }

  state.isLoading = false;
}

// ============================================================================
// Rendering
// ============================================================================

function renderModal(
  container: HTMLElement,
  state: ModalState,
  modalId: string
): void {
  const colors = getThemeColors(state.theme);
  const startDateStr = new Date(state.startTs).toLocaleDateString(state.locale);
  const endDateStr = new Date(state.endTs).toLocaleDateString(state.locale);

  // Format date inputs
  const startDateInput = new Date(state.startTs).toISOString().slice(0, 16);
  const endDateInput = new Date(state.endTs).toISOString().slice(0, 16);

  // Generate legend HTML
  const legendHTML = state.deviceData.map(dd => `
    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'};
      border-radius: 8px;">
      <span style="width: 12px; height: 12px; border-radius: 50%; background: ${dd.color};"></span>
      <span style="color: ${colors.text}; font-size: 13px;">${dd.device.label}</span>
      <span style="color: ${colors.textMuted}; font-size: 11px; margin-left: auto;">
        ${dd.stats.count > 0 ? formatTemperature(dd.stats.avg) : 'N/A'}
      </span>
    </div>
  `).join('');

  // Generate stats cards HTML
  const statsHTML = state.deviceData.map(dd => `
    <div style="
      padding: 12px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
      border-radius: 10px; border-left: 4px solid ${dd.color};
      min-width: 150px;
    ">
      <div style="font-weight: 600; color: ${colors.text}; font-size: 13px; margin-bottom: 8px;">
        ${dd.device.label}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
        <span style="color: ${colors.textMuted};">Média:</span>
        <span style="color: ${colors.text}; font-weight: 500;">
          ${dd.stats.count > 0 ? formatTemperature(dd.stats.avg) : 'N/A'}
        </span>
        <span style="color: ${colors.textMuted};">Min:</span>
        <span style="color: ${colors.text};">
          ${dd.stats.count > 0 ? formatTemperature(dd.stats.min) : 'N/A'}
        </span>
        <span style="color: ${colors.textMuted};">Max:</span>
        <span style="color: ${colors.text};">
          ${dd.stats.count > 0 ? formatTemperature(dd.stats.max) : 'N/A'}
        </span>
        <span style="color: ${colors.textMuted};">Leituras:</span>
        <span style="color: ${colors.text};">${dd.stats.count}</span>
      </div>
    </div>
  `).join('');

  // Track maximized state
  const isMaximized = (container as any).__isMaximized || false;
  const contentMaxWidth = isMaximized ? '100%' : '1100px';
  const contentMaxHeight = isMaximized ? '100vh' : '95vh';
  const contentBorderRadius = isMaximized ? '0' : '10px';

  container.innerHTML = `
    <div class="myio-temp-comparison-overlay" style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); z-index: 9998;
      display: flex; justify-content: center; align-items: center;
      backdrop-filter: blur(2px);
    ">
      <div class="myio-temp-comparison-content" style="
        background: ${colors.surface}; border-radius: ${contentBorderRadius};
        max-width: ${contentMaxWidth}; width: ${isMaximized ? '100%' : '95%'};
        max-height: ${contentMaxHeight}; height: ${isMaximized ? '100%' : 'auto'};
        overflow: hidden; display: flex; flex-direction: column;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: 'Roboto', Arial, sans-serif;
      ">
        <!-- Header - MyIO Premium Style -->
        <div style="
          padding: 4px 8px; display: flex; align-items: center; justify-content: space-between;
          background: #3e1a7d; color: white; border-radius: ${isMaximized ? '0' : '10px 10px 0 0'};
          min-height: 20px;
        ">
          <h2 style="margin: 6px; font-size: 18px; font-weight: 600; color: white; line-height: 2;">
            🌡️ Comparação de Temperatura - ${state.devices.length} sensores
          </h2>
          <div style="display: flex; gap: 4px; align-items: center;">
            <!-- Theme Toggle -->
            <button id="${modalId}-theme-toggle" title="Alternar tema" style="
              background: none; border: none; font-size: 16px; cursor: pointer;
              padding: 4px 8px; border-radius: 6px; color: rgba(255,255,255,0.8);
              transition: background-color 0.2s;
            ">${state.theme === 'dark' ? '☀️' : '🌙'}</button>
            <!-- Maximize Button -->
            <button id="${modalId}-maximize" title="${isMaximized ? 'Restaurar' : 'Maximizar'}" style="
              background: none; border: none; font-size: 16px; cursor: pointer;
              padding: 4px 8px; border-radius: 6px; color: rgba(255,255,255,0.8);
              transition: background-color 0.2s;
            ">${isMaximized ? '🗗' : '🗖'}</button>
            <!-- Close Button -->
            <button id="${modalId}-close" title="Fechar" style="
              background: none; border: none; font-size: 20px; cursor: pointer;
              padding: 4px 8px; border-radius: 6px; color: rgba(255,255,255,0.8);
              transition: background-color 0.2s;
            ">×</button>
          </div>
        </div>

        <!-- Body -->
        <div style="flex: 1; overflow-y: auto; padding: 16px;">

        <!-- Controls Row -->
        <div style="
          display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end;
          margin-bottom: 16px; padding: 16px;
          background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f7f7f7'};
          border-radius: 6px; border: 1px solid ${colors.border};
        ">
          <!-- Granularity Select -->
          <div>
            <label style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500; display: block; margin-bottom: 4px;">
              Granularidade
            </label>
            <select id="${modalId}-granularity" style="
              padding: 8px 12px; border: 1px solid ${colors.border}; border-radius: 6px;
              font-size: 14px; color: ${colors.text}; background: ${colors.surface};
              cursor: pointer; min-width: 130px;
            ">
              <option value="hour" ${state.granularity === 'hour' ? 'selected' : ''}>Hora (30 min)</option>
              <option value="day" ${state.granularity === 'day' ? 'selected' : ''}>Dia (média)</option>
            </select>
          </div>
          <!-- Day Period Filter (Multiselect) -->
          <div style="position: relative;">
            <label style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500; display: block; margin-bottom: 4px;">
              Períodos do Dia
            </label>
            <button id="${modalId}-period-btn" type="button" style="
              padding: 8px 12px; border: 1px solid ${colors.border}; border-radius: 6px;
              font-size: 14px; color: ${colors.text}; background: ${colors.surface};
              cursor: pointer; min-width: 180px; text-align: left;
              display: flex; align-items: center; justify-content: space-between; gap: 8px;
            ">
              <span>${getSelectedPeriodsLabel(state.selectedPeriods)}</span>
              <span style="font-size: 10px;">▼</span>
            </button>
            <div id="${modalId}-period-dropdown" style="
              display: none; position: absolute; top: 100%; left: 0; z-index: 1000;
              background: ${colors.surface}; border: 1px solid ${colors.border};
              border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              min-width: 200px; margin-top: 4px; padding: 8px 0;
            ">
              ${DAY_PERIODS.map(period => `
                <label style="
                  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
                  cursor: pointer; font-size: 13px; color: ${colors.text};
                " onmouseover="this.style.background='${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f0f0'}'"
                   onmouseout="this.style.background='transparent'">
                  <input type="checkbox"
                    name="${modalId}-period"
                    value="${period.id}"
                    ${state.selectedPeriods.includes(period.id) ? 'checked' : ''}
                    style="width: 16px; height: 16px; cursor: pointer; accent-color: #3e1a7d;">
                  ${period.label}
                </label>
              `).join('')}
              <div style="border-top: 1px solid ${colors.border}; margin-top: 8px; padding-top: 8px;">
                <button id="${modalId}-period-select-all" type="button" style="
                  width: calc(100% - 16px); margin: 0 8px 4px; padding: 6px;
                  background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f0f0'};
                  border: none; border-radius: 4px; cursor: pointer;
                  font-size: 12px; color: ${colors.text};
                ">Selecionar Todos</button>
                <button id="${modalId}-period-clear" type="button" style="
                  width: calc(100% - 16px); margin: 0 8px; padding: 6px;
                  background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f0f0f0'};
                  border: none; border-radius: 4px; cursor: pointer;
                  font-size: 12px; color: ${colors.text};
                ">Limpar Seleção</button>
              </div>
            </div>
          </div>
          <!-- Date Range Picker -->
          <div style="flex: 1; min-width: 220px;">
            <label style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500; display: block; margin-bottom: 4px;">
              Período
            </label>
            <input type="text" id="${modalId}-date-range" readonly placeholder="Selecione o período..." style="
              padding: 8px 12px; border: 1px solid ${colors.border}; border-radius: 6px;
              font-size: 14px; color: ${colors.text}; background: ${colors.surface};
              width: 100%; cursor: pointer; box-sizing: border-box;
            "/>
          </div>
          <!-- Query Button -->
          <button id="${modalId}-query" style="
            background: #3e1a7d; color: white; border: none;
            padding: 8px 16px; border-radius: 6px; cursor: pointer;
            font-size: 14px; font-weight: 500; height: 38px;
            display: flex; align-items: center; gap: 8px;
            font-family: 'Roboto', Arial, sans-serif;
          " ${state.isLoading ? 'disabled' : ''}>
            ${state.isLoading ? '<span style="animation: spin 1s linear infinite; display: inline-block;">↻</span> Carregando...' : 'Carregar'}
          </button>
        </div>

        <!-- Legend -->
        <div style="
          display: flex; flex-wrap: wrap; gap: 10px;
          margin-bottom: 20px;
        ">
          ${legendHTML}
        </div>

        <!-- Chart Container -->
        <div style="margin-bottom: 24px;">
          <div id="${modalId}-chart" style="
            height: 380px;
            background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#fafafa'};
            border-radius: 14px; display: flex; justify-content: center; align-items: center;
            border: 1px solid ${colors.border}; position: relative;
          ">
            ${state.isLoading
              ? `<div style="text-align: center; color: ${colors.textMuted};">
                   <div style="animation: spin 1s linear infinite; font-size: 36px; margin-bottom: 12px;">↻</div>
                   <div style="font-size: 15px;">Carregando dados de ${state.devices.length} sensores...</div>
                 </div>`
              : state.deviceData.every(dd => dd.data.length === 0)
                ? `<div style="text-align: center; color: ${colors.textMuted};">
                     <div style="font-size: 48px; margin-bottom: 12px;">📭</div>
                     <div style="font-size: 16px;">Sem dados para o período selecionado</div>
                   </div>`
                : `<canvas id="${modalId}-canvas" style="width: 100%; height: 100%;"></canvas>`
            }
          </div>
        </div>

        <!-- Stats Cards -->
        <div style="
          display: flex; flex-wrap: wrap; gap: 12px;
          margin-bottom: 24px;
        ">
          ${statsHTML}
        </div>

        <!-- Actions -->
        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <button id="${modalId}-export" style="
            background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f7f7f7'};
            color: ${colors.text}; border: 1px solid ${colors.border};
            padding: 8px 16px; border-radius: 6px; cursor: pointer;
            font-size: 14px; display: flex; align-items: center; gap: 8px;
            font-family: 'Roboto', Arial, sans-serif;
          " ${state.deviceData.every(dd => dd.data.length === 0) ? 'disabled' : ''}>
            📥 Exportar CSV
          </button>
          <button id="${modalId}-close-btn" style="
            background: #3e1a7d; color: white; border: none;
            padding: 8px 16px; border-radius: 6px; cursor: pointer;
            font-size: 14px; font-weight: 500;
            font-family: 'Roboto', Arial, sans-serif;
          ">
            Fechar
          </button>
        </div>
        </div><!-- End Body -->
      </div>
    </div>
    <style>
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      #${modalId} select:focus, #${modalId} input:focus {
        outline: 2px solid #3e1a7d;
        outline-offset: 2px;
      }
      #${modalId} button:hover:not(:disabled) {
        opacity: 0.9;
      }
      #${modalId} button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      #${modalId} .myio-temp-comparison-content > div:first-child button:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
      }
    </style>
  `;
}

// ============================================================================
// Chart Drawing
// ============================================================================

interface ComparisonChartPoint {
  x: number;       // timestamp
  y: number;       // temperature value
  screenX: number; // screen X coordinate
  screenY: number; // screen Y coordinate
  deviceLabel: string;
  deviceColor: string;
}

function drawComparisonChart(modalId: string, state: ModalState): void {
  const chartContainer = document.getElementById(`${modalId}-chart`);
  const canvas = document.getElementById(`${modalId}-canvas`) as HTMLCanvasElement;
  if (!chartContainer || !canvas) return;

  // Check if we have any data
  const hasData = state.deviceData.some(dd => dd.data.length > 0);
  if (!hasData) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const colors = getThemeColors(state.theme);

  // Canvas dimensions
  const width = chartContainer.clientWidth - 2;
  const height = 380;
  canvas.width = width;
  canvas.height = height;

  const paddingLeft = 65;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 55;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Process data for each device (with period filtering)
  const processedData: { device: DeviceData; points: ComparisonChartPoint[] }[] = [];

  state.deviceData.forEach(dd => {
    if (dd.data.length === 0) return;

    // Filter data by selected day periods
    const filteredData = filterByDayPeriods(dd.data, state.selectedPeriods);
    if (filteredData.length === 0) return;

    let points: ComparisonChartPoint[];

    if (state.granularity === 'hour') {
      const interpolated = interpolateTemperature(filteredData, {
        intervalMinutes: 30,
        startTs: state.startTs,
        endTs: state.endTs,
        clampRange: state.clampRange
      });
      // Filter interpolated data by periods again
      const filteredInterpolated = filterByDayPeriods(interpolated, state.selectedPeriods);
      points = filteredInterpolated.map(item => ({
        x: item.ts,
        y: Number(item.value),
        screenX: 0,
        screenY: 0,
        deviceLabel: dd.device.label,
        deviceColor: dd.color
      }));
    } else {
      const daily = aggregateByDay(filteredData, state.clampRange);
      points = daily.map(item => ({
        x: item.dateTs,
        y: item.avg,
        screenX: 0,
        screenY: 0,
        deviceLabel: dd.device.label,
        deviceColor: dd.color
      }));
    }

    if (points.length > 0) {
      processedData.push({ device: dd, points });
    }
  });

  // Show message if no data after filtering
  if (processedData.length === 0) {
    ctx.fillStyle = colors.textMuted;
    ctx.font = '14px Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhum dado para os períodos selecionados', width / 2, height / 2);
    return;
  }

  // Check if periods are filtered (not all selected)
  const isPeriodsFiltered = state.selectedPeriods.length < 4 && state.selectedPeriods.length > 0;

  // Calculate global min/max for Y axis
  let globalMinY = Infinity;
  let globalMaxY = -Infinity;

  processedData.forEach(({ points }) => {
    points.forEach(point => {
      if (point.y < globalMinY) globalMinY = point.y;
      if (point.y > globalMaxY) globalMaxY = point.y;
    });
  });

  // Add padding to Y range
  globalMinY = Math.floor(globalMinY) - 1;
  globalMaxY = Math.ceil(globalMaxY) + 1;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const scaleY = chartHeight / (globalMaxY - globalMinY || 1);

  // Calculate screen coordinates for all points
  // Use index-based positioning when periods are filtered to avoid gaps
  if (isPeriodsFiltered) {
    // Find the maximum number of points across all devices
    const maxPoints = Math.max(...processedData.map(({ points }) => points.length));
    const pointSpacing = chartWidth / Math.max(1, maxPoints - 1);

    processedData.forEach(({ points }) => {
      points.forEach((point, index) => {
        point.screenX = paddingLeft + index * pointSpacing;
        point.screenY = height - paddingBottom - (point.y - globalMinY) * scaleY;
      });
    });
  } else {
    // Time-based positioning (original behavior)
    let globalMinX = Infinity;
    let globalMaxX = -Infinity;

    processedData.forEach(({ points }) => {
      points.forEach(point => {
        if (point.x < globalMinX) globalMinX = point.x;
        if (point.x > globalMaxX) globalMaxX = point.x;
      });
    });

    const timeRange = globalMaxX - globalMinX || 1;
    const scaleX = chartWidth / timeRange;

    processedData.forEach(({ points }) => {
      points.forEach(point => {
        point.screenX = paddingLeft + (point.x - globalMinX) * scaleX;
        point.screenY = height - paddingBottom - (point.y - globalMinY) * scaleY;
      });
    });
  }

  // Draw horizontal grid lines
  ctx.strokeStyle = colors.chartGrid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = paddingTop + chartHeight * i / 5;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
  }

  // Draw temperature lines for each device
  processedData.forEach(({ device, points }) => {
    ctx.strokeStyle = device.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    points.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.screenX, point.screenY);
      else ctx.lineTo(point.screenX, point.screenY);
    });

    ctx.stroke();

    // Draw data points
    ctx.fillStyle = device.color;
    points.forEach(point => {
      ctx.beginPath();
      ctx.arc(point.screenX, point.screenY, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // Draw Y axis labels
  ctx.fillStyle = colors.textMuted;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const val = globalMinY + (globalMaxY - globalMinY) * (5 - i) / 5;
    const y = paddingTop + chartHeight * i / 5;
    ctx.fillText(val.toFixed(1) + '°C', paddingLeft - 10, y + 4);
  }

  // Draw X axis labels with time for hour granularity
  ctx.textAlign = 'center';
  const xAxisPoints = processedData[0]?.points || [];
  const numLabels = Math.min(8, xAxisPoints.length);
  const labelInterval = Math.max(1, Math.floor(xAxisPoints.length / numLabels));

  for (let i = 0; i < xAxisPoints.length; i += labelInterval) {
    const point = xAxisPoints[i];
    const date = new Date(point.x);

    // Format label based on granularity
    let label: string;
    if (state.granularity === 'hour') {
      // Show time HH:mm for hour granularity
      label = date.toLocaleTimeString(state.locale, { hour: '2-digit', minute: '2-digit' });
    } else {
      // Show date DD/MM for day granularity
      label = date.toLocaleDateString(state.locale, { day: '2-digit', month: '2-digit' });
    }

    // Draw vertical grid line
    ctx.strokeStyle = colors.chartGrid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(point.screenX, paddingTop);
    ctx.lineTo(point.screenX, height - paddingBottom);
    ctx.stroke();

    // Draw label
    ctx.fillStyle = colors.textMuted;
    ctx.fillText(label, point.screenX, height - paddingBottom + 18);
  }

  // Draw axis lines
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();

  // Flatten all points for tooltip
  const allChartPoints = processedData.flatMap(pd => pd.points);

  // Setup tooltip
  setupComparisonChartTooltip(canvas, chartContainer, allChartPoints, state, colors);
}

// ============================================================================
// Tooltip
// ============================================================================

function setupComparisonChartTooltip(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  chartData: ComparisonChartPoint[],
  state: ModalState,
  colors: ThemeColors
): void {
  // Remove existing tooltip
  const existingTooltip = container.querySelector('.myio-chart-tooltip');
  if (existingTooltip) existingTooltip.remove();

  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'myio-chart-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    background: ${state.theme === 'dark' ? 'rgba(30, 30, 40, 0.95)' : 'rgba(255, 255, 255, 0.98)'};
    border: 1px solid ${colors.border};
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: ${colors.text};
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    min-width: 160px;
  `;
  container.appendChild(tooltip);

  // Find nearest point to mouse
  const findNearestPoint = (mouseX: number, mouseY: number): ComparisonChartPoint | null => {
    const threshold = 20; // pixels
    let nearest: ComparisonChartPoint | null = null;
    let minDist = Infinity;

    for (const point of chartData) {
      const dist = Math.sqrt(
        Math.pow(mouseX - point.screenX, 2) + Math.pow(mouseY - point.screenY, 2)
      );
      if (dist < minDist && dist < threshold) {
        minDist = dist;
        nearest = point;
      }
    }
    return nearest;
  };

  // Mouse move handler
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const point = findNearestPoint(mouseX, mouseY);

    if (point) {
      const date = new Date(point.x);

      // Format date/time based on granularity
      let dateStr: string;
      if (state.granularity === 'hour') {
        dateStr = date.toLocaleDateString(state.locale, {
          day: '2-digit', month: '2-digit', year: 'numeric'
        }) + ' ' + date.toLocaleTimeString(state.locale, {
          hour: '2-digit', minute: '2-digit'
        });
      } else {
        dateStr = date.toLocaleDateString(state.locale, {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
      }

      tooltip.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${point.deviceColor};"></span>
          <span style="font-weight: 600;">${point.deviceLabel}</span>
        </div>
        <div style="font-weight: 600; font-size: 16px; color: ${point.deviceColor}; margin-bottom: 4px;">
          ${formatTemperature(point.y)}
        </div>
        <div style="font-size: 11px; color: ${colors.textMuted};">
          📅 ${dateStr}
        </div>
      `;

      // Position tooltip
      let tooltipX = point.screenX + 15;
      let tooltipY = point.screenY - 15;

      // Keep tooltip in bounds
      const tooltipRect = tooltip.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (tooltipX + tooltipRect.width > containerRect.width - 10) {
        tooltipX = point.screenX - tooltipRect.width - 15;
      }
      if (tooltipY < 10) {
        tooltipY = point.screenY + 15;
      }

      tooltip.style.left = `${tooltipX}px`;
      tooltip.style.top = `${tooltipY}px`;
      tooltip.style.opacity = '1';

      // Highlight point
      canvas.style.cursor = 'pointer';
    } else {
      tooltip.style.opacity = '0';
      canvas.style.cursor = 'default';
    }
  });

  // Mouse leave handler
  canvas.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
    canvas.style.cursor = 'default';
  });
}

// ============================================================================
// Event Listeners
// ============================================================================

async function setupEventListeners(
  container: HTMLElement,
  state: ModalState,
  modalId: string,
  onClose?: () => void
): Promise<void> {
  // Close modal handlers
  const closeModal = () => {
    container.remove();
    onClose?.();
  };

  container.querySelector('.myio-temp-comparison-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById(`${modalId}-close`)?.addEventListener('click', closeModal);
  document.getElementById(`${modalId}-close-btn`)?.addEventListener('click', closeModal);

  // Initialize DateRangePicker
  const dateRangeInput = document.getElementById(`${modalId}-date-range`) as HTMLInputElement;
  if (dateRangeInput && !state.dateRangePicker) {
    try {
      state.dateRangePicker = await createDateRangePicker(dateRangeInput, {
        presetStart: new Date(state.startTs).toISOString(),
        presetEnd: new Date(state.endTs).toISOString(),
        includeTime: true,
        timePrecision: 'minute',
        maxRangeDays: 90,
        locale: state.locale as 'pt-BR' | 'en-US',
        parentEl: container.querySelector('.myio-temp-comparison-content') as HTMLElement,
        onApply: (result) => {
          state.startTs = new Date(result.startISO).getTime();
          state.endTs = new Date(result.endISO).getTime();
          console.log('[TemperatureComparisonModal] Date range applied:', result);
        }
      });
    } catch (error) {
      console.warn('[TemperatureComparisonModal] DateRangePicker initialization failed:', error);
    }
  }

  // Theme toggle
  document.getElementById(`${modalId}-theme-toggle`)?.addEventListener('click', async () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('myio-temp-comparison-theme', state.theme);
    state.dateRangePicker = null; // Reset picker for re-init
    renderModal(container, state, modalId);
    if (state.deviceData.some(dd => dd.data.length > 0)) {
      drawComparisonChart(modalId, state);
    }
    await setupEventListeners(container, state, modalId, onClose);
  });

  // Maximize toggle
  document.getElementById(`${modalId}-maximize`)?.addEventListener('click', async () => {
    (container as any).__isMaximized = !(container as any).__isMaximized;
    state.dateRangePicker = null; // Reset picker for re-init
    renderModal(container, state, modalId);
    if (state.deviceData.some(dd => dd.data.length > 0)) {
      drawComparisonChart(modalId, state);
    }
    await setupEventListeners(container, state, modalId, onClose);
  });

  // Period filter dropdown toggle
  const periodBtn = document.getElementById(`${modalId}-period-btn`);
  const periodDropdown = document.getElementById(`${modalId}-period-dropdown`);

  periodBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (periodDropdown) {
      periodDropdown.style.display = periodDropdown.style.display === 'none' ? 'block' : 'none';
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (periodDropdown && !periodDropdown.contains(e.target as Node) && e.target !== periodBtn) {
      periodDropdown.style.display = 'none';
    }
  });

  // Period checkbox changes
  const periodCheckboxes = document.querySelectorAll(`input[name="${modalId}-period"]`);
  periodCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const checked = Array.from(periodCheckboxes)
        .filter((cb: Element) => (cb as HTMLInputElement).checked)
        .map((cb: Element) => (cb as HTMLInputElement).value as DayPeriod);
      state.selectedPeriods = checked;
      // Update button label
      const btnLabel = periodBtn?.querySelector('span:first-child');
      if (btnLabel) {
        btnLabel.textContent = getSelectedPeriodsLabel(state.selectedPeriods);
      }
      // Redraw chart with filtered data
      if (state.deviceData.some(dd => dd.data.length > 0)) {
        drawComparisonChart(modalId, state);
      }
    });
  });

  // Select All button
  document.getElementById(`${modalId}-period-select-all`)?.addEventListener('click', () => {
    periodCheckboxes.forEach((cb: Element) => {
      (cb as HTMLInputElement).checked = true;
    });
    state.selectedPeriods = ['madrugada', 'manha', 'tarde', 'noite'];
    const btnLabel = periodBtn?.querySelector('span:first-child');
    if (btnLabel) {
      btnLabel.textContent = getSelectedPeriodsLabel(state.selectedPeriods);
    }
    if (state.deviceData.some(dd => dd.data.length > 0)) {
      drawComparisonChart(modalId, state);
    }
  });

  // Clear Selection button
  document.getElementById(`${modalId}-period-clear`)?.addEventListener('click', () => {
    periodCheckboxes.forEach((cb: Element) => {
      (cb as HTMLInputElement).checked = false;
    });
    state.selectedPeriods = [];
    const btnLabel = periodBtn?.querySelector('span:first-child');
    if (btnLabel) {
      btnLabel.textContent = getSelectedPeriodsLabel(state.selectedPeriods);
    }
    if (state.deviceData.some(dd => dd.data.length > 0)) {
      drawComparisonChart(modalId, state);
    }
  });

  // Granularity change
  document.getElementById(`${modalId}-granularity`)?.addEventListener('change', (e) => {
    state.granularity = (e.target as HTMLSelectElement).value as TemperatureGranularity;
    localStorage.setItem('myio-temp-comparison-granularity', state.granularity);
    if (state.deviceData.some(dd => dd.data.length > 0)) {
      drawComparisonChart(modalId, state);
    }
  });

  // Query button - fetch data with current date range
  document.getElementById(`${modalId}-query`)?.addEventListener('click', async () => {
    // Validate date range
    if (state.startTs >= state.endTs) {
      alert('Por favor, selecione um período válido');
      return;
    }

    state.isLoading = true;
    state.dateRangePicker = null; // Reset picker for re-init
    renderModal(container, state, modalId);

    await fetchAllDevicesData(state);
    renderModal(container, state, modalId);
    drawComparisonChart(modalId, state);
    await setupEventListeners(container, state, modalId, onClose);
  });

  // Export CSV
  document.getElementById(`${modalId}-export`)?.addEventListener('click', () => {
    if (state.deviceData.every(dd => dd.data.length === 0)) return;

    exportComparisonCSV(state);
  });
}

// ============================================================================
// CSV Export
// ============================================================================

function exportComparisonCSV(state: ModalState): void {
  const startDateStr = new Date(state.startTs).toLocaleDateString(state.locale).replace(/\//g, '-');
  const endDateStr = new Date(state.endTs).toLocaleDateString(state.locale).replace(/\//g, '-');

  // Build CSV content with BOM for Excel compatibility
  const BOM = '\uFEFF';
  let csvContent = BOM;

  // Header with summary
  csvContent += `Comparação de Temperatura\n`;
  csvContent += `Período: ${startDateStr} até ${endDateStr}\n`;
  csvContent += `Sensores: ${state.devices.map(d => d.label).join(', ')}\n`;
  csvContent += '\n';

  // Stats per device
  csvContent += 'Estatísticas por Sensor:\n';
  csvContent += 'Sensor,Média (°C),Min (°C),Max (°C),Leituras\n';
  state.deviceData.forEach(dd => {
    csvContent += `"${dd.device.label}",${dd.stats.avg.toFixed(2)},${dd.stats.min.toFixed(2)},${dd.stats.max.toFixed(2)},${dd.stats.count}\n`;
  });
  csvContent += '\n';

  // Data header
  csvContent += 'Dados Detalhados:\n';
  csvContent += 'Data/Hora,Sensor,Temperatura (°C)\n';

  // Data rows
  state.deviceData.forEach(dd => {
    dd.data.forEach(item => {
      const date = new Date(item.ts).toLocaleString(state.locale);
      const temp = Number(item.value).toFixed(2);
      csvContent += `"${date}","${dd.device.label}",${temp}\n`;
    });
  });

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comparacao_temperatura_${startDateStr}_${endDateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
