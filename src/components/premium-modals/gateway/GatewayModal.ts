/**
 * Gateway Modal Component
 * RFC-0231 (follow-up): Single-central probe-latency history visualization
 *
 * Rewritten to be "bem bem parecido mesmo" (maximal fidelity) with
 * `src/components/temperature/TemperatureModal.ts` — per explicit request,
 * confirmed via `handleActionDashboard` in
 * `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js`
 * that `openTemperatureModal` (that file) is the REAL modal opened by the
 * production "open dashboard chart" action, and is therefore the right
 * fidelity target — not the earlier `openGenericModal`-based version, and not
 * `TemperatureSettingsModal.ts` (a settings FORM with no chart, initially
 * misnamed as the reference).
 *
 * This file is now self-contained (own overlay, own `ModalHeader`, own
 * `<style>` block with `CSS_TOKENS`/`DATERANGEPICKER_STYLES`) instead of
 * built on `openGenericModal` — matching TemperatureModal.ts's own shell
 * exactly, section-by-section (Types → Modal State → Main Function →
 * Rendering → Chart Drawing → Tooltip → Event Listeners).
 *
 * Deliberate deltas from the temperature original (latency has no analog):
 * - no clamp/offset — a probe latency reading is never an "outlier to clamp".
 * - a single `targetLatencyMs` SLA ceiling (dashed line + "at risk" band
 *   above it) instead of temperature's `temperatureMin`/`temperatureMax` band.
 * - the OLD quick-period shortcut buttons (24h/7d/30d/90d) are REMOVED —
 *   TemperatureModal.ts has no such buttons, only Granularity + Day Period +
 *   Date Range Picker + a "Carregar" (Query) button; maximal fidelity means
 *   matching that exact control set, not keeping a bespoke one.
 * - `source.onFetchLatencyHistory({id, startTs, endTs})` (ms timestamps) —
 *   BREAKING change from the old `{id, days}` signature, to match
 *   TemperatureModal.ts's `dataFetcher(startTs, endTs)` shape.
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
  exportLatencyCSV,
  DAY_PERIODS,
  type GatewayLatencyPoint,
  type GatewayLatencyStats,
  type GatewayUptimeStats,
  type GatewayGranularity,
  type GatewayThemeColors,
  type DayPeriod,
} from './utils';

import { exportGatewayPdf } from './exportGatewayPdf';
import { createDateRangePicker, type DateRangeControl } from '../../createDateRangePicker';
import { CSS_TOKENS, DATERANGEPICKER_STYLES } from '../internal/styles/tokens';
import { ModalHeader } from '../../../utils/ModalHeader';

// ============================================================================
// Types
// ============================================================================

export interface GatewayModalSourceConfig {
  /** GCDR host, e.g. "https://gcdr.example.com". Required unless `onFetchLatencyHistory` is given. */
  baseUrl?: string;
  /** Path template with a literal `:id` placeholder. Default: "/admin/orchestrator-devices/api/centrals/:id/latency". */
  path?: string;
  /** Passed to fetch() verbatim — headers/credentials/etc. */
  fetchOptions?: RequestInit;
  /** Escape hatch: full override of the fetch itself. Receives explicit ms timestamps (matches TemperatureModal.ts's dataFetcher(startTs, endTs) shape). */
  onFetchLatencyHistory?: (params: { id: string; startTs: number; endTs: number }) => Promise<GatewayLatencyPoint[]>;
  /** Upper bound for a custom range picked via the date-range picker. Default: 365 (matches the real GCDR endpoint's own limit). */
  maxRangeDays?: number;
}

export interface GatewayModalLabels {
  title?: string; // "{name} - Histórico de Conectividade"
}

export interface GatewayModalParams {
  id: string;
  name: string;
  source: GatewayModalSourceConfig;
  /** Current/most-recent latency reading, for the "Latência Atual" stat card. */
  currentLatencyMs?: number;
  /** SLA/target ceiling — drawn as a dashed line + "at risk" band above it. */
  targetLatencyMs?: number;
  startDate?: string; // ISO
  endDate?: string; // ISO
  language?: 'pt' | 'en';
  theme?: 'light' | 'dark';
  container?: HTMLElement;
  labels?: GatewayModalLabels;
  granularity?: GatewayGranularity;
  locale?: 'pt-BR' | 'en-US';
}

