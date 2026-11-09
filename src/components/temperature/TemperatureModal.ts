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
  aggregateByMinutes,
  aggregateByDay,
  buildDayTicks,
  formatTemperature,
  formatDateLabel,
  getThemeColors,
  getTodaySoFar,
  filterByDayPeriods,
  getSelectedPeriodsLabel,
  DEFAULT_CLAMP_RANGE,
  DEFAULT_TEMPERATURE_OFFSET,
  DAY_PERIODS,
  type TemperatureTelemetry,
  type TemperatureStats,
  type DailyTemperatureStats,
  type ClampRange,
  type TemperatureGranularity,
  type ThemeColors,
  type DayPeriod
} from './utils';

import {
  DEFAULT_CURRENT_TEMPERATURE_MAX_AGE_MINUTES,
  fetchIngestionLatestTemperature,
  fetchThingsboardLatestTemperature,
  makeTemperatureValidator,
  resolveCurrentTemperature,
  type ResolvedCurrentTemperature,
  type TemperatureAggregateFetcher,
} from './currentTemperature';

import { createDateRangePicker, type DateRangeControl } from '../createDateRangePicker';
import { CSS_TOKENS, DATERANGEPICKER_STYLES } from '../premium-modals/internal/styles/tokens';
import { ModalHeader } from '../../utils/ModalHeader';
import { createModalFooter, type ModalFooterInstance } from '../premium-modals/footer-modal';

// ============================================================================
// Types
// ============================================================================

/** Granularidade da modal: 15 min / 30 min / hora (média da janela fechada) ou dia (média do dia) */
export type TemperatureModalGranularity = '15min' | '30min' | TemperatureGranularity;

const GRANULARITY_MINUTES: Partial<Record<TemperatureModalGranularity, number>> = {
  '15min': 15,
  '30min': 30,
  hour: 60,
};
const GRANULARITY_LABEL: Record<TemperatureModalGranularity, string> = {
  '15min': '15 minutos',
  '30min': '30 minutos',
  hour: 'Hora',
  day: 'Dia (média)',
};

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
  /** Temperature offset to apply to all values (can be positive or negative) */
  temperatureOffset?: number;
  /** Container element or selector */
  container?: HTMLElement | string;
  /** Callback when modal closes */
  onClose?: () => void;
  /** Locale for formatting */
  locale?: 'pt-BR' | 'en-US';
  /** Outlier clamping range */
  clampRange?: ClampRange;
  /** Initial granularity */
  granularity?: TemperatureModalGranularity;
  /** Initial theme */
  theme?: 'dark' | 'light';
  /** IANA timezone string (e.g., 'America/Sao_Paulo'). Defaults to local timezone. */
  timezone?: string;
  /**
   * Optional custom data fetcher. When provided, replaces the default ThingsBoard API fetch.
   * Receives (startTs, endTs) in Unix ms; must return TemperatureTelemetry[].
   * Use this to fetch from an alternative source (e.g., Data Apps ingestion API).
   */
  dataFetcher?: (startTs: number, endTs: number) => Promise<TemperatureTelemetry[]>;
  /**
   * Busca agregada em janelas (15/30/60 min) — ex.: `createIngestionTemperatureAggregateFetcher`
   * (Ingestion /temperature-readings/aggregate). Usada nas granularidades 15 e 30 min e para achar a
   * leitura mais recente fora do período filtrado. Sem ela, 15/30 min são agregados localmente da
   * série bruta do ThingsBoard (e ficam indisponíveis quando há `dataFetcher` horário).
   */
  aggregateFetcher?: TemperatureAggregateFetcher;
  /**
   * "Temperatura Atual": a última leitura do ThingsBoard só vale se tiver no máximo estes minutos;
   * senão usa a última do Ingestion e, por fim, a última do ThingsBoard (antiga). Padrão 120.
   */
  currentTemperatureMaxAgeMinutes?: number;
  /** Nome do device no ThingsBoard — header (fonte sutil + botão copiar), padrão dos relatórios */
  deviceName?: string;
  /** Customer/shopping — footer premium (padrão AllReport/DeviceReport) */
  customerName?: string;
  /** Paleta do dashboard (createMyIOTheme ou mapa de CSS vars) — cor do header/botões */
  palette?: { cssVars(): Record<string, string> } | Record<string, string>;
}

