/**
 * Gateway Comparison Modal Component
 * RFC-0231 (follow-up): Multi-central connectivity/latency comparison
 *
 * Near-1:1 structural port of
 * `src/components/temperature/TemperatureComparisonModal.ts`, per the same
 * "bem bem parecido mesmo" request that drove `GatewayModal.ts`'s rewrite —
 * same section order (Types → Modal State → Main Function → Data Fetching →
 * Rendering → Chart Drawing → Tooltip → Event Listeners → CSV Export), same
 * hand-rolled-inline header (this file, like its reference, does NOT use
 * `ModalHeader.generateInlineHTML` — `TemperatureComparisonModal.ts` builds
 * its header directly in the template string, so this one does too, for
 * fidelity rather than "improving" on the reference).
 *
 * Deliberate deltas from the temperature original (latency has no analog):
 * - no clamp/offset.
 * - "ideal range" (min/max band) becomes a single SLA target line + an
 *   "at risk" band above it, grouped per unique `targetLatencyMs` across the
 *   compared centrals (mirrors the original's per-unique-range grouping,
 *   `rangeMap`/`temperatureRanges`, just single-line instead of two-line).
 * - no quick-period shortcut buttons (the reference doesn't have any either).
 */

import {
  calculateLatencyStats,
  calculateUptimeStats,
  filterByDayPeriods,
  formatLatency,
  formatHours,
  formatGatewayAxisLabel,
  getGatewayThemeColors,
  getSelectedPeriodsLabel,
  interpolateLatency,
  aggregateByDay,
  DAY_PERIODS,
  CHART_COLORS,
  type GatewayLatencyPoint,
  type GatewayLatencyStats,
  type GatewayGranularity,
  type GatewayThemeColors,
  type DayPeriod,
} from './utils';

import { exportGatewayComparisonPdf } from './exportGatewayComparisonPdf';
import { createDateRangePicker, type DateRangeControl } from '../../createDateRangePicker';

// ============================================================================
// Types
// ============================================================================

export interface CentralForComparison {
  /** GCDR/ThingsBoard id used for the fetch. */
  id: string;
  /** Label for legend/stats/CSV. */
  label: string;
  /** Alternative ThingsBoard id, if different from `id` (mirrors TemperatureDevice.tbId). */
  tbId?: string;
  /** Customer/shopping name, for grouping/display. */
  customerName?: string;
  /** SLA/target ceiling for this central's ideal latency range. */
  targetLatencyMs?: number;
}

export interface GatewayComparisonModalSourceConfig {
  baseUrl?: string;
  path?: string;
  fetchOptions?: RequestInit;
  onFetchLatencyHistory?: (params: { id: string; startTs: number; endTs: number }) => Promise<GatewayLatencyPoint[]>;
  maxRangeDays?: number;
}

export interface GatewayComparisonModalParams {
  centrals: CentralForComparison[];
  startDate: string;
  endDate: string;
  source: GatewayComparisonModalSourceConfig;
  container?: HTMLElement | string;
  onClose?: () => void;
  locale?: 'pt-BR' | 'en-US';
  granularity?: GatewayGranularity;
  theme?: 'dark' | 'light';
}

export interface GatewayComparisonModalInstance {
  destroy: () => void;
  updateData: (startDate: string, endDate: string, granularity?: GatewayGranularity) => Promise<void>;
}

interface CentralData {
  central: CentralForComparison;
  data: GatewayLatencyPoint[];
  stats: GatewayLatencyStats;
  color: string;
}

/** Chart rendering mode, switchable via the segmented control next to "Histórico de Latência". */
export type GatewayChartType = 'line' | 'smooth' | 'bar' | 'area' | 'pie';

const CHART_TYPES: { id: GatewayChartType; icon: string; label: string }[] = [
  { id: 'line', icon: '📈', label: 'Linhas' },
  { id: 'smooth', icon: '〰️', label: 'Linhas suaves' },
  { id: 'bar', icon: '📊', label: 'Barras' },
  { id: 'area', icon: '🏔️', label: 'Área' },
  { id: 'pie', icon: '🥧', label: 'Pizza (disponibilidade agregada)' },
];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// Modal State
// ============================================================================

interface ModalState {
  source: GatewayComparisonModalSourceConfig;
  centrals: CentralForComparison[];
  startTs: number;
  endTs: number;
  granularity: GatewayGranularity;
  theme: 'dark' | 'light';
  locale: string;
  centralData: CentralData[];
  isLoading: boolean;
  dateRangePicker: DateRangeControl | null;
  selectedPeriods: DayPeriod[];
  /** `central.id`s toggled off via the eye icon — excluded from the chart and the consolidated KPI. Default: none (all visible). */
  hiddenCentrals: Set<string>;
  /** Whether the right-side KPI panel (consolidated + per-central cards) is expanded. Default: true. */
  kpiSidebarOpen: boolean;
  chartType: GatewayChartType;
}

function escAttr(s: string): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

function fetchOne(source: GatewayComparisonModalSourceConfig, id: string, startTs: number, endTs: number): Promise<GatewayLatencyPoint[]> {
  if (source.onFetchLatencyHistory) return source.onFetchLatencyHistory({ id, startTs, endTs });
  if (!source.baseUrl) {
    return Promise.reject(new Error('[GatewayComparisonModal] requires either `source.baseUrl` or `source.onFetchLatencyHistory`'));
  }
  const path = (source.path || '/admin/orchestrator-devices/api/centrals/:id/latency').replace(':id', encodeURIComponent(id));
  const base = source.baseUrl.replace(/\/$/, '');
  const sep = path.includes('?') ? '&' : '?';
  const url = `${base}${path}${sep}start=${encodeURIComponent(new Date(startTs).toISOString())}&end=${encodeURIComponent(
    new Date(endTs).toISOString()
  )}`;
  return fetch(url, source.fetchOptions).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}

// ============================================================================
// Main Function
// ============================================================================