export interface GatewayModalInstance {
  close: () => void;
  updateData: (startDate: string, endDate: string, granularity?: GatewayGranularity) => Promise<void>;
}

/** Chart rendering mode, switchable via the segmented control next to "Histórico de Latência". */
export type GatewayChartType = 'line' | 'smooth' | 'bar' | 'area' | 'pie';

const CHART_TYPES: { id: GatewayChartType; icon: string; label: string }[] = [
  { id: 'line', icon: '📈', label: 'Linhas' },
  { id: 'smooth', icon: '〰️', label: 'Linhas suaves' },
  { id: 'bar', icon: '📊', label: 'Barras' },
  { id: 'area', icon: '🏔️', label: 'Área' },
  { id: 'pie', icon: '🥧', label: 'Pizza (disponibilidade)' },
];

// ============================================================================
// Modal State
// ============================================================================

interface ModalState {
  id: string;
  label: string;
  source: GatewayModalSourceConfig;
  currentLatencyMs: number | null;
  targetLatencyMs: number | null;
  startTs: number;
  endTs: number;
  granularity: GatewayGranularity;
  theme: 'dark' | 'light';
  locale: string;
  data: GatewayLatencyPoint[];
  stats: GatewayLatencyStats;
  isLoading: boolean;
  dateRangePicker: DateRangeControl | null;
  selectedPeriods: DayPeriod[];
  chartType: GatewayChartType;
}

function escAttr(s: string): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

