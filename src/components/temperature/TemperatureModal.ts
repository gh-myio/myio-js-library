/**
 * Temperature Modal Component
 * RFC-0085: Single device temperature visualization
 *
 * Displays temperature telemetry data with statistics and timeline chart.
 * Fetches data from ThingsBoard API.
 */

import {
  fetchTemperatureData,
  clampTemperature,
  calculateStats,
  interpolateTemperature,
  aggregateByDay,
  formatTemperature,
  formatDateLabel,
  exportTemperatureCSV,
  getThemeColors,
  getTodaySoFar,
  filterByDayPeriods,
  getSelectedPeriodsLabel,
  DEFAULT_CLAMP_RANGE,
  DAY_PERIODS,
  type TemperatureTelemetry,
  type TemperatureStats,
  type DailyTemperatureStats,
  type ClampRange,
  type TemperatureGranularity,
  type ThemeColors,
  type DayPeriod
} from './utils';

import { createDateRangePicker, type DateRangeControl } from '../createDateRangePicker';
import { CSS_TOKENS, DATERANGEPICKER_STYLES } from '../premium-modals/internal/styles/tokens';

// ============================================================================
// Types
// ============================================================================

export interface TemperatureModalParams {
  /** JWT token for ThingsBoard API */
  token: string;
  /** ThingsBoard device UUID */
  deviceId: string;
  /** Start date in ISO format */
  startDate: string;
  /** End date in ISO format */
  endDate: string;
  /** Device label for display */
  label?: string;
  /** Current temperature value */
  currentTemperature?: number;
  /** Minimum threshold for visual range */
  temperatureMin?: number;
  /** Maximum threshold for visual range */
  temperatureMax?: number;
  /** Temperature status indicator */
  temperatureStatus?: 'ok' | 'above' | 'below';
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

export interface TemperatureModalInstance {
  /** Destroys the modal */
  destroy: () => void;
  /** Updates data with new date range */
  updateData: (startDate: string, endDate: string, granularity?: TemperatureGranularity) => Promise<void>;
}

// ============================================================================
// Modal State
// ============================================================================

interface ModalState {
  token: string;
  deviceId: string;
  label: string;
  currentTemperature: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  temperatureStatus: 'ok' | 'above' | 'below' | null;
  startTs: number;
  endTs: number;
  granularity: TemperatureGranularity;
  theme: 'dark' | 'light';
  clampRange: ClampRange;
  locale: string;
  data: TemperatureTelemetry[];
  stats: TemperatureStats;
  isLoading: boolean;
  dateRangePicker: DateRangeControl | null;
  selectedPeriods: DayPeriod[];
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Opens a temperature modal for a single device
 */
export async function openTemperatureModal(
  params: TemperatureModalParams
): Promise<TemperatureModalInstance> {
  const modalId = `myio-temp-modal-${Date.now()}`;

  // Default to "Today So Far" if dates not provided
  const defaultDateRange = getTodaySoFar();
  const startTs = params.startDate ? new Date(params.startDate).getTime() : defaultDateRange.startTs;
  const endTs = params.endDate ? new Date(params.endDate).getTime() : defaultDateRange.endTs;

  // Initialize state
  const state: ModalState = {
    token: params.token,
    deviceId: params.deviceId,
    label: params.label || 'Sensor de Temperatura',
    currentTemperature: params.currentTemperature ?? null,
    temperatureMin: params.temperatureMin ?? null,
    temperatureMax: params.temperatureMax ?? null,
    temperatureStatus: params.temperatureStatus ?? null,
    startTs,
    endTs,
    granularity: params.granularity || 'hour',
    theme: params.theme || 'light',
    clampRange: params.clampRange || DEFAULT_CLAMP_RANGE,
    locale: params.locale || 'pt-BR',
    data: [],
    stats: { avg: 0, min: 0, max: 0, count: 0 },
    isLoading: true,
    dateRangePicker: null,
    selectedPeriods: ['madrugada', 'manha', 'tarde', 'noite'] // All periods selected by default
  };

  // Load saved preferences
  const savedGranularity = localStorage.getItem('myio-temp-modal-granularity') as TemperatureGranularity;
  const savedTheme = localStorage.getItem('myio-temp-modal-theme') as 'dark' | 'light';
  if (savedGranularity) state.granularity = savedGranularity;
  if (savedTheme) state.theme = savedTheme;

  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.id = modalId;
  document.body.appendChild(modalContainer);

  // Render modal
  renderModal(modalContainer, state, modalId);

  // Fetch initial data
  try {
    state.data = await fetchTemperatureData(state.token, state.deviceId, state.startTs, state.endTs);
    state.stats = calculateStats(state.data, state.clampRange);
    state.isLoading = false;
    renderModal(modalContainer, state, modalId);
    drawChart(modalId, state);
  } catch (error) {
    console.error('[TemperatureModal] Error fetching data:', error);
    state.isLoading = false;
    renderModal(modalContainer, state, modalId, error as Error);
  }

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

      try {
        state.data = await fetchTemperatureData(state.token, state.deviceId, state.startTs, state.endTs);
        state.stats = calculateStats(state.data, state.clampRange);
        state.isLoading = false;
        renderModal(modalContainer, state, modalId);
        drawChart(modalId, state);
      } catch (error) {
        console.error('[TemperatureModal] Error updating data:', error);
        state.isLoading = false;
        renderModal(modalContainer, state, modalId, error as Error);
      }
    }
  };
}