/** Opens a multi-central probe-latency comparison modal. */
export async function openGatewayComparisonModal(params: GatewayComparisonModalParams): Promise<GatewayComparisonModalInstance> {
  const modalId = `myio-gw-comparison-modal-${Date.now()}`;

  const startTs = new Date(params.startDate).getTime();
  const endTs = new Date(params.endDate).getTime();

  const state: ModalState = {
    source: params.source,
    centrals: params.centrals,
    startTs,
    endTs,
    granularity: params.granularity || 'hour',
    theme: params.theme || 'dark',
    locale: params.locale || 'pt-BR',
    centralData: [],
    isLoading: true,
    dateRangePicker: null,
    selectedPeriods: ['madrugada', 'manha', 'tarde', 'noite'],
    hiddenCentrals: new Set<string>(),
    kpiSidebarOpen: true,
    chartType: 'line',
  };

  const savedGranularity = localStorage.getItem('myio-gw-comparison-granularity') as GatewayGranularity;
  const savedTheme = localStorage.getItem('myio-gw-comparison-theme') as 'dark' | 'light';
  const savedKpiSidebar = localStorage.getItem('myio-gw-comparison-kpi-sidebar');
  const savedChartType = localStorage.getItem('myio-gw-comparison-charttype') as GatewayChartType;
  if (savedGranularity) state.granularity = savedGranularity;
  if (savedTheme) state.theme = savedTheme;
  if (savedKpiSidebar != null) state.kpiSidebarOpen = savedKpiSidebar === '1';
  if (savedChartType && CHART_TYPES.some((t) => t.id === savedChartType)) state.chartType = savedChartType;

  const modalContainer = document.createElement('div');
  modalContainer.id = modalId;
  document.body.appendChild(modalContainer);

  renderModal(modalContainer, state, modalId);

  await fetchAllCentralsData(state);
  renderModal(modalContainer, state, modalId);
  drawComparisonChart(modalId, state);

  await setupEventListeners(modalContainer, state, modalId, params.onClose);

  return {
    destroy: () => {
      modalContainer.remove();
      params.onClose?.();
    },
    updateData: async (startDate: string, endDate: string, granularity?: GatewayGranularity) => {
      state.startTs = new Date(startDate).getTime();
      state.endTs = new Date(endDate).getTime();
      if (granularity) state.granularity = granularity;
      state.isLoading = true;
      renderModal(modalContainer, state, modalId);

      await fetchAllCentralsData(state);
      renderModal(modalContainer, state, modalId);
      drawComparisonChart(modalId, state);
      await setupEventListeners(modalContainer, state, modalId, params.onClose);
    },
  };
}

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchAllCentralsData(state: ModalState): Promise<void> {
  state.isLoading = true;
  state.centralData = [];

  try {
    const results = await Promise.all(
      state.centrals.map(async (central, index) => {
        const id = central.tbId || central.id;
        try {
          const data = await fetchOne(state.source, id, state.startTs, state.endTs);
          const stats = calculateLatencyStats(data);
          return { central, data, stats, color: CHART_COLORS[index % CHART_COLORS.length] };
        } catch (error) {
          console.error(`[GatewayComparisonModal] Error fetching data for ${central.label}:`, error);
          return { central, data: [], stats: { avg: null, min: null, max: null, count: 0, gaps: 0 }, color: CHART_COLORS[index % CHART_COLORS.length] };
        }
      })
    );
    state.centralData = results;
  } catch (error) {
    console.error('[GatewayComparisonModal] Error fetching data:', error);
  }

  state.isLoading = false;
}

// ============================================================================
// Rendering
// ============================================================================