async function fetchLatencyHistory(source: GatewayModalSourceConfig, id: string, startTs: number, endTs: number): Promise<GatewayLatencyPoint[]> {
  if (source.onFetchLatencyHistory) return source.onFetchLatencyHistory({ id, startTs, endTs });
  if (!source.baseUrl) {
    throw new Error('[GatewayModal] requires either `source.baseUrl` or `source.onFetchLatencyHistory`');
  }
  const path = (source.path || '/admin/orchestrator-devices/api/centrals/:id/latency').replace(':id', encodeURIComponent(id));
  const base = source.baseUrl.replace(/\/$/, '');
  const sep = path.includes('?') ? '&' : '?';
  const url = `${base}${path}${sep}start=${encodeURIComponent(new Date(startTs).toISOString())}&end=${encodeURIComponent(
    new Date(endTs).toISOString()
  )}`;
  const res = await fetch(url, source.fetchOptions);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ============================================================================
// Main Function
// ============================================================================

/** Opens a probe-latency history modal for a single central/gateway. */
export async function openGatewayModal(params: GatewayModalParams): Promise<GatewayModalInstance> {
  const modalId = `myio-gwmodal-${Date.now()}`;

  const now = Date.now();
  const defaultStartTs = now - 30 * 86400000;
  const startTs = params.startDate ? new Date(params.startDate).getTime() : defaultStartTs;
  const endTs = params.endDate ? new Date(params.endDate).getTime() : now;

  const state: ModalState = {
    id: params.id,
    label: params.name,
    source: params.source,
    currentLatencyMs: params.currentLatencyMs ?? null,
    targetLatencyMs: params.targetLatencyMs ?? null,
    startTs,
    endTs,
    granularity: params.granularity || 'hour',
    theme: params.theme || 'light',
    locale: params.locale || 'pt-BR',
    data: [],
    stats: { avg: null, min: null, max: null, count: 0, gaps: 0 },
    isLoading: true,
    dateRangePicker: null,
    selectedPeriods: ['madrugada', 'manha', 'tarde', 'noite'],
    chartType: 'line',
  };

  const savedGranularity = localStorage.getItem('myio-gwmodal-granularity') as GatewayGranularity;
  const savedTheme = localStorage.getItem('myio-gwmodal-theme') as 'dark' | 'light';
  const savedChartType = localStorage.getItem('myio-gwmodal-charttype') as GatewayChartType;
  if (savedGranularity) state.granularity = savedGranularity;
  if (savedTheme) state.theme = savedTheme;
  if (savedChartType && CHART_TYPES.some((t) => t.id === savedChartType)) state.chartType = savedChartType;

  const modalContainer = document.createElement('div');
  modalContainer.id = modalId;
  document.body.appendChild(modalContainer);

  renderModal(modalContainer, state, modalId, params.labels || {}, params.language ?? 'pt');

  try {
    state.data = await fetchLatencyHistory(state.source, state.id, state.startTs, state.endTs);
    state.stats = calculateLatencyStats(state.data);
    state.isLoading = false;
    renderModal(modalContainer, state, modalId, params.labels || {}, params.language ?? 'pt');
    drawChart(modalId, state);
  } catch (error) {
    console.error('[GatewayModal] Error fetching data:', error);
    state.isLoading = false;
    renderModal(modalContainer, state, modalId, params.labels || {}, params.language ?? 'pt', error as Error);
  }

  await setupEventListeners(modalContainer, state, modalId, params.labels || {}, params.language ?? 'pt', params.container ? undefined : undefined);

  return {
    close: () => {
      modalContainer.remove();
    },
    updateData: async (startDate: string, endDate: string, granularity?: GatewayGranularity) => {
      state.startTs = new Date(startDate).getTime();
      state.endTs = new Date(endDate).getTime();
      if (granularity) state.granularity = granularity;
      state.isLoading = true;
      renderModal(modalContainer, state, modalId, params.labels || {}, params.language ?? 'pt');

      try {
        state.data = await fetchLatencyHistory(state.source, state.id, state.startTs, state.endTs);
        state.stats = calculateLatencyStats(state.data);
        state.isLoading = false;
        renderModal(modalContainer, state, modalId, params.labels || {}, params.language ?? 'pt');
        drawChart(modalId, state);
      } catch (error) {
        console.error('[GatewayModal] Error updating data:', error);
        state.isLoading = false;
        renderModal(modalContainer, state, modalId, params.labels || {}, params.language ?? 'pt', error as Error);
      }
    },
  };
}

// ============================================================================
// Rendering
// ============================================================================

function renderModal(
  container: HTMLElement,
  state: ModalState,
  modalId: string,
  l: GatewayModalLabels,
  language: 'pt' | 'en',
  error?: Error
): void {
  const colors = getGatewayThemeColors(state.theme);
  const startDateStr = new Date(state.startTs).toLocaleDateString(state.locale);
  const endDateStr = new Date(state.endTs).toLocaleDateString(state.locale);

  const statusText = state.targetLatencyMs == null ? 'N/A' : (state.currentLatencyMs ?? Infinity) <= state.targetLatencyMs ? 'Dentro do SLA' : 'Acima do SLA';
  const statusColor = state.targetLatencyMs == null ? colors.textMuted : (state.currentLatencyMs ?? Infinity) <= state.targetLatencyMs ? colors.success : colors.danger;

  const targetText = state.targetLatencyMs !== null ? `${state.targetLatencyMs}ms` : 'Não definido';

  const uptime = calculateUptimeStats(state.stats, state.startTs, state.endTs);
  const uptimeColor = !uptime.hasData
    ? colors.textMuted
    : uptime.onlinePercent >= 99
    ? colors.success
    : uptime.onlinePercent >= 95
    ? colors.warning
    : colors.danger;

  const isMaximized = (container as any).__isMaximized || false;
  const contentMaxWidth = isMaximized ? '100%' : '900px';
  const contentMaxHeight = isMaximized ? '100vh' : '95vh';
  const contentBorderRadius = isMaximized ? '0' : '10px';

  const title = (l.title || (language === 'en' ? '{name} - Connectivity History' : '{name} - Histórico de Conectividade')).replace(
    '{name}',
    state.label
  );

  container.innerHTML = `
    <div class="myio-gwmodal-overlay myio-modal-scope" style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); z-index: 9998;
      display: flex; justify-content: center; align-items: center;
      backdrop-filter: blur(2px);
    ">
      <div class="myio-gwmodal-content" style="
        background: ${colors.surface}; border-radius: ${contentBorderRadius};
        max-width: ${contentMaxWidth}; width: ${isMaximized ? '100%' : '95%'};
        max-height: ${contentMaxHeight}; height: ${isMaximized ? '100%' : 'auto'};
        overflow: hidden; display: flex; flex-direction: column;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: 'Nunito', system-ui, sans-serif;
      ">
        ${ModalHeader.generateInlineHTML({
          icon: '📊',
          title: escAttr(title),
          modalId,
          theme: state.theme,
          isMaximized,
          showThemeToggle: true,
          showMaximize: true,
          showClose: true,
          primaryColor: '#3e1a7d',
          borderRadius: '10px 10px 0 0',
          draggable: false,
        })}

        <div style="flex: 1; overflow-y: auto; padding: 16px;">

        <!-- Controls Row -->
        <div style="
          display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end;
          margin-bottom: 16px; padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f7f7f7'};
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

        <!-- Stats Cards -->
        <div style="
          display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px; margin-bottom: 16px;
        ">
          <div style="
            padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
            border-radius: 12px; border: 1px solid ${colors.border};
          ">
            <span style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500;">Latência Atual</span>
            <div style="font-weight: 700; font-size: 24px; color: ${statusColor}; margin-top: 4px;">
              ${state.currentLatencyMs !== null ? formatLatency(state.currentLatencyMs) : 'N/A'}
            </div>
            <div style="font-size: 11px; color: ${statusColor}; margin-top: 2px;">${statusText}</div>
          </div>
          <div style="
            padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
            border-radius: 12px; border: 1px solid ${colors.border};
          ">
            <span style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500;">Média do Período</span>
            <div style="font-weight: 600; font-size: 20px; color: ${colors.text}; margin-top: 4px;">
              ${state.stats.count > 0 ? formatLatency(state.stats.avg) : 'N/A'}
            </div>
            <div style="font-size: 11px; color: ${colors.textMuted}; margin-top: 2px;">${startDateStr} - ${endDateStr}</div>
          </div>
          <div style="
            padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
            border-radius: 12px; border: 1px solid ${colors.border};
          ">
            <span style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500;">Min / Max</span>
            <div style="font-weight: 600; font-size: 20px; color: ${colors.text}; margin-top: 4px;">
              ${state.stats.count > 0 ? `${formatLatency(state.stats.min)} / ${formatLatency(state.stats.max)}` : 'N/A'}
            </div>
            <div style="font-size: 11px; color: ${colors.textMuted}; margin-top: 2px;">${state.stats.count} leituras${state.stats.gaps > 0 ? ` · ${state.stats.gaps} falhas` : ''}</div>
          </div>
          <div style="
            padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
            border-radius: 12px; border: 1px solid ${colors.border};
          ">
            <span style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500;">Alvo (SLA)</span>
            <div style="font-weight: 600; font-size: 20px; color: ${colors.success}; margin-top: 4px;">
              ${targetText}
            </div>
          </div>
          <div style="
            padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
            border-radius: 12px; border: 1px solid ${colors.border};
          ">
            <span style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500;">Disponibilidade</span>
            <div style="font-weight: 700; font-size: 20px; color: ${uptimeColor}; margin-top: 4px;">
              ${uptime.hasData ? `${uptime.onlinePercent.toFixed(1)}% online` : 'N/A'}
            </div>
            <div style="font-size: 11px; color: ${colors.textMuted}; margin-top: 2px;">
              ${uptime.hasData ? `${formatHours(uptime.offlineHours)} offline (${uptime.offlinePercent.toFixed(1)}%)` : 'Sem dados no período'}
            </div>
          </div>
        </div>

        <!-- Chart Container -->
        <div style="margin-bottom: 20px;">
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
            height: 320px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#fafafa'};
            border-radius: 12px; display: flex; justify-content: center; align-items: center;
            border: 1px solid ${colors.border}; position: relative;
          ">
            ${
              state.isLoading
                ? `<div style="text-align: center; color: ${colors.textMuted};">
                     <div style="animation: spin 1s linear infinite; font-size: 32px; margin-bottom: 8px;">↻</div>
                     <div>Carregando dados...</div>
                   </div>`
                : error
                ? `<div style="text-align: center; color: ${colors.danger};">
                     <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
                     <div>Erro ao carregar dados</div>
                     <div style="font-size: 12px; margin-top: 4px;">${escAttr(error.message)}</div>
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
            font-family: 'Nunito', system-ui, sans-serif;
          " ${state.data.length === 0 ? 'disabled' : ''}>
            📥 Exportar CSV
          </button>
          <button id="${modalId}-export-pdf" style="
            background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f7f7f7'};
            color: ${colors.text}; border: 1px solid ${colors.border};
            padding: 8px 16px; border-radius: 6px; cursor: pointer;
            font-size: 14px; display: flex; align-items: center; gap: 8px;
            font-family: 'Nunito', system-ui, sans-serif;
          " ${state.data.length === 0 ? 'disabled' : ''}>
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
      #${modalId} .myio-gwmodal-content > div:first-child button:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
      }

      /* DateRangePicker styles */
      ${CSS_TOKENS}
      ${DATERANGEPICKER_STYLES}

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
  x: number; // timestamp
  y: number | null; // latency value — null = a gap (probe failure / no reading)
  screenX: number;
  screenY: number;
  label?: string;
}