// ============================================================================
// Rendering
// ============================================================================

function renderModal(
  container: HTMLElement,
  state: ModalState,
  modalId: string,
  error?: Error
): void {
  const colors = getThemeColors(state.theme);
  const startDateStr = new Date(state.startTs).toLocaleDateString(state.locale);
  const endDateStr = new Date(state.endTs).toLocaleDateString(state.locale);

  // Format status
  const statusText = state.temperatureStatus === 'ok' ? 'Dentro da faixa' :
    state.temperatureStatus === 'above' ? 'Acima do limite' :
    state.temperatureStatus === 'below' ? 'Abaixo do limite' : 'N/A';
  const statusColor = state.temperatureStatus === 'ok' ? colors.success :
    state.temperatureStatus === 'above' ? colors.danger :
    state.temperatureStatus === 'below' ? colors.primary : colors.textMuted;

  // Format range text
  const rangeText = (state.temperatureMin !== null && state.temperatureMax !== null)
    ? `${state.temperatureMin}°C - ${state.temperatureMax}°C`
    : 'Não definida';

  // Format date inputs
  const startDateInput = new Date(state.startTs).toISOString().slice(0, 16);
  const endDateInput = new Date(state.endTs).toISOString().slice(0, 16);

  // Track maximized state
  const isMaximized = (container as any).__isMaximized || false;
  const contentMaxWidth = isMaximized ? '100%' : '900px';
  const contentMaxHeight = isMaximized ? '100vh' : '95vh';
  const contentBorderRadius = isMaximized ? '0' : '10px';

  container.innerHTML = `
    <div class="myio-temp-modal-overlay myio-modal-scope" style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); z-index: 9998;
      display: flex; justify-content: center; align-items: center;
      backdrop-filter: blur(2px);
    ">
      <div class="myio-temp-modal-content" style="
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
            🌡️ ${state.label} - Histórico de Temperatura
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
          margin-bottom: 16px; padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f7f7f7'};
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

        <!-- Stats Cards -->
        <div style="
          display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px; margin-bottom: 16px;
        ">
          <!-- Current Temperature -->
          <div style="
            padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
            border-radius: 12px; border: 1px solid ${colors.border};
          ">
            <span style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500;">Temperatura Atual</span>
            <div style="font-weight: 700; font-size: 24px; color: ${statusColor}; margin-top: 4px;">
              ${state.currentTemperature !== null ? formatTemperature(state.currentTemperature) : 'N/A'}
            </div>
            <div style="font-size: 11px; color: ${statusColor}; margin-top: 2px;">${statusText}</div>
          </div>
          <!-- Average -->
          <div style="
            padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
            border-radius: 12px; border: 1px solid ${colors.border};
          ">
            <span style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500;">Média do Período</span>
            <div id="${modalId}-avg" style="font-weight: 600; font-size: 20px; color: ${colors.text}; margin-top: 4px;">
              ${state.stats.count > 0 ? formatTemperature(state.stats.avg) : 'N/A'}
            </div>
            <div style="font-size: 11px; color: ${colors.textMuted}; margin-top: 2px;">${startDateStr} - ${endDateStr}</div>
          </div>
          <!-- Min/Max -->
          <div style="
            padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
            border-radius: 12px; border: 1px solid ${colors.border};
          ">
            <span style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500;">Min / Max</span>
            <div id="${modalId}-minmax" style="font-weight: 600; font-size: 20px; color: ${colors.text}; margin-top: 4px;">
              ${state.stats.count > 0 ? `${formatTemperature(state.stats.min)} / ${formatTemperature(state.stats.max)}` : 'N/A'}
            </div>
            <div style="font-size: 11px; color: ${colors.textMuted}; margin-top: 2px;">${state.stats.count} leituras</div>
          </div>
          <!-- Ideal Range -->
          <div style="
            padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
            border-radius: 12px; border: 1px solid ${colors.border};
          ">
            <span style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500;">Faixa Ideal</span>
            <div style="font-weight: 600; font-size: 20px; color: ${colors.success}; margin-top: 4px;">
              ${rangeText}
            </div>
          </div>
        </div>

        <!-- Chart Container -->
        <div style="margin-bottom: 20px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; color: ${colors.textMuted}; font-weight: 500;">
            Histórico de Temperatura
          </h3>
          <div id="${modalId}-chart" style="
            height: 320px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#fafafa'};
            border-radius: 12px; display: flex; justify-content: center; align-items: center;
            border: 1px solid ${colors.border}; position: relative;
          ">
            ${state.isLoading
              ? `<div style="text-align: center; color: ${colors.textMuted};">
                   <div style="animation: spin 1s linear infinite; font-size: 32px; margin-bottom: 8px;">↻</div>
                   <div>Carregando dados...</div>
                 </div>`
              : error
                ? `<div style="text-align: center; color: ${colors.danger};">
                     <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
                     <div>Erro ao carregar dados</div>
                     <div style="font-size: 12px; margin-top: 4px;">${error.message}</div>
                   </div>`
                : state.data.length === 0
                  ? `<div style="text-align: center; color: ${colors.textMuted};">
                       <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
                       <div>Sem dados para o período selecionado</div>
                     </div>`
                  : `<canvas id="${modalId}-canvas" style="width: 100%; height: 100%;"></canvas>`
            }
          </div>
        </div>

        <!-- Actions -->
        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <button id="${modalId}-export" style="
            background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f7f7f7'};
            color: ${colors.text}; border: 1px solid ${colors.border};
            padding: 8px 16px; border-radius: 6px; cursor: pointer;
            font-size: 14px; display: flex; align-items: center; gap: 8px;
            font-family: 'Roboto', Arial, sans-serif;
          " ${state.data.length === 0 ? 'disabled' : ''}>
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
      #${modalId} .myio-temp-modal-content > div:first-child button:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
      }

      /* DateRangePicker styles */
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
    </style>
  `;
}