export interface TemperatureModalInstance {
  /** Destroys the modal */
  destroy: () => void;
  /** Updates data with new date range */
  updateData: (startDate: string, endDate: string, granularity?: TemperatureModalGranularity) => Promise<void>;
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
  temperatureOffset: number;
  startTs: number;
  endTs: number;
  granularity: TemperatureModalGranularity;
  theme: 'dark' | 'light';
  clampRange: ClampRange;
  locale: string;
  timezone: string;
  data: TemperatureTelemetry[];
  stats: TemperatureStats;
  isLoading: boolean;
  dateRangePicker: DateRangeControl | null;
  selectedPeriods: DayPeriod[];
  dataFetcher: ((startTs: number, endTs: number) => Promise<TemperatureTelemetry[]>) | null;
  aggregateFetcher: TemperatureAggregateFetcher | null;
  /** 'raw' (dataFetcher/TB) ou 'agg:<min>' (aggregateFetcher) — de onde veio state.data */
  dataMode: string;
  currentMaxAgeMinutes: number;
  /** Leitura mais recente resolvida (independe do período); null = usa currentTemperature do card */
  current: ResolvedCurrentTemperature | null;
  deviceName: string;
  customerName: string;
  accent: string;
}

// Footer premium por modal (recriado a cada render — o conteúdo é re-renderizado via innerHTML)
const _footers = new Map<string, ModalFooterInstance>();

function escHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Cor de destaque do dashboard (mesma do header de AllReport/DeviceReport); default roxo MYIO
function resolveAccent(palette: TemperatureModalParams['palette']): string {
  const fallback = '#3e1a7d';
  if (!palette) return fallback;
  const vars =
    typeof (palette as { cssVars?: () => Record<string, string> }).cssVars === 'function'
      ? (palette as { cssVars(): Record<string, string> }).cssVars()
      : (palette as Record<string, string>);
  const accent = (palette as { accent?: string }).accent || vars?.['--myio-brand-700'];
  return typeof accent === 'string' && accent ? accent : fallback;
}