function drawChart(modalId: string, state: ModalState): void {
  const chartContainer = document.getElementById(`${modalId}-chart`);
  const canvas = document.getElementById(`${modalId}-canvas`) as HTMLCanvasElement;
  if (!chartContainer || !canvas || state.data.length === 0) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const colors = getGatewayThemeColors(state.theme);

  if (state.chartType === 'pie') {
    drawUptimePie(canvas, chartContainer, calculateUptimeStats(state.stats, state.startTs, state.endTs), colors);
    return;
  }

  const filteredData = filterByDayPeriods(state.data, state.selectedPeriods);

  if (filteredData.length === 0) {
    canvas.width = chartContainer.clientWidth;
    canvas.height = chartContainer.clientHeight;
    ctx.fillStyle = colors.textMuted;
    ctx.font = '14px Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhum dado para os períodos selecionados', canvas.width / 2, canvas.height / 2);
    return;
  }

  let chartData: ChartPoint[];

  // NOTE: gaps (`latencyMs`/`avg` === null — a failed/missing probe reading)
  // are kept in the array on purpose, not filtered out — that's what lets
  // the line break and the gap-shading band below actually show a visual
  // "hole" instead of silently interpolating straight across the outage.
  if (state.granularity === 'hour') {
    const interpolated = interpolateLatency(filteredData, {
      intervalMinutes: 30,
      startTs: state.startTs,
      endTs: state.endTs,
    });
    const filteredInterpolated = filterByDayPeriods(interpolated, state.selectedPeriods);
    chartData = filteredInterpolated.map((item) => ({ x: Date.parse(item.ts), y: item.latencyMs, screenX: 0, screenY: 0 }));
  } else {
    const daily = aggregateByDay(filteredData);
    chartData = daily.map((item) => ({ x: item.dateTs, y: item.avg, screenX: 0, screenY: 0, label: item.date }));
  }

  if (chartData.length === 0) return;

  const width = chartContainer.clientWidth - 2;
  const height = 320;
  canvas.width = width;
  canvas.height = height;

  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 55;

  const isPeriodsFiltered = state.selectedPeriods.length < 4 && state.selectedPeriods.length > 0;

  const values = chartData.map((d) => d.y).filter((v): v is number => v != null);

  if (values.length === 0) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colors.textMuted;
    ctx.font = '14px Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Todas as leituras falharam no período', width / 2, height / 2);
    return;
  }

  const dataMin = Math.min(0, ...values);
  const dataMax = Math.max(...values);

  const thresholdMax = state.targetLatencyMs !== null ? state.targetLatencyMs : dataMax;

  const minY = Math.min(dataMin, 0);
  const maxY = Math.max(dataMax, thresholdMax) + Math.max(1, Math.round((dataMax - dataMin) * 0.1));

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const scaleY = chartHeight / (maxY - minY || 1);
  const baselineY = height - paddingBottom - (0 - minY) * scaleY;

  if (isPeriodsFiltered) {
    const pointSpacing = chartWidth / Math.max(1, chartData.length - 1);
    chartData.forEach((point, index) => {
      point.screenX = paddingLeft + index * pointSpacing;
      point.screenY = point.y == null ? NaN : height - paddingBottom - (point.y - minY) * scaleY;
    });
  } else {
    const minX = chartData[0].x;
    const maxX = chartData[chartData.length - 1].x;
    const timeRange = maxX - minX || 1;
    const scaleX = chartWidth / timeRange;
    chartData.forEach((point) => {
      point.screenX = paddingLeft + (point.x - minX) * scaleX;
      point.screenY = point.y == null ? NaN : height - paddingBottom - (point.y - minY) * scaleY;
    });
  }

  ctx.clearRect(0, 0, width, height);

  // Gap shading — a contiguous run of failed/missing readings gets a subtle
  // shaded band behind the grid, so the "hole" reads at a glance even before
  // noticing the broken line. Runs shorter than 2 points still get a thin
  // sliver (Math.max floor) so a single dropped reading isn't invisible.
  ctx.fillStyle = state.theme === 'dark' ? 'rgba(248,113,113,0.10)' : 'rgba(220,38,38,0.08)';
  let gapStart: number | null = null;
  for (let i = 0; i <= chartData.length; i++) {
    const isGap = i < chartData.length && chartData[i].y == null;
    if (isGap && gapStart === null) gapStart = i;
    if (!isGap && gapStart !== null) {
      const x1 = chartData[gapStart].screenX;
      const x2 = chartData[i - 1].screenX;
      ctx.fillRect(x1 - 2, paddingTop, Math.max(4, x2 - x1 + 4), chartHeight);
      gapStart = null;
    }
  }

  // Horizontal grid lines
  ctx.strokeStyle = colors.chartGrid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
  }

  // SLA target line + "at risk" band above it
  if (state.targetLatencyMs !== null) {
    const targetY = height - paddingBottom - (state.targetLatencyMs - minY) * scaleY;
    ctx.fillStyle = 'rgba(244, 67, 54, 0.08)';
    ctx.fillRect(paddingLeft, paddingTop, chartWidth, targetY - paddingTop);
    ctx.strokeStyle = colors.danger;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, targetY);
    ctx.lineTo(width - paddingRight, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // The metric itself — branches by chart type. Bar/line/smooth/area all
  // skip null points outright (no bar, a broken line segment), which is
  // exactly what makes the gap read as a hole instead of a smoothed-over dip.
  if (state.chartType === 'bar') {
    const barWidth = Math.max(2, (chartWidth / chartData.length) * 0.6);
    ctx.fillStyle = colors.chartLine;
    chartData.forEach((point) => {
      if (point.y == null) return;
      ctx.fillRect(point.screenX - barWidth / 2, Math.min(point.screenY, baselineY), barWidth, Math.abs(baselineY - point.screenY));
    });
  } else {
    if (state.chartType === 'area') {
      let segStart = -1;
      for (let i = 0; i <= chartData.length; i++) {
        const isValid = i < chartData.length && chartData[i].y != null;
        if (isValid && segStart === -1) segStart = i;
        if ((!isValid || i === chartData.length) && segStart !== -1) {
          const segEnd = i - 1;
          if (segEnd > segStart) {
            ctx.beginPath();
            ctx.moveTo(chartData[segStart].screenX, baselineY);
            for (let j = segStart; j <= segEnd; j++) ctx.lineTo(chartData[j].screenX, chartData[j].screenY);
            ctx.lineTo(chartData[segEnd].screenX, baselineY);
            ctx.closePath();
            ctx.fillStyle = colors.fill;
            ctx.fill();
          }
          segStart = -1;
        }
      }
    }

    ctx.strokeStyle = colors.chartLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let drawing = false;
    chartData.forEach((point) => {
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
      ctx.fillStyle = colors.chartLine;
      chartData.forEach((point) => {
        if (point.y == null) return;
        ctx.beginPath();
        ctx.arc(point.screenX, point.screenY, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  // Y axis labels
  ctx.fillStyle = colors.textMuted;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = minY + ((maxY - minY) * (4 - i)) / 4;
    const y = paddingTop + (chartHeight * i) / 4;
    ctx.fillText(`${val.toFixed(0)}ms`, paddingLeft - 8, y + 4);
  }

  // X axis labels
  ctx.textAlign = 'center';
  const numLabels = Math.min(8, chartData.length);
  const labelInterval = Math.max(1, Math.floor(chartData.length / numLabels));

  for (let i = 0; i < chartData.length; i += labelInterval) {
    const point = chartData[i];
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

  setupChartTooltip(canvas, chartContainer, chartData.filter((p) => p.y != null), state, colors);
}

/** Pie mode: online vs offline proportion (same `calculateUptimeStats` as the "Disponibilidade" stat card) — the one chart type that isn't a time series. */
function drawUptimePie(canvas: HTMLCanvasElement, container: HTMLElement, uptime: GatewayUptimeStats, colors: GatewayThemeColors): void {
  const width = container.clientWidth - 2;
  const height = 320;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);

  if (!uptime.hasData) {
    ctx.fillStyle = colors.textMuted;
    ctx.font = '14px Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados suficientes para estimar disponibilidade', width / 2, height / 2);
    return;
  }

  const cx = width * 0.35;
  const cy = height / 2;
  const r = Math.max(10, Math.min(cy, cx) - 30);

  const slices = [
    { value: uptime.onlinePercent, color: colors.primary, label: `Online — ${uptime.onlinePercent.toFixed(1)}%` },
    { value: uptime.offlinePercent, color: colors.danger, label: `Offline — ${uptime.offlinePercent.toFixed(1)}%` },
  ];
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;

  let startAngle = -Math.PI / 2;
  slices.forEach((slice) => {
    if (slice.value <= 0) return;
    const angle = (slice.value / total) * Math.PI * 2;
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
  ctx.fillText(`${formatHours(uptime.totalHours)} no total`, cx, cy + r + 20);
}

// ============================================================================
// Tooltip
// ============================================================================

function setupChartTooltip(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  chartData: ChartPoint[],
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
    min-width: 140px;
  `;
  container.appendChild(tooltip);

  const findNearestPoint = (mouseX: number, mouseY: number): ChartPoint | null => {
    const threshold = 20;
    let nearest: ChartPoint | null = null;
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
        <div style="font-weight: 600; margin-bottom: 6px; color: ${colors.primary};">
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

async function setupEventListeners(
  container: HTMLElement,
  state: ModalState,
  modalId: string,
  l: GatewayModalLabels,
  language: 'pt' | 'en',
  onClose?: () => void
): Promise<void> {
  const closeModal = () => {
    container.remove();
    onClose?.();
  };

  container.querySelector('.myio-gwmodal-overlay')?.addEventListener('click', (e) => {
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
        maxRangeDays: state.source.maxRangeDays ?? 365,
        locale: state.locale as 'pt-BR' | 'en-US',
        parentEl: container.querySelector('.myio-gwmodal-content') as HTMLElement,
        onApply: (result) => {
          state.startTs = new Date(result.startISO).getTime();
          state.endTs = new Date(result.endISO).getTime();
          console.log('[GatewayModal] Date range applied:', result);
        },
      });
    } catch (error) {
      console.warn('[GatewayModal] DateRangePicker initialization failed:', error);
    }
  }

  document.getElementById(`${modalId}-theme-toggle`)?.addEventListener('click', async () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('myio-gwmodal-theme', state.theme);
    state.dateRangePicker = null;
    renderModal(container, state, modalId, l, language);
    if (state.data.length > 0) drawChart(modalId, state);
    await setupEventListeners(container, state, modalId, l, language, onClose);
  });

  document.getElementById(`${modalId}-maximize`)?.addEventListener('click', async () => {
    (container as any).__isMaximized = !(container as any).__isMaximized;
    state.dateRangePicker = null;
    renderModal(container, state, modalId, l, language);
    if (state.data.length > 0) drawChart(modalId, state);
    await setupEventListeners(container, state, modalId, l, language, onClose);
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
      if (state.data.length > 0) drawChart(modalId, state);
    });
  });

  document.getElementById(`${modalId}-period-select-all`)?.addEventListener('click', () => {
    periodCheckboxes.forEach((cb: Element) => {
      (cb as HTMLInputElement).checked = true;
    });
    state.selectedPeriods = ['madrugada', 'manha', 'tarde', 'noite'];
    const btnLabel = periodBtn?.querySelector('span:first-child');
    if (btnLabel) btnLabel.textContent = getSelectedPeriodsLabel(state.selectedPeriods);
    if (state.data.length > 0) drawChart(modalId, state);
  });

  document.getElementById(`${modalId}-period-clear`)?.addEventListener('click', () => {
    periodCheckboxes.forEach((cb: Element) => {
      (cb as HTMLInputElement).checked = false;
    });
    state.selectedPeriods = [];
    const btnLabel = periodBtn?.querySelector('span:first-child');
    if (btnLabel) btnLabel.textContent = getSelectedPeriodsLabel(state.selectedPeriods);
    if (state.data.length > 0) drawChart(modalId, state);
  });

  document.getElementById(`${modalId}-granularity`)?.addEventListener('change', (e) => {
    state.granularity = (e.target as HTMLSelectElement).value as GatewayGranularity;
    localStorage.setItem('myio-gwmodal-granularity', state.granularity);
    if (state.data.length > 0) drawChart(modalId, state);
  });

  CHART_TYPES.forEach((t) => {
    document.getElementById(`${modalId}-charttype-${t.id}`)?.addEventListener('click', async () => {
      if (state.chartType === t.id) return;
      state.chartType = t.id;
      localStorage.setItem('myio-gwmodal-charttype', state.chartType);
      state.dateRangePicker = null;
      renderModal(container, state, modalId, l, language);
      if (state.data.length > 0) drawChart(modalId, state);
      await setupEventListeners(container, state, modalId, l, language, onClose);
    });
  });

  document.getElementById(`${modalId}-query`)?.addEventListener('click', async () => {
    if (state.startTs >= state.endTs) {
      alert('Por favor, selecione um período válido');
      return;
    }

    state.isLoading = true;
    state.dateRangePicker = null;
    renderModal(container, state, modalId, l, language);

    try {
      state.data = await fetchLatencyHistory(state.source, state.id, state.startTs, state.endTs);
      state.stats = calculateLatencyStats(state.data);
      state.isLoading = false;
      renderModal(container, state, modalId, l, language);
      drawChart(modalId, state);
      await setupEventListeners(container, state, modalId, l, language, onClose);
    } catch (error) {
      console.error('[GatewayModal] Error fetching data:', error);
      state.isLoading = false;
      renderModal(container, state, modalId, l, language, error as Error);
      await setupEventListeners(container, state, modalId, l, language, onClose);
    }
  });

  document.getElementById(`${modalId}-export`)?.addEventListener('click', () => {
    if (state.data.length === 0) return;
    const startDateStr = new Date(state.startTs).toLocaleDateString(state.locale).replace(/\//g, '-');
    const endDateStr = new Date(state.endTs).toLocaleDateString(state.locale).replace(/\//g, '-');
    exportLatencyCSV(state.data, state.label, state.stats, startDateStr, endDateStr);
  });

  document.getElementById(`${modalId}-export-pdf`)?.addEventListener('click', () => {
    if (state.data.length === 0) return;
    const startDateStr = new Date(state.startTs).toLocaleDateString(state.locale).replace(/\//g, '-');
    const endDateStr = new Date(state.endTs).toLocaleDateString(state.locale).replace(/\//g, '-');
    const canvas = document.getElementById(`${modalId}-canvas`) as HTMLCanvasElement | null;
    exportGatewayPdf({
      label: state.label,
      startDateStr,
      endDateStr,
      startTs: state.startTs,
      endTs: state.endTs,
      stats: state.stats,
      uptime: calculateUptimeStats(state.stats, state.startTs, state.endTs),
      currentLatencyMs: state.currentLatencyMs,
      targetLatencyMs: state.targetLatencyMs,
      chartCanvas: canvas,
    });
  });
}