// ============================================================================
// Chart Drawing
// ============================================================================

interface ChartPoint {
  x: number;      // timestamp
  y: number;      // temperature value
  screenX: number; // screen X coordinate
  screenY: number; // screen Y coordinate
  label?: string;
}

function drawChart(modalId: string, state: ModalState): void {
  const chartContainer = document.getElementById(`${modalId}-chart`);
  const canvas = document.getElementById(`${modalId}-canvas`) as HTMLCanvasElement;
  if (!chartContainer || !canvas || state.data.length === 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const colors = getThemeColors(state.theme);

  // Filter data by selected day periods
  const filteredData = filterByDayPeriods(state.data, state.selectedPeriods);

  if (filteredData.length === 0) {
    // No data after filtering, show message
    canvas.width = chartContainer.clientWidth;
    canvas.height = chartContainer.clientHeight;
    ctx.fillStyle = colors.textMuted;
    ctx.font = '14px Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhum dado para os períodos selecionados', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Process data based on granularity
  let chartData: ChartPoint[];

  if (state.granularity === 'hour') {
    // Interpolate to 30-minute intervals
    const interpolated = interpolateTemperature(filteredData, {
      intervalMinutes: 30,
      startTs: state.startTs,
      endTs: state.endTs,
      clampRange: state.clampRange
    });
    // Filter interpolated data by periods again (since interpolation may add points)
    const filteredInterpolated = filterByDayPeriods(interpolated, state.selectedPeriods);
    chartData = filteredInterpolated.map(item => ({
      x: item.ts,
      y: Number(item.value),
      screenX: 0,
      screenY: 0
    }));
  } else {
    // Aggregate by day
    const daily = aggregateByDay(filteredData, state.clampRange);
    chartData = daily.map(item => ({
      x: item.dateTs,
      y: item.avg,
      screenX: 0,
      screenY: 0,
      label: item.date
    }));
  }

  if (chartData.length === 0) return;

  // Canvas dimensions
  const width = chartContainer.clientWidth - 2;
  const height = 320;
  canvas.width = width;
  canvas.height = height;

  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 55;

  // Check if periods are filtered (not all selected)
  const isPeriodsFiltered = state.selectedPeriods.length < 4 && state.selectedPeriods.length > 0;

  // Calculate scales
  // Y-axis must always include the ideal range thresholds (temperatureMin/temperatureMax)
  // This ensures the visual range always shows the configured thresholds
  const values = chartData.map(d => d.y);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);

  // Include ideal range thresholds if defined
  const thresholdMin = state.temperatureMin !== null ? state.temperatureMin : dataMin;
  const thresholdMax = state.temperatureMax !== null ? state.temperatureMax : dataMax;

  // Final Y range: minimum of (data, threshold) - 1 and maximum of (data, threshold) + 1
  const minY = Math.min(dataMin, thresholdMin) - 1;
  const maxY = Math.max(dataMax, thresholdMax) + 1;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const scaleY = chartHeight / (maxY - minY || 1);

  // Calculate screen coordinates for each point
  // Use index-based positioning when periods are filtered to avoid gaps
  if (isPeriodsFiltered) {
    // Sequential positioning by index (no gaps)
    const pointSpacing = chartWidth / Math.max(1, chartData.length - 1);
    chartData.forEach((point, index) => {
      point.screenX = paddingLeft + index * pointSpacing;
      point.screenY = height - paddingBottom - (point.y - minY) * scaleY;
    });
  } else {
    // Time-based positioning (original behavior)
    const minX = chartData[0].x;
    const maxX = chartData[chartData.length - 1].x;
    const timeRange = maxX - minX || 1;
    const scaleX = chartWidth / timeRange;
    chartData.forEach(point => {
      point.screenX = paddingLeft + (point.x - minX) * scaleX;
      point.screenY = height - paddingBottom - (point.y - minY) * scaleY;
    });
  }

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw horizontal grid lines
  ctx.strokeStyle = colors.chartGrid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + chartHeight * i / 4;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
  }

  // Draw min/max range if defined
  if (state.temperatureMin !== null && state.temperatureMax !== null) {
    const rangeMinY = height - paddingBottom - (state.temperatureMin - minY) * scaleY;
    const rangeMaxY = height - paddingBottom - (state.temperatureMax - minY) * scaleY;
    ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
    ctx.fillRect(paddingLeft, rangeMaxY, chartWidth, rangeMinY - rangeMaxY);
    ctx.strokeStyle = colors.success;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, rangeMinY);
    ctx.lineTo(width - paddingRight, rangeMinY);
    ctx.moveTo(paddingLeft, rangeMaxY);
    ctx.lineTo(width - paddingRight, rangeMaxY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw temperature line
  ctx.strokeStyle = colors.chartLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  chartData.forEach((point, i) => {
    if (i === 0) ctx.moveTo(point.screenX, point.screenY);
    else ctx.lineTo(point.screenX, point.screenY);
  });
  ctx.stroke();

  // Draw data points
  ctx.fillStyle = colors.chartLine;
  chartData.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.screenX, point.screenY, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw Y axis labels
  ctx.fillStyle = colors.textMuted;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = minY + (maxY - minY) * (4 - i) / 4;
    const y = paddingTop + chartHeight * i / 4;
    ctx.fillText(val.toFixed(1) + '°C', paddingLeft - 8, y + 4);
  }

  // Draw X axis labels with time for hour granularity
  ctx.textAlign = 'center';
  const numLabels = Math.min(8, chartData.length);
  const labelInterval = Math.max(1, Math.floor(chartData.length / numLabels));

  for (let i = 0; i < chartData.length; i += labelInterval) {
    const point = chartData[i];
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

  // Setup tooltip
  setupChartTooltip(canvas, chartContainer, chartData, state, colors);
}

// ============================================================================
// Tooltip
// ============================================================================

function setupChartTooltip(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  chartData: ChartPoint[],
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
    min-width: 140px;
  `;
  container.appendChild(tooltip);

  // Find nearest point to mouse
  const findNearestPoint = (mouseX: number, mouseY: number): ChartPoint | null => {
    const threshold = 20; // pixels
    let nearest: ChartPoint | null = null;
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
        <div style="font-weight: 600; margin-bottom: 6px; color: ${colors.primary};">
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

  container.querySelector('.myio-temp-modal-overlay')?.addEventListener('click', (e) => {
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
        parentEl: container.querySelector('.myio-temp-modal-content') as HTMLElement,
        onApply: (result) => {
          state.startTs = new Date(result.startISO).getTime();
          state.endTs = new Date(result.endISO).getTime();
          console.log('[TemperatureModal] Date range applied:', result);
        }
      });
    } catch (error) {
      console.warn('[TemperatureModal] DateRangePicker initialization failed:', error);
    }
  }

  // Theme toggle
  document.getElementById(`${modalId}-theme-toggle`)?.addEventListener('click', async () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('myio-temp-modal-theme', state.theme);
    state.dateRangePicker = null; // Reset picker for re-init
    renderModal(container, state, modalId);
    if (state.data.length > 0) drawChart(modalId, state);
    await setupEventListeners(container, state, modalId, onClose);
  });

  // Maximize toggle
  document.getElementById(`${modalId}-maximize`)?.addEventListener('click', async () => {
    (container as any).__isMaximized = !(container as any).__isMaximized;
    state.dateRangePicker = null; // Reset picker for re-init
    renderModal(container, state, modalId);
    if (state.data.length > 0) drawChart(modalId, state);
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
      if (state.data.length > 0) drawChart(modalId, state);
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
    if (state.data.length > 0) drawChart(modalId, state);
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
    if (state.data.length > 0) drawChart(modalId, state);
  });

  // Granularity change
  document.getElementById(`${modalId}-granularity`)?.addEventListener('change', (e) => {
    state.granularity = (e.target as HTMLSelectElement).value as TemperatureGranularity;
    localStorage.setItem('myio-temp-modal-granularity', state.granularity);
    if (state.data.length > 0) drawChart(modalId, state);
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

    try {
      state.data = await fetchTemperatureData(state.token, state.deviceId, state.startTs, state.endTs);
      state.stats = calculateStats(state.data, state.clampRange);
      state.isLoading = false;
      renderModal(container, state, modalId);
      drawChart(modalId, state);
      await setupEventListeners(container, state, modalId, onClose);
    } catch (error) {
      console.error('[TemperatureModal] Error fetching data:', error);
      state.isLoading = false;
      renderModal(container, state, modalId, error as Error);
      await setupEventListeners(container, state, modalId, onClose);
    }
  });

  // Export CSV
  document.getElementById(`${modalId}-export`)?.addEventListener('click', () => {
    if (state.data.length === 0) return;

    const startDateStr = new Date(state.startTs).toLocaleDateString(state.locale).replace(/\//g, '-');
    const endDateStr = new Date(state.endTs).toLocaleDateString(state.locale).replace(/\//g, '-');

    exportTemperatureCSV(
      state.data,
      state.label,
      state.stats,
      startDateStr,
      endDateStr
    );
  });
}