function resolveCustomerName(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof window === 'undefined') return '';
  const w = window as { MyIOOrchestrator?: { customerName?: string }; MyIOUtils?: { customerName?: string } };
  return w.MyIOOrchestrator?.customerName || w.MyIOUtils?.customerName || '';
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

  // Default timezone to America/Sao_Paulo if not provided
  const timezone = params.timezone || 'America/Sao_Paulo';

  // Default to "Today So Far" if dates not provided (respecting timezone)
  const defaultDateRange = getTodaySoFar(timezone);
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
    temperatureOffset: params.temperatureOffset ?? DEFAULT_TEMPERATURE_OFFSET,
    startTs,
    endTs,
    granularity: params.granularity || 'hour',
    theme: params.theme || 'light',
    clampRange: params.clampRange || DEFAULT_CLAMP_RANGE,
    locale: params.locale || 'pt-BR',
    timezone,
    data: [],
    stats: { avg: 0, min: 0, max: 0, count: 0 },
    isLoading: true,
    dateRangePicker: null,
    selectedPeriods: ['madrugada', 'manha', 'tarde', 'noite'], // All periods selected by default
    dataFetcher: params.dataFetcher ?? null,
    aggregateFetcher: params.aggregateFetcher ?? null,
    dataMode: '',
    currentMaxAgeMinutes:
      Number(params.currentTemperatureMaxAgeMinutes) > 0
        ? Number(params.currentTemperatureMaxAgeMinutes)
        : DEFAULT_CURRENT_TEMPERATURE_MAX_AGE_MINUTES,
    current: null,
    deviceName: params.deviceName || '',
    customerName: resolveCustomerName(params.customerName),
    accent: resolveAccent(
      params.palette ??
        (typeof window !== 'undefined'
          ? ((window as { MyIOUtils?: { theme?: TemperatureModalParams['palette'] } }).MyIOUtils?.theme)
          : undefined)
    ),
  };

  // Log if offset is applied
  if (state.temperatureOffset !== 0) {
    console.log(`[TemperatureModal] Applying temperature offset: ${state.temperatureOffset}°C`);
  }

  // Load saved preferences
  const savedGranularity = localStorage.getItem('myio-temp-modal-granularity') as TemperatureModalGranularity;
  const savedTheme = localStorage.getItem('myio-temp-modal-theme') as 'dark' | 'light';
  if (savedGranularity && savedGranularity in GRANULARITY_LABEL) state.granularity = savedGranularity;
  if (!isGranularityAvailable(state, state.granularity)) state.granularity = 'hour';
  // Tema pedido pelo chamador vence a preferência salva (senão um toggle antigo p/ dark grudava)
  if (savedTheme && !params.theme) state.theme = savedTheme;

  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.id = modalId;
  document.body.appendChild(modalContainer);

  // Render modal
  renderModal(modalContainer, state, modalId);

  // Fetch initial data (+ leitura mais recente, independente do período)
  try {
    await Promise.all([loadSeries(state), refreshCurrent(state)]);
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
      _footers.get(modalId)?.destroy();
      _footers.delete(modalId);
      modalContainer.remove();
      params.onClose?.();
    },
    updateData: async (startDate: string, endDate: string, granularity?: TemperatureModalGranularity) => {
      state.startTs = new Date(startDate).getTime();
      state.endTs = new Date(endDate).getTime();
      if (granularity && isGranularityAvailable(state, granularity)) state.granularity = granularity;
      state.isLoading = true;
      renderModal(modalContainer, state, modalId);

      try {
        await Promise.all([loadSeries(state), refreshCurrent(state)]);
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
// Data loading
// ============================================================================

/** 15/30 min exigem agregado (Ingestion) ou série bruta do TB — não dá pra tirar de série horária */
function isGranularityAvailable(state: ModalState, g: TemperatureModalGranularity): boolean {
  const m = GRANULARITY_MINUTES[g];
  if (!m || m >= 60) return true;
  return !!state.aggregateFetcher || !state.dataFetcher;
}

/** De onde vem a série para a granularidade atual: agregado do Ingestion (15/30 min) ou bruto */
function dataModeFor(state: ModalState): string {
  const m = GRANULARITY_MINUTES[state.granularity];
  return m && m < 60 && state.aggregateFetcher ? `agg:${m}` : 'raw';
}

/** Carrega a série do período conforme a granularidade e recalcula os cards */
async function loadSeries(state: ModalState): Promise<void> {
  const mode = dataModeFor(state);
  const raw =
    mode !== 'raw' && state.aggregateFetcher
      ? await state.aggregateFetcher(state.startTs, state.endTs, Number(mode.slice(4)))
      : await (state.dataFetcher
          ? state.dataFetcher(state.startTs, state.endTs)
          : fetchTemperatureData(state.token, state.deviceId, state.startTs, state.endTs));
  state.data = discardInvalid(raw || [], state);
  state.dataMode = mode;
  state.stats = calculateStats(state.data, state.clampRange, state.temperatureOffset);
}

/** "Temperatura Atual" = leitura mais recente do sensor, fora do período filtrado (nunca lança) */
async function refreshCurrent(state: ModalState): Promise<void> {
  try {
    const isValid = makeTemperatureValidator(state.clampRange, state.temperatureOffset);
    const latestSource: TemperatureAggregateFetcher | null =
      state.aggregateFetcher ?? (state.dataFetcher ? (s, e) => state.dataFetcher!(s, e) : null);
    state.current = await resolveCurrentTemperature({
      maxAgeMinutes: state.currentMaxAgeMinutes,
      isValid,
      fetchThingsboardLatest:
        state.token && state.deviceId
          ? () => fetchThingsboardLatestTemperature(state.token, state.deviceId)
          : undefined,
      fetchIngestionLatest: latestSource
        ? () => fetchIngestionLatestTemperature(latestSource, Date.now(), undefined, isValid)
        : undefined,
    });
  } catch (err) {
    console.warn('[TemperatureModal] Temperatura atual indisponível:', err);
    state.current = null;
  }
}

function currentStatus(state: ModalState, value: number | null): 'ok' | 'above' | 'below' | null {
  if (value === null) return state.temperatureStatus;
  if (state.temperatureMin === null || state.temperatureMax === null) return state.temperatureStatus;
  return value > state.temperatureMax ? 'above' : value < state.temperatureMin ? 'below' : 'ok';
}

/** Valor exibido em "Temperatura Atual" (com offset quando vem da leitura resolvida) */
function displayedCurrent(state: ModalState): number | null {
  if (state.current) return state.current.value + (Number(state.temperatureOffset) || 0);
  return state.currentTemperature;
}

function currentSourceText(state: ModalState): string {
  const c = state.current;
  if (!c) return '';
  const src = c.source === 'thingsboard' ? 'ThingsBoard' : 'Ingestion';
  if (c.fresh) {
    const m = Math.round(c.ageMinutes);
    const age = m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
    return `${src} · ${age}`;
  }
  const when = new Date(c.ts).toLocaleString(state.locale, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: state.timezone || 'America/Sao_Paulo',
  });
  return `Última leitura ${when} (${src})`;
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

  // "Temperatura Atual": leitura mais recente resolvida (fora do período) ou, sem ela, a do card
  const currentValue = displayedCurrent(state);
  const status = currentStatus(state, state.current ? currentValue : null);
  const staleCurrent = !!state.current && !state.current.fresh;
  const statusText = (status === 'ok' ? 'Dentro da faixa' :
    status === 'above' ? 'Acima do limite' :
    status === 'below' ? 'Abaixo do limite' : 'N/A') + (staleCurrent ? ' (leitura antiga)' : '');
  const statusColor = staleCurrent ? colors.textMuted :
    status === 'ok' ? colors.success :
    status === 'above' ? colors.danger :
    status === 'below' ? colors.primary : colors.textMuted;
  const currentSource = currentSourceText(state);

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
        font-family: 'Nunito', system-ui, sans-serif;
      ">
        <!-- Header - MyIO Premium Style (via ModalHeader component) -->
        ${ModalHeader.generateInlineHTML({
          icon: '🌡️',
          title: buildHeaderTitle(state),
          modalId,
          theme: state.theme,
          isMaximized,
          showThemeToggle: true,
          showMaximize: true,
          showClose: true,
          primaryColor: state.accent,
          solid: true, // padrão dos relatórios: cor do dashboard também no tema light
          borderRadius: '10px 10px 0 0',
          draggable: false,
        })}

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
              ${(Object.keys(GRANULARITY_LABEL) as TemperatureModalGranularity[])
                .map((g) => {
                  const ok = isGranularityAvailable(state, g);
                  return `<option value="${g}" ${state.granularity === g ? 'selected' : ''} ${ok ? '' : 'disabled title="Indisponível para esta fonte de dados"'}>${GRANULARITY_LABEL[g]}</option>`;
                })
                .join('')}
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
                    style="width: 16px; height: 16px; cursor: pointer; accent-color: ${state.accent};">
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
            background: ${state.accent}; color: white; border: none;
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
          <!-- Current Temperature -->
          <div style="
            padding: 16px; background: ${state.theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa'};
            border-radius: 12px; border: 1px solid ${colors.border};
          ">
            <span style="color: ${colors.textMuted}; font-size: 12px; font-weight: 500;">Temperatura Atual</span>
            <div style="font-weight: 700; font-size: 24px; color: ${statusColor}; margin-top: 4px;">
              ${currentValue !== null ? formatTemperature(currentValue) : 'N/A'}
            </div>
            <div style="font-size: 11px; color: ${statusColor}; margin-top: 2px;">${statusText}</div>
            ${currentSource ? `<div style="font-size: 10px; color: ${colors.textMuted}; margin-top: 2px;">${escHtml(currentSource)}</div>` : ''}
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

        </div><!-- End Body -->
        <!-- Footer premium (customer · relógio · versão | Powered by MYIO | CSV) — padrão dos relatórios -->
        <div id="${modalId}-footer-slot"></div>
      </div>
    </div>
    <style>
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      #${modalId} select:focus, #${modalId} input:focus {
        outline: 2px solid ${state.accent};
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

  mountChrome(container, state, modalId);
}

// ============================================================================
// Chart Drawing
// ============================================================================

export interface ChartPoint {
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

  const windowMinutes = GRANULARITY_MINUTES[state.granularity];
  if (windowMinutes) {
    // Janela fechada (15/30/60 min): um ponto por janela = média das leituras dela (13:00 = 13:00–13:59)
    const series = aggregateByMinutes(filteredData, windowMinutes, state.clampRange, state.temperatureOffset);
    chartData = series.map(item => ({
      x: item.ts,
      y: Number(item.value),
      screenX: 0,
      screenY: 0
    }));
  } else {
    // Aggregate by day
    const daily = aggregateByDay(filteredData, state.clampRange, state.temperatureOffset);
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

  // Eixo X: período > 24 h → uma marca por dia à meia-noite (dd/mm), rareada p/ ≤ 8;
  // até 24 h → HH:mm a cada N pontos. (Antes: "a cada N pontos" em vários dias caía em horas
  // quebradas — 01/11 00:00, 02/11 01:00, 03/11 02:00…)
  ctx.textAlign = 'center';
  const tz = state.timezone || 'America/Sao_Paulo';
  for (const tick of buildXAxisTicks(chartData, state.granularity, tz, state.locale, isPeriodsFiltered, paddingLeft, chartWidth)) {
    ctx.strokeStyle = colors.chartGrid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tick.screenX, paddingTop);
    ctx.lineTo(tick.screenX, height - paddingBottom);
    ctx.stroke();

    ctx.fillStyle = colors.textMuted;
    ctx.fillText(tick.label, tick.screenX, height - paddingBottom + 18);
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

/**
 * Marcas do eixo X a partir dos pontos já posicionados (screenX calculado).
 * > 24 h: meia-noite de cada dia (dd/mm); posição por tempo, ou — com períodos do dia filtrados
 * (eixo por índice) — no primeiro ponto do dia. ≤ 24 h: HH:mm a cada N pontos (dd/mm em "Dia").
 */
export function buildXAxisTicks(
  chartData: ChartPoint[],
  granularity: TemperatureModalGranularity,
  timezone: string,
  locale: string,
  indexBased: boolean,
  paddingLeft: number,
  chartWidth: number
): { screenX: number; label: string; ts: number }[] {
  if (!chartData.length) return [];
  const minX = chartData[0].x;
  const maxX = chartData[chartData.length - 1].x;
  const dayLabel = (ts: number) =>
    new Date(ts).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: timezone });

  if (maxX - minX > 24 * 60 * 60 * 1000) {
    const range = maxX - minX || 1;
    const out: { screenX: number; label: string; ts: number }[] = [];
    const seen = new Set<number>();
    for (const ts of buildDayTicks(minX, maxX, timezone, 8)) {
      let screenX: number;
      if (indexBased) {
        const p = chartData.find((d) => d.x >= ts);
        if (!p) continue;
        screenX = p.screenX;
      } else {
        screenX = paddingLeft + ((ts - minX) / range) * chartWidth;
      }
      const key = Math.round(screenX);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ screenX, label: dayLabel(ts), ts });
    }
    return out;
  }

  const numLabels = Math.min(8, chartData.length);
  const interval = Math.max(1, Math.floor(chartData.length / numLabels));
  const out: { screenX: number; label: string; ts: number }[] = [];
  for (let i = 0; i < chartData.length; i += interval) {
    const p = chartData[i];
    const label =
      granularity === 'day'
        ? dayLabel(p.x)
        : new Date(p.x).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: timezone });
    out.push({ screenX: p.screenX, label, ts: p.x });
  }
  return out;
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
      if (state.granularity !== 'day') {
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
    _footers.get(modalId)?.destroy();
    _footers.delete(modalId);
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
  document.getElementById(`${modalId}-granularity`)?.addEventListener('change', async (e) => {
    const next = (e.target as HTMLSelectElement).value as TemperatureModalGranularity;
    if (!isGranularityAvailable(state, next)) return;
    state.granularity = next;
    localStorage.setItem('myio-temp-modal-granularity', state.granularity);
    // Mudou a fonte (agregado 15/30 min ↔ série bruta/horária) → busca de novo
    if (dataModeFor(state) !== state.dataMode) {
      state.isLoading = true;
      state.dateRangePicker = null;
      renderModal(container, state, modalId);
      try {
        await loadSeries(state);
        state.isLoading = false;
        renderModal(container, state, modalId);
        drawChart(modalId, state);
      } catch (error) {
        console.error('[TemperatureModal] Error fetching data:', error);
        state.isLoading = false;
        renderModal(container, state, modalId, error as Error);
      }
      await setupEventListeners(container, state, modalId, onClose);
      return;
    }
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
      await Promise.all([loadSeries(state), refreshCurrent(state)]);
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

  // Export CSV — botão no footer premium (mountFooter)
}

// Leituras fora da faixa válida (já com offset) são DESCARTADAS — mesmo critério dos
// relatórios e da comparação (antes eram "travadas" na borda da faixa)
function discardInvalid(data: TemperatureTelemetry[], state: ModalState): TemperatureTelemetry[] {
  const off = Number(state.temperatureOffset) || 0;
  return data.filter((p) => {
    const v = Number(p.value) + off;
    return Number.isFinite(v) && v >= state.clampRange.min && v <= state.clampRange.max;
  });
}

// CSV = o que a tela mostra: mesma granularidade (hora fechada / média do dia), mesmos
// períodos do dia, offset aplicado e os números dos cards no cabeçalho.
function exportCsv(state: ModalState): void {
  if (state.data.length === 0) return;
  const off = Number(state.temperatureOffset) || 0;
  const n2 = (v: number) => v.toFixed(2).replace('.', ',');
  const q = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const dt = (ts: number) =>
    new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: state.timezone || 'America/Sao_Paulo',
    });
  const fmtD = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { timeZone: state.timezone || 'America/Sao_Paulo' });
  const filtered = filterByDayPeriods(state.data, state.selectedPeriods);

  const lines: string[][] = [
    ['Relatório', `${state.label} - Histórico de Temperatura`],
    ...(state.deviceName ? [['Dispositivo (TB)', state.deviceName]] : []),
    ...(state.customerName ? [['Cliente', state.customerName]] : []),
    ['Período', `${fmtD(state.startTs)} — ${fmtD(state.endTs)}`],
    [
      'Granularidade',
      state.granularity === 'day'
        ? 'Dia (média do dia)'
        : `${GRANULARITY_LABEL[state.granularity]} (média da janela fechada)`,
    ],
    ['Períodos do dia', getSelectedPeriodsLabel(state.selectedPeriods)],
    ...(off !== 0 ? [['Offset aplicado (°C)', n2(off)]] : []),
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    [],
    ['Temperatura atual (°C)', displayedCurrent(state) !== null ? n2(displayedCurrent(state) as number) : 'N/A'],
    ...(state.current ? [['Origem da temperatura atual', currentSourceText(state)]] : []),
    ['Média do período (°C)', state.stats.count > 0 ? n2(state.stats.avg) : 'N/A'],
    ['Mínima (°C)', state.stats.count > 0 ? n2(state.stats.min) : 'N/A'],
    ['Máxima (°C)', state.stats.count > 0 ? n2(state.stats.max) : 'N/A'],
    ['Leituras', String(state.stats.count)],
    [],
  ];

  const csvMinutes = GRANULARITY_MINUTES[state.granularity];
  if (csvMinutes) {
    lines.push(['Data/Hora', 'Temperatura (°C)']);
    aggregateByMinutes(filtered, csvMinutes, state.clampRange, off).forEach((p) => lines.push([dt(p.ts), n2(Number(p.value))]));
  } else {
    lines.push(['Dia', 'Média (°C)', 'Mín (°C)', 'Máx (°C)', 'Leituras']);
    aggregateByDay(filtered, state.clampRange, off).forEach((d) =>
      lines.push([fmtD(d.dateTs), n2(d.avg), n2(d.min), n2(d.max), String(d.count)])
    );
  }

  const csv = '\uFEFF' + lines.map((r) => r.map(q).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const suffix = { '15min': '15min', '30min': '30min', hour: '1h', day: '1d' }[state.granularity];
  a.download = `temperatura_${state.label.replace(/\s+/g, '_')}_${suffix}_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Header no padrão dos relatórios: rótulo + nome do device (sutil, copiar) + offset (se aplicado)
function buildHeaderTitle(state: ModalState): string {
  const base = `${escHtml(state.label)} - Histórico de Temperatura`;
  const dev = state.deviceName
    ? `<span style="margin-left:10px;font-size:0.72em;font-weight:400;opacity:.75;display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">
         ${escHtml(state.deviceName)}
         <button type="button" class="myio-tm-copy" data-copy="${escHtml(state.deviceName)}" title="Copiar nome do dispositivo"
           aria-label="Copiar nome do dispositivo"
           style="border:none;background:transparent;color:inherit;cursor:pointer;padding:0 2px;line-height:1;display:inline-flex;">
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
         </button>
       </span>`
    : '';
  const off = Number(state.temperatureOffset) || 0;
  const offset =
    off !== 0
      ? `<span title="Offset do sensor aplicado a todas as leituras" style="margin-left:10px;font-size:0.68em;font-weight:400;opacity:.7;vertical-align:middle;">offset ${off > 0 ? '+' : '−'}${Math.abs(off).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} °C</span>`
      : '';
  return `${base}${dev}${offset}`;
}

// Pós-render: footer premium + botão copiar do header (o conteúdo é recriado a cada render)
function mountChrome(container: HTMLElement, state: ModalState, modalId: string): void {
  const slot = container.querySelector<HTMLElement>(`#${modalId}-footer-slot`);
  _footers.get(modalId)?.destroy();
  _footers.delete(modalId);
  if (slot) {
    const lib =
      typeof window !== 'undefined' ? (window as { MyIOLibrary?: { version?: string } }).MyIOLibrary : undefined;
    const footer = createModalFooter({
      customerName: state.customerName,
      libVersion: lib?.version ? { current: lib.version } : false,
      themeMode: state.theme === 'dark' ? 'dark' : 'light',
      exports: {
        csv: {
          onClick: () => exportCsv(state),
          disabled: state.data.length === 0,
          tooltipText: 'Exporta em CSV as leituras do período (offset aplicado)',
        },
      },
    });
    slot.appendChild(footer.element);
    _footers.set(modalId, footer);
  }

  const copyBtn = container.querySelector<HTMLButtonElement>('.myio-tm-copy');
  copyBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const text = copyBtn.dataset.copy || '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard indisponível (iframe sem permissão) */
    }
    copyBtn.textContent = '✓';
    setTimeout(() => {
      copyBtn.innerHTML =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    }, 1200);
  });
}