function renderModal(container: HTMLElement, state: ModalState, modalId: string): void {
  const colors = getGatewayThemeColors(state.theme);

  const legendHTML = state.centralData
    .map((cd) => {
      const isHidden = state.hiddenCentrals.has(cd.central.id);
      return `
    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'};
      border-radius: 8px; opacity: ${isHidden ? '0.4' : '1'};">
      <span style="width: 12px; height: 12px; border-radius: 50%; background: ${cd.color};"></span>
      <span style="color: ${colors.text}; font-size: 13px;">${cd.central.label}</span>
      <span style="color: ${colors.textMuted}; font-size: 11px; margin-left: auto;">
        ${cd.stats.count > 0 ? formatLatency(cd.stats.avg) : 'N/A'}
      </span>
    </div>
  `;
    })
    .join('');

  const visibleCentralData = state.centralData.filter((cd) => !state.hiddenCentrals.has(cd.central.id));
  const overallAvgValues = visibleCentralData.map((cd) => cd.stats.avg).filter((v): v is number => v != null);
  const overallAvg =
    overallAvgValues.length > 0 ? Math.round(overallAvgValues.reduce((a, b) => a + b, 0) / overallAvgValues.length) : null;

  // Sum of online/offline hours across visible centrals with uptime data. Each
  // central's own online+offline always adds up to the full period length, so
  // (sum online)/(sum online + sum offline) is exactly the average %online
  // across those centrals, weighted equally (same period length for all).
  let totalOfflineHours = 0;
  let totalOnlineHours = 0;
  let uptimeSampleCount = 0;
  visibleCentralData.forEach((cd) => {
    const uptime = calculateUptimeStats(cd.stats, state.startTs, state.endTs);
    if (uptime.hasData) {
      totalOfflineHours += uptime.offlineHours;
      totalOnlineHours += uptime.onlineHours;
      uptimeSampleCount++;
    }
  });
  const anyUptimeData = uptimeSampleCount > 0;
  const totalCapacityHours = totalOnlineHours + totalOfflineHours;
  const offlinePercentAvg = anyUptimeData && totalCapacityHours > 0 ? (totalOfflineHours / totalCapacityHours) * 100 : null;
  const onlinePercentAvg = offlinePercentAvg != null ? 100 - offlinePercentAvg : null;

  const consolidatedKpiHTML = `
    <div style="
      padding: 14px 16px; margin-bottom: 12px;
      background: ${state.theme === 'dark' ? 'rgba(62,26,125,0.18)' : 'rgba(62,26,125,0.06)'};
      border-radius: 10px; border: 1.5px solid #3e1a7d;
      display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start;
    ">
      <div style="font-weight: 700; color: #3e1a7d; font-size: 13px; display: flex; align-items: center; gap: 6px; width: 100%;">
        📊 Consolidado
        <span style="font-weight: 400; font-size: 11px; color: ${colors.textMuted};">
          (${visibleCentralData.length} de ${state.centralData.length} visíveis)
        </span>
      </div>
      <div>
        <span style="color: ${colors.textMuted}; font-size: 11px; display: block;">Média geral de latência</span>
        <span style="color: ${colors.text}; font-weight: 700; font-size: 16px;">${overallAvg != null ? formatLatency(overallAvg) : 'N/A'}</span>
      </div>
      <div>
        <span style="color: ${colors.textMuted}; font-size: 11px; display: block;">Tempo online estimado (total)</span>
        <span style="color: ${colors.text}; font-weight: 700; font-size: 16px;">
          ${anyUptimeData ? formatHours(totalOnlineHours) : 'N/A'}
          ${anyUptimeData ? `<span style="font-weight: 400; font-size: 12px; color: ${colors.success};">(${onlinePercentAvg!.toFixed(1)}% online)</span>` : ''}
        </span>
      </div>
      <div>
        <span style="color: ${colors.textMuted}; font-size: 11px; display: block;">Tempo offline estimado (total)</span>
        <span style="color: ${colors.text}; font-weight: 700; font-size: 16px;">
          ${anyUptimeData ? formatHours(totalOfflineHours) : 'N/A'}
          ${anyUptimeData ? `<span style="font-weight: 400; font-size: 12px; color: ${colors.danger};">(${offlinePercentAvg!.toFixed(1)}% offline)</span>` : ''}
        </span>
      </div>
    </div>
  `;

  const statsHTML = state.centralData
    .map((cd, index) => {
      const isHidden = state.hiddenCentrals.has(cd.central.id);
      const cdUptime = calculateUptimeStats(cd.stats, state.startTs, state.endTs);
      const minMedMax =
        cd.stats.count > 0
          ? `${formatLatency(cd.stats.min)} / ${formatLatency(cd.stats.avg)} / ${formatLatency(cd.stats.max)}`
          : 'N/A';
      const connectivityHTML = cdUptime.hasData
        ? `
          <span style="display: inline-flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${colors.primary}; flex-shrink: 0;"></span>
            ${formatHours(cdUptime.onlineHours)} (${cdUptime.onlinePercent.toFixed(1)}%)
          </span>
          <span style="display: inline-flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${colors.danger}; flex-shrink: 0;"></span>
            ${formatHours(cdUptime.offlineHours)} (${cdUptime.offlinePercent.toFixed(1)}%)
          </span>
        `
        : 'N/A';
      return `
    <div data-central-id="${escAttr(cd.central.id)}" style="
      padding: 12px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
      border-radius: 10px; border-left: 4px solid ${cd.color};
      width: 100%; box-sizing: border-box; opacity: ${isHidden ? '0.4' : '1'}; transition: opacity 0.15s;
    ">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
        <div style="font-weight: 600; color: ${colors.text}; font-size: 13px;">
          ${cd.central.label}
        </div>
        <button id="${modalId}-eye-${index}" type="button"
          aria-label="${isHidden ? 'Mostrar' : 'Ocultar'} ${escAttr(cd.central.label)} na comparação"
          title="${isHidden ? 'Mostrar no gráfico' : 'Ocultar do gráfico'}"
          style="
            background: none; border: none; cursor: pointer; padding: 2px 4px;
            font-size: 14px; line-height: 1; border-radius: 4px;
          ">${isHidden ? '🙈' : '👁️'}</button>
      </div>
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; font-size: 11px;">
        <span style="color: ${colors.textMuted}; white-space: nowrap;">Mín. / Méd. / Máx:</span>
        <span style="color: ${colors.text}; font-weight: 500;">${minMedMax}</span>
        <span style="color: ${colors.textMuted};">Leituras:</span>
        <span style="color: ${colors.text};">${cd.stats.count}</span>
        <span style="color: ${colors.textMuted}; white-space: nowrap;">Conectividade:</span>
        <span style="color: ${colors.text}; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">${connectivityHTML}</span>
      </div>
    </div>
  `;
    })
    .join('');

  const isMaximized = (container as any).__isMaximized || false;
  const contentMaxWidth = isMaximized ? '100%' : '1300px';
  const contentMaxHeight = isMaximized ? '100vh' : '95vh';
  const contentBorderRadius = isMaximized ? '0' : '10px';

  container.innerHTML = `
    <div class="myio-gw-comparison-overlay" style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); z-index: 9998;
      display: flex; justify-content: center; align-items: center;
      backdrop-filter: blur(2px);
    ">
      <div class="myio-gw-comparison-content" style="
        background: ${colors.surface}; border-radius: ${contentBorderRadius};
        max-width: ${contentMaxWidth}; width: ${isMaximized ? '100%' : '95%'};
        max-height: ${contentMaxHeight}; height: ${isMaximized ? '100%' : 'auto'};
        overflow: hidden; display: flex; flex-direction: column;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: 'Nunito', system-ui, sans-serif;
      ">
        <!-- Header - MyIO Premium Style (hand-rolled inline, matching TemperatureComparisonModal.ts) -->
        <div style="
          padding: 4px 8px; display: flex; align-items: center; justify-content: space-between;
          background: #3e1a7d; color: white; border-radius: ${isMaximized ? '0' : '10px 10px 0 0'};
          min-height: 20px;
        ">
          <h2 style="margin: 6px; font-size: 18px; font-weight: 600; color: white; line-height: 2;">
            🔌 Comparação de Conectividade - ${state.centrals.length} centrais
          </h2>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button id="${modalId}-kpi-toggle" title="${state.kpiSidebarOpen ? 'Ocultar painel de KPIs' : 'Mostrar painel de KPIs'}" aria-pressed="${state.kpiSidebarOpen}" style="
              background: none; border: none; font-size: 16px; cursor: pointer;
              padding: 4px 8px; border-radius: 6px; color: rgba(255,255,255,0.8);
              transition: background-color 0.2s;
            ">📊</button>
            <button id="${modalId}-theme-toggle" title="Alternar tema" style="
              background: none; border: none; font-size: 16px; cursor: pointer;
              padding: 4px 8px; border-radius: 6px; color: rgba(255,255,255,0.8);
              transition: background-color 0.2s;
            ">${state.theme === 'dark' ? '☀️' : '🌙'}</button>
            <button id="${modalId}-maximize" title="${isMaximized ? 'Restaurar' : 'Maximizar'}" style="
              background: none; border: none; font-size: 16px; cursor: pointer;
              padding: 4px 8px; border-radius: 6px; color: rgba(255,255,255,0.8);
              transition: background-color 0.2s;
            ">${isMaximized ? '🗗' : '🗖'}</button>
            <button id="${modalId}-close" title="Fechar" style="
              background: none; border: none; font-size: 20px; cursor: pointer;
              padding: 4px 8px; border-radius: 6px; color: rgba(255,255,255,0.8);
              transition: background-color 0.2s;
            ">×</button>
          </div>
        </div>

        <!-- Body -->
        <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0;">
        <div style="flex: 1; overflow: hidden; display: flex; min-height: 0;">
        <div style="flex: 1; overflow-y: auto; padding: 16px; min-width: 0;">

        <!-- Controls Row -->
        <div style="
          display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end;
          margin-bottom: 16px; padding: 16px;
          background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f7f7f7'};
          border-radius: 6px; border: 1px solid ${colors.border};
        ">
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
              ${DAY_PERIODS.map(
                (period) => `
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
              `
              ).join('')}
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
          <button id="${modalId}-query" style="
            background: #3e1a7d; color: white; border: none;
            padding: 8px 16px; border-radius: 6px; cursor: pointer;
            font-size: 14px; font-weight: 500; height: 38px;
            display: flex; align-items: center; gap: 8px;
            font-family: 'Nunito', system-ui, sans-serif;
          " ${state.isLoading ? 'disabled' : ''}>
            ${state.isLoading ? '<span style="animation: spin 1s linear infinite; display: inline-block;">↻</span> Carregando...' : 'Carregar'}
          </button>
        </div>

        <!-- Legend -->
        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
          ${legendHTML}
        </div>

        <!-- Chart Container -->
        <div style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; color: ${colors.textMuted}; font-weight: 500;">
              Histórico de Latência
            </h3>
            <div role="group" aria-label="Tipo de gráfico" style="
              display: flex; gap: 2px; padding: 2px; border-radius: 8px;
              background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#eef0f3'};
            ">
              ${CHART_TYPES.map(
                (t) => `
                <button type="button" id="${modalId}-charttype-${t.id}" title="${escAttr(t.label)}" aria-label="${escAttr(
                  t.label
                )}" aria-pressed="${state.chartType === t.id}" style="
                  padding: 5px 9px; border: none; border-radius: 6px; cursor: pointer;
                  font-size: 14px; line-height: 1; transition: background-color 0.15s;
                  background: ${state.chartType === t.id ? '#3e1a7d' : 'transparent'};
                  color: ${state.chartType === t.id ? '#fff' : colors.textMuted};
                ">${t.icon}</button>
              `
              ).join('')}
            </div>
          </div>
          <div id="${modalId}-chart" style="
            height: 380px;
            background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#fafafa'};
            border-radius: 14px; display: flex; justify-content: center; align-items: center;
            border: 1px solid ${colors.border}; position: relative;
          ">
            ${
              state.isLoading
                ? `<div style="text-align: center; color: ${colors.textMuted};">
                     <div style="animation: spin 1s linear infinite; font-size: 36px; margin-bottom: 12px;">↻</div>
                     <div style="font-size: 15px;">Carregando dados de ${state.centrals.length} centrais...</div>
                   </div>`
                : state.centralData.every((cd) => cd.data.length === 0)
                ? `<div style="text-align: center; color: ${colors.textMuted};">
                     <div style="font-size: 48px; margin-bottom: 12px;">📭</div>
                     <div style="font-size: 16px;">Sem dados para o período selecionado</div>
                   </div>`
                : `<canvas id="${modalId}-canvas" style="width: 100%; height: 100%;"></canvas>`
            }
          </div>
        </div>

        </div><!-- End main scroll column -->

        <!-- KPI Sidebar (retractable — 👁️ toggles + Consolidado + per-central cards) -->
        <div style="
          width: ${state.kpiSidebarOpen ? '300px' : '0px'};
          flex-shrink: 0; overflow: hidden;
          border-left: ${state.kpiSidebarOpen ? `1px solid ${colors.border}` : 'none'};
          background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.02)' : '#fafafa'};
          transition: width 0.2s ease;
        ">
          <div style="width: 300px; box-sizing: border-box; height: 100%; overflow-y: auto; padding: 16px;">
            ${consolidatedKpiHTML}
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${statsHTML}
            </div>
          </div>
        </div>
        </div><!-- End main+sidebar row -->

        <!-- Footer / Actions -->
        <div style="
          flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 12px 16px; border-top: 1px solid ${colors.border};
        ">
          <button id="${modalId}-kpi-toggle-footer" style="
            background: none; border: 1px solid ${colors.border}; color: ${colors.textMuted};
            padding: 6px 12px; border-radius: 6px; cursor: pointer;
            font-size: 12px; display: flex; align-items: center; gap: 6px;
            font-family: 'Nunito', system-ui, sans-serif;
          ">
            📊 ${state.kpiSidebarOpen ? 'Ocultar KPIs' : 'Mostrar KPIs'}
          </button>
          <div style="display: flex; gap: 12px;">
            <button id="${modalId}-export" style="
              background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f7f7f7'};
              color: ${colors.text}; border: 1px solid ${colors.border};
              padding: 8px 16px; border-radius: 6px; cursor: pointer;
              font-size: 14px; display: flex; align-items: center; gap: 8px;
              font-family: 'Nunito', system-ui, sans-serif;
            " ${state.centralData.every((cd) => cd.data.length === 0) ? 'disabled' : ''}>
              📥 Exportar CSV
            </button>
            <button id="${modalId}-export-pdf" style="
              background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f7f7f7'};
              color: ${colors.text}; border: 1px solid ${colors.border};
              padding: 8px 16px; border-radius: 6px; cursor: pointer;
              font-size: 14px; display: flex; align-items: center; gap: 8px;
              font-family: 'Nunito', system-ui, sans-serif;
            " ${state.centralData.every((cd) => cd.data.length === 0) ? 'disabled' : ''}>
              📄 Exportar PDF
            </button>
            <button id="${modalId}-close-btn" style="
              background: #3e1a7d; color: white; border: none;
              padding: 8px 16px; border-radius: 6px; cursor: pointer;
              font-size: 14px; font-weight: 500;
              font-family: 'Nunito', system-ui, sans-serif;
            ">
              Fechar
            </button>
          </div>
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
      #${modalId} .myio-gw-comparison-content > div:first-child button:hover {
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
  x: number;
  y: number | null; // null = a gap (probe failure / no reading) for this central at this timestamp
  screenX: number;
  screenY: number;
  centralLabel: string;
  centralColor: string;
}

function drawComparisonChart(modalId: string, state: ModalState): void {
  const chartContainer = document.getElementById(`${modalId}-chart`);
  const canvas = document.getElementById(`${modalId}-canvas`) as HTMLCanvasElement;
  if (!chartContainer || !canvas) return;

  const visibleCentralData = state.centralData.filter((cd) => !state.hiddenCentrals.has(cd.central.id));

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const colors = getGatewayThemeColors(state.theme);

  const width = chartContainer.clientWidth - 2;
  const height = 380;
  canvas.width = width;
  canvas.height = height;

  if (state.chartType === 'pie') {
    drawAggregateUptimePie(canvas, state, colors);
    return;
  }

  if (state.hiddenCentrals.size > 0 && visibleCentralData.length === 0) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.textMuted;
    ctx.font = '14px Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Todas as centrais estão ocultas — clique no ícone 👁️ para exibir', width / 2, height / 2);
    return;
  }

  const hasData = visibleCentralData.some((cd) => cd.data.length > 0);
  if (!hasData) return;

  const paddingLeft = 65;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 55;

  ctx.clearRect(0, 0, width, height);

  const processedData: { central: CentralData; points: ComparisonChartPoint[] }[] = [];

  visibleCentralData.forEach((cd) => {
    if (cd.data.length === 0) return;
    const filteredData = filterByDayPeriods(cd.data, state.selectedPeriods);
    if (filteredData.length === 0) return;

    let points: ComparisonChartPoint[];

    // NOTE: gaps (null latencyMs/avg) are kept in the array on purpose — see
    // the single-gateway GatewayModal.ts's drawChart for the same fix. Only
    // the LINE actually breaks at gaps here (per-central shaded gap bands
    // were tried and looked like visual noise with several centrals
    // overlapping different outage windows — skipped for the comparison
    // chart specifically).
    if (state.granularity === 'hour') {
      const interpolated = interpolateLatency(filteredData, {
        intervalMinutes: 30,
        startTs: state.startTs,
        endTs: state.endTs,
      });
      const filteredInterpolated = filterByDayPeriods(interpolated, state.selectedPeriods);
      points = filteredInterpolated.map((item) => ({
        x: Date.parse(item.ts),
        y: item.latencyMs,
        screenX: 0,
        screenY: 0,
        centralLabel: cd.central.label,
        centralColor: cd.color,
      }));
    } else {
      const daily = aggregateByDay(filteredData);
      points = daily.map((item) => ({
        x: item.dateTs,
        y: item.avg,
        screenX: 0,
        screenY: 0,
        centralLabel: cd.central.label,
        centralColor: cd.color,
      }));
    }

    if (points.length > 0) processedData.push({ central: cd, points });
  });

  if (processedData.length === 0 || !processedData.some(({ points }) => points.some((p) => p.y != null))) {
    ctx.fillStyle = colors.textMuted;
    ctx.font = '14px Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhum dado para os períodos selecionados', width / 2, height / 2);
    return;
  }

  const isPeriodsFiltered = state.selectedPeriods.length < 4 && state.selectedPeriods.length > 0;

  let dataMinY = 0;
  let dataMaxY = -Infinity;
  processedData.forEach(({ points }) => {
    points.forEach((point) => {
      if (point.y != null && point.y > dataMaxY) dataMaxY = point.y;
    });
  });

  // Collect unique SLA targets across centrals (mirrors temperatureRanges/rangeMap).
  interface SlaTarget {
    value: number;
    customerName: string;
    color: string;
    centralLabels: string[];
  }
  const targetMap = new Map<number, SlaTarget>();
  visibleCentralData.forEach((cd) => {
    const target = cd.central.targetLatencyMs;
    if (target == null) return;
    if (!targetMap.has(target)) {
      targetMap.set(target, {
        value: target,
        customerName: cd.central.customerName || '',
        color: cd.color,
        centralLabels: [cd.central.label],
      });
    } else {
      targetMap.get(target)!.centralLabels.push(cd.central.label);
    }
  });
  const slaTargets = Array.from(targetMap.values());

  let thresholdMaxY = dataMaxY;
  slaTargets.forEach((t) => {
    if (t.value > thresholdMaxY) thresholdMaxY = t.value;
  });

  const globalMinY = 0;
  const globalMaxY = Math.ceil(Math.max(dataMaxY, thresholdMaxY)) + Math.max(1, Math.round(dataMaxY * 0.1));

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const scaleY = chartHeight / (globalMaxY - globalMinY || 1);
  const baselineY = height - paddingBottom - (0 - globalMinY) * scaleY;

  if (isPeriodsFiltered) {
    const maxPoints = Math.max(...processedData.map(({ points }) => points.length));
    const pointSpacing = chartWidth / Math.max(1, maxPoints - 1);
    processedData.forEach(({ points }) => {
      points.forEach((point, index) => {
        point.screenX = paddingLeft + index * pointSpacing;
        point.screenY = point.y == null ? NaN : height - paddingBottom - (point.y - globalMinY) * scaleY;
      });
    });
  } else {
    let globalMinX = Infinity;
    let globalMaxX = -Infinity;
    processedData.forEach(({ points }) => {
      points.forEach((point) => {
        if (point.x < globalMinX) globalMinX = point.x;
        if (point.x > globalMaxX) globalMaxX = point.x;
      });
    });
    const timeRange = globalMaxX - globalMinX || 1;
    const scaleX = chartWidth / timeRange;
    processedData.forEach(({ points }) => {
      points.forEach((point) => {
        point.screenX = paddingLeft + (point.x - globalMinX) * scaleX;
        point.screenY = point.y == null ? NaN : height - paddingBottom - (point.y - globalMinY) * scaleY;
      });
    });
  }

  // Horizontal grid lines
  ctx.strokeStyle = colors.chartGrid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = paddingTop + (chartHeight * i) / 5;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
  }

  // SLA target lines + "at risk" bands (one per unique target value)
  const rangeColors = [
    { fill: 'rgba(244, 67, 54, 0.08)', stroke: '#f44336' },
    { fill: 'rgba(255, 152, 0, 0.08)', stroke: '#FF9800' },
    { fill: 'rgba(156, 39, 176, 0.08)', stroke: '#9C27B0' },
    { fill: 'rgba(0, 188, 212, 0.08)', stroke: '#00BCD4' },
  ];

  slaTargets.forEach((target, index) => {
    const targetY = height - paddingBottom - (target.value - globalMinY) * scaleY;
    const colorSet = rangeColors[index % rangeColors.length];

    ctx.fillStyle = colorSet.fill;
    ctx.fillRect(paddingLeft, paddingTop, chartWidth, targetY - paddingTop);

    ctx.strokeStyle = colorSet.stroke;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, targetY);
    ctx.lineTo(width - paddingRight, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = colorSet.stroke;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const labelText = target.customerName || `SLA ${target.value}ms`;
    ctx.fillText(labelText, width - paddingRight + 5, targetY + 3);
  });

  // The metric itself — branches by chart type. Every mode skips null (gap)
  // points outright (no bar, a broken line segment), which is what makes a
  // probe outage read as a hole instead of a smoothed-over dip.
  if (state.chartType === 'bar') {
    const maxPointsCount = Math.max(1, ...processedData.map(({ points }) => points.length));
    const barWidth = Math.max(1.5, (chartWidth / maxPointsCount / Math.max(1, processedData.length)) * 0.8);
    processedData.forEach(({ central, points }, ci) => {
      ctx.fillStyle = hexToRgba(central.color, 0.8);
      const offset = (ci - (processedData.length - 1) / 2) * barWidth;
      points.forEach((point) => {
        if (point.y == null) return;
        ctx.fillRect(point.screenX + offset - barWidth / 2, Math.min(point.screenY, baselineY), barWidth, Math.abs(baselineY - point.screenY));
      });
    });
  } else {
    if (state.chartType === 'area') {
      processedData.forEach(({ central, points }) => {
        let segStart = -1;
        for (let i = 0; i <= points.length; i++) {
          const isValid = i < points.length && points[i].y != null;
          if (isValid && segStart === -1) segStart = i;
          if ((!isValid || i === points.length) && segStart !== -1) {
            const segEnd = i - 1;
            if (segEnd > segStart) {
              ctx.beginPath();
              ctx.moveTo(points[segStart].screenX, baselineY);
              for (let j = segStart; j <= segEnd; j++) ctx.lineTo(points[j].screenX, points[j].screenY);
              ctx.lineTo(points[segEnd].screenX, baselineY);
              ctx.closePath();
              ctx.fillStyle = hexToRgba(central.color, 0.16);
              ctx.fill();
            }
            segStart = -1;
          }
        }
      });
    }

    processedData.forEach(({ central, points }) => {
      ctx.strokeStyle = central.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let drawing = false;
      points.forEach((point) => {
        if (point.y == null) {
          drawing = false;
          return;
        }
        if (!drawing) {
          ctx.moveTo(point.screenX, point.screenY);
          drawing = true;
        } else {
          ctx.lineTo(point.screenX, point.screenY);
        }
      });
      ctx.stroke();

      if (state.chartType === 'line') {
        ctx.fillStyle = central.color;
        points.forEach((point) => {
          if (point.y == null) return;
          ctx.beginPath();
          ctx.arc(point.screenX, point.screenY, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
  }

  // Y axis labels
  ctx.fillStyle = colors.textMuted;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const val = globalMinY + ((globalMaxY - globalMinY) * (5 - i)) / 5;
    const y = paddingTop + (chartHeight * i) / 5;
    ctx.fillText(`${val.toFixed(0)}ms`, paddingLeft - 10, y + 4);
  }

  // X axis labels
  ctx.textAlign = 'center';
  const xAxisPoints = processedData[0]?.points || [];
  const numLabels = Math.min(8, xAxisPoints.length);
  const labelInterval = Math.max(1, Math.floor(xAxisPoints.length / numLabels));

  for (let i = 0; i < xAxisPoints.length; i += labelInterval) {
    const point = xAxisPoints[i];
    const label = formatGatewayAxisLabel(point.x, state.granularity, state.locale);

    ctx.strokeStyle = colors.chartGrid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(point.screenX, paddingTop);
    ctx.lineTo(point.screenX, height - paddingBottom);
    ctx.stroke();

    ctx.fillStyle = colors.textMuted;
    ctx.fillText(label, point.screenX, height - paddingBottom + 18);
  }

  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();

  const allChartPoints = processedData.flatMap((pd) => pd.points).filter((p) => p.y != null);
  setupComparisonChartTooltip(canvas, chartContainer, allChartPoints, state, colors);
}

/** Pie mode: aggregate online vs offline proportion across VISIBLE centrals — same numbers as the "Consolidado" KPI card in the sidebar (sum of each central's online/offline hours; equally-weighted average since every central's online+offline always sums to the same period length). Not a time series, so it bypasses the axis/gap machinery above entirely. */
function drawAggregateUptimePie(canvas: HTMLCanvasElement, state: ModalState, colors: GatewayThemeColors): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const visibleCentralData = state.centralData.filter((cd) => !state.hiddenCentrals.has(cd.central.id));
  let totalOnlineHours = 0;
  let totalOfflineHours = 0;
  let uptimeSampleCount = 0;
  visibleCentralData.forEach((cd) => {
    const uptime = calculateUptimeStats(cd.stats, state.startTs, state.endTs);
    if (uptime.hasData) {
      totalOnlineHours += uptime.onlineHours;
      totalOfflineHours += uptime.offlineHours;
      uptimeSampleCount++;
    }
  });

  if (uptimeSampleCount === 0) {
    ctx.fillStyle = colors.textMuted;
    ctx.font = '14px Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados suficientes para estimar disponibilidade', width / 2, height / 2);
    return;
  }

  const totalHours = totalOnlineHours + totalOfflineHours || 1;
  const onlinePercent = (totalOnlineHours / totalHours) * 100;
  const offlinePercent = 100 - onlinePercent;

  const cx = width * 0.35;
  const cy = height / 2;
  const r = Math.max(10, Math.min(cy, cx) - 30);

  const slices = [
    { value: onlinePercent, color: colors.primary, label: `Online — ${onlinePercent.toFixed(1)}%` },
    { value: offlinePercent, color: colors.danger, label: `Offline — ${offlinePercent.toFixed(1)}%` },
  ];

  let startAngle = -Math.PI / 2;
  slices.forEach((slice) => {
    if (slice.value <= 0) return;
    const angle = (slice.value / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    startAngle += angle;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  let ly = cy - (slices.length * 24) / 2 + 12;
  const legendX = cx + r + 32;
  ctx.textAlign = 'left';
  ctx.font = '13px system-ui, sans-serif';
  slices.forEach((slice) => {
    ctx.fillStyle = slice.color;
    ctx.fillRect(legendX, ly - 9, 12, 12);
    ctx.fillStyle = colors.text;
    ctx.fillText(slice.label, legendX + 18, ly + 1);
    ly += 24;
  });

  ctx.fillStyle = colors.textMuted;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${uptimeSampleCount} de ${visibleCentralData.length} centrais visíveis com dados`, cx, cy + r + 20);
}

// ============================================================================
// Tooltip
// ============================================================================

function setupComparisonChartTooltip(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  chartData: ComparisonChartPoint[],
  state: ModalState,
  colors: GatewayThemeColors
): void {
  const existingTooltip = container.querySelector('.myio-chart-tooltip');
  if (existingTooltip) existingTooltip.remove();

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

  const findNearestPoint = (mouseX: number, mouseY: number): ComparisonChartPoint | null => {
    const threshold = 20;
    let nearest: ComparisonChartPoint | null = null;
    let minDist = Infinity;
    for (const point of chartData) {
      const dist = Math.sqrt(Math.pow(mouseX - point.screenX, 2) + Math.pow(mouseY - point.screenY, 2));
      if (dist < minDist && dist < threshold) {
        minDist = dist;
        nearest = point;
      }
    }
    return nearest;
  };

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const point = findNearestPoint(mouseX, mouseY);

    if (point) {
      const date = new Date(point.x);
      let dateStr: string;
      if (state.granularity === 'hour') {
        dateStr =
          date.toLocaleDateString(state.locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) +
          ' ' +
          date.toLocaleTimeString(state.locale, { hour: '2-digit', minute: '2-digit' });
      } else {
        dateStr = date.toLocaleDateString(state.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
      }

      tooltip.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${point.centralColor};"></span>
          <span style="font-weight: 600;">${point.centralLabel}</span>
        </div>
        <div style="font-weight: 600; font-size: 16px; color: ${point.centralColor}; margin-bottom: 4px;">
          ${formatLatency(point.y)}
        </div>
        <div style="font-size: 11px; color: ${colors.textMuted};">
          📅 ${dateStr}
        </div>
      `;

      let tooltipX = point.screenX + 15;
      let tooltipY = point.screenY - 15;
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
      canvas.style.cursor = 'pointer';
    } else {
      tooltip.style.opacity = '0';
      canvas.style.cursor = 'default';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
    canvas.style.cursor = 'default';
  });
}

// ============================================================================
// Event Listeners
// ============================================================================

async function setupEventListeners(container: HTMLElement, state: ModalState, modalId: string, onClose?: () => void): Promise<void> {
  const closeModal = () => {
    container.remove();
    onClose?.();
  };

  container.querySelector('.myio-gw-comparison-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById(`${modalId}-close`)?.addEventListener('click', closeModal);
  document.getElementById(`${modalId}-close-btn`)?.addEventListener('click', closeModal);

  const dateRangeInput = document.getElementById(`${modalId}-date-range`) as HTMLInputElement;
  if (dateRangeInput && !state.dateRangePicker) {
    try {
      state.dateRangePicker = await createDateRangePicker(dateRangeInput, {
        presetStart: new Date(state.startTs).toISOString(),
        presetEnd: new Date(state.endTs).toISOString(),
        includeTime: true,
        timePrecision: 'minute',
        maxRangeDays: state.source.maxRangeDays ?? 90,
        locale: state.locale as 'pt-BR' | 'en-US',
        parentEl: container.querySelector('.myio-gw-comparison-content') as HTMLElement,
        onApply: (result) => {
          state.startTs = new Date(result.startISO).getTime();
          state.endTs = new Date(result.endISO).getTime();
          console.log('[GatewayComparisonModal] Date range applied:', result);
        },
      });
    } catch (error) {
      console.warn('[GatewayComparisonModal] DateRangePicker initialization failed:', error);
    }
  }

  const toggleKpiSidebar = async () => {
    state.kpiSidebarOpen = !state.kpiSidebarOpen;
    localStorage.setItem('myio-gw-comparison-kpi-sidebar', state.kpiSidebarOpen ? '1' : '0');
    state.dateRangePicker = null;
    renderModal(container, state, modalId);
    if (state.centralData.some((cd) => cd.data.length > 0)) drawComparisonChart(modalId, state);
    await setupEventListeners(container, state, modalId, onClose);
  };
  document.getElementById(`${modalId}-kpi-toggle`)?.addEventListener('click', toggleKpiSidebar);
  document.getElementById(`${modalId}-kpi-toggle-footer`)?.addEventListener('click', toggleKpiSidebar);

  document.getElementById(`${modalId}-theme-toggle`)?.addEventListener('click', async () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('myio-gw-comparison-theme', state.theme);
    state.dateRangePicker = null;
    renderModal(container, state, modalId);
    if (state.centralData.some((cd) => cd.data.length > 0)) drawComparisonChart(modalId, state);
    await setupEventListeners(container, state, modalId, onClose);
  });

  document.getElementById(`${modalId}-maximize`)?.addEventListener('click', async () => {
    (container as any).__isMaximized = !(container as any).__isMaximized;
    state.dateRangePicker = null;
    renderModal(container, state, modalId);
    if (state.centralData.some((cd) => cd.data.length > 0)) drawComparisonChart(modalId, state);
    await setupEventListeners(container, state, modalId, onClose);
  });

  const periodBtn = document.getElementById(`${modalId}-period-btn`);
  const periodDropdown = document.getElementById(`${modalId}-period-dropdown`);

  periodBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (periodDropdown) {
      periodDropdown.style.display = periodDropdown.style.display === 'none' ? 'block' : 'none';
    }
  });

  document.addEventListener('click', (e) => {
    if (periodDropdown && !periodDropdown.contains(e.target as Node) && e.target !== periodBtn) {
      periodDropdown.style.display = 'none';
    }
  });

  const periodCheckboxes = document.querySelectorAll(`input[name="${modalId}-period"]`);
  periodCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const checked = Array.from(periodCheckboxes)
        .filter((cb: Element) => (cb as HTMLInputElement).checked)
        .map((cb: Element) => (cb as HTMLInputElement).value as DayPeriod);
      state.selectedPeriods = checked;
      const btnLabel = periodBtn?.querySelector('span:first-child');
      if (btnLabel) btnLabel.textContent = getSelectedPeriodsLabel(state.selectedPeriods);
      if (state.centralData.some((cd) => cd.data.length > 0)) drawComparisonChart(modalId, state);
    });
  });

  document.getElementById(`${modalId}-period-select-all`)?.addEventListener('click', () => {
    periodCheckboxes.forEach((cb: Element) => {
      (cb as HTMLInputElement).checked = true;
    });
    state.selectedPeriods = ['madrugada', 'manha', 'tarde', 'noite'];
    const btnLabel = periodBtn?.querySelector('span:first-child');
    if (btnLabel) btnLabel.textContent = getSelectedPeriodsLabel(state.selectedPeriods);
    if (state.centralData.some((cd) => cd.data.length > 0)) drawComparisonChart(modalId, state);
  });

  document.getElementById(`${modalId}-period-clear`)?.addEventListener('click', () => {
    periodCheckboxes.forEach((cb: Element) => {
      (cb as HTMLInputElement).checked = false;
    });
    state.selectedPeriods = [];
    const btnLabel = periodBtn?.querySelector('span:first-child');
    if (btnLabel) btnLabel.textContent = getSelectedPeriodsLabel(state.selectedPeriods);
    if (state.centralData.some((cd) => cd.data.length > 0)) drawComparisonChart(modalId, state);
  });

  document.getElementById(`${modalId}-granularity`)?.addEventListener('change', (e) => {
    state.granularity = (e.target as HTMLSelectElement).value as GatewayGranularity;
    localStorage.setItem('myio-gw-comparison-granularity', state.granularity);
    if (state.centralData.some((cd) => cd.data.length > 0)) drawComparisonChart(modalId, state);
  });

  CHART_TYPES.forEach((t) => {
    document.getElementById(`${modalId}-charttype-${t.id}`)?.addEventListener('click', async () => {
      if (state.chartType === t.id) return;
      state.chartType = t.id;
      localStorage.setItem('myio-gw-comparison-charttype', state.chartType);
      state.dateRangePicker = null;
      renderModal(container, state, modalId);
      if (state.centralData.some((cd) => cd.data.length > 0)) drawComparisonChart(modalId, state);
      await setupEventListeners(container, state, modalId, onClose);
    });
  });

  document.getElementById(`${modalId}-query`)?.addEventListener('click', async () => {
    if (state.startTs >= state.endTs) {
      alert('Por favor, selecione um período válido');
      return;
    }
    state.isLoading = true;
    state.dateRangePicker = null;
    renderModal(container, state, modalId);

    await fetchAllCentralsData(state);
    renderModal(container, state, modalId);
    drawComparisonChart(modalId, state);
    await setupEventListeners(container, state, modalId, onClose);
  });

  document.getElementById(`${modalId}-export`)?.addEventListener('click', () => {
    if (state.centralData.every((cd) => cd.data.length === 0)) return;
    exportComparisonCSV(state);
  });

  document.getElementById(`${modalId}-export-pdf`)?.addEventListener('click', () => {
    if (state.centralData.every((cd) => cd.data.length === 0)) return;
    const startDateStr = new Date(state.startTs).toLocaleDateString(state.locale).replace(/\//g, '-');
    const endDateStr = new Date(state.endTs).toLocaleDateString(state.locale).replace(/\//g, '-');
    const canvas = document.getElementById(`${modalId}-canvas`) as HTMLCanvasElement | null;
    exportGatewayComparisonPdf({
      centrals: state.centralData.map((cd) => ({
        label: cd.central.label,
        stats: cd.stats,
        hidden: state.hiddenCentrals.has(cd.central.id),
      })),
      startDateStr,
      endDateStr,
      startTs: state.startTs,
      endTs: state.endTs,
      chartCanvas: canvas,
    });
  });

  state.centralData.forEach((cd, index) => {
    document.getElementById(`${modalId}-eye-${index}`)?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (state.hiddenCentrals.has(cd.central.id)) {
        state.hiddenCentrals.delete(cd.central.id);
      } else {
        state.hiddenCentrals.add(cd.central.id);
      }
      state.dateRangePicker = null;
      renderModal(container, state, modalId);
      if (state.centralData.some((c) => c.data.length > 0)) drawComparisonChart(modalId, state);
      await setupEventListeners(container, state, modalId, onClose);
    });
  });
}

// ============================================================================
// CSV Export
// ============================================================================

function exportComparisonCSV(state: ModalState): void {
  const startDateStr = new Date(state.startTs).toLocaleDateString(state.locale).replace(/\//g, '-');
  const endDateStr = new Date(state.endTs).toLocaleDateString(state.locale).replace(/\//g, '-');

  const BOM = '﻿';
  let csvContent = BOM;

  csvContent += `Comparação de Conectividade\n`;
  csvContent += `Período: ${startDateStr} até ${endDateStr}\n`;
  csvContent += `Centrais: ${state.centrals.map((c) => c.label).join(', ')}\n`;
  csvContent += '\n';

  csvContent += 'Estatísticas por Central:\n';
  csvContent += 'Central,Média (ms),Min (ms),Max (ms),Leituras,Falhas\n';
  state.centralData.forEach((cd) => {
    csvContent += `"${cd.central.label}",${cd.stats.avg ?? ''},${cd.stats.min ?? ''},${cd.stats.max ?? ''},${cd.stats.count},${cd.stats.gaps}\n`;
  });
  csvContent += '\n';

  csvContent += 'Dados Detalhados:\n';
  csvContent += 'Data/Hora,Central,Latência (ms)\n';
  state.centralData.forEach((cd) => {
    cd.data.forEach((item) => {
      const date = new Date(item.ts).toLocaleString(state.locale);
      csvContent += `"${date}","${cd.central.label}",${item.latencyMs ?? ''}\n`;
    });
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comparacao_conectividade_${startDateStr}_${endDateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
